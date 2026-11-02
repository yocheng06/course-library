import {mergeContributionStyles} from '../contribution-service/scripts/shared-frontend.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {groupImport,setupGroupedSubmissions} from '../assets/grouped-submissions.mjs';
import {analyzeLibrary,setupLibraryHealth} from '../assets/library-health.mjs';
import {compareQuestions,comparisonMarkup,blankCount,mismatchLabel} from '../assets/question-comparison.mjs';
import {normalizeStem,questionStemVersions} from '../assets/batch-model.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const question=(patch={})=>({category:'HTML 匯入',stem:'中斷的類型？',type:'單選題',options:['A. Timer','B. Disk'],answer:'A',explanation:'Timer 是計時器中斷',images:[],...patch});
const row=(id,patch={})=>({id,source:'builtin',course:'os',unit:'basics',revision:0,question:question(patch)});
function dom(html){
 const {window,document}=parseHTML(html);
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',(o.getAttribute('value')??o.textContent)===v);}});
 const storage=new Map();Object.assign(globalThis,{window,document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
 window.HTMLElement.prototype.scrollIntoView=()=>{};window.courseContributions={apiOrigin:'https://example.invalid'};window.confirm=()=>true;
 const fire=(selector,type='click')=>document.querySelector(selector).dispatchEvent(new window.Event(type,{bubbles:true}));
 return {window,document,storage,fire};
}
test('topic inference is shared with the reader, preserves custom topics, and bulk edits persist into the actual submission body',async()=>{
 const noCategory=question();delete noCategory.category;assert.equal(groupImport([noCategory],{course:'os',unit:'basics',title:'測試題庫'})[0].payload.questions[0].category,'中斷');
 const a=groupImport([question(),question({stem:'雲端服務模型？'}),question({stem:'第三題？',category:'老師自訂主題'})],{course:'os',unit:'basics',title:'測試題庫'})[0];
 assert.deepEqual(a.payload.questions.map(q=>q.category),['中斷','雲端服務','老師自訂主題']);
 const h=dom('<section><h2 id="draftHeading"></h2></section><input id="website">');
 const requests=[];globalThis.fetch=async(url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'receipt',acceptedCount:3,receivedCount:3,status:'approved'}));};
 const ui=setupGroupedSubmissions({parseImport:()=>[question(),question({stem:'雲端服務模型？'}),question({stem:'第三題？',category:'老師自訂主題'})],metadata:()=>({course:'os',unit:'basics',title:'測試題庫'}),onReceipt:()=>{},message:()=>{}});
 await ui.importFiles([{name:'bank.json',size:20,text:async()=>''}]);
 assert.equal(h.document.querySelector('[data-topic="0:0"]').value,'中斷');
 const all=h.document.querySelector('[data-topic-all]');all.checked=true;h.fire('[data-topic-all]','change');
 h.document.querySelector('[data-topic-bulk]').value='整批修正主題';h.fire('[data-topic-apply]');
 assert.ok([...h.document.querySelectorAll('.draft-meta')].every(node=>node.textContent.includes('整批修正主題')));
 assert.ok([...h.document.querySelectorAll('[data-topic]')].every(input=>input.value==='整批修正主題'));
 assert.deepEqual(JSON.parse(h.storage.get('course-library-grouped-submissions-v1')).groups[0].payload.questions.map(q=>q.category),Array(3).fill('整批修正主題'));
 h.document.querySelector('[data-consent]').checked=true;h.fire('[data-consent]','change');h.fire('[data-send]');for(let i=0;i<15&&!requests.length;i++)await tick();
 assert.deepEqual(requests[0].questions.map(q=>q.category),Array(3).fill('整批修正主題'));
});
test('comparison shows full texts, distinguishes choice content from label changes, counts blanks, and escapes imported markup',()=>{
 const a=question(),b=question({options:['A. Disk','B. Timer'],answer:'B'});
 const fields=compareQuestions(a,b);assert.equal(fields.find(f=>f.label==='答案內容').different,false);assert.equal(fields.find(f=>f.label==='選項內容').different,true);
 assert.equal(compareQuestions(question({stem:'n²'}),question({stem:'n2'})).find(f=>f.label==='題幹').different,true);
 assert.equal(blankCount('第 [__1__] 和 ____________，L_M_N 不算'),2);
 const html=comparisonMarkup(question({stem:'<img src=x onerror=alert(1)>'}),b);assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
 assert.equal(mismatchLabel({status:'unmatched',reason:'題幹符合，但選項不同'}),'選項版本不同或不完整');
});
test('health flags missing content, malformed keys and same-stem versions without deleting or judging the supplied answer',()=>{
 const items=[row('one'),row('two',{options:['A. Other','B. Timer'],answer:'B'}),row('missing',{stem:'另一題',explanation:'',answer:'Z'}),{...row('gone'),deleted:true}];
 const before=JSON.stringify(items),result=analyzeLibrary(items);
 assert.equal(JSON.stringify(items),before);assert.equal(result.length,3);assert.deepEqual(result[0].duplicates,['two']);
 assert.ok(result[2].issues.includes('缺解析'));assert.ok(result[2].issues.includes('答案無法對應選項'));assert.ok(!result[1].issues.includes('答案無法對應選項'));
});
test('health loads lazily, filters, compares candidates and opens the selected editor',async()=>{
 const h=dom('<section id="health"></section>'),items=[row('one'),row('two',{answer:'B'}),row('missing',{stem:'缺解析測試',explanation:''})];let calls=0,opened;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({items,complete:true}));};
 const ui=setupLibraryHealth({container:h.document.querySelector('#health'),openItem:r=>opened=r});assert.equal(calls,0);await ui.show();assert.equal(calls,1);await ui.show();assert.equal(calls,1);
 h.document.querySelector('[data-health-compare="one"]').value='two';h.fire('[data-health-compare="one"]','change');assert.match(h.document.querySelector('[data-health-comparison]').textContent,/答案內容（不同）/);
 h.fire('[data-health-edit="one"]');assert.equal(opened.id,'one');
 h.document.querySelector('[data-health-filter]').value='缺解析';h.fire('[data-health-filter]','change');assert.equal(h.document.querySelectorAll('.health-card').length,1);assert.match(h.document.querySelector('.health-card').textContent,/缺解析測試/);
 ui.clear();
});
test('private health endpoint enforces owner authentication and uses latest edits, excluding deleted and merged records',async()=>{
 const source=await readFile(new URL('../contribution-service/worker/library-management.js',import.meta.url),'utf8');
 let allowed=false,queries=0;
 const builtins=[{...row('one'),question:question()},{...row('gone'),question:question()}];
 const env={DB:{prepare(){queries++;return {bind(){return {all:async()=>({results:[{id:'community-new',course:'os',unit:'basics',revision:1,data:JSON.stringify(question({stem:'新題目'}))},{id:'merged',data:JSON.stringify({mergedInto:'one'})}]})}}}}}};
 const context=vm.createContext({HEALTH_EXPLANATIONS:{},BUILTIN_QUESTIONS:builtins,builtinEditable:q=>q,canonicalQuestion:q=>q,COURSE_UNITS:{os:{units:{}}},builtinSearch:{normalizeStem,questionStemVersions},owner:async()=>{if(!allowed)throw Error('owner required')},ensureReviewedContent:async()=>{},latestBuiltinEdits:async()=>new Map([['one',{question:question({answer:'B'})}],['gone',{deleted:true}]]),builtinRow:(b,e)=>({...b,...e}),builtinReference:(course,id)=>builtins.find(b=>b.id===id),json:x=>x,HttpError:Error,unitLabel:()=>'',URL,Map,Set});
 vm.runInContext(source+';globalThis.health=managementHealth;',context);
 await assert.rejects(context.health({},env,new URL('https://example.invalid?course=os')),/owner required/);assert.equal(queries,0);
 allowed=true;const data=await context.health({},env,new URL('https://example.invalid?course=os'));
 assert.deepEqual(Array.from(data.items,r=>r.id),['one','community-new']);assert.equal(data.items[0].question.answer,'B');assert.equal(data.complete,true);
});
for(const course of ['os','algorithms'])test(course+' reader keeps a visible sync status and manual retry after success or failure',async()=>{
 const h=await loadCourse(course),node=h.document.getElementById('courseSyncStatus');assert.match(node.textContent,/同步/);assert.equal(h.document.documentElement.dataset.questionSync,'syncing');
 h.respond({questions:[],aliases:[],overrides:[]});await tick();await tick();assert.equal(h.document.documentElement.dataset.questionSync,'synced');assert.match(node.textContent,/最後同步/);assert.ok(node.querySelector('button'));
 const broken=await loadCourse(course);broken.respond({bad:true});await tick();await tick();assert.equal(broken.document.documentElement.dataset.questionSync,'failed');assert.match(broken.document.getElementById('courseSyncStatus').textContent,/仍可使用/);
});

test('health image checking reports inaccessible links separately without claiming permanent breakage',async()=>{
 const h=dom('<section id="health"></section>'),items=[row('good',{stem:'有圖好題',images:['https://example.invalid/good.png']}),row('bad',{stem:'有圖待查題',images:['https://example.invalid/broken.png']})];
 globalThis.fetch=async()=>new Response(JSON.stringify({items,complete:true}));
 const OldImage=globalThis.Image;globalThis.Image=class{set src(value){queueMicrotask(()=>value.includes('broken')?this.onerror?.():this.onload?.());}};
 try{
  const ui=setupLibraryHealth({container:h.document.querySelector('#health'),openItem:()=>{}});await ui.show();h.fire('[data-health-images]');for(let i=0;i<10;i++)await tick();
  h.document.querySelector('[data-health-filter]').value='圖片無法確認';h.fire('[data-health-filter]','change');
  assert.equal(h.document.querySelectorAll('.health-card').length,1);assert.match(h.document.querySelector('.health-card').textContent,/有圖待查題/);assert.match(h.document.querySelector('[data-health-status]').textContent,/無法確認 1 題/);ui.clear();
 }finally{globalThis.Image=OldImage;}
});

test('reviewed explanation fallbacks are recognized only for the exact question and never override a later written explanation',async()=>{
 const source=await readFile(new URL('../contribution-service/worker/library-management.js',import.meta.url),'utf8');
 const q=question({explanation:''}),identity=JSON.stringify([q.type,q.stem,q.options,q.answer,q.images]);
 const context=vm.createContext({HEALTH_EXPLANATIONS:{os:{demo:{versions:[{identity,sourceExplanation:'',explanation:'已審閱的補充解析'}]}}},BUILTIN_QUESTIONS:[],URL});
 vm.runInContext(source+';globalThis.explain=healthExplanation;',context);
 assert.equal(context.explain('os','demo',q),'已審閱的補充解析');assert.equal(context.explain('os','demo',{...q,answer:'B'}),'');assert.equal(context.explain('os','demo',{...q,explanation:'後來自己補的解析'}),'後來自己補的解析');
});

test('large grouped previews create later batches only when opened and keep earlier topic edits intact',async()=>{
 const h=dom('<section><h2 id="draftHeading"></h2></section><input id="website">');
 const data=[{...question(),course:'os',unit:'basics'},{...question({stem:'系統呼叫如何切換模式？'}),course:'os',unit:'architecture'}];
 const ui=setupGroupedSubmissions({parseImport:()=>data,metadata:()=>({course:'os',unit:'basics',title:'多批測試'}),onReceipt:()=>{},message:()=>{}});
 await ui.importFiles([{name:'bank.json',size:10,text:async()=>''}]);assert.equal(h.document.querySelectorAll('[data-topic]').length,1);
 h.document.querySelector('[data-topic="0:0"]').value='自訂主題';h.fire('[data-topic="0:0"]','change');
 const details=h.document.querySelector('details[data-group-index="1"]');details.open=true;h.fire('details[data-group-index="1"]','toggle');
 assert.equal(h.document.querySelectorAll('[data-topic]').length,2);assert.equal(h.document.querySelector('[data-topic="0:0"]').value,'自訂主題');assert.equal(h.document.querySelector('[data-topic="1:0"]').value,globalThis.courseTopicOrder.topic(data[1],'os','architecture').label);
});

test('frontend preparation preserves service-owned administration styles and replaces shared additions idempotently',()=>{
 const marker='/* Shared, theme-aware question comparison and bulk topic controls. */',old='.approved-publications{padding:16px}.management-toolbar{display:flex}',shared='.reader-only{}'+marker+'.import-topic{display:flex}';
 const merged=mergeContributionStyles(shared,old+marker+'.outdated-shared{}');assert.ok(merged.startsWith(old));assert.ok(!merged.includes('.reader-only'));assert.ok(!merged.includes('.outdated-shared'));assert.ok(merged.includes('.import-topic'));
 assert.equal(mergeContributionStyles(shared,merged),merged);assert.throws(()=>mergeContributionStyles('.missing-marker{}',old),/missing/);
});
