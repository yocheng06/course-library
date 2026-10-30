const normalizeBatch=(input,options={})=>normalizeBatchBase(input,{...options,allowConflictingVersions:true});
const uniqueQuestions=(course,unit,questions,onDuplicate)=>uniqueQuestionsBase(course,unit,questions,onDuplicate,{allowConflictingVersions:true});
import {setupGroupedSubmissions} from './grouped-submissions.mjs?v=treasure-unit-20261030';
import {
  COURSE_UNITS,
  normalizeUnit,
  unitLabel,
  normalizeType,
  normalizeBatch as normalizeBatchBase,
  uniqueQuestions as uniqueQuestionsBase,
} from "./contribution-model.js?v=treasure-unit-20261030";
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
} from "./contributions-ui.js?v=treasure-unit-20261030";
import { setupSubmissionInbox } from "./submission-inbox-ui.mjs?v=community-direct-publish-20261028";
const $ = (id) => document.getElementById(id),
  form = $("questionForm"),
  key = "course-library-submission-draft-v1";
let selectedImportImageFiles = [];
let selectedQuestionHtml = null, selectedAnswerHtml = null, importBusy = false, draftSaveTimer;
let questions = [],
  images = [],
  editIndex = -1,
  imageReadPending = false,
  storageWarning = false,
  submitPending = false;
$("course").innerHTML = Object.entries(COURSE_UNITS)
  .map(([id, course]) => `<option value="${id}">${course.name}</option>`)
  .join("");
const publicUnits={os:{...COURSE_UNITS.os.units},algorithms:{...COURSE_UNITS.algorithms.units}};
const publicTitles={os:{},algorithms:{}};
let unitsSequence=0;
function unitFields() {
  const custom=$("unit").value==='__new__';
  $("newUnitFields").hidden=!custom;$("newUnitNumber").required=custom;
}
function units() {
  const previous=$("unit").value;
  $("unit").innerHTML=Object.entries(publicUnits[$("course").value]).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')+'<option value="__new__">＋ 投稿尚未建立的單元</option>';
  if(Object.hasOwn(publicUnits[$("course").value],previous))$("unit").value=previous;
  unitFields();
}
function setSubmissionUnit(id,title='') {
  let normalized;try{normalized=normalizeUnit($("course").value,id);}catch{normalized=null;}
  if(normalized && Object.hasOwn(publicUnits[$("course").value],normalized))$("unit").value=normalized;
  else {$("unit").value='__new__';$("newUnitNumber").value=normalized?.slice(1)||'';$("newUnitTitle").value=title;}
  unitFields();
}
async function loadPublicUnits() {
  const seq=++unitsSequence,course=$("course").value;
  try {
    const result=await api('/api/units?course='+course);
    if(seq!==unitsSequence || course!==$("course").value || !Array.isArray(result.units))return;
    const selected=$("unit").value;
    for(const unit of result.units){
      const id=normalizeUnit(course,unit.id);
      publicUnits[course][id]=unitLabel(course,id,unit.title);publicTitles[course][id]=unit.title||'';
    }
    units();if(selected==='__new__'){$("unit").value=selected;unitFields();}
  }catch { /* The built-in list and manual new-unit fields remain usable offline. */ }
}
function metadata() {
  const course=$("course").value,custom=$("unit").value==='__new__';
  return {course,unit:custom?'L'+$("newUnitNumber").value:$("unit").value,
    unitTitle:custom?$("newUnitTitle").value:publicTitles[course][$("unit").value]||'',
    title:$("batchTitle").value,name:$("submitter").value,source:$("source").value};
}
function save() {
  clearTimeout(draftSaveTimer);
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
    return true;
  } catch {
    if (!storageWarning) {
      storageWarning = true;
      message("此裝置無法自動保存草稿，請使用「下載草稿」備份。", true);
    }
    return false;
  }
}
function scheduleDraftSave() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(save, 300);
}
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
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
const initialUnit = new URL(location.href).searchParams.get("unit");
const validInitialUnit=(()=>{try{return normalizeUnit(initialCourse,initialUnit);}catch{return null;}})();
if (initialUnit && COURSE_UNITS[initialCourse]) setSubmissionUnit(initialUnit);
try {
  const draft = JSON.parse(localStorage.getItem(key) || "null");
  if (draft) {
    if (COURSE_UNITS[draft.course]) {
      $("course").value = draft.course;
      units();
      setSubmissionUnit(draft.unit,draft.unitTitle||'');
    }
    $("batchTitle").value = draft.title || "";
    $("submitter").value = draft.name || "";
    $("source").value = draft.source || "";
    questions = draft.questions?.length
      ? normalizeBatch({
          ...metadata(),
          unit: (()=>{try{return normalizeUnit($("course").value,draft.unit);}catch{return Object.keys(COURSE_UNITS[$("course").value].units)[0];}})(),
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
    if (
      validInitialUnit &&
      (draft.course !== initialCourse || draft.unit !== initialUnit)
    ) {
      const banner = document.createElement("div");
      banner.className = "panel";
      banner.setAttribute("role", "status");
      const text = document.createElement("p");
      text.textContent = `已保留 ${COURSE_UNITS[draft.course]?.name || "原課程"}／${COURSE_UNITS[draft.course]?.units[draft.unit] || "原單元"} 的草稿。你剛從 ${COURSE_UNITS[initialCourse].name}／${unitLabel(initialCourse,validInitialUnit)} 進入投稿。`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary";
      button.textContent = "下載原草稿並開始此單元";
      button.addEventListener("click", () => {
        if (imageReadPending || submitPending) return;
        download(
          {
            ...metadata(),
            questions,
            editor: Object.fromEntries(new FormData(form)),
            images,
            editIndex,
          },
          "題庫投稿原草稿備份.json",
        );
        $("course").value = initialCourse;
        units();
        setSubmissionUnit(validInitialUnit);
        questions = [];
        $("batchTitle").value = "";
        $("source").value = "";
        clearEditor();
        render();
        save();
        banner.remove();
        message("已切換到連結指定的單元，原草稿已下載備份。");
      });
      banner.append(text, button);
      form.before(banner);
    }
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
  loadPublicUnits();
});
["unit", "newUnitNumber", "newUnitTitle", "batchTitle", "submitter", "source"].forEach((id) =>
  $(id).addEventListener("input", scheduleDraftSave),
);
$("unit").addEventListener("change",unitFields);
form.addEventListener("input", scheduleDraftSave);
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
        : "題目已加入投稿清單，可繼續新增或送出公開。",
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
    const status = $("message");
    status.textContent = `已移除第 ${index + 1} 題`;
    status.classList.remove("error");
    const nextQuestion = Math.min(index, questions.length - 1);
    const nextAction =
      nextQuestion >= 0
        ? $("draftList").querySelector(`[data-edit="${nextQuestion}"]`)
        : $("draftHeading");
    nextAction.focus();
  }
  if (b.dataset.edit !== undefined) {
    setSubmissionMode("manual");
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
function normalizedImagePath(value) {
  let path = String(value ?? "").split(/[?#]/, 1)[0].replace(/\\/g, "/");
  try {
    path = decodeURIComponent(path);
  } catch {}
  return path
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/^[a-z][a-z\d+.-]*:\/\//i, "")
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}
function imageFileType(file) {
  const mime = String(file.type ?? "").toLocaleLowerCase();
  if (["image/png", "image/jpeg", "image/webp"].includes(mime)) return mime;
  const extension = /\.([^.]+)$/.exec(file.name ?? "")?.[1]?.toLocaleLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" })[extension] || "";
}
function findImageFile(source, files) {
  const path = normalizedImagePath(source),
    candidates = [...(files || [])]
      .filter((file) => imageFileType(file))
      .map((file) => ({
        file,
        path: normalizedImagePath(file.webkitRelativePath || file.name),
      }));
  let matches = candidates.filter(
    (item) => item.path === path || item.path.endsWith("/" + path),
  );
  if (!matches.length) {
    const name = path.split("/").at(-1);
    matches = candidates.filter((item) => item.path.split("/").at(-1) === name);
  }
  if (matches.length > 1) return { ambiguous: true };
  return matches[0] || null;
}
async function imageFileDataUrl(file, questionNumber) {
  const type = imageFileType(file);
  if (!type)
    throw new Error(`第 ${questionNumber} 題的題圖格式不支援；請使用 PNG、JPEG 或 WebP。`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 1024 * 1024)
    throw new Error(`第 ${questionNumber} 題的題圖超過 1 MB，請縮小圖片後再匯入。`);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}
async function parseCoursePracticeHtml(doc, raw, name, imageFiles = []) {
  const form = doc.querySelector("#practice-quiz-form");
  if (!form) return null;
  const action = form.getAttribute("action") || "",
    courseCode = action.match(/\/course\/([a-z0-9_-]+)\/process_practice\.php/i)?.[1];
  if (!courseCode) throw new Error("找到測驗表單，但無法辨識課程代碼；請下載題庫 JSON 匯入。");
  const course = /^OS/i.test(courseCode) ? "os" : /^Alg(?:\d[A-Za-z0-9_-]*)?$/i.test(courseCode) ? "algorithms" : null;
  if (!course) throw new Error(`目前無法辨識課程「${courseCode}」；請先選擇網站科目並使用題庫 JSON 匯入。`);
  const realmId = /realm_id=(\d+)/i.exec(raw)?.[1],
    title = doc.title.replace(/\s+/g, " ").trim() || name.replace(/\.(?:html?)$/i, "");
  let unit;
  try {
    unit = realmId ? normalizeUnit(course, realmId) : normalizeUnit(course, $("unit").value);
  } catch {
    throw new Error("已辨識課程練習頁，但無法判斷單元；請確認頁面網址有 realm_id，或先選擇正確單元。" );
  }
  const category = COURSE_UNITS[course].units[unit]?.replace(/^.*?·\s*/, "") || "HTML 匯入";
  const hidden = (node) => {
    for (let current = node; current && current !== doc.body; current = current.parentElement) {
      const style = current.getAttribute("style") || "";
      if (
        current.hidden ||
        current.getAttribute("aria-hidden") === "true" ||
        /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|left\s*:\s*-\d+px/i.test(style)
      ) return true;
    }
    return false;
  };
  const cleanText = (value) => value.replace(/\s+/g, " ").trim();
  const cleanQuestionStem = (value) =>
    cleanText(value).replace(/^\s*(?:妖獸|Beast)\s*\d+\s*[.．、:：)]?\s*/iu, "");
  const questions = [];
  for (const block of doc.querySelectorAll(".question-block")) {
    if (block.closest("template") || hidden(block)) continue;
    const responseInputs = [...block.querySelectorAll("input")].filter((input) =>
      input.type === "radio" || input.type === "checkbox" ||
      (input.type === "text" && input.classList.contains("text-answer")),
    );
    // This site's v_user_answer field is a bot-check decoy, not a course question.
    if (responseInputs.some((input) => input.name === "v_user_answer")) continue;
    if (!responseInputs.length) throw new Error(`第 ${questions.length + 1} 個題目區塊的作答欄位無法辨識，沒有匯入任何題目。`);
    const questionNumber = questions.length + 1,
      questionImages = [];
    for (const image of block.querySelectorAll("img")) {
      if (hidden(image)) continue;
      const source = image.getAttribute("src") || "";
      if (/^https:\/\//i.test(source) || /^data:image\/(?:png|jpeg|webp);base64,/i.test(source)) {
        questionImages.push(source);
        continue;
      }
      const match = findImageFile(source, imageFiles);
      if (match?.ambiguous)
        throw new Error(`第 ${questionNumber} 題有多個同名題圖「${source.split("/").at(-1)}」；請只選取題目 HTML 對應的「${name.replace(/\.html?$/i, "")}_files」資料夾。沒有匯入任何題目。`);
      if (!match)
        throw new Error(`第 ${questionNumber} 題的題圖「${source.split("/").at(-1) || "未命名"}」不在 HTML 內；請先選取下載時產生的「${name.replace(/\.html?$/i, "")}_files」資料夾，再重新匯入。沒有匯入任何題目。`);
      questionImages.push(await imageFileDataUrl(match.file, questionNumber));
    }
    const stemNodes = [...block.querySelectorAll(".question-text")]
      .map((node) => cleanText(staticHtmlText(node)))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!stemNodes.length) throw new Error(`第 ${questions.length + 1} 題缺少題幹，沒有匯入任何題目。`);
    const stem = cleanQuestionStem(stemNodes[0]);
    const types = new Set(responseInputs.map((input) => input.type));
    if (types.size !== 1 || !["radio", "checkbox", "text"].includes([...types][0]))
      throw new Error(`第 ${questions.length + 1} 題的題型無法辨識，沒有匯入任何題目。`);
    const inputType = [...types][0];
    let options = [];
    if (inputType === "radio" || inputType === "checkbox") {
      options = [...block.querySelectorAll("label")]
        .filter((label) => label.querySelector('input[type="radio"],input[type="checkbox"]'))
        .map((label) => cleanText(label.textContent).replace(/^[A-H][.、．:：)）]\s*/i, ""))
        .filter(Boolean);
      if (options.length !== responseInputs.length || options.length < 2 || options.length > 8)
        throw new Error(`第 ${questions.length + 1} 題的選項格式無法辨識，沒有匯入任何題目。`);
    }
    questions.push({
      category,
      type: inputType === "radio" ? "單選題" : inputType === "checkbox" ? "多選題" : "填空題",
      stem,
      options,
      answer: "",
      explanation: "",
      images: questionImages,
    });
  }
  if (!questions.length) throw new Error("這份測驗 HTML 裡找不到可匯入的題目區塊。");
  const hostname = (() => { try { return new URL(action).hostname; } catch { return "來源網站"; } })();
  return {
    __htmlQuestionImport: true,
    course,
    unit,
    title,
    source: `從 ${hostname} ${courseCode} 練習頁 HTML 匯入；解析可留空，請核對正解。`,
    questions,
  };
}

function staticHtmlText(node) {
  const parts = [];
  const visit = (current) => {
    if (current.nodeType === 3) {
      parts.push(current.nodeValue || "");
      return;
    }
    if (current.nodeType !== 1) return;
    const tag = current.tagName.toLowerCase();
    if (["script", "style", "template", "noscript"].includes(tag)) return;
    if (tag === "input" && current.classList.contains("text-answer")) {
      parts.push(" ____________ ");
      return;
    }
    if (tag === "br") {
      parts.push("\n");
      return;
    }
    for (const child of current.childNodes) visit(child);
  };
  visit(node);
  return parts.join("");
}

function parseCoursePracticeResultsHtml(doc) {
  const blocks = [...doc.querySelectorAll(".question-result")];
  if (!blocks.length) return null;
  const clean = (value) => value.replace(/\s+/g, " ").trim();
  const answers = blocks.map((block, index) => {
    let stem = "",
      correctLines = [];
    for (const paragraph of block.querySelectorAll("p")) {
      const text = staticHtmlText(paragraph).replace(/\r/g, "").trim();
      const question = text.match(/^題目\s*[：:]\s*([\s\S]*)$/u);
      if (question) {
        // HTML parsers close a paragraph before a pre/table block; retain its following stem content.
        const parts = [question[1]];
        for (let sibling = paragraph.nextSibling; sibling; sibling = sibling.nextSibling) {
          const content = staticHtmlText(sibling);
          if (/^(?:你的答案|正確答案|得分)\s*[：:]/u.test(content.trim())) break;
          parts.push(content);
        }
        stem = clean(parts.join(" "));
      }
      const answer = text.match(/^正確答案\s*[：:]\s*([\s\S]*)$/u);
      if (answer)
        correctLines = answer[1]
          .split("\n")
          .map(clean)
          .filter(Boolean);
    }
    return { index, stem, correctLines };
  });
  const meaningful = answers.filter((answer) => answer.stem || answer.correctLines.length);
  if (!meaningful.some((answer) => answer.correctLines.length)) return null;
  if (meaningful.some((answer) => !answer.stem || !answer.correctLines.length))
    throw new Error("答案結果 HTML 有題目缺少題幹或正確答案；請確認這是交卷後顯示答案的頁面。");
  return { answers: meaningful };
}

function practiceStemKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\[\s*__\s*\d+\s*__\s*\]/gu, " ")
    .replace(/^\s*(?:妖獸|beast)\s*\d+\s*[.、．]?\s*/iu, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function combineCoursePracticeHtml(questionImport, resultImport) {
  const byStem = new Map();
  questionImport.questions.forEach((question, index) => {
    const key = practiceStemKey(question.stem);
    if (!key) return;
    const matches = byStem.get(key) || [];
    matches.push(index);
    byStem.set(key, matches);
  });
  // Resolve repeated stems using answer content, never result order.
  const resultCandidates = resultImport.answers.map(result => {
    const matches = byStem.get(practiceStemKey(result.stem)) || [];
    const candidates = [];
    for (const index of matches) {
      const question = questionImport.questions[index];
      let answer = result.correctLines.join(",");
      if (question.options.length) {
        // Bare letters cannot identify one of several same-stem option versions.
        if (matches.length > 1 && result.correctLines.some(line => /^[A-H](?:\s*[,、，/＋+&]\s*[A-H])*[.．、)]?$/i.test(line.trim()))) continue;
        const choiceKeys = result.correctLines.map(line =>
          globalThis.courseChoiceAnswers.expectedChoiceKey(line,question.options));
        const letters = choiceKeys.flatMap(key => key?.split("") || []);
        if (choiceKeys.some(key => !key) || new Set(letters).size !== letters.length ||
            (question.type === "單選題" && letters.length !== 1)) continue;
        answer = letters.sort().join("、");
      }
      if (answer.trim()) candidates.push({index,answer});
    }
    return candidates;
  });
  // A candidate can be compatible with several questions. Match the whole
  // same-stem group, then accept an answer only if every valid assignment agrees.
  function solveGroup(rows, forced = null) {
    const assigned = new Map();
    if (forced) assigned.set(forced.index,forced.row);
    function place(row,seen) {
      for (const pair of rows[row]) {
        if (pair.index === forced?.index || seen.has(pair.index)) continue;
        seen.add(pair.index);
        const previous = assigned.get(pair.index);
        if (previous === undefined || place(previous,seen)) {
          assigned.set(pair.index,row);
          return true;
        }
      }
      return false;
    }
    for (let row=0;row<rows.length;row++) {
      if (row !== forced?.row && !place(row,new Set())) return null;
    }
    return assigned;
  }
  let matchedQuestionCount = 0;
  function assign(index,answer) {
    questionImport.questions[index].answer = answer;
    matchedQuestionCount++;
  }
  for (const [stem,indices] of byStem) {
    const rows = resultCandidates.filter((_,row) => practiceStemKey(resultImport.answers[row].stem) === stem);
    if (indices.length === rows.length) {
      const solution = solveGroup(rows);
      if (!solution) continue;
      for (const index of indices) {
        const answer = rows[solution.get(index)].find(pair => pair.index === index).answer;
        const alternative = rows.some((pairs,row) => pairs.some(pair =>
          pair.index === index && pair.answer !== answer && solveGroup(rows,{row,index})));
        if (!alternative) assign(index,answer);
      }
    } else {
      // Missing or extra results cannot justify elimination. Keep only direct,
      // uniquely identified answers whose compatible result records all agree.
      for (const index of indices) {
        const candidates = rows.flatMap(list => list.filter(pair => pair.index === index));
        const identified = rows.some(list => list.length === 1 && list[0].index === index);
        if (identified && new Set(candidates.map(pair => pair.answer)).size === 1) assign(index,candidates[0].answer);
      }
    }
  }
  return {
    ...questionImport,
    source: "題目與交卷結果 HTML 已配對；解析留白，送出前請核對答案。",
    __answerImportSummary: {
      matchedQuestionCount,
      totalQuestionCount: questionImport.questions.length,
      resultCount: resultImport.answers.length,
    },
  };
}

async function parseCoursePracticeHtmlPair(rawFiles, names, imageFiles = []) {
  if (rawFiles.length !== 2 || !Array.isArray(names) || names.length !== 2)
    throw new Error("題目和答案分成兩份時，請一次選取剛好兩個 HTML 檔。");
  if (names.some((name) => !/\.html?$/i.test(name)))
    throw new Error("配對匯入需同時選取題目 HTML 與交卷結果 HTML。");
  let questionImport = null,
    resultImport = null;
  for (let index = 0; index < rawFiles.length; index++) {
    const doc = new DOMParser().parseFromString(rawFiles[index], "text/html"),
      result = parseCoursePracticeResultsHtml(doc);
    if (result) {
      if (resultImport) throw new Error("找到兩份答案結果頁；請只選一份答案 HTML。");
      resultImport = result;
      continue;
    }
    const question = await parseCoursePracticeHtml(
      doc,
      rawFiles[index],
      names[index],
      imageFiles,
    );
    if (question) {
      if (questionImport) throw new Error("找到兩份題目頁；請只選一份題目 HTML。");
      questionImport = question;
    }
  }
  if (!questionImport || !resultImport)
    throw new Error("無法辨認這兩份檔案。請選一份 CCSA 題目 HTML 和一份交卷結果 HTML。");
  return combineCoursePracticeHtml(questionImport, resultImport);
}

async function parseImport(raw, name, imageFiles = []) {
  if (Array.isArray(raw))
    return parseCoursePracticeHtmlPair(raw, name, imageFiles);
  if (/\.json$/i.test(name)) return JSON.parse(raw);
  const doc = new DOMParser().parseFromString(raw, "text/html");
  if (parseCoursePracticeResultsHtml(doc))
    throw new Error("這是交卷結果 HTML；請與題目 HTML 一起選取，系統會自動配對正解。");
  const data = doc.querySelector("script#course-data");
  if (data) return JSON.parse(data.textContent);
  const manifest=doc.querySelector('script#course-manifest');
  if(manifest) return JSON.parse(manifest.textContent).map(unit=>{
    const block=doc.querySelector(`script[data-course-unit="${unit.id}"]`);
    if(!block)throw new Error('缺少單元題目：'+unit.id);
    return {course:'os',unit:unit.id,questions:JSON.parse(block.textContent)};
  });
  const practice = await parseCoursePracticeHtml(doc, raw, name, imageFiles);
  if (practice) return practice;
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
$("chooseImport").addEventListener("click", () => $("importFile").click());
function setSubmissionMode(mode) {
  const importing = mode === "import";
  $("importWorkspace").hidden = !importing;
  form.hidden = importing;
  $("draftHeading").closest("section").hidden = importing;
  const grouped = document.querySelector(".group-preview");
  if (grouped) grouped.hidden = !importing;
  for (const [id, active] of [["showHtmlImport", importing], ["showManualEntry", !importing]]) {
    $(id).setAttribute("aria-pressed", String(active));
    $(id).classList.toggle("secondary", !active);
  }
}
function updatePairStatus() {
  for (const id of ["chooseQuestionHtml", "chooseAnswerHtml", "chooseImportImages", "chooseImport"]) $(id).disabled = importBusy;
  $("questionHtmlName").textContent = selectedQuestionHtml?.name || "尚未選取";
  $("answerHtmlName").textContent = selectedAnswerHtml?.name || "尚未選取";
  $("previewHtmlPair").disabled = importBusy || !selectedQuestionHtml || !selectedAnswerHtml;
  $("htmlPairStatus").textContent = importBusy ? "正在產生預覽，請稍候…" :
    selectedQuestionHtml && selectedAnswerHtml ? "檔案已備妥；有題圖時選取資料夾，再產生預覽。" : "請先選取題目及交卷結果兩份 HTML。";
}
for (const [buttonId, inputId, kind] of [["chooseQuestionHtml", "questionHtmlFile", "question"], ["chooseAnswerHtml", "answerHtmlFile", "answer"]]) {
  $(buttonId).addEventListener("click", () => $(inputId).click());
  $(inputId).addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) {
      if (kind === "question") selectedQuestionHtml = file;
      else selectedAnswerHtml = file;
    }
    event.target.value = "";
    updatePairStatus();
  });
}
$("showHtmlImport").addEventListener("click", () => setSubmissionMode("import"));
$("showManualEntry").addEventListener("click", () => setSubmissionMode("manual"));
async function previewImport(files) {
  if (importBusy) return false;
  importBusy = true;
  updatePairStatus();
  try {
    await groupedSubmissions.importFiles(files, selectedImportImageFiles);
    selectedImportImageFiles = [];
    $("importImageStatus").textContent = "題圖已帶入預覽；選取的圖片暫存已清除。";
    setSubmissionMode("import");
    return true;
  } catch(error) {
    message("無法匯入：" + error.message, true);
    return false;
  } finally {
    importBusy = false;
    updatePairStatus();
  }
}
$("previewHtmlPair").addEventListener("click", async () => {
  if (!selectedQuestionHtml || !selectedAnswerHtml) return;
  if (await previewImport([selectedQuestionHtml, selectedAnswerHtml])) {
    selectedQuestionHtml = selectedAnswerHtml = null;
    updatePairStatus();
    $("htmlPairStatus").textContent = "已產生預覽，尚未送出。請往下核對每題、正解與題圖。";
  }
});
$("chooseImportImages").addEventListener("click", () => $("importImages").click());
$("importImages").addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []),
    supported = files.filter((file) => imageFileType(file));
  selectedImportImageFiles = supported;
  $("importImageStatus").textContent = supported.length
    ? `已選取 ${supported.length} 個 PNG／JPEG／WebP 檔；匯入成功後會清除暫存選擇。`
    : "沒有找到 PNG、JPEG 或 WebP 題圖；可選取題目 HTML 同名的「_files」資料夾。";
  event.target.value = "";
});
$("importFile").addEventListener("change", async event => {
  const files=event.target.files;if(!files?.length)return;
  try { await previewImport(files); }
  finally { event.target.value=''; }
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
          options: ["第一個選項", "第二個選項"],
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
      `已將 ${result.acceptedCount ?? payload.questions.length} 題加入公開題庫${result.pendingReviewCount ? `；其中 ${result.pendingReviewCount} 題已標示待核對` : ""}${result.skippedCount ? `；自動略過 ${result.skippedCount} 題重複題目` : ""}。投稿編號：${result.id}${receiptSaveFailed ? "。這台裝置無法保存收據，請下載投稿收據備份。" : ""}`,
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
setupSubmissionInbox({
  document,
  storage: localStorage,
  courses: COURSE_UNITS,
  download,
  message,
  onStorage: handler => window.addEventListener("storage", handler),
  addQuestion(q) {
    setSubmissionMode("manual");
    if (submitPending || imageReadPending) throw new Error("請等待目前操作完成。");
    const hasEditor = editIndex !== -1 || images.length ||
      ["category", "stem", "options", "answer", "explanation"].some(name => form.elements[name].value.trim());
    const differentScope = q.course !== $("course").value || q.unit !== metadata().unit;
    if (differentScope && (questions.length || hasEditor))
      throw new Error("原投稿草稿屬於不同科目或單元，請先送出原清單，再加入這題。待補內容仍保留。");
    const nextMetadata = { ...metadata(), course: q.course, unit: q.unit, title: $("batchTitle").value || "批次查題補充題" };
    const candidate = normalizeBatch({ ...nextMetadata, questions: [{
      category: q.category, type: q.type, stem: q.stem,
      options: q.optionsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      answer: q.answer, explanation: q.explanation, images: [],
    }] }).questions[0];
    const merged = uniqueQuestions(q.course, q.unit, [...questions, candidate]);
    const normalized = normalizeBatch({ ...nextMetadata, questions: merged });
    if (differentScope) {
      $("course").value = q.course;
      units();
      setSubmissionUnit(q.unit,q.unitTitle||'');
    }
    $("batchTitle").value = normalized.title;
    questions = normalized.questions;
    render();
    if (!save()) throw new Error("題目已顯示於投稿清單，但此裝置無法保存；待補草稿仍保留，請下載備份。");
  },
});
if (location.hash === "#pendingHeading" && !$("pendingDrafts").hidden) {
  $("pendingHeading").focus({ preventScroll: true });
  $("pendingHeading").scrollIntoView({ block: "start" });
}

const groupedSubmissions=setupGroupedSubmissions({parseImport,metadata,message,onReceipt(result,payload){
  const next={id:result.id,course:payload.course,title:payload.title,acceptedCount:result.acceptedCount,skippedCount:result.skippedCount,submittedAt:new Date().toISOString()};
  currentReceipt=next;
  receipts=[next,...receipts.filter(row=>row.id!==result.id)].slice(0,20);
  try{localStorage.setItem(receiptKey,JSON.stringify(receipts));}
  catch{message('已送出，但近期收據無法保存。請立即下載分組收據備份。',true);}
  renderReceipts();
}});

loadPublicUnits();
setSubmissionMode(document.querySelector(".group-preview [data-group-index]") ? "import" :
  questions.length || editIndex !== -1 || form.elements.stem.value.trim() ? "manual" : "import");
