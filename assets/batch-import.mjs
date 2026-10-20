import {
  parseQuestions,
  formatQuestions,
  normalizeText,
  MAX_TEXT,
  MAX_QUESTIONS,
} from "./batch-model.mjs?v=batch-math-and-option-variants-20261017";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const LETTERS = "ABCDEFGH";
const stemKeys = [
  "stem",
  "question",
  "q",
  "題幹",
  "题干",
  "題目",
  "题目",
  "text",
  "prompt",
  "questionText",
  "question_text",
  "題目內容",
];
const optionKeys = ["options", "opts", "choices", "選項", "选项"];
const containers = [
  "questions",
  "items",
  "題目",
  "题目",
  "題庫",
  "题库",
  "units",
  "courses",
  "data",
];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const keyName = (value) =>
  String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_.-]/g, "");
const field = (value, keys) => {
  const key = keys.find((key) => own(value, key));
  return key === undefined ? undefined : value[key];
};
const labelMatch = (value) =>
  String(value)
    .normalize("NFKC")
    .match(/^\s*(?:\(([A-H])\)|\[([A-H])\]|([A-H])[.)、:])\s*/i);

function fail(message) {
  throw new Error(message);
}
function bounded(questions) {
  if (!questions.length) fail("檔案內沒有題目。");
  if (questions.length > MAX_QUESTIONS)
    fail(`每次最多比對 ${MAX_QUESTIONS} 題，請分批匯入；沒有截掉或略過題目。`);
  return questions;
}
function choice(value, index, explicitLabel) {
  let text = value;
  let label = explicitLabel;
  if (record(value)) {
    text = field(value, ["text", "content", "value", "option", "選項", "选项"]);
    label ??= field(value, ["label", "key", "id"]);
  }
  if (typeof text !== "string" && typeof text !== "number")
    fail(`第 ${index + 1} 個選項缺少文字。`);
  text = String(text).trim();
  const prefix = labelMatch(text);
  if (prefix) {
    const inText = (prefix[1] || prefix[2] || prefix[3]).toUpperCase();
    if (
      label !== undefined &&
      String(label)
        .normalize("NFKC")
        .toUpperCase()
        .replace(/[.：:、)]$/, "") !== inText
    )
      fail("選項代號與選項文字的代號不同，請先核對。");
    label = inText;
    // Only the prefix is normalized; preserve mathematical superscripts in the text.
    text = text.slice(prefix[0].length);
  }
  label =
    label === undefined
      ? LETTERS[index]
      : String(label)
          .normalize("NFKC")
          .trim()
          .toUpperCase()
          .replace(/[.：:、)]$/, "");
  if (!/^[A-H]$/.test(label || ""))
    fail("選項代號需為 A～H，每題最多 8 個選項。");
  return { label, text };
}
function choices(value) {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[\[{]/.test(trimmed)) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        fail("選項欄位的 JSON 格式不正確。");
      }
    } else value = trimmed.split(/\r?\n/).filter((line) => line.trim());
  }
  if (Array.isArray(value)) return value.map((value, i) => choice(value, i));
  if (record(value))
    return Object.entries(value).map(([label, value], i) =>
      choice(value, i, label),
    );
  fail("選項需為陣列、A～H 對照物件，或一行一個選項的文字。");
}
function questionType(value) {
  const type = String(value ?? "").trim();
  if (/圖片|图片|^image$/i.test(type)) return "圖片題";
  if (
    /多選|多选|複選|复选|^(?:multiple|multi|multiple[-_]choice|checkbox)$/i.test(
      type,
    )
  )
    return "多選題";
  if (/單選|单选|^(?:single|single[-_]choice|radio)$/i.test(type))
    return "單選題";
  if (/填空|文字|^(?:fill|fill[-_]in|blank|text)$/i.test(type)) return "填空題";
  return "";
}
function fromRecord(value, index) {
  if (record(value.question) && !own(value, "stem") && !own(value, "q"))
    value = value.question;
  const stem = field(value, stemKeys);
  if (typeof stem !== "string" || !stem.trim())
    fail(
      `第 ${index + 1} 筆缺少題幹，請使用 stem、question、q 或「題目」欄位。`,
    );
  let options = field(value, optionKeys);
  if (
    options !== undefined &&
    LETTERS.split("").some(
      (key) =>
        own(value, key) && value[key] !== null && String(value[key]).trim(),
    )
  )
    fail(
      `第 ${index + 1} 筆同時有 options／opts／choices 與 A～H，請保留一種選項格式。`,
    );
  if (options === undefined) {
    const columns = Object.keys(value).filter((key) => /^[A-H]$/.test(key));
    if (columns.length)
      options = Object.fromEntries(columns.map((key) => [key, value[key]]));
  }
  const type = questionType(field(value, ["type", "題型", "题型"]));
  const image = field(value, ["images", "image", "img", "題圖", "题图"]);
  const hasImage = Array.isArray(image) ? image.length > 0 : Boolean(image);
  const number = String(
    field(value, ["number", "questionNumber", "no", "題號", "题号"]) ??
      index + 1,
  );
  if (!/^\d{1,4}$/.test(number) || Number(number) < 1)
    fail(`第 ${index + 1} 筆題號需為 1～9999 的數字。`);
  return {
    number,
    stem:
      stem.trim() +
      (hasImage && !stem.includes("[題圖未轉錄]") ? "\n[題圖未轉錄]" : ""),
    options: choices(options),
    type,
    issues: [],
  };
}
export function questionsFromJSON(value) {
  const questions = [];
  function visit(node, depth = 0) {
    if (depth > 8) fail("JSON 層次過深，請改用 questions 題目陣列。");
    if (Array.isArray(node)) {
      if (!node.length) fail("題目陣列是空的。");
      for (const item of node) visit(item, depth + 1);
    } else if (record(node)) {
      const stem = field(node, stemKeys);
      if (typeof stem === "string" || record(node.question)) {
        questions.push(fromRecord(node, questions.length));
      } else {
        const keys = containers.filter((key) => own(node, key));
        if (keys.length > 1)
          fail(
            "JSON 同時有多個題目清單欄位，請保留一個 questions／units／data 清單。",
          );
        const key = keys[0];
        if (!key)
          fail(
            `第 ${questions.length + 1} 筆不是可辨識的題目；未略過任何資料。`,
          );
        visit(node[key], depth + 1);
      }
    } else if (typeof node === "string") {
      questions.push(...parseQuestions(node));
    } else
      fail(`第 ${questions.length + 1} 筆不是題目物件或文字；未略過任何資料。`);
    if (questions.length > MAX_QUESTIONS) bounded(questions);
  }
  visit(value);
  return bounded(questions);
}

// RFC 4180 quoted cells, including embedded newlines, quotes and delimiters.
export function readDelimited(raw, delimiter = ",") {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((cell) => cell.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (quoted) {
      if (char === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === delimiter) pushCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && raw[i + 1] === "\n") i++;
      pushRow();
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (closed) {
      if (!/[ \t]/.test(char))
        fail("CSV／TSV 引號結束後有多餘文字，請檢查欄位分隔。");
    } else {
      if (char === '"') fail("CSV／TSV 欄位中的引號需以兩個雙引號表示。");
      cell += char;
    }
  }
  if (quoted) fail("CSV／TSV 有未關閉的雙引號，請檢查檔案。");
  if (cell || row.length || closed) pushRow();
  return rows;
}
const stemHeaders = new Set(stemKeys.map(keyName));
function csvHeader(key) {
  const name = keyName(key);
  if (stemHeaders.has(name)) return "stem";
  if (optionKeys.map(keyName).includes(name)) return "options";
  if (["number", "questionnumber", "no", "題號", "题号"].includes(name))
    return "number";
  if (["type", "題型", "题型"].includes(name)) return "type";
  if (["images", "image", "題圖", "题图"].includes(name)) return "images";
  const option = name.match(/^(?:option|choice|選項|选项)?([a-h])$/);
  return option ? option[1].toUpperCase() : null;
}
function questionsFromTable(raw, delimiter) {
  const rows = readDelimited(raw, delimiter);
  if (rows.length < 2) fail("CSV／TSV 需有欄位標題與至少一筆題目。");
  const headers = rows.shift().map(csvHeader);
  if (!headers.includes("stem"))
    fail(
      "找不到題目欄位；標題請用「題目」、stem、question 或 q，選項可用 A、B、C、D 欄。",
    );
  const known = headers.filter(Boolean);
  if (new Set(known).size !== known.length)
    fail("CSV／TSV 有重複的題目或選項欄位，請保留一組。");
  return bounded(
    rows.map((row, i) => {
      if (row.length !== headers.length)
        fail(
          `第 ${i + 2} 列有 ${row.length} 欄，標題有 ${headers.length} 欄；請核對引號與分隔符號。`,
        );
      const value = {};
      headers.forEach((key, j) => {
        if (key) value[key] = row[j];
      });
      if (
        value.options?.trim() &&
        LETTERS.split("").some((key) => value[key]?.trim())
      )
        fail(`第 ${i + 2} 列同時有 options 與 A～H，請保留一種選項格式。`);
      if (!value.options?.trim()) {
        delete value.options;
        for (const key of LETTERS) if (!value[key]?.trim()) delete value[key];
      }
      if (!value.number?.trim()) delete value.number;
      return fromRecord(value, i);
    }),
  );
}

function jsonLiteral(source, start) {
  if (!/[\[{]/.test(source[start] || ""))
    fail("HTML 題庫資料不是 JSON，請先匯出成 JSON；系統不執行檔案內的程式。");
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "[" || char === "{") depth++;
    else if ((char === "]" || char === "}") && --depth === 0) {
      try {
        return JSON.parse(source.slice(start, i + 1));
      } catch {
        fail(
          "HTML 內的題庫資料不是有效 JSON，請先匯出成 JSON。未執行檔案內的程式。",
        );
      }
    }
  }
  fail("HTML 內的題庫 JSON 不完整。");
}
function htmlQuestions(raw, doc) {
  if (!doc?.createElement) fail("目前無法讀取 HTML，請改用文字或 JSON 格式。");
  // A detached template is inert: never attach imported nodes to the live page,
  // execute scripts, instantiate custom elements, or load image/iframe URLs.
  const template = doc.createElement("template");
  template.innerHTML = raw;
  const root = template.content;
  const embedded = root.querySelector(
    "script#course-data, script#question-data, script#quiz-data",
  );
  if (embedded) {
    try {
      return questionsFromJSON(JSON.parse(embedded.textContent));
    } catch (error) {
      if (error instanceof SyntaxError) fail("HTML 內的題庫 JSON 格式不正確。");
      throw error;
    }
  }
  for (const script of root.querySelectorAll("script")) {
    const source = script.textContent;
    if (script.getAttribute("type")?.toLowerCase() === "application/json") {
      let data;
      try {
        data = JSON.parse(source);
      } catch {
        /* Unrelated invalid metadata is not question data. */
      }
      if (
        Array.isArray(data) ||
        (record(data) && containers.some((key) => own(data, key)))
      )
        return questionsFromJSON(data);
    }
    const match =
      /\b(?:const|let|var)\s+(?:UNITS|COURSES|questions|questionBank|quizData)\s*=\s*/.exec(
        source,
      );
    if (match)
      return questionsFromJSON(
        jsonLiteral(source, match.index + match[0].length),
      );
  }
  for (const node of root.querySelectorAll(
    "script,style,noscript,template,iframe,object,embed,nav,header,footer,button,select,input,[hidden],.answer,.explanation,.solution,.correct-answer,[data-answer],[data-explanation]",
  ))
    node.remove();
  function text(node) {
    if (node.nodeType === 3) return node.textContent;
    const tag = node.tagName?.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "canvas")
      return " [題圖未轉錄] ";
    if (tag === "br") return "\n";
    if (tag === "math") {
      const tex = node.querySelector(
        'annotation[encoding="application/x-tex"]',
      );
      return tex ? tex.textContent : " [看不清楚：MathML 數學式需轉錄] ";
    }
    const content = [...node.childNodes].map(text).join("");
    if (tag === "sup") return `^{${content}}`;
    if (tag === "sub") return `_{${content}}`;
    if (tag === "li") {
      const parent = node.parentElement;
      if (
        parent?.tagName.toLowerCase() === "ol" &&
        /^[aA]$/.test(parent.getAttribute("type") || "")
      ) {
        const i = [...parent.children].indexOf(node);
        return `\n${LETTERS[i] || "?"}. ${content}\n`;
      }
    }
    return /^(?:p|div|section|article|h[1-6]|li|ul|ol|pre|tr|blockquote)$/.test(
      tag || "",
    )
      ? `\n${content}\n`
      : content;
  }
  const blocks = [
    ...root.querySelectorAll(".question,.question-card,[data-question]"),
  ].filter(
    (node) =>
      !node.parentElement?.closest(".question,.question-card,[data-question]"),
  );
  if (blocks.length)
    return bounded(blocks.flatMap((node) => parseQuestions(text(node))));
  const visible = text(root).trim();
  if (
    !/(?:^|\n)\s*(?:第\s*\d+\s*題|(?:題目|Question|Q)\s*\d+|\d+[.)、])/i.test(
      visible,
    )
  )
    fail(
      "HTML 找不到可分題的內容。請使用含題號與選項的靜態 HTML，或內嵌 JSON 的題庫；只連到外部題庫的網頁需先匯出題目。",
    );
  return parseQuestions(visible);
}

// Round-trip validation prevents a structured field containing a standalone
// question/answer marker from silently becoming a different question.
export function questionsToText(questions) {
  bounded(questions);
  const text = formatQuestions(
    questions.map((q) => ({
      ...q,
      stem: q.stem + (q.expectsOptions && !q.options.length ? "\n選項：" : ""),
    })),
  );
  if (text.length > MAX_TEXT) fail("題目文字超過 80,000 字，請分批匯入。");
  const check = parseQuestions(text);
  if (
    check.length !== questions.length ||
    check.some((q, i) => {
      const original = questions[i];
      return (
        q.number !== original.number ||
        normalizeText(q.stem) !== normalizeText(original.stem) ||
        q.options.length !== original.options.length ||
        q.options.some(
          (o, j) =>
            o.label !== original.options[j].label ||
            normalizeText(o.text) !== normalizeText(original.options[j].text),
        )
      );
    })
  )
    fail(
      "題幹或選項內含有會被誤認為題號、選項或答案標籤的獨立行，請調整該行後再匯入；未略過任何題目。",
    );
  return text;
}
export function detectFormat(raw, name = "") {
  const extension = name.split(".").at(-1).toLowerCase();
  if (
    name &&
    !["txt", "md", "markdown", "json", "csv", "tsv", "html", "htm"].includes(
      extension,
    )
  )
    fail(
      "支援 TXT、Markdown、JSON、CSV、TSV、HTML；PDF、Word 和圖片請先轉成文字。",
    );
  if (["json", "csv", "tsv"].includes(extension)) return extension;
  if (["html", "htm"].includes(extension)) return "html";
  if (/^\{|^\[\s*(?:[\[\{"\d\]-]|true\b|false\b|null\b)/.test(raw))
    return "json";
  if (
    /^(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|html\b|body\b|head\b|div\b|section\b|article\b|p\b|h[1-6]\b|script\b|ol\b|ul\b|table\b)/i.test(
      raw,
    )
  )
    return "html";
  for (const [delimiter, format] of [
    ["\t", "tsv"],
    [",", "csv"],
  ]) {
    const firstLine = raw.split(/\r?\n/, 1)[0];
    if (!firstLine.includes(delimiter)) continue;
    try {
      if (
        readDelimited(firstLine, delimiter)[0]?.some((key) =>
          stemHeaders.has(keyName(key)),
        )
      )
        return format;
    } catch {
      /* A quoted multiline cell is not a usable header. */
    }
  }
  return "text";
}
export function parseBatchInput(
  raw,
  { name = "", document: doc = globalThis.document } = {},
) {
  if (typeof raw !== "string" || !raw.trim())
    fail("請先貼上題目或選擇題目檔案。");
  raw = raw.replace(/^\uFEFF/, "").trim();
  if (raw.length > MAX_FILE_BYTES)
    fail("檔案文字過長，請分批匯入（單次最多 2 MB）。");
  // Accept complete fenced JSON/CSV/HTML pasted from AI without stripping
  // arbitrary code fences from ordinary questions.
  const fenced = raw.match(/^```(json|csv|tsv|html)\s*\n([\s\S]*?)\n```$/i);
  if (fenced && (!name || /\.(?:txt|md|markdown)$/i.test(name))) {
    name = `pasted.${fenced[1].toLowerCase()}`;
    raw = fenced[2];
  }
  const format = detectFormat(raw, name);
  let questions;
  if (format === "json") {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      fail("JSON 格式不正確，請檢查引號、逗號及括號。");
    }
    questions = questionsFromJSON(data);
  } else if (format === "csv" || format === "tsv")
    questions = questionsFromTable(raw, format === "csv" ? "," : "\t");
  else if (format === "html") questions = htmlQuestions(raw, doc);
  else questions = parseQuestions(raw);
  bounded(questions);
  for (const q of questions) {
    if (
      /<(?:img|svg|canvas)\b|!\[[^\]]*\]\s*\(/i.test(
        q.stem + "\n" + q.options.map((o) => o.text).join("\n"),
      ) &&
      !q.stem.includes("[題圖未轉錄]")
    )
      q.stem += "\n[題圖未轉錄]";
  }
  // Numbering is retained here. Conflicts across files/drafts are resolved only
  // when explicitly applying the import, with a visible count of changed numbers.
  const text = questionsToText(questions);
  return { questions: parseQuestions(text), text, format };
}
export function prepareImport(
  existing,
  imported,
  mode = "append",
  options = {},
) {
  if (!["append", "replace"].includes(mode)) fail("請選擇加入或取代目前文字。");
  const before =
    mode === "append" && existing.trim()
      ? parseBatchInput(existing, options).questions
      : [];
  const questions = bounded([...before, ...imported.map((q) => ({ ...q }))]);
  const used = new Set(before.map((q) => q.number));
  let next = Math.max(0, ...questions.map((q) => Number(q.number))) + 1;
  let renumbered = 0;
  for (const q of questions.slice(before.length)) {
    if (used.has(q.number)) {
      q.number = String(next++);
      renumbered++;
    }
    if (Number(q.number) > 9999) fail("接續編號會超過 9999，請先調整題號。");
    used.add(q.number);
  }
  const text = questionsToText(questions);
  return {
    text,
    questions: parseQuestions(text),
    added: imported.length,
    renumbered,
  };
}
export function decodeFile(bytes) {
  const data = new Uint8Array(bytes);
  const encoding =
    data[0] === 0xff && data[1] === 0xfe
      ? "utf-16le"
      : data[0] === 0xfe && data[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(data);
  } catch {
    fail("檔案文字編碼無法讀取，請另存為 UTF-8 後再匯入。");
  }
}
export async function readBatchFiles(files, options = {}) {
  const list = [...files];
  if (!list.length) fail("請先選擇題目檔案。");
  if (list.length > MAX_QUESTIONS)
    fail("單次最多選擇 30 個檔案，合計最多 30 題。");
  if (list.reduce((size, file) => size + file.size, 0) > MAX_FILE_BYTES)
    fail("單次匯入的檔案合計最多 2 MB，請分批匯入。");
  // All files must parse successfully before the draft can be changed.
  const parsed = await Promise.all(
    list.map(async (file) => {
      try {
        return {
          ...parseBatchInput(decodeFile(await file.arrayBuffer()), {
            ...options,
            name: file.name,
          }),
          name: file.name,
        };
      } catch (error) {
        fail(`${file.name}：${error.message}`);
      }
    }),
  );
  const questions = bounded(parsed.flatMap((file) => file.questions));
  return {
    questions,
    files: parsed.map(({ name, format, questions }) => ({
      name,
      format,
      count: questions.length,
    })),
  };
}
