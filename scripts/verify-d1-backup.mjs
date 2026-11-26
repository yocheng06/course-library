import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// This script accepts trusted SQLite exports, never executes them against D1.
export function verifyDatabaseBackup(sql) {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('還原資料庫完整性檢查失敗');
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
    for(const name of ['public_questions','question_history','builtin_question_edits','submissions','image_objects'])if(!tables.includes(name))throw Error('備份缺少資料表：'+name);
    const counts={},digests={};
    const digest=value=>createHash('sha256').update(value).digest('hex');
    for(const table of tables){
      const rows=db.prepare('SELECT * FROM "'+table.replaceAll('"','""')+'"').all();
      const serialized=rows.map(row=>JSON.stringify(row,(_,value)=>value instanceof Uint8Array?{sha256:digest(value),bytes:value.length}:value)).sort();
      counts[table]=rows.length;digests[table]=digest(JSON.stringify(serialized));
    }
    for(const table of ['public_questions','question_history'])for(const row of db.prepare('SELECT data FROM '+table).all())JSON.parse(row.data);
    for(const image of db.prepare('SELECT key,body,size,sha256 FROM image_objects').all()){
      if(image.body.length!==image.size||digest(image.body)!==image.sha256)throw Error('還原題圖校驗失敗：'+image.key);
    }
    const missing=db.prepare('SELECT COUNT(*) n FROM question_history h LEFT JOIN public_questions q ON q.id=h.question_id WHERE q.id IS NULL').get().n;
    if(missing)throw Error('修改歷史有無法對應的題目');
    return {ok:true,verifiedAt:new Date().toISOString(),counts,digests,imagesVerified:counts.image_objects,historyVerified:counts.question_history};
  } finally {db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw Error('用法：node scripts/verify-d1-backup.mjs backup.sql [report.json]');
  const report=verifyDatabaseBackup(await readFile(process.argv[2],'utf8'));
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,counts:report.counts,imagesVerified:report.imagesVerified,historyVerified:report.historyVerified},null,2));
}
