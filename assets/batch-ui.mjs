import {
  buildIndex,
  matchQuestions,
  expandLibraryQuestion,
  applyBuiltinOverrides,
  aiPrompt,
  MAX_TEXT,
} from "./batch-model.mjs?v=batch-match-normalize-20261029";
import { parseBatchInput } from "./batch-import.mjs?v=batch-match-normalize-20261029";
import { setupBatchImport } from "./batch-import-ui.mjs?v=batch-match-normalize-20261029";
import { stageUnmatched } from "./submission-inbox.mjs?v=draft-transfer-20261020";
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const names = { os: "作業系統", algorithms: "演算法" };
const labels = { matched: "已收錄", unmatched: "未收錄", review: "需確認" };
const draftKey = "course-library.batch-draft.v1";
let library,
  index,
  coverage = { os: false, algorithms: false },
  invalidPublicData = { os: false, algorithms: false },
  results = [],
  snapshot = null,
  loading = false,
  syncing = false,
  libraryGeneration = 0,
  snapshotGeneration = -1,
  courseSuggestion = null;
const selectedCourse = new URL(location.href).searchParams.get("course");
if (names[selectedCourse]) $("course").value = selectedCourse;
function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
  $("message").hidden = !text;
}
function scope() {
  return { course: $("course").value, unit: $("unit").value };
}
function currentSnapshot() {
  return JSON.stringify({ ...scope(), text: $("batchText").value });
}
function units() {
  const previous = $("unit").value;
  $("unit").innerHTML =
    '<option value="all">全部單元</option>' +
    (library?.courses[$("course").value]?.units || [])
      .map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`)
      .join("");
  if ([...$("unit").options].some((o) => o.value === previous))
    $("unit").value = previous;
  if (library && restoreUnit) {
    if ([...$("unit").options].some((o) => o.value === restoreUnit))
      $("unit").value = restoreUnit;
    restoreUnit = null;
  }
  document.body.dataset.course = $("course").value;
}
function isStale() {
  return (
    snapshot !== currentSnapshot() || snapshotGeneration !== libraryGeneration
  );
}
function markChanged() {
  $("staleNotice").hidden = !results.length || !isStale();
  const stale = !$("staleNotice").hidden;
  $("courseMismatch").hidden = !courseSuggestion || stale || loading;
  $("switchCourse").disabled = stale || loading || !index;
  for (const id of ["copyAnswers", "copyUnmatched", "copyReview"])
    $(id).disabled =
      stale || loading || !index || !results.length || !copyItems(id).length;
  const unmatchedCount = copyItems("copyUnmatched").length;
  $("transferUnmatched").disabled = stale || loading || !index || !unmatchedCount || !!courseSuggestion;
  $("transferUnmatched").textContent = `轉入投稿草稿${unmatchedCount ? `（${unmatchedCount} 題）` : ""}`;
  $("inputCount").textContent =
    `${$("batchText").value.length.toLocaleString()} / ${MAX_TEXT.toLocaleString()} 字・最多 30 題`;
  try {
    localStorage.setItem(
      draftKey,
      JSON.stringify({ ...scope(), text: $("batchText").value }),
    );
  } catch {}
}
function copyItems(id) {
  return id === "copyUnmatched"
    ? results.filter((r) => r.status === "unmatched")
    : id === "copyReview"
      ? results.filter((r) => r.status === "review")
      : results;
}
function statusLabel(row) {
  if (row.status === "unmatched" && courseSuggestion) return "此科目未找到";
  if (row.outsideScope) return "其他單元已收錄";
  return row.status === "unmatched" && !snapshotCoverage
    ? "未找到"
    : row.status === "unmatched" && snapshotUnit !== "all"
      ? "此範圍未找到"
      : labels[row.status];
}
let snapshotCoverage = false;
let snapshotUnit = "all";
let restoreUnit = null;
function libraryStatus() {
  const course = $("course").value;
  const count = new Set(
    (index?.entries || []).filter((e) => e.course === course).map((e) => e.id),
  ).size;
  $("libraryStatus").textContent =
    `${names[course]}：${count} 題可供比對。` +
    (coverage[course]
      ? "已同步內建題修改與公開投稿題庫。"
      : syncing
        ? "正在同步公開投稿，現在可先比對內建題庫。"
      : invalidPublicData[course]
        ? "線上題庫資料不完整，目前僅比對隨站內建版本。可按「重新同步題庫」重試。"
      : "線上題庫暫時無法同步，目前僅比對隨站內建版本。可按「重新同步題庫」重試。");
}
function validPublicQuestion(raw, sourceVariant = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const options = raw.options ?? raw.opts;
  if (
    typeof (raw.stem ?? raw.q) !== "string" ||
    typeof (raw.answer ?? raw.a) !== "string" ||
    !Array.isArray(options) || options.some((option) => typeof option !== "string")
  ) return false;
  for (const field of ["answerConditions", "optionTranslations"])
    if (raw[field] !== undefined &&
        (!Array.isArray(raw[field]) || raw[field].some((value) => typeof value !== "string"))) return false;
  if (raw.translation !== undefined && typeof raw.translation !== "string") return false;
  if (raw.images !== undefined &&
      (!Array.isArray(raw.images) || raw.images.some((image) =>
        !image || typeof image !== "object" || typeof image.src !== "string"))) return false;
  if (!sourceVariant && raw.sourceVariants !== undefined &&
      (!Array.isArray(raw.sourceVariants) || raw.sourceVariants.some((variant) => !validPublicQuestion(variant, true)))) return false;
  return true;
}
async function loadLibrary() {
  if (syncing) return;
  syncing = true;
  loading = true;
  libraryGeneration++;
  if (results.length) {
    $("staleNotice").textContent =
      "正在重新同步題庫，以下為上次比對結果；完成後請重新比對。";
    markChanged();
  }
  $("compare").disabled = true;
  $("reloadLibrary").disabled = true;
  $("libraryStatus").textContent = "正在載入內建題庫與同步公開投稿……";
  try {
    const built = fetch(
      "assets/batch-library.json?v=l9-blanks-restored-20261029",
      {
        signal: AbortSignal.timeout(12000),
      },
    ).then(async (r) => {
      if (!r.ok) throw new Error("library");
      return r.json();
    });
    const publicLoads = Object.keys(names).map(async (course) => {
      const response = await fetch(
        window.courseContributions.apiOrigin +
          "/api/questions?course=" +
          course,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!response.ok) throw new Error("public");
      const data = await response.json();
      if (!Array.isArray(data.questions)) throw new Error("public");
      return { course, questions: data.questions, overrides:data.overrides || [] };
    });
    const publicResults = Promise.allSettled(publicLoads);
    const base = await built;
    if (
      base.schemaVersion !== 1 ||
      !Array.isArray(base.entries) ||
      !base.courses?.os ||
      !base.courses?.algorithms
    )
      throw new Error("library");
    library = base;
    const curatedAliasIds = new Set((Array.isArray(base.curatedAliasIds) ? base.curatedAliasIds : []).filter((id) => typeof id === 'string'));
    let entries = base.entries.slice();
    coverage = { os: false, algorithms: false };
    invalidPublicData = { os: false, algorithms: false };
    index = buildIndex(entries);
    units();
    loading = false;
    $("compare").disabled = false;
    libraryStatus();
    if (results.length)
      $("staleNotice").textContent =
        "內建題庫已載入，可先重新比對；公開投稿仍在背景同步。";
    markChanged();

    // Public submissions must not block built-in question lookup. Publishing
    // this later index invalidates results produced against the earlier data.
    let publicChanged = false;
    let nextIndex = index;
    for (const result of await publicResults) {
      if (result.status !== "fulfilled") continue;
      const { course, questions, overrides } = result.value;
      try {
        // Validate and build each course atomically. A malformed public record
        // must not erase the ready built-in index or imply complete coverage.
        const additions = [], newUnits = new Map();
        for (const row of questions) {
          const raw = row?.question;
          if (
            (!library.courses[course].units.some((u) => u.id === row?.unit) && !/^L[1-9]\d?$/.test(row?.unit)) ||
            !validPublicQuestion(raw) ||
            !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(raw.id || raw.bookmarkId || "")
          ) throw new Error("public-data");
          const questionId=raw.id||raw.bookmarkId;
          if(curatedAliasIds.has(questionId) || base.entries.some(e=>e.course===course && e.id===questionId))continue;
          if(!library.courses[course].units.some(u=>u.id===row.unit))newUnits.set(row.unit,{id:row.unit,name:row.unit+' · '+String(raw.unitTitle||'新單元').slice(0,60)});
          const expanded = expandLibraryQuestion(course, row.unit, raw);
          if (!expanded.length) throw new Error("public-data");
          additions.push(...expanded);
        }
        if(overrides.some(row=>!validPublicQuestion(row?.question)))throw new Error("builtin-data");
        const candidateEntries=[...applyBuiltinOverrides(entries,course,overrides),...additions];
        const candidate = buildIndex(candidateEntries);
        entries=candidateEntries;
        library.courses[course].units.push(...newUnits.values());
        nextIndex = candidate;
        coverage[course] = true;
        publicChanged = true;
      } catch {
        invalidPublicData[course] = true;
      }
    }
    if (publicChanged) {
      index = nextIndex;
      libraryGeneration++;
      units();
    }
    syncing = false;
    libraryStatus();
    if (publicChanged && results.length) {
      $("staleNotice").textContent =
        "題庫比對資料已更新，請重新比對。下方保留的是上一批結果。";
    }
    markChanged();
  } catch {
    index = null;
    $("libraryStatus").textContent =
      "無法載入內建題庫，貼上的文字仍保留。請確認網路連線後按「重新同步題庫」。";
    if (results.length) {
      $("staleNotice").textContent =
        "題庫同步失敗，以下為上次比對結果；請重新同步並比對後再複製。";
      markChanged();
    }
  } finally {
    loading = false;
    syncing = false;
    $("compare").disabled = !index;
    $("reloadLibrary").disabled = false;
    markChanged();
  }
}
function sourceURL(id) {
  return (
    (snapshotCourse === "os" ? "os.html" : "algorithms.html") +
    "?question=" +
    encodeURIComponent(id)
  );
}
let snapshotCourse = "os";
function unitNames(row) {
  return [
    ...new Set(
      row.references.map(
        (ref) =>
          library.courses[snapshotCourse].units.find((u) => u.id === ref.unit)
            ?.name || ref.unit,
      ),
    ),
  ].join("、");
}
function renderResults() {
  const filter = $("resultFilter").value;
  const shown = results.filter((r) => filter === "all" || r.status === filter);
  $("resultRows").innerHTML = shown
    .map(
      (row) =>
        `<tr><th scope="row">${esc(row.question.number)}</th><td class="answer-text">${esc(row.answer || "尚無可確認答案")}${row.conditions?.length ? `<p class="answer-condition"><strong>成立條件</strong><br>${row.conditions.map(esc).join("<br>")}</p>` : ""}${row.outsideScope ? `<p class="source-unit">收錄單元：${esc(unitNames(row))}</p>` : ""}</td><td><span class="result-badge ${row.status}">${esc(statusLabel(row))}</span></td><td><details class="question-detail"><summary>${esc(row.question.stem.slice(0, 90) || "缺少題幹")}</summary><p>${esc(row.question.stem)}</p>${row.question.options.length ? "<ul>" + row.question.options.map((o) => `<li>${esc(o.label)}. ${esc(o.text)}</li>`).join("") + "</ul>" : ""}<p>${esc(row.reason)}</p>${row.references.length ? '<ul class="source-links">' + row.references.map((ref) => `<li><a href="${sourceURL(ref.id)}" target="_blank" rel="noopener">${esc(ref.id)}・開啟${row.status === "matched" ? "收錄" : "候選"}原題 ↗</a></li>`).join("") + "</ul>" : ""}</details></td></tr>`,
    )
    .join("");
  $("emptyResults").hidden = shown.length > 0;
}
$("batchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!index || loading) return;
  try {
    const { questions: parsed, warnings } = parseBatchInput(
      $("batchText").value,
    );
    results = matchQuestions(parsed, index, scope());
    snapshot = currentSnapshot();
    snapshotGeneration = libraryGeneration;
    snapshotCourse = $("course").value;
    snapshotUnit = $("unit").value;
    snapshotCoverage = coverage[snapshotCourse];
    const count = (status) => results.filter((r) => r.status === status).length;
    const otherCourse = snapshotCourse === "os" ? "algorithms" : "os";
    const otherMatches = matchQuestions(parsed, index, {
      course: otherCourse,
    }).filter((r) => r.status === "matched").length;
    courseSuggestion =
      otherMatches >= 2 && otherMatches > count("matched")
        ? { course: otherCourse, count: otherMatches }
        : null;
    const scopeHint = courseSuggestion
      ? `目前比對科目為「${names[snapshotCourse]}」，這批有 ${otherMatches} 題在「${names[otherCourse]}」找到一致原題。請切換科目後重新比對。`
      : "請展開有疑義的項目，核對題幹與選項是否完整。";
    $("courseMismatchText").textContent = courseSuggestion ? scopeHint : "";
    $("switchCourse").textContent = `改用${names[otherCourse]}比對`;
    const unmatchedLabel = courseSuggestion
      ? "此科目未找到"
      : !snapshotCoverage
        ? "未找到"
        : snapshotUnit === "all"
          ? "未收錄"
          : "此範圍未找到";
    $("resultCount").textContent =
      `共 ${results.length} 題・${names[snapshotCourse]}・已收錄 ${count("matched")}・${unmatchedLabel} ${count("unmatched")}・需確認 ${count("review")}`;
    $("expandScope").hidden = !results.some((r) => r.outsideScope);
    $("coverageNotice").hidden = snapshotCoverage;
    $("coverageNotice").textContent =
      "公開投稿題庫尚未同步。本次結果只涵蓋內建題庫，「未找到」不代表網站一定未收錄，請重新同步後核對。";
    $("resultFilter").querySelector('[value="unmatched"]').textContent =
      unmatchedLabel;
    $("copyUnmatched").textContent = `複製${unmatchedLabel}題目給 AI`;
    $("staleNotice").textContent =
      "文字、科目或範圍已變更，請重新比對。下方保留的是上一批結果。";
    $("resultFilter").value = "all";
    $("results").hidden = false;
    $("copyFallback").hidden = true;
    $("copyHelp").hidden = true;
    renderResults();
    markChanged();
    message(
      `已辨識 ${parsed.length} 題。${warnings.length ? warnings.join(" ") + " " : ""}${scopeHint}`,
    );
    $("resultsHeading").focus({ preventScroll: true });
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    message(error.message, true);
    if (error.mapping) importUI.showError(error);
  }
});
async function copy(text) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard");
    await navigator.clipboard.writeText(text);
    $("copyFallback").hidden = true;
    $("copyHelp").hidden = true;
    message("已複製，可直接貼到 AI 或筆記。");
  } catch {
    $("copyFallback").value = text;
    $("copyFallback").hidden = false;
    $("copyHelp").hidden = false;
    $("copyFallback").focus();
    $("copyFallback").select();
    message("請複製已選取的文字。");
  }
}
$("copyAnswers").addEventListener("click", () => {
  if (isStale() || loading || !index) return;
  const text =
    `${names[snapshotCourse]}・答案總表\n` +
    (!snapshotCoverage ? "注意：投稿題庫未同步，僅比對內建題庫。\n" : "") +
    (courseSuggestion
      ? `注意：這批有 ${courseSuggestion.count} 題在${names[courseSuggestion.course]}找到一致原題，請切換科目重新比對；以下僅為${names[snapshotCourse]}範圍結果。\n`
      : "") +
    results
      .map(
        (r) =>
          `${r.question.number}｜${r.answer || "尚無可確認答案"}｜${statusLabel(r)}` +
          (r.outsideScope ? `（${unitNames(r)}）` : "") +
          (r.conditions?.length
            ? `\n  成立條件：${r.conditions.join("；")}`
            : ""),
      )
      .join("\n");
  copy(text);
});
for (const id of ["copyUnmatched", "copyReview"])
  $(id).addEventListener("click", () => {
    if (!isStale() && !loading && index)
      copy(aiPrompt(copyItems(id).map((r) => r.question)));
  });
$("transferUnmatched").addEventListener("click", () => {
  if (isStale() || loading || !index || courseSuggestion) return;
  try {
    stageUnmatched(results, { course: snapshotCourse, unit: snapshotUnit }, localStorage);
    location.href = "submit.html?v=draft-transfer-20261020#pendingHeading";
  } catch (error) {
    message(`未能轉入投稿草稿：${error.message}。題目仍保留在本頁，可先複製備份。`, true);
  }
});
$("expandScope").addEventListener("click", () => {
  $("unit").value = "all";
  markChanged();
  $("batchForm").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
});
$("switchCourse").addEventListener("click", () => {
  if (!courseSuggestion || isStale() || loading || !index) return;
  $("course").value = courseSuggestion.course;
  restoreUnit = null;
  units();
  $("unit").value = "all";
  libraryStatus();
  markChanged();
  $("batchForm").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
});
$("copyTranscription").addEventListener("click", () =>
  copy(
    "請將圖片中的課程練習題抄成純文字，不要解答。每題用「1. 題幹」開頭，保留原始題號；每個選項獨立一行，使用 A.、B.、C. 等代號。保留題型、否定詞、數學大小寫、指數、程式碼及填空位置。不要改寫題目，不要加答案或解析。看不清楚請標示 [看不清楚]；需要圖片才能解答時標示 [題圖未轉錄]。每批最多 30 題。",
  ),
);
$("resultFilter").addEventListener("change", renderResults);
$("batchText").addEventListener("input", markChanged);
$("course").addEventListener("change", () => {
  restoreUnit = null;
  units();
  if (index) libraryStatus();
  markChanged();
});
$("unit").addEventListener("change", markChanged);
$("reloadLibrary").addEventListener("click", loadLibrary);
$("clearInput").addEventListener("click", () => {
  $("batchText").value = "";
  markChanged();
  $("batchText").focus();
  message("已清空輸入文字。");
});
try {
  const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
  if (
    draft &&
    typeof draft.text === "string" &&
    draft.text.length <= MAX_TEXT
  ) {
    $("batchText").value = draft.text;
    if (!names[selectedCourse] && names[draft.course])
      $("course").value = draft.course;
    if (
      (!names[selectedCourse] || selectedCourse === draft.course) &&
      typeof draft.unit === "string"
    )
      restoreUnit = draft.unit;
  }
} catch {}
units();
const importUI = setupBatchImport({ document, onApply: markChanged });
markChanged();
loadLibrary();
