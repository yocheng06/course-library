import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {parseHTML} from 'linkedom';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const files={};for(const n of ['question-tools','choice-answers','practice-feedback','explanation-content','course-exam','counting-sort-walkthrough','selection-explanations','scheduling-walkthrough','algorithms-learning','os-learning','course-bootstrap'])files[n]=await read('assets/'+n+'.js');
function simple(){const window={},context=vm.createContext({window});for(const n of ['explanation-content','question-tools','choice-answers','practice-feedback'])vm.runInContext(files[n],context);return window;}
test('single and multiple correct answers follow content after shuffling, including text answers and translations',()=>{
 const w=simple(),session=w.courseQuestionTools.createOptionSession(()=>0);
 const original={id:'x',stem:'測試題',type:'多選題',answer:'A、C',options:['A. One','B. Two','C. Three'],optionTranslations:['A. 一','B. 二','C. 三'],explanation:'One 和 Three 符合條件。',answerProvided:true};const before=JSON.stringify(original),q=session.get(original);
 assert.deepEqual(Array.from(q.optionOrder),[1,2,0]);assert.deepEqual(Array.from(q.options),['A. Two','B. Three','C. One']);assert.deepEqual(Array.from(q.optionTranslations),['二','三','一']);assert.equal(q.answer,'B、C');assert.equal(q.choiceKey,'BC');
 assert.equal(w.coursePractice.evaluate(q.answer,q.options,[1,2],q).correct,true);assert.equal(w.coursePractice.evaluate(q.answer,q.options,[0,2],q).correct,false);assert.equal(w.coursePractice.evaluate(q.answer,q.options,[1],q).correct,false);
 assert.deepEqual(Array.from(session.sourceChoices('x',[1,2])),[2,0]);assert.equal(JSON.stringify(original),before);
 const text=session.get({...original,id:'text',answer:'Two',type:'單選題'});assert.equal(text.answer,'A');assert.equal(w.coursePractice.evaluate(text.answer,text.options,[0],text).correct,true);
});
test('a session stays stable across copies, rendering and retries, while a new round chooses again',()=>{
 const w=simple();let phase=0,calls=0;const session=w.courseQuestionTools.createOptionSession(()=>{calls++;return phase;});const raw={id:'x',answer:'A',options:['A. One','B. Two','C. Three'],answerProvided:true};
 const first=session.get(raw);const count=calls;assert.equal(JSON.stringify(session.get({...raw})),JSON.stringify(first));assert.equal(calls,count);
 phase=.99;assert.equal(JSON.stringify(session.get(raw)),JSON.stringify(first));session.reset();assert.notEqual(JSON.stringify(session.get(raw).optionOrder),JSON.stringify(first.optionOrder));
 const changed={...raw,options:['A. One','B. Changed','C. Three']};session.get(changed);assert(calls>count+2);
});
test('dependent options, malformed answers and incomplete translations keep source order',()=>{
 const w=simple(),session=w.courseQuestionTools.createOptionSession(()=>0);
 for(const option of ['以上皆是','以上皆非','A 與 B','A+B','Both A and B','All of the above','None of the above','前兩項皆正確']){
  const raw={id:option,answer:'A',options:['A. One','B. '+option],answerProvided:true};assert.strictEqual(session.get(raw),raw,option);
 }
 for(const raw of [{answer:'Z',options:['One','Two'],answerProvided:true},{answer:'A',options:['One','Two'],optionTranslations:['只有一項'],answerProvided:true},{answer:'A',options:['One','Two'],answerProvided:false},{answer:'A',options:[],answerProvided:true}])assert.strictEqual(session.get(raw,'x'),raw);
 const unreviewed={id:'later-edit',answer:'A',options:['A. One','B. Two'],answerProvided:true,explanation:'答案 A，B 不選。'};assert.strictEqual(session.get(unreviewed),unreviewed);
});
async function page(course){
 const {window,document}=parseHTML(await read(course+'.html'));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 window.window=window;window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.removeAttribute('open');};window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://example.com'};
 const randomMath=Object.create(Math);randomMath.random=()=>0;
 const context=vm.createContext({window,document,Math:randomMath,location:{search:'',protocol:'https:'},URLSearchParams,navigator:{onLine:true},AbortSignal,Date,console,requestAnimationFrame:f=>f(),scrollX:0,scrollY:0,innerHeight:900,CSS:{escape:String},localStorage:{getItem:()=>null,setItem:()=>{}},fetch:()=>new Promise(()=>{})});
 for(const n of ['explanation-content','question-tools','choice-answers','practice-feedback',...(course==='os'?['scheduling-walkthrough']:['counting-sort-walkthrough','selection-explanations']),course+'-learning','course-bootstrap','course-exam'])vm.runInContext(files[n],context);
 const click=selector=>{const el=document.querySelector(selector);assert(el,selector);el.click?el.click():el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 return {window,document,click};
}
for(const course of ['os','algorithms'])test(course+' practice grades shuffled positions, preserves order and responses across rerender, and leaves reading/source untouched',async()=>{
 const h=await page(course),config=h.window.courseLearning,source=JSON.stringify(config.examEntries(true));
 h.document.getElementById('practiceMode').onclick();
 const cards=()=>[...config.list.querySelectorAll('.card')],card=cards().find(c=>{
  const q=config.questionForEdit(c.dataset.id);return q&&(q.options??q.opts??[]).length===4&&h.window.courseQuestionTools.createOptionSession(()=>0).safe(h.window.courseExplanationContent.apply(q),q.options??q.opts??[]);
 });assert(card,'shuffleable practice card');
 const id=card.dataset.id,raw=config.questionForEdit(id),options=raw.options??raw.opts,originalKey=raw.choiceKey||h.window.courseChoiceAnswers.expectedChoiceKey(raw.answer??raw.a,options);
 const order=[1,2,3,0],correct=order.map((old,i)=>originalKey.includes(String.fromCharCode(65+old))?i:-1).filter(i=>i>=0);
 const initialOptions=[...card.querySelectorAll('.option')].map(o=>o.textContent);
 for(const i of correct){const input=card.querySelector(`[data-index="${i}"]`);input.checked=true;input.setAttribute('checked','');input.dispatchEvent(new h.window.Event('change',{bubbles:true}));}
 card.querySelector('[data-reveal]').dispatchEvent(new h.window.Event('click',{bubbles:true}));assert.match(card.querySelector('.practice-feedback').textContent,/答對/);
 config.render();let rendered=config.list.querySelector(`[data-id="${id}"]`);assert.deepEqual([...rendered.querySelectorAll('.option')].map(o=>o.textContent.replace(/[✓✔]/g,'')),initialOptions);
 assert.equal(rendered.querySelectorAll('[data-choice]:checked').length,correct.length);
 h.document.getElementById('studyMode').onclick();h.document.getElementById('practiceMode').onclick();rendered=config.list.querySelector(`[data-id="${id}"]`);assert.deepEqual([...rendered.querySelectorAll('.option')].map(o=>o.textContent),initialOptions);
 assert.equal(JSON.stringify(config.examEntries(true)),source);config.resetPractice();assert.equal(config.list.querySelectorAll('[data-choice]:checked').length,0);
});
test('exam closes and reopens without changing options; submission uses shuffled keys and content explanations',async()=>{
 const h=await page('algorithms');h.click('#examMode');h.click('[data-exam-start]');
 const before=h.document.querySelector('[data-exam-questions]').innerHTML;h.click('[data-exam-close]');h.click('#examMode');assert.equal(h.document.querySelector('[data-exam-questions]').innerHTML,before);
 const originals=new Map(h.window.courseLearning.examEntries(true).map(e=>[e.id,e.q]));
 for(const card of h.document.querySelectorAll('.exam-card')){
  const raw=originals.get(card.dataset.examQuestionId),opts=raw.options??raw.opts??[];
  if(opts.length){const key=raw.choiceKey||h.window.courseChoiceAnswers.expectedChoiceKey(raw.answer??raw.a,opts);for(const letter of key){const input=card.querySelector(`[data-original-index="${letter.charCodeAt(0)-65}"]`);input.checked=true;input.setAttribute('checked','');input.dispatchEvent(new h.window.Event('change',{bubbles:true}));}}
  else {const input=card.querySelector('textarea');input.value=raw.answer??raw.a;input.dispatchEvent(new h.window.Event('input',{bubbles:true}));}
 }
 h.click('[data-exam-submit]');assert.match(h.document.querySelector('[data-exam-results]').textContent,/100 分/);assert(h.document.querySelectorAll('.option.correct').length>0);
});
