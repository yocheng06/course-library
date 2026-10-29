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

  function cleanHeading(value) {
    return String(value ?? '').replace(/^(?:Beast|妖獸)\s*\d+\s*[.．、:：-]\s*/i, '');
  }
  function sourceSignature(q) {
    const text = JSON.stringify([String(q.type || ''), String(q.stem || ''), Array.isArray(q.options) ? q.options : [], String(q.answer || '')]);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function curateRows(rows, curation) {
    if (!Array.isArray(rows)) return [];
    const aliases = new Set((curation?.aliases || []).map(alias => alias.id));
    const ranks = new Map((curation?.order || []).map((id, index) => [id, index]));
    const presentIds = new Set(rows.filter(row => row?.unit === 'L9' && row.question).map(row => row.question.id));
    const fallbacks = (curation?.fallbackQuestions || [])
      .filter(question => question?.id && !presentIds.has(question.id))
      .map(question => ({ unit: 'L9', question }));
    const sourceRows = rows.concat(fallbacks);
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
      const meta = curation?.questions?.[question.id];
      if (meta && sourceSignature(original) === meta.sourceSignature) {
        if (String(meta.stem || '').trim()) question.stem = meta.stem;
        if (!original.category || original.category === 'HTML 匯入') question.category = meta.category;
        if (String(meta.explanation || '').trim()) question.explanation = meta.explanation;
      }
      l9.push({ row: { ...row, question }, inputIndex, rank: ranks.get(question.id) ?? Number.MAX_SAFE_INTEGER });
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
      const [response, curationResponse] = await Promise.all([
        fetch(window.courseContributions.apiOrigin + '/api/questions?course=' + config.course, {signal:AbortSignal.timeout(8000)}),
        fetch('assets/os-l9-curation.json?v=l9-blanks-restored-20261029', {signal:AbortSignal.timeout(8000)}).catch(() => null)
      ]);
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Array.isArray(data.questions)) throw new Error('invalid');
      let curation = null;
      try { if (curationResponse?.ok) curation = await curationResponse.json(); } catch {}
      const aliases = [...(Array.isArray(data.aliases) ? data.aliases : []), ...(Array.isArray(curation?.aliases) ? curation.aliases : [])];
      merge(curateRows(data.questions, curation), aliases, data.overrides || []);
      merge([], aliases, []);
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
