import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../assets/question-sync.js',import.meta.url),'utf8');
function page(storage=new Map()){
 const events=new Map(),window={addEventListener:(name,fn)=>events.set(name,fn)};
 vm.runInNewContext(source,{window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Date,Math});
 return {sync:window.courseQuestionSync,events,storage};
}
test('a submission invalidates both its current page and another tab without exposing drafts',()=>{
 const store=new Map(),a=page(store),b=page(store),notified=[];
 a.sync.subscribe(course=>notified.push('a:'+course));b.sync.subscribe(course=>notified.push('b:'+course));
 const before=b.sync.stamp('os');a.sync.invalidate('os');
 b.events.get('storage')({key:'course-library.questions.changed.v1.os'});
 assert.notEqual(b.sync.stamp('os'),before);assert.deepEqual(notified,['a:os','b:os']);
 assert.equal(store.size,1);assert.equal(a.sync.stamp('algorithms'),'');
});
test('both readers and lookup reject duplicate IDs, incomplete overrides and invalid snapshots',()=>{
 const {sync}=page(),q={unit:'basics',question:{id:'community-11111111-1111-4111-8111-111111111111-1',stem:'題目',answer:'答案',options:[]}};
 const data={questions:[q],aliases:[],overrides:[]};assert.equal(sync.validData(data),true);
 assert.equal(sync.validData({...data,questions:[q,q]}),false);
 assert.equal(sync.validData({...data,overrides:[{unit:'basics',question:{id:'basics-1'}}]}),false);
 assert.equal(sync.validData({...data,overrides:[{unit:'basics',deleted:true,question:{id:'basics-1'}}]}),true);
 assert.equal(sync.validData({questions:[]}),false);
});
