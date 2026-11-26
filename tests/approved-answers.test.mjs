import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseOSCourseHTML} from '../scripts/course-data.mjs';
import {normalizeBatch} from '../assets/contribution-model.js';
import {buildIndex,matchQuestion} from '../assets/batch-model.mjs';
const os=parseOSCourseHTML(readFileSync(new URL('../os.html',import.meta.url),'utf8'));
test('confirmed deadline wording retains its original answer and maps by option content',()=>{
 const q=os.flatMap(u=>u.questions).find(q=>q.id==='os6-065');
 assert.equal(q.answer,'任務必須在截止期限前完成');assert.equal(globalThis.courseChoiceAnswers.expectedChoiceKey(q.answer,q.options),'D');
 const data=normalizeBatch({course:'os',unit:'scheduling',title:'確認答案',questions:[{...q,images:[]}]});
 assert.equal(data.questions[0].answer,q.answer);assert.equal(data.questions[0].choiceKey,'D');
 const key=globalThis.courseChoiceAnswers.expectedChoiceKey;
 assert.equal(key(q.answer,[...q.options].reverse()),'A');
 assert.equal(key(q.answer,['任務必須在截止時間內完成','Tasks must complete by their deadlines']),null);
 assert.equal(key(q.answer,['任務可以被中斷','不保證排程時間']),null);
});
test('numeric array contents remain diagram values rather than extra answer blanks',()=>{
 const data=JSON.parse(readFileSync(new URL('../assets/batch-library.json',import.meta.url),'utf8'));
 const entry=data.entries.find(e=>e.id==='L5-044'&&e.preferred),index=buildIndex([entry]);
 const incoming={stem:entry.stem,options:[],issues:[]};
 assert.equal(matchQuestion(incoming,index,{course:'algorithms',unit:'L5'}).status,'matched');
 const changed=matchQuestion({...incoming,stem:entry.stem.replace('[3] [9]','[4] [9]')},index,{course:'algorithms',unit:'L5'});
 assert.notEqual(changed.status,'matched');assert.equal(changed.answer,'');
});
