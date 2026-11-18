import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {inspectExplanation} from '../assets/explanation-quality.mjs';
import {analyzeLibrary,setupLibraryHealth} from '../assets/library-health.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const base={stem:'中斷的來源？',type:'多選題',options:['A. 硬體中斷','B. 軟體中斷','C. 不相關','D. 其他'],answer:'A、B',answerProvided:true};
const row=(id,unit,explanation,patch={})=>({id,course:'os',unit,source:'builtin',revision:1,question:{...base,stem:'題目 '+id,explanation},...patch});
test('explanation rules distinguish absent explanations, answer-only text and positional references without judging the answer',()=>{
 for(const text of ['', '原始題庫尚未提供本題詳細解析。','尚未提供解析，之後可直接補充。','解析待補。'])assert.deepEqual(inspectExplanation(base,text).issues,['缺解析'],text);
 for(const text of ['A、B','答案為 A、B。','正確答案：硬體中斷；軟體中斷'])assert(inspectExplanation(base,text).issues.includes('只寫答案'),text);
 for(const text of ['選 A、B，兩者由不同來源觸發。','A 是硬體事件；B 是軟體事件。','選項 B 不符合。','Option b is incorrect.','C. 這個選項沒有通知 CPU。'])assert(inspectExplanation(base,text).issues.includes('使用選項代號'),text);
 for(const text of ['CPU 與 DMA 協作，I/O 完成後通知處理器。','B-tree 是平衡搜尋樹；O(n) 表示線性上界。','把 A[1] 和 B[2] 的數字相加。','硬體中斷由裝置產生；軟體中斷由程式觸發，兩者都會通知 CPU。'])assert.deepEqual(inspectExplanation(base,text).issues,[],text);
 assert.deepEqual(inspectExplanation({options:[],answer:'compaction'},'答案是 compaction。').issues,['只寫答案']);
 assert.deepEqual(inspectExplanation({options:[],answer:'O(n)'},'A 是陣列名稱，逐一走訪 n 個元素。').issues,[]);
});
test('health uses the effective explanation, excludes removed rows and leaves all source data untouched',()=>{
 const items=[row('curated','basics','',{effectiveExplanation:'硬體中斷由裝置產生，因此能通知 CPU。'}),row('short','basics','A、B'),row('deleted','basics','',{deleted:true})];
 const before=JSON.stringify(items),result=analyzeLibrary(items);
 assert.deepEqual(result[0].explanationIssues,[]);assert(result[1].explanationIssues.includes('只寫答案'));
 assert.equal(result.length,2);assert.equal(JSON.stringify(items),before);
});
function healthDOM(){
 const {window,document}=parseHTML('<section id="health"></section>');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',(o.getAttribute('value')??o.textContent)===v);}});
 Object.assign(globalThis,{window,document});window.courseContributions={apiOrigin:'https://example.invalid'};
 return {window,document,fire:(selector,type='click')=>document.querySelector(selector).dispatchEvent(new window.Event(type,{bubbles:true}))};
}
test('explanation workspace filters by unit and issue, safely previews text, opens edits and refreshes without losing unit selection',async()=>{
 const h=healthDOM();let opened,calls=0;
 const items=[row('missing','basics',''),row('short','basics','答案為 A、B。'),row('letters','architecture','選 B，<img src=x onerror=alert(1)>這是軟體來源。'),row('good','basics','裝置完成 I/O 時會通知 CPU。')];
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({items,complete:false}));};
 try{
  const ui=setupLibraryHealth({container:h.document.querySelector('#health'),openItem:item=>opened=item});
  await ui.show({mode:'explanations'});assert.equal(calls,1);
  assert.equal(h.document.querySelector('[data-health-heading]').textContent,'解析檢查');assert.equal(h.document.querySelectorAll('.health-card').length,3);
  assert.match(h.document.querySelector('[data-health-status]').textContent,/部分投稿/);
  assert(!h.document.querySelector('.health-explanation img'));
  h.document.querySelector('[data-health-unit]').value='basics';h.fire('[data-health-unit]','change');
  assert.equal(h.document.querySelectorAll('.health-card').length,2);assert.equal(h.document.querySelector('[data-health-quality="只寫答案"]').textContent,'只寫答案 1 題');
  h.fire('[data-health-quality="只寫答案"]');assert.equal(h.document.querySelectorAll('.health-card').length,1);
  h.fire('[data-health-edit="short"]');assert.equal(opened.id,'short');
  ui.invalidate();await ui.show({refresh:true});assert.equal(h.document.querySelector('[data-health-unit]').value,'basics');assert.equal(h.document.querySelectorAll('.health-card').length,1);
  await ui.show({mode:'all'});assert.equal(h.document.querySelector('[data-health-heading]').textContent,'題庫健檢');
  ui.clear();
 }finally{globalThis.fetch=oldFetch;}
});
for(const course of ['os','algorithms'])test(course+' counts and source summary follow current data, changes and unit renaming rather than historical prose',async()=>{
 const unit=course==='os'?'basics':'L2';
 const make=id=>({unit,question:{...base,id,bookmarkId:id,q:'測試題',stem:'測試題',opts:base.options,a:base.answer,explanation:'硬體與軟體都可通知 CPU。'}});
 const id='community-00000000-0000-4000-8000-000000000099-1';
 const data={questions:[make(id)],aliases:[],overrides:[]};
 const h=await loadCourse(course,{live:data}),d=h.document;
 const total=()=>h.config.examEntries(true).length;
 const check=()=>{
  assert(d.querySelector('[data-course-total]').textContent.includes(`${total()} 道題目`));
  assert(d.querySelector('[data-course-source-summary]').textContent.includes(`共 ${total()} 題`));
  assert(d.querySelector('meta[name="description"]').content.includes(`${total()} 題`));
  assert.equal([...d.querySelectorAll('[data-course-unit-counts] li')].reduce((sum,n)=>sum+Number(n.textContent.match(/：(\d+) 題/)[1]),0),total());
 };
 check();const before=total();
 h.config.mergeCommunityQuestions([make(id),make(id.replace(/1$/,'2'))],{replace:true});
 assert.equal(total(),before+1);check();
 h.config.mergeCommunityQuestions([],{replace:true});assert.equal(total(),before-1);check();
 h.config.setUnitMetadata([{id:unit,title:'重新命名測試單元',managed:true,order:0}]);check();
 assert(d.querySelector('[data-course-unit-counts]').textContent.includes('重新命名測試單元'));
 const sources=d.querySelector('.sources').textContent;
 assert(!/目前內建題庫收錄 754|目前 61 題|目前共 119 題|練習作答不會保存|練習作答只保留在目前開啟期間/.test(sources));
 assert.match(sources,/練習統計保存在此瀏覽器/);assert.match(sources,/當輪選項與文字輸入不會/);assert.match(sources,/最近一次已交卷/);
 const html=readFileSync(new URL('../'+course+'.html',import.meta.url),'utf8');
 const staticDoc=parseHTML(html).document;assert.equal(staticDoc.querySelector('[data-course-total]').textContent,'題庫載入中…');
});
test('shared service assets and primary explanation review entry stay synchronized',()=>{
 for(const path of ['assets/library-health.mjs','assets/explanation-quality.mjs','assets/contributions-review.js','assets/management.css'])assert.equal(readFileSync(new URL('../'+path,import.meta.url),'utf8'),readFileSync(new URL('../contribution-service/frontend/'+path,import.meta.url),'utf8'),path);
 const review=parseHTML(readFileSync(new URL('../contribution-service/frontend/review.html',import.meta.url),'utf8')).document;
 assert(review.querySelector('#managementNav > [data-view="explanations"]'));
});
