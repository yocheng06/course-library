// Inlined by the build script after the canonical source catalog.
const builtinCatalog = new Map(
  BUILTIN_QUESTIONS.map((q) => [q.course + ":" + q.id, q]),
);
function builtinReference(course, id) {
  return (
    builtinCatalog.get(course + ":" + id) ||
    BUILTIN_QUESTIONS.find(
      (q) => q.course === course && q.question.aliases?.includes(id),
    )
  );
}
function builtinBase(course, id) {
  const base = builtinReference(course, id);
  if (!base) throw new HttpError(404, "找不到這道內建題。");
  return base;
}
function builtinEditable(raw) {
  const q = canonicalQuestion(raw);
  const key = globalThis.courseChoiceAnswers.expectedChoiceKey(
    q.answer,
    q.options,
  );
  return {
    ...q,
    type: q.images.length
      ? "圖片題"
      : q.options.length
        ? key?.length > 1 || /多選|複選/.test(q.type)
          ? "多選題"
          : "單選題"
        : "填空題",
    translation: raw.translation || "",
    optionTranslations: raw.optionTranslations || [],
    note: raw.note || "",
    answerProvided: raw.answerProvided === true && Boolean(q.answer?.trim()),
  };
}
async function latestBuiltinEdits(env, course) {
  const rows = await env.DB.prepare(
    "SELECT e.* FROM builtin_question_edits e WHERE e.course=? AND e.revision=(SELECT MAX(h.revision) FROM builtin_question_edits h WHERE h.course=e.course AND h.question_id=e.question_id)",
  )
    .bind(course)
    .all();
  return new Map(rows.results.map((r) => [r.question_id, r]));
}
function builtinRow(base, edit) {
  const deleted = edit?.action === "delete";
  return {
    course: base.course,
    unit: base.unit,
    id: base.id,
    aliases: base.question.aliases || [],
    sourceHash: base.sourceHash,
    revision: edit?.revision || 0,
    modified: Boolean(edit && !["reset", "delete"].includes(edit.action)),
    deleted,
    sourceChanged: Boolean(edit && edit.base_hash !== base.sourceHash),
    availableImages: (base.question.images || []).map((img) =>
      typeof img === "string" ? img : img.src,
    ),
    question: builtinEditable(
      edit && edit.action !== "reset" ? JSON.parse(edit.data) : base.question,
    ),
    updatedAt: edit?.created_at || null,
  };
}
async function listBuiltins(request, env, url) {
  await owner(request, env);
  const course = url.searchParams.get("course") || "os",
    unit = url.searchParams.get("unit") || "",
    query = (url.searchParams.get("q") || "").trim().toLowerCase(),
    state = url.searchParams.get("state") || "all",
    cursor = url.searchParams.get("cursor") || "";
  if (
    !Object.hasOwn(COURSE_UNITS, course) ||
    query.length > 100 ||
    !["all", "modified", "deleted"].includes(state) ||
    (cursor && !/^\d{1,6}$/.test(cursor))
  )
    throw new HttpError(400, "篩選條件不正確。");
  const edits = await latestBuiltinEdits(env, course);
  const rows = BUILTIN_QUESTIONS.filter(
    (q) => q.course === course && (!unit || q.unit === unit),
  )
    .map((q) => builtinRow(q, edits.get(q.id)))
    .filter(
      (q) =>
        (state === "all" || (state === "modified" && q.modified) || (state === "deleted" && q.deleted)) &&
        (!query ||
          (q.id + " " + q.aliases.join(" ") + " " + JSON.stringify(q.question))
            .toLowerCase()
            .includes(query)),
    );
  const offset = Number(cursor || 0);
  return json({
    items: rows.slice(offset, offset + 25),
    total: rows.length,
    nextCursor: offset + 25 < rows.length ? String(offset + 25) : null,
  });
}
function normalizeBuiltinEdit(base, previous, input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !TYPES.includes(input.type)
  )
    throw new HttpError(400, "題目格式或題型不正確。");
  const allowed = new Map(
    [...(base.question.images || []), ...(previous.images || [])].map((img) => [
      typeof img === "string" ? img : img.src,
      typeof img === "string" ? { src: img } : img,
    ]),
  );
  if (
    !Array.isArray(input.images) ||
    input.images.some((src) => !allowed.has(src))
  )
    throw new HttpError(400, "請保留原有題圖或取消勾選。");
  const provided = input.answerProvided !== false;
  let q;
  try {
    q = normalizeBatch({
      course: base.course,
      unit: base.unit,
      title: "內建題目修改",
      questions: [
        {
          ...input,
          answer: provided
            ? input.answer
            : input.options?.length
              ? "A"
              : "尚未提供答案",
        },
      ],
    }).questions[0];
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  const text = (value, label, max) => {
    if (typeof value !== "string" || value.length > max)
      throw new HttpError(400, label + "格式不正確。");
    return value.trim();
  };
  const translation = text(input.translation || "", "翻譯", 10000),
    note = text(input.note || "", "題目備註", 4000);
  if (
    !Array.isArray(input.optionTranslations) ||
    ![0, q.options.length].includes(input.optionTranslations.length)
  )
    throw new HttpError(400, "選項翻譯數量必須與選項相同。");
  const optionTranslations = input.optionTranslations.map((v) =>
    text(v, "選項翻譯", 2000),
  );
  if (!provided) {
    q.answer = text(input.answer || "", "答案", 4000);
    delete q.choiceKey;
  }
  const raw = {
    ...previous,
    ...q,
    translation,
    optionTranslations,
    note,
    answerProvided: provided,
    images: q.images.map((src) => ({ ...allowed.get(src) })),
  };
  if (!provided || !q.options.length) delete raw.choiceKey;
  const imageKeys = new Map(
    (base.question.images || []).map((img, i) => [
      typeof img === "string" ? img : img.src,
      base.question.imageKeys?.[i],
    ]),
  );
  raw.imageKeys = q.images.map((src) => imageKeys.get(src) || src);
  if (base.course === "algorithms") {
    raw.q = q.stem;
    raw.opts = q.options;
    raw.a = q.answer;
    raw.ex = q.explanation;
    raw.bookmarkId = base.id;
  } else raw.id = base.id;
  // Source variants can carry old answers or option orders. Once core content
  // changes, only the explicitly saved bilingual form participates in lookup.
  const old = builtinEditable(previous);
  const updated = builtinEditable(raw);
  if (
    [
      "stem",
      "type",
      "answer",
      "options",
      "translation",
      "optionTranslations",
      "images",
    ].some((k) => JSON.stringify(old[k]) !== JSON.stringify(updated[k]))
  ) {
    delete raw.sourceVariants;
    delete raw.answerAliases;
    delete raw.answerConditions;
    if (q.answer !== builtinEditable(base.question).answer)
      raw.originalAnswer = builtinEditable(base.question).answer;
    else delete raw.originalAnswer;
  }
  return raw;
}
async function builtinHistory(request, env, course, id) {
  await owner(request, env);
  const base = builtinBase(course, id);
  const rows = await env.DB.prepare(
    "SELECT * FROM builtin_question_edits WHERE course=? AND question_id=? ORDER BY revision DESC LIMIT 50",
  )
    .bind(course, base.id)
    .all();
  return json({
    items: rows.results.map((r) => ({
      revision: r.revision,
      action: r.action,
      note: r.note,
      actor: r.actor,
      createdAt: r.created_at,
      before: builtinEditable(JSON.parse(r.previous_data)),
      after: builtinEditable(JSON.parse(r.data)),
    })),
  });
}
async function getPublicBuiltin(env, course, id) {
  const base = builtinBase(course, id);
  return json({ item: builtinRow(base, (await latestBuiltinEdits(env, course)).get(base.id)) });
}
async function saveBuiltin(request, env, course, id, { publicEdit = false } = {}) {
  const actor = publicEdit ? '匿名使用者' : await owner(request, env);
  requireOrigin(request, !publicEdit);
  const base = builtinBase(course, id),
    body = await readBody(request, 100000);
  if (
    !body ||
    !(publicEdit ? ["update", "delete"] : ["update", "reset", "rollback"]).includes(body.action) ||
    !Number.isInteger(body.revision) ||
    body.revision < 0 ||
    (body.note !== undefined && typeof body.note !== "string") ||
    (!publicEdit && !body.note?.trim()) ||
    (body.note?.length || 0) > 2000
  )
    throw new HttpError(400, "請填寫修改說明並重新載入題目。");
  if (body.sourceHash !== base.sourceHash)
    throw new HttpError(409, "內建題庫版本已更新，請重新載入再修改。");
  const current = (await latestBuiltinEdits(env, course)).get(base.id);
  if ((current?.revision || 0) !== body.revision)
    throw new HttpError(409, "這道題已被更新，請先下載草稿並重新載入。");
  if (publicEdit && current?.action === "delete")
    throw new HttpError(404, "這道題已從公開題庫移除，請由站主還原。");
  if (!publicEdit && current?.action === "delete" && body.action === "update")
    throw new HttpError(409, "這道題目前已刪除，請先還原題目再修改。");
  if (body.action === "rollback" && (!current || current.action === "reset"))
    throw new HttpError(409, "這道題沒有可直接退回的修改版本，請重新載入。");
  const previous =
    current && current.action !== "reset"
      ? JSON.parse(current.data)
      : base.question;
  let raw, storedAction = body.action;
  if (body.action === "delete") raw = previous;
  else if (body.action === "reset") raw = base.question;
  else if (body.action === "rollback") {
    const target = JSON.parse(current.previous_data);
    if (
      JSON.stringify(builtinEditable(target)) ===
      JSON.stringify(builtinEditable(base.question))
    ) {
      raw = base.question;
      storedAction = "reset";
    } else raw = normalizeBuiltinEdit(base, previous, target);
  } else raw = normalizeBuiltinEdit(base, previous, body.question);
  const result = await env.DB.prepare(
    "INSERT INTO builtin_question_edits (id,course,question_id,revision,data,previous_data,base_hash,action,note,actor,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ?=COALESCE((SELECT MAX(revision) FROM builtin_question_edits WHERE course=? AND question_id=?),0)",
  )
    .bind(
      crypto.randomUUID(),
      course,
      base.id,
      body.revision + 1,
      JSON.stringify(raw),
      JSON.stringify(previous),
      base.sourceHash,
      storedAction,
      body.note?.trim() || (body.action === "delete" ? "匿名使用者刪除題目（站主可還原）" : "匿名使用者直接修正題目"),
      typeof actor === "string" ? actor : JSON.stringify(actor),
      Date.now(),
      body.revision,
      course,
      base.id,
    )
    .run();
  if (!result.meta.changes)
    throw new HttpError(409, "這道題已被更新，請重新載入。");
  return json({
    item: builtinRow(
      base,
      (await latestBuiltinEdits(env, course)).get(base.id),
    ),
  });
}
async function publicBuiltinOverrides(env, course) {
  const edits = await latestBuiltinEdits(env, course);
  return [...edits.values()]
    .filter(
      (e) =>
        e.action !== "reset" &&
        builtinCatalog.has(course + ":" + e.question_id),
    )
    .map((e) => {
      const base = builtinCatalog.get(course + ":" + e.question_id);
      return e.action === "delete"
        ? {
            unit: base.unit,
            deleted: true,
            question:
              course === "algorithms"
                ? { bookmarkId: base.id, aliases: base.question.aliases || [] }
                : { id: base.id, aliases: base.question.aliases || [] },
          }
        : { unit: base.unit, question: JSON.parse(e.data) };
    });
}

function builtinVariants(raw) {
  const inherited =
    builtinSearch.choiceAliases(
      raw.options ?? raw.opts ?? [],
      raw.optionTranslations,
    ) || [];
  const results = [];
  for (const q of [raw, ...(raw.sourceVariants || [])]) {
    const options = q.options ?? q.opts ?? [];
    const aliases = builtinSearch.choiceAliases(
      options,
      q.optionTranslations,
      inherited,
    );
    for (const stem of builtinSearch.questionStemVersions(
      q.stem ?? q.q,
      q.translation,
    ))
      for (const choices of builtinSearch.choiceCombinations(options, aliases))
        results.push({
          ...q,
          stem,
          options: choices,
          imageKeys: q.imageKeys || raw.imageKeys,
        });
  }
  return results;
}
