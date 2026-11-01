import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {parseHTML} from 'linkedom';
import {improve} from '../scripts/explanation-improvements-20261101.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const corpus=JSON.parse(await read('content/current-explanation-audit-20261101.json')),source=await read('assets/explanation-content.js');
const tools={};vm.runInNewContext(source,tools);const rewrite=tools.courseExplanationContent.rewrite;
function load(course){const {document,window}=parseHTML(htmls[course]);vm.runInNewContext(source,{document,window});return {document,window,api:window.courseExplanationContent};}
const htmls={os:await read('os.html'),algorithms:await read('algorithms.html')};
test('all 1427 currently visible questions retain their original source content and all blank explanations are filled',()=>{
 assert.equal(corpus.length,1427);let blanks=0,improved=0;
 for(const course of ['os','algorithms']){
  const {api}=load(course);for(const q of corpus.filter(q=>q.course===course)){
   const before=JSON.stringify(q),next=api.apply(q);assert.equal(JSON.stringify(q),before);
   for(const k of ['stem','q','answer','a','options','opts','type','images'])assert.deepEqual(next[k],q[k]);
   assert(api.text(q).trim(),q.id);if(!(q.explanation??q.ex??'').trim())blanks++;if(improve(q))improved++;
  }
 }
 assert.equal(blanks,73);assert(improved>=147);
});
test('reviewed explanations are exact-version bound; later user edits remain authoritative',()=>{
 const {api}=load('os'),q=corpus.find(q=>q.id==='basics-32');assert.match(api.text(q),/O\(lg n\)/);assert.doesNotMatch(api.text(q),/選 D/);
 for(const change of [{explanation:'我剛剛新增的解析'},{stem:q.stem+' 改版'},{answer:'A'},{options:[...q.options].reverse()}]){const next={...q,...change};assert.equal(api.text(next),next.explanation);}
 assert.equal(api.text(api.apply(q)),api.text(q));
});
test('editing an imported raw API version uses the same explanation as the visible curated version',async()=>{
 const live=JSON.parse(await read('content/algorithms-public-explanation-audit-20261101.json'));
 const raw=live.overrides.find(row=>row.question.bookmarkId==='L7-2479').question;
 const current=corpus.find(q=>q.id==='L7-2479'),{api}=load('algorithms');
 assert.equal(api.text(raw),api.text(current));assert(api.text(raw).includes('唯一元素'));
});
test('rewritten option prose uses content while algorithm arrays, process names, code and language names survive',()=>{
 const {api}=load('algorithms');const by=id=>corpus.find(q=>q.id===id);
 const counted=api.text(by('L6-014'));assert.match(counted,/C\[0\.\.2\]＝\[1,1,2\]/);assert.match(counted,/原始資料在 A；C 不會把 A/);
 assert.match(api.text(by('L6-064')),/例：A 中兩個 2/);assert.doesNotMatch(api.text(by('L6-064')),/例：「線性時間/);
 const choice=api.text(by('L7-2497'));assert.doesNotMatch(choice,/(?:答案|選項|不能把)\s*[A-D]/);assert.match(choice,/pivot 總選擇到最大值或最小值/);
 const os=load('os').api;const scheduled=corpus.find(q=>q.id==='community-31668494-b954-40b4-b0ee-614fffc0d46c-6');const text=os.text(scheduled);
 assert.match(text,/依規則選 A，所以開始執行 A/);assert.match(text,/A（0–2） → C（2–4）/);
 const programming=corpus.find(q=>q.id==='architecture-97');assert.match(os.text(programming),/^C 能/);
});
test('content corrections give genuine counterexamples rather than justifying inconsistent teacher answers',()=>{
 assert(Math.exp(1)>1+1+1/2);assert.equal(Math.log(1+0),0);
 const {api}=load('algorithms');const q=corpus.find(q=>q.id==='L2-026');assert.match(api.text(q),/2\.718/);assert.match(api.text(q),/老師答案保留/);assert.equal(api.apply(q).a,q.a);
 const os=load('os').api;const pcb=corpus.find(q=>q.id==='process-8');assert.match(os.text(pcb),/stack/);assert.equal(os.apply(pcb).answer,'PCB');
 const bad=corpus.find(q=>q.id==='community-894e9ae8-f063-45d2-b28c-ebf47695aef1-1');assert.doesNotMatch(os.text(bad),/IDK|杰那邊/);assert.match(os.text(bad),/絕對截止/);
});
test('review metadata and inline JSON agree, escapes are safe, and later rendering never runs a broad replacement on unknown edits',async()=>{
 for(const course of ['os','algorithms']){
  const {document}=load(course),inline=JSON.parse(document.getElementById('course-content-explanations').textContent);
  assert.deepEqual(inline,JSON.parse(await read(`assets/${course}-content-explanations.json`)));
 }
 const {api}=load('os'),unknown={id:'new-question',options:['A. A[x]','B. B[y]'],answer:'A',explanation:'A[x] 與 B[y] 是使用者新寫的公式'};
 assert.strictEqual(api.apply(unknown),unknown);assert.equal(api.text(unknown),unknown.explanation);
 const text=rewrite({options:['A. <script>alert(1)</script>','B. 另一項']},'答案 A。');assert(text.includes('<script>'));
});
