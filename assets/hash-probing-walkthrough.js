(() => {
 'use strict';
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cache=new Map();
 function parse(question){
  const text=String(question?.q??question?.stem??'');
  // Never guess a method or formula when a future question uses a different version.
  if(!/開放定址法|open addressing/i.test(text)||!/h['′]\s*\(k\)\s*=\s*k\s*[。.,，\s]/.test(text))return null;
  const keys=text.match(/將鍵值\s+([\d、,，\s]+)\s+插入/)?.[1].split(/[、,，\s]+/).filter(Boolean).map(Number);
  const size=Number(text.match(/m\s*=\s*(\d+)/)?.[1]);
  if(!keys?.length||keys.length>200||keys.some(k=>!Number.isSafeInteger(k)||k>1e12)||!Number.isInteger(size)||size<2||size>101)return null;
  const double=/雙重雜湊|double hashing/i.test(text),quadratic=/二次探測|quadratic probing/i.test(text),linear=/線性探測|linear probing/i.test(text);
  if(Number(double)+Number(quadratic)+Number(linear)!==1)return null;
  const input={keys,size,method:double?'double':quadratic?'quadratic':'linear'};
  if(quadratic){
   input.c1=Number(text.match(/c_?1\s*=\s*(\d+)/)?.[1]);input.c2=Number(text.match(/c_?2\s*=\s*(\d+)/)?.[1]);
   if(![input.c1,input.c2].every(v=>Number.isSafeInteger(v)&&v<=1e6)||input.c2===0)return null;
  }
  if(double){
   if(!/h1\(k\)\s*=\s*k\s+和\s+h2\(k\)\s*=\s*\d+\s*\+\s*\(k\s+mod\s+\(m\s*-\s*1\)\)/i.test(text))return null;
   input.stepBase=Number(text.match(/h2\(k\)\s*=\s*(\d+)\s*\+/i)?.[1]);
   if(!Number.isSafeInteger(input.stepBase)||input.stepBase>1e6)return null;
  }
  return input;
 }
 function trace(input){
  const {keys,size,method,c1,c2,stepBase}=input,table=Array(size).fill(null),failed=[];
  const states=[{table:table.slice(),kind:'initial',placed:0,failed:[],keyIndex:-1}];let placed=0;
  keys.forEach((key,keyIndex)=>{
   const step=method==='double'?stepBase+key%(size-1):1;let inserted=false;
   for(let i=0;i<size;i++){
    const offset=method==='quadratic'?c1*i+c2*i*i:i*step,slot=(key+offset)%size,occupant=table[slot];
    if(occupant===null){table[slot]=key;placed++;inserted=true;}
    states.push({key,keyIndex,i,step,offset,slot,occupant,kind:inserted?'insert':'collision',table:table.slice(),placed,failed:failed.slice()});
    if(inserted)break;
   }
   if(!inserted){failed.push(key);states.push({key,keyIndex,step,kind:'failed',table:table.slice(),placed,failed:failed.slice()});}
  });
  return {input,states,table:table.slice(),failed};
 }
 function dataFor(input){
  const key=JSON.stringify(input);if(!cache.has(key)){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,trace(input));}return cache.get(key);
 }
 function formula(input){
  const {method,size,c1,c2,stepBase}=input;
  return method==='double'?`h(k,i)=(k+i×(${stepBase}+(k mod ${size-1}))) mod ${size}`:method==='quadratic'?`h(k,i)=(k+${c1}i+${c2}i²) mod ${size}`:`h(k,i)=(k+i) mod ${size}`;
 }
 function message(data,index){
  const state=data.states[index],{size,method,stepBase}=data.input;
  if(state.kind==='initial')return '先從空表開始。按「下一步」，計算第一個鍵的初始位置；每遇到一次碰撞，也會停下來讓你看清楚。';
  if(state.kind==='failed')return `鍵 ${state.key} 已試過 i=0～${size-1}，仍未找到空槽，本鍵無法插入。${method==='double'?`步長 ${state.step} 不一定能走遍表格，不能因為其他格空著就直接放入。`: '這組表長與係數的探測位置可能重複，不能任意跳到公式以外的空格。'}`;
  const step=method==='double'?`步長=${stepBase}+(${state.key} mod ${size-1})=${state.step}。`:'',calculation=`i=${state.i}，(${state.key}+${state.offset}) mod ${size}=${state.slot}。`;
  return `目前鍵 ${state.key}（第 ${state.keyIndex+1} 個）。${step}${calculation}`+(state.kind==='insert'?`A[${state.slot}] 是空槽，放入 ${state.key}。`:`A[${state.slot}] 已有 ${state.occupant}，發生碰撞；保留原值，${state.i===size-1?'已用完本鍵允許的探測次數。':`下一步改試 i=${state.i+1}。`}`);
 }
 function body(data,index){
  const state=data.states[index],last=index===data.states.length-1;
  const keys=data.input.keys.map((key,i)=>`<li${i===state.keyIndex?' class="hash-current-key" aria-current="step"':''}>${key}</li>`).join('');
  const values=state.table.map((value,slot)=>{
   const active=slot===state.slot,kind=active?state.kind:'';
   return `<td class="${value===null?'hash-empty ':''}${active?'hash-'+kind:''}">${value===null?'—':value}${active?`<span class="hash-cell-note">${kind==='insert'?'剛放入':'碰撞'}</span>`:''}</td>`;
  }).join('');
  let next='下一步：計算第一個鍵的初始位置。';
  if(state.kind==='collision')next=index+1<data.states.length&&data.states[index+1].kind==='failed'?'下一步：確認本鍵已用完允許的探測次數。':`下一步：同一鍵繼續嘗試 i=${state.i+1}，表內原有數值不移動。`;
  else if(state.kind!=='initial')next=last?'全部鍵已處理完畢，可對照下方文字解析與選項。':`下一步：換鍵 ${data.input.keys[state.keyIndex+1]}，將 i 重設為 0。`;
  return `<p class="hash-key-label">依序插入（框線標示目前的鍵）</p><ol class="hash-keys">${keys}</ol><div class="hash-scroll" tabindex="0" role="region" aria-label="雜湊表 A，可左右捲動"><table><caption>雜湊表 A（— 表示空槽）</caption><thead><tr><th scope="row">索引</th>${state.table.map((_,i)=>`<th scope="col">${i}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">內容</th>${values}</tr></tbody></table></div><p class="hash-progress">已放入 ${state.placed}／${data.input.keys.length} 個鍵${state.failed.length?'；無法插入：'+state.failed.join('、'):''}。</p><p class="hash-next">${escape(next)}</p>`;
 }
 function markup(question){
  const input=parse(question);if(!input)return '';
  const data=dataFor(input),names={linear:'線性探測',quadratic:'二次探測',double:'雙重雜湊'};
  return `<section class="hash-walkthrough" data-hash-input="${escape(JSON.stringify(input))}" data-hash-step="0" aria-label="雜湊表逐步演示"><h4>${names[input.method]}：一步一步放入雜湊表</h4><p class="hash-formula">${escape(formula(input))}</p><p class="hash-hint">從索引 0 開始；每按一次會顯示一次探測。碰撞時不改表，找到空槽才放入。表格可左右捲動。</p><div data-hash-body>${body(data,0)}</div><div class="hash-controls"><button type="button" data-hash-action="previous" disabled>← 上一步</button><button type="button" data-hash-action="next">下一步 →</button><button type="button" data-hash-action="restart">重新開始</button><button type="button" data-hash-action="finish">看完成結果</button></div><p class="hash-counter" data-hash-counter>第 0／${data.states.length-1} 步</p><p class="hash-status" data-hash-status role="status" aria-live="polite">${escape(message(data,0))}</p><p class="hash-hint">下面保留完整文字解析，方便對照每一步的計算。</p></section>`;
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-hash-action]'),root=button?.closest('[data-hash-input]');if(!root)return;
  let data;try{data=dataFor(JSON.parse(root.dataset.hashInput));}catch{return;}
  const last=data.states.length-1,current=Number(root.dataset.hashStep),action=button.dataset.hashAction;
  const index=action==='restart'?0:action==='finish'?last:Math.max(0,Math.min(last,current+(action==='next'?1:-1)));
  root.dataset.hashStep=String(index);
  root.querySelector('[data-hash-counter]').textContent=`第 ${index}／${last} 步`;
  root.querySelector('[data-hash-status]').textContent=message(data,index);
  root.querySelector('[data-hash-body]').innerHTML=body(data,index);
  const scroll=root.querySelector('.hash-scroll'),active=scroll.querySelector('.hash-insert,.hash-collision');
  if(active?.getBoundingClientRect&&scroll.getBoundingClientRect){
   const cell=active.getBoundingClientRect(),viewport=scroll.getBoundingClientRect();
   if(cell.right>viewport.right)scroll.scrollLeft+=cell.right-viewport.right+8;
   else if(cell.left<viewport.left)scroll.scrollLeft-=viewport.left-cell.left+8;
  }
  root.querySelector('[data-hash-action="previous"]').disabled=index===0;
  root.querySelector('[data-hash-action="next"]').disabled=index===last;
 });
 window.courseHashProbing={parse,trace,markup};
})();
