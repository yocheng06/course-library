import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { INBOX_KEY, stageUnmatched, readInbox, writeInbox } from '../assets/submission-inbox.mjs';
const draftKey='course-library-submission-draft-v1';
const storage=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const question=n=>({number:n,type:'單選題',stem:`未收錄原題 ${n}？`,options:[{label:'A',text:'第二個值'},{label:'B',text:'第一個值'}]});
const rows=(count=7)=>Array.from({length:count},(_,i)=>({status:'unmatched',question:question(i+4)}));
test('10 questions: only 7 unmatched transfer with order intact and blank answers',()=>{
 const s=storage(), source=[...Array.from({length:3},(_,i)=>({status:'matched',question:question(i+1)})),...rows()];
 source[3].question.answer='B';source[3].question.explanation='untrusted';
 stageUnmatched(source,{course:'os',unit:'all'},s);
 const items=readInbox(s);assert.equal(items.length,7);assert.equal(items[0].number,'4');
 assert.equal(items[0].optionsText,'第二個值\n第一個值');assert.equal(items[0].unit,'');
 assert(items.every(q=>q.answer===''&&q.explanation===''));
 assert.equal(stageUnmatched(source,{course:'os',unit:'all'},s).added,0);
 items[0].answer='B';items[0].explanation='已填解析';writeInbox(s,items);
 stageUnmatched(source,{course:'os',unit:'scheduling'},s);assert.equal(readInbox(s)[0].answer,'B');
 stageUnmatched([{status:'review',question:question(99)},...rows()],{course:'os',unit:'all'},s);assert.equal(readInbox(s).length,7);
});
test('invalid storage, storage quota and oversized queues preserve previous data',()=>{
 const s=storage();s.setItem(INBOX_KEY,'broken');assert.throws(()=>stageUnmatched(rows(),{course:'os',unit:'all'},s),/原資料仍保留/);assert.equal(s.getItem(INBOX_KEY),'broken');
 assert.throws(()=>stageUnmatched(rows(),{course:'os',unit:'all'},{getItem:()=>null,setItem(){throw Error('quota');}}),/quota/);
 const valid=storage();stageUnmatched(rows(),{course:'os',unit:'all'},valid);const item=readInbox(valid)[0];assert.throws(()=>writeInbox(valid,Array.from({length:201},()=>item)),/200/);assert.equal(readInbox(valid).length,7);
});
async function page(s){
 const {document,window}=parseHTML(await readFile(new URL('../submit.html',import.meta.url),'utf8'));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',(o.getAttribute('value')??o.textContent)===v);}});
 const $=id=>document.getElementById(id);
 function prepareForms(){for(const form of document.querySelectorAll('form')){
  Object.defineProperty(form,'elements',{configurable:true,get:()=>Object.fromEntries([...form.querySelectorAll('[name]')].map(n=>[n.name,n]))});
  form.reset=()=>{for(const field of form.querySelectorAll('input,textarea'))field.value='';};
 }}prepareForms();
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};
 const requests=[];
 const globals={document,localStorage:s,location:{href:'https://example.invalid/submit.html',hash:'#pendingHeading'},URL,AbortSignal,Event:window.Event,TextDecoder,Uint8Array,console,setTimeout,
 FormData:class{constructor(form){this.form=form;}*[Symbol.iterator](){for(const field of this.form.querySelectorAll('[name]'))yield [field.name,field.value];}},addEventListener(){},
 fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>({id:'11111111-1111-1111-1111-111111111111',acceptedCount:1,receivedCount:1,status:'pending',questions:[]})};}};
 globals.window=globals;globals.courseContributions={apiOrigin:'https://example.invalid'};
 const context=vm.createContext(globals),cache=new Map();
 async function load(url){url=new URL(url);url.search='';if(!cache.has(url.href))cache.set(url.href,(async()=>{const mod=new vm.SourceTextModule(await readFile(url,'utf8'),{context,identifier:url.href});await mod.link(spec=>load(new URL(spec,url)));return mod;})());return cache.get(url.href);}
 await(await load(new URL('../assets/contributions-submit.js',import.meta.url))).evaluate();prepareForms();
 const fire=(node,type)=>{node.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true}));prepareForms();};
 const pending=()=>$('pendingList').querySelector('form');
 const fill=(name,value)=>{prepareForms();const f=pending();f.elements[name].value=value;fire(f.elements[name],'input');};
 const complete=()=>{fill('unit','scheduling');fill('category','CPU 排程');fill('answer','B');fill('explanation','因為符合題目條件。');};
 return {document,$,pending,fill,complete,fire,requests};
}
test('incomplete drafts survive reload; only completed questions reach the submission API',async()=>{
 const s=storage();stageUnmatched(rows(),{course:'os',unit:'all'},s);let ui=await page(s);
 assert.equal(ui.$('pendingDrafts').hidden,false);assert.equal(ui.$('draftCount').textContent,'0 題');
 ui.fire(ui.pending(),'submit');assert.equal(ui.$('draftCount').textContent,'0 題');assert.equal(readInbox(s).length,7);assert.equal(ui.$('submitBatch').disabled,true);
 ui.complete();ui=await page(s);assert.equal(ui.pending().elements.answer.value,'B');assert.equal(ui.pending().elements.explanation.value,'因為符合題目條件。');
 ui.fire(ui.pending(),'submit');assert.equal(ui.$('draftCount').textContent,'1 題');assert.equal(readInbox(s).length,6);
 const saved=JSON.parse(s.getItem(draftKey));assert.equal(saved.course,'os');assert.equal(saved.unit,'scheduling');assert.deepEqual(saved.questions[0].options,['第二個值','第一個值']);assert.equal(saved.questions[0].answer,'B');
 assert.equal(ui.$('submitBatch').disabled,true);ui.$('consent').checked=true;ui.fire(ui.$('consent'),'change');assert.equal(ui.$('submitBatch').disabled,false);
 ui.fire(ui.$('submitBatch'),'click');await new Promise(resolve=>setImmediate(resolve));const post=ui.requests.find(r=>r.opts?.method==='POST');assert(post);assert.equal(JSON.parse(post.opts.body).questions.length,1);assert.equal(readInbox(s).length,6);assert.equal(ui.$('draftCount').textContent,'0 題');
});
test('existing drafts and unfinished editors in another unit remain intact',async()=>{
 const s=storage();stageUnmatched(rows(1),{course:'os',unit:'scheduling'},s);
 const original={course:'algorithms',unit:'L2',title:'原草稿',questions:[{category:'分析',type:'填空題',stem:'舊題 ____',options:[],answer:'n',explanation:'舊解析',images:[]}],editor:{stem:'編輯中'}};s.setItem(draftKey,JSON.stringify(original));
 const ui=await page(s);ui.complete();ui.fire(ui.pending(),'submit');assert(ui.$('message').textContent.includes('不同科目或單元'));assert.equal(s.getItem(draftKey),JSON.stringify(original));assert.equal(ui.$('questionForm').elements.stem.value,'編輯中');assert.equal(readInbox(s).length,1);
});
test('invalid choice answers stay pending and duplicate additions stay singular',async()=>{
 const s=storage();stageUnmatched(rows(1),{course:'os',unit:'scheduling'},s);const ui=await page(s);ui.complete();ui.fill('answer','Z');ui.fire(ui.pending(),'submit');assert.equal(ui.$('draftCount').textContent,'0 題');assert.equal(readInbox(s).length,1);
 ui.fill('answer','B');ui.fire(ui.pending(),'submit');assert.equal(ui.$('draftCount').textContent,'1 題');stageUnmatched(rows(1),{course:'os',unit:'scheduling'},s);
 const again=await page(s);again.complete();again.fire(again.pending(),'submit');assert.equal(again.$('draftCount').textContent,'1 題');assert.equal(readInbox(s).length,0);
});
test('backup restores into an empty queue, preserves edits, and malformed backup changes nothing',async()=>{
 const s=storage(),saved=storage();stageUnmatched(rows(1),{course:'os',unit:'scheduling'},saved);
 const ui=await page(s);assert.equal(ui.$('pendingDrafts').hidden,true);
 ui.$('pendingFile').files=[{size:100,text:async()=>saved.getItem(INBOX_KEY)}];ui.fire(ui.$('pendingFile'),'change');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(readInbox(s).length,1);assert.equal(ui.$('pendingDrafts').hidden,false);
 ui.fill('answer','B');const original=s.getItem(INBOX_KEY);
 ui.$('pendingFile').files=[{size:100,text:async()=>'{broken'}];ui.fire(ui.$('pendingFile'),'change');await new Promise(resolve=>setImmediate(resolve));assert.equal(s.getItem(INBOX_KEY),original);
 ui.$('pendingFile').files=[{size:100,text:async()=>saved.getItem(INBOX_KEY)}];ui.fire(ui.$('pendingFile'),'change');await new Promise(resolve=>setImmediate(resolve));assert.equal(readInbox(s).length,1);assert.equal(readInbox(s)[0].answer,'B');
});
test('a failed submission-draft save leaves the completed question in the pending queue',async()=>{
 const s=storage();stageUnmatched(rows(1),{course:'os',unit:'scheduling'},s);const ui=await page(s);ui.complete();
 const set=s.setItem;s.setItem=(key,value)=>{if(key===draftKey)throw Error('quota');set(key,value);};
 ui.fire(ui.pending(),'submit');assert.equal(readInbox(s).length,1);assert.equal(s.getItem(draftKey),null);assert(ui.$('message').textContent.includes('無法保存'));
 s.setItem=set;ui.fire(ui.pending(),'submit');assert.equal(readInbox(s).length,0);assert.equal(JSON.parse(s.getItem(draftKey)).questions.length,1);
});
test('question HTML is inert text in the pending editor',async()=>{
 const s=storage(),source=rows(1);source[0].question.stem='</textarea><script id="injected">bad()</script><img id="bad-image" src="x">';stageUnmatched(source,{course:'os',unit:'all'},s);
 const ui=await page(s);assert.equal(ui.document.getElementById('injected'),null);assert.equal(ui.document.getElementById('bad-image'),null);assert.equal(ui.pending().elements.stem.value,source[0].question.stem);
});

test('manual future-unit submission retains chapter metadata through draft reload and sends it to review',async()=>{
 const s=storage();let ui=await page(s);
 ui.$('course').value='algorithms';ui.fire(ui.$('course'),'change');
 ui.$('unit').value='__new__';ui.fire(ui.$('unit'),'change');
 assert.equal(ui.$('newUnitFields').hidden,false);
 ui.$('newUnitNumber').value='7';ui.$('newUnitTitle').value='動態規劃';ui.$('batchTitle').value='第七章投稿';ui.fire(ui.$('newUnitTitle'),'input');
 const form=ui.$('questionForm');form.elements.category.value='最佳化';form.elements.type.value='填空題';form.elements.stem.value='未建立的第七章問題';form.elements.answer.value='answer';form.elements.options.value='';
 ui.fire(form,'submit');assert.equal(ui.$('draftCount').textContent,'1 題',ui.$('message').textContent);
 ui=await page(s);assert.equal(ui.$('newUnitNumber').value,'7');assert.equal(ui.$('newUnitTitle').value,'動態規劃');assert.equal(ui.$('draftCount').textContent,'1 題');
 ui.$('consent').checked=true;ui.fire(ui.$('consent'),'change');ui.fire(ui.$('submitBatch'),'click');await new Promise(resolve=>setImmediate(resolve));
 const post=ui.requests.find(row=>row.opts?.method==='POST');assert(post);const sent=JSON.parse(post.opts.body);assert.equal(sent.unit,'L7');assert.equal(sent.unitTitle,'動態規劃');
});
