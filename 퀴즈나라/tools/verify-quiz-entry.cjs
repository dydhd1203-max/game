'use strict';

// Quiz entry after the class system was removed (2026-10-14): the operator saves a quiz with the
// builder, and a student reaches it only through the QUIZQUIZ lobby (top bar, home tile, classroom
// blackboard). Old ?classroom= links no longer open anything. Isolated demo store, cold cache.
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
let browser, host, a, phase = 'startup';
fs.mkdirSync(out, { recursive: true });
function pass(value) { checks.push(value); console.log('PASS: ' + value); }
async function screenshot(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(out, name + '.png') });
}
async function createFormSets(page) {
  await page.waitForSelector('#qqCreate');
  await page.locator('#qqCreate').click();
  await page.waitForSelector('#qqCreateForm');
  const titles = await page.locator('#qqSet option').evaluateAll(options => options.map(o => o.textContent));
  await page.locator('#qqCancel').click();
  return titles;
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.QUIZ_BROWSER_EXECUTABLE || undefined });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    context.setDefaultTimeout(15000);
    await context.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
      contentType: 'text/javascript', body: '/* isolated entry regression: no real Firebase */'
    }));
    const open = async suffix => {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + suffix);
      await page.waitForFunction(() => window.QPGame && window.QPDemo && QPGame.getMe() && QPAvatar?.atlas.ready && QPClothes?.atlas.ready);
      return page;
    };
    phase = 'operator authoring';
    host = await open('&role=admin&screen=teacher');
    await host.waitForSelector('.teacher-library');
    await host.locator('[data-t="make"]').click();
    await host.waitForSelector('.qpb-builder');
    await host.locator('[data-field="title"]').fill('입장 회귀용 저장 퀴즈');
    for (const [question, answer] of [['물이 얼면 무엇이 될까요?', '얼음'], ['봄 다음 계절은?', '여름']]) {
      await host.locator('[data-add="short"]').first().click();
      await host.locator('textarea[data-field="q"]').fill(question);
      await host.locator('input[data-field="a"]').fill(answer);
    }
    await host.locator('[data-action="next"]').click();
    await host.waitForSelector('.teacher-library');
    const setId = await host.evaluate(async () => Object.entries((await QPDemo.db.ref('quiz/bank').once()).val())
      .find(([, set]) => set.title === '입장 회귀용 저장 퀴즈')?.[0]);
    assert(setId);
    pass('The operator writes and saves a new quiz from the operator screen; it returns to 내 퀴즈');

    phase = 'student lobby entry';
    a = await open('&user=' + encodeURIComponent('입장검수하늘'));
    assert.equal(await a.locator('#tbAdmin').count(), 0, 'A student has no 운영자 tab');
    await a.evaluate(() => QPGame.go('teacher'));
    await a.waitForFunction(() => !!QPGame.getVillage());
    assert.equal(await a.locator('.teacher-top').count(), 0, 'A student cannot open the operator screen');
    await a.locator('#tbQuiz').click();
    const titles = await createFormSets(a);
    assert(titles.some(t => t.includes('입장 회귀용 저장 퀴즈') && t.includes('2문제')), 'Saved quiz must appear in the room form: ' + titles.join(' / '));
    await screenshot(a, '퀴즈입장-학생-QUIZQUIZ로비');
    await a.evaluate(() => QPGame.go('home'));
    assert.equal(await a.locator('#mPractice,#mLive').count(), 0, '혼자 연습·수업 참가 tiles are removed');
    await a.locator('#mQuiz').click();
    await a.waitForSelector('.qq-root #qqCreate');
    pass('A student reaches the QUIZQUIZ lobby from the top bar and the home tile; the operator quiz is offered in 방 만들기');

    phase = 'removed class links';
    await a.goto(base + '&user=' + encodeURIComponent('입장검수하늘') + '&classroom=missing_fixture');
    await a.waitForFunction(() => window.QPGame && QPGame.getMe() && !!QPGame.getVillage());
    assert.equal(await a.locator('[data-exit],.class-hub,.classroom-student-body').count(), 0);
    assert.equal(await a.evaluate(async () => (await QPDemo.db.ref('quiz/classrooms').once()).exists()), false);
    pass('An old ?classroom= link just enters the village; nothing reads or creates quiz/classrooms');
    assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
    fs.writeFileSync(path.join(out, '퀴즈입장-검증.json'), JSON.stringify({ session, preview: preview.href, cache: 'cold', checks, errors }, null, 2));
    console.log('Quiz entry regression: ' + checks.length + ' checks passed; screenshots in ' + out);
  } catch (error) {
    console.error('Quiz entry regression failed in ' + phase + ': ' + error.stack);
    if (a) await screenshot(a, '퀴즈입장-실패-학생').catch(() => {});
    if (host) await screenshot(host, '퀴즈입장-실패-운영자').catch(() => {});
    process.exitCode = 1;
  } finally { await browser?.close(); }
})();
