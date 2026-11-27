import {esc} from './contributions-ui.js?v=treasure-unit-20261030';

const endpoint = '/api/manage/visitor-access';
const hour = 3600000;
const pageSize = 25;
const kindLabel = kind => kind === 'ip' ? 'IP' : '瀏覽器';
const timestamp = time => new Date(time).toLocaleString('zh-TW');
const browserCode = (browser, length = 8) => browser.slice(0, length).toUpperCase();
const modelNames = new Map([['SM-S9260', 'Galaxy S24+'], ['SM-S926B', 'Galaxy S24+']]);
const modelLabel = model => modelNames.has(model.toUpperCase()) ? `${modelNames.get(model.toUpperCase())}（${model}）` : model;
export function visitorDeviceInfo(visitor){
 const device=visitor.device||'',model=visitor.model||'';
 const phone=/iPhone|Android 手機/.test(device),tablet=/iPad/.test(device);
 const computer=/^(Windows|macOS|ChromeOS|Linux)(?:\b|$)/.test(device);
 const type=phone?'手機':tablet?'平板':computer?'電腦瀏覽模式':device?'其他／未確定類型':'無法辨識';
 const modelText=model?modelLabel(model):computer?'未提供（一般網頁無法取得電腦品牌與型號）':/iPhone/.test(device)?'iPhone（瀏覽器未提供確切世代）':/iPad/.test(device)?'iPad（瀏覽器未提供確切世代）':'瀏覽器未提供確切型號';
 const note=computer?'無法僅憑 Windows 或 macOS 區分桌上型電腦、筆電，也不能得知品牌。':/iPhone|iPad/.test(device)?'目前只能辨識裝置系列，不能據此判定第幾代。':!model?(/^Android/.test(device)?'部分 Android 瀏覽器會在後續造訪時補送型號；已知型號會保留。':'此瀏覽器未提供可用型號，無法判斷品牌或確切設備。'):'';
 return {type,modelText,note,summary:[type,device,visitor.browser_name,model?modelLabel(model):''].filter(Boolean).join(' · ')};
}
const historyLabels = {block:'已封鎖', extend:'已延長', unblock:'已解除', expire:'自動到期'};
const periodLabels = {0:'近 30 天', 1:'近 1 小時', 24:'近 24 小時', 168:'近 7 天'};
const pageNames = {
  'index.html': '課程首頁',
  'os.html': '作業系統',
  'algorithms.html': '演算法',
  'batch.html': '批次查題',
  'music-player.html': '音樂播放器',
};
const durationOptions = '<option value="1">1 小時</option><option value="24">24 小時</option><option value="168">7 天</option><option value="720">30 天</option>';

function groupVisitors(records) {
  const byBrowser = new Map();
  for (const visit of records) {
    if (!byBrowser.has(visit.browser)) byBrowser.set(visit.browser, []);
    byBrowser.get(visit.browser).push(visit);
  }
  const browsers = [...byBrowser.keys()];
  return [...byBrowser].map(([browser, connections]) => {
    connections.sort((a, b) => b.last_at - a.last_at);
    let length = 8;
    while (length < browser.length && browsers.some(other =>
      other !== browser && other.startsWith(browser.slice(0, length)))) length++;
    return {browser, code: browserCode(browser, length), connections, latest: connections[0]};
  }).sort((a, b) => b.latest.last_at - a.latest.last_at);
}

function remainingTime(expiresAt) {
  const minutes = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000));
  if (minutes < 60) return `剩 ${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `剩 ${hours} 小時 ${minutes % 60} 分鐘`;
  return `剩 ${Math.floor(hours / 24)} 天 ${hours % 24} 小時`;
}

export function setupVisitorAccess({container, api}) {
  let generation = 0;
  let tab = 'visitors';
  let visitors = [];
  let blocks = [];
  let pending = null;
  let loading = false;
  let saving = false;
  let timer;
  let archive = null;
  let archiveRequest = 0;
  let history = {offset: 0, events: [], hasMore: false};
  let historyRequest = 0;

  const $ = selector => container.querySelector(selector);
  const activeBlocks = () => blocks.filter(block => block.expires_at > Date.now());
  const blockFor = (kind, target) => activeBlocks().find(block => block.kind === kind && block.target === target);
  const listedVisitors = () => archive?.visitors || visitors;
  const browserLabel = browser => listedVisitors().find(visitor => visitor.browser === browser)?.code || browserCode(browser);
  const post = body => api(endpoint, {method:'POST', body:JSON.stringify(body)});

  function pager(kind, offset, hasMore) {
    return `<button type="button" class="button secondary" data-visitor-action="page-${kind}" data-offset="${Math.max(0, offset-pageSize)}" ${offset === 0 ? 'disabled' : ''}>上一頁</button>
      <span>第 ${offset / pageSize + 1} 頁</span>
      <button type="button" class="button secondary" data-visitor-action="page-${kind}" data-offset="${offset+pageSize}" ${hasMore ? '' : 'disabled'}>下一頁</button>`;
  }

  function mount() {
    container.innerHTML = `<div class="visitor-heading">
        <h2>訪客與封鎖</h2>
        <button type="button" class="button secondary" data-visitor-action="refresh">重新載入</button>
      </div>
      <nav class="visitor-tabs" aria-label="訪客與封鎖檢視">
        <button type="button" class="button secondary" data-visitor-action="tab" data-tab="visitors">最近訪客 <span data-visitor-count></span></button>
        <button type="button" class="button secondary" data-visitor-action="tab" data-tab="blocks">封鎖中 <span data-block-count></span></button>
        <button type="button" class="button secondary" data-visitor-action="tab" data-tab="history">封鎖紀錄</button>
      </nav>
      <p data-access-status role="status" aria-live="polite" tabindex="-1"></p>
      <div data-visitor-view="visitors">
        <form class="visitor-filters" role="search" aria-label="搜尋最近訪客">
          <label>搜尋訪客<input type="search" data-visitor-search maxlength="100" placeholder="IP、瀏覽器代號、頁面或設備"></label>
          <label>最後出現<select data-visitor-period><option value="0">全部時間</option><option value="1">近 1 小時</option><option value="24">近 24 小時</option><option value="168">近 7 天</option></select></label>
          <div class="visitor-search-actions">
            <button type="submit" class="button secondary">搜尋 30 天紀錄</button>
            <button type="button" class="text-button" data-visitor-action="recent" hidden>返回最近訪客</button>
          </div>
        </form>
        <p class="muted" data-visitor-results></p>
        <ul class="visitor-list" data-visitor-list></ul>
        <p class="muted" data-visitor-empty hidden>沒有符合的訪客。</p>
        <nav class="visitor-pager" aria-label="訪客搜尋分頁" data-visitor-pager hidden></nav>
      </div>
      <div data-visitor-view="history" hidden>
        <p class="muted">封鎖、延長、解除與到期紀錄保留 30 天。</p>
        <ul class="visitor-list" data-history-list></ul>
        <p class="muted" data-history-empty hidden>目前沒有封鎖紀錄。</p>
        <nav class="visitor-pager" aria-label="封鎖紀錄分頁" data-history-pager hidden></nav>
      </div>
      <div data-visitor-view="blocks" hidden>
        <ul class="visitor-list" data-block-list></ul>
        <p class="muted" data-block-empty hidden>目前沒有封鎖。</p>
      </div>
      <p class="visitor-scope muted" data-recent-scope>以<a href="/course-library/">受控題庫</a>最近 100 筆連線依瀏覽器合併。換瀏覽器或清除網站資料後，可能會取得新代號。</p>
      <dialog class="visitor-dialog" aria-labelledby="visitorDialogTitle" data-visitor-dialog></dialog>`;
    $('[data-visitor-dialog]').addEventListener('cancel', event => {
      if (saving) event.preventDefault();
      else pending = null;
    });
    timer = setInterval(() => {
      for (const time of container.querySelectorAll('[data-expires-at]')) {
        time.textContent = remainingTime(Number(time.dataset.expiresAt));
      }
      if (blocks.some(block => block.expires_at <= Date.now()) && !$('[data-visitor-dialog]').open) {
        blocks = activeBlocks();
        render();
      }
    }, 60000);
  }

  function render() {
    const active = activeBlocks();
    $('[data-visitor-count]').textContent = String(visitors.length);
    $('[data-block-count]').textContent = String(active.length);
    for (const button of container.querySelectorAll('[data-tab]')) {
      button.setAttribute('aria-current', button.dataset.tab === tab ? 'page' : 'false');
    }
    for (const view of container.querySelectorAll('[data-visitor-view]')) {
      view.hidden = view.dataset.visitorView !== tab;
    }

    const query = $('[data-visitor-search]').value.trim().toLowerCase();
    const period = Number($('[data-visitor-period]').value);
    const since = period ? Date.now() - period * hour : 0;
    const matches = listedVisitors().map((visitor, index) => ({visitor, index})).filter(({visitor}) =>
      archive || visitor.connections.some(connection => connection.last_at >= since && (!query ||
        [connection.ip, visitor.browser, connection.last_path, pageNames[connection.last_path],
          connection.device, connection.browser_name, modelLabel(connection.model || ''), connection.nickname]
          .some(text => (text || '').toLowerCase().includes(query)))));
    $('[data-visitor-action=recent]').hidden = !archive;
    $('[data-recent-scope]').hidden = tab !== 'visitors' || !!archive;
    $('[data-visitor-results]').textContent = archive
      ? `30 天紀錄 · ${periodLabels[archive.period]}${archive.query ? ' · '+archive.query : ''} · 本頁 ${matches.length} 個瀏覽器`
      : `顯示 ${matches.length}／${visitors.length} 個瀏覽器`;
    const archivePager = $('[data-visitor-pager]');
    archivePager.hidden = !archive || (!archive.offset && !archive.hasMore);
    if (archive) archivePager.innerHTML = pager('archive', archive.offset, archive.hasMore);
    $('[data-visitor-empty]').hidden = matches.length > 0 || loading;
    $('[data-visitor-list]').innerHTML = matches.map(({visitor, index}) => {
      const browserBlock = blockFor('browser', visitor.browser);
      const ips = visitor.connections.filter(connection => connection.ip);
      const blockedIPs = ips.filter(connection => blockFor('ip', connection.ip)).length;
      const status = [browserBlock && '瀏覽器已封鎖', blockedIPs > 0 && `${blockedIPs} 個 IP 已封鎖`].filter(Boolean).join('、');
      const canBlock = !browserBlock || blockedIPs < ips.length;
      const {latest} = visitor;
      const deviceInfo=visitorDeviceInfo(latest);
      const deviceLabel = deviceInfo.summary;
      return `<li class="visitor-row">
        <div>
          <strong>${esc(latest.nickname || '瀏覽器')} <code>${esc(visitor.code)}</code></strong>
          ${deviceLabel ? `<p class="muted">${esc(deviceLabel)}</p>` : ''}
          <p class="muted">最後出現 ${esc(timestamp(latest.last_at))} · ${esc(pageNames[latest.last_path] || latest.last_path)}</p>
          <details>
            <summary>查看連線資料（${ips.length} 個 IP）</summary>
            <p>完整瀏覽器代號 <code>${esc(visitor.browser)}</code></p>
            <p>設備類型 ${esc(deviceInfo.type)}</p>
            <p>系統 ${esc(latest.device || '瀏覽器未提供')} · 瀏覽器 ${esc(latest.browser_name || '未辨識')}</p>
            <p>設備型號 ${esc(deviceInfo.modelText)}</p>
            ${deviceInfo.note?`<p class="muted">${esc(deviceInfo.note)}</p>`:''}
            <p class="muted">以上依瀏覽器回報，不能保證是實際硬體或同一個人。可用「命名」自行註記，例如「自己的筆電」。</p>
            <ul>${visitor.connections.map(connection => `<li>${esc(connection.ip || '無 IP 資料')} · 最後出現 ${esc(timestamp(connection.last_at))}</li>`).join('')}</ul>
          </details>
        </div>
        <div class="visitor-row-actions">
          ${status ? `<span class="state-badge pending">${esc(status)}</span>` : '<span class="state-badge">未封鎖</span>'}
          <button type="button" class="text-button" data-visitor-action="nickname" data-index="${index}">${latest.nickname ? '改名' : '命名'}</button>
          ${canBlock ? `<button type="button" class="button secondary" data-visitor-action="block" data-index="${index}">封鎖…</button>` : ''}
          ${status ? '<button type="button" class="text-button" data-visitor-action="tab" data-tab="blocks">查看封鎖</button>' : ''}
        </div>
      </li>`;
    }).join('');

    $('[data-block-empty]').hidden = active.length > 0 || loading;
    $('[data-block-list]').innerHTML = active.map(block => {
      const index = blocks.indexOf(block);
      return `<li class="visitor-row">
        <div>
          <strong>${block.kind === 'browser' ? `瀏覽器 <code>${esc(browserLabel(block.target))}</code> 封鎖` : 'IP 封鎖'}</strong>
          <span class="state-badge pending" data-expires-at="${esc(block.expires_at)}">${remainingTime(block.expires_at)}</span>
          <p class="muted">到期時間 ${esc(timestamp(block.expires_at))}</p>
          ${block.note ? `<p class="visitor-note">${esc(block.note)}</p>` : ''}
          <details><summary>查看封鎖對象</summary><p>${esc(block.target)}</p></details>
        </div>
        <div class="visitor-row-actions">
          <button type="button" class="button secondary" data-visitor-action="extend" data-index="${index}">延長…</button>
          <button type="button" class="text-button" data-visitor-action="unblock" data-index="${index}">解除封鎖</button>
        </div>
      </li>`;
    }).join('');
    renderHistory();
  }

  function renderHistory() {
    const target = event => event.kind === 'browser' ? browserLabel(event.target) : 'IP';
    $('[data-history-list]').innerHTML = history.events.map(event => `<li class="visitor-row">
      <div>
        <strong>${esc(event.nickname || kindLabel(event.kind))}${event.kind === 'browser' ? ` <code>${esc(target(event))}</code>` : ''}</strong>
        <span class="state-badge">${esc(historyLabels[event.action] || event.action)}</span>
        <p class="muted">${esc(timestamp(event.event_at))} · ${event.action === 'unblock' ? '原到期時間' : '到期時間'} ${esc(timestamp(event.expires_at))}</p>
        ${event.note ? `<p class="visitor-note">${esc(event.note)}</p>` : ''}
        <details><summary>查看封鎖對象</summary><p>${esc(event.target)}</p></details>
      </div>
    </li>`).join('');
    $('[data-history-empty]').hidden = history.events.length > 0 || history.loading || tab !== 'history';
    const navigation = $('[data-history-pager]');
    navigation.hidden = !history.offset && !history.hasMore;
    navigation.innerHTML = pager('history', history.offset, history.hasMore);
  }

  async function show(message = '') {
    if (!$('[data-visitor-dialog]')) mount();
    const request = ++generation;
    loading = true;
    const refresh = $('[data-visitor-action=refresh]');
    refresh.disabled = true;
    $('[data-access-status]').textContent = '正在讀取訪客與封鎖資料…';
    try {
      const data = await api(endpoint);
      if (request !== generation) return;
      visitors = groupVisitors(data.visitors);
      blocks = data.blocks;
      let refreshed = true;
      if (tab === 'visitors' && archive) refreshed = await loadArchive(archive);
      if (tab === 'history') refreshed = await loadHistory(history.offset);
      if (request !== generation) return;
      const status = $('[data-access-status]');
      if (refreshed) status.textContent = message;
      else if (message) status.textContent = `${message} ${status.textContent}`;
    } catch (error) {
      if (request === generation) $('[data-access-status]').textContent = message ? message + ' ' + error.message : error.message;
    } finally {
      if (request === generation) {
        loading = false;
        refresh.disabled = false;
        render();
        if (message) $('[data-access-status]').focus({preventScroll: true});
      }
    }
  }

  async function loadArchive({query, period, offset}) {
    const request = ++archiveRequest;
    const status = $('[data-access-status]');
    status.textContent = '正在搜尋訪客紀錄…';
    try {
      const result = await post({action:'search', query, period, offset});
      if (request !== archiveRequest) return;
      archive = {query, period, offset, hasMore:result.hasMore, visitors:groupVisitors(result.visitors)};
      if (tab === 'visitors') status.textContent = '';
      render();
      return true;
    } catch (error) {
      if (request === archiveRequest && tab === 'visitors') status.textContent = error.message;
      return false;
    }
  }

  async function loadHistory(offset) {
    const request = ++historyRequest;
    const status = $('[data-access-status]');
    history.loading = true;
    status.textContent = '正在讀取封鎖紀錄…';
    renderHistory();
    try {
      const result = await post({action:'history', offset});
      if (request !== historyRequest) return;
      history = {offset, events:result.events, hasMore:result.hasMore};
      if (tab === 'history') status.textContent = '';
      return true;
    } catch (error) {
      if (request === historyRequest && tab === 'history') status.textContent = error.message;
      return false;
    } finally {
      if (request === historyRequest) {
        history.loading = false;
        renderHistory();
      }
    }
  }

  function selectTab(next) {
    tab = next;
    render();
    $('[data-visitor-action=tab][data-tab="' + next + '"]').focus({preventScroll: true});
    if (next === 'history') loadHistory(history.offset);
    else $('[data-access-status]').textContent = '';
  }

  function updateTarget() {
    const selectingIP = $('[data-block-kind]').value === 'ip';
    $('[data-block-target]').hidden = selectingIP;
    $('[data-ip-field]').hidden = !selectingIP;
    $('[data-block-ip]').disabled = !selectingIP;
    $('[data-ip-warning]').hidden = !selectingIP;
  }

  function openDialog(action, index) {
    const dialog = $('[data-visitor-dialog]');
    if (action === 'nickname') {
      const visitor = listedVisitors()[index];
      if (!visitor) return;
      pending = {action, visitor};
      dialog.innerHTML = `<form>
        <h3 id="visitorDialogTitle">瀏覽器暱稱</h3>
        <p>代號 <code>${esc(visitor.code)}</code></p>
        <label>暱稱<input data-nickname maxlength="40" value="${esc(visitor.latest.nickname || '')}" placeholder="例如：我的手機"></label>
        <p class="muted">清空後儲存即可移除暱稱。</p>
        <p role="alert" data-visitor-dialog-error></p>
        <div class="actions"><button type="submit" class="button">儲存暱稱</button><button type="button" class="button secondary" data-visitor-action="cancel">取消</button></div>
      </form>`;
    } else if (action === 'block') {
      const visitor = listedVisitors()[index];
      const canBrowser = visitor.browser && !blockFor('browser', visitor.browser);
      const availableIPs = visitor.connections.filter(connection => connection.ip && !blockFor('ip', connection.ip));
      const canIP = availableIPs.length > 0;
      if (!canBrowser && !canIP) return;
      pending = {action, visitor};
      dialog.innerHTML = `<form>
        <h3 id="visitorDialogTitle">封鎖訪客</h3>
        <label>封鎖對象<select data-block-kind><option value="browser" ${canBrowser ? 'selected' : 'disabled'}>瀏覽器</option><option value="ip" ${canBrowser ? '' : 'selected'} ${canIP ? '' : 'disabled'}>IP</option></select></label>
        <p data-block-target class="visitor-target">${esc(visitor.latest.nickname || '瀏覽器')} <code>${esc(visitor.code)}</code></p>
        <label data-ip-field hidden>選擇 IP<select data-block-ip required>${availableIPs.length > 1 ? '<option value="">請選擇要封鎖的 IP</option>' : ''}${availableIPs.map(connection =>
          `<option value="${esc(connection.ip)}">${esc(connection.ip)} · ${esc(timestamp(connection.last_at))}</option>`).join('')}</select></label>
        <p class="notice" data-ip-warning hidden>共用這個 IP 的同學也會受影響，例如使用同一個校園網路的人。</p>
        <label>封鎖期限<select data-block-hours>${durationOptions}</select></label>
        <label>備註（選填）<textarea data-block-note maxlength="200" rows="2" placeholder="例如：短時間內大量連線"></textarea></label>
        <p role="alert" data-visitor-dialog-error></p>
        <div class="actions"><button type="submit" class="button">確認封鎖</button><button type="button" class="button secondary" data-visitor-action="cancel">取消</button></div>
      </form>`;
      updateTarget();
    } else {
      const block = blocks[index];
      if (!block || block.expires_at <= Date.now()) return render();
      pending = {action, block};
      dialog.innerHTML = `<form>
        <h3 id="visitorDialogTitle">延長${kindLabel(block.kind)}封鎖</h3>
        <p class="visitor-target">${esc(block.kind === 'browser' ? browserLabel(block.target) : block.target)}</p>
        <p>目前到期時間 ${esc(timestamp(block.expires_at))}</p>
        <label>從目前到期時間延長<select data-block-hours>${durationOptions}</select></label>
        <p role="alert" data-visitor-dialog-error></p>
        <div class="actions"><button type="submit" class="button">確認延長</button><button type="button" class="button secondary" data-visitor-action="cancel">取消</button></div>
      </form>`;
    }
    dialog.showModal();
  }

  async function save(body) {
    const request = generation;
    const dialog = $('[data-visitor-dialog]');
    saving = true;
    const controls = [...container.querySelectorAll('button, input, select, textarea')];
    const enabled = controls.filter(node => !node.disabled);
    enabled.forEach(node => node.disabled = true);
    try {
      await post(body);
      if (request !== generation) return;
      if (dialog.open) dialog.close();
      pending = null;
      const messages = {block:'已封鎖。', extend:'已延長封鎖。', unblock:'已解除封鎖。', nickname:'已更新暱稱。'};
      await show(messages[body.action]);
    } catch (error) {
      if (request !== generation) return;
      const status = dialog.open ? $('[data-visitor-dialog-error]') : $('[data-access-status]');
      if (status) status.textContent = error.message;
    } finally {
      saving = false;
      enabled.forEach(node => node.disabled = false);
    }
  }

  container.addEventListener('click', event => {
    const button = event.target.closest('[data-visitor-action]');
    if (!button || saving) return;
    const {visitorAction: action, tab: next, index} = button.dataset;
    if (action === 'refresh') return show();
    if (action === 'tab') return selectTab(next);
    if (action === 'page-archive') return loadArchive({...archive, offset:Number(button.dataset.offset)});
    if (action === 'page-history') return loadHistory(Number(button.dataset.offset));
    if (action === 'recent') {
      archiveRequest++;
      archive = null;
      $('[data-access-status]').textContent = '';
      return render();
    }
    if (action === 'cancel') {
      pending = null;
      return $('[data-visitor-dialog]').close();
    }
    if (action === 'unblock') {
      const {kind, target} = blocks[Number(index)];
      if (window.confirm(`確定解除這筆${kindLabel(kind)}封鎖？`)) return save({action, kind, target});
      return;
    }
    openDialog(action, Number(index));
  });
  container.addEventListener('input', event => {
    if (event.target.matches('[data-visitor-search]')) render();
  });
  container.addEventListener('change', event => {
    if (event.target.matches('[data-visitor-period]')) render();
    if (event.target.matches('[data-block-kind]') && pending) updateTarget();
  });
  container.addEventListener('submit', event => {
    event.preventDefault();
    if (saving) return;
    if (event.target.matches('.visitor-filters')) {
      return loadArchive({query:$('[data-visitor-search]').value.trim(), period:Number($('[data-visitor-period]').value), offset:0});
    }
    if (!event.target.closest('[data-visitor-dialog]') || !pending) return;
    const {action, visitor, block} = pending;
    if (action === 'nickname') return save({action, target:visitor.browser, nickname:$('[data-nickname]').value.trim()});
    const kind = block?.kind ?? $('[data-block-kind]').value;
    const target = block?.target ?? (kind === 'ip' ? $('[data-block-ip]').value : visitor.browser);
    if (!target) return;
    const durationHours = Number($('[data-block-hours]').value);
    save({action, kind, target, durationHours, ...(visitor ? {note: $('[data-block-note]').value.trim()} : {})});
  });

  return {
    show,
    clear() {
      generation++;
      archiveRequest++;
      historyRequest++;
      clearInterval(timer);
      container.replaceChildren();
      visitors = [];
      blocks = [];
      pending = null;
      archive = null;
      history = {offset:0, events:[], hasMore:false};
      loading = false;
      tab = 'visitors';
    },
  };
}
