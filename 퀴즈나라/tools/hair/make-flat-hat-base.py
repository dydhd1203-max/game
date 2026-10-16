"""Hat kit base with the hair painted one flat colour (2026-10-16, '모자 요청 방식'): a hat drawn on it is
every pixel that is neither the flat colour nor the base figure, so the cut needs none of the colour rules of
build-hat.py (a brown hat on brown hair, a black visor, a fringe redrawn under the rim).

  node tools/hair/make-hat-hair-base.cjs DIR1 --hat m:short f:bob
  node tools/hair/make-hat-hair-base.cjs DIR8 --hat m:short f:bob --colour 8
  python3 -B tools/hair/make-flat-hat-base.py DIR1 DIR8 OUTDIR

The hair is where the two renders differ (the game tints only the hair): no colour guess. Thin pieces that
follow the hair colour too (eyebrows, the head's outline round the face and ears) are dropped: the mask is
opened, only big pieces kept, holes filled (a back view's highlight is the same in both colours), and grown
back over the hair's own edge. Writes OUTDIR/base.png (the hair flat), base.json (+ 'flat'), hair.png.
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE)))
from avatar_build import matte as M  # noqa: E402
import importlib.util  # noqa: E402
_s = importlib.util.spec_from_file_location('build_hat', os.path.join(HERE, 'build-hat.py'))
BH = importlib.util.module_from_spec(_s); _s.loader.exec_module(BH)

FLAT = (255, 0, 255)  # magenta: Lab 56 from every shop palette colour, 50 from every hat painting's pixel
CHANGE = 20           # summed RGB change between the two renders that is hair
OPEN = 2              # px: thinner pieces (brows, the face's outline) are not the hair body
MIN_PIECE = 1500      # px of a hair piece (a tail, the fringe); brows are a few hundred
CLOSE = 8             # px of a gap in the hair closed (a back view's highlight running to the outline)
REGROW = 3            # px the opened hair grows back over its own edge (inside the changed pixels)


def hair_mask(a, b):
    """The hair of render a: where it differs from render b (another hair colour)."""
    m = np.abs(a.astype(int) - b.astype(int)).sum(-1) > CHANGE
    core = M.dilate(M.erode(m, OPEN), OPEN)
    lab, comps = M.components(core)
    core = np.isin(lab, [c['label'] for c in comps if c['size'] >= MIN_PIECE])
    # (a highlight reaching the outline is no hole: closed over gaps of CLOSE px, on the figure only)
    closed = M.erode(M.dilate(core, CLOSE), CLOSE) & (a.astype(int).sum(-1) < 740)
    return BH.fill_holes(core | closed) | (M.dilate(core, REGROW) & m)


def main(d1, d8, out):
    a = np.asarray(Image.open(os.path.join(d1, 'base.png')).convert('RGB'))
    b = np.asarray(Image.open(os.path.join(d8, 'base.png')).convert('RGB'))
    meta = json.load(open(os.path.join(d1, 'base.json')))
    assert meta['boxes'] == json.load(open(os.path.join(d8, 'base.json')))['boxes'], 'the two renders differ in layout'
    hair = hair_mask(a, b)
    flat = a.copy(); flat[hair] = FLAT
    os.makedirs(out, exist_ok=True)
    Image.fromarray(flat).save(os.path.join(out, 'base.png'), optimize=True)
    Image.fromarray((hair * 255).astype(np.uint8)).save(os.path.join(out, 'hair.png'), optimize=True)
    meta['flat'] = '#%02x%02x%02x' % FLAT
    json.dump(meta, open(os.path.join(out, 'base.json'), 'w'))
    print('flat base: %d hair px -> %s' % (hair.sum(), out))


if __name__ == '__main__':
    sys.exit(main(*sys.argv[1:4]))
