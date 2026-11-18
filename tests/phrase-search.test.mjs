import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../assets/question-tools.js',import.meta.url),'utf8'),context);
const tools=context.window.courseQuestionTools;
const phrase='中斷 (Interrupt) 的常見類型包含？';
const question={stem:phrase,category:'中斷',type:'多選題',options:['硬體中斷','Software interrupt'],answer:'A',answerProvided:true,explanation:'中斷會通知 CPU。'};
test('full phrase controls filtering, labels and marks without partial term matches',()=>{
 assert(tools.matchesSearch(question,phrase));
 assert.equal(tools.searchMatchMarkup(question,phrase),'<p class="search-match">命中：題幹</p>');
 assert.equal(tools.highlightSearch(phrase,phrase),'<mark>中斷 (Interrupt) 的常見類型包含</mark>？');
 assert.equal(tools.highlightSearch('硬體中斷',phrase),'硬體中斷');
 for(const stem of ['中斷是什麼？ Interrupt 常見類型有哪些？','的常見類型包含 Interrupt 中斷','中斷 (Interrupt) 的其他常見類型包含？'])assert(!tools.matchesSearch({...question,stem},phrase));
 assert(!tools.matchesSearch({stem:'CPU',answer:'time quantum'},'CPU time quantum'));
 assert(!tools.matchesSearch({options:['time','quantum']},'time quantum'));
});
test('format-equivalent phrases remain contiguous and marks preserve original source safely',()=>{
 const text='中斷（Ｉｎｔｅｒｒｕｐｔ）  的常見類型包含？';
 assert(tools.matchesSearch({...question,stem:text},phrase));
 assert.equal(tools.highlightSearch(text,phrase),'<mark>中斷（Ｉｎｔｅｒｒｕｐｔ）  的常見類型包含</mark>？');
 const blank='在[__1__]頁表中，每個條目對應一個物理[__2__]。';
 const query='1. 在 ____________ 頁表中，每個條目對應一個物理 ____________ 。';
 assert(tools.matchesSearch({stem:blank},query));assert.match(tools.highlightSearch(blank,query),/^<mark>在\[__1__\]/);
 assert.equal(tools.highlightSearch('<script>alert(1)</script>','<script>'),'<mark>&lt;script&gt;</mark>alert(1)&lt;/script&gt;');
 assert.equal(tools.highlightSearch('CPU cpu CPU','cpu'),'<mark>CPU</mark> <mark>cpu</mark> <mark>CPU</mark>');
 assert.equal(tools.highlightSearch('中斷','  '),'中斷');
});
test('numeric highlighting uses whole sequence boundaries and spacing normalization',()=>{
 const query='2,5,3,0,2,3,0,3';
 assert.equal(tools.highlightSearch('12,5,3,0,2,3,0,3',query),'12,5,3,0,2,3,0,3');
 assert.equal(tools.highlightSearch('A=2, 5, 3, 0, 2, 3, 0, 3。',query),'A=<mark>2, 5, 3, 0, 2, 3, 0, 3</mark>。');
});
for(const course of ['os','algorithms'])test(course+' reading displays only contiguous phrase matches and highlights no isolated keywords',async()=>{
 const unit=course==='os'?'basics':'L2';
 const fixtures=[question,{...question,stem:'中斷 (Interrupt) 的其他常見類型包含？'}].map((q,i)=>({...q,id:`community-00000000-0000-4000-8000-000000000090-${i+1}`,bookmarkId:`community-00000000-0000-4000-8000-000000000090-${i+1}`,q:q.stem,opts:q.options,a:q.answer,translation:'What are the common types of interrupts?'}));
 const h=await loadCourse(course,{live:{questions:fixtures.map(question=>({unit,question})),aliases:[],overrides:[]}});
 const search=h.document.getElementById('search');search.value=phrase;search.dispatchEvent(new h.window.Event('input'));
 const card=h.document.querySelector(`article[data-id="${fixtures[0].id}"]`);assert(card);
 assert(!h.document.querySelector(`article[data-id="${fixtures[1].id}"]`));
 assert.equal(card.querySelectorAll('mark').length,1);
 assert.equal(card.querySelector('.search-match').textContent,'命中：題幹');
 assert.equal(card.querySelectorAll('.option mark').length,0);
});
