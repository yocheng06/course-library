import {COURSE_UNITS,normalizeBatch,normalizeType} from './contribution-model.js?v=os8-deadlocks-20261023';
import {api,esc,questionPreview,downloadJSON,showSimilar} from './contributions-ui.js?v=site-audit-20261017';

export function groupImport(data, fallback, filename='匯入題庫') {
  const groups=new Map();let count=0;
  function visit(value, context) {
    if(Array.isArray(value)){value.forEach(item=>visit(item,context));return;}
    if(!value || typeof value!=='object')throw new Error('匯入資料必須是題目或單元清單。');
    const course=value.course ?? context.course;
    if(!COURSE_UNITS[course])throw new Error('科目不正確，請使用 os 或 algorithms。');
    const nested=Array.isArray(value.questions) || Array.isArray(value.groups) || Array.isArray(value.units);
    const unit=value.unit ?? (nested && value.id ? value.id : context.unit);
    if(!nested && !COURSE_UNITS[course].units[unit])throw new Error(`找不到單元「${unit}」，請在匯入檔指定有效的 unit。`);
    const next={course,unit,title:value.title || context.title,name:value.name ?? context.name,source:value.source ?? context.source};
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
      const payload=normalizeBatch({...group,questions:group.questions.slice(start,start+200)},{onDuplicate:q=>skipped.push(q)});
      const bytes=payload.questions.flatMap(q=>q.images).filter(s=>s.startsWith('data:')).reduce((n,s)=>n+s.split(',')[1].length*0.75,0);
      if(bytes>6*1024*1024)throw new Error('單一批次題圖超過 6 MB，請縮小圖片或拆分檔案。');
      result.push({payload,skippedCount:skipped.length});
    }
  }
  if(!result.length)throw new Error('沒有可匯入的題目。');
  if(result.length>20)throw new Error('一次最多 20 個批次，請拆分檔案。');
  return result;
}

export function setupGroupedSubmissions({parseImport,metadata,onReceipt,message}) {
  const key='course-library-grouped-submissions-v1';let queue=[],busy=false;
  const panel=document.createElement('section');panel.className='group-preview';
  panel.innerHTML='<h2>匯入分組預覽</h2><p>依科目與單元分組，每批最多 200 題。確認每組內容後再送出；下方手動編輯中的原草稿會保留。已送出的批次會保留收據，重試只處理未完成批次。</p><div data-groups></div><label class="consent"><input type="checkbox" data-consent>我已預覽各組題目，確認可交給站主審核並公開核准內容。</label><div class="actions"><button type="button" class="button" data-send>確認分組並逐批送出</button><button type="button" class="button secondary" data-download>下載分組草稿與收據</button><button type="button" class="text-button" data-clear>清空分組預覽</button></div><p role="status" aria-live="polite"></p>';
  document.getElementById('draftHeading').closest('section').before(panel);
  const list=panel.querySelector('[data-groups]'),status=panel.querySelector('[role="status"]'),consent=panel.querySelector('[data-consent]');
  function save(){localStorage.setItem(key,JSON.stringify({version:1,groups:queue}));}
  function render(){
    panel.hidden=!queue.length;
    list.innerHTML=queue.map((group,index)=>`<details data-group-index="${index}"><summary>${esc(COURSE_UNITS[group.payload.course].name)}／${esc(COURSE_UNITS[group.payload.course].units[group.payload.unit])} · ${group.payload.questions.length} 題 · ${group.result?'已完成':'待送出'}${group.skippedCount?`（已略過同批重複 ${group.skippedCount} 題）`:''}</summary>${group.payload.questions.map((q,i)=>questionPreview(q,i)+'</article>').join('')}${group.result?`<p>結果：${esc(group.result.status)}；收據：${esc(group.result.id || '全部已收錄，未新增投稿')}</p>`:''}<div data-similar></div><p data-error role="status"></p></details>`).join('');
    panel.querySelector('[data-send]').disabled=busy||!consent.checked||queue.every(g=>g.result);
  }
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved?.version===1 && Array.isArray(saved.groups) && saved.groups.length<=20){
      queue=saved.groups.map(group=>{
        if(!/^[0-9a-f-]{36}$/i.test(group.requestId))throw new Error('批次識別碼不正確。');
        return {payload:normalizeBatch(group.payload),requestId:group.requestId,result:group.result?.id || group.result?.status==='duplicates_only'?group.result:null,skippedCount:Number(group.skippedCount)||0};
      });
    }
  }catch(error){message('分組草稿無法讀取，原始資料未刪除。請先下載備份後重新匯入。',true);}
  consent.addEventListener('change',()=>panel.querySelector('[data-send]').disabled=busy||!consent.checked||queue.every(g=>g.result));
  panel.querySelector('[data-download]').addEventListener('click',()=>downloadJSON({version:1,groups:queue},'題庫分組草稿與收據.json'));
  panel.querySelector('[data-clear]').addEventListener('click',()=>{
    if(busy || !window.confirm('確定清空分組預覽？請先下載仍需要的草稿與收據。'))return;
    try{localStorage.removeItem(key);queue=[];consent.checked=false;render();}catch(error){status.textContent=error.message;}
  });
  panel.querySelector('[data-send]').addEventListener('click',async()=>{
    if(busy || !consent.checked)return;busy=true;panel.querySelector('[data-send]').disabled=true;
    // Snapshot consent per group; a similar-question warning needs its own explicit consent.
    try{
      for(let index=0;index<queue.length;index++){
        const group=queue[index];if(group.result)continue;
        const node=list.querySelector(`[data-group-index="${index}"]`);
        status.textContent=`正在送出第 ${index+1}／${queue.length} 批…`;
        try{
          group.result=await api('/api/submissions',{method:'POST',body:JSON.stringify({...group.payload,clientRequestId:group.requestId,website:document.getElementById('website').value,confirmSimilar:node.querySelector('.similar-consent')?.checked===true})});
          // Persist each completion before starting the next request.
          save();if(group.result.id)onReceipt(group.result,group.payload);
          node.querySelector('[data-error]').textContent=group.result.id?`已送出。收據：${group.result.id}`:'全部題目已收錄，沒有新增投稿。';
        }catch(error){
          if(error.details?.code==='similar_questions')showSimilar(node.querySelector('[data-similar]'),error.details.possibleDuplicates);
          node.open=true;node.querySelector('[data-error]').textContent=error.message;
          throw new Error(`第 ${index+1} 批未完成：${error.message}。已完成的批次不會重送，草稿與結果仍保留。`);
        }
      }
      status.textContent='各批次均已處理。請下載分組草稿與收據以備查詢。';render();
    }catch(error){status.textContent=error.message;}
    finally{busy=false;panel.querySelector('[data-send]').disabled=!consent.checked||queue.every(g=>g.result);}
  });
  render();
  return {
    async importFile(file){
      if(busy)throw new Error('請等待分組投稿完成。');
      if(file.size>8*1024*1024)throw new Error('匯入檔案最多 8 MB。');
      const parsed=parseImport(await file.text(),file.name);
      const restored=parsed?.version===1 && Array.isArray(parsed.groups) && parsed.groups.every(g=>g.payload && g.requestId);
      const groups=restored?parsed.groups.map(g=>({...g,payload:normalizeBatch(g.payload)})):groupImport(parsed,metadata(),file.name);
      const next=groups.map(g=>({...g,requestId:g.requestId||crypto.randomUUID()}));
      if(queue.some(g=>!g.result))throw new Error('仍有未送出的分組草稿，請先完成或下載並清空分組預覽，再匯入新檔。');
      if(next.length>20)throw new Error('一次最多 20 個批次。');
      const old=queue;queue=next;
      try{save();}catch(error){queue=old;throw new Error('無法保存分組草稿，原清單未變更。');}
      consent.checked=false;render();status.textContent=`已分為 ${queue.length} 批，尚未送出。請展開每組預覽。`;
      panel.scrollIntoView({block:'start'});
    },
  };
}
