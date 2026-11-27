import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import{readFile}from'node:fs/promises';import{parseHTML}from'linkedom';
import{COURSE_UNITS,normalizeUnit,normalizeBatch}from'../assets/contribution-model.js';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const source=await read('../assets/contributions-submit.js'),raw=await read('fixtures/practice-missing-input-14.html'),result=await read('fixtures/practice-missing-input-14-results.html');
const context={COURSE_UNITS,normalizeUnit,URL,btoa,importScopeChosen:false,globalThis:{courseChoiceAnswers:globalThis.courseChoiceAnswers}};
vm.runInNewContext(source.slice(source.indexOf('function normalizedImagePath('),source.indexOf('async function parseCoursePracticeHtmlPair('))+'\nthis.p={parseCoursePracticeHtml,parseCoursePracticeResultsHtml,combineCoursePracticeHtml};',context);
const parse=options=>context.p.parseCoursePracticeHtml(parseHTML(raw).document,raw,'questions.html',[],options);
test('malformed question 14 is reported explicitly and never silently discarded',async()=>{
 await assert.rejects(parse(),error=>{assert.equal(error.code,'practice_questions_without_inputs');assert.equal(error.availableQuestionCount,20);assert.equal(error.practiceImportIssues.length,1);assert.equal(error.practiceImportIssues[0].number,14);assert.match(error.practiceImportIssues[0].stem,/^0+\.$/);return true;});
 await assert.rejects(parse({skipPracticeQuestions:[{fileName:'another-file.html',number:14}]}));
 await assert.rejects(parse({skipPracticeQuestions:[{fileName:'questions.html',number:13}]}));
});
test('explicit skip keeps the other twenty questions and pairs answers by content even with the extra result',async()=>{
 const imported=await parse({skipPracticeQuestions:[{fileName:'questions.html',number:14}]});
 const paired=context.p.combineCoursePracticeHtml(imported,context.p.parseCoursePracticeResultsHtml(parseHTML(result).document));
 assert.equal(paired.questions.length,20);assert.equal(paired.__answerImportSummary.matchedQuestionCount,20);assert.equal(paired.__answerImportSummary.resultCount,21);
 assert.equal(paired.__skippedPracticeQuestions[0].number,14);assert(paired.questions.every(q=>q.answer.trim()));
 assert(!paired.questions.some(q=>/^0+\.$/.test(q.stem)||q.answer==='1111111'));
 assert.match(paired.questions[12].stem,/LCS_LENGTH/);assert.equal(paired.questions[12].answer,'B、C、D');
 assert.match(paired.questions[13].stem,/MATRIX_CHAIN_ORDER/);assert.equal(paired.questions[13].answer,'A、B、C、D');
 assert.equal(paired.questions.at(-1).answer,'A、B、C、D');
 assert.equal(normalizeBatch(paired).questions.length,20);
 const reversed=context.p.parseCoursePracticeResultsHtml(parseHTML(result).document);reversed.answers.reverse();
 const again=context.p.combineCoursePracticeHtml(await parse({skipPracticeQuestions:[{fileName:'questions.html',number:14}]}),reversed);
 assert.deepEqual(JSON.parse(JSON.stringify(again.questions)),JSON.parse(JSON.stringify(paired.questions)));
});
