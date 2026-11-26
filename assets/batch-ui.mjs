import "./question-sync.js?v=consistency-20261126";
import './sync-summary.js?v=flow-clarity-20261103';
import {createUnitCatalog} from './unit-catalog.mjs?v=admin-units-20261103';
import {comparisonMarkup,mismatchLabel} from './question-comparison.mjs?v=workflow-improvements-20261102';
import {fingerprintLibraryImages, inheritQuestionImages, validImageHashes} from "./batch-images.mjs?v=complete-batch-snapshot-20261120";
import {unitLabel} from './contribution-model.js?v=treasure-unit-20261030';
import {
  buildIndex,
  matchRecordedQuestions,
  expandLibraryQuestion,
  applyBuiltinOverrides,
  MAX_TEXT,
  normalizeText,
} from "./batch-model.mjs?v=numeric-sequence-format-20261122";
import { parseBatchInput } from "./batch-import.mjs?v=quiz-course-transfer-20261125";
import { setupBatchImport } from "./batch-import-ui.mjs?v=quiz-course-transfer-20261125";
import {checkResponse,responseKey} from './batch-response.mjs?v=response-check-20261125';
import { stageUnmatched } from "./submission-inbox.mjs?v=draft-transfer-20261020";
const $ = (id) => document.getElementById(id);
function ensureTransferButton() {
  let button = $("transferUnmatched");
  if (button) return button;
  const copyButton = $("copyAnswers");
  if (!copyButton?.parentElement) return null;
  const orphanText = copyButton.nextSibling;
  if (
    orphanText?.nodeType === 3 &&
    orphanText.textContent.trim() === "轉入投稿草稿"
  )
    orphanText.remove();
  button = document.createElement("button");
  button.id = "transferUnmatched";
  button.type = "button";
  button.className = "button secondary";
  button.disabled = true;
  button.textContent = "補答案並分享未收錄題目";
  copyButton.insertAdjacentElement("afterend", button);
  return button;
}
const transferButton = ensureTransferButton();
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let unitStorage;try{unitStorage=globalThis.localStorage;}catch{}
const unitCatalog=createUnitCatalog(unitStorage), syncChanges=new Map();
const names = { os: "作業系統", algorithms: "演算法" };
const courses = Object.keys(names);
const labels = { matched: "已收錄", unmatched: "未收錄" };
const draftKey = "course-library.batch-draft.v1";
let imageQuestions = [];
let importedCourse = null, comparisonRequest = 0;
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
if (Object.hasOwn(names, selectedCourse)) $("course").value = selectedCourse;
function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
  $("message").hidden = !text;
}
function scope() {
  return { course: $("course").value, unit: $("unit").value };
}
function currentSnapshot() {
  return JSON.stringify({ ...scope(), scopePreference: 1, text: $("batchText").value, imageQuestions, importedCourse });
}
function units() {
  const previous = $("unit").value;
  const course = $("course").value;
  $("unit").innerHTML =
    '<option value="all">全部單元</option>' +
    (names[course] ? unitCatalog.list(course) : [])
      .map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`)
      .join("");
  if ([...$("unit").options].some((o) => o.value === previous))
    $("unit").value = previous;
  if (library && restoreUnit) {
    if ([...$("unit").options].some((o) => o.value === restoreUnit))
      $("unit").value = restoreUnit;
    restoreUnit = null;
  }
  $("unit").disabled = course === "auto";
  document.body.dataset.course = names[course] ? course : "os";
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
  $("copyAnswers").disabled = stale || loading || !index || !results.length;
  const unmatchedCount = results.filter((r) => r.status === "unmatched").length;
  if (transferButton) {
    transferButton.disabled = stale || loading || !index || !snapshotCoverage || !unmatchedCount || !!courseSuggestion;
    transferButton.textContent = `轉入投稿草稿${unmatchedCount ? `（${unmatchedCount} 題）` : ""}`;
    $("transferCourseStep").hidden = transferButton.disabled || !!snapshotCourse;
    $("onlyUnmatched").hidden = !unmatchedCount;
  }
  $("inputCount").textContent =
    `${$("batchText").value.length.toLocaleString()} / ${MAX_TEXT.toLocaleString()} 字・最多 30 題`;
  try {
    localStorage.setItem(
      draftKey,
      currentSnapshot(),
    );
  } catch {}
}
function statusLabel(row) { return row.status === "unmatched" && !snapshotCoverage ? "待同步" : labels[row.status]; }
let snapshotCoverage = false;
let snapshotUnit = "all";
let restoreUnit = null;
const publicFlights = new Map(), publicData = new Map(), publicEtags = new Map(), syncedAt = new Map(), syncFailures = new Set();
const publicDates = new Map();
let baseLibrary, basePromise;
function libraryStatus() {
  const course = $("course").value;
  if (course === "auto") {
    $("libraryStatus").textContent = publicFlights.size
      ? "正在同步這次查詢所需的題庫。"
      : "查詢時會依題目判斷科目，並比對全部單元。";
    $("libraryStatus").dataset.syncState = publicFlights.size ? "syncing" : "ready";
    return;
  }
  const count = new Set(
    (index?.entries || []).filter((e) => e.course === course).map((e) => e.id),
  ).size;
  $("libraryStatus").textContent =
    `${names[course]}：${count} 題可供比對。` +
    (publicFlights.has(course)
      ? "正在確認最新變更，現在可先使用已載入題庫。"
      : syncFailures.has(course)
        ? "同步失敗，"+(invalidPublicData[course]?"線上題庫資料不完整；":"")+(publicData.has(course)?"目前使用已保存的公開題庫版本":"目前僅比對隨站內建版本")+"；尚未確認最新修改及下架狀態。請按「重新同步題庫」重試。"
      : coverage[course]
      ? "已同步內建題修改與公開投稿題庫。" + (syncChanges.get(course) || "") + (syncedAt.has(course) ? " 最後同步：" + new Date(syncedAt.get(course)).toLocaleTimeString("zh-TW") : "")
      : syncing
        ? "正在同步公開投稿，現在可先比對內建題庫。"
      : invalidPublicData[course]
        ? "線上題庫資料不完整，目前僅比對隨站內建版本。可按「重新同步題庫」重試。"
      : publicData.has(course)
        ? "暫時無法確認最新變更，目前使用上次題庫快取；請重新同步後核對。"
      : "線上題庫暫時無法同步，目前僅比對隨站內建版本。可按「重新同步題庫」重試。");
  const state=publicFlights.has(course)?'syncing':syncFailures.has(course)?'failed':coverage[course]?'synced':publicData.has(course)?'cache':'builtin';
  $('libraryStatus').dataset.syncState=state;
  const missingImages=new Set((index?.entries || []).filter(e=>e.course===course && e.imageUnavailable).map(e=>e.id)).size;
  if(missingImages && !publicFlights.has(course)) $("libraryStatus").textContent += ' 有 '+missingImages+' 題的題庫圖片暫時無法讀取，請重新同步；這不代表題目未收錄。';
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
const publicCacheKey = course => "course-library.questions.v1." + course;
function restorePublicCache(course) {
  if (publicData.has(course)) return;
  try {
    const cached = JSON.parse(localStorage.getItem(publicCacheKey(course)) || "null");
    if (cached?.schema !== 1 || cached.course !== course || !Array.isArray(cached.data?.questions) || !Array.isArray(cached.data?.overrides)) return;
    if (window.courseQuestionSync && !window.courseQuestionSync.validData(cached.data)) return;
    const time = Date.parse(cached.generatedAt);
    if (!Number.isFinite(time) || time > Date.now() + 300000) return;
    publicData.set(course, cached.data);
    publicDates.set(course, time);
    if (/^(?:W\/)?".*"$/.test(cached.etag || "")) publicEtags.set(course, cached.etag);
  } catch {}
}
function rebuildLibraryIndex() {
  if (!baseLibrary) return;
  library = { ...baseLibrary, courses: Object.fromEntries(Object.entries(baseLibrary.courses).map(([course, data]) => [course, {...data, units:data.units.map(u=>({...u,name:unitLabel(course,u.id,String(u.name || '').replace(/^L\d+ · /,''))}))}])) };
  let entries = baseLibrary.entries.slice();
  const curatedAliasIds = new Set(baseLibrary.curatedAliasIds || []);
  for (const [course, data] of publicData) {
    try {
      const additions = [], newUnits = new Map(), overrides = data.overrides || [];
      for (const row of data.questions) {
        const raw = row?.question, questionId = raw?.id || raw?.bookmarkId;
        if ((!library.courses[course].units.some(u => u.id === row?.unit) && !/^L[1-9]\d?$/.test(row?.unit)) ||
            !validPublicQuestion(raw) || !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(questionId || "")) throw Error("public-data");
        if (curatedAliasIds.has(questionId) || baseLibrary.entries.some(e => e.course === course && e.id === questionId)) continue;
        if (!library.courses[course].units.some(u => u.id === row.unit)) newUnits.set(row.unit, {id:row.unit,name:unitLabel(course,row.unit,raw.unitTitle)});
        const expanded = expandLibraryQuestion(course,row.unit,raw);
        if (!expanded.length) throw Error("public-data");
        additions.push(...expanded);
      }
      if (overrides.some(row => row?.deleted !== true && !validPublicQuestion(row?.question))) throw Error("builtin-data");
      const candidate = [...applyBuiltinOverrides(entries,course,overrides),...additions];
      // Validate an entire course before replacing any usable records.
      buildIndex(candidate);
      entries = candidate;
      library.courses[course].units.push(...newUnits.values());
      if(Array.isArray(data.units)){
        const unitMeta=new Map(data.units.map(u=>[u.id,u]));
        library.courses[course].units=library.courses[course].units.map(u=>({...u,name:unitMeta.get(u.id)?.label||u.name}));
        unitCatalog.update(course,data.units);
      }
      invalidPublicData[course] = false;
    } catch {
      invalidPublicData[course] = true;
      coverage[course] = false;
    }
  }
  index = buildIndex(entries);
  libraryGeneration++;
  for(const [course,data] of Object.entries(library.courses)) unitCatalog.update(course,publicData.get(course)?.units || data.units.map(unit=>({id:unit.id,title:unit.name.replace(/^L\d+ · /,'')})));
  units();
}
async function getBaseLibrary() {
  if (baseLibrary) return baseLibrary;
  if (!basePromise) basePromise = fetch("assets/batch-library.json?v=complete-batch-snapshot-20261120", {signal:AbortSignal.timeout(12000)})
    .then(async response => {
      if (!response.ok) throw Error("library");
      const data = await response.json();
      if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || !data.courses?.os || !data.courses?.algorithms) throw Error("library");
      for (const course of courses) {
        restorePublicCache(course);
        const bundled = data.publicSnapshots?.[course];
        const time = Date.parse(bundled?.generatedAt || "");
        if (Number.isFinite(time) && time <= Date.now() + 300000 && time >= (publicDates.get(course) ?? 0) &&
            Array.isArray(bundled.data?.questions) && Array.isArray(bundled.data?.overrides) && (!window.courseQuestionSync || window.courseQuestionSync.validData(bundled.data))) {
          publicData.set(course, bundled.data);
          publicDates.set(course, time);
          publicEtags.delete(course);
        }
      }
      return baseLibrary = data;
    }).catch(error => { basePromise = null; throw error; });
  return basePromise;
}
async function loadLibrary(course = $("course").value, force = false) {
  if (course === "auto") return Promise.all(courses.map(name => loadLibrary(name, force)));
  if (publicFlights.has(course)) return publicFlights.get(course);
  if (!force && coverage[course] && Date.now() - syncedAt.get(course) < 60000) return;
  restorePublicCache(course);
  const requestStamp = window.courseQuestionSync?.stamp(course);
  const requestedData = publicData.get(course), requestedEtag = publicEtags.get(course);
  const firstLoad = !index;
  loading = firstLoad;
  if (firstLoad) $("libraryStatus").textContent = "正在載入內建題庫……";
  $("compare").disabled = firstLoad;
  $("reloadLibrary").disabled = true;
  syncing = true;
  let needsRefresh = false;
  const task = (async () => {
    const publicRequest = fetch(window.courseContributions.apiOrigin + "/api/questions?course=" + course, {
      signal:AbortSignal.timeout(6000), cache:"no-cache",
      headers:requestedEtag ? {"If-None-Match":requestedEtag} : {},
    }).then(async response => {
      if (response.status === 304 && requestedEtag && requestedData) return {data:requestedData,etag:requestedEtag};
      if (!response.ok) throw Error("public");
      const data = await response.json();
      if (!Array.isArray(data.questions) || !Array.isArray(data.overrides || [])) throw Error("public-data");
      const etag = response.headers?.get?.("etag");
      return {data,etag:/^(?:W\/)?".*"$/.test(etag || "") ? etag : null};
    }).then(value => ({value}), error => ({error}));
    try {
      await getBaseLibrary();
      const fallback = publicData.get(course);
      const previousFallback = fallback && JSON.stringify(fallback);
      if (fallback) await fingerprintLibraryImages(fallback);
      if (!index || fallback && previousFallback !== JSON.stringify(fallback)) rebuildLibraryIndex();
      loading = false;
      $("compare").disabled = false;
      libraryStatus();
      markChanged();
      const before=globalThis.courseSyncSummary.snapshot((index?.entries||[]).filter(entry=>entry.course===course));
      const result = await publicRequest;
      if (result.error) throw result.error;
      const {data,etag} = result.value;
      if (requestStamp !== window.courseQuestionSync?.stamp(course)) {
        needsRefresh = true;
        return;
      }
      if (window.courseQuestionSync && !window.courseQuestionSync.validData(data)) throw Error('public-data');
      await fingerprintLibraryImages(data);
      if (requestStamp !== window.courseQuestionSync?.stamp(course)) { needsRefresh = true; return; }
      const previous = publicData.get(course);
      const changed = JSON.stringify(previous) !== JSON.stringify(data);
      if (changed) {
        publicData.set(course,data);
        rebuildLibraryIndex();
        if (invalidPublicData[course]) {
          if (previous) publicData.set(course, previous); else publicData.delete(course);
          rebuildLibraryIndex();
          throw Error("public-data");
        }
      } else if (invalidPublicData[course]) throw Error("public-data");
      if (etag) publicEtags.set(course,etag); else publicEtags.delete(course);
      coverage[course] = true;
      publicDates.set(course, Date.now());
      syncChanges.set(course,globalThis.courseSyncSummary.describe(before,globalThis.courseSyncSummary.snapshot(index.entries.filter(entry=>entry.course===course))));
      syncFailures.delete(course);syncedAt.set(course,Date.now());
      try { localStorage.setItem(publicCacheKey(course), JSON.stringify({schema:1,course,generatedAt:new Date().toISOString(),data,etag})); } catch {}
      if (changed && results.length) $("staleNotice").textContent = "題庫比對資料已更新，請重新比對。下方保留的是上一批結果。";
    } catch (error) {
      syncFailures.add(course);coverage[course] = false;
      if (error.message === "public-data") invalidPublicData[course] = true;
      if (!index) $("libraryStatus").textContent = "無法載入內建題庫，貼上的文字仍保留。請確認網路後重新同步。";
    } finally {
      publicFlights.delete(course);
      syncing = publicFlights.size > 0;
      loading = !index;
      $("compare").disabled = !index;
      $("reloadLibrary").disabled = $("course").value === "auto" ? publicFlights.size > 0 : publicFlights.has($("course").value);
      if (index) libraryStatus();
      markChanged();
      if (needsRefresh) void loadLibrary(course,true);
    }
  })();
  publicFlights.set(course,task);
  if (index) libraryStatus();
  return task;
}

function sourceURL(ref) {
  return (
    (ref.course === "os" ? "os.html" : "algorithms.html") +
    "?question=" +
    encodeURIComponent(ref.id)
  );
}
let snapshotCourse = "os";
let snapshotScopeLabel = names.os;
function unitNames(row) {
  return [
    ...new Set(
      row.references.map(
        (ref) => {
          const unit = library.courses[ref.course]?.units.find((u) => u.id === ref.unit)?.name || ref.unit;
          return names[ref.course] ? `${names[ref.course]}・${unit}` : unit;
        },
      ),
    ),
  ].join("、");
}
function candidateComparison(row) {
  if(row.status==='matched')return '';
  return `<p class="mismatch-reason"><strong>${snapshotCoverage ? "未收錄原因" : "快照比對結果"}：${esc(mismatchLabel(row))}</strong></p>`+(row.references||[]).map(ref=>{
    const candidate=index?.entries.find(e=>e.course===ref.course&&e.id===ref.id&&e.stem===ref.stem);
    return candidate?`<details class="candidate-comparison"><summary>並排核對 ${esc(ref.id)}</summary>${comparisonMarkup(row.question,candidate,{rightTitle:'候選版本 '+ref.id,reason:row.reason})}</details>`:'';
  }).join('');
}
function combineCourseMatches(questions) {
  const [os, algorithms] = courses.map(course => matchRecordedQuestions(questions, index, {course}));
  return os.map((first, i) => {
    const rows = [first, algorithms[i]];
    const matched = rows.filter(row => row.status === "matched");
    if (!matched.length) {
      const candidate = rows.find(row => row.exactConflict) || rows.find(row => row.references.length) || first;
      return {...candidate, references: rows.flatMap(row => row.references)};
    }
    const signature = row => JSON.stringify([row.choiceKey || normalizeText(row.answer), [...new Set(row.conditions.map(normalizeText))].sort()]);
    if (!rows.some(row => row.exactConflict) && new Set(matched.map(signature)).size === 1) {
      return {...matched[0], references: matched.flatMap(row => row.references)};
    }
    return {
      question: first.question, status: "unmatched", answer: "", exactConflict: true,
      reason: "兩科都找到符合的題目，但答案或成立條件無法確認一致，請核對下方原題。",
      references: rows.flatMap(row => row.references.map(ref =>
        row.status === "matched" ? {...ref, candidateAnswer: row.answer} : ref)),
    };
  });
}
function bankAnswer(row) {
  if (row.choiceKey?.length > 1) {
    return row.question.options
      .filter(({ label }) => row.choiceKey.includes(label))
      .map(({ label, text }) => esc(label + ". " + text))
      .join("<br>");
  }
  return esc(row.answer || "尚無可確認答案");
}
function renderAnswer(row) {
  if($("answerMode").value!=='check')return bankAnswer(row);
  const response=imageQuestions.find(q=>responseKey(q)===responseKey(row.question))?.savedResponse;
  const check=checkResponse(row,response);
  const yours=response?.kind==='choice' ? response.values.map(label=>{
    const option=row.question.options.find(o=>o.label===label);
    return label+'. '+(option?.text || '');
  }).join('\n') : response?.values.map((value,i)=>`${response.values.length>1?'第 '+(i+1)+' 格：':''}${value || '未填'}`).join('\n');
  return `<strong>${esc(check.label)}</strong><p>你的答案：<br>${esc(yours || '未作答').replace(/\n/g,'<br>')}</p><p>題庫答案：<br>${bankAnswer(row)}</p>`+
    (check.slots.length>1?check.slots.map((slot,i)=>`<p>第 ${i+1} 格：${slot.same?'符合':!slot.value?'未填':'文字不同'}；題庫：${esc(slot.answer)}</p>`).join(''):'');
}
function renderResults() {
  const filter = $("resultFilter").value;
  $("onlyUnmatched").setAttribute('aria-pressed',String(filter === 'unmatched'));
  $("onlyUnmatched").textContent = filter === 'unmatched' ? '顯示全部結果' : snapshotCoverage ? '只看未收錄' : '只看待同步';
  const checking=$("answerMode").value==='check';
  const checks=results.map(row=>checkResponse(row,imageQuestions.find(q=>responseKey(q)===responseKey(row.question))?.savedResponse));
  $("responseFilterField").hidden=!checking;
  $("responseSummary").hidden=!checking;
  $("resultsHeading").textContent=checking?'作答核對結果':'答案總表';
  $("responseSummary").textContent=`共 ${results.length} 題：符合 ${checks.filter(c=>c.status==='same').length} 題、不同 ${checks.filter(c=>c.status==='different').length} 題、未作答或未填完整 ${checks.filter(c=>c.status==='unanswered').length} 題、無法確認 ${checks.filter(c=>c.status==='unknown').length} 題。填空依題庫文字核對；其他正確寫法請對照原題與解析確認。`;
  const shown = results.filter((r,i) => (filter === "all" || r.status === filter) && (!checking || !$("responseOnlyProblems").checked || checks[i].status!=='same'));
  $("resultRows").innerHTML = shown
    .map(
      (row) =>
        `<tr><th scope="row">${esc(row.question.number)}</th><td class="answer-text">${renderAnswer(row)}${row.conditions?.length ? `<p class="answer-condition"><strong>成立條件</strong><br>${row.conditions.map(esc).join("<br>")}</p>` : ""}</td><td><span class="result-badge ${row.status}">${esc(statusLabel(row))}</span></td><td><details class="question-detail"><summary>${esc(row.question.stem.slice(0, 90) || "缺少題幹")}</summary><p>${esc(row.question.stem)}</p>${row.question.options.length ? "<ul>" + row.question.options.map((o) => `<li>${esc(o.label)}. ${esc(o.text)}</li>`).join("") + "</ul>" : ""}<p>${esc(row.reason)}</p>${candidateComparison(row)}${row.references.length ? '<ul class="source-links">' + row.references.map((ref) => `<li><a href="${sourceURL(ref)}" target="_blank" rel="noopener">${esc(names[ref.course])}・${esc(ref.id)}・開啟${row.status === "matched" ? "收錄" : "候選"}原題 ↗</a>${ref.candidateAnswer!==undefined?`<p>此版本答案：${esc(ref.candidateAnswer||"尚未提供")}</p>`:""}</li>`).join("") + "</ul>" : ""}</details></td></tr>`,
    )
    .join("");
  $("emptyResults").hidden = shown.length > 0;
}
const incompleteCoverage = "部分公開題庫尚未完成同步，目前使用可取得的題庫版本。尚未找到答案的題目會標示為待同步。";
async function compare({waitForManualSync = false, forceSync = false} = {}) {
  const selected = scope();
  const automatic = selected.course === "auto";
  if (!automatic && !waitForManualSync && (!index || loading)) return;
  const request = ++comparisonRequest;
  const expected = currentSnapshot();
  try {
    const {questions: rawParsed, warnings, courseHint} = parseBatchInput(
      $("batchText").value,
    );
    const parsed = inheritQuestionImages(rawParsed,imageQuestions);
    const chosenCourse = automatic ? courseHint || importedCourse : selected.course;
    const searchedCourses = chosenCourse ? [chosenCourse] : courses;
    if (automatic || waitForManualSync) {
      if (forceSync || !searchedCourses.every(course => !publicFlights.has(course) && coverage[course] && Date.now() - syncedAt.get(course) < 60000)) {
        message("正在準備題庫並查詢答案……");
        await Promise.all(searchedCourses.map(course => loadLibrary(course, forceSync)));
      }
      if (request !== comparisonRequest || currentSnapshot() !== expected) return;
    }
    if (!index) throw new Error("題目已保留，題庫尚未載入；請重新同步後查題。");
    $("resultImageHelp").hidden=!parsed.some(q=>q.stem.includes('[題圖未轉錄]') && !validImageHashes(q.imageHashes));
    if (parsed.some(q=>validImageHashes(q.imageHashes)) && searchedCourses.some(course=>publicFlights.has(course))) throw new Error("題庫圖片仍在同步，請等同步完成後再比對；題目與圖片資料已保留。");
    results = chosenCourse
      ? matchRecordedQuestions(parsed, index, {course:chosenCourse,unit:selected.unit})
      : combineCourseMatches(parsed);
    snapshot = currentSnapshot();
    snapshotGeneration = libraryGeneration;
    snapshotCoverage = searchedCourses.every(course => coverage[course]);
    snapshotCourse = chosenCourse || null;
    snapshotUnit = selected.unit;
    snapshotScopeLabel = automatic ? (chosenCourse ? `${names[chosenCourse]}・全部單元` : "自動比對兩科・全部單元") : names[chosenCourse];
    const count = (status) => results.filter((r) => r.status === status).length;
    const otherCourse = chosenCourse === "os" ? "algorithms" : "os";
    const otherMatches = automatic ? 0 : matchRecordedQuestions(parsed, index, {
      course: otherCourse,
    }).filter((r) => r.status === "matched").length;
    courseSuggestion =
      otherMatches >= 2 && otherMatches > count("matched")
        ? { course: otherCourse, count: otherMatches }
        : null;
    const scopeHint = courseSuggestion
      ? `目前比對科目為「${names[snapshotCourse]}」，這批有 ${otherMatches} 題在「${names[otherCourse]}」找到一致原題。請切換科目後重新比對。`
      : snapshotCoverage && !snapshotCourse && count("unmatched")
        ? "要轉入投稿草稿時，請在答案總表選擇投稿科目。"
        : "請展開有疑義的項目，核對題幹與選項是否完整。";
    $("courseMismatchText").textContent = courseSuggestion ? scopeHint : "";
    $("switchCourse").textContent = `改用${names[otherCourse]}比對`;
    const unmatchedLabel = snapshotCoverage ? "未收錄" : "待同步";
    $("resultCount").textContent =
      `共 ${results.length} 題・${snapshotScopeLabel}・已收錄 ${count("matched")}・${unmatchedLabel} ${count("unmatched")}`;
    $("expandScope").hidden = !results.some((r) => r.outsideScope);
    $("coverageNotice").hidden = snapshotCoverage;
    $("coverageNotice").textContent = incompleteCoverage;
    $("resultFilter").querySelector('[value="unmatched"]').textContent =
      unmatchedLabel;
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
    return true;
  } catch (error) {
    if (request !== comparisonRequest || currentSnapshot() !== expected) return;
    message(error.message, true);
    if (error.mapping) importUI.showError(error);
  }
}
$("batchForm").addEventListener("submit", event => {
  event.preventDefault();
  void compare();
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
    `${snapshotScopeLabel}・答案總表\n` +
    (!snapshotCoverage ? `注意：${incompleteCoverage}\n` : "") +
    (courseSuggestion
      ? `注意：這批有 ${courseSuggestion.count} 題在${names[courseSuggestion.course]}找到一致原題，請切換科目重新比對；以下僅為${names[snapshotCourse]}範圍結果。\n`
      : "") +
    results
      .map(
        (r) =>
          `${r.question.number}｜${r.answer || "尚無可確認答案"}｜${statusLabel(r)}` +
          (r.references.some(ref=>ref.candidateAnswer!==undefined)?'\n  候選版本：'+r.references.map(ref=>ref.id+'：'+(ref.candidateAnswer||'尚未提供')).join('；'):'') +
          (r.status === "matched" && r.references.length ? `（${unitNames(r)}）` : "") +
          (r.conditions?.length
            ? `\n  成立條件：${r.conditions.join("；")}`
            : ""),
      )
      .join("\n");
  copy(text);
});
transferButton?.addEventListener("click", async () => {
  if (transferButton.disabled || isStale()) return;
  if (!snapshotCourse) {
    const course = $("transferCourse").value;
    if (!Object.hasOwn(names, course)) {
      $("transferCourse").focus();
      return;
    }
    $("course").value = course;
    restoreUnit = null;
    units();
    $("unit").value = "all";
    markChanged();
    if (!await compare({waitForManualSync:true}) || snapshotCourse !== course || isStale()) return;
    if (transferButton.disabled) {
      if (snapshotCoverage && !count("unmatched")) message("重新比對後，本批題目皆已收錄。");
      return;
    }
  }
  try {
    stageUnmatched(results, { course: snapshotCourse, unit: snapshotUnit }, localStorage);
    location.href = window.courseTheme?.href("submit.html?v=draft-transfer-20261020#pendingHeading") || "submit.html?v=draft-transfer-20261020#pendingHeading";
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
  loadLibrary();
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
$("onlyUnmatched").addEventListener('click',()=>{
  $("resultFilter").value = $("resultFilter").value === 'unmatched' ? 'all' : 'unmatched';
  renderResults();
});
$("batchText").addEventListener("input", () => {
  importedCourse = null;
  markChanged();
});
$("course").addEventListener("change", () => {
  restoreUnit = null;
  units();
  if (index) libraryStatus();
  if ($("course").value !== "auto") loadLibrary();
  markChanged();
});
$("unit").addEventListener("change", markChanged);
function refreshLibrary() {
  if (snapshot && snapshot === currentSnapshot()) return compare({waitForManualSync:true, forceSync:true});
  return loadLibrary($("course").value, true);
}
$("reloadLibrary").addEventListener("click", refreshLibrary);
window.addEventListener?.("online", () => {
  if (!snapshotCoverage && snapshot === currentSnapshot()) void refreshLibrary();
});
$("clearInput").addEventListener("click", () => {
  imageQuestions = [];
  importedCourse = null;
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
    imageQuestions = Array.isArray(draft.imageQuestions) ? draft.imageQuestions.filter(q=>validImageHashes(q.imageHashes) || q.savedResponse).slice(0,30) : [];
    importedCourse = Object.hasOwn(names, draft.importedCourse) ? draft.importedCourse : null;
    if (!Object.hasOwn(names, selectedCourse) && draft.scopePreference === 1 && Object.hasOwn(names, draft.course))
      $("course").value = draft.course;
    if (
      $("course").value === draft.course &&
      typeof draft.unit === "string"
    )
      restoreUnit = draft.unit;
  }
} catch {}
units();
const importUI = setupBatchImport({ document, autoApply:true, getImageQuestions:()=>imageQuestions, onApply:(result,{autoCompare=false}={})=>{
  imageQuestions=result.questions.filter(q=>validImageHashes(q.imageHashes) || q.savedResponse);
  importedCourse=result.courseHint || null;
  markChanged();
  if(autoCompare) void compare({waitForManualSync:true});
} });
markChanged();
function updateAnswerMode(){
  const checking=$("answerMode").value==='check';
  $("responseHelp").hidden=!checking;
  if(results.length)renderResults();
}
$("answerMode").addEventListener('change',updateAnswerMode);
$("chooseBatchFiles").addEventListener('click',()=>{$("answerMode").value='lookup';updateAnswerMode();},{capture:true});
$("chooseResponseFile").addEventListener('click',()=>{
  $("answerMode").value='check';
  updateAnswerMode();
  $("batchFiles").click();
});
$("responseOnlyProblems").addEventListener('change',renderResults);
if ($("course").value === "auto") {
  void getBaseLibrary().then(() => {
    if (!index) rebuildLibraryIndex();
    $("compare").disabled = false;
    libraryStatus();
    markChanged();
  }).catch(() => {
    if (!index) $("libraryStatus").textContent = "無法載入內建題庫，請重新同步。";
  });
} else loadLibrary();

window.courseQuestionSync?.subscribe(course => {
  if (!courses.includes(course)) return;
  coverage[course] = false;
  void loadLibrary(course,true);
});
window.addEventListener?.('focus', () => { void loadLibrary($("course").value, true); });
