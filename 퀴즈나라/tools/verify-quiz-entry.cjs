'use strict';

// Teacher publishing and student entry use the production UI in an isolated
// demo store whose cache expires like Firebase's unobserved value views.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = process.env.QUIZ_VERIFICATION_OUTPUT
  ? path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT) : path.resolve(__dirname, '../검증');
const session = 'entry-' + Date.now() + '-' + process.pid;
const preview = new URL(process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/');
preview.searchParams.set('demo', '1');
preview.searchParams.set('cache', 'cold');
preview.searchParams.set('session', session);
const base = preview.href;
const checks = [], errors = [];
let browser, host, a, b, phase = 'startup';
fs.mkdirSync(out, { recursive: true });
function pass(value) { checks.push(value); console.log('PASS: ' + value); }
async function screenshot(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
}
async function read(page, id) { return page.evaluate(id => QPClassroom.read(QPDemo.db, id), id); }
async function waitPlayer(page, id, uid, predicate) {
  await page.waitForFunction(({ id, uid, predicate }) => {
    const tree = JSON.parse(localStorage.getItem(QPDemo.storageKey) || '{}');
    const player = tree.quiz?.classrooms?.[id]?.players?.[uid];
    return !!player && (0, eval)('(' + predicate + ')')(player);
  }, { id, uid, predicate: predicate.toString() });
}
async function enter(page, id) {
  await page.evaluate(() => QPGame.go('school'));
  await page.locator('[data-session="' + id + '"]').click();
  await page.waitForFunction(id => QPGame.getClassroom()?.id === id, id);
}
async function answerFirst(page, answer) {
  await page.waitForSelector('.qp-map-viewport');
  const moved = await page.evaluate(() => {
    const map = QPGame.getMap(), target = map.getState().objects[0];
    for (const radius of [45, 60, 80]) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      if (map.moveTo({ x: target.x + Math.cos(angle) * radius,
        y: target.y + Math.sin(angle) * radius }) && map.getState().nearbyIndex === 0) return true;
    }
    return false;
  });
  assert(moved, 'The first question must have a legal interaction position');
  await page.locator('.qp-map-viewport').focus();
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#classAnswerWidget');
  assert.match(await page.locator('.class-question-text').innerText(), /물이 얼면/);
  await screenshot(page, '퀴즈입장-학생-실제문제');
  await page.locator('#classAnswerWidget .qpq-short-input').fill(answer);
  await page.locator('#classAnswerWidget .qpq-short-input').press('Enter');
  await page.waitForSelector('#modal.on', { state: 'hidden' });
}
async function launchSaved(mode, delivery, title, setId) {
  await host.locator('[data-t="quizzes"]').click();
  const row = host.locator('[data-quiz="' + setId + '"]');
  await row.locator('[data-quiz-mode]').selectOption(mode);
  await row.locator('[data-launch="' + delivery + '"]').click();
  assert.equal(await host.locator('[name="delivery"]:checked').inputValue(), delivery);
  await host.locator('[name="title"]').fill(title);
  if (await host.locator('[name="durationMinutes"]').isVisible()) await host.locator('[name="durationMinutes"]').fill('0');
  await host.locator('.qpc-form [type="submit"]').click();
  await host.waitForSelector('.qpc-dashboard');
  return host.evaluate(async title => {
    const rooms = (await QPDemo.db.ref('quiz/classrooms').once()).val() || {};
    return Object.entries(rooms).find(([, room]) => room.title === title)?.[0];
  }, title);
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    context.setDefaultTimeout(15000);
    await context.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
      contentType: 'text/javascript', body: '/* isolated entry regression: no real Firebase */'
    }));
    const open = async suffix => {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + suffix);
      await page.waitForFunction(() => window.QPGame && window.QPDemo && QPAvatar?.atlas.ready && QPClothes?.atlas.ready);
      return page;
    };
    host = await open('&role=teacher');
    await host.waitForSelector('.teacher-library');
    assert.deepEqual(await host.locator('.teacher-top .tabs [data-t]').evaluateAll(nodes => nodes.map(n => n.dataset.t)), ['quizzes', 'classroom', 'kids']);
    assert.equal(await host.locator('[data-t="live"],[data-t="legacy"],[data-t="fash"]').count(), 0);
    await screenshot(host, '퀴즈입장-교사-내퀴즈');
    await host.locator('[data-t="make"]').click();
    assert.equal(await host.locator('[data-class-mode]').count(), 5);
    assert.equal(await host.locator('.class-bank-list').count(), 0);
    await host.locator('[data-class-mode="sequence"]').click();
    await host.locator('[data-class-new]').click();
    phase = 'author and publish';
    await host.locator('[data-field="title"]').fill('입장 회귀용 저장 퀴즈');
    for (const [question, answer] of [['물이 얼면 무엇이 될까요?', '얼음'], ['봄 다음 계절은?', '여름']]) {
      await host.locator('[data-add="short"]').first().click();
      await host.locator('textarea[data-field="q"]').fill(question);
      await host.locator('input[data-field="a"]').fill(answer);
    }
    await host.locator('[data-action="save"]').click();
    await host.waitForFunction(() => document.querySelector('[data-save-state]')?.textContent.includes('모든 변경'));
    const setId = await host.evaluate(async () => Object.entries((await QPDemo.db.ref('quiz/bank').once()).val())
      .find(([, set]) => set.title === '입장 회귀용 저장 퀴즈')?.[0]);
    assert(setId);
    await host.locator('[data-action="next"]').click();
    await host.locator('[name="title"]').fill('실시간 순서 퀴즈');
    await host.locator('[name="durationMinutes"]').fill('0');
    await host.locator('.qpc-form [type="submit"]').click();
    await host.waitForSelector('.qpc-dashboard');
    const liveId = await host.evaluate(async () => (await QPDemo.db.ref('quiz/classroomActive').once()).val());
    assert.equal((await read(host, liveId)).status, 'lobby');
    pass('Teacher writes, saves and publishes a new quiz through the UI; old tabs are removed');

    a = await open('&user=' + encodeURIComponent('입장검수하늘'));
    b = await open('&user=' + encodeURIComponent('입장검수민트'));
    await a.waitForSelector('#meStage'); await b.waitForSelector('#meStage');
    const aid = await a.evaluate(() => QPGame.getMe().k), bid = await b.evaluate(() => QPGame.getMe().k);
    phase = 'cold-cache reproduction';
    await a.evaluate(() => QPGame.go('motion'));
    const before = await a.evaluate(async id => {
      const target = QPDemo.db.ref('quiz/classrooms/' + id);
      const once = await target.once('value');
      let input;
      const transaction = await target.transaction(value => { input = value; return undefined; });
      return { exists: once.exists(), input, committed: transaction.committed, coldStarts: QPDemo.cache.coldStarts };
    }, liveId);
    assert.equal(before.exists, true); assert.equal(before.input, null); assert.equal(before.committed, false);
    assert(before.coldStarts >= 1);
    pass('An existing classroom read with once() still yields null to an unobserved transaction');

    phase = 'student live list entry and answer';
    await enter(a, liveId); await enter(b, liveId);
    await screenshot(a, '퀴즈입장-학생-대기실');
    await host.locator('[data-action="start"]').click();
    await answerFirst(a, '얼음');
    await waitPlayer(a, liveId, aid, player => player.completed?.[0] && player.score === 100);
    const room = await read(host, liveId);
    assert.equal(room.players[bid].progress, 0);
    await screenshot(a, '퀴즈입장-학생-정답후진도');
    pass('Two students click the live list, enter the real question UI and keep independent progress');
    await a.reload(); await a.waitForSelector('#meStage');
    await enter(a, liveId);
    await waitPlayer(a, liveId, aid, player => player.completed?.[0] && player.score === 100);
    pass('Reloading and rejoining a live quiz preserves the student answer and score');

    phase = 'saved quiz reuse and solo entry';
    const soloId = await launchSaved('free', 'solo', '혼자 자유 퀴즈', setId);
    assert(soloId && soloId !== liveId);
    assert.deepEqual((await read(host, soloId)).questions, (await read(host, liveId)).questions);
    await enter(a, soloId); await enter(b, soloId);
    await answerFirst(a, '얼음');
    await waitPlayer(a, soloId, aid, player => player.completed?.[0] && player.score === 100);
    assert.equal((await read(host, soloId)).players[bid].progress, 0);
    await a.reload(); await a.waitForSelector('#meStage');
    await enter(a, soloId);
    await waitPlayer(a, soloId, aid, player => player.completed?.[0] && player.score === 100);
    pass('The saved question set opens in another mode as solo work; two users and reload keep separate progress');
    const otherId = await launchSaved('round', 'live', '새 실시간 라운드 퀴즈', setId);
    assert(otherId && ![liveId, soloId].includes(otherId));
    await enter(a, liveId); await enter(a, soloId); await enter(a, otherId);
    assert.equal((await read(host, liveId)).players[aid].score, 100);
    assert.equal((await read(host, soloId)).players[aid].score, 100);
    await host.locator('[data-action="start"]').click();
    await a.waitForSelector('[data-round-answer] .qpq-short-input');
    await a.locator('[data-round-answer] .qpq-short-input').fill('얼음');
    await a.locator('[data-round-answer] .qpq-short-input').press('Enter');
    await waitPlayer(a, otherId, aid, player => player.answers?.[0]?.pending === true);
    await host.locator('[data-action="reveal"]').click();
    await waitPlayer(a, otherId, aid, player => player.score === 100);
    pass('Different session IDs remain separate; a reused set also enters and grades a live round');

    phase = 'ended and invalid session recovery';
    await host.locator('[data-action="end"]').click();
    await host.locator('[data-action="back"]').click();
    assert.equal(await host.locator('[data-session="' + otherId + '"]').count(), 0);
    await host.locator('[data-ended-toggle]').click();
    assert.equal(await host.locator('[data-ended-list] [data-session="' + otherId + '"]').count(), 1);
    await screenshot(host, '퀴즈입장-교사-수업관리');
    pass('Class management shows active sessions first and keeps ended results behind a toggle');
    await host.evaluate(async () => {
      await QPDemo.db.ref('quiz/classrooms/broken_fixture').set({ players: { unused: { online: false } } });
    });
    await a.evaluate(() => QPGame.go('school'));
    assert.equal(await a.locator('[data-session="broken_fixture"]').count(), 0);
    await a.goto(base + '&user=' + encodeURIComponent('입장검수하늘') + '&classroom=missing_fixture');
    await a.waitForSelector('[data-exit]');
    assert.equal(new URL(a.url()).searchParams.get('classroom'), null);
    await screenshot(a, '퀴즈입장-학생-만료링크안내');
    await a.locator('[data-exit]').click();
    await a.waitForSelector('.class-hub');
    assert.equal(await a.evaluate(async () => (await QPDemo.db.ref('quiz/classrooms/missing_fixture').once()).exists()), false);
    await a.reload(); await a.waitForSelector('#meStage');
    assert.equal(await a.locator('[data-exit]').count(), 0);
    pass('Invalid rows are hidden; a stale link recovers to the list without creating phantom rooms or repeating after reload');
    assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
    fs.writeFileSync(path.join(out, '퀴즈입장-검증.json'), JSON.stringify({ session, preview: preview.href, cache: 'cold', checks, errors }, null, 2));
    console.log('Quiz entry regression: ' + checks.length + ' checks passed; screenshots in ' + out);
  } catch (error) {
    console.error('Quiz entry regression failed in ' + phase + ': ' + error.stack);
    if (a) await screenshot(a, '퀴즈입장-실패-학생').catch(() => {});
    if (host) await screenshot(host, '퀴즈입장-실패-교사').catch(() => {});
    process.exitCode = 1;
  } finally { await browser?.close(); }
})();
