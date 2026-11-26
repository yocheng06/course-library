const restoreTables=['submissions','public_questions','question_history','builtin_question_edits','question_corrections','unit_settings','unit_settings_history','image_objects'];
const restoreMarker='course-library-backup-verification-only';
const restoreDigest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function restoreRows(db,table){return (await db.prepare('SELECT * FROM '+table).all()).results;}
async function restoreSignature(rows){
  const values=[];
  for(const row of rows){const normalized={};for(const key of Object.keys(row).sort()){const value=row[key];normalized[key]=key==='body'&&value!==null?{sha256:await restoreDigest(new Uint8Array(value)),bytes:value.length}:value;}values.push(JSON.stringify(normalized));}
  return restoreDigest(JSON.stringify(values.sort()));
}
export async function backupRestoreStatus(env){
  if(!env.BACKUP_VERIFY_DB)return {configured:false};
  try{const row=await env.BACKUP_VERIFY_DB.prepare('SELECT report FROM _restore_reports ORDER BY created_at DESC LIMIT 1').first();return {configured:true,...(row?JSON.parse(row.report):{ok:null})};}
  catch{return {configured:true,ok:null};}
}
export async function runBackupRestore(env,{force=false,now=Date.now()}={}){
  const target=env.BACKUP_VERIFY_DB;
  if(!target)return {configured:false};
  // A wrongly bound production database must never be cleared or used as the sandbox.
  if(target===env.DB)throw Error('驗證資料庫不能是正式資料庫');
  const marker=await target.prepare('SELECT value FROM _restore_sandbox WHERE id=1').first();
  if(marker?.value!==restoreMarker)throw Error('缺少獨立驗證資料庫標記，未執行還原');
  await target.prepare('CREATE TABLE IF NOT EXISTS _restore_reports(created_at INTEGER PRIMARY KEY,report TEXT NOT NULL)').run();
  const previous=await backupRestoreStatus(env);
  if(!force&&previous.ok===true&&now-Date.parse(previous.checkedAt)<7*86400000)return previous;
  const report={configured:true,checkedAt:new Date(now).toISOString(),ok:false,counts:{},imagesVerified:0};
  try{
    const snapshots=new Map();
    const schemas=(await env.DB.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all()).results;
    const source=await env.DB.batch(restoreTables.map(table=>env.DB.prepare('SELECT * FROM '+table)));
    for(const [index,table] of restoreTables.entries()){
      const schema=schemas.find(row=>row.name===table);
      if(!schema)throw Error('正式備份缺少資料表：'+table);
      const rows=source[index].results;
      snapshots.set(table,{rows,schema:schema.sql,signature:await restoreSignature(rows)});
    }
    await target.batch([...restoreTables].reverse().map(table=>target.prepare('DROP TABLE IF EXISTS '+table)).concat([...snapshots.values()].map(({schema})=>target.prepare(schema))));
    for(const [table,{rows}] of snapshots){
      // JSON bulk writes keep the weekly job within D1 query limits; blobs use hex round trips.
      if(rows.length){
        const keys=Object.keys(rows[0]);
        const columns=keys.map(k=>'"'+k.replaceAll('"','""')+'"').join(',');
        const fields=keys.map(k=>k==='body'?"unhex(json_extract(value,'$.body'))":"json_extract(value,'$."+k+"')").join(',');
        const statement='INSERT INTO '+table+' ('+columns+') SELECT '+fields+' FROM json_each(?)';
        let chunk=[],size=0;
        async function flush(){if(chunk.length){await target.prepare(statement).bind('['+chunk.join(',')+']').run();chunk=[];size=0;}}
        for(const row of rows){
          const next={...row};
          if(Object.hasOwn(row,'body'))next.body=[...new Uint8Array(row.body)].map(n=>n.toString(16).padStart(2,'0')).join('');
          const serialized=JSON.stringify(next),bytes=new TextEncoder().encode(serialized).length;
          if(size+bytes>768000)await flush();
          chunk.push(serialized);size+=bytes+1;
        }
        await flush();
      }
      const restored=await restoreRows(target,table);
      if(await restoreSignature(restored)!==snapshots.get(table).signature)throw Error('還原內容不一致：'+table);
      report.counts[table]=restored.length;
      if(table==='image_objects')for(const image of restored){
        const body=new Uint8Array(image.body);
        if(body.length!==image.size||await restoreDigest(body)!==image.sha256)throw Error('還原題圖校驗失敗');
        report.imagesVerified++;
      }
    }
    // D1.batch captured the source tables in one transaction; production may keep accepting edits.
    report.ok=true;
  }catch(error){report.error=String(error.message).slice(0,200);}
  await target.prepare('INSERT OR REPLACE INTO _restore_reports(created_at,report) VALUES (?,?)').bind(now,JSON.stringify(report)).run();
  await target.prepare('DELETE FROM _restore_reports WHERE created_at < ?').bind(now-90*86400000).run();
  if(!report.ok)throw Error('獨立備份還原驗證未通過：'+report.error);
  return report;
}
