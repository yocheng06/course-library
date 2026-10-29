import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const key = course => 'course-library.questions.v1.' + course;
const tick = () => new Promise(resolve => setImmediate(resolve));
const empty = () => ({questions:[], aliases:[], overrides:[]});
const id = n => `community-11111111-1111-4111-8111-111111111111-${n}`;
const question = (course,n,stem='測試題目 ___') => course === 'os'
  ? {id:id(n),stem,options:[],answer:'base',explanation:'測試解析',type:'填空題',category:'測試',images:[]}
  : {bookmarkId:id(n),q:stem,opts:[],a:'base',ex:'測試解析',type:'填空題',category:'測試',images:[]};
const row = (course,n,unit=course==='os'?'L9':'L7',stem) => ({unit,question:question(course,n,stem)});
const response = data => ({ok:true,headers:{get:()=>new Date().toUTCString()},json:async()=>data});

async function page(course, {storage=new Map(), online=true, search='', failStorage=false}={}) {
  const {window,document}=parseHTML(await read(course==='os'?'os.html':'algorithms.html'));
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},
    set(value){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(value));}
  });
  window.window=window;
  window.HTMLElement.prototype.focus=function(){};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.HTMLElement.prototype.getBoundingClientRect=()=>({top:0,bottom:0});
  window.scrollTo=()=>{};
  window.courseContributions={apiOrigin:'https://example.com'};
  const context=vm.createContext({window,document,location:{search,protocol:'https:'},URLSearchParams,
    navigator:{onLine:online},AbortSignal,Date,console,requestAnimationFrame:fn=>fn(),scrollX:0,scrollY:0,innerHeight:900,
    CSS:{escape:s=>String(s)},localStorage:{getItem:k=>{if(failStorage)throw Error('blocked');return storage.get(k);},setItem:(k,v)=>{if(failStorage)throw Error('quota');storage.set(k,v);}}
  });
  for(const name of ['assets/question-tools.js','assets/choice-answers.js','assets/practice-feedback.js',`assets/${course==='os'?'os':'algorithms'}-learning.js`])vm.runInContext(await read(name),context);
  const config=window.courseLearning, snapshot=JSON.parse(document.getElementById('course-community-snapshot').textContent);
  const bootstrap=await read('assets/course-bootstrap.js');
  const pending=[];
  context.fetch=()=>new Promise(resolve=>pending.push(resolve));
  const boot=()=>vm.runInContext(bootstrap,context);
  const complete=async data=>{pending.shift()(response(data));await tick();};
  return {course,window,document,config,context,storage,snapshot,boot,complete,pending,
    source:()=>document.documentElement.dataset.questionSource,
    notice:()=>document.querySelector('.api-notice')?.textContent,
    fire:(selector,event='click')=>document.querySelector(selector).dispatchEvent(new window.Event(event,{bubbles:true}))};
}
function cache(h,data,generatedAt=new Date(Date.now()+1000).toISOString()) {
  h.storage.set(key(h.course),JSON.stringify({schema:1,course:h.course,generatedAt,data}));
}

test('both HTML pages contain the exact committed public snapshot and a safe JSON script',async()=>{
  for(const course of ['os','algorithms']){
    const h=await page(course);
    assert.deepEqual(h.snapshot,JSON.parse(await read(`assets/course-snapshots/${course}.json`)));
    assert.equal(h.snapshot.course,course);assert.equal(h.snapshot.schema,1);
    assert(h.snapshot.data.questions.every(r=>!Object.hasOwn(r,'history')));
  }
});

test('first visit renders all Chapter 9 questions, blanks and explanations before the API resolves',async()=>{
  const linked='community-5ecdee2b-276b-46f0-968e-2c2c587559f9-1';
  const h=await page('os',{search:'?question='+linked});h.boot();
  assert.equal(h.source(),'snapshot');assert.equal(h.pending.length,1);
  assert.equal(h.config.examEntries(['L9']).length,78);
  assert.equal(h.config.examUnitId(),'L9');
  assert.equal((h.config.questionForEdit(linked).stem.match(/_{3,}/g)||[]).length,2);
  assert.match(h.config.questionForEdit(linked).explanation,/base/);
  assert(h.document.querySelector(`article[data-id="${linked}"]`));
});

test('conditional sync keeps the visible cache and answer fields intact when the server returns 304',async()=>{
 const h=await page('os'),data={questions:[],aliases:[],overrides:[]},etag='"version-one"';
 h.storage.set(key('os'),JSON.stringify({schema:1,course:'os',generatedAt:new Date(Date.now()+1000).toISOString(),data,etag}));
 let finish, options, merges=0;
 const merge=h.config.mergeCommunityQuestions;
 h.config.mergeCommunityQuestions=(...args)=>{merges++;return merge(...args);};
 h.context.fetch=(url,opts)=>{options=opts;return new Promise(resolve=>{finish=resolve;});};
 h.boot();assert.equal(merges,1);assert.equal(options.headers['If-None-Match'],etag);
 finish({status:304,ok:false,headers:{get:name=>name==='etag'?etag:new Date().toUTCString()},json(){throw Error('304 has no body');}});
 await tick();
 assert.equal(merges,1);assert.equal(h.source(),'live');
 assert.equal(JSON.parse(h.storage.get(key('os'))).etag,etag);
});

for(const course of ['os','algorithms']) {
  test(course+': newer cache renders synchronously, live results remove hidden rows and reset built-in edits',async()=>{
    const h=await page(course), unit=course==='os'?'basics':'L2';
    const original=JSON.parse(JSON.stringify(h.config.examEntries([unit])[0].q));
    const builtinId=original.id||original.bookmarkId;
    const modified=course==='os'?{...original,stem:'快取中的原題修訂'}:{...original,q:'快取中的原題修訂'};
    cache(h,{questions:[row(course,1),row(course,2,unit)],aliases:[],overrides:[{unit,question:modified}]});
    h.boot();assert.equal(h.source(),'cache');assert(h.config.validId(id(1)));
    assert.equal(h.config.questionForEdit(builtinId).stem,'快取中的原題修訂');
    const data={questions:[row(course,2,unit,'最新題目 ___'),row(course,3)],aliases:[{id:id(1),target:id(3)}],overrides:[]};
    await h.complete(data);
    assert.equal(h.source(),'live');assert.equal(h.config.resolveId(id(1)),id(3));
    assert.equal(h.config.questionForEdit(id(2)).stem,'最新題目 ___');
    assert.equal(h.config.questionForEdit(builtinId).stem,original.stem||original.q);
    assert.equal(h.config.examEntries(true).filter(e=>e.id===id(1)).length,0);
    assert.equal(h.config.examEntries(true).filter(e=>e.id===id(2)).length,1);
    assert.deepEqual(JSON.parse(h.storage.get(key(course))).data,data);
    // A later offline visit uses the complete last result; it never appends the older snapshot.
    const again=await page(course,{storage:h.storage,online:false});again.boot();
    assert.equal(again.source(),'cache');assert.equal(again.config.resolveId(id(1)),id(3));
    assert.equal(again.config.questionForEdit(id(2)).stem,'最新題目 ___');
    assert.match(again.notice(),/離線/);
  });

  test(course+': complete empty result removes dynamic units, old links, search and exam entries',async()=>{
    const h=await page(course);cache(h,{...empty(),questions:[row(course,1)]});h.boot();
    assert(h.config.validId(id(1)));
    await h.complete(empty());
    assert.equal(h.config.validId(id(1)),false);
    assert.equal(h.config.examEntries(true).some(e=>e.id===id(1)),false);
    assert.equal(h.config.examUnits().some(u=>u.id===(course==='os'?'L9':'L7')),false);
    const again=await page(course,{storage:h.storage,online:false});again.boot();
    assert.equal(again.config.validId(id(1)),false);
    assert.equal(again.config.examUnits().some(u=>u.id===(course==='os'?'L9':'L7')),false);
  });

  test(course+': background replacement preserves active unit, unchanged answer drafts and supports moved questions',async()=>{
    const h=await page(course),unit=course==='os'?'basics':'L2',data={...empty(),questions:[row(course,1,unit)]};
    cache(h,data);h.boot();
    h.fire('#practiceMode');
    // Find the added question through its link on a fresh page so it is on screen.
    const linked=await page(course,{storage:h.storage,search:'?question='+id(1)});linked.boot();linked.fire('#practiceMode');
    const input=linked.document.querySelector(`article[data-id="${id(1)}"] [data-draft]`);
    input.value='my answer';input.dispatchEvent(new linked.window.Event('input',{bubbles:true}));
    await linked.complete(data);
    assert.equal(linked.config.examUnitId(),unit);
    assert.equal(linked.document.querySelector(`article[data-id="${id(1)}"] [data-draft]`).value,'my answer');
    // Moving a public question does not leave a duplicate in the original unit.
    linked.config.mergeCommunityQuestions([row(course,1,course==='os'?'L9':'L7')],{replace:true});
    assert.equal(linked.config.examEntries(true).filter(e=>e.id===id(1)).length,1);
    assert.equal(linked.config.examEntries([unit]).some(e=>e.id===id(1)),false);
  });
}

test('outdated, malformed, wrong-course and future-dated caches fall back to the embedded snapshot',async()=>{
  for(const bad of ['broken',JSON.stringify({schema:1,course:'algorithms',generatedAt:new Date().toISOString(),data:empty()}),
    JSON.stringify({schema:1,course:'os',generatedAt:'2099-01-01',data:empty()}),
    JSON.stringify({schema:1,course:'os',generatedAt:'2020-01-01',data:empty()})]){
    const h=await page('os',{storage:new Map([[key('os'),bad]]),online:false});h.boot();
    assert.equal(h.source(),'snapshot');assert.equal(h.config.examEntries(['L9']).length,78);
  }
});

test('failed or incomplete sync keeps visible snapshot and does not overwrite the last valid cache',async()=>{
  for(const data of [{questions:[]},{...empty(),overrides:[{unit:'basics',question:{id:'bad'}}]}]){
    const h=await page('os');h.boot();await h.complete(data);
    assert.equal(h.source(),'snapshot');assert.equal(h.config.examEntries(['L9']).length,78);
    assert.equal(h.storage.has(key('os')),false);assert.match(h.notice(),/暫時無法同步/);
  }
  const h=await page('os',{failStorage:true});h.boot();await h.complete(empty());
  assert.equal(h.source(),'live');assert.equal(h.config.examUnits().some(u=>u.id==='L9'),false);
});

test('explicit public Chapter 9 explanations win over curation and missing fallback questions stay hidden',async()=>{
  const h=await page('os');h.boot();
  const data=JSON.parse(JSON.stringify(h.snapshot.data));
  const first=data.questions.find(r=>r.unit==='L9');first.question.explanation='同學最新修正的解析';
  const removed=new Set(h.snapshot.curation.aliases.map(a=>a.id));
  data.questions=data.questions.filter(r=>!removed.has(r.question.id));
  await h.complete(data);
  assert.equal(h.config.questionForEdit(first.question.id).explanation,'同學最新修正的解析');
  assert(h.config.examEntries(['L9']).every(e=>!removed.has(e.id)));
  for(const alias of h.snapshot.curation.aliases)assert.equal(h.config.validId(alias.target),false);
});

test('republished Chapter 9 questions retain live editable IDs, curated order and explanations while old links redirect',async()=>{
  const h=await page('os'),alias=h.snapshot.curation.aliases[1];h.boot();
  assert.equal(h.config.resolveId(alias.target),alias.id);
  assert.equal(h.config.questionForEdit(alias.id).category,'位址繫結');
  assert.match(h.config.questionForEdit(alias.id).explanation,/relocatable/);
  assert.equal(h.config.examEntries(['L9']).some(e=>e.id===alias.target),false);
  const base=h.config.examEntries(true).length;
  await h.complete(h.snapshot.data);
  assert.equal(h.config.examEntries(true).length,base);
  assert.equal(h.config.examEntries(['deadlocks']).length,138);
});

test('a save notification arriving during initial synchronization queues a fresh request',async()=>{
  const h=await page('os');h.boot();
  h.window.dispatchEvent(new h.window.Event('online'));
  await h.complete(empty());assert.equal(h.pending.length,1);
  await h.complete({...empty(),questions:[row('os',1)]});
  assert.equal(h.config.validId(id(1)),true);
  assert.equal(JSON.parse(h.storage.get(key('os'))).data.questions.length,1);
});

test('background sync replaces the reported stale ABCD answer with AC on the visible card',async()=>{
  const h=await page('os',{search:'?question=basics-9'});
  const q=h.config.examEntries(false).find(e=>e.id==='basics-9').q;
  const older={...q,answer:'A、B、C、D',choiceKey:'ABCD',explanation:'舊解析'};
  cache(h,{...empty(),overrides:[{unit:'basics',question:older}]});h.boot();
  assert.equal(h.document.querySelector('article[data-id="basics-9"] .answer-value').textContent,'A、B、C、D');
  await h.complete({...empty(),overrides:[{unit:'basics',question:{...q,answer:'A、C',choiceKey:'AC',explanation:'已儲存的新解析'}}]});
  assert.equal(h.config.questionForEdit('basics-9').answer,'A、C');
  assert.equal(h.document.querySelector('article[data-id="basics-9"] .answer-value').textContent,'A、C');
  assert.equal(h.document.querySelector('article[data-id="basics-9"] .explanation-text').textContent,'已儲存的新解析');
});

test('a network failure retains the last cache, and full synchronization preserves built-in questions with community IDs',async()=>{
  const h=await page('os');cache(h,{...empty(),questions:[row('os',1)]});h.boot();
  const before=h.storage.get(key('os'));
  h.pending.shift()({ok:false});await tick();
  assert.equal(h.source(),'cache');assert.equal(h.storage.get(key('os')),before);
  h.window.dispatchEvent(new h.window.Event('online'));await h.complete(empty());
  assert.equal(h.config.examEntries(true).length,716);
  assert(h.config.examEntries(['deadlocks']).some(e=>e.id==='community-17f37eed-b93c-485f-9bdd-c7591a014917-16'));
});
