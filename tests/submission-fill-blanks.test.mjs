import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

const source = await readFile(new URL('../assets/contributions-submit.js', import.meta.url), 'utf8');
const context = {
  COURSE_UNITS: { os: { units: { L9: 'L9 · 記憶體管理' } } },
  normalizeUnit: () => 'L9', URL,
};
vm.runInNewContext(source.slice(source.indexOf('function parseCoursePracticeHtml('), source.indexOf('function parseCoursePracticeHtmlPair(')) + '\nthis.parsers={parseCoursePracticeHtml,parseCoursePracticeResultsHtml,combineCoursePracticeHtml};', context);

test('submission import preserves both input positions and excludes saved answers', () => {
  const html = '<html><head><title>記憶體</title></head><body><form id="practice-quiz-form" action="https://example.com/course/OS26B/process_practice.php?realm_id=9"><div class="question-block"><p class="question-text">妖獸 1.</p><div class="question-text">在<input type="text" class="text-answer" value="SECRET-ONE">頁表中，每個條目對應一個物理<input type="text" class="text-answer" value="SECRET-TWO">。</div></div></form></body></html>';
  const { document } = parseHTML(html);
  const imported = context.parsers.parseCoursePracticeHtml(document, html, 'questions.html');
  assert.equal(imported.questions.length, 1);
  assert.equal(imported.questions[0].stem, '在 ____________ 頁表中，每個條目對應一個物理 ____________ 。');
  assert.doesNotMatch(imported.questions[0].stem, /SECRET/);
  assert.equal(document.querySelectorAll('input.text-answer').length, 2);
  const results = parseHTML('<div class="question-result"><p><strong>題目：</strong>在[__1__]頁表中，每個條目對應一個物理[__2__]。</p><p><strong>正確答案：</strong><br>inverted/frame</p></div>');
  const paired = context.parsers.combineCoursePracticeHtml(imported, context.parsers.parseCoursePracticeResultsHtml(results.document));
  assert.equal(paired.questions[0].answer, 'inverted/frame');
  assert.equal(paired.questions[0].stem, imported.questions[0].stem);
});
