import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readBatchFiles, prepareImport, parseBatchInput} from '../assets/batch-import.mjs';
import {imageDigest, fingerprintLibraryImages, resolveQuestionImages, inheritQuestionImages} from '../assets/batch-images.mjs';
import {buildIndex, expandLibraryQuestion, matchRecordedQuestions} from '../assets/batch-model.mjs';

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3sAAAAASUVORK5CYII=';
const data='data:image/png;base64,'+png;
const bytes=Buffer.from(png,'base64');
const document=parseHTML('<html><body></body></html>').document;
const file=(name,body=bytes)=>({name,size:body.length,arrayBuffer:async()=>Uint8Array.from(body).buffer});
const stem='依題圖的數據，正確結果為？';
const html=(src='quiz_files/chart.png')=>`<script>const questions=[];</script><form id="challenge-quiz-form"><div class="question-block group-block"><div class="group-stem"><img src="${src}"></div><div class="sub-question-block"><p class="question-text">1. ${stem}</p><label><input type="radio" value="X">A. 10</label><label><input type="radio" value="Y">B. 20</label></div></div></form>`;
async function imported(images,src){return readBatchFiles([file('quiz.html',Buffer.from(html(src)))],{document,imageFiles:images});}
async function bank(changes={}){const q={id:'image-q',type:'單選題',stem,options:['20','10'],answer:'B',images:[{src:data}],...changes};const envelope=await fingerprintLibraryImages({questions:[{question:q}]});return buildIndex(expandLibraryQuestion('os','treasure',envelope.questions[0].question));}
const lookup=(qs,index)=>matchRecordedQuestions(qs,index,{course:'os',unit:'treasure'});

test('SHA-256 uses exact bytes and image identity survives an HTML filename change',async()=>{
  assert.equal(await imageDigest(new TextEncoder().encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const a=await imported([file('chart.png')]);const b=await imported([file('renamed.png')],'other/renamed.png');
  assert.deepEqual(a.questions[0].imageHashes,b.questions[0].imageHashes);
  const row=lookup(a.questions,await bank())[0];assert.equal(row.status,'matched');assert.equal(row.choiceKey,'A');
});
test('same filenames with different bytes, missing files, and changed options or text cannot inherit answers',async()=>{
  const index=await bank();
  const changed=await imported([file('chart.png',Buffer.concat([bytes,Buffer.from([1])]))]);
  assert.equal(lookup(changed.questions,index)[0].status,'unmatched');
  const missing=await imported([]);assert.equal(lookup(missing.questions,index)[0].status,'unmatched');
  const good=(await imported([file('chart.png')])).questions[0];
  assert.equal(lookup([{...good,stem:good.stem+'數據有變'}],index)[0].status,'unmatched');
  assert.equal(lookup([{...good,options:[{label:'A',text:'30'},{label:'B',text:'20'}]}],index)[0].status,'unmatched');
});
test('all figures are required and ambiguous filenames do not select a random file',async()=>{
  const q=(await imported([])).questions[0];
  const duplicate=[{...file('chart.png'),webkitRelativePath:'one/chart.png'},{...file('chart.png'),webkitRelativePath:'two/chart.png'}];
  assert.equal((await resolveQuestionImages([q],duplicate))[0].imageHashes,undefined);
  const two={...q,stem:q.stem+' [題圖未轉錄]',imageSources:[...q.imageSources,'other.png']};
  assert.equal((await resolveQuestionImages([two],[file('chart.png')]))[0].imageHashes,undefined);
});
test('image attachment survives append numbering and saved-draft reload but cannot attach to edited text',async()=>{
  const batch=await imported([file('chart.png')]);
  const result=prepareImport('1. 另一題？',batch.questions,'append',{document});
  const stored=JSON.parse(JSON.stringify(result.questions));
  const restored=inheritQuestionImages(parseBatchInput(result.text,{document}).questions,stored);
  assert.equal(restored[1].number,'2');assert.equal(lookup(restored,await bank())[1].status,'matched');
  const pasted=prepareImport(result.text,parseBatchInput(result.text,{document}).questions,'replace',{document,imageQuestions:stored});
  assert.deepEqual(pasted.questions[1].imageHashes,stored[1].imageHashes);
  const newer={...restored[1],imageHashes:['b'.repeat(64)]};assert.equal(inheritQuestionImages([newer],stored)[0].imageHashes[0],'b'.repeat(64));
  const edited=parseBatchInput(result.text.replace('正確結果','其他結果'),{document}).questions;
  assert.equal(inheritQuestionImages(edited,stored)[1].imageHashes,undefined);
});
test('image hashes do not erase unreadable text or missing bank context',async()=>{
  const q=(await imported([file('chart.png')])).questions[0];
  const unclear={...q,stem:q.stem+' [看不清楚：數字]',issues:['題目含未提供的圖片或無法辨識的文字。']};
  assert.equal(lookup([unclear],await bank())[0].status,'unmatched');
  assert.equal(lookup([q],await bank({missingContext:true}))[0].status,'unmatched');
  assert.equal(lookup([q],await bank({type:'多選題'}))[0].status,'unmatched');
});
test('same image and stem with conflicting answers still requires checking',async()=>{
  const q=(await imported([file('chart.png')])).questions[0];const first=await bank();const second=await bank({id:'conflict',answer:'A'});
  assert.equal(lookup([q],buildIndex([...first.entries,...second.entries]))[0].status,'unmatched');
});
test('untrusted remote image origins are never fetched',async()=>{
  let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('unexpected network')};
  try{const d={questions:[{question:{images:[{src:'https://untrusted.invalid/figure.png'}],imageHashes:['a'.repeat(64)]}}]};await fingerprintLibraryImages(d,{apiOrigin:'https://trusted.invalid'});assert.equal(calls,0);assert.equal(d.questions[0].question.imageHashes,undefined);}finally{globalThis.fetch=original;}
});

test('stored public images are downloaded without credentials and unavailable images can retry',async()=>{
  const original=globalThis.fetch;const origin='https://images.example.invalid';let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');if(calls===1)throw Error('offline');return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>Uint8Array.from(bytes).buffer};};
  try{
    const envelope={questions:[{question:{images:[{src:origin+'/api/image/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/0-0'}]}}]};
    await fingerprintLibraryImages(envelope,{apiOrigin:origin});assert.equal(envelope.questions[0].question.imageHashes,undefined);
    await fingerprintLibraryImages(envelope,{apiOrigin:origin});assert.equal(envelope.questions[0].question.imageHashes[0],await imageDigest(bytes));assert.equal(calls,2);
  }finally{globalThis.fetch=original;}
});

test('ordinary numbered HTML question blocks also retain image references and input type',async()=>{
  const raw='<section class="question"><p>1. '+stem+'<img src="chart.png"></p><label><input type="radio" name="q" value="A">A. 10</label><label><input type="radio" name="q" value="B">B. 20</label></section>';
  const imported=await readBatchFiles([file('ordinary.html',Buffer.from(raw))],{document,imageFiles:[file('chart.png')]});
  assert.equal(imported.questions[0].imageHashes[0],await imageDigest(bytes));
  assert.equal(lookup(imported.questions,await bank())[0].status,'matched');
});
