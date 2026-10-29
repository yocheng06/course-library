import {
  normalizeBatch,
  questionKey,
  possibleMatches,
  COURSE_UNITS,
} from "./model.js";
/* BUILD_DATA */
/* BUILTIN_MANAGEMENT */
/* LIBRARY_MANAGEMENT */
const SITE_ORIGIN =
  "https://course-library-submissions-yocheng06.yocheng06.chatgpt.site";
const LIBRARY_ORIGIN = "https://yocheng06.github.io";
const ADMIN_COOKIE = "__Host-course-admin";
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_PASSWORD_ITERATIONS = 100000;
const HIDDEN_FINGERPRINT_VERSION = "hidden-question-fingerprints-v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins = new Set([SITE_ORIGIN, LIBRARY_ORIGIN]);
const initializedAdminDatabases = new WeakSet();
class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json;charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
async function removePublished(env, payload, skipped, input) {
  await releaseLegacyHiddenFingerprints(env);
  const keys = await fingerprints(payload);
  const duplicateIndexes = new Set(await duplicates(env, keys, payload));
  const sourceIndexes = new Map();
  input.questions.forEach((q, i) => {
    const key = questionKey(payload.course, payload.unit, {
      stem: q.stem ?? q.q,
      options: q.options ?? q.opts ?? [],
      images: q.images || [],
    });
    if (!sourceIndexes.has(key)) sourceIndexes.set(key, i + 1);
  });
  const keptKeys = [];
  const questions = payload.questions.filter((q, i) => {
    if (duplicateIndexes.has(i + 1)) {
      skipped.push({
        index: sourceIndexes.get(
          questionKey(payload.course, payload.unit, {
            ...q,
            imageKeys: undefined,
          }),
        ),
        stem: q.stem.slice(0, 200),
        reason: "published",
      });
      return false;
    }
    keptKeys.push(keys[i]);
    return true;
  });
  skipped.sort((a, b) => a.index - b.index);
  return { payload: { ...payload, questions }, keys: keptKeys };
}
function duplicateReport(input, payload, skipped) {
  return {
    receivedCount: input.questions.length,
    acceptedCount: payload.questions.length,
    skippedCount: skipped.length,
    skipped,
  };
}
function publicationRows(payload, keys, submissionId, createdAt = Date.now()) {
  return payload.questions.map((q, i) => {
    const id = `community-${submissionId}-${i + 1}`;
    const raw =
      payload.course === "os"
        ? {
            id,
            category: q.category,
            type: q.type,
            stem: q.stem,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            choiceKey: q.choiceKey,
            imageKeys: q.imageKeys,
            answerProvided: true,
            images: q.images.map((src) => ({ src, alt: q.stem })),
            translation: "",
            terms: [],
            note: "",
          }
        : {
            bookmarkId: id,
            category: q.category,
            type: q.type,
            q: q.stem,
            opts: q.options,
            a: q.answer,
            ex: q.explanation,
            choiceKey: q.choiceKey,
            imageKeys: q.imageKeys,
            answerProvided: true,
            images: q.images.map((src) => ({ src, alt: q.stem })),
            warn: false,
            exact: false,
          };
    if (payload.unitTitle) raw.unitTitle = payload.unitTitle;
    return {
      id,
      fingerprint: keys[i],
      submissionId,
      course: payload.course,
      unit: payload.unit,
      data: JSON.stringify(raw),
      createdAt,
    };
  });
}
async function ensureAdminDatabase(env) {
  if (initializedAdminDatabases.has(env.DB)) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS admin_accounts (id INTEGER PRIMARY KEY NOT NULL, username TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, iterations INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS admin_setup_state (id INTEGER PRIMARY KEY NOT NULL CHECK (id=1), consumed_at TEXT)",
  ).run();
  await env.DB.prepare(
    "INSERT INTO admin_setup_state (id,consumed_at) VALUES (1,NULL) ON CONFLICT(id) DO NOTHING",
  ).run();
  initializedAdminDatabases.add(env.DB);
}
async function getAdminAccount(env) {
  await ensureAdminDatabase(env);
  return env.DB.prepare("SELECT * FROM admin_accounts WHERE id=1").first();
}
async function getAdminSetupState(env) {
  await ensureAdminDatabase(env);
  return env.DB.prepare("SELECT * FROM admin_setup_state WHERE id=1").first();
}
function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  if (typeof hex !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(hex))
    throw new Error("Invalid hexadecimal data");
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => parseInt(byte, 16));
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decodeBase64url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function derivePassword(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    ),
    bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations },
      material,
      256,
    );
  return toHex(new Uint8Array(bits));
}
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function cookieValue(request, name) {
  return (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}
async function createAdminCookie(account) {
  const now = Date.now(),
    payload = base64url(
      new TextEncoder().encode(
        JSON.stringify({
          username: account.username,
          issuedAt: now,
          expiresAt: now + ADMIN_SESSION_MS,
          nonce: toHex(crypto.getRandomValues(new Uint8Array(16))),
        }),
      ),
    ),
    key = await crypto.subtle.importKey(
      "raw",
      fromHex(account.password_hash),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    ),
    signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload),
    );
  return `${ADMIN_COOKIE}=${payload}.${base64url(new Uint8Array(signature))}; Path=/; Max-Age=${ADMIN_SESSION_MS / 1000}; Secure; HttpOnly; SameSite=Strict`;
}
async function authenticatedAdmin(request, env, account = undefined) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token || token.length > 1024) return null;
  account ??= await getAdminAccount(env);
  if (
    !account ||
    !Number.isSafeInteger(account.iterations) ||
    account.iterations < 100000 ||
    account.iterations > 100000 ||
    !/^[0-9a-f]{64}$/i.test(account.password_hash)
  )
    return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  try {
    const key = await crypto.subtle.importKey(
        "raw",
        fromHex(account.password_hash),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      ),
      valid = await crypto.subtle.verify(
        "HMAC",
        key,
        decodeBase64url(signature),
        new TextEncoder().encode(payload),
      );
    if (!valid) return null;
    const claims = JSON.parse(
      new TextDecoder().decode(decodeBase64url(payload)),
    );
    if (
      claims.username !== account.username ||
      !Number.isSafeInteger(claims.issuedAt) ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.issuedAt > Date.now() + 60000 ||
      claims.expiresAt <= Date.now() ||
      claims.expiresAt - claims.issuedAt !== ADMIN_SESSION_MS
    )
      return null;
    return account;
  } catch {
    return null;
  }
}
function boundOwnerIdentity(request, env) {
  const id = request.headers.get("oai-authenticated-user-id"),
    email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  if (!env.REVIEWER_EMAIL) throw new HttpError(503, "管理者帳號尚未設定。");
  if (email.toLowerCase() !== env.REVIEWER_EMAIL.toLowerCase()) return null;
  return id;
}
function requireBoundOwner(request, env) {
  if (!env.REVIEWER_EMAIL) throw new HttpError(503, "管理者帳號尚未設定。");
  const id = request.headers.get("oai-authenticated-user-id"),
    email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) throw new HttpError(401, "請先登入綁定的管理者帳號。");
  if (email.toLowerCase() !== env.REVIEWER_EMAIL.toLowerCase())
    throw new HttpError(403, "這個帳號沒有管理者權限。");
  return id;
}
async function owner(request, env) {
  const account = await authenticatedAdmin(request, env);
  if (!account) throw new HttpError(401, "請輸入管理者帳號與密碼登入。");
  return "admin:" + account.username;
}
async function adminLoginLimit(request, env) {
  if (!env.RATE_HASH_KEY) throw new HttpError(503, "登入服務尚未完成設定。");
  const now = Date.now(),
    window = Math.floor(now / (15 * 60 * 1000)),
    ip = request.headers.get("cf-connecting-ip") || "unknown",
    key = await hash(`admin-login:${ip}:${env.RATE_HASH_KEY}:${window}`);
  await env.DB.prepare("DELETE FROM rate_windows WHERE expires_at<?")
    .bind(now)
    .run();
  const result = await env.DB.prepare(
    "INSERT INTO rate_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1,expires_at=excluded.expires_at WHERE count<5 RETURNING count",
  )
    .bind(key, (window + 2) * 15 * 60 * 1000)
    .first();
  if (!result)
    throw new HttpError(429, "登入次數過多，請 15 分鐘後再試。", {
      retryAfter: 900,
    });
  return key;
}
async function adminSetupLimit(request, env) {
  if (!env.RATE_HASH_KEY) throw new HttpError(503, "設定服務尚未完成設定。");
  const now = Date.now(),
    window = Math.floor(now / (15 * 60 * 1000)),
    ip = request.headers.get("cf-connecting-ip") || "unknown",
    key = await hash(`admin-setup:${ip}:${env.RATE_HASH_KEY}:${window}`);
  await env.DB.prepare("DELETE FROM rate_windows WHERE expires_at<?")
    .bind(now)
    .run();
  const result = await env.DB.prepare(
    "INSERT INTO rate_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1,expires_at=excluded.expires_at WHERE count<5 RETURNING count",
  )
    .bind(key, (window + 2) * 15 * 60 * 1000)
    .first();
  if (!result)
    throw new HttpError(429, "設定碼嘗試次數過多，請 15 分鐘後再試。", {
      retryAfter: 900,
    });
  return key;
}
async function adminLogin(request, env) {
  requireOrigin(request, true);
  const key = await adminLoginLimit(request, env),
    body = await readBody(request),
    account = await getAdminAccount(env),
    username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "",
    password = typeof body.password === "string" ? body.password : "";
  if (account) {
    if (
      !Number.isSafeInteger(account.iterations) ||
      account.iterations < 100000 ||
      account.iterations > 100000 ||
      !/^[0-9a-f]{32}$/i.test(account.salt) ||
      !/^[0-9a-f]{64}$/i.test(account.password_hash) ||
      new TextEncoder().encode(password).length > 128
    )
      throw new HttpError(401, "帳號或密碼不正確。");
    const candidate = await derivePassword(
      password,
      account.salt,
      account.iterations,
    );
    if (
      username === account.username &&
      sameSecret(candidate, account.password_hash)
    ) {
      await env.DB.prepare("DELETE FROM rate_windows WHERE key=?")
        .bind(key)
        .run();
      const response = json({
        isReviewer: true,
        userId: "admin:" + account.username,
      });
      response.headers.set("set-cookie", await createAdminCookie(account));
      return response;
    }
  }
  throw new HttpError(401, "帳號或密碼不正確。");
}
async function setupAdmin(request, env) {
  requireOrigin(request, true);
  const body = await readBody(request),
    username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "",
    password = typeof body.password === "string" ? body.password : "",
    confirmation =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    setupCode = typeof body.setupCode === "string" ? body.setupCode : "";
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))
    throw new HttpError(
      400,
      "帳號需為 3 至 32 個英文字母、數字、句點、底線或連字號。",
    );
  const passwordLength = new TextEncoder().encode(password).length;
  if (passwordLength < 12 || passwordLength > 128)
    throw new HttpError(400, "密碼需為 12 至 128 個字元。");
  if (password !== confirmation)
    throw new HttpError(400, "兩次輸入的密碼不一致。");
  await ensureAdminDatabase(env);
  const setupState = await getAdminSetupState(env);
  let setupLimitKey = null;
  if (setupCode) {
    if (!env.ADMIN_SETUP_CODE || setupState?.consumed_at !== null)
      throw new HttpError(401, "一次性設定碼無效或已使用。");
    setupLimitKey = await adminSetupLimit(request, env);
    if (!sameSecret(setupCode, env.ADMIN_SETUP_CODE))
      throw new HttpError(401, "一次性設定碼不正確。");
  } else {
    requireBoundOwner(request, env);
  }
  const existing = await getAdminAccount(env),
    salt = toHex(crypto.getRandomValues(new Uint8Array(16))),
    passwordHash = await derivePassword(
      password,
      salt,
      ADMIN_PASSWORD_ITERATIONS,
    ),
    now = Date.now(),
    consumedMarker = `${now}:${crypto.randomUUID()}`;
  if (setupCode) {
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE admin_setup_state SET consumed_at=? WHERE id=1 AND consumed_at IS NULL",
      ).bind(consumedMarker),
      env.DB.prepare(
        "INSERT INTO admin_accounts (id,username,salt,password_hash,iterations,created_at,updated_at) VALUES (1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,salt=excluded.salt,password_hash=excluded.password_hash,iterations=excluded.iterations,updated_at=excluded.updated_at WHERE (SELECT consumed_at FROM admin_setup_state WHERE id=1)=?",
      ).bind(
        username,
        salt,
        passwordHash,
        ADMIN_PASSWORD_ITERATIONS,
        existing?.created_at || now,
        now,
        consumedMarker,
      ),
    ]);
    if (!results[0].meta.changes || !results[1].meta.changes)
      throw new HttpError(409, "一次性設定碼已使用，請重新登入。");
    await env.DB.prepare("DELETE FROM rate_windows WHERE key=?")
      .bind(setupLimitKey)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO admin_accounts (id,username,salt,password_hash,iterations,created_at,updated_at) VALUES (1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,salt=excluded.salt,password_hash=excluded.password_hash,iterations=excluded.iterations,updated_at=excluded.updated_at",
    )
      .bind(
        username,
        salt,
        passwordHash,
        ADMIN_PASSWORD_ITERATIONS,
        existing?.created_at || now,
        now,
      )
      .run();
  }
  const account = await getAdminAccount(env),
    response = json({
      isReviewer: true,
      userId: "admin:" + account.username,
    });
  response.headers.set("set-cookie", await createAdminCookie(account));
  return response;
}
function clearAdminCookie() {
  const response = json({ ok: true });
  response.headers.set(
    "set-cookie",
    `${ADMIN_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`,
  );
  return response;
}
function requireOrigin(request, admin = false) {
  const origin = request.headers.get("origin");
  if (admin ? origin !== SITE_ORIGIN : !origins.has(origin))
    throw new HttpError(403, "請從課程網站送出此操作。");
}
async function readBody(request, maxBytes = 9 * 1024 * 1024) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "請以 JSON 格式送出資料。");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "投稿檔案太大，請分批送出。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "沒有投稿資料。");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "投稿檔案太大，請分批送出。");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new HttpError(400, "投稿資料不是有效的 JSON。");
  }
}
async function hash(value) {
  const data = await crypto.subtle.digest(
    "SHA-256",
    typeof value === "string" ? new TextEncoder().encode(value) : value,
  );
  return [...new Uint8Array(data)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function fingerprints(payload) {
  return Promise.all(
    payload.questions.map((q) =>
      hash(questionKey(payload.course, payload.unit, q)),
    ),
  );
}
async function releaseLegacyHiddenFingerprints(env) {
  if (
    await env.DB.prepare("SELECT id FROM content_updates WHERE id=?")
      .bind(HIDDEN_FINGERPRINT_VERSION)
      .first()
  )
    return;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE public_questions SET fingerprint='__hidden__:' || id || ':' || revision WHERE is_published=0 AND substr(fingerprint,1,11)<>'__hidden__:'",
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO content_updates (id,applied_at) VALUES (?,?)",
    ).bind(HIDDEN_FINGERPRINT_VERSION, Date.now()),
  ]);
}
async function duplicates(env, keys, payload, excludeId = null) {
  const builtinRows = await publicBuiltinOverrides(env, payload.course),
    deletedBuiltins = new Set(
      builtinRows
        .filter((row) => row.deleted)
        .map((row) => row.question.id || row.question.bookmarkId),
    ),
    baseKeys = BASE_FINGERPRINTS.filter((_, i) => {
      const base = BASE_QUESTIONS[i];
      return (
        (!excludeId || base.canonicalId !== excludeId) &&
        !(base.course === payload.course && deletedBuiltins.has(base.canonicalId))
      );
    });
  const found = new Set(keys.filter((k) => baseKeys.includes(k)));
  for (const row of builtinRows) {
    if(!row.deleted && row.unit===payload.unit && (row.question.id || row.question.bookmarkId)!==excludeId)
      for(const q of builtinVariants(row.question))found.add(await hash(questionKey(payload.course,row.unit,q)));
  }
  const result = await env.DB.prepare(
    "SELECT id,course,unit,data,fingerprint,is_published FROM public_questions WHERE course=? AND unit=?",
  )
    .bind(payload.course, payload.unit)
    .all();
  for (const row of result.results) {
    if (row.id === excludeId || !row.is_published) continue;
    const raw = JSON.parse(row.data),
      q = canonicalQuestion(raw);
    await attachImageKeys(env, { questions: [q] }, { questions: [raw] });
    found.add(await hash(questionKey(row.course, row.unit, q)));
    found.add(row.fingerprint);
  }
  return keys.map((key, i) => (found.has(key) ? i + 1 : null)).filter(Boolean);
}
async function attachImageKeys(env, payload, original = { questions: [] }) {
  const trusted = new Map();
  for (const q of original.questions)
    (q.images || []).forEach((img, i) => {
      const src = typeof img === "string" ? img : img.src;
      if (q.imageKeys?.[i]) trusted.set(src, q.imageKeys[i]);
    });
  for (const q of payload.questions)
    q.imageKeys = await Promise.all(
      (q.images || []).map(async (image) => {
        const src = typeof image === "string" ? image : image.src;
        const decoded = decodeImage(src);
        if (decoded) return "sha256:" + (await hash(decoded.bytes));
        if (trusted.has(src)) return trusted.get(src);
        if (src.startsWith(SITE_ORIGIN + "/api/image/")) {
          const match =
            /^\/api\/image\/([0-9a-f-]{36})\/((?:[0-9]|[1-9][0-9]|1[0-9]{2})-[01])$/.exec(
              new URL(src).pathname,
            );
          if (match) {
            const object = await env.BUCKET.get(
              `submissions/${match[1]}/${match[2]}`,
            );
            if (object)
              return (
                "sha256:" +
                (await hash(await new Response(object.body).arrayBuffer()))
              );
          }
        }
        return src;
      }),
    );
}
async function limit(request, env) {
  if (!env.RATE_HASH_KEY) throw new HttpError(503, "投稿服務尚未完成設定。");
  const now = Date.now(),
    window = Math.floor(now / 3600000),
    ip = request.headers.get("cf-connecting-ip") || "unknown",
    key = await hash(ip + env.RATE_HASH_KEY + window);
  const result = await env.DB.prepare(
    "INSERT INTO rate_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count",
  )
    .bind(key, (window + 2) * 3600000)
    .first();
  if (!result)
    throw new HttpError(429, "這個網路在一小時內已送出 20 次，請稍後再投稿。");
  await env.DB.prepare("DELETE FROM rate_windows WHERE expires_at<?")
    .bind(now)
    .run();
}
function decodeImage(image) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    image,
  );
  if (!match) return null;
  let raw;
  try {
    raw = atob(match[2]);
  } catch {
    throw new HttpError(400, "題圖編碼不正確。");
  }
  if (raw.length > 1024 * 1024) throw new HttpError(413, "每張題圖最多 1 MB。");
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const png =
      bytes.length > 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v),
    jpeg =
      bytes.length > 3 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255,
    webp = raw.slice(0, 4) === "RIFF" && raw.slice(8, 12) === "WEBP";
  if (
    !(
      (match[1] === "png" && png) ||
      (match[1] === "jpeg" && jpeg) ||
      (match[1] === "webp" && webp)
    )
  )
    throw new HttpError(400, "題圖檔案格式與內容不符。");
  return { bytes, contentType: "image/" + match[1] };
}
async function submit(request, env) {
  requireOrigin(request);
  const body = await readBody(request);
  if (body.website) throw new HttpError(400, "投稿未送出，請重新整理後再試。");
  let payload;
  const skipped = [];
  try {
    payload = normalizeBatch(body, { onDuplicate: (q) => skipped.push(q) });
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  let requestHash;
  if (body.clientRequestId !== undefined) {
    if (!uuid.test(body.clientRequestId)) throw new HttpError(400,'批次識別碼不正確。');
    requestHash=await hash(JSON.stringify(payload));
    const previous=await env.DB.prepare('SELECT payload,status FROM submissions WHERE id=?').bind(body.clientRequestId).first();
    if(previous){
      const saved=JSON.parse(previous.payload);
      if(saved.requestHash!==requestHash)throw new HttpError(409,'此批次識別碼已使用，請重新匯入修改後的檔案。');
      return json({id:body.clientRequestId,status:previous.status,...saved.requestResult});
    }
  }
  await attachImageKeys(env, payload);
  let keys;
  ({ payload, keys } = await removePublished(env, payload, skipped, body));
  const report = duplicateReport(body, payload, skipped);
  await checkSimilar(env, payload, body.confirmSimilar);
  if (!payload.questions.length)
    return json({ id: null, status: "duplicates_only", ...report });
  const uploads = [];
  let imageBytes = 0;
  for (const [i, q] of payload.questions.entries())
    for (const [j, image] of q.images.entries()) {
      const decoded = decodeImage(image);
      if (decoded) {
        imageBytes += decoded.bytes.length;
        uploads.push({ ...decoded, i, j });
      }
    }
  if (imageBytes > 6 * 1024 * 1024)
    throw new HttpError(413, "整份投稿題圖最多 6 MB，請分批投稿。");
  const textOnly = {
    ...payload,
    questions: payload.questions.map((q) => ({
      ...q,
      images: q.images.map((image) =>
        image.startsWith("data:") ? "uploaded-image" : image,
      ),
    })),
  };
  if (new TextEncoder().encode(JSON.stringify(textOnly)).length > 1500000)
    throw new HttpError(413, "題目文字太多，請分批投稿。");
  await limit(request, env);
  const id = body.clientRequestId || crypto.randomUUID();
  if(requestHash){payload.requestHash=requestHash;payload.requestResult=report;}
  const saved = [];
  try {
    for (const image of uploads) {
      const key = `submissions/${id}/${image.i}-${image.j}`;
      await env.BUCKET.put(key, image.bytes, {
        httpMetadata: { contentType: image.contentType },
      });
      saved.push(key);
      payload.questions[image.i].images[image.j] =
        SITE_ORIGIN + "/api/image/" + id + "/" + image.i + "-" + image.j;
    }
    const createdAt = Date.now();
    const rows = publicationRows(payload, keys, id, createdAt);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO submissions (id,course,unit,title,payload,status,revision,created_at,reviewed_at,reviewer_id,note) VALUES (?,?,?,?,?,'approved',1,?,?,'community','投稿後立即加入公開題庫')",
      ).bind(
        id,
        payload.course,
        payload.unit,
        payload.title,
        JSON.stringify(payload),
        createdAt,
        createdAt,
      ),
      env.DB.prepare(
        "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.fingerprint'),json_extract(value,'$.submissionId'),json_extract(value,'$.course'),json_extract(value,'$.unit'),json_extract(value,'$.data'),json_extract(value,'$.createdAt') FROM json_each(?) WHERE EXISTS (SELECT 1 FROM submissions WHERE id=? AND status='approved' AND reviewer_id='community')",
      ).bind(JSON.stringify(rows), id),
    ]);
  } catch (error) {
    if(requestHash){
      const previous=await env.DB.prepare('SELECT payload,status FROM submissions WHERE id=?').bind(id).first();
      const stored=previous && JSON.parse(previous.payload);
      if(stored?.requestHash===requestHash)return json({id,status:previous.status,...stored.requestResult});
    }
    await Promise.allSettled(saved.map((key) => env.BUCKET.delete(key)));
    if (String(error).includes("UNIQUE constraint failed: public_questions.fingerprint"))
      throw new HttpError(409, "題庫剛加入相同題目，請重新檢查重複清單後再送出。");
    throw error;
  }
  return json({ id, status: "approved", ...report }, 201);
}
function supplementApprovedQuestion(
  question,
  course,
  unit,
  id = question.id ?? question.bookmarkId,
) {
  const supplement = REVIEWED_EXPLANATIONS[id];
  if (!supplement || String(question.explanation ?? question.ex ?? "").trim())
    return question;
  if (
    supplement.course !== course ||
    supplement.unit !== unit ||
    supplement.answer !== (question.answer ?? question.a) ||
    supplement.key !==
      questionKey(course, unit, {
        stem: question.stem ?? question.q,
        options: question.options ?? question.opts ?? [],
      })
  )
    return question;
  return {
    ...question,
    [course === "algorithms" ? "ex" : "explanation"]: supplement.explanation,
  };
}
function submissionRow(row) {
  const payload = JSON.parse(row.payload);
  if (row.status === "approved") {
    payload.questions = payload.questions.map((q, i) =>
      supplementApprovedQuestion(
        q,
        payload.course,
        payload.unit,
        `community-${row.id}-${i + 1}`,
      ),
    );
  }
  return {
    id: row.id,
    payload,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    note: row.note,
  };
}
async function listReview(request, env, url) {
  await owner(request, env);
  const status = url.searchParams.get("status") || "pending";
  if (!["pending", "approved", "rejected"].includes(status))
    throw new HttpError(400, "審核狀態不正確。");
  const cursor = url.searchParams.get("cursor");
  let records;
  if (cursor) {
    if (!uuid.test(cursor)) throw new HttpError(400, "分頁編號不正確。");
    const pivot = await env.DB.prepare(
      "SELECT created_at FROM submissions WHERE id=?",
    )
      .bind(cursor)
      .first();
    if (!pivot) throw new HttpError(400, "分頁編號已失效。");
    records = await env.DB.prepare(
      "SELECT * FROM submissions WHERE status=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 21",
    )
      .bind(status, pivot.created_at, pivot.created_at, cursor)
      .all();
  } else
    records = await env.DB.prepare(
      "SELECT * FROM submissions WHERE status=? ORDER BY created_at DESC,id DESC LIMIT 21",
    )
      .bind(status)
      .all();
  const rows = records.results.slice(0, 20);
  const items = rows.map(submissionRow);
  if (status === "approved" && rows.length) {
    const placeholders = rows.map(() => "?").join(",");
    const publications = await env.DB.prepare(
      `SELECT submission_id,id,is_published,revision,data FROM public_questions WHERE submission_id IN (${placeholders}) ORDER BY submission_id,created_at,id`,
    )
      .bind(...rows.map((row) => row.id))
      .all();
    const bySubmission = new Map();
    for (const publication of publications.results) {
      const entries = bySubmission.get(publication.submission_id) || [];
      entries.push({
        id: publication.id,
        questionNumber: Number(publication.id.match(/-(\d+)$/)?.[1]) || 0,
        revision: publication.revision,
        published: Boolean(publication.is_published),
        mergedInto: JSON.parse(publication.data).mergedInto || null,
      });
      bySubmission.set(publication.submission_id, entries);
    }
    for (const item of items)
      item.publications = (bySubmission.get(item.id) || []).sort(
        (a, b) => a.questionNumber - b.questionNumber,
      );
  }
  return json({
    items,
    nextCursor: records.results.length > 20 ? rows.at(-1).id : null,
  });
}
async function manageSubmissionPublications(request, env, id) {
  const actor = await owner(request, env);
  requireOrigin(request, true);
  const body = await readBody(request);
  if (!body || !["hide", "restore"].includes(body.action))
    throw new HttpError(400, "下架操作不正確。");
  if (
    !Array.isArray(body.questions) ||
    !body.questions.length ||
    body.questions.length > 200
  )
    throw new HttpError(400, "請選擇 1 到 200 題再操作。");
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 2000))
    throw new HttpError(400, "修改說明格式不正確。");

  const submission = await env.DB.prepare(
    "SELECT status,payload FROM submissions WHERE id=?",
  )
    .bind(id)
    .first();
  if (!submission) throw new HttpError(404, "找不到這份投稿。");
  if (submission.status !== "approved")
    throw new HttpError(409, "只有已核准的投稿可以管理上架狀態。");

  const approvedPayload = JSON.parse(submission.payload),
    requests = new Map();
  for (const item of body.questions) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !Number.isSafeInteger(item.revision) ||
      item.revision < 1
    )
      throw new HttpError(400, "題目編號或版本格式不正確。");
    const match = /^community-([0-9a-f-]{36})-([1-9]\d*)$/.exec(item.id);
    if (!match || match[1] !== id || Number(match[2]) > approvedPayload.questions.length)
      throw new HttpError(400, "題目不屬於這份已核准投稿。");
    if (requests.has(item.id)) throw new HttpError(400, "題目不可重複選取。");
    requests.set(item.id, item.revision);
  }

  const result = await env.DB.prepare(
    "SELECT * FROM public_questions WHERE submission_id=?",
  )
    .bind(id)
    .all();
  const byId = new Map(result.results.map((row) => [row.id, row]));
  const targetPublished = body.action === "restore" ? 1 : 0,
    currentPublished = targetPublished ? 0 : 1,
    changed = [],
    restoredFingerprints = new Set();
  for (const [questionId, expectedRevision] of requests) {
    const row = byId.get(questionId);
    if (!row) throw new HttpError(404, "找不到所選的已發布題目。");
    if (row.is_published === targetPublished) continue;
    if (row.revision !== expectedRevision)
      throw new HttpError(409, "題目狀態已更新，請重新載入後再操作。");
    if (body.action === "restore" && JSON.parse(row.data).mergedInto)
      throw new HttpError(409, "此題已整合至內建題目，不能單獨重新上架。");
    let fingerprint;
    if (body.action === "restore") {
      const raw = JSON.parse(row.data),
        restored = {
          course: row.course,
          unit: row.unit,
          questions: [canonicalQuestion(raw)],
        };
      await attachImageKeys(env, restored, { questions: [raw] });
      [fingerprint] = await fingerprints(restored);
      if (
        restoredFingerprints.has(fingerprint) ||
        (await duplicates(env, [fingerprint], restored, row.id)).length
      )
        throw new HttpError(409, "已有相同題目，請先處理重複題再還原。");
      restoredFingerprints.add(fingerprint);
    } else {
      fingerprint = `__hidden__:${row.id}:${row.revision + 1}`;
    }
    changed.push({
      id: row.id,
      revision: row.revision,
      historyId: crypto.randomUUID(),
      fingerprint,
    });
  }
  if (!changed.length)
    return json({ action: body.action, changedCount: 0 });

  const packed = JSON.stringify(changed),
    now = Date.now(),
    note = body.note?.trim() ||
      (body.action === "hide" ? "從已核准投稿批次下架" : "從已核准投稿批次重新上架"),
    expectedCount = changed.length,
    exactRows = `(
      SELECT COUNT(*)
      FROM public_questions AS checked
      JOIN json_each(?) AS requested ON checked.id=json_extract(requested.value,'$.id')
      WHERE checked.submission_id=?
        AND checked.revision=json_extract(requested.value,'$.revision')
        AND checked.is_published=?
    )`;
  const history = env.DB.prepare(
    `INSERT INTO question_history (id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
      SELECT json_extract(requested.value,'$.historyId'),current.id,current.revision,current.course,current.unit,current.data,current.is_published,?,?,?,?
      FROM public_questions AS current
      JOIN json_each(?) AS requested ON current.id=json_extract(requested.value,'$.id')
      WHERE current.submission_id=?
        AND current.revision=json_extract(requested.value,'$.revision')
        AND current.is_published=?
        AND ${exactRows}=?`,
  ).bind(
    body.action,
    actor,
    note,
    now,
    packed,
    id,
    currentPublished,
    packed,
    id,
    currentPublished,
    expectedCount,
  );
  const update = env.DB.prepare(
    `UPDATE public_questions
      SET is_published=?,
        fingerprint=(SELECT json_extract(requested.value,'$.fingerprint')
          FROM json_each(?) AS requested
          WHERE json_extract(requested.value,'$.id')=public_questions.id),
        revision=revision+1,updated_at=?
      WHERE submission_id=?
        AND is_published=?
        AND EXISTS (
          SELECT 1 FROM json_each(?) AS requested
          WHERE json_extract(requested.value,'$.id')=public_questions.id
            AND json_extract(requested.value,'$.revision')=public_questions.revision
        )
        AND ${exactRows}=?`,
  ).bind(
    targetPublished,
    packed,
    now,
    id,
    currentPublished,
    packed,
    packed,
    id,
    currentPublished,
    expectedCount,
  );
  let results;
  try {
    results = await env.DB.batch([history, update]);
  } catch (error) {
    if (String(error).includes("public_questions.fingerprint"))
      throw new HttpError(409, "題庫剛加入相同題目，請重新載入後再還原。");
    throw error;
  }
  if (
    results[0].meta.changes !== expectedCount ||
    results[1].meta.changes !== expectedCount
  )
    throw new HttpError(409, "題目狀態已更新，未完成操作；請重新載入後再試。");
  return json({ action: body.action, changedCount: expectedCount });
}
function storedImagesOnly(original, payload, id) {
  const allowed = new Set(original.questions.flatMap((q) => q.images));
  for (const q of payload.questions)
    for (const image of q.images) {
      if (
        image.startsWith("data:") ||
        (!allowed.has(image) && image.startsWith(SITE_ORIGIN + "/api/image/"))
      )
        throw new HttpError(400, "審核時只能保留本份投稿已上傳的題圖。");
      if (
        image.startsWith(SITE_ORIGIN + "/api/image/") &&
        !image.includes("/" + id + "/")
      )
        throw new HttpError(400, "題圖不屬於這份投稿。");
    }
}
async function decide(request, env, id) {
  const reviewer = await owner(request, env);
  requireOrigin(request, true);
  const body = await readBody(request);
  const row = await env.DB.prepare("SELECT * FROM submissions WHERE id=?")
    .bind(id)
    .first();
  if (!row) throw new HttpError(404, "找不到這份投稿。");
  if (row.status !== "pending" || body.revision !== row.revision)
    throw new HttpError(409, "投稿狀態已改變，請重新載入後再審核。");
  if (!["approve", "reject"].includes(body.action))
    throw new HttpError(400, "審核操作不正確。");
  if (typeof body.note !== "string" || body.note.length > 2000)
    throw new HttpError(400, "審核說明格式不正確。");
  if (body.action === "reject" && !body.note.trim())
    throw new HttpError(400, "請填寫退回原因。");
  const original = JSON.parse(row.payload);
  let payload = original;
  if (body.action === "approve") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const skipped = [];
      try {
        payload = normalizeBatch(body.payload, {
          onDuplicate: (q) => skipped.push(q),
        });
      } catch (error) {
        throw new HttpError(400, error.message);
      }
      storedImagesOnly(original, payload, id);
      await attachImageKeys(env, payload, original);
      let keys;
      ({ payload, keys } = await removePublished(
        env,
        payload,
        skipped,
        body.payload,
      ));
      const report = duplicateReport(body.payload, payload, skipped);
      await checkSimilar(env, payload, body.confirmSimilar);
      const reviewNote = skipped.length
        ? `本次新增 ${report.acceptedCount} 題，自動略過 ${report.skippedCount} 題重複題目。\n${body.note.trim()}`
            .trim()
            .slice(0, 2000)
        : body.note.trim();
      const statements = [],
        published = [];
      for (const [i, q] of payload.questions.entries()) {
        const questionId = `community-${id}-${i + 1}`;
        const raw =
          payload.course === "os"
            ? {
                id: questionId,
                category: q.category,
                type: q.type,
                stem: q.stem,
                options: q.options,
                answer: q.answer,
                explanation: q.explanation,
                choiceKey: q.choiceKey,
                imageKeys: q.imageKeys,
                answerProvided: true,
                images: q.images.map((src) => ({ src, alt: q.stem })),
                translation: "",
                terms: [],
                note: "",
              }
            : {
                bookmarkId: questionId,
                category: q.category,
                type: q.type,
                q: q.stem,
                opts: q.options,
                a: q.answer,
                ex: q.explanation,
                choiceKey: q.choiceKey,
                imageKeys: q.imageKeys,
                answerProvided: true,
                images: q.images.map((src) => ({ src, alt: q.stem })),
                warn: false,
                exact: false,
              };
        if (payload.unitTitle) raw.unitTitle = payload.unitTitle;
        published.push({
          id: questionId,
          fingerprint: keys[i],
          submissionId: id,
          course: payload.course,
          unit: payload.unit,
          data: JSON.stringify(raw),
          createdAt: Date.now(),
        });
      }
      statements.push(
        env.DB.prepare(
          "INSERT INTO public_questions (id,fingerprint,submission_id,course,unit,data,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.fingerprint'),json_extract(value,'$.submissionId'),json_extract(value,'$.course'),json_extract(value,'$.unit'),json_extract(value,'$.data'),json_extract(value,'$.createdAt') FROM json_each(?) WHERE EXISTS (SELECT 1 FROM submissions WHERE id=? AND status='pending' AND revision=?)",
        ).bind(JSON.stringify(published), id, row.revision),
      );
      statements.push(
        env.DB.prepare(
          "UPDATE submissions SET payload=?,course=?,unit=?,title=?,status='approved',revision=revision+1,reviewed_at=?,reviewer_id=?,note=? WHERE id=? AND status='pending' AND revision=?",
        ).bind(
          JSON.stringify(payload),
          payload.course,
          payload.unit,
          payload.title,
          Date.now(),
          reviewer,
          reviewNote,
          id,
          row.revision,
        ),
      );
      try {
        const results = await env.DB.batch(statements);
        if (!results.at(-1).meta.changes)
          throw new HttpError(409, "投稿狀態已改變，請重新載入。");
      } catch (error) {
        if (String(error).includes("UNIQUE")) {
          if (attempt < 2) continue;
          throw new HttpError(
            409,
            "題庫持續更新中，請稍後再核准，系統會自動略過重複題。",
          );
        }
        throw error;
      }
      return json({ status: "approved", ...report });
    }
  } else {
    const result = await env.DB.prepare(
      "UPDATE submissions SET status='rejected',revision=revision+1,reviewed_at=?,reviewer_id=?,note=? WHERE id=? AND status='pending' AND revision=?",
    )
      .bind(Date.now(), reviewer, body.note.trim(), id, row.revision)
      .run();
    if (!result.meta.changes)
      throw new HttpError(409, "投稿狀態已改變，請重新載入。");
  }
  return json({ status: body.action === "approve" ? "approved" : "rejected" });
}
async function ensureReviewedContent(env) {
  await materializeReviewedExplanations(env);
  if (
    await env.DB.prepare("SELECT id FROM content_updates WHERE id=?")
      .bind(MERGE_VERSION)
      .first()
  )
    return;
  const ids = Object.keys(REVIEWED_MERGES);
  let found = 0;
  const affected = new Set();
  for (let start = 0; start < ids.length; start += 25) {
    const chunk = ids.slice(start, start + 25);
    const rows = await env.DB.prepare(
      `SELECT * FROM public_questions WHERE id IN (${chunk.map(() => "?").join(",")})`,
    )
      .bind(...chunk)
      .all();
    found += rows.results.length;
    const statements = [];
    for (const row of rows.results) {
      const spec = REVIEWED_MERGES[row.id],
        raw = JSON.parse(row.data);
      if (raw.mergedInto === spec.target) affected.add(row.submission_id);
      if (
        raw.mergedInto ||
        row.course !== spec.course ||
        row.unit !== spec.unit ||
        !row.is_published ||
        (await hash(JSON.stringify(raw))) !== spec.snapshot
      )
        continue;
      affected.add(row.submission_id);
      const now = Date.now();
      statements.push(
        historyStatement(
          env,
          row,
          "reviewed-content",
          "merge",
          "已核對重複題，合併至 " + spec.target,
          now,
        ),
      );
      statements.push(
        env.DB.prepare(
          "UPDATE public_questions SET data=?,fingerprint=?,is_published=0,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND data=?",
        ).bind(
          JSON.stringify({ ...raw, mergedInto: spec.target }),
          `__hidden__:${row.id}:${row.revision + 1}`,
          now,
          row.id,
          row.revision,
          row.data,
        ),
      );
    }
    if (statements.length) await env.DB.batch(statements);
  }
  for (const id of affected) {
    const submission = await env.DB.prepare(
      "SELECT * FROM submissions WHERE id=? AND status='approved'",
    )
      .bind(id)
      .first();
    if (!submission || submission.note.includes("已核對並合併重複投稿"))
      continue;
    const archived = await env.DB.prepare(
      "SELECT id,data FROM public_questions WHERE submission_id=? AND is_published=0",
    )
      .bind(id)
      .all();
    const count = archived.results.filter(
      (row) =>
        REVIEWED_MERGES[row.id] &&
        JSON.parse(row.data).mergedInto === REVIEWED_MERGES[row.id].target,
    ).length;
    const note = `2026-10-16 已核對並合併重複投稿 ${count} 題；原稿與解析保留，舊連結會開啟收錄題目。`;
    await env.DB.prepare(
      "UPDATE submissions SET note=?,revision=revision+1 WHERE id=? AND note=? AND status='approved'",
    )
      .bind(
        (submission.note.slice(0, 1800) + "\n" + note).trim(),
        id,
        submission.note,
      )
      .run();
  }
  if (found === ids.length)
    await env.DB.prepare(
      "INSERT OR IGNORE INTO content_updates (id,applied_at) VALUES (?,?)",
    )
      .bind(MERGE_VERSION, Date.now())
      .run();
}
// A bounded, idempotent content backfill, separate from schema migrations.
async function materializeReviewedExplanations(env) {
  if (
    await env.DB.prepare("SELECT id FROM content_updates WHERE id=?")
      .bind(REVIEWED_CONTENT_VERSION)
      .first()
  )
    return;
  const ids = Object.keys(REVIEWED_EXPLANATIONS),
    affectedSubmissions = new Set();
  let found = 0;
  for (let start = 0; start < ids.length; start += 25) {
    const chunk = ids.slice(start, start + 25);
    const result = await env.DB.prepare(
      `SELECT * FROM public_questions WHERE id IN (${chunk.map(() => "?").join(",")})`,
    )
      .bind(...chunk)
      .all();
    found += result.results.length;
    const statements = [];
    for (const row of result.results) {
      const old = JSON.parse(row.data),
        enriched = supplementApprovedQuestion(old, row.course, row.unit);
      if (enriched === old) continue;
      const now = Date.now();
      statements.push(
        historyStatement(
          env,
          row,
          "reviewed-content",
          "補充解析",
          "2026-10-16 已審閱解析整合",
          now,
        ),
      );
      statements.push(
        env.DB.prepare(
          "UPDATE public_questions SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND data=?",
        ).bind(JSON.stringify(enriched), now, row.id, row.revision, row.data),
      );
      affectedSubmissions.add(row.submission_id);
    }
    if (statements.length) await env.DB.batch(statements);
  }
  for (const id of affectedSubmissions) {
    const row = await env.DB.prepare(
      "SELECT * FROM submissions WHERE id=? AND status='approved'",
    )
      .bind(id)
      .first();
    if (!row) continue;
    const payload = JSON.parse(row.payload);
    payload.questions = payload.questions.map((q, i) =>
      supplementApprovedQuestion(
        q,
        payload.course,
        payload.unit,
        `community-${id}-${i + 1}`,
      ),
    );
    await env.DB.prepare(
      "UPDATE submissions SET payload=?,revision=revision+1 WHERE id=? AND payload=? AND status='approved'",
    )
      .bind(JSON.stringify(payload), id, row.payload)
      .run();
  }
  if (found)
    await env.DB.prepare(
      "INSERT OR IGNORE INTO content_updates (id,applied_at) VALUES (?,?)",
    )
      .bind(REVIEWED_CONTENT_VERSION, Date.now())
      .run();
}
function historyStatement(env, row, actor, action, note, now) {
  return env.DB.prepare(
    "INSERT INTO question_history (id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at) SELECT ?,id,revision,course,unit,data,is_published,?,?,?,? FROM public_questions WHERE id=? AND revision=? AND data=?",
  ).bind(
    crypto.randomUUID(),
    action,
    actor,
    note,
    now,
    row.id,
    row.revision,
    row.data,
  );
}
function canonicalQuestion(data) {
  return {
    category: data.category,
    type:
      data.type ||
      (data.options?.length || data.opts?.length ? "單選題" : "填空題"),
    stem: data.stem ?? data.q,
    options: data.options ?? data.opts ?? [],
    answer: data.answer ?? data.a,
    explanation: data.explanation ?? data.ex ?? "",
    images: (data.images || []).map((img) =>
      typeof img === "string" ? img : img.src,
    ),
  };
}
function publicationRow(row) {
  return {
    id: row.id,
    builtinTarget:builtinReference(row.course,row.id)?.id || null,
    submissionId: row.submission_id,
    course: row.course,
    unit: row.unit,
    unitTitle: JSON.parse(row.data).unitTitle || "",
    question: canonicalQuestion(JSON.parse(row.data)),
    revision: row.revision,
    published: Boolean(row.is_published),
    mergedInto: JSON.parse(row.data).mergedInto || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
async function suspectedDuplicates(env, payload, excludeId = null) {
  const builtinRows = await publicBuiltinOverrides(env, payload.course),
    deletedBuiltins = new Set(
      builtinRows
        .filter((row) => row.deleted)
        .map((row) => row.question.id || row.question.bookmarkId),
    ),
    known = BASE_QUESTIONS
    .filter((q) => q.canonicalId !== excludeId && !(q.course === payload.course && deletedBuiltins.has(q.canonicalId)))
    .map((q) => ({ ...q, id: "內建題庫" }));
  for(const row of builtinRows)
    if(!row.deleted && row.unit===payload.unit && (row.question.id || row.question.bookmarkId)!==excludeId)for(const q of builtinVariants(row.question))known.push({...q,course:payload.course,unit:row.unit,id:'內建題庫（已修訂）'});
  const result = await env.DB.prepare(
    "SELECT id,course,unit,data,is_published FROM public_questions WHERE course=?",
  )
    .bind(payload.course)
    .all();
  for (const row of result.results) {
    if (row.id === excludeId || !row.is_published) continue;
    known.push({
      ...canonicalQuestion(JSON.parse(row.data)),
      id: row.id,
      course: row.course,
      unit: row.unit,
    });
  }
  return possibleMatches(
    payload.course,
    payload.unit,
    payload.questions,
    known,
  );
}
async function checkSimilar(env, payload, confirmed, excludeId = null) {
  if (confirmed === true || !payload.questions.length) return;
  const possibleDuplicates = await suspectedDuplicates(env, payload, excludeId);
  if (possibleDuplicates.length)
    throw new HttpError(
      409,
      "發現題幹僅有標點差異的疑似重複題，請確認後再送出。",
      { code: "similar_questions", possibleDuplicates },
    );
}
async function listPublications(request, env, url) {
  await owner(request, env);
  await ensureReviewedContent(env);
  const course = url.searchParams.get("course") || "os",
    state = url.searchParams.get("state") || "published";
  if (!COURSE_UNITS[course] || !["published", "hidden", "all"].includes(state))
    throw new HttpError(400, "篩選條件不正確。");
  const cursor = url.searchParams.get("cursor") || "",
    query = (url.searchParams.get("q") || "").trim();
  if (
    (cursor && !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(cursor)) ||
    query.length > 100
  )
    throw new HttpError(400, "查詢條件不正確。");
  let sql = "SELECT * FROM public_questions WHERE course=?",
    params = [course];
  if (state !== "all") {
    sql += " AND is_published=?";
    params.push(state === "published" ? 1 : 0);
  }
  if (query) {
    sql += " AND instr(data,?)>0";
    params.push(query);
  }
  if (cursor) {
    sql += " AND id>?";
    params.push(cursor);
  }
  const result = await env.DB.prepare(sql + " ORDER BY id LIMIT 26")
    .bind(...params)
    .all();
  return json({
    items: result.results.slice(0, 25).map(publicationRow),
    nextCursor: result.results.length > 25 ? result.results[24].id : null,
  });
}
async function getCommunityQuestion(env, id) {
  const row = await env.DB.prepare(
    "SELECT * FROM public_questions WHERE id=? AND is_published=1",
  )
    .bind(id)
    .first();
  if (!row || JSON.parse(row.data).mergedInto || builtinReference(row.course, id))
    throw new HttpError(404, "找不到這道公開投稿題目。");
  return json({ item: publicationRow(row) });
}
async function editPublication(request, env, id, { publicEdit = false } = {}) {
  const actor = publicEdit ? "匿名投稿者" : await owner(request, env);
  requireOrigin(request, !publicEdit);
  if (!publicEdit) await ensureReviewedContent(env);
  const body = await readBody(request),
    row = await env.DB.prepare("SELECT * FROM public_questions WHERE id=?")
      .bind(id)
      .first();
  if (!row) throw new HttpError(404, "找不到題目。");
  if (
    publicEdit &&
    (!row.is_published || JSON.parse(row.data).mergedInto || builtinReference(row.course, id))
  )
    throw new HttpError(404, "找不到這道公開投稿題目。");
  if(builtinReference(row.course,id))throw new HttpError(409,"此題已整合為內建題，請到「內建題目管理」儲存修改。",{code:"builtin_question",questionId:builtinReference(row.course,id).id});
  if (JSON.parse(row.data).mergedInto)
    throw new HttpError(
      409,
      "此題已合併，請修改對應的收錄題目；原稿保留於紀錄與備份。",
    );
  if (body.revision !== row.revision)
    throw new HttpError(
      409,
      "題目已更新，請重新載入後再修改；本機草稿仍保留。",
    );
  if (
    publicEdit
      ? !["update", "delete"].includes(body.action)
      : !["update", "hide", "restore", "restoreVersion", "rollback", "resetOriginal"].includes(body.action)
  )
    throw new HttpError(400, "操作不正確。");
  const note = body.note ?? "";
  if (typeof note !== "string" || note.length > 2000)
    throw new HttpError(400, "修改說明格式不正確。");
  if (publicEdit && body.action === "delete") await limit(request, env);
  let raw = JSON.parse(row.data),
    course = row.course,
    unit = row.unit,
    fingerprint = row.fingerprint;
  let sourcePayload = body.payload,
    sourceData = raw;
  const restoringContent = ["restoreVersion", "rollback", "resetOriginal"].includes(body.action);
  if (restoringContent) {
    if (body.action === "restoreVersion" && (typeof body.historyId !== "string" || !uuid.test(body.historyId)))
      throw new HttpError(400, "歷史版本編號不正確。");
    const historical = body.action === "restoreVersion"
      ? await env.DB.prepare("SELECT course,unit,data FROM question_history WHERE id=? AND question_id=?").bind(body.historyId,id).first()
      : await env.DB.prepare("SELECT course,unit,data FROM question_history WHERE question_id=? ORDER BY revision " + (body.action === "rollback" ? "DESC" : "ASC") + ",created_at " + (body.action === "rollback" ? "DESC" : "ASC") + ",id ASC LIMIT 1").bind(id).first();
    if (!historical)
      throw new HttpError(404, "找不到這道題目的歷史版本。");
    sourceData = JSON.parse(historical.data);
    if (sourceData.mergedInto)
      throw new HttpError(409, "這個歷史版本已合併，不能直接還原。");
    sourcePayload = {
      course: historical.course,
      unit: historical.unit,
      unitTitle: sourceData.unitTitle || "",
      title: "還原歷史版本",
      questions: [{
        ...canonicalQuestion(sourceData),
        translation: sourceData.translation || "",
        optionTranslations: Array.isArray(sourceData.optionTranslations) ? sourceData.optionTranslations : [],
        note: sourceData.note || "",
        answerProvided: sourceData.answerProvided !== false,
      }],
    };
  }
  if (body.action === "update" || restoringContent) {
    let batch;
    try {
      batch = normalizeBatch(sourcePayload);
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    if (
      publicEdit &&
      (batch.course !== row.course ||
        batch.unit !== row.unit ||
        (batch.unitTitle || "") !== (JSON.parse(row.data).unitTitle || ""))
    )
      throw new HttpError(400, "公開修正只能修改原投稿題目內容，不能更換科目、單元或新單元名稱。");
    if (sourcePayload.questions.length !== 1)
      throw new HttpError(400, "每次只修改一題。");
    storedImagesOnly(
      { questions: [canonicalQuestion(sourceData)] },
      batch,
      row.submission_id,
    );
    await attachImageKeys(env, batch, { questions: [sourceData] });
    await checkSimilar(env, batch, body.confirmSimilar, id);
    if (publicEdit) await limit(request, env);
    [fingerprint] = await fingerprints(batch);
    if ((await duplicates(env, [fingerprint], batch, id)).length)
      throw new HttpError(409, "修改後與既有題目完全重複，請調整內容。");
    const q = batch.questions[0];
    const editorQuestion = sourcePayload.questions[0];
    for (const [field, limit] of [["translation", 10000], ["note", 4000]]) {
      if (editorQuestion[field] !== undefined && (typeof editorQuestion[field] !== "string" || editorQuestion[field].length > limit))
        throw new HttpError(400, `${field === "translation" ? "題幹翻譯" : "題目備註"}格式不正確。`);
    }
    if (editorQuestion.optionTranslations !== undefined &&
      (!Array.isArray(editorQuestion.optionTranslations) || editorQuestion.optionTranslations.length > 8 ||
       editorQuestion.optionTranslations.some((value) => typeof value !== "string" || value.length > 2000)))
      throw new HttpError(400, "選項翻譯格式不正確。");
    if (editorQuestion.answerProvided !== undefined && typeof editorQuestion.answerProvided !== "boolean")
      throw new HttpError(400, "答案確認狀態不正確。");
    course = batch.course;
    unit = batch.unit;
    const images = q.images.map((src) => ({ src, alt: q.stem }));
    const retained = row.course === course ? (restoringContent ? sourceData : raw) : {};
    raw =
      course === "os"
        ? {
            ...retained,
            id,
            category: q.category,
            type: q.type,
            stem: q.stem,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            images,
            answerProvided: true,
            choiceKey: q.choiceKey,
            imageKeys: q.imageKeys,
          }
        : {
            ...retained,
            bookmarkId: id,
            category: q.category,
            type: q.type,
            q: q.stem,
            opts: q.options,
            a: q.answer,
            ex: q.explanation,
            images,
            answerProvided: true,
            choiceKey: q.choiceKey,
            imageKeys: q.imageKeys,
          };
    if(batch.unitTitle)raw.unitTitle=batch.unitTitle;else delete raw.unitTitle;
    if(editorQuestion.translation !== undefined)raw.translation=editorQuestion.translation.trim();
    if(editorQuestion.optionTranslations !== undefined)raw.optionTranslations=editorQuestion.optionTranslations.map((value)=>value.trim());
    if(editorQuestion.note !== undefined)raw.note=editorQuestion.note.trim();
    if(editorQuestion.answerProvided !== undefined)raw.answerProvided=editorQuestion.answerProvided;
  }
  const published =
      body.action === "hide" || body.action === "delete"
        ? 0
        : body.action === "restore"
          ? 1
          : row.is_published,
    now = Date.now();
  if (published && !row.is_published) {
    const restored = {
      course: row.course,
      unit: row.unit,
      questions: [canonicalQuestion(raw)],
    };
    await attachImageKeys(env, restored, { questions: [raw] });
    [fingerprint] = await fingerprints(restored);
    if ((await duplicates(env, [fingerprint], restored, id)).length)
      throw new HttpError(
        409,
        "已有相同題目，請先處理重複題再還原。",
      );
  } else if (!published) {
    // Free the unique public fingerprint so the same question can be re-posted.
    // The original content remains in the row and history for owner recovery.
    fingerprint = `__hidden__:${id}:${row.revision + 1}`;
  }
  const statements = [
    historyStatement(
      env,
      row,
      actor,
      body.action,
      publicEdit
        ? note.trim() ||
          (body.action === "delete"
            ? "匿名使用者刪除公開題目（站主可還原）"
            : "匿名投稿者直接修正題目")
        : note,
      now,
    ),
    env.DB.prepare(
      "UPDATE public_questions SET course=?,unit=?,fingerprint=?,data=?,is_published=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
    ).bind(
      course,
      unit,
      fingerprint,
      JSON.stringify(raw),
      published,
      now,
      id,
      row.revision,
    ),
  ];
  let result;
  try {
    result = await env.DB.batch(statements);
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      throw new HttpError(409, "這道題目剛被其他操作更新，請重新載入。");
    throw e;
  }
  if (!result[1].meta.changes)
    throw new HttpError(409, "題目已更新，請重新載入。");
  return json({
    item: publicationRow({
      ...row,
      course,
      unit,
      data: JSON.stringify(raw),
      is_published: published,
      revision: row.revision + 1,
      updated_at: now,
    }),
  });
}
async function publicationHistory(request, env, id) {
  await owner(request, env);
  const result = await env.DB.prepare(
    "SELECT * FROM question_history WHERE question_id=? ORDER BY created_at DESC,id DESC LIMIT 50",
  )
    .bind(id)
    .all();
  return json({
    items: result.results.map((r) => ({ ...r, data: JSON.parse(r.data) })),
  });
}
async function exportBackup(request, env) {
  await owner(request, env);
  await ensureReviewedContent(env);
  const [questions, submissions, history, corrections, builtinEdits] = await Promise.all([
    // The complete edit log allows restoring changes independently of a browser.
    env.DB.prepare("SELECT * FROM public_questions ORDER BY id").all(),
    env.DB.prepare("SELECT * FROM submissions ORDER BY created_at,id").all(),
    env.DB.prepare(
      "SELECT * FROM question_history ORDER BY created_at,id",
    ).all(),
    env.DB.prepare("SELECT * FROM question_corrections ORDER BY created_at,id").all(),
    env.DB.prepare("SELECT * FROM builtin_question_edits ORDER BY course,question_id,revision").all(),
  ]);
  return json({
    schemaVersion: 1,
    builtinQuestions: BUILTIN_QUESTIONS,
    builtinEdits: builtinEdits.results.map(r=>({...r,data:JSON.parse(r.data),previous_data:JSON.parse(r.previous_data)})),
    corrections: corrections.results.map(row=>({...row,snapshot:JSON.parse(row.snapshot)})),
    exportedAt: new Date().toISOString(),
    questions: questions.results.map((r) => ({
      ...publicationRow(r),
      fingerprint: r.fingerprint,
      data: JSON.parse(r.data),
    })),
    submissions: submissions.results.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload),
    })),
    history: history.results.map((r) => ({ ...r, data: JSON.parse(r.data) })),
  });
}

async function imageResponse(request, env, id, file) {
  const src = SITE_ORIGIN + "/api/image/" + id + "/" + file;
  const published = await env.DB.prepare(
    "SELECT id FROM public_questions WHERE submission_id=? AND is_published=1 AND instr(data,?)>0 LIMIT 1",
  )
    .bind(id, src)
    .first();
  if (!published) await owner(request, env);
  const object = await env.BUCKET.get(`submissions/${id}/${file}`);
  if (!object) throw new HttpError(404, "找不到題圖。");
  const headers = new Headers({
    "content-type": object.httpMetadata.contentType,
    "cache-control": published ? "public,max-age=86400" : "private,no-store",
    "x-content-type-options": "nosniff",
  });
  return new Response(object.body, { headers });
}

async function correction(request, env, url, id) {
  if (request.method === 'POST' && !id) {
    requireOrigin(request);
    const body = await readBody(request, 48000);
    if (!body || Array.isArray(body) || body.website || !COURSE_UNITS[body.course] || typeof body.questionId !== 'string' || body.questionId.length > 160 ||
        (body.answerSnapshot !== undefined && (typeof body.answerSnapshot !== 'string' || body.answerSnapshot.length>4000)) ||
        typeof body.detail !== 'string' || body.detail.trim().length < 5 || body.detail.length > 4000 ||
        (body.suggestion !== undefined && (typeof body.suggestion !== 'string' || body.suggestion.length > 4000)))
      throw new HttpError(400, '請選擇題目並填寫至少 5 字的問題說明；說明與建議各最多 4,000 字。');
    const base=BUILTIN_QUESTIONS.find(q=>q.course===body.course && (q.id===body.questionId || q.question.aliases?.includes(body.questionId)));
    const latest=base ? (await latestBuiltinEdits(env,body.course)).get(base.id) : null;
    let snapshot=base ? {...(latest && latest.action!=='reset' ? JSON.parse(latest.data) : base.question),canonicalId:base.id} : null;
    if (!snapshot && /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(body.questionId)) {
      const row = await env.DB.prepare('SELECT course,unit,data FROM public_questions WHERE id=? AND is_published=1').bind(body.questionId).first();
      if (row?.course === body.course) snapshot = {course:row.course,unit:row.unit,...JSON.parse(row.data)};
    }
    if (!snapshot) throw new HttpError(404, '找不到這個公開題目，請回到題庫重新開啟回報。');
    await limit(request, env);
    const receipt = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO question_corrections (id,course,question_id,snapshot,detail,suggestion,status,note,revision,created_at) VALUES (?,?,?,?,?,?,'pending','',1,?)")
      .bind(receipt,body.course,body.questionId,JSON.stringify({...snapshot,reportedAnswer:body.answerSnapshot||''}),body.detail.trim(),(body.suggestion || '').trim(),Date.now()).run();
    return json({id:receipt,status:'pending'},201);
  }
  if (request.method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT status,note,reviewed_at FROM question_corrections WHERE id=?').bind(id).first();
    if (!row) throw new HttpError(404,'找不到這個勘誤編號。');
    return json({status:row.status,note:row.note,reviewedAt:row.reviewed_at});
  }
  await owner(request, env);
  if (request.method === 'GET') {
    const status = url.searchParams.get('status') || 'pending';
    if (!['pending','confirmed','resolved','rejected'].includes(status)) throw new HttpError(400,'勘誤狀態不正確。');
    const cursor=url.searchParams.get('cursor');
    const match=cursor && /^(\d+):([0-9a-f-]{36})$/.exec(cursor);
    if(cursor && (!match || !uuid.test(match[2])))throw new HttpError(400,'分頁參數不正確。');
    const before=match?Number(match[1]):Number.MAX_SAFE_INTEGER, beforeId=match?match[2]:'~';
    if(!Number.isSafeInteger(before) || before<0)throw new HttpError(400,'分頁參數不正確。');
    const result=await env.DB.prepare('SELECT * FROM question_corrections WHERE status=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 51').bind(status,before,before,beforeId).all();
    const rows=result.results.slice(0,50);
    return json({items:rows.map(row=>({...row,snapshot:JSON.parse(row.snapshot)})),nextCursor:result.results.length>50?`${rows.at(-1).created_at}:${rows.at(-1).id}`:null});
  }
  if (request.method === 'POST' && id) {
    requireOrigin(request,true);
    const body=await readBody(request,12000);
    if (!body || Array.isArray(body) || !['confirmed','resolved','rejected'].includes(body.status) || !Number.isInteger(body.revision) || typeof body.note !== 'string' || !body.note.trim() || body.note.length>2000)
      throw new HttpError(400,'請選擇審核結果並填寫處理說明（最多 2,000 字）。');
    const actor=await owner(request,env);
    const result=await env.DB.prepare('UPDATE question_corrections SET status=?,note=?,revision=revision+1,reviewed_at=?,reviewer_id=? WHERE id=? AND revision=?')
      .bind(body.status,body.note.trim(),Date.now(),typeof actor==='string'?actor:'admin',id,body.revision).run();
    if (!result.meta.changes) throw new HttpError(409,'勘誤已更新，請重新載入再審核。');
    return json({id,status:body.status});
  }
  throw new HttpError(405,'不支援此操作。');
}

async function route(request, env) {
  const url = new URL(request.url),
    path = url.pathname;
  if (request.method === "OPTIONS") {
    if (!origins.has(request.headers.get("origin")))
      throw new HttpError(403, "不允許此來源。");
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "Content-Type,If-None-Match",
        "access-control-max-age": "600",
      },
    });
  }
  if (path === '/api/corrections') return correction(request,env,url);
  const correctionMatch = /^\/api\/corrections\/([0-9a-f-]{36})$/.exec(path);
  if (correctionMatch) {
    if (!uuid.test(correctionMatch[1])) throw new HttpError(400,'勘誤編號不正確。');
    return correction(request,env,url,correctionMatch[1]);
  }
  if (path === "/api/submissions" && request.method === "POST")
    return submit(request, env);
  const publicBuiltinMatch = /^\/api\/community\/builtin-questions\/(os|algorithms)\/([A-Za-z0-9_-]{1,160})$/.exec(path);
  if (publicBuiltinMatch) {
    const [, course, id] = publicBuiltinMatch;
    if (request.method === 'GET') return getPublicBuiltin(env, course, id);
    if (request.method === 'POST') return saveBuiltin(request, env, course, id, { publicEdit: true });
    throw new HttpError(405, '公開題目只能修改或刪除；刪除後可由站主還原。');
  }
  const communityQuestionMatch =
    /^\/api\/community\/questions\/community-([0-9a-f-]{36})-([1-9]\d*)$/.exec(path);
  if (communityQuestionMatch) {
    if (!uuid.test(communityQuestionMatch[1]))
      throw new HttpError(400, "投稿題目編號不正確。");
    const id = `community-${communityQuestionMatch[1]}-${communityQuestionMatch[2]}`;
    if (request.method === "GET") return getCommunityQuestion(env, id);
    if (request.method === "POST")
      return editPublication(request, env, id, { publicEdit: true });
    throw new HttpError(405, "公開投稿題目只能直接修改或刪除；刪除後可由站主重新上架。");
  }
  if (path === "/api/login" && request.method === "POST")
    return adminLogin(request, env);
  if (path === "/api/password/setup" && request.method === "POST")
    return setupAdmin(request, env);
  if (path === "/api/logout" && request.method === "POST") {
    requireOrigin(request, true);
    return clearAdminCookie();
  }
  if (path === "/api/session" && request.method === "GET") {
    const account = await getAdminAccount(env),
      authenticated = await authenticatedAdmin(request, env, account),
      setupState = await getAdminSetupState(env);
    if (authenticated) {
      await ensureReviewedContent(env);
      return json({
        isReviewer: true,
        userId: "admin:" + authenticated.username,
        accountConfigured: true,
      });
    }
    return json({
      isReviewer: false,
      accountConfigured: Boolean(account),
      canManageCredentials: Boolean(boundOwnerIdentity(request, env)),
      canUseSetupCode:
        Boolean(env.ADMIN_SETUP_CODE) && setupState?.consumed_at === null,
    });
  }
  if (path === "/api/review" && request.method === "GET")
    return listReview(request, env, url);
  let match;
  if (path === '/api/manage/library' && request.method === 'GET') return listManagementLibrary(request,env,url);
  if (path === '/api/manage/library/item' && request.method === 'GET') return managementLibraryItem(request,env,url);
  if (path === '/api/manage/imports' && request.method === 'GET') return listManagementImports(request,env,url);
  if ((match=/^\/api\/manage\/imports\/([0-9a-f-]{36})$/.exec(path)) && request.method === 'GET') return managementImportDetail(request,env,match[1]);
  if(path==='/api/manage/builtin-questions' && request.method==='GET')return listBuiltins(request,env,url);
  if((match=/^\/api\/manage\/builtin-questions\/(os|algorithms)\/([A-Za-z0-9_-]{1,160})(\/history)?$/.exec(path))) {
    if(match[3] && request.method==='GET')return builtinHistory(request,env,match[1],match[2]);
    if(!match[3] && request.method==='POST')return saveBuiltin(request,env,match[1],match[2]);
  }
  if (path === "/api/manage/questions" && request.method === "GET")
    return listPublications(request, env, url);
  if (path === "/api/manage/export" && request.method === "GET")
    return exportBackup(request, env);
  if (
    (match =
      /^\/api\/manage\/questions\/(community-[0-9a-f-]{36}-[1-9]\d*)(\/history)?$/.exec(
        path,
      ))
  ) {
    if (request.method === "GET" && match[2])
      return publicationHistory(request, env, match[1]);
    if (request.method === "POST" && !match[2])
      return editPublication(request, env, match[1]);
  }
  if (
    (match = /^\/api\/review\/([^/]+)\/publications$/.exec(path)) &&
    request.method === "POST"
  ) {
    if (!uuid.test(match[1])) throw new HttpError(400, "投稿編號不正確。");
    return manageSubmissionPublications(request, env, match[1]);
  }
  if (
    (match = /^\/api\/review\/([^/]+)$/.exec(path)) &&
    request.method === "POST"
  ) {
    if (!uuid.test(match[1])) throw new HttpError(400, "投稿編號不正確。");
    return decide(request, env, match[1]);
  }
  if (
    (match = /^\/api\/status\/([^/]+)$/.exec(path)) &&
    request.method === "GET"
  ) {
    if (!uuid.test(match[1])) throw new HttpError(400, "投稿編號不正確。");
    const row = await env.DB.prepare(
      "SELECT status,note,reviewed_at FROM submissions WHERE id=?",
    )
      .bind(match[1])
      .first();
    if (!row) throw new HttpError(404, "找不到這個投稿編號。");
    return json({
      status: row.status,
      note: row.note,
      reviewedAt: row.reviewed_at,
    });
  }
  if (path === '/api/units' && request.method === 'GET') {
    const course=url.searchParams.get('course');
    if(!Object.hasOwn(COURSE_UNITS,course))throw new HttpError(400,'請指定科目。');
    const rows=await env.DB.prepare('SELECT unit,data FROM public_questions WHERE course=? AND is_published=1 ORDER BY created_at,id').bind(course).all();
    const units=new Map(Object.entries(COURSE_UNITS[course].units).map(([id,label])=>[id,{id,title:label.replace(/^L\d+ · /,'')} ]));
    for(const row of rows.results){
      if(units.has(row.unit) || !/^L[1-9]\d?$/.test(row.unit))continue;
      const q=JSON.parse(row.data);units.set(row.unit,{id:row.unit,title:String(q.unitTitle || '第 '+row.unit.slice(1)+' 單元').slice(0,60)});
    }
    return json({units:[...units.values()]});
  }
  if (path === "/api/questions" && request.method === "GET") {
    const course = url.searchParams.get("course");
    if (!COURSE_UNITS[course]) throw new HttpError(400, "請指定科目。");
    await ensureReviewedContent(env);
    const etag = await publicLibraryEtag(env,course);
    if ((request.headers.get('if-none-match') || '').split(',').some((value) => value.trim() === etag || value.trim() === 'W/' + etag || value.trim() === '*'))
      return new Response(null,{status:304,headers:{etag,'cache-control':'no-cache'}});
    const result = await env.DB.prepare(
      "SELECT unit,data FROM public_questions WHERE course=? AND is_published=1 ORDER BY created_at,id",
    )
      .bind(course)
      .all();
    const archived = await env.DB.prepare(
      "SELECT id,data FROM public_questions WHERE course=? AND is_published=0",
    )
      .bind(course)
      .all();
    const response = json({
      revision: etag.slice(1,-1),
      aliases: archived.results
        .filter((row) => JSON.parse(row.data).mergedInto)
        .map((row) => ({
          id: row.id,
          target: JSON.parse(row.data).mergedInto,
        })),
      overrides: await publicBuiltinOverrides(env,course),
      questions: result.results.map((row) => ({
        unit: row.unit,
        question: JSON.parse(row.data),
      })),
    });
    response.headers.set('etag',etag);
    response.headers.set('cache-control','no-cache');
    return response;
  }
  if (
    (match =
      /^\/api\/image\/([^/]+)\/((?:[0-9]|[1-9][0-9]|1[0-9]{2})-[01])$/.exec(
        path,
      )) &&
    request.method === "GET"
  ) {
    if (!uuid.test(match[1])) throw new HttpError(404, "找不到題圖。");
    return imageResponse(request, env, match[1], match[2]);
  }
  if (request.method === "GET") {
    if (path === "/") return Response.redirect(SITE_ORIGIN + "/submit", 302);
    if (path === "/index.html")
      return Response.redirect(LIBRARY_ORIGIN + "/course-library/", 302);
    const key =
      path === "/submit"
        ? "/submit.html"
        : path === "/review"
          ? "/review.html"
          : path;
    const asset = STATIC_ASSETS[key];
    if (asset)
      return new Response(
        asset.base64
          ? Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0))
          : asset.body,
        {
          headers: { "content-type": asset.type, "cache-control": "no-cache" },
        },
      );
  }
  throw new HttpError(404, "找不到這個頁面。");
}
export default {
  async fetch(request, env) {
    let response;
    try {
      response = await route(request, env);
    } catch (error) {
      response = json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : "服務暫時無法完成操作，請稍後再試。",
          ...(error instanceof HttpError ? error.details : {}),
        },
        error.status || 500,
      );
    }
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("x-frame-options", "DENY");
    const origin = request.headers.get("origin");
    if (origins.has(origin)) {
      headers.set("access-control-allow-origin", origin);
      headers.set("vary", "Origin");
      headers.set("access-control-expose-headers", "ETag");
    }
    return new Response(response.body, { status: response.status, headers });
  },
};
