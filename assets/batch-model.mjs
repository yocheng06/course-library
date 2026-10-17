import "./choice-answers.js?v=global-dedup-20261016";

export const MAX_QUESTIONS = 30;
export const MAX_TEXT = 80000;
const LETTERS = "ABCDEFGH";
const invisible = /[\u200B\u2060\uFEFF]/g;
// NFKC alone flattens n² into n2, which changes the mathematical meaning.
const superscriptChars = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ";
const superscriptValues = "0123456789+-=()ni";
const unescapeBlanks = (value) =>
  String(value).replace(/(?:\\_){2,}/g, (blank) => blank.replaceAll("\\", ""));
const normalizeUnicode = (value) =>
  String(value ?? "")
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g,
      (group) =>
        `^{${[...group].map((c) => superscriptValues[superscriptChars.indexOf(c)]).join("")}}`,
    )
    .normalize("NFKC");
const cleanLine = (text) =>
  normalizeUnicode(unescapeBlanks(text))
    .replace(invisible, "")
    .trim()
    .replace(/\*\*([A-H][.)、:]|\([A-H]\))\*\*/gi, "$1")
    .replace(/^\*\*(.+?)\*\*(.*)$/, "$1$2")
    .replace(
      /(^|\s)[◯○●⭕☐☑□■•·✓✔]\uFE0F?\s*(?=(?:\(?[A-H][.)、:]|\[[A-H]\]))/gi,
      "$1",
    );
const header =
  /^(?:第\s*(\d{1,4})\s*題\s*[:：.)、]?|(?:Q(?:uestion)?|題目|題)\s*(\d{1,4})\s*[:：.)、-]?|[（(](\d{1,4})[）)]|(\d{1,4})[.)、](?=\D|$))\s*(.*)$/i;
// AI sometimes emits standalone heading labels such as "Beast 1." or "妖獸 2.".
// Require a letter-only prefix, a separated number and terminal punctuation;
// expressions, decimals and option content remain ordinary question text.
const namedHeader = /^[\p{L}][\p{L}\p{M} _-]{0,30}?\s+(\d{1,4})[.)、:]\s*$/u;
function questionHeader(line) {
  const standard = line.match(header);
  if (standard)
    return {
      number: standard[1] || standard[2] || standard[3] || standard[4],
      text: standard[5],
    };
  const named = line.match(namedHeader);
  return named ? { number: named[1], text: "" } : null;
}
const option =
  /^(?:[-*+]\s+)?(?:\(([A-H])\)|\[([A-H])\]|([A-H])[.)、:])\s*(.*)$/i;
const metadata = /^(?:正確答案|參考答案|答案|解答|解析|詳解|說明)\s*[:：]/;
const stemLabel = /^(?:題目|題幹|Question|Stem)\s*[:：]\s*/i;
const optionsLabel = /^(?:選項|Options|Choices)\s*[:：]\s*/i;
const typePattern =
  /^(?:[【\[(（]\s*)?(單選題?|多選題?|複選題?|填空題?|圖片題?)(?:\s*[】\])）]|\s*[:：])\s*/;

export function normalizeText(value) {
  return (
    normalizeUnicode(unescapeBlanks(value ?? ""))
      .replace(invisible, "")
      // Translate only known presentation commands. Keep variables, operators,
      // logarithm bases and upper/lower bounds distinct.
      .replace(/\\(?:text|operatorname)\{(floor|ceil|log)\}/g, "$1")
      .replace(/\\(log|ln)\b/g, "$1")
      .replace(/\\lfloor\s*([^{}\n]*?)\s*\\rfloor/g, "floor($1)")
      .replace(/\\lceil\s*([^{}\n]*?)\s*\\rceil/g, "ceil($1)")
      .replace(/⌊\s*([^⌊⌋\n]*?)\s*⌋/g, "floor($1)")
      .replace(/⌈\s*([^⌈⌉\n]*?)\s*⌉/g, "ceil($1)")
      .replace(/\^\{([A-Za-z0-9]+)\}/g, "^$1")
      .replace(/\^\(((?:log|ln)(?:_[A-Za-z0-9]+)?\([^()]*\))\)/g, "^$1")
      .replace(/`([^`\n]+)`/g, "$1")
      .replace(/\[_{2,}\d*_*\]|_{2,}/g, "___")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/([\p{Script=Han}])\s+/gu, "$1")
      .replace(/\s+([\p{Script=Han}])/gu, "$1")
      .replace(/\s*([,;:?!()\[\]{}])\s*/g, "$1")
      .trim()
  );
}
// Only these complete, known answer-format hints may be omitted
// from the lookup key. Naming, abbreviation and arbitrary conditions remain
// part of the question; case and number requirements are checked on answers.
// The pasted text itself is kept for display/copy.
function answerFormat(value) {
  const normalized = normalizeText(value).replace(/[?？。]+$/, "");
  const match = normalized.match(
    /\((請用(?:小寫英文|大寫英文|英文|數字)回答[^()]*)\)$/,
  );
  if (!match) return { stem: normalized, hint: "" };
  const remainder = match[1]
    .replace(/^請用(?:小寫英文|大寫英文|英文|數字)回答/, "")
    .replace(/單字間(?:請)?留-/g, "")
    .replace(/表示形式為/g, "")
    .replace(/請用log/g, "")
    .replace(/不可用lg(?:替代log)?/g, "")
    .replace(/上標(?:請)?用\^/g, "")
    .replace(/符號請用\{big-theta,theta,big-omega,omega,O,o\}/g, "")
    .replace(/(?:符號)?中間不留空白/g, "")
    .replace(/[,;\s]/g, "");
  if (remainder) return { stem: normalized, hint: "" };
  return {
    stem: normalized
      .slice(0, match.index)
      .trim()
      .replace(/[?？。]+$/, ""),
    hint: match[1],
  };
}
export const normalizeStem = (value) => answerFormat(value).stem;
export const optionText = (value) =>
  normalizeUnicode(value)
    .replace(/^(?:\([A-H]\)|\[[A-H]\]|[A-H][.)、:])\s*/i, "")
    .trim();
export const optionKey = (value) => {
  const text = optionText(value);
  // A known spelling of the same technical term; keep the pasted text for
  // display, and do not apply general typo/fuzzy corrections to choices.
  return normalizeText(text === "Disk formating" ? "Disk formatting" : text);
};

// The aliases in each group refer to one option at the same original index.
// Align inherited groups by content, never by a source version's letter order.
export function choiceAliases(options, translations, inherited = []) {
  if (
    Array.isArray(translations) &&
    translations.length === options.length &&
    translations.every((v) => typeof v === "string" && v.trim())
  )
    return options.map((text, i) => [...new Set([text, translations[i]])]);
  if (!options.length || !inherited.length) return null;
  const hits = options.map((text) =>
    inherited.filter((group) =>
      group.some((alias) => optionKey(alias) === optionKey(text)),
    ),
  );
  return hits.every((groups) => groups.length === 1) &&
    new Set(hits.map((groups) => groups[0])).size === options.length
    ? hits.map((groups) => groups[0])
    : null;
}

// Shared with submission-index generation so all verified mixed-language
// versions are recognized there as well. At most 2^8 versions per source.
export function choiceCombinations(options, aliases = null) {
  let versions = [[]];
  for (const [i, option] of options.entries()) {
    const values = [
      ...new Map(
        (aliases?.[i] || [option]).map((v) => [optionKey(v), v]),
      ).values(),
    ];
    if (versions.length * values.length > 256)
      throw new Error("選項對照版本超過安全上限，請檢查翻譯資料。");
    versions = versions.flatMap((prefix) => values.map((v) => [...prefix, v]));
  }
  return versions;
}

function inlineOptions(line) {
  const matches = [...line.matchAll(/(?:^|\s)([A-H])[.)、:]\s*/g)];
  if (matches.length < 2 || matches[0].index !== 0) return null;
  return matches.map(
    (m, i) =>
      `${m[1]}. ${line.slice(m.index + m[0].length, matches[i + 1]?.index ?? line.length).trim()}`,
  );
}

export function parseQuestions(text) {
  if (typeof text !== "string" || !text.trim())
    throw new Error("請先貼上題目與選項。");
  if (text.length > MAX_TEXT)
    throw new Error("文字超過 80,000 字，請分批貼上。");
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  // Some Markdown exports add a literal hard-break backslash to every line.
  // Require multiple standalone numbered headings before treating it as markup;
  // an isolated path or literal code backslash remains ordinary content.
  const hardBreak = /(?<!\\)\\\s*$/;
  const exportedBreaks =
    rawLines.filter((line) => {
      if (!hardBreak.test(line)) return false;
      const heading = questionHeader(cleanLine(line.replace(hardBreak, "")));
      return heading && !heading.text.trim();
    }).length >= 2;
  const cleanedLines = rawLines.map((line) =>
    cleanLine(exportedBreaks ? line.replace(hardBreak, "") : line)
      .replace(/^#{1,6}\s*/, "")
      .normalize("NFKC"),
  );
  const tailRequest =
    /^(?:請)?給我(?:全部)?答案(?:[，, ]*(?:並|請)?(?:確定|確認)(?:答案)?正確)?[。.!！]?$/;
  if (cleanedLines.some(questionHeader))
    while (
      cleanedLines.length &&
      (!cleanedLines.at(-1) || tailRequest.test(cleanedLines.at(-1)))
    )
      cleanedLines.pop();
  const lines = cleanedLines.flatMap((line, i) => {
    // Recover "D. option text  第 21 題\n題目：..." only with both
    // an actual option before it and an explicitly labelled question after it.
    // Ordinary references to another question are not question boundaries.
    const joined = line.match(/^(.*\S)[ \t]+(第\s*\d{1,4}\s*題\s*[:.)、]?)$/);
    if (!joined || !joined[1].match(option)?.[4]?.trim()) return [line];
    const following = cleanedLines.slice(i + 1).find((l) => l.trim()) || "";
    return stemLabel.test(following) ? [joined[1], joined[2]] : [line];
  });
  const numbered = lines.some((line) => questionHeader(line));
  const questions = [];
  let current,
    trailing = false;
  function start(number) {
    if (questions.length >= MAX_QUESTIONS)
      throw new Error(
        "每次最多比對 30 題，請分批貼上；系統未截掉或略過任何題目。",
      );
    current = {
      number: String(number),
      stem: "",
      options: [],
      type: "",
      issues: [],
    };
    questions.push(current);
    trailing = false;
  }
  function append(raw) {
    let line = raw.trim();
    if (!line || /^```(?:\w+)?$/.test(line) || /^[-*_]{3,}$/.test(line)) return;
    line = line.replace(stemLabel, "");
    const choicesHeading = line.match(optionsLabel);
    if (choicesHeading) {
      const rest = line.slice(choicesHeading[0].length);
      if (!rest || option.test(rest)) {
        current.expectsOptions = true;
        line = rest;
      }
    }
    if (!line) return;
    if (metadata.test(line)) {
      trailing = true;
      return;
    }
    if (trailing) return;
    const type = line.match(typePattern);
    if (type) {
      current.type = type[1];
      line = line.slice(type[0].length);
      if (!line) return;
    }
    if (/^題型\s*[:：]/.test(line)) {
      current.type = line.replace(/^題型\s*[:：]\s*/, "");
      return;
    }
    const chunks = inlineOptions(line);
    if (chunks) {
      chunks.forEach(append);
      return;
    }
    const opt = line.match(option);
    if (opt) {
      current.options.push({
        label: (opt[1] || opt[2] || opt[3]).toUpperCase(),
        text: cleanLine(opt[4]),
      });
      return;
    }
    if (current.options.length) current.options.at(-1).text += "\n" + line;
    else current.stem += (current.stem ? "\n" : "") + line;
  }
  for (const line of lines) {
    const match = questionHeader(line);
    if (match) {
      start(match.number);
      append(match.text);
    } else if (current) append(line);
    else if (!numbered && line.trim()) {
      start("1");
      append(line);
    }
  }
  if (!questions.length)
    throw new Error("沒有辨識到題目，請以「1. 題目」或「第 1 題」分隔每題。");
  const numbers = new Set();
  for (const q of questions) {
    if (numbers.has(q.number)) q.issues.push("題號重複，請確認分題是否正確。");
    numbers.add(q.number);
    if (!q.stem.trim()) q.issues.push("缺少題幹。");
    const labels = q.options.map((o) => o.label);
    if (
      q.options.length === 1 ||
      new Set(labels).size !== labels.length ||
      labels.some((l) => !LETTERS.slice(0, labels.length).includes(l))
    )
      q.issues.push("選項代號重複或不完整，請確認多題是否已分開並補齊選項。");
    if (q.options.some((o) => !o.text.trim())) q.issues.push("選項內容為空。");
    if ((/選/.test(q.type) || q.expectsOptions) && !q.options.length)
      q.issues.push("選擇題尚未附上選項。");
    if (
      /圖片/.test(q.type) ||
      /\[(?:看不清楚|無法辨識|圖片|題圖)[^\]]*\]|[（(]圖略[）)]/.test(
        q.stem + q.options.map((o) => o.text).join(""),
      ) ||
      /[（(](?:題目|原題)(?:附帶|附有|含有)[^）)\n]*(?:圖|虛擬碼)[^）)\n]*[）)]/.test(
        q.stem,
      )
    )
      q.issues.push("題目含未提供的圖片或無法辨識的文字。");
  }
  return questions;
}

export function toLibraryQuestion(
  course,
  unit,
  raw,
  preferred = false,
  canonicalId = null,
) {
  if (!raw || typeof raw !== "object") return null;
  const options = raw.options ?? raw.opts ?? [];
  const stem = raw.stem ?? raw.q,
    answer = raw.answer ?? raw.a;
  const id = canonicalId || raw.id || raw.bookmarkId;
  if (
    !["os", "algorithms"].includes(course) ||
    typeof stem !== "string" ||
    typeof answer !== "string" ||
    !id ||
    !Array.isArray(options) ||
    options.some((o) => typeof o !== "string")
  )
    return null;
  const supplied = raw.choiceKey;
  const suppliedValid =
    typeof supplied === "string" &&
    /^[A-H]+$/.test(supplied) &&
    new Set(supplied).size === supplied.length &&
    [...supplied].every((l) => LETTERS.indexOf(l) < options.length);
  return {
    course,
    unit,
    id,
    stem,
    options,
    answer,
    choiceKey: options.length
      ? suppliedValid
        ? supplied
        : globalThis.courseChoiceAnswers.expectedChoiceKey(answer, options)
      : null,
    needsImage: Boolean(raw.images?.length || raw.missingContext),
    preferred,
    ...(choiceAliases(options, raw.optionTranslations)
      ? { optionAliases: choiceAliases(options, raw.optionTranslations) }
      : {}),
    ...(Array.isArray(raw.answerConditions) && raw.answerConditions.length
      ? {
          conditions: raw.answerConditions.filter(
            (v) => typeof v === "string" && v.trim(),
          ),
        }
      : {}),
  };
}

function bilingualParts(stem) {
  const parts = stem
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    parts.length !== 2 ||
    parts.some((x) => x.length < 10) ||
    parts.some((x) => /^\(?Please (?:answer|use|write)/i.test(x))
  )
    return [];
  if (parts.filter((x) => /[\p{Script=Han}]/u.test(x)).length !== 1) return [];
  return parts;
}
export function questionStemVersions(stem, translation = "") {
  return [
    ...new Set([
      stem,
      ...bilingualParts(stem),
      ...(translation ? [translation, ...bilingualParts(translation)] : []),
    ]),
  ];
}
export function expandLibraryQuestion(course, unit, q) {
  if (!q || typeof q !== "object") return [];
  const result = [],
    id = q.id || q.bookmarkId;
  const variants = [
    q,
    ...(Array.isArray(q.sourceVariants) ? q.sourceVariants : []),
  ];
  const inherited =
    choiceAliases(q.options ?? q.opts ?? [], q.optionTranslations) || [];
  for (const [i, v] of variants.entries()) {
    const item = toLibraryQuestion(course, unit, v, i === 0, id);
    if (!item) continue;
    const aliases =
      item.optionAliases || choiceAliases(item.options, null, inherited);
    if (aliases) item.optionAliases = aliases;
    const conditions = [
      ...new Set([
        ...(q.answerConditions || []),
        ...(v.answerConditions || []),
      ]),
    ].filter((value) => typeof value === "string" && value.trim());
    if (conditions.length) item.conditions = conditions;
    result.push(item);
    for (const stem of bilingualParts(item.stem))
      result.push({ ...item, stem, preferred: false });
    if (v.translation && typeof v.translation === "string") {
      result.push({ ...item, stem: v.translation, preferred: false });
      const translated = v.optionTranslations;
      if (
        Array.isArray(translated) &&
        translated.length === item.options.length &&
        translated.every((o) => typeof o === "string" && o.trim())
      ) {
        result.push({ ...item, options: translated, preferred: false });
        result.push({
          ...item,
          stem: v.translation,
          options: translated,
          preferred: false,
        });
      }
    }
  }
  return result;
}

export function buildIndex(entries) {
  const stems = new Map(),
    blanklessStems = new Map();
  for (const entry of entries) {
    const normalized = normalizeStem(entry.stem);
    const key = entry.course + "|" + normalized;
    if (!stems.has(key)) stems.set(key, []);
    stems.get(key).push(entry);
    if (
      !entry.options.length &&
      (normalized.match(/___/g) || []).length === 1
    ) {
      const blanklessKey =
        entry.course + "|" + normalized.replace("___", "").trim();
      if (!blanklessStems.has(blanklessKey))
        blanklessStems.set(blanklessKey, []);
      blanklessStems.get(blanklessKey).push(entry);
    }
  }
  return { stems, blanklessStems, entries };
}
function choiceMatches(text, entry, index) {
  return (entry.optionAliases?.[index] || [entry.options[index]]).some(
    (alias) => optionKey(alias) === optionKey(text),
  );
}
function sameOptions(question, entry) {
  if (question.options.length !== entry.options.length) return false;
  const mapped = question.options.map((o) =>
    entry.options
      .map((_, i) => (choiceMatches(o.text, entry, i) ? i : -1))
      .filter((i) => i >= 0),
  );
  return (
    mapped.every((hits) => hits.length === 1) &&
    new Set(mapped.map((hits) => hits[0])).size === entry.options.length
  );
}
function remapAnswer(question, entry) {
  if (!question.options.length) {
    const { hint } = answerFormat(question.stem);
    if (
      hint &&
      (/[\p{Script=Han}]/u.test(entry.answer) ||
        (/小寫英文/.test(hint) && /[A-Z]/.test(entry.answer)) ||
        (/大寫英文/.test(hint) && /[a-z]/.test(entry.answer)) ||
        (/請用數字回答/.test(hint) &&
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(entry.answer.trim())) ||
        (/單字間(?:請)?留-/.test(hint) && /[\s_]/.test(entry.answer)) ||
        (/中間不留空白/.test(hint) && /\s/.test(entry.answer)) ||
        (/不可用lg/.test(hint) && /\blg/.test(entry.answer)))
    )
      return null;
    return { answer: entry.answer, signature: normalizeText(entry.answer) };
  }
  const correct = entry.options.length
    ? entry.choiceKey &&
      [...entry.choiceKey].map((letter) => LETTERS.indexOf(letter))
    : [normalizeText(entry.answer)];
  if (!correct) return null;
  const mapped = correct.map((value) =>
    question.options.filter((o) =>
      entry.options.length
        ? choiceMatches(o.text, entry, value)
        : optionKey(o.text) === value,
    ),
  );
  if (mapped.some((hits) => hits.length !== 1)) return null;
  const selected = question.options.filter((o) =>
    mapped.some((hits) => hits[0] === o),
  );
  if (/單選/.test(question.type) && selected.length !== 1) return null;
  return {
    answer: selected.map((o) => `${o.label}. ${o.text}`).join("；"),
    signature: selected
      .map((o) => o.label)
      .sort()
      .join(""),
  };
}
function dice(a, b) {
  const grams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const x = grams(a),
    y = grams(b);
  if (!x.size || !y.size) return 0;
  let hits = 0;
  for (const item of x) if (y.has(item)) hits++;
  return (2 * hits) / (x.size + y.size);
}
const references = (entries) =>
  [
    ...new Map(
      entries.map((e) => [e.id, { id: e.id, unit: e.unit, stem: e.stem }]),
    ).values(),
  ].slice(0, 3);
export function matchQuestion(question, index, { course, unit = "all" } = {}) {
  const eligible = (e) =>
    e.course === course && (unit === "all" || e.unit === unit);
  if (question.issues.length)
    return {
      status: "review",
      answer: "",
      reason: question.issues.join(" "),
      references: [],
    };
  const normalized = normalizeStem(question.stem);
  let sameStem = (index.stems.get(course + "|" + normalized) || []).filter(
    eligible,
  );
  let missingBlank = false;
  if (
    !sameStem.length &&
    !question.options.length &&
    !normalized.includes("___") &&
    normalized.length >= 15 &&
    answerFormat(question.stem).hint
  ) {
    sameStem = (
      index.blanklessStems.get(course + "|" + normalized) || []
    ).filter(eligible);
    missingBlank = sameStem.length > 0;
  }
  let exact = sameStem.filter((e) => sameOptions(question, e));
  let textAnswerBridge = false;
  // A text-answer question can be transcribed as MCQ. Accept only an exact
  // stem, an unambiguous literal answer, and no competing choice/image version.
  if (
    !exact.length &&
    question.options.length &&
    sameStem.length &&
    sameStem.every((e) => !e.options.length && !e.needsImage)
  ) {
    exact = sameStem;
    textAnswerBridge = true;
  }
  if (exact.some((e) => e.preferred)) exact = exact.filter((e) => e.preferred);
  if (exact.length) {
    if (exact.some((e) => e.needsImage))
      return {
        status: "review",
        answer: "",
        reason: "此題需要題圖或完整上下文，文字相同不足以確認答案。",
        references: references(exact),
      };
    const answers = exact.map((e) => remapAnswer(question, e));
    if (
      answers.some((a) => !a) ||
      new Set(answers.map((a) => a.signature)).size !== 1
    )
      return {
        status: "review",
        answer: "",
        reason: "題庫答案的填答格式、版本或選項對應不一致，請開啟原題核對。",
        references: references(exact),
      };
    return {
      status: "matched",
      answer: answers[0].answer,
      reason: missingBlank
        ? "填空線未貼出；其餘文字符合題庫，已核對答案一致且符合填答格式。"
        : textAnswerBridge
          ? "題幹符合，題庫的文字答案唯一對應本次選項。"
          : "題幹與選項符合題庫（含已核對的中英文對照），答案已依貼上的選項代號對應。" +
            (question.options.some(
              (o) => optionText(o.text) === "Disk formating",
            )
              ? "已將 Disk formating 的常見拼字辨識為 Disk formatting，保留貼上原文。"
              : ""),
      references: references(exact),
      conditions: [...new Set(exact.flatMap((e) => e.conditions || []))],
    };
  }
  if (unit !== "all") {
    const elsewhere = matchQuestion(question, index, { course, unit: "all" });
    if (elsewhere.status === "matched")
      return {
        ...elsewhere,
        outsideScope: true,
        reason: "此題已收錄於同科目的其他單元，答案已依本次選項順序核對。",
      };
    if (
      elsewhere.status === "review" &&
      !sameStem.length &&
      elsewhere.references.length
    )
      return {
        ...elsewhere,
        reason:
          "所選單元未找到一致題目；其他單元有候選原題，請核對文字與條件。",
      };
  }
  if (sameStem.length)
    return {
      status: "review",
      answer: "",
      reason: question.options.length
        ? "題幹符合，但選項不同；請核對是否抄漏或為不同版本。"
        : "找到同題幹的選擇題，請補齊選項後再比對。",
      references: references(sameStem),
    };
  const firstLine = normalizeStem(question.stem.split("\n")[0]);
  if (firstLine !== normalizeStem(question.stem) && firstLine.length >= 10) {
    const withContext = (
      index.stems.get(course + "|" + firstLine) || []
    ).filter(eligible);
    if (withContext.length)
      return {
        status: "review",
        answer: "",
        reason:
          "找到同題幹，但附加的圖示描述或條件仍需核對，請開啟候選原題確認。",
        references: references(withContext),
      };
  }
  const stem = normalizeStem(question.stem),
    candidates = [];
  for (const e of index.entries) {
    if (!eligible(e)) continue;
    const other = normalizeStem(e.stem);
    if (
      Math.min(stem.length, other.length) /
        Math.max(stem.length, other.length) <
      0.6
    )
      continue;
    const score = dice(stem, other);
    if (score >= 0.74) candidates.push({ e, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length)
    return {
      status: "review",
      answer: "",
      reason: "找到相似題，但文字或條件不同，未直接套用答案。",
      references: references(candidates.map((c) => c.e)),
    };
  return {
    status: "unmatched",
    answer: "",
    reason: "目前選定範圍內沒有找到可確認的題目。",
    references: [],
  };
}
export function matchQuestions(questions, index, scope) {
  return questions.map((question) => ({
    question,
    ...matchQuestion(question, index, scope),
  }));
}

export function formatQuestions(questions) {
  return questions
    .map((q) =>
      `${q.number}. ${q.type ? "【" + q.type + "】" : ""}${q.stem}\n${q.options.map((o) => `${o.label}. ${o.text}`).join("\n")}`.trim(),
    )
    .join("\n\n");
}
export function aiPrompt(questions) {
  return (
    "請解答下列課程練習題，保留原題號，一次回覆「題號｜答案代號＋答案內容｜簡短理由」。答案代號必須依本次選項順序；題目、題圖或選項不完整時請標示「需確認」，不要猜測。這些題目尚未在網站取得可確認答案，不代表已驗證為全新題目。\n\n" +
    formatQuestions(questions)
  );
}
