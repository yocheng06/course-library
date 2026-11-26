import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildIndex,matchQuestions,toLibraryQuestion} from '../assets/batch-model.mjs';

// Text extracted by the HTML importer from the user's scheduling export.
const questions=JSON.parse(await readFile(new URL('fixtures/batch-scheduling-html-20261030.json',import.meta.url),'utf8'));
const library=JSON.parse(await readFile(new URL('../assets/batch-library.json',import.meta.url),'utf8'));
const lookup=(qs,entries)=>matchQuestions(qs,buildIndex(entries),{course:'os',unit:'scheduling'});

test('reported scheduling HTML resolves all five identical fill-answer records without changing source text',()=>{
  assert.equal(questions.length,30);
  const expected=new Map([[2,'first-come first-served'],[3,'time quantum'],[17,'realtime_priority_class'],[23,'user mode scheduling'],[24,'multilevel feedback queue']]);
  const original=JSON.stringify(questions);
  const rows=lookup(questions,library.entries);
  for(const [number,answer] of expected){
    const row=rows[number-1];
    assert.equal(row.status,'matched',`${number}: ${row.reason}`);
    assert.equal(row.answer,answer);
    assert.ok(row.references.length>=2);
  }
  assert.equal(JSON.stringify(questions),original);
});

test('identical fill stems cannot hide answer, blank-count, format, condition or image conflicts behind preferred records',()=>{
  const q=questions[2];
  const base=toLibraryQuestion('os','scheduling',{id:'first',stem:q.stem,options:[],answer:'time quantum'},true);
  const second={...base,id:'second',preferred:false};
  assert.equal(lookup([q],[base,second])[0].status,'matched');
  for(const change of [
    {answer:'time slice'},
    {answer:'TIME QUANTUM'},
    {stem:second.stem.replace('____________','____ ____')},
    {conditions:['Only when all processes arrive at time zero']},
    {needsImage:true},
  ]){
    const row=lookup([q],[base,{...second,...change}])[0];
    assert.equal(row.status,'review',JSON.stringify(change));
    assert.equal(row.answer,'');
  }
});

test('the reported RR diagram question remains unanswered but offers the original question for checking',()=>{
  const row=lookup([questions[26]],library.entries)[0];
  assert.equal(row.status,'review');
  assert.equal(row.answer,'');
  assert.match(row.reason,/圖片/);
  assert.ok(row.references.some(ref=>ref.id==='os6-042'));
  const altered={...questions[26],stem:questions[26].stem.replace('TQ = 4','TQ = 5')};
  assert.equal(lookup([altered],library.entries)[0].answer,'');
});
