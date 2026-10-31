import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(p,'utf8');
const curation=JSON.parse(await read('assets/os-treasure-curation.json'));
const context={window:{}};vm.runInNewContext(await read('assets/scheduling-walkthrough.js'),context);
const css=await read('assets/scheduling-walkthrough.css'),theme=await read('assets/theme.css');
const q=curation.questions['community-70c0705f-a1d7-4e2e-b00f-a94d9b435d25-4'];
const escape=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
for(const dark of [false,true])await writeFile(`../treasure-preview-${dark?'dark':'light'}.html`,`<!doctype html><html lang="zh-Hant"${dark?' data-theme="dark"':''}><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>挖寶單元解析預覽</title><style>body{margin:0;background:#edf2f7;color:#29394e;font:18px/1.7 "Microsoft JhengHei",sans-serif}main{max-width:1000px;margin:auto;padding:20px;min-width:0}h1{font-size:26px}p{margin:12px 0}*{box-sizing:border-box}${theme}${css}</style><main><h1>SRTF：平均等待時間怎麼算？</h1><p>不是只背 3.4 ms，而是看每個行程何時進來、何時離開。</p>${context.window.courseSchedulingWalkthrough.markup(q.workedSolution)}<div class="worked-explanation">${q.explanation.split(/\n\s*\n/).map(t=>'<p>'+escape(t)+'</p>').join('')}</div></main></html>`);
