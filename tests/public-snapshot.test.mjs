import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {loadCourse} from '../scripts/audit-topic-order-20261102.mjs';
for(const course of ['os','algorithms'])test(course+' embedded public snapshot includes all active imported questions before network synchronization',async()=>{
 const snapshot=JSON.parse(readFileSync(new URL('../assets/course-snapshots/'+course+'.json',import.meta.url),'utf8'));
 const h=await loadCourse(course),initial=h.config.examEntries(true).map(e=>e.id).sort();
 for(const row of snapshot.data.questions){const id=row.question.id??row.question.bookmarkId;assert(h.config.resolveId(id),id);}
 h.respond(snapshot.data);await new Promise(r=>setImmediate(r));assert.deepEqual(h.config.examEntries(true).map(e=>e.id).sort(),initial);
 if(course==='os'){const rows=h.config.examEntries(['L9']);assert(rows.length>=141);for(const n of [1,2,3])assert(rows.some(e=>e.id==='community-a1954d8f-e9e5-487f-96df-e167ea83bade-'+n));}
});
