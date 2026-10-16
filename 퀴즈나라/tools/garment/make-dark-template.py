"""Dark-skin garment template (2026-10-16): assets/garment-template/template-sheet.png with the children's skin
painted the darkest shop skin, image 1 of a request whose product sets "base": "dark" (products.json).

  python3 -B tools/garment/make-dark-template.py          write assets/garment-template/template-sheet-dark.png
  python3 -B tools/garment/make-dark-template.py --check  rebuild in memory and compare with the committed file

Why: the cut finds the garment as what changed from the template and tells cloth from skin by colour. Cream,
beige and peach cloth (shirt plackets, cuffs, knit) lie within Lab ~10 of the template's light skin, so their
edges fell to skin or left pale untinted bands (real top:shirt, 2026-10-16); on dark skin they cannot. The
open shoes did the same with dark feet (tools/build-standing-feet.py dark_base).

Skin: the frozen owner map's arm and leg pixels (all paint, outline included, as the game's skin filter tints
the whole limb painting) and the neck's and head's skin-coloured pixels (face, ears, neck; not hair, eyes or the
outline, weighted by how skin-like they are so their edges blend). Each is multiplied by DARK / the sheet's skin colour
per channel, so the shading stays. The garment pipeline reads the same skin from this file (template_tint) for
the frozen body it compares a dark-base sheet against (segment.py Frozen(base='dark')).
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LIGHT = os.path.join(ROOT, 'assets', 'garment-template', 'template-sheet.png')
DARK_PATH = os.path.join(ROOT, 'assets', 'garment-template', 'template-sheet-dark.png')
OWNER = os.path.join(HERE, 'frozen', 'owner-map.png')
LEFT = 90                       # body sheet -> template (common.TEMPLATE['left'])
DARK = (0xa4, 0x69, 0x3f)       # the darkest shop skin (index.html PAL.skin 진한), as build-standing-feet.py
SKIN = (252, 217, 196)          # the sheet's lit skin
LIMB_OWNERS = (3, 5)            # arm, leg (register.OWNER): all their paint
SKIN_OWNERS = (7, 8)            # neck, head: their skin-coloured pixels (the girls' hair lies over the neck)
PAGE = 735                      # RGB sum over which a pixel is the white page
RIM = 6                         # px round the arms' and legs' border with a garment where the owner map is checked
LINE_L = 50                     # Lab L under which a pixel is a drawn line (a cuff's or the limb's edge)


def skin_weight(rgb):
    """0..1: how much a head pixel is the light skin (hair and outline are dark brown, eyes white or teal)."""
    r, b = rgb[..., 0], rgb[..., 2]
    L = lab_l(rgb)
    # warm and light: skin, blush and the ear's pink; hair (L ~30-50) and the outline stay, eyes are not warm
    w = np.clip((r - 150) / 40, 0, 1) * np.clip((r - b - 18) / 20, 0, 1) * np.clip((L - 56) / 10, 0, 1)
    w = w * (rgb.sum(-1) < PAGE)
    # the 1-2 px where skin meets hair or brow are a blend of the two, darker than skin: beside sure skin they
    # take the tint by how light they still are (left light, they read as a pale dotted rim on the dark face)
    from PIL import ImageFilter
    sure = np.asarray(Image.fromarray(((w > .8) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    blend = np.clip((r - 110) / 40, 0, 1) * np.clip((r - b - 18) / 20, 0, 1) * np.clip((L - 40) / 16, 0, 1)
    return np.maximum(w, blend * sure * (rgb.sum(-1) < PAGE))


def lab_l(rgb):
    c = np.clip(rgb, 0, 255) / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    y = .2126 * c[..., 0] + .7152 * c[..., 1] + .0722 * c[..., 2]
    return np.where(y > .008856, 116 * np.cbrt(y) - 16, 903.3 * y)


def lab(rgb):
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from avatar_build import register as R
    return R.lab(rgb)


def grow(mask, px):
    from PIL import ImageFilter
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * px + 1))) > 0


def palette(L, mask, n=600, seed=0):
    px = L[mask]
    if len(px) > n:
        px = px[np.random.default_rng(seed).choice(len(px), n, replace=False)]
    return px


def nearest(L, C):
    out = np.full(L.shape[0], 1e9, np.float32)
    for i in range(0, len(C), 100):
        out = np.minimum(out, np.sqrt(((L[:, None, :] - C[None, i:i + 100]) ** 2).sum(-1)).min(1))
    return out


def rim(t, owner, limb):
    """Skin weight of the arms and legs and the garment pixels beside them (2026-10-16). The owner map gives a
    limb's last 1-3 px under a cuff, a shorts hem or in a shoe's opening to the garment, and a cuff's shaded
    underside (painted in the skin's own colour) to the arm: left light, the first read as a pale rim on the dark
    limb (the pale band the cut must not keep); tinted, the second as a dark notch in the cuff. Colour cannot
    part them, the garment's drawn edge can: within RIM px of the limb/garment border, skin is what the limb's
    inner paint reaches without crossing a dark line (L < LINE_L; the arm's shaded top inside a profile cuff is), and
    of those the garment's pixels the skin palette explains about as well as the garment's own cloth (skin up to 3 Lab nearer
    the cloth, none from 6: where a garment has no edge line, as a shoe's opening, its cream stays light). A limb pixel beside the
    white page stays skin (its antialiased edge); the lines themselves keep their owner's side."""
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from avatar_build import matte as M
    L = lab(t)
    paint = t.sum(-1) < PAGE + 15
    cloth_own = ~np.isin(owner, LIMB_OWNERS + SKIN_OWNERS) & (owner != 0)
    border = M.dilate(limb, RIM) & M.dilate(cloth_own, RIM) & paint
    inner = limb & ~M.dilate(cloth_own, RIM)
    light = paint & (L[..., 0] >= LINE_L)
    reach = M.connected_to((inner | border) & light, inner & light)
    w = limb.astype(np.float32)
    w[border & limb & light & ~reach] = 0  # the cuff's underside behind its edge line
    sk = palette(L, limb & ~M.dilate(cloth_own, 6) & light)
    for o in np.unique(owner[border & cloth_own]):
        g = owner == o
        cloth = palette(L, g & ~M.dilate(limb, 6) & paint)
        m = border & g & reach
        if not len(cloth) or not m.any():
            continue
        lead = nearest(L[m], cloth) - nearest(L[m], sk)  # > 0: nearer the skin
        w[m] = np.clip((lead + 6) / 3, 0, 1)
    return w


def build():
    tpl = np.asarray(Image.open(LIGHT).convert('RGB')).astype(np.float32)
    owner = np.asarray(Image.open(OWNER))
    H, W = owner.shape
    t = tpl[:, LEFT:LEFT + W]
    w = np.zeros((H, W), np.float32)
    limb = np.isin(owner, LIMB_OWNERS) & (t.sum(-1) < PAGE)
    w[:] = rim(t, owner, limb)
    head = np.isin(owner, SKIN_OWNERS)
    w[head] = skin_weight(t)[head]
    gain = np.array(DARK, np.float32) / np.array(SKIN, np.float32)
    dark = t * (1 - w[..., None]) + np.clip(t * gain, 0, 255) * w[..., None]
    out = tpl.copy()
    out[:, LEFT:LEFT + W] = dark
    return out.round().clip(0, 255).astype(np.uint8)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args(argv)
    img = build()
    if a.check:
        ok = os.path.exists(DARK_PATH) and np.array_equal(np.asarray(Image.open(DARK_PATH).convert('RGB')), img)
        print('dark template:', 'OK' if ok else 'CHANGED (python3 -B tools/garment/make-dark-template.py)')
        return 0 if ok else 1
    Image.fromarray(img).save(DARK_PATH, optimize=True)
    print('wrote', os.path.relpath(DARK_PATH, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
