import "./choice-answers.js?v=global-dedup-20261016";
export const COURSE_UNITS = {
  os: {
    name: "作業系統",
    units: {
      basics: "L2 · 作業系統基礎",
      architecture: "L3 · 作業系統架構",
      process: "L4 · 程序與 IPC",
      threads: "L5 · 執行緒與多執行緒",
      scheduling: "L6 · CPU 排程",
      synchronization: "L7 · 程序同步",
      deadlocks: "L8 · 死結",
    },
  },
  algorithms: {
    name: "演算法",
    units: {
      L2: "L2 · 基礎與漸進分析",
      L3: "L3 · 遞迴關係式與分治分析",
      L4: "L4 · 堆積、堆積排序與優先佇列",
      L5: "L5 · 快速排序",
      L6: "L6 · 排序演算法",
    },
  },
};
export const TYPES = ["單選題", "多選題", "填空題", "圖片題"];
export function normalizeUnit(course, value) {
  if (!Object.hasOwn(COURSE_UNITS, course)) throw new Error('請選擇網站現有科目。');
  if (typeof value !== 'string') throw new Error('請選擇單元，或填寫 1–99 的新單元編號。');
  const units = COURSE_UNITS[course].units;
  if (Object.hasOwn(units, value)) return value;
  const match = /^L?0*([1-9]\d?)$/i.exec(value.trim());
  if (!match) throw new Error('請選擇單元，或填寫 1–99 的新單元編號，例如 L7。');
  const numbered = 'L' + Number(match[1]);
  return Object.keys(units).find(id => units[id].startsWith(numbered + ' · ')) || numbered;
}
export function unitLabel(course, unit, title = '') {
  const id = normalizeUnit(course, unit);
  return COURSE_UNITS[course].units[id] || `${id} · ${String(title || '第 ' + id.slice(1) + ' 單元').slice(0,60)}`;
}
export function normalizeType(type, images = []) {
  if (images.length || type === "圖片題") return "圖片題";
  if (type === "單選題") return "單選題";
  if (type === "多選題" || type === "複選題") return "多選題";
  return "填空題";
}
const cleanKey = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "");
const stemKey = (value) =>
  cleanKey(String(value ?? "").replace(/\[_{2,}\d*_{0,}\]|_{2,}/g, "___"));
function imageKey(question) {
  return (question.imageKeys || question.images || [])
    .map((image) => (typeof image === "string" ? image : image.src))
    .filter(Boolean);
}
export function questionKey(course, unit, question) {
  return JSON.stringify([
    course,
    unit,
    stemKey(question.stem ?? question.q),
    (question.options ?? question.opts ?? [])
      .map((option) =>
        cleanKey(
          String(option)
            .normalize("NFKC")
            .replace(/^[A-H][.、．:：]\s*/i, ""),
        ),
      )
      .sort(),
    imageKey(question),
  ]);
}
export function similarityKey(course, unit, question) {
  const parts = JSON.parse(questionKey(course, unit, question));
  // A punctuation-only difference prompts review; mathematical operators and case remain intact.
  parts[2] = parts[2].replace(/[?？。]+$/, "");
  return JSON.stringify(parts);
}
export function possibleMatches(course, unit, questions, known) {
  const matches = [],
    seen = new Map();
  for (const other of known) {
    if (other.course !== course || other.unit !== unit) continue;
    const key = similarityKey(course, unit, other);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(other);
  }
  questions.forEach((q, i) => {
    const key = similarityKey(course, unit, q),
      exact = questionKey(course, unit, q);
    const other = (seen.get(key) || []).find(
      (o) => questionKey(course, unit, o) !== exact,
    );
    if (other)
      matches.push({
        index: i + 1,
        stem: q.stem.slice(0, 200),
        reference: other.id || "同批題目",
        reason: "題幹僅有標點差異，請核對是否同一題",
      });
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push({ ...q, course, unit, id: "同批第 " + (i + 1) + " 題" });
  });
  return matches;
}
export function uniqueQuestions(
  course,
  unit,
  questions,
  onDuplicate = () => {},
) {
  const keys = new Set();
  return questions.filter((question, index) => {
    const key = questionKey(course, unit, question);
    if (keys.has(key)) {
      onDuplicate({
        index: index + 1,
        stem: question.stem.slice(0, 200),
        reason: "batch",
      });
      return false;
    }
    keys.add(key);
    return true;
  });
}
function text(value, label, max, required = false) {
  if (typeof value !== "string" && value != null)
    throw new Error(`${label}必須是文字。`);
  const result = String(value ?? "").trim();
  if (required && !result) throw new Error(`請填寫${label}。`);
  if (result.length > max) throw new Error(`${label}超過 ${max} 字。`);
  return result;
}
export function normalizeBatch(
  input,
  { allowImages = true, allowMissingAnswers = false, onDuplicate = () => {} } = {},
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("投稿資料格式不正確。");
  const course = text(input.course, "科目", 30, true),
    unit = normalizeUnit(course, text(input.unit, "單元", 30, true));
  const unitTitle = text(input.unitTitle, '單元名稱', 60) || `第 ${unit.slice(1)} 單元`;
  if (
    !Array.isArray(input.questions) ||
    !input.questions.length ||
    input.questions.length > 200
  )
    throw new Error("每次請投稿 1–200 題。");
  const questions = input.questions.map((q, index) => {
    if (!q || typeof q !== "object" || Array.isArray(q))
      throw new Error(`第 ${index + 1} 題格式不正確。`);
    const options = q.options ?? q.opts ?? [];
    if (!Array.isArray(options) || options.length > 8)
      throw new Error(`第 ${index + 1} 題最多 8 個選項。`);
    const type = normalizeType(text(q.type, "題型", 20, true), q.images ?? []);
    const item = {
      category: text(q.category, "分類", 100, true),
      type,
      stem: text(q.stem ?? q.q, "題目", 10000, true),
      options: options.map((o) => text(o, "選項", 2000, true)),
      answer: text(q.answer ?? q.a, "答案", 4000, !allowMissingAnswers),
      explanation: text(q.explanation ?? q.ex, "解析", 16000),
      images: [],
    };
    if (["單選題", "多選題"].includes(type) && item.options.length < 2)
      throw new Error(`第 ${index + 1} 題請提供至少兩個選項。`);
    if (type === "填空題" && item.options.length)
      throw new Error(`第 ${index + 1} 題為文字題，請清空選項。`);
    if (type === "圖片題" && item.options.length === 1)
      throw new Error(`第 ${index + 1} 題如需選項，請提供至少兩個選項。`);
    if (item.options.length && item.answer) {
      const choiceKey = globalThis.courseChoiceAnswers.expectedChoiceKey(
        item.answer,
        item.options,
      );
      if (!choiceKey)
        throw new Error(
          `第 ${index + 1} 題的答案無法對應選項，請使用 A 或 A、B 等選項代號。`,
        );
      if (type === "單選題" && choiceKey.length !== 1)
        throw new Error(`第 ${index + 1} 題為單選題，只能指定一個正確選項。`);
      item.choiceKey = choiceKey;
    }
    const images = q.images ?? [];
    if (type === "圖片題" && !images.length)
      throw new Error(`第 ${index + 1} 題為圖片題，請附至少一張題圖。`);
    if (!Array.isArray(images) || images.length > 2)
      throw new Error(`第 ${index + 1} 題最多附兩張題圖。`);
    item.images = images.map((value) => {
      const image = text(value, "題圖", 2000000, true);
      if (!allowImages) throw new Error("此匯入格式不接受題圖。");
      if (
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) &&
        !/^https:\/\//.test(image)
      )
        throw new Error("題圖須為 PNG、JPEG、WebP 或 HTTPS 圖片網址。");
      if (image.startsWith("https://")) {
        const url = new URL(image);
        if (url.username || url.password || url.href.length > 2000)
          throw new Error("題圖網址格式不正確。");
      }
      return image;
    });
    return item;
  });
  return {
    course,
    unit,
    ...(!Object.hasOwn(COURSE_UNITS[course].units, unit) ? {unitTitle} : {}),
    title: text(input.title, "題庫名稱", 100, true),
    name: text(input.name, "投稿者稱呼", 60),
    source: text(input.source, "來源說明", 2000),
    questions: uniqueQuestions(course, unit, questions, onDuplicate),
  };
}
