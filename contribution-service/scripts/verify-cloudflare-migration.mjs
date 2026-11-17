import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {buildCloudflare,legacyOrigin} from './build-cloudflare.mjs';
const folder=resolve(process.argv[2]||''),manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
const sql=await readFile(join(folder,'database.sql'),'utf8');
assert.equal(createHash('sha256').update(sql).digest('hex'),manifest.sqlSha256);
const db=new DatabaseSync(':memory:');db.exec(sql);
const before=db.prepare('SELECT id,revision,data,is_published FROM public_questions ORDER BY id').all();
const beforeHistory=db.prepare('SELECT * FROM question_history ORDER BY id').all();
const DB={prepare(query){let values=[];return {bind(...args){values=args.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value);return this;},async first(){return db.prepare(query).get(...values)||null;},async all(){return {results:db.prepare(query).all(...values)};},async run(){return {meta:{changes:Number(db.prepare(query).run(...values).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
const resources=new Map(manifest.resources.map(image=>[image.key,image]));
const BUCKET={async get(key){const image=resources.get(key);if(!image)return null;const bytes=await readFile(join(folder,image.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);return {body:bytes,httpMetadata:{contentType:image.contentType}};}};
const {entry}=await buildCloudflare(manifest.origin),worker=(await import(pathToFileURL(entry).href)).default;
const env={DB,...(manifest.storage==='d1'?{}:{BUCKET}),PUBLIC_ORIGIN:manifest.origin};
const courses={};
for(const course of ['os','algorithms']){
  const response=await worker.fetch(new Request(manifest.origin+'/api/questions?course='+course),env);assert.equal(response.status,200);
  const data=await response.json();courses[course]={questions:data.questions.length,overrides:data.overrides.length};
  const original=await fetch(legacyOrigin+'/api/questions?course='+course).then(response=>{if(!response.ok)throw Error('來源 API 無法讀取');return response.json();});
  const key=row=>row.question.id||row.question.bookmarkId;
  assert.deepEqual(data.questions.map(key).sort(),original.questions.map(key).sort(),course+' public IDs differ');
  const originals=new Map(original.questions.map(row=>[key(row),row]));
  for(const row of data.questions){
    const expected=originals.get(key(row));
    for(const [long,short] of [['stem','q'],['answer','a'],['options','opts']])assert.deepEqual(row.question[long]??row.question[short],expected.question[long]??expected.question[short],key(row)+' '+long);
  }
}
let publicImages=0,privateImages=0;
for(const image of manifest.resources){
  const path='/api/image/'+image.key.slice('submissions/'.length);
  const response=await worker.fetch(new Request(manifest.origin+path),env);
  assert([200,401].includes(response.status),path+' '+response.status);
  if(response.status===200){publicImages++;assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),image.sha256);}
  else privateImages++;
}
assert.deepEqual(db.prepare('SELECT id,revision,data,is_published FROM public_questions ORDER BY id').all(),before,'public API mutated restored question data');
assert.deepEqual(db.prepare('SELECT * FROM question_history ORDER BY id').all(),beforeHistory,'public API replayed old content history');
db.close();
console.log(JSON.stringify({ok:true,counts:manifest.counts,published:manifest.published,hidden:manifest.hidden,courses,publicImages,privateImages,teacherAnswersPreserved:true,historyPreserved:true},null,2));
