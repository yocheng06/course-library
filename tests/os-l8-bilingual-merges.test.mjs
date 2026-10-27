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
