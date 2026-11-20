const editModerationReady = new WeakMap();
const editModes = new Set(["direct", "review", "paused"]);
const editSourceDays = 30 * 86400000;

function ensureEditModeration(env) {
  if (!editModerationReady.has(env.DB)) {
    const ready = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS edit_policy (id INTEGER PRIMARY KEY CHECK(id=1), mode TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS edit_requests (id TEXT PRIMARY KEY, course TEXT NOT NULL, question_id TEXT NOT NULL, kind TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, changes_json TEXT NOT NULL, ip TEXT, browser TEXT, created_at INTEGER NOT NULL, claim_until INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending')"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS edit_audit (id TEXT PRIMARY KEY, course TEXT NOT NULL, question_id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, changes_json TEXT NOT NULL, ip TEXT, browser TEXT, created_at INTEGER NOT NULL, source_at INTEGER NOT NULL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS edit_requests_status ON edit_requests(status, created_at)"),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS edit_requests_once ON edit_requests(course, question_id, revision, action, payload) WHERE status='pending'"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS edit_audit_recent ON edit_audit(created_at)"),
    ]).catch(error => { editModerationReady.delete(env.DB); throw error; });
    editModerationReady.set(env.DB, ready);
  }
  return editModerationReady.get(env.DB);
}

async function getEditMode(env) {
  await ensureEditModeration(env);
  return (await env.DB.prepare("SELECT mode FROM edit_policy WHERE id=1").first())?.mode ?? "direct";
}

async function withEditPolicy(env, response) {
  return json({ ...await response.json(), editPolicy: await getEditMode(env) });
}

async function publicEditContext(request, env, body, review) {
  if (review) return { ip: review.ip, browser: review.browser, sourceAt: review.created_at };
  if (body.action === "delete") throw new HttpError(403, "只有站主能移除題目。請使用「建議移除」。");
  const mode = await getEditMode(env);
  if (mode === "paused" && body.action !== "request-delete")
    throw new HttpError(403, "目前暫停公開改題，可改用「回報題目問題」。");
  const ip = request.headers.get("CF-Connecting-IP");
  const browser = typeof body.browserId === "string" && uuid.test(body.browserId) && env.RATE_HASH_KEY
    ? (await hash("edit-browser:" + env.RATE_HASH_KEY + ":" + body.browserId)).slice(0, 16)
    : null;
  return { mode, ip: ip && /^[0-9a-f.:]{3,45}$/i.test(ip) ? ip : null, browser, sourceAt: Date.now() };
}

function editChanges(before, after) {
  const fields = {
    category: ["category"], type: ["type"], stem: ["stem", "q"], options: ["options", "opts"],
    answer: ["answer", "a"], explanation: ["explanation", "ex"], note: ["note"],
    translation: ["translation"], optionTranslations: ["optionTranslations"],
    answerProvided: ["answerProvided"],
  };
  return Object.fromEntries(Object.entries(fields).flatMap(([name, keys]) => {
    const value = row => keys.map(key => row[key]).find(item => item != null) ?? "";
    const a = value(before), b = value(after);
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [[name, { before: a, after: b }]];
  }));
}

async function enqueueEdit(env, moderation, course, id, kind, body, before, after) {
  const proposal = { ...body };
  delete proposal.browserId;
  const payload = JSON.stringify(proposal);
  if (new TextEncoder().encode(payload).length > 160000)
    throw new HttpError(413, "修改內容過大，無法加入待審。");
  await env.DB.prepare("INSERT INTO edit_requests (id,course,question_id,kind,action,revision,payload,changes_json,ip,browser,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING")
    .bind(crypto.randomUUID(), course, id, kind, body.action, body.revision, payload,
      JSON.stringify(body.action === "request-delete"
        ? { stem: { before: before.stem ?? before.q, after: "（移除題目）" } }
        : editChanges(before, after)), moderation.ip, moderation.browser, moderation.sourceAt).run();
  return json({ queued: true }, 202);
}

function editAuditStatements(env, moderation, review, course, id, body, before, after) {
  const statements = [];
  if (review) {
    statements.push(env.DB.prepare("UPDATE edit_requests SET status='approved', payload='', changes_json='{}', ip=NULL, browser=NULL WHERE id=? AND status='pending' AND changes()>0").bind(review.id));
  }
  statements.push(env.DB.prepare("INSERT INTO edit_audit (id,course,question_id,action,revision,changes_json,ip,browser,created_at,source_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()>0")
    .bind(crypto.randomUUID(), course, id, body.action, body.revision + 1,
      JSON.stringify(editChanges(before, after)), moderation.ip, moderation.browser, Date.now(), moderation.sourceAt));
  return statements;
}

async function purgeEditSources(env) {
  await ensureEditModeration(env);
  const cutoff = Date.now() - editSourceDays;
  await env.DB.batch([
    env.DB.prepare("UPDATE edit_audit SET ip=NULL,browser=NULL WHERE source_at<=? AND (ip IS NOT NULL OR browser IS NOT NULL)").bind(cutoff),
    env.DB.prepare("UPDATE edit_requests SET ip=NULL,browser=NULL WHERE created_at<=? AND (ip IS NOT NULL OR browser IS NOT NULL)").bind(cutoff),
  ]);
}

// The revision is checked again by the normal rollback write. An audit entry
// can only undo its own edit, even if another edit arrives after selection.
const canRollbackAudit = `a.action='update' AND (
  EXISTS (SELECT 1 FROM builtin_question_edits b WHERE b.course=a.course
    AND b.question_id=a.question_id AND b.revision=a.revision AND b.action='update'
    AND b.revision=(SELECT MAX(h.revision) FROM builtin_question_edits h
      WHERE h.course=a.course AND h.question_id=a.question_id))
  OR EXISTS (SELECT 1 FROM public_questions p WHERE p.id=a.question_id AND p.course=a.course
    AND p.revision=a.revision AND p.is_published=1))`;

async function rollbackAuditedEdit(request, env, id) {
  const row = await env.DB.prepare(`SELECT a.course,a.question_id,a.revision
    FROM edit_audit a WHERE a.id=? AND ${canRollbackAudit}`).bind(id).first();
  if (!row) throw new HttpError(409, "這筆修改已不是最新公開版本，請重新載入並核對修改歷史。");
  const base = builtinReference(row.course, row.question_id);
  const rollback = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      action: "rollback", revision: row.revision, note: "站主退回公開修改（保留版本歷史）",
      ...(base ? {sourceHash: base.sourceHash} : {}),
    }),
  });
  return base ? saveBuiltin(rollback, env, row.course, base.id) : editPublication(rollback, env, row.question_id);
}

async function manageEditModeration(request, env) {
  await owner(request, env);
  await ensureEditModeration(env);
  if (request.method === "GET") {
    await purgeEditSources(env);
    const [pending, audit] = await Promise.all([
      env.DB.prepare("SELECT id,course,question_id,action,revision,changes_json,ip,browser,created_at FROM edit_requests WHERE status='pending' ORDER BY created_at ASC LIMIT 50").all(),
      env.DB.prepare(`SELECT a.id,a.course,a.question_id,a.action,a.revision,a.changes_json,a.ip,a.browser,a.created_at,
        CASE WHEN ${canRollbackAudit} THEN 1 ELSE 0 END AS can_rollback
        FROM edit_audit a ORDER BY a.created_at DESC LIMIT 50`).all(),
    ]);
    return json({ mode: await getEditMode(env), pending: pending.results, audit: audit.results });
  }
  if (request.method !== "POST") throw new HttpError(405, "不支援此操作。");
  requireOrigin(request, true);
  const body = await readBody(request, 4096);
  if (body?.action === "policy" && editModes.has(body.mode)) {
    await env.DB.prepare("INSERT INTO edit_policy (id,mode) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode").bind(body.mode).run();
    return json({ mode: body.mode });
  }
  if (!body || !["approve", "reject", "rollback"].includes(body.action) || typeof body.id !== "string" || !uuid.test(body.id))
    throw new HttpError(400, "審核操作不正確。");
  if (body.action === "rollback") return rollbackAuditedEdit(request, env, body.id);
  const now = Date.now();
  if (body.action === "reject") {
    const result = await env.DB.prepare("UPDATE edit_requests SET status='rejected',payload='',changes_json='{}',ip=NULL,browser=NULL WHERE id=? AND status='pending' AND claim_until<=?")
      .bind(body.id, now).run();
    if (!result.meta.changes) throw new HttpError(409, "建議已處理或正在審核。");
    return json({ ok: true });
  }
  const claimUntil = now + 120000;
  const claim = await env.DB.prepare("UPDATE edit_requests SET claim_until=? WHERE id=? AND status='pending' AND claim_until<=? RETURNING *")
    .bind(claimUntil, body.id, now).first();
  if (!claim) throw new HttpError(409, "建議已處理或正在審核。");
  if (claim.created_at <= now - editSourceDays) claim.ip = claim.browser = null;
  try {
    return await (claim.kind === "builtin"
      ? saveBuiltin(request, env, claim.course, claim.question_id, { publicEdit: true, review: claim })
      : editPublication(request, env, claim.question_id, { publicEdit: true, review: claim }));
  } finally {
    await env.DB.prepare("UPDATE edit_requests SET claim_until=0 WHERE id=? AND status='pending' AND claim_until=?").bind(claim.id, claimUntil).run();
  }
}
