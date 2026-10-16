import "./choice-answers.js?v=global-dedup-20261016";

export const MAX_QUESTIONS = 30;
export const MAX_TEXT = 80000;
const LETTERS = "ABCDEFGH";
const cleanLine = (text) =>
  text
    .trim()
    .replace(/\*\*([A-H][.)、:]|\([A-H]\))\*\*/gi, "$1")
    .replace(/^\*\*(.+?)\*\*(.*)$/, "$1$2");
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
  /^(?:[-*]\s+)?(?:\(([A-H])\)|\[([A-H])\]|([A-H])[.)、:])\s*(.*)$/i;
const metadata = /^(?:正確答案|參考答案|答案|解答|解析|詳解|說明)\s*[:：]/;
const typePattern =
  /^(?:[【\[(（]\s*)?(單選題?|多選題?|複選題?|填空題?|圖片題?)(?:\s*[】\])）]|\s*[:：])\s*/;

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[_{2,}\d*_*\]|_{2,}/g, "___")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/([\p{Script=Han}])\s+/gu, "$1")
    .replace(/\s+([\p{Script=Han}])/gu, "$1")
    .replace(/\s*([,;:?!()\[\]{}])\s*/g, "$1")
    .trim();
}
export const normalizeStem = (value) =>
  normalizeText(value).replace(/[?？。]+$/, "");
export const optionText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/^(?:\([A-H]\)|\[[A-H]\]|[A-H][.)、:])\s*/i, "")
    .trim();
export const optionKey = (value) => normalizeText(optionText(value));

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
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      cleanLine(line)
        .replace(/^#{1,6}\s*/, "")
        .normalize("NFKC"),
    );
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
    if (/選/.test(q.type) && !q.options.length)
      q.issues.push("選擇題尚未附上選項。");
    if (
      /圖片/.test(q.type) ||
      /\[(?:看不清楚|無法辨識|圖片|題圖)[^\]]*\]|[（(]圖略[）)]/.test(
        q.stem + q.options.map((o) => o.text).join(""),
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
export function expandLibraryQuestion(course, unit, q) {
  if (!q || typeof q !== "object") return [];
  const result = [],
    id = q.id || q.bookmarkId;
  const variants = [
    q,
    ...(Array.isArray(q.sourceVariants) ? q.sourceVariants : []),
  ];
  for (const [i, v] of variants.entries()) {
    const item = toLibraryQuestion(course, unit, v, i === 0, id);
    if (!item) continue;
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
  const stems = new Map();
  for (const entry of entries) {
    const key = entry.course + "|" + normalizeStem(entry.stem);
    if (!stems.has(key)) stems.set(key, []);
    stems.get(key).push(entry);
  }
  return { stems, entries };
}
const sortedOptions = (options) => options.map(optionKey).sort();
function remapAnswer(question, entry) {
  if (!question.options.length)
    return { answer: entry.answer, signature: normalizeText(entry.answer) };
  if (!entry.choiceKey) return null;
  const correct = [...entry.choiceKey].map((letter) =>
    optionKey(entry.options[LETTERS.indexOf(letter)]),
  );
  const mapped = correct.map((text) =>
    question.options.filter((o) => optionKey(o.text) === text),
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
  const sameStem = (
    index.stems.get(course + "|" + normalizeStem(question.stem)) || []
  ).filter(eligible);
  const options = JSON.stringify(
    sortedOptions(question.options.map((o) => o.text)),
  );
  let exact = sameStem.filter(
    (e) => JSON.stringify(sortedOptions(e.options)) === options,
  );
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
        reason: "題庫版本的答案或選項對應不一致，請開啟原題核對。",
        references: references(exact),
      };
    return {
      status: "matched",
      answer: answers[0].answer,
      reason: "題幹與選項符合題庫，答案已依貼上的選項代號對應。",
      references: references(exact),
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
