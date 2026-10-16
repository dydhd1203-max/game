"""Synthetic check of the flat-hair hat cut (build-hat.py cut_flat, 2026-10-16) before a real sheet comes back.

  python3 -B tools/hair/verify-flat-hat.py [OUTDIR] [hat ids...]

For every hat drawn on the hat kit base (assets/garment-sources/hat-<shape>-chatgpt-2026-10-16.png), the hat is
cut the current way, laid over the flat-hair base (tools/fixtures/hat-base-flat) with its own alpha, and cut
again with cut_flat. Per figure: IoU of the two masks and the share of the new cut in the placeholder colour
(a magenta fringe). This checks the cutter only; whether ChatGPT keeps the placeholder is the pilot's question.
Four processes; writes OUTDIR/flat-check.json and a contact sheet of the new cuts on dark blue.
"""
import concurrent.futures as CF
import glob
import importlib.util
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BASE = os.path.join(ROOT, 'tools', 'fixtures', 'hat-base')
FLAT = os.path.join(ROOT, 'tools', 'fixtures', 'hat-base-flat')
IOU_MIN = .97     # a figure whose new cut differs more is reported
FRINGE_MAX = .01  # share of the new cut's opaque px in the placeholder colour


def load_bh():
    s = importlib.util.spec_from_file_location('build_hat', os.path.join(HERE, 'build-hat.py'))
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m


def masks(out, shape):
    rep = json.load(open(os.path.join(out, '모자.json'), encoding='utf-8'))
    res = {}
    for k, f in rep['figures'].items():
        if not f:
            continue
        a = np.zeros(shape, np.float32); x0, y0, x1, y1 = f['box']
        a[y0:y1, x0:x1] = np.asarray(Image.open(os.path.join(out, 'hat-%s.png' % k)).convert('RGBA'))[..., 3] / 255
        res[k] = (a, np.asarray(Image.open(os.path.join(out, 'hat-%s.png' % k)).convert('RGBA')), f['box'])
    return res


def one(sheet):
    BH = load_bh()
    shape = os.path.basename(sheet).split('-')[1]
    flat = np.asarray(Image.open(os.path.join(FLAT, 'base.png')).convert('RGB')).astype(np.float32)
    fc = np.array([int(json.load(open(os.path.join(FLAT, 'base.json')))['flat'][i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    with tempfile.TemporaryDirectory() as d:
        o1, o2 = os.path.join(d, 'old'), os.path.join(d, 'new')
        BH.build_base(sheet, BASE, o1)
        old = masks(o1, flat.shape[:2])
        sim = flat.copy()
        for k, (a, rgba, (x0, y0, x1, y1)) in old.items():
            al = rgba[..., 3:4] / 255.0
            sim[y0:y1, x0:x1] = rgba[..., :3] * al + sim[y0:y1, x0:x1] * (1 - al)
        sp = os.path.join(d, 'sim.png'); Image.fromarray(sim.clip(0, 255).astype(np.uint8)).save(sp)
        BH.build_base(sp, FLAT, o2)
        new = masks(o2, flat.shape[:2])
        res, tiles = {}, []
        for k, (a, _, _) in old.items():
            if k not in new:
                res[k] = dict(iou=0.0, fringe=None); continue
            b, rgba, _ = new[k]
            ia, ib = a > .5, b > .5
            iou = float((ia & ib).sum() / max(1, (ia | ib).sum()))
            op = rgba[..., 3] > 128
            mag = np.abs(rgba[..., :3].astype(int) - fc.astype(int)).sum(-1) < 120
            res[k] = dict(iou=round(iou, 4), fringe=round(float((op & mag).sum() / max(1, op.sum())), 4))
            bg = Image.new('RGBA', (rgba.shape[1] + 12, rgba.shape[0] + 12), (40, 52, 90, 255))
            bg.alpha_composite(Image.fromarray(rgba), (6, 6)); tiles.append(bg.convert('RGB'))
    return shape, res, tiles


def main(argv):
    out = argv[0] if argv else os.path.join(ROOT, '검증', '모자', 'flat-check')
    want = set(argv[1:])
    sheets = sorted(f for f in glob.glob(os.path.join(ROOT, 'assets', 'garment-sources', 'hat-*-chatgpt-2026-10-16.png'))
                    if os.path.basename(f).split('-')[1] not in ('hair', 'headphone')
                    and (not want or os.path.basename(f).split('-')[1] in want))
    os.makedirs(out, exist_ok=True)
    report, rows, bad = {}, [], []
    with CF.ProcessPoolExecutor(4) as ex:
        for shape, res, tiles in ex.map(one, sheets):
            report[shape] = res
            for k, r in res.items():
                if r['iou'] < IOU_MIN or (r['fringe'] or 0) > FRINGE_MAX:
                    bad.append('%s %s iou %.3f fringe %s' % (shape, k, r['iou'], r['fringe']))
            if tiles:
                w = sum(t.width for t in tiles); h = max(t.height for t in tiles)
                row = Image.new('RGB', (w, h), 'white'); x = 0
                for t in tiles:
                    row.paste(t, (x, 0)); x += t.width
                rows.append(row)
    json.dump(report, open(os.path.join(out, 'flat-check.json'), 'w'), indent=1)
    if rows:
        W = max(r.width for r in rows); H = sum(r.height for r in rows)
        sheet = Image.new('RGB', (W, H), 'white'); y = 0
        for r in rows:
            sheet.paste(r, (0, y)); y += r.height
        sheet.save(os.path.join(out, 'flat-check.png'))
    for b in bad:
        print(b)
    print('flat hat check:', 'OK' if not bad else '%d figures off' % len(bad), '(%d hats)' % len(report))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
