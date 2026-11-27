import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {verifyDatabaseBackup} from './verify-d1-backup.mjs';
import {hashCalculation} from './lib/hash-table-worked.mjs';
import {hashConcept} from './lib/hash-table-concepts.mjs';
const quote=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
export function reviewQuestion(q){
 const record=/將鍵值/.test(q.q??q.stem)?hashCalculation(q):hashConcept(q);
 const after={...q,category:record.category};
 if(Object.hasOwn(q,'ex'))after.ex=record.explanation;
 if(Object.hasOwn(q,'explanation')||!Object.hasOwn(q,'ex'))after.explanation=record.explanation;
 return {after,record};
}
export function prepareReview(rows,settings,{now=Date.now()}={}){
 if(rows.length!==60)throw Error('L9 題數已變更，需重新核對');
 const updates=rows.map(row=>{
  if(row.course!=='algorithms'||row.unit!=='L9'||row.is_published!==1)throw Error('超出指定範圍');
  const before=JSON.parse(row.data),{after,record}=reviewQuestion(before),historyId=randomUUID();
  if(record.difference)throw Error('計算答案不同，禁止自動發布：'+row.id);
  const guard=`id=${quote(row.id)} AND course='algorithms' AND unit='L9' AND is_published=1 AND revision=${row.revision} AND data=${quote(row.data)}`;
  const sql=`INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at) SELECT ${quote(historyId)},id,revision,course,unit,data,is_published,'update','owner-requested-l9-review','補齊並重寫 L9 解題過程與選項說明；保留原題與答案',${now} FROM public_questions WHERE ${guard};\nUPDATE public_questions SET data=${quote(JSON.stringify(after))},revision=revision+1,updated_at=${now} WHERE ${guard} AND EXISTS(SELECT 1 FROM question_history WHERE id=${quote(historyId)});`;
  return {id:row.id,before,after,revision:row.revision,sql};
 });
 const units=JSON.parse(settings.data),unit=units.find(u=>u.id==='L9');if(!unit)throw Error('找不到 L9 設定');
 unit.title='雜湊表';unit.en='Hash Tables';
 const data=JSON.stringify(units),historyId=randomUUID(),guard=`course='algorithms' AND revision=${settings.revision} AND data=${quote(settings.data)}`;
 const unitSql=data===settings.data?'':`INSERT INTO unit_settings_history(id,course,revision,before_data,after_data,actor,created_at) SELECT ${quote(historyId)},course,revision+1,data,${quote(data)},'owner-requested-l9-review',${now} FROM unit_settings WHERE ${guard};\nUPDATE unit_settings SET data=${quote(data)},revision=revision+1,updated_at=${now} WHERE ${guard} AND EXISTS(SELECT 1 FROM unit_settings_history WHERE id=${quote(historyId)});`;
 return {updates,units,sql:[...updates.map(u=>u.sql),unitSql].filter(Boolean).join('\n')};
}
export async function stageReviewSnapshot(publicData,plan){
 const file='assets/course-snapshots/algorithms.json',snapshot=JSON.parse(await readFile(file,'utf8'));
 const current=publicData.questions.filter(r=>r.unit==='L9');if(current.length!==60)throw Error('公開範圍不符');
 const rows=current.map(row=>{
  const change=plan.updates.find(u=>u.id===(row.question.bookmarkId??row.question.id));
  if(!change||JSON.stringify(change.before)!==JSON.stringify(row.question))throw Error('備份與公開內容不同，請重新讀取：'+(row.question.bookmarkId??row.question.id));
  return {...row,question:change.after};
 });
 snapshot.data.questions=[...snapshot.data.questions.filter(r=>r.unit!=='L9'),...rows];
 snapshot.data.units=snapshot.data.units.map(u=>u.id==='L9'?{...u,title:'雜湊表',en:'Hash Tables',label:'L9 · 雜湊表'}:u);
 snapshot.generatedAt=new Date().toISOString();delete snapshot.data.revision;
 snapshot.data.revision=createHash('sha256').update(JSON.stringify(snapshot.data)).digest('hex');
 const json=JSON.stringify(snapshot).replaceAll('<','\\u003c');await writeFile(file,json+'\n');
 const html=await readFile('algorithms.html','utf8');await writeFile('algorithms.html',html.replace(/(<script id="course-community-snapshot" type="application\/json">)[\s\S]*?(<\/script>)/,(_,open,close)=>open+json+close));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const backup=process.argv[2];if(!backup)throw Error('請指定已授權的正式備份');
 const sql=await readFile(backup,'utf8'),report=verifyDatabaseBackup(sql),db=new DatabaseSync(':memory:');
 try{
  db.exec(sql);
  const rows=db.prepare("SELECT * FROM public_questions WHERE course='algorithms' AND unit='L9' AND is_published=1 ORDER BY id").all();
  const settings=db.prepare("SELECT * FROM unit_settings WHERE course='algorithms'").get(),plan=prepareReview(rows,settings);
  const outside=db.prepare("SELECT id,data,revision FROM public_questions WHERE NOT(course='algorithms' AND unit='L9') ORDER BY id").all();
  const histories=db.prepare('SELECT count(*) n FROM question_history').get().n;
  db.exec(plan.sql);
  if(db.prepare('SELECT count(*) n FROM question_history').get().n!==histories+60)throw Error('歷史新增數不符');
  for(const change of plan.updates)if(db.prepare('SELECT data FROM public_questions WHERE id=?').get(change.id).data!==JSON.stringify(change.after))throw Error('演練結果不符');
  if(JSON.stringify(outside)!==JSON.stringify(db.prepare("SELECT id,data,revision FROM public_questions WHERE NOT(course='algorithms' AND unit='L9') ORDER BY id").all()))throw Error('影響其他單元');
  const count=db.prepare('SELECT total_changes() n').get().n;db.exec(plan.sql);if(count!==db.prepare('SELECT total_changes() n').get().n)throw Error('重複執行不安全');
  await writeFile('artifacts/l9-review-update.sql',plan.sql+'\n');
  await writeFile('content/algorithms-l9-review-20261127.json',JSON.stringify({course:'algorithms',unit:'L9',title:'雜湊表',en:'Hash Tables',questionCount:60,sources:['https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-10-open-addressing-cryptographic-hashing/','https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/resources/lecture-8-randomization-universal-perfect-hashing/'],questions:plan.updates.map(({id,before,after,revision})=>({id,revision,before,after}))},null,2)+'\n');
  if(process.argv.includes('--snapshot'))await stageReviewSnapshot(JSON.parse(await readFile('artifacts/l9-current-public.json','utf8')),plan);
  console.log(JSON.stringify({questions:rows.length,updated:60,backupVerified:report.ok,imagesVerified:report.imagesVerified,idempotent:true,otherUnitsUnchanged:true}));
 }finally{db.close();}
}
