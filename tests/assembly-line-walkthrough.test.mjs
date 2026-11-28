import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {loadCourse,orderingIssues} from '../scripts/audit-topic-order-20261102.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('assets/assembly-line-walkthrough.js');
const live=JSON.parse(await read('assets/course-snapshots/algorithms.json')).data;
const numeric=live.questions.filter(row=>row.unit==='L10'&&/e1\s*=/.test(row.question.q)).map(row=>row.question);
const plain=value=>JSON.parse(JSON.stringify(value));
function component(){const {document,window}=parseHTML('<html><body></body></html>');vm.runInContext(source,vm.createContext({document,window}));return {document,window,api:window.courseAssemblyLine};}

test('eleven assembly versions match exhaustive route costs for every station and final exit',()=>{
 const {api}=component();assert.equal(numeric.length,11);
 for(const q of numeric){const before=JSON.stringify(q),input=api.parse(q);assert(input,q.bookmarkId);const data=api.trace(input),n=input.processing[0].length;
  const cost=route=>input.entry[route[0]]+route.reduce((sum,line,j)=>sum+input.processing[line][j]+(j&&line!==route[j-1]?input.transfer[route[j-1]][j]:0),0);
  for(let length=1;length<=n;length++)for(let line=0;line<2;line++){
   const routes=Array.from({length:2**length},(_,bits)=>Array.from({length},(_,j)=>(bits>>j)&1)).filter(route=>route.at(-1)===line);
   assert.equal(data.values[line][length-1],Math.min(...routes.map(cost)),q.bookmarkId);
  }
  const routes=Array.from({length:2**n},(_,bits)=>Array.from({length:n},(_,j)=>(bits>>j)&1));
  assert.equal(data.minimum,Math.min(...routes.map(route=>cost(route)+input.exit[route.at(-1)])));
  const route=data.route.map(line=>line-1);assert.equal(cost(route)+input.exit[route.at(-1)],data.minimum);
  assert.equal(JSON.stringify(q),before);
 }
 const data=api.trace(api.parse(numeric[0]));assert.deepEqual(plain(data.values),[[9,18,20,24,32,35],[12,16,22,25,30,37]]);assert.deepEqual(plain(data.finishing),[38,39]);assert.equal(data.minimum,38);
});

test('unknown conditions, malformed arrays and images never receive an invented demonstration',()=>{
 const {api}=component(),q=numeric[0];
 for(const changed of [q.q.replace('各站點處理時間','禁止換線。各站點處理時間'),q.q+'且最多換線一次',q.q.replace('7, 9, 3, 4, 8, 4','7, 9, 3'),q.q.replace('e1 = 2','e1 = -2'),q.q.replace('j-1','j-2'),q.q.replace('t1 = [-, 2, 3, 1, 3, 4]','t1 = [-, 2, 3]')])assert.equal(api.markup({...q,q:changed}),'');
 assert.equal(api.markup({...q,images:['https://example.com/extra-condition.png']}),'');assert.equal(api.markup({q:'裝配線排程的輸出結果通常為？'}),'');
});

test('each click reveals one whole station, exit remains separate, reverse and reset are exact and copies stay independent',()=>{
 const {document,window,api}=component(),host=document.createElement('div');host.innerHTML=api.markup(numeric[0])+api.markup(numeric[0]);document.body.append(host);
 const [a,b]=host.querySelectorAll('[data-assembly-input]');const click=(root,action)=>root.querySelector(`[data-assembly-action="${action}"]`).dispatchEvent(new window.Event('click',{bubbles:true}));
 const initial=a.querySelector('[data-assembly-body]').innerHTML;
 click(a,'next');assert.match(a.querySelector('.assembly-calculation').textContent,/進入 2.*加工 7.*9 分/);assert.equal(b.dataset.assemblyStep,'0');
 for(let j=0;j<5;j++)click(a,'next');assert.equal(a.dataset.assemblyStep,'6');assert.match(a.querySelector('.assembly-calculation').textContent,/min\(35, 37\).*35 分.*尚未加離場/);
 click(a,'next');assert.match(a.querySelector('.assembly-calculation').textContent,/35 \+ 3 = 38 分/);assert.match(a.querySelector('.assembly-calculation').textContent,/37 \+ 2 = 39 分/);assert.equal(a.querySelectorAll('.assembly-route').length,6);assert(a.querySelector('[data-assembly-action="next"]').disabled);
 click(a,'previous');assert.equal(a.querySelectorAll('.assembly-route').length,0);assert.equal(a.dataset.assemblyStep,'6');
 click(a,'restart');assert.equal(a.querySelector('[data-assembly-body]').innerHTML,initial);assert(a.querySelector('[data-assembly-action="previous"]').disabled);
 click(b,'finish');assert.equal(b.dataset.assemblyStep,'7');assert.equal(a.dataset.assemblyStep,'0');
});

test('ties retain a valid predecessor and station questions never label the exit total as their answer',()=>{
 const {api}=component(),input=plain(api.parse(numeric[0]));input.entry=[0,0];input.exit=[0,0];input.processing=[[1,1],[1,1]];input.transfer=[[null,0],[null,0]];
 const data=api.trace(input);assert.deepEqual(plain(data.route),[1,1]);assert.equal(data.states[2].comparisons[0].tie,true);
 const q=numeric.find(q=>q.q.endsWith('站點 6 的最少時間是多少'));assert.match(api.markup(q),/本題問第 6 站.*不加離場時間/);
});

test('shared renderer keeps option reasoning visible and preserves the complete explanation and recorded answers',async()=>{
 const h=await loadCourse('algorithms',{live});
 for(const q of numeric){const before=JSON.stringify(q),markup=h.window.courseQuestionTools.explanationMarkup(q),{document}=parseHTML(markup);assert(document.querySelector('[data-assembly-input]'));
  assert(document.querySelector('.assembly-full-calculation'));assert(!document.querySelector('.assembly-full-calculation').hasAttribute('open'));
  const summary=document.querySelector('.assembly-answer-summary');assert(summary);assert(!summary.closest('details'));
  const original=h.window.courseQuestionTools.explanationText(q);for(const option of q.opts)assert(summary.textContent.includes(option));
  assert.equal(JSON.stringify(q),before);assert.equal(h.window.courseQuestionTools.explanationText(q),original);
 }
 const conflict=numeric.find(q=>q.a?.startsWith('22/'));assert(conflict);const markup=h.window.courseQuestionTools.explanationMarkup(conflict);assert.match(markup,/22/);assert.match(markup,/24/);
 const html=await read('algorithms.html');assert(html.indexOf('assembly-line-walkthrough.js')<html.indexOf('topic-order.js'));
});

test('live L10 keeps all questions and protected source fields, with four assembly datasets in contiguous typed groups',async()=>{
 const {config,window}=await loadCourse('algorithms',{live}),entries=config.examEntries(['L10']);assert.equal(entries.length,60);assert.deepEqual(orderingIssues(entries,window.courseTopicOrder,'algorithms'),[]);
 const groups=new Map();
 for(const [i,e] of entries.entries()){
  const input=window.courseAssemblyLine.parse(e.q);if(!input)continue;const {query,...data}=input,key=JSON.stringify(data);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 assert.equal(groups.size,4);for(const positions of groups.values())assert.equal(positions.at(-1)-positions[0]+1,positions.length);
 for(const row of live.questions.filter(row=>row.unit==='L10')){const e=entries.find(e=>e.id===row.question.bookmarkId);assert(e);assert.equal(e.q.q,row.question.q);assert.deepEqual(plain(e.q.opts),row.question.opts);assert.equal(e.q.a,row.question.a);}
 const base=numeric[0],other={...base,q:base.q.replace('e1 = 2','e1 = 3')};assert.notEqual(window.courseTopicOrder.premiseKey(base),window.courseTopicOrder.premiseKey(other));
});
