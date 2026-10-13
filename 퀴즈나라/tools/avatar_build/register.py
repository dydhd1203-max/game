"""Registration of an uploaded sheet onto the frozen grid (stage 3, WP5).

Shared by the garment pipeline (tools/garment/build-garment.py, WP6) and the
hair pipeline (tools/hair/build-hairstyle.py, H5): everything that knows
about garments lives in garment_spec(); register() only needs a Spec (the
template on white in sheet space, the cells and their layout, the stable mask
per cell and the anchor points the error is measured at). numpy + PIL only.

Geometry. A figure's transform maps a SHEET pixel p (centre-based index into
the 1448x1086 grid) to an UPLOAD pixel q = s * p + b. The template itself is
q = p + (90, 0) (margins 90 left / 91 right, common.TEMPLATE); ChatGPT's
1536x1024 is the same scaled by 1536/1629.

Steps (plan 'registration', with the REDTEAM fixes):
 1. input record (matte.read_input): bytes, sha256, container and encoder
    (PNG / lossy VP8 or lossless VP8L WebP / JPEG with its quality), ICC,
    and the calibration column ('png' or 'lossy'); SIZE_SMALL.
 2. page and matte (matte.background / matte.matte): BACKGROUND; foreground
    by border connectivity with the outline ridge as barrier (keeps a white
    collar inside its outline).
 3. layout on figure paint (a pale grey shadow is no part of a box): two rows
    from the row projection, split by a least-paint seam where the rows
    touch; three figures per row from the column projection (LAYOUT_COUNT; a
    figure whose paint reaches the page edge is cut); rows and views by
    head-region correlation with the template (LAYOUT_ORDER), the side view
    against its mirror (LAYOUT_MIRROR); head-region aspect (SQUASH, early).
 4. per-figure initialisation from the figure box (height head top to soles,
    x from the head-region centre), and the six-box median scale as a second
    candidate.
 5. per-figure similarity fit (s, bx, by; never rotation or shear): a
    quarter-resolution coarse search (s +-3 % in 1 % steps, shift +-20 px in
    4 px steps, on blurred Lab), then a full-resolution compass search down
    to .02 px. Objective: robust Lab error (lightness weight .7, Cauchy rho,
    c = 10), gradient-weighted, after a per-figure tone map, on the FIT mask
    only: the template figure minus the product slot's frozen zone dilated
    12 px (the unchanged heads, arms, legs and other slots are the
    registration marks; without the head a top's region spans only hem to
    sole and scale trades against shift). No palette threshold anywhere.
 6. diagnostics: a free affine fit (rotation > 1.5 deg or |sx/sy - 1| > 2 % ->
    SQUASH); each figure's scale against the six-figure median (3-6 % W_SCALE,
    > 6 % FIGURE_SCALE); the offset against the joint global fit (> 16 px
    LAYOUT_MOVED).
 7. one resample per cell into sheet space (PIL resize with a sub-pixel box,
    Lanczos): a 1448x1086 RGBA with the matte alpha, each cell holding its
    own figure only (paint in a neighbour's registered footprint is the
    neighbour's). Enclosed near-white pockets that lie in the template's
    background are background; every other pocket (a white collar, a cuff)
    stays.
 8. checks in sheet space, after a per-sheet tone map anchored on what no
    garment changes (heads and body skin): FOREIGN_MARK (marks outside the
    figure boxes), SHADOW (paint at the frozen floor that is not the figure),
    BODY_DRIFT (window-min dE of lightly blurred images, median / p95, and
    silhouette IoU on the CHECK
    mask: below the collar + 10 px, no head, no product zone; arm/leg skin),
    POSE_ARM / POSE_LEG (part residual shift, +-8 px search), OTHER_SLOT_CHANGED
    (another garment slot redrawn; tolerant to ChatGPT's re-render of an
    unchanged print), SINGLE_SEX_CHANGED and HAIR_OVER_GARMENT. consolidate()
    keeps root causes (a moved leg also changes the shoe's pixels).
"""
import json
import math
import os
import time

import numpy as np
from PIL import Image

from . import matte as M
from .common import SHEET, TEMPLATE, box_blur

assert TEMPLATE['left'] == 90 and TEMPLATE['right'] == 91, 'template margins are 90 left / 91 right'

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATE_PATH = os.path.join(ROOT, 'assets', 'garment-template', 'template-sheet.png')
SHEET_PATH = os.path.join(ROOT, 'assets', 'avatar-reference-candidates', 'body-study-2026-10-04.png')
FROZEN = os.path.join(ROOT, 'tools', 'garment', 'frozen')
DATA_JS = os.path.join(ROOT, 'assets', 'sd-foundation-ref-data.js')

CELLS = {'m-front': (150, 0, 520, 555), 'm-right': (560, 0, 900, 555), 'm-back': (930, 0, 1270, 555),
         'f-front': (150, 555, 520, 1086), 'f-right': (560, 555, 900, 1086), 'f-back': (930, 555, 1270, 1086)}
LAYOUT = [['m-front', 'm-right', 'm-back'], ['f-front', 'f-right', 'f-back']]
COLLAR_Y = {'m': 264, 'f': 786}
OWNER = {'background': 0, 'shirt': 1, 'sleeve': 2, 'arm': 3, 'shorts': 4, 'leg': 5, 'shoe': 6, 'neck': 7, 'head': 8}
SLOT_OWNERS = {'top': (1, 2), 'bottom': (4,), 'shoes': (6,)}

# Thresholds (plan 'registration'; provisional, calibrated on the identity
# input, the 1536 WebP q80 template, the synthetic set and the real sheet).
T = dict(
    coarseScale=.03, coarseScaleStep=.01, coarseShift=20, fineStop=.02,
    rhoC=10.0, lightW=.7,
    squashRotDeg=1.5, squashRatio=.02, squashEarly=.06,
    scaleWarn=.03, scaleFail=.06, movedPx=16.0,
    stableDEMedian=4.0, stableDEP95=10.0, stableIoU=.93,
    partPass=1.5, partWarn=3.0, partSearch=8,
    slotShare={'bottom': .30, 'shoes': .20, 'top': .30, 'leg': .05, 'arm': .10},
    slotMedian=8.0, slotDE=10.0, slotGuardPx=12, bodyGuardPx=30,
    markMin=40, markFail=400, boxPad=30,
    shadowPx=150, floorPad=3,
    hairOverPx=150,
    pocketBackground=.8,
)


# ---------------------------------------------------------------------------
# Colour
# ---------------------------------------------------------------------------
def lab(rgb):
    c = np.clip(rgb, 0, 255) / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    Mx = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]], np.float32)
    xyz = c @ Mx.T / np.array([.95047, 1.0, 1.08883], np.float32)
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])],
                    -1).astype(np.float32)


def blur3(a, r):
    if r <= 0:
        return a
    return np.stack([box_blur(a[..., i], r) for i in range(a.shape[-1])], -1).astype(np.float32)


def winmin_de(a, b, r=2, light=.7):
    """Window-minimum Lab distance: for each pixel of `a`, the closest
    colour of `b` within +-r px (absorbs sub-pixel drift and soft edges; the
    same distance the segmentation's change map uses)."""
    H, W = a.shape[:2]
    P = np.pad(b, ((r, r), (r, r), (0, 0)), mode='edge')
    best = np.full((H, W), np.inf, np.float32)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = a - P[r + dy:r + dy + H, r + dx:r + dx + W]
            d[..., 0] *= light
            best = np.minimum(best, np.sqrt((d * d).sum(-1)))
    return best


def de(a, b, light=1.0):
    d = a - b
    if light != 1.0:
        d = d.copy(); d[..., 0] *= light
    return np.sqrt((d * d).sum(-1))


# ---------------------------------------------------------------------------
# Sampling
# ---------------------------------------------------------------------------
def sample(flat, H, W, xs, ys):
    """Bilinear sample of an (H*W, C) image at centre-based (xs, ys); points
    outside are clamped to the edge (the page is white there)."""
    xs = np.clip(xs, 0, W - 1.001); ys = np.clip(ys, 0, H - 1.001)
    x0 = xs.astype(np.int32); y0 = ys.astype(np.int32)
    fx = (xs - x0)[:, None]; fy = (ys - y0)[:, None]
    i = y0 * W + x0
    a, b, c, d = flat[i], flat[i + 1], flat[i + W], flat[i + W + 1]
    top = a + (b - a) * fx
    return top + ((c + (d - c) * fx) - top) * fy


def pil_box(s, b, x0, y0, w, h):
    """PIL resize box (edge coordinates) that samples q = s * p + b
    (centre-based) for the output grid p = (x0.., y0..)."""
    bx = s * x0 + b[0] + .5 - .5 * s
    by = s * y0 + b[1] + .5 - .5 * s
    return (bx, by, bx + w * s, by + h * s)


def warp_cell(img, s, b, cell, resample=Image.LANCZOS, pad=None, fill=255):
    """Resample an upload image (PIL) into sheet space for one cell, once.
    The upload is padded so the box never leaves it (PIL refuses that)."""
    x0, y0, x1, y1 = cell
    w, h = x1 - x0, y1 - y0
    box = pil_box(s, b, x0, y0, w, h)
    if pad is None:
        pad = int(max(0, -box[0], -box[1], box[2] - img.width, box[3] - img.height)) + 8
    if pad:
        mode = img.mode
        canvas = Image.new(mode, (img.width + 2 * pad, img.height + 2 * pad),
                           fill if mode in ('L', 'F') else (fill,) * len(mode))
        canvas.paste(img, (pad, pad))
        img = canvas
        box = (box[0] + pad, box[1] + pad, box[2] + pad, box[3] + pad)
    return img.resize((w, h), resample, box=box)


# ---------------------------------------------------------------------------
# Spec (what is being registered)
# ---------------------------------------------------------------------------
def _read_data_js(path=DATA_JS):
    text = open(path, encoding='utf-8').read()
    return json.loads(text[text.index('Object.freeze(') + 14:text.rindex(');')])


_SPEC_CACHE = {}


def garment_spec(slot='top', sexes=('m', 'f')):
    """The ChatGPT garment template: 2 rows (boy, girl) x front/right/back.
    slot: the product slot ('top' | 'bottom' | 'shoes'); sexes: the rows the
    product changes (a single-sex product leaves the other row untouched)."""
    if slot not in SLOT_OWNERS:
        raise ValueError('unknown slot %r' % slot)
    key = (slot, tuple(sexes))
    if key in _SPEC_CACHE:
        return _SPEC_CACHE[key]
    tpl = np.asarray(Image.open(TEMPLATE_PATH).convert('RGB')).astype(np.float32)
    if tpl.shape[1] != TEMPLATE['width'] or tpl.shape[0] != TEMPLATE['height']:
        raise ValueError('template-sheet.png is not %dx%d' % (TEMPLATE['width'], TEMPLATE['height']))
    t = tpl[:, TEMPLATE['left']:TEMPLATE['left'] + SHEET['width']]
    ref = np.asarray(Image.open(SHEET_PATH).convert('RGBA')).astype(np.float32)
    fg = ref[..., 3] >= 128
    owner = np.asarray(Image.open(os.path.join(FROZEN, 'owner-map.png')))
    hair_occ = np.asarray(Image.open(os.path.join(FROZEN, 'hair-occlusion.png'))) > 127
    zones = json.load(open(os.path.join(FROZEN, 'zones.json'), encoding='utf-8'))
    data = _read_data_js()['figures']
    product = np.isin(owner, SLOT_OWNERS[slot])
    guard = M.dilate(product, 12)
    yy = np.arange(SHEET['height'])[:, None]
    stable = {}
    fit = {}
    anchors = {}
    for k, (x0, y0, x1, y1) in CELLS.items():
        cell = np.zeros(fg.shape, bool); cell[y0:y1, x0:x1] = True
        # Fit mask: everything the product does not change. The head is in it
        # (the template's registration marks are the unchanged heads, arms,
        # legs and shoes): without it a top's stable region spans only hem to
        # sole and the scale is traded against the shift (f-back -0.5 %).
        ft = fg & cell
        # Check mask (drift checks): below the collar + 10 px, without the
        # head and hair, which are discarded and redrawn by ChatGPT.
        st = fg & cell & (yy > COLLAR_Y[k[0]] + 10) & (owner != OWNER['head'])
        if k[0] in sexes:
            st &= ~guard
            ft &= ~guard
        stable[k] = st
        fit[k] = ft
        J = data[k]['joints']
        pts = [p for name in ('shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle') for p in J[name]]
        anchors[k] = np.array(pts, np.float64)
    spec = dict(kind='garment', slot=slot, sexes=tuple(sexes), template=t, templateFg=fg, owner=owner,
                hairOcclusion=hair_occ, cells=CELLS, layout=LAYOUT, stable=stable, fit=fit, anchors=anchors,
                zones=zones['figures'], data=data, canvas=(TEMPLATE['width'], TEMPLATE['height']),
                offset=(float(TEMPLATE['left']), 0.0), productMask=product)
    _SPEC_CACHE[key] = spec
    return spec


SPEC_KEYS = ('kind', 'slot', 'sexes', 'template', 'templateFg', 'cells', 'layout', 'fit', 'anchors', 'canvas', 'offset')


def make_spec(kind, template, template_fg, cells, layout, fit, anchors, canvas, offset, slot=None, sexes=(), **extra):
    """A registration target other than the garment sheet (the hair
    pipeline's 1x3 'change only the hair' template, a test layout).

      template     H x W x 3 float, the template on white in SHEET space
      template_fg  H x W bool, its figures (layout boxes, pockets, ownership)
      cells        {key: (x0, y0, x1, y1)} sheet px, one figure each
      layout       [[key, ...], ...] rows of keys, top to bottom, left to right
      fit          {key: H x W bool} pixels the product does not change
      anchors      {key: N x 2} points the error is measured at (sheet px)
      canvas       (width, height) of the template image given to ChatGPT
      offset       (x, y) of the sheet inside that canvas
    Optional: 'checks' (callable(res, reg_rgb, reg_a, spec, Tlab)) for the
    pipeline's own checks after registration."""
    spec = dict(kind=kind, slot=slot, sexes=tuple(sexes), template=template, templateFg=template_fg, cells=cells,
                layout=layout, fit=fit, anchors={k: np.asarray(v, np.float64) for k, v in anchors.items()},
                canvas=tuple(canvas), offset=tuple(float(v) for v in offset))
    spec.update(extra)
    return spec


def nominal_transform(spec, size):
    """The global fit if the upload is the template scaled to `size` width
    with nothing else changed: q_e = g * (p_e + left)."""
    g = size[0] / spec['canvas'][0]
    return g, (g * spec['offset'][0] + .5 * (g - 1), g * spec['offset'][1] + .5 * (g - 1))


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------
def _bands(proj, min_frac=.01):
    occ = proj > proj.max() * min_frac
    runs, i = [], 0
    while i < len(occ):
        if occ[i]:
            j = i
            while j < len(occ) and occ[j]:
                j += 1
            runs.append([i, j])
            i = j
        else:
            i += 1
    return runs


def _seam(fg, lo, hi):
    """Least-paint left-to-right path y(x) between rows lo and hi (one row
    step per column at most): where two figure rows touch or overlap, it cuts
    through the narrowest contact (a girl's hair against a boy's shoe)."""
    sub = fg[lo:hi].astype(np.float32)
    h, W = sub.shape
    prior = 1e-3 * np.abs(np.arange(h) - h / 2) / max(1, h)
    acc = sub[:, 0] + prior
    back = np.zeros((h, W), np.int8)
    idx = np.arange(h)
    for x in range(1, W):
        up = np.r_[np.inf, acc[:-1]]
        dn = np.r_[acc[1:], np.inf]
        st = np.stack([up, acc, dn])
        j = st.argmin(0)
        acc = st[j, idx] + sub[:, x] + prior
        back[:, x] = j - 1
    y = np.zeros(W, np.int32)
    y[-1] = int(np.argmin(acc))
    for x in range(W - 1, 0, -1):
        y[x - 1] = y[x] + back[y[x], x]
    return y + lo, float(sub[y, np.arange(W)].sum())


def _rows(keep, n):
    """Masks of the n figure rows. Clear gaps come from the row projection;
    two rows that touch (one band whose height is close to the content
    width, as for the two-row sheet) are split by the least-paint seam."""
    proj = keep.sum(1).astype(np.float64)
    if n == 1:
        return [keep], {'split': 'single'}
    runs = [r for r in _bands(proj) if r[1] - r[0] > 0]
    if not runs:
        return [], {'split': 'none'}
    big = max(r[1] - r[0] for r in runs)
    runs = [r for r in runs if r[1] - r[0] >= .25 * big]
    H, W = keep.shape
    if len(runs) == n:
        masks = []
        for a, b in runs:
            m = np.zeros_like(keep); m[a:b] = keep[a:b]; masks.append(m)
        return masks, {'split': 'gap', 'rows': runs}
    if n == 2 and len(runs) == 1:
        a, b = runs[0]
        cols = np.nonzero(keep[a:b].any(0))[0]
        width = cols.max() - cols.min() + 1
        if (b - a) / width > .75:
            lo, hi = a + int(.35 * (b - a)), a + int(.65 * (b - a))
            y, paint = _seam(keep, lo, hi)
            Y = np.arange(H)[:, None]
            top = keep & (Y < y[None, :]); bot = keep & (Y >= y[None, :])
            return [top, bot], {'split': 'seam', 'rows': [[a, int(y.max())], [int(y.min()), b]], 'seamPaintPx': paint}
    return [None] * len(runs), {'split': 'count', 'rows': runs}


def _head_crop(rgb_lum, fg, box, n=40):
    """Lightness of the head region (top 42 % of the figure box), resampled
    to n x n over its own foreground extent, zero-mean unit-variance."""
    x0, y0, x1, y1 = box
    hh = int(round(.42 * (y1 - y0)))
    sub = fg[y0:y0 + hh, x0:x1]
    cols = np.nonzero(sub.any(0))[0]
    if not len(cols):
        return None, None
    cx0, cx1 = x0 + cols.min(), x0 + cols.max() + 1
    patch = Image.fromarray(np.clip(rgb_lum[y0:y0 + hh, cx0:cx1], 0, 255).astype(np.uint8))
    v = np.asarray(patch.resize((n, n), Image.BOX)).astype(np.float32)
    v = (v - v.mean()) / (v.std() + 1e-6)
    return v, (cx1 - cx0) / max(1, hh)


def template_layout(spec):
    if 'layoutRef' in spec:
        return spec['layoutRef']
    fg = spec['templateFg']
    lum = spec['template'].mean(-1)
    ref = {}
    for k, (x0, y0, x1, y1) in spec['cells'].items():
        sub = fg[y0:y1, x0:x1]
        ys, xs = np.nonzero(sub)
        box = (int(xs.min() + x0), int(ys.min() + y0), int(xs.max() + x0 + 1), int(ys.max() + y0 + 1))
        crop, aspect = _head_crop(lum, fg, box)
        ref[k] = dict(box=box, crop=crop, mirror=crop[:, ::-1].copy(), aspect=aspect)
    spec['layoutRef'] = ref
    return ref


def _cut_by_edge(rgb, fg, box, band=2, ink=4):
    """A figure box that reaches the page edge is cut when figure paint (dark
    ink or clear colour, not a pale grey shadow) lies on that edge."""
    H, W = fg.shape
    x0, y0, x1, y1 = box
    strips = []
    if y0 <= 1:
        strips.append((slice(0, band), slice(x0, x1)))
    if y1 >= H - 1:
        strips.append((slice(H - band, H), slice(x0, x1)))
    if x0 <= 1:
        strips.append((slice(y0, y1), slice(0, band)))
    if x1 >= W - 1:
        strips.append((slice(y0, y1), slice(W - band, W)))
    for sl in strips:
        px = rgb[sl][fg[sl]]
        if not len(px):
            continue
        lum = px.mean(-1)
        chroma = px.max(-1) - px.min(-1)
        if int(((lum < 160) | (chroma > 25)).sum()) >= ink:
            return True
    return False


def find_layout(rgb, fg, spec):
    """Figure boxes in the upload, keyed by template cell, plus the codes.
    info['figureLabels'] (int8 image, 1-based in layout order) says which
    figure owns each figure-sized component pixel."""
    H, W = fg.shape
    lab_, comps = M.components(fg, min_size=1)
    if not comps:
        return None, [dict(code='LAYOUT_COUNT', kind='none', detail='no figures', found=0)], {}
    biggest = max(c['size'] for c in comps)
    figure_parts = [c for c in comps if c['size'] >= .02 * biggest]
    keep = np.isin(lab_, [c['label'] for c in figure_parts])
    # Layout on figure paint only: a pale grey cast shadow joins a figure's
    # matte component (and may join the rows) but is no part of its box.
    lum = rgb.mean(-1)
    chroma = rgb.max(-1) - rgb.min(-1)
    keep &= ~((chroma < 14) & (lum > 150))
    layout = spec['layout']
    rows, rinfo = _rows(keep, len(layout))
    info = {'components': len(comps), 'figureParts': len(figure_parts), 'rows': rinfo}
    if len(rows) != len(layout):
        return None, [dict(code='LAYOUT_COUNT', kind='rows', detail='%d rows of figures (expected %d)' % (len(rows), len(layout)),
                           found=len(rows))], info
    boxes = {}
    found = []
    figlab = np.zeros(keep.shape, np.int8)
    order = [k for row in layout for k in row]
    for r, rm in enumerate(rows):
        proj = rm.sum(0).astype(np.float64)
        cols = _bands(proj)
        big = max((c[1] - c[0] for c in cols), default=0)
        cols = [c for c in cols if c[1] - c[0] >= .25 * big]
        found.append(len(cols))
        if len(cols) != len(layout[r]):
            continue
        for c, (xa, xb) in enumerate(cols):
            ys, xs = np.nonzero(rm[:, xa:xb])
            boxes[layout[r][c]] = (int(xa + xs.min()), int(ys.min()), int(xa + xs.max() + 1), int(ys.max() + 1))
            figlab[ys, xs + xa] = order.index(layout[r][c]) + 1
    info['figuresPerRow'] = found
    info['figureLabels'] = figlab
    if any(f != len(l) for f, l in zip(found, layout)):
        return None, [dict(code='LAYOUT_COUNT', kind='perRow', detail='figures per row %s (expected %s)' % (
            found, [len(l) for l in layout]), found=sum(found))], info
    codes = []
    cropped = [k for k, box in boxes.items() if _cut_by_edge(rgb, fg, box)]
    if cropped:
        # The figure boxes are then not whole: nothing else can be judged.
        return boxes, [dict(code='LAYOUT_COUNT', kind='cut', detail='figure cut by the page edge', figures=cropped)], info
    # Which template figure does each box look like (head region)?
    ref = template_layout(spec)
    lum = rgb.mean(-1)
    score = {}
    aspects = []
    for k, box in boxes.items():
        crop, aspect = _head_crop(lum, fg, box)
        if crop is None:
            continue
        aspects.append(aspect / ref[k]['aspect'])
        row = {}
        for t, rr in ref.items():
            row[t] = float((crop * rr['crop']).mean())
            if t.endswith('right'):
                row[t + '~mirror'] = float((crop * rr['mirror']).mean())
        score[k] = row
    info['headScores'] = {k: {t: round(v, 3) for t, v in row.items()} for k, row in score.items()}
    order_bad, mirror_bad = [], []
    for k, row in score.items():
        best = max(row, key=row.get)
        if best == k:
            continue
        if best == k + '~mirror':
            mirror_bad.append(k)
        else:
            # The rows as a whole decide the order (one confused figure in a
            # row of correct ones is not a swapped layout).
            order_bad.append((k, best))
    if order_bad:
        codes.append(dict(code='LAYOUT_ORDER', detail='; '.join('%s looks like %s' % (k, b) for k, b in order_bad),
                          figures=[k for k, _ in order_bad]))
    if mirror_bad:
        codes.append(dict(code='LAYOUT_MIRROR', detail='side view faces the other way', figures=mirror_bad))
    if aspects:
        ratio = float(np.median(aspects))
        info['headAspectRatio'] = round(ratio, 4)
        if abs(ratio - 1) > T['squashEarly']:
            codes.append(dict(code='SQUASH', detail='head regions %.0f%% %s than the template' % (
                abs(ratio - 1) * 100, 'narrower' if ratio < 1 else 'wider'), value=round(ratio, 4)))
    return boxes, codes, info


# ---------------------------------------------------------------------------
# Per-figure fit
# ---------------------------------------------------------------------------
class Figure:
    """Objective of one figure: robust Lab error on its stable mask."""

    def __init__(self, key, spec, Tlab, Tgrad, U_flat, U_shape, Ublur_flat):
        self.key = key
        self.H, self.W = U_shape
        self.U = U_flat
        self.Ub = Ublur_flat
        st = spec['fit'][key]
        ys, xs = np.nonzero(st)
        self.P = np.stack([xs, ys], 1).astype(np.float64)
        self.T = Tlab[ys, xs]
        g = Tgrad[ys, xs]
        self.w = (.25 + g / (g + 6.0)).astype(np.float32)
        self.centre = self.P.mean(0)
        self.radius = float(np.sqrt(((self.P - self.centre) ** 2).sum(1).mean()))
        self.tone = (np.ones(3, np.float32), np.zeros(3, np.float32))
        x0, y0, x1, y1 = spec['cells'][key]
        self.cell = (x0, y0, x1, y1)
        # Quarter-resolution blocks for the coarse search.
        q = 4
        h4, w4 = (y1 - y0) // q, (x1 - x0) // q
        stc = st[y0:y0 + h4 * q, x0:x0 + w4 * q].reshape(h4, q, w4, q).mean((1, 3))
        gc = Tgrad[y0:y0 + h4 * q, x0:x0 + w4 * q].reshape(h4, q, w4, q).mean((1, 3))
        self.q = q
        self.c_w = (stc * (.25 + gc / (gc + 6.0))).astype(np.float32)
        self.c_shape = (h4, w4)
        Tb = blur3(Tlab[y0:y0 + h4 * q, x0:x0 + w4 * q], 2)
        self.c_T = Tb[1::q, 1::q][:h4, :w4] * .5 + Tb[2::q, 2::q][:h4, :w4] * .5

    def evaluate(self, s, bx, by, P=None, T=None, w=None, flat=None):
        P = self.P if P is None else P
        T = self.T if T is None else T
        w = self.w if w is None else w
        u = sample(self.U if flat is None else flat, self.H, self.W, s * P[:, 0] + bx, s * P[:, 1] + by)
        u = u * self.tone[0] + self.tone[1]
        d = u - T
        d[:, 0] *= T_LIGHT
        r2 = (d * d).sum(1)
        rho = r2 / (r2 + T_C2)
        return float((w * rho).sum() / w.sum())

    def fit_tone(self, s, bx, by):
        u = sample(self.U, self.H, self.W, s * self.P[:, 0] + bx, s * self.P[:, 1] + by)
        self.tone = robust_tone(u, self.T, self.w)
        return self.tone

    def coarse(self, s0, b0, scale_range, scale_step, shift):
        """Quarter-resolution search: candidate scales x every quarter shift
        (4 sheet px) within +-shift, robust error with a per-candidate mean
        colour offset, on the blocks that hold fit pixels only."""
        x0, y0, _, _ = self.cell
        q = self.q
        h4, w4 = self.c_shape
        m = int(math.ceil(shift / q))
        gy, gx = np.mgrid[-m:h4 + m, -m:w4 + m]
        px = (x0 + gx * q + 1.5).ravel(); py = (y0 + gy * q + 1.5).ravel()
        iy, ix = np.nonzero(self.c_w > 0)
        cw = self.c_w[iy, ix]
        cT = self.c_T[iy, ix]
        wsum = cw.sum()
        Wd = w4 + 2 * m
        offs = np.array([(dy, dx) for dy in range(-m, m + 1) for dx in range(-m, m + 1)])
        # flat index of block (iy, ix) shifted by (dy, dx) in the padded grid
        idx = (iy[None] + m + offs[:, :1]) * Wd + (ix[None] + m + offs[:, 1:])
        out = []
        n = int(round(scale_range / scale_step))
        for j in range(-n, n + 1):
            s = s0 * (1 + j * scale_step)
            # Keep the figure centre fixed when the scale changes.
            bx = b0[0] + (s0 - s) * self.centre[0]
            by = b0[1] + (s0 - s) * self.centre[1]
            u = sample(self.Ub, self.H, self.W, s * px + bx, s * py + by)
            d = u[idx] - cT[None]
            off = (d * cw[None, :, None]).sum(1) / wsum
            d -= off[:, None, :]
            d[..., 0] *= T_LIGHT
            r2 = (d * d).sum(-1)
            E = (cw[None] * (r2 / (r2 + T_C2))).sum(1) / wsum
            for (dy, dx), e in zip(offs, E):
                out.append((float(e), s, bx + s * q * dx, by + s * q * dy))
        out.sort(key=lambda t: t[0])
        return out

    def refine(self, s, bx, by, start=2.0, stop=.02, P=None, T=None, w=None, sub=1, full_below=None):
        """Compass search on (s about the figure centre, bx, by). `sub`
        thins the pixels while the step is >= full_below (the coarse part of
        the descent); the last steps always use every pixel."""
        P0 = self.P if P is None else P
        T0 = self.T if T is None else T
        w0 = self.w if w is None else w
        thin = (P0[::sub], T0[::sub], w0[::sub])
        step = start
        R = self.radius
        cur = thin if (sub > 1 and (full_below is None or step >= full_below)) else (P0, T0, w0)
        e = self.evaluate(s, bx, by, *cur)
        while step >= stop:
            want = thin if (sub > 1 and (full_below is None or step >= full_below)) else (P0, T0, w0)
            if want is not cur:
                cur = want
                e = self.evaluate(s, bx, by, *cur)
            P, Tv, w = cur
            moved = True
            while moved:
                moved = False
                best = (e, s, bx, by)
                for ds, dx, dy in ((step / R, 0, 0), (-step / R, 0, 0), (0, step, 0), (0, -step, 0),
                                   (0, 0, step), (0, 0, -step)):
                    ss = s * (1 + ds)
                    # scale about the figure centre
                    nbx = bx + (s - ss) * self.centre[0] + dx
                    nby = by + (s - ss) * self.centre[1] + dy
                    ee = self.evaluate(ss, nbx, nby, P, Tv, w)
                    if ee < best[0] - 1e-9:
                        best = (ee, ss, nbx, nby)
                if best[0] < e - 1e-9:
                    e, s, bx, by = best
                    moved = True
            step /= 2
        return e, s, bx, by

    def affine(self, s, bx, by, sub=2):
        """Free affine refinement (diagnostic only): returns rotation (deg)
        and the axis-scale ratio sx/sy."""
        P = self.P[::sub]; Tt = self.T[::sub]; w = self.w[::sub]
        c = self.centre
        A = np.array([s, 0, 0, s, bx + s * c[0], by + s * c[1]], np.float64)  # q = M (p - c) + t

        def ev(A):
            xs = A[0] * (P[:, 0] - c[0]) + A[1] * (P[:, 1] - c[1]) + A[4]
            ys = A[2] * (P[:, 0] - c[0]) + A[3] * (P[:, 1] - c[1]) + A[5]
            u = sample(self.U, self.H, self.W, xs, ys) * self.tone[0] + self.tone[1]
            d = u - Tt; d[:, 0] *= T_LIGHT
            r2 = (d * d).sum(1)
            return float((w * (r2 / (r2 + T_C2))).sum() / w.sum())

        e = ev(A)
        R = self.radius
        for step in (2.0, 1.0, .5, .25, .12):
            moved = True
            it = 0
            while moved and it < 60:
                moved = False; it += 1
                best = (e, A)
                for i in range(6):
                    d = step * s / R if i < 4 else step
                    for sg in (1, -1):
                        B = A.copy(); B[i] += sg * d
                        ee = ev(B)
                        if ee < best[0] - 1e-9:
                            best = (ee, B)
                if best[0] < e - 1e-9:
                    e, A = best
                    moved = True
        sx = math.hypot(A[0], A[2]); sy = math.hypot(A[1], A[3])
        rot = math.degrees(math.atan2(A[2] - A[1], A[0] + A[3]))
        return dict(rotationDeg=round(rot, 3), sxOverSy=round(sx / sy, 5), error=round(e, 5),
                    matrix=[round(float(v), 6) for v in A])


T_LIGHT = T['lightW']
T_C2 = T['rhoC'] ** 2


def _box_init(spec, key, box):
    """Similarity from the template box to the upload box: scale from the
    figure height (head top to soles), x from the head-region centre."""
    ref = template_layout(spec)[key]['box']
    th = ref[3] - ref[1]
    uh = box[3] - box[1]
    s = uh / th
    by = ((box[1] - s * ref[1]) + (box[3] - s * ref[3])) / 2
    bx = (box[0] + box[2]) / 2 - s * (ref[0] + ref[2]) / 2
    # centre-based correction (boxes are edge coordinates)
    return s, bx + .5 * (s - 1), by + .5 * (s - 1)


def _head_centre(fg, box):
    x0, y0, x1, y1 = box
    hh = int(round(.3 * (y1 - y0)))
    cols = np.nonzero(fg[y0:y0 + hh, x0:x1].any(0))[0]
    return (x0 + cols.min() + x0 + cols.max() + 1) / 2 if len(cols) else (x0 + x1) / 2


def fit_figures(U_rgb, fg, boxes, spec, timing):
    t0 = time.time()
    H, W = fg.shape
    Ulab = lab(U_rgb)
    U_flat = Ulab.reshape(-1, 3)
    Ub_flat = blur3(Ulab, 2).reshape(-1, 3)
    Tlab = lab(spec['template'])
    Lb = box_blur(Tlab[..., 0], 1)
    gy, gx = np.gradient(Lb)
    Tgrad = np.hypot(gx, gy).astype(np.float32)
    timing['lab'] = round(time.time() - t0, 2)
    ref = template_layout(spec)
    inits = {}
    for k, box in boxes.items():
        s, bx, by = _box_init(spec, k, box)
        # x from the head region (garments change the arms' width, not the head)
        rb = ref[k]['box']
        tfg = spec['templateFg']
        hc_t = _head_centre(tfg, rb)
        hc_u = _head_centre(fg, box)
        bx = hc_u - s * hc_t + .5 * (s - 1)
        inits[k] = (s, bx, by)
    s_med = float(np.median([v[0] for v in inits.values()]))
    figs = {}
    out = {}
    for k in boxes:
        tk = time.time()
        F = Figure(k, spec, Tlab, Tgrad, U_flat, (H, W), Ub_flat)
        cands = []
        s, bx, by = inits[k]
        cands += F.coarse(s, (bx, by), T['coarseScale'], T['coarseScaleStep'], T['coarseShift'])[:3]
        if abs(s / s_med - 1) > .01:
            # the six-box median scale, about the same figure centre
            bx2 = bx + (s - s_med) * F.centre[0]; by2 = by + (s - s_med) * F.centre[1]
            cands += F.coarse(s_med, (bx2, by2), T['coarseScale'], T['coarseScaleStep'], T['coarseShift'])[:2]
        best = None
        for e0, s1, bx1, by1 in cands:
            F.tone = (np.ones(3, np.float32), np.zeros(3, np.float32))
            F.fit_tone(s1, bx1, by1)
            e, s2, bx2, by2 = F.refine(s1, bx1, by1, start=2.0, stop=.25, sub=4)
            if best is None or e < best[0]:
                best = (e, s2, bx2, by2, F.tone)
        e, s, bx, by, tone = best
        F.tone = tone
        F.fit_tone(s, bx, by)
        e, s, bx, by = F.refine(s, bx, by, start=.5, stop=T['fineStop'], sub=3, full_below=.1)
        e = F.evaluate(s, bx, by)
        aff = F.affine(s, bx, by, sub=4)
        figs[k] = F
        out[k] = dict(s=s, b=(bx, by), error=e, tone=[F.tone[0].tolist(), F.tone[1].tolist()], affine=aff,
                      init=dict(box=list(boxes[k]), s=inits[k][0], b=list(inits[k][1:])),
                      seconds=round(time.time() - tk, 2))
    timing['fit'] = round(time.time() - t0, 2)
    return out, figs, Tlab


def global_fit(fits, spec):
    """One similarity for the whole sheet (least squares over every figure's
    anchors mapped by its own fit)."""
    P, Q = [], []
    for k, f in fits.items():
        a = spec['anchors'][k]
        P.append(a); Q.append(f['s'] * a + np.array(f['b']))
    P = np.concatenate(P); Q = np.concatenate(Q)
    # q = A p + B, A scalar
    pm, qm = P.mean(0), Q.mean(0)
    A = float(((P - pm) * (Q - qm)).sum() / ((P - pm) ** 2).sum())
    B = qm - A * pm
    return A, (float(B[0]), float(B[1]))


def figure_vs(fit, A, B, anchors):
    """Per-figure numbers against a reference similarity (A, B): relative
    scale, the shift at the anchors' centroid and the largest anchor
    distance, all in sheet px."""
    q1 = fit['s'] * anchors + np.array(fit['b'])
    q0 = A * anchors + np.array(B)
    d = (q1 - q0) / A
    c = anchors.mean(0)
    dc = ((fit['s'] * c + np.array(fit['b'])) - (A * c + np.array(B))) / A
    return dict(s=fit['s'] / A, dx=float(dc[0]), dy=float(dc[1]), maxPx=float(np.sqrt((d ** 2).sum(1)).max()))


# ---------------------------------------------------------------------------
# Resample into sheet space
# ---------------------------------------------------------------------------
def footprints(fits, spec, shape, grow=6):
    """Upload-space footprint of each registered figure: its template
    silhouette dilated `grow` sheet px, mapped by the figure's fit."""
    H, W = shape
    tfg = spec['templateFg']
    out = {}
    for k, f in fits.items():
        x0, y0, x1, y1 = spec['cells'][k]
        m = M.dilate(tfg[y0:y1, x0:x1], grow)
        s, (bx, by) = f['s'], f['b']
        qx0, qy0 = max(0, int(math.floor(s * x0 + bx)) - 2), max(0, int(math.floor(s * y0 + by)) - 2)
        qx1, qy1 = min(W, int(math.ceil(s * x1 + bx)) + 3), min(H, int(math.ceil(s * y1 + by)) + 3)
        fp = np.zeros((H, W), bool)
        if qx1 > qx0 and qy1 > qy0:
            yy, xx = np.mgrid[qy0:qy1, qx0:qx1]
            px = np.rint((xx - bx) / s).astype(int) - x0
            py = np.rint((yy - by) / s).astype(int) - y0
            ok = (px >= 0) & (py >= 0) & (px < x1 - x0) & (py < y1 - y0)
            sub = np.zeros(px.shape, bool)
            sub[ok] = m[py[ok], px[ok]]
            fp[qy0:qy1, qx0:qx1] = sub
        out[k] = fp
    return out


def figure_alphas(alpha, boxes, fits, spec):
    """The matte alpha split per figure. A figure keeps its own box (+3 px)
    and its own registered footprint (the seam that split two touching rows
    may have given its shoes to the box below), minus paint that lies only
    in another figure's footprint (a neighbour's hair or shoe reaching into
    the cell). Paint in no footprint stays with the box it is in (a shadow, a
    mark, a longer garment)."""
    fps = footprints(fits, spec, alpha.shape)
    out = {}
    H, W = alpha.shape
    for k, (x0, y0, x1, y1) in boxes.items():
        m = np.zeros((H, W), bool)
        m[max(0, y0 - 3):y1 + 3, max(0, x0 - 3):x1 + 3] = True
        other = np.zeros((H, W), bool)
        for j, fp in fps.items():
            if j != k:
                other |= fp
        m = (m | fps[k]) & ~(other & ~fps[k])
        out[k] = alpha * m
    return out


def resample(U_rgb, alpha, fits, spec):
    """One Lanczos resample per cell into sheet space. `alpha` is the matte
    alpha, or {figure: alpha} (figure_alphas)."""
    H, W = SHEET['height'], SHEET['width']
    rgb = np.full((H, W, 3), 255.0, np.float32)
    a = np.zeros((H, W), np.float32)
    img = Image.fromarray(np.clip(np.rint(U_rgb), 0, 255).astype(np.uint8))
    for k, f in fits.items():
        x0, y0, x1, y1 = spec['cells'][k]
        r = warp_cell(img, f['s'], f['b'], (x0, y0, x1, y1), Image.LANCZOS, fill=255)
        rgb[y0:y1, x0:x1] = np.asarray(r).astype(np.float32)
        ak = alpha[k] if isinstance(alpha, dict) else alpha
        aim = Image.fromarray(ak.astype(np.float32), 'F')
        al = warp_cell(aim, f['s'], f['b'], (x0, y0, x1, y1), Image.LANCZOS, fill=0)
        a[y0:y1, x0:x1] = np.clip(np.asarray(al), 0, 1)
    return rgb, a


def map_mask(mask, fits, spec, threshold=.5):
    """A boolean upload mask resampled into sheet space (bilinear)."""
    H, W = SHEET['height'], SHEET['width']
    out = np.zeros((H, W), bool)
    img = Image.fromarray(mask.astype(np.float32), 'F')
    for k, f in fits.items():
        x0, y0, x1, y1 = spec['cells'][k]
        r = warp_cell(img, f['s'], f['b'], (x0, y0, x1, y1), Image.BILINEAR, fill=0)
        out[y0:y1, x0:x1] = np.asarray(r) > threshold
    return out


def collar_kept(reg_rgb, reg_a, spec, level):
    """White cloth at the girls' collar: near-white paint inside the
    template silhouette (eroded 2 px) around the collar row, and the share
    of it the matte kept. A per-pixel whiteness test keeps none of it."""
    out = {}
    n_all = kept_all = 0
    for k, (x0, y0, x1, y1) in spec['cells'].items():
        if k[0] != 'f':
            continue
        cy = COLLAR_Y['f']
        band = np.zeros(reg_a.shape, bool)
        band[cy - 20:cy + 40, x0:x1] = True
        inside = M.erode(spec['templateFg'], 2) & band
        white = M.near_white(reg_rgb, level) & inside
        n = int(white.sum()); kept = int((reg_a[white] > .5).sum())
        out[k] = dict(whitePx=n, keptPx=kept)
        n_all += n; kept_all += kept
    out['whitePx'] = n_all
    out['keptShare'] = (kept_all / n_all) if n_all else None
    return out


def settle_pockets(mt, fits, boxes, spec):
    """Enclosed near-white pockets: background where the template is
    background there (a gap between arm and body, between hair strands),
    cloth everywhere else (a white collar or cuff inside its outline)."""
    lab_, comps = M.components(mt['pockets'])
    fg = mt['fg'].copy()
    alpha = mt['alpha'].copy()
    tfg = spec['templateFg']
    to_bg = np.zeros(fg.shape, bool)
    stats = dict(pockets=len(comps), toBackground=0, kept=0, keptPx=0, backgroundPx=0)
    if not comps:
        return fg, alpha, to_bg, stats
    ys, xs = np.nonzero(lab_)
    ls = lab_[ys, xs]
    order = np.argsort(ls, kind='stable')
    ys, xs, ls = ys[order], xs[order], ls[order]
    starts = np.searchsorted(ls, np.arange(1, lab_.max() + 2))
    for c in comps:
        i0, i1 = starts[c['label'] - 1], starts[c['label']]
        py, px = ys[i0:i1], xs[i0:i1]
        cx, cy = px.mean(), py.mean()
        owner = None
        for k, box in boxes.items():
            if box[0] - 40 <= cx <= box[2] + 40 and box[1] - 40 <= cy <= box[3] + 40:
                owner = k
                break
        if owner is None:
            share = 1.0
        else:
            f = fits[owner]
            sx = np.rint((px - f['b'][0]) / f['s']).astype(int)
            sy = np.rint((py - f['b'][1]) / f['s']).astype(int)
            ok = (sx >= 0) & (sy >= 0) & (sx < tfg.shape[1]) & (sy < tfg.shape[0])
            inside = np.zeros(len(px), bool)
            inside[ok] = tfg[sy[ok], sx[ok]]
            share = 1 - inside.mean()
        if share >= T['pocketBackground']:
            fg[py, px] = False; alpha[py, px] = 0; to_bg[py, px] = True
            stats['toBackground'] += 1; stats['backgroundPx'] += int(len(px))
        else:
            stats['kept'] += 1; stats['keptPx'] += int(len(px))
    return fg, alpha, to_bg, stats


# ---------------------------------------------------------------------------
# Checks in sheet space
# ---------------------------------------------------------------------------
def robust_tone(u, t, w=None, iters=6):
    """Lab tone map u -> t: a gain and offset on lightness, an offset on a*
    and b* (their range on skin and hair is too narrow to fit a gain: it
    collapsed toward the clip). Robust to a large share of changed pixels:
    it starts from the median offset and reweights with Tukey's biweight
    (scale from the MAD of the residuals), so a redrawn garment does not pull
    the map (a Cauchy weight let a recoloured top shift every other slot)."""
    u = u.astype(np.float64); t = t.astype(np.float64)
    wt = np.ones(len(u)) if w is None else np.asarray(w, np.float64)
    g = np.ones(3); o = np.median(t - u, 0)
    for _ in range(iters):
        d = u * g + o - t
        d[:, 0] *= T_LIGHT
        r = np.sqrt((d * d).sum(1))
        sigma = max(1.4826 * float(np.median(r)), 1.0)
        c = 4.685 * sigma
        rw = wt * np.where(r < c, (1 - (r / c) ** 2) ** 2, 0.0)
        if rw.sum() < 1e-6:
            break
        A = np.stack([u[:, 0], np.ones(len(u))], 1)
        Aw = A * rw[:, None]
        sol = np.linalg.lstsq(Aw.T @ A, Aw.T @ t[:, 0], rcond=None)[0]
        g[0] = np.clip(sol[0], .8, 1.25)
        o[0] = sol[1] if .8 < sol[0] < 1.25 else float((rw * (t[:, 0] - g[0] * u[:, 0])).sum() / rw.sum())
        for ch in (1, 2):
            o[ch] = float((rw * (t[:, ch] - u[:, ch])).sum() / rw.sum())
    return g.astype(np.float32), o.astype(np.float32)


def tone_fit_sheet(Ulab_s, Tlab, mask):
    """Per-sheet linear tone map (per Lab channel, robust) on stable pixels."""
    u = Ulab_s[mask]; t = Tlab[mask]
    if len(u) > 200000:
        sel = np.linspace(0, len(u) - 1, 200000).astype(int); u, t = u[sel], t[sel]
    return robust_tone(u, t)


# ---------------------------------------------------------------------------
# The whole registration
# ---------------------------------------------------------------------------
FIG_KO = {'m-front': '남자아이 앞모습', 'm-right': '남자아이 옆모습', 'm-back': '남자아이 뒷모습',
          'f-front': '여자아이 앞모습', 'f-right': '여자아이 옆모습', 'f-back': '여자아이 뒷모습'}


def register(path, spec=None, slot='top', sexes=('m', 'f'), keep_images=True, min_long_side=None):
    """Register one upload. Returns a result dict; result['ok'] is False when
    any failure code was raised. With keep_images, result['images'] holds
    numpy arrays (registered RGBA in sheet space, masks) for the report and
    for WP6. min_long_side lowers the size gate (tests of registration
    precision only; production keeps matte.SIZE_MIN)."""
    t_all = time.time()
    timing = {}
    spec = spec or garment_spec(slot, sexes)
    res = dict(version=1, spec=dict(kind=spec['kind'], slot=spec['slot'], sexes=list(spec['sexes'])),
               codes=[], warnings=[], figures={}, timing=timing, thresholds=T)
    rec, im = M.read_input(path)
    res['input'] = rec
    size_min = M.SIZE_MIN if min_long_side is None else min_long_side
    if rec['longSide'] < size_min:
        res['codes'].append(dict(code='SIZE_SMALL', detail='long side %d px < %d' % (rec['longSide'], size_min),
                                 value=rec['longSide'], limit=size_min))
        return _finish(res, t_all)
    if min_long_side is not None:
        res['sizeOverride'] = min_long_side
    rgb, alpha = M.to_rgb(im, rec)
    if rec['hasAlpha'] and (alpha < .98).mean() >= M.ALPHA_SHARE:
        rgb = rgb * alpha[..., None] + 255 * (1 - alpha[..., None])
    t0 = time.time()
    page = M.background(rgb, alpha)
    res['page'] = {k: v for k, v in page.items()}
    if not page['ok']:
        res['codes'].append(dict(code='BACKGROUND', detail=', '.join(page['reasons'])))
    mt = M.matte(rgb, alpha, page)
    timing['matte'] = round(time.time() - t0, 2)
    t0 = time.time()
    boxes, lcodes, linfo = find_layout(rgb, mt['fg'], spec)
    timing['layout'] = round(time.time() - t0, 2)
    linfo.pop('figureLabels', None)
    res['layout'] = dict(info=linfo, boxes={k: list(v) for k, v in (boxes or {}).items()})
    if lcodes or boxes is None:
        if not page['ok']:
            res['layout']['suppressed'] = [c['code'] for c in lcodes]  # the page is the cause
        else:
            res['codes'] += lcodes
        if boxes is None or any(c['code'] in ('LAYOUT_COUNT', 'LAYOUT_ORDER', 'LAYOUT_MIRROR', 'SQUASH') for c in lcodes):
            if keep_images:
                res['images'] = dict(upload=rgb, fg=mt['fg'])
            return _finish(res, t_all)
    fits, figs, Tlab = fit_figures(rgb, mt['fg'], boxes, spec, timing)
    A, B = global_fit(fits, spec)
    g_nom, b_nom = nominal_transform(spec, rec['size'])
    res['global'] = dict(s=A, b=list(B), nominal=dict(s=g_nom, b=list(b_nom)),
                         vsNominal=dict(scale=A / g_nom - 1, dx=(B[0] - b_nom[0]) / A, dy=(B[1] - b_nom[1]) / A))
    s_med = float(np.median([f['s'] for f in fits.values()]))
    for k, f in fits.items():
        v = figure_vs(f, A, B, spec['anchors'][k])
        fr = dict(s=f['s'], b=list(f['b']), sRel=v['s'], dx=v['dx'], dy=v['dy'], maxPx=v['maxPx'],
                  residual=f['error'], affine=f['affine'], init=f['init'], tone=f['tone'], seconds=f['seconds'],
                  scaleVsMedian=f['s'] / s_med - 1, parts=[], slots={})
        res['figures'][k] = fr
        rel = abs(fr['scaleVsMedian'])
        if rel > T['scaleFail']:
            res['codes'].append(dict(code='FIGURE_SCALE', figure=k, value=round(fr['scaleVsMedian'], 4), limit=T['scaleFail'],
                                     detail='%+.1f%% against the other figures' % (100 * fr['scaleVsMedian'])))
        elif rel > T['scaleWarn']:
            res['warnings'].append(dict(code='W_SCALE', figure=k, value=round(fr['scaleVsMedian'], 4)))
        aff = f['affine']
        if abs(aff['rotationDeg']) > T['squashRotDeg'] or abs(aff['sxOverSy'] - 1) > T['squashRatio']:
            res['codes'].append(dict(code='SQUASH', figure=k, value=dict(rotationDeg=aff['rotationDeg'], sxOverSy=aff['sxOverSy']),
                                     detail='rotation %.2f deg, sx/sy %.4f' % (aff['rotationDeg'], aff['sxOverSy'])))
        off = math.hypot(fr['dx'], fr['dy'])
        if off > T['movedPx']:
            res['codes'].append(dict(code='LAYOUT_MOVED', figure=k, value=round(off, 2), limit=T['movedPx'],
                                     detail='%.1f px from the other figures\' common placement' % off))
    # Collapse per-figure SQUASH into one sheet-level code when several figures agree.
    sq = [c for c in res['codes'] if c['code'] == 'SQUASH' and 'figure' in c]
    if len(sq) >= 2:
        res['codes'] = [c for c in res['codes'] if not (c['code'] == 'SQUASH' and 'figure' in c)]
        res['codes'].append(dict(code='SQUASH', figures=[c['figure'] for c in sq], detail='; '.join(
            '%s %s' % (c['figure'], c['detail']) for c in sq)))
    # Pockets, resample, checks.
    t0 = time.time()
    fg, al, pocket_bg, pstats = settle_pockets(mt, fits, boxes, spec)
    res['matte'] = dict(level=mt['level'], mode=mt['mode'], pockets=pstats)
    owned = figure_alphas(al, boxes, fits, spec)
    reg_rgb, reg_a = resample(rgb, owned, fits, spec)
    if spec['kind'] == 'garment':
        res['matte']['collar'] = collar_kept(reg_rgb, reg_a, spec, mt['level'])
    timing['resample'] = round(time.time() - t0, 2)
    t0 = time.time()
    # A distorted page or sheet (BACKGROUND, SQUASH) explains everything
    # below: report it alone instead of a list of consequences.
    if not any(c['code'] in ('BACKGROUND', 'SQUASH') for c in res['codes']):
        _marks(res, fg, boxes, fits)
        if spec['kind'] == 'garment':
            checks(res, reg_rgb, reg_a, spec, Tlab)
        elif spec.get('checks'):
            spec['checks'](res, reg_rgb, reg_a, spec, Tlab)  # e.g. the hair pipeline's own drift checks
        consolidate(res)
    timing['checks'] = round(time.time() - t0, 2)
    if keep_images:
        res['images'] = dict(upload=rgb, fg=fg, registered=np.dstack([reg_rgb, reg_a * 255]), alpha=reg_a,
                             pocketsBackground=pocket_bg, pockets=mt['pockets'])
    return _finish(res, t_all)


def _finish(res, t_all):
    res['timing']['total'] = round(time.time() - t_all, 2)
    res['ok'] = not res['codes']
    return res


def _marks(res, fg, boxes, fits):
    """FOREIGN_MARK: paint outside every figure box (+30 sheet px)."""
    s = float(np.median([f['s'] for f in fits.values()]))
    pad = int(round(T['boxPad'] * s))
    inside = np.zeros(fg.shape, bool)
    for x0, y0, x1, y1 in boxes.values():
        inside[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] = True
    lab_, comps = M.components(fg & ~inside)
    min_px = T['markMin'] * s * s
    marks = [c for c in comps if c['size'] >= min_px]
    total = sum(c['size'] for c in marks) / (s * s)
    res['marks'] = dict(components=len(marks), sheetPx=round(total, 1),
                        boxes=[c['bbox'] for c in sorted(marks, key=lambda c: -c['size'])[:12]],
                        specksIgnored=len(comps) - len(marks))
    if total > T['markFail']:
        res['codes'].append(dict(code='FOREIGN_MARK', value=round(total, 1), limit=T['markFail'],
                                 detail='%d marks outside the figures (%.0f px)' % (len(marks), total),
                                 boxes=res['marks']['boxes']))
    elif marks:
        res['warnings'].append(dict(code='W_SPECKS', value=round(total, 1),
                                    detail='%d small marks outside the figures removed' % len(marks)))


def checks(res, reg_rgb, reg_a, spec, Tlab):
    """Drift checks in sheet space (plan 'registration' step 8), one cell at
    a time (every mask operation runs on the cell crop)."""
    owner = spec['owner']
    # Tone anchors: what no garment product changes, i.e. the heads (face,
    # hair, eyes: a wide colour range) and the body skin. Fitting on every
    # stable pixel let a redrawn slot that covers most of them (a recoloured
    # top under a shorts product) pull the map and flag every other part.
    anchors = np.isin(owner, (OWNER['head'], OWNER['arm'], OWNER['leg'], OWNER['neck']))
    anchors &= ~M.dilate(spec['productMask'], 12)
    anchors = M.erode(anchors, 2)
    Ul = np.full(reg_rgb.shape, 0, np.float32)
    for k, (x0, y0, x1, y1) in spec['cells'].items():
        Ul[y0:y1, x0:x1] = lab(reg_rgb[y0:y1, x0:x1])
    g, o = tone_fit_sheet(Ul, Tlab, anchors)
    res['tone'] = dict(gain=[round(float(v), 4) for v in g], offset=[round(float(v), 3) for v in o])
    Ut = Ul * g + o
    for k, (x0, y0, x1, y1) in spec['cells'].items():
        C = _cell(spec, k, Ut, Tlab, reg_a)
        _cell_checks(res, spec, k, C)
        _floor_and_hair(res, spec, k, C)
    return Ut


def _cell(spec, k, Ut, Tlab, reg_a):
    x0, y0, x1, y1 = spec['cells'][k]
    sl = (slice(y0, y1), slice(x0, x1))
    prod_row = k[0] in spec['sexes']
    product = spec['productMask'][sl] if prod_row else np.zeros((y1 - y0, x1 - x0), bool)
    C = dict(key=k, origin=(x0, y0), owner=spec['owner'][sl], tfg=spec['templateFg'][sl], product=product,
             productRow=prod_row, stable=spec['stable'][k][sl], hairOcc=spec['hairOcclusion'][sl],
             U=Ut[sl], T=Tlab[sl], a=reg_a[sl])
    C['hair'] = C['owner'] == OWNER['head']
    # stable dE: window-minimum (r 2) on lightly blurred images (box r 1), so
    # codec noise (JPEG 4:2:0 chroma, WebP blocks) and sub-pixel edges do
    # not read as drift: JPEG q70 p95 9.8 -> 5.6, the real sheet 8.9 -> 6.2
    C['d1'] = winmin_de(blur3(C['U'], 1), blur3(C['T'], 1), 2, T['lightW'])
    C['d2'] = de(blur3(C['U'], 2), blur3(C['T'], 2))
    C['guard12'] = M.dilate(product, 12)
    # the product zone of EITHER row: the untouched row of a single-sex
    # product is judged on it by SINGLE_SEX_CHANGED, not by BODY_DRIFT
    C['guardAll'] = C['guard12'] if prod_row else M.dilate(spec['productMask'][sl], 12)
    return C


def part_masks(spec, k, C):
    """Stable body parts of one figure for the residual-shift check:
    forearm+hand per side, shin per side, shoe per side (and the torso for a
    shoes product). Each is the frozen owner of that part outside the
    product zone dilated 12 px, split at the figure's centre line."""
    owner = C['owner']
    g = spec['zones'][k]
    x0 = C['origin'][0]
    c = int(round(g['center'])) - x0
    w = owner.shape[1]
    parts = []
    sides = [('', 0, w)] if g['view'] == 'right' else [('L', 0, c), ('R', c, w)]
    kinds = [('arm', (3,), 'POSE_ARM'), ('leg', (5,), 'POSE_LEG'), ('shoe', (6,), 'POSE_LEG')]
    if spec['slot'] == 'shoes':
        kinds.append(('torso', (1, 4), 'POSE_LEG'))
    for name, labels_, code in kinds:
        for side, a, b in ([('', 0, w)] if name == 'torso' else sides):
            m = np.zeros(owner.shape, bool)
            m[:, a:b] = np.isin(owner[:, a:b], labels_)
            m &= ~C['guard12']
            if m.sum() < 150:
                continue
            parts.append(dict(name=name, side=side, code=code, mask=m))
    return parts


def part_shift(Ureg, Tl, m, search=8):
    """Translation (sheet px) of the registered upload against the template
    on one part (mask dilated 3 px so its outline counts): integer search in
    +-search px (2 px steps, then 1 px around the best), then a parabolic
    sub-pixel step."""
    mm = M.dilate(m, 3)
    iy, ix = np.nonzero(mm)
    h, w = mm.shape
    tt = Tl[iy, ix]
    cache = {}

    def err(dy, dx):
        if (dy, dx) in cache:
            return cache[(dy, dx)]
        yy = iy + dy; xx = ix + dx
        ok = (yy >= 0) & (yy < h) & (xx >= 0) & (xx < w)
        d = Ureg[np.clip(yy, 0, h - 1), np.clip(xx, 0, w - 1)] - tt
        d[:, 0] *= T_LIGHT
        r2 = (d * d).sum(1)
        v = float((r2 / (r2 + T_C2))[ok].mean()) if ok.any() else 1.0
        cache[(dy, dx)] = v
        return v

    grid = [(dy, dx) for dy in range(-search, search + 1, 2) for dx in range(-search, search + 1, 2)]
    best = min(grid, key=lambda t: err(*t))
    while True:
        cand = [(best[0] + a, best[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1)
                if abs(best[0] + a) <= search and abs(best[1] + b) <= search]
        nb = min(cand, key=lambda t: err(*t))
        if nb == best:
            break
        best = nb
    sy, sx = best

    def para(a, b, c):
        den = a - 2 * b + c
        return 0.0 if den <= 1e-12 else float(np.clip(.5 * (a - c) / den, -.5, .5))
    fy = para(err(sy - 1, sx), err(sy, sx), err(sy + 1, sx)) if abs(sy) < search else 0.0
    fx = para(err(sy, sx - 1), err(sy, sx), err(sy, sx + 1)) if abs(sx) < search else 0.0
    return sx + fx, sy + fy, err(sy, sx), err(0, 0), bool(abs(sy) == search or abs(sx) == search)


def _cell_checks(res, spec, k, C):
    fr = res['figures'][k]
    owner = C['owner']
    st = M.erode(C['stable'], 1) & ~C['guardAll']
    vals = C['d1'][st]
    fr['dE'] = float(np.median(vals)); fr['dEp95'] = float(np.percentile(vals, 95))
    zone = M.dilate(C['stable'], 8) & ~C['hair'] & ~C['guardAll']
    a_ = (C['a'] > .5) & zone; t_ = C['tfg'] & zone
    fr['stableIoU'] = float((a_ & t_).sum() / max(1, (a_ | t_).sum()))
    if fr['dE'] > T['stableDEMedian'] or fr['dEp95'] > T['stableDEP95']:
        res['codes'].append(dict(code='BODY_DRIFT', figure=k, part='stable',
                                 value=dict(median=round(fr['dE'], 2), p95=round(fr['dEp95'], 2)),
                                 detail='stable dE median %.1f / p95 %.1f' % (fr['dE'], fr['dEp95'])))
    if fr['stableIoU'] < T['stableIoU']:
        res['codes'].append(dict(code='BODY_DRIFT', figure=k, part='silhouette', value=round(fr['stableIoU'], 4),
                                 limit=T['stableIoU'], detail='stable silhouette IoU %.3f' % fr['stableIoU']))
    # Part residual shifts.
    worst = {}
    for p in part_masks(spec, k, C):
        sx, sy, e, e0, edge = part_shift(C['U'], C['T'], p['mask'], T['partSearch'])  # noqa
        r = math.hypot(sx, sy)
        ys, xs = np.nonzero(p['mask'])
        item = dict(part=p['name'], side=p['side'], dx=round(sx, 2), dy=round(sy, 2), shift=round(r, 2),
                    error=round(e, 4), error0=round(e0, 4), atSearchEdge=edge,
                    bbox=[int(xs.min() + C['origin'][0]), int(ys.min() + C['origin'][1]),
                          int(xs.max() + 1 + C['origin'][0]), int(ys.max() + 1 + C['origin'][1])])
        state = 'ok' if r <= T['partPass'] else ('warn' if r <= T['partWarn'] else 'fail')
        item['state'] = state
        fr['parts'].append(item)
        if p['name'] == 'torso' or state == 'ok':
            continue
        if state == 'warn':
            res['warnings'].append(dict(code='W_POSE', figure=k, part=p['name'] + p['side'], value=round(r, 2)))
            continue
        code = p['code']
        prev = worst.get(code)
        if prev is None or r > prev['value']:
            worst[code] = dict(code=code, figure=k, part=p['name'] + p['side'], value=round(r, 2), limit=T['partWarn'],
                               detail='%s%s moved %.1f px (dx %.1f, dy %.1f)' % (p['name'], p['side'], r, sx, sy))
    res['codes'] += list(worst.values())
    # Other garment slots, the untouched row of a single-sex product, body skin.
    body_guard = M.dilate(C['product'], T['bodyGuardPx'])
    hair2 = M.dilate(C['hair'], 2)
    names = [('bottom', (4,)), ('shoes', (6,)), ('top', (1, 2)), ('leg', (5,)), ('arm', (3,))]
    if C['productRow']:
        names = [(n, l) for n, l in names if n != spec['slot']]
    for name, labels_ in names:
        m = M.erode(np.isin(owner, labels_), 2)
        if C['productRow']:
            m &= ~(body_guard if name in ('leg', 'arm') else C['guard12'])
        m &= ~hair2
        if m.sum() < 80:
            continue
        share = float((C['d2'][m] > T['slotDE']).mean())
        med = np.median(C['U'][m] - C['T'][m], 0)
        shift = float(np.sqrt((med ** 2).sum()))
        changed = share > T['slotShare'][name] or shift > T['slotMedian']
        fr['slots'][name] = dict(share=round(share, 4), medianShift=round(shift, 2), px=int(m.sum()),
                                 limit=T['slotShare'][name], changed=changed)
        if not changed:
            continue
        if not C['productRow']:
            code = 'SINGLE_SEX_CHANGED'
        elif name in ('leg', 'arm'):
            code = 'BODY_DRIFT'
        else:
            code = 'OTHER_SLOT_CHANGED'
        res['codes'].append(dict(code=code, figure=k, part=name, slot=name if name in SLOT_OWNERS else None,
                                 value=dict(share=round(share, 3), medianShift=round(shift, 2)),
                                 detail='%s: %.0f%% of the pixels differ (limit %.0f%%), median shift dE %.1f' % (
                                     name, 100 * share, 100 * T['slotShare'][name], shift)))


MERGED = ('OTHER_SLOT_CHANGED', 'SINGLE_SEX_CHANGED', 'SHADOW', 'HAIR_OVER_GARMENT', 'BODY_DRIFT')


def _merge_codes(res):
    """One entry per (code, part) for the per-figure findings that read the
    same for every figure (a redrawn slot, shadows, longer hair, a body
    drift), with the figures listed in layout order; 'items' keeps each."""
    merged = []
    seen = {}
    for c in res['codes']:
        if c['code'] in MERGED and 'figure' in c:
            key = (c['code'], c.get('part'))
            if key in seen:
                seen[key]['figures'].append(c['figure'])
                seen[key]['items'].append(c)
                continue
            e = dict(code=c['code'], part=c.get('part'), slot=c.get('slot'), figures=[c['figure']], items=[c],
                     detail=c['detail'], value=c.get('value'))
            seen[key] = e
            merged.append(e)
        else:
            merged.append(c)
    res['codes'] = merged


def _floor_and_hair(res, spec, k, C):
    """SHADOW: paint at or below the frozen floor that the template (or the
    product zone) does not have there. HAIR_OVER_GARMENT: this sheet's own
    hair colour (learned from the unchanged head) over the product zone,
    connected to the head, beyond the frozen hair-occlusion mask."""
    fr = res['figures'][k]
    x0, y0 = C['origin']
    h = C['owner'].shape[0]
    floor = int(spec['zones'][k]['floor']) - y0
    band = np.zeros(C['owner'].shape, bool)
    band[max(0, floor - 12):h] = True
    extra = band & (C['a'] > .5) & ~M.dilate(C['tfg'] | C['product'], 6)
    n = int(extra.sum())
    fr['floorExtraPx'] = n
    if n > T['shadowPx']:
        res['codes'].append(dict(code='SHADOW', figure=k, value=n, limit=T['shadowPx'],
                                 detail='%d px of paint at the floor line that is not the figure' % n))
    if not C['productRow'] or spec['slot'] != 'top':
        return
    U, Tl = C['U'], C['T']
    hair_src = M.erode(C['hair'], 3) & (U[..., 0] < 55) & (de(U, Tl) < 12)
    if hair_src.sum() < 200:
        return
    hv = U[hair_src]
    mu = np.median(hv, 0)
    spread = float(np.percentile(de(hv, mu), 90))
    zone = C['product'] & ~M.dilate(C['hairOcc'], 4)
    hairish = (C['a'] > .5) & (de(U, mu) <= max(8.0, spread))
    cand = zone & hairish & (de(U, Tl) > 12)
    # connected to the head's own hair through hair-coloured paint anywhere
    # (a longer bob hangs past the shoulders first, then over the cloth)
    conn = M.connected_to(hairish | hair_src, hair_src) & cand
    npx = int(conn.sum())
    fr['hairOverPx'] = npx
    body = C['product'] & (C['a'] > .5)
    main = np.median(U[body], 0) if body.any() else mu
    if float(de(main[None], mu[None])[0]) < 12:
        fr['hairOverCheck'] = 'skipped: product colour close to the hair'
        return
    if npx > T['hairOverPx']:
        res['codes'].append(dict(code='HAIR_OVER_GARMENT', figure=k, value=npx, limit=T['hairOverPx'],
                                 detail='%d px of hair over the garment beyond the reference hair' % npx))


def consolidate(res):
    """Root causes first, then one entry per finding. A moved arm or leg
    (POSE_*) also shows as changed pixels of that figure's skin, shoes and
    stable region; a redrawn slot (OTHER_SLOT_CHANGED / SINGLE_SEX_CHANGED),
    a shadow or longer hair also lower that figure's stable numbers. Those
    consequences go to res['explained'], not to the codes the user acts on."""
    pose = {}
    for c in res['codes']:
        if c['code'] in ('POSE_ARM', 'POSE_LEG'):
            pose.setdefault(c['figure'], set()).add(c['code'])
    slot_figs = {c.get('figure') for c in res['codes'] if c['code'] in ('OTHER_SLOT_CHANGED', 'SINGLE_SEX_CHANGED')}
    shadow_figs = {c.get('figure') for c in res['codes'] if c['code'] in ('SHADOW', 'HAIR_OVER_GARMENT')}
    related = {'POSE_ARM': {'arm', 'top'}, 'POSE_LEG': {'leg', 'shoes', 'bottom'}}
    keep, explained = [], []
    for c in res['codes']:
        f = c.get('figure')
        part = c.get('part')
        why = None
        if c['code'] == 'BODY_DRIFT' and f in pose and (part in ('stable', 'silhouette') or any(
                part in related[p] for p in pose[f])):
            why = 'pose'
        elif c['code'] == 'BODY_DRIFT' and f in slot_figs and part in ('stable', 'silhouette'):
            why = 'slot'
        elif c['code'] == 'BODY_DRIFT' and f in shadow_figs and part == 'silhouette':
            why = 'shadow'
        elif c['code'] in ('OTHER_SLOT_CHANGED', 'SINGLE_SEX_CHANGED') and f in pose and any(
                part in related[p] for p in pose[f]):
            why = 'pose'
        if why:
            c['explainedBy'] = why
            explained.append(c)
        else:
            keep.append(c)
    res['codes'] = keep
    res['explained'] = explained
    _merge_codes(res)


def summary(res):
    """JSON-safe copy without the images."""
    return {k: v for k, v in res.items() if k != 'images'}
