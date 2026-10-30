import {
  api,
  esc,
  questionPreview,
  downloadJSON,
} from "./contributions-ui.js?v=treasure-unit-20261030";
import {
  COURSE_UNITS,
  TYPES,
} from "./contribution-model.js?v=treasure-unit-20261030";
let panel,
  tab,
  allowed = false,
  sequence = 0,
  historySequence = 0,
  cursor = null,
  current = null,
  userKey = "",
  drafts = {},
  busy = false;
const rows = new Map(),
  $ = (selector) => panel.querySelector(selector);
function status(text) {
  $("[data-status]").textContent = text;
}
function key(row) {
  return row.course + ":" + row.id;
}
function init() {
  if (panel) return;
  tab = document.createElement("button");
  tab.type = "button";
  tab.className = "button secondary";
  tab.id = "showBuiltin";
  tab.textContent = "內建題目";
  tab.setAttribute("aria-pressed", "false");
  document.getElementById("showReviews").before(tab);
  panel = document.createElement("section");
  panel.hidden = true;
  panel.id = "builtinWorkspace";
  panel.innerHTML = `<div class="panel"><h2>內建題目管理</h2><p>儲存後會同步到閱讀、練習、批次查題及投稿重複檢查。每次儲存都保留修改歷史；公開刪除的題目可在「已刪除」範圍還原。</p><p class="notice builtin-history-guide"><strong>還原題目：</strong>按「查看目前科目已修改題目」，列出本課程全部單元的修改題目；每題可查看歷史、退回上一版或退回原始版。操作前會先確認，目前版本也會保留在歷史中。</p><div class="actions"><button type="button" class="button secondary" data-show-modified>查看目前科目已修改題目</button></div><form data-search><div class="field-grid"><label>科目<select name="course"><option value="os">作業系統</option><option value="algorithms">演算法</option></select></label><label>單元<select name="unit"></select></label><label>範圍<select name="state"><option value="all">全部內建題</option><option value="modified">已修改</option><option value="deleted">已刪除</option></select></label><label>搜尋題號或文字<input name="q" maxlength="100"></label></div><div class="actions"><button class="button" type="submit">搜尋／重新載入</button><button type="button" class="text-button" data-download>下載內建題編輯草稿</button></div></form><p data-status role="status" aria-live="polite"></p><div data-list></div><button type="button" class="button secondary" data-more hidden>載入更多</button></div><div data-editor></div>`;
  document.getElementById("managementWorkspace").after(panel);
  tab.addEventListener("click", () => {
    if (!allowed) return;
    show();
    if (!rows.size) load();
  });
  for (const id of ["showHome", "showReviews", "showPublished"])
    document.getElementById(id).addEventListener("click", () => {
      panel.hidden = true;
      tab.setAttribute("aria-pressed", "false");
      tab.classList.add("secondary");
    });
  $("[data-search]").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!busy) load();
  });
  $("[data-show-modified]").addEventListener("click", () => {
    if (busy) return;
    $("[name=unit]").value = "";
    $("[name=state]").value = "modified";
    $("[name=q]").value = "";
    loadAllModified();
  });
  $("[name=course]").addEventListener("change", () => {
    units();
    if (!busy) load();
  });
  $("[data-more]").addEventListener("click", () => load(true));
  $("[data-download]").addEventListener("click", () =>
    downloadJSON(drafts, "內建題編輯草稿.json"),
  );
  $("[data-list]").addEventListener("click", async (event) => {
    const historyButton = event.target.closest("[data-open-history]"),
      rollbackButton = event.target.closest("[data-rollback]"),
      originalButton = event.target.closest("[data-rollback-original]"),
      restoreDeletedButton = event.target.closest("[data-restore-deleted]"),
      editButton = event.target.closest("[data-open]"),
      rowKey =
        historyButton?.dataset.openHistory ||
        rollbackButton?.dataset.rollback ||
        originalButton?.dataset.rollbackOriginal ||
        restoreDeletedButton?.dataset.restoreDeleted ||
        editButton?.dataset.open,
      row = rowKey && rows.get(rowKey);
    if (!row || busy) return;
    if (originalButton) {
      await rollbackToOriginal(row);
      return;
    }
    if (restoreDeletedButton) {
      await restoreDeleted(row);
      return;
    }
    if (rollbackButton) {
      await rollbackToPrevious(row);
      return;
    }
    open(row);
    if (historyButton) await loadHistory(row);
  });
  $("[data-editor]").addEventListener("input", capture);
  $("[data-editor]").addEventListener("change", capture);
  $("[data-editor]").addEventListener("submit", (event) => {
    event.preventDefault();
    save("update");
  });
  $("[data-editor]").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || busy) return;
    const action = button.dataset.action;
    if (action === "add") {
      const q = readQuestion();
      if (q.options.length >= 8) return;
      q.options.push("");
      q.optionTranslations.push("");
      fill(q);
      capture();
    } else if (action === "remove") {
      const q = readQuestion(),
        i = Number(button.dataset.index);
      q.options.splice(i, 1);
      q.optionTranslations.splice(i, 1);
      fill(q);
      capture();
    } else if (action === "history") {
      await loadHistory();
    } else if (action === "restore") {
      const q = panel.historyRows?.[Number(button.dataset.index)]?.after;
      if (q) {
        fill(q);
        capture();
        editorStatus("已套用歷史內容；填寫修改說明並儲存後才會生效。");
      }
    } else if (action === "reset") {
      if (confirm("將這道題還原為主站內建內容？目前歷史仍會保留。"))
        save("reset");
    } else if (action === "discard") {
      delete drafts[key(current)];
      persist();
      open(current, false);
    }
  });
  units();
}
function units() {
  const course = $("[name=course]").value;
  $("[name=unit]").innerHTML =
    '<option value="">全部單元</option>' +
    Object.entries(COURSE_UNITS[course].units)
      .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`)
      .join("");
}
function show() {
  panel.hidden = false;
  document.getElementById("managementHome").hidden = true;
  document.getElementById("reviewWorkspace").hidden = true;
  document.getElementById("managementWorkspace").hidden = true;
  tab.setAttribute("aria-pressed", "true");
  tab.classList.remove("secondary");
  for (const id of ["showHome", "showReviews", "showPublished"]) {
    const button = document.getElementById(id);
    button.setAttribute("aria-pressed", "false");
    button.classList.add("secondary");
  }
}
export function builtinAccess(value, userId = "") {
  init();
  allowed = value;
  if (!value) {
    sequence++;
    current = null;
    rows.clear();
    drafts = {};
    userKey = "";
    panel.hidden = true;
    $("[data-list]").replaceChildren();
    $("[data-editor]").replaceChildren();
    return;
  }
  const next = "course-library.builtin-drafts.v1." + userId;
  if (userKey !== next) {
    userKey = next;
    try {
      drafts = JSON.parse(localStorage.getItem(userKey) || "{}");
      if (!drafts || typeof drafts !== "object" || Array.isArray(drafts))
        drafts = {};
    } catch {
      drafts = {};
    }
  }
}
export async function openBuiltinEditor(course, id) {
  init();
  if (!allowed) return;
  show();
  $("[name=course]").value = course;
  units();
  $("[name=q]").value = id;
  $("[name=state]").value = "all";
  await load();
  const row = [...rows.values()].find(
    (r) => r.id === id || r.aliases.includes(id),
  );
  if (row) open(row);
  else return false;
  panel.scrollIntoView({ block: "start", behavior: "smooth" });
  return true;
}
async function load(append = false) {
  const seq = ++sequence;
  status("正在載入內建題…");
  try {
    const params = new URLSearchParams(new FormData($("[data-search]")));
    if (append && cursor) params.set("cursor", cursor);
    const result = await api("/api/manage/builtin-questions?" + params);
    if (seq !== sequence || !allowed) return;
    if (!append) {
      rows.clear();
      $("[data-list]").replaceChildren();
    }
    for (const row of result.items) {
      rows.set(key(row), row);
      $("[data-list]").insertAdjacentHTML(
        "beforeend",
        renderBuiltinRow(row),
      );
    }
    cursor = result.nextCursor;
    $("[data-more]").hidden = !cursor;
    status(`符合 ${result.total} 題，已載入 ${rows.size} 題。`);
  } catch (e) {
    if (seq === sequence) status(e.message);
  }
}
function renderBuiltinRow(row) {
  const id = esc(key(row));
  if (row.deleted)
    return `<article class="builtin-question-row"><div class="builtin-question-summary"><button type="button" class="text-button" data-open="${id}">查看已刪除題目：${esc(row.id)} · ${esc(row.question.stem.slice(0, 100))}</button><span class="builtin-question-meta">已刪除 · 版本 ${row.revision}</span></div><div class="actions builtin-question-actions"><button type="button" class="button" data-restore-deleted="${id}">還原題目</button><button type="button" class="button secondary" data-open-history="${id}">查看修改歷史</button></div></article>`;
  return `<article class="builtin-question-row"><div class="builtin-question-summary"><button type="button" class="text-button" data-open="${id}">編輯題目：${esc(row.id)} · ${esc(row.question.stem.slice(0, 100))}</button><span class="builtin-question-meta">${row.modified ? "已修改" : "尚未修改"} · 版本 ${row.revision}</span></div>${row.modified ? `<div class="actions builtin-question-actions"><button type="button" class="button secondary" data-open-history="${id}">查看修改歷史</button><button type="button" class="button" data-rollback="${id}">直接退回上一版</button><button type="button" class="button secondary" data-rollback-original="${id}">直接退回原始版</button></div>` : `<span class="builtin-question-meta">尚無修改歷史</span>`}</article>`;
}
async function loadAllModified() {
  const seq = ++sequence,
    paramsBase = new URLSearchParams(new FormData($("[data-search]"))),
    courseLabel = $("[name=course]").selectedOptions[0]?.textContent || "";
  paramsBase.set("state", "modified");
  paramsBase.set("unit", "");
  status("正在載入所有已修改題目…");
  rows.clear();
  $("[data-list]").replaceChildren();
  $("[data-more]").hidden = true;
  cursor = null;
  let nextCursor = null,
    total = 0;
  try {
    do {
      const params = new URLSearchParams(paramsBase);
      if (nextCursor) params.set("cursor", nextCursor);
      const result = await api("/api/manage/builtin-questions?" + params);
      if (seq !== sequence || !allowed) return;
      total = result.total;
      for (const row of result.items) {
        rows.set(key(row), row);
        $("[data-list]").insertAdjacentHTML("beforeend", renderBuiltinRow(row));
      }
      nextCursor = result.nextCursor;
      status(`已載入 ${rows.size}／${total} 題已修改題目…`);
    } while (nextCursor);
    status(
      total
        ? `${courseLabel}共 ${total} 題已修改，已顯示全部單元。`
        : `${courseLabel}目前沒有已修改題目。`,
    );
  } catch (e) {
    if (seq === sequence) status(e.message);
  }
}
function endpoint(row = current) {
  return (
    "/api/manage/builtin-questions/" +
    row.course +
    "/" +
    encodeURIComponent(row.id)
  );
}
async function loadHistory(row = current) {
  if (!row) return;
  const request = ++historySequence;
  editorStatus("正在載入修改歷史…");
  try {
    const result = await api(
      "/api/manage/builtin-questions/" +
        row.course +
        "/" +
        encodeURIComponent(row.id) +
        "/history",
    );
    if (request !== historySequence || current !== row) return;
    panel.historyRows = result.items;
    $("[data-history]").innerHTML = result.items.length
      ? result.items
          .map(
            (r, i) =>
              `<details><summary>版本 ${r.revision} · ${esc(r.note)} · ${esc(new Date(r.createdAt).toLocaleString("zh-TW"))}</summary><h4>修改前</h4>${questionPreview(r.before, i)}</article><h4>修改後</h4>${questionPreview(r.after, i)}</article><button type="button" class="button secondary" data-action="restore" data-index="${i}">載入此版本進行還原</button></details>`,
          )
          .join("") +
        `<p class="muted">載入舊版後，請填寫修改說明並按「儲存並同步題庫」才會生效；目前版本仍保留在歷史中。</p>`
      : "尚無修改歷史。";
    editorStatus("");
  } catch (e) {
    if (request === historySequence && current === row)
      editorStatus(e.message);
  }
}
async function rollbackToPrevious(row) {
  if (busy) return;
  busy = true;
  status(`正在確認 ${row.id} 的上一個版本…`);
  try {
    const result = await api(endpoint(row) + "/history"),
      latest = result.items[0];
    if (!latest || latest.revision !== row.revision) {
      await loadAllModified();
      status("題目已有新修改，清單已重新載入；請確認最新版本後再操作。");
      return;
    }
    const previous = latest.before,
      clip = (text) => String(text || "（空白）").slice(0, 100),
      confirmed = confirm(
        `確定將「${row.id}」直接退回上一版嗎？\n\n` +
          `目前題幹：${clip(row.question.stem)}\n` +
          `退回題幹：${clip(previous.stem)}\n` +
          `目前答案：${clip(row.question.answer)}\n` +
          `退回答案：${clip(previous.answer)}\n\n` +
          "退回後會立即同步題庫；目前版本也會保留在修改歷史中。",
      );
    if (!confirmed) {
      status("已取消，題目未變動。");
      return;
    }
    status(`正在退回 ${row.id}…`);
    await api(endpoint(row), {
      method: "POST",
      body: JSON.stringify({
        action: "rollback",
        revision: row.revision,
        sourceHash: row.sourceHash,
        note: `站主確認直接退回上一版（從第 ${row.revision} 版退回）`,
      }),
    });
    await loadAllModified();
    status(`${row.id} 已退回上一版；本次還原也已記入修改歷史。`);
  } catch (e) {
    status(e.message);
  } finally {
    busy = false;
  }
}
async function rollbackToOriginal(row) {
  if (busy) return;
  const clip = (text) => String(text || "（空白）").slice(0, 100),
    confirmed = confirm(
      `確定將「${row.id}」直接退回原始版嗎？\n\n` +
        `目前題幹：${clip(row.question.stem)}\n` +
        `目前答案：${clip(row.question.answer)}\n\n` +
        "退回後會立即同步原始題庫內容；目前版本也會保留在修改歷史中。",
    );
  if (!confirmed) {
    status("已取消，題目未變動。");
    return;
  }
  busy = true;
  status(`正在將 ${row.id} 退回原始版…`);
  try {
    await api(endpoint(row), {
      method: "POST",
      body: JSON.stringify({
        action: "reset",
        revision: row.revision,
        sourceHash: row.sourceHash,
        note: "站主確認直接退回原始題庫版本",
      }),
    });
    await loadAllModified();
    status(`${row.id} 已退回原始題庫版本；原修改仍保留在歷史中。`);
  } catch (e) {
    status(e.message);
  } finally {
    busy = false;
  }
}
async function restoreDeleted(row) {
  if (busy || !row.deleted) return;
  if (!confirm(`確定還原「${row.id}」嗎？\n\n題目會重新出現在公開題庫；這次刪除紀錄仍會保留。`)) {
    status("已取消，題目未變動。");
    return;
  }
  busy = true;
  status(`正在還原 ${row.id}…`);
  try {
    await api(endpoint(row), {
      method: "POST",
      body: JSON.stringify({
        action: "rollback",
        revision: row.revision,
        sourceHash: row.sourceHash,
        note: "站主還原誤刪題目",
      }),
    });
    await load();
    status(`${row.id} 已還原並重新公開；刪除紀錄仍保留在修改歷史中。`);
  } catch (e) {
    status(e.message);
  } finally {
    busy = false;
  }
}
function editorStatus(text) {
  $("[data-editor-status]").textContent = text;
}
function open(row, restore = true) {
  historySequence++;
  current = row;
  panel.historyRows = [];
  $("[data-editor]").innerHTML =
    `<form class="panel" data-edit><h2>${esc(row.id)} · 編輯題目</h2><p>版本 ${row.revision}${row.sourceChanged ? " · 內建原稿已更新，請核對目前內容。" : ""}</p><div class="actions"><button type="button" class="button secondary" data-action="history">查看／還原修改歷史</button></div><div data-fields></div><label>本次修改說明（必填）<textarea name="editNote" required maxlength="2000" rows="2"></textarea></label><div class="actions"><button type="submit" class="button">儲存並同步題庫</button><button type="button" class="text-button" data-action="reset">還原內建內容</button><button type="button" class="text-button" data-action="discard">捨棄本機草稿</button></div><p role="status" aria-live="polite" data-editor-status></p><div data-history></div></form>`;
  const draft = drafts[key(row)],
    usable =
      restore &&
      draft &&
      draft.revision === row.revision &&
      draft.sourceHash === row.sourceHash &&
      Array.isArray(draft.question?.options) &&
      Array.isArray(draft.question?.images);
  fill(usable ? draft.question : row.question);
  if (usable) {
    $("[name=editNote]").value = draft.note || "";
    editorStatus("已恢復此版本的本機草稿，尚未儲存到題庫。");
  } else if (restore && draft)
    editorStatus("找到舊版本草稿，未自動覆蓋目前題目；可下載草稿後核對。");
  $("[data-editor]").scrollIntoView({ block: "start", behavior: "smooth" });
}
function field(name, label, value, rows = 3, max = 10000) {
  return `<label>${label}<textarea name="${name}" rows="${rows}" maxlength="${max}">${esc(value)}</textarea></label>`;
}
function fill(q) {
  const images = [
    ...new Set([
      ...(current.availableImages || []),
      ...current.question.images,
    ]),
  ];
  $("[data-fields]").innerHTML =
    field("category", "分類", q.category, 1, 100) +
    `<label>題型<select name="type">${TYPES.map((t) => `<option ${t === q.type ? "selected" : ""}>${t}</option>`).join("")}</select></label>` +
    field("stem", "題幹", q.stem) +
    field("translation", "題幹翻譯（選填）", q.translation) +
    `<div data-options>${q.options.map((option, i) => `<div class="review-question">${field("option", "選項 " + String.fromCharCode(65 + i), option, 2, 2000)}${field("optionTranslation", "選項翻譯（選填）", q.optionTranslations?.[i] || "", 2, 2000)}<button type="button" class="text-button" data-action="remove" data-index="${i}">移除此選項</button></div>`).join("")}</div><button type="button" class="text-button" data-action="add">新增選項</button>` +
    field("answer", "答案（選擇題請填 A 或 A、B）", q.answer, 2, 4000) +
    `<label class="consent"><input name="answerProvided" type="checkbox" ${q.answerProvided ? "checked" : ""}>已確認並提供答案</label>` +
    field("explanation", "解析", q.explanation, 5, 16000) +
    field("note", "題目備註（選填）", q.note, 2, 4000) +
    images
      .map(
        (src) =>
          `<div class="image-previews"><img src="${esc(src)}" alt="原有題圖"><label class="consent"><input type="checkbox" name="image" value="${esc(src)}" ${q.images.includes(src) ? "checked" : ""}>保留此題圖</label></div>`,
      )
      .join("");
}
function readQuestion() {
  const f = $("[data-edit]"),
    value = (name) => f.elements.namedItem(name).value;
  return {
    category: value("category"),
    type: value("type"),
    stem: value("stem"),
    translation: value("translation"),
    options: [...f.querySelectorAll("[name=option]")].map((e) => e.value),
    optionTranslations: [...f.querySelectorAll("[name=optionTranslation]")].map(
      (e) => e.value,
    ),
    answer: value("answer"),
    answerProvided: f.elements.namedItem("answerProvided").checked,
    explanation: value("explanation"),
    note: value("note"),
    images: [...f.querySelectorAll("[name=image]:checked")].map((e) => e.value),
  };
}
function persist() {
  try {
    localStorage.setItem(userKey, JSON.stringify(drafts));
  } catch {
    editorStatus("本機草稿無法保存，請下載草稿或儲存到題庫。");
  }
}
function capture() {
  if (!current || busy) return;
  const k = key(current),
    old = drafts[k];
  drafts[k] = {
    revision: current.revision,
    sourceHash: current.sourceHash,
    question: readQuestion(),
    note: $("[name=editNote]").value,
    ...(old &&
    (old.revision !== current.revision || old.sourceHash !== current.sourceHash)
      ? { previousDraft: old }
      : old?.previousDraft
        ? { previousDraft: old.previousDraft }
        : {}),
  };
  persist();
}
async function save(action) {
  if (busy || !current) return;
  const note = $("[name=editNote]");
  if (!note.value.trim()) {
    note.setCustomValidity("請填寫本次修改說明。");
    note.reportValidity();
    note.focus();
    note.addEventListener("input", () => note.setCustomValidity(""), {
      once: true,
    });
    return;
  }
  const body = {
    action,
    revision: current.revision,
    sourceHash: current.sourceHash,
    note: note.value,
    question: readQuestion(),
  };
  capture();
  busy = true;
  $("[data-edit]")
    .querySelectorAll("button,input,select,textarea")
    .forEach((e) => (e.disabled = true));
  editorStatus("正在儲存…");
  try {
    const result = await api(endpoint(), {
      method: "POST",
      body: JSON.stringify(body),
    });
    delete drafts[key(current)];
    persist();
    rows.set(key(result.item), result.item);
    open(result.item, false);
    editorStatus(
      "已儲存；閱讀、練習、批次查題及投稿檢查將在下次同步時讀取新內容。",
    );
  } catch (e) {
    editorStatus(e.message + " 編輯內容與本機草稿仍保留。");
  } finally {
    busy = false;
    $("[data-edit]")
      ?.querySelectorAll("button,input,select,textarea")
      .forEach((e) => (e.disabled = false));
  }
}
