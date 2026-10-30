import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../frontend/assets/contributions-submit.js', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('function practiceStemKey('), source.indexOf('async function parseCoursePracticeHtmlPair(')) + ';this.combine=combineCoursePracticeHtml;', context);
const prompt = '請寫出全部的行程排程順序';
const instruction = '*答案格式範例:P1->P2 格式錯誤不給分';
const question = local => ({stem:'題組條件\n'+local,__practiceAnswerStem:local,type:'填空題',options:[],answer:''});

test('shuffled same-stem answers use blank placement, independent of marker spelling', () => {
  const questions = [question(`${prompt} ${instruction} ____________`), question(`${prompt} ____________ ${instruction}`)];
  const result = context.combine({questions}, {answers:[
    {stem:`${prompt} [__1__] ${instruction}`,correctLines:['P1->P2']},
    {stem:`${prompt} ${instruction} [__1__]`,correctLines:['P2->P1']}
  ]});
  assert.equal(result.__answerImportSummary.matchedQuestionCount,2);
  assert.deepEqual(questions.map(q=>q.answer),['P2->P1','P1->P2']);
});

test('identical layouts with conflicting answers remain unresolved', () => {
  const questions = [question(`${prompt} ____________`), question(`${prompt} ____________`)];
  const result = context.combine({questions}, {answers:[
    {stem:`${prompt} [__1__]`,correctLines:['P1->P2']},
    {stem:`${prompt} [__1__]`,correctLines:['P2->P1']}
  ]});
  assert.equal(result.__answerImportSummary.matchedQuestionCount,0);
});
