"""Offline garment metadata (stage 3, WP6; plan 'segmentation' step 8).

Everything today's runtime measures from the legacy basic outfit's art
(avatar-foundation-outfit.js: raisedSleeve, shirtSide, edgeTone, rowSpan) is
computed here once, from the packed 8-bit part crops exactly as the runtime
would read them from the atlas, and written into the record:

  sleeves   cuff (u, the arm clip: the clean arm art's top, never below the
            sleeve's own opening), opening ([[w, t]...] the cuff seam in the
            runtime's sleeve frame), box ([x0, y0, w, h] u: every opaque pixel
            of the hanging and raised drawings at rest and under the seam pin
            of every turn the runtime draws (sleeveTexture), + .15 u; the
            data-path mesh canvas at 32 px/u), raised drawing (raisedAt): the
            hanging drawing without the strip of cloth that hangs beside the
            cuff, found by geometry, never by a colour test: the cuff band is
            the region the drawing's outlines (ridges) enclose below the arm
            clip that holds the drawing's lowest rows at the arm's core;
            cleared are the cloth inward of its inner end below cuff - 1 and
            the bands inward of its innermost band below that band's top (the
            runtime's raisedSleeve finds the same band by its cream and dark
            line colours, which only the basic tee has);
  underarm  per side (front/back): shirtSide() ported line by line (painted
            side edge, inset and colour of its line, the cloth beside it, the
            raised sleeve's underside profile and where its cuff starts);
  hem       the hem seam (sheet px), collar the collar seam (sheet px);
  bottom    edgeTone (the drawing's first opaque pixel on its 40 % row),
            waistTop (top row of the bottom at the centre seam), cuffAlong
            (the cuff's place along each thigh), seat {cut, apex, cuff, rise,
            span} (front/back) and sideSeat {cut, cuff, span} (profile):
              cuff   the median last opaque row over the leg columns - .5;
              apex   the crotch: the first gap row at the centre seam - 1
                     (median of the 3 centre columns);
              cut    'just above the cuffs': the cuff band's upper outline (the
                     first drawn line above the cuff's lower edge) at the inner
                     half of each leg, the higher leg's median, - 1;
              rise   NEW RULE: the least-squares fit of the runtime's own seat
                     edge, cut - rise * (1 - d/reach)^1.6, to that upper outline
                     over the leg columns (the prototype's rise read one point
                     and was off by 4-7 px);
              span   rowSpan(cut - 1): the opaque [x0, x1] of that row in
                     body-local u, so the runtime need not read pixels;
  shoes     opening (top row at the ankle column) and sole (the median lower
            edge).
The runtime frames come from tools/garment/fixtures/runtime-side-raised.json
(exported once from the runtime): the body collar row and the rig's resting
arm angles per sex and view.
"""
import math

import numpy as np

from avatar_build.common import lum_of

def js_round(x):
    return int(math.floor(x + .5))


def js_median(values):
    s = sorted(values)
    return s[len(s) >> 1]


def hexc(c):
    return '#' + ''.join('%02x' % int(min(255, max(0, js_round(v)))) for v in c)


def rotate(p, a):
    return [p[0] * math.cos(a) - p[1] * math.sin(a), p[0] * math.sin(a) + p[1] * math.cos(a)]


# ---------------------------------------------------------------------------
# Runtime frames
# ---------------------------------------------------------------------------
def frames(fz, sex, view):
    return fz.fixture['sexes'][sex]['frames']['views'][view], fz.fixture['sexes'][sex]['frames']['collar']


def rest_angle(fz, sex, view, i):
    fr, _ = frames(fz, sex, view)
    ra = fr['restAngle']
    return ra[min(i, len(ra) - 1)]


def to_q(px, py, shoulder, k, rest):
    """Sheet pixel coordinates -> the runtime's sleeve frame (u):
    q = rotate((p - shoulder) * k, -restAngle); q[1] = t down the arm."""
    vx = (np.asarray(px, np.float64) - shoulder[0]) * k
    vy = (np.asarray(py, np.float64) - shoulder[1]) * k
    c, s = math.cos(-rest), math.sin(-rest)
    return vx * c - vy * s, vx * s + vy * c


# ---------------------------------------------------------------------------
# Sleeves
# ---------------------------------------------------------------------------
def smooth(t):
    return t * t * (3 - 2 * t)


def clamp(x, a, b):
    return max(a, min(b, x))


def sleeve_box(alpha_list, rect, shoulder, k, rest, i, profile, margin=.15):
    """The record box: every opaque pixel (alpha > 0) of the drawings, at
    rest and as sleeveTexture pins its seam for every turn it draws (hold > 0
    up to 90 degrees from rest), + margin u. The canvas holds it at 32 px/u."""
    pts = []
    for a in alpha_list:
        ys, xs = np.nonzero(a > 0)
        if len(ys):
            pts.append((xs, ys))
    if not pts:
        return [-1.0, -1.0, 2.0, 2.0]
    xs = np.concatenate([p[0] for p in pts]); ys = np.concatenate([p[1] for p in pts])
    # pixel corners, so the canvas covers whole pixels
    qx, qy = [], []
    for dx in (0, 1):
        for dy in (0, 1):
            a_, b_ = to_q(rect[0] + xs + dx, rect[1] + ys + dy, shoulder, k, rest)
            qx.append(a_); qy.append(b_)
    qx = np.concatenate(qx); qy = np.concatenate(qy)
    along = np.clip((qy + .2) / 2.2, 0, 1); along = along * along * (3 - 2 * along)
    if profile:
        inward = np.full(qx.shape, .6)
    else:
        v = np.clip((((-qx) if i else qx) + .5) / 1.2, 0, 1)
        inward = v * v * (3 - 2 * v)
    lo = [qx.min(), qy.min()]; hi = [qx.max(), qy.max()]
    for deg in range(-90, 91, 2):
        delta = math.radians(deg)
        hold = 1 - smooth(clamp((abs(deg) - 40) / 50, 0, 1))
        if hold <= 0:
            continue
        pin = hold * inward * (1 - along)
        fx = qx * math.cos(-delta) - qy * math.sin(-delta)
        fy = qx * math.sin(-delta) + qy * math.cos(-delta)
        px = qx + (fx - qx) * pin; py = qy + (fy - qy) * pin
        lo = [min(lo[0], px.min()), min(lo[1], py.min())]; hi = [max(hi[0], px.max()), max(hi[1], py.max())]
    x0, y0 = math.floor((lo[0] - margin) * 32) / 32, math.floor((lo[1] - margin) * 32) / 32
    x1, y1 = math.ceil((hi[0] + margin) * 32) / 32, math.ceil((hi[1] + margin) * 32) / 32
    return [round(x0, 5), round(y0, 5), round(x1 - x0, 5), round(y1 - y0, 5)]


def raised_alpha(rgba, rect, shoulder, k, rest, i, cuff, line=40.0):
    """raisedSleeve() by geometry (the runtime finds the cuff by its cream and
    dark-line colours; a product's cuff can be any colour). In the sleeve
    frame (t down the resting arm, w across toward the body, bands of .05 u
    as the runtime) the cuff band is the region of the drawing enclosed by
    its outlines (ridges at least `line` darker than their 5x5 neighbourhood)
    below cuff - .2 that holds the most of the drawing's lowest .6 u at the
    arm's core (|w| <= .5), with its own outline (1 px around it). end is the
    band's inner end (its largest w), each band's top its first row. Cleared,
    as the runtime clears cloth: inward of the innermost cuff band below that
    band's top, and the strip that hangs beside the cuff (t > cuff - 1,
    w > end + .02). The cuff band itself is never cleared; a sleeve without a
    drawn cuff (one region) loses nothing."""
    from avatar_build import matte as M
    H, W = rgba.shape[:2]
    a = rgba[..., 3].astype(np.int32)
    s = 1 if i else -1
    yy, xx = np.mgrid[0:H, 0:W]
    vx = (rect[0] + xx + .5 - shoulder[0]) * k
    vy = (rect[1] + yy + .5 - shoulder[1]) * k
    cs, sn = math.cos(-rest), math.sin(-rest)
    t = vx * sn + vy * cs
    w = -s * (vx * cs - vy * sn)
    band = np.round(w * 20).astype(int)
    opaque = a > 128
    out = a > 0
    if not opaque.any():
        return out, {'cuffBands': 0}
    lum = lum_of(rgba[..., :3].astype(np.float32))
    lum = np.where(opaque, lum, 255.0)
    lmax = M._max_filter(np.clip(lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
    ridge = (lmax - lum >= line) & opaque
    lowest = np.full(band.shape, -9.0)
    for b in np.unique(band[opaque]):
        m = band == b
        lowest[m] = t[opaque & m].max()
    core = opaque & (np.abs(w) <= .5) & (t >= lowest - .6)
    lab, n, _ = M.label(opaque & ~ridge & (t > cuff - .2))
    if not n:
        return out, {'cuffBands': 0}
    votes = np.bincount(lab[core & (lab > 0)], minlength=n + 1)
    votes[0] = 0
    if votes.max() <= 0:
        return out, {'cuffBands': 0}
    region = M.dilate(lab == int(votes.argmax()), 1) & opaque & (t > cuff - .2)
    tops = {}
    for b in np.unique(band[region]):
        tops[int(b)] = float(t[region & (band == b)].min())
    inner = max(tops)
    inner_top = tops[inner]
    end = float(w[region].max())
    clear = (a > 0) & (((band > inner) & (t > inner_top + .05)) | ((t > cuff - 1) & (w > end + .02)))
    out = (a > 0) & ~clear
    return out, {'cuffBands': len(tops), 'end': round(end, 3), 'innerTop': round(inner_top, 3), 'clearedPx': int(clear.sum())}


def cuff_value(arm, shoulder, k, rest, opening_q, rect=None):
    """The arm clip (sleeve-frame t, u): the clean arm art's top on the arm
    axis (zones hiddenRow: above it the arm is copied rows without outline,
    always under the sleeve), never below the sleeve's own opening at the arm's
    core (else the clip would open a gap): min(clean top, opening - .1 u)."""
    from avatar_build.limits import t_hidden
    ax = np.array(arm['axis']); sh = np.array(arm['shoulder'])
    p = sh + ax * float(t_hidden(arm, 0))
    _, tq = to_q(p[0], p[1], shoulder, k, rest)
    c = float(tq)
    if opening_q is not None and len(opening_q):
        core = [tt for ww, tt in opening_q if abs(ww) <= arm['half'] * k * 1.0 + 1e-9]
        if core:
            c = min(c, min(core) - .1)
    return round(c, 5)


# ---------------------------------------------------------------------------
# shirtSide(), ported from avatar-foundation-outfit.js
# ---------------------------------------------------------------------------
def underarm(torso, sleeves, raised, F, C, rig, cuff_fallback):
    rect = torso['rect']
    W, H = rect[2], rect[3]
    d = torso['rgba'].astype(np.int64)
    k = F['k']; neck = F['neck']

    def Y(y):
        return js_round((y - C) / k + neck[1] - rect[1])

    def bx(px):
        return 16 + (px + rect[0] - neck[0]) * k

    def by(py):
        return C + (py + rect[1] - neck[1]) * k

    def A(x, y):
        return int(d[y, x, 3]) if 0 <= x < W and 0 <= y < H else 0

    def rgb(x, y):
        return [int(d[y, x, 0]), int(d[y, x, 1]), int(d[y, x, 2])]

    def lum(c):
        return .3 * c[0] + .59 * c[1] + .11 * c[2]

    allc = [rgb(px, py) for py in range(0, H, 2) for px in range(0, W, 2) if A(px, py) > 250]
    plain = [js_median([c[j] for c in allc]) for j in range(3)]
    sides = []
    for i, s in enumerate((-1, 1)):
        sl = sleeves[i]
        sa = sl['rgba'][..., 3]
        cap = None
        for py in range(sa.shape[0]):
            xs = [px for px in range(sa.shape[1]) if sa[py, px] > 128]
            if xs:
                cap = [16 + (sl['rect'][0] + js_median(xs) + .5 - neck[0]) * k, C + (sl['rect'][1] + py + .5 - neck[1]) * k]
                break

        def x_edge(py):
            x = W - 1 if s > 0 else 0
            while 0 <= x < W and A(x, py) < 128:
                x -= s
            if x < 0 or x >= W:
                return None
            cur = A(x, py) / 255; prev = A(x + s, py) / 255
            return x + .5 + s * clamp((cur - .5) / max(1e-6, cur - prev), 0, 1)

        hem_row = H - 1
        e36 = x_edge(Y(36))
        x = js_round((e36 if e36 is not None else 0) - s * 6)
        while hem_row > 0 and A(x, hem_row) < 128:
            hem_row -= 1
        rows = []
        for py in range(max(0, Y(cap[1]) + 1), hem_row - 4 + 1):
            e = x_edge(py)
            if e is not None:
                rows.append([e, py])
        for _ in range(2):
            xv = [r[0] for r in rows]
            for j in range(1, len(rows) - 1):
                rows[j][0] = (xv[j - 1] + 2 * xv[j] + xv[j + 1]) / 4
        edge = [[bx(e), by(py + .5)] for j, (e, py) in enumerate(rows) if j % 2 == 0 or j == len(rows) - 1]
        edge.append([edge[-1][0], by(hem_row + .5) - .05])
        inside, dark = [], []
        for e, py in rows:
            y = by(py + .5)
            if y < 32.6 or y > 35.6:
                continue
            best = None
            for j in range(5):
                xx = math.floor(e - s * (j + .5))
                if xx < 0 or xx >= W or A(xx, py) < 250:
                    continue
                c = rgb(xx, py)
                if best is None or lum(c) < lum(best[0]):
                    best = (c, abs(xx + .5 - e))
            if best:
                inside.append(best[1]); dark.append(best[0])
        band = []
        for e, py in rows:
            y = by(py + .5)
            if y < 33.4 or y > 36:
                continue
            for j in range(1, 11):
                xx = math.floor(e - s * (j + .5))
                if A(xx, py) > 250:
                    band.append(rgb(xx, py))
        near = [c for c in band if math.hypot(c[0] - plain[0], c[1] - plain[1], c[2] - plain[2]) < 60]
        band = near if len(near) >= 8 else [plain]
        sh = F['joints']['shoulder'][i]
        rest = math.atan2(rig['elbow'][i][1] - rig['shoulder'][i][1], rig['elbow'][i][0] - rig['shoulder'][i][0]) - math.pi / 2
        up = raised[i]
        under = {}
        ys, xs = np.nonzero(up)
        for py, px in zip(ys.tolist(), xs.tolist()):
            q = rotate([(sl['rect'][0] + px + .5 - sh[0]) * k, (sl['rect'][1] + py + .5 - sh[1]) * k], -rest)
            tt = js_round(q[1] * 10)
            under[tt] = max(under.get(tt, -9), -s * q[0])
        t0, t1 = min(under), max(under)
        wv = []
        for tt in range(t0, t1 + 1):
            wv.append(under[tt] if tt in under else (wv[-1] if wv else 0))
        n = len(wv)
        ws = [(wv[max(0, j - 1)] + 2 * v + wv[min(n - 1, j + 1)]) / 4 for j, v in enumerate(wv)]
        cuff = cuff_fallback[i]
        j = 12 - t0
        while j + 3 < n and j <= 30 - t0:
            if j >= 0 and ws[j + 3] - ws[j] >= .12:
                cuff = (j + t0) / 10 + .1
                break
            j += 1
        soft = ws
        for _ in range(2):
            soft = [sum(soft[j + q] for q in range(-2, 3) if 0 <= j + q < n) / sum(1 for q in range(-2, 3) if 0 <= j + q < n) for j in range(n)]
        sides.append(dict(
            side=s, edge=[[round(p[0], 4), round(p[1], 4)] for p in edge], hem=round(edge[-1][1], 4),
            cap=[round(cap[0], 4), round(cap[1], 4)], inset=round(js_median(inside) * k if inside else .08, 5),
            under=dict(t0=t0 / 10, w=[round(v, 4) for v in soft]), cuff=round(cuff, 4),
            cloth=hexc([js_median([c[j] for c in band]) for j in range(3)]),
            line=hexc([js_median([c[j] for c in dark]) for j in range(3)] if dark else [v * .35 for v in plain])))
    return sides


# ---------------------------------------------------------------------------
# Bottom
# ---------------------------------------------------------------------------
def edge_tone(rgba, y=None):
    """edgeTone(): the first pixel with alpha > 220 on row y (default
    floor(h * .4), the runtime's row of the legacy crop)."""
    H = rgba.shape[0]
    if y is None:
        y = int(math.floor(H * .4))
    if not 0 <= y < H:
        return 'rgba(40,44,60,.9)'
    for x in range(rgba.shape[1]):
        if rgba[y, x, 3] > 220:
            r, g, b = (int(v) for v in rgba[y, x, :3])
            return 'rgba(%d,%d,%d,.92)' % (r, g, b)
    return 'rgba(40,44,60,.9)'


def edge_row(F, rect):
    """The row edgeTone reads, anchored to the frozen body: the runtime's 40 %
    row of the basic shorts' rect (sd-foundation-ref-data.js), in the crop.
    A pipeline bottom is extended up under the top (the waist cover line), so
    its own 40 % row would fall on rebuilt cloth instead of its outline."""
    r = F['rects']['shorts']
    return r[1] + int(math.floor(r[3] * .4)) - rect[1]


def row_span(rgba, rect, F, py):
    """rowSpan(): the opaque [x0, x1] (alpha >= 128) of sheet row py, body-local u."""
    H, W = rgba.shape[:2]
    y = int(clamp(js_round(py - rect[1]), 0, H - 1))
    row = rgba[y, :, 3]
    l, r = 0, W - 1
    while l < r and row[l] < 128:
        l += 1
    while r > l and row[r] < 128:
        r -= 1
    x = lambda px: 16 + (px + rect[0] - F['neck'][0]) * F['k']  # noqa: E731
    return [round(x(l), 6), round(x(r + 1), 6)]


def _upper_outline(alpha, depth, x, bottom, line=60.0):
    """The cuff band's upper outline in column x: the top of the first ridge
    run found from 6 px above the lower edge upward (30 px at most)."""
    y = bottom - 6
    while y > bottom - 30 and y > 0:
        if depth[y, x] >= line and alpha[y, x]:
            while y > 0 and depth[y - 1, x] >= line:
                y -= 1
            return y
        y -= 1
    return None


def seat(alpha, rgba_sheet_lum, F, zone, profile, x0, y0, x1, y1):
    """Seat rows of one figure (sheet rows; see the module docstring).
    alpha: bool sheet-size mask of the bottom part; rgba_sheet_lum: its
    lightness (sheet size)."""
    from avatar_build import matte as M
    lmax = M._max_filter(np.clip(rgba_sheet_lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
    depth = lmax - rgba_sheet_lum
    cx = F['neck'][0]
    bottom, upper = {}, {}
    for x in range(x0, x1):
        r = np.nonzero(alpha[y0:y1, x])[0]
        if not len(r):
            continue
        b = int(r.max()) + 1 + y0
        bottom[x] = b
        u = _upper_outline(alpha, depth, x, b)
        if u is not None:
            upper[x] = u
    legs = zone['legs']
    leg_cols = [x for x in bottom if any(lg['cols'][0] - 6 <= x <= lg['cols'][1] + 6 for lg in legs)]
    cuff = float(np.median([bottom[x] - 1 for x in leg_cols])) - .5 if leg_cols else None
    out = dict(cuff=cuff)
    inner = []
    if profile:
        xs = [x for x in upper if x in leg_cols or True]
        vals = [upper[x] for x in xs if bottom[x] > upper[x]]
        if vals:
            inner.append(float(np.median(vals)))
    else:
        for lg in legs:
            kx = lg['knee'][0]
            xs = [x for x in upper if (x + .5 - cx) * (kx - cx) > 0 and abs(x + .5 - cx) < abs(kx - cx)]
            if xs:
                inner.append(float(np.median([upper[x] for x in xs])))
    cut = (min(inner) - 1) if inner else None
    out['cut'] = cut
    if not profile:
        gaps = []
        for xc in (int(math.floor(cx)) - 1, int(math.floor(cx)), int(math.floor(cx)) + 1):
            r = np.nonzero(alpha[y0:y1, xc])[0]
            if not len(r):
                continue
            j = int(r[0])
            while j + 1 - r[0] < len(r) and alpha[y0 + j + 1, xc]:
                j += 1
            gaps.append(j + 1 + y0)
        out['apex'] = float(np.median(gaps)) - 1 if gaps else None
    return out, bottom, upper


def fit_rise(cut, span_px, bottom, upper):
    """rise: least squares of cut - rise * f(x) to the upper outline over the
    leg columns, f the runtime's seat-edge weight (1 - d/reach)^1.6 with
    reach .85 of the half span (avatar-foundation-outfit.js seatedShorts)."""
    L, R = span_px
    reach = (R - L) / 2 * .85
    num = den = 0.0
    for x, u in upper.items():
        if not (L <= x < R) or u > cut + 3 or bottom.get(x, 0) < cut:
            continue
        dd = min(x + .5 - L, R - x - .5)
        f = max(0.0, 1 - dd / reach) ** 1.6
        num += f * (cut - u); den += f * f
    return max(0.0, num / den) if den else 0.0




def cuff_along(F, i, cuff_row, x):
    """The cuff's place along thigh i (thigh lengths from the hip): the
    cuff point (x, cuff_row) projected on the frozen hip -> knee joints."""
    hip = np.array(F['joints']['hip'][i], np.float64)
    knee = np.array(F['joints']['knee'][i], np.float64)
    v = knee - hip
    return round(float(clamp(np.dot(np.array([x, cuff_row]) - hip, v) / max(1e-9, np.dot(v, v)), 0, 1.5)), 4)


# ---------------------------------------------------------------------------
# Shoes
# ---------------------------------------------------------------------------
def shoe_rows(alpha, rect, ankle, cols):
    """opening: the median top row (alpha >= 128) over the 5 columns at the
    ankle; sole: the median lower edge over the foot columns. Sheet rows."""
    H, W = alpha.shape
    tops, soles = [], []
    for x in range(cols[0], cols[1] + 1):
        c = x - rect[0]
        if not 0 <= c < W:
            continue
        r = np.nonzero(alpha[:, c])[0]
        if len(r):
            soles.append(int(r.max()) + 1 + rect[1])
    ax = int(math.floor(ankle[0]))
    for x in range(ax - 2, ax + 3):
        c = x - rect[0]
        if 0 <= c < W:
            r = np.nonzero(alpha[:, c])[0]
            if len(r):
                tops.append(int(r.min()) + rect[1])
    return (float(np.median(tops)) if tops else None), (float(np.median(soles)) if soles else None)


# ---------------------------------------------------------------------------
# Per figure, from the packed 8-bit crops (what the runtime reads)
# ---------------------------------------------------------------------------
def sleeve_frame(fz, key, i):
    sex, view = key.split('-')
    F = fz.data[key]
    return F['joints']['shoulder'][i], F['k'], rest_angle(fz, sex, view, i)


def opening_of(crop, rect, shoulder, k, rest, step=.1):
    """The sleeve's opening in its frame: per .1 u across (q[0]) the lowest
    opaque (alpha >= 128) point down the arm (q[1]), [[q0, t]...] u."""
    ys, xs = np.nonzero(crop[..., 3] >= 128)
    if not len(ys):
        return None
    q0, q1 = to_q(rect[0] + xs + .5, rect[1] + ys + .5, shoulder, k, rest)
    bins = np.round(q0 / step).astype(int)
    out = []
    for b in np.unique(bins):
        out.append([round(float(b * step), 4), round(float(q1[bins == b].max()), 4)])
    return out if len(out) >= 2 else None


def hem_points(torso, rect, g, step=4):
    """The hem outline (sheet px): the lower edge of the torso drawing on the
    frozen hem columns, every `step` columns and the last."""
    a = torso[..., 3] >= 128
    cols = [c[0] for c in g['hem']['columns']]
    pts = []
    for j, x in enumerate(cols):
        if j % step and j != len(cols) - 1:
            continue
        c = x - rect[0]
        if not 0 <= c < a.shape[1]:
            continue
        r = np.nonzero(a[:, c])[0]
        if len(r):
            pts.append([x + .5, float(r.max() + 1 + rect[1])])
    return pts if len(pts) >= 2 else None


def collar_points(torso, rect, g, step=2):
    """The neck opening (sheet px): the torso drawing's top edge on the frozen
    collar columns (the girl's back has none, its collar lies under the bob:
    there the top edge of the rebuilt cloth under the hair)."""
    a = torso[..., 3] >= 128
    cols = [c[0] for c in g['upper']['columns'] if c[2] == 'collar']
    if not cols:
        cols = [c[0] for c in g['upper']['columns'] if c[3]]
    pts = []
    for j, x in enumerate(cols):
        if j % step and j != len(cols) - 1:
            continue
        c = x - rect[0]
        if not 0 <= c < a.shape[1]:
            continue
        r = np.nonzero(a[:, c])[0]
        if len(r):
            pts.append([x + .5, float(r.min() + rect[1])])
    return pts if len(pts) >= 2 else None


def top_figure(fz, key, crops, rects):
    """Record fields of one top figure. crops/rects: 'torso', 'sleeve0'
    (, 'sleeve1'): uint8 RGBA crops and their sheet rects. Returns the
    sleeves' {cuff, opening, box, raised (uint8 RGBA or None)}, underarm,
    hem, collar and diagnostics."""
    sex, view = key.split('-')
    F = fz.data[key]
    g = fz.zones[key]
    profile = view == 'right'
    n = 1 if profile else 2
    sleeves, info = [], {}
    for i in range(n):
        name = 'sleeve%d' % i
        crop, rect = crops[name], rects[name]
        shoulder, k, rest = sleeve_frame(fz, key, i)
        opening = opening_of(crop, rect, shoulder, k, rest)
        arm = next(a for a in g['arms'] if a['i'] == i)
        cuff = cuff_value(arm, shoulder, k, rest, opening)
        raised = None
        alphas = [crop[..., 3]]
        if not profile:
            keep, inf = raised_alpha(crop, rect, shoulder, k, rest, i, cuff)
            raised = crop.copy()
            raised[~keep] = 0
            alphas.append(raised[..., 3])
            info['raised%d' % i] = inf
        box = sleeve_box(alphas, rect, shoulder, k, rest, i, profile)
        sleeves.append(dict(cuff=cuff, opening=opening, box=box, raised=raised))
    under = None
    if not profile:
        fr = fz.fixture['sexes'][sex]['frames']['views'][view]
        C = fz.fixture['sexes'][sex]['frames']['collar']
        torso = dict(rect=rects['torso'], rgba=crops['torso'])
        sl = [dict(rect=rects['sleeve%d' % i], rgba=crops['sleeve%d' % i]) for i in range(2)]
        up = [s['raised'][..., 3] >= 128 for s in sleeves]
        under = underarm(torso, sl, up, F, C, dict(shoulder=fr['shoulder'], elbow=fr['elbow']), [s['cuff'] for s in sleeves])
    return dict(sleeves=sleeves, underarm=under, hem=hem_points(crops['torso'], rects['torso'], g),
                collar=collar_points(crops['torso'], rects['torso'], g), info=info)


def bottom_figure(fz, key, crop, rect):
    """Record fields of one bottom figure (see the module docstring)."""
    sex, view = key.split('-')
    F = fz.data[key]
    g = fz.zones[key]
    profile = view == 'right'
    H, W = fz.sheet.shape[:2]
    alpha = np.zeros((H, W), bool)
    lum = np.full((H, W), 255.0, np.float32)
    x, y, w, h = rect
    a = crop[..., 3] >= 128
    alpha[y:y + h, x:x + w] = a
    lum[y:y + h, x:x + w] = np.where(a, lum_of(crop[..., :3].astype(np.float32)), 255.0)
    x0, y0, x1, y1 = g['cell']
    s, bottom, upper = seat(alpha, lum, F, g, profile, x0, y0, x1, y1)
    out = dict(edgeTone=edge_tone(crop, edge_row(F, rect)))
    cx = int(math.floor(F['neck'][0] if not profile else g['center']))
    col = np.nonzero(alpha[y0:y1, cx])[0]
    out['waistTop'] = float(col.min() + y0) if len(col) else None
    along = []
    for lg in g['legs']:
        rows = [bottom[c] for c in range(lg['cols'][0], lg['cols'][1] + 1) if c in bottom]
        if rows:
            along.append(cuff_along(F, lg['i'], float(np.median(rows)), (lg['cols'][0] + lg['cols'][1] + 1) / 2))
    out['cuffAlong'] = along or None
    if s['cut'] is None or s['cuff'] is None:
        out['seatError'] = 'no cuff outline found'
        return out
    span = row_span(crop, rect, F, s['cut'] - 1)
    if profile:
        out['sideSeat'] = dict(cut=s['cut'], cuff=s['cuff'], span=span)
    else:
        row = alpha[int(s['cut']) - 1, x0:x1]
        xs = np.nonzero(row)[0] + x0
        rise = fit_rise(s['cut'], (int(xs.min()), int(xs.max()) + 1), bottom, upper) if len(xs) else 0.0
        out['seat'] = dict(cut=s['cut'], apex=s['apex'], cuff=s['cuff'], rise=round(rise, 2), span=span)
    return out


def shoes_figure(fz, key, crops, rects):
    F = fz.data[key]
    g = fz.zones[key]
    out = []
    for i in range(len(crops)):
        name = 'shoe%d' % i
        ft = next(f for f in g['feet'] if f['i'] == i)
        opening, sole = shoe_rows(crops[name][..., 3] >= 128, rects[name], F['joints']['ankle'][i], ft['cols'])
        out.append(dict(opening=opening, sole=sole))
    return out
