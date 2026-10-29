import {readFile,writeFile} from 'node:fs/promises';
import {expandLibraryQuestion} from '../contribution-service/worker/batch-model.js';
import {duplicateStemKey} from '../assets/contribution-model.js';
const publicFile=process.argv[2];
if(!publicFile)throw new Error('Pass a downloaded public /api/questions?course=os response as the argument.');
const live=JSON.parse(await readFile(publicFile,'utf8'));
const bases=JSON.parse(await readFile(new URL('../contribution-service/builtin-questions.json',import.meta.url),'utf8'));
const groups=new Map();
function add(course,unit,q,source){for(const entry of expandLibraryQuestion(course,unit,q)){if(entry.options.length)continue;const key=course+'|'+unit+'|'+duplicateStemKey(entry.stem,true);if(!groups.has(key))groups.set(key,new Map());groups.get(key).set(entry.id,{id:entry.id,course,unit,source,stem:q.stem,translation:q.translation||'',answer:q.answer,hasExplanation:Boolean(q.explanation?.trim())});}}
for(const base of bases){if(base.course!=='os')continue;const override=live.overrides?.find(x=>x.question?.id===base.id);if(override?.deleted)continue;add(base.course,override?.unit||base.unit,override?.question||base.question,'內建題庫');}
for(const row of live.questions||[])add('os',row.unit,row.question,'投稿題庫');
const unique=new Map();for(const group of groups.values()){if(group.size<2)continue;const items=[...group.values()];unique.set(items.map(q=>q.id).sort().join('|'),items);}
const report={generatedAt:new Date().toISOString(),scope:'OS fill questions; normalized exact stems only; candidates require manual review',groups:[...unique.values()]};
await writeFile(new URL('../docs/import-duplicate-report-20261029.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const md=['# 匯入重複候選清單','',`共 ${report.groups.length} 組填空題候選。依中文、英文與原題版本精確比對，僅列清單，尚未下架或合併。題目 ID 與網站卡片題號不同。`,''];
report.groups.forEach((items,i)=>{md.push(`## ${i+1}. ${items[0].unit}`,'');for(const q of items)md.push(`- ${q.source} · ${q.id} · 答案：${q.answer} · ${q.hasExplanation?'有解析':'無解析'}`,`  ${q.stem}`);md.push('');});
await writeFile(new URL('../docs/import-duplicate-report-20261029.md',import.meta.url),md.join('\n'));
console.log(`Listed ${report.groups.length} duplicate candidate groups; no live data changed.`);
