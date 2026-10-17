/* Shared question status, filter options and correction links. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const hasProvidedAnswer = question => question.answerProvided === true && Boolean(String(question.answer ?? question.a ?? '').trim());
  const missingSource = question => !hasProvidedAnswer(question) && (Boolean(question.missingContext) || /追蹤/.test(question.type || '') || /樹中的「\?」|第6行與第10行|第 5 行/.test(question.q || ''));

  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase();
  const searchTokens = query => [...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];
  function questionType(question) {
    return question.images?.length || question.type === '圖片題' ? '圖片題' : answerType(question);
  }

  function answerType(question) {
    const options = question.options ?? question.opts ?? [];
    if (!options.length) return '填空題';
    if (question.type === '多選題' || question.type === '複選題') return '多選題';
    if (question.type === '單選題') return '單選題';
    if (question.type && question.type !== '圖片題') return '填空題';
    const expected = question.type === '圖片題' ? window.coursePractice?.expectedChoiceKey(question.answer ?? question.a, options) : null;
    if (expected) return expected.length > 1 ? '多選題' : '單選題';
    const letters = new Set(String(question.answer ?? question.a ?? '').match(/[A-H](?=[.、，,\s]|$)/g) || []);
    return letters.size > 1 ? '多選題' : '單選題';
  }

  function searchFields(question) {
    return [
      { label:'題幹', values:[question.stem ?? question.q, question.translation, ...(Array.isArray(question.aliases) ? question.aliases : [])] },
      { label:'選項', values:[...(question.options || question.opts || []), ...(question.optionTranslations || [])] },
      { label:'答案', values:[question.answer ?? question.a] },
      { label:'修正前答案', values:[question.originalAnswer] },
      { label:'解析', values:[question.explanation ?? question.ex, ...(question.terms || []).map(term => `${term.label} ${term.text}`)] },
      { label:'備註', values:[question.note, ...(!hasProvidedAnswer(question) ? [question.reviewIssue, question.missingContext] : [])] },
      { label:'分類', values:[question.category, questionType(question)] }
    ];
  }

  function matchesSearch(question, query) {
    const text = normalize(searchFields(question).flatMap(field => field.values).filter(Boolean).join(' '));
    return searchTokens(query).every(token => text.includes(token));
  }

  function searchMatchMarkup(question, query) {
    const tokens = searchTokens(query);
    if (!tokens.length) return '';
    const labels = searchFields(question).filter(field => {
      const text = normalize(field.values.filter(Boolean).join(' '));
      return tokens.some(token => text.includes(token));
    }).map(field => field.label);
    return labels.length ? `<p class="search-match">命中：${labels.map(escape).join('、')}</p>` : '';
  }

  function mathMarkup(text, format) {
    const candidates = /[A-Za-z0-9Α-Ωα-ωΣ√][A-Za-z0-9Α-Ωα-ωΣ√²³¹ᵢⱼ\u2070-\u209f()\[\]{}^=+*×÷\/−<>≤≥→∞-]*(?:[ \t]+[A-Za-z0-9Α-Ωα-ωΣ√][A-Za-z0-9Α-Ωα-ωΣ√²³¹ᵢⱼ\u2070-\u209f()\[\]{}^=+*×÷\/−<>≤≥→∞-]*)*/gu;
    let markup = '', previous = 0;
    for (const match of text.matchAll(candidates)) {
      const expression = match[0];
      if (expression.length < 3 || !/[=+*×÷\/^≤≥<>→Σ√−]/.test(expression) && !(/-/.test(expression) && /\d/.test(expression))) continue;
      markup += format(text.slice(previous, match.index));
      markup += `<span class="math-expression">${format(expression)}</span>`;
      previous = match.index + expression.length;
    }
    return markup + format(text.slice(previous));
  }
  function explanationMarkup(question, format = escape) {
    const text = String(question.explanation ?? question.ex ?? '');
    const primary = text.split(/\n\s*\n/).filter(Boolean).map(block => {
      const section = block.match(/^(核心觀念|解題步驟|判讀步驟|適用條件|選項判讀)：\s*([\s\S]*)$/);
      return section ? `<div class="explanation-section"><strong>${escape(section[1])}</strong><p>${mathMarkup(section[2], format)}</p></div>` : `<p>${mathMarkup(block, format)}</p>`;
    }).join('');
    const seen = new Set([text.trim()]);
    const additional = (question.sourceExplanations || []).map(item => {
      const value = typeof item === 'string' ? item : item.text;
      if (!value || seen.has(value.trim())) return '';
      seen.add(value.trim());
      const source = (question.sourceVariants || []).find(q =>
        typeof item === 'object' ? (q.id ?? q.bookmarkId) === item.sourceId : (q.explanation ?? q.ex) === value);
      const options = source?.options ?? source?.opts ?? [];
      return `<div class="source-version">${source ? `<p><strong>原版本題目</strong><br>${format(source.stem ?? source.q)}</p>${options.length ? `<ul>${options.map(option=>`<li>${format(option)}</li>`).join('')}</ul>` : ''}<p><strong>原版本答案：</strong>${format(source.answer ?? source.a)}</p>` : ''}<p>${mathMarkup(value,format)}</p></div>`;
    }).filter(Boolean);
    return primary + (additional.length ? `<details class="source-explanations"><summary>合併題目的原版本與補充解析</summary>${additional.join('')}</details>` : '');
  }
  function qualityReasons(question, course) {
    if (hasProvidedAnswer(question)) return [];
    const reasons = [];
    const note = question.note || '';
    if (question.reviewIssue) reasons.push('答案或題意有疑點');
    if (question.missingContext) reasons.push('缺少解題所需資料');
    const needsCheck = course === 'algorithms' ? question.warn || /核對|未附|缺少|需確認|無法.*(?:判斷|核實)|條件.*(?:不明|未提供)/.test(note)
      : /未提供|未附|並非原題|核對|批改|投影片|選項依|選項.*整理|原題.*順序|線上題庫.*答案|判分版本|標準術語|不同教材|判分答案|題庫用語如此|資料.*(?:缺|不完整)/.test(note);
    if (needsCheck) reasons.push('含核對提醒');
    if (course === 'algorithms' && !question.missingContext && missingSource(question)) reasons.push('缺少題圖或虛擬碼');
    if (/單選|多選|複選/.test(question.type || '') && !(question.options || question.opts || []).length) reasons.push('原資料未附選項');
    if (!String(question.answer ?? question.a ?? '').trim()) reasons.push('缺少原答案');
    if (!String(question.explanation ?? question.ex ?? '').trim() && !question.terms?.length) reasons.push('缺少解析');
    return reasons;
  }

  function qualityMarkup(question, course) {
    const reasons = qualityReasons(question, course);
    if (!reasons.length) return '';
    const details = [question.reviewIssue, question.missingContext].filter(Boolean).join(' ');
    return `<p class="quality-note">待確認原因：${escape(reasons.join('、'))}${details?`<br>${escape(details)} 本題暫不自動判分。`:''}</p>`;
  }

  function answerLabel(question) {
    const label = question.originalAnswer ? '修正後答案' : '題庫答案';
    return !hasProvidedAnswer(question) && (question.reviewIssue || question.missingContext) ? `${label}（待確認）` : label;
  }

  function reviewMarkup(question) {
    return question.originalAnswer
      ? `<details class="answer-history"><summary>查看修正前的題庫答案</summary><p>${escape(question.originalAnswer)}</p></details>` : '';
  }

  function populateSelect(select, values, allValue, allLabel) {
    const previous = select.value;
    const unique = [...new Set(values)];
    select.innerHTML = `<option value="${escape(allValue)}">${escape(allLabel)}</option>` + unique.map(value => `<option value="${escape(value)}">${escape(value)}</option>`).join('');
    select.value = unique.includes(previous) ? previous : allValue;
  }

  function reportURL(details) {
    const courseName = details.course === 'os' ? '作業系統' : '演算法';
    const page = details.course === 'os' ? 'os.html' : 'algorithms.html';
    const source = new URL(page, 'https://yocheng06.github.io/course-library/');
    source.searchParams.set('question', details.id);
    const report = new URL('https://github.com/yocheng06/course-library/issues/new');
    report.searchParams.set('title', `[題庫更正] ${courseName}｜${details.unit} 第 ${details.number} 題`);
    report.searchParams.set('body', [
      `科目：${courseName}`, `單元：${details.unit}`, `題號：${details.id}`, `題目連結：${source.href}`, '',
      '題目：', details.question, '', '目前答案：', details.answer, '',
      '需要更正的地方：', '（請說明問題）', '', '建議修正：', '', '參考來源：'
    ].join('\n'));
    return report.href;
  }

  function focusResults() {
    const summary = document.getElementById('searchResults');
    summary.scrollIntoView({block:'start'});
    summary.focus({preventScroll:true});
  }

  function focusLinkedQuestion(id) {
    requestAnimationFrame(() => {
      const card = document.querySelector(`article[data-id="${CSS.escape(id)}"]`);
      if (!card) return;
      card.scrollIntoView({block:'start'});
      card.querySelector('.question').focus({preventScroll:true});
    });
  }

  function questionImagesMarkup(q) {
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return (q.images||[]).filter(img=>/^assets\/questions\/[a-z0-9/_-]+\.(png|jpe?g)$/i.test(img.src)||/^https:\/\//.test(img.src)).map(img=>`<figure class="question-figure"><button type="button" class="question-image-open" data-image-viewer aria-haspopup="dialog" aria-controls="question-image-viewer"><img src="${esc(img.src)}" alt="${esc(img.alt||q.stem||q.q)}" ${img.width&&img.height?`width="${Number(img.width)}" height="${Number(img.height)}"`:''} loading="lazy"><span>放大題圖（可縮放）</span></button></figure>`).join('');
  }

  window.courseQuestionTools = { questionType, answerType, questionImagesMarkup, hasProvidedAnswer, matchesSearch, searchMatchMarkup, explanationMarkup, qualityReasons, qualityMarkup, missingSource, answerLabel, reviewMarkup, populateSelect, reportURL, focusResults, focusLinkedQuestion };
})();
