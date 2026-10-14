"""Part split, hidden cloth and post rules of a segmented upload (stage 3, WP6;
plan 'segmentation' steps 5-7).

Per figure, from segment.py's labels:
  skin strip  product pixels this sheet's skin model wins clearly (3 nats),
              lying over body art and 4-connected to visible body skin, that
              are neither drawn line nor unchanged product: the cast shadow on
              the skin baked into the cloth leaves the garment, so the tinted
              body art shows there (the pale band);
  pin-holes   enclosed non-product specks (<= 12 px) inside the product close;
  alpha       1 inside the product; at the outer silhouette, and on the faint
              fringe outside the matte, known-background unmixing against the
              measured page white: alpha = (U - W).(F - W) / |F - W|^2 with F
              the strongest-contrast product paint within 2 px (the pixel
              itself excluded); ownership cuts (seams) stay hard;
  parts       by frozen ownership, without colour:
                top front/back  sleeve = the product outside the frozen armhole
                                seam (zones.json armholes, continued along its
                                end directions), torso = the rest;
                top profile     sleeve = the regions the sleeve's own outlines
                                enclose (cap and cuff band, the cuff ring's ends
                                beside the arm included), else the product
                                inside the resting upper-arm capsule grown to
                                its painted outline (at most 3.5 u); cuff-paint
                                left on the torso next to the cuff joins it;
                bottom          one piece;  shoes  one per foot (centre split);
  hidden      cloth under frozen occluders at rest, rebuilt as the cloth's
              plain shading continued smoothly into the hole (plain_cloth:
              the harmonic half of cloth.rebuild_cloth, prints excluded; the
              exemplar weave read as a blocky mosaic on ChatGPT's soft
              shading) and, front/back, the side outline drawn along the new
              edge as dark as the painted line's core (outline_core), inside
              the slot's target silhouette:
                torso front/back  the outline of cloth.side_outline (Bezier from
                                  the armpit A on the NEW painted side contour to
                                  the shoulder point S, kept 9 px clear of the
                                  frozen seam; a contour / S within 1.5 px of
                                  the frozen ones is the frozen one) under the
                                  sleeves, arms and hair;
                torso profile     the painted front/back edges interpolated under
                                  the arm, hand and sleeve (wherever the upload
                                  drew them), the hem continued
                                  (cloth.edge_cover), and the 'ring' (the
                                  arm's and sleeve's outline and cast shadow
                                  painted on the cloth within 4 px of them);
                sleeves           hair over the sleeve cap (frozen hair-occlusion)
                                  inside the frozen basic sleeve;
                bottom            up to the frozen waist cover line (cover-bottom
                                  above the hips) and under the hands;
  post        sleeve seam fade (6 px from the frozen seam, cuff end crisp,
              prints opaque), detached specks (< 12 px) dropped.
"""
import math

import numpy as np

from avatar_build import matte as M
from avatar_build import register as R
from avatar_build.cloth import (draw_outline, edge_cover, garment_prints, outline_profile, rebuild_cloth,
                                sleeve_seam_fade)
from avatar_build.common import box_blur, harmonic, hue_chroma, inner_distance, local_mean, lum_of, poly_mask
from avatar_build.frozen import CELLS

CLEAR = 9.0  # cloth.side_outline: the new outline keeps this far outside the sewn seam
SNAP = 1.5  # px: a measured side contour / shoulder point this close to the frozen one is the frozen one
PROFILE_SLEEVE_U = 3.5
DEBUG = None  # development: a dict to receive per-figure masks of the profile torso rebuild
F = dict(stripLR=3.0, pinhole=12, speck=12, fringe=.08)


# ---------------------------------------------------------------------------
# Labels: skin strip and pin-holes
# ---------------------------------------------------------------------------
def strip_skin(ctx, key, seg, label):
    from segment import BODY_LABELS, SLOT
    fz = ctx.fz
    x0, y0, x1, y1 = CELLS[key]
    sl = np.s_[y0:y1, x0:x1]
    O = fz.O[sl]
    art = fz.body(fz.art_for(ctx.slot))
    body_art = np.zeros(O.shape, bool)
    for n in ('arms', 'legs', 'neck'):
        body_art |= art[n][sl][..., 3] > 127
    nll = seg['nll']
    # the template's own garment paint, by the window minimum AND pixel by pixel
    unchanged_prod = (ctx.D[sl] < ctx.tau / 2) & (R.de(ctx.Ut[sl], ctx.Tlab[sl], .7) < ctx.tau) & np.isin(O, SLOT[ctx.slot]['labels'])
    skinq = (label == 2) & np.isin(O, BODY_LABELS)
    cand = (label == 1) & body_art & (nll['product'] - nll['skin'] > F['stripLR']) & (ctx.ink[sl] < .5) & ~unchanged_prod
    if seg.get('inside') is not None:
        cand &= ~seg['inside']  # the garment's side of its own drawn edge stays garment
    strip = M.connected_to(cand | skinq, skinq) & cand
    label[strip] = 2
    return int(strip.sum())


def close_pinholes(label, template_bg):
    """Enclosed non-product specks inside the product (<= 12 px) that are
    paint in the upload join it (a button, a print speck the segmentation
    gave to the body)."""
    P = label == 1
    lab_, comps = M.components(~P)
    h, w = P.shape
    border = set(np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]])).tolist())
    n = 0
    for c in comps:
        if c['label'] in border or c['size'] > F['pinhole']:
            continue
        m = lab_ == c['label']
        if (label[m] != 0).all() and not (label[m] == 3).any():
            label[m] = 1
            n += int(m.sum())
    return n


# ---------------------------------------------------------------------------
# Alpha and colour
# ---------------------------------------------------------------------------
def alpha_colour(ctx, key, label, O=None):
    """Product alpha (soft only at the outer silhouette) and colour. Beside
    another part or the body (the slit between a torso side and the hanging
    arm included) the cut stays hard: the runtime reads the side's outline
    there as opaque paint (shirtSide).

    Known-background unmixing against the measured page white W: a soft
    pixel U is paint F over the page, alpha = (U - W).(F - W) / |F - W|^2.
    F is the strongest-contrast product pixel within 2 px (3 px for the outer
    fringe ring when nothing is nearer), the soft pixel itself excluded: an
    antialiased outline's darkest pixel is often itself on the rim (partly
    over the page), so taking only the solid pixels further in (lighter
    cloth) over-estimated the rim's coverage (R1 identity, shoes: rim bias
    +.07). Measured on the round trip; a single white background cannot
    separate a tint from a partly covered darker paint, so the rim keeps a
    residual error (verify-pipeline.py edge alpha)."""
    x0, y0, x1, y1 = CELLS[key]
    U = ctx.U[y0:y1, x0:x1]
    W = float(ctx.res.get('matte', {}).get('level', 255.0))
    P = label == 1
    bg = label == 0
    other = np.isin(label, (2, 3, 4, 5))
    a = P.astype(np.float32)
    # the template's own soft fringe given to the product (frozen background,
    # near the page white, beside the page): rim too, so its paint is unmixed
    pale = np.zeros_like(P)
    if O is not None:
        pale = P & (O == 0) & (np.abs(U - W).max(-1) < 48) & M.dilate(bg, 2)
    solid = P & ~M.dilate(bg | pale, 1)
    rim = P & ~solid
    # the soft rim outside the product: 2 px (an antialiased outline fades
    # over two pixels), never next to another part or body
    fringe = bg & M.dilate(P, 2) & ~M.dilate(other, 1)
    h, w = a.shape
    pad = 3
    Up = np.pad(U, ((pad, pad), (pad, pad), (0, 0)), mode='edge')
    Pp = np.pad(P, pad)
    Fcol = U.copy()
    best = np.full(a.shape, -1.0, np.float32)
    for reach in (2, 3):
        open_ = best < 0
        for dy in range(-reach, reach + 1):
            for dx in range(-reach, reach + 1):
                if (reach == 3 and max(abs(dx), abs(dy)) < 3) or (dy == 0 and dx == 0):
                    continue
                cand = Up[pad + dy:pad + dy + h, pad + dx:pad + dx + w]
                ok = Pp[pad + dy:pad + dy + h, pad + dx:pad + dx + w] & open_
                con = ((cand - W) ** 2).sum(-1)
                take = ok & (con > best)
                best = np.where(take, con, best)
                Fcol = np.where(take[..., None], cand, Fcol)
    d = Fcol - W
    est = ((U - W) * d).sum(-1) / np.maximum((d * d).sum(-1), 1.0)
    est = np.where(best < 0, 0.0, est)  # no paint within reach: not this garment's rim
    soft = rim | fringe
    a[soft] = np.clip(est[soft], 0, 1)
    rgb = U.copy()
    ok = soft & (a >= .35)
    rgb[ok] = np.clip((U[ok] - W * (1 - a[ok, None])) / a[ok, None], 0, 255)
    faint = soft & (a < .35)
    rgb[faint] = Fcol[faint]
    a[a < F['fringe']] = 0
    return a, rgb


# ---------------------------------------------------------------------------
# Part split
# ---------------------------------------------------------------------------
def seam_x(seam, ys, ext=60.0):
    """x of the frozen armhole seam polyline at rows ys, its ends continued
    along their own directions."""
    pts = sorted([tuple(p) for p in seam], key=lambda p: p[1])
    (ax, ay), (bx, by) = pts[0], pts[1]
    (cx, cy), (dx, dy) = pts[-2], pts[-1]
    l0 = math.hypot(ax - bx, ay - by) or 1
    l1 = math.hypot(dx - cx, dy - cy) or 1
    top = (ax + (ax - bx) / l0 * ext, ay + (ay - by) / l0 * ext)
    bot = (dx + (dx - cx) / l1 * ext, dy + (dy - cy) / l1 * ext)
    P = [top] + pts + [bot]
    return np.interp(ys, [p[1] for p in P], [p[0] for p in P])


def sleeve_side(g, ah, shape, x0, y0, basic=None, t_end=None):
    """Front/back: the sleeve's side of the frozen armhole seam. Above the
    seam's lowest point (near the armpit) everything outward of the seam
    (continued upward along its top direction); below it only the upper-arm
    band (|c| <= re + 3 px around the resting arm axis) and the frozen basic
    sleeve (its cuff's inner corner), down to the sleeve's end along the arm
    (t_end, from the cuff seam): the torso's side below the armpit stays
    torso."""
    h, w = shape
    sx = seam_x(ah['seam'], np.arange(h) + y0 + .5) - x0
    xx = np.arange(w)[None, :] + .5
    out = (xx - sx[:, None]) * ah['side'] > 0
    low = max(p[1] for p in ah['seam']) - y0
    arm = next(a for a in g['arms'] if (a['i'] == 0) == (ah['side'] < 0))
    S = np.array(arm['shoulder']) - (x0, y0)
    nr = np.array(arm['normal']); ax_ = np.array(arm['axis'])
    yy = np.arange(h)[:, None] + .5
    c = (xx - S[0]) * nr[0] + (yy - S[1]) * nr[1]
    t = (xx - S[0]) * ax_[0] + (yy - S[1]) * ax_[1]
    below = np.abs(c) <= arm['re'] + 3
    if basic is not None:
        below = below | M.dilate(basic, 2)
    if t_end is not None:
        below = below & (t <= t_end + 2)
    return out & ((yy < low) | below)


def _valley_end(lum, ok, k0, valley=10.0):
    """Index just past the first drawn outline at or after sample k0 of a
    walk (a lightness valley at least `valley` darker than the brightest of
    the 6 px before it, ended where the lightness is back half-way), or None."""
    n = len(lum)
    k = max(k0, 2)
    while k < n and ok[k]:
        ref = float(lum[max(0, k - 12):k].max())
        seg = lum[max(0, k - 3):k + 4]
        if lum[k] <= seg.min() + 1e-6 and lum[k] <= ref - valley:
            half = (lum[k] + ref) / 2
            j = k
            while j + 1 < n and ok[j + 1] and lum[j + 1] < half:
                j += 1
            return j + 1
        k += 1
    return None


def _median_fill(e, half=3):
    ok = ~np.isnan(e)
    out = e.copy()
    for i in np.nonzero(ok)[0]:
        win = e[max(0, i - half):i + half + 1]
        out[i] = np.median(win[~np.isnan(win)])
    return out


def profile_sleeve(fz, key, P, lum, t_end, tlum):
    """Profile sleeve: the frozen basic sleeve, moved with the garment's own
    painted outline. In the resting upper-arm frame of the zones (t down the
    arm from the shoulder joint, c across), every row t from the shoulder to
    the sleeve's end (t_end, from the cuff seam) is walked outward on both
    sides over the product (past the arm, which a cuff surrounds), and every
    column above the shoulder upward. On each walk the drawn outline (the
    first lightness valley from 12 px inside the frozen basic sleeve's edge)
    is found in the upload and in the template; the sleeve's edge is the
    frozen edge displaced by how far the upload's outline lies from the
    template's (a wider or puffed sleeve moves it out, the basic keeps its
    frozen shape), within PROFILE_SLEEVE_U of the axis. Without a frozen
    edge (rows past the basic sleeve) the upload's outline or the product's
    end is used. Ends are median smoothed over 7 rows (a print or a button
    does not cut the sleeve)."""
    x0, y0, x1, y1 = CELLS[key]
    g = fz.zones[key]
    h, w = P.shape
    a = g['arms'][0]
    Fd = fz.data[key]
    S = np.array(a['shoulder']) - (x0, y0)
    ax_ = np.array(a['axis']); nr = np.array(a['normal'])
    r0, r1 = Fd['radii']['arm'][0][0], Fd['radii']['arm'][0][1]
    tE = a['tElbow']
    rmax = PROFILE_SLEEVE_U / g['k']
    step = .5
    basic = fz.drawn['sleeves'][y0:y1, x0:x1, 3] > 127
    tprod = np.isin(fz.O[y0:y1, x0:x1], (1, 2))

    def sample(img, pts):
        xi = np.clip(np.floor(pts[:, 0]).astype(int), 0, w - 1)
        yi = np.clip(np.floor(pts[:, 1]).astype(int), 0, h - 1)
        inside = (pts[:, 0] >= 0) & (pts[:, 0] < w) & (pts[:, 1] >= 0) & (pts[:, 1] < h)
        return img[yi, xi] & inside if img.dtype == bool else img[yi, xi]

    def smooth(v):
        return np.convolve(np.pad(v.astype(float), 1, mode='edge'), [.25, .5, .25], 'valid')

    def walk(pts, start_skip, frozen_only=False):
        pv = sample(P, pts); bv = sample(basic, pts)
        j = 0
        while j < len(pv) and not pv[j] and j * step <= start_skip:
            j += 1
        if j >= len(pv) or not pv[j]:
            return None
        k = j
        while k < len(pv) and pv[k]:
            k += 1
        run = k
        bk = np.nonzero(bv[:run])[0]
        if not len(bk) and frozen_only:
            return None
        if not len(bk):
            v = _valley_end(smooth(sample(lum, pts)), pv, j)
            return (v if v is not None else run) * step
        fe = bk.max() + 1
        k0 = max(j, fe - 24)
        vu = _valley_end(smooth(sample(lum, pts)), pv, k0)
        vt = _valley_end(smooth(sample(tlum, pts)), sample(tprod, pts), k0)
        e = fe
        if vu is not None and vt is not None:
            e = int(np.clip(fe + vu - vt, fe - 16, run))
        return e * step

    ks = np.arange(0, rmax + 1e-6, step)
    rows = np.arange(0, max(t_end, a['tCap']) + 12, 1.0)
    ends = {}
    for side in (-1, 1):
        e = np.full(len(rows), np.nan)
        for i, tv in enumerate(rows):
            rr = r0 + (r1 - r0) * min(max(tv, 0), tE) / max(tE, 1)
            pts = S[None] + ax_[None] * tv + nr[None] * (side * ks[:, None])
            # past the cuff seam only the basic sleeve's own corners (the
            # product beside the arm there is the torso)
            r = walk(pts, rmax if tv > t_end else rr + 4, frozen_only=tv > t_end)
            if r is not None:
                e[i] = r
        ends[side] = _median_fill(e)
    cpos = ends[1][0] if not np.isnan(ends[1][0]) else rmax   # c > 0 side (walks along +normal)
    cneg = ends[-1][0] if not np.isnan(ends[-1][0]) else rmax  # c < 0 side
    cols = np.arange(-math.floor(cneg), math.floor(cpos) + 1e-6, 1.0)
    tops = np.full(len(cols), np.nan)
    for i, cv in enumerate(cols):
        pts = S[None] + nr[None] * cv - ax_[None] * ks[:, None]
        r = walk(pts, 0.0)
        if r is not None:
            tops[i] = r
    tops = _median_fill(tops)
    yy, xx = np.mgrid[0:h, 0:w]
    dxy = np.stack([xx + .5 - S[0], yy + .5 - S[1]], -1)
    t = dxy @ ax_; c = dxy @ nr
    region = np.zeros((h, w), bool)
    first = {}
    for side, sgn in ((1, 1), (-1, -1)):
        e = ends[side]
        ok = ~np.isnan(e)
        if not ok.any():
            continue
        te = np.interp(t, rows[ok], e[ok])
        inrows = (t >= 0) & (t >= rows[ok].min()) & (t <= rows[ok].max() + 1)
        region |= inrows & (sgn * c >= 0) & (sgn * c <= te)
        first[side] = float(e[ok][0])
    okt = ~np.isnan(tops)
    if okt.any() and first:
        tt = np.interp(c, cols[okt], tops[okt], left=0, right=0)
        region |= (t < 0) & (-t <= tt) & (c <= first.get(1, 0)) & (c >= -first.get(-1, 0))
    return region & P


LINE_DEPTH = 24.0  # a drawn line: this much darker than the brightest pixel of its 5x5 neighbourhood


def ridges(lum, P):
    lmax = M._max_filter(np.clip(lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
    return (lmax - lum >= LINE_DEPTH) & P


def fill_holes(mask):
    """mask with every background component that does not reach the border
    filled (4-connected)."""
    lab_, n, _ = M.label(~mask)
    if not n:
        return mask.copy()
    edge = np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]]))
    return mask | (~np.isin(lab_, edge) & (lab_ > 0))


def enclosed(P, ridge, seeds, allowed):
    """The regions the drawing's own lines enclose that hold a seed: the
    components of the product without its lines inside `allowed`, then their
    holes (prints, buttons) and the lines around them (within 3 px). A small
    product island (<= 400 px) that touches only the region or what is not
    product (a cuff button on the opening's edge, open to the arm below) is
    a hole too."""
    free = P & ~M.dilate(ridge, 1) & allowed  # lines grown 1 px: a 1-2 px gap in an outline does not join two regions
    lab_, n, _ = M.label(free)
    ids = np.unique(lab_[seeds & free])
    ids = ids[ids > 0]
    reg = np.isin(lab_, ids)
    if not reg.any():
        return reg
    reg = fill_holes(reg) & P & allowed
    reg |= M.dilate(reg, 1) & M.dilate(ridge, 1) & P & allowed
    reg |= M.dilate(reg, 3) & ridge & allowed
    reg = fill_holes(reg) & P & allowed  # a button ringed by the cuff's lines
    lab2, comps = M.components(P & allowed & ~reg)
    for c in comps:
        if c['size'] > 400:
            continue
        comp = lab2 == c['label']
        ring = M.dilate(comp, 1) & ~comp & P & allowed
        if ring.any() and (ring & ~reg).sum() <= 2:
            reg |= comp
    return reg


def arm_frame(g, i, shape, x0, y0):
    a = next(a for a in g['arms'] if a['i'] == i)
    h, w = shape
    S = np.array(a['shoulder']) - (x0, y0)
    nr = np.array(a['normal']); ax_ = np.array(a['axis'])
    yy, xx = np.mgrid[0:h, 0:w]
    dx, dy = xx + .5 - S[0], yy + .5 - S[1]
    return a, dx * ax_[0] + dy * ax_[1], dx * nr[0] + dy * nr[1]


def profile_sleeve_lines(fz, key, P, lum, t_end, info=None):
    """Profile sleeve as drawn, in two parts, both bounded by the drawing's
    own lines:
      body  the regions its outline encloses (the cap's arch) that hold the
            resting arm's axis lines (c = -r/2, 0, r/2) from 15 % of the way
            to the cuff down to the cuff band's upper line (the first line
            above the cuff seam on the axis), within PROFILE_SLEEVE_U of the
            axis and from the cap (t >= -.6 rmax);
      cuff  the regions between that line and the seam that hold the axis
            there, no wider than the body's bottom + 4 px each side (a cuff
            band open at its end runs on into the torso behind the arm).
    None when the body runs into the artificial limits over more than 6 px
    (its outline has a gap: it leaked into the torso)."""
    x0, y0, x1, y1 = CELLS[key]
    g = fz.zones[key]
    a, t, c = arm_frame(g, 0, P.shape, x0, y0)
    h, w = P.shape
    rmax = PROFILE_SLEEVE_U / g['k']
    r = fz.data[key]['radii']['arm'][0][0]
    ridge = ridges(lum, P)
    S = np.array(a['shoulder']) - (x0, y0)
    ax_, nr = np.array(a['axis']), np.array(a['normal'])

    def at(tv, cv):
        x, y = S + ax_ * tv + nr * cv
        return int(math.floor(y)), int(math.floor(x))

    # the cuff band's upper line on the axis: up from the seam past the
    # cuff's lower outline (a gap under 3 px inside it is still the outline),
    # then over the band (>= 3 px) to the next line
    def is_line(tv):
        y, x = at(tv, 0.0)
        return 0 <= y < h and 0 <= x < w and bool(ridge[y, x])

    t_ct = None
    tv = t_end + 1
    while tv > t_end - 8 and not is_line(tv):
        tv -= 1
    stop = t_end - 40
    while tv > stop:
        while tv > stop and is_line(tv):
            tv -= 1
        s0 = tv
        while tv > stop and not is_line(tv):
            tv -= 1
        if not is_line(tv):
            break
        if s0 - tv >= 3:
            while tv > stop and is_line(tv - 1):
                tv -= 1
            t_ct = tv
            break
    if t_ct is None:
        t_ct = t_end


    seeds = np.zeros(P.shape, bool)
    for tv in np.arange(.15 * t_end, t_ct - 1, 1.0):
        for cv in (-.5 * r, 0.0, .5 * r):
            y, x = at(tv, cv)
            if 0 <= y < h and 0 <= x < w:
                seeds[y, x] = True
    allowed = (np.abs(c) <= rmax) & (t >= -.6 * rmax) & (t <= t_end + 1)
    body = enclosed(P, ridge, seeds, allowed & (t <= t_ct + 8))
    limit = allowed & ~M.erode(allowed & (t <= t_ct + 8), 1)
    if not body.any() or (body & ~ridge & limit & ~M.dilate(~P, 1) & (t < t_ct - 3)).sum() > 6:
        return None
    # the cuff's width: the run of its lower outline (lines within 12 px
    # above the seam) around the axis, gaps of up to 4 px bridged; beside
    # the cuff the torso runs on down without such a line
    occ = {}
    near = ridge & (t > max(t_end - 13, t_ct + 3)) & (t <= t_end + 1) & (np.abs(c) <= rmax)
    for cv in np.floor(c[near]).astype(int):
        occ[int(cv)] = True
    cmin = cmax = None
    if occ:
        c0 = min(occ, key=lambda v: abs(v))
        lo = hi = c0
        while any(occ.get(lo - d) for d in (1, 2, 3, 4, 5)):
            lo -= next(d for d in (1, 2, 3, 4, 5) if occ.get(lo - d))
        while any(occ.get(hi + d) for d in (1, 2, 3, 4, 5)):
            hi += next(d for d in (1, 2, 3, 4, 5) if occ.get(hi + d))
        cmin, cmax = lo - 1.0, hi + 2.0
    if cmin is None:
        cmin, cmax = -(r + 4), r + 4


    cs = np.zeros(P.shape, bool)
    for tv in np.arange(t_ct + 1, t_end - 1, 1.0):
        for cv in np.arange(cmin + 4, cmax - 4 + 1e-6, 2.0):
            y, x = at(tv, cv)
            if 0 <= y < h and 0 <= x < w:
                cs[y, x] = True
    # the body may not run on below the cuff's top line beside the cuff: there
    # the torso continues (its outline met the torso's, as on the basic tee)
    if (body & ~ridge & (t > t_ct + 2) & ((c < cmin - 3) | (c > cmax + 3))).sum() > 6:
        if info is not None:
            info.update(cuffTop=round(float(t_ct), 1), leak=True)
        return None
    cuff = enclosed(P, ridge, cs, allowed & (t > t_ct - 2) & (c >= cmin) & (c <= cmax))
    # The cuff ring's two ends hang a little lower than the seam on the arm
    # (they wrap round the arm, beside it) and reach past the lower outline's
    # run: the region the cuff's own lines enclose there, up to 8 px below the
    # seam and 6 px beyond the run, is the cuff's too; left on the torso they
    # show as stray cuff fragments once the arm swings. Kept only when the
    # enclosure does not leak (its outline closed: at most 1.6x the narrow cuff
    # and no more than 25 px past 6 px below the seam).
    wide_allowed = (np.abs(c) <= rmax) & (t > t_ct - 2) & (t <= t_end + 8) & (c >= cmin - 6) & (c <= cmax + 6)
    wide = enclosed(P, ridge, cs, wide_allowed)
    if cuff.any() and wide.sum() <= 1.6 * cuff.sum() and (wide & (t > t_end + 6)).sum() <= 25:
        if info is not None:
            info['cuffEndsPx'] = int((wide & ~cuff).sum())
        cuff = cuff | wide
    if info is not None:
        info.update(cuffTop=round(float(t_ct), 1), cuffC=[round(cmin, 1), round(cmax, 1)], bodyPx=int(body.sum()), cuffPx=int(cuff.sum()))
    return body | cuff


def sleeve_cuff_end(g, i, P, lum, m, t_end, x0, y0):
    """Front/back: the cuff band carried on to its own inner end. Below the
    armhole the sleeve rule keeps only the arm band and the basic sleeve, so
    a cuff wider than the basic one was cut and its inner end left on the
    torso; the regions the cuff's lines enclose that hold the sleeve's
    lowest 6 px (within re + 14 px of the arm axis) are the sleeve's."""
    a, t, c = arm_frame(g, i, P.shape, x0, y0)
    ridge = ridges(lum, P)
    seeds = m & ~ridge & (t > t_end - 6) & (t <= t_end + 2)
    allowed = (t <= t_end + 2) & (t > t_end - 40) & (np.abs(c) <= a['re'] + 14)  # t_end: a number or per pixel
    reg = enclosed(P, ridge, seeds, allowed)
    limit = allowed & ~M.erode(allowed, 1)
    if (reg & limit & ~M.dilate(~P, 1) & (np.abs(c) > a['re'] + 12)).sum() > 6:
        return m
    return m | reg


def peak(v, i):
    """Sub-pixel offset (-.5...5) of a ridge at index i of profile v."""
    if i <= 0 or i >= len(v) - 1:
        return 0.0
    a, b, c = float(v[i - 1]), float(v[i]), float(v[i + 1])
    den = a - 2 * b + c
    return float(np.clip(.5 * (a - c) / den, -.5, .5)) if den < -1e-6 else 0.0


def armhole_seam(ah, lum_u, lum_t, P, x0, y0, reach=8, line=30.0):
    """The armhole seam where THIS drawing sews its sleeve on (front/back).
    Row by row along the frozen seam (zones.json armholes, traced on the
    basic tee), the drawn seam line (a ridge at least `line` darker than its
    5x5 neighbourhood) nearest the frozen seam is found in the template and in
    the upload; the frozen seam is moved by how far the upload's line lies
    from the template's (a puffed or set-in sleeve moves it, the basic keeps
    its frozen seam). Shifts are median smoothed over 9 rows, rows without a
    line in both take their neighbours', and |shift| <= reach. Returns the
    seam as a dense polyline (sheet px) and the per-row shifts."""
    pts = sorted([tuple(map(float, p)) for p in ah['seam']], key=lambda p: p[1])
    ys = np.arange(int(math.ceil(pts[0][1])), int(math.floor(pts[-1][1])) + 1)
    sx = np.interp(ys, [p[1] for p in pts], [p[0] for p in pts])
    if lum_u is None or lum_t is None:
        return [(float(x), float(y)) for x, y in zip(sx, ys)], np.zeros(len(ys))

    def depth(lum):
        lmax = M._max_filter(np.clip(lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
        return lmax - lum
    du, dt = depth(lum_u), depth(lum_t)
    h, w = lum_u.shape
    shift = np.full(len(ys), np.nan)
    for j, (y, x) in enumerate(zip(ys, sx)):
        ly = int(y - y0)
        if not 0 <= ly < h:
            continue
        xs = np.arange(int(round(x - x0)) - reach, int(round(x - x0)) + reach + 1)
        ok = (xs >= 0) & (xs < w)
        xs = xs[ok]
        near = np.abs(xs + x0 + .5 - x) <= 4
        tt = dt[ly, xs]
        if not (near & (tt >= line)).any():
            continue
        xt = xs[near][int(np.argmax(np.where(tt[near] >= line, tt[near], -1)))]
        if not P[ly, xt]:
            continue  # the template's seam line is not product here (hair over it): no evidence
        cand = xs[(du[ly, xs] >= line) & P[ly, xs]]
        if not len(cand):
            continue
        xu = cand[int(np.argmin(np.abs(cand - xt)))]
        # sub-pixel: the parabola through the ridge's peak and its neighbours
        shift[j] = float(xu + peak(du[ly], xu) - xt - peak(dt[ly], xt))
    good = ~np.isnan(shift)
    if good.sum() < max(6, .4 * len(ys)):
        return [(float(x), float(y)) for x, y in zip(sx, ys)], np.zeros(len(ys))
    sm = shift.copy()
    idx = np.nonzero(good)[0]
    for j in idx:
        win = shift[max(0, j - 4):j + 5]
        sm[j] = np.median(win[~np.isnan(win)])
    sm = np.interp(np.arange(len(ys)), idx, sm[idx])
    sm = np.clip(sm, -reach, reach)
    return [(float(x + s), float(y)) for x, y, s in zip(sx, ys, sm)], sm


def seam_fade(sleeve_a, sleeve_print, seam, x0, y0):
    """cloth.sleeve_seam_fade with the seam given as a polyline (sheet px):
    alpha fades over 6 px from the sewn edge; the last 22 px above the seam's
    lower end (the cuff) and the sleeve's own print stay crisp."""
    h, w = sleeve_a.shape
    yy, xx = np.mgrid[0:h, 0:w] + np.array([y0, x0])[:, None, None] + .5
    d = np.full((h, w), 1e9)
    for (ax, ay), (bx, by) in zip(seam, seam[1:]):
        vx, vy = bx - ax, by - ay
        t = np.clip(((xx - ax) * vx + (yy - ay) * vy) / max(vx * vx + vy * vy, 1e-9), 0, 1)
        d = np.minimum(d, np.hypot(xx - ax - t * vx, yy - ay - t * vy))
    end = max(p[1] for p in seam)
    fade = np.clip(d / 6, 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    keep = np.clip((yy - (end - 22)) / 8, 0, 1)
    return sleeve_a * np.maximum(np.maximum(fade, keep), sleeve_print)


def shift_mask(m, dx, dy):
    """m moved by (dx, dy) whole pixels, zero filled."""
    dx, dy = int(round(dx)), int(round(dy))
    out = np.zeros_like(m)
    h, w = m.shape
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xs0, xs1 = max(0, dx), min(w, w + dx)
    out[ys0:ys1, xs0:xs1] = m[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


def cuff_ends(g, masks, rgb, lum, P, t_end, sinfo, x0, y0):
    """Profile: the cuff ring's ends that the sleeve's enclosure left on the
    torso (they wrap round the arm beside it and hang a little lower). Torso
    pixels in the cuff's rows (from its top line to 8 px below the seam)
    within the cuff's width + 6 px that are the cuff's paint, i.e. a print
    against the torso's own cloth (a cream cuff on a blue shirt) or a drawn
    line, joined to the sleeve, move to the sleeve: left on the torso they
    stay behind as stray arcs once the arm swings. Returns the moved count."""
    if 'sleeve0' not in masks or 'torso' not in masks:
        return 0
    sl, tor = masks['sleeve0'], masks['torso']
    a_, t, c = arm_frame(g, 0, P.shape, x0, y0)
    tct = sinfo.get('cuffTop', t_end - 14)
    cmin, cmax = sinfo.get('cuffC', [-(a_['re'] + 4), a_['re'] + 4])
    win = (t > tct - 2) & (t <= t_end + 8) & (c >= cmin - 6) & (c <= cmax + 6)
    prints, _ = garment_prints(rgb, tor.astype(np.float32), np.zeros(tor.shape, bool))
    cand = tor & win & (prints | ridges(lum, P))
    move = M.connected_to(cand | sl, sl) & cand
    if move.any():
        masks['sleeve0'] = sl | move
        masks['torso'] = tor & ~move
    return int(move.sum())


def split(fz, slot, key, P, lum, t_end=None, tlum=None, changed=None, cuff_shift=None, seams=None, info=None):
    """Parts of one figure. Where the upload is the template (unchanged
    paint) the frozen zones own it exactly (the drawn basic sleeve, which
    carries a margin of torso cloth around its own outline); where it changed
    the product's drawing decides: front/back the sleeve's side of the frozen
    armhole seam with the cuff carried to its own inner end, profile the
    regions the sleeve's own outline encloses (else the frozen sleeve moved
    with the product's outline, profile_sleeve)."""
    x0, y0, x1, y1 = CELLS[key]
    g = fz.zones[key]
    if changed is None:
        changed = np.ones(P.shape, bool)
    if slot == 'top':
        basic = fz.drawn['sleeves'][y0:y1, x0:x1, 3] > 127
        # unchanged paint: the drawn sleeve owns its soft fringe too, except
        # where the drawn shirt is solid under it
        dsl = fz.drawn['sleeves'][y0:y1, x0:x1, 3]
        frozen_sl = (dsl > 127) | ((dsl > 0) & (fz.drawn['shirt'][y0:y1, x0:x1, 3] < 128))
        # frozen ownership only inside the frozen garment: a longer or wider
        # product over the body is new paint even where the change map
        # (a window minimum, tolerant to registration) reads it unchanged
        keep = ~changed & ((dsl > 0) | (fz.drawn['shirt'][y0:y1, x0:x1, 3] > 0))
        if g['view'] != 'right':
            parts = {}
            sleeves = np.zeros(P.shape, bool)
            cx = g['center'] - x0
            xx = np.arange(P.shape[1])[None, :] + .5
            for ah in g['armholes']:
                i = 0 if ah['side'] < 0 else 1
                mine = basic & ((xx < cx) if i == 0 else (xx >= cx))
                # the frozen sleeve (with its margin over the torso) carried
                # down the arm as far as the product's cuff lies below the
                # basic cuff
                dt = (cuff_shift or {}).get(i, 0.0)
                te = t_end.get(i) if isinstance(t_end, dict) else None
                if seams and seams.get(ah['side']):
                    dense = seams[ah['side']]
                    ah = dict(ah, seam=[list(q) for q in dense[::4]] + ([list(dense[-1])] if (len(dense) - 1) % 4 else []))
                m = sleeve_side(g, ah, P.shape, x0, y0, mine, te) & P
                if te is not None and lum is not None:
                    m = sleeve_cuff_end(g, i, P, lum, m, te, x0, y0)
                side_ = (xx < cx) if i == 0 else (xx >= cx)
                m = (m & ~keep) | (frozen_sl & side_ & P & keep)
                if dt > .5 and te is not None:
                    # A cuff lower than the basic one: the frozen sleeve (with
                    # the margin of torso cloth it carries under its inner
                    # outline) is carried down the arm with it, over cloth
                    # that may read unchanged
                    arm = next(a for a in g['arms'] if a['i'] == i)
                    _, tt, _ = arm_frame(g, i, P.shape, x0, y0)
                    moved = shift_mask(mine, dt * arm['axis'][0], dt * arm['axis'][1]) & ~mine
                    m |= moved & P & (tt <= te + 2)
                parts['sleeve%d' % i] = m
                sleeves |= m
            parts['torso'] = P & ~sleeves
            return parts
        sinfo = {}
        sl = profile_sleeve_lines(fz, key, P, lum, t_end, sinfo) if lum is not None else None
        if info is not None:
            info['profileSleeve'] = sinfo
        if sl is None:
            sl = profile_sleeve(fz, key, P, lum, t_end, tlum)
        sl = (sl & ~keep) | (frozen_sl & P & keep)
        return {'torso': P & ~sl, 'sleeve0': sl}

    if slot == 'bottom':
        return {'bottom': P.copy()}
    if g['view'] == 'right':
        return {'shoe0': P.copy()}
    cx = g['center'] - x0
    xx = np.arange(P.shape[1])[None, :] + .5
    return {'shoe0': P & (xx < cx), 'shoe1': P & (xx >= cx)}


# ---------------------------------------------------------------------------
# Hidden cloth
# ---------------------------------------------------------------------------
def torso_outline(painted, armholes, center, prod, hair, x0, y0):
    """cloth.side_outline with the frozen armhole seam and lowest seam row
    (yc), and the NEW painted side contour: the torso's own outline under
    each hanging sleeve, from the armpit A up to the shoulder point S. S is
    the top of the product (with the hair holes) in the column 9 px outside
    the seam's top; where hair hides that column the frozen S stays."""
    h, w = painted.shape
    sides = []
    c = center
    for ah in armholes:
        s = ah['side']
        seam = sorted([tuple(p) for p in ah['seam']], key=lambda p: p[1])
        yc = ah['yc']
        rows, edges = [], []
        for yy in range(int(yc) + 2, int(yc) + 26):
            ly = yy - y0
            if not 0 <= ly < h:
                continue
            cs = np.nonzero(painted[ly] > .5)[0]
            cs = cs[(cs + x0 - c) * s > 0]
            if not len(cs):
                continue
            xe = int(cs.max() if s > 0 else cs.min())
            frac = painted[ly, xe + s] if 0 <= xe + s < w else 0
            edges.append(xe + x0 + .5 + s * (.5 + frac)); rows.append(yy + .5)
        fslope, ficpt = ah['line'][1], ah['line'][0]
        if len(rows) < 6:
            slope, icpt = fslope, ficpt
        else:
            slope, icpt = np.polyfit(rows, edges, 1)
            # a side contour within SNAP px of the frozen one (the basic's,
            # zones.json) is the frozen one: registration and the matte move
            # a redrawn edge by a fraction of a pixel, which would move the
            # whole rebuilt contour under the sleeve with it
            dev = np.abs((slope - fslope) * np.array(rows) + icpt - ficpt).max()
            if dev <= SNAP:
                slope, icpt = fslope, ficpt
        line = lambda yv, slope=slope, icpt=icpt: slope * yv + icpt  # noqa: E731
        A = np.array([line(yc + 1.5), yc + 1.5])
        xS = seam[0][0] + s * CLEAR
        col = int(np.clip(round(xS - x0), 0, w - 1))
        on = np.nonzero(prod[:, col] > .5)[0]
        if len(on) and not hair[:, col].any():
            r0 = int(on[0])
            S = np.array([xS, r0 + y0 + 1 - float(prod[r0, col])])
            if np.abs(S - np.array(ah['S'], float)).max() <= SNAP:
                S = np.array(ah['S'], float)
        else:
            S = np.array(ah['S'], float)
        k_ = .45 * (A[1] - S[1])
        t = np.linspace(0, 1, 64)[:, None]
        Pc = [A, A + [0, -k_], S + [s * .15 * k_, k_], S]
        curve = ((1 - t) ** 3) * Pc[0] + 3 * ((1 - t) ** 2) * t * Pc[1] + 3 * (1 - t) * t * t * Pc[2] + t ** 3 * Pc[3]
        sy = [p[1] for p in seam]; sx = [p[0] for p in seam]
        need = np.clip((seam[-1][1] - 14 - curve[:, 1]) / 8, 0, 1) * CLEAR
        limit = np.interp(curve[:, 1], sy, sx) + s * need
        curve[:, 0] = np.minimum(curve[:, 0], limit) if s < 0 else np.maximum(curve[:, 0], limit)
        for _ in range(3):
            curve[1:-1, 0] = (curve[:-2, 0] + curve[1:-1, 0] + curve[2:, 0]) / 3
        low = yc + 70
        poly = [(c, y0 + 1), (xS, y0 + 1)] + [tuple(p) for p in curve[::-1]] + [(line(low), low), (c, low)]
        sides.append(dict(s=s, A=A, S=S, yc=yc, poly=poly, line=[float(icpt), float(slope)]))
    cov = np.zeros((h, w), np.float32)
    for sd in sides:
        cov = np.maximum(cov, poly_mask((h, w), [(x - x0, y - y0) for x, y in sd['poly']]))
    return cov, sides


def profile_cover(vis, occ):
    """Profile: per row the painted back/front edges, interpolated where an
    occluder touches them; below, the hem continued under it (edge_cover)."""
    h, w = vis.shape
    rows = np.nonzero(vis.any(1))[0]
    cov = np.zeros((h, w), np.float32)
    if not len(rows):
        return cov
    near = M.dilate(occ, 2)
    ys, xl, xr, okl, okr = [], [], [], [], []
    for y in range(rows.min(), rows.max() + 1):
        cs = np.nonzero(vis[y])[0]
        if not len(cs):
            continue
        ys.append(y); xl.append(cs.min()); xr.append(cs.max() + 1)
        okl.append(not near[y, cs.min()]); okr.append(not near[y, cs.max()])
    ys = np.array(ys); xl = np.array(xl, float); xr = np.array(xr, float)
    okl = np.array(okl); okr = np.array(okr)
    if okl.sum() >= 2:
        xl = np.where(okl, xl, np.interp(ys, ys[okl], xl[okl]))
    if okr.sum() >= 2:
        xr = np.where(okr, xr, np.interp(ys, ys[okr], xr[okr]))
    xx = np.arange(w) + .5
    for y, a, b in zip(ys, xl, xr):
        cov[y] = (xx > a) & (xx < b)
    hem = edge_cover(vis.astype(np.float32), occ, bottom=True)
    return np.minimum(cov, np.maximum(hem, vis.astype(np.float32)))


def outline_core(painted, samples, ground, rgb, center, x0, y0, pct=10):
    """cloth.outline_profile with the line as dark as its painted core. The
    profile is a median over the sampled rows of the painted side contour,
    aligned on their darkest pixel; a line that is partly mixed with the page
    or the arm beside it (the slit under the arm) comes out lighter than the
    line itself, and the rebuilt contour under the sleeve then reads lighter
    than the painted one below it. The darkest entry of the profile is set
    to the `pct` percentile of the rows' own darkest pixel (relative to their
    interior cloth, as the profile)."""
    R = outline_profile(painted, samples, ground, rgb, center, x0, y0)
    w = painted.shape[1]
    rel = []
    for yy, s in samples:
        ly = yy - y0
        cs = np.nonzero(painted[ly] > .5)[0]
        cs = cs[(cs + x0 - center) * s > 0]
        if not len(cs):
            continue
        xe = int(cs.max() if s > 0 else cs.min())
        e = xe + .5 + s * (.5 + (painted[ly, xe + s] if 0 <= xe + s < w else 0))
        inside = [int(np.floor(e - s * (k + .5))) for k in range(4)]
        inside = [x for x in inside if 0 <= x < w]
        far = int(np.floor(e - s * 8.5))
        if not inside or not 0 <= far < w:
            continue
        dark = min(inside, key=lambda x: lum_of(rgb[ly, x]))
        rel.append(rgb[ly, dark] / np.maximum(rgb[ly, far], 1))
    if not rel:
        return R
    core = np.percentile(np.array(rel), pct, axis=0)
    k = int(np.argmin(R.sum(1)))
    if core.sum() < R[k].sum():
        R = R.copy()
        R[k] = core
    return R


def plain_cloth(rgb, painted, todo, prints):
    """The shading half of cloth.rebuild_cloth alone: the cloth's own plain
    colour around the hole (prints, outlines and seams left out) continued
    smoothly into it (Laplace). No exemplar weave: copied 9x9 patches of a
    softly shaded ChatGPT cloth read as a blocky mosaic, against the flat
    1-2 step shading of the art (real top:shirt:10, profile torso)."""
    out = np.zeros(rgb.shape, np.float32)
    ys, xs = np.nonzero(todo)
    if not len(ys):
        return out
    m = 64
    y0, y1 = max(0, ys.min() - m), min(rgb.shape[0], ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(rgb.shape[1], xs.max() + m + 1)
    C = rgb[y0:y1, x0:x1].astype(np.float32); P = painted[y0:y1, x0:x1]
    hole = todo[y0:y1, x0:x1]; pr = prints[y0:y1, x0:x1]
    source = (P > .95) & ~hole
    if not (source & ~pr).any():
        source_pl = source
    else:
        source_pl = source & ~pr
    L1 = local_mean(C, source_pl.astype(np.float32))
    hue, chroma = hue_chroma(C)
    ch, cc = hue_chroma(np.median(C[source_pl], axis=0).astype(np.float32)) if source_pl.any() else (0.0, 0.0)
    own = (np.abs((hue - ch + 180) % 360 - 180) < 35) & (chroma > .25 * cc)
    plain = source_pl & own & (np.abs(C - L1).sum(-1) < 40)
    if not plain.any():
        plain = source_pl
    L = local_mean(C, plain.astype(np.float32))
    L = harmonic(L, hole, source & ~hole)
    out[y0:y1, x0:x1] = L
    return out


def rebuild(rgb, painted, target, todo, plain_only, outline=None, center=None, x0=0, y0=0, info=None):
    """Rebuilt colours of `todo` and, with outline = [(sheet row, side)], the
    painted side contour drawn along the new edge. The shading is the
    cloth's plain colour continued smoothly into the hole (plain_cloth; with
    F['weave'] the exemplar weave of cloth.rebuild_cloth is added). A side
    contour that cannot be profiled (no painted row) leaves the rebuilt edge
    without its outline; that is recorded in info['outlineError']."""
    if not todo.any():
        return rgb
    prints, ground = garment_prints(rgb, painted, todo)
    if F.get('weave'):
        L, Dt = rebuild_cloth(rgb, painted, target, todo, prints, plain_only=plain_only)
    else:
        L = plain_cloth(rgb, painted, todo, prints)
        Dt = np.zeros_like(L)
    out = np.where(todo[..., None], np.clip(L + Dt, 0, 255), rgb)
    if outline:
        try:
            R = outline_core(painted, outline, ground, rgb, center, x0, y0, F.get('outlinePct', 50))
            out = draw_outline(out, L, Dt, todo, R, inner_distance(target > .5, 8.0))
        except (ValueError, IndexError) as e:
            if info is not None:
                info['outlineError'] = '%s: %s' % (type(e).__name__, e)
    return out


def hem_line(rgb, painted, target, todo, prints, depth=4, inner=8, reach=14):
    """The hem's painted bottom line continued under an occluder (profile: the
    hand over the hem). The rebuilt cloth is plain shading, so the columns
    whose lowest pixel was rebuilt lost the dark hem line. Per row above the
    bottom (0..depth-1) the painted columns within `reach` px give the ratio
    of that row to the cloth `inner` rows up (median); the rebuilt columns
    take the same ratio of their own rebuilt cloth."""
    h, w = target.shape
    cols = np.nonzero(target.any(0))[0]
    if not len(cols):
        return rgb
    bottom = np.full(w, -1)
    for c in cols:
        bottom[c] = np.nonzero(target[:, c])[0].max()
    redo = [c for c in cols if todo[bottom[c], c]]
    if not redo:
        return rgb
    out = rgb.astype(np.float32).copy()
    lo, hi = min(redo), max(redo)
    ref = [c for c in cols if (lo - reach <= c <= hi + reach) and c not in redo and painted[bottom[c], c]
           and bottom[c] >= inner and not prints[bottom[c] - depth:bottom[c] + 1, c].any()]
    if not ref:
        return rgb
    for k in range(depth):
        ratios = [rgb[bottom[c] - k, c].astype(np.float32) / np.maximum(rgb[bottom[c] - inner, c].astype(np.float32), 1)
                  for c in ref]
        r = np.median(np.array(ratios), axis=0)
        for c in redo:
            y = bottom[c] - k
            if y - inner + k < 0 or not todo[y, c]:
                continue
            out[y, c] = np.clip(out[bottom[c] - inner, c] * r, 0, 255)
    return out.astype(rgb.dtype)


def hidden_top(ctx, key, g, O, label, parts, hidden, info):
    fz = ctx.fz
    x0, y0, x1, y1 = CELLS[key]
    torso = parts['torso']
    vis = torso['a'] > .5
    sleeves = np.zeros(vis.shape, bool)
    for n, p in parts.items():
        if n.startswith('sleeve'):
            sleeves |= p['a'] > .05
    hole = label == 3
    arm = (label == 2) & (O == 3)
    A = ctx.A[y0:y1, x0:x1]
    if g['view'] != 'right':
        prod = np.maximum(torso['a'], sum(p['a'] for n, p in parts.items() if n.startswith('sleeve'))) + hole
        cov, sides = torso_outline(torso['a'], g['armholes'], g['center'], prod, hole, x0, y0)
        basic = fz.drawn['shirt'][y0:y1, x0:x1, 3] > 127
        others = sleeves | arm | (hole & basic)
        holes_ = (cov > 0) & (torso['a'] < .9) & others
        target = np.where(holes_, np.minimum(cov, np.maximum(A, hole.astype(np.float32))), torso['a'])
        todo = holes_ & (target > 0)
        samples = [(yy, sd['s']) for sd in sides for yy in range(int(sd['yc']) + 3, int(sd['yc']) + 26)]
        torso['rgb'] = rebuild(torso['rgb'], torso['a'], target, todo, True, samples, g['center'], x0, y0, info)
        info['sides'] = [dict(s=sd['s'], A=[round(float(v), 2) for v in sd['A']], S=[round(float(v), 2) for v in sd['S']],
                              line=sd['line']) for sd in sides]
    else:
        basic = fz.drawn['shirt'][y0:y1, x0:x1, 3] > 127
        # occluders: the sleeve, the arm and hand (also where the upload
        # drew them past the frozen arm, or the cuff left the arm's skin
        # showing) and the hair; else a hand over the hem left a notch
        from segment import HEAD
        occ = sleeves | arm | (hole & basic) | (np.isin(label, (2, 4, 5)) & np.isin(O, (0, 1, 2, 3)) & (O != HEAD))
        cov = profile_cover(vis, occ)
        todo = (cov > .5) & ~vis & occ
        # The outline and cast shadow the arm and sleeve paint on the cloth
        # around them would streak the torso once the arm swings away (body
        # build 'ring'): cloth darker or redder than its own local ground
        # within 4 px of them, away from the figure's contour and prints, is
        # rebuilt too.
        rgb_ = torso['rgb']
        prints, ground = garment_prints(rgb_, torso['a'], np.zeros(vis.shape, bool))
        wide = local_mean(rgb_, (vis & ~prints).astype(np.float32), (12, 24, 48))
        darker = lum_of(rgb_) < lum_of(wide) - 8
        redder = (rgb_[..., 0] - rgb_[..., 1]) > (wide[..., 0] - wide[..., 1]) + 12
        # the light rim the upload paints beside the sleeve and arm outline
        # (a pale halo once the arm swings away, real top:shirt:10 profile)
        lighter = lum_of(rgb_) > lum_of(wide) + 8
        owner = M.dilate(arm, 5) | M.dilate(sleeves, 4)
        contour = M.dilate(label == 0, 3)
        ring = vis & owner & ~M.dilate(prints, 2) & ~contour & (darker | redder | lighter) & ~(hole & basic)
        # the arm's and hand's own anti-aliased skin edge left on the cloth:
        # nearer this figure's arm skin than the cloth around it, also where
        # the print detector took the thin skin line for a print (a vertical
        # skin streak where the hand met the hem)
        # (shaded too: the pixel is taken along the cloth -> skin axis; skin is
        # never the figure's dark contour line, so the contour band is not
        # excluded here). A cloth as light and warm as the skin (cream) has no
        # such axis: there the darker or redder rule holds without the print
        # exclusion; the hand's own outline mixed into the cloth beside it is
        # darker and goes too (the hem line is redrawn by hem_line). Only
        # within 3 px of the arm.
        if arm.any():
            skin = np.median(rgb_[arm], axis=0).astype(np.float32)
            axis = skin - wide
            n2 = (axis ** 2).sum(-1)
            near = vis & M.dilate(arm, 3)
            sep = n2 > 60.0 ** 2
            tt = ((rgb_ - wide) * axis).sum(-1) / np.maximum(n2, 1)
            ring |= near & ((sep & (tt > .22)) | darker | redder)
        # the arm and sleeve hole's own 2 px border (not the hair's: the collar): the cloth there mixes the occluder's
        # anti-aliased edge into its shading and reads as a pale or dark
        # copy of the arm's silhouette next to the smooth rebuilt cloth
        ring |= vis & M.dilate(todo & M.dilate(arm | sleeves, 2), 2) & ~contour & ~(hole & basic)
        todo |= ring
        info['ringPx'] = int(ring.sum())
        if DEBUG is not None:
            DEBUG[key] = dict(wide=wide, rgbt=rgb_, vis=vis, occ=occ, cov=cov, ring=ring, todo=todo.copy(), arm=arm, sleeves=sleeves, label=label, O=O)
        target = np.where(todo, np.maximum(cov, ring.astype(np.float32)), torso['a'])
        torso['rgb'] = rebuild(torso['rgb'], np.where(ring, 0, torso['a']), target, todo, True)
        torso['rgb'] = hem_line(torso['rgb'], vis & ~ring, target > .5, todo, prints)
    torso['a'] = np.where(todo, np.maximum(torso['a'], target), torso['a']).astype(np.float32)
    hidden['torso'] |= todo
    # hair over the sleeve caps: plain cloth inside the frozen basic sleeve
    if hole.any() and g['view'] != 'right':
        basic = fz.drawn['sleeves'][y0:y1, x0:x1, 3] > 127
        for ah in g['armholes']:
            name = 'sleeve%d' % (0 if ah['side'] < 0 else 1)
            p = parts.get(name)
            if p is None or not (p['a'] > .5).any():
                continue
            todo = hole & basic & sleeve_side(g, ah, hole.shape, x0, y0) & ~(p['a'] > .5)
            if not todo.any():
                continue
            target = np.where(todo, 1.0, p['a'])
            p['rgb'] = rebuild(p['rgb'], p['a'], target, todo, True)
            p['a'] = np.where(todo, 1.0, p['a']).astype(np.float32)
            hidden[name] |= todo


def hidden_bottom(ctx, key, g, O, label, parts, hidden):
    fz = ctx.fz
    x0, y0, x1, y1 = CELLS[key]
    p = parts['bottom']
    vis = p['a'] > .5
    h, w = vis.shape
    hip = float(np.mean([j[1] for j in fz.data[key]['joints']['hip']])) - y0
    yy = np.arange(h)[:, None]
    cover = fz.cover_bottom[y0:y1, x0:x1] & (yy < hip)
    occ = (label == 2) & np.isin(O, (1, 2, 3))
    target = np.maximum(vis.astype(np.float32), cover.astype(np.float32))
    hand = profile_cover(vis, occ & (O == 3))
    target = np.maximum(target, np.where(occ & (O == 3), hand, 0))
    todo = (target > .5) & ~vis
    p['rgb'] = rebuild(p['rgb'], p['a'], target, todo, False)
    p['a'] = np.where(todo, 1.0, p['a']).astype(np.float32)
    hidden['bottom'] |= todo


# ---------------------------------------------------------------------------
# Post rules
# ---------------------------------------------------------------------------
def drop_detached(a, near=3, keep=400):
    """Pieces of a part that lie apart from its main piece (more than `near`
    px away) and are smaller than `keep` px: a limb's outline drawn a few px
    outside the frozen limb, cut off by the limb from the torso, read as a
    stray stroke beside the cloth once the arm moves. Their soft fringe goes
    with them."""
    m = a > .5
    lab_, comps = M.components(m)
    if len(comps) <= 1:
        return a, 0
    big = max(comps, key=lambda c: c['size'])
    grown = M.dilate(lab_ == big['label'], near)
    drop = np.zeros(m.shape, bool)
    for c in comps:
        if c is big or c['size'] >= keep:
            continue
        comp = lab_ == c['label']
        if not (comp & grown).any():
            drop |= comp
    if not drop.any():
        return a, 0
    kept = m & ~drop
    gone = drop | (M.dilate(drop, 2) & ~M.dilate(kept, 2) & (a > 0))
    return np.where(gone, 0, a).astype(np.float32), int(drop.sum())


def close_nicks(p, maximum=30):
    """Small see-through nicks inside a part (a component of alpha <= .5,
    <= `maximum` px, enclosed by the part) are closed with the mean colour of
    the opaque pixels around them: a stray arm-outline pixel left in a
    rebuilt torso showed as a hole once the arm swung away."""
    m = p['a'] > .5
    holes = fill_holes(m) & ~m
    if not holes.any():
        return 0
    lab_, comps = M.components(holes)
    small = [c['label'] for c in comps if c['size'] <= maximum]
    if not small:
        return 0
    todo = np.isin(lab_, small)
    w = (m & M.dilate(todo, 3)).astype(np.float32)
    mean = local_mean(p['rgb'], w, (2, 4, 8))
    p['rgb'] = np.where(todo[..., None], mean, p['rgb']).astype(np.float32)
    p['a'] = np.where(todo, 1.0, p['a']).astype(np.float32)
    return int(todo.sum())


def drop_specks(a, minimum):
    m = a > 25 / 255
    lab_, comps = M.components(m)
    small = [c['label'] for c in comps if c['size'] < minimum]
    if small:
        a = np.where(np.isin(lab_, small), 0, a).astype(np.float32)
    a[a <= 25 / 255] = 0
    return a


# ---------------------------------------------------------------------------
# One figure
# ---------------------------------------------------------------------------
def build_figure(ctx, key, seg):
    fz = ctx.fz
    slot = ctx.slot
    x0, y0, x1, y1 = CELLS[key]
    g = fz.zones[key]
    O = fz.O[y0:y1, x0:x1]
    label = seg['label'].copy()
    ink = ctx.ink[y0:y1, x0:x1]
    info = {'stripPx': strip_skin(ctx, key, seg, label)}
    info['pinholePx'] = close_pinholes(label, O == 0)
    P = label == 1
    a, rgb = alpha_colour(ctx, key, label, O)
    t_end = None
    if slot == 'top':
        ends = {int(r['name'][-1]): float(r['v'].max()) for r in seg['seams'] if r['kind'] == 'cuff'}
        if g['view'] == 'right':
            t_end = ends.get(0, g['arms'][0]['tCap']) + 1
        else:
            # per pixel: the cuff seam's t at the pixel's place across the arm,
            # continued past the band's ends along its slope (a slanted cuff's
            # inner corner hangs lower than the arm's columns reach)
            from segment import outer_end, seam_at
            t_end = {}
            for b_, r in zip(seg['bands'], seg['seams']):
                ok = ~np.isnan(r['v'])
                if r['kind'] != 'cuff' or ok.sum() < 2:
                    continue
                i = int(r['name'][-1])
                _, tt, cc = arm_frame(g, i, label.shape, x0, y0)
                t_end[i] = seam_at(r['cols'][ok], r['v'][ok], cc, open_end=outer_end(b_))
                t_end[i] = np.minimum(t_end[i], g['arms'][[a['i'] for a in g['arms']].index(i)]['tCap'] + 12)
    # changed: by the window-minimum map (registration-tolerant) or pixel by
    # pixel beyond twice its threshold (a cuff drawn 4 px further over the
    # torso side reads unchanged in the window minimum)
    de = R.de(ctx.Ut[y0:y1, x0:x1], ctx.Tlab[y0:y1, x0:x1], .7)
    changed = (ctx.D[y0:y1, x0:x1] > ctx.tau) | (de > 2 * ctx.tau)
    shift = {}
    for r in seg['seams']:
        ok = ~np.isnan(r['v']) & ~np.isnan(r['b0'])
        if r['kind'] == 'cuff' and ok.sum() >= 3:
            shift[int(r['name'][-1])] = float(np.median(r['v'][ok] - r['b0'][ok]))
    info['cuffShift'] = {k: round(v, 2) for k, v in shift.items()}
    seams = {}
    if slot == 'top' and g['view'] != 'right':
        for ah in g['armholes']:
            dense, sm = armhole_seam(ah, ctx.lum[y0:y1, x0:x1], ctx.tlum[y0:y1, x0:x1], P | (a > 0), x0, y0)
            seams[ah['side']] = dense
            info.setdefault('armholeShift', {})[str(ah['side'])] = round(float(np.abs(sm).max()) if len(sm) else 0.0, 2)
    masks = split(fz, slot, key, P | (a > 0), ctx.lum[y0:y1, x0:x1], t_end, ctx.tlum[y0:y1, x0:x1], changed, shift, seams, info)
    if slot == 'top' and g['view'] == 'right':
        info['cuffEndsMovedPx'] = cuff_ends(g, masks, rgb, ctx.lum[y0:y1, x0:x1], P | (a > 0), t_end, info.get('profileSleeve', {}), x0, y0)
    parts, hidden = {}, {}
    for name, m in masks.items():
        parts[name] = dict(rgb=rgb.copy(), a=np.where(m, a, 0).astype(np.float32))
        hidden[name] = np.zeros(m.shape, bool)
    if slot == 'top':
        hidden_top(ctx, key, g, O, label, parts, hidden, info)
    elif slot == 'bottom':
        hidden_bottom(ctx, key, g, O, label, parts, hidden)
    if slot == 'top' and g['view'] != 'right':
        # A print on a sleeve (the girl's shoulder flower) stays opaque: it is
        # the sleeve's own. Prints are judged on both sleeves together (their
        # cloth median), as the body build did.
        both = sum(p['a'] for n, p in parts.items() if n.startswith('sleeve'))
        if np.any(both > 0):
            pr, _ = garment_prints(rgb, np.clip(both, 0, 1), np.zeros(both.shape, bool))
            for ah in g['armholes']:
                name = 'sleeve%d' % (0 if ah['side'] < 0 else 1)
                p = parts.get(name)
                if p is None or not (p['a'] > 0).any():
                    continue
                seam = seams.get(ah['side']) or [tuple(q) for q in ah['seam']]
                p['a'] = seam_fade(p['a'], pr.astype(np.float32), seam, x0, y0).astype(np.float32)
    for name, p in parts.items():
        p['a'] = drop_specks(p['a'], F['speck'])
        p['a'], n = drop_detached(p['a'])
        info['detachedPx'] = info.get('detachedPx', 0) + n
        info['nickPx'] = info.get('nickPx', 0) + close_nicks(p)
    total = sum(int(h_.sum()) for h_ in hidden.values())
    vis = int(P.sum())
    info['hiddenPx'] = total
    info['hiddenPct'] = round(100.0 * total / max(1, vis + total), 2)
    return dict(parts=parts, hidden=hidden, label=label, info=info)


def build(ctx, segs):
    return {k: build_figure(ctx, k, s) for k, s in segs.items()}
