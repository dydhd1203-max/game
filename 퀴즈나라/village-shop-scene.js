/* 새잎 옷 가게: 발 위치를 기준으로 걷는 숲속 마을의 실내 장면.
   Original PNGs are reused without resampling or background removal. The room
   placement and atlas rectangles come from the adjacent asset JSON records.
   Furniture has small ground footprints; the central rug remains walkable. */
(function () {
  'use strict';
  const WIDTH = 1100, HEIGHT = 850;
  const spawn = Object.freeze({ x: 550, y: 675, height: 0 });
  // The front rail is solid except for the painted central entrance/steps.
  // Feet stay inside the sloping inner side walls, rather than an invisible
  // rectangular floor that would allow walking through the illustrated posts.
  const floorPolygon = Object.freeze([
    [171, 345], [929, 345], [1010, 679], [657, 679],
    [657, 808], [443, 808], [443, 679], [90, 679]
  ].map(point => Object.freeze(point)));
  const solids = Object.freeze([
    Object.freeze({ id: 'fitting-platform', type: 'ellipse', x: 330, y: 393, rx: 94, ry: 18 }),
    Object.freeze({ id: 'catalog-counter', type: 'rect', x: 653, y: 350, w: 238, h: 43 }),
    Object.freeze({ id: 'fitting-room', type: 'rect', x: 143, y: 516, w: 124, h: 56 }),
    Object.freeze({ id: 'varied-clothes-rack', type: 'rect', x: 750, y: 513, w: 202, h: 34 }),
    Object.freeze({ id: 'mannequin-bases', type: 'rect', x: 786, y: 630, w: 147, h: 20 }),
    Object.freeze({ id: 'clerk-space', type: 'ellipse', x: 550, y: 510, rx: 13, ry: 10 }),
    Object.freeze({ id: 'owner-space', type: 'ellipse', x: 915, y: 375, rx: 13, ry: 10 })
  ]);
  const npcs = Object.freeze([
    Object.freeze({ id: 'owner', name: '새잎 주인', x: 915, y: 375, height: 0,
      avatar: Object.freeze({ sex: 'f', sk: 0, ec: 2, eyes: 'big', expression: 'soft:0', hair: 'bob:2', top: 'shirt:4', bottom: 'skirt:4', shoes: 'dress:1', hat: '', glass: '', ear: '', neck: '', back: '', pet: '', bg: '', frame: '', effect: '' }),
      lines: Object.freeze(['어서 와요! 새잎 옷 가게의 주인이에요.', '숲빛 셔츠부터 반짝이는 별 망토까지, 마음에 드는 옷을 찾아봐요.']),
      choices: Object.freeze([Object.freeze({ label: '옷 구경하기', action: 'catalog' }), Object.freeze({ label: '다음에 볼게요', action: 'close' })]) }),
    Object.freeze({ id: 'clerk', name: '도토리 알바생', x: 550, y: 510, height: 0,
      avatar: Object.freeze({ sex: 'm', sk: 1, ec: 1, eyes: 'big', expression: 'soft:0', hair: 'crop:1', top: 'vest:4', bottom: 'jeans:5', shoes: 'dress:1', hat: '', glass: '', ear: '', neck: '', back: '', pet: '', bg: '', frame: '', effect: '' }),
      lines: Object.freeze(['안녕! 나는 피팅룸을 도와주는 도토리예요.', '옷을 입어 보고 싶은가요? 가지고 있는 옷도 거울 앞에서 갈아입을 수 있어요.']),
      choices: Object.freeze([Object.freeze({ label: '피팅룸에서 입어 보기', action: 'fitting' }), Object.freeze({ label: '내 옷장 열기', action: 'wardrobe' }), Object.freeze({ label: '조금 더 둘러볼게요', action: 'close' })]) })
  ]);
  const portals = Object.freeze([
    Object.freeze({ id: 'catalog', label: '주인과 이야기', x: 910, y: 430, height: 0, radius: 55, action: 'talk', npc: 'owner', description: '옷 가게 주인에게 옷과 머리, 펫을 보여 달라고 해요.' }),
    Object.freeze({ id: 'clerk', label: '알바생과 이야기', x: 550, y: 555, height: 0, radius: 55, action: 'talk', npc: 'clerk', labelOffsetX: 115, labelOffsetY: -90, description: '도토리에게 피팅룸과 내 옷장을 안내받아요.' }),
    Object.freeze({ id: 'wardrobe', label: '내 옷장', x: 330, y: 430, height: 0, radius: 47, action: 'wardrobe', description: '거울 앞에서 가지고 있는 옷을 입어 봐요.' }),
    Object.freeze({ id: 'fitting', label: '피팅룸 입어 보기', x: 230, y: 615, height: 0, radius: 46, action: 'fitting', description: '잎사귀 커튼 앞에서 마음에 드는 옷을 입어 봐요.' }),
    Object.freeze({ id: 'exit', label: '마을로 나가기', x: 550, y: 745, height: 0, radius: 42, action: 'village', description: '문을 지나 우리 반 친구들이 모이는 마을로 돌아가요.' })
  ]);
  const frames = Object.freeze({
    sign: Object.freeze({ source: [125, 41, 667, 361], anchor: [333, 349] }),
    platform: Object.freeze({ source: [935, 127, 803, 286], anchor: [402, 273] }),
    rack: Object.freeze({ source: [125, 481, 611, 380], anchor: [306, 367] }),
    tailoring: Object.freeze({ source: [956, 537, 734, 328], anchor: [367, 315] }),
    fittingRoom: Object.freeze({ source: [11, 15, 657, 677], anchor: [328, 648], details: true }),
    mannequins: Object.freeze({ source: [705, 128, 551, 545], anchor: [275, 517], details: true }),
    clothesRack: Object.freeze({ source: [1270, 29, 898, 667], anchor: [447, 643], details: true })
  });
  const sources = Object.freeze([
    'assets/forest-town-tailor-room.png', 'assets/forest-shop-props.png',
    'assets/forest-village-frame.png', 'assets/woodland-home-painted.png',
    'assets/forest-town-tailor-details.png'
  ]);

  function pointInside(x, y) {
    let inside = false;
    for (let i = 0, j = floorPolygon.length - 1; i < floorPolygon.length; j = i++) {
      const a = floorPolygon[i], b = floorPolygon[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function distanceToEdge(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  }
  function hitsFurniture(x, y, radius) {
    for (const solid of solids) {
      if (solid.type === 'ellipse') {
        if (((x - solid.x) / (solid.rx + radius)) ** 2 + ((y - solid.y) / (solid.ry + radius)) ** 2 <= 1) return true;
      } else {
        if (x >= solid.x && x <= solid.x + solid.w && y >= solid.y && y <= solid.y + solid.h) return true;
        const nearestX = Math.max(solid.x, Math.min(solid.x + solid.w, x));
        const nearestY = Math.max(solid.y, Math.min(solid.y + solid.h, y));
        if (Math.hypot(x - nearestX, y - nearestY) < radius) return true;
      }
    }
    return false;
  }
  function surfaceAt(x, y, currentHeight) {
    let reason = '';
    if (!Number.isFinite(x) || !Number.isFinite(y)) reason = 'invalid';
    else if (!pointInside(x, y)) reason = 'wall';
    else if (Number.isFinite(currentHeight) && Math.abs(currentHeight) > 12) reason = 'height';
    else if (hitsFurniture(x, y, 0)) reason = 'furniture';
    return { allowed: !reason, height: 0, level: 0, label: '새잎 옷 가게', reason };
  }
  function canStand(x, y, currentHeight, radius) {
    const surface = surfaceAt(x, y, currentHeight);
    if (!surface.allowed) return false;
    radius = Number.isFinite(radius) ? Math.max(0, radius) : 12;
    for (let i = 0; i < floorPolygon.length; i++) {
      if (distanceToEdge(x, y, floorPolygon[i], floorPolygon[(i + 1) % floorPolygon.length]) < radius) return false;
    }
    return !hitsFurniture(x, y, radius);
  }
  function project(x, y, height) { return { x, y: y - (Number(height) || 0) }; }
  function svg(width, height, art) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true" focusable="false">' + art + '</svg>';
  }
  function paintedProp(id, kind, x, y, width, additions) {
    const frame = frames[kind], scale = width / frame.source[2];
    const clipId = 'tailor-crop-' + id;
    const image = frame.details ? '<image href="./assets/forest-town-tailor-details.png" width="2172" height="724"/>' : '<image href="./assets/forest-shop-props.png" width="1774" height="887"/>';
    const art = '<defs><clipPath id="' + clipId + '"><rect x="' + frame.source[0] + '" y="' + frame.source[1] + '" width="' + frame.source[2] + '" height="' + frame.source[3] + '"/></clipPath></defs><g clip-path="url(#' + clipId + ')">' + image + (additions || '') + '</g>';
    return { id, kind, x, y, height: 0, depth: y, width,
      heightPixels: frame.source[3] * scale,
      anchorX: frame.anchor[0] * scale, anchorY: frame.anchor[1] * scale,
      markup: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="' + frame.source.join(' ') + '" style="overflow:hidden" aria-hidden="true" focusable="false">' + art + '</svg>' };
  }
  // Preserve the original painted frame's corner scale on a tall mirror.
  // Only its eight transparent border slices are drawn; the glass is separate.
  function mirrorFrame(x, y, width, height) {
    const srcX = [0, 385, 1151], srcY = [0, 240, 784];
    const srcW = [385, 766, 385], srcH = [240, 544, 240];
    const border = 17, dstX = [x, x + border, x + width - border], dstY = [y, y + border, y + height - border];
    const dstW = [border, width - border * 2, border], dstH = [border, height - border * 2, border];
    let art = '';
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      art += '<svg x="' + dstX[col] + '" y="' + dstY[row] + '" width="' + dstW[col] + '" height="' + dstH[row] + '" viewBox="' + [srcX[col], srcY[row], srcW[col], srcH[row]].join(' ') + '" preserveAspectRatio="none" style="overflow:hidden"><image href="./assets/forest-village-frame.png" width="1536" height="1024"/></svg>';
    }
    return art;
  }
  function fittingMirror(prefix) {
    const id = prefix + '-mirror';
    let art = '<defs><linearGradient id="' + id + '-glass" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#fff9de"/><stop offset=".25" stop-color="#e1f5e5"/><stop offset=".65" stop-color="#a9d5cd"/><stop offset="1" stop-color="#d1e9da"/></linearGradient><linearGradient id="' + id + '-wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edc37d"/><stop offset=".5" stop-color="#af763f"/><stop offset="1" stop-color="#714f32"/></linearGradient><clipPath id="' + id + '-clip"><rect x="31" y="18" width="118" height="205" rx="9"/></clipPath></defs>';
    art += '<ellipse cx="91" cy="273" rx="64" ry="9" fill="#42553f" opacity=".18"/><path d="M41 221L34 267H50L57 221M124 221L132 267H148L140 221" fill="url(#' + id + '-wood)" stroke="#8d633d" stroke-width="2"/><path d="M38 263H143L151 274H31Z" fill="url(#' + id + '-wood)" stroke="#805d3d" stroke-width="2"/><path d="M45 265H139" stroke="#f7d393" stroke-width="2"/>';
    art += '<rect x="24" y="8" width="132" height="226" rx="12" fill="#7f633c"/><rect x="31" y="18" width="118" height="205" rx="9" fill="url(#' + id + '-glass)" stroke="#b8c2a0" stroke-width="2"/>';
    art += '<g clip-path="url(#' + id + '-clip)"><path d="M14 67L86 13H111L23 160ZM50 222L156 104V133L74 225Z" fill="#ffffff" opacity=".36"/><path d="M28 176Q84 155 153 174V223H28Z" fill="#81aca1" opacity=".2"/><path d="M111 25L56 104M114 43L92 77" stroke="#ffffff" stroke-width="3" opacity=".65" stroke-linecap="round"/></g>';
    art += mirrorFrame(17, 2, 146, 237);
    return { id: 'fitting-mirror', kind: 'mirror', x: 330, y: 367, height: 0, depth: 367,
      width: 156, heightPixels: 244.4, anchorX: 78, anchorY: 238.3, markup: svg(180, 282, art) };
  }
  function build(options) {
    const prefix = 'tailor-' + String(typeof options === 'string' ? options : (options && options.id) || 'room').replace(/[^a-zA-Z0-9_-]/g, '');
    const ground = svg(WIDTH, HEIGHT,
      '<image href="./assets/woodland-home-painted.png" width="1100" height="850" preserveAspectRatio="xMidYMid slice"/>' +
      '<rect width="1100" height="850" fill="#36513f" opacity=".16"/>' +
      '<image href="./assets/forest-town-tailor-room.png" x="0" y=".263" width="1100" height="849.474" preserveAspectRatio="xMidYMid meet"/>');
    const objects = [
      paintedProp('shop-sign', 'sign', 550, 318, 215,
        '<text x="450" y="307" text-anchor="middle" font-family="Jua, NanumSquareRound, sans-serif" font-size="48" font-weight="800" fill="#44512e">새잎 옷 가게</text>'),
      fittingMirror(prefix),
      paintedProp('fitting-platform', 'platform', 330, 409, 210),
      paintedProp('catalog-counter', 'tailoring', 770, 392, 285),
      paintedProp('fitting-room', 'fittingRoom', 205, 570, 165),
      paintedProp('varied-clothes-rack', 'clothesRack', 850, 545, 245),
      paintedProp('mannequin-display', 'mannequins', 860, 650, 175)
    ];
    return { ground, objects, portals, npcs, discoveries: [], solids, floorPolygon, sourceAssets: sources };
  }
  window.QPVillageShopScene = Object.freeze({ width: WIDTH, height: HEIGHT, spawn,
    surfaceAt, canStand, project, build, portals, discoveries: Object.freeze([]),
    npcs, solids, floorPolygon, sourceAssets: sources });
})();
