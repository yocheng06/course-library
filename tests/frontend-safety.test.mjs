import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { questionPreview } from '../assets/contributions-ui.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('credential forms never default to GET and cannot submit before handlers load', async () => {
  const html = await read('contribution-service/frontend/review.html');
  for (const [id, action] of [['passwordLoginForm', '/api/login'], ['passwordSetupForm', '/api/password/setup']]) {
    const form = html.match(new RegExp('<form[^>]*id="' + id + '"[^>]*>'))[0];
    assert.match(form, /method="post"/);
    assert.ok(form.includes('action="' + action + '"'));
  }
  for (const id of ['loginSubmit', 'setupSubmit']) {
    assert.match(html.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>'))[0], /disabled/);
  }
  assert.doesNotMatch(html.match(/<form[^>]*id="passwordLoginForm"[^>]*>/)[0], /hidden/);
  const js = await read('contribution-service/frontend/assets/contributions-review.js');
  const setupHandler = js.search(/\$\(["']passwordSetupForm["']\)\.addEventListener\(["']submit["']/);
  const setupEnabled = js.search(/\$\(["']setupSubmit["']\)\.disabled\s*=\s*false/);
  assert.ok(setupHandler >= 0 && setupEnabled > setupHandler);
});

test('question bank import is a native keyboard button wired to the file chooser', async () => {
  const html = await read('submit.html');
  assert.match(html, /<button[^>]*id="chooseImport"[^>]*type="button"[^>]*>選取 JSON／HTML 題庫<\/button>/);
  assert.match(await read('assets/contributions-submit.js'), /\$\("chooseImport"\)\.addEventListener\("click", \(\) => \$\("importFile"\)\.click\(\)\)/);
});

test('preview letters align with the answer and imported text remains escaped', () => {
  const html = questionPreview({category:'測試',type:'single',stem:'<script>bad</script>',images:[],options:['3','4','<img>'],answer:'B',explanation:''},0);
  assert.match(html, /<ol type="A"><li>3<\/li><li>4<\/li>/);
  assert.match(html, /答案：<\/strong>B/);
  assert.doesNotMatch(html, /<script>|<img>/);
  assert.match(html, /&lt;img&gt;/);
});

test('GitHub submission frontend matches the service while its review page remains service-owned', async () => {
  for (const path of ['submit.html','assets/contributions-submit.js','assets/contributions-review.js','assets/contributions-ui.js']) {
    assert.equal(await read(path), await read('contribution-service/frontend/' + path), path);
  }
  assert.match(await read('review.html'), /course-library-submissions-yocheng06\.yocheng06\.chatgpt\.site\/review/);
  assert.match(await read('contribution-service/frontend/review.html'), /id="passwordLoginForm"/);
});
