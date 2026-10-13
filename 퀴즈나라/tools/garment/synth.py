"""Registration-level synthetic uploads, made by code from the template (stage 3, WP5).

  python3 tools/garment/synth.py --out DIR [--only NAME ...] [--list]

Every variant is drawn from the reference sheet and its frozen layers by code
(compositing, resampling, hue rotation, translation, rotation): nothing is
painted by hand. Each variant writes <name>.<ext> and <name>.truth.json:

  truth.figures[key] = {s, b}   the true transform sheet px -> upload px
                                (centre-based: q = s * p + b, the same
                                convention as tools/avatar_build/register.py)
  truth.expect                  'pass' or the failure codes the registration
                                must raise (with the slot/sexes to register as)

Positives (registration must recover every figure within .3 px):
  identity, png1536, webp80 (the ChatGPT path), s097, s103, shift+10/-10,
  fig+2%+5px, fig-2%-5px, drift (per figure +-2.5 % and +-8 px), pad1536 (square,
  letterboxed), jpeg70, webp60, bright+8/-8, alpha (transparent PNG),
  offwhite250, top-recoloured (the product itself changed), specks,
  fig+4.5% (a W_SCALE warning only).
pad1024 (ChatGPT's square 1024x1024 output, letterboxed) is both: the size
gate (long side >= 1200) fails it with SIZE_SMALL, and registered with the
gate lowered (truth 'precision') it must still recover within .3 px.
Negatives (each must fail with its code): squash8, square, squash4 (the
affine path), fig+8%, crop-bottom, crop-top, blank (missing figure), moved
(one figure 40 px), rows-swapped, views-swapped, mirrored, checkerboard,
grey, shadow, text, small (512 px), arm-moved, arm-rotated, leg-moved,
shorts-recoloured, skin-tinted (the body redrawn darker), female-changed
(male-only product), hair-over.
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import register as R  # noqa: E402
from avatar_build.common import TEMPLATE  # noqa: E402

ROOT = os.path.dirname(TOOLS)
ASSETS = os.path.join(ROOT, 'assets')
LAYER_NAMES = ('shirt', 'sleeves', 'shorts', 'shoes', 'arms', 'legs', 'neck')
Z_BELOW = {'sleeves': ('arms', 'shirt', 'shorts', 'shoes', 'legs', 'neck'),
           'arms': ('shirt', 'shorts', 'shoes', 'legs', 'neck'),
           'legs': ('neck',), 'shoes': ('legs', 'neck')}
FONT = os.path.join(ASSETS, 'fonts', 'NanumSquareRoundB.ttf')
G1536 = 1536 / TEMPLATE['width']

_CACHE = {}


def base():
    if 'sheet' not in _CACHE:
        _CACHE['sheet'] = np.asarray(Image.open(R.SHEET_PATH).convert('RGBA')).astype(np.float32)
        _CACHE['layers'] = {n: np.asarray(Image.open(os.path.join(ASSETS, 'sd-foundation-ref-%s.png' % n)).convert('RGBA'))
                            .astype(np.float32) for n in LAYER_NAMES}
        _CACHE['owner'] = np.asarray(Image.open(os.path.join(R.FROZEN, 'owner-map.png')))
        _CACHE['data'] = R._read_data_js()['figures']
    return _CACHE['sheet'], _CACHE['layers'], _CACHE['owner'], _CACHE['data']


# ---------------------------------------------------------------------------
# Edits of the sheet (RGBA, sheet px)
# ---------------------------------------------------------------------------
def over(top, bottom):
    """Straight-alpha 'over' of two float RGBA arrays."""
    ta = top[..., 3:] / 255; ba = bottom[..., 3:] / 255
    oa = ta + ba * (1 - ta)
    rgb = (top[..., :3] * ta + bottom[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)


def under(layers, names, region):
    """What lies under a removed part: the lower layers composited (z order)."""
    out = np.zeros(layers['neck'].shape, np.float32)
    for n in reversed(names):  # bottom-most first
        out = over(layers[n], out)
    res = np.zeros_like(out)
    res[region] = out[region]
    return res


def hue_rotate(rgb, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    Mx = np.array([[0.299, 0.587, 0.114], [0.596, -0.274, -0.322], [0.211, -0.523, 0.312]])
    yiq = rgb @ Mx.T
    i, q = yiq[..., 1].copy(), yiq[..., 2].copy()
    yiq[..., 1] = i * c - q * s; yiq[..., 2] = i * s + q * c
    return np.clip(yiq @ np.linalg.inv(Mx).T, 0, 255)


def recolour(E, mask, deg, light=0.0):
    """Hue-rotate (and lighten) the pixels of `mask` (float 0..1 weight)."""
    out = E.copy()
    rot = hue_rotate(E[..., :3], deg) + light
    w = mask[..., None]
    out[..., :3] = np.clip(E[..., :3] * (1 - w) + rot * w, 0, 255)
    return out


def side_mask(shape, cell, center, side):
    x0, y0, x1, y1 = cell
    m = np.zeros(shape, bool)
    c = int(round(center))
    if side == 'L':
        m[y0:y1, x0:c] = True
    elif side == 'R':
        m[y0:y1, c:x1] = True
    else:
        m[y0:y1, x0:x1] = True
    return m


def move_part(E, layers, names, region, dx=0, dy=0, rotate=None):
    """Lift the pixels of `names` layers inside `region`, fill what lay under
    them, and put them back translated by (dx, dy) or rotated
    (deg, (cx, cy)) about a point."""
    part = np.zeros(E.shape, np.float32)
    for n in reversed(names):
        lay = np.zeros(E.shape, np.float32)
        lay[region] = layers[n][region]
        part = over(lay, part)
    lifted = part[..., 3] > 0
    below = tuple(n for n in Z_BELOW[names[-1]] if n not in names)
    fill = under(layers, below, lifted)
    out = E.copy()
    out[lifted] = fill[lifted]
    img = Image.fromarray(np.clip(part, 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
    if rotate is not None:
        deg, (cx, cy) = rotate
        img = img.rotate(deg, resample=Image.BICUBIC, center=(cx, cy))
    else:
        img = img.transform(img.size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy), resample=Image.NEAREST)
    moved = np.asarray(img.convert('RGBA')).astype(np.float32)
    return over(moved, out)


# ---------------------------------------------------------------------------
# Placement and the global path
# ---------------------------------------------------------------------------
def cell_image(E, key):
    x0, y0, x1, y1 = R.CELLS[key]
    iso = np.zeros(E.shape, np.float32)
    iso[y0:y1, x0:x1] = E[y0:y1, x0:x1]
    return Image.fromarray(np.clip(np.rint(iso), 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')


def place(E, figs, size, flip=()):
    """Draw each figure k with its transform figs[k] = (s, (tx, ty)) (sheet px
    -> canvas px, centre-based) on a transparent canvas of `size`."""
    W, H = size
    canvas = Image.new('RGBa', (W, H), (0, 0, 0, 0))
    for key, (s, t) in figs.items():
        x0, y0, x1, y1 = R.CELLS[key]
        src = cell_image(E, key)
        if key in flip:
            # mirror the figure inside its cell (about the cell centre)
            a = np.asarray(src).copy()
            a[y0:y1, x0:x1] = a[y0:y1, x0:x1][:, ::-1]
            src = Image.fromarray(a, 'RGBa')
        cx0 = int(math.floor(s * x0 + t[0])) - 2; cy0 = int(math.floor(s * y0 + t[1])) - 2
        cx1 = int(math.ceil(s * x1 + t[0])) + 2; cy1 = int(math.ceil(s * y1 + t[1])) + 2
        cx0, cy0 = max(0, cx0), max(0, cy0)
        cx1, cy1 = min(W, cx1), min(H, cy1)
        if cx1 <= cx0 or cy1 <= cy0:
            continue
        # output canvas pixel c samples sheet p = (c - t) / s
        r = R.warp_cell(src, 1 / s, (-t[0] / s, -t[1] / s), (cx0, cy0, cx1, cy1), Image.LANCZOS, fill=0)
        layer = Image.new('RGBa', (W, H), (0, 0, 0, 0))
        layer.paste(r, (cx0, cy0))
        canvas = Image.alpha_composite(canvas.convert('RGBA'), layer.convert('RGBA')).convert('RGBa')
    return canvas.convert('RGBA')


def finish(canvas, g, o, out_size, background=(255, 255, 255), underlay=None, alpha=False):
    """Canvas -> final image: f = g * c + o (centre-based), then composite on
    the page (or keep the alpha)."""
    W, H = out_size
    src = canvas.convert('RGBa')
    r = R.warp_cell(src, 1 / g, (-o[0] / g, -o[1] / g), (0, 0, W, H), Image.LANCZOS, fill=0).convert('RGBA')
    if alpha:
        return r
    page = Image.new('RGBA', (W, H), background + (255,)) if underlay is None else underlay.convert('RGBA')
    return Image.alpha_composite(page, r).convert('RGB')


def nominal_figs(scale=1.0, shift=(0.0, 0.0), centre=None):
    """Every figure at the template placement (canvas = template, 1629x1086)."""
    return {k: (scale, (TEMPLATE['left'] * scale + shift[0], shift[1])) for k in R.CELLS}


def truth_of(figs, g, o):
    return {k: {'s': g * s, 'b': [g * t[0] + o[0], g * t[1] + o[1]]} for k, (s, t) in figs.items()}


def chatgpt_path(E, figs=None, out=(1536, 1024), flip=(), background=(255, 255, 255), underlay=None, alpha=False,
                 g=None, o=None):
    figs = figs or nominal_figs()
    canvas = place(E, figs, (TEMPLATE['width'], TEMPLATE['height']), flip)
    if g is None:
        g = out[0] / TEMPLATE['width']
    if o is None:
        o = (.5 * (g - 1), .5 * (g - 1))  # the same as PIL's full-image resize
    return finish(canvas, g, o, out, background, underlay, alpha), truth_of(figs, g, o)


# ---------------------------------------------------------------------------
# Variants
# ---------------------------------------------------------------------------
def _sheet_edit(fn):
    S, L, O, D = base()
    return fn(S.copy(), L, O, D)


def v_identity():
    im = Image.open(R.TEMPLATE_PATH).convert('RGB')
    return im, {k: {'s': 1.0, 'b': [float(TEMPLATE['left']), 0.0]} for k in R.CELLS}


def v_scaled(f, out=(1536, 1024)):
    S = base()[0]
    g = out[0] / TEMPLATE['width'] * f
    cw, ch = TEMPLATE['width'] * g, TEMPLATE['height'] * g
    o = ((out[0] - cw) / 2 + .5 * (g - 1), (out[1] - ch) / 2 + .5 * (g - 1))
    return chatgpt_path(S, out=out, g=g, o=o)


def v_shift(dx, dy, pad=20):
    """The whole sheet shifted (upload px) on a page `pad` px taller at the
    top and bottom (the template has only 9 px above the boys' heads)."""
    S = base()[0]
    g = G1536
    return chatgpt_path(S, out=(1536, 1024 + 2 * pad), g=g, o=(.5 * (g - 1) + dx, pad + .5 * (g - 1) + dy))


def v_figure(key, f, dx, dy, pad=40):
    """One figure scaled by f about its soles' centre and shifted (canvas
    px). The template has 9 px above the boys' heads and 5 px between the
    rows, so the page gets `pad` px of white above and below (a taller page
    is itself a drift the registration must absorb)."""
    S, L, O, D = base()
    figs = nominal_figs()
    x0, y0, x1, y1 = R.CELLS[key]
    cx, cy = (x0 + x1) / 2, D[key]['floor']
    s, t = figs[key]
    figs[key] = (s * f, (t[0] + cx * s * (1 - f) + dx, t[1] + cy * s * (1 - f) + dy))
    g = G1536
    return chatgpt_path(S, figs, out=(1536, 1024 + 2 * pad), g=g, o=(.5 * (g - 1), pad + .5 * (g - 1)))


def v_drift(seed=7):
    S = base()[0]
    rng = np.random.default_rng(seed)
    figs = nominal_figs()
    for key in figs:
        f = 1 + rng.uniform(-.025, .025)
        dx, dy = rng.uniform(-8, 8), rng.uniform(-8, 8)
        x0, y0, x1, y1 = R.CELLS[key]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        s, t = figs[key]
        figs[key] = (s * f, (t[0] + cx * s * (1 - f) + dx, t[1] + cy * s * (1 - f) + dy))
    return chatgpt_path(S, figs)


def v_pad(side):
    """The 3:2 sheet letterboxed into a square page (side x side)."""
    S = base()[0]
    g = side / TEMPLATE['width']
    top = int(round((side - TEMPLATE['height'] * g) / 2))
    return chatgpt_path(S, out=(side, side), g=g, o=(.5 * (g - 1), top + .5 * (g - 1)))


def v_bright(f):
    """The figures lighter (f > 1, toward white) or darker (f < 1); the page
    stays white, as ChatGPT keeps it."""
    S = base()[0].copy()
    rgb = S[..., :3]
    S[..., :3] = np.clip(rgb * f if f < 1 else 255 - (255 - rgb) * (2 - f), 0, 255)
    return chatgpt_path(S)


def v_alpha():
    return chatgpt_path(base()[0], alpha=True)


def v_offwhite():
    return chatgpt_path(base()[0], background=(250, 250, 250))


def v_top_recoloured():
    def fn(E, L, O, D):
        m = np.maximum(L['shirt'][..., 3], L['sleeves'][..., 3]) / 255
        m = np.where(np.isin(O, (1, 2)), np.maximum(m, 1.0), m * (O != 8) * (O != 3))
        return recolour(E, m.astype(np.float32), 150)
    return chatgpt_path(_sheet_edit(fn))


def v_specks():
    im, truth = chatgpt_path(base()[0])
    d = ImageDraw.Draw(im)
    for x, y in ((40, 980), (1490, 60), (760, 520)):
        d.ellipse((x, y, x + 9, y + 9), fill=(120, 120, 120))
    return im, truth


def v_squash(f):
    S = base()[0]
    g = G1536
    canvas = place(S, nominal_figs(), (TEMPLATE['width'], TEMPLATE['height']))
    W, H = int(round(1536 * f)), 1024
    im = canvas.convert('RGBa').resize((W, H), Image.LANCZOS).convert('RGBA')
    page = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    return Image.alpha_composite(page, im).convert('RGB'), None


def v_square(side=1536):
    """The 3:2 sheet stretched to a square page (ChatGPT's square output)."""
    S = base()[0]
    canvas = place(S, nominal_figs(), (TEMPLATE['width'], TEMPLATE['height']))
    im = canvas.convert('RGBa').resize((side, side), Image.LANCZOS).convert('RGBA')
    return Image.alpha_composite(Image.new('RGBA', (side, side), (255,) * 4), im).convert('RGB'), None


def v_crop(edge, px=100):
    im, truth = chatgpt_path(base()[0])
    W, H = im.size
    if edge == 'bottom':
        return im.crop((0, 0, W, H - px)), truth
    for k in truth:
        truth[k]['b'][1] -= px
    return im.crop((0, px, W, H)), truth


def v_blank(key):
    S = base()[0].copy()
    x0, y0, x1, y1 = R.CELLS[key]
    S[y0:y1, x0:x1, 3] = 0
    return chatgpt_path(S)


def v_rows_swapped():
    S = base()[0]
    figs = nominal_figs()
    swapped = {}
    for k, (s, t) in figs.items():
        # boys' row (y 9-551) down by 525, girls' row (y 556-1076) up by 550
        swapped[k] = (s, (t[0], t[1] + (525 if k[0] == 'm' else -550)))
    return chatgpt_path(S, swapped)


def v_views_swapped():
    S = base()[0]
    figs = nominal_figs()
    a, b = 'm-front', 'm-back'
    ca, cb = R.CELLS[a], R.CELLS[b]
    figs[a] = (1.0, (figs[a][1][0] + (cb[0] + cb[2]) / 2 - (ca[0] + ca[2]) / 2, 0.0))
    figs[b] = (1.0, (figs[b][1][0] + (ca[0] + ca[2]) / 2 - (cb[0] + cb[2]) / 2, 0.0))
    return chatgpt_path(S, figs)


def v_mirrored(key='m-right'):
    return chatgpt_path(base()[0], flip=(key,))


def v_checker():
    W, H = 1536, 1024
    yy, xx = np.mgrid[0:H, 0:W]
    a = np.where(((xx // 16) + (yy // 16)) % 2 == 0, 255, 204).astype(np.uint8)
    under_ = Image.fromarray(np.dstack([a, a, a]))
    return chatgpt_path(base()[0], underlay=under_)


def v_grey():
    return chatgpt_path(base()[0], background=(222, 222, 222))


def v_shadow():
    S, L, O, D = base()
    W, H = 1536, 1024
    g = G1536
    sh = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(sh)
    for k, F in D.items():
        cx = (F['center'] + TEMPLATE['left']) * g
        fy = (F['floor'] + 4) * g
        d.ellipse((cx - 80, fy - 10, cx + 80, fy + 8), fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    a = np.asarray(sh).astype(np.float32)[..., None] / 255
    page = (255 - a * 75).astype(np.uint8)
    under_ = Image.fromarray(np.repeat(page, 3, -1))
    return chatgpt_path(S, underlay=under_)


def v_text():
    im, truth = chatgpt_path(base()[0])
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT, 34)
    d.text((24, 18), 'Character Sheet', fill=(70, 60, 60), font=font)
    d.text((1300, 980), '캐릭터 시트', fill=(70, 60, 60), font=font)
    return im, truth


def v_small():
    im, truth = chatgpt_path(base()[0])
    return im.resize((512, 341), Image.LANCZOS), None


def _arm_region(D, key, side, layers, from_sleeve=True):
    F = D[key]
    m = side_mask(layers['arms'].shape[:2], R.CELLS[key], F['center'], side)
    if from_sleeve:
        sl = (layers['sleeves'][..., 3] > 0) & m
        low = np.nonzero(sl.any(1))[0].max()
        m[:low + 1] = False
    return m


def v_arm_moved(key='m-front', side='L', dx=-8):
    def fn(E, L, O, D):
        return move_part(E, L, ('arms',), _arm_region(D, key, side, L), dx=dx)
    return chatgpt_path(_sheet_edit(fn))


def v_arm_rotated(key='f-front', side='R', deg=6):
    def fn(E, L, O, D):
        m = side_mask(L['arms'].shape[:2], R.CELLS[key], D[key]['center'], side)
        i = 0 if side == 'L' else 1
        sh = D[key]['joints']['shoulder'][i]
        # PIL rotates counter-clockwise on screen for positive angles, which
        # swings a hanging arm's hand to the right: outward for the
        # screen-right arm.
        return move_part(E, L, ('sleeves', 'arms'), m, rotate=(deg if side == 'R' else -deg, (sh[0], sh[1])))
    return chatgpt_path(_sheet_edit(fn))


def v_leg_moved(key='m-back', side='R', dx=6):
    def fn(E, L, O, D):
        m = side_mask(L['legs'].shape[:2], R.CELLS[key], D[key]['center'], side)
        sh = (L['shorts'][..., 3] > 0) & m
        low = np.nonzero(sh.any(1))[0].max()
        m[:low + 1] = False
        return move_part(E, L, ('shoes', 'legs'), m, dx=dx)
    return chatgpt_path(_sheet_edit(fn))


def v_shorts_recoloured():
    def fn(E, L, O, D):
        m = (L['shorts'][..., 3] / 255) * (O != 8) * ~np.isin(O, (1, 2, 3))
        m = np.where(O == 4, 1.0, m).astype(np.float32)
        return recolour(E, m, 140, light=-10)
    return chatgpt_path(_sheet_edit(fn))


def v_skin_tinted():
    """The body skin redrawn darker and redder (arms, legs, neck; heads
    untouched): a body drift, not a garment change."""
    def fn(E, L, O, D):
        m = np.isin(O, (3, 5, 7)).astype(np.float32)
        out = E.copy()
        rgb = E[..., :3]
        tint = np.clip(rgb * np.array([.93, .80, .78]), 0, 255)
        out[..., :3] = rgb * (1 - m[..., None]) + tint * m[..., None]
        return out
    return chatgpt_path(_sheet_edit(fn))


def v_female_changed():
    def fn(E, L, O, D):
        m = np.maximum(L['shirt'][..., 3], L['sleeves'][..., 3]) / 255
        m = np.where(np.isin(O, (1, 2)), 1.0, m * (O != 8) * (O != 3)).astype(np.float32)
        m[:555] = 0  # only the girls
        return recolour(E, m, 150)
    return chatgpt_path(_sheet_edit(fn))


def v_hair_over(key='f-front', drop=34):
    """The bob drawn longer over both shoulders: the reference hair just
    above the collar is repeated `drop` px lower, over the shirt."""
    def fn(E, L, O, D):
        x0, y0, x1, y1 = R.CELLS[key]
        cy = R.COLLAR_Y['f']
        hair = np.zeros(O.shape, bool)
        hair[cy - 40:cy + 6, x0:x1] = O[cy - 40:cy + 6, x0:x1] == 8
        F = D[key]
        hair[:, int(F['center']) - 40:int(F['center']) + 40] = False  # keep the face/neck clear
        strip = np.zeros(E.shape, np.float32)
        strip[hair] = E[hair]
        moved = np.roll(strip, drop, axis=0)
        out = over(moved, E)
        return over(strip, out)
    return chatgpt_path(_sheet_edit(fn))


# name: (builder, format, quality, expect, options)
VARIANTS = {
    # positives
    'identity': (v_identity, 'png', None, 'pass', {}),
    'png1536': (lambda: chatgpt_path(base()[0]), 'png', None, 'pass', {}),
    'webp80': (lambda: chatgpt_path(base()[0]), 'webp', 80, 'pass', {}),
    's097': (lambda: v_scaled(.97), 'png', None, 'pass', {}),
    's103': (lambda: v_scaled(1.03, out=(1536, 1060)), 'png', None, 'pass', {}),
    'shift+10': (lambda: v_shift(10, -10), 'png', None, 'pass', {}),
    'shift-10': (lambda: v_shift(-10, 10), 'png', None, 'pass', {}),
    'fig+2%+5px': (lambda: v_figure('f-right', 1.02, 5, 5), 'png', None, 'pass', {}),
    'fig-2%-5px': (lambda: v_figure('m-front', .98, -5, -5), 'png', None, 'pass', {}),
    'drift': (v_drift, 'png', None, 'pass', {}),
    'pad1536': (lambda: v_pad(1536), 'png', None, 'pass', {}),
    'pad1024': (lambda: v_pad(1024), 'png', None, ['SIZE_SMALL'], {'precision': 1000}),
    'jpeg70': (lambda: chatgpt_path(base()[0]), 'jpeg', 70, 'pass', {}),
    'webp60': (lambda: chatgpt_path(base()[0]), 'webp', 60, 'pass', {}),
    'bright+8': (lambda: v_bright(1.08), 'png', None, 'pass', {}),
    'bright-8': (lambda: v_bright(.92), 'png', None, 'pass', {}),
    'alpha': (v_alpha, 'png', None, 'pass', {}),
    'offwhite250': (v_offwhite, 'png', None, 'pass', {}),
    'top-recoloured': (v_top_recoloured, 'webp', 90, 'pass', {}),
    'specks': (v_specks, 'png', None, 'pass', {'warn': ['W_SPECKS']}),
    'fig+4.5%': (lambda: v_figure('f-back', 1.045, 0, 0), 'png', None, 'pass', {'warn': ['W_SCALE']}),
    # negatives
    'squash8': (lambda: v_squash(.92), 'png', None, ['SQUASH'], {}),
    'squash4': (lambda: v_squash(.96), 'png', None, ['SQUASH'], {}),
    'square': (v_square, 'png', None, ['SQUASH'], {}),
    'fig+8%': (lambda: v_figure('m-right', 1.08, 0, 0), 'png', None, ['FIGURE_SCALE'], {}),
    'crop-bottom': (lambda: v_crop('bottom'), 'png', None, ['LAYOUT_COUNT'], {}),
    'crop-top': (lambda: v_crop('top'), 'png', None, ['LAYOUT_COUNT'], {}),
    'blank': (lambda: v_blank('f-right'), 'png', None, ['LAYOUT_COUNT'], {}),
    'moved': (lambda: v_figure('m-back', 1.0, 40, 0), 'png', None, ['LAYOUT_MOVED'], {}),
    'rows-swapped': (v_rows_swapped, 'png', None, ['LAYOUT_ORDER'], {}),
    'views-swapped': (v_views_swapped, 'png', None, ['LAYOUT_ORDER'], {}),
    'mirrored': (v_mirrored, 'png', None, ['LAYOUT_MIRROR'], {}),
    'checkerboard': (v_checker, 'png', None, ['BACKGROUND'], {}),
    'grey': (v_grey, 'png', None, ['BACKGROUND'], {}),
    'shadow': (v_shadow, 'png', None, ['SHADOW'], {}),
    'text': (v_text, 'png', None, ['FOREIGN_MARK'], {}),
    'small': (v_small, 'png', None, ['SIZE_SMALL'], {}),
    'arm-moved': (v_arm_moved, 'webp', 85, ['POSE_ARM'], {}),
    'arm-rotated': (v_arm_rotated, 'webp', 85, ['POSE_ARM'], {}),
    'leg-moved': (v_leg_moved, 'webp', 85, ['POSE_LEG'], {}),
    'shorts-recoloured': (v_shorts_recoloured, 'webp', 85, ['OTHER_SLOT_CHANGED'], {}),
    'skin-tinted': (v_skin_tinted, 'webp', 85, ['BODY_DRIFT'], {}),
    'female-changed': (v_female_changed, 'webp', 85, ['SINGLE_SEX_CHANGED'], {'sexes': ['m']}),
    'hair-over': (v_hair_over, 'webp', 85, ['HAIR_OVER_GARMENT'], {}),
}


def build(name, out_dir):
    fn, fmt, quality, expect, opts = VARIANTS[name]
    im, truth = fn()
    ext = {'png': 'png', 'webp': 'webp', 'jpeg': 'jpg'}[fmt]
    path = os.path.join(out_dir, '%s.%s' % (name, ext))
    kw = {}
    if fmt == 'webp':
        kw = dict(quality=quality, method=4)
    elif fmt == 'jpeg':
        kw = dict(quality=quality, subsampling=2)
    if fmt == 'jpeg' and im.mode != 'RGB':
        im = im.convert('RGB')
    im.save(path, {'jpeg': 'JPEG', 'webp': 'WEBP', 'png': 'PNG'}[fmt], **kw)
    meta = dict(name=name, file=os.path.basename(path), format=fmt, quality=quality, size=list(im.size),
                expect=expect, slot=opts.get('slot', 'top'), sexes=opts.get('sexes', ['m', 'f']),
                warn=opts.get('warn', []), precision=opts.get('precision'),
                figures={k: {'s': float(v['s']), 'b': [float(v['b'][0]), float(v['b'][1])]} for k, v in truth.items()}
                if truth else None)
    with open(path + '.truth.json', 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    return path, meta


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=False)
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args(argv)
    if a.list:
        for n, v in VARIANTS.items():
            print('%-18s %-5s %-4s %s' % (n, v[1], v[2] or '', v[3]))
        return 0
    if not a.out:
        ap.error('--out DIR is required')
    os.makedirs(a.out, exist_ok=True)
    for n in (a.only or VARIANTS):
        path, meta = build(n, a.out)
        print('%-18s %s %s' % (n, path, meta['expect']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
