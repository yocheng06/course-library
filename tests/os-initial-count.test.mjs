import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {parseOSCourseHTML} from '../scripts/course-data.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('os.html'), source=read('assets/os-learning.js');
const units=parseOSCourseHTML(html), l8=units.find(u=>u.id==='deadlocks');
const snapshot=JSON.parse(read('content/os-public-question-snapshot.json'));

test('the embedded data and navigation show the complete L8 count before any request',()=>{
  assert.equal(l8.questions.length,173);
  assert.equal(l8.questionCount,173);
  assert.deepEqual(l8.questionIds,l8.questions.map(q=>q.id));
  assert.equal(units.reduce((sum,u)=>sum+u.questionCount,0),754);
  assert.ok(html.includes('7 個單元 · 754 道題目'));
  const nodes={};
  const context={UNITS:units,active:units.indexOf(l8),guides:{},esc:s=>s,unitNumber:i=>String(i+2).padStart(2,'0'),
    $:id=>nodes[id]??=( {} ),document:{querySelectorAll:()=>[]}};
  vm.runInNewContext(source.slice(source.indexOf('function refreshUnitNavigation()'),source.indexOf('function ',source.indexOf('function refreshUnitNavigation()')+10)),context);
  context.refreshUnitNavigation();
  assert.equal(nodes.unitCount.textContent,173);
  assert.ok(nodes.units.innerHTML.includes('173 題'));
  assert.ok(nodes.unitPicker.innerHTML.includes('173 題'));
  assert.ok(!source.includes('setCountSyncState'));
});

test('existing public IDs remain built in and a later sync does not add them twice',()=>{
  const all=units.flatMap(u=>u.questions), known=new Set(all.map(q=>q.id));
  const pending=new Map(), counts=units.map(u=>u.questionCount);
  for(const id of snapshot.questionIds) assert.ok(known.has(id),id);
  const context={UNITS:structuredClone(units),knownQuestionIds:known,communityQuestionIds:new Set(),
    communityAliases:new Map(),communityQuestionUnit:new Map(),questionUnitIndex:new Map(),
    loadedUnits:new Set(),pendingCommunityQuestions:pending,window:{},canonicalId:id=>id};
  const start=source.indexOf('function mergeCommunityQuestions(');
  vm.runInNewContext(source.slice(start,source.indexOf('window.courseLearning=',start)),context);
  const entries=units.flatMap(u=>u.questions.filter(q=>snapshot.questionIds.includes(q.id)).map(question=>({unit:u.id,question})));
  assert.equal(entries.length,32);
  assert.equal(context.mergeCommunityQuestions(entries).added,0);
  assert.equal(context.mergeCommunityQuestions(entries).added,0);
  assert.deepEqual(context.UNITS.map(u=>u.questionCount),counts);
  assert.equal(pending.size,0);
  assert.equal(new Set(all.map(q=>q.id)).size,all.length);
});

test('search and submission indexes include every embedded public question',()=>{
  const batch=JSON.parse(read('assets/batch-library.json'));
  const submissions=JSON.parse(read('contribution-service/existing-questions.json'));
  assert.equal(batch.courses.os.count,754);
  for(const id of snapshot.questionIds){
    assert.ok(batch.entries.some(q=>q.id===id),id);
    assert.ok(submissions.some(q=>q.canonicalId===id),id);
  }
});
