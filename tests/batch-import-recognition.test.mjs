import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import {
  parseBatchInput,
  resolveImportMapping,
  readBatchFiles,
  decodeFile,
} from "../assets/batch-import.mjs";
import {
  buildIndex,
  matchQuestions,
  toLibraryQuestion,
} from "../assets/batch-model.mjs";

const document = parseHTML(
  "<!doctype html><html><body></body></html>",
).document;
const stem = "CPU 排程器是哪一種類型的排程器？";
const choices = ["短程排程器", "長程排程器"];
const bank = buildIndex([
  toLibraryQuestion(
    "os",
    "scheduling",
    { id: "bank", stem, options: choices, answer: "A" },
    true,
  ),
]);
const input = (raw, name = "") => parseBatchInput(raw, { name, document });
const file = (name, raw) => ({
  name,
  size: Buffer.byteLength(raw),
  arrayBuffer: async () => new TextEncoder().encode(raw).buffer,
});
function answer(batch) {
  assert.equal(batch.questions.length, 1);
  const result = matchQuestions(batch.questions, bank, { course: "os" })[0];
  assert.equal(result.status, "matched", result.reason);
  assert.equal(result.answer, "A. 短程排程器");
}
function getMapping(raw, name = "") {
  try {
    input(raw, name);
  } catch (error) {
    assert(error.mapping, error.message);
    return error.mapping;
  }
  assert.fail("Expected a recoverable field-mapping request");
}

test("JSON field names tolerate case, spaces and punctuation, while legacy answer aliases stay out of options", () => {
  for (const record of [
    { QUESTION_TEXT: stem, "Answer Choices": choices, "Correct Answer": "B" },
    { "Question Text": stem, OPTION_A: choices[0], OPTION_B: choices[1] },
    { 問題: stem, 選項１: choices[0], 選項２: choices[1] },
    { q: stem, a: "B", opts: choices },
    { stem: "", question: stem, options: choices },
    { 問題敘述: `題目：${stem}`, alternatives: choices },
  ])
    answer(input(JSON.stringify({ Records: [record] })));
});
test("different option encodings preserve values and label order", () => {
  for (const options of [
    { 1: choices[0], 2: choices[1] },
    { 0: choices[0], 1: choices[1] },
    choices.map((text, i) => `${i + 1}) ${text}`),
    choices.map((text, i) => ({ Label: i + 1, Text: text })),
    choices.map((text, i) => ({ id: `random-uuid-${i}`, text })),
    choices.map((text, i) => ({ label: `Option ${i ? "B" : "A"}`, text })),
    choices.map((text, i) => ({
      label: `Option ${i ? "B" : "A"}`,
      text: `${i ? "B" : "A"}. ${text}`,
    })),
    [{ A: choices[0] }, { B: choices[1] }],
    `[A] ${choices[0]}\n[B] ${choices[1]}`,
  ])
    answer(input(JSON.stringify([{ stem, options }])));
});
test("JSON5 data, comments and trailing commas work without evaluating expressions", () => {
  const batch = input(
    `// 題庫\n[{ stem: '${stem}', options: ['短程排程器', '長程排程器',], answer: 'B', },]`,
    "ai.json5",
  );
  answer(batch);
  assert(batch.warnings.length);
  for (const raw of [
    `[{stem: (globalThis.__importAttack = true), options: []}]`,
    `[{stem: getQuestion()}]`,
    `[{stem: 'unfinished}]`,
  ])
    assert.throws(() => input(raw, "bad.json"), /JSON 格式不正確/);
  assert.equal(globalThis.__importAttack, undefined);
  assert.equal(Object.prototype.importPollution, undefined);
  const malicious = input(
    `[{stem: '填空 _____', __proto__: {importPollution: true}}]`,
    "data.json5",
  );
  assert.equal(malicious.questions.length, 1);
  assert.equal(Object.prototype.importPollution, undefined);
});
test("AI introductory prose and data fences are recognized, but numbered questions around examples are retained", () => {
  const raw = JSON.stringify([{ stem, options: choices, answer: "B" }]);
  answer(
    input(
      "這裡是整理的題庫：\n\n```json\n" + raw + "\n```\n以上供你查題。",
      "ai.md",
    ),
  );
  answer(input(`以下是題庫資料：\n${raw}`, "ai.txt"));
  const original =
    '題目 1. 閱讀以下程式並填空 _____\n```json\n{"key":"value"}\n```';
  const batch = input(original, "code-question.md");
  assert.equal(batch.questions[0].stem.includes('"key":"value"'), true);
  assert.equal(batch.format, "text");
});
test("Markdown question tables support bold headers, options in separate columns, and answer columns", () => {
  const batch = input(
    `演算法練習\n\n| **題號** | **問題** | 選項A | 選項B | 答案 |\n| --- | --- | --- | --- | --- |\n| 11 | ${stem} | 短程排程器 | 長程排程器 | B |`,
    "table.md",
  );
  answer(batch);
  assert.equal(batch.questions[0].number, "11");
  assert.equal(batch.format, "markdown");
  answer(
    input(
      `| 題目 | 選項 | 解答 |\n| --- | --- | --- |\n| ${stem} | A. 短程排程器<br>B. 長程排程器 | B |`,
    ),
  );
});
test("Markdown tables preserve escaped pipes, code spans, line breaks and math case", () => {
  const batch = input(
    "| stem | A | B |\n| --- | --- | --- |\n| 比較 O(n) 與 o(n)，x &lt; 0？ | `a|b` | a\\|c<br>n^2 |",
  );
  assert.equal(batch.questions[0].stem, "比較 O(n) 與 o(n),x < 0?");
  assert.equal(batch.questions[0].options[0].text, "a|b");
  assert.equal(batch.questions[0].options[1].text, "a|c\nn^2");
  assert.throws(
    () =>
      input(
        `1. 表格外的題目 _____\n\n| stem | A | B |\n| --- | --- | --- |\n| ${stem} | X | Y |`,
      ),
    /同時有表格/,
  );
  assert.throws(
    () => input("| stem | A | B |\n| --- | --- | --- |\n| 題目 | 只有兩欄 |"),
    /第 2 列/,
  );
});
test("CSV semicolon delimiters and TSV stored with a CSV extension are detected from headers", () => {
  answer(
    input(
      `Question Text;option_a;option_b;Answer\n${stem};短程排程器;長程排程器;B`,
      "excel.csv",
    ),
  );
  answer(
    input(
      `問題\t選項1\t選項2\t答案\n${stem}\t短程排程器\t長程排程器\tB`,
      "misnamed.csv",
    ),
  );
  const opts = JSON.stringify(choices).replaceAll('"', '""');
  answer(input(`q,a,opts\n${stem},B,"${opts}"`, "legacy.csv"));
});
test("HTML supports safe JavaScript data literals, comments with brackets, and normal statements after the data", () => {
  const batch = input(
    `<script>const allQuestions = [/* ] */{stem:'${stem}', options:['短程排程器','長程排程器'], answer:'B'}]\nconst state = {}; globalThis.__htmlAttack = true;</script>`,
    "export.html",
  );
  answer(batch);
  assert.equal(globalThis.__htmlAttack, undefined);
  assert(batch.warnings.length);
  assert.throws(
    () =>
      input(
        `<script>const questions = [{stem:'${stem}'}] /*comment*/ .map(runCode);</script>`,
        "expression.html",
      ),
    /程式運算/,
  );
});
test("HTML tables, unlabeled option lists and radio labels can be read without source DOM insertion", () => {
  for (const html of [
    `<table><tr><th>題號</th><th>問題</th><th>A</th><th>B</th><th>答案</th></tr><tr><td>11</td><td>${stem}</td><td>短程排程器</td><td>長程排程器</td><td>B</td></tr></table>`,
    `<div class="question-card"><header>${stem}</header><ul class="options"><li>短程排程器</li><li>長程排程器</li></ul></div>`,
    `<div class="question">${stem}</div><ul class="options"><li>短程排程器</li><li>長程排程器</li></ul>`,
    `<article class="question-card"><h3>${stem}</h3><label><input type="radio" name="q1" value="A">短程排程器</label><label><input type="radio" name="q1" value="B">長程排程器</label></article>`,
  ])
    answer(input(html, "questions.html"));
  assert.equal(document.body.innerHTML, "");
  assert.throws(
    () =>
      input(
        `<table><tr><th>題目</th><th>A</th></tr><tr><td colspan="2">${stem}</td></tr></table>`,
        "merged.html",
      ),
    /合併儲存格/,
  );
});
test("nonstandard CSV/Markdown/JSON field names can be explicitly mapped without rewriting files", () => {
  for (const [raw, name] of [
    [
      `描述,候選甲,候選乙,提供者答案\n${stem},短程排程器,長程排程器,B`,
      "custom.csv",
    ],
    [
      `| 描述 | 候選甲 | 候選乙 | 提供者答案 |\n| --- | --- | --- | --- |\n| ${stem} | 短程排程器 | 長程排程器 | B |`,
      "custom.md",
    ],
    [
      JSON.stringify([
        { 描述: stem, 候選甲: choices[0], 候選乙: choices[1], 提供者答案: "B" },
      ]),
      "custom.json",
    ],
  ]) {
    const mapping = getMapping(raw, name);
    answer(
      resolveImportMapping(mapping, {
        stem: 0,
        columns: [1, 2],
        hasHeader: true,
      }),
    );
    assert.throws(
      () => resolveImportMapping(mapping, { stem: 0, columns: [0, 1] }),
      /同一欄/,
    );
    assert.throws(
      () => resolveImportMapping(mapping, { stem: -1, columns: [1, 2] }),
      /題幹欄位/,
    );
  }
});
test("headerless tables retain the first question when header checkbox is cleared", () => {
  assert.throws(
    () =>
      input(
        Array.from({ length: 101 }, (_, i) => `欄${i}`).join(",") +
          "\n" +
          Array.from({ length: 101 }, () => "資料").join(","),
        "wide.csv",
      ),
    /100 欄/,
  );
  const mapping = getMapping(
    `${stem},短程排程器,長程排程器\n另一題 _____,甲,乙`,
    "headerless.csv",
  );
  const result = resolveImportMapping(mapping, {
    stem: 0,
    columns: [1, 2],
    hasHeader: false,
  });
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[0].stem, stem.replace("？", "?"));
});
test("ambiguous answers arrays require manual mapping instead of being treated as a supplied answer", () => {
  const mapping = getMapping(
    JSON.stringify([{ stem, answers: choices, correct: "B" }]),
    "custom.json",
  );
  const batch = resolveImportMapping(mapping, { stem: 0, options: 1 });
  answer(batch);
});
test("Chinese numbered headings, simplified labels and English answer metadata are normalized safely", () => {
  for (const title of [
    "問題 1：",
    "题目 1：",
    "第一題",
    "題目 一：",
    "Question #1:",
    "Question No. 1:",
    "Q.1:",
  ]) {
    const batch = input(
      `${title} ${stem}\nA. 短程排程器\nB. 長程排程器\nAnswer: B\nExplanation: Do not use this answer`,
      "ai.txt",
    );
    answer(batch);
    assert(!batch.text.includes("Do not use"));
  }
  const two = input(
    "第十一題\n题干：填入 O(n) 與 o(n) _____\n第十二题\n题干：填入 x < 0 _____",
  );
  assert.deepEqual(
    two.questions.map((q) => q.number),
    ["11", "12"],
  );
  assert(two.questions[0].stem.includes("O(n) 與 o(n)"));
});
test("Big5 input is decoded with a preview warning and all failed filenames are reported", async () => {
  const warnings = [];
  const bytes = Uint8Array.from([
    49, 46, 32, 195, 68, 165, 216, 32, 95, 95, 95, 95,
  ]);
  assert.equal(decodeFile(bytes, { warnings }), "1. 題目 ____");
  assert(warnings.some((warning) => warning.includes("Big5")));
  const parsed = await readBatchFiles([
    {
      name: "big5.txt",
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
    },
  ]);
  assert(parsed.warnings.some((warning) => warning.includes("Big5")));
  await assert.rejects(
    readBatchFiles([
      file("bad-one.json", "invalid"),
      file("bad-two.csv", 'stem,A\n"unclosed'),
    ]),
    (error) =>
      error.message.includes("bad-one.json") &&
      error.message.includes("bad-two.csv"),
  );
  await assert.rejects(
    readBatchFiles([
      {
        name: "unreadable.txt",
        size: 10,
        arrayBuffer: async () => {
          throw new DOMException("Cannot read file", "NotReadableError");
        },
      },
    ]),
    /unreadable.txt：Cannot read file/,
  );
});
