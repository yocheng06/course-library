import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

async function coursePage(course, {storage = new Map(), search = '', failStorage = false, readingFlow = false} = {}) {
  const {window, document} = parseHTML(await read(course === 'os' ? 'os.html' : 'algorithms.html'));
  Object.defineProperty(document, 'readyState', {value:'loading', configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable:true,
    get() { return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? ''; },
    set(value) { for (const option of this.querySelectorAll('option')) option.toggleAttribute('selected', option.value === String(value)); },
  });
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.window = window;
  window.confirm = () => true;
  const media = () => ({matches:false, addEventListener() {}});
  window.matchMedia = media;
  const context = vm.createContext({
    window, document, Event:window.Event, location:{search}, URLSearchParams, URL, Blob, TextEncoder, Date,
    localStorage:{getItem:key => { if(failStorage) throw new Error('blocked'); return storage.get(key); }, setItem(key,value) { if(failStorage) throw new Error('quota'); storage.set(key,value); }},
    navigator:{clipboard:{writeText:async()=>{}}}, matchMedia:media,
    CSS:{escape:value=>String(value)}, ResizeObserver:class { observe() {} },
    console, requestAnimationFrame:fn=>fn(), queueMicrotask, setTimeout,
  });
  for (const name of ['assets/question-tools.js','assets/choice-answers.js','assets/practice-feedback.js',course === 'os' ? 'assets/os-learning.js' : 'assets/algorithms-learning.js','assets/learning-tools.js','assets/practice-progress.js',...(readingFlow ? ['assets/reading-flow.js'] : [])])
    vm.runInContext(await read(name), context, {filename:name});
  const fire = (element,event) => element.dispatchEvent(new window.Event(event,{bubbles:true,cancelable:true}));
  const click = selector => fire(document.querySelector(selector),'click');
  const choose = (card, indices) => {
    const clear = card.querySelector('[data-clear-response]');
    if (!clear.disabled) fire(clear,'click');
    const inputs = [...card.querySelectorAll('[data-choice]')];
    for (const index of indices) { inputs[index].checked=true; fire(inputs[index],'change'); }
  };
  const check = card => fire(card.querySelector('[data-reveal]'),'click');
  const question = id => vm.runInContext(`findEntry(${JSON.stringify(id)}).q`,context);
  const practice = () => document.getElementById('practiceMode').onclick();
  const cards = () => [...window.courseLearning.list.querySelectorAll('article')];
  return {window, document, context, storage, fire, click, choose, check, question, practice, cards, config:window.courseLearning, progress:window.coursePracticeProgress};
}

test('both courses enable clear after the first selection and disable it after the last checkbox is cleared', async () => {
  for (const course of ['os','algorithms']) {
    const h=await coursePage(course);h.practice();
    for (const type of ['radio','checkbox']) {
      const input=h.document.querySelector(`article input[type="${type}"]`);
      assert(input,`${course} ${type} fixture`);
      const card=input.closest('article'),clear=card.querySelector('[data-clear-response]');
      assert.equal(clear.disabled,true);
      input.checked=true;h.fire(input,'change');assert.equal(clear.disabled,false);
      if(type==='checkbox'){input.checked=false;h.fire(input,'change');assert.equal(clear.disabled,true);}
      else {h.fire(clear,'click');assert.equal(input.checked,false);assert.equal(clear.disabled,true);}
    }
  }
});

test('answer display uses the verified option key and preserves raw fill answers and source data', async () => {
  const h=await coursePage('algorithms'),tools=h.window.courseQuestionTools;
  const q=h.question('L6-009'),before=JSON.stringify(q);
  assert.equal(tools.answerText(q),'A、B');
  const master=h.question('L3-035');
  assert.equal(tools.answerText(master),'A、C、D');
  assert.equal(JSON.stringify(q),before);
  assert.equal(tools.answerText({answer:'process control block',options:[],answerProvided:true}),'process control block');
  assert.equal(tools.answerText({answer:'source wording',options:['A. first'],choiceKey:'Z',answerProvided:true}),'source wording');
  assert.equal(tools.answerValueMarkup({answer:'A',options:['A. <img src=x>'],answerProvided:true}),'A');
});

test('incomplete source data has its own label without changing the provided answer status', async () => {
  const h=await coursePage('os',{search:'?question=os7-278'}),q=h.question('os7-278');
  assert.equal(q.answer,'D. Atomically');
  assert.equal(h.window.courseQuestionTools.qualityReasons(q,'os').length,0);
  const card=h.document.querySelector('article[data-id="os7-278"]');
  assert.match(card.querySelector('.data-incomplete-note').textContent,/資料不完整.*原始選項不完整/);
  assert.equal(card.querySelector('.answer-value').textContent,'D');
});

test('real confirmation tracks first attempts and retries, ignores unchanged checks and clears, and defaults auto review off', async () => {
  for(const course of ['os','algorithms']){
    const h=await coursePage(course);h.practice();
    const card=h.cards().find(card=>card.querySelector('[data-choice]'));
    const q=h.question(card.dataset.id),options=q.options||q.opts;
    const expected=[...(q.choiceKey||h.window.coursePractice.expectedChoiceKey(q.answer||q.a,options))].map(letter=>letter.charCodeAt(0)-65);
    const wrong=expected.length>1?[expected[0]]:[options.findIndex((_,i)=>!expected.includes(i))];
    h.check(card);assert.equal(h.progress.getStats().answered,0);
    h.choose(card,wrong);h.check(card);
    assert.deepEqual(plain(h.progress.getStats()),{answered:1,firstCorrect:0,retries:0,wrong:1,corrected:0});
    assert.equal(h.window.learningUI.isSaved(card.dataset.id),false);
    h.check(card);assert.equal(h.progress.getStats().retries,0);
    h.choose(card,expected);h.check(card);
    assert.deepEqual(plain(h.progress.getStats()),{answered:1,firstCorrect:0,retries:1,wrong:1,corrected:1});
    h.click(`article[data-id="${card.dataset.id}"] [data-clear-response]`);
    assert.equal(h.progress.getStats().retries,1);
    h.progress.record(card.dataset.id,{correct:null},{text:'not graded'});assert.equal(h.progress.getStats().retries,1);
  }
});

test('optional wrong marking persists, a new round preserves bookmarks, and reading-flow refresh wrapping stays compatible', async () => {
  const h=await coursePage('os',{readingFlow:true});h.practice();
  const auto=h.document.querySelector('[data-practice-auto-review]');assert.equal(auto.checked,false);
  auto.checked=true;h.fire(auto,'change');
  const id=h.cards()[0].dataset.id;
  h.progress.record(id,{correct:false},{choices:[1]});
  assert.equal(h.window.learningUI.isSaved(id),true);
  assert.equal(h.document.querySelector('.practice-progress').hidden,false);
  assert.match(h.document.querySelector('.practice-summary').textContent,/已答 1 題/);
  h.click('[data-practice-new-round]');
  assert.deepEqual(plain(h.progress.getStats()),{answered:0,firstCorrect:0,retries:0,wrong:0,corrected:0});
  assert.equal(h.window.learningUI.isSaved(id),true);
  assert.equal(h.document.querySelector('[data-practice-auto-review]').checked,true);
});

test('the current wrong-question deck remains stable after correction when random order is enabled', async () => {
  const h=await coursePage('os');h.practice();
  const ids=h.cards().slice(0,2).map(card=>card.dataset.id);
  for(const id of ids)h.progress.record(id,{correct:false},{text:id});
  const order=h.document.getElementById('practiceOrder');order.value='random';h.fire(order,'change');
  const only=h.document.querySelector('[data-practice-wrong-only]');only.checked=true;h.fire(only,'change');
  const before=h.cards().map(card=>card.dataset.id);assert.equal(before.length,2);
  h.progress.record(before[0],{correct:true},{text:'corrected'});h.config.render();
  assert.deepEqual(h.cards().map(card=>card.dataset.id),before);
  assert.equal(h.progress.getStats().corrected,1);
  h.document.getElementById('clear').onclick();assert.equal(h.progress.onlyWrong,false);assert.equal(h.cards().length,20);
});

test('both courses keep practice statistics after reopening without restoring position', async () => {
  for(const course of ['os','algorithms']){
    const storage=new Map(),h=await coursePage(course,{storage});
    h.click(course==='os'?'[data-unit="4"]':'[data-lesson="L4"]');h.click('#pager [data-page="2"]');
    const question=h.cards()[0]?.dataset.id;assert(question);
    h.progress.record(question,{correct:true},{text:'first'});
    const reopened=await coursePage(course,{storage});
    assert.equal(reopened.config.currentPage(),1);
    assert.equal(reopened.document.getElementById('practiceOrder').value,'ordered');
    assert.equal(reopened.progress.getStats().firstCorrect,1);
    assert.equal(reopened.document.body.classList.contains('course-drawer-collapsed'),false);
    assert.equal(reopened.document.querySelector('.resume-notice'),null);
    const target=course==='os'?'process-11':'L3-035';
    const linked=await coursePage(course,{storage,search:'?question='+target});
    assert(linked.document.querySelector(`article[data-id="${target}"]`));
    assert.equal(linked.document.querySelector('.resume-notice'),null);
    assert.equal(storage.has('course-library.last-course.v1'),false);
  }
});

test('malformed persisted state is ignored and storage failures leave the round usable with an honest notice', async () => {
  const malformed=new Map([['course-library.practice.v1.os','{"version":1,"records":"bad"}']]);
  const h=await coursePage('os',{storage:malformed});assert.equal(h.progress.getStats().answered,0);
  const blocked=await coursePage('os',{failStorage:true});blocked.practice();
  blocked.progress.record('basics-1',{correct:false},{choices:[0]});
  assert.equal(blocked.progress.getStats().answered,1);
  assert.match(blocked.document.querySelector('.practice-storage-warning').textContent,/無法保存/);
  assert.equal(blocked.document.querySelector('.practice-storage-warning').hidden,false);
});

test('cancelling a new round preserves statistics and current response',async()=>{
 const h=await coursePage('os');h.practice();const card=h.cards()[0];
 h.choose(card,[0]);h.check(card);const before=JSON.stringify(h.progress.exportProgress());
 h.window.confirm=()=>false;h.click('[data-practice-new-round]');
 assert.equal(JSON.stringify(h.progress.exportProgress()),before);
 assert.equal(card.querySelector('[data-choice]').checked,true);
});
test('complete backup restores statistics and bookmarks without duplicating attempts and rejects invalid input',async()=>{
 const h=await coursePage('os');h.practice();const id=h.cards()[0].dataset.id;
 h.progress.record(id,{correct:false},{text:'first'});h.progress.record(id,{correct:true},{text:'second'});
 h.window.learningUI.addReview(id,{silent:true});
 vm.runInContext(await read('assets/full-learning-backup.js'),h.context);
 const api=h.window.courseFullLearningBackup,backup=api.exportData();
 const before=JSON.stringify(h.progress.getStats());api.restore(JSON.stringify(backup));api.restore(JSON.stringify(backup));
 assert.equal(JSON.stringify(h.progress.getStats()),before);assert.equal(h.window.learningUI.isSaved(id),true);
 assert.throws(()=>api.restore(JSON.stringify({...backup,course:'algorithms'})),/科目/);
 const malformed=plain(backup);malformed.practice.records[0].attempts=-1;
 assert.throws(()=>api.restore(JSON.stringify(malformed)),/無效/);assert.equal(JSON.stringify(h.progress.getStats()),before);
});

test('multi-blank fields update the draft, survive a rerender and clear together',async()=>{
 const h=await coursePage('algorithms');h.click('[data-lesson="L6"]');h.practice();
 const search=h.document.getElementById('search');search.value=h.question('L6-021').q;h.fire(search,'input');
 const field=h.document.querySelector('[data-fill-index="0"]');assert(field,'multi-blank fixture is visible');
 const card=field.closest('article'),id=card.dataset.id,fields=[...card.querySelectorAll('[data-fill-index]')];
 fields[0].value='1, 2';h.fire(fields[0],'input');fields[1].value='3, 4';h.fire(fields[1],'input');
 assert.equal(card.querySelector('[data-draft]').value,'1, 2 / 3, 4');
 h.config.render();const restored=h.document.querySelector(`article[data-id="${id}"]`);
 assert.equal(restored.querySelector('[data-fill-index="0"]').value,'1, 2');
 h.fire(restored.querySelector('[data-clear-response]'),'click');
 assert([...h.document.querySelector(`article[data-id="${id}"]`).querySelectorAll('[data-fill-index]')].every(field=>field.value===''));
});
test('a failure writing the practice half of a full backup rolls back storage and leaves live state untouched',async()=>{
 const h=await coursePage('os');h.practice();const id=h.cards()[0].dataset.id;h.progress.record(id,{correct:false},{text:'wrong'});
 h.window.learningUI.addReview(id,{silent:true});vm.runInContext(await read('assets/full-learning-backup.js'),h.context);
 const api=h.window.courseFullLearningBackup,raw=JSON.stringify(api.exportData()),before=[...h.storage],stats=JSON.stringify(h.progress.getStats());
 const original=h.context.localStorage.setItem;let fail=true;
 h.context.localStorage.setItem=(key,value)=>{if(fail&&key.includes('.practice.')){fail=false;throw new Error('quota');}original(key,value);};
 assert.throws(()=>api.restore(raw),/無法保存/);assert.deepEqual([...h.storage],before);assert.equal(JSON.stringify(h.progress.getStats()),stats);
});
