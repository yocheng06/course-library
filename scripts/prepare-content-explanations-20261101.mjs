import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {improve} from './explanation-improvements-20261101.mjs';
const context=vm.createContext({});vm.runInContext(await readFile('assets/explanation-content.js','utf8'),context);
const {rewrite,identity}=context.courseExplanationContent;
const entries=JSON.parse(await readFile('content/current-explanation-audit-20261101.json','utf8'));
const reports=[],json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
for(const course of ['os','algorithms']){
 const questions={};let improvementCount=0,letterCount=0,blankCount=0;
 for(const q of entries.filter(q=>q.course===course)){
  const sourceExplanation=String(q.explanation??q.ex??''),improved=improve(q),explanation=rewrite(q,improved??sourceExplanation);
  if(improved)improvementCount++;if(explanation!==(improved??sourceExplanation))letterCount++;if(!sourceExplanation.trim())blankCount++;
  if(sourceExplanation===explanation)continue;
  const meta=questions[q.id??q.bookmarkId]??={versions:[]};
  meta.versions.push({identity:identity(q),sourceExplanation,explanation});
 }
 const live=JSON.parse(await readFile(`content/${course}-public-explanation-audit-20261101.json`,'utf8'));
 const effective=new Map(entries.filter(q=>q.course===course).map(q=>[q.id??q.bookmarkId,q]));
 for(const row of [...live.questions,...live.overrides].filter(row=>!row.deleted)){
  const raw=row.question,id=raw?.id??raw?.bookmarkId,current=effective.get(id),meta=questions[id];
  if(!raw||!current||!meta||identity(raw)!==identity(current))continue;
  const sourceExplanation=String(raw.explanation??raw.ex??'');
  if(!meta.versions.some(v=>v.sourceExplanation===sourceExplanation))meta.versions.push({identity:identity(raw),sourceExplanation,explanation:meta.versions[0].explanation});
 }
 const payload={schema:1,course,date:'2026-11-01',questions};
 await writeFile(`assets/${course}-content-explanations.json`,JSON.stringify(payload,null,2)+'\n');
 let html=await readFile(course+'.html','utf8');
 const script='<script id="course-content-explanations" type="application/json">'+json(payload)+'</script>';
 if(html.includes('id="course-content-explanations"'))html=html.replace(/<script id="course-content-explanations" type="application\/json">[\s\S]*?<\/script>/,()=>script);
 else html=html.replace(/(?=<script src="assets\/question-tools\.js)/,()=>script+'\n<script src="assets/explanation-content.js?v=content-reasons-20261101"></script>\n');
 for(const name of ['question-tools',course+'-learning','question-corrections','course-exam'])html=html.replace(new RegExp(`assets/${name}\\.js\\?[^" ]+`,'g'),`assets/${name}.js?v=content-choice-order-20261102`);
 await writeFile(course+'.html',html);
 const rows=entries.filter(q=>q.course===course);
 const report={course,questions:rows.length,changed:Object.keys(questions).length,improved:improvementCount,referencesRewritten:letterCount,missingFilled:blankCount};reports.push(report);
 await writeFile(`content/${course}_解析內容改寫_20261101.md`,`# ${course==='os'?'作業系統':'演算法'}：以內容說明的解析\n\n檢查 ${rows.length} 題，修改 ${report.changed} 題，其中 ${improvementCount} 題補充或修正觀念，補齊 ${blankCount} 題原空白解析。原題、選項、老師答案與排序均保留。\n\n`+rows.filter(q=>questions[q.id??q.bookmarkId]).map(q=>`## ${q.id??q.bookmarkId}｜${q.unit}\n\n${q.stem??q.q}\n\n${questions[q.id??q.bookmarkId].versions[0].explanation}\n`).join('\n'));
}
await writeFile('docs/content-explanations-20261101.json',JSON.stringify({date:'2026-11-01',reports,preserved:['stems','options','teacher answers','order','formula variables','process names'],delivery:'Reviewed exact-version explanations in reading, practice and exams; later edits win.',references:[{title:'UIC Operating Systems: Threads',url:'https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/4_Threads.html'},{title:'UIC Operating Systems: Main Memory',url:'https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/8_MainMemory.html'},{title:'Arm ARMv7-A and ARMv7-R Architecture Reference Manual',url:'https://documentation-service.arm.com/static/5f8daeb7f86e16515cdb8c4e'},{title:'Arm AArch64 Memory Management',url:'https://developer.arm.com/-/media/Arm%20Developer%20Community/PDF/Learn%20the%20Architecture/LearnTheArchitecture-MemoryManagement-101811_0100_00_en.pdf'}]},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
