// Small deterministic simulator for the supplied integer-time teaching examples.
function segment(list,name,start,end) {
  const last=list.at(-1);
  if(last?.name===name && last.end===start) last.end=end;
  else list.push({name,start,end});
}
export function simulate(processes,mode,{quantum=3}={}) {
  const jobs=processes.map((p,index)=>({...p,index,remaining:p.cpu,first:null,finish:null}));
  const segments=[],trace=[];let t=0,current=null,queue=[],next=0;
  const arrivals=jobs.slice().sort((a,b)=>a.arrival-b.arrival||a.index-b.index);
  const enqueue=()=>{while(next<arrivals.length&&arrivals[next].arrival<=t)queue.push(arrivals[next++]);};
  while(jobs.some(p=>p.remaining>0)) {
    if(t>10000)throw Error('Schedule exceeded teaching-example bound');
    if(mode==='rr') {
      enqueue();
      if(!queue.length){const end=arrivals[next].arrival;segment(segments,'閒置',t,end);t=end;continue;}
      current=queue.shift();const before=queue.map(p=>p.name),start=t,run=Math.min(quantum,current.remaining);
      current.first??=t;t+=run;current.remaining-=run;segment(segments,current.name,start,t);enqueue();
      if(current.remaining)queue.push(current);else current.finish=t;
      trace.push({time:start,end:t,chosen:current.name,before,remaining:current.remaining,after:queue.map(p=>p.name)});
      continue;
    }
    const ready=jobs.filter(p=>p.remaining>0&&p.arrival<=t);
    const previous=current;
    if(!ready.length){segment(segments,'閒置',t,t+1);t++;current=null;continue;}
    const ranked=ready.slice().sort((a,b)=>{
      const rank=mode==='fcfs'?a.arrival-b.arrival:mode==='priority'?a.priority-b.priority:mode==='srtf'?a.remaining-b.remaining:a.cpu-b.cpu;
      if(rank)return rank;
      if(mode==='srtf'&&previous?.remaining>0){if(a===previous)return -1;if(b===previous)return 1;}
      return a.arrival-b.arrival||a.index-b.index;
    });
    current=mode!=='srtf'&&previous?.remaining>0?previous:ranked[0];
    if(t===0||current!==previous||arrivals.some(p=>p.arrival===t))trace.push({time:t,chosen:current.name,ready:ready.map(p=>({name:p.name,remaining:p.remaining,cpu:p.cpu,arrival:p.arrival,priority:p.priority})),kept:current===previous});
    current.first??=t;segment(segments,current.name,t,t+1);current.remaining--;t++;
    if(!current.remaining)current.finish=t;
  }
  return {segments,trace,processes:jobs.map(p=>({...p,waiting:p.finish-p.arrival-p.cpu,response:p.first-p.arrival,turnaround:p.finish-p.arrival})),switches:segments.slice(1).filter((s,i)=>s.name!=='閒置'&&segments[i].name!=='閒置'&&s.name!==segments[i].name).length};
}
export function periodic(tasks,mode,until) {
  const jobs=tasks.flatMap((p,index)=>Array.from({length:Math.ceil(until/p.period)},(_,k)=>({name:p.name+'_'+(k+1),task:p.name,index,number:k+1,arrival:k*p.period,deadline:k*p.period+p.deadline,period:p.period,cpu:p.cpu,remaining:p.cpu,first:null,finish:null})));
  const segments=[];
  for(let t=0;t<until;t++){
    const ready=jobs.filter(p=>p.arrival<=t&&p.remaining>0).sort((a,b)=>(mode==='rm'?a.period-b.period:a.deadline-b.deadline)||a.arrival-b.arrival||a.index-b.index);
    const job=ready[0];segment(segments,job?.name||'閒置',t,t+1);
    if(job){job.first??=t;job.remaining--;if(!job.remaining)job.finish=t+1;}
  }
  const missed=jobs.filter(p=>p.deadline<=until&&(p.finish===null||p.finish>p.deadline));
  return {segments,jobs,missed};
}
export function clipSegments(segments,from,to){return segments.filter(s=>s.end>from&&s.start<to).map(s=>({...s,start:Math.max(s.start,from),end:Math.min(s.end,to)}));}
