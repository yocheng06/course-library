import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import worker from "../dist/server/index.js";
import {
  normalizeBatch,
  uniqueQuestions,
  questionKey,
} from "../worker/model.js";
const origin =
  "https://course-library-submissions-yocheng06.yocheng06.chatgpt.site";
async function setup() {
  const sql = new DatabaseSync(":memory:");
  for (const file of (
    await readdir(new URL("../drizzle/", import.meta.url))
  ).filter((n) => n.endsWith(".sql")))
    sql.exec(
      await readFile(new URL("../drizzle/" + file, import.meta.url), "utf8"),
    );
  const DB = {
    prepare(query) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async first() {
          return sql.prepare(query).get(...values) || null;
        },
        async all() {
          return { results: sql.prepare(query).all(...values) };
        },
        async run() {
          const result = sql.prepare(query).run(...values);
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const objects = new Map();
  const BUCKET = {
    async put(key, bytes, opts) {
      objects.set(key, { bytes, httpMetadata: opts.httpMetadata });
    },
    async get(key) {
      const obj = objects.get(key);
      return obj ? { body: obj.bytes, httpMetadata: obj.httpMetadata } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return {
    DB,
    BUCKET,
    REVIEWER_EMAIL: "owner@example.test",
    RATE_HASH_KEY: "test-hash-salt",
    sql,
  };
}
const payload = () => ({
  course: "os",
  unit: "basics",
  title: "新投稿題庫",
  name: "同學",
  source: "課堂補充",
  questions: [
    {
      category: "測試用分類",
      type: "單選題",
      stem: "新的投稿題目：作業系統怎麼分配測試資源？",
      options: ["A. 分配", "B. 忽略"],
      answer: "A",
      explanation: "核准後才會公開。",
      images: [],
    },
  ],
});
async function call(
  env,
  path,
  {
    method = "GET",
    body,
    reviewer = false,
    otherUser = false,
    siteOrigin = origin,
    ip = "127.0.0.1",
  } = {},
) {
  const headers = {
    "content-type": "application/json",
    origin: siteOrigin,
    "cf-connecting-ip": ip,
  };
  if (reviewer || otherUser) {
    headers["oai-authenticated-user-id"] = reviewer ? "owner-id" : "other-id";
    headers["oai-authenticated-user-email"] = reviewer
      ? "owner@example.test"
      : "student@example.test";
  }
  const response = await worker.fetch(
    new Request(origin + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  let data;
  try {
    data = await response.clone().json();
  } catch {}
  return { response, data };
}
test("anonymous submission stays private; only the owner can review and publish", async () => {
  const env = await setup();
  const submitted = await call(env, "/api/submissions", {
    method: "POST",
    body: { ...payload(), status: "approved", reviewerId: "owner-id" },
  });
  assert.equal(submitted.response.status, 201);
  const id = submitted.data.id;
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    0,
  );
  const status = await call(env, "/api/status/" + id);
  assert.deepEqual(Object.keys(status.data).sort(), [
    "note",
    "reviewedAt",
    "status",
  ]);
  assert.equal(status.data.status, "pending");
  assert.equal((await call(env, "/api/review")).response.status, 401);
  assert.equal(
    (await call(env, "/api/review", { otherUser: true })).response.status,
    403,
  );
  const decision = {
    action: "approve",
    revision: 1,
    payload: payload(),
    note: "",
  };
  assert.equal(
    (await call(env, "/api/review/" + id, { method: "POST", body: decision }))
      .response.status,
    401,
  );
  assert.equal(
    (
      await call(env, "/api/review/" + id, {
        method: "POST",
        body: decision,
        otherUser: true,
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await call(env, "/api/review/" + id, {
        method: "POST",
        body: decision,
        reviewer: true,
        siteOrigin: "https://evil.test",
      })
    ).response.status,
    403,
  );
  const list = await call(env, "/api/review", { reviewer: true });
  assert.equal(list.data.items[0].id, id);
  const approved = await call(env, "/api/review/" + id, {
    method: "POST",
    body: decision,
    reviewer: true,
  });
  assert.equal(approved.response.status, 200);
  const pub = (await call(env, "/api/questions?course=os")).data.questions;
  assert.equal(pub.length, 1);
  assert.equal(pub[0].question.answer, "A");
  assert.equal(pub[0].question.answerProvided, true);
  assert.equal(pub[0].question.stem, payload().questions[0].stem);
  assert.equal(
    (
      await call(env, "/api/review/" + id, {
        method: "POST",
        body: decision,
        reviewer: true,
      })
    ).response.status,
    409,
  );
  const repeat = await call(env, "/api/submissions", {
    method: "POST",
    body: payload(),
  });
  assert.equal(repeat.response.status, 200);
  assert.equal(repeat.data.status, "duplicates_only");
  assert.equal(repeat.data.id, null);
  assert.equal(repeat.data.acceptedCount, 0);
  assert.equal(repeat.data.skippedCount, 1);
});
test("rejecting a submission never publishes it; status gives the submitter the review note", async () => {
  const env = await setup(),
    submitted = await call(env, "/api/submissions", {
      method: "POST",
      body: payload(),
    }),
    id = submitted.data.id;
  const result = await call(env, "/api/review/" + id, {
    method: "POST",
    reviewer: true,
    body: { action: "reject", revision: 1, note: "請補充題目條件。" },
  });
  assert.equal(result.response.status, 200);
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    0,
  );
  assert.equal(
    (await call(env, "/api/status/" + id)).data.note,
    "請補充題目條件。",
  );
});
test("approvals automatically skip questions published since submission", async () => {
  const env = await setup(),
    p = payload(),
    one = await call(env, "/api/submissions", { method: "POST", body: p }),
    two = await call(env, "/api/submissions", { method: "POST", body: p });
  const first = await call(env, "/api/review/" + one.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: p, note: "" },
  });
  assert.equal(first.response.status, 200);
  const second = await call(env, "/api/review/" + two.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: p, note: "" },
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.data.acceptedCount, 0);
  assert.equal(second.data.skippedCount, 1);
  assert.equal(
    (await call(env, "/api/status/" + two.data.id)).data.status,
    "approved",
  );
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    1,
  );
});
test("duplicate items and built-in questions are skipped; invalid data still fails validation", async () => {
  const env = await setup();
  let p = payload();
  p.questions.push(p.questions[0]);
  const deduplicated = await call(env, "/api/submissions", {
    method: "POST",
    body: p,
  });
  assert.equal(deduplicated.response.status, 201);
  assert.equal(deduplicated.data.acceptedCount, 1);
  assert.equal(deduplicated.data.skippedCount, 1);
  assert.equal(deduplicated.data.skipped[0].index, 2);
  assert.equal(deduplicated.data.skipped[0].reason, "batch");
  p = payload();
  p.questions[0].answer = "";
  assert.equal(
    (await call(env, "/api/submissions", { method: "POST", body: p })).response
      .status,
    400,
  );
  p = payload();
  p.questions[0].images = ["javascript:alert(1)"];
  assert.equal(
    (await call(env, "/api/submissions", { method: "POST", body: p })).response
      .status,
    400,
  );
  p = payload();
  p.questions[0].stem = "What is an operating system?";
  p.questions[0].options = [
    "A. A program that manages the computer hardware",
    "B. A text editor",
    "C. A database system",
    "D. A compiler",
  ];
  /* Existing options vary; use exact source below. */ const entries =
    JSON.parse(
      await readFile(
        new URL("../existing-questions.json", import.meta.url),
        "utf8",
      ),
    );
  const q = entries[0];
  p.questions[0] = {
    category: "已有題目",
    type: "單選題",
    stem: q.stem,
    options: q.options,
    answer: "A",
    explanation: "",
    images: [],
  };
  const existing = await call(env, "/api/submissions", {
    method: "POST",
    body: p,
  });
  assert.equal(existing.response.status, 200);
  assert.equal(existing.data.status, "duplicates_only");
  assert.equal(existing.data.skippedCount, 1);
  assert.equal(existing.data.skipped[0].reason, "published");
});
test("pending images require owner identity; only retained images become public after approval", async () => {
  const env = await setup(),
    p = payload();
  p.questions[0].images = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=",
  ];
  const submitted = await call(env, "/api/submissions", {
    method: "POST",
    body: p,
  });
  assert.equal(submitted.response.status, 201);
  const id = submitted.data.id,
    imagePath = "/api/image/" + id + "/0-0";
  assert.equal((await call(env, imagePath)).response.status, 401);
  assert.equal(
    (await call(env, imagePath, { otherUser: true })).response.status,
    403,
  );
  assert.equal(
    (await call(env, imagePath, { reviewer: true })).response.status,
    200,
  );
  const list = (await call(env, "/api/review", { reviewer: true })).data.items;
  const approved = await call(env, "/api/review/" + id, {
    method: "POST",
    reviewer: true,
    body: {
      action: "approve",
      revision: 1,
      payload: list[0].payload,
      note: "",
    },
  });
  assert.equal(approved.response.status, 200);
  assert.equal((await call(env, imagePath)).response.status, 200);
});
test("anonymous posts have bounded rate and allowed origins; public results never include pending records", async () => {
  const env = await setup();
  assert.equal(
    (
      await call(env, "/api/submissions", {
        method: "POST",
        body: payload(),
        siteOrigin: "https://evil.test",
      })
    ).response.status,
    403,
  );
  for (let i = 0; i < 20; i++) {
    const p = payload();
    p.questions[0].stem += " " + i;
    assert.equal(
      (await call(env, "/api/submissions", { method: "POST", body: p }))
        .response.status,
      201,
    );
  }
  const p = payload();
  p.questions[0].stem += " sixth";
  assert.equal(
    (await call(env, "/api/submissions", { method: "POST", body: p })).response
      .status,
    429,
  );
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    0,
  );
  const cors = await call(env, "/api/questions?course=os", {
    siteOrigin: "https://yocheng06.github.io",
  });
  assert.equal(
    cors.response.headers.get("access-control-allow-origin"),
    "https://yocheng06.github.io",
  );
  assert.equal(
    cors.response.headers.get("access-control-allow-credentials"),
    null,
  );
});

test("mixed submissions keep new questions, report original positions and never overwrite existing answers", async () => {
  const env = await setup(),
    p = payload();
  const first = await call(env, "/api/submissions", {
    method: "POST",
    body: p,
  });
  await call(env, "/api/review/" + first.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: p, note: "" },
  });
  const old = {
    ...p.questions[0],
    answer: "B",
    explanation: "不應覆寫既有內容",
  };
  const novel = { ...p.questions[0], stem: "同一批中的新題目？" };
  const mixed = await call(env, "/api/submissions", {
    method: "POST",
    body: {
      ...p,
      questions: [old, novel, old, { ...novel, stem: " 同一批中的新題目？ " }],
    },
  });
  assert.equal(mixed.response.status, 201);
  assert.equal(mixed.data.receivedCount, 4);
  assert.equal(mixed.data.acceptedCount, 1);
  assert.equal(mixed.data.skippedCount, 3);
  assert.deepEqual(
    mixed.data.skipped.map((q) => q.index),
    [1, 3, 4],
  );
  assert.deepEqual(
    mixed.data.skipped.map((q) => q.reason),
    ["published", "batch", "batch"],
  );
  const saved = (
    await call(env, "/api/review", { reviewer: true })
  ).data.items.find((q) => q.id === mixed.data.id);
  assert.equal(saved.payload.questions.length, 1);
  assert.equal(saved.payload.questions[0].stem, novel.stem);
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions[0].question
      .answer,
    "A",
  );
  const countBefore = env.sql
    .prepare("SELECT count(*) AS n FROM submissions")
    .get().n;
  const allOld = await call(env, "/api/submissions", {
    method: "POST",
    body: { ...p, questions: [old, old] },
  });
  assert.equal(allOld.data.status, "duplicates_only");
  assert.equal(allOld.data.skippedCount, 2);
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM submissions").get().n,
    countBefore,
  );
});

test("reimporting a full draft keeps 200 questions and preserves the first version", () => {
  const p = payload();
  const questions = normalizeBatch({
    ...p,
    questions: Array.from({ length: 200 }, (_, i) => ({
      ...p.questions[0],
      stem: "題目 " + i,
    })),
  }).questions;
  const skipped = [];
  const merged = uniqueQuestions(
    p.course,
    p.unit,
    [...questions, ...questions],
    (q) => skipped.push(q),
  );
  assert.equal(merged.length, 200);
  assert.equal(skipped.length, 200);
  assert.equal(
    normalizeBatch({ ...p, questions: merged }).questions.length,
    200,
  );
  const first = normalizeBatch({
    ...p,
    questions: [p.questions[0], { ...p.questions[0], answer: "B" }],
  });
  assert.equal(first.questions[0].answer, "A");
});

test("approval retries a publication collision and publishes only the remaining new questions", async () => {
  const env = await setup(),
    p = payload();
  const novel = { ...p.questions[0], stem: "並行審核時保留的新題目？" };
  const one = await call(env, "/api/submissions", { method: "POST", body: p });
  const both = { ...p, questions: [p.questions[0], novel] };
  const two = await call(env, "/api/submissions", {
    method: "POST",
    body: both,
  });
  const batch = env.DB.batch;
  let collided = false;
  env.DB.batch = async (statements) => {
    if (!collided) {
      collided = true;
      const concurrent = await call(env, "/api/review/" + one.data.id, {
        method: "POST",
        reviewer: true,
        body: { action: "approve", revision: 1, payload: p, note: "" },
      });
      assert.equal(concurrent.response.status, 200);
    }
    return batch(statements);
  };
  const result = await call(env, "/api/review/" + two.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: both, note: "" },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.acceptedCount, 1);
  assert.equal(result.data.skippedCount, 1);
  const questions = (await call(env, "/api/questions?course=os")).data
    .questions;
  assert.equal(questions.length, 2);
  assert.equal(
    questions.filter((q) => q.question.stem === novel.stem).length,
    1,
  );
  assert.match(
    (await call(env, "/api/status/" + two.data.id)).data.note,
    /新增 1 題.*略過 1 題/,
  );
});

test("all 76 approved explanations appear in the public API and reviewer view without changing questions or answers", async () => {
  const env = await setup();
  const content = JSON.parse(
    await readFile(
      new URL("../content/approved-explanations.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(content.entries.length, 76);
  const submissionId = "65307e6c-1612-4c30-b48f-0489756453b5";
  const questions = content.entries.map((entry) => ({
    id: entry.id,
    category: "課堂投稿",
    type: "填空題",
    stem: entry.stem,
    options: entry.options,
    answer: entry.answer,
    explanation: "",
    answerProvided: true,
  }));
  for (const [i, q] of questions.entries()) {
    env.sql
      .prepare(
        "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        q.id,
        "reviewed-fixture-" + i,
        submissionId,
        "os",
        "scheduling",
        JSON.stringify(q),
        i,
      );
  }
  const batch = {
    course: "os",
    unit: "scheduling",
    title: "已核准課堂題庫",
    questions,
  };
  env.sql
    .prepare(
      "INSERT INTO submissions (id,course,unit,title,payload,status,revision,created_at,note) VALUES (?,?,?,?,?,'approved',2,0,'')",
    )
    .run(
      submissionId,
      batch.course,
      batch.unit,
      batch.title,
      JSON.stringify(batch),
    );
  const publicResult = await call(env, "/api/questions?course=os");
  assert.equal(publicResult.response.status, 200);
  assert.equal(publicResult.data.questions.length, 76);
  for (const [i, row] of publicResult.data.questions.entries()) {
    assert.deepEqual(row.question, {
      ...questions[i],
      explanation: content.entries[i].explanation,
    });
    assert(row.question.explanation.length >= 70);
  }
  const reviewed = await call(env, "/api/review?status=approved", {
    reviewer: true,
  });
  assert.equal(reviewed.data.items.length, 1);
  assert.deepEqual(
    reviewed.data.items[0].payload.questions,
    publicResult.data.questions.map((q) => q.question),
  );
  assert.equal(
    JSON.parse(
      env.sql
        .prepare("SELECT data FROM public_questions WHERE id=?")
        .get(questions[0].id).data,
    ).explanation,
    content.entries[0].explanation,
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM content_updates").get().n,
    1,
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM question_history").get().n,
    76,
  );
  await call(env, "/api/questions?course=os");
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM question_history").get().n,
    76,
  );
  const first = questions[0];
  const cleared = {
    ...batch,
    questions: [{ ...first, type: "單選題", images: [], explanation: "" }],
  };
  const saved = await call(env, "/api/manage/questions/" + first.id, {
    method: "POST",
    reviewer: true,
    body: { action: "update", revision: 2, payload: cleared },
  });
  assert.equal(saved.response.status, 200);
  const afterClear = await call(env, "/api/questions?course=os");
  assert.equal(
    afterClear.data.questions.find((q) => q.question.id === first.id).question
      .explanation,
    "",
  );
  assert.equal(
    env.sql.prepare("SELECT count(*) AS n FROM question_history").get().n,
    77,
  );
  env.sql
    .prepare("UPDATE submissions SET status='pending' WHERE id=?")
    .run(submissionId);
  assert(
    (
      await call(env, "/api/review", { reviewer: true })
    ).data.items[0].payload.questions.every((q) => q.explanation),
  );
});

test("reviewed explanations preserve later edits and require the matching id, question, answer and unit", async () => {
  const content = JSON.parse(
    await readFile(
      new URL("../content/approved-explanations.json", import.meta.url),
      "utf8",
    ),
  );
  const entry = content.entries[0];
  for (const change of [
    { explanation: "站主之後補寫的完整解析" },
    { id: "community-00000000-0000-4000-8000-000000000000-1" },
    { stem: "已改成其他問題" },
    { options: ["A. 已修改選項", "B. 另一選項"] },
    { answer: "B" },
    { unit: "basics" },
  ]) {
    const env = await setup();
    const question = {
      id: entry.id,
      stem: entry.stem,
      options: entry.options,
      answer: entry.answer,
      explanation: "",
      ...change,
    };
    env.sql
      .prepare(
        "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) VALUES (?,?,?,?,?,?,0)",
      )
      .run(
        question.id,
        "guard-fixture",
        "fixture",
        "os",
        change.unit || entry.unit,
        JSON.stringify(question),
      );
    const result = await call(env, "/api/questions?course=os");
    assert.deepEqual(result.data.questions[0].question, question);
  }
});

test("images on questions 101 and 200 remain readable by the owner and after approval", async () => {
  const env = await setup(),
    p = payload(),
    png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";
  p.questions = Array.from({ length: 200 }, (_, i) => ({
    ...p.questions[0],
    stem: "圖片邊界 " + i,
    images: i === 100 || i === 199 ? [png] : [],
  }));
  const sent = await call(env, "/api/submissions", { method: "POST", body: p });
  assert.equal(sent.response.status, 201);
  for (const i of [100, 199])
    assert.equal(
      (await call(env, `/api/image/${sent.data.id}/${i}-0`, { reviewer: true }))
        .response.status,
      200,
    );
  const saved = (await call(env, "/api/review", { reviewer: true })).data
    .items[0];
  assert.equal(
    (
      await call(env, "/api/review/" + sent.data.id, {
        method: "POST",
        reviewer: true,
        body: {
          action: "approve",
          revision: 1,
          payload: saved.payload,
          note: "",
        },
      })
    ).response.status,
    200,
  );
  for (const i of [100, 199])
    assert.equal(
      (await call(env, `/api/image/${sent.data.id}/${i}-0`)).response.status,
      200,
    );
});
test("submission validation rejects impossible single-choice and out-of-range answers", async () => {
  for (const answer of ["A,B", "H", "Z", "無法對應的內容"]) {
    const env = await setup(),
      p = payload();
    p.questions[0].answer = answer;
    assert.equal(
      (await call(env, "/api/submissions", { method: "POST", body: p }))
        .response.status,
      400,
    );
  }
  const p = payload();
  p.questions[0].type = "多選題";
  p.questions[0].answer = "A,B";
  assert.equal(normalizeBatch(p).questions[0].choiceKey, "AB");
});
test("relabeled options are flagged for confirmation without automatic deletion", async () => {
  const env = await setup(),
    p = payload();
  p.questions[0].options = ["A. Alpha", "B. Beta"];
  const one = await call(env, "/api/submissions", { method: "POST", body: p });
  await call(env, "/api/review/" + one.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: p, note: "" },
  });
  const q = {
    ...p,
    questions: [
      { ...p.questions[0], options: ["A. Beta", "B. Alpha"], answer: "B" },
    ],
  };
  const check = await call(env, "/api/submissions", {
    method: "POST",
    body: q,
  });
  assert.equal(check.response.status, 409);
  assert.equal(check.data.code, "similar_questions");
  assert.equal(check.data.possibleDuplicates.length, 1);
  const confirmed = await call(env, "/api/submissions", {
    method: "POST",
    body: { ...q, confirmSimilar: true },
  });
  assert.equal(confirmed.response.status, 201);
  const review = await call(env, "/api/review/" + confirmed.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: q, note: "" },
  });
  assert.equal(review.data.code, "similar_questions");
  assert.equal(
    (
      await call(env, "/api/review/" + confirmed.data.id, {
        method: "POST",
        reviewer: true,
        body: {
          action: "approve",
          revision: 1,
          payload: q,
          note: "",
          confirmSimilar: true,
        },
      })
    ).response.status,
    200,
  );
});
test("published management enforces permissions, revisions, history, hide/restore and complete exports", async () => {
  const env = await setup(),
    p = payload(),
    sent = await call(env, "/api/submissions", { method: "POST", body: p });
  await call(env, "/api/review/" + sent.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: p, note: "" },
  });
  const id = `community-${sent.data.id}-1`,
    path = "/api/manage/questions/" + id;
  assert.equal((await call(env, "/api/manage/questions")).response.status, 401);
  assert.equal(
    (await call(env, "/api/manage/export", { otherUser: true })).response
      .status,
    403,
  );
  const current = (await call(env, "/api/manage/questions", { reviewer: true }))
    .data.items[0];
  assert.equal(current.revision, 1);
  const updated = {
    ...p,
    questions: [
      { ...p.questions[0], explanation: "站主在核准之後補上的詳細解析。" },
    ],
  };
  assert.equal(
    (
      await call(env, path, {
        method: "POST",
        body: { action: "update", revision: 1, payload: updated },
      })
    ).response.status,
    401,
  );
  assert.equal(
    (
      await call(env, path, {
        method: "POST",
        reviewer: true,
        siteOrigin: "https://evil.test",
        body: { action: "update", revision: 1, payload: updated },
      })
    ).response.status,
    403,
  );
  const saved = await call(env, path, {
    method: "POST",
    reviewer: true,
    body: { action: "update", revision: 1, payload: updated, note: "補解析" },
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.data.item.revision, 2);
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions[0].question
      .explanation,
    updated.questions[0].explanation,
  );
  assert.equal(
    (
      await call(env, path, {
        method: "POST",
        reviewer: true,
        body: { action: "hide", revision: 1 },
      })
    ).response.status,
    409,
  );
  assert.equal(
    (
      await call(env, path, {
        method: "POST",
        reviewer: true,
        body: { action: "hide", revision: 2 },
      })
    ).response.status,
    200,
  );
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    0,
  );
  assert.equal(
    (await call(env, "/api/manage/questions?state=hidden", { reviewer: true }))
      .data.items.length,
    1,
  );
  assert.equal(
    (
      await call(env, path, {
        method: "POST",
        reviewer: true,
        body: { action: "restore", revision: 3 },
      })
    ).response.status,
    200,
  );
  const history = await call(env, path + "/history", { reviewer: true });
  assert.equal(history.data.items.length, 3);
  assert.equal(
    history.data.items.find((r) => r.revision === 1).data.explanation,
    p.questions[0].explanation,
  );
  const backup = await call(env, "/api/manage/export", { reviewer: true });
  assert.equal(backup.response.status, 200);
  assert.equal(
    backup.data.questions[0].question.explanation,
    updated.questions[0].explanation,
  );
  assert.equal(backup.data.history.length, 3);
  assert.equal(backup.data.submissions.length, 1);
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    1,
  );
});

test("answer matching keeps mathematics case-sensitive and supports explicit bilingual answer labels", () => {
  const key = globalThis.courseChoiceAnswers.expectedChoiceKey;
  assert.equal(key("ω", ["A. ω", "B. O", "C. Ω", "D. o"]), "A");
  assert.equal(key("Ω", ["A. ω", "B. O", "C. Ω", "D. o"]), "C");
  assert.equal(key("o", ["A. O", "B. Ω", "C. o", "D. Θ"]), "C");
  assert.equal(
    key("B. 損毀傾印（Crash dump）", ["A. Logging", "B. Crash dump"]),
    "B",
  );
  assert.equal(key("A. ω", ["A. ω", "B. O", "C. Ω", "D. o"]), "A");
  assert.equal(key("A,B", ["A. first", "B. second"]), "AB");
});

test("L7 accepts new submissions and recognizes all 322 built-in versions without collapsing option order", async () => {
  const entries = JSON.parse(
    await readFile(
      new URL("../existing-questions.json", import.meta.url),
      "utf8",
    ),
  );
  const l7 = entries.filter(
    (q) => q.course === "os" && q.unit === "synchronization",
  );
  assert.equal(l7.length, 322);
  assert.equal(
    new Set(l7.map((q) => questionKey(q.course, q.unit, q))).size,
    322,
  );
  const env = await setup();
  const p = { ...payload(), unit: "synchronization" };
  p.questions[0].stem = "L7 新投稿測試：如何保護共享狀態？";
  const submitted = await call(env, "/api/submissions", {
    method: "POST",
    body: p,
  });
  assert.equal(submitted.response.status, 201);
  const approved = await call(env, "/api/review/" + submitted.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: p, note: "" },
  });
  assert.equal(approved.response.status, 200);
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions[0].unit,
    "synchronization",
  );
  const seen = new Map();
  let variants;
  for (const q of l7) {
    if (!q.options.length) continue;
    const key = JSON.stringify([
      q.stem,
      q.options.map((o) => o.replace(/^[A-H]\. /, "")).sort(),
    ]);
    if (seen.has(key)) {
      variants = [seen.get(key), q];
      break;
    }
    seen.set(key, q);
  }
  assert(variants, "Expected retained option-order variants");
  const duplicateBatch = {
    ...p,
    questions: variants.map((q) => ({
      ...p.questions[0],
      stem: q.stem,
      options: q.options,
      answer: "A",
    })),
  };
  assert.equal(normalizeBatch(duplicateBatch).questions.length, 2);
  const repeated = await call(env, "/api/submissions", {
    method: "POST",
    body: duplicateBatch,
  });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.data.status, "duplicates_only");
  assert.equal(repeated.data.skippedCount, 2);
});
