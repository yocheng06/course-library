import {openBuiltinEditor} from './builtin-review.mjs?v=treasure-unit-20261030';
import {api,esc} from './contributions-ui.js?v=treasure-unit-20261030';
let panel,sequence=0,cursor=null;
const entries=new Map();
export function correctionsAccess(allowed) {
  if (!panel) {
    panel=document.createElement('details');panel.className='panel';panel.id='correctionsWorkspace';
    panel.innerHTML='<summary>題目勘誤審核</summary><p>先按「編輯這道題目」修改題幹、答案或解析。儲存完成後，填寫處理說明並標為「已處理」。</p><label>狀態<select><option value="pending">待審核</option><option value="confirmed">已確認需更正</option><option value="resolved">已處理</option><option value="rejected">不採納</option></select></label><button type="button" class="button secondary" data-refresh>重新載入勘誤</button><p role="status" aria-live="polite"></p><div data-list></div><button type="button" class="button secondary" data-more hidden>載入更多勘誤</button>';
    document.getElementById('reviewWorkspace').before(panel);
    panel.addEventListener('toggle',()=>{if(panel.open&&!panel.hidden)load();});
    panel.querySelector('select').addEventListener('change',()=>load());
    panel.querySelector('[data-refresh]').addEventListener('click',()=>load());
    panel.querySelector('[data-more]').addEventListener('click',()=>load(true));
    panel.addEventListener('click',async event=>{
      const edit=event.target.closest('[data-edit-question]');
      if(edit){const row=entries.get(edit.closest('[data-correction-id]').dataset.correctionId);if(!await openBuiltinEditor(row.course,row.question_id))document.dispatchEvent(new CustomEvent('course:edit-published',{detail:{course:row.course,id:row.question_id}}));return;}
      const button=event.target.closest('[data-decision]');if(!button)return;
      const article=button.closest('[data-correction-id]'),row=entries.get(article.dataset.correctionId);
      const note=article.querySelector('textarea').value.trim();if(!note){const field=article.querySelector('textarea');field.required=true;field.reportValidity();field.focus();status('請填寫此筆回報的處理說明，再選擇處理狀態。');return;}
      article.querySelectorAll('button').forEach(node=>node.disabled=true);
      try{await api('/api/corrections/'+row.id,{method:'POST',body:JSON.stringify({status:button.dataset.decision,revision:row.revision,note})});await load();}
      catch(error){status(error.message);article.querySelectorAll('button').forEach(node=>node.disabled=false);}
    });
  }
  panel.hidden=!allowed;
  if(!allowed){sequence++;panel.open=false;entries.clear();panel.querySelector('[data-list]').replaceChildren();status('');}
}
function status(text){panel.querySelector('[role="status"]').textContent=text;}
async function load(append=false){
  const seq=++sequence;status('正在載入勘誤…');
  try{
    const result=await api('/api/corrections?status='+panel.querySelector('select').value+(append&&cursor?'&cursor='+encodeURIComponent(cursor):''));
    if(seq!==sequence || panel.hidden)return;
    if(!append){entries.clear();panel.querySelector('[data-list]').replaceChildren();}
    for(const row of result.items){
      entries.set(row.id,row);const q=row.snapshot;
      const page=row.course==='os'?'os.html':'algorithms.html';
      const url='https://yocheng06.github.io/course-library/'+page+'?question='+encodeURIComponent(row.question_id);
      panel.querySelector('[data-list]').insertAdjacentHTML('beforeend',`<article class="draft-card" data-correction-id="${esc(row.id)}"><h3>${esc(row.question_id)} · ${esc(row.course)}</h3><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">開啟題目</a><p>${esc(q.stem ?? q.q ?? '')}</p><p>回報時顯示的答案（供核對）：${esc(q.reportedAnswer || '未附，請開啟題目核對')}</p><h4>問題說明</h4><p style="white-space:pre-wrap">${esc(row.detail)}</p><h4>建議與來源</h4><p style="white-space:pre-wrap">${esc(row.suggestion || '未提供')}</p><p>回報編號：${esc(row.id)} · ${esc(new Date(row.created_at).toLocaleString('zh-TW'))}</p><label>處理說明（必填）<textarea maxlength="2000" rows="3">${esc(row.note)}</textarea></label><div class="actions"><button type="button" class="button secondary" data-edit-question>編輯這道題目</button><button type="button" class="button secondary" data-decision="confirmed">確認需更正</button><button type="button" class="button" data-decision="resolved">標為已處理</button><button type="button" class="text-button" data-decision="rejected">不採納</button></div></article>`);
    }
    cursor=result.nextCursor;panel.querySelector('[data-more]').hidden=!cursor;status(entries.size?`已載入 ${entries.size} 筆勘誤。`:'此狀態沒有勘誤。');
  }catch(error){if(seq===sequence){status(error.message);if(error.status===401)correctionsAccess(false);}}
}
