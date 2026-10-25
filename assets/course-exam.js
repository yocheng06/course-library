/* A separate, in-memory exam session; reading/practice state stays independent. */
(() => {
  'use strict';
  const config = window.courseLearning, tools = window.courseQuestionTools;
  if (!config?.examEntries || !window.coursePractice) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = q => q.options ?? q.opts ?? [];
  const answer = q => q.answer ?? q.a ?? '';
  const key = q => q.choiceKey || window.coursePractice.expectedChoiceKey(answer(q), options(q));
  function eligible(entry) {
    const q = entry.q;
    return tools.hasProvidedAnswer(q) && !tools.incompleteReasons(q).length && (!options(q).length || Boolean(key(q)));
  }
  function sample(entries, count, random = Math.random) {
    const unique = [...new Map(entries.filter(eligible).map(entry => [entry.id, entry])).values()];
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return unique.slice(0, count);
  }
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.id = 'examMode'; trigger.textContent = '單元測驗';
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', 'courseExam');
  document.getElementById('practiceMode').after(trigger);
  const dialog = document.createElement('dialog');
  dialog.id = 'courseExam'; dialog.className = 'course-exam'; dialog.setAttribute('aria-labelledby', 'examTitle');
  dialog.innerHTML = `<header class="exam-header"><h2 id="examTitle">單元測驗</h2><button type="button" class="plain" data-exam-close aria-label="關閉測驗，保留本次作答">關閉</button></header><div class="exam-body"><section data-exam-setup><p>選擇範圍後隨機抽題，交卷後統一顯示答案與解析。測驗不受題庫搜尋與篩選影響。</p><div class="exam-settings"><label>測驗範圍<select data-exam-scope aria-label="測驗範圍"><option value="unit">目前單元</option><option value="all">總課程測驗</option></select></label><label>每次題數<select data-exam-size aria-label="每次測驗題數"><option value="10">10 題</option><option value="20" selected>20 題</option><option value="30">30 題</option></select></label></div><p data-exam-pool role="status"></p><p class="exam-hint">資料不完整或無法核對答案的題目不納入抽題。不足指定題數時，使用全部可測驗題目。每題等分，多選題須全部選對。作答暫存在本頁，重新整理會清除。</p><button type="button" class="reveal" data-exam-start>開始測驗</button></section><section data-exam-session hidden><p data-exam-description></p><p class="exam-hint" data-exam-fill-hint>填空請依題目指定格式作答。系統先依題庫文字核對，交卷後可對照解析自行確認其他寫法。</p><div data-exam-results hidden tabindex="-1" aria-live="polite"></div><div data-exam-questions></div></section></div><footer class="exam-footer" hidden><span data-exam-progress role="status"></span><p data-exam-notice role="status"></p><div><button type="button" class="plain" data-exam-reset>重新設定</button><button type="button" class="reveal" data-exam-submit>交卷</button></div></footer>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  const scope = find('[data-exam-scope]'), size = find('[data-exam-size]');
  const questionList = find('[data-exam-questions]'), notice = find('[data-exam-notice]');
  let entries = [], responses = new Map(), results = [], submitted = false, confirmation = '';
  let sessionLabel = '', poolLabel = '';
  function pool() { return config.examEntries(scope.value === 'all').filter(eligible); }
  function refreshPool() {
    poolLabel = scope.value === 'all' ? ({os:'作業系統',algorithms:'演算法'}[config.course] + ' · 全部單元') : config.examUnitLabel();
    scope.options[0].textContent = '目前單元 · ' + config.examUnitLabel();
    const count = pool().length;
    find('[data-exam-pool]').textContent = `${poolLabel} · 可抽 ${count} 題，本次 ${Math.min(count, Number(size.value))} 題。`;
    find('[data-exam-start]').disabled = count === 0;
  }
  function answered(index) {
    const response = responses.get(index);
    return Boolean(response && (response.chosen.length || response.text.trim()));
  }
  function progress() {
    const done = entries.reduce((n, _, i) => n + Number(answered(i)), 0);
    find('[data-exam-progress]').textContent = submitted ? `已交卷 · ${entries.length} 題` : `已作答 ${done} / ${entries.length} 題`;
  }
  function questionMarkup(entry, index) {
    const q = entry.q, opts = options(q), multiple = opts.length && (key(q)?.length > 1 || tools.answerType(q) === '多選題');
    const type = opts.length ? (multiple ? '多選題' : '單選題') : '填空題';
    const content = opts.length ? `<div class="options">${opts.map((option, i) => `<label class="option"><input type="${multiple ? 'checkbox' : 'radio'}" name="exam-${index}" data-exam-index="${index}" value="${i}"><span>${/^[A-H][.、．:：]/i.test(String(option).trim()) ? esc(option) : String.fromCharCode(65+i)+'. '+esc(option)}${q.optionTranslations?.[i] ? `<small class="option-translation">${esc(q.optionTranslations[i])}</small>` : ''}</span></label>`).join('')}</div>` : window.coursePractice.entryMarkup(q, entry.id, "", {className:"",icon:""}).replaceAll("<textarea", `<textarea data-exam-index="${index}"`);
    return `<article class="exam-card" data-exam-card="${index}"><div class="exam-badges"><span>${index+1} / ${entries.length}</span><span>${esc(entry.unit)} · ${esc(q.category)}</span><span>${type}</span></div><h3 id="exam-question-${index}">${esc(q.stem ?? q.q)}</h3>${q.translation ? `<p class="exam-translation">${esc(q.translation)}</p>` : ''}${tools.questionImagesMarkup(q)}<div role="group" aria-labelledby="exam-question-${index}">${content}</div><div data-exam-review hidden></div></article>`;
  }
  function start() {
    refreshPool(); entries = sample(pool(), Number(size.value));
    if (!entries.length) return;
    sessionLabel = poolLabel; responses = new Map(); results = []; submitted = false; confirmation = '';
    find('[data-exam-setup]').hidden = true; find('[data-exam-session]').hidden = false;
    find('.exam-footer').hidden = false; find('[data-exam-results]').hidden = true;
    find('[data-exam-submit]').hidden = false; notice.textContent = '';
    find('[data-exam-description]').textContent = `${sessionLabel} · 隨機 ${entries.length} 題`;
    questionList.innerHTML = entries.map(questionMarkup).join('');
    find('.exam-body').scrollTop = 0; progress();
    questionList.querySelector('input, textarea')?.focus();
  }
  function updateResponse(event) {
    const input = event.target;
    if (submitted || input.dataset.examIndex === undefined) return;
    const index = Number(input.dataset.examIndex), card = input.closest('[data-exam-card]');
    responses.set(index, {chosen:[...card.querySelectorAll('input:checked')].map(el => Number(el.value)), text:(card.querySelector('[data-draft]') || card.querySelector('textarea'))?.value || ''});
    confirmation = ''; notice.textContent = ''; progress();
  }
  function summary() {
    const correct = results.filter(r => r.correct).length;
    const self = results.filter(r => r.selfAssessed).length;
    find('[data-exam-results]').innerHTML = `<h3>測驗結果：${Math.round(correct / entries.length * 100)} 分</h3><p>答對 ${correct} / ${entries.length} 題 · 答錯或未答 ${entries.length-correct} 題${self ? ` · 其中 ${self} 題為自行確認` : ''}</p><p class="exam-hint">填空依題庫文字核對；若你的其他寫法也正確，可在對照解析後自行確認。</p>`;
  }
  function submit() {
    if (submitted) return;
    const missing = entries.filter((_, i) => !answered(i)).length;
    if (missing && confirmation !== 'submit') {
      confirmation = 'submit'; notice.textContent = `還有 ${missing} 題未作答；未答以 0 分計。確定交卷請再按一次「交卷」。`; return;
    }
    submitted = true; confirmation = ''; notice.textContent = '';
    results = entries.map(({q}, index) => {
      const response = responses.get(index) || {chosen:[],text:''};
      return window.coursePractice.evaluate(answer(q), options(q), response.chosen, q, response.text);
    });
    for (const [index, entry] of entries.entries()) {
      const {q,id} = entry, card = questionList.children[index], result = results[index], review = card.querySelector('[data-exam-review]');
      card.querySelectorAll('input, textarea').forEach(input => input.disabled = true);
      const expected = options(q).length ? key(q) : '';
      card.querySelectorAll('.option').forEach((option, i) => option.classList.toggle('correct', Boolean(expected?.includes(String.fromCharCode(65+i)))));
      const response = responses.get(index), yourAnswer = options(q).length ? (response?.chosen || []).sort((a,b)=>a-b).map(i=>String.fromCharCode(65+i)).join('、') : response?.text;
      review.hidden = false;
      review.innerHTML = `<p class="exam-verdict ${result.correct ? 'exam-right' : 'exam-wrong'}">${result.correct ? '答對' : answered(index) ? '答錯' : '未作答'}</p><p><strong>你的答案：</strong>${esc(yourAnswer || '未作答')}</p><div class="answer"><strong>${tools.answerLabel(q)}</strong><div>${tools.answerValueMarkup(q)}</div><div class="explain"><strong>解析</strong><div class="explanation-text">${tools.explanationMarkup(q, esc)}</div></div></div>${!options(q).length && !result.correct && answered(index) ? `<button type="button" class="plain" data-exam-self="${index}" aria-pressed="false">我的寫法也正確（自行確認）</button>` : ''}<button type="button" class="plain" data-exam-review-id="${esc(id)}">${window.learningUI?.isSaved(id) ? '已加入待複習' : '加入待複習'}</button>`;
    }
    find('[data-exam-submit]').hidden = true; find('[data-exam-results]').hidden = false;
    summary(); progress(); find('.exam-body').scrollTop = 0; find('[data-exam-results]').focus();
  }
  function reset() {
    if (!submitted && entries.length && confirmation !== 'reset') { confirmation = 'reset'; notice.textContent = '重新設定會清除本次作答，確定請再按一次「重新設定」。'; return; }
    entries = []; responses.clear(); submitted = false; confirmation = ''; notice.textContent = '';
    questionList.replaceChildren(); find('[data-exam-session]').hidden = true; find('.exam-footer').hidden = true;
    find('[data-exam-setup]').hidden = false; refreshPool(); scope.focus();
  }
  trigger.addEventListener('click', () => { if (!entries.length) refreshPool(); dialog.showModal(); });
  find('[data-exam-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger.focus());
  scope.addEventListener('change', refreshPool); size.addEventListener('change', refreshPool);
  find('[data-exam-start]').addEventListener('click', start);
  find('[data-exam-submit]').addEventListener('click', submit);
  find('[data-exam-reset]').addEventListener('click', reset);
  questionList.addEventListener('input', updateResponse);
  questionList.addEventListener('change', updateResponse);
  questionList.addEventListener('click', event => {
    const self = event.target.closest('[data-exam-self]');
    if (self) { const result = results[Number(self.dataset.examSelf)]; result.selfAssessed = !result.selfAssessed; result.correct = result.selfAssessed; self.setAttribute('aria-pressed', String(result.selfAssessed)); self.textContent = result.selfAssessed ? '已自行確認正確（取消）' : '我的寫法也正確（自行確認）'; const verdict=self.closest('.exam-card').querySelector('.exam-verdict'); verdict.textContent=result.selfAssessed?'自行確認正確':'答錯'; verdict.className='exam-verdict '+(result.selfAssessed?'exam-right':'exam-wrong'); summary(); }
    const review = event.target.closest('[data-exam-review-id]');
    if (review) { window.learningUI?.addReview(review.dataset.examReviewId); review.textContent = '已加入待複習'; review.disabled = true; }
  });
  window.courseExam = { sample, eligible };
})();
