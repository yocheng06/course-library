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
        <details data-builtin-fields><summary>翻譯與題目備註（選填）</summary>
          <label>題目翻譯<textarea name="translation" maxlength="10000" rows="3"></textarea></label>
          <label>選項翻譯（依選項順序，每行一個）<textarea name="optionTranslations" maxlength="16000" rows="4"></textarea></label>
          <label>題目備註<textarea name="questionNote" maxlength="4000" rows="2"></textarea></label>
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
    <p data-status role="status" aria-live="polite"></p>
    <button type="button" data-download-draft class="plain" hidden>下載舊草稿</button>
    <button type="button" data-download-receipt class="plain" hidden>下載勘誤收據</button>
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
    submitButton = form.querySelector('[type="submit"]');
  const drafts = new Map();
  let active = null, opener = null, pending = false, receipt = null,
    mode = 'report', currentItem = null;
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
      throw error;
    }
    return body;
  }
  function setMode(nextMode) {
    mode = nextMode;
    const editing = mode === 'edit';
    dialog.querySelector('#correction-title').textContent = editing ? '修改題目' : '回報題目問題';
    dialog.querySelector('[data-help]').textContent = editing
      ? '所有單元的題目都可免登入修改並立即公開。每次修改保留前後版本，站主可管理及還原；此功能不能刪除或下架題目。'
      : '免登入回報原有題庫題目，由站主處理；回報不會直接更改公開內容。請勿填寫個人資料。';
    dialog.querySelector('[data-edit-fields]').hidden = !editing;
    dialog.querySelector('[data-report-fields]').hidden = editing;
    dialog.querySelector('[data-lookup-area]').hidden = editing;
    form.elements.stem.required = editing;
    form.elements.category.required = editing;
    form.elements.answer.required = editing;
    form.elements.detail.required = !editing;
    form.elements.detail.minLength = editing ? 0 : 5;
    submitButton.textContent = editing ? '直接儲存並公開' : '送出勘誤';
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
    form.elements.explanation.value = q.explanation || '';
    form.elements.note.value = '';
    form.elements.translation.value = q.translation || '';
    form.elements.optionTranslations.value = (q.optionTranslations || []).join('\n');
    form.elements.questionNote.value = q.note || '';
    form.elements.answerProvided.checked = q.answerProvided !== false;
    dialog.querySelector('[data-answer-state]').hidden = communityId(active);
    dialog.querySelector('[data-builtin-fields]').hidden = communityId(active);
    const savedDraft = drafts.get(active);
    const draft = savedDraft?.revision === item.revision ? savedDraft.edit : null;
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
    currentItem = null;
    dialog.querySelector('[data-question-label]').textContent =
      `${config.questionDetails(active).unit}・第 ${config.questionDetails(active).number} 題（${active}）`;
    dialog.querySelector('[data-download-receipt]').hidden = true;
    dialog.querySelector('[data-download-draft]').hidden = true;
    status.textContent = '';
    form.hidden = false;
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
        fillEdit(result.item);
        form.hidden = false;
        const staleDraft = drafts.has(active) && drafts.get(active).revision !== result.item.revision;
        dialog.querySelector('[data-download-draft]').hidden = !staleDraft;
        status.textContent = staleDraft ? '題目已有新版本，已載入最新內容；舊草稿保留，可下載對照。' : '';
        form.elements.stem.focus();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        pending = false;
        submitButton.disabled = false;
      }
    }
  });
  form.addEventListener('input', () => {
    if (!active) return;
    form.elements.answer.required = communityId(active) || form.elements.answerProvided.checked;
    drafts.set(active, mode === 'edit'
      ? {revision:currentItem?.revision,edit:{category:form.elements.category.value,type:form.elements.type.value,stem:form.elements.stem.value,options:form.elements.options.value,answer:form.elements.answer.value,explanation:form.elements.explanation.value,note:form.elements.note.value,translation:form.elements.translation.value,optionTranslations:form.elements.optionTranslations.value,questionNote:form.elements.questionNote.value,answerProvided:form.elements.answerProvided.checked}}
      : {report:{detail:form.elements.detail.value,suggestion:form.elements.suggestion.value}});
  });
  async function saveCommunityEdit(confirmSimilar = false) {
    const item = currentItem, old = item.question;
    if (!communityId(active)) {
      return api('/api/community/builtin-questions/' + config.course + '/' + encodeURIComponent(active), {
        method:'POST',body:JSON.stringify({action:'update',revision:item.revision,sourceHash:item.sourceHash,note:form.elements.note.value,question:{
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
      }],
    };
    return api('/api/community/questions/' + encodeURIComponent(active), {
      method: 'POST',
      body: JSON.stringify({action:'update',revision:item.revision,payload,note:form.elements.note.value,confirmSimilar}),
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !active || !form.reportValidity()) return;
    pending = true;
    submitButton.disabled = true;
    status.textContent = mode === 'edit' ? '正在儲存修正…' : '正在送出…';
    try {
      if (mode === 'edit') {
        if (!currentItem) throw new Error('題目尚未載入，請關閉後重新開啟。');
        try {
          await saveCommunityEdit();
        } catch (error) {
          const similar = error.details?.code === 'similar_questions';
          const list = (error.details?.possibleDuplicates || []).map(item => item.reference).join('、');
          if (!similar || !window.confirm(`修改後與其他題目可能相同${list ? `（${list}）` : ''}。仍要直接公開這次修正嗎？`)) throw error;
          await saveCommunityEdit(true);
        }
        drafts.delete(active);
        form.hidden = true;
        status.textContent = '題目已儲存並公開。修改前版本已保留，站主可以管理及還原。';
        window.dispatchEvent(new Event('online'));
      } else {
        receipt = await api('/api/corrections', {
          method: 'POST',
          body: JSON.stringify({course:config.course,questionId:active,answerSnapshot:config.questionDetails(active).answer,detail:form.elements.detail.value,suggestion:form.elements.suggestion.value,website:form.elements.website.value}),
        });
        drafts.delete(active);
        form.reset();
        form.hidden = true;
        lookup.elements.receipt.value = receipt.id;
        status.textContent = `已送交站主處理。勘誤編號：${receipt.id}。請下載收據以便日後查詢。`;
        dialog.querySelector('[data-download-receipt]').hidden = false;
      }
    } catch (error) {
      status.textContent = `未能完成：${error.message}。你填寫的內容仍保留。`;
    } finally {
      pending = false;
      submitButton.disabled = false;
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
