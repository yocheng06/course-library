import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';

const script = await readFile(new URL('../assets/home-resume.js', import.meta.url), 'utf8');
function home(position, fail = false) {
  const {document} = parseHTML('<html><body><main><nav class="pixel-courses"></nav></main></body></html>');
  const raw = typeof position === 'string' ? position : JSON.stringify(position);
  vm.runInNewContext(script, {document, localStorage:{getItem(){if(fail)throw Error('blocked');return raw;}}});
  return document;
}
test('homepage resume uses the saved course and stable question link with text-safe labels', () => {
  const document = home({version:1,course:'os',unit:'scheduling',unitLabel:'<img src=x onerror=alert(1)>',page:2,question:'os6-040'});
  assert.equal(document.querySelector('.resume-entry a').getAttribute('href'),'os.html?question=os6-040');
  assert.match(document.querySelector('.resume-entry p').textContent,/第 2 頁/);
  assert.equal(document.querySelector('.resume-entry img'),null);
  assert.equal(home({version:1,course:'algorithms',unit:'L3',page:3}).querySelector('.resume-entry a').getAttribute('href'),'algorithms.html?resume=1');
});
test('missing, malformed, blocked or invalid saved positions leave the homepage usable', () => {
  for(const position of [null,'{broken', 'x'.repeat(4001),{version:2,course:'os',unit:'basics',page:1},{version:1,course:'other',unit:'basics',page:1},{version:1,course:'os',unit:'L3',page:1},{version:1,course:'os',unit:'basics',page:-1}])
    assert.equal(home(position).querySelector('.resume-entry'),null);
  assert.equal(home(null,true).querySelector('.resume-entry'),null);
});
