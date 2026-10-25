import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {parseBatchInput} from '../assets/batch-import.mjs';
import {buildIndex,matchQuestions} from '../assets/batch-model.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('revised asymptotic question and its previous wording both resolve to the same stable ID',()=>{
 const units=JSON.parse(read('algorithms.html').match(/<script id="course-data"[^>]*>(.*?)<\/script>/s)[1]);
 const q=units.flatMap(u=>u.questions).find(q=>q.bookmarkId==='L2-008');
 const alias=JSON.parse(read('assets/batch-search-aliases.json'))['L2-008'].find(s=>typeof s==='string'&&s.includes('最壞情況'));
 assert.ok(alias);
 const index=buildIndex(JSON.parse(read('assets/batch-library.json')).entries);
 for(const stem of [q.q,alias]){
  const questions=parseBatchInput('題目 1. 【填空題】'+stem,{document:parseHTML('<html><body></body></html>').document}).questions;
  const [result]=matchQuestions(questions,index,{course:'algorithms'});
  assert.equal(result.status,'matched',stem);assert.ok(result.answer);
  assert.ok(result.references.some(ref=>ref.id==='L2-008'));
 }
});
