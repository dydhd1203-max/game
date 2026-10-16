"""Face pipeline: cut a face decoration (sticker) or a face part (eyes, nose,
mouth) out of a ChatGPT face sheet and export it for the foundation avatar.

  python3 -B tools/hair/build-face.py SHEET --id face:band|eyes:cat|nose:button|mouth:cat [--out DIR]

The sheet is the garment template with only that item changed on the six
heads (face kit, assets/garment-template/프롬프트.md, prompts face/*). It is
registered to the template with the 'hat' slot of tools/avatar_build/
register.py (the head is the changing part). Per figure (front and right; a
face item has nothing at the back) the item is where the sheet differs from
the template inside the template's face:

- sticker (products.json class face/sticker): the changed pixels that grow
  from colours the template's face does not have (a plaster, a bruise, a red
  dot), so a slightly redrawn eye highlight or hair tip stays out.
- part (face/eyes, face/nose, face/mouth): the changed pixels inside that
  part's zone (from the template's eyes). The old part they replace changed
  too, so the change covers both. Exported as a cover (painted in the
  wearer's skin colour over the old part) and the new part with its skin
  pixels left transparent, so it fits every skin tone.

Exports assets/face-art/<slot>-<shape>-<sex>-<view>.png (+ -cover.png), as
head-native rects (tools/fixtures/hat-frame.json: template head -> game
default head), and avatar-face-art.js (window.QPFaceArt) with the per-hair
face anchors of tools/fixtures/face-anchor.json (tools/hair/fit-head-skin.py),
so a face item follows each hair style's face. Writes a contact sheet to
검증/얼굴/<name>/.
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

_spec = importlib.util.spec_from_file_location('build_hat', os.path.join(HERE, 'build-hat.py'))
BH = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(BH)

HEAD = R.OWNER['head']
SKIN_LAB = np.array([88.0, 8.0, 14.0])  # the template's face skin
SKIN_NEAR = 18.0      # Lab distance that is the template's skin
SKIN_SOFT = (4.0, 8.0)  # Lab distance from the template's skin colours where an item starts, and its ramp
CHANGED = 15.0        # Lab change from the template that is the item
NOVEL = 12.0          # Lab distance from every template face colour: a sticker's own colour
MIN_PX = 15           # px of a kept piece
COVER_GROW = {'eyes': 8, 'nose': 4, 'mouth': 4}  # px a part's cover grows over its change (the game's
                      # old eye sits a few px off the template's: its red outer lash showed beside a cover of 4)
SOFT = 1.5            # px of the soft edge
CLOSE = 14            # px the face's skin is closed over the eyes
PART_SHARE = .12      # a part's piece is at least this share of its biggest piece
STICKER_SHARE = .2    # a sticker's piece: a plaster, a dot of a pair (a hair tip, an eye-line bit are smaller)
STICKER_GROW = 4      # px a sticker grows from its own colours over the changed pixels (its outline)
EDGE = 6              # px inside the face edge where a sticker's piece lies (a hair tip lies on it)
PAINTED = 25.0        # Lab change on the template's bare skin that is a sticker even in a colour the head has
                      # (dark whiskers = the outline colour, red paint dots = the lips' red; F6·F7 2026-10-16)
FEATURE_L = 65.0      # Lab lightness under which a template face pixel is a feature line (eye, brow, mouth)
PAINT_EDGE = 2        # px inside the face edge where such a seed may start
EYE_GAP = 3           # px round the template's eyes where no sticker starts (a redrawn iris or lash tip)
FEATURE_GAP = 3       # px round the template's eyes, brows, nose and mouth where such a change is a redrawn line
MASK_REACH = 18       # px below/around the face a mask reaches: its chin edge lies on the neck's owner (F4)
EYE_KEEP = 4          # px round the new eye where unchanged template dark pixels may be its own lid
BROW_LINE = .45       # eye gaps above the irises where the eyebrows start
BROW_NEAR = 14.0      # Lab distance to the template's hair colours that is an eyebrow
FIGURES = ('m-front', 'm-right', 'f-front', 'f-right')
EAR_FIGURES = ('m-front', 'm-right', 'm-back', 'f-front', 'f-right', 'f-back')
EAR_ROWS = (.45, .08) # from this share of the head's height to this share below its lowest row: the lobes and a drop
EAR_NEAR = 30.0       # Lab distance to the product's colour where an earring starts (its gold, light and shade)
KINDS = {'face/sticker': 'sticker', 'face/mask': 'mask', 'ear/earring': 'ear', 'face/eyes': 'part', 'face/nose': 'part', 'face/mouth': 'part'}


def face_mask(lt, head):
    skin = head & (np.sqrt(((lt - SKIN_LAB) ** 2).sum(-1)) < SKIN_NEAR)
    lab_, comps = M.components(skin)
    big = max(comps, key=lambda c: c['size'])
    # closed before filling: lashes and the fringe touch the eyes, which are then no hole of the skin
    return M.erode(BH.fill_holes(M.dilate(lab_ == big['label'], CLOSE)), CLOSE) & head


def eye_centres(t, face):
    """Iris centres (x, y) of the template's eyes inside the face, left to right."""
    r, g, b = (t[..., i].astype(int) for i in range(3))
    iris = face & (g > r + 25) & (b > r + 15)
    lab_, comps = M.components(iris)
    comps = sorted(comps, key=lambda c: -c['size'])[:2]
    out = []
    for c in comps:
        if c['size'] < 30:
            continue
        ys, xs = np.nonzero(lab_ == c['label'])
        out.append((xs.mean(), ys.mean()))
    return sorted(out)


# Part zones in front eye gaps from the eyes' centre (front: midway between them), measured on the
# pilot sheets E1/N1/L1 (2026-10-15): the chibi nose sits just under the eye line and the mouth a third
# of a gap lower. Eyebrows (above -.52) stay out: a fringe may cross them.
ZONES = {
    'front': {'eyes': (-1.22, -.52, 1.22, .2), 'nose': (-.25, -.08, .25, .27), 'mouth': (-.25, .2, .25, .46)},
    'right': {'eyes': (-.62, -.42, .26, .16), 'nose': (.22, -.05, .58, .26), 'mouth': (.08, .2, .46, .56)},
}


def part_zone(slot, shape, eyes, gap, view):
    """Box (x0, y0, x1, y1) of a face part in the figure's px, from the template's eyes (front: both;
    right: one) and the sex's front eye gap."""
    cx = float(np.mean([e[0] for e in eyes])); cy = float(np.mean([e[1] for e in eyes]))
    z = ZONES[view][slot]
    return (cx + z[0] * gap, cy + z[1] * gap, cx + z[2] * gap, cy + z[3] * gap)


def soft(mask, r=SOFT):
    """Alpha with a soft edge from a mask (box blur of the mask)."""
    im = Image.fromarray((mask * 255).astype(np.uint8))
    from PIL import ImageFilter
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255 * (M.dilate(mask, 2))


def cut(U, T, O, cells, slot, kind, debug=None):
    LU, LT = R.lab(U), R.lab(T)
    gaps = {}
    found = {}
    for k in FIGURES:
        x0, y0, x1, y1 = cells[k]
        head = O[y0:y1, x0:x1] == HEAD
        face = face_mask(LT[y0:y1, x0:x1], head)
        found[k] = (face, eye_centres(T[y0:y1, x0:x1], face))
        if k.endswith('front'):
            e = found[k][1]; gaps[k[0]] = e[1][0] - e[0][0]
    out = {}
    for k in FIGURES:
        x0, y0, x1, y1 = cells[k]
        face, eyes = found[k]
        sex, view = k.split('-')
        lu, lt, u = LU[y0:y1, x0:x1], LT[y0:y1, x0:x1], U[y0:y1, x0:x1]
        t = T[y0:y1, x0:x1]
        head = O[y0:y1, x0:x1] == HEAD
        if kind == 'mask':  # the mask's lower edge covers the chin: below the template's chin lie the neck and
            # the page; with the neck alone the edge was cut flat over the page and a neck-wide tab stuck out (F4, F4R)
            head = head | M.dilate(face, MASK_REACH)
        zone = head if kind == 'mask' else M.dilate(face, 8) & head  # (the face's skin itself is notched at the chin)
        d = np.sqrt(((lu - lt) ** 2).sum(-1))
        changed = (d > CHANGED) & zone
        if kind in ('sticker', 'mask'):
            # novel against the whole head (hair, lashes, skin): a redrawn hair tip is not the sticker
            head_cols = BH.kmeans(lt[head].reshape(-1, 3)[::7], 12)
            # (a mask starts over the chin too: seeded on the face only, its chin edge on the neck owner was cut
            # square, F4 2026-10-16)
            seedable = M.dilate(face, MASK_REACH) & head if kind == 'mask' else face
            novel = changed & seedable & (BH.nearest(lu, head_cols) > NOVEL)
            # or bare skin plainly painted over, away from the template's features: a sticker in a colour the
            # head already has (dark whiskers, red dots) was no seed and was lost (F6·F7, 2026-10-16)
            # (the features are the template's dark lines and irises: a girl's blush is no feature, and paint
            # dots on it were lost while blush counted as one)
            features = face & (lt[..., 0] < FEATURE_L)
            # and never in the eyes' zone: a redrawn eye or lash tip is no sticker (F7 f-right, f-front 2026-10-16)
            # (the template's eyes themselves, lashes and irises, a few px round: a box cut a bruise below the eye flat)
            ex0, ey0, ex1, ey1 = (int(round(v)) for v in part_zone('eyes', None, eyes, gaps[sex], view))
            box = np.zeros(face.shape, bool); box[max(0, ey0):max(0, ey1), max(0, ex0):max(0, ex1)] = True
            tr, tg, tb = (t[..., i].astype(int) for i in range(3))
            eyes_px = box & face & ((lt[..., 0] < FEATURE_L) | ((tg > tr + 25) & (tb > tr + 15)))
            eyezone = M.dilate(BH.fill_holes(eyes_px), EYE_GAP)
            # (it starts a little inside the face: a hair tip redrawn over the face's edge is no seed, while red dots
            # and whiskers on a girl's narrow cheeks lie within EDGE of it; by colour they read as hair or ear)
            painted = M.erode(face, PAINT_EDGE) & (d > PAINTED) & ~M.dilate(features, FEATURE_GAP)
            novel = (novel | painted) & ~eyezone
            # sized across 1 px gaps: a thin whisker line breaks into short runs, each under MIN_PX (F7 f-front)
            lab_, comps = M.components(M.dilate(novel, 1))
            seeds = novel & np.isin(lab_, [c['label'] for c in comps if (novel & (lab_ == c['label'])).sum() >= MIN_PX])
            # grown a few px only (its own outline), not along a redrawn eye line
            # (a mask grows 2 px only, its outline: 4 px reached into the redrawn neck under the chin, a square tab, F4R)
            item = M.dilate(seeds, 2 if kind == 'mask' else STICKER_GROW) & changed & (M.dilate(face, MASK_REACH) & head if kind == 'mask' else M.dilate(face, 3))
            lab_, comps = M.components(item)
            inner = M.erode(face, EDGE)
            # (a mask is mostly on the face but reaches over the chin and to the ears: a third inside is enough)
            share = .3 if kind == 'mask' else .5
            # a piece near the face edge is a redrawn hair tip only when it is hair coloured: a girl's bob covers
            # her cheeks, and red paint dots there lay on the edge and were lost (F6 f-front, 2026-10-16)
            hair_cols = BH.kmeans(lt[head & ~M.dilate(face, 2)].reshape(-1, 3)[::7], 8)
            def keep(c):
                m = lab_ == c['label']
                return (inner & m).sum() >= share * c['size'] or BH.nearest(lu[m].mean(0)[None], hair_cols)[0] > BROW_NEAR
            item = np.isin(lab_, [c['label'] for c in comps if keep(c)])
            if debug is not None:  # --debug: what started the item and what was kept out
                debug[k] = dict(u=u.astype(np.uint8), face=face, features=features, eyezone=eyezone, seeds=seeds, item=item)
        else:
            zx0, zy0, zx1, zy1 = (int(round(v)) for v in part_zone(slot, None, eyes, gaps[sex], view))
            box = np.zeros(changed.shape, bool); box[max(0, zy0):zy1, max(0, zx0):zx1] = True
            # eyes: not the hair's colours above the eye line (a redrawn eyebrow; a lash is near-black)
            hair_cols = BH.kmeans(lt[head & ~M.dilate(face, 2)].reshape(-1, 3)[::7], 8)
            browlike = (BH.nearest(lu, hair_cols) < BROW_NEAR) & (lu[..., 0] > 28)
            if slot == 'eyes':  # only at the brow line: the mouth line and a nose are brown too
                # the brow line only: the old part's upper lashes are brown too and must be covered
                cy = float(np.mean([e[1] for e in eyes])); browlike[int(cy - BROW_LINE * gaps[sex]):] = False
            else:
                browlike[:] = False
            item = changed & box & ~browlike
        lab_, comps = M.components(item)
        # a part keeps its big pieces only (an eye, a nose): a redrawn eyebrow tip or blush speck stays out
        least = MIN_PX if not comps else max(MIN_PX, (STICKER_SHARE if kind in ('sticker', 'mask') else PART_SHARE) * max(c['size'] for c in comps))
        item = np.isin(lab_, [c['label'] for c in comps if c['size'] >= least])
        if item.sum() < 2 * MIN_PX:
            out[k] = None
            continue
        item = BH.fill_holes(M.dilate(item, 1))
        rec = dict(px=int(item.sum()))
        # the item without the template's skin (its shades and highlights too): the wearer's own skin, or a
        # part's cover in the wearer's skin colour, shows there, so the item fits every skin tone
        skin_only = head & (np.sqrt(((lt - SKIN_LAB) ** 2).sum(-1)) < SKIN_NEAR)
        skin_cols = BH.kmeans(lt[skin_only].reshape(-1, 3)[::5], 10)
        nonskin = np.clip((BH.nearest(lu, skin_cols) - SKIN_SOFT[0]) / SKIN_SOFT[1], 0, 1)
        if kind in ('sticker', 'mask'):
            # thin strokes keep their full alpha: the soft edge alone left a 2 px whisker at half strength (F7)
            thin = item & ~M.dilate(M.erode(item, 2), 2)
            alpha = np.maximum(soft(item), thin.astype(np.float32)) * nonskin; cover = None
        else:
            cover = M.dilate(item, COVER_GROW[slot]) & zone
            alpha = soft(cover) * nonskin
            if slot == 'eyes':
                # a redrawn hair tip over the eye (the template's fringe) goes under the cover, not into the
                # eye picture: on a bare forehead (m slick) it showed as a brown stroke; lashes are near-black
                hair_cols = BH.kmeans(lt[head & ~M.dilate(face, 2)].reshape(-1, 3)[::7], 8)
                alpha = alpha * ~((BH.nearest(lu, hair_cols) < BROW_NEAR) & (lu[..., 0] > 28))
                # the template's own fringe tips over the eye, left as they were (unchanged, dark or hair
                # coloured in the template): the wearer's own fringe covers that place, and
                # on a bare forehead (m slick) they showed as dark strokes (E1R, 2026-10-15)
                tr, tg, tb = (t[..., i].astype(int) for i in range(3))
                t_hair = ((tr > tg) & (tg > tb) & (tr - tb > 25) & (t.max(2) < 170)) | (t.max(2) < 90)
                # (only away from the new eye: its lid can lie on the old lash, unchanged there)
                alpha = alpha * ~(M.dilate((d < CHANGED) & t_hair, 2) & ~M.dilate(item, EYE_KEEP))  # with their pale edges
        ys, xs = np.nonzero(M.dilate(cover if cover is not None else item, 3))
        bx = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        rgba = np.dstack([u, alpha * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
        rec.update(rgba=rgba, box=[x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]], eyes=[[x0 + a, y0 + b] for a, b in eyes])
        if cover is not None:
            ca = (soft(cover) * 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]]
            c = np.full(ca.shape + (4,), 255, np.uint8); c[..., 3] = ca  # white: a luminance mask in the svg
            rec['cover'] = c
        out[k] = rec
    return out


def cut_ear(U, T, O, cells, colour):
    """Earrings (R1/R2 pilot, 2026-10-16): in all six figures (a boy's ears show from behind), the changed pixels
    in a colour the template has nowhere near the ears (gold), between the head's middle and a little under
    the chin. Front and profile keep the template's eyes for the per-hair face anchor; the back has none."""
    LU, LT = R.lab(U), R.lab(T)
    out = {}
    # the template's skin from every head (a girl's back shows no skin)
    skin_all = np.concatenate([LT[y0:y1, x0:x1][(O[y0:y1, x0:x1] == HEAD) & (np.sqrt(((LT[y0:y1, x0:x1] - SKIN_LAB) ** 2).sum(-1)) < SKIN_NEAR)]
                               for x0, y0, x1, y1 in (cells[k] for k in EAR_FIGURES)])
    skin_cols = BH.kmeans(skin_all[::5], 10)
    for k in EAR_FIGURES:
        x0, y0, x1, y1 = cells[k]
        lu, lt, u = LU[y0:y1, x0:x1], LT[y0:y1, x0:x1], U[y0:y1, x0:x1]
        head = O[y0:y1, x0:x1] == HEAD
        ys = np.nonzero(head.any(1))[0]; top, bot = ys.min(), ys.max(); hgt = bot - top
        # (front and profile end under the chin, not under the head: a girl's bob reaches her shoulders and the
        # zone took the shirt's redrawn flowers)
        if not k.endswith('back'):
            fys = np.nonzero(face_mask(lt, head).any(1))[0]; bot = fys.max()
        zone = np.zeros(head.shape, bool); zone[int(top + EAR_ROWS[0] * hgt):int(bot + EAR_ROWS[1] * hgt)] = True
        d = np.sqrt(((lu - lt) ** 2).sum(-1))
        changed = (d > CHANGED) & zone
        # in the product's own colour, not just any new colour: the whole zone reached the shirt's redrawn flowers
        # and redrawn hair tips started pieces too (R1·R2 first cut, 2026-10-16)
        novel = changed & (np.sqrt(((lu - colour) ** 2).sum(-1)) < EAR_NEAR)
        lab_, comps = M.components(M.dilate(novel, 1))
        seeds = novel & np.isin(lab_, [c['label'] for c in comps if (novel & (lab_ == c['label'])).sum() >= MIN_PX])
        item = M.dilate(seeds, STICKER_GROW) & changed
        lab_, comps = M.components(item)
        item = np.isin(lab_, [c['label'] for c in comps if c['size'] >= MIN_PX])
        if item.sum() < MIN_PX:
            out[k] = None
            continue
        item = BH.fill_holes(M.dilate(item, 1))
        nonskin = np.clip((BH.nearest(lu, skin_cols) - SKIN_SOFT[0]) / SKIN_SOFT[1], 0, 1)
        thin = item & ~M.dilate(M.erode(item, 2), 2)
        alpha = np.maximum(soft(item), thin.astype(np.float32)) * nonskin
        yy, xx = np.nonzero(M.dilate(item, 3))
        bx = (int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1)
        eyes = []
        if not k.endswith('back'):
            face = face_mask(lt, head); eyes = eye_centres(T[y0:y1, x0:x1], face)
        out[k] = dict(px=int(item.sum()), rgba=np.dstack([u, alpha * 255]).clip(0, 255).astype(np.uint8)[bx[1]:bx[3], bx[0]:bx[2]],
                      box=[x0 + bx[0], y0 + bx[1], x0 + bx[2], y0 + bx[3]], eyes=[[x0 + a, y0 + b] for a, b in eyes])
    return out


def eye_fit(fr, eyes, game):
    """Head-native rect -> the same rect moved (and, front, scaled about the eyes' midpoint) so the
    template's irises land on the game default head's (tools/fixtures/face-anchor.json). The head fit
    (hat-frame.json) matches the whole head and left the m front eyes .25 unit off (2026-10-15)."""
    hn = [BH.to_head(fr, [x, y, x, y])[:2] for x, y in eyes]
    tm = np.mean(hn, 0); gm = np.mean(np.array(game), 0)
    sc = (game[1][0] - game[0][0]) / (hn[1][0] - hn[0][0]) if len(hn) == 2 and len(game) == 2 else 1.0

    def fix(r):
        x, y, w, h = r
        return [round(gm[0] + (x - tm[0]) * sc, 3), round(gm[1] + (y - tm[1]) * sc, 3), round(w * sc, 3), round(h * sc, 3)]
    return fix


def export(pid, kind, figures, out_assets, sheet=None, runtime=True):
    frame = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'hat-frame.json')))['figures']
    spec = R.garment_spec('hat', ('m', 'f'))
    slot, shape = pid.split(':')
    os.makedirs(out_assets, exist_ok=True)
    anchor = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'face-anchor.json')))
    rec = dict(kind=kind, views={})
    if sheet:  # the source sheet, for --check (re-cut every item, compare with the saved pictures)
        rec['sheet'] = os.path.relpath(os.path.abspath(sheet), ROOT).replace(os.sep, '/')
    for k, f in figures.items():
        if f is None:
            continue
        sex, view = k.split('-')
        fr = dict(frame[k], cell0=spec['cells'][k][:2])
        # the back has no eyes (earrings): the head fit alone
        fix = eye_fit(fr, f['eyes'], anchor['eyes'][sex][view][anchor['default'][sex]]) if f['eyes'] else (lambda r: r)
        name = '%s-%s-%s-%s' % (slot, shape, sex, view)
        Image.fromarray(f['rgba']).save(os.path.join(out_assets, name + '.png'), optimize=True)
        v = dict(src='assets/face-art/%s.png' % name, rect=fix(BH.to_head(fr, f['box'])))
        if 'cover' in f:
            Image.fromarray(f['cover']).save(os.path.join(out_assets, name + '-cover.png'), optimize=True)
            v['cover'] = 'assets/face-art/%s-cover.png' % name
        rec['views'].setdefault(sex, {})[view] = v
    json.dump(rec, open(os.path.join(out_assets, '%s-%s.json' % (slot, shape)), 'w'), ensure_ascii=False, indent=1)
    if runtime:  # not for --check's temp folders: it rewrote the real avatar-face-art.js with one item (2026-10-16)
        write_runtime(out_assets)
    return rec


def write_runtime(out_assets):
    """assets/face-art/face-art.json and avatar-face-art.js (window.QPFaceArt: items by slot:shape and the
    per-hair face anchors)."""
    items = {}
    for name in sorted(os.listdir(out_assets)):
        if name.endswith('.json') and name != 'face-art.json':
            slot, shape = name[:-5].split('-', 1)
            items['%s:%s' % (slot, shape)] = json.load(open(os.path.join(out_assets, name)))
    anchor = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'face-anchor.json')))
    allrec = dict(items=items, anchors=anchor['offsets'], fringe=anchor['fringe'])
    json.dump(allrec, open(os.path.join(out_assets, 'face-art.json'), 'w'), ensure_ascii=False, indent=1)
    js = ('// Face art of the foundation avatar (generated by tools/hair/build-face.py; do not edit).\n'
          '// items: per slot:shape, kind sticker (drawn on the face) | part (a cover in the skin colour over the\n'
          '// old part, then the new part), per sex and view (front, right) head-native rects. anchors: per sex,\n'
          '// view and hair shape the head-native shift of that hair\'s face from the default hair\'s. fringe: per\n'
          '// sex, view and hair shape the hair over the face (black), which stays over every face item.\n'
          'window.QPFaceArt=Object.freeze(' + json.dumps(allrec, ensure_ascii=False, separators=(',', ':')) + ');\n')
    open(os.path.join(ROOT, 'avatar-face-art.js'), 'w').write(js)


CACHE = os.path.join(ROOT, '검증', '캐시', '얼굴-등록')


def registered(sheet):
    """R.register(sheet) for the head slot, kept in 검증/캐시 by the sheet's, the template's and register.py's
    bytes: re-cutting an item while tuning a rule re-registered the same sheet every time (2026-10-16)."""
    import hashlib
    h = hashlib.sha256()
    for f in (sheet, R.TEMPLATE_PATH, R.__file__):
        h.update(open(f, 'rb').read())
    path = os.path.join(CACHE, h.hexdigest()[:24] + '.npz')
    if os.path.exists(path):
        z = np.load(path, allow_pickle=False)
        return {'images': {'registered': z['registered']}, 'codes': [{'code': c} for c in json.loads(str(z['codes']))]}
    res = R.register(sheet, slot='hat', sexes=('m', 'f'))
    if 'registered' in res.get('images', {}):
        os.makedirs(CACHE, exist_ok=True)
        np.savez_compressed(path, registered=res['images']['registered'], codes=json.dumps([c['code'] for c in res['codes']]))
    return res


def write_debug(dbg, path):
    """One picture per figure: the sheet, then grey face, blue template lines (features), dark blue eye zone
    (no seed starts there), red seeds, green the kept item outline."""
    tiles = []
    for k, d in dbg.items():
        ys, xs = np.nonzero(d['face'])
        y0, y1, x0, x1 = max(0, ys.min() - 20), ys.max() + 30, max(0, xs.min() - 20), xs.max() + 20
        im = np.zeros(d['face'].shape + (3,), np.uint8)
        im[d['face']] = (90, 90, 90); im[d['eyezone']] = (0, 0, 110); im[d['features']] = (0, 0, 255)
        im[d['seeds']] = (255, 0, 0); im[d['item'] & ~M.erode(d['item'], 1)] = (0, 255, 0)
        both = np.concatenate([d['u'][y0:y1, x0:x1], im[y0:y1, x0:x1]], 1)
        tiles.append(Image.fromarray(both).resize((both.shape[1] * 2, both.shape[0] * 2), Image.NEAREST))
    w = max(t.width for t in tiles); h = sum(t.height + 6 for t in tiles)
    out = Image.new('RGB', (w, h), 'white'); y = 0
    for t in tiles:
        out.paste(t, (0, y)); y += t.height + 6
    out.save(path)



def build(sheet, out, pid, out_assets=None, debug=False, runtime=True):
    prod = json.load(open(os.path.join(ROOT, 'assets', 'garment-template', 'products.json')))['products'][pid]
    kind = KINDS[prod['class']]
    slot = pid.split(':')[0]
    res = registered(sheet)
    if 'registered' not in res.get('images', {}):
        raise SystemExit('registration failed: %s' % [c['code'] for c in res['codes']])
    spec = R.garment_spec('hat', ('m', 'f'))
    U = res['images']['registered'][..., :3].astype(np.float32)
    T = spec['template'][..., :3].astype(np.float32)
    dbg = {} if debug else None
    figs = cut_ear(U, T, spec['owner'], spec['cells'], R.lab(np.array([[[int(prod['colour']['f'][i:i + 2], 16) for i in (1, 3, 5)]]], np.float32))[0, 0]) if kind == 'ear' else cut(U, T, spec['owner'], spec['cells'], slot, kind, dbg)
    os.makedirs(out, exist_ok=True)
    report = dict(sheet=os.path.basename(sheet), id=pid, kind=kind, codes=[c['code'] for c in res['codes']],
                  figures={k: (None if f is None else dict(box=f['box'], px=f['px'])) for k, f in figs.items()})
    tiles = []
    for k, f in figs.items():
        if f is None:
            continue
        x0, y0, x1, y1 = f['box']; pad = 30
        base = U[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad].astype(np.uint8)
        piece = Image.new('RGBA', (f['rgba'].shape[1] + 20, f['rgba'].shape[0] + 20), (40, 52, 90, 255))
        piece.alpha_composite(Image.fromarray(f['rgba']), (10, 10))
        both = Image.new('RGB', (base.shape[1] + piece.width + 10, max(base.shape[0], piece.height)), 'white')
        both.paste(Image.fromarray(base), (0, 0)); both.paste(piece.convert('RGB'), (base.shape[1] + 10, 0))
        tiles.append(both.resize((both.width * 2, both.height * 2), Image.NEAREST))
    json.dump(report, open(os.path.join(out, '얼굴.json'), 'w'), ensure_ascii=False, indent=1)
    if dbg:
        write_debug(dbg, os.path.join(out, '얼굴-확인.png'))
    if tiles:
        w = max(t.width for t in tiles); h = sum(t.height for t in tiles) + 6 * len(tiles)
        im = Image.new('RGB', (w, h), 'white'); y = 0
        for t in tiles:
            im.paste(t, (0, y)); y += t.height + 6
        im.save(os.path.join(out, '얼굴-조각.png'))
    report['record'] = export(pid, kind, figs, out_assets or os.path.join(ROOT, 'assets', 'face-art'), sheet, runtime)
    return report


def check():
    """Every item of assets/face-art re-cut from its sheet with the current rules into a temp folder and
    compared with the saved pictures (max channel difference, alpha pixels moved by more than 8). A rule
    change for a new item must leave the others as they were, or the change is reviewed on a board
    (2026-10-16: the whisker and paint rules first changed the bandage and bruise; done by hand then)."""
    assets = os.path.join(ROOT, 'assets', 'face-art')
    from concurrent.futures import ProcessPoolExecutor
    names = [n for n in sorted(os.listdir(assets)) if n.endswith('.json') and n != 'face-art.json']
    with ProcessPoolExecutor(4) as pool:  # 4 cores; one item per process (2026-10-16: 1 m 37 s one by one)
        lines = [l for part in pool.map(check_one, names) for l in part]
    # the runtime bundle must hold every item record (a temp re-cut once rewrote it with one item, 2026-10-16)
    js = open(os.path.join(ROOT, 'avatar-face-art.js'), encoding='utf-8').read()
    for n in names:
        slot, shape = n[:-5].split('-', 1)
        if '"%s:%s":{' % (slot, shape) not in js:
            lines.append('RUNTIME_MISSING %s:%s in avatar-face-art.js (run write_runtime)' % (slot, shape))
    for l in lines:
        print(l)
    print('face check: %s' % ('OK' if not lines else '%d problem(s)' % len(lines)))
    return 1 if lines else 0


def check_one(name):
    import tempfile
    assets = os.path.join(ROOT, 'assets', 'face-art')
    rec = json.load(open(os.path.join(assets, name)))
    slot, shape = name[:-5].split('-', 1)
    if not rec.get('sheet'):
        return ['NO_SHEET %s:%s (re-cut it once to record its sheet)' % (slot, shape)]
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        build(os.path.join(ROOT, rec['sheet']), os.path.join(tmp, 'board'), '%s:%s' % (slot, shape), os.path.join(tmp, 'art'), runtime=False)
        for sex, views in rec['views'].items():
            for view, v in views.items():
                for key in ('src', 'cover'):
                    if key not in v:
                        continue
                    a = np.asarray(Image.open(os.path.join(ROOT, v[key]))).astype(int)
                    b = np.asarray(Image.open(os.path.join(tmp, 'art', os.path.basename(v[key])))).astype(int)
                    if a.shape != b.shape:
                        out.append('CHANGED %s size %s -> %s' % (v[key], a.shape[:2], b.shape[:2]))
                    elif np.abs(a - b).max() > 0:
                        out.append('CHANGED %s max %d, alpha moved %d px' % (v[key], np.abs(a - b).max(), int((np.abs(a[..., 3] - b[..., 3]) > 8).sum())))
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet', nargs='?')
    ap.add_argument('--id', help='slot:shape of products.json (face:band, eyes:cat, ...)')
    ap.add_argument('--out')
    ap.add_argument('--debug', action='store_true', help='also write 얼굴-확인.png (seeds, eye zone, template lines, kept item)')
    ap.add_argument('--check', action='store_true', help='re-cut every saved item from its sheet into a temp folder and compare')
    a = ap.parse_args(argv)
    if a.check:
        return check()
    if not a.sheet or not a.id:
        ap.error('SHEET and --id are needed (or --check)')
    name = os.path.splitext(os.path.basename(a.sheet))[0]
    r = build(a.sheet, a.out or os.path.join(ROOT, '검증', '얼굴', name), a.id, debug=a.debug)
    print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
