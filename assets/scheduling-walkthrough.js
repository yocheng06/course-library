(() => {
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function timelineMarkup(segments,label){
    if(!Array.isArray(segments))return '';
    const valid=segments.filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start);
    return `<div class="worked-timeline"><b>${escape(label)}</b><p class="worked-help">由左往右看；每格下方是開始–結束時刻（ms）。可左右滑動，或使用下方按鈕查看。</p><div class="worked-timeline-controls"><button type="button" class="plain" data-timeline-scroll="-1" aria-label="時間線往前捲動">← 往前</button><button type="button" class="plain" data-timeline-scroll="1" aria-label="時間線往後捲動">往後 →</button></div><div class="worked-scroll" tabindex="0" role="region" aria-label="${escape(label)}"><ol class="worked-blocks">${valid.map(s=>`<li${s.name==='閒置'?' class="worked-idle"':''}><b>${escape(s.name)}</b><span>${s.start}–${s.end}</span><small>${s.end-s.start} ms</small></li>`).join('')}</ol></div></div>`;
  }
  function markup(data){
    if(!data||!Array.isArray(data.columns)||!Array.isArray(data.rows))return '';
    return `<section class="worked-solution" aria-label="解題資料與時間線"><h4>${escape(data.title)}</h4><p>${escape(data.rule)}</p><div class="worked-scroll" tabindex="0" role="region" aria-label="本題計算資料"><table><caption>本題資料與計算結果（時間單位：ms）</caption><thead><tr>${data.columns.map(c=>`<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${data.rows.map(r=>`<tr>${r.map((c,i)=>i===0?`<th scope="row">${escape(c)}</th>`:`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${timelineMarkup(data.segments,'本題 CPU 時間線')}${(data.timelines||[]).map(t=>timelineMarkup(t.segments,t.label)).join('')}<p class="worked-help">以下逐步說明如何選人、計算，以及為什麼其他選項不符合。</p></section>`;
  }
  if (typeof document !== 'undefined') document.addEventListener('click', event => {
    const button = event.target.closest('[data-timeline-scroll]');
    if (!button) return;
    const scroll = button.closest('.worked-timeline')?.querySelector('.worked-scroll');
    if (!scroll) return;
    const direction = Number(button.dataset.timelineScroll);
    if (direction !== -1 && direction !== 1) return;
    scroll.scrollLeft = Math.max(0, Math.min(scroll.scrollWidth-scroll.clientWidth,
      scroll.scrollLeft + direction * Math.max(100, scroll.clientWidth * 0.8)));
  });
  window.courseSchedulingWalkthrough={markup};
})();
