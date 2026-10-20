import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  parseBatchInput,
  prepareImport,
  readBatchFiles,
  decodeFile,
  MAX_FILE_BYTES,
} from "../assets/batch-import.mjs";
import {
  buildIndex,
  matchQuestions,
  toLibraryQuestion,
  parseQuestions,
} from "../assets/batch-model.mjs";

const document = parseHTML(
  "<!doctype html><html><body></body></html>",
).document;
const stem = "CPU 排程器是哪一種類型的排程器？";
const q = {
  stem,
  options: ["A. 短程排程器", "B. 長程排程器"],
  answer: "B",
  explanation: "不要相信匯入檔案的答案",
};
const input = (value, name = "") => parseBatchInput(value, { name, document });
const file = (name, text) => ({
  name,
  size: Buffer.byteLength(text),
  arrayBuffer: async () => new TextEncoder().encode(text).buffer,
});
const bank = buildIndex([
  toLibraryQuestion(
    "os",
    "scheduling",
    { ...q, id: "test", answer: "A" },
    true,
  ),
]);
function assertBankAnswer(parsed) {
  const result = matchQuestions(parsed.questions, bank, { course: "os" })[0];
  assert.equal(result.status, "matched");
  assert.equal(result.answer, "A. 短程排程器");
  assert(!parsed.text.includes(q.explanation));
}

test("existing AI transcription formats and mathematical expressions survive import", async () => {
  for (const fixture of [
    "batch-beast.txt",
    "batch-beast-joined-bold.txt",
    "batch-heap.txt",
    "batch-recurrence.txt",
    "batch-os-labelled.txt",
    "batch-scheduling-30.txt",
  ]) {
    const text = await readFile(
      new URL(`./fixtures/${fixture}`, import.meta.url),
      "utf8",
    );
    const parsed = input(text, "questions.md");
    const expected = parseQuestions(text);
    assert.equal(parsed.questions.length, expected.length, fixture);
    assert.deepEqual(
      parsed.questions.map((q) => [q.number, q.stem, q.options]),
      expected.map((q) => [q.number, q.stem, q.options]),
      fixture,
    );
    assert.equal(parsed.format, "text");
  }
  const math = input(
    "1. 比較 n²、n^2、O(n)、o(n) 與 x < 0，填入 _____。",
    "math.txt",
  );
  assert(math.questions[0].stem.includes("n^"));
  assert(math.questions[0].stem.includes("O(n)"));
  assert(math.questions[0].stem.includes("o(n)"));
  assert(math.questions[0].stem.includes("x < 0"));
  assert.equal(input("[填空題] 請填入 _____").format, "text");
  assert.equal(input("[看不清楚] 請填入 _____").format, "text");
});
test("JSON arrays, aliases, units and API wrappers use only the bank answer", () => {
  for (const value of [
    [q],
    { questions: [q] },
    [{ id: "L2", questions: [q] }],
    { units: [{ questions: [q] }] },
    { data: { questions: [{ id: "public", question: q }] } },
    [{ q: stem, opts: q.options, a: "B" }],
    [{ 題目: stem, 選項: { A: "短程排程器", B: "長程排程器" }, 答案: "B" }],
    [
      {
        question: stem,
        choices: [
          { label: "A", text: "短程排程器" },
          { label: "B", text: "長程排程器" },
        ],
      },
    ],
  ])
    assertBankAnswer(input(JSON.stringify(value)));
  const numbered = input(JSON.stringify([{ number: 11, ...q }]));
  assert.equal(numbered.questions[0].number, "11");
  assert.equal(
    input("```json\n" + JSON.stringify([q]) + "\n```").format,
    "json",
  );
  assertBankAnswer(input("```json\n" + JSON.stringify([q]) + "\n```", "ai.md"));
  assertBankAnswer(input(JSON.stringify([q]), "ai.txt"));
});
test("CSV and TSV preserve quoted delimiters, newlines, literal quotes and option order", () => {
  assertBankAnswer(
    input(
      `題號,題目,A,B,答案\r\n11,${stem},短程排程器,長程排程器,B`,
      "questions.csv",
    ),
  );
  assertBankAnswer(
    input(
      `question\toption A\toption B\tanswer\n${stem}\t短程排程器\t長程排程器\tB`,
    ),
  );
  const csv =
    'stem,A,B\n"有逗號,與換行\n請問 \\"x\\"？","n,log n","第一行\n第二行"'.replaceAll(
      '\\"',
      '""',
    );
  const parsed = input(csv, "math.csv");
  assert.equal(parsed.questions[0].stem, '有逗號,與換行\n請問 "x"?');
  assert.equal(parsed.questions[0].options[0].text, "n,log n");
  assert.equal(parsed.questions[0].options[1].text, "第一行\n第二行");
  const options = JSON.stringify(q.options).replaceAll('"', '""');
  assertBankAnswer(input(`stem,options\n${stem},"${options}"`, "options.csv"));
  assertBankAnswer(
    input(`stem,options,A,B\n${stem},"${options}",,`, "options.csv"),
  );
});
test("malformed or ambiguous records fail as a whole instead of silently dropping rows", () => {
  for (const [text, name, error] of [
    ['[{"stem":', "bad.json", /JSON/],
    [JSON.stringify([q, { id: "no-stem" }]), "bad.json", /第 2 筆/],
    [
      JSON.stringify({ questions: [q], items: [q] }),
      "ambiguous.json",
      /多個題目清單/,
    ],
    [JSON.stringify({ questions: [] }), "empty.json", /空/],
    ['stem,A,B\n"unclosed,A,B', "bad.csv", /未關閉/],
    ["stem,A,B\n題目,第一個,第二個,多一欄", "bad.csv", /第 2 列/],
    ["stem,question,A,B\n題目,不同題目,A,B", "bad.csv", /重複/],
    ["stem,options,A,B\n題目,[],A,B", "bad.csv", /同時/],
    ["title,A,B\n題目,A,B", "bad.csv", /找不到題目欄位/],
    [
      JSON.stringify([{ stem: "第一行\n2. 這行會誤判為另一題" }]),
      "nested.json",
      /誤認/,
    ],
  ])
    assert.throws(() => input(text, name), error);
  const incomplete = input(
    JSON.stringify([{ stem, type: "單選題", options: ["A. 僅有一項"] }]),
  );
  assert(
    incomplete.questions[0].issues.some((issue) => issue.includes("不完整")),
  );
  const missing = input(JSON.stringify([{ stem, type: "單選題" }]));
  assert(
    missing.questions[0].issues.some((issue) => issue.includes("尚未附上選項")),
  );
});
test("HTML supports embedded JSON and static numbered content without executing scripts or inserting source nodes", () => {
  const before = document.body.innerHTML;
  for (const html of [
    `<script id="course-data" type="application/json">${JSON.stringify([{ questions: [q] }])}</script>`,
    `<script type="application/json">${JSON.stringify({ questions: [q] })}</script>`,
    `<script>const UNITS = ${JSON.stringify([{ questions: [q] }])};</script>`,
    `<script>const quizData = ${JSON.stringify({ questions: [q] })};</script>`,
    `<h2>題目 1</h2><p>${stem}</p><ol type="A"><li>短程排程器</li><li>長程排程器</li></ol><p>答案：B</p>`,
    `<article class="question-card"><h3>${stem}</h3><p>A. 短程排程器</p><p>B. 長程排程器</p><div class="answer">答案：B</div></article>`,
  ]) {
    assertBankAnswer(input(html, "questions.html"));
    assert.equal(document.body.innerHTML, before);
  }
  const unsafe = `<script>globalThis.__importExecuted = true; fetch('https://example.invalid')</script><nav>不是題目</nav><p>1. ${stem}</p><p>A. 短程排程器</p><p>B. 長程排程器</p><img src="https://example.invalid/image.png" onerror="globalThis.__importExecuted=true">`;
  const parsed = input(unsafe, "unsafe.html");
  assert.equal(globalThis.__importExecuted, undefined);
  assert.equal(document.querySelectorAll("img,iframe,script").length, 0);
  assert(parsed.questions[0].issues.some((issue) => issue.includes("圖片")));
  assert.equal(
    matchQuestions(parsed.questions, bank, { course: "os" })[0].status,
    "review",
  );
  assert.throws(() => input("<p>只連到題庫的網站</p>", "page.html"), /找不到/);
  assert.equal(
    input(
      "<script>const questions = [{stem: '不能執行的 JS'}];</script>",
      "page.html",
    ).questions[0].stem,
    "不能執行的 JS",
  );
  assert.throws(
    () =>
      input("<script>const questions = makeQuestions();</script>", "page.html"),
    /不執行/,
  );
});
test("HTML mathematical superscripts/subscripts and structured images remain explicit", () => {
  const html = input(
    "<p>1. n<sup>2</sup> 與 a<sub>i</sub> 的意義？</p>",
    "math.html",
  );
  assert.equal(html.questions[0].stem, "n^{2} 與 a_{i} 的意義?");
  const image = input(
    JSON.stringify([{ ...q, images: ["data:image/png;base64,ignored"] }]),
  );
  assert(image.questions[0].stem.includes("[題圖未轉錄]"));
  assert(image.questions[0].issues.some((issue) => issue.includes("圖片")));
  assert(
    input(
      "1. 請看題圖 _____\n![樹狀圖](tree.png)",
      "question.md",
    ).questions[0].issues.some((issue) => issue.includes("圖片")),
  );
  assert(
    input(
      "<p>1. <math><msup><mi>n</mi><mn>2</mn></msup></math> 的意義？</p>",
      "math.html",
    ).questions[0].issues.some((issue) => issue.includes("圖片")),
  );
});
test("append/replace preserve labels, resolve conflicting numbers and enforce combined limits atomically", () => {
  const existing = "11. 原題 ______\n12. 另一題 ______";
  const imported = input(JSON.stringify([{ number: 11, ...q }])).questions;
  const added = prepareImport(existing, imported);
  assert.deepEqual(
    added.questions.map((q) => q.number),
    ["11", "12", "13"],
  );
  assert.equal(added.renumbered, 1);
  assert.equal(added.questions[2].options[0].text, "短程排程器");
  assert.equal(imported[0].number, "11", "staged objects must not be mutated");
  assert.equal(
    prepareImport(existing, imported, "replace").questions.length,
    1,
  );
  const thirty = Array.from(
    { length: 30 },
    (_, i) => `${i + 1}. 第 ${i + 1} 題填空 ______`,
  ).join("\n\n");
  assert.throws(() => prepareImport(thirty, imported), /30 題/);
  assert.throws(
    () => input(JSON.stringify(Array.from({ length: 31 }, () => q))),
    /30 題/,
  );
  assert.throws(
    () =>
      prepareImport(
        `1. ${"字".repeat(79980)}`,
        input("2. " + "字".repeat(30)).questions,
      ),
    /80,000/,
  );
});
test("multi-file reading validates every file and aggregate size before allowing an import", async () => {
  const files = await readBatchFiles([
    file("first.json", JSON.stringify([q])),
    file("second.md", "1. 填空 ______"),
  ]);
  assert.equal(files.questions.length, 2);
  assert.equal(prepareImport("", files.questions).renumbered, 1);
  await assert.rejects(
    readBatchFiles([
      file("first.json", JSON.stringify([q])),
      file("bad.json", "invalid"),
    ]),
    /bad.json/,
  );
  await assert.rejects(
    readBatchFiles([{ ...file("huge.txt", "x"), size: MAX_FILE_BYTES + 1 }]),
    /2 MB/,
  );
  await assert.rejects(
    readBatchFiles([file("photo.png", "image")]),
    /PDF、Word 和圖片/,
  );
});
test("UTF-8 BOM and UTF-16 BOM are decoded without silently replacing unreadable bytes", () => {
  assert.equal(decodeFile(new TextEncoder().encode("\uFEFF題目")), "題目");
  assert.equal(
    decodeFile(
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from("題目", "utf16le"),
      ]),
    ),
    "題目",
  );
  assert.throws(() => decodeFile(Uint8Array.from([0xff, 0xfd, 0x81])), /UTF-8/);
});
