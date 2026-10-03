'use strict';

// This is intentionally stronger than a one-pixel alpha contact test. The
// aperture oracle was measured from the original PNGs by a separate reader;
// runtime fit.cuffs/openings are never used to decide whether insertion passes.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const aperture = require('./sleeve-aperture-fixtures.json');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || path.join(root, '검증/소매-매입'));
const base = process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/';
const override = process.env.QUIZ_SLEEVE_SOURCE_OVERRIDE;
const focus = process.env.QUIZ_SLEEVE_FOCUS;
const screenshots = process.argv.includes('--screenshots');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const fingerprints = ['index.html', 'avatar-pixel.js', 'avatar-clothes.js', 'avatar-poses.js',
  'avatar-direction.js','avatar-cloth-mesh.js','assets/sd-wardrobe-wave.png', 'assets/sd-tops.png', 'assets/sd-hood.png', 'assets/sd-clothes-male.png'];
const states = [
  { id: 'native', pose: null },
  { id: 'breath', pose: { action: 'idle', direction: 'front', facing: 'right', phase: .2, grounded: true } },
  { id: 'walk', pose: { action: 'walk', direction: 'front', facing: 'right', phase: .25, grounded: true } },
  { id: 'wave', pose: { action: 'idle', direction: 'front', facing: 'right', gesture: 'wave', gestureProgress: .43, grounded: true } },
  { id: 'jump', pose: { action: 'jump', direction: 'front', facing: 'right', vy: -180, grounded: false } },
  { id: 'floor-sit', pose: { action: 'floor-sit', seatMode: 'floor', direction: 'front', facing: 'right', grounded: true } }
];

if (process.argv.includes('--help')) {
  console.log('node tools/verify-sleeve-insertion.cjs [--screenshots]\n' +
    'Environment: QUIZ_PREVIEW_URL, QUIZ_VERIFICATION_OUTPUT, QUIZ_BROWSER_EXECUTABLE,\n' +
    'QUIZ_SLEEVE_SOURCE_OVERRIDE (directory containing old pixel/clothes/poses scripts), QUIZ_SLEEVE_FOCUS (m/tee).');
  process.exit(0);
}

const report = {
  startedAt: new Date().toISOString(), success: false, phase: 'startup', previewURL: base,
  sourceOverride: override || null, focus: focus || null, oracle: aperture.provenance,
  thresholds: { alpha: 128, rootCoverageAt035In: .65, rootCoverageAt070In: .50,
    emergingCoverageAt035Out: .35, opaqueClothAlpha: 248, maximumColourDelta: 8 },
  scope: {
    ordinarySleeves: 'All 20 public male/female upper styles that have sleeves; skin colours 0 and 4.',
    static: 'Independent original-PNG opening width and normal; rasterized skin must enter broadly at two inward depths and emerge along the real diagonal aperture.',
    motion: 'Front idle, walk, wave, jump and floor-sit; moving sleeve/skin/hands actual DOM order and cuff occlusion pixels, independent of fit metadata.',
    exceptions: 'Tank has no cuff. Robe and space have original covered arms/gloves and are checked by curated-fitting instead.',
    limits: 'Automated raster and paint-order tests complement direct art review; they do not prove every animation frame or public deployment.'
  },
  fixtures: [], rows: [], sourceHashes: {}, sourceHashesAfter: {}, servedHashes: {}, screenshots: [], errors: [], missingResources: [],
  toolHash: hash(fs.readFileSync(__filename)), fixtureHash: hash(fs.readFileSync(path.join(__dirname, 'sleeve-aperture-fixtures.json')))
};
fs.mkdirSync(output, { recursive: true });
let browser, page;
function save() {
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

async function probeFixture({ entry, geometry, states, thresholds }) {
  const NS = 'http://www.w3.org/2000/svg', host = document.querySelector('#sleeve-insertion-host');
  const drawables = 'path,ellipse,rect,image,polygon,line,polyline,circle';
  const result = [];
  const point = (matrix, p) => [matrix.a * p[0] + matrix.c * p[1] + matrix.e,
    matrix.b * p[0] + matrix.d * p[1] + matrix.f];
  const follows = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));

  async function pixels(svg, selector, excludeHands = false) {
    const clone = svg.cloneNode(true), selected = selector ? new Set(clone.querySelectorAll(selector)) : null;
    for (const leaf of clone.querySelectorAll(drawables)) {
      if (leaf.closest('defs')) continue;
      if (excludeHands && leaf.closest('.qpx-hand-left,.qpx-hand-right')) { leaf.remove(); continue; }
      if (selected) {
        let keep = false;
        for (let n = leaf; n && n !== clone; n = n.parentElement) if (selected.has(n)) { keep = true; break; }
        if (!keep) leaf.remove();
      }
    }
    const style = document.createElementNS(NS, 'style');
    style.textContent = '*{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}';
    clone.prepend(style);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    return { width: c.width, height: c.height, view: svg.viewBox.baseVal ?
      [svg.viewBox.baseVal.x, svg.viewBox.baseVal.y, svg.viewBox.baseVal.width, svg.viewBox.baseVal.height] : [0, 0, 32, 62],
      data: ctx.getImageData(0, 0, c.width, c.height).data };
  }
  function sample(image, p) {
    const x = Math.floor((p[0] - image.view[0]) * image.width / image.view[2]);
    const y = Math.floor((p[1] - image.view[1]) * image.height / image.view[3]);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return [0, 0, 0, 0];
    const i = (y * image.width + x) * 4; return image.data.slice(i, i + 4);
  }
  function opening(nested, sleeve, svg) {
    const local = sleeve.endpointsSourcePixels.map(p => [p[0] - geometry.sourceRect[0], p[1] - geometry.sourceRect[1]]);
    const matrix = svg.getCTM().inverse().multiply(nested.getCTM());
    const [a, b] = local.map(p => point(matrix, p));
    const dx = b[0] - a[0], dy = b[1] - a[1], width = Math.hypot(dx, dy);
    // The native left/right endpoint order fixes the outward normal even when
    // a gesture rotates the aperture above the shoulder.
    const localRig = local.map(p => [geometry.target[0] + geometry.target[2] * p[0] / geometry.sourceRect[2],
      geometry.target[1] + geometry.target[3] * p[1] / geometry.sourceRect[3]]);
    const ldx = localRig[1][0] - localRig[0][0], ldy = localRig[1][1] - localRig[0][1];
    let sign = 1; if (ldx < 0) sign = -1;
    const normal = [-dy / width * sign, dx / width * sign];
    const bodyScale = Math.hypot(matrix.c * geometry.sourceRect[3] / geometry.target[3],
      matrix.d * geometry.sourceRect[3] / geometry.target[3]);
    return { a, b, normal, width, bodyScale };
  }
  function line(mask, edge, depth) {
    const probes = [];
    for (let i = 0; i <= 40; i++) {
      const t = .1 + .8 * i / 40, p = [edge.a[0] * (1 - t) + edge.b[0] * t + edge.normal[0] * depth * edge.bodyScale,
        edge.a[1] * (1 - t) + edge.b[1] * t + edge.normal[1] * depth * edge.bodyScale];
      probes.push({ t, point: p, alpha: sample(mask, p)[3] });
    }
    const filled = probes.filter(p => p.alpha >= thresholds.alpha);
    return { depth, filled: filled.length, total: probes.length, coverage: filled.length / probes.length,
      width: filled.length ? edge.width * (Math.max(...filled.map(p => p.t)) - Math.min(...filled.map(p => p.t))) : 0,
      centre: filled.length ? filled.reduce((sum, p) => [sum[0] + p.point[0] / filled.length, sum[1] + p.point[1] / filled.length], [0, 0]) : null };
  }
  function occlusion(cloth, skin, full, edge) {
    let checked = 0, overpainted = 0, maxDelta = 0;
    for (const depth of [-.1, -.25, -.4, -.7]) for (let i = 0; i <= 40; i++) {
      const t = .1 + .8 * i / 40, p = [edge.a[0] * (1 - t) + edge.b[0] * t + edge.normal[0] * depth * edge.bodyScale,
        edge.a[1] * (1 - t) + edge.b[1] * t + edge.normal[1] * depth * edge.bodyScale];
      const c = sample(cloth, p), s = sample(skin, p), f = sample(full, p);
      if (c[3] < thresholds.opaqueClothAlpha || s[3] < thresholds.alpha) continue;
      const delta = Math.max(...[0, 1, 2].map(k => Math.abs(f[k] - c[k])));
      checked++; maxDelta = Math.max(maxDelta, delta); if (delta > thresholds.maximumColourDelta) overpainted++;
    }
    return { checked, overpainted, maxDelta, pass: checked > 0 && overpainted === 0 };
  }
  function cloneLayers(svg) {
    const records = [], mesh=svg.querySelector('[data-qpx-continuous-cloth]'), active=mesh&&getComputedStyle(mesh.parentNode).display!=='none';
    if(active){const skins=[...svg.querySelectorAll('[data-qpx-gesture-skin]')],hands=[...svg.querySelectorAll('[data-qpx-cloth-hand]')];records.push({pipeline:'continuous-cloth',skinBeforeSleeve:skins.length>0&&skins.every(s=>follows(s,mesh)),sleeveBeforeHands:hands.length===2&&hands.every(h=>follows(mesh,h))});return{records,pass:records.every(r=>r.skinBeforeSleeve&&r.sleeveBeforeHands)};}
    for (const carrier of svg.querySelectorAll('[data-qpx-gesture-arm]')) {
      if (getComputedStyle(carrier).display === 'none') continue;
      for (const art of carrier.querySelectorAll('[data-qpx-gesture-art="front"]')) {
        const skins = [...art.querySelectorAll('[data-qpx-gesture-skin]')];
        const sleeve = art.querySelector('[data-qpx-wave-sleeve]');
        const hands = [...art.querySelectorAll('.qpx-hand-left,.qpx-hand-right')];
        records.push({ side: carrier.dataset.qpxGestureArm, skinGroups: skins.length, sleeve: Boolean(sleeve), hands: hands.length,
          skinBeforeSleeve: skins.length > 0 && skins.every(s => follows(s, sleeve)),
          sleeveBeforeHands: Boolean(sleeve) && hands.length > 0 && hands.every(h => follows(sleeve, h)) });
      }
    }
    return { records, pass: records.every(r => r.skinBeforeSleeve && r.sleeveBeforeHands) };
  }

  for (const sk of [0, 4]) for (const state of states) {
    host.innerHTML = QPAvatar.render({ ...entry.av, sk }, 620, 3);
    const svg = host.firstElementChild;
    if (state.pose) QPAvatarPose.apply(svg, { ...state.pose, now: 2000 });
    const [cloth, skinLeft, skinRight, full] = await Promise.all([
      pixels(svg, '[data-qpx-clothes="top"],[data-qpx-wave-sleeve],[data-qpx-continuous-cloth]'),
      pixels(svg, '.qpx-arm-left,.qpx-arm-front-left,[data-qpx-gesture-skin="left"]', true),
      pixels(svg, '.qpx-arm-right,.qpx-arm-front-right,[data-qpx-gesture-skin="right"]', true), pixels(svg)
    ]);
    const mesh=svg.querySelector('[data-qpx-continuous-cloth]'), continuous=Boolean(mesh&&getComputedStyle(mesh.parentNode).display!=='none');
    const composite=continuous?await pixels(svg,'[data-qpx-continuous-cloth],[data-qpx-gesture-skin],[data-qpx-gesture-hand],[data-qpx-cloth-hand]'):full;
    const layer = cloneLayers(svg), row = { id: geometry.id, sk, state: state.id,
      pose: svg.dataset.qpxPose || 'native', view: svg.dataset.qpxView || 'front', layer, sides: [] };
    for (const sleeve of geometry.sleeves) {
      const skin = sleeve.side === 'left' ? skinLeft : skinRight;
      const carrier = svg.querySelector('[data-qpx-gesture-arm="' + sleeve.side + '"]');
      const moving = carrier && getComputedStyle(carrier).display !== 'none';
      let nodes = moving ? [...carrier.querySelectorAll('[data-qpx-gesture-art="front"] [data-qpx-clothes="top"] > .qpc-garment > svg')] : [];
      if (!nodes.length) nodes = [...svg.querySelectorAll('.qpx-body [data-qpx-clothes="top"] > .qpc-garment > svg')];
      // The authored tee cuff belongs to the upper arm; the hood cuff is on
      // the forearm. Old cloned art contained both, but the new owned texture
      // has one aperture. Never choose a phantom lower tee cuff by alpha score.
      if(continuous&&moving)nodes=nodes.filter(n=>Boolean(n.closest('[data-qpx-pose-part$="gesture-forearm"]'))===geometry.id.endsWith('/hood'));
      const candidates = nodes.map(nested => {
        const edge = opening(nested, sleeve, svg);
        return { edge, clothScore: line(cloth, edge, -.4).coverage,
          inner035: line(skin, edge, -.35), inner070: line(skin, edge, -.7), outer035: line(skin, edge, .35),
          occlusion: occlusion(cloth, skin, composite, edge) };
      }).sort((a, b) => b.clothScore - a.clothScore || b.inner035.coverage - a.inner035.coverage);
      const best = candidates[0];
      if (moving && !continuous) {
        // A bent forearm can legitimately pass in front of its own upper
        // sleeve, and a raised hand can pass in front of the head. Compare
        // skin/clothes paint inside each real articulated copy instead of
        // treating those distinct, overlapping limbs as a cuff-order error.
        const pieces = [];
        for (const [at, nested] of nodes.entries()) {
          const art = nested.closest('[data-qpx-gesture-art="front"]');
          if (!art) continue;
          const marker = sleeve.side + '-' + at; art.dataset.qaSleevePart = marker;
          const selector = '[data-qa-sleeve-part="' + marker + '"]';
          const [pieceCloth, pieceSkin, pieceFull] = await Promise.all([
            pixels(svg, selector + ' [data-qpx-wave-sleeve]'),
            pixels(svg, selector + ' [data-qpx-gesture-skin]', true), pixels(svg, selector)
          ]);
          pieces.push({ piece: marker, ...occlusion(pieceCloth, pieceSkin, pieceFull, opening(nested, sleeve, svg)) });
        }
        const checked = pieces.filter(p => p.checked > 0);
        if (best) best.occlusion = { pieces, checked: checked.reduce((n, p) => n + p.checked, 0),
          overpainted: checked.reduce((n, p) => n + p.overpainted, 0),
          maxDelta: Math.max(0, ...checked.map(p => p.maxDelta)), pass: checked.length > 0 && checked.every(p => p.pass) };
      }
      const staticPass = best && best.inner035.coverage >= thresholds.rootCoverageAt035In &&
        best.inner070.coverage >= thresholds.rootCoverageAt070In && best.outer035.coverage >= thresholds.emergingCoverageAt035Out;
      row.sides.push({ side: sleeve.side, moving: Boolean(moving), candidates: candidates.length, ...best,
        broadInsertion: Boolean(staticPass), pass: Boolean(best && staticPass && best.occlusion.pass) });
    }
    row.pass = row.layer.pass && row.sides.length === 2 && row.sides.every(side => side.pass);
    result.push(row);
  }
  return result;
}

(async () => {
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.QUIZ_BROWSER_EXECUTABLE || undefined });
    const context = await browser.newContext({ viewport: { width: 1550, height: 900 } });
    await context.route('**/www.gstatic.com/firebasejs/**', r => r.fulfill({ body: '/* isolated sleeve insertion QA */', contentType: 'text/javascript' }));
    for (const route of ['**/*firebaseio.com/**', '**/*firebasedatabase.app/**', '**/firestore.googleapis.com/**']) await context.route(route, r => r.abort());
    if (override) for (const file of ['avatar-pixel.js', 'avatar-clothes.js', 'avatar-poses.js']) {
      const bytes = fs.readFileSync(path.join(override, file));
      await context.route('**/' + file, r => r.fulfill({ body: bytes, contentType: 'text/javascript' }));
    }
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin) report.missingResources.push({ url: r.url(), status: r.status() }); });
    const url = new URL(base); url.searchParams.set('demo', '1'); url.searchParams.set('session', 'sleeve-insertion-' + Date.now());
    await page.goto(url.href);
    await page.waitForFunction(() => window.QPGame?.getMe() && QPAvatar.atlas.ready && QPClothes.atlas.ready && QPAvatarDirection.atlas.ready && QPShoes.atlas.partsReady && (!window.QPClothMesh||QPClothMesh.atlas.ready));
    report.phase = 'fingerprint';
    for (const file of fingerprints) {
      const response = await context.request.get(new URL(file, url).href); assert(response.ok(), 'Missing ' + file);
      const bytes = override && ['avatar-pixel.js', 'avatar-clothes.js', 'avatar-poses.js'].includes(file) ? fs.readFileSync(path.join(override, file)) : await response.body();
      report.servedHashes[file] = hash(bytes); report.sourceHashes[file] = hash(fs.readFileSync(path.join(root, file)));
    }
    for (const [file, expected] of Object.entries(aperture.provenance.sourceHashes)) assert.equal(report.servedHashes[file], expected, 'Original aperture fixture source changed: ' + file);
    const fixtures = await page.evaluate(() => {
      QPGame.go('home'); const catalog = QPGame.getCatalog(), source = QPGame.getMe().av;
      const clean = { ...source, sk: 0, expression: 'bright:0', shoes: 'sneaker:8', hat: '', glass: '', ear: '', neck: '', face: '', back: '', effect: '', pet: '', bg: '', frame: '', outfit: '' };
      const rows = [];
      for (const sex of ['m', 'f']) for (const category of ['top', 'outfit']) for (const item of catalog.publicItems(category, sex)) {
        const av = { ...clean, sex, hair: sex === 'm' ? 'part:1' : 'bob:1', bottom: sex === 'm' ? 'jeans:5' : 'shorts:5' };
        if (category === 'outfit') { Object.assign(av, catalog.OUTFIT_PARTS[item.shape][sex]); av.outfit = item.shape + ':' + item.ci; } else av.top = item.shape + ':' + item.ci;
        const shape = av.top.split(':')[0];
        if (!['tank', 'robe', 'space'].includes(shape)) rows.push({ id: sex + '/' + shape, av, category, name: item.short });
      }
      document.head.insertAdjacentHTML('beforeend', '<style>html,body{height:auto!important;overflow:visible!important;display:block!important;background:#fff8ec}.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}</style>');
      document.body.innerHTML = '<main id="sleeve-insertion-host"></main>'; return rows;
    });
    report.fixtures = fixtures.filter(f => !focus || f.id === focus);
    if (!focus) assert.deepEqual(report.fixtures.map(f => f.id).sort(), aperture.rows.map(f => f.id).sort(), 'Public sleeved wardrobe changed.');
    for (const entry of report.fixtures) {
      const geometry = aperture.rows.find(g => g.id === entry.id); assert(geometry, 'No independent aperture for ' + entry.id);
      const info = await page.evaluate(av => QPClothes.inspect('top', av.top.split(':')[0], av.sex), entry.av);
      assert.deepEqual(info.sourceRect, geometry.sourceRect, 'Original crop moved: ' + entry.id);
      assert.deepEqual(info.target, geometry.target, 'Original garment anchor moved: ' + entry.id);
      report.phase = 'raster/' + entry.id;
      report.rows.push(...await page.evaluate(probeFixture, { entry, geometry, states, thresholds: report.thresholds })); save();
    }
    if (screenshots) {
      for (const sex of ['m', 'f']) for (const sk of [0, 4]) {
        const entries = report.fixtures.filter(f => f.av.sex === sex); if (!entries.length) continue;
        await page.evaluate(({ entries, sk }) => {
          const host = document.querySelector('#sleeve-insertion-host'); host.replaceChildren();
          host.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:12px';
          for (const entry of entries) {
            const card = document.createElement('article'); card.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:#fffaf2;border:1px solid #c8b795';
            card.innerHTML = '<b style="font:16px sans-serif;margin:8px">' + entry.id + ' · skin ' + sk + '</b>' + QPAvatar.render({ ...entry.av, sk }, 224, 3) + QPAvatar.render({ ...entry.av, sk }, 96, 3); host.append(card);
          }
        }, { entries, sk });
        const file = sex + '-skin' + sk + '-front-224-96.png'; await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push(file);
      }
      for (const entry of report.fixtures) for (const sk of [0, 4]) {
        await page.evaluate(({ entry, sk, states }) => {
          const host = document.querySelector('#sleeve-insertion-host'); host.replaceChildren(); host.style.cssText = 'display:flex;gap:14px;padding:12px';
          for (const state of states) {
            const card = document.createElement('article'); card.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:#fffaf2;border:1px solid #c8b795';
            card.innerHTML = '<b style="font:15px sans-serif;margin:8px">' + entry.id + ' · ' + state.id + ' · ' + sk + '</b>' + QPAvatar.render({ ...entry.av, sk }, 224, 3) + QPAvatar.render({ ...entry.av, sk }, 96, 3); host.append(card);
            if (state.pose) card.querySelectorAll('svg.qp-illustrated-avatar').forEach(svg => QPAvatarPose.apply(svg, { ...state.pose, now: 2000 }));
          }
        }, { entry, sk, states });
        const file = entry.id.replace('/', '-') + '-skin' + sk + '-front-motion-224-96.png'; await page.screenshot({ path: path.join(output, file), fullPage: true }); report.screenshots.push(file);
      }
    }
    report.counts = { styles: report.fixtures.length, skins: 2, states: states.length, rows: report.rows.length, sleeveProbes: report.rows.length * 2,
      staticRows: report.rows.filter(r => r.state === 'native').length, movingCloneRows: report.rows.filter(r => r.layer.records.length).length };
    report.failures = report.rows.filter(r => !r.pass);
    for (const file of fingerprints) {
      report.sourceHashesAfter[file] = hash(fs.readFileSync(path.join(root, file)));
      assert.equal(report.sourceHashesAfter[file], report.sourceHashes[file], 'Source changed during QA: ' + file);
      if (!override) assert.equal(report.servedHashes[file], report.sourceHashes[file], 'Served build differs from source: ' + file);
    }
    assert.equal(report.failures.length, 0, 'Broad cuff insertion or sleeve-over-skin painting failed.');
    assert.equal(report.errors.length, 0, 'Unexpected browser errors.'); assert.equal(report.missingResources.length, 0, 'Missing runtime/art resource.');
    report.success = true; report.phase = 'completed';
  } catch (e) {
    report.failure = { message: e.message, stack: e.stack }; process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); save();
    console.log(JSON.stringify({ output, success: report.success, phase: report.phase, counts: report.counts, failures: report.failures?.length, error: report.failure?.message }));
  }
})();
