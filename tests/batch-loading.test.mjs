import {webcrypto} from 'node:crypto';
import {imageDigest} from '../assets/batch-images.mjs';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { toLibraryQuestion } from "../assets/batch-model.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (questions = []) => ({ ok: true, json: async () => ({ questions }) });
const stem = "CPU 排程器是哪一種類型的排程器？";
const base = {
  schemaVersion: 1,
  courses: {
    os: { units: [{ id: "scheduling", name: "CPU 排程" }] },
    algorithms: { units: [{ id: "L2", name: "基礎與漸進分析" }] },
  },
  entries: [toLibraryQuestion("os", "scheduling", {
    id: "os-test", stem, options: ["A. 短程排程器", "B. 長程排程器"], answer: "A",
  }, true)],
};

async function page(fetch, {storage = new Map()} = {}) {
  const { document, window } = parseHTML(await readFile(new URL("../batch.html", import.meta.url), "utf8"));
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() { return this.querySelector("option[selected]")?.value ?? this.querySelector("option")?.value ?? ""; },
    set(value) { for (const option of this.querySelectorAll("option")) option.toggleAttribute("selected", option.value === value); },
  });
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const copied = [];
  const context = vm.createContext({
    document, window: { courseContributions: { apiOrigin: "https://example.invalid" } },
    location: { href: "https://example.invalid/batch.html" },
    localStorage: { getItem: key => storage.get(key), setItem(key,value) { storage.set(key,value); } }, fetch,
    navigator: { clipboard: { writeText: async (text) => copied.push(text) } },
    URL, AbortSignal, TextDecoder, TextEncoder, Uint8Array, crypto:webcrypto, atob, console, Event: window.Event,
  });
  const modules = new Map();
  async function load(source) {
    const url = new URL(source); url.search = "";
    if (!modules.has(url.href)) modules.set(url.href, (async () => {
      const module = new vm.SourceTextModule(await readFile(url, "utf8"), { context, identifier: url.href });
      await module.link((specifier) => load(new URL(specifier, url)));
      return module;
    })());
    return modules.get(url.href);
  }
  await (await load(new URL("../assets/batch-ui.mjs", import.meta.url))).evaluate();
  await tick();
  const $ = (id) => document.getElementById(id);
  const fire = (id, event) => $(id).dispatchEvent(new window.Event(event, { bubbles: true, cancelable: true }));
  return { $, fire, copied, context };
}

test('a transient bank-image failure retries a fresh CORS download and restored image drafts match',async()=>{
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3sAAAAASUVORK5CYII=','base64');
  const q={number:'1',stem:'[題圖已載入] 表格的平均時間是多少 ____________',type:'填空題',options:[],imageHashes:[await imageDigest(bytes)]};
  const storage=new Map([['course-library.batch-draft.v1',JSON.stringify({course:'os',unit:'scheduling',text:'1. 【填空題】'+q.stem,imageQuestions:[q]})]]);
  let attempts=0;
  const ui=await page(async(url,options)=>{
    if(String(url).startsWith('assets/'))return {ok:true,json:async()=>structuredClone(base)};
    if(String(url).includes('/api/image/')){
      attempts++;assert.equal(options.mode,'cors');assert.equal(options.cache,'reload');
      if(attempts===1)throw new TypeError('cached image lacks CORS permission');
      return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
    }
    return response([{unit:'scheduling',question:{id:'community-00000000-0000-4000-8000-000000000077-1',type:'填空題',stem:'表格的平均時間是多少 ____________',options:[],answer:'8.2',images:[{src:'https://example.invalid/api/image/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/0-0'}]}}]);
  },{storage});
  for(let i=0;i<100&&!storage.has('course-library.questions.v1.os');i++)await tick();
  await tick();ui.fire('batchForm','submit');
  assert.equal(attempts,2);assert.match(ui.$('resultCount').textContent,/已收錄 1・未收錄 0/);assert.match(ui.$('resultRows').textContent,/8.2/);
});

test("built-in lookup and copying work while public sync waits, then new data invalidates old results", async () => {
  const pending = [];
  const ui = await page(async (url) => String(url).startsWith("assets/")
    ? { ok: true, json: async () => base }
    : new Promise((resolve) => pending.push(resolve)));
  assert.equal(pending.length, 1);
  assert.equal(ui.$("compare").disabled, false);
  assert.equal(ui.$("reloadLibrary").disabled, true);
  assert.match(ui.$("libraryStatus").textContent, /可先使用已載入題庫/);
  ui.$("batchText").value = `1. ${stem}\nA. 短程排程器\nB. 長程排程器\n\n2. 新增的公開投稿題目？\nA. verified-answer\nB. other-answer`;
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert.equal(ui.$("copyAnswers").disabled, false);
  assert.equal(ui.$("transferUnmatched").disabled, false);
  ui.fire("copyAnswers", "click"); await tick();
  assert.equal(ui.copied.length, 1);
  assert.match(ui.copied[0], /僅比對內建題庫/);
  pending[0](response([{ unit: "scheduling", question: {
    id: "community-00000000-0000-4000-8000-000000000001-1",
    stem: "新增的公開投稿題目？", options: ["A. verified-answer", "B. other-answer"], answer: "A", answerProvided: true,
  } }]));
  await tick();
  assert.equal(ui.$("compare").disabled, false);
  assert.equal(ui.$("reloadLibrary").disabled, false);
  assert.equal(ui.$("staleNotice").hidden, false);
  assert.equal(ui.$("copyAnswers").disabled, true);
  assert.equal(ui.$("transferUnmatched").disabled, true);
  // Programmatic stale actions must obey the same guards as disabled buttons.
  ui.fire("copyAnswers", "click"); ui.fire("transferUnmatched", "click"); await tick();
  assert.equal(ui.copied.length, 1);
  assert.equal(ui.context.location.href, "https://example.invalid/batch.html");
  ui.fire("batchForm", "submit");
  assert.equal(ui.$("staleNotice").hidden, true);
  assert(ui.$("resultRows").textContent.includes("verified-answer"));
  assert.equal(ui.$("coverageNotice").hidden, true);
});

test("public failures retain built-in results and concurrent reloads do not start extra requests", async () => {
  const pending = []; let requests = 0;
  const ui = await page(async (url) => {
    requests++;
    return String(url).startsWith("assets/")
      ? { ok: true, json: async () => base }
      : new Promise((resolve, reject) => pending.push({ resolve, reject }));
  });
  ui.fire("reloadLibrary", "click"); await tick();
  assert.equal(requests, 2);
  ui.$("batchText").value = `1. ${stem}\nA. 短程排程器\nB. 長程排程器`;
  ui.fire("batchForm", "submit");
  pending.forEach(({ reject }) => reject(new Error("offline"))); await tick();
  assert.equal(ui.$("compare").disabled, false);
  assert.equal(ui.$("reloadLibrary").disabled, false);
  assert.equal(ui.$("staleNotice").hidden, true);
  assert.equal(ui.$("copyAnswers").disabled, false);
  assert.match(ui.$("libraryStatus").textContent, /目前僅比對隨站內建版本/);
  assert.equal(ui.$("coverageNotice").hidden, false);
});

for (const [name, malformed] of [
  ["options", { options: "ab", optionTranslations: ["x", "y"] }],
  ["conditions", { answerConditions: { unexpected: true } }],
]) test(`malformed public ${name} discard only that course and leave built-in lookup usable`, async () => {
  const question = {
    id: "community-00000000-0000-4000-8000-000000000002-1",
    stem: "不完整的公開題目？", options: ["A. public-answer", "B. other-answer"], answer: "A",
  };
  const beforeMalformed = { ...question, id: "community-00000000-0000-4000-8000-000000000003-1", stem: "同科目尚未完成驗證的題目？" };
  const otherCourse = { ...question, id: "community-00000000-0000-4000-8000-000000000004-1", stem: "另一科的完整公開題目？" };
  const ui = await page(async (url) => String(url).startsWith("assets/")
    ? { ok: true, json: async () => base }
    : String(url).endsWith("course=os")
      ? response([
          { unit: "scheduling", question: beforeMalformed },
          { unit: "scheduling", question: { ...question, ...malformed } },
        ])
      : response([{ unit: "L2", question: otherCourse }]));
  assert.equal(ui.$("compare").disabled, false);
  assert.match(ui.$("libraryStatus").textContent, /作業系統：1 題/);
  assert.match(ui.$("libraryStatus").textContent, /線上題庫資料不完整/);
  ui.$("batchText").value = `1. ${stem}\nA. 短程排程器\nB. 長程排程器`;
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert.equal(ui.$("coverageNotice").hidden, false);
  assert.equal(ui.$("copyAnswers").disabled, false);

  ui.$("course").value = "algorithms"; ui.fire("course", "change"); await tick();
  assert.match(ui.$("libraryStatus").textContent, /演算法：1 題/);
  assert.match(ui.$("libraryStatus").textContent, /已同步內建題修改與公開投稿/);
  ui.$("batchText").value = `1. ${otherCourse.stem}\nA. public-answer\nB. other-answer`;
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. public-answer"));
  assert.equal(ui.$("coverageNotice").hidden, true);
});

test('approved questions from future units join lookup and unit selection instead of invalidating public coverage',async()=>{
 const pending=[];const ui=await page(async url=>String(url).startsWith('assets/')?{ok:true,json:async()=>base}:new Promise(resolve=>pending.push(resolve)));
 pending[0](response([{unit:'L9',question:{id:'community-00000000-0000-4000-8000-000000000099-1',unitTitle:'新章節',stem:'第九章公開投稿題目？',options:['A. verified-answer','B. other-answer'],answer:'A',answerProvided:true}}]));await tick();
 assert([...ui.$('unit').options].some(option=>option.value==='L9'));
 ui.$('batchText').value='1. 第九章公開投稿題目？\nA. verified-answer\nB. other-answer';ui.fire('batchForm','submit');
 assert.match(ui.$('resultRows').textContent,/verified-answer/);assert.doesNotMatch(ui.$('libraryStatus').textContent,/不完整/);
});

test('online built-in edits replace static answers, stale results cannot copy, and reset restores base answers',async()=>{
 let edited=true;
 const ui=await page(async url=>String(url).startsWith('assets/')?{ok:true,json:async()=>structuredClone(base)}:{ok:true,json:async()=>({questions:[],overrides:String(url).endsWith('course=os')&&edited?[{unit:'scheduling',question:{id:'os-test',stem,options:['A. 短程排程器','B. 長程排程器'],answer:'B',choiceKey:'B',answerProvided:true}}]:[]})});
 ui.$('batchText').value=`1. ${stem}\nA. 短程排程器\nB. 長程排程器`;ui.fire('batchForm','submit');
 assert.ok(ui.$('resultRows').textContent.includes('B. 長程排程器'));
 ui.fire('copyAnswers','click');await tick();assert.match(ui.copied[0],/B\. 長程排程器/);
 edited=false;ui.fire('reloadLibrary','click');await tick();assert.equal(ui.$('copyAnswers').disabled,true);
 ui.fire('batchForm','submit');assert.ok(ui.$('resultRows').textContent.includes('A. 短程排程器'));
});

test('an incorporated community question uses its built-in edit instead of an old publication with the same ID',async()=>{
 const communityId='community-00000000-0000-4000-8000-000000000009-1';
 const old={id:communityId,stem,options:['A. 短程排程器','B. 長程排程器'],answer:'A',answerProvided:true};
 const builtin={...old,answer:'B',choiceKey:'B'};
 const localBase=structuredClone(base);localBase.entries=[toLibraryQuestion('os','scheduling',old,true)];
 const ui=await page(async url=>String(url).startsWith('assets/')?{ok:true,json:async()=>localBase}:{ok:true,json:async()=>({questions:String(url).endsWith('course=os')?[{unit:'scheduling',question:old}]:[],overrides:String(url).endsWith('course=os')?[{unit:'scheduling',question:builtin}]:[]})});
 ui.$('batchText').value=`1. ${stem}\nA. 短程排程器\nB. 長程排程器`;ui.fire('batchForm','submit');
 assert.ok(ui.$('resultRows').textContent.includes('B. 長程排程器'));assert.match(ui.$('resultCount').textContent,/已收錄 1・未收錄 0/);
});

test('course sync is lazy, revisiting a fresh course reuses data, and a 304 keeps verified results usable',async()=>{
  const requests = [], tag = '"revision-one"';
  let osReads = 0;
  const ui = await page(async (url, options) => {
    requests.push({url:String(url),options});
    if (String(url).startsWith('assets/')) return {ok:true,json:async()=>structuredClone(base)};
    if (String(url).endsWith('course=os') && ++osReads > 1) return {status:304,ok:false};
    return {ok:true,headers:{get:name=>name==='etag'?tag:null},json:async()=>({questions:[],overrides:[],aliases:[]})};
  });
  assert.equal(requests.filter(r=>r.url.includes('course=algorithms')).length,0);
  ui.$('batchText').value=`1. ${stem}\nA. 短程排程器\nB. 長程排程器`;
  ui.fire('batchForm','submit');
  assert.equal(ui.$('copyAnswers').disabled,false);
  ui.fire('reloadLibrary','click'); await tick();
  assert.equal(requests.filter(r=>r.url.startsWith('assets/')).length,1);
  assert.equal(requests.at(-1).options.headers['If-None-Match'],tag);
  assert.equal(ui.$('copyAnswers').disabled,false);
  assert.equal(ui.$('staleNotice').hidden,true);
  ui.$('course').value='algorithms'; ui.fire('course','change'); await tick();
  assert.equal(requests.filter(r=>r.url.includes('course=algorithms')).length,1);
  ui.$('course').value='os'; ui.fire('course','change'); await tick();
  assert.equal(osReads,2);
});

for(const source of ['static','public','cache'])test('L9 uses the shared memory-management name from '+source,async()=>{
 const localBase=structuredClone(base);
 if(source==='static')localBase.courses.os.units.push({id:'L9',name:'L9 · 第 9 單元'});
 const questions=[{unit:'L9',question:{id:'community-00000000-0000-4000-8000-000000000099-1',unitTitle:'第 9 單元',stem:'記憶體測試題',options:[],answer:'test'}}];
 const storage=new Map();
 if(source==='cache')storage.set('course-library.questions.v1.os',JSON.stringify({schema:1,course:'os',generatedAt:new Date().toISOString(),data:{questions,overrides:[]}}));
 const ui=await page(async url=>String(url).startsWith('assets/')?{ok:true,json:async()=>localBase}:source==='cache'?new Promise(()=>{}):response(source==='public'?questions:[]),{storage});
 await tick();
 const option=[...ui.$('unit').options].find(o=>o.value==='L9');
 assert.ok(option);assert.equal(option.textContent,'L9 · 記憶體管理');
});

test('binary lookup counts, filters, copies and stages incomplete matches without carrying a guessed answer',async()=>{
 const storage=new Map();const ui=await page(async url=>String(url).startsWith('assets/')?{ok:true,json:async()=>structuredClone(base)}:response([]),{storage});await tick();
 ui.$('batchText').value='1. '+stem+'\nA. 短程排程器\nB. 長程排程器\n\n2. '+stem+'\nA. 短程排程器\nB. 不同選項\n\n3. 未知測試題目？\nA. 第一選項\nB. 第二選項';
 ui.fire('batchForm','submit');assert.match(ui.$('resultCount').textContent,/已收錄 1・未收錄 2/);assert.doesNotMatch(ui.$('resultCount').textContent,/需確認|待核對/);
 assert.deepEqual([...ui.$('resultFilter').options].map(o=>o.value),['all','matched','unmatched']);
 ui.$('resultFilter').value='unmatched';ui.fire('resultFilter','change');assert.equal(ui.$('resultRows').querySelectorAll('tr').length,2);assert.match(ui.$('resultRows').textContent,/選項不同/);assert.equal(ui.$('resultRows').querySelectorAll('.source-links a').length,1);
 ui.fire('copyAnswers','click');await tick();assert.match(ui.copied[0],/2｜尚無可確認答案｜未收錄/);assert.doesNotMatch(ui.copied[0],/需確認|待核對/);
 ui.fire('transferUnmatched','click');const draft=JSON.parse(storage.get('course-library.submission-inbox.v1'));assert.equal(draft.items.length,2);assert.ok(draft.items.every(q=>q.answer===''));assert.equal(draft.items[0].optionsText,'短程排程器\n不同選項');
});

test('treasure is selectable before any import and its public questions are searchable in that scope',async()=>{
 const local=structuredClone(base);local.courses.os.units.push({id:'treasure',name:'挖寶單元'});
 const ui=await page(async url=>String(url).startsWith('assets/')?{ok:true,json:async()=>local}:response([{unit:'treasure',question:{id:'community-00000000-0000-4000-8000-000000000088-1',stem:'挖寶測試題目？',options:['Alpha','Beta'],answer:'A',answerProvided:true}}]));await tick();
 assert.equal([...ui.$('unit').options].find(o=>o.value==='treasure').textContent,'挖寶單元');ui.$('unit').value='treasure';ui.fire('unit','change');ui.$('batchText').value='1. 挖寶測試題目？\nA. Alpha\nB. Beta';ui.fire('batchForm','submit');assert.match(ui.$('resultCount').textContent,/已收錄 1・未收錄 0/);assert.match(ui.$('resultRows').textContent,/A. Alpha/);
});
