// A separate local queue: unanswered questions never enter a submission payload.
export const INBOX_KEY = "course-library.submission-inbox.v1";
const LIMIT = 200;
const courses = new Set(["os", "algorithms"]);
const types = new Set(["單選題", "多選題", "填空題", "圖片題"]);
export function readInbox(storage) {
  const raw = storage.getItem(INBOX_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > LIMIT)
      throw new Error();
    const ids = new Set();
    for (const q of value.items) {
      if (!q || !courses.has(q.course) || !types.has(q.type) ||
          typeof q.id !== "string" || ids.has(q.id) ||
          !["unit", "number", "category", "stem", "optionsText", "answer", "explanation"].every(k => typeof q[k] === "string") ||
          q.stem.length > 10000 || q.optionsText.length > 16000 ||
          q.answer.length > 4000 || q.explanation.length > 16000 ||
          q.category.length > 100 || q.unit.length > 30 || q.number.length > 100)
        throw new Error();
      ids.add(q.id);
    }
    return value.items;
  } catch {
    throw new Error("待補草稿無法讀取，原資料仍保留。請先下載備份，不會覆蓋原草稿。");
  }
}
export function writeInbox(storage, items) {
  if (items.length > LIMIT) throw new Error("待補草稿最多 200 題，請先完成部分題目。");
  const raw = JSON.stringify({ version: 1, items });
  readInbox({ getItem: () => raw });
  storage.setItem(INBOX_KEY, raw);
}
function identity(q) {
  return JSON.stringify([q.course, q.stem.normalize("NFKC").replace(/\s+/g, ""),
    q.optionsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean).sort()]);
}
export function stageUnmatched(results, scope, storage) {
  if (!courses.has(scope.course)) throw new Error("請先選擇科目。");
  const items = readInbox(storage), seen = new Set(items.map(identity));
  let added = 0;
  for (const row of results.filter(r => r.status === "unmatched")) {
    const q = row.question;
    if (q.stem.length > 10000 || q.options.map(o => o.text).join("\n").length > 16000)
      throw new Error(`原第 ${q.number} 題超過投稿欄位長度，請先縮短或分開處理；本次未轉入任何題目。`);
    const item = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${added}`,
      course: scope.course, unit: scope.unit === "all" ? "" : scope.unit,
      number: String(q.number), category: "", stem: q.stem,
      type: q.options.length ? (/多選|複選/.test(q.type) ? "多選題" : "單選題") : "填空題",
      optionsText: q.options.map(o => o.text).join("\n"),
      answer: "", explanation: "",
    };
    const key = identity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    added++;
  }
  if (!results.some(r => r.status === "unmatched")) throw new Error("沒有可轉入的未收錄題目。");
  writeInbox(storage, items);
  return { added, total: items.length };
}
