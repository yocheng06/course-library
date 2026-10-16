import {
  COURSE_UNITS,
  normalizeType,
  normalizeBatch,
  uniqueQuestions,
} from "./contribution-model.js?v=os-l7-dedup-20261016";
import {
  esc,
  api,
  message,
  questionPreview,
  statusLabel,
  showDuplicates,
  showSimilar,
  downloadJSON,
  copyText,
} from "./contributions-ui.js?v=os-l7-dedup-20261016";
const $ = (id) => document.getElementById(id),
  form = $("questionForm"),
  key = "course-library-submission-draft-v1";
let questions = [],
  images = [],
  editIndex = -1,
  imageReadPending = false,
  storageWarning = false,
  submitPending = false;
$("course").innerHTML = Object.entries(COURSE_UNITS)
  .map(([id, course]) => `<option value="${id}">${course.name}</option>`)
  .join("");
function units() {
  const previous = $("unit").value;
  $("unit").innerHTML = Object.entries(COURSE_UNITS[$("course").value].units)
    .map(([id, name]) => `<option value="${id}">${name}</option>`)
    .join("");
  if (COURSE_UNITS[$("course").value].units[previous])
    $("unit").value = previous;
}
function metadata() {
  return {
    course: $("course").value,
    unit: $("unit").value,
    title: $("batchTitle").value,
    name: $("submitter").value,
    source: $("source").value,
  };
}
function save() {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ...metadata(),
        questions,
        editor: Object.fromEntries(new FormData(form)),
        images,
        editIndex,
      }),
    );
  } catch {
    if (!storageWarning) {
      storageWarning = true;
      message("此裝置無法自動保存草稿，請使用「下載草稿」備份。", true);
    }
  }
}
function ready() {
  $("submitBatch").disabled =
    !questions.length ||
    !$("consent").checked ||
    editIndex !== -1 ||
    imageReadPending ||
    submitPending;
}
function render() {
  $("draftCount").textContent = questions.length + " 題";
  $("emptyDraft").hidden = questions.length > 0;
  $("draftList").innerHTML = questions
    .map(
      (q, i) =>
        questionPreview(q, i) +
        `<div class="draft-actions"><button class="text-button" type="button" data-edit="${i}">編輯第 ${i + 1} 題</button><button class="text-button" type="button" data-remove="${i}">移除第 ${i + 1} 題</button></div></article>`,
    )
    .join("");
  ready();
}
function renderImages() {
  $("imagePreviews").innerHTML = images
    .map(
      (src, i) =>
        `<div class="image-preview"><img src="${esc(src)}" alt="已選的題圖 ${i + 1}"><button class="text-button" type="button" data-remove-image="${i}">移除題圖 ${i + 1}</button></div>`,
    )
    .join("");
}
function typeChanged() {
  const choice = /選題/.test(form.elements.type.value);
  $("optionsField").hidden = !choice && form.elements.type.value !== "圖片題";
  form.elements.options.required = choice;
}
function clearEditor() {
  form.reset();
  images = [];
  editIndex = -1;
  $("editorHeading").textContent = "新增一題";
  $("addQuestion").textContent = "加入投稿清單";
  $("cancelEdit").hidden = true;
  typeChanged();
  renderImages();
  ready();
  save();
}
function download(value, name) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const initialCourse = new URL(location.href).searchParams.get("course");
if (COURSE_UNITS[initialCourse]) $("course").value = initialCourse;
units();
try {
  const draft = JSON.parse(localStorage.getItem(key) || "null");
  if (draft) {
    if (COURSE_UNITS[draft.course]) {
      $("course").value = draft.course;
      units();
      if (COURSE_UNITS[draft.course].units[draft.unit])
        $("unit").value = draft.unit;
    }
    $("batchTitle").value = draft.title || "";
    $("submitter").value = draft.name || "";
    $("source").value = draft.source || "";
    questions = draft.questions?.length
      ? normalizeBatch({
          ...metadata(),
          title: draft.title || "草稿",
          questions: draft.questions,
        }).questions
      : [];
    for (const [name, value] of Object.entries(draft.editor || {})) {
      if (form.elements[name] && typeof value === "string")
        form.elements[name].value =
          name === "type" ? normalizeType(value) : value;
    }
    images = draft.images || [];
    if (images.length) form.elements.type.value = "圖片題";
    editIndex =
      Number.isInteger(draft.editIndex) &&
      draft.editIndex >= 0 &&
      draft.editIndex < questions.length
        ? draft.editIndex
        : -1;
    if (editIndex !== -1) {
      $("editorHeading").textContent = `編輯第 ${editIndex + 1} 題`;
      $("addQuestion").textContent = "儲存題目修改";
      $("cancelEdit").hidden = false;
    }
  }
} catch {
  message("未能讀取先前草稿，請重新匯入已下載的備份。", true);
}
typeChanged();
render();
renderImages();
$("course").addEventListener("change", () => {
  units();
  save();
});
["unit", "batchTitle", "submitter", "source"].forEach((id) =>
  $(id).addEventListener("input", save),
);
form.addEventListener("input", save);
form.elements.type.addEventListener("change", typeChanged);
$("consent").addEventListener("change", ready);
$("cancelEdit").addEventListener("click", clearEditor);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (imageReadPending) return;
  try {
    const data = Object.fromEntries(new FormData(form));
    data.options = /選題|圖片題/.test(data.type)
      ? data.options
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    data.images = images;
    const question = normalizeBatch({
        ...metadata(),
        title: $("batchTitle").value || "草稿",
        questions: [data],
      }).questions[0],
      next = questions.slice();
    if (editIndex === -1) next.push(question);
    else next[editIndex] = question;
    const skipped = [];
    questions = normalizeBatch({
      ...metadata(),
      title: $("batchTitle").value || "草稿",
      questions: uniqueQuestions(
        $("course").value,
        $("unit").value,
        next,
        (q) => skipped.push(q),
      ),
    }).questions;
    showDuplicates({
      receivedCount: next.length,
      acceptedCount: questions.length,
      skippedCount: skipped.length,
      skipped,
    });
    clearEditor();
    render();
    save();
    message(
      skipped.length
        ? "已自動略過重複題，保留投稿清單中的第一筆。"
        : "題目已加入投稿清單，可繼續新增或送出審核。",
    );
  } catch (error) {
    message(error.message, true);
  }
});
$("draftList").addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.remove !== undefined) {
    const index = Number(b.dataset.remove);
    questions.splice(index, 1);
    if (editIndex === index) clearEditor();
    else if (editIndex > index) {
      editIndex--;
      $("editorHeading").textContent = `編輯第 ${editIndex + 1} 題`;
    }
    render();
    save();
  }
  if (b.dataset.edit !== undefined) {
    editIndex = Number(b.dataset.edit);
    const q = questions[editIndex];
    for (const name of ["category", "type", "stem", "answer", "explanation"])
      form.elements[name].value = q[name];
    form.elements.options.value = q.options.join("\n");
    images = q.images.slice();
    $("questionImages").value = "";
    $("editorHeading").textContent = `編輯第 ${editIndex + 1} 題`;
    $("addQuestion").textContent = "儲存題目修改";
    $("cancelEdit").hidden = false;
    typeChanged();
    renderImages();
    ready();
    form.scrollIntoView({ block: "start" });
    form.elements.stem.focus({ preventScroll: true });
    save();
  }
});
$("imagePreviews").addEventListener("click", (event) => {
  const b = event.target.closest("[data-remove-image]");
  if (b) {
    images.splice(Number(b.dataset.removeImage), 1);
    renderImages();
    save();
  }
});
$("questionImages").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (files.length + images.length > 2) {
    message("每題最多兩張題圖。", true);
    event.target.value = "";
    return;
  }
  imageReadPending = true;
  $("addQuestion").disabled = true;
  ready();
  try {
    const next = await Promise.all(
      files.map((file) => {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 1024 * 1024
        )
          throw new Error("每張題圖限 PNG、JPEG、WebP，且不超過 1 MB。");
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("題圖讀取失敗。"));
          reader.readAsDataURL(file);
        });
      }),
    );
    images.push(...next);
    if (images.length) form.elements.type.value = "圖片題";
    typeChanged();
    renderImages();
    save();
  } catch (error) {
    message(error.message, true);
  } finally {
    imageReadPending = false;
    $("addQuestion").disabled = false;
    event.target.value = "";
    ready();
  }
});
function parseImport(raw, name) {
  if (/\.json$/i.test(name)) return JSON.parse(raw);
  const doc = new DOMParser().parseFromString(raw, "text/html"),
    data = doc.querySelector("script#course-data");
  if (data) return JSON.parse(data.textContent);
  for (const script of doc.querySelectorAll("script")) {
    const source = script.textContent,
      match =
        /\b(?:const|let|var)\s+(?:UNITS|COURSES|questions|questionBank|quizData)\s*=\s*/.exec(
          source,
        );
    if (!match) continue;
    const start = source.indexOf("[", match.index + match[0].length);
    if (start < 0) continue;
    let depth = 0,
      quoted = false,
      escaped = false;
    for (let i = start; i < source.length; i++) {
      const char = source[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "[") depth++;
      else if (char === "]" && --depth === 0)
        return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error(
    "這份 HTML 沒有可匯入的 JSON 題目資料，請使用匯入範例或逐題填寫。",
  );
}
function importedQuestions(data) {
  if (Array.isArray(data)) {
    if (data[0]?.questions) {
      const unit = data.find((item) => item.id === $("unit").value);
      if (!unit) throw new Error("匯入檔案沒有目前所選單元的題目。");
      return unit.questions;
    }
    return data;
  }
  return data.questions;
}
$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error("匯入檔案最多 8 MB。");
    const data = parseImport(await file.text(), file.name);
    if (
      questions.length &&
      !Array.isArray(data) &&
      data.course &&
      data.unit &&
      (data.course !== $("course").value || data.unit !== $("unit").value)
    )
      throw new Error("請把不同科目或單元的題目分開投稿。");
    if (!Array.isArray(data) && COURSE_UNITS[data.course]?.units[data.unit]) {
      $("course").value = data.course;
      units();
      $("unit").value = data.unit;
    }
    const skipped = [];
    const imported = importedQuestions(data);
    const candidate = normalizeBatch(
      {
        ...metadata(),
        title:
          data.title ||
          $("batchTitle").value ||
          file.name.replace(/\.(json|html?)$/i, ""),
        name: data.name ?? $("submitter").value,
        source: data.source ?? $("source").value,
        questions: imported?.map((q) => ({
          ...q,
          type: normalizeType(
            (q.options ?? q.opts)?.length
              ? q.type || "單選題"
              : q.type === "圖片題"
                ? "圖片題"
                : "填空題",
            q.images || [],
          ),
          images: (q.images || []).map((image) =>
            typeof image === "string" ? image : image.src,
          ),
        })),
      },
      { onDuplicate: (q) => skipped.push(q) },
    );
    const previousCount = questions.length;
    const merged = uniqueQuestions(
      candidate.course,
      candidate.unit,
      [...questions, ...candidate.questions],
      (q) => skipped.push({ ...q, index: null, reason: "draft" }),
    );
    questions = normalizeBatch({ ...candidate, questions: merged }).questions;
    const added = questions.length - previousCount;
    showDuplicates({
      receivedCount: imported.length,
      acceptedCount: added,
      skippedCount: skipped.length,
      skipped,
    });
    $("batchTitle").value = candidate.title;
    $("submitter").value = candidate.name;
    $("source").value = candidate.source;
    render();
    save();
    message(
      `已新增 ${added} 題至投稿清單${skipped.length ? `，自動略過 ${skipped.length} 題重複題目` : ""}。請預覽內容再送出。`,
    );
  } catch (error) {
    message("無法匯入：" + error.message, true);
  } finally {
    event.target.value = "";
  }
});
$("downloadExample").addEventListener("click", () =>
  download(
    {
      ...metadata(),
      title: "課堂補充題",
      questions: [
        {
          category: "課程觀念",
          type: "單選題",
          stem: "請在這裡寫出題目。",
          options: ["A. 第一個選項", "B. 第二個選項"],
          answer: "A",
          explanation: "說明為什麼選 A。",
          images: [],
        },
      ],
    },
    "題庫投稿範例.json",
  ),
);
$("exportDraft").addEventListener("click", () =>
  download({ ...metadata(), questions }, "題庫投稿草稿.json"),
);
$("submitBatch").addEventListener("click", async () => {
  if (submitPending || editIndex !== -1) return;
  try {
    const payload = normalizeBatch({ ...metadata(), questions });
    if (!form.elements.stem.value.trim() && !images.length) {
    } else {
      throw new Error("編輯區還有未加入清單的題目，請先加入投稿清單。");
    }
    const bytes = payload.questions
      .flatMap((q) => q.images)
      .filter((s) => s.startsWith("data:"))
      .reduce((n, s) => n + s.split(",")[1].length * 0.75, 0);
    if (bytes > 6 * 1024 * 1024)
      throw new Error("整份投稿的題圖超過 6 MB，請縮小圖片或分批投稿。");
    submitPending = true;
    document
      .querySelectorAll("input,select,textarea,button")
      .forEach((node) => (node.disabled = true));
    ready();
    message("正在送出投稿…");
    const result = await api("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        website: $("website").value,
        confirmSimilar:
          $("possibleDuplicates").querySelector(".similar-consent")?.checked ===
          true,
      }),
    });
    showDuplicates(result);
    if (result.status === "duplicates_only") {
      $("success").hidden = true;
      message(
        `這 ${result.receivedCount} 題均已收錄或與本批重複，沒有新增投稿。草稿仍保留，可查看下方略過清單。`,
      );
      return;
    }
    let receiptSaveFailed = false;
    currentReceipt = {
      id: result.id,
      course: payload.course,
      title: payload.title,
      acceptedCount: result.acceptedCount,
      skippedCount: result.skippedCount,
      submittedAt: new Date().toISOString(),
    };
    receipts = [
      currentReceipt,
      ...receipts.filter((r) => r.id !== result.id),
    ].slice(0, 20);
    try {
      localStorage.setItem(receiptKey, JSON.stringify(receipts));
    } catch {
      receiptSaveFailed = true;
    }
    renderReceipts();
    showSimilar($("possibleDuplicates"), []);
    $("receipt").textContent = result.id;
    $("statusId").value = result.id;
    $("success").hidden = false;
    questions = [];
    clearEditor();
    render();
    save();
    message(
      `已送出 ${result.acceptedCount ?? payload.questions.length} 題，等待站主審核${result.skippedCount ? `；自動略過 ${result.skippedCount} 題重複題目` : ""}。${receiptSaveFailed ? "這台裝置無法保存收據，請下載投稿收據備份。" : ""}`,
    );
  } catch (error) {
    if (error.details?.code === "similar_questions")
      showSimilar($("possibleDuplicates"), error.details.possibleDuplicates);
    message(
      error.message === "Failed to fetch"
        ? "無法連線，草稿已保留，請稍後再送出。"
        : error.message,
      true,
    );
  } finally {
    submitPending = false;
    document
      .querySelectorAll("input,select,textarea,button")
      .forEach((node) => (node.disabled = false));
    ready();
  }
});
$("statusForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("statusId").value.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    $("statusResult").textContent = "請輸入完整的投稿編號。";
    return;
  }
  $("statusResult").textContent = "查詢中…";
  try {
    const result = await api("/api/status/" + encodeURIComponent(id));
    $("statusResult").textContent =
      statusLabel[result.status] +
      (result.note ? "；站主說明：" + result.note : "");
  } catch (error) {
    $("statusResult").textContent = error.message;
  }
});

const receiptKey = "course-library-submission-receipts-v1";
let receipts = [],
  currentReceipt = null;
try {
  const saved = JSON.parse(localStorage.getItem(receiptKey) || "[]");
  if (Array.isArray(saved))
    receipts = saved
      .filter(
        (r) => /^[0-9a-f-]{36}$/i.test(r.id) && typeof r.title === "string",
      )
      .slice(0, 20);
} catch {}
function renderReceipts() {
  $("recentReceipts").hidden = !receipts.length;
  $("receiptList").innerHTML = receipts
    .map(
      (r, i) =>
        `<article class="draft-card"><h3>${esc(r.title)}</h3><p>${esc(r.id)} · ${esc(r.submittedAt ? new Date(r.submittedAt).toLocaleString("zh-TW") : "")} · ${Number(r.acceptedCount) || 0} 題</p><div class="actions"><button type="button" class="text-button" data-receipt-check="${i}">查詢狀態</button><button type="button" class="text-button" data-receipt-copy="${i}">複製編號</button><button type="button" class="text-button" data-receipt-download="${i}">下載收據</button></div></article>`,
    )
    .join("");
}
$("copyReceipt").addEventListener(
  "click",
  () => currentReceipt && copyText(currentReceipt.id),
);
$("downloadReceipt").addEventListener(
  "click",
  () => currentReceipt && downloadJSON(currentReceipt, "題庫投稿收據.json"),
);
$("receiptList").addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.receiptCheck !== undefined) {
    $("statusId").value = receipts[Number(b.dataset.receiptCheck)].id;
    $("statusForm").requestSubmit();
  }
  if (b.dataset.receiptCopy !== undefined)
    copyText(receipts[Number(b.dataset.receiptCopy)].id);
  if (b.dataset.receiptDownload !== undefined)
    downloadJSON(
      receipts[Number(b.dataset.receiptDownload)],
      "題庫投稿收據.json",
    );
});
form.addEventListener("input", () => {
  const check = $("possibleDuplicates").querySelector(".similar-consent");
  if (check) check.checked = false;
});
$("draftList").addEventListener("click", () => {
  const check = $("possibleDuplicates").querySelector(".similar-consent");
  if (check) check.checked = false;
});
renderReceipts();
