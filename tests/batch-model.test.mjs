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
  assert.equal(
    answered + reviewed,
    data.entries.filter((entry) => entry.preferred).length,
  );
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

test("escaped bold Beast question titles split a new question pasted after an option", async () => {
  const text = await readFile(
    new URL("./fixtures/batch-beast-joined-bold.txt", import.meta.url),
    "utf8",
  );
  const questions = parseQuestions(text);
  assert.deepEqual(questions.map((q) => q.number), ["8", "21"]);
  assert.equal(questions[0].stem, "遞迴樹的每一層代表?");
  assert.deepEqual(questions[0].options.map((o) => o.text), [
    "該層遞迴分解的成本",
    "樹的深度",
    "遞迴的總次數",
    "常數項",
  ]);
  assert.equal(
    questions[1].stem,
    "遞迴關係式分析中,我們通常會忽略 ______ 條件 (請用小寫英文回答)",
  );
  assert(questions.every((q) => q.issues.length === 0));
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const results = matchQuestions(questions, buildIndex(data.entries), {
    course: "algorithms",
  });
  assert.deepEqual(
    results.map((row) => [row.status, row.answer, row.references[0]?.id]),
    [
      ["matched", "A. 該層遞迴分解的成本", "L3-006"],
      ["matched", "boundary", "L3-050"],
    ],
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

test("user's bold recurrence batch keeps all 25 numbers, accepts answer hints and only reviews actual option differences", async () => {
  const text = await readFile(
    new URL("./fixtures/batch-recurrence.txt", import.meta.url),
    "utf8",
  );
  const questions = parseQuestions(text);
  assert.equal(questions.length, 25);
  assert.deepEqual(
    questions.map((q) => q.number),
    Array.from({ length: 25 }, (_, i) => String(i + 1)),
  );
  const fillNumbers = [1, 3, 8, 17, 18, 19, 20, 21];
  for (const q of questions) {
    assert.equal(
      q.options.length,
      fillNumbers.includes(Number(q.number)) ? 0 : 4,
      q.number,
    );
    assert.equal(q.issues.length, 0, q.number);
  }
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const rows = matchQuestions(questions, buildIndex(data.entries), {
    course: "algorithms",
  });
  assert.deepEqual(
    rows.filter((r) => r.status === "review").map((r) => r.question.number),
    ["2", "12", "13"],
  );
  assert.equal(rows.filter((r) => r.status === "matched").length, 22);
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
      "1",
      "review",
      "comparison",
      "ACD",
      "A",
      "C",
      "A",
      "2",
      "ABD",
      "ACD",
      "C",
      "review",
      "review",
      "ABCD",
      "ABC",
      "C",
      "three",
      "n",
      "conditions",
      "induction",
      "asymptotic",
      "D",
      "D",
      "C",
      "D",
    ],
  );
  const reviews = rows.filter((r) => r.status === "review");
  for (const row of reviews) {
    assert.equal(row.answer, "");
    assert(row.reason.includes("選項不同"));
    assert.equal(row.references.length, 1);
  }
  const copied = aiPrompt(reviews.map((r) => r.question));
  assert(copied.includes("忽略複雜的數學常數"));
  assert(copied.includes("滿足規則性條件"));
  assert(copied.includes("將其改為隨機"));
});

test("recognized answer hints validate the actual bank answer and never change it to fit another required case or format", () => {
  const fill = make({ stem: "此處應填入 ____", options: [], answer: "2" });
  assert.equal(
    lookup("1. 此處應填入 _____ (請用數字回答)", [fill])[0].answer,
    "2",
  );
  assert.equal(
    lookup("1. 此處應填入 _____ (請用小寫英文回答)", [
      { ...fill, answer: "induction" },
    ])[0].answer,
    "induction",
  );
  for (const [hint, answer] of [
    ["數字", "two"],
    ["小寫英文", "N"],
    ["大寫英文", "n"],
  ]) {
    const row = lookup(`1. 此處應填入 _____ (請用${hint}回答)`, [
      { ...fill, answer },
    ])[0];
    assert.equal(row.status, "review");
    assert.equal(row.answer, "");
  }
  for (const hint of [
    "請用小寫英文回答，只考慮負數",
    "請用數字回答，忽略第一項",
    "請用小寫英文回答，請填縮寫",
  ])
    assert.notEqual(
      lookup(`1. 此處應填入 _____ (${hint})`, [fill])[0].status,
      "matched",
    );
  assert.equal(normalizeText("n^(log_b(a))"), normalizeText("n^log_b(a)"));
  assert.notEqual(
    normalizeText("n^(log_b(a)+1)"),
    normalizeText("n^log_b(a)+1"),
  );
  assert.notEqual(normalizeText("n^(log_b(a))"), normalizeText("n^(log_a(b))"));
  assert.notEqual(normalizeText("n^(log_b(a))"), normalizeText("N^(log_b(a))"));
});

test("user's labelled OS batch recovers question 21 and returns all 13 answers with the pasted choice order", async () => {
  const text = await readFile(
    new URL("./fixtures/batch-os-labelled.txt", import.meta.url),
    "utf8",
  );
  const questions = parseQuestions(text);
  assert.deepEqual(
    questions.map((q) => q.number),
    Array.from({ length: 13 }, (_, i) => String(i + 11)),
  );
  for (const q of questions) {
    assert(!q.stem.startsWith("題目:"));
    assert(!q.stem.includes("選項:"));
    assert.equal(q.issues.length, 0, q.number);
    assert.equal(
      q.options.length,
      ["11", "14"].includes(q.number) ? 0 : 4,
      q.number,
    );
  }
  assert.equal(
    questions.find((q) => q.number === "20").options[3].text,
    "Identity theft",
  );
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const rows = matchQuestions(questions, buildIndex(data.entries), {
    course: "os",
  });
  assert(rows.every((r) => r.status === "matched"));
  assert.deepEqual(
    rows.map((r) =>
      r.question.options.length
        ? [...r.answer.matchAll(/(?:^|；)([A-H])\./g)].map((m) => m[1]).join("")
        : r.answer,
    ),
    [
      "dma",
      "C",
      "B",
      "timer",
      "AC",
      "BC",
      "C",
      "ABCD",
      "ABC",
      "ABCD",
      "BCD",
      "ABCD",
      "C",
    ],
  );
  assert(rows[5].reason.includes("Disk formating"));
  assert.equal(questions[5].options[0].text, "Disk formating");
  assert.equal(rows[7].references[0].id, "basics-31");
});

test("labelled questions accept inline/separate English or Chinese field labels and still require complete choices", () => {
  const rows = lookup(
    "第 31 題\n題目：CPU 排程器是哪一種類型的排程器？\n選項：A. 長程排程器\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器",
  );
  assert.equal(rows[0].answer, "C. 短程排程器");
  assert.equal(
    lookup(
      "Q31\nQuestion: CPU 排程器是哪一種類型的排程器？\nChoices:\nA. 長程排程器\nB. 中程排程器\nC. 短程排程器\nD. 巨集排程器",
    )[0].answer,
    "C. 短程排程器",
  );
  assert.equal(
    parseQuestions("第 31 題\n題目：\n請填寫內容\n選項：")[0].issues.length,
    1,
  );
  const q = parseQuestions(
    "第 31 題\n題幹：請判斷內容\n選項：前兩項必須同時符合\nA. 一\nB. 二",
  )[0];
  assert(q.stem.includes("前兩項必須同時符合"));
});

test("joined headings require option content and a following labelled stem; limits and duplicate numbers remain enforced", () => {
  const text =
    "第 1 題\n題目：第一題\n選項：\nA. 一\nB. 二  第 2 題\n\n題目：第二題\nA. 三\nB. 四";
  assert.deepEqual(
    parseQuestions(text).map((q) => q.number),
    ["1", "2"],
  );
  const reference = parseQuestions(
    "1. 請閱讀以下選項\nA. 參照 第 21 題\nB. 無關\n補充條件：保留文字",
  );
  assert.equal(reference.length, 1);
  assert(reference[0].options[0].text.includes("第 21 題"));
  assert.equal(
    parseQuestions("1. 請閱讀選項\nA. 第 21 題\n題目：這是選項的補充\nB. 無關")
      .length,
    1,
  );
  const duplicate = parseQuestions(text.replace("第 2 題", "第 1 題"));
  assert(duplicate[1].issues.some((issue) => issue.includes("題號重複")));
  const thirty = Array.from(
    { length: 30 },
    (_, i) => `第 ${i + 1} 題\n題目：題幹\nA. 一\nB. 二`,
  ).join("\n");
  assert.throws(
    () => parseQuestions(thirty + "  第 31 題\n題目：不能截掉的題目"),
    /最多比對 30 題/,
  );
});

test("known technical spelling is limited to the complete option term, while other spelling and meaning changes require review", () => {
  const bank = make({
    options: ["A. Disk formatting", "B. Memory management"],
    answer: "B",
  });
  const text =
    "1. CPU 排程器是哪一種類型的排程器？\nA. Disk formating\nB. Memory management";
  assert.equal(lookup(text, [bank])[0].answer, "B. Memory management");
  for (const option of [
    "Disk format",
    "Disk formating()",
    "Disk formattng",
    "Disk NOT formatting",
  ])
    assert.equal(
      lookup(text.replace("Disk formating", option), [bank])[0].status,
      "review",
    );
});

test("user's scheduling export matches all 30 questions across verified option translations, reordered choices and missing blanks", async () => {
  const text = await readFile(
    new URL("./fixtures/batch-scheduling-30.txt", import.meta.url),
    "utf8",
  );
  const questions = parseQuestions(text);
  assert.equal(questions.length, 30);
  assert.deepEqual(
    questions.map((q) => q.number),
    Array.from({ length: 30 }, (_, i) => String(i + 1)),
  );
  assert(questions.every((q) => q.issues.length === 0));
  assert(!questions.at(-1).stem.includes("給我答案"));
  assert(
    !questions.some(
      (q) =>
        q.stem.includes("\\_") || q.options.some((o) => o.text.endsWith("\\")),
    ),
  );
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const index = buildIndex(data.entries);
  const rows = matchQuestions(questions, index, { course: "os" });
  assert(
    rows.every((r) => r.status === "matched"),
    rows
      .filter((r) => r.status !== "matched")
      .map((r) => r.question.number + ": " + r.reason)
      .join("\n"),
  );
  assert.deepEqual(
    rows.map((r) =>
      r.question.options.length
        ? [...r.answer.matchAll(/(?:^|；)([A-H])\./g)].map((m) => m[1]).join("")
        : r.answer,
    ),
    [
      "C",
      "response",
      "A",
      "B",
      "A",
      "ABC",
      "preemptive",
      "ACD",
      "CD",
      "time quantum",
      "FCFS",
      "ABCD",
      "C",
      "C",
      "shortest-job-first",
      "shortest-job-first",
      "ABD",
      "ABCD",
      "ABCD",
      "multilevel feedback queue",
      "C",
      "BCD",
      "aging",
      "boosted",
      "ABCD",
      "sched_rr",
      "ABD",
      "C",
      "queueing",
      "first-come first-served",
    ],
  );
  assert(rows[25].reason.includes("填空線未貼出"));
  assert(rows[28].reason.includes("填空線未貼出"));
  for (const n of [1, 5, 8, 21, 28]) {
    const q = questions[n - 1];
    const reversed = {
      ...q,
      options: q.options
        .slice()
        .reverse()
        .map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) })),
    };
    const result = matchQuestions([reversed], index, { course: "os" })[0];
    assert.equal(result.status, "matched");
    const correctContents = (row) =>
      row.answer
        .split("；")
        .map((s) => s.slice(3))
        .sort();
    assert.deepEqual(correctContents(result), correctContents(rows[n - 1]));
  }
});

test("missing blank recovery requires a recognized fill instruction, exact remaining content, one placeholder and consistent answers", () => {
  const fill = make({
    stem: "POSIX 定義的第二個排程類別是 ____。",
    options: [],
    answer: "sched_rr",
  });
  const input = "1. POSIX 定義的第二個排程類別是 。(請用小寫英文回答)";
  assert.equal(lookup(input, [fill])[0].answer, "sched_rr");
  assert.equal(
    lookup(input, [{ ...fill, needsImage: true }])[0].status,
    "review",
  );
  assert.equal(
    lookup(input, [fill, { ...fill, id: "conflict", answer: "sched_fifo" }])[0]
      .status,
    "review",
  );
  for (const text of [
    input.replace("(請用小寫英文回答)", ""),
    input.replace("第二個", "第三個"),
    input.replace("(請用小寫英文回答)", "(請用小寫英文回答，只考慮非即時)"),
    input + "\nA. sched_rr\nB. sched_fifo",
  ])
    assert.notEqual(lookup(text, [fill])[0].status, "matched");
  assert.notEqual(
    lookup(input, [
      { ...fill, stem: fill.stem.replace("____", "____ 與 ____") },
    ])[0].status,
    "matched",
  );
  assert.equal(
    lookup(input, [{ ...fill, answer: "SCHED_RR" }])[0].status,
    "review",
  );
  assert.notEqual(
    lookup(input.replace("是 。", "是 sched_rr。"), [fill])[0].status,
    "matched",
  );
});

test("Markdown exports remove repeated hard-break markup and trailing requests while preserving paths, code, meaningful underscores and question content", () => {
  const exportText =
    "題目 1\\\n填寫 \\_\\_\\_\\_ 答案\\\n題目 2\\\n另一個填空題\\\n給我答案\\\n給我答案確定正確";
  const qs = parseQuestions(exportText);
  assert.equal(qs.length, 2);
  assert.equal(qs[0].stem, "填寫 ____ 答案");
  assert.equal(qs[1].stem, "另一個填空題");
  assert(
    parseQuestions("1. 檔案路徑\nA. C:\\\nB. D:\\")[0].options[0].text.endsWith(
      "\\",
    ),
  );
  const paths = parseQuestions("1. 路徑 C:\\\n2. 路徑 D:\\");
  assert(paths.every((q) => q.stem.endsWith("\\")));
  assert.equal(normalizeText("my\\_key"), "my\\_key");
  assert.equal(
    parseQuestions("1. 「給我答案」這句話的意思為何？")[0].stem,
    "「給我答案」這句話的意思為何?",
  );
  assert.equal(
    parseQuestions("1. 問題\nA. 給我答案\nB. 其他")[0].options[0].text,
    "給我答案",
  );
  assert.throws(
    () =>
      parseQuestions(
        exportText.replace("給我答案\\\n給我答案確定正確", "") +
          "\n" +
          Array.from({ length: 29 }, (_, i) => `${i + 3}. 額外題目`).join("\n"),
      ),
    /最多比對 30 題/,
  );
});

test("verified translations preserve all alternatives; changing a translated choice or negation still requires review", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const index = buildIndex(data.entries);
  const text = await readFile(
    new URL("./fixtures/batch-scheduling-30.txt", import.meta.url),
    "utf8",
  );
  const q = parseQuestions(text)[0];
  for (const replacement of [
    "核心模式排程 (UMS)",
    "不是使用者模式排程 (UMS)",
    "多層級行列",
  ]) {
    const changed = {
      ...q,
      options: q.options.map((o) =>
        o.label === "C" ? { ...o, text: replacement } : o,
      ),
    };
    assert.equal(
      matchQuestions([changed], index, { course: "os" })[0].status,
      "review",
    );
  }
});

test("verified bilingual options support mixed languages and reordered letters without changing correct content", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const index = buildIndex(data.entries);
  const q = parseQuestions(
    "1. 什麼是作業系統？\nA. A compiler for converting source code\nB. 在使用者與電腦硬體之間充當中介的程式\nC. A physical device that stores files\nD. 只用於遊戲的應用程式",
  );
  const row = matchQuestions(q, index, { course: "os" })[0];
  assert.equal(row.status, "matched");
  assert(row.answer.startsWith("B."));
  for (const entry of data.entries.filter(
    (e) => e.preferred && e.optionAliases,
  )) {
    const mixed = {
      number: "1",
      stem: entry.stem,
      type: "",
      issues: [],
      options: entry.options
        .map((o, i) => ({
          label: String.fromCharCode(65 + i),
          text: entry.optionAliases[i][i % entry.optionAliases[i].length],
        }))
        .reverse()
        .map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) })),
    };
    assert.equal(
      matchQuestions([mixed], index, { course: entry.course })[0].status,
      "matched",
      entry.id,
    );
  }
  const bad = structuredClone(q[0]);
  bad.options[1].text = "不是在使用者與電腦硬體之間充當中介的程式";
  assert.notEqual(
    matchQuestions([bad], index, { course: "os" })[0].status,
    "matched",
  );
});

test("wrong unit returns the exact answer and source unit instead of claiming an existing question is unrecorded", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const q = parseQuestions(
    "1. 下列何者為作業系統的常見目標？\nA. 僅僅執行程式\nB. 最小化記憶體\nC. 便利性與效率\nD. 僅僅保護硬體",
  );
  const index = buildIndex(data.entries);
  const row = matchQuestions(q, index, { course: "os", unit: "scheduling" })[0];
  assert.equal(row.status, "matched");
  assert.equal(row.outsideScope, true);
  assert.equal(row.answer, "C. 便利性與效率");
  assert.equal(row.references[0].unit, "basics");
  assert.notEqual(
    matchQuestions(q, index, { course: "os", unit: "all" })[0].outsideScope,
    true,
  );
  const different = structuredClone(q);
  different[0].options[2].text = "完全不同";
  assert.notEqual(
    matchQuestions(different, index, { course: "os", unit: "scheduling" })[0]
      .status,
    "matched",
  );
});

test("important answer conditions survive translations, source variants and cross-unit answers", async () => {
  const data = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const rows = matchQuestions(
    parseQuestions(
      await readFile(
        new URL("./fixtures/batch-scheduling-30.txt", import.meta.url),
        "utf8",
      ),
    ),
    buildIndex(data.entries),
    { course: "os", unit: "basics" },
  );
  for (const n of [5, 22, 30]) {
    assert.equal(rows[n - 1].status, "matched");
    assert(rows[n - 1].conditions.length > 0);
    assert.equal(rows[n - 1].outsideScope, true);
  }
  assert(rows[29].conditions.join("").includes("CPU burst"));
  assert(rows[4].conditions.join("").includes("基礎優先權"));
  assert.equal(rows[1].conditions.length, 0);
});


test("threading Markdown batch keeps all 25 questions and diagnoses the wrong course without inventing answers", async () => {
  const text = await readFile(new URL("./fixtures/batch-threading-25.txt", import.meta.url), "utf8");
  const questions = parseQuestions(text);
  assert.deepEqual(questions.map((q) => q.number), Array.from({length:25}, (_, i) => String(i + 1)));
  assert(questions.every((q) => q.issues.length === 0));
  assert.equal(questions[8].options[3].text, "繼弱 Thread 類別");
  const data = JSON.parse(await readFile(new URL("../assets/batch-library.json", import.meta.url), "utf8"));
  const index = buildIndex(data.entries);
  const wrongCourse = matchQuestions(questions, index, {course:"algorithms", unit:"all"});
  assert(wrongCourse.every((r) => r.status === "unmatched" && !r.answer));
  const rows = matchQuestions(questions, index, {course:"os", unit:"all"});
  assert.equal(rows.filter((r) => r.status === "matched").length, 18);
  assert.deepEqual(rows.filter((r) => r.status === "review").map((r) => r.question.number), ["4", "7", "9", "20"]);
  assert.deepEqual(rows.filter((r) => r.status === "unmatched").map((r) => r.question.number), ["11", "19", "25"]);
  assert.equal(rows[0].answer, "A. Two-level");
  assert.equal(rows[13].answer, "A. KTHREAD；D. ETHREAD");
  assert(rows.filter((r) => r.status !== "matched").every((r) => !r.answer));
});

