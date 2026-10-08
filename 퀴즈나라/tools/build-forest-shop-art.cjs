'use strict';
// Recolours the approved starlight shop art into the forest-village palette.
// The wood frame, parchment, leaves, flowers, lanterns and gold trim keep their
// original pixels; only the purple/pink regions move to forest hues.
// Run from 퀴즈나라/: node tools/build-forest-shop-art.cjs  (needs the `sharp` module)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function toRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l, l, l].map(v => Math.round(v * 255));
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
}
const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Smooth 0..1 weight inside a hue band so edges of the band blend instead of banding.
function band(h, from, to, feather = 8) {
  if (h < from - feather || h > to + feather) return 0;
  if (h < from) return (h - from + feather) / feather;
  if (h > to) return (to + feather - h) / feather;
  return 1;
}

// Regions measured on the 1828×860 starlight background.
const BG = {
  ribbons: [[205, 8, 660, 118], [1465, 92, 1785, 188]],
  room: [18, 88, 540, 640],
  stage: [70, 628, 515, 818],
  chair: [30, 440, 205, 650],
  // Upper curtain folds whose glossy highlights are as vivid as the flowers.
  curtains: [[30, 95, 180, 300], [410, 95, 525, 440]]
};

// Painted flowers are vivid and light (s > .85, l > .64); curtains, clouds and
// lantern halos in the same hue range are duller, so this test keeps only flowers pink.
const isFlower = (h, s, l) => s > .85 && l > .64 && (h >= 300 || h <= 12);

function recolorBackground(x, y, h, s, l) {
  if (s < .05) return null;
  if (BG.ribbons.some(b => inBox(x, y, b))) {
    const w = band(h, 240, 335);
    // Moss ribbon: keeps the painted highlights and gold trim (trim is outside the band).
    return w ? [100, clamp(s * .78, 0, .7), clamp(l * .92, 0, 1), w] : null;
  }
  if (inBox(x, y, BG.stage)) {
    const top = band(h, 300, 345) * (l > .7 ? 1 : 0), side = band(h, 270, 340) * (l <= .7 ? 1 : 0);
    if (top) return [92, clamp(s * .5, 0, .55), clamp(l * .93, 0, 1), top];       // mossy stump top
    if (side) return [28, clamp(s * .72, 0, .62), clamp(l * .74, 0, 1), side];     // bark side
    if (isFlower(h, s, l)) return null;
    const sky = band(h, 222, 300);
    return sky ? [158, clamp(s * .62, 0, .5), clamp(l * .9, 0, 1), sky] : null;
  }
  if (inBox(x, y, BG.room)) {
    const chair = inBox(x, y, BG.chair) ? band(h, 290, 345, 4) : 0;
    if (chair) return [104, clamp(s * .6, 0, .6), clamp(l * .9, 0, 1), chair];     // green velvet chair
    if (isFlower(h, s, l) && !BG.curtains.some(b => inBox(x, y, b))) return null;
    const warm = band(h, 280, 352, 6);
    if (warm) return l < .55
      ? [138, clamp(s * .8, 0, .62), clamp(l * 1.02, 0, 1), warm]                 // forest velvet curtain
      : [96, clamp(s * .75, 0, .4), clamp(l * .97, 0, 1), warm];                  // sage wall stripes
    const cool = band(h, 222, 280);
    if (cool) return [165, clamp(s * .55, 0, .55), clamp(l, 0, 1), cool];          // mirror and sky glints
    return null;
  }
  // Outside the frame: night sky and its magenta clouds become a deep forest dusk;
  // stars stay gold as fireflies and vine flowers keep their colour.
  if (isFlower(h, s, l)) return null;
  const sky = band(h, 222, 352, 6);
  return sky ? [160 - (clamp(h, 225, 300) - 225) * .28, clamp(s * .62, 0, .5), clamp(l * .88, 0, 1), sky] : null;
}

// Button sheet slices (1536×1024), see assets/starlight-shop.json.
const SLICE = { pink: [805, 65, 1493, 212], purple: [804, 274, 1492, 424], close: [271, 731, 520, 980] };
function recolorButtons(x, y, h, s, l) {
  if (s < .08) return null;
  if (inBox(x, y, SLICE.pink) || inBox(x, y, SLICE.close)) {
    const w = band(h, 290, 360, 10) || band(h, 0, 8, 6);
    // Toadstool red for back/close.
    return w ? [6, clamp(s * .82, 0, .78), clamp(l * .9, 0, 1), w] : null;
  }
  if (inBox(x, y, SLICE.purple)) {
    const w = band(h, 250, 330, 10);
    // Jade for the selected category.
    return w ? [172, clamp(s * .72, 0, .66), clamp(l * .8, 0, 1), w] : null;
  }
  return null;
}

async function recolor(src, dst, fn) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let changed = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (!data[i + 3]) continue;
    const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
    const out = fn(x, y, h, s, l);
    if (!out) continue;
    const [th, ts, tl, w] = out, rgb = toRgb(th, ts, tl);
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - w) + rgb[c] * w);
    changed++;
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9, palette: false }).toFile(dst);
  return { changed, total: info.width * info.height };
}

(async () => {
  const jobs = [
    ['assets/starlight-shop.png', 'assets/forest-shop.png', recolorBackground],
    ['assets/starlight-shop-buttons.png', 'assets/forest-shop-buttons.png', recolorButtons]
  ];
  const record = JSON.parse(fs.readFileSync(path.join(root, 'assets/starlight-shop.json'), 'utf8'));
  const outputs = [];
  for (const [src, dst, fn] of jobs) {
    const stats = await recolor(path.join(root, src), path.join(root, dst), fn);
    outputs.push({ path: dst, from: src, sourceSha256: sha(path.join(root, src)), sha256: sha(path.join(root, dst)), changedPixels: stats.changed, totalPixels: stats.total });
  }
  fs.writeFileSync(path.join(root, 'assets/forest-shop.json'), JSON.stringify({
    date: '2026-10-08',
    request: '사용자 요청: 보라색 별빛 상점을 숲 컨셉 색으로 변경',
    method: 'tools/build-forest-shop-art.cjs가 별빛 원화의 보라·분홍 영역만 구역별 색상 변환. 나무 틀·양피지·잎·꽃·등불·금색 테두리 픽셀은 그대로 둔다. 새 그림을 생성하지 않았다.',
    palette: { ribbon: 'moss 100°', curtain: 'forest velvet 138°', wall: 'sage 96°', stageTop: 'moss 92°', stageSide: 'bark 28°', sky: 'forest dusk 140–160°', back: 'toadstool red 6°', selected: 'jade 172°' },
    regions: { background: BG, buttons: SLICE },
    slices: record.slices,
    outputs
  }, null, 2) + '\n');
  console.log(JSON.stringify(outputs, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
