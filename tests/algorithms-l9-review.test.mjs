import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {hashInput,simulateHash,hashCalculation} from '../scripts/lib/hash-table-worked.mjs';
import {prepareReview,reviewQuestion} from '../scripts/review-algorithms-l9-20261127.mjs';
import {loadCourse,orderingIssues} from '../scripts/audit-topic-order-20261102.mjs';
const records=JSON.parse(await readFile(new URL('../content/algorithms-l9-review-20261127.json',import.meta.url),'utf8'));
const protectedFields=q=>Object.fromEntries(Object.entries(q).filter(([k])=>!['category','explanation','ex'].includes(k)));
test('sixty reviewed explanations preserve all original content and discuss every choice by its text',()=>{
 assert.equal(records.questions.length,60);assert.equal(records.questions.filter(r=>!(r.before.ex??r.before.explanation??'').trim()).length,7);
 for(const r of records.questions){
  assert.deepEqual(protectedFields(r.before),protectedFields(r.after));assert.deepEqual(reviewQuestion(r.before).after,r.after);
  const ex=r.after.ex??r.after.explanation;assert(ex.length>=150,r.id);assert.doesNotMatch(ex,/老師|(?:選項|選|答案為)\s*[A-D](?![A-Za-z])/);
  for(const text of r.before.opts??r.before.options??[])assert(ex.includes('「'+text+'」'),r.id+' '+text);
 }
});
test('nineteen numeric answers match an independent probe oracle, including underscored coefficients',()=>{
 let count=0;
 for(const {before:q} of records.questions.filter(r=>/將鍵值/.test(r.before.q))){
  count++;const input=hashInput(q.q),table=Array(input.size).fill(null),failed=[];
  for(const key of input.keys){let done=false;for(let attempt=0;attempt<input.size;attempt++){
   let slot;if(input.method==='linear')slot=(key+attempt)%input.size;
   else if(input.method==='quadratic')slot=(key+input.c1*attempt+input.c2*attempt**2)%input.size;
   else slot=(key+attempt*(input.stepBase+key%(input.size-1)))%input.size;
   if(table[slot]===null){table[slot]=key;done=true;break;}
  }if(!done)failed.push(key);}
  assert.deepEqual(simulateHash(input).table,table);assert.deepEqual(simulateHash(input).failed,failed);
  assert.equal(hashCalculation(q).difference,false,q.bookmarkId);
 }
 assert.equal(count,19);
 const q=records.questions.find(r=>/c_1/.test(r.before.q));assert(q);assert.equal(hashInput(q.before.q).c1,1);
 const bad=simulateHash({keys:[17,28],size:11,method:'double',stepBase:3});assert.deepEqual(bad.failed,[28]);assert.equal(bad.table.filter(x=>x===null).length,10);
});
test('guarded history cannot overwrite a concurrent edit and repeated execution is harmless',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE public_questions(id TEXT PRIMARY KEY,course TEXT,unit TEXT,data TEXT,revision INTEGER,is_published INTEGER,updated_at INTEGER);CREATE TABLE question_history(id TEXT PRIMARY KEY,question_id TEXT,revision INTEGER,course TEXT,unit TEXT,data TEXT,is_published INTEGER,action TEXT,actor TEXT,note TEXT,created_at INTEGER);CREATE TABLE unit_settings(course TEXT PRIMARY KEY,revision INTEGER,data TEXT,updated_at INTEGER);CREATE TABLE unit_settings_history(id TEXT PRIMARY KEY,course TEXT,revision INTEGER,before_data TEXT,after_data TEXT,actor TEXT,created_at INTEGER)');
  for(const r of records.questions)db.prepare("INSERT INTO public_questions VALUES (?,'algorithms','L9',?,?,1,0)").run(r.id,JSON.stringify(r.before),r.revision);
  const untouched={id:'L10',title:'動態規劃',en:'Dynamic Programming',order:9};
  db.prepare("INSERT INTO unit_settings VALUES ('algorithms',7,?,0)").run(JSON.stringify([{id:'L9',title:'雜湊',en:'Hash',order:8},untouched]));
  const plan=prepareReview(db.prepare('SELECT * FROM public_questions').all(),db.prepare('SELECT * FROM unit_settings').get(),{now:1});
  const id=records.questions[0].id;db.prepare('UPDATE public_questions SET revision=revision+1,data=? WHERE id=?').run('{"concurrent":"preserved"}',id);
  db.exec(plan.sql);assert.equal(db.prepare('SELECT count(*) n FROM question_history').get().n,59);assert.equal(db.prepare('SELECT data FROM public_questions WHERE id=?').get(id).data,'{"concurrent":"preserved"}');
  const units=JSON.parse(db.prepare('SELECT data FROM unit_settings').get().data);assert.deepEqual(units[1],untouched);assert.equal(units[0].en,'Hash Tables');
  const changes=db.prepare('SELECT total_changes() n').get().n;db.exec(plan.sql);assert.equal(db.prepare('SELECT total_changes() n').get().n,changes);
 }finally{db.close();}
});
test('learner snapshot exposes all sixty explanations with nine contiguous topics and single multiple fill order',async()=>{
 const h=await loadCourse('algorithms'),entries=h.config.examEntries(['L9']);assert.equal(entries.length,60);
 assert.deepEqual(orderingIssues(entries,h.window.courseTopicOrder,'algorithms'),[]);
 const topics=[];
 for(const e of entries){
  const ex=h.window.courseQuestionTools.explanationText(e.q);assert(ex.length>=150,e.id);
  const session=h.window.courseQuestionTools.createOptionSession(()=>0.17).get(e.q,e.id);assert.equal(session.ex??session.explanation,ex);
  const topic=h.window.courseTopicOrder.topic(e.q,'algorithms','L9').label;if(topics.at(-1)!==topic)topics.push(topic);
 }
 assert.equal(topics.length,9);assert.equal(new Set(topics).size,9);assert(h.config.examUnits().some(u=>u.id==='L9'&&u.label.includes('雜湊表')));
 assert.match(h.document.querySelector('.sidebar').textContent,/Hash Tables/);
});
