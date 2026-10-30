import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {parseBatchInput,prepareImport} from '../assets/batch-import.mjs';import {buildIndex,matchRecordedQuestions,toLibraryQuestion} from '../assets/batch-model.mjs';
const document=parseHTML('<html><body></body></html>').document;
const stem='分組排序後，M 為中間值。請問保證下界為何？ ____________\nA ... B C D ... E\nF ... G H I ... J\nK ... L_M_N ... O';
const html='<html><body><form><div class="question-block"><p class="question-text">Beast 2. 分組排序後，M 為中間值。請問保證下界為何？ <input class="text-answer" value="untrusted"></p><pre>A ... B C D ... E\nF ... G H I ... J\nK ... L_M_N ... O</pre></div></form></body></html>';
const index=buildIndex([toLibraryQuestion('algorithms','L7',{id:'test-diagram',stem,options:[],answer:'3n/10-6'},true)]);
test('HTML diagram ellipses survive preview, apply and repeated batch parsing without becoming A/F choices',()=>{
 const imported=parseBatchInput(html,{name:'questions.html',document});assert.equal(imported.questions.length,1);assert.equal(imported.questions[0].options.length,0);
 for(const mode of ['replace','append']){
  let text=prepareImport(mode==='append'?'1. 已有測試填空 ___':'',imported.questions,mode,{document}).text;
  for(let i=0;i<3;i++){
   const parsed=parseBatchInput(text,{document}),q=parsed.questions.find(q=>q.stem.includes('M 為中間值'));
   assert.ok(q);assert.equal(q.options.length,0);assert.equal(q.issues.length,0);assert.match(q.stem,/A \.\.\. B C D \.\.\. E/);assert.match(q.stem,/F \.\.\. G H I \.\.\. J/);assert.doesNotMatch(q.stem,/untrusted/);
   const result=matchRecordedQuestions([q],index,{course:'algorithms'})[0];assert.equal(result.status,'matched');assert.equal(result.answer,'3n/10-6');text=parsed.text;
  }
 }
});
test('spaced option punctuation still parses as genuine choices',()=>{
 for(const punctuation of ['.',')','、',':','：']){
  const result=parseBatchInput('1. 哪個選項符合？\nA '+punctuation+' Alpha\nB '+punctuation+' Beta',{document});assert.equal(result.questions[0].options.length,2);assert.equal(result.questions[0].options[0].text,'Alpha');
 }
});
test('a changed diagram is still rejected by complete matching',()=>{
 const parsed=parseBatchInput('1. '+stem.replace('L_M_N','L_X_N'),{document});const result=matchRecordedQuestions(parsed.questions,index,{course:'algorithms'})[0];assert.equal(result.status,'unmatched');assert.equal(result.answer,'');
});
