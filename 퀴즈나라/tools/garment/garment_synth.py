"""Garment-level synthetic sheets with generated truth (stage 3, WP6; the
building blocks of the WP8 synthetic suite).

Every variant starts from the drawn basic garments (segment.py drawn_layers:
the legacy layers with their drawn cuff/collar/shorts edges) and edits a
garment layer by code (resampling, recolouring): nothing is painted by hand.
The edited layer IS the generated truth; the sheet is the frozen body, head
and other slots composited with it in the runtime's z order, then taken
through the ChatGPT path (tools/garment/synth.py chatgpt_path: placement,
1536x1024 resize) and saved as WebP q80 (or PNG).

  compose(slot, product)            sheet RGBA: head + layers in z order,
                                    `product` replacing the slot's layers
  stretch_sleeves(layer, key, dt)   sleeves longer by dt px along the resting
                                    arm (the lower half of each sleeve stretched)
  puff_sleeves(layer, key, s)       sleeves scaled by s about the shoulder joint
  hem_shift(layer, key, d)          torso hem moved d px (the band from the
                                    chest down stretched or squeezed)
  widen_cuffs(layer, key, f)        shorts legs below the crotch flared by f
                                    outward from each leg's inner side
  taller_shoes(layer, key, d)       shoes' upper stretched d px upward
  cream(layer, mask, rgb)           recoloured to `rgb` with its own shading,
                                    per figure (the figure's main colour = rgb)
  skin_band(layer, key, n, edge)    negative control: n rows of skin at the
                                    hem or collar edge (alpha kept)
  long_sleeves(rgb, end)            the resting arms painted as a long sleeve to
                                    `end` px above the wrists, with the strips' truth
  main_colour(layer, key), skin_rgb() measured colours of the synthetic / body
  extend_under(lower, before, after) the bottom extended up (rebuild_cloth)
                                    over what a shorter top uncovers
  render(E, path, kind)             'webp80' | 'png' | 'identity' (the sheet
                                    on the template frame, 1629x1086 PNG)
All geometry is in sheet px; frozen zones and joints come from
tools/garment/frozen/zones.json and assets/sd-foundation-ref-data.js.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import segment as SG  # noqa: E402
import synth as SY  # noqa: E402
from avatar_build.common import TEMPLATE  # noqa: E402

# The template the synthetic sheets are drawn on: None the light one, 'dark' the dark-skin template
# (tools/garment/make-dark-template.py; verify-pipeline.py --base dark): the body and head take its skin.
BASE = None


# ---------------------------------------------------------------------------
# Resampling (premultiplied, bilinear) by an inverse map
# ---------------------------------------------------------------------------
def sample(layer, qx, qy):
    """layer (H, W, 4 float straight alpha) at float source coordinates
    (pixel centres at i + .5), bilinear on premultiplied colour."""
    H, W = layer.shape[:2]
    a = layer[..., 3:] / 255.0
    pm = np.concatenate([layer[..., :3] * a, a * 255.0], -1)
    x = qx - .5; y = qy - .5
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = (x - x0)[..., None]; fy = (y - y0)[..., None]

    def at(yy, xx):
        ok = (xx >= 0) & (xx < W) & (yy >= 0) & (yy < H)
        v = pm[np.clip(yy, 0, H - 1), np.clip(xx, 0, W - 1)]
        return np.where(ok[..., None], v, 0)

    v = (at(y0, x0) * (1 - fx) * (1 - fy) + at(y0, x0 + 1) * fx * (1 - fy)
         + at(y0 + 1, x0) * (1 - fx) * fy + at(y0 + 1, x0 + 1) * fx * fy)
    al = v[..., 3:] / 255.0
    rgb = np.where(al > 1e-6, v[..., :3] / np.maximum(al, 1e-6), 0)
    return np.concatenate([rgb, v[..., 3:]], -1).astype(np.float32)


def warp_region(layer, region, inverse):
    """Replace the pixels of the bounding box of `region` (grown 24 px) by
    the layer sampled at inverse(x, y) (pixel centres); pixels outside the
    box keep the layer."""
    ys, xs = np.nonzero(region)
    if not len(ys):
        return layer.copy()
    H, W = layer.shape[:2]
    y0, y1 = max(0, ys.min() - 24), min(H, ys.max() + 25)
    x0, x1 = max(0, xs.min() - 24), min(W, xs.max() + 25)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    qx, qy = inverse(xx + .5, yy + .5)
    src = np.zeros_like(layer)
    src[region] = layer[region]
    out = layer.copy()
    out[region] = 0
    patch = sample(src, qx, qy)
    out[y0:y1, x0:x1] = SG.over(patch, out[y0:y1, x0:x1])
    return out


# ---------------------------------------------------------------------------
# The sheet
# ---------------------------------------------------------------------------
def arm_clip(arms, art='legacy', cuffs=None):
    """The arms layer as the runtime shows it at rest: each upper arm hidden
    above its sleeve's arm clip (avatar-foundation-outfit.js skinClip:
    everything above `cuff` u down the resting arm from the shoulder; legacy
    art clips at cuff_top). Above the clip the arm painting holds copied rows
    that reach past the sleeve's outline (they are never drawn). cuffs:
    {key: [t px per arm]} overrides the legacy clip."""
    fz = SG.frozen()
    out = arms.copy()
    H, W = arms.shape[:2]
    for key, (x0, y0, x1, y1) in SG.CELLS.items():
        F = fz.data[key]
        g = fz.zones[key]
        yy, xx = np.mgrid[y0:y1, x0:x1]
        for a in g['arms']:
            i = a['i']
            S = np.array(F['joints']['shoulder'][i], float)
            ax = np.array(a['axis'], float)
            t = (xx + .5 - S[0]) * ax[0] + (yy + .5 - S[1]) * ax[1]
            cut = cuffs[key][i] if cuffs and key in cuffs else F['cuff_top'] - S[1]
            side = np.ones(t.shape, bool)
            if g['view'] != 'right':
                cx = g['center']
                side = (xx + .5 < cx) if i == 0 else (xx + .5 >= cx)
            hide = side & (t < cut)
            cell = out[y0:y1, x0:x1]
            cell[hide] = 0
    return out


def compose(slot, product):
    """Sheet RGBA (sheet px): the frozen head and every layer in z order,
    the slot's own layers taken from `product` (default: the drawn basic).
    The arms are clipped at the runtime's resting arm clip (arm_clip)."""
    fz = SG.frozen()
    out = np.zeros_like(fz.sheet)
    art = 'legacy'
    body, head = fz.body(art), fz.head
    if BASE == 'dark':
        body, head = SG.dark_body(body, head)
    for name in reversed(SG.Z_TOP_FIRST):
        if name == 'head':
            lay = head
        elif name in product:
            lay = product[name]
        elif name in ('shirt', 'sleeves', 'shorts', 'shoes'):
            lay = fz.drawn[name] if name in SG.SLOT[slot]['layers'] else fz.layers[name]
        elif name == 'arms':
            lay = arm_clip(body['arms'], art)
        else:
            lay = body[name]
        out = SG.over(lay, out)
    return out


def render(E, path, kind='webp80'):
    if kind == 'identity':
        canvas = Image.new('RGB', (TEMPLATE['width'], TEMPLATE['height']), (255, 255, 255))
        page = np.asarray(canvas).astype(np.float32)
        a = E[..., 3:] / 255.0
        rgb = E[..., :3] * a + 255 * (1 - a)
        page[:, TEMPLATE['left']:TEMPLATE['left'] + E.shape[1]] = rgb
        Image.fromarray(np.clip(np.rint(page), 0, 255).astype(np.uint8)).save(path)
        return path
    im, _ = SY.chatgpt_path(E)
    if kind == 'webp80':
        im.save(path, 'WEBP', quality=80, method=6)
    else:
        im.save(path)
    return path


# ---------------------------------------------------------------------------
# Edits
# ---------------------------------------------------------------------------
def _arm(key, i):
    g = SG.frozen().zones[key]
    a = next(a for a in g['arms'] if a['i'] == i)
    return a, np.array(a['shoulder'], float), np.array(a['axis'], float), np.array(a['normal'], float)


def _cell_side(key, i):
    """Mask of figure `key`'s cell on arm i's side (front/back), or the cell."""
    fz = SG.frozen()
    x0, y0, x1, y1 = SG.CELLS[key]
    m = np.zeros(fz.sheet.shape[:2], bool)
    g = fz.zones[key]
    if g['view'] == 'right':
        m[y0:y1, x0:x1] = True
        return m
    c = int(round(g['center']))
    if i == 0:
        m[y0:y1, x0:c] = True
    else:
        m[y0:y1, c:x1] = True
    return m


def stretch_sleeves(layer, key, dt):
    """Each sleeve of `key` dt px longer: in the resting arm frame the part
    below t0 (half the sleeve's length) is stretched so its end moves dt px
    down the arm."""
    g = SG.frozen().zones[key]
    out = layer.copy()
    for a in g['arms']:
        i = a['i']
        _, S, ax, nr = _arm(key, i)
        side = _cell_side(key, i) & (layer[..., 3] > 0)
        ys, xs = np.nonzero(side)
        if not len(ys):
            continue
        t = (xs + .5 - S[0]) * ax[0] + (ys + .5 - S[1]) * ax[1]
        t1 = float(t.max())
        t0 = t1 / 2
        k = (t1 - t0) / (t1 - t0 + dt)

        def inv(x, y, S=S, ax=ax, nr=nr, t0=t0, k=k):
            tt = (x - S[0]) * ax[0] + (y - S[1]) * ax[1]
            cc = (x - S[0]) * nr[0] + (y - S[1]) * nr[1]
            ts = np.where(tt > t0, t0 + (tt - t0) * k, tt)
            return S[0] + ax[0] * ts + nr[0] * cc, S[1] + ax[1] * ts + nr[1] * cc
        out = warp_region(out, side, inv)
    return out


def seam_distance(seam, x, y):
    """Distance (px) of points to the polyline `seam` (sheet px)."""
    d = np.full(np.shape(x), 1e9)
    for (ax, ay), (bx, by) in zip(seam, seam[1:]):
        vx, vy = bx - ax, by - ay
        t = np.clip(((x - ax) * vx + (y - ay) * vy) / max(vx * vx + vy * vy, 1e-9), 0, 1)
        d = np.minimum(d, np.hypot(x - ax - t * vx, y - ay - t * vy))
    return d


def puff_sleeves(layer, key, s, gather=10.0):
    """Each sleeve scaled by s about its shoulder joint (a puffed sleeve).
    Front/back, a puff is gathered at its sewn edge: the scale fades to 1
    over `gather` px toward the frozen armhole seam, which stays where it is
    (there the sleeve's alpha is the runtime's seam fade over the torso
    cloth, with no drawn line of its own; moving it would move nothing the
    sheet shows)."""
    g = SG.frozen().zones[key]
    out = layer.copy()
    for a in g['arms']:
        _, S, ax, nr = _arm(key, a['i'])
        side = _cell_side(key, a['i']) & (layer[..., 3] > 0)
        seam = None
        if g['view'] != 'right':
            ah = next(h for h in g['armholes'] if (h['side'] < 0) == (a['i'] == 0))
            seam = sorted([tuple(map(float, p)) for p in ah['seam']], key=lambda p: p[1])
            # the underarm seam runs on from the armhole's lowest point to the
            # cuff's inner end (20 px along its last direction)
            (cx_, cy_), (dx_, dy_) = seam[-2], seam[-1]
            ln = max(1e-6, float(np.hypot(dx_ - cx_, dy_ - cy_)))
            seam = seam + [(dx_ + (dx_ - cx_) / ln * 20, dy_ + (dy_ - cy_) / ln * 20)]

        def inv(x, y, S=S, seam=seam):
            k = np.full(np.shape(x), s)
            if seam is not None:
                w = np.clip(seam_distance(seam, x, y) / gather, 0, 1)
                k = 1 + (s - 1) * w
            return S[0] + (x - S[0]) / k, S[1] + (y - S[1]) / k
        out = warp_region(out, side, inv)
    return out


def hem_shift(layer, key, d):
    """The torso's hem d px lower (d > 0) or higher: rows from the chest
    (the armhole's lowest seam point) to the hem stretched or squeezed."""
    fz = SG.frozen()
    g = fz.zones[key]
    x0, y0, x1, y1 = SG.CELLS[key]
    cell = np.zeros(layer.shape[:2], bool)
    cell[y0:y1, x0:x1] = True
    m = cell & (layer[..., 3] > 0)
    ys = np.nonzero(m.any(1))[0]
    hem = float(ys.max() + 1)
    if g['armholes']:
        r0 = max(max(p[1] for p in ah['seam']) for ah in g['armholes'])
    else:
        r0 = (ys.min() + hem) / 2
    k = (hem - r0) / (hem - r0 + d)
    return warp_region(layer, m, lambda x, y: (x, np.where(y > r0, r0 + (y - r0) * k, y)))


def widen_cuffs(layer, key, f):
    """The shorts' legs below the crotch apex flared by f (a wider cuff):
    front/back each leg is widened outward from its inner side (the column
    of the leg band nearest the body centre stays, so the gap between the
    legs stays open: a flared pair of shorts, not a skirt); the profile's one
    leg is widened about its centre."""
    fz = SG.frozen()
    g = fz.zones[key]
    x0, y0, x1, y1 = SG.CELLS[key]
    out = layer.copy()
    F = fz.data[key]
    apex = float(np.mean([j[1] for j in F['joints']['hip']]))
    for lg in g['legs']:
        cx = (lg['cols'][0] + lg['cols'][1] + 1) / 2
        m = np.zeros(layer.shape[:2], bool)
        if g['view'] == 'right':
            m[y0:y1, x0:x1] = True
            anchor, sgn = cx, 0
        else:
            c = g['center']
            if cx < c:
                m[y0:y1, x0:int(round(c))] = True
                anchor, sgn = float(lg['cols'][1] + 1), -1   # outward is -x
            else:
                m[y0:y1, int(round(c)):x1] = True
                anchor, sgn = float(lg['cols'][0]), 1
        m &= layer[..., 3] > 0

        def inv(x, y, anchor=anchor, sgn=sgn):
            w = np.clip((y - apex) / 20.0, 0, 1)
            s = 1 + (f - 1) * w
            src = anchor + (x - anchor) / s
            if sgn:
                src = np.where((x - anchor) * sgn > 0, src, x)
            return src, y
        out = warp_region(out, m, inv)
    return out


def taller_shoes(layer, key, d):
    """The shoes' upper d px taller: rows above the sole stretched upward
    from the floor."""
    fz = SG.frozen()
    g = fz.zones[key]
    x0, y0, x1, y1 = SG.CELLS[key]
    m = np.zeros(layer.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    m &= layer[..., 3] > 0
    ys = np.nonzero(m.any(1))[0]
    top, floor = float(ys.min()), float(g['floor'])
    k = (floor - top) / (floor - top + d)
    return warp_region(layer, m, lambda x, y: (x, floor - (floor - y) * k))


def cream(layer, mask, rgb=(242, 223, 189)):
    """Recoloured to `rgb` keeping the layer's own shading: per figure cell,
    each pixel's lightness ratio to that figure's median opaque lightness
    times `rgb` (so the figure's main cloth colour IS `rgb`, its lines and
    shadows stay darker, highlights clip at white). Per figure, never one
    sheet-wide median: a boy's dark green tee and a girl's lime tee both
    become the same cream (#f2dfbd by default, the girls' 카라 셔츠, the shop
    colour closest to skin)."""
    out = layer.copy()
    lum = .299 * layer[..., 0] + .587 * layer[..., 1] + .114 * layer[..., 2]
    col = np.array(rgb, np.float32)
    for key, (x0, y0, x1, y1) in SG.CELLS.items():
        sel = np.zeros(mask.shape, bool)
        sel[y0:y1, x0:x1] = mask[y0:y1, x0:x1] & (layer[y0:y1, x0:x1, 3] > 0)
        solid = sel & (layer[..., 3] > 250)
        if not solid.any():
            continue
        med = float(np.median(lum[solid]))
        ratio = np.clip(lum[sel] / max(med, 1.0), 0, 1.6)[:, None]
        out[sel, :3] = np.clip(col[None] * ratio, 0, 255)
    return out


def long_sleeves(rgb=(242, 223, 189), end=5):
    """A long sleeve drawn over the resting arm (top/long-sleeve, 2026-10-16): the clipped arm painting (as compose
    draws it, on the current BASE) recoloured to `rgb` with its own shading (as cream) from the cuff line down to
    `end` px above each wrist (across the forearm, elbow -> wrist), the hand left as skin. Returns (arms, truth):
    the arms layer for compose's `product` and per (key, i) the strip's truth alpha in sheet px (the recoloured
    pixels below the shoulder line, what top.armSleeves[i] must hold; the profile's two arms are one)."""
    fz = SG.frozen()
    light = arm_clip(fz.body('legacy')['arms'], 'legacy')
    body = fz.body('legacy')
    if BASE == 'dark':
        body = SG.dark_body(body, fz.head)[0]
    arms = arm_clip(body['arms'], 'legacy')
    H, W = arms.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    sel = np.zeros((H, W), bool)
    truth = {}
    for key, (x0, y0, x1, y1) in SG.CELLS.items():
        F = fz.data[key]
        J = F['joints']
        for i in (0, 1):
            x, y, w, h = F['rects']['arm'][i]
            box = np.zeros((H, W), bool); box[y:y + h, x:x + w] = True
            E, Wr, S = (np.array(J[n][i], float) for n in ('elbow', 'wrist', 'shoulder'))
            ax = (Wr - E) / np.linalg.norm(Wr - E)
            above = ((xx + .5 - Wr[0]) * ax[0] + (yy + .5 - Wr[1]) * ax[1]) < -end
            ua = (E - S) / np.linalg.norm(E - S)
            below = ((xx + .5 - S[0]) * ua[0] + (yy + .5 - S[1]) * ua[1]) >= 0
            m = box & above & (arms[..., 3] > 0)
            sel |= m
            truth[(key, i)] = m & below
    out = arms.copy()
    lum = .299 * light[..., 0] + .587 * light[..., 1] + .114 * light[..., 2]
    col = np.array(rgb, np.float32)
    for key, (x0, y0, x1, y1) in SG.CELLS.items():
        c = np.zeros((H, W), bool); c[y0:y1, x0:x1] = True
        solid = c & sel & (arms[..., 3] > 250)
        if not solid.any():
            continue
        med = float(np.median(lum[solid]))
        ratio = np.clip(lum[c & sel] / max(med, 1.0), 0, 1.6)[:, None]
        out[c & sel, :3] = np.clip(col[None] * ratio, 0, 255)
    return out, {k: v & (out[..., 3] > 127) for k, v in truth.items()}


def main_colour(layer, key):
    """Median RGB of a figure's opaque pixels (the synthetic's own main colour)."""
    x0, y0, x1, y1 = SG.CELLS[key]
    cell = layer[y0:y1, x0:x1]
    m = cell[..., 3] > 250
    return np.median(cell[m][:, :3], 0) if m.any() else None


def skin_rgb(art='clean', base='current'):
    """The frozen arm painting's median skin colour (the body under the
    garment, untinted; on the dark base the dark template's skin). base:
    'current' follows BASE, None the light skin."""
    fz = SG.frozen()
    a = fz.body(art)['arms']
    if (BASE if base == 'current' else base) == 'dark':
        a = SG.dark_body({'arms': a}, fz.head)[0]['arms']
    m = a[..., 3] > 250
    return np.median(a[m][:, :3], 0)


def skin_band(layer, key, n, edge):
    """Negative-control building block: the garment's own paint replaced by
    skin over n rows at one edge, alpha kept (what ChatGPT draws for a belly
    under a short top or a lowered neckline). edge 'hem': the last n opaque
    rows of the frozen hem columns (free of the hanging arm); 'collar': the
    first n opaque rows of the frozen collar columns."""
    fz = SG.frozen()
    g = fz.zones[key]
    x0, y0, x1, y1 = SG.CELLS[key]
    out = layer.copy()
    cell = out[y0:y1, x0:x1]
    a = cell[..., 3] > 127
    skin = skin_rgb()
    if edge == 'hem':
        cols = [x for x, hb, st, armed in g['hem']['columns'] if not armed]
    else:
        cols = [c[0] for c in g['upper']['columns'] if c[2] == 'collar' and not c[3]]
    for x in cols:
        r = np.nonzero(a[:, x - x0])[0]
        if not len(r):
            continue
        if edge == 'hem':
            cell[max(r[-1] - n + 1, 0):r[-1] + 1, x - x0, :3] = skin
        else:
            cell[r[0]:r[0] + n, x - x0, :3] = skin
    return out


def shift_figure(layer, key, dx, dy):
    """Figure `key`'s part of the layer moved by (dx, dy) px (negative dy is
    up: shoes lifted off the floor)."""
    m = figure_mask(key) & (layer[..., 3] > 0)
    return warp_region(layer, m, lambda x, y: (x - dx, y - dy))


def collar_raise(layer, key, n):
    """The torso's top n px higher: rows from the chest (the armholes' lowest
    seam point) up to the collar stretched upward (a raised collar)."""
    fz = SG.frozen()
    g = fz.zones[key]
    m = figure_mask(key) & (layer[..., 3] > 0)
    ys = np.nonzero(m.any(1))[0]
    top = float(ys.min())
    r0 = max(max(p[1] for p in ah['seam']) for ah in g['armholes']) if g['armholes'] else (top + ys.max()) / 2
    k = (r0 - top) / (r0 - top + n)
    return warp_region(layer, m, lambda x, y: (x, np.where(y < r0, r0 - (r0 - y) * k, y)))


def shorten_shorts(layer, key, d):
    """The shorts' legs d px shorter: rows from the crotch apex down to the
    cuff squeezed upward."""
    fz = SG.frozen()
    F = fz.data[key]
    apex = float(np.mean([j[1] for j in F['joints']['hip']]))
    m = figure_mask(key) & (layer[..., 3] > 0)
    bottom = float(np.nonzero(m.any(1))[0].max() + 1)
    k = (bottom - apex) / (bottom - apex - d)
    return warp_region(layer, m, lambda x, y: (x, np.where(y > apex, apex + (y - apex) * k, y)))


def join_legs(layer, key):
    """Negative-control building block: the gap between the two shorts legs
    filled row by row with the cloth beside it (one tube: a skirt). Front and
    back views only."""
    x0, y0, x1, y1 = SG.CELLS[key]
    out = layer.copy()
    a = out[..., 3] > 127
    for y in range(y0, y1):
        xs = np.nonzero(a[y, x0:x1])[0]
        if len(xs) < 2:
            continue
        gaps = np.nonzero(np.diff(xs) > 1)[0]
        for gi in gaps:
            l, r = x0 + xs[gi], x0 + xs[gi + 1]
            if r - l > 60:
                continue
            col = (out[y, l, :3].astype(np.float32) + out[y, r, :3]) / 2
            out[y, l + 1:r, :3] = col
            out[y, l + 1:r, 3] = 255
    return out


def cuff_skin(layer, key, n):
    """Positive building block: the last n px of each sleeve along its arm
    painted skin (alpha kept), what ChatGPT sometimes draws at a cuff. The
    pipeline must strip it; the truth is the sleeve without that band
    (returned second)."""
    g = SG.frozen().zones[key]
    out, truth = layer.copy(), layer.copy()
    skin = skin_rgb()
    for a in g['arms']:
        i = a['i']
        _, S, ax, nr = _arm(key, i)
        side = _cell_side(key, i) & (layer[..., 3] > 127)
        yy, xx = np.nonzero(side)
        if not len(yy):
            continue
        t = (xx + .5 - S[0]) * ax[0] + (yy + .5 - S[1]) * ax[1]
        band = t > t.max() - n
        out[yy[band], xx[band], :3] = skin
        truth[yy[band], xx[band], 3] = 0
    return out, truth


def figure_mask(key):
    x0, y0, x1, y1 = SG.CELLS[key]
    m = np.zeros(SG.frozen().sheet.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return m


def front_back(fn, layer, *args):
    """Apply an edit to the front and back figures of both sexes."""
    out = layer
    for key in SG.CELLS:
        if not key.endswith('right'):
            out = fn(out, key, *args)
    return out


def every_figure(fn, layer, *args):
    out = layer
    for key in SG.CELLS:
        out = fn(out, key, *args)
    return out


def extend_under(lower, upper_before, upper_after):
    """What a shorter top uncovers is the bottom below it, extended up as the
    runtime extends every bottom (to the waist cover line): the bottom layer
    rebuilt (avatar_build.cloth.rebuild_cloth, plain cloth) over the pixels
    the top covered before and no longer covers, per figure cell."""
    from avatar_build.cloth import garment_prints, rebuild_cloth
    out = lower.copy()
    gap_all = (upper_before[..., 3] > 127) & ~(upper_after[..., 3] > 127) & ~(lower[..., 3] > 127)
    for key, (x0, y0, x1, y1) in SG.CELLS.items():
        gap = gap_all[y0:y1, x0:x1]
        if not gap.any():
            continue
        cell = out[y0:y1, x0:x1]
        painted = cell[..., 3] / 255.0
        # only the band between the new hem and the bottom's own top
        cols = np.nonzero(gap.any(0))[0]
        todo = np.zeros(gap.shape, bool)
        for c in cols:
            rows = np.nonzero(painted[:, c] > .5)[0]
            if not len(rows):
                continue
            g = np.nonzero(gap[:, c])[0]
            g = g[g < rows.min()]
            if len(g):
                todo[g.min():rows.min(), c] = True
        if not todo.any():
            continue
        target = np.where(todo, 1.0, painted).astype(np.float32)
        prints, _ = garment_prints(cell[..., :3], painted, todo)
        L, Dt = rebuild_cloth(cell[..., :3], painted, target, todo, prints, plain_only=True)
        rgb = np.where(todo[..., None], np.clip(L + Dt, 0, 255), cell[..., :3])
        cell[..., :3] = rgb
        cell[..., 3] = np.where(todo, 255.0, cell[..., 3])
    return out
