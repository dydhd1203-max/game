'use strict';

// Real SVG greeting poses in an isolated room. A mocked server clock differs
// from the device clock; input and incoming presence still use production code.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = new URL(process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/');
base.searchParams.set('demo', '1');
base.searchParams.set('session', 'school-room-clock-' + Date.now() + '-' + process.pid);
const out = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || path.join(__dirname, '../검증/교실-시계-2026-10-02'));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || process.env.QUIZ_BROWSER_EXECUTABLE
  || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const errors = [], checks = [];
  try {
    await context.route('**/www.gstatic.com/firebasejs/**', route => route.fulfill({ body: '/* isolated clock QA */', contentType: 'text/javascript' }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base.href);
    await page.waitForFunction(() => QPGame.getCampus() && QPAvatar.atlas.ready
      && QPClothes.atlas.ready && QPShoes.atlas.partsReady && QPAvatarDirection.atlas.ready);
    await page.evaluate(() => QPGame.go('school'));
    await page.waitForFunction(() => !QPGame.getCampus());

    for (const offset of [60000, -60000]) {
      await page.evaluate(offset => {
        const user = QPGame.getMe();
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:60px 0 0;height:auto;z-index:5000';
        document.body.append(host);
        const published = [];
        const presence = {
          getTime: () => Date.now() + offset,
          update(patch) { published.push({ patch: structuredClone(patch), clientTime: Date.now() }); }
        };
        const world = QPSchoolRoomWorld.mount(host, {
          scene: QPSchoolRoomScene,
          user: { uid: 'clock-local', name: '시계 검사', avatar: user.av },
          renderAvatar: (avatar, height, lod) => QPAvatar.render(avatar, height, lod),
          presence
        });
        window.__schoolClockCheck = { host, world, presence, published, avatar: user.av };
        world.focus();
      }, offset);

      // A real greeting button publishes the shared-clock timestamp, rather than the
      // device wall time. Local animation retains its monotonic pose clock.
      await page.locator('.school-room-world').focus();
      await page.keyboard.press('KeyF');
      assert.equal(await page.evaluate(() => __schoolClockCheck.published.some(record => record.patch.gesture)), false, 'F away from a door must not publish a greeting');
      await page.keyboard.press('Digit1');
      await page.waitForFunction(() => document.querySelector('.sr-actor.is-me svg')?.dataset.qpxGesture === 'wave', null, { timeout: 3000 });
      const sent = await page.evaluate(() => __schoolClockCheck.published.find(record => record.patch.gesture?.type === 'wave'));
      assert(sent, 'The greeting button must publish an actual wave');
      assert(Math.abs(sent.patch.gesture.at - sent.clientTime - offset) <= 30, 'Published wave must use the server-adjusted clock');

      // The same received record is valid with either clock offset. Raw device
      // Date.now would place it 60 seconds before/after its animation window.
      await page.evaluate(() => {
        const h = __schoolClockCheck;
        h.world.setPlayers([{ uid: 'clock-remote', name: '시계 친구', avatar: h.avatar,
          x: 1520, y: 810, zone: 'campus', pose: 'idle', moving: false,
          direction: 'front', gesture: { type: 'wave', at: h.presence.getTime() - 400, duration: 1500 } }]);
      });
      await page.waitForFunction(() => document.querySelector('.sr-actor[data-uid="clock-remote"] svg')?.dataset.qpxGesture === 'wave', null, { timeout: 3000 });
      const pose = await page.evaluate(() => {
        const actor = document.querySelector('.sr-actor[data-uid="clock-remote"]');
        const svg = actor.querySelector('svg'), arm = svg.querySelector('[data-qpx-pose-part="right-gesture-arm"]');
        return { gesture: svg.dataset.qpxGesture, bubbleVisible: !actor.querySelector('.sr-bubble').hidden,
          armTransform: arm?.getAttribute('transform'), pose: svg.dataset.qpxPose };
      });
      assert.equal(pose.gesture, 'wave');
      assert.equal(pose.bubbleVisible, true);
      assert.equal(pose.pose, 'idle');
      assert.match(pose.armTransform, /rotate\(/, 'The original painted arm must enter the real wave pose');
      await page.screenshot({ path: path.join(out, '서버시계-' + (offset > 0 ? '앞섬' : '뒤처짐') + '-60초.png') });
      await page.waitForFunction(() => !document.querySelector('.sr-actor[data-uid="clock-remote"] svg')?.dataset.qpxGesture, null, { timeout: 3000 });
      const result = { offset, publishedAt: sent.patch.gesture.at, clientAt: sent.clientTime, pose, expiredNaturally: true };
      checks.push(result);
      console.log('PASS: ' + (offset > 0 ? '+' : '') + offset / 1000 + 's device/server offset preserves local publication and visible remote greeting');
      await page.evaluate(() => { __schoolClockCheck.world.destroy(); __schoolClockCheck.host.remove(); delete window.__schoolClockCheck; });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, '결과.json'), JSON.stringify({ preview: base.pathname, checks, errors }, null, 2) + '\n');
    console.log('PASS: zero browser exceptions; isolated room cleanup complete');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
