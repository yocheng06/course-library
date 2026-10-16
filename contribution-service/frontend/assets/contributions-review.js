import { COURSE_UNITS, TYPES, normalizeType, normalizeBatch } from "./contribution-model.js?v=image-question-types-20261016";
import {
  esc,
  api,
  message,
  questionPreview,
  statusLabel,
} from "./contributions-ui.js?v=image-question-types-20261016";
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
  return `<details class="panel review-entry" data-id="${entry.id}"><summary>${esc(p.title)} · ${esc(COURSE_UNITS[p.course].name)} · ${esc(COURSE_UNITS[p.course].units[p.unit])} · ${p.questions.length} 題</summary><p class="batch-meta">投稿編號：${entry.id}\n投稿者：${esc(p.name || "未提供稱呼")}\n收到時間：${esc(new Date(entry.createdAt).toLocaleString("zh-TW"))}\n來源：${esc(p.source || "未提供")}\n狀態：${statusLabel[entry.status]}</p>${
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
          )}</select></label><label>單元<select data-batch="unit">${unitOptions(p.course, p.unit)}</select></label></div><label>題庫名稱<input data-batch="title" maxlength="100" value="${esc(p.title)}"></label><label>來源說明<textarea data-batch="source" rows="2" maxlength="2000">${esc(p.source)}</textarea></label><div class="questions-container">${p.questions.map(fields).join("")}</div><div class="decision"><label>給投稿者的說明（退回時必填）<textarea class="review-note" rows="2" maxlength="2000" placeholder="說明需要調整的地方"></textarea></label><p class="muted">核准會發布目前保留的題目與修改內容。重複題會由系統攔下。</p><div class="actions"><button class="button" type="button" data-action="approve">核准並加入題庫</button><button class="button secondary" type="button" data-action="reject">退回投稿</button></div></div>`
      : p.questions
          .map((q, i) => questionPreview(q, i) + "</article>")
          .join("") + (entry.note ? `<p>站主說明：${esc(entry.note)}</p>` : "")
  }</details>`;
}
async function load(append = false) {
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
    }
    cursor = result.nextCursor;
    $("loadMore").hidden = !cursor;
    $("reviewCount").textContent = entries.size
      ? `已載入 ${entries.size} 份${$("statusFilter").selectedOptions[0].textContent}投稿。`
      : "目前沒有" +
        $("statusFilter").selectedOptions[0].textContent +
        "的投稿。";
  } catch (error) {
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
    if (!session.isReviewer) return;
    $("loginPanel").hidden = true;
    $("reviewWorkspace").hidden = false;
    await load();
  } catch (error) {
    if (error.status === 401) return;
    message(error.message, true);
    $("loginHint").textContent = "請確認登入的是管理者帳號。";
    $("signIn").textContent = "切換帳號後重新登入";
    $("signIn").href = "/signout-with-chatgpt?return_to=%2Freview";
  }
}
$("statusFilter").addEventListener("change", () => load());
$("refresh").addEventListener("click", () => load());
$("loadMore").addEventListener("click", () => load(true));
$("reviewList").addEventListener("change", (event) => {
  if (event.target.dataset.batch === "course") {
    const card = event.target.closest(".review-entry");
    card.querySelector('[data-batch="unit"]').innerHTML = unitOptions(
      event.target.value,
      "",
    );
  }
});
$("reviewList").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const card = button.closest(".review-entry"),
    entry = entries.get(card.dataset.id);
  if (button.dataset.removeQuestion !== undefined) {
    button.closest(".review-question").remove();
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
      payload = normalizeBatch(batch);
    }
    card
      .querySelectorAll("button,input,textarea,select")
      .forEach((node) => (node.disabled = true));
    message(action === "approve" ? "正在核准並發布題目…" : "正在退回投稿…");
    await api("/api/review/" + entry.id, {
      method: "POST",
      body: JSON.stringify({ action, revision: entry.revision, payload, note }),
    });
    message(
      action === "approve" ? "已核准，題目已加入正式題庫。" : "已退回投稿。",
    );
    await load();
  } catch (error) {
    card
      .querySelectorAll("button,input,textarea,select")
      .forEach((node) => (node.disabled = false));
    message(error.message, true);
  }
});
