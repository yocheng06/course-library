/* Compare visible question identities, including edits with unchanged counts. */
(() => {
  'use strict';
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  }
  function snapshot(entries) {
    const grouped = new Map();
    for (const entry of entries) {
      if (!grouped.has(entry.id)) grouped.set(entry.id, []);
      grouped.get(entry.id).push(JSON.stringify(stable(entry.q ?? entry)));
    }
    return new Map([...grouped].map(([id, versions]) => [id, JSON.stringify(versions.sort())]));
  }
  function describe(before, after) {
    let added = 0, removed = 0, updated = 0;
    for (const [id, value] of after) {
      if (!before.has(id)) added++;
      else if (before.get(id) !== value) updated++;
    }
    for (const id of before.keys()) if (!after.has(id)) removed++;
    const changes = [added && `新增 ${added} 題`, removed && `移除 ${removed} 題`, updated && `更新 ${updated} 題`].filter(Boolean);
    return `${before.size} → ${after.size} 題（${changes.join('、') || '題目內容無變更'}）`;
  }
  globalThis.courseSyncSummary = Object.freeze({snapshot, describe});
})();
