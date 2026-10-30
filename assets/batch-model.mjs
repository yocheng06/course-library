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
const cleanLine = (text) => {
  const normalized = normalizeUnicode(unescapeBlanks(text))
    .replace(invisible, "")
    .trim();
  // Some copied AI answers bold the complete named question title instead of
  // placing its number on a separate heading line.
  const boldNamed = /\*\*([\p{L}][\p{L}\p{M} _-]{0,30}?)\s+(\d{1,4})[.)、:]\s+(.+?)\*\*/u;
  const heading = normalized.replace(
    boldNamed,
    (_match, _label, number, stem) => `第 ${number} 題 ${stem}`,
  );
  return heading
    .replace(/\*\*([A-H][.)、:]|\([A-H]\))\*\*/gi, "$1")
    .replace(/^\*\*(.+?)\*\*(.*)$/, "$1$2")
    .replace(
      /(^|\s)[◯○●⭕☐☑□■•·✓✔]\uFE0F?\s*(?=(?:\(?[A-H][.)、:]|\[[A-H]\]))/gi,
      "$1",
    );
};
const hasLiteralPath = (line) =>
  /(?:[A-Za-z]:\\|\\\\[^\s\\]+\\)[^\r\n]*$/.test(line);
const header =
  /^(?:第\s*(\d{1,4})\s*題\s*[:：.)、]?|(?:Q(?:uestion)?|題目|題)\s*(\d{1,4})\s*[:：.)、-]?|[（(](\d{1,4})[）)]|(\d{1,4})[.)、](?=\D|$))\s*(.*)$/i;
// AI sometimes emits standalone heading labels such as "Beast 1." or "妖獸 2.".
// Require a letter-only prefix, a separated number and terminal punctuation;
// expressions, decimals and option content remain ordinary question text.
const namedHeader = /^[\p{L}][\p{L}\p{M} _-]{0,30}?\s+(\d{1,4})[.)、:]\s*$/u;
// These two AI transcription labels also occur with the stem on the same line.
// Requiring whitespace after the punctuation avoids splitting decimals such as "CPU 2.6".
const inlineNamedHeader = /^(?:妖獸|Beast)\s+(\d{1,4})[.)、:]\s+(.+)$/iu;
function questionHeader(line) {
  const standard = line.match(header);
  if (standard)
    return {
      number: standard[1] || standard[2] || standard[3] || standard[4],
      text: standard[5],
    };
  const inlineNamed = line.match(inlineNamedHeader);
  if (inlineNamed) return { number: inlineNamed[1], text: inlineNamed[2] };
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
      // Markdown often wraps math fragments in dollar signs. They are display
      // delimiters, not part of an option's answer text.
      .replace(/\$([^$\n]+)\$/g, "$1")
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
  const quotedNumberHint = normalized.match(
    /\((Please\s+enclose\s+numbers\s+in\s+quotation\s+marks(?:,\s*e\.g\.,?\s*"\d+")?)\)$/i,
  );
  if (quotedNumberHint)
    return {
      stem: normalized
        .slice(0, quotedNumberHint.index)
        .trim()
        .replace(/[?？。.!！]+$/u, ""),
      hint: quotedNumberHint[1],
    };
  const englishMatch = normalized.match(
    /\((Please\s+answer\s+in\s+(?:(?:lowercase|uppercase)\s+English|English\s+(?:lowercase|uppercase))(?:,\s*(?:leaving\s+a\s+space\s+between\s+each\s+word|connecting\s+words\s+with\s+hyphens|one\s+space\s+between\s+letters))?)\)$/i,
  );
  if (englishMatch)
    return {
      stem: normalized
        .slice(0, englishMatch.index)
        .trim()
        .replace(/[?？。.!！]+$/u, ""),
      hint: englishMatch[1],
    };
  const match = normalized.match(
    /\((請用(?:小寫英文|大寫英文|英文|數字)回答[\s\S]*)\)$/,
  );
  if (!match) return { stem: normalized, hint: "" };
  const remainder = match[1]
    .replace(/^請用(?:小寫英文|大寫英文|英文|數字)回答/, "")
    .replace(/單字間(?:請)?留-/g, "")
    .replace(/表示形式為/g, "")
    .replace(/請用log/g, "")
    .replace(/不可用lg(?:替代log)?/g, "")
    .replace(/上標(?:請)?用\^/g, "")
    .replace(/下標(?:請)?用_/g, "")
    .replace(/符號請用\{big-theta,theta,big-omega,omega,O,o,?\}/g, "")
    .replace(/(?:字母|單字)間(?:請)?留一個空白/g, "")
    .replace(/單字間(?:請)?用-連接|以連字號連接單字|需要做字母連接的兩個文字用-/g, "")
    .replace(/字母間(?:請)?用-/g, "")
    // Some copied answer-format notes include a parenthesized log example.
    // The instruction is still presentation-only; nested parentheses must not
    // prevent the rest of the question from matching its library entry.
    .replace(/如log_\([^)]+\)\([^)]+\)/gi, "")
    .replace(/(?:符號)?中間不留空白/g, "")
    .replace(/[,;\s()[\]]/g, "");
  if (remainder) return { stem: normalized, hint: "" };
  return {
    stem: normalized
      .slice(0, match.index)
      .trim()
      // Treat a trailing blank with or without a preceding question mark as
      // the same question while retaining the blank slot for blankless lookup.
      .replace(/[?？。]+(?=_{2,}$)/, "")
      .replace(/[?？。]+$/, ""),
    hint: match[1],
  };
}
export const normalizeStem = (value) =>
  answerFormat(value)
    .stem.replace(/使用著空間/g, "使用者空間")
    .replace(/^(?:(?:Beast|妖獸)\s*\d{1,4}\s*[.)、:]\s*)+/iu, "")
    .replace(/[?？。.!！]+$/u, "")
    .trim();
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
  const rawLines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (/^\s*\\{1,2}\s*$/.test(line)) return "";
      // Escaped Markdown (\\* and \\**) occurs when copied from rendered
      // notes. Normalize only structural heading and option lines.
      if (!/^\s*\\?\*(?:\\?\*|\s+[A-H][.)、:])/i.test(line)) return line;
      const structural = line.replace(/\\\*/g, "*");
      return hasLiteralPath(structural)
        ? structural
        : structural.replace(/\\{1,2}\s*$/, "");
    });
  // Markdown exports may add a hard-break slash at the end of a line. Preserve
  // ordinary backslashes, but remove them before a clearly numbered next question.
  const hardBreak = /(?<!\\)\\{1,2}\s*$/;
  const exportedBreaks =
    rawLines.filter((line) => {
      if (!hardBreak.test(line)) return false;
      const heading = questionHeader(cleanLine(line.replace(hardBreak, "")));
      return heading && !heading.text.trim();
    }).length >= 2;
  const nextNonblank = new Array(rawLines.length);
  let nextLine = "";
  for (let i = rawLines.length - 1; i >= 0; i--) {
    nextNonblank[i] = nextLine;
    if (rawLines[i].trim()) nextLine = rawLines[i];
  }
  const cleanedLines = rawLines.map((line, i) => {
    const next = nextNonblank[i];
    // A drive path such as C:\ or C:\notes\ ends in meaningful data, even
    // when the following line starts the next numbered question.
    const literalPath = hasLiteralPath(line);
    const boundaryBreak =
      !literalPath && hardBreak.test(line) && next && questionHeader(cleanLine(next));
    return cleanLine(
      (!literalPath && exportedBreaks) || boundaryBreak ? line.replace(hardBreak, "") : line,
    )
      .replace(/^#{1,6}\s*/, "")
      .normalize("NFKC");
  });
  const tailRequest =
    /^(?:請)?給我(?:全部)?答案(?:[，, ]*(?:並|請)?(?:確定|確認)(?:答案)?正確)?[。.!！]?$/;
  const trailingSearchNote = /^(?:批次)?搜尋題目有問題[。.!！]?\\{0,2}$/;
  if (cleanedLines.some(questionHeader))
    while (
      cleanedLines.length &&
      (!cleanedLines.at(-1) ||
        tailRequest.test(cleanedLines.at(-1)) ||
        trailingSearchNote.test(cleanedLines.at(-1)))
    )
      cleanedLines.pop();
  const lines = cleanedLines.flatMap((line, i) => {
    // A title can be pasted onto the end of the preceding option line.
    // Split only when the preceding text is a complete, labelled option.
    const appended = line.match(
      /^(.*\S)[ \t]+(第\s*\d{1,4}\s*題\s*[:.)、]?\s+.+)$/,
    );
    if (appended && appended[1].match(option)?.[4]?.trim())
      return [appended[1], appended[2]];
    // Markdown transcripts sometimes glue a bold "Beast 11." / "妖獸 11."
    // heading directly to the previous option, without a line break or space.
    // Split only after a complete labeled option so references in a stem stay intact.
    const namedMarker = /\*{0,2}(?:妖獸|Beast)\s+\d{1,4}[.)、:]\*{0,2}\s+/giu;
    for (const marker of line.matchAll(namedMarker)) {
      const before = line.slice(0, marker.index).trimEnd();
      const decorated = marker[0].startsWith("**");
      if (!decorated && marker.index > 0 && !/\s/.test(line[marker.index - 1]))
        continue;
      if (!before.match(option)?.[4]?.trim()) continue;
      const heading = line.slice(marker.index);
      if (!questionHeader(cleanLine(heading))) continue;
      return [before, cleanLine(heading)];
    }
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
    if (line === '[選項未轉錄]') {
      current.expectsOptions = true;
      current.missingOptionContent = true;
      return;
    }
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
    const fragments = q.stem.split("\n");
    const tailStart = fragments.findIndex(line => /^[-*•·]$/.test(line));
    const tail = tailStart > 0 ? fragments.slice(tailStart) : [];
    if (tail.filter(line => /^[-*•·]$/.test(line)).length >= 2 &&
        tail.every(line => /^(?:[-*•·]|svg)$/i.test(line))) {
      q.stem = fragments.slice(0,tailStart).join("\n");
      q.expectsOptions = true;
      q.missingOptionContent = true;
    }
    if(q.missingOptionContent) q.issues.push("選項只剩空白項目或 SVG 標記，請貼上選項文字或提供原題截圖。");
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

function choiceAnswerKey(answer, options) {
  const expected = (globalThis.courseChoiceAnswers || globalThis.window?.courseChoiceAnswers).expectedChoiceKey;
  return expected(answer, options) ||
    (/\r?\n/.test(answer) ? expected(answer.replace(/\r?\n+/g, "、"), options) : null);
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
  const supplied = raw.answerProvided === false ? null : raw.choiceKey;
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
    answer: raw.answerProvided === false ? "" : answer,
    choiceKey: raw.answerProvided !== false && options.length
      ? suppliedValid
        ? supplied
        : choiceAnswerKey(answer, options)
      : null,
    needsImage: Boolean(raw.images?.length || raw.missingContext),
    preferred,
    ...(raw.submissionReview?{reviewGroup:true,reviewPending:raw.submissionReview.status==='pending'}:{}),
    ...(raw.answerProvided === false ? {reviewReason:raw.note || "原題答案尚未確認，請開啟原題核對。"} : {}),
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
  const versions = [stem, ...bilingualParts(stem), ...(translation ? [translation, ...bilingualParts(translation)] : [])];
  for (const version of [...versions]) {
    if (!answerFormat(version).hint) continue;
    const normalized = normalizeText(version);
    const slots = [...normalized.matchAll(/___|(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/gu)];
    if (slots.length === 1) {
      const slot = slots[0];
      versions.push(normalized.slice(0,slot.index)+normalized.slice(slot.index+slot[0].length));
    }
  }
  return [...new Set(versions)];
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
    const checked = q.answerProvided === false ? {...v, answerProvided:false, note:q.note} : v;
    const item = toLibraryQuestion(course, unit, checked, i === 0, id);
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
    const blankless = blanklessStem(entry.stem);
    if (!entry.options.length && blankless !== null) {
      const blanklessKey = entry.course + "|" + blankless;
      if (!blanklessStems.has(blanklessKey))
        blanklessStems.set(blanklessKey, []);
      blanklessStems.get(blanklessKey).push(entry);
    }
  }
  return { stems, blanklessStems, entries };
}
function blanklessStem(value, allowMissing = false) {
  // The input needs a recognized fill instruction before recovering a missing
  // slot. A source entry's explicit blank is sufficient without an extra hint.
  if (allowMissing && !answerFormat(value).hint) return null;
  const normalized = normalizeStem(value);
  const slots = [
    ...normalized.matchAll(/___|(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/gu),
  ];
  if (slots.length === 0) return allowMissing ? normalized : null;
  if (slots.length !== 1) return null;
  const slot = slots[0];
  return normalizeStem(
    normalized.slice(0, slot.index) +
    normalized.slice(slot.index + slot[0].length)
  );
}
function fillBlankCount(value) {
  return [
    ...normalizeStem(value).matchAll(
      /___|(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/gu,
    ),
  ].length;
}
function withoutFillBlanks(value) {
  return normalizeStem(
    normalizeStem(value).replace(
      /___|(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/gu,
      "",
    ),
  );
}
function fillAnswerParts(answer, count) {
  if (typeof answer !== "string" || !answer.trim()) return null;
  if (count <= 1) return [answer.trim()];
  const text = normalizeUnicode(answer).trim();
  // Slash-separated slots can themselves contain comma-separated arrays.
  // Never split ordinary spaces inside compound terms such as high availability.
  for (const separator of [/\s*\/\s*/, /\s*[\r\n]+\s*/, /\s*[、，,;；]\s*/]) {
    const parts = text.split(separator).map(part => part.trim());
    if (parts.length === count && parts.every(Boolean)) return parts;
  }
  return null;
}
function answerFitsBlankCount(answer, count) {
  return fillAnswerParts(answer,count) !== null;
}
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function filledBlankValues(questionStem, entryStem) {
  const expected = normalizeStem(entryStem);
  const slots = [
    ...expected.matchAll(/___|(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/gu),
  ];
  if (!slots.length) return null;
  const pieces = [];
  let cursor = 0;
  for (const slot of slots) {
    pieces.push(
      escapeRegex(expected.slice(cursor, slot.index)),
      "([\\s\\S]+?)",
    );
    cursor = slot.index + slot[0].length;
  }
  pieces.push(escapeRegex(expected.slice(cursor)));
  const match = normalizeStem(questionStem).match(
    new RegExp(`^${pieces.join("")}$`, "u"),
  );
  return match ? match.slice(1) : null;
}
function matchesFilledAnswer(question, entry) {
  if (question.options.length || entry.options.length) return null;
  const captured = filledBlankValues(question.stem, entry.stem);
  if (!captured) return null;
  const expectedVersions = [entry.answer];
  if (captured.length === 1)
    expectedVersions.push(...(entry.answerAliases || []));
  for (const [version, answer] of expectedVersions.entries()) {
    const expected =
      captured.length === 1
        ? [answer]
        : answer.split(/\s*[、，,;；]\s*/).filter(Boolean);
    if (expected.length !== captured.length) continue;
    const actualKeys = captured.map(normalizeText).sort();
    const expectedKeys = expected.map(normalizeText).sort();
    if (actualKeys.every((value, i) => value === expectedKeys[i]))
      return { correctedTypo: version > 0 };
  }
  return null;
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
  if (typeof entry.answer !== "string" || !entry.answer.trim()) return null;
  if (!question.options.length) {
    const { hint } = answerFormat(question.stem);
    if (
      hint &&
      (/[\p{Script=Han}]/u.test(entry.answer) ||
        (/(?:小寫英文|lowercase\s+English|English\s+lowercase)/i.test(hint) &&
          /[A-Z]/.test(entry.answer)) ||
        (/(?:大寫英文|uppercase\s+English|English\s+uppercase)/i.test(hint) &&
          /[a-z]/.test(entry.answer)) ||
        (/請用數字回答/.test(hint) &&
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(entry.answer.trim())) ||
        (/(?:單字間(?:請)?留-|單字間(?:請)?用-連接|字母間(?:請)?用-|以連字號連接單字|需要做字母連接的兩個文字用-|connecting\s+words\s+with\s+hyphens)/i.test(hint) && /[\s_]/.test(entry.answer)) ||
        (/one\s+space\s+between\s+letters/i.test(hint) && /\s{2,}/.test(entry.answer)) ||
        (/中間不留空白/.test(hint) && /\s/.test(entry.answer)) ||
        (/不可用lg/.test(hint) && /\blg/.test(entry.answer)))
    )
      return null;
    const count = fillBlankCount(question.stem);
    const parts = count > 1 ? fillAnswerParts(entry.answer,count) : null;
    if (count > 1 && !parts) return null;
    return { answer: entry.answer, signature: parts ? JSON.stringify(parts.map(normalizeText)) : normalizeText(entry.answer) };
  }
  const key = entry.options.length &&
    (entry.choiceKey || choiceAnswerKey(entry.answer, entry.options));
  const correct = entry.options.length
    ? key && [...key].map((letter) => LETTERS.indexOf(letter))
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
      entries.map((e) => [e.id, { id: e.id, unit: e.unit, stem: e.stem,
        ...(e.showCandidateAnswer?{candidateAnswer:e.options.length&&choiceAnswerKey(e.answer,e.options)?[...choiceAnswerKey(e.answer,e.options)].map(letter=>e.options[letter.charCodeAt(0)-65]).join('；'):e.answer}:{}),
      }]),
    ).values(),
  ].slice(0, 3);
const completeStem = value => normalizeStem(value).replace(/(?<![A-Za-z0-9_])\[\d+\](?![A-Za-z0-9_])/gu,"___").replace(/\s*___\s*/g,"___");
export function matchQuestion(question, index, { course, unit = "all", completeOnly = false } = {}) {
  const eligible = (e) =>
    e.course === course && (unit === "all" || e.unit === unit);
  if (question.issues.length) {
    const candidates = matchQuestion({...question, issues: []}, index, {course, unit, completeOnly});
    return {
      status: "review",
      answer: "",
      reason: question.issues.join(" "),
      references: candidates.references || [],
    };
  }
  const normalized = normalizeStem(question.stem);
  const blankCount = question.options.length ? 0 : fillBlankCount(question.stem);
  let sameStem = (index.stems.get(course + "|" + normalized) || []).filter(
    eligible,
  );
  let missingBlank = false;
  if (
    !completeOnly &&
    !blankCount &&
    !sameStem.some(e => !e.options.length) &&
    !question.options.length &&
    normalized.length > 0 &&
    answerFormat(question.stem).hint
  ) {
    const blankless = blanklessStem(question.stem, true);
    const recovered = blankless === null
      ? []
      : (index.blanklessStems.get(course + "|" + blankless) || []).filter(eligible);
    sameStem = [...sameStem, ...recovered];
    missingBlank = recovered.length > 0;
  }
  let exact = [];
  let blankMarkerMatch = false;
  let repeatedFillStem = false;
  if (blankCount) {
    const blankless = withoutFillBlanks(question.stem);
    const candidates = index.entries.filter(
      (entry) =>
        eligible(entry) &&
        !entry.options.length &&
        withoutFillBlanks(entry.stem) === blankless &&
        (!completeOnly || completeStem(entry.stem) === completeStem(question.stem)),
    );
    const preferred = !completeOnly && candidates.some((entry) => entry.preferred)
      ? candidates.filter((entry) => entry.preferred)
      : candidates;
    const candidateIds = new Set(candidates.map((entry) => entry.id));
    if (candidateIds.size > 1) {
      // Multiple stored records are usable only when every version agrees.
      // Do not let a preferred record conceal conflicting answers or conditions.
      if (candidates.some(entry => fillBlankCount(entry.stem) !== blankCount) ||
          new Set(candidates.map(entry => JSON.stringify((entry.conditions || []).map(normalizeText).sort()))).size !== 1)
        return {
        status: "review",
        answer: "",
        reason: "相同題幹的題庫版本在填空數或成立條件上有差異，請核對原題。",
        references: references(candidates),
      };
      repeatedFillStem = true;
    }
    if (candidateIds.size >= 1) {
      const versions = repeatedFillStem ? candidates : preferred;
      if (versions.some((entry) => !answerFitsBlankCount(entry.answer, blankCount)))
        return {
          status: "review",
          answer: "",
          reason: "題幹唯一符合，但答案項目數與填空數不一致，請核對原題。",
          references: references(versions),
        };
      exact = versions;
      blankMarkerMatch = true;
    }
  } else {
    exact = sameStem.filter((e) => sameOptions(question, e));
  }
  let filledAnswerMatch = false;
  let correctedFilledTypo = false;
  if (!completeOnly && !exact.length && !question.options.length) {
    const filled = index.entries
      .filter(eligible)
      .map((entry) => ({
        entry,
        result: matchesFilledAnswer(question, entry),
      }))
      .filter((item) => item.result);
    const preferred = filled.some((item) => item.entry.preferred)
      ? filled.filter((item) => item.entry.preferred)
      : filled;
    if (preferred.length) {
      exact = preferred.map((item) => item.entry);
      filledAnswerMatch = true;
      correctedFilledTypo = preferred.some((item) => item.result.correctedTypo);
    }
  }
  let textAnswerBridge = false;
  // A text-answer question can be transcribed as MCQ. Accept only an exact
  // stem, an unambiguous literal answer, and no competing choice/image version.
  if (
    !completeOnly &&
    !exact.length &&
    question.options.length &&
    sameStem.length &&
    sameStem.every((e) => !e.options.length && !e.needsImage)
  ) {
    exact = sameStem;
    textAnswerBridge = true;
  }
  // A changed distractor can become another correct answer. Only a complete
  // option-set match (including verified aliases) may inherit a choice answer.
  // Complete lookup compares answers only within the version actually supplied.
  // A different distractor set or question format remains a separate version.
  const reviewVersions=[...new Set(completeOnly ? exact : [...sameStem,...exact])];
  if(reviewVersions.some(entry=>entry.reviewGroup)){
    const answers=reviewVersions.map(entry=>remapAnswer(question,entry));
    if(reviewVersions.some(entry=>entry.needsImage)||question.options.length&&reviewVersions.some(entry=>!sameOptions(question,entry))||answers.some(answer=>!answer)||new Set(answers.map(answer=>answer?.signature)).size!==1||new Set(reviewVersions.map(entry=>JSON.stringify((entry.conditions||[]).map(normalizeText).sort()))).size!==1)
      return {status:'review',answer:'',reason:'此題有另行收錄的投稿版本，答案、選項、作答格式或成立條件仍有差異，請核對下方各版本答案。',references:references(reviewVersions.slice().sort((a,b)=>Number(b.reviewPending)-Number(a.reviewPending)).map(entry=>({...entry,showCandidateAnswer:true})))};
    exact=reviewVersions;
    if (!question.options.length) repeatedFillStem=true;
  }
  if (!completeOnly && !repeatedFillStem && exact.some((e) => e.preferred)) exact = exact.filter((e) => e.preferred);
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
      (completeOnly && new Set(exact.map(e => JSON.stringify((e.conditions || []).map(normalizeText).sort()))).size !== 1) ||
      answers.some((a) => !a) ||
      new Set(answers.map((a) => a.signature)).size !== 1
    )
      return {
        status: "review",
        answer: "",
        reason: [...new Set(exact.map(e=>e.reviewReason).filter(Boolean))].join(" ") || "題庫答案的填答格式、版本或選項對應不一致，請開啟原題核對。",
        references: references(exact),
      };
    return {
      status: "matched",
      answer: answers[0].answer,
      ...(exact.some(entry=>entry.reviewPending)?{pendingReview:true}:{}),
      choiceKey: question.options.length ? answers[0].signature : null,
      reason: repeatedFillStem
        ? "題幹與填空數精確符合，各筆題庫紀錄的答案、作答格式及成立條件一致。"
        : blankMarkerMatch
        ? "移除填空標記後與唯一題庫題幹精確符合，答案格式與填空數已核對。"
        : missingBlank
        ? "填空標記格式不同或未貼出；其餘文字符合題庫，已核對答案一致且符合填答格式。"
        : textAnswerBridge
          ? "題幹符合，題庫的文字答案唯一對應本次選項。"
          : filledAnswerMatch
            ? "題庫答案已直接寫在題幹中，題幹與答案均符合已收錄題目。" +
              (correctedFilledTypo ? "已辨識題幹中的拼字差異。" : "")
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
    const elsewhere = matchQuestion(question, index, { course, unit: "all", completeOnly });
    if (elsewhere.status === "matched")
      return {
        ...elsewhere,
        outsideScope: true,
        reason: "此題已收錄於同科目的其他單元，答案已依本次選項順序核對。",
      };
    if (
      elsewhere.status === "review" &&
      !sameStem.length &&
      elsewhere.references.length &&
      elsewhere.references.every((reference) => reference.unit !== unit)
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

// Public batch lookup has exactly two outcomes; internal candidate matching stays reusable.
export function matchRecordedQuestions(questions, index, scope) {
  return matchQuestions(questions,index,{...scope,completeOnly:true}).map(row => {
    if (row.status === 'matched') return row;
    return {...row,status:'unmatched',answer:'',choiceKey:null,conditions:[],outsideScope:false};
  });
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


export function applyBuiltinOverrides(entries,course,overrides=[]) {
  if(!Array.isArray(overrides))throw new Error('Invalid built-in updates');
  const replacements=new Map(), replacedIds=new Set();
  for(const row of overrides){
    const q=row?.question,id=q?.id || q?.bookmarkId;
    if(!id || replacements.has(id) || replacedIds.has(id) || !entries.some(e=>e.course===course && e.id===id && e.unit===row.unit))throw new Error('Invalid built-in question');
    if(row.deleted===true){
      if(q.aliases!==undefined && (!Array.isArray(q.aliases)||q.aliases.some(alias=>typeof alias!=='string')))throw new Error('Invalid built-in question');
      replacedIds.add(id);
      for(const alias of q.aliases||[])replacedIds.add(alias);
      continue;
    }
    if(typeof(q.stem??q.q)!=='string' || typeof(q.answer??q.a)!=='string' || !Array.isArray(q.options??q.opts) ||
       (q.options??q.opts).some(v=>typeof v!=='string'))throw new Error('Invalid built-in question');
    const expanded=expandLibraryQuestion(course,row.unit,q);if(!expanded.length)throw new Error('Empty built-in question');
    replacements.set(id,expanded);replacedIds.add(id);
    for(const alias of q.aliases || [])replacedIds.add(alias);
  }
  return [...entries.filter(e=>e.course!==course || !replacedIds.has(e.id)),...[...replacements.values()].flat()];
}
