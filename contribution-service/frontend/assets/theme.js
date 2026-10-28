/* Shared light/dark preference. First visit always uses light mode. */
(() => {
  'use strict';
  const key = 'course-library.theme.v1';
  const root = document.documentElement;
  let theme = 'light';
  try { if (localStorage.getItem(key) === 'dark') theme = 'dark'; } catch {}
  root.dataset.theme = theme;
  let button;
  const moon = '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>';
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  function apply(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    if (!button) return;
    const label = theme === 'dark' ? '切換為淺色模式' : '切換為深色模式';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = label;
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (theme === 'dark' ? sun : moon) + '</svg>';
  }
  function init() {
    const host = document.querySelector('.learning-tools') ||
      document.querySelector('.pixel-brand') ||
      document.querySelector('.contribution-nav nav') ||
      document.querySelector('.heading');
    if (!host) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.id = 'themeToggle';
    button.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); } catch {}
    });
    host.append(button);
    apply(theme);
  }
  window.addEventListener('storage', event => {
    if (event.key === key) apply(event.newValue);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
