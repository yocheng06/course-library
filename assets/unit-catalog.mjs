import {COURSE_UNITS, normalizeUnit, unitLabel} from './contribution-model.js?v=treasure-unit-20261030';
import {UNIT_CATALOG_SNAPSHOT} from './unit-catalog-snapshot.mjs?v=flow-clarity-20261103';
const key = 'course-library.unit-catalog.v1';
// Catalog metadata only; question contents and deletion state still come from the API.
export function createUnitCatalog(storage) {
  const names = Object.fromEntries(Object.entries(COURSE_UNITS).map(([course, data]) => [course, {...data.units}]));
  const titles = {os: {}, algorithms: {}};
  function merge(course, rows) {
    if (!Object.hasOwn(names, course) || !Array.isArray(rows)) return;
    for (const row of rows.slice(0, 100)) {
      try {
        const id = normalizeUnit(course, row?.id);
        const title = typeof row.title === 'string' ? row.title.trim().slice(0, 60) : '';
        names[course][id] = unitLabel(course, id, title);
        titles[course][id] = title;
      } catch { /* Invalid cached metadata must not break the built-in menu. */ }
    }
  }
  let cached;
  try { cached = JSON.parse(storage?.getItem(key) || 'null'); } catch {}
  for (const course of Object.keys(names)) merge(course, UNIT_CATALOG_SNAPSHOT[course]);
  if (cached?.schema === 1) for (const course of Object.keys(names)) merge(course, cached.courses?.[course]);
  function update(course, rows) {
    merge(course, rows);
    try { storage?.setItem(key, JSON.stringify({schema: 1, courses: Object.fromEntries(Object.keys(names).map(c => [c, Object.keys(names[c]).map(id => ({id, title: titles[c][id] || ''}))]))})); } catch {}
  }
  function list(course) {
    const rank = id => id === 'treasure' ? 6.5 : Number(names[course][id].match(/^L(\d+)/)?.[1] || 100);
    return Object.keys(names[course] || {}).sort((a, b) => rank(a) - rank(b)).map(id => ({id, name: names[course][id]}));
  }
  return {names, titles, update, list};
}
