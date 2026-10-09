"""Frozen build artifacts (stage 3, WP1), generated once from the frozen body.

Every garment build reads these instead of re-deriving anything:
  owner-map.png      who owns each sheet pixel at rest (labels below), made
                     from the ORIGINAL 7 layers, so a later rebuild of the
                     basic outfit never moves it
  zones.json         per figure: armhole S/A seams, sleeve frames (shoulder,
                     elbow, elbow cap), clean-art rows, hem/waist lines, neck
                     window, shorts cuff and shoe bands
  cover-torso.png    torso pixels that only a top can cover (no body art)
  cover-bottom.png   pelvis pixels that only a bottom can cover, plus the
                     strip up to the waist cover line every bottom is
                     extended to
  hair-occlusion.png reference hair lying on the garment at rest
  contact-bands.png  body art next to the basic garment edges that is not
                     clean skin (1 arm, 2 neck, 3 leg): the basic cuff's
                     dark line, collar line, cream remnants, cast shadows
  limits.json        class limits from body coverage and runtime constants
and two rule-generated body variants (new files; the legacy layers stay):
  assets/sd-foundation-ref-arms-clean.png  arms without the basic cuff edge
  assets/sd-foundation-ref-neck-clean.png  neck without the basic collar edge

Units: sheet px unless a key ends in U (body units, 1 u = 1/k px).
"""
import json
import os
import re

import numpy as np
from PIL import Image

from .common import dilate, erode, fill_colors, lum_of, polyline_y

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CELLS = {'m-front': (150, 0, 520, 555), 'm-right': (560, 0, 900, 555), 'm-back': (930, 0, 1270, 555),
         'f-front': (150, 555, 520, 1086), 'f-right': (560, 555, 900, 1086), 'f-back': (930, 555, 1270, 1086)}
LABELS = {0: 'background', 1: 'shirt', 2: 'sleeve', 3: 'arm', 4: 'shorts', 5: 'leg', 6: 'shoe', 7: 'neck', 8: 'head', 9: 'other'}
LAYER_LABEL = {'shirt': 1, 'sleeves': 2, 'arms': 3, 'shorts': 4, 'legs': 5, 'shoes': 6, 'neck': 7}
# Resting draw order, topmost first: a sleeve lies over its arm, the arm over
# the shirt and shorts (profile), the shirt over the shorts and the neck's
# extension under the collar, shorts over the legs, shoes over the legs.
Z_ORDER = ('sleeves', 'arms', 'shirt', 'shorts', 'shoes', 'legs', 'neck')
BAND_LABEL = {'arm': 1, 'neck': 2, 'leg': 3}
# Where two garment layers or a garment and body art abut at rest, a build
# may be this many px short: the pipeline closes such a gap with the
# product's own edge continued (hidden-cloth rule). Registration is <= .6 px
# and DP seams <= 2 px (plan, registration/segmentation), hence 3.
SEAM_TOLERANCE = 3
NECK_EXTEND = 8  # clean neck continues this far (about .5 u) below the legacy neck: room for a V or round neck


# ---------------------------------------------------------------------------
# Runtime constants the limits come from (read from the runtime source, so a
# runtime change makes make-frozen.py / verify-body-freeze.py fail loudly).
# ---------------------------------------------------------------------------
def _grab(path, pattern, cast=float, what=''):
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    m = re.search(pattern, src, re.S)
    if not m:
        raise ValueError('runtime constant not found (%s) in %s: %s' % (what, path, pattern))
    return [cast(g) for g in m.groups()] if len(m.groups()) > 1 else cast(m.group(1))


def runtime_constants():
    seat_rise = _grab('avatar-foundation.js', r'SEATED_BREATH=Object\.freeze\(\{rise:([\d.]+)', what='seated breathing')
    head_scale = _grab('avatar-foundation.js', r'HEAD_SCALE=([\d.]+)', what='head scale')
    clip_need = _grab('avatar-foundation.js', r'the line stays at least (\.\d+) above the collar/shoulder outline', what='hair clip need')
    clip_nod, clip_idle = _grab('avatar-foundation.js', r'is (\.\d+)\s*(?://\s*)?head units at the bow\'s peak \(idle (\.\d+)', what='hair clip margins')
    vh = _grab('avatar-foundation.js', r'VIEW_HEAD=(\{m:\{.*?\}\}),VIEW_HEAD_PIVOT', str, what='VIEW_HEAD')
    vh = json.loads(re.sub(r'([{,])(\w+):', r'\1"\2":', re.sub(r'(?<![\d.])\.(\d)', r'0.\1', vh)))
    head_drop = {sex: {v: d[1] for v, d in views.items()} for sex, views in vh.items()}
    tube = _grab('avatar-foundation-outfit.js', r'end:\[leg\.knee\[0\]-u\[0\]\*([\d.]+),leg\.knee\[1\]-u\[1\]\*[\d.]+\]', what='floor-sit tube end')
    canvas = _grab('avatar-foundation-outfit.js', r'c\.width=c\.height=(\d+);', int, what='sleeve canvas')
    off, ppu = _grab('avatar-foundation-outfit.js', r'd:\[\(p\[0\]\+(\d+)\)\*(\d+),', int, what='sleeve frame')
    cap = "'Q'+q(E,-re,-re)+' '+q(E,0,-re)+'Q'+q(E,re,-re)+' '+q(E,re)+'Z'"
    if cap not in open(os.path.join(ROOT, 'avatar-foundation-skin.js'), encoding='utf-8').read():
        raise ValueError('forearmOverlay elbow cap (radius re) changed in avatar-foundation-skin.js')
    if canvas != 2 * off * ppu:
        raise ValueError('sleeve canvas is not centred on the shoulder')
    allow = round((clip_nod - clip_need) * head_scale, 4)
    return {
        'seatedBreathRiseU': seat_rise,
        'headScale': head_scale,
        'frontHairClip': {'needU': clip_need, 'nodPeakMarginU': clip_nod, 'idleMarginU': clip_idle},
        'collarAllowU': allow,
        'floorSitTubeEndU': tube,
        'headDropU': head_drop,
        'sleeveCanvasHalfU': off, 'sleeveCanvasPxPerU': ppu,
        'forearmCap': 'clip of the folded forearm reaches re = radii.arm[i][1]*k past the elbow (avatar-foundation-skin.js forearmOverlay)',
        'seamTolerancePx': SEAM_TOLERANCE,
        'sources': {
            'seatedBreathRiseU': 'avatar-foundation.js SEATED_BREATH.rise',
            'headScale': 'avatar-foundation.js HEAD_SCALE',
            'frontHairClip': 'avatar-foundation.js FRONT_HAIR_CLIP comment (bob, measured on the render)',
            'collarAllowU': '(nod-peak margin - required margin) * HEAD_SCALE',
            'floorSitTubeEndU': 'avatar-foundation-outfit.js seatedShorts floor tubes end',
            'headDropU': 'avatar-foundation.js VIEW_HEAD[sex][view][1]: the runtime head (and its hair) sits this far below the sheet head, so it covers the body this much further down',
            'sleeveCanvas': 'avatar-foundation-outfit.js sleeveTexture 256 px canvas, 32 px/u, +-4 u',
        },
    }


# ---------------------------------------------------------------------------
# Colour rules (the builder's own skin/shade tests, tools/avatar_build/body.py)
# ---------------------------------------------------------------------------
def skinish(rgb):
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    skin = (r > 200) & (g >= 186) & (g <= 234) & (b >= 140) & (b <= 222) & (r - g >= 16) & (r - b >= 30) & (g - b <= 28)
    shade = (r > 170) & (g > 120) & (r - g >= 20) & (r - g <= 80) & (g - b <= 28) & (r - b >= 40)
    return skin | shade


def creamish(rgb):
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    return (r > 200) & (g > 165) & (g - b >= 29) & (r - g <= 45)


def offhue(rgb):
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    return (g > r - 4) | (b > r - 10)


# ---------------------------------------------------------------------------
# Clean arms: the rows that showed under the basic cuff (its dark lower line,
# cream scraps, the cuff's cast shadow) are replaced by the first clean
# full-width row below them, leaning toward the shoulder exactly like the
# builder's hidden rows above cuff_top. The arm keeps its painted outline.
# ---------------------------------------------------------------------------
def arm_side_columns(f, i, lo, hi):
    cl, cr = lo - 8, hi + 8
    if f['view'] != 'right':
        c = int(round(f['center']))
        if i == 0:
            cr = min(cr, c)
        else:
            cl = max(cl, c + 1)
    return cl, cr


def clean_arms(arms, figs, trace):
    out = arms.copy()
    band = np.zeros(arms.shape[:2], bool)
    info = {}
    for key, f in figs.items():
        J = f['joints']
        for i in ([0] if f['view'] == 'right' else [0, 1]):
            lb = trace[key]['limbs']['arm%d' % i]
            S, hidden, ty = lb['src'], lb['hidden'], lb['top']
            cl, cr = arm_side_columns(f, i, *lb['band'])
            a, b = lb['span']
            row = arms[S]
            l, r = a, b
            while l - 1 >= cl and row[l - 1, 3] > 0:
                l -= 1
            while r < cr and row[r, 3] > 0:
                r += 1
            src = row[l:r].copy()
            sh, el = J['shoulder'][i], J['elbow'][i]
            for yy in range(hidden, S):
                t = (S - yy) / max(1, S - ty)
                shift = int(round((sh[0] - el[0]) * t * .9))
                out[yy, cl:cr] = 0
                out[yy, l + shift:r + shift] = src
            # Contact band: legacy pixels there that are not the clean arm
            # (darker line/shadow, cream or other-hue scraps, or outside it).
            reg = np.zeros(arms.shape[:2], bool); reg[hidden:S, cl:cr] = True
            leg_a, cln_a = arms[..., 3] > 64, out[..., 3] > 64
            darker = lum_of(arms) < lum_of(out) - 15
            dirty = darker | (creamish(arms) & ~creamish(out)) | (offhue(arms) & ~offhue(out))
            mine = reg & leg_a & (~cln_a | dirty)
            band |= mine
            info['%s/arm%d' % (key, i)] = dict(rows=[hidden, S], cols=[cl, cr], run=[l, r], bandPx=int(mine.sum()),
                                               bandRows=[int(np.nonzero(mine.any(1))[0].min()), int(np.nonzero(mine.any(1))[0].max())] if mine.any() else None)
    return out, band, info


# ---------------------------------------------------------------------------
# Clean neck. Near the basic collar edge (from 4 px above it down) the neck
# painting carries the collar's line, its light inner rim, cream scraps and
# its cast shadow, and under it the builder's flat fill. That band is
# repainted by continuing the clean skin above it smoothly (Laplace continuation, the same harmonic fill the
# builder uses for hidden cloth), and the neck continues NECK_EXTEND px below
# its legacy end (room for a V or round neckline; the clean neck therefore
# has its own rects, zones.json clean.neckRects). The neck's own side lines
# (dark strokes running down from above the band) are kept as painted.
# ---------------------------------------------------------------------------
def collar_edge(top_alpha, x, y0, y1):
    rows = np.nonzero(top_alpha[y0:y1, x] > .5)[0]
    return int(rows.min() + y0) if len(rows) else None


def clean_neck(neck, top_alpha, figs, trace):
    from .common import connected, harmonic
    out = neck.copy()
    band = np.zeros(neck.shape[:2], bool)
    info = {}
    H, W = neck.shape[:2]
    for key, f in figs.items():
        x0, y0, x1, y1 = CELLS[key]
        a = neck[..., 3]
        cellm = np.zeros((H, W), bool); cellm[y0:y1, x0:x1] = True
        have = (a > 0) & cellm
        if not have.any():
            info[key] = None  # the bob hides it; the male back neck stands in
            continue
        lum = lum_of(neck)
        cols = np.nonzero(have.any(0))[0]
        R = np.zeros((H, W), bool)
        ref_lum = np.full(W, np.nan)
        for x in cols:
            e = collar_edge(top_alpha, x, y0, y1)
            if e is None:
                continue
            R[max(y0, e - 4):y1, x] = True
            ref = [y for y in range(e - 12, e - 5) if y0 <= y and a[y, x] > 200 and skinish(neck[y:y + 1, x, :3])[0]]
            if ref:
                ref_lum[x] = float(np.median(lum[ref, x]))
        R &= have
        skin_ok = (a > 200) & skinish(neck) & cellm & ~R
        L_lo = float(np.percentile(lum[skin_ok], 5))
        refl = np.where(np.isnan(ref_lum), np.nanmedian(ref_lum), ref_lum)[None, :]
        dark_all = have & (lum < L_lo - 8)
        # Side lines: dark strokes in columns that are already dark just above
        # the band, continuing into it to 1 px under the collar edge; a collar
        # line crossing the neck is not one even where it touches them.
        side = np.zeros(W, bool)
        near_edge = np.zeros((H, W), bool)  # down to 1 px under the collar edge
        for x in cols:
            e = collar_edge(top_alpha, x, y0, y1)
            if e is None:
                continue
            near_edge[:e + 2, x] = True
            if dark_all[max(y0, e - 14):max(y0, e - 4), x].any():
                side[x] = True
        outline = connected(dark_all, dark_all & ~R) & R & side[None, :] & near_edge
        # Everything in the band but the side lines is repainted (the band
        # under and just above the old collar edge is all collar residue,
        # cast shadow or the builder's fill); `dirt` is what visibly differs.
        repaint = R & ~outline
        dirt = repaint & ((lum < refl - 12) | (lum > refl + 6) | creamish(neck) | offhue(neck))
        # Extension: NECK_EXTEND px under the opaque neck, inside the cell.
        solid = (a > 200) & cellm
        ext = np.zeros((H, W), bool)
        for d in range(1, NECK_EXTEND + 1):
            ext[d:] |= solid[:-d]
        ext &= ~have & cellm
        domain = repaint | ext
        fixed = solid & ~repaint & ~outline
        ys, xs = np.nonzero(domain | fixed)
        by0, by1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
        bx0, bx1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
        sub = harmonic(neck[by0:by1, bx0:bx1, :3], domain[by0:by1, bx0:bx1], fixed[by0:by1, bx0:bx1], iterations=400)
        reg = out[by0:by1, bx0:bx1]
        dm = domain[by0:by1, bx0:bx1]
        reg[..., :3][dm] = sub[dm]
        reg[..., 3][ext[by0:by1, bx0:bx1]] = 255
        changed = repaint & (a > 64) & ((np.abs(lum_of(out) - lum) > 8) | (creamish(neck) & ~creamish(out)) | (offhue(neck) & ~offhue(out)))
        band |= dirt & (a > 64) | changed
        info[key] = dict(lumLow=round(L_lo, 1), bandPx=int((dirt & (a > 64) | changed).sum()), outlineKeptPx=int(outline.sum()),
                         repaintedPx=int(repaint.sum()),
                         extendPx=NECK_EXTEND, extendedPx=int(ext.sum()))
    return out, band, info


def leg_band(legs, figs, trace):
    """Leg art under the basic shorts cuff that is not clean skin (no clean
    variant yet: user approval covered arms and neck). The leg's own side
    outline (3 px at each side of the row's run) is not band."""
    band = np.zeros(legs.shape[:2], bool)
    info = {}
    for key, f in figs.items():
        for i in ([0] if f['view'] == 'right' else [0, 1]):
            lb = trace[key]['limbs']['leg%d' % i]
            S, hidden = lb['src'], lb['hidden']
            lo, hi = lb['band']
            ref = legs[S + 2, lb['span'][0] + 3:lb['span'][1] - 3, :3]
            ref_lum = float(np.median(lum_of(ref)))
            for yy in range(hidden, S + 1):
                row = legs[yy, lo:hi]
                xs = np.nonzero(row[:, 3] > 64)[0]
                if not len(xs):
                    continue
                inner = np.zeros(hi - lo, bool); inner[xs.min() + 3:xs.max() - 2] = True
                dirty = (lum_of(row) < ref_lum - 15) | creamish(row) | offhue(row)
                band[yy, lo:hi] |= inner & (row[:, 3] > 64) & dirty
            m = band[hidden:S + 1, lo:hi]
            info['%s/leg%d' % (key, i)] = dict(rows=[hidden, S], bandPx=int(m.sum()))
    return band, info


# ---------------------------------------------------------------------------
# Owner map and hair occlusion
# ---------------------------------------------------------------------------
def owner_map(layers, sheet):
    labels = np.zeros(sheet.shape[:2], np.uint8)
    for name in reversed(Z_ORDER):
        labels[layers[name][..., 3] >= 128] = LAYER_LABEL[name]
    rest = (labels == 0) & (sheet[..., 3] >= 128)
    labels[rest] = 9
    return labels


def head_and_hair(labels, figs):
    """Owner 'head' = sheet paint above each figure's head cut, plus paint in
    no layer below it (the reference hair lying on the shoulders/collar)."""
    occ = np.zeros(labels.shape, bool)
    for key, f in figs.items():
        x0, y0, x1, y1 = CELLS[key]
        xs = np.arange(x0, x1)
        cut = polyline_y(f['cut'], xs)[None, :]
        Y = np.arange(y0, y1)[:, None] + .5
        sub = labels[y0:y1, x0:x1]
        head = (sub == 9) & (Y <= cut)
        below = (sub == 9) & (Y > cut)
        sub[head | below] = 8
        occ[y0:y1, x0:x1] = below
    return labels, occ
