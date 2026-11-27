// Deterministic reference calculations for the reviewed L10 examples.
export function matrixChain(dimensions){
 const n=dimensions.length-1,cost=Array.from({length:n},()=>Array(n).fill(null)),cuts=Array.from({length:n},()=>Array.from({length:n},()=>[]));
 for(let i=0;i<n;i++)cost[i][i]=0;
 for(let length=2;length<=n;length++)for(let i=0;i+length<=n;i++){
  const j=i+length-1;cost[i][j]=Infinity;
  for(let k=i;k<j;k++){
   const candidate=cost[i][k]+cost[k+1][j]+dimensions[i]*dimensions[k+1]*dimensions[j+1];
   if(candidate<cost[i][j]){cost[i][j]=candidate;cuts[i][j]=[k];}else if(candidate===cost[i][j])cuts[i][j].push(k);
  }
 }
 const expressions=(i,j)=>i===j?[String.fromCharCode(65+i)]:cuts[i][j].flatMap(k=>expressions(i,k).flatMap(left=>expressions(k+1,j).map(right=>'('+left+right+')')));
 return {dimensions,cost,cuts,minimum:cost[0][n-1],expressions:expressions(0,n-1)};
}
export function assemblyLine({processing,entry,exit,transfer}){
 const n=processing[0].length,values=[[],[]],previous=[[],[]],steps=[];
 for(let line=0;line<2;line++){values[line][0]=entry[line]+processing[line][0];previous[line][0]=null;}
 for(let j=1;j<n;j++)for(let line=0;line<2;line++){
  const stay=values[line][j-1]+processing[line][j],change=values[1-line][j-1]+transfer[1-line][j]+processing[line][j];
  values[line][j]=Math.min(stay,change);previous[line][j]=stay<=change?line:1-line;steps.push({station:j+1,line:line+1,stay,change,value:values[line][j]});
 }
 const finishing=values.map((row,line)=>row[n-1]+exit[line]),minimum=Math.min(...finishing);
 const routes=finishing.flatMap((value,last)=>{if(value!==minimum)return[];let line=last;const route=Array(n);for(let j=n-1;j>=0;j--){route[j]=line+1;if(j)line=previous[line][j];}return[route];});
 return {values,previous,steps,finishing,minimum,routes};
}
export function longestCommonSubsequence(x,y){
 const table=Array.from({length:x.length+1},()=>Array(y.length+1).fill(0)),arrows=Array.from({length:x.length+1},()=>Array(y.length+1).fill(''));
 for(let i=1;i<=x.length;i++)for(let j=1;j<=y.length;j++){
  if(x[i-1]===y[j-1]){table[i][j]=table[i-1][j-1]+1;arrows[i][j]='LU';}
  else if(table[i-1][j]>=table[i][j-1]){table[i][j]=table[i-1][j];arrows[i][j]='U';}
  else{table[i][j]=table[i][j-1];arrows[i][j]='L';}
 }
 let i=x.length,j=y.length,reverse='';const trace=[];
 while(i&&j){const direction=arrows[i][j];trace.push({i,j,value:table[i][j],direction,character:direction==='LU'?x[i-1]:''});if(direction==='LU'){reverse+=x[i-1];i--;j--;}else if(direction==='U')i--;else j--;}
 return {x,y,table,arrows,length:table[x.length][y.length],sequence:[...reverse].reverse().join(''),trace};
}
export function knapsack01(items,capacity){
 const table=Array.from({length:items.length+1},()=>Array(capacity+1).fill(0));
 for(let i=1;i<=items.length;i++)for(let w=0;w<=capacity;w++){
  const {weight,value}=items[i-1];table[i][w]=Math.max(table[i-1][w],weight<=w?table[i-1][w-weight]+value:-Infinity);
 }
 const selected=[];let w=capacity;
 for(let i=items.length;i>0;i--)if(table[i][w]!==table[i-1][w]){selected.push(i-1);w-=items[i-1].weight;}
 return {table,maximum:table[items.length][capacity],selected:selected.reverse()};
}
