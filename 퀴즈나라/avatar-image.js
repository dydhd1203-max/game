/* Local files have opaque origins in Chrome. Use the same original PNG bytes
   from a script bundle before reading pixels; hosted pages keep normal PNGs. */
(function () {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const bundleURL = new URL('assets/avatar-file-data.js', base).href;
  let bundle;
  const originals = new Set([
    'assets/sd-heads-female.png', 'assets/sd-heads-male.png',
    'assets/sd-tops.png', 'assets/sd-bottoms.png', 'assets/sd-hood.png',
    'assets/pixel-pets-v2.png', 'assets/sd-shoes.png', 'assets/angel-effect.png'
  ]);

  function fileSources() {
    if (window.QPAvatarFileData) return Promise.resolve(window.QPAvatarFileData);
    if (!bundle) bundle = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = bundleURL;
      script.onload = () => {
        script.remove();
        if (window.QPAvatarFileData) resolve(window.QPAvatarFileData);
        else reject(new Error('아바타 원화 파일을 확인해 주세요: assets/avatar-file-data.js'));
      };
      script.onerror = () => {
        script.remove();
        bundle = null;
        reject(new Error('퀴즈나라 폴더 전체를 압축 해제해 주세요. 아바타 원화 파일이 없어요.'));
      };
      document.head.appendChild(script);
    });
    return bundle;
  }

  function image(source, label) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('아바타 원화를 불러오지 못했어요: ' + label));
      img.src = source;
    });
  }
  async function load(url) {
    const absolute = new URL(url, document.baseURI);
    const key = 'assets/' + decodeURIComponent(absolute.pathname.split('/').pop());
    const expected = new URL(key, base);
    const original = originals.has(key) && absolute.origin === expected.origin && absolute.pathname === expected.pathname;
    // Only substitute bundled originals; custom atlases retain their source.
    if (location.protocol === 'file:' && original) {
      const data = await fileSources();
      return image(data[key], url);
    }
    const img = await image(url, url);
    if (original) {
      // Also support opaque-origin embeds. Do not disable canvas/browser security.
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const ctx = probe.getContext('2d', {willReadFrequently: true});
      try {
        ctx.drawImage(img, 0, 0, 1, 1);
        ctx.getImageData(0, 0, 1, 1);
      } catch (error) {
        if (error.name !== 'SecurityError') throw error;
        const data = await fileSources();
        return image(data[key], url);
      }
    }
    return img;
  }
  window.QPAvatarImage = Object.freeze({load});
})();
