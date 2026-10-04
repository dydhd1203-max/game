/* Local files have opaque origins in Chrome. Use the same original PNG bytes
   from a script bundle before reading pixels; hosted pages keep normal PNGs. */
(function () {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const bundles = {
    original: { url: new URL('assets/avatar-file-data.js', base).href, global: 'QPAvatarFileData', pending: null },
    wardrobe: { url: new URL('assets/avatar-file-data-wardrobe.js', base).href, global: 'QPAvatarWardrobeFileData', pending: null },
    foundation: { url: new URL('assets/avatar-file-data-foundation.js', base).href, global: 'QPAvatarFoundationFileData', pending: null },
    male: { url: new URL('assets/avatar-file-data-male.js', base).href, global: 'QPAvatarMaleFileData', pending: null }
  };
  const maleSources = new Set(['assets/sd-clothes-male.png']);
  const originals = new Set([
    'assets/sd-heads-female.png', 'assets/sd-heads-male.png',
    'assets/sd-heads-profile-female.png', 'assets/sd-heads-profile-male.png',
    'assets/sd-heads-back-female.png', 'assets/sd-heads-back-male.png',
    'assets/sd-tops.png', 'assets/sd-bottoms.png', 'assets/sd-hood.png',
    'assets/pixel-pets-v2.png', 'assets/sd-shoes.png', 'assets/sd-shoes-parts.png', 'assets/angel-effect.png',
    'assets/sd-wardrobe-wave.png', 'assets/sd-foundation-neck.png','assets/sd-foundation-skin.png', 'assets/sd-foundation-basic.png', 'assets/sd-foundation-shirt-profile.png', 'assets/sd-foundation-sleeves.png', 'assets/sd-foundation-torso.png', 'assets/sd-foundation-sleeves-raised.png', ...maleSources
  ]);

  function fileSources(key) {
    const bundle = key === 'assets/sd-wardrobe-wave.png' ? bundles.wardrobe : key.startsWith('assets/sd-foundation-') ? bundles.foundation : maleSources.has(key) ? bundles.male : bundles.original;
    if (window[bundle.global]) return Promise.resolve(window[bundle.global]);
    if (!bundle.pending) bundle.pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = bundle.url;
      script.onload = () => {
        script.remove();
        if (window[bundle.global]) resolve(window[bundle.global]);
        else reject(new Error('아바타 원화 파일을 확인해 주세요: ' + bundle.url));
      };
      script.onerror = () => {
        script.remove();
        bundle.pending = null;
        reject(new Error('퀴즈나라 폴더 전체를 압축 해제해 주세요. 아바타 원화 파일이 없어요.'));
      };
      document.head.appendChild(script);
    });
    return bundle.pending;
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
      const data = await fileSources(key);
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
        const data = await fileSources(key);
        return image(data[key], url);
      }
    }
    return img;
  }
  window.QPAvatarImage = Object.freeze({load});
})();
