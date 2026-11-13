// Browser arena bridge. Call markReady only after assets and controls are usable.
function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '[::1]' || hostname === '::1'
    || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    || /^(127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}

function loadSdk() {
  if (globalThis.YaGames?.init) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('Yandex SDK loading timed out')), 15000);
    const finish = (error) => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    script.src = '/sdk.js';
    script.async = true;
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Yandex SDK could not be loaded'));
    document.head.append(script);
  });
}

export async function createPlatform({ standalone = isLocalHost(location.hostname) } = {}) {
  let sdk = null;
  let sdkError = null;
  let ready = false;
  let wantsGameplay = false;
  let reportedGameplay = false;
  let sdkWillResume = false;
  let destroyed = false;
  const pauses = new Set(document.hidden ? ['hidden'] : []);
  const listeners = new Set();

  const syncGameplay = () => {
    const active = ready && wantsGameplay && pauses.size === 0 && !destroyed;
    if (reportedGameplay === active) return;
    reportedGameplay = active;
    if (active) sdk?.features?.GameplayAPI?.start();
    else sdk?.features?.GameplayAPI?.stop();
  };
  const setPause = (reason, paused) => {
    const previous = pauses.size > 0;
    if (paused) pauses.add(reason);
    else pauses.delete(reason);
    syncGameplay();
    const current = pauses.size > 0;
    if (previous !== current) listeners.forEach((callback) => callback(current));
  };
  const onVisibility = () => setPause('hidden', document.hidden);
  const onBlur = () => setPause('blur', true);
  const onFocus = () => setPause('blur', false);
  const onSdkPause = () => {
    if (pauses.has('sdk')) return;
    // SDK pause/resume already marks gameplay; keep our mirror in sync.
    sdkWillResume = reportedGameplay;
    reportedGameplay = false;
    setPause('sdk', true);
  };
  const onSdkResume = () => {
    if (!pauses.has('sdk')) return;
    reportedGameplay = sdkWillResume;
    sdkWillResume = false;
    setPause('sdk', false);
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  if (!standalone) {
    try {
      await loadSdk();
      sdk = await globalThis.YaGames.init();
      sdk.on('game_api_pause', onSdkPause);
      sdk.on('game_api_resume', onSdkResume);
    } catch (error) {
      sdkError = error;
    }
  }

  return {
    get sdk() { return sdk; },
    get sdkError() { return sdkError; },
    get standalone() { return standalone; },
    get paused() { return pauses.size > 0; },
    get language() {
      return sdk?.environment?.i18n?.lang || navigator.language?.split('-')[0] || 'ru';
    },
    markReady() {
      if (ready || destroyed) return;
      ready = true;
      sdk?.features?.LoadingAPI?.ready();
      syncGameplay();
    },
    setGameplay(active) {
      const next = Boolean(active);
      if (!next && wantsGameplay && pauses.has('sdk')) {
        // A menu opened during a platform pause must not restart on resume.
        sdkWillResume = false;
        sdk?.features?.GameplayAPI?.stop();
      }
      wantsGameplay = next;
      syncGameplay();
    },
    onPauseChange(callback) {
      if (typeof callback !== 'function') throw new TypeError('Pause listener must be a function');
      listeners.add(callback);
      callback(pauses.size > 0);
      return () => listeners.delete(callback);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      syncGameplay();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      sdk?.off('game_api_pause', onSdkPause);
      sdk?.off('game_api_resume', onSdkResume);
      listeners.clear();
    },
  };
}
