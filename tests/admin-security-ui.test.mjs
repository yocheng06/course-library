import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {setupAdminSecurity} from '../assets/admin-security.mjs';
function inputs(form,values){const fields={};for(const [name,value] of Object.entries(values))fields[name]={value};Object.defineProperty(form,'elements',{value:fields,configurable:true});form.reset=()=>{for(const input of Object.values(fields))input.value='';};}
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
async function page(api){const {document,window}=parseHTML('<html><body><button id="exportBackup"></button><section id="security"></section></body></html>');globalThis.document=document;const container=document.getElementById('security');const downloads=[];const panel=setupAdminSecurity({container,api,message:()=>{},downloadJSON:(value,name)=>downloads.push({value,name})});await panel.show();return {document,window,container,panel,downloads};}
function submit(window,form,action){const event=new window.Event('submit',{cancelable:true});Object.defineProperty(event,'submitter',{value:{value:action}});form.dispatchEvent(event);}
test('security panel does not request or display a secret before explicit password submission and clears late enrollment responses',async()=>{
 let release,calls=[];const p=await page(async(path,opts)=>{calls.push({path,opts});if(path.endsWith('/enroll'))return new Promise(resolve=>{release=resolve;});return {enabled:false,sessionHours:8,recoveryRemaining:0};});
 assert.equal(calls.length,1);assert(p.container.querySelector('[data-enrollment]').hidden);assert.equal(p.container.querySelector('[data-secret]').value,'');
 const form=p.container.querySelector('[data-security-form]');inputs(form,{password:'test-password'});submit(p.window,form,'enroll');await flush();p.panel.clear();release({secret:'PRIVATE-TEST-SECRET'});await flush();assert.equal(p.container.childElementCount,0);assert.equal(p.downloads.length,0);
});
test('recovery download contains actual codes with a JSON filename, while leaving security clears sensitive content',async()=>{
 const codes=['ABCD-1234-ABCD-1234-ABCD-1234-ABCD-1234'];let enabled=false;
 const p=await page(async path=>{if(path.endsWith('/confirm')){enabled=true;return {recoveryCodes:codes};}if(path.endsWith('/enroll'))return {secret:'TESTSETUPKEY'};return {enabled,sessionHours:8,recoveryRemaining:enabled?8:0};});
 const form=p.container.querySelector('[data-security-form]');inputs(form,{password:'test-password'});submit(p.window,form,'enroll');await flush();assert.equal(p.container.querySelector('[data-secret]').value,'TESTSETUPKEY');
 const confirm=p.container.querySelector('[data-confirm]');inputs(confirm,{code:'123456'});submit(p.window,confirm);await flush();assert.equal(p.container.querySelector('[data-secret]').value,'');assert.equal(p.container.querySelector('[data-codes]').textContent,codes[0]);
 p.container.querySelector('[data-download]').click();assert.deepEqual(p.downloads[0].value.codes,codes);assert.match(p.downloads[0].name,/\.json$/);
 p.container.querySelector('[data-saved]').click();await flush();assert(!p.container.textContent.includes(codes[0]));assert(p.container.querySelector('[data-recovery]').hidden);p.panel.clear();
});
