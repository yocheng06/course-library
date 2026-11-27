export function hashInput(stem){
 const keys=stem.match(/將鍵值\s+([\d、,，\s]+)\s+插入/)?.[1].split(/[、,，\s]+/).filter(Boolean).map(Number);
 const size=Number(stem.match(/m\s*=\s*(\d+)/)?.[1]);
 if(!keys?.length||keys.some(k=>!Number.isSafeInteger(k))||!Number.isInteger(size)||size<1)throw Error('雜湊題輸入無法完整辨識');
 const double=/雙重雜湊|double hashing/i.test(stem),quadratic=/二次探測|quadratic probing/i.test(stem);
 const c1=quadratic?Number(stem.match(/c_?1\s*=\s*(\d+)/)?.[1]):null,c2=quadratic?Number(stem.match(/c_?2\s*=\s*(\d+)/)?.[1]):null;
 const stepBase=double?Number(stem.match(/h2\(k\)\s*=\s*(\d+)\s*\+/i)?.[1]):null;
 if(quadratic&&(!Number.isFinite(c1)||!Number.isFinite(c2)))throw Error('二次探測係數未完整辨識');
 if(double&&(!Number.isFinite(stepBase)||!new RegExp('mod\\s*\\(m\\s*-\\s*1\\)').test(stem)))throw Error('雙重雜湊步長未完整辨識');
 return {keys,size,method:double?'double':quadratic?'quadratic':'linear',c1,c2,stepBase};
}
export function simulateHash(input){
 const {keys,size,method,c1,c2,stepBase}=input,table=Array(size).fill(null),traces=[],failed=[];
 const mod=k=>((k%size)+size)%size;
 for(const key of keys){
  const step=method==='double'?stepBase+key%(size-1):1,attempts=[];let position=null;
  for(let i=0;i<size;i++){
   const offset=method==='quadratic'?c1*i+c2*i*i:i*step,index=mod(key+offset),occupant=table[index];
   attempts.push({i,index,occupant,offset});
   if(occupant===null){table[index]=key;position=index;break;}
  }
  if(position===null)failed.push(key);
  traces.push({key,step,attempts,position});
 }
 return {input,table,traces,failed};
}
export function hashCalculation(question){
 const stem=question.q??question.stem,options=question.opts??question.options??[],answer=question.a??question.answer;
 const input=hashInput(stem),result=simulateHash(input),{size,method,c1,c2,stepBase}=input;
 const category=method==='double'?'雙重雜湊':method==='quadratic'?'二次探測':'線性探測';
 const formula=method==='double'?`h(k,i)=(k+i×(${stepBase}+(k mod ${size-1}))) mod ${size}`:method==='quadratic'?`h(k,i)=(k+${c1}i+${c2}i²) mod ${size}`:`h(k,i)=(k+i) mod ${size}`;
 const setup=method==='double'?'先為每個鍵算自己的步長，再保持該步長探測；同一鍵的步長不隨 i 改變。':method==='quadratic'?'係數須逐字看題目；c2=3 與 c2=5 會得到不同結果。i² 是探測編號的平方，不能把鍵值平方。':'碰撞後每次往後一格，超過末格就繞回第 0 格。';
 const worked=result.traces.map(({key,step,attempts,position})=>`鍵 ${key}${method==='double'?`：步長=${stepBase}+(${key} mod ${size-1})=${step}`:'：'}\n`+attempts.map(a=>`i=${a.i}，(${key}+${a.offset}) mod ${size}=${a.index}，${a.occupant===null?'空槽，放入此鍵':`已有 ${a.occupant}，繼續探測`}`).join('\n')+(position===null?'\n已試完 i=0～'+(size-1)+'，未找到空槽；本鍵未插入。':'' )).join('\n\n');
 let calculated,review;
 if(options.length){
  const checks=options.map(text=>{const m=text.match(/^A\[(\d+)\]\s*=\s*(-?\d+)$/);if(!m)throw Error('無法核對雜湊陣列選項：'+text);const index=Number(m[1]),expected=Number(m[2]);return {text,index,expected,actual:result.table[index],ok:result.table[index]===expected};});
  calculated=checks.flatMap((c,i)=>c.ok?[String.fromCharCode(65+i)]:[]).join('');
  review='逐項核對：\n'+checks.map(c=>`「${c.text}」：${c.ok?'符合':'不符合'}，A[${c.index}] 最後是 ${c.actual??'空槽'}${c.ok?'。':`，不是 ${c.expected}。`}`).join('\n');
 }else if(/無法藉此公式/.test(stem)){
  calculated=result.failed.slice().sort((a,b)=>a-b).join('/');
  review=`不能插入的鍵由小到大填 ${calculated}。例如步長若為 ${size}，取模後每次都回到同一槽；表內其他位置有空格也無法使用。`;
 }else{
  const indices=[...stem.matchAll(/A\[(\d+)\]\s*=\s*_{3,}/g)].map(m=>Number(m[1]));if(!indices.length)throw Error('找不到陣列填空位置');
  calculated=indices.map(i=>result.table[i]??'空').join('/');review='依題目填空順序讀表：'+indices.map(i=>`A[${i}]=${result.table[i]??'空'}`).join('，')+`，因此依序填 ${calculated}。不要把陣列索引順序與鍵的插入順序混在一起。`;
 }
 const expected=options.length?(answer.match(/[A-H]/g)||[]).join(''):answer.replace(/\s/g,'');
 const difference=calculated!==expected;
 const text=`先畫出 ${size} 格空表，索引從 0 到 ${size-1}。依題目給定的鍵值順序插入，已放入的鍵不能任意搬走。每個新鍵都把 i 重設為 0，再依 ${formula} 計算下一個位置。\n${setup}\n\n逐鍵計算：\n${worked}\n\n完成後的表：\n${result.table.map((v,i)=>`A[${i}]=${v??'空'}`).join('，')}\n\n${review}${difference?`\n\n依上述題面公式計算，結果與目前收錄答案「${answer}」不同。原答案保留；請對照逐鍵探測位置，不能為了符合答案而跳過碰撞或更換係數。`:''}`;
 return {category,explanation:text,calculated,difference,result};
}
