import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadPractice() {
  const context = {
    window: {
      courseQuestionTools: {
        hasProvidedAnswer: (question) =>
          question.answerProvided === true &&
          Boolean(String(question.answer ?? question.a ?? "").trim()),
        answerType: (question) =>
          ["多選題", "複選題"].includes(question.type) ? "多選題" : "單選題",
      },
    },
  };
  vm.runInNewContext(
    readFileSync(join(root, "assets/choice-answers.js"), "utf8"),
    context,
  );
  vm.runInNewContext(
    readFileSync(join(root, "assets/practice-feedback.js"), "utf8"),
    context,
  );
  return context.window.coursePractice;
}

test("single-choice retry marks the wrong selection and the correct option", () => {
  const practice = loadPractice();
  const result = practice.evaluate(
    "C",
    ["A. one", "B. two", "C. three"],
    [0],
    { answerProvided: true, answer: "C", type: "單選題" },
  );

  assert.equal(result.correct, false);
  assert.deepEqual(Array.from(result.incorrectIndices), [0]);
  assert.deepEqual(Array.from(result.expectedIndices), [2]);
  assert.match(practice.optionMark(result, 0).icon, /✕/);
  assert.match(practice.optionMark(result, 2).icon, /✓/);
  assert.equal(practice.optionMark(result, 1).icon, "");
});

test("multi-select retry marks selected correct and incorrect choices only", () => {
  const practice = loadPractice();
  const result = practice.evaluate(
    "A、C",
    ["A. one", "B. two", "C. three", "D. four"],
    [0, 1],
    { answerProvided: true, answer: "A、C", type: "多選題" },
  );

  assert.equal(result.correct, false);
  assert.deepEqual(Array.from(result.correctIndices), [0]);
  assert.deepEqual(Array.from(result.incorrectIndices), [1]);
  assert.equal(practice.optionMark(result, 2).icon, "");
  assert.match(practice.optionMark(result, 0).icon, /✓/);
  assert.match(practice.optionMark(result, 1).icon, /✕/);
  assert.equal(result.revealAnswer, false);
});

test("an exact multi-select answer is accepted for answer display", () => {
  const practice = loadPractice();
  const result = practice.evaluate(
    "A、C",
    ["A. one", "B. two", "C. three"],
    [2, 0],
    { answerProvided: true, answer: "A、C", type: "多選題" },
  );

  assert.equal(result.correct, true);
  assert.equal(result.revealAnswer, true);
  assert.deepEqual(Array.from(result.correctIndices), [0, 2]);
});

test("fill-in answers accept case and spacing variants unless exact formatting is required", () => {
  const practice = loadPractice();
  const question = { answerProvided: true, answer: "cache coherency" };
  const correct = practice.evaluate("cache coherency", [], [], question, " Cache   Coherency ");
  const wrong = practice.evaluate("cache coherency", [], [], question, "cache consistency");
  const exact = practice.evaluate(
    "big-theta(n)",
    [],
    [],
    { answerProvided: true, answer: "big-theta(n)", exact: true },
    "BIG-THETA(n)",
  );
  const complexityCase = practice.evaluate(
    "O(lgn)",
    [],
    [],
    { answerProvided: true, answer: "O(lgn)" },
    "o(lgn)",
  );

  assert.equal(correct.correct, true);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.revealAnswer, false);
  assert.equal(exact.correct, false);
  assert.equal(complexityCase.correct, false);
  assert.match(practice.textMark(wrong).icon, /✕/);
  assert.match(practice.textMark(correct).icon, /✓/);
});

test("empty and unverified responses are not incorrectly graded", () => {
  const practice = loadPractice();
  const empty = practice.evaluate("timer", [], [], { answerProvided: true, answer: "timer" }, "  ");
  const unverified = practice.evaluate(
    "A",
    ["A. one", "B. two"],
    [1],
    { answer: "A", answerProvided: false, reviewIssue: "核對中" },
  );

  assert.equal(empty.correct, null);
  assert.equal(empty.revealAnswer, false);
  assert.equal(unverified.correct, null);
  assert.equal(unverified.revealAnswer, true);
});
