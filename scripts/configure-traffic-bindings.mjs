import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const trafficBindings=[
 {name:'LIBRARY_READ_LIMITER',namespace_id:'9006101',simple:{limit:60,period:60}},
 {name:'LIBRARY_RESOURCE_LIMITER',namespace_id:'9006102',simple:{limit:600,period:60}},
 {name:'LIBRARY_NETWORK_LIMITER',namespace_id:'9006103',simple:{limit:6000,period:60}}
];
export function configureTrafficBindings(config){
 const result=structuredClone(config);result.ratelimits??=[];
 for(const binding of trafficBindings){
  const existing=result.ratelimits.find(row=>row.name===binding.name);
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(binding))throw Error('流量限制已有自訂設定，請先核對：'+binding.name);continue;}
  if(result.ratelimits.some(row=>row.namespace_id===binding.namespace_id))throw Error('限制計數空間已使用，請選擇不同編號');
  result.ratelimits.push(structuredClone(binding));
 }
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw Error('請指定部署設定檔；不會自動覆寫正式設定');
 const config=JSON.parse(await readFile(file,'utf8'));
 await writeFile(file,JSON.stringify(configureTrafficBindings(config),null,2)+'\n');
 console.log('已保留原資料庫、密鑰設定及排程，加入三個讀取限制綁定。');
}
