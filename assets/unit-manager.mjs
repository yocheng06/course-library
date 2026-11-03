import {api,esc} from './contributions-ui.js?v=treasure-unit-20261030';
import {COURSE_UNITS} from './contribution-model.js?v=treasure-unit-20261030';
export function setupUnitManager({container,onChanged=()=>{}}){
 let rows=[],revision=0,busy=false,loaded='',sequence=0,dirty=false,drag=null,scrollFrame=null;
 container.innerHTML=`<div class="library-heading"><div><h2>管理單元</h2><p>按住每列的「拖曳」調整順序，手機可用手指拖拉；也可用上移／下移。單元編號與題目內容保持不變。</p></div><button class="button secondary" type="button" data-unit-refresh>重新載入</button></div><label>科目<select data-unit-course>${Object.entries(COURSE_UNITS).map(([id,c])=>`<option value="${id}">${esc(c.name)}</option>`).join('')}</select></label><div class="actions"><button class="button secondary" type="button" data-unit-add>＋ 新增單元</button></div><form data-unit-new hidden><div class="field-grid"><label>新單元編號<input type="number" min="1" max="99" step="1" data-unit-number required placeholder="例如：10"></label><label>新單元名稱<input maxlength="60" data-unit-name required placeholder="例如：虛擬記憶體"></label></div><p class="muted">加入清單後，再按下方「儲存單元名稱與順序」才會建立單元；之後可從投稿題庫加入題目。</p><div class="actions"><button class="button" type="submit">加入單元清單</button><button class="button secondary" type="button" data-unit-cancel>取消</button></div></form><p role="status" aria-live="polite" data-unit-status></p><div data-unit-rows role="list" aria-label="單元排序清單"></div><button class="button" type="button" data-unit-save disabled>儲存單元名稱與順序</button>`;
 const $=s=>container.querySelector(s);
 function unitCode(unit){return unit.id==='treasure'?'特別單元':unit.label?.match(/^L\d+/)?.[0]||COURSE_UNITS[loaded]?.units[unit.id]?.match(/^L\d+/)?.[0]||unit.id;}
 function status(text){$('[data-unit-status]').textContent=text;}
 function render(){
  $('[data-unit-rows]').innerHTML=rows.map((u,i)=>`<div class="unit-settings-row" data-unit-row="${esc(u.id)}" role="listitem"><button type="button" class="button secondary unit-drag-handle" data-unit-drag="${esc(u.id)}" aria-label="拖曳排序：${esc(u.title)}，也可用上下方向鍵">拖曳</button><span>${esc(unitCode(u))}${u.isNew?' · 尚未儲存':''}</span><label>單元名稱<input data-unit-title="${i}" value="${esc(u.title)}" maxlength="60" required></label><button class="button secondary" type="button" data-unit-up="${i}" ${i===0?'disabled':''} aria-label="上移 ${esc(u.title)}">上移</button><button class="button secondary" type="button" data-unit-down="${i}" ${i===rows.length-1?'disabled':''} aria-label="下移 ${esc(u.title)}">下移</button></div>`).join('');
  $('[data-unit-save]').disabled=busy||!dirty;
  $('[data-unit-add]').disabled=busy||!loaded;
  container.querySelectorAll('[data-unit-drag]').forEach(node=>node.disabled=busy||!loaded);
 }
 function moveUnit(id,to){
  const from=rows.findIndex(row=>row.id===id);if(from<0||to<0||to>=rows.length||from===to)return;
  const [item]=rows.splice(from,1);rows.splice(to,0,item);dirty=true;render();
  [...container.querySelectorAll('[data-unit-drag]')].find(node=>node.dataset.unitDrag===id)?.focus();
  status('已將「'+item.title+'」移到第 '+(to+1)+'／'+rows.length+' 位，尚未儲存。');
 }
 function positionDrag(y){
  if(!drag?.started)return;
  const list=$('[data-unit-rows]'),others=[...list.children].filter(node=>node!==drag.node);
  const before=others.find(node=>{const rect=node.getBoundingClientRect();return y<rect.top+rect.height/2;})||null;
  list.insertBefore(drag.node,before);
 }
 function autoScroll(){
  if(!drag?.started||!window.requestAnimationFrame)return;
  const height=window.innerHeight||0,y=drag.y;
  const amount=y<80?-12:y>height-80?12:0;
  if(amount){window.scrollBy?.(0,amount);positionDrag(y);}
  scrollFrame=window.requestAnimationFrame(autoScroll);
 }
 function finishDrag(cancel=false){
  if(!drag)return;
  const active=drag;drag=null;
  if(scrollFrame!==null){window.cancelAnimationFrame?.(scrollFrame);scrollFrame=null;}
  if(container.hasPointerCapture?.(active.pointerId))container.releasePointerCapture(active.pointerId);
  if(!active.started)return;
  const ids=[...$('[data-unit-rows]').children].map(node=>node.dataset.unitRow);
  const changed=ids.some((id,i)=>id!==rows[i]?.id);
  if(!cancel&&changed){const byId=new Map(rows.map(row=>[row.id,row]));rows=ids.map(id=>byId.get(id));dirty=true;}
  render();
  [...container.querySelectorAll('[data-unit-drag]')].find(node=>node.dataset.unitDrag===active.id)?.focus();
  status(cancel?'已取消拖拉，保留原本順序。':changed?'單元順序已調整，按「儲存單元名稱與順序」後才會套用。':'單元順序未變更。');
 }
 container.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-unit-drag]');
  if(!handle||busy||drag||event.isPrimary===false||(event.button!==undefined&&event.button!==0))return;
  event.preventDefault();drag={id:handle.dataset.unitDrag,node:handle.closest('[data-unit-row]'),pointerId:event.pointerId,startY:event.clientY,y:event.clientY,started:false};
  container.setPointerCapture?.(event.pointerId);
 });
 container.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;drag.y=event.clientY;
  if(!drag.started&&Math.abs(event.clientY-drag.startY)<6)return;
  event.preventDefault();
  if(!drag.started){drag.started=true;drag.node.classList.add('unit-dragging');status('正在拖拉「'+rows.find(row=>row.id===drag.id).title+'」，放開即可確認位置。');autoScroll();}
  positionDrag(event.clientY);
 });
 container.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId)finishDrag();});
 container.addEventListener('pointercancel',event=>{if(drag&&event.pointerId===drag.pointerId)finishDrag(true);});
 container.addEventListener('lostpointercapture',event=>{if(drag&&event.pointerId===drag.pointerId)finishDrag(true);});
 container.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&drag){event.preventDefault();finishDrag(true);return;}
  const handle=event.target.closest('[data-unit-drag]');if(!handle||busy||drag||!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();moveUnit(handle.dataset.unitDrag,rows.findIndex(row=>row.id===handle.dataset.unitDrag)+(event.key==='ArrowUp'?-1:1));
 });
 async function show({refresh=false}={}){
  const course=$('[data-unit-course]').value;if(drag)finishDrag(true);if(!refresh&&loaded===course)return;
  const ticket=++sequence;busy=true;container.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);status('正在載入單元…');
  try{const data=await api('/api/manage/units?course='+encodeURIComponent(course));if(ticket!==sequence)return;rows=data.units;revision=data.revision;loaded=course;dirty=false;$('[data-unit-new]').hidden=true;render();status('儲存後，閱讀、查題與投稿頁會在同步題庫後使用新名稱與順序。');}
  catch(error){status('載入未完成：'+error.message);}
  finally{if(ticket===sequence){busy=false;container.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);render();}}
 }
 container.addEventListener('submit',event=>{
  if(!event.target.matches('[data-unit-new]'))return;event.preventDefault();if(busy||!loaded)return;
  const number=Number($('[data-unit-number]').value),title=$('[data-unit-name]').value.trim();
  if(!Number.isInteger(number)||number<1||number>99||!title||title.length>60){status('請填寫 1–99 的單元編號與名稱。');return;}
  const id='L'+number,existing=Object.entries(COURSE_UNITS[loaded].units).find(([,label])=>label.startsWith(id+' · '))?.[0]||id;
  if(rows.some(u=>u.id===existing)){status('這個單元編號已存在，請直接修改原單元或使用其他編號。');return;}
  rows.push({id,title,label:id+' · '+title,order:rows.length+1,isNew:true});dirty=true;render();$('[data-unit-new]').hidden=true;status('已加入新單元「'+title+'」，尚未儲存。可調整順序後按下方儲存。');
 });
 container.addEventListener('input',event=>{const node=event.target.closest('[data-unit-title]');if(!node||busy)return;rows[Number(node.dataset.unitTitle)].title=node.value;dirty=true;$('[data-unit-save]').disabled=false;});
 container.addEventListener('change',event=>{if(event.target.matches('[data-unit-course]')){if(dirty&&!confirm('尚有未儲存的單元設定，確定切換科目？')){event.target.value=loaded;return;}show({refresh:true});}});
 container.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy||drag)return;
  if(button.hasAttribute('data-unit-add')){
    const numbers=[...rows.map(u=>Number(u.id.match(/^L(\d+)$/)?.[1]||u.label?.match(/^L(\d+)/)?.[1]||0)),...Object.values(COURSE_UNITS[loaded]?.units||{}).map(label=>Number(label.match(/^L(\d+)/)?.[1]||0))];
    const next=Math.max(0,...numbers)+1;
    $('[data-unit-number]').value=next<=99?String(next):'';$('[data-unit-name]').value='';$('[data-unit-new]').hidden=false;$('[data-unit-number]').focus();return;
  }
  if(button.hasAttribute('data-unit-cancel')){$('[data-unit-new]').hidden=true;return;}
  if(button.hasAttribute('data-unit-refresh')){if(!dirty||confirm('放棄尚未儲存的單元設定並重新載入？'))show({refresh:true});return;}
  if(button.hasAttribute('data-unit-up')||button.hasAttribute('data-unit-down')){const index=Number(button.dataset.unitUp??button.dataset.unitDown),other=index+(button.hasAttribute('data-unit-up')?-1:1);if(!rows[other])return;[rows[index],rows[other]]=[rows[other],rows[index]];dirty=true;render();return;}
  if(!button.hasAttribute('data-unit-save'))return;
  if(rows.some(u=>!u.title.trim())){status('請填寫每個單元的名稱。');return;}
  busy=true;container.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);status('正在儲存…');
  try{const data=await api('/api/manage/units?course='+encodeURIComponent(loaded),{method:'POST',body:JSON.stringify({revision,units:rows.map(({id,title})=>({id,title}))})});rows=data.units;revision=data.revision;dirty=false;status('單元名稱與順序已儲存。公開頁面同步後會更新；舊設定已保留於管理備份。');onChanged();}
  catch(error){status(error.message+' 尚未儲存的設定仍保留。');}
  finally{busy=false;container.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);render();}
 });
 return {show,invalidate(){loaded='';},clear(){if(drag)finishDrag(true);sequence++;container.replaceChildren();}};
}
