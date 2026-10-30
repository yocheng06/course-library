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
  tab.textContent = "內建題目管理";
  tab.setAttribute("aria-pressed", "false");
  document.getElementById("managementTabs").append(tab);
  panel = document.createElement("section");
  panel.hidden = true;
  panel.id = "builtinWorkspace";
  panel.innerHTML = `<div class="panel"><h2>內建題目管理</h2><p>儲存後會同步到閱讀、練習、批次查題及投稿重複檢查。每次儲存都保留修改歷史。</p><form data-search><div class="field-grid"><label>科目<select name="course"><option value="os">作業系統</option><option value="algorithms">演算法</option></select></label><label>單元<select name="unit"></select></label><label>範圍<select name="state"><option value="all">全部內建題</option><option value="modified">已修改</option></select></label><label>搜尋題號或文字<input name="q" maxlength="100"></label></div><div class="actions"><button class="button" type="submit">搜尋／重新載入</button><button type="button" class="text-button" data-download>下載內建題編輯草稿</button></div></form><p data-status role="status" aria-live="polite"></p><div data-list></div><button type="button" class="button secondary" data-more hidden>載入更多</button></div><div data-editor></div>`;
  document.getElementById("managementWorkspace").after(panel);
  tab.addEventListener("click", () => {
    if (!allowed) return;
    show();
    if (!rows.size) load();
  });
  for (const id of ["showReviews", "showPublished"])
    document.getElementById(id).addEventListener("click", () => {
      panel.hidden = true;
      tab.setAttribute("aria-pressed", "false");
    });
  $("[data-search]").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!busy) load();
  });
  $("[name=course]").addEventListener("change", () => {
    units();
    if (!busy) load();
  });
  $("[data-more]").addEventListener("click", () => load(true));
  $("[data-download]").addEventListener("click", () =>
    downloadJSON(drafts, "內建題編輯草稿.json"),
  );
  $("[data-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-open]");
    if (button && !busy) open(rows.get(button.dataset.open));
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
      try {
        const result = await api(endpoint() + "/history");
        $("[data-history]").innerHTML = result.items.length
          ? result.items
              .map(
                (r, i) =>
                  `<details><summary>版本 ${r.revision} · ${esc(r.note)} · ${esc(new Date(r.createdAt).toLocaleString("zh-TW"))}</summary><h4>修改前</h4>${questionPreview(r.before, i)}</article><h4>修改後</h4>${questionPreview(r.after, i)}</article><button type="button" class="button secondary" data-action="restore" data-index="${i}">套用此版本到編輯器</button></details>`,
              )
              .join("")
          : "尚無修改歷史。";
        panel.historyRows = result.items;
      } catch (e) {
        editorStatus(e.message);
      }
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
  document.getElementById("reviewWorkspace").hidden = true;
  document.getElementById("managementWorkspace").hidden = true;
  tab.setAttribute("aria-pressed", "true");
  for (const id of ["showReviews", "showPublished"])
    document.getElementById(id).setAttribute("aria-pressed", "false");
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
        `<p><button type="button" class="text-button" data-open="${esc(key(row))}">${esc(row.id)} · ${esc(row.question.stem.slice(0, 100))}</button> ${row.modified ? "已修改" : ""} · 版本 ${row.revision}</p>`,
      );
    }
    cursor = result.nextCursor;
    $("[data-more]").hidden = !cursor;
    status(`符合 ${result.total} 題，已載入 ${rows.size} 題。`);
  } catch (e) {
    if (seq === sequence) status(e.message);
  }
}
function endpoint() {
  return (
    "/api/manage/builtin-questions/" +
    current.course +
    "/" +
    encodeURIComponent(current.id)
  );
}
function editorStatus(text) {
  $("[data-editor-status]").textContent = text;
}
function open(row, restore = true) {
  current = row;
  panel.historyRows = [];
  $("[data-editor]").innerHTML =
    `<form class="panel" data-edit><h2>${esc(row.id)} · 編輯題目</h2><p>版本 ${row.revision}${row.sourceChanged ? " · 內建原稿已更新，請核對目前內容。" : ""}</p><div data-fields></div><label>本次修改說明（必填）<textarea name="editNote" required maxlength="2000" rows="2"></textarea></label><div class="actions"><button type="submit" class="button">儲存並同步題庫</button><button type="button" class="button secondary" data-action="history">修改歷史</button><button type="button" class="text-button" data-action="reset">還原內建內容</button><button type="button" class="text-button" data-action="discard">捨棄本機草稿</button></div><p role="status" aria-live="polite" data-editor-status></p><div data-history></div></form>`;
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
