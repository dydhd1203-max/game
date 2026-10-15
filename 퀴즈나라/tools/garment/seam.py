"""DP seams inside frozen bands (stage 3, WP6; plan 'segmentation' step 4).

A band is a strip around one of the product's variable boundaries, laid out
in a frame: u across the boundary (one DP column per unit), v along each
column from the product side to the other side (one sample per px):
  cuff     sleeve over the arm, in the sleeve frame of the frozen zones (v = t
           down the resting upper arm from the shoulder joint, u = c across),
           columns inside the arm's painted width;
  collar   top over the neck: per collar column, v = -y (product below);
  hem      top over the bottom: per hem column (not under the hand), v = y;
  shorts   bottom over a leg: per leg column, v = y (product above);
  shoe     shoe over the leg's end: per ankle column, v = -y (product below).
Each column picks ONE boundary b (product = samples before b) minimising
  sum_{j<b} c_j  -  EDGE * ink_{b-1} * q_b  +  LAMBDA |b - b_basic|
under |b_c - b_(c-1)| <= 2 px between neighbouring columns (cost MU per px),
by Viterbi. The per-sample cost of being product is
  c_j = W * (lr_j + BETA m_j + prior_j) * (1 - ink_j)
  lr_j     clip(nll_product - nll_other, -6, 6): the colour likelihood ratio
           of this sheet's models (other = skin, or the neighbouring slot at
           the hem), the tie-breaker;
  m_j      skin bands only: clip((10 - dE(U, B)) / 5, -1.5, 1.5), the frozen
           body art showing through (near another slot B holds refilled cloth
           and is not used);
  prior_j  unchanged pixels (D_T < tau / 2) lean to their frozen owner;
and the garment's own drawn edge is the primary evidence: ink_{b-1} (the
outline ridge, without the body part's own side outline and the fixed
occluders' outlines) followed by samples that look like the other side (q_b).
A boundary that ends on a line is then placed where the line's pixel
coverage ends (the half-way lightness between the line's darkest pixel and
the other side), so a seam and the drawn reference agree on what 'the line'
is. Fixed occluders above the product (an arm over the shirt, the head)
neither vote nor change owner. points() maps a seam back to sheet px for the
metadata (hem, collar and cuff opening polylines).
"""
import math

import numpy as np

from avatar_build import matte as M
from avatar_build.frozen import CELLS
from avatar_build.limits import t_hidden

W = dict(edge=14.0, colour=.35, beta=1.0, prior=4.0, lam=.05, mu=.6, step=2, lr=6.0, bg=3.0)
MU = {'hem': 2.0}
STEP = {'hem': 1}  # a hem is one smooth line: a button or a print at it must not bend the seam


class Band:
    def __init__(self, name, kind, key, origin, cols, vlo, vhi, region, other, fixed, layer, body=None,
                 arm=None, sgn=1, extra=None):
        self.name, self.kind, self.key, self.origin = name, kind, key, origin
        self.cols = np.asarray(cols, np.float64)
        self.vlo = np.asarray(vlo, np.int64)
        self.vhi = np.asarray(vhi, np.int64)
        self.region = region
        self.other, self.fixed, self.layer, self.body = other, tuple(fixed), layer, body
        self.arm = arm  # (S, axis, normal) cell-local, for the sleeve frame
        self.sgn = sgn
        self.extra = extra or {}

    def to_px(self, u, v):
        """Cell-local point (x, y) of frame coordinates (u, v)."""
        u = np.asarray(u, np.float64); v = np.asarray(v, np.float64)
        if self.arm is not None:
            S, a, n = self.arm
            return S[0] + a[0] * v + n[0] * u, S[1] + a[1] * v + n[1] * u
        return u, self.sgn * v

    def from_px(self, x, y):
        """(u, v) of pixel centres (x, y given as cell-local pixel indices)."""
        xc = np.asarray(x, np.float64) + .5; yc = np.asarray(y, np.float64) + .5
        if self.arm is not None:
            S, a, n = self.arm
            dx, dy = xc - S[0], yc - S[1]
            return dx * n[0] + dy * n[1], dx * a[0] + dy * a[1]
        return xc, self.sgn * yc

    def samples(self, c):
        """Pixel indices (ys, xs) of column c's samples (product side first) and their v."""
        vs = np.arange(self.vlo[c], self.vhi[c]) + .5
        x, y = self.to_px(np.full(len(vs), self.cols[c]), vs)
        return np.floor(y).astype(int), np.floor(x).astype(int), vs


def run_through(row, x, slack=6):
    """[x0, x1] of the run of True in `row` containing x (or within slack)."""
    w = len(row)
    for d in range(slack + 1):
        for xs in (x - d, x + d):
            if 0 <= xs < w and row[xs]:
                a = xs
                while a > 0 and row[a - 1]:
                    a -= 1
                b = xs
                while b + 1 < w and row[b + 1]:
                    b += 1
                return a, b
    return None


def bands_for(fz, slot, key, outer=0.0, inner=None):
    """The frozen bands of one figure for a product slot (cell-local).
    inner / outer: front/back cuff bands reach within `inner` px of the
    arm's painted edge on the body's side (median edge) / `outer` px past it
    on the outside, instead of stopping 2.5 px inside the 90th-percentile
    edge (None / 0: the inset band)."""
    x0, y0, x1, y1 = CELLS[key]
    h, w = y1 - y0, x1 - x0
    g = fz.zones[key]
    body = fz.body(fz.art_for(slot))
    out = []
    yy, xx = np.mgrid[0:h, 0:w]
    if slot == 'top':
        arm_a = body['arms'][y0:y1, x0:x1, 3] > 127
        for a in g['arms']:
            S = np.array(a['shoulder'], float) - (x0, y0)
            ax = np.array(a['axis'], float); nr = np.array(a['normal'], float)
            tlo = int(math.floor(float(t_hidden(a, 0)) - 8))
            thi = int(math.ceil(a['tCap'] + 8))
            dx, dy = xx + .5 - S[0], yy + .5 - S[1]
            t = dx * ax[0] + dy * ax[1]; c = dx * nr[0] + dy * nr[1]
            strip = (t >= tlo) & (t < thi) & (np.abs(c) < 3 * a['re'])
            arm_in = strip & arm_a
            if g['view'] != 'right':
                cx = g['center'] - x0
                arm_in &= (xx + .5 < cx) if S[0] < cx else (xx + .5 >= cx)
            arm_in = M.connected_to(arm_in, arm_in & (np.abs(c) < 2))
            cs = c[arm_in]; ts = t[arm_in]
            lo_c, hi_c = [], []
            for tv in range(tlo, thi):
                sel = (ts >= tv) & (ts < tv + 1)
                if sel.sum() >= 3:
                    lo_c.append(cs[sel].min()); hi_c.append(cs[sel].max())
            if not lo_c:
                continue
            c0 = math.ceil(float(np.percentile(lo_c, 90)) + 2.5)
            c1 = math.floor(float(np.percentile(hi_c, 10)) - 2.5)
            out_pos = nr[0] * (S[0] + x0 - g['center']) > 0
            if inner is not None and g['view'] != 'right':
                # The inward side of the arm (toward the body's centre): the
                # cuff's line runs on over the whole arm there, up to the
                # torso; the columns reach the arm's painted inner edge.
                if out_pos:
                    c0 = math.ceil(float(np.percentile(lo_c, 50)) + inner)
                else:
                    c1 = math.floor(float(np.percentile(hi_c, 50)) - inner)
            if outer and g['view'] != 'right':
                # the outward side of the arm: away from the body's centre
                if out_pos:
                    c1 = math.floor(float(np.percentile(hi_c, 50)) + outer)
                else:
                    c0 = math.ceil(float(np.percentile(lo_c, 50)) - outer)
            cols = np.arange(c0, c1 + 1) + 0.0
            region = arm_in & (c >= c0 - .5) & (c <= c1 + .5)
            if outer and g['view'] != 'right':
                region = strip & (c >= c0 - .5) & (c <= c1 + .5) & M.dilate(arm_in, int(math.ceil(outer)) + 3)
            out.append(Band('cuff%d' % a['i'], 'cuff', key, (x0, y0), cols, [tlo] * len(cols), [thi] * len(cols),
                            region, 'skin', (8,), 'sleeves', body='arms', arm=(S, ax, nr),
                            extra=dict(arm=a, outPos=bool(out_pos) if g['view'] != 'right' else None)))
        cols, vlo, vhi = [], [], []
        depth = dict((x, d) for x, d in g['neck']['depthByColumn'])
        allow = g['upper']['allowPx']
        for x, ub, zone, hid, cut_row, s_row in g['upper']['columns']:
            if zone != 'collar' or hid:
                continue
            ylo = int(math.floor(ub - allow - 8))
            if cut_row is not None:
                ylo = max(ylo, int(cut_row) + 1)
            yhi = int(ub + depth.get(x, 12) + 4)
            if yhi <= ylo:
                continue
            cols.append(x - x0 + .5); vlo.append(-(yhi - y0)); vhi.append(-(ylo - y0))
        if cols:
            region = np.zeros((h, w), bool)
            for u, a_, b_ in zip(cols, vlo, vhi):
                region[-b_:-a_, int(u)] = True
            out.append(Band('collar', 'collar', key, (x0, y0), cols, vlo, vhi, region, 'skin', (3, 8), 'shirt', body='neck', sgn=-1))
        cols, vlo, vhi = [], [], []
        off = g['hem']['waistCoverOffsetPx']
        low = g['hem']['hemLowRow']
        for x, hb, st, armed in g['hem']['columns']:
            if armed:
                continue
            ylo = int(math.floor(st - off - 6)); yhi = int(math.ceil(low + 6))
            cols.append(x - x0 + .5); vlo.append(ylo - y0); vhi.append(yhi - y0)
        if cols:
            region = np.zeros((h, w), bool)
            for u, a_, b_ in zip(cols, vlo, vhi):
                region[a_:b_, int(u)] = True
            out.append(Band('hem', 'hem', key, (x0, y0), cols, vlo, vhi, region, 'neighbour', (3, 8), 'shirt'))
    elif slot == 'bottom':
        legs_a = body['legs'][y0:y1, x0:x1, 3] > 127
        for lg in g['legs']:
            ylo = int(lg['hiddenRow'] - 8); yhi = int(math.ceil(lg['longRow'] + 6))
            kx = lg['knee'][0] - x0
            region = np.zeros((h, w), bool)
            lo_x, hi_x = [], []
            for yv in range(ylo - y0, yhi - y0):
                run = run_through(legs_a[yv], int(kx))
                if run is None:
                    continue
                region[yv, run[0]:run[1] + 1] = True
                lo_x.append(run[0]); hi_x.append(run[1])
            if not lo_x:
                continue
            if inner is not None:
                # the whole leg: the cuff's line and the legacy pale band
                # under it run on to the leg's painted sides
                xa = int(np.percentile(lo_x, 50)); xb = int(np.percentile(hi_x, 50))
            else:
                xa = int(np.percentile(lo_x, 90)) + 3; xb = int(np.percentile(hi_x, 10)) - 3
            cols = np.arange(xa, xb + 1) + .5
            region[:, :xa] = False; region[:, xb + 1:] = False
            out.append(Band('shorts%d' % lg['i'], 'shorts', key, (x0, y0), cols, [ylo - y0] * len(cols), [yhi - y0] * len(cols),
                            region, 'skin', (1, 2, 3, 8), 'shorts', body='legs', extra=dict(leg=lg)))
    elif slot == 'shoes':
        legs_a = body['legs'][y0:y1, x0:x1, 3] > 127
        lim = fz.limits['basic'][key]['shoes/low']
        for ft in g['feet']:
            name = 'foot%d' % ft['i']
            leg_end = lim['SHOE_LOW_OPENING'][name]['legEnd']
            ylo = int(ft['highRow'] - 4); yhi = int(leg_end + 6)
            ax_ = ft['ankle'][0] - x0
            region = np.zeros((h, w), bool)
            lo_x, hi_x = [], []
            for yv in range(ylo - y0, min(h, yhi - y0)):
                run = run_through(legs_a[yv], int(ax_))
                if run is None:
                    continue
                region[yv, run[0]:run[1] + 1] = True
                lo_x.append(run[0]); hi_x.append(run[1])
            if not lo_x:
                continue
            if inner is not None:
                # the whole leg: a shoe's top line runs on to the leg's painted
                # sides (a taller collar beside the ankle is the shoe's)
                xa = int(np.percentile(lo_x, 50)); xb = int(np.percentile(hi_x, 50))
            else:
                xa = int(np.percentile(lo_x, 90)) + 2; xb = int(np.percentile(hi_x, 10)) - 2
            cols = np.arange(xa, xb + 1) + .5
            region[:, :xa] = False; region[:, xb + 1:] = False
            out.append(Band('shoe%d' % ft['i'], 'shoe', key, (x0, y0), cols, [-(yhi - y0)] * len(cols), [-(ylo - y0)] * len(cols),
                            region, 'skin', (1, 2, 3, 4, 8), 'shoes', body='legs', sgn=-1, extra=dict(foot=ft)))
    return out


def side_outline(alpha, garment=None, r=2):
    """A body part's own outline: its pixels within r px of its alpha edge
    where the outside is not the garment the band is about (the part's
    alpha edge hidden under that garment, e.g. the clean neck's end under the
    collar, is no drawn outline)."""
    out = ~alpha if garment is None else ~alpha & ~garment
    return alpha & M.dilate(out, r)


def column_profile(band, c, img, h, w, fill=0.0):
    ys, xs, vs = band.samples(c)
    ok = (ys >= 0) & (ys < h) & (xs >= 0) & (xs < w)
    out = np.full(len(vs), fill, np.float64)
    out[ok] = img[ys[ok], xs[ok]]
    return out


LINE = 60.0  # line art: this much darker than the brightest pixel of its 5x5 neighbourhood (a cast-shadow line on skin is ~40)
LINE_RUN = 7  # px: a drawn edge line crossing a band column is at most this thick there


def line_end(lm, a, e):
    """Index of the first sample past a drawn line occupying samples a..e of
    a lightness profile: the last sample darker than half-way between the
    line's darkest sample and the median of the 3 samples past e (one more
    sample may join). A pixel half covered by the line belongs to it."""
    after = lm[e + 1:e + 4]
    if not len(after):
        return e + 1
    half = (float(lm[a:e + 1].min()) + float(np.median(after))) / 2
    k = e
    while k > a and lm[k] >= half:
        k -= 1
    while k + 1 < len(lm) and k + 1 <= e + 1 and lm[k + 1] < half:
        k += 1
    return k + 1


def line_depth(lum):
    """Ridge depth: how much darker a pixel is than the brightest pixel of
    its 5x5 neighbourhood (a drawn line on any cloth, dark or light)."""
    lmax = M._max_filter(np.clip(lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
    return lmax - lum


def line_boundary(band, b_leg, lum, body_alpha=None, garment_alpha=None, fill_ends=False):
    """The drawn edge per column (absolute v). Candidates per column: the end
    (line_end) of every line run (ridge depth >= LINE, at most LINE_RUN samples: a
    longer run is a line along the column, e.g. the neck's side line) that
    meets the legacy boundary b_leg (8 px inside to 10 px beyond), and b_leg
    itself. One smooth chain is chosen over the columns (Viterbi: a line
    beats the legacy boundary, the outermost line the inner ones, and a jump
    of more than 1 px between neighbouring columns costs), so a V where two
    lines cross or a hair tuft on the collar does not make single-column
    spikes. nan stays nan. The body part's own outline (body_alpha's rim
    outside garment_alpha) is no line."""
    h, w = lum.shape
    rim = side_outline(body_alpha, garment_alpha) if body_alpha is not None else np.zeros((h, w), bool)
    depth = line_depth(lum)
    cands = []
    for c in range(len(band.cols)):
        if np.isnan(b_leg[c]):
            cands.append(None)
            continue
        lm = column_profile(band, c, lum, h, w, 255.0)
        jl = int(b_leg[c] - band.vlo[c])
        dark = (column_profile(band, c, depth, h, w) >= LINE) & ~(column_profile(band, c, rim, h, w) > .5)
        runs = []
        j = 0
        while j < len(lm):
            if dark[j]:
                a = j
                while j + 1 < len(lm) and dark[j + 1]:
                    j += 1
                if a <= jl + 10 and j >= jl - 8 and j - a + 1 <= LINE_RUN:
                    runs.append(band.vlo[c] + line_end(lm, a, j))
            j += 1
        opts = [(float(b_leg[c]), 0.0)]
        for rank, val in enumerate(sorted(runs, reverse=True)):
            opts.append((float(val), -6.0 + .5 * rank))  # a line beats the legacy edge, the outermost line the others
        cands.append(opts)
    out = b_leg.copy()
    idx = [c for c in range(len(cands)) if cands[c] is not None]
    if not idx:
        return out
    # Viterbi over the columns that have candidates
    cost = [np.array([o[1] for o in cands[idx[0]]])]
    back = [None]
    for p, c in zip(idx, idx[1:]):
        prev = cands[p]; cur = cands[c]
        pv = np.array([o[0] for o in prev]); cv = np.array([o[0] for o in cur])
        jump = np.maximum(np.abs(cv[:, None] - pv[None, :]) - 2, 0) * 1.0
        tot = cost[-1][None, :] + jump
        back.append(np.argmin(tot, 1))
        cost.append(tot.min(1) + np.array([o[1] for o in cur]))
    k = int(np.argmin(cost[-1]))
    on_line = np.zeros(len(out), bool)
    for n in range(len(idx) - 1, -1, -1):
        out[idx[n]] = cands[idx[n]][k][0]
        on_line[idx[n]] = k > 0
        if n:
            k = int(back[n][k])
    if fill_ends and on_line.any():
        # columns without a line of their own (where the cuff's line meets the
        # limb's side outline and fades) take the drawn line's value: gaps
        # between line columns interpolated, the ends held level
        good = np.nonzero(on_line & ~np.isnan(out))[0]
        for c in range(len(out)):
            if on_line[c] or np.isnan(out[c]):
                continue
            out[c] = float(np.interp(c, good, out[good]))
    return out


def despike(b, half=4, tol=3.0):
    """A drawn edge is a smooth curve: a column more than tol px from the
    median of its 2*half+1 neighbours takes that median."""
    out = b.copy()
    ok = np.nonzero(~np.isnan(b))[0]
    vals = b[ok]
    for i, c in enumerate(ok):
        med = float(np.median(vals[max(0, i - half):i + half + 1]))
        if abs(b[c] - med) > tol:
            out[c] = med
    return out


def basic_boundary(band, drawn_alpha):
    """Per column: the drawn basic garment's boundary (v of the first sample
    past its first run from the product side), nan where it is absent."""
    out = []
    h, w = drawn_alpha.shape
    for c in range(len(band.cols)):
        on = column_profile(band, c, drawn_alpha, h, w) > .5
        idx = np.nonzero(on)[0]
        if not len(idx):
            out.append(np.nan)
            continue
        j = idx[0]
        while j + 1 < len(on) and (on[j + 1] or (j + 2 < len(on) and on[j + 2])):
            j += 1
        out.append(band.vlo[c] + j + 1.0)
    return np.array(out)


def cost_images(ctx, band, nll, O, fg):
    """Per-pixel images of one band's cell: c (weighted colour cost of being
    product), ink (the drawn edge, without the body part's own outline and
    the fixed occluders' outlines), pq (how much a pixel looks like the other
    side, 0..1), lum."""
    x0, y0 = band.origin
    h, w = O.shape
    sl = np.s_[y0:y0 + h, x0:x0 + w]
    D, DB, ink, lum = ctx.D[sl], ctx.DB[sl], ctx.ink[sl].copy(), ctx.lum[sl]
    depth = ctx.depth[sl]
    nq = nll['skin'] if band.other == 'skin' else nll['neighbour']
    fixed = np.isin(O, band.fixed)
    ink *= ~(M.dilate(fixed, 2) & ~fixed)
    if band.body:
        qa = ctx.fz.body(ctx.fz.art_for(ctx.slot))[band.body][sl][..., 3] > 127
        ink *= ~side_outline(qa, ctx.fz.drawn[band.layer][sl][..., 3] > 127)
    soft = 1 - ink
    ell = np.clip(nll['product'] - nq, -W['lr'], W['lr'])
    c = ell.copy()
    if band.other == 'skin':
        c = c + W['beta'] * np.clip((10 - DB) / 5, -1.5, 1.5)
    from segment import SLOT
    plabels = SLOT[ctx.slot]['labels']
    # Unchanged pixels (D_T < tau/2, fading out at tau) keep their frozen
    # owner (a new cream cuff over the old cream cuff stays cuff); changed
    # pixels go by this sheet's colour evidence.
    u = np.clip((ctx.tau - D) / (ctx.tau / 2), 0, 1)
    # ... and unchanged pixel by pixel: the window minimum forgives a 2 px
    # shift (registration), so a cuff or shoe edge drawn a few px further
    # over the body read unchanged there and the prior pulled the seam back
    from avatar_build import register as R
    de = R.de(ctx.Ut[sl], ctx.Tlab[sl], .7)
    u = u * np.clip((2 * ctx.tau - de) / ctx.tau, 0, 1)
    owner = np.where(np.isin(O, plabels), -W['prior'], np.where(O != 0, W['prior'], 0.0))
    c = (u * owner + (1 - u) * c) * soft * W['colour']
    c = np.where(fg, c, W['prior'] * W['colour'])  # the page is never product
    pq = np.clip(.5 + ell / 6, 0, 1)
    pq = np.where(fixed, .5, np.where(fg, pq, 1.0))
    ink = np.where(fixed | ~fg, 0.0, ink)
    return c, ink, pq, lum, depth


def solve(ctx, key, band, nll, O, fg):
    """Viterbi over the band's columns (see the module docstring)."""
    c_img, ink, pq, lum, depth = cost_images(ctx, band, nll, O, fg)
    h, w = O.shape
    x0, y0 = band.origin
    drawn = ctx.fz.drawn[band.layer][y0:y0 + h, x0:x0 + w, 3] > 127
    b0 = basic_boundary(band, drawn)
    vmin = int(band.vlo.min()); vmax = int(band.vhi.max())
    n = vmax - vmin + 1
    C = len(band.cols)
    INF = 1e9
    E = np.full((C, n), INF)
    prof = []
    for c in range(C):
        dc = column_profile(band, c, c_img, h, w, W['bg'])
        ik = column_profile(band, c, ink, h, w)
        q = column_profile(band, c, pq, h, w, 1.0)
        lm = column_profile(band, c, lum, h, w, 255.0)
        dp = column_profile(band, c, depth, h, w)
        m = len(dc)
        cum = np.concatenate([[0.0], np.cumsum(dc)])
        qp = np.concatenate([q, [q[-1]] * 3])
        qmean = np.array([qp[b:b + 3].mean() for b in range(m + 1)])
        # the drawn edge is the column's strongest ridge: a faint shadow line
        # just past it earns a fraction of the reward
        rel = dp / max(float(dp.max()), 1.0)
        before = np.concatenate([[0.0], ik * rel])
        e = cum - W['edge'] * before * qmean
        states = np.arange(m + 1)
        if not np.isnan(b0[c]):
            e = e + W['lam'] * np.abs(band.vlo[c] + states - b0[c])
        lo = band.vlo[c] - vmin
        E[c, lo:lo + m + 1] = e
        prof.append((ik, lm, dp))
    cost = E[0].copy()
    back = np.zeros((C, n), np.int64)
    mu = MU.get(band.kind, W['mu'])
    for c in range(1, C):
        gap = max(1.0, abs(band.cols[c] - band.cols[c - 1]))
        step = int(math.ceil(STEP.get(band.kind, W['step']) * gap))
        best = np.full(n, INF); arg = np.zeros(n, np.int64)
        for s_ in range(-step, step + 1):
            shifted = np.full(n, INF)
            if s_ >= 0:
                shifted[s_:] = cost[:n - s_] if s_ else cost
            else:
                shifted[:s_] = cost[-s_:]
            cand = shifted + mu * abs(s_) / gap
            better = cand < best
            best = np.where(better, cand, best)
            arg = np.where(better, np.arange(n) - s_, arg)
        cost = best + E[c]
        back[c] = arg
    b = np.zeros(C, np.int64)
    b[-1] = int(np.argmin(cost))
    for c in range(C - 1, 0, -1):
        b[c - 1] = back[c, b[c]]
    v = vmin + b.astype(np.float64)
    # A boundary that ends on a drawn line ends where the line's coverage
    # ends (line_end), the same rule as the drawn reference.
    refined = v.copy()
    for c in range(C):
        ik, lm, dp = prof[c]
        j = int(v[c] - band.vlo[c])  # first sample past the product
        if j < 1 or j > len(ik):
            continue
        if dp[j - 1] >= LINE:
            a, e = j - 1, j - 1
            while a > 0 and dp[a - 1] >= LINE:
                a -= 1
            while e + 1 < len(lm) and e + 1 <= j and dp[e + 1] >= LINE:
                e += 1
        elif ik[j - 1] >= .5:
            a, e = j - 1, j - 1
            while a > 0 and ik[a - 1] >= .5:
                a -= 1
        else:
            continue
        refined[c] = band.vlo[c] + line_end(lm, a, e)
    return dict(name=band.name, kind=band.kind, cols=band.cols.copy(), v=refined, vdp=v, b0=b0, cost=float(cost.min()))


def assign(band, r, label, O, fg, fixed_extra=None):
    """Relabel the band's region by its seam (fixed occluders and holes keep theirs)."""
    keep = np.isin(O, band.fixed) | (label == 3)
    if fixed_extra is not None:
        keep |= fixed_extra
    ys, xs = np.nonzero(band.region & fg & ~keep)
    if not len(ys):
        return
    u, v = band.from_px(xs, ys)
    order = np.argsort(r['cols'])
    B = np.interp(u, r['cols'][order], r['v'][order])
    inside = v < B
    label[ys, xs] = np.where(inside, 1, np.where(O[ys, xs] != 0, 2, 0)).astype(np.uint8)


def points(band, r):
    """Sheet-px points of the seam (the boundary between the last product
    sample and the first other one)."""
    x, y = band.to_px(r['cols'], r['v'])
    return np.stack([x + band.origin[0], y + band.origin[1]], 1)


def drawn_points(band, drawn_alpha):
    """The drawn reference's boundary in the same frame (sheet px), for the
    round trip's seam errors. nan columns are dropped."""
    b0 = basic_boundary(band, drawn_alpha)
    ok = ~np.isnan(b0)
    x, y = band.to_px(band.cols[ok], b0[ok])
    return band.cols[ok], b0[ok], np.stack([x + band.origin[0], y + band.origin[1]], 1)
