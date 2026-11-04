import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export function analyzeTap(tap,known){
  const failures=[...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1].replace(/\r$/,''));
  const allowed=new Set(known.map(item=>item.name));
  const total=Number(tap.match(/^# tests (\d+)/m)?.[1]);
  const failed=Number(tap.match(/^# fail (\d+)/m)?.[1]);
  const complete=Number.isInteger(total)&&total>0&&Number.isInteger(failed)&&failed===failures.length;
  return {complete,total,passed:Number(tap.match(/^# pass (\d+)/m)?.[1]),knownFailures:failures.filter(n=>allowed.has(n)),unexpected:failures.filter(n=>!allowed.has(n)),resolved:known.filter(item=>!failures.includes(item.name)).map(item=>item.name)};
}
async function run(){
 const out=resolve(root,'artifacts/checks');await mkdir(out,{recursive:true});
 const names=(await readdir(resolve(root,'tests'))).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/'+n);
 const result=spawnSync(process.execPath,['--experimental-vm-modules','--test','--test-reporter=tap',...names],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,timeout:180000});
 await writeFile(resolve(out,'frontend.tap'),(result.stdout||'')+(result.stderr||''));
 const known=JSON.parse(await readFile(resolve(root,'tests/known-failures.json'),'utf8')).failures;
 const summary=analyzeTap(result.stdout||'',known);summary.processError=result.error?.message||result.signal||null;
 await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));
 if(!summary.complete||summary.unexpected.length||summary.processError||(result.status!==0&&!summary.knownFailures.length)){process.exitCode=1;return;}
 console.log(`前端：${summary.passed} 通過；${summary.knownFailures.length} 個已列管舊失敗；沒有新增失敗。`);
 for(const script of ['scripts/build.mjs','tests/permissions.test.mjs']){
  const child=spawnSync(process.execPath,[script],{cwd:resolve(root,'contribution-service'),encoding:'utf8',maxBuffer:64*1024*1024,timeout:180000});
  await writeFile(resolve(out,script.includes('build')?'service-build.log':'service-tests.log'),(child.stdout||'')+(child.stderr||''));
  if(child.status!==0||child.error){console.error('服務檢查失敗：'+script);console.error(child.stdout,child.stderr);process.exitCode=1;return;}
  console.log(child.stdout.trim().split('\n').slice(-9).join('\n'));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await run();
