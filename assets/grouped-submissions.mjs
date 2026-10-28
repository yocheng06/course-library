import {COURSE_UNITS,normalizeBatch,normalizeType,normalizeUnit,unitLabel} from './contribution-model.js?v=html-question-import-20261028';
import {api,esc,questionPreview,downloadJSON,showSimilar} from './contributions-ui.js?v=site-audit-20261017';

export function groupImport(data, fallback, filename='匯入題庫', {allowMissingAnswers=false}={}) {
  const groups=new Map();let count=0;
  function visit(value, context) {
    if(Array.isArray(value)){value.forEach(item=>visit(item,context));return;}
    if(!value || typeof value!=='object')throw new Error('匯入資料必須是題目或單元清單。');
    const course=value.course ?? context.course;
    if(!COURSE_UNITS[course])throw new Error('科目不正確，請使用 os 或 algorithms。');
    const nested=Array.isArray(value.questions) || Array.isArray(value.groups) || Array.isArray(value.units);
    let unit=value.unit ?? (nested && value.id ? value.id : context.unit);
    if(!nested) {try{unit=normalizeUnit(course,unit);}catch{throw new Error(`找不到單元「${unit}」，請指定有效的單元編號，例如 L7。`);}}
    const next={course,unit,unitTitle:value.unitTitle ?? context.unitTitle,title:value.title || context.title,name:value.name ?? context.name,source:value.source ?? context.source};
    if(nested){visit(value.questions ?? value.groups ?? value.units,next);return;}
    if(++count>2000)throw new Error('一次匯入最多 2,000 題，請拆分檔案。');
    const key=course+':'+unit;if(!groups.has(key))groups.set(key,{...next,questions:[]});
    groups.get(key).questions.push({...value,
      type:normalizeType((value.options??value.opts)?.length?value.type || '單選題':value.type==='圖片題'?'圖片題':'填空題',value.images||[]),
      images:(value.images||[]).map(image=>typeof image==='string'?image:image.src),
    });
  }
  visit(data,{...fallback,title:fallback.title||filename});
  const result=[];
  for(const group of groups.values()){
    for(let start=0;start<group.questions.length;start+=200){
      const skipped=[];
      const payload=normalizeBatch({...group,questions:group.questions.slice(start,start+200)},{allowMissingAnswers,onDuplicate:q=>skipped.push(q)});
      const bytes=payload.questions.flatMap(q=>q.images).filter(s=>s.startsWith('data:')).reduce((n,s)=>n+s.split(',')[1].length*0.75,0);
      if(bytes>6*1024*1024)throw new Error('單一批次題圖超過 6 MB，請縮小圖片或拆分檔案。');
      result.push({payload,skippedCount:skipped.length,...(allowMissingAnswers?{htmlImport:true}:{})});
    }
  }
  if(!result.length)throw new Error('沒有可匯入的題目。');
  if(result.length>20)throw new Error('一次最多 20 個批次，請拆分檔案。');
  return result;
}

export function setupGroupedSubmissions({parseImport,metadata,onReceipt,message}) {
  const key='course-library-grouped-submissions-v1';let queue=[],busy=false;
  const panel=document.createElement('section');panel.className='group-preview';
  panel.innerHTML='<h2>匯入分組預覽</h2><p>依科目與單元分組，每批最多 200 題。確認每組內容後再送出；下方手動編輯中的原草稿會保留。已送出的批次會保留收據，重試只處理未完成批次。HTML 匯入若沒有正解，請逐題補上並核對後才可送出。</p><div data-groups></div><label class="consent"><input type="checkbox" data-consent>我已預覽各組題目，確認可交給站主審核並公開核准內容。</label><div class="actions"><button type="button" class="button" data-send>確認分組並逐批送出</button><button type="button" class="button secondary" data-download>下載分組草稿與收據</button><button type="button" class="text-button" data-clear>清空分組預覽</button></div><p role="status" aria-live="polite"></p>';
  document.getElementById('draftHeading').closest('section').before(panel);
  const list=panel.querySelector('[data-groups]'),status=panel.querySelector('[role="status"]'),consent=panel.querySelector('[data-consent]');
  function save(){localStorage.setItem(key,JSON.stringify({version:1,groups:queue}));}
  function missingAnswerCount(group){return group.payload.questions.filter(q=>!String(q.answer||'').trim()).length;}
  function answerEditor(q,groupIndex,questionIndex){
    if(!q.options.length)return `<label class="import-answer-input">正確答案（必填）<input type="text" maxlength="4000" placeholder="輸入標準答案" data-import-answer="fill" data-group-index="${groupIndex}" data-question-index="${questionIndex}" value="${esc(q.answer||'')}"></label>`;
    const letters=q.options.map((_,index)=>String.fromCharCode(65+index)),selected=new Set((String(q.answer||'').match(/[A-H]/gi)||[]).map(letter=>letter.toUpperCase()));
    if(normalizeType(q.type)==='多選題')return `<fieldset class="import-answer"><legend>正確答案（必填，可複選）</legend><div class="import-answer-options">${letters.map(letter=>`<label><input type="checkbox" data-import-answer="multi" data-group-index="${groupIndex}" data-question-index="${questionIndex}" value="${letter}" ${selected.has(letter)?'checked':''}> ${letter}</label>`).join('')}</div></fieldset>`;
    return `<fieldset class="import-answer"><legend>正確答案（必填，單選）</legend><div class="import-answer-options">${letters.map(letter=>`<label><input type="radio" name="import-answer-${groupIndex}-${questionIndex}" data-import-answer="single" data-group-index="${groupIndex}" data-question-index="${questionIndex}" value="${letter}" ${selected.has(letter)?'checked':''}> ${letter}</label>`).join('')}</div></fieldset>`;
  }
  function importedPreview(q,groupIndex,questionIndex){
    const card=questionPreview({...q,answer:''},questionIndex).replace('<p><strong>答案：</strong></p>','');
    return `${card}${answerEditor(q,groupIndex,questionIndex)}</article>`;
  }
  function refreshSendButton(){
    panel.querySelector('[data-send]').disabled=busy||!consent.checked||!queue.some(group=>!group.result)||queue.some(group=>!group.result&&missingAnswerCount(group)>0);
  }
  function updateAnswerStatus(){
    const missing=queue.reduce((sum,group)=>sum+(group.result?0:missingAnswerCount(group)),0);
    queue.forEach((group,index)=>{
      const counter=list.querySelector(`[data-group-index="${index}"] [data-answer-count]`);
      if(counter)counter.textContent=`（待補正解 ${missingAnswerCount(group)} 題）`;
    });
    if(missing)status.textContent=`還有 ${missing} 題缺少正解；補齊並核對後，再勾選確認。尚未送出。`;
    else if(queue.some(group=>!group.result))status.textContent='正解已補齊。請核對題幹與選項，勾選確認後再送出。';
    refreshSendButton();
  }
  function render(){
    panel.hidden=!queue.length;
    list.innerHTML=queue.map((group,index)=>{
      const missing=missingAnswerCount(group);
      return `<details data-group-index="${index}"><summary>${esc(COURSE_UNITS[group.payload.course].name)}／${esc(unitLabel(group.payload.course,group.payload.unit,group.payload.unitTitle))} · ${group.payload.questions.length} 題 · ${group.result?'已完成':'待送出'}${group.htmlImport?` <span data-answer-count>（待補正解 ${missing} 題）</span>`:''}${group.skippedCount?`（已略過同批重複 ${group.skippedCount} 題）`:''}</summary>${group.payload.questions.map((q,i)=>group.htmlImport?importedPreview(q,index,i):questionPreview(q,i)+'</article>').join('')}${group.result?`<p>結果：${esc(group.result.status)}；收據：${esc(group.result.id || '全部已收錄，未新增投稿')}</p>`:''}<div data-similar></div><p data-error role="status"></p></details>`;
    }).join('');
    refreshSendButton();
  }
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved?.version===1 && Array.isArray(saved.groups) && saved.groups.length<=20){
      queue=saved.groups.map(group=>{
        if(!/^[0-9a-f-]{36}$/i.test(group.requestId))throw new Error('批次識別碼不正確。');
        const htmlImport=group.htmlImport===true;
        return {payload:normalizeBatch(group.payload,{allowMissingAnswers:htmlImport}),requestId:group.requestId,result:group.result?.id || group.result?.status==='duplicates_only'?group.result:null,skippedCount:Number(group.skippedCount)||0,...(htmlImport?{htmlImport:true}:{})};
      });
    }
  }catch(error){message('分組草稿無法讀取，原始資料未刪除。請先下載備份後重新匯入。',true);}
  consent.addEventListener('change',refreshSendButton);
  list.addEventListener('change',event=>{
    const input=event.target.closest('[data-import-answer]');if(!input)return;
    const groupIndex=Number(input.dataset.groupIndex),questionIndex=Number(input.dataset.questionIndex),group=queue[groupIndex],question=group?.payload.questions[questionIndex];
    if(!group?.htmlImport||!question)return;
    if(input.dataset.importAnswer==='multi'){
      const selector=`input[data-import-answer="multi"][data-group-index="${groupIndex}"][data-question-index="${questionIndex}"]`;
      question.answer=[...list.querySelectorAll(selector)].filter(node=>node.checked).map(node=>node.value).join(', ');
    }else question.answer=input.value.trim();
    consent.checked=false;
    try{save();}catch{status.textContent='答案已更新，但此裝置無法保存；請下載分組草稿備份。';refreshSendButton();return;}
    updateAnswerStatus();
  });
  panel.querySelector('[data-download]').addEventListener('click',()=>downloadJSON({version:1,groups:queue},'題庫分組草稿與收據.json'));
  panel.querySelector('[data-clear]').addEventListener('click',()=>{
    if(busy || !window.confirm('確定清空分組預覽？請先下載仍需要的草稿與收據。'))return;
    try{localStorage.removeItem(key);queue=[];consent.checked=false;render();}catch(error){status.textContent=error.message;}
  });
  panel.querySelector('[data-send]').addEventListener('click',async()=>{
    if(busy || !consent.checked)return;
    if(queue.some(group=>!group.result&&missingAnswerCount(group)>0)){updateAnswerStatus();return;}
    busy=true;panel.querySelector('[data-send]').disabled=true;
    // Snapshot consent per group; a similar-question warning needs its own explicit consent.
    try{
      for(let index=0;index<queue.length;index++){
        const group=queue[index];if(group.result)continue;
        const node=list.querySelector(`[data-group-index="${index}"]`);
        status.textContent=`正在送出第 ${index+1}／${queue.length} 批…`;
        try{
          const payload=normalizeBatch(group.payload);
          group.result=await api('/api/submissions',{method:'POST',body:JSON.stringify({...payload,clientRequestId:group.requestId,website:document.getElementById('website').value,confirmSimilar:node.querySelector('.similar-consent')?.checked===true})});
          // Persist each completion before starting the next request.
          save();if(group.result.id)onReceipt(group.result,payload);
          node.querySelector('[data-error]').textContent=group.result.id?`已送出。收據：${group.result.id}`:'全部題目已收錄，沒有新增投稿。';
        }catch(error){
          if(error.details?.code==='similar_questions')showSimilar(node.querySelector('[data-similar]'),error.details.possibleDuplicates);
          node.open=true;node.querySelector('[data-error]').textContent=error.message;
          throw new Error(`第 ${index+1} 批未完成：${error.message}。已完成的批次不會重送，草稿與結果仍保留。`);
        }
      }
      status.textContent='各批次均已處理。請下載分組草稿與收據以備查詢。';render();
    }catch(error){status.textContent=error.message;}
    finally{busy=false;refreshSendButton();}
  });
  render();
  if(queue.some(group=>group.htmlImport&&!group.result))updateAnswerStatus();
  return {
    async importFile(file){
      if(busy)throw new Error('請等待分組投稿完成。');
      if(file.size>8*1024*1024)throw new Error('匯入檔案最多 8 MB。');
      const parsed=parseImport(await file.text(),file.name);
      const restored=parsed?.version===1 && Array.isArray(parsed.groups) && parsed.groups.every(g=>g.payload && g.requestId);
      const htmlImport=parsed?.__htmlQuestionImport===true;
      const groups=restored?parsed.groups.map(g=>({...g,payload:normalizeBatch(g.payload,{allowMissingAnswers:g.htmlImport===true})})):groupImport(parsed,metadata(),file.name,{allowMissingAnswers:htmlImport});
      const next=groups.map(g=>({...g,requestId:g.requestId||crypto.randomUUID()}));
      if(queue.some(g=>!g.result))throw new Error('仍有未送出的分組草稿，請先完成或下載並清空分組預覽，再匯入新檔。');
      if(next.length>20)throw new Error('一次最多 20 個批次。');
      const old=queue;queue=next;
      try{save();}catch(error){queue=old;throw new Error('無法保存分組草稿，原清單未變更。');}
      consent.checked=false;render();
      const missing=queue.reduce((sum,group)=>sum+(group.result?0:missingAnswerCount(group)),0);
      status.textContent=missing?`已匯入 ${queue.reduce((sum,group)=>sum+group.payload.questions.length,0)} 題；${missing} 題尚缺正解，請逐題補上並核對。尚未送出。`:`已分為 ${queue.length} 批，尚未送出。請展開每組預覽。`;
      panel.scrollIntoView({block:'start'});
    },
  };
}
