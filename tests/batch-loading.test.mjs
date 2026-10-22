import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { toLibraryQuestion } from "../assets/batch-model.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (questions = []) => ({ ok: true, json: async () => ({ questions }) });
const stem = "CPU 排程器是哪一種類型的排程器？";
const base = {
  schemaVersion: 1,
  courses: {
    os: { units: [{ id: "scheduling", name: "CPU 排程" }] },
    algorithms: { units: [{ id: "L2", name: "基礎與漸進分析" }] },
  },
  entries: [toLibraryQuestion("os", "scheduling", {
    id: "os-test", stem, options: ["A. 短程排程器", "B. 長程排程器"], answer: "A",
  }, true)],
};

async function page(fetch) {
  const { document, window } = parseHTML(await readFile(new URL("../batch.html", import.meta.url), "utf8"));
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() { return this.querySelector("option[selected]")?.value ?? this.querySelector("option")?.value ?? ""; },
    set(value) { for (const option of this.querySelectorAll("option")) option.toggleAttribute("selected", option.value === value); },
  });
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const copied = [];
  const context = vm.createContext({
    document, window: { courseContributions: { apiOrigin: "https://example.invalid" } },
    location: { href: "https://example.invalid/batch.html" },
    localStorage: { getItem: () => null, setItem() {} }, fetch,
    navigator: { clipboard: { writeText: async (text) => copied.push(text) } },
    URL, AbortSignal, TextDecoder, Uint8Array, console, Event: window.Event,
  });
  const modules = new Map();
  async function load(source) {
    const url = new URL(source); url.search = "";
    if (!modules.has(url.href)) modules.set(url.href, (async () => {
      const module = new vm.SourceTextModule(await readFile(url, "utf8"), { context, identifier: url.href });
      await module.link((specifier) => load(new URL(specifier, url)));
      return module;
    })());
    return modules.get(url.href);
  }
  await (await load(new URL("../assets/batch-ui.mjs", import.meta.url))).evaluate();
  await tick();
  const $ = (id) => document.getElementById(id);
  const fire = (id, event) => $(id).dispatchEvent(new window.Event(event, { bubbles: true, cancelable: true }));
  return { $, fire, copied, context };
}

test("built-in lookup and copying work while public sync waits, then new data invalidates old results", async () => {
  const pending = [];
  const ui = await page(async (url) => String(url).startsWith("assets/")
    ? { ok: true, json: async () => base }
    : new Promise((resolve) => pending.push(resolve)));
  assert.equal(pending.length, 2);
  assert.equal(ui.$("compare").disabled, false);
  assert.equal(ui.$("reloadLibrary").disabled, true);
  assert.match(ui.$("libraryStatus").textContent, /可先比對內建題庫/);
  ui.$("batchText").value = `1. ${stem}\nA. 短程排程器\nB. 長程排程器\n\n2. 新增的公開投稿題目？\nA. verified-answer\nB. other-answer`;
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert.equal(ui.$("copyAnswers").disabled, false);
  assert.equal(ui.$("transferUnmatched").disabled, false);
  ui.fire("copyAnswers", "click"); await tick();
  assert.equal(ui.copied.length, 1);
  assert.match(ui.copied[0], /僅比對內建題庫/);
  pending[0](response([{ unit: "scheduling", question: {
    id: "community-00000000-0000-4000-8000-000000000001-1",
    stem: "新增的公開投稿題目？", options: ["A. verified-answer", "B. other-answer"], answer: "A", answerProvided: true,
  } }]));
  pending[1](response()); await tick();
  assert.equal(ui.$("compare").disabled, false);
  assert.equal(ui.$("reloadLibrary").disabled, false);
  assert.equal(ui.$("staleNotice").hidden, false);
  assert.equal(ui.$("copyAnswers").disabled, true);
  assert.equal(ui.$("transferUnmatched").disabled, true);
  // Programmatic stale actions must obey the same guards as disabled buttons.
  ui.fire("copyAnswers", "click"); ui.fire("transferUnmatched", "click"); await tick();
  assert.equal(ui.copied.length, 1);
  assert.equal(ui.context.location.href, "https://example.invalid/batch.html");
  ui.fire("batchForm", "submit");
  assert.equal(ui.$("staleNotice").hidden, true);
  assert(ui.$("resultRows").textContent.includes("verified-answer"));
  assert.equal(ui.$("coverageNotice").hidden, true);
});

test("public failures retain built-in results and concurrent reloads do not start extra requests", async () => {
  const pending = []; let requests = 0;
  const ui = await page(async (url) => {
    requests++;
    return String(url).startsWith("assets/")
      ? { ok: true, json: async () => base }
      : new Promise((resolve, reject) => pending.push({ resolve, reject }));
  });
  ui.fire("reloadLibrary", "click"); await tick();
  assert.equal(requests, 3);
  ui.$("batchText").value = `1. ${stem}\nA. 短程排程器\nB. 長程排程器`;
  ui.fire("batchForm", "submit");
  pending.forEach(({ reject }) => reject(new Error("offline"))); await tick();
  assert.equal(ui.$("compare").disabled, false);
  assert.equal(ui.$("reloadLibrary").disabled, false);
  assert.equal(ui.$("staleNotice").hidden, true);
  assert.equal(ui.$("copyAnswers").disabled, false);
  assert.match(ui.$("libraryStatus").textContent, /目前僅比對內建題庫/);
  assert.equal(ui.$("coverageNotice").hidden, false);
});

for (const [name, malformed] of [
  ["options", { options: "ab", optionTranslations: ["x", "y"] }],
  ["conditions", { answerConditions: { unexpected: true } }],
]) test(`malformed public ${name} discard only that course and leave built-in lookup usable`, async () => {
  const question = {
    id: "community-00000000-0000-4000-8000-000000000002-1",
    stem: "不完整的公開題目？", options: ["A. public-answer", "B. other-answer"], answer: "A",
  };
  const beforeMalformed = { ...question, id: "community-00000000-0000-4000-8000-000000000003-1", stem: "同科目尚未完成驗證的題目？" };
  const otherCourse = { ...question, id: "community-00000000-0000-4000-8000-000000000004-1", stem: "另一科的完整公開題目？" };
  const ui = await page(async (url) => String(url).startsWith("assets/")
    ? { ok: true, json: async () => base }
    : String(url).endsWith("course=os")
      ? response([
          { unit: "scheduling", question: beforeMalformed },
          { unit: "scheduling", question: { ...question, ...malformed } },
        ])
      : response([{ unit: "L2", question: otherCourse }]));
  assert.equal(ui.$("compare").disabled, false);
  assert.match(ui.$("libraryStatus").textContent, /作業系統：1 題/);
  assert.match(ui.$("libraryStatus").textContent, /公開投稿資料不完整/);
  ui.$("batchText").value = `1. ${stem}\nA. 短程排程器\nB. 長程排程器`;
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. 短程排程器"));
  assert.equal(ui.$("coverageNotice").hidden, false);
  assert.equal(ui.$("copyAnswers").disabled, false);

  ui.$("course").value = "algorithms"; ui.fire("course", "change");
  assert.match(ui.$("libraryStatus").textContent, /演算法：1 題/);
  assert.match(ui.$("libraryStatus").textContent, /已同步內建與公開投稿/);
  ui.$("batchText").value = `1. ${otherCourse.stem}\nA. public-answer\nB. other-answer`;
  ui.fire("batchForm", "submit");
  assert(ui.$("resultRows").textContent.includes("A. public-answer"));
  assert.equal(ui.$("coverageNotice").hidden, true);
});
