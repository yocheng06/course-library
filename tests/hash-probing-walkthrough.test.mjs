import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {hashCalculation} from '../scripts/lib/hash-table-worked.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('assets/hash-probing-walkthrough.js');
const questions=JSON.parse(await read('content/algorithms-l9-review-20261127.json')).questions.map(r=>r.after);
function component(){const {document,window}=parseHTML('<html><body></body></html>');vm.runInContext(source,vm.createContext({document,window,console}));return {document,window,api:window.courseHashProbing};}
const plain=v=>JSON.parse(JSON.stringify(v));
test('all nineteen current numeric questions produce unchanged answers and exact table states',()=>{
 const {api}=component();let count=0;
 for(const q of questions){const before=JSON.stringify(q),input=api.parse(q);if(!/將鍵值/.test(q.q)){assert.equal(input,null);continue;}assert(input,q.bookmarkId);count++;
  const actual=api.trace(input),expected=hashCalculation(q).result;
  assert.deepEqual(plain(actual.table),expected.table,q.bookmarkId);assert.deepEqual(plain(actual.failed),expected.failed);
  assert(actual.states[0].table.every(x=>x===null));
  for(let i=1;i<actual.states.length;i++){
   const state=actual.states[i],previous=actual.states[i-1],changed=state.table.flatMap((x,j)=>x===previous.table[j]?[]:[j]);
   assert.deepEqual(plain(changed),state.kind==='insert'?[state.slot]:[]);
   if(state.kind==='collision')assert.notEqual(state.occupant,null);
   if(state.kind==='insert')assert.equal(state.occupant,null);
  }
  assert.equal(JSON.stringify(q),before);
 }
 assert.equal(count,19);
});
test('unsupported formulas do not receive an invented visualization',()=>{
 const {api}=component(),q=questions.find(q=>/雙重雜湊/.test(q.q)&&/h2\(k\) = 1/.test(q.q));
 for(const stem of [q.q.replace('h1(k) = k','h1(k) = 2*k'),q.q.replace('h2(k) = 1 +','h2(k) = 2 *'),q.q.replace("h'(k) = k","h'(k) = k*k"),q.q.replace('m = 11','m = 100000'),q.q.replace('m - 1','m - 2')])assert.equal(api.markup({...q,q:stem}),'');
 assert.equal(api.markup({q:'概念題'}),'');
});
test('step controls expose collisions before placement, reverse exactly, and stay local to each copy',()=>{
 const {api,document,window}=component(),q=questions.find(q=>/10、22、31、4、15、28、17、88、59/.test(q.q)&&/h2\(k\) = 1/.test(q.q));assert(q);
 const host=document.createElement('div');host.innerHTML=api.markup(q)+api.markup(q);document.body.append(host);
 const [first,second]=host.querySelectorAll('[data-hash-input]');
 const click=(root,action)=>root.querySelector('[data-hash-action="'+action+'"]').dispatchEvent(new window.Event('click',{bubbles:true}));
 const values=root=>[...root.querySelectorAll('tbody td')].map(td=>td.firstChild.textContent);
 assert(values(first).every(v=>v==='—'));assert(first.querySelector('[data-hash-action="previous"]').disabled);
 for(let i=0;i<5;i++)click(first,'next');
 assert.equal(first.dataset.hashStep,'5');assert.equal(first.querySelector('.hash-collision').firstChild.textContent,'4');assert.match(first.querySelector('[data-hash-status]').textContent,/目前鍵 15.*i=0.*碰撞/);
 assert.equal(values(first)[5],'—');assert.equal(second.dataset.hashStep,'0');
 click(first,'next');assert.match(first.querySelector('[data-hash-status]').textContent,/i=1.*已有 10/);
 click(first,'next');assert.equal(values(first)[5],'15');assert(first.querySelector('.hash-insert'));
 click(first,'previous');assert.equal(values(first)[5],'—');
 click(first,'finish');assert.deepEqual(values(first),['22','—','59','17','4','15','28','88','—','31','10']);assert(first.querySelector('[data-hash-action="next"]').disabled);
 click(first,'restart');assert(values(first).every(v=>v==='—'));assert.equal(first.dataset.hashStep,'0');
});
test('cyclic double hashing explains failure without putting the key in an unrelated empty slot',()=>{
 const {api,document,window}=component(),q=questions.find(q=>/h2\(k\) = 3/.test(q.q)&&/無法藉此公式/.test(q.q));assert(q);
 const host=document.createElement('div');host.innerHTML=api.markup(q);document.body.append(host);
 const root=host.firstElementChild,data=api.trace(api.parse(q));
 const failure=data.states.findIndex(s=>s.kind==='failed');assert(failure>0);
 for(let i=0;i<failure;i++)root.querySelector('[data-hash-action="next"]').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.match(root.querySelector('[data-hash-status]').textContent,/無法插入/);assert(data.states[failure].table.some(x=>x===null));
});
test('shared explanation rendering includes the widget for lessons and exam review without changing stored content',async()=>{
 const h=await loadCourse('algorithms');
 vm.runInContext(source,vm.createContext({document:h.document,window:h.window,console}));
 const q=questions.find(q=>/將鍵值/.test(q.q)),before=JSON.stringify(q);
 const rendered=h.window.courseQuestionTools.explanationMarkup(q);
 assert.match(rendered,/data-hash-action="next"/);assert(rendered.includes('逐鍵計算'));
 assert.equal(h.window.courseQuestionTools.explanationText(q),q.ex);assert.equal(JSON.stringify(q),before);
 const html=await read('algorithms.html');assert(html.indexOf('assets/hash-probing-walkthrough.js')<html.indexOf('assets/algorithms-learning.js'));
 const css=await read('assets/hash-probing-walkthrough.css');assert.match(css,/overflow-x:auto/);assert.match(css,/var\(--ink/);assert.match(css,/min-height:44px/);
});
