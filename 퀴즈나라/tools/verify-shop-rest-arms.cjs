'use strict';

// Exercise the real shop, not the separate foundation studio. The cuff oracle
// is measured in original PNG pixels, independently of runtime fit metadata.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./sleeve-aperture-fixtures.json');
const output = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || '/tmp/quiz-shop-rest-arms');
const base = process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/';
const override = process.env.QUIZ_ARM_SOURCE_OVERRIDE;
const report = { success: false, rows: [], errors: [], screenshots: [],
  limits: 'Shop front idle only. Sleeve insertion and moving poses have separate checks; no claim of final art approval or wardrobe migration.' };
fs.mkdirSync(output, { recursive: true });

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 940 }, reducedMotion: 'reduce' });
    await page.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app|firestore.googleapis.com/, r => r.fulfill({ body: '' }));
    if (override) await page.route('**/avatar-pixel.js', r => r.fulfill({ path: path.resolve(override), contentType: 'text/javascript' }));
    page.on('pageerror', e => report.errors.push(e.message));
    const url = new URL(base); url.searchParams.set('demo', '1'); url.searchParams.set('session', 'shop-rest-arms');
    await page.goto(url.href);
    await page.waitForFunction(() => window.QPGame?.getMe() && QPAvatar.atlas.ready && QPClothes.atlas.ready && QPShoes.atlas.ready);
    const entries = await page.evaluate(() => {
      const c = QPGame.getCatalog(), entries = [];
      for (const sex of ['m', 'f']) for (const category of ['top', 'outfit']) for (const item of c.publicItems(category, sex)) {
        const av = QPGame.avatarForSex({ ...QPGame.newAvatar(sex), bottom: 'shorts:5' });
        if (category === 'outfit') { Object.assign(av, c.OUTFIT_PARTS[item.shape][sex]); av.outfit = item.shape + ':' + item.ci; }
        else av.top = item.shape + ':' + item.ci;
        const shape = av.top.split(':')[0], fit = QPClothes.fitFor(shape, sex);
        if (fit?.short && !fit.sleeveless) entries.push({ id: sex + '/' + shape, av });
      }
      return entries;
    });
    for (const entry of entries) for (const sk of [0, 4]) {
      const fixture = fixtures.rows.find(f => f.id === entry.id);
      assert(fixture, 'Missing independent cuff fixture: ' + entry.id);
      const row = await page.evaluate(({ entry, fixture, sk }) => {
        const me = QPGame.getMe(); me.av = { ...entry.av, sk };
        const account = JSON.stringify({ av: me.av, gold: me.gold, owned: me.owned, skinOwned: me.skinOwned });
        QPGame.go('shop');
        const svg = document.querySelector('#pvStage > svg');
        const arms = fixture.sleeves.map(sleeve => {
          const group = svg.querySelector('.qpx-arm-front-' + sleeve.side);
          const hand = group.querySelector('[data-qpx-wrist]');
          const wrist = hand.dataset.qpxWrist.split(',').map(Number);
          const edge = sleeve.endpointsSourcePixels.map(p => [
            fixture.target[0] + (p[0] - fixture.sourceRect[0]) / fixture.sourceRect[2] * fixture.target[2],
            fixture.target[1] + (p[1] - fixture.sourceRect[1]) / fixture.sourceRect[3] * fixture.target[3]
          ]);
          const cuff = edge[0].map((n, i) => (n + edge[1][i]) / 2);
          // A relaxed wrist stays in the vertical column below the opening,
          // rather than turning inward toward the stomach at the elbow.
          const sideways = Math.abs(wrist[0] - cuff[0]);
          return { side: sleeve.side, cuff, wrist, sideways,
            pass: sideways <= .22 && wrist[1] > cuff[1] + .7 && wrist[1] >= 36 && wrist[1] <= 37.7 };
        });
        return { id: entry.id, sk, arms, pipeline: svg.classList.contains('qp-foundation-avatar') ? 'foundation' : 'ordinary',
          itemPreserved: svg.querySelector('[data-qpx-clothes="top"]')?.dataset.clothShape === entry.av.top.split(':')[0],
          accountPreserved: account === JSON.stringify({ av: me.av, gold: me.gold, owned: me.owned, skinOwned: me.skinOwned }) };
      }, { entry, fixture, sk });
      row.pass = row.arms.every(a => a.pass) && row.itemPreserved && row.accountPreserved;
      report.rows.push(row);
      if (entry.id.endsWith('/tee')) {
        const name = entry.id.replace('/', '-') + '-skin' + sk + '.png';
        await page.locator('#pvStage').screenshot({ path: path.join(output, name) }); report.screenshots.push(name);
      }
    }
    report.failures = report.rows.filter(r => !r.pass);
    assert(report.rows.length >= 20, 'Expected both sexes and two skin tones across short-sleeved styles.');
    assert.equal(report.failures.length, 0, 'Resting wrists turn inward, garment changed or shop changed the account.');
    assert.equal(report.errors.length, 0, 'Browser error.');
    report.success = true;
  } catch (e) { report.error = e.message; process.exitCode = 1; }
  finally {
    await browser.close(); report.completedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, success: report.success, rows: report.rows.length, failures: report.failures?.length, error: report.error }));
  }
})();
