import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadPractice(course) {
  const context = {
    window: {
      courseLearning: {course},
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

function mockElement() {
  const classes = new Set();
  const attributes = new Map();
  const element = {
    classList: {
      add: (name) => classes.add(name),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    attributes,
    icon: null,
    querySelector(selector) {
      if (selector === "input") return this.input ?? null;
      if (selector === "textarea") return this.textarea ?? null;
      if (selector.endsWith("feedback-icon")) return this.icon;
      return null;
    },
    querySelectorAll(selector) { return selector.startsWith("textarea") && this.textarea ? [this.textarea] : []; },
    insertAdjacentHTML(position, html) {
      if (position === "beforeend") {
        const parent = this;
        this.icon = {
          textContent: html.includes("✕") ? "✕" : "✓",
          remove() {
            if (parent.icon === this) parent.icon = null;
          },
        };
      }
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
  };
  return element;
}

function mockCard({ optionCount = 0, text = null } = {}) {
  const options = Array.from({ length: optionCount }, () => {
    const option = mockElement();
    option.input = mockElement();
    return option;
  });
  const entry = text === null ? null : mockElement();
  if (entry) {
    entry.textarea = mockElement();
    entry.textarea.value = text;
  }
  const card = {
    feedbackHtml: "",
    querySelectorAll: (selector) => (selector === ".option" ? options : []),
    querySelector(selector) {
      if (selector === ".practice-entry") return entry;
      if (selector === ".practice-feedback" && this.feedbackHtml)
        return { remove: () => (this.feedbackHtml = "") };
      if (selector === "[data-reveal]")
        return {
          insertAdjacentHTML: (_position, html) => (this.feedbackHtml = html),
        };
      return null;
    },
  };
  return { card, options, entry };
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

test("show applies choice colors and symbols immediately without rerendering", () => {
  const practice = loadPractice();
  const { card, options } = mockCard({ optionCount: 3 });
  const result = practice.evaluate(
    "C",
    ["A. one", "B. two", "C. three"],
    [0],
    { answerProvided: true, answer: "C", type: "單選題" },
  );

  practice.show(card, result, "L2-001");

  assert.equal(options[0].classList.contains("practice-incorrect"), true);
  assert.equal(options[0].icon.textContent, "✕");
  assert.equal(options[0].querySelector("input").getAttribute("aria-invalid"), "true");
  assert.equal(options[2].classList.contains("practice-correct"), true);
  assert.equal(options[2].icon.textContent, "✓");
  assert.match(card.feedbackHtml, /不正確/);
  assert.match(card.feedbackHtml, /再按「檢查答案」/);
});

test("show immediately marks a wrong fill-in response and keeps it editable", () => {
  const practice = loadPractice();
  const { card, entry } = mockCard({ text: "wrong answer" });
  const result = practice.evaluate(
    "cache coherency",
    [],
    [],
    { answerProvided: true, answer: "cache coherency" },
    "wrong answer",
  );

  practice.show(card, result, "L2-002");

  assert.equal(entry.classList.contains("practice-incorrect"), true);
  assert.equal(entry.icon.textContent, "✕");
  assert.equal(entry.querySelector("textarea").value, "wrong answer");
  assert.equal(entry.querySelector("textarea").getAttribute("aria-invalid"), "true");
  assert.match(card.feedbackHtml, /再按「檢查答案」/);
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

test('reviewed aliases are limited to an unchanged answer and matching course and ID', () => {
 const practice=loadPractice('os');
 const q={id:'os8-053',answer:'wait for graph',answerProvided:true};
 assert.equal(practice.evaluate(q.answer,[],[],q,'wait-for graph').correct,true);
 assert.equal(practice.evaluate('different',[],[],{...q,answer:'different'},'wait-for graph').correct,false);
 assert.equal(practice.evaluate(q.answer,[],[],{...q,id:'other'},'wait-for graph').correct,false);
 assert.equal(loadPractice('algorithms').evaluate(q.answer,[],[],q,'wait-for graph').correct,false);
});
test('multi-blank lists tolerate separator spacing but retain mathematical case and blank order',()=>{
 const practice=loadPractice('algorithms');
 const q={q:'[__1__] and [__2__]',a:'O(n) / 1,2,3',answerProvided:true};
 assert.equal(practice.evaluate(q.a,[],[],q,'O(n) / 1, 2, 3').correct,true);
 assert.equal(practice.evaluate(q.a,[],[],{...q,exact:true},'o(n) / 1,2,3').correct,false);
 assert.equal(practice.evaluate(q.a,[],[],q,'1,2,3 / O(n)').correct,false);
 assert.equal(practice.answerParts({q:'[__1__]'},'a / b'),null);
 assert.match(practice.entryMarkup(q,'id','', {className:'',icon:''}),/data-fill-index="1"/);
});
