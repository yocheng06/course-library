import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {COURSE_UNITS,normalizeUnit,normalizeBatch} from '../worker/model.js';
const source=await readFile(new URL('../frontend/assets/contributions-submit.js',import.meta.url),'utf8');
const context={COURSE_UNITS,normalizeUnit,URL,btoa,globalThis:{courseChoiceAnswers:globalThis.courseChoiceAnswers}};
vm.runInNewContext(source.slice(source.indexOf('function normalizedImagePath('),source.indexOf('async function parseCoursePracticeHtmlPair('))+'\nthis.p={parseCoursePracticeHtml,parseCoursePracticeResultsHtml,combineCoursePracticeHtml};',context);
const practice=(code,body,realm=6)=>`<html><head><title>匯入測試</title></head><body><form id="practice-quiz-form" action="https://example.invalid/course/${code}/process_practice.php?realm_id=${realm}">${body}</form></body></html>`;
const block='<div class="question-block"><div class="question-text">測試<input type="text" class="text-answer"></div></div>';
for(const [code,course,unit] of [['Alg26','algorithms','L6'],['alg26B','algorithms','L6'],['OS26B','os','scheduling']])test(`practice course ${code} maps to ${course}/${unit}`,async()=>{
 const html=practice(code,block);const value=await context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'test.html');assert.equal(value.course,course);assert.equal(value.unit,unit);
});
test('unknown courses are rejected without guessing the selected subject',async()=>{
 const html=practice('Physics26',block);await assert.rejects(context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'test.html'),/無法辨識課程/);
});
test('code blocks and following text disambiguate identical introductory sentences; fill arrays retain comma and slash groups',async()=>{
 const make=(n)=>`<div class="question-block"><div class="question-text">演算法測試。<pre>SORT(A)\n1 count A</pre>A=${n} B=<input type="text" class="text-answer"> C=<input type="text" class="text-answer"></div></div>`;
 const html=practice('Alg26',make(1)+make(2));const value=await context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'test.html');
 // Browser paragraph repair places pre and following text outside the first paragraph.
 const result=n=>`<div class="question-result"><p><strong>題目：</strong>演算法測試。</p><pre>SORT(A)\n1 count A</pre>A=${n} B=[__1__] C=[__2__]<p></p><p>你的答案：wrong</p><p>正確答案：<br>${n}<br>0/${n}<br>1</p><p>得分：1</p></div>`;
 const answers=context.p.parseCoursePracticeResultsHtml(parseHTML(result(2)+result(1)).document);
 const paired=context.p.combineCoursePracticeHtml(value,answers);
 assert.equal(paired.__answerImportSummary.matchedQuestionCount,2);
 assert.equal(paired.questions[0].answer,'1,0/1,1');assert.equal(paired.questions[1].answer,'2,0/2,1');
 assert.equal(normalizeBatch(paired).questions.length,2);assert.doesNotMatch(paired.questions[0].stem,/wrong|得分/);
 const changed={answers:[{stem:'演算法測試。',correctLines:['unverified']}]};
 const unmatched=context.p.combineCoursePracticeHtml(await context.p.parseCoursePracticeHtml(parseHTML(html).document,html,'test.html'),changed);
 assert.equal(unmatched.__answerImportSummary.matchedQuestionCount,0);
});
