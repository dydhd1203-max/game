'use strict';

// Integrated browser regression. Every page uses one fresh, isolated demo store.
// Run with the preview server: node tools/verify-classroom.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve(__dirname, '../검증');
const session = 'classroom-' + Date.now() + '-' + process.pid;
const base = 'http://127.0.0.1:4173/?demo=1&session=' + session;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || process.env.QUIZ_BROWSER_EXECUTABLE
  || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const checks = [], screenshots = [], errors = [];
let browser, host, a, b, latestId, phase = 'startup';
fs.mkdirSync(out, { recursive: true });

async function screenshot(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  screenshots.push(name + '.png');
}
function record(name) { checks.push(name); console.log('PASS: ' + name); }

async function captureMap(page) {
  await page.evaluate(() => {
    if (window.__qaMapWrapped) return;
    const original = window.QPQuizMap;
    // Expose only the returned controller; all movement/interaction still uses production code.
    window.QPQuizMap = Object.freeze({ ...original, mount(...args) {
      const controller = original.mount(...args);
      window.__qaMap = controller;
      return controller;
    } });
    window.__qaMapWrapped = true;
  });
}
async function enter(page, id) {
  await captureMap(page);
  await page.evaluate(() => { window.closeModal(); QPGame.go('school'); });
  await page.locator('[data-session="' + id + '"]').click();
  await page.waitForFunction(id => QPGame.getClassroom()?.id === id, id);
}
async function showHost(id) {
  await host.evaluate(() => QPGame.go('teacher'));
  await host.locator('[data-t="classroom"]').click();
  await host.locator('[data-session="' + id + '"]').click();
  await host.waitForSelector('.qpc-dashboard');
}
async function read(id) {
  return host.evaluate(id => QPClassroom.read(QPDemo.db, id), id);
}
async function waitSession(id, predicate, arg) {
  await host.waitForFunction(({ id, predicate, arg }) => {
    // waitForFunction polls synchronously: returning a Promise can end the wait early.
    const raw = JSON.parse(localStorage.getItem(QPDemo.storageKey) || '{}')?.quiz?.classrooms?.[id];
    if (!raw) return false;
    const value = QPClassroom.decorate(raw);
    return (0, eval)('(' + predicate + ')')(value, arg);
  }, { id, predicate: predicate.toString(), arg });
}
async function create(mode, questions, settings = {}) {
  latestId = await host.evaluate(({ mode, questions, settings }) => QPClassroom.create(QPDemo.db, {
    mode, set: { title: '검증 ' + mode, qs: questions }, teacherId: '__teacher',
    settings: { title: '검증 ' + mode, count: questions.length, delivery: 'live', timer: 30,
      duration: 120, points: 100, ...settings }
  }), { mode, questions, settings });
  return latestId;
}
async function start(id) {
  await showHost(id);
  await host.locator('.qpc-dashboard [data-action="start"]').click();
  await waitSession(id, value => value.status === 'playing');
}
async function mapState(page) { return page.evaluate(() => window.__qaMap.getState()); }
async function approach(page, index) {
  await page.waitForSelector('.qp-map-viewport');
  const moved = await page.evaluate(index => {
    const map = window.__qaMap, target = map.getState().objects[index];
    // Find a legal nearby point through the real collision API, never bypass canStand.
    for (const radius of [45, 60, 80]) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      if (map.moveTo({ x: target.x + Math.cos(angle) * radius,
        y: target.y + Math.sin(angle) * radius }) && map.getState().nearbyIndex === index) return true;
    }
    return false;
  }, index);
  assert(moved, 'Question ' + index + ' needs an accessible nearby location');
  await page.locator('.qp-map-viewport').focus();
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#classAnswerWidget');
  assert(await page.locator('.class-question-text').innerText(), 'Actual question text must appear in modal');
}
async function choose(page, answer) {
  await page.locator('.qpq-choice').filter({ has: page.locator('.qpq-choice-text', { hasText: new RegExp('^' + answer + '$') }) }).click();
}
async function typeAnswer(page, answer) {
  await page.locator('.qpq-short-input').fill(answer);
  await page.locator('.qpq-short-input').press('Enter');
}
async function closeQuestion(page) { await page.waitForSelector('#modal.on', { state: 'hidden' }); }
async function moveOrder(page, originalIndex, position) {
  for (let tries = 0; tries < 8; tries++) {
    const indices = await page.locator('.qpq-order-item').evaluateAll(rows => rows.map(row => Number(row.dataset.index)));
    const current = indices.indexOf(originalIndex);
    if (current === position) return;
    await page.locator('.qpq-order-item[data-index="' + originalIndex + '"] ' + (current > position ? '.qpq-move-up' : '.qpq-move-down')).click();
  }
  throw new Error('Order widget failed to move item ' + originalIndex);
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    context.setDefaultTimeout(12000);
    await context.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
      body: '/* isolated classroom regression: Firebase SDK never loaded */', contentType: 'text/javascript'
    }));
    const open = async suffix => {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + suffix);
      await page.waitForFunction(() => window.QPGame && window.QPDemo && QPAvatar?.atlas.ready && QPClothes?.atlas.ready);
      await page.evaluate(() => document.fonts.ready);
      return page;
    };
    host = await open('&role=teacher');
    await host.waitForSelector('#tBody');
    await host.locator('[data-t="make"]').click();

    phase = 'teacher authoring';
    const modes = ['sequence', 'free', 'round', 'team', 'coop'];
    assert.equal(await host.locator('[data-class-mode]').count(), 5);
    for (const mode of modes) {
      await host.locator('[data-class-mode="' + mode + '"]').click();
      assert.equal(await host.locator('[data-class-mode="' + mode + '"]').getAttribute('aria-pressed'), 'true');
    }
    await host.locator('[data-class-mode="sequence"]').click();
    await screenshot(host, '일반퀴즈-교사-방식선택');
    await host.setViewportSize({ width: 390, height: 844 });
    assert(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile mode chooser overflows');
    await screenshot(host, '일반퀴즈-교사-390');
    await host.setViewportSize({ width: 1366, height: 768 });
    await host.locator('[data-class-new]').click();
    await host.locator('[data-field="title"]').fill('실제 작성 · 네 문항 검증');
    await host.locator('[data-add="choice"]').first().click();
    await host.locator('textarea[data-field="q"]').fill('물이 얼면 무엇이 될까요?');
    await host.locator('input[data-field="a"]').fill('얼음');
    for (const [index, value] of ['수증기', '바람', '모래'].entries()) {
      await host.locator('input[data-field="choice"][data-row="' + index + '"]').fill(value);
    }
    await choose(host, '수증기');
    await host.waitForFunction(() => document.querySelector('[data-preview-feedback]')?.classList.contains('is-wrong'));
    await choose(host, '얼음');
    await host.waitForFunction(() => document.querySelector('[data-preview-feedback]')?.classList.contains('is-correct'));
    await host.locator('[data-add="short"]').click();
    await host.locator('textarea[data-field="q"]').fill('7 × 8은 얼마인가요?');
    await host.locator('input[data-field="a"]').fill('56/오십육');
    await host.locator('input[data-field="aliases"]').fill('오십 여섯');
    await host.locator('[data-add="match"]').click();
    await host.locator('textarea[data-field="q"]').fill('동물과 울음소리를 선으로 연결하세요.');
    for (const [index, pair] of [['강아지', '멍멍'], ['고양이', '야옹']].entries()) {
      await host.locator('input[data-field="left"][data-row="' + index + '"]').fill(pair[0]);
      await host.locator('input[data-field="right"][data-row="' + index + '"]').fill(pair[1]);
    }
    await host.locator('[data-add="order"]').click();
    await host.locator('textarea[data-field="q"]').fill('하루의 식사 시간을 올바르게 놓으세요.');
    for (const [index, value] of ['아침', '점심', '저녁'].entries()) {
      await host.locator('input[data-field="item"][data-row="' + index + '"]').fill(value);
    }
    await screenshot(host, '일반퀴즈-교사-문제편집');
    await host.setViewportSize({ width: 390, height: 844 });
    assert(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile question editor overflows');
    await screenshot(host, '일반퀴즈-편집-390');
    await host.setViewportSize({ width: 1366, height: 768 });
    await host.locator('[data-action="save"]').click();
    await host.waitForFunction(() => document.querySelector('[data-save-state]')?.textContent.includes('모든 변경'));
    const authored = await host.evaluate(async () => {
      const bank = (await QPDemo.db.ref('quiz/bank').once()).val();
      const entry = Object.entries(bank).find(([, set]) => set.title === '실제 작성 · 네 문항 검증');
      return { id: entry?.[0], ...entry?.[1] };
    });
    assert(authored.id);
    assert.deepEqual(authored.qs.map(q => q.type), ['choice', 'short', 'match', 'order']);
    await host.locator('[data-action="next"]').click();
    await host.waitForSelector('.qpc-form');
    await host.locator('[name="title"]').fill('순서풀이 실제 수업');
    await host.locator('[name="durationMinutes"]').fill('5');
    await screenshot(host, '일반퀴즈-교사-수업설정');
    await host.locator('.qpc-form [type="submit"]').click();
    await host.waitForSelector('.qpc-dashboard');
    const sequenceId = await host.evaluate(async () => (await QPDemo.db.ref('quiz/classroomActive').once()).val());
    latestId = sequenceId;
    assert.equal((await read(sequenceId)).status, 'lobby');
    await screenshot(host, '일반퀴즈-교사-대기실');
    const participation = await host.evaluate(id => QPClassroomFlow.link(id), sequenceId);
    const url = new URL(participation);
    assert.equal(url.searchParams.get('classroom'), sequenceId);
    assert.equal(url.searchParams.get('demo'), '1');
    assert.equal(url.searchParams.get('role'), null);
    record('Teacher selects five modes, authors all four types, previews, saves, configures and opens a lobby');

    a = await open('&user=' + encodeURIComponent('검수하늘'));
    b = await open('&user=' + encodeURIComponent('검수민트'));
    for (const page of [a, b]) await page.waitForSelector('#meStage');
    const aid = await a.evaluate(() => QPGame.getMe().k), bid = await b.evaluate(() => QPGame.getMe().k);
    assert.notEqual(aid, bid, 'Two pages must represent different student accounts');
    await enter(a, sequenceId); await enter(b, sequenceId);
    await waitSession(sequenceId, value => Object.keys(value.players).length === 2);
    await host.locator('.qpc-dashboard [data-action="start"]').click();
    await a.waitForSelector('.qp-map-viewport'); await b.waitForSelector('.qp-map-viewport');
    await screenshot(a, '일반퀴즈-순서풀이-시작');

    phase = 'sequence movement and private completion';
    await a.locator('.qp-map-viewport').focus();
    await a.keyboard.down('ArrowRight');
    try {
      await a.waitForFunction(() => {
        const state = window.__qaMap.getState();
        return state.progress >= state.objects[0].progress - 35;
      }, null, { timeout: 6000 });
    } finally { await a.keyboard.up('ArrowRight'); }
    let state = await mapState(a);
    assert(state.x > 290, 'Real keyboard input must move the student toward the first gate');
    assert.equal(state.nearbyIndex, 0);
    await a.locator('.qp-map-viewport').focus(); await a.keyboard.down('ArrowRight');
    await a.waitForTimeout(450); await a.keyboard.up('ArrowRight');
    state = await mapState(a);
    assert(state.progress <= state.objects[0].progress - 24, 'Keyboard must stop before the closed gate');
    const bypass = await a.evaluate(() => {
      const map = window.__qaMap, end = map.getState().objects.at(-1);
      map.moveTo({ x: end.x, y: end.y }); return map.getState();
    });
    assert(bypass.progress <= bypass.objects[0].progress - 24, 'Collision API must also block skipping the first gate');
    await a.locator('.qp-map-viewport').focus(); await a.keyboard.press('KeyE');
    await a.waitForSelector('#classAnswerWidget');
    await choose(a, '수증기');
    await a.waitForFunction(() => document.querySelector('#classAnswerMessage')?.classList.contains('wrong'));
    assert.equal((await read(sequenceId)).players[aid].score, 0);
    assert.equal((await mapState(a)).objects[0].completed, false);
    assert(await a.locator('.qpq-choice').first().isEnabled(), 'Wrong answer must permit a retry');
    await choose(a, '얼음'); await closeQuestion(a);
    await waitSession(sequenceId, (value, uid) => value.players[uid].completed[0], aid);
    assert.equal((await read(sequenceId)).players[bid].progress, 0);
    assert.equal((await mapState(b)).objects[0].completed, false);
    const duplicate = await a.evaluate(({ id, uid }) => QPClassroom.submit(QPDemo.db, id, uid, 0, '얼음'), { id: sequenceId, uid: aid });
    assert.equal(duplicate.accepted, false); assert.equal(duplicate.reason, 'completed');
    assert.equal((await read(sequenceId)).players[aid].score, 100);
    await approach(a, 1); await typeAnswer(a, '５６'); await closeQuestion(a);
    await waitSession(sequenceId, (value, uid) => value.players[uid].score === 200, aid);
    await screenshot(a, '일반퀴즈-순서풀이-관문통과');
    await screenshot(host, '일반퀴즈-교사-진도');
    record('Actual keyboard reaches and stops at gate; wrong retry, correct opening, private progress and duplicate protection');

    phase = 'free world and shared-bank solo resume';
    const freeQuestions = Array.from({ length: 20 }, (_, index) => ({ type: 'short', q: (index + 1) + '번째 친구의 문제', a: String(index + 1) }));
    const freeId = await create('free', freeQuestions);
    await enter(a, freeId); await enter(b, freeId); await start(freeId);
    await a.waitForSelector('.qp-map-free');
    state = await mapState(a);
    assert(state.world.width >= 1800 && state.world.height >= 1200, 'Free exploration needs a large world');
    assert.equal(state.objects.length, 20);
    await a.locator('.qp-map-viewport').focus(); await a.keyboard.press('KeyE');
    assert.equal(await a.locator('#modal.on').count(), 0, 'Interaction key away from any NPC must not open a question');
    await screenshot(a, '일반퀴즈-자유풀이');
    for (const [index, name] of [[0, '용암'], [1, '성'], [2, '숲'], [3, '사막']]) {
      await approach(a, index);
      assert.equal(await a.locator('.class-question-text').innerText(), freeQuestions[index].q);
      await a.locator('#classQuestionClose').click();
      await closeQuestion(a);
      await screenshot(a, '일반퀴즈-자유풀이-' + name);
    }
    await approach(a, 0); await typeAnswer(a, '1'); await closeQuestion(a);
    await waitSession(freeId, (value, uid) => value.players[uid].completed[0], aid);
    assert.equal((await read(freeId)).players[bid].progress, 0);
    record('Large free world has accessible NPCs across four biomes, uses proximity and keeps another real student independent');

    const soloId = await create('free', authored.qs, { delivery: 'solo', duration: 0 });
    await enter(a, soloId); await a.waitForSelector('.qp-map-free');
    await approach(a, 0); await choose(a, '얼음'); await closeQuestion(a);
    await a.goto(base + '&user=' + encodeURIComponent('검수하늘'));
    await a.waitForSelector('#meStage'); await captureMap(a); await enter(a, soloId);
    await a.waitForFunction(() => window.__qaMap.getState().completed.includes(0));
    assert.equal((await read(soloId)).players[aid].score, 100);
    await host.evaluate(({ id }) => QPDemo.db.ref('quiz/bank/' + id + '/qs/0/a').set('새 문제 묶음 답'), { id: authored.id });
    assert.equal((await read(soloId)).questions[0].a, '얼음', 'Existing assignment must retain its question snapshot');
    await approach(a, 2);
    for (let index = 0; index < 2; index++) {
      await a.locator('[data-left="' + index + '"]').click();
      await a.locator('[data-right="' + (1 - index) + '"]').click();
    }
    await a.waitForFunction(() => document.querySelectorAll('.qpq-match-line').length === 2);
    const lines = await a.locator('.qpq-match-line').evaluateAll(nodes => nodes.map(node => ({ d: node.getAttribute('d'), left: node.dataset.connectionLeft, right: node.dataset.connectionRight })));
    assert(lines.every(line => /^M .+ C .+/.test(line.d)), 'Match widget must draw actual connecting curves');
    await a.locator('.qpq-submit').click();
    await a.waitForFunction(() => document.querySelector('#classAnswerMessage')?.classList.contains('wrong'));
    for (let index = 0; index < 2; index++) {
      await a.locator('[data-left="' + index + '"]').click(); await a.locator('[data-right="' + index + '"]').click();
    }
    await a.waitForFunction(() => [...document.querySelectorAll('.qpq-match-line')].every(node => node.dataset.connectionLeft === node.dataset.connectionRight) && document.querySelectorAll('.qpq-match-line').length === 2);
    await screenshot(a, '일반퀴즈-선잇기');
    await a.locator('.qpq-submit').click(); await closeQuestion(a);
    await approach(a, 3);
    await moveOrder(a, 2, 0); await moveOrder(a, 0, 1); await moveOrder(a, 1, 2);
    await a.locator('.qpq-submit').click();
    await a.waitForFunction(() => document.querySelector('#classAnswerMessage')?.classList.contains('wrong'));
    for (let index = 0; index < 3; index++) await moveOrder(a, index, index);
    assert.deepEqual(await a.locator('.qpq-order-item').evaluateAll(rows => rows.map(row => Number(row.dataset.index))), [0, 1, 2]);
    await screenshot(a, '일반퀴즈-순서맞추기');
    await a.locator('.qpq-submit').click(); await closeQuestion(a);
    await approach(a, 1); await typeAnswer(a, '오십 여섯'); await closeQuestion(a);
    await a.waitForSelector('.class-results');
    assert.equal((await read(soloId)).players[aid].score, 400);
    record('Saved bank reused for solo; reload resumes; match draws/reconnects lines; order wrong/correct grading and alias completion');

    phase = 'round picnic, deferred grades and rank';
    const rounds = [{ type: 'short', q: '우리 반의 첫 번째 답은?', a: '하나' }, { type: 'short', q: '두 번째 답은?', a: '둘' }];
    const roundId = await create('round', rounds);
    await enter(a, roundId); await enter(b, roundId); await start(roundId);
    await a.waitForSelector('.qp-round-scene');
    assert.equal(await a.locator('.qp-round-participant:not(.qp-round-empty)').count(), 2);
    assert.equal(await a.locator('.qp-round-participant:not(.qp-round-empty) .qp-round-mat').count(), 2, 'Each real student has one mat');
    await a.waitForFunction(() => !!document.querySelector('.qp-round-avatar[data-round-pose="walk"]'));
    await screenshot(a, '일반퀴즈-라운드-입장');
    await a.waitForFunction(() => [...document.querySelectorAll('.qp-round-avatar')].every(node => node.dataset.roundPose === 'sit'));
    await screenshot(a, '일반퀴즈-라운드-돗자리');
    await typeAnswer(a, '하나'); await typeAnswer(b, '틀림');
    await waitSession(roundId, value => Object.values(value.players).every(player => player.answers[0]?.pending));
    let value = await read(roundId);
    assert.equal(value.players[aid].score, 0); assert.equal(value.players[bid].score, 0);
    const resubmit = await a.evaluate(({ id, uid }) => QPClassroom.submit(QPDemo.db, id, uid, 0, '하나'), { id: roundId, uid: aid });
    assert.equal(resubmit.accepted, false); assert.equal(resubmit.reason, 'answered');
    await host.locator('[data-action="reveal"]').click();
    await waitSession(roundId, value => value.status === 'reveal');
    value = await read(roundId);
    assert.equal(value.players[aid].score, 100); assert.equal(value.players[bid].score, 0);
    await host.locator('[data-action="next"]').click();
    await waitSession(roundId, value => value.roundIndex === 1 && value.status === 'playing');
    const extraNext = await host.evaluate(id => QPClassroom.next(QPDemo.db, id), roundId);
    assert.equal(extraNext.accepted, false); assert.equal((await read(roundId)).roundIndex, 1);
    await a.waitForSelector('.qpq-short-input'); await b.waitForSelector('.qpq-short-input');
    await typeAnswer(a, '둘'); await typeAnswer(b, '둘');
    await waitSession(roundId, value => Object.values(value.players).every(player => player.answers[1]?.pending));
    await host.locator('[data-action="reveal"]').click(); await host.locator('[data-action="next"]').click();
    await a.waitForSelector('.class-results');
    const rankText = await a.locator('[data-rank]').innerText();
    assert(rankText.includes('1위 · 검수하늘') && rankText.includes('2위 · 검수민트'));
    await screenshot(a, '일반퀴즈-라운드-결과');
    record('Round students walk onto one mat each, sit, defer grading until reveal, advance once and receive correct ranks');

    phase = 'balanced teams, chosen teams and totals';
    const randomTeamId = await create('team', authored.qs, { teamCount: 3, teamAssign: 'random' });
    await enter(a, randomTeamId); await enter(b, randomTeamId);
    await host.evaluate(async ({ id, avatar }) => {
      for (let index = 0; index < 5; index++) await QPClassroom.join(QPDemo.db, id, { id: 'fixture_team_' + index, name: '균등 검증 ' + index, av: avatar });
    }, { id: randomTeamId, avatar: await a.evaluate(() => QPGame.getMe().av) });
    await showHost(randomTeamId); await host.locator('[data-action="assignTeams"]').click();
    value = await read(randomTeamId);
    const counts = value.metrics.teams.map(team => team.count);
    assert.equal(counts.reduce((sum, count) => sum + count, 0), 7);
    assert(Math.max(...counts) - Math.min(...counts) <= 1);
    await host.locator('[data-action="start"]').click();
    await a.waitForSelector('.qp-map-team');
    assert.equal(await a.evaluate(() => window.__qaMap.moveTo({ x: 10, y: 10 })), false, 'Fenced team arena must reject leaving its boundary');
    await screenshot(a, '일반퀴즈-팀전');
    const teamId = await create('team', authored.qs, { teamCount: 3, teamAssign: 'choose' });
    await enter(a, teamId); await enter(b, teamId);
    await a.locator('[data-team="1"]').click(); await b.locator('[data-team="1"]').click();
    await waitSession(teamId, value => Object.values(value.players).every(player => player.team === '1'));
    await start(teamId); await a.waitForSelector('.qp-map-team'); await b.waitForSelector('.qp-map-team');
    const actualColor = await a.locator('.qp-map-me').evaluate(node => node.style.getPropertyValue('--qp-map-team-color'));
    assert.equal(actualColor, await host.evaluate(() => QPClassroom.teamColor(1)));
    await approach(a, 0); await choose(a, '얼음'); await closeQuestion(a);
    value = await read(teamId); assert.equal(value.players[bid].progress, 0); assert.equal(value.metrics.teams[1].score, 100);
    await approach(b, 0); await choose(b, '얼음'); await closeQuestion(b);
    value = await read(teamId); assert.equal(value.metrics.teams[1].score, 200);
    assert.equal(value.players[aid].score + value.players[bid].score, 200);
    const switchAfterStart = await a.evaluate(({ id, uid }) => QPClassroom.selectTeam(QPDemo.db, id, uid, 0), { id: teamId, uid: aid });
    assert.equal(switchAfterStart.accepted, false);
    record('Teacher team count/random distribution balances seven students; chosen team color and personal-score totals stay independent');

    phase = 'cooperation sum and deadline';
    const coopId = await create('coop', authored.qs, { coopGoal: 2 });
    await enter(a, coopId); await enter(b, coopId); await start(coopId);
    await a.waitForSelector('.qp-map-coop'); await screenshot(a, '일반퀴즈-협동전');
    await approach(a, 0); await choose(a, '얼음'); await closeQuestion(a);
    value = await read(coopId); assert.equal(value.metrics.totalCorrect, 1); assert.equal(value.players[bid].progress, 0);
    assert.equal(value.status, 'playing');
    await approach(b, 0); await choose(b, '얼음'); await closeQuestion(b);
    await waitSession(coopId, value => value.status === 'ended' && value.metrics.totalCorrect === 2);
    value = await read(coopId); assert.equal(value.outcome, 'success'); assert.equal(value.players[aid].progress, 1); assert.equal(value.players[bid].progress, 1);
    await a.waitForSelector('.class-results'); assert((await a.locator('.class-results h2').innerText()).includes('함께 성공'));
    const cutoffId = await create('coop', authored.qs, { coopGoal: 10, duration: 1 });
    await enter(a, cutoffId); await enter(b, cutoffId); await start(cutoffId);
    await waitSession(cutoffId, value => value.status === 'ended');
    assert.equal((await read(cutoffId)).outcome, 'unfinished');
    record('Cooperation counts two students solving the same question as two independent completions; goal success and deadline failure differ');

    phase = 'solo chosen team and actual time cutoff';
    const soloTeamId = await create('team', authored.qs, { delivery: 'solo', duration: 0, teamAssign: 'choose', teamCount: 3 });
    await enter(a, soloTeamId); await a.locator('[data-team="2"]').click(); await a.waitForSelector('.qp-map-team');
    assert.equal((await read(soloTeamId)).players[aid].team, '2');
    const soloCutoffId = await create('free', authored.qs, { delivery: 'solo', duration: 1 });
    await enter(a, soloCutoffId); await a.waitForSelector('.class-results');
    value = await read(soloCutoffId); assert.equal(value.players[aid].timedOut, true); assert.equal(value.players[aid].score, 0);
    const late = await a.evaluate(({ id, uid }) => QPClassroom.submit(QPDemo.db, id, uid, 0, '얼음'), { id: soloCutoffId, uid: aid });
    assert.equal(late.accepted, false);
    const soloRoundId = await create('round', rounds, { delivery: 'solo', duration: 0, timer: 5 });
    await enter(a, soloRoundId); await a.waitForSelector('.qpq-short-input'); await typeAnswer(a, '하나');
    await a.waitForSelector('[data-solo-next]');
    value = await read(soloRoundId); assert.equal(value.players[aid].status, 'reveal'); assert.equal(value.players[aid].currentIndex, 0);
    await a.locator('[data-solo-next]').click();
    await waitSession(soloRoundId, (value, uid) => value.players[uid].currentIndex === 1, aid);
    await a.waitForSelector('.class-results', { timeout: 10000 });
    value = await read(soloRoundId); assert.equal(value.players[aid].answers[1].timedOut, true); assert.equal(value.players[aid].score, 100);
    record('Solo student chooses a team, expired assignment rejects answers, and solo rounds reveal then advance or time out');

    phase = 'mobile student map';
    await a.setViewportSize({ width: 390, height: 844 });
    await enter(a, soloTeamId); await a.waitForSelector('.qp-map-team');
    assert(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile student map overflows');
    const interactBounds = await a.locator('.qp-map-interact').boundingBox();
    assert(interactBounds && interactBounds.x >= 0 && interactBounds.x + interactBounds.width <= 391, 'Mobile interaction button must fit');
    await screenshot(a, '일반퀴즈-학생-390');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    record('390px teacher/editor/student screens fit and all exercised pages have no runtime errors');
    fs.writeFileSync(path.join(out, '일반퀴즈-검증결과.json'), JSON.stringify({ passed: true, session, checks, screenshots, errors }, null, 2));
    console.log('Classroom regression: ' + checks.length + ' checks; ' + screenshots.length + ' screenshots in 검증/');
  } catch (error) {
    if (a && !a.isClosed()) await screenshot(a, '일반퀴즈-실패-학생').catch(() => {});
    if (host && !host.isClosed()) await screenshot(host, '일반퀴즈-실패-교사').catch(() => {});
    const lastSession = latestId && host && !host.isClosed() ? await read(latestId).catch(() => null) : null;
    fs.writeFileSync(path.join(out, '일반퀴즈-검증결과.json'), JSON.stringify({ passed: false, session, phase, checks, screenshots, errors, lastSession, failure: error.stack }, null, 2));
    console.error('Classroom regression failed in ' + phase + ': ' + error.stack);
    process.exitCode = 1;
  } finally { await browser?.close(); }
})();
