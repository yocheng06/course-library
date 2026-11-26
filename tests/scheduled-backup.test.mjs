import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {runBackupRestore,backupRestoreStatus,loadArchivedSnapshot} from '../contribution-service/worker/backup-verification.mjs';
function adapter(sql){return {prepare(query){let values=[];return {bind(...v){values=v.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return {meta:{changes:sql.prepare(query).run(...values).changes}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.all());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
function fixture(){
 const source=new DatabaseSync(':memory:'),target=new DatabaseSync(':memory:');
 for(const table of ['submissions','public_questions','question_history','builtin_question_edits','question_corrections','unit_settings','unit_settings_history'])source.exec('CREATE TABLE '+table+'(id TEXT PRIMARY KEY,data TEXT,revision INTEGER)');
 source.exec(`INSERT INTO public_questions VALUES ('question','{"answer":"保留原答案"}',3);INSERT INTO question_history VALUES ('history','{"answer":"修改前答案"}',2)`);
 source.exec('CREATE TABLE image_objects(key TEXT PRIMARY KEY,body BLOB,size INTEGER,sha256 TEXT)');
 const bytes=Buffer.from([137,80,78,71]);source.prepare('INSERT INTO image_objects VALUES (?,?,?,?)').run('image',bytes,bytes.length,createHash('sha256').update(bytes).digest('hex'));
 target.exec("CREATE TABLE _restore_sandbox(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO _restore_sandbox VALUES (1,'course-library-backup-verification-only')");
 return {source,target,env:{DB:adapter(source),BACKUP_VERIFY_DB:adapter(target)}};
}
test('weekly restoration uses only the guarded sandbox, preserves answers/history/images and records status',async()=>{
 const {env,source,target}=fixture();try{
  const now=Date.now(),report=await runBackupRestore(env,{now});assert.equal(report.ok,true);assert.equal(report.imagesVerified,1);
  assert.equal(target.prepare('SELECT data FROM public_questions').get().data,source.prepare('SELECT data FROM public_questions').get().data);
  assert.equal((await backupRestoreStatus(env)).ok,true);
  const next=await runBackupRestore(env,{now:now+86400000});assert.equal(next.checkedAt,report.checkedAt);
  source.exec("UPDATE public_questions SET revision=4");const weekly=await runBackupRestore(env,{now:now+8*86400000});assert.equal(weekly.ok,true);assert.equal(target.prepare('SELECT revision FROM public_questions').get().revision,4);
 }finally{source.close();target.close();}
});
test('a production binding or missing sandbox marker is rejected before any data is cleared',async()=>{
 const {env,source,target}=fixture();try{
  await assert.rejects(runBackupRestore({...env,BACKUP_VERIFY_DB:env.DB}),/正式資料庫/);
  target.exec('DELETE FROM _restore_sandbox');await assert.rejects(runBackupRestore(env),/標記/);
  assert.equal(source.prepare('SELECT COUNT(*) n FROM public_questions').get().n,1);
 }finally{source.close();target.close();}
});
test('corrupt stored image bytes fail verification and leave production data untouched',async()=>{
 const {env,source,target}=fixture();try{
  source.exec("UPDATE image_objects SET sha256='invalid'");await assert.rejects(runBackupRestore(env),/題圖校驗/);
  assert.equal((await backupRestoreStatus(env)).ok,false);assert.equal(source.prepare('SELECT COUNT(*) n FROM public_questions').get().n,1);
 }finally{source.close();target.close();}
});

test('retained archives restore the old answer after newer edits and keep twelve verified generations',async()=>{
 const {env,source,target}=fixture();try{
  const now=Date.now();await runBackupRestore(env,{force:true,now});
  source.exec(`UPDATE public_questions SET data='{"answer":"新版"}',revision=4`);
  await runBackupRestore(env,{force:true,now:now+1});
  const archived=await loadArchivedSnapshot(env.BACKUP_VERIFY_DB,now);
  assert.equal(JSON.parse(archived.get('public_questions').rows[0].data).answer,'保留原答案');
  assert.deepEqual([...archived.get('image_objects').rows[0].body],[137,80,78,71]);
  for(let i=2;i<14;i++)await runBackupRestore(env,{force:true,now:now+i});
  const status=await backupRestoreStatus(env);assert.equal(status.archive.generations,12);assert.equal(status.archive.oldest,now+2);
  source.exec("UPDATE image_objects SET sha256='bad'");await assert.rejects(runBackupRestore(env,{force:true,now:now+14}));
  assert.equal((await backupRestoreStatus(env)).archive.generations,12);
  target.prepare("UPDATE _backup_chunks SET data='[]' WHERE generation=? AND table_name='public_questions'").run(now+2);
  await assert.rejects(loadArchivedSnapshot(env.BACKUP_VERIFY_DB,now+2),/校驗/);
 }finally{source.close();target.close();}
});
