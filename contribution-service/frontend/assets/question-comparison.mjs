import './choice-answers.js?v=global-dedup-20261016';
// Comparison is explanatory only; it never changes matching, answers or publication state.
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const optionText = value => String(typeof value==='object'?value?.text??'':value??'').trim().replace(/^[A-H][.．、:：]\s*/i,'');
const text = value => String(value??'').normalize('NFC').replace(/\s+/g,' ').trim();
export function blankCount(stem) { return (String(stem??'').match(/\[\s*_+\s*\d+\s*_+\s*\]|_{2,}/g)||[]).length; }
export function canonicalQuestion(q={}) {
  const options=(q.options??q.opts??[]).map(optionText);
  return {stem:q.stem??q.q??'',translation:q.translation??'',type:q.type||(options.length?'選擇題':'填空題'),options,answer:q.answer??q.a??'',explanation:q.explanation??q.ex??'',images:q.images??[]};
}
function contentAnswer(q) {
  const value=String(q.answer).trim();
  const parser=globalThis.courseChoiceAnswers||globalThis.window?.courseChoiceAnswers;
  const key=q.options.length?parser?.expectedChoiceKey(value,q.options):null;
  if(key)return [...key].map(c=>q.options[c.charCodeAt(0)-65]??`無法對應的 ${c}`).sort().join('；');
  return value;
}
export function compareQuestions(left,right) {
  const a=canonicalQuestion(left),b=canonicalQuestion(right);
  const fields=[['題幹',a.stem,b.stem],['題幹翻譯',a.translation,b.translation],['題型',a.type,b.type],['填空數',blankCount(a.stem),blankCount(b.stem)],
    ['選項內容',a.options.map((v,i)=>`${String.fromCharCode(65+i)}. ${v}`).join('\n'),b.options.map((v,i)=>`${String.fromCharCode(65+i)}. ${v}`).join('\n')],
    ['答案內容',contentAnswer(a),contentAnswer(b)],['解析',a.explanation,b.explanation],['題圖',a.images.map(i=>typeof i==='string'?i:i.src).join('\n'),b.images.map(i=>typeof i==='string'?i:i.src).join('\n')]];
  return fields.filter(([,l,r])=>String(l)!==''||String(r)!=='').map(([label,l,r])=>({label,left:String(l),right:String(r),different:text(l)!==text(r)}));
}
export function comparisonMarkup(left,right,{leftTitle='本次匯入',rightTitle='題庫候選版本',reason=''}={}) {
  const fields=compareQuestions(left,right),differences=fields.filter(f=>f.different).map(f=>f.label);
  return `<div class="question-comparison"><p>${esc(reason|| (differences.length?'差異欄位：'+differences.join('、'):'各欄位內容一致。'))}</p><p class="muted">候選題的答案僅供核對，不會自動帶入或覆蓋本次題目。</p><div class="comparison-scroll"><div class="comparison-table" role="table" aria-label="題目版本比較"><div role="row"><div role="columnheader">欄位</div><div role="columnheader">${esc(leftTitle)}</div><div role="columnheader">${esc(rightTitle)}</div></div>${fields.map(f=>`<div role="row" class="${f.different?'comparison-different':''}"><div role="rowheader">${esc(f.label)}${f.different?'（不同）':''}</div><div role="cell"><pre>${esc(f.left||'（未提供）')}</pre></div><div role="cell"><pre>${esc(f.right||'（未提供）')}</pre></div></div>`).join('')}</div></div></div>`;
}
export function mismatchLabel(row) {
  const reason=String(row.reason||'');
  if(row.status==='matched')return '完整符合';
  if(/圖片|題圖/.test(reason))return '圖片或圖中條件待核對';
  if(/答案項目數|填空數|填答格式/.test(reason))return '填空或答案格式不同';
  if(/選項/.test(reason))return '選項版本不同或不完整';
  if(/答案/.test(reason))return '答案或版本不同';
  if(row.references?.length)return '題幹或附加條件不同';
  return '未找到候選題';
}
