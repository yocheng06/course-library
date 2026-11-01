(() => {
  'use strict';
  let curation;try{curation=JSON.parse(document.getElementById('course-algorithms-counting-curation')?.textContent||'null');}catch{}
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const identity=q=>JSON.stringify([q.type||'',q.q??q.stem??'',q.opts??q.options??[],q.a??q.answer??'',q.images||[]]);
  function apply(q){
    if(!q||typeof q!=='object')return q;
    const meta=curation?.questions?.[q.bookmarkId||q.id];if(!meta)return q;
    const version=meta.versions.findIndex(v=>v.identity===identity(q)&&[v.sourceExplanation,v.explanation].includes(q.ex??q.explanation??''));
    if(version<0){const {countingWalkthrough,countingExplanation,...original}=q;return original;}
    const record=meta.versions[version];
    return {...q,ex:record.explanation,...(Object.hasOwn(q,'explanation')?{explanation:record.explanation}:{}),countingExplanation:true,...(record.walkthrough?{countingWalkthrough:{...record.walkthrough,version}}:{})};
  }
  function table(label,indices,values,latest=-1){
    return `<div class="counting-scroll" tabindex="0" role="region" aria-label="${escape(label)}"><table><caption>${escape(label)}</caption><thead><tr><th scope="col">索引</th>${indices.map(i=>`<th scope="col">${i}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">內容</th>${values.map((v,i)=>`<td${v===null?' class="counting-empty"':i===latest?' class="counting-changed"':''}>${v===null?'—':escape(v)}</td>`).join('')}</tr></tbody></table></div>`;
  }
  function status(data,step){return `已完成 ${step}／${data.A.length} 次回填。${step===data.A.length?'所有元素已填完。':`接下來是 j＝${data.A.length-step} 這輪，尚未執行這輪的第 10、11 行。`}${step===data.target?'目前正是本題要求的時點。':'這是探索其他步驟；按「回到本題時點」可復原。'}`;}
  function stateMarkup(data,step){
    const state=data.states[step],last=data.steps[step-1],next=data.steps[step];
    const lastText=last?`剛才：A[${last.j}]＝${last.x}，用 C[${last.x}]＝${last.before} 決定寫入 B[${last.position}]，然後把 C[${last.x}] 從 ${last.before} 減成 ${last.after}。`:'尚未開始回填，B 的每格都還是空的；C 已完成累積。';
    return `<p class="counting-operation">${escape(lastText)}</p>${table('B：結果陣列（— 表示尚未寫入）',data.A.map((_,i)=>i+1),state.B,last?last.position-1:-1)}${table('C：這個時點的計數／位置表',state.C.map((_,i)=>i),state.C,last?.x??-1)}<p>${escape(next?`下一步：讀 A[${next.j}]＝${next.x}，先寫入 B[${next.position}]，再把 C[${next.x}] 減 1。`:'已完成。最終 C[x] 是原輸入中嚴格小於 x 的個數。')}</p><p class="counting-hint">填答案時，題庫約定將 B 中尚未寫入的「—」記為 0；已寫入的數字 0 則直接顯示 0。</p>`;
  }
  function markup(q){
    const data=q.countingWalkthrough;if(!data)return '';
    const id=q.bookmarkId||q.id;
    return `<section class="counting-walkthrough" data-counting-question="${escape(id)}" data-counting-version="${data.version}" data-counting-step="${data.target}" aria-label="計數排序逐步演示"><h4>${escape(data.title)}</h4><p>A、B 從索引 1 開始；C 的索引 0～5 是數值本身。</p>${table('A：本題的原始資料',data.A.map((_,i)=>i+1),data.A)}${table('統計完成：每個值恰好出現幾次',data.frequency.map((_,i)=>i),data.frequency)}<div class="counting-controls"><button type="button" data-counting-action="previous" ${data.target===0?'disabled':''}>上一步</button><button type="button" data-counting-action="next" ${data.target===data.A.length?'disabled':''}>下一步</button><button type="button" data-counting-action="target">回到本題時點</button></div><p class="counting-status" data-counting-status role="status" aria-live="polite">${escape(status(data,data.target))}</p><div data-counting-body>${stateMarkup(data,data.target)}</div></section>`;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-counting-action]');if(!button)return;
    const root=button.closest('[data-counting-question]');if(!root)return;
    const data=curation?.questions?.[root.dataset.countingQuestion]?.versions?.[Number(root.dataset.countingVersion)]?.walkthrough;if(!data)return;
    const current=Number(root.dataset.countingStep),action=button.dataset.countingAction;
    const step=action==='target'?data.target:Math.max(0,Math.min(data.A.length,current+(action==='next'?1:-1)));
    root.dataset.countingStep=String(step);root.querySelector('[data-counting-body]').innerHTML=stateMarkup(data,step);root.querySelector('[data-counting-status]').textContent=status(data,step);
    root.querySelector('[data-counting-action="previous"]').disabled=step===0;root.querySelector('[data-counting-action="next"]').disabled=step===data.A.length;
  });
  window.courseCountingSort={apply,markup};
})();
