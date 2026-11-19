import {esc} from './contributions-ui.js?v=treasure-unit-20261030';

const fieldLabels = {
  category: '主題', type: '題型', stem: '題幹', options: '選項', answer: '答案',
  explanation: '解析', note: '題目備註', translation: '翻譯',
  optionTranslations: '選項翻譯', answerProvided: '答案確認狀態',
};
function display(value) {
  return esc((Array.isArray(value) ? value.join('\n') : value) || '（空白）');
}
function renderEntry(row, pending) {
  const title = row.action === 'update' ? '修改題目' : (pending ? '建議移除' : '移除題目');
  const course = row.course === 'os' ? '作業系統' : '演算法';
  const changes = Object.entries(JSON.parse(row.changes_json));
  const diff = changes.map(([key, change]) => (
    `<h4>${esc(fieldLabels[key] || key)}</h4><label>修改前<textarea readonly rows="3">${display(change.before)}</textarea></label><label>修改後<textarea readonly rows="3">${display(change.after)}</textarea></label>`
  )).join('');
  return `<details><summary>${esc(course)} · ${esc(title)} · ${esc(row.question_id)} · ${esc(new Date(row.created_at).toLocaleString('zh-TW'))}</summary>
    <p>版本 ${esc(row.revision)} · 瀏覽器代號 ${esc(row.browser || '無資料')}</p>
    ${row.ip ? `<details><summary>顯示來源 IP</summary><p>${esc(row.ip)}</p></details>` : '<p>來源 IP 無資料或已到期。</p>'}
    ${diff}
    ${pending ? `<div class="actions"><button type="button" class="button" data-action="approve" data-id="${esc(row.id)}">核准</button>
    <button type="button" class="button secondary" data-action="reject" data-id="${esc(row.id)}">退回</button></div>` : ''}
  </details>`;
}

export function setupEditModeration({ container, api, onChanged }) {
  const endpoint = '/api/manage/edit-moderation';
  let version = 0;
  let busy = false;

  async function show() {
    const generation = ++version;
    container.textContent = '正在載入改題安全設定…';
    try {
      const data = await api(endpoint);
      if (generation !== version) return;
      container.innerHTML = `<h2>改題安全</h2>
        <form data-mode><label>公開改題模式<select name="mode">
          <option value="direct">直接公開</option>
          <option value="review">先審核</option>
          <option value="paused">暫停公開改題</option>
        </select></label><button type="submit" class="button">儲存模式</button></form>
        <p>只有站主能直接移除。公開改題的 IP 與瀏覽器代號保留 30 天，僅站主可查看。</p>
        <button type="button" class="button secondary" data-action="refresh">重新載入</button>
        <p role="status" data-feedback></p>
        <h3>待審建議（每次最多 50 筆）</h3>
        ${data.pending.map(row => renderEntry(row, true)).join('') || '<p>目前沒有待審建議。</p>'}
        <h3>最近公開修改（最多 50 筆）</h3>
        ${data.audit.map(row => renderEntry(row, false)).join('') || '<p>目前沒有新制操作紀錄。</p>'}`;
      container.querySelector('[name=mode]').value = data.mode;
    } catch (error) {
      if (generation === version) {
        container.textContent = error.message;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.dataset.action = 'refresh';
        retry.textContent = '重新載入';
        container.append(retry);
      }
    }
  }

  async function save(body) {
    if (busy) return;
    busy = true;
    const generation = version;
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      if (generation !== version) return;
      await show();
      const feedback = container.querySelector('[data-feedback]');
      if (feedback) feedback.textContent = body.action === 'policy' ? '已儲存模式。' : '已處理這筆建議。';
      if (body.action === 'approve') onChanged?.();
    } catch (error) {
      if (generation === version) container.querySelector('[data-feedback]').textContent = error.message;
    } finally {
      busy = false;
    }
  }

  container.addEventListener('submit', event => {
    event.preventDefault();
    const mode = event.target.querySelector('[name=mode]').value;
    void save({ action: 'policy', mode });
  });
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || busy) return;
    const { action, id } = button.dataset;
    if (action === 'refresh') void show();
    else if (window.confirm(action === 'approve' ? '確定採用這筆建議？' : '確定退回這筆建議？'))
      void save({ action, id });
  });
  return { show, clear() { version++; container.replaceChildren(); } };
}
