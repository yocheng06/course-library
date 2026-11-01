import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
export async function effectiveQuestions(course){
 const html=await readFile(course+'.html','utf8'),{document,window}=parseHTML(html);
 const live=JSON.parse(await readFile(`content/${course}-public-explanation-audit-20261101.json`,'utf8'));
 const snapshot=document.getElementById('course-community-snapshot');const data=JSON.parse(snapshot.textContent);data.data=live;snapshot.textContent=JSON.stringify(data);
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 window.window=window;window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://example.com'};
 const context=vm.createContext({document,window,location:{search:'',protocol:'https:'},URLSearchParams,navigator:{onLine:true},AbortSignal,Date,console,requestAnimationFrame:f=>f(),scrollX:0,scrollY:0,innerHeight:900,CSS:{escape:String},localStorage:{getItem:()=>null,setItem:()=>{}},fetch:()=>new Promise(()=>{})});
 const names=['question-tools','choice-answers','practice-feedback',...(course==='os'?['scheduling-walkthrough']:['counting-sort-walkthrough','selection-explanations']),course+'-learning','course-bootstrap'];
 for(const name of names)vm.runInContext(await readFile('assets/'+name+'.js','utf8'),context);
 return JSON.parse(JSON.stringify(window.courseLearning.examEntries(true))).map(e=>({course,unit:e.unitId,id:e.id,...e.q}));
}
if(process.argv[1]?.endsWith('audit-explanations-20261101.mjs')){
 const entries=[...await effectiveQuestions('os'),...await effectiveQuestions('algorithms')];
 await writeFile('content/current-explanation-audit-20261101.json',JSON.stringify(entries,null,2)+'\n');
 const counts={};for(const q of entries){const k=q.course+'/'+q.unit;const s=counts[k]??={questions:0,explained:0,letterReferences:0,short:0};s.questions++;const ex=q.explanation??q.ex??'';if(ex.trim())s.explained++;if(/(?:答案|選項|^|\n)[：:\s]*[A-H](?![A-Za-z])|[A-H][、，／/][A-H]/m.test(ex))s.letterReferences++;if(ex.length>0&&ex.length<65)s.short++;}
 console.log(JSON.stringify(counts,null,2));
}
