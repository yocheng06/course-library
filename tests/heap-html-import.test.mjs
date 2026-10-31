import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {COURSE_UNITS,normalizeUnit,normalizeBatch} from '../contribution-service/worker/model.js';
import {parseBatchInput,prepareImport} from '../assets/batch-import.mjs';
const raw=await readFile(new URL('fixtures/heap-practice-structure.html',import.meta.url),'utf8');
const source=await readFile(new URL('../contribution-service/frontend/assets/contributions-submit.js',import.meta.url),'utf8');
const context={COURSE_UNITS,normalizeUnit,URL,btoa,globalThis:{courseChoiceAnswers:globalThis.courseChoiceAnswers}};
vm.runInNewContext(source.slice(source.indexOf('function normalizedImagePath('),source.indexOf('async function parseCoursePracticeHtmlPair('))+'\nthis.p={parseCoursePracticeHtml,parseCoursePracticeResultsHtml,combineCoursePracticeHtml};',context);
const compact=v=>v.replace(/\s+/g,' ').trim();
async function parse(){const {document}=parseHTML(raw);return {document,payload:await context.p.parseCoursePracticeHtml(document,raw,'practice.html')};}
function results(payload,changed=false){
  return {answers:[{stem:compact(payload.questions[1].stem).replace('50     40','50 40').replace(changed?'40':'no-change-marker',changed?'41':'no-change-marker'),correctLines:['5','9']},{stem:compact(payload.questions[0].stem).replace('____________','[__1__]'),correctLines:['4','1','10','14','16','9','3','2','8','7']}]};
}
test('paired submission preserves sibling pre diagrams, original code layout and maps answer text to displayed labels',async()=>{
  const {document,payload}=await parse();
  assert.equal(payload.questions.length,2);assert.equal(payload.unit,'L4');
  const diagram=document.querySelectorAll('pre')[1].textContent;
  assert(payload.questions[1].stem.includes(diagram));
  assert.match(payload.questions[0].stem,/\n1 heap-size\[A\]/);
  assert.doesNotMatch(payload.questions.map(q=>q.stem).join(' '),/saved-wrong|驗證欄位|隱藏測試內容|Imported scripts/);
  const combined=context.p.combineCoursePracticeHtml(payload,results(payload));
  assert.equal(combined.__answerImportSummary.matchedQuestionCount,2);
  assert.equal(combined.questions[0].answer,'4,1,10,14,16,9,3,2,8,7');
  assert.equal(combined.questions[1].answer,'A、B');
  assert.equal(normalizeBatch(combined).questions.length,2);
  assert.equal(document.querySelector('input.text-answer').getAttribute('value'),'saved-wrong');
});
test('a changed tree cannot pair using the introductory sentence alone',async()=>{
  const {payload}=await parse();const combined=context.p.combineCoursePracticeHtml(payload,results(payload,true));
  assert.equal(combined.__answerImportSummary.matchedQuestionCount,1);assert.equal(combined.questions[1].answer,'');
});
test('batch HTML uses real blocks, excludes verification fields and keeps tree indices inside their original question',()=>{
  const {document}=parseHTML('<html><body></body></html>');
  const parsed=parseBatchInput(raw,{name:'practice.html',document});
  assert.equal(parsed.questions.length,2);assert.deepEqual(parsed.questions.map(q=>q.number),['13','19']);
  assert.equal(parsed.questions[0].options.length,0);assert.equal(parsed.questions[1].options.length,4);
  assert.match(parsed.questions[0].stem,/\(10\)\[7\]/);assert.match(parsed.questions[1].stem,/50 40/);
  assert.doesNotMatch(parsed.text,/驗證欄位|隱藏測試內容|saved-wrong/);
  assert.equal(prepareImport('',parsed.questions,'replace').questions.length,2);
});
test('GitHub and submission-service copies use identical prompt extraction',async()=>{
  assert.equal(await readFile(new URL('../assets/contributions-submit.js',import.meta.url),'utf8'),source);
});
