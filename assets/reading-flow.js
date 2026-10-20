/* One set of reading controls for both courses. */
(() => {
  'use strict';
  const config = window.courseLearning, ui = window.learningUI;
  const search = document.getElementById('search');
  const chapter = document.getElementById(config.course === 'os' ? 'chapter' : 'chapterSelect');
  const type = document.getElementById('typeSelect');
  const quality = document.getElementById('qualitySelect');
  const searchScope = document.getElementById('searchScopeSelect');
  const unit = document.getElementById(config.course === 'os' ? 'unitPicker' : 'lessonPicker');
  const drawerToggle = document.querySelector('.course-drawer-toggle');
  const tools = document.querySelector('.learning-tools');
  const filterDetails = document.querySelector('.filter-details');
  const modeHint = document.getElementById('modeHint');
  filterDetails.append(modeHint);
  const settings = document.createElement('details');
  settings.className = 'reading-settings';
  settings.innerHTML = '<summary>閱讀設定</summary><div class="reading-settings-body"></div>';
  const settingsBody = settings.querySelector('div');
  settingsBody.append(tools.querySelector('.reading-size'), tools.querySelector('small'));
  settingsBody.querySelector('small').textContent = '紀錄只保存在這台裝置，清除網站資料會一併刪除；手機與電腦不會自動同步。';
  tools.insertBefore(settings, tools.querySelector('.learning-status'));
  const scope = document.createElement('p');
  scope.className = 'search-scope';
  document.querySelector('.search-options').after(scope);
  search.setAttribute('aria-describedby', 'searchScope'); scope.id = 'searchScope';
  const chips = document.createElement('div');
  chips.className = 'active-filters'; chips.setAttribute('aria-label', '目前套用的篩選');
  tools.after(chips);

  document.addEventListener('click', event => {
    if (settings.open && !settings.contains(event.target)) settings.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settings.open) { settings.open = false; settings.querySelector('summary').focus(); }
  });

  const quickPager = document.createElement('nav');
  quickPager.className = 'reading-pager'; quickPager.setAttribute('aria-label', '閱讀快速換頁');
  quickPager.innerHTML = '<button type="button" aria-label="快速上一頁">← 上一頁</button><span></span><button type="button" aria-label="快速下一頁">下一頁 →</button>';
  document.body.append(quickPager);
  const previous = quickPager.firstElementChild, next = quickPager.lastElementChild;
  for (const [button, label] of [[previous, '上一頁'], [next, '下一頁']]) {
    button.addEventListener('click', () => {
      document.getElementById('pager').querySelector(`[aria-label="${label}"]`)?.click();
    });
  }
  const empty = document.getElementById('empty');
  const switchUnit = document.createElement('button'); switchUnit.type = 'button';
  switchUnit.className = 'plain'; switchUnit.textContent = '切換單元'; empty.append(switchUnit);
  switchUnit.addEventListener('click', () => {
    drawerToggle?.click();
    const active = config.sidebar.querySelector('.course-nav.active') || config.sidebar.querySelector('.unit-picker select');
    active?.focus({preventScroll:true});
  });
  function chip(text, clear) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = text + ' ×'; button.setAttribute('aria-label', '移除篩選：' + text);
    button.addEventListener('click', () => { clear(); search.focus({preventScroll:true}); });
    chips.append(button);
  }
  function clearSelect(select) { select.selectedIndex = 0; select.dispatchEvent(new Event('change', {bubbles:true})); }
  function refresh() {
    const label = config.scopeLabel();
    filterDetails.querySelector('summary').textContent = modeHint.hidden ? '篩選設定' : '篩選／說明';
    scope.textContent = '搜尋範圍：' + label;
    search.placeholder = '搜尋題目、答案或解析…';
    search.setAttribute('aria-label', `搜尋${label}的題目、答案與解析`);
    tools.querySelector('.review-filter').firstChild.textContent = config.allUnits() ? '全部單元待複習 ' : '本單元待複習 ';
    chips.replaceChildren();
    if (search.value.trim()) chip('搜尋：' + search.value.trim(), () => { search.value = ''; search.dispatchEvent(new Event('input', {bubbles:true})); });
    if (chapter.selectedIndex > 0) chip('章節：' + chapter.selectedOptions[0].textContent, () => clearSelect(chapter));
    if (type.selectedIndex > 0) chip('題型：' + type.value, () => clearSelect(type));
    if (quality.value === 'pending') chip('只看待確認', () => clearSelect(quality));
    if (config.allUnits()) chip('範圍：全部單元', () => clearSelect(searchScope));
    if (ui.reviewOnly) chip('只看待複習', () => tools.querySelector('.review-filter').click());
    chips.hidden = chips.childElementCount === 0;
    if (!empty.hidden) {
      const noBookmarks = ui.reviewOnly && ui.currentReviewCount === 0;
      empty.querySelector('h3').textContent = noBookmarks ? '所選範圍還沒有待複習題目' : quality.value === 'pending' ? '所選條件沒有待確認題目' : '所選範圍沒有符合的題目';
      empty.querySelector('p').textContent = noBookmarks
        ? '按「重設篩選」回到題目列表，再將想複習的題目標記起來。也可調整搜尋範圍，查看其他單元的標記。'
        : '搜尋涵蓋「' + label + '」。可移除上方篩選或重設；' + (config.allUnits() ? '目前已涵蓋本課程全部單元。' : '若要找其他單元，請將搜尋範圍改為「全部單元」。');
    }
    const pager = document.getElementById('pager');
    const prevButton = pager.querySelector('[aria-label="上一頁"]'), nextButton = pager.querySelector('[aria-label="下一頁"]');
    const pages = config.pageCount();
    previous.disabled = !prevButton || prevButton.disabled; next.disabled = !nextButton || nextButton.disabled;
    const hasPager = empty.hidden && prevButton && nextButton;
    previous.hidden = next.hidden = !hasPager;
    quickPager.querySelector('span').textContent = empty.hidden ? `第 ${config.currentPage()} / ${pages} 頁` : '沒有符合的題目';
    quickPager.classList.toggle('single-page', !hasPager);
    quickPager.hidden = false;
  }
  const originalRefresh = ui.refresh;
  ui.refresh = () => { originalRefresh(); refresh(); };
  // Mobile keyboard users need the full available viewport for their answer.
  const readingInput = element => element?.matches('textarea,input[type="search"]');
  document.addEventListener('focusin', event => document.body.classList.toggle('reading-input-focus', readingInput(event.target)));
  document.addEventListener('focusout', () => setTimeout(() => document.body.classList.toggle('reading-input-focus', readingInput(document.activeElement)), 0));
  // Long formulas can scroll independently without widening the page.
  const refreshMath = () => config.list.querySelectorAll('.math-expression').forEach(formula => {
    const scrollable = formula.scrollWidth > formula.clientWidth + 1;
    if (scrollable) {
      formula.tabIndex = 0;
      formula.setAttribute('role', 'region');
      formula.setAttribute('aria-label', '公式，可左右捲動');
      formula.title = '公式，可左右捲動';
    } else {
      formula.removeAttribute('tabindex'); formula.removeAttribute('role');
      formula.removeAttribute('aria-label'); formula.removeAttribute('title');
    }
  });
  new ResizeObserver(refreshMath).observe(config.list);
  refresh();
})();
