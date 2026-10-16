import { normalizeType } from "./contribution-model.js?v=image-question-types-20261016";

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
export const statusLabel = {
  pending: "等待站主審核",
  approved: "已核准，題目已加入題庫",
  rejected: "已退回",
};
export function questionPreview(q, index) {
  return `<article class="draft-card"><div class="draft-meta">第 ${index + 1} 題 · ${esc(q.category)} · ${esc(normalizeType(q.type, q.images))}</div><h3>${esc(q.stem)}</h3>${q.images.map((src) => `<img src="${esc(src)}" alt="第 ${index + 1} 題的題圖" loading="lazy">`).join("")}${q.options.length ? "<ol>" + q.options.map((option) => `<li>${esc(option)}</li>`).join("") + "</ol>" : ""}<p><strong>答案：</strong>${esc(q.answer)}</p>${q.explanation ? `<p><strong>解析：</strong>${esc(q.explanation)}</p>` : '<p class="muted">尚未提供解析，交由站主審核補充。</p>'}`;
}
