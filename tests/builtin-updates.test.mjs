import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import {
  applyBuiltinOverrides,
  expandLibraryQuestion,
  buildIndex,
  matchQuestions,
  parseQuestions,
} from "../assets/batch-model.mjs";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("batch overrides replace canonical and merged source answers atomically, including bilingual option reorder", () => {
  const base = {
    id: "stable-1",
    stem: "Original?",
    options: ["A. first", "B. second"],
    answer: "A",
    answerProvided: true,
  };
  const entries = [
    ...expandLibraryQuestion("os", "basics", base),
    ...expandLibraryQuestion("os", "basics", {
      ...base,
      id: "old-1",
      stem: "Legacy?",
    }),
  ];
  const updated = {
    ...base,
    aliases: ["old-1"],
    stem: "Edited?",
    translation: "修訂題目？",
    optionTranslations: ["A. 甲", "B. 乙"],
    answer: "B",
    choiceKey: "B",
  };
  const next = applyBuiltinOverrides(entries, "os", [
    { unit: "basics", question: updated },
  ]);
  assert.ok(!next.some((e) => e.id === "old-1" || e.stem === "Original?"));
  const index = buildIndex(next);
  const [result] = matchQuestions(
    parseQuestions("1. 修訂題目？\nA. 乙\nB. first"),
    index,
    { course: "os" },
  );
  assert.equal(result.status, "matched");
  assert.equal(result.answer, "A. 乙");
  assert.throws(() =>
    applyBuiltinOverrides(entries, "os", [
      { unit: "wrong", question: updated },
    ]),
  );
  assert.equal(entries[0].answer, "A");
});

for (const course of ["os", "algorithms"])
  test(
    course +
      " loads edited built-ins into reading, search and exams, and restores bundled data on reset",
    async () => {
      const html = await read(course + ".html"),
        { document, window } = parseHTML(html);
      for (const select of document.querySelectorAll("select"))
        Object.defineProperty(select, "value", {
          value: select.querySelector("option")?.value || "",
          writable: true,
          configurable: true,
        });
      const context = vm.createContext({
        window,
        document,
        location: { search: "" },
        URLSearchParams,
        console,
        requestAnimationFrame: (callback) => callback(),
      });
      for (const file of [
        "question-tools.js",
        "choice-answers.js",
        "practice-feedback.js",
        course + "-learning.js",
      ])
        vm.runInContext(await read("assets/" + file), context, {
          filename: file,
        });
      const learning = window.courseLearning;
      const original = learning.examEntries(true).at(-1),
        q = JSON.parse(JSON.stringify(original.q)),
        id = original.id;
      const unit = original.unitId;
      window.courseQuestionTools.matchesSearch(
        original.q,
        "search-cache-primer",
      );
      Object.assign(q, {
        stem: "Unique revised searchable stem?",
        q: "Unique revised searchable stem?",
        answer: "new answer",
        a: "new answer",
        explanation: "edited explanation",
        ex: "edited explanation",
        options: [],
        opts: [],
        type: "填空題",
        answerProvided: true,
      });
      learning.mergeCommunityQuestions([], {
        overrides: [{ unit, question: q }],
      });
      const edited = learning.examEntries(true).find((e) => e.id === id);
      assert.notEqual(edited.q, original.q);
      assert.equal(edited.q.answer, "new answer");
      assert.equal(
        window.courseQuestionTools.matchesSearch(edited.q, "Unique revised"),
        true,
      );
      learning.mergeCommunityQuestions([], { overrides: [] });
      const restored = learning.examEntries(true).find((e) => e.id === id);
      assert.equal(
        restored.q.answer ?? restored.q.a,
        original.q.answer ?? original.q.a,
      );
      assert.equal(
        window.courseQuestionTools.matchesSearch(restored.q, "Unique revised"),
        false,
      );
    },
  );

test("OS replacements reach a unit before it is first parsed", async () => {
  const { document, window } = parseHTML(await read("os.html"));
  for (const select of document.querySelectorAll("select"))
    Object.defineProperty(select, "value", {
      value: select.querySelector("option")?.value || "",
      writable: true,
      configurable: true,
    });
  const context = vm.createContext({
    window,
    document,
    location: { search: "" },
    URLSearchParams,
    console,
    requestAnimationFrame: (callback) => callback(),
  });
  for (const file of [
    "question-tools.js",
    "choice-answers.js",
    "practice-feedback.js",
    "os-learning.js",
  ])
    vm.runInContext(await read("assets/" + file), context);
  const node = [...document.querySelectorAll("script[data-course-unit]")].at(
      -1,
    ),
    q = JSON.parse(node.textContent)[0];
  q.answer = "lazy-edited-answer";
  window.courseLearning.mergeCommunityQuestions([], {
    overrides: [{ unit: node.dataset.courseUnit, question: q }],
  });
  assert.equal(
    window.courseLearning.examEntries(true).find((e) => e.id === q.id).q.answer,
    "lazy-edited-answer",
  );
});

test("unconfirmed edited answers remain unknown in batch lookup", () => {
  const q = {
    id: "unconfirmed",
    stem: "Needs review?",
    options: ["A. first", "B. second"],
    answer: "A",
    choiceKey: "A",
    answerProvided: false,
  };
  const [result] = matchQuestions(
    parseQuestions("1. Needs review?\nA. first\nB. second"),
    buildIndex(expandLibraryQuestion("os", "basics", q)),
    { course: "os" },
  );
  assert.equal(result.status, "review");
  assert.equal(result.answer, "");
});
