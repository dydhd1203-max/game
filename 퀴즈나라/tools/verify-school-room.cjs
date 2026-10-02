'use strict';

// Actual student input in a fresh local demo store. This does not test deployed
// Firebase rules or invent missing source artwork. Movement uses pointer/keys;
// readonly scene/controller snapshots are used only to observe the result.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.QUIZ_VERIFICATION_OUTPUT
  ? path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT)
  : path.resolve(__dirname, '../검증/교실-플레이-2026-10-02');
const preview = new URL(process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/');
const session = 'school-room-' + Date.now() + '-' + process.pid;
const startedAt = new Date().toISOString();
preview.searchParams.set('demo', '1');
preview.searchParams.set('session', session);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || process.env.QUIZ_BROWSER_EXECUTABLE
  || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const checks = [], errors = [], missing = [], screenshots = [], seatResults = [];
let browser, host, a, b, phase = 'startup';
fs.mkdirSync(output, { recursive: true });
function pass(name, detail) {
  checks.push({ name, ...(detail === undefined ? {} : { detail }) });
  console.log('PASS: ' + name);
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function state(page) { return page.evaluate(() => QPGame.getCampus()?.getState()); }
async function rendered(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function screenshot(page, name) {
  await rendered(page);
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: false });
  screenshots.push(name + '.png');
}
async function seatGeometry(page, seatId) {
  return page.evaluate(async seatId => {
    const svg = document.querySelector('.sr-actor.is-me .sr-avatar>svg'), copy = svg.cloneNode(true);
    const selected = copy.querySelector('[data-qpx-back-head]');
    if (!selected) throw new Error('The seated avatar must have real illustrated back-head artwork');
    for (const leaf of copy.querySelectorAll('path,ellipse,rect,image,polygon,line,polyline,circle')) {
      if (leaf.closest('defs')) continue;
      if (!selected.contains(leaf)) leaf.remove();
    }
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const actual = svg.getBoundingClientRect(), deskNode = document.querySelector('[data-art="' + seatId + '-desk"]');
    const desk = deskNode.getBoundingClientRect(), actor = svg.closest('.sr-actor');
    let painted = 0, belowTop = 0, first = Infinity, last = -Infinity;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] <= 100) continue;
      const screenY = actual.top + y * actual.height / canvas.height;
      painted++; if (screenY >= desk.top) belowTop++;
      first = Math.min(first, screenY); last = Math.max(last, screenY);
    }
    const upper = svg.querySelector('[data-qpx-pose-part="upper"]');
    const hip = new DOMPoint(16, 39.25).matrixTransform(upper.getScreenCTM());
    const world = document.querySelector('.sr-world'), wr = world.getBoundingClientRect();
    const scale = new DOMMatrix(getComputedStyle(world).transform).a;
    const seat = QPSchoolRoomScene.seats.find(item => item.id === seatId);
    return { painted, belowDesktop: painted ? belowTop / painted : 0, hairTop: first, hairBottom: last,
      desktopTop: desk.top, desktopBottom: desk.top + desk.height * 35 / 90,
      hipWorld: {x:(hip.x-wr.left)/scale, y:(hip.y-wr.top)/scale},
      chairSeatY: [seat.rect.y+52,seat.rect.y+68],
      actorDepth: Number(actor.style.zIndex), deskDepth: Number(deskNode.style.zIndex) };
  }, seatId);
}
async function soles(page) {
  return page.evaluate(async () => {
    const svg = document.querySelector('.sr-actor.is-me .sr-avatar>svg'), bounds = svg.getBoundingClientRect(), result = [];
    for (const side of ['left', 'right']) {
      const selector = '.qps-foot[data-qps-foot-side="' + side + '"]';
      const original = svg.querySelector(selector); if (!original) throw new Error('A complete ' + side + ' shoe is required');
      const copy = svg.cloneNode(true), selected = copy.querySelector(selector);
      for (const leaf of copy.querySelectorAll('path,ellipse,rect,image,polygon,line,polyline,circle')) {
        if (leaf.closest('defs')) continue;
        if (!selected.contains(leaf)) leaf.remove();
      }
      const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth * 4; canvas.height = image.naturalHeight * 4;
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let last = -1, count = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > 100) { last = Math.max(last, y); count++; }
      const matrix = original.getScreenCTM();
      const slope = Math.abs(matrix.b) / Math.hypot(matrix.a, matrix.b);
      result.push({ side, pixels: count, bottom: bounds.top + last * bounds.height / canvas.height,
        // The production idle sway is +/- .4 degrees. It must not be confused
        // with a turned-up shoe or erased by the regression harness.
        angle: Math.asin(Math.min(1, slope)) * 180 / Math.PI,
        parallel: slope < Math.sin(Math.PI / 180) });
    }
    return result;
  });
}
async function campus(page) {
  await page.waitForFunction(() => !!QPGame.getCampus());
  await page.waitForFunction(() => QPAvatar.atlas.ready && QPClothes.atlas.ready
    && QPShoes.atlas.partsReady && QPAvatarDirection.atlas.ready && QPAvatarDirection.atlas.backReady);
  await page.waitForSelector('.school-room-world');
  await rendered(page);
}
async function coverage(page) {
  const bounds = await page.evaluate(() => {
    const rect = selector => {
      const item = document.querySelector(selector).getBoundingClientRect();
      return { top:item.top, right:item.right, bottom:item.bottom, left:item.left };
    };
    return { viewport:rect('.school-room-world'), originalSurfaces:rect('[data-art="source-room-surfaces"]'),
      camera:QPGame.getCampus().getState().camera };
  });
  const { viewport, originalSurfaces } = bounds;
  assert(originalSurfaces.top <= viewport.top + 1 && originalSurfaces.left <= viewport.left + 1
    && originalSurfaces.right >= viewport.right - 1 && originalSurfaces.bottom >= viewport.bottom - 1,
    'The original classroom surfaces must cover the entire camera viewport without the old forest showing: ' + JSON.stringify(bounds));
  return bounds;
}
async function availableChair(page, id) {
  // The local stand pose precedes the shared release write. Observe the real
  // available interaction and released owner lease before one genuine E input.
  await page.waitForFunction(id => {
    const interaction = QPGame.getCampus().getState();
    const chair = document.querySelector('[data-sr-seat="' + CSS.escape(id) + '"]');
    if (interaction.seatId || interaction.seatPending || interaction.nearest?.type !== 'seat'
      || interaction.nearest.id !== id || chair?.classList.contains('is-occupied')) return false;
    const presence = QPGame.getCampusPresence().getState();
    const parts = presence.path.replace(/\/connections$/, '/seats/' + id).split('/');
    const tree = JSON.parse(localStorage.getItem(QPDemo.storageKey) || '{}');
    const claim = parts.reduce((node, key) => node?.[key], tree);
    return !claim?.claims?.[claim.owner];
  }, id);
}
async function focusWorld(page) { await page.locator('.school-room-world').focus(); }
async function hold(page, key, ms) {
  await focusWorld(page);
  await page.keyboard.down(key);
  try { await sleep(ms); } finally { await page.keyboard.up(key); }
}

// Read the production camera; do not move the player through controller hooks.
// A long walk is divided into visible pointer targets, each handled by the same
// collision/pathfinding code children use when they click the floor.
async function pointerPoint(page, point, clampToView = false) {
  return page.evaluate(({ point, clampToView }) => {
    const viewport = document.querySelector('.school-room-world');
    const world = document.querySelector('.sr-world');
    const vr = viewport.getBoundingClientRect(), wr = world.getBoundingClientRect();
    const scale = new DOMMatrix(getComputedStyle(world).transform).a || 1;
    let x = wr.left + point.x * scale, y = wr.top + point.y * scale;
    const inside = x > vr.left + 14 && x < vr.right - 14 && y > vr.top + 14 && y < vr.bottom - 14;
    if (clampToView) {
      x = Math.max(vr.left + 34, Math.min(vr.right - 34, x));
      y = Math.max(vr.top + 70, Math.min(vr.bottom - 100, y));
    }
    return { x, y, inside, clickedWorld: { x: (x - wr.left) / scale, y: (y - wr.top) / scale } };
  }, { point, clampToView });
}
async function walkTo(page, point, tolerance = 10) {
  const deadline = Date.now() + 30000;
  let last = await state(page), attempts = 0;
  while (Date.now() < deadline) {
    if (Math.hypot(last.x - point.x, last.y - point.y) <= tolerance && !last.moving) return last;
    const click = await pointerPoint(page, point, true);
    await page.mouse.click(click.x, click.y);
    attempts++;
    const legDeadline = Date.now() + 4500;
    do {
      await sleep(100);
      last = await state(page);
      assert(await page.evaluate(({ x, y, seatId }) => seatId || QPGame.getCampus().canStand(x, y), last),
        'Actual pointer movement must remain outside the collision footprints');
      if (Math.hypot(last.x - point.x, last.y - point.y) <= tolerance && !last.moving) return last;
      if (!last.moving && (!last.path || !last.path.length)) break;
    } while (Date.now() < legDeadline);
    if (attempts > 30) break;
  }
  throw new Error('Pointer walk could not reach ' + JSON.stringify(point) + ': ' + JSON.stringify(last));
}
async function openBoard(page) {
  const scene = await page.evaluate(() => QPSchoolRoomScene.get());
  const board = scene.interactables.find(item => item.type === 'board');
  assert(board, 'The real classroom needs a board interaction');
  await walkTo(page, board.approach || {x:board.x,y:board.y});
  await focusWorld(page);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#modal.school-room-board-modal.on');
  await page.waitForSelector('#campusBoardHub .class-hub');
}
async function readSession(id) { return host.evaluate(id => QPClassroom.read(QPDemo.db, id), id); }
async function waitPlayer(page, id, uid, predicate) {
  await page.waitForFunction(({ id, uid, predicate }) => {
    const tree = JSON.parse(localStorage.getItem(QPDemo.storageKey) || '{}');
    const player = tree.quiz?.classrooms?.[id]?.players?.[uid];
    return !!player && (0, eval)('(' + predicate + ')')(player);
  }, { id, uid, predicate: predicate.toString() });
}
async function publishFixtures() {
  await host.locator('[data-t="make"]').click();
  await host.locator('[data-class-mode="round"]').click();
  await host.locator('[data-class-new]').click();
  await host.locator('[data-field="title"]').fill('교실 칠판 연결 검수');
  for (const [question, answer] of [['물이 얼면 무엇이 될까요?', '얼음'], ['봄 다음 계절은?', '여름']]) {
    await host.locator('[data-add="short"]').first().click();
    await host.locator('textarea[data-field="q"]').fill(question);
    await host.locator('input[data-field="a"]').fill(answer);
  }
  await host.locator('[data-action="save"]').click();
  await host.waitForFunction(() => document.querySelector('[data-save-state]')?.textContent.includes('모든 변경'));
  const setId = await host.evaluate(async () => Object.entries((await QPDemo.db.ref('quiz/bank').once()).val())
    .find(([, set]) => set.title === '교실 칠판 연결 검수')?.[0]);
  assert(setId, 'The actual teacher editor must save a question set');
  await host.locator('[data-action="next"]').click();
  await host.locator('[name="title"]').fill('칠판 · 실시간 수업');
  await host.locator('[name="timer"]').selectOption('300');
  await host.locator('.qpc-form [type="submit"]').click();
  await host.waitForSelector('.qpc-dashboard');
  const liveId = await host.evaluate(async () => (await QPDemo.db.ref('quiz/classroomActive').once()).val());
  await host.locator('[data-t="quizzes"]').click();
  const row = host.locator('[data-quiz="' + setId + '"]');
  await row.locator('[data-quiz-mode]').selectOption('round');
  await row.locator('[data-launch="solo"]').click();
  await host.locator('[name="title"]').fill('칠판 · 혼자 풀기');
  await host.locator('[name="timer"]').selectOption('300');
  await host.locator('.qpc-form [type="submit"]').click();
  await host.waitForSelector('.qpc-dashboard');
  const soloId = await host.evaluate(async () => Object.entries((await QPDemo.db.ref('quiz/classrooms').once()).val())
    .find(([, room]) => room.title === '칠판 · 혼자 풀기')?.[0]);
  assert(liveId && soloId && liveId !== soloId);
  pass('A teacher authors, saves and publishes both activities through the production UI', { liveId, soloId });
  return { liveId, soloId };
}
async function showHost(id) {
  await host.locator('[data-t="classroom"]').click();
  await host.locator('[data-session="' + id + '"]').click();
  await host.waitForSelector('.qpc-dashboard');
}

async function run() {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  // The local adapter intentionally shares one storage partition. These are
  // separately logged-in pages, not a real Firebase or WAN concurrency test.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  context.setDefaultTimeout(15000);
  await context.route('**/www.gstatic.com/firebasejs/**', route => route.fulfill({
    contentType: 'text/javascript', body: '/* isolated school-room QA: never real Firebase */'
  }));
  const open = async (params, viewport) => {
    const page = await context.newPage();
    if (viewport) await page.setViewportSize(viewport);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
    const url = new URL(preview); for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    await page.goto(url.href);
    await page.waitForFunction(() => !!window.QPGame && !!window.QPDemo);
    await page.evaluate(() => document.fonts.ready);
    return page;
  };
  host = await open({ role: 'teacher' });
  await host.waitForSelector('.teacher-library');
  const fixtures = await publishFixtures();
  a = await open({ user: '교실검수하늘' });
  b = await open({ user: '교실검수민트' });
  await campus(a); await campus(b);
  if (await a.locator('.qp-demo-toolbar [data-hide]').isVisible()) await a.locator('.qp-demo-toolbar [data-hide]').click();
  if (await b.locator('.qp-demo-toolbar [data-hide]').isVisible()) await b.locator('.qp-demo-toolbar [data-hide]').click();
  const aid = await a.evaluate(() => QPGame.getMe().k), bid = await b.evaluate(() => QPGame.getMe().k);
  assert.notEqual(aid, bid);
  await a.waitForFunction(uid => !!document.querySelector('.sr-actor[data-uid="' + CSS.escape(uid) + '"]'), bid);
  await b.waitForFunction(uid => !!document.querySelector('.sr-actor[data-uid="' + CSS.escape(uid) + '"]'), aid);
  assert.equal(await a.locator('.sr-actor').count(), 2);
  await coverage(a);
  await screenshot(a, '01-기본입장-1366');
  const scene = await a.evaluate(() => QPSchoolRoomScene.get());
  assert.equal(scene.seats.length, 30);
  assert.equal(new Set(scene.seats.map(seat => seat.id)).size, 30);
  assert.equal(await a.locator('.sr-art[data-art$="-desk"]').count(), 31);
  assert.equal(await a.locator('.sr-art[data-art^="seat-"][data-art$="-chair"]').count(), 30);
  assert.equal(await a.evaluate(() => QPGame.getVillage()), null);
  pass('Student entry loads the new asset classroom with 30 different seats');

  phase = 'genuine keyboard and side artwork';
  await hold(a, 'ArrowLeft', 300);
  assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-view'), 'profile');
  assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-view-facing'), 'left');
  await screenshot(a, '02-왼쪽옆모습-1366');
  await hold(a, 'ArrowRight', 300);
  assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-view-facing'), 'right');
  await screenshot(a, '03-오른쪽옆모습-1366');
  pass('Real left and right keys use the illustrated one-eye profile and attached clothes');

  phase = 'real desktop and wall collisions';
  const firstDesk = scene.solids.find(item => item.id === scene.seats[0].id + '-desk');
  await walkTo(a, { x: firstDesk.x + firstDesk.width / 2, y: firstDesk.y - 16 });
  const beforeDesk = await state(a);
  await hold(a, 'ArrowDown', 650);
  const blockedDesk = await state(a);
  assert(blockedDesk.y > beforeDesk.y, 'The student must actually walk toward the desk');
  assert(blockedDesk.y <= firstDesk.y - 6.8, 'The desktop must stop the avatar feet');
  assert(await a.evaluate(({ x, y }) => QPGame.getCampus().canStand(x, y), blockedDesk));
  await walkTo(a, { x: 909, y: 450 });
  const beforeWall = await state(a);
  await hold(a, 'ArrowLeft', 650);
  const blockedWall = await state(a);
  assert(blockedWall.x < beforeWall.x);
  assert(blockedWall.x >= 895.8, 'The group/classroom dividing wall must stop feet');
  assert(await a.evaluate(({ x, y }) => QPGame.getCampus().canStand(x, y), blockedWall));
  pass('Actual keyboard movement stops at the desk and the room wall');

  phase = 'all 30 genuine seat approaches';
  for (const seat of scene.seats) {
    const reached = await walkTo(a, seat.approach);
    await focusWorld(a); await a.keyboard.press('KeyE');
    await a.waitForFunction(id => QPGame.getCampus().getState().seatId === id, seat.id);
    await a.waitForFunction(() => document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose === 'sit');
    const seated = await state(a);
    assert.equal(seated.pose, 'sit'); assert.equal(seated.moving, false);
    assert.equal(seated.direction, 'back', 'Every student chair must face the board');
    assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-pose'), 'sit');
    assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-view'), 'back');
    assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-back-eye-count'), '0');
    if (seatResults.length === 0) {
      await screenshot(a, '04-실제로앉기-1366');
      const geometry = await seatGeometry(a, seat.id);
      console.log('Seated reference geometry: ' + JSON.stringify(geometry));
      assert(geometry.painted > 20 && geometry.actorDepth > geometry.deskDepth,
        'The visible back-head and shoulder painting must sit in front of the desktop edge');
      assert(geometry.hipWorld.y >= geometry.chairSeatY[0] && geometry.hipWorld.y <= geometry.chairSeatY[1],
        'The actual posed hip must sit on the chair, not float north of the desk: ' + JSON.stringify(geometry));
      assert(geometry.belowDesktop > .8,
        'The reference places the seated back head toward the chair south of the desktop: ' + JSON.stringify(geometry));
      const actor = await a.locator('.sr-actor.is-me').boundingBox();
      await a.screenshot({ path: path.join(output, '04-책상과뒷모습-원래크기.png'),
        clip: { x: Math.max(0, actor.x - 64), y: Math.max(60, actor.y - 110), width: 128, height: 154 } });
      screenshots.push('04-책상과뒷모습-원래크기.png');
    }
    await a.keyboard.press('KeyE');
    await a.waitForFunction(() => !QPGame.getCampus().getState().seatId);
    const standing = await state(a);
    assert.equal(standing.pose, 'idle');
    seatResults.push({ id: seat.id, reached: { x: reached.x, y: reached.y },
      seated: { x: seated.x, y: seated.y }, exit: { x: standing.x, y: standing.y } });
  }
  pass('All 30 chairs have a genuine pointer route, actual sitting pose and legal stand-up exit', { seats: 30 });

  phase = 'shared chair ownership';
  const shared = scene.seats[0];
  await walkTo(a, shared.approach); await walkTo(b, shared.approach);
  await availableChair(a, shared.id); await availableChair(b, shared.id);
  await focusWorld(a); await focusWorld(b);
  await Promise.all([a.keyboard.press('KeyE'), b.keyboard.press('KeyE')]);
  await sleep(500);
  const race = [await state(a), await state(b)];
  assert.equal(race.filter(value => value.seatId === shared.id).length, 1);
  const winner = race[0].seatId ? a : b, loser = race[0].seatId ? b : a;
  await focusWorld(winner);
  await winner.keyboard.press('KeyE');
  await winner.waitForFunction(() => !QPGame.getCampus().getState().seatId);
  await availableChair(loser, shared.id);
  await focusWorld(loser); await loser.keyboard.press('KeyE');
  await loser.waitForFunction(id => QPGame.getCampus().getState().seatId === id, shared.id);
  await loser.keyboard.press('KeyE');
  pass('Two separately logged-in students cannot own one chair; releasing it admits the other');

  phase = 'floor sitting and planted feet';
  await walkTo(a, { x: 560, y: 570 });
  for (const [direction, key, via] of [['front', 'ArrowDown', 'G'], ['left', 'ArrowLeft', 'G'],
    ['right', 'ArrowRight', 'button'], ['back', 'ArrowUp', 'G']]) {
    await hold(a, key, 100);
    await a.waitForFunction(() => QPGame.getCampus().getState().pose === 'idle'
      && document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose === 'idle');
    const floorBefore = await state(a);
    const standingSoles = await soles(a);
    assert.equal(floorBefore.direction, direction);
    if (via === 'button') await a.locator('[data-tool="floor-sit"]').click();
    else { await focusWorld(a); await a.keyboard.press('KeyG'); }
    await a.waitForFunction(() => QPGame.getCampus().getState().pose === 'sit-floor');
    await a.waitForFunction(() => document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose === 'floor-sit');
    assert.equal((await state(a)).seatId, null, 'Sitting on the floor must not acquire a student chair');
    assert.equal(await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-pose'), 'floor-sit');
    const actualView = await a.locator('.sr-actor.is-me .sr-avatar>svg').getAttribute('data-qpx-view');
    assert.equal(actualView, ['left', 'right'].includes(direction) ? 'profile' : direction);
    const sittingSoles = await soles(a);
    for (const foot of sittingSoles) {
      assert(foot.pixels > 20 && foot.parallel, 'The whole ' + foot.side + ' shoe must remain parallel to the floor: ' + JSON.stringify(foot));
      assert(Math.abs(foot.bottom - standingSoles.find(item => item.side === foot.side).bottom) < 1.7,
        'The ' + foot.side + ' sole must remain on its real standing contact plane: ' + JSON.stringify({foot, standing:standingSoles}));
    }
    await screenshot(a, '05-바닥앉기-' + direction + '-1366');
    const actor = await a.locator('.sr-actor.is-me').boundingBox();
    await a.screenshot({ path: path.join(output, '05-바닥앉기-' + direction + '-원래크기.png'),
      clip: { x: Math.max(0, actor.x - 54), y: Math.max(60, actor.y - 100), width: 108, height: 130 } });
    screenshots.push('05-바닥앉기-' + direction + '-원래크기.png');
    if (via === 'button') await a.locator('[data-tool="floor-sit"]').click();
    else await a.keyboard.press('KeyE');
    await a.waitForFunction(() => QPGame.getCampus().getState().pose === 'idle');
    const floorAfter = await state(a);
    assert.equal(floorAfter.x, floorBefore.x); assert.equal(floorAfter.y, floorBefore.y);
  }
  const beforeFloorWalk = await state(a);
  await focusWorld(a); await a.keyboard.press('KeyG');
  await hold(a, 'ArrowRight', 150);
  await a.waitForFunction(() => QPGame.getCampus().getState().pose === 'idle'
    && document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose === 'idle');
  assert.equal((await state(a)).pose, 'idle', 'Walking must stand up from the floor first');
  assert((await state(a)).x > beforeFloorWalk.x + 3, 'Standing up must permit actual walking');
  assert.equal((await state(a)).seatId, null);
  pass('Front, left, right and back floor poses use actual G/button inputs; E, button and walking stand up naturally');

  phase = 'all rooms and camera follow';
  await walkTo(a, { x: 560, y: 570 });
  assert((await state(a)).x < 826, 'The student must enter the furnished group room');
  await screenshot(a, '05-모둠공간-1366');
  await walkTo(a, { x: 2110, y: 340 });
  assert((await state(a)).x > 1977, 'The student must enter the corridor by a legal route');
  await screenshot(a, '06-복도-1366');
  const corridorCamera = (await state(a)).camera.x;
  assert(corridorCamera > 900, 'The wide room camera must follow the actual walking student');
  await walkTo(a, { x: 2680, y: 360 });
  await screenshot(a, '07-복도끝-1366');
  pass('Real click routes connect the group room, classroom and whole corridor with camera follow');

  phase = 'board proximity and modal pause';
  await focusWorld(a); await a.keyboard.press('KeyE');
  assert.equal(await a.locator('#modal.school-room-board-modal.on').count(), 0);
  await openBoard(a);
  assert.equal(await a.locator('#campusBoardHub [data-session="' + fixtures.liveId + '"]').count(), 1);
  assert.equal(await a.locator('#campusBoardHub [data-session="' + fixtures.soloId + '"]').count(), 1);
  const paused = await state(a);
  await a.keyboard.press('ArrowLeft'); await a.keyboard.press('KeyE');
  assert.equal((await state(a)).x, paused.x); assert.equal((await state(a)).y, paused.y);
  await screenshot(a, '05-칠판-수업과퀴즈-1366');
  await a.locator('#campusBoardClose').click();
  await focusWorld(a); await hold(a, 'ArrowRight', 200);
  assert((await state(a)).x > paused.x, 'Closing the board must restore real input');
  pass('Only proximity opens the board; published lessons show and modal controls pause walking');

  phase = 'live quiz and checkpoint return';
  await openBoard(a); const checkpoint = await state(a);
  // Keep readonly references to the real retired controllers to observe
  // teardown. They are never patched or called to move a student.
  await a.evaluate(() => {
    window.__schoolRoomRetired = { world: QPGame.getCampus(), presence: QPGame.getCampusPresence() };
  });
  await a.locator('#campusBoardHub [data-session="' + fixtures.liveId + '"]').click();
  await a.waitForSelector('.class-lobby');
  assert.equal(await a.evaluate(() => QPGame.getCampus()), null);
  assert.equal(await a.evaluate(() => QPGame.getCampusPresence()), null);
  await b.waitForFunction(uid => !document.querySelector('.sr-actor[data-uid="' + CSS.escape(uid) + '"]'), aid);
  assert.equal(await b.locator('.sr-actor').count(), 1);
  const retiredBefore = await a.evaluate(() => __schoolRoomRetired.world.getState());
  await a.keyboard.press('ArrowRight'); await sleep(200);
  const retiredAfter = await a.evaluate(() => __schoolRoomRetired.world.getState());
  assert.equal(retiredAfter.x, retiredBefore.x); assert.equal(retiredAfter.y, retiredBefore.y);
  assert.equal(retiredAfter.paused, true);
  assert.equal(await a.evaluate(() => __schoolRoomRetired.presence.getState().destroyed), true);
  const disconnected = await a.evaluate(async () => {
    const old = __schoolRoomRetired.presence.getState();
    return !(await QPDemo.db.ref(old.path + '/' + old.connectionId).once()).exists();
  });
  assert(disconnected, 'The old connection must be removed when leaving the classroom');
  pass('Leaving the classroom destroys input and subscriptions and removes only that student connection');
  await showHost(fixtures.liveId); await host.locator('[data-action="start"]').click();
  await a.waitForSelector('[data-round-answer] .qpq-short-input');
  await a.locator('[data-round-answer] .qpq-short-input').fill('얼음');
  await a.locator('[data-round-answer] .qpq-short-input').press('Enter');
  await waitPlayer(a, fixtures.liveId, aid, player => player.answers?.[0]?.pending === true);
  await host.locator('[data-action="reveal"]').click();
  await waitPlayer(a, fixtures.liveId, aid, player => player.score === 100);
  await screenshot(a, '06-칠판에서실시간수업-1366');
  await a.locator('#tbBack').click(); await campus(a);
  const restored = await state(a);
  assert(Math.hypot(restored.x - checkpoint.x, restored.y - checkpoint.y) < 20);
  await openBoard(a); await a.locator('#campusBoardHub [data-session="' + fixtures.liveId + '"]').click();
  await a.waitForSelector('.class-student');
  assert.equal((await readSession(fixtures.liveId)).players[aid].score, 100);
  await a.locator('#tbBack').click(); await campus(a);
  pass('The board enters a teacher live quiz, grades a real answer and returns to the saved classroom position');

  phase = 'solo quiz progress and cleanup';
  await openBoard(a); await a.locator('#campusBoardHub [data-session="' + fixtures.soloId + '"]').click();
  await a.waitForSelector('[data-round-answer] .qpq-short-input');
  await a.locator('[data-round-answer] .qpq-short-input').fill('얼음');
  await a.locator('[data-round-answer] .qpq-short-input').press('Enter');
  await waitPlayer(a, fixtures.soloId, aid, player => player.score === 100);
  await a.locator('#tbBack').click(); await campus(a);
  await openBoard(a); await a.locator('#campusBoardHub [data-session="' + fixtures.soloId + '"]').click();
  await a.waitForSelector('.class-student');
  assert.equal((await readSession(fixtures.soloId)).players[aid].score, 100);
  assert.equal((await readSession(fixtures.liveId)).players[aid].score, 100);
  await a.locator('#tbBack').click(); await campus(a);
  pass('Solo activity keeps its answer and score separately when returning through the classroom');

  phase = 'direct lesson link and old route redirects';
  const direct = await open({ user: '교실검수직접참가', classroom: fixtures.liveId });
  await direct.waitForSelector('.class-student');
  assert.equal(await direct.evaluate(() => QPGame.getCampus()), null,
    'A specific teacher lesson link must retain its direct entry');
  await direct.locator('#tbBack').click(); await campus(direct);
  await direct.locator('[data-tool="exit"]').click();
  await direct.waitForSelector('.class-hub');
  await direct.locator('#tbBack').click(); await campus(direct);
  for (const retired of ['village', 'tailor']) {
    await direct.evaluate(retired => QPGame.go(retired), retired); await campus(direct);
    assert.equal(await direct.locator('[data-village-zone],.village-world,.village-shop').count(), 0);
  }
  // Explicit navigation exercises production disconnect. The demo adapter's
  // onDisconnect hook is a no-op, so closing an active page is not a server
  // disconnect simulation and would leave a fixture until the presence TTL.
  await direct.locator('#tbProfile').click();
  await direct.waitForFunction(() => !QPGame.getCampus() && !QPGame.getCampusPresence());
  await b.waitForFunction(() => document.querySelectorAll('.sr-actor').length === 2);
  await direct.close();
  pass('Specific teacher links still enter quizzes directly; old map names redirect to the new classroom');

  phase = 'desktop wider render and entry persistence';
  const wide = await open({ user: '교실검수큰화면' }, { width: 1920, height: 1080 });
  await campus(wide);
  if (await wide.locator('.qp-demo-toolbar [data-hide]').isVisible()) await wide.locator('.qp-demo-toolbar [data-hide]').click();
  const wideCoverage = await coverage(wide);
  await wide.setViewportSize({ width:1366, height:768 }); await rendered(wide);
  await coverage(wide);
  assert(Math.abs((await state(wide)).camera.scale - (wideCoverage.camera.preferredScale || .84)) < .001,
    'A temporary larger screen must not permanently enlarge the original desktop view');
  await wide.setViewportSize({ width:1920, height:1080 }); await rendered(wide);
  await coverage(wide);
  assert(await wide.locator('[data-tool="zoom-out"]').isDisabled(),
    'Zooming out must stop before exposing an empty part outside the original map');
  pass('Original room assets cover both desktop viewports and resizing restores the preferred camera scale');
  await screenshot(wide, '10-기본입장-1920');
  assert(await wide.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert(await wide.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  await walkTo(wide, scene.seats[14].approach);
  await focusWorld(wide); await wide.keyboard.press('KeyE');
  await wide.waitForFunction(id => QPGame.getCampus().getState().seatId === id, scene.seats[14].id);
  await screenshot(wide, '11-실제로앉기-1920');
  await wide.keyboard.press('KeyE');
  await openBoard(wide); await screenshot(wide, '12-칠판-1920');
  await wide.locator('#campusBoardClose').click();
  await wide.locator('#tbProfile').click();
  await wide.waitForFunction(() => !QPGame.getCampus() && !QPGame.getCampusPresence());
  await wide.close();
  await a.reload(); await campus(a); await rendered(a);
  assert.equal((await readSession(fixtures.soloId)).players[aid].score, 100);
  pass('Desktop 1366 and 1920 renders fit; reload preserves saved quiz progress');
  assert.deepEqual(errors, [], 'No page error in classroom/quiz/return');
  assert.deepEqual(missing, [], 'No missing runtime source request');
}

(async () => {
  let failed = null;
  try { await run(); }
  catch (error) {
    failed = { phase, message: error.message, stack: error.stack };
    if (a && !a.isClosed()) await screenshot(a, 'FAIL-' + phase.replace(/[^a-z0-9]+/gi, '-')).catch(() => {});
    console.error('FAIL in ' + phase + ': ' + error.stack);
    process.exitCode = 1;
  } finally {
    const observations = {};
    if (failed) for (const [name, page] of [['firstStudent', a], ['secondStudent', b]]) {
      if (page && !page.isClosed()) observations[name] = await page.evaluate(() => ({
        world: QPGame.getCampus()?.getState(), presence: QPGame.getCampusPresence()?.getState(),
        active: document.activeElement?.className, interaction: document.querySelector('.sr-interact')?.textContent
      })).catch(() => null);
    }
    const report = { startedAt, completedAt: new Date().toISOString(), checks, seatResults, screenshots,
      errors, missing, failed, ...(failed ? { observations } : {}),
      scope: 'Two separately logged-in demo pages in one fresh local adapter context. Actual pointer/keyboard walks; no teleports. Real Firebase rules/network not verified.', preview: preview.href };
    fs.writeFileSync(path.join(output, '검증결과.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ checks: checks.length, seats: seatResults.length, failed, output }, null, 2));
    await browser?.close();
  }
})();
