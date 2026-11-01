import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {parseHTML} from 'linkedom';
import {traceCounting,buildCountingCuration} from '../scripts/improve-counting-sort-20261101.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('algorithms.html'),curation=JSON.parse(await read('assets/algorithms-counting-curation.json')),live=JSON.parse(await read('content/algorithms-public-20261101.json'));
const base=JSON.parse(parseHTML(html).document.getElementById('course-data').textContent).find(u=>u.id==='L6').questions;
test('counting trace independently matches the 8-item example at all checkpoints and remains stable',()=>{
  const A=[2,5,3,0,2,3,0,3],data=traceCounting(A);
  assert.deepEqual(data.frequency,[2,0,2,3,0,1]);assert.deepEqual(data.prefix,[2,2,4,7,7,8]);
  assert.deepEqual(data.states[4],{B:[null,0,null,2,null,3,3,null],C:[1,2,3,5,7,8]});
  assert.deepEqual(data.states[6],{B:[0,0,null,2,3,3,3,null],C:[0,2,3,4,7,8]});
  assert.deepEqual(data.states[8],{B:[0,0,2,2,3,3,3,5],C:[0,2,2,4,7,7]});
  for(let step=0;step<=A.length;step++){
    const state=data.states[step];assert.equal(state.B.filter(x=>x!==null).length,step);
    for(let x=0;x<=5;x++)assert.equal(state.C[x],data.prefix[x]-data.steps.slice(0,step).filter(s=>s.x===x).length);
  }
  const destinations=new Map(data.steps.map(s=>[s.j,s.position]));
  for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++)if(A[i]===A[j])assert(destinations.get(i+1)<destinations.get(j+1));
});
test('19 explanations and 9 worked array questions validate current answers without mutating source content',()=>{
  const before=JSON.stringify({base,live});assert.deepEqual(buildCountingCuration(base,live),curation);assert.equal(JSON.stringify({base,live}),before);
  assert.equal(Object.keys(curation.questions).length,19);assert.equal(Object.values(curation.questions).filter(m=>m.versions.some(v=>v.walkthrough)).length,9);
  for(const m of Object.values(curation.questions))for(const v of m.versions){assert(v.explanation.trim());if(v.walkthrough){const d=v.walkthrough,s=d.states[d.target],teacher=JSON.parse(v.identity)[3].split('/').map(s=>s.trim().split(',').map(Number));assert.deepEqual(teacher,[s.B.map(x=>x??0),s.C]);assert.match(v.explanation,/先寫.*再把/);assert.match(v.explanation,/尚未|已執行完/);}}
});
function component(){const {document,window}=parseHTML(html);const context=vm.createContext({document,window,console});vm.runInContext(componentSource,context);return {document,window,context};}
const componentSource=await read('assets/counting-sort-walkthrough.js');
test('current edits use the correct option letters; custom explanations, changed data and deletion remain authoritative',()=>{
  const {window}=component();
  const raw=live.overrides.find(r=>(r.question.bookmarkId||r.question.id)==='L6-017').question;
  const before=JSON.stringify(raw),q=window.courseCountingSort.apply(raw);
  assert.match(q.ex,/D．參數 k.*選這項/);assert.equal(JSON.stringify(raw),before);assert.equal(q.a,'D');
  const fresh=window.courseCountingSort.apply({...raw,ex:'使用者另外寫的解析'});assert.equal(fresh.ex,'使用者另外寫的解析');assert(!fresh.countingExplanation);
  const changed=window.courseCountingSort.apply({...raw,a:'A'});assert.equal(changed.ex,raw.ex);assert(!changed.countingWalkthrough);
  assert.equal(window.courseCountingSort.apply(undefined),undefined);
});
test('step controls distinguish a written zero from an unwritten slot and restore the requested j boundary',()=>{
  const {document,window}=component();
  const raw=live.overrides.find(r=>(r.question.bookmarkId||r.question.id)==='L6-063').question;
  const q=window.courseCountingSort.apply(raw),host=document.createElement('div');host.innerHTML=window.courseCountingSort.markup(q);document.body.append(host);
  const root=host.firstElementChild;
  assert.equal(root.dataset.countingStep,'4');assert.match(root.querySelector('[data-counting-status]').textContent,/j＝4.*尚未執行/);
  const contents=()=>[...root.querySelector('[data-counting-body] table tbody tr').children].slice(1).map(td=>td.textContent);
  assert.deepEqual(contents(),['—','0','—','2','—','3','3','—']);
  root.querySelector('[data-counting-action="next"]').dispatchEvent(new window.Event('click',{bubbles:true}));
  assert.equal(root.dataset.countingStep,'5');assert.equal(contents()[0],'0');assert.match(root.querySelector('[data-counting-status]').textContent,/j＝3/);
  root.querySelector('[data-counting-action="target"]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(root.dataset.countingStep,'4');assert.equal(contents()[0],'—');
  for(let i=0;i<20;i++)root.querySelector('[data-counting-action="previous"]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(root.dataset.countingStep,'0');assert(root.querySelector('[data-counting-action="previous"]').disabled);
});
test('real lesson and background sync both retain all current counting explanations and respect later user edits',async()=>{
  const {document,window}=parseHTML(html);
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
  window.window=window;window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://example.com'};
  const storage=new Map();let resolve;
  const context=vm.createContext({document,window,location:{search:'?question=L6-063',protocol:'https:'},URLSearchParams,navigator:{onLine:true},AbortSignal,Date,console,requestAnimationFrame:f=>f(),scrollX:0,scrollY:0,innerHeight:900,CSS:{escape:String},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:()=>new Promise(r=>resolve=r)});
  for(const name of ['question-tools','choice-answers','practice-feedback','counting-sort-walkthrough','algorithms-learning','course-bootstrap'])vm.runInContext(await read('assets/'+name+'.js'),context);
  const config=window.courseLearning;
  for(const id of Object.keys(curation.questions)){const q=config.questionForEdit(id);assert(q.countingExplanation,id);if(curation.questions[id].versions.at(-1).walkthrough)assert(q.countingWalkthrough,id);}
  assert(document.querySelector('.counting-walkthrough'));
  const updated=structuredClone(live),row=updated.overrides.find(r=>(r.question.bookmarkId||r.question.id)==='L6-063');row.question.ex='新的公開解析';row.question.explanation='新的公開解析';
  resolve({ok:true,headers:{get:()=>new Date().toUTCString()},json:async()=>updated});await new Promise(r=>setImmediate(r));
  assert.equal(config.questionForEdit('L6-063').ex,'新的公開解析');assert(!config.questionForEdit('L6-063').countingWalkthrough);
});
