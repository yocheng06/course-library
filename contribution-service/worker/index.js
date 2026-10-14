import { normalizeBatch, questionKey, COURSE_UNITS } from "./model.js";
/* BUILD_DATA */
const SITE_ORIGIN =
  "https://course-library-submissions-yocheng06.yocheng06.chatgpt.site";
const LIBRARY_ORIGIN = "https://yocheng06.github.io";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins = new Set([SITE_ORIGIN, LIBRARY_ORIGIN]);
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
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
function owner(request, env) {
  const id = request.headers.get("oai-authenticated-user-id"),
    email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) throw new HttpError(401, "請先登入管理者帳號。");
  if (!env.REVIEWER_EMAIL) throw new HttpError(503, "管理者帳號尚未設定。");
  if (email.toLowerCase() !== env.REVIEWER_EMAIL.toLowerCase())
    throw new HttpError(403, "這個帳號沒有題庫審核權限。");
  return id;
}
function requireOrigin(request, admin = false) {
  const origin = request.headers.get("origin");
  if (admin ? origin !== SITE_ORIGIN : !origins.has(origin))
    throw new HttpError(403, "請從課程網站送出此操作。");
}
async function readBody(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "請以 JSON 格式送出資料。");
  if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024)
    throw new HttpError(413, "投稿檔案太大，請分批送出。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "沒有投稿資料。");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 9 * 1024 * 1024) {
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
    new TextEncoder().encode(value),
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
async function duplicates(env, keys) {
  const found = new Set(keys.filter((k) => BASE_FINGERPRINTS.includes(k)));
  for (let start = 0; start < keys.length; start += 50) {
    const chunk = keys.slice(start, start + 50),
      marks = chunk.map(() => "?").join(",");
    const result = await env.DB.prepare(
      `SELECT fingerprint FROM public_questions WHERE fingerprint IN (${marks})`,
    )
      .bind(...chunk)
      .all();
    for (const row of result.results) found.add(row.fingerprint);
  }
  return keys
    .map((key, index) => (found.has(key) ? index + 1 : null))
    .filter(Boolean);
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
  try {
    payload = normalizeBatch(body);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  const keys = await fingerprints(payload);
  const duplicateIndexes = await duplicates(env, keys);
  if (duplicateIndexes.length)
    throw new HttpError(
      409,
      "第 " +
        duplicateIndexes.join("、") +
        " 題已存在於正式題庫，請移除後再送出。",
    );
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
  const id = crypto.randomUUID();
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
    await env.DB.prepare(
      "INSERT INTO submissions (id,course,unit,title,payload,status,revision,created_at,note) VALUES (?,?,?,?,?,'pending',1,?,'')",
    )
      .bind(
        id,
        payload.course,
        payload.unit,
        payload.title,
        JSON.stringify(payload),
        Date.now(),
      )
      .run();
  } catch (error) {
    await Promise.allSettled(saved.map((key) => env.BUCKET.delete(key)));
    throw error;
  }
  return json({ id, status: "pending" }, 201);
}
function submissionRow(row) {
  return {
    id: row.id,
    payload: JSON.parse(row.payload),
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    note: row.note,
  };
}
async function listReview(request, env, url) {
  owner(request, env);
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
  return json({
    items: rows.map(submissionRow),
    nextCursor: records.results.length > 20 ? rows.at(-1).id : null,
  });
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
  const reviewer = owner(request, env);
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
    try {
      payload = normalizeBatch(body.payload);
    } catch (error) {
      throw new HttpError(400, error.message);
    }
    storedImagesOnly(original, payload, id);
    const keys = await fingerprints(payload);
    const duplicateIndexes = await duplicates(env, keys);
    if (duplicateIndexes.length)
      throw new HttpError(
        409,
        "目前保留清單的第 " +
          duplicateIndexes.join("、") +
          " 題已存在於正式題庫，請移除後再核准。",
      );
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
              answerProvided: true,
              images: q.images.map((src) => ({ src, alt: q.stem })),
              warn: false,
              exact: false,
            };
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
        body.note.trim(),
        id,
        row.revision,
      ),
    );
    try {
      const results = await env.DB.batch(statements);
      if (!results.at(-1).meta.changes)
        throw new HttpError(409, "投稿狀態已改變，請重新載入。");
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new HttpError(
          409,
          "題目剛被其他投稿收錄，請重新載入並移除重複題。",
        );
      throw error;
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
async function imageResponse(request, env, id, file) {
  const src = SITE_ORIGIN + "/api/image/" + id + "/" + file;
  const published = await env.DB.prepare(
    "SELECT id FROM public_questions WHERE submission_id=? AND instr(data,?)>0 LIMIT 1",
  )
    .bind(id, src)
    .first();
  if (!published) owner(request, env);
  const object = await env.BUCKET.get(`submissions/${id}/${file}`);
  if (!object) throw new HttpError(404, "找不到題圖。");
  const headers = new Headers({
    "content-type": object.httpMetadata.contentType,
    "cache-control": published ? "public,max-age=86400" : "private,no-store",
    "x-content-type-options": "nosniff",
  });
  return new Response(object.body, { headers });
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
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "600",
      },
    });
  }
  if (path === "/api/submissions" && request.method === "POST")
    return submit(request, env);
  if (path === "/api/session" && request.method === "GET") {
    owner(request, env);
    return json({ isReviewer: true });
  }
  if (path === "/api/review" && request.method === "GET")
    return listReview(request, env, url);
  let match;
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
  if (path === "/api/questions" && request.method === "GET") {
    const course = url.searchParams.get("course");
    if (!COURSE_UNITS[course]) throw new HttpError(400, "請指定科目。");
    const result = await env.DB.prepare(
      "SELECT unit,data FROM public_questions WHERE course=? ORDER BY created_at,id",
    )
      .bind(course)
      .all();
    return json({
      questions: result.results.map((row) => ({
        unit: row.unit,
        question: JSON.parse(row.data),
      })),
    });
  }
  if (
    (match = /^\/api\/image\/([^/]+)\/(\d{1,2}-[01])$/.exec(path)) &&
    request.method === "GET"
  ) {
    if (!uuid.test(match[1])) throw new HttpError(404, "找不到題圖。");
    return imageResponse(request, env, match[1], match[2]);
  }
  if (request.method === "GET") {
    if (path === "/") return Response.redirect(SITE_ORIGIN + "/submit", 302);
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
    }
    return new Response(response.body, { status: response.status, headers });
  },
};
