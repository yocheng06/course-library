export const COURSE_UNITS = {
  os: {
    name: "作業系統",
    units: {
      basics: "L2 · 作業系統基礎",
      architecture: "L3 · 作業系統架構",
      process: "L4 · 程序與 IPC",
      threads: "L5 · 執行緒與多執行緒",
      scheduling: "L6 · CPU 排程",
    },
  },
  algorithms: {
    name: "演算法",
    units: {
      L2: "L2 · 基礎與漸進分析",
      L3: "L3 · 遞迴關係式與分治分析",
      L4: "L4 · 堆積、堆積排序與優先佇列",
    },
  },
};
export const TYPES = ["單選題", "多選題", "填空題"];
export function normalizeType(type) {
  if (type === "單選題") return "單選題";
  if (type === "多選題" || type === "複選題") return "多選題";
  return "填空題";
}
export function questionKey(course, unit, question) {
  const clean = (value) =>
    String(value).normalize("NFKC").replace(/\s+/g, "").trim();
  return JSON.stringify([
    course,
    unit,
    clean(question.stem),
    question.options.map(clean).sort(),
  ]);
}
function text(value, label, max, required = false) {
  if (typeof value !== "string" && value != null)
    throw new Error(`${label}必須是文字。`);
  const result = String(value ?? "").trim();
  if (required && !result) throw new Error(`請填寫${label}。`);
  if (result.length > max) throw new Error(`${label}超過 ${max} 字。`);
  return result;
}
export function normalizeBatch(input, { allowImages = true } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("投稿資料格式不正確。");
  const course = text(input.course, "科目", 30, true),
    unit = text(input.unit, "單元", 30, true);
  if (!COURSE_UNITS[course]?.units[unit])
    throw new Error("請選擇網站現有的科目與單元。");
  if (
    !Array.isArray(input.questions) ||
    !input.questions.length ||
    input.questions.length > 200
  )
    throw new Error("每次請投稿 1–200 題。");
  const keys = new Set();
  const questions = input.questions.map((q, index) => {
    if (!q || typeof q !== "object" || Array.isArray(q))
      throw new Error(`第 ${index + 1} 題格式不正確。`);
    const options = q.options ?? q.opts ?? [];
    if (!Array.isArray(options) || options.length > 8)
      throw new Error(`第 ${index + 1} 題最多 8 個選項。`);
    const type = normalizeType(text(q.type, "題型", 20, true));
    const item = {
      category: text(q.category, "分類", 100, true),
      type,
      stem: text(q.stem ?? q.q, "題目", 10000, true),
      options: options.map((o) => text(o, "選項", 2000, true)),
      answer: text(q.answer ?? q.a, "答案", 4000, true),
      explanation: text(q.explanation ?? q.ex, "解析", 16000),
      images: [],
    };
    if (["單選題", "多選題"].includes(type) && item.options.length < 2)
      throw new Error(`第 ${index + 1} 題請提供至少兩個選項。`);
    if (!["單選題", "多選題"].includes(type) && item.options.length)
      throw new Error(`第 ${index + 1} 題為文字題，請清空選項。`);
    const images = q.images ?? [];
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
    const key = questionKey(course, unit, item);
    if (keys.has(key))
      throw new Error(`第 ${index + 1} 題與本次投稿的其他題目重複。`);
    keys.add(key);
    return item;
  });
  return {
    course,
    unit,
    title: text(input.title, "題庫名稱", 100, true),
    name: text(input.name, "投稿者稱呼", 60),
    source: text(input.source, "來源說明", 2000),
    questions,
  };
}
