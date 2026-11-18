// RFC 6238, SHA-1 / 6 digits / 30 seconds, compatible with authenticator apps.
function securityBase32(bytes) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out='';
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=alphabet[(value>>>bits)&31];}}
  if(bits)out+=alphabet[(value<<(5-bits))&31];return out;
}
async function securityTotp(secret,counter,digits=6) {
  const data=new Uint8Array(8);new DataView(data.buffer).setBigUint64(0,BigInt(counter));
  const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,data)),offset=bytes.at(-1)&15;
  const number=((bytes[offset]&127)<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3];
  return String(number%10**digits).padStart(digits,'0');
}
async function securityCounter(secret,code,now=Date.now()) {
  if(!/^\d{6}$/.test(code))return null;
  const counter=Math.floor(now/30000);
  for(const offset of [0,-1,1])if(sameSecret(await securityTotp(secret,counter+offset),code))return counter+offset;
  return null;
}
async function securityKey(env,purpose) {
  if(!env.RATE_HASH_KEY)throw new HttpError(503,'安全設定尚未完成。');
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode('course-security-v1:'+purpose+':'+env.RATE_HASH_KEY));
}
async function securitySeal(env,bytes) {
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',await securityKey(env,'totp'),{name:'AES-GCM'},false,['encrypt']);
  return toHex(iv)+':'+toHex(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes)));
}
async function securityOpen(env,value) {
  const [iv,data]=value.split(':'),key=await crypto.subtle.importKey('raw',await securityKey(env,'totp'),{name:'AES-GCM'},false,['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromHex(iv)},key,fromHex(data)));
}
const securityDatabases=new WeakSet();
async function adminSecurity(env) {
  if(!securityDatabases.has(env.DB)){
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_security (id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0,secret TEXT,pending_secret TEXT,pending_at INTEGER,version INTEGER NOT NULL DEFAULT 0,last_counter INTEGER NOT NULL DEFAULT -1,recovery_hashes TEXT NOT NULL DEFAULT \'[]\')').run();
    await env.DB.prepare('INSERT INTO admin_security(id) VALUES(1) ON CONFLICT(id) DO NOTHING').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_revoked_sessions (token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)').run();
    securityDatabases.add(env.DB);
  }
  return env.DB.prepare('SELECT * FROM admin_security WHERE id=1').first();
}
async function adminPasswordProof(env,account,password) {
  if(typeof password!=='string'||new TextEncoder().encode(password).length>128||!sameSecret(await derivePassword(password,account.salt,account.iterations),account.password_hash))throw new HttpError(401,'密碼或驗證碼不正確。');
}
async function consumeSecondFactor(env,state,value) {
  const code=typeof value==='string'?value.trim():'';
  const counter=await securityCounter(await securityOpen(env,state.secret),code);
  if(counter!==null&&counter>state.last_counter){
    const r=await env.DB.prepare('UPDATE admin_security SET last_counter=? WHERE id=1 AND enabled=1 AND version=? AND last_counter<?').bind(counter,state.version,counter).run();
    if(r.meta.changes)return true;
  }
  const recovery=code.toUpperCase().replaceAll('-','');
  if(!/^[A-F0-9]{32}$/.test(recovery))return false;
  const hashes=JSON.parse(state.recovery_hashes),digest=await hash('recovery:'+recovery),index=hashes.findIndex(h=>sameSecret(h,digest));
  if(index<0)return false;hashes.splice(index,1);
  const r=await env.DB.prepare('UPDATE admin_security SET recovery_hashes=? WHERE id=1 AND enabled=1 AND version=? AND recovery_hashes=?').bind(JSON.stringify(hashes),state.version,state.recovery_hashes).run();
  return Boolean(r.meta.changes);
}
async function manageAdminSecurity(request,env,path) {
  await owner(request,env);
  const account=await getAdminAccount(env),state=await adminSecurity(env);
  if(request.method==='GET'&&path==='/api/manage/security')return json({enabled:Boolean(state.enabled),recoveryRemaining:JSON.parse(state.recovery_hashes).length,sessionHours:ADMIN_SESSION_MS/3600000});
  if(request.method!=='POST')throw new HttpError(405,'不支援此操作。');
  requireOrigin(request,true);await adminLoginLimit(request,env);
  const body=await readBody(request,4096);
  // Enrollment confirmation uses the already authenticated session and the
  // pending authenticator secret; all other changes recheck the password.
  if(path!=='/api/manage/security/confirm')await adminPasswordProof(env,account,body.password);
  if(path==='/api/manage/security/enroll'){
    if(state.enabled)throw new HttpError(409,'第二道驗證已啟用。');
    const secret=crypto.getRandomValues(new Uint8Array(20));
    await env.DB.prepare('UPDATE admin_security SET pending_secret=?,pending_at=? WHERE id=1 AND enabled=0').bind(await securitySeal(env,secret),Date.now()).run();
    return json({secret:securityBase32(secret),expiresIn:600,issuer:'課程題庫',account:account.username});
  }
  if(path==='/api/manage/security/confirm'){
    if(state.enabled||!state.pending_secret||Date.now()-state.pending_at>600000)throw new HttpError(409,'設定已逾時，請重新開始。');
    const counter=await securityCounter(await securityOpen(env,state.pending_secret),String(body.code||'').trim());
    if(counter===null)throw new HttpError(401,'驗證碼不正確，請確認手機時間或等待下一組驗證碼。');
    const codes=Array.from({length:8},()=>toHex(crypto.getRandomValues(new Uint8Array(16))).toUpperCase()),hashes=await Promise.all(codes.map(c=>hash('recovery:'+c)));
    const r=await env.DB.prepare('UPDATE admin_security SET enabled=1,secret=pending_secret,pending_secret=NULL,pending_at=NULL,last_counter=?,recovery_hashes=?,version=version+1 WHERE id=1 AND enabled=0 AND pending_secret=?').bind(counter,JSON.stringify(hashes),state.pending_secret).run();
    if(!r.meta.changes)throw new HttpError(409,'設定已變更，請重新整理。');
    const response=json({ok:true,recoveryCodes:codes.map(c=>c.match(/.{4}/g).join('-'))});
    response.headers.set('set-cookie',await createAdminCookie(account,env));return response;
  }
  if(!['/api/manage/security/disable','/api/manage/security/revoke'].includes(path))throw new HttpError(404,'找不到此安全操作。');
  if(state.enabled&&!await consumeSecondFactor(env,state,body.code))throw new HttpError(401,'密碼或驗證碼不正確；同一組驗證碼不能重複使用。');
  const query=path.endsWith('/disable')?'UPDATE admin_security SET enabled=0,secret=NULL,pending_secret=NULL,pending_at=NULL,recovery_hashes=\'[]\',last_counter=-1,version=version+1 WHERE id=1 AND version=?':'UPDATE admin_security SET version=version+1 WHERE id=1 AND version=?';
  const result=await env.DB.prepare(query).bind(state.version).run();
  if(!result.meta.changes)throw new HttpError(409,'安全設定已變更，請重新登入。');
  const response=json({ok:true});response.headers.set('set-cookie',await createAdminCookie(account,env));return response;
}
