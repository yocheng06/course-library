import test from 'node:test';
import assert from 'node:assert/strict';
import {expandLibraryQuestion,buildIndex,matchQuestions,parseQuestions} from '../assets/batch-model.mjs';
import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
const question=()=>({id:'bilingual-example',stem:'Which hardware unit translates addresses?',translation:'哪個硬體單元負責位址轉換？',type:'單選題',category:'測試雙語',options:['A. ALU','B. MMU'],optionTranslations:['A. 算術邏輯單元','B. 記憶體管理單元'],answer:'B',answerProvided:true,explanation:'MMU 負責位址轉換。'});

for(const course of ['os','algorithms'])test(course+' restores the original inline prompt rendering and preserves source text and search',async()=>{
 const q=question(),id='community-00000000-0000-4000-8000-000000000088-1',unit=course==='os'?'basics':'L2';
 const liveQ=course==='os'?{...q,id}:{...q,bookmarkId:id,q:q.stem,a:q.answer,opts:q.options,ex:q.explanation};
 const before=JSON.stringify(liveQ),live={questions:[{unit,question:liveQ}],aliases:[],overrides:[]};
 const h=await loadCourse(course,{live,linkedQuestion:id}),card=h.document.querySelector(`article[data-id="${id}"]`);
 assert(card);assert.equal(card.querySelector('.english-prompt'),null);assert(!card.textContent.includes('查看英文原題'));
 assert.equal(card.querySelector('h3.question').textContent,course==='os'?q.translation:q.stem);
 if(course==='os'){assert.equal(card.querySelector('p.translation').textContent,q.stem);assert.equal(card.querySelector('p.translation').closest('details'),null);}
 assert.equal(h.window.courseQuestionTools.matchesSearch(liveQ,'Which hardware unit translates addresses'),true);
 assert.equal(h.window.courseQuestionTools.matchesSearch(liveQ,'哪個硬體單元負責位址轉換'),true);
 assert.equal(h.config.questionForEdit(id).translation,q.translation);assert.equal(JSON.stringify(liveQ),before);
});

test('known Chinese, English and bilingual source-version batch matches keep the same answers after the display rollback',()=>{
 const q=question();q.sourceVariants=[{...q,stem:q.translation+'\n'+q.stem,translation:''}];const before=JSON.stringify(q),index=buildIndex(expandLibraryQuestion('os','basics',q));
 const queries=[`${q.translation}\nA. ALU\nB. MMU`,`${q.stem}\nA. MMU\nB. ALU`,`${q.translation}\n${q.stem}\nA. MMU\nB. ALU`];
 const rows=queries.map(text=>matchQuestions(parseQuestions('1. '+text),index,{course:'os',unit:'all'})[0]);
 assert(rows.every(row=>row.status==='matched'));assert.deepEqual(rows.map(row=>row.answer),['B. MMU','A. MMU','A. MMU']);assert.equal(JSON.stringify(q),before);
});
