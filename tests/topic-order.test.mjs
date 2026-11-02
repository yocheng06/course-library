import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {loadCourse,orderingIssues} from '../scripts/audit-topic-order-20261102.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const live={os:JSON.parse(await read('content/os-public-topic-order-20261102.json')),algorithms:JSON.parse(await read('content/algorithms-public-topic-order-20261102.json'))};
function assertOrder(h,course){const entries=h.config.examEntries(true);assert.deepEqual(orderingIssues(entries,h.window.courseTopicOrder,course),[]);return entries;}
for(const course of ['os','algorithms'])test(course+' all current units group every topic, then single/multiple/fill, while preserving question contents',async()=>{
 const previous=await loadCourse(course,{live:live[course],ordering:false}),before=JSON.parse(JSON.stringify(previous.config.examEntries(true)));
 const h=await loadCourse(course,{live:live[course]}),entries=assertOrder(h,course),tools=h.window.courseTopicOrder;
 assert.equal(entries.length,course==='os'?1048:379);assert.equal(h.config.examUnits().length,course==='os'?9:6);
 assert.equal(JSON.stringify([...entries].sort((a,b)=>a.id.localeCompare(b.id))),JSON.stringify(before.sort((a,b)=>a.id.localeCompare(b.id))));
 assert(orderingIssues(before,tools,course).length>0);
 const source=JSON.stringify(entries);h.config.render();h.document.getElementById('practiceMode').onclick();
 const pageIds=[...h.config.list.children].map(card=>card.dataset.id),expected=Array.from(h.config.unitIds());assert.deepEqual(pageIds,expected.slice(0,pageIds.length));
 assert.equal(JSON.stringify(h.config.examEntries(true)),source);
 const chapter=h.document.getElementById(course==='os'?'chapter':'chapterSelect');assert(![...chapter.options].some(o=>['HTML 匯入',course==='os'?'作業系統基礎':'基礎與漸進分析'].includes(o.textContent)));
});
test('Chinese and English aliases merge into one visible topic; generic imports use the question, custom topics remain intact',async()=>{
 const h=await loadCourse('os',{live:live.os}),tools=h.window.courseTopicOrder;
 for(const category of ['Interrupt','中斷'])assert.equal(tools.topic({category,stem:'中斷類型'},'os','basics').label,'中斷');
 assert.equal(tools.topic({category:'HTML 匯入',stem:'What are cloud computing service models?'},'os','basics').label,'雲端服務');
 assert.equal(tools.topic({category:'CPU 排程',stem:'What is the time quantum in Round Robin?'},'os','scheduling').label,'RR 時間片');
 assert.equal(tools.topic({category:'我自己的分類',stem:'What is the time quantum in Round Robin?'},'os','scheduling').label,'我自己的分類');
 const filter=h.document.getElementById('chapter');filter.value='中斷';filter.dispatchEvent(new h.window.Event('change',{bubbles:true}));
 assert.equal(h.config.list.children.length,6);for(const card of h.config.list.children)assert.equal(card.querySelector('.badge').textContent,'中斷');
});
test('choice types control ordering even for images; text-only answers remain in the fill section',async()=>{
 const h=await loadCourse('algorithms'),tools=h.window.courseTopicOrder,unit={id:'L7'};
 const make=(id,type,answer,opts,images=[])=>({id,i:0,unit,q:{bookmarkId:id,category:'最小值與最大值',type,a:answer,opts,images}});
 const multiple=make('multi','多選題','A、B',['A. One','B. Two'],[{src:'data:image/png;base64,AA=='}]);
 const single=make('single','圖片題','A',['A. One','B. Two'],[{src:'data:image/png;base64,AA=='}]);
 const fill=make('fill','單選題','n-1',[]);
 assert.deepEqual(Array.from(tools.sort([fill,multiple,single],'algorithms',()=>0,entry=>entry.id==='fill'?0:1),e=>e.id),['single','multi','fill']);
});
for(const course of ['os','algorithms'])test(course+' freshly synchronized generic imports join their topic instead of staying at the end',async()=>{
 const h=await loadCourse(course,{live:live[course]}),updated=structuredClone(live[course]);
 const id='community-11111111-1111-4111-8111-111111111111-1',unit=course==='os'?'basics':'L7';
 const raw=course==='os'?{id,type:'單選題',category:'HTML 匯入',stem:'Which cloud computing service is IaaS?',options:['Infrastructure','Application'],answer:'A',answerProvided:true,explanation:'IaaS 提供基礎設施。',images:[]}:{bookmarkId:id,type:'單選題',category:'HTML 匯入',q:'找出最小值需要幾次比較？',opts:['n-1','n'],a:'A',answerProvided:true,ex:'從候選中淘汰到只剩一個。',images:[]};
 updated.questions.push({unit,question:raw});h.respond(updated);await new Promise(r=>setImmediate(r));
 const entries=assertOrder(h,course).filter(e=>e.unitId===unit),index=entries.findIndex(e=>e.id===id);assert(index>=0&&index<entries.length-1);
 const label=h.window.courseTopicOrder.topic(entries[index].q,course,unit).label;assert.equal(label,course==='os'?'雲端服務':'最小值與最大值');
 assert(entries.slice(index+1).some(e=>h.window.courseTopicOrder.topic(e.q,course,unit).label===label&&h.window.courseTopicOrder.typeRank(e.q)>0));
 assert.equal(h.config.questionForEdit(id).answer,raw.answer??raw.a);
});
for(const course of ['os','algorithms'])test(course+' linked questions and displayed numbers follow sorted pages, including imported questions',async()=>{
 const probe=await loadCourse(course,{live:live[course]}),entries=assertOrder(probe,course),size=course==='os'?20:10;
 const target=entries.filter(e=>e.id.startsWith('community-')).find(e=>entries.filter(x=>x.unitId===e.unitId).findIndex(x=>x.id===e.id)>=size);assert(target);
 const unitEntries=entries.filter(e=>e.unitId===target.unitId),number=unitEntries.findIndex(e=>e.id===target.id)+1;
 const h=await loadCourse(course,{live:live[course],linkedQuestion:target.id});
 assert.equal(h.config.questionDetails(target.id).number,number);assert.equal(h.config.currentPage(),Math.floor((number-1)/size)+1);
 const card=h.config.list.querySelector(`[data-id="${target.id}"]`);assert(card,'linked card must be on the rendered page');assert.equal(card.querySelector('.qid').textContent,'#'+String(number).padStart(3,'0'));
 const chapter=h.document.getElementById(course==='os'?'chapter':'chapterSelect');chapter.value=h.window.courseTopicOrder.topic(target.q,course,target.unitId).label;chapter.dispatchEvent(new h.window.Event('change',{bubbles:true}));
 for(const filteredCard of h.config.list.children){const expected=unitEntries.findIndex(e=>e.id===filteredCard.dataset.id)+1;assert.equal(filteredCard.querySelector('.qid').textContent,'#'+String(expected).padStart(3,'0'));}
});
