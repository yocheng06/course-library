import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {COURSE_UNITS, normalizeUnit} from '../assets/contribution-model.js';
const root = resolve(import.meta.dirname, '..');
const courses = {};
for (const course of Object.keys(COURSE_UNITS)) {
  const names = new Map(Object.entries(COURSE_UNITS[course].units).map(([id, label]) => [id, label.replace(/^L\d+ · /, '')]));
  const html = await readFile(resolve(root, course + '.html'), 'utf8');
  const snapshot = JSON.parse(html.match(/<script id="course-community-snapshot"[^>]*>([\s\S]*?)<\/script>/)[1]);
  for (const row of snapshot.data.questions) {
    const id = normalizeUnit(course, row.unit);
    if (!names.has(id)) names.set(id, row.question.unitTitle || (snapshot.curation?.unit?.id === id ? snapshot.curation.unit.title : ''));
  }
  if (course === 'os' && names.has('L9')) names.set('L9', '記憶體管理');
  courses[course] = [...names].map(([id, title]) => ({id, title}));
}
await writeFile(resolve(root, 'assets/unit-catalog-snapshot.mjs'), '// Generated from the shipped public snapshots; refresh when adding units.\nexport const UNIT_CATALOG_SNAPSHOT = ' + JSON.stringify(courses, null, 2) + ';\n');
console.log('Prepared unit catalog from both shipped question snapshots.');
