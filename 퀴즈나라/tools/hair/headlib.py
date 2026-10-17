"""Shared pieces of the H2 head conversion (tools/hair/build-heads.py).

Today's renderer, step by step, so a conversion can be compared with what
students see: the per-pixel recolour (avatar-pixel.js normalizedHead /
avatar-direction.js painting, backPainting), the placement of a painting in
its head frame (12 px per head unit) and the neck cuts that follow it.
The pixel decisions come from tools/hair/export-old-heads.cjs.
"""
import json
import os
import re

import numpy as np
from PIL import Image, ImageDraw

PX = 12                      # frame pixels per head unit (both renderers)
SS = 4                       # supersampling of filled cut paths (canvas fills are antialiased)
SKIN_K = np.array([10., -15., -5.])


def hexrgb(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float64)


def load_old(dirname):
    meta = json.load(open(os.path.join(dirname, 'old-heads.json')))
    for h in meta['heads']:
        for k in ('src', 'cls', 'old', 'patch'):
            f = os.path.join(dirname, '%s-%s.png' % (h['base'], k))
            if os.path.exists(f):
                h[k + 'File'] = f
    return meta


def read_rgba(f):
    return np.asarray(Image.open(f).convert('RGBA')).astype(np.float64)


def tonal(lum, dye):
    """avatar-pixel.js tonal(): the hair dye from a brush luminance."""
    gain = lum / 102.
    shine = np.maximum(0, lum - 160) * .38
    return np.clip(np.round(dye[None, :] * gain[:, None] + shine[:, None]), 0, 255)


def skin_tint(rgb, base):
    """The head skin formula of both renderers (multiplicative shade, warm blush kept)."""
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    shade = (r * .22 + g * .59 + b * .19) / 219.
    warmth = np.maximum(0, (r - g - 34) / 78.)
    return np.clip(np.round(base[None, :] * shade[:, None] + SKIN_K[None, :] * warmth[:, None]), 0, 255)


def recolour(src, cls, hair, skin):
    """The source recoloured as today's renderer does (iris colours of sparkle/cat aside)."""
    out = src.copy()
    rgb = src[..., :3].reshape(-1, 3)
    c = cls.reshape(-1)
    o = out[..., :3].reshape(-1, 3)
    h = c == 1
    r, g, b = rgb[h, 0], rgb[h, 1], rgb[h, 2]
    o[h] = tonal(r * .25 + g * .59 + b * .16, hexrgb(hair))
    s = c == 2
    o[s] = skin_tint(rgb[s], hexrgb(skin))
    out[..., :3] = o.reshape(out.shape[:2] + (3,))
    return out


def frame_size(frame):
    return int(round(frame['w'] * PX)), int(round(frame['h'] * PX))


def placement(head, reg=(0., 0.)):
    """(scale, ox, oy) mapping source pixel corners to frame pixels: frame = src * scale + o
    (reg: a registration shift in head units)."""
    g, f = head['geometry'], head['frame']
    if head['view'] == 'front':      # drawImage(recolored, m.x, m.y, 384*m.scale, ...) after translate(margin)
        s, ox, oy = g['scale'], g['x'] - f['x'] * PX, g['y'] - f['y'] * PX
    else:
        s, ox, oy = g['scale'] * PX, (g['x'] - f['x']) * PX, (g['y'] - f['y']) * PX
    return s, ox + reg[0] * PX, oy + reg[1] * PX


def place(img, head, size=None, reg=(0., 0.), at=(0, 0)):
    """Bilinear resampling of an RGBA image (straight alpha) into the head frame,
    interpolating premultiplied colour like a canvas drawImage. Returns float RGBA.
    `at`: the image's top-left source pixel (a trimmed layer)."""
    s, ox, oy = placement(head, reg)
    ox, oy = ox + at[0] * s, oy + at[1] * s
    W, H = size or frame_size(head['frame'])
    a = img[..., 3:4] / 255.
    pm = np.concatenate([img[..., :3] * a, a * 255.], axis=2)
    h, w = img.shape[:2]
    pad = np.zeros((h + 2, w + 2, 4))
    pad[1:-1, 1:-1] = pm
    v, u = np.mgrid[0:H, 0:W].astype(np.float64)
    # frame pixel centre -> source pixel coordinates (centres at i + .5)
    x = (u + .5 - ox) / s - .5 + 1
    y = (v + .5 - oy) / s - .5 + 1
    inside = (x >= -.5) & (y >= -.5) & (x <= w + .5) & (y <= h + .5)
    x = np.clip(x, 0, w + .999)
    y = np.clip(y, 0, h + .999)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    x1 = np.minimum(x0 + 1, w + 1)
    y1 = np.minimum(y0 + 1, h + 1)
    out = (pad[y0, x0] * (1 - fx) * (1 - fy) + pad[y0, x1] * fx * (1 - fy) +
           pad[y1, x0] * (1 - fx) * fy + pad[y1, x1] * fx * fy)
    out[~inside] = 0
    al = out[..., 3:4]
    rgb = np.where(al > 0, out[..., :3] * 255. / np.maximum(al, 1e-9), 0)
    return np.concatenate([rgb, al], axis=2)


TOKEN = re.compile(r'[MLHVQZmlhvqz]|-?\d*\.?\d+(?:e-?\d+)?')


def path_polygons(d, steps=12):
    """Absolute M/L/H/V/Q/Z path data as polygons (points in path units)."""
    toks = TOKEN.findall(d)
    polys, cur, i, cmd, p = [], [], 0, None, (0., 0.)
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'Zz':
                if cur:
                    polys.append(cur)
                cur = []
            continue
        n = lambda k: [float(v) for v in toks[i:i + k]]
        if cmd == 'M':
            p = tuple(n(2)); i += 2
            if cur:
                polys.append(cur)
            cur = [p]; cmd = 'L'
        elif cmd == 'L':
            p = tuple(n(2)); i += 2; cur.append(p)
        elif cmd == 'H':
            p = (n(1)[0], p[1]); i += 1; cur.append(p)
        elif cmd == 'V':
            p = (p[0], n(1)[0]); i += 1; cur.append(p)
        elif cmd == 'Q':
            cx, cy, x, y = n(4); i += 4
            for k in range(1, steps + 1):
                t_ = k / steps
                cur.append(((1 - t_) ** 2 * p[0] + 2 * (1 - t_) * t_ * cx + t_ * t_ * x,
                            (1 - t_) ** 2 * p[1] + 2 * (1 - t_) * t_ * cy + t_ * t_ * y))
            p = (x, y)
        else:
            raise ValueError('path command %r not supported' % cmd)
    if cur:
        polys.append(cur)
    return polys


def fill_mask(polys, size, to_px):
    """Antialiased coverage (0..1) of polygons, nonzero... even-odd is not needed here."""
    W, H = size
    im = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon([(to_px(x, y)[0] * SS, to_px(x, y)[1] * SS) for x, y in poly], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)).astype(np.float64) / 255.


def jaw_channel(head):
    """avatar-pixel.js normalizedHead: the old neck stub removed under the chin (front)."""
    g, hint = head['geometry'], head['hint']
    G = 384
    u = G / 32.
    sex = head['sex']
    jx = hint['chin'][0] * G / 362 * g['scale'] + g['x']
    jy = hint['chin'][1] * G / 362 * g['scale'] + g['y']
    half, edge = (1.94, .30) if sex == 'm' else (1.48, .25)
    d = ('M{} {}Q{} {} {} {}L{} {}Q{} {} {} {}L{} {}L{} {}L{} {}Q{} {} {} {}Z').format(
        jx - half * u, jy - edge * u, jx, jy - .10 * u, jx + half * u, jy - edge * u,
        jx + (half + .2) * u, jy + .5 * u, jx + 2.15 * u, jy + 1.6 * u, jx + 3.5 * u, jy + 2.8 * u,
        jx + 3.5 * u, jy + 4.6 * u, jx - 3.5 * u, jy + 4.6 * u, jx - 3.5 * u, jy + 2.8 * u,
        jx - 2.15 * u, jy + 1.6 * u, jx - (half + .2) * u, jy + .5 * u)
    f = head['frame']
    return path_polygons(d), (lambda x, y: (x - f['x'] * PX, y - f['y'] * PX))


def neck_cut_mask(head, size=None):
    """Coverage of today's neck cut in the head frame (front jaw channel, profile/back neckCuts)."""
    size = size or frame_size(head['frame'])
    if head['view'] == 'front':
        polys, to_px = jaw_channel(head)
        return fill_mask(polys, size, to_px)
    if not head.get('neckCut'):
        return np.zeros((size[1], size[0]))
    f = head['frame']
    return fill_mask(path_polygons(head['neckCut']), size, lambda x, y: ((x - f['x']) * PX, (y - f['y']) * PX))


def erase(img, cover):
    out = img.copy()
    out[..., 3] *= 1 - cover
    return out


def old_view(head, hair, skin):
    """Today's painting of one head view rebuilt from its exported decisions."""
    src, cls = read_rgba(head['srcFile']), read_rgba(head['clsFile'])[..., 0].astype(np.uint8)
    return erase(place(recolour(src, cls, hair, skin), head), neck_cut_mask(head))


def over(top, bottom):
    """Straight-alpha 'over' compositing of float RGBA images."""
    at, ab = top[..., 3:4] / 255., bottom[..., 3:4] / 255.
    a = at + ab * (1 - at)
    rgb = np.where(a > 0, (top[..., :3] * at + bottom[..., :3] * ab * (1 - at)) / np.maximum(a, 1e-9), 0)
    return np.concatenate([rgb, a * 255.], axis=2)


def on_colour(img, bg):
    a = img[..., 3:4] / 255.
    return img[..., :3] * a + np.asarray(bg, np.float64)[None, None, :] * (1 - a)


def compare(a, b, bg=(30, 40, 90)):
    """Mean and p99.5 of the largest channel difference over a dark blue ground, where either is painted."""
    da, db = on_colour(a, bg), on_colour(b, bg)
    m = (a[..., 3] > 3) | (b[..., 3] > 3)
    diff = np.abs(da - db).max(axis=2)[m]
    return float(diff.mean()) if diff.size else 0., float(np.percentile(diff, 99.5)) if diff.size else 0.


# ---------------------------------------------------------------------------
# H2 conversion: classes, registration, layers
# ---------------------------------------------------------------------------
HAIR, SKIN, FIXED, IRIS = 1, 2, 3, 4
CLASS_NAMES = {0: 'empty', 1: 'hair', 2: 'skin', 3: 'fixed', 4: 'iris'}
IRIS_BIT = {'front': 64, 'profile': 32}


def lum_skin(rgb):
    return rgb[..., 0] * .22 + rgb[..., 1] * .59 + rgb[..., 2] * .19


def units_of(head, shape, reg=(0., 0.)):
    """Unit coordinates (U, V) of the source pixel centres, after a registration shift."""
    s, ox, oy = placement(head)
    f = head['frame']
    h, w = shape
    xs = (np.arange(w) + .5) * s + ox
    ys = (np.arange(h) + .5) * s + oy
    U = xs / PX + f['x'] + reg[0]
    V = ys / PX + f['y'] + reg[1]
    return np.meshgrid(U, V)


def poly_mask(polys, head, shape, reg=(0., 0.)):
    """Source-pixel mask of polygons given in (registered) head units."""
    s, ox, oy = placement(head)
    f = head['frame']
    h, w = shape
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon([(((u - reg[0] - f['x']) * PX - ox) / s - .5, ((v - reg[1] - f['y']) * PX - oy) / s - .5) for u, v in poly], fill=1)
    return np.asarray(im).astype(bool)


def profile_landmarks(head, cls_rgba):
    """Eye (today's detection), nose tip and chin of a profile face in today's units."""
    bits = cls_rgba[..., 1].astype(int)
    face = (bits & 1) > 0
    U, V = units_of(head, face.shape)
    u, v = U[face], V[face]
    nose = u.max()
    k = u > nose - 3.5
    return {'eye': list(map(float, head['eyeUnits'])), 'nose': [float(nose), float(v[u > nose - .15].mean())],
            'chin': [float(u[k][v[k].argmax()]), float(v[k].max())]}


def registration(lms, ref):
    """Translation moving a profile face onto the reference face (mean of eye, nose, chin)."""
    dx = np.mean([ref[k][0] - lms[k][0] for k in ('eye', 'nose')])
    dy = np.mean([ref[k][1] - lms[k][1] for k in ('eye', 'nose', 'chin')])
    return float(round(dx, 3)), float(round(dy, 3))


def opening(mask, r):
    from avatar_build import matte as M
    return M.dilate(M.erode(mask, r), r) & mask


def fill_holes(mask):
    """Pixels not 4-connected to the border through ~mask, plus mask."""
    from avatar_build import matte as M
    pad = np.pad(~mask, 1, constant_values=True)
    seed = np.zeros_like(pad)
    seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
    outside = M.connected_to(pad, seed)[1:-1, 1:-1]
    return ~outside


def feature_core(head, shape):
    """Eyes and mouth, where painted lashes and lips stay as painted: avatar-pixel.js
    inspectFace featureMask without its 2 px face border (front); the eye box (profile)."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    out = np.zeros(shape, bool)
    if head['view'] == 'front':
        G = 384
        for e in head['eyes']:
            out |= (xx > e['left'] - G * .019) & (xx < e['right'] + G * .019) & (yy > e['top'] - G * .026) & (yy < e['bottom'] + G * .018)
        f = head['face']
        fh, fw = f['bottom'] - f['top'], f['right'] - f['left']
        out |= ((xx - f['cx']) / (fw * .16)) ** 2 + ((yy - (f['bottom'] - fh * .15)) / (fh * .13)) ** 2 < 1
    elif head['view'] == 'profile':     # the eye box and the whole eye the blink cover hides (avatar-direction.js preparePatch)
        e = head['eye']
        out |= (xx > e['left'] - 8) & (xx < e['right'] + 8) & (yy > e['top'] - 12) & (yy < e['bottom'] + 8)
        cx, cy = (e['left'] + e['right']) / 2, (e['top'] + e['bottom']) / 2
        rx, ry = max(27, (e['right'] - e['left']) * 1.9), max(28, (e['bottom'] - e['top']) * 1.55)
        out |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1
    return out


def refine(head, src, cls_rgba, spec, reg, cover=None):
    """H2 classes from today's decisions: ears and the crown highlights taken back,
    ear rims and face rims fixed, specks and the old neck stub erased (cover: where the body is
    painted behind, body_cover(); in profile the old neck over it goes behind the stub zone's top too).
    Returns (classes uint8, erase bool, report)."""
    from avatar_build import matte as M
    view, sex = head['view'], head['sex']
    c = cls_rgba[..., 0].astype(np.uint8).copy()
    bits = cls_rgba[..., 1].astype(int)
    a = src[..., 3]
    rgb = src[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = lum_skin(rgb)
    shape = c.shape
    z = spec['zones'][sex][view]
    rep = {}
    if view in IRIS_BIT:
        iris = (bits & IRIS_BIT[view]) > 0
        c[iris] = IRIS
        rep['iris'] = int(iris.sum())
    ear = poly_mask(z.get('ear', []), head, shape, reg)
    nape = poly_mask(z.get('nape', []), head, shape, reg)
    before = c.copy()
    # back: no face, skin only in the ear and nape zones (crown highlights were skin)
    if view == 'back':
        allowed = poly_mask(spec.get('skinZones', {}).get('%s:%s' % (sex, head['shape']), {}).get(view, []), head, shape, reg)
        crown = (c == SKIN) & ~ear & ~nape & ~allowed
        c[crown] = HAIR
        rep['crownToHair'] = int(crown.sum())
    # ears: warm light paint in the ear zone joined to a broad patch (thin hair highlights drop out)
    cand = ((c == HAIR) | (c == FIXED)) & ear & (a > 128) & (r >= 190) & (L >= 125) & (b >= .74 * g)
    seeds = opening(cand, 2) | ((c == SKIN) & ear)
    earskin = M.connected_to(cand | ((c == SKIN) & ear), seeds) & cand
    for _ in range(2):      # light bits cut off from the ear by a stroke of its outline
        earskin |= cand & M.dilate(earskin | ((c == SKIN) & ear), 2)
    c[earskin] = SKIN
    # strokes enclosed by ear skin (the fold) belong to the ear
    skinlike = ((c == SKIN) | (c == FIXED)) & ear
    holes = fill_holes(skinlike) & ear & (c == HAIR)
    c[holes & (L >= 70)] = SKIN
    c[holes & (L < 70)] = FIXED
    solid = opening(c == HAIR, 3)
    ears_now = (c == SKIN) & ear
    rim = M.dilate(ears_now, 3) & (c == HAIR) & ~solid & (L < 150) & ear
    c[rim] = FIXED
    rep['earToSkin'] = int((earskin | (holes & (L >= 70))).sum())
    rep['earRim'] = int((rim | (holes & (L < 70))).sum())
    # face rim (front, profile): pale hair-classed paint on the face edge is the face's own light edge
    if view != 'back':
        face = (bits & 1) > 0
        pale = M.dilate(face, 2) & (c == HAIR) & ~solid & (L >= 150) & (b >= .70 * g)
        c[pale] = SKIN
        rep['faceRim'] = int(pale.sum())
    # hair-skin boundary paint left as painted (today's 2 px 'near face' guard): on a dark skin
    # or a dyed hair it showed as a pale dotted rim. Outside the eyes and mouth, light boundary
    # paint joins the skin, mid paint the hair; dark ink and the hair's outline on the ground stay.
    core = feature_core(head, shape)
    seam = (c == FIXED) & ~core & M.dilate(c == SKIN, 2) & M.dilate(c == HAIR, 2)
    hairish = (r > g * 1.025) & (g > b * .98) & (r - g < 117) & (g - b < 83)
    to_skin = seam & (L >= 140) & (b >= .72 * g)
    to_hair = seam & ~to_skin & (L >= 60) & hairish
    c[to_skin] = SKIN
    c[to_hair] = HAIR
    rep['seamToSkin'] = int(to_skin.sum())
    rep['seamToHair'] = int(to_hair.sum())
    erase = np.zeros(shape, bool)
    solid = opening(c == HAIR, 3)
    # the old neck stub: everything but solid hair below the jaw (front remnants, profile) ...
    stub_polys = spec['stub'][sex].get(view)
    if stub_polys:      # the neck belongs to the body: its zones stay where today's renderer puts the painting
        region = poly_mask(stub_polys, head, shape)
        if view == 'profile' and cover is not None:
            # behind the zone's top (the notch under the ear) the old neck goes too, ears aside: over the body it
            # half covered the body's collar line along the zone's edge, past it its outline hung from the hair tips
            # (thicker old necks than the reference's); what would leave a hole or a seam comes back (keep_holes)
            U, V = units_of(head, shape)
            un, vn = min((p for poly in stub_polys for p in poly), key=lambda p: p[1])
            region |= (U < un) & (V > vn) & ~ear
        if view == 'front':     # from just under this face's jaw line (the old neck's side outlines hook up to it)
            U, V = units_of(head, shape, reg)
            face = (c == SKIN) & ((bits & 1) > 0)
            cols = np.where(face.any(0), shape[0] - 1 - np.argmax(face[::-1], 0), -1)
            jawv = np.where(cols >= 0, V[np.clip(cols, 0, shape[0] - 1), np.arange(shape[1])], np.inf)
            under = poly_mask(spec['stubSides'][sex], head, shape) & (V > jawv[None, :] + .35)
            erase |= under & (c != HAIR) & (a > 0)      # the stub's skin and outline (long hair kept)
            region |= under
        if view != 'front':     # profile, back: the neck's skin and the rim around it; hair (braids, long hair) stays
            stubskin = region & (c == SKIN) & (a > 0)
            # the rim is the old neck's dark outline; lighter hair strands crossing the neck (a braid's front lock) stay
            # (its antialiased edge reads as mid brown 'hair': only paint on or beside a broad strand is hair)
            rim = M.dilate(stubskin, 4) & region & (a > 0) & ~solid
            # (a stroke of it crossing a strand over the body's neck, between broad hair, stays: it would cut the
            # strand; past the body's edge it is the old neck's outline left floating by the hair tips: it goes)
            loose = (~M.dilate(solid, 2) & ((c == FIXED) | (c == HAIR))) | ((c == FIXED) & (np.ones(shape, bool) if cover is None else ~cover))
            erase |= stubskin | (rim & loose)
            region = np.zeros(shape, bool)
        # hair stays only when it hangs from the hair mass outside through broad hair (long hair); the old
        # neck (dyed as hair on male fronts) touches the hair only through the thin jaw outline
        lab, comps = M.components(solid & (a > 0))
        hanging = np.zeros(shape, bool)
        for k in comps:
            x0, y0, x1, y1 = k['bbox']
            m = lab[y0:y1, x0:x1] == k['label']
            if (m & region[y0:y1, x0:x1]).any() and (m & ~region[y0:y1, x0:x1]).sum() >= 200:
                hanging[y0:y1, x0:x1] |= m
        erase |= region & (a > 0) & ~hanging
    rep['stub'] = int(erase.sum())
    # specks: small paint islands away from the head
    lab, comps = M.components(a > 8)
    if comps:
        big = max(comps, key=lambda k: k['size'])['label']
        main = M.dilate(lab == big, 6)
        specks = np.zeros(shape, bool)
        for k in comps:
            if k['size'] < 40 and k['label'] != big:
                m = lab == k['label']
                if not (m & main).any():
                    specks |= m
        erase |= specks
        rep['specks'] = int(specks.sum())
    # stubble (fade, undercut): where the scalp was shaved the painter mixed short hair into skin, a
    # pinkish grey-brown (b/g >= .8; brown hair stays under .8). Inside a generous zone it is split
    # like the boundary band (unmix), by a weight that rises with b/g, so no zone edge shows.
    zones = spec.get('stubble', {}).get('%s:%s' % (sex, head['shape']), {}).get(view)
    stubble = np.zeros(shape)
    if zones:
        z = poly_mask(zones, head, shape, reg) & (a > 0) & (L >= 85) & (L <= 190) & ~erase & ~ears_now & \
            ((c == HAIR) | (c == FIXED) | ((c == SKIN) & (view == 'back')))
        if view != 'back':
            z &= (bits & 1) == 0        # never the face
        stubble = np.where(z, np.clip((b / np.maximum(g, 1) - .78) / .06, 0, 1), 0.)
        c[stubble > 0] = HAIR
        rep['stubble'] = int((stubble > 0).sum())
    pre = c.copy()      # the classes before erasing: boundary paint mixed with an erased neck is split against it
    c[erase] = 0
    rep['changed'] = int((c != before).sum())
    return c, erase, rep, stubble, pre


def body_cover(head, shape):
    """Source-pixel mask of where the reference body (no garments, idle) is painted behind this head view
    (OLDDIR/body-<sex>-<view>.png of tools/hair/export-body-cover.cjs, beside the exported decisions)."""
    f = os.path.join(os.path.dirname(head['srcFile']), 'body-%s-%s.png' % (head['sex'], head['view']))
    if not os.path.exists(f):
        raise SystemExit('missing %s: run node tools/hair/export-body-cover.cjs first' % f)
    m = np.asarray(Image.open(f).convert('RGBA'))[..., 3] > 128
    U, V = units_of(head, shape)
    fr = head['frame']
    X, Y = np.floor((U - fr['x']) * PX).astype(int), np.floor((V - fr['y']) * PX).astype(int)
    ok = (X >= 0) & (Y >= 0) & (X < m.shape[1]) & (Y < m.shape[0])
    out = np.zeros(shape, bool)
    out[ok] = m[Y[ok], X[ok]]
    return out


def gaps(paint, cover):
    """Background enclosed by the head's paint and the body: 4-connected components of what neither
    paints that do not reach the image edge."""
    from avatar_build import matte as M
    lab, comps = M.components(~(paint | cover))
    h, w = paint.shape
    out = np.zeros(paint.shape, bool)
    for k in comps:
        x0, y0, x1, y1 = k['bbox']
        if x0 > 0 and y0 > 0 and x1 < w and y1 < h:
            out[y0:y1, x0:x1] |= lab[y0:y1, x0:x1] == k['label']
    return out


def keep_holes(src, erase, cover, guard=True):
    """Erased old-neck paint that the body's neck does not stand in for stays: where removing it leaves
    background enclosed by the hair and the body's neck, and where the head's paint kept outside the body
    would end right on the body's edge (both antialiased edges and the body's outline showed there as a
    thin dark seam: the old neck now overlaps the body's edge by 2 px, inside it). Returns the pixels taken back."""
    from avatar_build import matte as M
    kept = np.zeros(erase.shape, bool)
    if not guard:
        return kept
    solid = M.erode(cover, 1)      # the body's antialiased edge does not count as cover
    edge = cover & ~M.erode(cover, 2)      # inside the body's edge only: kept paint never sticks out past the body
    for _ in range(4):
        left = (src[..., 3] > 96) & ~(erase & ~kept)
        hole = gaps(left, solid)
        more = erase & ~kept & ((M.dilate(hole, 1) & ~solid) | (edge & M.dilate(left & ~cover, 2)))
        if not more.any():
            break
        kept |= more
    return kept


def fade_edge(src, erase, pre, cover, n=3):
    """Over the body (cover), erased old-neck skin next to skin that stays fades out over n px instead of
    ending on a straight edge (the chin's shadow cut by the stub zone showed as a seam across the neck).
    Returns the alpha factor (0 elsewhere)."""
    from avatar_build import matte as M
    solid = M.erode(cover, 1)
    gone = erase & (pre == SKIN) & solid
    near = (pre == SKIN) & ~erase & (src[..., 3] > 128)
    out = np.zeros(erase.shape)
    for k in range(1, n + 1):
        ring = M.dilate(near, 1) & gone & (out == 0)
        out[ring] = 1 - k / (n + 1.)
        near = near | ring
    return out


def box_mean(rgb, w, r):
    """Mean of rgb weighted by w over a (2r+1) square, and the weight sum (cumulative sums)."""
    def box(a):
        c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2)), 0), 1)
        return c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]
    ws = box(w.astype(np.float64))
    return box(rgb * w[..., None]) / np.maximum(ws, 1e-9)[..., None], ws


def unmix(src, c, core, band_px=2, r=5, stubble=None):
    """The hair-skin boundary band, where the painter mixed hair into light skin: each pixel
    split into a hair share (alpha a, its colour unmixed) and a skin share (the nearby skin),
    so a dyed hair or a dark skin shows no pale rim. Returns (share of hair 0..1, hair rgb, skin rgb)."""
    from avatar_build import matte as M
    rgb = src[..., :3]
    hair, skin = c == HAIR, c == SKIN
    band = (hair | skin) & M.dilate(hair, band_px) & M.dilate(skin, band_px) & ~core
    inner = hair & ~M.dilate(skin, 3)
    hbar, hw = box_mean(rgb, inner, r)
    sbar, sw = box_mean(rgb, skin & ~M.dilate(hair, 3), r)
    # thin strokes inside the face (brows, stray strands) have no hair mass nearby: the head's own hair
    if inner.sum() > 50:
        far = hw <= 3
        hbar[far] = np.median(rgb[inner & (lum_skin(rgb) < 140)], axis=0) if (inner & (lum_skin(rgb) < 140)).sum() > 50 else np.median(rgb[inner], axis=0)
        hw[far] = 4
    sw_ = np.zeros(c.shape) if stubble is None else stubble
    st = sw_ > 0
    if st.any():      # shaved scalp: the head's skin under its dark hair
        dark = inner & (lum_skin(rgb) < 110)
        face = skin & ~M.dilate(hair, 3)
        if dark.sum() > 50 and face.sum() > 50:
            hbar[st] = np.median(rgb[dark], axis=0)
            sbar[st] = np.median(rgb[face], axis=0)
            hw[st] = sw[st] = 4
            band = band | st
    d = hbar - sbar
    dd = (d * d).sum(-1)
    ok = band & (hw > 3) & (sw > 3) & (dd > 40 ** 2)
    a = ((rgb - sbar) * d).sum(-1) / np.maximum(dd, 1e-9)
    a = np.clip(a, 0, 1)
    a[a < .1] = 0
    a[a > .9] = 1
    a = np.where(st, 1 - sw_ * (1 - a), a)      # stubble: by its weight
    share = hair.astype(np.float64)
    share[ok] = a[ok]
    hrgb = rgb.copy()
    m = ok & (share > 0)
    hrgb[m] = np.clip((rgb[m] - (1 - share[m, None]) * sbar[m]) / share[m, None], 0, 255)
    srgb = rgb.copy()
    srgb[ok] = sbar[ok]
    return share, hrgb, srgb, ok
