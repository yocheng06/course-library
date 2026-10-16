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
