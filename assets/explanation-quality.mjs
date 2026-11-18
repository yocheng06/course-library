// These are review hints, not a judgment of the supplied answer or an automatic rewrite.
const plain = value => String(value ?? '').normalize('NFKC').replace(/<[^>]*>/g,'').replace(/[*`]/g,'').trim();
const compact = value => plain(value).toLowerCase().replace(/[\s。.!！:：;；、，,]/g,'');
const stripAnswerLabel = value => plain(value).replace(/^(?:正確答案|題庫答案|投稿答案|答案|answer)(?:\s*(?:為|是|is))?\s*[:：]?\s*/i,'').trim();
export const EXPLANATION_ISSUES = ['缺解析','只寫答案','使用選項代號'];
export function inspectExplanation(question, explanation = question.explanation ?? question.ex ?? '') {
  const text=plain(explanation),issues=[];
  const placeholder=/^(?:(?:原始)?題庫)?(?:尚未|未|沒有)(?:提供|補上)?(?:本題)?(?:詳細)?解析(?:[，,。.!！\s]*(?:之後|日後|稍後)(?:可|再|會|直接)*(?:補充|補上|新增))?[。.!！\s]*$/;
  if(!text||placeholder.test(text)||/^(?:暫無解析|尚無解析|解析待補|待補解析)[。.!！]?$/.test(text))return {issues:['缺解析'],text};
  const options=question.options??question.opts??[],answer=String(question.answer??question.a??'');
  const parser=globalThis.courseChoiceAnswers||globalThis.window?.courseChoiceAnswers;
  const key=options.length?parser?.expectedChoiceKey(answer,options):null;
  const optionText=value=>String(value??'').replace(/^\s*[A-H][.．、:：)）]\s*/i,'');
  const expected=[answer,...(key?[...key].map(letter=>optionText(options[letter.charCodeAt(0)-65])):[])];
  const body=stripAnswerLabel(text),onlyKeys=/^[A-H](?:\s*[、，,\/及與和&+]\s*[A-H])*[。.!！]?$/i.test(body);
  const selected=key?[...key].map(letter=>optionText(options[letter.charCodeAt(0)-65])).join('；'):'';
  if((options.length&&onlyKeys)||expected.some(value=>compact(value)&&compact(body)===compact(value))||(selected&&compact(body)===compact(selected)))issues.push('只寫答案');
  if(options.length){
    const reference=/(?:選項|選|答案(?:是|為|[:：])?|options?|choices?|answer(?:\s+is)?)[\s（(「『]*([A-H])(?=[^A-Za-z0-9_]|$)|(?:^|[^A-Za-z0-9_])([A-H])(?=\s*(?:[、，,/&+]\s*[A-H](?![A-Za-z0-9_])|(?:是|為|代表|正確|錯誤|不選|可選|不可選|不符合|符合|錯在|對應|屬於|不能|可以|表示|與|和)|\b(?:is|are|means|because|refers|would|should|cannot|can)\b))|^\s*([A-H])[.、:：)）]\s*/gim;
    if(onlyKeys||[...text.matchAll(reference)].some(match=>{const letter=match[1]||match[2]||match[3];return letter.toUpperCase().charCodeAt(0)-65<options.length;}))issues.push('使用選項代號');
  }
  return {issues,text};
}
