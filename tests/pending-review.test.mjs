import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {toLibraryQuestion,buildIndex,matchQuestions} from '../assets/batch-model.mjs';

const question={number:'1',stem:'Which sample item is correct?',options:[{label:'A',text:'Alpha'},{label:'B',text:'Beta'}],issues:[]};
const raw={id:'original',stem:question.stem,options:['Alpha','Beta'],answer:'A',answerProvided:true,type:'單選題'};
const pending={...raw,id:'pending',submissionReview:{status:'pending',reason:'答案不同'}};
const match=(...entries)=>matchQuestions([question],buildIndex(entries.map(q=>toLibraryQuestion('os','basics',q,true))),{course:'os',unit:'basics'})[0];

test('pending versions are searchable, retain labels on consensus and expose conflicting candidate answers',()=>{
  const same=match(raw,pending);assert.equal(same.status,'matched');assert.equal(same.answer,'A. Alpha');assert.equal(same.pendingReview,true);
  const conflicting=match(raw,{...pending,answer:'B'});
  assert.equal(conflicting.status,'review');assert.equal(conflicting.answer,'');assert.deepEqual(new Set(conflicting.references.map(ref=>ref.candidateAnswer)),new Set(['Alpha','Beta']));
  assert.equal(match(raw,{...pending,options:['Alpha','Gamma']}).status,'review');
  assert.equal(match(raw,{...pending,answer:'B',submissionReview:{status:'resolved'}}).status,'review');
  assert.equal(match(raw).status,'matched');
});

test('pending labels remain visible in course cards and pending answers never auto-grade as correct',async()=>{
  const context=vm.createContext({window:{},console});
  vm.runInContext(await readFile(new URL('../assets/choice-answers.js',import.meta.url),'utf8'),context);
  context.window.courseChoiceAnswers=context.courseChoiceAnswers||context.window.courseChoiceAnswers;
  vm.runInContext(await readFile(new URL('../assets/question-tools.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../assets/practice-feedback.js',import.meta.url),'utf8'),context);
  const tools=context.window.courseQuestionTools;
  assert.equal(tools.hasProvidedAnswer(pending),false);assert.match(tools.answerLabel(pending),/待核對/);assert.match(tools.qualityMarkup(pending,'os'),/待核對/);
  const feedback=context.window.coursePractice.evaluate('A',raw.options,[0],pending);
  assert.equal(feedback.correct,null);
  assert.equal(tools.hasProvidedAnswer(raw),true);
});
