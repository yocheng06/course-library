import './question-sync.js?v=consistency-20261126';
import {esc} from './contributions-ui.js?v=treasure-unit-20261030';

export function publishedLinks(result, course) {
  if (!['os','algorithms'].includes(course)) return '';
  return (result.publishedQuestions || []).filter(q => /^community-[0-9a-f-]{36}-[1-9]\d*$/.test(q.id)).map(q => {
    const url = new URL(`/course-library/${course}.html`, window.courseContributions.apiOrigin);
    url.searchParams.set('question',q.id);
    return `<p><a class="button secondary" href="${esc(url.href)}" target="_blank" rel="noopener">查看這題</a> ${esc(q.stem || q.id)}</p>`;
  }).join('');
}

export async function confirmPublication(node, result, course) {
  const expected = (result.publishedQuestions || []).map(q => q.id);
  if (!expected.length) return;
  node.innerHTML = '<p role="status">題目已儲存，正在確認查題資料已更新…</p>';
  try {
    const response = await fetch(window.courseContributions.apiOrigin + '/api/questions?course=' + course, {cache:'no-cache',signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!window.courseQuestionSync.validData(data)) throw Error();
    const ids = new Set(data.questions.map(q => q.question.id || q.question.bookmarkId));
    if (!expected.every(id => ids.has(id))) throw Error();
    node.innerHTML = '<p role="status">已確認閱讀與批次查題可取得本次題目。</p>';
  } catch {
    node.innerHTML = '<p role="status">題目已儲存，目前無法確認查題同步。請勿重複投稿。</p><button type="button" class="text-button">重新確認同步</button>';
    node.querySelector('button').addEventListener('click', () => { void confirmPublication(node,result,course); });
  }
}
