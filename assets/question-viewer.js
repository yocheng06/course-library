/* Inspect original diagrams without leaving the question or changing its text. */
(() => {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.id = 'question-image-viewer';
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-labelledby', 'image-viewer-title');
  dialog.innerHTML = `<header class="image-viewer-header"><h2 id="image-viewer-title">題圖檢視</h2><button type="button" data-image-close autofocus>關閉</button></header>
    <div class="image-viewer-controls" role="group" aria-label="題圖縮放">
      <button type="button" data-image-zoom="out" aria-label="縮小題圖">−</button>
      <span class="image-viewer-scale" role="status" aria-live="polite"></span>
      <button type="button" data-image-zoom="in" aria-label="放大題圖">＋</button>
      <button type="button" data-image-fit>符合視窗</button><button type="button" data-image-original-size>原尺寸</button>
    </div>
    <div class="image-viewer-stage" tabindex="0" role="region" aria-label="題圖，可左右或上下捲動"><div class="image-viewer-canvas"><img alt="" draggable="false"></div></div>
    <footer class="image-viewer-footer"><p>放大後可滑動或拖曳查看；圖中選項請在題目下方作答。</p><a target="_blank" rel="noopener noreferrer">開啟原圖 ↗（新分頁）</a></footer>`;
  document.body.append(dialog);
  const stage = dialog.querySelector('.image-viewer-stage');
  const canvas = dialog.querySelector('.image-viewer-canvas');
  const picture = canvas.querySelector('img');
  const status = dialog.querySelector('.image-viewer-scale');
  const original = dialog.querySelector('a');
  let scale = 1, opener = null, drag = null;
  const fitScale = () => Math.max(0.05, Math.min(1, (stage.clientWidth - 32) / picture.naturalWidth, (stage.clientHeight - 32) / picture.naturalHeight));
  function resize(next, preserveCenter = true) {
    if (!picture.naturalWidth || !dialog.open) return;
    const bounds = stage.getBoundingClientRect(), before = picture.getBoundingClientRect();
    const centerX = (bounds.left + stage.clientWidth / 2 - before.left) / scale;
    const centerY = (bounds.top + stage.clientHeight / 2 - before.top) / scale;
    scale = Math.min(4, Math.max(Math.min(0.1, fitScale()), next));
    const width = Math.round(picture.naturalWidth * scale), height = Math.round(picture.naturalHeight * scale);
    picture.style.width = width + 'px'; picture.style.height = height + 'px';
    canvas.style.width = width + 32 + 'px'; canvas.style.height = height + 32 + 'px';
    status.textContent = Math.round(scale * 100) + '%';
    if (preserveCenter) {
      const after = picture.getBoundingClientRect();
      stage.scrollLeft += after.left + centerX * scale - bounds.left - stage.clientWidth / 2;
      stage.scrollTop += after.top + centerY * scale - bounds.top - stage.clientHeight / 2;
    } else { stage.scrollLeft = 0; stage.scrollTop = 0; }
    stage.classList.toggle('can-pan', stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight);
    dialog.querySelector('[data-image-zoom="in"]').disabled = scale >= 4;
    dialog.querySelector('[data-image-zoom="out"]').disabled = scale <= Math.min(0.1, fitScale());
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-image-viewer]');
    if (!button) return;
    const source = button.querySelector('img');
    opener = button;
    dialog.querySelector('h2').textContent = '題圖檢視 ' + (button.closest('.card').querySelector('.qid')?.textContent || '');
    original.href = source.src; picture.alt = source.alt;
    status.textContent = '載入中…';
    document.body.classList.add('image-viewer-open');
    dialog.showModal();
    picture.onload = () => resize(fitScale(), false);
    picture.onerror = () => { status.textContent = '無法載入，請開啟原圖'; };
    picture.src = source.src;
    if (picture.complete && picture.naturalWidth) resize(fitScale(), false);
  });
  dialog.querySelector('[data-image-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('image-viewer-open'); drag = null;
    stage.classList.remove('is-dragging');
    if (opener?.isConnected) opener.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.querySelector('[data-image-zoom="in"]').addEventListener('click', () => resize(scale * 1.5));
  dialog.querySelector('[data-image-zoom="out"]').addEventListener('click', () => resize(scale / 1.5));
  dialog.querySelector('[data-image-fit]').addEventListener('click', () => resize(fitScale(), false));
  dialog.querySelector('[data-image-original-size]').addEventListener('click', () => resize(1, false));
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !stage.classList.contains('can-pan')) return;
    event.preventDefault(); stage.setPointerCapture(event.pointerId);
    drag = {x:event.clientX, y:event.clientY}; stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', event => {
    if (!drag) return;
    stage.scrollLeft += drag.x - event.clientX; stage.scrollTop += drag.y - event.clientY;
    drag = {x:event.clientX, y:event.clientY};
  });
  const stopDrag = () => { drag = null; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerup', stopDrag); stage.addEventListener('pointercancel', stopDrag);
  let previousWidth = stage.clientWidth, previousHeight = stage.clientHeight;
  new ResizeObserver(() => {
    if (!dialog.open) return;
    if (previousWidth !== stage.clientWidth || previousHeight !== stage.clientHeight) resize(fitScale(), false);
    previousWidth = stage.clientWidth; previousHeight = stage.clientHeight;
  }).observe(stage);
})();
