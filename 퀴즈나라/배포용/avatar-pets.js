/* Native-detail companion artwork with smooth illustrated rendering. */
(function () {
  'use strict';

  const names = ['dog', 'cat', 'chick', 'rabbit', 'bear', 'penguin', 'dino', 'ghost', 'fish', 'hamster', 'panda', 'fox', 'unicorn', 'frog', 'bee', 'star'];
  // The generated silhouettes have uneven ears and tails. Separate at the actual
  // transparent gutters rather than cutting them into sixteen nominal squares.
  const cells = {
    dog: [0, 0, 313, 313], cat: [313, 0, 314, 313], chick: [627, 0, 313, 313], rabbit: [940, 0, 314, 313],
    bear: [0, 313, 313, 299], penguin: [313, 313, 314, 299], dino: [627, 313, 313, 299], ghost: [940, 313, 314, 299],
    fish: [0, 612, 313, 290], hamster: [313, 612, 314, 290], panda: [627, 612, 313, 290], fox: [940, 612, 314, 290],
    unicorn: [0, 902, 335, 352], frog: [335, 902, 292, 352], bee: [627, 902, 313, 352], star: [940, 902, 314, 352]
  };
  const atlas = {url: 'assets/pixel-pets-v2.png', ready: false, revision: 0, error: null, count: 0};
  const sprites = new Map(), tinted = new Map(), markup = new Map();
  let loading = Promise.resolve(false), generation = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const canvas = (w, h) => {const c = document.createElement('canvas'); c.width = w; c.height = h; return c;};

  function rgb(value) {
    const match = String(value || '').match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);
    if (!match) return [119, 174, 192];
    const hex = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1];
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  }
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo, l = (hi + lo) / 2;
    let h = 0;
    if (d) h = 60 * (hi === r ? (g - b) / d + (g < b ? 6 : 0) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4);
    return [h, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
  }
  function fromHsl(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const v = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return v.map(n => Math.round(clamp((n + m) * 255, 0, 255)));
  }
  const dyeable = (h, s, l) => h >= 170 && h <= 255 && s > .075 && l > .085 && l < .98;

  function crop(source, shape) {
    const [sx, sy, w, h] = cells[shape], c = canvas(w, h), ctx = c.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(source, sx, sy, w, h, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h), pixels = image.data;
    const visited = new Uint8Array(w * h), queue = new Uint32Array(w * h), pieces = [];
    for (let p = 0; p < visited.length; p++) {
      if (visited[p] || pixels[p * 4 + 3] <= 12) continue;
      let head = 0, tail = 1; queue[0] = p; visited[p] = 1;
      const indices = [];
      while (head < tail) {
        const at = queue[head++], x = at % w, y = (at / w) | 0; indices.push(at);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if ((!dx && !dy) || xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          const next = yy * w + xx;
          if (!visited[next] && pixels[next * 4 + 3] > 12) {visited[next] = 1; queue[tail++] = next;}
        }
      }
      pieces.push(indices);
    }
    if (!pieces.length) throw new Error('Pet artwork is empty: ' + shape);
    const largest = Math.max(...pieces.map(p => p.length)), accepted = new Uint8Array(w * h);
    for (const piece of pieces) if (piece.length >= Math.max(20, largest * .001)) for (const p of piece) accepted[p] = 1;
    // Preserve the alpha contour attached to the original silhouette; remove only
    // detached export specks. No downsampling or enlargement of a low-res bitmap.
    let head = 0, tail = 0;
    for (let p = 0; p < accepted.length; p++) if (accepted[p]) queue[tail++] = p;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if ((!dx && !dy) || xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const next = yy * w + xx;
        if (!accepted[next] && pixels[next * 4 + 3] > 0) {accepted[next] = 1; queue[tail++] = next;}
      }
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1, opaque = 0, dyeCount = 0, lightness = 0;
    for (let p = 0; p < accepted.length; p++) {
      if (!accepted[p]) {pixels[p * 4 + 3] = 0; continue;}
      const x = p % w, y = (p / w) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      if (pixels[p * 4 + 3] > 100) opaque++;
      const i = p * 4, [hh, ss, ll] = hsl(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (pixels[i + 3] > 100 && dyeable(hh, ss, ll)) {dyeCount++; lightness += ll;}
    }
    if (opaque < 10000 || dyeCount < 1000) throw new Error('Pet artwork is incomplete: ' + shape);
    ctx.putImageData(image, 0, 0);
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1, output = canvas(sw, sh), out = output.getContext('2d', {willReadFrequently: true});
    out.drawImage(c, x0, y0, sw, sh, 0, 0, sw, sh);
    const data = out.getImageData(0, 0, sw, sh).data, factor = Math.min(8.7 / sw, 11 / sh);
    const width = sw * factor, height = sh * factor;
    return {shape, w: sw, h: sh, data, opaque, dyeCount, lightness: lightness / dyeCount,
      url: output.toDataURL('image/png'), sourceRect: [sx + x0, sy + y0, sw, sh], target: [28 - width / 2, 47 - height, width, height]};
  }

  function colorize(sprite, color) {
    const target = rgb(color), key = sprite.shape + '/' + target.join(',');
    if (tinted.has(key)) return tinted.get(key);
    const [th, ts, tl] = hsl(...target), data = new Uint8ClampedArray(sprite.data);
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
      if (!dyeable(h, s, l)) continue;
      const delta = l - sprite.lightness;
      const nl = clamp(tl + delta * (tl < .3 ? .5 : tl > .8 ? .65 : .8), .055, .985);
      const ns = clamp(ts * (.78 + .22 * s), 0, 1), out = fromHsl(th, ns, nl);
      data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2];
    }
    const c = canvas(sprite.w, sprite.h), ctx = c.getContext('2d');
    ctx.putImageData(new ImageData(data, sprite.w, sprite.h), 0, 0);
    const url = c.toDataURL('image/png');
    if (tinted.size >= 240) tinted.clear(); tinted.set(key, url); return url;
  }
  function content(shape, color) {
    const sprite = sprites.get(shape); if (!sprite) return '';
    const [x, y, w, h] = sprite.target;
    return `<svg class="qpp-art" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><image href="${colorize(sprite, color)}" width="${sprite.w}" height="${sprite.h}" style="image-rendering:auto"/></svg>`;
  }
  function render(shape, color = '#77aec0') {
    if (!names.includes(shape)) return '';
    const key = [atlas.revision, shape, color].join('/'); if (markup.has(key)) return markup.get(key);
    const value = `<g class="qpx-pet qpp-companion" data-qpp-shape="${esc(shape)}" data-qpp-color="${esc(color)}">${content(shape, color)}</g>`;
    if (markup.size >= 320) markup.clear(); markup.set(key, value); return value;
  }
  function inspect(shape) {
    const s = sprites.get(shape);
    return s ? {width: s.w, height: s.h, opaquePixels: s.opaque, dyePixels: s.dyeCount, sourceRect: s.sourceRect.slice(), target: s.target.slice()} : null;
  }
  function load(url = atlas.url) {
    const version = ++generation; atlas.url = url; atlas.ready = false; atlas.error = null;
    loading = (async () => {
      try {
        const source = await window.QPAvatarImage.load(url);
        if (version !== generation) return false;
        if (source.naturalWidth !== 1254 || source.naturalHeight !== 1254) throw new Error('Pet atlas dimensions changed; update native crop cells.');
        const loaded = names.map(shape => crop(source, shape));
        sprites.clear(); loaded.forEach(s => sprites.set(s.shape, s)); tinted.clear(); markup.clear();
        atlas.ready = true; atlas.revision++; atlas.width = source.naturalWidth; atlas.height = source.naturalHeight; atlas.count = loaded.length;
        document.querySelectorAll('[data-qpp-shape]').forEach(node => {node.innerHTML = content(node.dataset.qppShape, node.dataset.qppColor);});
        window.dispatchEvent(new CustomEvent('qp-pets-ready', {detail: {revision: atlas.revision}})); return true;
      } catch (error) {
        if (version !== generation) return false;
        atlas.error = String(error.message || error);
        window.dispatchEvent(new CustomEvent('qp-pets-error', {detail: {error: atlas.error}})); return false;
      }
    })(); return loading;
  }
  window.QPPets = {render, inspect, atlas, names, load, whenReady: () => loading, clearCache: () => {tinted.clear(); markup.clear();}};
  load();
})();
