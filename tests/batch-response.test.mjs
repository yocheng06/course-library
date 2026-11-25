import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {parseBatchInput,prepareImport} from '../assets/batch-import.mjs';
import {checkResponse} from '../assets/batch-response.mjs';
test('saved responses survive import without entering question text or bank answers',()=>{
 const document=parseHTML('<html><body></body></html>').document;
 const html='<form id="quiz-form"><div class="question-block"><div class="question-text">題目 1. 選擇？</div><label><input type="checkbox" value="D" checked>第一項</label><label><input type="checkbox" value="A">第二項</label></div><div class="question-block"><div class="question-text">題目 2.</div><div class="question-text">計算<input class="text-answer" type="text" value="S[top[S]]">與<input class="text-answer" type="text" value="S[top[S]+1]"></div></div></form>';
 const parsed=parseBatchInput(html,{document,name:'saved.html'});
 const result=prepareImport('',parsed.questions,'replace');
 assert.deepEqual(result.questions[0].savedResponse,{kind:'choice',values:['A']});
 assert.deepEqual(result.questions[1].savedResponse.values,['S[top[S]]','S[top[S]+1]']);
 assert.doesNotMatch(result.text,/S\[top/);
 assert.equal(result.questions[0].stem,'選擇?');
 const appended=prepareImport(result.text,[{...parsed.questions[0],number:'3'}],'append',{imageQuestions:result.questions});
 assert.deepEqual(appended.questions[1].savedResponse,result.questions[1].savedResponse);
 assert.equal(checkResponse({status:'matched',choiceKey:'A'},result.questions[0].savedResponse).status,'same');
 assert.equal(checkResponse({status:'matched',answer:'S[top[S]]/S[top[S]+1]'},result.questions[1].savedResponse).status,'same');
});
test('unknown banks, empty fields and unsafe splitting are not called correct',()=>{
 assert.equal(checkResponse({status:'unmatched'},{kind:'fill',values:['x']}).status,'unknown');
 assert.equal(checkResponse({status:'matched',answer:'a/b'},{kind:'fill',values:['a','']}).status,'unanswered');
 assert.equal(checkResponse({status:'matched',answer:'a/b/c'},{kind:'fill',values:['a','b']}).status,'unknown');
 assert.equal(checkResponse({status:'matched',answer:'A'},{kind:'fill',values:['a']}).status,'different');
 assert.equal(checkResponse({status:'matched',choiceKey:'AC'},{kind:'choice',values:['A']}).status,'different');
});
