import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setupLibraryManager} from '../assets/library-manager.mjs';
import {groupImport,groupImportCounts,groupedImportSummaryText} from '../assets/grouped-submissions.mjs';

test('grouped imports accept conflicting versions and report accepted pending items separately',()=>{
  const q={category:'測試',type:'單選題',stem:'Which example is correct?',options:['Alpha','Beta'],answer:'A',images:[]};
  const groups=groupImport([{...q},{...q,answer:'B'}],{course:'os',unit:'basics',title:'測試題庫'});
  assert.equal(groups[0].payload.questions.length,2);
  const group={...groups[0],payload:{...groups[0].payload,questions:[q,q,q,q]},result:{receivedCount:4,acceptedCount:3,pendingReviewCount:1,skippedCount:1,status:'approved'}};
  assert.deepEqual(groupImportCounts(group),{total:4,added:2,review:1,replaced:0,duplicates:1,pending:0,completed:1});
  assert.match(groupedImportSummaryText([group]),/已新增 2 題 · 待核對 1 題/);
});

test('pending management shows review controls and removes a resolved item from the pending list',async()=>{
  const {window,document}=parseHTML('<section id="libraryWorkspace"></section><dialog id="questionDialog"></dialog>');
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',(o.getAttribute('value')??o.textContent)===v);}});
  globalThis.window=window;globalThis.document=document;globalThis.localStorage={getItem:()=>null,setItem:()=>{}};globalThis.requestAnimationFrame=f=>f();globalThis.confirm=()=>true;window.scrollTo=()=>{};window.courseContributions={apiOrigin:'https://test.invalid'};
  window.HTMLElement.prototype.focus=()=>{};
  const dialog=document.getElementById('questionDialog');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  let resolved=false;const posts=[];
  const row={id:'community-example',source:'community',key:'community:os:community-example',course:'os',unit:'basics',stem:'Example question',type:'填空題',revision:1,pendingReview:true};
  const item=()=>({...row,pendingReview:!resolved,revision:resolved?2:1,question:{stem:row.stem,type:'填空題',category:'測試',options:[],answer:'example',images:[],submissionReview:{status:resolved?'resolved':'pending',reason:'答案不同',references:['basics-1']}}});
  globalThis.fetch=async(url,options)=>{const u=new URL(url);let data;
    if(options.method==='POST'){posts.push(JSON.parse(options.body));resolved=true;data={item:item()};}
    else if(u.pathname==='/api/manage/library')data={items:[row],total:1,counts:{all:1,modified:0,deleted:0,pending:1},units:[]};
    else data={item:item()};
    return new Response(JSON.stringify(data),{status:200});
  };
  const ui=setupLibraryManager();await ui.show('pending');
  assert.match(document.getElementById('libraryRows').textContent,/待核對/);
  document.querySelector('[data-open]').click();
  for(let i=0;i<20&&!document.querySelector('[data-action="resolve"]');i++)await new Promise(r=>setImmediate(r));
  assert.match(dialog.textContent,/合併至選取的既有題目/);
  const form=document.getElementById('managedQuestionForm');Object.defineProperty(form,'elements',{value:{namedItem:name=>form.querySelector(`[name="${name}"]`)}});
  document.querySelector('[data-action="resolve"]').click();
  for(let i=0;i<30&&!document.getElementById('editorStatus')?.textContent.includes('已同步');i++)await new Promise(r=>setImmediate(r));
  assert.equal(posts.length,1);assert.equal(posts[0].action,'resolveReview');assert.equal(posts[0].revision,1);
  assert.equal(document.querySelectorAll('[data-row]').length,0);
  assert.equal(document.querySelector('[data-action="resolve"]'),null);
});
