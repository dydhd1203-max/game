"""Check every seated (floor-sit) shop item layer against its own sheet.

  python3 tools/verify-seated-items.py [m:top:shirt ...] [--out DIR]

For each item of assets/seated/items.json (tools/seated-layers.py) and each
view it composes the layers as the runtime does (avatar-foundation.js
seatPicture: base, then bottom, shoes and top or outfit, the item in its
slot and the basic outfit elsewhere) on the sheet's crop and compares the
part below the chin with the sheet placed on the same frame
(tools/seated-cut-body.py register):

  fit     share of the item layer and a 3 px ring around it (where the item
          or the bare base is on top) whose colour matches the sheet within
          2 px (blurred distance <= 70): low when the item is misplaced,
          doubled or carries pieces of another slot
  holes   pixels near the item (12 px) where the sheet has cloth but the
          base's white undershirt or undershorts shows through (a missed
          piece of the item), as a share of the item layer
  neck    share of the neck the sheet shows (skin within 40 px below the
          chin cut) that the game shows as skin too: a collar placed too
          high hid the neck (2026-10-15)
  shoe_move  px the sheet's own sneakers sit off the base's (bottoms and
          one-pieces): over 40 the sheet was drawn with a shorter body and is
          asked for again
  pose    figure overlap (IoU) of the composite and the sheet below the
          chin: a warning only, since the kept pieces are the basic
          outfit's and ChatGPT redraws them a little differently
  leaks   item pixels where the sheet is background
  tint    item pixels marked skin (alpha 254, tinted to the avatar's skin)
          that are not skin coloured: pink or rust cloth taken for skin
  colour  share of the figure whose colour differs from the sheet (blurred
          distance > 70), reported, not judged: the kept pieces are the
          basic outfit's, not the sheet's redrawing of them

and checks that the item list, the layer table, the pictures on disk, the
runtime table and the deployment list agree, and that no layer is cut at
its view's box edge (a picture missing from the
deployment is a 404 that leaves a seated avatar without a body). It
writes one 280 px board per item (composite | sheet | differences:
red holes, blue leaks, magenta tint, yellow colour) to look at. A pass here
is not approval. Introduced 2026-10-15 after a jacket's sleeves were dropped
as 'skin' and a pink hood lost its sleeves while every render looked whole
at a glance. The runtime side (the picture kept on later frames) is
tools/verify-seated-runtime.cjs.
"""
import sys, os, json, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('L', os.path.join(ROOT, 'tools/seated-layers.py'))
L = importlib.util.module_from_spec(spec); argv = sys.argv; sys.argv = ['x']; spec.loader.exec_module(L); sys.argv = argv
CB = L.CB
MIN_NECK = .8
# fit and holes set against items checked by eye at 280 px (a legging at
# 1.6 % holes and cargo shorts at 0.898 fit look right, 2026-10-15)
MIN_FIT, MAX_HOLES, MAX_LEAKS, MAX_TINT, WARN_POSE = .89, .02, .01, .002, .93
MAX_SHOE_MOVE = 40  # px the sheet's own sneakers may sit off the base's (bottoms, one-pieces)
BASIC = {'bottom': 'bottom:shorts', 'shoes': 'shoes:sneaker', 'top': 'top:tee'}


def compose(sex, view, item, slot, data):
    """RGBA composite on the crop and, per pixel, the index of the layer on top."""
    C = CB.FIGURES[f'{sex}:{view}']; x0, y0, x1, y1 = L.crop_box(sex, view); e = data[sex][view]
    fx, fy = e['frame'][:2]; k = e['unit']
    # as avatar-foundation.js seatLayers: a one-piece takes the top's and
    # the bottom's place (shopItems lists no bottom with an outfit)
    order = ['shoes', 'outfit'] if slot == 'outfit' else ['bottom', 'shoes', 'top']
    names = ['base'] + [item if s == slot else BASIC[s] for s in order]
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); owner = np.full(out.shape[:2], -1, np.int8)
    for i, n in enumerate(names):
        r = e['layers'].get(n)
        if not r: continue
        im = np.asarray(Image.open(os.path.join(ROOT, 'assets/seated', f'{sex}-{view}-{n.replace(":", "-")}.png')).convert('RGBA'))
        ox, oy = round((r[0] - fx) / k), round((r[1] - fy) / k); h, w = im.shape[:2]
        reg = out[oy:oy + h, ox:ox + w]; m = im[..., 3] > 0
        reg[m] = im[m]; owner[oy:oy + h, ox:ox + w][m] = i
    return out, owner, names


def check(sex, item, slot, sheet, data, outdir):
    reg = L.item_sheets(os.path.join(ROOT, sheet), sex, slot, cached=True); res = {}; tiles = []
    for view in CB.VIEWS:
        C = CB.FIGURES[f'{sex}:{view}']; box = L.crop_box(sex, view); top = C['cut'] - box[1]
        A = L.rgb(reg[view], box); fgA = L.figure(A)
        out, owner, names = compose(sex, view, item, slot, data)
        G = out[..., :3].astype(float); fgG = out[..., 3] > 0
        rows = np.arange(A.shape[0])[:, None]; below = rows >= top
        mine = owner == names.index(item)
        shape = ((fgA & fgG & below).sum()) / max(1, ((fgA | fgG) & below).sum())
        white = lambda x: (x.min(2) > 200) & (x.max(2) - x.min(2) < 30)
        cloth = fgA & ~L.skin_of(A) & ~white(A) & (A.max(2) > 60)
        # the base's own pale undershirt / undershorts showing where the sheet has cloth
        hole = below & cloth & (owner == 0) & white(G) & ~L.near(white(A), 2) & L.near(mine, 12)
        leak = mine & ~L.near(fgA, 2)
        tinted = mine & (out[..., 3] == 254)
        Gf = np.asarray(Image.fromarray(out[..., :3]).filter(ImageFilter.GaussianBlur(1.5))).astype(float)
        Af = L.rgb(L.blur(reg[view]), box)
        # within 2 px: placing a sheet on the base is good to a pixel or two
        far, _ = L.shifted_min(Gf, Af, np.zeros(Af.shape[:2], np.int8), r=2, step=1); far = far > 70
        colour = below & fgA & fgG & far
        # what the item's layer and the bare base around it show; a kept
        # basic piece drawn over it (a shirt over a skirt's waist) is the
        # basic outfit's, which ChatGPT redraws its own way
        # the basic sneakers the game shows under another item should be where
        # the sheet draws shoes: a hanbok sheet with a shorter body showed
        # its own shoes higher up and the sneakers below (2026-10-15)
        sneak = (owner == names.index(BASIC['shoes'])) & below if slot != 'shoes' and BASIC['shoes'] in names else np.zeros_like(below)
        ring = L.near(mine, 3) & below & (fgA | fgG) & ((owner == names.index(item)) | (owner <= 0))
        fit = 1 - (ring & (far | (fgA != fgG))).sum() / max(1, ring.sum())
        shoes = 1 - (sneak & far).sum() / sneak.sum() if sneak.sum() > 300 else 1.0
        # a sheet drawn with a shorter body: its sneakers far from the base's.
        # The cut drops them from the item, but what is left around them
        # still shows; such a sheet is asked for again (a hanbok, 58 px)
        moved = 0
        if slot in ('bottom', 'outfit'):
            blab = np.load(os.path.join(ROOT, 'assets/seated', f'.{sex}-{view}-basic-lab.npy'))
            offs, _, dd = L.sheet_shoes(Af, L.rgb(L.blur(Image.open(os.path.join(ROOT, C['src'])).convert('RGB')), box), blab)
            if offs and dd < L.SHOE_MATCH: moved = max(int(np.hypot(*o)) for o in offs)
        # tint check on the item's own pixels: skin-marked but pink (green
        # under blue) or bright, strongly saturated cloth (rust: saturation
        # .75); the skin's shading and red-brown outline (.5) are tinted like
        # the base's
        r, g, b = G[..., 0], G[..., 1], G[..., 2]
        sat = (G.max(2) - G.min(2)) / np.maximum(G.max(2), 1)
        wrong = tinted & ((g - b < -4) | ((sat > .6) & (G.max(2) >= 150)))
        n = max(1, mine.sum())
        band = (rows >= top) & (rows < top + 40)
        neckA = band & L.skin_light(A) & fgA; neckG = L.skin_of(G) & fgG
        # only what can reach the neck (shoes or a skirt cannot; the nape
        # ChatGPT redraws under the hair is the basic outfit's)
        neck = (neckA & neckG).sum() / neckA.sum() if neckA.sum() > 200 and slot in ('top', 'outfit') else 1.0
        res[view] = {'fit': round(float(fit), 3), 'shoe_move': moved, 'shoes': round(float(shoes), 3), 'neck': round(float(neck), 3), 'pose': round(float(shape), 3), 'holes': round(float(hole.sum() / n), 4), 'leaks': round(float(leak.sum() / n), 4),
                     'tint': round(float(wrong.sum() / n), 4), 'colour': round(float(colour.sum() / max(1, (below & fgA).sum())), 3)}
        res[view]['warn'] = ['pose'] if shape < WARN_POSE else []
        res[view]['fail'] = [k for k, bad in (('fit', fit < MIN_FIT), ('shoe_move', moved > MAX_SHOE_MOVE), ('neck', neck < MIN_NECK), ('holes', res[view]['holes'] > MAX_HOLES),
                                              ('leaks', res[view]['leaks'] > MAX_LEAKS), ('tint', res[view]['tint'] > MAX_TINT)) if bad]
        comp = Image.new('RGB', (A.shape[1], A.shape[0]), 'white'); comp.paste(Image.fromarray(out), (0, 0), Image.fromarray(out[..., 3]))
        d = np.full(A.shape, 255, np.uint8); d[fgA] = (A[fgA] * .35 + 165).astype(np.uint8)
        d[colour] = (240, 210, 40); d[wrong] = (220, 0, 220); d[leak] = (30, 80, 230); d[L.near(hole, 1)] = (230, 20, 20)
        for t in (comp, Image.fromarray(A.astype(np.uint8)), Image.fromarray(d)):
            tiles.append(t.resize((round(t.width * 280 / t.height), 280), Image.LANCZOS))
    W = sum(t.width + 8 for t in tiles); board = Image.new('RGB', (W, 300), 'white'); x = 0; dr = ImageDraw.Draw(board)
    for i, t in enumerate(tiles):
        board.paste(t, (x, 20)); dr.text((x + 3, 3), f"{CB.VIEWS[i // 3]} {['game', 'sheet', 'diff'][i % 3]}", fill=(200, 0, 0)); x += t.width + 8
    board.save(os.path.join(outdir, f'{sex}-{item.replace(":", "-")}.png'))
    return res


def consistency(data, man):
    """Problems between items.json, layers.json, the pictures, SEATED_LAYERS
    and tools/deployment-files.cjs."""
    bad = []; listed = {m['sex'] + ':' + m['item'] for m in man}
    deploy = open(os.path.join(ROOT, 'tools/deployment-files.cjs')).read()
    runtime = open(os.path.join(ROOT, 'avatar-foundation.js')).read()
    for m in man:
        if not os.path.exists(os.path.join(ROOT, m['sheet'])): bad.append('sheet missing: ' + m['sheet'])
    for sex, views in data.items():
        for view, e in views.items():
            for m in man:
                if m['sex'] == sex and m['item'] not in e['layers']: bad.append(f"{sex}:{m['item']} has no {view} layer")
            for name, rect in e['layers'].items():
                if name not in ('base',) + tuple(BASIC.values()) and sex + ':' + name not in listed: bad.append(f'{sex}:{name} ({view}) is not in items.json')
                if not rect: continue
                url = f"assets/seated/{sex}-{view}-{name.replace(':', '-')}.png"
                if not os.path.exists(os.path.join(ROOT, url)): bad.append('picture missing: ' + url)
                if "'" + url + "'" not in deploy: bad.append('not deployed: ' + url)
                if "url:'" + url + "'" not in runtime: bad.append('not in SEATED_LAYERS: ' + url + ' (python3 tools/seated-sync.py)')
                # a layer reaching the box's edge was cut there (a hanbok's
                # spread skirt, 2026-10-15): grow MARGIN in tools/seated-layers.py
                a = np.asarray(Image.open(os.path.join(ROOT, url)))[..., 3] > 0; fx, fy, fw, fh = e['frame']; k = e['unit']
                for side, at, edge in (('left', abs(rect[0] - fx) < 1.5 * k, a[:, 0]), ('right', abs(rect[0] + rect[2] - fx - fw) < 1.5 * k, a[:, -1]),
                                       ('bottom', abs(rect[1] + rect[3] - fy - fh) < 1.5 * k, a[-1])):
                    if at and edge.sum() > 20: bad.append(f'cut at the box {side} ({edge.sum()} px): {url}')
    return bad


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, '검증', '앉은옷')
    if '--out' in sys.argv: args.remove(out)
    os.makedirs(out, exist_ok=True)
    data = json.load(open(os.path.join(ROOT, 'assets/seated/layers.json')))
    man = json.load(open(os.path.join(ROOT, 'assets/seated/items.json')))
    failed = False; report = {}
    for b in consistency(data, man): print('FAIL', b); failed = True
    todo = [m for m in man if not args or f"{m['sex']}:{m['item']}" in args]
    # four at a time: the items are independent (one at a time took 10 min)
    import multiprocessing as mp
    with mp.get_context('fork').Pool(4) as pool:
        results = pool.starmap(check, [(m['sex'], m['item'], m['slot'], m['sheet'], data, out) for m in todo])
    for m, r in zip(todo, results):
        key = f"{m['sex']}:{m['item']}"; report[key] = r
        bad = {v: x['fail'] for v, x in r.items() if x['fail']}; failed |= bool(bad)
        print(key, ' | '.join(f"{v} fit {x['fit']} shoes {x['shoes']} neck {x['neck']} pose {x['pose']} holes {x['holes']} leaks {x['leaks']} tint {x['tint']} colour {x['colour']}" for v, x in r.items()), 'FAIL ' + json.dumps(bad) if bad else 'ok')
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), indent=1)
    print('FAIL' if failed else 'PASS (still look at the 280 px boards in ' + out + ')'); sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
