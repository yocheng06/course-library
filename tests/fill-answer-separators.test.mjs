import test from 'node:test';import assert from 'node:assert/strict';
import {buildIndex,toLibraryQuestion,matchRecordedQuestions} from '../assets/batch-model.mjs';
const question={number:'1',stem:'Separate what from how: ____________ and ____________. (Please answer in English lowercase)',options:[],issues:[]};
const record=(id,answer)=>({id,stem:question.stem,options:[],answer,answerProvided:true});
const match=(records,q=question)=>matchRecordedQuestions([q],buildIndex(records.map(r=>toLibraryQuestion('os','architecture',r))),{course:'os'})[0];
test('slash, linebreak and comma formats agree on the same ordered blank answers',()=>{
 const records=[record('original','policy / mechanism'),record('lines','policy\nmechanism'),{...record('submitted','policy/mechanism'),submissionReview:{status:'pending'}},record('comma','policy, mechanism')],before=JSON.stringify(records);
 const row=match(records);assert.equal(row.status,'matched');assert.equal(row.answer,'policy / mechanism');assert.equal(JSON.stringify(records),before);
 assert.equal(match([record('lines','policy\r\nmechanism')]).status,'matched');assert.equal(match([record('fullwidth','policy／mechanism')]).status,'matched');
});
test('answer order, actual conflicts and missing slots remain unrecorded',()=>{
 assert.equal(match([record('forward','policy/mechanism'),record('reverse','mechanism/policy')]).status,'unmatched');
 for(const answer of ['policy','policy/mechanism/extra','policy/','policy mechanism']){const row=match([record('bad',answer)]);assert.equal(row.status,'unmatched');assert.equal(row.answer,'');}
});
test('compound terms stay within a slot; ordinary whitespace is never used to infer extra blanks',()=>{
 const q={...question,stem:'The service is ____________.'};const raw=record('one','high availability');raw.stem=q.stem;assert.equal(match([raw],q).answer,'high availability');
 const records=[record('phrases','high availability / fault tolerance'),record('lines','high availability\nfault tolerance')];assert.equal(match(records,{...question,stem:question.stem.replace(' (Please answer in English lowercase)','')}).status,'matched');
});
test('commas within arrays and fraction bars within a single answer retain their meaning',()=>{
 const arrays=[record('array','0,1,2 / 3,4,5'),record('array-lines','0,1,2\n3,4,5')];assert.equal(match(arrays).status,'matched');
 const q={...question,stem:'The bound is ____________.'},raw={...record('bound','3n/10-6'),stem:q.stem};assert.equal(match([raw],q).answer,'3n/10-6');
 const fractions=[record('fractions','3n/10,7n/10'),record('fraction-lines','3n/10\n7n/10')];assert.equal(match(fractions).status,'matched');
});
