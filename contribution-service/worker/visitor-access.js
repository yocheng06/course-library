const visitorTables = new WeakMap();
const visitorCookie = "__Host-course-visitor";
const libraryPrefix = "/course-library/";
const visitorRetention = 30 * 86400000;
const visitorBlockHour = 3600000;
const visitorBlockDurations = new Set([1, 24, 168, 720]);
const studyDocuments = new Set(["", "index.html", "os.html", "algorithms.html", "batch.html", "music-player.html"]);
const ipFormat = /^[0-9a-f.:]{3,45}$/i;

function ensureVisitorTables(env) {
  if (!visitorTables.has(env.DB)) {
    const ready = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_visitors (browser TEXT NOT NULL, ip TEXT NOT NULL, last_path TEXT NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY(browser,ip))"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS library_visitors_recent ON library_visitors(last_at)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_blocks (kind TEXT NOT NULL, target TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(kind,target))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_block_notes (kind TEXT NOT NULL, target TEXT NOT NULL, note TEXT NOT NULL, PRIMARY KEY(kind,target))"),
    ]).catch(error => { visitorTables.delete(env.DB); throw error; });
    visitorTables.set(env.DB, ready);
  }
  return visitorTables.get(env.DB);
}

async function visitorIdentity(request, env) {
  if (!env.RATE_HASH_KEY) throw new HttpError(503, "題庫存取服務尚未完成設定。");
  const rawIP = request.headers.get("CF-Connecting-IP") || "";
  const token = cookieValue(request, visitorCookie);
  return {
    ip: ipFormat.test(rawIP) ? rawIP.toLowerCase() : "",
    token,
    browser: token && uuid.test(token) ? await hash("library-visitor:" + env.RATE_HASH_KEY + ":" + token) : "",
  };
}

async function enforceVisitorBlock(env, { ip, browser }) {
  const block = await env.DB.prepare("SELECT 1 AS blocked FROM library_blocks WHERE expires_at>? AND ((kind='ip' AND target=?) OR (kind='browser' AND target=?)) LIMIT 1")
    .bind(Date.now(), ip, browser).first();
  if (block) throw new HttpError(403, "此連線目前無法存取題庫，請聯絡站主。");
}

async function serveProtectedLibrary(request, env, url) {
  if (!env.LIBRARY_ASSETS) throw new HttpError(404, "此入口尚未啟用。");
  if (!["GET", "HEAD"].includes(request.method)) throw new HttpError(405, "此頁只能瀏覽。");
  await ensureVisitorTables(env);
  const identity = await visitorIdentity(request, env);
  await enforceVisitorBlock(env, identity);

  const path = url.pathname.slice(libraryPrefix.length);
  if (path === "submit.html" || path === "review.html") {
    return Response.redirect(SITE_ORIGIN + "/" + path.replace(".html", "") + url.search, 302);
  }
  const isDocument = studyDocuments.has(path);
  if (!isDocument && !path.startsWith("assets/")) throw new HttpError(404, "找不到這個頁面。");
  const assetURL = new URL(request.url);
  if (path === "" || path === "index.html") assetURL.pathname = libraryPrefix + "home.html";
  const assetHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) assetHeaders.set("range", range);
  const asset = await env.LIBRARY_ASSETS.fetch(new Request(assetURL, { method: request.method, headers: assetHeaders }));
  const headers = new Headers(asset.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("etag");
  if (isDocument && asset.ok && request.method === "GET" && (headers.get("content-type") || "").includes("text/html")) {
    if (!identity.browser) {
      identity.token = crypto.randomUUID();
      identity.browser = await hash("library-visitor:" + env.RATE_HASH_KEY + ":" + identity.token);
      headers.append("set-cookie", visitorCookie + "=" + identity.token + "; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax");
    }
    const now = Date.now();
    await env.DB.prepare("INSERT INTO library_visitors (browser,ip,last_path,last_at) VALUES (?,?,?,?) ON CONFLICT(browser,ip) DO UPDATE SET last_path=excluded.last_path,last_at=excluded.last_at WHERE excluded.last_at-library_visitors.last_at>=300000 OR excluded.last_path<>library_visitors.last_path")
      .bind(identity.browser, identity.ip, path || "index.html", now).run();
  }
  if ((headers.get("content-type") || "").includes("text/html")) {
    const hashes = env.LIBRARY_SCRIPT_HASHES?.[path] || "";
    headers.set("content-security-policy", "default-src 'none'; script-src 'self' " + hashes + "; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'");
    headers.set("x-frame-options", "SAMEORIGIN");
  }
  return new Response(asset.body, { status: asset.status, headers });
}

async function purgeVisitorRecords(env) {
  if (!env.LIBRARY_ASSETS) return;
  await ensureVisitorTables(env);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM library_visitors WHERE last_at<=?").bind(now - visitorRetention),
    env.DB.prepare("DELETE FROM library_blocks WHERE expires_at<=?").bind(now),
    env.DB.prepare("DELETE FROM library_block_notes WHERE NOT EXISTS (SELECT 1 FROM library_blocks b WHERE b.kind=library_block_notes.kind AND b.target=library_block_notes.target)"),
  ]);
}

async function manageVisitorAccess(request, env) {
  await owner(request, env);
  if (!env.LIBRARY_ASSETS) throw new HttpError(503, "受控題庫入口尚未啟用。");
  await ensureVisitorTables(env);
  await purgeVisitorRecords(env);
  if (request.method === "GET") {
    const [visitors, blocks] = await Promise.all([
      env.DB.prepare("SELECT browser,ip,last_path,last_at FROM library_visitors ORDER BY last_at DESC LIMIT 100").all(),
      env.DB.prepare("SELECT b.kind,b.target,b.expires_at,COALESCE(n.note,'') AS note FROM library_blocks b LEFT JOIN library_block_notes n ON n.kind=b.kind AND n.target=b.target WHERE b.expires_at>? ORDER BY b.expires_at").bind(Date.now()).all(),
    ]);
    return json({ visitors: visitors.results, blocks: blocks.results });
  }
  if (request.method !== "POST") throw new HttpError(405, "不支援此操作。");
  requireOrigin(request, true);
  const body = await readBody(request, 4096);
  const { action, kind, target, days, durationHours, note } = body ?? {};
  const column = { ip: "ip", browser: "browser" };
  if (!Object.hasOwn(column, kind) || typeof target !== "string" ||
      !(kind === "ip" ? ipFormat : /^[a-f0-9]{64}$/).test(target))
    throw new HttpError(400, "封鎖對象不正確。");
  if (action === "unblock") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM library_blocks WHERE kind=? AND target=?").bind(kind, target),
      env.DB.prepare("DELETE FROM library_block_notes WHERE kind=? AND target=?").bind(kind, target),
    ]);
    return json({ ok: true });
  }
  if (action !== "block" && action !== "extend") throw new HttpError(400, "不支援此封鎖操作。");
  const hours = durationHours ?? ([1, 7, 30].includes(days) ? days * 24 : null);
  if (!visitorBlockDurations.has(hours)) throw new HttpError(400, "封鎖期限不正確。");
  const self = await visitorIdentity(request, env);
  if (target === self[kind]) throw new HttpError(409, "無法封鎖你目前使用的連線或瀏覽器。");

  const now = Date.now();
  const duration = hours * visitorBlockHour;
  if (action === "extend") {
    const block = await env.DB.prepare("UPDATE library_blocks SET expires_at=expires_at+? WHERE kind=? AND target=? AND expires_at>? RETURNING expires_at")
      .bind(duration, kind, target, now).first();
    if (!block) throw new HttpError(404, "這筆封鎖已到期或已解除。");
    return json({ ok: true, ...block });
  }

  if (note !== undefined && (typeof note !== "string" || note.length > 200))
    throw new HttpError(400, "封鎖備註最多 200 個字。");
  const visit = await env.DB.prepare("SELECT 1 AS found FROM library_visitors WHERE " + column[kind] + "=? LIMIT 1").bind(target).first();
  if (!visit) throw new HttpError(404, "訪客紀錄已到期，請重新載入。");
  const expiresAt = now + duration;
  const statements = [
    env.DB.prepare("INSERT INTO library_blocks (kind,target,created_at,expires_at) VALUES (?,?,?,?) ON CONFLICT(kind,target) DO UPDATE SET created_at=excluded.created_at,expires_at=excluded.expires_at")
      .bind(kind, target, now, expiresAt),
  ];
  if (note !== undefined) {
    statements.push(env.DB.prepare("INSERT INTO library_block_notes (kind,target,note) VALUES (?,?,?) ON CONFLICT(kind,target) DO UPDATE SET note=excluded.note")
      .bind(kind, target, note.trim()));
  }
  await env.DB.batch(statements);
  return json({ ok: true, expires_at: expiresAt });
}
