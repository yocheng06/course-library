import test from 'node:test';
import assert from 'node:assert/strict';
import {groupImport,groupedImportSummary,groupedImportSummaryText} from '../assets/grouped-submissions.mjs';
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


test('result totals include local and published duplicates without counting them twice',()=>{
 const group={payload:{questions:Array(8).fill(q())},skippedCount:2,result:{receivedCount:8,acceptedCount:5,skippedCount:3,status:'approved'}};
 assert.deepEqual(groupedImportSummary([group]),{total:10,added:5,duplicates:5,pending:0,completed:1,batches:1});
 assert.match(groupedImportSummaryText([group]),/本次共 10 題 · 已新增 5 題 · 重複略過 5 題/);
});

test('partial completion and restored receipts show accurate pending and completed counts',()=>{
 const groups=[{payload:{questions:Array(10).fill(q())},result:{receivedCount:10,acceptedCount:7,skippedCount:3}},{payload:{questions:Array(4).fill(q())},skippedCount:1}];
 const restored=JSON.parse(JSON.stringify(groups));
 assert.deepEqual(groupedImportSummary(restored),{total:15,added:7,duplicates:4,pending:4,completed:1,batches:2});
 assert.match(groupedImportSummaryText(restored),/已完成 1／2 批 · 尚有 4 題待處理/);
});

test('all-duplicate and older receipt results never claim questions were added',()=>{
 const group={payload:{questions:[q(),q()]},skippedCount:1,result:{status:'duplicates_only'}};
 assert.deepEqual(groupedImportSummary([group]),{total:3,added:0,duplicates:3,pending:0,completed:1,batches:1});
});
