'use strict';

// Render the public fixed-colour wardrobe, including complete outfit parts.
// Optional --screenshots writes two front-view plates (224 px and current 96 px).
// QUIZ_PREVIEW_URL, QUIZ_VERIFICATION_OUTPUT and QUIZ_BROWSER_EXECUTABLE
// select the served build, evidence directory and local Chromium executable.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || path.join(root, '검증/상점-착용연결'));
const base = process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/';
const screenshots = process.argv.includes('--screenshots');
const expectedShapes = {
  m: ['tee', 'hood', 'shirt', 'vest', 'cardi', 'jacket', 'knit', 'overall', 'space', 'hanbok'],
  f: ['tee', 'hood', 'shirt', 'vest', 'cardi', 'sailor', 'jacket', 'knit', 'tank', 'dress', 'robe', 'overall', 'space', 'hanbok']
};
const fingerprintFiles = [
  'index.html', 'avatar-pixel.js', 'avatar-clothes.js', 'avatar-direction.js',
  'avatar-poses.js', 'avatar-accessory-direction.js', 'avatar-shoes.js',
  'avatar-shoes-profile.js', 'assets/sd-tops.png', 'assets/sd-hood.png',
  'assets/sd-bottoms.png', 'assets/sd-clothes-male.png'
];

if (process.argv.includes('--help')) {
  console.log('node tools/verify-curated-fitting.cjs [--screenshots]\n' +
    'Environment: QUIZ_PREVIEW_URL, QUIZ_VERIFICATION_OUTPUT, QUIZ_BROWSER_EXECUTABLE');
  process.exit(0);
}

const report = {
  startedAt: new Date().toISOString(), success: false, phase: 'startup',
  previewURL: base, fixtures: [], skins: [], contacts: [], restores: [],
  sourceHashes: {}, servedHashes: {}, screenshots: [], errors: [], missingResources: [],
  scope: {
    fixtureSource: 'QPGame.getCatalog().publicItems(top/outfit, sex) and OUTFIT_PARTS',
    expected: { maleTops: 10, femaleTops: 14, skinColours: 5, neckRows: 120, bareArmRows: 105,
      ordinarySleeveRows: 100, sleevelessRows: 5, coveredRows: 15, restoreRows: 72 },
    contact: 'Front view, 620px rig render, alpha > 100; exact painted pixel overlap is required (gap = 0).',
    contactRegions: { neck: [13, 24, 19, 33], leftArm: [0, 0, 16, 62], rightArm: [16, 0, 32, 62] },
    layerContract: 'Arm roots behind the garment; only the clipped emerging forearm and hands cross the outward half of the cuff.',
    intents: {
      sleeveless: 'tank: exposed arms connect to the shoulder/strap; no sleeve cuff is assumed.',
      robe: 'Original robe painting covers the arms; separate bare skin is intentionally absent.',
      space: 'Original space-suit painting supplies covered sleeves/gloves; separate bare skin is intentionally absent.'
    },
    restoration: 'Each fixed-colour fixture: right/back/left floor-sit, then pose.destroy; compare all front RGBA bytes at 224px.',
    fingerprints: 'SHA256 of the served HTML/renderer sources and front clothing atlases listed in servedHashes; this is not a hash of every deployment file.',
    limits: 'Alpha overlap and restoration do not establish art quality, moving contact in every pose, live Firebase multiplayer or a public deployment.'
  }
};
let browser, page;
fs.mkdirSync(output, { recursive: true });
function saveReport() {
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

// This function runs entirely in the browser. Keep the pixel probe independent
// of the runtime's cuff/neck geometry; it measures the painted SVG result.
async function measureFixture({ entry, skins }) {
  const NS = 'http://www.w3.org/2000/svg';
  const drawable = 'path,ellipse,rect,image,polygon,line,polyline,circle';
  const host = document.querySelector('#curated-fitting-host');
  const result = { id: entry.id, contacts: [], restores: [] };
  window.__curatedFittingPartial = result;

  async function pixels(svg, selection) {
    const clone = svg.cloneNode(true);
    const selected = selection ? new Set(clone.querySelectorAll(selection)) : null;
    if (selected) for (const leaf of clone.querySelectorAll(drawable)) {
      if (leaf.closest('defs')) continue;
      let keep = false;
      for (let ancestor = leaf; ancestor && ancestor !== clone; ancestor = ancestor.parentElement) {
        if (selected.has(ancestor)) { keep = true; break; }
      }
      if (!keep) leaf.remove();
    }
    const style = document.createElementNS(NS, 'style');
    style.textContent = '*{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}';
    clone.prepend(style);
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, viewHeight: svg.viewBox.baseVal.height,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data };
  }
  function contact(a, b, box) {
    const points = image => {
      const points = [];
      for (let y = Math.max(0, Math.floor(box[1] * image.height / image.viewHeight)); y < Math.min(image.height, Math.ceil(box[3] * image.height / image.viewHeight)); y++) {
        for (let x = Math.max(0, Math.floor(box[0] * image.width / 32)); x < Math.min(image.width, Math.ceil(box[2] * image.width / 32)); x++) {
          if (image.data[(y * image.width + x) * 4 + 3] > 100) points.push([x, y]);
        }
      }
      return points;
    };
    const first = points(a), second = points(b);
    const secondSet = new Set(second.map(([x, y]) => y * b.width + x));
    let overlap = 0;
    for (const [x, y] of first) if (secondSet.has(y * b.width + x)) overlap++;
    if (!first.length || !second.length) return { firstPixels: first.length, secondPixels: second.length, overlapPixels: 0, gap: null };
    if (overlap) return { firstPixels: first.length, secondPixels: second.length, overlapPixels: overlap, gap: 0 };
    // A two-unit lower bound suffices for larger failures. Close failures use
    // the nearest painted pixel, so a missing contact is not rounded to zero.
    let gap = 2;
    const rows = new Map();
    for (const [x, y] of second) { if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x); }
    for (const [x, y] of first) {
      const radius = Math.ceil(gap * a.height / a.viewHeight);
      for (let yy = y - radius; yy <= y + radius; yy++) {
        const row = rows.get(yy); if (!row) continue;
        let lo = 0, hi = row.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (row[mid] < x) lo = mid + 1; else hi = mid; }
        for (const i of [lo - 1, lo]) if (i >= 0 && i < row.length) {
          gap = Math.min(gap, Math.hypot((row[i] - x) * 32 / a.width, (yy - y) * a.viewHeight / a.height));
        }
      }
    }
    return { firstPixels: first.length, secondPixels: second.length, overlapPixels: 0, gap, distanceSearchLimit: 2 };
  }
  function layers(svg, shape, fit) {
    const top = svg.querySelector('[data-qpx-clothes="top"]');
    const rear = svg.querySelector('.qpx-body > .qpx-arms:not(.qpx-arms-front)');
    const front = svg.querySelector('.qpx-body > .qpx-arms-front');
    const follows = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const paint = group => group ? [...group.querySelectorAll(drawable)].filter(leaf => !leaf.closest('defs')) : [];
    const frontPaint = paint(front);
    const unownedFrontPaint = frontPaint.filter(leaf => !leaf.closest('.qpx-hand-left,.qpx-hand-right,[data-qpx-emerging-arm]')).length;
    const intent = shape === 'space' ? 'painted-gloves' : shape === 'robe' ? 'covered-robe' : fit.sleeveless ? 'bare-shoulder' : 'sleeve';
    const covered = shape === 'robe' || shape === 'space';
    return { intent, rearPaintCount: paint(rear).length, frontPaintCount: frontPaint.length,
      rearBeforeTop: follows(rear, top), topBeforeHands: follows(top, front),
      frontHandCount: front ? front.querySelectorAll('.qpx-hand-left,.qpx-hand-right').length : 0,
      unownedFrontPaint, coveredSkinAbsent: covered ? !rear && !front : null,
      pass: covered ? !rear && !front : Boolean(rear && front && follows(rear, top) && follows(top, front) &&
        front.querySelectorAll('.qpx-hand-left,.qpx-hand-right').length === 2 && frontPaint.length > 0 && unownedFrontPaint === 0) };
  }

  for (let sk = 0; sk < skins.length; sk++) {
    host.innerHTML = QPAvatar.render({ ...entry.av, sk }, 620, 3);
    const svg = host.firstElementChild, shape = entry.shape;
    const fit = QPClothes.fitFor(shape, entry.sex);
    const covered = shape === 'robe' || shape === 'space';
    const [top, neck, left, right] = await Promise.all([
      pixels(svg, '[data-qpx-clothes="top"]'), pixels(svg, '.qpx-skin-torso'),
      pixels(svg, '.qpx-arm-left'), pixels(svg, '.qpx-arm-right')
    ]);
    result.contacts.push({ id: entry.id, sex: entry.sex, shape, sk, skin: skins[sk],
      top: entry.av.top, bottom: entry.av.bottom, outfit: entry.av.outfit,
      source: QPClothes.inspect('top', shape, entry.sex), fit,
      paintedColour: svg.querySelector('[data-qpx-clothes="top"]').dataset.clothColor,
      contacts: { neck: contact(top, neck, [13, 24, 19, 33]),
        left: covered ? null : contact(top, left, [0, 0, 16, 62]),
        right: covered ? null : contact(top, right, [16, 0, 32, 62]) },
      bareArmRequired: !covered, layers: layers(svg, shape, fit) });
  }

  host.innerHTML = QPAvatar.render(entry.av, 224, 3);
  const svg = host.firstElementChild, before = await pixels(svg);
  for (const direction of ['right', 'back', 'left']) {
    QPAvatarPose.apply(svg, { action: 'floor-sit', seatMode: 'floor', direction, facing: direction === 'left' ? 'left' : 'right', grounded: true });
    const mountedView = svg.dataset.qpxView, mountedPose = svg.dataset.qpxPose;
    const expectedView = direction === 'back' ? 'back' : 'profile';
    if (mountedView !== expectedView || mountedPose !== 'floor-sit') {
      throw new Error(entry.id + ' did not mount ' + direction + ' floor-sit before restoration: ' + mountedView + '/' + mountedPose);
    }
    QPAvatarPose.destroy(svg);
    const after = await pixels(svg);
    let changed = before.data.length === after.data.length ? 0 : Math.abs(before.data.length - after.data.length);
    const length = Math.min(before.data.length, after.data.length);
    for (let i = 0; i < length; i++) if (before.data[i] !== after.data[i]) changed++;
    result.restores.push({ id: entry.id, sex: entry.sex, shape: entry.shape, direction,
      action: 'floor-sit', mountedView, mountedPose, changedRGBABytes: changed, comparedRGBABytes: before.data.length,
      width: before.width, height: before.height, restoredView: svg.dataset.qpxView || 'front' });
  }
  return result;
}

(async () => {
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.QUIZ_BROWSER_EXECUTABLE || undefined });
    const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
    await context.route('**/www.gstatic.com/firebasejs/**', route => route.fulfill({ body: '/* isolated curated fitting QA */', contentType: 'text/javascript' }));
    for (const pattern of ['**/*firebaseio.com/**', '**/*firebasedatabase.app/**', '**/firestore.googleapis.com/**']) await context.route(pattern, route => route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(base).origin) report.missingResources.push({ url: response.url(), status: response.status() }); });
    const url = new URL(base);
    url.searchParams.set('demo', '1');
    url.searchParams.set('session', 'curated-fitting-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'));
    report.url = url.href;
    report.phase = 'load-atlases';
    await page.goto(url.href);
    await page.waitForFunction(() => window.QPGame && QPGame.getMe() && QPAvatar.atlas.ready &&
      QPAvatarDirection.atlas.ready && QPAvatarDirection.atlas.backReady && QPClothes.atlas.ready && QPShoes.atlas.partsReady);
    const fixtureData = await page.evaluate(() => {
      QPGame.go('home');
      const catalog = QPGame.getCatalog(), baseAvatar = QPGame.getMe().av;
      const clean = { ...baseAvatar, sk: 0, expression: 'bright:0', shoes: 'sneaker:8',
        hat: '', glass: '', ear: '', neck: '', face: '', back: '', effect: '', pet: '', bg: '', frame: '', outfit: '' };
      const fixtures = [];
      for (const sex of ['m', 'f']) for (const category of ['top', 'outfit']) {
        for (const item of catalog.publicItems(category, sex)) {
          const av = { ...clean, sex, hair: sex === 'm' ? 'short:1' : 'bob:1', bottom: sex === 'm' ? 'jeans:5' : 'shorts:5' };
          if (category === 'outfit') {
            Object.assign(av, catalog.OUTFIT_PARTS[item.shape][sex]); av.outfit = item.shape + ':' + item.ci;
          } else av.top = item.shape + ':' + item.ci;
          fixtures.push({ id: sex + '-' + item.shape, sex, shape: av.top.split(':')[0],
            category, itemId: item.id, canonicalColourIndex: item.ci, name: item.short, av });
        }
      }
      document.head.insertAdjacentHTML('beforeend', '<style>html,body{height:auto!important;overflow:visible!important;display:block!important;background:#fff8ec}.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}</style>');
      document.body.innerHTML = '<div id="curated-fitting-host"></div>';
      return { fixtures, skins: catalog.PAL.skin, outfitParts: catalog.OUTFIT_PARTS };
    });
    Object.assign(report, { fixtures: fixtureData.fixtures, skins: fixtureData.skins, outfitParts: fixtureData.outfitParts });
    for (const sex of ['m', 'f']) assert.deepEqual(report.fixtures.filter(entry => entry.sex === sex).map(entry => entry.shape).sort(), expectedShapes[sex].slice().sort(), 'Public ' + sex + ' wardrobe changed.');
    assert.equal(report.skins.length, 5, 'All five public skin colours must be exercised.');

    report.phase = 'fingerprint-served-build';
    for (const file of fingerprintFiles) {
      const servedURL = new URL(file, url).href, response = await context.request.get(servedURL);
      assert(response.ok(), 'Missing served fingerprint resource: ' + file);
      const bytes = await response.body();
      report.servedHashes[file] = { url: servedURL, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
      const source = path.join(root, file);
      if (fs.existsSync(source)) report.sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    }
    for (const entry of report.fixtures) {
      report.phase = 'measure/' + entry.id;
      const measured = await page.evaluate(measureFixture, { entry, skins: report.skins });
      report.contacts.push(...measured.contacts); report.restores.push(...measured.restores);
      saveReport();
    }
    if (screenshots) for (const sex of ['m', 'f']) {
      report.phase = 'front-plate/' + sex;
      await page.evaluate(entries => {
        const host = document.querySelector('#curated-fitting-host');
        host.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:12px'; host.replaceChildren();
        for (const entry of entries) {
          const card = document.createElement('article'); card.style.cssText = 'display:flex;align-items:center;flex-direction:column;border:1px solid #c8b795;padding:10px;background:#fffaf2';
          const title = document.createElement('b'); title.textContent = entry.id + ' · 224/96'; card.append(title);
          card.insertAdjacentHTML('beforeend', QPAvatar.render(entry.av, 224, 3) + QPAvatar.render(entry.av, 96, 3)); host.append(card);
        }
      }, report.fixtures.filter(entry => entry.sex === sex));
      const filename = sex + '-public-front-224-96.png';
      await page.screenshot({ path: path.join(output, filename), fullPage: true }); report.screenshots.push(filename);
    }
    report.counts = { fixtures: report.fixtures.length, male: report.fixtures.filter(entry => entry.sex === 'm').length,
      female: report.fixtures.filter(entry => entry.sex === 'f').length, skins: report.skins.length,
      neckRows: report.contacts.length, bareArmRows: report.contacts.filter(row => row.bareArmRequired).length,
      bareArmContacts: report.contacts.filter(row => row.bareArmRequired).length * 2,
      coveredRows: report.contacts.filter(row => !row.bareArmRequired).length,
      ordinarySleeveRows: report.contacts.filter(row => row.layers.intent === 'sleeve').length,
      sleevelessRows: report.contacts.filter(row => row.layers.intent === 'bare-shoulder').length, restoreRows: report.restores.length };
    report.failures = report.contacts.filter(row => !row.source || row.contacts.neck.gap !== 0 || !row.layers.pass ||
      row.bareArmRequired && (row.contacts.left.gap !== 0 || row.contacts.right.gap !== 0));
    report.restoreFailures = report.restores.filter(row => row.changedRGBABytes !== 0 || row.restoredView !== 'front');
    assert.equal(report.counts.neckRows, 120, 'Incomplete neck coverage.');
    assert.equal(report.counts.bareArmRows, 105, 'Incomplete bare-arm coverage.');
    assert.equal(report.counts.ordinarySleeveRows, 100, 'Incomplete ordinary sleeve-layer coverage.');
    assert.equal(report.counts.sleevelessRows, 5, 'Incomplete sleeveless shoulder coverage.');
    assert.equal(report.counts.coveredRows, 15, 'Covered robe/glove intent changed.');
    assert.equal(report.counts.restoreRows, 72, 'Incomplete front-restoration coverage.');
    assert.equal(report.failures.length, 0, 'Painted neck/arm overlap or front layer contract failed.');
    assert.equal(report.restoreFailures.length, 0, 'Direction/pose did not restore exact front RGBA.');
    assert.equal(report.errors.length, 0, 'Unexpected browser errors.');
    assert.equal(report.missingResources.length, 0, 'Served artwork/runtime resource is missing.');
    report.phase = 'completed'; report.success = true;
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) {
      try { report.partialFixture = await page.evaluate(() => window.__curatedFittingPartial || null); } catch (_) { /* Preserve the original failure. */ }
    }
    process.exitCode = 1;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (error) { report.closeError = error.message; report.success = false; process.exitCode = 1; }
    }
    saveReport();
    console.log(JSON.stringify({ output, success: report.success, phase: report.phase, counts: report.counts,
      failures: report.failures?.length, restoreFailures: report.restoreFailures?.length, errors: report.errors.length,
      failure: report.failure?.message }));
  }
})();
