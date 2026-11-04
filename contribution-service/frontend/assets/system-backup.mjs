// Portable owner backup. Verification is offline and never writes to the API.
const MAX_BYTES=128*1024*1024, MAX_IMAGE=12*1024*1024;
const encoder=new TextEncoder();
const clone=value=>JSON.parse(JSON.stringify(value));
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
const encode=bytes=>{let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out);};
const decode=text=>{const raw=atob(text);return Uint8Array.from(raw,c=>c.charCodeAt(0));};
export function imageReferences(data){
  const refs=new Set();
  function walk(value,key=''){
    if(value===null||typeof value!=='object')return;
    if(Array.isArray(value)){for(const item of value){if(key==='images'){const src=typeof item==='string'?item:item?.src;if(typeof src==='string'&&!src.startsWith('data:image/'))refs.add(src);}walk(item,key);}return;}
    for(const [k,v] of Object.entries(value))walk(v,k);
  }
  walk(data);return [...refs].sort();
}
function validData(data){return data?.schemaVersion===1&&['questions','submissions','history','builtinQuestions','builtinEdits','unitSettings','unitSettingsHistory'].every(k=>Array.isArray(data[k]));}
export function imageURL(ref,origin){
  const main='https://yocheng06.github.io/course-library/';
  const url=new URL(ref,ref.startsWith('assets/')?main:origin);
  if(url.origin===new URL(origin).origin&&/^\/api\/image\/[a-zA-Z0-9/_-]+$/.test(url.pathname))return url.href;
  if(url.origin==='https://yocheng06.github.io'&&/^\/course-library\/assets\/questions\/[a-zA-Z0-9/_.-]+$/.test(url.pathname)&&!url.pathname.includes('/../'))return url.href;
  throw new Error('題圖來源不在本站備份範圍：'+ref);
}
export async function createPackage(data,{origin,fetchImage=fetch,onProgress=()=>{}}={}){
  if(!validData(data))throw new Error('管理資料格式不完整，無法建立備份。');
  const snapshot=clone(data),resources=[],failures=[],refs=imageReferences(snapshot);
  let total=encoder.encode(JSON.stringify(snapshot)).length;
  if(total>MAX_BYTES)throw new Error('備份資料超過 128 MB，請分開匯出。');
  // Sequential resource reads cap memory and avoid flooding the image endpoint.
  for(let i=0;i<refs.length;i++){
    const reference=refs[i];onProgress({done:i,total:refs.length});
    try{
      const url=imageURL(reference,origin),response=await fetchImage(url,{credentials:new URL(url).origin===new URL(origin).origin?'same-origin':'omit',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const size=Number(response.headers.get('content-length'));if(size>MAX_IMAGE)throw new Error('單張題圖超過 12 MB');
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length>MAX_IMAGE||!bytes.length)throw new Error('題圖過大或為空');
      const type=(response.headers.get('content-type')||'').split(';')[0];
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(type))throw new Error('回應不是支援的圖片');
      total+=Math.ceil(bytes.length*4/3);if(total>MAX_BYTES)throw new Error('整包超過 128 MB');
      resources.push({reference,url,type,bytes:bytes.length,sha256:await sha256(bytes),base64:encode(bytes)});
    }catch(error){failures.push({reference,error:String(error.message)});}
  }
  onProgress({done:refs.length,total:refs.length});
  return {format:'course-library.owner-backup',version:1,createdAt:new Date().toISOString(),complete:failures.length===0,data:snapshot,dataSha256:await sha256(encoder.encode(JSON.stringify(snapshot))),resources,failures};
}
export async function verifyPackage(raw){
  if(typeof raw!=='string'||encoder.encode(raw).length>MAX_BYTES)throw new Error('備份檔最多 128 MB。');
  let pack;try{pack=JSON.parse(raw);}catch{throw new Error('備份不是有效 JSON。');}
  if(pack?.format!=='course-library.owner-backup'||pack.version!==1||!validData(pack.data)||!Array.isArray(pack.resources)||!Array.isArray(pack.failures))throw new Error('不支援或不完整的管理備份格式。');
  const errors=[];
  if(await sha256(encoder.encode(JSON.stringify(pack.data)))!==pack.dataSha256)errors.push('題庫與歷史資料校驗失敗');
  const refs=new Set(imageReferences(pack.data)),seen=new Set();
  for(const image of pack.resources){
    if(!refs.has(image?.reference)||seen.has(image.reference)){errors.push('圖片清單重複或與題目不符');continue;}
    seen.add(image.reference);
    try{if(typeof image.base64!=='string'||image.base64.length>Math.ceil(MAX_IMAGE*4/3)+4)throw Error();const bytes=decode(image.base64);if(bytes.length!==image.bytes||await sha256(bytes)!==image.sha256)throw Error();}
    catch{errors.push('圖片內容校驗失敗：'+image.reference);}
  }
  for(const ref of refs)if(!seen.has(ref))errors.push('缺少圖片：'+ref);
  if(pack.complete!==true||pack.failures.length)errors.push('建立時有未完成的圖片下載');
  const duplicate=(rows,key)=>{const ids=rows.map(key);return new Set(ids).size!==ids.length;};
  if(duplicate(pack.data.questions,q=>q.id)||duplicate(pack.data.submissions,q=>q.id))errors.push('題目或投稿 ID 重複');
  return {ok:!errors.length,errors,questions:pack.data.questions.length,builtins:pack.data.builtinQuestions.length,history:pack.data.history.length,images:seen.size,createdAt:pack.createdAt,plan:['先在獨立測試資料庫還原資料與歷史','依 reference／url 對照還原圖片並校驗 SHA-256','檢查單元設定、題數與公開／已移除狀態','測試通過後才安排正式切換']};
}
export function setupSystemPanel({container,api,downloadJSON,userId='owner'}){
  const recordKey='course-library.owner-backup.v1.'+userId;
  container.innerHTML='<h2>版本、同步與備份</h2><button type="button" class="plain" data-system-refresh>重新檢查</button><dl data-system-facts></dl><h3>完整管理備份</h3><p>包含題目、修改歷史、單元設定與實際題圖；不含管理密碼、金鑰與個人學習紀錄。下載後可在此檢查完整性及復原步驟。</p><button type="button" class="plain" data-system-export>建立完整備份（含題圖）</button><button type="button" class="plain" data-system-check>檢查備份與復原準備</button><input type="file" accept=".json,application/json" hidden><p data-system-status role="status" aria-live="polite"></p><pre data-system-report></pre>';
  const find=s=>container.querySelector(s),status=find('[data-system-status]'),facts=find('[data-system-facts]');let busy=false;
  const fact=(label,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;facts.append(dt,dd);};
  async function show(){facts.replaceChildren();status.textContent='正在檢查版本與 API…';
    const results=await Promise.allSettled([api('/api/manage/system'),fetch('https://yocheng06.github.io/course-library/assets/site-version.json',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})]);
    const server=results[0].status==='fulfilled'?results[0].value:null,site=results[1].status==='fulfilled'?results[1].value:null;
    fact('主站版本',site?.version||'無法取得主站版本');fact('主站提交版本',site?.sourceRevision||'未提供（可能為分支式發布）');fact('API 版本',server?.build?.version||'無法連線');fact('API 建置指紋',server?.build?.sourceHash||'未提供');
    fact('API 檢查時間',server?.checkedAt||'未完成');
    fact('作業系統最新資料版本',server?.api?.os||'未確認');fact('演算法最新資料版本',server?.api?.algorithms||'未確認');
    for(const course of ['os','algorithms'])fact(course==='os'?'作業系統快照':'演算法快照',server?.snapshots?.[course]?.generatedAt||'無法取得');
    fact('版本代號是否一致',site&&server?site.version===server.build.version?'一致':'版本不同，可能尚未部署完成':'尚未確認');
    let record=null;try{record=JSON.parse(localStorage.getItem(recordKey)||'null');}catch{}
    fact('此瀏覽器最近建立完整備份下載',record?.createdAt||'尚無紀錄');fact('此瀏覽器最近通過備份檢查',record?.verifiedAt||'尚無紀錄');
    status.textContent=(results.some(r=>r.status==='rejected')?'檢查未完整，部分服務無法連線。':'已完成檢查。')+'快照時間不等於最新投稿時間；個人瀏覽器同步狀態請在主站查看。';
  }
  async function exportAll(){if(busy)return;busy=true;find('[data-system-export]').disabled=true;status.textContent='正在讀取管理資料…';
    try{const data=await api('/api/manage/export');const pack=await createPackage(data,{origin:window.courseContributions.apiOrigin,onProgress:p=>{status.textContent=`正在保存題圖 ${p.done} / ${p.total}…`;}});
      const report=await verifyPackage(JSON.stringify(pack));find('[data-system-report]').textContent=JSON.stringify(report,null,2);
      downloadJSON(pack,pack.complete?'課程題庫與圖片完整備份.json':'課程題庫備份-尚有缺漏.json');
      if(report.ok){try{localStorage.setItem(recordKey,JSON.stringify({createdAt:pack.createdAt,verifiedAt:new Date().toISOString()}));}catch{}status.textContent='完整備份已建立並通過校驗；請確認瀏覽器已完成下載。';}
      else status.textContent='備份有缺漏，已下載診斷檔；不能視為可完整還原，請修正題圖後重試。';
    }catch(error){status.textContent='無法建立備份：'+error.message;}finally{busy=false;find('[data-system-export]').disabled=false;}
  }
  find('[data-system-refresh]').addEventListener('click',show);find('[data-system-export]').addEventListener('click',exportAll);
  const input=find('input');find('[data-system-check]').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>MAX_BYTES)throw Error('備份檔最多 128 MB。');const report=await verifyPackage(await file.text());find('[data-system-report]').textContent=JSON.stringify(report,null,2);status.textContent=report.ok?'備份完整性檢查通過。復原計畫已列出；此操作不會寫入正式題庫。':'備份檢查未通過，請查看缺漏清單。';if(report.ok)try{const record=JSON.parse(localStorage.getItem(recordKey)||'{}');localStorage.setItem(recordKey,JSON.stringify({...record,verifiedAt:new Date().toISOString()}));}catch{}}catch(error){status.textContent='無法檢查備份：'+error.message;}finally{input.value='';}});
  return {show,clear(){container.replaceChildren();}};
}
