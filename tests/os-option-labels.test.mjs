import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('assets/os-learning.js', root), 'utf8');
const context = {
  highlighted: text => String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  esc: text => text,
  languageOf: text => /[\u3400-\u9fff]/.test(text) ? 'zh-Hant' : 'en',
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function optionMarkup('), source.indexOf('function expectedOptionKeys(')), context);

test('imported OS choices receive A-D labels without changing option text or answer mapping', () => {
  const q = {options:['哲學家進餐問題','文件鎖定','讀者-寫者問題','生產者-消費者問題'], answer:'A,B'};
  const before = JSON.stringify(q);
  for (const [index,option] of q.options.entries()) {
    const markup = context.optionMarkup(q,option,index);
    assert.ok(markup.includes(`<span class="option-label">${'ABCD'[index]}.</span>`));
    assert.ok(markup.includes(option));
    assert.equal((markup.match(/class="option-label"/g)||[]).length,1);
  }
  assert.equal(JSON.stringify(q),before);
});

test('existing option labels are preserved once and translations remain escaped', () => {
  for (const option of ['C. Existing choice','C、既有選項','C．既有選項','C：既有選項']) {
    const markup = context.optionMarkup({optionTranslations:['<unsafe>']},option,0);
    assert.ok(markup.includes(`<span class="option-label">${option.slice(0,2)}</span>`));
    assert.equal((markup.match(/class="option-label"/g)||[]).length,1);
    assert.ok(markup.includes('&lt;unsafe&gt;'));
    assert.ok(!markup.includes('<unsafe>'));
  }
});
