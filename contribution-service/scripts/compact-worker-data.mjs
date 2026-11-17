import assert from 'node:assert/strict';
// Intern repeated strings in large generated catalogs. This is lossless and
// synchronous: no extra network request, decompression or runtime dependency.
export function compactWorkerData(source){
  const names=['DUPLICATE_CATALOG','BUILTIN_QUESTIONS'],strings=[],ids=new Map(),replacements=[];
  function intern(text){if(!ids.has(text)){ids.set(text,strings.length);strings.push(text);}return ids.get(text);}
  function encode(value){
    if(typeof value==='string')return intern(value);
    if(typeof value==='number')return ['n',value];
    if(value===null||typeof value==='boolean')return value;
    if(Array.isArray(value))return ['a',...value.map(encode)];
    return ['o',...Object.entries(value).flatMap(([key,item])=>[intern(key),encode(item)])];
  }
  function decode(value){
    if(typeof value==='number')return strings[value];
    if(value===null||typeof value==='boolean')return value;
    if(value[0]==='n')return value[1];
    if(value[0]==='a')return value.slice(1).map(decode);
    const entries=[];for(let i=1;i<value.length;i+=2)entries.push([strings[value[i]],decode(value[i+1])]);return Object.fromEntries(entries);
  }
  for(const name of names){
    const match=new RegExp('const '+name+'\\s*=\\s*').exec(source);
    if(!match)throw Error('Missing generated catalog '+name);
    const start=match.index+match[0].length;let end=start,depth=0,quoted=false,escaped=false;
    for(;end<source.length;end++){
      const char=source[end];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"')quoted=true;
      else if(char==='['||char==='{')depth++;
      else if(char===']'||char==='}'){depth--;if(!depth){end++;break;}}
    }
    const original=JSON.parse(source.slice(start,end)),encoded=encode(original);
    assert.deepEqual(decode(encoded),original,'Catalog compaction changed '+name);
    replacements.push({start,end,value:'decodeCatalog('+JSON.stringify(encoded)+')'});
  }
  for(const replacement of replacements.sort((a,b)=>b.start-a.start))source=source.slice(0,replacement.start)+replacement.value+source.slice(replacement.end);
  const decoder=`const catalogStrings=${JSON.stringify(strings)};
function decodeCatalog(value){
  if(typeof value==='number')return catalogStrings[value];
  if(value===null||typeof value==='boolean')return value;
  if(value[0]==='n')return value[1];
  if(value[0]==='a')return value.slice(1).map(decodeCatalog);
  const pairs=[];for(let i=1;i<value.length;i+=2)pairs.push([catalogStrings[value[i]],decodeCatalog(value[i+1])]);return Object.fromEntries(pairs);
}
`;
  return decoder+source;
}
