"""Hat pipeline: fit each template figure's head (owner 'head' mask of the
garment template) onto the game's default head rendered by
measure-hat-frame.cjs (best IoU over scale 0.9-1.9 game px per sheet px and
shift, FFT correlation), and write tools/fixtures/hat-frame.json.

  python3 -B tools/hair/fit-hat-frame.py DIR   (DIR: measure-hat-frame.cjs output)
"""
import os
import sys, json
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.dont_write_bytecode = True
from avatar_build import register as R
S = sys.argv[1].rstrip('/') + '/'
spec = R.garment_spec('hat', ('m', 'f'))
meta = json.load(open(S + 'heads.json'))
img = np.asarray(Image.open(S + 'heads.png').convert('RGB')).astype(int)
bg = img[5, 5]
out = {}
for k, b in zip(meta['keys'], meta['boxes']):
    ppu = b['w'] / 32.0
    # game head silhouette in vb units grid (1/ppu units per px), rows above the collar
    x0, y0 = int(round(b['x'])), int(round(b['y']))
    gh = int(28.0 * ppu)
    crop = img[max(0, y0):y0 + gh, x0:x0 + int(b['w'])]
    gm = (np.abs(crop - bg).sum(-1) > 30).astype(np.float32)
    oy = max(0, y0) - y0  # px rows cut above the page
    # template head mask (sheet px)
    cx0, cy0, cx1, cy1 = spec['cells'][k]
    tm = (spec['owner'][cy0:cy1, cx0:cx1] == 8)
    ys, xs = np.nonzero(tm)
    tm = tm[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    best = None
    for s in np.arange(0.9, 1.9, 0.01):   # game px per sheet px
        th, tw = int(round(tm.shape[0] * s)), int(round(tm.shape[1] * s))
        if th >= gm.shape[0] + 200 or tw >= gm.shape[1] + 200: continue
        t = np.asarray(Image.fromarray((tm * 255).astype(np.uint8)).resize((tw, th), Image.BILINEAR)) / 255.0
        H, W = gm.shape[0] + th, gm.shape[1] + tw
        F = np.fft.rfft2(gm * 2 - 1, (H, W)) * np.conj(np.fft.rfft2(t * 2 - 1, (H, W)))
        # only overlap where t is: use (2g-1)(2t-1) correlation
        c = np.fft.irfft2(F, (H, W))
        i = np.unravel_index(np.argmax(c), c.shape)
        dy, dx = i
        if dy > H // 2: dy -= H
        if dx > W // 2: dx -= W
        # IoU at that placement
        G = np.zeros((gm.shape[0] + 2 * th, gm.shape[1] + 2 * tw)); G[th:th + gm.shape[0], tw:tw + gm.shape[1]] = gm
        T = np.zeros_like(G); yy, xx = th + dy, tw + dx
        if yy < 0 or xx < 0 or yy + th > T.shape[0] or xx + tw > T.shape[1]: continue
        T[yy:yy + th, xx:xx + tw] = t
        iou = (np.minimum(G, T).sum()) / max(1, np.maximum(G, T).sum())
        if best is None or iou > best[0]:
            best = (iou, s, dx, dy)
    iou, s, dx, dy = best
    # sheet px p -> game screen px: (p - tmin)*s + (dx, dy) in crop coords; -> vb units
    sx = s / ppu  # vb units per sheet px
    ox = (dx) / ppu - xs.min() * sx      # vb x of cell px 0
    oy_ = (dy + (max(0, y0) - y0)) / ppu - ys.min() * sx  # vb y of cell px 0 (the crop starts at the page top)
    out[k] = dict(iou=round(float(iou), 4), unitsPerSheetPx=round(float(sx), 6), cellOrigin=[round(float(ox), 3), round(float(oy_), 3)])
    print(k, out[k])
hf = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-frame.json')))
fx = {"about": "Template head -> game head of each template figure (hat pipeline, 2026-10-15). sheet px p of the template (SHEET space) maps to head-native units of that view: hn = (cellOrigin + (p - cell0) * unitsPerSheetPx - toViewBox[4:6]) / toViewBox[0]. cellOrigin/unitsPerSheetPx: the template head mask (owner head) fitted onto the game's default head (m short:1, f bob:1, idle/0) rendered at 620 px, best IoU over scale and shift (tools/hair/measure-hat-frame.cjs + fit-hat-frame.py); toViewBox from tools/fixtures/head-frame.json. Generated; do not edit.", "figures": {}}
for k, v in out.items():
    sex, vw = k.split('-')
    fx['figures'][k] = dict(v, toViewBox=hf[sex][vw]['frame']['toViewBox'])
json.dump(fx, open(os.path.join(ROOT, 'tools', 'fixtures', 'hat-frame.json'), 'w'), indent=1)
