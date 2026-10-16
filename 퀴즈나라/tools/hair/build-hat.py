"""Hat pipeline, step 1: cut the hat out of a ChatGPT hat sheet.

  python3 -B tools/hair/build-hat.py SHEET [--out DIR] [--id hat:<shape>] [--base tools/fixtures/hat-base]

With --base the sheet was drawn on the hat kit's base picture (the game's own
figures with room above the heads, 2026-10-15 batch) instead of the garment
template (the pilot M1, M2): see build_base.

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
import importlib.util
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
DIFF = 22.0       # blurred Lab change from the base figure that is the hat (diff_hat)
GAP_FILL = 30     # px (template scale) of a gap in a column bridged as hat
MAX_FACE = .003   # share of a hat cut that may be the base figure's unchanged face (face_in_hat)
BROWN_HAT = 11.5  # Lab: hat colours this near the head's are the hair's own (kept whole, trim_head)
COLOUR_SHARE = .8 # the colour cut stands when it finds this share of what changed
PIECE_OPEN = 3     # px (template scale): a piece joined to the hat by a narrower bridge is not the hat (cut_flat)
SHIFT = 4          # px (template scale) a redrawn face part may move (cut_flat)
SHIFT_MATCH = 12.0 # Lab: a pixel this near the base face within SHIFT px is the face redrawn
HOLE_UNLIKE = 25.0 # Lab: an unchanged hole this unlike the hat round it is the page seen through it (cut_flat)
FLAT_NEAR = 30.0  # Lab distance to a flat-hair base's colour that is still the placeholder (cut_flat)
GROW = 3          # px the hat mask grows over its own outline
ZONE = .75        # share of head top -> neck the hat may reach down to (a cap's back strap, a profile brim)
HIDE_SIDE = 260   # px beside the hat the hair-hide mask reaches (hide_mask; a twin tail, a pony)
HIDE_TOP = 80     # px above the hat (spiky hair above the crown)
HIDE_FLARE = 1.6  # beside the hat the hidden edge drops this many px per px outward: the hair under the
                  # rim starts as wide as the rim and widens downward, as a cap presses it (2026-10-15:
                  # a rising edge left 'wings' of hair beside the rim)
HIDE_SOFT = 6.0   # px of the hidden edge's soft fall-off
HIDE_GAP = 4      # px (template scale): a gap in a column of the hat this short is still the hat (hide_mask)
SKIN_ABOVE = 10   # px above the rim's edge where the head's skin (an ear) is still kept
BAND_L, BAND_C = 25.0, 12.0  # Lab lightness, chroma: a near-black neutral piece (a police cap's visor, unlike the
                             # brown of hair) ...
BAND_SPAN = .5    # ... spanning this share of the hat's width is the hat's own band, kept by trim_head (2026-10-16:
                  # the visor was dropped as 'nearer the hair'; redrawn fringes and faces dropped there span <= 72 px
                  # of a ~200 px hat and are brown or light)
BAND_PX_C = 18.0  # Lab chroma: a band's own pixels (grey highlights of a black visor; hair's brown is over 20)
WISP = 2          # px (template scale): hat pieces thinner than 2*WISP+1 ...
WISP_DROP = 3     # ... hanging this many px below the hat's body are a redrawn strand or outline (a police cap's
                  # white arcs beside its brim, a cowboy hat's hair wisps, 2026-10-16)
PAGE_MIN, PAGE_SPREAD = 236, 12  # RGB: near-white neutral, the sheet's page; ChatGPT's page is not the base's
                  # pure white near a hat, a grey haze that diff_hat takes as new paint (a police cap's white arcs,
                  # 2026-10-16), peeled off from the cut's outside in (peel_page; a white crown's outline stops it)
ROW_GAP = 60      # px (template scale) of a gap in a row bridged in a hat of the hair's brown (a cowboy hat's crown
                  # over hair of its own colour changes little: a notch, 2026-10-16)


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


def badge_holes(holes, Ul, head_cols, px=1.0):
    """Holes of a colour cut painted in a colour the head has not (a police cap's gold star, between the
    blue around it): the hat's own badge. Holes showing hair (a cap's back opening) stay open
    (2026-10-16: the star was cut out as an opening and showed the hair through the cap)."""
    lab_, comps = M.components(holes)
    novel = nearest(Ul, head_cols) > NOVEL
    keep = [c['label'] for c in comps if c['size'] > 40 * px * px and novel[lab_ == c['label']].mean() > .5]
    return np.isin(lab_, keep)


def unchanged_skin(u, t):
    """The base figure's own face skin or eyes, left as they were (face_in_hat)."""
    r, g, b = (t[..., i].astype(int) for i in range(3))
    skin = (r > 200) & (g > 160) & (r > g) & (g >= b) & (r - b > 20)
    iris = (g > r + 25) & (b > r + 15)
    return (skin | iris) & (np.abs(u.astype(int) - t.astype(int)).sum(-1) < 30)


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
    return cut_zone(u, a, t, head, low, x0, y0, box)


def diff_hat(u, t, zone, px):
    """The hat as what changed from the unchanged figure (base sheets only, where the figure is the
    game's own picture to a pixel): a hat the colour of the hair, the skin or the page (a cowboy hat, a
    graduation cap, a chef's hat on white) has no colour of its own to find, but it changes the picture.
    Changed pixels (blurred Lab distance over DIFF), closed, big pieces, holes filled (a white crown on
    a white page changes only along its outline)."""
    from PIL import ImageFilter
    bl = lambda x: np.asarray(Image.fromarray(x.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)
    d = np.sqrt(((R.lab(bl(u)) - R.lab(bl(t))) ** 2).sum(-1))
    # and any paint where the base figure has the white page (a chef's crown's faint outline)
    newpaint = (np.abs(u - 255).sum(-1) > 30) & (np.abs(t - 255).sum(-1) < 15)
    ch = (d > DIFF) | newpaint
    r = max(1, int(round(2 * px)))
    ch = M.erode(M.dilate(ch, r), r) & zone
    lab_, comps = M.components(ch)
    ch = np.isin(lab_, [c['label'] for c in comps if c['size'] >= SEED_MIN * px * px])
    if not ch.any():
        return ch
    # a hat is solid top to bottom in each column (its band over hair of the same brown changes little)
    out = ch.copy()
    # (short gaps only: under a tassel or a bandana's ties hang the face and fringe, unchanged)
    gap = int(round(GAP_FILL * px))
    for c in np.nonzero(ch.any(0))[0]:
        rr = np.nonzero(ch[:, c])[0]
        for a_, b_ in zip(rr[:-1], rr[1:]):
            if 1 < b_ - a_ <= gap: out[a_:b_, c] = True
    out = M.erode(M.dilate(out, r), r)  # a lone column dipping below the brim is closed back
    return fill_holes(out) & zone


def face_in_hat(hat, u, t, head):
    """Share of the cut hat that is the figure's own face or eyes left unchanged (skin or iris colours of
    the base figure, where the drawing did not change): a hat cut should hold none (2026-10-16: a
    graduation cap and a bandana took the eyes and fringe under them, seen only on the contact sheet).
    Calibrated on M7·M9 cut the faulty way (.0039–.018 with eyes showing) and six good cuts (≤ .0011,
    except the cowboy girl's front .0065, a real skin bit)."""
    if not hat.any():
        return 0.0
    return round(float((hat & head & unchanged_skin(u, t)).sum() / hat.sum()), 4)


def drop_wisps(hat, px=1.0):
    """The hat less thin strands hanging below its body (WISP): pixels of the hat outside its opening by
    WISP px that lie more than WISP_DROP px below the opened hat's lowest pixel in their column (or
    beside it), and then the pieces left hanging alone."""
    r = max(2, int(round(WISP * px)))  # at least 2: a 3 px strand stayed 'body' on the hat kit's 0.74 scale
    body = M.dilate(M.erode(hat, r), r) & hat
    if not body.any():
        return hat
    bottom = np.full(hat.shape[1], -1)
    for c in np.nonzero(body.any(0))[0]:
        bottom[c] = np.nonzero(body[:, c])[0].max()
    yy = np.arange(hat.shape[0])[:, None]
    hang = hat & ~body & ((bottom[None, :] < 0) | (yy > bottom[None, :] + WISP_DROP * px))
    out = hat & ~hang
    lab_, comps = M.components(out)
    big = max((c['size'] for c in comps), default=0)
    return np.isin(lab_, [c['label'] for c in comps if c['size'] >= .05 * big])


def peel_page(hat, u, t):
    """The hat less the page's haze: near-white neutral pixels reached through such pixels only from the
    base figure's page outside the cut (PAGE_*), then the pieces left hanging alone (a chef's white band
    meets the forehead below, not the page: 2026-10-16 it was peeled from its open lower edge)."""
    page = (u.min(-1) >= PAGE_MIN) & (u.max(-1) - u.min(-1) <= PAGE_SPREAD) & hat
    edge = page & M.dilate(~hat & (np.abs(t - 255).sum(-1) < 15), 1)
    out = hat & ~M.connected_to(page, edge)
    lab_, comps = M.components(out)
    big = max((c['size'] for c in comps), default=0)
    return np.isin(lab_, [c['label'] for c in comps if c['size'] >= .05 * big])


def band_pieces(lab_, comps, hat, Ul):
    """Labels of the pieces that are a near-black neutral band across the hat (BAND_*: a visor)."""
    cols = np.nonzero(hat.any(0))[0]
    width = cols.max() - cols.min() + 1
    C = np.hypot(Ul[..., 1], Ul[..., 2])
    out = set()
    for c in comps:
        m = lab_ == c['label']
        if c['bbox'][2] - c['bbox'][0] >= BAND_SPAN * width and np.median(Ul[..., 0][m]) < BAND_L and np.median(C[m]) < BAND_C:
            out.add(c['label'])
    return out


def trim_head(hat, u, t, head, px=1.0):
    """A redrawn fringe, eyes or ear under the hat changed too: pieces of the hat mask nearer the head's
    colours than the hat's and hanging from its lower edge are dropped (a band over hair of the same
    brown lies inside the hat and stays; a near-black band across the hat stays, BAND_*)."""
    Ul, Tl = R.lab(u), R.lab(t)
    head_cols = kmeans(Tl[head].reshape(-1, 3)[::7], 10)
    # the hat's own colours: where it is painted over the page (above and beside the head)
    own = hat & (np.abs(t - 255).sum(-1) < 15)
    if own.sum() < SEED_MIN:
        own = hat & (nearest(Ul, head_cols) > NOVEL)
    if own.sum() < SEED_MIN:
        return hat
    hat_cols = kmeans(Ul[own][::3], 6, seed=1)
    # a hat the hair's own brown (a cowboy hat) cannot be told from the hair by colour: kept whole
    dist = float(np.median(nearest(hat_cols[None], head_cols)))
    if dist < BROWN_HAT:
        return brown_hat(hat, u, t, px)
    headlike = hat & (nearest(Ul, head_cols) < nearest(Ul, hat_cols))
    below = np.zeros_like(hat); below[:-1] = ~hat[1:]; below[-1] = True  # lowest pixel of the hat in its column
    edge = hat & below
    lab_, comps = M.components(headlike)
    bands = band_pieces(lab_, comps, hat, Ul)
    drop = np.isin(lab_, [c['label'] for c in comps if (edge & (lab_ == c['label'])).any() and c['label'] not in bands])
    # of a band only its neutral pixels (the redrawn fringe touching a visor is brown)
    drop |= np.isin(lab_, list(bands)) & (np.hypot(Ul[..., 1], Ul[..., 2]) >= BAND_PX_C)
    out = hat & ~drop
    out |= fill_holes(out) & hat  # what it encloses stays (a badge joined to the visor by its outline)
    out = drop_wisps(out, px)
    lab_, comps = M.components(out)  # what is left hanging alone
    big = max((c['size'] for c in comps), default=0)
    return np.isin(lab_, [c['label'] for c in comps if c['size'] >= .05 * big])


def brown_hat(hat, u, t, px=1.0):
    """A hat the hair's own brown (a cowboy hat): kept whole, less the face left unchanged under its brim,
    with short gaps in its rows bridged (where it lies over hair of its own colour it changes little,
    a notch in the crown), and the pieces left hanging alone dropped."""
    out = hat & ~unchanged_skin(u, t)
    gap = int(round(ROW_GAP * px))
    fill = out.copy()
    for r_ in np.nonzero(out.any(1))[0]:
        cc = np.nonzero(out[r_])[0]
        for a_, b_ in zip(cc[:-1], cc[1:]):
            if 1 < b_ - a_ <= gap: fill[r_, a_:b_] = True
    fill = fill_holes(fill) & ~unchanged_skin(u, t)
    return drop_wisps(fill, px)


def cut_zone(u, a, t, head, low, x0, y0, box, px=1.0, diff=False):
    """The hat in one figure: u the drawn figure, t the unchanged one, head its head pixels, low the
    zone's last row; px the figure's scale against the template sheet (sizes in px scale with it).
    diff: t is the figure itself to a pixel (a base sheet), so the hat is also what changed (diff_hat)."""
    ys, xs = np.nonzero(head)
    side = int(round(60 * px))
    zone = np.zeros(head.shape, bool)
    zone[:low, max(0, xs.min() - side):xs.max() + side + 1] = True
    if diff:
        dh = diff_hat(u, t, zone, px)
        band = np.zeros_like(dh)  # a band taken in beside the colour cut: trim_head does not judge it again
        # only where the hat's own colours miss it: a colour cut keeps a cap's back opening
        colour = cut_zone(u, a, t, head, low, x0, y0, box, px)
        if dh.sum() < SEED_MIN * px * px:
            return colour
        # a hat with colours of its own: the colour cut finds most of what changed and keeps out the
        # redrawn face and fringe under it (a graduation cap's tassel, a bandana's ties)
        if colour is not None and colour['px'] >= COLOUR_SHARE * dh.sum():
            # less a band its colours miss (a police cap's black visor): what changed beside it, across the hat
            lab_, comps = M.components(dh & ~colour['mask'])
            bands = band_pieces(lab_, comps, colour['mask'], R.lab(u))
            if not bands:
                # the page's haze and thin strands the colour cut took with the hat's light colours (a straw
                # hat's haze under its brim, 2026-10-16)
                clean = drop_wisps(peel_page(colour['mask'], u, t), px)
                if (clean == colour['mask']).all():
                    return colour
                return pack(u, clean, fill_holes(clean) & ~clean, x0, y0, box, px)
            band = np.isin(lab_, list(bands)) & (np.hypot(*R.lab(u)[..., 1:].transpose(2, 0, 1)) < BAND_PX_C)
            dh = colour['mask'] | band
            colour = dict(colour, px=0)  # the cut below stands on dh, which already holds the colour cut
        if dh.sum() >= SEED_MIN * px * px:
            # what changed is the hat; the colour cut only adds the hole it shows hair through (a cap's back)
            opening = np.zeros_like(dh)
            if colour is not None:
                cm = colour['mask']; opening = fill_holes(cm) & ~cm
                lab_, comps = M.components(opening)
                opening = np.isin(lab_, [c['label'] for c in comps if c['size'] > 40 * px * px])
                opening &= ~badge_holes(opening, R.lab(u), kmeans(R.lab(t)[head].reshape(-1, 3)[::7], 10), px)
            hat = drop_wisps(peel_page(trim_head(dh, u, t, head, px) | band, u, t), px) & ~opening
            return pack(u, hat, opening, x0, y0, box, px)
    Ul, Tl = R.lab(u), R.lab(t)
    head_cols = kmeans(Tl[head].reshape(-1, 3)[::7], 10)
    fg = (a > .5) & zone
    novel = fg & (nearest(Ul, head_cols) > NOVEL)
    lab_, comps = M.components(novel)
    keep = [c['label'] for c in comps if c['size'] >= SEED_MIN * px * px]
    if not keep:
        return None
    seed = np.isin(lab_, keep)
    hat_cols = kmeans(Ul[seed][::3], 6, seed=1)
    closer = fg & (nearest(Ul, hat_cols) < nearest(Ul, head_cols))
    hat = M.connected_to(closer, seed)
    # its own outline: dark pixels hugging the hat
    # (not the hair's own dark strands: only near-black, or dark and unlike the head's colours)
    dist_head = nearest(Ul, head_cols)
    dark = fg & M.dilate(hat, max(1, int(round(GROW * px)))) & ((Ul[..., 0] < 25) | ((Ul[..., 0] < 45) & (dist_head > 12)))
    hat |= dark
    # close pinholes; a hole showing hair (a cap's back opening) stays open
    filled = fill_holes(hat)
    holes = filled & ~hat
    hl, hc = M.components(holes)
    for c in hc:
        if c['size'] <= 40 * px * px:
            hat |= hl == c['label']
    hat |= badge_holes(fill_holes(hat) & ~hat, Ul, head_cols, px)
    alpha = np.where(hat, np.clip(a, 0, 1), 0).astype(np.float32)
    opening = fill_holes(hat) & ~hat
    ys, xs = np.nonzero(hat)
    bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    rgba = np.dstack([u, alpha * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
    return dict(rgba=rgba, box=[x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]], px=int(hat.sum()), scale=px,
                mask=hat, cell=box, hide=hide_mask(hat, opening, x0, y0, side=int(HIDE_SIDE * px), top=int(HIDE_TOP * px),
                                                   soft=HIDE_SOFT * px))


def cut_flat(u, t, flat, head, low, x0, y0, box, px=1.0):
    """The hat on a flat-hair base (tools/hair/make-flat-hat-base.py, 2026-10-16): what changed from the base
    figure and is not the flat colour. A hat the hair's brown, a black visor, a white crown need no colour rule,
    and the hair redrawn under it stays flat (the sheet keeps the placeholder). The hat's edge over the flat
    hair is unmixed from it (no magenta fringe); flat hair the hat encloses is its opening (a cap's back)."""
    ys, xs = np.nonzero(head)
    side = int(round(60 * px))
    zone = np.zeros(head.shape, bool)
    zone[:low, max(0, xs.min() - side):xs.max() + side + 1] = True
    Ul, Fl = R.lab(u), R.lab(np.array(flat, np.float32)[None, None])[0, 0]
    dflat = np.sqrt(((Ul - Fl) ** 2).sum(-1))
    flat_now = dflat < FLAT_NEAR
    dh = diff_hat(u, t, zone, px)
    # diff_hat fills every hole (a white crown on the white page changes only along its outline); here a hole
    # stays open when it is unchanged and unlike the hat round it (a halo's gold ring round the page, 2026-10-16
    # flat check: the ring came out a disc)
    raw = np.sqrt(((Ul - R.lab(t)) ** 2).sum(-1)) > DIFF
    core = M.erode(M.dilate(dh & raw, 1), 1)
    lab_, comps = M.components(fill_holes(core) & ~core)
    for c in comps:
        m = lab_ == c['label']
        if (raw & m).sum() > .5 * m.sum():  # mostly repainted: the hat
            continue
        ring = M.dilate(m, 3) & core
        if ring.any() and np.sqrt(((Ul[m].mean(0) - Ul[ring].mean(0)) ** 2).sum()) > HOLE_UNLIKE:
            dh = dh & ~m
    hat = dh & ~flat_now
    # the base figure's own face, ears and neck redrawn a few px off (an eye, an ear's rim): a pixel that matches
    # one of them within SHIFT px is that redraw, not the hat. Colour alone could not tell: the brim's brown and
    # the visor's black are the brows' and lashes' (a notch), a cream hat is the skin's (Lab 9). Cowboy and
    # police pilots on the flat base hung ear and eye pieces under the brim (FACE_IN_HAT, 2026-10-16).
    Tl = R.lab(t)
    t_face = head & (np.sqrt(((Tl - Fl) ** 2).sum(-1)) >= FLAT_NEAR) & (np.abs(t - 255).sum(-1) > 30)
    sh = max(1, int(round(SHIFT * px)))
    best = np.full(hat.shape, np.inf, np.float32)
    H, W = hat.shape
    for dy in range(-sh, sh + 1):
        for dx in range(-sh, sh + 1):
            ys0, ys1, xs0, xs1 = max(0, dy), min(H, H + dy), max(0, dx), min(W, W + dx)
            d_ = np.full(hat.shape, np.inf, np.float32)
            dd = np.sqrt(((Ul[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx] - Tl[ys0:ys1, xs0:xs1]) ** 2).sum(-1))
            d_[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx] = np.where(t_face[ys0:ys1, xs0:xs1], dd, np.inf)
            best = np.minimum(best, d_)
    hat &= ~(best < SHIFT_MATCH)
    r = max(1, int(round(2 * px)))
    lab_, comps = M.components(M.erode(M.dilate(hat, r), r))
    hat = np.isin(lab_, [c['label'] for c in comps if c['size'] >= SEED_MIN * px * px]) & ~flat_now
    if hat.sum() < SEED_MIN * px * px:
        return None
    opening = fill_holes(hat) & flat_now
    lab_, comps = M.components(opening)
    opening = np.isin(lab_, [c['label'] for c in comps if c['size'] > 40 * px * px])
    hat = drop_wisps(peel_page(hat & ~opening, u, t), px)
    # pieces hanging on by a bridge a few px wide (an ear or a lid the sheet showed more of under the brim) are
    # cut off: opened, pieces under a tenth of the biggest dropped, grown back over the hat only
    ro = max(1, int(round(PIECE_OPEN * px)))
    op = M.dilate(M.erode(hat, ro), ro)
    lab_, comps = M.components(op)
    if comps:
        big = max(c['size'] for c in comps)
        core = np.isin(lab_, [c['label'] for c in comps if c['size'] >= .1 * big])
        hat = hat & M.dilate(core, ro + 1)
    if not hat.any():
        return None
    # the edge over the flat hair: u = a*hat + (1-a)*flat, the hat's colour taken from its inside a few px in
    inner = M.erode(hat, 2) if M.erode(hat, 2).any() else hat
    col, have = np.where(inner[..., None], u, 0).astype(np.float32), inner.copy()
    for _ in range(6):
        grow = M.dilate(have, 1) & ~have
        if not grow.any():
            break
        acc = np.zeros_like(col); n = np.zeros(have.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                acc += np.roll(np.roll(col * have[..., None], dy, 0), dx, 1); n += np.roll(np.roll(have, dy, 0), dx, 1)
        col = np.where(grow[..., None], acc / np.maximum(n, 1)[..., None], col); have |= grow
    f = np.array(flat, np.float32)
    span = np.sqrt(((col - f) ** 2).sum(-1)); moved = np.sqrt(((u.astype(np.float32) - f) ** 2).sum(-1))
    edge = hat & ~inner & M.dilate(flat_now, 2)
    a = np.where(edge, np.clip(moved / np.maximum(span, 30), 0, 1), 1.0).astype(np.float32)
    clean = np.where(edge[..., None], np.clip(f + (u - f) / np.maximum(a, .05)[..., None], 0, 255), u)
    out = pack(clean, hat, opening, x0, y0, box, px)
    bx = out['box']
    out['rgba'][..., 3] = (np.where(hat, a, 0) * 255).astype(np.uint8)[bx[1] - y0:bx[3] - y0, bx[0] - x0:bx[2] - x0]
    return out


def cut_enclosed(u, x0, y0, box, px=1.0):
    """A light object with a dark outline (white headphones, 2026-10-16): its light parts are the near-white
    pixels the page does not reach from the cell's edge (the outline closes them), plus the low-colour outline
    and padding round them. A cut by difference took the hair ChatGPT pressed under the band, and the zone
    under the rim line cut the ear cups off. Eye highlights and other small specks stay out by size."""
    mx, mn = u.max(-1), u.min(-1)
    light = (mn > 222) & (mx - mn < 28)
    lab_, comps = M.components(light)
    hgt, wid = light.shape
    edge = set(np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]]))) - {0}
    inner = [c for c in comps if c['label'] not in edge]
    if not inner:
        return None
    big = max(c['size'] for c in inner)
    keep = np.isin(lab_, [c['label'] for c in inner if c['size'] >= max(40 * px * px, .08 * big)])
    page = np.isin(lab_, list(edge))
    grey = (mx - mn < 34) & ~page  # outline and cup padding: grey, not the brown hair or the skin
    obj = keep | (M.dilate(keep, max(2, int(round(5 * px)))) & grey)
    obj = fill_holes(obj) & ~page
    if obj.sum() < 50:
        return None
    return pack(u, obj, np.zeros_like(obj), x0, y0, box, px)


def pack(u, hat, opening, x0, y0, box, px):
    """A cut figure from its hat mask (opaque): RGBA crop, box in sheet px, the hair-hide mask."""
    ys, xs = np.nonzero(hat)
    bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    rgba = np.dstack([u, hat.astype(np.float32) * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
    return dict(rgba=rgba, box=[x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]], px=int(hat.sum()), scale=px,
                mask=hat, cell=box, hide=hide_mask(hat, opening, x0, y0, side=int(HIDE_SIDE * px), top=int(HIDE_TOP * px),
                                                   soft=HIDE_SOFT * px))


def hide_mask(hat, opening, x0, y0, side=HIDE_SIDE, top=HIDE_TOP, flare=HIDE_FLARE, soft=HIDE_SOFT):
    """Where a pulled-on hat hides the wearer's own hair (any hair style):
    in the hat's columns everything down to its lower edge, the opening it
    shows hair through (a cap's back) excepted; beside the hat everything
    above an edge that drops `flare` px per px away from the hat's nearest
    lower edge, so the hair left under the rim starts at the rim's width and
    widens downward. Opacity (1 = hidden) with a soft edge, the rim's edge per
    column (sheet y, for the skin kept in export) and the box in sheet px."""
    cols = np.nonzero(hat.any(0))[0]
    rows = np.nonzero(hat.any(1))[0]
    bottom = np.full(hat.shape[1], -1)
    whole = hat | opening
    gap = max(2, int(round(HIDE_GAP * soft / HIDE_SOFT)))
    low_half = rows.min() + .5 * (rows.max() - rows.min())
    for c in cols:
        # the end of the hat's first run from the top (a gap of a few px bridged): below it the column may hold
        # a separate piece (a wide brim's end curling down beside the head, a tassel), and the hair between
        # shows (2026-10-16: hiding down to the brim's tip cut the hair square under a straw hat)
        # (only a gap in the hat's lower half: a notch high up, a bandana's skull on its edge, shows no hair)
        rr = np.nonzero(whole[:, c])[0]
        cut = [i for i in np.nonzero(np.diff(rr) > gap)[0] if rr[i] >= low_half]
        bottom[c] = rr[cut[0]] if cut else rr[-1]
    # the box may reach past the figure's cell (a twin tail): columns outside it are beside the hat
    fx0, fx1 = cols.min() - side, cols.max() + 1 + side
    fy0, fy1 = max(0, rows.min() - top), rows.max() + 1 + side
    yy = np.arange(fy0, fy1)[:, None]
    edge = np.empty(fx1 - fx0); rim = np.empty(fx1 - fx0)
    for i, c in enumerate(range(fx0, fx1)):
        if 0 <= c < hat.shape[1] and bottom[c] >= 0:
            edge[i] = rim[i] = bottom[c]
        else:
            n = cols[np.argmin(np.abs(cols - c))]
            rim[i] = bottom[n]; edge[i] = bottom[n] + flare * abs(c - n)
    hidden = np.clip((edge[None, :] - yy) / soft + .5, 0, 1)
    op = np.zeros(hidden.shape, bool)
    cx0, cx1 = max(0, fx0), min(hat.shape[1], fx1); cy1 = min(hat.shape[0], fy1)
    op[:cy1 - fy0, cx0 - fx0:cx1 - fx0] = opening[fy0:cy1, cx0:cx1]
    hidden[op] = 0
    return dict(alpha=hidden.astype(np.float32), rim=rim + y0, box=[x0 + fx0, y0 + fy0, x0 + fx1, y0 + fy1])


def keep_skin(hide, fr, key, scale=1.0):
    """Takes the head's skin (tools/fixtures/head-skin-*.png: ears, face, nape of
    every hair style) out of the hide mask below SKIN_ABOVE px over the rim's
    edge, so the hat hides hair only. Returns the RGBA mask (black = hidden)."""
    meta = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-skin.json')))
    skin = np.asarray(Image.open(os.path.join(ROOT, 'tools', 'fixtures', meta['maps'][key])).convert('L')) / 255.0
    bx = hide['box']; h, w = hide['alpha'].shape
    (cx0, cy0) = fr['cell0']; u = fr['unitsPerSheetPx']; ox, oy = fr['cellOrigin']; t = fr['toViewBox']
    px, py = np.meshgrid(np.arange(bx[0], bx[2]) + .5, np.arange(bx[1], bx[3]) + .5)
    hx = (ox + (px - cx0) * u - t[4]) / t[0]; hy = (oy + (py - cy0) * u - t[5]) / t[3]
    r = meta['rect']; res = meta['res']
    sx = np.floor((hx - r[0]) * res).astype(int); sy = np.floor((hy - r[1]) * res).astype(int)
    ok = (sx >= 0) & (sy >= 0) & (sx < skin.shape[1]) & (sy < skin.shape[0])
    k = np.zeros((h, w)); k[ok] = skin[sy[ok], sx[ok]]
    k[py < hide['rim'][None, :] - SKIN_ABOVE * scale] = 0
    a = hide['alpha'] * (1 - k)
    rgba = np.zeros((h, w, 4), np.uint8); rgba[..., 3] = np.round(a * 255).astype(np.uint8)
    return rgba


def to_head(fr, box):
    """Sheet px box -> head-native [x, y, w, h] of that figure's view (tools/fixtures/hat-frame.json)."""
    (cx0, cy0) = fr['cell0']; u = fr['unitsPerSheetPx']; ox, oy = fr['cellOrigin']; t = fr['toViewBox']
    x = (ox + (box[0] - cx0) * u - t[4]) / t[0]; y = (oy + (box[1] - cy0) * u - t[5]) / t[3]
    return [round(x, 3), round(y, 3), round((box[2] - box[0]) * u / t[0], 3), round((box[3] - box[1]) * u / t[3], 3)]


def template_frames():
    """Sheet px of the garment template -> head-native, per figure (tools/fixtures/hat-frame.json)."""
    frame = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'hat-frame.json')))['figures']
    spec = R.garment_spec('hat', ('m', 'f'))
    return {k: dict(frame[k], cell0=spec['cells'][k][:2]) for k in frame}


def export(pid, kind, figures, out_assets, frames=None):
    """assets/hat-art/<shape>-<sex>-<view>.png (+ -hide.png for pulled-on hats) and
    their records (head-native rects) for avatar-hat-art.js. frames: sheet px -> head-native per
    figure (default: the garment template's, template_frames)."""
    frames = frames or template_frames()
    shape = pid.split(':')[1]
    os.makedirs(out_assets, exist_ok=True)
    rec = dict(kind=kind, views={})
    for k, f in figures.items():
        sex, view = k.split('-')
        fr = frames[k]
        name = '%s-%s-%s' % (shape, sex, view)
        Image.fromarray(f['rgba']).save(os.path.join(out_assets, name + '.png'), optimize=True)
        v = dict(src='assets/hat-art/%s.png' % name, rect=to_head(fr, f['box']))
        if kind == 'full':
            Image.fromarray(keep_skin(f['hide'], fr, k, f.get('scale', 1.0))).save(os.path.join(out_assets, name + '-hide.png'), optimize=True)
            v['hide'] = dict(src='assets/hat-art/%s-hide.png' % name, rect=to_head(fr, f['hide']['box']))
        if kind == 'full':
            # everything above the hide mask over its whole width (hair taller than the frame: m spiky, a pony's tip)
            h = v['hide']['rect']
            v['hideTop'] = [h[0], -20.0, h[2], round(h[1] + 20.4, 3)]  # overlaps the mask's top rows (all hidden) so its soft edge never shows hair
            v['rim'] = hat_rim(f['rgba'][..., 3], v['rect'])
        rec['views'].setdefault(sex, {})[view] = v
    json.dump(rec, open(os.path.join(out_assets, shape + '.json'), 'w'), ensure_ascii=False, indent=1)
    write_runtime(out_assets)
    return rec


RIM_MID = .3   # share of the hat's width round its middle whose bottom is the rim (hat_rim; a mortarboard's
              # tassel and a straw hat's bow hang outside it, a backward cap's strap opening is inside it)


def hat_rim(alpha, rect):
    """Head-native row where a pulled-on hat meets the forehead: the median lowest hat pixel of the
    columns round its middle (alpha: the hat picture's alpha, or its path under ROOT).
    A style fitted smaller (fit-hat-hair.py) is scaled about it."""
    if isinstance(alpha, str):
        alpha = np.asarray(Image.open(os.path.join(ROOT, alpha)).convert('RGBA'))[..., 3]
    a = alpha > 127
    cols = np.nonzero(a.any(0))[0]
    if not len(cols):
        return None
    mid = (cols[0] + cols[-1]) / 2; half = max(1, (cols[-1] - cols[0]) * RIM_MID / 2)
    bot = []
    for c in range(int(mid - half), int(mid + half) + 1):
        ys = np.nonzero(a[:, c])[0]
        if not len(ys):
            continue
        bot.append(ys[-1] + 1)
    return round(rect[1] + float(np.median(bot)) / a.shape[0] * rect[3], 3) if bot else None


def write_runtime(out_assets):
    """assets/hat-art/hat-art.json (every <shape>.json) and avatar-hat-art.js (window.QPHatArt)."""
    allrec = {}
    for name in sorted(os.listdir(out_assets)):
        if name.endswith('.json') and name != 'hat-art.json':
            rec = json.load(open(os.path.join(out_assets, name)))
            if rec.get('kind') == 'full' and any('rim' not in v for vs in rec['views'].values() for v in vs.values()):
                for vs in rec['views'].values():
                    for v in vs.values():
                        v['rim'] = hat_rim(v['src'], v['rect'])
                json.dump(rec, open(os.path.join(out_assets, name), 'w'), ensure_ascii=False, indent=1)
            allrec[name[:-5]] = rec
    json.dump(allrec, open(os.path.join(out_assets, 'hat-art.json'), 'w'), ensure_ascii=False, indent=1)
    js = ('// Hat art of the foundation avatar (generated by tools/hair/build-hat.py; do not edit).\n'
          '// Per hat shape: kind full (hides the hair under it) | sit (sits on the hair), and per sex and view\n'
          '// (front, right, back) the picture and, for full hats, the hair-hide mask, as head-native rects.\n'
          'window.QPHatArt=Object.freeze(' + json.dumps(allrec, ensure_ascii=False, separators=(',', ':')) + ');\n')
    tops = os.path.join(ROOT, 'tools', 'fixtures', 'hair-tops.json')
    if os.path.exists(tops):
        t = json.load(open(tops))
        js += ('// Each hair style\'s top edge per sex and view (tools/hair/fit-head-skin.py): y at x = 0..32 every step,\n'
               '// head-native; an ornament that sits on the hair moves with it.\n'
               'window.QPHairTops=Object.freeze(' + json.dumps(dict(step=t['step'], default=t['default'], tops=t['tops']), separators=(',', ':')) + ');\n')
    hair = os.path.join(out_assets, 'hair', 'hair.json')
    if os.path.exists(hair):
        js += ('// Hair drawn under a pulled-on hat (tools/hair/build-hat-hair.py): per sex, hair style and view the\n'
               '// hair as luminance (tinted like the head) and the skin of the game painting it keeps.\n'
               'window.QPHatHair=Object.freeze(' + json.dumps(json.load(open(hair)), ensure_ascii=False, separators=(',', ':')) + ');\n')
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


CHECK_HOLE = 40     # px (template scale): a hole of new paint this big is a lost badge (HAT_HOLE)
CHECK_DROP = .5     # share of the hat's width a dropped changed piece may span (WIDE_DROP: a lost visor)
CHECK_PAGE = .002   # share of the cut that may be page haze joined to the outside (PAGE_IN_HAT)
CHECK_NOTCH = 20    # px (template scale): closing radius that finds a notch in the hat's upper part ...
CHECK_NOTCH_PX = 150  # ... of this many px (template scale, squared with px) (HAT_NOTCH) ...
CHECK_NOTCH_LAB = 10.0  # ... drawn within this Lab distance of the hat's own colours


def page_like(u):
    """Near-white neutral pixels (PAGE_*)."""
    return (u.min(-1) >= PAGE_MIN) & (u.max(-1) - u.min(-1) <= PAGE_SPREAD)


def cut_checks(mask, u, t, head, dh, px=1.0, kind=None):
    """Codes for the ways a hat cut went wrong (2026-10-16, each seen once on a contact sheet before):
    HAT_HOLE a hole painted in a new colour (a police cap's star), WIDE_DROP a changed piece across half
    the hat left out (its visor), PAGE_IN_HAT the page's haze kept (white arcs beside a brim), HAT_NOTCH a
    notch in the hat's upper part (a cowboy hat over hair of its brown, a bandana's skull on its edge)."""
    codes = []
    if not mask.any():
        return codes
    Ul = R.lab(u)
    head_cols = kmeans(R.lab(t)[head].reshape(-1, 3)[::7], 10)
    novel = nearest(Ul, head_cols) > NOVEL
    lab_, comps = M.components(fill_holes(mask) & ~mask)
    if any(c['size'] > CHECK_HOLE * px * px and novel[lab_ == c['label']].mean() > .5 for c in comps):
        codes.append('HAT_HOLE')
    cols = np.nonzero(mask.any(0))[0]; width = cols.max() - cols.min() + 1
    C = np.hypot(Ul[..., 1], Ul[..., 2])
    unhair = novel | ((Ul[..., 0] < BAND_L) & (C < BAND_C))  # not the hair a drawing redid under the hat
    lab_, comps = M.components(dh & ~mask)
    if any(c['bbox'][2] - c['bbox'][0] >= CHECK_DROP * width and (lab_ == c['label']).sum() > CHECK_HOLE * px * px
           and unhair[lab_ == c['label']].mean() > .5 for c in comps):
        codes.append('WIDE_DROP')
    page = page_like(u) & mask
    haze = M.connected_to(page, page & M.dilate(~mask & (np.abs(t - 255).sum(-1) < 15), 1))
    if haze.sum() > CHECK_PAGE * mask.sum():
        codes.append('PAGE_IN_HAT')
    if kind not in (None, 'full'):
        return codes  # an ornament sitting on the hair shows hair between its parts (ribbon loops, petals)
    r = max(1, int(round(CHECK_NOTCH * px)))
    rows = np.nonzero(mask.any(1))[0]; upper = np.zeros_like(mask); upper[rows.min():rows.min() + int(.6 * (rows.max() - rows.min()))] = True
    # painted in the hat's own colours (a natural concavity, beside a brim or a tassel, is page)
    hat_cols = kmeans(Ul[mask][::5], 6, seed=1)
    notch = M.erode(M.dilate(mask, r), r) & ~fill_holes(mask) & upper & ~page_like(u) & (nearest(Ul, hat_cols) < CHECK_NOTCH_LAB)
    lab_, comps = M.components(notch)
    if any(c['size'] > CHECK_NOTCH_PX * px * px for c in comps):
        codes.append('HAT_NOTCH')
    return codes


NECK_HN = 29.0     # head-native row taken as the neck in a base figure (the chin is about 30)


def build_base(sheet, base_dir, out, pid=None, kind=None, out_assets=None):
    """A hat drawn on the hat kit's base picture (make-hat-hair-base.cjs --hat: the game's own figures
    with room above each head): the sheet is scaled to the base and shifted per figure onto it by the
    legs (build-hat-hair.py align); the hat is cut against the base figure; sheet px map to
    head-native units through each figure's svg box, so no template fit is needed."""
    _hh = importlib.util.spec_from_file_location('build_hat_hair', os.path.join(HERE, 'build-hat-hair.py'))
    HH = importlib.util.module_from_spec(_hh); _hh.loader.exec_module(HH)
    meta = json.load(open(os.path.join(base_dir, 'base.json')))
    base = np.asarray(Image.open(os.path.join(base_dir, 'base.png')).convert('RGB'))
    im = Image.open(sheet).convert('RGB')
    im = im.resize((base.shape[1], round(im.height * base.shape[1] / im.width)), Image.LANCZOS)
    sh = np.full(base.shape, 255, np.uint8); h = min(base.shape[0], im.height); sh[:h] = np.asarray(im)[:h]
    hf = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-frame.json')))
    tpl_u = np.mean([f['unitsPerSheetPx'] for f in json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'hat-frame.json')))['figures'].values()])
    rows = [r.split(':')[0] for r in meta['rows']]
    cut, frames, report, tiles = {}, {}, dict(sheet=os.path.basename(sheet), figures={}), []
    for i, box in enumerate(meta['boxes']):
        sex, view = rows[i // len(meta['views'])], meta['views'][i % len(meta['views'])]
        k = '%s-%s' % (sex, view)
        dx, dy, err = HH.align(base, sh, box)
        moved = np.full(base.shape, 255, np.uint8)
        ys0, ys1 = max(0, dy), min(base.shape[0], base.shape[0] + dy)
        xs0, xs1 = max(0, dx), min(base.shape[1], base.shape[1] + dx)
        moved[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx] = sh[ys0:ys1, xs0:xs1]
        ppu = box['w'] / 32.0; t = hf[sex][view]['frame']['toViewBox']
        px = ppu * tpl_u  # this figure's px against the template sheet's
        neck = int(box['y'] + (NECK_HN * t[3] + t[5]) * ppu)
        x0 = max(0, int(box['x'] - 150 * px)); x1 = min(base.shape[1], int(box['x'] + box['w'] + 150 * px))
        y0 = (i // len(meta['views'])) * (base.shape[0] // len(rows))  # the row's top: room for a tall hat
        u = moved[y0:neck, x0:x1].astype(np.float32); tt = base[y0:neck, x0:x1].astype(np.float32)
        head = (np.abs(tt - 255).sum(-1) > 40)
        hy = np.nonzero(head.any(1))[0]
        low = int(hy.min() + ZONE * (len(head) - hy.min()))
        a = (np.abs(u - 255).sum(-1) > 30).astype(np.float32)
        if kind == 'band':  # headphones: the object itself, not what changed (the sheet pressed the hair under it)
            f = cut_enclosed(u, x0, y0, [x0, y0, x1, neck], px)
        elif meta.get('flat'):  # the hair painted one colour (make-flat-hat-base.py)
            fc = [int(meta['flat'][i:i + 2], 16) for i in (1, 3, 5)]
            f = cut_flat(u, tt, fc, head, low, x0, y0, [x0, y0, x1, neck], px)
        else:
            f = cut_zone(u, a, tt, head, low, x0, y0, [x0, y0, x1, neck], px, diff=True)
        report['figures'][k] = None if f is None else dict(box=f['box'], px=f['px'], shift=[dx, dy], legsError=round(err, 2),
                                                           face=face_in_hat(f['mask'], u, tt, head))
        if f is not None and report['figures'][k]['face'] > MAX_FACE:
            report.setdefault('codes', []).append(['FACE_IN_HAT', k])
        if f is not None:
            zone = np.zeros(head.shape, bool); hx = np.nonzero(head.any(0))[0]; side = int(round(60 * px))
            zone[:low, max(0, hx.min() - side):hx.max() + side + 1] = True
            for code in cut_checks(f['mask'], u, tt, head, diff_hat(u, tt, zone, px), px, kind):
                report.setdefault('codes', []).append([code, k])
        frames[k] = dict(cell0=[0, 0], unitsPerSheetPx=1 / ppu, cellOrigin=[-box['x'] / ppu, -box['y'] / ppu], toViewBox=t)
        if f is None:
            continue
        cut[k] = f
        os.makedirs(out, exist_ok=True)
        Image.fromarray(f['rgba']).save(os.path.join(out, 'hat-%s.png' % k))
        bg = Image.new('RGBA', (f['rgba'].shape[1] + 20, f['rgba'].shape[0] + 20), (40, 52, 90, 255))
        bg.alpha_composite(Image.fromarray(f['rgba']), (10, 10)); tiles.append(bg.convert('RGB'))
    os.makedirs(out, exist_ok=True)
    json.dump(report, open(os.path.join(out, '모자.json'), 'w'), ensure_ascii=False, indent=1)
    if tiles:
        w = sum(t.width for t in tiles) + 6 * len(tiles); hh = max(t.height for t in tiles)
        sheet_im = Image.new('RGB', (w, hh), 'white'); x = 0
        for t in tiles:
            sheet_im.paste(t, (x, 0)); x += t.width + 6
        sheet_im.save(os.path.join(out, '모자-조각.png'))
    if pid:
        report['record'] = export(pid, kind, cut, out_assets, frames)
    return report


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--out')
    ap.add_argument('--id', help='hat:<shape>: also export assets/hat-art/ and print the record')
    ap.add_argument('--base', help='the sheet was drawn on the hat kit base (tools/fixtures/hat-base: make-hat-hair-base.cjs --hat)')
    a = ap.parse_args(argv)
    name = os.path.splitext(os.path.basename(a.sheet))[0]
    out = a.out or os.path.join(ROOT, '검증', '모자', name)
    kind = None
    if a.id:
        prod = json.load(open(os.path.join(ROOT, 'assets', 'garment-template', 'products.json')))['products'][a.id]
        kind = {'hat/full': 'full', 'hat/sit-on': 'sit', 'hat/band': 'sit', 'hat/halo': 'sit'}[prod['class']]
        if prod.get('earAnchored'):  # headphones: the cups stay at the ears, the band stretches to the hair (2026-10-16)
            kind = 'band'
    if a.base:
        r = build_base(a.sheet, a.base, out, a.id, kind, os.path.join(ROOT, 'assets', 'hat-art'))
    else:
        r = build(a.sheet, out, a.id, kind, os.path.join(ROOT, 'assets', 'hat-art'))
    print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
