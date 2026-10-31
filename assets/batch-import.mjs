import {resolveQuestionImages, inheritQuestionImages} from "./batch-images.mjs?v=image-identity-20261031";
import {
  parseQuestions,
  formatQuestions,
  normalizeText,
  MAX_TEXT,
  MAX_QUESTIONS,
} from "./batch-model.mjs?v=image-identity-20261031";
import JSON5 from "./vendor/json5.mjs?v=2.2.3";

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
  "題目文字",
  "問題",
  "问题",
  "問題內容",
  "問題敘述",
  "題幹內容",
  "Question Content",
];
const optionKeys = [
  "options",
  "option",
  "opts",
  "choices",
  "選項",
  "选项",
  "answerOptions",
  "answerChoices",
  "alternatives",
  "選項內容",
  "選項列表",
];
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
  "quiz",
  "quizData",
  "questionBank",
  "records",
  "rows",
  "題庫內容",
  "題目列表",
  "題目清單",
];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const keyName = (value) =>
  String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_.:：-]/g, "");
const field = (value, keys) => {
  const actual = Object.keys(value);
  const matches = keys.flatMap((key) =>
    actual.filter((name) => keyName(name) === keyName(key)),
  );
  const nonempty = matches.find(
    (key) =>
      value[key] !== null &&
      value[key] !== undefined &&
      (typeof value[key] !== "string" || value[key].trim()) &&
      (!Array.isArray(value[key]) || value[key].length),
  );
  const selected = nonempty ?? matches[0];
  return selected === undefined ? undefined : value[selected];
};
const labelMatch = (value) =>
  String(value)
    .normalize("NFKC")
    .match(/^\s*(?:\(([A-H])\)|\[([A-H])\]|([A-H])[.)、:])\s*/i);

function fail(message) {
  throw new Error(message);
}
function mappingError(headers, rows, format, message) {
  if (headers.length > 100)
    fail("欄位超過 100 欄，請先匯出題幹、題號與選項欄再匯入。");
  const error = new Error(message);
  error.mapping = { headers, rows, format, hasHeader: format !== "json" };
  throw error;
}
function jsonMapping(records, message) {
  const headers = [
    ...new Set(records.flatMap((record) => Object.keys(record))),
  ];
  if (headers.length > 100)
    fail(message + " 欄位超過 100 個，請先匯出題目與選項欄。");
  mappingError(
    headers,
    records.map((record) => headers.map((key) => record[key])),
    "json",
    message,
  );
}
function readJSON(raw, warnings = []) {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      const value = JSON5.parse(raw);
      warnings.push("已整理 JSON 的引號、註解或結尾逗號，請核對預覽。");
      return value;
    } catch (error) {
      const where = error.lineNumber
        ? `（第 ${error.lineNumber} 行、第 ${error.columnNumber} 字）`
        : "";
      fail(
        `JSON 格式不正確${where}，請檢查未關閉的引號或括號；不會執行檔案內的程式。`,
      );
    }
  }
}
function optionColumn(key, numericBase = 1) {
  const name = keyName(key).replace(/^選項內容/, "選項");
  const match = name.match(
    /^(?:(?:option|choice|選項|选项)[(（]?)?([a-h]|[0-8])[)）]?$/,
  );
  if (!match) return null;
  return /^[a-h]$/.test(match[1])
    ? match[1].toUpperCase()
    : LETTERS[Number(match[1]) - numericBase] || null;
}
function numericBase(keys) {
  return keys.some((key) =>
    /^(?:option|choice|選項|选项)?0$/.test(keyName(key)),
  )
    ? 0
    : 1;
}
function optionFields(value) {
  const keys = Object.keys(value);
  const lowerColumns = keys.includes("a") && keys.includes("b");
  const base = numericBase(keys);
  // Legacy question-bank exports use lowercase `a` for the answer.
  return keys.filter(
    (key) => optionColumn(key, base) && (!/^[a-h]$/.test(key) || lowerColumns),
  );
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
    text = field(value, [
      "text",
      "content",
      "value",
      "option",
      "選項",
      "选项",
      "選項內容",
      "optionText",
      "description",
    ]);
    label ??= field(value, ["label", "key", "代號", "代号"]);
    const identifier = field(value, ["id"]);
    if (label === undefined && /^[A-H]$/i.test(String(identifier)))
      label = identifier;
    if (text === undefined && Object.keys(value).length === 1) {
      const [key, content] = Object.entries(value)[0];
      if (optionColumn(key)) {
        label ??= optionColumn(key);
        text = content;
      }
    }
  }
  if (typeof text !== "string" && typeof text !== "number")
    fail(`第 ${index + 1} 個選項缺少文字。`);
  text = String(text).trim();
  const prefix = labelMatch(text);
  if (prefix) {
    const inText = (prefix[1] || prefix[2] || prefix[3]).toUpperCase();
    if (
      label !== undefined &&
      (optionColumn(label) ??
        String(label)
          .normalize("NFKC")
          .toUpperCase()
          .replace(/[.：:、)]$/, "")) !== inText
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
  label = optionColumn(label) ?? label;
  if (!/^[A-H]$/.test(label || ""))
    fail("選項代號需為 A～H，每題最多 8 個選項。");
  return { label, text };
}
function choices(value, warnings = []) {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\{|^\[\s*(?:[\[\{"'\d\]-]|true\b|false\b|null\b)/.test(trimmed)) {
      try {
        value = readJSON(trimmed, warnings);
      } catch {
        fail("選項欄位的 JSON 格式不正確。");
      }
    } else value = trimmed.split(/\r?\n/).filter((line) => line.trim());
  }
  if (Array.isArray(value)) {
    const labels = value.map((item) =>
      record(item)
        ? field(item, ["label", "key", "代號", "代号"])
        : String(item).match(/^\s*([0-8])[.)、:：]\s*/)?.[1],
    );
    const base = labels[0] === 0 || labels[0] === "0" ? 0 : 1;
    const sequential = labels.every(
      (label, i) => String(label) === String(i + base),
    );
    if (sequential && value.length)
      warnings.push("數字選項代號已依原順序整理為 A、B…，請核對預覽。");
    return value.map((item, i) => {
      if (sequential)
        return record(item)
          ? choice(item, i, LETTERS[i])
          : choice(String(item).replace(/^\s*[0-8][.)、:：]\s*/, ""), i);
      return choice(item, i);
    });
  }
  if (record(value)) {
    const base = numericBase(Object.keys(value));
    if (Object.keys(value).some((key) => /^\d$/.test(key)))
      warnings.push("數字選項代號已依原順序整理為 A、B…，請核對預覽。");
    return Object.entries(value).map(([label, value], i) =>
      choice(value, i, optionColumn(label, base) ?? label),
    );
  }
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
const BEAST_QUESTION_HEADING = /^\s*(?:\*\*)?妖獸\s*(\d{1,4})\s*[.．。)、:：）](?:\*\*)?\s*/u;
const stripBeastQuestionHeading = (value) =>
  String(value ?? "").replace(BEAST_QUESTION_HEADING, "").trim();

function fromRecord(value, index, warnings = []) {
  const nested = field(value, ["question"]);
  if (record(nested) && !field(value, ["stem", "q"])) value = nested;
  const stem = field(value, stemKeys);
  if (typeof stem !== "string" || !stem.trim())
    fail(
      `第 ${index + 1} 筆缺少題幹；目前欄位為「${Object.keys(value).slice(0, 10).join("、")}」。題幹可用 stem、question、q、「題目」或「問題」。`,
    );
  let options = field(value, optionKeys);
  if (
    options !== undefined &&
    optionFields(value).some(
      (key) =>
        own(value, key) && value[key] !== null && String(value[key]).trim(),
    )
  )
    fail(
      `第 ${index + 1} 筆同時有 options／opts／choices 與 A～H，請保留一種選項格式。`,
    );
  if (options === undefined) {
    const columns = optionFields(value);
    if (columns.length)
      options = Object.fromEntries(columns.map((key) => [key, value[key]]));
  }
  const type = questionType(field(value, ["type", "題型", "题型"]));
  const image = field(value, ["images", "image", "img", "題圖", "题图"]);
  const hasImage = Array.isArray(image) ? image.length > 0 : Boolean(image);
  const normalizedStem = stem
    .trim()
    .replace(/^(?:題目|題幹|Question|Stem)\s*[:：]\s*/i, "");
  const beastHeading = normalizedStem.match(BEAST_QUESTION_HEADING);
  const number = String(
    field(value, ["number", "questionNumber", "no", "題號", "题号"]) ??
      beastHeading?.[1] ??
      index + 1,
  );
  if (!/^\d{1,4}$/.test(number) || Number(number) < 1)
    fail(`第 ${index + 1} 筆題號需為 1～9999 的數字。`);
  return {
    number,
    stem:
      stripBeastQuestionHeading(normalizedStem) +
      (hasImage && !stem.includes("[題圖未轉錄]") ? "\n[題圖未轉錄]" : ""),
    options: (() => {
      try {
        return choices(options, warnings);
      } catch (error) {
        fail(`第 ${index + 1} 筆的選項：${error.message}`);
      }
    })(),
    type,
    issues: [],
  };
}
export function questionsFromJSON(value, warnings = []) {
  const questions = [];
  function visit(node, depth = 0) {
    if (depth > 8) fail("JSON 層次過深，請改用 questions 題目陣列。");
    if (Array.isArray(node)) {
      if (!node.length) fail("題目陣列是空的。");
      if (
        node.every(record) &&
        node.some(
          (item) =>
            typeof field(item, stemKeys) === "string" &&
            field(item, optionKeys) === undefined &&
            !optionFields(item).length &&
            Object.entries(item).some(
              ([key, value]) =>
                /answer|choice|option|選項/i.test(key) &&
                Array.isArray(value) &&
                value.length >= 2,
            ),
        )
      )
        jsonMapping(node, "有題幹，但無法確認哪一欄是選項，可在下方手動指定。");
      if (
        node.every(record) &&
        !node.some(
          (item) =>
            typeof field(item, stemKeys) === "string" ||
            record(field(item, ["question"])) ||
            Object.keys(item).some((key) =>
              containers.some((alias) => keyName(alias) === keyName(key)),
            ),
        )
      )
        jsonMapping(node, "找不到題幹欄位，可在下方手動指定題幹與選項。");
      for (const item of node) visit(item, depth + 1);
    } else if (record(node)) {
      const stem = field(node, stemKeys);
      if (typeof stem === "string" || record(field(node, ["question"]))) {
        questions.push(fromRecord(node, questions.length, warnings));
      } else {
        const keys = Object.keys(node).filter((key) =>
          containers.some((alias) => keyName(alias) === keyName(key)),
        );
        if (keys.length > 1)
          fail(
            "JSON 同時有多個題目清單欄位，請保留一個 questions／units／data 清單。",
          );
        const key = keys[0];
        if (!key) {
          const message = `第 ${questions.length + 1} 筆找不到題幹或題目清單；可手動指定欄位，未略過任何資料。`;
          if (!questions.length) jsonMapping([node], message);
          fail(message);
        }
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
  return optionColumn(key);
}
function questionsFromRows(rows, warnings = [], format = "表格") {
  if (rows.length < 2) fail("CSV／TSV 需有欄位標題與至少一筆題目。");
  const labels = rows[0];
  const headers = labels.map(csvHeader);
  if (headers.includes("options") && !labels.includes("b"))
    labels.forEach((label, i) => {
      if (label === "a") headers[i] = null;
    });
  rows = rows.slice(1);
  if (!headers.includes("stem"))
    mappingError(
      labels,
      [labels, ...rows],
      format.startsWith("Markdown")
        ? "markdown"
        : format.startsWith("HTML")
          ? "html"
          : "csv",
      `找不到題目欄位；目前標題為「${labels.slice(0, 12).join("、")}」。可在下方手動對應，或使用「題目」、「問題」、Question Text、stem 等名稱。`,
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
      try {
        return fromRecord(value, i, warnings);
      } catch (error) {
        fail(`${format}第 ${i + 2} 列：${error.message}`);
      }
    }),
  );
}
function delimiterFor(raw, preferred) {
  const firstLine = raw.split(/\r?\n/, 1)[0];
  const candidates = [...new Set([preferred, ",", "\t", ";"].filter(Boolean))];
  return candidates
    .map((delimiter, order) => {
      try {
        const cells = readDelimited(firstLine, delimiter)[0] || [];
        const headers = cells.map(csvHeader);
        return {
          delimiter,
          score:
            (headers.includes("stem") ? 100 : 0) +
            headers.filter(Boolean).length * 3 +
            (cells.length > 1 ? 1 : 0) -
            order / 10,
        };
      } catch {
        return { delimiter, score: -1 };
      }
    })
    .sort((a, b) => b.score - a.score)[0].delimiter;
}
function questionsFromTable(raw, preferred, warnings) {
  return questionsFromRows(
    readDelimited(raw, delimiterFor(raw, preferred)),
    warnings,
    "CSV／TSV ",
  );
}

function markdownCells(line) {
  const cells = [];
  let cell = "",
    ticks = 0;
  line = line.trim();
  if (line.startsWith("|")) line = line.slice(1);
  if (/(?<!\\)\|$/.test(line)) line = line.slice(0, -1);
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\" && line[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (char === "`") {
      const run = line.slice(i).match(/^`+/)[0];
      ticks = ticks === run.length ? 0 : ticks || run.length;
      cell += run;
      i += run.length - 1;
    } else if (char === "|" && !ticks) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}
function tableCell(value) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/^\*\*([\s\S]*)\*\*$/, "$1")
    .replace(/^`([^`]+)`$/, "$1")
    .replace(/&(?:lt|gt|amp|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
      const key = entity.slice(1, -1).toLowerCase();
      const known = {
        lt: "<",
        gt: ">",
        amp: "&",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      if (known[key] !== undefined) return known[key];
      const code = key.startsWith("#x")
        ? parseInt(key.slice(2), 16)
        : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
}
function markdownTables(raw) {
  const lines = raw.split(/\r?\n/);
  const tables = [],
    used = new Set();
  for (let i = 0; i + 1 < lines.length; i++) {
    const header = markdownCells(lines[i]),
      separator = markdownCells(lines[i + 1]);
    if (
      header.length < 2 ||
      separator.length !== header.length ||
      !separator.every((cell) => /^:?-{2,}:?$/.test(cell))
    )
      continue;
    const rows = [header.map(tableCell)];
    used.add(i);
    used.add(i + 1);
    i += 2;
    for (; i < lines.length && lines[i].trim() && lines[i].includes("|"); i++) {
      rows.push(markdownCells(lines[i]).map(tableCell));
      used.add(i);
    }
    tables.push(rows);
    i--;
  }
  if (
    tables.length &&
    lines.some(
      (line, i) =>
        !used.has(i) &&
        /^\s*(?:第\s*\d+\s*題|(?:題目|Question|Q)\s*\d+|\d+[.)、])\s*\S/i.test(
          line,
        ),
    )
  )
    fail(
      "同一份內容同時有表格與一般編號題目，請分開匯入，避免漏掉表格外的題目。",
    );
  return tables;
}

function jsonLiteral(source, start, warnings) {
  start += source
    .slice(start)
    .match(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/)[0].length;
  if (!/[\[{]/.test(source[start] || ""))
    fail(
      "HTML 題庫資料不是物件或陣列，請先匯出成 JSON；系統不執行檔案內的程式。",
    );
  let depth = 0,
    quote = "",
    escaped = false,
    comment = "";
  for (let i = start; i < source.length; i++) {
    const char = source[i],
      next = source[i + 1];
    if (comment === "line") {
      if (char === "\n") comment = "";
      continue;
    }
    if (comment === "block") {
      if (char === "*" && next === "/") {
        comment = "";
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
    } else if (char === "/" && next === "/") {
      comment = "line";
      i++;
    } else if (char === "/" && next === "*") {
      comment = "block";
      i++;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "[" || char === "{") depth++;
    else if ((char === "]" || char === "}") && --depth === 0) {
      const tail = source
        .slice(i + 1)
        .replace(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, "");
      if (/^(?:\.|\?\.|\[|\(|\+|-|\*|\/(?![/*])|&&|\|\||\?\?|\?|,)/.test(tail))
        fail(
          "HTML 題庫在資料後還有程式運算，請先匯出運算完成的 JSON；不會執行檔案內的程式。",
        );
      return readJSON(source.slice(start, i + 1), warnings);
    }
  }
  fail("HTML 內的題庫資料不完整，請檢查未關閉的括號或引號。");
}
function bankShape(value, depth = 0) {
  if (depth > 3) return false;
  if (Array.isArray(value))
    return value.length > 0 && bankShape(value[0], depth + 1);
  return (
    record(value) &&
    (typeof field(value, stemKeys) === "string" ||
      Object.keys(value).some(
        (key) =>
          containers.some((alias) => keyName(alias) === keyName(key)) &&
          bankShape(value[key], depth + 1),
      ))
  );
}
function htmlQuestions(raw, doc, warnings = []) {
  if (!doc?.createElement) fail("目前無法讀取 HTML，請改用文字或 JSON 格式。");
  // A detached template is inert: never attach imported nodes to the live page,
  // execute scripts, instantiate custom elements, or load image/iframe URLs.
  const template = doc.createElement("template");
  template.innerHTML = raw.replace(/^\s*<!doctype[^>]*>/i, "");
  const root = template.content;
  const embedded = root.querySelector(
    "script#course-data, script#question-data, script#quiz-data",
  );
  if (embedded) {
    try {
      return questionsFromJSON(
        readJSON(embedded.textContent, warnings),
        warnings,
      );
    } catch (error) {
      if (error instanceof SyntaxError) fail("HTML 內的題庫 JSON 格式不正確。");
      throw error;
    }
  }
  // Saved quiz pages use `const questions = []` for page controls, not bank
  // data. Their rendered form is the authoritative source of questions.
  const savedQuizForm = root.querySelector("#practice-quiz-form,#challenge-quiz-form");
  for (const script of savedQuizForm ? [] : root.querySelectorAll("script")) {
    const source = script.textContent;
    if (script.getAttribute("type")?.toLowerCase() === "application/json") {
      let data;
      try {
        data = readJSON(source);
      } catch {
        /* Unrelated invalid metadata is not question data. */
      }
      if (bankShape(data)) return questionsFromJSON(data, warnings);
    }
    const match =
      /(?:\b(?:const|let|var)\s+|\b(?:window|globalThis)\.)(?:UNITS|COURSES|questions|allQuestions|questionBank|quizData|questionData)\s*=\s*/i.exec(
        source,
      );
    if (match)
      return questionsFromJSON(
        jsonLiteral(source, match.index + match[0].length, warnings),
        warnings,
      );
  }
  // Saved practice forms encode blanks as text inputs. Ignore saved answers.
  for (const input of root.querySelectorAll('.question-block input.text-answer,.question-block input[data-question-id]'))
    input.replaceWith(doc.createTextNode(' ____________ '));
  for (const node of root.querySelectorAll(
    "script,style,noscript,template,iframe,object,embed,nav,footer,button,select,input:not([type=radio]):not([type=checkbox]),[hidden],[aria-hidden=true],.answer,.explanation,.solution,.correct-answer,[data-answer],[data-explanation]",
  ))
    node.remove();
  function text(node) {
    if (node.nodeType === 3) return node.textContent;
    const tag = node.tagName?.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "canvas")
      return " [題圖未轉錄] ";
    if (tag === "br") return "\n";
    if (tag === "input") return "";
    if (tag === "td" || tag === "th") return " " + [...node.childNodes].map(text).join("") + " ";
    if (tag === "math") {
      const tex = node.querySelector(
        'annotation[encoding="application/x-tex"]',
      );
      return tex ? tex.textContent : " [看不清楚：MathML 數學式需轉錄] ";
    }
    const content = [...node.childNodes].map(text).join("");
    if (tag === "sup") return `^{${content}}`;
    if (tag === "sub") return `_{${content}}`;
    if (
      tag === "label" &&
      node.querySelector('input[type="radio"],input[type="checkbox"]')
    ) {
      const input = node.querySelector(
        'input[type="radio"],input[type="checkbox"]',
      );
      const owner =
        input.closest(".question,.question-card,.question-block,[data-question],form") || root;
      const group = [
        ...owner.querySelectorAll('input[type="radio"],input[type="checkbox"]'),
      ].filter(
        (other) => other.getAttribute("name") === input.getAttribute("name"),
      );
      const label = /^[A-H]$/i.test(input.getAttribute("value") || "")
        ? input.getAttribute("value").toUpperCase()
        : LETTERS[group.indexOf(input)];
      return `\n${labelMatch(content.trim()) ? "" : (label || "?") + ". "}${content.trim()}\n`;
    }
    if (tag === "li") {
      const parent = node.parentElement;
      if (
        parent &&
        ((parent.tagName.toLowerCase() === "ol" &&
          /^[aA]$/.test(parent.getAttribute("type") || "")) ||
          parent.matches(".options,.choices,[data-options]"))
      ) {
        const i = [...parent.children].indexOf(node);
        return `\n${labelMatch(content.trim()) ? "" : (LETTERS[i] || "?") + ". "}${content.trim()}\n`;
      }
    }
    return /^(?:p|div|section|article|h[1-6]|li|ul|ol|pre|tr|blockquote)$/.test(
      tag || "",
    )
      ? `\n${content}\n`
      : content;
  }
  // CCSA challenge pages place one or more questions inside a shared group
  // block. Parse each child separately and prepend its shared stem so tables
  // and diagrams remain part of every question used by batch lookup.
  const challengeForm = root.querySelector("#challenge-quiz-form");
  if (challengeForm) {
    const topLevelBlocks = [...challengeForm.querySelectorAll(".question-block")].filter(
      (node) => !node.parentElement?.closest(".question-block"),
    );
    if (topLevelBlocks.length) {
      const imported = [], imageSources = [];
      for (const block of topLevelBlocks) {
        const grouped = block.classList.contains("group-block");
        const shared = grouped ? block.querySelector(".group-stem") : null;
        const children = grouped
          ? [...block.querySelectorAll(".sub-question-block")]
          : [block];
        if (!children.length)
          fail("挑戰模式題組找不到小題，請確認 HTML 檔案完整。沒有匯入任何題目。");
        const context = shared ? text(shared).replace(/\n{3,}/g, "\n\n").trim() : "";
        for (const child of children) {
          const promptNodes = [...child.querySelectorAll(".question-text")];
          const prompt = promptNodes
            .map((node) => text(node).replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)[0]
            ?.replace(/^\s*\d+[.．、)]\s*/, "");
          if (!prompt)
            fail(`第 ${imported.length + 1} 題缺少題幹，沒有匯入任何題目。`);
          const optionLabels = [...child.querySelectorAll("label")].filter((label) =>
            label.querySelector('input[type="radio"],input[type="checkbox"]'),
          );
          const options = optionLabels
            .map((label) =>
              label.textContent
                .replace(/\s+/g, " ")
                .trim()
                .replace(/^[A-H][.、．:：)）]\s*/i, ""),
            )
            .filter(Boolean);
          const inputs = [...child.querySelectorAll('input[type="radio"],input[type="checkbox"],input.text-answer')];
          const types = new Set(inputs.map((input) => input.type));
          const inferredTextAnswer = !inputs.length && /_{3,}|\[__\d+__\]/.test(prompt);
          if ((!inputs.length && !inferredTextAnswer) || types.size > 1)
            fail(`第 ${imported.length + 1} 題的作答欄位無法辨識，沒有匯入任何題目。`);
          const inputType = inferredTextAnswer ? "text" : [...types][0];
          if (inputType !== "text" && (options.length !== inputs.length || options.length < 2 || options.length > 8))
            fail(`第 ${imported.length + 1} 題的選項格式無法辨識，沒有匯入任何題目。`);
          imageSources.push([...(shared?.querySelectorAll("img") || []),...child.querySelectorAll("img")].map(image=>image.getAttribute("src") || ""));
          const stem = [context, prompt].filter(Boolean).join("\n\n");
          imported.push(
            `${imported.length + 1}. 【${inputType === "radio" ? "單選題" : inputType === "checkbox" ? "多選題" : "填空題"}】${stem}${options.length ? `\n${options.map((option, index) => `${LETTERS[index]}. ${option}`).join("\n")}` : ""}`,
          );
        }
      }
      return parseQuestions(imported.join("\n\n")).map((q,i)=>({...q,imageSources:imageSources[i]}));
    }
  }
  const tableQuestions = [];
  for (const table of root.querySelectorAll("table")) {
    const rows = [...table.querySelectorAll("tr")].filter(
      (row) => row.closest("table") === table,
    );
    if (!rows.length) continue;
    const cells = rows.map((row) =>
      [...row.children].filter((cell) => /^(TH|TD)$/.test(cell.tagName)),
    );
    if (!cells[0].some((cell) => csvHeader(text(cell).trim()) === "stem")) {
      if (
        !tableQuestions.length &&
        root.querySelectorAll("table").length === 1 &&
        cells[0].some((cell) => cell.tagName === "TH")
      )
        mappingError(
          cells[0].map((cell) => text(cell).trim()),
          cells.map((row) => row.map((cell) => text(cell).trim())),
          "html",
          "HTML 表格找不到題幹欄位，可在下方手動對應。",
        );
      continue;
    }
    if (
      cells
        .flat()
        .some(
          (cell) =>
            Number(cell.getAttribute("colspan") || 1) !== 1 ||
            Number(cell.getAttribute("rowspan") || 1) !== 1,
        )
    )
      fail("HTML 題目表格有合併儲存格，請取消合併或改匯出 CSV，避免欄位錯位。");
    tableQuestions.push(
      ...questionsFromRows(
        cells.map((row) => row.map((cell) => text(cell).trim())),
        warnings,
        "HTML 表格 ",
      ),
    );
    table.remove();
  }
  const blocks = [
    ...root.querySelectorAll(".question,.question-card,.question-block,[data-question]"),
  ].filter(
    (node) =>
      !node.parentElement?.closest(".question,.question-card,.question-block,[data-question]") &&
      (!node.matches(".question-block") || /(?:^|\n)\s*(?:(?:妖獸|Beast)\s+\d+[.)、:]|第\s*\d+\s*題|(?:題目|Question|Q)\s*\d+|\d+[.)、])/i.test(text(node))),
  );
  if (blocks.length) {
    const parsed = blocks.flatMap((node) => {
      const sibling = node.nextElementSibling;
      const content =
        text(node) +
        (sibling?.matches(".options,.choices,[data-options]")
          ? text(sibling)
          : "");
      const questions=parseQuestions(content);
      if(questions.length===1){
        questions[0].imageSources=[...node.querySelectorAll('img'),...(sibling?.matches('.options,.choices,[data-options]') ? sibling.querySelectorAll('img') : [])].map(image=>image.getAttribute('src') || '');
        if(!questions[0].type && node.querySelector('input[type="checkbox"]')) questions[0].type='多選題';
        else if(!questions[0].type && node.querySelector('input[type="radio"]')) questions[0].type='單選題';
      }
      return questions;
    });
    return bounded([...tableQuestions, ...parsed]);
  }
  const visible = text(root).trim();
  if (tableQuestions.length) {
    const hasOutsideQuestions =
      /(?:^|\n)\s*(?:第\s*\d+\s*題|(?:題目|Question|Q)\s*\d+|\d+[.)、])\s*\S/i.test(
        visible,
      );
    return bounded([
      ...tableQuestions,
      ...(hasOutsideQuestions ? parseQuestions(visible) : []),
    ]);
  }
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
      stem: q.stem + (q.missingOptionContent ? "\n[選項未轉錄]" : "") + (q.expectsOptions && !q.options.length ? "\n選項：" : ""),
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
    ![
      "txt",
      "md",
      "markdown",
      "json",
      "json5",
      "csv",
      "tsv",
      "html",
      "htm",
    ].includes(extension)
  )
    fail(
      "支援 TXT、Markdown、JSON、CSV、TSV、HTML；PDF、Word 和圖片請先轉成文字。",
    );
  if (extension === "json5") return "json";
  if (["json", "csv", "tsv"].includes(extension)) return extension;
  if (["html", "htm"].includes(extension)) return "html";
  if (/^\{|^\[\s*(?:[\[\{"'\d\]-]|true\b|false\b|null\b)/.test(raw))
    return "json";
  if (
    /^(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|html\b|body\b|head\b|div\b|section\b|article\b|p\b|h[1-6]\b|script\b|ol\b|ul\b|table\b)/i.test(
      raw,
    )
  )
    return "html";
  if (/^\/(?:\/|\*)/.test(raw)) {
    try {
      if (bankShape(readJSON(raw))) return "json";
    } catch {
      /* Ordinary text may begin with a comment. */
    }
  }
  if (markdownTables(raw).length) return "markdown";
  for (const [delimiter, format] of [
    ["\t", "tsv"],
    [",", "csv"],
    [";", "csv"],
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
  if (!/^\s*(?:第\s*\d+\s*題|(?:題目|Question|Q)\s*\d+|\d+[.)、])/i.test(raw)) {
    for (const delimiter of ["\t", ";", ","]) {
      const lines = raw.split(/\r?\n/).filter((line) => line.trim());
      if (
        lines.length < 2 ||
        !lines[0].includes(delimiter) ||
        /^[A-H][.)、:：]/.test(lines[1].trim())
      )
        continue;
      try {
        const rows = readDelimited(raw, delimiter);
        if (
          rows[0]?.length > 1 &&
          rows[0].every((cell) => cell.length <= 40 && !/[?？]/.test(cell)) &&
          rows.every((row) => row.length === rows[0].length)
        )
          return delimiter === "\t" ? "tsv" : "csv";
      } catch {
        /* Normal text can contain commas and quotes. */
      }
    }
  }
  return "text";
}
function normalizeTranscript(raw, warnings) {
  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    兩: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const number = (value) => {
    if (/^\d+$/.test(value)) return value;
    if (!/[十百千]/.test(value))
      return [...value].map((char) => digits[char]).join("");
    let sum = 0,
      current = 0;
    for (const char of value) {
      const unit = { 十: 10, 百: 100, 千: 1000 }[char];
      if (unit) {
        sum += (current || 1) * unit;
        current = 0;
      } else current = digits[char];
    }
    return String(sum + current);
  };
  const normalized = raw
    .split(/\r?\n/)
    .map((line) => {
      // Normalize explicit question labels only; ordinary numeric lists and
      // mathematical expressions inside a stem retain their meaning.
      let clean = line.replace(
        /^(\s*)\*\*((?:問題|问题|題目|题目|題號|题号|第|Question\b|Q[.#])[\s\S]*?)\*\*\s*$/i,
        "$1$2",
      );
      clean = clean.replace(
        /^(\s*(?:#{1,6}\s*)?)(?:第\s*([\d零〇一二兩两三四五六七八九十百千]+)\s*[題题]|(?:問題|问题|題目|题目|題號|题号)\s*[:：#]?\s*([\d零〇一二兩两三四五六七八九十百千]+)|(?:Question\s+(?:No\.?\s*)?[#.]?|Q[.#])\s*(\d+))\s*[:：.)、-]?\s*/i,
        (_match, prefix, first, second, english) =>
          `${prefix}題目 ${number(first || second || english)}. `,
      );
      clean = clean
        .replace(/^(\s*)(?:题目|题干)\s*[:：]/, "$1題幹：")
        .replace(/^(\s*)(?:选项|Choices)\s*[:：]/i, "$1選項：");
      clean = clean.replace(
        /^(\s*)(?:Correct\s+Answer|Answer|Solution|Explanation|Rationale)\s*[:：]/i,
        "$1解析：",
      );
      return clean.replace(
        /^(\s*(?:[-*+]\s*)?)([A-H])\s+(?:\.(?!\.)|[)、:：])\s*/i,
        "$1$2. ",
      );
    })
    .join("\n");
  if (normalized !== raw.replace(/\r\n?/g, "\n"))
    warnings.push("已整理題號、選項代號或答案標籤的常見排版差異。");
  return normalized;
}
export function parseBatchInput(
  raw,
  { name = "", document: doc = globalThis.document } = {},
) {
  if (typeof raw !== "string" || !raw.trim())
    fail("請先貼上題目或選擇題目檔案。");
  const warnings = [];
  raw = raw.replace(/^[\uFEFF\u200B\u2060]+/, "").trim();
  if (raw.length > MAX_FILE_BYTES)
    fail("檔案文字過長，請分批匯入（單次最多 2 MB）。");
  // Accept complete fenced JSON/CSV/HTML pasted from AI without stripping
  // arbitrary code fences from ordinary questions.
  const fenced = raw.match(
    /^```(json5?|csv|tsv|html|markdown|md|text|txt)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i,
  );
  if (fenced && (!name || /\.(?:txt|md|markdown)$/i.test(name))) {
    const extension = (fenced[1] || "txt")
      .toLowerCase()
      .replace("json5", "json")
      .replace("text", "txt");
    name = `pasted.${extension}`;
    raw = fenced[2];
  } else if (!name || /\.(?:txt|md|markdown)$/i.test(name)) {
    const blocks = [
      ...raw.matchAll(
        /```(json5?|csv|tsv|html)[ \t]*\r?\n([\s\S]*?)\r?\n```/gi,
      ),
    ];
    if (blocks.length === 1) {
      const block = blocks[0],
        outside =
          raw.slice(0, block.index) + raw.slice(block.index + block[0].length);
      if (
        !/(?:^|\n)\s*(?:第\s*\d+\s*題|(?:題目|Question|Q)\s*\d+|\d+[.)、])/i.test(
          outside,
        )
      ) {
        raw = block[2];
        name = `pasted.${block[1].toLowerCase().replace("json5", "json")}`;
        warnings.push("已讀取資料區塊；區塊外的說明文字未用於查題。");
      }
    }
  }
  if (
    (!name || /\.(?:txt|md|markdown)$/i.test(name)) &&
    /^(?:以下(?:是|為|为)|這是|这是|Here\s+(?:is|are)|JSON\s*[:：]|題庫(?:資料|內容)?\s*[:：])/i.test(
      raw,
    )
  ) {
    const start = raw.search(/(?:^|\n)\s*[\[{]/);
    if (start >= 0) {
      const candidate = raw.slice(start).trim();
      try {
        if (bankShape(readJSON(candidate))) {
          raw = candidate;
          name = "pasted.json";
          warnings.push("已讀取說明文字後的題庫資料，請核對題數。");
        }
      } catch {
        /* Keep genuine questions containing a JSON example as text. */
      }
    }
  }
  const format = detectFormat(raw, name);
  let questions;
  if (format === "json") {
    const data = readJSON(raw, warnings);
    questions = questionsFromJSON(data, warnings);
  } else if (format === "csv" || format === "tsv")
    questions = questionsFromTable(
      raw,
      format === "csv" ? "," : "\t",
      warnings,
    );
  else if (format === "markdown")
    questions = bounded(
      markdownTables(raw).flatMap((rows) =>
        questionsFromRows(rows, warnings, "Markdown 表格 "),
      ),
    );
  else if (format === "html") questions = htmlQuestions(raw, doc, warnings);
  else questions = parseQuestions(normalizeTranscript(raw, warnings));
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
  return {
    questions: parseQuestions(text).map((q,i)=>({...q,...(questions[i]?.imageSources?.length ? {imageSources:questions[i].imageSources} : {})})),
    text,
    format,
    warnings: [...new Set(warnings)],
  };
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
      ? inheritQuestionImages(parseBatchInput(existing, options).questions, options.imageQuestions)
      : [];
  const questions = bounded([...before, ...inheritQuestionImages(imported,options.imageQuestions).map((q) => ({ ...q }))]);
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
    questions: parseQuestions(text).map((q,i)=>({...q,...(questions[i]?.imageHashes ? {imageHashes:questions[i].imageHashes} : {})})),
    added: imported.length,
    renumbered,
  };
}
export function resolveImportMapping(mapping, selection) {
  const count = mapping.headers.length;
  const valid = (index) =>
    Number.isInteger(index) && index >= 0 && index < count;
  if (!valid(selection.stem)) fail("請選擇題幹欄位。");
  const options = selection.options ?? -1,
    number = selection.number ?? -1;
  const columns = selection.columns || [];
  if (columns.length > 8) fail("每題最多 8 個選項欄位。");
  const selected = [selection.stem, options, number, ...columns].filter(
    (index) => index !== -1,
  );
  if (
    selected.some((index) => !valid(index)) ||
    new Set(selected).size !== selected.length
  )
    fail("同一欄不能同時作為題幹、題號或選項，請調整欄位對應。");
  if (options !== -1 && columns.length)
    fail("請在「整組選項」與「分開的選項欄」中選擇一種。");
  const rows = mapping.rows.slice(
    mapping.format !== "json" && selection.hasHeader !== false ? 1 : 0,
  );
  const records = bounded(rows).map((row, i) => {
    if (row.length !== count)
      fail(`第 ${i + 1} 筆欄位數與標題不一致，請檢查分隔符號或引號。`);
    return {
      stem: row[selection.stem],
      number:
        number === -1 || row[number] === "" || row[number] == null
          ? i + 1
          : row[number],
      options:
        options !== -1
          ? row[options]
          : columns.map((column) => {
              const label = csvHeader(mapping.headers[column])?.match(
                /^[A-H]$/,
              )?.[0];
              return { ...(label ? { label } : {}), text: row[column] };
            }),
      images: field(
        Object.fromEntries(mapping.headers.map((key, j) => [key, row[j]])),
        ["images", "image", "img", "題圖", "题图"],
      ),
      type: field(
        Object.fromEntries(mapping.headers.map((key, j) => [key, row[j]])),
        ["type", "題型", "题型"],
      ),
    };
  });
  const batch = parseBatchInput(JSON.stringify(records));
  return {
    ...batch,
    format: mapping.format,
    warnings: [...batch.warnings, "已依你指定的欄位讀取，請檢查題幹與選項。"],
  };
}
export function decodeFile(bytes, { warnings = [] } = {}) {
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
    if (encoding === "utf-8") {
      try {
        const text = new TextDecoder("big5", { fatal: true }).decode(data);
        if (/[\u3400-\u9fff]/.test(text) && !text.includes("\0")) {
          warnings.push("檔案使用 Big5 編碼讀取，請核對中文是否正確。");
          return text;
        }
      } catch {
        /* Preserve the explicit encoding error if Big5 is also invalid. */
      }
    }
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
  const outcomes = await Promise.allSettled(
    list.map(async (file) => {
      try {
        const warnings = [];
        const parsed = parseBatchInput(
          decodeFile(await file.arrayBuffer(), { warnings }),
          { ...options, name: file.name },
        );
        return {
          ...parsed,
          questions:await resolveQuestionImages(parsed.questions, options.imageFiles),
          warnings: [...new Set([...warnings, ...parsed.warnings])],
          name: file.name,
        };
      } catch (error) {
        const wrapped = new Error(
          `${file.name}：${error.message || "檔案讀取失敗，請重新選擇檔案。"}`,
        );
        if (error.mapping)
          wrapped.mapping = { ...error.mapping, name: file.name };
        throw wrapped;
      }
    }),
  );
  const failures = outcomes
    .filter((outcome) => outcome.status === "rejected")
    .map((outcome) => outcome.reason);
  if (failures.length) {
    const error = new Error(
      failures.map((failure) => failure.message).join("\n"),
    );
    if (list.length === 1) error.mapping = failures[0].mapping;
    else if (failures.some((failure) => failure.mapping))
      error.message += "\n需手動對應的檔案，請單獨選取該檔進行對應。";
    throw error;
  }
  const parsed = outcomes.map((outcome) => outcome.value);
  const questions = bounded(parsed.flatMap((file) => file.questions));
  return {
    questions,
    files: parsed.map(({ name, format, questions, warnings }) => ({
      name,
      format,
      count: questions.length,
      warnings,
    })),
    warnings: parsed.flatMap((file) =>
      file.warnings.map((warning) => `${file.name}：${warning}`),
    ),
  };
}
