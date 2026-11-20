import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const origin='https://course-library-submissions.orange06.workers.dev';
// Export anonymous public data only; keep every existing explanation and curation block.
const snapshots=await Promise.all(['os','algorithms'].map(async course=>{
 const file=course+'.html',html=await readFile(new URL(file,root),'utf8');
 const pattern=/<script id="course-community-snapshot" type="application\/json">([\s\S]*?)<\/script>/;
 const match=html.match(pattern);if(!match)throw new Error(file+': missing public snapshot');
 const existing=JSON.parse(match[1]);
 const response=await fetch(origin+'/api/questions?course='+course,{signal:AbortSignal.timeout(30000),cache:'no-store'});
 if(!response.ok)throw new Error(course+': public endpoint returned '+response.status);
 const data=await response.json();
 if(!['questions','aliases','overrides','units'].every(key=>Array.isArray(data[key])))throw new Error(course+': incomplete public response');
 return {file,html,pattern,snapshot:{...existing,schema:1,course,generatedAt:new Date().toISOString(),data}};
}));
await mkdir(new URL('assets/course-snapshots/',root),{recursive:true});
for(const {file,html,pattern,snapshot} of snapshots){
 const json=JSON.stringify(snapshot).replace(/</g,'\\u003c');
 await writeFile(new URL(file,root),html.replace(pattern,()=>'<script id="course-community-snapshot" type="application/json">'+json+'</script>'));
 await writeFile(new URL('assets/course-snapshots/'+snapshot.course+'.json',root),json+'\n');
 console.log(file+': '+snapshot.data.questions.length+' public questions; all curation blocks retained');
}
await import('./build-batch-library.mjs');
