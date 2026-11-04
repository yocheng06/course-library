/* Versioned learning backup, including optional exam snapshots and responses. */
(() => {
  'use strict';
  const ui=window.learningUI, progress=window.coursePracticeProgress, config=window.courseLearning;
  if (!ui || !progress || !config) return;
  const panel=document.querySelector('.review-backup');
  const controls=document.createElement('div');
  controls.className='review-backup-controls';
  controls.innerHTML='<button type="button" class="plain" data-export-learning>匯出完整學習備份</button><button type="button" class="plain" data-import-learning>匯入完整學習備份</button><input type="file" accept=".json,application/json" hidden><p>包含目前科目的待複習標記、字級、本輪首次答對、錯題、訂正與重試紀錄、自動標記設定。包含最近一次測驗及未交卷暫存（含測驗作答），不含閱讀續讀位置。匯入會合併標記，同題練習採較新的紀錄。</p><p role="status" aria-live="polite"></p>';
  panel.append(controls);
  const input=controls.querySelector('input'),status=controls.querySelector('[role="status"]');
  const learningKey=`course-library.learning.v1.${config.course}`,practiceKey=`course-library.practice.v1.${config.course}`;
  function exportData() { return {format:'course-library.full-learning',version:2,course:config.course,exportedAt:new Date().toISOString(),learning:ui.exportLearning(),practice:progress.exportProgress(),exams:window.courseExam?.exportBackup()||null}; }
  function restore(raw) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 12*1024*1024) throw new Error('完整學習備份最多 12 MB。');
    const data=JSON.parse(raw);
    if (data?.format !== 'course-library.full-learning' || ![1,2].includes(data.version) || data.course !== config.course) throw new Error('備份版本或科目不符，請到對應科目匯入。');
    const learning=ui.prepareLearning(data.learning),practice=progress.prepareProgress(data.practice);
    const exams=data.version===2 && data.exams ? window.courseExam?.prepareBackup(data.exams) : null;
    if(data.version===2 && data.exams && !exams)throw new Error('測驗模組尚未載入，請重新整理後匯入。');
    const writes=new Map([[learningKey,JSON.stringify(learning)],[practiceKey,JSON.stringify(practice)]]);
    if(exams){const keys=window.courseExam.backupKeys;
      writes.set(keys.last,exams.last?JSON.stringify(exams.last):null);
      writes.set(keys.draft,exams.draft?JSON.stringify(exams.draft):null);
      writes.set(keys.answers,exams.draft?JSON.stringify({sessionId:exams.draft.sessionId,responses:exams.draft.responses}):null);
    }
    const previous=new Map([...writes.keys()].map(key=>[key,localStorage.getItem(key)]));
    const put=(key,value)=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value);
    try { for(const [key,value] of writes)put(key,value); }
    catch {
      try { for(const [key,value] of previous)put(key,value); }
      catch { throw new Error('儲存空間異常，未套用備份；請保留備份檔並匯出目前資料後重試。'); }
      throw new Error('瀏覽器無法保存，未套用備份，原有清單仍保留。');
    }
    if(exams)window.courseExam.applyBackup(exams);
    progress.applyProgress(practice); ui.applyLearning(learning); config.render();
    return {bookmarks:learning.bookmarks.length,records:practice.records.length,exams:Boolean(exams)};
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
    try { if(file.size>12*1024*1024)throw new Error('完整學習備份最多 12 MB。');const result=restore(await file.text());status.textContent=`已合併 ${result.bookmarks} 個標記、${result.records} 題練習紀錄${result.exams?'，並已檢查與合併測驗紀錄':''}。`; }
    catch(error){status.textContent=`無法匯入：${error.message}`;}finally{input.value='';}
  });
})();
