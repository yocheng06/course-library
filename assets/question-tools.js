/* Shared question status, filter options and correction links. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const hasProvidedAnswer = question => question.submissionReview?.status !== 'pending' && question.answerProvided === true && Boolean(String(question.answer ?? question.a ?? '').trim());
  // Reading may show a submitted answer without treating it as verified for grading.
  function optionAnswerKeys(question, options) {
    const verified = hasProvidedAnswer(question), pending = question.submissionReview?.status === 'pending';
    if ((!verified && !(pending && question.answerProvided === true)) || !options?.length) return new Set();
    const answer = question.answer ?? question.a ?? '';
    const expected = verified && question.choiceKey || window.courseChoiceAnswers?.expectedChoiceKey(answer, options);
    return new Set(String(expected || ''));
  }
  function studyOptionMark(question, selected) {
    if (!selected) return {className:'',label:''};
    return question.submissionReview?.status === 'pending'
      ? {className:'submitted-answer',label:'<small class="submitted-answer-label">投稿答案（待核對）</small>'}
      : {className:'correct',label:''};
  }
  function updateStudyOptionMarks(card, question, keys) {
    card.querySelectorAll('.option').forEach((option,index) => {
      const mark = studyOptionMark(question,keys.has(String.fromCharCode(65+index)));
      option.classList.toggle('correct',mark.className === 'correct');
      option.classList.toggle('submitted-answer',mark.className === 'submitted-answer');
      let label = option.querySelector('.submitted-answer-label');
      if (mark.label && !label) {
        label = option.ownerDocument.createElement('small');label.className = 'submitted-answer-label';
        label.textContent = '投稿答案（待核對）';option.append(label);
      } else if (!mark.label) label?.remove();
    });
  }
  const missingSource = question => !hasProvidedAnswer(question) && (Boolean(question.missingContext) || /追蹤/.test(question.type || '') || /樹中的「\?」|第6行與第10行|第 5 行/.test(question.q || ''));

  // Keep the original question text; normalize presentation only for lookup.
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u200B\u2060\uFEFF]/g, '')
    .replace(/(?:\\_){2,}/g, blank => blank.replaceAll('\\', ''))
    .split(/\r?\n/).map(line => line
      .replace(/^[ \t]*(?:\*\*)?(?:(?:beast|妖獸)\s*\d{1,4}\s*[.)、:。]|第\s*\d{1,4}\s*題\s*[:.)、]?|(?:question|q|題目)\s*\d{1,4}\s*[:.)、]?|\d{1,4}[.)、:](?!\d)|[a-h][.)、:](?=\s|$))(?:\*\*)?[ \t]*/iu, '')
      .replace(/\[\s*_{2,}\s*\d+\s*_{2,}\s*\]|(?<![A-Za-z0-9_])_{2,}(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/g, ' ')
      .replace(/[，。？！、；：,?!;:"“”‘’()（）]/g, ' ')
      .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
      .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1')
      .replace(/\s+/g, ' ').trim()
    ).join(' ').trim();
  const searchTokens = query => [...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];
  const searchableText = new WeakMap();
  const sequenceText = value => String(value ?? '').normalize('NFKC').replace(/、/g, ',').replace(/\s*,\s*/g, ',');
  function sequencePattern(query) {
    const text = sequenceText(query).trim();
    if (!/^[+-]?\d+(?:\.\d+)?(?:,[+-]?\d+(?:\.\d+)?)+$/.test(text)) return null;
    const literal = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole numbers, never a digit inside a longer number or variable.
    return new RegExp('(?<![\\dA-Za-z_.+-])' + literal + '(?![\\dA-Za-z_+-]|\\.\\d)', 'u');
  }
  function sequenceFields(question) {
    // Old aliases may contain generic array-format examples absent from the visible question.
    return searchFields(question).filter(field => field.label !== '修正前答案').map(field =>
      field.label === '題幹' ? {...field,values:[question.stem ?? question.q,question.translation]} : field);
  }
  function questionType(question) {
    return question.images?.length || question.type === '圖片題' ? '圖片題' : answerType(question);
  }

  function answerType(question) {
    const options = question.options ?? question.opts ?? [];
    if (!options.length) return '填空題';
    if (question.type === '多選題' || question.type === '複選題') return '多選題';
    if (question.type === '單選題') return '單選題';
    if (question.type && question.type !== '圖片題') return '填空題';
    // Parse option keys instead of counting capital letters inside answer text
    // (for example, the C in "Xerox PARC" is not another selected option).
    const expected = question.choiceKey || window.courseChoiceAnswers?.expectedChoiceKey(question.answer ?? question.a, options);
    if (expected) return expected.length > 1 ? '多選題' : '單選題';
    const raw = String(question.answer ?? question.a ?? '').trim();
    const letters = new Set(/^[A-H](?:\s*[,、，/＋+&及與和]\s*[A-H])*(?:[.、．])?$/i.test(raw) ? raw.toUpperCase().match(/[A-H]/g) : []);
    return letters.size > 1 ? '多選題' : '單選題';
  }

  function searchFields(question) {
    return [
      { label:'題幹', values:[question.stem ?? question.q, question.translation, ...(Array.isArray(question.aliases) ? question.aliases : [])] },
      { label:'選項', values:[...(question.options || question.opts || []), ...(question.optionTranslations || [])] },
      { label:'答案', values:[question.answer ?? question.a] },
      { label:'修正前答案', values:[question.originalAnswer] },
      { label:'解析', values:[explanationText(question), ...(question.terms || []).map(term => `${term.label} ${term.text}`)] },
      { label:'備註', values:[question.note, ...(!hasProvidedAnswer(question) ? [question.reviewIssue, question.missingContext] : [])] },
      { label:'分類', values:[question.category, questionType(question)] }
    ];
  }

  function matchesSearch(question, query) {
    const sequence = sequencePattern(query);
    if (sequence) return sequenceFields(question).some(field => field.values.some(value => sequence.test(sequenceText(value))));
    const tokens = searchTokens(query);
    if (!tokens.length) return true;
    let text = searchableText.get(question);
    if (text === undefined) {
      text = normalize(searchFields(question).flatMap(field => field.values).filter(Boolean).join('\n'));
      searchableText.set(question, text);
    }
    return tokens.every(token => text.includes(token));
  }

  function searchMatchMarkup(question, query) {
    const sequence = sequencePattern(query);
    if (sequence) {
      const labels = sequenceFields(question).filter(field => field.values.some(value => sequence.test(sequenceText(value)))).map(field => field.label);
      return labels.length ? `<p class="search-match">命中：${labels.map(escape).join('、')}</p>` : '';
    }
    const tokens = searchTokens(query);
    if (!tokens.length) return '';
    const labels = searchFields(question).filter(field => {
      const text = normalize(field.values.filter(Boolean).join('\n'));
      return tokens.some(token => text.includes(token));
    }).map(field => field.label);
    return labels.length ? `<p class="search-match">命中：${labels.map(escape).join('、')}</p>` : '';
  }

  function createPracticeOrder(random = Math.random) {
    let signature = null;
    let indices = [];
    let shuffled = false;
    return {
      reset() {
        signature = null;
        indices = [];
        shuffled = false;
      },
      apply(items, shuffle = false, identity = item => item?.id ?? item?.q?.id) {
        const nextSignature = JSON.stringify(items.map(identity));
        if (nextSignature !== signature) {
          signature = nextSignature;
          indices = items.map((_, index) => index);
          shuffled = false;
        }
        if (shuffle && !shuffled) {
          for (let index = indices.length - 1; index > 0; index--) {
            const other = Math.floor(random() * (index + 1));
            [indices[index], indices[other]] = [indices[other], indices[index]];
          }
          shuffled = true;
        }
        if (!shuffle) return items;
        return indices.map(index => items[index]).filter(item => item !== undefined);
      }
    };
  }

  function createOptionSession(random = Math.random) {
    const permutations=new Map();
    const strip=value=>String(value??'').replace(/^\s*[A-H][.．、:：)）]\s*/i,'');
    function key(q,options){return q.choiceKey||window.courseChoiceAnswers?.expectedChoiceKey(q.answer??q.a??'',options);}
    function safe(q,options){
      if(options.length<2||options.length>8||options.some(o=>typeof o!=='string')||!hasProvidedAnswer(q))return false;
      const correct=key(q,options);if(!/^[A-H]+$/.test(correct??'')||new Set(correct).size!==correct.length||[...correct].some(c=>c.charCodeAt(0)-65>=options.length))return false;
      const translated=q.optionTranslations??[];
      if(translated.length&&translated.length!==options.length)return false;
      const contents=[...options,...translated].map(strip).join('\n');
      if(/以上|上述|下述|前述|皆是|皆非|前兩項|前三項|all of (?:the )?(?:above|these)|none of (?:the )?(?:above|these)|both of (?:the )?above|first (?:two|three) (?:options|choices)/i.test(contents))return false;
      const references=/(?:選項|答案)\s*[A-H]|[A-H]\s*選項|\b(?:option|choice)\s*[A-H]\b|\b[A-H]\s*(?:與|及|和|或|、|and|or|&|[+＋/／,，])\s*[A-H]\b/i;
      if(references.test(contents)||references.test(String(q.stem??q.q??''))||references.test(String(q.note??'')))return false;
      // Later unreviewed prose with positional answer references keeps its source order.
      const ex=explanationText(q);
      const rewritten=window.courseExplanationContent?.rewrite(q,ex);
      if(rewritten!==undefined&&rewritten!==ex)return false;
      if(q.originalAnswer&&!window.courseChoiceAnswers?.expectedChoiceKey(q.originalAnswer,options))return false;
      return true;
    }
    function get(original,id=original.id??original.bookmarkId){
      const q=window.courseExplanationContent?.apply(original)||original,options=q.options??q.opts??[];
      if(!safe(q,options)){permutations.delete(id);return q;}
      const signature=JSON.stringify([q.type,q.stem??q.q,options,q.answer??q.a,q.choiceKey,q.optionTranslations]);
      let state=permutations.get(id);
      if(!state||state.signature!==signature){
        const order=options.map((_,i)=>i);
        for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
        state={signature,order};permutations.set(id,state);
      }
      const {order}=state;
      const remap=old=>order.map((source,index)=>old.includes(String.fromCharCode(65+source))?String.fromCharCode(65+index):'').join('');
      const correct=remap(key(q,options)),shuffled=order.map((source,index)=>`${String.fromCharCode(65+index)}. ${strip(options[source])}`);
      const result={...q,choiceKey:correct,optionOrder:[...order]};
      if(Object.hasOwn(q,'options'))result.options=shuffled;
      if(Object.hasOwn(q,'opts'))result.opts=shuffled;
      if(Object.hasOwn(q,'answer'))result.answer=[...correct].join('、');
      if(Object.hasOwn(q,'a'))result.a=[...correct].join('、');
      if(q.optionTranslations?.length)result.optionTranslations=order.map(source=>strip(q.optionTranslations[source]));
      if(q.originalAnswer)result.originalAnswer=[...remap(window.courseChoiceAnswers.expectedChoiceKey(q.originalAnswer,options))].join('、');
      return result;
    }
    return {get,safe,reset:()=>permutations.clear(),sourceChoices:(id,choices)=>choices.map(i=>permutations.get(id)?.order[i]??i)};
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
  function explanationText(question) { return window.courseExplanationContent?.text(question)??String(question.explanation??question.ex??''); }
  function explanationMarkup(question, format = escape) {
    const text = explanationText(question);
    return text.split(/\n\s*\n/).filter(Boolean).map(block => {
      const section = block.match(/^(核心觀念|解題步驟|判讀步驟|適用條件|選項判讀)：\s*([\s\S]*)$/);
      return section ? `<div class="explanation-section"><strong>${escape(section[1])}</strong><p>${mathMarkup(section[2], format)}</p></div>` : `<p>${mathMarkup(block, format)}</p>`;
    }).join('');
  }
  function qualityReasons(question, course) {
    if(question.submissionReview?.status==='pending')return ['投稿版本待核對'];
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
    if (!explanationText(question).trim() && !question.terms?.length) reasons.push('缺少解析');
    return reasons;
  }

  function qualityMarkup(question, course) {
    if(question.submissionReview?.status==='pending')return `<aside class="quality-note"><strong>待核對：疑似重複或版本差異</strong><br>${escape(question.submissionReview.reason || '')} 本題已收錄；投稿答案供參考，尚未由站主確認。</aside>`;
    const reasons = qualityReasons(question, course);
    if (!reasons.length) return '';
    const details = [question.reviewIssue, question.missingContext].filter(Boolean).join(' ');
    return `<p class="quality-note">待確認原因：${escape(reasons.join('、'))}${details?`<br>${escape(details)} 本題暫不自動判分。`:''}</p>`;
  }

  function answerLabel(question) {
    if(question.submissionReview?.status==='pending')return '投稿答案（待核對）';
    const label = question.originalAnswer ? '修正後答案' : '題庫答案';
    return !hasProvidedAnswer(question) && (question.reviewIssue || question.missingContext) ? `${label}（待確認）` : label;
  }

  // Show only letters from the same verified option mapping used by practice grading.
  // Source answers remain unchanged, including text answers that cannot map.
  function answerValues(question) {
    const answer = String(question.answer ?? question.a ?? '');
    const options = question.options ?? question.opts ?? [];
    if (!hasProvidedAnswer(question) || !options.length) return [answer];
    const key = question.choiceKey || window.courseChoiceAnswers?.expectedChoiceKey(answer, options);
    if (!/^[A-H]+$/.test(key || '') || new Set(key).size !== key.length ||
        [...key].some(letter => letter.charCodeAt(0) - 65 >= options.length)) return [answer];
    return [...key].sort();
  }

  const answerText = question => answerValues(question).join('、');
  const answerValueMarkup = (question, format = escape) => answerValues(question).map(format).join('、');

  function incompleteReasons(question) {
    const reasons = [];
    if (question.missingContext) reasons.push('缺少題圖或解題所需資料');
    if ((question.options ?? question.opts ?? []).some(option => /選項因遮罩|未能完整辨識|原始選項未完整/.test(String(option))) ||
        /選項.*(?:不完整|未完整|缺少)/.test(question.note || '')) reasons.push('原始選項不完整');
    return reasons;
  }

  function incompleteMarkup(question) {
    const reasons = incompleteReasons(question);
    return reasons.length ? `<p class="data-incomplete-note"><strong>資料不完整</strong>：${escape(reasons.join('、'))}。請搭配原始教材核對；已提供的題庫答案保留顯示。</p>` : '';
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

  // Display only: never replace stems/translations in the source question.
  function bilingualPromptMarkup(question, render = escape) {
    const first=String(question.stem ?? question.q ?? ''),second=String(question.translation ?? '');
    const chinese=text=>/[\u3400-\u9fff]/u.test(text),english=text=>/[a-z]/i.test(text)&&!chinese(text);
    let top=first,bottom=second;
    if(chinese(second)&&english(first)){top=second;bottom=first;}
    const paired=Boolean(chinese(top)&&english(bottom));
    const heading=`<h3 class="question" tabindex="-1" lang="${chinese(top)?'zh-Hant':'en'}">${render(top)}</h3>`;
    if(!bottom)return heading;
    const translation=`<p class="translation" lang="${chinese(bottom)?'zh-Hant':'en'}">${render(bottom)}</p>`;
    return heading+(paired?`<details class="english-prompt"><summary>查看英文原題</summary>${translation}</details>`:translation);
  }

  const renderedCardVersions = new WeakMap();
  function renderQuestionCards(list, entries, markup, preserveCards = false) {
    const cards = [...list.children];
    const expandedEnglish = new Set(cards.filter(card=>card.querySelector('details.english-prompt')?.open).map(card=>card.dataset.id));
    const id = entry => entry.id ?? entry.q.id;
    // A stable ID identifies a question, not a revision. Compare public content
    // too, replacing changed cards while leaving other responses/focus intact.
    const versions = entries.map(entry => JSON.stringify([entry.q, entry.i, entry.unit?.id, entry.unit?.label, entry.displayNumber]));
    if (!preserveCards || entries.length !== cards.length || entries.some((entry,i) => id(entry) !== cards[i].dataset.id)) {
      list.innerHTML = entries.map(markup).join('');
    } else {
      entries.forEach((entry,i) => {
        if (renderedCardVersions.get(cards[i]) === versions[i]) return;
        const template = document.createElement('template');
        template.innerHTML = markup(entry);
        cards[i].replaceWith(template.content.firstElementChild);
      });
    }
    [...list.children].forEach((card,i) => {
      renderedCardVersions.set(card, versions[i]);
      const english=card.querySelector('details.english-prompt');
      if(english && expandedEnglish.has(card.dataset.id))english.open=true;
    });
  }

  window.courseQuestionTools = { bilingualPromptMarkup, questionType, answerType, questionImagesMarkup, hasProvidedAnswer, optionAnswerKeys, studyOptionMark, updateStudyOptionMarks, matchesSearch, searchMatchMarkup, createPracticeOrder, createOptionSession, explanationText, explanationMarkup, qualityReasons, qualityMarkup, missingSource, answerLabel, answerText, answerValueMarkup, incompleteReasons, incompleteMarkup, reviewMarkup, populateSelect, reportURL, focusResults, focusLinkedQuestion, renderQuestionCards };
})();
