(() => {
  'use strict';
  const config = window.courseLearning;
  if (!config) return;
  const communityId = id => /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(id);
  const dialog = document.createElement('dialog');
  dialog.className = 'correction-dialog';
  dialog.setAttribute('aria-labelledby', 'correction-title');
  dialog.innerHTML = `
    <h2 id="correction-title"></h2>
    <p data-help></p>
    <p data-question-label></p>
    <form method="post">
      <div data-edit-fields hidden>
        <label>分類<input name="category" maxlength="100" required></label>
        <label>題型<select name="type"><option>單選題</option><option>多選題</option><option>填空題</option><option>圖片題</option></select></label>
        <label>題目<textarea name="stem" required maxlength="10000" rows="4"></textarea></label>
        <label>選項（一行一個；填空題留白）<textarea name="options" maxlength="16000" rows="4"></textarea></label>
        <label>正確答案<textarea name="answer" required maxlength="4000" rows="2"></textarea></label>
        <label data-answer-state><input name="answerProvided" type="checkbox">本題已有確定答案</label>
        <label>解析（選填）<textarea name="explanation" maxlength="16000" rows="4"></textarea></label>
        <label>題目備註（選填；清空並儲存即可刪除）<textarea name="questionNote" maxlength="4000" rows="3" placeholder="補充題目條件、提醒或其他說明"></textarea></label>
        <details data-builtin-fields><summary>翻譯（選填）</summary>
          <label>題目翻譯<textarea name="translation" maxlength="10000" rows="3"></textarea></label>
          <label>選項翻譯（依選項順序，每行一個）<textarea name="optionTranslations" maxlength="16000" rows="4"></textarea></label>
        </details>
        <label>修正說明（選填）<textarea name="note" maxlength="2000" rows="2" placeholder="簡短說明修正原因或參考來源"></textarea></label>
      </div>
      <div data-report-fields>
        <label>問題說明（必填，至少 5 字）<textarea name="detail" required minlength="5" maxlength="4000" rows="4"></textarea></label>
        <label>建議修正與參考來源（選填）<textarea name="suggestion" maxlength="4000" rows="3"></textarea></label>
      </div>
      <label hidden>網站<input name="website" tabindex="-1" autocomplete="off"></label>
      <button type="submit" class="plain"></button>
    </form>
    <button type="button" data-delete-question class="plain danger" hidden>建議移除此題</button>
    <button type="button" data-report-question class="plain" hidden>回報題目問題</button>
    <p data-status role="status" aria-live="polite"></p>
    <button type="button" data-download-draft class="plain" hidden>下載修改草稿</button>
    <button type="button" data-download-receipt class="plain" hidden>下載勘誤收據</button>
    <section data-conflict hidden aria-label="版本差異"><h3>這道題已有新版本</h3><p>你的編輯尚未送出。請比較內容，下載草稿後，再載入最新版本手動合併。</p><div data-conflict-fields></div><button type="button" data-conflict-latest class="plain">載入最新版本後合併</button></section>
    <section data-lookup-area>
      <hr><h3>查詢勘誤進度</h3>
      <form data-lookup method="post"><label>勘誤編號<input name="receipt" required maxlength="36"></label><button type="submit" class="plain">查詢</button></form>
      <p data-lookup-result role="status" aria-live="polite"></p>
    </section>
    <button type="button" data-close class="plain">關閉</button>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'),
    status = dialog.querySelector('[data-status]'),
    lookup = dialog.querySelector('[data-lookup]'),
    submitButton = form.querySelector('[type="submit"]'),
    deleteButton = dialog.querySelector('[data-delete-question]');
  let draftScope = 'default';
  try {
    draftScope = sessionStorage.getItem('course-library.reader-editor.v1') || crypto.randomUUID();
    sessionStorage.setItem('course-library.reader-editor.v1', draftScope);
  } catch {}
  const draftKey = 'course-library.reader-drafts.v1.' + config.course + '.' + draftScope;
  let drafts = new Map(), draftStorageFailed = false, conflictLatest = null;
  try { const saved = JSON.parse(localStorage.getItem(draftKey) || '[]'); if (Array.isArray(saved)) drafts = new Map(saved); } catch {}
  function persistDrafts() {
    try { localStorage.setItem(draftKey, JSON.stringify([...drafts])); draftStorageFailed = false; }
    catch { draftStorageFailed = true; }
  }
  function rememberDraft() {
    if (!active || mode !== 'edit' || !currentItem) return;
    const edit = {};
    for (const key of ['category','type','stem','options','answer','explanation','note','translation','optionTranslations','questionNote','answerProvided'])
      edit[key] = key === 'answerProvided' ? form.elements[key].checked : form.elements[key].value;
    edit.images = currentItem.question.images || [];
    drafts.set(active, {revision:currentItem.revision,sourceHash:currentItem.sourceHash,edit});
    persistDrafts();
    if (draftStorageFailed) status.textContent = '瀏覽器無法保存草稿，請先下載草稿，避免重新整理後遺失。';
    dialog.querySelector('[data-download-draft]').hidden = false;
  }
  const matchesVersion = (draft,item) => draft?.revision === item.revision && draft?.sourceHash === item.sourceHash;
  function showConflict(latest) {
    conflictLatest = latest;
    const section = dialog.querySelector('[data-conflict]'), fields = section.querySelector('[data-conflict-fields]');
    fields.replaceChildren();
    const mine = drafts.get(active)?.edit || {}, q = latest.question;
    const names = {category:'分類',type:'題型',stem:'題目',options:'選項',answer:'答案',explanation:'解析',questionNote:'題目備註',translation:'翻譯',optionTranslations:'選項翻譯',answerProvided:'已確定答案',images:'題圖'};
    for (const [key,label] of Object.entries(names)) {
      const value = key === 'questionNote' ? q.note || '' : q[key] ?? (key === 'answerProvided' ? true : '');
      const theirs = Array.isArray(value) ? value.map(v=>typeof v==='object'?JSON.stringify(v):v).join('\n') : value;
      const myValue = Array.isArray(mine[key]) ? mine[key].map(v=>typeof v==='object'?JSON.stringify(v):v).join('\n') : mine[key];
      if (String(myValue ?? '') === String(theirs)) continue;
      const row = document.createElement('section'), title = document.createElement('h4');
      title.textContent = label; row.append(title);
      for (const [heading,text] of [['你的編輯',myValue],['題庫最新版本',theirs]]) {
        const name = document.createElement('strong'), body = document.createElement('pre');
        name.textContent = heading; body.textContent = String(text ?? '') || '（空白）';
        body.style.whiteSpace = 'pre-wrap'; body.style.overflowWrap = 'anywhere'; row.append(name,body);
      }
      fields.append(row);
    }
    if (!fields.childNodes.length) fields.textContent = '內容相同，但版本已變更，請載入最新版本後再儲存。';
    section.hidden = false;
    dialog.querySelector('[data-conflict-latest]').hidden = false;
    submitButton.disabled = true;
    dialog.querySelector('[data-download-draft]').hidden = false;
    status.textContent = latest.deleted ? '此題已被移除；你的草稿仍保留，請下載。' : '題目已有新版本，請先核對差異；你的草稿仍保留。';
  }
  function questionPath() { return communityId(active) ? '/api/community/questions/' + encodeURIComponent(active) : '/api/community/builtin-questions/' + config.course + '/' + encodeURIComponent(active); }
  dialog.querySelector('[data-conflict-latest]').addEventListener('click', () => {
    if (!conflictLatest || conflictLatest.deleted) return;
    // The old draft remains downloadable until the user deliberately edits the new version.
    const latest = conflictLatest; conflictLatest = null;
    currentItem = null; fillEdit(latest);
    dialog.querySelector('[data-conflict-latest]').hidden = true;
    submitButton.disabled = false;
    status.textContent = '已載入最新版本。請參照差異或下載的草稿，手動合併後再儲存。';
  });
  let active = null, opener = null, pending = false, receipt = null,
    mode = 'report', currentItem = null, editPolicy = 'direct';
  const reportButton = dialog.querySelector('[data-report-question]');
  function browserId() {
    try {
      const key = 'course-library.edit-browser.v1';
      const stored = localStorage.getItem(key);
      if (stored) return stored;
      const id = crypto.randomUUID();
      localStorage.setItem(key, id);
      return id;
    } catch { return undefined; }
  }
  const labels = {pending:'待站主審核',confirmed:'已確認需更正',resolved:'已處理',rejected:'不採納'};

  async function api(path, options = {}) {
    const response = await fetch(window.courseContributions.apiOrigin + path, {
      ...options,
      headers: {'Content-Type':'application/json'},
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.error || '題庫服務暫時無法使用。');
      error.details = body;
      error.status = response.status;
      throw error;
    }
    return body;
  }
  function setMode(nextMode) {
    mode = nextMode;
    const editing = mode === 'edit';
    dialog.querySelector('#correction-title').textContent = editing ? '修改題目' : '回報題目問題';
    dialog.querySelector('[data-help]').textContent = editing
      ? '可免登入提出修正。改題時會記錄連線 IP 與瀏覽器代號，僅站主可查閱，保留 30 天。'
      : '免登入回報原有題庫題目，由站主處理；回報不會直接更改公開內容。請勿填寫個人資料。';
    dialog.querySelector('[data-edit-fields]').hidden = !editing;
    dialog.querySelector('[data-report-fields]').hidden = editing;
    dialog.querySelector('[data-lookup-area]').hidden = editing;
    form.elements.stem.required = editing;
    form.elements.category.required = editing;
    form.elements.answer.required = editing;
    form.elements.detail.required = !editing;
    form.elements.detail.minLength = editing ? 0 : 5;
    submitButton.textContent = editing ? (editPolicy === 'review' ? '送交站主審核' : '直接儲存並公開') : '送出勘誤';
    reportButton.hidden = !editing;
    deleteButton.hidden = !editing || !currentItem || currentItem.deleted === true;
  }
  function fillEdit(item) {
    const shown = config.questionForEdit?.(active), raw = item.question;
    const fields = ['category','type','stem','options','answer','explanation'];
    const sameSource = shown?.editSource && fields.every(key => JSON.stringify(shown.editSource[key]) === JSON.stringify(raw[key] ?? (key === 'options' ? [] : '')));
    const q = sameSource ? {...raw,...Object.fromEntries(fields.map(key=>[key,shown[key]]))} : raw;
    currentItem = {...item,question:q};
    form.elements.category.value = q.category || '其他';
    form.elements.type.value = q.type || (q.options?.length ? '單選題' : '填空題');
    form.elements.stem.value = q.stem || '';
    form.elements.options.value = (q.options || []).join('\n');
    form.elements.answer.value = q.answer || '';
    const displayedMatches=shown&&String(shown.stem??shown.q??'')===String(q.stem??'')&&JSON.stringify(shown.options??shown.opts??[])===JSON.stringify(q.options??[])&&String(shown.answer??shown.a??'')===String(q.answer??'')&&String(shown.explanation??shown.ex??'')===String(q.explanation??'');
    form.elements.explanation.value = window.courseExplanationContent?.text(displayedMatches?shown:q)??q.explanation??'';
    form.elements.note.value = '';
    form.elements.translation.value = q.translation || '';
    form.elements.optionTranslations.value = (q.optionTranslations || []).join('\n');
    form.elements.questionNote.value = q.note || '';
    form.elements.answerProvided.checked = q.answerProvided !== false;
    dialog.querySelector('[data-answer-state]').hidden = communityId(active);
    dialog.querySelector('[data-builtin-fields]').hidden = communityId(active);
    const savedDraft = drafts.get(active);
    const draft = matchesVersion(savedDraft,item) ? savedDraft.edit : null;
    if (draft) {
      for (const [key, value] of Object.entries(draft))
        if (form.elements[key]) {
          if (key === 'answerProvided') form.elements[key].checked = value;
          else form.elements[key].value = value;
        }
    }
    form.elements.answer.required = communityId(active) || form.elements.answerProvided.checked;
  }
  config.list.addEventListener('click', async event => {
    const button = event.target.closest('[data-correction]');
    if (!button || pending) return;
    opener = button;
    active = button.dataset.correction;
    receipt = null;
    conflictLatest = null;
    dialog.querySelector('[data-conflict]').hidden = true;
    currentItem = null;
    editPolicy = 'direct';
    dialog.querySelector('[data-question-label]').textContent =
      `${config.questionDetails(active).unit}・第 ${config.questionDetails(active).number} 題（${active}）`;
    dialog.querySelector('[data-download-receipt]').hidden = true;
    dialog.querySelector('[data-download-draft]').hidden = true;
    status.textContent = '';
    form.hidden = false;
    deleteButton.hidden = true;
    dialog.showModal();
    {
      setMode('edit');
      pending = true;
      submitButton.disabled = true;
      status.textContent = '正在載入題目…';
      form.hidden = true;
      try {
        const path = communityId(active) ? '/api/community/questions/' + encodeURIComponent(active) : '/api/community/builtin-questions/' + config.course + '/' + encodeURIComponent(active);
        const result = await api(path);
        editPolicy = result.editPolicy || 'direct';
        fillEdit(result.item);
        setMode('edit');
        if (editPolicy === 'paused' && !result.item.deleted) setMode('report');
        form.hidden = result.item.deleted === true;
        deleteButton.hidden = result.item.deleted === true;
        const staleDraft = drafts.has(active) && !matchesVersion(drafts.get(active),result.item);
        if (staleDraft && drafts.get(active).edit) showConflict(result.item);
        dialog.querySelector('[data-download-draft]').hidden = !staleDraft;
        status.textContent = result.item.deleted === true
          ? '此題已從公開題庫移除；站主可在題庫管理的「已刪除」範圍還原。'
          : editPolicy === 'paused' ? '目前暫停公開改題，仍可回報或建議移除。'
          : staleDraft ? '題目已有新版本，已載入最新內容；舊草稿保留，可下載對照。' : '';
        if (!result.item.deleted) (mode === 'edit' ? form.elements.stem : form.elements.detail).focus();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        pending = false;
        submitButton.disabled = !!conflictLatest;
      }
    }
  });
  form.addEventListener('input', () => {
    form.elements.answer.required = communityId(active) || form.elements.answerProvided.checked;
    rememberDraft();
  });
  async function saveCommunityEdit(confirmSimilar = false) {
    const item = currentItem, old = item.question;
    if (!communityId(active)) {
      return api('/api/community/builtin-questions/' + config.course + '/' + encodeURIComponent(active), {
        method:'POST',body:JSON.stringify({action:'update',revision:item.revision,sourceHash:item.sourceHash,browserId:browserId(),note:form.elements.note.value,question:{
          ...old,category:form.elements.category.value,type:form.elements.type.value,stem:form.elements.stem.value,
          options:form.elements.options.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean),
          answer:form.elements.answer.value,explanation:form.elements.explanation.value,images:old.images || [],
          answerProvided:form.elements.answerProvided.checked,translation:form.elements.translation.value,
          optionTranslations:form.elements.optionTranslations.value.trim()?form.elements.optionTranslations.value.split(/\r?\n/).map(value=>value.trim()):[],note:form.elements.questionNote.value,
        }}),
      });
    }
    const payload = {
      course: config.course,
      unit: item.unit,
      unitTitle: item.unitTitle,
      title: '投稿題目修正',
      source: '公開題目直接修正',
      questions: [{
        category: form.elements.category.value,
        type: form.elements.type.value,
        stem: form.elements.stem.value,
        options: form.elements.options.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
        answer: form.elements.answer.value,
        explanation: form.elements.explanation.value,
        images: old.images || [],
        note: form.elements.questionNote.value,
      }],
    };
    return api('/api/community/questions/' + encodeURIComponent(active), {
      method: 'POST',
      body: JSON.stringify({action:'update',revision:item.revision,payload,browserId:browserId(),note:form.elements.note.value,confirmSimilar}),
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || conflictLatest || !active || !form.reportValidity()) return;
    rememberDraft();
    pending = true;
    submitButton.disabled = true;
    status.textContent = mode === 'edit' ? '正在儲存修正…' : '正在送出…';
    try {
      if (mode === 'edit') {
        if (!currentItem) throw new Error('題目尚未載入，請關閉後重新開啟。');
        let saved;
        try {
          saved = await saveCommunityEdit();
        } catch (error) {
          const similar = error.details?.code === 'similar_questions';
          const list = (error.details?.possibleDuplicates || []).map(item => item.reference).join('、');
          if (!similar || !window.confirm(`修改後與其他題目可能相同${list ? `（${list}）` : ''}。仍要送出這次修正嗎？`)) throw error;
          saved = await saveCommunityEdit(true);
        }
        drafts.delete(active);
        persistDrafts();
        form.hidden = true;
        deleteButton.hidden = true;
        status.textContent = saved?.queued ? '修改建議已送交站主審核。' : '題目已儲存並公開。修改前版本已保留。';
        if (!saved?.queued) {
          if (window.courseQuestionSync) window.courseQuestionSync.invalidate(config.course);
          else window.dispatchEvent(new Event('online'));
        }
      } else {
        receipt = await api('/api/corrections', {
          method: 'POST',
          body: JSON.stringify({course:config.course,questionId:active,answerSnapshot:config.questionDetails(active).answer,detail:form.elements.detail.value,suggestion:form.elements.suggestion.value,website:form.elements.website.value}),
        });
        drafts.delete(active);
        persistDrafts();
        form.reset();
        form.hidden = true;
        lookup.elements.receipt.value = receipt.id;
        status.textContent = `已送交站主處理。勘誤編號：${receipt.id}。請下載收據以便日後查詢。`;
        dialog.querySelector('[data-download-receipt]').hidden = false;
      }
    } catch (error) {
      status.textContent = `未能完成：${error.message}。你填寫的內容仍保留。`;
      if (mode === 'edit' && error.status === 409 && error.details?.code !== 'similar_questions') {
        try { const latest = await api(questionPath()); showConflict(latest.item); }
        catch { status.textContent = '題目已有新版本，但暫時無法載入差異。草稿仍保留，可下載後稍後重試。'; }
      }
    } finally {
      pending = false;
      submitButton.disabled = !!conflictLatest;
    }
  });
  reportButton.addEventListener('click', () => {
    if (pending || !currentItem) return;
    setMode('report');
    deleteButton.hidden = currentItem.deleted === true;
    form.elements.detail.focus();
  });
  deleteButton.addEventListener('click', async () => {
    if (pending || !active || !currentItem || currentItem.deleted) return;
    pending = true;
    submitButton.disabled = deleteButton.disabled = true;
    status.textContent = '正在送出移除建議…';
    try {
      const path = communityId(active)
        ? '/api/community/questions/' + encodeURIComponent(active)
        : '/api/community/builtin-questions/' + config.course + '/' + encodeURIComponent(active);
      const result = await api(path, {
        method: 'POST',
        body: JSON.stringify({
          action: 'request-delete', revision: currentItem.revision,
          ...(currentItem.sourceHash ? { sourceHash: currentItem.sourceHash } : {}),
          browserId: browserId(), note: form.elements.note.value,
        }),
      });
      if (!result.queued) throw new Error('目前服務不支援移除建議。');
      deleteButton.hidden = true;
      status.textContent = '移除建議已送交站主審核。';
    } catch (error) {
      status.textContent = `未能送出：${error.message}`;
    } finally {
      pending = false;
      submitButton.disabled = deleteButton.disabled = false;
    }
  });
  lookup.addEventListener('submit', async event => {
    event.preventDefault();
    const target = dialog.querySelector('[data-lookup-result]'), id = lookup.elements.receipt.value.trim();
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
      target.textContent = '請輸入完整勘誤編號。';
      return;
    }
    target.textContent = '查詢中…';
    try {
      const result = await api('/api/corrections/' + id);
      target.textContent = (labels[result.status] || result.status) + (result.note ? '；站主說明：' + result.note : '');
    } catch (error) { target.textContent = error.message; }
  });
  dialog.querySelector('[data-download-receipt]').addEventListener('click', () => {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({...receipt,course:config.course,questionId:active},null,2)], {type:'application/json'}));
    const link = document.createElement('a');
    link.href = url; link.download = '題庫勘誤收據.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-download-draft]').addEventListener('click', () => {
    const draft = drafts.get(active); if (!draft) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({course:config.course,id:active,...draft},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='題目修改草稿.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  dialog.addEventListener('close', () => opener?.isConnected && opener.focus());
})();
