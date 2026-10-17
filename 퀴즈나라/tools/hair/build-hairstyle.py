"""H5: a new hairstyle from a returned sheet (the hair template, assets/hair-template/머리-그림틀-<m|f>.png, with
'change only the hairstyle'): its hair as one layer on the sex's base head ('m:base'/'f:base', build-base-head.py).

  python3 -B tools/hair/build-hairstyle.py SHEET --sex m|f --shape NAME [--out DIR] [--install] [--debug]

  - Registration: the shared tools/avatar_build/register.py on a 1x3 spec (sheet space = the template's own
    1536 x 1024 grid); its stable mask is what a hairstyle never changes: the template's paint that the bald
    template (머리-그림틀-민머리-<m|f>.png, the base head at the same place) shares below the eyes (lower face,
    neck, collar, shoulders). A hairstyle raises the head top, so the scale is the sheet's own (as for hats).
  - Three-way: hair = the registered sheet's paint that is not the bald template's (Lab distance after a robust
    tone map on the stable mask), connected to the hair mass above the brows or outside the bald head, outside
    the eyes and the mouth. The face and the skin are never taken from the sheet: they stay the base head's.
  - Its alpha: the sheet's matte where the bald template is background, the distance's ramp over the skin; its
    colour unmixed from the bald paint under it, then turned into the dye's luminance (R = B = L, G = shine:
    the runtime dyes it like every hair layer).
  - Per view the hair goes over the base head's layers on the base's own grid; where it covers an eye, the blink
    covers give way (a cover drawn over a fringe would cut it).
  - Checks (codes in tools/hair/messages.json, Korean): the registration's own (LAYOUT_*, BACKGROUND, ...),
    HAIR_NONE (no hair found: the head moved or is missing), NECK_CHANGED (the neck or the collar redrawn or
    covered in front or side), HAIR_CROSSES_CELL (hair on a cell's edge), W_HAIR_COLOUR (not brown: the dye
    expects the template's brown, a warning).
  - Writes OUT/sd-hair-<sex>-<shape>.webp, OUT/<sex>-<shape>.json (the sd-hair-data.js entry, origin 'sheet',
    base '<sex>:base') and OUT/<sex>-<shape>-report.json; --install puts the atlas into assets/ and the entry
    into assets/sd-hair-sheet.json and sd-hair-data.js (build-heads.py build merges it again).
"""
import json
import os
import sys
import importlib.util

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
import headlib as HL  # noqa: E402
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402

_spec = importlib.util.spec_from_file_location('bbh', os.path.join(HERE, 'build-base-head.py'))
BB = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BB)
MB, BH = BB.MB, BB.BH

TPL = os.path.join(ROOT, 'assets', 'hair-template')
VIEWS = (('front', 'front'), ('right', 'profile'), ('back', 'back'))     # cell key, head view
CELL_W, SHEET = 512, (1536, 1024)
MESSAGES = os.path.join(HERE, 'messages.json')
LIM = dict(
    stableV=22.5,       # stable mask: below this head-unit row (the eyes' bottom), what a hairstyle leaves
    changeDE=14.,       # Lab distance to the bald template that counts as changed
    rampDE=(14., 30.),  # hair alpha over skin: 0 at the first, 1 at the second
    browV=18.5,         # the hair mass: changed paint above this row, or outside the bald head
    hairMinPx=1500,     # HAIR_NONE: fewer hair pixels in the front cell
    neckShare=.12,      # NECK_CHANGED: share of the neck and collar redrawn or covered (front, side)
    edgePx=3,           # HAIR_CROSSES_CELL: hair this close to a cell's side edge
    colourCos=.85,      # W_HAIR_COLOUR: the hair's chroma direction against the template brown
    hairMaha=4.,        # paint the sheet's hair could be: within this many deviations of its own colours
    holePx=400,         # holes in the hair mass smaller than this, of the hair's colours, are hair
    speckPx=40,         # and smaller than this, of any colour
    unmixSpan=40.,      # an edge's alpha from the hair's colour against what is under it, where they differ this much
    edgeBand=4,         # the hair's colour for its edges from this deep inside the mass (the rim's mixed paint is not)
    outlineBand=7,      # px outside the bald head where thin strokes are its redrawn outline
    gapPx=8,            # gaps up to twice this between the hair and the base head are hair behind the face,
    gapV=21.5,          # from this head-unit row down (the ear lobes, the jaw and the neck)
    shutPx=800,         # holes closed all round by the hair and the base head, smaller than this, are hair
    capL=(120., 160.),  # the dye's lightness (102 = the template brown) over which paint over skin is thinned hair
    tone=((.9, 1.12), (12., 8., 8.)),   # a sheet's tone drift (register.clamp_tone): long hair covers most of
                                        # the back's stable mask, the free map turned the hair into the shirt
)


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float64)


def meta():
    return json.load(open(os.path.join(TPL, '머리-그림틀.json')))


def to_px(ctm, u, v):
    return ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]


def eye_zones(sex, shape, m_t, base):
    """Eyes and mouth in template px (front and side): never hair (the sheet's redraw of them would read as
    changed), from the base head's own eye positions."""
    out = np.zeros(shape, bool)
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    f = base['views']['front']
    ctm = m_t['sexes'][sex]['views']['front']['ctm']
    for ex, ey in f['eyes']:
        x, y = to_px(ctm, ex, ey)
        out |= (np.abs(xx - x) < 2.6 * ctm[0]) & (np.abs(yy - y) < 1.9 * ctm[3])
    x, y = to_px(ctm, 16, 25.4)
    out |= (np.abs(xx - x) < 2.2 * ctm[0]) & (np.abs(yy - y) < 1.2 * ctm[3])
    p = base['views']['profile']
    ctm = m_t['sexes'][sex]['views']['profile']['ctm']
    ex, ey = p['landmarks']['eye']
    x, y = to_px(ctm, ex, ey)
    out |= (np.abs(xx - x) < 2.0 * ctm[0]) & (np.abs(yy - y) < 1.9 * ctm[3])
    return out


def brow_boxes(sex, m_t, base, B, bald_fg):
    """{cell key: [(x0, y0, x1, y1)]} template px round the bald template's brows (its dark strokes inside the face
    that end 3 head units above the eye landmark, which sits at the lower lid), grown 1.2 units sideways and
    1.5 up: bangs hang over them from above; a dark stroke there with skin above it is a brow redrawn a little
    apart (the old styles' brows were dyed with the hair: taken as hair, the face had two pairs)."""
    out = {}
    dark = (HL.lum_skin(B) < 150) & M.erode(bald_fg, 5)
    for i, (k, view) in enumerate(VIEWS):
        if view == 'back':
            continue
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        bv = base['views'][view]
        ey = max(e[1] for e in bv['eyes']) if 'eyes' in bv else bv['landmarks']['eye'][1]
        cell = np.zeros(dark.shape, bool)
        y0, y1 = int(to_px(ctm, 16, 13)[1]), int(to_px(ctm, 16, ey - 3)[1])
        cell[y0:y1, i * CELL_W:(i + 1) * CELL_W] = True
        _, comps = M.components(dark & cell, min_size=60)
        out[k] = []
        for c in comps:
            x0, y0, x1, y1 = c['bbox']
            out[k].append((x0 - 1.2 * ctm[0], y0 - 1.5 * ctm[3], x1 + 1.2 * ctm[0], y1 + .6 * ctm[3]))
    return out


def from_above(h, box, x_off):
    """Inside the box, keep the hair that comes down into it from the row above (one column either side)."""
    x0, y0, x1, y1 = int(box[0]) - x_off, int(box[1]), int(np.ceil(box[2])) - x_off, int(np.ceil(box[3]))
    x0, x1 = max(x0, 0), min(x1, h.shape[1])
    h = h.copy()
    prev = h[y0 - 1, x0:x1].copy()
    for y in range(y0, y1):
        reach = prev | np.r_[prev[1:], False] | np.r_[False, prev[:-1]]
        h[y, x0:x1] &= reach
        prev = h[y, x0:x1].copy()
    return h


def make_spec(sex):
    m_t = meta()
    T = load(os.path.join(TPL, '머리-그림틀-%s.png' % sex))
    B = load(os.path.join(TPL, '머리-그림틀-민머리-%s.png' % sex))
    fg = T.min(2) < 245
    same = np.abs(T - B).max(2) < 12
    cells, fit, anchors = {}, {}, {}
    for i, (k, view) in enumerate(VIEWS):
        x0, x1 = i * CELL_W, (i + 1) * CELL_W
        cells[k] = (x0, 0, x1, SHEET[1])
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        y_cut = to_px(ctm, 16, LIM['stableV'])[1]
        st = np.zeros(fg.shape, bool)
        st[int(y_cut):, x0:x1] = True
        st &= fg & same
        st = M.erode(st, 1)
        fit[k] = st
        ys, xs = np.nonzero(st)
        sel = np.linspace(0, len(ys) - 1, 12).astype(int)
        anchors[k] = np.stack([xs[sel], ys[sel]], 1).astype(np.float64)
    spec = R.make_spec('hair', T, fg, cells, [[k for k, _ in VIEWS]], fit, anchors, SHEET, (0, 0), slot='hair', sexes=(sex,),
                       toneLimit=LIM['tone'], sharedTone=True)
    return spec, T, B, m_t


def messages():
    return json.load(open(MESSAGES))


def hair_model(Ut, conf):
    """The sheet's own hair colours (Lab mean and inverse covariance) from the hair it certainly is."""
    x = Ut[conf]
    if len(x) > 50000:
        x = x[np.linspace(0, len(x) - 1, 50000).astype(int)]
    mu = x.mean(0)
    cov = np.cov((x - mu).T) + np.diag([16., 4., 4.])
    return mu, np.linalg.inv(cov)


def maha2(x, model):
    mu, icov = model
    dd = x - mu
    return np.einsum('...i,ij,...j->...', dd, icov, dd)


def hair_like(Ut, model, skin):
    """Paint the sheet's hair could be: within its colour spread (shadows, shine and the dark strokes in it) and
    nearer to it than to the skin's (a face redrawn a little wider or a jaw drawn lower is changed paint beside
    the bald head: taken as hair, it was dyed into a white band along the profile)."""
    mh = maha2(Ut, model)
    return (mh < LIM['hairMaha'] ** 2) & (mh < maha2(Ut, skin))


def fill_edges(col, full, r=12):
    """The colour of the whole hair carried out over its partial edges (nearest full pixel, r steps): unmixing a
    thin edge from the bald paint under it amplified the sheet's noise into white and pink specks."""
    out = col.copy()
    have = full.copy()
    for _ in range(r):
        acc = np.zeros(col.shape)
        n = np.zeros(col.shape[:2])
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(have, (dy, dx), (0, 1))
            acc += np.where(sh[..., None], np.roll(out, (dy, dx), (0, 1)), 0)
            n += sh
        grow = ~have & (n > 0)
        out[grow] = acc[grow] / n[grow, None]
        have |= grow
    return out, have


def extract(res, spec, B, sex, m_t, base):
    """Hair alpha and straight colour in template px, plus the hair checks (codes added to res)."""
    reg = res['images']['registered']
    U, a = reg[..., :3].astype(np.float64), reg[..., 3] / 255.
    Ul, Bl = R.lab(U), R.lab(B)
    stable = np.zeros(a.shape, bool)
    for k in spec['fit']:
        stable |= spec['fit'][k]
    g, o = R.clamp_tone(R.tone_fit_sheet(Ul, Bl, stable & (a > .9)), LIM['tone'])
    Ut = Ul * g + o
    d = R.winmin_de(Ut, Bl, r=1)
    bald_fg = B.min(2) < 245
    bald_fg = B.min(2) < 245
    # the eyes and the mouth on the face only: past the face's edge a fringe hanging in front of the eye is hair
    zones = eye_zones(sex, a.shape, m_t, base) & M.dilate(bald_fg, 1)
    changed = (a > .3) & (d > LIM['changeDE']) & ~zones
    # beside the page a light pixel is the darkest paint near it thinned by the white (build-base-head.py): the
    # matte took the outline's light halo as opaque, a light rim round dyed hair
    lum = HL.lum_skin(U)
    dark_l = lum.copy()
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            dark_l = np.minimum(dark_l, np.roll(lum, (dy, dx), (0, 1)))
    near_page = M.dilate(a < .05, 3)
    rim_a = np.where(near_page & (lum > dark_l + 20), np.minimum(a, np.clip((255 - lum) / np.maximum(255 - dark_l, 1), 0, 1)), a)
    hair = np.zeros(a.shape, bool)
    gap = np.zeros(a.shape, bool)
    codes, warnings = [], []
    masses = {}
    for i, (k, view) in enumerate(VIEWS):
        x0, x1 = i * CELL_W, (i + 1) * CELL_W
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        sl = (slice(None), slice(x0, x1))
        c = changed[sl]
        lab_, comps = M.components(c)
        y_brow = to_px(ctm, 16, LIM['browV'])[1]
        seed = np.zeros(c.shape, bool)
        seed[:int(y_brow)] = True
        seed |= ~M.dilate(bald_fg[sl], 2)          # outside the bald head (and its body): hair hanging free
        keep = np.unique(lab_[c & seed & M.erode(c, 1)])
        masses[k] = (np.isin(lab_, keep[keep > 0]) & c, y_brow)
    # the hair's own colours, from the mass above the brows (certainly hair)
    conf = np.zeros(a.shape, bool)
    for i, (k, _) in enumerate(VIEWS):
        h, y_brow = masses[k]
        top = np.zeros(h.shape, bool)
        top[:int(y_brow)] = True
        conf[:, i * CELL_W:(i + 1) * CELL_W] = M.erode(h, 3) & top & (a[:, i * CELL_W:(i + 1) * CELL_W] > .9)
    # the skin's: the bald template's face and neck, away from its outlines
    skin_px = bald_fg & ~zones & (HL.lum_skin(B) > 170) & M.erode(bald_fg, 4)
    model = hair_model(Ut, conf) if conf.sum() > 200 else None
    like = hair_like(Ut, model, hair_model(Bl, skin_px)) if model is not None else np.zeros(a.shape, bool)
    res['hairLike'] = dict(hair=round(float(like[conf].mean()), 4) if conf.any() else None,
                           skin=round(float(like[skin_px & ~changed].mean()), 4))
    brows = brow_boxes(sex, m_t, base, B, bald_fg)
    for i, (k, view) in enumerate(VIEWS):
        x0, x1 = i * CELL_W, (i + 1) * CELL_W
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        sl = (slice(None), slice(x0, x1))
        h, y_brow = masses[k]
        c = changed[sl]
        # the mass again from the hair's own paint only (changed paint of other colours beside it is a redrawn
        # face, jaw or collar), then its anti-aliased rim: changed paint within 2 px of it
        core = c & like[sl]
        lab_, _ = M.components(core)
        seed = np.zeros(c.shape, bool)
        seed[:int(y_brow)] = True
        free = ~M.dilate(bald_fg[sl], 2)
        # hanging free, a piece is hair from 5 px thick: a stroke of a head outline drawn wider floated by the nape
        keep = np.unique(lab_[core & ((seed & M.erode(core, 1)) | (free & M.erode(core, 2)))])
        h = np.isin(lab_, keep[keep > 0])
        # just outside the bald head a thin dark stroke along it is a head outline redrawn a little larger, not hair
        # (it stood as a light arc round the nape): there the hair is what an opening of 2 px keeps
        band = M.dilate(bald_fg[sl], LIM['outlineBand']) & ~bald_fg[sl]
        h &= ~band | M.dilate(M.erode(h, 2), 2)
        h = h | (M.dilate(h, 2) & c & ~band)
        # the hair's strokes where they meet the bald head's outline are close to it in colour: thin holes in the
        # mass (the base's outline showed through the hair); filled where the sheet's paint is the hair's own
        z = ~zones[sl] & (a[sl] > .3) & like[sl]
        h = h | (M.erode(M.dilate(h, 3), 3) & z)
        lab0, n0, sizes = M.label(~h)
        border = np.unique(np.concatenate([lab0[0], lab0[-1], lab0[:, 0], lab0[:, -1]]))
        small = (sizes < LIM['holePx']) & ~np.isin(np.arange(n0 + 1), border)
        small[0] = False
        h = h | (small[lab0] & z)
        # specks inside the mass are its shine whatever their colour (left out, the nape showed through the hair)
        tiny = (sizes < LIM['speckPx']) & ~np.isin(np.arange(n0 + 1), border)
        tiny[0] = False
        h = h | (tiny[lab0] & (a[sl] > .3) & ~zones[sl])
        for box in brows.get(k, ()):
            h = from_above(h, box, x0)
        # a face drawn wider than the base's leaves its paint between the hair and the base head: as nothing, the
        # page showed through beside the jaw; it is the hair behind the face (its colour from the hair next to it)
        # (beside the jaw and the neck only: higher up, a fringe in front of a wider face is not hair to fill)
        both = h | bald_fg[sl]
        g = M.erode(M.dilate(both, LIM['gapPx']), LIM['gapPx']) & ~both & (a[sl] > .5) & c
        g[:int(to_px(ctm, 16, LIM['gapV'])[1])] = False
        if view == 'back':
            g[:] = False        # no face: a back of the head drawn wider is skin, it stood as a striped block
        # and anywhere, a small hole closed all round by the hair and the base head (an ear drawn elsewhere)
        lab1, n1, sz1 = M.label(~both)
        edge1 = np.unique(np.concatenate([lab1[0], lab1[-1], lab1[:, 0], lab1[:, -1]]))
        shut = (sz1 < LIM['shutPx']) & ~np.isin(np.arange(n1 + 1), edge1)
        shut[0] = False
        g |= shut[lab1] & c      # (changed paint only: the shirt's white flowers are holes in the bald template too)
        gap[sl] = g
        h = h | g
        hair[sl] = h
        # checks
        if k == 'front' and h.sum() < LIM['hairMinPx']:
            codes.append(dict(code='HAIR_NONE', figure=k, value=int(h.sum()), limit=LIM['hairMinPx']))
        if view != 'back':
            # the neck and the collar redrawn, covered by something else or erased (hair over them is fine)
            y_chin = to_px(ctm, 16, 28.6)[1]
            neck = np.zeros(c.shape, bool)
            neck[int(y_chin):] = True
            neck &= bald_fg[sl] & spec['fit'][k][sl]
            redrawn = ((d[sl] > LIM['changeDE'] + 6) | (a[sl] < .5)) & ~(like[sl] & (a[sl] > .5))
            share = float((neck & redrawn).sum()) / max(int(neck.sum()), 1)
            res.setdefault('neckShare', {})[k] = round(share, 4)
            if share > LIM['neckShare']:
                codes.append(dict(code='NECK_CHANGED', figure=k, value=round(share, 3), limit=LIM['neckShare']))
        edge = np.zeros(c.shape, bool)
        edge[:, :LIM['edgePx']] = True
        edge[:, -LIM['edgePx']:] = True
        if (edge & (a[sl] > .5) & ~M.dilate(bald_fg[sl], 2)).sum() > 20:
            codes.append(dict(code='HAIR_CROSSES_CELL', figure=k))
    # inside the mass the hair is whole and its colour the sheet's (a hair stroke over the bald head's dark outline
    # is close to it in colour: by distance alone the outline showed through the hair). On its edges the colour is
    # the whole hair's next to it and the alpha the paint's share of it over what lies under (the bald head, or the
    # page): unmixing a thin edge from the bald paint amplified the sheet's noise into a light rim round dyed hair.
    inner = M.erode(hair, 2)
    deep = M.erode(hair, LIM['edgeBand']) & ~gap
    under = np.where(bald_fg[..., None], B, 255.)
    hc, have = fill_edges(U, deep, r=14)
    span = hc - under
    den = (span * span).sum(-1)
    proj = ((U - under) * span).sum(-1) / np.maximum(den, 1)
    ramp = np.clip((d - LIM['rampDE'][0]) / (LIM['rampDE'][1] - LIM['rampDE'][0]), 0, 1)
    sure = have & (den > LIM['unmixSpan'] ** 2) & ~deep     # the hair's colour differs enough from what is under it
    thin = sure & (proj < .98)          # lighter than the hair next to it: thinned by what is under (darker is ink)
    loose = ~deep & ~sure & ~inner      # no whole hair near: the distance ramp, beside the page the halo's alpha
    edge_a = np.where(bald_fg, ramp, np.minimum(ramp, rim_a))
    alpha = np.where(thin, np.clip(proj, 0, 1), np.where(loose, edge_a, 1.)) * hair
    al = alpha[..., None]
    unmixed = np.clip((U - (1 - al) * under) / np.maximum(al, .05), 0, 255)
    col = np.where(thin[..., None], hc, np.where(loose[..., None], unmixed, U))
    # paint lighter than any hair over the skin is hair thinned by the skin under it (a fade's stubble): whole, its
    # dye's lightness ran past twice the template's and a pink dye turned it white. The old layers keep the hair's
    # lightness under 1.4x and the stubble's share in the alpha; so here: from capL[0] to capL[1] the paint goes
    # over to the style's usual hair (its deep pixels' median lightness) thinned against the bald paint under it.
    brown = HL.hexrgb(BB.HAIR1)
    lu = 102. * (col @ brown) / (brown @ brown)
    l_med = float(np.median(lu[deep])) if deep.any() else 90.
    usual = brown * l_med / 102.
    skin_under = bald_fg & (HL.lum_skin(B) > 170)
    sp = usual - B
    a_usual = np.clip(((U - B) * sp).sum(-1) / np.maximum((sp * sp).sum(-1), 1), 0, 1)
    t = np.clip((lu - LIM['capL'][0]) / (LIM['capL'][1] - LIM['capL'][0]), 0, 1) * (hair & skin_under)
    over = t > 0
    alpha = alpha * (1 - t) + np.minimum(alpha, a_usual) * t
    col = col * (1 - t[..., None]) + usual * t[..., None]
    res['hairL'] = round(l_med, 1)
    alpha = np.where(gap, 1., alpha)
    col = np.where(gap[..., None], np.where(have[..., None], hc, usual), col)
    # where whole hair outside meets the bald template's outermost pixel (the neck's or the jaw's edge, there mixed
    # with the page), the hair covers it: the body's edge and the hair's, both thin, left a line of the page between
    ring = bald_fg & ~M.erode(bald_fg, 1)
    meet = hair & ring & M.dilate(hair & ~bald_fg & (alpha > .9), 2)
    alpha = np.where(meet, 1., alpha)
    col = np.where((meet & have)[..., None], hc, col)
    res['gapPx'] = int(gap.sum())
    res['thinnedPx'] = int(over.sum())
    sel = hair & (alpha > .8)
    if sel.sum() > 200:
        brown = HL.hexrgb(BB.HAIR1)
        cc = col[sel] - col[sel].mean(1, keepdims=True)
        bb = brown - brown.mean()
        cos = float(np.median((cc @ bb) / (np.linalg.norm(cc, axis=1) * np.linalg.norm(bb) + 1e-6)))
        res['hairColourCos'] = round(cos, 3)
        if cos < LIM['colourCos']:
            warnings.append(dict(code='W_HAIR_COLOUR', value=round(cos, 3), limit=LIM['colourCos']))
    res['codes'] += codes
    res['warnings'] += warnings
    res['hairPx'] = {k: int(hair[:, i * CELL_W:(i + 1) * CELL_W].sum()) for i, (k, _) in enumerate(VIEWS)}
    res['ok'] = not res['codes']
    return alpha, col, hair


def base_layers(sex, base, view, head):
    """The base head's layers of one view on its source grid (float straight RGBA)."""
    return MB.reference_layers(head, base, view)


PAD = 160      # source px round the base's grid: long hair reaches far past the base head (its ends were cut flat)


def units_padded(head, shape):
    """Unit coordinates of a grid PAD px larger than the head's source grid on every side."""
    s, ox, oy = HL.placement(head)
    f = head['frame']
    h, w = shape
    xs = (np.arange(w) - PAD + .5) * s + ox
    ys = (np.arange(h) - PAD + .5) * s + oy
    return np.meshgrid(xs / HL.PX + f['x'], ys / HL.PX + f['y'])


def style_views(sex, base, alpha_t, col_t, m_t):
    """Per head view: the base layers with the hair over them, on the base's grid padded by PAD."""
    meta_old = HL.load_old(os.path.join(ROOT, '검증', '머리', '옛머리'))
    brown = HL.hexrgb(BB.HAIR1)
    out = {}
    for i, (k, view) in enumerate(VIEWS):
        head = next(h for h in meta_old['heads'] if h['sex'] == sex and h['shape'] == BB.REFERENCE[sex] and h['view'] == view)
        layers, v = base_layers(sex, base, view, head)
        layers = {kk: np.pad(img, ((PAD, PAD), (PAD, PAD), (0, 0))) for kk, img in layers.items()}
        shape = layers['skin'].shape[:2]
        U_, V_ = units_padded(head, shape)
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        X, Y = to_px(ctm, U_, V_)
        # the padded grid reaches past the cell: its neighbours' hair is not this view's
        a = BB.bilinear(alpha_t, X, Y) * ((X >= i * CELL_W + 1) & (X < (i + 1) * CELL_W - 1))
        c = BB.bilinear(col_t, X, Y)
        L = np.clip(102. * (c @ brown) / (brown @ brown), 0, 255)
        st = MB.Stack(shape)
        # the base's layers are additive parts of one picture (their alphas sum to its coverage), not layers over
        # one another: stacked 'over', each outline's share of a pixel thinned the skin under it (see-through
        # lines along the ear's and the jaw's inner outlines)
        for name in ('skin', 'fixed', 'iris', 'hair'):
            if name in layers:
                al_ = layers[name][..., 3:4] / 255.
                st.acc[name] = np.concatenate([layers[name][..., :3] * al_, al_], axis=2)
        st.over('hair', np.stack([L, np.maximum(0, L - 160) * .38, L], -1), a)
        res = st.layers()
        for name, img in layers.items():
            if name.startswith('blink'):
                img = img.copy()
                img[..., 3] *= 1 - np.clip(a, 0, 1)      # a cover never paints over the hair
                res[name] = img
        out[view] = res
    return out


def write(sex, shape, base, views, out_dir, install=False):
    name = 'sd-hair-%s-%s.webp' % (sex, shape)
    flat = {}
    for view, layers in views.items():
        for k, img in layers.items():
            t = BB.trim(img)
            if t:
                flat[(view, k)] = t
    pos, (W, H) = BH.pack({k: v[0] for k, v in flat.items()})
    atlas = np.zeros((H, W, 4), np.uint8)
    for k, (img, _) in flat.items():
        x, y = pos[k]
        atlas[y:y + img.shape[0], x:x + img.shape[1]] = img
    path = os.path.join(ROOT, 'assets', name) if install else os.path.join(out_dir, name)
    Image.fromarray(atlas).save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    entry = {'sex': sex, 'shape': shape, 'tile': base['tile'], 'file': 'assets/' + name if install else os.path.relpath(path, ROOT),
             'sha256': BH.sha(path), 'size': [W, H], 'origin': 'sheet', 'base': '%s:base' % sex, 'views': {}}
    for view in ('front', 'profile', 'back'):
        bv = base['views'][view]
        k_, (ux0, uy0) = bv['k'], bv['origin']
        v = {kk: bv[kk] for kk in ('k', 'origin', 'registration', 'jaw', 'eyes', 'landmarks', 'eyeWidth', 'faceTone') if kk in bv}
        v['layers'] = {}
        for (vw, lk), (img, at) in sorted(flat.items()):
            if vw == view:
                x, y = pos[(vw, lk)]
                hh, ww = img.shape[:2]
                v['layers'][lk] = [x, y, ww, hh, round(ux0 + (at[0] - PAD) * k_, 4), round(uy0 + (at[1] - PAD) * k_, 4), round(ww * k_, 4), round(hh * k_, 4)]
        entry['views'][view] = v
    with open(os.path.join(out_dir, '%s-%s.json' % (sex, shape)), 'w') as f:
        json.dump(entry, f, ensure_ascii=False, indent=1, sort_keys=True)
    if install:
        rec_path = os.path.join(ROOT, 'assets', 'sd-hair-sheet.json')
        rec = json.load(open(rec_path)) if os.path.exists(rec_path) else {
            'about': 'Generated by tools/hair/build-hairstyle.py --install (H5 sheet styles); build-heads.py build merges these entries into sd-hair-data.js. Do not edit.',
            'styles': {}}
        rec['styles']['%s:%s' % (sex, shape)] = entry
        with open(rec_path, 'w') as f:
            json.dump(rec, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
        BB.merge_into_data(rec)
    return entry, path


def crosses_cells(res):
    """The cell edges (x = 512, 1024 on the template's width) the upload's paint crosses above the cut, when the
    layout check counted too few figures."""
    if not any(c['code'] == 'LAYOUT_COUNT' for c in res['codes']) or 'fg' not in res.get('images', {}):
        return []
    fg = res['images']['fg']
    g = fg.shape[1] / SHEET[0]
    out = []
    for x in (CELL_W, 2 * CELL_W):
        col = fg[:int(.75 * fg.shape[0]), int(round(g * x)) - 1:int(round(g * x)) + 1].any(1)
        if col.sum() > 4 * g:
            out.append(x)
    return out


def build(sheet, sex, shape, out_dir, install=False, keep=False, debug=False):
    os.makedirs(out_dir, exist_ok=True)
    spec, T, B, m_t = make_spec(sex)
    base = json.load(open(os.path.join(ROOT, 'assets', 'sd-hair-base.json')))['styles']['%s:base' % sex]
    res = R.register(sheet, spec, slot='hair')
    report = {k: res.get(k) for k in ('ok', 'codes', 'warnings', 'global', 'figures', 'input', 'timing')}
    if not res['ok'] and 'images' not in res or 'registered' not in res.get('images', {}):
        report['stage'] = 'registration'
        crossed = crosses_cells(res)
        if crossed:
            # hair over a cell's edge joins two figures: the layout finds two, the cause is the hair
            res['codes'] = [c for c in res['codes'] if c['code'] != 'LAYOUT_COUNT'] + [
                dict(code='HAIR_CROSSES_CELL', figure='between', value=crossed, detail='the layout found too few figures')]
            report['codes'] = res['codes']
        json.dump(report, open(os.path.join(out_dir, '%s-%s-report.json' % (sex, shape)), 'w'), ensure_ascii=False, indent=1, default=str)
        return res, None
    alpha, col, hair = extract(res, spec, B, sex, m_t, base)
    report.update(ok=res['ok'], codes=res['codes'], warnings=res['warnings'],
                  **{k: res.get(k) for k in ('hairPx', 'hairColourCos', 'hairLike', 'neckShare', 'thinnedPx', 'hairL', 'gapPx')})
    entry = None
    if res['ok'] or debug:
        views = style_views(sex, base, alpha, col, m_t)
        if res['ok']:
            entry, _ = write(sex, shape, base, views, out_dir, install)
        if debug:
            debug_board(sex, shape, res, alpha, hair, views, base, out_dir)
    json.dump(report, open(os.path.join(out_dir, '%s-%s-report.json' % (sex, shape)), 'w'), ensure_ascii=False, indent=1, default=str)
    if keep:
        res['hair'] = dict(alpha=alpha, colour=col, mask=hair)
    return res, entry


def render_padded(layers, head, hair, skin, bg=(30, 40, 90)):
    """The padded layers recoloured like the runtime and placed in the head frame, 200 px taller (long hair)."""
    W, H = HL.frame_size(head['frame'])
    H += 200
    acc = np.zeros((H, W, 4))
    for lk, img in layers.items():
        img = img.copy()
        rgb = img[..., :3].reshape(-1, 3)
        if lk == 'hair':
            rgb = np.clip(HL.hexrgb(hair)[None, :] * rgb[:, :1] / 102. + rgb[:, 1:2], 0, 255)
        elif lk == 'skin':
            rgb = np.clip(rgb @ BH.tone_matrix(skin).T, 0, 255)
        img[..., :3] = rgb.reshape(img.shape[:2] + (3,))
        p_ = HL.place(img, head, size=(W, H), at=(-PAD, -PAD))
        a = p_[..., 3:4] / 255.
        acc[..., :3] += p_[..., :3] * a
        acc[..., 3:4] += a
    a = np.clip(acc[..., 3:4], 0, 1)
    rgb = np.where(a > 0, acc[..., :3] / np.maximum(acc[..., 3:4], 1e-9), 0)
    return (rgb * a + np.array(bg, float) * (1 - a)).astype(np.uint8)


def debug_board(sex, shape, res, alpha, hair, views, base, out_dir):
    """OUT/<sex>-<shape>-확인.png: per view the registered sheet | the hair found (red, its alpha) | the new
    style drawn from its layers on dark blue (tone 0, 갈색) | the same with 진한 피부, 분홍 (half size);
    OUT/<sex>-<shape>-확인-큰.png: the two renders at full size."""
    meta_old = HL.load_old(os.path.join(ROOT, '검증', '머리', '옛머리'))
    reg = res['images']['registered']
    rows, big = [], []
    for i, (k, view) in enumerate(VIEWS):
        x0, x1 = i * CELL_W, (i + 1) * CELL_W
        U = reg[:, x0:x1, :3].astype(np.float64)
        y = np.nonzero((reg[:, x0:x1, 3] > 10).any(1))[0]
        y0, y1 = (max(0, y.min() - 10), min(U.shape[0], y.max() + 10)) if len(y) else (0, U.shape[0])
        ov = U * (1 - .6 * alpha[:, x0:x1, None]) + np.array([230., 30, 30]) * .6 * alpha[:, x0:x1, None]
        head = next(h for h in meta_old['heads'] if h['sex'] == sex and h['shape'] == BB.REFERENCE[sex] and h['view'] == view)
        bv = base['views'][view]
        lay = {kk: x for kk, x in views[view].items() if not kk.startswith('blink')}
        r1 = render_padded(lay, head, BB.HAIR1, '#ffe2cc')
        r2 = render_padded(lay, head, '#f291c6', '#a4693f')
        h = y1 - y0
        big.append(np.concatenate([r1, r2], 1))
        tiles = [U[y0:y1], ov[y0:y1]] + [np.asarray(Image.fromarray(r).resize((int(r.shape[1] * h / r.shape[0]), h))) for r in (r1, r2)]
        rows.append(np.concatenate([np.clip(t, 0, 255).astype(np.uint8) for t in tiles], 1))
    W = max(r.shape[1] for r in rows)
    img = Image.new('RGB', (W, sum(r.shape[0] + 6 for r in rows)), 'white')
    yy = 0
    for r in rows:
        img.paste(Image.fromarray(r), (0, yy))
        yy += r.shape[0] + 6
    img = img.resize((img.width // 2, img.height // 2))
    img.save(os.path.join(out_dir, '%s-%s-확인.png' % (sex, shape)))
    # the renders at their own size (the seams and specks the half-size board hides), the head's rows only
    for view, r in zip(('front', 'profile', 'back'), big):
        rows_ = np.nonzero((np.abs(r.astype(int) - [30, 40, 90]).max(2) > 8).any(1))[0]
        if len(rows_):
            big[('front', 'profile', 'back').index(view)] = r[max(0, rows_.min() - 8):rows_.max() + 8]
    W = max(r.shape[1] for r in big)
    img = Image.new('RGB', (W, sum(r.shape[0] + 6 for r in big)), 'white')
    yy = 0
    for r in big:
        img.paste(Image.fromarray(r), (0, yy))
        yy += r.shape[0] + 6
    img.save(os.path.join(out_dir, '%s-%s-확인-큰.png' % (sex, shape)))


def explain(res):
    msgs = messages()
    lines = []
    for c in res.get('codes', []) + res.get('warnings', []):
        m = msgs['codes'].get(c['code']) or {}
        lines.append('%s %s: %s' % ('실패' if c in res.get('codes', []) else '경고', c['code'], m.get('title', c['code'])))
    return lines


def main(argv):
    opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
    sheet, sex, shape = argv[0], opt('--sex'), opt('--shape')
    if sex not in ('m', 'f') or not shape:
        raise SystemExit(__doc__)
    out = opt('--out', os.path.join(ROOT, '검증', '머리', '새머리'))
    res, entry = build(sheet, sex, shape, out, install='--install' in argv, debug='--debug' in argv)
    for line in explain(res):
        print(line)
    print('%s:%s %s, hair px %s' % (sex, shape, 'ok' if res['ok'] else 'FAIL', res.get('hairPx')))
    return 0 if res['ok'] else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
