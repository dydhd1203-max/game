/* Floating wardrobe effects. The angel atlas is cropped once at native resolution. */
(function () {
  'use strict';

  const catalog = { angel: ['햇살 천사', 520] };
  const atlas = { url: 'assets/angel-effect.png', ready: false, revision: 0, error: null, parts: {} };
  const sprites = new Map();
  const markup = new Map();
  const motionNames = ['qp-effect-orbit', 'qp-effect-float', 'qp-effect-tilt', 'qp-effect-wing-left', 'qp-effect-wing-right', 'qp-effect-spark'];
  let generation = 0;

  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shapeOf = value => String(value || '').split(':')[0];
  const phase = () => (-(performance.now() / 1000)).toFixed(4) + 's';
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function cropCell(source, cell, name) {
    const [sx, sy, w, h] = cell;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, sx, sy, w, h, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h), pixels = image.data;
    const labels = new Uint32Array(w * h), queue = new Uint32Array(w * h), components = [];

    // Connected components never cross a grid-cell boundary. Significant detached
    // halo details are retained along with the body; isolated export dust is removed.
    for (let p = 0; p < labels.length; p++) {
      if (labels[p] || pixels[p * 4 + 3] < 9) continue;
      const label = components.length + 1, part = { count: 0, x0: w, y0: h, x1: -1, y1: -1 };
      let head = 0, tail = 1;
      queue[0] = p;
      labels[p] = label;
      while (head < tail) {
        const at = queue[head++], x = at % w, y = (at / w) | 0;
        part.count++;
        part.x0 = Math.min(part.x0, x); part.x1 = Math.max(part.x1, x);
        part.y0 = Math.min(part.y0, y); part.y1 = Math.max(part.y1, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if ((!dx && !dy) || xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          const next = yy * w + xx;
          if (!labels[next] && pixels[next * 4 + 3] >= 9) {
            labels[next] = label;
            queue[tail++] = next;
          }
        }
      }
      components.push(part);
    }
    if (!components.length) throw new Error('Angel atlas part is empty: ' + name);
    const largest = Math.max(...components.map(p => p.count));
    const keep = components.map(p => p.count >= Math.max(24, largest * .002));
    const accepted = new Uint8Array(w * h);
    let head = 0, tail = 0;
    for (let p = 0; p < labels.length; p++) if (labels[p] && keep[labels[p] - 1]) {
      accepted[p] = 1;
      queue[tail++] = p;
    }
    // Restore the original faint edge pixels without resampling or recoloring.
    while (head < tail) {
      const p = queue[head++], x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if ((!dx && !dy) || xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const next = yy * w + xx;
        if (!accepted[next] && pixels[next * 4 + 3] > 0) {
          accepted[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
    for (let p = 0; p < accepted.length; p++) if (accepted[p]) {
      const x = p % w, y = (p / w) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y); count++;
    }
    if (count < w * h * .015) throw new Error('Angel atlas part is incomplete: ' + name);
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
    x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    const output = document.createElement('canvas');
    output.width = x1 - x0 + 1; output.height = y1 - y0 + 1;
    const outCtx = output.getContext('2d'), out = outCtx.createImageData(output.width, output.height);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const from = y * w + x;
      if (!accepted[from]) continue;
      const i = from * 4, j = ((y - y0) * output.width + x - x0) * 4;
      out.data[j] = pixels[i]; out.data[j + 1] = pixels[i + 1];
      out.data[j + 2] = pixels[i + 2]; out.data[j + 3] = pixels[i + 3];
    }
    outCtx.putImageData(out, 0, 0);
    return { url: output.toDataURL('image/png'), width: output.width, height: output.height, pixels: count,
      sourceBox: [sx + x0, sy + y0, output.width, output.height] };
  }

  function imagePart(name, x, y, width) {
    const part = sprites.get(name);
    const height = width * part.height / part.width;
    return '<image data-qp-effect-part="' + name + '" x="' + x + '" y="' + y + '" width="' + width + '" height="' + height +
      '" href="' + part.url + '" style="image-rendering:auto"/>';
  }

  function angelMarkup() {
    const key = 'angel/' + atlas.revision;
    if (markup.has(key)) return markup.get(key);
    const body = sprites.get('body'), left = sprites.get('left'), right = sprites.get('right');
    const bodyWidth = 6.5, bodyHeight = bodyWidth * body.height / body.width;
    const wingWidth = 5.1, leftHeight = wingWidth * left.height / left.width, rightHeight = wingWidth * right.height / right.width;
    const spark = (x, y, delay) => '<g class="qp-effect-spark" style="--qp-effect-spark-offset:' + delay + 's"><path d="M' + x + ' ' + (y - .55) + 'l.16.39.39.16-.39.16-.16.39-.16-.39-.39-.16.39-.16Z" fill="#ffdc72"/><circle cx="' + (x + .8) + '" cy="' + (y + 1.1) + '" r=".095" fill="#fff1ae"/></g>';
    const output = '<g class="qp-effect-orbit"><g class="qp-effect-float">' +
      '<ellipse cx="31" cy="20" rx="4.2" ry="4" fill="#ffe17b" opacity=".065"/>' +
      '<g class="qp-effect-wing qp-effect-wing-left">' + imagePart('left', 23.7, 20.2 - leftHeight * .61, wingWidth) + '</g>' +
      '<g class="qp-effect-wing qp-effect-wing-right">' + imagePart('right', 33.2, 20.2 - rightHeight * .61, wingWidth) + '</g>' +
      '<g class="qp-effect-tilt">' + imagePart('body', 27.75, 19.5 - bodyHeight / 2, bodyWidth) + '</g>' +
      spark(27.5, 14.5, -.8) + spark(37.3, 22.1, -1.6) + spark(30.2, 25.1, -2.4) +
      '</g></g>';
    markup.set(key, output);
    return output;
  }

  function render(value) {
    if (shapeOf(value) !== 'angel' || !atlas.ready) return '';
    return '<g class="qp-effect" data-qp-effect="angel" style="--qp-effect-phase:' + phase() + '" aria-hidden="true">' + angelMarkup() + '</g>';
  }

  function thumb(shape, color, height = 88) {
    if (shapeOf(shape) !== 'angel') return '';
    const h = Math.max(16, Math.min(420, finite(height, 88)));
    return '<svg xmlns="http://www.w3.org/2000/svg" class="qp-effect-thumb" viewBox="22 11 18 20" width="' + (h * .9) + '" height="' + h +
      '" role="img" aria-label="' + escape(catalog.angel[0]) + '" style="display:block;overflow:visible">' + render('angel:0') + '</svg>';
  }

  async function load(url = atlas.url) {
    const token = ++generation;
    atlas.url = url; atlas.ready = false; atlas.error = null;
    try {
      const source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Angel effect image could not load: ' + url));
        image.src = url;
      });
      const w = Math.floor(source.naturalWidth / 2), h = Math.floor(source.naturalHeight / 2);
      if (w < 64 || h < 64) throw new Error('Angel effect atlas resolution is too small');
      const loaded = new Map([
        ['body', cropCell(source, [0, 0, w, h], 'body')],
        ['left', cropCell(source, [w, 0, source.naturalWidth - w, h], 'left')],
        ['right', cropCell(source, [0, h, w, source.naturalHeight - h], 'right')]
      ]);
      if (token !== generation) return false;
      sprites.clear(); markup.clear();
      for (const [name, part] of loaded) sprites.set(name, part);
      atlas.sourceSize = [source.naturalWidth, source.naturalHeight];
      atlas.parts = Object.fromEntries([...loaded].map(([name, part]) => [name, { width: part.width, height: part.height, pixels: part.pixels, sourceBox: part.sourceBox }]));
      atlas.revision++; atlas.ready = true;
      window.dispatchEvent(new CustomEvent('qp-effect-ready', { detail: { effect: 'angel', revision: atlas.revision } }));
      return true;
    } catch (error) {
      if (token !== generation) return false;
      atlas.error = String(error && error.message || error);
      window.dispatchEvent(new CustomEvent('qp-effect-error', { detail: { effect: 'angel', message: atlas.error } }));
      return false;
    }
  }

  const style = document.createElement('style');
  style.id = 'qp-effect-motion';
  style.textContent = `
    @keyframes qp-effect-orbit { 0%,100% { transform:translateX(-.15px); } 50% { transform:translateX(.3px); } }
    @keyframes qp-effect-float { 0%,100% { transform:translateY(.2px); } 50% { transform:translateY(-.55px); } }
    @keyframes qp-effect-tilt { 0%,100% { transform:rotate(-3deg); } 50% { transform:rotate(3deg); } }
    @keyframes qp-effect-wing-left { 0%,100% { transform:rotate(-10deg) scaleX(.97); } 50% { transform:rotate(18deg) scaleX(.52); } }
    @keyframes qp-effect-wing-right { 0%,100% { transform:rotate(10deg) scaleX(.97); } 50% { transform:rotate(-18deg) scaleX(.52); } }
    @keyframes qp-effect-spark { 0%,100% { opacity:.18; transform:translateY(.2px); } 50% { opacity:.8; transform:translateY(-.3px); } }
    .qp-effect { pointer-events:none; }
    .qp-effect-orbit { animation:qp-effect-orbit 4.8s ease-in-out infinite; }
    .qp-effect-float { animation:qp-effect-float 3.4s ease-in-out infinite; }
    .qp-effect-tilt { transform-box:fill-box; transform-origin:50% 65%; animation:qp-effect-tilt 3s ease-in-out infinite; }
    .qp-effect-wing { transform-box:fill-box; }
    .qp-effect-wing-left { transform-origin:100% 61%; animation:qp-effect-wing-left .4s ease-in-out infinite; }
    .qp-effect-wing-right { transform-origin:0% 61%; animation:qp-effect-wing-right .4s ease-in-out infinite; }
    .qp-effect-spark { animation:qp-effect-spark 2.8s ease-in-out infinite; }
    .qp-effect-orbit,.qp-effect-float,.qp-effect-tilt,.qp-effect-wing,.qp-effect-spark { animation-delay:var(--qp-effect-phase,0s); }
    .qp-effect-spark { animation-delay:calc(var(--qp-effect-phase,0s) + var(--qp-effect-spark-offset,0s)); }
    @media(prefers-reduced-motion:reduce) {
      .qp-effect-orbit,.qp-effect-float,.qp-effect-tilt,.qp-effect-wing,.qp-effect-spark { animation:none; }
      .qp-effect-spark { opacity:.4; }
    }
  `;
  document.head.appendChild(style);

  // A cached avatar string can contain an old phase. Refresh only when inserted,
  // before the next paint; no timer, repeated canvas work, or per-avatar loop.
  function sync(node, currentPhase) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches('.qp-effect')) node.style.setProperty('--qp-effect-phase', currentPhase);
    node.querySelectorAll('.qp-effect').forEach(effect => effect.style.setProperty('--qp-effect-phase', currentPhase));
  }
  const observer = new MutationObserver(records => {
    const currentPhase = phase();
    for (const record of records) for (const node of record.addedNodes) sync(node, currentPhase);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sync(document.documentElement, phase());

  window.QPEffects = { catalog, render, thumb, atlas, clearCache: () => markup.clear(), load, motionNames };
  load();
})();
