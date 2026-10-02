/* Development draft: native user screenshot components, incomplete southeast source. */
(function () {
  'use strict';
  const ROOT = new URL('assets/playground-library/originals/', document.currentScript.src).href;
  const SOURCES = {
    north: { file: 'playground-ef89d10d0fd0dff5.png', width: 1637, height: 798, x: 603, y: 155 },
    gym: { file: 'playground-dec2cc886f1575ad.png', width: 1672, height: 798, x: 1410, y: 0 },
    court: { file: 'playground-c010a0dc816a9cbf.png', width: 1638, height: 791, x: 1608, y: 450 },
    terrace: { file: 'playground-b2a51612a290eeea.png', width: 1668, height: 787, x: 548, y: 641 },
    west: { file: 'playground-664d4d7c187e5a6d.png', width: 1634, height: 905, x: 0, y: 991 }
  };
  let serial = 0;
  function sourceImage(source, x, y) {
    const s = SOURCES[source];
    return '<image href="' + ROOT + s.file + '" x="' + x + '" y="' + y + '" width="' + s.width + '" height="' + s.height + '"/>';
  }
  function node(id, source, rect, target, depth, paths, transform) {
    const clip = 'pg-clip-' + (++serial), w = rect[2], h = rect[3];
    const shape = paths ? paths.map(d => '<path d="' + d + '"/>').join('') : '<rect width="' + w + '" height="' + h + '"/>';
    const contents = '<g clip-path="url(#' + clip + ')">' + sourceImage(source, -rect[0], -rect[1]) + '</g>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><defs><clipPath id="' + clip + '">' + shape + '</clipPath></defs>' + (transform ? '<g transform="' + transform + '">' + contents + '</g>' : contents) + '</svg>';
    return '<div class="sr-art" data-art="' + id + '" data-source="' + source + '" data-floor-y="' + depth + '" style="position:absolute;left:' + target[0] + 'px;top:' + target[1] + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + depth + ';pointer-events:none">' + svg + '</div>';
  }
  // Each region is a registered native building, terrace, field or landscape component.
  // They are deliberately separate assets; source UI and people are replaced below.
  const components = [
    ['main-school-roofs', 'north', [0, 0, 1637, 420]],
    ['main-school-front-facades', 'north', [0, 420, 1200, 378]],
    ['north-entry-terrace', 'north', [1200, 420, 437, 378]],
    ['gym-building-and-front', 'gym', [0, 0, 1074, 630]],
    ['east-perimeter-garden', 'gym', [1074, 0, 598, 630]],
    ['gym-native-stair-terrace', 'gym', [0, 630, 1672, 168]],
    ['native-front-steps', 'court', [0, 0, 848, 467]],
    ['soccer-original-court', 'court', [628, 280, 710, 461]],
    ['east-flowerbed-and-fence', 'court', [848, 0, 790, 791]],
    ['stadium-upper-grass', 'court', [0, 467, 848, 324]],
    ['south-main-front-and-entry', 'terrace', [0, 0, 1250, 366]],
    ['long-front-steps-and-benches', 'terrace', [0, 366, 1100, 421]],
    ['original-visible-track-and-soil', 'terrace', [710, 270, 958, 517]],
    ['west-auditorium-and-terrace', 'west', [0, 0, 850, 375]],
    ['west-visible-track-edge', 'west', [850, 0, 784, 540]],
    ['west-native-flowerbed', 'west', [0, 375, 1634, 428]],
    ['west-fence-exterior-lawn', 'west', [0, 803, 1634, 102]]
  ];
  function registeredComponents() {
    return components.map(([id, source, rect]) => {
      const s = SOURCES[source];
      return node(id, source, rect, [s.x + rect[0], s.y + rect[1]], 0);
    }).join('');
  }
  function sameWorldPatch(id, source, worldRect) {
    const s = SOURCES[source];
    return node(id, source, [worldRect[0] - s.x, worldRect[1] - s.y, worldRect[2], worldRect[3]], worldRect, 1);
  }
  function materialPatch(id, source, sourceRect, target, depth) {
    const w = target[2], h = target[3], s = SOURCES[source], texture = 'pg-material-' + (++serial);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" aria-hidden="true"><defs><pattern id="' + texture + '" patternUnits="userSpaceOnUse" width="' + sourceRect[2] + '" height="' + sourceRect[3] + '">' + sourceImage(source, -sourceRect[0], -sourceRect[1]) + '</pattern></defs><rect width="' + w + '" height="' + h + '" fill="url(#' + texture + ')"/></svg>';
    return '<div class="sr-art" data-art="' + id + '" style="position:absolute;left:' + target[0] + 'px;top:' + target[1] + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + (depth || 2) + ';pointer-events:none">' + svg + '</div>';
  }
  function clearSourceOverlays() {
    let html = sameWorldPatch('clean-main-entry-source-overlap', 'gym', [1504, 550, 82, 95]);
    html += sameWorldPatch('clean-terrace-student-source-overlap', 'west', [1428, 1033, 86, 95]);
    html += sameWorldPatch('clean-west-tree-label-source-overlap', 'terrace', [897, 1380, 93, 45]);
    html += sameWorldPatch('clean-terrace-corner-badge', 'north', [2190, 641, 26, 46]);
    html += node('clean-gym-corner-badge', 'gym', [1616, 2, 28, 44], [3054, 2], 2);
    // A visible repeated upper-row window supplies only the corresponding window fragment.
    html += node('gym-window-source-component', 'gym', [897, 330, 26, 28], [2307, 397], 2);
    html += materialPatch('gym-clean-wall-material', 'gym', [924, 382, 12, 6], [2333, 397, 54, 28]);
    html += node('gym-clean-paving-head-region', 'gym', [910, 490, 45, 26], [2317, 426], 2);
    html += sameWorldPatch('gym-clean-lower-body-source-overlap', 'court', [2309, 450, 68, 41]);
    // The court's own lower ellipse arc is the matching clean original component.
    html += materialPatch('court-clean-tag-grass', 'court', [1092, 420, 45, 60], [2523, 844, 101, 31]);
    html += node('court-original-opposite-arc', 'court', [923, 468, 101, 31], [2523, 844], 3,
      ['M0 17.27L10 19.74L20 21.50L30 22.68L40 23.30L46.5 23.41L50 23.38L60 22.92L70 21.92L80 20.33L90 18.10L101 14.75L101 22.75L90 26.10L80 28.33L70 29.92L60 30.92L50 31.38L46.5 31.41L40 31.30L30 30.68L20 29.50L10 27.74L0 25.27Z'], 'translate(101 31) rotate(180)');
    html += node('court-clean-body-grass', 'court', [1092, 420, 45, 60], [2540, 870], 2);
    // White chalk is copied from the unoccluded straight source line; these are
    // clipping outlines around original pixels, never newly drawn line graphics.
    html += node('court-original-middle-line', 'court', [1040, 388, 38, 31], [2540, 892], 3, ['M0 16.25L38 -2.75V5.25L0 24.25Z']);
    html += node('court-original-middle-line-end', 'court', [1050, 396, 7, 12], [2578, 886], 3, ['M0 3.25L7 -0.25V7.75L0 11.25Z']);
    html += node('west-reused-clean-foliage-component', 'west', [1071, 496, 27, 48], [915, 1428], 2);
    html += node('west-clean-exterior-grass-chat', 'west', [346, 803, 323, 91], [11, 1794], 2);
    html += node('west-clean-exterior-grass-controls', 'west', [535, 844, 220, 49], [798, 1835], 2);
    return html;
  }
  const benches = [
    { id: 'bench-front-1', rect: { x: 872, y: 1220, width: 81, height: 53 }, x: 913, y: 1265, approach: { x: 934, y: 1295 } },
    { id: 'bench-front-2', rect: { x: 1236, y: 1030, width: 81, height: 53 }, x: 1277, y: 1075, approach: { x: 1298, y: 1105 } },
    { id: 'bench-front-3', rect: { x: 1549, y: 875, width: 83, height: 53 }, x: 1591, y: 920, approach: { x: 1612, y: 950 } }
  ].map((s, i) => ({ ...s, label: (i + 1) + '번 벤치', kind: 'bench', direction: 'front', sitX: s.x, sitY: s.y, sitDepth: s.y - 4, sitVisualYOffset: 0, exit: { ...s.approach } }));
  const coverage = Object.values(SOURCES).map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height }));
  const art = registeredComponents() + clearSourceOverlays();
  const scene = {
    id: 'playground-source-draft', zone: 'playground', title: '우리 학교 운동장',
    width: 3246, height: 1896, bounds: { width: 3246, height: 1896 },
    status: 'draft-missing-southeast-source', publicEntryReady: false,
    spawn: { x: 1690, y: 900 }, cameraHome: { x: 1840, y: 740, zoom: 1.05 },
    previewViews: [
      { id: 'school-front', label: '학교 앞과 계단', spawn: { x: 1690, y: 900 }, camera: { x: 1840, y: 740, zoom: 1.05 } },
      { id: 'soccer', label: '축구장', spawn: { x: 2490, y: 960 }, camera: { x: 2520, y: 860, zoom: 1.05 } }
    ],
    seats: benches, walkAreas: coverage, coverage,
    missingSourceBounds: [
      { id: 'missing-southeast-field', x: 1634, y: 1428, width: 1612, height: 468, label: '트랙 오른쪽 아래·흙 필드 아래 경계·바깥 울타리 원본 필요' },
      { id: 'missing-east-bottom', x: 2216, y: 1241, width: 1030, height: 187, label: '트랙 아래 오른쪽 구간 원본 필요' }
    ],
    solids: [
      { id: 'missing-southeast', x: 1634, y: 1428, width: 1612, height: 468 },
      { id: 'missing-east', x: 2216, y: 1241, width: 1030, height: 187 },
      { id: 'main-building', points: [[0,0],[2240,0],[2240,520],[1920,710],[1770,720],[1540,630],[1490,700],[1320,795],[1230,865],[1030,760],[575,1050],[335,1320],[0,1180]] },
      { id: 'sports-building', points: [[1920,0],[2660,0],[2660,410],[2430,515],[2310,505],[2290,650],[2060,760],[1770,720]] },
      { id: 'east-flowerbed', points: [[2452,574],[2630,480],[3246,740],[3246,916],[3112,968]] },
      { id: 'west-flowerbed', points: [[540,1375],[726,1288],[1530,1694],[1530,1765],[1270,1790]] }
    ],
    interactables: [{ id: 'school-main-door', type: 'portal', target: 'campus', x: 1290, y: 920, radius: 75, approach: { x: 1290, y: 920 }, hitRect: { x: 1193, y: 733, width: 100, height: 128 }, label: '교실로 들어가기' }],
    sourcePolicy: 'Native original components only. Southeast field remains unavailable until the missing source arrives. No invented track, mirrored full track, or painted court lines.',
    components, sources: SOURCES,
    get() { return this; }, render() { return art; }
  };
  window.QPPlaygroundScene = scene;
}());
