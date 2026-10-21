import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('merged source versions and supplemental explanations are not rendered', () => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(join(root, 'assets/question-tools.js'), 'utf8'), context);

  const question = {
    explanation: '主要解析保留在題目卡片。',
    sourceExplanations: [{ sourceId: 'source-1', text: '這是合併來源的補充解析。' }],
    sourceVariants: [{
      id: 'source-1',
      stem: '這是合併前的原版本題目。',
      options: ['原選項'],
      answer: 'A',
    }],
  };

  const markup = context.window.courseQuestionTools.explanationMarkup(question);

  assert.match(markup, /主要解析保留在題目卡片/);
  assert.doesNotMatch(markup, /source-explanations|原版本題目|合併來源的補充解析/);
  assert.equal(question.sourceExplanations.length, 1);
  assert.equal(question.sourceVariants[0].stem, '這是合併前的原版本題目。');
});
