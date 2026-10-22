import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseBatchInput } from "../assets/batch-import.mjs";
import { buildIndex, matchQuestions } from "../assets/batch-model.mjs";

test("plain numbered mixed-language synchronization batch parses 30 items and only matches verified variants", async () => {
  const raw = await readFile(
    new URL("./fixtures/batch-synchronization-plain-1-30.txt", import.meta.url),
    "utf8",
  );
  const questions = parseBatchInput(raw).questions;
  assert.deepEqual(
    questions.map((q) => q.number),
    Array.from({ length: 30 }, (_, i) => String(i + 1)),
  );
  assert.deepEqual(
    questions.map((q) => q.options.length),
    [4, 4, 4, 0, 4, 0, 0, 4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 4, 0, 0, 0, 4, 4, 4],
  );
  assert(questions.every((q) => !q.issues.length));

  const library = JSON.parse(
    await readFile(new URL("../assets/batch-library.json", import.meta.url), "utf8"),
  );
  const results = matchQuestions(questions, buildIndex(library.entries), {
    course: "os",
  });
  assert.equal(results.filter((result) => result.status === "matched").length, 28);
  assert.equal(results.filter((result) => result.status === "review").length, 1);
  // This imported option says 訊號量, while the only source option is 網絡量.
  // Until that source wording is explicitly verified, do not reuse its key.
  assert.equal(results[18].status, "review");
  assert.equal(results[18].answer, "");
  assert.match(results[18].reason, /選項不同/);
  assert.equal(results.filter((result) => result.status === "unmatched").length, 1);

  assert.equal(results[4].answer, "D. 米飯");
  assert.equal(
    results[7].answer,
    "A. Spinlocks；B. Semaphores；C. Events；D. Mutexes",
  );
  assert.equal(
    results[9].answer,
    "A. 兩個程序互相等待對方釋放鎖；D. 一個程序在等待一個永不發生的事件",
  );
  assert.equal(
    results[16].answer,
    "A. Disabling interrupts；B. Placing the signal(S) code within a critical section；D. Using atomic hardware instructions",
  );
  assert.equal(results[19].answer, "C. 等待");
  assert.equal(results[20].answer, "counting");
  assert.equal(results[21].answer, "adding a new item");
  assert.equal(results[22].answer, "futex");
  assert.equal(results[25].answer, "bowl of rice");
  assert.equal(results[26].answer, "readers");
  assert.equal(results[28].status, "unmatched");
});
