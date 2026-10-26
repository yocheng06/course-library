import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildIndex,matchQuestion} from '../assets/batch-model.mjs';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const html=await read('algorithms.html');
const questions=JSON.parse(html.match(/<script id="course-data" type="application\/json">(.*?)<\/script>/s)[1]).find(u=>u.id==='L6').questions;
const audit=JSON.parse(await read('content/algorithms-l6-content-review-20261026.json'));
const library=JSON.parse(await read('assets/batch-library.json'));
const byId=new Map(questions.map(q=>[q.bookmarkId,q]));
test('L6 orders question types consistently and preserves all stable identities and answers',()=>{
 assert.equal(questions.length,60);
 assert.deepEqual([...byId.keys()].sort(),audit.oldOrder.toSorted());
 const rank={'單選題':0,'多選題':1,'填空題':2};
 for(const category of ['基數排序','桶排序','排序基礎','計數排序']){
  const types=questions.filter(q=>q.category===category).map(q=>rank[q.type]);
  assert.deepEqual(types,types.toSorted());
 }
 for(const {id,before} of audit.changes){const q=byId.get(id);assert.equal(q.a,before.a);assert.deepEqual(q.opts,before.opts);}
 const traces=questions.filter(q=>q.q.includes('COUNTING_SORT(A, B, k)'));
 const groupSizes=traces.map(q=>q.q.match(/A陣列的內容為 ([\d,]+)/)[1].split(',').length);
 assert.deepEqual(groupSizes,groupSizes.toSorted((a,b)=>a-b));
 for(const q of traces){assert.match(q.q,/1  for i <- 0 to k/);assert.match(q.q,/6  for i <- 1 to k/);}
});
test('original wording still retrieves the reviewed answer after formatting and code repairs',()=>{
 const index=buildIndex(library.entries);
 for(const {id,before} of audit.changes){
  if(byId.get(id).q===before.q)continue;
  const options=before.opts.map((text,i)=>({label:String.fromCharCode(65+i),text:text.replace(/^[A-H]\.\s*/, '')}));
  const result=matchQuestion({stem:before.q,options,issues:[]},index,{course:'algorithms',unit:'L6'});
  assert.equal(result.status,'matched',id+': '+result.reason);
  assert.equal(result.answer,byId.get(id).a,id);
 }
});
test('every array trace independently follows its stated radix, bucket or counting checkpoint',()=>{
 assert.equal(audit.traceVerification.length,15);
 for(const c of audit.traceVerification){
  let answer;
  if(c.kind==='radix'){
   // A sequence of stable decimal passes equals ordering by the processed suffix.
   const modulus=10**c.passes;
   answer=c.values.toSorted((a,b)=>(a%modulus)-(b%modulus)).join(',');
  }else if(c.kind==='bucket'){
   const values=c.line===2?c.values.slice(0,c.checkpoint):c.values;
   const groups=c.indices.map(i=>values.filter(v=>Math.floor(c.values.length*v)===i));
   answer=groups.map((group,n)=>(c.line===4&&c.indices[n]<c.checkpoint?group.toSorted((a,b)=>a-b):group).join(',')).join(' / ');
  }else{
   const B=Array(c.values.length).fill(0);
   const entries=c.values.map((value,index)=>({value,index})).toSorted((a,b)=>a.value-b.value);
   // Stable final ranks determine the destination of each already-processed input.
   entries.forEach(({value,index},rank)=>{if(index>=c.checkpoint)B[rank]=value;});
   const remaining=c.values.slice(0,c.checkpoint);
   const C=Array.from({length:6},(_,key)=>c.values.filter(v=>v<key).length+remaining.filter(v=>v===key).length);
   answer=B.join(',')+' / '+C.join(',');
  }
  assert.equal(answer,byId.get(c.id).a,c.id);
 }
 for(const q of questions){
  const blanks=[...q.q.matchAll(/\[__(\d+)__\]/g)].map(m=>+m[1]);
  if(blanks.length){assert.deepEqual(blanks,Array.from({length:blanks.length},(_,i)=>i+1));assert.equal(blanks.length,q.a.split(' / ').length,q.bookmarkId);}
 }
});
