/* Opt-in pose rig. The original layered illustration is reversible. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', rigs = new WeakMap();
  const SKIRTS = new Set(['skirt', 'pleat', 'jean_skirt', 'star_skirt', 'tutu', 'hanbok']);
  let serial = 0;
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function node(name, attrs) {
    const out = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => out.setAttribute(key, value));
    return out;
  }
  function setTransform(group, value) {
    if (group.getAttribute('transform') !== value) group.setAttribute('transform', value);
  }
  function wrap(element, name) {
    const group = node('g', { 'data-qpx-pose-part': name });
    element.parentNode.insertBefore(group, element);
    group.appendChild(element);
    return group;
  }
  function unwrap(group) {
    if (!group || !group.parentNode) return;
    while (group.firstChild) group.parentNode.insertBefore(group.firstChild, group);
    group.remove();
  }
  function cloneArtwork(children, prefix) {
    const group = node('g'), ids = new Map();
    children.forEach(child => group.appendChild(child.cloneNode(true)));
    group.querySelectorAll('[id]').forEach(element => {
      const original = element.id, replacement = prefix + '-' + ids.size;
      ids.set(original, replacement); element.id = replacement;
    });
    if (ids.size) group.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        let value = attribute.value;
        ids.forEach((replacement, original) => {
          value = value.split('url(#' + original + ')').join('url(#' + replacement + ')');
          if (value === '#' + original) value = '#' + replacement;
        });
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });
    return group;
  }
  function prepare(svg) {
    if (!svg || typeof svg.querySelector !== 'function') return null;
    if (rigs.has(svg)) return rigs.get(svg);
    const body = svg.querySelector('.qpx-body'), head = svg.querySelector('.qpx-head');
    const idle = svg.querySelector('.qpx-idle');
    if (!body || !head || !idle) return null;
    const uid = 'qppose-' + (++serial), children = Array.from(body.childNodes);
    const bottom = body.querySelector('[data-qpx-clothes="bottom"]');
    const top = body.querySelector('[data-qpx-clothes="top"]');
    const skirt = SKIRTS.has(bottom && bottom.dataset.clothShape);
    const skirtWaist = finite(bottom?.querySelector('svg')?.getAttribute('y'), 36);
    const longTop = ['dress', 'robe', 'overall'].includes(top && top.dataset.clothShape);
    // A cloth hem has its own bone. Its full artwork never becomes an ankle.
    const waist = skirt || longTop ? 39.25 : 38.5, foot = 46;
    const hemStart = 37.75;
    const shoeArtwork = body.querySelector('[data-qpx-shoes]');
    const defs = node('defs', { 'data-qpx-pose-defs': uid });
    function clipped(name, x, y, width, height) {
      const id = uid + '-' + name;
      const clip = node('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(node('rect', { x, y, width, height })); defs.appendChild(clip);
      const movement = node('g', { 'data-qpx-pose-part': name });
      const window = node('g', { 'clip-path': 'url(#' + id + ')' });
      window.appendChild(cloneArtwork(children, uid + '-' + name + '-art'));
      movement.appendChild(window);
      return movement;
    }
    const upper = clipped('upper', -32, -32, 96, waist + 32);
    const left = clipped('left-leg', -32, waist, 48, 64 - waist);
    const right = clipped('right-leg', 16, waist, 48, 64 - waist);
    // Shoes retain their painted proportions while knees bend and legs shorten.
    // Cloning the original nodes also preserves their current dye and detail.
    [upper, left, right].forEach(part => {
      part.querySelectorAll('[data-qpx-shoes]').forEach(shoe => shoe.remove());
      if (skirt) part.querySelectorAll('[data-qpx-clothes="bottom"]').forEach(cloth => cloth.remove());
    });
    [left, right].forEach(part => {
      part.querySelectorAll('[data-qpx-clothes="top"]').forEach(cloth => cloth.remove());
    });
    function clothingClip(name, x, y, width, height, artwork) {
      const id = uid + '-' + name + '-clip';
      const clip = node('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(node('rect', { x, y, width, height })); defs.appendChild(clip);
      const group = node('g', { 'data-qpx-pose-part': name });
      const window = node('g', { 'clip-path': 'url(#' + id + ')' });
      window.appendChild(cloneArtwork(artwork, uid + '-' + name + '-art'));
      group.appendChild(window);
      return group;
    }
    const hem = node('g', { 'data-qpx-pose-part': 'hem' });
    if (skirt && bottom) hem.appendChild(cloneArtwork([bottom], uid + '-skirt-art'));
    if (longTop && top) {
      const lowerTop = clothingClip('coat-hem', -32, hemStart, 96, 64 - hemStart, [top]);
      hem.appendChild(lowerTop);
      const coreClipId = uid + '-coat-core';
      const coreClip = node('clipPath', { id: coreClipId, clipPathUnits: 'userSpaceOnUse' });
      coreClip.appendChild(node('rect', { x: -32, y: -32, width: 96, height: hemStart + 32 }));
      defs.appendChild(coreClip);
      upper.querySelectorAll('[data-qpx-clothes="top"]').forEach(cloth => {
        const core = wrap(cloth, 'coat-core'); core.setAttribute('clip-path', 'url(#' + coreClipId + ')');
      });
    }
    const leftFoot = shoeArtwork ? clothingClip('left-foot', -32, -32, 48, 96, [shoeArtwork]) : null;
    const rightFoot = shoeArtwork ? clothingClip('right-foot', 16, -32, 48, 96, [shoeArtwork]) : null;
    const handNodes = [upper.querySelector('.qpx-hand-left'), upper.querySelector('.qpx-hand-right')];
    const wrists = handNodes.map((hand, index) => {
      const encoded = hand && hand.dataset.qpxWrist ? String(hand.dataset.qpxWrist).split(',').map(Number) : null;
      const x = hand && finite(hand.dataset.qpxWristX, NaN), y = hand && finite(hand.dataset.qpxWristY, NaN);
      return [Number.isFinite(x) ? x : encoded && Number.isFinite(encoded[0]) ? encoded[0] : index ? 20.8 : 11.2,
        Number.isFinite(y) ? y : encoded && Number.isFinite(encoded[1]) ? encoded[1] : 36.4];
    });
    const hands = handNodes.map((hand, index) => hand ? wrap(hand, index ? 'right-hand' : 'left-hand') : null);
    // The pose owns a connected wrist; the idle hand's independent one-pixel
    // translation must not pull it away from the painted cuff during movement.
    handNodes.forEach(hand => { if (hand) hand.style.animation = 'none'; });
    body.replaceChildren(left, right, upper, hem);
    if (leftFoot) body.appendChild(leftFoot);
    if (rightFoot) body.appendChild(rightFoot);
    svg.insertBefore(defs, svg.firstChild);
    const headPose = wrap(head, 'head');
    const backHair = idle.querySelector('.qpx-back-hair');
    const backHairPose = backHair ? wrap(backHair, 'back-hair') : null;
    const facing = wrap(idle, 'facing');
    const rig = { svg, body, head, idle, children, defs, upper, left, right, hands, wrists,
      headPose, backHairPose, facing, waist, skirtWaist, foot, skirt, longTop, hem, leftFoot, rightFoot,
      lastAction: 'idle', landingAt: 0, previousPose: svg.getAttribute('data-qpx-pose') };
    rigs.set(svg, rig);
    reset(svg);
    return rig;
  }
  function pixelUnits(element) {
    const matrix = element.getScreenCTM && element.getScreenCTM(), density = window.devicePixelRatio || 1;
    const x = matrix ? Math.hypot(matrix.a, matrix.b) * density : 1;
    const y = matrix ? Math.hypot(matrix.c, matrix.d) * density : 1;
    return [x > 0 ? x : 1, y > 0 ? y : 1];
  }
  function number(value) { return String(Math.round(value * 100000) / 100000); }
  function translated(x, y) { return 'translate(' + number(x) + ' ' + number(y) + ')'; }
  function legTransform(hip, waist, scaleY, shear, dx, dy) {
    // Shear rotates the stride in screen space while the hip remains attached.
    return translated(dx, dy) + ' translate(' + hip + ' ' + waist + ') matrix(1 0 ' +
      number(shear) + ' ' + number(scaleY) + ' 0 0) translate(' + (-hip) + ' ' + (-waist) + ')';
  }
  function rotated(angle, x, y) { return 'rotate(' + number(angle) + ' ' + number(x) + ' ' + number(y) + ')'; }
  function footTransform(hip, foot, dx, dy, angle) {
    return translated(dx, dy) + ' ' + rotated(angle, hip, foot);
  }
  function apply(svg, state) {
    const rig = prepare(svg); if (!rig) return false;
    state = state || {};
    const action = ['walk', 'jump', 'sit'].includes(state.action) ? state.action : 'idle';
    const [sx, sy] = pixelUnits(rig.body), [, headSy] = pixelUnits(rig.headPose);
    const illustrated = svg.classList.contains('qp-illustrated-avatar');
    const qx = value => illustrated ? value : Math.round(value * sx) / sx;
    const qy = value => illustrated ? value : Math.round(value * sy) / sy;
    const headY = value => illustrated ? value : Math.round(value * headSy) / headSy;
    let left = '', right = '', torsoY = 0, lean = 0, headOffset = 0, headX = 0, headLean = 0;
    let hemTransform = '', footLeft = '', footRight = '', handLeft = [0, 0], handRight = [0, 0];
    let handAngleLeft = 0, handAngleRight = 0, walkPose = null;
    const span = rig.foot - rig.waist;
    if (action === 'walk') {
      const phase = illustrated && Number.isFinite(state.phase) ? ((state.phase % 1) + 1) % 1 : Number.isFinite(state.step) ? ((state.step % 8) + 8) % 8 / 8 :
        ((finite(state.phase) % 1) + 1) % 1;
      const stride = illustrated ? Math.sin(phase * Math.PI * 2) : [0, .7, 1, .7, 0, -.7, -1, -.7][Math.floor(phase * 8) % 8];
      const reach = qx(stride * 2.05), liftL = qy(Math.max(0, stride) * 1.15);
      const liftR = qy(Math.max(0, -stride) * 1.15);
      walkPose = { reach, liftL, liftR, stride };
      torsoY = qy(-.19 * (1 - Math.cos(phase * Math.PI * 4)));
      lean = illustrated ? stride * 1.15 : 0;
      headX = qx(Math.sin(lean * Math.PI / 180) * (rig.waist - 28));
      headOffset = headY(torsoY * 1.35);
      headLean = lean * .35;
      handAngleLeft = -stride * 6; handAngleRight = stride * 6;
    } else if (action === 'jump') {
      // World movement belongs to the physics engine; this only gathers the legs.
      const airborne = state.grounded === true ? .25 : 1;
      const ascending = finite(state.vy) >= 0;
      const gather = qx((ascending ? .85 : .25) * airborne);
      const lift = qy((ascending ? 2.1 : .55) * airborne);
      left = legTransform(13.75, rig.waist, Math.max(.35, 1 - lift / span), gather / span, 0, 0);
      right = legTransform(18.25, rig.waist, Math.max(.35, 1 - lift / span), -gather / span, 0, 0);
      footLeft = footTransform(13.75, rig.foot, gather, -lift, ascending ? -9 : -2);
      footRight = footTransform(18.25, rig.foot, -gather, -lift, ascending ? 9 : 2);
      handAngleLeft = (ascending ? -12 : -4) * airborne;
      handAngleRight = (ascending ? 12 : 4) * airborne;
      headOffset = headY((ascending ? -.12 : .08) * airborne);
    } else if (action === 'sit') {
      // Lower the pelvis, bend the knees outward and keep the feet full size.
      // Only the loose hem gathers; the face, head and upper torso remain 1:1.
      const compact = .38, drop = qy(span * (1 - compact));
      torsoY = drop;
      headOffset = headY(drop * 1.35);
      const spread = qx(rig.skirt || rig.longTop ? 1.8 : 1.45);
      left = translated(0, drop) + legTransform(13.75, rig.waist, compact, -spread / span, 0, 0);
      right = translated(0, drop) + legTransform(18.25, rig.waist, compact, spread / span, 0, 0);
      footLeft = footTransform(13.75, rig.foot, -spread, 0, -9);
      footRight = footTransform(18.25, rig.foot, spread, 0, 9);
      if (rig.skirt || rig.longTop) {
        const anchor = rig.longTop ? 37.75 : rig.skirtWaist;
        hemTransform = translated(0, drop) + ' translate(16 ' + anchor + ') scale(1.075 .63) translate(-16 ' + (-anchor) + ')';
      }
      handAngleLeft = -5; handAngleRight = 5;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (rig.lastAction === 'jump' && action !== 'jump' && state.grounded === true) rig.landingAt = now;
    if (action === 'jump' || action === 'sit') rig.landingAt = 0;
    if (rig.landingAt && now - rig.landingAt < 170) {
      const settle = Math.sin((now - rig.landingAt) / 170 * Math.PI) * .42;
      torsoY += settle; headOffset += headY(settle * 1.35);
    }
    rig.lastAction = action;
    const upperTransform = torsoY || lean ? translated(0, torsoY) + ' ' + rotated(lean, 16, rig.waist) : '';
    const headTransform = headOffset || headX || headLean ? translated(headX, headOffset) + ' ' + rotated(headLean, 16, 28) : '';
    if (walkPose) {
      const sin = Math.sin(lean * Math.PI / 180), cos = Math.cos(lean * Math.PI / 180);
      function strideBone(hip, reach, lift, angle) {
        // The top cut edge shares the torso transform, preventing a moving
        // shirt/waist seam from opening. The endpoint still reaches its shoe.
        const scale = (span - lift - torsoY - sin * (hip + reach - 16)) / (cos * span);
        const endX = 16 + cos * (hip + reach - 16) - sin * span * scale;
        return [upperTransform + ' ' + legTransform(hip, rig.waist, scale, reach / span, 0, 0),
          footTransform(hip, rig.foot, qx(endX - hip), -lift, angle)];
      }
      [left, footLeft] = strideBone(13.75, walkPose.reach, walkPose.liftL, -walkPose.stride * 7);
      [right, footRight] = strideBone(18.25, -walkPose.reach, walkPose.liftR, walkPose.stride * 7);
    }
    setTransform(rig.left, left); setTransform(rig.right, right);
    setTransform(rig.upper, upperTransform);
    setTransform(rig.hem, hemTransform || upperTransform);
    if (rig.leftFoot) setTransform(rig.leftFoot, footLeft);
    if (rig.rightFoot) setTransform(rig.rightFoot, footRight);
    setTransform(rig.headPose, headTransform);
    if (rig.backHairPose) setTransform(rig.backHairPose, headTransform);
    rig.hands.forEach((hand, index) => {
      if (hand) setTransform(hand, translated(...(index ? handRight : handLeft)) + ' ' +
        rotated(index ? handAngleRight : handAngleLeft, ...rig.wrists[index]));
    });
    setTransform(rig.facing, state.facing === 'left' ? 'translate(32 0) scale(-1 1)' : '');
    if (svg.getAttribute('data-qpx-pose') !== action) svg.setAttribute('data-qpx-pose', action);
    return true;
  }
  function reset(svg) {
    const rig = rigs.get(svg); if (!rig) return false;
    [rig.upper, rig.left, rig.right, rig.hem, rig.leftFoot, rig.rightFoot,
      rig.headPose, rig.backHairPose, rig.facing, ...rig.hands].forEach(group => {
      if (group) group.removeAttribute('transform');
    });
    svg.setAttribute('data-qpx-pose', 'idle');
    rig.lastAction = 'idle'; rig.landingAt = 0;
    return true;
  }
  function destroy(svg) {
    const rig = rigs.get(svg); if (!rig) return false;
    rig.body.replaceChildren(...rig.children);
    unwrap(rig.headPose); unwrap(rig.backHairPose); unwrap(rig.facing); rig.defs.remove();
    if (rig.previousPose === null) svg.removeAttribute('data-qpx-pose');
    else svg.setAttribute('data-qpx-pose', rig.previousPose);
    rigs.delete(svg);
    return true;
  }
  window.QPAvatarPose = Object.freeze({ prepare, apply, reset, destroy });
})();
