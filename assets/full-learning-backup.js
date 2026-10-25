/* Complete persistent learning data for the current course; no typed responses. */
(() => {
  'use strict';
  const ui=window.learningUI, progress=window.coursePracticeProgress, config=window.courseLearning;
  if (!ui || !progress || !config) return;
  const panel=document.querySelector('.review-backup');
  const controls=document.createElement('div');
  controls.className='review-backup-controls';
  controls.innerHTML='<button type="button" class="plain" data-export-learning>匯出完整學習備份</button><button type="button" class="plain" data-import-learning>匯入完整學習備份</button><input type="file" accept=".json,application/json" hidden><p>包含目前科目的待複習標記、字級、本輪首次答對、錯題、訂正與重試紀錄、自動標記設定。不含逐題作答原文與續讀位置。匯入會合併標記，同題練習採較新的紀錄。</p><p role="status" aria-live="polite"></p>';
  panel.append(controls);
  const input=controls.querySelector('input'),status=controls.querySelector('[role="status"]');
  const learningKey=`course-library.learning.v1.${config.course}`,practiceKey=`course-library.practice.v1.${config.course}`;
  function exportData() { return {format:'course-library.full-learning',version:1,course:config.course,exportedAt:new Date().toISOString(),learning:ui.exportLearning(),practice:progress.exportProgress()}; }
  function restore(raw) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 4*1024*1024) throw new Error('完整學習備份最多 4 MB。');
    const data=JSON.parse(raw);
    if (data?.format !== 'course-library.full-learning' || data.version !== 1 || data.course !== config.course) throw new Error('備份版本或科目不符，請到對應科目匯入。');
    const learning=ui.prepareLearning(data.learning),practice=progress.prepareProgress(data.practice);
    const oldLearning=localStorage.getItem(learningKey),oldPractice=localStorage.getItem(practiceKey);
    try {
      localStorage.setItem(learningKey,JSON.stringify(learning));
      localStorage.setItem(practiceKey,JSON.stringify(practice));
    } catch (error) {
      try {
        oldLearning===null?localStorage.removeItem(learningKey):localStorage.setItem(learningKey,oldLearning);
        oldPractice===null?localStorage.removeItem(practiceKey):localStorage.setItem(practiceKey,oldPractice);
      } catch { throw new Error('儲存空間異常，未套用備份；請保留備份檔並匯出目前資料後重試。'); }
      throw new Error('瀏覽器無法保存，未套用備份，原有清單仍保留。');
    }
    progress.applyProgress(practice); ui.applyLearning(learning); config.render();
    return {bookmarks:learning.bookmarks.length,records:practice.records.length};
  }
  window.courseFullLearningBackup={exportData,restore};
  controls.querySelector('[data-export-learning]').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`${config.course}-完整學習備份.json`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已建立完整學習備份，請確認下載檔案。';
  });
  controls.querySelector('[data-import-learning]').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    try { if(file.size>4*1024*1024)throw new Error('完整學習備份最多 4 MB。');const result=restore(await file.text());status.textContent=`已合併 ${result.bookmarks} 個標記、${result.records} 題練習紀錄。`; }
    catch(error){status.textContent=`無法匯入：${error.message}`;}finally{input.value='';}
  });
})();
