/* Built-in questions render first; approved submissions sync independently. */
(() => {
  'use strict';
  const config = window.courseLearning;
  if (!config?.mergeCommunityQuestions || !window.courseContributions) return;
  const linkedId = new URLSearchParams(location.search).get('question');
  const linkedSubmission = /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(linkedId || '') && !config.validId(linkedId);
  let interacted = false, syncing = false, notice;
  const markInteraction = () => { interacted = true; };
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart'])
    document.addEventListener(event, markInteraction, {once:true, passive:true});

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
    const result = config.mergeCommunityQuestions(entries, {openLinkedQuestion:linkedSubmission && !interacted, aliases, overrides});
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
  async function sync() {
    if (syncing || location.protocol === 'file:') return;
    if (!navigator.onLine) {
      if (linkedSubmission) showNotice('這是投稿題目，需要連線才能載入；原有題庫可繼續閱讀。',true);
      return;
    }
    syncing = true;
    notice?.querySelector('button')?.setAttribute('disabled','');
    try {
      const response = await fetch(window.courseContributions.apiOrigin + '/api/questions?course=' + config.course, {signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Array.isArray(data.questions)) throw new Error('invalid');
      merge(data.questions, data.aliases, data.overrides || []);
      if (linkedSubmission && !config.validId(linkedId)) showNotice('這個投稿題目連結暫時沒有可用內容，已顯示原有題庫。',true);
      else { notice?.remove(); notice = null; }
    } catch {
      showNotice('線上題庫更新暫時無法同步，目前顯示隨頁面提供的內建版本。請重新同步以取得最新修訂。',true);
    } finally { syncing = false; }
  }
  if (linkedSubmission) showNotice('正在載入這道投稿題目…');
  window.addEventListener('online',sync);
  sync();
})();
