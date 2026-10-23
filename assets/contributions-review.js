import {
  COURSE_UNITS,
  TYPES,
  normalizeType,
  normalizeBatch,
} from "./contribution-model.js?v=os8-deadlocks-20261023";
import {
  esc,
  api,
  message,
  questionPreview,
  statusLabel,
  showSimilar,
  downloadJSON,
} from "./contributions-ui.js?v=site-audit-20261017";
const $ = (id) => document.getElementById(id),
  origin = window.courseContributions.apiOrigin;
if (location.origin !== origin) {
  location.replace(origin + "/review");
} else {
  start();
}
let entries = new Map(),
  cursor = null,
  loadSequence = 0;
function unitOptions(course, selected) {
  return Object.entries(COURSE_UNITS[course].units)
    .map(
      ([id, name]) =>
        `<option value="${id}" ${id === selected ? "selected" : ""}>${name}</option>`,
    )
    .join("");
}
function fields(q, i) {
  return `<div class="review-question" data-question-index="${i}"><div class="section-heading"><h3>第 ${i + 1} 題</h3><button class="text-button remove-question" type="button" data-remove-question="${i}">移除此題</button></div><div class="field-grid"><label>分類<input data-field="category" maxlength="100" value="${esc(q.category)}"></label><label>題型<select data-field="type">${TYPES.map((t) => `<option ${t === normalizeType(q.type, q.images) ? "selected" : ""}>${t}</option>`).join("")}</select></label></div><label>題目<textarea data-field="stem" rows="4" maxlength="10000">${esc(q.stem)}</textarea></label><label>選項（一行一個）<textarea data-field="options" rows="4">${esc(q.options.join("\n"))}</textarea></label><label>答案<textarea data-field="answer" rows="2" maxlength="4000">${esc(q.answer)}</textarea></label><label>解析<textarea data-field="explanation" rows="4" maxlength="16000">${esc(q.explanation)}</textarea></label>${q.images.map((src, j) => `<div class="image-previews"><img src="${esc(src)}" alt="第 ${i + 1} 題的題圖 ${j + 1}"><label class="consent"><input type="checkbox" data-keep-image="${j}" checked>保留此題圖</label></div>`).join("")}</div>`;
}
function entryMarkup(entry) {
  const p = entry.payload,
    pending = entry.status === "pending";
  return `<details class="panel review-entry ${pending ? "draft-entry" : ""}" data-id="${entry.id}" data-draft-id="review:${entry.id}" data-revision="${entry.revision}"><summary>${esc(p.title)} · ${esc(COURSE_UNITS[p.course].name)} · ${esc(COURSE_UNITS[p.course].units[p.unit])} · ${p.questions.length} 題</summary><p class="batch-meta">投稿編號：${entry.id}\n投稿者：${esc(p.name || "未提供稱呼")}\n收到時間：${esc(new Date(entry.createdAt).toLocaleString("zh-TW"))}\n來源：${esc(p.source || "未提供")}\n狀態：${statusLabel[entry.status]}</p>${
    pending
      ? `<div class="field-grid"><label>科目<select data-batch="course">${Object.entries(
          COURSE_UNITS,
        )
          .map(
            ([id, c]) =>
              `<option value="${id}" ${id === p.course ? "selected" : ""}>${c.name}</option>`,
          )
          .join(
            "",
          )}</select></label><label>單元<select data-batch="unit">${unitOptions(p.course, p.unit)}</select></label></div><label>題庫名稱<input data-batch="title" maxlength="100" value="${esc(p.title)}"></label><label>來源說明<textarea data-batch="source" rows="2" maxlength="2000">${esc(p.source)}</textarea></label><div class="questions-container">${p.questions.map(fields).join("")}</div><div class="similar-warning" hidden></div><div class="decision"><label>給投稿者的說明（退回時必填）<textarea class="review-note" rows="2" maxlength="2000" placeholder="說明需要調整的地方"></textarea></label><p class="muted">核准會發布目前保留的題目與修改內容。重複題會自動略過，只發布尚未收錄的題目。</p><div class="actions"><button class="button" type="button" data-action="approve">核准並加入題庫</button><button class="button secondary" type="button" data-action="reject">退回投稿</button><button class="text-button" type="button" data-discard-draft>還原伺服器內容</button></div></div>`
      : p.questions
          .map((q, i) => questionPreview(q, i) + "</article>")
          .join("") + (entry.note ? `<p>站主說明：${esc(entry.note)}</p>` : "")
  }</details>`;
}
async function load(append = false) {
  flushDrafts();
  const seq = ++loadSequence;
  $("refresh").disabled = true;
  $("loadMore").disabled = true;
  try {
    const result = await api(
      "/api/review?status=" +
        $("statusFilter").value +
        (append && cursor ? "&cursor=" + cursor : ""),
    );
    if (seq !== loadSequence) return;
    if (!append) {
      entries = new Map();
      $("reviewList").innerHTML = "";
    }
    for (const entry of result.items) {
      entries.set(entry.id, entry);
      $("reviewList").insertAdjacentHTML("beforeend", entryMarkup(entry));
      if (entry.status === "pending")
        restoreEntry($("reviewList").lastElementChild);
    }
    cursor = result.nextCursor;
    $("loadMore").hidden = !cursor;
    $("reviewCount").textContent = entries.size
      ? `已載入 ${entries.size} 份${$("statusFilter").selectedOptions[0].textContent}投稿。`
      : "目前沒有" +
        $("statusFilter").selectedOptions[0].textContent +
        "的投稿。";
  } catch (error) {
    if (seq === loadSequence && error.status === 401) {
      await start();
      return;
    }
    if (seq === loadSequence) message(error.message, true);
  } finally {
    if (seq === loadSequence) {
      $("refresh").disabled = false;
      $("loadMore").disabled = false;
    }
  }
}
async function start() {
  try {
    const session = await api("/api/session");
    if (session.isReviewer) {
      initDrafts(session.userId);
      $("managementTabs").hidden = false;
      $("loginPanel").hidden = true;
      $("reviewWorkspace").hidden = false;
      await load();
      return;
    }
    $("loginPanel").hidden = false;
    $("reviewWorkspace").hidden = true;
    $("managementWorkspace").hidden = true;
    $("managementTabs").hidden = true;
    const resetRequested =
      new URLSearchParams(window.location.search).get("credentials") === "reset";
    const canSetUp =
      session.canUseSetupCode ||
      (session.canManageCredentials &&
        (!session.accountConfigured || resetRequested));
    $("passwordLoginForm").hidden = !session.accountConfigured || canSetUp;
    $("passwordSetupForm").hidden = !canSetUp;
    $("setupCodeField").hidden = !session.canUseSetupCode;
    $("setupCode").required = session.canUseSetupCode;
    $("credentialAccess").hidden =
      session.canUseSetupCode ||
      (session.canManageCredentials && canSetUp);
    if (session.canUseSetupCode) {
      $("loginTitle").textContent = session.accountConfigured
        ? "設定或重設管理者帳號"
        : "首次設定管理者帳號";
      $("loginHint").textContent =
        "輸入一次性設定碼並設定帳號密碼；設定碼使用後就會失效。之後登入只需帳號密碼。";
    } else if (canSetUp && session.canManageCredentials) {
      $("loginTitle").textContent = session.accountConfigured
        ? "重設管理者帳號"
        : "首次設定管理者帳號";
      $("loginHint").textContent = session.accountConfigured
        ? "已用綁定帳號驗證身份。可設定新的登入帳號與密碼。"
        : "已用綁定帳號驗證身份。設定帳號與密碼後即可登入審核。";
    } else {
      $("loginTitle").textContent = "管理者登入";
      $("loginHint").textContent = session.accountConfigured
        ? "輸入已設定的帳號與密碼即可登入審核。"
        : "首次設定管理者帳號需要先以綁定的管理者帳號驗證。";
      $("credentialAccess").textContent = session.accountConfigured
        ? "忘記密碼？以綁定的管理者帳號驗證"
        : "以綁定的管理者帳號驗證並設定登入帳號";
    }
  } catch (error) {
    message(error.message, true);
  }
}
$("passwordLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("loginSubmit");
  submit.disabled = true;
  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("loginUsername").value,
        password: $("loginPassword").value,
      }),
    });
    $("loginPassword").value = "";
    message("");
    await start();
  } catch (error) {
    message(error.message, true);
  } finally {
    submit.disabled = false;
  }
});
$("passwordSetupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("setupSubmit");
  submit.disabled = true;
  try {
    await api("/api/password/setup", {
      method: "POST",
      body: JSON.stringify({
        username: $("setupUsername").value,
        password: $("setupPassword").value,
        confirmPassword: $("setupPasswordConfirm").value,
        setupCode: $("setupCode").value,
      }),
    });
    $("setupCode").value = "";
    $("setupPassword").value = "";
    $("setupPasswordConfirm").value = "";
    message("");
    await start();
  } catch (error) {
    message(error.message, true);
  } finally {
    submit.disabled = false;
  }
});
// Enable credential submission only after both POST handlers are attached.
if (location.origin === origin) {
  $("loginSubmit").disabled = false;
  $("setupSubmit").disabled = false;
}
$("signOut").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
    location.reload();
  } catch (error) {
    message(error.message, true);
  }
});
$("statusFilter").addEventListener("change", () => load());
$("refresh").addEventListener("click", () => load());
$("loadMore").addEventListener("click", () => load(true));
$("reviewList").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const card = button.closest(".review-entry"),
    entry = entries.get(card.dataset.id);
  if (button.dataset.removeQuestion !== undefined) {
    button.closest(".review-question").remove();
    markDraft(card);
    return;
  }
  if (!button.dataset.action) return;
  const action = button.dataset.action,
    note = card.querySelector(".review-note").value.trim();
  if (action === "reject" && !note) {
    message("請填寫退回原因，讓同學知道怎麼調整。", true);
    return;
  }
  try {
    let payload;
    if (action === "approve") {
      const batch = { ...entry.payload };
      card
        .querySelectorAll("[data-batch]")
        .forEach((node) => (batch[node.dataset.batch] = node.value));
      batch.questions = [...card.querySelectorAll("[data-question-index]")].map(
        (node) => {
          const q = {
            ...entry.payload.questions[Number(node.dataset.questionIndex)],
          };
          node.querySelectorAll("[data-field]").forEach(
            (field) =>
              (q[field.dataset.field] =
                field.dataset.field === "options"
                  ? field.value
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : field.value),
          );
          q.images = [
            ...node.querySelectorAll("[data-keep-image]:checked"),
          ].map((box) => q.images[Number(box.dataset.keepImage)]);
          return q;
        },
      );
      normalizeBatch(batch);
      payload = batch;
    }
    flushDrafts();
    card
      .querySelectorAll("button,input,textarea,select")
      .forEach((node) => (node.disabled = true));
    message(action === "approve" ? "正在核准並發布題目…" : "正在退回投稿…");
    const result = await api("/api/review/" + entry.id, {
      method: "POST",
      body: JSON.stringify({
        action,
        revision: entry.revision,
        payload,
        note,
        confirmSimilar:
          card.querySelector(".similar-consent")?.checked === true,
      }),
    });
    message(
      action === "approve"
        ? `已完成審核，新增 ${result.acceptedCount} 題${result.skippedCount ? `，自動略過 ${result.skippedCount} 題重複題目` : ""}。`
        : "已退回投稿。",
    );
    clearDraft(card);
    await load();
  } catch (error) {
    if (error.details?.code === "similar_questions")
      showSimilar(
        card.querySelector(".similar-warning"),
        error.details.possibleDuplicates,
      );
    card
      .querySelectorAll("button,input,textarea,select")
      .forEach((node) => (node.disabled = false));
    message(error.message, true);
  }
});

let draftKey = null,
  drafts = {},
  draftTimer = null,
  draftFailed = false;
const dirtyCards = new Set();
function initDrafts(userId) {
  draftKey = "course-library-review-drafts-v1." + userId;
  try {
    drafts = JSON.parse(localStorage.getItem(draftKey) || "{}");
    if (!drafts || Array.isArray(drafts) || typeof drafts !== "object")
      drafts = {};
  } catch {
    drafts = {};
  }
}
function persistDrafts() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(drafts));
    draftFailed = false;
    $("reviewDraftStatus").textContent = "編輯草稿已保存在這台裝置。";
  } catch {
    draftFailed = true;
    $("reviewDraftStatus").textContent =
      "無法自動保存，請先下載本機編輯草稿；尚未送出的修改仍在頁面中。";
  }
}
function captureEntry(card) {
  const batch = {};
  card
    .querySelectorAll("[data-batch]")
    .forEach((n) => (batch[n.dataset.batch] = n.value));
  return {
    revision: Number(card.dataset.revision),
    batch,
    questions: [...card.querySelectorAll("[data-question-index]")].map(
      (node) => {
        const values = {};
        node
          .querySelectorAll("[data-field]")
          .forEach((n) => (values[n.dataset.field] = n.value));
        return {
          index: Number(node.dataset.questionIndex),
          values,
          keep: [...node.querySelectorAll("[data-keep-image]:checked")].map(
            (n) => Number(n.dataset.keepImage),
          ),
        };
      },
    ),
    note: card.querySelector(".review-note,.manage-note")?.value || "",
    savedAt: new Date().toISOString(),
  };
}
function flushDrafts() {
  clearTimeout(draftTimer);
  if (!draftKey) return;
  for (const card of dirtyCards)
    if (card.isConnected) drafts[card.dataset.draftId] = captureEntry(card);
  if (dirtyCards.size) persistDrafts();
  dirtyCards.clear();
}
function markDraft(card) {
  dirtyCards.add(card);
  clearTimeout(draftTimer);
  draftTimer = setTimeout(flushDrafts, 300);
}
function restoreEntry(card) {
  const id = card.dataset.draftId,
    draft = drafts[id];
  if (!draft) return;
  if (draft.revision !== Number(card.dataset.revision)) {
    drafts[id + "@" + draft.revision + "-" + Date.now()] = draft;
    delete drafts[id];
    persistDrafts();
    $("reviewDraftStatus").textContent =
      "題目版本已變更，舊草稿另存保留；可使用「下載本機編輯草稿」查看，未覆蓋新版本。";
    return;
  }
  if (!Array.isArray(draft.questions) || !draft.batch) return;
  const course = card.querySelector('[data-batch="course"]'),
    unit = card.querySelector('[data-batch="unit"]');
  if (course && COURSE_UNITS[draft.batch.course]) {
    course.value = draft.batch.course;
    unit.innerHTML = unitOptions(course.value, draft.batch.unit);
  }
  card.querySelectorAll("[data-batch]").forEach((n) => {
    if (typeof draft.batch[n.dataset.batch] === "string")
      n.value = draft.batch[n.dataset.batch];
  });
  for (const node of [...card.querySelectorAll("[data-question-index]")]) {
    const q = draft.questions.find(
      (q) => q.index === Number(node.dataset.questionIndex),
    );
    if (!q) {
      node.remove();
      continue;
    }
    node.querySelectorAll("[data-field]").forEach((n) => {
      if (typeof q.values?.[n.dataset.field] === "string")
        n.value = q.values[n.dataset.field];
    });
    node
      .querySelectorAll("[data-keep-image]")
      .forEach(
        (n) =>
          (n.checked =
            Array.isArray(q.keep) &&
            q.keep.includes(Number(n.dataset.keepImage))),
      );
  }
  const note = card.querySelector(".review-note,.manage-note");
  if (note) note.value = draft.note || "";
  const status = document.createElement("p");
  status.className = "draft-status";
  status.textContent = "已還原這台裝置的編輯草稿。";
  card.querySelector("summary").after(status);
}
function clearDraft(card) {
  dirtyCards.delete(card);
  delete drafts[card.dataset.draftId];
  persistDrafts();
}
for (const name of ["input", "change"])
  document.addEventListener(name, (event) => {
    const card = event.target.closest(".draft-entry");
    if (!card) return;
    if (event.target.dataset.batch === "course") {
      const unit = card.querySelector('[data-batch="unit"]');
      unit.innerHTML = unitOptions(event.target.value, "");
    }
    if (!event.target.classList.contains("similar-consent")) {
      const c = card.querySelector(".similar-consent");
      if (c) c.checked = false;
    }
    markDraft(card);
  });
window.addEventListener("beforeunload", (event) => {
  flushDrafts();
  if (draftFailed) {
    event.preventDefault();
    event.returnValue = "";
  }
});
$("exportReviewDrafts").addEventListener("click", () => {
  flushDrafts();
  downloadJSON(
    { savedAt: new Date().toISOString(), drafts },
    "題庫編輯草稿.json",
  );
});

let publications = new Map(),
  publicationCursor = null,
  publicationSequence = 0;
$("manageCourse").innerHTML = Object.entries(COURSE_UNITS)
  .map(([id, c]) => `<option value="${id}">${esc(c.name)}</option>`)
  .join("");
function libraryPage(course) {
  return (
    "https://yocheng06.github.io/course-library/" +
    (course === "os" ? "os.html" : "algorithms.html")
  );
}
function managedMarkup(row) {
  if (row.mergedInto)
    return `<details class="panel management-entry" data-id="${esc(row.id)}"><summary>${esc(row.question.stem.slice(0, 100))} · 已合併</summary><p>原稿已封存，收錄於 <a href="${libraryPage(row.course)}?question=${encodeURIComponent(row.mergedInto)}">${esc(row.mergedInto)}</a>；完整資料仍可匯出備份。</p><p>${esc(row.question.explanation)}</p><button class="text-button" type="button" data-manage-action="history">查看修改紀錄</button><div class="history-list" hidden></div></details>`;
  return `<details class="panel management-entry draft-entry" data-id="${esc(row.id)}" data-draft-id="manage:${esc(row.id)}" data-revision="${row.revision}"><summary>${esc(row.question.stem.slice(0, 100))} · ${row.published ? "上架中" : "已下架"} · 版本 ${row.revision}</summary><p class="muted">題目 ID：${esc(row.id)}</p><div class="field-grid"><label>科目<select data-batch="course">${Object.entries(
    COURSE_UNITS,
  )
    .map(
      ([id, c]) =>
        `<option value="${id}" ${row.course === id ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>單元<select data-batch="unit">${unitOptions(row.course, row.unit)}</select></label></div>${fields(row.question, 0)}<label>修改說明（選填）<textarea class="manage-note" maxlength="2000" rows="2"></textarea></label><div class="similar-warning" hidden></div><div class="actions"><button class="button" type="button" data-manage-action="update">儲存修改</button><button class="button secondary" type="button" data-manage-action="${row.published ? "hide" : "restore"}">${row.published ? "下架題目" : "重新上架"}</button><button class="text-button" type="button" data-manage-action="history">查看修改紀錄</button><button class="text-button" type="button" data-discard-draft>還原伺服器內容</button></div><div class="history-list" hidden></div></details>`;
}
async function loadPublications(append = false) {
  flushDrafts();
  const seq = ++publicationSequence;
  $("manageMore").disabled = true;
  try {
    const params = new URLSearchParams({
      course: $("manageCourse").value,
      state: $("manageState").value,
      q: $("manageQuery").value.trim(),
    });
    if (append && publicationCursor) params.set("cursor", publicationCursor);
    const result = await api("/api/manage/questions?" + params);
    if (seq !== publicationSequence) return;
    if (!append) {
      publications = new Map();
      $("publishedList").replaceChildren();
    }
    for (const row of result.items) {
      publications.set(row.id, row);
      $("publishedList").insertAdjacentHTML("beforeend", managedMarkup(row));
      restoreEntry($("publishedList").lastElementChild);
    }
    publicationCursor = result.nextCursor;
    $("manageMore").hidden = !publicationCursor;
    $("manageCount").textContent = publications.size
      ? `已載入 ${publications.size} 題。`
      : "目前沒有符合條件的題目。";
  } catch (e) {
    message(e.message, true);
  } finally {
    if (seq === publicationSequence) $("manageMore").disabled = false;
  }
}
$("manageSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  loadPublications();
});
for (const id of ["manageCourse", "manageState"])
  $(id).addEventListener("change", () => loadPublications());
$("manageMore").addEventListener("click", () => loadPublications(true));
for (const [id, isReview] of [
  ["showReviews", true],
  ["showPublished", false],
])
  $(id).addEventListener("click", () => {
    flushDrafts();
    $("reviewWorkspace").hidden = !isReview;
    $("managementWorkspace").hidden = isReview;
    $("showReviews").setAttribute("aria-pressed", String(isReview));
    $("showPublished").setAttribute("aria-pressed", String(!isReview));
    if (!isReview) loadPublications();
  });
$("exportBackup").addEventListener("click", async () => {
  $("exportBackup").disabled = true;
  try {
    downloadJSON(await api("/api/manage/export"), "課程題庫完整備份.json");
    message(
      "已下載包含解析、下架題目、投稿紀錄、修改歷史與題圖連結的資料備份。",
    );
  } catch (e) {
    message(e.message, true);
  } finally {
    $("exportBackup").disabled = false;
  }
});
$("publishedList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-manage-action]");
  if (!button) return;
  const card = button.closest(".management-entry"),
    row = publications.get(card.dataset.id),
    action = button.dataset.manageAction;
  if (card.dataset.busy === "true") return;
  if (action === "history") {
    try {
      const result = await api("/api/manage/questions/" + row.id + "/history"),
        box = card.querySelector(".history-list");
      box.hidden = false;
      box.innerHTML =
        "<h3>修改前的版本紀錄</h3>" +
        (result.items.length
          ? result.items
              .map(
                (item) =>
                  `<details><summary>版本 ${item.revision} · ${esc({ update: "儲存修改前", hide: "下架前", restore: "重新上架前", 補充解析: "補充解析前" }[item.action] || item.action)} · ${esc(new Date(item.created_at).toLocaleString("zh-TW"))}</summary><p>${esc(item.note || "未填說明")}</p><div class="draft-card"><h3>${esc(item.data.stem ?? item.data.q)}</h3>${(item.data.options ?? item.data.opts ?? []).length ? `<ol type="A">${(item.data.options ?? item.data.opts).map((o) => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}<p><strong>答案：</strong>${esc(item.data.answer ?? item.data.a)}</p><p><strong>解析：</strong>${esc(item.data.explanation ?? item.data.ex ?? "")}</p></div></details>`,
              )
              .join("")
          : "<p>尚無修改紀錄。</p>");
    } catch (e) {
      message(e.message, true);
    }
    return;
  }
  let payload;
  if (action === "update") {
    const node = card.querySelector("[data-question-index]"),
      q = { ...row.question };
    node.querySelectorAll("[data-field]").forEach(
      (n) =>
        (q[n.dataset.field] =
          n.dataset.field === "options"
            ? n.value
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
            : n.value),
    );
    q.images = [...node.querySelectorAll("[data-keep-image]:checked")].map(
      (n) => row.question.images[Number(n.dataset.keepImage)],
    );
    payload = {
      course: card.querySelector('[data-batch="course"]').value,
      unit: card.querySelector('[data-batch="unit"]').value,
      title: "已發布題目",
      questions: [q],
    };
    try {
      normalizeBatch(payload);
    } catch (e) {
      message(e.message, true);
      return;
    }
  }
  flushDrafts();
  card.dataset.busy = "true";
  card
    .querySelectorAll("button,input,select,textarea")
    .forEach((n) => (n.disabled = true));
  try {
    await api("/api/manage/questions/" + row.id, {
      method: "POST",
      body: JSON.stringify({
        action,
        revision: row.revision,
        payload,
        note: card.querySelector(".manage-note").value,
        confirmSimilar:
          card.querySelector(".similar-consent")?.checked === true,
      }),
    });
    clearDraft(card);
    message(
      action === "update"
        ? "題目與解析已儲存，重新整理課程頁即可查看。"
        : action === "hide"
          ? "題目已下架，資料與歷史仍保留。"
          : "題目已重新上架。",
    );
    await loadPublications();
  } catch (e) {
    if (e.details?.code === "similar_questions")
      showSimilar(
        card.querySelector(".similar-warning"),
        e.details.possibleDuplicates,
      );
    message(e.message, true);
  } finally {
    card.dataset.busy = "false";
    card
      .querySelectorAll("button,input,select,textarea")
      .forEach((n) => (n.disabled = false));
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-discard-draft]");
  if (!button) return;
  const card = button.closest(".draft-entry");
  clearDraft(card);
  if (card.dataset.draftId.startsWith("manage:")) loadPublications();
  else load();
  message("已捨棄這份本機草稿，重新載入伺服器內容。");
});
