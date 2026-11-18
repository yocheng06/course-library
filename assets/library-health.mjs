import {canonicalQuestion,comparisonMarkup} from './question-comparison.mjs?v=workflow-improvements-20261102';
import {api,esc} from './contributions-ui.js?v=treasure-unit-20261030';
import {COURSE_UNITS,unitLabel} from './contribution-model.js?v=treasure-unit-20261030';

export function analyzeLibrary(items) {
  const keys=item=>(item.stemKeys?.length?item.stemKeys:[item.stemKey||canonicalQuestion(item.question).stem.normalize('NFC').replace(/\s+/g,'').toLowerCase()]).filter(Boolean).map(k=>item.course+'|'+k);
  const groups=new Map();
  for(const item of items){
    const q=canonicalQuestion(item.question);
    if(!q.stem.trim()||item.deleted)continue;
    for(const key of keys(item)){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  }
  return items.filter(i=>!i.deleted).map(item=>{
    const q=canonicalQuestion(item.question),issues=[];q.explanation=item.effectiveExplanation??q.explanation;
    if(!q.explanation.trim()||/^(?:原始題庫尚未提供本題詳細解析[。.]?|尚未提供解析[。.]?)$/.test(q.explanation.trim()))issues.push('缺解析');
    if(!q.answer.trim()||item.question.answerProvided===false)issues.push('缺答案');
    else if(q.options.length && !(globalThis.courseChoiceAnswers||globalThis.window?.courseChoiceAnswers).expectedChoiceKey(q.answer,q.options))issues.push('答案無法對應選項');
    const duplicates=[...new Map(keys(item).flatMap(key=>groups.get(key)||[]).filter(other=>other.id!==item.id).map(other=>[other.id,other])).values()];
    if(duplicates.length)issues.push('疑似重複');
    return {...item,issues,duplicates:duplicates.map(i=>i.id)};
  });
}

export function setupLibraryHealth({container,openItem,onChanged=()=>{}}) {
  let rows=[],visible=25,stamp=0,loadedCourse='',imageResults=new Map(),checking=false,complete=true;
  container.innerHTML=`<div class="library-heading"><div><h2>題庫健檢</h2><p>只檢查資料完整性與版本差異，不判定老師答案對錯、不自動刪題。疑似重複可能是不同選項版本。</p></div><button type="button" class="button secondary" data-health-refresh>重新檢查題庫</button></div><div class="library-filters"><label>科目<select data-health-course>${Object.entries(COURSE_UNITS).map(([id,c])=>`<option value="${id}">${esc(c.name)}</option>`).join('')}</select></label><label>單元<select data-health-unit><option value="">全部單元</option></select></label><label>問題類型<select data-health-filter><option value="all">全部問題</option>${['缺解析','缺答案','答案無法對應選項','疑似重複','圖片無法確認'].map(n=>`<option>${n}</option>`).join('')}</select></label><button type="button" class="button secondary" data-health-images>檢查題圖連結</button><button type="button" class="button secondary" data-health-stop hidden>停止檢查圖片</button></div><p data-health-status role="status" aria-live="polite"></p><div data-health-rows></div><button type="button" class="button secondary" data-health-more hidden>載入更多</button>`;
  const $=sel=>container.querySelector(sel);
  function matching(){return rows.filter(r=>(!$('[data-health-unit]').value||r.unit===$('[data-health-unit]').value)&&(r.issues.length||imageResults.get(r.id)==='無法確認')).filter(r=>$('[data-health-filter]').value==='all'||($('[data-health-filter]').value==='圖片無法確認'?imageResults.get(r.id)==='無法確認':r.issues.includes($('[data-health-filter]').value)));}
  function render(){
    const list=matching();
    $('[data-health-rows]').innerHTML=list.slice(0,visible).map(row=>`<article class="health-card" data-health-row="${esc(row.id)}"><h3>${esc(row.question.stem??row.question.q)}</h3><p>${esc(unitLabel(row.course,row.unit,row.unitTitle))} · ${esc(row.id)} · ${esc(row.issues.join('、'))}${imageResults.has(row.id)?' · 題圖：'+esc(imageResults.get(row.id)):''}</p><button type="button" class="button secondary" data-health-edit="${esc(row.id)}">編輯此題</button>${row.duplicates.length?`<details><summary>並排比較疑似重複版本（${row.duplicates.length}）</summary><label>對照題目<select data-health-compare="${esc(row.id)}"><option value="">選擇對照版本</option>${row.duplicates.map(id=>`<option value="${esc(id)}">${esc(id)}</option>`).join('')}</select></label><button type="button" class="button secondary" data-health-edit-target="${esc(row.id)}">編輯對照題</button><p>兩個版本目前都保留。若確定要移除其中一題，請進入該題編輯器；移除後仍可在「已移除」還原。</p><div data-health-comparison></div><div class="actions"><button type="button" class="button secondary" data-health-remove-other="${esc(row.id)}">保留本題、移除對照題</button><button type="button" class="button secondary" data-health-remove-this="${esc(row.id)}">保留對照題、移除本題</button></div></details>`:''}</article>`).join('')||'<p>目前篩選範圍沒有符合的問題。題圖需另外執行連結檢查。</p>';
    $('[data-health-more]').hidden=list.length<=visible;
    const counts=['缺解析','缺答案','答案無法對應選項','疑似重複'].map(issue=>issue+' '+rows.filter(r=>r.issues.includes(issue)).length+' 題').join(' · ');
    $('[data-health-stop]').hidden=!checking;
    $('[data-health-status]').textContent=`${complete?'':'題目超過單次上限，目前只顯示部分投稿。'}已檢查 ${rows.length} 題 · ${counts}。本篩選符合 ${list.length} 題，顯示 ${Math.min(visible,list.length)} 題。題圖已檢查 ${imageResults.size} 題、無法確認 ${[...imageResults.values()].filter(v=>v==='無法確認').length} 題${checking?'（檢查中）':''}。`;
  }
  async function show({refresh=false}={}){
    const course=$('[data-health-course]').value;
    if(!refresh&&loadedCourse===course){render();return;}
    const request=++stamp;checking=false;$('[data-health-images]').disabled=false;
    $('[data-health-status]').textContent='正在檢查最新題庫；原有清單仍可查看…';$('[data-health-refresh]').disabled=true;
    try{
      const data=await api('/api/manage/health?course='+encodeURIComponent(course));if(request!==stamp)return;
      rows=analyzeLibrary(data.items);complete=data.complete!==false;loadedCourse=course;imageResults.clear();visible=25;
      const units=[...new Map(rows.map(r=>[r.unit,r.unitTitle||''])).entries()];
      $('[data-health-unit]').innerHTML='<option value="">全部單元</option>'+units.map(([id,title])=>`<option value="${esc(id)}">${esc(unitLabel(course,id,title))}</option>`).join('');render();
    }catch(error){if(request===stamp)$('[data-health-status]').textContent='檢查未完成：'+error.message+'。已載入的清單仍保留，可按重新檢查重試。';}
    finally{if(request===stamp)$('[data-health-refresh]').disabled=false;}
  }
  function checkImage(src){return new Promise(resolve=>{
    if(typeof src!=='string'||!/^https?:\/\//i.test(src)){resolve(false);return;}
    const image=new Image();let timer;const finish=ok=>{clearTimeout(timer);image.onload=image.onerror=null;resolve(ok);};
    image.onload=()=>finish(true);image.onerror=()=>finish(false);timer=setTimeout(()=>finish(false),6000);image.src=src;
  });}
  async function checkImages(){
    if(checking||!loadedCourse)return;checking=true;const request=stamp;$('[data-health-images]').disabled=true;
    const targets=rows.filter(r=>(r.question.images||[]).length&&(!$('[data-health-unit]').value||r.unit===$('[data-health-unit]').value));let next=0;
    const worker=async()=>{while(next<targets.length&&request===stamp){const row=targets[next++];const results=await Promise.all((row.question.images||[]).map(i=>checkImage(typeof i==='string'?i:i.src)));if(request!==stamp)return;imageResults.set(row.id,results.every(Boolean)?'可載入':'無法確認');$('[data-health-status]').textContent=`題圖檢查中：已檢查 ${imageResults.size} 題。可停止檢查後查看目前結果。`;}};
    await Promise.all(Array.from({length:3},worker));if(request!==stamp)return;checking=false;$('[data-health-images]').disabled=false;render();
    $('[data-health-status]').textContent+=' 無法確認可能是網路、存取限制或連結失效，請開啟原題核對。';
  }
  container.addEventListener('change',event=>{
    if(event.target.matches('[data-health-course]')){show({refresh:true});return;}
    const compare=event.target.closest('[data-health-compare]');
    if(compare){const row=rows.find(r=>r.id===compare.dataset.healthCompare),other=rows.find(r=>r.id===compare.value);compare.closest('details').querySelector('[data-health-comparison]').innerHTML=other?comparisonMarkup({...row.question,explanation:row.effectiveExplanation??row.question.explanation},{...other.question,explanation:other.effectiveExplanation??other.question.explanation},{leftTitle:row.id,rightTitle:other.id}):'';return;}
    if(event.target.matches('[data-health-unit],[data-health-filter]')){visible=25;render();}
  });
  container.addEventListener('click',event=>{
    if(event.target.closest('[data-health-stop]')){stamp++;checking=false;$('[data-health-images]').disabled=false;render();return;}
    if(event.target.closest('[data-health-refresh]'))show({refresh:true});
    if(event.target.closest('[data-health-images]'))checkImages();
    if(event.target.closest('[data-health-more]')){visible+=25;render();}
    const removal=event.target.closest('[data-health-remove-other],[data-health-remove-this]');
    if(removal){
      const otherId=removal.closest('details').querySelector('[data-health-compare]').value;
      const other=rows.find(r=>r.id===otherId),current=rows.find(r=>r.id===(removal.dataset.healthRemoveOther||removal.dataset.healthRemoveThis));
      if(!other||!current){$('[data-health-status]').textContent='請先選擇並核對對照版本。';return;}
      openItem(removal.hasAttribute('data-health-remove-other')?other:current,{remove:true});return;
    }
    const target=event.target.closest('[data-health-edit-target]');if(target){const id=target.closest('details').querySelector('[data-health-compare]').value;const row=rows.find(r=>r.id===id);if(row)openItem(row);else $('[data-health-status]').textContent='請先選擇要編輯的對照版本。';return;}
    const edit=event.target.closest('[data-health-edit]');if(edit)openItem(rows.find(r=>r.id===edit.dataset.healthEdit));
  });
  return {show,invalidate(){loadedCourse='';},clear(){stamp++;rows=[];imageResults.clear();container.replaceChildren();}};
}
