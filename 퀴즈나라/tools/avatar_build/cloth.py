"""Cloth helpers: prints, hidden-cloth rebuild, painted outlines, the sleeve
seam fade and pin-hole closing.

Moved out of tools/build-reference-body.py (stage 3, WP1). The closures that
lived inside build() (garment_prints, edge_cover, side_outline,
outline_profile, draw_outline) are explicit-argument functions here; the body
rebuild stays byte-identical (tools/garment/verify-body-freeze.py --rebuild).
All arrays are one figure cell (h x w) of the reference sheet; (x0, y0) is
the cell's sheet origin.

Cloth under a hanging arm or sleeve (2026-10-08, stage 2 round 2).

The sheet only shows the shirt/shorts around the arm; a swinging arm shows
what was under it. The old refill diffused one global median colour into
the hole (flat patches, concentric blobs) and kept the arm's outline and
cast shadow on the cloth (dark streaks). The hole is now rebuilt from the
cloth around it, split in two scales:
  shading  the cloth's local plain colour, continued smoothly into the hole
           (Laplace equation, boundary = the colour just outside);
  detail   weave, seams, hem stitching and hem edge, copied patch by patch
           from clean cloth nearby (exemplar inpainting, Criminisi et al.
           2004), never from prints: a flower or the acorn is not smeared
           into the hole, plain ground continues instead.
Patch matching also compares coverage and distance to the garment edge, so
a hem edge continues as a hem edge and the interior stays interior.
"""
import numpy as np
from PIL import Image, ImageFilter

from .common import (box_blur, dilate, harmonic, hue_chroma, inner_distance, local_mean, lum_of,
                     poly_mask)


def print_mask(rgb, ground, cloth):
    """Prints and trims on a cloth (flowers, the acorn, cream collar/cuffs):
    a clearly coloured hue unlike the cloth's own (`cloth`, the garment's
    median colour, so a large collar is not taken for ground), much brighter
    than the local `ground`, or a pale tint on a strongly coloured cloth.
    Shading (painted shadows are more saturated), lines and the hem
    stitching are not prints."""
    hue, chroma = hue_chroma(rgb)
    ch, cc = hue_chroma(np.asarray(cloth, np.float32))
    turn = np.abs((hue - ch + 180) % 360 - 180)
    lift = lum_of(rgb) - lum_of(ground)
    return ((chroma > 45) & (turn > 40)) | (lift > 70) | ((lift > 30) & (chroma < .5 * cc))


def exemplar(D, A, E, valid, known, todo, patch=4, window=46, w_pos=.03):
    """Fill the detail image D at `todo` pixels with whole patches copied
    from centres whose patch lies entirely in `valid` (Criminisi et al.).
    A (coverage) and E (distance to the garment edge) are known everywhere
    and must match too. `known` pixels take part in the matching."""
    from numpy.lib.stride_tricks import sliding_window_view as windows
    h, w = todo.shape
    k = 2 * patch + 1
    D = D.copy(); todo = todo.copy(); filled = known & ~todo
    conf = filled.astype(np.float32)
    vsum =np.asarray(Image.fromarray(valid.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(k))) > 127
    vsum[:patch, :] = vsum[-patch:, :] = False; vsum[:, :patch] = vsum[:, -patch:] = False
    cy, cx = np.nonzero(vsum)
    if not len(cy):
        return D
    pad = lambda a: np.pad(a, [(patch, patch), (patch, patch)] + [(0, 0)] * (a.ndim - 2))
    Ap, Ep = pad(A.astype(np.float32)), pad(E.astype(np.float32))
    srcA = windows(Ap, (k, k))[cy, cx]; srcE = windows(Ep, (k, k))[cy, cx]
    srcD = windows(pad(D.astype(np.float32)), (k, k), axis=(0, 1))[cy, cx]  # (n,3,k,k)
    srcIn = srcA > .5
    while todo.any():
        Dp, Fp = pad(D), pad(filled)
        gray = lum_of(D)
        # Front: to-do pixels touching anything already settled.
        front = todo & dilate(~todo, 1)
        fy, fx = np.nonzero(front)
        if not len(fy):
            break
        # Confidence of each front patch.
        cbar = box_blur(conf, patch)[fy, fx]
        # Data term: isophote strength across the front (structure first).
        gp = np.pad(np.where(filled, gray, np.nan), 1)
        gx = (gp[1:-1, 2:] - gp[1:-1, :-2]) / 2; gy = (gp[2:, 1:-1] - gp[:-2, 1:-1]) / 2
        gx = np.nan_to_num(gx)[fy, fx]; gy = np.nan_to_num(gy)[fy, fx]
        m = box_blur(filled.astype(np.float32), 1)
        mp = np.pad(m, 1, mode='edge')
        nx = ((mp[1:-1, 2:] - mp[1:-1, :-2]) / 2)[fy, fx]; ny = ((mp[2:, 1:-1] - mp[:-2, 1:-1]) / 2)[fy, fx]
        nl = np.hypot(nx, ny) + 1e-6
        data = np.abs(-gy * nx / nl + gx * ny / nl) / 64 + .02
        pick = int(np.argmax(cbar * data - 1e-9 * (fy * w + fx)))
        py, px = int(fy[pick]), int(fx[pick])
        tD = Dp[py:py + k, px:px + k]; tA = Ap[py:py + k, px:px + k]; tE = Ep[py:py + k, px:px + k]
        tK = Fp[py:py + k, px:px + k]
        near = (np.abs(cy - py) <= window) & (np.abs(cx - px) <= window)
        idx = np.nonzero(near)[0]
        if not len(idx):
            idx = np.arange(len(cy))
        sD, sA, sE = srcD[idx], srcA[idx], srcE[idx]
        nk = max(1, tK.sum())
        cost = (((sD - tD.transpose(2, 0, 1)[None]) ** 2).sum(1) * tK).sum((1, 2)) / nk
        cost += ((sA - tA) ** 2).sum((1, 2)) * (255 ** 2) / (k * k)
        both = srcIn[idx] & (tA > .5)
        cost += (((sE - tE) * 24) ** 2 * both).sum((1, 2)) / np.maximum(1, both.sum((1, 2)))
        cost += w_pos * ((cy[idx] - py) ** 2 + (cx[idx] - px) ** 2)
        best = idx[int(np.argmin(cost))]
        put = todo[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1]
        oy, ox = max(0, py - patch) - (py - patch), max(0, px - patch) - (px - patch)
        patchD = srcD[best].transpose(1, 2, 0)[oy:oy + put.shape[0], ox:ox + put.shape[1]]
        region = D[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1]
        region[put] = patchD[put]
        conf[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1][put] = cbar[pick]
        filled[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1][put] = True
        put[:] = False
    return D


def rebuild_cloth(rgb, painted, target, todo, prints, plain_only=False):
    """Shading and detail for the `todo` pixels of one garment (their sum is
    the colour). `painted` is the sheet coverage of the garment, `target`
    the final coverage (equal to it outside the hole). `plain_only` keeps
    only the weave in the copied detail (a torso side under the sleeve has
    no seam or hem to continue; a stray line fragment there read as a mark)."""
    Lf = np.zeros(rgb.shape, np.float32); Df = np.zeros(rgb.shape, np.float32)
    ys, xs = np.nonzero(todo)
    if not len(ys):
        return Lf, Df
    m = 64
    y0, y1 = max(0, ys.min() - m), min(rgb.shape[0], ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(rgb.shape[1], xs.max() + m + 1)
    C = rgb[y0:y1, x0:x1].astype(np.float32); P = painted[y0:y1, x0:x1]; T = target[y0:y1, x0:x1]
    hole = todo[y0:y1, x0:x1]; pr = prints[y0:y1, x0:x1]
    source = (P > .95) & ~hole
    # Plain ground: the cloth without prints, outlines or seams.
    L1 = local_mean(C, (source & ~pr).astype(np.float32))
    hue, chroma = hue_chroma(C)
    ch, cc = hue_chroma(np.median(C[source & ~pr], axis=0).astype(np.float32))
    own = (np.abs((hue - ch + 180) % 360 - 180) < 35) & (chroma > .25 * cc)
    plain = source & ~pr & own & (np.abs(C - L1).sum(-1) < 40)
    L = local_mean(C, plain.astype(np.float32))
    L = harmonic(L, hole, source & ~hole)
    Dt = np.where(source[..., None], C - L, 0)
    near_hole = dilate(hole, 1)
    valid = ((source & ~dilate(pr, 2)) | ((P < .02) & (T < .02))) & ~near_hole
    E = inner_distance(T > .5, 12.0)
    Dt = exemplar(Dt, T, E, valid, source & ~pr, hole & (T > 0))
    if plain_only:
        weave = 3 * np.median(np.abs(Dt[plain])) + 1
        Dt = np.where(hole[..., None], np.clip(Dt, -weave, weave), Dt)
    Lf[y0:y1, x0:x1] = L; Df[y0:y1, x0:x1] = Dt
    return Lf, Df


def garment_prints(rgb, painted, hole):
    """Prints/trims of one garment (see print_mask) from its own local
    ground colour, grown 1 px over their soft edges. `rgb` is the cell."""
    src = (painted > .95) & ~hole
    cloth = np.median(rgb[src], axis=0)
    # Ground from pixels of the cloth's own hue only: a large cream
    # collar must not lift the ground it is judged against.
    hue, chroma = hue_chroma(rgb)
    ch, cc = hue_chroma(cloth.astype(np.float32))
    own = src & (np.abs((hue - ch + 180) % 360 - 180) < 30) & (chroma > .35 * cc)
    g1 = local_mean(rgb, own.astype(np.float32), (12, 24, 48))
    pr = print_mask(rgb, g1, cloth) & (painted > .5)
    return dilate(pr, 1) & (painted > .2), g1


def edge_cover(painted, hole, bottom):
    """Side views: coverage below the garment's bottom edge (or above
    its top edge) in the columns where the arm hid it, interpolated
    from the painted edge either side (the hem and waist keep their
    curve instead of the straight bottom of a traced zone)."""
    h, w = painted.shape
    known_x, known_e = [], []
    for x in range(w):
        rows = np.nonzero(painted[:, x] > .5)[0]
        if not len(rows):
            continue
        r = int(rows.max() if bottom else rows.min())
        lo, hi = max(0, r - 6), min(h, r + 7)
        if hole[lo:hi, x].any():
            continue
        band = painted[lo:hi, x].sum()
        known_x.append(x); known_e.append(lo + band if bottom else hi - band)
    e = np.interp(np.arange(w), known_x, known_e)[None, :]
    yy = np.arange(h)[:, None].astype(np.float32)
    return np.clip(e - yy, 0, 1) if bottom else np.clip(yy + 1 - e, 0, 1)


def sleeve_seam(poly, center):
    """The traced seam of a front/back sleeve zone: its three points nearest
    the body centre, in drawing order."""
    return poly[:3] if abs(poly[0][0] - center) < abs(poly[-1][0] - center) else poly[-3:]


def side_outline(painted, sleeves, center, cut, alpha, x0, y0):
    """Front/back: the torso's own outline under each hanging sleeve.

    On the sheet the sleeve hides the torso side above the armpit, so
    a swinging or raised arm showed a straight traced edge with a notch
    where the painted side began, and pale scraps of the cuff. The new
    outline continues the painted side contour from the armpit, curves
    out under the sleeve and meets the sheet's shoulder outline at the
    shoulder point. Where the sleeve's sewn edge is feathered into the
    shirt (the seam fade below), it keeps CLEAR px outside the seam, so
    no torso outline shows through at rest.

    `sleeves`: the traced sleeve zones (sheet px); `cut`: the head cut
    row per cell column (1 x w); `alpha`: the cell's coverage. Returns the
    coverage and, per sleeve, s (side), A (armpit), S (shoulder point),
    line (side contour fit), yc (lowest seam row) and the polygon."""
    h, w = painted.shape
    CLEAR = 9.0
    c = center
    sides = []
    for sp in sleeves:
        s = -1 if np.mean([p[0] for p in sp]) < c else 1
        seam = sp[:3] if abs(sp[0][0] - c) < abs(sp[-1][0] - c) else sp[-3:]
        seam = sorted(seam, key=lambda p: p[1])
        yc = max(p[1] for p in sp if abs(p[0] - seam[-1][0]) < 10)
        rows, edges = [], []
        for yy in range(int(yc) + 2, int(yc) + 26):
            ly = yy - y0
            cs = np.nonzero(painted[ly] > .5)[0]
            cs = cs[(cs + x0 - c) * s > 0]
            if not len(cs):
                continue
            xe = int(cs.max() if s > 0 else cs.min())
            frac = painted[ly, xe + s] if 0 <= xe + s < w else 0
            edges.append(xe + x0 + .5 + s * (.5 + frac)); rows.append(yy + .5)
        slope, icpt = np.polyfit(rows, edges, 1)
        line = lambda yv, slope=slope, icpt=icpt: slope * yv + icpt
        A = np.array([line(yc + 1.5), yc + 1.5])
        xS = seam[0][0] + s * CLEAR
        col = alpha[:, int(round(xS - x0))]
        r0 = int(np.nonzero((col > .5) & (np.arange(h) + y0 > cut[0, int(round(xS - x0))]))[0][0])
        S = np.array([xS, r0 + y0 + 1 - col[r0]])
        k_ = .45 * (A[1] - S[1])
        t = np.linspace(0, 1, 64)[:, None]
        P = [A, A + [0, -k_], S + [s * .15 * k_, k_], S]
        curve = ((1 - t) ** 3) * P[0] + 3 * ((1 - t) ** 2) * t * P[1] + 3 * (1 - t) * t * t * P[2] + t ** 3 * P[3]
        # Keep clear of the feathered seam (the fade is off within 14 px
        # of the cuff end, see the sleeve fade below).
        sy = [p[1] for p in seam]; sx = [p[0] for p in seam]
        need = np.clip((seam[-1][1] - 14 - curve[:, 1]) / 8, 0, 1) * CLEAR
        limit = np.interp(curve[:, 1], sy, sx) + s * need
        curve[:, 0] = np.minimum(curve[:, 0], limit) if s < 0 else np.maximum(curve[:, 0], limit)
        for _ in range(3):  # soften any corner the limit made
            curve[1:-1, 0] = (curve[:-2, 0] + curve[1:-1, 0] + curve[2:, 0]) / 3
        low = yc + 70
        poly = [(c, y0 + 1), (xS, y0 + 1)] + [tuple(p) for p in curve[::-1]] + [(line(low), low), (c, low)]
        sides.append(dict(s=s, A=A, S=S, line=line, yc=yc, poly=poly, seam=seam))
    cov = np.zeros((h, w), np.float32)
    for sd in sides:
        cov = np.maximum(cov, poly_mask((h, w), [(x - x0, y - y0) for x, y in sd['poly']]))
    return cov, sides


def outline_profile(painted, samples, ground, rgb, center, x0, y0):
    """A painted side contour, as colour relative to the local cloth by
    distance from the edge (px). `samples`: (sheet row, side) pairs,
    side -1 for a contour facing -x."""
    w = painted.shape[1]
    # Rows are aligned on their darkest line pixel before taking the
    # median, so the line keeps the painted darkness instead of
    # being smeared by its sub-pixel wobble.
    rows = []
    for yy, s in samples:
        ly = yy - y0
        cs = np.nonzero(painted[ly] > .5)[0]
        cs = cs[(cs + x0 - center) * s > 0]
        if not len(cs):
            continue
        xe = int(cs.max() if s > 0 else cs.min())
        e = xe + .5 + s * (.5 + (painted[ly, xe + s] if 0 <= xe + s < w else 0))
        inside = [int(np.floor(e - s * (k + .5))) for k in range(4)]
        dark = min(inside, key=lambda x: lum_of(rgb[ly, x]))
        rows.append((ly, s, e, abs(dark + .5 - e)))
    line_at = float(np.median([r[3] for r in rows]))
    prof = []
    for ly, s, e, at in rows:
        ref = ground[ly, int(round(e - s * 10))]
        xs_ = e - s * (np.arange(9) + .5 + (at - line_at))
        vals = np.stack([np.interp(xs_ - .5, np.arange(w), rgb[ly, :, ch]) for ch in range(3)], -1)
        prof.append(vals / np.maximum(ref, 1))
    R = np.median(np.array(prof), 0)
    R = R / R[-1]
    # The outermost sample is the sheet's white-mixed fringe (coverage
    # gives the new edge its own soft rim), and past the line the
    # painted rim light and form shadow are kept only as a smooth
    # falloff: a crisp copy read as a second outline along the curve.
    R[0] = R[1]
    for _ in range(2):
        tail = np.pad(R[3:], ((1, 1), (0, 0)), mode='edge')
        R[3:] = (tail[:-2] + tail[1:-1] + tail[2:]) / 3
    return R


def draw_outline(out, L, Dt, todo, R, dist):
    """Paint profile R (from outline_profile) on the rebuilt pixels
    within 8 px of a new garment edge (`dist`: px from that edge)."""
    near = todo & (dist < 8)
    di = np.clip(dist, 0, 8)
    ratio = np.stack([np.interp(di, np.arange(9) + .5, R[:, ch]) for ch in range(3)], -1)
    wgt = np.clip((di - 3) / 4, 0, 1)[..., None]
    edge_col = np.clip(L * ratio + Dt * wgt * wgt, 0, 255)
    return np.where(near[..., None], edge_col, out)


def sleeve_seam_fade(sleeve_a, sleeve_print, sleeves, center, x0, y0):
    """The sewn edge of a front/back sleeve fades into the shirt over 6 px,
    so a swinging sleeve never shows a cut line across the torso fabric; the
    cuff end (22 px) and the sleeve's own print stay crisp."""
    h, w = sleeve_a.shape
    yy, xx = np.mgrid[0:h, 0:w] + np.array([y0, x0])[:, None, None] + .5
    for poly in sleeves:
        # The traced seam is the three points nearest the body centre.
        seam = sleeve_seam(poly, center)
        d = np.full((h, w), 1e9)
        for (ax, ay), (bx, by) in zip(seam, seam[1:]):
            vx, vy = bx - ax, by - ay
            t = np.clip(((xx - ax) * vx + (yy - ay) * vy) / (vx * vx + vy * vy), 0, 1)
            d = np.minimum(d, np.hypot(xx - ax - t * vx, yy - ay - t * vy))
        end = max(p[1] for p in seam)
        fade = np.clip(d / 6, 0, 1); fade = fade * fade * (3 - 2 * fade)
        keep = np.clip((yy - (end - 22)) / 8, 0, 1)  # cuff end stays crisp
        sleeve_a = sleeve_a * np.maximum(np.maximum(fade, keep), sleeve_print)
    return sleeve_a


def close_pinholes(owners, painted, rgb, alpha):
    """Painted pixels that no layer took (left between neighbouring cuts)
    join the layer that covers most of their surroundings, so no seam shows
    the background. `owners`: {name: [rgb, alpha]} (lists, updated in place
    and returned). Detached fragments are dropped first, so their pixels are
    refilled into the layer around them rather than lost."""
    from .common import small_islands
    for v in owners.values():
        v[1] = v[1] * ~small_islands(v[1] > .1)
    cover = sum(np.clip(v[1], 0, 1) for v in owners.values())
    holes = painted & (cover < .5)
    near = {k: box_blur(np.clip(v[1], 0, 1).astype(np.float32), 2) for k, v in owners.items()}
    best = np.argmax(np.stack(list(near.values())), 0)
    for idx, (k, v) in enumerate(owners.items()):
        take = holes & (best == idx)
        if take.any():
            v[0] = np.where(take[..., None], rgb, v[0]); v[1] = np.maximum(v[1], take * alpha)
    # Boundary pixels split between two zones (one share then lost to a
    # colour test) were left half transparent; the main owner takes
    # the painted alpha back.
    stack = np.stack([np.clip(v[1], 0, 1) for v in owners.values()])
    cover = stack.sum(0)
    short = painted & (cover < alpha - .05)
    top = np.argmax(stack, 0)
    for idx, (k, v) in enumerate(owners.items()):
        fix = short & (top == idx) & (stack[idx] > 0)
        v[1] = np.where(fix, alpha, v[1])
    return owners
