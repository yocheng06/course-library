(() => {
  'use strict';
  const toggle = document.querySelector('.course-drawer-toggle');
  const sidebar = document.getElementById('courseSidebar');
  const backdrop = document.querySelector('.course-drawer-backdrop');
  if (!toggle || !sidebar || !backdrop) return;

  sidebar.tabIndex = -1;
  sidebar.inert = true;
  sidebar.setAttribute('aria-hidden', 'true');

  function focusTarget() {
    return sidebar.querySelector('.course-nav.active, .site-nav a, .unit-picker select');
  }

  function setOpen(open) {
    document.body.classList.toggle('course-drawer-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '關閉課程導覽' : '開啟課程導覽');
    sidebar.inert = !open;
    sidebar.setAttribute('aria-hidden', String(!open));
    backdrop.hidden = !open;
    if (open) requestAnimationFrame(() => (focusTarget() || sidebar).focus({preventScroll:true}));
    else toggle.focus({preventScroll:true});
  }

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.querySelector('.unit-picker select')?.addEventListener('change', () => setOpen(false));
  sidebar.addEventListener('click', event => {
    if (event.target.closest('.course-nav')) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (toggle.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...sidebar.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.closest('[hidden]') && !element.inert);
    if (!items.length) {
      event.preventDefault();
      sidebar.focus();
      return;
    }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
})();
