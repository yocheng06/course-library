import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';

for (const course of ['os','algorithms']) test(course+' language checkbox hides English cards and restores them without modifying question data',async()=>{
 const unit=course==='os'?'basics':'L2';
 const fixtures=[
  {id:'community-00000000-0000-4000-8000-000000000089-1',stem:'Which hardware unit translates addresses?',translation:''},
  {id:'community-00000000-0000-4000-8000-000000000089-2',stem:'哪個硬體單元負責位址轉換（MMU）？',translation:''},
  {id:'community-00000000-0000-4000-8000-000000000089-3',stem:'Which hardware unit translates addresses?',translation:'哪個硬體單元負責位址轉換？'},
  {id:'community-00000000-0000-4000-8000-000000000089-4',stem:'Which hardware unit translates addresses? (請用小寫英文回答)',translation:''}
 ].map(q=>({...q,bookmarkId:q.id,q:q.stem,type:'單選題',category:'語言測試',options:['MMU','ALU'],opts:['MMU','ALU'],answer:'A',a:'A',answerProvided:true}));
 const live={questions:fixtures.map(question=>({unit,question})),aliases:[],overrides:[]};
 const h=await loadCourse(course,{live}),{document,window}=h;
 const tools=window.courseQuestionTools;
 assert.deepEqual(fixtures.map(q=>tools.isEnglishOnlyQuestion(q)),[true,false,false,true]);
 assert.equal(tools.isEnglishOnlyQuestion({stem:'1234 ______'}),false);
 const before=JSON.stringify(h.config.examEntries(true));
 const search=document.getElementById('search');search.value='Which hardware unit translates addresses';search.dispatchEvent(new window.Event('input'));
 const ids=()=>[...document.querySelectorAll('article[data-id]')].map(n=>n.dataset.id);
 assert(ids().includes('community-00000000-0000-4000-8000-000000000089-1'));assert(ids().includes('community-00000000-0000-4000-8000-000000000089-3'));
 const toggle=document.getElementById('hideEnglish');assert(!toggle.checked);
 toggle.checked=true;toggle.dispatchEvent(new window.Event('change'));
 assert(!ids().includes('community-00000000-0000-4000-8000-000000000089-1'));assert(!ids().includes('community-00000000-0000-4000-8000-000000000089-4'));assert(ids().includes('community-00000000-0000-4000-8000-000000000089-3'));
 assert(tools.matchesSearch(fixtures[0],'Which hardware unit translates addresses'));
 assert.equal(JSON.stringify(h.config.examEntries(true)),before);
 toggle.checked=false;toggle.dispatchEvent(new window.Event('change'));
 assert(ids().includes('community-00000000-0000-4000-8000-000000000089-1'));assert(ids().includes('community-00000000-0000-4000-8000-000000000089-3'));
 search.value='';search.dispatchEvent(new window.Event('input'));
 document.getElementById('practiceMode').click();toggle.checked=true;toggle.dispatchEvent(new window.Event('change'));
 assert([...document.querySelectorAll('article[data-id]')].every(card=>!tools.isEnglishOnlyQuestion(h.config.questionForEdit(card.dataset.id))));
 document.getElementById(course==='os'?'clear':'clearBtn').click();assert.equal(toggle.checked,false);
});
