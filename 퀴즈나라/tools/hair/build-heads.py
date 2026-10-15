"""Hair conversion H2, step 1: classes of the 24 front head paintings.

  python3 -B tools/hair/build-heads.py classify [--sexes m,f] [--out DIR]

Reads assets/sd-heads-<female|male>.png (4x3 cells of 362 px, order in
assets/sd-heads.json) and writes, per head, a class map:

  0 empty, 1 hair, 2 skin (face, ears, neck), 3 eye, 4 line (dark outline
  between classes, kept with the paint it bounds by the later steps)

and a contact sheet 검증/머리/분류-<sex>.png (not committed) to look at.
The classes feed the later H2 steps (skull frame and hat line, front/back
split, neck cut, skin remap); nothing here changes a runtime asset.

Method (per head, colour models from the head's own seeds, no hand-made
masks):
  - skin seeds: the cheeks and nose band between the eye line and the chin
    hint (assets/sd-heads.json), away from the eyes;
  - hair seeds: the top rows of the head's opaque bounds;
  - every opaque pixel goes to the closer Gaussian model in Lab
    (Mahalanobis), lines are the dark pixels both models explain badly;
  - skin is only skin when it is joined to the face seed or forms a large
    region of its own (an ear): cream highlights inside the hair stay hair;
  - eyes: non-skin pixels inside the eye aperture boxes of sd-heads.json.
Heads run in parallel (4 processes).
"""
import json
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402

ASSETS = os.path.join(ROOT, 'assets')
SEXES = {'f': 'female', 'm': 'male'}
CELL = 362
CLASSES = {0: 'empty', 1: 'hair', 2: 'skin', 3: 'eye', 4: 'line'}
COLOURS = {0: (235, 238, 244), 1: (150, 90, 50), 2: (250, 205, 180), 3: (40, 140, 150), 4: (40, 30, 30)}
ALPHA = 32
LINE_L = 42.0        # Lab L below which a pixel both models explain badly is a drawn line
EAR_MIN_PX = 120     # a skin region of its own (an ear) must be this large


def gauss(X):
    mu = X.mean(0)
    cov = np.cov(X.T) + np.eye(3) * 4.0
    inv = np.linalg.inv(cov)
    return mu, inv


def mahal(L, model):
    mu, inv = model
    d = L - mu
    return np.einsum('...i,ij,...j->...', d, inv, d)


def classify_head(args):
    sex, idx, head = args
    sheet = np.asarray(Image.open(os.path.join(ASSETS, 'sd-heads-%s.png' % SEXES[sex])).convert('RGBA')).astype(np.float32)
    x0, y0, w, h = head['sourceRect']
    cell = sheet[y0:y0 + h, x0:x0 + w]
    a = cell[..., 3]
    opaque = a > ALPHA
    lab = R.lab(cell[..., :3])
    (ex0, ey0), (ex1, ey1) = head['eyeCenters']
    eye_y = (ey0 + ey1) / 2
    chin_y = head['faceChinHint'][1]
    eye_dx = abs(ex1 - ex0)
    yy, xx = np.mgrid[0:h, 0:w]
    # skin seeds: below the eyes (clear of the lashes), above the chin, between the eye centres
    seed_skin = opaque & (yy > eye_y + .30 * (chin_y - eye_y)) & (yy < chin_y - 4) & \
        (np.abs(xx - (ex0 + ex1) / 2) < .55 * eye_dx)
    ob = head['opaqueBounds']
    top = ob[1]
    seed_hair = opaque & (yy < top + .18 * (eye_y - top)) & (xx > ob[0] + 8) & (xx < ob[2] - 8)
    if seed_skin.sum() < 50 or seed_hair.sum() < 50:
        raise ValueError('%s %s: too few seeds (skin %d, hair %d)' % (sex, head['id'], seed_skin.sum(), seed_hair.sum()))
    ms, mh = gauss(lab[seed_skin]), gauss(lab[seed_hair])
    ds, dh = mahal(lab, ms), mahal(lab, mh)
    cls = np.zeros((h, w), np.uint8)
    skinlike = opaque & (ds < dh)
    cls[opaque] = 1
    # skin joined to the face seed, or a large skin region of its own (an ear)
    face = M.connected_to(skinlike, seed_skin & skinlike)
    lab_, comps = M.components(skinlike & ~face)
    ears = np.zeros_like(face)
    for c in comps:
        if c['size'] >= EAR_MIN_PX:
            ears |= lab_ == c['label']
    skin = face | ears
    cls[skin] = 2
    # eyes: non-skin pixels in the aperture boxes
    for bx0, by0, bx1, by1 in head['eyeApertureBounds']:
        box = np.zeros_like(skin)
        box[int(by0):int(by1), int(bx0):int(bx1)] = True
        cls[box & opaque & ~skin] = 3
    # lines: dark pixels neither model explains well (outline between classes)
    line = opaque & (lab[..., 0] < LINE_L) & (np.minimum(ds, dh) > 12.0) & (cls != 3)
    cls[line] = 4
    counts = {CLASSES[k]: int((cls == k).sum()) for k in CLASSES}
    return sex, idx, head['id'], cls, counts


G = 384  # avatar-pixel.js HEAD_GRID: the runtime resamples each 362 px cell to 384


EYE_UNITS = {'f': 7.40, 'm': 9.32}  # avatar-pixel.js loadSheet: the default head's eye gap (f bob, m short), units
FIT_HALF = 17.0  # ... and the half width hair may reach from the face centre (clip frame x -1..33)


def head_native(head, cls=None):
    """The runtime placement of a front head painting (avatar-pixel.js
    loadSheet, 2026-10-15: one eye gap per sex, hair past x -1..33 shrinks
    the head to fit): head-native units (32 wide, eye midpoint x 16, chin y
    28) of cell pixel (x, y) are (x * k + ox, y * k + oy). Returns (k, ox, oy).
    `cls` is unused (kept for callers)."""
    sex = 'm' if head.get('sex') == 'm' else 'f'
    (ex0, ey0), (ex1, ey1) = head['eyeCenters']
    mid = (ex0 + ex1) / 2
    ob = head['opaqueBounds']
    k = min(EYE_UNITS[sex] / abs(ex1 - ex0), FIT_HALF / max(1, mid - ob[0]), FIT_HALF / max(1, ob[2] - mid))
    return k, 16 - mid * k, 28 - head['faceChinHint'][1] * k


def skull(sexes, out_dir, unit=12):
    """Every head of a sex in head-native units on one canvas: hair outline
    (thin brown), face and ears (filled pale), so the skull that all hair
    styles share can be read off (검증/머리/두상-<sex>.png)."""
    meta = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames']
    for s in sexes:
        W, H = 34 * unit, 42 * unit
        acc_face = np.zeros((H, W), np.float32)
        tops = []
        for hd in meta[SEXES[s]]['heads']:
            cls = np.asarray(Image.open(os.path.join(out_dir, '분류-%s-%s.png' % (s, hd['id']))))
            k, ox, oy = head_native(dict(hd, sex=s), cls)
            ys, xs = np.nonzero(cls > 0)
            u = ((xs * k + ox + 1) * unit).astype(int); v = ((ys * k + oy + 2) * unit).astype(int)
            ok = (u >= 0) & (u < W) & (v >= 0) & (v < H)
            m = np.zeros((H, W), bool); m[v[ok], u[ok]] = True
            f = np.zeros((H, W), bool); sk = cls[ys, xs] == 2
            f[v[ok & sk], u[ok & sk]] = True
            acc_face += f
            top = ys.min() * k + oy
            tops.append((hd['id'], round(float(top), 2), round(float(k), 4)))
        img = np.full((H, W, 3), 255, np.uint8)
        a = acc_face / len(meta[SEXES[s]]['heads'])
        img[a > 0] = (255 - (a[a > 0, None] * np.array([5, 80, 120])).astype(np.uint8))
        im = Image.fromarray(img)
        d = ImageDraw.Draw(im)
        for gy in range(0, 42, 2):
            d.line([(0, gy * unit), (W, gy * unit)], fill=(225, 225, 235))
            d.text((2, gy * unit), str(gy - 2), fill=(120, 120, 140))
        im.save(os.path.join(out_dir, '두상-%s.png' % s))
        print(s, sorted(tops, key=lambda t: t[1]))


SKULL = {  # front skull per sex in head-native units (centre x, centre y, rx, ry), 2026-10-15 at the fixed face size:
    # top 0.5-0.6 under the flattest hair (f twin 6.97, m crop 1.2), bottom at the chin (y 28), width from the
    # cheeks at the eye line (f face half width ~8.6; m ears at x 3.8..28.1, face ~10.5) plus the hair's root
    'm': (16.0, 14.9, 11.5, 13.1),
    'f': (16.0, 17.75, 9.4, 10.25),
}


def tops(sexes, out_dir, step=.5):
    """Per head the hair's top edge y(x) in head-native units (x 0..32 by
    `step`; None where the head has no paint) and its gap above the skull,
    for seating decorations on the hair (검증/머리/윗선.json, 윗선-<sex>.png)."""
    meta = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames']
    res = {}
    for s in sexes:
        cx, cy, rx, ry = SKULL[s]
        unit = 14
        W, H = 34 * unit, 34 * unit
        im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
        d.ellipse([(cx - rx + 1) * unit, (cy - ry + 2) * unit, (cx + rx + 1) * unit, (cy + ry + 2) * unit], outline=(220, 60, 60), width=2)
        for hd in meta[SEXES[s]]['heads']:
            cls = np.asarray(Image.open(os.path.join(out_dir, '분류-%s-%s.png' % (s, hd['id']))))
            k, ox, oy = head_native(dict(hd, sex=s), cls)
            ys, xs = np.nonzero(cls > 0)
            U = xs * k + ox; V = ys * k + oy
            xsn = np.arange(0, 32 + 1e-6, step)
            top = []
            for x in xsn:
                m = np.abs(U - x) < step / 2
                top.append(round(float(V[m].min()), 2) if m.any() else None)
            res['%s:%s' % (s, hd['id'])] = dict(k=round(k, 5), ox=round(ox, 3), oy=round(oy, 3), x=[float(v) for v in xsn], top=top)
            pts = [((x + 1) * unit, (t + 2) * unit) for x, t in zip(xsn, top) if t is not None]
            d.line(pts, fill=(120, 80, 40), width=1)
        for gy in range(0, 32, 2):
            d.text((2, (gy + 2) * unit), str(gy), fill=(150, 150, 170))
        im.save(os.path.join(out_dir, '윗선-%s.png' % s))
    json.dump(res, open(os.path.join(out_dir, '윗선.json'), 'w'))
    return res


def contact(sex, results, out):
    cols, size = 6, 181
    rows = (len(results) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * size * 2, rows * (size + 18)), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    src = Image.open(os.path.join(ASSETS, 'sd-heads-%s.png' % SEXES[sex])).convert('RGBA')
    heads = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames'][SEXES[sex]]['heads']
    for n, (idx, hid, cls, counts) in enumerate(results):
        x0, y0, w, h = heads[idx]['sourceRect']
        bg = Image.new('RGBA', (w, h), (235, 238, 244, 255))
        bg.alpha_composite(src.crop((x0, y0, x0 + w, y0 + h)))
        col = np.zeros((h, w, 3), np.uint8)
        for k, c in COLOURS.items():
            col[cls == k] = c
        cx, cy = (n % cols) * size * 2, (n // cols) * (size + 18)
        sheet.paste(bg.convert('RGB').resize((size, size)), (cx, cy))
        sheet.paste(Image.fromarray(col).resize((size, size), Image.NEAREST), (cx + size, cy))
        d.text((cx + 4, cy + size + 2), '%s  skin %d  hair %d' % (hid, counts['skin'], counts['hair']), fill=(0, 0, 0))
    sheet.save(out)
    return out


def classify(sexes, out_dir):
    meta = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames']
    jobs = [(s, i, hd) for s in sexes for i, hd in enumerate(meta[SEXES[s]]['heads'])]
    with Pool(4) as pool:
        res = pool.map(classify_head, jobs)
    os.makedirs(out_dir, exist_ok=True)
    summary = {}
    for s in sexes:
        rs = [(i, hid, cls, c) for (ss, i, hid, cls, c) in res if ss == s]
        rs.sort(key=lambda r: r[0])
        for i, hid, cls, c in rs:
            Image.fromarray(cls).save(os.path.join(out_dir, '분류-%s-%s.png' % (s, hid)))
            summary['%s:%s' % (s, hid)] = c
        print('wrote', contact(s, rs, os.path.join(out_dir, '분류-%s.png' % s)))
    json.dump(summary, open(os.path.join(out_dir, '분류.json'), 'w'), ensure_ascii=False, indent=1)
    return summary


def main(argv):
    cmd = argv[0] if argv else ''
    sexes = argv[argv.index('--sexes') + 1].split(',') if '--sexes' in argv else ['f', 'm']
    out = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, '검증', '머리')
    if cmd == 'classify':
        classify(sexes, out)
        return 0
    if cmd == 'tops':
        tops(sexes, out)
        return 0
    if cmd == 'skull':
        skull(sexes, out)
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
