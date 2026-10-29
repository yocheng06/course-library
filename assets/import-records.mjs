import { COURSE_UNITS, TYPES, unitLabel, normalizeBatch } from './contribution-model.js?v=new-units-20261026';
import { api as defaultApi, esc as defaultEsc, message as defaultMessage, questionPreview as defaultPreview, showSimilar, downloadJSON } from './contributions-ui.js?v=integrated-management-20261029';

const statusNames = { approved: '已公開匯入', pending: '舊版待審', rejected: '舊版已退回' };

/** Historical batches are cached in memory; only an expanded batch has content. */
export function setupImportRecords({
  container = document.getElementById('importWorkspace'), userId = '',
  api = defaultApi, esc = defaultEsc, message = defaultMessage,
  questionPreview = defaultPreview, onChanged = () => {},
} = {}) {
  if (!container) throw new Error('找不到匯入紀錄工作區。');
  const cache = new Map();
  const details = new Map();
  const subscriptions = [];
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  };
  const draftKey = userId ? 'course-library.import-review-drafts.v2.' + userId : null;
  let drafts = {}, legacyDrafts = {}, selectedStatus = 'approved', sequence = 0, controller, timer, busy = false, workingCard = null, active = true;
  try { if (draftKey) drafts = JSON.parse(localStorage.getItem(draftKey) || '{}'); } catch {}
  try { if (userId) legacyDrafts = JSON.parse(localStorage.getItem('course-library-review-drafts-v1.' + userId) || '{}'); } catch {}
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) drafts = {};
  if (!legacyDrafts || typeof legacyDrafts !== 'object' || Array.isArray(legacyDrafts)) legacyDrafts = {};
  const notifyChange = change => { try { onChanged(change)?.catch?.(() => {}); } catch {} };
  container.innerHTML = `<div class="section-heading"><div><h2>匯入紀錄</h2><p class="muted">查看每批匯入內容，或整批、逐題移除及重新公開。新投稿已直接公開。</p></div></div><form class="panel review-controls" data-import-controls><label>紀錄範圍<select data-import-status><option value="approved">已公開匯入</option><option value="pending">舊版待審</option><option value="rejected">舊版已退回</option></select></label><button type="button" class="button secondary" data-import-refresh>重新整理</button></form><p role="status" aria-live="polite" data-import-count></p><div data-import-list></div><button class="button secondary" type="button" data-import-more hidden>載入更多紀錄</button>`;
  const $ = selector => container.querySelector(selector);
  const current = () => cache.get(selectedStatus);
  const record = id => details.get(id) || current()?.items.get(id);
  const status = text => { $('[data-import-count]').textContent = text; };
  const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '時間未提供' : d.toLocaleString('zh-TW'); };
  const unitOptions = (course, selected, title) => {
    const units = { ...(COURSE_UNITS[course]?.units || {}) };
    if (selected && !units[selected]) units[selected] = unitLabel(course, selected, title);
    return Object.entries(units).map(([id, name]) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(name)}</option>`).join('');
  };
  const batchTitle = entry => `${entry.title || entry.payload?.title || '未命名匯入'} · ${COURSE_UNITS[entry.course || entry.payload?.course]?.name || entry.course || entry.payload?.course || ''} · ${unitLabel(entry.course || entry.payload?.course, entry.unit || entry.payload?.unit, entry.unitTitle || entry.payload?.unitTitle)} · ${entry.questionCount ?? entry.payload?.questions?.length ?? 0} 題`;
  const summary = entry => `<details class="panel import-record" data-import-id="${esc(entry.id)}"><summary>${esc(batchTitle(entry))}<span class="muted"> · ${esc(date(entry.createdAt))}</span></summary><div data-import-body></div></details>`;
  function render() {
    const data = current();
    $('[data-import-list]').innerHTML = data ? [...data.items.values()].map(summary).join('') : '';
    $('[data-import-more]').hidden = !data?.cursor;
    status(data?.items.size ? `${statusNames[selectedStatus]}：已載入 ${data.items.size} 批。` : `目前沒有${statusNames[selectedStatus]}的紀錄。`);
  }
  async function load(append = false) {
    flush();
    const seq = ++sequence, wanted = selectedStatus, old = cache.get(wanted);
    controller?.abort(); controller = new AbortController();
    status(append ? '正在載入更多紀錄…' : '正在載入匯入紀錄…');
    $('[data-import-refresh]').disabled = true; $('[data-import-more]').disabled = true;
    try {
      const result = await api('/api/manage/imports?status=' + wanted + (append && old?.cursor ? '&cursor=' + encodeURIComponent(old.cursor) : ''), { signal: controller.signal });
      if (!active || seq !== sequence) return;
      const items = append ? new Map(old?.items || []) : new Map();
      if (!append) details.clear();
      for (const item of result.items || []) items.set(item.id, item);
      cache.set(wanted, { items, cursor: result.nextCursor || null });
      render();
    } catch (error) {
      if (active && seq === sequence && error.name !== 'AbortError') status(error.message + (old ? ' 原有紀錄仍保留，可重新整理。' : ' 請重新整理再試。'));
    } finally {
      if (active && seq === sequence) { $('[data-import-refresh]').disabled = false; $('[data-import-more]').disabled = false; }
    }
  }
  async function loadDetail(entry) {
    if (entry.payload?.questions) { details.set(entry.id, entry); return entry; }
    const result = await api('/api/manage/imports/' + encodeURIComponent(entry.id));
    const full = { ...entry, ...result.item };
    details.set(full.id, full);
    return full;
  }
  function usableDraft(entry) {
    const legacy = legacyDrafts['review:' + entry.id];
    if (!drafts[entry.id] && legacy?.revision === entry.revision && Array.isArray(legacy.questions)) {
      const migrated = {revision:legacy.revision,batch:legacy.batch || {},note:legacy.note || '',keptIndices:[],questionEdits:{}};
      for (const saved of legacy.questions) {
        const original = entry.payload.questions[saved.index]; if (!original) continue;
        const q = {...original};
        for (const [field,value] of Object.entries(saved.values || {})) if (typeof value === 'string') q[field] = field === 'options' ? value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : value;
        if (Array.isArray(saved.keep)) q.images = saved.keep.map(i=>original.images[i]).filter(Boolean);
        migrated.keptIndices.push(saved.index); migrated.questionEdits[saved.index] = q;
      }
      drafts[entry.id] = migrated;
    }
    const draft = drafts[entry.id];
    return draft?.revision === entry.revision ? draft : null;
  }
  function questionFor(entry, index) { return usableDraft(entry)?.questionEdits?.[index] || entry.payload.questions[index]; }
  function questionSummary(entry, index, pending) {
    const q = questionFor(entry, index);
    return `<details class="import-question" data-question-index="${index}" data-question-mode="${pending ? 'edit' : 'preview'}"><summary>第 ${index + 1} 題 · ${esc(q.type)} · ${esc(q.stem.slice(0, 120))}</summary><div data-question-body></div></details>`;
  }
  function publicationControls(entry) {
    const items = entry.publications || [], published = items.filter(q => q.published && !q.mergedInto).length,
      removed = items.filter(q => !q.published && !q.mergedInto).length, merged = items.filter(q => q.mergedInto).length;
    if (!items.length) return '<p class="muted">沒有可管理的公開題目。</p>';
    return `<section class="approved-publications" aria-label="整批或逐題管理"><p>公開中 ${published} 題 · 已移除 ${removed} 題${merged ? ` · 已整合 ${merged} 題` : ''}。操作會保留題目與歷史。</p><div class="actions"><button type="button" class="button secondary" data-publication-action="hide-all" ${published ? '' : 'disabled'}>整批移除（${published} 題）</button><button type="button" class="button secondary" data-publication-action="restore-all" ${removed ? '' : 'disabled'}>整批重新公開（${removed} 題）</button></div><details data-publication-picker><summary>逐題選擇</summary><div data-publication-options></div><div class="actions"><button type="button" class="button secondary" data-publication-action="hide-selected" disabled>移除勾選題目</button><button type="button" class="button secondary" data-publication-action="restore-selected" disabled>重新公開勾選題目</button></div></details></section>`;
  }
  function openRecord(card, entry) {
    const pending = entry.status === 'pending', p = entry.payload, draft = usableDraft(entry), kept = draft?.keptIndices || p.questions.map((_, i) => i);
    const fields = pending ? `<p class="notice">這是舊流程留下的待審資料；現在的新投稿已直接公開。展開單題後可編輯。</p><div class="field-grid"><label>科目<select data-batch="course">${Object.entries(COURSE_UNITS).map(([id,c]) => `<option value="${id}" ${id === p.course ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label><label>單元<select data-batch="unit">${unitOptions(p.course,p.unit,p.unitTitle)}</select></label></div><label>新單元名稱（選填）<input data-batch="unitTitle" maxlength="60" value="${esc(p.unitTitle || '')}"></label><label>題庫名稱<input data-batch="title" maxlength="100" value="${esc(p.title)}"></label><label>來源說明<textarea data-batch="source" rows="2" maxlength="2000">${esc(p.source || '')}</textarea></label>` : publicationControls(entry);
    card.querySelector('[data-import-body]').innerHTML = `<p class="muted">投稿編號：${esc(entry.id)}<br>來源：${esc(p.source || '未提供')}<br>投稿者：${esc(p.name || '未提供稱呼')}</p>${fields}<div data-import-questions>${kept.map(i => questionSummary(entry, i, pending)).join('')}</div>${entry.note ? `<p>站主說明：${esc(entry.note)}</p>` : ''}${pending ? '<div class="similar-warning" hidden></div><label>處理說明（退回時必填）<textarea class="review-note" rows="2" maxlength="2000"></textarea></label><div class="actions"><button type="button" class="button" data-import-decision="approve">核准並公開保留題目</button><button type="button" class="button secondary" data-import-decision="reject">退回這批投稿</button><button type="button" class="text-button" data-import-discard>捨棄本機草稿</button></div><p class="muted" data-import-draft-status></p>' : ''}`;
    if (pending && draft) {
      for (const node of card.querySelectorAll('[data-batch]')) {
        if (typeof draft.batch?.[node.dataset.batch] === 'string') {
          if (node.dataset.batch === 'course') card.querySelector('[data-batch="unit"]').innerHTML = unitOptions(draft.batch.course, draft.batch.unit, draft.batch.unitTitle);
          node.value = draft.batch[node.dataset.batch];
        }
      }
      card.querySelector('.review-note').value = draft.note || '';
      card.querySelector('[data-import-draft-status]').textContent = '已恢復這台裝置的草稿，尚未儲存到題庫。';
    }
    if (pending && drafts[entry.id] && !draft) card.querySelector('[data-import-draft-status]').textContent = '另有舊版本草稿，未覆蓋目前資料，可下載備份。';
  }
  function editQuestion(q) {
    return `<label>分類<input data-field="category" maxlength="100" value="${esc(q.category)}"></label><label>題型<select data-field="type">${TYPES.map(t => `<option ${t === q.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>題目<textarea data-field="stem" rows="4" maxlength="10000">${esc(q.stem)}</textarea></label><label>選項（一行一個）<textarea data-field="options" rows="4">${esc(q.options.join('\n'))}</textarea></label><label>答案<textarea data-field="answer" rows="2" maxlength="4000">${esc(q.answer)}</textarea></label><label>解析<textarea data-field="explanation" rows="4" maxlength="16000">${esc(q.explanation)}</textarea></label>${q.images.map((src,i) => `<label class="consent"><input type="checkbox" data-keep-image="${i}" value="${esc(src)}" checked>保留題圖 ${i + 1}</label><img src="${esc(src)}" alt="原有題圖 ${i + 1}" loading="lazy">`).join('')}<button class="text-button" type="button" data-import-remove-question>移除此題</button>`;
  }
  function capture(card) {
    const entry = record(card.dataset.importId);
    if (!entry || entry.status !== 'pending' || !card.querySelector('.review-note')) return;
    const prior = usableDraft(entry), next = { revision: entry.revision, batch: {}, questionEdits: { ...prior?.questionEdits }, keptIndices: [], note: card.querySelector('.review-note').value };
    for (const node of card.querySelectorAll('[data-batch]')) next.batch[node.dataset.batch] = node.value;
    for (const row of card.querySelectorAll('[data-question-index]')) {
      const i = Number(row.dataset.questionIndex); next.keptIndices.push(i);
      if (!row.querySelector('[data-field]')) continue;
      const q = { ...questionFor(entry, i) };
      for (const field of row.querySelectorAll('[data-field]')) q[field.dataset.field] = field.dataset.field === 'options' ? field.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : field.value;
      q.images = [...row.querySelectorAll('[data-keep-image]:checked')].map(n => n.value);
      next.questionEdits[i] = q;
    }
    drafts[entry.id] = next;
  }
  function persist() {
    if (!draftKey) return;
    try { localStorage.setItem(draftKey, JSON.stringify(drafts)); }
    catch { status('本機草稿無法保存；請下載草稿備份。'); }
  }
  function forgetDraft(entry) {
    delete drafts[entry.id]; delete legacyDrafts['review:' + entry.id];
    if (userId) try {
      const key = 'course-library-review-drafts-v1.' + userId;
      const latest = JSON.parse(localStorage.getItem(key) || '{}');
      if (latest && typeof latest === 'object' && !Array.isArray(latest)) { delete latest['review:' + entry.id]; localStorage.setItem(key,JSON.stringify(latest)); }
    } catch { status('草稿備份無法更新，請確認瀏覽器儲存空間。'); }
    persist();
  }
  function flush() {
    clearTimeout(timer);
    for (const card of container.querySelectorAll('.import-record[open]')) capture(card);
    persist();
  }
  function schedule(card) {
    capture(card); clearTimeout(timer);
    timer = setTimeout(() => { persist(); const node = card.querySelector('[data-import-draft-status]'); if (node) node.textContent = '草稿已保存在這台裝置，尚未公開。'; }, 350);
  }
  function selection(card, entry) {
    const ids = new Set([...card.querySelectorAll('[data-publication-id]:checked')].map(n => n.dataset.publicationId));
    const selected = (entry.publications || []).filter(q => ids.has(q.id));
    card.querySelector('[data-publication-action="hide-selected"]').disabled = !selected.some(q => q.published && !q.mergedInto);
    card.querySelector('[data-publication-action="restore-selected"]').disabled = !selected.some(q => !q.published && !q.mergedInto);
  }
  async function visibility(card, entry, action) {
    const hide = action.startsWith('hide'), ids = action.endsWith('selected') ? new Set([...card.querySelectorAll('[data-publication-id]:checked')].map(n => n.dataset.publicationId)) : null;
    const questions = (entry.publications || []).filter(q => !q.mergedInto && (!ids || ids.has(q.id)) && (hide ? q.published : !q.published));
    if (!questions.length) return;
    const verb = hide ? '移除' : '重新公開';
    if (!window.confirm(`確定${verb} ${questions.length} 題嗎？題目與修改歷史都會保留。`)) return;
    busy = true; workingCard = card; card.querySelectorAll('button,input,select,textarea').forEach(n => n.disabled = true);
    try {
      const result = await api(`/api/review/${entry.id}/publications`, { method:'POST', body: JSON.stringify({action: hide ? 'hide' : 'restore', questions: questions.map(({id,revision}) => ({id,revision}))}) });
      if (result.changedCount !== questions.length) { await load(); message('狀態已重新整理，請確認結果。'); return; }
      for (const q of questions) { q.published = !hide; q.revision++; }
      openRecord(card, entry);
      message(`已${verb} ${result.changedCount} 題。`);
      notifyChange({ type:'visibility', ids: questions.map(q => q.id) });
    } catch (error) { message(error.message + ' 紀錄仍保留，請重新整理後核對。', true); }
    finally { busy = false; workingCard = null; if (card.isConnected) { card.querySelectorAll('button,input,select,textarea').forEach(n => n.disabled = false); const controls = card.querySelector('.approved-publications'); if (controls) { controls.querySelector('[data-publication-action="hide-all"]').disabled = !entry.publications.some(q => q.published && !q.mergedInto); controls.querySelector('[data-publication-action="restore-all"]').disabled = !entry.publications.some(q => !q.published && !q.mergedInto); for (const checkbox of controls.querySelectorAll('[data-publication-id]')) checkbox.disabled = Boolean(entry.publications.find(q=>q.id === checkbox.dataset.publicationId)?.mergedInto); selection(card,entry); } } }
  }
  async function decide(card, entry, action) {
    flush();
    const draft = usableDraft(entry), note = draft?.note?.trim() || '';
    if (action === 'reject' && !note) { message('請填寫退回原因。', true); card.querySelector('.review-note').focus(); return; }
    const payload = { ...entry.payload, ...draft?.batch, questions: (draft?.keptIndices || entry.payload.questions.map((_,i) => i)).map(i => draft?.questionEdits?.[i] || entry.payload.questions[i]) };
    try { if (action === 'approve') normalizeBatch(payload); } catch (error) { message(error.message,true); return; }
    if (!window.confirm(action === 'approve' ? `確定公開這批保留的 ${payload.questions.length} 題？` : '確定退回這批舊版投稿？')) return;
    busy = true; workingCard = card; card.querySelectorAll('button,input,select,textarea').forEach(n => n.disabled = true);
    try {
      const result = await api('/api/review/' + entry.id, { method:'POST', body:JSON.stringify({ action, revision:entry.revision, payload:action === 'approve' ? payload : undefined, note, confirmSimilar:card.querySelector('.similar-consent')?.checked === true }) });
      forgetDraft(entry); details.delete(entry.id); current()?.items.delete(entry.id); cache.delete(action === 'approve' ? 'approved' : 'rejected'); render();
      message(action === 'approve' ? `已新增 ${result.acceptedCount} 題${result.skippedCount ? `，略過 ${result.skippedCount} 題重複題` : ''}。` : '已退回這批投稿。'); notifyChange({type:'review'});
    } catch (error) { if (error.details?.code === 'similar_questions') showSimilar(card.querySelector('.similar-warning'), error.details.possibleDuplicates); message(error.message + ' 編輯草稿仍保留。',true); }
    finally { busy = false; workingCard = null; if (card.isConnected) card.querySelectorAll('button,input,select,textarea').forEach(n => n.disabled = false); }
  }
  listen(container, 'toggle', async event => {
    const target = event.target, card = target.closest?.('.import-record'); if (!card) return;
    const entry = record(card.dataset.importId); if (!entry) return;
    if (busy) { if (target === card) card.toggleAttribute('open',card === workingCard); return; }
    if (target === card) {
      if (card.hasAttribute('open')) {
        for (const other of container.querySelectorAll('.import-record[open]')) if (other !== card) { capture(other); details.delete(other.dataset.importId); other.removeAttribute('open'); other.querySelector('[data-import-body]').replaceChildren(); }
        try { const full = entry.payload?.questions ? (details.set(entry.id,entry),entry) : await loadDetail(entry); if (card.hasAttribute('open')) openRecord(card, full); }
        catch (error) { if (card.hasAttribute('open')) { card.removeAttribute('open'); message(error.message + ' 請重新開啟再試。', true); } }
      } else { capture(card); details.delete(entry.id); persist(); card.querySelector('[data-import-body]').replaceChildren(); }
    } else if (target.matches('[data-question-index]')) {
      const body = target.querySelector('[data-question-body]'), i = Number(target.dataset.questionIndex);
      if (target.hasAttribute('open')) body.innerHTML = entry.status === 'pending' ? editQuestion(questionFor(entry,i)) : questionPreview(questionFor(entry,i),i) + '</article>';
      else { capture(card); body.replaceChildren(); }
    } else if (target.matches('[data-publication-picker]') && target.hasAttribute('open') && !target.querySelector('[data-publication-id]')) {
      target.querySelector('[data-publication-options]').innerHTML = (entry.publications || []).map(q => `<label class="approved-publication-row"><input type="checkbox" data-publication-id="${esc(q.id)}" ${q.mergedInto ? 'disabled' : ''}><span>第 ${q.questionNumber} 題 · ${q.mergedInto ? '已整合' : q.published ? '公開中' : '已移除'}<br>${esc(entry.payload.questions[q.questionNumber - 1]?.stem || q.id)}</span></label>`).join('');
    }
  }, true);
  listen(container, 'input', e => { const card = e.target.closest('.import-record'); if (card) schedule(card); });
  listen(container, 'change', e => {
    if (e.target.matches('[data-import-status]')) { if (busy) { e.target.value = selectedStatus; return; } flush(); selectedStatus = e.target.value; if (current()) render(); else load(); return; }
    const card = e.target.closest('.import-record'); if (!card) return; const entry = record(card.dataset.importId);
    if (e.target.matches('[data-publication-id]')) selection(card,entry);
    else { if (e.target.dataset.batch === 'course') card.querySelector('[data-batch="unit"]').innerHTML = unitOptions(e.target.value,'',''); schedule(card); }
  });
  listen(container, 'click', e => {
    const button = e.target.closest('button'); if (!button || busy) return;
    if (button.matches('[data-import-refresh]')) return void load();
    if (button.matches('[data-import-more]')) return void load(true);
    const card = button.closest('.import-record'); if (!card) return; const entry = record(card.dataset.importId);
    if (button.dataset.publicationAction) return void visibility(card,entry,button.dataset.publicationAction);
    if (button.dataset.importDecision) return void decide(card,entry,button.dataset.importDecision);
    if (button.matches('[data-import-remove-question]')) { capture(card); button.closest('[data-question-index]').remove(); schedule(card); }
    if (button.matches('[data-import-discard]') && window.confirm('確定捨棄這批尚未送出的本機編輯草稿？已公開資料不受影響。')) { forgetDraft(entry); openRecord(card,entry); }
  });
  listen($('[data-import-controls]'), 'submit', e => e.preventDefault());
  listen(window, 'beforeunload', flush);
  return {
    async show({refresh=false}={}) { active = true; container.hidden = false; if (refresh || !current()) await load(); },
    clear() { active = false; sequence++; controller?.abort(); flush(); cache.clear(); details.clear(); for (const unsubscribe of subscriptions.splice(0)) unsubscribe(); container.replaceChildren(); },
    exportDrafts() { flush(); const data = {savedAt:new Date().toISOString(),drafts,legacyDrafts}; downloadJSON(data,'匯入紀錄編輯草稿.json'); return data; },
  };
}
