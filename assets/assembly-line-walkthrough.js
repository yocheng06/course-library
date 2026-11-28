(() => {
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cache=new Map();
 function parse(question){
  const text=String(question?.q??question?.stem??'').normalize('NFKC').replace(/\s+/g,'');
  // Only accept the complete, known two-line template. Extra constraints and images
  // may change the recurrence, so unknown versions retain their original explanation.
  if(question?.images?.length||question?.image||question?.imageUrl)return null;
  const numbers='([0-9]+(?:,[0-9]+)*)';
  const pattern=new RegExp('^在課本裝配線排程\\(Assembly-linescheduling\\)中,進入裝配線1需時間e1=([0-9]+)分離開時間:x1=([0-9]+),進入裝配線2需時間e2=([0-9]+)分離開時間:x2=([0-9]+),從線路1換到線路2的時間\\(t1代表從線路1的j-1站換到線路2的j站:t1=\\[-,'+numbers+'\\]從線路2換到線路1的時間\\(t2代表從線路2的j-1站換到線路1的j站:t2=\\[-,'+numbers+'\\]各站點處理時間\\(共([0-9]+)站點\\)線路1:\\['+numbers+'\\]分線路2:\\['+numbers+'\\]分請問到(.+)$','i');
  const match=text.match(pattern);if(!match)return null;
  const list=s=>s.split(',').map(Number),entry=[Number(match[1]),Number(match[3])],exit=[Number(match[2]),Number(match[4])];
  const processing=[list(match[8]),list(match[9])],transfer=[[null,...list(match[5])],[null,...list(match[6])]],n=processing[0].length;
  if(n<2||n>30||processing[1].length!==n||transfer.some(row=>row.length!==n)||match[7]!==Array.from({length:n},(_,j)=>j+1).join(''))return null;
  if([...entry,...exit,...processing.flat(),...transfer.flat().filter(x=>x!==null)].some(x=>!Number.isSafeInteger(x)||x>1e6))return null;
  const suffix=match[10],blank='(?:_{3,}|\\[__\\d+__\\])',numeric='\\(請用數字回答\\)';
  let query=null;
  const station=suffix.match(/^站點(\d+)的最少時間是多少$/);
  if(station&&Number(station[1])>=1&&Number(station[1])<=n)query={kind:'station',station:Number(station[1])};
  else if(suffix==='完成組裝的最少時間是多少分')query={kind:'exit'};
  else if(new RegExp('^最終出廠總時間最少是多少'+blank+numeric+'$').test(suffix))query={kind:'exit'};
  else if(new RegExp('^最終出廠總時間最少是多少'+blank+numeric+'最佳路徑為'+blank+'\\(格式1,S11,S22,S13,S24\\)第一個1表示先進線路1若是進線路2請寫2,sxy表示X線的y站點S11表示1線的1站點$','i').test(suffix))query={kind:'route'};
  else if(new RegExp('^用正常的算法找到最終最少出廠路線若是選這個算法算完的另一個時機是多少'+blank+numeric+'\\(例如算完後最少時間是由1線離開那此時你算完的線2離開是多少時間\\)算到站點4的最小值為'+blank+'$').test(suffix)&&n===4)query={kind:'other-exit'};
  else {
   const pair=suffix.match(new RegExp('^算到站點([0-9]+)時間最少是多少'+blank+numeric+'請問到算到站點([0-9]+)時間最少是多少'+blank+'$'));
   if(pair&&[Number(pair[1]),Number(pair[2])].every(j=>j>=1&&j<=n))query={kind:'stations',stations:[Number(pair[1]),Number(pair[2])]};
  }
  return query?{entry,exit,processing,transfer,query}:null;
 }
 function trace(input){
  const {entry,exit,processing,transfer}=input,n=processing[0].length,values=[Array(n).fill(null),Array(n).fill(null)],previous=[Array(n).fill(null),Array(n).fill(null)];
  const states=[{kind:'initial',values:values.map(row=>row.slice())}];
  for(let j=0;j<n;j++){
   const comparisons=[];
   for(let line=0;line<2;line++){
    const stay=j?values[line][j-1]+processing[line][j]:entry[line]+processing[line][j];
    const change=j?values[1-line][j-1]+transfer[1-line][j]+processing[line][j]:null;
    values[line][j]=change===null?stay:Math.min(stay,change);previous[line][j]=change===null||stay<=change?line:1-line;
    comparisons.push({line,j,stay,change,from:previous[line][j],value:values[line][j],tie:change!==null&&stay===change});
   }
   states.push({kind:'station',station:j+1,comparisons,values:values.map(row=>row.slice())});
  }
  const finishing=values.map((row,line)=>row[n-1]+exit[line]),minimum=Math.min(...finishing),last=finishing[0]<=finishing[1]?0:1;
  const route=Array(n);let line=last;
  for(let j=n-1;j>=0;j--){route[j]=line+1;if(j)line=previous[line][j];}
  states.push({kind:'exit',values:values.map(row=>row.slice()),finishing,minimum,route});
  return {input,states,values,previous,finishing,minimum,route};
 }
 function dataFor(input){const key=JSON.stringify(input);if(!cache.has(key)){if(cache.size>=80)cache.delete(cache.keys().next().value);cache.set(key,trace(input));}return cache.get(key);}
 function table(caption,rows,active=-1,route=null){
  return `<div class="assembly-scroll" tabindex="0" role="region" aria-label="${esc(caption)}，可左右捲動"><table><caption>${esc(caption)}</caption><thead><tr><th scope="col">線路／站點</th>${rows[0].map((_,j)=>`<th scope="col">${j+1}</th>`).join('')}</tr></thead><tbody>${rows.map((row,line)=>`<tr><th scope="row">線 ${line+1}</th>${row.map((value,j)=>`<td class="${j===active?'assembly-current ':''}${route?.[j]===line+1?'assembly-route':''}">${value===null?'—':value}${route?.[j]===line+1?'<span>最佳路徑</span>':''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 }
 function queryText(input){const q=input.query;return q.kind==='station'?`本題問第 ${q.station} 站：看該站兩線最小值，不加離場時間。`:q.kind==='stations'?`本題問第 ${q.stations.join('、')} 站：各自比較該站兩線值，不加離場時間。`:q.kind==='other-exit'?'本題同時問另一條線的出廠時間與末站最小值，兩者要分開讀表。':'本題問完成組裝／出廠：做完末站後，還要加各線離場時間。';}
 function calculations(data,state){
  const {entry,exit,processing,transfer}=data.input;
  if(state.kind==='initial')return '<p>表中的「—」表示尚未計算。按「下一步」，先算進入線路及第 1 站的時間。</p>';
  if(state.kind==='exit')return `<h5>最後才加離場時間</h5>${state.finishing.map((value,line)=>`<p>線 ${line+1}：${state.values[line].at(-1)} + ${exit[line]} = <strong>${value} 分</strong>。</p>`).join('')}<p>最少出廠時間 = min(${state.finishing.join(', ')}) = <strong>${state.minimum} 分</strong>。</p><p>一條最佳路徑：${state.route.map((line,j)=>`S${line}${j+1}`).join(' → ')} → 由線 ${state.route.at(-1)} 離場。</p><p>路徑是從末站回溯前驅得到，不能直接把每一欄較小的格子串起來。平手時演示保留原線；末站平手時顯示由線 1 離場的一條最佳路徑。</p>`;
  return `<h5>第 ${state.station} 站：比較兩種走法</h5>`+state.comparisons.map(c=>{
   const {line,j,stay,change,value,tie}=c,own=line+1,other=2-line;
   if(j===0)return `<div class="assembly-comparison"><strong>完成線 ${own} 第 1 站</strong><p>進入 ${entry[line]} + 加工 ${processing[line][0]} = <strong>${value} 分</strong>。</p></div>`;
   const prior=data.states[j].values;
   return `<div class="assembly-comparison"><strong>完成線 ${own} 第 ${j+1} 站</strong><p>留在原線：${prior[line][j-1]} + ${processing[line][j]} = ${stay}</p><p>從線 ${other} 換入：${prior[1-line][j-1]} + ${transfer[1-line][j]} + ${processing[line][j]} = ${change}</p><p>取 min(${stay}, ${change}) = <strong>${value} 分</strong>；${tie?'兩種走法平手，此處保留原線。':c.from===line?'留在原線較快。':`從線 ${other} 換入較快。`}</p></div>`;
  }).join('')+`<p>完成第 ${state.station} 站的最少時間 = min(${state.values.map(row=>row[state.station-1]).join(', ')}) = <strong>${Math.min(...state.values.map(row=>row[state.station-1]))} 分</strong>，尚未加離場時間。</p>`;
 }
 function body(data,index){const state=data.states[index];return table('最短完成時間 f（分鐘）',state.values,state.kind==='station'?state.station-1:-1,state.route)+`<div class="assembly-calculation">${calculations(data,state)}</div>`;}
 function markup(question){
  const input=parse(question);if(!input)return '';
  const data=dataFor(input);
  return `<section class="assembly-walkthrough" data-assembly-input="${esc(JSON.stringify(input))}" data-assembly-step="0" aria-label="裝配線排程逐步演示"><h4>裝配線排程：一步一步填表</h4><p class="assembly-question">${esc(queryText(input))}</p><details class="assembly-inputs"><summary>查看本題加工、進入與換線時間</summary><p>進入：線 1 = ${input.entry[0]}、線 2 = ${input.entry[1]}；離開：線 1 = ${input.exit[0]}、線 2 = ${input.exit[1]}（分鐘）。</p>${table('每站加工時間',input.processing)}${table('從此線換到另一線的時間（第 1 站不換線）',input.transfer)}</details><p class="assembly-hint">同一站的兩個值都從前一站計算。換線時間用「從哪條線離開」的那一列。表格可左右捲動。</p><div class="assembly-controls"><button type="button" data-assembly-action="previous" disabled>← 上一步</button><button type="button" data-assembly-action="next">下一步 →</button><button type="button" data-assembly-action="restart">重新開始</button><button type="button" data-assembly-action="finish">看完成結果</button></div><p data-assembly-counter class="assembly-counter" role="status" aria-live="polite">第 0／${data.states.length-1} 步：尚未開始</p><div data-assembly-body>${body(data,0)}</div></section>`;
 }
 function explanation(question,text,render){
  if(!parse(question))return null;
  const match=text.match(/(?:^|\n\s*\n)選項判讀：([\s\S]*)$/);
  const core='f1[j]、f2[j] 是完成第 j 站且停在該線的最短時間。每站比較「留在原線」和「從另一線換入」；出廠時間另外加上離場時間。';
  return markup(question)+`<div class="assembly-summary"><h4>核心觀念</h4><p>${esc(core)}</p></div>`+(match?`<div class="assembly-answer-summary"><h4>選項判讀</h4>${render(match[1])}</div><details class="assembly-full-calculation"><summary>查看完整文字解析</summary>${render(text.slice(0,match.index))}</details>`:`<div class="assembly-answer-summary"><h4>答案與填格說明</h4>${render(text.split(/\n\s*\n/).slice(-2).join("\n\n"))}</div><details class="assembly-full-calculation"><summary>查看完整文字解析</summary>${render(text)}</details>`);
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-assembly-action]'),root=button?.closest('[data-assembly-input]');if(!root)return;
  let data;try{data=dataFor(JSON.parse(root.dataset.assemblyInput));}catch{return;}
  const last=data.states.length-1,current=Number(root.dataset.assemblyStep),action=button.dataset.assemblyAction;
  const index=action==='restart'?0:action==='finish'?last:Math.max(0,Math.min(last,current+(action==='next'?1:-1)));
  root.dataset.assemblyStep=String(index);root.querySelector('[data-assembly-body]').innerHTML=body(data,index);
  root.querySelector('[data-assembly-counter]').textContent=`第 ${index}／${last} 步：${index===0?'尚未開始':index===last?'加離場時間，回溯最佳路徑':`完成第 ${index} 站`}`;
  root.querySelector('[data-assembly-action="previous"]').disabled=index===0;root.querySelector('[data-assembly-action="next"]').disabled=index===last;
 });
 window.courseAssemblyLine={parse,trace,markup,explanation};
})();
