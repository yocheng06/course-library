import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';
import {setupVisitorAccess} from '../assets/visitor-access.mjs';

test('filters recent visits and uses the selected record to block, extend and unblock', async () => {
  const {document, window} = parseHTML('<section id="visitors"></section>');
  const container = document.getElementById('visitors');
  const $ = selector => container.querySelector(selector);
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return (this.querySelector('option[selected]') || this.querySelector('option'))?.value; },
    set(value) { for (const option of this.options) option.toggleAttribute('selected', option.value === value); },
  });
  Object.defineProperty(window.HTMLElement.prototype, 'open', {configurable: true, get() { return this.hasAttribute('open'); }});
  window.HTMLElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLElement.prototype.close = function () { this.removeAttribute('open'); };
  globalThis.window = window;
  window.confirm = () => true;

  const browser = 'a'.repeat(64);
  const ip = '192.0.2.20';
  const visitors = [
    {browser, ip, last_path: 'os.html', last_at: Date.now(), device:'Android 手機', browser_name:'Chrome', model:'Pixel 9'},
    {browser, ip: '192.0.2.21', last_path: 'algorithms.html', last_at: Date.now() - 1800000},
    {browser: 'a'.repeat(8) + 'b'.repeat(56), ip, last_path: 'batch.html', last_at: Date.now() - 86400000},
  ];
  let blocks = [];
  const requests = [];
  const manager = setupVisitorAccess({container, api: async (_endpoint, options) => {
    if (!options) return {visitors, blocks};
    const body = JSON.parse(options.body);
    requests.push(body);
    if (body.action === 'block') blocks = [{...body, expires_at: Date.now() + body.durationHours * 3600000}];
    if (body.action === 'extend') blocks = blocks.map(block => ({...block, expires_at: block.expires_at + body.durationHours * 3600000}));
    if (body.action === 'unblock') blocks = [];
    return {ok: true};
  }});
  const event = (selector, name) => $(selector).dispatchEvent(new window.Event(name, {bubbles: true, cancelable: true}));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const search = value => {
    $('[data-visitor-search]').value = value;
    event('[data-visitor-search]', 'input');
  };
  const submit = () => event('[data-visitor-dialog] form', 'submit');

  try {
    await manager.show();
    assert.equal($('[data-visitor-view=blocks]').hidden, true);
    assert.equal($('[data-visitor-count]').textContent, '2');
    assert.deepEqual([...container.querySelectorAll('[data-visitor-list] strong code')].map(node => node.textContent), ['AAAAAAAAA','AAAAAAAAB']);
    assert.match($('[data-visitor-list] summary').textContent, /2 個 IP/);
    assert.equal(container.querySelectorAll('[data-visitor-list] > li').length, 2);
    assert.match($('[data-visitor-list] > li').textContent, /Android 手機 · Chrome/);
    assert.match($('[data-visitor-list] > li details').textContent, /設備型號 Pixel 9/);
    assert.equal($('[data-visitor-list] > li details').hasAttribute('open'), false);
    search('Pixel 9');
    assert.equal(container.querySelectorAll('[data-visitor-list] > li').length, 1);
    search(ip);
    assert.equal(container.querySelectorAll('[data-visitor-list] > li').length, 2);
    search('192.0.2.21');
    assert.equal(container.querySelectorAll('[data-visitor-list] > li').length, 1);
    search('批次查題');
    $('[data-visitor-period]').value = '1';
    event('[data-visitor-period]', 'change');
    assert.equal($('[data-visitor-empty]').hidden, false);
    search('作業系統');
    $('[data-visitor-action=block]').click();
    assert.equal($('[data-block-kind]').value, 'browser');
    assert.equal($('[data-ip-warning]').hidden, true);
    $('[data-block-kind]').value = 'ip';
    event('[data-block-kind]', 'change');
    assert.equal($('[data-ip-field]').hidden, false);
    assert.equal($('[data-block-ip]').value, '');
    assert.deepEqual([...$('[data-block-ip]').options].map(option => option.value), ['', ip, '192.0.2.21']);
    submit();
    await settle();
    assert.equal(requests.length, 0);
    assert.match($('[data-block-target]').textContent, /AAAAAAAAA/);
    assert.equal($('[data-ip-warning]').hidden, false);
    $('[data-block-kind]').value = 'browser';
    event('[data-block-kind]', 'change');
    $('[data-block-note]').value = '備註 <img>';
    submit();
    await settle();
    assert.deepEqual(requests[0], {action:'block', kind:'browser', target:browser, durationHours:1, note:'備註 <img>'});
    assert.match($('[data-visitor-list]').textContent, /瀏覽器已封鎖/);
    $('[data-visitor-action=tab][data-tab=blocks]').click();
    assert.equal($('[data-visitor-view=visitors]').hidden, true);
    assert.match($('[data-block-list]').textContent, /備註 <img>/);
    assert.equal($('[data-block-list] img'), null);
    $('[data-visitor-action=extend]').click();
    $('[data-block-hours]').value = '24';
    submit();
    await settle();
    assert.deepEqual(requests[1], {action:'extend', kind:'browser', target:browser, durationHours:24});
    $('[data-visitor-action=unblock]').click();
    await settle();
    assert.deepEqual(requests[2], {action:'unblock', kind:'browser', target:browser});
    assert.equal($('[data-block-empty]').hidden, false);
  } finally {
    manager.clear();
    delete globalThis.window;
  }
});
