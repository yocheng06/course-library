import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setupLibraryManager} from '../assets/library-manager.mjs';
import {setupUnitManager} from '../assets/unit-manager.mjs';
import {createUnitCatalog} from '../assets/unit-catalog.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function dom(store=storage()){
 const {document,window}=parseHTML('<section id="libraryWorkspace"></section><dialog id="questionDialog"></dialog><section id="unitWorkspace"></section>');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',(o.getAttribute('value')??o.textContent)===v);}});
 Object.assign(globalThis,{window,document,localStorage:store,requestAnimationFrame:f=>f(),confirm:()=>true});
 window.courseContributions={apiOrigin:'https://test.invalid'};window.scrollTo=()=>{};window.HTMLElement.prototype.focus=()=>{};
 const dialog=document.getElementById('questionDialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
 return {document,window,$:id=>document.getElementById(id),fire:(node,type)=>node.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true}))};
}
function bank(count=27){return Array.from({length:count},(_,i)=>({key:'community:os:q'+i,id:'q'+i,source:'community',course:'os',unit:'basics',revision:0,deleted:false,hasHistory:true,stem:'題目 '+i,type:'填空題'}));}
function server(rows,{fail=()=>false}={}){
 const posts=[],queries=[];
 globalThis.fetch=async(raw,opts={})=>{
  const url=new URL(raw);queries.push(url);
  if(opts.method==='POST'){
   const id=url.pathname.split('/').at(-1),row=rows.find(r=>r.id===id),body=JSON.parse(opts.body);posts.push({id,body});
   if(fail(id))return new Response(JSON.stringify({error:'測試連線失敗'}),{status:503});
   assert.equal(body.revision,row.revision);row.deleted=body.action==='hide';row.revision++;
   return new Response(JSON.stringify({item:{...row}}));
  }
  if(url.pathname.endsWith('/item')){const row=rows.find(r=>r.id===url.searchParams.get('id'));return new Response(JSON.stringify({item:{...row,published:!row.deleted,question:{stem:row.stem,type:'填空題',category:'測試',answer:'answer',options:[],images:[]}}}));}
  const state=url.searchParams.get('state'),list=rows.filter(r=>state==='deleted'?r.deleted:state==='all'?!r.deleted:true),start=Number(url.searchParams.get('cursor')||0);
  return new Response(JSON.stringify({items:list.slice(start,start+25),total:list.length,nextCursor:start+25<list.length?String(start+25):null,units:[{id:'basics',label:'L2 · 基礎'}],counts:{all:rows.filter(r=>!r.deleted).length,modified:rows.length,deleted:rows.filter(r=>r.deleted).length}}));
 };
 return {posts,queries};
}
async function waitFor(predicate){for(let i=0;i<80&&!predicate();i++)await tick();assert.ok(predicate());}

test('select all matching includes unloaded questions; bulk removal is recoverable in place',async()=>{
 const ui=dom(),rows=bank(),s=server(rows),manager=setupLibraryManager();await manager.show('all');
 assert.equal(ui.document.querySelectorAll('[data-select]').length,25);
 ui.$('librarySelectMatching').click();await waitFor(()=>ui.$('librarySelectedCount').textContent.includes('已選 27 題'));
 ui.$('libraryRemoveSelected').click();await waitFor(()=>s.posts.length===27&&!ui.$('libraryUndo').hidden&&!ui.$('libraryUndo').disabled);
 assert.equal(rows.filter(r=>r.deleted).length,27);assert.equal(ui.$('libraryRestoreSelected').hidden,true);
 ui.$('libraryUndo').click();await waitFor(()=>s.posts.length===54&&rows.every(r=>!r.deleted)&&!ui.$('libraryUndo').disabled);
 assert.equal(s.posts.filter(p=>p.body.action==='hide').length,27);
 assert.equal(s.posts.filter(p=>p.body.action==='restore').length,27);
});

test('partial failure retains only failed selections and retries only them',async()=>{
 const ui=dom(),rows=bank(3);let failing=true;const s=server(rows,{fail:id=>failing&&id==='q1'}),manager=setupLibraryManager();await manager.show('modified');
 ui.$('librarySelectVisible').checked=true;ui.fire(ui.$('librarySelectVisible'),'change');ui.$('libraryRemoveSelected').click();
 await waitFor(()=>!ui.$('libraryRetry').hidden);
 assert.match(ui.$('librarySelectedCount').textContent,/已選 1 題/);assert.equal(s.posts.length,3);
 failing=false;ui.$('libraryRetry').click();await waitFor(()=>s.posts.length===4&&rows.every(r=>r.deleted)&&ui.$('libraryRetry').hidden);
 assert.equal(s.posts.at(-1).id,'q1');
 await manager.show('deleted');assert.equal(ui.document.querySelectorAll('[data-select]').length,3);
 ui.$('librarySelectVisible').checked=true;ui.fire(ui.$('librarySelectVisible'),'change');assert.equal(ui.$('libraryRemoveSelected').hidden,true);assert.equal(ui.$('libraryRestoreSelected').hidden,false);
});

test('course, unit, source, sort and query survive a fresh manager instance',async()=>{
 const store=storage();let ui=dom(store),s=server(bank(1)),manager=setupLibraryManager({userId:'owner'});await manager.show('all');
 ui.$('libraryUnit').value='basics';ui.$('libraryQuery').value='題目';ui.fire(ui.$('librarySearch'),'submit');await tick();
 ui=dom(store);s=server(bank(1));manager=setupLibraryManager({userId:'owner'});await manager.show('modified');
 assert.equal(ui.$('libraryUnit').value,'basics');assert.equal(ui.$('libraryQuery').value,'題目');assert.equal(s.queries[0].searchParams.get('unit'),'basics');assert.equal(s.queries[0].searchParams.get('q'),'題目');
});

test('managed unit labels and display order remain correct through cache reload',()=>{
 const store=storage(),catalog=createUnitCatalog(store);
 catalog.update('os',[{id:'basics',title:'新的基礎',label:'L2 · 新的基礎',managed:true,order:2},{id:'scheduling',title:'排程',label:'L6 · 排程',managed:true,order:1}]);
 assert.equal(catalog.list('os')[0].id,'scheduling');assert.equal(createUnitCatalog(store).list('os')[0].name,'L6 · 排程');assert.equal(createUnitCatalog(store).names.os.basics,'L2 · 新的基礎');
});

test('unit manager sends the visible new names and order with concurrency revision',async()=>{
 const ui=dom();let payload;globalThis.fetch=async(raw,opts={})=>{
  const units=[{id:'basics',title:'基礎',order:1},{id:'scheduling',title:'排程',order:2}];
  if(opts.method==='POST'){payload=JSON.parse(opts.body);return new Response(JSON.stringify({revision:4,units:payload.units}));}
  return new Response(JSON.stringify({revision:3,units}));
 };
 const manager=setupUnitManager({container:ui.$('unitWorkspace')});await manager.show();
 const title=ui.document.querySelector('[data-unit-title="1"]');title.value='新的排程';ui.fire(title,'input');ui.document.querySelector('[data-unit-up="1"]').click();
 ui.document.querySelector('[data-unit-save]').click();await waitFor(()=>ui.document.querySelector('[data-unit-status]').textContent.includes('已儲存'));
 assert.equal(payload.revision,3);assert.deepEqual(payload.units,[{id:'scheduling',title:'新的排程'},{id:'basics',title:'基礎'}]);
});

for(const course of ['os','algorithms'])test(course+' reader applies managed unit labels without changing question IDs',async()=>{
 const h=await loadCourse(course);const id=course==='os'?'basics':'L2';const original=h.window.courseLearning.scopeIds();
 h.window.courseLearning.setUnitMetadata([{id,title:'重新命名的單元',managed:true,order:1}]);
 assert.match(h.document.querySelector('.sidebar').textContent,/重新命名的單元/);
 assert.deepEqual(h.window.courseLearning.scopeIds(),original);
});

test('history highlights changed text and keeps imported markup inert',async()=>{
 const ui=dom(),row=bank(1)[0],base=server([row]),fetchBase=globalThis.fetch;
 globalThis.fetch=async(raw,opts)=>{
  const url=new URL(raw);
  if(url.pathname.endsWith('/history'))return new Response(JSON.stringify({items:[{id:'history-1',revision:0,unit:'basics',created_at:Date.now(),data:{stem:row.stem,type:'填空題',category:'測試',answer:'舊答案<img src=x onerror=bad()>',options:[],images:[]}}]}));
  return fetchBase(raw,opts);
 };
 const manager=setupLibraryManager();await manager.show('modified');ui.document.querySelector('[data-history]').click();
 await waitFor(()=>ui.document.querySelector('.history-record'));
 assert.match(ui.document.querySelector('.field-diff').textContent,/正確答案/);
 assert(ui.document.querySelector('.field-diff mark'));
 assert.equal(ui.document.querySelector('.history-record img'),null);
 assert.match(ui.document.querySelector('.history-record').textContent,/<img/);
});
