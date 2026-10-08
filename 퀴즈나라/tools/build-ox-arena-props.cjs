'use strict';
// Cuts painted flower clumps, grass tufts and mossy rocks out of the supplied
// grass-library sheets (flat grey backgrounds) into one transparent atlas for
// the Survival OX arena rim. Source pixels are kept; only the grey background
// becomes transparent. Run from 퀴즈나라/: node tools/build-ox-arena-props.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const SRC = 'assets/grass-library/originals/';
const OUT = 'assets/ox-arena';
// sheet file → kind; picks are the largest clean sprites on each sheet.
const SHEETS = [
  ['grass-04a100cf56f96f38.jpg', 'flower', 4],
  ['grass-3adcd041', 'daisy', 3],
  ['grass-35b4bd', 'redflower', 3],
  ['grass-e9e7ca', 'rock', 3],
  ['grass-a80d4f', 'rock', 2],
  ['grass-478a34', 'tuft', 3],
  ['grass-f2c32b', 'bush', 3],
  ['grass-2cb94b', 'clover', 3],
  // Broad-leaf bushes for the scene's leafy frame (appended so earlier ids stay stable).
  ['grass-6a0d44', 'leafbush', 2, .62],
  ['grass-764f53', 'leafbush', 2, .62],
  ['grass-e58fec', 'leafbush', 3, .62],
  ['grass-13d83f', 'roundbush', 4],
  ['grass-35abc9', 'orangeflower', 2],
  ['grass-d5818d', 'yellowflower', 3]
];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

async function cut(file, kind, take, maxH = .4) {
  const img = sharp(path.join(root, SRC, file));
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const at = (x, y) => (y * W + x) * 4;
  // Background colour from the four corners (avoid the watermark corner).
  const samples = [[W >> 1, H - 4], [W >> 1, H >> 1], [4, H >> 1], [W - 4, H >> 1]].map(([x, y]) => [0, 1, 2].map(c => data[at(x, y) + c]));
  const bg = [0, 1, 2].map(c => samples.reduce((s, v) => s + v[c], 0) / samples.length);
  const dist = i => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  const grey = i => { const r = data[i], g = data[i + 1], b = data[i + 2]; return Math.max(r, g, b) - Math.min(r, g, b) < 26; };
  const step = (i, j) => Math.hypot(data[i] - data[j], data[i + 1] - data[j + 1], data[i + 2] - data[j + 2]);
  // Flood the background from the borders: near-bg grey pixels connected to the edge.
  const isBg = new Uint8Array(N), stack = [];
  // Backgrounds are warm greys with gradients: grow through low-chroma pixels that change only a little.
  const push = (x, y, from) => { const p = y * W + x; if (isBg[p]) return; const i = p * 4; if (!grey(i)) return; if (from == null ? !(dist(i) < 60) : step(i, from * 4) > 7) return; isBg[p] = 1; stack.push(p); };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % W, y = (p / W) | 0; if (x > 0) push(x - 1, y, p); if (x < W - 1) push(x + 1, y, p); if (y > 0) push(x, y - 1, p); if (y < H - 1) push(x, y + 1, p); }
  // Soft-edge reference: the average background actually found.
  let n = 0; const acc = [0, 0, 0]; for (let p = 0; p < N; p += 7) if (isBg[p]) { n++; for (let c = 0; c < 3; c++) acc[c] += data[p * 4 + c]; }
  if (n) for (let c = 0; c < 3; c++) bg[c] = acc[c] / n;
  // Connected foreground components.
  const label = new Int32Array(N).fill(-1), comps = [];
  for (let p = 0; p < N; p++) {
    if (isBg[p] || label[p] >= 0) continue;
    const id = comps.length, c = { id, x0: W, y0: H, x1: 0, y1: 0, n: 0, edge: 0 }, q = [p]; label[p] = id;
    while (q.length) {
      const k = q.pop(), x = k % W, y = (k / W) | 0; c.n++; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c.edge++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx; if (isBg[np] || label[np] >= 0) continue; label[np] = id; q.push(np);
      }
    }
    comps.push(c);
  }
  // Clean sprites: big, not touching the frame, not in the title/watermark band.
  // A few pixels of grass may brush the sheet edge; sprites truly cut by it are skipped.
  const picks = comps.filter(c => c.n > 5000 && c.edge < 30 && c.y0 > H * .03 && c.y1 < H * .98 && (c.x1 - c.x0) < W * .8 && (c.y1 - c.y0) < H * maxH && (c.y1 - c.y0) > 90 && c.n / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) > .3)
    .sort((a, b) => b.n - a.n).slice(0, take);
  const sprites = [];
  for (const c of picks) {
    const pad = 2, x0 = Math.max(0, c.x0 - pad), y0 = Math.max(0, c.y0 - pad), w = Math.min(W, c.x1 + pad + 1) - x0, h = Math.min(H, c.y1 + pad + 1) - y0;
    const buf = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y0 + y) * W + (x0 + x), i = p * 4, o = (y * w + x) * 4;
      if (label[p] !== c.id) continue;
      // Soft edge: pixels close to the background colour fade out.
      const a = Math.max(0, Math.min(1, (dist(i) - 8) / 30));
      buf[o] = data[i]; buf[o + 1] = data[i + 1]; buf[o + 2] = data[i + 2]; buf[o + 3] = Math.round(255 * (grey(i) ? a : Math.max(a, .9)));
    }
    sprites.push({ kind, file, src: [x0, y0, w, h], png: await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(), w, h });
  }
  return sprites;
}

(async () => {
  const all = [];
  const files = fs.readdirSync(path.join(root, SRC));
  for (const [prefix, kind, take, maxH] of SHEETS) {
    const file = files.find(f => f.startsWith(prefix.replace(/\.jpg$/, '')));
    if (!file) { console.warn('missing sheet', prefix); continue; }
    all.push(...await cut(file, kind, take, maxH));
  }
  // Scale every sprite to ≤ 220px tall and pack in rows.
  const MAXH = 220, WIDTH = 1600, GAP = 4;
  let x = 0, y = 0, row = 0;
  const placed = [];
  for (const s of all) {
    const k = Math.min(1, MAXH / s.h), w = Math.round(s.w * k), h = Math.round(s.h * k);
    if (x + w > WIDTH) { x = 0; y += row + GAP; row = 0; }
    placed.push({ ...s, at: [x, y, w, h], img: await sharp(s.png).resize(w, h).png().toBuffer() });
    x += w + GAP; row = Math.max(row, h);
  }
  const HEIGHT = y + row;
  fs.mkdirSync(path.join(root, OUT), { recursive: true });
  const atlas = path.join(root, OUT, 'props.webp');
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(placed.map(p => ({ input: p.img, left: p.at[0], top: p.at[1] }))).webp({ quality: 88, alphaQuality: 90 }).toFile(atlas);
  const props = placed.map((p, i) => ({ id: p.kind + '-' + i, kind: p.kind, rect: p.at, source: { file: SRC + p.file, rect: p.src } }));
  fs.writeFileSync(path.join(root, OUT, 'props.json'), JSON.stringify({
    date: '2026-10-08', purpose: '서바이벌 OX 경기장 테두리 장식. 제공 grass-library 시트의 회색 배경만 투명하게 하고 원본 픽셀을 잘라 묶었다.',
    atlas: OUT + '/props.webp', size: [WIDTH, HEIGHT], sha256: sha(atlas),
    sources: [...new Set(placed.map(p => SRC + p.file))].map(f => ({ file: f, sha256: sha(path.join(root, f)) })), props
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'ox-arena-props.js'), '/* Generated by tools/build-ox-arena-props.cjs. Rects in assets/ox-arena/props.webp. */\nwindow.QPOxProps=' +
    JSON.stringify({ size: [WIDTH, HEIGHT], props: props.map(p => ({ id: p.id, kind: p.kind, r: p.rect })) }) + ';\n');
  console.log(placed.length, 'sprites', WIDTH + 'x' + HEIGHT, placed.map(p => p.kind + ':' + p.at[2] + 'x' + p.at[3]).join(' '));
})().catch(e => { console.error(e); process.exit(1); });
