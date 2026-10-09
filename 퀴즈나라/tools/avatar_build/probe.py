"""Provisional top mask of a registered upload, for limit calibration only.

The real pipeline (WP5 registration + WP6 three-way segmentation) replaces
this. A ChatGPT sheet is placed on the frozen grid by the one global fit
(scale 1629/1536, then the template's 90 px left margin) and split by plain
rules, three-way in spirit:
  background  near-white connected to the border;
  unchanged   body art (arm, leg, neck, head owners) within dE 10 of the
              template (window minimum over +-2 px) stays body, so the
              painted outlines of arms and neck are not taken for cloth;
  classes     per-sheet colour clusters (Lab k-means) of skin (forearms,
              neck), top (chest) and shorts (seat): each candidate pixel
              takes the nearest cluster; hair is brown next to the head;
  outline     dark pixels touching the top join it (hem, cuff, collar line).
"""
import numpy as np
from PIL import Image, ImageFilter

from .common import CHATGPT_SCALE, SHEET, TEMPLATE, connected, dilate, erode, small_islands
from .frozen import skinish


def register_global(path):
    """Upload -> sheet grid by the global fit only (no per-figure refinement)."""
    im = Image.open(path).convert('RGB')
    scale = TEMPLATE['width'] / im.width
    big = im.resize((TEMPLATE['width'], int(round(im.height * scale))), Image.LANCZOS)
    reg = big.crop((TEMPLATE['left'], 0, TEMPLATE['left'] + SHEET['width'], SHEET['height']))
    return np.asarray(reg).astype(np.float32), dict(scale=scale, expected=CHATGPT_SCALE, left=TEMPLATE['left'])


def reference_on_white(sheet_rgba):
    a = sheet_rgba[..., 3:] / 255
    return sheet_rgba[..., :3] * a + 255 * (1 - a)


def border_background(rgb):
    near = (rgb.min(-1) >= 232) & (rgb.max(-1) - rgb.min(-1) <= 22)
    seed = np.zeros(near.shape, bool)
    seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
    cur = seed & near
    for _ in range(4000):
        grown = (np.asarray(Image.fromarray(cur.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 127) & near
        if (grown == cur).all():
            break
        cur = grown
    return cur


def lab(rgb):
    c = rgb / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = c @ M.T / np.array([.95047, 1.0, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def window_min_de(a, b, r=2):
    best = np.full(a.shape[:2], 1e9, np.float32)
    H, W = a.shape[:2]
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            sb = np.roll(np.roll(b, dy, 0), dx, 1)
            best = np.minimum(best, np.sqrt(((a - sb) ** 2).sum(-1)))
    return best


def kmeans(x, k=4, iters=25, seed=0):
    x = x[::max(1, len(x) // 4000)]
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), size=min(k, len(x)), replace=False)]
    for _ in range(iters):
        lab_ = ((x[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        c = np.array([x[lab_ == j].mean(0) if (lab_ == j).any() else c[j] for j in range(len(c))])
    return c


def nearest(L, centres):
    return np.sqrt(((L[:, None, :] - centres[None]) ** 2).sum(-1)).min(1)


def top_mask(rgb, labels, layers_alpha, geo, reference_rgb):
    """Bool mask of the top's pixels in a registered upload (provisional)."""
    # White cloth (cuffs, collars) touching the page leaks into the flood
    # fill; inside the frozen figure it is not background.
    bg = border_background(rgb) & ~erode(labels > 0, 1)
    LU, LT = lab(rgb), lab(reference_rgb)
    changed = window_min_de(LU, LT) > 10
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    brown = ((r - b > 18) & (r < 165) & (g < r * .82) & (b < r * .72)) | (rgb.max(-1) < 70)
    hair = brown & dilate(labels == 8, 10)
    body_kept = np.isin(labels, (3, 5, 7, 8)) & ~changed
    top_a = layers_alpha['shirt'] | layers_alpha['sleeves']
    zone = dilate(top_a, 14)
    whiteish = rgb.min(-1) >= 225  # white cloth; body art is never white
    cand = zone & ~bg & ~hair & (~body_kept | whiteish)
    # Skin: the builder's skin/shade test, narrowed by Lab hue (skin about
    # 55-62 deg; cream and ivory cloth 70-80 deg, which the RGB test lets
    # through in shade).
    hue = np.degrees(np.arctan2(LU[..., 2], LU[..., 1])); chroma = np.hypot(LU[..., 1], LU[..., 2])
    skin = skinish(rgb) & (hue < 68) & (chroma > 8)
    # ... and close to this sheet's own skin (forearms below the old cuff,
    # neck): pink-shaded white cloth passes the RGB test but not this.
    src = np.zeros(labels.shape, bool)
    for gg in geo.values():
        x0, y0, x1, y1 = gg['cell']
        for a in gg['arms']:
            src[a['cleanRow'] + 4:a['cleanRow'] + 30, x0:x1] = True
    src &= erode(labels == 3, 2) & skin
    wL = np.array([.35, 1.0, 1.0])
    centres = kmeans(LU[src] * wL, 5)
    d_skin = np.sqrt(((LU[..., None, :] * wL - centres[None, None]) ** 2).sum(-1)).min(-1)
    skin &= d_skin < 7
    # Skin-coloured paint inside the frozen top region counts as skin only
    # when it joins body skin outside it (a V neckline, a shorter sleeve);
    # an enclosed or hem-side patch of pale cloth is cloth.
    inside = skin & erode(top_a, 1)
    outside_seed = skin & ~dilate(top_a, 1)
    reach = connected(skin & dilate(top_a, 3), outside_seed & dilate(top_a, 3))
    skin = skin & ~(inside & ~reach)
    M = np.zeros(labels.shape, bool)
    for key, gg in geo.items():
        x0, y0, x1, y1 = gg['cell']
        cell = np.zeros(labels.shape, bool); cell[y0:y1, x0:x1] = True
        hem_b = int(np.median([hb for x, hb, st, armed in gg['hem']['columns']]))
        M |= cand & cell & ~skin
        M[hem_b - 30:y1, x0:x1] = False
        # Near and below the hem: top or the sheet's own shorts (clusters).
        shorts_src = erode(layers_alpha['shorts'] & cell, 4) & ~bg; shorts_src[:hem_b + 10] = False
        top_src = erode(top_a & cell, 6) & ~bg & ~skin & np.isin(labels, (1, 2)); top_src[hem_b - 12:] = False; top_src[:y0 + 1] = False
        cT, cB = kmeans(LU[top_src], 6), kmeans(LU[shorts_src], 4)
        low = cand & cell & ~skin; low[:hem_b - 30] = False
        L = LU[low]
        keep = np.zeros(labels.shape, bool); keep[low] = nearest(L, cT) < nearest(L, cB)
        M |= keep
    # The top's own outline (hem, cuff line) joins it, also where it lies on
    # an old line of the template's arm (the basic cuff's line); unchanged
    # neck, leg and head lines stay body.
    dark = LU[..., 0] < 62
    keep_body = body_kept & np.isin(labels, (5, 7, 8))
    for _ in range(2):
        M |= dark & dilate(M, 2) & zone & ~bg & ~hair & ~keep_body
    M &= ~small_islands(M, 20)
    M |= erode(dilate(M, 2), 2) & cand  # close probe holes (buttons, highlights) up to 4 px
    return M, dict(background=bg, hair=hair, changed=changed, body_kept=body_kept, skin=skin)
