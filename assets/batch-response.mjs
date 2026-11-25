export const responseKey = q => JSON.stringify([q.number,q.stem,q.options]);
const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ');
function parts(answer,count) {
  if(count===1) return [answer];
  for(const separator of ['\n','/']) {
    const result=[]; let depth=0,start=0;
    for(let i=0;i<answer.length;i++) {
      if('([{'.includes(answer[i])) depth++;
      if(')]}'.includes(answer[i])) depth--;
      if(depth===0 && answer[i]===separator){result.push(answer.slice(start,i).trim());start=i+1;}
    }
    result.push(answer.slice(start).trim());
    if(result.length===count && result.every(Boolean))return result;
  }
  return null;
}
export function checkResponse(row,response) {
  if(!response)return {status:'unknown',label:'沒有保存作答資料',slots:[]};
  const values=response.values || [];
  const blank=values.some(v=>!clean(v)) || !values.length;
  if(row.status!=='matched')return {status:'unknown',label:'無法確認',slots:[]};
  if(response.kind==='choice') {
    if(!row.choiceKey)return {status:'unknown',label:'無法確認',slots:[]};
    const same=JSON.stringify([...new Set(values)].sort())===JSON.stringify([...row.choiceKey].sort());
    return {status:blank?'unanswered':same?'same':'different',label:blank?'未作答':same?'符合':'不同',slots:[]};
  }
  const expected=parts(row.answer,values.length);
  if(!expected)return {status:'unknown',label:'答案分格需人工核對',slots:[]};
  const slots=expected.map((answer,i)=>({answer,value:values[i],same:clean(answer)===clean(values[i])}));
  const same=slots.every(slot=>slot.same);
  return {status:blank?'unanswered':same?'same':'different',label:blank?'未填完整':same?'符合':'文字不同，請核對',slots};
}
