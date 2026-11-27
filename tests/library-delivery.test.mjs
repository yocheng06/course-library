import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {parseHTML} from 'linkedom';
import {trafficBindings,configureTrafficBindings} from '../scripts/configure-traffic-bindings.mjs';
import {renderTrafficStatus,usageBannerText} from '../assets/system-backup.mjs';
const source=await readFile(new URL('../contribution-service/worker/library-delivery.js',import.meta.url),'utf8');
function setup({fetcher=async()=>{throw Error('no network')},now=Date.parse('2026-11-27T04:00:00Z')}={}){
 const db=new DatabaseSync(':memory:'),queries=[];
 db.exec('CREATE TABLE public_questions(id TEXT PRIMARY KEY,course TEXT,unit TEXT,data TEXT,is_published INTEGER);CREATE TABLE builtin_question_edits(id TEXT PRIMARY KEY,course TEXT,data TEXT);CREATE TABLE unit_settings(course TEXT PRIMARY KEY,revision INTEGER,data TEXT)');
 const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){queries.push(sql);return db.prepare(sql).get(...values)||null;},async all(){queries.push(sql);return {results:db.prepare(sql).all(...values)};},async run(){queries.push(sql);return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}};}};},async batch(rows){db.exec('BEGIN');try{const result=[];for(const row of rows)result.push(await row.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 let clock=now;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 class HttpError extends Error{constructor(status,message,details={}){super(message);this.status=status;this.details=details;}}
 const context=vm.createContext({Response,Request,Headers,AbortSignal,URL,Date:Clock,console,fetch:fetcher,BUILD_META:{sourceHash:'test-source'},LIBRARY_BUILD_REVISION:'test',HttpError,hash:async value=>createHash('sha256').update(value).digest('hex'),ensureUnitSettings:async()=>{},visitorIdentity:async request=>({ip:request.headers.get('cf-connecting-ip')||'',browser:request.headers.get('cookie')?.match(/visitor=([\w-]+)/)?.[1]||''})});
 const api=vm.runInContext(source+';({libraryRevisionDDL,ensureLibraryRevisions,libraryRevisionEtag,serveCachedLibrary,enforceReadTraffic,readTrafficKind,localReadLimit,cloudflareUsageStatus,usageWarnings,libraryTrafficStatus})',context);
 context.publicLibraryEtag=api.libraryRevisionEtag;
 return {api,db,DB,queries,env:{DB,RATE_HASH_KEY:'test-salt',LIBRARY_ASSETS:{}},tick(ms){clock+=ms;},close(){db.close();}};
}
const request=(path='/api/questions?course=os',browser='one',ip='203.0.113.8',method='GET')=>new Request('https://example.test'+path,{method,headers:{cookie:'visitor='+browser,'cf-connecting-ip':ip}});
test('version checked responses avoid full scans and immediately reflect inserts, edits, removals, builtins and units',async()=>{
 const h=setup();try{
  await h.api.ensureLibraryRevisions(h.env);
  h.db.prepare('INSERT INTO public_questions VALUES (?,?,?,?,1)').run('q','os','basics','original');
  const build=async etag=>new Response(JSON.stringify({revision:etag,questions:(await h.DB.prepare("SELECT * FROM public_questions WHERE course='os' AND is_published=1").all()).results}));
  const first=await h.api.serveCachedLibrary(request(),h.env,'os',build),etag=first.headers.get('etag');assert.match(await first.text(),/original/);
  h.queries.length=0;
  const second=await h.api.serveCachedLibrary(request(),h.env,'os',build);assert.equal(second.headers.get('etag'),etag);assert.match(await second.text(),/original/);assert.equal(h.queries.length,1);assert.match(h.queries[0],/SELECT revision,generation FROM library_revisions/);
  const conditional=new Request(request(),{headers:{'if-none-match':etag}});assert.equal((await h.api.serveCachedLibrary(conditional,h.env,'os',build)).status,304);
  h.db.exec("UPDATE public_questions SET data='changed' WHERE id='q'");const changed=await h.api.serveCachedLibrary(request(),h.env,'os',build);assert.notEqual(changed.headers.get('etag'),etag);assert.match(await changed.text(),/changed/);
  h.db.exec("UPDATE public_questions SET is_published=0 WHERE id='q'");assert.equal((await (await h.api.serveCachedLibrary(request(),h.env,'os',build)).json()).questions.length,0);
  h.db.exec("UPDATE public_questions SET is_published=1 WHERE id='q'");assert.equal((await (await h.api.serveCachedLibrary(request(),h.env,'os',build)).json()).questions.length,1);
  for(const sql of ["INSERT INTO builtin_question_edits VALUES ('b','os','edit')","UPDATE builtin_question_edits SET data='new' WHERE id='b'","DELETE FROM builtin_question_edits WHERE id='b'","INSERT INTO unit_settings VALUES ('os',1,'[]')","UPDATE unit_settings SET data='[1]' WHERE course='os'","DELETE FROM unit_settings WHERE course='os'"]){const before=await h.api.libraryRevisionEtag(h.env,'os');h.db.exec(sql);assert.notEqual(await h.api.libraryRevisionEtag(h.env,'os'),before);}
  const oldOS=await h.api.libraryRevisionEtag(h.env,'os'),oldAlg=await h.api.libraryRevisionEtag(h.env,'algorithms');h.db.exec("UPDATE public_questions SET course='algorithms' WHERE id='q'");assert.notEqual(await h.api.libraryRevisionEtag(h.env,'os'),oldOS);assert.notEqual(await h.api.libraryRevisionEtag(h.env,'algorithms'),oldAlg);
  h.db.exec("BEGIN;UPDATE public_questions SET data='rollback' WHERE id='q';ROLLBACK");assert.equal(h.db.prepare("SELECT data FROM public_questions WHERE id='q'").get().data,'changed');
 }finally{h.close();}
});
test('a concurrent edit cannot poison a response cache with a mismatched revision',async()=>{
 const h=setup();try{
  await h.api.ensureLibraryRevisions(h.env);h.db.exec("INSERT INTO public_questions VALUES ('q','os','basics','old',1)");let builds=0;
  const build=async()=>{builds++;const text=h.db.prepare("SELECT data FROM public_questions WHERE id='q'").get().data;if(builds===1)h.db.exec("UPDATE public_questions SET data='latest' WHERE id='q'");return new Response(text);};
  assert.equal(await (await h.api.serveCachedLibrary(request(),h.env,'os',build)).text(),'latest');assert.equal(builds,2);
  assert.equal(await (await h.api.serveCachedLibrary(request(),h.env,'os',build)).text(),'latest');assert.equal(builds,2);
 }finally{h.close();}
});
test('restoring an older schema cannot reuse a response from the previous database generation',async()=>{
 const h=setup();try{
  const build=async()=>new Response(h.db.prepare("SELECT data FROM public_questions WHERE id='q'").get().data);
  h.db.exec("INSERT INTO public_questions VALUES ('q','os','basics','before restore',1)");
  const first=await h.api.serveCachedLibrary(request(),h.env,'os',build),etag=first.headers.get('etag');await first.text();
  for(const sql of Array.from(h.api.libraryRevisionDDL).slice(2)){const name=sql.match(/EXISTS (\w+)/)[1];h.db.exec('DROP TRIGGER '+name);}
  h.db.exec("DROP TABLE library_revisions;UPDATE public_questions SET data='restored latest backup' WHERE id='q'");
  const next=await h.api.serveCachedLibrary(request(),h.env,'os',build);assert.notEqual(next.headers.get('etag'),etag);assert.equal(await next.text(),'restored latest backup');
 }finally{h.close();}
});
test('excessive full reads cool down without adding D1 counters; classmates on the same IP retain separate budgets',async()=>{
 const h=setup();try{
  for(let i=0;i<60;i++)await h.api.enforceReadTraffic(request(),h.env,new URL(request().url));
  await assert.rejects(()=>h.api.enforceReadTraffic(request(),h.env,new URL(request().url)),e=>e.status===429&&e.details.retryAfter===60);
  for(let browser=0;browser<50;browser++)for(let i=0;i<10;i++){const r=request('/api/questions?course=algorithms','classmate-'+browser);await h.api.enforceReadTraffic(r,h.env,new URL(r.url));}
  assert.equal(h.queries.length,0);h.tick(60001);await h.api.enforceReadTraffic(request(),h.env,new URL(request().url));
  for(let i=0;i<70;i++){const r=request('/api/community/questions/q','fresh');await h.api.enforceReadTraffic(r,h.env,new URL(r.url));}
  const post=request('/api/submissions','one','203.0.113.8','POST');await h.api.enforceReadTraffic(post,h.env,new URL(post.url));
  assert.equal(h.api.readTrafficKind('/api/manage/export'),null);
 }finally{h.close();}
});
test('Cloudflare rate bindings receive opaque identity keys and rejected requests stop before database reads',async()=>{
 const h=setup(),keys=[];try{
  h.env.LIBRARY_READ_LIMITER={limit:async input=>{keys.push(input.key);return {success:false};}};
  // visitorIdentity in this unit harness supplies an already-hashed browser identity.
  await assert.rejects(()=>h.api.enforceReadTraffic(request('/api/questions?course=os','opaque-browser-hash'),h.env,new URL(request().url)),e=>e.status===429);
  assert.deepEqual(keys,['opaque-browser-hash']);assert.equal(h.queries.length,0);
  h.env.LIBRARY_READ_LIMITER={limit:async()=>{throw Error('temporary platform failure')}};
  await h.api.enforceReadTraffic(request('/api/questions?course=os','new-browser'),h.env,new URL(request().url));
 }finally{h.close();}
});
test('official usage is owner data, cached by UTC day, never fabricated when credentials or analytics fail',async()=>{
 let calls=0;const h=setup({fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');const body=JSON.parse(options.body);assert(!body.query.includes('scriptName'));assert.equal(body.variables.day,calls===1?'2026-11-27':'2026-11-28');
  return new Response(JSON.stringify({data:{viewer:{accounts:[{workersInvocationsAdaptive:[{sum:{requests:81000}}],d1AnalyticsAdaptiveGroups:[{sum:{rowsRead:4800000,rowsWritten:1000}}]}]}}}));
 }});try{
  const empty=await h.api.cloudflareUsageStatus(h.env);assert.equal(empty.state,'unconfigured');assert.equal(calls,0);assert.equal(empty.values,undefined);
  Object.assign(h.env,{CF_USAGE_ACCOUNT_ID:'a'.repeat(32),CF_USAGE_API_TOKEN:'secret-never-returned',CF_USAGE_PLAN:'free'});
  const status=await h.api.cloudflareUsageStatus(h.env);assert.equal(status.state,'ready');assert.equal(status.warnings.length,2);assert.equal(status.warnings[1].severity,'danger');assert(!JSON.stringify(status).includes('secret-never-returned'));
  await h.api.cloudflareUsageStatus(h.env);assert.equal(calls,1);h.tick(86400000);await h.api.cloudflareUsageStatus(h.env);assert.equal(calls,2);
  h.env.CF_USAGE_PLAN='paid';assert.deepEqual(JSON.parse(JSON.stringify(h.api.usageWarnings({requests:9999999},'paid'))),[]);
 }finally{h.close();}
 const failed=setup({fetcher:async()=>new Response(JSON.stringify({errors:[{message:'token=secret'}]}),{status:403})});try{
  Object.assign(failed.env,{CF_USAGE_ACCOUNT_ID:'a'.repeat(32),CF_USAGE_API_TOKEN:'secret',CF_USAGE_PLAN:'free'});const result=await failed.api.cloudflareUsageStatus(failed.env);assert.equal(result.state,'unavailable');assert.equal(result.values,undefined);assert(!JSON.stringify(result).includes('secret'));
 }finally{failed.close();}
});
test('deployment bindings are preserved and the revision migration matches the runtime fallback',async()=>{
 const h=setup();try{
  const migration=await readFile(new URL('../contribution-service/drizzle/0009_library_revisions.sql',import.meta.url),'utf8');assert.equal(migration.replaceAll('\r\n','\n'),Array.from(h.api.libraryRevisionDDL).join(';\n')+';\n');
  const config={d1_databases:[{binding:'DB',database_id:'keep'}],vars:{PUBLIC_ORIGIN:'https://keep.example'},triggers:{crons:['17 3 * * *']}};
  const after=configureTrafficBindings(config);assert.deepEqual(after.d1_databases,config.d1_databases);assert.deepEqual(after.triggers,config.triggers);assert.deepEqual(after.ratelimits,trafficBindings);assert.deepEqual(configureTrafficBindings(after),after);
 }finally{h.close();}
});
test('management UI distinguishes unavailable monitoring from safe usage and displays actual threshold warnings',()=>{
 const {document}=parseHTML('<html><body><section></section></body></html>'),previous=globalThis.document;globalThis.document=document;
 try{
  const host=document.querySelector('section');renderTrafficStatus(host,{usage:{state:'unconfigured',message:'官方額度提醒尚未啟用。'}});assert.match(host.textContent,/尚未啟用/);assert(!host.textContent.includes('已達免費額度'));
  const data={readLimit:{configured:true},usage:{state:'ready',plan:'free',checkedAt:'2026-11-27T00:00:00Z',values:{requests:81000,rowsRead:12,rowsWritten:3},warnings:[{label:'Workers 請求',percent:81}],message:'官方資料可能延遲。'}};
  renderTrafficStatus(host,data);assert.match(host.textContent,/81%/);assert.match(host.textContent,/81,000/);assert.match(usageBannerText(data),/81%/);assert(!usageBannerText({usage:{state:'unconfigured'}}));
 }finally{globalThis.document=previous;}
});
