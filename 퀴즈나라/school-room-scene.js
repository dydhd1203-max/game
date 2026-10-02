/* Classroom artwork uses only original screenshot pixels through region/outline clips. */
(function () {
  'use strict';
  const ROOT = new URL('assets/classroom-library/originals/', document.currentScript.src).href;
  const SOURCES = {
    group: { path: ROOT + 'classroom-e41eb583796fc7b8.png', width: 1126, height: 904 },
    classroom: { path: ROOT + 'classroom-4dcb960dde3f19d2.png', width: 1296, height: 901 },
    corridor: { path: ROOT + 'classroom-70f5744d42cc639d.png', width: 1476, height: 879 }
  };
  const WIDTH = 2928, HEIGHT = 930;
  let clipNumber = 0;
  function image(source, x, y) {
    const s = SOURCES[source];
    return '<image href="' + s.path + '" x="' + x + '" y="' + y + '" width="' + s.width + '" height="' + s.height + '"/>';
  }
  function regionSvg(source, region, paths) {
    const [sx, sy, w, h] = region;
    const id = 'sr-source-' + (++clipNumber);
    const shape = paths && paths.length ? paths.map(d => '<path d="' + d + '"/>').join('') : '<rect width="' + w + '" height="' + h + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><defs><clipPath id="' + id + '">' + shape + '</clipPath></defs><g clip-path="url(#' + id + ')">' + image(source, -sx, -sy) + '</g></svg>';
  }
  function art(id, x, y, w, h, svg, depth, extra) {
    return '<div class="sr-art" data-art="' + id + '" data-floor-y="' + depth + '"' + (extra || '') + ' style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + depth + ';pointer-events:none">' + svg + '</div>';
  }
  function crop(id, source, region, x, y, depth, paths, extra) {
    return art(id, x, y, region[2], region[3], regionSvg(source, region, paths), depth, extra);
  }
  function texturePattern(id, source, region) {
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + region[2] + '" height="' + region[3] + '">' + image(source, -region[0], -region[1]) + '</pattern>';
  }
  function roomSurfaces() {
    // These rectangles are texture placement bounds, never painted wall/floor artwork.
    let defs = texturePattern('sr-wood', 'classroom', [30, 508, 64, 192]);
    defs += texturePattern('sr-cream', 'classroom', [340, 29, 200, 48]);
    defs += texturePattern('sr-blue', 'classroom', [822, 189, 94, 127]);
    defs += texturePattern('sr-group-blue', 'group', [350, 122, 280, 62]);
    defs += texturePattern('sr-hall-floor', 'corridor', [1130, 242, 230, 100]);
    defs += texturePattern('sr-dividing-wall', 'group', [827, 52, 62, 100]);
    const rect = (x, y, w, h, texture) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#sr-' + texture + ')"/>';
    let shapes = rect(0, 0, WIDTH, HEIGHT, 'cream');
    shapes += rect(25, 185, 801, HEIGHT - 185, 'wood');
    shapes += rect(25, 25, 801, 96, 'cream') + rect(25, 121, 801, 64, 'group-blue');
    shapes += rect(889, 317, 1088, HEIGHT - 317, 'wood');
    shapes += rect(889, 28, 1088, 160, 'cream') + rect(889, 188, 1088, 129, 'blue');
    shapes += rect(1977, 253, WIDTH - 1977, HEIGHT - 253, 'hall-floor');
    shapes += rect(1977, 28, WIDTH - 1977, 160, 'cream') + rect(1977, 188, WIDTH - 1977, 65, 'blue');
    shapes += rect(826, 0, 63, 345, 'dividing-wall') + rect(826, 795, 63, HEIGHT - 795, 'dividing-wall');
    // The original short white return wall leaves the group/main opening below it.
    shapes += '<g>' + image('group', 0, 0) + '</g>';
    const returnId = 'sr-return-wall';
    shapes = shapes.replace('<g>' + image('group', 0, 0) + '</g>', '<g clip-path="url(#' + returnId + ')">' + image('group', 0, 0) + '</g>');
    defs += '<clipPath id="' + returnId + '"><rect x="826" y="345" width="63" height="160"/></clipPath>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT + '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" aria-hidden="true"><defs>' + defs + '</defs>' + shapes + '</svg>';
    return art('source-room-surfaces', 0, 0, WIDTH, HEIGHT, svg, 0);
  }
  function projectionScreen() {
    // The blank panel and rails are assembled from visible clean source components.
    // Source3 has the clean lower gradient band hidden by the teacher label in source2.
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="522" height="317" viewBox="0 0 522 317" aria-hidden="true"><defs>';
    svg += '<clipPath id="sr-screen-body"><rect x="10" y="12" width="500" height="279"/></clipPath>';
    svg += '<pattern id="sr-screen-low" patternUnits="userSpaceOnUse" x="10" y="279" width="182" height="24">' + image('corridor', 0, -331) + '</pattern>';
    svg += '<clipPath id="sr-screen-rail-top"><rect width="522" height="14"/></clipPath>';
    svg += '<pattern id="sr-screen-lower-rail" patternUnits="userSpaceOnUse" x="10" y="304" width="182" height="13">' + image('corridor', 0, -357) + '</pattern>';
    svg += '<clipPath id="sr-screen-left-cap"><rect x="0" y="304" width="10" height="13"/></clipPath>';
    svg += '<clipPath id="sr-screen-right-cap"><rect x="0" y="304" width="10" height="13"/></clipPath>';
    svg += '</defs><g clip-path="url(#sr-screen-body)">' + image('classroom', -297, -78) + '</g>';
    svg += '<rect x="10" y="279" width="500" height="25" fill="url(#sr-screen-low)"/>';
    svg += '<g clip-path="url(#sr-screen-rail-top)">' + image('classroom', -297, -78) + '</g>';
    // The clean source3 rail has no teacher or guide overlay. Source2's left cap
    // supplies both ends, with the second original component reflected horizontally.
    svg += '<rect x="10" y="304" width="502" height="13" fill="url(#sr-screen-lower-rail)"/>';
    svg += '<g clip-path="url(#sr-screen-left-cap)">' + image('classroom', -297, -78) + '</g>';
    svg += '<g transform="translate(522 0) scale(-1 1)" clip-path="url(#sr-screen-right-cap)">' + image('classroom', -297, -78) + '</g>';
    svg += '</svg>';
    return art('projection-screen', 1157, 78, 522, 317, svg, 20);
  }
  function stage() {
    const id = 'sr-stage-outline';
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="574" height="119" viewBox="0 0 574 119" aria-hidden="true"><defs>';
    svg += '<clipPath id="' + id + '"><path d="M0 0H574V27C571 83 453 116 290 117C120 116 11 89 0 37Z"/></clipPath>';
    svg += '<clipPath id="sr-stage-visible"><path clip-rule="evenodd" d="M0 0H574V119H0Z M256 0H293V44H256Z M320 48H360V97H320Z M490 0H540V56H490Z"/></clipPath>';
    svg += '<clipPath id="sr-stage-teacher-gap"><rect x="256" y="0" width="40" height="44"/></clipPath>';
    svg += '<clipPath id="sr-stage-bulb-gap"><rect x="320" y="48" width="42" height="49"/></clipPath>';
    svg += '<clipPath id="sr-stage-guide-gap"><rect x="490" y="0" width="50" height="56"/></clipPath>';
    svg += '</defs><g clip-path="url(#' + id + ')">';
    // Adjacent clean stage pixels preserve the source's vertical shading. The
    // component is reused; none of the obscured original pixels are reconstructed.
    svg += '<g clip-path="url(#sr-stage-teacher-gap)">' + image('classroom', -241, -390) + '</g>';
    svg += '<g clip-path="url(#sr-stage-bulb-gap)">' + image('classroom', -326, -390) + '</g>';
    svg += '<g clip-path="url(#sr-stage-guide-gap)">' + image('classroom', -230, -390) + '</g>';
    svg += '<g clip-path="url(#sr-stage-visible)">' + image('classroom', -282, -390) + '</g></g></svg>';
    return art('source-stage', 1142, 390, 574, 119, svg, 1);
  }
  const DESK_PATHS = ['M5 2H57Q61 2 61 7V29Q61 35 57 35H5Q1 35 1 30V7Q1 2 5 2Z', 'M5 35H14V61H5Z', 'M49 35H59V61H49Z'];
  const CHAIR_PATHS = ['M15 35H49V66L48 69V85H39V76H25V85H16V69L15 66Z'];
  const seats = [];
  const solids = [
    { id: 'room-north', x: 0, y: 0, width: WIDTH, height: 185 },
    { id: 'room-west-edge', x: 0, y: 185, width: 25, height: HEIGHT - 185 },
    { id: 'room-east-edge', x: WIDTH - 15, y: 185, width: 15, height: HEIGHT - 185 },
    { id: 'room-south-edge', x: 0, y: HEIGHT - 15, width: WIDTH, height: 15 },
    { id: 'classroom-front-wall', x: 889, y: 185, width: 1088, height: 145 },
    { id: 'corridor-front-wall', x: 1977, y: 185, width: WIDTH - 1977, height: 69 },
    { id: 'group-main-north-wall', x: 826, y: 185, width: 63, height: 320 },
    { id: 'group-main-south-wall', x: 826, y: 795, width: 63, height: 135 },
    { id: 'teacher-work-desk', x: 985, y: 350, width: 159, height: 85 },
    { id: 'teacher-lectern', x: 1370, y: 435, width: 95, height: 63 },
    { id: 'hall-noticeboard-top', x: 2077, y: 462, width: 791, height: 164 },
    { id: 'hall-noticeboard-bottom', x: 2077, y: 693, width: 791, height: 164 }
  ];
  const deskXs = [109, 173, 301, 365, 494, 558, 686, 750, 878, 942];
  const deskYs = [506, 602, 698];
  deskYs.forEach((top, row) => deskXs.forEach((left, col) => {
    const x = left + 860, id = 'seat-' + (row * 10 + col + 1), side = col % 2 === 0 ? -1 : 1;
    const sx = x + 31, sy = top + 73;
    seats.push({ id, label: (row * 10 + col + 1) + '번 자리', x: sx, y: sy, sitX: sx, sitY: sy, sitDepth: top + 63, sitVisualYOffset: 0, approach: { x: sx + side * 43, y: sy }, exit: { x: sx + side * 43, y: sy }, rect: { x, y: top, width: 62, height: 90 }, row: row + 1, col: col + 1 });
    solids.push({ id: id + '-desk', seatId: id, x, y: top, width: 62, height: 35 });
    solids.push({ id: id + '-chair', seatId: id, x: x + 15, y: top + 35, width: 34, height: 50 });
  }));
  function classroomFurniture() {
    let html = '';
    html += crop('motto', 'classroom', [53, 64, 214, 46], 913, 64, 20);
    html += crop('class-window', 'classroom', [61, 154, 128, 130], 921, 154, 20);
    html += crop('clock', 'classroom', [219, 126, 44, 43], 1079, 126, 21, ['M42 21.5A20.5 20.5 0 1 1 1 21.5A20.5 20.5 0 1 1 42 21.5Z']);
    html += crop('timetable', 'classroom', [919, 219, 109, 86], 1779, 219, 20);
    html += crop('teacher-desk', 'classroom', [124, 288, 162, 152], 984, 288, 438, ['M1 60H36V56H44V49H53V43H62V25L63 22V12L65 7L70 4H84L91 7L94 13V23L98 28V42H106V51H115V60H124V57L125 55H134L137 58V65H160V132H157V149H147V132H17V150H7V132H1Z']);
    html += crop('teacher-side-chair', 'classroom', [57, 342, 41, 67], 917, 342, 409, ['M3 2H37V59H30V65H25V59H12V65H7V59H3Z']);
    html += crop('lectern', 'classroom', [510, 431, 95, 68], 1370, 431, 498, ['M1 1H93V63H90V67H84V63H11V67H5V63H1Z']);
    for (const seat of seats) {
      const x = seat.rect.x, y = seat.rect.y;
      html += crop(seat.id + '-chair', 'classroom', [109, 506, 62, 90], x, y, y + 55, CHAIR_PATHS, ' data-seat-art="' + seat.id + '"');
      html += crop(seat.id + '-desk', 'classroom', [109, 506, 62, 90], x, y, y + 61, DESK_PATHS, ' data-seat-art="' + seat.id + '" data-sr-seat="' + seat.id + '"');
    }
    return html;
  }
  function groupFurniture() {
    let html = '';
    html += crop('group-window-left', 'group', [92, 42, 126, 129], 92, 42, 20);
    html += crop('group-window-right', 'group', [635, 42, 126, 129], 635, 42, 20);
    html += crop('group-school-poster', 'group', [242, 89, 49, 61], 242, 89, 20);
    html += crop('group-science-poster', 'group', [302, 94, 45, 55], 302, 94, 20, ['M0 2L42 0L41 48L4 53Z']);
    const beanbags = [
      ['orange-left', [49, 181, 54, 55], 49, 181], ['green-left', [51, 248, 51, 52], 51, 248],
      ['green-middle', [243, 215, 52, 54], 243, 215], ['orange-middle', [562, 215, 54, 55], 562, 215],
      ['orange-right', [49, 181, 54, 55], 688, 248], ['green-right', [243, 215, 52, 54], 754, 216]
    ];
    beanbags.forEach(([id, r, x, y]) => {
      const w = r[2], h = r[3];
      const paths = id.indexOf('orange') === 0 ? ['M4 29Q0 16 6 8Q10 3 15 5Q22 7 26 19Q43 15 49 26Q57 36 45 47Q25 59 8 47Q1 40 4 29Z'] : ['M2 28Q4 17 14 17Q18 1 30 1Q46 0 48 17Q54 39 42 47Q24 57 8 46Q1 41 2 28Z'];
      html += crop('beanbag-' + id, 'group', r, x, y, y + h, paths);
      solids.push({ id: 'beanbag-' + id, x: x + 3, y: y + 22, width: w - 6, height: h - 23 });
    });
    const cushions = [[116,191],[181,223],[341,223],[469,191],[629,191],[694,191],[629,255]];
    cushions.forEach(([x, y], i) => { html += crop('floor-cushion-' + i, 'group', [116, 191, 45, 39], x, y, y + 39, ['M43 19.5A21 18 0 1 1 1 19.5A21 18 0 1 1 43 19.5Z']); });
    const rugs = [[360,343,166,141],[135,440,166,141],[583,438,166,141],[134,631,166,141],[582,629,166,141],[357,728,171,141]];
    rugs.forEach((r, i) => {
      html += crop('group-rug-' + i, 'group', r, r[0], r[1], 1, ['M' + (r[2]-2) + ' 70.5A' + ((r[2]-4)/2) + ' 68.5 0 1 1 2 70.5A' + ((r[2]-4)/2) + ' 68.5 0 1 1 ' + (r[2]-2) + ' 70.5Z']);
      html += crop('group-round-table-' + i, 'group', r, r[0], r[1], r[1] + 96, ['M55 63C55 48 68 37 84 37C101 37 113 48 113 63V73C113 84 99 91 84 91C68 91 55 84 55 73Z M59 78H65V96H59Z M103 78H109V96H103Z']);
      solids.push({ id: 'group-table-' + i, x: r[0] + 53, y: r[1] + 40, width: 60, height: 55 });
    });
    html += crop('group-microphone-table', 'group', [381, 567, 124, 93], 381, 567, 650, ['M122 42C122 15 95 1 62 1C26 1 2 18 2 42C2 68 26 87 62 87C96 87 122 68 122 42Z']);
    solids.push({ id: 'microphone-table', x: 389, y: 588, width: 108, height: 64 });
    return html;
  }
  function corridorFurniture() {
    let html = '';
    // Pair the unoccluded right glass leaf with its mirror. Original pixels only.
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="227" height="166" viewBox="0 0 227 166" aria-hidden="true"><defs><clipPath id="sr-door-leaf"><rect width="113.5" height="166"/></clipPath></defs><g transform="translate(113.5 0)" clip-path="url(#sr-door-leaf)">' + image('corridor', -671.5, -68) + '</g><g transform="translate(113.5 0) scale(-1 1)" clip-path="url(#sr-door-leaf)">' + image('corridor', -671.5, -68) + '</g></svg>';
    html += art('green-double-door', 2009, 94, 227, 166, svg, 20);
    html += crop('hall-classroom-door-1', 'corridor', [950, 99, 104, 132], 2401, 125, 20);
    html += crop('hall-classroom-door-2', 'corridor', [950, 99, 104, 132], 2657, 125, 20);
    html += crop('hall-door-plaque-1', 'corridor', [953, 55, 99, 35], 2404, 81, 20);
    html += crop('hall-door-plaque-2', 'corridor', [953, 55, 99, 35], 2660, 81, 20);
    html += crop('hall-noticeboard-1', 'corridor', [626, 436, 791, 164], 2077, 462, 625);
    html += crop('hall-noticeboard-2', 'corridor', [626, 436, 791, 164], 2077, 693, 856);
    return html;
  }
  // Furniture solids are created once together with the artwork, never on every render.
  let cachedArt = '';
  function buildArt() {
    if (cachedArt) return cachedArt;
    cachedArt = roomSurfaces() + stage() + projectionScreen() + groupFurniture() + classroomFurniture() + corridorFurniture();
    return cachedArt;
  }
  buildArt();
  solids.forEach(s => { s.w = s.width; s.h = s.height; });
  const scene = {
    id: 'school-room', width: WIDTH, height: HEIGHT,
    bounds: { width: WIDTH, height: HEIGHT },
    spawn: { x: 1430, y: 790 }, cameraHome: { x: 1430, y: 450, zoom: 0.84 },
    seats, solids,
    interactables: [
      { id: 'class-board', type: 'board', x: 1513, y: 470, radius: 135, approach: { x: 1513, y: 470 }, hitRect: { x: 1157, y: 78, width: 522, height: 317 }, label: '칠판 · 수업과 퀴즈' },
      { id: 'group-space', type: 'group', x: 570, y: 570, radius: 95, label: '모둠 활동 공간' },
      { id: 'corridor-exit', type: 'door', x: 2122, y: 298, radius: 75, label: '복도 문' }
    ],
    areas: [{ id: 'groups', label: '모둠 활동 공간', x: 25, y: 185, width: 801, height: 745 }, { id: 'classroom', label: '우리 반 교실 · 30자리', x: 889, y: 317, width: 1088, height: 613 }, { id: 'corridor', label: '교실 복도', x: 1977, y: 253, width: 951, height: 677 }],
    sourceScale: 'native source pixels', sourcePolicy: 'visible screenshot components and texture tiling only; no invented artwork or screenshot UI',
    get() { return this; }, render() { return cachedArt; }
  };
  window.QPSchoolRoomScene = scene;
}());
