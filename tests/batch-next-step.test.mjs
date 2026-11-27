import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {resultNextStep} from '../assets/batch-next-step.mjs';

const row=(reason='',options=[],references=[])=>({status:'unmatched',answer:'',question:{options},reason,references});
test('guidance separates missing versions, option differences, and fill format without changing results',()=>{
 const missing=row();assert.equal(resultNextStep(missing).action,'draft');
 assert.equal(resultNextStep(missing,{unit:'L9'}).action,'expand');
 assert.equal(resultNextStep(missing,{otherCourse:true}).action,'switch');
 const choices=row('題幹符合，但選項不同；請核對是否抄漏或為不同版本。',[{label:'A',text:'example'}],[{id:'candidate'}]);
 const before=JSON.stringify(choices);assert.equal(resultNextStep(choices).kind,'options');assert.equal(resultNextStep(choices).action,'compare');assert.equal(JSON.stringify(choices),before);
 assert.equal(resultNextStep(row('題庫答案的填答格式、版本或選項對應不一致，請開啟原題核對。',[],[{id:'candidate'}])).kind,'fill');
 assert.equal(resultNextStep(row('找到相似題，但文字或條件不同，未直接套用答案。',[],[{id:'candidate'}])).kind,'version');
 assert.equal(resultNextStep({...missing,status:'matched'}),null);
});
test('incomplete synchronization takes precedence over a missing candidate',()=>{
 assert.equal(resultNextStep(row(),{coverage:false}).action,'retry');
 assert.equal(resultNextStep(row('選項不同',[{}],[{}]),{coverage:false}).kind,'sync');
 assert.equal(resultNextStep(row('題庫端題圖尚未讀取成功。')).action,'retry');
 assert.equal(resultNextStep(row('此題需要題圖或完整上下文')).action,'images');
});
test('format details start collapsed and navigation goes directly to the current service',async()=>{
 const {document}=parseHTML(await readFile(new URL('../batch.html',import.meta.url),'utf8'));
 const limits=document.getElementById('importLimits');assert(limits);assert(!limits.hasAttribute('open'));
 assert.equal(limits.querySelector('summary').textContent,'支援格式與限制');assert.match(limits.textContent,/20 MB/);
 assert(!document.getElementById('importHelp').textContent.includes('Markdown'));
 for(const path of ['../submit.html','../contribution-service/frontend/submit.html','../contribution-service/frontend/review.html']){
   const doc=parseHTML(await readFile(new URL(path,import.meta.url),'utf8')).document;
   const links=[...doc.querySelectorAll('.contribution-nav a')];assert(links.length);
   assert(links.every(link=>!link.getAttribute('href').includes('yocheng06.github.io')));
 }
});
