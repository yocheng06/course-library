(() => {
  const frameFlag = 'course-frame';
  const initialURL = new URL(location.href);
  const directory = new URL('./', initialURL);
  const pageNames = new Map([
    ['index.html', '課程首頁'], ['os.html', '作業系統'], ['algorithms.html', '演算法']
  ]);
  const messageOrigin = location.protocol === 'file:' ? '*' : location.origin;

  function routeURL(href) {
    const url = new URL(href, directory);
    if (url.origin !== initialURL.origin || !url.pathname.startsWith(directory.pathname)) return null;
    const file = url.pathname.slice(directory.pathname.length) || 'index.html';
    if (!pageNames.has(file)) return null;
    url.searchParams.delete(frameFlag);
    return url;
  }

  function routeKey(url) {
    const key = new URL(url);
    key.searchParams.delete(frameFlag);
    key.searchParams.delete('v');
    key.searchParams.delete('theme');
    key.searchParams.sort();
    if (key.pathname === directory.pathname) key.pathname += 'index.html';
    return key.href;
  }

  function clickedRoute(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return null;
    if (link.getAttribute('href').startsWith('#')) return null;
    return routeURL(link.href);
  }

  function metadata() {
    const icon = document.querySelector('link[rel~="icon"]');
    return {
      title: document.title,
      icon: icon?.href || '',
      iconType: icon?.getAttribute('type') || '',
      description: document.querySelector('meta[name="description"]')?.content || '',
      theme: document.querySelector('meta[name="theme-color"]')?.content || ''
    };
  }

  // Only the host owns audio. Course documents keep their existing question-bank scripts.
  if (window.parent !== window && initialURL.searchParams.get(frameFlag) === '1') {
    window.courseLibraryContentFrame = true;
    document.addEventListener('click', event => {
      const url = clickedRoute(event);
      if (!url) return;
      event.preventDefault();
      window.parent.postMessage({ type: 'course-library:navigate', href: url.href }, messageOrigin);
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') window.parent.postMessage({ type: 'course-library:hide-music' }, messageOrigin);
    });
    window.parent.postMessage({
      type: 'course-library:page-ready', href: routeURL(initialURL.href).href, metadata: metadata()
    }, messageOrigin);
    return;
  }

  const originalNodes = Array.from(document.body.children).map(node => ({ node, inert: node.inert }));
  const originalMetadata = metadata();
  const initialKey = routeKey(initialURL);
  const status = document.createElement('span');
  status.className = 'course-navigation-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  document.body.append(status);
  const notice = document.createElement('aside');
  notice.className = 'course-navigation-notice';
  notice.hidden = true;
  notice.setAttribute('role', 'alert');
  const noticeText = document.createElement('span');
  noticeText.textContent = '課程尚未載入，音樂會繼續播放。';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重試';
  const returnToStart = document.createElement('button');
  returnToStart.type = 'button';
  returnToStart.textContent = '返回起始頁';
  notice.append(noticeText, retry, returnToStart);
  document.body.append(notice);
  let contentFrame;
  let originalScroll = { x: 0, y: 0 };
  let originalVisible = true;
  let pendingURL = null;
  let loadedURL = null;
  let loadedMetadata = null;
  let loadTimer;

  function clearLoadNotice() {
    clearTimeout(loadTimer);
    notice.hidden = true;
  }

  function showLoadFailure() {
    if (pendingURL) notice.hidden = false;
  }

  retry.addEventListener('click', () => {
    if (pendingURL) showRoute(pendingURL);
  });
  returnToStart.addEventListener('click', () => {
    try { history.replaceState({ courseLibraryRoute: initialURL.href }, '', initialURL.href); }
    catch { /* A local file preview may not support replacing the URL. */ }
    showRoute(initialURL);
  });

  function applyMetadata(value) {
    document.title = value.title;
    let icon = document.querySelector('link[rel~="icon"]');
    if (value.icon) {
      if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
      icon.href = value.icon;
      if (value.iconType) icon.type = value.iconType;
      else icon.removeAttribute('type');
    }
    for (const [name, content] of [['description', value.description], ['theme-color', value.theme]]) {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!content) { meta?.remove(); continue; }
      if (!meta) { meta = document.createElement('meta'); meta.name = name; document.head.append(meta); }
      meta.content = content;
    }
  }

  function setOriginalVisible(visible) {
    if (visible === originalVisible) return;
    if (!visible) originalScroll = { x: window.scrollX, y: window.scrollY };
    originalVisible = visible;
    for (const { node, inert } of originalNodes) {
      node.classList.toggle('course-shell-hidden', !visible);
      node.inert = visible ? inert : true;
    }
    document.documentElement.classList.toggle('course-shell-active', !visible);
    document.body.classList.toggle('course-shell-active', !visible);
    if (visible) window.scrollTo(originalScroll.x, originalScroll.y);
  }

  function revealFrame() {
    clearLoadNotice();
    pendingURL = null;
    const musicHasFocus = document.activeElement?.closest('.music-player-panel, .music-launcher');
    setOriginalVisible(false);
    contentFrame.hidden = false;
    contentFrame.title = loadedMetadata.title;
    applyMetadata(loadedMetadata);
    if (!musicHasFocus) contentFrame.focus();
    status.textContent = `已切換到${loadedMetadata.title.split('｜')[0]}。`;
  }

  function showRoute(url) {
    clearLoadNotice();
    if (routeKey(url) === initialKey) {
      pendingURL = null;
      if (contentFrame) contentFrame.hidden = true;
      setOriginalVisible(true);
      applyMetadata(originalMetadata);
      status.textContent = `已切換到${originalMetadata.title.split('｜')[0]}。`;
      return;
    }
    pendingURL = url;
    if (loadedURL && routeKey(loadedURL) === routeKey(url)) { revealFrame(); return; }
    loadedURL = null;
    loadedMetadata = null;
    const source = new URL(url);
    source.searchParams.set(frameFlag, '1');
    status.textContent = `正在切換到${pageNames.get(url.pathname.slice(directory.pathname.length) || 'index.html')}…`;
    loadTimer = setTimeout(showLoadFailure, 10000);
    if (!contentFrame) {
      contentFrame = document.createElement('iframe');
      contentFrame.className = 'course-content-frame';
      contentFrame.title = '課程內容';
      contentFrame.hidden = true;
      contentFrame.addEventListener('error', showLoadFailure);
      contentFrame.src = source.href;
      document.body.append(contentFrame);
    } else {
      // The host handles browser history; replace avoids duplicate child-frame entries.
      try { contentFrame.contentWindow.location.replace(source.href); }
      catch { contentFrame.src = source.href; }
    }
  }

  function navigate(url) {
    if (routeKey(url) === routeKey(new URL(location.href))) return;
    try {
      history.scrollRestoration = 'manual';
      history.replaceState({ ...history.state, courseLibraryRoute: location.href }, '', location.href);
      history.pushState({ courseLibraryRoute: url.href }, '', url.href);
    } catch { /* Local file previews can still swap course content without History API support. */ }
    showRoute(url);
  }

  document.addEventListener('click', event => {
    const url = clickedRoute(event);
    if (!url) return;
    event.preventDefault();
    navigate(url);
  });
  window.addEventListener('popstate', () => {
    const url = routeURL(location.href);
    if (url) showRoute(url);
  });
  window.addEventListener('message', event => {
    if (!contentFrame || event.source !== contentFrame.contentWindow || event.origin !== initialURL.origin) return;
    const value = event.data;
    if (value?.type === 'course-library:navigate') {
      const url = routeURL(value.href);
      if (url) navigate(url);
    } else if (value?.type === 'course-library:page-ready') {
      const url = routeURL(value.href);
      if (!pendingURL || !url || routeKey(url) !== routeKey(pendingURL)) return;
      loadedURL = url;
      loadedMetadata = value.metadata;
      revealFrame();
    } else if (value?.type === 'course-library:hide-music') {
      window.dispatchEvent(new Event('course-library:hide-music'));
    }
  });
})();
