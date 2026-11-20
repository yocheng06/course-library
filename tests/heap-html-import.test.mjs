import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {COURSE_UNITS,normalizeUnit,normalizeBatch} from '../contribution-service/worker/model.js';
import {parseBatchInput,prepareImport} from '../assets/batch-import.mjs';
const raw=await readFile(new URL('fixtures/heap-practice-structure.html',import.meta.url),'utf8');
const source=await readFile(new URL('../contribution-service/frontend/assets/contributions-submit.js',import.meta.url),'utf8');
const context={COURSE_UNITS,normalizeUnit,URL,btoa,importScopeChosen:false,globalThis:{courseChoiceAnswers:globalThis.courseChoiceAnswers}};
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


test('base URL supports missing actions, while an explicit practice action takes precedence',async()=>{
 const body='<div class="question-block"><div class="question-text">合成測試<input type="text" class="text-answer"></div></div>';
 for(const [action,course,unit] of [['','os','L9'],['https://example.test/course/Alg26/process_practice.php?realm_id=4','algorithms','L4']]){
  const html='<html><head><base href="https://example.test/course/OS26B/practice.php?realm_id=9"></head><body><form id="practice-quiz-form"'+(action?' action="'+action+'"':'')+'>'+body+'</form></body></html>';
  const value=await context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'test.html');
  assert.equal(value.course,course);assert.equal(value.unit,unit);
 }
 const html='<html><head><base href="https://example.test/course/Physics26/practice.php?realm_id=9"></head><body><form id="practice-quiz-form">'+body+'</form></body></html>';
 await assert.rejects(context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'test.html'),/無法辨識課程/);
});

test('a form action without a realm can use the base or the saved practice URL for the same course',async()=>{
 const action='https://example.test/course/OS26B/process_practice.php';
 const page=(saved,base='')=>`<!doctype html>
<!-- saved from url=(0073)${saved} -->
<html><head>${base}</head><body><form id="practice-quiz-form" action="${action}">
 <div class="question-block"><div class="question-text">排程測試<input type="text" class="text-answer"></div></div>
</form></body></html>`;
 const parse=html=>context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'practice.html');
 const saved=await parse(page('https://example.test/course/OS26B/practice.php?realm_id=6&difficulty=3'));
 assert.equal(saved.course,'os');
 assert.equal(saved.unit,normalizeUnit('os','6'));
 const base=await parse(page('https://example.test/course/OS26B/practice.php?realm_id=6','<base href="https://example.test/course/OS26B/practice.php?realm_id=9">'));
 assert.equal(base.unit,'L9');
 await assert.rejects(parse(page('https://example.test/course/Alg26/practice.php?realm_id=6')),/無法判斷單元/);
});
