import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import worker from "../dist/server/index.js";
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
  assert.equal(
    (await call(env, "/api/submissions", { method: "POST", body: payload() }))
      .response.status,
    409,
  );
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
test("duplicate approvals are blocked atomically and do not partially publish", async () => {
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
  assert.equal(second.response.status, 409);
  assert.equal(
    (await call(env, "/api/status/" + two.data.id)).data.status,
    "pending",
  );
  assert.equal(
    (await call(env, "/api/questions?course=os")).data.questions.length,
    1,
  );
});
test("original questions and duplicate items are rejected; untrusted fields cannot bypass validation", async () => {
  const env = await setup();
  let p = payload();
  p.questions.push(p.questions[0]);
  assert.equal(
    (await call(env, "/api/submissions", { method: "POST", body: p })).response
      .status,
    400,
  );
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
  assert.equal(
    (await call(env, "/api/submissions", { method: "POST", body: p })).response
      .status,
    409,
  );
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
