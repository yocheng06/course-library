import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),context={window:{}};vm.runInNewContext(readFileSync(new URL('assets/question-tools.js',root),'utf8'),context);const tools=context.window.courseQuestionTools;
const query='2,5,3,0,2,3,0,3';
const q=patch=>({stem:'測試題',answer:'',options:[],type:'填空題',answerProvided:true,...patch});
test('numeric list search preserves order, repeated numbers and numeric boundaries',()=>{
 for(const value of [query,'A=['+query+']','A=2, 5, 3, 0, 2, 3, 0, 3。','２，５，３，０，２，３，０，３'])assert.equal(tools.matchesSearch(q({stem:value}),query),true,value);
 for(const value of ['4329,4057,6507,2839,6436,7720,8355','2,5,0,3,2,3,0,3','2,5,3,2,3,0,3','12,5,3,0,2,3,0,3','2,5,3,0,2,3,0,30','2,5,3,0,2,3,0,3.5','-2,5,3,0,2,3,0,3'])assert.equal(tools.matchesSearch(q({stem:value}),query),false,value);
 assert.equal(tools.matchesSearch(q({stem:'2,5,3,0',answer:'2,3,0,3'}),query),false);
 assert.equal(tools.matchesSearch(q({options:['2,5,3,0','2,3,0,3']}),query),false);
});
test('only fields containing the complete visible sequence are labelled as search hits',()=>{
 const value=q({stem:'Contains scattered digits 2 5 3 0',answer:query,explanation:'3,2,0,5',aliases:[query],originalAnswer:query});
 assert.equal(tools.matchesSearch(value,query),true);assert.match(tools.searchMatchMarkup(value,query),/命中：答案</);assert.doesNotMatch(tools.searchMatchMarkup(value,query),/題幹|解析|修正前/);
 assert.equal(tools.matchesSearch(q({aliases:['格式: '+query],originalAnswer:query}),query),false);
 assert.equal(tools.searchMatchMarkup(q({aliases:[query]}),query),'');
});
test('signed decimal sequences preserve decimal points and accept only comma spacing differences',()=>{
 assert.equal(tools.matchesSearch(q({answer:'-0.25, 0.5, 3.00'}),'-0.25,0.5,3.00'),true);
 assert.equal(tools.matchesSearch(q({answer:'-0.25,0.5,3.00'}),'-0.25,0.5,3.0'),false);
 assert.equal(tools.matchesSearch(q({answer:'0.2,0.5,0.3'}),'0.2, 0.5, 0.3'),true);
});
test('reported radix question is excluded despite a generic array-format example in its hidden old wording',()=>{
 const source=readFileSync(new URL('algorithms.html',root),'utf8'),units=JSON.parse(source.match(/<script id="course-data"[^>]*>(.*?)<\/script>/s)[1]);
 const questions=units.find(u=>u.id==='L6').questions,radix=questions.find(q=>q.bookmarkId==='L6-001');assert.ok(radix.aliases.some(a=>a.includes(query)));
 assert.equal(tools.matchesSearch(radix,query),false);assert.equal(tools.searchMatchMarkup(radix,query),'');assert.ok(questions.some(q=>tools.matchesSearch(q,query)));
});
test('ordinary keyword and full-question searches retain existing formatting normalization',()=>{
 assert.equal(tools.matchesSearch(q({stem:'CPU 排程採用 Round Robin',answer:'time quantum'}),'CPU time quantum'),true);
 assert.equal(tools.matchesSearch(q({stem:'在[__1__]頁表中，每個條目對應一個物理[__2__]。'}),'1. 在 ____________ 頁表中，每個條目對應一個物理 ____________ 。'),true);
});
