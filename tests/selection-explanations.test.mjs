import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {buildCuration,explain} from '../scripts/rewrite-algorithms-l7-20261101.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('algorithms.html'),curation=JSON.parse(await read('assets/algorithms-l7-curation.json'));
const current=JSON.parse(await read('content/algorithms-l7-current-20261101.json'));
const live=JSON.parse(await read('content/algorithms-public-l7-20261101.json'));
const base=JSON.parse(parseHTML(html).document.getElementById('course-data').textContent).find(u=>u.id==='L7').questions;
const source=await read('assets/selection-explanations.js');
function component(){const {document,window}=parseHTML(html);vm.runInContext(source,vm.createContext({document,window}));return {document,window};}

test('all 60 effective questions and original versions have full reviewed explanations with every option addressed',()=>{
 assert.deepEqual(buildCuration(base,current),curation);assert.equal(Object.keys(curation.questions).length,60);
 const {window}=component();
 for(const raw of [...base,...current]){
  const before=JSON.stringify(raw),q=window.courseSelection.apply(raw);
  assert.equal(JSON.stringify(raw),before);assert(q.selectionExplanation,raw.bookmarkId);assert.equal(q.ex,explain(raw));
  assert(q.ex.length>=160,raw.bookmarkId);assert.match(q.ex,/解題思路與過程/);
  for(const o of raw.opts)assert(q.ex.includes(o),`${raw.bookmarkId} ${o}`);
  for(const key of Object.keys(raw).filter(k=>!['ex','explanation'].includes(k)))assert.deepEqual(q[key],raw[key]);
 }
});
test('later explanation, answer, option and stem edits win over the reviewed versions',()=>{
 const {window}=component(),raw=current.find(q=>q.bookmarkId==='L7-2511');
 for(const change of [{ex:'我自己補充的解析'},{q:raw.q+'新版條件'},{a:'(n+1)/2'},{opts:['新增選項']}]){
  const q=window.courseSelection.apply({...raw,...change});assert(!q.selectionExplanation);for(const [k,v]of Object.entries(change))assert.deepEqual(q[k],v);
 }
 const normalized={...raw,stem:raw.q,options:raw.opts,answer:raw.a,explanation:raw.ex};
 const revised=window.courseSelection.apply(normalized);assert.equal(revised.ex,revised.explanation);
 assert.equal(window.courseSelection.apply(null),null);
});
test('worked numeric examples agree with independent rank and comparison calculations',()=>{
 const A=[42,17,89,8,55,23,71,94,12,63,31,76,5,50,82,29,66,37];
 assert.equal(A.filter(x=>x<63).length,11);assert.equal(A.filter(x=>x>63).length,6);
 const right=A.filter(x=>x>63).sort((a,b)=>a-b);assert.equal(right[4],89);
 const B=A.map(x=>x===63?59:x);assert.equal(B.filter(x=>x<59).length,11);assert.equal(B.sort((a,b)=>a-b)[13],71);
 assert.equal(17-(A.filter(x=>x<63).length+1),5);
 const pairs=[8,3,5,1,9,4];let comparisons=1,min=Math.min(pairs[0],pairs[1]),max=Math.max(pairs[0],pairs[1]);
 for(let i=2;i<pairs.length;i+=2){comparisons+=3;const low=Math.min(pairs[i],pairs[i+1]),high=Math.max(pairs[i],pairs[i+1]);min=Math.min(min,low);max=Math.max(max,high);}
 assert.deepEqual([min,max,comparisons],[1,9,7]);assert.equal(comparisons,3*pairs.length/2-2);
 assert.equal(8+Math.ceil(Math.log2(8))-2,9);
 const groups=[[1,2,3,4,100],[5,6,7,8,9],[10,11,12,13,14]];
 assert.equal(groups.map(g=>g[2]).sort((a,b)=>a-b)[1],7);assert.equal(groups.flat().sort((a,b)=>a-b)[7],8);
 assert.equal(3*200/10-6,54);assert.equal(7*200/10+6,146);
});
test('inline curation and current public snapshot match the standalone assets',async()=>{
 const {document}=parseHTML(html);assert.deepEqual(JSON.parse(document.getElementById('course-algorithms-l7-curation').textContent),curation);
 const snapshot=JSON.parse(document.getElementById('course-community-snapshot').textContent);
 assert.deepEqual(snapshot,JSON.parse(await read('assets/course-snapshots/algorithms.json')));
 assert.deepEqual(snapshot.data.overrides,live.overrides);
 const scripts=[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src'));
 assert(scripts.findIndex(s=>s.startsWith('assets/selection-explanations.js'))<scripts.findIndex(s=>s.startsWith('assets/algorithms-learning.js')));
 assert.match(await read('assets/selection-explanations.css'),/white-space: pre-line/);
});

test('real lesson, practice and background sync retain all 60 explanations and respect edits and deletions',async()=>{
 const {document,window}=parseHTML(html);
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 window.window=window;window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://example.com'};
 const storage=new Map();let resolve;
 const context=vm.createContext({document,window,location:{search:'?question=L7-2520',protocol:'https:'},URLSearchParams,navigator:{onLine:true},AbortSignal,Date,console,requestAnimationFrame:f=>f(),scrollX:0,scrollY:0,innerHeight:900,CSS:{escape:String},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:()=>new Promise(r=>resolve=r)});
 for(const name of ['question-tools','choice-answers','practice-feedback','counting-sort-walkthrough','selection-explanations','algorithms-learning','course-bootstrap'])vm.runInContext(await read('assets/'+name+'.js'),context);
 const config=window.courseLearning;
 for(const raw of current){const q=config.questionForEdit(raw.bookmarkId);assert(q.selectionExplanation,raw.bookmarkId);assert.equal(q.a,raw.a);assert.equal(q.q,raw.q);assert.equal(q.ex,explain(raw));}
 assert(document.querySelector('.selection-explanation'));assert(document.querySelector('.selection-explanation').textContent.includes('i−k'));
 assert.equal(config.examEntries(['L7']).length,60);assert(config.examEntries(['L7']).every(e=>e.q.selectionExplanation));
 const updated=structuredClone(live),row=updated.overrides.find(r=>r.question.bookmarkId==='L7-2511');
 row.question.ex='使用者最新解析';row.question.explanation='使用者最新解析';
 updated.overrides.push({unit:'L7',deleted:true,question:{bookmarkId:'L7-2468',aliases:[]}});
 resolve({ok:true,headers:{get:()=>new Date().toUTCString()},json:async()=>updated});await new Promise(r=>setImmediate(r));
 assert.equal(config.questionForEdit('L7-2511').ex,'使用者最新解析');assert(!config.questionForEdit('L7-2511').selectionExplanation);
 assert.equal(config.examEntries(['L7']).length,59);assert(!config.examEntries(['L7']).some(e=>e.id==='L7-2468'));
});
