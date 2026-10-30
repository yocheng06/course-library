import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {COURSE_UNITS,normalizeUnit,unitLabel,normalizeBatch} from '../assets/contribution-model.js';
import {groupImport} from '../assets/grouped-submissions.mjs';import {parseOSCourseHTML} from '../scripts/course-data.mjs';
const fallback={course:'os',unit:'treasure',title:'挖寶測試'},q={stem:'挖寶合成測試題？',type:'單選題',category:'補充',options:['Alpha','Beta'],answer:'A',images:[]};
test('treasure has its own stable unit between L6 and L7 without changing existing chapter numbers',()=>{
 const keys=Object.keys(COURSE_UNITS.os.units),i=keys.indexOf('treasure');assert.deepEqual(keys.slice(i-1,i+2),['scheduling','treasure','synchronization']);assert.equal(normalizeUnit('os','treasure'),'treasure');assert.equal(unitLabel('os','treasure'),'挖寶單元');
 const units=parseOSCourseHTML(readFileSync(new URL('../os.html',import.meta.url),'utf8')),j=units.findIndex(u=>u.id==='treasure');assert.deepEqual(units.slice(j-1,j+2).map(u=>u.id),['scheduling','treasure','synchronization']);assert.equal(units[j].questions.length,0);assert.equal(units.find(u=>u.id==='synchronization').number,7);assert.equal(units.find(u=>u.id==='deadlocks').number,8);
 const menu=JSON.parse(readFileSync(new URL('../assets/batch-library.json',import.meta.url),'utf8')).courses.os.units;assert.equal(menu.findIndex(u=>u.id==='treasure'),menu.findIndex(u=>u.id==='scheduling')+1);
});
test('manual submissions and HTML/JSON imports can target treasure while preserving question content',()=>{
 assert.equal(normalizeBatch({...fallback,questions:[q]}).unit,'treasure');
 const original={course:'os',unit:'scheduling',title:'原課程',questions:[q]},before=JSON.stringify(original);
 const groups=groupImport(original,fallback,'test.html',{allowMissingAnswers:true,targetUnit:'treasure'});assert.equal(groups[0].payload.unit,'treasure');assert.equal(groups[0].payload.questions[0].stem,q.stem);assert.equal(JSON.stringify(original),before);
 assert.equal(groupImport(original,{...fallback,unit:'basics'})[0].payload.unit,'scheduling');
 assert.throws(()=>groupImport({...original,course:'algorithms',unit:'L6'},fallback,'test.json',{targetUnit:'treasure'}),/科目/);
});
