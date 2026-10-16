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
BROWN_HAT = 11.5  # Lab: hat colours this near the head's are the hair's own (kept whole, trim_head)
COLOUR_SHARE = .8 # the colour cut stands when it finds this share of what changed
GROW = 3          # px the hat mask grows over its own outline
ZONE = .75        # share of head top -> neck the hat may reach down to (a cap's back strap, a profile brim)
HIDE_SIDE = 260   # px beside the hat the hair-hide mask reaches (hide_mask; a twin tail, a pony)
HIDE_TOP = 80     # px above the hat (spiky hair above the crown)
HIDE_FLARE = 1.6  # beside the hat the hidden edge drops this many px per px outward: the hair under the
                  # rim starts as wide as the rim and widens downward, as a cap presses it (2026-10-15:
                  # a rising edge left 'wings' of hair beside the rim)
HIDE_SOFT = 6.0   # px of the hidden edge's soft fall-off
SKIN_ABOVE = 10   # px above the rim's edge where the head's skin (an ear) is still kept


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


def trim_head(hat, u, t, head):
    """A redrawn fringe, eyes or ear under the hat changed too: pieces of the hat mask nearer the head's
    colours than the hat's and hanging from its lower edge are dropped (a band over hair of the same
    brown lies inside the hat and stays)."""
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
        return hat
    headlike = hat & (nearest(Ul, head_cols) < nearest(Ul, hat_cols))
    below = np.zeros_like(hat); below[:-1] = ~hat[1:]; below[-1] = True  # lowest pixel of the hat in its column
    edge = hat & below
    lab_, comps = M.components(headlike)
    drop = np.isin(lab_, [c['label'] for c in comps if (edge & (lab_ == c['label'])).any()])
    out = hat & ~drop
    lab_, comps = M.components(out)  # what is left hanging alone
    big = max((c['size'] for c in comps), default=0)
    return np.isin(lab_, [c['label'] for c in comps if c['size'] >= .05 * big])


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
        # only where the hat's own colours miss it: a colour cut keeps a cap's back opening
        colour = cut_zone(u, a, t, head, low, x0, y0, box, px)
        if dh.sum() < SEED_MIN * px * px:
            return colour
        # a hat with colours of its own: the colour cut finds most of what changed and keeps out the
        # redrawn face and fringe under it (a graduation cap's tassel, a bandana's ties)
        if colour is not None and colour['px'] >= COLOUR_SHARE * dh.sum():
            return colour
        if dh.sum() >= SEED_MIN * px * px:
            # what changed is the hat; the colour cut only adds the hole it shows hair through (a cap's back)
            opening = np.zeros_like(dh)
            if colour is not None:
                cm = colour['mask']; opening = fill_holes(cm) & ~cm
                lab_, comps = M.components(opening)
                opening = np.isin(lab_, [c['label'] for c in comps if c['size'] > 40 * px * px])
            hat = trim_head(dh, u, t, head) & ~opening
            alpha = hat.astype(np.float32)
            ys, xs = np.nonzero(hat)
            bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            rgba = np.dstack([u, alpha * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
            return dict(rgba=rgba, box=[x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]], px=int(hat.sum()), scale=px,
                        mask=hat, cell=box, hide=hide_mask(hat, opening, x0, y0, side=int(HIDE_SIDE * px), top=int(HIDE_TOP * px),
                                                           soft=HIDE_SOFT * px))
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
    alpha = np.where(hat, np.clip(a, 0, 1), 0).astype(np.float32)
    opening = fill_holes(hat) & ~hat
    ys, xs = np.nonzero(hat)
    bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    rgba = np.dstack([u, alpha * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
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
    for c in cols:
        bottom[c] = np.nonzero(hat[:, c])[0].max()
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
        rec['views'].setdefault(sex, {})[view] = v
    json.dump(rec, open(os.path.join(out_assets, shape + '.json'), 'w'), ensure_ascii=False, indent=1)
    write_runtime(out_assets)
    return rec


def write_runtime(out_assets):
    """assets/hat-art/hat-art.json (every <shape>.json) and avatar-hat-art.js (window.QPHatArt)."""
    allrec = {}
    for name in sorted(os.listdir(out_assets)):
        if name.endswith('.json') and name != 'hat-art.json':
            allrec[name[:-5]] = json.load(open(os.path.join(out_assets, name)))
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
        f = cut_zone(u, a, tt, head, low, x0, y0, [x0, y0, x1, neck], px, diff=True)
        report['figures'][k] = None if f is None else dict(box=f['box'], px=f['px'], shift=[dx, dy], legsError=round(err, 2))
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
    if a.base:
        r = build_base(a.sheet, a.base, out, a.id, kind, os.path.join(ROOT, 'assets', 'hat-art'))
    else:
        r = build(a.sheet, out, a.id, kind, os.path.join(ROOT, 'assets', 'hat-art'))
    print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
