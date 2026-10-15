"""Hat pipeline: the skin of each view's head (ears, face, nape) in head-native
units, from measure-head-skin.cjs (every hair style in two skin tones; the
pixels that change are skin). A pixel counts when at least MIN_STYLES hair
styles show skin there, so a shaved temple of one style does not keep the
hair of the others; it grows OUTLINE px for the drawn outline round an ear.

  python3 -B tools/hair/fit-head-skin.py DIR   (DIR: measure-head-skin.cjs output)

Writes tools/fixtures/head-skin-<sex>-<view>.png (white = skin) and
tools/fixtures/head-skin.json (their head-native rect). build-hat.py keeps
that skin out of a hat's hair-hide mask.

Also writes tools/fixtures/face-anchor.json: per sex, view (front, right)
and hair style the head-native iris centre (front: midway between the eyes)
from the skin-tone-0 pictures, and its shift from the default hair's (m
short, f bob). build-face.py puts the shifts in avatar-face-art.js so a face
item follows each hair style's face (2026-10-15: the profile face sits up to
1 unit apart between hair styles).

And per sex, view (front, right) and hair style the fringe over the face
(assets/face-art/fringe/<sex>-<view>-<hair>.png, black = hair): the hair's
colours above a line just under the eyes, eyebrows included. The face layer
is masked by it, so a fringe and eyebrows stay over a new eye or a sticker
(2026-10-15: an eye cover painted over the long hair's fringe).

And tools/fixtures/hair-tops.json: per sex, view and hair style the hair's
top edge y(x) in head-native units (x 0..32 every TOP_STEP), for seating an
ornament (a crown, ears, a hairband) on each style's hair (build-hat.py puts
it in avatar-hat-art.js).
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from avatar_build import matte as M  # noqa: E402
RES = 20                    # px per head-native unit
RECT = (-8.0, -6.0, 48.0, 40.0)   # head-native x, y, w, h of the map (the head; the next cell's legs stay out)
DIFF = 40                   # summed RGB change that marks skin
MIN_STYLES = 3
SPECK = 3                   # px opened away: hair glints that take the skin's tint
OUTLINE = 5                 # px at RES (a quarter unit)


def main(d):
    meta = json.load(open(os.path.join(d, 'skin.json')))
    hf = json.load(open(os.path.join(ROOT, 'tools', 'fixtures', 'head-frame.json')))
    shots = {}
    for s in meta['shots']:
        shots.setdefault((s['sex'], s['view']), {})[s['sk']] = s
    out = dict(about='Skin of the head per sex/view in head-native units (white = skin in at least %d hair styles, '
                     'grown %.2f units), from tools/hair/measure-head-skin.cjs + fit-head-skin.py. Generated; do not edit.'
                     % (MIN_STYLES, OUTLINE / RES), rect=list(RECT), res=RES, maps={})
    W, H = int(RECT[2] * RES), int(RECT[3] * RES)
    gx, gy = np.meshgrid((np.arange(W) + .5) / RES + RECT[0], (np.arange(H) + .5) / RES + RECT[1])
    for (sex, view), pair in sorted(shots.items()):
        a, b = (np.asarray(Image.open(os.path.join(d, pair[k]['file'])).convert('RGB')).astype(int) for k in meta['tones'])
        skin = np.abs(a - b).sum(-1) > DIFF
        t = hf[sex][view]['frame']['toViewBox']
        count = np.zeros((H, W), int)
        for box in pair[meta['tones'][0]]['boxes']:
            ppu = box['w'] / 32.0
            vx, vy = gx * t[0] + t[4], gy * t[3] + t[5]
            px = np.round(box['x'] + vx * ppu).astype(int); py = np.round(box['y'] + vy * ppu).astype(int)
            ok = (px >= 0) & (py >= 0) & (px < skin.shape[1]) & (py < skin.shape[0])
            hit = np.zeros((H, W), bool); hit[ok] = skin[py[ok], px[ok]]
            count += hit
        keep = Image.fromarray(((count >= MIN_STYLES) * 255).astype(np.uint8))
        keep = keep.filter(ImageFilter.MinFilter(2 * SPECK + 1)).filter(ImageFilter.MaxFilter(2 * SPECK + 1))
        keep = keep.filter(ImageFilter.MaxFilter(2 * OUTLINE + 1))
        name = 'head-skin-%s-%s.png' % (sex, view)
        keep.save(os.path.join(ROOT, 'tools', 'fixtures', name), optimize=True)
        out['maps']['%s-%s' % (sex, view)] = name
        print(sex, view, int((np.asarray(keep) > 0).sum()))
    json.dump(out, open(os.path.join(ROOT, 'tools', 'fixtures', 'head-skin.json'), 'w'), indent=1)
    anchors(d, meta, hf)


DEFAULT_HAIR = {'m': 'short', 'f': 'bob'}
EYE_REACH = 3.0   # units around the default hair's eye an iris may be (hair glints stay out)


def irises(img, box, t, near=None):
    """Head-native iris pixels (teal) of one figure, inside the face band, near `near` if given."""
    ppu = box['w'] / 32.0
    x0, y0 = int(box['x']), max(0, int(box['y']))
    crop = img[y0:y0 + int(28 * ppu), x0:x0 + int(box['w'])]
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    ys, xs = np.nonzero((g > r + 25) & (b > r + 15) & (g > 60))
    hx = ((xs + x0 - box['x']) / ppu - t[4]) / t[0]; hy = ((ys + y0 - box['y']) / ppu - t[5]) / t[3]
    ok = (hy > 15) & (hy < 28)
    if near is not None:
        ok &= np.min([np.hypot(hx - nx, hy - ny) for nx, ny in near], 0) < EYE_REACH
    return hx[ok], hy[ok]


def centre(hx, hy, view):
    if view == 'front':
        L = hx < 16
        return [[float(hx[L].mean()), float(hy[L].mean())], [float(hx[~L].mean()), float(hy[~L].mean())]]
    return [[float(hx.mean()), float(hy.mean())]]


def anchors(d, meta, hf):
    out = dict(about='Per sex, view and hair style: iris centres (head-native; front left and right eye) and '
                     'offsets (the face\'s shift from the default hair, front: midway between the eyes). '
                     'From tools/hair/measure-head-skin.cjs + fit-head-skin.py. Generated; do not edit.',
               default=DEFAULT_HAIR, eyes={}, offsets={})
    for s in meta['shots']:
        if s['sk'] != meta['tones'][0] or s['view'] not in ('front', 'right'):
            continue
        sex, view = s['sex'], s['view']
        img = np.asarray(Image.open(os.path.join(d, s['file'])).convert('RGB')).astype(int)
        t = hf[sex][view]['frame']['toViewBox']
        names = meta['hair'][sex]
        base = centre(*irises(img, s['boxes'][names.index(DEFAULT_HAIR[sex])], t), view)
        eyes = {}
        for name, box in zip(names, s['boxes']):
            hx, hy = irises(img, box, t, base)
            eyes[name] = [[round(v, 3) for v in e] for e in centre(hx, hy, view)] if len(hx) >= 20 else None
        mid = lambda e: np.mean(np.array(e), 0)
        b = mid(eyes[DEFAULT_HAIR[sex]])
        out['eyes'].setdefault(sex, {})[view] = eyes
        out['offsets'].setdefault(sex, {})[view] = {n: ([round(float(v), 3) for v in mid(e) - b] if e else [0, 0]) for n, e in eyes.items()}
        print('anchor', sex, view, out['offsets'][sex][view])
    out['fringe'] = fringes(d, meta, hf, out['eyes'])
    hair_tops(d, meta, hf)
    json.dump(out, open(os.path.join(ROOT, 'tools', 'fixtures', 'face-anchor.json'), 'w'), indent=1)


TOP_STEP = .5   # units between the measured columns
TOP_RANGE = (-5.0, 30.0)   # head-native rows searched (above: the legs of the figure in the row above)


def hair_tops(d, meta, hf):
    """The topmost painted row of each head per column (skin tone 0 pictures)."""
    out = dict(about='Per sex, view and hair style the top edge of the head painting (hair) in head-native units at '
                     'x = 0..32 every %.1f (null: nothing painted). From tools/hair/measure-head-skin.cjs + '
                     'fit-head-skin.py. Generated; do not edit.' % TOP_STEP, step=TOP_STEP, default=DEFAULT_HAIR, tops={})
    xs = np.arange(0, 32 + 1e-6, TOP_STEP)
    for s in meta['shots']:
        if s['sk'] != meta['tones'][0]:
            continue
        sex, view = s['sex'], s['view']
        img = np.asarray(Image.open(os.path.join(d, s['file'])).convert('RGB')).astype(int)
        bg = img[2, 2]
        paint = np.abs(img - bg).sum(-1) > 30
        t = hf[sex][view]['frame']['toViewBox']
        for name, box in zip(meta['hair'][sex], s['boxes']):
            ppu = box['w'] / 32.0
            col = []
            for x in xs:
                px = int(round(box['x'] + (x * t[0] + t[4]) * ppu))
                ys = np.arange(TOP_RANGE[0], TOP_RANGE[1], .05)
                py = np.round(box['y'] + (ys * t[3] + t[5]) * ppu).astype(int)
                ok = (py >= 0) & (py < paint.shape[0]) & (0 <= px < paint.shape[1])
                hit = ys[ok][paint[py[ok], px]] if ok.any() else []
                col.append(round(float(hit[0]), 2) if len(hit) else None)
            out['tops'].setdefault(sex, {}).setdefault(view, {})[name] = col
    json.dump(out, open(os.path.join(ROOT, 'tools', 'fixtures', 'hair-tops.json'), 'w'))


FRINGE_RECT = (2.0, 6.0, 28.0, 22.0)  # head-native x, y, w, h of a fringe mask (the face)
FRINGE_RES = 10                       # px per unit
FRINGE_BELOW = 1.0                    # units under the eyes' line the fringe mask reaches
FRINGE_MIN = 40                       # px of a kept piece
FRINGE_OPEN = 5                       # px (at FRINGE_RES) of the opening that drops thin lines


def fringes(d, meta, hf, eyes):
    """The hair over the face per style: unchanged with the skin tone, brown (the hair's and eyebrows'
    hue), not near-black lashes; small holes closed. Written as black-on-transparent PNGs."""
    from PIL import ImageFilter
    out = dict(rect=list(FRINGE_RECT), files={})
    odir = os.path.join(ROOT, 'assets', 'face-art', 'fringe'); os.makedirs(odir, exist_ok=True)
    W, H = int(FRINGE_RECT[2] * FRINGE_RES), int(FRINGE_RECT[3] * FRINGE_RES)
    gx, gy = np.meshgrid((np.arange(W) + .5) / FRINGE_RES + FRINGE_RECT[0], (np.arange(H) + .5) / FRINGE_RES + FRINGE_RECT[1])
    shots = {}
    for s in meta['shots']:
        shots.setdefault((s['sex'], s['view']), {})[s['sk']] = s
    for (sex, view), pair in sorted(shots.items()):
        if view not in ('front', 'right'):
            continue
        a, b = (np.asarray(Image.open(os.path.join(d, pair[k]['file'])).convert('RGB')).astype(int) for k in meta['tones'])
        skin = np.abs(a - b).sum(-1) > DIFF
        rgb = a.astype(np.float32) / 255; mx, mn = rgb.max(-1), rgb.min(-1); dd = mx - mn + 1e-6
        r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        hue = np.where(mx == r_, (g_ - b_) / dd % 6, np.where(mx == g_, (b_ - r_) / dd + 2, (r_ - g_) / dd + 4)) * 60
        brown = ~skin & (hue > 5) & (hue < 45) & (dd / (mx + 1e-6) > .3) & (mx > .2) & (mx < .85)
        t = hf[sex][view]['frame']['toViewBox']
        for name, box in zip(meta['hair'][sex], pair[meta['tones'][0]]['boxes']):
            ppu = box['w'] / 32.0
            px = np.round(box['x'] + (gx * t[0] + t[4]) * ppu).astype(int); py = np.round(box['y'] + (gy * t[3] + t[5]) * ppu).astype(int)
            ok = (px >= 0) & (py >= 0) & (px < brown.shape[1]) & (py < brown.shape[0])
            hair = np.zeros((H, W), bool); hair[ok] = brown[py[ok], px[ok]]
            e = eyes[sex][view].get(name) or eyes[sex][view][DEFAULT_HAIR[sex]]
            hair[gy > max(p[1] for p in e) + FRINGE_BELOW] = False
            # opened: an eye's brown outline and lash lines are thin, a fringe lock and an eyebrow are not
            m = Image.fromarray((hair * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(FRINGE_OPEN)).filter(ImageFilter.MaxFilter(FRINGE_OPEN))
            m = np.asarray(m) > 127
            lab_, comps = M.components(m)  # a brown pupil, a speck
            m = np.isin(lab_, [c['label'] for c in comps if c['size'] >= FRINGE_MIN])
            rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 3] = m * 255
            f = '%s-%s-%s.png' % (sex, view, name)
            Image.fromarray(rgba).save(os.path.join(odir, f), optimize=True)
            out['files'].setdefault(sex, {}).setdefault(view, {})[name] = 'assets/face-art/fringe/' + f
    return out


if __name__ == '__main__':
    main(sys.argv[1])
