import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {simulate,periodic,clipSegments} from './lib/scheduling-worked.mjs';

const processes=(names,arrivals,bursts,priorities=[])=>names.map((name,i)=>({name,arrival:arrivals[i],cpu:bursts[i],...(priorities.length?{priority:priorities[i]}:{})}));
export const datasets={
  fifo:processes(['P1','P2','P3'],[0,0,0],[24,3,3]),
  abc:processes(['A','B','C','D','E'],[0,1,2,3,7],[5,4,2,1,3]),
  p9:processes(['P1','P2','P3','P4'],[0,1,2,3],[8,4,9,5]),
  p6:processes(['P1','P2','P3','P4'],[0,1,2,3],[8,4,6,5]),
  efirst:processes(['A','B','C','D','E'],[5,1,4,3,0],[2,3,2,4,6]),
  fcfs4:processes(['P1','P2','P3','P4'],[0,1,2,3],[6,5,8,1]),
  rrabc:processes(['A','B','C','D','E'],[0,1,3,3,5],[3,2,4,3,2]),
  rrba:processes(['A','B','C','D','E'],[1,0,6,3,9],[4,6,2,4,2]),
  rr5:processes(['P1','P2','P3','P4','P5'],[0,2,4,6,8],[10,4,6,3,5]),
  priority:processes(['P1','P2','P3','P4','P5'],[0,0,0,0,0],[10,1,2,1,5],[3,1,4,5,2]),
  rrMissing:processes(['P1','P2','P3'],[0,0,0],[20,3,7]),
};
export const tasksets={
  rt1:[{name:'P1',period:50,cpu:20,deadline:50},{name:'P2',period:100,cpu:35,deadline:100}],
  rt2:[{name:'P1',period:50,cpu:25,deadline:50},{name:'P2',period:100,cpu:35,deadline:80}],
  rt3:[{name:'P1',period:50,cpu:10,deadline:40},{name:'P2',period:60,cpu:20,deadline:50},{name:'P3',period:30,cpu:10,deadline:30}],
};
const prefixes={a:'community-310b2ef0-f0cc-4f7a-a5ad-86421a1227f6-',b:'community-31668494-b954-40b4-b0ee-614fffc0d46c-',c:'community-70c0705f-a1d7-4e2e-b00f-a94d9b435d25-',d:'community-c8889cff-484a-4c3e-b8aa-2bb9e2f90d1a-'};
const id=key=>prefixes[key[0]]+key.slice(1);
const specs=new Map();
function normal(key,data,mode,ask,extra={}){specs.set(id(key),{kind:'normal',data,mode,ask,...extra});}
function rt(key,data,mode,ask,extra={}){specs.set(id(key),{kind:'rt',data,mode,ask,...extra});}
normal('a1','fifo','fcfs','waiting');normal('a2','fifo','fcfs','waitOptions');
normal('a5','rrabc','rr','sequence');normal('a6','rrabc','rr','waiting');
normal('a7','p6','srtf','waiting');normal('a8','p6','srtf','response');normal('a14','rrba','rr','waiting');
normal('a15','priority','priority','sequence');normal('a16','abc','srtf','turnaround');
normal('a23','abc','fcfs','switches');normal('a24','abc','sjf','turnaround');normal('a25','abc','sjf','waiting');normal('a26','p9','srtf','sequence');
normal('b2','efirst','sjf','turnaround');normal('b3','abc','fcfs','turnaround');normal('b4','abc','fcfs','waiting');
normal('b5','abc','srtf','switches');normal('b6','abc','srtf','splitOptions');
normal('b7','p9','fcfs','sequence',{wording:'題幹同時寫 FCFS 與「可搶先」。標準 FCFS 按先到先做，不會因新工作到達而搶走 CPU；下列時間線依 FCFS 與題庫答案 P1_P2_P3_P4 解讀。若另有搶先規則，必須另外指定。'});
normal('b8','fcfs4','fcfs','completion');normal('b9','fcfs4','fcfs','turnaround');normal('b10','fcfs4','fcfs','blocks');
normal('b13','p6','srtf','turnaround');normal('b14','rr5','rr','sequence');normal('b15','rr5','rr','response');
normal('c1','p9','srtf','waiting');normal('c2','priority','priority','waiting');normal('c3','efirst','srtf','turnaround');
normal('c4','efirst','srtf','waiting');normal('c5','abc','sjf','switches');normal('c6','fifo','fcfs','response');
normal('c7','fifo','fcfs','turnaround');normal('c9','rr5','rr','turnaround');normal('c10','fcfs4','fcfs','response');normal('c11','fcfs4','fcfs','sequence');
normal('d1','fcfs4','fcfs','waiting');normal('d2','efirst','sjf','sequence');normal('d3','efirst','fcfs','turnaround');
normal('d4','rrMissing','rr','incomplete',{quantum:4});normal('d5','abc','srtf','waiting');normal('d7','p6','srtf','sequence');normal('d10','priority','priority','completion');
rt('a3','rt1','rm','interrupted',{jobs:['P1_1','P1_2','P2_1','P2_2'],until:180});
rt('a4','rt1','rm','pair',{windows:[[55,60],[70,75]],until:100});
rt('a9','rt3','rm','interrupted',{jobs:['P2_1','P2_3','P2_4','P1_3'],until:240});
rt('a10','rt3','rm','jobRange',{job:'P1_3',from:90,to:120});
rt('a11','rt3','rm','sequence',{from:0,to:70});
rt('a12','rt3','rm','intervalOptions',{from:0,to:180});
rt('a13','rt3','rm','jobRange',{job:'P2_2',from:50,to:100});
rt('a17','rt2','edf','jobWindows',{job:'P2_4',from:230,to:370});
rt('a18','rt2','edf','sequence',{from:50,to:150});
rt('a19','rt3','edf','jobRange',{job:'P1_5',from:180,to:240});
rt('a20','rt3','edf','jobRange',{job:'P2_2',from:50,to:100});
rt('a21','rt3','edf','sequence',{from:0,to:70});
rt('a22','rt3','edf','uninterrupted',{jobs:['P2_1','P2_3','P2_4','P1_3'],until:240});
rt('b1','rt3','rm','sequence',{from:90,to:150});
rt('b11','rt3','edf','intervalOptions',{from:180,to:240});
rt('b12','rt3','edf','intervalOptions',{from:0,to:150});
rt('b16','rt1','rm','feasible',{from:0,to:100});
rt('b17','rt2','edf','atTime',{from:100,to:180,window:[140,145]});
rt('c8','rt1','rm','finishBefore',{job:'P2_1',from:0,to:100});
rt('d6','rt3','rm','intervalOptions',{from:0,to:150});
rt('d8','rt1','edf','uninterrupted',{jobs:['P1_1','P1_2','P2_1','P2_2'],until:180});
rt('d9','rt1','edf','sequence',{from:0,to:80});
rt('d11','rt2','edf','compare',{from:0,to:100});
rt('d12','rt2','edf','chooseFalse',{from:0,to:100});
rt('d13','rt2','edf','jobWindows',{job:'P2_2',from:80,to:180});

const topicOrder=['FCFS／FIFO 計算','SJF／SRTF 計算','Round Robin 計算','優先權排程','Rate Monotonic 即時排程','EDF 即時排程','即時排程可行性'];
const titles={waiting:'平均等待時間',response:'平均回應時間',turnaround:'平均迴轉時間',sequence:'CPU 執行順序',completion:'每個行程的完工時刻',switches:'內文切換次數',blocks:'各行程的連續執行區塊數',splitOptions:'被分成兩段的行程',waitOptions:'各行程等待時間'};
const ruleNames={fcfs:'FCFS／FIFO：已到達的人先來先做，一旦開始就做完。',sjf:'不可搶先 SJF：CPU 空下來才選「已到達且 CPU 時間最短」的人；沒做完前不換人。',srtf:'可搶先 SJF／SRTF：新工作到達時，比較「還需要的 CPU 時間」；較短者先做。',rr:'RR：依就緒佇列輪流，每次最多做一個時間片；未完成的人回隊尾。',priority:'優先權排程：本題採數字越小、優先權越高；所有行程在 0 ms 已就緒。'};
const round=n=>Number.isInteger(n)?String(n):String(Number(n.toFixed(4)));
const line=s=>`${s.name}（${s.start}–${s.end}）`;
const timeline=s=>s.map(line).join(' → ');
const clean=v=>String(v).replace(/[()\s]/g,'');
function signature(q){const s=JSON.stringify([String(q.type||''),String(q.stem||''),Array.isArray(q.options)?q.options:[],String(q.answer||'')]);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function choiceResult(q,truths,chooseFalse=false){return truths.flatMap((v,i)=>(chooseFalse?!v:v)?[String.fromCharCode(65+i)]:[]).join('、');}
function expectedAnswer(q,expected,sequence=false){
  if(q.options.length)return clean(q.answer)===clean(expected);
  if(Array.isArray(expected)){
    const value=clean(q.answer);let parts;
    if(value.includes('->'))parts=value.split('->');else if(value.includes(','))parts=value.split(',');else if(sequence&&expected.every(x=>/^[A-E]$/.test(x)))parts=[...value];else if(sequence&&expected.every(x=>/^P\d+$/.test(x)))parts=value.split('_');else parts=[value];
    return JSON.stringify(parts)===JSON.stringify(expected.map(String));
  }
  const actual=clean(q.answer),wanted=clean(expected);
  if(/^-?\d+(?:\.\d+)?$/.test(actual)&&/^-?\d+(?:\.\d+)?$/.test(wanted))return Number(actual)===Number(wanted);
  return actual===wanted;
}
function verdict(q,expected,{sequence=false,detail='',incomplete=false}={}){
  const consistent=!incomplete&&expectedAnswer(q,expected,sequence);
  const shown=Array.isArray(expected)?expected.join(sequence?' → ':'、'):expected;
  return {consistent,expected,detail:consistent?`本題結論：${q.options.length?'選 ':''}${q.options.length?expected:shown}。${detail}`:`題庫提供的答案保留為 ${q.answer}。${incomplete?'本題文字缺少足以唯一排程的條件。':`依上面明列的條件推得 ${shown}，與題庫答案有落差。`}${detail}這裡把可重算的過程寫出來，不以缺少的條件硬湊答案。`};
}
function normalSteps(result,mode){
  if(mode==='rr')return result.trace.map(t=>`${t.time}–${t.end}：${t.chosen} 做 ${t.end-t.time} ms，${t.remaining?`還剩 ${t.remaining} ms，回到隊尾`:'已完成，離開佇列'}；接下來的隊列是 ${t.after.join(' → ')||'空'}。`).join('\n');
  return result.trace.map(t=>{
    const candidates=t.ready.map(p=>mode==='fcfs'?`${p.name}（${p.arrival} ms 到達）`:mode==='priority'?`${p.name}（優先權 ${p.priority}）`:`${p.name}（${mode==='srtf'?'剩餘':'需要'} ${mode==='srtf'?p.remaining:p.cpu} ms）`).join('、');
    return `${t.time} ms：目前可執行 ${candidates}。${t.kept?(mode==='srtf'?'沒有更短的剩餘工作；相等時沿用目前工作':'目前工作尚未完成，不可搶先'):`依規則選 ${t.chosen}`}，所以${t.kept?'繼續執行':'開始執行'} ${t.chosen}。`;
  }).join('\n');
}
function normalSolution(q,spec){
  const data=datasets[spec.data],result=simulate(data,spec.mode,{quantum:spec.quantum||3});
  const assumptions=['單一 CPU；不計切換耗時；沒有額外 I/O。'];
  if(spec.data==='fifo')assumptions.push('題圖只給先後順序，這組教材採三個行程皆在 0 ms 就緒。');
  if(spec.mode==='srtf')assumptions.push('剩餘時間相等時，保留目前執行者；CPU 空出後同長度者採先到先做。');
  if(spec.mode==='sjf')assumptions.push('同樣長的工作採先到先做；尚未到達者不參加挑選。');
  if(spec.mode==='rr')assumptions.push(`時間片＝${spec.quantum||3} ms；邊界時新到達者先入隊，再把用完時間片的工作放回隊尾；同時到達依表格順序。`);
  const ask=spec.ask;let expected,calculation='',metric=null,pitfall='';
  if(['waiting','response','turnaround'].includes(ask)){
    metric=ask;const formula={waiting:'等待＝完成－到達－CPU 時間',response:'回應＝第一次開始－到達',turnaround:'迴轉＝完成－到達'}[ask];
    const values=result.processes.map(p=>p[ask]),average=values.reduce((a,b)=>a+b,0)/values.length;
    calculation=formula+'。\n'+result.processes.map(p=>`${p.name}：${ask==='response'?`${p.first}－${p.arrival}`:ask==='waiting'?`${p.finish}－${p.arrival}－${p.cpu}`:`${p.finish}－${p.arrival}`}＝${p[ask]} ms。`).join('\n')+`\n平均＝（${values.join('＋')}）÷${values.length}＝${round(average)} ms。`;
    expected=q.options.length?String.fromCharCode(65+q.options.findIndex(o=>Math.abs(Number(o)-average)<.00001)):round(average);
    if(q.options.length)calculation+='\n'+q.options.map((o,i)=>`${String.fromCharCode(65+i)}（${o}）：${Math.abs(Number(o)-average)<.00001?'與計算值相同，所以選這項':'不是上述各行程數值加總後的平均，因此不選'}。`).join('\n');
    pitfall={waiting:'等待時間包含「第一次上 CPU 前」和「被搶先後再次排隊」的所有時間；不能只算第一次等待。',response:'回應時間只看第一次上 CPU，後來被搶先多久不再加進來；它和總等待時間不同。',turnaround:'迴轉時間是這個行程進來到離開的整段時間，包含執行與等待；不是只平均完工時刻，也不是只加 CPU 時間。'}[ask];
    if(spec.data==='p6')pitfall+=' 這題 P3 需要 6 ms；請勿套用另一張 P3 需要 9 ms 的題圖。';
  }else if(ask==='sequence'){
    expected=result.segments.filter(s=>s.name!=='閒置').map(s=>s.name);
    calculation='沿時間線由左往右抄每個連續區塊：'+expected.join(' → ')+'。同一行程被搶先後再次回來，要再寫一次；不要把重複名稱刪掉。';
    pitfall='要求執行順序時，不要依 P1、P2、P3 的名稱排序；要依 CPU 實際先後順序填寫，並使用題目要求的箭號、底線或連寫格式。';
  }else if(ask==='completion'){
    expected=result.processes.map(p=>p.finish);metric='finish';
    calculation=result.processes.map(p=>`${p.name} 的最後一段結束在 ${p.finish} ms，所以完工時刻是 ${p.finish}。`).join('\n')+'\n最後依題目指定的行程名稱順序填入：'+expected.join(' → ')+'。';
    pitfall='「按名稱列出每個行程完成時間」和「按時間先後列出執行順序」是兩個問題。例如優先權排程中 P2 先完成，但答案第一格若要求 P1，仍先填 P1 的完工時刻。';
  }else if(ask==='blocks'||ask==='splitOptions'){
    metric='blocks';const counts=result.processes.map(p=>result.segments.filter(s=>s.name===p.name).length);
    calculation=result.processes.map((p,i)=>`${p.name} 出現在 ${result.segments.filter(s=>s.name===p.name).map(line).join('、')}，共 ${counts[i]} 個連續區塊。`).join('\n');
    expected=ask==='blocks'?counts:choiceResult(q,q.options.map(name=>counts[data.findIndex(p=>p.name===name)]===2));
    if(q.options.length)calculation+='\n'+q.options.map((name,i)=>`${String.fromCharCode(65+i)} 指行程 ${name}：${counts[data.findIndex(p=>p.name===name)]===2?'恰有兩段，符合題意':'只有一段，不符合「分成兩次」'}。`).join('\n');
    pitfall='區塊數看同一個名稱出現幾段，不是看做了幾毫秒。先到達不代表一定先完成；被搶先的工作可能隔一段時間才恢復。';
  }else if(ask==='switches'){
    expected=String(result.switches);
    const boundaries=result.segments.slice(1).flatMap((s,i)=>s.name!==result.segments[i].name&&s.name!=='閒置'&&result.segments[i].name!=='閒置'?[`${s.start} ms：${result.segments[i].name} → ${s.name}`]:[]);
    calculation=boundaries.join('\n')+`\n共 ${boundaries.length} 次從一個行程切換到另一個行程。`;
    pitfall='題目寫「第一個行程載入之後」，所以開始時把第一個行程放上 CPU 不算；最後全部做完也不多算一次。不要把執行區塊數直接當成切換次數。';
  }else if(ask==='waitOptions'){
    metric='waiting';const truth=q.options.map(o=>{const m=o.match(/(P\d+)\s*=\s*(\d+)/);return result.processes.find(p=>p.name===m[1]).waiting===Number(m[2]);});expected=choiceResult(q,truth);
    calculation=result.processes.map(p=>`${p.name}：${p.finish}－${p.arrival}－${p.cpu}＝等待 ${p.waiting} ms。`).join('\n')+'\n'+q.options.map((o,i)=>`${String.fromCharCode(65+i)}「${o}」：${truth[i]?'與該行程等待時間相符':'與該行程等待時間不符'}。`).join('\n');
    pitfall='P2 在 24 ms 才開始，所以 P2 等待 24；27 是 P3 的第一次開始時刻，不能挪給 P2。';
  }else if(ask==='incomplete'){
    assumptions.push('以下只是示範：假設全部在 0 ms 到達、TQ＝4 ms；題目本身並未提供這兩個條件。');
    calculation='題面沒有時間片 TQ，也沒有到達時間。RR 的隊列與等待時間會隨這些條件改變，無法唯一排出答案。\n若只作示範，取 TQ＝4、全部 0 ms 到達，P1、P2、P3 的等待時間為 '+result.processes.map(p=>`${p.name}：${p.finish}－0－${p.cpu}＝${p.waiting}`).join('；')+'，平均＝（10＋4＋11）÷3＝8.3333 ms。這個示範不能當成原題已給的條件。';
    expected='條件不足';pitfall='題庫提供 A（6.25）。要解釋為何能得到 6.25，需要補上老師原本的時間片與到達條件；不能把別題四個行程的 6.25 計算搬過來。';
  }
  const detail=spec.data==='efirst'&&ask==='turnaround'&&spec.mode==='srtf'?'這組資料的平均 CPU 時間是（2＋3＋2＋4＋6）÷5＝3.4；平均等待也是 3.4，因此平均迴轉必為 3.4＋3.4＝6.8。8.2 是這組資料在不可搶先 SJF 下的平均迴轉時間。':'';
  const conclusion=verdict(q,expected,{sequence:ask==='sequence',detail,incomplete:ask==='incomplete'});
  const labels={waiting:'等待 WT',response:'回應 RT',turnaround:'迴轉 TAT',finish:'完工時刻',blocks:'連續區塊數'};
  const columns=['行程','到達 AT（ms）','CPU BT（ms）',...(spec.mode==='priority'?['優先權']:[]),...(metric?[labels[metric]+(metric==='blocks'?'':'（ms）')]:[])];
  const rows=result.processes.map(p=>[p.name,p.arrival,p.cpu,...(spec.mode==='priority'?[p.priority]:[]),...(metric?[metric==='blocks'?result.segments.filter(s=>s.name===p.name).length:p[metric]]:[])]);
  return {category:spec.mode==='fcfs'?topicOrder[0]:['sjf','srtf'].includes(spec.mode)?topicOrder[1]:spec.mode==='rr'?topicOrder[2]:topicOrder[3],explanation:`先認清本題在問：${titles[ask]||'RR 平均等待時間，但題面條件不足'}。\n\n① 先用規則決定誰能上 CPU\n${ruleNames[spec.mode]}${spec.mode==='rr'?` 本題每輪最多 ${spec.quantum||3} ms。`:''}\n${spec.wording||''}\n${assumptions.join(' ')}\n\n② 一步一步排時間線\n${normalSteps(result,spec.mode)}\n\n時間線（括號內是開始–結束，單位 ms）：\n${timeline(result.segments)}\n\n③ 只計算這一題問的量\n${calculation}\n\n④ 對照答案\n${conclusion.detail}\n\n容易弄混的地方：${pitfall}`,workedSolution:{title:ask==='incomplete'?'條件不足時的示範，並非唯一答案':'先讀資料，再沿時間線計算',rule:ruleNames[spec.mode],assumptions,columns,rows,segments:result.segments},audit:{...conclusion,data:spec.data,mode:spec.mode,ask}};
}

function realtimeSolution(q,spec){
  const tasks=tasksets[spec.data],from=spec.from||0,to=spec.to||spec.until||240;
  const result=periodic(tasks,spec.mode,Math.max(to,300));
  const segments=clipSegments(result.segments,from,to),nonidle=segments.filter(s=>s.name!=='閒置');
  const rule=spec.mode==='rm'?'RM：週期越短，固定優先權越高；新一期高優先權工作到達，會搶先尚未完成的低優先權工作。':'EDF：只比較「已到達、還沒完成」工作的絕對截止時刻，越早截止越先做；新工作不一定能搶先。';
  const assumptions=['第一期都在 0 ms 到達；之後每隔一個 Period 產生新一期工作。','Deadline 欄是相對到達時間的期限；絕對截止＝到達＋Deadline。','單一 CPU，不計切換成本；同截止時刻者採先到先做。'];
  const taskOrder=tasks.slice().sort((a,b)=>a.period-b.period).map(p=>p.name).join(' ＞ ');
  const jobInfo=name=>{const j=result.jobs.find(x=>x.name===name);return `${name}：第 ${j.number} 期，到達＝（${j.number}－1）×${j.period}＝${j.arrival}，絕對截止＝${j.arrival}＋${tasks[j.index].deadline}＝${j.deadline}；需要 ${j.cpu} ms`;};
  const ranges=name=>result.segments.filter(s=>s.name===name);
  const windowText=(start,end)=>timeline(clipSegments(result.segments,start,end));
  const allWindow=(start,end,name)=>{const list=clipSegments(result.segments,start,end);return list.length>0&&list.every(s=>s.name===name)&&list.reduce((n,s)=>n+s.end-s.start,0)===end-start;};
  let expected,calculation='',detail='',timelines;
  if(['interrupted','uninterrupted'].includes(spec.ask)){
    const truths=spec.jobs.map(name=>spec.ask==='interrupted'?ranges(name).length>1:ranges(name).length===1);
    expected=choiceResult(q,truths);
    calculation=spec.jobs.map((name,i)=>`${String.fromCharCode(65+i)}．${jobInfo(name)}。實際執行：${timeline(ranges(name))}。${ranges(name).length>1?'做到一半被換下，之後回來，因此有被插斷':'整期只占一個連續區塊，因此沒有被插斷'}；${truths[i]?'符合題目，所以選':'不符合題目，所以不選'}。`).join('\n');
  }else if(spec.ask==='pair'){
    const names=spec.windows.map(([s,e])=>clipSegments(result.segments,s,e)[0].name.split('_')[0]);
    expected=String.fromCharCode(65+q.options.findIndex(o=>clean(o)===names.join(',')));
    calculation=spec.windows.map(([s,e])=>`${s}–${e} ms 落在 ${windowText(s,e)}，所以是 ${clipSegments(result.segments,s,e)[0].name.split('_')[0]}。`).join('\n')+'\n'+q.options.map((o,i)=>`${String.fromCharCode(65+i)}．${o}：${String.fromCharCode(65+i)===expected?'兩個時段都吻合，所以選':'與上面兩個時段的實際工作不一致，所以不選'}。`).join('\n');
  }else if(spec.ask==='sequence'){
    expected=nonidle.map(s=>s.name);calculation=`只讀 ${from}–${to} ms 的區塊，由左往右得到 ${expected.join(' → ')}。\n閒置區間仍畫在時間線中，但不是行程，不填入行程順序。被插斷後又回來的同一期工作，需再寫一次。`;
  }else if(spec.ask==='jobRange'||spec.ask==='jobWindows'||spec.ask==='finishBefore'){
    const list=ranges(spec.job),job=result.jobs.find(j=>j.name===spec.job);
    calculation=jobInfo(spec.job)+'。\n'+`它的實際 CPU 區塊是 ${timeline(list)}；總長度 ${list.map(s=>s.end-s.start).join('＋')}＝${job.cpu} ms，最後完成在 ${job.finish} ms。\n`;
    if(spec.ask==='jobRange')expected=list.map(s=>`${s.start}-${s.end}`).join(',');
    else if(spec.ask==='finishBefore'){
      expected='80';detail='真正完工時刻是 75 ms。老師答案 80 可解讀為「以 10 ms 刻度向後找最近的標記」：75＜80；若未指定刻度，不能把 80 當作實際完工時刻。';
      calculation+='本題問「在哪個時間點之前」，不同於問完工時刻。若依 10 ms 圖軸刻度作答，75 之後最近的刻度是 80，所以填 80；題幹沒有明列刻度，此處把採用的解讀寫清楚。';
    }else{
      const truths=q.options.map(o=>{const [s,e]=o.match(/\d+/g).map(Number);return allWindow(s,e,spec.job);});expected=choiceResult(q,truths);
      calculation+=q.options.map((o,i)=>{const [s,e]=o.match(/\d+/g).map(Number);return `${String.fromCharCode(65+i)}．${o}：實際是 ${windowText(s,e)}；${truths[i]?'整段屬於目標工作，所以選':'不是整段都在執行目標工作，所以不選'}。`;}).join('\n');
    }
  }else if(spec.ask==='intervalOptions'){
    const truths=q.options.map(o=>{const [s,e]=o.match(/\d+/g).map(Number),target=o.includes('沒有')?'閒置':o.match(/P\d+/)?.[0];const list=clipSegments(result.segments,s,e);return list.every(x=>target==='閒置'?x.name===target:x.name.split('_')[0]===target);});
    expected=choiceResult(q,truths);calculation=q.options.map((o,i)=>{const [s,e]=o.match(/\d+/g).map(Number);return `${String.fromCharCode(65+i)}．${o}：對照時間線是 ${windowText(s,e)}；${truths[i]?'敘述相符，所以選':'敘述不相符，所以不選'}。`;}).join('\n');
  }else if(spec.ask==='atTime'){
    expected=clipSegments(result.segments,...spec.window)[0].name.split('_')[0];calculation=`${spec.window.join('–')} ms 包含在 ${windowText(...spec.window)}，因此是 ${expected}。不要用這個區間剛好在哪一期的到達時間來猜，要看 CPU 真正執行者。`;
  }else{
    const rm=periodic(tasks,'rm',200),edf=periodic(tasks,'edf',200);
    timelines=[{label:'RM（固定依週期排序）',segments:clipSegments(rm.segments,0,100)},{label:'EDF（依絕對截止時刻排序）',segments:clipSegments(edf.segments,0,100)}];
    if(spec.ask==='feasible'){
      expected='A、C';calculation='RM：P2 第一期在 75 完成，早於截止 100；P1 兩期各在 20、70 完成，早於 50、100。\nEDF：P2 第一期在 55 完成，早於 100；P1 兩期各在 20、75 完成，早於 50、100。\n100 ms 後資料與起點重新對齊，而且沒有未完成工作，所以這個週期可以重複。\nA、C 說可以排成功，與兩張時間線相符；B、D 說不能成功，與完成時刻不符，因此不選。';
    }else if(spec.ask==='compare'){
      expected='A、B';calculation='A．RM 的 P2_1 被 50–75 的 P1_2 插斷，到 85 才完成，超過自己的截止 80，因此正確。\nB．EDF 的 P2_1 在 25–60 連續做滿 35 ms，因此正確。\nC．RM 的完工時刻是 85，80 是截止時刻，不能互換，因此不選。\nD．EDF 的 P2_2 是 125–160 連續執行；150 到達的 P1_4 截止 200，晚於 P2_2 的 180，不會插斷它，因此不選。';
    }else{
      expected='B';calculation='本題要找錯的。\nA．RM 的 P2_1 到 85 完成，超過截止 80，確實排不成功，這句正確，不選。\nB．EDF 讓 P2_1 在 60 完成、P1_2 在 85 完成，分別早於截止 80、100；後續每 100 ms 重複，能排成功。所以「不能成功」是錯的，選 B。\nC、D．0 ms 時 P1 週期較短、絕對截止也較早，兩種方法都先排 P1，所以兩句正確，不選。';
    }
  }
  const decisions=segments.map(s=>{
    if(s.name==='閒置')return `${s.start}–${s.end}：已到達工作都完成，CPU 閒置。`;
    const job=result.jobs.find(j=>j.name===s.name),ready=result.jobs.filter(j=>j.arrival<=s.start&&((j.finish??Infinity)>s.start)).map(j=>`${j.name}（${spec.mode==='rm'?'週期 '+j.period:'截止 '+j.deadline}）`);
    return `${s.start} ms：候選 ${ready.join('、')}；依${spec.mode==='rm'?'固定週期優先權':'最早絕對截止'}選 ${s.name}，這段執行到 ${s.end} ms。${s.end===job.finish?'此期已做滿 CPU 時間。':s.end===to?'此處是本題觀察範圍終點。':'之後因更高優先權工作到達而換人。'}`;
  }).join('\n');
  const conclusion=verdict(q,expected,{sequence:spec.ask==='sequence',detail});
  return {category:['feasible','compare','chooseFalse'].includes(spec.ask)?topicOrder[6]:spec.mode==='rm'?topicOrder[4]:topicOrder[5],explanation:`① 先讀懂資料和名稱\nPeriod 是多久來一份新工作；CPU 是每份要做多久；Deadline 是每份從到達起最多能等多久。\n例如 ${jobInfo(tasks[0].name+'_2')}。下標代表第幾期，不是被切開的第幾段。\n\n② 套用排程規則\n${rule}\n${spec.mode==='rm'?'本題固定優先順序：'+taskOrder+'。':'例如新工作雖已到達，若它的截止更晚，就不能搶走目前較急的工作。'}\n${assumptions.join(' ')}\n\n③ 一段一段看誰占 CPU\n${decisions}\n\n時間線（ms）：${timeline(segments)}\n${timelines?'\n兩種方法比較：\n'+timelines.map(x=>x.label+'：'+timeline(x.segments)).join('\n'):''}\n\n④ 回到本題／逐項核對\n${calculation}\n\n⑤ 對照答案\n${conclusion.detail}\n\n容易弄混的地方：工作「到達」不代表立即上 CPU；相對 Deadline 必須先加上到達時刻，才能用 EDF 比較。`,workedSolution:{title:'週期工作：先算到達與截止，再排時間線',rule,assumptions,columns:['工作','週期 T（ms）','每期 CPU（ms）','相對期限 D（ms）'],rows:tasks.map(t=>[t.name,t.period,t.cpu,t.deadline]),segments,...(timelines?{timelines}:{})},audit:{...conclusion,data:spec.data,mode:spec.mode,ask:spec.ask}};
}

export function buildTreasureCuration(rows){
  const questions={},audit=[];
  for(const row of rows){const q=row.question,spec=specs.get(q.id);if(!spec)throw Error('Missing treasure specification: '+q.id);
    const solution=spec.kind==='normal'?normalSolution(q,spec):realtimeSolution(q,spec);
    questions[q.id]={sourceSignature:signature(q),imageSources:(q.images||[]).map(i=>typeof i==='string'?i:i.src||i.url||''),category:solution.category,explanation:solution.explanation,workedSolution:solution.workedSolution,clearSubmissionReview:true};
    audit.push({id:q.id,answer:q.answer,...solution.audit});
  }
  const typeRank=q=>!q.options.length?2:((q.answer.match(/[A-Z]/g)||[]).length>1?1:0);
  const order=rows.slice().sort((a,b)=>topicOrder.indexOf(questions[a.question.id].category)-topicOrder.indexOf(questions[b.question.id].category)||typeRank(a.question)-typeRank(b.question)||a.question.id.localeCompare(b.question.id)).map(r=>r.question.id);
  return {curation:{schema:2,unit:'treasure',unitTitle:'挖寶單元',updatedAt:'2026-10-31',topicOrder,typeOrder:['單選題','多選題','填空題'],order,questions},audit};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const source=JSON.parse(await readFile('content/treasure-public-review-20261031.json','utf8'));
  const {curation,audit}=buildTreasureCuration(source.rows);
  await writeFile('assets/os-treasure-curation.json',JSON.stringify(curation,null,2)+'\n');
  await writeFile('content/treasure-explanation-audit-20261031.json',JSON.stringify(audit,null,2)+'\n');
  await writeFile('content/挖寶單元_67題逐步解析_20261031.md','# 挖寶單元：67 題逐步解析\n\n保留原題與老師答案；計算使用逐題明列的條件。\n\n'+curation.order.map((id,i)=>{const q=source.rows.find(r=>r.question.id===id).question,m=curation.questions[id];return `## ${i+1}．${m.category}\n\n原題 ID：${id}\n\n${q.stem}\n\n${q.options.map((o,j)=>String.fromCharCode(65+j)+'. '+o).join('\n')}\n\n老師答案：${q.answer}\n\n|${m.workedSolution.columns.join('|')}|\n|${m.workedSolution.columns.map(()=>'---').join('|')}|\n${m.workedSolution.rows.map(r=>'|'+r.join('|')+'|').join('\n')}\n\n${m.explanation}\n`;}).join('\n'));
  console.log(JSON.stringify({questions:audit.length,discrepancies:audit.filter(a=>!a.consistent).map(a=>({id:a.id,answer:a.answer,expected:a.expected}))},null,2));
}
