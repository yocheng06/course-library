import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseOSCourseHTML} from '../scripts/course-data.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const window={};const context=vm.createContext({window});
for(const file of ['choice-answers','question-tools'])vm.runInContext(read('assets/'+file+'.js'),context);
const questions=parseOSCourseHTML(read('os.html')).flatMap(u=>u.questions);
test('letters in Xerox PARC, language C and GRUB do not become extra selected options',()=>{
 for(const id of ['architecture-14','architecture-97','architecture-104']){
  const q=questions.find(q=>q.id===id);
  assert.equal(window.courseQuestionTools.answerType(q),'單選題',id);
 }
});
test('all legacy choice types agree with parsed answer indices, without changing their source',()=>{
 const before=JSON.stringify(questions);
 for(const q of questions.filter(q=>!q.type&&q.options?.length)){
  const key=window.courseChoiceAnswers.expectedChoiceKey(q.answer,q.options);
  assert.ok(key,q.id);
  assert.equal(window.courseQuestionTools.answerType(q),key.length>1?'多選題':'單選題',q.id);
 }
 assert.equal(JSON.stringify(questions),before);
 assert.equal(window.courseQuestionTools.answerType({type:'多選題',answer:'A',options:['A. only','B. other']}),'多選題');
});
