import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { parseBatchInput } from "../assets/batch-import.mjs";
import {
  buildIndex,
  matchQuestions,
  parseQuestions,
  toLibraryQuestion,
  expandLibraryQuestion,
} from "../assets/batch-model.mjs";
const fixture = await readFile(
  new URL("fixtures/batch-deadlocks-20261028.txt", import.meta.url),
  "utf8",
);
const built = JSON.parse(
  await readFile(
    new URL("../assets/batch-library.json", import.meta.url),
    "utf8",
  ),
);
const document = parseHTML("<html><body></body></html>").document;
const questions = parseBatchInput(fixture, { document }).questions,
  index = buildIndex(built.entries);

test("the reported 30 deadlock questions recover all ten missed matches and identify the three items requiring review", () => {
  assert.equal(questions.length, 30);
  for (const unit of ["all", "deadlocks"]) {
    const results = matchQuestions(questions, index, { course: "os", unit });
    assert.deepEqual(
      results
        .map((r, i) => (r.status === "review" ? i + 1 : null))
        .filter(Boolean),
      [4, 18, 30],
    );
    assert.equal(results.filter((r) => r.status === "matched").length, 27);
    for (const [n, answer] of [
      [3, "recovery"],
      [5, "circular wait"],
      [6, "deadlock"],
      [9, "C. Avoidance"],
      [12, "starvation"],
      [13, "mutual exclusion"],
      [21, "wait-for"],
      [23, "hold and wait"],
      [24, "dining-philosophers"],
      [26, "unsafe"],
    ]) {
      assert.equal(results[n - 1].answer, answer, `question ${n}`);
    }
    assert.match(results[3].reason, /livelock/);
    assert.equal(results[3].references[0].id, "os8-056");
    assert.equal(results[3].answer, "");
    assert.match(results[17].reason, /至少一項/);
    assert.equal(results[17].answer, "");
    assert.match(results[29].reason, /SVG/);
    assert.equal(results[29].references[0].id, "os8-028");
    assert.equal(results[29].answer, "");
  }
});

test("blank recovery retains semantic conditions, mathematical operators, number of slots and answer format", () => {
  const base = {
    id: "one",
    stem: "Resource ___ can be shared. (Please answer in lowercase English, connecting words with hyphens)",
    options: [],
    answer: "read-only",
    answerProvided: true,
  };
  const bank = buildIndex(expandLibraryQuestion("os", "deadlocks", base));
  const check = (stem) =>
    matchQuestions(parseQuestions("1. " + stem), bank, { course: "os" })[0];
  assert.equal(
    check(
      "Resource  can be shared.(Please answer in lowercase English, connecting words with hyphens)",
    ).answer,
    "read-only",
  );
  for (const bad of [
    "Resource cannot be shared.(Please answer in lowercase English, connecting words with hyphens)",
    "Resource can be shared.",
    "Resource can be shared.(Please answer in lowercase English, ignore exclusive access)",
  ])
    assert.notEqual(check(bad).status, "matched");
  const invalid = buildIndex(
    expandLibraryQuestion("os", "deadlocks", { ...base, answer: "read only" }),
  );
  assert.equal(
    matchQuestions(
      parseQuestions(
        "1. Resource can be shared.(Please answer in lowercase English, connecting words with hyphens)",
      ),
      invalid,
      { course: "os" },
    )[0].status,
    "review",
  );
  const math = parseQuestions(
    "1. Evaluate the expression\na\n-\nb\nA. 1\nB. 2",
  );
  assert.match(math[0].stem, /a\n-\nb/);
  assert.equal(math[0].issues.length, 0);
  const multiple = buildIndex([
    toLibraryQuestion("os", "deadlocks", {
      id: "two",
      stem: "Resource ___ and ___ can be shared.(Please answer in lowercase English)",
      options: [],
      answer: "x,y",
    }),
  ]);
  assert.notEqual(
    matchQuestions(
      parseQuestions(
        "1. Resource and can be shared.(Please answer in lowercase English)",
      ),
      multiple,
      { course: "os" },
    )[0].status,
    "matched",
  );
});

test("an unconfirmed canonical answer also blocks its preserved source variants and translations", () => {
  const q = {
    id: "flagged",
    stem: "原題？",
    translation: "Translated?",
    options: [],
    answer: "old",
    answerProvided: false,
    note: "原題待核對",
    sourceVariants: [
      {
        stem: "Older wording?",
        options: [],
        answer: "old",
        answerProvided: true,
      },
    ],
  };
  const bank = buildIndex(expandLibraryQuestion("os", "deadlocks", q));
  for (const stem of ["原題？", "Translated?", "Older wording?"]) {
    const [r] = matchQuestions(parseQuestions("1. " + stem), bank, {
      course: "os",
    });
    assert.equal(r.status, "review");
    assert.equal(r.answer, "");
    assert.equal(r.reason, "原題待核對");
  }
});
