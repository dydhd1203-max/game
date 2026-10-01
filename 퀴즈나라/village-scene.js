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
  solids[3].x = 745;
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
    return { height: 0, level: 0, label: inside(x, y, lowerBridge) ? '개울 나무다리' : '숲속 마을 광장' };
  }
  function surfaceAt(x, y, currentHeight) {
    const surface = rawSurface(x, y);
    let reason = '';
    if (!Number.isFinite(x) || !Number.isFinite(y)) reason = 'invalid';
    else if (x < 84 || x > WIDTH - 84 || y < 155 || y > HEIGHT - 75) reason = 'boundary';
    else if (window.QPVillageWaterAssets.containsCanal(x,y)) reason = 'river';
    else if (window.QPVillageWaterAssets.containsPond(x,y)) reason = 'pond';
    else if (surface.height < 12 && window.QPVillageWaterAssets.containsBrook(x,y)) reason = 'brook';
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
    if (window.QPVillageWaterAssets.containsCanal(x,y,radius) ||
        window.QPVillageWaterAssets.containsPond(x,y,radius) ||
        (surface.height < 12 && window.QPVillageWaterAssets.containsBrook(x,y,radius))) return false;
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
  function stonePaving(prefix) {
    // User-provided stone pixels, shown as mirrored source rectangles so the
    // opposite texture edges meet without a color jump. No painted SVG bricks.
    const road = '<svg width="96" height="128" viewBox="320 590 120 160" overflow="hidden"><image href="./assets/village-library/originals/village-841cd8ade4d81085.jpg" width="736" height="1104"/></svg>';
    const mirror = (tile,w,h) => tile + '<g transform="translate(' + (w*2) + ' 0) scale(-1 1)">' + tile + '</g><g transform="translate(0 ' + (h*2) + ') scale(1 -1)">' + tile + '</g><g transform="translate(' + (w*2) + ' ' + (h*2) + ') scale(-1 -1)">' + tile + '</g>';
    return '<pattern id="' + prefix + '-path" width="192" height="256" patternUnits="userSpaceOnUse">' + mirror(road,96,128) + '</pattern>';
  }
  function originalCliffStrip(prefix, x, y, width) {
    const outline = "M333 219L337 216L342 216L346 214L350 215L350 210L352 207L350 202L352 198L355 197L356 192L360 189L363 189L366 194L368 194L370 199L370 203L375 207L375 209L378 211L379 217L383 215L399 214L411 214L418 216L425 217L438 218L448 221L455 222L464 220L473 219L476 216L481 216L486 214L491 213L493 211L494 207L498 206L498 203L500 201L503 202L505 206L507 204L511 205L513 208L515 210L515 213L517 215L521 214L532 214L541 215L547 217L551 215L556 214L559 216L561 222L561 232L559 240L561 245L558 253L553 258L547 258L540 263L535 268L523 268L518 266L516 260L510 256L505 254L499 254L494 257L489 258L484 265L478 265L473 265L469 267L461 266L457 264L451 265L446 263L441 265L435 264L431 262L422 264L414 263L407 263L397 262L391 260L388 264L380 263L378 260L373 258L368 256L364 255L361 258L355 256L349 257L345 259L340 262L334 262L333 251L334 244L333 236L334 229L332 224L333 219Z";
    const clip = prefix + '-original-cliff';
    let result = '<g><defs><clipPath id="' + clip + '" clipPathUnits="userSpaceOnUse"><path d="' + outline + '"/></clipPath></defs>';
    for (let at=x, index=0;at<x+width;at+=210,index++) {
      const mirror = index%2 ? ' transform="translate(895 0) scale(-1 1)"' : '';
      result += '<svg x="' + at + '" y="' + y + '" width="230" height="80.65" viewBox="332 188 231 81" overflow="hidden"><g' + mirror + '><image href="./assets/map-library/originals/reference-download-07.jpg" width="735" height="490" clip-path="url(#' + clip + ')"/></g></svg>';
    }
    return result + '</g>';
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
    prop('wood-stairs', 'woodStairs', 320.3967, 867.1016, 0, 326, 'exploration', { depth: 662, terrain: true });
    prop('high-log-tower', 'logTower', 1541.9253, 736.9310, 0, 335, 'exploration', { depth: 600, climbLandmark: true });
    prop('secret-cave', 'cave', 246.1774, 691.2130, 0, 250, 'exploration', { depth: 673 });
    solids.push({ id: 'log-root', x: 1543, y: 697, radius: 32 / WORLD_SCALE, height: 0 });
    prop('well', 'well', 745, 999, 0, 107, true);
    prop('caretaker-cottage', 'cottage', 1490, 1174, 0, 165, true, { depth: 1159 });

    // Clusters follow the banks and the village edge; sizes and spacing vary.
    const treeLocations = [
      [125,255,190],[245,200,177],[365,206,160],[515,194,191],[695,200,166],[860,184,170],[1022,198,146],[1210,190,192],[1400,208,176],[1530,246,191],[1650,334,190],
      [162,465,172],[175,654,201],[242,805,164],[164,920,200],[200,1120,212],[300,1237,191],[458,1250,174],[631,1240,181],[820,1260,211],[1013,1249,175],[1180,1255,167],[1640,1196,214],[1645,1024,198],[1655,843,205],[1606,635,185],[1600,481,171],
      [320,695,135,72],[410,668,121,72],[758,360,150,72],[900,368,121,72],[1237,346,118,72],[1440,375,131,72],[1433,674,127,72],
      [337,1081,130],[689,1108,112],[1025,1168,132],[1194,1181,139],[1530,943,113],[1273,836,109],[720,862,115],[350,913,107],
      [622,785,235,0,'willow'],[776,828,160,0,'oak'],[630,1140,180,0,'flowering']
    ];
    treeLocations.forEach((t, i) => {
      const h = t[3] || 0;
      const kind = t[4] || ([0,2,3,5,7,9,12,16,18,20,22,25,26].includes(i) ? 'fir' : [15,17,29,32,34,41].includes(i) ? 'flowering' : [37,38].includes(i) ? 'willow' : 'oak');
      const width = kind === 'willow' ? (t[4] ? t[2] : 211) : kind === 'flowering' ? Math.max(150, t[2]) : t[2];
      prop(kind + '-' + i, kind, t[0], t[1], h, width, kind === 'oak' ? true : 'foliage', { variation: i % 4 });
      // Canopies overlap routes naturally; only the actual trunk is solid.
      solids.push({ id: kind + '-' + i, x: t[0], y: t[1] - 7 / WORLD_SCALE, radius: width * .083 / WORLD_SCALE, height: h });
    });
    const rocks = [[289,841,112,0],[1180,845,117,0],[1240,1047,128,0],[1535,792,190,0],[1580,879,128,0],[316,577,106,72],[719,647,83,72],[1446,736,90,72],[385,329,95,72],[979,317,75,72],[1230,740,97,72],[1675,1070,115,0],[371,1168,108,0]];
    rocks.forEach((r, i) => {
      prop('rock-' + i, 'rock', r[0], r[1], r[3], r[2], true);
      solids.push({ id: 'rock-' + i, x: r[0], y: r[1] - 8 / WORLD_SCALE, radius: r[2] * .24 / WORLD_SCALE, height: r[3] });
    });
    // Existing atlas lanterns and the bridge replace the earlier vector props.
    const lamps = [[592,1030,0],[860,879,0],[994,879,0],[811,704,72],[1249,540,72],[1458,607,72],[584,553,120]];
    lamps.forEach((p,i) => objects.push(Object.assign({id:'lamp-'+i,x:p[0],y:p[1],height:p[2],depth:p[1]},window.QPVillageNeighborhood.sprite('lantern',55,false))));
    // Match the original deck to the real crossing height. The front rope is
    // a second source clip so walkers stand on the deck between both rails.
    prop('brook-bridge', 'bridge', 1165, 902, 0, 255, false, {depth:850});
    const brookRail = cropSprite('bridge', 255, false, {id:prefix+'-brook-front',path:'M0 855Q335 916 690 849V965H0Z'});
    objects.push(Object.assign({id:'brook-bridge-front-rope',x:1165,y:902,height:0,depth:935,foreground:true},brookRail));

    const terraceShape = 'M281 177Q461 153 638 177T986 173T1299 176Q1405 151 1488 178V667Q1420 685 1300 667T1100 667T834 671T570 667Q370 682 281 668Z';
    const gardenShape = 'M340 260Q460 245 558 261T680 260V459Q563 473 453 459T340 460Z';
    const cliffShape = 'M280 178H1490V668Q1466 706 1438 717L1300 741L1178 728Q1155 749 1134 760L1053 737L1010 744L965 727L830 743L764 730L670 748L506 722L372 746Q311 740 280 712Z';
    const defs = '<defs>' +
      '<radialGradient id="' + prefix + '-tree-shade"><stop stop-color="#315449" stop-opacity=".35"/><stop offset=".6" stop-color="#385e4d" stop-opacity=".17"/><stop offset="1" stop-color="#315449" stop-opacity="0"/></radialGradient>' +
      '<pattern id="' + prefix + '-grass-paint" width="640" height="640" patternUnits="userSpaceOnUse" viewBox="0 0 1254 1254"><image href="./assets/painted-grass-ground.png" width="1254" height="1254"/></pattern>' +
      '<clipPath id="' + prefix + '-garden-face"><path d="M340 260H680V460Q668 492 650 497L512 509L392 497Q357 496 340 474Z"/></clipPath><clipPath id="' + prefix + '-terrace"><path d="' + terraceShape + '"/></clipPath><clipPath id="' + prefix + '-garden"><path d="' + gardenShape + '"/></clipPath><clipPath id="' + prefix + '-cliff-face"><path d="' + cliffShape + '"/></clipPath>' +
      stonePaving(prefix) + window.QPVillageWaterAssets.defs(prefix) + '</defs>';
    let ground = defs + '<rect width="1800" height="1300" fill="url(#' + prefix + '-grass-paint)"/>';
    // Front faces are genuine elevation silhouettes; walking is only possible
    // via the two stairs, never directly through the rendered rock wall.
    ground += '<g clip-path="url(#' + prefix + '-cliff-face)">' + originalCliffStrip(prefix,280,657,1210) + '</g>';
    // Only the terrace footprint projects down to its retaining face. Removing
    // the old outline/contour paths prevents seams through the upper meadow.
    ground += '<path d="' + terraceShape + '" fill="url(#' + prefix + '-grass-paint)"/>';
    ground += '<g clip-path="url(#' + prefix + '-terrace)"><rect x="278" y="154" width="1215" height="530" fill="url(#' + prefix + '-grass-paint)"/></g>';
    ground += '<g clip-path="url(#' + prefix + '-garden-face)">' + originalCliffStrip(prefix + '-garden',340,449,340) + '</g><path d="' + gardenShape + '" fill="url(#' + prefix + '-grass-paint)"/>';
    ground += '<g clip-path="url(#' + prefix + '-garden)"><rect x="337" y="245" width="348" height="230" fill="url(#' + prefix + '-grass-paint)"/></g>';
    treeLocations.forEach(t => {
      const p = project(t[0],t[1],t[3]||0), rx = t[2] * .44 / WORLD_SCALE, ry = t[2] * .21 / WORLD_SCALE;
      ground += '<ellipse cx="' + (p.x + rx * .41).toFixed(1) + '" cy="' + (p.y + ry * .05).toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" transform="rotate(-17 ' + p.x + ' ' + p.y + ')" fill="url(#' + prefix + '-tree-shade)"/>';
    });
    // The supplied river/pond JPEG is clipped to its original shore contour.
    ground += window.QPVillageWaterAssets.ground(prefix);
    // Main village paths. Their quiet stone surface deliberately gives feet,
    // player names and door labels a readable area between flower clusters.
    const paths = [
      'M510 1023L518 1064Q649 1093 774 1082Q916 1080 963 1011L969 980',
      'M993 982Q1068 1055 1065 1172Q1122 1224 1448 1210',
      'M980 917Q1089 896 1194 865Q1324 823 1569 821',
      'M920 572L920 539Q911 502 845 503L718 504L662 571',
      'M928 497L1004 419H1208L1325 488L1349 518',
      'M650 417L603 419L486 419'
    ];
    paths.forEach((d, i) => { const sw = i < 3 ? 43 : i === 5 ? 34 : 38; ground += '<path d="' + d + '" fill="none" stroke="#456e55" stroke-width="' + (sw + 5) + '" stroke-linecap="round" stroke-linejoin="round" opacity=".19"/><path d="' + d + '" fill="none" stroke="url(#' + prefix + '-path)" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'; });
    ground += '<path d="M502 1010Q400 954 322 850M442 608Q525 618 587 562M1490 818Q1516 780 1540 730M250 680Q253 750 322 850" fill="none" stroke="#456e55" stroke-width="36" stroke-linecap="round" opacity=".12"/><path d="M502 1010Q400 954 322 850M442 608Q525 618 587 562M1490 818Q1516 780 1540 730M250 680Q253 750 322 850" fill="none" stroke="url(#' + prefix + '-path)" stroke-width="30" stroke-linecap="round"/>';
    ground += '<ellipse cx="919" cy="941" rx="112" ry="82" fill="url(#' + prefix + '-path)" stroke="#baa17a" stroke-width="5"/><ellipse cx="919" cy="941" rx="89" ry="62" fill="none" stroke="#e4d4ad" stroke-width="3"/>';
    // The supplied stone material forms the gathering court.
    const flowerBeds = [[670,948,0,1],[579,1079,0,1],[824,1088,0,0],[1029,886,0,1],[1207,858,0,0],[1207,1132,0,1],[1501,1099,0,0],[325,742,0,0],[787,429,72,0],[986,385,72,1],[1228,616,72,1],[1434,559,72,0],[1440,650,72,1],[567,487,120,1]];
    flowerBeds.forEach((f, idx) => {
      prop('flowers-' + idx, 'flowers', f[0], f[1], f[2], 88 + idx % 4 * 12, 'foliage', { depth: f[1] - 10 });
    });
    const neighborhood = window.QPVillageNeighborhood && window.QPVillageNeighborhood.decorate({ id: prefix, surfaceAt: rawSurface }) || {};
    ground += neighborhood.ground || '';
    objects.push(...(neighborhood.objects || []));
    solids.push(...(neighborhood.solids || []).map(solid => Object.assign({ height: 0 }, solid)));
    const sourceAssets = [...new Set(['assets/painted-forest-props.png', 'assets/forest-town-landmarks.png', 'assets/forest-town-foliage.png', 'assets/forest-town-exploration.png', 'assets/painted-grass-ground.png', 'assets/village-library/originals/village-841cd8ade4d81085.jpg', 'assets/map-library/originals/reference-download-07.jpg', ...window.QPVillageWaterAssets.sourceAssets, ...(neighborhood.sourceAssets || [])])];
    cache = { ground, objects, portals: [...portals, ...(neighborhood.portals || [])], npcs: neighborhood.npcs || [], discoveries: [...discoveries, ...(neighborhood.discoveries || [])], travelLinks, solids, surfaces: { plateau, garden, mainRamp, gardenRamp, bridge, lowerBridge, logPlatform, woodRamp, river }, sourceAssets };
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
      const result = Object.assign({}, object, scalePoint(object), { depth: (Number.isFinite(object.depth) ? object.depth : object.y) * WORLD_SCALE });
      if (object.terrain) ['width','heightPixels','anchorX','anchorY'].forEach(key => { result[key] *= WORLD_SCALE; });
      if (object.landmark) {
        const portal = publicPortals.find(p => p.id === object.landmark), frame = frames[object.kind];
        const thresholds = { shop: [218,566], school: [368,570], observatory: [208,605] };
        const threshold = thresholds[object.kind];
        if (portal && frame && threshold) {
          const scale = object.width / frame.source[2];
          result.x = portal.x - (threshold[0] - frame.anchor[0]) * scale;
          result.y = portal.y - (threshold[1] - frame.anchor[1]) * scale;
          result.depth = portal.y - 10;
        }
      }
      return result;
    });
    publicCache = Object.assign({}, data, { ground: '<g transform="scale(' + WORLD_SCALE + ')">' + data.ground + '</g>', objects: scaledObjects,
      portals: data.portals.map(scalePoint), npcs: data.npcs.map(scalePoint), discoveries: data.discoveries.map(scalePoint), travelLinks: publicLinks, surfaces: publicSurfaces,
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
