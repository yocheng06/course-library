/* Apply the reviewed L7 explanations only to the exact versions reviewed. */
(() => {
  'use strict';
  let curation;
  try { curation=JSON.parse(document.getElementById('course-algorithms-l7-curation')?.textContent||'null'); } catch {}
  const identity=q=>JSON.stringify([q.type||'',q.q??q.stem??'',q.opts??q.options??[],q.a??q.answer??'',q.images||[]]);
  function apply(q){
    if(!q||typeof q!=='object')return q;
    const record=curation?.questions?.[q.bookmarkId||q.id]?.versions.find(v=>v.identity===identity(q)&&[v.sourceExplanation,v.explanation].includes(q.ex??q.explanation??''));
    if(!record){const {selectionExplanation,...original}=q;return original;}
    return {...q,ex:record.explanation,...(Object.hasOwn(q,'explanation')?{explanation:record.explanation}:{}),selectionExplanation:true};
  }
  window.courseSelection={apply};
})();
