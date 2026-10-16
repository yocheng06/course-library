/* Keep the radio assets available while its public feature is paused. */
(async () => {
  'use strict';
  const MUSIC_RADIO_ENABLED = false;
  if (!MUSIC_RADIO_ENABLED) return;

  const player = document.querySelector('.radio-shell');
  function loadStyles(path) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = path;
      link.onload = resolve;
      link.onerror = () => reject(new Error(`Unable to load ${path}`));
      document.head.append(link);
    });
  }
  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${path}`));
      document.body.append(script);
    });
  }

  try {
    if (player) {
      await loadStyles('assets/music-player.css?v=global-dedup-20261016');
      await loadScript('assets/music-playlist.js?v=global-dedup-20261016');
      await loadScript('assets/music-player.js?v=global-dedup-20261016');
      document.getElementById('radioUnavailable').hidden = true;
      player.hidden = false;
    } else {
      document.body.classList.add('has-music-radio');
      await loadStyles('assets/music-launcher.css?v=global-dedup-20261016');
      await loadScript('assets/course-navigation.js?v=global-dedup-20261016');
      await loadScript('assets/music-launcher.js?v=global-dedup-20261016');
    }
  } catch (error) {
    console.error(error);
  }
})();
