import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadOrder(random) {
  const context = { window: {} };
  vm.runInNewContext(
    readFileSync(join(root, 'assets/question-tools.js'), 'utf8'),
    context,
  );
  return context.window.courseQuestionTools.createPracticeOrder(random);
}

test('practice order defaults to source order and keeps a shuffled deck stable', () => {
  const order = loadOrder(() => 0);
  const items = ['A', 'B', 'C', 'D'].map((id) => ({ id }));

  assert.strictEqual(order.apply(items), items);
  const shuffled = order.apply(items, true);
  assert.deepEqual(Array.from(shuffled, (item) => item.id), ['B', 'C', 'D', 'A']);

  assert.strictEqual(order.apply(items), items);
  assert.deepEqual(
    Array.from(order.apply(items, true), (item) => item.id),
    ['B', 'C', 'D', 'A'],
  );

  const rerenderedItems = items.map((item) => ({ ...item }));
  assert.deepEqual(
    Array.from(order.apply(rerenderedItems, true), (item) => item.id),
    ['B', 'C', 'D', 'A'],
  );
});

test('filter changes get a new deck and selecting source order resets shuffling', () => {
  let randomCalls = 0;
  const order = loadOrder(() => {
    randomCalls++;
    return 0;
  });
  const items = ['A', 'B', 'C', 'D'].map((id) => ({ id }));
  order.apply(items, true);
  order.apply(items, true);
  assert.equal(randomCalls, 3);

  const readingFilter = items.slice(1);
  assert.strictEqual(order.apply(readingFilter), readingFilter);
  assert.equal(randomCalls, 3);

  const filtered = items.slice(1);
  assert.deepEqual(
    Array.from(order.apply(filtered, true), (item) => item.id),
    ['C', 'D', 'B'],
  );
  assert.equal(randomCalls, 5);
  order.reset();
  assert.strictEqual(order.apply(filtered, false), filtered);

  order.apply(filtered, true);
  assert.equal(randomCalls, 7);
});
