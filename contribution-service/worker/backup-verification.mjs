const restoreTables=['submissions','public_questions','question_history','builtin_question_edits','question_corrections','unit_settings','unit_settings_history','image_objects'];
const restoreMarker='course-library-backup-verification-only';
const restoreDigest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(v=>v.toString(16).padStart(2,'0')).join('');
const quoteIdentifier=value=>'"'+value.replaceAll('"','""')+'"';
async function readContentRows(db,schemas){
  const statements=restoreTables.map(table=>{
    const schema=schemas.find(row=>row.name===table);
    if(!schema)throw Error('正式備份缺少資料表：'+table);
    const fields=JSON.parse(schema.column_names).flatMap(key=>["'"+key.replaceAll("'","''")+"'",key==='body'?'hex('+quoteIdentifier(key)+')':quoteIdentifier(key)]).join(',');
    return "SELECT '"+table+"' AS table_name,json_object("+fields+") AS row_data FROM "+quoteIdentifier(table);
  });
  // D1 limits compound SELECT terms; small groups share one transactional batch.
  const queries=[];for(let start=0;start<statements.length;start+=2)queries.push(db.prepare(statements.slice(start,start+2).join(' UNION ALL ')));
  const rows=(await db.batch(queries)).flatMap(result=>result.results);
  const result=new Map(restoreTables.map(table=>[table,[]]));
  for(const row of rows){const value=JSON.parse(row.row_data);if(Object.hasOwn(value,'body'))value.body=Uint8Array.from(value.body.match(/../g)||[],hex=>parseInt(hex,16));result.get(row.table_name).push(value);}
  return result;
}
async function restoreSignature(rows){
  const values=[];
  for(const row of rows){const normalized={};for(const key of Object.keys(row).sort()){const value=row[key];normalized[key]=key==='body'&&value!==null?{sha256:await restoreDigest(new Uint8Array(value)),bytes:new Uint8Array(value).byteLength}:value;}values.push(JSON.stringify(normalized));}
  return restoreDigest(JSON.stringify(values.sort()));
}
// Immutable generations survive the next sandbox restore. Only verified generations rotate.
async function archiveSnapshot(db,snapshots,now){
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS _backup_generations(id INTEGER PRIMARY KEY,verified INTEGER NOT NULL DEFAULT 0,manifest TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS _backup_chunks(generation INTEGER NOT NULL,table_name TEXT NOT NULL,part INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(generation,table_name,part))'),
  ]);
  const manifest={format:'course-library.content-archive',version:1,createdAt:new Date(now).toISOString(),tables:{}};
  const pendingChunks=[];
  for(const [table,{rows,schema,signature,column_names}] of snapshots){
    const chunks=[];let chunk=[],size=0;
    for(const row of rows){
      const value={...row};
      if(Object.hasOwn(value,'body'))value.body=[...new Uint8Array(value.body)].map(n=>n.toString(16).padStart(2,'0')).join('');
      const serialized=JSON.stringify(value),bytes=new TextEncoder().encode(serialized).length;
      if(size+bytes>768000&&chunk.length){chunks.push('['+chunk.join(',')+']');chunk=[];size=0;}
      chunk.push(serialized);size+=bytes+1;
    }
    if(chunk.length)chunks.push('['+chunk.join(',')+']');
    manifest.tables[table]={schema,column_names,signature,count:rows.length,parts:chunks.length};
    for(let part=0;part<chunks.length;part++)pendingChunks.push([now,table,part,chunks[part]]);
  }
  for(let start=0;start<pendingChunks.length;start+=25){const group=pendingChunks.slice(start,start+25);await db.prepare('INSERT INTO _backup_chunks(generation,table_name,part,data) VALUES '+group.map(()=>'(?,?,?,?)').join(',')).bind(...group.flat()).run();}
  await db.prepare('INSERT INTO _backup_generations(id,manifest) VALUES (?,?)').bind(now,JSON.stringify(manifest)).run();
  return loadArchivedSnapshot(db,now);
}
export async function loadArchivedSnapshot(db,generation){
  const record=await db.prepare('SELECT manifest FROM _backup_generations WHERE id=?').bind(generation).first();
  if(!record)throw Error('找不到歷史備份');
  const manifest=JSON.parse(record.manifest),snapshots=new Map();
  const allChunks=(await db.prepare('SELECT table_name,data FROM _backup_chunks WHERE generation=? ORDER BY table_name,part').bind(generation).all()).results;
  for(const [table,meta] of Object.entries(manifest.tables)){
    if(!restoreTables.includes(table))throw Error('歷史備份包含未知資料表');
    const chunks=allChunks.filter(chunk=>chunk.table_name===table);
    if(chunks.length!==meta.parts)throw Error('歷史備份分塊不完整');
    const rows=chunks.flatMap(chunk=>JSON.parse(chunk.data));
    for(const row of rows)if(Object.hasOwn(row,'body'))row.body=Uint8Array.from(row.body.match(/../g)||[],hex=>parseInt(hex,16));
    if(rows.length!==meta.count||await restoreSignature(rows)!==meta.signature)throw Error('歷史備份內容校驗失敗：'+table);
    snapshots.set(table,{...meta,rows});
  }
  if(snapshots.size!==restoreTables.length)throw Error('歷史備份缺少資料表');
  return snapshots;
}
async function retainArchives(db){
  // Keep twelve successful weekly generations and the latest three failed attempts.
  await db.batch([
    db.prepare('DELETE FROM _backup_generations WHERE verified=1 AND id NOT IN (SELECT id FROM _backup_generations WHERE verified=1 ORDER BY id DESC LIMIT 12)'),
    db.prepare('DELETE FROM _backup_generations WHERE verified=0 AND id NOT IN (SELECT id FROM _backup_generations WHERE verified=0 ORDER BY id DESC LIMIT 3)'),
  ]);
  await db.prepare('DELETE FROM _backup_chunks WHERE generation NOT IN (SELECT id FROM _backup_generations)').run();
}
export async function backupRestoreStatus(env){
  if(!env.BACKUP_VERIFY_DB)return {configured:false};
  try{const row=await env.BACKUP_VERIFY_DB.prepare('SELECT report FROM _restore_reports ORDER BY created_at DESC LIMIT 1').first();let archive=null;try{archive=await env.BACKUP_VERIFY_DB.prepare('SELECT COUNT(*) generations, MIN(id) oldest, MAX(id) newest FROM _backup_generations WHERE verified=1').first();}catch{}return {configured:true,...(row?JSON.parse(row.report):{ok:null}),archive};}
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
  if(previous.ok===true&&previous.checkedAt===new Date(now).toISOString())return previous;
  if(!force&&previous.ok===true&&now-Date.parse(previous.checkedAt)<7*86400000)return previous;
  const report={configured:true,checkedAt:new Date(now).toISOString(),ok:false,counts:{},imagesVerified:0};
  try{
    let snapshots=new Map();
    const schemas=(await env.DB.prepare("SELECT m.name,m.sql,json_group_array(p.name) AS column_names FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND m.name IN ('submissions','public_questions','question_history','builtin_question_edits','question_corrections','unit_settings','unit_settings_history','image_objects') GROUP BY m.name").all()).results;
    const source=await readContentRows(env.DB,schemas);
    for(const [index,table] of restoreTables.entries()){
      const schema=schemas.find(row=>row.name===table);
      if(!schema)throw Error('正式備份缺少資料表：'+table);
      const rows=source.get(table);
      snapshots.set(table,{rows,schema:schema.sql,column_names:schema.column_names,signature:await restoreSignature(rows)});
    }
    snapshots=await archiveSnapshot(target,snapshots,now);
    report.archiveGeneration=now;
    const existing=(await target.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all()).results;
    const unchanged=new Set([...snapshots].filter(([table,meta])=>existing.some(row=>row.name===table&&row.sql===meta.schema)).map(([table])=>table));
    await target.batch([...restoreTables].reverse().map(table=>target.prepare((unchanged.has(table)?'DELETE FROM ':'DROP TABLE IF EXISTS ')+quoteIdentifier(table))).concat([...snapshots].filter(([table])=>!unchanged.has(table)).map(([,meta])=>target.prepare(meta.schema))));
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
    }
    const restoredTables=await readContentRows(target,schemas);
    for(const [table] of snapshots){
      const restored=restoredTables.get(table);
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
    await target.prepare('UPDATE _backup_generations SET verified=1 WHERE id=?').bind(now).run();
    await retainArchives(target);
  }catch(error){report.error=String(error.message).slice(0,200);}
  await target.prepare('INSERT OR REPLACE INTO _restore_reports(created_at,report) VALUES (?,?)').bind(now,JSON.stringify(report)).run();
  await target.prepare('DELETE FROM _restore_reports WHERE created_at < ?').bind(now-90*86400000).run();
  if(!report.ok)throw Error('獨立備份還原驗證未通過：'+report.error);
  return report;
}
