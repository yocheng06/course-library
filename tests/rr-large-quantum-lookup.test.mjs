import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseBatchInput} from '../assets/batch-import.mjs';
import {buildIndex,matchRecordedQuestions,toLibraryQuestion,applyBuiltinOverrides} from '../assets/batch-model.mjs';
const raw=await readFile(new URL('fixtures/rr-large-quantum-result-20261101.txt',import.meta.url),'utf8');
const bank=JSON.parse(await readFile(new URL('../assets/batch-library.json',import.meta.url),'utf8'));
const question=raw.split('\n\n')[0].replace(/^題目：/,'');
const lookup=(text,entries=bank.entries,unit='scheduling')=>matchRecordedQuestions(parseBatchInput(text).questions,buildIndex(entries),{course:'os',unit})[0];
test('reported complete result transcript ignores supplied answers and score, returning the recorded FCFS answer',()=>{
  const row=lookup(raw.replaceAll('first-come first-served','wrong supplied answer'));
  assert.equal(row.status,'matched');assert.equal(row.answer,'first-come first-served');assert.equal(row.question.stem,question);
  assert.doesNotMatch(row.question.stem,/wrong supplied answer|得分|你的答案/);assert(row.conditions.some(c=>c.includes('CPU burst')));
  assert.deepEqual(row.references.map(r=>r.id).sort(),['os6-038','os6-125']);
});
test('indexed or underline blank, both languages and other-unit lookup keep the same answer and qualification',()=>{
  for(const text of [question,question.replace('[__1__]','____________'),'當時間片（q）相對於上下文切換時間非常大時，迴圈排程（RR）演算法的行為會趨近於 ____________。（請用小寫英文回答 關聯字母間用-連接 非關聯字母間用 空白）']){
    const row=lookup(text);assert.equal(row.status,'matched',row.reason);assert.equal(row.answer,'first-come first-served');assert(row.conditions.some(c=>c.includes('CPU burst')));
  }
  const elsewhere=lookup(question,bank.entries,'treasure');assert.equal(elsewhere.status,'matched');assert(elsewhere.outsideScope);assert(elsewhere.conditions.length);
});
test('the newly recognized mixed hyphen and space hint still enforces actual answer case and characters',()=>{
  const stem=question.slice(0,question.indexOf('(Please')).replace(/\.$/,'');
  const entry=answer=>toLibraryQuestion('os','scheduling',{id:'format-test',type:'填空題',stem,options:[],answer},true);
  assert.equal(lookup(question,[entry('first-come first-served')]).status,'matched');
  for(const answer of ['First-Come First-Served','first_come first_served','先到先服務','first-come  first-served','fcfs1'])assert.equal(lookup(question,[entry(answer)]).status,'unmatched',answer);
  assert.equal(lookup(question+' Assume all processes arrive at time zero.',[entry('first-come first-served')]).status,'unmatched');
});
test('unverified conflicting or missing qualifications remain blocked instead of being globally ignored',()=>{
  const entry=toLibraryQuestion('os','scheduling',{id:'a',type:'填空題',stem:question,options:[],answer:'first-come first-served'},true);
  for(const conditions of [[],['另一組不同條件']])assert.equal(lookup(question,[{...entry,conditions:['q covers each burst']},{...entry,id:'b',conditions}]).status,'unmatched');
});
test('an otherwise unchanged public fill edit retains omitted qualifications, without mutating the edit',async()=>{
  const edit=JSON.parse(await readFile(new URL('fixtures/rr-large-quantum-edit-20261101.json',import.meta.url),'utf8')),before=JSON.stringify(edit);
  const updated=applyBuiltinOverrides(bank.entries,'os',[edit]);
  const row=lookup(raw,updated);assert.equal(row.status,'matched');assert.equal(row.answer,'first-come first-served');assert(row.conditions.some(c=>c.includes('CPU burst')));assert.equal(JSON.stringify(edit),before);
});
test('changed or explicitly cleared public fill data cannot inherit an unrelated qualification',()=>{
  const original={id:'source',type:'填空題',stem:'填入 ____ 。',options:[],answer:'alpha'};
  const base=toLibraryQuestion('os','scheduling',{...original,answerConditions:['原本條件']},true);
  for(const question of [{...original,stem:'改變的題目 ____ 。'},{...original,answer:'beta'},{...original,answerConditions:[]}]){
    const updated=applyBuiltinOverrides([base],'os',[{unit:'scheduling',question}]);assert(updated.every(e=>!e.conditions?.length));
  }
  const ambiguous=applyBuiltinOverrides([base,{...base,conditions:['另一個條件']}],'os',[{unit:'scheduling',question:original}]);assert(ambiguous.every(e=>!e.conditions?.length));
});
