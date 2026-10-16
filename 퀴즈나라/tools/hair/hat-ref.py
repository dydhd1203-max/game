"""Hat pipeline: a three-view design reference (front, side, back of the same
hat at one scale, on white) from the hat pieces build-hat.py cut out of a
returned sheet, for the next request of that hat (image 2 of the kit).

  python3 -B tools/hair/hat-ref.py PIECES_DIR OUT.png [front right back]

The views are figure keys of the pieces (default m-front m-right f-back:
pick the figures whose hat is drawn well, e.g. not a back narrower than its
front). The shop's code shapes are flat drawings and misled ChatGPT (2026-10-15:
the M1 male back came out narrow), so a hat with art uses this picture
(products.json designRefArt) and tools/garment/design-ref.cjs leaves it alone.
Pixels that are not the hat's own colours (hair under the rim, picked up by
the outline) are dropped: a hat pixel is one whose hue is the hat's.
"""
import sys
import numpy as np
from PIL import Image

SCALE, GAP = 2.0, 80


def hue_keep(a):
    """Keep pixels near the hat's dominant hue (the mode of the opaque hues)."""
    rgb = a[..., :3].astype(np.float32) / 255
    mx, mn = rgb.max(-1), rgb.min(-1); d = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    sat = (d / (mx + 1e-6)) > .25
    solid = (a[..., 3] > 128) & sat
    mode = np.argmax(np.histogram(h[solid], 36, (0, 360))[0]) * 10 + 5
    near = np.abs((h - mode + 180) % 360 - 180) < 40
    a = a.copy(); a[..., 3] = np.where(near | ~sat & (mx < .25), a[..., 3], 0)
    return a


def main(argv):
    src, out = argv[0], argv[1]
    keys = argv[2:5] or ['m-front', 'm-right', 'f-back']
    ims = []
    for k in keys:
        a = hue_keep(np.asarray(Image.open('%s/hat-%s.png' % (src, k)).convert('RGBA')))
        im = Image.fromarray(a)
        ims.append(im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.LANCZOS))
    W = sum(i.width for i in ims) + GAP * (len(ims) + 1); H = max(i.height for i in ims) + 2 * GAP
    o = Image.new('RGBA', (W, H), (255, 255, 255, 255)); x = GAP
    for im in ims:
        o.alpha_composite(im, (x, H - GAP - im.height)); x += im.width + GAP
    o.convert('RGB').save(out, optimize=True)
    print(out, o.size)


if __name__ == '__main__':
    main(sys.argv[1:])
