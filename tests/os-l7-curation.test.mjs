import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {parseHTML} from 'linkedom';
import {loadCourse,orderingIssues} from '../scripts/audit-topic-order-20261102.mjs';
const curation=JSON.parse(readFileSync(new URL('../assets/os-synchronization-curation.json',import.meta.url),'utf8'));
test('all 165 L7 question versions receive content-based explanations and preserve every source question and teacher answer',async()=>{
 const h=await loadCourse('os'),entries=h.config.examEntries(['synchronization']).filter(({id})=>Object.hasOwn(curation.questions,id)),content=h.window.courseExplanationContent;
 assert.equal(entries.length,165);assert.equal(Object.keys(curation.questions).length,165);
 for(const {id,q}of entries){const v=curation.questions[id].versions.find(v=>v.identity===content.identity(q));assert(v,id);const before=JSON.stringify(q),applied=content.apply(q);assert.equal(applied.explanation,v.explanation,id);assert.equal(applied.category,v.category,id);assert.equal(JSON.stringify(q),before);assert.equal(applied.answer,q.answer);assert.equal(applied.stem,q.stem);assert.deepEqual(applied.options,q.options);assert(v.explanation.length>100,id);assert(!/(?:選|選項|答案為|答案是)\s*[A-D](?![A-Za-z])/.test(v.explanation),id);}
 assert.deepEqual(orderingIssues(entries,h.window.courseTopicOrder,'os'),[]);
 const sourceHtml=readFileSync(new URL('../os.html',import.meta.url),'utf8');
 const oldHtml=execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),'show','HEAD:os.html'],{encoding:'utf8',maxBuffer:16*1024*1024});
 const reviewed=JSON.parse(readFileSync(new URL('../content/reviewed-explanations-20261126.json',import.meta.url),'utf8')).questions;
 const data=html=>[...parseHTML(html).document.querySelectorAll('script[type="application/json"]')].filter(s=>!['course-content-explanations','course-community-snapshot'].includes(s.id)).map(s=>{const value=JSON.parse(s.textContent);if(s.id==='course-os-treasure-curation')for(const row of reviewed)if(value.questions?.[row.id])delete value.questions[row.id].explanation;return [s.id,value];});
 assert.deepEqual(data(sourceHtml),data(oldHtml));
});
test('L7 worked examples distinguish lock state, waiting counts, and reader group ownership',async()=>{
 const h=await loadCourse('os');h.config.examEntries(['synchronization']);const text=id=>h.window.courseExplanationContent.text(h.config.questionForEdit(id));
 assert.match(text('os7-015'),/回傳 0/);assert.match(text('os7-022'),/記憶體仍是 7/);
 assert.match(text('os7-026'),/empty=2/);assert.match(text('os7-234'),/S=-2/);assert.match(text('os7-080'),/最後一人使 1 變 0/);
 assert.match(text('os7-061'),/搶佔式排程實際上同樣可能/);assert.match(text('os7-090'),/原子的整組分配/);
});
test('later source edits invalidate old L7 explanations and reordered practice options keep content explanations',async()=>{
 const h=await loadCourse('os');h.config.examEntries(['synchronization']);const content=h.window.courseExplanationContent,q=h.config.questionForEdit('os7-064');
 for(const changed of [{...q,answer:'B'},{...q,stem:q.stem+'修訂'},{...q,explanation:'站主新解析'}]){assert.equal(content.apply(changed),changed);assert.equal(content.category(changed),undefined);}
 const applied=content.apply(q),session=h.window.courseQuestionTools.createOptionSession(()=>0.1),practice=session.get(applied,q.id);
 assert.equal(practice.explanation,applied.explanation);assert(!/選\s*[A-D]/.test(practice.explanation));
});
