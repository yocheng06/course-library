// Guidance only: never changes matching, candidate answers, or publication state.
export function resultNextStep(row, {coverage=true, unit='all', otherCourse=false}={}) {
  if(row.status==='matched')return null;
  if(!coverage)return {kind:'sync',title:'同步未完成',hint:'最新題庫尚未確認，先重新同步再查題。',action:'retry',label:'重新同步並查題'};
  const reason=String(row.reason||'');
  if(/題庫端題圖尚未讀取成功/.test(reason))return {kind:'sync',title:'題圖同步未完成',hint:'本機題圖已保留，重新同步後再確認。',action:'retry',label:'重新同步並查題'};
  if(/圖片|題圖/.test(reason))return {kind:'image',title:'題圖需要核對',hint:'圖片與圖中條件也必須符合，才能確認答案。',action:'images',label:'補上題圖並重新查題'};
  if(/答案項目數|填空數|填答格式|選項對應不一致/.test(reason)&&!row.question.options.length)return {kind:'fill',title:'答案無法分格',hint:'請核對填空位置與候選題的答案格式，先不要直接套用。',action:row.references?.length?'compare':'edit',label:row.references?.length?'核對填空與答案':'檢查題目文字'};
  if(/選項/.test(reason)&&row.question.options.length)return {kind:'options',title:'選項版本不同',hint:'請對照本次選項與候選原題；不同選項不能直接沿用答案。',action:row.references?.length?'compare':'edit',label:row.references?.length?'比較選項差異':'檢查題目與選項'};
  if(row.references?.length)return {kind:'version',title:'題目版本待確認',hint:'找到候選題，但條件或答案版本仍有差異。',action:'compare',label:'比較題目差異'};
  if(otherCourse)return {kind:'course',title:'請先確認科目',hint:'這批題目在另一科找到更多符合的版本，先切換科目再確認。',action:'switch',label:'切換科目並重新比對'};
  if(unit!=='all')return {kind:'scope',title:'目前單元未找到',hint:'先查全部單元，確認是否收錄在其他地方。',action:'expand',label:'改查全部單元'};
  return {kind:'missing',title:'尚未找到這題',hint:'可補上正確答案後投稿；解析可以留白。',action:'draft',label:'補答案並投稿'};
}
