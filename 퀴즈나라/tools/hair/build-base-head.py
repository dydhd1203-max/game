"""H5 base head from the returned bald sheets (assets/hair-template/sources/민머리-<남자|여자>-*.png, the
'목 없는 민머리' request on the hair template): the head layers every new hairstyle is drawn on.

  python3 -B tools/hair/build-base-head.py [--old 검증/머리/옛머리] [--board 검증/머리/민머리]

  - The sheet lies on the template's own grid (made from it, nothing moved: checked, the body matches with no
    shift), so each reference view's source pixel maps to a sheet pixel through 머리-그림틀.json.
  - The head is the sheet's paint that differs from the body alone (머리-그림틀-몸-*.png), plus the paint the
    body's hidden neck column happens to match above the neck cut (front: the jaw; profile, back: the stub zone
    of heads-spec.json, nothing below v 27 beside it). No neck: the body has it.
  - Skull, forehead, brows, ears and nape come from the sheet, its skin turned back into the body's sheet paint
    (the inverse of tone 0's toneMatrix: the sheet was drawn on the tone-0 template), its ink kept, its brows
    into the hair layer (dyed like hair). The eyes and the mouth come from the reference style's converted
    layers (f bob, m short), with their iris layer and blink covers, so expressions and blinks fit as today.
  - Writes assets/sd-hair-base-<m|f>.webp and their entries ('m:base', 'f:base') in assets/sd-hair-data.js
    (and assets/sd-hair-base.json, which build-heads.py build merges in again).
"""
import json
import os
import sys
import hashlib
import importlib.util

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
import headlib as HL  # noqa: E402
from avatar_build import matte as M  # noqa: E402

_spec = importlib.util.spec_from_file_location('bh', os.path.join(HERE, 'build-heads.py'))
BH = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BH)
_spec = importlib.util.spec_from_file_location('mbh', os.path.join(HERE, 'make-base-head.py'))
MB = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(MB)

TPL = os.path.join(ROOT, 'assets', 'hair-template')
SOURCES = {'m': 'sources/민머리-남자-chatgpt-2026-10-17.png', 'f': 'sources/민머리-여자-chatgpt-2026-10-17.png'}
REFERENCE = {'m': 'short', 'f': 'bob'}
TONE0, HAIR1 = '#ffe2cc', '#5a3a24'        # PAL.skin[0], PAL.hair[1]: the template's skin tone and hair colour
VIEWS = ('front', 'profile', 'back')
BODY_DE, INK_L = 40, 150                   # body match (max channel); paint darker than this is ink (split with the skin)


GAIN = {}
BROW_IN_EYES = {}


def sheet_maps(sex):
    """The sheet's straight colour and alpha (on white) and where it is head, in template pixels."""
    A = np.asarray(Image.open(os.path.join(TPL, SOURCES[sex])).convert('RGB')).astype(np.float64)
    B = np.asarray(Image.open(os.path.join(TPL, '머리-그림틀-몸-%s.png' % sex)).convert('RGB')).astype(np.float64)
    # antialiased edges against the white ground (253-255; ChatGPT leaves a faint 245-252 halo round the figure)
    a = np.clip((250 - A.min(2)) / 36., 0, 1)
    # only the outline's antialiasing is see-through: inside the figure light paint (the crown's highlight) is
    # opaque skin, not the ground showing through (that read as a grey blotch on any other background); the
    # figure is the clear paint (the halo counted as figure made an opaque white rim)
    inside = M.erode(HL.fill_holes(A.min(2) < 240), 2)
    a = np.where(inside, 1., a)
    # next to the ground a light pixel is the darkest paint beside it thinned by the white (a dark outline's light
    # grey edge is ink at a low alpha, not opaque grey: it showed as a white rim outside the outline)
    lum = HL.lum_skin(A)
    dark, dark_l = A.copy(), lum.copy()
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            sh, sl = np.roll(A, (dy, dx), (0, 1)), np.roll(lum, (dy, dx), (0, 1))
            d = sl < dark_l
            dark[d], dark_l[d] = sh[d], sl[d]
    rim = M.dilate(~HL.fill_holes(A.min(2) < 235), 3) & ~inside & (lum > dark_l + 20)
    a = np.where(rim, np.minimum(a, np.clip((255 - lum) / np.maximum(255 - dark_l, 1), 0, 1)), a)
    col = np.where(a[..., None] > .02, (A - 255 * (1 - a[..., None])) / np.maximum(a[..., None], .02), 255)
    body = (B.min(2) < 245) & (np.abs(A - B).max(2) < BODY_DE)
    head = (a > .02) & ~body
    return np.clip(col, 0, 255), a, head, body


def bilinear(img, x, y):
    h, w = img.shape[:2]
    x = np.clip(x - .5, 0, w - 1.001)
    y = np.clip(y - .5, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    if img.ndim == 3:
        fx, fy = fx[..., None], fy[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) +
            img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)


def neck_cut(head, v, view, spec, U, V):
    """(where body-matched paint is head: above the neck's cut, inside the cut's columns; where the sheet's head may
    be at all). Front: above the smoothed jaw line +.1 (beside it its end's height +1, the ears' lobes); profile
    and back: above the stub zone (all of the sheet's nape there: the body's neck top is a light band that hair
    used to hide), beside it down to the chin line (v 28), the zone itself and below it never."""
    shape = U.shape
    if view == 'front':
        jx = np.array([p[0] for p in v['jaw']])
        jy = np.array([p[1] for p in v['jaw']])
        # the reference's measured jaw steps (f: .7 at the chin's corners); the sheet's chin is a smooth curve
        jy = np.array([jy[np.abs(jx - x) <= .75].mean() for x in jx])
        inner = (U >= jx.min()) & (U <= jx.max())
        under = V < np.interp(U, jx, jy) + np.where(inner, .1, 1.)    # beside the jaw: the ears' lobes, never the shirt
        return under & inner, under
    # the zone's notches above v 27.4 were cut for the old paintings' neck stubs; the sheet's nape and the shadow
    # under its jaw run there (cut, they left a step under the ear). Back: the sheet's neck down to the chin line
    # (the body's neck behind has thick dark sides and, f, ink bits at the collar that hair used to hide)
    region = HL.poly_mask(spec['stub'][head['sex']][view], head, shape) & (V > (28 if view == 'back' else 27.4))
    cols = region.any(0)
    top = np.where(cols, np.argmax(region, 0), shape[0])       # the zone's top row per column
    rows = np.arange(shape[0])[:, None]
    above = (rows < top[None, :]) & cols[None, :]
    # beside the zone: down to the chin line (v 28 in head units): the nape's curve, the jaw and the throat's top;
    # the neck's sides and the collar never
    beside = ~cols[None, :] & (V < 28)
    return above, above | beside


def base_view(sex, view, maps, meta_t, head, layers, v, spec):
    col, a, head_t, body_t = maps
    shape = layers['skin'].shape[:2]
    U, V = HL.units_of(head, shape)
    m = meta_t['sexes'][sex]['views'][view]['ctm']
    X, Y = m[0] * U + m[2] * V + m[4], m[1] * U + m[3] * V + m[5]
    c = bilinear(col, X, Y)
    al = bilinear(a, X, Y)
    hd = bilinear(head_t.astype(np.float64), X, Y)
    bd = bilinear(body_t.astype(np.float64), X, Y)
    fill, allowed = neck_cut(head, v, view, spec, U, V)
    near = M.dilate(hd > .5, 6) if view == 'front' else np.ones(shape, bool)
    keep = ((hd > .5) | ((bd > .5) & fill & near)) & allowed
    keep = HL.fill_holes(keep) & allowed
    lab, n, sizes = M.label(keep)      # one piece: the shirt's redrawn bits below are not the head
    if n > 1:
        keep = lab == np.argmax(sizes[1:]) + 1
    alpha = al * MB.soft_mask(keep, .8)
    if view != 'front':     # over the body's neck the cut fades out over 4 px (a straight edge showed across the neck)
        cover = M.erode(HL.body_cover(head, shape), 1)
        alpha *= np.where(cover, MB.smoothstep(0, 4, MB.distance_from(~allowed, shape, 5)), 1)
    L = HL.lum_skin(c)
    # skin of the sheet: the light paint; ink: darker paint, split with the local skin by luminance
    skin_m = (L >= INK_L) & (alpha > .5)
    skin_ref, wsum = HL.box_mean(c, skin_m.astype(np.float64), 6)
    skin_ref = np.where(wsum[..., None] > .5, skin_ref, np.median(c[skin_m], axis=0))
    ink = np.median(c[(L < 110) & (alpha > .8)], axis=0) if ((L < 110) & (alpha > .8)).any() else np.array([90., 50., 40.])
    Ls, Li = HL.lum_skin(skin_ref), HL.lum_skin(ink[None])[0]
    share = np.clip((Ls - L) / np.maximum(Ls - Li, 1), 0, 1)
    share[L >= INK_L] = 0
    # brows: the dark brown strokes in a band above the eyes go to the hair layer (they take the dye)
    brow = np.zeros(shape, bool)
    if view != 'back':
        tops = []
        if view == 'front':
            for e, box in zip(v['eyes'], head['eyes']):
                tops.append((e[0], V[int(box['top']), int((box['left'] + box['right']) / 2)], 3.2))
        else:
            ex = head['eye']
            tops.append((U[int(ex['top']), int((ex['left'] + ex['right']) / 2)], V[int(ex['top']), int((ex['left'] + ex['right']) / 2)], 2.6))
        for ex_, top, half in tops:
            band = (np.abs(U - ex_) < half) & (V > top - 2.8) & (V < top - .35)
            brow |= band & (share > .25) & (c[..., 0] > c[..., 2] + 12)
        brow = M.dilate(brow, 1) & (share > .05) & ~((c[..., 2] > c[..., 0]))
    # the reference's eyes: its lashes, whites and irises (fixed and iris paint reaching the eye's box, and the
    # lashes its hair layer holds: dark hair within 12 px of that ink; the m short profile's thick upper lash sits
    # above its eye box), 4 px around
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    eyes = np.zeros(shape, bool)
    paste = np.zeros(shape, bool)
    lash = np.zeros(shape, bool)
    if view != 'back':
        hair_a = layers['hair'][..., 3] / 255.
        box, inner = np.zeros(shape, bool), np.zeros(shape, bool)
        for e in (head['eyes'] if view == 'front' else [head['eye']]):
            box |= (xx > e['left'] - 20) & (xx < e['right'] + 20) & (yy > e['top'] - 28) & (yy < e['bottom'] + 6)
            inner |= (xx > e['left']) & (xx < e['right']) & (yy > e['top']) & (yy < e['bottom'])
        ink_r = ((layers['fixed'][..., 3] > 25) | (layers['iris'][..., 3] > 25)) & box
        lab, _, _ = M.label(ink_r)
        ids = np.unique(lab[ink_r & inner])
        ink_r = np.isin(lab, ids[ids > 0])
        # dark hair by the eye's own ink: its lashes (the m short ones are mostly hair); the locks are lighter
        lash = (hair_a > .02) & M.dilate(ink_r, 12) & (layers['hair'][..., 0] < 40) & box
        ref = ink_r | lash
        lab, _, _ = M.label(ref)
        ids = np.unique(lab[ref & inner])
        paste = HL.fill_holes(M.dilate(np.isin(lab, ids[ids > 0]), 4)) & box & keep
        eyes = paste & ~M.dilate(~keep, 3)
        # the sheet's lash strokes reaching that go whole (its wing lashes reached past the reference's eye; its
        # upper lash fell in the brow band and was dyed); the face's outline (4 px from the edge) stays
        ink_m = (share > .2) & ~M.dilate(~keep, 4)
        lab, _, _ = M.label(ink_m)
        ids = np.unique(lab[ink_m & eyes])
        drop = (eyes | (M.dilate(np.isin(lab, ids[ids > 0]), 1) & ~M.dilate(~keep, 4)))
        if view == 'front':      # where the reference's locks hide its eye (f bob's outer corners) its lash stays
            drop &= ~((hair_a > .02) & ~lash)
        BROW_IN_EYES[(head['sex'], view)] = int((brow & drop).sum())
        brow &= ~drop
    else:
        drop = np.zeros(shape, bool)
    # the skin keeps the sheet's own shading (a shadow under the jaw is skin, not ink: split, it turned grey); a
    # pixel with an ink share (or whose lash went) takes the nearby light skin under it
    skin_px = np.where((share[..., None] > 0) | drop[..., None], skin_ref, c)
    share = np.where(drop, 0, share)
    # a brow's own colour under its share of the skin (the mixed pixel's colour dyed again read grey)
    brow_c = np.clip((c - (1 - share[..., None]) * skin_ref) / np.maximum(share[..., None], .05), 0, 255)
    tone = BH.tone_matrix(TONE0)
    sheet_skin = skin_px.reshape(-1, 3) @ np.linalg.inv(tone).T
    # a highlight past 255 keeps its hue (clipping one channel greyed it), then the sheet's skin is matched to the
    # reference's own skin paint where both paint the face (ChatGPT's skin drifts a little)
    sheet_skin = sheet_skin * np.minimum(1, 255 / np.maximum(sheet_skin.max(1, keepdims=True), 1))
    sheet_skin = sheet_skin.reshape(shape + (3,))
    both = (layers['skin'][..., 3] > 250) & skin_m & ~M.dilate(layers['hair'][..., 3] > 0, 3)
    if view != 'back' and both.sum() > 200:
        gain = np.median(layers['skin'][both][:, :3], axis=0) / np.maximum(np.median(sheet_skin[both], axis=0), 1)
        sheet_skin = np.clip(sheet_skin * gain, 0, 255)
        GAIN[(head['sex'], view)] = gain
    elif (head['sex'], 'front') in GAIN:
        sheet_skin = np.clip(sheet_skin * GAIN[(head['sex'], 'front')], 0, 255)
    hair = HL.hexrgb(HAIR1)
    lum = np.clip(102. * (brow_c @ hair) / (hair @ hair), 0, 255)
    st = MB.Stack(shape)
    st.over('skin', sheet_skin, alpha)
    st.over('fixed', np.broadcast_to(ink, shape + (3,)), alpha * share * ~brow)
    st.over('hair', np.stack([lum, np.zeros(shape), lum], -1), alpha * np.where(brow, np.maximum(share, .0), 0))
    # the reference's eyes (with their lash pieces of its hair layer) and mouth: the iris and the blink covers fit
    # them; faded into the sheet's skin over 3 px, where both are skin; the reference's hair outlines outside never
    if view != 'back':
        core = paste.copy()
        if view == 'front':
            core |= HL.feature_core(head, shape) & (V > np.mean([e[1] for e in v['eyes']]) + 1.5)
        w = MB.smoothstep(0, 3, MB.distance_from(~core, shape, 4)) * core
        # a lash cut by the box ends in a 6 px taper, not a straight end
        w_lash = MB.smoothstep(0, 6, MB.distance_from(~(box & keep), shape, 7)) * core
        locks = (layers['hair'][..., 3] > 5) & ~lash
        fixed = layers['fixed'].copy()
        fixed[M.dilate(locks, 6) & ~core, 3] = 0
        hair_l = layers['hair'].copy()
        hair_l[~lash, 3] = 0
        for name, img in (('skin', layers['skin']), ('fixed', fixed), ('iris', layers.get('iris')), ('hair', hair_l)):
            if img is not None:
                st.over(name, img[..., :3], img[..., 3] / 255. * (w_lash if name == 'hair' else w))
    out = st.layers()
    for k, img in layers.items():
        if k.startswith('blink'):
            out[k] = img
    return out, keep


def trim(img):
    """uint8 RGBA, cut to its painted box: (img, (x, y)) or None."""
    out = np.clip(np.round(img), 0, 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    ys, xs = np.nonzero(out[..., 3])
    if not len(ys):
        return None
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (int(xs.min()), int(ys.min()))


def entry_of(sex, ref, views):
    """Atlas and sd-hair-data.js entry of one base head: the reference style's placement, eyes, jaw and landmarks
    (the face is the reference's), the new layers."""
    flat = {}
    for view, layers in views.items():
        for k, img in layers.items():
            img = img.copy()
            if k == 'hair':     # R = B = brush luminance, G = its shine (build-heads.py build)
                img[..., 1] = np.maximum(0, img[..., 0] - 160) * .38
            t = trim(img)
            if t:
                flat[(view, k)] = t
    pos, (W, H) = BH.pack({k: v[0] for k, v in flat.items()})
    atlas = np.zeros((H, W, 4), np.uint8)
    for k, (img, _) in flat.items():
        x, y = pos[k]
        atlas[y:y + img.shape[0], x:x + img.shape[1]] = img
    name = 'sd-hair-base-%s.webp' % sex
    path = os.path.join(ROOT, 'assets', name)
    Image.fromarray(atlas).save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    entry = {'sex': sex, 'shape': 'base', 'tile': ref['tile'], 'file': 'assets/' + name, 'sha256': BH.sha(path),
             'size': [W, H], 'base': {'reference': '%s:%s' % (sex, REFERENCE[sex]), 'sheet': SOURCES[sex],
                                      'sheetSha256': BH.sha(os.path.join(TPL, SOURCES[sex]))}, 'views': {}}
    for view in VIEWS:
        rv = ref['views'][view]
        k_, (ux0, uy0) = rv['k'], rv['origin']
        v = {kk: rv[kk] for kk in ('k', 'origin', 'registration', 'jaw', 'eyes', 'landmarks', 'eyeWidth') if kk in rv}
        v['layers'] = {}
        for (vw, lk), (img, at) in sorted(flat.items()):
            if vw == view:
                x, y = pos[(vw, lk)]
                hh, ww = img.shape[:2]
                v['layers'][lk] = [x, y, ww, hh, round(ux0 + at[0] * k_, 4), round(uy0 + at[1] * k_, 4), round(ww * k_, 4), round(hh * k_, 4)]
        ax, ay, w, hh = v['layers']['skin'][:4]
        px = atlas[ay:ay + hh, ax:ax + w].reshape(-1, 4)
        px = px[px[:, 3] > 250][:, :3].astype(np.float64)
        px = px[HL.lum_skin(px) >= 200]
        v['faceTone'] = '#%02x%02x%02x' % tuple(int(round(c_)) for c_ in np.median(px, axis=0)) if len(px) else rv.get('faceTone')
        entry['views'][view] = v
    return entry


def merge_into_data(base, path=os.path.join(ROOT, 'assets', 'sd-hair-data.js')):
    """Put the base heads' entries into sd-hair-data.js (build-heads.py build does the same from sd-hair-base.json)."""
    js = open(path).read()
    head, body = js.split('window.QPHairData=', 1)
    data = json.loads(body.rstrip().rstrip(';'))
    data['styles'].update(base['styles'])
    open(path, 'w').write(head + 'window.QPHairData=' + json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + ';\n')


def main(argv):
    opt = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
    old = opt('--old', os.path.join(ROOT, '검증', '머리', '옛머리'))
    board = opt('--board', os.path.join(ROOT, '검증', '머리', '민머리'))
    os.makedirs(board, exist_ok=True)
    meta = HL.load_old(old)
    data = MB.hair_data()
    spec = json.load(open(os.path.join(HERE, 'heads-spec.json')))
    meta_t = json.load(open(os.path.join(TPL, '머리-그림틀.json')))
    rows = []
    record = {'about': 'Generated by tools/hair/build-base-head.py (H5 base heads); build-heads.py build merges these entries into sd-hair-data.js. Do not edit.', 'styles': {}}
    for sex in ('f', 'm'):
        maps = sheet_maps(sex)
        entry = data['styles']['%s:%s' % (sex, REFERENCE[sex])]
        row, views = [], {}
        for view in VIEWS:
            head = next(h for h in meta['heads'] if h['sex'] == sex and h['shape'] == REFERENCE[sex] and h['view'] == view)
            layers, v = MB.reference_layers(head, entry, view)
            base, _ = base_view(sex, view, maps, meta_t, head, layers, v, spec)
            views[view] = base
            for skin, hc in (('#ffe2cc', '#5a3a24'), ('#a4693f', '#f291c6')):
                row.append(MB.render({k: x for k, x in base.items() if not k.startswith('blink')}, head, v['origin'], v['k'], hair=hc, skin=skin))
        rows.append(row)
        record['styles']['%s:base' % sex] = entry_of(sex, entry, views)
    with open(os.path.join(ROOT, 'assets', 'sd-hair-base.json'), 'w') as f:
        json.dump(record, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    merge_into_data(record)
    for k, e in record['styles'].items():
        print('%s: %s %d x %d, %.1f KB' % (k, e['file'], e['size'][0], e['size'][1], os.path.getsize(os.path.join(ROOT, e['file'])) / 1024))
    th = max(t.shape[0] for r in rows for t in r)
    W = max(sum(t.shape[1] + 8 for t in r) for r in rows)
    out = Image.new('RGB', (W, len(rows) * (th + 8)), 'white')
    for j, r in enumerate(rows):
        x = 0
        for t in r:
            out.paste(Image.fromarray(t), (x, j * (th + 8)))
            x += t.shape[1] + 8
    out = out.resize((out.width // 2, out.height // 2))
    f = os.path.join(board, '민머리-원화.png')
    out.save(f)
    print(f, out.size)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
