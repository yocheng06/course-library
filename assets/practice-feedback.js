/* Shared answer checking and retry feedback for both courses. */
(() => {
  "use strict";

  const escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
    );
  const expectedChoiceKey = window.courseChoiceAnswers.expectedChoiceKey;

  function unavailable(question) {
    return (
      !window.courseQuestionTools.hasProvidedAnswer(question) &&
      (question.reviewIssue || question.missingContext)
    );
  }

  function normalizedText(value, exact) {
    const normalized = String(value ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    return exact ? normalized : normalized.toLocaleLowerCase("en-US");
  }

  // Reviewed alternatives are bound to both the stable ID and unchanged answer.
  // Do not apply formula rewriting or fuzzy matching to unrelated questions.
  const reviewedAnswers = {
    'os:os8-053': { answer: 'wait for graph', aliases: ['wait-for graph', 'wait-for-graph'] },
    'algorithms:L6-055': { answer: 'n!', aliases: ['n !'] },
  };
  function answerParts(question, answer) {
    const stem = String(question.stem ?? question.q ?? '');
    const blanks = [...new Set([...stem.matchAll(/\[_{2,}(\d+)_{2,}\]/g)].map(m => m[1]))];
    const parts = String(answer).split(/\s+\/\s+/);
    return blanks.length > 1 && blanks.length <= 20 && blanks.every((n,i)=>Number(n)===i+1) && parts.length === blanks.length ? parts : null;
  }
  function entryMarkup(question, id, draft, mark) {
    const answer = question.answer ?? question.a ?? '';
    const parts = answerParts(question, answer);
    const invalid = mark.className === 'practice-incorrect' ? 'aria-invalid="true"' : '';
    if (!parts) return `<div class="practice-entry ${mark.className}"><textarea class="entry" data-draft="${escape(id)}" aria-label="${escape(id)} 你的答案" placeholder="先寫下你的答案或解題想法…" ${invalid}>${escape(draft || '')}</textarea>${mark.icon}</div>`;
    const values = String(draft || '').split(/\s+\/\s+/);
    return `<div class="practice-entry ${mark.className}"><p>依空格順序填寫；每格內的多個數值可用逗號分隔。</p>${parts.map((_, i) => `<label class="fill-answer-label">第 ${i + 1} 格<textarea class="entry" data-fill-index="${i}" aria-label="${escape(id)} 第 ${i + 1} 格答案" rows="2" ${invalid}>${escape(values[i] || '')}</textarea></label>`).join('')}<textarea data-draft="${escape(id)}" hidden>${escape(draft || '')}</textarea>${mark.icon}</div>`;
  }
  if (typeof document !== 'undefined') document.addEventListener('input', event => {
    if (!event.target.matches?.('[data-fill-index]')) return;
    const entry = event.target.closest('.practice-entry');
    const draft = entry.querySelector('[data-draft]');
    const values = [...entry.querySelectorAll('[data-fill-index]')].map(field => field.value.trim());
    draft.value = values.some(Boolean) ? values.join(' / ') : '';
    draft.dispatchEvent(new window.Event('input', {bubbles:true}));
  }, true);

  function evaluate(answer, options, chosen, question = {}, response = "") {
    const choices = [...new Set(chosen)].sort((a, b) => a - b);
    if (options.length) {
      if (!choices.length)
        return {
          kind: "choice",
          correct: null,
          correctIndices: [],
          incorrectIndices: [],
          revealAnswer: false,
          text: "請先選擇答案，再檢查。",
        };

      if (unavailable(question))
        return {
          kind: "choice",
          correct: null,
          correctIndices: [],
          incorrectIndices: [],
          revealAnswer: true,
          text: "本題的答案、題意或原始資料仍需確認，暫不自動判分。請閱讀答案與解析中的疑點和成立條件。",
        };

      const expected = question.choiceKey || expectedChoiceKey(answer, options);
      if (!expected)
        return {
          kind: "choice",
          correct: null,
          correctIndices: [],
          incorrectIndices: [],
          revealAnswer: true,
          text: "本題目前無法自動判分，請對照題庫答案與解析。",
        };

      const expectedIndices = new Set(
        [...expected].map((letter) => letter.charCodeAt(0) - 65),
      );
      const correctIndices = choices.filter((index) => expectedIndices.has(index));
      const incorrectIndices = choices.filter((index) => !expectedIndices.has(index));
      const actual = choices
        .map((index) => String.fromCharCode(65 + index))
        .join("");
      const correct = actual === expected;
      const label = question.originalAnswer ? "修正後答案" : "題庫答案";
      return {
        kind: "choice",
        correct,
        multiple:
          window.courseQuestionTools.answerType(question) === "多選題" ||
          expected.length > 1,
        expectedIndices: [...expectedIndices],
        correctIndices,
        incorrectIndices,
        revealAnswer: correct,
        text: correct
          ? `答對了，${label}與你的選擇一致。`
          : correctIndices.length
            ? "部分選項正確，調整後再按「檢查答案」。"
            : "選項不正確，調整後再按「檢查答案」。",
      };
    }

    if (!String(response ?? "").trim())
      return {
        kind: "text",
        correct: null,
        correctIndices: [],
        incorrectIndices: [],
        revealAnswer: false,
        text: "請先輸入答案，再檢查。",
      };

    if (unavailable(question))
      return {
        kind: "text",
        correct: null,
        correctIndices: [],
        incorrectIndices: [],
        revealAnswer: true,
        text: "本題的答案、題意或原始資料仍需確認，暫不自動判分。請閱讀答案與解析中的疑點和成立條件。",
      };

    if (!window.courseQuestionTools.hasProvidedAnswer(question))
      return {
        kind: "text",
        correct: null,
        correctIndices: [],
        incorrectIndices: [],
        revealAnswer: true,
        text: "本題沒有可自動核對的標準答案，請對照答案與解析。",
      };

    const formulaCaseSensitive = String(answer ?? '').split(/\s+\/\s+/)
      .some(part => /^(?:O|o|Ω|ω|Θ|θ)\s*[\(\^]/u.test(part.trim()));
    const caseSensitive = question.exact === true || formulaCaseSensitive;
    const id = question.id ?? question.bookmarkId;
    const course = window.courseLearning?.course || (typeof document !== 'undefined' ? document.body?.dataset.course : '');
    const reviewed = reviewedAnswers[`${course}:${id}`];
    const aliases = reviewed?.answer === answer ? reviewed.aliases : [];
    const canonical = value => {
      const parts = answerParts(question, answer);
      // Whitespace around list separators is presentation, not a numeric change.
      const normalize = text => normalizedText(text, caseSensitive).replace(/\s*[,，]\s*/g, ',');
      return parts ? String(value).split(/\s+\/\s+/).map(normalize).join(' / ') : normalize(value);
    };
    const correct = [answer, ...aliases].some(expected => canonical(response) === canonical(expected));
    return {
      kind: "text",
      correct,
      correctIndices: [],
      incorrectIndices: [],
      revealAnswer: correct,
      text: correct
        ? "答對了，已顯示答案與解析。"
        : "答案不正確，修改後再按「檢查答案」。",
    };
  }

  function markup(result, id) {
    const saved = window.learningUI?.isSaved(id) === true;
    const action =
      result.correct === false
        ? `<button type="button" class="plain" data-add-review="${escape(id)}" ${saved ? "disabled" : ""}>${saved ? "已加入待複習" : "答錯了，加入待複習"}</button>`
        : "";
    return `<div class="practice-feedback"><p class="feedback ${result.correct === true ? "correct" : result.correct === false ? "review" : "neutral"}" role="status" aria-live="polite">${escape(result.text)}</p>${action}</div>`;
  }

  function show(card, result, id) {
    applyMarks(card, result);
    card.querySelector(".practice-feedback")?.remove();
    (card.querySelector(".practice-actions") || card.querySelector("[data-reveal]"))
      .insertAdjacentHTML("afterend", markup(result, id));
  }

  function optionMark(result, index) {
    if (result?.kind !== "choice" || result.correct === null) return { className: "", icon: "" };
    if (result.correctIndices.includes(index))
      return {
        className: "practice-correct",
        icon: '<span class="option-feedback-icon" aria-hidden="true">✓</span>',
      };
    if (result.incorrectIndices.includes(index))
      return {
        className: "practice-incorrect",
        icon: '<span class="option-feedback-icon" aria-hidden="true">✕</span>',
      };
    if (
      result.correct === false &&
      !result.multiple &&
      result.expectedIndices.includes(index)
    )
      return {
        className: "practice-correct",
        icon: '<span class="option-feedback-icon" aria-hidden="true">✓</span>',
      };
    return { className: "", icon: "" };
  }

  function textMark(result) {
    if (result?.kind !== "text" || result.correct === null)
      return { className: "", icon: "" };
    return result.correct
      ? {
          className: "practice-correct",
          icon: '<span class="entry-feedback-icon" aria-hidden="true">✓</span>',
        }
      : {
          className: "practice-incorrect",
          icon: '<span class="entry-feedback-icon" aria-hidden="true">✕</span>',
        };
  }

  function clearMarks(card) {
    card.querySelectorAll(".option").forEach((option) => {
      option.classList.remove("practice-correct", "practice-incorrect");
      option.querySelector(".option-feedback-icon")?.remove();
      option.querySelector("input")?.removeAttribute("aria-invalid");
    });
    const entry = card.querySelector(".practice-entry");
    entry?.classList.remove("practice-correct", "practice-incorrect");
    entry?.querySelector(".entry-feedback-icon")?.remove();
    entry?.querySelectorAll("textarea").forEach(field => field.removeAttribute("aria-invalid"));
  }

  function applyMarks(card, result) {
    clearMarks(card);
    card.querySelectorAll(".option").forEach((option, index) => {
      const mark = optionMark(result, index);
      if (!mark.className) return;
      option.classList.add(mark.className);
      if (mark.className === "practice-incorrect")
        option.querySelector("input")?.setAttribute("aria-invalid", "true");
      if (mark.icon) option.insertAdjacentHTML("beforeend", mark.icon);
    });

    const entry = card.querySelector(".practice-entry");
    const mark = textMark(result);
    if (!entry || !mark.className) return;
    entry.classList.add(mark.className);
    if (mark.className === "practice-incorrect")
      entry.querySelectorAll("textarea:not([hidden])").forEach(field => field.setAttribute("aria-invalid", "true"));
    if (mark.icon) entry.insertAdjacentHTML("beforeend", mark.icon);
  }

  window.coursePractice = {
    entryMarkup, answerParts,
    expectedChoiceKey,
    evaluate,
    markup,
    show,
    optionMark,
    textMark,
    clearMarks,
    applyMarks,
  };
})();
