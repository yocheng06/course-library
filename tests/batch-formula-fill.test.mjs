import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {buildIndex,parseQuestions,matchRecordedQuestions,toLibraryQuestion} from '../assets/batch-model.mjs';
import {parseBatchInput} from '../assets/batch-import.mjs';
const scope={course:'algorithms',unit:'L7'};
test('the reported Median of Medians HTML question matches L7-2508 with both formula slots intact',async()=>{
  const bank=JSON.parse(await readFile(new URL('../assets/batch-library.json',import.meta.url),'utf8'));
  const entry=bank.entries.find(e=>e.id==='L7-2508');
  assert.equal(entry.answer,'T(7n/10+6)/O(n)');
  const stem='根據課本的例子,考慮以下的 Median of Medians  的遞迴關係式\nT(n) = O(1), if  n < 140\nT(n) = T(⌈n/5⌉) +  ____________  +  ____________  , if  n >= 140';
  const {document}=parseHTML('<html><body></body></html>');
  const html='<script id="question-data" type="application/json">'+JSON.stringify([{stem,options:[]}])+'</script>';
  const before=JSON.stringify(entry);
  const parsed=parseBatchInput(html,{name:'exam.html',document});
  const [row]=matchRecordedQuestions(parsed.questions,buildIndex(bank.entries),scope);
  assert.equal(row.status,'matched');assert.equal(row.answer,entry.answer);assert(row.references.some(r=>r.id===entry.id));
  assert.equal(JSON.stringify(entry),before);
});
const question='1. 兩個式子分別為 [__1__] 與 ____________ 。';
function lookup(answer){
  const entry=toLibraryQuestion('algorithms','L7',{id:'formula-fill',stem:'兩個式子分別為 ____ 與 ____ 。',options:[],answer},true);
  return matchRecordedQuestions(parseQuestions(question),buildIndex([entry]),scope)[0];
}
test('only top-level answer delimiters split slots; nested division and commas remain mathematical content',()=>{
  for(const answer of ['T(7n/10+6)/O(n)','max(a/b,c)/g({x/y,z})','T(n/5),O(n)','(a,b)/(c,d)','[2,5,3]/[0,2,3]','policy/mechanism','high availability/parallel processing','max(a/b,c)\r\n\r\nO(n)','T{n/5}/O(n)']){
    const row=lookup(answer);assert.equal(row.status,'matched',answer);assert.equal(row.answer,answer);
  }
});
test('nested separators, malformed formula groups and extra or empty slots cannot fabricate two answers',()=>{
  for(const answer of ['T(7n/10+6)','f(a,b)','T(n/5/O(n)','T(n/5]+O(n)','T(n)/O(n)/Theta(n)','T(n)//O(n)']){
    const row=lookup(answer);assert.equal(row.status,'unmatched',answer);assert.equal(row.answer,'');
  }
});
