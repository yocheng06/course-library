/** Local-only preview: real built Worker routes, isolated in-memory D1/R2 fixtures.
 * Run `node scripts/build.mjs` first, then `node scripts/preview.mjs --port 8921`.
 * Static frontend files are read on each request, so UI edits appear on reload.
 * This adapter never connects to production APIs or databases.
 */
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const frontend=resolve(root,'frontend');
const argument=process.argv.indexOf('--port');
const port=Number(argument<0?8921:process.argv[argument+1]);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a port from 1024 through 65535.');
const localOrigin='http://127.0.0.1:'+port;
const productionOrigin='https://course-library-submissions-yocheng06.yocheng06.chatgpt.site';
const worker=(await import(pathToFileURL(resolve(root,'dist/server/index.js')).href)).default;
const sql=new DatabaseSync(':memory:');
for(const file of (await readdir(resolve(root,'drizzle'))).filter(n=>n.endsWith('.sql')).sort())sql.exec(await readFile(resolve(root,'drizzle',file),'utf8'));
const DB={prepare(query){
  let values=[];
  const statement={
    bind(...args){values=args;return statement;},
    async first(){return sql.prepare(query).get(...values)||null;},
    async all(){return {results:sql.prepare(query).all(...values)};},
    runSync(){const r=sql.prepare(query).run(...values);return {meta:{changes:Number(r.changes)}};},
    async run(){return statement.runSync();},
  };return statement;
},async batch(statements){
  sql.exec('BEGIN');
  try{const result=statements.map(s=>s.runSync());sql.exec('COMMIT');return result;}
  catch(error){sql.exec('ROLLBACK');throw error;}
}};
const objects=new Map();
const BUCKET={
  async put(key,bytes,options){objects.set(key,{body:bytes,httpMetadata:options.httpMetadata});},
  async get(key){return objects.get(key)||null;},async delete(key){objects.delete(key);},
};
const env={DB,BUCKET,REVIEWER_EMAIL:'preview@example.test',RATE_HASH_KEY:'local-preview-only-not-production'};
let adminCookie='',autoAuth=true;
async function call(path,{method='GET',body,authenticated=true,bound=false}={}){
  const headers={'content-type':'application/json',origin:productionOrigin,'cf-connecting-ip':'127.0.0.1'};
  if(authenticated&&adminCookie)headers.cookie=adminCookie;
  if(bound){headers['oai-authenticated-user-id']='local-preview-owner';headers['oai-authenticated-user-email']=env.REVIEWER_EMAIL;}
  const response=await worker.fetch(new Request(productionOrigin+path,{method,headers,body:body?JSON.stringify(body):undefined}),env);
  const text=await response.clone().text();let data;
  try{data=JSON.parse(text);}catch{}
  if(!response.ok)throw new Error(`Fixture ${method} ${path} failed (${response.status}): ${text}`);
  return {response,data};
}
const password='preview-only-'+randomUUID();
const provisioned=await call('/api/password/setup',{method:'POST',authenticated:false,bound:true,body:{username:'preview-owner',password,confirmPassword:password}});
adminCookie=provisioned.response.headers.get('set-cookie').split(';')[0];
const fixtureQuestions=[
 {category:'本機預覽',type:'單選題',stem:'本機預覽：應該先檢查哪個管理流程？',options:['最近修改','忽略歷史'],answer:'A',explanation:'這是記憶體中的測試題目，可放心操作。',images:[]},
 {category:'本機預覽',type:'填空題',stem:'本機預覽：這些測試資料存放在 ____________。',options:[],answer:'memory',explanation:'重新啟動預覽服務後會重建。',images:[]},
 {category:'本機預覽',type:'多選題',stem:'本機預覽：哪些功能應保留？',options:['題目原文','修改歷史','可復原移除'],answer:'A、B、C',explanation:'用於檢查已移除清單。',images:[]},
];
const submitted=(await call('/api/submissions',{method:'POST',authenticated:false,body:{course:'os',unit:'L9',unitTitle:'記憶體管理',title:'本機預覽匯入紀錄',source:'本機 fixture，不是正式題庫',questions:fixtureQuestions}})).data;
const communityId=(n)=>'community-'+submitted.id+'-'+n;
await call('/api/manage/questions/'+communityId(1),{method:'POST',body:{action:'update',revision:1,note:'本機預覽：測試修改歷史',payload:{course:'os',unit:'L9',unitTitle:'記憶體管理',title:'本機測試',questions:[{...fixtureQuestions[0],answer:'B',explanation:'這是為歷史比對建立的新版本。'}]}}});
await call('/api/community/questions/'+communityId(3),{method:'POST',authenticated:false,body:{action:'delete',revision:1}});
const builtin=async(id)=>(await call('/api/manage/library/item?course=os&source=builtin&id='+id)).data.item;
const first=await builtin('basics-1');
await call('/api/manage/builtin-questions/os/basics-1',{method:'POST',body:{action:'update',revision:first.revision,sourceHash:first.sourceHash,note:'本機預覽：內建題修改',question:{...first.question,explanation:first.question.explanation+'\n本機預覽補充：檢查修改與還原流程。'}}});
const second=await builtin('basics-2');
await call('/api/community/builtin-questions/os/basics-2',{method:'POST',authenticated:false,body:{action:'delete',revision:second.revision,sourceHash:second.sourceHash}});
const third=await builtin('basics-3');
await call('/api/manage/builtin-questions/os/basics-3',{method:'POST',body:{action:'update',revision:third.revision,sourceHash:third.sourceHash,note:'本機預覽：曾修改題',question:{...third.question,explanation:third.question.explanation+'\n本機測試修改。'}}});
await call('/api/manage/builtin-questions/os/basics-3',{method:'POST',body:{action:'reset',revision:third.revision+1,sourceHash:third.sourceHash,note:'本機預覽：還原原始內容仍能查看歷史'}});
const contentTypes={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,localOrigin);
    if(url.pathname==='/__preview/status'){
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify({localOnly:true,pid:process.pid,origin:localOrigin,authenticated:autoAuth,fixtureSubmission:submitted.id}));return;
    }
    if(url.pathname==='/__preview/reset-session'&&req.method==='POST'){
      autoAuth=true;res.writeHead(204);res.end();return;
    }
    if(url.pathname.startsWith('/api/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const headers=new Headers();
      for(const [key,value]of Object.entries(req.headers))if(value!==undefined&&!['host','connection','cookie','origin'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
      headers.set('origin',productionOrigin);headers.set('cf-connecting-ip','127.0.0.1');
      if(autoAuth)headers.set('cookie',adminCookie);
      const body=Buffer.concat(chunks);
      const response=await worker.fetch(new Request(productionOrigin+url.pathname+url.search,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)&&body.length?{body}: {})}),env);
      if(url.pathname==='/api/logout'&&response.ok)autoAuth=false;
      if(url.pathname==='/api/login'&&response.ok){adminCookie=response.headers.get('set-cookie')?.split(';')[0]||adminCookie;autoAuth=true;}
      const outputHeaders=Object.fromEntries(response.headers);delete outputHeaders['set-cookie'];
      res.writeHead(response.status,outputHeaders);res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(url.pathname==='/assets/contributions-config.js'){
      res.writeHead(200,{'content-type':contentTypes['.js'],'cache-control':'no-store'});
      res.end('window.courseContributions=Object.freeze({apiOrigin:'+JSON.stringify(localOrigin)+'});');return;
    }
    const name=url.pathname==='/'||url.pathname==='/review'?'/review.html':url.pathname==='/submit'?'/submit.html':decodeURIComponent(url.pathname);
    const path=resolve(frontend,'.'+name);
    if(path!==frontend&&!path.startsWith(frontend+sep)){res.writeHead(403);res.end('Forbidden');return;}
    let bytes=await readFile(path);
    if(extname(path)==='.html'){
      const banner='<p style="margin:0;padding:8px 16px;background:#fff1c2;color:#392e00;text-align:center;font:14px system-ui" role="note">本機預覽：僅使用記憶體測試資料，修改與還原不影響公開網站。</p>';
      bytes=Buffer.from(bytes.toString('utf8').replace(/<body([^>]*)>/i,'<body$1>'+banner));
    }
    res.writeHead(200,{'content-type':contentTypes[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'content-type':'text/plain;charset=utf-8'});res.end(error.code==='ENOENT'?'Preview file not found.':String(error.message));}
});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({preview:localOrigin+'/review',pid:process.pid,localOnly:true,stop:'Stop-Process -Id '+process.pid})));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
const close=()=>server.close(()=>{sql.close();process.exit(0);});
process.on('SIGINT',close);process.on('SIGTERM',close);
