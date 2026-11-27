import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCourse,orderingIssues} from '../scripts/audit-topic-order-20261102.mjs';
const records=JSON.parse(await readFile(new URL('../content/algorithms-l9-review-20261127.json',import.meta.url),'utf8')).questions;
const input=records.find(r=>r.id==='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-18').after;
test('matching hash premises stay adjacent, with single multiple fill inside the group',async()=>{
 const h=await loadCourse('algorithms'),t=h.window.courseTopicOrder,unit={id:'L9'};
 const make=(id,q,i)=>({id,unit,unitId:'L9',q,i});
 const single={...input,type:'單選題',opts:['first','second'],a:'A'};
 const fill={...input,type:'填空題',opts:[],a:'28',q:input.q+'\n\nA[6] = ____________'};
 assert.equal(t.premiseKey(single),t.premiseKey(fill));
 const other={...input,q:input.q.replace('1 + (k mod','3 + (k mod')};
 const rows=[make('fill',fill,0),make('other',other,1),make('multiple',input,2),make('single',single,3)];
 const before=JSON.stringify(rows.map(r=>r.q)),sorted=t.sort(rows,'algorithms',()=>0);
 assert.deepEqual(Array.from(sorted,e=>e.id),['single','multiple','fill','other']);
 assert.equal(JSON.stringify(rows.map(r=>r.q)),before);assert.deepEqual(orderingIssues(sorted,t,'algorithms'),[]);
 assert(orderingIssues([sorted[0],sorted[3],sorted[1],sorted[2]],t,'algorithms').some(x=>x.reason==='premise-interleaved'));
});
test('every numeric condition and inserted key order stays significant, including extra conditions and diagrams',async()=>{
 const t=(await loadCourse('algorithms')).window.courseTopicOrder,base=t.premiseKey(input);
 const variants=[
  {...input,q:input.q.replace('10、22','22、10')},
  {...input,q:input.q.replace('10、22','1 0、22')},
  {...input,q:input.q.replace('m = 11','m = 13')},
  {...input,q:input.q.replace('1 + (k mod','3 + (k mod')},
  {...input,q:input.q.replace('m - 1','m - 2')},
  {...input,q:input.q+'\n先刪除 22 再插入 7'},
  {...input,q:input.q.replace('|   |   |','| 99 |   |')},
  {...input,images:[{src:'different-diagram.png'}]},
  {...input,note:'插入前 A[0] 已經有資料'}
 ];for(const q of variants)assert.notEqual(t.premiseKey(q),base);
 const quadratic=records.find(r=>/c_1/.test(r.after.q)).after;
 assert.notEqual(t.premiseKey(quadratic),t.premiseKey({...quadratic,q:quadratic.q.replace('c_2 = 5','c_2 = 3')}));
 assert.equal(t.premiseKey(quadratic),t.premiseKey({...quadratic,q:quadratic.q.replaceAll('c_1','c1').replaceAll('c_2','c2')}));
});
test('exact question text groups choice variants across courses without fuzzy matching or merging records',async()=>{
 const t=(await loadCourse('os')).window.courseTopicOrder,unit={id:'basics'},stem='中斷 (Interrupt) 的常見類型包含？';
 const make=(id,type,options,answer,i,topic='中斷')=>({id,unit,q:{id,category:topic,type,stem,options,answer},i});
 const multi=make('multi','多選題',['硬體','軟體'],'A、B',2),single=make('single','單選題',['計時器','其他'],'A',0),other=make('other','多選題',['外部','內部'],'A、B',1);
 other.q.stem='哪些是軟體中斷？';
 const sorted=t.sort([single,other,multi],'os',()=>0);
 assert.deepEqual(Array.from(sorted,e=>e.id),['single','multi','other']);
 assert.notEqual(t.premiseKey(single.q),t.premiseKey({...single.q,stem:'中斷 (Interrupt) 的不常見類型包含？'}));
 const blank={...single.q,stem:'填入 [__1__] 的定義？'};assert.equal(t.premiseKey(blank),t.premiseKey({...blank,stem:'填入 ____________ 的定義？'}));
});
test('all current live snapshot groups are contiguous, content and stable deep links survive reordering',async()=>{
 for(const course of ['os','algorithms']){
  const h=await loadCourse(course),t=h.window.courseTopicOrder,entries=h.config.examEntries(true);
  assert.deepEqual(orderingIssues(entries,t,course),[]);
 }
 const h=await loadCourse('algorithms'),entries=h.config.examEntries(['L9']);
 const a=entries.findIndex(e=>e.id==='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-6'),b=entries.findIndex(e=>e.id==='community-fa2c9987-e7e9-4786-904c-39393dd47af5-2');assert.equal(b,a+1);
 const target=entries[b],linked=await loadCourse('algorithms',{linkedQuestion:target.id});assert.equal(linked.config.questionDetails(target.id).number,b+1);assert(linked.config.list.querySelector('[data-id="'+target.id+'"]'));
});
