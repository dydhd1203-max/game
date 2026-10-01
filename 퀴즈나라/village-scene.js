/* Forest village geometry and reusable painted scenery.
   Coordinates describe feet on the ground; elevation is projected separately.
   The plateau and tree-garden cannot be entered through their cliff faces. */
(function () {
  'use strict';
  const WIDTH = 1800, HEIGHT = 1300, WORLD_SCALE = 1.5;
  const spawn = Object.freeze({ x: 920, y: 940, height: 0 });
  const mainRamp = Object.freeze({ x: 830, y: 640, w: 180, h: 200, low: 0, high: 72 });
  const gardenRamp = Object.freeze({ x: 610, y: 530, w: 80, h: 120, low: 72, high: 120 });
  const plateau = Object.freeze({ x: 280, y: 250, w: 1210, h: 490, height: 72 });
  const garden = Object.freeze({ x: 340, y: 380, w: 340, h: 200, height: 120 });
  const bridge = Object.freeze({ x: 1000, y: 450, w: 210, h: 85, height: 72 });
  const lowerBridge = Object.freeze({ x: 1080, y: 855, w: 170, h: 75, height: 0 });
  const logPlatform = Object.freeze({ x: 1495, y: 620, w: 113, h: 30, height: 160 });
  const woodCurve = Object.freeze([[322,850],[322,830.11],[334.83,800.09],[349.79,770.07],[372.78,738.17],[410.18,706.27],[440.63,680]]);
  const woodRamp = Object.freeze({ x: 294, y: 680, w: 175, h: 170, low: 0, high: 72, curve: true,
    centerLine: woodCurve.map(p => Object.freeze({ x: p[0], y: p[1], height: (850 - p[1]) / 170 * 72 })) });
  const river = Object.freeze({ x: 1035, y: 250, w: 140, h: 490 });
  const frames = Object.freeze({
    school: { source: [0, 0, 562, 658], anchor: [345, 648] },
    shop: { source: [562, 0, 550, 650], anchor: [250, 618] },
    observatory: { source: [1112, 0, 424, 650], anchor: [215, 636] },
    bridge: { source: [0, 680, 690, 285], anchor: [345, 235] },
    stairs: { source: [690, 650, 355, 374], anchor: [180, 350] },
    waterfall: { source: [1045, 650, 491, 374], anchor: [245, 357] }
  });
  const oldFrames = Object.freeze({
    oak: { source: [665, 0, 589, 720], anchor: [292, 714] },
    rock: { source: [0, 720, 675, 534], anchor: [352, 477] },
    well: { source: [715, 720, 539, 534], anchor: [227, 482] },
    cottage: { source: [0, 0, 665, 718], anchor: [347, 691] }
  });
  const foliageFrames = Object.freeze({
    fir: { source: [0, 0, 604, 698], anchor: [322, 688] },
    flowering: { source: [604, 0, 650, 734], anchor: [340, 718] },
    willow: { source: [0, 698, 705, 556], anchor: [322, 526], clipPath: 'M0 698H700V1000L690 1020L675 1050L660 1080L642 1110L630 1150V1254H0Z' },
    flowers: { source: [630, 734, 624, 520], anchor: [312, 480], clipPath: 'M700 734H1254V1254H630V1150L642 1110L660 1080L675 1050L690 1020L700 1000Z' }
  });
  const explorationFrames = Object.freeze({
    logTower: { source: [0,0,580,887], anchor: [283,852] },
    woodStairs: { source: [580,190,610,665], anchor: [225,615], clipPath: 'M580 190H1190V650L1080 855H580Z' },
    cave: { source: [1120,310,654,577], anchor: [345,533], clipPath: 'M1190 310H1774V887H1080V855L1190 650Z' }
  });
  const portals = Object.freeze([
    Object.freeze({ id: 'shop', label: '숲속 옷가게', x: 510, y: 1005, height: 0, radius: 58, action: 'shop', description: '옷을 고르고 내 아바타를 꾸며요.' }),
    Object.freeze({ id: 'school', label: '나무집 교실', x: 490, y: 540, height: 120, radius: 54, action: 'school', description: '선생님이 연 수업과 우리 반 퀴즈를 만나요.' }),
    Object.freeze({ id: 'quiz', label: '별 퀴즈 관측탑', x: 1350, y: 585, height: 72, radius: 56, action: 'practice', description: '반짝이는 별 아래에서 혼자 퀴즈를 연습해요.' })
  ]);
  const discoveries = Object.freeze([
    Object.freeze({ id: 'waterfall', label: '무지개 폭포', x: 1185, y: 870, height: 0, radius: 90, text: '물방울 사이로 작은 무지개를 찾았어요!' }),
    Object.freeze({ id: 'garden', label: '나무 위 정원', x: 600, y: 495, height: 120, radius: 58, text: '작은 계단을 올라 나무 위 정원을 발견했어요.' }),
    Object.freeze({ id: 'bridge', label: '흔들흔들 구름다리', x: 1105, y: 492, height: 72, radius: 55, text: '다리 아래 개울이 반짝여요. 저편에는 별 관측탑이 있어요.' }),
    Object.freeze({ id: 'hollow', label: '반딧불 쉼터', x: 1570, y: 820, height: 0, radius: 75, text: '이끼 바위 뒤에서 반딧불이 쉬고 있어요.' }),
    Object.freeze({ id: 'logtop', label: '별빛 통나무 전망대', x: 1548.4483, y: 631.6092, height: 160, radius: 30, text: '줄을 타고 높은 통나무 위까지 올랐어요! 마을이 한눈에 보여요.' }),
    Object.freeze({ id: 'secret-cave', label: '반짝이는 비밀 동굴', x: 250, y: 680, height: 0, radius: 60, text: '나뭇잎 뒤에서 작은 비밀 동굴을 발견했어요.' })
  ]);
  const travelLinks = Object.freeze([
    Object.freeze({ id: 'rope-up', label: '통나무 줄 오르기', kind: 'rope', from: { x: 1540, y: 730, height: 0 }, to: { x: 1548.4483, y: 631.6092, height: 160 }, duration: 2400, radius: 55 }),
    Object.freeze({ id: 'rope-down', label: '줄 타고 내려가기', kind: 'rope', from: { x: 1548.4483, y: 631.6092, height: 160 }, to: { x: 1540, y: 730, height: 0 }, duration: 2400, radius: 55 })
  ]);
  const solids = [
    { id: 'shop-wall', x: 441, y: 905, w: 146, h: 78, height: 0 },
    { id: 'school-wall', x: 419, y: 403, w: 140, h: 118, height: 120 },
    { id: 'quiz-wall', x: 1262, y: 465, w: 167, h: 97, height: 72 },
    { id: 'well', x: 760, y: 968, radius: 31, height: 0 }
  ];
  // The village expands geographically while buildings stay a friendly size.
  // Solid footprints retain their real painted size around each actual door.
  solids.forEach(solid => {
    const portal = portals.find(p => solid.id === p.id + '-wall');
    if (!portal) return;
    solid.x = portal.x + (solid.x - portal.x) / WORLD_SCALE;
    solid.y = portal.y + (solid.y - portal.y) / WORLD_SCALE;
    solid.w /= WORLD_SCALE; solid.h /= WORLD_SCALE;
  });
  solids[3].y = 999 + (968 - 999) / WORLD_SCALE;
  solids[3].radius /= WORLD_SCALE;
  let cache = null;
  function inside(x, y, rect) { return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h; }
  function project(x, y, height) { return { x, y: y - (Number(height) || 0) }; }
  function onWoodRamp(x, y) {
    if (y < 680 || y > 850) return false;
    let centre = woodCurve[woodCurve.length - 1][0];
    for (let i = 0; i < woodCurve.length - 1; i++) {
      const a = woodCurve[i], b = woodCurve[i + 1];
      if (y <= a[1] && y >= b[1]) { const t = (a[1] - y) / (a[1] - b[1]); centre = a[0] + (b[0] - a[0]) * t; break; }
    }
    return Math.abs(x - centre) <= 28;
  }
  function segmentDistance(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  }
  function rawSurface(x, y) {
    if (inside(x, y, logPlatform)) return { height: 160, level: 3, label: '통나무 전망대' };
    if (onWoodRamp(x, y)) return { height: (850 - y) / 170 * 72, level: 1, label: '구불구불 나무 계단' };
    if (inside(x, y, gardenRamp)) return { height: 72 + (650 - y) * .4, level: 2, label: '나무집 계단' };
    if (inside(x, y, mainRamp)) return { height: (840 - y) * .36, level: 1, label: '햇살 돌계단' };
    if (inside(x, y, garden)) return { height: 120, level: 2, label: '나무 위 정원' };
    if (inside(x, y, plateau)) return { height: 72, level: 1, label: inside(x, y, bridge) ? '구름다리' : '높은 숲길' };
    return { height: 0, level: 0, label: inside(x, y, lowerBridge) ? '개울 돌다리' : '숲속 마을 광장' };
  }
  function surfaceAt(x, y, currentHeight) {
    const surface = rawSurface(x, y);
    let reason = '';
    if (!Number.isFinite(x) || !Number.isFinite(y)) reason = 'invalid';
    else if (x < 84 || x > WIDTH - 84 || y < 155 || y > HEIGHT - 75) reason = 'boundary';
    else if (inside(x, y, river) && !inside(x, y, bridge)) reason = 'river';
    else if (((x - 1390) / 192) ** 2 + ((y - 1000) / 132) ** 2 < 1) reason = 'pond';
    else if (surface.height < 12 && !inside(x, y, lowerBridge) &&
      ((((x - 1100) / 88) ** 2 + ((y - 838) / 35) ** 2 < 1) ||
       segmentDistance(x, y, [1100, 853], [1190, 902]) < 20 ||
       segmentDistance(x, y, [1190, 902], [1290, 925]) < 22)) reason = 'brook';
    else if (Number.isFinite(currentHeight) && Math.abs(surface.height - currentHeight) > 3) reason = 'cliff';
    return Object.assign({ allowed: !reason, reason }, surface);
  }
  function canStand(x, y, currentHeight, radius) {
    radius = Number.isFinite(radius) ? Math.max(0, radius) : 11;
    const surface = surfaceAt(x, y, currentHeight);
    if (!surface.allowed) return false;
    for (const solid of solids) {
      if (Math.abs(surface.height - solid.height) > 16) continue;
      if (solid.radius) {
        if (Math.hypot(x - solid.x, y - solid.y) < solid.radius + radius) return false;
      } else if (x > solid.x - radius && x < solid.x + solid.w + radius && y > solid.y - radius && y < solid.y + solid.h + radius) return false;
    }
    // The radius protects feet from water; slope side rails still use the centre
    // elevation so entering an explicit staircase remains continuous.
    if (inside(x, y, plateau) && !inside(x, y, bridge) && x > river.x - radius && x < river.x + river.w + radius) return false;
    return true;
  }
  function cropSprite(kind, width, old, clip) {
    const family = old === 'exploration' ? 'exploration' : old === 'foliage' ? 'foliage' : old ? 'old' : 'landmark';
    const frame = (family === 'exploration' ? explorationFrames : family === 'foliage' ? foliageFrames : family === 'old' ? oldFrames : frames)[kind], scale = width / frame.source[2];
    if (!clip && frame.clipPath) clip = { id: 'vt-' + family + '-' + kind, path: frame.clipPath };
    const heightPixels = frame.source[3] * scale;
    const clipMarkup = clip ? '<defs><clipPath id="' + clip.id + '"><path d="' + clip.path + '"/></clipPath></defs>' : '';
    const image = '<image href="./assets/' + (family === 'exploration' ? 'forest-town-exploration.png' : family === 'foliage' ? 'forest-town-foliage.png' : family === 'old' ? 'painted-forest-props.png' : 'forest-town-landmarks.png') + '" width="' + (family === 'exploration' ? '1774' : family === 'landmark' ? '1536' : '1254') + '" height="' + (family === 'exploration' ? '887' : family === 'landmark' ? '1024' : '1254') + '"' + (clip ? ' clip-path="url(#' + clip.id + ')"' : '') + '/>';
    return { width, heightPixels, anchorX: frame.anchor[0] * scale, anchorY: frame.anchor[1] * scale,
      markup: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="' + frame.source.join(' ') + '" overflow="hidden" aria-hidden="true" focusable="false">' + clipMarkup + image + '</svg>' };
  }
  function proceduralObject(width, heightPixels, anchorX, anchorY, art) {
    return { width, heightPixels, anchorX, anchorY, markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + heightPixels + '" width="100%" height="100%" aria-hidden="true">' + art + '</svg>' };
  }
  function build(options) {
    if (cache) return cache;
    const prefix = 'vt-' + String((options && options.id) || 'forest').replace(/[^a-zA-Z0-9_-]/g, '');
    const objects = [];
    function prop(id, kind, x, y, height, width, old, extra) {
      const item = Object.assign({ id, kind, x, y, height, depth: y }, cropSprite(kind, width, old), extra || {});
      objects.push(item); return item;
    }
    prop('shop', 'shop', 526.58, 1031.95, 0, 285, false, { landmark: 'shop', depth: 995 });
    prop('school', 'school', 478.54, 578.86, 120, 280, false, { landmark: 'school', depth: 529 });
    prop('quiz', 'observatory', 1354.04, 602.91, 72, 245, false, { landmark: 'quiz', depth: 574 });
    prop('main-stairs', 'stairs', 921.92, 840, 0, 318, false, { depth: 620, terrain: true });
    prop('garden-stairs', 'stairs', 650.68, 650, 72, 204, false, { depth: 517, terrain: true });
    prop('rope-bridge', 'bridge', 1105, 514.28, 72, 290, false, { depth: 440, terrain: true });
    const rail = cropSprite('bridge', 290, false, { id: prefix + '-bridge-front', path: 'M0 855Q335 916 690 849V965H0Z' });
    objects.push(Object.assign({ id: 'bridge-front-rope', x: 1105, y: 514.28, height: 72, depth: 536, foreground: true }, rail));
    prop('waterfall', 'waterfall', 1105, 858, 0, 278, false, { depth: 855, terrain: true });
    prop('wood-stairs', 'woodStairs', 320.3967, 867.1016, 0, 326, 'exploration', { depth: 662, terrain: true });
    prop('high-log-tower', 'logTower', 1541.9253, 736.9310, 0, 335, 'exploration', { depth: 600, climbLandmark: true });
    prop('secret-cave', 'cave', 246.1774, 691.2130, 0, 250, 'exploration', { depth: 673 });
    solids.push({ id: 'log-root', x: 1543, y: 697, radius: 32 / WORLD_SCALE, height: 0 });
    prop('well', 'well', 760, 999, 0, 107, true);
    prop('caretaker-cottage', 'cottage', 1490, 1174, 0, 165, true, { depth: 1159 });

    // Clusters follow the banks and the village edge; sizes and spacing vary.
    const treeLocations = [
      [125,255,190],[245,200,177],[365,206,160],[515,194,191],[695,200,166],[860,184,170],[1022,198,146],[1210,190,192],[1400,208,176],[1530,246,191],[1650,334,190],
      [162,465,172],[175,654,201],[242,805,164],[164,920,200],[200,1120,212],[300,1237,191],[458,1250,174],[631,1240,181],[820,1260,211],[1013,1249,175],[1180,1255,167],[1640,1196,214],[1645,1024,198],[1655,843,205],[1606,635,185],[1600,481,171],
      [320,695,135,72],[410,668,121,72],[758,360,150,72],[900,368,121,72],[1237,346,118,72],[1440,375,131,72],[1433,674,127,72],
      [337,1081,130],[689,1108,112],[1025,1168,132],[1194,1181,139],[1530,943,113],[1273,836,109],[720,862,115],[350,913,107]
    ];
    treeLocations.forEach((t, i) => {
      const h = t[3] || 0;
      const kind = [0,2,3,5,7,9,12,16,18,20,22,25,26].includes(i) ? 'fir' : [15,17,29,32,34,41].includes(i) ? 'flowering' : [37,38].includes(i) ? 'willow' : 'oak';
      const width = kind === 'willow' ? 211 : kind === 'flowering' ? Math.max(150, t[2]) : t[2];
      prop(kind + '-' + i, kind, t[0], t[1], h, width, kind === 'oak' ? true : 'foliage', { variation: i % 4 });
      // Canopies overlap routes naturally; only the actual trunk is solid.
      solids.push({ id: kind + '-' + i, x: t[0], y: t[1] - 7 / WORLD_SCALE, radius: width * .083 / WORLD_SCALE, height: h });
    });
    const rocks = [[289,841,112,0],[1180,845,117,0],[1240,1047,128,0],[1535,792,190,0],[1580,879,128,0],[316,577,106,72],[719,647,83,72],[1446,736,90,72],[385,329,95,72],[979,317,75,72],[1230,740,97,72],[1675,1070,115,0],[371,1168,108,0]];
    rocks.forEach((r, i) => {
      prop('rock-' + i, 'rock', r[0], r[1], r[3], r[2], true);
      solids.push({ id: 'rock-' + i, x: r[0], y: r[1] - 8 / WORLD_SCALE, radius: r[2] * .24 / WORLD_SCALE, height: r[3] });
    });
    // Lamps and flower beds are small original vector details between native
    // painted landmarks; they retain clear ground contact and coherent light.
    const lamps = [[592,1030,0],[860,879,0],[994,879,0],[811,704,72],[1249,540,72],[1458,607,72],[584,553,120]];
    lamps.forEach((p, i) => {
      const lampArt = '<ellipse cx="25" cy="100" rx="18" ry="5" fill="#29463032"/><path d="M22 94V32Q22 19 36 22" fill="none" stroke="#775433" stroke-width="6"/><path d="M21 91V36" stroke="#d8aa64" stroke-width="2"/><path d="M27 21L42 21L44 46L24 46Z" fill="#6f5940" stroke="#483f31" stroke-width="2"/><path d="M28 26H39V41H28Z" fill="#ffe697"/><path d="M26 21L34 13L43 21" fill="#89a864" stroke="#4c6541" stroke-width="2"/><path d="M16 94H30L34 100H12Z" fill="#987d55"/>';
      objects.push(Object.assign({ id: 'lamp-' + i, x: p[0], y: p[1], height: p[2], depth: p[1] }, proceduralObject(52, 106, 23, 100, lampArt)));
    });
    const lowBridgeArt = '<path d="M9 59L196 14L216 31L24 79Z" fill="#6e7963"/><path d="M12 47L191 5L204 17L23 63Z" fill="#d2c796" stroke="#83936d" stroke-width="2"/><path d="M16 45L195 4M32 50L24 39M77 37L67 29M126 23L113 16M171 11L160 5" fill="none" stroke="#fff0bd" stroke-width="3"/><path d="M32 58L31 43M76 47L74 33M123 37L122 21M167 27L165 10M194 20L192 5" stroke="#a49e78" stroke-width="3"/>';
    objects.push(Object.assign({ id: 'brook-bridge-front', x: 1162, y: 936, height: 0, depth: 927, terrain: true }, proceduralObject(222, 88, 111, 68, lowBridgeArt)));
    const sparrowArt = '<path d="M4 15l-3 7 9-4" fill="#756b4b"/><path d="M8 16q-3-6 4-9q7-5 13-1q6 1 5 8q-2 8-10 8q-8 0-12-6Z" fill="#ad8f60"/><path d="M9 15q3 8 13 6q4-1 5-4q-7 2-12-3Z" fill="#eee0b2"/><path d="M10 10q7-5 13 3l-6 5-9-1Z" fill="#797c63"/><path d="M11 11l8 4m-10-1 7 3" stroke="#c4b485" stroke-width="1.2"/><path d="M24 7q2-1 4 1l-2 4-4-1Z" fill="#efe7bb"/><circle cx="25" cy="8" r="1.1" fill="#344742"/><path d="M29 9l5 2-5 2" fill="#ceac59"/><path d="M15 22v3l-3 1m9-5v4l3 1" fill="none" stroke="#765e3d" stroke-width="1.2" stroke-linecap="round"/>';
    [[861,188,77],[515,202,95],[1189,1184,61],[1443,385,86]].forEach((p,i) => objects.push(Object.assign({ id: 'bird-perch-' + i, x: p[0], y: p[1], height: p[2], depth: p[1] + 10 }, proceduralObject(35,28,18,25,sparrowArt))));
    const flightArt = '<path d="M20 17Q11 2 1 8q7 1 9 10l9 6Q32 8 44 6q-14-3-24 11Z" fill="#9d9975"/><path d="M19 15Q11 6 4 8l13 12Q31 12 41 7q-13 0-22 8Z" fill="#ead9ab"/><path d="M17 18q1 9 7 9l4-5-5-3Z" fill="#d8c194"/><path d="M20 24l-3 6 7-3" fill="#6b7661"/><circle cx="24" cy="21" r=".9" fill="#354e4a"/><path d="M27 22l4 1-4 2" fill="#caaa5b"/>';
    [[991,984,119],[1017,998,134],[1193,882,97],[1224,866,109],[1315,395,139]].forEach((p,i) => objects.push(Object.assign({ id: 'bird-flight-' + i, x: p[0], y: p[1], height: p[2], depth: p[1] + 20 }, proceduralObject(42,33,21,26,flightArt))));
    const duckArt = '<ellipse cx="27" cy="34" rx="23" ry="5" fill="#c4edd3" opacity=".68"/><path d="M8 28q-6-10 8-12l16 1q11 4 7 12q-9 7-31-1Z" fill="#c5b580"/><path d="M10 24q13-9 25 1l-7 6-14-2Z" fill="#928d65"/><path d="M12 26q8-2 16 2M18 23l11 3" stroke="#e8d9a4" stroke-width="1.4"/><path d="M32 21q-4-6 0-12q5-6 11-2q6 3 2 10l-7 7Z" fill="#618573"/><path d="M35 8q4-3 7 0" stroke="#a3ba86" stroke-width="2"/><path d="M40 18l-8 1" stroke="#f2ead0" stroke-width="2.4"/><circle cx="41" cy="10" r="1.2" fill="#2b4946"/><path d="M45 12l9 1-3 4-6-1Z" fill="#d9af5b"/><path d="M6 25l-5-4 2 8" fill="#887f55"/>';
    [[1318,1001],[1386,1027],[1439,981]].forEach((p,i) => objects.push(Object.assign({ id: 'duck-pond-' + i, x: p[0], y: p[1], height: 0, depth: p[1] }, proceduralObject(56,40,28,35,duckArt))));
    const reedArt = '<ellipse cx="33" cy="60" rx="30" ry="7" fill="#326e6740"/><path d="M29 61Q3 43 8 18q24 13 26 37Q24 25 35 3q10 22 4 52Q43 25 61 19q-1 25-24 43Z" fill="#6b9a65"/><path d="M9 20q14 16 20 34M35 7v47M58 23Q43 44 38 57" fill="none" stroke="#b5cc7d" stroke-width="2"/><path d="M21 59V17M44 59V12M52 58V30" stroke="#65885c" stroke-width="2.1"/><path d="M18 19V7q3-4 6 0v12q-3 5-6 0M41 15V2q3-3 6 0v13q-3 4-6 0M49 33V21q3-4 6 0v12q-3 4-6 0" fill="#9b8657" stroke="#6f7753" stroke-width="1.1"/>';
    [[1225,1033],[1287,1105],[1435,1102],[1514,1028],[1496,947]].forEach((p,i) => objects.push(Object.assign({ id: 'reed-bed-' + i, x: p[0], y: p[1], height: 0, depth: p[1] }, proceduralObject(69,72,34,64,reedArt))));

    const defs = '<defs>' +
      '<linearGradient id="' + prefix + '-grass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d0df87"/><stop offset=".45" stop-color="#a8cb70"/><stop offset="1" stop-color="#6d9e6e"/></linearGradient>' +
      '<linearGradient id="' + prefix + '-upper" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#c8dc83"/><stop offset="1" stop-color="#86b362"/></linearGradient>' +
      '<linearGradient id="' + prefix + '-cliff" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a08f68"/><stop offset=".55" stop-color="#877a62"/><stop offset="1" stop-color="#5f6b58"/></linearGradient>' +
      '<linearGradient id="' + prefix + '-water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8ce2d4"/><stop offset=".48" stop-color="#41b8b4"/><stop offset="1" stop-color="#248d9e"/></linearGradient>' +
      '<radialGradient id="' + prefix + '-light"><stop stop-color="#fcf4b9" stop-opacity=".6"/><stop offset="1" stop-color="#fcf4b9" stop-opacity="0"/></radialGradient>' +
      '<pattern id="' + prefix + '-path" width="58" height="41" patternUnits="userSpaceOnUse"><rect width="58" height="41" fill="#e7d3a3"/><path d="M0 0H58M0 41H58M20 0L25 19L0 27M25 19L58 14M25 19L29 41" fill="none" stroke="#c8ad7c" stroke-width="1.4" opacity=".65"/><path d="M2 3H18M31 22L53 18" stroke="#fff0c5" stroke-width="2" opacity=".8"/></pattern>' +
      '<pattern id="' + prefix + '-moss" width="71" height="49" patternUnits="userSpaceOnUse"><path d="M3 25q8-11 17-4t15-1M42 40q8-13 17-5" stroke="#d4e394" stroke-width="4" fill="none" opacity=".16"/><path d="M50 8l-3-6m3 6l4-7" stroke="#658b55" stroke-width="1.4" opacity=".25"/></pattern>' +
      '</defs>';
    let ground = defs + '<rect width="1800" height="1300" fill="url(#' + prefix + '-grass)"/><rect width="1800" height="1300" fill="url(#' + prefix + '-moss)"/>';
    ground += '<path d="M70 1240Q-20 930 81 691T91 140Q600 48 1240 109T1768 269L1782 1200Q1400 1317 1008 1266T70 1240Z" fill="none" stroke="#456f57" stroke-width="94" opacity=".32"/>';
    ground += '<ellipse cx="745" cy="842" rx="680" ry="390" fill="url(#' + prefix + '-light)"/>';
    // Front faces are genuine elevation silhouettes; walking is only possible
    // via the two stairs, never directly through the rendered rock wall.
    ground += '<path d="M280 178H1490V668L1458 721L1300 741L1178 728L1134 760L1053 737L1010 744L965 727L830 743L764 730L670 748L506 722L372 746L280 712Z" fill="url(#' + prefix + '-cliff)" stroke="#5d7952" stroke-width="4"/>';
    for (let i = 0; i < 23; i++) {
      const x = 289 + i * 52;
      ground += '<path d="M' + x + ' 673l12 19-9 35m9-35 26 15m-17-32 5 13" fill="none" stroke="#5b64534f" stroke-width="3"/>';
      ground += '<path d="M' + (x + 4) + ' 675l18 12" stroke="#c5b68a" stroke-width="3" opacity=".6"/>';
      const t = Math.sin(i * 74.37) * .5 + .5;
      ground += '<path d="M' + x + ' 681l' + (26 + t * 10).toFixed(1) + ' 4 10 15-21 10-21-13Z" fill="' + ['#99a082','#b0ac85','#879780'][i % 3] + '" opacity=".46"/><path d="M' + (x + 7) + ' 700l19 5 8 22-26 9-13-14Z" fill="#727f68" opacity=".54"/>';
    }
    ground += '<path d="M281 177Q461 153 638 177T986 173T1299 176Q1405 151 1488 178V667Q1420 685 1300 667T1100 667T834 671T570 667Q370 682 281 668Z" fill="url(#' + prefix + '-upper)" stroke="#658c4e" stroke-width="4"/>';
    ground += '<path d="M291 185Q443 166 638 185T986 181T1299 184Q1404 166 1479 186M292 660Q445 673 570 660T834 664T1100 660T1300 660Q1412 673 1480 660" fill="none" stroke="#d5e68b" stroke-width="10" stroke-linecap="round" opacity=".8"/>';
    for (let i = 0; i < 18; i++) {
      const x = 296 + i * 66;
      if (x > 818 && x < 1180) continue;
      ground += '<path d="M' + x + ' 658q8 22 20 12t17 12q10 3 12-9l-4-14Z" fill="#73985b"/><path d="M' + (x + 7) + ' 662q5 12 13 7t12 8" fill="none" stroke="#a9c975" stroke-width="5" stroke-linecap="round"/>';
    }
    ground += '<path d="M340 260H680V460L658 495L512 509L392 497L340 474Z" fill="url(#' + prefix + '-cliff)" stroke="#657649" stroke-width="3"/><path d="M340 260Q460 245 558 261T680 260V459Q563 473 453 459T340 460Z" fill="#b5d476" stroke="#749850" stroke-width="3"/>';
    ground += '<path d="M348 266Q459 255 558 267T673 266M348 451Q451 462 453 451T674 451" fill="none" stroke="#dfeb9b" stroke-width="6" opacity=".8"/>';
    // Water stays behind the bridge deck and spills to a separate lower pond.
    ground += '<path d="M1035 174Q1065 188 1104 177T1175 178V668Q1159 688 1110 670T1035 668Z" fill="#729e72"/><path d="M1049 174Q1083 197 1120 181T1160 177V669H1048Z" fill="url(#' + prefix + '-water)"/>';
    for (let i = 0; i < 12; i++) ground += '<path d="M' + (1061 + i % 3 * 9) + ' ' + (220 + i * 36) + 'q30 13 70-1" fill="none" stroke="#d6f7dd" stroke-width="3" opacity=".65"/>';
    ground += '<path d="M1102 808Q1087 867 1218 897T1447 940Q1519 971 1494 1047Q1415 1125 1292 1104Q1159 1071 1230 967Q1247 930 1180 913Q1071 876 1085 813" fill="#728e67" stroke="#527d67" stroke-width="8"/><path d="M1104 810Q1094 872 1220 903T1436 951Q1505 980 1477 1036Q1405 1105 1298 1089Q1178 1055 1248 969Q1262 925 1188 903Q1078 868 1094 815" fill="url(#' + prefix + '-water)"/>';
    ground += '<path d="M1255 983Q1300 955 1346 971M1375 1044q44 14 72-13M1279 1059q28 14 67 2M1281 933q48 16 74 5" fill="none" stroke="#c7f4df" stroke-width="4" stroke-linecap="round" opacity=".8"/>';
    ground += '<path d="M1235 977Q1241 1058 1301 1085Q1399 1118 1472 1035M1292 941Q1362 948 1433 951" fill="none" stroke="#96d5b8" stroke-width="7" opacity=".6"/>';
    [[1324,1006,1],[1434,1005,.7],[1376,1067,.6]].forEach(p => {
      ground += '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')"><ellipse cy="3" rx="20" ry="8" fill="#236e7940"/><path d="M0 0L17-5Q23 5 13 10Q-10 17-19 6Q-22-6-3-8Z" fill="#7cad72" stroke="#477e65" stroke-width="1.8"/><path d="M-12 4L0 0L11 7M-10-3L0 0" fill="none" stroke="#b4d58b" stroke-width="1.2"/></g>';
    });
    // Main village paths. Their quiet stone surface deliberately gives feet,
    // player names and door labels a readable area between flower clusters.
    const paths = [
      'M500 1010Q613 1069 760 1060Q906 1054 918 943L920 824',
      'M920 956Q1087 994 1133 1130Q1236 1194 1448 1180',
      'M920 936Q1047 895 1194 865Q1324 823 1569 821',
      'M920 572L920 539Q911 502 845 503L718 504L662 571',
      'M928 497L1004 419H1208L1325 488L1349 518',
      'M650 417L603 419L486 419'
    ];
    paths.forEach((d, i) => { const sw = i < 3 ? 77 : i === 5 ? 55 : 57; ground += '<path d="' + d + '" fill="none" stroke="#83945c" stroke-width="' + (sw + 13) + '" stroke-linecap="round" stroke-linejoin="round" opacity=".43"/><path d="' + d + '" fill="none" stroke="url(#' + prefix + '-path)" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'; });
    ground += '<path d="M502 1010Q400 954 322 850M442 608Q525 618 587 562M1490 818Q1516 780 1540 730M250 680Q253 750 322 850" fill="none" stroke="#83945c" stroke-width="51" stroke-linecap="round" opacity=".35"/><path d="M502 1010Q400 954 322 850M442 608Q525 618 587 562M1490 818Q1516 780 1540 730M250 680Q253 750 322 850" fill="none" stroke="url(#' + prefix + '-path)" stroke-width="43" stroke-linecap="round"/>';
    ground += '<ellipse cx="919" cy="941" rx="112" ry="82" fill="url(#' + prefix + '-path)" stroke="#c5b280" stroke-width="6"/><ellipse cx="919" cy="941" rx="89" ry="62" fill="none" stroke="#f7e9bc" stroke-width="3"/>';
    // A star mosaic, a sun-facing gathering spot rather than another menu tile.
    ground += '<path d="M919 912l8 19 21 2-16 13 4 20-17-10-18 10 5-20-16-13 21-2Z" fill="#b7c78a" stroke="#a3b773" stroke-width="2" opacity=".7"/>';
    let seed = 394721;
    function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    function nearPath(x, y) {
      if (Math.hypot((x - 920) * .75, y - 943) < 128) return true;
      if (x > 797 && x < 1044 && y > 580 && y < 1000) return true;
      if (x > 439 && x < 795 && y > 963 && y < 1110) return true;
      if (x > 995 && x < 1615 && y > 780 && y < 928) return true;
      if (x > 1040 && x < 1211 && y < 750) return true;
      if (x > 595 && x < 708 && y > 460 && y < 670) return true;
      if (x > 703 && x < 1430 && y > 445 && y < 610) return true;
      if (x > 338 && x < 685 && y > 376 && y < 581) return true;
      return ((x - 1390) / 221) ** 2 + ((y - 1000) / 160) ** 2 < 1;
    }
    for (let i = 0; i < 1400; i++) {
      const x = 91 + random() * 1620, y = 170 + random() * 1060;
      if (nearPath(x, y)) continue;
      const s = rawSurface(x, y), yy = y - s.height, size = 3 + random() * 4;
      const color = i % 3 ? '#507e44' : '#edf0ad';
      ground += '<path d="M' + x.toFixed(1) + ' ' + yy.toFixed(1) + 'l-3-' + size.toFixed(1) + 'm3 ' + size.toFixed(1) + 'l1-' + (size + 3).toFixed(1) + 'm-1 ' + (size + 3).toFixed(1) + 'l5-' + (size - 1).toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="1.4" stroke-linecap="round" opacity=".34"/>';
    }
    const flowerBeds = [[670,948,0,1],[579,1079,0,1],[824,1088,0,0],[1029,886,0,1],[1207,858,0,0],[1207,1132,0,1],[1501,1099,0,0],[325,742,0,0],[787,429,72,0],[986,385,72,1],[1228,616,72,1],[1434,559,72,0],[1440,650,72,1],[567,487,120,1]];
    flowerBeds.forEach((f, idx) => {
      prop('flowers-' + idx, 'flowers', f[0], f[1], f[2], 88 + idx % 4 * 12, 'foliage', { depth: f[1] - 10 });
    });
    // Keep tiny pond highlights and a sheltered cave entrance behind real rocks.
    ground += '<path d="M1540 754Q1580 716 1608 763L1606 802H1540Z" fill="#294c45" stroke="#708a67" stroke-width="5"/><path d="M1555 774Q1574 748 1593 775V801H1555Z" fill="#1c3634"/><ellipse cx="1575" cy="803" rx="41" ry="15" fill="#637f5c" opacity=".5"/>';
    cache = { ground, objects, portals, discoveries, travelLinks, solids, surfaces: { plateau, garden, mainRamp, gardenRamp, bridge, lowerBridge, logPlatform, woodRamp, river }, sourceAssets: ['assets/painted-forest-props.png', 'assets/forest-town-landmarks.png', 'assets/forest-town-foliage.png', 'assets/forest-town-exploration.png'] };
    return cache;
  }
  function scalePoint(point) { return Object.assign({}, point, { x: point.x * WORLD_SCALE, y: point.y * WORLD_SCALE, height: (point.height || 0) * WORLD_SCALE }); }
  function scaleRect(rect) {
    const scaled = Object.assign({}, rect);
    ['x','y','w','h','height','low','high'].forEach(key => { if (Number.isFinite(scaled[key])) scaled[key] *= WORLD_SCALE; });
    if (scaled.centerLine) scaled.centerLine = scaled.centerLine.map(scalePoint);
    return scaled;
  }
  const publicPortals = portals.map(scalePoint), publicDiscoveries = discoveries.map(scalePoint);
  const publicLinks = travelLinks.map(link => Object.assign({}, link, { from: scalePoint(link.from), to: scalePoint(link.to) }));
  const publicSurfaces = Object.freeze(Object.fromEntries(Object.entries({ plateau, garden, mainRamp, gardenRamp, bridge, lowerBridge, logPlatform, woodRamp, river }).map(([key, value]) => [key, scaleRect(value)])));
  let publicCache;
  function publicBuild(options) {
    if (publicCache) return publicCache;
    const data = build(options);
    const scaledObjects = data.objects.map(object => {
      const result = Object.assign({}, object, scalePoint(object), { depth: object.depth * WORLD_SCALE });
      if (object.terrain) ['width','heightPixels','anchorX','anchorY'].forEach(key => { result[key] *= WORLD_SCALE; });
      if (object.landmark) {
        const portal = publicPortals.find(p => p.id === object.landmark), frame = frames[object.kind];
        const thresholds = { shop: [218,566], school: [368,570], observatory: [208,605] };
        const threshold = thresholds[object.kind], scale = object.width / frame.source[2];
        result.x = portal.x - (threshold[0] - frame.anchor[0]) * scale;
        result.y = portal.y - (threshold[1] - frame.anchor[1]) * scale;
        result.depth = portal.y - 10;
      }
      return result;
    });
    publicCache = Object.assign({}, data, { ground: '<g transform="scale(' + WORLD_SCALE + ')">' + data.ground + '</g>', objects: scaledObjects,
      portals: publicPortals, discoveries: publicDiscoveries, travelLinks: publicLinks, surfaces: publicSurfaces,
      solids: data.solids.map(solid => Object.assign({}, scaleRect(solid), solid.radius ? { radius: solid.radius * WORLD_SCALE } : {})) });
    return publicCache;
  }
  function publicSurface(x, y, height) {
    const surface = surfaceAt(x / WORLD_SCALE, y / WORLD_SCALE, Number.isFinite(height) ? height / WORLD_SCALE : undefined);
    return Object.assign({}, surface, { height: surface.height * WORLD_SCALE });
  }
  window.QPVillageScene = Object.freeze({ width: WIDTH * WORLD_SCALE, height: HEIGHT * WORLD_SCALE, spawn: Object.freeze(scalePoint(spawn)),
    heights: Object.freeze([0,108,180,240]), surfaceAt: publicSurface,
    canStand: (x,y,height,radius) => canStand(x / WORLD_SCALE,y / WORLD_SCALE,Number.isFinite(height) ? height / WORLD_SCALE : undefined,Number.isFinite(radius) ? radius / WORLD_SCALE : 11 / WORLD_SCALE),
    project, build: publicBuild, portals: publicPortals, discoveries: publicDiscoveries, travelLinks: publicLinks, surfaces: publicSurfaces });
})();
