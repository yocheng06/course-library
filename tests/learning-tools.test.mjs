import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const source = await readFile(new URL('../assets/learning-tools.js', import.meta.url), 'utf8');
const pendingId = 'community-12345678-1234-1234-1234-123456789abc-1';
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

function harness({course = 'os', initial = {}, clipboard, execCopy = false, failWrites = false} = {}) {
  const {window, document} = parseHTML('<html><body><div class="toolbar"></div><details id="conceptGuide" open></details><details class="filter-details"></details><section id="cards"><article data-id="known-1"><div class="cardtop"></div></article><article data-id="known-2"><div class="cardtop"></div></article></section></body></html>');
  Object.defineProperty(document, 'readyState', {value:'loading', configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable:true,
    get() { return this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''; },
    set(value) { for (const option of this.querySelectorAll('option')) option.toggleAttribute('selected', option.value === value); },
  });
  let focused, selected, fail = failWrites;
  window.HTMLElement.prototype.focus = function () { focused = this; };
  window.HTMLTextAreaElement.prototype.select = function () { selected = this.value; };
  const downloads = [], blobs = [], revoked = [], copied = [], legacyCopied = [];
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({href:this.href, download:this.download}); };
  document.execCommand = command => {
    assert.equal(command, 'copy');
    legacyCopied.push(document.querySelector('.question-copy-temp').value);
    return execCopy;
  };
  const key = `course-library.learning.v1.${course}`;
  const storage = new Map([[key, JSON.stringify(initial)]]), known = new Set(['known-1', 'known-2']);
  const config = {
    course, toolbar:document.querySelector('.toolbar'), list:document.getElementById('cards'),
    scopeIds:() => [...known], validId:id => known.has(id),
    resolveId:id => id === 'old-1' ? 'known-1' : known.has(id) ? id : undefined,
    cardTop:card => card.querySelector('.cardtop'),
    questionLabel:id => `單元 ${id === 'known-1' ? '1' : '2'} 題`,
    questionDetails:id => ({course, id, unit:'UNIT 02 · 系統基礎', number:id === 'known-1' ? 1 : 2}),
    render() { window.learningUI.refresh(); }, resetPage() {},
  };
  window.courseLearning = config;
  window.courseQuestionTools = {reportURL:details => `https://github.com/example/issues/new?question=${details.id}`};
  const TestURL = class extends URL {
    static createObjectURL(blob) { blobs.push(blob); return 'blob:test-backup'; }
    static revokeObjectURL(url) { revoked.push(url); }
  };
  const context = vm.createContext({
    window, document,
    localStorage:{getItem:key => storage.get(key), setItem(key, value) { if (fail) throw new Error('quota'); storage.set(key, value); }},
    navigator:{clipboard:clipboard === null ? undefined : {writeText:clipboard || (async value => { copied.push(value); })}},
    matchMedia:() => ({matches:false, addEventListener() {}}),
    URL:TestURL, Blob, TextEncoder, Date, setTimeout, queueMicrotask,
  });
  vm.runInContext(source, context);
  const click = selector => document.querySelector(selector).dispatchEvent(new window.Event('click', {bubbles:true}));
  const backup = bookmarks => JSON.stringify({format:'course-library.review-bookmarks', version:1, course, exportedAt:'2026-10-22T00:00:00.000Z', bookmarks});
  return {window, document, storage, key, config, known, copied, legacyCopied, downloads, blobs, revoked, click, backup,
    ui:window.learningUI, setFailWrites:value => { fail = value; }, selected:() => selected, focused:() => focused};
}

test('bookmarks migrate merged IDs and preserve pending community marks in the versioned backup', () => {
  const h = harness({initial:{bookmarks:['old-1','known-1',pendingId,'obsolete'], size:'large', state:{old:true}}});
  const backup = plain(h.ui.exportBookmarks());
  assert.equal(backup.format, 'course-library.review-bookmarks');
  assert.equal(backup.version, 1);
  assert.equal(backup.course, 'os');
  assert.deepEqual(backup.bookmarks, ['known-1',pendingId]);
  assert.deepEqual(JSON.parse(h.storage.get(h.key)), {bookmarks:['known-1',pendingId], size:'large'});
  assert.equal(h.ui.isSaved('known-1'), true);
  assert.equal(h.ui.isSaved(pendingId), true);
});

test('backup controls move into reading settings after those settings are built and export only IDs', async () => {
  const h = harness({initial:{bookmarks:['known-2']}});
  const settings = h.document.createElement('div'); settings.className = 'reading-settings-body';
  h.document.body.append(settings);
  h.document.dispatchEvent(new h.window.Event('DOMContentLoaded'));
  assert.equal(settings.querySelector('.review-backup') !== null, true);
  h.click('[data-export-review]');
  assert.equal(h.downloads.length, 1);
  assert.match(decodeURIComponent(h.downloads[0].download), /^os-待複習-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await h.blobs[0].text());
  assert.deepEqual(data.bookmarks, ['known-2']);
  assert.deepEqual(Object.keys(data).sort(), ['bookmarks','course','exportedAt','format','version']);
  assert.match(h.document.querySelector('.learning-status').textContent, /請確認下載檔案/);
});

test('import merges rather than replaces, deduplicates aliases, and retains pending community IDs', () => {
  const h = harness({initial:{bookmarks:['known-2']}});
  assert.deepEqual(plain(h.ui.importBookmarks(h.backup(['old-1','known-1',pendingId]))), {added:2,total:3});
  assert.deepEqual(plain(h.ui.exportBookmarks()).bookmarks, ['known-2','known-1',pendingId]);
  assert.deepEqual(JSON.parse(h.storage.get(h.key)).bookmarks, ['known-2','known-1',pendingId]);
  assert.deepEqual(plain(h.ui.importBookmarks(h.backup(['old-1']))), {added:0,total:3});
});

test('malformed, unknown, wrong-course, unsupported, and oversized backups leave existing bookmarks untouched', () => {
  const h = harness({initial:{bookmarks:['known-2']}});
  const wrongCourse = JSON.parse(h.backup(['known-1'])); wrongCourse.course = 'algorithms';
  const wrongVersion = JSON.parse(h.backup(['known-1'])); wrongVersion.version = 2;
  const invalidId = h.backup(['<img>']);
  const before = h.storage.get(h.key);
  for (const raw of ['{', '{}', JSON.stringify(wrongCourse), JSON.stringify(wrongVersion), invalidId, h.backup(['unknown']), 'x'.repeat(1024*1024+1), h.backup(Array(10001).fill('known-1'))]) {
    assert.throws(() => h.ui.importBookmarks(raw));
    assert.equal(h.storage.get(h.key), before);
    assert.deepEqual(plain(h.ui.exportBookmarks()).bookmarks, ['known-2']);
  }
});

test('quota failure keeps imports atomic and reports session-only marking even with the hint moved', () => {
  const h = harness({initial:{bookmarks:['known-1']}});
  const settings = h.document.createElement('div'); settings.className = 'reading-settings-body';
  settings.append(h.document.querySelector('.learning-tools small')); h.document.body.append(settings);
  h.setFailWrites(true);
  const before = h.storage.get(h.key);
  assert.throws(() => h.ui.importBookmarks(h.backup(['known-2'])), /原有清單未變更/);
  assert.equal(h.ui.isSaved('known-2'), false);
  assert.equal(h.storage.get(h.key), before);
  assert.deepEqual(plain(h.ui.addReview('known-2', {silent:true})), {saved:true,persistent:false});
  assert.equal(h.ui.isSaved('known-2'), true);
  assert.match(h.document.querySelector('.learning-status').textContent, /無法保存/);
  assert.match(settings.querySelector('small').textContent, /僅保留本次開啟/);
});

test('file import rejects oversized input before reading and valid files use the same merge validation', async () => {
  const h = harness({initial:{bookmarks:['known-1']}}), input = h.document.querySelector('[data-review-backup-file]');
  let read = false;
  input.files = [{size:1024*1024+1, text:async () => { read = true; return h.backup(['known-2']); }}];
  input.dispatchEvent(new h.window.Event('change'));
  await tick();
  assert.equal(read, false);
  assert.equal(h.ui.isSaved('known-2'), false);
  input.files = [{size:200, text:async () => h.backup(['known-2'])}];
  input.dispatchEvent(new h.window.Event('change'));
  await tick();
  assert.equal(h.ui.isSaved('known-1'), true);
  assert.equal(h.ui.isSaved('known-2'), true);
});

test('copying a question includes course, current number, stable ID and a canonical deep link without duplicating actions', async () => {
  const h = harness();
  h.ui.refresh(); h.ui.refresh();
  assert.equal(h.document.querySelectorAll('article[data-id="known-1"] [data-copy-question]').length, 1);
  h.click('article[data-id="known-1"] [data-copy-question]');
  await tick();
  assert.equal(h.copied.length, 1);
  assert.equal(h.copied[0], '作業系統｜UNIT 02 · 系統基礎｜第 1 題\n題目 ID：known-1\nhttps://yocheng06.github.io/course-library/os.html?question=known-1');
  assert.match(h.document.querySelector('.question-copy-status').textContent, /已複製/);
});

test('copy falls back when clipboard permission is denied and manual text remains available if both copy APIs fail', async () => {
  const fallback = harness({clipboard:async () => { throw new Error('denied'); }, execCopy:true});
  fallback.click('[data-copy-question]'); await tick();
  assert.equal(fallback.legacyCopied.length, 1);
  assert.match(fallback.legacyCopied[0], /question=known-1/);
  assert.equal(fallback.document.querySelector('.question-copy-temp'), null);
  assert.match(fallback.document.querySelector('.question-copy-status').textContent, /已複製/);
  const manual = harness({course:'algorithms',clipboard:null});
  manual.click('[data-copy-question]'); await tick();
  const text = manual.document.querySelector('.question-copy-manual textarea');
  assert.match(text.value, /演算法｜/);
  assert.match(text.value, /algorithms\.html\?question=known-1/);
  assert.equal(manual.selected(), text.value);
  assert.match(manual.document.querySelector('.question-copy-status').textContent, /請複製下方文字/);
  assert.equal(manual.document.querySelector('[data-copy-question]').disabled, false);
});

test('every question offers direct editing without duplicating buttons', () => {
  const h = harness();
  const card = h.document.createElement('article');
  card.dataset.id = pendingId;
  card.innerHTML = '<div class="cardtop"></div>';
  h.document.getElementById('cards').append(card);
  h.ui.refresh();
  assert.equal(h.document.querySelector('article[data-id="known-1"] .question-report').textContent, '修改題目');
  assert.equal(card.querySelector('.question-report').textContent, '修改題目');
  assert.match(card.querySelector('.question-report').getAttribute('aria-label'), /直接修改題目/);
  h.ui.refresh();
  assert.equal(card.querySelectorAll('.question-report').length, 1);
});
