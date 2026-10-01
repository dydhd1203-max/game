/* Original illustrated scenery for the four-region adventure world.
   Large props occupy protected edge pockets; the supplied NPCs and spawn remain clear. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const cleanNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fmt = value => Math.round(value * 10) / 10;

  function decorate(options) {
    options = options || {};
    const svg = options.svg;
    if (!svg || typeof svg.appendChild !== 'function') return { obstacles: [] };
    const prior = svg.querySelector('[data-art-detail="adventure-world"]');
    if (prior) return { obstacles: prior._qpDetailObstacles || [] };
    const width = cleanNumber(options.width, 1920), height = cleanNumber(options.height, 1440);
    const uid = String(options.uid || 'qp-adventure').replace(/[^a-zA-Z0-9_-]/g, '') + '-detail';
    const objects = Array.isArray(options.objects) ? options.objects : [];
    const spawn = options.spawn || { x: 960, y: 680 };
    const sandY = height * .63, obstacles = [];
    const layer = document.createElementNS(NS, 'g');
    layer.setAttribute('data-art-detail', 'adventure-world');
    layer.setAttribute('pointer-events', 'none');
    let html = '';
    const ref = name => '#' + uid + '-' + name;
    const paint = name => 'url(' + ref(name) + ')';
    const points = objects.map(o => ({ x: cleanNumber(o.x, 0), y: cleanNumber(o.y, 0), radius: 145 }))
      .concat([{ x: cleanNumber(spawn.x, 960), y: cleanNumber(spawn.y, 680), radius: 160 }]);
    function safeRect(rect, extra) {
      extra = extra || 0;
      return rect.x >= 24 && rect.y >= 12 && rect.x + rect.w <= width - 24 && rect.y + rect.h <= height - 24 &&
        points.every(p => Math.hypot(p.x - Math.max(rect.x, Math.min(p.x, rect.x + rect.w)),
          p.y - Math.max(rect.y, Math.min(p.y, rect.y + rect.h))) >= p.radius + extra);
    }
    function safeDot(x, y, radius) {
      return x - radius >= 20 && x + radius <= width - 20 && y - radius >= 18 && y + radius <= height - 20 &&
        points.every(p => Math.hypot(p.x - x, p.y - y) >= p.radius + radius);
    }
    function group(name, x, y, scale, body) {
      return '<g data-art-detail="' + name + '" transform="translate(' + fmt(x) + ' ' + fmt(y) + ') scale(' + (scale || 1) + ')">' + body + '</g>';
    }
    function use(name, x, y, scale, detail) {
      return group(detail || name, x, y, scale, '<use href="' + ref(name) + '"/>');
    }
    function solid(name, x, y, scale, bounds, footprint) {
      const rect = { x: x + bounds.x * scale, y: y + bounds.y * scale, w: bounds.w * scale, h: bounds.h * scale };
      if (!safeRect(rect)) return false;
      html += use(name, x, y, scale);
      if (footprint) {
        if (footprint.radius) obstacles.push({ x: x + (footprint.x || 0) * scale,
          y: y + (footprint.y || 0) * scale, radius: footprint.radius * scale });
        else obstacles.push({ rect: { x: x + footprint.x * scale, y: y + footprint.y * scale,
          w: footprint.w * scale, h: footprint.h * scale } });
      }
      return true;
    }
    function painted(kind, x, y, propWidth, bounds, footprint) {
      if (!window.QPMapPainted || !safeRect({ x: x + bounds.x, y: y + bounds.y, w: bounds.w, h: bounds.h })) return false;
      html += '<g data-art-detail="forest-painted-' + kind + '">' + window.QPMapPainted.sprite(kind, { x, y, width: propWidth }) + '</g>';
      if (footprint) obstacles.push({ rect: { x: x + footprint.x, y: y + footprint.y, w: footprint.w, h: footprint.h } });
      return true;
    }

    html += '<defs>' +
      '<linearGradient id="' + uid + '-stone" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="#e2ead1"/><stop offset=".35" stop-color="#afbcb4"/><stop offset="1" stop-color="#758792"/></linearGradient>' +
      '<linearGradient id="' + uid + '-cliff" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#9aaf9f"/><stop offset=".35" stop-color="#6d8589"/><stop offset="1" stop-color="#3f586a"/></linearGradient>' +
      '<linearGradient id="' + uid + '-roof" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="#b2a6ef"/><stop offset=".35" stop-color="#827cd2"/><stop offset="1" stop-color="#504980"/></linearGradient>' +
      '<linearGradient id="' + uid + '-wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0c98a"/><stop offset=".5" stop-color="#cb935a"/><stop offset="1" stop-color="#8b613f"/></linearGradient>' +
      '<linearGradient id="' + uid + '-grass" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#d1e975"/><stop offset=".5" stop-color="#9bcc60"/><stop offset="1" stop-color="#61a568"/></linearGradient>' +
      '<linearGradient id="' + uid + '-water" x1="0" y1="0" x2=".35" y2="1"><stop stop-color="#bdf5dc"/><stop offset=".35" stop-color="#63d8ce"/><stop offset="1" stop-color="#32a9b9"/></linearGradient>' +
      '<linearGradient id="' + uid + '-lava-rock" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#a4958e"/><stop offset=".35" stop-color="#776d7e"/><stop offset="1" stop-color="#4b4f62"/></linearGradient>' +
      '<linearGradient id="' + uid + '-sand-rock" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="#f4dfb1"/><stop offset=".4" stop-color="#d9aa72"/><stop offset="1" stop-color="#b17a55"/></linearGradient>' +
      '<g id="' + uid + '-cliff-prop">' +
      '<ellipse cx="5" cy="28" rx="110" ry="27" fill="#314b5230"/>' +
      '<path d="M-99-28L-79-63L-36-75L15-68L47-81L86-62L101-22L85 16L49 33L3 25L-37 35L-80 16Z" fill="' + paint('cliff') + '" stroke="#48666e" stroke-width="4"/>' +
      '<path d="M-99-28L-65-22L-51 4L-80 16M-65-22L-65-52L-36-75M-51 4L-25-4L-37 35M-25-4L-16-48L15-68M-16-48L21-28L21 26M21-28L51-32L49 33M51-32L62-66M62-66L86-62L101-22L73-12L85 16" fill="none" stroke="#405a6b" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M-72-48L-45-57L-44-33L-62-30ZM-12-42L10-33L8-8L-9-12ZM58-26L78-31L86-18L73-14L69 6L54 9Z" fill="#bec8ad" opacity=".55"/>' +
      '<path d="M-88-48Q-73-78-36-73Q-13-86 12-75Q44-91 79-70L90-49Q76-35 51-41L37-52Q9-40-12-49L-26-40L-56-46L-68-33Z" fill="' + paint('grass') + '" stroke="#679b62" stroke-width="3"/>' +
      '<path d="M-59-59L-44-62L-38-53M-13-64L0-68L14-63M47-67L58-73L72-66" stroke="#ddeb89" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M-45-48L-51-36L-47-24L-55-8M37-49L35-33L43-24L35-12" stroke="#86b96b" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M-93 4L-78 7L-74 15L-90 14M53 22L67 13L76 16L64 27" fill="#8cbb6c"/>' +
      '</g>' +
      '<g id="' + uid + '-cottage">' +
      '<ellipse cx="2" cy="18" rx="89" ry="22" fill="#294c4533"/>' +
      '<path d="M-75-57L19-74L80-38V8L-12 28L-75 4Z" fill="' + paint('wood') + '" stroke="#705849" stroke-width="4"/>' +
      '<path d="M-12-27L80-38V8L-12 28Z" fill="#b78457" stroke="#705849" stroke-width="3"/>' +
      '<path d="M-65-50L-65 2M-42-41L-42 12M-17-32V20M1-29V20M33-34V14M65-38V6M-73-12L-15 10L78-9" stroke="#896447" stroke-width="5" fill="none"/>' +
      '<path d="M-65-26L-29-13V7L-65-6Z" fill="#f8eac1" stroke="#795b45" stroke-width="4"/>' +
      '<path d="M15-23L39-26V17L15 22Z" fill="#6e624d" stroke="#604c3c" stroke-width="3"/>' +
      '<path d="M18-19L35-21V13L18 16Z" fill="#ba8d57"/><path d="M24-17V12M30-17V10" stroke="#e0b879" stroke-width="2"/><circle cx="31" cy="-2" r="2.5" fill="#f5d56c"/>' +
      '<path d="M48-27L69-29V-10L48-8Z" fill="#c6ece2" stroke="#6a6550" stroke-width="3"/><path d="M58-27V-9M48-18L69-20" stroke="#f4eac2" stroke-width="3"/>' +
      '<path d="M-80-57L-27-121L29-110L88-41L-9-20Z" fill="' + paint('roof') + '" stroke="#524b79" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M-27-121L-9-20L88-41L29-110Z" fill="#766fbd" stroke="#524b79" stroke-width="3"/>' +
      '<path d="M-67-70Q-57-61-47-71Q-39-61-30-72M-56-83Q-46-75-36-84Q-29-77-22-83M-45-99Q-34-91-26-99M-74-58Q-63-46-53-56Q-44-43-33-54Q-22-44-14-55" stroke="#b8ade9" stroke-width="4" fill="none"/>' +
      '<path d="M-21-103L39-114M-17-80L54-90M-13-56L72-65M4-113L23-27M24-105L48-31M44-87L69-37" stroke="#57568c" stroke-width="3" fill="none"/>' +
      '<path d="M-75-57L-13-26L86-44" stroke="#d9c5dc" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M42-95V-133L62-137V-88Z" fill="#b8b7aa" stroke="#6f7980" stroke-width="3"/><path d="M38-133L60-140L66-133L45-127Z" fill="#e4ddc4" stroke="#7b8584" stroke-width="3"/><path d="M49-120L61-123M48-105L61-108" stroke="#84928c" stroke-width="2"/>' +
      '<path d="M-20-113Q-13-129 0-123Q12-131 23-117Q18-103 2-109L-9-104Z" fill="#9ed56b" stroke="#659555" stroke-width="2"/>' +
      '<path d="M-15 29L24 22L41 33L1 43Z" fill="#d4cca9" stroke="#9b947c" stroke-width="2"/><path d="M-12 38L27 30L37 43L-2 49Z" fill="#ebe0b2" stroke="#a59878" stroke-width="2"/>' +
      '<path d="M-65 12Q-61-2-48 3Q-40-7-29 4L-23 17Z" fill="#88b86a" stroke="#5f8e57" stroke-width="2"/>' +
      '</g>' +
      '<g id="' + uid + '-forest-canopy">' +
      '<ellipse cy="20" rx="65" ry="20" fill="#315b3c30"/>' +
      '<path d="M-12-30L-17 14L-5 22L13 14L10-30Z" fill="#a8774d" stroke="#6d553d" stroke-width="4"/><path d="M0-27L-3 12M-11-13L-4-8L8-19" stroke="#d1a064" stroke-width="3" fill="none"/>' +
      '<path d="M-67-35Q-84-61-61-80Q-67-105-34-113Q-16-140 7-122Q36-133 48-109Q80-100 70-74Q90-43 61-27Q47-5 16-19Q-9 3-29-20Q-52-9-67-35Z" fill="#438d64" stroke="#347559" stroke-width="4"/>' +
      '<path d="M-64-70Q-54-101-27-102Q-9-128 11-106Q42-115 53-91Q69-72 49-56Q19-64-1-44Q-21-58-44-47Q-67-50-64-70Z" fill="' + paint('grass') + '"/>' +
      '<path d="M-58-49Q-36-71-14-52Q3-76 29-62Q46-78 67-61Q76-40 53-31Q37-13 17-29Q-1-12-22-31Q-45-13-58-49Z" fill="#74b96e"/>' +
      '<path d="M-49-81Q-27-91-16-79M-3-102Q12-111 28-97M23-48Q42-59 53-47M-24-39Q-11-45-4-39" fill="none" stroke="#cbe881" stroke-width="7" stroke-linecap="round" opacity=".65"/>' +
      '<path d="M-42-23L-34-29L-25-23M41-15L48-23L55-19" fill="#dce88a"/>' +
      '</g>' +
      '<g id="' + uid + '-basalt">' +
      '<ellipse cy="16" rx="67" ry="20" fill="#31384638"/>' +
      '<path d="M-58-8L-45-41L-19-64L21-62L54-32L62 8L37 22L-8 20Z" fill="' + paint('lava-rock') + '" stroke="#4a4b60" stroke-width="4"/>' +
      '<path d="M-45-41L-19-64L-6-33L-24-16L-58-8M-6-33L21-62L54-32L30-12L37 22M-24-16L-8 20M30-12L-6-33L-24-16" fill="none" stroke="#46495d" stroke-width="4"/>' +
      '<path d="M-42-39L-19-57L-14-38L-26-25L-48-19ZM-1-35L22-55L40-37L25-24Z" fill="#bbb1a0" opacity=".65"/>' +
      '<path d="M-30 0L-19-5L-13 9M21-9L25-1L36 0" stroke="#de9a6c" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M-61 9L-47 17M43 23L54 18" stroke="#ffd478" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      '<g id="' + uid + '-sandstone">' +
      '<ellipse cy="13" rx="51" ry="16" fill="#ac7e4733"/>' +
      '<path d="M-44 0L-35-43L-10-71L20-65L44-33L49 10L10 21Z" fill="' + paint('sand-rock') + '" stroke="#a37153" stroke-width="3.5"/>' +
      '<path d="M-35-43L-8-39L-10-71M-8-39L20-65L27-36L44-33M-8-39L2-8L10 21M2-8L28-14L49 10" stroke="#b27e56" stroke-width="3" fill="none"/>' +
      '<path d="M-32-40L-13-63L-12-43L-28-28M5-35L20-57L26-40L19-22" stroke="#fbe5b4" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M-19-23L-8-25L-3-12L-14-10ZM12-26L23-26L25-20L15-19Z" fill="none" stroke="#895f46" stroke-width="2"/><path d="M-21-5L-13 0L-4-4M20-8L25-1L31-7" stroke="#916441" stroke-width="2" fill="none"/>' +
      '</g>' +
      '<g id="' + uid + '-palm">' +
      '<ellipse cy="15" rx="44" ry="13" fill="#877e4833"/>' +
      '<path d="M-8 13Q14-23 5-65L17-65Q26-20 9 14Z" fill="#c99453" stroke="#986a3f" stroke-width="3"/>' +
      '<path d="M-2 3L12 8M4-11L17-6M8-24L21-20M10-39L23-35M10-53L21-50" stroke="#f0c885" stroke-width="3"/>' +
      '<path d="M10-64Q-33-103-66-72Q-24-86 9-59Q-29-70-47-39Q-24-55 10-56Q-8-91 6-121Q20-99 17-66Q53-113 83-91Q44-91 22-63Q72-74 80-42Q53-63 21-57Q45-35 41-12Q28-41 15-58Z" fill="#73b573" stroke="#4f9063" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M-53-74Q-20-83 10-62M11-108L15-68M65-89Q38-83 22-66M64-51L25-60" stroke="#b7d783" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M7-58Q0-67-6-58Q-9-49-1-47Q7-47 7-58M15-55Q20-65 27-56Q32-48 24-44Q16-46 15-55" fill="#d9a459" stroke="#987349" stroke-width="2"/>' +
      '</g>' +
      '<g id="' + uid + '-flowers"><path d="M-18 6Q-7-20 2 3Q11-21 23 6Q10 18-18 6Z" fill="#79b068"/><path d="M-8 4V-10M9 5L14-10" stroke="#458a55" stroke-width="2"/>' +
      '<path d="M-9-12Q-16-22-9-22Q-3-26-1-19Q7-17 1-12Q1-5-6-8Q-13-5-9-12" fill="#e995bb" stroke="#c8679a" stroke-width="1"/><circle cx="-5" cy="-15" r="2.6" fill="#ffe797"/>' +
      '<path d="M11-10Q5-19 11-20Q15-27 19-20Q26-19 23-13Q28-7 21-5Q19 1 15-5Q7-3 11-10" fill="#fff4a2" stroke="#e6c668" stroke-width="1"/><circle cx="17" cy="-13" r="2.4" fill="#efa759"/></g>' +
      '<g id="' + uid + '-fern"><path d="M0 12Q-1-20 4-28M0 2Q-20-9-22-30Q-3-23 0-6M1-3Q20-18 26-30Q30-5 1 3M-1 9Q-20 6-25-10Q-9-10-1 2M2 8Q19-3 23-14Q29 6 2 12" fill="#79bc78" stroke="#4e975d" stroke-width="2" stroke-linejoin="round"/><path d="M-17-23L-2-4M21-22L3 2" stroke="#c4db88" stroke-width="2" fill="none"/></g>' +
      '</defs>';

    // Masonry stays on the already-solid fortress. Both court entrances remain open.
    const stoneRects = [{ x: 644, y: 182, w: 256, h: 153 }, { x: 1070, y: 182, w: 266, h: 153 },
      { x: 624, y: 319, w: 35, h: 520 }, { x: 1321, y: 319, w: 35, h: 520 },
      { x: 624, y: 834, w: 242, h: 37 }, { x: 1086, y: 834, w: 270, h: 37 }];
    html += '<g data-art-detail="castle-cut-stone" fill="none" stroke-linecap="round">';
    stoneRects.forEach((r, index) => {
      html += '<path d="M' + (r.x + 4) + ' ' + (r.y + r.h - 5) + 'H' + (r.x + r.w - 4) + 'V' + (r.y + 6) + '" stroke="#52697b" stroke-width="7" opacity=".55"/>' +
        '<path d="M' + (r.x + 5) + ' ' + (r.y + r.h - 13) + 'V' + (r.y + 5) + 'H' + (r.x + r.w - 7) + '" stroke="#f0efd4" stroke-width="5" opacity=".9"/>';
      if (index < 2) {
        for (let row = 0; row < 3; row++) {
          const py = r.y + 31 + row * 42;
          html += '<path d="M' + (r.x + 8) + ' ' + py + 'H' + (r.x + r.w - 8) + '" stroke="#879a9b" stroke-width="3"/>';
          for (let col = 0; col < 4; col++) {
            const px = r.x + 17 + col * 60 + (row % 2 ? 18 : 0);
            if (px + 26 < r.x + r.w - 8) html += '<path d="M' + px + ' ' + (py - 26) + 'v24m3-20h23" stroke="#dce3cc" stroke-width="3"/>';
          }
        }
      }
    });
    html += '</g>';
    [625, 865, 1095, 1340].forEach((x, index) => {
      const flag = index % 2 ? '#ea976b' : '#6eced0';
      html += group('castle-violet-roof', x, 114, 1,
        '<path d="M-45 6L0-79L45 6L30 17H-30Z" fill="' + paint('roof') + '" stroke="#524c7e" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M0-79L10 8L43 6" fill="#6662a8"/><path d="M-34-13Q0-3 33-13M-23-34Q0-26 22-34M-12-54Q0-49 11-54" fill="none" stroke="#c0b8ef" stroke-width="3"/>' +
        '<path d="M-37 7H37" stroke="#e2d5e5" stroke-width="5"/><path d="M0-81V-103" stroke="#877753" stroke-width="3"/>' +
        '<path d="M1-103Q17-111 31-100L27-82Q17-91 1-84Z" fill="' + flag + '" stroke="#65746d" stroke-width="2"/><path d="M5-99L23-96" stroke="#fff3b5" stroke-width="2"/>' +
        '<path d="M-28 84L-21 73L-10 78L-5 91L-15 93M18 40L29 37V57H18" stroke="#e1e7d0" stroke-width="3" fill="none"/>' +
        '<path d="M-24 107H24V154L0 171L-24 154Z" fill="' + flag + '" stroke="#526e77" stroke-width="3"/>' +
        '<path d="M-18 112H18V151L0 164L-18 151Z" fill="none" stroke="#f6d97f" stroke-width="3"/><path d="M0 119L7 131L0 143L-7 131Z" fill="#fff0a7"/>' +
        '<path d="M-10 167L0 159L10 167" stroke="#51666e" stroke-width="2" fill="none"/>');
    });
    html += '<g data-art-detail="castle-gate-crest"><path d="M931 142L943 105L967 113L985 92L1004 113L1028 105L1040 142Z" fill="#e8c16f" stroke="#987347" stroke-width="4"/><path d="M943 138L950 119L970 128L985 111L1000 128L1021 119L1028 138" fill="none" stroke="#fff2bd" stroke-width="4"/><path d="M939 155H1030" stroke="#b9c8b0" stroke-width="5" stroke-linecap="round"/><path d="M949 165H1020" stroke="#586f7a" stroke-width="3" stroke-linecap="round"/></g>';

    // Forest hamlet on the northern ledge: distinct roof tiles, framed windows and moss.
    if (!painted('rock', 1620, 155, 164, { x: -86, y: -117, w: 164, h: 130 }, { x: -66, y: -54, w: 136, h: 59 }))
      solid('cliff-prop', 1620, 123, .95, { x: -110, y: -88, w: 220, h: 125 }, { x: -92, y: -44, w: 184, h: 69 });
    if (!painted('cottage', 1767, 225, 190, { x: -100, y: -198, w: 190, h: 205 }, { x: -76, y: -56, w: 148, h: 61 }))
      solid('cottage', 1767, 194, .83, { x: -91, y: -143, w: 187, h: 194 }, { x: -75, y: -57, w: 156, h: 91 });
    [[1518, 155, .63], [1866, 242, .58], [1562, 715, .7], [1865, sandY - 107, .65]].forEach(p =>
      solid('forest-canopy', p[0], p[1], p[2], { x: -87, y: -142, w: 174, h: 165 }, { y: 5, radius: 18 }));
    const springX = width - 117, springY = sandY - 197;
    if (safeRect({ x: springX - 81, y: springY - 121, w: 163, h: 207 })) {
      html += group('forest-spring', springX, springY, 1,
        '<path d="M-64-91L-44-119L-10-122L29-108L49-67L58-20L39 22L-26 28L-62-1Z" fill="' + paint('cliff') + '" stroke="#4b6771" stroke-width="4"/>' +
        '<path d="M-44-119L-31-86L-50-66L-62-1M-31-86L-10-122L14-90L29-108M14-90L9-51L43-45M9-51L-19-38L-26 28M43-45L39 22" stroke="#47606c" stroke-width="4" fill="none"/>' +
        '<path d="M-61-88Q-43-127-13-116Q7-130 31-110L39-91Q18-79-2-90Q-26-77-48-81Z" fill="' + paint('grass') + '" stroke="#6d9c67" stroke-width="3"/>' +
        '<path d="M-14-85Q-10-50-1-19L-6 23Q20 35 32 19L16-23Q5-54 10-85Z" fill="' + paint('water') + '" stroke="#addfc7" stroke-width="2"/>' +
        '<path d="M-5-77L4-49L5-27L14-3L13 21M5-73L3-56" stroke="#e4ffdd" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<path d="M-67 22Q-52 6-18 18Q11 8 46 23Q75 47 56 66Q27 90-11 80Q-49 89-73 57Z" fill="#88aa7c" stroke="#487668" stroke-width="4"/>' +
        '<path d="M-60 28Q-35 17-11 28Q20 16 48 31Q68 48 49 62Q27 79-6 69Q-37 80-62 56Z" fill="' + paint('water') + '" stroke="#d2e5b3" stroke-width="5"/>' +
        '<path d="M-48 40Q-30 33-12 38M1 57Q26 65 40 51M-20 61L-7 57M17 34L33 37" stroke="#dcffe9" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M-66 43L-78 31L-70 22L-56 25L-52 37ZM45 69L62 60L70 64L62 75L47 77Z" fill="#c6d5b0" stroke="#91a889" stroke-width="2"/>');
      obstacles.push({ rect: { x: springX - 66, y: springY - 119, w: 123, h: 143 } },
        { x: springX - 4, y: springY + 49, radius: 59 });
    }
    painted('well', 1652, sandY - 87, 108, { x: -46, y: -97, w: 108, h: 108 }, { x: -31, y: -25, w: 68, h: 34 });

    // Lava outcrops have cool violet facets and warm reflected edges rather than blank mounds.
    solid('basalt', 98, 163, 1.13, { x: -70, y: -70, w: 140, h: 97 }, { y: -8, radius: 53 });
    solid('basalt', 437, 146, 1.2, { x: -70, y: -70, w: 140, h: 97 }, { y: -8, radius: 53 });
    solid('basalt', 513, 66, .65, { x: -70, y: -70, w: 140, h: 97 }, { y: -8, radius: 53 });
    [[76, 665, .77], [486, 762, .67], [122, sandY - 92, .71]].forEach(p =>
      solid('basalt', p[0], p[1], p[2], { x: -70, y: -70, w: 140, h: 97 }, { y: -8, radius: 53 }));
    html += '<g data-art-detail="volcano-layered-facets" stroke-linejoin="round">' +
      '<path d="M80 250L134 143L185 226L151 271Z" fill="#978878" stroke="#63636c" stroke-width="3"/>' +
      '<path d="M136 149L160 189L142 196L119 198Z" fill="#c0af96"/>' +
      '<path d="M309 177L373 153L452 280L377 273L355 232Z" fill="#756b7d" stroke="#575769" stroke-width="3"/>' +
      '<path d="M374 160L420 231L388 219L370 204Z" fill="#a8948b"/>' +
      '<path d="M210 179L218 199L213 224L232 245M316 183L309 211L330 242L323 267" fill="none" stroke="#ffb979" stroke-width="6"/>' +
      '<path d="M211 180L217 199L213 220M316 184L310 208" fill="none" stroke="#ffe4a3" stroke-width="2.5"/>' +
      '<path d="M188 257L218 249L244 266L223 279L196 276Z" fill="#77717b" stroke="#555565" stroke-width="3"/><path d="M196 258L218 255L233 265L216 267Z" fill="#b9ad92"/>' +
      '<path d="M301 304L332 292L354 310L339 329L307 324Z" fill="#77717b" stroke="#555565" stroke-width="3"/><path d="M309 307L331 299L343 310L327 314Z" fill="#b9ad92"/>' +
      '</g>';

    // A sheltered oasis and carved stones live beside, rather than across, the desert route.
    const oasisX = 121, oasisY = height - 162;
    if (safeRect({ x: oasisX - 89, y: oasisY - 85, w: 178, h: 150 })) {
      html += group('desert-oasis', oasisX, oasisY, 1,
        '<path d="M-87-27Q-69-77-30-66Q6-83 46-59Q81-38 83-8Q84 42 46 55Q1 77-43 52Q-84 48-87-27Z" fill="#bda66e" opacity=".62"/>' +
        '<path d="M-77-24Q-55-64-19-57Q18-69 52-45Q77-22 64 14Q53 49 18 48Q-8 69-44 39Q-72 44-77-24Z" fill="#99be77" stroke="#c6c78b" stroke-width="4"/>' +
        '<path d="M-65-18Q-52-47-22-45Q9-58 41-37Q66-20 52 11Q49 35 19 36Q-11 50-33 25Q-59 30-65-18Z" fill="' + paint('water') + '" stroke="#daf0b0" stroke-width="5"/>' +
        '<path d="M-49-14Q-26-26-8-15M5 19Q26 26 40 11M-34 10L-20 13M13-30L29-25" fill="none" stroke="#e2ffe1" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M-85 8L-75-5L-61-3L-57 10L-72 19ZM44 42L56 29L75 32L76 42L59 50Z" fill="#ead9a3" stroke="#b3a36f" stroke-width="2.5"/>' +
        '<path d="M-68 34L-70 16L-58 28L-53 15L-48 35M23-55L27-72L32-60L38-70L37-53" fill="#9bbd73" stroke="#7ca363" stroke-width="2"/>');
      obstacles.push({ x: oasisX - 3, y: oasisY - 2, radius: 64 });
      solid('palm', 85, oasisY - 71, .66, { x: -71, y: -124, w: 157, h: 142 }, { y: 4, radius: 13 });
      solid('palm', 217, oasisY + 43, .57, { x: -71, y: -124, w: 157, h: 142 }, { y: 4, radius: 13 });
    }
    [[1781, height - 101, 1.15], [1664, sandY + 83, .8], [76, sandY + 182, .64],
      [1821, sandY + 277, .76], [659, height - 70, .62]].forEach(p =>
      solid('sandstone', p[0], p[1], p[2], { x: -54, y: -75, w: 108, h: 102 }, { y: -5, radius: 34 }));

    // Designed flower/fern clusters leave question reading and the main crossing open.
    const gardens = [[1493, 251], [1650, 217], [1838, 264], [1467, 679], [1713, 681],
      [1804, sandY - 71], [1390, 315], [604, 718], [585, sandY + 56], [1300, sandY + 105]];
    gardens.forEach((p, index) => {
      if (!safeDot(p[0], p[1], 37)) return;
      html += group('flower-bed', p[0], p[1], 1,
        '<path d="M-38 6Q-23-12-2-6Q15-19 34-4L39 10Q15 24-10 16Q-30 23-38 6Z" fill="#87b471" opacity=".75"/>' +
        '<use href="' + ref('flowers') + '" transform="translate(-17 3) scale(.8)"/><use href="' + ref('flowers') + '" transform="translate(13 1) scale(.74)"/>' +
        '<use href="' + ref('fern') + '" transform="translate(' + (index % 2 ? 27 : -31) + ' 10) scale(.6)"/>');
    });
    for (let i = 0; i < 19; i++) {
      const x = 1458 + ((i * 131) % 427), y = 263 + ((i * 117) % Math.max(280, sandY - 306));
      if (safeDot(x, y, 22)) html += use(i % 3 ? 'fern' : 'flowers', x, y, .62, 'forest-floor-detail');
    }
    for (let i = 0; i < 12; i++) {
      const x = 82 + (i * 157) % 443, y = 324 + (i * 109) % Math.max(270, sandY - 349);
      if (!safeDot(x, y, 20)) continue;
      html += group('lava-cooling-island', x, y, .5,
        '<path d="M-35 2L-25-15L-1-24L25-14L33 7L7 16L-22 13Z" fill="#7a727b" stroke="#54566a" stroke-width="3"/><path d="M-21-12L-1-18L20-10L4-2L-18-3Z" fill="#b4a791"/><path d="M-32 4L-19 10M12 13L27 8" stroke="#f3be81" stroke-width="3" fill="none"/>');
    }
    layer.innerHTML = html;
    layer._qpDetailObstacles = obstacles;
    svg.appendChild(layer);
    return { obstacles };
  }

  window.QPAdventureDetail = Object.freeze({ decorate });
}());
