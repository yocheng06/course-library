/* Local-only bookmarks and reading preferences. No network or account needed. */
(() => {
  'use strict';
  const config = window.courseLearning;
  const key = `course-library.learning.v1.${config.course}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } };
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
  const size = document.createElement('label');
  size.className = 'reading-size';
  size.innerHTML = '閱讀字級 <select aria-label="閱讀字級"><option value="standard">標準</option><option value="large">大字</option></select>';
  tools.insertBefore(size, tools.querySelector('small'));
  const sizeSelect = size.querySelector('select');
  sizeSelect.value = initial.size === 'large' ? 'large' : 'standard';
  document.body.classList.toggle('large-reading', sizeSelect.value === 'large');
  const message = text => { status.textContent = text; status.hidden = !text; };
  function write() {
    try { localStorage.setItem(key, JSON.stringify({ bookmarks:[...saved], size:sizeSelect.value })); }
    catch { tools.querySelector('small').textContent = '瀏覽器無法保存，紀錄僅保留本次開啟'; }
  }
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
      if (!card.querySelector('.question-report')) {
        const actions = document.createElement('div');
        actions.className = 'question-actions';
        const report = document.createElement('a');
        report.className = 'question-report';
        report.href = window.courseQuestionTools.reportURL(config.questionDetails(card.dataset.id));
        report.target = '_blank'; report.rel = 'noopener noreferrer';
        report.textContent = '回報更正（GitHub）↗';
        report.setAttribute('aria-label', `${config.questionLabel(card.dataset.id)}，回報更正（開啟新分頁，需要登入 GitHub）`);
        report.title = '開啟 GitHub 回報表單，需登入；送出前可編輯內容';
        actions.append(report); card.append(actions);
      }
    });
    filter.querySelector('span').textContent = config.scopeIds().filter(id => saved.has(id)).length;
    filter.setAttribute('aria-pressed', String(reviewOnly));
    config.list.querySelectorAll('[data-add-review]').forEach(button => {
      const marked = saved.has(button.dataset.addReview);
      button.disabled = marked;
      button.textContent = marked ? '已加入待複習' : '答錯了，加入待複習';
    });
  }
  function addReview(id) {
    if (!config.validId(id)) return;
    saved.add(id); write(); window.learningUI.refresh(); message('已加入待複習。');
  }
  window.learningUI = { refresh, get reviewOnly() { return reviewOnly; }, get currentReviewCount() { return config.scopeIds().filter(id => saved.has(id)).length; }, isSaved:id => saved.has(id), clearReview:()=>{reviewOnly=false;message('');} };
  config.list.addEventListener('click', event => {
    const add = event.target.closest('[data-add-review]');
    if (add) { addReview(add.dataset.addReview); return; }
    const button = event.target.closest('[data-review-id]');
    if (!button) return;
    const id = button.dataset.reviewId;
    const marked = !saved.has(id);
    if (marked) saved.add(id); else saved.delete(id);
    write();
    if (reviewOnly && !marked) { config.render(); filter.focus({preventScroll:true}); }
    else window.learningUI.refresh();
    message(marked ? '已加入待複習。' : '已取消待複習標記。');
  });
  filter.addEventListener('click', () => {
    reviewOnly = !reviewOnly;
    config.resetPage(); config.render();
    message(reviewOnly ? '目前只顯示所選搜尋範圍內符合篩選條件的待複習題目。' : '已顯示所選搜尋範圍的題目。');
  });
  sizeSelect.addEventListener('change', () => {
    document.body.classList.toggle('large-reading', sizeSelect.value === 'large'); write();
  });
  const compact = matchMedia('(max-width:1000px)');
  const foldControls = () => document.querySelectorAll('.filter-details').forEach(details => { details.open = !compact.matches; });
  document.getElementById('conceptGuide').open = false;
  foldControls(); compact.addEventListener('change', foldControls);
  refresh();
})();
