import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseQuestions,
  matchQuestions,
  buildIndex,
  toLibraryQuestion,
  expandLibraryQuestion,
  aiPrompt,
  normalizeText,
} from "../assets/batch-model.mjs";
const make = (overrides = {}) =>
  toLibraryQuestion(
    "os",
    "scheduling",
    {
      id: "test-1",
      stem: "CPU 排程器是哪一種類型的排程器？",
      options: [
        "A. 長程排程器",
        "B. 中程排程器",
        "C. 短程排程器",
        "D. 巨集排程器",
      ],
      answer: "C",
      ...overrides,
    },
    true,
  );
const scope = { course: "os", unit: "all" };
const lookup = (text, entries = [make()]) =>
  matchQuestions(parseQuestions(text), buildIndex(entries), scope);

test("parses numbered text, Markdown, full-width labels, original numbers, multiline stems/options and ignores supplied answers", () => {
  const q = parseQuestions(
    "這是作業系統練習題\n**第 21 題：【單選題】CPU 排程器是哪一種類型的排程器？**\nＡ．長程排程器\nＢ．中程排程器\nＣ．短程排程器\nＤ．巨集排程器\n答案：A\n解析：抄題者提供的答案不可當成題庫答案\n\nQ22: 【填空題】第一行\n第二行\n",
  );
  assert.equal(q.length, 2);
  assert.equal(q[0].number, "21");
  assert.equal(q[0].options.length, 4);
  assert(!q[0].options.at(-1).text.includes("答案"));
  assert.equal(q[1].stem, "第一行\n第二行");
  assert.equal(q[0].issues.length, 0);
  assert.equal(
    lookup(
      "21. CPU 排程器是哪一種類型的排程器？\nA. 長程排程器 B. 中程排程器 C. 短程排程器 D. 巨集排程器",
    )[0].answer,
    "C. 短程排程器",
  );
});
test("accepts 30 questions without dropping duplicate items, rejects 31 and excessive/empty input", () => {
  const text = Array.from({ length: 30 }, (_, i) => `${i + 1}. 填空題幹`).join(
    "\n\n",
  );
  assert.equal(parseQuestions(text).length, 30);
  assert.throws(() => parseQuestions(text + "\n31. 另一題"), /最多比對 30 題/);
  assert.throws(() => parseQuestions("x".repeat(80001)), /80,000/);
  assert.throws(() => parseQuestions(" "), /貼上/);
  assert.equal(parseQuestions("單一未編號的填空題").length, 1);
});
test("reorders and relabels answers according to input options, including multi-select and nonalphabetic display order", () => {
  const row = lookup(
    "7. CPU 排程器是哪一種類型的排程器？\nA. 短程排程器\nB. 巨集排程器\nC. 長程排程器\nD. 中程排程器",
  )[0];
  assert.equal(row.status, "matched");
  assert.equal(row.answer, "A. 短程排程器");
  const bank = make({ answer: "A、C" });
  const multi = lookup(
    "7. 【多選題】CPU 排程器是哪一種類型的排程器？\nD. 中程排程器\nA. 短程排程器\nB. 巨集排程器\nC. 長程排程器",
    [bank],
  )[0];
  assert.equal(multi.answer, "A. 短程排程器；C. 長程排程器");
});
test("mathematical case, comparison operators, negation and fill-answer requirements cannot silently change answers", () => {
  const bank = make({
    stem: "哪一個函數滿足 O(N)？",
    options: ["A. n", "B. N"],
    answer: "B",
  });
  assert.notEqual(
    lookup("1. 哪一個函數滿足 O(n)？\nA. n\nB. N", [bank])[0].status,
    "matched",
  );
  const math = make({ stem: "當 x < 0 時，結果為何？" });
  assert.notEqual(
    lookup(
      "1. 當 x > 0 時，結果為何？\nA. 長程排程器\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器",
      [math],
    )[0].status,
    "matched",
  );
  const fill = make({
    stem: "請填寫 SJF 的完整英文名稱。",
    options: [],
    answer: "shortest-job-first",
  });
  assert.equal(
    lookup("1. 請填寫 SJF 的完整英文名稱。", [fill])[0].answer,
    "shortest-job-first",
  );
  assert.notEqual(
    lookup("1. 請填寫 SJF 的大寫縮寫。", [fill])[0].status,
    "matched",
  );
  assert.notEqual(normalizeText("a b"), normalizeText("ab"));
});
test("missing, duplicate or changed choices and missing images require review instead of fabricated answers", () => {
  const inputs = [
    "1. 【單選題】CPU 排程器是哪一種類型的排程器？",
    "1. CPU 排程器是哪一種類型的排程器？\nA. 短程排程器\nA. 中程排程器",
    "1. CPU 排程器是哪一種類型的排程器？\nA. 完全不同\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器",
  ];
  for (const text of inputs) {
    const row = lookup(text)[0];
    assert.equal(row.status, "review");
    assert.equal(row.answer, "");
  }
  const image = make({ images: [{ src: "one.png" }] });
  assert.equal(
    lookup(
      "1. CPU 排程器是哪一種類型的排程器？\nA. 長程排程器\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器",
      [image],
    )[0].status,
    "review",
  );
  assert.equal(parseQuestions("1. 題目 [題圖未轉錄]")[0].issues.length, 1);
});
test("conflicting canonical answers are flagged; outdated source versions do not override a canonical exact match", () => {
  const text =
    "1. CPU 排程器是哪一種類型的排程器？\nA. 長程排程器\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器";
  const conflict = lookup(text, [
    make(),
    make({ id: "test-2", answer: "A" }),
  ])[0];
  assert.equal(conflict.status, "review");
  assert.equal(conflict.answer, "");
  const old = { ...make({ answer: "A" }), preferred: false };
  assert.equal(lookup(text, [make(), old])[0].answer, "C. 短程排程器");
});
test("unmatched questions and fuzzy candidates are different; unknown questions are copied without invented answers", () => {
  const row = lookup("30. 專有名詞 zebra-unseen-protocol 的定義為何？")[0];
  assert.equal(row.status, "unmatched");
  assert.equal(row.answer, "");
  const prompt = aiPrompt([row.question]);
  assert(prompt.includes("30."));
  assert(prompt.includes("需確認"));
  assert(!prompt.includes("C. 短程排程器"));
  const similar = lookup(
    "1. CPU 排程器是哪一種排程器？\nA. 長程排程器\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器",
  )[0];
  assert.equal(similar.status, "review");
  assert.equal(similar.answer, "");
});
test("source language variants preserve option translation alignment and original question links", () => {
  const q = {
    id: "sample",
    stem: "測試題目是哪一個？",
    options: ["A. 第一", "B. 第二"],
    answer: "B",
    translation: "Which is the second choice?",
    optionTranslations: ["A. First", "B. Second"],
    sourceVariants: [
      {
        stem: "舊版題目是哪一個？",
        options: ["A. 第二", "B. 第一"],
        answer: "A",
      },
    ],
  };
  const entries = expandLibraryQuestion("os", "basics", q);
  const row = lookup(
    "4. Which is the second choice?\nA. Second\nB. First",
    entries,
  )[0];
  assert.equal(row.answer, "A. Second");
  assert.equal(row.references[0].id, "sample");
  assert.equal(
    lookup("4. 舊版題目是哪一個？\nA. 第一\nB. 第二", entries)[0].answer,
    "B. 第二",
  );
});
test("every canonical built-in question round trips safely and reordered choices retain the same correct content", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const index = buildIndex(data.entries);
  let answered = 0,
    reviewed = 0;
  for (const entry of data.entries.filter((e) => e.preferred)) {
    const incoming = {
      number: "1",
      stem: entry.stem,
      type: "",
      options: entry.options.map((o, i) => ({
        label: String.fromCharCode(65 + i),
        text: o.replace(/^[A-H][.、．:：]\s*/i, ""),
      })),
      issues: [],
    };
    const row = matchQuestions([incoming], index, {
      course: entry.course,
      unit: entry.unit,
    })[0];
    if (entry.needsImage) {
      assert.equal(row.status, "review");
      reviewed++;
      continue;
    }
    assert.equal(row.status, "matched", entry.id + ": " + row.reason);
    assert(row.answer);
    answered++;
    if (entry.options.length) {
      const reversed = {
        ...incoming,
        options: incoming.options
          .slice()
          .reverse()
          .map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) })),
      };
      const remapped = matchQuestions([reversed], index, {
        course: entry.course,
        unit: entry.unit,
      })[0];
      assert.equal(remapped.status, "matched", entry.id);
    }
  }
  assert.equal(answered + reviewed, 812);
  assert(answered > 790);
  assert.equal(reviewed, 6);
});

test("generated canonical index stays aligned with current course files", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [course, file, pattern] of [
    ["os", "os.html", /const UNITS\s*=\s*(\[.*?\]);/s],
    [
      "algorithms",
      "algorithms.html",
      /<script id="course-data" type="application\/json">(.*?)<\/script>/s,
    ],
  ]) {
    const source = JSON.parse(
      (await readFile(new URL("../" + file, import.meta.url), "utf8")).match(
        pattern,
      )[1],
    );
    const canonical = source.flatMap((unit) =>
      unit.questions.flatMap((q) =>
        expandLibraryQuestion(course, unit.id, q).filter((e) => e.preferred),
      ),
    );
    assert.deepEqual(
      data.entries.filter((e) => e.course === course && e.preferred),
      canonical,
    );
  }
});

test("user's Beast / 妖獸 Markdown batch produces ten correctly remapped bank answers", async () => {
  const text = await readFile(
    new URL("./fixtures/batch-beast.txt", import.meta.url),
    "utf8",
  );
  const questions = parseQuestions(text);
  assert.equal(questions.length, 10);
  assert.deepEqual(
    questions.map((q) => q.number),
    Array.from({ length: 10 }, (_, i) => String(i + 1)),
  );
  assert.deepEqual(
    questions.map((q) => q.options.length),
    [4, 4, 4, 4, 4, 0, 0, 4, 4, 4],
  );
  assert(questions.every((q) => q.issues.length === 0));
  assert(!questions.some((q) => /Beast|妖獸|\*\*|---/.test(q.stem)));
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const results = matchQuestions(questions, buildIndex(data.entries), {
    course: "os",
    unit: "all",
  });
  assert(results.every((r) => r.status === "matched"));
  const keys = results.map((r) =>
    r.question.options.length
      ? r.answer
          .split("；")
          .map((part) => part.match(/^([A-H])\./)[1])
          .join("")
      : r.answer,
  );
  assert.deepEqual(keys, [
    "D",
    "ABCD",
    "C",
    "B",
    "D",
    "consumer",
    "io",
    "BC",
    "A",
    "AB",
  ]);
});

test("standalone named headings preserve original numbering and limits without treating expressions or decimals as headings", () => {
  const questions = parseQuestions(
    "**Exercise 21.**\nA question?\n* A. first\n* B. second\n---\n**自訂題號 22.**\nA fill-in question",
  );
  assert.deepEqual(
    questions.map((q) => q.number),
    ["21", "22"],
  );
  assert.equal(questions[0].options.length, 2);
  const arithmetic = parseQuestions(
    "1. Evaluate\nx >= 1.\n1.5 is a decimal\nA. 2\nB. 3",
  );
  assert.equal(arithmetic.length, 1);
  assert(arithmetic[0].stem.includes("x >= 1."));
  assert(arithmetic[0].stem.includes("1.5"));
  assert.throws(
    () =>
      parseQuestions(
        Array.from(
          { length: 31 },
          (_, i) => `**Beast ${i + 1}.**\nQuestion text`,
        ).join("\n---\n"),
      ),
    /最多比對 30 題/,
  );
});

test("user's 25-question heap transcription accepts invisible characters, circle options and LaTeX without losing questions", async () => {
  const text = await readFile(
    new URL("./fixtures/batch-heap.txt", import.meta.url),
    "utf8",
  );
  const questions = parseQuestions(text);
  assert.equal(questions.length, 25);
  assert.deepEqual(
    questions.map((q) => q.number),
    Array.from({ length: 25 }, (_, i) => String(i + 1)),
  );
  const fills = [1, 5, 6, 8, 11, 12, 19, 20];
  for (const q of questions)
    assert.equal(
      q.options.length,
      fills.includes(Number(q.number)) ? 0 : 4,
      q.number,
    );
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const rows = matchQuestions(questions, buildIndex(data.entries), {
    course: "algorithms",
  });
  assert.equal(rows.filter((r) => r.status === "matched").length, 23);
  assert.equal(rows.filter((r) => r.status === "review").length, 2);
  assert.deepEqual(
    rows.map((r) =>
      r.status === "matched"
        ? r.question.options.length
          ? [...r.answer.matchAll(/(?:^|；)([A-H])\./g)]
              .map((m) => m[1])
              .join("")
          : r.answer
        : r.status,
    ),
    [
      "max-heap",
      "D",
      "B",
      "review",
      "review",
      "O(nlogn)",
      "BCD",
      "maximum",
      "B",
      "C",
      "greater",
      "T(n)<=T(2n/3)+big-theta(1)",
      "ABD",
      "D",
      "A",
      "B",
      "AB",
      "A",
      "O(logn)",
      "in-place",
      "ABC",
      "D",
      "ABD",
      "ABCD",
      "ABC",
    ],
  );
  assert.equal(rows[3].references[0].id, "L4-046");
  assert.equal(rows[4].answer, "");
  assert(rows[4].reason.includes("圖片"));
  assert(
    aiPrompt(
      rows.filter((r) => r.status === "review").map((r) => r.question),
    ).includes("根為 4"),
  );
});

test("math presentation aliases preserve bases, case, rounding and comparison direction", () => {
  assert.equal(normalizeText("O(n \\log n)"), normalizeText("O(n log n)"));
  assert.equal(
    normalizeText("\\lfloor i/2 \\rfloor"),
    normalizeText("⌊ i/2 ⌋"),
  );
  assert.equal(normalizeText("\\text{floor}(i/2)"), normalizeText("⌊i/2⌋"));
  assert.equal(normalizeText("n^{2}"), normalizeText("n^2"));
  assert.equal(normalizeText("n²"), normalizeText("n^2"));
  assert.notEqual(normalizeText("n²"), normalizeText("n2"));
  assert.equal(
    parseQuestions("1. O(n²)\n◯ **A.** n²\n☑️ B. n2")[0].options[0].text,
    "n^{2}",
  );
  for (const [a, b] of [
    ["log n", "lg n"],
    ["log n", "ln n"],
    ["⌊i/2⌋", "⌈i/2⌉"],
    ["O(n)", "o(n)"],
    ["n^{N}", "n^{n}"],
    ["x<0", "x>0"],
  ])
    assert.notEqual(normalizeText(a), normalizeText(b));
});

test("text answers may map to one exact option, while ambiguous, image and conflicting choices require review", () => {
  const fill = make({ options: [], answer: "原地排序" });
  const input = "1. CPU 排程器是哪一種類型的排程器？\nA. 原地排序\nB. 其他";
  assert.equal(lookup(input, [fill])[0].answer, "A. 原地排序");
  for (const entries of [
    [{ ...fill, needsImage: true }],
    [fill, make()],
    [fill, { ...fill, id: "other", answer: "其他" }],
  ]) {
    assert.equal(lookup(input, entries)[0].status, "review");
  }
  assert.equal(lookup(input + "\nC. 原地排序", [fill])[0].status, "review");
  assert.equal(
    lookup(input, [{ ...fill, answer: "原地" }])[0].status,
    "review",
  );
});

test("only known English/math answer instructions are presentation aliases; case, naming and added conditions remain meaningful", () => {
  const fill = make({
    stem: "執行時間為 __________",
    options: [],
    answer: "O(nlogn)",
  });
  const hint =
    "（請用英文回答，表示形式為 請用 log，不可用 lg 替代 log，上標請用 ^，符號請用 {big-theta, theta, big-omega, omega, O, o}）";
  assert.equal(
    lookup("1. 執行時間為 ____ " + hint, [fill])[0].answer,
    "O(nlogn)",
  );
  for (const suffix of [
    "（請用英文回答，只考慮 n<0）",
    "（請用大寫英文回答）",
    "（請用英文回答，填完整名稱）",
  ])
    assert.notEqual(
      lookup("1. 執行時間為 ____ " + suffix, [fill])[0].status,
      "matched",
    );
  assert.equal(
    lookup("1. 執行時間為 ____（請用英文回答）", [
      { ...fill, answer: "線性" },
    ])[0].status,
    "review",
  );
  assert.equal(
    lookup("1. 執行時間為 ____（請用英文回答，中間不留空白）", [
      { ...fill, answer: "O(n log n)" },
    ])[0].status,
    "review",
  );
  const extra = lookup("1. 執行時間為 ____\n附加條件：只考慮 n<0", [fill])[0];
  assert.notEqual(extra.status, "matched");
  assert.equal(extra.answer, "");
});
