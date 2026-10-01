/* Original forest world. Question identity is always its index in the supplied array.
   Rendering, movement and proximity live here; grading and persistence belong to the caller. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const WIDTH = 1280, SPEED = 205, RADIUS = 14, PATH_HALF = 58, INTERACT_DISTANCE = 94;
  const MODES = new Set(['sequence', 'free', 'team', 'coop']);
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let serial = 0;

  function element(tag, className, text) {
    const out = document.createElement(tag);
    if (className) out.className = className;
    if (text !== undefined) out.textContent = text;
    return out;
  }
  function random(seed) {
    let value = seed >>> 0;
    return function () { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
  }
  function color(value, fallback) {
    return typeof value === 'string' && window.CSS && CSS.supports('color', value) ? value : fallback;
  }
  function pose(svg, state) {
    if (svg && window.QPAvatarPose) window.QPAvatarPose.apply(svg, state);
  }
  function destroyPose(svg) {
    if (svg && window.QPAvatarPose) { window.QPAvatarPose.reset(svg); window.QPAvatarPose.destroy(svg); }
  }

  // Parallel rows never overlap. Round turns and the wavy centre line are sampled
  // once, and the same samples draw the trail and define its walkable ground.
  function routeFor(count) {
    const rows = Math.max(1, Math.ceil(count / 4)), points = [];
    for (let row = 0; row < rows; row++) {
      const right = row % 2 === 0, y = 280 + row * 240;
      for (let i = 0; i <= 54; i++) {
        const t = i / 54;
        points.push({ x: right ? 220 + 830 * t : 1050 - 830 * t,
          y: y + Math.sin(t * Math.PI * 2) * 27 });
      }
      if (row < rows - 1) for (let i = 1; i <= 24; i++) {
        const angle = i / 24 * Math.PI;
        points.push({ x: (right ? 1050 : 220) + (right ? 1 : -1) * Math.sin(angle) * 120,
          y: y + 120 - Math.cos(angle) * 120 });
      }
    }
    let length = 0;
    points.forEach((point, i) => { if (i) length += distance(point, points[i - 1]); point.s = length; });
    return { points, length, height: 280 + (rows - 1) * 240 + 210 };
  }
  function along(route, s) {
    s = clamp(s, 0, route.length);
    for (let i = 1; i < route.points.length; i++) {
      const b = route.points[i], a = route.points[i - 1];
      if (b.s >= s) {
        const t = (s - a.s) / (b.s - a.s || 1);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s,
          angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
      }
    }
    return Object.assign({ angle: 0 }, route.points[route.points.length - 1]);
  }
  function project(route, x, y) {
    let best = { distance: Infinity, s: 0, x: 0, y: 0 };
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const px = a.x + t * dx, py = a.y + t * dy, d = Math.hypot(x - px, y - py);
      if (d < best.distance) best = { distance: d, s: a.s + t * (b.s - a.s), x: px, y: py };
    }
    return best;
  }

  function honeyArt(id) {
    return '<svg viewBox="0 0 86 100" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="' + id + '-pot" x2=".2" y2="1"><stop stop-color="#fff0ab"/><stop offset=".35" stop-color="#d9993e"/><stop offset="1" stop-color="#a45d27"/></linearGradient>' +
      '<linearGradient id="' + id + '-honey" x2="0" y2="1"><stop stop-color="#fff596"/><stop offset="1" stop-color="#ebac20"/></linearGradient></defs>' +
      '<ellipse cx="43" cy="91" rx="30" ry="7" fill="#284d343d"/>' +
      '<g class="qp-map-pot-body"><path d="M25 30Q15 42 15 64Q14 88 31 91H55Q73 88 71 64Q71 43 62 30Z" fill="url(#' + id + '-pot)" stroke="#774c25" stroke-width="3"/>' +
      '<path d="M27 34Q19 44 22 70" fill="none" stroke="#fff4c6" stroke-width="5" stroke-linecap="round" opacity=".65"/>' +
      '<path d="M18 52Q44 60 69 52M18 77Q42 84 69 77" fill="none" stroke="#a66b31" stroke-width="2" opacity=".45"/>' +
      '<ellipse cx="43" cy="31" rx="21" ry="8" fill="#70502a" stroke="#7d4e25" stroke-width="3"/>' +
      '<ellipse cx="43" cy="30" rx="17" ry="5" fill="url(#' + id + '-honey)"/>' +
      '<path d="M23 31Q28 39 34 34Q39 32 39 42Q38 51 44 50Q49 50 48 38Q48 32 56 35Q64 35 64 31" fill="url(#' + id + '-honey)" stroke="#c38b22" stroke-width="1.5"/>' +
      '<path d="M33 58Q43 50 53 58L52 72Q43 78 34 72Z" fill="#fff2bd" stroke="#be883f" stroke-width="2"/>' +
      '<path d="M39 61L46 59L49 65L45 71L38 68Z" fill="#f0b735"/><path d="M37 85Q48 87 60 82" stroke="#72441e" stroke-width="2" fill="none" opacity=".45"/></g>' +
      '<g class="qp-map-pot-lid"><path d="M20 26Q18 18 27 17H59Q68 19 66 27Q43 36 20 26Z" fill="#e6bb6d" stroke="#84562c" stroke-width="3"/>' +
      '<ellipse cx="43" cy="18" rx="21" ry="6" fill="#f5d799" stroke="#966834" stroke-width="2"/><path d="M30 18Q40 21 54 17" fill="none" stroke="#ba904f" stroke-width="2"/><path d="M40 15V8Q43 4 46 8V15" fill="#ad7440" stroke="#77512e" stroke-width="2"/></g>' +
      '<g class="qp-map-pot-spark" fill="#fff9b0"><path d="M43 22L47 34L59 38L47 42L43 54L39 42L27 38L39 34Z"/><path d="M15 8L18 15L25 18L18 21L15 28L12 21L5 18L12 15Z"/><path d="M72 2L75 9L82 12L75 15L72 22L69 15L62 12L69 9Z"/></g></svg>';
  }

  function npcArt(region) {
    const base = '<svg viewBox="0 0 86 100" aria-hidden="true" focusable="false"><ellipse cx="43" cy="91" rx="29" ry="7" fill="#243a4438"/>';
    const arrow = '<g class="qp-map-quest-arrow" fill="#ffe557" stroke="#ab691e" stroke-width="2"><path d="M36-17H50V-7H58L43 8L28-7H36Z"/><path d="M39-14H47" stroke="#fff8b2" stroke-width="3"/></g>';
    if (region === 'desert') return base + '<path d="M30 82V40Q30 22 43 22Q56 22 56 40V83Z" fill="#72ad60" stroke="#3f7548" stroke-width="3"/><path d="M31 61H19Q13 61 13 53V43Q13 37 19 37Q24 37 24 43V49H31M56 51H65V33Q65 28 71 28Q77 28 77 35V54Q77 64 56 64" fill="#72ad60" stroke="#3f7548" stroke-width="3"/><path d="M38 31V73M49 31V70" stroke="#b4d781" stroke-width="3" stroke-linecap="round"/><path d="M35 83L30 92H39M49 83L55 92H46" stroke="#765a3d" stroke-width="6" stroke-linecap="round"/><path d="M30 59Q43 65 57 58L55 72Q43 78 32 71Z" fill="#efc87a" stroke="#b7793d" stroke-width="2"/><circle cx="37" cy="44" r="3" fill="#253e31"/><circle cx="50" cy="44" r="3" fill="#253e31"/><path d="M39 52Q43 55 47 51" fill="none" stroke="#315d3d" stroke-width="2" stroke-linecap="round"/><path d="M25 27Q45 15 64 27L58 31H28Z" fill="#eeaf69" stroke="#9b633d" stroke-width="2"/><path d="M33 22Q31 9 45 11Q53 10 56 24" fill="#f7ca82" stroke="#9b633d" stroke-width="2"/>' + arrow + '</svg>';
    if (region === 'forest') return base + '<path d="M26 85Q26 63 34 54H54Q64 64 63 84Z" fill="#e8e0ba" stroke="#84734b" stroke-width="3"/><path d="M28 73L18 76M60 73L70 76" stroke="#d6bd82" stroke-width="7" stroke-linecap="round"/><path d="M33 84L30 92H40M54 84L58 92H49" stroke="#a17446" stroke-width="6" stroke-linecap="round"/><ellipse cx="43" cy="50" rx="32" ry="12" fill="#bc724f" stroke="#7b553a" stroke-width="3"/><path d="M12 47Q17 10 43 14Q70 10 75 47Q47 56 12 47Z" fill="#dc8666" stroke="#85523f" stroke-width="3"/><path d="M19 39Q27 20 41 21" fill="none" stroke="#f7b28c" stroke-width="5" stroke-linecap="round"/><ellipse cx="28" cy="32" rx="6" ry="5" fill="#fff1c7"/><ellipse cx="56" cy="26" rx="7" ry="5" fill="#fff1c7"/><ellipse cx="63" cy="42" rx="5" ry="4" fill="#fce1b4"/><circle cx="37" cy="65" r="3" fill="#514b38"/><circle cx="51" cy="65" r="3" fill="#514b38"/><path d="M40 73Q44 76 48 72" fill="none" stroke="#81573e" stroke-width="2"/>' + arrow + '</svg>';
    if (region === 'lava') return base + '<path d="M25 85Q26 62 35 56H52Q61 62 63 85Z" fill="#7b638e" stroke="#4b3b65" stroke-width="3"/><path d="M29 66L20 77M59 66L69 75" stroke="#b797c7" stroke-width="7" stroke-linecap="round"/><path d="M33 84L30 92H40M53 84L57 92H48" stroke="#534057" stroke-width="6" stroke-linecap="round"/><path d="M22 35L26 17L37 30M52 30L64 17L67 39" fill="#d4bba8" stroke="#8a6e67" stroke-width="3"/><ellipse cx="44" cy="45" rx="25" ry="21" fill="#e9d2b0" stroke="#927669" stroke-width="3"/><path d="M15 33L31 22L37 2L52 9L58 28L72 34Q45 43 15 33Z" fill="#6f608c" stroke="#443956" stroke-width="3"/><path d="M25 30Q43 35 62 31" stroke="#dfba65" stroke-width="5" fill="none"/><path d="M47 9L42 24" stroke="#9686aa" stroke-width="4" stroke-linecap="round"/><circle cx="35" cy="45" r="3" fill="#453e3d"/><circle cx="53" cy="45" r="3" fill="#453e3d"/><path d="M41 52L44 55L47 52M44 55V58" fill="none" stroke="#976e67" stroke-width="2"/><path d="M23 51L31 53M23 56L32 56M57 52L65 50M57 57L66 57" stroke="#9b806a" stroke-width="1.5"/><path d="M70 88V51" stroke="#95713c" stroke-width="4"/><path d="M70 39L78 49L70 59L62 49Z" fill="#f7b852" stroke="#ad7634" stroke-width="2"/>' + arrow + '</svg>';
    return base + '<path d="M27 63Q43 54 59 63L61 84H25Z" fill="#c0c7ce" stroke="#626c7d" stroke-width="3"/><path d="M29 64L20 78M57 64L66 78" stroke="#959dad" stroke-width="9" stroke-linecap="round"/><path d="M33 84L29 93H40M52 84L57 93H47" stroke="#687384" stroke-width="7" stroke-linecap="round"/><path d="M28 70L43 77L58 69M43 62V83" fill="none" stroke="#e9e8d9" stroke-width="3"/><path d="M42 21Q43 10 54 7Q65 9 61 16Q51 17 49 28" fill="#9872b6" stroke="#614c80" stroke-width="2"/><path d="M22 46Q22 25 42 24Q64 25 66 45V56Q42 69 22 56Z" fill="#c8ced1" stroke="#657182" stroke-width="3"/><path d="M27 33Q39 26 51 30" fill="none" stroke="#f6f3dc" stroke-width="4" stroke-linecap="round"/><path d="M24 44H64V55Q43 61 24 55Z" fill="#727e8d" stroke="#526071" stroke-width="2"/><path d="M34 45V54M43 45V55M52 45V54" stroke="#d7dfda" stroke-width="3"/><path d="M16 67L27 64L32 78L21 90L12 79Z" fill="#9d80b0" stroke="#5f5178" stroke-width="3"/><path d="M19 71L24 76L20 82L16 77Z" fill="#f0d58a"/>' + arrow + '</svg>';
  }

  function adventureScenery(width, height, objects, uid) {
    const rnd = random(5099 + objects.length), obstacles = [];
    const near = (x, y, radius) => objects.some(o => Math.hypot(x - o.x, y - o.y) < radius + 78) || Math.hypot(x - 960, y - 680) < radius + 105;
    const svg = document.createElementNS(NS, 'svg'); svg.classList.add('qp-map-scenery');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height); svg.setAttribute('aria-hidden', 'true');
    const sandY = height * .63;
    let html = '<defs><linearGradient id="' + uid + '-land" x2=".4" y2="1"><stop stop-color="#83b574"/><stop offset="1" stop-color="#a9c084"/></linearGradient><linearGradient id="' + uid + '-sand" x2=".2" y2="1"><stop stop-color="#ecd594"/><stop offset="1" stop-color="#dcb775"/></linearGradient><linearGradient id="' + uid + '-lava" x2=".4" y2="1"><stop stop-color="#ffdf74"/><stop offset=".35" stop-color="#ff9b46"/><stop offset="1" stop-color="#d84f3c"/></linearGradient><radialGradient id="' + uid + '-leaves" cx=".3" cy=".3"><stop stop-color="#b8d879"/><stop offset=".55" stop-color="#69a466"/><stop offset="1" stop-color="#3e7754"/></radialGradient><pattern id="' + uid + '-paving" width="94" height="65" patternUnits="userSpaceOnUse"><rect width="94" height="65" fill="#b5bbb1"/><path d="M0 1H94M0 64H94M1 0V65M47 0V32M0 32H94M75 32V65M25 32V65" stroke="#7c8b87" stroke-width="3"/><path d="M4 6H43M51 6H88M5 38H20M29 38H69" stroke="#e5e4c8" stroke-width="3" opacity=".6"/></pattern><g id="' + uid + '-pine"><ellipse cy="14" rx="56" ry="22" fill="#305b4040"/><path d="M-9-22L-11 13H12L8-22" fill="#a47b4a" stroke="#6c5639" stroke-width="3"/><path d="M-48-13Q-62-35-43-52Q-56-76-24-86Q-5-111 17-91Q45-100 50-73Q74-60 55-39Q66-11 34-9Q6 13-13-4Q-38 7-48-13Z" fill="url(#' + uid + '-leaves)" stroke="#3f7251" stroke-width="3"/><path d="M-38-48Q-21-67-6-57Q9-75 29-60M-20-26Q-3-38 12-26" stroke="#d0e798" stroke-width="6" opacity=".35" fill="none" stroke-linecap="round"/></g><g id="' + uid + '-cactus"><ellipse cy="13" rx="30" ry="10" fill="#9b824336"/><path d="M-10 12V-55Q0-67 10-55V12Z" fill="#87aa63" stroke="#607c49" stroke-width="3"/><path d="M-10-12H-24V-29M10-29H24V-44" stroke="#607c49" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M-10-12H-24V-29M10-29H24V-44" stroke="#9ab870" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M0-50V4" stroke="#c9d392" stroke-width="3"/><path d="M-4-55Q0-69 8-61" stroke="#ebae88" stroke-width="7" stroke-linecap="round"/></g></defs>';
    html += '<rect width="' + width + '" height="' + height + '" fill="url(#' + uid + '-land)"/><path d="M0 0H560Q480 270 600 510Q505 720 590 ' + sandY + 'H0Z" fill="#686c69"/><path d="M0 0H470Q530 240 410 350Q540 570 385 770L0 880Z" fill="#7b7872"/><path d="M1480 0H1920V' + (sandY + 40) + 'Q1660 920 1480 790Q1380 630 1440 380Z" fill="#548769"/><path d="M1510 15H1920V' + (sandY - 20) + 'Q1680 880 1540 730Q1450 570 1520 360Z" fill="#89b17a" stroke="#426e52" stroke-width="10"/><path d="M0 ' + sandY + 'Q490 ' + (sandY - 60) + ' 980 ' + (sandY + 10) + 'T1920 ' + (sandY - 35) + 'V' + height + 'H0Z" fill="url(#' + uid + '-sand)"/>';
    html += '<path d="M600 130Q950 310 1360 165M970 300V' + (height - 130) + '" fill="none" stroke="#d0c392" stroke-width="104" stroke-linecap="round"/><path d="M600 130Q950 310 1360 165M970 300V' + (height - 130) + '" fill="none" stroke="#e6d6aa" stroke-width="83" stroke-linecap="round"/><rect x="665" y="340" width="650" height="510" rx="22" fill="url(#' + uid + '-paving)" stroke="#687c79" stroke-width="15"/>';
    // Low courtyard walls have real gaps at both entrances; a decorative fortress
    // above the courtyard is solid so avatars cannot cross through stone masonry.
    const wallRects = [{ x: 624, y: 319, w: 35, h: 520 }, { x: 1321, y: 319, w: 35, h: 520 },
      { x: 624, y: 834, w: 242, h: 37 }, { x: 1086, y: 834, w: 270, h: 37 },
      { x: 644, y: 182, w: 256, h: 153 }, { x: 1070, y: 182, w: 266, h: 153 }];
    wallRects.forEach(w => { obstacles.push({ rect: w }); html += '<rect x="' + w.x + '" y="' + w.y + '" width="' + w.w + '" height="' + w.h + '" rx="7" fill="url(#' + uid + '-paving)" stroke="#667874" stroke-width="5"/><path d="M' + (w.x + 5) + ' ' + (w.y + 6) + 'H' + (w.x + w.w - 5) + '" stroke="#e2dec0" stroke-width="5"/>'; });
    for (const tx of [625, 865, 1095, 1340]) {
      html += '<g transform="translate(' + tx + ' 188)"><ellipse cy="133" rx="39" ry="14" fill="#43574e38"/><rect x="-34" y="-50" width="68" height="168" rx="7" fill="url(#' + uid + '-paving)" stroke="#60766e" stroke-width="5"/><path d="M-41-50V-75H-24V-61H-8V-75H9V-61H25V-75H41V-50Z" fill="#c7c8b8" stroke="#637970" stroke-width="4"/><path d="M-9-4Q0-15 9-4V24H-9Z" fill="#4f665f" stroke="#7f9384" stroke-width="3"/><path d="M-32 33H32V90L0 107L-32 90Z" fill="#8e78b0" stroke="#655485" stroke-width="3"/><path d="M0 47L9 62L0 76L-9 62Z" fill="#e9d68d"/></g>';
    }
    html += '<path d="M900 182Q985 137 1070 182V232H1050V214Q985 176 922 214V232H900Z" fill="url(#' + uid + '-paving)" stroke="#63766e" stroke-width="5"/><path d="M902 335V242Q901 222 924 222H950V335M1046 335V222H1062Q1082 226 1082 244V335" fill="#a57647" stroke="#71563c" stroke-width="5"/><path d="M914 238V320M930 233V320M1060 236V320" stroke="#c69b68" stroke-width="3"/><path d="M907 266H943M1051 266H1077" stroke="#544f42" stroke-width="6"/>';
    html += '<path d="M72 260L138 130L205 152L257 86L318 162L376 137L461 286Q316 337 72 260Z" fill="#615f5e" stroke="#4f5554" stroke-width="7"/><path d="M144 144L204 164L260 100L312 175L366 151L334 225L185 233Z" fill="#8b7670"/><ellipse cx="261" cy="137" rx="57" ry="18" fill="#ba654c" stroke="#595854" stroke-width="6"/><ellipse cx="261" cy="135" rx="42" ry="10" fill="#ffc368"/><path d="M247 150Q277 250 246 330T292 528T226 752" fill="none" stroke="#544e4b" stroke-width="68" stroke-linecap="round"/><path d="M247 150Q277 250 246 330T292 528T226 752" fill="none" stroke="url(#' + uid + '-lava)" stroke-width="43" stroke-linecap="round"/><path d="M245 159Q264 246 237 330T278 528T222 742" fill="none" stroke="#ffdd7c" stroke-width="9" stroke-linecap="round" opacity=".78"/>';
    // Lava has cooled stepping islands and is scenery; the rocks, forest roots and
    // courtyard walls are the physical obstacles, keeping every region reachable.
    for (let i = 0; i < 42; i++) {
      const px = 45 + rnd() * 480, py = 350 + rnd() * (sandY - 410), r = 16 + rnd() * 23;
      if (near(px, py, r)) continue;
      obstacles.push({ x: px, y: py, radius: r });
      html += '<g transform="translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ')"><ellipse cy="8" rx="' + (r + 7).toFixed(1) + '" ry="14" fill="#393f3b38"/><path d="M-' + r.toFixed(1) + ' 5L-' + (r * .7).toFixed(1) + '-' + (r * .8).toFixed(1) + 'L3-' + r.toFixed(1) + 'L' + r.toFixed(1) + '-5L' + (r * .7).toFixed(1) + ' 10Z" fill="#555e5b" stroke="#404b49" stroke-width="3"/><path d="M-' + (r * .7).toFixed(1) + '-' + (r * .8).toFixed(1) + 'L2-5L' + r.toFixed(1) + '-5" stroke="#929084" stroke-width="3" fill="none"/></g>';
    }
    for (let py = 80; py < sandY - 55; py += 116) for (let px = 1480; px < width - 40; px += 116) {
      const tx = px + (rnd() - .5) * 42, ty = py + (rnd() - .5) * 35;
      if (near(tx, ty, 30)) continue;
      obstacles.push({ x: tx, y: ty, radius: 24 });
      html += '<use href="#' + uid + '-pine" transform="translate(' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ') scale(' + (.8 + rnd() * .25).toFixed(2) + ')"/>';
    }
    for (let i = 0; i < 35; i++) {
      const px = 90 + rnd() * (width - 180), py = sandY + 70 + rnd() * (height - sandY - 120);
      if (near(px, py, 28)) continue;
      obstacles.push({ x: px, y: py, radius: 22 });
      if (i % 3) html += '<use href="#' + uid + '-cactus" transform="translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ')"/>';
      else html += '<g transform="translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ')"><ellipse cy="9" rx="38" ry="13" fill="#ab874838"/><path d="M-35 5L-27-26L-5-41L26-29L37 8Z" fill="#ba7957" stroke="#996043" stroke-width="3"/><path d="M-25-25L0-18L25-28M0-18L7 5" stroke="#e2a475" stroke-width="4" fill="none"/></g>';
    }
    for (let i = 0; i < 350; i++) {
      const px = rnd() * width, py = rnd() * height;
      if (px > 620 && px < 1360 && py > 150 && py < 890) continue;
      html += '<path d="M' + px.toFixed(1) + ' ' + py.toFixed(1) + 'l-3-4m3 4l4-6" fill="none" stroke="' + (py > sandY ? '#b2915960' : px < 590 ? '#a5a39555' : '#477d4b66') + '" stroke-width="2" stroke-linecap="round"/>';
    }
    svg.innerHTML = html; return { svg, obstacles };
  }

  function boxArt() {
    return '<svg viewBox="0 0 86 100" aria-hidden="true" focusable="false"><ellipse cx="43" cy="91" rx="33" ry="8" fill="#593f3033"/><g class="qp-map-pot-body"><path d="M13 38L62 30L76 42V84L28 94L13 81Z" fill="#c38750" stroke="#795033" stroke-width="3"/><path d="M28 52L76 42V84L28 94Z" fill="#dfa968" stroke="#795033" stroke-width="3"/><path d="M13 38L28 52L76 42L62 30Z" fill="#f1c989" stroke="#906137" stroke-width="3"/><path d="M20 43V78M34 51V85M70 49V79M28 60L75 51M28 83L75 74" fill="none" stroke="#efc38a" stroke-width="4"/><path d="M14 40L27 52L27 62L14 50M28 82L39 80V91L28 93M66 43L76 42V52L66 54M66 76L76 74V84L66 86" fill="#8d754d" stroke="#66533b" stroke-width="1.5"/><path d="M46 57Q57 50 61 60Q64 67 55 69V74" fill="none" stroke="#fff6cf" stroke-width="5" stroke-linecap="round"/><circle cx="54" cy="81" r="3" fill="#fff6cf"/><path d="M35 35L43 26L55 32L47 42Z" fill="#9baa61" stroke="#677d40" stroke-width="2"/></g><g class="qp-map-pot-spark" fill="#fff2a5"><path d="M43 18L47 31L60 35L47 39L43 52L39 39L26 35L39 31Z"/></g></svg>';
  }

  function autumnScenery(height, objects, uid) {
    const art = scenery(routeFor(0), height, objects, false, uid, true);
    const group = document.createElementNS(NS, 'g');
    let html = '';
    function fence(x1, y1, x2, y2) {
      const length = Math.hypot(x2 - x1, y2 - y1), angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      html += '<g transform="translate(' + x1 + ' ' + y1 + ') rotate(' + angle + ')"><path d="M0-9H' + length + 'M0 8H' + length + '" stroke="#785738" stroke-width="10"/><path d="M0-12H' + length + 'M0 5H' + length + '" stroke="#c79b59" stroke-width="5"/>';
      for (let s = 0; s <= length; s += 47) html += '<path d="M' + (s - 7) + ' 20V-23L' + s + '-31L' + (s + 7) + '-23V20Z" fill="#d5ad6e" stroke="#86613b" stroke-width="2"/><path d="M' + (s - 3) + '-21V16" stroke="#edd39a" stroke-width="3"/>';
      html += '</g>';
    }
    fence(93, 110, 1187, 110); fence(93, 110, 93, height - 85); fence(1187, 110, 1187, height - 85); fence(93, height - 85, 1187, height - 85);
    const walls = [{ x: 82, y: 98, w: 1117, h: 24 }, { x: 82, y: 98, w: 24, h: height - 173 },
      { x: 1175, y: 98, w: 24, h: height - 173 }, { x: 82, y: height - 97, w: 1117, h: 24 }];
    walls.forEach(rect => art.obstacles.push({ rect }));
    for (const p of [{ x: 330, y: 205 }, { x: 963, y: 205 }]) {
      html += '<g transform="translate(' + p.x + ' ' + p.y + ')"><ellipse cy="23" rx="92" ry="27" fill="#72543c22"/><path d="M-60 8L-65 43M60 8L65 43M-53-32L-62 8M54-32L63 8" stroke="#77583e" stroke-width="7"/><rect x="-77" y="7" width="154" height="15" rx="5" fill="#c29258" stroke="#805b37" stroke-width="3"/><rect x="-68" y="-42" width="136" height="42" rx="5" fill="#ddb17a" stroke="#805b37" stroke-width="3"/><path d="M-66-31H66M-66-17H66" stroke="#ba8752" stroke-width="2"/><path d="M-20-39H36V-3H-20Z" fill="#f4debb"/><path d="M-20-27H36M-20-13H36M-6-39V-3M21-39V-3" stroke="#ce8372" stroke-width="6" opacity=".8"/><ellipse cx="7" cy="-24" rx="12" ry="8" fill="#fff4d2" stroke="#c5a374" stroke-width="2"/><circle cx="5" cy="-25" r="5" fill="#e79758"/></g>';
      if (!objects.some(o => distance(o, p) < 100)) art.obstacles.push({ rect: { x: p.x - 77, y: p.y - 42, w: 154, h: 70 } });
    }
    const leafRandom = random(809);
    for (let i = 0; i < 75; i++) {
      const px = 125 + leafRandom() * 1010, py = 140 + leafRandom() * (height - 260);
      html += '<path d="M' + px.toFixed(1) + ' ' + py.toFixed(1) + 'q-9-9-14 0q4 12 14 0q8-8 13-1q-3 10-13 1" fill="' + ['#d09b4f','#dfb65b','#ba7d50'][i % 3] + '" opacity=".8"/>';
    }
    group.innerHTML = html; art.svg.appendChild(group); return art;
  }

  // All foliage below is drawn for this game; there are no reference-image crops.
  function scenery(route, height, objects, sequence, uid, autumn) {
    const rnd = random(719 + objects.length * 17 + (sequence ? 91 : 0)), trees = [], rocks = [];
    const nearObject = p => objects.some(o => distance(p, o) < 102) || distance(p, { x: 245, y: 210 }) < 115;
    for (let y = 22; y < height; y += 104) for (let x = 30; x < WIDTH; x += 108) {
      const p = { x: x + (rnd() - .5) * 43, y: y + (rnd() - .5) * 45 };
      const border = x < 100 || x > WIDTH - 140 || y < 70 || y > height - 100;
      if (sequence && project(route, p.x, p.y).distance < 112) continue;
      if (autumn && p.x > 135 && p.x < WIDTH - 135 && p.y > 145 && p.y < height - 140) continue;
      if (!sequence && (!border && rnd() > .32 || nearObject(p))) continue;
      p.scale = .78 + rnd() * .39; p.variant = rnd() > .42 ? 0 : 1;
      trees.push(p);
    }
    if (!sequence) for (let i = 0; i < Math.ceil(height / 110); i++) {
      const p = { x: 110 + rnd() * 1060, y: 90 + rnd() * (height - 180), radius: 24 + rnd() * 10 };
      if (!nearObject(p) && !trees.some(t => distance(t, p) < 75)) rocks.push(p);
    }
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('qp-map-scenery'); svg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + height);
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const grass = uid + '-grass', crown = uid + '-crown', trunk = uid + '-trunk', flower = uid + '-flower';
    let html = '<defs><linearGradient id="' + grass + '" x2=".45" y2="1"><stop stop-color="' + (autumn ? '#bcc184' : '#7cad57') + '"/><stop offset=".5" stop-color="' + (autumn ? '#c4bf8c' : '#83b962') + '"/><stop offset="1" stop-color="' + (autumn ? '#a8ad70' : '#5a934e') + '"/></linearGradient>' +
      '<radialGradient id="' + crown + '" cx=".35" cy=".28" r=".8"><stop stop-color="' + (autumn ? '#f2d687' : '#a5cc66') + '"/><stop offset=".42" stop-color="' + (autumn ? '#d2ab5c' : '#6eaa4a') + '"/><stop offset="1" stop-color="' + (autumn ? '#a47349' : '#326847') + '"/></radialGradient>' +
      '<linearGradient id="' + trunk + '" x2="1" y2=".2"><stop stop-color="#624328"/><stop offset=".5" stop-color="#a07c48"/><stop offset="1" stop-color="#644728"/></linearGradient>' +
      '<pattern id="' + uid + '-tufts" width="92" height="83" patternUnits="userSpaceOnUse"><path d="M12 22l-3-6m3 6l4-10m34 42l-4-6m4 6l2-9m24-35l-4-7m4 7l5-5" stroke="#3a754136" stroke-width="2" stroke-linecap="round"/><path d="M25 68l2-5m0 5l5-4m31-35l4-4" stroke="#d3e89b70" stroke-width="2" stroke-linecap="round"/><ellipse cx="38" cy="14" rx="2" ry="1" fill="#cae2a158"/></pattern>' +
      '<g id="' + uid + '-tree"><ellipse cx="0" cy="11" rx="54" ry="22" fill="#254e3b33"/><path d="M-10-20L-12 8L-23 17L-2 11L14 17L8 5L9-23" fill="url(#' + trunk + ')" stroke="#5c492a" stroke-width="3"/><path d="M0-24L-1 9M4-4L8 5M-5 0L-12 8" fill="none" stroke="#ccb47b" stroke-width="2" opacity=".45"/>' +
      '<path d="M-51-37Q-69-62-43-73Q-49-98-17-97Q-4-120 21-101Q49-109 56-80Q79-73 65-48Q73-23 42-21Q25-7 3-17Q-27-3-40-26Q-58-23-51-37Z" fill="url(#' + crown + ')" stroke="#386d41" stroke-width="3"/>' +
      '<path d="M-43-60Q-27-83-10-73Q3-91 23-77Q36-88 47-69M-29-41Q-12-53 0-43Q20-54 35-44" fill="none" stroke="#c1dd7d" stroke-width="7" stroke-linecap="round" opacity=".32"/><path d="M-45-35Q-32-26-17-30M12-25Q37-22 48-39M-11-87Q1-98 15-89" fill="none" stroke="#315f3c" stroke-width="4" stroke-linecap="round" opacity=".45"/>' +
      '<g fill="#e6efad" opacity=".38"><ellipse cx="-24" cy="-85" rx="8" ry="3" transform="rotate(-28 -24 -85)"/><ellipse cx="29" cy="-91" rx="6" ry="3"/><ellipse cx="-40" cy="-51" rx="6" ry="2"/></g></g>' +
      '<g id="' + flower + '"><path d="M0 0V9M0 6L-4 4" stroke="#477c3b" stroke-width="2"/><g fill="#fff2c5"><circle cx="-3" cy="-2" r="3"/><circle cx="2" cy="-4" r="3"/><circle cx="4" cy="1" r="3"/><circle cx="-1" cy="3" r="3"/></g><circle r="2" fill="#d6a53b"/></g></defs>' +
      '<rect width="1280" height="' + height + '" fill="url(#' + grass + ')"/><rect width="1280" height="' + height + '" fill="url(#' + uid + '-tufts)"/>';
    if (autumn) html += '<ellipse cx="640" cy="' + (height * .48) + '" rx="530" ry="' + (height * .38) + '" fill="#ead49c" opacity=".7"/><path d="M150 130Q640 185 1120 135L1130 ' + (height - 130) + 'Q620 ' + (height - 175) + ' 155 ' + (height - 125) + 'Z" fill="#b3bd78" opacity=".35"/>';
    for (let i = 0; i < Math.ceil(height / 130); i++) html += '<ellipse cx="' + (120 + rnd() * 1040).toFixed(1) + '" cy="' + (rnd() * height).toFixed(1) + '" rx="' + (80 + rnd() * 160).toFixed(1) + '" ry="' + (42 + rnd() * 65).toFixed(1) + '" fill="' + (i % 2 ? '#d4e59d' : '#477d42') + '" opacity=".12"/>';
    if (sequence) {
      const d = route.points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
      html += '<path d="' + d + '" fill="none" stroke="#447d453f" stroke-width="138" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#7b9350" stroke-width="123" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#c2ad78" stroke-width="116" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#e3cc91" stroke-width="104" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#f5dfaa" stroke-width="70" stroke-linecap="round" stroke-linejoin="round" opacity=".32"/>';
      for (let s = 25; s < route.length; s += 41) {
        const p = along(route, s), angle = p.angle * Math.PI / 180, side = (rnd() > .5 ? 1 : -1) * (43 + rnd() * 7);
        html += '<ellipse cx="' + (p.x - Math.sin(angle) * side).toFixed(1) + '" cy="' + (p.y + Math.cos(angle) * side).toFixed(1) + '" rx="3.7" ry="2" fill="#968758" opacity=".5"/>';
      }
      for (const side of [-1, 1]) {
        const rail = [], posts = [];
        for (let s = 0; s <= route.length; s += 18) {
          const p = along(route, s), angle = p.angle * Math.PI / 180;
          const px = p.x - Math.sin(angle) * 71 * side, py = p.y + Math.cos(angle) * 71 * side;
          rail.push((rail.length ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1));
          if (Math.round(s / 18) % 4 === 0) posts.push({ x: px, y: py });
        }
        html += '<path d="' + rail.join(' ') + '" fill="none" stroke="#59614244" stroke-width="10" stroke-linecap="round"/><path d="' + rail.join(' ') + '" fill="none" stroke="#a98251" stroke-width="6" stroke-linecap="round"/><path d="' + rail.join(' ') + '" fill="none" stroke="#ddbd7e" stroke-width="2" stroke-linecap="round"/>';
        posts.forEach(p => { html += '<ellipse cx="' + p.x.toFixed(1) + '" cy="' + (p.y + 2).toFixed(1) + '" rx="8" ry="7" fill="#805c37"/><ellipse cx="' + p.x.toFixed(1) + '" cy="' + (p.y - 2).toFixed(1) + '" rx="7" ry="6" fill="#e0be81" stroke="#9c7447" stroke-width="2"/>'; });
      }
    } else {
      html += '<path d="M245 210Q620 260 980 185M600 230Q490 490 770 690T520 ' + (height - 120) + '" fill="none" stroke="#c9c180" stroke-width="74" stroke-linecap="round" opacity=".48"/><path d="M245 210Q620 260 980 185M600 230Q490 490 770 690T520 ' + (height - 120) + '" fill="none" stroke="#e7d8a0" stroke-width="58" stroke-linecap="round" opacity=".36"/>';
    }
    for (let i = 0; i < Math.ceil(height / 4); i++) {
      const p = { x: 28 + rnd() * 1224, y: 35 + rnd() * (height - 70) };
      if (sequence && project(route, p.x, p.y).distance < 66) continue;
      html += '<use href="#' + flower + '" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" transform="rotate(' + ((rnd() - .5) * 35).toFixed(1) + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')" opacity="' + (.45 + rnd() * .45).toFixed(2) + '"/>';
    }
    rocks.forEach(p => {
      html += '<g transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')"><ellipse cy="6" rx="' + (p.radius + 8).toFixed(1) + '" ry="14" fill="#35594133"/><path d="M-27 3L-24-15L-10-27L14-25L28-7L24 8L-8 12Z" fill="#919d88" stroke="#637766" stroke-width="3"/><path d="M-24-15L-8-7L14-25M-8-7L24 8" fill="none" stroke="#bac2a4" stroke-width="3"/><path d="M-21 4Q-3-7 18 5" fill="none" stroke="#709452" stroke-width="8" stroke-linecap="round"/></g>';
    });
    trees.sort((a, b) => a.y - b.y).forEach(p => {
      html += '<use href="#' + uid + '-tree" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') scale(' + p.scale.toFixed(2) + ')"' + (p.variant ? ' style="filter:hue-rotate(-12deg)"' : '') + '/>';
    });
    svg.innerHTML = html;
    return { svg, obstacles: trees.map(p => ({ x: p.x, y: p.y, radius: 21 * p.scale })).concat(rocks) };
  }

  function mount(container, options) {
    if (!container || !container.appendChild) throw new TypeError('QPQuizMap.mount needs a container');
    options = options || {};
    const uid = 'qpforest-' + (++serial), mode = MODES.has(options.mode) ? options.mode : 'free';
    const questions = Array.isArray(options.questions) ? options.questions.slice() : [], sequence = mode === 'sequence';
    const terrain = sequence ? 'forest-path' : ['forest', 'adventure', 'autumn'].includes(options.terrain) ? options.terrain : mode === 'free' ? 'adventure' : mode === 'team' ? 'autumn' : 'forest';
    const adventure = terrain === 'adventure', autumn = terrain === 'autumn';
    const width = adventure ? 1920 : WIDTH;
    const route = routeFor(questions.length), height = sequence ? Math.max(580, route.height) : Math.max(adventure ? 1440 : 920, Math.ceil(questions.length / 5) * (adventure ? 225 : 190) + (adventure || autumn ? 390 : 270));
    const objects = questions.map((question, index) => {
      if (sequence) return Object.assign({ index }, along(route, route.length * (index + 1) / (questions.length + 1)));
      if (adventure) {
        const region = ['lava', 'castle', 'forest', 'desert'][index % 4], ordinal = Math.floor(index / 4);
        const cols = region === 'desert' ? 3 : 2, col = ordinal % cols, row = Math.floor(ordinal / cols);
        const px = region === 'lava' ? 110 + col * 335 : region === 'castle' ? 795 + col * 380 : region === 'forest' ? 1525 + col * 265 : 380 + col * 580;
        const py = region === 'desert' ? height * .63 + 140 + row * 160 : (region === 'castle' ? 460 : 370) + row * (region === 'castle' ? 160 : 170);
        return { index, x: px + Math.sin(index * 1.73) * 15, y: py + Math.cos(index * 2.1) * 15, angle: 0, region };
      }
      const col = index % 5, row = Math.floor(index / 5);
      return { index, x: 165 + col * 225 + Math.sin(index * 1.73) * 28,
        y: 350 + row * 190 + Math.cos(index * 2.1) * 30, angle: 0 };
    });
    let completed = new Set(), destroyed = false, raf = 0, lastTime = 0, lastPositionTime = -Infinity;
    let lastPosition = null, interacting = false, nearest = null, phase = 0, wasPaused = false;
    let x = 0, y = 0, vx = 0, vy = 0, facing = 'right', action = 'idle', scale = 1;
    const keys = new Set(), pointers = new Map(), peers = new Map(), cleanups = [];
    const shell = element('section', 'qp-quiz-map qp-map-' + mode);
    shell.setAttribute('aria-label', adventure ? '움직이며 친구의 문제를 푸는 모험 지도' : autumn ? '문제 상자가 있는 가을 팀 소풍' : '움직이며 문제를 푸는 꿀단지 숲');
    const viewport = element('div', 'qp-map-viewport'); viewport.tabIndex = 0;
    viewport.setAttribute('role', 'application'); viewport.setAttribute('aria-label', '방향키 또는 WASD로 이동, 가까운 꿀단지는 E 또는 Enter로 열기');
    const world = element('div', 'qp-map-world'); world.style.width = width + 'px'; world.style.height = height + 'px';
    const art = adventure ? adventureScenery(width, height, objects, uid) : autumn ? autumnScenery(height, objects, uid) : scenery(route, height, objects, sequence, uid);
    const detail = adventure ? window.QPAdventureDetail : window.QPForestDetail;
    if (detail) {
      const extra = detail.decorate({ svg: art.svg, uid: uid + '-detail', width, height, terrain, objects,
        spawn: sequence ? along(route, 40) : { x: adventure ? 960 : autumn ? 640 : 245, y: adventure ? 500 : 255 },
        routeDistance: sequence ? (px, py) => project(route, px, py).distance : null });
      art.obstacles.push(...(extra?.obstacles || []));
    }
    window.QPMapPainted?.paintTrees(art.svg, terrain);
    world.appendChild(art.svg);
    const markerLayer = element('div', 'qp-map-object-layer'); world.appendChild(markerLayer);
    const actorLayer = element('div', 'qp-map-actor-layer'); world.appendChild(actorLayer);
    viewport.appendChild(world); shell.appendChild(viewport);
    const sign = element('div', 'qp-map-sign');
    sign.appendChild(element('strong', '', sequence ? '꿀단지 숲길' : adventure ? '친구들의 모험 나라' : autumn ? '우리 팀 가을 소풍' : '꿀단지 숲 탐험'));
    const count = element('span', 'qp-map-count'); sign.appendChild(count); shell.appendChild(sign);
    const objectWord = adventure ? '친구' : autumn ? '문제 상자' : '꿀단지';
    const openingWord = adventure ? '만나기' : '열기';
    const mapHint = sequence ? '숲길을 따라가며 꿀단지를 차례로 열어요' : adventure ? '나라 곳곳의 친구들을 원하는 순서로 만나요' : autumn ? '울타리 안의 문제 상자를 찾아 팀 점수를 모아요' : '가까운 꿀단지를 원하는 순서로 열어요';
    const hint = element('div', 'qp-map-hint', mapHint);
    shell.appendChild(hint);
    const live = element('div', 'qp-map-sr'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); shell.appendChild(live);
    let overviewDot = null;
    if (adventure) {
      const overview = element('div', 'qp-map-overview'); overview.setAttribute('aria-label', '화산, 성, 숲, 사막이 있는 모험 지도');
      if (options.onExit) overview.classList.add('has-exit');
      overview.innerHTML = '<svg viewBox="0 0 1920 ' + height + '" aria-hidden="true"><rect width="1920" height="' + height + '" rx="80" fill="#a0bd87"/><path d="M0 0H560V' + (height * .63) + 'H0Z" fill="#7c7770"/><path d="M1480 0H1920V' + (height * .63) + 'H1480Z" fill="#59966a"/><path d="M0 ' + (height * .63) + 'H1920V' + height + 'H0Z" fill="#eacb8e"/><path d="M960 180V' + (height - 120) + '" stroke="#e5d7b0" stroke-width="90"/><rect x="640" y="180" width="700" height="660" rx="30" fill="#babbb0" stroke="#6f857b" stroke-width="40"/><path d="M180 250L260 120L350 270Z" fill="#675f5b"/><path d="M245 170Q295 370 240 570" stroke="#f5ac5b" stroke-width="35" fill="none"/><circle class="qp-map-overview-dot" r="46" fill="#f16f63" stroke="#fff7d4" stroke-width="21"/></svg>';
      overviewDot = overview.querySelector('.qp-map-overview-dot'); shell.appendChild(overview);
    }
    const controls = element('div', 'qp-map-controls');
    const dpad = element('div', 'qp-map-dpad'); dpad.setAttribute('aria-label', '이동');
    const arrows = { up: '↑', left: '←', down: '↓', right: '→' };
    Object.entries(arrows).forEach(([direction, label]) => {
      const button = element('button', 'qp-map-step qp-map-step-' + direction, label); button.type = 'button';
      button.dataset.direction = direction; button.setAttribute('aria-label', { up: '위로 이동', left: '왼쪽으로 이동', down: '아래로 이동', right: '오른쪽으로 이동' }[direction]);
      dpad.appendChild(button);
    });
    controls.appendChild(dpad); controls.appendChild(element('span', 'qp-map-key-hint', '방향키 / WASD'));
    const interact = element('button', 'qp-map-interact'); interact.type = 'button'; interact.disabled = true;
    interact.appendChild(element('span', 'qp-map-interact-label', objectWord + ' 가까이 가요'));
    interact.appendChild(element('kbd', '', 'E / Enter')); controls.appendChild(interact); shell.appendChild(controls);
    if (typeof options.onExit === 'function') {
      const exit = element('button', 'qp-map-exit', '나가기'); exit.type = 'button';
      exit.addEventListener('click', options.onExit); shell.appendChild(exit);
    }
    container.appendChild(shell);

    function listen(target, type, callback, opts) {
      target.addEventListener(type, callback, opts);
      cleanups.push(() => target.removeEventListener(type, callback, opts));
    }
    function paused() { return document.hidden || !!document.querySelector('#modal.on') || !!(options.isPaused && options.isPaused()); }
    function targetObject() { return sequence ? objects.find(o => !completed.has(o.index)) || null : null; }
    function limit() { const target = targetObject(); return target ? Math.max(0, target.s - 25) : route.length; }
    function canStand(px, py) {
      if (px < 34 || py < 34 || px > width - 34 || py > height - 34) return false;
      if (sequence) {
        const p = project(route, px, py);
        return p.distance <= PATH_HALF - RADIUS && p.s <= limit() + .01;
      }
      return !art.obstacles.some(o => o.rect ? px > o.rect.x - RADIUS && px < o.rect.x + o.rect.w + RADIUS && py > o.rect.y - RADIUS && py < o.rect.y + o.rect.h + RADIUS : Math.hypot(px - o.x, py - o.y) < RADIUS + o.radius) &&
        !objects.some(o => !completed.has(o.index) && Math.hypot(px - o.x, py - o.y) < 27);
    }
    function avatar(html, name, own) {
      const node = element('div', 'qp-map-avatar' + (own ? ' qp-map-me' : ' qp-map-peer'));
      const shadow = element('i', 'qp-map-avatar-shadow'); shadow.setAttribute('aria-hidden', 'true'); node.appendChild(shadow);
      const figure = element('div', 'qp-map-avatar-figure'); figure.innerHTML = typeof html === 'string' ? html : '';
      node.appendChild(figure);
      const label = element('span', 'qp-map-avatar-name', name || (own ? '나' : '친구')); node.appendChild(label);
      const svg = figure.querySelector('svg');
      if (svg && window.QPAvatarPose) window.QPAvatarPose.prepare(svg);
      actorLayer.appendChild(node);
      return { node, figure, label, svg, html };
    }
    const me = avatar(options.avatarHTML, options.name, true);
    function setTeam(teamColor, name) {
      if (destroyed) return;
      me.node.style.setProperty('--qp-map-team-color', color(teamColor, '#467e62'));
      if (name !== undefined) me.label.textContent = String(name || '나');
    }
    setTeam(options.teamColor, options.name);
    objects.forEach(o => {
      const marker = element('div', 'qp-map-object'); marker.dataset.questionIndex = String(o.index);
      marker.style.left = o.x + 'px'; marker.style.top = o.y + 'px'; marker.style.zIndex = String(Math.round(o.y));
      marker.setAttribute('aria-label', (o.index + 1) + '번 ' + objectWord);
      if (sequence) {
        const barrier = element('div', 'qp-map-barrier'); barrier.style.transform = 'rotate(' + (o.angle + 90) + 'deg)';
        barrier.innerHTML = '<svg viewBox="0 0 140 32" aria-hidden="true"><path d="M5 16Q26 5 48 18T90 17T136 15" fill="none" stroke="#486e38" stroke-width="11" stroke-linecap="round"/><path d="M5 13Q26 2 48 15T90 14T136 12" fill="none" stroke="#a6bc5d" stroke-width="4" stroke-linecap="round"/><path d="M16 13Q21-6 33 1Q35 12 16 13M105 16Q111-2 124 5Q122 19 105 16M50 19Q46 35 32 28Q36 16 50 19M92 15Q89 31 77 26Q76 16 92 15" fill="#699d43" stroke="#3f723c" stroke-width="2"/></svg>';
        marker.appendChild(barrier);
      }
      const pot = element('div', 'qp-map-pot' + (adventure ? ' qp-map-npc' : '')); pot.innerHTML = adventure ? npcArt(o.region) : autumn ? boxArt() : honeyArt(uid + '-jar-' + o.index); marker.appendChild(pot);
      marker.appendChild(element('span', 'qp-map-object-number', String(o.index + 1)));
      markerLayer.appendChild(marker); o.node = marker;
    });

    function clearInput() { keys.clear(); pointers.clear(); vx = 0; vy = 0; action = 'idle'; dpad.querySelectorAll('.is-held').forEach(b => b.classList.remove('is-held')); }
    function publishPosition(time, force) {
      if (typeof options.onPosition !== 'function' || (!force && time - lastPositionTime < 200)) return;
      const state = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, facing };
      if (!lastPosition || state.x !== lastPosition.x || state.y !== lastPosition.y || state.facing !== lastPosition.facing) {
        lastPositionTime = time; lastPosition = state; options.onPosition(state);
      }
    }
    function updateNearby() {
      const target = targetObject(); let closest = null, best = INTERACT_DISTANCE;
      objects.forEach(o => {
        if (completed.has(o.index) || (sequence && o !== target)) return;
        const d = Math.hypot(x - o.x, y - o.y);
        if (d < best) { closest = o; best = d; }
      });
      if (nearest !== closest) {
        if (nearest) nearest.node.classList.remove('is-near'); nearest = closest;
        if (nearest) nearest.node.classList.add('is-near');
        interact.querySelector('.qp-map-interact-label').textContent = nearest ? objectWord + ' ' + (nearest.index + 1) + ' ' + openingWord :
          completed.size === questions.length && questions.length ? '모두 완료했어요!' : objectWord + ' 가까이 가요';
        live.textContent = nearest ? (nearest.index + 1) + '번 ' + objectWord + ' 가까이에 있어요. E 또는 Enter로 문제를 열어요.' : '';
      }
      interact.disabled = !nearest || paused();
    }
    function interactNow() {
      updateNearby();
      if (destroyed || interacting || paused() || !nearest) return false;
      interacting = true;
      try {
        clearInput();
        if (typeof options.onInteract === 'function') options.onInteract(nearest.index);
        return true;
      } finally { interacting = false; }
    }
    function draw() {
      if (destroyed) return;
      const rect = viewport.getBoundingClientRect(); scale = rect.width < 640 ? .86 : adventure ? .82 : 1;
      const cameraX = clamp(x * scale - rect.width / 2, 0, Math.max(0, width * scale - rect.width));
      const cameraY = clamp(y * scale - rect.height * .5, 0, Math.max(0, height * scale - rect.height));
      world.style.transform = 'translate(' + (-cameraX).toFixed(2) + 'px,' + (-cameraY).toFixed(2) + 'px) scale(' + scale + ')';
      me.node.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
      me.node.style.zIndex = String(Math.round(y));
      pose(me.svg, { action, facing, phase });
      if (overviewDot) { overviewDot.setAttribute('cx', x.toFixed(1)); overviewDot.setAttribute('cy', y.toFixed(1)); }
    }
    function setCompleted(indices, initial) {
      const next = new Set((Array.isArray(indices) ? indices : []).map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < questions.length));
      objects.forEach(o => {
        const done = next.has(o.index), changed = done !== completed.has(o.index);
        if (changed && done && !initial) {
          o.node.classList.add('is-opening');
          const end = () => o.node.classList.remove('is-opening');
          o.node.addEventListener('animationend', end, { once: true });
        }
        o.node.classList.toggle('is-complete', done);
        o.node.classList.toggle('is-resumed', !!initial && done);
        o.node.setAttribute('aria-label', (o.index + 1) + '번 ' + objectWord + (done ? ', 완료' : ''));
        o.node.setAttribute('aria-hidden', done ? 'true' : 'false');
      });
      completed = next;
      count.textContent = completed.size + ' / ' + questions.length + ' 완료';
      if (questions.length && completed.size === questions.length) {
        hint.textContent = '모든 문제를 풀었어요!'; interact.querySelector('.qp-map-interact-label').textContent = '모두 완료했어요!';
      } else hint.textContent = mapHint;
      if (!initial && sequence && project(route, x, y).s > limit()) { const p = along(route, limit()); x = p.x; y = p.y; }
      updateNearby(); draw();
    }
    function setPeers(list) {
      const seen = new Set();
      (Array.isArray(list) ? list : []).forEach((data, index) => {
        if (!data || data.id === options.playerId) return;
        const id = String(data.id === undefined ? 'peer-' + index : data.id); seen.add(id);
        let p = peers.get(id);
        if (!p || p.html !== data.avatarHTML) {
          if (p) { destroyPose(p.svg); p.node.remove(); }
          p = Object.assign(avatar(data.avatarHTML, data.name, false), { x: NaN, y: NaN, movedAt: 0, facing: 'right' }); peers.set(id, p);
        }
        const px = clamp(finite(data.x, adventure ? 960 : 245), 34, width - 34), py = clamp(finite(data.y, adventure ? 500 : 255), 34, height - 34);
        if (Math.hypot(px - p.x, py - p.y) > .5) p.movedAt = performance.now();
        p.x = px; p.y = py; p.facing = data.facing === 'left' ? 'left' : 'right';
        p.node.dataset.peerId = id; p.node.style.transform = 'translate(' + px + 'px,' + py + 'px)'; p.node.style.zIndex = String(Math.round(py));
        p.node.style.setProperty('--qp-map-team-color', color(data.color || data.teamColor, '#727e67'));
        p.label.textContent = String(data.name || '친구');
        if (data.team) p.label.title = String(data.team); else p.label.removeAttribute('title');
      });
      peers.forEach((p, id) => { if (!seen.has(id)) { destroyPose(p.svg); p.node.remove(); peers.delete(id); } });
    }
    function getState() {
      return { mode, terrain, x, y, vx, vy, facing, action, completed: Array.from(completed).sort((a, b) => a - b),
        nearbyIndex: nearest ? nearest.index : null, targetIndex: targetObject() ? targetObject().index : null,
        progress: sequence ? project(route, x, y).s : null, world: { width, height },
        objects: objects.map(o => ({ index: o.index, x: o.x, y: o.y, progress: sequence ? o.s : null, completed: completed.has(o.index) })) };
    }
    function moveTo(first, second) {
      if (destroyed) return false;
      const point = typeof first === 'object' && first ? first : { x: first, y: second };
      let px = finite(point.x, x), py = finite(point.y, y);
      if (sequence) { const p = along(route, Math.min(project(route, px, py).s, limit())); px = p.x; py = p.y; }
      if (!canStand(px, py)) return false;
      x = px; y = py; if (point.facing) facing = point.facing === 'left' ? 'left' : 'right';
      clearInput(); updateNearby(); draw(); return getState();
    }
    listen(viewport, 'pointerdown', () => { if (!paused()) viewport.focus({ preventScroll: true }); });
    listen(shell, 'keydown', event => {
      if (paused() || event.target !== viewport || event.ctrlKey || event.metaKey || event.altKey) return;
      const direction = KEYS[event.code];
      if (direction) { event.preventDefault(); keys.add(direction); }
      else if ((event.code === 'KeyE' || event.code === 'Enter') && !event.repeat) { event.preventDefault(); interactNow(); }
    });
    listen(window, 'keyup', event => { if (KEYS[event.code]) keys.delete(KEYS[event.code]); });
    listen(window, 'blur', clearInput); listen(document, 'visibilitychange', clearInput);
    listen(viewport, 'blur', clearInput);
    listen(interact, 'click', interactNow);
    function syncDpad() {
      const active = new Set(pointers.values());
      dpad.querySelectorAll('button').forEach(button => button.classList.toggle('is-held', active.has(button.dataset.direction)));
    }
    dpad.querySelectorAll('button').forEach(button => {
      listen(button, 'pointerdown', event => {
        if (paused() || event.button > 0) return;
        event.preventDefault(); viewport.focus({ preventScroll: true });
        pointers.set(event.pointerId, button.dataset.direction); button.classList.add('is-held');
        try { button.setPointerCapture(event.pointerId); } catch (_) { /* Old WebViews can omit capture. */ }
      });
      const release = event => {
        pointers.delete(event.pointerId); syncDpad();
      };
      listen(button, 'pointerup', release); listen(button, 'pointercancel', release); listen(button, 'lostpointercapture', release);
    });
    listen(document, 'pointerup', event => { pointers.delete(event.pointerId); syncDpad(); });
    listen(document, 'pointercancel', event => { pointers.delete(event.pointerId); syncDpad(); });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(draw); observer.observe(viewport); cleanups.push(() => observer.disconnect());
    } else listen(window, 'resize', draw);

    setCompleted(options.completed, true);
    const prefixTarget = targetObject(), start = sequence ? along(route, prefixTarget && completed.size ? Math.max(40, prefixTarget.s - 105) : 40) : { x: adventure ? 960 : autumn ? 640 : 245, y: adventure ? 500 : 255 };
    x = start.x; y = start.y;
    if (options.playerId && !options.position) {
      let seed = 0; for (const letter of String(options.playerId)) seed = (seed * 31 + letter.charCodeAt(0)) >>> 0;
      const spawnRandom = random(seed), offsetX = (spawnRandom() - .5) * 126, offsetY = (spawnRandom() - .5) * 58;
      if (sequence) {
        const p = along(route, clamp(start.s + offsetX * .3, 16, limit())), angle = p.angle * Math.PI / 180, side = offsetY * .4;
        const sx = p.x - Math.sin(angle) * side, sy = p.y + Math.cos(angle) * side;
        if (canStand(sx, sy)) { x = sx; y = sy; }
      } else if (canStand(x + offsetX, y + offsetY)) { x += offsetX; y += offsetY; }
    }
    if (options.position) moveTo(options.position);
    setPeers(options.peers); updateNearby(); draw();
    function focus() { if (!destroyed && !paused()) viewport.focus({ preventScroll: true }); }
    if (options.autofocus !== false && (!document.activeElement || document.activeElement === document.body || container.contains(document.activeElement))) focus();
    function frame(time) {
      if (destroyed) return;
      const dt = Math.min(.04, Math.max(0, (time - (lastTime || time)) / 1000)); lastTime = time;
      const stop = paused();
      if (wasPaused && !stop && options.autofocus !== false &&
        (!document.activeElement || document.activeElement === document.body || document.activeElement.closest('#modal'))) focus();
      if (stop) { if (!wasPaused) clearInput(); action = 'idle'; vx = 0; vy = 0; }
      else {
        const input = new Set([...keys, ...pointers.values()]);
        let dx = Number(input.has('right')) - Number(input.has('left'));
        let dy = Number(input.has('down')) - Number(input.has('up'));
        const length = Math.hypot(dx, dy); if (length) { dx /= length; dy /= length; }
        if (dx) facing = dx < 0 ? 'left' : 'right';
        const oldX = x, oldY = y;
        // Small substeps prevent tunnelling through a tree or a gate at low FPS.
        const steps = Math.max(1, Math.ceil(SPEED * dt / 5)), mx = dx * SPEED * dt / steps, my = dy * SPEED * dt / steps;
        for (let i = 0; i < steps; i++) {
          if (canStand(x + mx, y + my)) { x += mx; y += my; }
          else { if (canStand(x + mx, y)) x += mx; if (canStand(x, y + my)) y += my; }
        }
        vx = dt ? (x - oldX) / dt : 0; vy = dt ? (y - oldY) / dt : 0;
        action = Math.hypot(vx, vy) > .5 ? 'walk' : 'idle';
        if (action === 'walk') phase += dt * 2.7;
        publishPosition(time, false);
      }
      wasPaused = stop;
      peers.forEach(p => pose(p.svg, { action: !stop && time - p.movedAt < 350 ? 'walk' : 'idle', facing: p.facing, phase: time / 370 }));
      updateNearby(); draw(); raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(raf); clearInput(); cleanups.forEach(cleanup => cleanup());
      destroyPose(me.svg); peers.forEach(p => destroyPose(p.svg)); peers.clear(); shell.remove();
    }
    return Object.freeze({ destroy, setCompleted: indices => { if (!destroyed) setCompleted(indices, false); },
      setPeers: list => { if (!destroyed) setPeers(list); }, setTeam, getState, moveTo, focus,
      canStand: (px, py) => !destroyed && Number.isFinite(px) && Number.isFinite(py) && canStand(px, py) });
  }
  window.QPQuizMap = Object.freeze({ mount });
})();
