import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from '../../node_modules/linkedom/esm/index.js';
import { setupImportRecords } from '../frontend/assets/import-records.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const question = (number = 1) => ({ category:'測試', type:'單選題', stem:`保留原始題目 ${number}？`, options:['A. 正確','B. 其他'], answer:'A', explanation:'測試解析', images:[] });
const entry = (status = 'approved') => ({ id:'00000000-0000-4000-8000-000000000001', revision:1, status, createdAt:1, payload:{course:'os',unit:'basics',title:'測試匯入',questions:[question(1),question(2)],source:'測試資料'}, publications:[{id:'community-00000000-0000-4000-8000-000000000001-1',questionNumber:1,revision:2,published:true},{id:'community-00000000-0000-4000-8000-000000000001-2',questionNumber:2,revision:3,published:false}] });
function setup(api, saved = new Map()) {
  const { document, window } = parseHTML('<main><section id="importWorkspace"></section></main>');
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const option=this.querySelector('option[selected]') || this.querySelector('option');return option?.getAttribute('value') ?? option?.textContent ?? '';},set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',(option.getAttribute('value') ?? option.textContent)===value);}});
  globalThis.document = document; globalThis.window = window; window.confirm = () => true;
  globalThis.localStorage = {getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
  window.HTMLElement.prototype.focus = function() {};
  const messages=[], changed=[];
  const ui=setupImportRecords({container:document.getElementById('importWorkspace'),userId:'test',api,message:(...args)=>messages.push(args),onChanged:change=>changed.push(change)});
  const fire=(node,type)=>node.dispatchEvent(new window.Event(type,{bubbles:true}));
  const toggle=(node,open=true)=>{node.toggleAttribute('open',open);fire(node,'toggle');};
  return {ui,document,window,fire,toggle,messages,changed,saved,$:selector=>document.querySelector(selector)};
}

test('records and question content are created only when opened; revisiting uses session cache',async()=>{
  let calls=0;const item=entry();item.payload.questions[0].images=['https://example.invalid/diagram.png'];
  const h=setup(async()=>{calls++;return {items:[item],nextCursor:null};});await h.ui.show();
  assert.equal(h.document.querySelectorAll('textarea').length,0);
  assert.equal(h.document.querySelectorAll('img').length,0);
  h.toggle(h.$('.import-record'));
  assert.equal(h.document.querySelectorAll('textarea').length,0);
  assert.equal(h.document.querySelectorAll('img').length,0);
  h.toggle(h.$('[data-question-index="0"]'));
  assert.equal(h.document.querySelectorAll('img').length,1);
  h.toggle(h.$('[data-question-index="0"]'),false);
  assert.equal(h.document.querySelectorAll('img').length,0);
  await h.ui.show();assert.equal(calls,1);h.ui.clear();
});

test('import lists request lightweight summaries and fetch a single batch on expansion',async()=>{
  const full=entry();
  const summary={id:full.id,status:full.status,revision:full.revision,createdAt:full.createdAt,course:'os',unit:'basics',title:'測試匯入',questionCount:2,publications:full.publications};
  const calls=[];
  const h=setup(async(path)=>{calls.push(path);return path.includes('/api/manage/imports/')?{item:full}:{items:[summary],nextCursor:null};});
  await h.ui.show();
  assert.match(calls[0],/\/api\/manage\/imports\?status=approved/);
  assert.equal(h.document.querySelectorAll('.import-record').length,1);
  assert.equal(h.document.querySelectorAll('textarea').length,0);
  assert.equal(calls.length,1);
  h.toggle(h.$('.import-record'));await tick();
  assert.equal(calls.length,2);assert.match(calls[1],new RegExp('/api/manage/imports/'+full.id+'$'));
  assert.equal(h.document.querySelectorAll('textarea').length,0);
  h.ui.clear();
});

test('bulk visibility sends only eligible revisions and updates the expanded record without reloading',async()=>{
  const calls=[];const h=setup(async(path,options)=>{calls.push({path,options});return options?.method==='POST'?{changedCount:1}:{items:[entry()],nextCursor:null};});
  await h.ui.show();h.toggle(h.$('.import-record'));
  h.fire(h.$('[data-publication-action="hide-all"]'),'click');await tick();
  assert.equal(calls.length,2);
  const body=JSON.parse(calls[1].options.body);
  assert.deepEqual(body,{action:'hide',questions:[{id:'community-00000000-0000-4000-8000-000000000001-1',revision:2}]});
  assert.match(h.$('.approved-publications').textContent,/公開中 0 題 · 已移除 2 題/);
  await h.ui.show();assert.equal(calls.length,2);
  assert.equal(h.changed.length,1);h.ui.clear();
});

test('pending question edits survive collapsed lazy fields and are included on approval',async()=>{
  const calls=[];const h=setup(async(path,options)=>{calls.push({path,options});if(options?.method==='POST')return {acceptedCount:2,skippedCount:0};return {items:path.includes('pending')?[entry('pending')]:[],nextCursor:null};});
  await h.ui.show();h.$('[data-import-status]').value='pending';h.fire(h.$('[data-import-status]'),'change');await tick();
  h.toggle(h.$('.import-record'));assert.equal(h.document.querySelectorAll('[data-field]').length,0);
  const row=h.$('[data-question-index="0"]');h.toggle(row);
  const stem=row.querySelector('[data-field="stem"]');stem.value='保留空格 ____________ 及原始文字。';h.fire(stem,'input');h.toggle(row,false);
  assert.equal(h.document.querySelectorAll('[data-field]').length,0);
  h.fire(h.$('[data-import-decision="approve"]'),'click');await tick();
  const post=calls.find(call=>call.options?.method==='POST');assert.ok(post);
  const payload=JSON.parse(post.options.body).payload;
  assert.equal(payload.questions.length,2);assert.equal(payload.questions[0].stem,'保留空格 ____________ 及原始文字。');assert.equal(payload.questions[1].stem,question(2).stem);
  assert.equal(h.document.querySelectorAll('.import-record').length,0);h.ui.clear();
});

test('failed pending approval retains the editable draft and clear removes listeners for reuse',async()=>{
  const h=setup(async(path,options)=>{if(options?.method==='POST')throw new Error('連線中斷');return {items:path.includes('pending')?[entry('pending')]:[],nextCursor:null};});
  await h.ui.show();h.$('[data-import-status]').value='pending';h.fire(h.$('[data-import-status]'),'change');await tick();h.toggle(h.$('.import-record'));h.toggle(h.$('[data-question-index="0"]'));
  const field=h.$('[data-field="explanation"]');field.value='新增的解析仍保留';h.fire(field,'input');h.fire(h.$('[data-import-decision="approve"]'),'click');await tick();
  assert.match(h.messages.at(-1)[0],/草稿仍保留/);assert.equal(field.value,'新增的解析仍保留');assert.equal(field.disabled,false);
  h.ui.clear();assert.equal(h.document.querySelectorAll('.import-record').length,0);
  const stored=JSON.parse(h.saved.get('course-library.import-review-drafts.v2.test'));assert.equal(stored[entry().id].questionEdits[0].explanation,'新增的解析仍保留');
});

test('legacy pending drafts are restored safely and discarded drafts do not return on the next session',async()=>{
  const item=entry('pending');
  const saved=new Map([['course-library-review-drafts-v1.test',JSON.stringify({['review:'+item.id]:{revision:1,batch:{course:'os',unit:'basics',title:'保留舊草稿',source:''},questions:[{index:0,values:{stem:'舊版未送出的原始填空 ____________',answer:'A'},keep:[]},{index:1,values:{},keep:[]}],note:'未送出的說明'},'manage:other':{revision:9}})]]);
  const api=async path=>({items:path.includes('pending')?[item]:[],nextCursor:null});
  const h=setup(api,saved);await h.ui.show();h.$('[data-import-status]').value='pending';h.fire(h.$('[data-import-status]'),'change');await tick();h.toggle(h.$('.import-record'));h.toggle(h.$('[data-question-index="0"]'));
  assert.equal(h.$('[data-field="stem"]').value,'舊版未送出的原始填空 ____________');
  h.fire(h.$('[data-import-discard]'),'click');
  assert.equal(JSON.parse(saved.get('course-library-review-drafts-v1.test'))['review:'+item.id],undefined);
  assert.deepEqual(JSON.parse(saved.get('course-library-review-drafts-v1.test'))['manage:other'],{revision:9});h.ui.clear();
  const next=setup(api,saved);await next.ui.show();next.$('[data-import-status]').value='pending';next.fire(next.$('[data-import-status]'),'change');await tick();next.toggle(next.$('.import-record'));next.toggle(next.$('[data-question-index="0"]'));
  assert.equal(next.$('[data-field="stem"]').value,item.payload.questions[0].stem);next.ui.clear();
});

test('stale list responses never replace the selected status and clear aborts outstanding reads',async()=>{
  const pending=[];const h=setup((path,options)=>new Promise(resolve=>pending.push({path,options,resolve})));
  const first=h.ui.show();h.$('[data-import-status]').value='pending';h.fire(h.$('[data-import-status]'),'change');
  pending[1].resolve({items:[entry('pending')],nextCursor:null});await tick();pending[0].resolve({items:[entry('approved')],nextCursor:null});await first;
  assert.match(h.$('[data-import-count]').textContent,/舊版待審/);assert.ok(h.$('[data-import-decision="approve"]')===null);h.toggle(h.$('.import-record'));assert.ok(h.$('[data-import-decision="approve"]'));
  h.fire(h.$('[data-import-refresh]'),'click');h.ui.clear();assert.equal(pending[2].options.signal.aborted,true);pending[2].resolve({items:[entry('pending')],nextCursor:null});await tick();assert.equal(h.$('.import-record'),null);
});
