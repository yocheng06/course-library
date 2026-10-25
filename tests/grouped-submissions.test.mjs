import test from 'node:test';
import assert from 'node:assert/strict';
import {groupImport} from '../assets/grouped-submissions.mjs';
const fallback={course:'os',unit:'basics',title:'測試題庫',name:'',source:''};
const q=(n=0)=>({category:'測試',type:'填空題',stem:'測試問題 '+n,answer:'answer',images:[]});
test('flat mixed-course questions group by explicit course and unit without losing original order',()=>{
 const groups=groupImport([{...q(1),course:'os',unit:'basics'},{...q(2),course:'algorithms',unit:'L4'},{...q(3),course:'os',unit:'basics'}],fallback);
 assert.equal(groups.length,2);assert.equal(groups[0].payload.questions.length,2);
 assert.deepEqual(groups[0].payload.questions.map(q=>q.stem),['測試問題 1','測試問題 3']);
 assert.equal(groups[1].payload.course,'algorithms');
});
test('nested course arrays and saved grouped drafts retain all units; invalid scopes are rejected',()=>{
 const groups=groupImport([{id:'L2',questions:[q(1)]},{id:'L3',questions:[q(2)]}],{...fallback,course:'algorithms',unit:'L2'});
 assert.deepEqual(groups.map(g=>g.payload.unit),['L2','L3']);
 assert.throws(()=>groupImport([{...q(),unit:'wrong'}],fallback),/找不到單元/);
 const mixed=groupImport({groups:[{course:'algorithms',unit:'L4',questions:[q()]}]},fallback);assert.equal(mixed[0].payload.unit,'L4');
});
test('large units split into batches of at most 200 and preserve every question',()=>{
 const groups=groupImport(Array.from({length:201},(_,n)=>q(n)),fallback);
 assert.deepEqual(groups.map(g=>g.payload.questions.length),[200,1]);
 assert.equal(groups[1].payload.questions[0].stem,'測試問題 200');
});
