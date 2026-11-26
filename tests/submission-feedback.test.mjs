import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {publishedLinks,confirmPublication} from '../assets/submission-feedback.mjs';
const id='community-11111111-1111-4111-8111-111111111111-2';
function page(){
 const {document,window}=parseHTML('<div id="feedback"></div>');
 globalThis.window=window;window.courseContributions={apiOrigin:'https://service.example'};
 window.courseQuestionSync=globalThis.courseQuestionSync;
 return document.getElementById('feedback');
}
test('publication feedback links to the actual accepted question identity and escapes its title',()=>{
 const node=page();node.innerHTML=publishedLinks({publishedQuestions:[{id,stem:'<script>bad()</script>'}]},'os');
 assert.equal(node.querySelector('a').href,'https://service.example/course-library/os.html?question='+id);
 assert.equal(node.querySelector('script'),null);assert.match(node.textContent,/查看這題/);
 assert.equal(publishedLinks({publishedQuestions:[{id:'javascript:alert(1)'}]},'os'),'');
});
test('failed index confirmation preserves the receipt and retries only the read request',async()=>{
 const node=page(),result={publishedQuestions:[{id}]};let reads=0;
 globalThis.fetch=async(_,options)=>{reads++;assert.equal(options.cache,'no-cache');if(reads===1)return new Response('',{status:503});return Response.json({questions:[{unit:'basics',question:{id,stem:'題目',answer:'答案',options:[]}}],aliases:[],overrides:[]});};
 await confirmPublication(node,result,'os');assert.match(node.textContent,/題目已儲存/);assert.match(node.textContent,/請勿重複投稿/);
 node.querySelector('button').click();for(let i=0;i<30&&!node.textContent.includes('已確認閱讀');i++)await new Promise(r=>setImmediate(r));
 assert.equal(reads,2);assert.match(node.textContent,/已確認閱讀與批次查題/);
});
