"""Hat fit per hair style: a style whose hair under a pulled-on hat is drawn
(QPHatHair: twin tails, a pony, build-hat-hair.py) lies close to the skull,
narrower and lower than the default hair (f bob, m short) every hat was cut
on. Each hat was drawn round the default hair's volume, so on that style its
crown stood out beside the head and over its top: the hat looked too wide and
afloat (2026-10-16 user: straw, mortarboard, witch, backward cap, police cap
on twin tails). Per style and view this finds the map of the default hair's
width onto the style's (rows FIT_ROWS under the rims) and
stores it as fit [s, a0, a1, t0, t1] in hair.json: the game scales the hat and
its hide mask by s and moves the default hair's crown t0 onto the style's t1
(x' = a1 + (x - a0) * s, y' = t1 + (y - t0) * s), so every hat comes down onto
the smaller, lower head; a hat whose rim then still sits above HAT_LINE (drawn
high on the default's volume: straw, witch, mortarboard) comes down to it.

  node tools/hair/measure-hat-fit.cjs DIR   (the default hair in two colours)
  python3 -B tools/hair/fit-hat-hair.py DIR [--check]

Writes tools/fixtures/hat-fit.json (the default hair's edges per sex and view)
and the fits into assets/hat-art/hair/hair.json, then avatar-hat-art.js.
build-hat-hair.py refits a style it rebuilds from that fixture (fit_view).
--check only prints the fits and exits 1 when hair.json differs.
"""
import argparse
import importlib.util
import json
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FIXTURE = os.path.join(ROOT, 'tools', 'fixtures', 'hat-fit.json')
HAIR_JSON = os.path.join(ROOT, 'assets', 'hat-art', 'hair', 'hair.json')
RES = 20                       # px per head-native unit
RECT = (-8.0, -6.0, 48.0, 40.0)
FIT_ROWS = {'front': (12.0, 18.0), 'right': (12.0, 18.0), 'back': (19.0, 24.0)}
                               # head-native rows under the rims (temples; the back's rims sit lower, on the nape),
                               # above the twin tails' ties
DIFF = 40                      # summed RGB change between the two hair colours that marks hair
STRENGTH = {'front': .6, 'right': 1.0, 'back': .5}
                               # share of the narrowing used: in front and from behind the tied tails stand out wide below the
                               # rim, and the full fit (twin front .75, back .74) left the hat looking small on them (board 2026-10-16)
HAT_LINE = {'front': 16.0, 'right': 16.2, 'back': None}
                               # head-native row a fitted hat's rim comes down to at least: a straw hat, a witch's hat
                               # and a mortarboard were drawn sitting high on the default hair's volume (rim 12-14 in
                               # front) and stayed afloat over the close hair (2026-10-16 user); a police cap's fitted rim
                               # is ~18. From behind no hat looked afloat.
TOP_MID = .3                   # the crown is measured over the middle 40 % of the width
FIT_MIN, FIT_MAX = .6, 1.0     # a style is never fitted wider than the default (its own volume shows under the rim)


def _grid():
    W, H = int(RECT[2] * RES), int(RECT[3] * RES)
    return np.meshgrid((np.arange(W) + .5) / RES + RECT[0], (np.arange(H) + .5) / RES + RECT[1])


def edges(mask, view):
    """Median left and right hair edge over the view's FIT_ROWS of a head-native mask (RECT, RES)."""
    y0, y1 = FIT_ROWS[view]
    rows = range(int((y0 - RECT[1]) * RES), int((y1 - RECT[1]) * RES))
    lr = [(xs[0], xs[-1]) for xs in (np.nonzero(mask[r])[0] for r in rows) if len(xs)]
    if not lr:
        return None
    a, b = float(np.median([a for a, _ in lr])), float(np.median([b for _, b in lr]) + 1)
    # the crown: the hair's first row down the middle of that width
    tops = [np.nonzero(mask[:, c])[0] for c in range(int(a + (b - a) * TOP_MID), int(b - (b - a) * TOP_MID))]
    t = float(np.median([ys[0] for ys in tops if len(ys)]))
    return [round(a / RES + RECT[0], 3), round(b / RES + RECT[0], 3), round(t / RES + RECT[1], 3)]


def default_edges(d):
    """The default hair's edges per sex and view from measure-hat-fit.cjs output."""
    meta = json.load(open(os.path.join(d, 'fit.json')))
    hf = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-frame.json')))
    gx, gy = _grid()
    out = {}
    for sex in ('m', 'f'):
        a, b = [s for s in meta['shots'] if s['sex'] == sex]
        A, B = (np.asarray(Image.open(os.path.join(d, s['file'])).convert('RGB')).astype(int) for s in (a, b))
        hair = np.abs(A - B).sum(-1) > DIFF
        for i, view in enumerate(a['views']):
            box = a['boxes'][i]; t = hf[sex][view]['frame']['toViewBox']; ppu = box['w'] / 32.0
            px = np.round(box['x'] + (gx * t[0] + t[4]) * ppu).astype(int); py = np.round(box['y'] + (gy * t[3] + t[5]) * ppu).astype(int)
            ok = (px >= 0) & (py >= 0) & (px < hair.shape[1]) & (py < hair.shape[0])
            m = np.zeros(gx.shape, bool); m[ok] = hair[py[ok], px[ok]]
            out.setdefault(sex, {})[view] = edges(m, view)
    return dict(about='The default hair\'s (%s) left and right edge and crown per sex and view, head-native, median over rows %s '
                      '(tools/hair/measure-hat-fit.cjs + fit-hat-hair.py). Generated; do not edit.' % (meta['default'], FIT_ROWS),
                default=meta['default'], rows=FIT_ROWS, edges=out)


def drawn_edges(rec, view):
    """Edges of a drawn hair picture (hair.json view record) over FIT_ROWS."""
    im = np.asarray(Image.open(os.path.join(ROOT, rec['src'])).convert('RGBA'))[..., 3] > 127
    h, w = im.shape; r = rec['rect']; gx, gy = _grid()
    px = np.floor((gx - r[0]) / r[2] * w).astype(int); py = np.floor((gy - r[1]) / r[3] * h).astype(int)
    ok = (px >= 0) & (py >= 0) & (px < w) & (py < h)
    m = np.zeros(gx.shape, bool); m[ok] = im[py[ok], px[ok]]
    return edges(m, view)


def fit_view(sex, view, rec, fixture=None):
    """fit [s, a0, a1, t0, t1, line] of a drawn hair view record, or None (no fixture or no edges)."""
    if fixture is None:
        if not os.path.exists(FIXTURE):
            return None
        fixture = json.load(open(FIXTURE))
    d = fixture['edges'].get(sex, {}).get(view); e = drawn_edges(rec, view)
    if not d or not e:
        return None
    s = min(FIT_MAX, max(FIT_MIN, 1 - (1 - (e[1] - e[0]) / (d[1] - d[0])) * STRENGTH[view]))
    # the default's left edge onto the drawn one's, the centre kept: x' = a1 + (x - a0) * s; the default's crown onto
    # the drawn one's: y' = t1 + (y - t0) * s (a hat that sits high, a straw hat's or a witch's rim over the hair,
    # came down only by its rim's share when it shrank about the rim: still afloat, 2026-10-16 user)
    c0, c1 = (d[0] + d[1]) / 2, (e[0] + e[1]) / 2
    return [round(s, 4), d[0], round(c1 - (c0 - d[0]) * s, 3), d[2], e[2], HAT_LINE[view]]


# Hats sized by the face instead (2026-10-16 user: "양갈래 머리를 기준으로하지말고 얼굴 크기를 기준으로"): on the
# styles with drawn under-hat hair the hat is scaled so its crown (the hat's width CROWN_ROW above its rim) is
# `crown` times the face's width (skin at eye height, the same for every style) and lowered so its rim lies `above`
# units over the eyes; the police cap fitted on twin tails (approved) measures crown 1.5 x face, rim 6.4-7 over the
# eyes. The straw hat drawn on the bob sat 11.8 over the eyes, its crown 2 x the face: afloat and too wide.
FACE_FIT = {'straw': dict(crown=1.5, above=7.0, front_x=.85, styles={'twin': .92})}
# styles: a style's own further scale (twin tails a little smaller, 2026-10-16 user: "양갈래머리는 조금 더 줄이면돼")
# front_x: the front view narrowed further across only (the straw hat's brim, 2026-10-16 user: "정면모습에서 모자 챙을
# 더 줄여야돼"); the crown's height and the other views keep s
CROWN_ROW = 1.5


def hat_width_at(v, y):
    im = np.asarray(Image.open(os.path.join(ROOT, v['src'])).convert('RGBA'))[..., 3] > 127
    r = v['rect']; py = int((y - r[1]) / r[3] * im.shape[0])
    c = np.nonzero(im[min(max(py, 0), im.shape[0] - 1)])[0]
    return ((c.max() - c.min() + 1) / im.shape[1] * r[2], r[0] + (c.min() + c.max() + 1) / 2 / im.shape[1] * r[2]) if len(c) else (None, None)


def face_fits(hats, style='twin'):
    """faceFit per hat in FACE_FIT and sex: [s, cx, rim, dy, sx] per view (x' = cx + (x - cx) * s * sx,
    y' = rim + (y - rim) * s + dy), from the front view (the face) and used for every view; sx is FACE_FIT
    front_x in front, else 1."""
    hs = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-skin.json')))
    fa = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'face-anchor.json')))
    out = {}
    for shape, want in FACE_FIT.items():
        rec = hats.get(shape)
        if not rec:
            continue
        for sex in rec['views']:
            if sex not in fa['eyes'] or style not in fa['eyes'][sex]['front']:
                continue
            eyes = fa['eyes'][sex]['front'][style]; ey = (eyes[0][1] + eyes[1][1]) / 2
            sk = np.asarray(Image.open(os.path.join(ROOT, 'tools', 'fixtures', hs['maps'][sex + '-front'])).convert('L')) > 127
            xs = np.nonzero(sk[int((ey - hs['rect'][1]) * hs['res'])])[0]
            face = (xs.max() - xs.min()) / hs['res']
            fv = rec['views'][sex]['front']
            crown, _ = hat_width_at(fv, fv['rim'] - CROWN_ROW)
            s = round(want['crown'] * face / crown, 4)
            dy = round((ey - want['above']) - fv['rim'], 3)  # the front rim onto its line over the eyes
            views = {}
            for view, v in rec['views'][sex].items():
                _, cx = hat_width_at(v, v['rim'] - CROWN_ROW)
                views[view] = [s, round(cx, 3), v['rim'], dy, want.get('front_x', 1.0) if view == 'front' else 1.0]
            for style_, k_ in want.get('styles', {}).items():
                views['scale:' + style_] = k_
            out.setdefault(shape, {})[sex] = views
            print('face fit', shape, sex, 'face %.2f crown %.2f -> s %.3f, rim %.2f -> %.2f' % (face, crown, s, fv['rim'], fv['rim'] + dy))
    return out


def apply_face_fits():
    """Writes faceFit into assets/hat-art/<shape>.json (and drops it from hats no longer in FACE_FIT)."""
    d = os.path.join(ROOT, 'assets', 'hat-art')
    hats = {n[:-5]: json.load(open(os.path.join(d, n))) for n in os.listdir(d) if n.endswith('.json') and n != 'hat-art.json'}
    fits = face_fits(hats)
    for shape, rec in hats.items():
        new = fits.get(shape)
        if rec.get('faceFit') != new:
            if new:
                rec['faceFit'] = new
            else:
                rec.pop('faceFit', None)
            json.dump(rec, open(os.path.join(d, shape + '.json'), 'w'), ensure_ascii=False, indent=1)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('dir', nargs='?', help='measure-hat-fit.cjs output (default: refit from the fixture)')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args(argv)
    fixture = default_edges(a.dir) if a.dir else json.load(open(FIXTURE))
    allrec = json.load(open(HAIR_JSON)); changed = False
    for sex, styles in allrec.items():
        for hair, views in styles.items():
            for view, rec in views.items():
                f = fit_view(sex, view, rec, fixture)
                print(sex, hair, view, 'fit', f, 'default', fixture['edges'][sex][view], 'drawn', drawn_edges(rec, view))
                if rec.get('fit') != f:
                    changed = True
                    if f:
                        rec['fit'] = f
                    else:
                        rec.pop('fit', None)
    if a.check:
        # every pulled-on hat needs its rim (the fit's pivot); a drawn style without its fit, or with a stale one,
        # wears the default hair's hat size (HAT_FIT_MISSING)
        hats = json.load(open(os.path.join(ROOT, 'assets', 'hat-art', 'hat-art.json')))
        norim = ['%s %s-%s' % (k, sx, vw) for k, r in hats.items() if r.get('kind') == 'full'
                 for sx, vs in r['views'].items() for vw, v in vs.items() if v.get('rim') is None]
        if norim:
            print('HAT_RIM_MISSING', norim)
        if changed:
            print('HAT_FIT_MISSING: hair.json fits differ from the fixture (run fit-hat-hair.py)')
        return 1 if changed or norim else 0
    if a.dir:
        json.dump(fixture, open(FIXTURE, 'w'), indent=1)
    json.dump(allrec, open(HAIR_JSON, 'w'), ensure_ascii=False, indent=1)
    apply_face_fits()
    spec = importlib.util.spec_from_file_location('build_hat', os.path.join(HERE, 'build-hat.py'))
    BH = importlib.util.module_from_spec(spec); spec.loader.exec_module(BH)
    BH.write_runtime(os.path.join(ROOT, 'assets', 'hat-art'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
