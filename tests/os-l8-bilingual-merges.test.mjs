import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseOSCourseHTML } from '../scripts/course-data.mjs';

test('reviewed bilingual merges preserve source answers, option order and old IDs', async () => {
  const units = parseOSCourseHTML(await readFile(new URL('../os.html', import.meta.url), 'utf8'));
  const unit = units.find(item => item.id === 'deadlocks');
  const review = JSON.parse(await readFile(new URL('../content/os-l8-bilingual-merge-review-20261027.json', import.meta.url), 'utf8'));
  const library = JSON.parse(await readFile(new URL('../assets/batch-library.json', import.meta.url), 'utf8'));
  for (const item of review.merges) {
    const q = unit.questions.find(question => question.id === item.canonicalId);
    const variant = q.sourceVariants.find(source => source.id === item.mergedId);
    assert.equal(unit.questionAliases[item.mergedId], item.canonicalId);
    assert.equal(unit.questions.some(question => question.id === item.mergedId), false);
    assert.equal(variant.answer, item.sourceAnswer);
    assert.doesNotMatch(q.translation, /[\u3400-\u9fff]/u);
    assert.match(q.stem, /[\u3400-\u9fff]/u);
    assert.equal(q.optionTranslations.length, q.options.length);
    assert(library.entries.some(entry => entry.id === q.id && entry.stem === variant.stem && entry.answer === variant.answer));
    assert(item.sourceOptionToCanonical, 'Only questions with complete option sets belong in this merge list');
    const answerKey = value => String(value).toUpperCase().match(/[A-H]/g)?.join('') ?? '';
    const chineseIsMerged = /[\u3400-\u9fff]/u.test(variant.stem);
    const chineseAnswer = answerKey(chineseIsMerged ? item.sourceAnswer : item.canonicalAnswer);
    const englishAnswer = answerKey(chineseIsMerged ? item.canonicalAnswer : item.sourceAnswer);
    const mapped = chineseIsMerged
      ? [...chineseAnswer].map(key => item.sourceOptionToCanonical[key]).sort().join('')
      : [...englishAnswer].map(key => item.sourceOptionToCanonical[key]).sort().join('');
    assert.equal(q.choiceKey, chineseAnswer);
    assert.equal(mapped, chineseIsMerged ? englishAnswer : chineseAnswer);
  }
});

test('the process-message-passing duplicate displays one Chinese-first bilingual choice question', async () => {
  const units = parseOSCourseHTML(await readFile(new URL('../os.html', import.meta.url), 'utf8'));
  const unit = units.find(item => item.id === 'process');
  const q = unit.questions.find(question => question.id === 'process-69');
  assert.equal(unit.questionAliases['process-68'], 'process-69');
  assert.equal(unit.questions.some(question => question.id === 'process-68'), false);
  assert.equal(q.stem, '哪些是訊息傳遞中的同步化類型？');
  assert.equal(q.translation, 'What are the synchronization types in message passing?');
  assert.deepEqual(q.options, [
    'A. 非阻塞（非同步）',
    'B. 阻塞（同步）',
    'C. 有界容量',
    'D. 無限容量',
  ]);
  assert.deepEqual(q.optionTranslations, [
    'non-blocking (asynchronous)',
    'blocking (synchronous)',
    'bounded capacity',
    'infinite capacity',
  ]);
  assert.equal(q.choiceKey, 'AB');
  assert(q.sourceVariants.some(source => source.id === 'process-68'));
});
