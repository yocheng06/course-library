// Accept a fresh official D1 query result; prepare reviewable, revision-guarded updates.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);
const before=JSON.parse(await readFile(new URL('content/algorithms-l10-before-20261127.json',root),'utf8'));
const review=JSON.parse(await readFile(new URL('content/algorithms-l10-review-20261127.json',root),'utf8'));
export function reviewedQuestion(old,record){
 const next={...old,category:record.category};
 if(Object.hasOwn(old,'ex'))next.ex=record.explanation;
 if(Object.hasOwn(old,'explanation')||!Object.hasOwn(old,'ex'))next.explanation=record.explanation;
 return next;
}
export function prepareL10Updates(live,{now=Date.now()}={}){
 const rows=Array.isArray(live[0]?.results)?live[0].results:live;
 const updates=[];
 if(rows.length!==before.questions.length||rows.some(row=>!before.questions.some(q=>q.id===row.id)))throw Error('L10 題目清單已改變，請先重新核對本次範圍');
 for(const source of before.questions){
  const row=rows.find(row=>row.id===source.id),record=review.questions.find(q=>q.id===source.id),raw=JSON.parse(row.data),next=reviewedQuestion(source.question,record);
  if(JSON.stringify(raw)===JSON.stringify(next)&&row.revision===source.revision+1)continue;
  if(row.course!=='algorithms'||row.unit!=='L10'||row.is_published!==1||row.revision!==source.revision||JSON.stringify(raw)!==JSON.stringify(source.question))throw Error('題目已有新版本：'+source.id);
  const historyId=randomUUID(),data=JSON.stringify(next);
  updates.push({id:source.id,historyId,expectedRevision:row.revision,revision:row.revision+1,previousData:row.data,data,
   sql:"INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at) SELECT ?,id,revision,course,unit,data,is_published,'update','owner-requested-l10-review',?,? FROM public_questions WHERE id=? AND course='algorithms' AND unit='L10' AND revision=? AND data=? AND is_published=1;UPDATE public_questions SET data=?,revision=revision+1,updated_at=? WHERE id=? AND course='algorithms' AND unit='L10' AND revision=? AND data=? AND is_published=1 AND EXISTS(SELECT 1 FROM question_history WHERE id=?)",
   params:[historyId,'L10 解析與主題整理；保留原題、選項、答案及其他資料，計算差異寫入解析',now,source.id,row.revision,row.data,data,now,source.id,row.revision,row.data,historyId]});
 }
 const quote=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
 for(const update of updates){let index=0;update.sql=update.sql.replace(/\?/g,()=>quote(update.params[index++]));delete update.params;}
 return {schema:1,course:'algorithms',unit:'L10',preparedAt:new Date(now).toISOString(),updates};
}
export async function updateL10Snapshot(live){
 const file=new URL('assets/course-snapshots/algorithms.json',root),snapshot=JSON.parse(await readFile(file,'utf8'));
 for(const source of before.questions){
  const record=review.questions.find(row=>row.id===source.id),question=reviewedQuestion(source.question,record);
  const existing=snapshot.data.questions.find(row=>(row.question.id??row.question.bookmarkId)===source.id);
  if(existing){existing.question=question;existing.unit='L10';}else snapshot.data.questions.push({unit:'L10',question});
 }
 // Preserve the owner's live catalog, including custom titles and English labels.
 if(live[1]?.results?.[0]?.data){const units=JSON.parse(live[1].results[0].data);snapshot.data.units=units.map(unit=>({...unit,label:`${unit.id} · ${unit.title}`,managed:true}));}
 snapshot.generatedAt=new Date().toISOString();
 const revisionData={...snapshot.data};delete revisionData.revision;
 snapshot.data.revision=createHash('sha256').update(JSON.stringify(revisionData)).digest('hex');
 const json=JSON.stringify(snapshot).replaceAll('<','\\u003c');
 await writeFile(file,json+'\n');
 const html=new URL('algorithms.html',root),source=await readFile(html,'utf8');
 await writeFile(html,source.replace(/(<script id="course-community-snapshot" type="application\/json">)[\s\S]*?(<\/script>)/,(_,open,close)=>open+json+close));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('用法：node scripts/prepare-algorithms-l10-update-20261127.mjs <fresh-live-query.json>');
 const live=JSON.parse(await readFile(process.argv[2],'utf8')),plan=prepareL10Updates(live);
 await writeFile(new URL('verification/algorithms-l10-update-20261127.json',root),JSON.stringify(plan,null,2)+'\n');
 await updateL10Snapshot(live);console.log('Prepared '+plan.updates.length+' guarded question updates and the L10 public snapshot');
}
