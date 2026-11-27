import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex,matchRecordedQuestions,toLibraryQuestion} from '../assets/batch-model.mjs';
const stem=`矩陣相乘 的動態規劃計算 選出正確的項目
A is a 3x2 Matrix, B is a 2x2 Matrix, C is a 2x3 Matrix, D is a 3x4 Matrix,
m 矩陣
|(1)|(2)|(3)|
|(6)|(7)|
|(10)|
s 矩陣
|(a)|(b)|(c)|
|(e)|(f)|
|(h)|
請回答 (1) ____________ (2) ____________ (10) ____________ (請用數字回答)`;
const lookup=(source,answer,query=source)=>{
 const entry=toLibraryQuestion('algorithms','L10',{id:'numeric-slots',type:'填空題',stem:source,options:[],answer},true);
 return matchRecordedQuestions([{stem:query,options:[],issues:[]}],buildIndex([entry]),{course:'algorithms',unit:'L10'})[0];
};
test('three numbered matrix blanks accept all three numeric answers without changing their order or source format',()=>{
 for(const answer of ['60/36/12','60 / 36 / 12','60,36,12','60\n36\n12','-60/36.5/.12']){
  const row=lookup(stem,answer,stem.replace(/\s+/g,' '));
  assert.equal(row.status,'matched',answer+': '+row.reason);assert.equal(row.answer,answer);
 }
});
test('numeric slot validation rejects missing, extra, nonnumeric or ambiguous values',()=>{
 for(const answer of ['60/36','60/36/12/3','60//36/12','60/word/12','60/三十六/12','60/(36/2)/12','60/36/'])assert.equal(lookup(stem,answer).status,'unmatched',answer);
 assert.equal(lookup(stem,'60/36/12',stem.replace('3x2','4x2')).status,'unmatched');
});
test('a single numeric blank does not treat a fraction or multiple values as one number',()=>{
 const single='計算結果為 ____________ (請用數字回答)';
 for(const answer of ['12','-1.5','.25'])assert.equal(lookup(single,answer).status,'matched',answer);
 for(const answer of ['60/36/12','1/2','12,13','1 2'])assert.equal(lookup(single,answer).status,'unmatched',answer);
});
