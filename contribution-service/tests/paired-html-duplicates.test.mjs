import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import '../worker/model.js';
const source=await readFile(new URL('../frontend/assets/contributions-submit.js',import.meta.url),'utf8');const context={globalThis:{courseChoiceAnswers:globalThis.courseChoiceAnswers}};
vm.runInNewContext(source.slice(source.indexOf('function staticHtmlText('),source.indexOf('async function parseCoursePracticeHtmlPair('))+'\nthis.combine=combineCoursePracticeHtml;',context);
const question=options=>({stem:'Which example items belong?',type:'多選題',options,answer:''});const result=correctLines=>({stem:'Which example items belong?',correctLines});
const pair=(questions,answers)=>context.combine({questions},{answers});
test('same-stem choice versions pair by answer content even when result order differs',()=>{
 const questions=[question(['Alpha','Beta','Gamma','Delta']),question(['Alpha','Epsilon','Gamma','Zeta'])];const paired=pair(questions,[result(['Zeta','Alpha']),result(['Gamma','Beta'])]);
 assert.equal(paired.__answerImportSummary.matchedQuestionCount,2);assert.equal(questions[0].answer,'B、C');assert.equal(questions[1].answer,'A、D');
});
test('bare answer letters never guess between same-stem option versions',()=>{
 const q=[question(['Alpha','Beta']),question(['Gamma','Delta'])];const paired=pair(q,[result(['A']),result(['B'])]);assert.equal(paired.__answerImportSummary.matchedQuestionCount,0);assert.ok(q.every(q=>q.answer===''));
});
test('conflicting compatible results leave the question unanswered regardless of result order',()=>{
 for(const answers of [[result(['Alpha']),result(['Beta'])],[result(['Beta']),result(['Alpha'])]]){
  const q=[question(['Alpha','Beta'])];assert.equal(pair(q,answers).__answerImportSummary.matchedQuestionCount,0);assert.equal(q[0].answer,'');
 }
});
test('indistinguishable duplicate stems are not paired by ordinal position',()=>{
 const q=[question(['Alpha','Beta']),question(['Alpha','Beta'])];assert.equal(pair(q,[result(['Alpha']),result(['Beta'])]).__answerImportSummary.matchedQuestionCount,0);
});
test('a unique question retains letter support, rejects nonexistent options and repeated identical results are consistent',()=>{
 const unique=[question(['Alpha','Beta'])];assert.equal(pair(unique,[result(['B'])]).__answerImportSummary.matchedQuestionCount,1);assert.equal(unique[0].answer,'B');
 const repeated=[question(['Alpha','Beta'])];assert.equal(pair(repeated,[result(['Alpha']),result(['Alpha'])]).__answerImportSummary.matchedQuestionCount,1);
 assert.equal(pair([question(['Alpha','Beta'])],[result(['Missing'])]).__answerImportSummary.matchedQuestionCount,0);
});
