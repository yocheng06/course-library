/* Show only a validated, browser-local learning position on the course home. */
(() => {
  'use strict';
  const names = {os:'作業系統', algorithms:'演算法'};
  const units = {os:['basics','architecture','process','threads','scheduling','synchronization'], algorithms:['L2','L3','L4','L5','L6']};
  let position;
  try {
    const raw = localStorage.getItem('course-library.last-course.v1');
    if (!raw || raw.length > 4000) return;
    position = JSON.parse(raw);
  } catch { return; }
  if (position?.version !== 1 || !units[position.course]?.includes(position.unit) ||
      !Number.isInteger(position.page) || position.page < 1 || position.page > 1000) return;
  const section = document.createElement('section');
  section.className = 'community-entry resume-entry';
  section.setAttribute('aria-labelledby', 'resumeStudyHeading');
  section.innerHTML = '<div><h2 id="resumeStudyHeading">繼續上次學習</h2><p></p></div><nav class="community-links" aria-label="繼續上次學習"><a>繼續學習 →</a></nav>';
  const label = typeof position.unitLabel === 'string' && position.unitLabel.length <= 100 ? position.unitLabel : position.unit;
  section.querySelector('p').textContent = `${names[position.course]} · ${label} · 第 ${position.page} 頁`;
  const file = position.course === 'os' ? 'os.html' : 'algorithms.html';
  const question = typeof position.question === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(position.question) ? position.question : null;
  section.querySelector('a').href = question ? `${file}?question=${encodeURIComponent(question)}` : `${file}?resume=1`;
  document.querySelector('.pixel-courses')?.after(section);
})();
