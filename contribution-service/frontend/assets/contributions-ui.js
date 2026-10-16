import { normalizeType } from "./contribution-model.js?v=os-l7-dedup-20261016";

export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function api(path, options = {}) {
  const response = await fetch(window.courseContributions.apiOrigin + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("服務暫時無法使用，請稍後再試。");
  }
  if (!response.ok) {
    const error = new Error(body.error || "操作未完成，請再試一次。");
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}
export function message(text, error = false) {
  const node = document.getElementById("message");
  node.textContent = text;
  node.classList.toggle("error", error);
  if (text) {
    node.scrollIntoView({ block: "center", behavior: "instant" });
    node.focus({ preventScroll: true });
  }
}
export function showDuplicates(result) {
  const panel = document.getElementById("duplicateReport");
  if (!panel) return;
  panel.hidden = !result.skippedCount;
  document.getElementById("duplicateSummary").textContent =
    `共檢查 ${result.receivedCount} 題，保留 ${result.acceptedCount} 題，略過 ${result.skippedCount} 題重複題目。`;
  const list = document.getElementById("duplicateList");
  list.replaceChildren();
  const reasons = {
    batch: "同一批題目重複，保留第一筆",
    draft: "已在投稿清單中",
    published: "正式題庫已收錄",
  };
  for (const q of result.skipped || []) {
    const item = document.createElement("li");
    item.textContent = `${q.index ? `第 ${q.index} 題：` : ""}${q.stem}（${reasons[q.reason] || "重複題目"}）`;
    list.append(item);
  }
}
export const statusLabel = {
  pending: "等待站主審核",
  approved: "已核准，題目已加入題庫",
  rejected: "已退回",
};
export function questionPreview(q, index) {
  return `<article class="draft-card"><div class="draft-meta">第 ${index + 1} 題 · ${esc(q.category)} · ${esc(normalizeType(q.type, q.images))}</div><h3>${esc(q.stem)}</h3>${q.images.map((src) => `<img src="${esc(src)}" alt="第 ${index + 1} 題的題圖" loading="lazy">`).join("")}${q.options.length ? "<ol>" + q.options.map((option) => `<li>${esc(option)}</li>`).join("") + "</ol>" : ""}<p><strong>答案：</strong>${esc(q.answer)}</p>${q.explanation ? `<p><strong>解析：</strong>${esc(q.explanation)}</p>` : '<p class="muted">尚未提供解析，交由站主審核補充。</p>'}`;
}

export function showSimilar(container, items) {
  container.hidden = !items?.length;
  if (!items?.length) {
    container.replaceChildren();
    return;
  }
  container.innerHTML = `<h3>請確認疑似重複題</h3><p>以下題幹與選項內容相同，但次序或代號不同。系統不會自動刪除，請確認是否需要保留。</p><ul>${items.map((q) => `<li>第 ${Number(q.index)} 題：${esc(q.stem)}（${esc(q.reason)}；對照：${esc(q.reference)}）</li>`).join("")}</ul><label class="consent"><input type="checkbox" class="similar-consent">我已確認，這些題目仍需要保留。</label>`;
}
export function downloadJSON(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    message("已複製投稿編號。");
  } catch {
    const input = document.getElementById("statusId");
    if (input) {
      input.value = value;
      input.focus();
      input.select();
    }
    message("請複製已選取的投稿編號。");
  }
}
