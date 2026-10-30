import test from 'node:test';import assert from 'node:assert/strict';
import {toLibraryQuestion,buildIndex,matchRecordedQuestions,matchQuestions} from '../assets/batch-model.mjs';
const base={id:'base',stem:'Which scheduling policy applies?',options:['Alpha','Beta'],answer:'A',answerProvided:true};
const input=(patch={})=>({number:'1',stem:base.stem,options:[{label:'A',text:'Alpha'},{label:'B',text:'Beta'}],issues:[],...patch});
const index=(records)=>buildIndex(records.map(q=>toLibraryQuestion('os',q.unit||'scheduling',q,q.preferred||false)));
const match=(q,records=[base],scope={})=>matchRecordedQuestions([q],index(records),{course:'os',...scope})[0];
test('only complete option sets match; order changes remap the answer and format prefixes remain harmless',()=>{
 assert.equal(match(input()).status,'matched');assert.equal(match(input({stem:'Beast 4. '+base.stem,options:[{label:'A',text:'Beta'},{label:'B',text:'Alpha'}]})).answer,'B. Alpha');
 const missing=match(input({options:[{label:'A',text:'Alpha'}]}));assert.equal(missing.status,'unmatched');assert.equal(missing.answer,'');assert.equal(missing.references[0].id,'base');
 assert.equal(match(input({options:[{label:'A',text:'Alpha'},{label:'B',text:'Changed'}]})).status,'unmatched');
});
test('conflicting preferred versions and conditions cannot supply an automatic answer',()=>{
 for(const extra of [{...base,id:'second',answer:'B'},{...base,id:'second',answerConditions:['Only for a special input']}]){
  const row=match(input(),[{...base,preferred:true},extra]);assert.equal(row.status,'unmatched');assert.equal(row.answer,'');assert.deepEqual(row.conditions,[]);
 }
 const pending={...base,id:'pending',answer:'B',submissionReview:{status:'pending'}};const row=match(input(),[base,pending]);assert.equal(row.status,'unmatched');assert.equal(row.references.length,2);assert.ok(row.references.every(r=>r.candidateAnswer));
 assert.equal(match(input(),[base,{...pending,answer:'A'}]).status,'matched');
});
test('complete lookup rejects answer bridges, missing blanks, filled answers and additional conditions',()=>{
 const fill={id:'fill',stem:'The policy is ____________. (Please answer in English lowercase)',options:[],answer:'alpha'};
 for(const stem of ['The policy is. (Please answer in English lowercase)','The policy is alpha.'])assert.equal(match(input({stem,options:[]}),[fill]).status,'unmatched');
 const bridge={...base,options:[],answer:'Alpha'};assert.equal(match(input(),[bridge]).status,'unmatched');
 assert.equal(match(input({stem:base.stem+' Assume a single processor.'})).status,'unmatched');
 assert.equal(matchQuestions([input()],index([bridge]),{course:'os'})[0].status,'matched');
});
test('equivalent blank markers match, slash-separated array answers count by blank, and different blank counts do not match',()=>{
 const fill={id:'arrays',stem:'B=[__1__]; C=[__2__]',options:[],answer:'0,1,2/3,4,5'};
 const row=match(input({stem:'妖獸 3. B=____________; C=____________',options:[]}),[fill]);assert.equal(row.status,'matched');assert.equal(row.answer,fill.answer);
 assert.equal(match(input({stem:'B=____________; C=',options:[]}),[fill]).status,'unmatched');
 assert.equal(match(input({stem:'B=____________; C=____________',options:[]}),[{...fill,answer:'1/2/3'}]).status,'unmatched');
});
test('image-dependent, malformed and unknown questions stay unanswered; full matches in other units retain their source',()=>{
 assert.equal(match(input(),[{...base,missingContext:true}]).status,'unmatched');assert.equal(match(input({issues:['missing figure']})).status,'unmatched');assert.equal(match(input({stem:'Unknown'}),[]).status,'unmatched');
 const row=match(input(),[base],{unit:'basics'});assert.equal(row.status,'matched');assert.equal(row.outsideScope,true);
});
