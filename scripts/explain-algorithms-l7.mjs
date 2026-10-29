import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const explanations=JSON.parse(fs.readFileSync('content/algorithms-l7-explanations-20261029.json','utf8'));
const path='algorithms.html', html=fs.readFileSync(path,'utf8');
const re=/(<script id="course-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
const units=JSON.parse(html.match(re)[2]), unit=units.find(u=>u.id==='L7');
assert.equal(unit.questions.length,60); assert.equal(Object.keys(explanations).length,60);
const identity=q=>JSON.stringify({...q,ex:undefined});
const before=unit.questions.map(identity);
for(const q of unit.questions){assert.ok(explanations[q.sourceId]?.length>50,q.sourceId);q.ex=explanations[q.sourceId];}
assert.deepEqual(unit.questions.map(identity),before);
fs.writeFileSync(path,html.replace(re,(_,a,b,c)=>a+JSON.stringify(units)+c).replace('algorithm-l7-20261029','algorithm-l7-explanations-20261029'));
const catalogPath='contribution-service/builtin-questions.json';
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));let count=0;
for(const item of catalog.filter(x=>x.course==='algorithms'&&x.unit==='L7')){
 const q=unit.questions.find(q=>q.bookmarkId===item.id);assert.ok(q,item.id);
 item.question.ex=q.ex;
 item.sourceHash=crypto.createHash('sha256').update(JSON.stringify(item.question)).digest('hex');count++;
}
assert.equal(count,60);
fs.writeFileSync(catalogPath,JSON.stringify(catalog)+'\n');
const jsPath='assets/algorithms-learning.js';
fs.writeFileSync(jsPath,fs.readFileSync(jsPath,'utf8').replace('本章答案沿用同學分享的題庫，未提供的解析留白。','本章 60 題已補上解析；答案沿用分享題庫，定義差異、缺少條件或來源答案疑義會在解析中說明。'));
fs.writeFileSync('docs/algorithms-l7-explanations-20261029.json',JSON.stringify({questions:60,explanations:60,preservedQuestionAnswerOptionsAndOrder:true,references:[{title:'Yale — MedianFinding',url:'https://www.cs.yale.edu/homes/aspnes/pinewiki/MedianFinding.html'},{title:'UMass CS311 — Honors discussion',url:'https://people.cs.umass.edu/~barring/cs311f03/honors/'},{title:'MIT 6.046J — Median finding lecture',url:'https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/461c3f2a75384eaaffce53f66f153a50_EzeYI7p9MjU.pdf'}],sourceCaveats:['2472','2491','2493','2497','2505','2511','2515','2516','2517','2519','2522','2525']},null,2)+'\n');
console.log('60 explanations added; all questions, answers, options and ordering preserved.');
