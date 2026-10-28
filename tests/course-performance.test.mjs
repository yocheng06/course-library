import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { parseOSCourseHTML } from '../scripts/course-data.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('OS question data stays embedded by unit but is not executable until that unit is opened', async () => {
  const html = await read('os.html');
  const units = parseOSCourseHTML(html);
  assert.equal(units.length, 7);
  assert.match(html, /<script id="course-manifest" type="application\/json">/);
  assert.equal([...html.matchAll(/<script id="course-unit-[^"]+" type="application\/json" data-course-unit=/g)].length, 7);
  const manifest = JSON.parse(html.match(/<script id="course-manifest" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(units.reduce((count, unit) => count + unit.questions.length, 0), manifest.reduce((count, unit) => count + unit.questionCount, 0));
  assert.ok(manifest.every(unit => unit.questionAliases && typeof unit.questionAliases === 'object'));
  assert.equal(manifest[6].questionIds.length, units[6].questions.length);
  assert.doesNotMatch(html, /<script>\s*const UNITS\s*=/);
});

test('search skips empty queries and reuses each question’s normalized index', async () => {
  const context = { window: {} };
  vm.runInNewContext(await read('assets/question-tools.js'), context);
  const tools = context.window.courseQuestionTools;
  let stemReads = 0;
  const question = {
    type: '填空題', category: '同步', options: [], answer: 'semaphore', explanation: 'shared process coordination',
    get stem() { stemReads++; return 'What does a semaphore coordinate?'; },
  };
  assert.equal(tools.matchesSearch(question, '  '), true);
  assert.equal(stemReads, 0);
  assert.equal(tools.matchesSearch(question, 'semaphore'), true);
  assert.equal(stemReads, 1);
  assert.equal(tools.matchesSearch(question, 'coordination'), true);
  assert.equal(stemReads, 1);
  assert.equal(tools.matchesSearch(question, 'missing-term'), false);
  assert.equal(stemReads, 1);
});

test('OS page parses only the opened unit, then loads the rest for whole-course search', async () => {
  const html = await read('os.html');
  const expectedUnits = parseOSCourseHTML(html);
  const { window } = parseHTML(html);
  const { document } = window;
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: select.querySelector('option')?.value || '', writable: true, configurable: true });
  window.window = window;

  const payloadToUnit = new Map([...document.querySelectorAll('script[data-course-unit]')].map(node => [node.textContent, node.dataset.courseUnit]));
  const parsedUnits = [];
  const json = {
    parse(value, ...args) {
      if (payloadToUnit.has(value)) parsedUnits.push(payloadToUnit.get(value));
      return JSON.parse(value, ...args);
    },
    stringify: JSON.stringify,
  };
  const context = vm.createContext({ window, document, location: { search: '' }, URLSearchParams, JSON: json, console, requestAnimationFrame: callback => callback() });
  for (const file of ['assets/question-tools.js', 'assets/choice-answers.js', 'assets/practice-feedback.js', 'assets/os-learning.js'])
    vm.runInContext(await read(file), context, { filename: file });

  assert.deepEqual(parsedUnits, ['basics']);
  assert.equal(document.querySelectorAll('#cards article').length, 20);
  const alias = Object.entries(JSON.parse(document.getElementById('course-manifest').textContent).find(unit => unit.id === 'synchronization').questionAliases)[0];
  assert.equal(window.courseLearning.validId(alias[0]), true);
  assert.equal(window.courseLearning.resolveId(alias[0]), alias[1]);

  document.querySelector('[data-unit="5"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.deepEqual(parsedUnits, ['basics', 'synchronization']);
  assert.equal(document.getElementById('title').textContent, '程序同步');
  assert.equal(document.querySelector('#cards article').dataset.id, expectedUnits[5].questions[0].id);

  document.querySelector('[data-unit="6"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(document.getElementById('title').textContent, '死結');
  assert.equal(document.querySelector('#cards article').dataset.id, expectedUnits[6].questions[0].id);
  assert.deepEqual(parsedUnits, ['basics', 'synchronization', 'deadlocks']);

  const scope = document.getElementById('searchScopeSelect');
  scope.value = 'all';
  scope.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(parsedUnits.length, 7);
  const total = expectedUnits.reduce((count, unit) => count + unit.questions.length, 0);
  assert.equal(document.getElementById('resultCount').textContent.includes(`${total} / ${total} 題`), true);
});
