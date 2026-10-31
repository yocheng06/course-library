import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { setupBatchImport } from "../assets/batch-import-ui.mjs";
import { toLibraryQuestion } from "../assets/batch-model.mjs";

const html = await readFile(new URL("../batch.html", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const file = (name, raw) => ({
  name,
  size: Buffer.byteLength(raw),
  arrayBuffer: async () => new TextEncoder().encode(raw).buffer,
});
const rawQuestion = {
  stem: "CPU 排程器是哪一種類型的排程器？",
  options: ["A. 短程排程器", "B. 長程排程器"],
  answer: "B",
};
function dom() {
  const { document, window } = parseHTML(html);
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() {
      return (
        this.querySelector("option[selected]")?.value ??
        this.querySelector("option")?.value ??
        ""
      );
    },
    set(value) {
      for (const option of this.querySelectorAll("option"))
        option.toggleAttribute("selected", option.value === value);
    },
  });
  let focused = null;
  window.HTMLElement.prototype.focus = function () {
    focused = this.id;
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const $ = (id) => document.getElementById(id);
  const fire = (id, event) =>
    $(id).dispatchEvent(
      new window.Event(event, { bubbles: true, cancelable: true }),
    );
  const choose = async (files) => {
    $("batchFiles").files = files;
    fire("batchFiles", "change");
    await tick();
  };
  return { document, window, $, fire, choose, focused: () => focused };
}

test('large saved HTML previews without changing text, and an oversized retry retains the draft',async()=>{
  const ui=dom();
  setupBatchImport({document:ui.document,onApply:()=>{}});
  ui.$('batchText').value='1. 原本的題目 ______';
  const raw='<!--'+'x'.repeat(2200000)+'--><script id="question-data" type="application/json">'+JSON.stringify([rawQuestion])+'</script>';
  await ui.choose([file('large-exam.html',raw)]);
  assert.equal(ui.$('importPreview').hidden,false);
  assert.equal(ui.$('batchText').value,'1. 原本的題目 ______');
  await ui.choose([{...file('too-large.html',''),size:21*1024*1024}]);
  assert.match(ui.$('importStatus').textContent,/20 MB/);
  assert.equal(ui.$('batchText').value,'1. 原本的題目 ______');
  assert.equal(ui.$('importPreview').hidden,true);
});

test('image-folder selection passes verified image identity through preview, apply and append', async () => {
  const ui=dom();let saved=[];
  setupBatchImport({document:ui.document,getImageQuestions:()=>saved,onApply:result=>{saved=result.questions;}});
  const data=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3sAAAAASUVORK5CYII=','base64');
  ui.$('batchImageFolder').files=[{name:'chart.png',size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer}];
  ui.fire('batchImageFolder','change');
  assert.match(ui.$('importStatus').textContent,/已選取 1 個圖片檔/);
  const raw='<form id="challenge-quiz-form"><div class="question-block group-block"><div class="group-stem"><img src="quiz_files/chart.png"></div><div class="sub-question-block"><p class="question-text">1. 計算結果<input type="text" class="text-answer"></p></div></div></form>';
  await ui.choose([file('quiz.html',raw)]);
  for(let i=0;i<50 && ui.$('importPreview').hidden;i++)await tick();
  assert.equal(ui.$('importPreview').hidden,false);
  assert.match(ui.$('importList').textContent,/已讀取題圖 1 張/);
  ui.fire('applyImport','click');
  assert.equal(saved[0].imageHashes[0].length,64);
  await ui.choose([file('second.txt','2. 另一題 ______')]);
  ui.fire('applyImport','click');
  assert.equal(saved.length,2);assert.equal(saved[0].imageHashes[0].length,64);
});

test("file preview does not change the draft; applying saves and cancelling preserves it", async () => {
  const ui = dom();
  let changes = 0;
  setupBatchImport({ document: ui.document, onApply: () => changes++ });
  ui.$("batchText").value = "1. 原本的填空 ______";
  await ui.choose([file("new.json", JSON.stringify([rawQuestion]))]);
  assert.equal(ui.$("batchText").value, "1. 原本的填空 ______");
  assert.equal(ui.$("importPreview").hidden, false);
  assert.equal(ui.focused(), "importPreviewHeading");
  ui.fire("applyImport", "click");
  assert(ui.$("batchText").value.includes("2. CPU"));
  assert(ui.$("batchText").value.startsWith("1. 原本的填空"));
  assert.equal(changes, 1);
  assert.equal(ui.$("importPreview").hidden, true);
  assert(ui.$("importStatus").textContent.includes("衝突題號"));
  const applied = ui.$("batchText").value;
  await ui.choose([file("other.txt", "3. 不能自動加入的題目")]);
  ui.fire("cancelImport", "click");
  assert.equal(ui.$("batchText").value, applied);
  assert.equal(changes, 1);
  assert.equal(ui.focused(), "chooseBatchFiles");
});
test("explicit replace and direct-paste preview work, including changed input protection", async () => {
  const ui = dom();
  setupBatchImport({ document: ui.document, onApply() {} });
  ui.$("batchText").value = "1. 原本題目";
  await ui.choose([file("replace.md", "11. 新的填空 ______")]);
  ui.$("importMode").value = "replace";
  ui.fire("applyImport", "click");
  assert.equal(ui.$("batchText").value, "11. 新的填空 ______");
  ui.$("batchText").value = JSON.stringify([rawQuestion]);
  ui.fire("recognizePaste", "click");
  assert.equal(ui.$("importModeField").hidden, true);
  ui.$("batchText").value = "1. 辨識後又編輯的文字";
  ui.fire("applyImport", "click");
  assert.equal(ui.$("batchText").value, "1. 辨識後又編輯的文字");
  assert(ui.$("importStatus").textContent.includes("已變更"));
  ui.fire("recognizePaste", "click");
  ui.fire("applyImport", "click");
  assert.equal(ui.$("batchText").value, "1. 辨識後又編輯的文字");
});
test("failed or excessive imports preserve input and malicious text is displayed as text", async () => {
  const ui = dom();
  let changes = 0;
  setupBatchImport({ document: ui.document, onApply: () => changes++ });
  const existing = Array.from(
    { length: 30 },
    (_, i) => `${i + 1}. 填空 ______`,
  ).join("\n");
  ui.$("batchText").value = existing;
  await ui.choose([file("bad.json", "invalid")]);
  assert(ui.$("importStatus").textContent.includes("無法匯入"));
  assert.equal(ui.$("importPreview").hidden, true);
  await ui.choose([file("extra.json", JSON.stringify([rawQuestion]))]);
  ui.fire("applyImport", "click");
  assert.equal(ui.$("batchText").value, existing);
  assert.equal(changes, 0);
  assert(ui.$("importStatus").textContent.includes("30 題"));
  await ui.choose([
    file(
      "literal.json",
      JSON.stringify([
        {
          stem: '<img src="https://example.invalid" onerror="alert(1)"> _____',
        },
      ]),
    ),
  ]);
  assert.equal(ui.$("importList").querySelectorAll("img").length, 0);
  assert(ui.$("importList").textContent.includes("<img"));
});
test("clearing or starting another import invalidates pending async reads", async () => {
  const ui = dom();
  setupBatchImport({ document: ui.document, onApply() {} });
  let finish;
  const delayed = {
    name: "slow.txt",
    size: 20,
    arrayBuffer: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  ui.$("batchFiles").files = [delayed];
  ui.fire("batchFiles", "change");
  ui.fire("clearInput", "click");
  finish(new TextEncoder().encode("1. 過期的題目").buffer);
  await tick();
  assert.equal(ui.$("importPreview").hidden, true);
  ui.$("batchFiles").files = [delayed];
  ui.fire("batchFiles", "change");
  const finishOld = finish;
  await ui.choose([file("new.txt", "1. 新選的題目")]);
  finishOld(new TextEncoder().encode("1. 過期的題目").buffer);
  await tick();
  assert(ui.$("importList").textContent.includes("新選的題目"));
  assert(!ui.$("importList").textContent.includes("過期的題目"));
});

test("unknown fields can be mapped, previewed and applied without changing the original draft early", async () => {
  const ui = dom();
  let changes = 0;
  setupBatchImport({ document: ui.document, onApply: () => changes++ });
  ui.$("batchText").value = "11. 保留原題 _____";
  await ui.choose([
    file(
      "custom.csv",
      `描述,候選甲,候選乙\n${rawQuestion.stem},短程排程器,長程排程器`,
    ),
  ]);
  assert.equal(ui.$("importMapping").hidden, false);
  assert.equal(ui.$("batchText").value, "11. 保留原題 _____");
  assert.equal(ui.focused(), "mappingHeading");
  ui.$("mappingStem").value = "0";
  ui.$("mappingNumber").value = "0";
  ui.fire("applyMapping", "click");
  assert(ui.$("mappingStatus").textContent.includes("同一欄"));
  assert.equal(changes, 0);
  ui.$("mappingNumber").value = "-1";
  const columns = ui.$("mappingColumns").querySelectorAll("input");
  columns[1].checked = true;
  columns[2].checked = true;
  ui.fire("applyMapping", "click");
  assert.equal(ui.$("importMapping").hidden, true);
  assert.equal(ui.$("importPreview").hidden, false);
  assert(ui.$("importWarnings").textContent.includes("指定的欄位"));
  assert.equal(changes, 0);
  ui.fire("applyImport", "click");
  assert.equal(changes, 1);
  assert(ui.$("batchText").value.includes("保留原題"));
  assert(ui.$("batchText").value.includes("A. 短程排程器"));
});
test("normalization warnings are shown, and cancelled mappings or edited pasted data do not overwrite drafts", async () => {
  const ui = dom();
  setupBatchImport({ document: ui.document, onApply() {} });
  await ui.choose([
    file(
      "ai.json5",
      `[{stem: '${rawQuestion.stem}', options: ['短程排程器','長程排程器',],},]`,
    ),
  ]);
  assert(ui.$("importWarnings").textContent.includes("引號"));
  const original = JSON.stringify([
    { 描述: rawQuestion.stem, 候選: ["短程排程器", "長程排程器"] },
  ]);
  ui.$("batchText").value = original;
  ui.fire("recognizePaste", "click");
  assert.equal(ui.$("importMapping").hidden, false);
  ui.$("mappingStem").value = "0";
  ui.$("mappingOptions").value = "1";
  ui.$("batchText").value = "1. 使用者已修改的文字";
  ui.fire("applyMapping", "click");
  assert(ui.$("mappingStatus").textContent.includes("已變更"));
  assert.equal(ui.$("batchText").value, "1. 使用者已修改的文字");
  ui.fire("cancelMapping", "click");
  assert.equal(ui.$("importMapping").hidden, true);
  assert.equal(ui.$("batchText").value, "1. 使用者已修改的文字");
});

test("full page: imported/pasted structured questions use bank answers, update drafts and invalidate old results", async () => {
  const ui = dom();
  const storage = new Map();
  const base = {
    schemaVersion: 1,
    courses: {
      os: { units: [{ id: "scheduling", name: "CPU 排程" }] },
      algorithms: { units: [] },
    },
    entries: [
      toLibraryQuestion(
        "os",
        "scheduling",
        { ...rawQuestion, id: "test", answer: "A" },
        true,
      ),
    ],
  };
  const context = vm.createContext({
    document: ui.document,
    window: { courseContributions: { apiOrigin: "https://example.invalid" } },
    location: { href: "https://example.invalid/batch.html" },
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    fetch: async (url) => ({
      ok: true,
      json: async () =>
        String(url).startsWith("assets/") ? base : { questions: [] },
    }),
    navigator: { clipboard: { writeText: async () => {} } },
    URL,
    AbortSignal,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    console,
    Event: ui.window.Event,
  });
  const modules = new Map();
  async function load(url) {
    url = new URL(url);
    url.search = "";
    if (!modules.has(url.href))
      modules.set(
        url.href,
        (async () => {
          const module = new vm.SourceTextModule(await readFile(url, "utf8"), {
            context,
            identifier: url.href,
          });
          await module.link((specifier) => load(new URL(specifier, url).href));
          return module;
        })(),
      );
    return modules.get(url.href);
  }
  await (
    await load(new URL("../assets/batch-ui.mjs", import.meta.url))
  ).evaluate();
  await tick();
  assert.equal(ui.$("compare").disabled, false);
  await ui.choose([file("questions.json", JSON.stringify([rawQuestion]))]);
  ui.fire("applyImport", "click");
  assert(
    [...storage.values()].some((value) =>
      JSON.parse(value).text.startsWith("1. CPU"),
    ),
  );
  ui.fire("batchForm", "submit");
  assert.equal(ui.$("results").hidden, false);
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert.equal(ui.$("staleNotice").hidden, true);
  // Transfer is a distinct explicit action; stale results cannot be transferred.
  ui.$("batchText").value += "\n\n2. 未收錄的額外問題 ______";
  ui.fire("batchText", "input");
  assert.equal(ui.$("transferUnmatched").disabled, true);
  ui.fire("transferUnmatched", "click");
  assert.equal(storage.has("course-library.submission-inbox.v1"), false);
  ui.fire("batchForm", "submit");
  assert.equal(ui.$("transferUnmatched").disabled, false);
  ui.fire("transferUnmatched", "click");
  const pending = JSON.parse(storage.get("course-library.submission-inbox.v1"));
  assert.equal(pending.items.length, 1);
  assert.equal(pending.items[0].stem, "未收錄的額外問題 ______");
  assert.equal(pending.items[0].answer, "");
  assert.equal(context.location.href, "submit.html?v=draft-transfer-20261020#pendingHeading");
  await ui.choose([file("more.txt", "2. 未收錄填空 ______")]);
  ui.fire("applyImport", "click");
  assert.equal(ui.$("staleNotice").hidden, false);
  assert.equal(ui.$("copyAnswers").disabled, true);
  ui.$("batchText").value = JSON.stringify([rawQuestion]);
  ui.fire("batchText", "input");
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert(!ui.$("resultRows").textContent.includes("尚無可確認答案"));
  ui.$("batchText").value =
    `描述,候選甲,候選乙,提供答案\n${rawQuestion.stem},短程排程器,長程排程器,B`;
  ui.fire("batchText", "input");
  ui.fire("batchForm", "submit");
  assert.equal(ui.$("importMapping").hidden, false);
  ui.$("mappingStem").value = "0";
  const columns = ui.$("mappingColumns").querySelectorAll("input");
  columns[1].checked = true;
  columns[2].checked = true;
  ui.fire("applyMapping", "click");
  ui.fire("applyImport", "click");
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert.equal(ui.$("staleNotice").hidden, true);
});
