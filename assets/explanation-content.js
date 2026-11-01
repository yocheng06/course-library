/* Rewrite option references by their content, never by the shuffled positions. */
((root)=>{
 'use strict';
 const bare=value=>String(value??'').replace(/^\s*[A-H][.．、:：)）]\s*/,'').trim();
 function rewrite(question,text=question.explanation??question.ex??''){
  const options=question.options??question.opts??[];
  if(!options.length)return String(text);
  const labels=new Map(options.map((option,i)=>[String(option).trim().match(/^([A-H])[.．、:：)）]/)?.[1]||String.fromCharCode(65+i),bare(option)]));
  const protectedText=[];
  const protect=text=>{protectedText.push(text);return `\uE000${protectedText.length-1}\uE001`;};
  const value=letter=>labels.has(letter)?protect(`「${labels.get(letter)}」`):letter;
  const list='[A-H](?:\\s*(?:[、,，/／＋+&]|與|及|和|and)\\s*[A-H])*';
  const expand=letters=>letters.replace(/[A-H]/g,value);
  const variables=new Set([...String(text).matchAll(/(?:陣列|原始資料在|輸出|輸入|行程|程序|執行|可執行)\s*([A-H])(?![A-Za-z])|\b([A-H])(?=[\[＝=])|\b([A-H])(?=[（(](?:剩餘|優先權|\d+\s*[–-]))/g)].map(m=>m[1]||m[2]||m[3]));
  for(const match of String(text).matchAll(/(?:讀|寫|回填|掃描|放入|遞減|計數表|位置表|億格)\s*([A-H])(?![A-Za-z])/g))variables.add(match[1]);
  if(/計數排序|counting.sort/i.test(String(question.category??'')+' '+text)&&/計數|累積|回填/.test(text)&&/(?<![A-Za-z0-9_])C(?![A-Za-z0-9_])/.test(text))variables.add('C');
  const prose=letters=>[...letters.matchAll(/[A-H]/g)].some(m=>variables.has(m[0]))?letters:expand(letters);
  let result=String(text).replace(/「[^」]*」|`[^`]*`/g,token=>/^「[A-H]」$/.test(token)&&!variables.has(token[1])?value(token[1]):protect(token));
  result=result.replace(/((?:本題)?答案[：:]\s*)[A-H][.．]\s*/g,'$1');
  // These are explicit answer/option references, not variable names in formulas.
  result=result.replace(new RegExp(`((?:本題|來源|老師|原題庫|題庫)?(?:標準)?答案(?:依序)?(?:為|是|選|[:：])?\\s*|(?:故|因此|所以)?選(?:擇)?\\s*|選項\\s*)(${list})(?![A-Za-z0-9_])`,'g'),(whole,prefix,letters,offset,source)=>{
   if(prefix.includes('\n')||/^[\[＝=]/.test(source.slice(offset+whole.length))||/依規則\s*$/.test(source.slice(0,offset))||/所以開始執行/.test(source.slice(offset+whole.length,offset+whole.length+14)))return whole;
   return prefix+expand(letters);
  });
  result=result.replace(/(^|\n)([A-H])[．.、:：]\s*([^\n]*)/g,(whole,prefix,letter,line)=>variables.has(letter)&&!line.startsWith(labels.get(letter)||'\u0000')?whole:prefix+line);
  result=result.replace(new RegExp(`(?<![A-Za-z0-9_])([A-H])\\s*[–—~～-]\\s*([A-H])(?![A-Za-z0-9_])(?=\\s*(?:皆|均|都|全|四|三|兩))`,'g'),(whole,a,b)=>{
   if(a>b||![a,b].every(x=>labels.has(x))||variables.has(a)||variables.has(b))return whole;
   return Array.from({length:b.charCodeAt(0)-a.charCodeAt(0)+1},(_,i)=>value(String.fromCharCode(a.charCodeAt(0)+i))).join('、');
  });
  result=result.replace(new RegExp(`(?<![A-Za-z0-9_])(${list})(?![A-Za-z0-9_])(?=\\s*(?:正確|錯誤|不選|可選|成立|不成立|若指|若是|說|錯在|描述|屬|不是|是這|是反向|的(?:「|『|\\s*[\\u3400-\\u9fff])))`,'g'),(whole,letters,offset,source)=>{
   const before=source.slice(Math.max(0,offset-18),offset);
   if(/(?:陣列|程序|行程|工作|節點|變數|process|array)\s*$/i.test(before))return whole;
   return prose(letters);
  });
  // A prose list such as "A、B" refers to options only when the context says so.
  result=result.replace(new RegExp(`(?<![A-Za-z0-9_])(${list})(?![A-Za-z0-9_])(?=\\s*(?:均|皆|都|兩者|三者|四者|屬於|是本|是軟|屬程))`,'g'),(_,letters)=>expand(letters));
  for(const [letter,content]of labels){
   const escaped=content.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(escaped)result=result.replace(new RegExp(`(?<![A-Za-z0-9_])${letter}\\s+(?=${escaped})`,'g'),'');
   if(escaped)result=result.replace(new RegExp(`(?<![A-Za-z0-9_])${letter}[（(]${escaped}[）)]`,'g'),()=>value(letter));
  }
  const languageC=options.some(o=>bare(o)==='C')&&/語言|language/i.test(String(question.stem??question.q??''));
  result=result.replace(new RegExp(`(^|[。；，\\n：])\\s*(${list})(?![A-Za-z0-9_])(?=\\s*(?:是|為|不|若|說|錯|應|也|指|描述|屬|原文|\\s+[\\u3400-\\u9fff]))`,'g'),(whole,prefix,letters)=>{
   if(languageC&&letters==='C')return whole;
   return prefix+prose(letters);
  });
  result=result.replace(new RegExp(`((?:只有|排除|除了|不能排除|不能只選|例如選項|對應選項|選到|選了)\\s*)(${list})(?![A-Za-z0-9_])`,'g'),(_,prefix,letters)=>prefix+expand(letters));
  result=result.replace(new RegExp(`((?:答案保留為|題庫提供|本題保留|因此)\\s*)(${list})(?![A-Za-z0-9_])`,'g'),(_,prefix,letters)=>prefix+expand(letters));
  result=result.replace(new RegExp(`(?<![A-Za-z0-9_])([A-H])(?=[『\\uE000])`,'g'),(_,letter)=>value(letter));
  result=result.replace(new RegExp(`(^|[。；，\\n：])\\s*([A-H])\\s+(?=[A-Za-z][A-Za-z -]{1,40}(?:是|用來|較像|屬於|不是|不保證|would|is|are))`,'g'),(whole,prefix,letter)=>variables.has(letter)?whole:prefix+value(letter)+' ');
  result=result.replace(new RegExp(`((?:符合|對應|得到|推得|來源選|題庫列|題庫以|指定的|來源|所以)\\s*)(${list})(?![A-Za-z0-9_\\[＝=])`,'g'),(_,prefix,letters)=>prefix+expand(letters));
  result=result.replace(new RegExp(`(?<![A-Za-z0-9_])([A-H])(?=\\s*(?:合理描述|會使|會讓|通常打斷|可能出現|當作|對應本題|所列條件|也是 Windows|提到的))`,'g'),(_,letter)=>prose(letter));
  result=result.replace(/(?<![A-Za-z0-9_])([A-H])(?![A-Za-z0-9_])/g,(whole,letter,offset,source)=>{
   const after=source.slice(offset+1),before=source.slice(Math.max(0,offset-12),offset);
   if(variables.has(letter)||languageC&&letter==='C'||/^[\[=(（＝ᵢⱼ]/.test(after)||letter==='C'&&/^\s*(?:\/C\+\+|\+\+|函式庫|程式語言|語言)/.test(after)||/(?:陣列|程序|行程|工作|節點|變數|array|process)\s*$/i.test(before))return whole;
   return value(letter);
  });
  return result.replace(/\uE000(\d+)\uE001/g,(_,i)=>protectedText[Number(i)]);
 }
 const identity=q=>JSON.stringify([String(q.type??''),String(q.stem??q.q??''),q.options??q.opts??[],String(q.answer??q.a??''),q.images??[]]);
 let reviewed;
 function text(q){
  const source=String(q.explanation??q.ex??'');
  if(reviewed===undefined){try{reviewed=typeof document==='object'?JSON.parse(document.getElementById('course-content-explanations')?.textContent||'null'):null;}catch{reviewed=null;}}
  const versions=reviewed?.questions?.[q.id??q.bookmarkId]?.versions;
  const record=versions?.find(v=>v.identity===identity(q)&&[v.sourceExplanation,v.explanation].includes(source));
  return record?.explanation??source;
 }
 function apply(q){
  const explanation=text(q);if(explanation===String(q.explanation??q.ex??''))return q;
  return {...q,...(Object.hasOwn(q,'ex')||Object.hasOwn(q,'a')?{ex:explanation}:{}),...(Object.hasOwn(q,'explanation')||Object.hasOwn(q,'answer')?{explanation}:{} )};
 }
 root.courseExplanationContent={rewrite,bare,identity,text,apply};
})(typeof window==='object'?window:globalThis);
