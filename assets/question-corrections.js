(() => {
  'use strict';
  const config=window.courseLearning;if(!config)return;
  const dialog=document.createElement('dialog');dialog.className='correction-dialog';
  dialog.setAttribute('aria-labelledby','correction-title');
  dialog.innerHTML='<h2 id="correction-title">回報題目問題</h2><p>免登入，由站主審核後處理。回報不會直接更改公開答案，請勿填寫個人資料。</p><p data-question-label></p><form method="post"><label>問題說明（必填，至少 5 字）<textarea name="detail" required minlength="5" maxlength="4000" rows="4"></textarea></label><label>建議修正與參考來源（選填）<textarea name="suggestion" maxlength="4000" rows="3"></textarea></label><label hidden>網站<input name="website" tabindex="-1" autocomplete="off"></label><button type="submit" class="plain">送出勘誤</button></form><p role="status" aria-live="polite"></p><button type="button" data-download-receipt class="plain" hidden>下載勘誤收據</button><hr><h3>查詢勘誤進度</h3><form data-lookup method="post"><label>勘誤編號<input name="receipt" required maxlength="36"></label><button type="submit" class="plain">查詢</button></form><p data-lookup-result role="status" aria-live="polite"></p><button type="button" data-close class="plain">關閉</button>';
  document.body.append(dialog);
  const form=dialog.querySelector('form'),status=dialog.querySelector('[role="status"]'),lookup=dialog.querySelector('[data-lookup]');
  const drafts=new Map();let active=null,opener=null,pending=false,receipt=null;
  const labels={pending:'待站主審核',confirmed:'已確認需更正',resolved:'已處理',rejected:'不採納'};
  async function api(path,options={}) {
    const response=await fetch(window.courseContributions.apiOrigin+path,{...options,headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
    const body=await response.json();if(!response.ok)throw new Error(body.error || '勘誤服務暫時無法使用。');return body;
  }
  config.list.addEventListener('click',event=>{
    const button=event.target.closest('[data-correction]');if(!button)return;
    if(pending)return;
    opener=button;active=button.dataset.correction;
    const q=config.questionDetails(active),draft=drafts.get(active)||{};
    dialog.querySelector('[data-question-label]').textContent=`${q.unit}・第 ${q.number} 題（${q.id}）`;
    form.elements.detail.value=draft.detail||'';form.elements.suggestion.value=draft.suggestion||'';
    status.textContent='';form.hidden=false;receipt=null;dialog.querySelector('[data-download-receipt]').hidden=true;
    dialog.showModal();form.elements.detail.focus();
  });
  form.addEventListener('input',()=>{if(active)drafts.set(active,{detail:form.elements.detail.value,suggestion:form.elements.suggestion.value});});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending || !active || !form.reportValidity())return;
    pending=true;form.querySelector('button').disabled=true;status.textContent='正在送出…';
    try {
      receipt=await api('/api/corrections',{method:'POST',body:JSON.stringify({course:config.course,questionId:active,answerSnapshot:config.questionDetails(active).answer,detail:form.elements.detail.value,suggestion:form.elements.suggestion.value,website:form.elements.website.value})});
      drafts.delete(active);form.reset();form.hidden=true;lookup.elements.receipt.value=receipt.id;
      status.textContent=`已送交站主審核。勘誤編號：${receipt.id}。請下載收據以便日後查詢。`;
      dialog.querySelector('[data-download-receipt]').hidden=false;
    }catch(error){status.textContent=`未能確認送出結果：${error.message}。填寫內容仍保留。`;}
    finally{pending=false;form.querySelector('button').disabled=false;}
  });
  lookup.addEventListener('submit',async event=>{
    event.preventDefault();const target=dialog.querySelector('[data-lookup-result]');const id=lookup.elements.receipt.value.trim();
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)){target.textContent='請輸入完整勘誤編號。';return;}
    target.textContent='查詢中…';try{const result=await api('/api/corrections/'+id);target.textContent=(labels[result.status]||result.status)+(result.note?'；站主說明：'+result.note:'');}catch(error){target.textContent=error.message;}
  });
  dialog.querySelector('[data-download-receipt]').addEventListener('click',()=>{
    if(!receipt)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...receipt,course:config.course,questionId:active},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='題庫勘誤收據.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>opener?.isConnected && opener.focus());
})();
