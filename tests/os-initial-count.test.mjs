import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {parseOSCourseHTML} from '../scripts/course-data.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('os.html'), source=read('assets/os-learning.js');
const units=parseOSCourseHTML(html), l8=units.find(u=>u.id==='deadlocks');
const snapshot=JSON.parse(read('content/os-public-question-snapshot.json'));
const l8AdditionAudit=JSON.parse(read('content/os-l8-additions-20261024.json'));
const historicalIds=new Set(l8AdditionAudit.orderedIds);
const aliases=new Map(units.flatMap(unit=>Object.entries(unit.questionAliases||{})));
const isCurrentOrAliased=id=>units.some(unit=>unit.questions.some(question=>question.id===id))||aliases.has(id);
const canonicalId=id=>aliases.get(id)||id;

test('the embedded data and navigation show the complete L8 count before any request',()=>{
  assert.equal(l8.questions.length,134);
  assert.equal(l8.questionCount,134);
  assert.deepEqual(l8.questionIds,l8.questions.map(q=>q.id));
  assert.equal(units.reduce((sum,u)=>sum+u.questionCount,0),716);
  assert.ok(html.includes('7 個單元 · 716 道題目'));
  for(const id of historicalIds)assert.ok(isCurrentOrAliased(id),id);
  const nodes={};
  const context={UNITS:units,active:units.indexOf(l8),guides:{},esc:s=>s,unitNumber:i=>String(i+2).padStart(2,'0'),
    $:id=>nodes[id]??=( {} ),document:{querySelectorAll:()=>[]}};
  vm.runInNewContext(source.slice(source.indexOf('function refreshUnitNavigation()'),source.indexOf('function ',source.indexOf('function refreshUnitNavigation()')+10)),context);
  context.refreshUnitNavigation();
  assert.equal(nodes.unitCount.textContent,134);
  assert.ok(nodes.units.innerHTML.includes('134 題'));
  assert.ok(nodes.unitPicker.innerHTML.includes('134 題'));
  assert.ok(!source.includes('setCountSyncState'));
});

test('existing public IDs remain built in and a later sync does not add them twice',()=>{
  const all=units.flatMap(u=>u.questions), known=new Set([...all.map(q=>q.id),...aliases.keys()]);
  const pending=new Map(), counts=units.map(u=>u.questionCount);
  for(const id of snapshot.questionIds) assert.ok(known.has(id),id);
  const context={UNITS:structuredClone(units),active:units.findIndex(u=>u.id==='deadlocks'),knownQuestionIds:known,communityQuestionIds:new Set(),
    communityAliases:new Map(),communityQuestionUnit:new Map(),questionUnitIndex:new Map(),
    loadedUnits:new Set(),pendingCommunityQuestions:pending,questionEntries:[],unitData:new Map(),
    builtinDeletedIds:new Set(),builtinOverrides:new Map(),feedback:new Map(),revealed:new Map(),selections:new Map(),window:{},canonicalId};
  const start=source.indexOf('function mergeCommunityQuestions(');
  vm.runInNewContext(source.slice(start,source.indexOf('window.courseLearning=',start)),context);
  const entries=snapshot.questionIds.map(id=>{
    const idToKeep=canonicalId(id),unit=units.find(u=>u.questions.some(q=>q.id===idToKeep));
    return {unit:unit.id,question:unit.questions.find(q=>q.id===idToKeep)};
  });
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
  assert.equal(batch.courses.os.count,716);
  for(const id of snapshot.questionIds){
    assert.ok(batch.entries.some(q=>q.id===canonicalId(id)),id);
    assert.ok(submissions.some(q=>q.canonicalId===canonicalId(id)),id);
  }
});

test('L6 imports use a fresh canonical ID and retain the old question redirect',()=>{
  const unit=units.find(u=>u.id==='scheduling'),ids=new Set(unit.questionIds);
  assert.equal(unit.questions.length,119);
  assert.equal(unit.questionCount,119);
  assert.equal(unit.questionAliases['os6-117'],'os6-046');
  for(const alias of Object.keys(unit.questionAliases))assert.ok(!ids.has(alias),alias);
  const q=unit.questions.find(q=>q.id==='os6-118');
  assert.equal(q.answer,'I/O');
  assert.deepEqual(q.sourceRecords,[141,172,261]);
});
