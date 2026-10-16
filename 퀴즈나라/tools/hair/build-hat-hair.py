"""Hat pipeline: the hair of a style that a pulled-on hat cannot simply cut
(twin tails, a pony tied above the rim), as drawn by ChatGPT on the game's
own figures (tools/hair/make-hat-hair-base.cjs makes the first picture):
H1R twin, H2R pony (2026-10-16) without a cap, the whole scalp's hair with the
tails tied low, so every pulled-on hat's hide mask cuts it (the first H1·H2 were
drawn under a cap and left a gap under higher rims).

  python3 -B tools/hair/build-hat-hair.py SHEET --hair f:twin --base BASE_DIR --skin SKIN_DIR

BASE_DIR: make-hat-hair-base.cjs output for that hair (base.png, base.json); the ones the
returned sheets were drawn from are kept as tools/fixtures/hat-hair-base/<sex>-<hair>.png/.json
(copy them to DIR/base.png, DIR/base.json).
SKIN_DIR: measure-head-skin.cjs output (every hair in two skin tones).

Per view the sheet is scaled to the base and shifted onto it by the legs and
shorts (ChatGPT moved the profile figure). The hair is the brown pixels that
are not the cap, kept as luminance: the game tints it like its own heads
(avatar-pixel.js tonal). Pixels of the drawn cap that lie on the game's head
become dark hair (the game's cap may be a little smaller). The game's own
head painting keeps only that hair style's skin (face, ears, nape: the
pixels that change with the skin tone, holes filled), so its own tails are
gone. Writes assets/hat-art/hair/<sex>-<hair>-<view>.png (+ -keep.png) and
assets/hat-art/hair/hair.json; build-hat.py's write_runtime puts them in
avatar-hat-art.js (window.QPHatHair).
"""
import argparse
import importlib.util
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from avatar_build import matte as M  # noqa: E402

_spec = importlib.util.spec_from_file_location('build_hat', os.path.join(HERE, 'build-hat.py'))
BH = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(BH)

VIEWS = ('front', 'right', 'back')
LEGS = (36.0, 55.0)     # svg viewBox rows (of 62) that place a figure: shorts, legs, shoes
SHIFT = 70              # px searched each way
FEET = 6                # px searched round the feet's offset (align by_feet)
EYE_GROW = 1.8          # head units round the game's irises where nothing is hair (lashes, eye whites)
HAIR_LOW = 47.0         # svg rows: no hair below (the longest tail)
NECK = 28.6             # svg rows: below it only hair is kept (not the shirt, arms)
OPEN = 2                # px of the opening that drops drawn outlines
FACE_IN = 4             # px inside the game's face edge where nothing is hair
CAP_REACH = 6           # px above the drawn cap's lowest row a kept piece must reach below
MIN_PIECE = 300         # px of a kept hair piece
CAPLESS_PX = 500        # px of drawn cap colour under which the sheet has no cap (H1R·H2R)
KEEP_CLOSE = {'front': 20, 'right': 8, 'back': 0}  # px (at RES) the kept skin is closed over the eyes
UNDER_BAND = 10         # px beside the drawn hair where the drawn cap's place becomes hair
KEEP_PIECE = 1500        # px (at RES) of a kept skin piece: a face, an ear, the nape
BASE_HAIR = (0x5a, 0x3a, 0x24)  # the base figures' hair colour (hair ':1', avatar-pixel.js palette)
KEEP_GROW = 3           # px the kept skin grows (its outline)
RES = 20                # px per head-native unit of the keep mask
KEEP_RECT = (-8.0, -6.0, 48.0, 46.0)


def hsv(a):
    rgb = a.astype(np.float32) / 255; mx, mn = rgb.max(-1), rgb.min(-1); d = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-6), mx


def feet(a, x0, x1):
    """The lowest painted row in the figure's columns (its shoes' shadow)."""
    rows = np.nonzero((np.abs(a[:, x0:x1].astype(int) - 255).sum(-1) > 60).any(1))[0]
    return int(rows.max()) if len(rows) else None


def align(base, sheet, box, by_feet=False):
    """Shift (dx, dy) of the sheet's figure onto the base's: best match of the legs band.
    by_feet: dy is first taken from the feet and searched only FEET px round it (2026-10-16: the pony
    sheet's profile matched its legs band 71 px off, a long tail beside the legs)."""
    ppu = box['w'] / 32.0
    x0, x1 = int(box['x']), int(box['x'] + box['w'])
    y0, y1 = int(box['y'] + LEGS[0] * ppu), int(box['y'] + LEGS[1] * ppu)
    ref = base[y0:y1, x0:x1].astype(np.float32).mean(-1)
    best = None
    dys = range(-SHIFT, SHIFT + 1, 2)
    if by_feet:
        fb, fs = feet(base, x0, x1), feet(sheet, x0, x1)
        if fb is not None and fs is not None:
            dys = range(fs - fb - FEET, fs - fb + FEET + 1, 1)
    for dy in dys:
        for dx in range(-SHIFT, SHIFT + 1, 2):
            if y0 + dy < 0 or x0 + dx < 0 or y1 + dy > sheet.shape[0] or x1 + dx > sheet.shape[1]:
                continue
            cur = sheet[y0 + dy:y1 + dy, x0 + dx:x1 + dx].astype(np.float32).mean(-1)
            e = np.abs(cur - ref).mean()
            if best is None or e < best[0]:
                best = (e, dx, dy)
    e, dx, dy = best
    for ddy in (-1, 0, 1):  # refine to 1 px
        for ddx in (-1, 0, 1):
            cur = sheet[y0 + dy + ddy:y1 + dy + ddy, x0 + dx + ddx:x1 + dx + ddx].astype(np.float32).mean(-1)
            if cur.shape == ref.shape:
                e2 = np.abs(cur - ref).mean()
                if e2 < e:
                    e, best = e2, (e2, dx + ddx, dy + ddy)
    return best[1], best[2], float(best[0])


def to_head(box, t, px, py):
    ppu = box['w'] / 32.0
    return ((px - box['x']) / ppu - t[4]) / t[0], ((py - box['y']) / ppu - t[5]) / t[3]


def keep_mask(skin_dir, sex, hair, view, hf, extra=None):
    """This hair style's skin in head-native units (white = keep the game's painting). extra: a mask over
    the base figure (base.png px, with its box `extra_box`) also kept: the eyes' surround the drawing's hair
    leaves out (H1R·H2R 2026-10-16: without it the page showed through beside an eye)."""
    meta = json.load(open(os.path.join(skin_dir, 'skin.json')))
    shots = {s['sk']: s for s in meta['shots'] if s['sex'] == sex and s['view'] == view}
    a, b = (np.asarray(Image.open(os.path.join(skin_dir, shots[k]['file'])).convert('RGB')).astype(int) for k in meta['tones'])
    skin = np.abs(a - b).sum(-1) > 40
    box = shots[meta['tones'][0]]['boxes'][meta['hair'][sex].index(hair)]
    t = hf[sex][view]['frame']['toViewBox']; ppu = box['w'] / 32.0
    W, H = int(KEEP_RECT[2] * RES), int(KEEP_RECT[3] * RES)
    gx, gy = np.meshgrid((np.arange(W) + .5) / RES + KEEP_RECT[0], (np.arange(H) + .5) / RES + KEEP_RECT[1])
    px = np.round(box['x'] + (gx * t[0] + t[4]) * ppu).astype(int); py = np.round(box['y'] + (gy * t[3] + t[5]) * ppu).astype(int)
    ok = (px >= 0) & (py >= 0) & (px < skin.shape[1]) & (py < skin.shape[0]) & (py < box['y'] + NECK * ppu + 2 * ppu)
    m = np.zeros((H, W), bool); m[ok] = skin[py[ok], px[ok]]
    # opened, then big pieces only: a hair edge's anti-aliasing takes the skin tint too (strays round the cap)
    m = M.dilate(M.erode(m, 2), 2)
    lab_, comps = M.components(m)
    m = np.isin(lab_, [c['label'] for c in comps if c['size'] >= KEEP_PIECE])
    # the eyes, brows and mouth inside the face (closed first: lashes and the fringe open the eye holes)
    # (front and right only: at the back it would join the ears and nape over the hair between them)
    r = KEEP_CLOSE[view]
    m = M.erode(BH.fill_holes(M.dilate(m, r)), r) if r else BH.fill_holes(m)
    m = M.dilate(m, KEEP_GROW)
    if extra is not None:
        mask, ebox = extra; eppu = ebox['w'] / 32.0
        ex = np.round(ebox['x'] + (gx * t[0] + t[4]) * eppu).astype(int); ey = np.round(ebox['y'] + (gy * t[3] + t[5]) * eppu).astype(int)
        eok = (ex >= 0) & (ey >= 0) & (ex < mask.shape[1]) & (ey < mask.shape[0])
        m[eok] |= mask[ey[eok], ex[eok]]
    rgba = np.full((H, W, 4), 255, np.uint8); rgba[..., 3] = np.where(m, 255, 0)
    return rgba


def build(sheet, hair_id, base_dir, skin_dir, out_dir):
    sex, hair = hair_id.split(':')
    meta = json.load(open(os.path.join(base_dir, 'base.json')))
    base = np.asarray(Image.open(os.path.join(base_dir, 'base.png')).convert('RGB'))
    im = Image.open(sheet).convert('RGB')
    sc = base.shape[1] / im.width
    im = im.resize((base.shape[1], round(im.height * sc)), Image.LANCZOS)
    sh = np.full(base.shape, 255, np.uint8); hh = min(base.shape[0], im.height)
    sh[:hh] = np.asarray(im)[:hh]
    hf = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-frame.json')))
    os.makedirs(out_dir, exist_ok=True)
    rec, report, tiles = {}, {}, []
    bh, bs, bv = hsv(base)
    for view, box in zip(meta['views'], meta['boxes']):
        dx, dy, err = align(base, sh, box, by_feet=True)
        moved = np.full(base.shape, 255, np.uint8)
        ys0, ys1 = max(0, dy), min(base.shape[0], base.shape[0] + dy)
        xs0, xs1 = max(0, dx), min(base.shape[1], base.shape[1] + dx)
        moved[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx] = sh[ys0:ys1, xs0:xs1]
        ppu = box['w'] / 32.0
        X0, X1 = int(box['x']), int(box['x'] + box['w']); Y0 = max(0, int(box['y']))
        Y1 = min(base.shape[0], int(box['y'] + HAIR_LOW * ppu))
        u = moved[Y0:Y1, X0:X1]
        h, s, v = hsv(u)
        rows = (np.arange(Y0, Y1)[:, None] - box['y']) / ppu
        cap = (h > 65) & (h < 125) & (s > .3) & (rows < NECK)
        # a sheet drawn without a cap (H1R·H2R 2026-10-16: the whole scalp's hair, tails tied low) keeps all
        # its hair: the hat's own hide mask cuts it in the game, whatever the hat's rim height
        capless = cap.sum() < CAPLESS_PX
        if capless:
            cap[:] = False
        skinlike = (v > .74) & (s < .45)  # an ear's shaded skin is brownish too
        brown = (h > 4) & (h < 48) & (s > .28) & (v > .1) & (v < .86) & ~cap & ~skinlike
        # the drawn cap over the game's head (its hair and skull) is hair under our cap
        gh, gs, gv = bh[Y0:Y1, X0:X1], bs[Y0:Y1, X0:X1], bv[Y0:Y1, X0:X1]
        game_hair = (gh > 4) & (gh < 48) & (gs > .28) & (gv < .86)
        # only a band along the drawn hair: the drawn cap is bigger than ours, a wider fill showed round it
        under = M.dilate(cap, 2) & game_hair & (rows < NECK) & M.dilate(brown, UNDER_BAND)
        # the drawn outlines (shirt, arms, eyes, mouth) are brown too: thin lines are opened away, and
        # nothing inside the game's own face (filled skin, eyes and mouth) is hair
        face = (gv > .78) & (gs < .4) & ((gh < 50) | (gh > 330)) & (rows < NECK)
        lab_, comps = M.components(face)
        face = BH.fill_holes(np.isin(lab_, [c['label'] for c in comps if c['size'] >= 2000]))
        face = M.erode(face, FACE_IN)
        # and nothing round the game's own eyes (the drawing's lashes and eye whites were kept as hair and
        # drew over the game's eyes, H1R·H2R 2026-10-16): the base figure's iris, grown over lashes and brows
        bi = base[Y0:Y1, X0:X1].astype(int)
        # (the game's teal iris is dark: green and blue only 12 and 8 over red; at 25/15 an eye fell apart in bits)
        iris = (bi[..., 1] > bi[..., 0] + 12) & (bi[..., 2] > bi[..., 0] + 8) & (rows < NECK)
        lab_, comps = M.components(iris)
        iris = np.isin(lab_, [c['label'] for c in comps if c['size'] >= 100])
        eyes = M.dilate(iris, int(round(EYE_GROW * ppu))) if iris.any() else iris
        hairm = M.dilate(M.erode((brown | under) & ~face & ~eyes, OPEN), OPEN) & (brown | under)
        lab_, comps = M.components(hairm)
        # a piece that does not reach below the drawn cap is a stray strand round its crown
        low = np.nonzero(cap.any(1))[0].max() if cap.any() else hairm.shape[0]
        keep = [c['label'] for c in comps if c['size'] >= MIN_PIECE and (capless or np.nonzero((lab_ == c['label']).any(1))[0].max() > low - CAP_REACH)]
        hairm = np.isin(lab_, keep)
        lum = (u[..., 0] * .25 + u[..., 1] * .59 + u[..., 2] * .16)
        # the drawn hair is darker than the game's source heads: its luminance is matched (quantiles) to the
        # source luminance of the game's own hair in the base, undone from its tint (avatar-pixel.js tonal,
        # the base hair colour BASE_HAIR, green channel)
        g_out = base[Y0:Y1, X0:X1, 1].astype(np.float32)
        src = np.where(g_out <= BASE_HAIR[1] * 160 / 102, g_out * 102 / BASE_HAIR[1], (g_out + .38 * 160) / (BASE_HAIR[1] / 102 + .38))
        gsrc = src[game_hair]
        if gsrc.size > 500 and brown.any():
            q = np.linspace(0, 100, 101)
            lum = np.interp(lum, np.percentile(lum[brown], q), np.percentile(gsrc, q))
        dark = np.percentile(lum[brown], 20) if brown.any() else 40
        lum = np.where(under & ~brown, dark, lum)
        alpha = np.asarray(Image.fromarray((hairm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))).astype(np.float32)
        alpha = np.where(hairm, np.maximum(alpha, 200), alpha * .9)
        ys, xs = np.nonzero(alpha > 8)
        bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        L = np.clip(lum, 0, 255).astype(np.uint8)
        rgba = np.dstack([L, L, L, alpha.clip(0, 255).astype(np.uint8)])[bx[1]:bx[3], bx[0]:bx[2]]
        t = hf[sex][view]['frame']['toViewBox']
        hx0, hy0 = to_head(box, t, X0 + bx[0], Y0 + bx[1]); hx1, hy1 = to_head(box, t, X0 + bx[2], Y0 + bx[3])
        name = '%s-%s-%s' % (sex, hair, view)
        Image.fromarray(rgba).save(os.path.join(out_dir, name + '.png'), optimize=True)
        full = np.zeros(base.shape[:2], bool); full[Y0:Y1, X0:X1] = eyes
        Image.fromarray(keep_mask(skin_dir, sex, hair, view, hf, (full, box))).save(os.path.join(out_dir, name + '-keep.png'), optimize=True)
        rec[view] = dict(src='assets/hat-art/hair/%s.png' % name, rect=[round(hx0, 3), round(hy0, 3), round(hx1 - hx0, 3), round(hy1 - hy0, 3)],
                         keep=dict(src='assets/hat-art/hair/%s-keep.png' % name, rect=list(KEEP_RECT)))
        report[view] = dict(shift=[dx, dy], legsError=round(err, 2), hairPx=int(hairm.sum()), capless=bool(capless))
        prev = Image.new('RGBA', (rgba.shape[1], rgba.shape[0]), (230, 236, 244, 255)); prev.alpha_composite(Image.fromarray(rgba))
        tiles.append(prev.convert('RGB'))
    path = os.path.join(out_dir, 'hair.json')
    allrec = json.load(open(path)) if os.path.exists(path) else {}
    allrec.setdefault(sex, {})[hair] = rec
    json.dump(allrec, open(path, 'w'), ensure_ascii=False, indent=1)
    BH.write_runtime(os.path.join(ROOT, 'assets', 'hat-art'))
    w = sum(t.width for t in tiles) + 10 * len(tiles); hgt = max(t.height for t in tiles)
    sheet_im = Image.new('RGB', (w, hgt), 'white'); x = 0
    for t in tiles:
        sheet_im.paste(t, (x, 0)); x += t.width + 10
    return report, sheet_im


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--hair', required=True, help='sex:hair, e.g. f:twin')
    ap.add_argument('--base', required=True)
    ap.add_argument('--skin', required=True)
    ap.add_argument('--preview')
    a = ap.parse_args(argv)
    report, im = build(a.sheet, a.hair, a.base, a.skin, os.path.join(ROOT, 'assets', 'hat-art', 'hair'))
    if a.preview:
        im.save(a.preview)
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
