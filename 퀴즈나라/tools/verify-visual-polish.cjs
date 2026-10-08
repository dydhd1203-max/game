'use strict';
// Catches small visual slips before a person has to: candy titles overlapping
// plates or leaving their ribbon/sign, button labels overflowing, top-bar items
// colliding. Glyph ink is measured from the real font metrics (plus the candy
// outline), not from line boxes. Writes a JSON report and a 2x zoom sheet of
// every checked region for a human look.
//   QUIZ_PREVIEW_URL=http://127.0.0.1:4173/ node tools/verify-visual-polish.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const out = path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT || path.join(__dirname, '../검증/화면점검'));
const base = process.env.QUIZ_PREVIEW_URL || 'http://127.0.0.1:4173/';
const sizes = [[1366, 768], [1920, 1080], [1280, 720]];
fs.mkdirSync(out, { recursive: true });

// Ribbon faces measured on assets/forest-shop.png (fractions of the shop art).
const RIBBONS = {
  '.forest-shop-title': { x0: .125, x1: .345, y0: .025, y1: .125 },
  '.forest-shop-subtitle': { x0: .805, x1: .975, y0: .105, y1: .215 }
};

async function measure(page, screen) {
  return page.evaluate(({ screen, RIBBONS }) => {
    const ctx = document.createElement('canvas').getContext('2d');
    const rect = e => { const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
    const visible = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
    const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const union = rs => rs.reduce((u, r) => ({ x0: Math.min(u.x0, r.x0), y0: Math.min(u.y0, r.y0), x1: Math.max(u.x1, r.x1), y1: Math.max(u.y1, r.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    // Ink box of one candy glyph: font metrics + outline half-width + drop below.
    function ink(i) {
      const s = getComputedStyle(i), size = parseFloat(s.fontSize), lh = parseFloat(s.lineHeight) || size * 1.2;
      ctx.font = s.fontWeight + ' ' + size + 'px ' + s.fontFamily;
      const m = ctx.measureText(i.textContent), r = i.getBoundingClientRect();
      const half = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
      const baseline = r.top + half + m.fontBoundingBoxAscent;
      const line = parseFloat(getComputedStyle(i.parentElement.closest('.qp-candy')).getPropertyValue('--ct-line')) || .17;
      const rim = size * line / 2;
      return { x0: r.left + (r.width - m.width) / 2 - m.actualBoundingBoxLeft - rim, x1: r.left + (r.width - m.width) / 2 + m.actualBoundingBoxRight + rim,
        y0: baseline - m.actualBoundingBoxAscent - rim, y1: baseline + m.actualBoundingBoxDescent + rim + size * .1 };
    }
    const findings = [], regions = [];
    for (const candy of document.querySelectorAll('.qp-candy')) {
      if (!visible(candy)) continue;
      const glyphs = [...candy.querySelectorAll('.ct-l > i')].map(ink), word = union(glyphs);
      const name = candy.closest('[class]') && (candy.parentElement.className || candy.parentElement.tagName);
      regions.push({ name: 'candy:' + candy.querySelector('.ct-sr').textContent, box: word });
      const brand = candy.closest('.quiz-brand');
      if (brand) {
        const plate = brand.querySelector('.quiz-brand-class'), box = rect(brand);
        const hit = glyphs.reduce((a, g) => a + overlap(g, rect(plate)), 0);
        if (hit > 1) findings.push({ screen, type: 'overlap', what: 'QUIZ나라 글자와 반 명판', area: Math.round(hit) });
        if (word.x0 < box.x0 - 1 || word.x1 > box.x1 + 1) findings.push({ screen, type: 'overflow', what: '로고 글자가 간판 밖', word, box });
      }
      for (const [selector, f] of Object.entries(RIBBONS)) {
        const host = candy.closest(selector); if (!host) continue;
        const shop = rect(host.closest('.starlight-shop')), w = shop.x1 - shop.x0, h = shop.y1 - shop.y0;
        const face = { x0: shop.x0 + f.x0 * w, x1: shop.x0 + f.x1 * w, y0: shop.y0 + f.y0 * h, y1: shop.y0 + f.y1 * h };
        regions.push({ name: 'ribbon:' + selector, box: face });
        if (word.x0 < face.x0 - 2 || word.x1 > face.x1 + 2 || word.y0 < face.y0 - 4 || word.y1 > face.y1 + 4) findings.push({ screen, type: 'off-ribbon', what: selector, word, face });
        const off = Math.abs((word.x0 + word.x1) / 2 - (face.x0 + face.x1) / 2) / (face.x1 - face.x0);
        if (off > .06) findings.push({ screen, type: 'off-centre', what: selector, offset: +off.toFixed(3) });
      }
      const sign = candy.closest('.sr-room-title');
      if (sign) { const b = rect(sign); if (word.x0 < b.x0 || word.x1 > b.x1 || word.y0 < b.y0 - 2) findings.push({ screen, type: 'overflow', what: '마을 이름 간판', word, box: b }); }
    }
    const buttons = [...document.querySelectorAll('button, .btn')].filter(visible).filter(b => !b.closest('.ct-w, .qp-demo-toolbar'));
    for (const b of buttons) {
      if (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2) {
        const label = (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20);
        if (label) findings.push({ screen, type: 'label-overflow', what: label, scroll: [b.scrollWidth, b.scrollHeight], client: [b.clientWidth, b.clientHeight] });
      }
    }
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i], c = buttons[j];
      if (a.contains(c) || c.contains(a)) continue;
      const area = overlap(rect(a), rect(c));
      if (area > 4) findings.push({ screen, type: 'button-overlap', what: [(a.textContent || a.id).trim().slice(0, 14), (c.textContent || c.id).trim().slice(0, 14)], area: Math.round(area) });
    }
    const top = document.querySelector('.top');
    if (top && visible(top)) {
      const items = [...top.children].filter(visible).filter(e => !e.classList.contains('f1'));
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const area = overlap(rect(items[i]), rect(items[j]));
        if (area > 4) findings.push({ screen, type: 'topbar-overlap', what: [items[i].className || items[i].id, items[j].className || items[j].id], area: Math.round(area) });
      }
      regions.push({ name: 'topbar', box: rect(top) });
    }
    return { findings, regions, buttons: buttons.length };
  }, { screen, RIBBONS });
}

(async () => {
  const browser = await chromium.launch();
  const report = { base, screens: [], findings: [], errors: [] };
  const crops = [];
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      await page.route('**/*', r => { const u = new URL(r.request().url()); return ['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? r.continue() : r.fulfill({ body: '' }); });
      page.on('pageerror', e => report.errors.push(e.message));
      const url = new URL(base); url.searchParams.set('demo', '1'); url.searchParams.set('session', 'polish-' + Date.now());
      await page.goto(url.href);
      await page.waitForFunction(() => window.QPGame?.getMe() && window.QPAvatar?.atlas.ready, null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      for (const screen of ['login', 'village', 'shop', 'quizquiz']) {
        await page.evaluate(s => QPGame.go(s), screen);
        await page.waitForTimeout(1200);
        const hide = page.locator('.qp-demo-toolbar [data-hide]');
        if (await hide.count() && await hide.isVisible()) await hide.click().catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        const tag = screen + '-' + width;
        const result = await measure(page, tag);
        report.screens.push({ screen: tag, buttons: result.buttons, regions: result.regions.length });
        report.findings.push(...result.findings);
        const shot = path.join(out, tag + '.png');
        await page.screenshot({ path: shot });
        if (width === 1366) for (const r of result.regions) crops.push({ shot, name: tag + ' ' + r.name, box: r.box });
      }
      await page.close();
    }
  } finally { await browser.close(); }
  // 2x zoom sheet of every checked region at laptop size.
  try {
    const sharp = require('sharp'); const tiles = [];
    for (const c of crops) {
      const pad = 10, left = Math.max(0, Math.floor(c.box.x0 - pad)), top = Math.max(0, Math.floor(c.box.y0 - pad));
      const meta = await sharp(c.shot).metadata();
      const w = Math.min(meta.width - left, Math.ceil(c.box.x1 - c.box.x0 + pad * 2)), h = Math.min(meta.height - top, Math.ceil(c.box.y1 - c.box.y0 + pad * 2));
      if (w < 4 || h < 4) continue;
      const scale = Math.min(2, 1300 / w);
      tiles.push(await sharp(c.shot).extract({ left, top, width: w, height: h }).resize(Math.round(w * scale), Math.round(h * scale)).png().toBuffer());
    }
    let y = 0; const parts = [];
    for (const t of tiles) { const m = await sharp(t).metadata(); parts.push({ input: t, left: 0, top: y }); y += m.height + 8; }
    if (parts.length) await sharp({ create: { width: 1300, height: y, channels: 3, background: '#222' } }).composite(parts).png().toFile(path.join(out, '확대-모음.png'));
  } catch (e) { report.errors.push('zoom sheet: ' + e.message); }
  report.success = !report.findings.length && !report.errors.length;
  fs.writeFileSync(path.join(out, '화면점검.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, findings: report.findings, errors: report.errors }, null, 1));
  if (!report.success) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
