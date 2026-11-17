import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {verifyPackage} from '../../assets/system-backup.mjs';
import {legacyOrigin,serviceOrigin} from './build-cloudflare.mjs';
import {imageTableSql} from '../worker/d1-image-store.mjs';
const sqlValue=value=>value===null||value===undefined?'NULL':typeof value==='number'&&Number.isSafeInteger(value)?String(value):"'"+String(value).replaceAll("'","''")+"'";
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function rewriteImages(value,origin){
  if(typeof value==='string')return value.replaceAll(legacyOrigin+'/api/image/',origin+'/api/image/');
  if(Array.isArray(value))return value.map(item=>rewriteImages(item,origin));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewriteImages(item,origin)]));
  return value;
}
export async function prepareMigration({backup,origin,out,storage='r2'}){
  if(!['d1','r2'].includes(storage))throw Error('不支援的題圖儲存方式');
  origin=serviceOrigin(origin);out=resolve(out);
  try{await stat(join(out,'manifest.json'));throw Error('目標已有移植包，請使用新的資料夾。');}catch(error){if(error.code!=='ENOENT')throw error;}
  const raw=await readFile(backup,'utf8'),verified=await verifyPackage(raw);
  if(!verified.ok)throw Error('備份校驗失敗：'+verified.errors.join('；'));
  const pack=JSON.parse(raw),data=rewriteImages(pack.data,origin);
  const serviceRoot=resolve(import.meta.dirname,'..'),database=new DatabaseSync(':memory:');
  const schema=(await Promise.all((await readdir(join(serviceRoot,'drizzle'))).filter(n=>n.endsWith('.sql')).sort().map(n=>readFile(join(serviceRoot,'drizzle',n),'utf8')))).join('\n');
  database.exec(schema);
  const tables={
    submissions:data.submissions.map(row=>({...row,payload:JSON.stringify(row.payload)})),
    public_questions:data.questions.map(row=>({id:row.id,fingerprint:row.fingerprint,submission_id:row.submissionId,course:row.course,unit:row.unit,data:JSON.stringify(row.data),revision:row.revision,is_published:row.published?1:0,created_at:row.createdAt,updated_at:row.updatedAt})),
    question_history:data.history.map(row=>({...row,data:JSON.stringify(row.data)})),
    builtin_question_edits:data.builtinEdits.map(row=>({...row,data:JSON.stringify(row.data),previous_data:JSON.stringify(row.previous_data)})),
    question_corrections:(data.corrections||[]).map(row=>({...row,snapshot:JSON.stringify(row.snapshot)})),
    unit_settings:data.unitSettings,
    unit_settings_history:data.unitSettingsHistory,
  };
  const statements=[];
  for(const [table,rows] of Object.entries(tables)){
    const columns=database.prepare('PRAGMA table_info('+table+')').all().map(column=>column.name);
    for(const row of rows){
      if(Object.keys(row).some(key=>!columns.includes(key)))throw Error('無法辨識的資料欄位：'+table);
      const keys=columns.filter(key=>Object.hasOwn(row,key));
      const large=keys.filter(key=>typeof row[key]==='string'&&Buffer.byteLength(row[key])>8000);
      const statement='INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(key=>sqlValue(large.includes(key)?'':row[key])).join(',')+');';
      database.exec(statement);statements.push(statement);
      for(const key of large){
        const characters=[...row[key]];
        for(let offset=0;offset<characters.length;offset+=4000){
          const update='UPDATE '+table+' SET '+key+'='+key+'||'+sqlValue(characters.slice(offset,offset+4000).join(''))+' WHERE '+(table==='unit_settings'?'course':'id')+'='+sqlValue(row[table==='unit_settings'?'course':'id'])+';';
          database.exec(update);statements.push(update);
        }
      }
    }
  }
  // /api/manage/export materializes these backfills before making the backup.
  // Mark this exact build as already processed so restore cannot replay history.
  const built=await readFile(join(serviceRoot,'dist/server/index.js'),'utf8');
  for(const name of ['MERGE_VERSION','REVIEWED_CONTENT_VERSION']){
    const match=built.match(new RegExp('const '+name+'=("[a-f0-9]+")\\s*;'));
    if(!match)throw Error('缺少已套用內容版本：'+name);
    const statement='INSERT INTO content_updates(id,applied_at) VALUES ('+sqlValue(JSON.parse(match[1]))+','+Date.now()+');';
    database.exec(statement);statements.push(statement);
  }
  if(database.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('還原資料庫完整性檢查失敗。');
  const counts=Object.fromEntries(Object.keys(tables).map(table=>[table,database.prepare('SELECT COUNT(*) n FROM '+table).get().n]));
  const published=database.prepare('SELECT COUNT(*) n FROM public_questions WHERE is_published=1').get().n;
  const adminCount=database.prepare('SELECT COUNT(*) n FROM admin_accounts').get().n;
  database.close();
  await mkdir(join(out,'images'),{recursive:true});
  const resources=[];
  if(storage==='d1')statements.push(imageTableSql+';');
  for(const image of pack.resources){
    const url=new URL(image.url);
    if(url.origin!==legacyOrigin)continue; // GitHub-owned static images retain their original links.
    const match=/^\/api\/image\/([0-9a-f-]{36})\/((?:[0-9]|[1-9][0-9]|1[0-9]{2})-[01])$/.exec(url.pathname);
    if(!match)throw Error('無法辨識題圖路徑：'+url.pathname);
    const bytes=Buffer.from(image.base64,'base64');
    if(digest(bytes)!==image.sha256)throw Error('題圖校驗失敗。');
    const file='images/'+image.sha256;
    await writeFile(join(out,file),bytes);
    resources.push({key:'submissions/'+match[1]+'/'+match[2],file,contentType:image.type,bytes:bytes.length,sha256:image.sha256});
    if(storage==='d1'){
      const key='submissions/'+match[1]+'/'+match[2];
      statements.push('INSERT INTO image_objects(key,body,content_type,size,sha256,created_at) VALUES ('+[sqlValue(key),"X''",sqlValue(image.type),bytes.length,sqlValue(image.sha256),Date.now()].join(',')+');');
      // D1 limits each SQL statement. Append binary chunks below that limit.
      for(let offset=0;offset<bytes.length;offset+=16000)statements.push("UPDATE image_objects SET body=CAST(body||X'"+bytes.subarray(offset,offset+16000).toString('hex')+"' AS BLOB) WHERE key="+sqlValue(key)+';');
    }
  }
  const sql='-- Apply only to a NEW EMPTY database; schema creation fails on an existing database.\n'+schema+'\n'+statements.join('\n')+'\n';
  if(statements.some(statement=>Buffer.byteLength(statement)>90000))throw Error('SQL statement exceeds the portable import limit');
  const finalCheck=new DatabaseSync(':memory:');finalCheck.exec(sql);
  if(storage==='d1')for(const image of resources){
    const row=finalCheck.prepare('SELECT body FROM image_objects WHERE key=?').get(image.key);
    if(!row||digest(row.body)!==image.sha256)throw Error('還原題圖內容校驗失敗：'+image.key);
  }
  finalCheck.close();
  await writeFile(join(out,'database.sql'),sql);
  await writeFile(join(out,'backup.json'),raw);
  const manifest={schema:1,storage,createdAt:new Date().toISOString(),sourceExportedAt:pack.data.exportedAt,origin,backupSha256:digest(raw),sqlSha256:digest(sql),counts,published,hidden:counts.public_questions-published,adminAccounts:adminCount,resources,staticImages:pack.resources.length-resources.length};
  await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const value=flag=>process.argv[process.argv.indexOf(flag)+1];
  for(const flag of ['--backup','--origin','--out'])if(!process.argv.includes(flag))throw Error('缺少 '+flag);
  const report=await prepareMigration({backup:value('--backup'),origin:value('--origin'),out:value('--out'),storage:process.argv.includes('--storage')?value('--storage'):'r2'});
  console.log(JSON.stringify({...report,resources:report.resources.length},null,2));
}
