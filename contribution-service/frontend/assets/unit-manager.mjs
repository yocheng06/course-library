import {api,esc} from './contributions-ui.js?v=treasure-unit-20261030';
import {COURSE_UNITS} from './contribution-model.js?v=treasure-unit-20261030';
export function setupUnitManager({container,onChanged=()=>{}}){
 let rows=[],revision=0,busy=false,loaded='',sequence=0,dirty=false;
 container.innerHTML=`<div class="library-heading"><div><h2>管理單元</h2><p>修改名稱或用上下移動調整顯示順序；單元編號與題目內容保持不變。</p></div><button class="button secondary" type="button" data-unit-refresh>重新載入</button></div><label>科目<select data-unit-course>${Object.entries(COURSE_UNITS).map(([id,c])=>`<option value="${id}">${esc(c.name)}</option>`).join('')}</select></label><p role="status" aria-live="polite" data-unit-status></p><div data-unit-rows></div><button class="button" type="button" data-unit-save disabled>儲存單元名稱與順序</button>`;
 const $=s=>container.querySelector(s);
 function status(text){$('[data-unit-status]').textContent=text;}
 function render(){
  $('[data-unit-rows]').innerHTML=rows.map((u,i)=>`<div class="unit-settings-row"><span>${esc(u.id)}</span><label>單元名稱<input data-unit-title="${i}" value="${esc(u.title)}" maxlength="60" required></label><button class="button secondary" type="button" data-unit-up="${i}" ${i===0?'disabled':''} aria-label="上移 ${esc(u.title)}">上移</button><button class="button secondary" type="button" data-unit-down="${i}" ${i===rows.length-1?'disabled':''} aria-label="下移 ${esc(u.title)}">下移</button></div>`).join('');
  $('[data-unit-save]').disabled=busy||!dirty;
 }
 async function show({refresh=false}={}){
  const course=$('[data-unit-course]').value;if(!refresh&&loaded===course)return;
  const ticket=++sequence;busy=true;container.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);status('正在載入單元…');
  try{const data=await api('/api/manage/units?course='+encodeURIComponent(course));if(ticket!==sequence)return;rows=data.units;revision=data.revision;loaded=course;dirty=false;render();status('儲存後，閱讀、查題與投稿頁會在同步題庫後使用新名稱與順序。');}
  catch(error){status('載入未完成：'+error.message);}
  finally{if(ticket===sequence){busy=false;container.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);render();}}
 }
 container.addEventListener('input',event=>{const node=event.target.closest('[data-unit-title]');if(!node||busy)return;rows[Number(node.dataset.unitTitle)].title=node.value;dirty=true;$('[data-unit-save]').disabled=false;});
 container.addEventListener('change',event=>{if(event.target.matches('[data-unit-course]')){if(dirty&&!confirm('尚有未儲存的單元設定，確定切換科目？')){event.target.value=loaded;return;}show({refresh:true});}});
 container.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.hasAttribute('data-unit-refresh')){if(!dirty||confirm('放棄尚未儲存的單元設定並重新載入？'))show({refresh:true});return;}
  if(button.hasAttribute('data-unit-up')||button.hasAttribute('data-unit-down')){const index=Number(button.dataset.unitUp??button.dataset.unitDown),other=index+(button.hasAttribute('data-unit-up')?-1:1);if(!rows[other])return;[rows[index],rows[other]]=[rows[other],rows[index]];dirty=true;render();return;}
  if(!button.hasAttribute('data-unit-save'))return;
  if(rows.some(u=>!u.title.trim())){status('請填寫每個單元的名稱。');return;}
  busy=true;container.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);status('正在儲存…');
  try{const data=await api('/api/manage/units?course='+encodeURIComponent(loaded),{method:'POST',body:JSON.stringify({revision,units:rows.map(({id,title})=>({id,title}))})});rows=data.units;revision=data.revision;dirty=false;status('單元名稱與順序已儲存。公開頁面同步後會更新；舊設定已保留於管理備份。');onChanged();}
  catch(error){status(error.message+' 尚未儲存的設定仍保留。');}
  finally{busy=false;container.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);render();}
 });
 return {show,invalidate(){loaded='';},clear(){sequence++;container.replaceChildren();}};
}
