"""Seated (floor-sit) body and garment layers (옷층-계획.md, steps 1-2).

The floor sit is drawn: one 'seated base body' per sex and view (the user's
ChatGPT sheet: white sleeveless top, white undershorts, bare feet) and, per
shop item, the layer of that item cut from its seated sheet. At runtime the
base is drawn, then the bottom, shoes and top layers over it; skin pixels
(alpha 254) are tinted to the avatar's skin.

  python3 tools/seated-layers.py base                      base bodies + basic outfit
  python3 tools/seated-layers.py item SHEET SEX SLOT ID    one item sheet (SLOT top|bottom|shoes|outfit)
  python3 tools/seated-layers.py all                       base, then every item of assets/seated/items.json

`item` adds the sheet to assets/seated/items.json, so `all` rebuilds every
layer the same way after a change here; `base` keeps the item entries.

Every sheet (three seated views: front, right profile, back) is placed onto
the basic reference frame of tools/seated-cut-body.py (register: head width,
head centre, lowest row). A layer is what that sheet changes against the
base body (blurred colour distance > CHANGED), below the chin (the runtime
head covers above it; a hood may rise 60 px). Changed pixels are split into
slots by growing, inside the changed area, from cores: for the basic outfit
the colours of its pieces; for an item, its own new pixels (unlike the basic
reference there) against the basic pieces it kept (like the reference there).
So hands on the knees, crossed shins and anything else the sheet keeps as
skin are holes in every garment layer and the base body shows through.

Writes assets/seated/<sex>-<view>-<layer>.png and assets/seated/layers.json:
{sex: {view: {frame:[x,y,w,h] body units, seat, layers: {name: [x,y,w,h]}}}}.
"""
import sys, json, os, importlib.util
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('cutbody', os.path.join(HERE, 'seated-cut-body.py'))
CB = importlib.util.module_from_spec(spec); sys.argv, argv = ['x'], sys.argv; spec.loader.exec_module(CB); sys.argv = argv
OUT = os.path.join(ROOT, 'assets/seated'); REF = 'assets/pose-references/'
BASE = {'m': REF + 'floor-sit-m-base-2026-10-14.webp', 'f': REF + 'floor-sit-f-base-2026-10-14.webp'}
BASIC = {'top': 'top:tee', 'bottom': 'bottom:shorts', 'shoes': 'shoes:sneaker'}
SLOTS = ('bottom', 'shoes', 'top')
# Where the basic sneakers are (crop pixels x0, y0, x1, y1). The basic cut
# reads shoes only here: a shirt's or shorts' orange flower print near the
# knees otherwise passes for a shoe rim.
SHOE_ZONE = {'f:front': (90, 725, 450, 840), 'f:side': (370, 725, 580, 840),
             'm:front': (95, 735, 440, 860), 'm:side': (330, 735, 540, 860)}
CHANGED = 34.0   # colour distance (0-441) after a 1.5 px blur
HOOD_UP = 60     # px a garment may rise above the chin cut


def rgb(img, box):
    x0, y0, x1, y1 = box; return np.asarray(img.convert('RGB')).astype(float)[y0:y1, x0:x1]


def blur(img):
    return img.convert('RGB').filter(ImageFilter.GaussianBlur(1.5))


def figure(a):
    """The figure: everything but the white background connected to the
    border (white cloth inside the outline stays)."""
    mn, mx = a.min(2), a.max(2); white = (mn > 238) & (mx - mn < 14)
    bg = np.zeros_like(white); bg[0] = white[0]; bg[-1] = white[-1]; bg[:, 0] = white[:, 0]; bg[:, -1] = white[:, -1]
    while True:
        d = bg.copy(); d[1:] |= bg[:-1]; d[:-1] |= bg[1:]; d[:, 1:] |= bg[:, :-1]; d[:, :-1] |= bg[:, 1:]; d &= white
        if (d == bg).all(): return ~bg
        bg = d


def skin_of(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # skin is orange: green never falls below blue (pink cloth does, and
    # passed for skin, so pink sleeves over the base's arms were dropped)
    return (a.min(2) < 240) & (r - b > 25) & (g - b <= 30) & (g - b >= -4) & (r - g >= 19)


def skin_light(a):
    """Lit or shaded skin, not its outline: shaded rust or tan cloth passes
    skin_of, and dropped as 'skin over skin' it left the base's arms showing
    through jacket sleeves."""
    return skin_of(a) & (a.min(2) >= 110)


def shifted_min(Ab, Rb, lab, r=6, step=2):
    """Distance from each pixel of Ab to the nearest-coloured pixel of Rb
    within r px, and that pixel's label: a ChatGPT sheet redraws the kept
    pieces a few px off, and a shorts cuff or a shoe moved by 4 px read as
    the new item's own cloth."""
    best = np.full(Ab.shape[:2], np.inf); bl = np.zeros(lab.shape, lab.dtype)
    for dy in range(-r, r + 1, step):
        for dx in range(-r, r + 1, step):
            S = np.roll(np.roll(Rb, dy, 0), dx, 1); L = np.roll(np.roll(lab, dy, 0), dx, 1)
            d = np.sqrt(((Ab - S) ** 2).sum(2)); take = d < best
            best[take] = d[take]; bl[take] = L[take]
    return best, bl


def grow_inside(seeds, area):
    """Multi-label geodesic growth: each pixel of `area` takes the label of
    the nearest seed (labels > 0) reachable through `area`."""
    lab = np.where(area, seeds, 0)
    while True:
        new = lab.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(np.roll(lab, dy, 0), dx, 1)
            take = (new == 0) & area & (s > 0)
            new[take] = s[take]
        if (new == lab).all(): return lab
        lab = new


def shrinkm(m, k):
    for _ in range(k):
        d = m.copy(); d[1:] &= m[:-1]; d[:-1] &= m[1:]; d[:, 1:] &= m[:, :-1]; d[:, :-1] &= m[:, 1:]; m = d
    return m


def near(m, k):
    for _ in range(k):
        d = m.copy(); d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]; m = d
    return m


def basic_seeds(a, sex, rows, n, view, y0=0):
    """Colour cores of the basic outfit pieces (1 bottom, 2 shoes, 3 top)."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    seeds = np.zeros(a.shape[:2], np.int8)
    def shrink(m, k):
        for _ in range(k):
            d = m.copy(); d[1:] &= m[:-1]; d[:-1] &= m[1:]; d[:, 1:] &= m[:, :-1]; d[:, :-1] &= m[:, 1:]; m = d
        return m
    # broad areas only (a print's leaves or petals are not a piece)
    G = (g > r + 8) & (g > b)
    green = G & near(shrink(G, 3), 10)  # the shirt and its hem stitching
    blue = shrink((b > r + 10) & (b >= g), 2)
    lowest = rows >= int(y0 + (n - y0) * .78)  # the lowest fifth of the figure
    tan = (r > g) & (g > b) & (r - b > 60) & (a.min(2) < 200) & (a.max(2) > 170)
    shoe = (tan & lowest & ~blue) if view != 'back' else np.zeros_like(tan)
    seeds[green & ~near(shoe, 25)] = 3  # a shoe's printed leaves stay the shoe's
    seeds[blue] = 1
    seeds[shoe] = 2
    return seeds


def layers_for(sex, view, sheet_img, base_img, slot=None, basic_lab=None, basic_img=None):
    C = CB.FIGURES[f'{sex}:{view}']; box = C['crop']
    A = rgb(sheet_img, box); Ab = rgb(blur(sheet_img), box); Bb = rgb(blur(base_img), box)
    h = A.shape[0]; rows = np.arange(h)[:, None]; top = C['cut'] - box[1]
    fg = figure(A)
    dist = np.sqrt(((Ab - Bb) ** 2).sum(2))
    below = rows >= top
    B = rgb(base_img, box)
    # skin over skin (shading) and an outline beside the base's own outline
    # (a 1-3 px registration offset) are not changes
    dark = lambda x: x.max(2) < 120
    sk = skin_of if basic_lab is None else skin_light
    changed = fg & (dist > CHANGED) & below & ~(sk(A) & sk(B)) & ~(dark(A) & near(dark(B), 3))
    ys = np.where(fg.any(1))[0]; n = ys.max() + 1; y0 = ys.min()
    if basic_lab is None:
        seeds = basic_seeds(A, sex, rows, n, view, y0)
    else:
        # an item: its own new pixels against the basic pieces it kept
        Rb = rgb(blur(basic_img), box); new = np.sqrt(((Ab - Rb) ** 2).sum(2))
        moved, mlab = shifted_min(Ab, Rb, basic_lab)
        k = SLOTS.index(slot) + 1 if slot != 'outfit' else None
        seeds = np.zeros(A.shape[:2], np.int8)
        kept = (new < 22) & (basic_lab > 0)
        seeds[kept] = basic_lab[kept]
        # a kept piece drawn a few px off: its own label, unless it is of
        # this item's slot (a top's new cloth may match the old top nearby)
        off = ~kept & (moved < 22) & (mlab > 0) & (mlab != (k or 3))
        seeds[off] = mlab[off]; kept = kept | off
        mine = new > 60
        if slot == 'outfit': seeds[mine & ~kept] = 3; seeds[mine & ~kept & (basic_lab == 1)] = 1
        else: seeds[mine & ~kept] = k
        # a garment rising above the chin (a hood): new, non-skin, non-hair
        r, g, b = A[..., 0], A[..., 1], A[..., 2]
        hair = (r > g) & (g > b) & (r - b > 25) & (A.max(2) < 170)
        up = fg & (rows < top) & (rows >= top - HOOD_UP) & (new > 60) & ~hair & ~skin_of(A) & (A.max(2) > 110)
        changed |= up; seeds[up] = k or 3
    lab = grow_inside(seeds, changed)
    if basic_lab is None and f'{sex}:{view}' in SHOE_ZONE:
        x0, y1_, x1, y2_ = SHOE_ZONE[f'{sex}:{view}']; zone = np.zeros(lab.shape, bool); zone[y1_:y2_, x0:x1] = True
        shoe = (lab == 2) & zone; lab[(lab == 2) & ~zone] = 0
        lab = grow_inside(np.where(shoe, 0, lab), changed & ~shoe); lab[shoe] = 2
    # Close each piece: small holes (a petal or a cuff as pale as the base's
    # white undershirt) and its own outline (dropped where it ran beside
    # the base's outline) belong to it, or the base shows through as pale
    # streaks along the seams.
    dark = (A.max(2) < 150) & ~skin_of(A)
    pieces = {}
    for i in range(1, 4):
        m = lab == i
        if not m.any(): pieces[i] = m; continue
        m = shrinkm(near(m, 3), 3) & fg & ((lab == i) | (lab == 0))
        m |= near(m, 2) & dark & fg & (lab == 0)
        # above the chin only what hangs from the piece below (a hood)
        if (m & ~below).any():
            keep = m & below
            while True:
                d = near(keep, 1) & m
                if (d == keep).all(): break
                keep = d
            m = keep
        pieces[i] = m
    # Shoes are two solid pieces: bits split off from them (a shirt's print
    # near the knees) belong to the top, and the shoe's own pale insides
    # (white canvas the growth did not reach) are filled.
    s = pieces[2]
    if s.any():
        comp = components(s); sizes = np.bincount(comp.ravel())[1:]
        small = np.isin(comp, 1 + np.where(sizes < .15 * sizes.max())[0]) & s
        pieces[2] = s = s & ~small
        if slot is None or slot == 'top': pieces[3] = pieces[3] | small
        pieces[2] = s | (enclosed(s) & fg & ~pieces[1] & ~pieces[3])
    # White prints (petals) as pale as the base's undershirt read as unchanged;
    # a piece owns the non-skin holes it fully encloses.
    for i in (1, 3):
        if pieces[i].any():
            others = np.zeros_like(fg)
            for j in (1, 2, 3):
                if j != i: others |= pieces[j]
            pieces[i] = pieces[i] | (enclosed(pieces[i]) & fg & ~skin_of(A) & ~others)
    return pieces, A, fg, below


def components(m):
    """4-connected component labels of a mask (0 outside)."""
    lab = np.zeros(m.shape, np.int32); n = 0
    for y, x in zip(*np.where(m)):
        if lab[y, x]: continue
        n += 1; stack = [(y, x)]; lab[y, x] = n
        while stack:
            cy, cx = stack.pop()
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n; stack.append((ny, nx))
    return lab


def enclosed(m):
    """Pixels outside `m` that the border cannot reach without crossing it."""
    out = np.zeros_like(m); free = ~m
    out[0] = free[0]; out[-1] = free[-1]; out[:, 0] = free[:, 0]; out[:, -1] = free[:, -1]
    while True:
        d = near(out, 1) & free
        if (d == out).all(): return free & ~out
        out = d


def save(name, mask, A, skin, box, U):
    ys, xs = np.where(mask)
    if not len(ys):
        if os.path.exists(os.path.join(OUT, name + '.png')): os.remove(os.path.join(OUT, name + '.png'))
        return None
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    m = mask[by0:by1, bx0:bx1]; o = np.zeros(m.shape + (4,), np.uint8)
    o[..., :3] = A[by0:by1, bx0:bx1] * m[..., None]
    # alpha 254 marks skin (tinted at runtime), 255 cloth and lines
    o[..., 3] = np.where(m, np.where(skin[by0:by1, bx0:bx1], 254, 255), 0)
    Image.fromarray(o).save(os.path.join(OUT, name + '.png'), optimize=True)
    p, q = U(box[0] + bx0, box[1] + by0), U(box[0] + bx1, box[1] + by1)
    return [p[0], p[1], round(q[0] - p[0], 4), round(q[1] - p[1], 4)]


def frame(sex, view):
    C = CB.FIGURES[f'{sex}:{view}']; box = C['crop']
    ref = np.asarray(Image.open(os.path.join(ROOT, C['src'])).convert('RGB')).astype(int)[box[1]:box[3], box[0]:box[2]]
    floor = box[1] + int(np.where(figure(ref).any(1))[0].max()) + 1
    U = lambda px, py: [round(16 + (px - C['cx']) * C['k'], 4), round(46.05 - (floor - py) * C['k'], 4)]
    return C, box, U


def load_json():
    p = os.path.join(OUT, 'layers.json')
    return json.load(open(p)) if os.path.exists(p) else {}


def build_base():
    data = {}
    for sex in 'mf':
        bases = CB.register(os.path.join(ROOT, BASE[sex]), sex)
        for view in CB.VIEWS:
            C, box, U = frame(sex, view)
            basic = Image.open(os.path.join(ROOT, C['src'])).convert('RGB')
            lab, A, fg, below = layers_for(sex, view, basic, bases[view])
            Bfull = rgb(bases[view], box); Bfg = figure(Bfull)
            # the base: everything of the base sheet below the chin (a 12-row
            # neck under the runtime head)
            top = C['cut'] - box[1]; rows = np.arange(Bfull.shape[0])[:, None]
            base_mask = Bfg & (rows >= top - 12)
            entry = {'seat': C['seat'], 'unit': C['k'], 'frame': U(*box[:2]) + [round((box[2] - box[0]) * C['k'], 4), round((box[3] - box[1]) * C['k'], 4)], 'layers': {}}
            entry['layers']['base'] = save(f'{sex}-{view}-base', base_mask, Bfull, skin_of(Bfull), box, U)
            sk = skin_of(A)
            for i, slot in enumerate(SLOTS, 1):
                entry['layers'][BASIC[slot]] = save(f'{sex}-{view}-{BASIC[slot].replace(":", "-")}', lab[i], A, sk, box, U)
            L = np.zeros(A.shape[:2], np.int8)
            for i in (1, 2, 3): L[lab[i] & (L == 0)] = i
            np.save(os.path.join(OUT, f'.{sex}-{view}-basic-lab.npy'), L)
            old = load_json().get(sex, {}).get(view, {}).get('layers', {})
            entry['layers'].update({k: v for k, v in old.items() if k not in entry['layers']})
            data.setdefault(sex, {})[view] = entry
            print(sex, view, {k: (v and v[2]) for k, v in entry['layers'].items()})
    json.dump(data, open(os.path.join(OUT, 'layers.json'), 'w'), ensure_ascii=False, indent=1)


MANIFEST = os.path.join(OUT, 'items.json')


def build_item(sheet, sex, slot, item):
    sheet = os.path.relpath(os.path.abspath(sheet), ROOT)
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else []
    man = [m for m in man if not (m['sex'] == sex and m['item'] == item)] + [{'sex': sex, 'slot': slot, 'item': item, 'sheet': sheet}]
    json.dump(man, open(MANIFEST, 'w'), ensure_ascii=False, indent=1)
    sheet = os.path.join(ROOT, sheet)
    data = load_json(); bases = CB.register(os.path.join(ROOT, BASE[sex]), sex); items = CB.register(sheet, sex)
    for view in CB.VIEWS:
        C, box, U = frame(sex, view)
        basic = Image.open(os.path.join(ROOT, C['src'])).convert('RGB')
        blab = np.load(os.path.join(OUT, f'.{sex}-{view}-basic-lab.npy'))
        lab, A, fg, below = layers_for(sex, view, items[view], bases[view], slot, blab, basic)
        k = 3 if slot == 'outfit' else SLOTS.index(slot) + 1
        mask = lab[k] | (lab[1] if slot == 'outfit' else False)
        # Seam: where the sheet has cloth next to the item but neither the
        # item nor the kept basic pieces cover it, the base's white
        # undershirt or undershorts showed as a thin strip (a shirt hem
        # ending above the basic shorts' waistband). The item takes the
        # sheet's pixels there.
        others = np.isin(blab, [i for i in (1, 2, 3) if i != k and not (slot == 'outfit' and i == 1)])
        B = rgb(bases[view], box); white = lambda x: (x.min(2) > 200) & (x.max(2) - x.min(2) < 30)
        gap = fg & below & ~mask & ~others & white(B) & ~white(A) & ~skin_light(A) & near(mask, 8)
        mask = mask | gap
        tint = skin_of(A) & near(skin_light(A), 2)
        data[sex][view]['layers'][item] = save(f'{sex}-{view}-{item.replace(":", "-")}', mask, A, tint, box, U)
        print(sex, view, item, data[sex][view]['layers'][item])
    json.dump(data, open(os.path.join(OUT, 'layers.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    if sys.argv[1] == 'base': build_base()
    elif sys.argv[1] == 'item': build_item(*sys.argv[2:6])
    elif sys.argv[1] == 'all':
        build_base()
        for m in json.load(open(MANIFEST)): build_item(m['sheet'], m['sex'], m['slot'], m['item'])
