import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex,parseQuestions,matchRecordedQuestions,toLibraryQuestion} from '../assets/batch-model.mjs';
const scope={course:'os',unit:'L9'};
const stem='在分段中，邏輯地址由號和組成。 (請用小寫英文回答，字母間留一個空白)';
const input='在分段中，邏輯地址由 [__1__] 號和 ____________ 組成。 (請用小寫英文回答，字母間留一個空白)';
const entry=toLibraryQuestion('os','L9',{id:'legacy',stem,options:[],answer:'segment number/offset'},true);
const lookup=(text,entries=[entry])=>matchRecordedQuestions(parseQuestions('1. '+text),buildIndex(entries),scope)[0];
test('strict lookup recovers an exact unique legacy stem with missing blanks without modifying either source',()=>{
  const before=JSON.stringify(entry);
  const result=lookup(input);
  assert.equal(result.status,'matched');
  assert.equal(result.answer,'segment number/offset');
  assert.equal(JSON.stringify(entry),before);
});
test('legacy recovery rejects changed content, wrong slot counts, missing instructions, images and ambiguous records',()=>{
  assert.equal(lookup(input.replace('分段','分頁')).status,'unmatched');
  assert.equal(lookup(input.replace('[__1__]','')).status,'unmatched');
  assert.equal(lookup(input.replace(/ \(請用.*$/,'')).status,'unmatched');
  assert.equal(lookup(input,[{...entry,stem:stem.replace(/ \(請用.*$/,'')}]).status,'unmatched');
  assert.equal(lookup(input,[{...entry,answer:'segment number'}]).status,'unmatched');
  assert.equal(lookup(input,[{...entry,needsImage:true}]).status,'unmatched');
  assert.equal(lookup(input,[entry,{...entry,id:'other'}]).status,'unmatched');
  assert.equal(lookup(input,[entry,{...entry,id:'other',answer:'offset/segment number'}]).status,'unmatched');
});
test('strict lookup still distinguishes positions and counts when bank blanks exist',()=>{
  const marked={...entry,stem:input};
  assert.equal(lookup(input,[marked]).status,'matched');
  assert.equal(lookup(input.replace('[__1__] 號','號 [__1__]'),[marked]).status,'unmatched');
  assert.equal(lookup(input.replace('____________',''),[marked]).status,'unmatched');
});
