import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const marker='/* Shared, theme-aware question comparison and bulk topic controls. */';
export function mergeContributionStyles(shared,current){
  if(!shared.includes(marker))throw Error('Shared workflow styles are missing.');
  return current.split(marker)[0].trimEnd()+'\n\n'+marker+shared.split(marker)[1];
}
// The hosted service owns additional administration styles. Never replace
// its whole stylesheet with the smaller GitHub Pages stylesheet.
export async function syncContributionStyles(library,service){
  const shared=await readFile(resolve(library,'assets/contributions.css'),'utf8');
  const target=resolve(service,'frontend/assets/contributions.css');
  const current=await readFile(target,'utf8');
  await writeFile(target,mergeContributionStyles(shared,current));
}
