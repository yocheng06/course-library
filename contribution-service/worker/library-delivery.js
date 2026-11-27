// Scalar revision tracking invalidates caches across isolates and raw SQL edits.
const libraryRevisionDDL=[
 "CREATE TABLE IF NOT EXISTS library_revisions (course TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, generation TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))))",
 "INSERT INTO library_revisions(course,revision) VALUES ('os',1),('algorithms',1) ON CONFLICT(course) DO NOTHING",
 ...['public_questions','builtin_question_edits','unit_settings'].flatMap(table=>['INSERT','UPDATE','DELETE'].map(action=>
  `CREATE TRIGGER IF NOT EXISTS library_revision_${table}_${action.toLowerCase()} AFTER ${action} ON ${table} BEGIN UPDATE library_revisions SET revision=revision+1 WHERE course ${action==='UPDATE'?'IN (OLD.course,NEW.course)':'= '+(action==='DELETE'?'OLD':'NEW')+'.course'}; END`
 ))
];
const libraryRevisionReady=new WeakSet(),libraryResponseCache=new WeakMap();
async function ensureLibraryRevisions(env){
 if(libraryRevisionReady.has(env.DB))return;
 await ensureUnitSettings(env);
 // Migrations normally install this before deployment; the fallback also supports restores.
 let ready=false;try{ready=Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM library_revisions WHERE course IN ('os','algorithms')").first())?.n)===2;if(ready){const triggers=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name LIKE 'library_revision_%'").first();ready=Number(triggers?.n)>=9;}}catch(error){if(!/no such table/i.test(String(error?.message)))throw error;}
 if(!ready)await env.DB.batch(libraryRevisionDDL.map(sql=>env.DB.prepare(sql)));
 libraryRevisionReady.add(env.DB);
}
async function libraryRevisionEtag(env,course){
 await ensureLibraryRevisions(env);
 const read=()=>env.DB.prepare('SELECT revision,generation FROM library_revisions WHERE course=?').bind(course).first();
 let row;try{row=await read();}catch(error){if(!/no such table/i.test(String(error?.message)))throw error;}
 if(!row){libraryRevisionReady.delete(env.DB);await ensureLibraryRevisions(env);row=await read();}
 if(!row)throw new HttpError(503,'題庫版本紀錄尚未完成。');
 return '"'+await hash(JSON.stringify([LIBRARY_BUILD_REVISION,BUILD_META.sourceHash,course,row.generation,row.revision]))+'"';
}
async function serveCachedLibrary(request,env,course,build){
 let cache=libraryResponseCache.get(env.DB);if(!cache){cache=new Map();libraryResponseCache.set(env.DB,cache);}
 for(let attempt=0;attempt<2;attempt++){
  const etag=await publicLibraryEtag(env,course);
  const headers={'content-type':'application/json;charset=utf-8','cache-control':'no-cache',etag};
  if((request.headers.get('if-none-match')||'').split(',').some(v=>[etag,'W/'+etag,'*'].includes(v.trim())))return new Response(null,{status:304,headers});
  const cached=cache.get(course);if(cached?.etag===etag)return new Response(cached.body,{headers});
  const response=await build(etag),body=await response.text();
  // Do not label/cache a response assembled while another request changed the library.
  if(await publicLibraryEtag(env,course)!==etag)continue;
  if(body.length<=8*1024*1024)cache.set(course,{etag,body});
  return new Response(body,{status:response.status,headers});
 }
 throw new HttpError(503,'題庫正在更新，請稍後重新同步。',{retryAfter:1});
}

const libraryRateFallback=new WeakMap();
function localReadLimit(env,name,key,limit,now=Date.now()){
 let counters=libraryRateFallback.get(env.DB);if(!counters){counters=new Map();libraryRateFallback.set(env.DB,counters);}
 const bucket=name+':'+key,old=counters.get(bucket);
 if(old&&old.until>now){old.count++;return old.count<=limit;}
 if(counters.size>=6000){for(const [k,v] of counters)if(v.until<=now)counters.delete(k);if(counters.size>=6000)counters.delete(counters.keys().next().value);}
 counters.set(bucket,{count:1,until:now+60000});return true;
}
function readTrafficKind(path){
 if(path==='/api/questions'||path==='/api/units'||path==='/course-library'||path==='/course-library/'||/^\/course-library\/(?:index|home|os|algorithms|batch)\.html$/.test(path)||/^\/course-library\/assets\/(?:batch-library|algorithms-counting-curation|os-treasure-curation)\.json$/.test(path)||/^\/course-library\/assets\/course-snapshots\/[^/]+\.json$/.test(path))return 'library';
 if(path.startsWith('/api/image/')||path.startsWith('/api/community/')||path.startsWith('/course-library/assets/'))return 'resource';
 return null;
}
async function enforceReadTraffic(request,env,url){
 if(!env.LIBRARY_ASSETS||!['GET','HEAD'].includes(request.method))return;
 const kind=readTrafficKind(url.pathname);if(!kind)return;
 const identity=await visitorIdentity(request,env);
 const network=await hash('read-network:'+env.RATE_HASH_KEY+':'+(identity.ip||'unknown'));
 const viewer=identity.browser||network;
 const viewerBinding=kind==='library'&&identity.browser?'LIBRARY_READ_LIMITER':'LIBRARY_RESOURCE_LIMITER',viewerLimit=kind==='library'&&identity.browser?60:600;
 const check=async(name,key,limit)=>{if(env[name]?.limit)try{return (await env[name].limit({key})).success;}catch{}return localReadLimit(env,name,key,limit);};
 // Separate the broad shared-IP budget from each browser's budget to tolerate classroom Wi-Fi.
 if(!await check(viewerBinding,viewer,viewerLimit)||!await check('LIBRARY_NETWORK_LIMITER',network,6000))throw new HttpError(429,'讀取過於頻繁，請稍候 60 秒再試；已載入的題目仍可繼續練習。',{retryAfter:60});
}

const cloudflareUsageCache=new WeakMap();
function usageWarnings(values,plan){
 if(plan!=='free')return [];
 const thresholds={requests:100000,rowsRead:5000000,rowsWritten:100000},names={requests:'Workers 請求',rowsRead:'D1 讀取列數',rowsWritten:'D1 寫入列數'};
 return Object.entries(thresholds).flatMap(([key,limit])=>values[key]>=limit*.8?[{metric:key,label:names[key],used:values[key],limit,percent:Math.round(values[key]/limit*100),severity:values[key]>=limit*.95?'danger':'warning'}]:[]);
}
async function cloudflareUsageStatus(env){
 const account=env.CF_USAGE_ACCOUNT_ID,token=env.CF_USAGE_API_TOKEN,plan=['free','paid'].includes(env.CF_USAGE_PLAN)?env.CF_USAGE_PLAN:'unknown';
 if(!/^[a-f0-9]{32}$/.test(account||'')||!token)return {state:'unconfigured',plan,warnings:[],message:'官方額度提醒尚未啟用：需設定 Cloudflare 帳號與唯讀分析金鑰。'};
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10),key=account+':'+day+':'+plan+':'+token,cached=cloudflareUsageCache.get(env.DB);
 if(cached?.key===key&&cached.until>now)return cached.value;
 let value;
 try{
  const query=`query LibraryDailyUsage($account: string!, $start: Time!, $end: Time!, $day: Date!) { viewer { accounts(filter:{accountTag:$account}) { workersInvocationsAdaptive(limit:1,filter:{datetime_geq:$start,datetime_leq:$end}) { sum { requests } } d1AnalyticsAdaptiveGroups(limit:1,filter:{date_geq:$day,date_leq:$day}) { sum { rowsRead rowsWritten } } } } }`;
  const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({query,variables:{account,start:day+'T00:00:00Z',end:new Date(now).toISOString(),day}}),signal:AbortSignal.timeout(8000)});
  const data=await response.json(),result=data?.data?.viewer?.accounts?.[0];
  if(!response.ok||data.errors?.length||!result||!Array.isArray(result.workersInvocationsAdaptive)||!Array.isArray(result.d1AnalyticsAdaptiveGroups))throw Error('analytics unavailable');
  const sum=(rows,key)=>rows.reduce((n,row)=>{const value=row?.sum?.[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('invalid analytics');return n+value;},0);
  const values={requests:sum(result.workersInvocationsAdaptive,'requests'),rowsRead:sum(result.d1AnalyticsAdaptiveGroups,'rowsRead'),rowsWritten:sum(result.d1AnalyticsAdaptiveGroups,'rowsWritten')};
  value={state:'ready',plan,day,checkedAt:new Date(now).toISOString(),resetAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),values,warnings:usageWarnings(values,plan),message:'Cloudflare 官方分析資料可能延遲或採樣；以帳號面板與帳單為準。'};
 }catch{
  value={state:'unavailable',plan,warnings:[],message:'暫時無法取得官方用量，請檢查唯讀分析權限或稍後重試；目前用量未知。'};
 }
 // Cache plain data only; never keep a request-owned fetch/D1 promise for another invocation.
 cloudflareUsageCache.set(env.DB,{key,value,until:now+(value.state==='ready'?300000:60000)});
 return value;
}
async function libraryTrafficStatus(env){
 return {readLimit:{configured:['LIBRARY_READ_LIMITER','LIBRARY_RESOURCE_LIMITER','LIBRARY_NETWORK_LIMITER'].every(name=>Boolean(env[name]?.limit)),libraryPerMinute:60,resourcesPerMinute:600,sharedNetworkPerMinute:6000,cooldownSeconds:60},cache:{mode:'revision-checked',message:'每次核對版本；投稿、改題、刪除及單元異動會更新版本。'},usage:await cloudflareUsageStatus(env)};
}
