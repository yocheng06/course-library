import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { groupImport } from '../assets/grouped-submissions.mjs';

const source = await readFile(new URL('../assets/contributions-submit.js', import.meta.url), 'utf8');
const context = {
  COURSE_UNITS: { os: { units: { L9: 'L9 · 記憶體管理' } } },
  normalizeUnit: () => 'L9', URL, btoa,
};
vm.runInNewContext(source.slice(source.indexOf('function normalizedImagePath('), source.indexOf('async function parseCoursePracticeHtmlPair(')) + '\nthis.parsers={parseCoursePracticeHtml,parseCoursePracticeResultsHtml,combineCoursePracticeHtml};', context);

test('submission import preserves both input positions and excludes saved answers', async () => {
  const html = '<html><head><title>記憶體</title></head><body><form id="practice-quiz-form" action="https://example.com/course/OS26B/process_practice.php?realm_id=9"><div class="question-block"><p class="question-text">妖獸 1.</p><div class="question-text">在<input type="text" class="text-answer" value="SECRET-ONE">頁表中，每個條目對應一個物理<input type="text" class="text-answer" value="SECRET-TWO">。</div></div></form></body></html>';
  const { document } = parseHTML(html);
  const imported = await context.parsers.parseCoursePracticeHtml(document, html, 'questions.html');
  assert.equal(imported.questions.length, 1);
  assert.equal(imported.questions[0].stem, '在 ____________ 頁表中，每個條目對應一個物理 ____________ 。');
  assert.doesNotMatch(imported.questions[0].stem, /SECRET/);
  assert.equal(document.querySelectorAll('input.text-answer').length, 2);
  const results = parseHTML('<div class="question-result"><p><strong>題目：</strong>在[__1__]頁表中，每個條目對應一個物理[__2__]。</p><p><strong>正確答案：</strong><br>inverted/frame</p></div>');
  const paired = context.parsers.combineCoursePracticeHtml(imported, context.parsers.parseCoursePracticeResultsHtml(results.document));
  assert.equal(paired.questions[0].answer, 'inverted/frame');
  assert.equal(paired.questions[0].stem, imported.questions[0].stem);
});
test('downloaded HTML restores referenced local images and requires the matching _files asset', async () => {
  const html = '<html><head><title>排程</title></head><body><form id="practice-quiz-form" action="https://example.com/course/OS26B/process_practice.php?realm_id=9"><div class="question-block"><p class="question-text">妖獸 1.</p><div class="question-text">Process Burst Time P1 20<img src="./questions_files/diagram.png" alt="排程圖"><input type="text" class="text-answer"></div></div></form></body></html>',
    { document } = parseHTML(html);
  await assert.rejects(
    context.parsers.parseCoursePracticeHtml(document, html, 'questions.html'),
    /questions_files.*沒有匯入任何題目/u,
  );

  const bytes = Uint8Array.from([1, 2, 3]),
    imageFile = {
      name: 'diagram.png',
      type: 'image/png',
      size: bytes.length,
      webkitRelativePath: 'questions_files/diagram.png',
      async arrayBuffer() { return bytes.buffer; },
    },
    restored = await context.parsers.parseCoursePracticeHtml(
      document,
      html,
      'questions.html',
      [imageFile],
    ),
    groups = groupImport(
      restored,
      {course:'os',unit:'L9',title:'測試'},
      'questions.html',
      {allowMissingAnswers:true},
    );
  assert.equal(restored.questions[0].stem, 'Process Burst Time P1 20 ____________');
  assert.equal(groups[0].payload.questions[0].type, '圖片題');
  assert.equal(groups[0].payload.questions[0].images.length, 1);
  assert.equal(groups[0].payload.questions[0].images[0], 'data:image/png;base64,AQID');
});
