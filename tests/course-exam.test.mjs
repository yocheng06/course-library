import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
function harness(course, fixture) {
 const {window,document}=parseHTML(fixture?'<html><body><button id="practiceMode">遮答練習</button></body></html>':read(course+'.html'));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===v)}});
 window.HTMLElement.prototype.focus=function(){};
 window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','')};
 window.HTMLElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'))};
 const context=vm.createContext({window,document,location:{search:''},URLSearchParams,requestAnimationFrame:fn=>fn(),console});
 for(const f of ['question-tools','choice-answers','practice-feedback'])vm.runInContext(read('assets/'+f+'.js'),context);
 if(fixture)window.courseLearning={course,examEntries:all=>all?fixture:fixture.slice(0,3),examUnitLabel:()=> '測試單元'};
 else vm.runInContext(read('assets/'+course+'-learning.js'),context);
 vm.runInContext(read('assets/course-exam.js'),context);
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 const change=(selector,value)=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new window.Event('change',{bubbles:true}));};
 return {window,document,click,change};
}
const fixture=[
 {id:'single',unit:'測試單元',q:{stem:'單選測試',type:'單選題',answer:'B',options:['A. One','B. Two'],answerProvided:true,explanation:'單選解析'}},
 {id:'multi',unit:'測試單元',q:{stem:'多選測試',type:'多選題',answer:'A、C',options:['A. One','B. Two','C. Three'],answerProvided:true,explanation:'多選解析'}},
 {id:'fill',unit:'測試單元',q:{stem:'填空測試',type:'填空題',answer:'safe state',options:[],answerProvided:true,explanation:'填空解析'}},
 {id:'extra',unit:'其他單元',q:{stem:'其他題目',answer:'extra',options:[],answerProvided:true}}
];
for(const course of ['os','algorithms'])test(course+' exam uses current unit or entire course independently of bank filters',()=>{
 const h=harness(course);h.click('#examMode');const bankIds=h.window.courseLearning.unitIds();
 assert.equal(h.window.courseLearning.examEntries(false).length,bankIds.length);
 assert.equal(h.window.courseLearning.examEntries(true).length,course==='os'?770:292);
 h.change('[data-exam-scope]','all');h.click('[data-exam-start]');
 assert.equal(h.document.querySelectorAll('.exam-card').length,20);
 assert.equal(h.document.querySelectorAll('[data-exam-review]:not([hidden])').length,0);
 assert.ok(h.document.querySelector('[data-exam-results]').hidden);
 assert.equal(h.window.courseLearning.unitIds().join(','),bankIds.join(','));
});
test('sampling excludes incomplete/unanswered questions, deduplicates IDs, and caps to available pool',()=>{
 const h=harness('os',fixture),bad={id:'bad',q:{answer:'A',options:['A. yes'],answerProvided:true,missingContext:'missing image'}};
 const sampled=h.window.courseExam.sample([...fixture,fixture[0],bad,{id:'no-answer',q:{options:[]}}],20,()=>.4);
 assert.equal(sampled.length,4);assert.equal(new Set(sampled.map(e=>e.id)).size,4);assert.ok(!sampled.some(e=>e.id==='bad'));
});
function answerCard(h,stem,indices,text){
 const card=[...h.document.querySelectorAll('.exam-card')].find(el=>el.querySelector('h3').textContent===stem);
 if(indices){for(const i of indices){const el=card.querySelector(`input[value="${i}"]`);el.checked=true;el.setAttribute('checked','');el.dispatchEvent(new h.window.Event('change',{bubbles:true}));}}
 else {const el=card.querySelector('textarea');el.value=text;el.dispatchEvent(new h.window.Event('input',{bubbles:true}));}
}
test('single, multi and fill answers are hidden until submit, then grade once and lock responses',()=>{
 const h=harness('os',fixture);h.click('#examMode');h.click('[data-exam-start]');
 answerCard(h,'單選測試',[1]);answerCard(h,'多選測試',[0,2]);answerCard(h,'填空測試',null,'SAFE   STATE');
 h.click('[data-exam-close]');h.click('#examMode');assert.match(h.document.querySelector('[data-exam-progress]').textContent,/3 \/ 3/);
 h.click('[data-exam-submit]');assert.match(h.document.querySelector('[data-exam-results]').textContent,/100 分/);
 assert.ok([...h.document.querySelectorAll('.exam-card input,.exam-card textarea')].every(el=>el.disabled));
 assert.equal(h.document.querySelectorAll('.exam-card .option.correct').length,3);
 assert.match(h.document.querySelector('[data-exam-questions]').textContent,/單選解析/);
});
test('unanswered submission requires a second click; partial multi-select is wrong',()=>{
 const h=harness('os',fixture);h.click('#examMode');h.click('[data-exam-start]');answerCard(h,'多選測試',[0]);
 h.click('[data-exam-submit]');assert.ok(h.document.querySelector('[data-exam-results]').hidden);assert.match(h.document.querySelector('[data-exam-notice]').textContent,/2 題未作答/);
 h.click('[data-exam-submit]');assert.match(h.document.querySelector('[data-exam-results]').textContent,/0 分/);
});
test('fill alternative self-assessment is explicit and reversible; reset starts fresh',()=>{
 const h=harness('os',fixture);h.click('#examMode');h.click('[data-exam-start]');answerCard(h,'填空測試',null,'alternative');
 h.click('[data-exam-submit]');h.click('[data-exam-submit]');
 h.click('[data-exam-self]');assert.match(h.document.querySelector('[data-exam-results]').textContent,/33 分/);assert.match(h.document.querySelector('[data-exam-results]').textContent,/1 題為自行確認/);
 h.click('[data-exam-self]');assert.match(h.document.querySelector('[data-exam-results]').textContent,/0 分/);
 h.click('[data-exam-reset]');assert.equal(h.document.querySelectorAll('.exam-card').length,0);assert.ok(!h.document.querySelector('[data-exam-setup]').hidden);
});

test('multi-blank exam responses use separate fields and grade the joined answer',()=>{
 const entry={id:'two-blanks',unit:'測試單元',q:{stem:'第 [__1__] 格及第 [__2__] 格',type:'填空題',answer:'O(n) / 1,2',options:[],answerProvided:true}};
 const h=harness('os',[entry]);h.click('#examMode');h.click('[data-exam-start]');
 const fields=h.document.querySelectorAll('[data-fill-index]');assert.equal(fields.length,2);
 fields[0].value='O(n)';fields[0].dispatchEvent(new h.window.Event('input',{bubbles:true}));
 fields[1].value='1, 2';fields[1].dispatchEvent(new h.window.Event('input',{bubbles:true}));
 assert.match(h.document.querySelector('[data-exam-progress]').textContent,/1 \/ 1/);
 h.click('[data-exam-submit]');assert.match(h.document.querySelector('[data-exam-results]').textContent,/100 分/);
});

for(const course of ['os','algorithms'])test(course+' custom L2–L5 range includes both boundaries and never draws outside selected units',()=>{
 const h=harness(course),config=h.window.courseLearning;
 h.click('#examMode');const before=config.unitIds().join(','),units=config.examUnits();
 assert.match(units[0].label,/^L2 · /);assert.match(units[3].label,/^L5 · /);
 h.change('[data-exam-scope]','range');h.change('[data-exam-from]',units[0].id);h.change('[data-exam-to]',units[3].id);
 const selectedIds=units.slice(0,4).map(unit=>unit.id),pool=config.examEntries(selectedIds);
 assert.deepEqual([...new Set(pool.map(entry=>entry.unitId))].sort(),[...selectedIds].sort());
 assert.match(h.document.querySelector('[data-exam-range-hint]').textContent,/包含 4 個單元/);
 const eligible=pool.filter(h.window.courseExam.eligible),ids=new Set(eligible.map(entry=>entry.id));
 assert.match(h.document.querySelector('[data-exam-pool]').textContent,new RegExp(`可抽 ${eligible.length} 題`));
 h.click('[data-exam-start]');const cards=[...h.document.querySelectorAll('.exam-card')];assert.equal(cards.length,20);
 assert(cards.every(card=>ids.has(card.dataset.examQuestionId)));
 assert.match(h.document.querySelector('[data-exam-description]').textContent,/L2.*L5/);
 assert.equal(config.unitIds().join(','),before);
});

for(const course of ['os','algorithms'])test(course+' same-unit range works, reversed bounds block start, and range selection survives closing',()=>{
 const h=harness(course),units=h.window.courseLearning.examUnits();h.click('#examMode');
 h.change('[data-exam-scope]','range');h.change('[data-exam-from]',units[2].id);h.change('[data-exam-to]',units[1].id);
 assert.equal(h.document.querySelector('[data-exam-start]').disabled,true);
 assert.equal(h.document.querySelector('[data-exam-from]').getAttribute('aria-invalid'),'true');
 assert.match(h.document.querySelector('[data-exam-range-hint]').textContent,/結束單元不能/);
 h.click('[data-exam-start]');assert.equal(h.document.querySelectorAll('.exam-card').length,0);
 h.change('[data-exam-to]',units[2].id);assert.equal(h.document.querySelector('[data-exam-start]').disabled,false);
 assert.match(h.document.querySelector('[data-exam-range-hint]').textContent,/包含 1 個單元/);
 h.click('[data-exam-close]');h.click('#examMode');assert.equal(h.document.querySelector('[data-exam-from]').value,units[2].id);
 const ids=new Set(h.window.courseLearning.examEntries([units[2].id]).map(e=>e.id));h.click('[data-exam-start]');
 assert([...h.document.querySelectorAll('.exam-card')].every(card=>ids.has(card.dataset.examQuestionId)));
});
