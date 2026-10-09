"""Review images for the frozen body work (stage 3, WP1). Writes PNGs only.

  python3 tools/garment/review-frozen.py [OUT_DIR]      (default 검증/몸/, not committed)

  zones-limits.png        all six figures: zones and limits drawn on the frozen layers
  clean-<figure>.png      8x before/after of the arm and neck art at the basic
                          cuff/collar edge: legacy | clean, dark and light
                          background, skin tones 0 and 4 (the runtime toneMatrix)
  clean-overview.png      the same at 3x, every figure in one sheet
  ghost-real-<figure>.png the real ChatGPT shirt sheet (global fit) over the
                          legacy arm art (ghost line, magenta = band left visible)
                          and over the clean arm art, 8x
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import limits, probe  # noqa: E402
from avatar_build.common import erode, load_rgba  # noqa: E402

ROOT = os.path.dirname(TOOLS)
FZ = os.path.join(ROOT, 'tools', 'garment', 'frozen')
A = os.path.join(ROOT, 'assets')
DARK, LIGHT = np.array([30, 34, 80], np.float32), np.array([236, 234, 226], np.float32)
TONES = {0: '#ffe2cc', 4: '#a4693f'}  # index.html PAL.skin[0], [4]
PAINT_MEDIAN, FACE_LUMINANCE, WARMTH = [252, 217, 196], 223.8, .6  # avatar-foundation-skin.js toneMatrix


def tone_matrix(hexcol):
    s = [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    median = .22 * PAINT_MEDIAN[0] + .59 * PAINT_MEDIAN[1] + .19 * PAINT_MEDIAN[2]
    rows = []
    for c in range(3):
        lum = s[c] * 255 / FACE_LUMINANCE * (1 - WARMTH)
        own = s[c] * 255 / PAINT_MEDIAN[c] * median / FACE_LUMINANCE * WARMTH
        rows.append([round((lum * w + (own if k == c else 0)) * 1e5) / 1e5 for k, w in enumerate((.22, .59, .19))])
    return np.array(rows, np.float32)


def tint(rgba, hexcol):
    m = tone_matrix(hexcol)
    out = rgba.copy()
    out[..., :3] = np.clip((rgba[..., :3] / 255) @ m.T * 255, 0, 255)
    return out


def over(rgba, bg):
    a = rgba[..., 3:] / 255
    return rgba[..., :3] * a + bg * (1 - a)


def zoom(rgb, z):
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    return im.resize((im.width * z, im.height * z), Image.NEAREST)


def font(size=14):
    for p in ('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def label(im, text, size=14, pad=4):
    f = font(size)
    canvas = Image.new('RGB', (im.width, im.height + size + 2 * pad), (255, 255, 255))
    canvas.paste(im, (0, size + 2 * pad))
    ImageDraw.Draw(canvas).text((pad, pad - 1), text, fill=(20, 20, 20), font=f)
    return canvas


def hstack(ims, gap=6, bg=(255, 255, 255)):
    h = max(i.height for i in ims)
    c = Image.new('RGB', (sum(i.width for i in ims) + gap * (len(ims) - 1), h), bg)
    x = 0
    for i in ims:
        c.paste(i, (x, 0)); x += i.width + gap
    return c


def vstack(ims, gap=6, bg=(255, 255, 255)):
    w = max(i.width for i in ims)
    c = Image.new('RGB', (w, sum(i.height for i in ims) + gap * (len(ims) - 1)), bg)
    y = 0
    for i in ims:
        c.paste(i, (0, y)); y += i.height + gap
    return c


def regions(zones):
    """Crop boxes (x0, y0, x1, y1) of the arm cuff edges and the neck collar edge per figure."""
    out = {}
    for key, g in zones['figures'].items():
        boxes = []
        for a in g['arms']:
            ex = a['elbow'][0]
            boxes.append(('arm%d' % a['i'], (int(ex - 24), a['hiddenRow'] - 6, int(ex + 24), a['cleanRow'] + 10)))
        cols = [c for c in g['upper']['columns'] if c[2] == 'collar']
        if cols:
            xs = [c[0] for c in cols]; ub = [c[1] for c in cols]
            boxes.append(('neck', (min(xs) - 6, min(ub) - 10, max(xs) + 7, max(ub) + 16)))
        out[key] = boxes
    return out


def clean_sheets(zones, out_dir):
    legacy = {'arms': load_rgba(os.path.join(A, 'sd-foundation-ref-arms.png')),
              'neck': load_rgba(os.path.join(A, 'sd-foundation-ref-neck.png'))}
    clean = {'arms': load_rgba(os.path.join(A, 'sd-foundation-ref-arms-clean.png')),
             'neck': load_rgba(os.path.join(A, 'sd-foundation-ref-neck-clean.png'))}
    bands = np.asarray(Image.open(os.path.join(FZ, 'contact-bands.png')))
    overview_rows = []
    for key, boxes in regions(zones).items():
        rows, small = [], []
        for name, (x0, y0, x1, y1) in boxes:
            layer = 'neck' if name == 'neck' else 'arms'
            tiles = []
            for tone, hexcol in TONES.items():
                for bgname, bg in (('dark', DARK), ('light', LIGHT)):
                    L = tint(legacy[layer][y0:y1, x0:x1], hexcol)
                    C = tint(clean[layer][y0:y1, x0:x1], hexcol)
                    tiles.append(label(zoom(over(L, bg), 8), 'tone %d %s: before (legacy)' % (tone, bgname)))
                    tiles.append(label(zoom(over(C, bg), 8), 'tone %d %s: after (clean)' % (tone, bgname)))
            band = bands[y0:y1, x0:x1] > 0
            mark = over(legacy[layer][y0:y1, x0:x1], DARK)
            mark[band] = mark[band] * .3 + np.array([255, 0, 255]) * .7
            tiles.append(label(zoom(mark, 8), 'contact band (magenta)'))
            rows.append(label(hstack(tiles), '%s %s  rows %d-%d, cols %d-%d (sheet px), 8x' % (key, name, y0, y1, x0, x1), 18))
            small.append(hstack([zoom(over(tint(legacy[layer][y0:y1, x0:x1], TONES[0]), DARK), 3),
                                 zoom(over(tint(clean[layer][y0:y1, x0:x1], TONES[0]), DARK), 3),
                                 zoom(over(tint(legacy[layer][y0:y1, x0:x1], TONES[4]), LIGHT), 3),
                                 zoom(over(tint(clean[layer][y0:y1, x0:x1], TONES[4]), LIGHT), 3)], 3))
        vstack(rows, 14).save(os.path.join(out_dir, 'clean-%s.png' % key))
        overview_rows.append(label(hstack(small, 16), '%s: before | after (tone 0, dark)  before | after (tone 4, light) per part' % key, 16))
    vstack(overview_rows, 12).save(os.path.join(out_dir, 'clean-overview.png'))


def ghost_real(zones, out_dir, sheet_path):
    labels = np.asarray(Image.open(os.path.join(FZ, 'owner-map.png')))
    bands = np.asarray(Image.open(os.path.join(FZ, 'contact-bands.png')))
    layers = {n: load_rgba(os.path.join(A, 'sd-foundation-ref-%s.png' % n)) for n in ('shirt', 'sleeves', 'shorts', 'arms', 'neck')}
    alpha = {n: layers[n][..., 3] > 127 for n in layers}
    rgb, _ = probe.register_global(sheet_path)
    ref = probe.reference_on_white(load_rgba(os.path.join(A, 'avatar-reference-candidates', 'body-study-2026-10-04.png')))
    M, parts = probe.top_mask(rgb, labels, alpha, zones['figures'], ref)
    arms = {'legacy': layers['arms'], 'clean': load_rgba(os.path.join(A, 'sd-foundation-ref-arms-clean.png'))}
    for key, g in zones['figures'].items():
        rows = []
        for a in g['arms']:
            ex = a['elbow'][0]
            x0, y0, x1, y1 = int(ex - 24), a['hiddenRow'] - 2, int(ex + 24), a['cleanRow'] + 12
            tiles = [label(zoom(rgb[y0:y1, x0:x1], 8), 'ChatGPT sheet (global fit)')]
            for name, art in arms.items():
                # As the runtime layers it: the frozen arm art, the new top
                # (the sheet's top pixels) over it, on a plain page.
                base = np.zeros((y1 - y0, x1 - x0, 3), np.float32) + LIGHT
                body = over(art[y0:y1, x0:x1], base)
                show = np.where(M[y0:y1, x0:x1, None], rgb[y0:y1, x0:x1], body)
                tiles.append(label(zoom(show, 8), 'new sleeve over %s arm art' % name))
                if name == 'legacy':
                    left = (bands[y0:y1, x0:x1] == 1) & ~M[y0:y1, x0:x1]
                    m = show.copy(); m[left] = [255, 0, 255]
                    tiles.append(label(zoom(m, 8), 'legacy: band left visible (magenta) %d px' % left.sum()))
            rows.append(label(hstack(tiles), '%s arm%d (rows %d-%d)' % (key, a['i'], y0, y1), 18))
        vstack(rows, 14).save(os.path.join(out_dir, 'ghost-real-%s.png' % key))


def zones_limits(zones, lim, out_dir):
    labels = np.asarray(Image.open(os.path.join(FZ, 'owner-map.png')))
    bands = np.asarray(Image.open(os.path.join(FZ, 'contact-bands.png')))
    hair = np.asarray(Image.open(os.path.join(FZ, 'hair-occlusion.png'))) > 0
    neck = erode(load_rgba(os.path.join(A, 'sd-foundation-ref-neck-clean.png'))[..., 3] > 200, 1)
    names = ('neck', 'legs', 'shoes', 'shorts', 'shirt', 'arms', 'sleeves')
    comp = np.zeros(labels.shape + (3,), np.float32) + LIGHT
    for n in names:
        comp = over(load_rgba(os.path.join(A, 'sd-foundation-ref-%s.png' % n)), comp)
    comp = comp * .55 + LIGHT * .45
    comp[bands > 0] = [255, 0, 255]
    comp[hair] = comp[hair] * .4 + np.array([255, 140, 0]) * .6
    edge = neck & ~erode(neck, 1)
    comp[edge] = [0, 170, 200]
    Z = 2
    tiles = []
    for key, g in zones['figures'].items():
        x0, y0, x1, y1 = g['cell']
        top = y0 + (180 if y0 == 0 else 180)
        im = zoom(comp[top:y1, x0:x1], Z)
        d = ImageDraw.Draw(im)
        P = lambda x, y: ((x - x0) * Z, (y - top) * Z)
        k = g['k']
        for a in g['armholes']:
            d.line([P(*p) for p in a['seam']], fill=(200, 0, 0), width=1)
            for nm, col in (('S', (220, 0, 0)), ('A', (0, 60, 220))):
                x, y = a[nm]; d.ellipse([P(x, y)[0] - 4, P(x, y)[1] - 4, P(x, y)[0] + 4, P(x, y)[1] + 4], outline=col, width=2)
        for a in g['arms']:
            sh, ax = np.array(a['shoulder']), np.array(a['axis'])
            d.line([P(*sh), P(*(sh + ax * a['tCap']))], fill=(0, 150, 0), width=1)
            el = np.array(a['elbow'])
            r = a['re'] * Z
            d.ellipse([P(*el)[0] - r, P(*el)[1] - r, P(*el)[0] + r, P(*el)[1] + r], outline=(0, 150, 0))
            th = sh + ax * limits.t_hidden(a, 0)
            nrm = np.array(a['normal']) * a['half'] * 2
            d.line([P(*(th - nrm)), P(*(th + nrm))], fill=(0, 170, 200), width=2)
            cap = sh + ax * a['tCap']
            d.line([P(*(cap - nrm)), P(*(cap + nrm))], fill=(220, 0, 0), width=2)
        for x, hb, st, armed in g['hem']['columns']:
            w = st - g['hem']['waistCoverOffsetPx']
            need = w + g['hem']['overlapU'] / k
            d.point(P(x, w), fill=(0, 60, 220)); d.point(P(x, need), fill=(230, 170, 0))
            d.point(P(x, g['hem']['hemLowRow']), fill=(220, 0, 0))
        for x, ub, zone, hid, cut_row, s_row in g['upper']['columns']:
            name, row = limits._upper_limit(g, x, ub, zone, cut_row, s_row)
            d.point(P(x, row), fill=(120, 120, 120) if hid else ((230, 170, 0) if name == 'COLLAR_HIGH' else (220, 0, 0)))
        for lg in g['legs']:
            c0, c1 = lg['cols']
            d.line([P(c0 - 6, lg['hiddenRow']), P(c1 + 6, lg['hiddenRow'])], fill=(0, 170, 200), width=2)
            d.line([P(c0 - 6, lg['longRow']), P(c1 + 6, lg['longRow'])], fill=(220, 0, 0), width=2)
        for ft in g['feet']:
            c0, c1 = ft['cols']
            for row, col in ((g['floor'] - 3, (0, 150, 0)), (g['floor'] + 3, (0, 150, 0)), (ft['highRow'], (220, 0, 0))):
                d.line([P(c0 - 8, row), P(c1 + 8, row)], fill=col, width=1)
        basic = lim['basic'][key]
        mins = []
        for cls, res in basic.items():
            for name, part, mg in limits.margins(res):
                mins.append((mg, name, part))
        worst = min(mins)
        tiles.append(label(im, '%s  min basic margin %.1f px (%s %s)' % (key, worst[0], worst[1], worst[2]), 16))
    legend = ('magenta contact band | orange hair occlusion | cyan: clean neck edge, clean-art top (sleeve), legs hidden row | '
              'green: sleeve axis, elbow cap radius re, floor +-3 | red: cap end (SLEEVE_LONG), HEM_LOW, SHORTS_LONG, '
              'SHOE_HIGH, CAP_HIGH row | blue: waist cover line W | amber: HEM_HIGH need, COLLAR_HIGH | grey: under hair')
    sheet = vstack([hstack(tiles[:3], 10), hstack(tiles[3:], 10)], 10)
    label(sheet, legend, 15).save(os.path.join(out_dir, 'zones-limits.png'))


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    out_dir = argv[0] if argv else os.path.join(ROOT, '검증', '몸')
    os.makedirs(out_dir, exist_ok=True)
    zones = json.load(open(os.path.join(FZ, 'zones.json'), encoding='utf-8'))
    lim = json.load(open(os.path.join(FZ, 'limits.json'), encoding='utf-8'))
    zones_limits(zones, lim, out_dir)
    clean_sheets(zones, out_dir)
    ghost_real(zones, out_dir, os.path.join(A, 'garment-sources', 'top-shirt-10-chatgpt-2026-10-09.webp'))
    print('written to ' + out_dir)
    return 0


if __name__ == '__main__':
    sys.exit(main())
