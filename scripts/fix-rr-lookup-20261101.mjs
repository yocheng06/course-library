import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let html=await readFile('os.html','utf8');
const pattern=/(<script id="course-unit-scheduling"[^>]*>)([\s\S]*?)(<\/script>)/;
const questions=JSON.parse(html.match(pattern)[2]);
const original=JSON.stringify(questions.map(({answerConditions,...q})=>q));
const source=questions.find(q=>q.id==='os6-038');
const condition=source.sourceVariants.flatMap(q=>q.answerConditions||[]).find(c=>c.includes('CPU burst'));
assert(condition,'Missing previously verified RR condition');
for(const id of ['os6-038','os6-125']){
  const q=questions.find(q=>q.id===id);assert(q,id);
  q.answerConditions=[...new Set([...(q.answerConditions||[]),condition])];
}
assert.equal(JSON.stringify(questions.map(({answerConditions,...q})=>q)),original);
html=html.replace(pattern,(_,a,b,c)=>a+JSON.stringify(questions).replace(/</g,'\\u003c')+c);
await writeFile('os.html',html);
console.log('Aligned the existing RR qualification across both canonical records; stems, answers, options and order preserved.');
