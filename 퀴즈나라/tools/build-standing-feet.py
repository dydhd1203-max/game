"""Standing bare feet (2026-10-16): the skin under an open shoe (slippers, sandals) cut from the returned sheet
assets/garment-sources/standing-barefoot-chatgpt-2026-10-16.png (the garment template with the shoes taken off).

  python3 -B tools/build-standing-feet.py          write assets/sd-foundation-ref-feet.png and -feet.js
  python3 -B tools/build-standing-feet.py --check  rebuild in memory and compare with the committed files

The sheet is registered to the frozen body with the garment pipeline's shoe slot (tools/avatar_build/register.py),
so it lies on the body sheet's pixel grid like sd-foundation-ref-legs-under.png. Per figure and foot the feet are
the sheet's painted pixels around the basic shoe (its record's rects, grown) below the legs' painted run (a few
rows overlap it, so no seam opens when the foot turns), toned to the legs' paint where the two overlap: the game
tints both with one skin filter (avatar-foundation-skin.js toneMatrix), so they must start as the same skin.
Writes the layer (sheet grid, transparent elsewhere) and per figure the feet's rects and ankles (the basic shoe
record's ankles) to tools/fixtures/standing-feet.json; the rects are avatar-foundation-skin.js FEET (--check
compares), drawn by avatar-foundation-outfit.js under shoes that show the feet (record.feet).
"""
import argparse
import re
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402

SHEET = 'assets/garment-sources/standing-barefoot-chatgpt-2026-10-16.png'
OUT_PNG = 'assets/sd-foundation-ref-feet.png'
OUT_JSON = 'tools/fixtures/standing-feet.json'
SKIN_JS = 'avatar-foundation-skin.js'
SNEAKER = 'assets/sd-garment-shoes-sneaker.js'
CACHE = os.path.join(ROOT, '검증', '캐시', '맨발-등록')
GROW = 10        # px round the basic shoe's rect where a foot may lie (a bare foot is smaller than the shoe)
OVERLAP = 12     # rows the foot reaches up over the legs' painted run (its 8 rows under the shoe and a few)
BLEND = 6        # rows under the legs' run where the foot's colour turns from the leg's into its own
LEG_SOLID = 200  # alpha of the legs layer that is the leg itself
PAGE = 735       # RGB sum over which a pixel is the white page
VIEWS = {'front': 'front', 'right': 'right', 'back': 'back'}


def sneaker():
    s = open(os.path.join(ROOT, SNEAKER), encoding='utf-8').read()
    s = s[s.index('const record=') + len('const record='):]
    return json.loads(s[:s.index('\n};') + 2].rstrip(';'))


def registered():
    h = hashlib.sha256()
    for f in (os.path.join(ROOT, SHEET), R.TEMPLATE_PATH, R.__file__):
        h.update(open(f, 'rb').read())
    path = os.path.join(CACHE, h.hexdigest()[:24] + '.npy')
    if os.path.exists(path):
        return np.load(path)
    res = R.register(os.path.join(ROOT, SHEET), slot='shoes', sexes=('m', 'f'))
    codes = [c['code'] for c in res['codes']]
    if codes:
        raise SystemExit('registration codes: %s' % codes)
    reg = res['images']['registered'].astype(np.float32)
    os.makedirs(CACHE, exist_ok=True); np.save(path, reg)
    return reg


def build():
    reg = registered()
    legs = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'sd-foundation-ref-legs-under.png')).convert('RGBA')).astype(np.float32)
    rec = sneaker()
    out = np.zeros(reg.shape, np.float32)
    data = {}
    for sex in ('m', 'f'):
        for view in ('front', 'right', 'back'):
            feet = []
            for shoe in rec['sexes'][sex]['figures'][view]['shoes']:
                x, y, w, h = shoe['rect']
                box = np.zeros(reg.shape[:2], bool)
                box[max(0, y - GROW):y + h + GROW, max(0, x - GROW):x + w + GROW] = True
                paint = box & (reg[..., 3] > 128) & (reg[..., :3].sum(-1) < PAGE)
                leg = legs[..., 3] >= LEG_SOLID
                # below the leg, and OVERLAP rows up into it
                below = paint & ~leg
                up = below.copy()
                for _ in range(OVERLAP):
                    up = up | (np.roll(up, -1, 0) & paint)
                lab_, comps = M.components(up)
                if not comps:
                    raise SystemExit('no foot under %s %s shoe at %s' % (sex, view, shoe['rect']))
                big = max(comps, key=lambda c: c['size'])
                foot = lab_ == big['label']
                # tone to the legs' paint on the overlap: one gain per channel
                both = foot & leg
                gain = np.ones(3, np.float32)
                if both.sum() > 20:
                    gain = (legs[both][:, :3].mean(0) + 1) / (reg[both][:, :3].mean(0) + 1)
                px = foot & (out[..., 3] == 0)
                col = np.clip(reg[..., :3] * gain, 0, 255)
                # the legs' run under the shoe ends in the old leg's outline row (hidden under a shoe), and the sheet
                # keeps a shade where the shoe's opening was: the foot covers OVERLAP rows of the run, starting in
                # the leg's colour there and turning into its own by BLEND rows under the run (a light and a dark
                # band read as a seam, 2026-10-16)
                for c in np.nonzero(foot.any(0))[0]:
                    rows = np.nonzero(leg[:, c])[0]
                    if not len(rows):
                        continue
                    e = int(rows.max()); start = e - OVERLAP; top = legs[start, c, :3]
                    for yy in range(start, e + BLEND + 1):
                        if 0 <= yy < col.shape[0] and foot[yy, c]:
                            w = (yy - start) / (OVERLAP + BLEND)
                            col[yy, c] = top * (1 - w) + col[yy, c] * w
                out[px, :3] = col[px]; out[px, 3] = reg[px, 3]
                ys, xs = np.nonzero(foot)
                feet.append(dict(rect=[int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
                                 ankle=shoe['ankle'], gain=[round(float(g), 3) for g in gain]))
            data['%s-%s' % (sex, view)] = dict(feet=feet)
    return out.round().clip(0, 255).astype(np.uint8), data


def record(data):
    return json.dumps(dict(source=SHEET, image=OUT_PNG, figures=data), ensure_ascii=False, indent=1) + '\n'


def skin_literal():
    """avatar-foundation-skin.js FEET, the rects the game reads."""
    s = open(os.path.join(ROOT, SKIN_JS), encoding='utf-8').read()
    m = re.search(r"const FEET=(\{[^;]*\});", s)
    return json.loads(m.group(1).replace("'", '"')) if m else None


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args(argv)
    img, data = build()
    if a.check:
        old = np.asarray(Image.open(os.path.join(ROOT, OUT_PNG)).convert('RGBA'))
        same = old.shape == img.shape and np.array_equal(old, img) and open(os.path.join(ROOT, OUT_JSON), encoding='utf-8').read() == record(data)
        rects = {k: [f['rect'] for f in v['feet']] for k, v in data.items()}
        game = skin_literal() == rects
        print('feet:', 'OK' if same and game else ('CHANGED' if not same else 'avatar-foundation-skin.js FEET differs: ' + json.dumps(rects, separators=(',', ':'))))
        same = same and game
        return 0 if same else 1
    Image.fromarray(img).save(os.path.join(ROOT, OUT_PNG), optimize=True)
    open(os.path.join(ROOT, OUT_JSON), 'w', encoding='utf-8').write(record(data))
    if skin_literal() != {k: [f['rect'] for f in v['feet']] for k, v in data.items()}:
        print('copy the rects into avatar-foundation-skin.js FEET (then --check)')
    print('feet:', {k: [f['rect'] for f in v['feet']] for k, v in data.items()})
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
