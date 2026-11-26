/* Shared revision invalidation for reading, lookup and submission pages. */
(() => {
  const host = typeof window === 'undefined' ? globalThis : window;
  if (host.courseQuestionSync) return;
  const prefix = 'course-library.questions.changed.v1.';
  const cacheKey = course => 'course-library.questions.v1.' + course;
  const stamp = course => { try { return localStorage.getItem(prefix + course) || ''; } catch { return ''; } };
  const listeners = new Set();
  const emit = course => { for (const fn of listeners) fn(course); };
  function invalidate(course) {
    if (!['os', 'algorithms'].includes(course)) return;
    try { localStorage.setItem(prefix + course, Date.now() + ':' + Math.random()); } catch {}
    emit(course);
  }
  function validData(data) {
    if (!data || !['questions','aliases','overrides'].every(k => Array.isArray(data[k]))) return false;
    const validQuestion = q => q && typeof (q.stem ?? q.q) === 'string' && typeof (q.answer ?? q.a) === 'string' &&
      Array.isArray(q.options ?? q.opts) && (q.options ?? q.opts).every(v => typeof v === 'string');
    const ids = new Set();
    return data.questions.every(row => {
      const id = row?.question?.id || row?.question?.bookmarkId;
      if (typeof row?.unit !== 'string' || !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(id || '') || ids.has(id) || !validQuestion(row.question)) return false;
      ids.add(id); return true;
    }) && data.aliases.every(a => typeof a?.id === 'string' && typeof a.target === 'string') &&
      data.overrides.every(row => typeof row?.unit === 'string' && typeof (row.question?.id || row.question?.bookmarkId) === 'string' && (row.deleted === true || validQuestion(row.question)));
  }
  host.addEventListener?.('storage', event => {
    if (event.key?.startsWith(prefix)) emit(event.key.slice(prefix.length));
  });
  host.courseQuestionSync = Object.freeze({cacheKey, stamp, invalidate, validData, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }});
})();
