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
async function setup({ provisionAdmin = true } = {}) {
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
  const env = {
    DB,
    BUCKET,
    REVIEWER_EMAIL: "owner@example.test",
    RATE_HASH_KEY: "test-hash-salt",
    sql,
  };
  if (provisionAdmin) {
    const response = await worker.fetch(
      new Request(origin + "/api/password/setup", {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "oai-authenticated-user-id": "owner-id",
          "oai-authenticated-user-email": "owner@example.test",
        },
        body: JSON.stringify({
          username: "reviewer",
          password: "test-admin-password-123",
          confirmPassword: "test-admin-password-123",
        }),
      }),
      env,
    );
    assert.equal(response.status, 200);
    env.testCookie = response.headers.get("set-cookie").split(";")[0];
  }
  return env;
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
    cookie,
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
  const authCookie = cookie ?? (reviewer ? env.testCookie : undefined);
  if (authCookie) headers.cookie = authCookie;
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

test("submission and review pages serve their complete local module graph with correct MIME types", async () => {
  const env = await setup({ provisionAdmin: false });
  const queue = [];
  for (const route of ["/submit", "/review"]) {
    const response = await worker.fetch(new Request(origin + route), env);
    assert.equal(response.status, 200, route + " must serve a page");
    assert.match(response.headers.get("content-type"), /^text\/html\b/);
    const html = await response.text();
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi))
      queue.push(new URL(match[1], origin + route));
    for (const match of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css(?:\?[^"']*)?)["']/gi))
      queue.push(new URL(match[1], origin + route));
  }
  const visited = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (url.origin !== origin || visited.has(url.pathname)) continue;
    visited.add(url.pathname);
    const response = await worker.fetch(new Request(url), env);
    assert.equal(response.status, 200, url.pathname + " must be included in the Worker assets");
    const content = await response.text();
    assert.equal(
      content,
      await readFile(new URL("../frontend" + url.pathname, import.meta.url), "utf8"),
      url.pathname + " must match its synchronized frontend file",
    );
    if (url.pathname.endsWith(".css")) {
      assert.match(response.headers.get("content-type"), /^text\/css\b/);
      continue;
    }
    assert.match(response.headers.get("content-type"), /^text\/javascript\b/);
    assert(!/^\s*</.test(content), url.pathname + " must not return an HTML fallback");
    for (const match of content.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^"';]*?\s+from\s*)?["'](\.[^"']+)["']/g))
      queue.push(new URL(match[1], url));
  }
  for (const path of [
    "/assets/submission-inbox-ui.mjs",
    "/assets/submission-inbox.mjs",
    "/assets/ui-consistency.css",
  ]) assert(visited.has(path), path + " must be exercised by the page dependency graph");
});

test("reviewer password setup requires the bound owner and protects review endpoints", async () => {
  const env = await setup({ provisionAdmin: false });
  const anonymous = await call(env, "/api/session");
  assert.equal(anonymous.data.accountConfigured, false);
  assert.equal(anonymous.data.canManageCredentials, false);
  const ownerSession = await call(env, "/api/session", {
    reviewer: true,
    cookie: "",
  });
  assert.equal(ownerSession.data.canManageCredentials, true);
  assert.equal(
    (
      await call(env, "/api/password/setup", {
        method: "POST",
        otherUser: true,
        body: {
          username: "reviewer",
          password: "test-admin-password-123",
          confirmPassword: "test-admin-password-123",
        },
      })
    ).response.status,
    403,
  );
  const setupResult = await call(env, "/api/password/setup", {
    method: "POST",
    reviewer: true,
    cookie: "",
    body: {
      username: "reviewer",
      password: "test-admin-password-123",
      confirmPassword: "test-admin-password-123",
    },
  });
  assert.equal(setupResult.response.status, 200);
  const stored = env.sql
    .prepare(
      "SELECT username,salt,password_hash,iterations FROM admin_accounts",
    )
    .get();
  assert.equal(stored.username, "reviewer");
  assert.notEqual(stored.password_hash, "test-admin-password-123");
  assert.equal(stored.iterations, 100000);
  const setupCookie = setupResult.response.headers.get("set-cookie");
  assert.match(setupCookie, /HttpOnly/);
  assert.match(setupCookie, /Secure/);
  assert.match(setupCookie, /SameSite=Strict/);
  assert.equal(
    (await call(env, "/api/review", { reviewer: true, cookie: "" })).response
      .status,
    401,
  );
  const wrongPassword = await call(env, "/api/login", {
    method: "POST",
    body: { username: "reviewer", password: "wrong-password" },
  });
  assert.equal(wrongPassword.response.status, 401);
  const login = await call(env, "/api/login", {
    method: "POST",
    body: { username: "reviewer", password: "test-admin-password-123" },
  });
  assert.equal(login.response.status, 200);
  const loginCookie = login.response.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await call(env, "/api/review", { cookie: loginCookie })).response.status,
    200,
  );
  const logout = await call(env, "/api/logout", {
    method: "POST",
    cookie: loginCookie,
    body: {},
  });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await call(env, "/api/review")).response.status, 401);
  const reset = await call(env, "/api/password/setup", {
    method: "POST",
    reviewer: true,
    cookie: "",
    body: {
      username: "reviewer2",
      password: "new-test-password-456",
      confirmPassword: "new-test-password-456",
    },
  });
  assert.equal(reset.response.status, 200);
  assert.equal(
    (
      await call(env, "/api/login", {
        method: "POST",
        body: { username: "reviewer", password: "test-admin-password-123" },
      })
    ).response.status,
    401,
  );
  const relogin = await call(env, "/api/login", {
    method: "POST",
    body: { username: "reviewer2", password: "new-test-password-456" },
  });
  assert.equal(relogin.response.status, 200);
  for (let attempt = 0; attempt < 5; attempt++)
    assert.equal(
      (
        await call(env, "/api/login", {
          method: "POST",
          ip: "198.51.100.42",
          body: { username: "reviewer2", password: "incorrect-password" },
        })
      ).response.status,
      401,
    );
  assert.equal(
    (
      await call(env, "/api/login", {
        method: "POST",
        ip: "198.51.100.42",
        body: { username: "reviewer2", password: "incorrect-password" },
      })
    ).response.status,
    429,
  );
});
test("one-time setup code creates the admin account without Site identity and cannot be reused", async () => {
  const env = await setup({ provisionAdmin: false });
  env.ADMIN_SETUP_CODE = "f".repeat(48);
  const session = await call(env, "/api/session");
  assert.equal(session.data.canManageCredentials, false);
  assert.equal(session.data.canUseSetupCode, true);
  const setupBody = {
    username: "reviewer",
    password: "test-admin-password-123",
    confirmPassword: "test-admin-password-123",
    setupCode: env.ADMIN_SETUP_CODE,
  };
  const invalid = await call(env, "/api/password/setup", {
    method: "POST",
    ip: "198.51.100.7",
    body: { ...setupBody, setupCode: "invalid-code" },
  });
  assert.equal(invalid.response.status, 401);
  const configured = await call(env, "/api/password/setup", {
    method: "POST",
    body: setupBody,
  });
  assert.equal(configured.response.status, 200);
  assert.match(
    env.sql
      .prepare("SELECT consumed_at FROM admin_setup_state WHERE id=1")
      .get().consumed_at,
    /^\d+:/,
  );
  const afterSetup = await call(env, "/api/session");
  assert.equal(afterSetup.data.canUseSetupCode, false);
  assert.equal(
    (
      await call(env, "/api/password/setup", {
        method: "POST",
        body: { ...setupBody, username: "attacker" },
      })
    ).response.status,
    401,
  );
  assert.equal(
    (
      await call(env, "/api/login", {
        method: "POST",
        body: { username: "reviewer", password: "test-admin-password-123" },
      })
    ).response.status,
    200,
  );
});
test("anonymous submission stays private; only an authenticated reviewer can review and publish", async () => {
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
    401,
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
    401,
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
test("pending images require a reviewer session; only retained images become public after approval", async () => {
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
    401,
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
    2,
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
  const first = questions[27];
  const cleared = {
    ...batch,
    questions: [
      {
        ...first,
        type: first.options.length ? "單選題" : "填空題",
        images: [],
        explanation: "",
      },
    ],
  };
  const saved = await call(env, "/api/manage/questions/" + first.id, {
    method: "POST",
    reviewer: true,
    body: { action: "update", revision: 2, payload: cleared },
  });
  // Incorporated submissions now have one supported editor: the built-in flow.
  assert.equal(saved.response.status, 409);
  assert.equal(saved.data.code, "builtin_question");
  const builtin=(await call(env,"/api/manage/builtin-questions?course=os&q="+first.id,{reviewer:true})).data.items.find(q=>q.id===saved.data.questionId);
  assert.ok(builtin);
  const changed=await call(env,"/api/manage/builtin-questions/os/"+builtin.id,{method:"POST",reviewer:true,body:{action:"update",revision:builtin.revision,sourceHash:builtin.sourceHash,note:"清除過時解析",question:{...builtin.question,explanation:""}}});
  assert.equal(changed.response.status,200);
  const afterClear = await call(env, "/api/questions?course=os");
  assert.equal(afterClear.data.overrides.find(q=>(q.question.id||q.question.bookmarkId)===builtin.id).question.explanation,"");
  assert.equal(env.sql.prepare("SELECT count(*) AS n FROM question_history").get().n,76);
  assert.equal(env.sql.prepare("SELECT count(*) AS n FROM builtin_question_edits").get().n,1);
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
test("option order and relabeling automatically skip duplicates across all units; punctuation differences require review", async () => {
  const env = await setup(),
    p = payload();
  p.questions[0].options = ["A. Alpha", "B. Beta"];
  const sent = await call(env, "/api/submissions", { method: "POST", body: p });
  await call(env, "/api/review/" + sent.data.id, {
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
  const skipped = await call(env, "/api/submissions", {
    method: "POST",
    body: q,
  });
  assert.equal(skipped.data.status, "duplicates_only");
  assert.equal(skipped.data.skippedCount, 1);
  assert.equal(
    (
      await call(env, "/api/submissions", {
        method: "POST",
        body: { ...q, confirmSimilar: true },
      })
    ).data.status,
    "duplicates_only",
  );
  q.questions[0].stem = q.questions[0].stem.replace(/？$/, "");
  const similar = await call(env, "/api/submissions", {
    method: "POST",
    body: q,
  });
  assert.equal(similar.data.code, "similar_questions");
  assert.equal(
    (
      await call(env, "/api/submissions", {
        method: "POST",
        body: { ...q, confirmSimilar: true },
      })
    ).response.status,
    201,
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
    401,
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

test("L7 merges option-order duplicates and recognizes every reviewed source version", async () => {
  const entries = JSON.parse(
    await readFile(
      new URL("../existing-questions.json", import.meta.url),
      "utf8",
    ),
  );
  const l7 = entries.filter(
    (q) => q.course === "os" && q.unit === "synchronization",
  );
  // Canonical-source coverage is checked against the current course files by
  // tests/submission-index.test.mjs. Keep this service test about behavior for
  // every generated version rather than a question count that ages on import.
  const canonicalIds = new Set(l7.map((q) => q.canonicalId));
  assert(canonicalIds.size > 0);
  assert([...canonicalIds].every((id) => typeof id === "string" && id.trim()));
  assert.equal(
    new Set(l7.map((q) => questionKey(q.course, q.unit, q))).size,
    l7.length,
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
  const known = l7.find((q) => q.options.length);
  const reordered = {
    ...known,
    options: known.options
      .map((o) => o.replace(/^[A-H]\. /, ""))
      .reverse()
      .map((o, i) => String.fromCharCode(65 + i) + ". " + o),
  };
  const duplicateBatch = {
    ...p,
    questions: [known, reordered].map((q) => ({
      ...p.questions[0],
      stem: q.stem,
      options: q.options,
      answer: "A",
    })),
  };
  assert.equal(normalizeBatch(duplicateBatch).questions.length, 1);
  const repeated = await call(env, "/api/submissions", {
    method: "POST",
    body: duplicateBatch,
  });
  assert.equal(repeated.data.status, "duplicates_only");
  assert.equal(repeated.data.skippedCount, 2);
  for (let start = 0; start < l7.length; start += 200) {
    const batch = {
      ...p,
      questions: l7.slice(start, start + 200).map((q) => ({
        ...p.questions[0],
        stem: q.stem,
        options: q.options,
        type: q.options.length ? "單選題" : "填空題",
        answer: q.options.length ? "A" : "來源答案",
      })),
    };
    const result = await call(env, "/api/submissions", {
      method: "POST",
      body: batch,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.status, "duplicates_only");
    assert.equal(result.data.skippedCount, batch.questions.length);
  }
});

test("different diagrams stay separate; identical image bytes deduplicate after upload and legacy fingerprints are recomputed", async () => {
  const env = await setup(),
    p = payload();
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";
  const other =
    "data:image/png;base64," +
    btoa(atob(png.split(",")[1]) + "different-test-bytes");
  p.questions = [png, other].map((image) => ({
    ...p.questions[0],
    type: "圖片題",
    images: [image],
    imageKeys: ["forged-same-key"],
  }));
  assert.equal(normalizeBatch(p).questions.length, 2);
  assert.equal(
    normalizeBatch({ ...p, questions: [p.questions[0], p.questions[0]] })
      .questions.length,
    1,
  );
  const sent = await call(env, "/api/submissions", { method: "POST", body: p });
  assert.equal(sent.response.status, 201);
  const stored = (await call(env, "/api/review", { reviewer: true })).data
    .items[0];
  assert.notEqual(
    stored.payload.questions[0].imageKeys[0],
    stored.payload.questions[1].imageKeys[0],
  );
  assert(
    stored.payload.questions.every((q) => q.imageKeys[0].startsWith("sha256:")),
  );
  const approved = await call(env, "/api/review/" + sent.data.id, {
    method: "POST",
    reviewer: true,
    body: { action: "approve", revision: 1, payload: stored.payload, note: "" },
  });
  assert.equal(approved.data.acceptedCount, 2);
  let live = await call(env, "/api/questions?course=os");
  assert.equal(live.data.questions.length, 2);
  for (const row of live.data.questions)
    assert.equal(
      (await call(env, new URL(row.question.images[0].src).pathname)).response
        .status,
      200,
    );
  // Emulate a legacy publication without stable image identity or the new hash.
  const first = env.sql
    .prepare("SELECT * FROM public_questions ORDER BY id")
    .get();
  const raw = JSON.parse(first.data);
  delete raw.imageKeys;
  env.sql
    .prepare("UPDATE public_questions SET data=?,fingerprint=? WHERE id=?")
    .run(JSON.stringify(raw), "legacy-old-hash", first.id);
  const repeated = await call(env, "/api/submissions", {
    method: "POST",
    body: p,
  });
  assert.equal(repeated.data.status, "duplicates_only");
  assert.equal(repeated.data.skippedCount, 2);
  assert.deepEqual(
    repeated.data.skipped.map((q) => q.index),
    [1, 2],
  );
  const legacy = {
    ...raw,
    id: "community-11111111-1111-4111-8111-111111111111-1",
    type: "單選題",
    images: [],
  };
  env.sql
    .prepare(
      "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) VALUES (?,?,?,?,?,?,0)",
    )
    .run(
      legacy.id,
      "text-legacy-hash",
      first.submission_id,
      "os",
      "basics",
      JSON.stringify(legacy),
    );
  const edit = {
    ...payload(),
    questions: [{ ...p.questions[0], type: "單選題", images: [] }],
  };
  const second = env.sql
    .prepare("SELECT * FROM public_questions WHERE id<>? AND id<>?")
    .get(first.id, legacy.id);
  const collision = await call(env, "/api/manage/questions/" + second.id, {
    method: "POST",
    reviewer: true,
    body: { action: "update", revision: 1, payload: edit },
  });
  assert.equal(collision.response.status, 409);
});

test("reviewed merges archive 75 exact snapshots, retain the abbreviation question, preserve originals and history, and redirect old IDs", async () => {
  const env = await setup(),
    spec = JSON.parse(
      await readFile(
        new URL("../content/approved-merges.json", import.meta.url),
        "utf8",
      ),
    ).entries;
  const keptId = "community-65307e6c-1612-4c30-b48f-0489756453b5-28",
    submissionId = "65307e6c-1612-4c30-b48f-0489756453b5";
  const kept = {
    id: keptId,
    category: "排程",
    type: "填空題",
    stem: "請填寫 SJF 的大寫縮寫",
    options: [],
    answer: "SJF",
    explanation: "保留格式要求。",
    images: [],
  };
  const all = [...spec.map((q) => q.data), kept];
  env.sql
    .prepare(
      "INSERT INTO submissions (id,course,unit,title,payload,status,revision,created_at,note) VALUES (?,?,?,?,?,'approved',2,0,'原始審核說明')",
    )
    .run(
      submissionId,
      "os",
      "scheduling",
      "L6",
      JSON.stringify({ ...payload(), unit: "scheduling", questions: all }),
    );
  for (const [i, q] of all.entries())
    env.sql
      .prepare(
        "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        q.id,
        "legacy-" + i,
        submissionId,
        "os",
        "scheduling",
        JSON.stringify(q),
        i,
      );
  const live = await call(env, "/api/questions?course=os");
  assert.equal(live.data.questions.length, 1);
  assert.equal(live.data.questions[0].question.id, keptId);
  assert.equal(live.data.aliases.length, 75);
  assert.equal(
    live.data.aliases.find((a) => a.id === spec[0].id).target,
    spec[0].canonicalId,
  );
  assert.equal(
    env.sql
      .prepare(
        "SELECT count(*) AS n FROM question_history WHERE action='merge'",
      )
      .get().n,
    75,
  );
  for (const item of spec) {
    const row = env.sql
      .prepare("SELECT * FROM public_questions WHERE id=?")
      .get(item.id);
    const raw = JSON.parse(row.data);
    assert.equal(row.is_published, 0);
    assert.equal(row.revision, 2);
    assert.equal(raw.mergedInto, item.canonicalId);
    delete raw.mergedInto;
    assert.deepEqual(raw, item.data);
  }
  await call(env, "/api/session", { reviewer: true });
  await call(env, "/api/questions?course=os");
  assert.equal(
    env.sql
      .prepare(
        "SELECT count(*) AS n FROM question_history WHERE action='merge'",
      )
      .get().n,
    75,
  );
  const manage = await call(
    env,
    "/api/manage/questions?course=os&state=hidden",
    { reviewer: true },
  );
  assert(manage.data.items.every((q) => q.mergedInto));
  const restore = await call(env, "/api/manage/questions/" + spec[0].id, {
    method: "POST",
    reviewer: true,
    body: { action: "restore", revision: 2 },
  });
  assert.equal(restore.response.status, 409);
  const backup = await call(env, "/api/manage/export", { reviewer: true });
  assert.equal(backup.data.questions.length, 76);
  assert.equal(backup.data.history.length, 75);
  assert(backup.data.submissions[0].note.includes("原始審核說明"));
  assert(backup.data.submissions[0].note.includes("75 題"));
  assert.deepEqual(backup.data.submissions[0].payload.questions, all);
});

test("reviewed merge guards preserve questions edited since the review snapshot", async () => {
  const env = await setup();
  const item = JSON.parse(
    await readFile(
      new URL("../content/approved-merges.json", import.meta.url),
      "utf8",
    ),
  ).entries[0];
  const edited = { ...item.data, stem: item.data.stem + " 新增條件" };
  env.sql
    .prepare(
      "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) VALUES (?,?,?,?,?,?,0)",
    )
    .run(
      item.id,
      "oldhash",
      "65307e6c-1612-4c30-b48f-0489756453b5",
      item.course,
      item.unit,
      JSON.stringify(edited),
    );
  const live = await call(env, "/api/questions?course=os");
  assert.equal(live.data.questions.length, 1);
  assert.equal(live.data.aliases.length, 0);
  assert.deepEqual(live.data.questions[0].question, edited);
});

test("all course keys normalize placeholders and option labels while preserving mathematics, images and format instructions", () => {
  const a = {
    stem: "A[__1__] + N ≤ n？",
    options: ["A. θ(N)", "B. θ(n)"],
    images: [],
  };
  for (const [course, unit] of [
    ["os", "scheduling"],
    ["os", "threads"],
    ["algorithms", "L2"],
  ]) {
    assert.equal(
      questionKey(course, unit, a),
      questionKey(course, unit, {
        ...a,
        stem: "A_____ + N ≤ n？",
        options: ["A. θ(n)", "B. θ(N)"],
      }),
    );
    assert.notEqual(
      questionKey(course, unit, a),
      questionKey(course, unit, { ...a, stem: "A_____ + n ≤ n？" }),
    );
    assert.notEqual(
      questionKey(course, unit, a),
      questionKey(course, unit, { ...a, stem: a.stem + "（大寫縮寫）" }),
    );
    assert.notEqual(
      questionKey(course, unit, a),
      questionKey(course, unit, {
        ...a,
        images: ["https://example.test/figure.png"],
      }),
    );
    assert.notEqual(
      questionKey(course, unit, { ...a, images: ["one", "two"] }),
      questionKey(course, unit, { ...a, images: ["two", "one"] }),
    );
  }
});

test("verified translated and mixed-language choices are skipped as built-in duplicates before creating a submission", async () => {
  const env = await setup();
  const cases = [
    {
      stem: "在 Windows 排程中，哪個功能允許應用程式獨立於核心來創建和管理執行緒？",
      options: [
        "A. Completely Fair Scheduler",
        "B. 處理器親和性",
        "C. 使用者模式排程 (UMS)",
        "D. Multilevel queue",
      ],
      answer: "C",
    },
    {
      stem: "In the Windows system, what happens to a thread's priority when its quantum expires?",
      options: [
        "A. It is lowered",
        "B. It changes randomly",
        "C. It is boosted",
        "D. It remains unchanged",
      ],
      answer: "A",
    },
    {
      stem: "分派器 (Dispatcher) 模組的工作包含哪些項目？",
      options: [
        "A. 跳轉到使用者程式中的正確位置以重新啟動該程式",
        "B. Selecting the next process to run",
        "C. 切換到使用者模式",
        "D. Switching context",
      ],
      answer: "A、C、D",
    },
    {
      stem: "In the Round Robin (RR) scheduling algorithm, what is the unit of a small amount of CPU time given to each process?",
      options: [
        "A. Time unit",
        "B. Time block",
        "C. Time quantum",
        "D. Time period",
      ],
      answer: "C",
    },
    {
      stem: "在 POSIX 即時排程中，SCHED_FIFO 的特點是什麼？",
      options: [
        "A. 僅限於單核心系統",
        "B. 提供優先提升",
        "C. 沒有時間分片",
        "D. 提供時間分片",
      ],
      answer: "C",
    },
  ];
  const result = await call(env, "/api/submissions", {
    method: "POST",
    body: {
      ...payload(),
      unit: "scheduling",
      questions: cases.map((q) => ({
        category: "查重回歸",
        type: q.answer.includes("、") ? "多選題" : "單選題",
        explanation: "",
        images: [],
        ...q,
      })),
    },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.status, "duplicates_only");
  assert.equal(result.data.skippedCount, 5);
  assert.equal(result.data.acceptedCount, 0);
});

test("reviewed L7 aliases and reordered mixed-language choices deduplicate, while unreviewed option changes remain new", async () => {
  const env = await setup();
  const cases = [
    {
      stem: "哪種同步機制被稱為「自旋鎖」（spinlock）？",
      options: [
        "A. 互斥鎖",
        "B. Condition Variable",
        "C. 具有等待佇列的信號量",
        "D. Monitor",
      ],
      answer: "A",
    },
    {
      stem: "Which synchronization tool is considered a high-level abstraction that provides a convenient and effective mechanism for process synchronization?",
      options: [
        "A. 信號量",
        "B. Monitor",
        "C. 自旋鎖",
        "D. Mutex",
      ],
      answer: "B",
    },
    {
      stem: "In the bounded-buffer problem, wait(empty) and wait(mutex) are both used in the ______ process.",
      options: [],
      answer: "producer",
    },
  ];
  const batch = {
    ...payload(),
    unit: "synchronization",
    questions: cases.map((q) => ({
      category: "查重回歸",
      type: q.options.length ? "單選題" : "填空題",
      explanation: "",
      images: [],
      ...q,
    })),
  };
  const duplicate = await call(env, "/api/submissions", { method: "POST", body: batch });
  assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.data));
  assert.equal(duplicate.data.status, "duplicates_only");
  assert.equal(duplicate.data.skippedCount, cases.length);
  assert.equal(duplicate.data.acceptedCount, 0);

  const changed = {
    ...batch,
    questions: [{
      ...batch.questions[0],
      options: batch.questions[0].options.map((option, index) => index === 1 ? "B. 新版本中尚未核對的同步機制" : option),
    }],
  };
  const newVersion = await call(env, "/api/submissions", { method: "POST", body: changed });
  assert.equal(newVersion.response.status, 201, JSON.stringify(newVersion.data));
  assert.equal(newVersion.data.acceptedCount, 1);
  assert.equal(newVersion.data.skippedCount, 0);
});

test('anonymous corrections validate real questions, protect review and retain status without changing answers',async()=>{
 const env=await setup();
 const before=await call(env,'/api/questions?course=os');
 const entry=JSON.parse(await readFile(new URL('../existing-questions.json',import.meta.url),'utf8')).find(q=>q.course==='os');
 const body={course:'os',questionId:entry.canonicalId,detail:'此題的解釋可能需要補充適用條件。',suggestion:'請核對課本相關章節。'};
 assert.equal((await call(env,'/api/corrections',{method:'POST',body:{...body,questionId:'missing'}})).response.status,404);
 assert.equal((await call(env,'/api/corrections',{method:'POST',body,siteOrigin:'https://evil.test'})).response.status,403);
 const sent=await call(env,'/api/corrections',{method:'POST',body});assert.equal(sent.response.status,201);
 const id=sent.data.id;
 assert.equal((await call(env,'/api/corrections')).response.status,401);
 const list=await call(env,'/api/corrections',{reviewer:true});assert.equal(list.data.items.length,1);
 const row=list.data.items[0];assert.equal(row.snapshot.canonicalId,entry.canonicalId);
 assert.equal((await call(env,'/api/corrections/'+id,{method:'POST',body:{status:'resolved',revision:1,note:'已確認'}})).response.status,401);
 const decision={status:'confirmed',revision:1,note:'已確認，等待修訂主站題目。'};
 assert.equal((await call(env,'/api/corrections/'+id,{method:'POST',reviewer:true,body:decision})).response.status,200);
 assert.equal((await call(env,'/api/corrections/'+id,{method:'POST',reviewer:true,body:decision})).response.status,409);
 const status=await call(env,'/api/corrections/'+id);assert.equal(status.data.status,'confirmed');assert.equal(status.data.detail,undefined);
 assert.deepEqual((await call(env,'/api/questions?course=os')).data,before.data);
 const exported=await call(env,'/api/manage/export',{reviewer:true});assert.equal(exported.data.corrections.length,1);
});

test('grouped submission retries with the same request ID return one receipt without creating another batch',async()=>{
 const env=await setup();const body={...payload(),clientRequestId:crypto.randomUUID()};
 const first=await call(env,'/api/submissions',{method:'POST',body});assert.equal(first.response.status,201);
 const second=await call(env,'/api/submissions',{method:'POST',body});assert.equal(second.response.status,200);
 assert.equal(second.data.id,first.data.id);assert.equal(second.data.acceptedCount,first.data.acceptedCount);
 assert.equal(env.sql.prepare('SELECT count(*) AS n FROM submissions').get().n,1);
 const changed=structuredClone(body);changed.questions[0].answer='B';
 assert.equal((await call(env,'/api/submissions',{method:'POST',body:changed})).response.status,409);
});

test('future algorithm units stay private until review and become discoverable after approval',async()=>{
 const env=await setup();const body={...payload(),course:'algorithms',unit:'L7',unitTitle:'動態規劃',title:'第七章投稿'};
 body.questions[0].stem='未收錄的第七章投稿題目';
 const posted=await call(env,'/api/submissions',{method:'POST',body});assert.equal(posted.response.status,201);
 assert.equal((await call(env,'/api/units?course=algorithms')).data.units.some(u=>u.id==='L7'),false);
 assert.equal((await call(env,'/api/questions?course=algorithms')).data.questions.length,0);
 const review=await call(env,'/api/review',{reviewer:true});assert.equal(review.data.items[0].payload.unitTitle,'動態規劃');
 const revised={...review.data.items[0].payload,unitTitle:'動態規劃與最佳化'};
 const approved=await call(env,'/api/review/'+posted.data.id,{method:'POST',reviewer:true,body:{action:'approve',revision:1,note:'已核對新單元名稱及內容',payload:revised}});
 assert.equal(approved.response.status,200);
 const catalog=await call(env,'/api/units?course=algorithms');assert.equal(catalog.data.units.find(u=>u.id==='L7').title,'動態規劃與最佳化');
 const published=await call(env,'/api/questions?course=algorithms');assert.equal(published.data.questions[0].unit,'L7');assert.equal(published.data.questions[0].question.unitTitle,'動態規劃與最佳化');
 assert.equal((await call(env,'/api/units?course=invalid')).response.status,400);
});

test('built-in management lists every canonical question privately and saves durable revisions without exposing reviewer notes',async()=>{
 const env=await setup();
 const url='/api/manage/builtin-questions?course=os&q=basics-1';
 assert.equal((await call(env,url)).response.status,401);
 const list=await call(env,url,{reviewer:true});assert.equal(list.response.status,200);
 const row=list.data.items.find(q=>q.id==='basics-1');assert.ok(row);assert.equal(row.revision,0);
 const path='/api/manage/builtin-questions/os/'+row.id;
 const question={...row.question,stem:'管理員已修訂的作業系統題目？',options:['A. updated-correct','B. updated-other'],type:'單選題',answer:'B',answerProvided:true,translation:'Administrator revised operating systems question?',optionTranslations:['A. 已更新甲','B. 已更新乙'],explanation:'已修正解析。'};
 const body={action:'update',revision:row.revision,sourceHash:row.sourceHash,note:'私有管理說明',question};
 assert.equal((await call(env,path,{method:'POST',body})).response.status,401);
 assert.equal((await call(env,path,{method:'POST',reviewer:true,siteOrigin:'https://evil.test',body})).response.status,403);
 assert.equal((await call(env,path,{method:'POST',reviewer:true,body:{...body,sourceHash:'old'}})).response.status,409);
 assert.equal((await call(env,path,{method:'POST',reviewer:true,body:{...body,note:''}})).response.status,400);
 assert.equal((await call(env,path,{method:'POST',reviewer:true,body:{...body,question:{...question,answer:'Z'}}})).response.status,400);
 const saved=await call(env,path,{method:'POST',reviewer:true,body});assert.equal(saved.response.status,200,JSON.stringify(saved.data));assert.equal(saved.data.item.revision,1);
 assert.equal((await call(env,path,{method:'POST',reviewer:true,body})).response.status,409);
 const publicData=(await call(env,'/api/questions?course=os')).data;
 const update=publicData.overrides.find(r=>r.question.id===row.id);assert.equal(update.question.answer,'B');assert.equal(update.question.choiceKey,'B');assert.equal(update.question.originalAnswer,row.question.answer);assert.equal(update.question.sourceVariants,undefined);
 assert.ok(!JSON.stringify(publicData).includes('私有管理說明'));
 const fresh=(await call(env,url,{reviewer:true})).data.items.find(q=>q.id===row.id);assert.equal(fresh.question.answer,'B');assert.equal(fresh.revision,1);
 const history=(await call(env,path+'/history',{reviewer:true})).data.items;assert.equal(history.length,1);assert.equal(history[0].before.stem,row.question.stem);assert.equal(history[0].after.stem,question.stem);
 assert.equal((await call(env,path+'/history')).response.status,401);
 const correction=await call(env,'/api/corrections',{method:'POST',body:{course:'os',questionId:row.id,detail:'已修改題目的解析需要再核對。'}});assert.equal(correction.response.status,201);
 const corrections=(await call(env,'/api/corrections',{reviewer:true})).data.items;assert.equal(corrections[0].snapshot.stem,question.stem);assert.equal(corrections[0].snapshot.answer,'B');
 const duplicate={...payload(),questions:[{...question,images:[]}]};
 assert.equal((await call(env,'/api/submissions',{method:'POST',body:duplicate})).data.status,'duplicates_only');
 const translated={...duplicate,questions:[{...question,stem:question.translation,options:[question.optionTranslations[1],question.options[0]],answer:'A',images:[]}]};
 assert.equal((await call(env,'/api/submissions',{method:'POST',body:translated})).data.status,'duplicates_only');
 const similar={...duplicate,questions:[{...question,stem:question.stem.replace('？',''),images:[]}]};
 const suspect=await call(env,'/api/submissions',{method:'POST',body:similar});assert.equal(suspect.response.status,409);assert.equal(suspect.data.code,'similar_questions');
 const reset=await call(env,path,{method:'POST',reviewer:true,body:{action:'reset',revision:1,sourceHash:row.sourceHash,note:'還原題庫原稿'}});assert.equal(reset.response.status,200);assert.equal(reset.data.item.revision,2);assert.equal(reset.data.item.question.answer,row.question.answer);
 assert.ok(!(await call(env,'/api/questions?course=os')).data.overrides.some(r=>r.question.id===row.id));
 const exported=(await call(env,'/api/manage/export',{reviewer:true})).data;assert.equal(exported.builtinEdits.length,2);assert.ok(exported.builtinQuestions.length>1000);
 const history2=(await call(env,path+'/history',{reviewer:true})).data.items;assert.equal(history2[0].action,'reset');assert.equal(history2[0].before.answer,'B');
});

test('built-in catalog covers both courses, aliases, image retention and conflict protection',async()=>{
 const env=await setup(),catalog=JSON.parse(await readFile(new URL('../builtin-questions.json',import.meta.url),'utf8'));
 for(const course of ['os','algorithms']){
  let cursor=null,count=0;
  do{const result=await call(env,'/api/manage/builtin-questions?course='+course+(cursor?'&cursor='+cursor:''),{reviewer:true});assert.equal(result.response.status,200);count+=result.data.items.length;cursor=result.data.nextCursor;}while(cursor);
  assert.equal(count,catalog.filter(q=>q.course===course).length);
 }
 const image=catalog.find(q=>q.course==='algorithms'&&q.question.images?.length);assert.ok(image);
 const row=(await call(env,'/api/manage/builtin-questions?course=algorithms&q='+image.id,{reviewer:true})).data.items.find(q=>q.id===image.id);
 const path='/api/manage/builtin-questions/algorithms/'+row.id;
 const question={...row.question,answerProvided:false,explanation:'圖形題修正解析。'};
 const body={action:'update',revision:0,sourceHash:row.sourceHash,note:'核對題圖',question};
 assert.equal((await call(env,path,{method:'POST',reviewer:true,body:{...body,question:{...question,images:['https://evil.test/image.png']}}})).response.status,400);
 const results=await Promise.all([call(env,path,{method:'POST',reviewer:true,body}),call(env,path,{method:'POST',reviewer:true,body})]);assert.deepEqual(results.map(r=>r.response.status).sort(),[200,409]);
 const published=(await call(env,'/api/questions?course=algorithms')).data.overrides.find(r=>r.question.bookmarkId===row.id).question;
 assert.equal(published.q,row.question.stem);assert.equal(published.ex,question.explanation);assert.equal(published.answerProvided,false);assert.equal(published.images[0].src,row.question.images[0]);assert.equal(published.imageKeys[0],image.question.imageKeys[0]);
});

test('submission fingerprints recognize the reported blankless bilingual deadlock stems and the reviewed Banker wording',async()=>{
 const env=await setup();
 const {parseQuestions}=await import('../worker/batch-model.js');
 const incoming=parseQuestions(await readFile(new URL('fixtures/batch-deadlocks-20261028.txt',import.meta.url),'utf8'));
 for(const [n,answer] of [[3,'recovery'],[5,'circular wait'],[6,'deadlock'],[9,'C'],[12,'starvation'],[13,'mutual exclusion'],[21,'wait-for'],[23,'hold and wait'],[24,'dining-philosophers'],[26,'unsafe']]){
  const q=incoming[n-1],questions=[{category:'死結回報重現',type:q.options.length?'單選題':'填空題',stem:q.stem,options:q.options.map(o=>o.label+'. '+o.text),answer,images:[]}];
  const result=await call(env,'/api/submissions',{method:'POST',body:{...payload(),unit:'deadlocks',questions}});
  assert.equal(result.response.status,200,`question ${n}: ${JSON.stringify(result.data)}`);assert.equal(result.data.status,'duplicates_only',`question ${n}`);
 }
});
