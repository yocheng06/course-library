import {api, esc, downloadJSON, showSimilar} from './contributions-ui.js?v=treasure-unit-20261030';
import {COURSE_UNITS, TYPES, unitLabel} from './contribution-model.js?v=treasure-unit-20261030';

const labels = {all:'全部題目',modified:'最近修改',deleted:'已移除',pending:'待核對'};
const keyOf = row => row.key || `${row.source}:${row.course}:${row.id}`;
const dateText = value => value ? new Date(value).toLocaleString('zh-TW') : '尚無修改';
const comparable = q => JSON.stringify(['stem','translation','type','category','options','optionTranslations','answer','explanation','note','images'].map(k=>q?.[k]??''));
const canonical = raw => ({...raw,stem:raw?.stem??raw?.q??'',options:raw?.options??raw?.opts??[],answer:raw?.answer??raw?.a??'',explanation:raw?.explanation??raw?.ex??'',images:(raw?.images||[]).map(x=>typeof x==='string'?x:x.src),translation:raw?.translation||'',optionTranslations:raw?.optionTranslations||[]});

export function setupLibraryManager({userId='',onChanged=()=>{}}={}) {
  const panel=document.getElementById('libraryWorkspace'), dialog=document.getElementById('questionDialog');
  const $=id=>document.getElementById(id);
  const cache=new Map(), details=new Map(), selected=new Map();
  let view='modified', activeKey='', current=null, history=null, controller=null, detailController=null, sequence=0, detailSequence=0, busy=false, actionPending=false, timer=null, dirty=false, counts=null, focusReturn=null, focusScroll=0, draftFailed=false;
  const scrollPositions={all:0,modified:0,deleted:0};
  let drafts={};
  const draftKey=`course-library.manager-drafts.v2.${userId}`;
  try { drafts=JSON.parse(localStorage.getItem(draftKey)||'{}'); if(!drafts||Array.isArray(drafts))drafts={}; } catch {}
  panel.innerHTML=`<div class="library-heading"><div><h2 id="libraryTitle">最近修改</h2><p id="libraryHint" class="muted">包含已退回原始內容的修改紀錄。</p></div><button type="button" class="button secondary" id="refreshLibrary">重新同步</button></div>
    <form id="librarySearch" class="library-filters"><label>科目<select id="libraryCourse" name="course">${Object.entries(COURSE_UNITS).map(([id,c])=>`<option value="${id}">${esc(c.name)}</option>`).join('')}</select></label><label>單元<select id="libraryUnit" name="unit"><option value="">全部單元</option></select></label><label>來源<select id="librarySource" name="source"><option value="all">所有來源</option><option value="builtin">內建題目</option><option value="community">同學投稿</option></select></label><label>排序<select id="librarySort" name="sort"><option value="updated">最近異動</option><option value="id">題目順序</option></select></label><label class="library-query">搜尋題目<input id="libraryQuery" name="q" type="search" maxlength="100" placeholder="題號、題幹、答案或解析"></label><button type="submit" class="button">搜尋</button></form>
    <p id="libraryStatus" class="muted" role="status" aria-live="polite"></p><div id="libraryError" class="notice error" role="alert" hidden></div><div id="libraryBulk" class="library-bulk" hidden><span id="librarySelectedCount"></span><button id="libraryRemoveSelected" type="button" class="button danger">移除選取題目</button><button id="libraryRestoreSelected" type="button" class="button secondary">還原選取題目</button><button id="libraryClearSelected" type="button" class="button secondary">取消選取</button></div><div class="library-table-wrap"><table class="library-table"><caption class="sr-only">題目管理清單</caption><thead><tr><th scope="col"><label class="library-check"><input id="librarySelectVisible" type="checkbox" aria-label="勾選目前顯示的題目">全選</label></th><th scope="col">題目</th><th scope="col">單元／來源</th><th scope="col">狀態／最近異動</th><th scope="col">操作</th></tr></thead><tbody id="libraryRows"></tbody></table></div><button id="libraryMore" type="button" class="button secondary" hidden>載入更多題目</button>`;
  function query() { const p=new URLSearchParams(); for(const id of ['Course','Unit','Source','Sort','Query'])p.set({Course:'course',Unit:'unit',Source:'source',Sort:'sort',Query:'q'}[id],$('library'+id).value.trim());p.set('state',view);return p; }
  function say(text,error=false) { $('libraryStatus').textContent=text; $('libraryError').hidden=!error;$('libraryError').textContent=error?text:''; }
  function badge(row) {return row.deleted?'已移除':row.pendingReview?'待核對':row.currentOriginal?(row.hasHistory?'原始內容 · 曾修改':'原始內容'):row.hasHistory?'已修改':'公開中';}
  function rowMarkup(row) { const key=esc(keyOf(row)); return `<tr data-row="${key}"><td><input type="checkbox" data-select="${key}" aria-label="選取題目 ${esc(row.id)}" ${selected.has(keyOf(row))?'checked':''} ${busy?'disabled':''}></td><td><button type="button" class="question-title" data-open="${key}">${esc(row.stem)}</button><span class="question-id">${esc(row.id)} · ${esc(row.type)}</span></td><td>${esc(row.unitLabel||unitLabel(row.course,row.unit,row.unitTitle))}<span class="source-badge">${row.source==='builtin'?'內建題目':'同學投稿'}</span></td><td><span class="state-badge ${row.deleted?'removed':''}">${esc(badge(row))}</span><span class="question-id">${esc(dateText(row.updatedAt))} · 版本 ${row.revision}</span></td><td><div class="row-actions"><button type="button" class="text-button" data-open="${key}">${row.deleted?'查看':'編輯'}</button><button type="button" class="text-button" data-history="${key}">${row.hasHistory?'修改歷史':'版本紀錄'}</button>${row.deleted?`<button type="button" class="text-button" data-recover="${key}">還原題目</button>`:''}</div></td></tr>`; }
  function selectionStatus(){
    const boxes=[...$('libraryRows').querySelectorAll('[data-select]')];boxes.forEach(box=>box.disabled=busy);
    const removable=[...selected.values()].filter(row=>!row.deleted).length,restorable=selected.size-removable;
    $('libraryBulk').hidden=!selected.size;$('librarySelectedCount').textContent=`已選 ${selected.size} 題（可移除 ${removable} 題、可還原 ${restorable} 題；全選只包含目前載入的題目）`;
    $('librarySelectVisible').disabled=!boxes.length||busy;$('librarySelectVisible').checked=boxes.length>0&&boxes.every(box=>box.checked);$('librarySelectVisible').indeterminate=boxes.some(box=>box.checked)&&!$('librarySelectVisible').checked;
    $('libraryRemoveSelected').textContent=`移除選取題目（${removable}）`;$('libraryRemoveSelected').disabled=busy||!removable;
    $('libraryRestoreSelected').textContent=`還原選取題目（${restorable}）`;$('libraryRestoreSelected').disabled=busy||!restorable;$('libraryClearSelected').disabled=busy;
  }
  function render(record) { $('libraryRows').innerHTML=record.items.length?record.items.map(rowMarkup).join(''):'<tr><td colspan="5" class="empty-state">目前沒有符合條件的題目。試試其他單元或搜尋文字。</td></tr>';$('libraryMore').hidden=!record.nextCursor;say(`符合 ${record.total} 題，已顯示 ${record.items.length} 題。`);selectionStatus(); }
  function setCounts(next) {counts=next||counts;if(!counts)return;for(const name of Object.keys(labels)){const node=document.querySelector(`[data-count="${name}"]`);if(node)node.textContent=counts[name]??0;} }
  function units(list) {const selected=$('libraryUnit').value;$('libraryUnit').innerHTML='<option value="">全部單元</option>'+list.map(u=>`<option value="${esc(u.id)}">${esc(u.label||unitLabel($('libraryCourse').value,u.id,u.title))}</option>`).join('');if(list.some(u=>u.id===selected))$('libraryUnit').value=selected;}
  async function load({refresh=false,append=false}={}) {
    const params=query(),key=params.toString(),cached=cache.get(key);
    controller?.abort();const request=++sequence;
    if(!append&&activeKey&&activeKey!==key)selected.clear();
    if(!refresh&&!append&&cached&&Date.now()-cached.at<30000){activeKey=key;units(cached.units||[]);setCounts(cached.counts);render(cached);panel.removeAttribute('aria-busy');$('refreshLibrary').disabled=false;$('libraryMore').disabled=false;return;}
    controller=new AbortController();
    if(append&&cached?.nextCursor)params.set('cursor',cached.nextCursor);
    if(cached&&!append&&activeKey!==key)render(cached);
    activeKey=key;panel.setAttribute('aria-busy','true');$('refreshLibrary').disabled=true;$('libraryMore').disabled=true;say(cached?'正在同步；目前清單仍可查看…':'正在載入題目…');
    try {const data=await api('/api/manage/library?'+params,{signal:controller.signal});if(request!==sequence)return;
      const record={...data,items:append?[...(cached?.items||[]),...data.items]:data.items,at:Date.now()};cache.set(key,record);if(cache.size>16)cache.delete(cache.keys().next().value);units(data.units||[]);setCounts(data.counts);render(record);
    }catch(error){if(error.name!=='AbortError'&&request===sequence){if(!cached)$('libraryRows').innerHTML='<tr><td colspan="5" class="empty-state">載入未完成，請按「重新同步」。</td></tr>';say(error.message+' 已載入的內容仍保留。',true);}}
    finally{if(request===sequence){panel.removeAttribute('aria-busy');$('refreshLibrary').disabled=false;$('libraryMore').disabled=false;}}
  }
  function summaryFrom(item){return {...item,pendingReview:item.question?.submissionReview?.status==='pending',key:keyOf(item),stem:item.question.stem,answer:item.question.answer,category:item.question.category,type:item.question.type,deleted:!!item.deleted||item.published===false,hasHistory:item.hasHistory??item.revision>0};}
  function updateRow(item,old) {
    const summary=summaryFrom(item),key=keyOf(summary);
    selected.delete(key);
    if(counts&&old){const delta=(condition)=>Number(condition(summary))-Number(condition(old));counts={all:counts.all+delta(r=>!r.deleted),modified:counts.modified+delta(r=>r.hasHistory),deleted:counts.deleted+delta(r=>r.deleted),pending:(counts.pending||0)+delta(r=>r.pendingReview&&!r.deleted)};setCounts(counts);}
    for(const [queryKey,record] of cache){const p=new URLSearchParams(queryKey),index=record.items.findIndex(r=>keyOf(r)===key);record.at=0;record.counts=counts; if(index<0)continue;
      const fits=(p.get('state')!=='pending'||summary.pendingReview&&!summary.deleted)&&(p.get('state')!=='deleted'||summary.deleted)&&(p.get('state')!=='all'||!summary.deleted)&&(!p.get('unit')||p.get('unit')===summary.unit)&&(p.get('state')!=='modified'||summary.hasHistory)&&(!p.get('q')||JSON.stringify(summary).toLocaleLowerCase().includes(p.get('q').toLocaleLowerCase()));
      if(fits)record.items[index]=summary;else {record.items.splice(index,1);record.total--;}
    }
    const record=cache.get(activeKey),node=[...$('libraryRows').children].find(n=>n.dataset.row===key);
    if(node){const fresh=record?.items.find(r=>keyOf(r)===key);if(fresh)node.outerHTML=rowMarkup(fresh);else node.remove();}
    if(record)say(`符合 ${record.total} 題，已顯示 ${record.items.length} 題。已同步這道題目的變更。`);
    selectionStatus();onChanged();
  }
  async function fetchItem(row,force=false,signal=detailController?.signal){const key=keyOf(row),known=details.get(key);if(!force&&known?.revision===row.revision)return known;const p=new URLSearchParams({source:row.source,course:row.course,id:row.id});const data=await api('/api/manage/library/item?'+p,{signal});const item={...row,...data.item,source:row.source,key,question:canonical(data.item.question),original:canonical(data.item.original)};details.set(key,item);return item;}
  function dialogStatus(text,error=false){const n=$('editorStatus');if(n){n.textContent=text;n.classList.toggle('error',error);}}
  function reviewControls(item){
    const review=item.question.submissionReview;if(review?.status!=='pending')return '';
    const refs=review.references||[];
    return `<aside class="notice pending-review"><strong>投稿版本待核對</strong><p>${esc(review.reason)}</p><p>確認保留會解除標記；合併會保留既有題目並將此版本移至「已移除」，內容及歷史仍可查看。</p>${refs.length?`<label>對照既有題目<select id="reviewTarget">${refs.map(id=>`<option value="${esc(id)}">${esc(id)}</option>`).join('')}</select></label><p>${refs.map(id=>`<a target="_blank" rel="noopener" href="https://yocheng06.github.io/course-library/${item.course==='os'?'os':'algorithms'}.html?question=${encodeURIComponent(id)}">查看 ${esc(id)}</a>`).join(' · ')}</p>`:''}<button type="button" class="button secondary" data-action="resolve">確認保留此版本</button>${refs.length?'<button type="button" class="button secondary" data-action="merge">合併至選取的既有題目</button>':''}</aside>`;
  }
  function shell(item,tab) {dialog.innerHTML=`<div class="editor-header"><div><p class="eyebrow">${esc(unitLabel(item.course,item.unit,item.unitTitle))} · ${item.source==='builtin'?'內建題目':'同學投稿'}</p><h2 id="questionDialogTitle" tabindex="-1">${esc(item.question.stem)}</h2><p class="muted">${esc(item.id)} · 版本 ${item.revision} · ${esc(badge(item))}</p></div><button type="button" class="button secondary" data-close>返回清單</button></div>${reviewControls(item)}<div class="editor-tabs" role="tablist" aria-label="題目內容與紀錄"><button role="tab" id="editTab" aria-controls="editPanel" aria-selected="${tab==='edit'}" tabindex="${tab==='edit'?0:-1}" data-tab="edit">編輯題目</button><button role="tab" id="historyTab" aria-controls="historyPanel" aria-selected="${tab==='history'}" tabindex="${tab==='history'?0:-1}" data-tab="history">修改歷史</button></div><p id="editorStatus" role="status" aria-live="polite"></p><div class="editor-scroll"><section id="editPanel" role="tabpanel" aria-labelledby="editTab" ${tab==='edit'?'':'hidden'}></section><section id="historyPanel" role="tabpanel" aria-labelledby="historyTab" ${tab==='history'?'':'hidden'}></section></div><div class="editor-footer"><div class="editor-secondary-actions">${item.hasHistory&&!item.deleted?'<button class="button secondary" type="button" data-action="previous">退回上一版</button><button class="text-button" type="button" data-action="original">退回原始版</button>':''}<button type="button" class="text-button danger" data-action="${item.deleted?'recover':'remove'}">${item.deleted?'還原題目':'移除此題'}</button></div><button type="button" class="button" id="saveQuestion" data-action="save" ${tab!=='edit'||item.deleted?'hidden':''}>儲存並同步題庫</button></div>`;}
  function fields(q){const field=(name,label,value,rows=3,max=10000)=>`<label>${label}<textarea name="${name}" rows="${rows}" maxlength="${max}">${esc(value)}</textarea></label>`;return `<form id="managedQuestionForm"><div class="field-grid"><label>分類<input name="category" maxlength="100" value="${esc(q.category)}" required></label><label>題型<select name="type">${TYPES.map(t=>`<option ${t===q.type?'selected':''}>${t}</option>`).join('')}</select></label></div>${field('stem','題目',q.stem)}<details class="optional-fields"><summary>題幹翻譯與選項翻譯（選填）</summary>${field('translation','題幹翻譯',q.translation)}${field('optionTranslations','選項翻譯（一行一個，對應相同順序）',(q.optionTranslations||[]).join('\n'),4)}</details>${field('options','選項（一行一個；填空題留白）',q.options.join('\n'),5,18000)}${field('answer','正確答案',q.answer,2,4000)}<label class="consent"><input name="answerProvided" type="checkbox" ${q.answerProvided!==false?'checked':''}>已確認並提供答案</label>${field('explanation','解析（選填）',q.explanation,5,16000)}<details class="optional-fields"><summary>題目備註與原有題圖</summary>${field('note','題目備註（選填）',q.note||'',2,4000)}${q.images.map((src,i)=>`<div class="image-previews"><img src="${esc(src)}" alt="原有題圖 ${i+1}" loading="lazy"><label><input type="checkbox" name="image" value="${esc(src)}" checked>保留此題圖</label></div>`).join('')}</details>${field('editNote','修改說明（選填）','',2,2000)}<p class="muted" id="draftState">修改會先暫存在這台裝置；按儲存後才會公開。</p><div class="similar-warning" hidden></div><button type="submit" hidden>儲存</button></form>`;}
  function read(){const form=$('managedQuestionForm'),value=name=>form.elements.namedItem(name)?.value||'';return {...current.question,category:value('category'),type:value('type'),stem:value('stem'),translation:value('translation'),options:value('options').split(/\r?\n/).filter(s=>s.trim()),optionTranslations:value('optionTranslations').trim()?value('optionTranslations').split(/\r?\n/):[],answer:value('answer'),answerProvided:form.elements.namedItem('answerProvided').checked,explanation:value('explanation'),note:value('note'),images:[...form.querySelectorAll('[name=image]:checked')].map(n=>n.value)};}
  function persist(){clearTimeout(timer);if(!current||!dirty||!$('managedQuestionForm'))return;drafts[keyOf(current)]={revision:current.revision,sourceHash:current.sourceHash,question:read(),note:$('managedQuestionForm').elements.namedItem('editNote').value,savedAt:Date.now()};try{localStorage.setItem(draftKey,JSON.stringify(drafts));dirty=false;draftFailed=false;if($('draftState'))$('draftState').textContent='草稿已保存在這台裝置，尚未公開。';}catch{draftFailed=true;if($('draftState'))$('draftState').textContent='本機草稿保存失敗，請先下載草稿或儲存到題庫。';}}
  function renderEdit(){if($('managedQuestionForm'))return;const draft=drafts[keyOf(current)],usable=draft?.revision===current.revision&&draft?.sourceHash===current.sourceHash;const q=usable?canonical(draft.question):current.question;$('editPanel').innerHTML=fields(q);if(usable){$('managedQuestionForm').elements.namedItem('editNote').value=draft.note||'';$('draftState').textContent='已恢復此版本的本機草稿，尚未公開。';}else if(draft)$('draftState').textContent='另有舊版本草稿，未覆蓋目前題目；可從「管理工具」下載核對。';if(current.deleted){for(const n of $('managedQuestionForm').querySelectorAll('input,select,textarea'))n.disabled=true;}}
  function historyPath(item){return item.source==='builtin'?`/api/manage/builtin-questions/${item.course}/${encodeURIComponent(item.id)}/history`:`/api/manage/questions/${encodeURIComponent(item.id)}/history`;}
  function normalizedHistory(items){if(current.source==='builtin')return items.map(r=>({...r,date:r.createdAt,before:canonical(r.before),after:canonical(r.after),restoreQuestion:canonical(r.before),targetRevision:r.revision-1}));return items.map((r,i)=>({...r,date:r.created_at,before:canonical(r.data),after:i?canonical(items[i-1].data):current.question,targetRevision:r.revision,historyId:r.id}));}
  function diffMarkup(record){const names={stem:'題目',translation:'題幹翻譯',type:'題型',category:'分類',options:'選項',optionTranslations:'選項翻譯',answer:'正確答案',explanation:'解析',note:'備註',images:'題圖'};const keys=Object.keys(names).filter(k=>JSON.stringify(record.before[k]??'')!==JSON.stringify(record.after[k]??''));const show=value=>Array.isArray(value)?value.join('\n'):String(value||'（空白）');return keys.length?keys.map(k=>`<section class="field-diff"><h4>${names[k]}</h4><div class="diff-columns"><div><strong>修改前</strong><p>${esc(show(record.before[k]))}</p></div><div><strong>修改後</strong><p>${esc(show(record.after[k]))}</p></div></div></section>`).join(''):'<p class="muted">題目內容相同；這次紀錄保留了狀態或版本變更。</p>';}
  async function showHistory(){if(history){renderHistory();return;}const request=detailSequence;$('historyPanel').innerHTML='<p role="status">正在載入修改歷史…</p>';try{const data=await api(historyPath(current),{signal:detailController.signal});if(request!==detailSequence)return;history=normalizedHistory(data.items);renderHistory();}catch(error){if(error.name!=='AbortError')$('historyPanel').innerHTML=`<p class="error">${esc(error.message)}</p><button type="button" class="button secondary" data-retry-history>重新載入歷史</button>`;}}
  function renderHistory(){$('historyPanel').innerHTML=history.length?`<p class="muted">先顯示異動欄位。還原會建立新版本，保留目前內容與全部歷史。</p>`+history.map((r,i)=>`<article class="history-record"><div class="section-heading"><h3>版本 ${r.targetRevision} → ${r.targetRevision+1}</h3><button type="button" class="button secondary" data-restore-version="${i}">還原修改前的版本 ${r.targetRevision}</button></div><p class="muted">${esc(dateText(r.date))} · ${/匿名/.test(r.actor||'')?'匿名使用者':'站主'}</p><p>${esc(r.note||'未填寫修改說明')}</p>${diffMarkup(r)}<details><summary>查看完整題目內容</summary><h4>修改前</h4><pre>${esc(JSON.stringify(r.before,null,2))}</pre><h4>修改後</h4><pre>${esc(JSON.stringify(r.after,null,2))}</pre></details></article>`).join(''):'<p class="empty-state">這道題目尚無修改紀錄。</p>';}
  async function selectTab(tab){for(const name of ['edit','history']){const selected=name===tab;$(name+'Tab').setAttribute('aria-selected',String(selected));$(name+'Tab').tabIndex=selected?0:-1;$(name+'Panel').hidden=!selected;}$('saveQuestion').hidden=tab!=='edit'||current.deleted;if(tab==='edit')renderEdit();else await showHistory();}
  async function open(row,tab='edit',recover=false){persist();detailController?.abort();detailController=new AbortController();const request=++detailSequence;focusReturn=document.activeElement;focusScroll=window.scrollY;current=null;history=null;dialog.innerHTML='<div class="editor-header"><h2 id="questionDialogTitle" tabindex="-1">正在載入題目…</h2><button type="button" class="button secondary" data-close>返回清單</button></div>';if(!dialog.open)dialog.showModal();
    try{const item=await fetchItem(row);if(request!==detailSequence)return;current=item;shell(item,tab);await selectTab(tab);$('questionDialogTitle').focus({preventScroll:true});if(recover)await action('recover');}catch(error){if(error.name!=='AbortError')dialog.innerHTML=`<div class="editor-header"><h2 id="questionDialogTitle">載入未完成</h2><button type="button" class="button secondary" data-close>返回清單</button></div><p class="error">${esc(error.message)}</p>`;}}
  function clearDraft(){delete drafts[keyOf(current)];try{localStorage.setItem(draftKey,JSON.stringify(drafts));}catch{}dirty=false;}
  function endpoint(){return current.source==='builtin'?`/api/manage/builtin-questions/${current.course}/${encodeURIComponent(current.id)}`:`/api/manage/questions/${encodeURIComponent(current.id)}`;}
  async function action(kind,historyIndex){
    if(busy||actionPending||!current)return;
    const form=$('managedQuestionForm');
    if(kind==='save'&&!form.reportValidity())return;
    if(['resolve','merge'].includes(kind)&&form&&comparable(read())!==comparable(current.question)){dialogStatus('請先儲存題目修改，再確認保留或合併已公開的版本。',true);return;}
    actionPending=true;
    const old=summaryFrom(current),editNote=form?.elements.namedItem('editNote')?.value.trim()||'站主管理題目';
    let body={revision:current.revision,note:editNote,...(current.source==='builtin'?{sourceHash:current.sourceHash}:{})},target;
    try{
      persist();
      if(kind==='save'){
        const question=read();
        if(current.source==='builtin')body={...body,action:'update',question};
        else body={...body,action:'update',payload:{course:current.course,unit:current.unit,unitTitle:current.unitTitle||'',title:'題目修正',questions:[question]},confirmSimilar:form.querySelector('.similar-consent')?.checked===true};
      }else{
        if(kind==='resolve')body={...body,action:'resolveReview',note:'站主核對後確認保留此版本'};
        else if(kind==='merge')body={...body,action:'mergeReview',targetId:$('reviewTarget')?.value,note:'站主合併至既有題目，保留此版本供還原'};
        else if(kind==='version'){
          const r=history[historyIndex];target=r.before;
          body=current.source==='builtin'?{...body,action:'update',question:target,note:`站主還原至版本 ${r.targetRevision}`}:{...body,action:'restoreVersion',historyId:r.historyId,note:`站主還原至版本 ${r.targetRevision}`};
        }else if(kind==='previous'){
          if(!history){dialogStatus('正在確認上一個版本…');const data=await api(historyPath(current),{signal:detailController?.signal});history=normalizedHistory(data.items);}
          if(!history.length){dialogStatus('沒有可退回的上一版。');return;}
          target=history[0].before;body={...body,action:'rollback',note:'站主退回上一版'};
        }else if(kind==='original'){target=current.original;body={...body,action:current.source==='builtin'?'reset':'resetOriginal',note:'站主退回原始版'};}
        else if(kind==='remove')body={...body,action:current.source==='builtin'?'delete':'hide',note:'站主移除題目（可還原）'};
        else if(kind==='recover')body={...body,action:current.source==='builtin'?'rollback':'restore',note:'站主還原移除的題目'};
        const label={resolve:'確認保留此投稿版本並解除待核對標記',merge:'保留既有題目並移除此投稿版本',version:'還原選定版本',previous:'退回上一版',original:'退回原始版',remove:'移除此題',recover:'還原此題'}[kind];
        if(!confirm(`確定${label}？\n\n${current.question.stem}\n目前答案：${current.question.answer}${target?'\n還原後答案：'+target.answer:''}\n\n目前內容與歷史都會保留。`))return;
      }
      busy=true;dialog.setAttribute('aria-busy','true');for(const n of dialog.querySelectorAll('button'))n.disabled=true;dialogStatus('正在儲存，請稍候…');
      const result=await api(endpoint(),{method:'POST',body:JSON.stringify(body)});
      clearDraft();details.delete(keyOf(current));
      const active=$('historyTab')?.getAttribute('aria-selected')==='true'?'history':'edit';
      const newRow={...current,...result.item,question:canonical(result.item?.question||current.question),revision:result.item?.revision??current.revision+1,hasHistory:true,source:current.source,key:keyOf(current)};
      let detailRefreshError=null;
      try{current=await fetchItem(newRow,true);}catch(error){detailRefreshError=error;current=newRow;details.set(keyOf(current),current);}
      history=null;updateRow(current,old);
      const rowNode=[...$('libraryRows').children].find(n=>n.dataset.row===keyOf(current));
      focusReturn=rowNode?.querySelector('[data-open]')||$('libraryTitle');
      shell(current,active);await selectTab(active);
      dialogStatus(detailRefreshError?'儲存已完成並已記錄版本；題目詳細內容暫時無法重新整理，稍後重新開啟即可確認。':'已同步到公開題庫。此版本也已保留在修改歷史中。',Boolean(detailRefreshError));
    }catch(error){
      dialogStatus(error.message+' 編輯內容與草稿仍保留。',true);
      if(error.details?.code==='similar_questions'&&$('managedQuestionForm'))showSimilar($('managedQuestionForm').querySelector('.similar-warning'),error.details.possibleDuplicates);
    }finally{
      actionPending=false;busy=false;dialog.removeAttribute('aria-busy');for(const n of dialog.querySelectorAll('button'))n.disabled=false;selectionStatus();
    }
  }
  async function changeSelected(restoring=false){
    if(busy||actionPending||!selected.size)return;
    const rows=[...selected.values()].filter(row=>Boolean(row.deleted)===restoring);if(!rows.length)return;
    const verb=restoring?'還原':'移除',untouched=selected.size-rows.length;
    if(!confirm(`確定${verb}選取的 ${rows.length} 題？\n\n${rows.slice(0,3).map(row=>row.id+'：'+row.stem.slice(0,70)).join('\n')}${rows.length>3?'\n…另有 '+(rows.length-3)+' 題':''}\n\n${restoring?'還原後會重新公開；若與既有題目重複，會保留原狀並列出原因。':'移除後會停止公開，可到「已移除」還原。'}內容與修改歷史會保留。${untouched?'\n另有 '+untouched+' 題不適用此動作，將維持原狀。':''}`))return;
    busy=true;let done=0;const failures=[];
    panel.querySelectorAll('input,select,button').forEach(node=>node.disabled=true);
    try{
      for(const [i,row] of rows.entries()){
        say(`正在${verb} ${i+1}／${rows.length} 題，已完成 ${done} 題…`);
        try{
          const item=await fetchItem(row,true,null);
          if(item.revision!==row.revision||Boolean(item.deleted)!==restoring)throw new Error('題目狀態已變更，請重新核對後再選取。');
          const path=item.source==='builtin'?`/api/manage/builtin-questions/${item.course}/${encodeURIComponent(item.id)}`:`/api/manage/questions/${encodeURIComponent(item.id)}`;
          await api(path,{method:'POST',body:JSON.stringify({action:restoring?(item.source==='builtin'?'rollback':'restore'):(item.source==='builtin'?'delete':'hide'),revision:item.revision,...(item.source==='builtin'?{sourceHash:item.sourceHash}:{}),note:`站主批次${verb}題目（保留歷史）`})});
          done++;selected.delete(keyOf(row));details.delete(keyOf(row));
        }catch(error){failures.push(`${row.id}：${error.message}`);}
      }
    }finally{
      panel.querySelectorAll('input,select,button').forEach(node=>node.disabled=false);cache.clear();
      await load({refresh:true});busy=false;selectionStatus();
      say(`已${verb} ${done} 題。${restoring?'還原後已重新公開。':'可到「已移除」還原。'}${failures.length?' 尚有 '+failures.length+' 題未完成，仍保留勾選。\n'+failures.join('\n'):''}`,failures.length>0);
      if(done)onChanged();
    }
  }
  $('libraryRows').addEventListener('change',event=>{const box=event.target.closest('[data-select]');if(!box||busy)return;const row=cache.get(activeKey)?.items.find(row=>keyOf(row)===box.dataset.select);if(!row)return;if(box.checked)selected.set(keyOf(row),{...row});else selected.delete(keyOf(row));selectionStatus();});
  $('librarySelectVisible').addEventListener('change',event=>{if(busy)return;const checked=event.target.checked;for(const row of cache.get(activeKey)?.items||[]){if(checked)selected.set(keyOf(row),{...row});else selected.delete(keyOf(row));}const record=cache.get(activeKey);if(record)render(record);});
  $('libraryClearSelected').addEventListener('click',()=>{if(busy)return;selected.clear();const record=cache.get(activeKey);if(record)render(record);});
  $('libraryRemoveSelected').addEventListener('click',()=>changeSelected(false));
  $('libraryRestoreSelected').addEventListener('click',()=>changeSelected(true));
  $('librarySearch').addEventListener('submit',event=>{event.preventDefault();if(!busy)load({refresh:true});});
  for(const id of ['libraryCourse','libraryUnit','librarySource','librarySort'])$(id).addEventListener('change',()=>{if(id==='libraryCourse')$('libraryUnit').value='';load();});
  $('refreshLibrary').addEventListener('click',()=>load({refresh:true}));$('libraryMore').addEventListener('click',()=>load({append:true}));
  $('libraryRows').addEventListener('click',event=>{if(busy)return;const button=event.target.closest('[data-open],[data-history],[data-recover]');if(!button)return;const key=button.dataset.open||button.dataset.history||button.dataset.recover,row=cache.get(activeKey)?.items.find(r=>keyOf(r)===key);if(row)open(row,button.dataset.history?'history':'edit',!!button.dataset.recover);});
  dialog.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-close')){if(!busy)dialog.close();return;}if(button.dataset.tab){persist();selectTab(button.dataset.tab);return;}if(button.hasAttribute('data-retry-history')){showHistory();return;}if(button.dataset.action)action(button.dataset.action);if(button.dataset.restoreVersion!==undefined)action('version',Number(button.dataset.restoreVersion));});
  dialog.addEventListener('submit',event=>{event.preventDefault();action('save');});
  dialog.addEventListener('input',()=>{if(!current||busy)return;dirty=true;clearTimeout(timer);if($('draftState'))$('draftState').textContent='正在暫存草稿…';timer=setTimeout(persist,350);});
  dialog.addEventListener('change',()=>{if(!current||busy)return;dirty=true;clearTimeout(timer);timer=setTimeout(persist,350);});
  dialog.addEventListener('keydown',event=>{const tab=event.target.closest('[role=tab]');if(tab&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=tab.dataset.tab==='edit'?'history':'edit';selectTab(next);$(next+'Tab').focus();}});
  dialog.addEventListener('cancel',event=>{if(busy||actionPending)event.preventDefault();});dialog.addEventListener('close',()=>{persist();detailController?.abort();detailSequence++;if(focusReturn?.isConnected)focusReturn.focus({preventScroll:true});else $('libraryTitle')?.focus({preventScroll:true});window.scrollTo({top:focusScroll,behavior:'instant'});});
  const beforeLeave=event=>{persist();if(draftFailed){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeLeave);window.addEventListener('pagehide',persist);
  return {async show(next='modified',options={}){persist();if(next!==view)scrollPositions[view]=window.scrollY;view=next;panel.hidden=false;$('libraryTitle').textContent=labels[next];$('libraryHint').textContent=next==='pending'?'投稿已收錄；請核對版本差異，再決定保留、合併或移除。':next==='modified'?'包含已退回原始內容的修改紀錄。':next==='deleted'?'公開刪除與站主下架的題目都保留在這裡，可以還原。':'選一題編輯或查看修改歷史；來源只作為篩選條件。';await load({refresh:options.refresh===true});if(next!==view)return;requestAnimationFrame(()=>window.scrollTo({top:scrollPositions[next],behavior:'instant'}));},refresh(){cache.clear();return load({refresh:true});},exportDrafts(){persist();downloadJSON({savedAt:new Date().toISOString(),drafts},'題目編輯草稿.json');},clear(){controller?.abort();detailController?.abort();clearTimeout(timer);sequence++;detailSequence++;cache.clear();details.clear();drafts={};current=null;dirty=false;dialog.close();panel.replaceChildren();window.removeEventListener('beforeunload',beforeLeave);}};
}
