import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setupSystemPanel} from '../assets/system-backup.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const payload={schemaVersion:1,questions:[],submissions:[],history:[],builtinQuestions:[],builtinEdits:[],unitSettings:[],unitSettingsHistory:[]};
function fixture({unavailable=false}={}){
 const {window,document}=parseHTML('<html><body><section id="system"></section></body></html>');
 globalThis.window=window;globalThis.document=document;window.courseContributions={apiOrigin:'https://example.test'};
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 globalThis.fetch=async()=>{if(unavailable)throw Error('offline');return new Response(JSON.stringify({version:'test-v2'}),{headers:{'content-type':'application/json'}});};
 const downloads=[],container=document.getElementById('system');
 const api=async path=>path==='/api/manage/export'?structuredClone(payload):{build:{version:'test-v1',sourceHash:'abcdef',builtAt:'2026-11-04'},checkedAt:'2026-11-04',snapshots:{os:{generatedAt:'2026-11-01'},algorithms:{generatedAt:'2026-11-02'}},api:{os:'os-revision',algorithms:'alg-revision'}};
 const panel=setupSystemPanel({container,api,downloadJSON:(data,name)=>downloads.push({data,name})});
 return {window,container,panel,storage,downloads};
}
test('system panel reports mismatch and unavailable main site without falsely claiming full connectivity',async()=>{
 const h=fixture();await h.panel.show();assert.match(h.container.textContent,/版本不同/);assert.match(h.container.textContent,/os-revision/);
 const offline=fixture({unavailable:true});await offline.panel.show();assert.match(offline.container.querySelector('[data-system-status]').textContent,/檢查未完整/);
});
test('system backup action creates a verified download and records creation only after validation',async()=>{
 const h=fixture();h.container.querySelector('[data-system-export]').dispatchEvent(new h.window.Event('click',{bubbles:true}));
 for(let i=0;i<30&&!h.downloads.length;i++)await tick();
 assert.equal(h.downloads.length,1);assert(h.downloads[0].data.complete);assert.match(h.container.textContent,/通過校驗/);assert.equal(h.storage.size,1);
});
