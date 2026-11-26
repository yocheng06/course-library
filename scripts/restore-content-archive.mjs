// Restore a historical content generation offline; never writes to production D1.
import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadArchivedSnapshot} from '../contribution-service/worker/backup-verification.mjs';
import {verifyDatabaseBackup} from './verify-d1-backup.mjs';
export async function restoreContentArchive(sql,generation){
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(sql);
  if(db.prepare('SELECT value FROM _restore_sandbox WHERE id=1').get()?.value!=='course-library-backup-verification-only')throw Error('不是獨立備份資料庫的匯出');
  const id=generation??db.prepare('SELECT MAX(id) id FROM _backup_generations WHERE verified=1').get()?.id;
  const adapter={prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(query).get(...args);},async all(){return {results:db.prepare(query).all(...args)};}};}};
  const snapshots=await loadArchivedSnapshot(adapter,id),statements=[];
  const quote=value=>value===null?'NULL':value instanceof Uint8Array?"X'"+Buffer.from(value).toString('hex')+"'":typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
  for(const [table,{schema,rows}] of snapshots){
   statements.push(schema+';');
   for(const row of rows){const keys=Object.keys(row);statements.push('INSERT INTO '+table+' ('+keys.map(k=>'"'+k.replaceAll('"','""')+'"').join(',')+') VALUES ('+keys.map(k=>quote(row[k])).join(',')+');');}
  }
  const restored=statements.join('\n')+'\n';
  return {sql:restored,generation:id,report:verifyDatabaseBackup(restored)};
 }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [input,output,generation]=process.argv.slice(2);
 if(!input||!output)throw Error('用法：node scripts/restore-content-archive.mjs <獨立備份資料庫.sql> <新的還原內容.sql> [generation]');
 const result=await restoreContentArchive(await readFile(input,'utf8'),generation?Number(generation):undefined);
 await writeFile(output,result.sql,{flag:'wx',mode:0o600});console.log(JSON.stringify({ok:true,generation:result.generation,counts:result.report.counts},null,2));
}
