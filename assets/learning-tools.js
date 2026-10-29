/* Local-only bookmarks and reading preferences. No network or account needed. */
(() => {
  'use strict';
  const config = window.courseLearning;
  const key = `course-library.learning.v1.${config.course}`;
  const courseNames = {os:'作業系統', algorithms:'演算法'};
  const backupFormat = 'course-library.review-bookmarks';
  const backupVersion = 1, maxBackupBytes = 1024 * 1024, maxBookmarks = 10000;
  let storagePersistent = true;
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { storagePersistent = false; return {}; }
  };
  const initial = read();
  const initialBookmarks = Array.isArray(initial.bookmarks) ? initial.bookmarks : [];
  const communityId = id => /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(id);
  const saved = new Set(initialBookmarks.filter(x => typeof x === 'string')
    .map(id => config.resolveId ? (config.resolveId(id) || (communityId(id) ? id : null)) : id)
    .filter(id => typeof id === 'string' && (config.validId(id) || communityId(id))));
  let reviewOnly = false;
  const tools = document.createElement('div');
  tools.className = 'learning-tools';
  tools.innerHTML = '<button type="button" class="review-filter" aria-pressed="false">待複習 <span>0</span></button><small title="紀錄僅保存在這台裝置的瀏覽器，不會跨裝置同步">僅這台裝置</small><p class="learning-status" role="status" hidden></p>';
  config.toolbar.after(tools);
  const filter = tools.querySelector('.review-filter');
  const status = tools.querySelector('.learning-status');
  const storageHint = tools.querySelector('small');
  const size = document.createElement('label');
  size.className = 'reading-size';
  size.innerHTML = '閱讀字級 <select aria-label="閱讀字級"><option value="standard">標準</option><option value="large">大字</option></select>';
  tools.insertBefore(size, tools.querySelector('small'));
  const sizeSelect = size.querySelector('select');
  sizeSelect.value = initial.size === 'large' ? 'large' : 'standard';
  document.body.classList.toggle('large-reading', sizeSelect.value === 'large');
  const message = text => { status.textContent = text; status.hidden = !text; };
  function refreshStorageHint() {
    storageHint.textContent = storagePersistent
      ? '紀錄只保存在這台裝置，清除網站資料會一併刪除；手機與電腦不會自動同步。'
      : '瀏覽器無法保存，紀錄僅保留本次開啟；請匯出待複習備份。';
  }
  const state = bookmarks => JSON.stringify({bookmarks:[...bookmarks], size:sizeSelect.value});
  function write() {
    try { localStorage.setItem(key, state(saved)); storagePersistent = true; }
    catch { storagePersistent = false; }
    refreshStorageHint();
    return storagePersistent;
  }

  const backupControls = document.createElement('div');
  backupControls.className = 'review-backup';
  backupControls.innerHTML = '<div class="review-backup-controls"><button type="button" class="plain" data-export-review>匯出待複習清單</button><button type="button" class="plain" data-import-review>匯入待複習清單</button><input type="file" accept=".json,application/json" data-review-backup-file hidden></div><p class="review-backup-hint">匯入只會合併目前科目的標記，不會覆蓋現有清單。</p>';
  tools.insertBefore(backupControls, status);
  const backupInput = backupControls.querySelector('input');
  function mountBackupControls() {
    const settingsBody = document.querySelector('.reading-settings-body');
    if (settingsBody) settingsBody.append(backupControls);
    refreshStorageHint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBackupControls, {once:true});
  else queueMicrotask(mountBackupControls);

  function backupData() {
    return {format:backupFormat, version:backupVersion, course:config.course, exportedAt:new Date().toISOString(), bookmarks:[...saved]};
  }
  function normalizeBackup(raw) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > maxBackupBytes)
      throw new Error('備份檔案不能超過 1 MB。');
    let data;
    try { data = JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch { throw new Error('備份不是有效的 JSON，原有清單未變更。'); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.format !== backupFormat || data.version !== backupVersion)
      throw new Error('這不是支援的待複習清單備份，原有清單未變更。');
    if (data.course !== config.course)
      throw new Error(`請到「${courseNames[data.course] || '對應科目'}」匯入這份備份，原有清單未變更。`);
    if (!Array.isArray(data.bookmarks) || data.bookmarks.length > maxBookmarks)
      throw new Error('備份標記資料不完整或超過 10,000 筆，原有清單未變更。');
    const imported = new Set();
    for (const id of data.bookmarks) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(id))
        throw new Error('備份包含無效題目 ID，原有清單未變更。');
      const target = config.resolveId?.(id) || id;
      if (!config.validId(target) && !communityId(target))
        throw new Error(`找不到備份中的題目「${id}」，請先確認科目與網站版本；原有清單未變更。`);
      imported.add(target);
    }
    return imported;
  }
  function importBackup(raw) {
    const imported = normalizeBackup(raw), merged = new Set([...saved, ...imported]);
    if (merged.size > maxBookmarks) throw new Error('合併後超過 10,000 筆，原有清單未變更。');
    try { localStorage.setItem(key, state(merged)); storagePersistent = true; }
    catch {
      storagePersistent = false; refreshStorageHint();
      throw new Error('瀏覽器無法保存匯入資料，原有清單未變更；請保留備份後重試。');
    }
    const added = merged.size - saved.size;
    saved.clear(); for (const id of merged) saved.add(id);
    refreshStorageHint(); window.learningUI.refresh();
    message(`已合併 ${added} 個新的待複習標記；目前共 ${saved.size} 個，已保存於這台裝置。`);
    return {added, total:saved.size};
  }
  backupControls.querySelector('[data-import-review]').addEventListener('click', () => backupInput.click());
  backupInput.addEventListener('change', async () => {
    const file = backupInput.files?.[0];
    if (!file) return;
    try {
      if (!Number.isFinite(file.size) || file.size > maxBackupBytes) throw new Error('備份檔案不能超過 1 MB，原有清單未變更。');
      importBackup(await file.text());
    } catch (error) { message(error.message || '無法讀取備份，原有清單未變更。'); }
    finally { backupInput.value = ''; }
  });
  backupControls.querySelector('[data-export-review]').addEventListener('click', () => {
    let url;
    try {
      url = URL.createObjectURL(new Blob([JSON.stringify(backupData(), null, 2)], {type:'application/json'}));
      const link = document.createElement('a'); link.href = url;
      link.download = `${config.course}-待複習-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(link); link.click(); link.remove();
      message(`已建立 ${courseNames[config.course]}待複習備份，請確認下載檔案。`);
    } catch { message('無法下載備份，請確認瀏覽器允許下載後重試。'); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 0); }
  });

  // Migrate merged question IDs and remove obsolete progress, retaining marks.
  if (Object.prototype.hasOwnProperty.call(initial, 'state') ||
      initialBookmarks.length !== saved.size || initialBookmarks.some(id => !saved.has(id))) write();
  function refresh() {
    let migrated=false;
    for (const id of [...saved]) { const target=config.resolveId?.(id); if(target && target!==id){saved.delete(id);saved.add(target);migrated=true;} }
    if(migrated) write();
    config.list.querySelectorAll('article[data-id]').forEach(card => {
      let button = card.querySelector('.review-button');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button'; button.className = 'review-button';
        button.dataset.reviewId = card.dataset.id;
        config.cardTop(card).append(button);
      }
      const marked = saved.has(card.dataset.id);
      button.setAttribute('aria-pressed', String(marked));
      button.textContent = marked ? '已標記待複習' : '標記待複習';
      button.setAttribute('aria-label', `${config.questionLabel(card.dataset.id)}，${button.textContent}`);
      let actions = card.querySelector('.question-actions');
      if (!actions) {
        actions = document.createElement('div'); actions.className = 'question-actions'; card.append(actions);
      }
      let report = card.querySelector('.question-report');
      if (!report) {
        report = document.createElement('button');
        report.type = 'button';
        report.className = 'question-report';
        report.dataset.correction = card.dataset.id;
        actions.append(report);
      }
      report.dataset.correction = card.dataset.id;
      report.textContent = '修改題目';
      report.setAttribute('aria-label', `${config.questionLabel(card.dataset.id)}，免登入直接修改題目`);
    });
    filter.querySelector('span').textContent = config.scopeIds().filter(id => saved.has(id)).length;
    filter.setAttribute('aria-pressed', String(reviewOnly));
    config.list.querySelectorAll('[data-add-review]').forEach(button => {
      const marked = saved.has(button.dataset.addReview);
      button.disabled = marked;
      button.textContent = marked ? '已加入待複習' : '答錯了，加入待複習';
    });
  }
  function addReview(id, {silent = false} = {}) {
    const target = config.resolveId?.(id) || id;
    if (!config.validId(target) && !communityId(target)) return {saved:false, persistent:storagePersistent};
    saved.add(target); const persistent = write(); window.learningUI.refresh();
    if (!silent || !persistent) message(persistent ? '已加入待複習，並保存於這台裝置。' : '本次已加入待複習，但瀏覽器無法保存；關閉後會遺失，請匯出備份。');
    return {saved:true, persistent};
  }
  function prepareLearning(data) {
    const bookmarks = [...new Set([...saved, ...normalizeBackup(JSON.stringify(data.bookmarks))])];
    if (bookmarks.length > maxBookmarks || !['standard','large'].includes(data.size)) throw new Error('學習備份的標記或字級不正確。');
    return {bookmarks, size:data.size};
  }
  function applyLearning(data) {
    saved.clear(); data.bookmarks.forEach(id => saved.add(id));
    sizeSelect.value = data.size;
    document.body.classList.toggle('large-reading', data.size === 'large');
    storagePersistent = true;
    refreshStorageHint();
  }
  window.learningUI = { refresh, addReview, exportLearning:()=>({bookmarks:backupData(),size:sizeSelect.value}), prepareLearning, applyLearning, exportBookmarks:backupData, importBookmarks:importBackup, get persistent() { return storagePersistent; }, get reviewOnly() { return reviewOnly; }, get currentReviewCount() { return config.scopeIds().filter(id => saved.has(id)).length; }, isSaved:id => saved.has(id), clearReview:()=>{reviewOnly=false;message('');} };
  config.list.addEventListener('click', event => {
    const add = event.target.closest('[data-add-review]');
    if (add) { addReview(add.dataset.addReview); return; }
    const button = event.target.closest('[data-review-id]');
    if (!button) return;
    const id = button.dataset.reviewId;
    const marked = !saved.has(id);
    if (marked) saved.add(id); else saved.delete(id);
    const persistent = write();
    if (reviewOnly && !marked) { config.render(); filter.focus({preventScroll:true}); }
    else window.learningUI.refresh();
    message(persistent ? (marked ? '已加入待複習，並保存於這台裝置。' : '已取消待複習標記。') : '本次標記已更新，但瀏覽器無法保存；關閉後會遺失，請匯出備份。');
  });
  filter.addEventListener('click', () => {
    reviewOnly = !reviewOnly;
    config.resetPage(); config.render();
    message(reviewOnly ? '目前只顯示所選搜尋範圍內符合篩選條件的待複習題目。' : '已顯示所選搜尋範圍的題目。');
  });
  sizeSelect.addEventListener('change', () => {
    document.body.classList.toggle('large-reading', sizeSelect.value === 'large');
    if (!write()) message('字級已套用，但瀏覽器無法保存；下次開啟需重新設定。');
  });
  const compact = matchMedia('(max-width:1000px)');
  const foldControls = () => document.querySelectorAll('.filter-details').forEach(details => { details.open = !compact.matches; });
  document.getElementById('conceptGuide').open = false;
  foldControls(); compact.addEventListener('change', foldControls);
  refreshStorageHint(); refresh();
})();
