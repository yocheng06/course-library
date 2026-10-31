import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {simulate,periodic} from '../scripts/lib/scheduling-worked.mjs';
import {datasets,tasksets,buildTreasureCuration} from '../scripts/curate-treasure-20261031.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rows=JSON.parse(read('content/treasure-public-review-20261031.json')).rows;
test('independently calculated normal schedules and metrics distinguish similar figures',()=>{
  const cases=[['abc','fcfs',4.8,7.8],['abc','sjf',3.4,6.4],['abc','srtf',3,6],['p9','srtf',6.5,13],['p6','srtf',6.25,12],['efirst','sjf',4.8,8.2],['efirst','srtf',3.4,6.8],['fcfs4','fcfs',7.5,12.5],['rrabc','rr',4,6.8],['rrba','rr',7.8,11.4],['rr5','rr',12.6,18.2],['priority','priority',8.2,12]];
  for(const [data,mode,waiting,turnaround] of cases){const result=simulate(datasets[data],mode),mean=k=>result.processes.reduce((a,p)=>a+p[k],0)/result.processes.length;
    assert.equal(mean('waiting'),waiting,data+mode+' waiting');assert.equal(mean('turnaround'),turnaround,data+mode+' turnaround');
    for(const p of result.processes){assert.equal(result.segments.filter(s=>s.name===p.name).reduce((n,s)=>n+s.end-s.start,0),p.cpu);assert(p.first>=p.arrival);assert.equal(p.turnaround,p.waiting+p.cpu);}
  }
  assert.deepEqual(simulate(datasets.abc,'srtf').segments.map(s=>[s.name,s.start,s.end]),[['A',0,2],['C',2,4],['D',4,5],['A',5,8],['E',8,11],['B',11,15]]);
});
test('RM and EDF compare absolute deadlines, retain jobs across preemption and honor tie rule',()=>{
  const rm=periodic(tasksets.rt2,'rm',200),edf=periodic(tasksets.rt2,'edf',200);
  assert.equal(rm.jobs.find(j=>j.name==='P2_1').finish,85);assert.equal(edf.jobs.find(j=>j.name==='P2_1').finish,60);
  assert(rm.missed.some(j=>j.name==='P2_1'));assert.equal(edf.missed.length,0);
  assert.deepEqual(edf.segments.filter(s=>s.name==='P2_2'),[{name:'P2_2',start:125,end:160}]);
  const three=periodic(tasksets.rt3,'edf',240);
  assert.deepEqual(three.segments.filter(s=>s.name==='P1_5'),[{name:'P1_5',start:210,end:220}]);
  for(const [data,tasks] of Object.entries(tasksets))for(const mode of ['rm','edf']){const result=periodic(tasks,mode,600);for(const j of result.jobs){const used=result.segments.filter(s=>s.name===j.name).reduce((n,s)=>n+s.end-s.start,0);assert.equal(used+j.remaining,j.cpu,data+mode+j.name);assert(used<=j.cpu);}}
});
test('all 67 current questions have independent explanations and preserve source questions and answers',()=>{
  const before=JSON.stringify(rows),{curation,audit}=buildTreasureCuration(rows);
  assert.equal(curation.order.length,67);assert.equal(new Set(curation.order).size,67);assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(curation,JSON.parse(read('assets/os-treasure-curation.json')));
  assert.equal(audit.filter(q=>!q.consistent).length,7);
  for(const q of audit.filter(q=>!q.consistent)){assert.match(curation.questions[q.id].explanation,/題庫提供的答案保留/);}
  for(const r of rows){const m=curation.questions[r.question.id];assert(m.explanation.length>500);assert(m.workedSolution.rows.length);assert(m.workedSolution.segments.length);assert.match(m.explanation,/①/);assert.match(m.explanation,/時間線/);}
  let prior=-1;
  for(const id of curation.order){const q=rows.find(r=>r.question.id===id).question,m=curation.questions[id],rank=curation.topicOrder.indexOf(m.category)*3+(!q.options.length?2:(q.answer.match(/[A-Z]/g)||[]).length>1?1:0);assert(rank>=prior);prior=rank;}
});
test('safe visual walkthrough renders a readable table and ordered time blocks without HTML injection',()=>{
  const context={window:{}};vm.runInNewContext(read('assets/scheduling-walkthrough.js'),context);
  const curation=JSON.parse(read('assets/os-treasure-curation.json'));
  const html=context.window.courseSchedulingWalkthrough.markup({...Object.values(curation.questions)[0].workedSolution,title:'<img src=x onerror=alert(1)>',rows:[['<script>unsafe</script>',0,1]],segments:[{name:'<img src=x>',start:0,end:1},{name:'bad',start:NaN,end:5}]});
  const {document}=parseHTML('<html><body>'+html+'</body></html>');
  assert.equal(document.querySelectorAll('img,script').length,0);assert.equal(document.querySelectorAll('caption').length,1);assert.equal(document.querySelectorAll('li').length,1);assert.match(document.body.textContent,/<img src=x>/);assert(!document.body.textContent.includes('NaN'));
});
test('page contains matching current treasure snapshot and loads walkthrough before lesson renderer',()=>{
  const html=read('os.html'),{document}=parseHTML(html),snapshot=JSON.parse(document.getElementById('course-community-snapshot').textContent);
  assert.deepEqual(snapshot,JSON.parse(read('assets/course-snapshots/os.json')));
  assert.deepEqual(snapshot.data.questions.filter(r=>r.unit==='treasure'),rows);
  assert.deepEqual(JSON.parse(document.getElementById('course-os-treasure-curation').textContent),JSON.parse(read('assets/os-treasure-curation.json')));
  assert(html.indexOf('assets/scheduling-walkthrough.js')<html.indexOf('assets/os-learning.js'));
});
test('real lesson bootstrap shows all 67 explanations and respects later public edits or changed pictures',async()=>{
  const {window,document}=parseHTML(read('os.html'));
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
  window.window=window;window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://example.com'};
  const linked=rows[0].question.id,storage=new Map();let resolve;
  const context=vm.createContext({window,document,location:{search:'?question='+linked,protocol:'https:'},URLSearchParams,navigator:{onLine:true},AbortSignal,Date,console,requestAnimationFrame:f=>f(),scrollX:0,scrollY:0,innerHeight:900,CSS:{escape:String},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:()=>new Promise(r=>resolve=r)});
  for(const name of ['question-tools','choice-answers','practice-feedback','scheduling-walkthrough','os-learning','course-bootstrap'])vm.runInContext(read('assets/'+name+'.js'),context);
  const config=window.courseLearning;
  assert.equal(config.examEntries(['treasure']).length,67);
  for(const row of rows){const q=config.questionForEdit(row.question.id);assert(q.workedSolution);assert(q.explanation);assert.equal(q.answer,row.question.answer);assert.equal(q.stem,row.question.stem);}
  assert(document.querySelector('.worked-solution table'));
  const revised=structuredClone(rows);revised[0].question.explanation='使用者新增的解析，應優先保留。';
  const imageRow=revised.find(r=>r.question.images?.length);imageRow.question.images[0].src+='?changed=1';
  resolve({ok:true,headers:{get:()=>new Date().toUTCString()},json:async()=>({questions:revised,aliases:[],overrides:[]})});await new Promise(r=>setImmediate(r));
  assert.equal(config.questionForEdit(linked).explanation,revised[0].question.explanation);assert(!config.questionForEdit(linked).workedSolution);
  assert(!config.questionForEdit(imageRow.question.id).workedSolution);
});
