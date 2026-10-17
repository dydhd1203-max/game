"""Hair conversion H2: the 24 head paintings x front/profile/back as layers the
foundation draws itself (3단계-계획.txt 'hair', H2).

  node tools/hair/export-old-heads.cjs 검증/머리/옛머리        today's per-pixel decisions
  python3 -B tools/hair/build-heads.py build [--old DIR] [--out assets] [--check DIR] [--only f:twin,m:crop]
      writes assets/sd-hair-<sex>-<shape>.webp (lossless; one atlas of trimmed layers per
      style, hair as its brush luminance and shine),
      assets/sd-hair-data.js and assets/sd-hair-제작기록.md; --check DIR also writes
      the recomposition numbers and review boards (검증/, not committed)

`build` starts from today's decisions (avatar-pixel.js / avatar-direction.js, read
by export-old-heads.cjs), so every key shows the painting students see, and then:
ears (dyed with the hair today) and the back view's crown highlights (tinted as
skin) are classified again inside zone hints (heads-spec.json), ear rims and pale
face rims stop taking the dye, specks and the old neck stub are erased (solid hair
kept), profile faces are moved onto the reference face (f bob, m short). Layers
(hair, skin, fixed, iris, blink covers) are a partition of the source pixels at the
source resolution: drawn additively (premultiplied sum) they rebuild the painting.

Older step, front heads only (skull and hair tops for hats):
  python3 -B tools/hair/build-heads.py classify [--sexes m,f] [--out DIR]

Reads assets/sd-heads-<female|male>.png (4x3 cells of 362 px, order in
assets/sd-heads.json) and writes, per head, a class map:

  0 empty, 1 hair, 2 skin (face, ears, neck), 3 eye, 4 line (dark outline
  between classes, kept with the paint it bounds by the later steps)

and a contact sheet 검증/머리/분류-<sex>.png (not committed) to look at.
The classes feed the later H2 steps (skull frame and hat line, front/back
split, neck cut, skin remap); nothing here changes a runtime asset.

Method (per head, colour models from the head's own seeds, no hand-made
masks):
  - skin seeds: the cheeks and nose band between the eye line and the chin
    hint (assets/sd-heads.json), away from the eyes;
  - hair seeds: the top rows of the head's opaque bounds;
  - every opaque pixel goes to the closer Gaussian model in Lab
    (Mahalanobis), lines are the dark pixels both models explain badly;
  - skin is only skin when it is joined to the face seed or forms a large
    region of its own (an ear): cream highlights inside the hair stay hair;
  - eyes: non-skin pixels inside the eye aperture boxes of sd-heads.json.
Heads run in parallel (4 processes).
"""
import json
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402

ASSETS = os.path.join(ROOT, 'assets')
SEXES = {'f': 'female', 'm': 'male'}
CELL = 362
CLASSES = {0: 'empty', 1: 'hair', 2: 'skin', 3: 'eye', 4: 'line'}
COLOURS = {0: (235, 238, 244), 1: (150, 90, 50), 2: (250, 205, 180), 3: (40, 140, 150), 4: (40, 30, 30)}
ALPHA = 32
LINE_L = 42.0        # Lab L below which a pixel both models explain badly is a drawn line
EAR_MIN_PX = 120     # a skin region of its own (an ear) must be this large


def gauss(X):
    mu = X.mean(0)
    cov = np.cov(X.T) + np.eye(3) * 4.0
    inv = np.linalg.inv(cov)
    return mu, inv


def mahal(L, model):
    mu, inv = model
    d = L - mu
    return np.einsum('...i,ij,...j->...', d, inv, d)


def classify_head(args):
    sex, idx, head = args
    sheet = np.asarray(Image.open(os.path.join(ASSETS, 'sd-heads-%s.png' % SEXES[sex])).convert('RGBA')).astype(np.float32)
    x0, y0, w, h = head['sourceRect']
    cell = sheet[y0:y0 + h, x0:x0 + w]
    a = cell[..., 3]
    opaque = a > ALPHA
    lab = R.lab(cell[..., :3])
    (ex0, ey0), (ex1, ey1) = head['eyeCenters']
    eye_y = (ey0 + ey1) / 2
    chin_y = head['faceChinHint'][1]
    eye_dx = abs(ex1 - ex0)
    yy, xx = np.mgrid[0:h, 0:w]
    # skin seeds: below the eyes (clear of the lashes), above the chin, between the eye centres
    seed_skin = opaque & (yy > eye_y + .30 * (chin_y - eye_y)) & (yy < chin_y - 4) & \
        (np.abs(xx - (ex0 + ex1) / 2) < .55 * eye_dx)
    ob = head['opaqueBounds']
    top = ob[1]
    seed_hair = opaque & (yy < top + .18 * (eye_y - top)) & (xx > ob[0] + 8) & (xx < ob[2] - 8)
    if seed_skin.sum() < 50 or seed_hair.sum() < 50:
        raise ValueError('%s %s: too few seeds (skin %d, hair %d)' % (sex, head['id'], seed_skin.sum(), seed_hair.sum()))
    ms, mh = gauss(lab[seed_skin]), gauss(lab[seed_hair])
    ds, dh = mahal(lab, ms), mahal(lab, mh)
    cls = np.zeros((h, w), np.uint8)
    skinlike = opaque & (ds < dh)
    cls[opaque] = 1
    # skin joined to the face seed, or a large skin region of its own (an ear)
    face = M.connected_to(skinlike, seed_skin & skinlike)
    lab_, comps = M.components(skinlike & ~face)
    ears = np.zeros_like(face)
    for c in comps:
        if c['size'] >= EAR_MIN_PX:
            ears |= lab_ == c['label']
    skin = face | ears
    cls[skin] = 2
    # eyes: non-skin pixels in the aperture boxes
    for bx0, by0, bx1, by1 in head['eyeApertureBounds']:
        box = np.zeros_like(skin)
        box[int(by0):int(by1), int(bx0):int(bx1)] = True
        cls[box & opaque & ~skin] = 3
    # lines: dark pixels neither model explains well (outline between classes)
    line = opaque & (lab[..., 0] < LINE_L) & (np.minimum(ds, dh) > 12.0) & (cls != 3)
    cls[line] = 4
    counts = {CLASSES[k]: int((cls == k).sum()) for k in CLASSES}
    return sex, idx, head['id'], cls, counts


G = 384  # avatar-pixel.js HEAD_GRID: the runtime resamples each 362 px cell to 384


EYE_UNITS = {'f': 7.40, 'm': 9.32}  # avatar-pixel.js loadSheet: the default head's eye gap (f bob, m short), units
FIT_HALF = 17.0  # ... and the half width hair may reach from the face centre (clip frame x -1..33)


def head_native(head, cls=None):
    """The runtime placement of a front head painting (avatar-pixel.js
    loadSheet, 2026-10-15: one eye gap per sex, hair past x -1..33 shrinks
    the head to fit): head-native units (32 wide, eye midpoint x 16, chin y
    28) of cell pixel (x, y) are (x * k + ox, y * k + oy). Returns (k, ox, oy).
    `cls` is unused (kept for callers)."""
    sex = 'm' if head.get('sex') == 'm' else 'f'
    (ex0, ey0), (ex1, ey1) = head['eyeCenters']
    mid = (ex0 + ex1) / 2
    ob = head['opaqueBounds']
    k = min(EYE_UNITS[sex] / abs(ex1 - ex0), FIT_HALF / max(1, mid - ob[0]), FIT_HALF / max(1, ob[2] - mid))
    return k, 16 - mid * k, 28 - head['faceChinHint'][1] * k


def skull(sexes, out_dir, unit=12):
    """Every head of a sex in head-native units on one canvas: hair outline
    (thin brown), face and ears (filled pale), so the skull that all hair
    styles share can be read off (검증/머리/두상-<sex>.png)."""
    meta = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames']
    for s in sexes:
        W, H = 34 * unit, 42 * unit
        acc_face = np.zeros((H, W), np.float32)
        tops = []
        for hd in meta[SEXES[s]]['heads']:
            cls = np.asarray(Image.open(os.path.join(out_dir, '분류-%s-%s.png' % (s, hd['id']))))
            k, ox, oy = head_native(dict(hd, sex=s), cls)
            ys, xs = np.nonzero(cls > 0)
            u = ((xs * k + ox + 1) * unit).astype(int); v = ((ys * k + oy + 2) * unit).astype(int)
            ok = (u >= 0) & (u < W) & (v >= 0) & (v < H)
            m = np.zeros((H, W), bool); m[v[ok], u[ok]] = True
            f = np.zeros((H, W), bool); sk = cls[ys, xs] == 2
            f[v[ok & sk], u[ok & sk]] = True
            acc_face += f
            top = ys.min() * k + oy
            tops.append((hd['id'], round(float(top), 2), round(float(k), 4)))
        img = np.full((H, W, 3), 255, np.uint8)
        a = acc_face / len(meta[SEXES[s]]['heads'])
        img[a > 0] = (255 - (a[a > 0, None] * np.array([5, 80, 120])).astype(np.uint8))
        im = Image.fromarray(img)
        d = ImageDraw.Draw(im)
        for gy in range(0, 42, 2):
            d.line([(0, gy * unit), (W, gy * unit)], fill=(225, 225, 235))
            d.text((2, gy * unit), str(gy - 2), fill=(120, 120, 140))
        im.save(os.path.join(out_dir, '두상-%s.png' % s))
        print(s, sorted(tops, key=lambda t: t[1]))


SKULL = {  # front skull per sex in head-native units (centre x, centre y, rx, ry), 2026-10-15 at the fixed face size:
    # top 0.5-0.6 under the flattest hair (f twin 6.97, m crop 1.2), bottom at the chin (y 28), width from the
    # cheeks at the eye line (f face half width ~8.6; m ears at x 3.8..28.1, face ~10.5) plus the hair's root
    'm': (16.0, 14.9, 11.5, 13.1),
    'f': (16.0, 17.75, 9.4, 10.25),
}


def tops(sexes, out_dir, step=.5):
    """Per head the hair's top edge y(x) in head-native units (x 0..32 by
    `step`; None where the head has no paint) and its gap above the skull,
    for seating decorations on the hair (검증/머리/윗선.json, 윗선-<sex>.png)."""
    meta = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames']
    res = {}
    for s in sexes:
        cx, cy, rx, ry = SKULL[s]
        unit = 14
        W, H = 34 * unit, 34 * unit
        im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
        d.ellipse([(cx - rx + 1) * unit, (cy - ry + 2) * unit, (cx + rx + 1) * unit, (cy + ry + 2) * unit], outline=(220, 60, 60), width=2)
        for hd in meta[SEXES[s]]['heads']:
            cls = np.asarray(Image.open(os.path.join(out_dir, '분류-%s-%s.png' % (s, hd['id']))))
            k, ox, oy = head_native(dict(hd, sex=s), cls)
            ys, xs = np.nonzero(cls > 0)
            U = xs * k + ox; V = ys * k + oy
            xsn = np.arange(0, 32 + 1e-6, step)
            top = []
            for x in xsn:
                m = np.abs(U - x) < step / 2
                top.append(round(float(V[m].min()), 2) if m.any() else None)
            res['%s:%s' % (s, hd['id'])] = dict(k=round(k, 5), ox=round(ox, 3), oy=round(oy, 3), x=[float(v) for v in xsn], top=top)
            pts = [((x + 1) * unit, (t + 2) * unit) for x, t in zip(xsn, top) if t is not None]
            d.line(pts, fill=(120, 80, 40), width=1)
        for gy in range(0, 32, 2):
            d.text((2, (gy + 2) * unit), str(gy), fill=(150, 150, 170))
        im.save(os.path.join(out_dir, '윗선-%s.png' % s))
    json.dump(res, open(os.path.join(out_dir, '윗선.json'), 'w'))
    return res


def contact(sex, results, out):
    cols, size = 6, 181
    rows = (len(results) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * size * 2, rows * (size + 18)), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    src = Image.open(os.path.join(ASSETS, 'sd-heads-%s.png' % SEXES[sex])).convert('RGBA')
    heads = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames'][SEXES[sex]]['heads']
    for n, (idx, hid, cls, counts) in enumerate(results):
        x0, y0, w, h = heads[idx]['sourceRect']
        bg = Image.new('RGBA', (w, h), (235, 238, 244, 255))
        bg.alpha_composite(src.crop((x0, y0, x0 + w, y0 + h)))
        col = np.zeros((h, w, 3), np.uint8)
        for k, c in COLOURS.items():
            col[cls == k] = c
        cx, cy = (n % cols) * size * 2, (n // cols) * (size + 18)
        sheet.paste(bg.convert('RGB').resize((size, size)), (cx, cy))
        sheet.paste(Image.fromarray(col).resize((size, size), Image.NEAREST), (cx + size, cy))
        d.text((cx + 4, cy + size + 2), '%s  skin %d  hair %d' % (hid, counts['skin'], counts['hair']), fill=(0, 0, 0))
    sheet.save(out)
    return out


def classify(sexes, out_dir):
    meta = json.load(open(os.path.join(ASSETS, 'sd-heads.json')))['frames']
    jobs = [(s, i, hd) for s in sexes for i, hd in enumerate(meta[SEXES[s]]['heads'])]
    with Pool(4) as pool:
        res = pool.map(classify_head, jobs)
    os.makedirs(out_dir, exist_ok=True)
    summary = {}
    for s in sexes:
        rs = [(i, hid, cls, c) for (ss, i, hid, cls, c) in res if ss == s]
        rs.sort(key=lambda r: r[0])
        for i, hid, cls, c in rs:
            Image.fromarray(cls).save(os.path.join(out_dir, '분류-%s-%s.png' % (s, hid)))
            summary['%s:%s' % (s, hid)] = c
        print('wrote', contact(s, rs, os.path.join(out_dir, '분류-%s.png' % s)))
    json.dump(summary, open(os.path.join(out_dir, '분류.json'), 'w'), ensure_ascii=False, indent=1)
    return summary


# ---------------------------------------------------------------------------
# build (H2)
# ---------------------------------------------------------------------------
import hashlib  # noqa: E402
import headlib as HL  # noqa: E402

SPEC = os.path.join(HERE, 'heads-spec.json')
# today's renderer: shapes without a painting show another (avatar-pixel.js aliases / hairTile, avatar-direction.js metadata)
ALIASES = {'f': {'crop': 'short', 'buzz': 'short', 'longm': 'long', 'wave': 'long', 'afro': 'curly', 'mohawk': 'spiky'},
           'm': {'buzz': 'crop', 'long': 'wolf', 'longm': 'wolf', 'wave': 'curlm', 'afro': 'curlm', 'mohawk': 'spiky'}}
BODY_SKIN = ['sd-foundation-ref-neck-clean.png', 'sd-foundation-ref-arms-clean.png']
LAYERS = ('hair', 'skin', 'fixed', 'iris')
GAP = 2


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


SKIN_BINS = range(195, 235, 5)   # light skin, where a face is mostly painted (blush and folds lie below)


def bin_medians(px):
    L = HL.lum_skin(px)
    out = {}
    for lo in SKIN_BINS:
        k = (L >= lo) & (L < lo + 5)
        if k.sum() >= 50:
            out[lo] = (np.median(px[k], axis=0), int(k.sum()))
    return out


def body_skin_bins():
    """The sheet's light skin per luminance bin: the paint toneMatrix was built on."""
    acc = []
    for f in BODY_SKIN:
        im = np.asarray(Image.open(os.path.join(ASSETS, f)).convert('RGBA')).astype(np.float64)
        px = im[im[..., 3] > 250][:, :3]
        acc.append(px[(px[:, 1] > .7 * px[:, 0]) & (px[:, 2] > .78 * px[:, 1]) & (px[:, 0] > 150)])
    return bin_medians(np.concatenate(acc))


def trim(img, at=(0, 0)):
    ys, xs = np.nonzero(img[..., 3] > 0)
    if not len(xs):
        return None
    x0, y0 = max(0, xs.min() - 1), max(0, ys.min() - 1)
    x1, y1 = min(img.shape[1], xs.max() + 2), min(img.shape[0], ys.max() + 2)
    return img[y0:y1, x0:x1], (at[0] + int(x0), at[1] + int(y0))


def convert_head(job):
    """One head view: classes, layers (straight RGBA uint8 at the source resolution) and its record."""
    head, spec, reg = job
    src = HL.read_rgba(head['srcFile'])
    clsr = HL.read_rgba(head['clsFile'])
    c, erase, rep, stubble, pre = HL.refine(head, src, clsr, spec, reg)
    keep = src[..., 3].copy()
    if head['view'] == 'front':      # today's jaw channel (the neck skin runs into the chin), inside the neck column only
        s, ox, oy = HL.placement(head)
        polys, to_px = HL.jaw_channel(head)
        fx = lambda x, y: ((to_px(x, y)[0] - ox) / s, (to_px(x, y)[1] - oy) / s)
        jawcut = HL.fill_mask(polys, (src.shape[1], src.shape[0]), fx)
        keep *= 1 - jawcut * HL.poly_mask(spec['neckColumn'][head['sex']], head, c.shape)
    keep[erase] = 0
    # split against the classes before the stub was erased (a strand's edge mixed with the old neck keeps only
    # its hair share), then drop the skin share beside erased paint (it would be a rim of the old neck)
    share, hrgb, srgb, band = HL.unmix(src, pre, HL.feature_core(head, c.shape), stubble=stubble)
    band &= (c == HL.HAIR) | (c == HL.SKIN)
    from avatar_build import matte as M_
    near_erased = M_.dilate(erase, 2) & ~erase
    rep['unmixed'] = int(band.sum())
    old_c = clsr[..., 0].astype(np.uint8)
    changed = ((c != old_c) & (c != HL.IRIS)) | erase | band
    if head['view'] == 'front':
        changed |= jawcut > 0       # today's wider cut: what it erased beside the neck is back
    layers = {}
    for name, k in (('hair', HL.HAIR), ('skin', HL.SKIN), ('fixed', HL.FIXED), ('iris', HL.IRIS)):
        img = src.copy()
        img[..., 3] = np.where(c == k, keep, 0)
        if name == 'hair':
            img[..., :3] = hrgb
            img[..., 3] = np.where(band, keep * share, img[..., 3])
        elif name == 'skin':
            img[..., :3] = np.where(band[..., None], srgb, img[..., :3])
            img[..., 3] = np.where(band, np.where(near_erased & (c == HL.HAIR), 0, keep * (1 - share)), img[..., 3])
        img[img[..., 3] < .5, :3] = 0
        layers[name] = img
    covers = {}
    if head['view'] == 'front':
        for k in head.get('patches', []):
            covers['blink-' + k] = HL.read_rgba(os.path.join(os.path.dirname(head['srcFile']), '%s-eye-%s.png' % (head['base'], k)))
    elif head['view'] == 'profile':
        covers['blink'] = HL.read_rgba(head['patchSrcFile'])
    for k, img in covers.items():
        img[img[..., 3] == 0, :3] = 0
        layers[k] = img
    out = {}
    for k, img in layers.items():
        t = trim(np.clip(np.round(img), 0, 255).astype(np.uint8))
        if t:
            out[k] = t
    rep['probes'] = probes(head, src, clsr, c, keep, spec, reg, share)
    if head['view'] == 'front':      # the face's lower edge (jaw, chin) in head units, for the front split
        U, V = HL.units_of(head, c.shape)
        face = (c == HL.SKIN) & ((clsr[..., 1].astype(int) & 1) > 0)
        jaw = []
        for x in np.arange(8, 24.01, .25):
            m = face & (np.abs(U - x) < .125)
            if m.any():
                jaw.append([round(float(x), 2), round(float(V[m].max()), 3)])
        rep['jaw'] = jaw
    return head['base'], changed, out, rep


# Probes for the defects this conversion fixes, measured on today's decisions too (they must
# catch today's defects and read 0 on the result; 아바타-제작기준.md '머리 층 변환'):
#   earDyed   skin-coloured paint (g/r >= .68, b/g >= .80, L >= 150) in an ear zone taking the hair dye
#   crownSkin back view: skin outside the ear/nape (and skinZones) places, i.e. hair highlights tinted as skin
#   stub      paint left under the jaw in the body's neck column (front, not hair) or the neck's skin and
#             its rim in the stub zone (profile, back; any alpha, hair-coloured edge pixels away from a
#             broad strand included: they showed as a dotted neck outline): the old neck stub
#   paleRim   light paint (L >= 150) on the face edge, outside the eyes and mouth, that keeps its paint or
#             takes the dye whole: a pale dotted rim on a dark skin or a dyed hair
PROBE_LIMITS = {'earDyed': 12, 'crownSkin': 0, 'stub': 0, 'paleRim': 40}   # earDyed: a few hair-tip specks may match


def probes(head, src, clsr, c, keep, spec, reg, share):
    from avatar_build import matte as M
    view, sex = head['view'], head['sex']
    rgb, a = src[..., :3], src[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = HL.lum_skin(rgb)
    old = clsr[..., 0].astype(np.uint8)
    bits = clsr[..., 1].astype(int)
    shape = old.shape
    z = spec['zones'][sex][view]
    ear = HL.poly_mask(z.get('ear', []), head, shape, reg)
    out = {}
    skinlike = (a > 128) & (g >= .68 * r) & (b >= .80 * g) & (L >= 150) & ear
    out['earDyed'] = [int((skinlike & (old == HL.HAIR)).sum()), int((skinlike & (c == HL.HAIR) & (keep > 128)).sum())]
    if view == 'back':
        allowed = ear | HL.poly_mask(z.get('nape', []), head, shape, reg) | HL.poly_mask(
            spec.get('skinZones', {}).get('%s:%s' % (sex, head['shape']), {}).get(view, []), head, shape, reg)
        out['crownSkin'] = [int(((old == HL.SKIN) & (a > 128) & ~allowed).sum()), int(((c == HL.SKIN) & (keep > 128) & ~allowed).sum())]
    if view == 'front':
        U, V = HL.units_of(head, shape, reg)
        face = (old == HL.SKIN) & ((bits & 1) > 0)
        cols = np.where(face.any(0), shape[0] - 1 - np.argmax(face[::-1], 0), -1)
        jawv = np.where(cols >= 0, V[np.clip(cols, 0, shape[0] - 1), np.arange(shape[1])], np.inf)
        zone = HL.poly_mask(spec['neckColumn'][sex], head, shape, reg) & (V > jawv[None, :] + .5)
        s_, ox, oy = HL.placement(head)
        polys, to_px = HL.jaw_channel(head)
        oldkeep = a * (1 - HL.fill_mask(polys, (shape[1], shape[0]), lambda x, y: ((to_px(x, y)[0] - ox) / s_, (to_px(x, y)[1] - oy) / s_)))
    else:
        zone = HL.poly_mask(spec['stub'][sex].get(view, []), head, shape)
        oldkeep = a.copy()
        if head.get('neckCut'):
            oldkeep[HL.poly_mask(HL.path_polygons(head['neckCut']), head, shape)] = 0
    if view == 'front':
        out['stub'] = [int((zone & (oldkeep > 128) & (old != HL.HAIR)).sum()), int((zone & (keep > 128) & (c != HL.HAIR)).sum())]
    else:       # the neck's skin and the rim within 4 px of it (hair strokes hanging there are hair's)
        neck = zone & (old == HL.SKIN) & (a > 0)
        rim = zone & M.dilate(neck, 4)
        solid = HL.opening(c == HL.HAIR, 3)
        loose = (c == HL.SKIN) | (((c == HL.FIXED) | (c == HL.HAIR)) & ~M.dilate(solid, 2))
        old_loose = (old == HL.SKIN) | (((old == HL.FIXED) | (old == HL.HAIR)) & ~M.dilate(HL.opening(old == HL.HAIR, 3), 2))
        out['stub'] = [int((rim & (oldkeep > 8) & old_loose).sum()),
                       int((rim & (keep > 8) & loose).sum())]
    if view != 'back':
        near = M.dilate((bits & 1) > 0, 2) & ~HL.feature_core(head, shape)
        light = (a > 128) & (L >= 150)
        out['paleRim'] = [int((near & light & ((old == HL.FIXED) | (old == HL.HAIR))).sum()),
                          int((near & light & (keep > 128) & ((c == HL.FIXED) | ((c == HL.HAIR) & (share > .9)))).sum())]
    return out


def skin_shift(results, heads, body):
    """Per sex/view: the sheet's light skin minus the heads' at the same luminance, weighted by
    the heads' pixels (one constant, so blush and folds keep their colour)."""
    acc = {}
    for h in heads:
        base = h['base']
        if base not in results or 'skin' not in results[base][1]:
            continue
        img, _ = results[base][1]['skin']
        acc.setdefault((h['sex'], h['view']), []).append(img[img[..., 3] > 250][:, :3].astype(np.float64))
    out = {}
    for k, v in acc.items():
        head = bin_medians(np.concatenate(v))
        both = [lo for lo in head if lo in body]
        w = np.array([head[lo][1] for lo in both], np.float64)
        out[k] = (np.sum([(body[lo][0] - head[lo][0]) * head[lo][1] for lo in both], axis=0) / w.sum()) if w.sum() >= 500 else np.zeros(3)
    return out


def shift_skin(img, d):
    out = img.astype(np.float64)
    m = out[..., 3] > 0
    out[m, :3] = np.clip(np.round(out[m, :3] + d), 0, 255)
    return out.astype(np.uint8)


def pack(layers, width=1024):
    """Shelf packing of trimmed layers: {key: (x, y)}, (W, H)."""
    items = sorted(layers.items(), key=lambda kv: (-kv[1].shape[0], kv[0]))
    x = y = row = 0
    pos = {}
    W = width
    for k, img in items:
        h, w = img.shape[:2]
        if x + w + GAP > W:
            x, y, row = 0, y + row + GAP, 0
        pos[k] = (x + GAP, y + GAP)
        x += w + GAP
        row = max(row, h)
    return pos, (W, y + row + 2 * GAP)


def build(old_dir, out_dir, check_dir=None, only=None):
    meta = HL.load_old(old_dir)
    spec = json.load(open(SPEC))
    heads = meta['heads']
    if only:      # a trial on some styles (and the reference ones; skin shifts from these only)
        refs = {'%s:%s' % (s_, spec['reference'][s_]) for s_ in 'mf'}
        keep = set(only) | refs
        heads = [h for h in heads if '%s:%s' % (h['sex'], h['shape']) in keep]
        meta = dict(meta, heads=heads)
    for h in heads:
        f = os.path.join(old_dir, h['base'] + '-patchSrc.png')
        if os.path.exists(f):
            h['patchSrcFile'] = f
    # profile registration onto the reference face
    lms = {}
    for h in heads:
        if h['view'] == 'profile':
            lms[h['base']] = HL.profile_landmarks(h, HL.read_rgba(h['clsFile']))
    regs = {}
    for h in heads:
        if h['view'] == 'profile':
            ref = lms['%s-%s-profile' % (h['sex'], spec['reference'][h['sex']])]
            regs[h['base']] = HL.registration(lms[h['base']], ref)
        else:
            regs[h['base']] = (0., 0.)
    with Pool(4) as pool:
        res = pool.map(convert_head, [(h, spec, regs[h['base']]) for h in heads])
    results = {base: (c, layers, rep) for base, c, layers, rep in res}
    shifts = skin_shift(results, heads, body_skin_bins())
    worst, fails = {}, []
    for base, (_, _, rep) in sorted(results.items()):
        for k, (o, n) in rep['probes'].items():
            w = worst.setdefault(k, {'old': 0, 'new': 0, 'oldHeads': 0, 'worst': ''})
            w['old'] += o
            w['oldHeads'] += o > PROBE_LIMITS[k]
            if n > w['new']:
                w['new'], w['worst'] = n, base
            if n > PROBE_LIMITS[k]:
                fails.append('%s %s %d (limit %d)' % (base, k, n, PROBE_LIMITS[k]))
    for k, w in worst.items():
        print('probe %-9s today %6d px in %2d heads | converted max %d %s' % (k, w['old'], w['oldHeads'], w['new'], w['worst']))
    if fails:
        raise SystemExit('probe failures:\n  ' + '\n  '.join(fails))
    styles = {}
    for h in heads:
        styles.setdefault((h['sex'], h['shape']), []).append(h)
    data = {'version': 1, 'about': 'Generated by tools/hair/build-heads.py build (H2); do not edit.',
            'reference': spec['reference'], 'units': 'head-native: front eye midpoint x 16, chin y 28; layer rect [ax, ay, w, h] in the atlas, placed at [ux, uy, uw, uh] head units',
            'composite': 'layers partition the painting: draw them additively (premultiplied sum, e.g. mix-blend-mode: plus-lighter in an isolated group); hair is dyed from its brush luminance (avatar-pixel.js tonal), skin is tinted like the body (QPFoundationSkin.toneMatrix), fixed/iris keep their paint (iris recoloured for sparkle/cat), blink-* cover the open eye when blinking',
            'aliases': ALIASES, 'sources': {}, 'skinShift': {}, 'styles': {}}
    for sx in ('female', 'male'):
        for kind in ('', '-profile', '-back'):
            f = 'sd-heads%s-%s.png' % (kind, sx)
            data['sources'][f] = sha(os.path.join(ASSETS, f))
    for (sex, view), d in sorted(shifts.items()):
        data['skinShift']['%s-%s' % (sex, view)] = [round(float(v), 2) for v in d]
    os.makedirs(out_dir, exist_ok=True)
    order = {'front': 0, 'profile': 1, 'back': 2}
    for (sex, shape), hs in sorted(styles.items(), key=lambda kv: (kv[0][0], kv[1][0]['tile'])):
        flat = {}
        for h in hs:
            for k, (img, at) in results[h['base']][1].items():
                if k == 'skin' or k.startswith('blink'):
                    img = shift_skin(img, shifts.get((sex, h['view']), np.zeros(3)))
                if k == 'hair':     # the dye reads only the brush luminance (avatar-pixel.js tonal): R = B = L, G = its shine
                    img = img.copy()
                    rgb = img[..., :3].astype(np.float64)
                    lum = np.clip(np.round(rgb[..., 0] * .25 + rgb[..., 1] * .59 + rgb[..., 2] * .16), 0, 255)
                    img[..., 0] = img[..., 2] = lum.astype(np.uint8)
                    img[..., 1] = np.round(np.maximum(0, lum - 160) * .38).astype(np.uint8)
                flat[(h['view'], k)] = (img, at)
        pos, (W, H) = pack({k: v[0] for k, v in flat.items()})
        atlas = np.zeros((H, W, 4), np.uint8)
        for k, (img, at) in flat.items():
            x, y = pos[k]
            atlas[y:y + img.shape[0], x:x + img.shape[1]] = img
        name = 'sd-hair-%s-%s.webp' % (sex, shape)
        path = os.path.join(out_dir, name)
        Image.fromarray(atlas).save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        entry = {'sex': sex, 'shape': shape, 'tile': hs[0]['tile'], 'file': 'assets/' + name, 'sha256': sha(path), 'size': [W, H], 'views': {}}
        for h in sorted(hs, key=lambda h: order[h['view']]):
            s, ox, oy = HL.placement(h, regs[h['base']])
            f = h['frame']
            k_ = s / HL.PX
            ux0, uy0 = ox / HL.PX + f['x'], oy / HL.PX + f['y']
            rep = dict(results[h['base']][2])
            v = {'k': round(k_, 6), 'origin': [round(ux0, 4), round(uy0, 4)], 'registration': list(regs[h['base']]), 'layers': {}}
            if 'jaw' in rep:
                v['jaw'] = rep.pop('jaw')
            v['report'] = rep
            for (view, lk), (img, at) in sorted(flat.items()):
                if view != h['view']:
                    continue
                x, y = pos[(view, lk)]
                hh, ww = img.shape[:2]
                v['layers'][lk] = [x, y, ww, hh, round(ux0 + at[0] * k_, 4), round(uy0 + at[1] * k_, 4), round(ww * k_, 4), round(hh * k_, 4)]
            if 'skin' in v['layers']:   # the face's own light skin paint (expression patches are filled with it)
                ax, ay, w, hh = v['layers']['skin'][:4]
                px = atlas[ay:ay + hh, ax:ax + w].reshape(-1, 4)
                px = px[px[:, 3] > 250][:, :3].astype(np.float64)
                px = px[HL.lum_skin(px) >= 200]
                if len(px):
                    v['faceTone'] = '#%02x%02x%02x' % tuple(int(round(c_)) for c_ in np.median(px, axis=0))
            if h['view'] == 'front':
                v['eyes'] = [[round((e['x'] * h['geometry']['scale'] + h['geometry']['x']) / HL.PX, 3), round((e['y'] * h['geometry']['scale'] + h['geometry']['y']) / HL.PX, 3)] for e in h['eyes']]
            if h['view'] == 'profile':
                lm = lms[h['base']]
                dx, dy = regs[h['base']]
                v['landmarks'] = {kk: [round(p[0] + dx, 3), round(p[1] + dy, 3)] for kk, p in lm.items()}
                v['eyeWidth'] = round(h['eyeWidth'], 4)
            entry['views'][h['view']] = v
        data['styles']['%s:%s' % (sex, shape)] = entry
    js = '// Generated by tools/hair/build-heads.py build (stage 3, H2). Do not edit.\n' \
         'window.QPHairData=' + json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + ';\n'
    open(os.path.join(out_dir, 'sd-hair-data.js'), 'w').write(js)
    total = sum(e['size'][0] * 0 + os.path.getsize(os.path.join(out_dir, os.path.basename(e['file']))) for e in data['styles'].values())
    print('wrote %d atlases (%.1f KB total, max %.1f KB) and sd-hair-data.js' % (
        len(data['styles']), total / 1024, max(os.path.getsize(os.path.join(out_dir, os.path.basename(e['file']))) for e in data['styles'].values()) / 1024))
    if check_dir:
        check(meta, data, out_dir, check_dir, {b: r_[0] for b, r_ in results.items()})
    return data


def tone_matrix(skin):
    """avatar-foundation-skin.js toneMatrix(): the body's sRGB colour matrix for a skin tone."""
    pm = np.array([252., 217., 196.])
    fl, w = 223.8, .6
    sk = HL.hexrgb(skin) / 255.
    med = .22 * pm[0] + .59 * pm[1] + .19 * pm[2]
    M_ = np.zeros((3, 3))
    for c_ in range(3):
        lum = sk[c_] * 255 / fl * (1 - w)
        own = sk[c_] * 255 / pm[c_] * med / fl * w
        M_[c_] = [.22 * lum, .59 * lum, .19 * lum]
        M_[c_, c_] += own
    return M_


def render_view(atlas, head, v, hair, skin, mode='old', layers=LAYERS):
    """A converted view in its head frame: layers recoloured, placed and summed (premultiplied).
    mode 'old': today's head skin formula (to compare with today's painting); 'body': toneMatrix."""
    W, H = HL.frame_size(head['frame'])
    acc = np.zeros((H, W, 4))
    reg = tuple(v['registration'])
    for lk in layers:
        if lk not in v['layers']:
            continue
        ax, ay, w, h, ux, uy, uw, uh = v['layers'][lk]
        img = atlas[ay:ay + h, ax:ax + w].astype(np.float64)
        rgb = img[..., :3].reshape(-1, 3)
        if lk == 'hair':      # R: brush luminance, G: its shine (the runtime filter: dye x R / 102 + G)
            rgb = np.clip(np.round(HL.hexrgb(hair)[None, :] * rgb[:, :1] / 102. + rgb[:, 1:2]), 0, 255)
        elif lk == 'skin' or lk.startswith('blink'):
            rgb = HL.skin_tint(rgb, HL.hexrgb(skin)) if mode == 'old' else np.clip(rgb @ tone_matrix(skin).T, 0, 255)
        img[..., :3] = rgb.reshape(h, w, 3)
        at = ((ux - v['origin'][0]) / v['k'], (uy - v['origin'][1]) / v['k'])
        p = HL.place(img, head, reg=reg, at=(round(at[0]), round(at[1])))
        a = p[..., 3:4] / 255.
        acc[..., :3] += p[..., :3] * a
        acc[..., 3:4] += a
    a = np.clip(acc[..., 3:4], 0, 1)
    rgb = np.where(a > 0, acc[..., :3] / np.maximum(acc[..., 3:4], 1e-9), 0)
    return np.concatenate([rgb, a * 255.], axis=2)


def old_registered(head, hair, skin, reg):
    src, cls = HL.read_rgba(head['srcFile']), HL.read_rgba(head['clsFile'])[..., 0].astype(np.uint8)
    img = HL.place(HL.recolour(src, cls, hair, skin), head, reg=reg)
    if head['view'] == 'front':
        return HL.erase(img, HL.neck_cut_mask(head))
    if head.get('neckCut'):     # today's hand-traced cuts (m short, f bob), moved with the face
        f = head['frame']
        size = HL.frame_size(f)
        cover = HL.fill_mask(HL.path_polygons(head['neckCut']), size, lambda x, y: ((x + reg[0] - f['x']) * HL.PX, (y + reg[1] - f['y']) * HL.PX))
        return HL.erase(img, cover)
    return img


def check_head(job):
    h, e, v, out_dir, hair, skin, changed = job
    atlas = np.asarray(Image.open(os.path.join(out_dir, os.path.basename(e['file']))).convert('RGBA'))
    new = render_view(atlas, h, v, hair, skin)
    old = old_registered(h, hair, skin, tuple(v['registration']))
    ch = np.zeros(changed.shape + (4,))
    ch[..., 3] = changed * 255.
    chp = HL.place(ch, h, reg=tuple(v['registration']))[..., 3] > 1
    da, db = HL.on_colour(new, (30, 40, 90)), HL.on_colour(old, (30, 40, 90))
    m = ((new[..., 3] > 3) | (old[..., 3] > 3))
    diff = np.abs(da - db).max(axis=2)
    same = diff[m & ~chp]
    rep = {'meanDE': round(float(same.mean()), 2), 'p995': round(float(np.percentile(same, 99.5)), 1),
           'changedPx': int(chp.sum()), 'changedMeanDiff': round(float(diff[chp].mean()), 1) if chp.any() else 0}
    pink = render_view(atlas, h, v, '#f291c6', '#a4693f', mode='body')
    old_pink = old_registered(h, '#f291c6', '#a4693f', tuple(v['registration']))
    return h['base'], rep, (old, new, old_pink, pink)


def check(meta, data, out_dir, check_dir, changed):
    """Recomposition against today's painting (registered profile faces moved alike) and boards."""
    os.makedirs(check_dir, exist_ok=True)
    hair, skin = meta['hairColour'], meta['skinColour']
    jobs = []
    for h in meta['heads']:
        e = data['styles']['%s:%s' % (h['sex'], h['shape'])]
        jobs.append((h, e, e['views'][h['view']], out_dir, hair, skin, changed[h['base']]))
    with Pool(4) as pool:
        res = pool.map(check_head, jobs)
    report = {b: r_ for b, r_, _ in res}
    imgs = {b: im for b, _, im in res}
    rows = {}
    for h in meta['heads']:
        rows.setdefault((h['sex'], h['view']), []).append(h)
    json.dump(report, open(os.path.join(check_dir, '재합성.json'), 'w'), indent=1)
    worst = sorted(report.items(), key=lambda kv: -kv[1]['meanDE'])[:5]
    print('recomposition (unchanged pixels): worst mean', [(k, r['meanDE'], r['p995']) for k, r in worst])
    print('max p99.5', max(r['p995'] for r in report.values()))
    # boards (rows): today | converted | today with a dark skin and pink hair | converted alike (body formula)
    for (sex, view), items in rows.items():
        cw = 240
        sheet = Image.new('RGB', (len(items) * cw, 4 * 288 + 20), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        for n, h in enumerate(items):
            for row, img in enumerate(imgs[h['base']]):
                im = Image.fromarray(HL.on_colour(img, (30, 40, 90)).astype(np.uint8))
                im.thumbnail((cw, 288))
                sheet.paste(im, (n * cw, row * 288))
            d.text((n * cw + 3, 4 * 288 + 4), h['shape'], fill=(0, 0, 0))
        sheet.save(os.path.join(check_dir, '변환-%s-%s.png' % (sex, view)))
    return report


def main(argv):
    cmd = argv[0] if argv else ''
    sexes = argv[argv.index('--sexes') + 1].split(',') if '--sexes' in argv else ['f', 'm']
    out = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, '검증', '머리')
    if cmd == 'classify':
        classify(sexes, out)
        return 0
    if cmd == 'tops':
        tops(sexes, out)
        return 0
    if cmd == 'build':
        opt = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
        build(opt('--old', os.path.join(ROOT, '검증', '머리', '옛머리')), opt('--out', ASSETS), opt('--check', None),
              opt('--only', '').split(',') if '--only' in argv else None)
        return 0
    if cmd == 'skull':
        skull(sexes, out)
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
