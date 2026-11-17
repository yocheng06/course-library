import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createPackage} from '../../assets/system-backup.mjs';
import {prepareMigration,rewriteImages} from '../scripts/prepare-cloudflare-migration.mjs';
import {buildCloudflare,legacyOrigin,serviceOrigin} from '../scripts/build-cloudflare.mjs';
import {createD1ImageStore} from '../worker/d1-image-store.mjs';
const origin='https://course-library-test.example';
const id='11111111-1111-4111-8111-111111111111';
const image=legacyOrigin+'/api/image/'+id+'/0-0';
const source={schemaVersion:1,exportedAt:new Date().toISOString(),unitSettings:[],unitSettingsHistory:[],builtinQuestions:[],builtinEdits:[],corrections:[],questions:[{id:'community-'+id+'-1',fingerprint:'retained-fingerprint',submissionId:id,course:'os',unit:'L9',revision:2,published:false,createdAt:1,updatedAt:2,data:{id:'community-'+id+'-1',stem:'圖片測試 [__1__]',options:[],answer:'48',images:[{src:image}],note:"保留原文 ' 測試"}}],submissions:[{id,course:'os',unit:'L9',title:'測試',payload:{questions:[{images:[image]}]},status:'approved',revision:1,created_at:1,reviewed_at:null,reviewer_id:null,note:''}],history:[{id:'history',question_id:'community-'+id+'-1',revision:1,course:'os',unit:'L9',data:{images:[image]},is_published:1,action:'delete',actor:'test',note:'保留歷史',created_at:1}]};
test('portable restore retains IDs, revisions, hidden state, complete history and image bytes while remapping only image URLs',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'course-migration-'));
  try{
    const pack=await createPackage(source,{origin:legacyOrigin,fetchImage:async()=>new Response(Uint8Array.of(1,2,3),{headers:{'content-type':'image/png'}})});
    const backup=join(dir,'backup.json');await writeFile(backup,JSON.stringify(pack));
    const out=join(dir,'restore'),manifest=await prepareMigration({backup,origin,out});
    assert.equal(manifest.hidden,1);assert.equal(manifest.adminAccounts,0);assert.equal(manifest.resources.length,1);
    assert.equal(manifest.resources[0].key,'submissions/'+id+'/0-0');
    assert.deepEqual([...await readFile(join(out,manifest.resources[0].file))],[1,2,3]);
    const db=new DatabaseSync(':memory:'),sql=await readFile(join(out,'database.sql'),'utf8');db.exec(sql);
    const row=db.prepare('SELECT * FROM public_questions').get();
    assert.equal(row.id,source.questions[0].id);assert.equal(row.revision,2);assert.equal(row.is_published,0);
    assert.equal(JSON.parse(row.data).answer,'48');assert.equal(JSON.parse(row.data).note,source.questions[0].data.note);
    assert.equal(JSON.parse(row.data).images[0].src,image.replace(legacyOrigin,origin));
    assert.equal(JSON.parse(db.prepare('SELECT data FROM question_history').get().data).images[0],image.replace(legacyOrigin,origin));
    assert.throws(()=>db.exec(sql),/already exists/);db.close();
    await assert.rejects(prepareMigration({backup,origin,out}),/已有移植包/);
    pack.data.questions[0].data.answer='99';await writeFile(backup,JSON.stringify(pack));
    await assert.rejects(prepareMigration({backup,origin,out:join(dir,'bad')}),/校驗失敗/);
  }finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));await rm(dir,{recursive:true,force:true});}
});
test('only complete HTTPS origins are accepted and static GitHub assets retain their links',()=>{
  for(const value of ['http://example.com','https://example.com/path','https://u:p@example.com','https://example.com/'])assert.throws(()=>serviceOrigin(value));
  const text='https://yocheng06.github.io/course-library/assets/questions/a.png';
  assert.equal(rewriteImages(text,origin),text);
});
test('D1-only image migration preserves binary bytes through bounded SQL chunks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'course-migration-'));
  try{
    const bytes=Uint8Array.from({length:140000},(_,i)=>i%256);
    const pack=await createPackage(source,{origin:legacyOrigin,fetchImage:async()=>new Response(bytes,{headers:{'content-type':'image/png'}})});
    const backup=join(dir,'backup.json');await writeFile(backup,JSON.stringify(pack));
    const manifest=await prepareMigration({backup,origin,out:join(dir,'restore'),storage:'d1'});
    assert.equal(manifest.storage,'d1');
    const sql=await readFile(join(dir,'restore/database.sql'),'utf8'),db=new DatabaseSync(':memory:');db.exec(sql);
    const restored=db.prepare('SELECT body FROM image_objects').get().body;assert.deepEqual(restored,bytes);
    const DB={prepare(query){let args=[];return {bind(...values){args=values.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value);return this;},async first(){return db.prepare(query).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(query).run(...args).changes)}};}};}};
    const store=createD1ImageStore(DB),key=manifest.resources[0].key;
    assert.deepEqual((await store.get(key)).body,bytes);
    await store.put(key,Uint8Array.of(0,255,128,1),{httpMetadata:{contentType:'image/webp'}});
    assert.deepEqual((await store.get(key)).body,Uint8Array.of(0,255,128,1));
    assert.equal((await store.get(key)).httpMetadata.contentType,'image/webp');
    await assert.rejects(store.put('../invalid',bytes,{httpMetadata:{contentType:'image/png'}}),/Invalid image key/);
    await assert.rejects(store.put(key,new Uint8Array(1024*1024+1),{httpMetadata:{contentType:'image/png'}}),/1 MB/);
    await store.delete(key);assert.equal(await store.get(key),null);db.close();
  }finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));await rm(dir,{recursive:true,force:true});}
});
test('Cloudflare service uses its configured origin and cannot trust forged ChatGPT identity headers',async()=>{
  const built=await buildCloudflare(origin),worker=(await import(pathToFileURL(built.entry).href+'?test=cloudflare')).default;
  const db=new DatabaseSync(':memory:');
  const DB={prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(query).get(...args)||null;},async all(){return {results:db.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(query).run(...args).changes)}};}};}};
  const env={DB,PUBLIC_ORIGIN:origin,REVIEWER_EMAIL:'owner@example.test'};
  const response=await worker.fetch(new Request(origin+'/submit'),env);assert.equal(response.status,200);
  const config=await worker.fetch(new Request(origin+'/assets/contributions-config.js'),env);assert.match(await config.text(),/course-library-test\.example/);
  const session=await worker.fetch(new Request(origin+'/api/session',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'owner@example.test'}}),env);
  const data=await session.json();assert.equal(data.isReviewer,false);assert.equal(data.canManageCredentials,false);
  const rejected=await worker.fetch(new Request('https://wrong.example/submit'),env);assert.equal(rejected.status,503);
  const originRejected=await worker.fetch(new Request(origin+'/api/submissions',{method:'POST',headers:{Origin:'https://evil.example'}}),env);assert.equal(originRejected.status,403);
  db.close();
});
