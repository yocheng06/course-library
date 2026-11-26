import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const manifest=JSON.parse(await readFile(new URL('../content/reviewed-explanations-20261126.json',import.meta.url),'utf8'));
test('reviewed explanations apply by exact content, preserve questions and answers and remove authority wording',async()=>{
 let checked=0;
 for(const course of ['os','algorithms']){
  const {window,config}=await loadCourse(course);
  for(const entry of config.examEntries(true)){
   let q=window.courseTopicOrder.view(entry.q,course,entry.unitId);q=window.courseExplanationContent.apply(q);
   if(window.courseCountingSort)q=window.courseCountingSort.apply(q);
   assert.doesNotMatch(q.explanation??q.ex??'',/老師答案|依老師|老師指定|老師題庫|老師列為/);
   const reviewed=manifest.questions.find(r=>r.course===course&&r.id===entry.id);if(!reviewed)continue;
   assert.equal(q.explanation??q.ex,reviewed.explanation,entry.id);
   const identity=JSON.parse(reviewed.identity);assert.equal(q.stem??q.q,identity[1]);assert.deepEqual(JSON.parse(JSON.stringify(q.options??q.opts)),identity[2]);assert.equal(q.answer??q.a,identity[3]);
   const changed={...q,ex:'其他人後來寫的解析',explanation:'其他人後來寫的解析'};
   assert.equal(window.courseExplanationContent.apply(changed).explanation,'其他人後來寫的解析');checked++;
  }
 }
 assert.equal(checked,21);
});
