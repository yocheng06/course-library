import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../assets/full-learning-backup.js',import.meta.url),'utf8');
function harness(failKey=''){
 const {window,document}=parseHTML('<html><body><div class="review-backup"></div></body></html>'),storage=new Map([['course-library.learning.v1.os','OLD-L'],['course-library.practice.v1.os','OLD-P'],['last-key','OLD-E']]);let fail=false,applied=0;
 window.courseLearning={course:'os',render(){}};
 window.learningUI={exportLearning:()=>({bookmarks:[],size:'standard'}),prepareLearning:d=>d,applyLearning:()=>applied++};
 window.coursePracticeProgress={exportProgress:()=>({records:[]}),prepareProgress:d=>d,applyProgress:()=>applied++};
 window.courseExam={exportBackup:()=>({last:{sample:'last'},draft:{sample:'draft'}}),prepareBackup:d=>{if(d.invalid)throw Error('invalid exams');return d;},applyBackup:()=>applied++,backupKeys:{last:'last-key',draft:'draft-key',answers:'answers-key'}};
 const context=vm.createContext({window,document,TextEncoder,URL,Blob,setTimeout,localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(fail&&k===failKey){fail=false;throw Error('quota');}storage.set(k,v);},removeItem:k=>storage.delete(k)}});
 vm.runInContext(source,context);return {backup:window.courseFullLearningBackup,storage,setFail:()=>fail=true,applied:()=>applied};
}
test('personal backup v2 contains exam snapshots and restores all stores atomically',()=>{
 const h=harness(),data=h.backup.exportData();assert.equal(data.version,2);assert(data.exams.last);data.exams={last:{sample:'new'},draft:{sessionId:'session',responses:[]}};
 const result=h.backup.restore(JSON.stringify(data));assert.equal(result.exams,true);assert.equal(h.applied(),3);assert.equal(JSON.parse(h.storage.get('answers-key')).sessionId,'session');
});
test('personal backup accepts v1 and rolls back earlier stores when an exam storage write fails',()=>{
 const h=harness('last-key'),data=h.backup.exportData(),before=[...h.storage];data.exams={last:{sample:'new'},draft:null};h.setFail();assert.throws(()=>h.backup.restore(JSON.stringify(data)),/無法保存/);assert.deepEqual([...h.storage],before);assert.equal(h.applied(),0);
 const old={...data,version:1};delete old.exams;assert.equal(h.backup.restore(JSON.stringify(old)).exams,false);assert.equal(h.storage.get('last-key'),'OLD-E');
});
test('personal backup validates exams before touching storage',()=>{const h=harness(),data=h.backup.exportData(),before=[...h.storage];data.exams={invalid:true};assert.throws(()=>h.backup.restore(JSON.stringify(data)),/invalid/);assert.deepEqual([...h.storage],before);assert.equal(h.applied(),0);});
