import test from 'node:test';import assert from 'node:assert/strict';
import {toLibraryQuestion,buildIndex,matchRecordedQuestions} from '../assets/batch-model.mjs';
const stem='Which sample value is largest?',input={number:'1',stem,options:[{label:'A',text:'One'},{label:'B',text:'Two'},{label:'C',text:'Three'},{label:'D',text:'Four'}],issues:[]};
const raw={id:'matching',stem,options:['One','Two','Three','Four'],answer:'D',answerProvided:true};
const match=(records,q=input)=>matchRecordedQuestions([q],buildIndex(records.map(r=>toLibraryQuestion('os','basics',r,true))),{course:'os'})[0];
const pending=q=>({...q,submissionReview:{status:'pending'}});
test('an exact pending version is usable even when another stored version changes a distractor',()=>{
 const other={...raw,id:'other-version',options:['One','Two','Three','Five'],answer:'A'};
 const result=match([other,pending(raw)]);assert.equal(result.status,'matched');assert.equal(result.answer,'D. Four');assert.deepEqual(result.references.map(r=>r.id),['matching']);assert.doesNotMatch(result.reason,/填空數/);
});
test('identical complete versions agree after option reorder while unrelated pending distractors are excluded',()=>{
 const reordered={...raw,id:'reordered',options:['Four','One','Two','Three'],answer:'A'};
 const unrelated=pending({...raw,id:'different',options:['One','Two','Three','Five'],answer:'A'});
 const result=match([raw,reordered,unrelated]);assert.equal(result.status,'matched');assert.equal(result.answer,'D. Four');assert.deepEqual(new Set(result.references.map(r=>r.id)),new Set(['matching','reordered']));
});
test('real answer and condition conflicts within the same complete version still cannot supply an answer',()=>{
 for(const other of [pending({...raw,id:'wrong-answer',answer:'A'}),pending({...raw,id:'other-condition',answerConditions:['Only when a condition holds']})]){
  const result=match([raw,other]);assert.equal(result.status,'unmatched');assert.equal(result.answer,'');assert.ok(result.references.length>0);
 }
});
test('different formats do not veto a full fill version and lack of any complete choice set remains unrecorded',()=>{
 const fill=pending({id:'fill',stem:'The value is ____________.',options:[],answer:'four',answerProvided:true});
 const choice={...raw,stem:fill.stem};const q={number:'1',stem:fill.stem,options:[],issues:[]};
 assert.equal(match([fill,choice],q).status,'matched');
 assert.equal(match([pending({...raw,options:['One','Two','Three','Five']})]).status,'unmatched');
});
