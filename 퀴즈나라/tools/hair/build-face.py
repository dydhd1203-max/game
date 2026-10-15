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
BROW_LINE = .45       # eye gaps above the irises where the eyebrows start
BROW_NEAR = 14.0      # Lab distance to the template's hair colours that is an eyebrow
FIGURES = ('m-front', 'm-right', 'f-front', 'f-right')
KINDS = {'face/sticker': 'sticker', 'face/eyes': 'part', 'face/nose': 'part', 'face/mouth': 'part'}


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


def cut(U, T, O, cells, slot, kind):
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
        head = O[y0:y1, x0:x1] == HEAD
        zone = M.dilate(face, 8) & head
        d = np.sqrt(((lu - lt) ** 2).sum(-1))
        changed = (d > CHANGED) & zone
        if kind == 'sticker':
            # novel against the whole head (hair, lashes, skin): a redrawn hair tip is not the sticker
            head_cols = BH.kmeans(lt[head].reshape(-1, 3)[::7], 12)
            novel = changed & face & (BH.nearest(lu, head_cols) > NOVEL)
            lab_, comps = M.components(novel)
            seeds = np.isin(lab_, [c['label'] for c in comps if c['size'] >= MIN_PX])
            # grown a few px only (its own outline), not along a redrawn eye line
            item = M.dilate(seeds, STICKER_GROW) & changed & M.dilate(face, 3)
            lab_, comps = M.components(item)
            inner = M.erode(face, EDGE)
            item = np.isin(lab_, [c['label'] for c in comps if (inner & (lab_ == c['label'])).sum() >= .5 * c['size']])
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
        least = MIN_PX if not comps else max(MIN_PX, (STICKER_SHARE if kind == 'sticker' else PART_SHARE) * max(c['size'] for c in comps))
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
        if kind == 'sticker':
            alpha = soft(item) * nonskin; cover = None
        else:
            cover = M.dilate(item, COVER_GROW[slot]) & zone
            alpha = soft(cover) * nonskin
            if slot == 'eyes':
                # a redrawn hair tip over the eye (the template's fringe) goes under the cover, not into the
                # eye picture: on a bare forehead (m slick) it showed as a brown stroke; lashes are near-black
                hair_cols = BH.kmeans(lt[head & ~M.dilate(face, 2)].reshape(-1, 3)[::7], 8)
                alpha = alpha * ~((BH.nearest(lu, hair_cols) < BROW_NEAR) & (lu[..., 0] > 28))
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


def export(pid, kind, figures, out_assets):
    frame = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'hat-frame.json')))['figures']
    spec = R.garment_spec('hat', ('m', 'f'))
    slot, shape = pid.split(':')
    os.makedirs(out_assets, exist_ok=True)
    anchor = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'face-anchor.json')))
    rec = dict(kind=kind, views={})
    for k, f in figures.items():
        if f is None:
            continue
        sex, view = k.split('-')
        fr = dict(frame[k], cell0=spec['cells'][k][:2])
        fix = eye_fit(fr, f['eyes'], anchor['eyes'][sex][view][anchor['default'][sex]])
        name = '%s-%s-%s-%s' % (slot, shape, sex, view)
        Image.fromarray(f['rgba']).save(os.path.join(out_assets, name + '.png'), optimize=True)
        v = dict(src='assets/face-art/%s.png' % name, rect=fix(BH.to_head(fr, f['box'])))
        if 'cover' in f:
            Image.fromarray(f['cover']).save(os.path.join(out_assets, name + '-cover.png'), optimize=True)
            v['cover'] = 'assets/face-art/%s-cover.png' % name
        rec['views'].setdefault(sex, {})[view] = v
    json.dump(rec, open(os.path.join(out_assets, '%s-%s.json' % (slot, shape)), 'w'), ensure_ascii=False, indent=1)
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


def build(sheet, out, pid, out_assets=None):
    prod = json.load(open(os.path.join(ROOT, 'assets', 'garment-template', 'products.json')))['products'][pid]
    kind = KINDS[prod['class']]
    slot = pid.split(':')[0]
    res = R.register(sheet, slot='hat', sexes=('m', 'f'))
    if 'registered' not in res.get('images', {}):
        raise SystemExit('registration failed: %s' % [c['code'] for c in res['codes']])
    spec = R.garment_spec('hat', ('m', 'f'))
    U = res['images']['registered'][..., :3].astype(np.float32)
    T = spec['template'][..., :3].astype(np.float32)
    figs = cut(U, T, spec['owner'], spec['cells'], slot, kind)
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
    if tiles:
        w = max(t.width for t in tiles); h = sum(t.height for t in tiles) + 6 * len(tiles)
        im = Image.new('RGB', (w, h), 'white'); y = 0
        for t in tiles:
            im.paste(t, (0, y)); y += t.height + 6
        im.save(os.path.join(out, '얼굴-조각.png'))
    report['record'] = export(pid, kind, figs, out_assets or os.path.join(ROOT, 'assets', 'face-art'))
    return report


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--id', required=True, help='slot:shape of products.json (face:band, eyes:cat, ...)')
    ap.add_argument('--out')
    a = ap.parse_args(argv)
    name = os.path.splitext(os.path.basename(a.sheet))[0]
    r = build(a.sheet, a.out or os.path.join(ROOT, '검증', '얼굴', name), a.id)
    print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
