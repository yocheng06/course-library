import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const source=await readFile(new URL('../assets/question-corrections.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function page({id='basics-1',course='os',server,shown,failPost=false,storage=new Map(),session=new Map(),conflict=false}={}) {
 const {document,window}=parseHTML('<html><body><div id="cards"><article><button data-correction="'+id+'">修改題目</button></article></div></body></html>');
 window.confirm=()=>true;
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.textContent||this.querySelector('option')?.textContent||''},set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',option.textContent===value)}});
 const requests=[],deletions=[];let online=0;
 window.addEventListener('course-question-deleted',event=>deletions.push(event.detail));
 window.courseLearning={course,list:document.getElementById('cards'),questionDetails:()=>({unit:'測試單元',number:1}),questionForEdit:()=>shown};
 window.courseContributions={apiOrigin:'https://example.com'};
 window.addEventListener('online',()=>online++);
 const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},crypto:globalThis.crypto,document,window,URL,URLSearchParams,AbortSignal,Event:window.Event,Blob,setTimeout,fetch:async(url,opts={})=>{
  requests.push({url,opts});if(conflict&&opts.method==='POST'){server.revision++;server.sourceHash='new-hash';server.question={...server.question,stem:'其他人的新題目',explanation:'<img src=x onerror=alert(1)>'};return {ok:false,status:409,json:async()=>({error:'版本衝突'})};}if(failPost&&opts.method==='POST')return {ok:false,json:async()=>({error:'Conflict'})};return {ok:true,json:async()=>opts.method==='POST'&&JSON.parse(opts.body).action==='request-delete'?{queued:true}:{item:structuredClone(server)}};
 }});
 vm.runInContext(source,context);
 const dialog=document.querySelector('dialog'),form=dialog.querySelector('form');
 Object.defineProperty(form,'elements',{get:()=>Object.fromEntries([...form.querySelectorAll('[name]')].map(node=>[node.name,node]))});
 dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');form.reportValidity=()=>true;
 const fire=(node,event)=>node.dispatchEvent(new window.Event(event,{bubbles:true,cancelable:true}));
 const open=async()=>{fire(document.querySelector('[data-correction]'),'click');await tick();};
 await open();
 return {document,form,requests,open,fire,deletions,online:()=>online};
}
const question={category:'分類',type:'填空題',stem:'The value is ___.',options:[],answer:'base',explanation:'解析',images:[],translation:'',optionTranslations:[],answerProvided:true,note:''};
test('both courses expose the original-question editor and save through the versioned public endpoint',async()=>{
 for(const course of ['os','algorithms']){
  const server={id:'sample-1',unit:'L2',revision:2,sourceHash:'hash',question};
  const ui=await page({id:server.id,course,server});
  assert.match(ui.requests[0].url,new RegExp('/api/community/builtin-questions/'+course+'/sample-1$'));
  assert.equal(ui.form.elements.stem.value,question.stem);
  ui.form.elements.explanation.value='直接修正後的解析';ui.fire(ui.form,'submit');await tick();
  const body=JSON.parse(ui.requests.find(r=>r.opts.method==='POST').opts.body);
  assert.equal(body.revision,2);assert.equal(body.sourceHash,'hash');assert.equal(body.action,'update');assert.equal(body.question.explanation,'直接修正後的解析');
  assert.equal(body.question.stem,question.stem);assert.equal(ui.online(),1);
 }
});
test('removal controls submit suggestions for either question type',async()=>{
 for(const {id,course,server} of [
  {id:'sample-1',course:'os',server:{id:'sample-1',unit:'L2',revision:4,sourceHash:'hash',question}},
  {id:'community-11111111-1111-4111-8111-111111111111-1',course:'os',server:{revision:3,unit:'L9',unitTitle:'第9單元',question}},
 ]){
  const ui=await page({id,course,server});
  const button=ui.document.querySelector('[data-delete-question]');
  assert.equal(button.hidden,false);
  ui.fire(button,'click');await tick();
  const request=ui.requests.find(r=>r.opts.method==='POST');
  const body=JSON.parse(request.opts.body);
  assert.match(request.url,/\/api\/community\/(builtin-questions|questions)\//);
  assert.equal(body.action,'request-delete');
  assert.equal(body.revision,server.revision);
  if(server.sourceHash)assert.equal(body.sourceHash,server.sourceHash);
  assert.match(ui.document.querySelector('[data-status]').textContent,/送交站主審核/);
  assert.equal(ui.online(),0);
 }
});
test('community editor retains source-checked display blanks and explanation, but never overwrites a newer server version',async()=>{
 const raw={...question,category:'HTML 匯入',stem:'在頁表中，每筆對應一個物理。',explanation:''};
 const editSource=Object.fromEntries(['category','type','stem','options','answer','explanation'].map(k=>[k,raw[k]]));
 const shown={...raw,category:'頁表結構',stem:'在 ____________ 頁表中，每筆對應一個物理 ____________ 。',explanation:'原檔核對後的解析',editSource};
 const id='community-11111111-1111-4111-8111-111111111111-1',server={revision:1,unit:'L9',unitTitle:'第9單元',question:raw};
 const ui=await page({id,server,shown});
 assert.equal(ui.form.elements.stem.value,shown.stem);assert.equal(ui.form.elements.explanation.value,shown.explanation);
 ui.fire(ui.form,'submit');await tick();
 const body=JSON.parse(ui.requests.find(r=>r.opts.method==='POST').opts.body);
 assert.equal(body.payload.questions[0].stem,shown.stem);assert.equal(body.payload.questions[0].explanation,shown.explanation);
 const newer=await page({id,shown,server:{...server,revision:2,question:{...raw,stem:'別人已修改的新題目'}}});
 assert.equal(newer.form.elements.stem.value,'別人已修改的新題目');
});
test('a stale local draft is not reapplied over the latest server revision',async()=>{
 const server={id:'sample-1',unit:'L2',revision:1,sourceHash:'hash',question:{...question}};
 const ui=await page({id:server.id,server});
 ui.form.elements.stem.value='尚未儲存的草稿';ui.fire(ui.form,'input');
 server.revision=2;server.question.stem='其他人已儲存的新版';await ui.open();
 assert.equal(ui.form.elements.stem.value,server.question.stem);
 assert.equal(ui.document.querySelector('[data-download-draft]').hidden,false);
});


test('removal suggestions never remove the question from the page',async()=>{
 const shown={...question,id:'sample-1'},server={id:'sample-1',unit:'basics',revision:4,sourceHash:'hash',question};
 for(const failPost of [false,true]){
  const ui=await page({id:shown.id,server,shown,failPost});
  ui.fire(ui.document.querySelector('[data-delete-question]'),'click');await tick();
  assert.equal(ui.deletions.length,0);
  if(!failPost){assert.equal(JSON.parse(ui.requests.at(-1).opts.body).action,'request-delete');assert.match(ui.document.querySelector('[data-status]').textContent,/送交站主審核/);}
  else assert.match(ui.document.querySelector('[data-status]').textContent,/未能送出/);
 }
});

test('question notes are visible and editable for both built-in and imported questions, including explicit clearing',async()=>{
 for(const course of ['os','algorithms'])for(const imported of [false,true]){
  const id=imported?'community-11111111-1111-4111-8111-111111111111-1':'sample-1';
  const server={id,unit:'L2',unitTitle:'',revision:2,sourceHash:'hash',question:{...question,note:'原有題目備註'}};
  for(const next of ['修改後的備註','']){
   const ui=await page({id,course,server});
   const input=ui.form.elements.questionNote;
   assert.equal(input.value,'原有題目備註');
   assert.equal(Boolean(input.closest('[data-builtin-fields]')),false);
   input.value=next;ui.fire(ui.form,'input');await ui.open();
   assert.equal(ui.form.elements.questionNote.value,next);
   ui.fire(ui.form,'submit');await tick();
   const body=JSON.parse(ui.requests.find(r=>r.opts.method==='POST').opts.body);
   assert.equal((imported?body.payload.questions[0]:body.question).note,next);
   assert.equal(body.note,'');
  }
 }
});


test('reader conflict compares both versions, retains draft on reload and requires the latest revision before saving',async()=>{
 for(const id of ['sample-1','community-11111111-1111-4111-8111-111111111111-1']){
  const server={id,unit:'L2',revision:1,sourceHash:'old-hash',question:{...question}},storage=new Map(),session=new Map();
  const ui=await page({id,server,storage,session,conflict:true});
  ui.form.elements.stem.value='我的草稿';ui.fire(ui.form,'input');ui.fire(ui.form,'submit');await tick();await tick();
  const section=ui.document.querySelector('[data-conflict]');
  assert.equal(section.hidden,false);assert.match(section.textContent,/我的草稿/);assert.match(section.textContent,/其他人的新題目/);
  assert.equal(section.querySelector('img'),null);assert.equal(ui.form.elements.stem.value,'我的草稿');
  assert.equal(ui.form.querySelector('[type="submit"]').disabled,true);
  ui.fire(ui.form,'submit');await tick();assert.equal(ui.requests.filter(r=>r.opts.method==='POST').length,1);
  const reload=await page({id,server,storage,session});
  assert.equal(reload.document.querySelector('[data-conflict]').hidden,false);
  assert.match(reload.document.querySelector('[data-conflict]').textContent,/我的草稿/);
  reload.fire(reload.document.querySelector('[data-conflict-latest]'),'click');
  reload.form.elements.explanation.value='手動合併';reload.fire(reload.form,'input');reload.fire(reload.form,'submit');await tick();
  const saved=JSON.parse(reload.requests.find(r=>r.opts.method==='POST').opts.body);assert.equal(saved.revision,2);
  if(id==='sample-1')assert.equal(saved.sourceHash,'new-hash');
  assert.equal(new Map(JSON.parse([...storage.values()].find(v=>v.startsWith('['))||'[]')).size,0);
 }
});
test('reader drafts survive reload, isolate two tabs and detect source changes even at the same revision',async()=>{
 const server={unit:'L2',revision:0,sourceHash:'hash',question:{...question}},storage=new Map(),session=new Map();
 const ui=await page({server,storage,session});ui.form.elements.answer.value='我的未送出答案';ui.fire(ui.form,'input');
 const reload=await page({server,storage,session});assert.equal(reload.form.elements.answer.value,'我的未送出答案');
 const other=await page({server,storage,session:new Map()});assert.equal(other.form.elements.answer.value,question.answer);
 server.sourceHash='changed';const newer=await page({server,storage,session});assert.equal(newer.document.querySelector('[data-conflict]').hidden,false);
});
