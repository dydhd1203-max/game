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
    'assets/sd-wardrobe-wave.png', 'assets/sd-foundation-ref-neck.png', 'assets/sd-foundation-ref-arms.png', 'assets/sd-foundation-ref-legs.png',
    'assets/sd-foundation-ref-arms-clean.png', 'assets/sd-foundation-ref-neck-clean.png', ...maleSources
  ]);
  // Garment atlases (stage 3, reference body only): assets/sd-garment-<cat>-<shape>-<m|f>.png,
  // shape keys may hold '_' (jean_skirt). Each record has its own bundle
  // (assets/avatar-file-data-garment-<cat>-<shape>.js, named in the garment
  // index) that adds its keys to one shared registry, QPAvatarGarmentFileData;
  // a bundle resolves only once its own key is there.
  const GARMENT_ATLAS = /^assets\/sd-garment-([a-z]+)-([a-z0-9_]+)-(m|f)\.png$/;
  const garmentBundles = new Map();
  function garmentBundle(key) {
    const index = window.QPFoundationGarmentIndex;
    if (index) for (const entry of Object.values(index.records || {})) if (entry.files && (entry.files.m === key || entry.files.f === key)) return entry.files.bundle;
    const m = GARMENT_ATLAS.exec(key);
    return m ? 'assets/avatar-file-data-garment-' + m[1] + '-' + m[2] + '.js' : null;
  }
  const bundleFor = key => key === 'assets/sd-wardrobe-wave.png' ? bundles.wardrobe : key.startsWith('assets/sd-foundation-') ? bundles.foundation : maleSources.has(key) ? bundles.male : bundles.original;
  // Where a key's bytes come from on a local page: whether it is a bundled
  // original, the bundle URL and the global it fills (pure; tools/verify-avatar-image-route.cjs).
  function route(key) {
    if (GARMENT_ATLAS.test(key)) return { original: true, url: new URL(garmentBundle(key), base).href, global: 'QPAvatarGarmentFileData', garment: true };
    const bundle = bundleFor(key);
    return { original: originals.has(key), url: bundle.url, global: bundle.global, garment: false };
  }

  function garmentSources(key, url) {
    const data = window.QPAvatarGarmentFileData;
    if (data && data[key]) return Promise.resolve(data);
    let pending = garmentBundles.get(url);
    if (!pending) {
      pending = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => { script.remove(); resolve(); };
        script.onerror = () => { script.remove(); garmentBundles.delete(url); reject(new Error('퀴즈나라 폴더 전체를 압축 해제해 주세요. 옷 원화 파일이 없어요.')); };
        document.head.appendChild(script);
      });
      garmentBundles.set(url, pending);
    }
    return pending.then(() => {
      const loaded = window.QPAvatarGarmentFileData;
      if (loaded && loaded[key]) return loaded;
      throw new Error('옷 원화 파일을 확인해 주세요: ' + url);
    });
  }
  function fileSources(key) {
    if (GARMENT_ATLAS.test(key)) return garmentSources(key, new URL(garmentBundle(key), base).href);
    const bundle = bundleFor(key);
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
    const original = (originals.has(key) || GARMENT_ATLAS.test(key)) && absolute.origin === expected.origin && absolute.pathname === expected.pathname;
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
  window.QPAvatarImage = Object.freeze({load, route});
})();
