/* OS question-bank interactions, retaining stable question IDs. */
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guides = {
  basics:'把作業系統想成電腦的管理員：協調 CPU、記憶體與裝置，讓應用程式使用資源。讀題時先分清楚硬體、作業系統與應用程式的角色。',
  architecture:'把 system call 想成向核心提出服務申請：應用程式透過 API 表達需求，再由作業系統執行。先分清楚使用者模式與核心模式，再比較不同系統架構。',
  process:'程式像食譜，程序像正在依食譜做菜的工作。先分清楚程序狀態、排程與 context switch，再比較 shared memory 和 message passing 如何交換資訊。',
  threads:'執行緒像同一個工作裡分頭處理的小組：共享程序資源，但各自保有執行狀態。先分清楚 user thread 與 kernel thread，再看執行緒模型、函式庫和多核心效能。',
  synchronization:'程序同步用來協調並行存取共享資料的順序。先掌握臨界區解法的互斥、進度與有限等待，再比較 Mutex、Semaphore、Monitor；生產者／消費者、讀者／寫者與哲學家進餐題要逐步追蹤資源計數及 wait／signal 的順序。',
  scheduling:'CPU 排程決定就緒佇列中誰先使用 CPU。先分清楚搶佔式與非搶佔式，再比較 FCFS、SJF、RR 與優先權排程；計算時注意到達時間、CPU burst、時間片，以及等待、周轉與回應時間的差別。'
};
let active = 0, page = 1, totalPages = 1, mode = 'study';
const pageSize = 20, drafts = new Map(), selections = new Map(), revealed = new Set(), feedback = new Map();
const kind = window.courseQuestionTools.questionType;
const unitNumber = i => String(i + 2).padStart(2, '0');
const questionEntries = UNITS.flatMap((unit, unitIndex) => unit.questions.map((q, i) => ({q, unit, unitIndex, i})));
document.querySelector('[data-course-total]').textContent = `${UNITS.length} 個單元 · ${questionEntries.length} 道題目`;
const allUnits = () => $('searchScopeSelect').value === 'all';
const scopedEntries = () => allUnits() ? questionEntries : questionEntries.filter(entry => entry.unitIndex === active);
const communityAliases = new Map();
const findEntry = id => questionEntries.find(entry => entry.q.id === (communityAliases.get(id) || id) || entry.q.aliases?.includes(id));
function refreshFilters() {
  const entries = scopedEntries();
  window.courseQuestionTools.populateSelect($('chapter'), entries.map(({q}) => q.category), 'all', '全部章節');
  window.courseQuestionTools.populateSelect($('typeSelect'), entries.map(({q}) => kind(q)), 'all', '全部題型');
}
function highlighted(value) {
  const text = String(value ?? ''), terms = [...new Set($('search').value.trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return esc(text);
  const re = new RegExp(terms.sort((a,b) => b.length-a.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi');
  let out = '', last = 0;
  for (const m of text.matchAll(re)) { out += esc(text.slice(last,m.index))+'<mark>'+esc(m[0])+'</mark>'; last=m.index+m[0].length; }
  return out + esc(text.slice(last));
}
function matches() {
  return scopedEntries().filter(({q}) => (!window.learningUI?.reviewOnly || window.learningUI.isSaved(q.id)) &&
    ($('chapter').value === 'all' || q.category === $('chapter').value) &&
    ($('typeSelect').value === 'all' || kind(q) === $('typeSelect').value) &&
    ($('qualitySelect').value !== 'pending' || window.courseQuestionTools.qualityReasons(q, 'os').length > 0) &&
    window.courseQuestionTools.matchesSearch(q, $('search').value));
}
function refreshUnitNavigation() {
  const i = active, u = UNITS[i];
  document.querySelectorAll(".community-course-link").forEach(link => { link.href = `submit.html?course=os&unit=${encodeURIComponent(u.id)}`; });
  $('unitPicker').innerHTML = UNITS.map((v,j) => `<option value="${j}">UNIT ${unitNumber(j)} · ${esc(v.label)} · ${v.questions.length} 題</option>`).join('');
  $('unitPicker').value = i;
  $('title').textContent=u.label; $('unitEn').textContent=u.en; $('description').textContent=u.desc; $('unitCount').textContent=u.questions.length;
  $('guideText').textContent = guides[u.id] || '先理解本單元的概念，再用題目練習，對照原答案與解析。';
  $('units').innerHTML = UNITS.map((v,j) => `<button class="course-nav ${j===i?'active':''}" data-unit="${j}" aria-pressed="${j===i}"><span class="course-copy"><span class="unit-number">UNIT ${unitNumber(j)}</span><span class="unit-row"><strong>${esc(v.label)}</strong><span class="unit-count">${v.questions.length} 題</span></span><small class="unit-en">${esc(v.en)}</small></span></button>`).join('');
}
function switchUnit(i) {
  active = i; page = 1; revealed.clear();
  if (!allUnits()) $('search').value = '';
  refreshUnitNavigation(); refreshFilters(); render();
}
function answerMarkup(q) {
  return `<div class="answer" id="answer-${q.id}"><div><strong>${window.courseQuestionTools.answerLabel(q)}</strong><br><span class="answer-value">${highlighted(q.answer)}</span></div>${q.note?`<div class="warning"><strong>題目備註</strong><br>${highlighted(q.note)}</div>`:''}${q.explanation?`<div class="explain"><strong>解析</strong><div class="explanation-text">${window.courseQuestionTools.explanationMarkup(q, highlighted)}</div></div>`:q.terms?.length?`<div class="explain"><strong>相關名詞與作用</strong>${q.terms.map(t=>`<div class="term"><b>${highlighted(t.label)}</b><br>${highlighted(t.text)}</div>`).join('')}</div>`:'<div class="explain">原始題庫尚未提供本題詳細解析。</div>'}${window.courseQuestionTools.reviewMarkup(q)}</div>`;
}
function optionMarkup(q, option, index) {
  const text = String(option ?? ''), match = text.match(/^([A-H][.、．:：])(\s*)([\s\S]*)$/);
  const content = match ? `<span class="option-label">${highlighted(match[1])}</span>${esc(match[2])}${highlighted(match[3])}` : highlighted(text);
  const translation = q.optionTranslations?.[index];
  return `<span class="option-content">${content}${translation ? `<span class="option-translation" lang="en">${highlighted(translation)}</span>` : ''}</span>`;
}
function expectedOptionKeys(q, options) {
  if (!window.courseQuestionTools.hasProvidedAnswer(q)) return new Set();
  const expected = q.choiceKey || window.coursePractice?.expectedChoiceKey(q.answer, options);
  return new Set(String(expected || ''));
}
function updateCorrectOptions(card, q, visible) {
  const correctKeys = visible && mode === 'study' && q?.options?.length ? expectedOptionKeys(q, q.options) : new Set();
  card.querySelectorAll('.option').forEach((option, index) => {
    option.classList.toggle('correct', correctKeys.has(String.fromCharCode(65 + index)));
  });
}
function cardMarkup({q, unit, unitIndex, i}) {
  const practice = mode === 'practice', open = revealed.has(q.id) || (!practice && $('showAnswers').checked), chosen = selections.get(q.id) || [];
  const result = feedback.get(q.id);
  const correctKeys = !practice && open ? expectedOptionKeys(q, q.options || []) : new Set();
  const options = q.options?.length ? `<div class="options">${q.options.map((o,k)=>practice?`<label class="option ${chosen.includes(k)?'chosen':''}"><input type="${window.courseQuestionTools.answerType(q)==='多選題'?'checkbox':'radio'}" name="choice-${q.id}" data-choice="${q.id}" data-index="${k}" ${chosen.includes(k)?'checked':''}><span>${optionMarkup(q,o,k)}</span></label>`:`<div class="option ${correctKeys.has(String.fromCharCode(65+k))?'correct':''}">${optionMarkup(q,o,k)}</div>`).join('')}</div>` : '';
  const pending = window.courseQuestionTools.qualityReasons(q, 'os').length > 0;
  return `<article class="card" data-id="${q.id}"><div class="cardtop"><div class="badges">${allUnits()?`<span class="badge unit-badge">UNIT ${unitNumber(unitIndex)} · ${esc(unit.label)}</span>`:''}<span class="badge">${highlighted(q.category)}</span><span class="badge neutral">${kind(q)}</span>${pending?'<span class="badge gold">待確認</span>':''}</div><span class="qid">#${String(i+1).padStart(3,'0')}</span></div><h3 class="question" tabindex="-1">${highlighted(q.stem)}</h3>${q.translation?`<p class="translation">${highlighted(q.translation)}</p>`:''}${window.courseQuestionTools.searchMatchMarkup(q, $('search').value)}${window.courseQuestionTools.qualityMarkup(q,'os')}${window.courseQuestionTools.questionImagesMarkup(q)}${options}${practice&&!q.options?.length?`<textarea class="entry" data-draft="${q.id}" aria-label="${q.id} 你的答案" placeholder="先寫下你的答案或解題想法…">${esc(drafts.get(q.id)||'')}</textarea>`:''}${practice||!$('showAnswers').checked?`<button class="reveal" data-reveal="${q.id}" aria-controls="answer-${q.id}" aria-expanded="${open}">${open?'收起答案':practice?'對照答案與解析':'查看答案與解析'}</button>`:''}${practice&&result&&open?window.coursePractice.markup(result,q.id):''}<div data-answer="${q.id}" ${open?'':'hidden'}>${answerMarkup(q)}</div></article>`;
}
function render(preserveCards = false) {
  const filtered=matches(), entries=scopedEntries(), pages=Math.max(1,Math.ceil(filtered.length/pageSize)); page=Math.min(page,pages); totalPages=pages;
  const start=(page-1)*pageSize;
  $('qualitySelect').options[1].textContent=`待確認（${entries.filter(({q})=>window.courseQuestionTools.qualityReasons(q,'os').length).length} 題）`;
  $('resultCount').innerHTML=`<strong>${allUnits()?'全部單元':'目前單元'} · ${$('chapter').value==='all'?'全部章節':esc($('chapter').value)}</strong> · ${filtered.length} / ${entries.length} 題`;
  $('pageRange').textContent=filtered.length?`${start+1}–${Math.min(start+pageSize,filtered.length)} · 第 ${page} / ${pages} 頁`:'0 題';
  const visible=filtered.slice(start,start+pageSize), cards=[...$('cards').children];
  if (!preserveCards || visible.length!==cards.length || visible.some(({q},index)=>q.id!==cards[index].dataset.id))
    $('cards').innerHTML=visible.map(cardMarkup).join('');
  $('empty').hidden=filtered.length!==0;
  $('pager').innerHTML=pages>1?`<button data-page="${page-1}" aria-label="上一頁" ${page===1?'disabled':''}>←</button>`+Array.from({length:pages},(_,i)=>`<button data-page="${i+1}" ${page===i+1?'class="active" aria-current="page"':''} aria-label="第 ${i+1} 頁">${i+1}</button>`).join('')+`<button data-page="${page+1}" aria-label="下一頁" ${page===pages?'disabled':''}>→</button>`:'';
  $('studyMode').classList.toggle('active',mode==='study'); $('practiceMode').classList.toggle('active',mode==='practice');
  $('studyMode').setAttribute('aria-pressed',mode==='study'); $('practiceMode').setAttribute('aria-pressed',mode==='practice');
  $('answerToggle').hidden=mode==='practice'; $('modeHint').hidden=mode!=='practice';
  $('footer').textContent=`共 ${UNITS.length} 個單元 · ${UNITS.reduce((n,u)=>n+u.questions.length,0)} 題`;
  window.learningUI?.refresh();
}
function resetFilters() { window.learningUI?.clearReview(); $('search').value=''; $('chapter').value='all'; $('typeSelect').value='all'; $('qualitySelect').value='all'; page=1; render(); }
function switchMode(next) { mode=next; revealed.clear(); feedback.clear(); render(); }
function toggleAnswer(id,button) {
  const card=button.closest('.card'), panel=card.querySelector('[data-answer]'), open=panel.hidden; panel.hidden=!open;
  if (mode === 'study') updateCorrectOptions(card, findEntry(id)?.q, open);
  if(open) revealed.add(id); else revealed.delete(id);
  button.setAttribute('aria-expanded',String(open)); button.textContent=open?'收起答案':mode==='practice'?'對照答案與解析':'查看答案與解析';
  card.querySelector('.practice-feedback')?.remove();
  if(mode==='practice' && open) {
    const q=findEntry(id).q;
    const result=window.coursePractice.evaluate(q.answer,q.options||[],selections.get(id)||[],q);
    feedback.set(id,result);
    window.coursePractice.show(card,result,id);
  }
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  if(b.dataset.unit!==undefined)switchUnit(Number(b.dataset.unit));
  else if(b.dataset.page){page=Number(b.dataset.page);render();window.courseQuestionTools.focusResults();}
  else if(b.dataset.reveal)toggleAnswer(b.dataset.reveal,b);
});
$('search').addEventListener('input',()=>{page=1;render();});
for(const id of ['chapter','typeSelect','qualitySelect']) $(id).addEventListener('change',()=>{page=1;render();});
$('searchScopeSelect').addEventListener('change',()=>{page=1;refreshFilters();render();});
$('showAnswers').addEventListener('change',()=>{revealed.clear();render();});
$('unitPicker').addEventListener('change',e=>switchUnit(Number(e.target.value)));
$('clear').onclick=resetFilters; $('emptyReset').onclick=resetFilters;
$('studyMode').onclick=()=>switchMode('study'); $('practiceMode').onclick=()=>switchMode('practice');
$('cards').addEventListener('input',e=>{if(e.target.dataset.draft)drafts.set(e.target.dataset.draft,e.target.value);});
$('cards').addEventListener('change',e=>{
  const input=e.target,id=input.dataset.choice;if(!id)return;
  const k=Number(input.dataset.index),chosen=selections.get(id)||[];
  selections.set(id,input.type==='radio'?[k]:input.checked?[...new Set([...chosen,k])]:chosen.filter(n=>n!==k));
  const card=input.closest('.card');card.querySelectorAll('.option').forEach(label=>label.classList.toggle('chosen',label.querySelector('input').checked));
  revealed.delete(id);feedback.delete(id);card.querySelector('[data-answer]').hidden=true;
  card.querySelector('.practice-feedback')?.remove();
  const b=card.querySelector('[data-reveal]');b.textContent='對照答案與解析';b.setAttribute('aria-expanded','false');
});
const linkedQuestion = new URLSearchParams(location.search).get('question');
const linkedEntry = findEntry(linkedQuestion);
switchUnit(linkedEntry?.unitIndex ?? 0);
if (linkedEntry) { page=Math.floor(linkedEntry.i/pageSize)+1; render(); window.courseQuestionTools.focusLinkedQuestion(linkedEntry.q.id); }
let waitingForLinkedQuestion = !linkedEntry && /^community-/.test(linkedQuestion || '');
function mergeCommunityQuestions(entries, {openLinkedQuestion = false, aliases = []} = {}) {
  for (const alias of Array.isArray(aliases) ? aliases : []) if (/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(alias?.id) && questionEntries.some(e=>e.q.id===alias.target)) communityAliases.set(alias.id,alias.target);
  let added = 0;
  for (const entry of entries) {
    if (!entry || typeof entry!=='object') continue;
    const {unit:unitId, question:q}=entry;
    const unitIndex=UNITS.findIndex(unit=>unit.id===unitId), unit=UNITS[unitIndex];
    if (!unit || !q || !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(q.id) ||
        typeof q.stem!=='string' || typeof q.answer!=='string' || findEntry(q.id)) continue;
    const i=unit.questions.length; unit.questions.push(q);
    questionEntries.push({q,unit,unitIndex,i}); added++;
  }
  window.learningUI?.refresh();
  if (!added && !communityAliases.size) return {added:0, openedLinkedQuestion:false};
  document.querySelector('[data-course-total]').textContent=`${UNITS.length} 個單元 · ${questionEntries.length} 道題目`;
  const linked=waitingForLinkedQuestion && openLinkedQuestion && findEntry(linkedQuestion);
  if (linked) {
    waitingForLinkedQuestion=false; switchUnit(linked.unitIndex);
    page=Math.floor(linked.i/pageSize)+1; render();
    window.courseQuestionTools.focusLinkedQuestion(linked.q.id);
  } else { refreshUnitNavigation(); refreshFilters(); render(true); }
  return {added, openedLinkedQuestion:Boolean(linked)};
}
window.courseLearning={
  mergeCommunityQuestions, course:'os',toolbar:document.querySelector('.toolbar'),sidebar:document.querySelector('.sidebar'),list:$('cards'),
  unitIds:()=>UNITS[active].questions.map(q=>q.id),
  scopeIds:()=>scopedEntries().map(({q})=>q.id), allUnits,
  scopeLabel:()=>allUnits()?`作業系統 · 全部 ${UNITS.length} 個單元`:`目前單元 · ${UNITS[active].label}`,
  cardTop:card=>card.querySelector('.cardtop'),render,resetPage:()=>{page=1;},
  resolveId:id=>findEntry(id)?.q.id,
  validId:id=>Boolean(findEntry(id)),
  questionLabel:id=>{const entry=findEntry(id);return `${entry.unit.label} 第 ${entry.i+1} 題`;},
  questionDetails:id=>{const {q,unit,i}=findEntry(id);return {course:'os',id,unit:unit.label,number:i+1,question:q.stem,answer:q.answer};},
  currentPage:()=>page, pageCount:()=>totalPages
};
