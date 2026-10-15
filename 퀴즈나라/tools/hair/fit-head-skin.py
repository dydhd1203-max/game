"""Hat pipeline: the skin of each view's head (ears, face, nape) in head-native
units, from measure-head-skin.cjs (every hair style in two skin tones; the
pixels that change are skin). A pixel counts when at least MIN_STYLES hair
styles show skin there, so a shaved temple of one style does not keep the
hair of the others; it grows OUTLINE px for the drawn outline round an ear.

  python3 -B tools/hair/fit-head-skin.py DIR   (DIR: measure-head-skin.cjs output)

Writes tools/fixtures/head-skin-<sex>-<view>.png (white = skin) and
tools/fixtures/head-skin.json (their head-native rect). build-hat.py keeps
that skin out of a hat's hair-hide mask.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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


if __name__ == '__main__':
    main(sys.argv[1])
