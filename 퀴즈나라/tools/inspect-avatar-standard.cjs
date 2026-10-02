'use strict';

// Repeatable visual evidence for the approved SD avatar. Passing the control
// checks does not establish art quality; review the large and actual-size PNGs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repository = path.resolve(__dirname, '..');
const target = process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/';
const output = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || path.join(repository, '검증', '아바타-기준검수'));
const baselineDirectory = process.env.QUIZ_AVATAR_BASELINE_DIR ? path.resolve(process.env.QUIZ_AVATAR_BASELINE_DIR) : null;
const sourceFiles = [
  'avatar-pixel.js', 'avatar-clothes.js', 'avatar-poses.js', 'avatar-direction.js',
  'avatar-shoes.js', 'avatar-shoes-profile.js', 'avatar-accessory-direction.js',
  'avatar-motion.js', 'avatar-motion.css', 'woodland-avatar.css', 'school-room-world.css'
];
const report = {
  startedAt: new Date().toISOString(), completedAt: null, target, output,
  baselineDirectory, baselineOverrides: [], sourceHashes: {}, outfits: [],
  screenshots: [], renderedSheets: [], controlChecks: [], errors: [], missingResources: [],
  scope: {
    outfitCount: 3, sourceSizes: [224, 76], directions: ['front', 'right', 'back', 'left'],
    poses: ['idle', 'walk', 'floor-sit', 'desk-sit', 'jump-up', 'jump-down'],
    walkingPhases: Array.from({ length: 8 }, (_, index) => index / 8),
    phaseDirections: ['front', 'right', 'back'],
    actualControls: ['ArrowRight', 'ArrowUp', 'ArrowDown', 'C floor sit/stand', 'C classroom desk sit/stand'],
    jumpValidation: 'Direct pose rendering; the live school controller jump is not exercised.',
    realFirebaseTested: false, realSchoolDevicesTested: false,
    artQuality: 'Requires direct visual review of the PNGs; control checks and counts are not an art rating.'
  },
  success: false
};
let browser;
let phase = 'startup';
fs.mkdirSync(output, { recursive: true });

function saveReport() {
  report.phase = phase;
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
async function screenshot(page, filename, options = {}) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(output, filename), ...options });
  report.screenshots.push(filename);
}
async function actorScreenshot(page, filename) {
  const box = await page.locator('.sr-actor.is-me .sr-avatar > svg').boundingBox();
  assert(box, 'The actual school actor must be visible.');
  const viewport = page.viewportSize();
  const x = Math.max(0, box.x - 40), y = Math.max(0, box.y - 40);
  const right = Math.min(viewport.width, box.x + box.width + 40);
  const bottom = Math.min(viewport.height, box.y + box.height + 50);
  assert(right > x && bottom > y, 'The actual actor must be inside the camera.');
  await screenshot(page, filename, { clip: { x, y, width: right - x, height: bottom - y } });
}
async function visualState(page, zone) {
  return page.evaluate(zone => {
    const controller = zone === 'campus' ? QPGame.getCampus() : QPGame.getPlayground();
    const svg = document.querySelector('.sr-actor.is-me .sr-avatar > svg');
    const box = svg.getBoundingClientRect();
    return {
      state: controller.getState(), view: svg.dataset.qpxView || 'front',
      facing: svg.dataset.qpxViewFacing || 'front', pose: svg.dataset.qpxPose,
      displayedWidth: box.width, displayedHeight: box.height
    };
  }, zone);
}
async function liveOutfit(page, entry) {
  phase = entry.id + '/actual-playground';
  await page.evaluate(av => {
    Object.assign(QPGame.getMe().av, av);
    QPGame.go('playground', { x: 2789, y: 796 });
  }, entry.av);
  await page.waitForSelector('.sr-actor.is-me .sr-avatar > svg');
  await page.locator('.school-room-world').focus();
  for (const [direction, key] of [['right', 'ArrowRight'], ['back', 'ArrowUp'], ['front', 'ArrowDown']]) {
    phase = entry.id + '/actual-' + direction;
    const beforeMove = await visualState(page, 'playground');
    await page.keyboard.down(key);
    await page.waitForFunction(({ direction, before }) => {
      const state = QPGame.getPlayground().getState();
      return state.moving && state.direction === direction && Math.hypot(state.x - before.x, state.y - before.y) > 12;
    }, { direction, before: beforeMove.state });
    const expectedView = direction === 'right' ? 'profile' : direction;
    await page.waitForFunction(view => document.querySelector('.sr-actor.is-me .sr-avatar > svg')?.dataset.qpxView === view, expectedView);
    await actorScreenshot(page, entry.id + '-actual-' + direction + '-walk.png');
    await page.keyboard.up(key);
    await page.waitForFunction(() => !QPGame.getPlayground().getState().moving);
    const standing = await visualState(page, 'playground');
    await actorScreenshot(page, entry.id + '-actual-' + direction + '-idle.png');
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => QPGame.getPlayground().getState().pose === 'sit-floor' &&
      document.querySelector('.sr-actor.is-me .sr-avatar > svg')?.dataset.qpxPose === 'floor-sit');
    const sitting = await visualState(page, 'playground');
    assert.equal(sitting.state.seatId, null, 'Basic C sitting must use the floor pose.');
    assert.equal(sitting.view, expectedView, 'C must retain the original direction.');
    assert(Math.hypot(sitting.state.x - standing.state.x, sitting.state.y - standing.state.y) < .1, 'C floor sitting must retain the ground position.');
    await actorScreenshot(page, entry.id + '-actual-' + direction + '-floor.png');
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => QPGame.getPlayground().getState().pose === 'idle' &&
      document.querySelector('.sr-actor.is-me .sr-avatar > svg')?.dataset.qpxPose === 'idle');
    const returned = await visualState(page, 'playground');
    assert.equal(returned.view, expectedView, 'Standing must restore the original direction.');
    report.controlChecks.push({ outfit: entry.id, zone: 'playground', direction, standing, sitting, returned });
  }
  await screenshot(page, entry.id + '-playground.png');

  phase = entry.id + '/actual-classroom-desk';
  await page.evaluate(() => QPGame.go('campus'));
  await page.waitForFunction(() => QPGame.getCampus()?.scene?.seats?.length > 0);
  const seat = await page.evaluate(() => {
    const seats = QPGame.getCampus().scene.seats;
    const seat = seats[Math.floor(seats.length / 2)];
    return { id: seat.id, approach: seat.approach || seat.exit };
  });
  assert(seat.approach, 'The classroom desk needs an approach position.');
  await page.evaluate(point => QPGame.go('campus', point), seat.approach);
  await page.waitForFunction(() => QPGame.getCampus() && document.querySelector('.sr-actor.is-me .sr-avatar > svg'));
  await page.locator('.school-room-world').focus();
  const standing = await visualState(page, 'campus');
  await actorScreenshot(page, entry.id + '-classroom-idle.png');
  await page.keyboard.press('KeyC');
  await page.waitForFunction(id => QPGame.getCampus().getState().pose === 'sit' && QPGame.getCampus().getState().seatId === id, seat.id);
  await page.waitForFunction(() => document.querySelector('.sr-actor.is-me .sr-avatar > svg')?.dataset.qpxPose === 'sit');
  const sitting = await visualState(page, 'campus');
  assert.equal(sitting.view, 'back', 'The classroom desk must face the blackboard.');
  await actorScreenshot(page, entry.id + '-classroom-desk.png');
  await screenshot(page, entry.id + '-classroom.png');
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => QPGame.getCampus().getState().pose === 'idle' && QPGame.getCampus().getState().seatId === null);
  const returned = await visualState(page, 'campus');
  await actorScreenshot(page, entry.id + '-classroom-returned.png');
  report.controlChecks.push({ outfit: entry.id, zone: 'campus', seatId: seat.id, standing, sitting, returned });
}
async function sheet(page, entry, direction, states, kind) {
  phase = entry.id + '/' + kind + '/' + direction;
  await page.setViewportSize({ width: states.length * 245 + 28, height: 700 });
  await page.evaluate(({ entry, direction, states }) => {
    document.body.innerHTML = '<main style="padding:14px"><h2>' + entry.id + ' · ' + direction +
      ' · 224px / 76px</h2><div id="cards" style="grid-template-columns:repeat(' + states.length + ',1fr)"></div></main>';
    const host = document.querySelector('#cards');
    for (const state of states) {
      const card = document.createElement('article');
      card.innerHTML = '<b>' + state.label + '</b><div>' + QPAvatar.render(entry.av, 224, 3) + '</div><div>' + QPAvatar.render(entry.av, 76, 3) + '</div>';
      host.append(card);
      for (const svg of card.querySelectorAll('svg.qp-illustrated-avatar')) {
        if (!QPAvatarPose.apply(svg, { ...state, direction, facing: direction === 'left' ? 'left' : 'right' })) throw new Error('The standard avatar rig did not mount.');
      }
    }
  }, { entry, direction, states });
  const filename = entry.id + '-' + kind + '-' + direction + '.png';
  await screenshot(page, filename, { fullPage: true });
  report.renderedSheets.push({ outfit: entry.id, kind, direction, states, sizes: [224, 76], filename });
}

(async () => {
  const { chromium } = require('playwright');
  for (const filename of sourceFiles) {
    const source = baselineDirectory && fs.existsSync(path.join(baselineDirectory, filename)) ? path.join(baselineDirectory, filename) : path.join(repository, filename);
    report.sourceHashes[filename] = { origin: source, sha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex') };
  }
  if (baselineDirectory) assert(fs.statSync(baselineDirectory).isDirectory(), 'The optional baseline path must be a directory.');
  browser = await chromium.launch({ headless: true, executablePath: process.env.QUIZ_BROWSER_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.route('**/www.gstatic.com/firebasejs/**', route => route.fulfill({ body: '/* isolated avatar visual inspection */', contentType: 'text/javascript' }));
  await context.route('**/*firebaseio.com/**', route => route.abort());
  if (baselineDirectory) for (const filename of sourceFiles) {
    const source = path.join(baselineDirectory, filename);
    if (!fs.existsSync(source)) continue;
    report.baselineOverrides.push(filename);
    await context.route(url => path.basename(url.pathname) === filename, route => route.fulfill({ body: fs.readFileSync(source), contentType: filename.endsWith('.css') ? 'text/css' : 'text/javascript' }));
  }
  if (baselineDirectory) assert(report.baselineOverrides.length > 0, 'The baseline directory must contain relevant avatar sources.');
  const page = await context.newPage();
  page.setDefaultTimeout(18000);
  page.on('pageerror', error => report.errors.push(error.stack || error.message));
  page.on('response', response => { if (response.status() >= 400) report.missingResources.push({ url: response.url(), status: response.status() }); });
  const url = new URL(target);
  url.searchParams.set('demo', '1');
  url.searchParams.set('session', 'avatar-standard-' + Date.now() + '-' + process.pid);
  url.searchParams.set('user', '아바타기준검수');
  await page.goto(url.href);
  await page.waitForFunction(() => QPGame.getMe() && QPAvatar.atlas.ready && QPAvatarDirection.atlas.ready &&
    QPAvatarDirection.atlas.backReady && QPClothes.atlas.ready && QPShoes.atlas.partsReady);
  report.outfits = await page.evaluate(() => {
    const catalog = QPGame.getCatalog();
    const find = (category, preferred) => preferred.find(shape => catalog.ITEMS[category + ':' + shape + ':0']) || Object.keys(catalog.CATS.find(c => c.k === category).src)[0];
    const base = { ...QPGame.getMe().av, expression: 'bright:0', pet: '', effect: '', face: '', bg: '', frame: '' };
    return [
      { id: 'm-hood', av: { ...base, sex: 'm', hair: 'messy:1', sk: 4, top: 'hood:5', bottom: 'jeans:5', shoes: 'boots:8', hat: find('hat', ['cap']) + ':3', glass: 'round:0', ear: 'ring:0', neck: 'cross_n:0', back: find('back', ['bag', 'cape']) + ':5' } },
      { id: 'f-hanbok', av: { ...base, sex: 'f', hair: 'bob:1', sk: 0, top: 'hanbok:7', bottom: 'hanbok:5', shoes: 'ballet:8', hat: find('hat', ['flower', 'ribbon', 'beret']) + ':7', glass: 'half:0', ear: 'star_e:0', neck: 'gem:0', back: find('back', ['fairy', 'wings', 'bag']) + ':5' } },
      { id: 'f-overall', av: { ...base, sex: 'f', hair: 'pony:1', sk: 2, top: 'overall:7', bottom: 'shorts:5', shoes: 'wing_shoes:8', hat: find('hat', ['headphone', 'cat', 'bow']) + ':5', glass: find('glass', ['sun', 'sport', 'round']) + ':0', ear: 'heart_e:0', neck: 'choker:0', back: find('back', ['bag', 'cape']) + ':7' } }
    ];
  });
  for (const entry of report.outfits) await liveOutfit(page, entry);
  await page.evaluate(() => {
    QPGame.go('home');
    document.head.insertAdjacentHTML('beforeend', '<style>html,body{height:auto!important;overflow:visible!important;display:block!important;background:#f3ecdb!important;color:#57432e}.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}article{background:#fffaf2;border:1px solid #cfbfa4;border-radius:10px;padding:8px;min-height:350px;display:flex;flex-direction:column;justify-content:space-between}#cards{display:grid;gap:8px}article b{font-size:15px}</style>');
  });
  const states = [
    { action: 'idle', label: 'idle', grounded: true }, { action: 'walk', phase: .25, label: 'walk .25', grounded: true },
    { action: 'floor-sit', seatMode: 'floor', label: 'floor sit', grounded: true }, { action: 'sit', seatMode: 'desk', label: 'desk sit', grounded: true },
    { action: 'jump', grounded: false, vy: 320, label: 'jump up' }, { action: 'jump', grounded: false, vy: -320, label: 'jump down' }
  ];
  for (const entry of report.outfits) for (const direction of report.scope.directions) await sheet(page, entry, direction, states, 'poses');
  for (const entry of report.outfits) for (const direction of report.scope.phaseDirections) await sheet(page, entry, direction,
    report.scope.walkingPhases.map(phase => ({ action: 'walk', phase, label: 'walk ' + phase, grounded: true })), 'phases');
  assert.deepEqual(report.errors, [], 'Runtime errors occurred during the visual inspection.');
  assert.deepEqual(report.missingResources, [], 'Required preview resources did not load.');
  phase = 'completed';
  report.success = true;
  saveReport();
  console.log(JSON.stringify({ output, controlChecks: report.controlChecks.length, sheets: report.renderedSheets.length, screenshots: report.screenshots.length, artQuality: report.scope.artQuality }, null, 2));
  await browser.close();
})().catch(async error => {
  report.failure = error.stack || error.message;
  saveReport();
  console.error('Avatar inspection failed at ' + phase + ': ' + report.failure);
  await browser?.close();
  process.exitCode = 1;
});
