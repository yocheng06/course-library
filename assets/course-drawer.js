(() => {
  'use strict';

  const toggle = document.querySelector('.course-drawer-toggle');
  const sidebar = document.getElementById('courseSidebar');
  if (!toggle || !sidebar) return;

  const desktop = window.matchMedia('(min-width: 1001px)');

  function setCollapsed(collapsed) {
    const isCollapsed = desktop.matches && collapsed;
    document.body.classList.toggle('course-drawer-collapsed', isCollapsed);
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
    toggle.setAttribute('aria-label', isCollapsed ? '展開課程側欄' : '收起課程側欄');
    sidebar.inert = isCollapsed;
    sidebar.setAttribute('aria-hidden', String(isCollapsed));
  }

  toggle.addEventListener('click', () => {
    if (!desktop.matches) return;
    setCollapsed(!document.body.classList.contains('course-drawer-collapsed'));
    toggle.focus({preventScroll:true});
  });

  // Restore the original expanded layout after switching between desktop and mobile.
  desktop.addEventListener('change', () => setCollapsed(false));
  setCollapsed(false);
})();
