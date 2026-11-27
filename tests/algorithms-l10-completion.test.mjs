import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {supplements,prepareCompletion} from '../scripts/complete-algorithms-l10-20261127.mjs';
import {assemblyLine,longestCommonSubsequence} from '../scripts/lib/dynamic-programming-worked.mjs';
import {loadCourse,orderingIssues} from '../scripts/audit-topic-order-20261102.mjs';
const records=JSON.parse(await readFile(new URL('../content/algorithms-l10-completion-20261127.json',import.meta.url),'utf8'));
const protectedFields=q=>Object.fromEntries(Object.entries(q).filter(([k])=>!['category','explanation','ex'].includes(k)));
test('six new explanations cover all selected contents while preserving every original answer and field',()=>{
 assert.equal(records.questions.length,6);
 for(const row of records.questions){const record=supplements[row.id];assert(record);assert.deepEqual(protectedFields(row.after),protectedFields(row.before));assert.equal(row.after.ex??row.after.explanation,record.explanation);assert(record.explanation.length>300);assert.doesNotMatch(record.explanation,/老師|(?:選項|選|答案為)\s*[A-D](?![A-Za-z])/);for(const option of row.before.opts??row.before.options??[])assert(record.explanation.includes('「'+option+'」'),option);}
});
test('the two assembly calculations independently agree with exhaustive route enumeration; conflicting path remains documented',()=>{
 for(const input of [{entry:[2,4],exit:[3,2],processing:[[7,9,3,4,8,4],[8,5,6,4,5,7]],transfer:[[null,2,3,1,3,4],[null,2,1,2,2,1]]},{entry:[2,3],exit:[3,2],processing:[[4,2,6,3],[2,7,1,5]],transfer:[[null,3,1,4],[null,2,5,2]]}]){
  const n=input.processing[0].length,all=[];for(let bits=0;bits<2**n;bits++){const route=Array.from({length:n},(_,j)=>(bits>>j)&1);let cost=input.entry[route[0]];for(let j=0;j<n;j++){if(j&&route[j]!==route[j-1])cost+=input.transfer[route[j-1]][j];cost+=input.processing[route[j]][j];}all.push({route,cost:cost+input.exit[route[n-1]]});}
  assert.equal(assemblyLine(input).minimum,Math.min(...all.map(r=>r.cost)));
  if(n===4){assert.equal(all.find(r=>r.route.join('')==='0011').cost,17);assert.equal(all.find(r=>r.route.join('')==='1011').cost,18);}
 }
 assert.match(supplements['community-21c6ff20-a210-4f58-b3e9-ec6229f8575a-1'].explanation,/=18/);
 const lcs=longestCommonSubsequence('ABAZDC','BACZDBA');assert.deepEqual([[3,4],[4,6],[6,3]].flatMap(([i,j])=>[lcs.table[i][j],lcs.arrows[i][j]]),[2,'L',3,'L',3,'LU']);
});
test('guarded completion updates cannot overwrite changed rows and are idempotent',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE public_questions(id TEXT PRIMARY KEY,course TEXT,unit TEXT,data TEXT,revision INTEGER,is_published INTEGER,updated_at INTEGER);CREATE TABLE question_history(id TEXT PRIMARY KEY,question_id TEXT,revision INTEGER,course TEXT,unit TEXT,data TEXT,is_published INTEGER,action TEXT,actor TEXT,note TEXT,created_at INTEGER);CREATE TABLE unit_settings(course TEXT PRIMARY KEY,revision INTEGER,data TEXT,updated_at INTEGER);CREATE TABLE unit_settings_history(id TEXT PRIMARY KEY,course TEXT,revision INTEGER,before_data TEXT,after_data TEXT,actor TEXT,created_at INTEGER)');
  for(const row of records.questions)db.prepare('INSERT INTO public_questions VALUES (?,\'algorithms\',\'L10\',?,?,1,0)').run(row.id,JSON.stringify(row.before),row.revision);
  db.prepare('INSERT INTO unit_settings VALUES (\'algorithms\',7,?,0)').run(JSON.stringify([{id:'L9',title:'雜湊',en:'Hash',order:8},{id:'L10',title:'排程',en:'Scheduling',order:9}]));
  const rows=db.prepare('SELECT * FROM public_questions').all(),settings=db.prepare('SELECT * FROM unit_settings').get(),plan=prepareCompletion(rows,settings,{now:1});
  db.exec(plan.sql);assert.equal(db.prepare('SELECT count(*) n FROM question_history').get().n,6);assert.equal(db.prepare('SELECT count(*) n FROM unit_settings_history').get().n,1);
  const units=JSON.parse(db.prepare('SELECT data FROM unit_settings').get().data);assert.deepEqual(units[0],{id:'L9',title:'雜湊',en:'Hash',order:8});assert.equal(units[1].title,'動態規劃');assert.equal(units[1].en,'Dynamic Programming');
  const changes=db.prepare('SELECT total_changes() n').get().n;db.exec(plan.sql);assert.equal(db.prepare('SELECT total_changes() n').get().n,changes);
  assert.equal(prepareCompletion(db.prepare('SELECT * FROM public_questions').all(),db.prepare('SELECT * FROM unit_settings').get()).updates.length,0);
 }finally{db.close();}
});
test('all sixty L10 questions show explanations in study and practice, grouped by topic then question type',async()=>{
 const h=await loadCourse('algorithms'),entries=h.config.examEntries(['L10']);assert.equal(entries.length,60);assert.deepEqual(orderingIssues(entries,h.window.courseTopicOrder,'algorithms'),[]);
 const labels=[];for(const entry of entries){const text=h.window.courseQuestionTools.explanationText(entry.q);assert(text.length>100,entry.id);const practice=h.window.courseQuestionTools.createOptionSession(()=>0.17).get(entry.q,entry.id);assert.equal(practice.ex??practice.explanation,text);const topic=h.window.courseTopicOrder.topic(entry.q,'algorithms','L10').label;if(labels.at(-1)!==topic)labels.push(topic);}
 assert.deepEqual(labels,['動態規劃基礎','裝配線排程','矩陣鏈乘法','最長共同子序列','0/1 背包問題']);assert(h.config.examUnits().some(u=>u.id==='L10'&&u.label.includes('動態規劃')));assert.match(h.document.querySelector('.sidebar').textContent,/Dynamic Programming/);
});
