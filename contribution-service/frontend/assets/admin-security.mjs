export function setupAdminSecurity({container,api,message,downloadJSON}) {
  let timer,generation=0;
  const clear=()=>{generation++;clearTimeout(timer);container.replaceChildren();};
  async function show(){
    clear();const current=generation,state=await api('/api/manage/security');if(current!==generation)return;
    container.innerHTML=`<h2>帳號安全</h2><p data-status></p>
      <p>第二道驗證使用手機驗證器產生的 6 位數驗證碼，例如 Google Authenticator 或 Microsoft Authenticator。備援碼可在手機遺失時登入，每組只能使用一次。</p>
      <form data-security-form class="login-form"><label>目前密碼<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label>
      ${state.enabled?'<label>驗證碼或備援碼<input name="code" autocomplete="one-time-code" maxlength="48" required></label>':''}
      <button type="submit" class="button" name="action" value="${state.enabled?'revoke':'enroll'}">${state.enabled?'登出其他所有裝置':'開始設定第二道驗證'}</button>
      ${state.enabled?'<button type="submit" class="button secondary" name="action" value="disable">關閉第二道驗證</button>':'<button type="submit" class="button secondary" name="action" value="revoke">登出其他所有裝置</button>'}</form>
      <section data-enrollment hidden><h3>加入手機驗證器</h3><p>在驗證器選「手動輸入設定金鑰」，類型選「依時間」。此金鑰只顯示在本頁，10 分鐘內完成確認。</p>
      <p>名稱：課程題庫</p><label>設定金鑰<input data-secret readonly autocomplete="off" spellcheck="false"></label>
      <form data-confirm class="login-form"><label>手機顯示的 6 位數驗證碼<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button class="button" type="submit">確認並啟用</button></form></section>
      <section data-recovery hidden><h3>請保存備援碼</h3><p>第二道驗證已啟用。備援碼只會顯示這一次，請存到密碼管理器或離線安全位置，不要公開或傳給他人。此區會在 3 分鐘後收起。</p><pre data-codes></pre><button type="button" class="button secondary" data-download>下載備援碼</button><button type="button" class="button" data-saved>我已保存，收起備援碼</button></section>
      <h3>備份與復原</h3><p>D1 內建 Time Travel 自動保存資料庫復原點；可回復範圍依 Cloudflare 帳戶方案。完整題庫備份可另外下載到自己的裝置，避免只保存在同一個帳戶。</p><button type="button" class="button secondary" data-backup>前往完整題庫備份</button>`;
    container.querySelector('[data-status]').textContent=state.enabled?`第二道驗證：已啟用。尚有 ${state.recoveryRemaining} 組備援碼。登入最長 ${state.sessionHours} 小時。`:'第二道驗證：尚未啟用。完成手機驗證後才會生效。';
    container.querySelector('[data-backup]').addEventListener('click',()=>document.getElementById('exportBackup').click());
    function busy(form,value){for(const b of form.querySelectorAll('button'))b.disabled=value;}
    const form=container.querySelector('[data-security-form]');
    form.addEventListener('submit',async event=>{
      event.preventDefault();const action=event.submitter.value;
      if(action==='disable'&&!confirm('關閉後登入將只需要密碼。確定關閉第二道驗證？'))return;
      busy(form,true);
      try{
        const payload={password:form.elements.password.value,code:form.elements.code?.value||''};
        const result=await api('/api/manage/security/'+action,{method:'POST',body:JSON.stringify(payload)});
        if(current!==generation)return;
        form.reset();
        if(action==='enroll'){
          container.querySelector('[data-secret]').value=result.secret;
          container.querySelector('[data-enrollment]').hidden=false;
          timer=setTimeout(()=>{const input=container.querySelector('[data-secret]');if(input)input.value='';const panel=container.querySelector('[data-enrollment]');if(panel)panel.hidden=true;},600000);
          message('請在手機驗證器新增金鑰，再輸入驗證碼完成設定。');
        }else{await show();message(action==='disable'?'已關閉第二道驗證，其他裝置已登出。':'其他所有裝置已登出，目前裝置仍可使用。');}
      }catch(error){message(error.message,true);}finally{busy(form,false);}
    });
    const confirmForm=container.querySelector('[data-confirm]');
    confirmForm.addEventListener('submit',async event=>{
      event.preventDefault();busy(confirmForm,true);
      try{
        const result=await api('/api/manage/security/confirm',{method:'POST',body:JSON.stringify({code:confirmForm.elements.code.value})});
        if(current!==generation)return;
        clearTimeout(timer);container.querySelector('[data-secret]').value='';confirmForm.reset();container.querySelector('[data-enrollment]').hidden=true;
        container.querySelector('[data-status]').textContent='第二道驗證：已啟用。請先保存備援碼。';
        container.querySelector('[data-recovery]').hidden=false;container.querySelector('[data-codes]').textContent=result.recoveryCodes.join('\n');
        container.querySelector('[data-download]').onclick=()=>downloadJSON({warning:'請離線安全保存，每組只能使用一次；登入仍需要密碼。',codes:result.recoveryCodes},'課程題庫-管理員備援碼.json');
        container.querySelector('[data-saved]').onclick=()=>show().catch(e=>message(e.message,true));
        form.hidden=true;timer=setTimeout(()=>show().catch(e=>message(e.message,true)),180000);
        message('第二道驗證已啟用，其他裝置已登出。');
      }catch(error){message(error.message,true);}finally{busy(confirmForm,false);}
    });
  }
  return {show,clear};
}
