// Private full-database export. Never commit the destination or Wrangler logs.
import {mkdir,readFile,writeFile,rename,readdir,rm,chmod,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {verifyDatabaseBackup} from './verify-d1-backup.mjs';
const root=resolve(import.meta.dirname,'..');
export async function storeVerifiedBackup(directory,sql,{keep=12,now=new Date()}={}){
  if(!Number.isInteger(keep)||keep<2)throw Error('至少保留兩代完整備份');
  await mkdir(directory,{recursive:true,mode:0o700});
  directory=await realpath(directory);
  if(directory===root||directory.startsWith(root+'/'))throw Error('完整備份必須存放在 Git 專案外');
  await chmod(directory,0o700);
  // Verify before writing or pruning anything, so a bad export cannot rotate good backups.
  const report=verifyDatabaseBackup(sql),sha256=createHash('sha256').update(sql).digest('hex');
  const name='backup-'+now.toISOString().replaceAll(':','-')+'-'+randomUUID(),stage=join(directory,'.'+name),dest=join(directory,name);
  await mkdir(stage,{mode:0o700});
  try{
    await writeFile(join(stage,'database.sql'),sql,{mode:0o600,flag:'wx'});
    await writeFile(join(stage,'manifest.json'),JSON.stringify({format:'course-library.full-d1-archive',version:1,createdAt:now.toISOString(),sha256,bytes:Buffer.byteLength(sql),report},null,2)+'\n',{mode:0o600,flag:'wx'});
    await rename(stage,dest);
  }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
  const verified=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(!entry.isDirectory()||!/^backup-/.test(entry.name))continue;
    try{const manifest=JSON.parse(await readFile(join(directory,entry.name,'manifest.json'),'utf8'));if(manifest.format==='course-library.full-d1-archive'&&manifest.report?.ok)verified.push({name:entry.name,createdAt:manifest.createdAt});}catch{}
  }
  verified.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.name.localeCompare(a.name));
  for(const old of verified.slice(keep))await rm(join(directory,old.name),{recursive:true});
  return {directory:dest,sha256,counts:report.counts,retained:Math.min(keep,verified.length)};
}
async function command(){
  const args=process.argv.slice(2),directory=args[0];
  if(!directory)throw Error('用法：node scripts/archive-d1-backup.mjs <專案外的私有備份目錄> [既有完整 SQL 檔]');
  let sql;
  if(args[1])sql=await readFile(args[1],'utf8');
  else{
    const {mkdtemp}=await import('node:fs/promises');const {tmpdir}=await import('node:os');
    const temp=await mkdtemp(join(tmpdir(),'course-private-export-'));await chmod(temp,0o700);
    try{
      const output=join(temp,'database.sql');
      const child=spawn('npm',['exec','--yes','--package=wrangler@4','--','wrangler','d1','export','course-library','--remote','--output',output],{cwd:join(root,'contribution-service'),env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(temp,'wrangler.log')},stdio:'ignore'});
      await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('完整匯出失敗；請確認 Wrangler 登入與 D1 權限。既有備份未輪替。')));});
      sql=await readFile(output,'utf8');
    }finally{await rm(temp,{recursive:true,force:true});}
  }
  console.log(JSON.stringify(await storeVerifiedBackup(resolve(directory),sql),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await command();
