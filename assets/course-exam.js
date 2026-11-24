/* Independent exam session with one completed snapshot per course/browser. */
(() => {
  'use strict';
  const config = window.courseLearning, tools = window.courseQuestionTools;
  if (!config?.examEntries || !window.coursePractice) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = q => q.options ?? q.opts ?? [];
  const answer = q => q.answer ?? q.a ?? '';
  const key = q => q.choiceKey || window.coursePractice.expectedChoiceKey(answer(q), options(q));
  const topicName = entry => entry.topicLabel || entry.q.category || '其他主題';
  const questionType = q => options(q).length ? (key(q)?.length > 1 || tools.answerType(q) === '多選題' ? '多選題' : '單選題') : '填空題';
  const maxQuestions = 10000;
  function eligible(entry) {
    const q = entry.q;
    return tools.hasProvidedAnswer(q) && !tools.incompleteReasons(q).length && (!options(q).length || Boolean(key(q)));
  }
  function sample(entries, count, random = Math.random) {
    const unique = [...new Map(entries.filter(eligible).map(entry => [entry.id, entry])).values()];
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return unique.slice(0, count);
  }
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.id = 'examMode'; trigger.textContent = '單元測驗';
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', 'courseExam');
  document.getElementById('practiceMode').after(trigger);
  const dialog = document.createElement('dialog');
  dialog.id = 'courseExam'; dialog.className = 'course-exam'; dialog.setAttribute('aria-labelledby', 'examTitle');
  dialog.innerHTML = `<header class="exam-header"><h2 id="examTitle">單元測驗</h2><button type="button" class="plain" data-exam-close aria-label="關閉測驗，保留本次作答">關閉</button></header><div class="exam-nav-panel" data-exam-nav-panel hidden><div class="exam-nav-heading"><details data-exam-nav-details open><summary>題號導航</summary><div class="exam-nav-grid" data-exam-nav></div></details><div class="exam-nav-meta"><span data-exam-clock hidden></span><button type="button" class="plain" data-exam-next-unanswered>跳至未答</button><button type="button" class="plain" data-exam-next-flag>跳至待檢查</button></div></div><p class="exam-nav-legend" data-exam-nav-legend></p></div><div class="exam-body"><section data-exam-setup><p>選擇範圍後隨機抽題，交卷後統一顯示答案與解析。請在這裡選擇測驗內容，交卷後可重練錯題。</p><div class="exam-settings"><label>測驗範圍<select data-exam-scope aria-label="測驗範圍"><option value="unit">目前單元</option><option value="all">全部單元</option><option value="range">自訂單元範圍</option></select></label><label>題目語言<select data-exam-language aria-label="測驗題目語言"><option value="all">全部語言</option><option value="zh">中文題（含雙語）</option><option value="en">純英文題</option><option value="ratio">自訂中英文比例</option></select></label><label>每次題數<select data-exam-size aria-label="每次測驗題數"><option value="10">10 題</option><option value="20" selected>20 題</option><option value="30">30 題</option><option value="custom">自訂題數</option><option value="all">全部題目</option></select></label></div><label class="exam-custom-size" data-exam-custom-control hidden>自訂題數<input type="number" min="1" max="10000" data-exam-custom-size value="40" aria-label="自訂測驗題數"></label><div class="exam-settings exam-extra-settings"><label>主題<select data-exam-topic><option value="all">全部主題</option></select></label><label>題型<select data-exam-type><option value="all">全部題型</option><option value="單選題">單選題</option><option value="多選題">多選題</option><option value="填空題">填空題</option></select></label></div><label class="exam-inline"><input type="checkbox" data-exam-timed> 限時測驗</label><label class="exam-time-control" data-exam-time-control hidden>時間（分鐘）<input type="number" min="1" max="600" value="30" data-exam-minutes aria-label="測驗分鐘"></label><label class="exam-ratio" data-exam-ratio-control hidden>中文比例（%）<input type="number" min="0" max="100" step="1" value="90" data-exam-ratio aria-label="中文題比例"> <span data-exam-ratio-label>英文 10%</span></label><fieldset class="exam-range" data-exam-range hidden><legend>自訂單元範圍</legend><div class="exam-settings"><label>起始單元<select data-exam-from aria-label="起始單元" aria-describedby="examRangeHint"></select></label><label>結束單元<select data-exam-to aria-label="結束單元" aria-describedby="examRangeHint"></select></label></div><p id="examRangeHint" class="exam-hint" data-exam-range-hint role="status" aria-live="polite">包含起始與結束單元。</p></fieldset><p data-exam-pool role="status" aria-live="polite"></p><details class="exam-rules"><summary>測驗規則與紀錄保存</summary><p class="exam-hint">資料不完整或無法核對答案的題目不納入抽題。不足指定題數時，使用全部可測驗題目。每題等分，多選題須全部選對。未交卷作答也會自動暫存，可重新整理後繼續；已交卷自動保留最近一次結果於此瀏覽器，重新設定不會刪除。</p></details><div class="exam-start-actions"><button type="button" class="reveal" data-exam-start>開始測驗</button><button type="button" class="plain" data-exam-resume hidden>繼續未交卷測驗</button><button type="button" class="plain" data-exam-last hidden>查看上次測驗</button></div><p class="exam-hint" data-exam-last-info></p></section><section data-exam-session hidden><p data-exam-description></p><p class="exam-hint" data-exam-fill-hint>填空請依題目指定格式作答。系統先依題庫文字核對，交卷後可對照解析自行確認其他寫法。</p><div data-exam-results hidden tabindex="-1" aria-live="polite"></div><div data-exam-questions></div></section></div><footer class="exam-footer" hidden><span data-exam-progress role="status"></span><p data-exam-notice role="status"></p><div><button type="button" class="plain" data-exam-reset>重新設定</button><button type="button" class="reveal" data-exam-submit>交卷</button></div></footer>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  const scope = find('[data-exam-scope]'), size = find('[data-exam-size]');
  const language = find('[data-exam-language]');
  const topic = find('[data-exam-topic]'), type = find('[data-exam-type]');
  const customSize = find('[data-exam-custom-size]'), timed = find('[data-exam-timed]'), minutes = find('[data-exam-minutes]');
  const englishOnly = entry => tools.isEnglishOnlyQuestion(entry.q);
  function languagePlan(pool, count, mode = language.value, random = Math.random) {
    const unique = [...new Map(pool.filter(eligible).map(e=>[e.id,e])).values()];
    const zh=unique.filter(e=>!englishOnly(e)), en=unique.filter(englishOnly);
    if(mode!=='ratio')return {entries:sample(mode==='zh'?zh:mode==='en'?en:unique,count,random),shortage:false,zh:zh.length,en:en.length};
    const percent=Number(find('[data-exam-ratio]').value);
    const valid=find('[data-exam-ratio]').value.trim()!==''&&Number.isInteger(percent)&&percent>=0&&percent<=100;
    const total=Math.min(count,unique.length),wantZh=valid?Math.round(total*percent/100):0,wantEn=total-wantZh;
    const shortage=!valid || zh.length<wantZh || en.length<wantEn;
    return {entries:shortage?[]:sample([...sample(zh,wantZh,random),...sample(en,wantEn,random)],total,random),shortage,zh:zh.length,en:en.length,wantZh,wantEn};
  }
  const questionList = find('[data-exam-questions]'), notice = find('[data-exam-notice]');
  let entries = [], responses = new Map(), results = [], submitted = false, confirmation = '';
  let flags = new Set(), startedAt = 0, deadline = 0, timer = null;
  let markWrong = false, addedWrongReviews = new Set();
  const storageKey = 'course-exam-last-v1:' + config.course;
  const draftKey = 'course-exam-draft-v1:' + config.course, responseKey = draftKey + ':answers';
  const settingsKey = 'course-exam-settings-v1:' + config.course;
  let pendingExam = null, sessionId = '';
  function validEntries(saved) {
    return saved?.version === 1 && saved.course === config.course && typeof saved.label === 'string' && Array.isArray(saved.entries) && saved.entries.length > 0 && saved.entries.length <= maxQuestions && saved.entries.every(e => e && typeof e.id === 'string' && e.q && typeof e.q === 'object' && typeof (e.q.stem??e.q.q)==='string' && typeof answer(e.q)==='string' && Array.isArray(options(e.q)) && options(e.q).every(o=>typeof o==='string') && (!e.q.images || Array.isArray(e.q.images) && e.q.images.every(i=>typeof i==='string'||i&&typeof i.src==='string')));
  }
  function validResponses(value, count) {
    return Array.isArray(value) && value.every(pair => Array.isArray(pair) && Number.isInteger(pair[0]) && pair[0]>=0 && pair[0]<count && Array.isArray(pair[1]?.chosen) && pair[1].chosen.every(i=>Number.isInteger(i)&&i>=0) && typeof pair[1].text==='string' && (!pair[1].fields || Array.isArray(pair[1].fields) && pair[1].fields.every(v=>typeof v==='string')));
  }
  function savedFlags(value, count) {
    return new Set(Array.isArray(value) ? value.filter(i=>Number.isInteger(i)&&i>=0&&i<count) : []);
  }
  function savedTime(value) {
    return Number.isSafeInteger(value) && value>0 ? value : 0;
  }
  try {
    const saved = JSON.parse(window.localStorage?.getItem(draftKey) || 'null');
    const answers = JSON.parse(window.localStorage?.getItem(responseKey) || 'null');
    if (validEntries(saved) && typeof saved.sessionId==='string') {
      const same = answers?.sessionId===saved.sessionId;
      pendingExam = {...saved,responses:same && validResponses(answers.responses,saved.entries.length) ? answers.responses : [],
        flags:[...savedFlags(same ? answers.flags ?? saved.flags : saved.flags,saved.entries.length)]};
    }
  } catch { /* A broken draft does not affect the completed result. */ }
  let lastExam = null, completedAt = '', resultFilter = 'all';
  try {
    const saved = JSON.parse(window.localStorage?.getItem(storageKey) || 'null');
    if (validEntries(saved) && validResponses(saved.responses,saved.entries.length) && Array.isArray(saved.results) && saved.results.length===saved.entries.length && saved.results.every(r=>r && (typeof r.correct==='boolean'||r.correct===null)) && Number.isFinite(Date.parse(saved.completedAt))) lastExam = {...saved,results:saved.results.map(r=>({...r,correct:r.correct===true}))};
  } catch { /* Unavailable or damaged storage must not block exams. */ }
  function lastInfo(message = '') {
    find('[data-exam-resume]').hidden = !pendingExam;
    find('[data-exam-last]').hidden = !lastExam;
    find('[data-exam-last-info]').textContent = message || (lastExam ? `上次：${lastExam.label} · ${new Date(lastExam.completedAt).toLocaleString('zh-TW')} · ${lastExam.entries.length} 題。只保留最近一次已交卷測驗。` : '尚無已交卷紀錄。');
  }
  function draftEntries() {
    return entries.map(e=>{
      const q={...e.q,explanation:tools.explanationText(e.q)};
      delete q.ex;
      return {id:e.id,unit:e.unit,unitId:e.unitId,topicLabel:topicName(e),q};
    });
  }
  function saveDraft(initial=false) {
    if (submitted || !entries.length) return;
    try {
      if (initial) {
        sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
        pendingExam = {version:1,course:config.course,sessionId,label:sessionLabel,updatedAt:new Date().toISOString(),entries:draftEntries(),responses:[],flags:[],startedAt,deadline};
        window.localStorage.setItem(draftKey,JSON.stringify(pendingExam));
      } else if (JSON.parse(window.localStorage.getItem(draftKey)||'null')?.sessionId!==sessionId) {
        notice.textContent='其他分頁已開始另一場測驗；本頁作答仍保留，但不覆蓋另一場暫存。';return;
      }
      pendingExam.responses=[...responses];pendingExam.flags=[...flags];pendingExam.updatedAt=new Date().toISOString();
      window.localStorage.setItem(responseKey,JSON.stringify({sessionId,responses:[...responses],flags:[...flags]}));
      notice.textContent='作答已自動暫存於此瀏覽器。';
    } catch { notice.textContent='此瀏覽器無法暫存，請勿關閉或重新整理本頁。'; }
    lastInfo();
  }
  function clearDraft() {
    try {
      if (JSON.parse(window.localStorage.getItem(draftKey)||'null')?.sessionId===sessionId) {
        window.localStorage.removeItem(draftKey);window.localStorage.removeItem(responseKey);pendingExam=null;
      }
    } catch { notice.textContent+=' 暫存紀錄無法清除；下次開啟時可能仍出現繼續作答。'; }
    finally {if(pendingExam?.sessionId===sessionId)pendingExam=null;}
  }
  function restoreResponses() {
    for (const [index] of entries.entries()) {
      const card=questionList.children[index], response=responses.get(index);
      card.querySelectorAll('input').forEach(input=>{input.checked=Boolean(response?.chosen.includes(Number(input.value)));});
      const draft=card.querySelector('[data-draft]');if(draft)draft.value=response?.text||'';
      card.querySelectorAll('[data-fill-index]').forEach((field,i)=>{field.value=response?.fields?.[i]||'';});
    }
  }
  function resumeDraft() {
    if (!pendingExam) return;
    const saved=JSON.parse(JSON.stringify(pendingExam));
    entries=saved.entries;responses=new Map(saved.responses);sessionId=saved.sessionId;sessionLabel=saved.label;
    flags=savedFlags(saved.flags,entries.length);startedAt=savedTime(saved.startedAt);deadline=savedTime(saved.deadline);
    results=[];submitted=false;confirmation='';resultFilter='all';markWrong=false;addedWrongReviews=new Set();
    showSession();restoreResponses();progress();notice.textContent='已還原未交卷的題目、選項順序及作答。';startClock();
  }
  function retryWrong() {
    const wrong=entries.filter((_,i)=>!results[i]?.correct);
    if (!submitted || !wrong.length) return;
    if(pendingExam&&!window.confirm('重練錯題將取代未交卷暫存；上次已交卷結果仍保留。確定開始？'))return;
    const label=sessionLabel.replace(/ · 錯題重練$/u,'')+' · 錯題重練';
    begin(wrong,label);
  }
  function saveLast() {
    try {
      const snapshot = {version:1, course:config.course, completedAt, label:sessionLabel,
        entries:draftEntries(),
        responses:[...responses], results, flags:[...flags], startedAt, deadline, markWrong, addedWrongReviews:[...addedWrongReviews]};
      lastExam = JSON.parse(JSON.stringify(snapshot));
      const serialized=JSON.stringify(lastExam);
      try { window.localStorage.setItem(storageKey, serialized); }
      catch (error) {
        // A large exam may fit on disk once its own unfinished copy is gone.
        // Never clear an independent draft from a different session.
        if(pendingExam?.sessionId!==sessionId || JSON.parse(window.localStorage.getItem(draftKey)||'null')?.sessionId!==sessionId)throw error;
        clearDraft();
        window.localStorage.setItem(storageKey, serialized);
      }
      lastInfo();
    } catch { lastInfo('本次結果目前僅保留在本頁；瀏覽器無法儲存，關閉或重新整理後可能遺失。'); notice.textContent = '瀏覽器無法儲存紀錄，請先查看本次錯題。'; }
  }
  function restoreLast() {
    if (!lastExam) return;
    const saved = JSON.parse(JSON.stringify(lastExam));
    entries = saved.entries; responses = new Map(saved.responses); results = saved.results;
    flags=savedFlags(saved.flags,entries.length);startedAt=savedTime(saved.startedAt);deadline=savedTime(saved.deadline);
    markWrong = saved.markWrong === true;
    const ids = new Set(entries.map(entry=>entry.id));
    addedWrongReviews = new Set((Array.isArray(saved.addedWrongReviews)?saved.addedWrongReviews:[]).filter(id=>ids.has(id)));
    completedAt = saved.completedAt; sessionLabel = saved.label; submitted = true; confirmation = ''; resultFilter = 'all'; notice.textContent = '';
    find('[data-exam-setup]').hidden = true; find('[data-exam-session]').hidden = false; find('.exam-footer').hidden = false;
    find('[data-exam-description]').textContent = `${sessionLabel} · 上次測驗 · ${new Date(completedAt).toLocaleString('zh-TW')}（保留交卷當時題目與選項）`;
    questionList.innerHTML = entries.map(questionMarkup).join('');
    renderNavigation();
    for (const [index] of entries.entries()) {
      const card = questionList.children[index], response = responses.get(index);
      card.querySelectorAll('input').forEach(input => { input.checked = Boolean(response?.chosen.includes(Number(input.value))); });
      const draft = card.querySelector('[data-draft]'); if (draft) draft.value = response?.text || '';
      card.querySelectorAll('[data-fill-index]').forEach((field,i) => {field.value = response?.fields?.[i] || '';});
    }
    renderResults();
  }
  lastInfo();
  const optionSession=tools.createOptionSession();
  let sessionLabel = '', poolLabel = '';
  let units = [];
  const range = find('[data-exam-range]'), from = find('[data-exam-from]'), to = find('[data-exam-to]');
  function refreshUnitOptions() {
    const next=config.examUnits?.() || [];
    if(JSON.stringify(next)===JSON.stringify(units))return;
    const first=from.value,last=to.value;units=next;
    const options=units.map(unit=>`<option value="${esc(unit.id)}">${esc(unit.label)}</option>`).join('');
    from.innerHTML=to.innerHTML=options;
    const fallback=config.examUnitId?.() || units[0]?.id || '';
    from.value=units.some(u=>u.id===first)?first:fallback;
    to.value=units.some(u=>u.id===last)?last:fallback;
  }
  refreshUnitOptions();
  function selectedRange() {
    const first = units.findIndex(unit => unit.id === from.value), last = units.findIndex(unit => unit.id === to.value);
    return first >= 0 && last >= first ? units.slice(first, last + 1) : [];
  }
  function scopePool() {
    if (scope.value === 'range' && selectedRange().length === 0) return [];
    const selection = scope.value === 'range' ? selectedRange().map(unit => unit.id) : scope.value === 'all';
    return [...new Map(config.examEntries(selection).filter(eligible).map(entry=>[entry.id,entry])).values()];
  }
  function refreshTopics(candidates, desired = topic.value) {
    const names = [...new Set(candidates.map(topicName))];
    topic.innerHTML = '<option value="all">全部主題</option>' + names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    topic.value = names.includes(desired) ? desired : 'all';
  }
  function pool(candidates = scopePool()) {
    return candidates.filter(entry=>(topic.value==='all'||topicName(entry)===topic.value) &&
      (type.value==='all'||questionType(entry.q)===type.value));
  }
  function positiveInteger(value, max) {
    return value.trim()!=='' && Number.isInteger(Number(value)) && Number(value)>=1 && Number(value)<=max ? Number(value) : 0;
  }
  function requestedCount(candidates) {
    return size.value==='all' ? candidates.length : size.value==='custom' ? positiveInteger(customSize.value,maxQuestions) : Number(size.value);
  }
  function saveSettings() {
    try { window.localStorage.setItem(settingsKey,JSON.stringify({scope:scope.value,from:from.value,to:to.value,
      language:language.value,ratio:find('[data-exam-ratio]').value,size:size.value,customSize:customSize.value,
      topic:topic.value,type:type.value,timed:timed.checked,minutes:minutes.value})); } catch {}
  }
  function loadSettings() {
    try {
      const saved=JSON.parse(window.localStorage.getItem(settingsKey)||'null');
      if(!saved)return;
      for(const [field,name] of [[scope,'scope'],[from,'from'],[to,'to'],[language,'language'],[size,'size'],[type,'type']]){
        if([...field.options].some(option=>option.value===saved[name]))field.value=saved[name];
      }
      if(Number.isInteger(Number(saved.ratio)) && String(saved.ratio).trim()!=='' && Number(saved.ratio)>=0 && Number(saved.ratio)<=100)find('[data-exam-ratio]').value=String(saved.ratio);
      if(positiveInteger(String(saved.customSize??''),maxQuestions))customSize.value=String(saved.customSize);
      if(positiveInteger(String(saved.minutes??''),600))minutes.value=String(saved.minutes);
      timed.checked=saved.timed===true;
      refreshTopics(scopePool(),saved.topic);
    } catch {}
  }
  function refreshPool() {
    refreshUnitOptions();
    range.hidden = scope.value !== 'range';
    const selected = selectedRange();
    const invalid = scope.value === 'range' && selected.length === 0;
    from.setAttribute('aria-invalid', String(invalid)); to.setAttribute('aria-invalid', String(invalid));
    find('[data-exam-range-hint]').textContent = invalid ? '結束單元不能在起始單元之前，請重新選擇。' : `包含 ${selected.length} 個單元（含起始與結束單元）。`;
    poolLabel = scope.value === 'all' ? ({os:'作業系統',algorithms:'演算法'}[config.course] + ' · 全部單元') : config.examUnitLabel();
    if (scope.value === 'range') poolLabel = selected.length ? `${{os:'作業系統',algorithms:'演算法'}[config.course]} · ${selected[0].label} ～ ${selected.at(-1).label}` : '請選擇有效的單元範圍';
    scope.options[0].textContent = '目前單元 · ' + config.examUnitLabel();
    find('[data-exam-ratio-control]').hidden=language.value!=='ratio';
    find('[data-exam-custom-control]').hidden=size.value!=='custom';
    find('[data-exam-time-control]').hidden=!timed.checked;
    const percent=Number(find('[data-exam-ratio]').value);
    find('[data-exam-ratio-label]').textContent=Number.isInteger(percent)&&percent>=0&&percent<=100?`英文 ${100-percent}%`:'請輸入 0–100 的整數';
    const scoped=scopePool();
    refreshTopics(scoped);
    const candidates=pool(scoped), requested=requestedCount(candidates), plan=languagePlan(candidates,requested);
    const count = language.value==='zh'?plan.zh:language.value==='en'?plan.en:candidates.length;
    find('[data-exam-pool]').textContent = `${poolLabel} · 可抽 ${count} 題，本次 ${Math.min(count, requested)} 題。`;
    if(language.value!=='all')find('[data-exam-pool]').textContent+=` 中文 ${plan.zh} 題、純英文 ${plan.en} 題。`;
    if(language.value==='ratio'&&!plan.shortage)find('[data-exam-pool]').textContent+=` 本次中文 ${plan.wantZh} 題、英文 ${plan.wantEn} 題（依比例四捨五入）。`;
    if(plan.shortage)find('[data-exam-pool]').textContent+=` 此比例需要中文 ${plan.wantZh} 題、英文 ${plan.wantEn} 題，數量不足；請更換語言、題數或範圍。`;
    const invalidSize=size.value==='custom'&&!requested;
    const invalidTime=timed.checked&&!positiveInteger(minutes.value,600);
    if(invalidSize)find('[data-exam-pool]').textContent+=' 請輸入 1–10,000 的整數題數。';
    if(invalidTime)find('[data-exam-pool]').textContent+=' 請輸入 1–600 的整數分鐘。';
    find('[data-exam-start]').disabled = count === 0 || plan.shortage || invalidSize || invalidTime;
  }
  loadSettings();
  function answered(index) {
    const response = responses.get(index);
    return Boolean(response && (response.chosen.length || response.text.trim()));
  }
  function progress(index) {
    const done = entries.reduce((n, _, i) => n + Number(answered(i)), 0);
    find('[data-exam-progress]').textContent = submitted ? `已交卷 · ${entries.length} 題` : `已作答 ${done} / ${entries.length} 題`;
    updateNavigation(index);
  }
  function renderNavigation() {
    find('[data-exam-nav-panel]').hidden=false;
    find('[data-exam-nav]').innerHTML=entries.map((_,i)=>`<button type="button" data-exam-jump="${i}">${i+1}</button>`).join('');
    updateNavigation();
  }
  function updateNavigation(changedIndex) {
    const buttons=find('[data-exam-nav]').children;
    const indexes=Number.isInteger(changedIndex)?[changedIndex]:[...buttons].map((_,index)=>index);
    for(const index of indexes){
      const button=buttons[index];if(!button)continue;
      const state=submitted?(results[index]?.correct?'right':answered(index)?'wrong':'empty'):flags.has(index)?'flagged':answered(index)?'answered':'empty';
      const label={right:'答對',wrong:'答錯',empty:submitted?'未作答':'未答',flagged:'待檢查',answered:'已作答'}[state];
      button.dataset.state=state;
      button.setAttribute('aria-label',`第 ${index+1} 題，${label}${submitted&&flags.has(index)?'，考試時標記待檢查':''}`);
      button.title=label;
      button.hidden=submitted && questionList.children[index]?.hidden;
      const mark=questionList.children[index]?.querySelector('[data-exam-flag]');
      if(mark){mark.setAttribute('aria-pressed',String(flags.has(index)));mark.textContent=flags.has(index)?'取消待檢查':'標記待檢查';mark.hidden=submitted;}
    }
    find('[data-exam-nav-legend]').textContent=submitted?'✓ 答對　× 答錯　○ 未作答':'✓ 已作答　○ 未答　⚑ 待檢查';
    find('[data-exam-next-unanswered]').hidden=submitted;
    find('[data-exam-next-flag]').hidden=submitted;
    find('[data-exam-next-unanswered]').disabled=!entries.some((_,i)=>!answered(i));
    find('[data-exam-next-flag]').disabled=!flags.size;
  }
  function jump(index) {
    const card=questionList.children[index];
    if(!card || card.hidden)return;
    card.scrollIntoView?.({block:'start'});
    card.querySelector('h3')?.focus({preventScroll:true});
  }
  function stopClock() {
    if(timer!==null)window.clearInterval?.(timer);
    timer=null;
    find('[data-exam-clock]').hidden=true;
  }
  function tickClock() {
    if(!deadline || submitted || !entries.length){stopClock();return;}
    const clock=find('[data-exam-clock]');
    const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    clock.hidden=false;
    clock.textContent=`剩餘 ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
    if(left===0){submit(true);notice.textContent='時間到，已自動交卷。'+notice.textContent;}
  }
  function startClock() {
    stopClock();
    if(!deadline || submitted)return;
    tickClock();
    if(!submitted)timer=window.setInterval?.(tickClock,1000)??null;
  }
  function questionMarkup(entry, index) {
    const q = entry.q, opts = options(q), type=questionType(q), multiple=type==='多選題';
    const content = opts.length ? `<div class="options">${opts.map((option, i) => `<label class="option"><input type="${multiple ? 'checkbox' : 'radio'}" name="exam-${index}" data-exam-index="${index}" data-original-index="${q.optionOrder?.[i]??i}" value="${i}"><span>${/^[A-H][.、．:：]/i.test(String(option).trim()) ? esc(option) : String.fromCharCode(65+i)+'. '+esc(option)}${q.optionTranslations?.[i] ? `<small class="option-translation">${esc(q.optionTranslations[i])}</small>` : ''}</span></label>`).join('')}</div>` : window.coursePractice.entryMarkup(q, entry.id, "", {className:"",icon:""}).replaceAll("<textarea", `<textarea data-exam-index="${index}"`);
    return `<article class="exam-card" data-exam-card="${index}" data-exam-question-id="${esc(entry.id)}"><div class="exam-badges"><span>${index+1} / ${entries.length}</span><span>${esc(entry.unit)} · ${esc(topicName(entry))}</span><span>${type}</span><button type="button" class="plain exam-flag" data-exam-flag="${index}" aria-pressed="false">標記待檢查</button></div><h3 id="exam-question-${index}" tabindex="-1">${esc(q.stem ?? q.q)}</h3>${q.translation ? `<p class="exam-translation">${esc(q.translation)}</p>` : ''}${tools.questionImagesMarkup(q)}<div role="group" aria-labelledby="exam-question-${index}">${content}</div><div data-exam-review hidden></div></article>`;
  }
  function start() {
    if(pendingExam && !window.confirm('開始新測驗將取代未交卷的暫存；上次已交卷結果仍保留。確定開始？'))return;
    refreshPool();if(find('[data-exam-start]').disabled)return;
    const candidates=pool(), plan=languagePlan(candidates,requestedCount(candidates));
    if(plan.shortage||!plan.entries.length)return;
    saveSettings();
    const filters=[topic.value==='all'?'':topic.value,type.value==='all'?'':type.value].filter(Boolean);
    begin(plan.entries,poolLabel+' · '+(language.value==='ratio'?`中文 ${find('[data-exam-ratio]').value}%／英文 ${100-Number(find('[data-exam-ratio]').value)}%`:[...language.options].find(option=>option.value===language.value).textContent)+(filters.length?' · '+filters.join(' · '):''),timed.checked?positiveInteger(minutes.value,600):0);
  }
  function begin(selected,label,timeLimit=0) {
    markWrong = false; addedWrongReviews = new Set();
    stopClock();flags=new Set();startedAt=Date.now();deadline=timeLimit?startedAt+timeLimit*60000:0;
    optionSession.reset();entries=selected.map(entry=>({...entry,q:optionSession.get(entry.q,entry.id)}));
    if (!entries.length) return;
    completedAt = ''; resultFilter = 'all'; sessionLabel = label; responses = new Map(); results = []; submitted = false; confirmation = '';
    showSession();saveDraft(true);startClock();
  }
  function showSession() {
    find('[data-exam-setup]').hidden = true; find('[data-exam-session]').hidden = false;
    find('.exam-footer').hidden = false; find('[data-exam-results]').hidden = true;
    find('[data-exam-submit]').hidden = false; notice.textContent = '';
    find('[data-exam-description]').textContent = `${sessionLabel} · 隨機 ${entries.length} 題；選擇題選項每場重新排列，相依選項保留原序。`;
    questionList.innerHTML = entries.map(questionMarkup).join('');
    renderNavigation();
    find('.exam-body').scrollTop = 0; progress();
    questionList.querySelector('input, textarea')?.focus();
  }
  function updateResponse(event) {
    const input = event.target;
    if (submitted || input.dataset.examIndex === undefined) return;
    if(deadline&&Date.now()>=deadline){tickClock();return;}
    const index = Number(input.dataset.examIndex), card = input.closest('[data-exam-card]');
    responses.set(index, {chosen:[...card.querySelectorAll('input:checked')].map(el => Number(el.value)), text:(card.querySelector('[data-draft]') || card.querySelector('textarea'))?.value || '', fields:[...card.querySelectorAll('[data-fill-index]')].map(field=>field.value)});
    confirmation = ''; notice.textContent = ''; progress(index);saveDraft();
  }
  function summary() {
    const correct = results.filter(r => r.correct).length;
    const self = results.filter(r => r.selfAssessed).length;
    find('[data-exam-results]').innerHTML = `<h3>測驗結果：${Math.round(correct / entries.length * 100)} 分</h3><p>答對 ${correct} / ${entries.length} 題 · 答錯或未答 ${entries.length-correct} 題${self ? ` · 其中 ${self} 題為自行確認` : ''}</p><p class="exam-hint">填空依題庫文字核對；若你的其他寫法也正確，可在對照解析後自行確認。</p><label>顯示題目<select data-exam-result-filter><option value="all">全部題目</option><option value="wrong">只看錯題與未作答</option><option value="unanswered">只看未作答</option><option value="flagged">只看考試時標記</option></select></label><button type="button" class="reveal" data-exam-retry>重練錯題與未作答</button>`;
    const reviewLabel = document.createElement('label');
    reviewLabel.className = 'exam-review-toggle';
    reviewLabel.innerHTML = `<input type="checkbox" data-exam-mark-wrong> 將本次答錯或未答的題目全部標記為待複習（${entries.length-correct} 題）`;
    const reviewToggle = reviewLabel.querySelector('input');
    reviewToggle.checked = markWrong;
    reviewToggle.disabled = !window.learningUI?.addReviews || (!markWrong && correct === entries.length);
    find('[data-exam-results]').append(reviewLabel);
    const analysis=document.createElement('div');
    analysis.className='exam-analysis';
    const elapsed=startedAt ? Math.max(0,Math.round((Math.min(Date.parse(completedAt),deadline||Infinity)-startedAt)/1000)) : 0;
    analysis.innerHTML=`${startedAt?`<p class="exam-hint">用時 ${Math.floor(elapsed/60)} 分 ${elapsed%60} 秒${deadline?' · 限時測驗':''}</p>`:''}<h4>測驗結果分析</h4>${analysisTable('依單元',entry=>entry.unit||'其他單元')}${analysisTable('依主題',entry=>[entry.unit,topicName(entry)].filter(Boolean).join(' · '))}${analysisTable('依題型',entry=>questionType(entry.q))}`;
    find('[data-exam-results]').append(analysis);
    find('[data-exam-result-filter]').value = resultFilter;
    find('[data-exam-retry]').hidden = correct===entries.length;
    filterResults();
  }
  function analysisTable(label, classify) {
    const groups=new Map();
    entries.forEach((entry,i)=>{
      const name=classify(entry);
      const group=groups.get(name)||{name,total:0,correct:0};
      group.total++;group.correct+=Number(results[i]?.correct===true);groups.set(name,group);
    });
    const rows=[...groups.values()].sort((a,b)=>a.correct/a.total-b.correct/b.total||b.total-a.total);
    return `<details class="exam-analysis-section"><summary>${esc(label)}（${rows.length} 組）</summary><table><thead><tr><th scope="col">分類</th><th scope="col">答對／總題數</th><th scope="col">正確率</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.name)}</th><td>${row.correct}／${row.total}</td><td>${Math.round(row.correct/row.total*100)}%</td></tr>`).join('')}</tbody></table></details>`;
  }
  function filterResults() {
    [...questionList.children].forEach((card,i) => { card.hidden = resultFilter === "wrong" ? Boolean(results[i]?.correct) : resultFilter === "unanswered" ? answered(i) : resultFilter==='flagged'?!flags.has(i):false; });
    updateNavigation();
  }
  function submit(force = false) {
    if (submitted) return;
    const missing = entries.filter((_, i) => !answered(i)).length;
    if (missing && confirmation !== 'submit' && force!==true && !(deadline&&Date.now()>=deadline)) {
      confirmation = 'submit'; notice.textContent = `還有 ${missing} 題未作答；未答以 0 分計。確定交卷請再按一次「交卷」。`; return;
    }
    submitted = true; stopClock(); confirmation = ''; notice.textContent = '';
    results = entries.map(({q}, index) => {
      const response = responses.get(index) || {chosen:[],text:''};
      const result=window.coursePractice.evaluate(answer(q), options(q), response.chosen, q, response.text);
      return {...result,correct:result.correct===true};
    });
    completedAt = new Date().toISOString();
    saveLast();
    clearDraft();lastInfo();
    renderResults();
  }
  function renderResults() {
    for (const [index, entry] of entries.entries()) {
      const {q,id} = entry, card = questionList.children[index], result = results[index], review = card.querySelector('[data-exam-review]');
      card.querySelectorAll('input, textarea').forEach(input => input.disabled = true);
      const expected = options(q).length ? key(q) : '';
      card.querySelectorAll('.option').forEach((option, i) => option.classList.toggle('correct', Boolean(expected?.includes(String.fromCharCode(65+i)))));
      const response = responses.get(index), yourAnswer = options(q).length ? (response?.chosen || []).sort((a,b)=>a-b).map(i=>String.fromCharCode(65+i)).join('、') : response?.text;
      review.hidden = false;
      review.innerHTML = `<p class="exam-verdict ${result.correct ? 'exam-right' : 'exam-wrong'}">${result.selfAssessed ? '自行確認正確' : result.correct ? '答對' : answered(index) ? '答錯' : '未作答'}</p><p><strong>你的答案：</strong>${esc(yourAnswer || '未作答')}</p><div class="answer"><strong>${tools.answerLabel(q)}</strong><div>${tools.answerValueMarkup(q)}</div><div class="explain"><strong>解析</strong><div class="explanation-text">${tools.explanationMarkup(q, esc)}</div></div></div>${!options(q).length && (!result.correct || result.selfAssessed) && answered(index) ? `<button type="button" class="plain" data-exam-self="${index}" aria-pressed="${Boolean(result.selfAssessed)}">${result.selfAssessed ? '已自行確認正確（取消）' : '我的寫法也正確（自行確認）'}</button>` : ''}<button type="button" class="plain" data-exam-review-id="${esc(id)}">${window.learningUI?.isSaved(id) ? '已加入待複習' : '加入待複習'}</button>`;
    }
    find('[data-exam-submit]').hidden = true; find('[data-exam-results]').hidden = false;
    summary(); progress(); find('.exam-body').scrollTop = 0; find('[data-exam-results]').focus();
  }
  function reset() {
    if (!submitted && entries.length && confirmation !== 'reset') { confirmation = 'reset'; notice.textContent = '重新設定會清除本次作答，確定請再按一次「重新設定」。'; return; }
    if(!submitted)clearDraft();
    stopClock();find('[data-exam-nav-panel]').hidden=true;flags.clear();
    entries = []; responses.clear(); submitted = false; confirmation = ''; notice.textContent = '';
    questionList.replaceChildren(); find('[data-exam-session]').hidden = true; find('.exam-footer').hidden = true;
    find('[data-exam-setup]').hidden = false; lastInfo(); refreshPool(); scope.focus();
  }
  trigger.addEventListener('click', () => { if (!entries.length) refreshPool(); else if(deadline&&!submitted)tickClock(); dialog.showModal(); });
  find('[data-exam-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger.focus());
  const updateSettings=()=>{refreshPool();saveSettings();};
  for(const control of [scope,language,size,topic,type,from,to,timed,customSize,minutes,find('[data-exam-ratio]')])control.addEventListener('change',updateSettings);
  for(const control of [customSize,minutes,find('[data-exam-ratio]')])control.addEventListener('input',updateSettings);
  find('[data-exam-nav]').addEventListener('click',event=>{
    const button=event.target.closest('[data-exam-jump]');if(button)jump(Number(button.dataset.examJump));
  });
  find('[data-exam-next-unanswered]').addEventListener('click',()=>jump(entries.findIndex((_,i)=>!answered(i))));
  find('[data-exam-next-flag]').addEventListener('click',()=>jump(entries.findIndex((_,i)=>flags.has(i))));
  find('[data-exam-last]').addEventListener('click', restoreLast);
  find('[data-exam-resume]').addEventListener('click', resumeDraft);
  find('[data-exam-results]').addEventListener('click',event=>{if(event.target.closest('[data-exam-retry]'))retryWrong();});
  function updateWrongReviews() {
    if (!window.learningUI?.addReviews) return;
    const wrong = new Set(entries.filter((_,i)=>!results[i]?.correct).map(entry=>entry.id));
    const remove = [...addedWrongReviews].filter(id=>!markWrong || !wrong.has(id));
    window.learningUI.removeReviews(remove);
    remove.forEach(id=>addedWrongReviews.delete(id));
    const added = markWrong ? window.learningUI.addReviews([...wrong]) : {changed:[],persistent:window.learningUI.persistent};
    added.changed.forEach(id=>addedWrongReviews.add(id));
    notice.textContent = markWrong ? `已將本次 ${wrong.size} 題錯題與未答題加入待複習，原有標記保留。` : '已撤回本次新增的待複習標記，原有標記保留。';
    if (!added.persistent) notice.textContent += '瀏覽器無法保存，關閉後可能遺失。';
    questionList.querySelectorAll('[data-exam-review-id]').forEach(button=>{
      const saved = window.learningUI.isSaved(button.dataset.examReviewId);
      button.textContent = saved ? '已加入待複習' : '加入待複習'; button.disabled = saved;
    });
  }
  find('[data-exam-results]').addEventListener('change', event => {
    if (event.target.matches('[data-exam-result-filter]')) {resultFilter = event.target.value; filterResults();}
    if (event.target.matches('[data-exam-mark-wrong]')) {markWrong = event.target.checked; updateWrongReviews(); saveLast();}
  });
  find('[data-exam-start]').addEventListener('click', start);
  find('[data-exam-submit]').addEventListener('click', submit);
  find('[data-exam-reset]').addEventListener('click', reset);
  questionList.addEventListener('input', updateResponse);
  questionList.addEventListener('change', updateResponse);
  questionList.addEventListener('click', event => {
    const flag=event.target.closest('[data-exam-flag]');
    if(flag&&!submitted){
      const i=Number(flag.dataset.examFlag);if(flags.has(i))flags.delete(i);else flags.add(i);
      updateNavigation(i);saveDraft();return;
    }
    const self = event.target.closest('[data-exam-self]');
    if (self) { const result = results[Number(self.dataset.examSelf)]; result.selfAssessed = !result.selfAssessed; result.correct = result.selfAssessed; self.setAttribute('aria-pressed', String(result.selfAssessed)); self.textContent = result.selfAssessed ? '已自行確認正確（取消）' : '我的寫法也正確（自行確認）'; const verdict=self.closest('.exam-card').querySelector('.exam-verdict'); verdict.textContent=result.selfAssessed?'自行確認正確':'答錯'; verdict.className='exam-verdict '+(result.selfAssessed?'exam-right':'exam-wrong'); if(markWrong)updateWrongReviews(); summary(); saveLast(); }
    const review = event.target.closest('[data-exam-review-id]');
    if (review) { window.learningUI?.addReview(review.dataset.examReviewId); review.textContent = '已加入待複習'; review.disabled = true; }
  });
  function exportBackup() { return JSON.parse(JSON.stringify({last:lastExam,draft:pendingExam})); }
  function prepareBackup(data) {
    if(!data || typeof data!=='object' || Array.isArray(data))throw new Error('測驗備份資料不完整。');
    const copy=JSON.parse(JSON.stringify(data));
    if(Array.isArray(copy.last?.results))copy.last.results=copy.last.results.map(r=>r?.correct===null?{...r,correct:false}:r);
    if(copy.last && (!validEntries(copy.last)||!validResponses(copy.last.responses,copy.last.entries.length)||!Array.isArray(copy.last.results)||copy.last.results.length!==copy.last.entries.length||!copy.last.results.every(r=>typeof r?.correct==='boolean')||!Number.isFinite(Date.parse(copy.last.completedAt))))throw new Error('已交卷測驗備份不正確。');
    if(copy.draft && (!validEntries(copy.draft)||!validResponses(copy.draft.responses,copy.draft.entries.length)||typeof copy.draft.sessionId!=='string'||!Number.isFinite(Date.parse(copy.draft.updatedAt))))throw new Error('未交卷測驗備份不正確。');
    // Imported marks are now ordinary bookmarks; do not claim ownership of marks
    // that may already have existed on the receiving device.
    if(copy.last){copy.last.markWrong=false;copy.last.addedWrongReviews=[];}
    const newer=(current,incoming,field)=>!incoming?current:!current||Date.parse(incoming[field])>Date.parse(current[field])?incoming:current;
    return {last:newer(lastExam,copy.last,'completedAt'),draft:newer(pendingExam,copy.draft,'updatedAt')};
  }
  function applyBackup(data) { lastExam=data.last;pendingExam=data.draft;lastInfo(); }
  window.courseExam = { sample, eligible, languagePlan, exportBackup, prepareBackup, applyBackup,
    backupKeys:{last:storageKey,draft:draftKey,answers:responseKey} };
})();
