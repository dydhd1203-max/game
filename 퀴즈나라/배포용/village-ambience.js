/* Gentle motion made from the village's existing original pixels.
   Object positions, stonework, trunks and collision footprints stay fixed. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const instances = new WeakMap();
  let serial = 0;
  function svgNode(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    return node;
  }
  function hash(text) { let n = 0; for (const char of text) n = (n * 31 + char.charCodeAt(0)) >>> 0; return n; }
  function mount(world, options) {
    options = options || {};
    if (!world || (options.zone && options.zone !== 'village')) return { setPaused() {}, destroy() {} };
    instances.get(world)?.destroy();
    const prefix = 'vt-ambient-' + (++serial), restorations = [], targets = [];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let stopped = false, paused = !!options.paused;
    world.classList.add('vt-ambient-world');
    function watch(object, kind) {
      const seed = hash(object.dataset.object || kind);
      object.classList.add('vt-ambient-object');
      object.dataset.ambient = kind;
      object.style.setProperty('--vt-ambient-phase', (-seed % 8100) + 'ms');
      object.style.setProperty('--vt-wind-duration', (6200 + seed % 3400) + 'ms');
      targets.push(object);
      restorations.push(() => {
        object.classList.remove('vt-ambient-object', 'vt-ambient-outside');
        delete object.dataset.ambient;
        object.style.removeProperty('--vt-ambient-phase');
        object.style.removeProperty('--vt-wind-duration');
      });
    }
    function addDefs(svg) {
      const defs = svgNode('defs'); svg.appendChild(defs); restorations.push(() => defs.remove()); return defs;
    }
    function pathClip(defs, id, d) {
      const clip = svgNode('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(svgNode('path', { d, 'clip-rule': 'evenodd', 'fill-rule': 'evenodd' }));
      defs.appendChild(clip); return id;
    }
    // A shear pivots exactly at the cut, so the moving crown still joins its
    // fixed lower branches. No scale/translation is applied to the tree root.
    function crown(object, ratio) {
      const svg = object.querySelector(':scope > svg'), original = svg?.querySelector(':scope > image');
      if (!original) return;
      const [x, y, w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number), cut = y + h * ratio;
      const id = prefix + '-' + targets.length, defs = addDefs(svg);
      // A 1.2 display-pixel overlap covers clip antialiasing at fractional
      // zoom. The shear still pivots at cut, and the root remains stationary.
      const overlap = w / (parseFloat(object.style.width) || w) * 1.2;
      const upper = pathClip(defs, id + '-crown', `M${x-10} ${y-10}H${x+w+10}V${cut+overlap}H${x-10}Z`);
      const lower = pathClip(defs, id + '-root', `M${x-10} ${cut}H${x+w+10}V${y+h+10}H${x-10}Z`);
      const fixed = svgNode('g', { 'clip-path': `url(#${lower})` });
      original.replaceWith(fixed); fixed.appendChild(original);
      const moving = svgNode('g', { class: 'vt-ambient-crown' });
      moving.style.transformOrigin = (x + w / 2) + 'px ' + cut + 'px';
      const crop = svgNode('g', { 'clip-path': `url(#${upper})` });
      crop.appendChild(original.cloneNode(true)); moving.appendChild(crop); svg.appendChild(moving);
      restorations.push(() => { fixed.replaceWith(original); moving.remove(); });
      watch(object, 'leaves');
    }
    function water(object) {
      const svg = object.querySelector(':scope > svg'), original = svg?.querySelector(':scope > image');
      if (!original) return;
      const defs = addDefs(svg), id = prefix + '-fountain';
      // All coordinates are measured in forest-village-life.png. These are
      // source masks, not newly drawn water. The basin rim and pedestal remain.
      const pool = pathClip(defs, id + '-pool', 'M104 300C119 285 142 278 158 274L158 300L164 315Q198 329 237 315L245 300L245 281C274 289 303 302 316 317C309 333 275 342 249 346L245 340L231 337L223 344C191 348 174 347 162 341L152 335L139 335L131 336C113 326 102 313 104 300Z');
      const jets = pathClip(defs, id + '-jets', 'M145 233C140 252 141 276 140 304L133 304C134 277 135 252 139 233ZM166 243C164 265 166 294 165 320L157 320C158 293 158 266 160 243ZM235 246C241 266 240 297 241 323L232 323C233 295 233 267 229 246ZM258 240C264 259 266 280 267 305L261 305C260 281 259 258 253 240Z');
      function layer(clip, className, delay) {
        const frame = svgNode('g', { 'clip-path': `url(#${clip})` });
        const image = original.cloneNode(true); image.setAttribute('class', className);
        if (delay) image.style.animationDelay = delay;
        frame.appendChild(image); svg.appendChild(frame); restorations.push(() => frame.remove());
      }
      layer(pool, 'vt-ambient-pool');
      layer(jets, 'vt-ambient-jets');
      layer(jets, 'vt-ambient-jets', '-850ms');
      watch(object, 'fountain');
    }
    function lantern(object) {
      const svg = object.querySelector(':scope > svg'), original = svg?.querySelector(':scope > image');
      if (!original) return;
      const defs = addDefs(svg), id = prefix + '-light-' + targets.length;
      const clip = pathClip(defs, id, 'M1017 663L1034 668L1034 701L1020 694ZM1042 668L1059 661L1056 695L1042 702Z');
      const frame = svgNode('g', { 'clip-path': `url(#${clip})` });
      const light = original.cloneNode(true); light.setAttribute('class', 'vt-ambient-lantern-light');
      frame.appendChild(light); svg.appendChild(frame); restorations.push(() => frame.remove());
      watch(object, 'lantern');
    }
    for (const object of world.querySelectorAll('.vt-object[data-object]')) {
      const id = object.dataset.object;
      if (id === 'village-plaza-fountain') water(object);
      else if (/^(?:fir|oak|flowering|willow)-\d+$/.test(id)) crown(object, id.startsWith('willow') ? .52 : .60);
      else if (/^flowers-\d+$/.test(id)) crown(object, .60);
      else if (/^(?:village-lantern-|lamp-)\d+$/.test(id)) lantern(object);
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle('vt-ambient-outside', !entry.isIntersecting);
    }, { root: options.viewport || world.closest('.vt-viewport'), rootMargin: '100px' }) : null;
    targets.forEach(node => observer?.observe(node));
    function sync() {
      if (stopped) return;
      world.classList.toggle('vt-ambient-paused', paused || document.hidden || !!reduced?.matches);
    }
    document.addEventListener('visibilitychange', sync);
    reduced?.addEventListener?.('change', sync);
    sync();
    const api = {
      setPaused(value) { if (paused !== !!value) { paused = !!value; sync(); } },
      destroy() {
        if (stopped) return; stopped = true; observer?.disconnect();
        document.removeEventListener('visibilitychange', sync); reduced?.removeEventListener?.('change', sync);
        for (let i = restorations.length - 1; i >= 0; i--) restorations[i]();
        world.classList.remove('vt-ambient-world', 'vt-ambient-paused'); instances.delete(world);
      }
    };
    instances.set(world, api); return api;
  }
  window.QPVillageAmbience = Object.freeze({ mount });
})();
