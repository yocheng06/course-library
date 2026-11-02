import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
// Retain only the reviewed fallbacks needed to distinguish genuinely missing
// explanations from explanations already supplied by the public reader.
export async function prepareHealthExplanations(library,output){
  const data={os:{},algorithms:{}};
  for(const course of ['os','algorithms']){
    const reviewed=JSON.parse(await readFile(resolve(library,`assets/${course}-content-explanations.json`),'utf8'));
    for(const [id,meta] of Object.entries(reviewed.questions)){
      const versions=meta.versions.filter(v=>!v.sourceExplanation?.trim());
      if(versions.length)data[course][id]={versions};
    }
  }
  for(const file of await readdir(resolve(library,'assets'))){
    if(!/^os-.*-curation\.json$/.test(file))continue;
    const content=JSON.parse(await readFile(resolve(library,'assets',file),'utf8'));
    for(const [id,meta] of Object.entries(content.questions||{})){
      if(!meta.sourceSignature||!meta.explanation?.trim())continue;
      const row=data.os[id]??={};row.curations??=[];
      row.curations.push({sourceSignature:meta.sourceSignature,explanation:meta.explanation});
    }
  }
  await writeFile(output,JSON.stringify(data)+'\n');
}
