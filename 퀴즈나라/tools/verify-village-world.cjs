'use strict';

// Integrated, isolated town QA. Paths use the real controller; no teleport,
// time acceleration, collision overrides, or external Firebase writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || path.join(__dirname, '../검증/숲속마을'));
const session = 'village-' + Date.now() + '-' + process.pid;
const preview = new URL(process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/');
preview.searchParams.set('demo', '1'); preview.searchParams.set('session', session);
const checks = [], screenshots = [], errors = [], paths = [], layouts = [], keyboardTraces = [], climbs = [], floorClicks = [], screenMetrics = [];
const landRoutes = [], pondChecks = [], missing = [];
let browser, a, b, sibling, phase = 'startup';
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function pass(name) { checks.push(name); console.log('PASS: ' + name); }
async function state(page) { return page.evaluate(() => QPGame.getVillage()?.getState()); }
async function terrain(page) {
  return page.evaluate(() => {
    const scene = QPGame.getVillage().getScene(), data = scene.build();
    return { spawn: scene.spawn, width: scene.width, height: scene.height,
      surfaces: scene.surfaces || data.surfaces, solids: data.solids, portals: scene.portals || data.portals,
      travelLinks: scene.travelLinks || data.travelLinks || [] };
  });
}
async function screenshot(page, name, fullPage = true) {
  await page.bringToFront();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  screenMetrics.push({ fullPage, ...await page.evaluate(name => {
    const top = document.querySelector('.top');
    const rect = node => node.getBoundingClientRect().toJSON();
    return { name, scrollY, top: top && rect(top), topScroll: top?.scrollTop,
      topChildren: top && [...top.children].map(node => ({ className: node.className, id: node.id, rect: rect(node), transform: getComputedStyle(node).transform })) };
  }, name) });
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage });
  screenshots.push(name + '.png');
}
async function ready(page, zone = 'village') {
  await page.bringToFront();
  await page.waitForFunction(zone => QPGame.getVillage()?.getState().zone === zone, zone);
  await page.waitForSelector('.vt-viewport');
  await page.waitForFunction(() => QPAvatar?.atlas.ready && QPClothes?.atlas.ready);
}
async function walk(page, target, name, timeout = 45000) {
  await page.bringToFront();
  const before = await state(page);
  const started = await page.evaluate(target => {
    const world = QPGame.getVillage();
    window.__villageTrace = [{ at: performance.now(), ...world.getState() }];
    clearInterval(window.__villageTraceTimer);
    window.__villageTraceTimer = setInterval(() => {
      const s = world.getState();
      window.__villageTrace.push({ at: performance.now(), x: s.x, y: s.y, height: s.height });
    }, 75);
    return world.navigate(target);
  }, target);
  assert(started, name + ': no route found');
  try {
    await page.waitForFunction(target => {
      const s = QPGame.getVillage()?.getState();
      return s && Math.hypot(s.x - target.x, s.y - target.y) < 5 && Math.abs(s.height - (target.height || 0)) < 5 && !s.pathLength;
    }, target, { timeout });
  } finally { await page.evaluate(() => clearInterval(window.__villageTraceTimer)); }
  const trace = await page.evaluate(() => window.__villageTrace);
  const end = await state(page);
  paths.push({ name, from: { x: before.x, y: before.y, height: before.height }, target, end: { x: end.x, y: end.y, height: end.height }, samples: trace });
  for (let i = 1; i < trace.length; i++) {
    const elapsed = (trace[i].at - trace[i - 1].at) / 1000;
    const distance = Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y);
    assert(distance <= 200 * elapsed + 8, name + ': movement exceeded walking speed');
    assert(Math.abs(trace[i].height - trace[i - 1].height) <= 12, name + ': height jumped over a ledge: ' + JSON.stringify([trace[i - 1], trace[i]]));
  }
  return trace;
}
async function keyHold(page, keys, ms) {
  await page.bringToFront(); await page.locator('.vt-viewport').focus();
  await page.evaluate(() => {
    const world = QPGame.getVillage(); window.__keyboardSamples = [];
    window.__keyboardTimer = setInterval(() => {
      const s = world.getState();
      window.__keyboardSamples.push({ x: s.x, y: s.y, height: s.height,
        legal: world.getScene().canStand(s.x, s.y, s.height, 11), at: performance.now() });
    }, 50);
  });
  for (const key of keys) await page.keyboard.down(key);
  await pause(ms);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
  const samples = await page.evaluate(() => { clearInterval(window.__keyboardTimer); return window.__keyboardSamples; });
  assert(samples.length > 0 && samples.every(s => s.legal), 'A real keyboard step entered a solid body, water or cliff');
  keyboardTraces.push({ keys, ms, samples });
  await pause(100);
}
async function enterPortal(page, id, expectedZone, expectedSelector) {
  const portal = await page.evaluate(id => QPGame.getVillage().getScene().portals.find(p => p.id === id), id);
  assert(portal, 'Missing portal: ' + id);
  await walk(page, portal, 'door-' + id, 45000);
  await page.waitForFunction(id => QPGame.getVillage()?.getState().nearPortal === id, id);
  await page.locator('.vt-viewport').focus(); await page.keyboard.press('KeyE');
  if (expectedZone) await ready(page, expectedZone);
  if (expectedSelector) await page.waitForSelector(expectedSelector);
}
async function floorClick(page, target) {
  await page.bringToFront();
  const screen = await page.evaluate(target => {
    const r = document.querySelector('.vt-world').getBoundingClientRect();
    const s = QPGame.getVillage().getState();
    const x = r.x + target.x * s.scale, y = r.y + (target.y - target.height) * s.scale;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit?.className?.baseVal || hit?.className || hit?.tagName,
      control: !!hit?.closest('button,.vt-actor,.vt-dialogue') };
  }, target);
  assert(!screen.control, 'The floor-click target is covered by an interactive landmark: ' + JSON.stringify(screen));
  assert(await page.evaluate(p => QPGame.getVillage().getScene().canStand(p.x, p.y, p.height), target), 'The clicked floor must be walkable');
  const record = { target, screen };
  floorClicks.push(record);
  await page.mouse.click(screen.x, screen.y);
  try {
    await page.waitForFunction(target => {
      const s = QPGame.getVillage().getState();
      return Math.hypot(s.x - target.x, s.y - target.y) < 5 && !s.pathLength;
    }, target);
  } finally { record.end = await state(page); }
  assert(Math.abs((await state(page)).height - target.height) < 1, 'Floor clicking picked the wrong elevation');
}
async function inspectRetiredStream(page) {
  const inspection = await page.evaluate(() => {
    const scene = QPGame.getVillage().getScene(), data = scene.build(), scale = scene.width / 1800;
    const probes = [[1105,600,72],[1165,890,0]].map(([x,y,height]) => ({ x:x*scale, y:y*scale, height:height*scale,
      canal:QPVillageWaterAssets.containsCanal(x,y,11/scale), brook:QPVillageWaterAssets.containsBrook(x,y,11/scale),
      legal:scene.canStand(x*scale,y*scale,height*scale,11) }));
    return { surfaces:Object.keys(scene.surfaces), objects:data.objects.filter(o => /bridge/.test(o.id)).map(o => o.id),
      bridgeDOM:document.querySelectorAll('.vt-object[data-object*="bridge"]').length,
      pieces:[...document.querySelectorAll('.vt-ground [data-water-piece]')].map(n => n.dataset.waterPiece),
      sources:QPVillageWaterAssets.sourceAssets, probes };
  });
  for (const retired of ['bridge','lowerBridge','river']) assert(!inspection.surfaces.includes(retired), 'Retired terrain remains: ' + retired);
  assert.deepEqual(inspection.objects, []); assert.equal(inspection.bridgeDOM, 0);
  assert.deepEqual(inspection.pieces, ['original-pond'], 'The ground should retain only the original standalone pond');
  assert.deepEqual(inspection.sources, ['assets/water-library/originals/water-0e50bcc49b81bd14.jpg']);
  assert(inspection.probes.every(p => !p.canal && !p.brook && p.legal), 'Retired water still blocks the open land');
  landRoutes.push({ kind:'retired-stream-inspection', ...inspection });
  pass('The retired stream, both bridge drawings and fake river terrain are absent; former water points are open land');
}
async function landRoad(page, name) {
  const scale = await page.evaluate(() => QPGame.getVillage().getScene().width / 1800);
  const raw = name === 'upper'
    ? [[1000,492,72],[1105,492,72],[1208,492,72]]
    : [[1020,916,0],[1078.5,886,0],[1154,858,0],[1198,836.25,0],[1238,821,0],[1350,821,0]];
  const waypoints = raw.map(([x,y,height]) => ({ x:x*scale, y:y*scale, height:height*scale }));
  const paving = await page.evaluate(points => {
    const world = document.querySelector('.vt-world').getBoundingClientRect(), state = QPGame.getVillage().getState();
    const paint = [...document.querySelectorAll('.vt-ground path,.vt-ground ellipse')].filter(n =>
      [n.getAttribute('fill'),n.getAttribute('stroke')].some(v => v && /-path\)/.test(v)));
    return points.map(p => {
      const screen = new DOMPoint(world.x+p.x*state.scale,world.y+(p.y-p.height)*state.scale);
      return { ...p, paved:paint.some(n => { const m=n.getScreenCTM(); if(!m)return false; const q=screen.matrixTransform(m.inverse());
        return (/-path\)/.test(n.getAttribute('stroke')||'') && n.isPointInStroke(q)) ||
          (/-path\)/.test(n.getAttribute('fill')||'') && n.isPointInFill(q)); }) };
    });
  }, waypoints);
  assert(paving.every(p => p.paved), name + ': a road waypoint has no visible paving');
  for (let i=0;i<waypoints.length;i++) {
    await walk(page,waypoints[i],name+'-open-land-road-'+i);
    if (process.env.QUIZ_VILLAGE_LAND_WATER_ONLY==='1' && i===(name==='upper'?1:3))
      await landView(page,name==='upper'?'마을-높은길-옛강물자리':'마을-산책길-옛강물자리');
  }
  landRoutes.push({kind:'actual-paved-road',name,waypoints,paving});
  await screenshot(page,name==='upper'?'마을-높은길-이어진도로':'마을-연못북쪽-산책길');
  pass('Actual walking follows the continuous ' + name + ' paved land road without a bridge or invisible stream collider');
}
async function retainedPond(page) {
  const boundary = await page.evaluate(() => {
    const scene=QPGame.getVillage().getScene(),water=QPVillageWaterAssets,scale=scene.width/1800,y=1000;
    let edge=null;for(let x=1200;x<1500;x+=.25)if(water.containsPond(x,y)){edge=x;break;}
    const point=x=>({x:x*scale,y:y*scale,height:0});
    const inside=point(1280),outside=point(1210),oldBridgeHole={x:1235*scale,y:915*scale,height:0};
    let samples=0,blocked=0;
    for(let yy=900;yy<=1040;yy+=10)for(let x=1210;x<=1540;x+=10)if(water.containsPond(x,yy)){
      samples++;if(!scene.canStand(x*scale,yy*scale,0,0))blocked++;
    }
    return {scale,edge,samples,blocked,inside,outside,oldBridgeHole,
      insideBlocked:!scene.canStand(inside.x,inside.y,0,0),outsideLegal:scene.canStand(outside.x,outside.y,0,11),
      oldBridgeHoleBlocked:!scene.canStand(oldBridgeHole.x,oldBridgeHole.y,0,0),
      near:edge===null?null:point(edge-4),start:edge===null?null:point(edge-24),wet:edge===null?null:point(edge+12),
      nearCentreLegal:edge!==null&&scene.canStand((edge-4)*scale,y*scale,0,0),
      nearFeetBlocked:edge!==null&&!scene.canStand((edge-4)*scale,y*scale,0,11)};
  });
  assert(boundary.edge!==null&&boundary.samples>0&&boundary.samples===boundary.blocked,'The retained painted pond needs a solid interior');
  assert(boundary.insideBlocked&&boundary.outsideLegal&&boundary.oldBridgeHoleBlocked,'The pond boundary or retired bridge exemption is incorrect');
  assert(boundary.nearCentreLegal&&boundary.nearFeetBlocked,'Foot radius must stop at the painted water edge');
  await walk(page,boundary.start,'standalone-pond-shore');
  const before=await state(page),screen=await page.evaluate(p=>{const s=QPGame.getVillage().getState(),r=document.querySelector('.vt-world').getBoundingClientRect();return{x:r.x+p.x*s.scale,y:r.y+p.y*s.scale};},boundary.wet);
  await page.mouse.click(screen.x,screen.y);await pause(200);const clicked=await state(page);
  assert(Math.hypot(clicked.x-before.x,clicked.y-before.y)<1&&!clicked.pathLength,'Clicking the retained pond started an illegal route');
  await keyHold(page,['ArrowRight'],550);const end=await state(page);
  assert(end.x<=boundary.edge*boundary.scale-10,'Actual keyboard feet crossed the painted pond edge');
  assert.equal(await page.evaluate(({p,scale})=>QPVillageWaterAssets.containsPond(p.x/scale,p.y/scale,11/scale),{p:end,scale:boundary.scale}),false);
  pondChecks.push({...boundary,before,clicked,end});await screenshot(page,'마을-단독연못-실제물경계');
  if (process.env.QUIZ_VILLAGE_LAND_WATER_ONLY==='1') await landView(page,'마을-단독연못-실제물경계');
  pass('Only the retained original pond blocks its interior and foot boundary, including the retired bridge hole; actual clicks and keyboard cannot enter it');
}
async function climb(page, friend, uid, link) {
  await walk(page, link.from, 'rope-approach-' + link.id);
  await page.waitForFunction(id => QPGame.getVillage().getState().nearPortal === id, link.id);
  await page.evaluate(() => {
    window.__climbSamples = [];
    window.__climbTimer = setInterval(() => {
      const s = QPGame.getVillage().getState();
      window.__climbSamples.push({ x: s.x, y: s.y, height: s.height, travel: s.travel, at: performance.now() });
    }, 50);
  });
  await Promise.all([page, friend].map(observer => observer.evaluate(({ uid, link }) => {
    const original = window.QPAvatarPose;
    window.__villageOriginalPose = original;
    window.__remoteClimbSamples = [];
    window.QPAvatarPose = Object.freeze({ ...original, apply(svg, pose) {
      const result = original.apply(svg, pose);
      const actor = svg?.closest('.vt-actor');
      if (pose.action === 'climb' && actor?.dataset.uid === uid) {
        const matrix = new DOMMatrixReadOnly(actor.style.transform);
        // Both directions use one physical low-to-high rope reference. A
        // descending student has decreasing hand phase, including first sight.
        const low = link.from.height < link.to.height ? link.from : link.to;
        const high = link.from.height < link.to.height ? link.to : link.from;
        const from = low.y - low.height, to = high.y - high.height;
        window.__remoteClimbSamples.push({ phase: pose.phase, physicalPhase: (matrix.f - from) / (to - from), at: performance.now() });
      }
      return result;
    } });
  }, { uid, link })));
  await page.locator('.vt-viewport').focus(); await page.keyboard.press('KeyE');
  await page.waitForFunction(id => QPGame.getVillage().getState().travel?.id === id, link.id);
  await friend.waitForFunction(uid => QPGame.getVillage().getState().players.some(p => p.uid === uid && p.pose === 'climb'), uid);
  await page.waitForFunction(() => QPGame.getVillage().getState().travel?.phase > .3);
  await screenshot(page, link.id + '-이동중');
  await page.waitForFunction(target => {
    const s = QPGame.getVillage().getState();
    return !s.travel && Math.hypot(s.x - target.x, s.y - target.y) < 3 && Math.abs(s.height - target.height) < 1;
  }, link.to);
  const samples = await page.evaluate(() => { clearInterval(window.__climbTimer); return window.__climbSamples; });
  const direction = Math.sign(link.to.height - link.from.height);
  assert(samples.some(s => Math.abs(s.height - link.from.height) > 20 && Math.abs(s.height - link.to.height) > 20));
  for (let i = 1; i < samples.length; i++) {
    assert((samples[i].height - samples[i - 1].height) * direction >= -.1, 'Rope movement reversed elevation');
    assert(Math.abs(samples[i].height - samples[i - 1].height) < 14, 'Rope movement teleported');
  }
  assert(await page.evaluate(p => QPGame.getVillage().getScene().canStand(p.x, p.y, p.height), link.to));
  const restoreRecorder = observer => observer.evaluate(() => {
    window.QPAvatarPose = window.__villageOriginalPose;
    return window.__remoteClimbSamples;
  });
  const [localSamples, remoteSamples] = await Promise.all([page, friend].map(restoreRecorder));
  assert(localSamples.length > 15 && localSamples.every(s => Math.abs(s.phase - s.physicalPhase) < .08), 'Local climbing hands are out of step with physical rope progress');
  assert(remoteSamples.length > 15, 'The other student did not render the climb');
  assert(remoteSamples.every(s => Math.abs(s.phase - s.physicalPhase) < .08), 'Remote climbing hands are out of step with physical rope progress');
  await friend.waitForFunction(uid => QPGame.getVillage().getState().players.some(p => p.uid === uid && p.pose !== 'climb'), uid);
  climbs.push({ id: link.id, from: link.from, to: link.to, samples, localSamples, remoteSamples });
}
async function landView(page, name) {
  const previous = page.viewportSize();
  for (const [width,height] of [[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height}); await pause(150);
    await screenshot(page,name+'-'+width,false);
  }
  await page.setViewportSize(previous);
}
async function logout(page) {
  await page.bringToFront(); await page.locator('#tbOut').click();
  await page.locator('#mOut').click();
  await page.waitForFunction(() => !QPGame.getMe() && !QPGame.getVillagePresence());
}
async function rosterPlayer(page, uid) {
  return page.evaluate(uid => QPGame.getVillage()?.getState().players.find(p => p.uid === uid), uid);
}
async function checkLayout(page, width, height, zone) {
  await page.setViewportSize({ width, height }); await pause(150);
  const diagnostic = await page.evaluate(() => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const nodes = ['.top', '.vt-hud', '.vt-tools', '.vt-controls', '.vt-level'].map(selector => ({ selector, ...rect(document.querySelector(selector)) }));
    const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.x, b.x) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y) + 1;
    const collisions = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (overlap(nodes[i], nodes[j])) collisions.push(nodes[i].selector + ' / ' + nodes[j].selector);
    const buttons = [...document.querySelectorAll('.top button,.vt-hud button,.vt-tools button,.vt-controls button')].filter(n => !n.hidden && getComputedStyle(n).display !== 'none');
    const clipped = buttons.filter(n => { const r = rect(n); return r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || n.scrollWidth > n.clientWidth + 3; }).map(n => n.textContent.trim());
    return { nodes, collisions, clipped, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  layouts.push({ width, height, zone, ...diagnostic });
  assert.deepEqual(diagnostic.collisions, [], zone + ' layout overlaps at ' + width + '×' + height);
  assert.deepEqual(diagnostic.clipped, [], zone + ' controls are clipped at ' + width + '×' + height);
  assert.equal(diagnostic.horizontalOverflow, false);
  await screenshot(page, zone + '-' + width + 'x' + height);
}
async function checkNameSignSeparation(page) {
  const collisions = await page.evaluate(() => {
    const name = document.querySelector('.vt-actor.is-me .vt-name').getBoundingClientRect();
    return [...document.querySelectorAll('.vt-landmark')].filter(node => {
      const r = node.getBoundingClientRect();
      return Math.min(name.right, r.right) > Math.max(name.x, r.x) + 1 && Math.min(name.bottom, r.bottom) > Math.max(name.y, r.y) + 1;
    }).map(node => node.dataset.portal);
  });
  assert.deepEqual(collisions, [], 'An indoor portal sign covers the login avatar name');
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    context.setDefaultTimeout(15000);
    await context.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* isolated village world regression */' }));
    const open = async name => {
      const url = new URL(preview); url.searchParams.set('user', name);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) missing.push({ status:r.status(), url:r.url() }); });
      await page.goto(url.href); await ready(page);
      const previewToolbar = page.locator('.qp-demo-toolbar:not(.collapsed) [data-hide]');
      if (await previewToolbar.count()) await previewToolbar.click();
      return page;
    };
    a = await open('마을검수하늘');
    if (process.env.QUIZ_VILLAGE_LAND_WATER_ONLY === '1') {
      phase = 'retired stream and retained pond review';
      await a.evaluate(async () => { await Promise.all(QPGame.getVillage().getScene().build().sourceAssets.map(src => {
        const image = new Image(); image.src = src; return image.decode();
      })); });
      await landView(a, '마을-강물제거-실제입장');
      await inspectRetiredStream(a);
      await landRoad(a, 'upper'); await landRoad(a, 'lower'); await retainedPond(a);
      await enterPortal(a, 'shop', 'tailor'); await landView(a, '옷가게-강물제거후-실제입장');
      const exit = (await terrain(a)).portals.find(p => p.action === 'village');
      await enterPortal(a, exit.id, 'village');
      await enterPortal(a, 'school', null, '.class-hub'); await landView(a, '교실-강물제거후-실제입장');
      pass('The connected land roads still lead to the staffed shop and existing classroom list');
      assert.deepEqual(errors, []);
      assert.deepEqual(missing, [], 'The changed village references a missing image or runtime file');
      fs.writeFileSync(path.join(out, '숲속마을-연못과산책길.json'), JSON.stringify({ preview: preview.href, session, isolated: true,
        checks, screenshots, errors, missing, paths, keyboardTraces, landRoutes, pondChecks, screenMetrics }, null, 2));
      console.log('Focused land/pond review: ' + checks.length + ' checks; evidence in ' + out);
      return;
    }
    b = await open('마을검수민트');
    if (process.env.QUIZ_VILLAGE_ROPE_ONLY === '1') {
      phase = 'final rope and compositor review';
      const uid = await a.evaluate(() => QPGame.getMe().k);
      const outdoor = await terrain(a);
      const up = outdoor.travelLinks.find(l => l.id === 'rope-up');
      const down = outdoor.travelLinks.find(l => l.id === 'rope-down');
      await climb(a, b, uid, up);
      await screenshot(a, '마을-전망-추가-fullpage', true);
      await screenshot(a, '마을-전망-추가-viewport-A', false);
      await screenshot(a, '마을-전망-추가-viewport-B', false);
      await climb(a, b, uid, down);
      pass('Local and remote rope ascent and descent use the same physical height phase and land safely');
      await a.evaluate(() => QPGame.go('tailor')); await ready(a, 'tailor');
      const owner = (await terrain(a)).portals.find(p => p.npc === 'owner');
      await enterPortal(a, owner.id, null, '.vt-dialogue:not([hidden])');
      await screenshot(a, '옷가게-주인대화-추가-fullpage', true);
      await screenshot(a, '옷가게-주인대화-추가-viewport-A', false);
      await screenshot(a, '옷가게-주인대화-추가-viewport-B', false);
      pass('The actual log viewpoint and owner dialogue have repeated viewport and full-page captures with header geometry evidence');
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(out, '숲속마을-밧줄-최종.json'), JSON.stringify({ preview: preview.href, session, isolated: true, checks, screenshots, errors, paths, screenMetrics, climbs }, null, 2));
      console.log('Final rope and capture review: ' + climbs.length + ' climbs; evidence in ' + out);
      return;
    }
    if (process.env.QUIZ_VILLAGE_LAYOUT_ONLY === '1') {
      phase = 'final desktop layout review';
      for (const [width, height] of [[1024,632],[1280,632],[1366,768],[1920,1080]]) await checkLayout(a, width, height, '마을');
      await a.evaluate(() => QPGame.go('tailor')); await ready(a, 'tailor');
      for (const [width, height] of [[1024,632],[1280,632],[1366,768],[1920,1080]]) {
        await checkLayout(a, width, height, '옷가게');
        await checkNameSignSeparation(a);
      }
      const catalog = (await terrain(a)).portals.find(p => p.npc === 'owner');
      await enterPortal(a, catalog.id, null, '.vt-dialogue:not([hidden])');
      await screenshot(a, '옷가게-최종-주인대화');
      await a.locator('.vt-dialogue-choices button').filter({ hasText: /^옷 구경하기$/ }).click();
      await a.waitForSelector('#shopAll');
      await a.locator('#tbBack').click(); await ready(a, 'tailor');
      await screenshot(a, '옷가게-최종-상품창복귀');
      pass('Four PC sizes preserve town and shop controls, and shop signs leave the login avatar name visible');
      pass('The adjusted owner sign still routes conversation to the catalog and restores the indoor checkpoint');
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(out, '숲속마을-최종배치.json'), JSON.stringify({ preview: preview.href, session, isolated: true, checks, screenshots, errors, layouts, screenMetrics, paths }, null, 2));
      console.log('Final village layout review: ' + layouts.length + ' views; evidence in ' + out);
      return;
    }
    const aid = await a.evaluate(() => QPGame.getMe().k), bid = await b.evaluate(() => QPGame.getMe().k);
    await a.waitForFunction(uid => QPGame.getVillage().getState().players.some(p => p.uid === uid), bid);
    await b.waitForFunction(uid => QPGame.getVillage().getState().players.some(p => p.uid === uid), aid);
    assert.equal((await state(a)).zone, 'village');
    assert.equal(await a.locator('.vt-actor').count(), 2);
    const smallAvatar = await a.locator('.vt-actor.is-me .vt-avatar > svg').boundingBox();
    assert(smallAvatar.height <= 105, 'Town avatars should leave room for the village and friends');
    await screenshot(a, '마을-실제로그인-광장');
    const peer = await rosterPlayer(a, bid), me = await state(a);
    assert(Math.hypot(me.x - peer.x, me.y - peer.y) > 20, 'Two login avatars overlap in the gathering spot');
    pass('Login enters the actual town with two distinct, small student avatars');

    phase = 'keyboard and collision';
    const outdoor = await terrain(a);
    const { mainRamp, plateau, garden } = outdoor.surfaces;
    await inspectRetiredStream(a);
    const groundHeight = outdoor.spawn.height || 0;
    const keyboardStart = await state(a);
    await keyHold(a, ['ArrowRight'], 550);
    const keyboardEnd = await state(a);
    assert(keyboardEnd.x > keyboardStart.x + 45 && Math.abs(keyboardEnd.y - keyboardStart.y) < 2);
    await b.waitForFunction(({ uid, x }) => Math.abs(QPGame.getVillage().getState().players.find(p => p.uid === uid)?.x - x) < 10, { uid: aid, x: keyboardEnd.x });
    await a.locator('#tbRank').click(); await a.locator('#rkA').click(); await a.keyboard.press('Escape');
    await a.waitForSelector('#modal.on', { state: 'hidden' });
    assert.equal(await a.evaluate(() => document.activeElement.classList.contains('vt-viewport')), true);
    const modalPosition = await state(a);
    await a.keyboard.down('ArrowRight'); await pause(350); await a.keyboard.up('ArrowRight');
    assert((await state(a)).x > modalPosition.x + 30, 'The modal did not restore movement focus');
    await a.locator('[data-tool="reset"]').click();
    await walk(a, { x: mainRamp.x - mainRamp.w * .23, y: plateau.y + plateau.h + mainRamp.h * .2, height: groundHeight }, 'cliff-approach');
    await keyHold(a, ['ArrowUp', 'ArrowLeft', 'Space'], 1300);
    const cliff = await state(a);
    assert.equal(cliff.height, groundHeight, 'Diagonal movement/jumping must not climb a cliff');
    assert(cliff.y >= plateau.y + plateau.h, 'A jump must not bypass the closed plateau edge');
    assert(keyboardTraces.at(-1).samples.every(s => s.height === groundHeight && s.y >= plateau.y + plateau.h), 'A transient jump bypassed the plateau edge');
    await a.locator('[data-tool="reset"]').click();
    const shopWall = outdoor.solids.find(s => s.id === 'shop-wall');
    assert(shopWall, 'The shop needs a solid footprint');
    await walk(a, { x: shopWall.x - 20, y: shopWall.y + shopWall.h + 47, height: groundHeight }, 'shop-wall-approach');
    await keyHold(a, ['ArrowUp', 'ArrowRight'], 1100);
    const wall = await state(a);
    assert(await a.evaluate(s => QPVillageScene.canStand(s.x, s.y, s.height, 11), wall), 'Keyboard movement entered a building wall');
    assert(!(wall.x > shopWall.x - 11 && wall.x < shopWall.x + shopWall.w + 11 && wall.y > shopWall.y - 11 && wall.y < shopWall.y + shopWall.h + 11), 'Diagonal collision cuts through the shop wall');
    pass('Real keyboard moves and synchronizes; diagonal walking and jumps respect cliffs and building bodies');

    await a.locator('[data-tool="reset"]').click();
    await landRoad(a, 'lower');
    await retainedPond(a);

    phase = 'greetings';
    await a.locator('[data-tool="reset"]').click();
    await b.bringToFront(); await b.locator('[data-tool="reset"]').click();
    await a.bringToFront(); await a.locator('.vt-viewport').focus(); await a.keyboard.press('KeyF');
    await b.waitForFunction(uid => QPGame.getVillage().getState().players.some(p => p.uid === uid && p.gesture?.type === 'wave' && p.gesture?.at > Date.now() - 3000), aid);
    await b.bringToFront();
    await b.waitForSelector('.vt-actor[data-uid="' + aid + '"] .vt-bubble:not([hidden])');
    await screenshot(b, '마을-친구에게-손흔들기');
    const gesture = (await rosterPlayer(b, aid)).gesture;
    assert(gesture.at > 0 && gesture.duration >= 400 && gesture.duration <= 5000);
    pass('A real F-key greeting reaches the other student with its original timestamp and visible bubble');

    phase = 'continuous ramps and open upper road';
    const rampFoot = { x: mainRamp.x + mainRamp.w / 2, y: mainRamp.y + mainRamp.h - 3 };
    rampFoot.height = await a.evaluate(p => QPGame.getVillage().getScene().surfaceAt(p.x, p.y).height, rampFoot);
    await walk(a, rampFoot, 'main-ramp-foot');
    const ascent = await walk(a, { x: mainRamp.x + mainRamp.w / 2, y: mainRamp.y, height: plateau.height }, 'main-ramp-ascent');
    assert(ascent.some(s => s.height > plateau.height * .2 && s.height < plateau.height * .85), 'The slope must expose intermediate elevations');
    for (let i = 1; i < ascent.length; i++) assert(ascent[i].height >= ascent[i - 1].height - 0.1, 'Ascent should be monotonic');
    await screenshot(a, '마을-돌계단-상단');
    await landRoad(a, 'upper');
    pass('The actual walk gradually climbs the main staircase and follows the connected upper land road');

    const wood = outdoor.surfaces.woodRamp;
    assert(wood, 'A second, curving staircase should lead up the western forest');
    const woodEnds = await a.evaluate(rect => {
      const scene = QPGame.getVillage().getScene();
      function point(y) {
        const points = [];
        for (let x = rect.x; x <= rect.x + rect.w; x += 2) {
          const s = scene.surfaceAt(x, y);
          if (s.allowed && /나무 계단/.test(s.label) && scene.canStand(x, y, s.height)) points.push({ x, y, height: s.height });
        }
        return points[Math.floor(points.length / 2)];
      }
      return { foot: point(rect.y + rect.h - 2), top: point(rect.y) };
    }, wood);
    assert(woodEnds.foot && woodEnds.top, 'Curving staircase endpoints are blocked');
    await walk(a, woodEnds.foot, 'wood-ramp-foot');
    const woodAscent = await walk(a, woodEnds.top, 'wood-ramp-ascent');
    assert(woodAscent.some(s => s.height > plateau.height * .2 && s.height < plateau.height * .8));
    assert(Math.abs(woodEnds.top.x - woodEnds.foot.x) > wood.w * .2);
    await screenshot(a, '마을-서쪽-구불구불나무계단');
    pass('A separate winding wooden staircase provides another real route between the lower and upper forest');

    phase = 'upper doors';
    await enterPortal(a, 'quiz', null, '#prWrap');
    await a.evaluate(() => QPGame.go('village')); await ready(a);
    const classroomId = await a.evaluate(() => QPClassroom.create(QPDemo.db, {
      mode: 'round', teacherId: 'fixture_teacher',
      set: { title: '마을 교실 연결 검수', qs: [{ type: 'short', q: '봄 다음 계절은?', a: '여름' }] },
      settings: { delivery: 'solo', title: '마을 교실 연결 검수', duration: 120, timer: 30 }
    }));
    await enterPortal(a, 'school', null, '.class-hub');
    await a.locator('[data-session="' + classroomId + '"]').click();
    await a.waitForFunction(id => QPGame.getClassroom()?.id === id, classroomId);
    await a.locator('[data-round-answer] .qpq-short-input').fill('여름');
    await a.locator('[data-round-answer] .qpq-short-input').press('Enter');
    await a.waitForFunction(({ id, uid }) => {
      const tree = JSON.parse(localStorage.getItem(QPDemo.storageKey) || '{}');
      return tree.quiz?.classrooms?.[id]?.players?.[uid]?.score === 100;
    }, { id: classroomId, uid: aid });
    await a.evaluate(() => QPGame.go('village')); await ready(a);
    assert(Math.abs((await state(a)).height - garden.height) < 1);
    await screenshot(a, '마을-나무집교실-입구');
    pass('Walking and E open both upper buildings; the classroom list enters and grades a real saved session');

    phase = 'shop interior and catalog';
    await enterPortal(a, 'shop', 'tailor');
    const descent = paths.findLast(p => p.name === 'door-shop').samples;
    assert(descent.some(s => s.height > plateau.height + 3 && s.height < garden.height - 3) && descent.some(s => s.height > plateau.height * .2 && s.height < plateau.height * .85));
    for (let i = 1; i < descent.length; i++) assert(descent[i].height <= descent[i - 1].height + .1, 'Staircase descent must remain gradual and monotonic');
    await screenshot(a, '옷가게-실제문입장');
    const interior = await terrain(a);
    await checkNameSignSeparation(a);
    await floorClick(a, { x: interior.spawn.x + 90, y: interior.spawn.y - 55, height: interior.spawn.height || 0 });
    pass('An actual click on the indoor floor reaches the clicked position after centered camera projection');
    const shopScene = await a.evaluate(() => QPGame.getVillage().getScene().portals);
    const catalogPortal = shopScene.find(p => p.id === 'catalog' || p.action === 'catalog'), mirrorPortal = shopScene.find(p => p.action === 'wardrobe'), exitPortal = shopScene.find(p => p.action === 'village'), clerkPortal = shopScene.find(p => p.npc === 'clerk');
    assert(catalogPortal && mirrorPortal && exitPortal, 'The interior needs catalog, mirror and exit interactions');
    assert.equal(await a.locator('.vt-actor[data-npc]').count(), 2, 'Owner and clerk should be visible in the shop');
    await enterPortal(a, catalogPortal.id, null, '.vt-dialogue:not([hidden])');
    assert.match(await a.locator('.vt-dialogue').innerText(), /새잎 주인/);
    await screenshot(a, '옷가게-주인과이야기');
    await a.locator('.vt-dialogue-choices button').filter({ hasText: /^옷 구경하기$/ }).click();
    await a.waitForSelector('#shopAll');
    assert.equal(await a.locator('#shopAll').getAttribute('aria-pressed'), 'true');
    await b.locator('.vt-friends-toggle').click();
    await b.waitForFunction(name => [...document.querySelectorAll('.vt-friend-row')].some(n => n.textContent.includes(name) && n.textContent.includes('옷 고르기')), '마을검수하늘');
    await screenshot(b, '마을-친구목록-옷고르기위치');
    const checkpoint = paths.findLast(p => p.name === 'door-' + catalogPortal.id).end;
    const oldTop = await a.evaluate(() => QPGame.getMe().av.top);
    await a.locator('#shopOwned').click(); await a.locator('#shTabs [data-c="top"]').click();
    const item = await a.locator('#shGrid .itm[data-id]').evaluateAll((nodes, old) => nodes.find(n => n.dataset.id !== 'top:' + old)?.dataset.id, oldTop);
    assert(item, 'A different owned top is needed to inspect outfit synchronization');
    await a.locator('#shGrid .itm[data-id="' + item + '"]').click(); await a.locator('#btnWear').click();
    const newTop = await a.evaluate(() => QPGame.getMe().av.top);
    assert.notEqual(newTop, oldTop);
    await b.waitForFunction(({ uid, top }) => QPGame.getVillage().getState().players.some(p => p.uid === uid && p.avatar.top === top), { uid: aid, top: newTop });
    await a.locator('#tbBack').click(); await ready(a, 'tailor');
    const restored = await state(a);
    assert(Math.hypot(restored.x - checkpoint.x, restored.y - checkpoint.y) < 5);
    await enterPortal(a, mirrorPortal.id, null, '#shopOwned');
    assert.equal(await a.locator('#shopOwned').getAttribute('aria-pressed'), 'true');
    await a.locator('#tbBack').click(); await ready(a, 'tailor');
    await screenshot(a, '옷가게-거울-돌아온자리');
    pass('Walking inside opens the catalog and mirror; owned outfit changes synchronize and back restores the indoor position');
    assert(clerkPortal, 'The clerk needs a reachable conversation spot');
    await enterPortal(a, clerkPortal.id, null, '.vt-dialogue:not([hidden])');
    assert.match(await a.locator('.vt-dialogue').innerText(), /도토리/);
    await screenshot(a, '옷가게-알바생과이야기');
    await a.locator('.vt-dialogue-choices button').filter({ hasText: /^피팅룸에서 입어 보기$/ }).click();
    await a.waitForSelector('#pvStage');
    assert.match(await a.locator('.top .nm').innerText(), /피팅룸/);
    await a.locator('#tbBack').click(); await ready(a, 'tailor');
    await enterPortal(a, clerkPortal.id, null, '.vt-dialogue:not([hidden])');
    await a.locator('.vt-dialogue-choices button').filter({ hasText: /^내 옷장 열기$/ }).click();
    await a.waitForSelector('#shopOwned');
    assert.equal(await a.locator('#shopOwned').getAttribute('aria-pressed'), 'true');
    await a.locator('#tbBack').click(); await ready(a, 'tailor');
    pass('The shop owner talks and opens merchandise; the clerk separately opens the fitting room and wardrobe');

    phase = 'desktop layouts';
    for (const [width, height] of [[1024,632],[1280,632],[1366,768],[1920,1080]]) await checkLayout(a, width, height, '옷가게');
    await enterPortal(a, exitPortal.id, 'village');
    for (const [width, height] of [[1024,632],[1280,632],[1366,768],[1920,1080]]) await checkLayout(a, width, height, '마을');
    await a.setViewportSize({ width: 1366, height: 768 });
    pass('Town and interior controls fit four PC sizes without overlap, clipping or horizontal overflow');

    phase = 'high-log rope';
    const ropeUp = outdoor.travelLinks.find(l => l.id === 'rope-up'), ropeDown = outdoor.travelLinks.find(l => l.id === 'rope-down');
    assert(ropeUp && ropeDown, 'The high log needs an up and down rope');
    assert.equal(await a.evaluate(target => QPGame.getVillage().navigate(target), ropeUp.to), false, 'A ground path must not bypass the isolated high platform');
    await climb(a, b, aid, ropeUp); await screenshot(a, '마을-높은통나무-전망');
    await climb(a, b, aid, ropeDown);
    pass('E climbs and descends the isolated high log with continuous height and synchronized climbing pose');

    phase = 'same-account sibling and logout';
    sibling = await open('마을검수하늘');
    const siblingPresence = await sibling.evaluate(() => QPGame.getVillagePresence().getState());
    await b.waitForFunction(uid => QPGame.getVillage().getState().players.filter(p => p.uid === uid && p.zone === 'village').length === 1, aid);
    assert.equal(await b.locator('.vt-actor[data-uid="' + aid + '"]').count(), 1);
    await logout(sibling);
    await b.waitForFunction(({ path, connectionId }) => {
      const tree = JSON.parse(localStorage.getItem(QPDemo.storageKey) || '{}');
      const connections = path.split('/').filter(Boolean).reduce((node, key) => node?.[key], tree);
      return !connections?.[connectionId];
    }, siblingPresence);
    await b.waitForFunction(uid => QPGame.getVillage().getState().players.filter(p => p.uid === uid && p.zone === 'village').length === 1, aid);
    assert.equal(await b.locator('.vt-actor[data-uid="' + aid + '"]').count(), 1);
    await sibling.close(); sibling = null;
    await a.evaluate(() => { window.__previousVillage = QPGame.getVillage(); });
    const retired = await state(a);
    await logout(a);
    await b.waitForFunction(uid => !QPGame.getVillage().getState().players.some(p => p.uid === uid), aid);
    const freshUid = 'fixture_new_' + session;
    await a.evaluate(async uid => {
      const user = { name: '새로그인검수', av: QPGame.newAvatar('m'), gold: 300, owned: {}, stat: {} };
      await QPDemo.db.ref('quiz/users/' + uid).set(user); QPGame.enterUser(uid, user);
    }, freshUid);
    await ready(a);
    await b.waitForFunction(uid => QPGame.getVillage().getState().players.some(p => p.uid === uid), freshUid);
    await keyHold(a, ['ArrowRight'], 350);
    const stoppedState = await a.evaluate(() => window.__previousVillage.getState());
    assert(Math.hypot(stoppedState.x - retired.x, stoppedState.y - retired.y) < 1, 'A destroyed world kept receiving keyboard input');
    assert.equal((await state(b)).players.some(p => p.uid === aid), false);
    pass('One account renders once across sibling tabs; sibling logout preserves the other connection and final logout removes old identity and handlers');
    assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
    fs.writeFileSync(path.join(out, '숲속마을-검증.json'), JSON.stringify({ preview: preview.href, session, isolated: true, checks, screenshots, errors, layouts, paths, keyboardTraces, climbs, floorClicks, screenMetrics }, null, 2));
    for (const stale of ['숲속마을-실패.json','실패-학생A.png','실패-학생B.png']) fs.rmSync(path.join(out, stale), { force: true });
    console.log('Village world regression: ' + checks.length + ' checks; evidence in ' + out);
  } catch (error) {
    console.error('Village world regression failed in ' + phase + ': ' + error.stack);
    if (a) await screenshot(a, '실패-학생A').catch(() => {});
    if (b) await screenshot(b, '실패-학생B').catch(() => {});
    fs.writeFileSync(path.join(out, '숲속마을-실패.json'), JSON.stringify({ phase, checks, errors, error: error.stack, layouts, paths, keyboardTraces, climbs, floorClicks, screenMetrics }, null, 2));
    process.exitCode = 1;
  } finally { await browser?.close(); }
})();
