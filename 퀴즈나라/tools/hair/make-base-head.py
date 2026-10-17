"""H5 base head: the reference style's face (f bob, m short) on a bald skull, no neck, as head layers
(3단계-계획.txt 'hair' 7). New hairstyles are this head plus their own hair layers, so every face is the
same by construction. Nothing here is hand-painted:

  - face, ears, eyes, mouth: the converted reference layers (assets/sd-hair-<sex>-<ref>.webp) without the
    hair, and without the hair's ink and the hair-coloured shadow it left on the skin;
  - the skull: a superellipse dome per view (SKULL below) joined to the face's own contour, filled with
    the face's sheet skin (light centre, darker rim, a soft top-left light) and outlined with the face's ink;
  - brows: drawn from the eye landmarks, in the hair layer so they take the hair dye.

  python3 -B tools/hair/make-base-head.py [--old 검증/머리/옛머리] [--board 검증/머리/민머리]

Layers are built at each reference view's source resolution and partition the picture (drawn additively,
as the converted heads). Board (검증/머리/민머리/민머리.png): per sex front, right, back, each on the light and the dark skin.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
import headlib as HL  # noqa: E402
from avatar_build import matte as M  # noqa: E402

REFERENCE = {'f': 'bob', 'm': 'short'}
VIEWS = ('front', 'profile', 'back')
# Skull domes in head-native units: centre, radii, superellipse exponent. Front from build-heads.py SKULL
# (top 0.5-0.6 under the flattest hair, sides at the cheeks plus the hair root).
SKULL = {
    'f': {'front': (16.0, 17.75, 9.4, 10.25, 2.3)},
    'm': {'front': (16.0, 14.9, 11.5, 13.1, 2.3)},
}


def hair_data():
    js = open(os.path.join(ROOT, 'assets', 'sd-hair-data.js')).read()
    return json.loads(js.split('window.QPHairData=', 1)[1].rstrip().rstrip(';'))


def reference_layers(head, entry, view):
    """The reference style's layers of one view on its source pixel grid (float straight RGBA)."""
    atlas = np.asarray(Image.open(os.path.join(ROOT, entry['file'])).convert('RGBA')).astype(np.float64)
    v = entry['views'][view]
    h, w = HL.read_rgba(head['srcFile']).shape[:2]
    out = {}
    for name, (ax, ay, lw, lh, ux, uy, uw, uh) in v['layers'].items():
        img = np.zeros((h, w, 4))
        x0, y0 = int(round((ux - v['origin'][0]) / v['k'])), int(round((uy - v['origin'][1]) / v['k']))
        img[y0:y0 + lh, x0:x0 + lw] = atlas[ay:ay + lh, ax:ax + lw]
        out[name] = img
    return out, v


class Stack:
    """Layers composited 'over' one another, kept apart: each pixel's colour is split among the layers so
    that their premultiplied sum is the composite (the runtime draws them additively)."""
    def __init__(self, shape):
        self.acc = {}
        self.shape = shape

    def over(self, name, rgb, alpha):
        a = np.clip(alpha, 0, 1)[..., None]
        for k in self.acc:
            self.acc[k] *= 1 - a
        pm = np.concatenate([np.broadcast_to(rgb, self.shape + (3,)) * a, a], axis=2)
        self.acc[name] = self.acc.get(name, 0) + pm

    def layers(self):
        out = {}
        for k, pm in self.acc.items():
            a = pm[..., 3:4]
            rgb = np.where(a > 1e-6, pm[..., :3] / np.maximum(a, 1e-6), 0)
            out[k] = np.concatenate([rgb, a * 255.], axis=2)
        return out


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def superellipse(U, V, cx, cy, rx, ry, n):
    """Normalised radius (1 on the dome's edge) of a superellipse."""
    return (np.abs((U - cx) / rx) ** n + np.abs((V - cy) / ry) ** n) ** (1 / n)


def soft_mask(mask, px):
    """An antialiased edge for a binary mask: alpha from the blurred mask, sharpened."""
    im = Image.fromarray((mask * 255).astype(np.uint8))
    from PIL import ImageFilter
    b = np.asarray(im.filter(ImageFilter.GaussianBlur(px))).astype(np.float64) / 255.
    return np.clip((b - .5) * 2.2 + .5, 0, 1)


def skin_ramp(skin, face):
    """Light, mid and shadow sheet skin of the face (luminance quantiles of its opaque skin)."""
    px = skin[face & (skin[..., 3] > 250)][:, :3]
    L = HL.lum_skin(px)
    order = np.argsort(L)
    pick = lambda q: np.median(px[order[int(q[0] * len(px)):int(q[1] * len(px)) + 1]], axis=0)
    return pick((.80, .95)), pick((.45, .60)), pick((.08, .20))


def face_ink(fixed, core):
    """The face's contour ink: the darker half of its fixed paint outside the eyes and mouth."""
    m = (fixed[..., 3] > 200) & ~core
    px = fixed[m][:, :3]
    L = HL.lum_skin(px)
    return np.median(px[L <= np.median(L)], axis=0)


def common_silhouette(meta, data, sex, view):
    """Where every hair style of a sex paints this view (its hair and face), in the head frame at
    12 px per unit: the skull every style covers. Smoothed (a round dome, no hair-tip notches)."""
    acc = None
    for key, entry in data['styles'].items():
        if not key.startswith(sex + ':'):
            continue
        head = next(h for h in meta['heads'] if h['sex'] == sex and h['shape'] == entry['shape'] and h['view'] == view)
        layers, _ = reference_layers(head, entry, view)
        a = np.zeros(layers['skin'].shape[:2])
        for k, img in layers.items():
            if not k.startswith('blink'):
                a = np.maximum(a, img[..., 3])
        img = np.zeros(a.shape + (4,))
        img[..., 3] = a
        m = HL.place(img, head)[..., 3] > 128
        acc = m if acc is None else acc & m
    from PIL import ImageFilter
    b = np.asarray(Image.fromarray((acc * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))) > 127
    return b


def frame_to_src(mask, head, shape):
    """A head-frame mask (12 px per unit) sampled at a view's source pixel centres."""
    U, V = HL.units_of(head, shape)
    f = head['frame']
    X = np.clip(np.floor((U - f['x']) * HL.PX).astype(int), 0, mask.shape[1] - 1)
    Y = np.clip(np.floor((V - f['y']) * HL.PX).astype(int), 0, mask.shape[0] - 1)
    return mask[Y, X]


def base_view(head, layers, v, sex, view, common):
    """One view of the base head on the reference view's source grid."""
    shape = layers['skin'].shape[:2]
    U, V = HL.units_of(head, shape)
    hair_a = layers['hair'][..., 3] / 255.
    skin, fixed = layers['skin'], layers['fixed'].copy()
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    keep = np.zeros(shape, bool)
    if view == 'front':
        core = HL.feature_core(head, shape)
        for e in head['eyes']:          # the eye box (lashes included) and a few px around it
            keep |= (xx > e['left'] - 5) & (xx < e['right'] + 5) & (yy > e['top'] - 4) & (yy < e['bottom'] + 5)
        keep |= core & (V > np.mean([e[1] for e in v['eyes']]) + 1.5)      # the mouth
    elif view == 'profile':
        keep |= HL.feature_core(head, shape)
    # the hair's ink lying on the face (strand outlines, the fringe's edge) goes with the hair
    fixed[M.dilate(hair_a > .02, 6) & ~keep, 3] = 0
    face = (skin[..., 3] > 128) | (fixed[..., 3] > 128) | (layers['iris'][..., 3] > 128 if 'iris' in layers else False)
    light, mid, shadow = skin_ramp(skin, skin[..., 3] > 128)
    ink = face_ink(layers['fixed'], keep if view != 'back' else np.zeros(shape, bool))
    # the silhouette: every style's common skull, 0.5 unit inside it, joined to the face's own contour
    if view in SKULL[sex]:      # a dome by rule, kept inside every style's common skull
        cx, cy, rx, ry, n = SKULL[sex][view]
        eye_y = np.mean([e[1] for e in v['eyes']]) if view == 'front' else cy
        dome = (superellipse(U, V, cx, cy, rx, ry, n) <= 1) & (V < eye_y + 1.5)
        sil = dome | (HL.fill_holes(M.dilate(face & (V >= eye_y - 1), 1)) & (V >= eye_y - 1))
    else:                       # not by rule yet: every style's common skull, 0.5 unit inside it (too lumpy: art)
        dome = M.erode(frame_to_src(common, head, shape), max(1, int(round(.5 / head_px_unit(U)))))
        sil = dome | HL.fill_holes(M.dilate(face, 1))
    sil = M.erode(M.dilate(sil, 3), 3)
    alpha = soft_mask(sil, 1.2)
    # shading: light inside, darker towards the rim, a soft light from the top left
    dist = distance_from(~sil, shape, 40)
    edge = 1 - smoothstep(2, 34, dist)
    ys, xs = np.nonzero(sil)
    cu, cv = U[ys, xs].mean(), V[ys, xs].min()
    lit = np.exp(-(((U - cu + 3) / 5.5) ** 2 + ((V - cv - 4) / 4.5) ** 2))
    col = light[None, None] * (1 - edge[..., None]) + shadow[None, None] * edge[..., None] * .55 + light[None, None] * edge[..., None] * .45
    col = col + (np.array([255., 250., 245.]) - col) * (lit[..., None] * .16)
    st = Stack(shape)
    st.over('skin', col, alpha)
    ring = alpha * (1 - soft_mask(M.erode(sil, 2), 1.0))
    st.over('fixed', ink, ring * .95)
    # the face over the dome; its hair-shadowed edge fades into the dome
    fade = smoothstep(0, 6, distance_from(hair_a > .02, shape, 8))
    sk = skin.copy()
    sk[..., :3] = sk[..., :3] * fade[..., None] + col * (1 - fade[..., None])
    st.over('skin', sk[..., :3], sk[..., 3] / 255.)
    st.over('fixed', fixed[..., :3], fixed[..., 3] / 255.)
    if 'iris' in layers:
        st.over('iris', layers['iris'][..., :3], layers['iris'][..., 3] / 255.)
    if view == 'front':
        brows_front(st, head, v, U, V, sex)
    return st.layers()


def head_px_unit(U):
    """Head units per source pixel."""
    return float(abs(U[0, 1] - U[0, 0]))


def brows_front(st, head, v, U, V, sex):
    if sex in BROW_DONOR:       # the painted brows of a style that shows them, moved to the same head units
        donor = BROW_DONOR[sex]
        for name in ('fixed', 'hair'):
            img = sample_units(donor['layers'][name], donor['head'], U, V) * donor['mask'](U, V)[..., None]
            st.over(name, img[..., :3], img[..., 3] / 255.)
        return
    for e, box in zip(v['eyes'], head['eyes']):
        top = V[int(box['top']), int((box['left'] + box['right']) / 2)]      # the eye box's top in units
        brow(st, U, V, (e[0], top), sex, mirror=e[0] < 16)     # the inner end towards the nose


BROW_DONOR = {}
BASES = {}


def brow_donor(meta, data, sex, shape):
    """The brows of `shape` (front): its fixed and hair paint in a band above each eye."""
    head = next(h for h in meta['heads'] if h['sex'] == sex and h['shape'] == shape and h['view'] == 'front')
    layers, v = reference_layers(head, data['styles']['%s:%s' % (sex, shape)], 'front')
    U, V = HL.units_of(head, layers['skin'].shape[:2])
    boxes = [(e[0], V[int(b['top']), int((b['left'] + b['right']) / 2)]) for e, b in zip(v['eyes'], head['eyes'])]
    def mask(U_, V_):
        m = np.zeros(U_.shape)
        for ex, top in boxes:
            m = np.maximum(m, smoothstep(2.9, 2.4, np.abs(U_ - ex)) * smoothstep(top - 2.6, top - 2.2, V_) * smoothstep(top - .25, top - .6, V_))
        return m
    BROW_DONOR[sex] = {'head': head, 'layers': layers, 'mask': mask}


def sample_units(img, head, U, V):
    """Bilinear sample (premultiplied) of a source-grid layer of `head` at head units U, V."""
    s, ox, oy = HL.placement(head)
    f = head['frame']
    x = ((U - f['x']) * HL.PX - ox) / s - .5
    y = ((V - f['y']) * HL.PX - oy) / s - .5
    h, w = img.shape[:2]
    a = img[..., 3:4] / 255.
    pm = np.concatenate([img[..., :3] * a, a * 255.], axis=2)
    pad = np.zeros((h + 2, w + 2, 4))
    pad[1:-1, 1:-1] = pm
    x = np.clip(x + 1, 0, w + .999)
    y = np.clip(y + 1, 0, h + .999)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    x1, y1 = np.minimum(x0 + 1, w + 1), np.minimum(y0 + 1, h + 1)
    out = pad[y0, x0] * (1 - fx) * (1 - fy) + pad[y0, x1] * fx * (1 - fy) + pad[y1, x0] * (1 - fx) * fy + pad[y1, x1] * fx * fy
    al = out[..., 3:4]
    rgb = np.where(al > 0, out[..., :3] * 255. / np.maximum(al, 1e-9), 0)
    return np.concatenate([rgb, al], axis=2)


def distance_from(mask, shape, steps=6):
    """Chessboard distance in px from a mask, capped at `steps`."""
    d = np.full(shape, float(steps))
    cur = mask.copy()
    for k in range(steps):
        d[cur & (d == steps)] = k
        cur = M.dilate(cur, 1)
    return d


def brow(st, U, V, eye, sex, mirror):
    """A tapered arc above an eye (eye = its centre x and its box's top y): about 3 units wide, its
    middle `lift` above the box's top, thicker at the inner end."""
    ex, ey = eye
    w, lift, arch = (3.1, 1.25, .38) if sex == 'f' else (3.4, .95, .30)
    t = (U - ex) / w * (-1 if mirror else 1) + .5          # 0 at the inner end, 1 at the outer end
    yc = ey - lift - arch * np.sin(np.clip(t, 0, 1) * np.pi) + .25 * t
    thick = (.42 if sex == 'f' else .55) * (1 - .55 * np.clip(t, 0, 1))
    d = np.abs(V - yc) / np.maximum(thick / 2, 1e-3)
    a = np.clip(1.6 - d, 0, 1) * smoothstep(-.02, .10, t) * smoothstep(1.02, .86, t)
    st.over('hair', np.array([80., 0., 80.]), a * .95)    # R = B = L (the dye's brush luminance), G = its shine (none)


def render(layers, head, v_origin, k, hair='#5a3825', skin='#ffe0c8', bg=(30, 40, 90)):
    """The layers recoloured like the runtime (body tone matrix) and placed in the head frame."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('bh', os.path.join(HERE, 'build-heads.py'))
    BH = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(BH)
    W, H = HL.frame_size(head['frame'])
    acc = np.zeros((H, W, 4))
    for lk, img in layers.items():
        img = img.copy()
        rgb = img[..., :3].reshape(-1, 3)
        if lk == 'hair':
            rgb = np.clip(HL.hexrgb(hair)[None, :] * rgb[:, :1] / 102. + rgb[:, 1:2], 0, 255)
        elif lk == 'skin':
            rgb = np.clip(rgb @ BH.tone_matrix(skin).T, 0, 255)
        img[..., :3] = rgb.reshape(img.shape[:2] + (3,))
        p = HL.place(img, head)
        a = p[..., 3:4] / 255.
        acc[..., :3] += p[..., :3] * a
        acc[..., 3:4] += a
    a = np.clip(acc[..., 3:4], 0, 1)
    rgb = np.where(a > 0, acc[..., :3] / np.maximum(acc[..., 3:4], 1e-9), 0)
    return (rgb * a + np.array(bg, float) * (1 - a)).astype(np.uint8)


def main(argv):
    opt = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
    old = opt('--old', os.path.join(ROOT, '검증', '머리', '옛머리'))
    board = opt('--board', os.path.join(ROOT, '검증', '머리', '민머리'))
    os.makedirs(board, exist_ok=True)
    meta = HL.load_old(old)
    data = hair_data()
    brow_donor(meta, data, 'm', 'slick')      # m short's brows are under its fringe; m slick shows its own
    tiles = []
    for sex in ('f', 'm'):
        entry = data['styles']['%s:%s' % (sex, REFERENCE[sex])]
        row = []
        for view in VIEWS:
            head = next(h for h in meta['heads'] if h['sex'] == sex and h['shape'] == REFERENCE[sex] and h['view'] == view)
            layers, v = reference_layers(head, entry, view)
            base = base_view(head, layers, v, sex, view, common_silhouette(meta, data, sex, view))
            BASES[(sex, view)] = (head, v, base)
            for skin in ('#ffe0c8', '#a4693f'):
                row.append(render(base, head, v['origin'], v['k'], skin=skin))
        tiles.append(row)
    th = max(t.shape[0] for r in tiles for t in r)
    W = max(sum(t.shape[1] + 8 for t in r) for r in tiles)
    out = Image.new('RGB', (W, len(tiles) * (th + 8)), 'white')
    for j, r in enumerate(tiles):
        x = 0
        for t in r:
            out.paste(Image.fromarray(t), (x, j * (th + 8)))
            x += t.shape[1] + 8
    out = out.resize((out.width // 2, out.height // 2))
    f = os.path.join(board, '민머리.png')
    out.save(f)
    print(f, out.size)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
