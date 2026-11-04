import test from 'node:test';
import assert from 'node:assert/strict';
import {createPackage,verifyPackage,imageReferences,imageURL} from '../assets/system-backup.mjs';
const origin='https://course-library-submissions-yocheng06.yocheng06.chatgpt.site';
const ref=origin+'/api/image/11111111-1111-4111-8111-111111111111/0-0';
const data=()=>({schemaVersion:1,questions:[{id:'q1',data:{images:[{src:ref}]}}],submissions:[{id:'s1',payload:{questions:[{images:[ref]}]}}],history:[{data:{images:[{src:ref}]}}],builtinQuestions:[],builtinEdits:[],unitSettings:[],unitSettingsHistory:[]});
const png=new Uint8Array([137,80,78,71,13,10,26,10]);
test('owner backup includes each image once, history, unit metadata and verifiable bytes',async()=>{
 const source=data(),before=JSON.stringify(source),requests=[];
 const pack=await createPackage(source,{origin,fetchImage:async(url,options)=>{requests.push({url,options});return new Response(png,{headers:{'content-type':'image/png'}});}});
 assert.equal(requests.length,1);assert.equal(requests[0].options.credentials,'same-origin');assert.equal(pack.resources.length,1);assert.equal(pack.complete,true);assert.equal(JSON.stringify(source),before);
 const report=await verifyPackage(JSON.stringify(pack));assert.equal(report.ok,true);assert.equal(report.images,1);assert.equal(report.history,1);assert(report.plan.length);
});
test('owner backup detects missing images, corruption, changed data and duplicate identifiers',async()=>{
 const pack=await createPackage(data(),{origin,fetchImage:async()=>new Response(png,{headers:{'content-type':'image/png'}})});
 for(const change of [p=>p.resources=[],p=>p.resources[0].base64='AAAA',p=>p.data.questions[0].id='changed',p=>p.resources.push(p.resources[0]),p=>p.data.questions.push(p.data.questions[0])]){
  const bad=structuredClone(pack);change(bad);assert.equal((await verifyPackage(JSON.stringify(bad))).ok,false);
 }
 await assert.rejects(()=>verifyPackage('invalid'),/JSON/);
 const failed=await createPackage(data(),{origin,fetchImage:async()=>new Response('',{status:404})});assert.equal(failed.complete,false);assert.equal(failed.failures.length,1);assert.equal((await verifyPackage(JSON.stringify(failed))).ok,false);
});
test('backup fetching is limited to service images and known static course images',()=>{
 assert.equal(imageReferences(data()).length,1);
 assert.match(imageURL('assets/questions/scheduling/test.png',origin),/^https:\/\/yocheng06.github.io/);
 for(const ref of ['https://evil.test/picture.png','file:///tmp/image.png',origin+'/api/manage/export'])assert.throws(()=>imageURL(ref,origin),/來源/);
});
