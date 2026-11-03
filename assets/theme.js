/* Defaults to light; trusted navigation carries the chosen appearance. */
(() => {
  'use strict';
  const key = 'course-library.theme.v1';
  const root = document.documentElement;
  let theme = 'light';
  try { if (localStorage.getItem(key) === 'dark') theme = 'dark'; } catch {}
  const pageURL = new URL(location.href);
  const inherited = pageURL.searchParams.get('theme');
  if (inherited === 'light' || inherited === 'dark') {
    theme = inherited;
    try { localStorage.setItem(key, theme); } catch {}
    pageURL.searchParams.delete('theme');
    try { history.replaceState(history.state, '', pageURL.href); } catch {}
  }
  root.dataset.theme = theme;
  let button;
  const publicLibrary = 'https://yocheng06.github.io';
  const publicService = 'https://course-library-submissions-yocheng06.yocheng06.chatgpt.site';
  function themedHref(value) {
    try {
      const url = new URL(value, location.href);
      const local = url.origin === location.origin && url.pathname.startsWith(new URL('./', location.href).pathname);
      const allowed = local || url.origin === publicService || (url.origin === publicLibrary && url.pathname.startsWith('/course-library/'));
      if (!allowed || !['https:', 'http:', 'file:'].includes(url.protocol)) return value;
      url.searchParams.set('theme', theme);
      return url.href;
    } catch { return value; }
  }
  function updateLink(link) {
    const value = link.getAttribute('href');
    if (!value || value.startsWith('#') || link.hasAttribute('download')) return;
    const next = themedHref(link.href);
    if (next !== link.href) link.setAttribute('href', next);
  }
  function updateLinks(node = document) {
    if (node.matches?.('a[href]')) updateLink(node);
    node.querySelectorAll?.('a[href]').forEach(updateLink);
  }
  window.courseTheme = Object.freeze({href: themedHref});
  const moon = '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>';
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  function apply(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    updateLinks();
    if (!button) return;
    const label = theme === 'dark' ? '切換為淺色模式' : '切換為深色模式';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = label;
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (theme === 'dark' ? sun : moon) + '</svg>';
  }
  function init() {
    updateLinks();
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (link) updateLink(link);
    }, true);
    if (typeof MutationObserver !== 'undefined') new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) updateLinks(node);
    }).observe(document.body, {childList: true, subtree: true});
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
