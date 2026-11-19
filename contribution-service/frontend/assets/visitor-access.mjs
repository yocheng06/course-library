import {esc} from './contributions-ui.js?v=treasure-unit-20261030';

const endpoint = '/api/manage/visitor-access';
const kindLabel = kind => kind === 'ip' ? 'IP' : '瀏覽器';
const timestamp = time => new Date(time).toLocaleString('zh-TW');

export function setupVisitorAccess({container, api}) {
  let generation = 0;
  let saving = false;

  async function show(message = '') {
    const request = ++generation;
    container.textContent = '正在讀取訪客紀錄…';
    try {
      const {visitors, blocks} = await api(endpoint);
      if (request !== generation) return;
      const active = new Set(blocks.map(row => row.kind + ':' + row.target));
      const blockButton = (kind, target) => !target ? '' : active.has(kind + ':' + target)
        ? '<span>' + kindLabel(kind) + '已封鎖</span>'
        : `<button type="button" class="button secondary" data-access-action="block" data-kind="${kind}" data-target="${esc(target)}">封鎖${kindLabel(kind)}</button>`;
      container.innerHTML = `<h2>訪客與封鎖</h2>
        <p>只記錄受控入口。校園 Wi-Fi 可能有多人共用 IP。換瀏覽器或清除網站資料後，瀏覽器代號可能改變。</p>
        <p><a href="/course-library/">開啟受控題庫</a></p>
        <label>封鎖期限<select data-block-days><option value="1">24 小時</option><option value="7">7 天</option><option value="30">30 天</option></select></label>
        <button type="button" class="button secondary" data-access-action="refresh">重新載入</button>
        <p role="status" data-access-status>${esc(message)}</p>
        <h3>封鎖清單</h3>
        ${blocks.length ? '<ul>' + blocks.map(row => `<li>${kindLabel(row.kind)} ${esc(row.kind === 'ip' ? row.target : row.target.slice(0, 12))} · 至 ${esc(timestamp(row.expires_at))}
          <button type="button" class="button secondary" data-access-action="unblock" data-kind="${esc(row.kind)}" data-target="${esc(row.target)}">解除封鎖</button></li>`).join('') + '</ul>' : '<p>目前沒有封鎖。</p>'}
        <h3>最近訪客（最多 100 筆）</h3>
        ${visitors.length ? '<ul>' + visitors.map(row => `<li>${esc(timestamp(row.last_at))} · ${esc(row.last_path)} · 瀏覽器 ${esc(row.browser.slice(0, 12))}
          <details><summary>顯示來源 IP</summary><p>${esc(row.ip || '無資料')}</p></details>
          <div class="actions">${blockButton('browser',row.browser)} ${blockButton('ip',row.ip)}</div></li>`).join('') + '</ul>' : '<p>目前沒有訪客紀錄。</p>'}`;
    } catch (error) {
      if (request !== generation) return;
      container.textContent = error.message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.dataset.accessAction = 'refresh';
      retry.textContent = '重新載入';
      container.append(retry);
    }
  }

  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-access-action]');
    if (!button || saving) return;
    const {accessAction: action, kind, target} = button.dataset;
    if (action === 'refresh') return show();
    const days = Number(container.querySelector('[data-block-days]').value);
    if (action === 'block' && !window.confirm(`確定封鎖此${kindLabel(kind)} ${days} 天？`)) return;
    const request = generation;
    saving = true;
    button.disabled = true;
    try {
      await api(endpoint, {method:'POST', body:JSON.stringify({action,kind,target,days})});
      if (request === generation) await show(action === 'block' ? '已封鎖。' : '已解除封鎖。');
    } catch (error) {
      if (request === generation) container.querySelector('[data-access-status]').textContent = error.message;
    } finally {
      saving = false;
      button.disabled = false;
    }
  });
  return {show, clear() { generation++; container.replaceChildren(); }};
}
