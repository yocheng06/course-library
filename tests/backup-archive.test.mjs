import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {storeVerifiedBackup} from '../scripts/archive-d1-backup.mjs';
const sql=['public_questions','question_history','builtin_question_edits','submissions'].map(t=>'CREATE TABLE '+t+'(id TEXT,question_id TEXT,data TEXT);').join('\n')+'CREATE TABLE image_objects(key TEXT,body BLOB,size INTEGER,sha256 TEXT);';
test('private SQL generations keep old content and rotate only after successful restore verification',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'archive-test-'));
 try{
  const first=await storeVerifiedBackup(directory,sql,{keep:2,now:new Date('2026-01-01')});
  await storeVerifiedBackup(directory,sql+'INSERT INTO public_questions VALUES (\'q\',NULL,\'{"answer":"new"}\');',{keep:2,now:new Date('2026-01-02')});
  assert.equal(await readFile(join(first.directory,'database.sql'),'utf8'),sql);
  await assert.rejects(storeVerifiedBackup(directory,'INVALID SQL',{keep:2}),/syntax/);
  assert.equal((await readdir(directory)).length,2);
  const third=await storeVerifiedBackup(directory,sql,{keep:2,now:new Date('2026-01-03')});
  assert.equal(third.retained,2);assert.equal((await readdir(directory)).length,2);
  await assert.rejects(readFile(join(first.directory,'database.sql')),/ENOENT/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
