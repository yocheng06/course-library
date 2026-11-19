import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compactWorkerData} from './compact-worker-data.mjs';
import {buildProtectedLibrary} from './build-protected-library.mjs';
export const legacyOrigin='https://course-library-submissions-yocheng06.yocheng06.chatgpt.site';
export function serviceOrigin(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||!/^https:\/\/[a-z0-9.-]+$/.test(value))throw Error('請提供不含路徑的 HTTPS 服務網址。');
  return url.origin;
}
export async function buildCloudflare(origin,{protectedLibrary=false}={}){
  origin=serviceOrigin(origin);
  const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist/cloudflare');
  await mkdir(out,{recursive:true});
  let source=await readFile(resolve(root,'dist/server/index.js'),'utf8');
  if(!source.includes(legacyOrigin))throw Error('找不到原服務網址，停止產生部署檔。');
  const config=await readFile(resolve(root,'frontend/assets/contributions-config.js'),'utf8');
  const configuredOrigin=serviceOrigin(config.match(/apiOrigin:\s*"([^"]+)"/)?.[1]);
  // A hostname change must invalidate ETags even when teacher content and
  // question revisions are unchanged, otherwise cached image URLs survive.
  const revision=/const LIBRARY_BUILD_REVISION="([a-f0-9]{64})";/.exec(source);
  if(!revision)throw Error('Missing library cache revision');
  source=source.replace(revision[0],'const LIBRARY_BUILD_REVISION='+JSON.stringify(createHash('sha256').update(revision[1]+':'+origin).digest('hex'))+';');
  await writeFile(resolve(out,'app.mjs'),compactWorkerData(source.replaceAll(legacyOrigin,origin).replaceAll(configuredOrigin,origin)));
  await writeFile(resolve(out,'d1-image-store.mjs'),await readFile(resolve(root,'worker/d1-image-store.mjs'),'utf8'));
  // ChatGPT injected identity headers have no trustworthy issuer on a public
  // Cloudflare Worker. Only the existing password/session and one-time setup
  // code flows are allowed here; client-supplied identity headers are removed.
  const libraryHashes=protectedLibrary?await buildProtectedLibrary(resolve(root,'..'),out,origin):{};
  const wrapper=`import service from './app.mjs';
import {createD1ImageStore} from './d1-image-store.mjs';
const expectedOrigin=${JSON.stringify(origin)};
const libraryHashes=${JSON.stringify(libraryHashes)};
export default {async scheduled(event,env,ctx){
  return service.scheduled(event,env,ctx);
},async fetch(request,env,ctx){
  if(env.PUBLIC_ORIGIN!==expectedOrigin||new URL(request.url).origin!==expectedOrigin)
    return new Response('服務網址尚未完成設定。',{status:503});
  const headers=new Headers(request.headers);
  for(const key of [...headers.keys()])if(key.toLowerCase().startsWith('oai-'))headers.delete(key);
  const storageEnv={...env,LIBRARY_SCRIPT_HASHES:libraryHashes,BUCKET:env.BUCKET||createD1ImageStore(env.DB)};
  return service.fetch(new Request(request,{headers}),storageEnv,ctx);
}};
`;
  await writeFile(resolve(out,'index.mjs'),wrapper);
  return {origin,entry:resolve(out,'index.mjs')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const index=process.argv.indexOf('--origin');
  if(index<0)throw Error('用法：node scripts/build-cloudflare.mjs --origin https://你的服務.workers.dev');
  console.log(JSON.stringify(await buildCloudflare(process.argv[index+1],{protectedLibrary:process.argv.includes('--protected-library')})));
}
