
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {parseOSCourseHTML} from './scripts/course-data.mjs';
import {choiceAliases,choiceCombinations,questionStemVersions} from './assets/batch-model.mjs';
import {questionKey} from './assets/contribution-model.js';
const root=process.cwd(),r=p=>readFile(resolve(root,p),'utf8');
const units=parseOSCourseHTML(await r('os.html')),before=parseOSCourseHTML(await readFile(process.argv[2],'utf8'));
const l6=units.find(u=>u.id==='scheduling'),old=before.find(u=>u.id==='scheduling');
assert.equal(l6.questions.length,119);
assert.equal(units.reduce((s,u)=>s+u.questions.length,0),770);
assert.equal(units.find(u=>u.id==='deadlocks').questions.length,173);
for(const unit of before) {
 if(unit.id!=='scheduling')assert.deepEqual(units.find(u=>u.id===unit.id),unit);
 else for(const q of unit.questions) {
  const nq=l6.questions.find(n=>n.id===q.id);
  for(const field of ['stem','options','answer','explanation','choiceKey','type'])assert.deepEqual(nq[field],q[field],q.id+' '+field);
 }
}
for(const category of new Set(l6.questions.map(q=>q.category))) {
 const rank={'單選題':0,'多選題':1,'填空題':2};
 const qs=l6.questions.filter(q=>q.category===category).map(q=>q.options.length ? rank[q.type] : 2);
 assert.deepEqual(qs,[...qs].sort((a,b)=>a-b),category);
}
const existing=JSON.parse(await r('contribution-service/existing-questions.json')),entries=new Map();
for(const e of existing)entries.set(JSON.stringify([questionKey(e.course,e.unit,e),e.canonicalId]),e);
const mergeTargets=new Set(JSON.parse(await r('contribution-service/content/approved-merges.json')).entries.map(e=>JSON.stringify([e.course,e.unit,e.canonicalId])));
for(const q of l6.questions) {
 const inherited=choiceAliases(q.options||[],q.optionTranslations)||[];
 for(const v of [q,...(q.sourceVariants||[])]) {
  const canonicals=new Set([q.id,...[...(q.aliases||[]),...(v.id?[v.id]:[])].filter(id=>mergeTargets.has(JSON.stringify(['os','scheduling',id])))]);
  for(const canonicalId of canonicals) {
   const e={course:'os',unit:'scheduling',stem:v.stem??v.q,options:v.options??v.opts??[],canonicalId,images:v.images||[],imageKeys:[]};
   assert.equal(e.images.length,0,'unexpected L6 image '+q.id);
   const aliases=choiceAliases(e.options,v.optionTranslations,inherited);
   for(const stem of questionStemVersions(e.stem,v.translation)) for(const options of choiceCombinations(e.options,aliases)) {
    const version={...e,stem,options};
    entries.set(JSON.stringify([questionKey('os','scheduling',version),canonicalId]),version);
   }
  }
 }
}
await writeFile(resolve(root,'contribution-service/existing-questions.json'),JSON.stringify([...entries.values()]));

const batch=JSON.parse(await r('assets/batch-library.json'));
const newq=l6.questions.find(q=>q.id==='os6-118');
assert.equal(l6.questionAliases['os6-117'],'os6-046');
assert.equal(newq.answer,'I/O');assert.deepEqual(newq.sourceRecords,[141,172,261]);
assert.equal(batch.courses.os.count,770);
assert.ok(batch.entries.some(e=>e.id===newq.id&&e.answer==='I/O'));
console.log(JSON.stringify({l6:l6.questions.length,os:770,unchangedPrimaryQuestions:old.questions.length,batchQuestions:Object.values(batch.courses).reduce((s,c)=>s+c.count,0),batchEntries:batch.entries.length,indexBefore:existing.length,indexAfter:entries.size,newQuestion:newq.id}));
