import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {legacyOrigin,serviceOrigin} from './build-cloudflare.mjs';
const origin=serviceOrigin(process.argv[process.argv.indexOf('--origin')+1]);
const root=resolve(import.meta.dirname,'../..'),changes=[];
async function inspect(file){
  const content=await readFile(file,'utf8');
  let after=content.replaceAll(legacyOrigin,origin);
  if(file.endsWith('.html'))after=after.replace(/(assets\/(?:contributions-config|theme)\.js)\?v=[^"\s]+/g,'$1?v=cloudflare-d1-20261117');
  if(after!==content)changes.push({path:relative(root,file),before:content,after});
}
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);
  if(entry.isDirectory())await walk(path);
  else if(/\.(?:json|js|mjs)$/.test(entry.name))await inspect(path);
}}
for(const name of await readdir(root))if(name.endsWith('.html'))await inspect(join(root,name));
await walk(join(root,'assets'));
if(process.argv.includes('--write')){
  if(!process.argv.includes('--verified'))throw Error('尚未確認新服務資料與題圖驗證完成，拒絕切換。');
  const folder=join(root,'artifacts','service-switch-'+Date.now());await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'rollback.json'),JSON.stringify({origin,changes:changes.map(({path,before})=>({path,before}))}));
  for(const change of changes)await writeFile(join(root,change.path),change.after);
}
console.log(JSON.stringify({written:process.argv.includes('--write'),origin,files:changes.map(change=>change.path)},null,2));
