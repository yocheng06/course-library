/* Local practice rounds and resume position, shared by both course pages. */
(() => {
  'use strict';
  const config = window.courseLearning, ui = window.learningUI;
  if (!config || !ui || !config.currentPosition || !config.restorePosition) return;

  const key = `course-library.practice.v1.${config.course}`;
  const lastCourseKey = 'course-library.last-course.v1';
  const communityId = id => /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(id);
  const canonicalId = id => typeof id === 'string' ? config.resolveId?.(id) || (communityId(id) ? id : null) : null;
  const records = new Map();
  let initial = {}, wrongOnly = false, storageFailed = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw && raw.length <= 1500000) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.records) && parsed.records.length <= 10000) initial = parsed;
    }
  } catch { storageFailed = true; }
  let autoReview = initial.autoReview === true;
  for (const record of initial.records || []) {
    const id = canonicalId(record?.id);
    if (!id || !Number.isInteger(record.attempts) || record.attempts < 1 || record.attempts > 100000 ||
        typeof record.firstCorrect !== 'boolean' || typeof record.lastCorrect !== 'boolean' ||
        typeof record.everWrong !== 'boolean') continue;
    const timestamp = Number.isFinite(record.updatedAt) ? record.updatedAt : 0;
    mergeRecord(id, {
      attempts: record.attempts, firstCorrect: record.firstCorrect, lastCorrect: record.lastCorrect,
      everWrong: record.everWrong, signature: typeof record.signature === 'string' && record.signature.length <= 100 ? record.signature : '',
      startedAt: Number.isFinite(record.startedAt) ? record.startedAt : timestamp, updatedAt: timestamp,
    });
  }

  function mergeRecord(id, next) {
    const current = records.get(id);
    if (!current) { records.set(id, next); return; }
    const first = current.startedAt <= next.startedAt ? current : next;
    const last = current.updatedAt >= next.updatedAt ? current : next;
    records.set(id, {
      attempts: Math.min(100000, current.attempts + next.attempts), firstCorrect: first.firstCorrect,
      lastCorrect: last.lastCorrect, everWrong: current.everWrong || next.everWrong,
      signature: last.signature, startedAt: first.startedAt, updatedAt: last.updatedAt,
    });
  }

  function migrateRecords() {
    for (const [id, record] of [...records]) {
      const target = canonicalId(id);
      if (target && target !== id) { records.delete(id); mergeRecord(target, record); }
    }
  }

  const panel = document.createElement('section');
  panel.className = 'practice-progress';
  panel.setAttribute('aria-label', '本次練習進度');
  panel.innerHTML = '<p class="practice-summary" role="status" aria-live="polite"></p><div class="practice-round-controls"><label><input type="checkbox" data-practice-wrong-only>只練本次錯題 <span data-practice-wrong-count></span></label><label><input type="checkbox" data-practice-auto-review>答錯自動加入待複習</label><button type="button" class="plain" data-practice-new-round>開始新一輪練習</button></div><p class="practice-round-hint">本課程本輪紀錄保存在這台裝置；錯題仍套用目前單元與篩選，答對訂正後也可繼續重練。</p><p class="practice-storage-warning" role="status" hidden></p>';
  const resumeNotice = document.createElement('p');
  resumeNotice.className = 'resume-notice'; resumeNotice.setAttribute('role', 'status'); resumeNotice.hidden = true;
  (document.querySelector('.learning-tools') || config.toolbar).after(resumeNotice, panel);
  const summary = panel.querySelector('.practice-summary');
  const wrongControl = panel.querySelector('[data-practice-wrong-only]');
  const autoControl = panel.querySelector('[data-practice-auto-review]');
  const warning = panel.querySelector('.practice-storage-warning');
  autoControl.checked = autoReview;

  function stats() {
    const rows = [...records.values()];
    return {
      answered: rows.length,
      firstCorrect: rows.filter(record => record.firstCorrect).length,
      retries: rows.reduce((count, record) => count + record.attempts - 1, 0),
      wrong: rows.filter(record => record.everWrong).length,
      corrected: rows.filter(record => record.everWrong && record.lastCorrect).length,
    };
  }

  function refresh() {
    migrateRecords();
    const current = stats();
    panel.hidden = !config.practiceMode();
    summary.textContent = `本課程本輪：已答 ${current.answered} 題 · 首次答對 ${current.firstCorrect} 題 · 重試 ${current.retries} 次 · 錯題 ${current.wrong} 題（已訂正 ${current.corrected} 題）`;
    const inScope = config.scopeIds().filter(id => records.get(canonicalId(id))?.everWrong).length;
    panel.querySelector('[data-practice-wrong-count]').textContent = `（目前範圍 ${inScope} 題）`;
    wrongControl.checked = wrongOnly;
    autoControl.checked = autoReview;
    warning.hidden = !storageFailed;
    warning.textContent = storageFailed ? '瀏覽器目前無法保存，練習紀錄僅保留在本頁。' : '';
  }

  function persist() {
    const position = config.currentPosition();
    try {
      localStorage.setItem(key, JSON.stringify({
        version: 1, autoReview, records: [...records].map(([id, record]) => ({id, ...record})), lastPosition: position,
      }));
      localStorage.setItem(lastCourseKey, JSON.stringify({version:1, course:config.course, ...position, updatedAt:Date.now()}));
      storageFailed = false;
    } catch { storageFailed = true; }
  }

  function responseSignature(response) {
    const value = JSON.stringify({choices:[...new Set(response?.choices || [])].sort((a,b)=>a-b), text:String(response?.text ?? '').normalize('NFKC').trim()});
    let hash = 2166136261;
    for (let index=0; index<value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return `${value.length}:${hash >>> 0}`;
  }

  function record(id, result, response) {
    if (typeof result?.correct !== 'boolean') return;
    id = canonicalId(id);
    if (!id) return;
    const signature = responseSignature(response), previous = records.get(id);
    if (previous?.signature === signature) return;
    const now = Date.now();
    records.set(id, {
      attempts: Math.min(100000, (previous?.attempts || 0) + 1),
      firstCorrect: previous ? previous.firstCorrect : result.correct,
      lastCorrect: result.correct, everWrong: previous?.everWrong === true || !result.correct,
      signature, startedAt: previous?.startedAt ?? now, updatedAt: now,
    });
    if (!result.correct && autoReview) ui.addReview?.(id, {silent:true});
    persist(); refresh();
  }

  window.coursePracticeProgress = {
    record, getStats:stats,
    get onlyWrong() { return wrongOnly; },
    includes:id => !wrongOnly || records.get(canonicalId(id))?.everWrong === true,
    clearFilter:()=>{wrongOnly=false;wrongControl.checked=false;},
  };
  wrongControl.addEventListener('change', () => {
    wrongOnly = wrongControl.checked; config.resetPage(); config.render();
  });
  autoControl.addEventListener('change', () => { autoReview=autoControl.checked; persist(); refresh(); });
  panel.querySelector('[data-practice-new-round]').addEventListener('click', () => {
    records.clear(); wrongOnly=false; wrongControl.checked=false;
    config.resetPractice(); persist(); refresh();
  });
  const originalRefresh = ui.refresh;
  ui.refresh = () => { originalRefresh(); persist(); refresh(); };
  const query = new URLSearchParams(location.search);
  if (!query.has('question') && query.get('resume') !== '0' && initial.lastPosition && config.restorePosition(initial.lastPosition)) {
    const restored = config.currentPosition();
    resumeNotice.textContent = `已回到上次的「${restored.unitLabel}」第 ${restored.page} 頁。`;
    resumeNotice.hidden = false;
  }
  window.addEventListener('pagehide', persist);
  persist(); refresh();
})();
