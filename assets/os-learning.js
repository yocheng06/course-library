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
  deadlocks:'死結表示程序彼此等待無法取得的資源或事件。先熟悉互斥、佔用與等待、不可搶佔及循環等待四個必要條件，再區分死結預防、避免、偵測與恢復；銀行家演算法用安全序列判斷是否能安全分配資源。',
  L9:'先用位址繫結理解程式位址如何映射，再連結記憶體保護、連續配置與碎片、分頁與 TLB、頁表及分段。遇到架構案例時，先確認題目指定的處理器世代。',
  treasure:'將補充或練習題匯入這個單元，依題目、選項與答案核對，並保留自己的複習紀錄。',
  scheduling:'CPU 排程決定就緒佇列中誰先使用 CPU。先分清楚搶佔式與非搶佔式，再比較 FCFS、SJF、RR 與優先權排程；計算時注意到達時間、CPU burst、時間片，以及等待、周轉與回應時間的差別。'
};
let active = 0, page = 1, totalPages = 1, mode = 'study';
const pageSize = 20, drafts = new Map(), selections = new Map(), revealed = new Set(), feedback = new Map();
const practiceSequence = window.courseQuestionTools.createPracticeOrder();
const kind = window.courseQuestionTools.questionType;
const unitNumber = i => String(UNITS[i]?.number ?? i + 2).padStart(2, '0');
const unitCaption = i => UNITS[i]?.id === 'treasure' ? '特別單元' : 'UNIT ' + unitNumber(i);
const unitQuestionOrders = new Map();
const unitData = new Map([...document.querySelectorAll('script[data-course-unit]')].map(node => [node.dataset.courseUnit, node.textContent]));
const courseManifest = JSON.parse(document.getElementById('course-manifest').textContent);
const UNITS = courseManifest.map(unit => ({...unit, baseQuestionCount:unit.questionCount, questions: null}));
let builtinOverrides=new Map();
let builtinDeletedIds=new Set();
const questionEntries = [], loadedUnits = new Set(), pendingCommunityQuestions = new Map();
const questionUnitIndex = new Map(), canonicalQuestionId = new Map(), knownQuestionIds = new Set(), communityQuestionIds = new Set(), communityQuestionUnit = new Map();
for (const [unitIndex, unit] of UNITS.entries()) {
  for (const id of unit.questionIds) { questionUnitIndex.set(id, unitIndex); knownQuestionIds.add(id); }
  for (const [alias, id] of Object.entries(unit.questionAliases)) { questionUnitIndex.set(alias, unitIndex); canonicalQuestionId.set(alias, id); knownQuestionIds.add(alias); }
}
function ensureUnitLoaded(unitIndex) {
  const unit = UNITS[unitIndex];
  if (!unit || loadedUnits.has(unitIndex)) return unit;
  const raw = unitData.get(unit.id);
  if (raw === undefined) throw new Error(`找不到 ${unit.label} 的內嵌題目資料。`);
  const questions = JSON.parse(raw).map(q=>builtinOverrides.get(q.id) || q);
  if (!Array.isArray(questions) || questions.length !== unit.baseQuestionCount) throw new Error(`${unit.label} 的題目資料數量不符，請重新載入網站。`);
  unit.questions = questions;
  loadedUnits.add(unitIndex);
  const appendQuestion = (q, i) => questionEntries.push({q, unit, unitIndex, i});
  questions.forEach(appendQuestion);
  for (const q of pendingCommunityQuestions.get(unit.id) || []) appendQuestion(q, unit.questions.push(q) - 1);
  pendingCommunityQuestions.delete(unit.id);
  return unit;
}
function ensureAllUnitsLoaded() { UNITS.forEach((_, index) => ensureUnitLoaded(index)); }
function totalQuestionCount() { return UNITS.reduce((count, unit) => count + unit.questionCount, 0); }
ensureUnitLoaded(0);
document.querySelector('[data-course-total]').textContent = `${UNITS.length} 個單元 · ${totalQuestionCount()} 道題目`;
const allUnits = () => $('searchScopeSelect').value === 'all';
function orderEntries(entries) {
  entries.sort((a,b) => {
    if (a.unitIndex !== b.unitIndex) return a.unitIndex-b.unitIndex;
    const order=unitQuestionOrders.get(a.unit.id);
    const left=order?.get(a.q.id) ?? Number.MAX_SAFE_INTEGER;
    const right=order?.get(b.q.id) ?? Number.MAX_SAFE_INTEGER;
    return left-right || a.i-b.i;
  });
  let previousUnit=-1, number=0;
  for(const entry of entries){
    if(entry.unitIndex!==previousUnit){previousUnit=entry.unitIndex;number=0;}
    entry.displayNumber=++number;
  }
  return entries;
}
function questionDisplayNumber(entry) {
  if(!entry)return 0;
  const ordered=orderEntries(questionEntries.filter(item=>item.unitIndex===entry.unitIndex&&!builtinDeletedIds.has(item.q.id)));
  const index=ordered.findIndex(item=>item.q.id===entry.q.id);
  return index>=0?index+1:entry.i+1;
}
const scopedEntries = () => {
  if (allUnits()) {
    ensureAllUnitsLoaded();
    return orderEntries([...questionEntries].filter(entry=>!builtinDeletedIds.has(entry.q.id)));
  }
  ensureUnitLoaded(active);
  return orderEntries(questionEntries.filter(entry => entry.unitIndex === active && !builtinDeletedIds.has(entry.q.id)));
};
const communityAliases = new Map();
const canonicalId = id => {
  const target = communityAliases.get(id) || id;
  return canonicalQuestionId.get(target) || target;
};
const findEntry = id => {
  const target = canonicalId(id);
  return questionEntries.find(entry => !builtinDeletedIds.has(entry.q.id) && (entry.q.id === target || entry.q.aliases?.includes(id) || entry.q.aliases?.includes(target)));
};
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
    (mode !== 'practice' || window.coursePracticeProgress?.includes(q.id) !== false) &&
    ($('chapter').value === 'all' || q.category === $('chapter').value) &&
    ($('typeSelect').value === 'all' || kind(q) === $('typeSelect').value) &&
    ($('qualitySelect').value !== 'pending' || window.courseQuestionTools.qualityReasons(q, 'os').length > 0) &&
    window.courseQuestionTools.matchesSearch(q, $('search').value));
}
function refreshUnitNavigation() {
  const i = active, u = UNITS[i];
  document.querySelectorAll(".community-course-link").forEach(link => { link.href = `submit.html?course=os&unit=${encodeURIComponent(u.id)}`; });
  $('unitPicker').innerHTML = UNITS.map((v,j)=>({v,j})).sort((a,b)=>Number(unitNumber(a.j))-Number(unitNumber(b.j))).map(({v,j}) => `<option value="${j}">${unitCaption(j)} · ${esc(v.label)} · ${v.questionCount} 題</option>`).join('');
  $('unitPicker').value = i;
  $('title').textContent=u.label; $('unitEn').textContent=u.en; $('description').textContent=u.desc; $('unitCount').textContent=u.questionCount;
  $('guideText').textContent = guides[u.id] || '先理解本單元的概念，再用題目練習，對照原答案與解析。';
  $('units').innerHTML = UNITS.map((v,j)=>({v,j})).sort((a,b)=>Number(unitNumber(a.j))-Number(unitNumber(b.j))).map(({v,j}) => `<button class="course-nav ${j===i?'active':''}" data-unit="${j}" aria-pressed="${j===i}"><span class="course-copy"><span class="unit-number">${unitCaption(j)}</span><span class="unit-row"><strong>${esc(v.label)}</strong><span class="unit-count">${v.questionCount} 題</span></span><small class="unit-en">${esc(v.en)}</small></span></button>`).join('');
}
function switchUnit(i) {
  if (!Number.isInteger(i) || !UNITS[i]) return;
  ensureUnitLoaded(i);
  active = i; page = 1; revealed.clear();
  if (!allUnits()) $('search').value = '';
  refreshUnitNavigation(); refreshFilters(); render();
}
function answerMarkup(q) {
  return `<div class="answer" id="answer-${q.id}"><div><strong>${window.courseQuestionTools.answerLabel(q)}</strong><br><span class="answer-value">${window.courseQuestionTools.answerValueMarkup(q, highlighted)}</span></div>${q.note?`<div class="warning"><strong>題目備註</strong><br>${highlighted(q.note)}</div>`:''}${q.explanation?`<div class="explain"><strong>解析</strong><div class="explanation-text">${window.courseQuestionTools.explanationMarkup(q, highlighted)}</div></div>`:q.terms?.length?`<div class="explain"><strong>相關名詞與作用</strong>${q.terms.map(t=>`<div class="term"><b>${highlighted(t.label)}</b><br>${highlighted(t.text)}</div>`).join('')}</div>`:'<div class="explain">原始題庫尚未提供本題詳細解析。</div>'}${window.courseQuestionTools.reviewMarkup(q)}</div>`;
}
function languageOf(value) {
  return /[\u3400-\u9fff]/u.test(String(value ?? '')) ? 'zh-Hant' : 'en';
}
function orderedBilingualText(primary, translation) {
  const first = String(primary ?? ''), second = String(translation ?? '');
  if (!second || languageOf(first) === languageOf(second)) return {top:first,bottom:second};
  return languageOf(second) === 'zh-Hant' ? {top:second,bottom:first} : {top:first,bottom:second};
}
function optionMarkup(q, option, index) {
  const text = String(option ?? ''), match = text.match(/^([A-H][.、．:：])(\s*)([\s\S]*)$/);
  const label = match?.[1] || `${String.fromCharCode(65 + index)}.`, letter = label[0].toUpperCase();
  const primary = match ? match[3] : text;
  const rawTranslation = String(q.optionTranslations?.[index] ?? '');
  const translationMatch = rawTranslation.match(/^([A-H])[.、．:：]\s*([\s\S]*)$/u);
  const translation = translationMatch?.[1].toUpperCase() === letter ? translationMatch[2] : rawTranslation;
  const ordered = orderedBilingualText(primary, translation);
  const content = `<span class="option-label">${highlighted(label)}</span>${esc(match?.[2] || ' ')}${highlighted(ordered.top)}`;
  return `<span class="option-content">${content}${ordered.bottom ? `<span class="option-translation" lang="${languageOf(ordered.bottom)}">${highlighted(ordered.bottom)}</span>` : ''}</span>`;
}
function expectedOptionKeys(q,options) {return window.courseQuestionTools.optionAnswerKeys(q,options);}
function updateCorrectOptions(card,q,visible) {
  const keys = visible && mode === 'study' && q?.options?.length ? expectedOptionKeys(q,q.options) : new Set();
  window.courseQuestionTools.updateStudyOptionMarks(card,q,keys);
}
function cardMarkup({q, unit, unitIndex, i, displayNumber}) {
  const practice = mode === 'practice', open = revealed.has(q.id) || (!practice && $('showAnswers').checked), chosen = selections.get(q.id) || [];
  const result = feedback.get(q.id);
  const correctKeys = !practice && open ? expectedOptionKeys(q, q.options || []) : new Set();
  const options = q.options?.length ? `<div class="options">${q.options.map((o,k)=>{const mark=window.coursePractice.optionMark(result,k),studyMark=window.courseQuestionTools.studyOptionMark(q,correctKeys.has(String.fromCharCode(65+k)));return practice?`<label class="option ${chosen.includes(k)?'chosen':''} ${mark.className}"><input type="${window.courseQuestionTools.answerType(q)==='多選題'?'checkbox':'radio'}" name="choice-${q.id}" data-choice="${q.id}" data-index="${k}" ${chosen.includes(k)?'checked':''} ${mark.className==='practice-incorrect'?'aria-invalid="true"':''}>${optionMarkup(q,o,k)}${mark.icon}</label>`:`<div class="option ${studyMark.className}">${optionMarkup(q,o,k)}${studyMark.label}</div>`}).join('')}</div>` : '';
  const textMark=window.coursePractice.textMark(result);
  const entry=practice&&!q.options?.length?window.coursePractice.entryMarkup(q,q.id,drafts.get(q.id),textMark):'';
  const pending = window.courseQuestionTools.qualityReasons(q, 'os').length > 0;
  const hasResponse=chosen.length>0||Boolean(drafts.get(q.id)?.trim());
  const buttonText=practice?'檢查答案':open?'收起答案':'查看答案與解析';
  const prompt = orderedBilingualText(q.stem, q.translation);
  return `<article class="card" data-id="${q.id}"><div class="cardtop"><div class="badges">${allUnits()?`<span class="badge unit-badge">${unitCaption(unitIndex)} · ${esc(unit.label)}</span>`:''}<span class="badge">${highlighted(q.category)}</span><span class="badge neutral">${kind(q)}</span>${window.courseQuestionTools.incompleteReasons(q).length?'<span class="badge gold">資料不完整</span>':''}${pending?'<span class="badge gold">待確認</span>':''}</div><span class="qid">#${String(displayNumber??i+1).padStart(3,'0')}</span></div><h3 class="question" tabindex="-1">${highlighted(prompt.top)}</h3>${prompt.bottom?`<p class="translation" lang="${languageOf(prompt.bottom)}">${highlighted(prompt.bottom)}</p>`:''}${window.courseQuestionTools.searchMatchMarkup(q, $('search').value)}${window.courseQuestionTools.qualityMarkup(q,'os')}${window.courseQuestionTools.incompleteMarkup(q)}${window.courseQuestionTools.questionImagesMarkup(q)}${options}${entry}${practice?`<div class="practice-actions"><button class="reveal" data-reveal="${q.id}" aria-controls="answer-${q.id}">${buttonText}</button><button type="button" class="plain" data-clear-response="${q.id}" ${hasResponse?'':'disabled'}>清除作答</button><button type="button" class="plain" data-show-answer="${q.id}" aria-controls="answer-${q.id}" aria-expanded="${open}">${open?'收起答案與解析':'顯示答案與解析'}</button></div>`:!$('showAnswers').checked?`<button class="reveal" data-reveal="${q.id}" aria-controls="answer-${q.id}" aria-expanded="${open}">${buttonText}</button>`:''}${practice&&result?window.coursePractice.markup(result,q.id):''}<div data-answer="${q.id}" ${open?'':'hidden'}>${answerMarkup(q)}</div></article>`;
}
function render(preserveCards = false) {
  const filtered=practiceSequence.apply(matches(),mode==='practice'&&$('practiceOrder').value==='random',entry=>entry.q.id), entries=scopedEntries(), pages=Math.max(1,Math.ceil(filtered.length/pageSize)); page=Math.min(page,pages); totalPages=pages;
  const start=(page-1)*pageSize;
  $('qualitySelect').options[1].textContent=`待確認（${entries.filter(({q})=>window.courseQuestionTools.qualityReasons(q,'os').length).length} 題）`;
  $('resultCount').innerHTML=`<strong>${allUnits()?'全部單元':'目前單元'} · ${$('chapter').value==='all'?'全部章節':esc($('chapter').value)}</strong> · ${filtered.length} / ${entries.length} 題`;
  $('pageRange').textContent=filtered.length?`${start+1}–${Math.min(start+pageSize,filtered.length)} · 第 ${page} / ${pages} 頁`:'0 題';
  const visible=filtered.slice(start,start+pageSize);
  window.courseQuestionTools.renderQuestionCards($('cards'),visible,cardMarkup,preserveCards);
  $('empty').hidden=filtered.length!==0;
  $('pager').innerHTML=pages>1?`<button data-page="${page-1}" aria-label="上一頁" ${page===1?'disabled':''}>←</button>`+Array.from({length:pages},(_,i)=>`<button data-page="${i+1}" ${page===i+1?'class="active" aria-current="page"':''} aria-label="第 ${i+1} 頁">${i+1}</button>`).join('')+`<button data-page="${page+1}" aria-label="下一頁" ${page===pages?'disabled':''}>→</button>`:'';
  $('studyMode').classList.toggle('active',mode==='study'); $('practiceMode').classList.toggle('active',mode==='practice');
  $('studyMode').setAttribute('aria-pressed',mode==='study'); $('practiceMode').setAttribute('aria-pressed',mode==='practice');
  $('answerToggle').hidden=mode==='practice'; $('modeHint').hidden=mode!=='practice';
  $('practiceOrderControl').hidden=mode!=='practice';
  $('footer').textContent=`共 ${UNITS.length} 個單元 · ${totalQuestionCount()} 題`;
  window.learningUI?.refresh();
}
function resetFilters() { window.learningUI?.clearReview(); window.coursePracticeProgress?.clearFilter(); $('search').value=''; $('chapter').value='all'; $('typeSelect').value='all'; $('qualitySelect').value='all'; page=1; render(); }
function switchMode(next) { mode=next; revealed.clear(); feedback.clear(); render(); }
function toggleAnswer(id,button) {
  const card=button.closest('.card'), panel=card.querySelector('[data-answer]');
  if(mode==='practice') {
    const wasRevealed=revealed.has(id);
    const q=findEntry(id).q,response=card.querySelector('[data-draft]')?.value||'';
    const result=window.coursePractice.evaluate(q.answer,q.options||[],selections.get(id)||[],q,response);
    feedback.set(id,result);
    window.coursePracticeProgress?.record(id,result,{choices:selections.get(id)||[],text:response});
    const shouldOpen=result.correct===true||result.revealAnswer||wasRevealed;
    panel.hidden=!shouldOpen;
    if(shouldOpen)revealed.add(id);else revealed.delete(id);
    button.textContent='檢查答案';
    const answerButton=card.querySelector('[data-show-answer]');
    if(answerButton){answerButton.setAttribute('aria-expanded',String(shouldOpen));answerButton.textContent=shouldOpen?'收起答案與解析':'顯示答案與解析';}
    window.coursePractice.show(card,result,id); return;
  }
  const open=panel.hidden;panel.hidden=!open;
  updateCorrectOptions(card,findEntry(id)?.q,open);
  if(open)revealed.add(id);else revealed.delete(id);
  button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起答案':'查看答案與解析';
}
function togglePracticeAnswer(id,button) {
  const card=button.closest('.card'),panel=card.querySelector('[data-answer]'),open=panel.hidden;
  panel.hidden=!open;if(open)revealed.add(id);else revealed.delete(id);
  button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起答案與解析':'顯示答案與解析';
}
function clearResponse(id,button) {
  const card=button.closest('.card');
  card.querySelectorAll('[data-choice]').forEach(input=>{input.checked=false;});
  card.querySelectorAll('.option').forEach(option=>option.classList.remove('chosen'));
  const draft=card.querySelector('[data-draft]');if(draft)draft.value='';card.querySelectorAll('[data-fill-index]').forEach(field=>{field.value='';});
  selections.delete(id);drafts.delete(id);feedback.delete(id);revealed.delete(id);
  card.querySelector('[data-answer]').hidden=true;card.querySelector('.practice-feedback')?.remove();
  window.coursePractice.clearMarks(card);
  const check=card.querySelector('[data-reveal]');check.textContent='檢查答案';check.setAttribute('aria-expanded','false');
  const answerButton=card.querySelector('[data-show-answer]');answerButton.textContent='顯示答案與解析';answerButton.setAttribute('aria-expanded','false');
  button.disabled=true;(card.querySelector('[data-fill-index]')||draft||card.querySelector('[data-choice]'))?.focus();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  if(b.dataset.unit!==undefined)switchUnit(Number(b.dataset.unit));
  else if(b.dataset.page){page=Number(b.dataset.page);render();window.courseQuestionTools.focusResults();}
  else if(b.dataset.clearResponse!==undefined)clearResponse(b.dataset.clearResponse,b);
  else if(b.dataset.showAnswer!==undefined)togglePracticeAnswer(b.dataset.showAnswer,b);
  else if(b.dataset.reveal)toggleAnswer(b.dataset.reveal,b);
});
$('search').addEventListener('input',()=>{page=1;render();});
for(const id of ['chapter','typeSelect','qualitySelect']) $(id).addEventListener('change',()=>{page=1;render();});
$('searchScopeSelect').addEventListener('change',()=>{page=1;refreshFilters();render();});
$('showAnswers').addEventListener('change',()=>{revealed.clear();render();});
$('unitPicker').addEventListener('change',e=>switchUnit(Number(e.target.value)));
$('clear').onclick=resetFilters; $('emptyReset').onclick=resetFilters;
$('studyMode').onclick=()=>switchMode('study'); $('practiceMode').onclick=()=>switchMode('practice');
$('practiceOrder').addEventListener('change',()=>{practiceSequence.reset();page=1;render();});
$('cards').addEventListener('input',e=>{
  if(!e.target.dataset.draft)return;
  const id=e.target.dataset.draft;drafts.set(id,e.target.value);
  const card=e.target.closest('.card'),button=card.querySelector('[data-reveal]'),clear=card.querySelector('[data-clear-response]');
  if(clear)clear.disabled=!e.target.value.trim();
  if(!feedback.has(id)&&!revealed.has(id))return;
  feedback.delete(id);revealed.delete(id);card.querySelector('[data-answer]').hidden=true;card.querySelector('.practice-feedback')?.remove();
  window.coursePractice.clearMarks(card);button.textContent='檢查答案';button.setAttribute('aria-expanded','false');
  const answerButton=card.querySelector('[data-show-answer]');if(answerButton){answerButton.textContent='顯示答案與解析';answerButton.setAttribute('aria-expanded','false');}
});
$('cards').addEventListener('change',e=>{
  const input=e.target,id=input.dataset.choice;if(!id)return;
  const k=Number(input.dataset.index),previous=selections.get(id)||[];
  const chosen=input.type==='radio'?[k]:input.checked?[...new Set([...previous,k])]:previous.filter(n=>n!==k);
  selections.set(id,chosen);
  const card=input.closest('.card');card.querySelectorAll('.option').forEach(label=>label.classList.toggle('chosen',label.querySelector('input').checked));
  const clear=card.querySelector('[data-clear-response]');if(clear)clear.disabled=chosen.length===0;
  revealed.delete(id);feedback.delete(id);card.querySelector('[data-answer]').hidden=true;
  card.querySelector('.practice-feedback')?.remove();window.coursePractice.clearMarks(card);
  const b=card.querySelector('[data-reveal]');b.textContent='檢查答案';b.setAttribute('aria-expanded','false');
  const answerButton=card.querySelector('[data-show-answer]');if(answerButton){answerButton.textContent='顯示答案與解析';answerButton.setAttribute('aria-expanded','false');}
});
const linkedQuestion = new URLSearchParams(location.search).get('question');
const linkedUnitIndex = questionUnitIndex.get(linkedQuestion) ?? questionUnitIndex.get(canonicalId(linkedQuestion));
if (linkedUnitIndex !== undefined) ensureUnitLoaded(linkedUnitIndex);
const linkedEntry = findEntry(linkedQuestion);
switchUnit(linkedEntry?.unitIndex ?? 0);
if (linkedEntry) { page=Math.floor(linkedEntry.i/pageSize)+1; render(); window.courseQuestionTools.focusLinkedQuestion(linkedEntry.q.id); }
let waitingForLinkedQuestion = !linkedEntry && /^community-/.test(linkedQuestion || '');
function mergeCommunityQuestions(entries, {openLinkedQuestion = false, aliases = [], overrides = [], replace = false} = {}) {
  if(!Array.isArray(overrides))throw new Error('Invalid built-in updates');
  const next=new Map(), nextDeleted=new Set();
  for(const row of overrides){
    const q=row?.question,unitIndex=questionUnitIndex.get(q?.id);
    if(row?.deleted===true){
      if(unitIndex===undefined || canonicalQuestionId.has(q.id) || UNITS[unitIndex].id!==row.unit || next.has(q.id) || nextDeleted.has(q.id) || (q.aliases!==undefined && (!Array.isArray(q.aliases)||q.aliases.some(alias=>typeof alias!=='string'))))throw new Error('Invalid built-in deletion');
      nextDeleted.add(q.id);
      continue;
    }
    if(unitIndex===undefined || canonicalQuestionId.has(q.id) || UNITS[unitIndex].id!==row.unit || typeof q.stem!=='string' || typeof q.answer!=='string' || !Array.isArray(q.options) || q.options.some(v=>typeof v!=='string') || next.has(q.id))throw new Error('Invalid built-in update');
    next.set(q.id,q);
  }
  const activeUnitId = UNITS[active]?.id;
  if (replace) {
    const previous = new Map(questionEntries.filter(e=>communityQuestionIds.has(e.q.id)).map(e=>[e.q.id,e.q]));
    for (const pending of pendingCommunityQuestions.values()) for (const q of pending) previous.set(q.id,q);
    entries = entries.map(row => {
      const old = previous.get(row.question?.id);
      if (old && JSON.stringify(old) === JSON.stringify(row.question)) return {...row,question:old};
      return row;
    });
    const retained = new Map(entries.map(row=>[row.question?.id,row.question]));
    for (const [id,q] of previous) if (retained.get(id)!==q) { feedback.delete(id); revealed.delete(id); selections.delete(id); }
    communityAliases.clear(); communityQuestionIds.clear(); communityQuestionUnit.clear(); pendingCommunityQuestions.clear();
    for (const id of questionUnitIndex.keys()) if (/^community-/.test(id) && !knownQuestionIds.has(id)) questionUnitIndex.delete(id);
    UNITS.splice(0,UNITS.length,...UNITS.filter(unit=>unitData.has(unit.id)));
    loadedUnits.clear(); questionEntries.length=0;
    UNITS.forEach((unit,unitIndex)=>{
      unit.questionCount=unit.baseQuestionCount;
      if (!unit.questions) return;
      unit.questions=unit.questions.filter(q=>knownQuestionIds.has(q.id));
      loadedUnits.add(unitIndex);
      unit.questions.forEach((q,i)=>questionEntries.push({q,i,unit,unitIndex}));
    });
  }
  const previousDeleted=builtinDeletedIds;
  const changedIds=new Set([...builtinOverrides.keys(),...next.keys(),...previousDeleted,...nextDeleted].filter(id=>JSON.stringify(builtinOverrides.get(id))!==JSON.stringify(next.get(id)) || previousDeleted.has(id)!==nextDeleted.has(id)));
  builtinOverrides=next;
  builtinDeletedIds=nextDeleted;
  for(const [unitIndex,unit] of UNITS.entries()){
    const countDeleted=ids=>[...ids].filter(id=>questionUnitIndex.get(id)===unitIndex).length;
    unit.questionCount=replace?unit.baseQuestionCount-countDeleted(nextDeleted):unit.questionCount+countDeleted(previousDeleted)-countDeleted(nextDeleted);
  }
  for(const unitIndex of loadedUnits){
    const unit=UNITS[unitIndex];if(!unitData.has(unit.id))continue;
    const originals=new Map(JSON.parse(unitData.get(unit.id)).map(q=>[q.id,q]));
    unit.questions=unit.questions.map(q=>changedIds.has(q.id)?(next.get(q.id)||originals.get(q.id)||q):q);
    for(const entry of questionEntries)if(entry.unitIndex===unitIndex && changedIds.has(entry.q.id))entry.q=unit.questions[entry.i];
  }
  for(const id of changedIds){feedback.delete(id);revealed.delete(id);selections.delete(id);}

  let added = 0, updated = 0;
  for (const entry of entries) {
    if (!entry || typeof entry!=='object') continue;
    const {unit:unitId, question:q}=entry;
    let unitIndex=UNITS.findIndex(unit=>unit.id===unitId), unit=UNITS[unitIndex];
    if (!q || !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(q.id) ||
        typeof q.stem!=='string' || typeof q.answer!=='string' || knownQuestionIds.has(q.id)) continue;
    if (communityQuestionIds.has(q.id)) {
      const existing = findEntry(q.id);
      if (existing?.q.id === q.id && existing.unit.id === unitId && JSON.stringify(existing.q) !== JSON.stringify(q)) {
        existing.q = q; existing.unit.questions[existing.i] = q; updated++;
        feedback.delete(q.id); revealed.delete(q.id); selections.delete(q.id);
      } else if (!existing) {
        const pending = pendingCommunityQuestions.get(unitId) || [], i = pending.findIndex(old => old.id === q.id);
        if (i >= 0 && JSON.stringify(pending[i]) !== JSON.stringify(q)) { pending[i] = q; updated++; }
      }
      continue;
    }
    if(!unit){
      if(!/^L[1-9]\d?$/.test(unitId))continue;
      unit={id:unitId,number:Number(unitId.slice(1)),label:String(q.unitTitle||'第 '+unitId.slice(1)+' 單元').slice(0,60),en:String(q.unitEn||'COMMUNITY QUESTIONS').slice(0,60),desc:String(q.unitDescription||'公開投稿題目').slice(0,240),baseQuestionCount:0,questionCount:0,questions:[],questionIds:[],questionAliases:{}};
      unitIndex=UNITS.push(unit)-1;loadedUnits.add(unitIndex);
    }
    const i=unit.questionCount++;
    communityQuestionIds.add(q.id); questionUnitIndex.set(q.id,unitIndex); communityQuestionUnit.set(q.id,unitIndex);
    if (loadedUnits.has(unitIndex)) {
      unit.questions.push(q); questionEntries.push({q,unit,unitIndex,i});
    } else {
      const pending = pendingCommunityQuestions.get(unit.id) || [];
      pending.push(q); pendingCommunityQuestions.set(unit.id,pending);
    }
    added++;
  }
  for (const alias of Array.isArray(aliases) ? aliases : []) {
    if (!/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(alias?.id)) continue;
    const target = canonicalId(alias.target);
    if (!knownQuestionIds.has(target) && !communityQuestionIds.has(target)) continue;
    communityAliases.set(alias.id,target); communityQuestionIds.add(alias.id);
    const targetUnit = questionUnitIndex.get(target) ?? communityQuestionUnit.get(target);
    if (targetUnit !== undefined) questionUnitIndex.set(alias.id,targetUnit);
  }
  if (replace) { active=Math.max(0,UNITS.findIndex(unit=>unit.id===activeUnitId)); ensureUnitLoaded(active); }
  window.learningUI?.refresh();
  if (!replace && !added && !updated && !communityAliases.size && !changedIds.size) return {added:0, openedLinkedQuestion:false};
  document.querySelector('[data-course-total]').textContent=`${UNITS.length} 個單元 · ${totalQuestionCount()} 道題目`;
  const linkedUnit = communityQuestionUnit.get(linkedQuestion) ?? questionUnitIndex.get(canonicalId(linkedQuestion));
  if (waitingForLinkedQuestion && openLinkedQuestion && linkedUnit !== undefined) ensureUnitLoaded(linkedUnit);
  const linked=waitingForLinkedQuestion && openLinkedQuestion && findEntry(linkedQuestion);
  if (linked) {
    waitingForLinkedQuestion=false; switchUnit(linked.unitIndex);
    page=Math.floor(linked.i/pageSize)+1; render();
    window.courseQuestionTools.focusLinkedQuestion(linked.q.id);
  } else { refreshUnitNavigation(); refreshFilters(); render(true); }
  return {added, openedLinkedQuestion:Boolean(linked)};
}
window.courseLearning={
  setUnitQuestionOrder:(unitId,ids)=>{
    if(!UNITS.some(unit=>unit.id===unitId)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return false;
    unitQuestionOrders.set(unitId,new Map(ids.map((id,index)=>[id,index])));
    page=1;render();return true;
  },
  examUnits:()=>UNITS.map((unit,index)=>({id:unit.id,label:unit.id==='treasure'?'挖寶單元':`L${Number(unitNumber(index))} · ${unit.label}`,number:Number(unitNumber(index))})).sort((a,b)=>a.number-b.number),
  examUnitId:()=>UNITS[active].id,
  examEntries:selection=>{
    const ids=Array.isArray(selection)?new Set(selection):null;
    if(selection===true)ensureAllUnitsLoaded();
    else if(ids)UNITS.forEach((unit,index)=>{if(ids.has(unit.id))ensureUnitLoaded(index);});
    else ensureUnitLoaded(active);
    return orderEntries(questionEntries.filter(e=>!builtinDeletedIds.has(e.q.id)&&(ids?ids.has(e.unit.id):selection===true||e.unitIndex===active))).map(e=>({id:e.q.id,q:e.q,unit:e.unit.label,unitId:e.unit.id}));
  },
  examUnitLabel:()=>UNITS[active].label,
  mergeCommunityQuestions, course:'os',toolbar:document.querySelector('.toolbar'),sidebar:document.querySelector('.sidebar'),list:$('cards'),
  unitIds:()=>orderEntries(questionEntries.filter(e=>e.unitIndex===active&&!builtinDeletedIds.has(e.q.id))).map(e=>e.q.id),
  scopeIds:()=>scopedEntries().map(({q})=>q.id), allUnits,
  scopeLabel:()=>allUnits()?`作業系統 · 全部 ${UNITS.length} 個單元`:`目前單元 · ${UNITS[active].label}`,
  cardTop:card=>card.querySelector('.cardtop'),render,resetPage:()=>{page=1;},
  resolveId:id=>{const target=canonicalId(id);return !builtinDeletedIds.has(target)&&(knownQuestionIds.has(target)||communityQuestionIds.has(target))?target:undefined;},
  validId:id=>!builtinDeletedIds.has(canonicalId(id))&&(knownQuestionIds.has(id)||communityQuestionIds.has(id)),
  questionLabel:id=>{const entry=findEntry(id);return `${entry.unit.label} 第 ${questionDisplayNumber(entry)} 題`;},
  questionDetails:id=>{const entry=findEntry(id),{q,unit}=entry;return {course:'os',id,unit:unit.label,number:questionDisplayNumber(entry),question:q.stem,answer:q.answer};},
  questionForEdit:id=>findEntry(id)?.q,
  currentPage:()=>page, pageCount:()=>totalPages, practiceMode:()=>mode==='practice',
  resetPractice:()=>{drafts.clear();selections.clear();revealed.clear();feedback.clear();practiceSequence.reset();page=1;render();}
};
