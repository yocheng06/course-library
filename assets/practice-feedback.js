/* Shared choice checking and review actions for both courses. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/^[a-h][.、．:：]\s*/i, '').replace(/，/g, ',').replace(/；/g, ';').replace(/\s+/g, '');

  function expectedChoiceKey(answer, options) {
    const raw = String(answer ?? '').normalize('NFKC').trim()
      .replace(/\s*\(依本題庫(?:標準答案|分類)\)$/, '');
    if (/^[A-H](?:\s*[,、，/＋+&及與和]\s*[A-H])*(?:[.、．])?$/i.test(raw)) {
      const letters = raw.match(/[A-H]/gi).map(letter => letter.toUpperCase());
      if (new Set(letters).size !== letters.length || letters.some(letter => letter.charCodeAt(0) - 65 >= options.length)) return null;
      return letters.sort().join('');
    }
    const values = options.map(clean), value = clean(raw);
    const exact = values.map((option, i) => option === value ? i : -1).filter(i => i >= 0);
    if (exact.length === 1) return String.fromCharCode(65 + exact[0]);
    if (exact.length > 1) return null;
    const parts = raw.split(/[、,，;；]\s*/).map(clean).filter(Boolean);
    if (!parts.length) return null;
    const mapped = parts.map(part => {
      const matches = values.map((option, i) => option === part ? i : -1).filter(i => i >= 0);
      return matches.length === 1 ? matches[0] : null;
    });
    if (mapped.includes(null) || new Set(mapped).size !== mapped.length) return null;
    return mapped.map(i => String.fromCharCode(65 + i)).sort().join('');
  }

  function evaluate(answer, options, chosen, question = {}) {
    if (!window.courseQuestionTools.hasProvidedAnswer(question) && (question.reviewIssue || question.missingContext)) return { correct:null, text:'本題的答案、題意或原始資料仍需確認，暫不自動判分。請閱讀解析中的疑點與成立條件。' };
    if (!options.length) return { correct:null, text:'請對照你的作答與題庫答案、解析。' };
    if (!chosen.length) return { correct:null, text:'你尚未選擇選項。可以先收起答案，再試著作答。' };
    const expected = expectedChoiceKey(answer, options);
    if (expected === null) return { correct:null, text:'請自行對照題庫答案與解析。' };
    const actual = [...new Set(chosen)].sort((a,b) => a-b).map(i => String.fromCharCode(65+i)).join('');
    const correct = actual === expected;
    const label = question.originalAnswer ? '修正後答案' : '題庫答案';
    return { correct, text:correct
      ? `選項與${label}一致。請再讀解析，確認理由。`
      : `選項與${label}不同，請對照答案與解析。` };
  }

  function markup(result, id) {
    const saved = window.learningUI?.isSaved(id) === true;
    const action = result.correct === false
      ? `<button type="button" class="plain" data-add-review="${escape(id)}" ${saved?'disabled':''}>${saved?'已加入待複習':'答錯了，加入待複習'}</button>` : '';
    return `<div class="practice-feedback"><p class="feedback ${result.correct===true?'correct':'review'}" role="status">${escape(result.text)}</p>${action}</div>`;
  }

  function show(card, result, id) {
    card.querySelector('.practice-feedback')?.remove();
    card.querySelector('[data-reveal]').insertAdjacentHTML('afterend', markup(result, id));
  }
  window.coursePractice = { expectedChoiceKey, evaluate, markup, show };
})();
