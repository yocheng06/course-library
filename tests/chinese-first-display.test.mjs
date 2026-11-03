import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {expandLibraryQuestion,buildIndex,matchQuestions,parseQuestions} from '../assets/batch-model.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const source=await readFile(new URL('../assets/question-tools.js',import.meta.url),'utf8');
function tools(document){const window={};vm.runInNewContext(source,{window,document});return window.courseQuestionTools;}
const question=()=>({id:'bilingual-example',stem:'Which hardware unit translates addresses?',translation:'哪個硬體單元負責位址轉換？',type:'單選題',category:'測試雙語',options:['A. ALU','B. MMU'],optionTranslations:['A. 算術邏輯單元','B. 記憶體管理單元'],answer:'B',answerProvided:true,explanation:'MMU 負責位址轉換。'});

test('explicit bilingual stems show Chinese first in a closed English disclosure, without mutating either field',()=>{
 const q=question(),before=JSON.stringify(q),t=tools();
 for(const item of [q,{...q,stem:q.translation,translation:q.stem}]){
  const {document}=parseHTML(t.bilingualPromptMarkup(item));
  assert.equal(document.querySelector('h3').textContent,q.translation);
  assert.equal(document.querySelector('h3').getAttribute('lang'),'zh-Hant');
  const details=document.querySelector('details.english-prompt');assert(details);assert.equal(details.hasAttribute('open'),false);
  assert.equal(details.querySelector('summary').textContent,'查看英文原題');assert.equal(details.querySelector('p').textContent,q.stem);
 }
 assert.equal(JSON.stringify(q),before);
});

test('English-only questions, Chinese technical terms, and same-language notes remain fully visible and escaped',()=>{
 const t=tools();
 for(const q of [{stem:'CPU 與 MMU 的功能？'},{stem:'What is CPU scheduling?'},{stem:'中文題幹',translation:'額外中文條件'}]){
  const {document}=parseHTML(t.bilingualPromptMarkup(q));assert.equal(document.querySelector('details'),null);assert([...document.querySelectorAll('h3,p')].some(n=>n.textContent.includes(q.stem)));if(q.translation)assert([...document.querySelectorAll('h3,p')].some(n=>n.textContent.includes(q.translation)));
 }
 const html=t.bilingualPromptMarkup({stem:'English <img src=x onerror=bad()>',translation:'中文題目'});const {document}=parseHTML(html);assert.equal(document.querySelector('img'),null);assert(document.querySelector('p').textContent.includes('<img'));
});

test('an expanded English prompt stays expanded while the same card rerenders',()=>{
 const {document}=parseHTML('<div id="list"></div>'),t=tools(document),q=question(),entries=[{id:q.id,q,unit:{id:'basics'}}],list=document.getElementById('list');
 const markup=entry=>`<article data-id="${entry.id}">${t.bilingualPromptMarkup(entry.q)}</article>`;
 t.renderQuestionCards(list,entries,markup);list.querySelector('details').open=true;
 t.renderQuestionCards(list,entries,markup);assert.equal(list.querySelector('details').open,true);
 list.querySelector('details').open=false;t.renderQuestionCards(list,entries,markup);assert.equal(Boolean(list.querySelector('details').open),false);
});

test('collapsing English leaves known Chinese, English and bilingual source-version batch matches and reordered answers unchanged',()=>{
 const q=question();q.sourceVariants=[{...q,stem:q.translation+'\n'+q.stem,translation:''}];const before=JSON.stringify(q),index=buildIndex(expandLibraryQuestion('os','basics',q)),t=tools();
 const queries=[`${q.translation}\nA. ALU\nB. MMU`,`${q.stem}\nA. MMU\nB. ALU`,`${q.translation}\n${q.stem}\nA. MMU\nB. ALU`];
 const lookup=()=>queries.map(text=>matchQuestions(parseQuestions('1. '+text),index,{course:'os',unit:'all'})[0]);
 const initial=lookup();t.bilingualPromptMarkup(q);const after=lookup();
 assert.deepEqual(after,initial);assert(after.every(row=>row.status==='matched'),JSON.stringify(after.map(r=>r.reason)));
 assert.equal(after[0].answer,'B. MMU');assert.equal(after[1].answer,'A. MMU');assert.equal(after[2].answer,'A. MMU');assert.equal(JSON.stringify(q),before);
});

for(const course of ['os','algorithms'])test(course+' reader renders live bilingual questions in Chinese and still searches their English text',async()=>{
 const q=question(),id='community-00000000-0000-4000-8000-000000000088-1',unit=course==='os'?'basics':'L2';
 const liveQ=course==='os'?{...q,id}:{...q,bookmarkId:id,q:q.stem,a:q.answer,opts:q.options,ex:q.explanation};
 const live={questions:[{unit,question:liveQ}],aliases:[],overrides:[]};
 const h=await loadCourse(course,{live,linkedQuestion:id});
 const card=h.document.querySelector(`article[data-id="${id}"]`);assert(card);assert.equal(card.querySelector('h3.question').textContent,q.translation);assert.equal(card.querySelector('.english-prompt').hasAttribute('open'),false);
 assert.equal(h.window.courseQuestionTools.matchesSearch(liveQ,'Which hardware unit translates addresses'),true);
 assert.equal(h.config.questionForEdit(id).translation,q.translation);
});
