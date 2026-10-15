"""Hat pipeline, step 1: cut the hat out of a ChatGPT hat sheet.

  python3 -B tools/hair/build-hat.py SHEET [--out DIR] [--id hat:<shape>]

The sheet is the garment template with a hat drawn on the six heads (hat kit,
assets/garment-template/프롬프트.md, prompts hat/full and hat/sit-on). It is
registered to the template with the 'hat' slot of tools/avatar_build/
register.py (the head is the changing part: the layout check skips the head
crops and the scale is the sheet's own). Per figure the hat is the painted
pixels around the head whose colours the template's head (hair, skin, eyes,
lines) does not have, grown over its own outline; holes that show hair stay
open (the strap opening of a cap's back). Writes per figure an RGBA crop and
its box in sheet pixels, and a contact sheet (검증/모자/<name>/).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402

HEAD = R.OWNER['head']
NOVEL = 22.0      # Lab distance from every template head colour: a new (hat) colour
SEED_MIN = 300    # px of novel colour that make a hat
GROW = 3          # px the hat mask grows over its own outline
ZONE = .75        # share of head top -> neck the hat may reach down to (a cap's back strap, a profile brim)
HIDE_SIDE = 120   # px beside the hat where squeezed hair is hidden (hide_mask)
HIDE_TOP = 80     # px above the hat (spiky hair above the crown)
HIDE_RAMP = .8    # the hidden edge beside the hat rises this many px per px


def fill_holes(mask):
    """The mask with every region of ~mask not joined to the border filled."""
    border = np.zeros_like(mask); border[0] = border[-1] = True; border[:, 0] = border[:, -1] = True
    outside = M.connected_to(~mask, border & ~mask)
    return ~outside


def kmeans(X, k, iters=12, seed=0):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), size=min(k, len(X)), replace=False)].copy()
    for _ in range(iters):
        d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
        a = d.argmin(1)
        for j in range(len(C)):
            if (a == j).any():
                C[j] = X[a == j].mean(0)
    return C


def nearest(L, C):
    return np.sqrt(((L[..., None, :] - C) ** 2).sum(-1)).min(-1)


def cut_figure(U, A, T, owner, box):
    x0, y0, x1, y1 = box
    u = U[y0:y1, x0:x1, :3].astype(np.float32)
    a = A[y0:y1, x0:x1].astype(np.float32)
    a = a / 255.0 if a.max() > 1.5 else a
    t = T[y0:y1, x0:x1]
    head = owner[y0:y1, x0:x1] == HEAD
    ys, xs = np.nonzero(head)
    # the zone: the head's columns widened, from the page top down to 75 % of the
    # way from the head top to the neck (a hat ends above the eyes; the shirt,
    # whose colour may be the hat's, stays out)
    neck = np.nonzero((owner[y0:y1, x0:x1] == R.OWNER['neck']).any(1))[0]
    low = int(ys.min() + ZONE * ((neck.min() if len(neck) else ys.max()) - ys.min()))
    zone = np.zeros(head.shape, bool)
    zone[:low, max(0, xs.min() - 60):xs.max() + 61] = True
    Ul, Tl = R.lab(u), R.lab(t)
    head_cols = kmeans(Tl[head].reshape(-1, 3)[::7], 10)
    fg = (a > .5) & zone
    novel = fg & (nearest(Ul, head_cols) > NOVEL)
    lab_, comps = M.components(novel)
    keep = [c['label'] for c in comps if c['size'] >= SEED_MIN]
    if not keep:
        return None
    seed = np.isin(lab_, keep)
    hat_cols = kmeans(Ul[seed][::3], 6, seed=1)
    closer = fg & (nearest(Ul, hat_cols) < nearest(Ul, head_cols))
    hat = M.connected_to(closer, seed)
    # its own outline: dark pixels hugging the hat
    # (not the hair's own dark strands: only near-black, or dark and unlike the head's colours)
    dist_head = nearest(Ul, head_cols)
    dark = fg & M.dilate(hat, GROW) & ((Ul[..., 0] < 25) | ((Ul[..., 0] < 45) & (dist_head > 12)))
    hat |= dark
    # close pinholes; a hole showing hair (a cap's back opening) stays open
    filled = fill_holes(hat)
    holes = filled & ~hat
    hl, hc = M.components(holes)
    for c in hc:
        if c['size'] <= 40:
            hat |= hl == c['label']
    alpha = np.where(hat, np.clip(a, 0, 1), 0).astype(np.float32)
    opening = fill_holes(hat) & ~hat
    ys, xs = np.nonzero(hat)
    bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    rgba = np.dstack([u, alpha * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
    return dict(rgba=rgba, box=[x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]], px=int(hat.sum()),
                mask=hat, cell=box, hide=hide_mask(hat, opening, x0, y0))


def hide_mask(hat, opening, x0, y0, side=HIDE_SIDE, top=HIDE_TOP, ramp=HIDE_RAMP):
    """Where a pulled-on hat hides the wearer's own hair (any hair style):
    in the hat's columns everything down to its lower edge, the opening it
    shows hair through (a cap's back) excepted; beside the hat a ramp that
    rises `ramp` px per px away from it (hair squeezed under the rim, wider
    hair still shows below). Black (hidden) on transparent, with its box in
    sheet px."""
    cols = np.nonzero(hat.any(0))[0]
    rows = np.nonzero(hat.any(1))[0]
    bottom = np.full(hat.shape[1], -1)
    for c in cols:
        bottom[c] = np.nonzero(hat[:, c])[0].max()
    fx0, fx1 = max(0, cols.min() - side), min(hat.shape[1], cols.max() + 1 + side)
    fy0, fy1 = max(0, rows.min() - top), rows.max() + 1
    yy = np.arange(fy0, fy1)[:, None]
    edge = np.empty(fx1 - fx0)
    for i, c in enumerate(range(fx0, fx1)):
        if bottom[c] >= 0:
            edge[i] = bottom[c]
        else:
            n = cols[np.argmin(np.abs(cols - c))]
            edge[i] = bottom[n] - ramp * abs(c - n)
    hidden = (yy <= edge[None, :]) & ~opening[fy0:fy1, fx0:fx1]
    rgba = np.zeros(hidden.shape + (4,), np.uint8)
    rgba[hidden, 3] = 255
    return dict(rgba=rgba, box=[x0 + fx0, y0 + fy0, x0 + fx1, y0 + fy1])


def to_head(fr, box):
    """Sheet px box -> head-native [x, y, w, h] of that figure's view (tools/fixtures/hat-frame.json)."""
    (cx0, cy0) = fr['cell0']; u = fr['unitsPerSheetPx']; ox, oy = fr['cellOrigin']; t = fr['toViewBox']
    x = (ox + (box[0] - cx0) * u - t[4]) / t[0]; y = (oy + (box[1] - cy0) * u - t[5]) / t[3]
    return [round(x, 3), round(y, 3), round((box[2] - box[0]) * u / t[0], 3), round((box[3] - box[1]) * u / t[3], 3)]


def export(pid, kind, figures, out_assets):
    """assets/hat-art/<shape>-<sex>-<view>.png (+ -hide.png for pulled-on hats) and
    their records (head-native rects) for avatar-hat-art.js."""
    frame = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'hat-frame.json')))['figures']
    spec = R.garment_spec('hat', ('m', 'f'))
    shape = pid.split(':')[1]
    os.makedirs(out_assets, exist_ok=True)
    rec = dict(kind=kind, views={})
    for k, f in figures.items():
        sex, view = k.split('-')
        fr = dict(frame[k], cell0=spec['cells'][k][:2])
        name = '%s-%s-%s' % (shape, sex, view)
        Image.fromarray(f['rgba']).save(os.path.join(out_assets, name + '.png'), optimize=True)
        v = dict(src='assets/hat-art/%s.png' % name, rect=to_head(fr, f['box']))
        if kind == 'full':
            Image.fromarray(f['hide']['rgba']).save(os.path.join(out_assets, name + '-hide.png'), optimize=True)
            v['hide'] = dict(src='assets/hat-art/%s-hide.png' % name, rect=to_head(fr, f['hide']['box']))
        if kind == 'full':
            # everything above the hide mask over its whole width (hair taller than the frame: m spiky, a pony's tip)
            h = v['hide']['rect']
            v['hideTop'] = [h[0], -20.0, h[2], round(h[1] + 20.4, 3)]  # overlaps the mask's top rows (all hidden) so its soft edge never shows hair
        rec['views'].setdefault(sex, {})[view] = v
    json.dump(rec, open(os.path.join(out_assets, shape + '.json'), 'w'), ensure_ascii=False, indent=1)
    write_runtime(out_assets)
    return rec


def write_runtime(out_assets):
    """assets/hat-art/hat-art.json (every <shape>.json) and avatar-hat-art.js (window.QPHatArt)."""
    allrec = {}
    for name in sorted(os.listdir(out_assets)):
        if name.endswith('.json') and name != 'hat-art.json':
            allrec[name[:-5]] = json.load(open(os.path.join(out_assets, name)))
    json.dump(allrec, open(os.path.join(out_assets, 'hat-art.json'), 'w'), ensure_ascii=False, indent=1)
    js = ('// Hat art of the foundation avatar (generated by tools/hair/build-hat.py; do not edit).\n'
          '// Per hat shape: kind full (hides the hair under it) | sit (sits on the hair), and per sex and view\n'
          '// (front, right, back) the picture and, for full hats, the hair-hide mask, as head-native rects.\n'
          'window.QPHatArt=Object.freeze(' + json.dumps(allrec, ensure_ascii=False, separators=(',', ':')) + ');\n')
    open(os.path.join(ROOT, 'avatar-hat-art.js'), 'w').write(js)


def build(sheet, out, pid=None, kind=None, out_assets=None):
    res = R.register(sheet, slot='hat', sexes=('m', 'f'))
    if 'registered' not in res.get('images', {}):
        raise SystemExit('registration failed: %s' % [c['code'] for c in res['codes']])
    spec = R.garment_spec('hat', ('m', 'f'))
    U, A = res['images']['registered'], res['images']['alpha']
    os.makedirs(out, exist_ok=True)
    report = dict(sheet=os.path.basename(sheet), codes=[(c['code'], c.get('figure')) for c in res['codes']],
                  figures={})
    tiles, cut = [], {}
    for k, box in spec['cells'].items():
        f = cut_figure(U, A, spec['template'], spec['owner'], box)
        if f is None:
            report['figures'][k] = None
            continue
        cut[k] = f
        Image.fromarray(f['rgba']).save(os.path.join(out, 'hat-%s.png' % k))
        report['figures'][k] = dict(box=f['box'], px=f['px'], fit=res['figures'][k]['maxPx'])
        bg = Image.new('RGBA', (f['rgba'].shape[1] + 20, f['rgba'].shape[0] + 20), (40, 52, 90, 255))
        bg.alpha_composite(Image.fromarray(f['rgba']), (10, 10))
        tiles.append(bg.convert('RGB'))
    json.dump(report, open(os.path.join(out, '모자.json'), 'w'), ensure_ascii=False, indent=1)
    if tiles:
        w = sum(t.width for t in tiles) + 6 * len(tiles); h = max(t.height for t in tiles)
        im = Image.new('RGB', (w, h), 'white'); x = 0
        for t in tiles:
            im.paste(t, (x, 0)); x += t.width + 6
        im.save(os.path.join(out, '모자-조각.png'))
    if pid:
        report['record'] = export(pid, kind, cut, out_assets)
    return report


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--out')
    ap.add_argument('--id', help='hat:<shape>: also export assets/hat-art/ and print the record')
    a = ap.parse_args(argv)
    name = os.path.splitext(os.path.basename(a.sheet))[0]
    out = a.out or os.path.join(ROOT, '검증', '모자', name)
    kind = None
    if a.id:
        prod = json.load(open(os.path.join(ROOT, 'assets', 'garment-template', 'products.json')))['products'][a.id]
        kind = {'hat/full': 'full', 'hat/sit-on': 'sit'}[prod['class']]
    r = build(a.sheet, out, a.id, kind, os.path.join(ROOT, 'assets', 'hat-art'))
    print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
