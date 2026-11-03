import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createUnitCatalog} from '../assets/unit-catalog.mjs';
import {setupGroupedSubmissions} from '../assets/grouped-submissions.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const store = () => {const values = new Map(); return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};

test('catalog exposes L9 before network, caches future units, ignores corrupt entries and supports unavailable storage', () => {
  const storage = store(), first = createUnitCatalog(storage);
  assert.equal(first.list('os').find(u=>u.id==='L9').name, 'L9 · 記憶體管理');
  assert.equal(first.list('os')[5].id, 'treasure');
  first.update('os', [{id:'L10',title:'虛擬記憶體'}, {id:'__proto__',title:'bad'}]);
  assert.equal(createUnitCatalog(storage).names.os.L10,'L10 · 虛擬記憶體');
  first.update('os',[{id:'L10',title:'虛擬記憶體新版'}]);
  assert.equal(createUnitCatalog(storage).names.os.L10,'L10 · 虛擬記憶體新版');
  assert.equal(Object.getPrototypeOf(first.names.os), Object.prototype);
  storage.setItem('course-library.unit-catalog.v1','bad JSON');
  assert.ok(createUnitCatalog(storage).names.os.L9);
  assert.ok(createUnitCatalog({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}).names.os.L9);
});

test('sync differences count replacements and edits even when the total stays the same', async () => {
  const context = vm.createContext({});vm.runInContext(await read('assets/sync-summary.js'),context);
  const {snapshot,describe} = context.courseSyncSummary;
  const before=snapshot([{id:'one',q:{answer:'A'}},{id:'gone',q:{answer:'B'}}]);
  const after=snapshot([{id:'one',q:{answer:'C'}},{id:'new',q:{answer:'D'}}]);
  assert.equal(describe(before,after),'2 → 2 題（新增 1 題、移除 1 題、更新 1 題）');
  assert.match(describe(before,before),/題目內容無變更/);
  assert.equal(snapshot([{id:'x',q:{a:1,b:2}}]).get('x'),snapshot([{id:'x',q:{b:2,a:1}}]).get('x'));
});

async function themePage(href, storage=store()) {
  const {window,document}=parseHTML('<html><head></head><body><header class="heading"></header><a id="service" href="https://course-library-submissions-yocheng06.yocheng06.chatgpt.site/submit.html?course=os#pendingHeading">投稿</a><a id="other" href="https://example.org/">外站</a><a id="hash" href="#main">跳至內容</a><a id="download" download href="backup.json">下載</a></body></html>');
  const location=new URL(href);
  const context=vm.createContext({window,document,URL,location,localStorage:storage,history:{state:null,replaceState(state,unused,url){location.href=url;}}});
  vm.runInContext(await read('assets/theme.js'),context);
  return {window,document,location,storage};
}
test('theme follows trusted navigation across origins and survives reloading the destination',async()=>{
  const first=await themePage('https://yocheng06.github.io/course-library/os.html?question=test&theme=dark');
  assert.equal(first.document.documentElement.dataset.theme,'dark');
  assert.equal(first.location.search,'?question=test');
  const target=new URL(first.document.getElementById('service').href);
  assert.equal(target.searchParams.get('theme'),'dark');assert.equal(target.searchParams.get('course'),'os');assert.equal(target.hash,'#pendingHeading');
  const second=await themePage(target.href);
  assert.equal(second.document.documentElement.dataset.theme,'dark');
  assert.equal((await themePage(second.location.href,second.storage)).document.documentElement.dataset.theme,'dark');
  first.document.getElementById('themeToggle').click();
  assert.equal(new URL(first.document.getElementById('service').href).searchParams.get('theme'),'light');
  assert.equal(first.document.getElementById('other').getAttribute('href'),'https://example.org/');
  assert.equal(first.document.getElementById('hash').getAttribute('href'),'#main');
  assert.equal(first.document.getElementById('download').getAttribute('href'),'backup.json');
});
test('invalid theme parameters and blocked storage leave the page usable',async()=>{
  const page=await themePage('https://yocheng06.github.io/course-library/os.html?theme=invalid',{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
  assert.equal(page.document.documentElement.dataset.theme,'light');page.document.getElementById('themeToggle').click();assert.equal(page.document.documentElement.dataset.theme,'dark');
});

test('empty imports stay hidden, populated/restored previews appear, and clearing returns to the first step', async()=>{
  const {window,document}=parseHTML('<ol class="flow-steps"><li>選檔</li><li>核對</li><li>公開</li></ol><button id="showHtmlImport" aria-pressed="true"></button><section><h2 id="draftHeading"></h2></section><input id="website">');
  const storage=store();Object.assign(globalThis,{window,document,localStorage:storage});
  window.HTMLElement.prototype.scrollIntoView=()=>{};window.confirm=()=>true;
  const make=()=>setupGroupedSubmissions({parseImport:()=>[{stem:'定義？',type:'填空題',answer:'test',options:[],category:'自訂'}],metadata:()=>({course:'os',unit:'basics',title:'測試匯入'}),onReceipt(){},message(){}});
  const ui=make();assert.equal(document.querySelector('.group-preview').hidden,true);
  await ui.importFiles([{name:'test.json',size:2,text:async()=>''}]);
  assert.equal(document.querySelector('.group-preview').hidden,false);assert.equal(document.querySelector('.flow-steps li[aria-current]').textContent,'核對');
  document.querySelector('.group-preview').remove();make();assert.equal(document.querySelector('.group-preview').hidden,false);
  document.querySelector('[data-clear]').click();assert.equal(document.querySelector('.group-preview').hidden,true);assert.equal(document.querySelector('.flow-steps li[aria-current]').textContent,'選檔');
});

for(const course of ['os','algorithms'])test(course+' toolbar keeps topic/type visible and status in a closed native disclosure; live sync reports actual differences',async()=>{
  const {document}=parseHTML(await read(course+'.html'));
  assert.ok(document.querySelector('.primary-filters select[aria-label="選擇主題"]'));
  assert.ok(document.querySelector('.primary-filters #typeSelect'));
  assert.equal(document.querySelector('.more-filters').hasAttribute('open'),false);
  assert.ok(document.querySelector('.more-filters #qualitySelect'));
  const id='community-00000000-0000-4000-8000-000000000099-1',unit=course==='os'?'basics':'L2';
  const q=course==='os'?{id,stem:'新增同步測試題',answer:'answer',options:[],type:'填空題'}:{bookmarkId:id,q:'新增同步測試題',a:'answer',opts:[],type:'填空題'};
  const data={questions:[],aliases:[],overrides:[]};
  const h=await loadCourse(course,{live:data});h.respond({...data,questions:[{unit,question:q}]});await tick();await tick();
  assert.match(h.document.getElementById('courseSyncStatus').textContent,/新增 1 題/);
});
