import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
export async function loadCourse(course,{live,linkedQuestion='',ordering=true}={}){
 const {window,document}=parseHTML(await read(course+'.html'));
 if(live){const script=document.getElementById('course-community-snapshot'),snapshot=JSON.parse(script.textContent);snapshot.data=live;script.textContent=JSON.stringify(snapshot);}
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 const scrolledQuestions=[];
 window.window=window;window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){if(this.dataset.id)scrolledQuestions.push(this.dataset.id);};window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://example.com'};
 if(!ordering)window.courseTopicOrder=null;
 const stored=new Map();let respond;
 const context=vm.createContext({window,document,location:{search:linkedQuestion?'?question='+linkedQuestion:'',protocol:'https:'},URLSearchParams,navigator:{onLine:true},AbortSignal,Date,console,requestAnimationFrame:f=>f(),scrollX:0,scrollY:0,innerHeight:900,CSS:{escape:String},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},fetch:()=>new Promise(resolve=>respond=resolve)});
 const names=['explanation-content','question-tools','choice-answers','practice-feedback',...(course==='os'?['scheduling-walkthrough']:['counting-sort-walkthrough','selection-explanations','assembly-line-walkthrough']),...(ordering?['topic-order']:[]),course+'-learning','sync-summary','course-bootstrap'];
 for(const name of names)vm.runInContext(await read('assets/'+name+'.js'),context);
 return {window,document,config:window.courseLearning,scrolledQuestions,respond:data=>respond({ok:true,headers:{get:()=>new Date().toUTCString()},json:async()=>data})};
}
export function orderingIssues(entries,tools,course){
 const seen=new Set(),types=new Map(),premises=new Set(),minimumTypes=new Map(),topicTypes=new Map();let previous='',previousPremise='';const issues=[];
 for(const entry of entries){const label=tools.topic(entry.q,course,entry.unitId).label,group=entry.unitId+'/'+label+'/'+(tools.premiseKey?.(entry.q)??entry.id);minimumTypes.set(group,Math.min(minimumTypes.get(group)??2,tools.typeRank(entry.q)));}
 for(const entry of entries){
  const {label}=tools.topic(entry.q,course,entry.unitId),key=entry.unitId+'/'+label,rank=tools.typeRank(entry.q);
  if(key!==previous&&seen.has(key))issues.push({id:entry.id,reason:'topic-interleaved',topic:label});
  const premise=tools.premiseKey?.(entry.q),group=key+'/'+(premise??entry.id);
  if(group!==previousPremise&&premises.has(group))issues.push({id:entry.id,reason:'premise-interleaved',topic:label});
  if(group!==previousPremise&&(topicTypes.get(key)??-1)>minimumTypes.get(group))issues.push({id:entry.id,reason:'premise-group-type-reversed',topic:label});
  if((types.get(group)??-1)>rank)issues.push({id:entry.id,reason:'type-reversed-within-premise',topic:label});
  topicTypes.set(key,minimumTypes.get(group));
  seen.add(key);premises.add(group);types.set(group,rank);previous=key;previousPremise=group;
 }
 return issues;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const reports=[];let markdown='# 全站主題與題型排序檢查\n\n規則：單元 → 同主題 → 相同前提的版本相鄰 → 組內單選、多選、填空。條件不同不併組；同組同題型保留原有相對順序。新投稿每次同步後自動套用。\n\n';
 for(const course of ['os','algorithms']){
  const live=JSON.parse(await read(`content/${course}-public-topic-order-20261102.json`));
  const before=await loadCourse(course,{live,ordering:false}),old=before.config.examEntries(true);
  const after=await loadCourse(course,{live}),entries=after.config.examEntries(true),tools=after.window.courseTopicOrder;
  const oldIssues=orderingIssues(old,tools,course),issues=orderingIssues(entries,tools,course);
  if(issues.length)throw Error(JSON.stringify(issues));
  const units=[];
  for(const unit of after.config.examUnits()){
   const rows=entries.filter(e=>e.unitId===unit.id),topics=[];
   for(const entry of rows){const label=tools.topic(entry.q,course,entry.unitId).label;let topic=topics.find(t=>t.name===label);if(!topic){topic={name:label,single:0,multiple:0,fill:0,ids:[]};topics.push(topic);}topic[['single','multiple','fill'][tools.typeRank(entry.q)]]++;topic.ids.push(entry.id);}
   units.push({id:unit.id,label:unit.label,count:rows.length,topics});
   markdown+=`## ${course==='os'?'作業系統':'演算法'}｜${unit.label}（${rows.length} 題）\n\n| 主題 | 單選 | 多選 | 填空 |\n|---|---:|---:|---:|\n`+topics.map(t=>`| ${t.name} | ${t.single} | ${t.multiple} | ${t.fill} |`).join('\n')+'\n\n';
  }
  reports.push({course,count:entries.length,beforeViolations:oldIssues.length,afterViolations:issues.length,units});
 }
 await writeFile('docs/topic-order-audit-20261102.json',JSON.stringify(reports,null,2)+'\n');
 await writeFile('content/全站主題與題型排序檢查_20261102.md',markdown.trimEnd()+'\n');
 console.log(JSON.stringify(reports.map(({course,count,beforeViolations,afterViolations,units})=>({course,count,beforeViolations,afterViolations,units:units.length})),null,2));
}
