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

    const formulaCaseSensitive =
      /^(?:O|o|Ω|ω|Θ|θ)\s*[\(\^]/u.test(String(answer ?? "").trim());
    const caseSensitive = question.exact === true || formulaCaseSensitive;
    const correct =
      normalizedText(response, caseSensitive) ===
      normalizedText(answer, caseSensitive);
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
    entry?.querySelector("textarea")?.removeAttribute("aria-invalid");
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
      entry.querySelector("textarea")?.setAttribute("aria-invalid", "true");
    if (mark.icon) entry.insertAdjacentHTML("beforeend", mark.icon);
  }

  window.coursePractice = {
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
