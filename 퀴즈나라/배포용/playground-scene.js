/* User-provided school exterior components; original scales and source regions are registered separately. */
(function () {
  'use strict';
  const ROOT = new URL('assets/playground-library/originals/', document.currentScript.src).href;
  const SOURCES = {
    north: { file: 'playground-ef89d10d0fd0dff5.png', width: 1637, height: 798, x: 603, y: 155 },
    gym: { file: 'playground-dec2cc886f1575ad.png', width: 1672, height: 798, x: 1410, y: 0 },
    court: { file: 'playground-c010a0dc816a9cbf.png', width: 1638, height: 791, x: 1608, y: 450 },
    terrace: { file: 'playground-b2a51612a290eeea.png', width: 1668, height: 787, x: 548, y: 641 },
    west: { file: 'playground-664d4d7c187e5a6d.png', width: 1634, height: 905, x: 0, y: 991 },
    south: { file: 'playground-81e65dc5a2f422ef.png', width: 1623, height: 768, x: 1578, y: 744 },
    overview: { file: 'playground-ccfc75db92f8db32.png', width: 1857, height: 904, x: -269, y: 244, scale: 2, ui: [[842,10,142,43],[1648,0,209,56],[1677,60,180,140],[1368,421,73,59],[18,805,320,90],[803,846,218,50],[1770,845,87,59]] }
  };
  const REBASE = { x: 269, y: -244 };
  const point = p => ({ x: p.x + REBASE.x, y: p.y + REBASE.y });
  let serial = 0;
  function sourceImage(source, x, y) {
    const s = SOURCES[source];
    return '<image href="' + ROOT + s.file + '" x="' + x + '" y="' + y + '" width="' + s.width + '" height="' + s.height + '"/>';
  }
  function node(id, source, rect, target, depth, paths, transform, feather) {
    target = [target[0] + REBASE.x, target[1] + REBASE.y];
    const clip = 'pg-clip-' + (++serial), w = rect[2], h = rect[3], scale = SOURCES[source].scale || 1;
    let shape = paths ? paths.map(d => '<path d="' + d + '"/>').join('') : '<rect width="' + w + '" height="' + h + '"/>';
    if (!paths && SOURCES[source].ui) {
      const holes = SOURCES[source].ui.map(([x,y,uw,uh]) => { x -= rect[0]; y -= rect[1]; return 'M'+x+' '+y+'h'+uw+'v'+uh+'h-'+uw+'Z'; }).join('');
      shape = '<path clip-rule="evenodd" d="M0 0H'+w+'V'+h+'H0Z'+holes+'"/>';
    }
    const contents = '<g clip-path="url(#' + clip + ')">' + sourceImage(source, -rect[0], -rect[1]) + '</g>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w*scale) + '" height="' + (h*scale) + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><defs><clipPath id="' + clip + '">' + shape + '</clipPath></defs>' + (transform ? '<g transform="' + transform + '">' + contents + '</g>' : contents) + '</svg>';
    return '<div class="sr-art" data-art="' + id + '" data-source="' + source + '" data-floor-y="' + depth + '" style="position:absolute;left:' + target[0] + 'px;top:' + target[1] + 'px;width:' + (w*scale) + 'px;height:' + (h*scale) + 'px;z-index:' + depth + ';pointer-events:none;' + featherStyle(feather) + '">' + svg + '</div>';
  }
  // Each region is a registered native building, terrace, field or landscape component.
  // They are deliberately separate assets; source UI and people are replaced below.
  const overviewComponents = [
    ['overview-west-school-wing', 'overview', [0, 0, 855, 480]],
    ['overview-east-school-perimeter', 'overview', [855, 0, 1002, 355]],
    ['overview-west-sidewalk-garden', 'overview', [0, 480, 760, 325]],
    ['overview-lawn-track-south-perimeter', 'overview', [760, 355, 1097, 549]]
  ];
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
    ['west-fence-exterior-lawn', 'west', [0, 803, 1634, 102]],
    ['south-native-court-track-top', 'south', [324, 0, 1299, 390]],
    ['south-native-infield-curve-bottom', 'south', [324, 390, 726, 378]],
    ['south-native-fence-and-exterior-lawn', 'south', [1050, 390, 573, 378]]
  ];
  function registeredComponents() {
    return overviewComponents.map(([id, source, rect]) => {
      const s = SOURCES[source], scale = s.scale || 1;
      return node(id, source, rect, [s.x + rect[0]*scale, s.y + rect[1]*scale], -5);
    }).join('') + nativeCampusLayer();
  }
  function nativeCampusLayer() {
    const shape = [[0,0],[1857,0],[1857,344],[842,850],[277,559],[194,602],[0,492]].map(([x,y])=>x*2+'px '+y*2+'px').join(',');
    return '<div data-art="native-campus-material-components" style="position:absolute;inset:0;width:3714px;height:1808px;z-index:0;clip-path:polygon('+shape+')">' + components.map(([id, source, rect]) => {
      const s = SOURCES[source], scale = s.scale || 1;
      return node(id, source, rect, [s.x + rect[0]*scale, s.y + rect[1]*scale], source === 'overview' ? -5 : 0);
    }).join('') + clearSourceOverlays() + '</div>';
  }
  function sameWorldPatch(id, source, worldRect) {
    const s = SOURCES[source];
    return node(id, source, [worldRect[0] - s.x, worldRect[1] - s.y, worldRect[2], worldRect[3]], worldRect, 1);
  }
  function featherStyle(width) {
    if (!width) return '';
    const w=width+'px';
    return 'mask-image:linear-gradient(to right,transparent,#000 '+w+',#000 calc(100% - '+w+'),transparent),linear-gradient(to bottom,transparent,#000 '+w+',#000 calc(100% - '+w+'),transparent);mask-composite:intersect;';
  }
  function materialPatch(id, source, sourceRect, target, depth, feather, tileStretchY, tileStretchX) {
    target = [target[0] + REBASE.x, target[1] + REBASE.y, target[2], target[3]];
    const w = target[2], h = target[3], s = SOURCES[source], scale = s.scale || 1, texture = 'pg-material-' + (++serial);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" aria-hidden="true"><defs><pattern id="' + texture + '" patternUnits="userSpaceOnUse" patternTransform="scale('+(tileStretchX||1)+' '+(tileStretchY||1)+')" width="' + (sourceRect[2]*scale) + '" height="' + (sourceRect[3]*scale) + '"><g transform="scale('+scale+')">' + sourceImage(source, -sourceRect[0], -sourceRect[1]) + '</g></pattern></defs><rect width="' + w + '" height="' + h + '" fill="url(#' + texture + ')"/></svg>';
    return '<div class="sr-art" data-art="' + id + '" style="position:absolute;left:' + target[0] + 'px;top:' + target[1] + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + (depth || 2) + ';pointer-events:none;' + featherStyle(feather) + '">' + svg + '</div>';
  }
  function clearSourceOverlays() {
    let html = sameWorldPatch('clean-main-entry-source-overlap', 'gym', [1504, 550, 82, 95]);
    html += sameWorldPatch('clean-terrace-student-source-overlap', 'west', [1428, 1033, 86, 95]);
    html += sameWorldPatch('clean-west-tree-label-source-overlap', 'terrace', [897, 1380, 93, 45]);
    html += sameWorldPatch('clean-terrace-corner-badge', 'north', [2190, 641, 26, 46]);
    html += node('clean-gym-corner-badge', 'gym', [1616, 2, 28, 44], [3054, 2], 2);
    // The supplemental overview shows the actual previously covered window and foliage.
    // It is displayed at its honest 50% source resolution, registered at exactly 2x.
    html += node('gym-clean-same-world-overview', 'overview', [1285, 74, 50, 50], [2301, 392], 2);
    html += node('west-clean-same-world-foliage', 'overview', [592, 592, 14, 24], [915, 1428], 2);
    // The new native capture contains the entire clean court circle and chalk line.
    // Its clean right region is selected; the toolbar/pointer and color-shifted left strip are outside those source regions. The teacher uses clean same-world pixels.
    html += sameWorldPatch('south-clean-teacher-and-name', 'court', [2460, 1130, 75, 92]);
    return html;
  }
  // Bench pixels remain part of the original background, without a seating target or collider.
  const backgroundBenches = [{"id":"bench-auditorium-west","source":"west","sourceRect":[287,244,79,53],"rect":{"x":556,"y":991,"width":79,"height":53},"bank":"terrace","label":"1번 벤치","backgroundOnly":true,"walkTarget":{"x":595.5,"y":1036}},{"id":"bench-auditorium-main","source":"west","sourceRect":[576,103,79,53],"rect":{"x":845,"y":850,"width":79,"height":53},"bank":"terrace","label":"2번 벤치","backgroundOnly":true,"walkTarget":{"x":884.5,"y":895}},{"id":"bench-front-1","source":"west","sourceRect":[872,229,81,53],"rect":{"x":1141,"y":976,"width":81,"height":53},"bank":"terrace","label":"3번 벤치","backgroundOnly":true,"walkTarget":{"x":1181.5,"y":1021}},{"id":"bench-front-2","source":"terrace","sourceRect":[688,389,81,53],"rect":{"x":1505,"y":786,"width":81,"height":53},"bank":"terrace","label":"4번 벤치","backgroundOnly":true,"walkTarget":{"x":1545.5,"y":831}},{"id":"bench-front-3","source":"terrace","sourceRect":[1001,234,83,53],"rect":{"x":1818,"y":631,"width":83,"height":53},"bank":"terrace","label":"5번 벤치","backgroundOnly":true,"walkTarget":{"x":1859.5,"y":676}},{"id":"bench-front-4","source":"gym","sourceRect":[430,725,81,53],"rect":{"x":2109,"y":481,"width":81,"height":53},"bank":"terrace","label":"6번 벤치","backgroundOnly":true,"walkTarget":{"x":2149.5,"y":526}},{"id":"bench-front-5","source":"gym","sourceRect":[727,672,81,53],"rect":{"x":2406,"y":428,"width":81,"height":53},"bank":"terrace","label":"7번 벤치","backgroundOnly":true,"walkTarget":{"x":2446.5,"y":473}},{"id":"bench-front-6","source":"gym","sourceRect":[914,576,81,53],"rect":{"x":2593,"y":332,"width":81,"height":53},"bank":"terrace","label":"8번 벤치","backgroundOnly":true,"walkTarget":{"x":2633.5,"y":377}},{"id":"bench-gym-door","source":"gym","sourceRect":[968,382,81,53],"rect":{"x":2647,"y":138,"width":81,"height":53},"bank":"terrace","label":"9번 벤치","backgroundOnly":true,"walkTarget":{"x":2687.5,"y":183}},{"id":"bench-east-1","source":"gym","sourceRect":[1117,624,81,53],"rect":{"x":2796,"y":380,"width":81,"height":53},"bank":"east","label":"10번 벤치","backgroundOnly":true,"walkTarget":{"x":2836.5,"y":425}},{"id":"bench-east-2","source":"gym","sourceRect":[1357,743,81,53],"rect":{"x":3036,"y":499,"width":81,"height":53},"bank":"east","label":"11번 벤치","backgroundOnly":true,"walkTarget":{"x":3076.5,"y":544}},{"id":"bench-east-3","source":"south","sourceRect":[1462,136,81,53],"rect":{"x":3309,"y":636,"width":81,"height":53},"bank":"east","label":"12번 벤치","backgroundOnly":true,"walkTarget":{"x":3349.5,"y":681}},{"id":"bench-west-1","source":"west","sourceRect":[985,343,81,53],"rect":{"x":1254,"y":1090,"width":81,"height":53},"bank":"west","label":"13번 벤치","backgroundOnly":true,"walkTarget":{"x":1294.5,"y":1135}},{"id":"bench-west-2","source":"west","sourceRect":[1257,479,81,53],"rect":{"x":1526,"y":1226,"width":81,"height":53},"bank":"west","label":"14번 벤치","backgroundOnly":true,"walkTarget":{"x":1566.5,"y":1271}},{"id":"bench-west-3","source":"west","sourceRect":[1549,628,81,53],"rect":{"x":1818,"y":1375,"width":81,"height":53},"bank":"west","label":"15번 벤치","backgroundOnly":true,"walkTarget":{"x":1858.5,"y":1420}}];
  const walkAreas = [{"id":"inside-campus-fence","points":[[0,0],[2686,0],[3626,486],[3626,622],[1676,1628],[556,1060],[404,1146],[0,914]]}];
  const solids = [{"id":"main-building","points":[[0,0],[1808,0],[1808,380],[1582,528],[1416,624],[1332,582],[1082,684],[838,792],[824,564],[218,320],[218,224],[0,348]]},{"id":"gym-building","points":[[1806,0],[2696,0],[2696,166],[2570,240],[2570,340],[2288,448],[2270,368],[2072,468],[1808,342]]},{"id":"auditorium-building","points":[[0,348],[212,362],[824,656],[788,768],[424,976],[0,736]]},{"id":"west-flowerbed","points":[[812,1118],[934,1054],[1814,1472],[1672,1546]]},{"id":"east-flowerbed","points":[[2724,332],[2856,212],[3572,582],[3434,694]]}];
  const exteriorCleanup =
    materialPatch('exterior-top-service-grass', 'overview', [1600,15,40,105], [2991,214,454,180], -4, 25, 2, 6) +
    materialPatch('exterior-right-service-grass', 'overview', [1600,15,40,105], [3001,334,444,340], -4, 25, 2, 6) +
    materialPatch('exterior-chat-grass', 'overview', [345,805,360,99], [-299,1804,760,300], -4, 25) +
    materialPatch('exterior-voice-grass', 'overview', [1040,805,150,99], [1286,1884,560,212], -4, 25) +
    materialPatch('exterior-message-grass', 'overview', [1620,805,130,99], [3261,1874,234,230], -4, 25);
  const art = materialPatch('provided-exterior-grass-material', 'overview', [1040,760,360,80], [-269,244,3714,1808], -100) + registeredComponents() + exteriorCleanup;
  const scene = {
    id: 'playground-user-source-school', zone: 'playground', title: '우리 학교 운동장',
    width: 3714, height: 1808, bounds: { width: 3714, height: 1808 },
    status: 'source-complete', publicEntryReady: true,
    spawn: { x: 1559, y: 676 }, cameraHome: { x: 1750, y: 770, zoom: .92 },
    previewViews: [
      { id: 'school-front', label: '학교 앞과 계단', spawn: { x: 1559, y: 676 }, camera: { x: 1750, y: 770, zoom: .92 } },
      { id: 'soccer', label: '축구장', spawn: { x: 2789, y: 796 }, camera: { x: 2789, y: 750, zoom: 1.05 } },
      { id: 'track', label: '운동장과 트랙', spawn: { x: 2119, y: 986 }, camera: { x: 2119, y: 1000, zoom: .92 } },
      { id: 'south-fence', label: '아래 울타리 길', spawn: { x: 2009, y: 1456 }, camera: { x: 2009, y: 1430, zoom: 1.05 } }
    ],
    seats: [], backgroundBenches, walkAreas,
    missingSourceBounds: [],
    solids,
    // Door proximity uses the walkable pavement immediately outside the
    // original threshold, rather than the lower terrace arrival point. The
    // orange-canopy east entrance is also a visible door into the same school.
    interactables: [
      { id: 'school-main-door', type: 'portal', target: 'campus', x: 1515, y: 620, radius: 85, approach: { x: 1515, y: 620 }, arrival: { x: 1559, y: 676 }, hitRect: { x: 1442, y: 450, width: 132, height: 148 }, hint: { x: 1515, y: 436 }, label: '교실로 들어가기', doorName: '학교 정문' },
      { id: 'school-east-door', type: 'portal', target: 'campus', x: 2258, y: 410, radius: 75, approach: { x: 2258, y: 410 }, hitRect: { x: 2245, y: 255, width: 65, height: 125 }, hint: { x: 2330, y: 370 }, label: '교실로 들어가기', doorName: '학교 동쪽 문' }
    ],
    sourcePolicy: 'All furniture and bench pixels are static background art; C uses the shared basic sitting pose at the current legal position, with no bench-specific animation or automatic seating. Only user original pixels. Six native captures plus exact 2x display of the supplemental 50% overview for uncaptured perimeter and covered window/foliage. No invented terrain, reflected track, or painted chalk.',
    components, overviewComponents, originalCoordinateRebase: REBASE, sources: Object.fromEntries(Object.entries(SOURCES).map(([id,s])=>[id,{...s,originalOrigin:[s.x,s.y],x:s.x+REBASE.x,y:s.y+REBASE.y}])) ,
    get() { return this; }, render() { return art; }
  };
  window.QPPlaygroundScene = scene;
}());
