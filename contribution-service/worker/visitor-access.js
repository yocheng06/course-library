const visitorTables = new WeakMap();
const visitorCookie = "__Host-course-visitor";
const libraryPrefix = "/course-library/";
const visitorRetention = 30 * 86400000;
const visitorBlockHour = 3600000;
const visitorBlockDurations = new Set([1, 24, 168, 720]);
const visitorPageSize = 25;
const visitSelect = "v.browser,v.ip,v.last_path,v.last_at,d.device,d.browser_name,d.model,a.nickname";
const visitDetails = " LEFT JOIN library_visitor_devices d ON d.browser=v.browser LEFT JOIN library_visitor_aliases a ON a.browser=v.browser";
const visitPageNames = "CASE v.last_path WHEN 'index.html' THEN '課程首頁' WHEN 'os.html' THEN '作業系統' WHEN 'algorithms.html' THEN '演算法' WHEN 'batch.html' THEN '批次查題' WHEN 'music-player.html' THEN '音樂播放器' ELSE '' END";
const visitModelNames = "CASE upper(d.model) WHEN 'SM-S9260' THEN 'galaxy s24+' WHEN 'SM-S926B' THEN 'galaxy s24+' ELSE '' END";
const studyDocuments = new Set(["", "index.html", "os.html", "algorithms.html", "batch.html", "music-player.html"]);
const ipFormat = /^[0-9a-f.:]{3,45}$/i;

function ensureVisitorTables(env) {
  if (!visitorTables.has(env.DB)) {
    const ready = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_visitors (browser TEXT NOT NULL, ip TEXT NOT NULL, last_path TEXT NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY(browser,ip))"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS library_visitors_recent ON library_visitors(last_at)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_visitor_devices (browser TEXT PRIMARY KEY, device TEXT NOT NULL, browser_name TEXT NOT NULL, model TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_visitor_aliases (browser TEXT PRIMARY KEY, nickname TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_blocks (kind TEXT NOT NULL, target TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(kind,target))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_block_notes (kind TEXT NOT NULL, target TEXT NOT NULL, note TEXT NOT NULL, PRIMARY KEY(kind,target))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS library_block_history (id INTEGER PRIMARY KEY, action TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, nickname TEXT NOT NULL, note TEXT NOT NULL, expires_at INTEGER NOT NULL, event_at INTEGER NOT NULL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS library_block_history_recent ON library_block_history(event_at DESC,id DESC)"),
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

function visitorDevice(headers) {
  const ua = headers.get('user-agent') || '';
  const platform = (headers.get('sec-ch-ua-platform') || '').replace(/^"|"$/g, '');
  let device = '';
  if (/\biPhone\b/i.test(ua)) device = 'iPhone';
  else if (/\biPad\b/i.test(ua)) device = 'iPad';
  else if (platform === 'Android' || /\bAndroid\b/i.test(ua)) {
    device = headers.get('sec-ch-ua-mobile') === '?1' || /\bMobile\b/i.test(ua) ? 'Android 手機' : 'Android';
  } else if (platform === 'Windows' || /Windows NT/i.test(ua)) device = 'Windows';
  else if (platform === 'Chrome OS' || /\bCrOS\b/i.test(ua)) device = 'ChromeOS';
  else if (platform === 'macOS' || /Macintosh/i.test(ua)) device = 'macOS';
  else if (platform === 'iOS') device = 'iOS';
  else if (platform === 'Linux' || /\bLinux\b/i.test(ua)) device = 'Linux';

  const browserName = [
    [/\bEdg(?:A|iOS)?\//i, 'Edge'],
    [/\bSamsungBrowser\//i, 'Samsung Internet'],
    [/\b(?:OPR|OPiOS)\//i, 'Opera'],
    [/\b(?:Firefox|FxiOS)\//i, 'Firefox'],
    [/\b(?:Chrome|CriOS)\//i, 'Chrome'],
    [/\bChromium\//i, 'Chromium'],
    [/\bVersion\/\S+.*\bSafari\//i, 'Safari'],
  ].find(([pattern]) => pattern.test(ua))?.[1] || '';

  // Only retain a model that the Android browser explicitly supplied.
  const modelHint = device.startsWith('Android') ? headers.get('sec-ch-ua-model') : null;
  const model = modelHint?.match(/^"([\p{L}\p{N} ._()+/-]{2,80})"$/u)?.[1].trim() || '';
  return { device, browserName, model };
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
    const visit = env.DB.prepare("INSERT INTO library_visitors (browser,ip,last_path,last_at) VALUES (?,?,?,?) ON CONFLICT(browser,ip) DO UPDATE SET last_path=excluded.last_path,last_at=excluded.last_at WHERE excluded.last_at-library_visitors.last_at>=300000 OR excluded.last_path<>library_visitors.last_path")
      .bind(identity.browser, identity.ip, path || "index.html", now);
    const { device, browserName, model } = visitorDevice(request.headers);
    if (device.startsWith('Android')) headers.append("accept-ch", "Sec-CH-UA-Model");
    if (device || browserName || model) {
      // Later requests may omit optional hints, so keep the last usable value.
      await env.DB.batch([
        visit,
        env.DB.prepare(
          "INSERT INTO library_visitor_devices (browser,device,browser_name,model) VALUES (?,?,?,?) " +
          "ON CONFLICT(browser) DO UPDATE SET device=COALESCE(NULLIF(excluded.device,''),library_visitor_devices.device), " +
          "browser_name=COALESCE(NULLIF(excluded.browser_name,''),library_visitor_devices.browser_name), " +
          "model=COALESCE(NULLIF(excluded.model,''),library_visitor_devices.model) " +
          "WHERE (excluded.device<>'' AND excluded.device<>library_visitor_devices.device) " +
          "OR (excluded.browser_name<>'' AND excluded.browser_name<>library_visitor_devices.browser_name) " +
          "OR (excluded.model<>'' AND excluded.model<>library_visitor_devices.model)"
        ).bind(identity.browser, device, browserName, model),
      ]);
    } else {
      await visit.run();
    }
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
    env.DB.prepare("DELETE FROM library_visitor_devices WHERE NOT EXISTS (SELECT 1 FROM library_visitors v WHERE v.browser=library_visitor_devices.browser)"),
    env.DB.prepare("DELETE FROM library_block_history WHERE event_at<=?").bind(now - visitorRetention),
    visitorBlockHistory(env, "expire", "b.expires_at", "b.expires_at",
      "b.expires_at>? AND b.expires_at<=?", now - visitorRetention, now),
    env.DB.prepare("DELETE FROM library_blocks WHERE expires_at<=?").bind(now),
    env.DB.prepare("DELETE FROM library_block_notes WHERE NOT EXISTS (SELECT 1 FROM library_blocks b WHERE b.kind=library_block_notes.kind AND b.target=library_block_notes.target)"),
    env.DB.prepare("DELETE FROM library_visitor_aliases WHERE NOT EXISTS (SELECT 1 FROM library_visitors v WHERE v.browser=library_visitor_aliases.browser) AND NOT EXISTS (SELECT 1 FROM library_blocks b WHERE b.kind='browser' AND b.target=library_visitor_aliases.browser)"),
  ]);
}

function visitorBlockHistory(env, action, eventTime, expiry, condition, ...args) {
  // SQL expressions and conditions are selected by the caller. Targets and input stay bound.
  return env.DB.prepare(
    "INSERT INTO library_block_history (action,kind,target,nickname,note,expires_at,event_at) " +
    `SELECT ?,b.kind,b.target,COALESCE(a.nickname,''),COALESCE(n.note,''),${expiry},${eventTime} ` +
    "FROM library_blocks b LEFT JOIN library_block_notes n ON n.kind=b.kind AND n.target=b.target " +
    "LEFT JOIN library_visitor_aliases a ON b.kind='browser' AND a.browser=b.target " +
    `WHERE ${condition}`,
  ).bind(action, ...args);
}

function visitorOffset(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000000)
    throw new HttpError(400, "紀錄頁數不正確。");
  return value;
}

async function searchVisitorRecords(env, {query = '', period = 0, offset = 0}) {
  if (typeof query !== "string" || query.length > 100 || ![0, 1, 24, 168].includes(period))
    throw new HttpError(400, "訪客搜尋條件不正確。");
  const q = query.trim().toLowerCase();
  const cutoff = Date.now() - (period ? period * visitorBlockHour : visitorRetention);
  const page = await env.DB.prepare(
    "SELECT v.browser,MAX(v.last_at) AS recent FROM library_visitors v" + visitDetails +
    " WHERE v.last_at>=? AND (?='' OR instr(lower(v.ip),?) OR instr(v.browser,?) OR instr(lower(a.nickname),?) " +
    "OR instr(lower(v.last_path),?) OR instr(" + visitPageNames + ",?) OR instr(lower(d.device),?) " +
    "OR instr(lower(d.browser_name),?) OR instr(lower(d.model),?) OR instr(" + visitModelNames + ",?)) " +
    "GROUP BY v.browser ORDER BY recent DESC,v.browser LIMIT ? OFFSET ?",
  ).bind(cutoff, q, q, q, q, q, q, q, q, q, q, visitorPageSize + 1, visitorOffset(offset)).all();
  const browsers = page.results.slice(0, visitorPageSize).map(row => row.browser);
  if (!browsers.length) return json({visitors: [], hasMore: false});
  const connections = await env.DB.prepare(
    "SELECT " + visitSelect + " FROM library_visitors v" + visitDetails +
    " WHERE v.browser IN (" + browsers.map(() => "?").join(",") + ") ORDER BY v.last_at DESC,v.browser,v.ip",
  ).bind(...browsers).all();
  return json({visitors: connections.results, hasMore: page.results.length > visitorPageSize});
}

async function saveVisitorNickname(env, {target, nickname}) {
  if (typeof target !== "string" || !/^[a-f0-9]{64}$/.test(target) || typeof nickname !== "string" || nickname.length > 40)
    throw new HttpError(400, "瀏覽器代號或暱稱不正確，暱稱最多 40 個字。");
  if (!nickname.trim()) {
    await env.DB.prepare("DELETE FROM library_visitor_aliases WHERE browser=?").bind(target).run();
    return json({ok: true});
  }
  const saved = await env.DB.prepare(
    "INSERT INTO library_visitor_aliases (browser,nickname) SELECT ?,? " +
    "WHERE EXISTS (SELECT 1 FROM library_visitors WHERE browser=?) " +
    "ON CONFLICT(browser) DO UPDATE SET nickname=excluded.nickname RETURNING browser",
  ).bind(target, nickname.trim(), target).first();
  if (!saved) throw new HttpError(404, "找不到這筆訪客紀錄，請重新載入。");
  return json({ok: true});
}

async function manageVisitorAccess(request, env) {
  await owner(request, env);
  if (!env.LIBRARY_ASSETS) throw new HttpError(503, "受控題庫入口尚未啟用。");
  await ensureVisitorTables(env);
  await purgeVisitorRecords(env);
  if (request.method === "GET") {
    const [visitors, blocks] = await Promise.all([
      env.DB.prepare("SELECT " + visitSelect + " FROM library_visitors v" + visitDetails + " ORDER BY v.last_at DESC,v.browser,v.ip LIMIT 100").all(),
      env.DB.prepare("SELECT b.kind,b.target,b.expires_at,COALESCE(n.note,'') AS note FROM library_blocks b LEFT JOIN library_block_notes n ON n.kind=b.kind AND n.target=b.target WHERE b.expires_at>? ORDER BY b.expires_at").bind(Date.now()).all(),
    ]);
    return json({ visitors: visitors.results, blocks: blocks.results });
  }
  if (request.method !== "POST") throw new HttpError(405, "不支援此操作。");
  requireOrigin(request, true);
  const body = await readBody(request, 4096);
  const { action, kind, target, days, durationHours, note } = body ?? {};
  if (action === "search") return searchVisitorRecords(env, body);
  if (action === "nickname") return saveVisitorNickname(env, body);
  if (action === "history") {
    const {results} = await env.DB.prepare(
      "SELECT action,kind,target,nickname,note,expires_at,event_at FROM library_block_history ORDER BY event_at DESC,id DESC LIMIT ? OFFSET ?",
    ).bind(visitorPageSize + 1, visitorOffset(body.offset)).all();
    return json({events: results.slice(0, visitorPageSize), hasMore: results.length > visitorPageSize});
  }
  const column = { ip: "ip", browser: "browser" };
  if (!Object.hasOwn(column, kind) || typeof target !== "string" ||
      !(kind === "ip" ? ipFormat : /^[a-f0-9]{64}$/).test(target))
    throw new HttpError(400, "封鎖對象不正確。");
  if (action === "unblock") {
    await env.DB.batch([
      visitorBlockHistory(env, "unblock", "?", "b.expires_at", "b.kind=? AND b.target=?", Date.now(), kind, target),
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
    const [logged] = await env.DB.batch([
      visitorBlockHistory(env, "extend", "?", "b.expires_at+?",
        "b.kind=? AND b.target=? AND b.expires_at>?", duration, now, kind, target, now),
      env.DB.prepare("UPDATE library_blocks SET expires_at=expires_at+? WHERE kind=? AND target=? AND expires_at>?")
        .bind(duration, kind, target, now),
    ]);
    if (!logged.meta.changes) throw new HttpError(404, "這筆封鎖已到期或已解除。");
    const block = await env.DB.prepare("SELECT expires_at FROM library_blocks WHERE kind=? AND target=?").bind(kind, target).first();
    return json({ ok: true, expires_at: block?.expires_at ?? null });
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
  statements.push(visitorBlockHistory(env, "block", "?", "b.expires_at", "b.kind=? AND b.target=?", now, kind, target));
  await env.DB.batch(statements);
  return json({ ok: true, expires_at: expiresAt });
}
