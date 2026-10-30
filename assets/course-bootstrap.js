/* Complete public snapshots/cache render synchronously; the API remains authoritative. */
(() => {
  'use strict';
  const config = window.courseLearning;
  if (!config?.mergeCommunityQuestions || !window.courseContributions) return;
  const linkedId = new URLSearchParams(location.search).get('question');
  const linkedSubmission = /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(linkedId || '') && !config.validId(linkedId);
  let interacted = false, syncing = false, syncAgain = false, notice, source = 'builtin';
  const cacheKey = 'course-library.questions.v1.' + config.course;
  let snapshot = null;
  try { snapshot = JSON.parse(document.getElementById('course-community-snapshot')?.textContent || 'null'); } catch {}
  const curation = snapshot?.course === config.course ? snapshot.curation : null;
  let basicsCuration = null;
  try { basicsCuration = JSON.parse(document.getElementById('course-os-basics-curation')?.textContent || 'null'); } catch {}
  let architectureCuration = null;
  try { architectureCuration = JSON.parse(document.getElementById('course-os-architecture-curation')?.textContent || 'null'); } catch {}
  let processCuration = null;
  try { processCuration = JSON.parse(document.getElementById('course-os-process-curation')?.textContent || 'null'); } catch {}
  let threadCuration = null;
  try { threadCuration = JSON.parse(document.getElementById('course-os-threads-curation')?.textContent || 'null'); } catch {}
  let schedulingCuration = null;
  try { schedulingCuration = JSON.parse(document.getElementById('course-os-scheduling-curation')?.textContent || 'null'); } catch {}
  if (config.course === 'os' && basicsCuration?.unit === 'basics' && Array.isArray(basicsCuration.order))
    config.setUnitQuestionOrder?.('basics', basicsCuration.order);
  if (config.course === 'os' && architectureCuration?.unit === 'architecture' && Array.isArray(architectureCuration.order))
    config.setUnitQuestionOrder?.('architecture', architectureCuration.order);
  if (config.course === 'os' && processCuration?.unit === 'process' && Array.isArray(processCuration.order))
    config.setUnitQuestionOrder?.('process', processCuration.order);
  if (config.course === 'os' && threadCuration?.unit === 'threads' && Array.isArray(threadCuration.order))
    config.setUnitQuestionOrder?.('threads', threadCuration.order);
  if (config.course === 'os' && schedulingCuration?.unit === 'scheduling' && Array.isArray(schedulingCuration.order))
    config.setUnitQuestionOrder?.('scheduling', schedulingCuration.order);
  let treasureCuration = null;
  try { treasureCuration = JSON.parse(document.getElementById('course-os-treasure-curation')?.textContent || 'null'); } catch {}
  if (config.course === 'os' && treasureCuration?.unit === 'treasure') config.setUnitQuestionOrder?.('treasure', treasureCuration.order);
  const markInteraction = () => { interacted = true; };
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart'])
    document.addEventListener(event, markInteraction, {once:true, passive:true});

  function cleanHeading(value) {
    return String(value ?? '').replace(/^(?:Beast|妖獸)\s*\d+\s*[.．、:：-]\s*/i, '');
  }
  function sourceSignature(q) {
    const text = JSON.stringify([String(q.type || ''), String(q.stem || ''), Array.isArray(q.options) ? q.options : [], String(q.answer || '')]);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function curateRows(rows, curation, basicsCuration) {
    if (!Array.isArray(rows)) return [];
    const curatedArchitectureRows = rows.map(row => {
      if (row?.unit !== 'architecture' || !row.question || architectureCuration?.unit !== 'architecture') return row;
      const original = row.question;
      const meta = architectureCuration.questions?.[original.id];
      if (!meta || sourceSignature(original) !== meta.sourceSignature) return row;
      const question = { ...original };
      if (meta.category && (!original.category || ['HTML 匯入', '作業系統基礎', '作業系統架構'].includes(original.category))) question.category = meta.category;
      if (!String(original.explanation || '').trim() && String(meta.explanation || '').trim()) question.explanation = meta.explanation;
      if (!String(original.note || '').trim() && String(meta.note || '').trim()) question.note = meta.note;
      if (meta.clearSubmissionReview === true) delete question.submissionReview;
      return { ...row, question };
    });
    const curatedBasicsRows = curatedArchitectureRows.map(row => {
      if (row?.unit !== 'basics' || !row.question || basicsCuration?.unit !== 'basics') return row;
      const original = row.question;
      const meta = basicsCuration.questions?.[original.id];
      if (!meta || sourceSignature(original) !== meta.sourceSignature) return row;
      const question = { ...original };
      if (meta.category && (!original.category || original.category === 'HTML 匯入' || original.category === '作業系統基礎')) question.category = meta.category;
      if (!String(original.explanation || '').trim() && String(meta.explanation || '').trim()) question.explanation = meta.explanation;
      if (!String(original.note || '').trim() && String(meta.note || '').trim()) question.note = meta.note;
      if (meta.clearSubmissionReview === true) delete question.submissionReview;
      return { ...row, question };
    });
    const curatedProcessRows = curatedBasicsRows.map(row => {
      if (row?.unit !== 'process' || !row.question || processCuration?.unit !== 'process') return row;
      const original = row.question;
      const meta = processCuration.questions?.[original.id];
      if (!meta || sourceSignature(original) !== meta.sourceSignature) return row;
      const question = { ...original };
      if (meta.category && (!original.category || ['HTML 匯入', '程序與 IPC'].includes(original.category))) question.category = meta.category;
      if (!String(original.explanation || '').trim() && String(meta.explanation || '').trim()) question.explanation = meta.explanation;
      if (!String(original.note || '').trim() && String(meta.note || '').trim()) question.note = meta.note;
      if (meta.clearSubmissionReview === true) delete question.submissionReview;
      return { ...row, question };
    });
    const curatedThreadRows = curatedProcessRows.map(row => {
      if (row?.unit !== 'threads' || !row.question || threadCuration?.unit !== 'threads') return row;
      const original = row.question;
      const meta = threadCuration.questions?.[original.id];
      if (!meta || sourceSignature(original) !== meta.sourceSignature) return row;
      const question = { ...original };
      if (meta.category && (!original.category || original.category === '執行緒與多執行緒')) question.category = meta.category;
      if (!String(original.explanation || '').trim() && String(meta.explanation || '').trim()) question.explanation = meta.explanation;
      if (!String(original.note || '').trim() && String(meta.note || '').trim()) question.note = meta.note;
      if (meta.clearSubmissionReview === true) delete question.submissionReview;
      return { ...row, question };
    });
    const curatedTreasureRows = curatedThreadRows.map(row => {
      const original = row?.question, meta = treasureCuration?.questions?.[original?.id];
      if (row?.unit !== 'treasure' || !meta || sourceSignature(original) !== meta.sourceSignature) return row;
      const question = { ...original };
      if (!question.category || ['挖寶單元','HTML 匯入'].includes(question.category)) question.category = meta.category;
      if (!String(question.explanation || '').trim()) question.explanation = meta.explanation;
      if (meta.clearSubmissionReview) delete question.submissionReview;
      return { ...row, question };
    });
    const presentIds = new Set(curatedTreasureRows.map(row=>row.question?.id));
    const aliasTargets = new Map((curation?.aliases || []).map(alias=>[alias.id,alias.target]));
    const aliases = new Set((curation?.aliases || []).filter(alias=>presentIds.has(alias.target)).map(alias=>alias.id));
    const ranks = new Map((curation?.order || []).map((id, index) => [id, index]));
    // Missing rows in a complete public response are hidden/merged, never fallbacks.
    const sourceRows = curatedTreasureRows;
    const l9 = [];
    sourceRows.forEach((row, inputIndex) => {
      if (row?.unit !== 'L9' || !row.question || aliases.has(row.question.id)) return;
      const original = row.question;
      const question = { ...original, stem: cleanHeading(original.stem) };
      delete question.note;
      if (curation?.unit) {
        question.unitTitle = curation.unit.title;
        question.unitEn = curation.unit.en;
        question.unitDescription = curation.unit.description;
      }
      const metaId = aliasTargets.get(question.id) || question.id;
      const meta = curation?.questions?.[metaId];
      const reference = (curation?.fallbackQuestions || []).find(q=>q.id===metaId);
      const republishedMatch = metaId !== question.id && reference && cleanHeading(reference.stem) === cleanHeading(original.stem) &&
        JSON.stringify(reference.options) === JSON.stringify(original.options) && reference.answer === original.answer && (!reference.type || reference.type === original.type);
      if (meta && (sourceSignature(original) === meta.sourceSignature || republishedMatch)) {
        question.editSource = Object.fromEntries(['category','type','stem','options','answer','explanation'].map(key => [key, original[key] ?? (key === 'options' ? [] : '')]));
        if (String(meta.stem || '').trim()) question.stem = meta.stem;
        if (!original.category || original.category === 'HTML 匯入') question.category = meta.category;
        if (!String(original.explanation || '').trim() && String(meta.explanation || '').trim()) question.explanation = meta.explanation;
      }
      l9.push({ row: { ...row, question }, inputIndex, rank: ranks.get(metaId) ?? Number.MAX_SAFE_INTEGER });
    });
    l9.sort((a, b) => a.rank - b.rank || a.inputIndex - b.inputIndex);
    const curatedL9Rows = l9.map(entry => entry.row);
    let inserted = false;
    return sourceRows.flatMap(row => {
      if (row?.unit !== 'L9') return [row];
      if (inserted) return [];
      inserted = true;
      return curatedL9Rows;
    });
  }
  function showNotice(text, retry = false) {
    if (!notice) {
      notice = document.createElement('p'); notice.className = 'api-notice';
      notice.style.order = linkedSubmission && !interacted ? '2' : '6';
      notice.setAttribute('role', 'status'); document.querySelector('.main').append(notice);
    }
    notice.replaceChildren(document.createTextNode(text));
    if (retry) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'plain'; button.textContent = '重新同步';
      button.addEventListener('click', sync); notice.append(button);
    }
  }
  function focusedSelector(element) {
    if (!element) return null;
    if (element.id) return '#' + CSS.escape(element.id);
    const attributes = ['data-draft','data-choice','data-index','data-review-id','data-reveal','data-add-review','data-page','data-unit','data-lesson','aria-label'];
    const selected = attributes.filter(name => element.hasAttribute(name));
    if (!selected.length) return null;
    const card = element.closest('article[data-id]'), parent = element.closest('[id]');
    const prefix = card ? `article[data-id="${CSS.escape(card.dataset.id)}"] ` : parent ? `#${CSS.escape(parent.id)} ` : '';
    return prefix + element.tagName.toLowerCase() + selected.map(name => `[${name}="${CSS.escape(element.getAttribute(name))}"]`).join('');
  }
  function merge(entries, aliases, overrides) {
    const focused = document.activeElement, selector = focusedSelector(focused);
    const selection = typeof focused?.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd, focused.selectionDirection] : null;
    const anchor = [...config.list.children].find(card => { const r=card.getBoundingClientRect();return r.bottom>0 && r.top<innerHeight; });
    const anchorTop = anchor?.getBoundingClientRect().top;
    const scroll = {x:scrollX,y:scrollY}, menu = config.sidebar.querySelector('.course-menu'), menuScroll = menu?.scrollTop;
    const result = config.mergeCommunityQuestions(entries, {openLinkedQuestion:linkedSubmission && !interacted, aliases, overrides, replace:true});
    if (!result.openedLinkedQuestion) {
      if (menu) menu.scrollTop = menuScroll;
      if (!focused?.isConnected && selector) {
        const replacement = document.querySelector(selector);
        replacement?.focus({preventScroll:true});
        if (replacement && selection) replacement.setSelectionRange(...selection);
      }
      const currentAnchor = anchor && config.list.querySelector(`article[data-id="${CSS.escape(anchor.dataset.id)}"]`);
      if (currentAnchor) window.scrollBy(0, currentAnchor.getBoundingClientRect().top - anchorTop);
      else window.scrollTo(scroll.x,scroll.y);
    }
    return result;
  }
  function validData(data) {
    if (!data || !['questions','aliases','overrides'].every(key => Array.isArray(data[key]))) return false;
    const ids = new Set();
    return data.questions.every(row => {
      const q = row?.question, id = config.course === 'os' ? q?.id : q?.bookmarkId;
      if (typeof row?.unit !== 'string' || !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(id || '') || ids.has(id)) return false;
      ids.add(id);
      return typeof (q.stem ?? q.q) === 'string' && typeof (q.answer ?? q.a) === 'string' &&
        Array.isArray(q.options ?? q.opts) && (q.options ?? q.opts).every(option => typeof option === 'string');
    }) && data.aliases.every(alias => typeof alias?.id === 'string' && typeof alias.target === 'string');
  }
  function validEnvelope(value) {
    const time = Date.parse(value?.generatedAt);
    return value?.schema === 1 && value.course === config.course && Number.isFinite(time) && time <= Date.now() + 300000 && validData(value.data);
  }
  function apply(data, name) {
    if (!validData(data)) throw new Error('Invalid public snapshot');
    const presentIds = new Set(data.questions.map(row=>row.question.id || row.question.bookmarkId));
    const curatedAliases = (curation?.aliases || []).flatMap(alias=>presentIds.has(alias.target) ? [alias] : presentIds.has(alias.id) ? [{id:alias.target,target:alias.id}] : []);
    const aliases = [...data.aliases, ...curatedAliases];
    merge(curateRows(data.questions, curation, basicsCuration), aliases, data.overrides);
    source = name;
    document.documentElement.dataset.questionSource = name;
  }
  function sourceLabel() {
    return source === 'cache' ? '上次同步的題庫快取' : source === 'snapshot' ? '網站隨附的完整題庫快照' : source === 'live' ? '最近同步的題庫' : '內建題庫';
  }
  // No local fetch precedes this render, including on file:// and offline visits.
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch {}
  const initial = validEnvelope(cached) && (!validEnvelope(snapshot) || Date.parse(cached.generatedAt) >= Date.parse(snapshot.generatedAt)) ? cached : validEnvelope(snapshot) ? snapshot : null;
  if (initial) {
    try { apply(initial.data, initial === cached ? 'cache' : 'snapshot'); } catch {
      if (initial === cached && validEnvelope(snapshot)) { try { apply(snapshot.data, 'snapshot'); } catch {} }
    }
  }
  let latestData = initial?.data || null;
  let latestEtag = /^(?:W\/)?".*"$/.test(initial?.etag || '') ? initial.etag : null;
  async function sync() {
    if (syncing) { syncAgain = true; return; }
    if (location.protocol === 'file:') {
      showNotice(`目前顯示${sourceLabel()}；開啟公開網站可同步最新修改及下架狀態。`);
      return;
    }
    if (!navigator.onLine) {
      showNotice(`目前離線，顯示${sourceLabel()}；連線後會同步最新修改及下架狀態。`, true);
      return;
    }
    syncing = true;
    notice?.querySelector('button')?.setAttribute('disabled','');
    try {
      const response = await fetch(window.courseContributions.apiOrigin + '/api/questions?course=' + config.course, {
        signal:AbortSignal.timeout(8000), cache:'no-cache',
        headers:latestEtag ? {'If-None-Match':latestEtag} : {}
      });
      const unchanged = response.status === 304 && latestData;
      if (!unchanged && !response.ok) throw new Error('unavailable');
      const data = unchanged ? latestData : await response.json();
      if (!validData(data)) throw new Error('Invalid public snapshot');
      if (JSON.stringify(data) !== JSON.stringify(latestData)) apply(data, 'live');
      else { source = 'live'; document.documentElement.dataset.questionSource = 'live'; }
      latestData = data;
      const responseEtag = response.headers?.get('etag');
      latestEtag = /^(?:W\/)?".*"$/.test(responseEtag || '') ? responseEtag : unchanged ? latestEtag : null;
      const serverTime = Date.parse(response.headers?.get('date'));
      const generatedAt = new Date(Number.isFinite(serverTime) ? serverTime : Date.now()).toISOString();
      try { localStorage.setItem(cacheKey, JSON.stringify({schema:1, course:config.course, generatedAt, data, etag:latestEtag})); } catch {}
      if (linkedSubmission && !config.validId(linkedId)) showNotice('這個投稿題目連結暫時沒有可用內容，已顯示原有題庫。',true);
      else { notice?.remove(); notice = null; }
    } catch {
      showNotice(`暫時無法同步，仍可使用${sourceLabel()}；尚未確認最新修改及下架狀態。`,true);
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; sync(); }
    }
  }
  if (initial) showNotice(`已顯示${sourceLabel()}，正在背景同步最新變更…`);
  else if (linkedSubmission) showNotice('正在載入這道投稿題目…');
  window.addEventListener('online',sync);
  sync();
})();
