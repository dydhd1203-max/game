"""Verify the garment pipeline (stage 3, WP6; plan verification B).

  python3 -B tools/garment/verify-pipeline.py --roundtrip [--positives] [--cream] [--controls] [--out DIR] [--only NAME,...]
  python3 -B tools/garment/verify-pipeline.py --all [--register]   the whole suite (WP8), 4 cases at a time,
                                                                   a table in OUT/요약.md
  ... --base dark   the same cases drawn on the dark-skin template (make-dark-template.py, products "base": "dark")

--roundtrip (R1): the basic outfit itself, once as the template sheet (1629x1086
  PNG, 'identity') and once through the ChatGPT path (1536x1024 WebP q80,
  'webp80'), built per slot (top, bottom, shoes) with tools/garment/
  build-garment.py (the other two slots known) and compared with the drawn
  basic garments (segment.py drawn_layers):
    registration     identity |dx|,|dy| <= .1 px and |s - 1| <= 5e-4;
                     webp80 joint error <= 1 px (plan)
    per-part IoU     >= .98 torso/bottom/shoes, >= .97 sleeves (alpha > .5);
                     cloth the truth hides under another layer is left out,
                     cloth the pipeline itself rebuilt where the sheet shows
                     it (the profile ring) is compared like any pixel
    edge alpha       MAE <= .05 on the 2 px band around the truth silhouette
                     where it meets the open page (not by the head, not where
                     another layer paints the same pixel); webp80 adds the
                     input's own edge error (edgeInput: the truth alpha after
                     the 1629 -> 1536 -> 1629 resampling alone)
    colour           mean |dRGB| on pixels opaque in both: per slot pooled
                     (dRGBPooled, the plan's figure) and per part, <= 2/255
                     (identity) / 4/255 (webp80), or the input's own error on
                     the same pixels + .5/255 where that is larger (dRGBInput:
                     WebP q80 + the resize alone give 2.3-7.7/255 on line-rich
                     parts, so no pipeline can meet 4/255 there)
    seams            every cuff/collar/hem/shorts/shoe seam against the drawn
                     edge (columns where limb paint lies past it), symmetric
                     point-to-polyline distance: median <= 1, max <= 2 px
    metadata         SEAT cut/apex/cuff +-1.5 and rise +-3, SIDE_SEAT +-1.5
                     (avatar-foundation-outfit.js), sleeve cuff within 2 px of
                     cuff_top, raised drawing IoU >= .97, underarm side edge
                     +-.03 u across the edge above the lower hem (the hem row itself is a seam:
                     <= 2 px), against tools/garment/fixtures/
                     runtime-side-raised.json; colour readings (underarm cloth
                     and line, edgeTone) dE <= 3, or the input's own dE at the
                     same reading + 3 where that is larger (the runtime rule run
                     on the truth geometry with the input's colours: a legacy
                     pixel's straight colour under partial alpha, which a
                     composite on white cannot show)
    codes            a known-good input raises no code (class limits, GHOST_EDGE,
                     UNTINTED_SKIN, VIEW_INCONSISTENT, COLOUR_FAR); a case lists
                     the codes it must raise
  The truth is segment.drawn_layers (the legacy layers with their drawn
  cuff/collar/shorts-cuff lines handed back from the limbs and without the
  skin-coloured pale band under them), not the legacy layers as stored: the
  pipeline cuts at the drawn line, which the legacy layers had given to the
  limb. This is a deviation from the plan's 'the current layers', recorded
  in the WP6 notes.
--positives: generated truth (tools/garment/garment_synth.py): sleeves +4 px,
  puffed sleeves (x1.15 about the shoulder), hem +6 / -6 px, shorts cuffs
  flared x1.15 outward, shoes 4 px taller; composited with the frozen body
  and the other slots, through the ChatGPT path (WebP q80): per-part IoU >=
  .97, every seam median <= 1 / max <= 2 px against the generated edge,
  seat/sideSeat rows +-1.5 of the same rule on the truth. P-hem-6 must raise
  HEM_HIGH (the basic's own margin is 3 px).
--cream: the top recoloured per figure to cream #f2dfbd (the shop colour
  closest to skin, dE 8.5 from the clean arm art; the case checks its own
  cream lies within dE 12 of the skin) with sleeves 6 px longer over the arm
  skin: IoU >= .92, the seams as above, and no skin either way (garment
  pixels on the body <= .5 % of the part).
--controls: negative controls of the codes WP6 raises (WP8 adds the full D
  suite): N-belly10 (10 rows of skin at the hem) -> HEM_HIGH, N-neck20 (20
  rows of skin below the collar) -> NECK_OPEN, N-red (the top recoloured red
  against the basic's shop colour) -> COLOUR_FAR.

Writes DIR (default 검증/옷/파이프라인-검사/, not committed): 결과.json and
per case a comparison sheet (pipeline | truth | difference). Exit 1 when a
tolerance fails.
"""
import argparse
import importlib.util
import json
import os
import sys
import time

sys.dont_write_bytecode = True  # no __pycache__ in the repo
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402
import segment as SG  # noqa: E402
import seam as SM  # noqa: E402
import metadata as MD  # noqa: E402
import garment_synth as GS  # noqa: E402

ROOT = os.path.dirname(TOOLS)
_spec = importlib.util.spec_from_file_location('build_garment', os.path.join(HERE, 'build-garment.py'))
BG = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BG)

TOL = dict(reg=1.0, regIdentity=.1, scaleIdentity=5e-4, iou=.98, iouSleeve=.97, edge=.05, rgbIdentity=2.0, rgbWebp=4.0,
           rgbAdded=.5, seamMedian=1.0, seamMax=2.0, seat=1.5, rise=3.0, cuffPx=2.0, underarm=.04, dE=3.0, dEAdded=3.0,
           raised=.97,
           posIoU=.97, creamIoU=.92, skinLeak=.005,
           # 2026-10-14 (user decision: record 1-2 px boundary differences with
           # their grounds and move on to stage 4). On the ChatGPT path
           # (webp80: 1629 -> 1536 px and WebP q80) a part's outline differs by
           # scattered single pixels; on a small part (a sleeve or a shoe,
           # about 2000 visible px with a 200 px perimeter) that alone costs
           # .03-.04 IoU (P-sleeve+4: every difference a 1 px fringe), and a
           # seam's end column (a collar point, a shoe opening's corner) where
           # the drawing and the drawn layer disagree reads 2.2-3.2 px.
           # underarm .03 -> .04 u: the identity round trip reads the drawn line's
           # edge against the legacy layer's fixture, .53-.56 px apart (.032/.034 u).
           posIoUSmall=.95, seamMaxWebp=3.0, underarmWebp=.05)
PART_LAYER = {'torso': 'shirt', 'sleeve0': 'sleeves', 'sleeve1': 'sleeves', 'bottom': 'shorts', 'shoe0': 'shoes', 'shoe1': 'shoes'}
PART_OWN = {'torso': 1, 'sleeve0': 2, 'sleeve1': 2, 'bottom': 4, 'shoe0': 6, 'shoe1': 6}
LAYER_OWN = {'shirt': 1, 'sleeves': 2, 'arms': 3, 'shorts': 4, 'legs': 5, 'shoes': 6, 'neck': 7, 'head': 8}
LEGACY_CATALOG = {
    'top': {'class': 'top/short-sleeve', 'colour': '#5aa8ff', 'display': '#507c59'},
    'bottom': {'class': 'bottom/shorts', 'colour': '#556074', 'display': '#364c76'},
    'shoes': {'class': 'shoes/low', 'colour': '#ffffff', 'display': '#ffffff'},
}
SEAT = {'m-front': dict(cut=451, apex=439, cuff=465.5, rise=13), 'm-back': dict(cut=452, apex=437, cuff=465, rise=12),
        'f-front': dict(cut=964, apex=957, cuff=983, rise=16), 'f-back': dict(cut=962, apex=956, cuff=980.5, rise=16)}
SIDE_SEAT = {'m-right': dict(cut=449, cuff=465.5), 'f-right': dict(cut=970, cuff=988.5)}


BASIC_RECORD = {'top': 'sd-garment-top-tee.js', 'bottom': 'sd-garment-bottom-shorts.js', 'shoes': 'sd-garment-shoes-sneaker.js'}


def basic_catalog(slot):
    """The basic record's catalog per sex (assets/sd-garment-*.js): the shop
    colour and display colour each sex's basic garment is checked against."""
    text = open(os.path.join(ROOT, 'assets', BASIC_RECORD[slot]), encoding='utf-8').read()
    rec = json.loads(text[text.index('const record=') + 13:text.index(';\nconst freeze')])
    return rec['catalog']


def product(slot, shape, display=None):
    c = LEGACY_CATALOG[slot]
    cat = basic_catalog(slot)
    disp = {s: display or cat[s]['display'] for s in ('m', 'f')}
    p = {'class': c['class'], 'sexes': ['m', 'f'], 'ci': {'m': 0, 'f': 0}, 'names': {'m': shape, 'f': shape},
         'colour': {s: cat[s]['colour'] for s in ('m', 'f')}, 'display': disp, 'mirrorSafe': True}
    if GS.BASE:
        p['base'] = GS.BASE
    return '%s:%s' % (slot, shape), p


def composed_layers(slot, prod):
    """The layers of the composed sheet, top first: (name, RGBA)."""
    fz = SG.frozen()
    out = []
    for name in SG.Z_TOP_FIRST:
        if name == 'head':
            lay = fz.head
        elif name in prod:
            lay = prod[name]
        elif name in ('shirt', 'sleeves', 'shorts', 'shoes'):
            lay = fz.drawn[name] if name in SG.SLOT[slot]['layers'] else fz.layers[name]
        else:
            lay = fz.body('legacy')[name]
        out.append((name, lay))
    return out


def owner_of(slot, prod):
    """Topmost layer per sheet pixel of the composed sheet (alpha > 127)."""
    fz = SG.frozen()
    own = np.zeros(fz.sheet.shape[:2], np.uint8)
    for name, lay in reversed(composed_layers(slot, prod)):
        own[lay[..., 3] > 127] = LAYER_OWN[name]
    return own


def others_alpha(slot, prod):
    """Per garment layer: the largest alpha of every OTHER layer of the
    composed sheet (sheet size). A silhouette pixel another layer paints
    too (the arm beside a cuff corner, a leg beside a shorts cuff) is a
    mixed pixel of two layers: its share is a labelling question (IoU), not
    the matte's, and stays out of the edge-alpha band."""
    layers = composed_layers(slot, prod)
    out = {}
    for g in ('shirt', 'sleeves', 'shorts', 'shoes'):
        m = np.zeros(layers[0][1].shape[:2], np.float32)
        for name, lay in layers:
            if name != g:
                m = np.maximum(m, lay[..., 3] / 255.0)
        out[g] = m
    return out


def truth_alpha(truth, key, name):
    x0, y0, x1, y1 = SG.CELLS[key]
    lay = truth[PART_LAYER[name]][y0:y1, x0:x1]
    a = lay[..., 3] / 255.0
    g = SG.frozen().zones[key]
    if (name.startswith('sleeve') or name.startswith('shoe')) and g['view'] != 'right':
        xx = np.arange(x1 - x0)[None, :] + .5
        cx = g['center'] - x0
        a = a * ((xx < cx) if name.endswith('0') else (xx >= cx))
    return a, lay[..., :3]


def polyline_dist(P, Q, step=.25):
    """Distance of each point of P to the polyline Q (densified)."""
    if len(Q) < 2 or len(P) == 0:
        return np.array([np.inf])
    pts = [Q[0]]
    for a, b in zip(Q[:-1], Q[1:]):
        n = max(1, int(np.ceil(np.hypot(*(b - a)) / step)))
        t = np.linspace(0, 1, n + 1)[1:, None]
        pts.append(a + (b - a) * t)
    D = np.vstack([np.atleast_2d(p) for p in pts])
    out = []
    for p in P:
        out.append(np.sqrt(((D - p) ** 2).sum(1)).min())
    return np.array(out)


def seam_errors(b, truth):
    """Per seam: symmetric distances between the pipeline seam and the
    truth's drawn edge in the same band (sheet px)."""
    fz = SG.frozen()
    out = {}
    for key, s in b['segs'].items():
        x0, y0, x1, y1 = SG.CELLS[key]
        for band, r in zip(s['bands'], s['seams']):
            ok = ~np.isnan(r['v'])
            if ok.sum() < 2:
                continue
            a = truth[band.layer][y0:y1, x0:x1, 3] / 255.0
            tc, tv, T = SM.drawn_points(band, a)
            # The seam is the edge between the garment and the limb's own
            # painting: columns where no limb paint lies just past the
            # truth's edge (the cuff's corner over the page, or the limb's
            # outline the legacy garment layer owns there) have none.
            if band.body:
                limb = fz.layers[band.body][y0:y1, x0:x1, 3] > 127
                px, py = band.to_px(tc, tv + 1.5)
                xi = np.clip(np.floor(px).astype(int), 0, limb.shape[1] - 1)
                yi = np.clip(np.floor(py).astype(int), 0, limb.shape[0] - 1)
                keep = limb[yi, xi]
                tc, T = tc[keep], T[keep]
            if len(T) < 2:
                continue
            pk = ok & np.isin(r['cols'], tc)
            if pk.sum() < 2:
                continue
            P = SM.points(band, {'cols': r['cols'][pk], 'v': r['v'][pk]})
            d = np.concatenate([polyline_dist(T, P), polyline_dist(P, T)])
            out['%s %s' % (key, band.name)] = dict(median=round(float(np.median(d)), 2), max=round(float(d.max()), 2), n=len(T))
    return out


_RESAMPLED = {}


def resampled_alpha(layer):
    """A truth layer's alpha after the ChatGPT path's resampling alone (the
    template canvas 1629x1086 -> 1536x1024 -> back, Lanczos): what a perfect
    matte of the 1536 px upload can recover at best. Cached per layer."""
    from avatar_build.common import TEMPLATE
    k = id(layer)
    if k not in _RESAMPLED:
        a = layer[..., 3] / 255.0
        H, W = a.shape
        canvas = np.zeros((TEMPLATE['height'], TEMPLATE['width']), np.float32)
        canvas[:, TEMPLATE['left']:TEMPLATE['left'] + W] = a
        im = Image.fromarray(canvas, 'F').resize((1536, 1024), Image.LANCZOS)
        up = np.asarray(im.resize((TEMPLATE['width'], TEMPLATE['height']), Image.LANCZOS))
        _RESAMPLED[k] = (layer, np.clip(up[:, TEMPLATE['left']:TEMPLATE['left'] + W], 0, 1))
    return _RESAMPLED[k][1]


def part_metrics(b, truth, own_vis, sheet_tag, others=None, kind=None, dontcare=None):
    fz = SG.frozen()
    out = {}
    tiles = []
    for key, f in b['figs'].items():
        x0, y0, x1, y1 = SG.CELLS[key]
        O = own_vis[y0:y1, x0:x1]
        tall = {n: truth_alpha(truth, key, n)[0] > .5 for n in f['parts']}
        pall = {n: q['a'] > .5 for n, q in f['parts'].items()}
        for name, p in f['parts'].items():
            ta, trgb = truth_alpha(truth, key, name)
            pa = p['a']
            # The refill zones are the TRUTH's hidden cloth (covered by
            # another layer of the composed sheet). Cloth the pipeline itself
            # rebuilt where the truth is visible (the profile ring around the
            # arm) is compared like any visible pixel.
            # (the pipeline's own rebuilt cloth counts as hidden only where the
            # composed sheet shows another layer: under the arm or a sleeve)
            hid = ((ta > .5) | f['hidden'][name]) & (O != PART_OWN[name])
            amb = np.zeros(ta.shape, bool)
            if dontcare is not None and PART_LAYER[name] in dontcare:
                # truth pixels the generated garment carries over from the
                # basic sleeve's margin of torso cloth (sleeve_margin): a new
                # sleeve's own outline ends before them, and the pipeline cuts
                # there; neither side is judged on them
                amb = dontcare[PART_LAYER[name]][y0:y1, x0:x1] & ~(pa > .5)
            A1 = (ta > .5) & ~hid & ~amb
            A2 = (pa > .5) & ~hid & ~amb
            iou = float((A1 & A2).sum() / max(1, (A1 | A2).sum()))
            sil = ta > .5
            edge_band = M.dilate(sil & ~M.erode(sil, 1), 2)
            # the open page: background at least 3 px wide (a 1-2 px slit
            # between the torso side and the hanging arm is paint of both)
            near_bg = M.dilate(M.erode(O == 0, 1), 3) & ~M.dilate(O == 8, 3)
            band = edge_band & near_bg & ~hid
            if others is not None:
                band &= others[PART_LAYER[name]][y0:y1, x0:x1] < .05
            mae = float(np.abs(ta - pa)[band].mean()) if band.any() else 0.0
            # the input's own edge error (webp: the resampling blur alone)
            efloor = 0.0
            if kind not in (None, 'identity') and band.any():
                ra = resampled_alpha(truth[PART_LAYER[name]])[y0:y1, x0:x1]
                if (name.startswith('sleeve') or name.startswith('shoe')) and fz.zones[key]['view'] != 'right':
                    xx = np.arange(x1 - x0)[None, :] + .5
                    cx = fz.zones[key]['center'] - x0
                    ra = ra * ((xx < cx) if name.endswith('0') else (xx >= cx))
                efloor = float(np.abs(ta - ra)[band].mean())
            sh = (ta >= .98) & (pa >= .98) & ~hid
            drgb = float(np.abs(trgb - p['rgb'])[sh].mean()) if sh.any() else 0.0
            # the input's own error on the same pixels (the registered upload
            # against the truth): WebP q80 and the 1536 px resize alone give
            # 2.3-3.6/255 on flat cloth and up to 7.6/255 on line-rich parts
            Ureg = b['ctx'].U[y0:y1, x0:x1]
            floor = float(np.abs(trgb - Ureg)[sh].mean()) if sh.any() else 0.0
            out['%s %s' % (key, name)] = dict(iou=round(iou, 4), edgeMAE=round(mae, 4), edgeInput=round(efloor, 4),
                                              dRGB=round(drgb, 2), dRGBInput=round(floor, 2), sharedPx=int(sh.sum()),
                                              ambiguousPx=int(amb.sum()),
                                              edgeN=int(band.sum()), hiddenPx=int(f['hidden'][name].sum()),
                                              rebuiltVisiblePx=int((f['hidden'][name] & ~hid & (ta > .5)).sum()))
            ys, xs = np.nonzero((pa > 0) | (ta > 0))
            if len(ys):
                tiles.append((key + ' ' + name, iou, pa, p['rgb'], ta, trgb, A1, A2, hid, (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1)))
    for key, f in b['figs'].items():
        x0, y0, x1, y1 = SG.CELLS[key]
        O = own_vis[y0:y1, x0:x1]
        tu = np.zeros((y1 - y0, x1 - x0), bool)
        pu = np.zeros_like(tu)
        for name, p in f['parts'].items():
            tu |= truth_alpha(truth, key, name)[0] > .5
            pu |= p['a'] > .5
        vis = np.isin(O, [PART_OWN[n] for n in f['parts']])
        # what the composed sheet shows of the garment, or the page the
        # pipeline would paint over; cloth under another layer is the refill
        A1, A2 = tu & vis, pu & (vis | (O == 0))
        out['%s union' % key] = dict(iou=round(float((A1 & A2).sum() / max(1, (A1 | A2).sum())), 4))
    return out, tiles


def sheet_image(tiles, path, title):
    rows = []
    for label, iou, pa, prgb, ta, trgb, A1, A2, hid, (y0, y1, x0, x1) in tiles:
        h, w = y1 - y0, x1 - x0
        chk = np.where(((np.indices((h, w)).sum(0) // 4) % 2)[..., None] == 0, 236, 206).astype(np.float32)
        P = prgb[y0:y1, x0:x1] * pa[y0:y1, x0:x1, None] + chk * (1 - pa[y0:y1, x0:x1, None])
        T = trgb[y0:y1, x0:x1] * ta[y0:y1, x0:x1, None] + chk * (1 - ta[y0:y1, x0:x1, None])
        D = np.full((h, w, 3), 255.0)
        a1, a2, hd = A1[y0:y1, x0:x1], A2[y0:y1, x0:x1], hid[y0:y1, x0:x1]
        D[a1 & a2] = [205, 205, 205]; D[a1 & ~a2] = [230, 40, 40]; D[a2 & ~a1] = [40, 80, 230]
        D[hd] = D[hd] * .5 + np.array([0, 200, 0]) * .5
        row = np.concatenate([P, np.full((h, 3, 3), 255.0), T, np.full((h, 3, 3), 255.0), D], 1)
        im = Image.fromarray(np.clip(row, 0, 255).astype(np.uint8)).resize((row.shape[1] * 2, h * 2), Image.NEAREST)
        ImageDraw.Draw(im).text((2, 2), '%s IoU %.3f' % (label, iou), fill=(0, 0, 0))
        rows.append(im)
    if not rows:
        return None
    cols = 3
    Wc = max(r.width for r in rows); Hc = max(r.height for r in rows)
    n = (len(rows) + cols - 1) // cols
    img = Image.new('RGB', (cols * (Wc + 8), n * (Hc + 8) + 24), (255, 255, 255))
    ImageDraw.Draw(img).text((6, 4), title + '  (pipeline | truth | red: truth only, blue: pipeline only, green: hidden)', fill=(0, 0, 0))
    for i, r in enumerate(rows):
        img.paste(r, ((i % cols) * (Wc + 8), (i // cols) * (Hc + 8) + 24))
    img.save(path)
    return path


# ---------------------------------------------------------------------------
# Metadata against the runtime
# ---------------------------------------------------------------------------
def hex_lab(h):
    return BG.hex_lab(h)


def tone_lab(t):
    v = [int(x) for x in t[t.index('(') + 1:t.rindex(')')].split(',')[:3]]
    return R.lab(np.array([v], np.float32))[0]


def input_crop(U, layer, rect, side=None, center=None):
    """uint8 RGBA crop of a truth layer's alpha with the registered INPUT's
    colours (sheet rect [x, y, w, h]): the geometry the record should have,
    coloured only by what the sheet shows (the floor of a colour reading)."""
    x, y, w, h = rect
    a = layer[y:y + h, x:x + w, 3].astype(np.float32)
    if side is not None:
        xx = np.arange(w)[None, :] + x + .5
        a = a * ((xx < center) if side == 0 else (xx >= center))
    rgb = U[y:y + h, x:x + w]
    out = np.concatenate([np.clip(np.rint(rgb), 0, 255), np.clip(np.rint(a), 0, 255)[..., None]], -1).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    return out


def bbox_rect(layer, key):
    x0, y0, x1, y1 = SG.CELLS[key]
    ys, xs = np.nonzero(layer[y0:y1, x0:x1, 3] > 0)
    return [int(xs.min() + x0), int(ys.min() + y0), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]


def colour_tol(floor):
    """A colour reading may differ from today's value by dE 3 (plan), or by
    the input's own difference at the same reading plus 3 when that is larger
    (WebP chroma, and the straight colour of a partly transparent legacy
    pixel, which a composite on white cannot show)."""
    return max(TOL['dE'], floor + TOL['dEAdded'])


def metadata_checks(b, truth=None, kind=None):
    """The figures' metadata (b['meta'], what the record carries) against
    today's runtime (fixtures, SEAT/SIDE_SEAT, cuff_top).

    Underarm: the side edge x within +-.03 u on the rows both edges share
    above the lower hem minus the seam tolerance; the hem row itself is a
    seam (the torso's hem against the shorts) and is held to the seam
    tolerance (2 px). Colour readings (underarm cloth/line, edgeTone) are held
    to colour_tol of their input floor: the same runtime rule run on the
    truth geometry with the registered input's colours."""
    fz = SG.frozen()
    fx = fz.fixture
    U = b['ctx'].U
    out, fails = {}, []
    for key, m in b['meta'].items():
        sex, view = key.split('-')
        F = fz.data[key]
        if b['slot'] == 'top' and 'sleeves' in m:
            T = dict(sleeves=[dict(s, rect=b['crops'][(key, 'sleeve%d' % i)][1]) for i, s in enumerate(m['sleeves'])],
                     underarm=m.get('underarm'))
            for i, sl in enumerate(T['sleeves']):
                want = (F['cuff_top'] - F['joints']['shoulder'][i][1]) * F['k']
                dpx = abs(sl['cuff'] - want) / F['k']
                out['%s cuff%d px' % (key, i)] = round(dpx, 2)
                if dpx > TOL['cuffPx']:
                    fails.append('%s sleeve%d cuff %.2f px from cuff_top' % (key, i, dpx))
            if view == 'right':
                continue
            ft = fx['sexes'][sex]['top'][view]
            floor_ua = resampled_ua = None
            if truth is not None:
                fr = fx['sexes'][sex]['frames']['views'][view]
                C = fx['sexes'][sex]['frames']['collar']
                trect = bbox_rect(truth['shirt'], key)
                tt = dict(rect=trect, rgba=input_crop(U, truth['shirt'], trect))
                tsl, traised = [], []
                for i in range(2):
                    r = ft['raised'][i]
                    tsl.append(dict(rect=r['rect'], rgba=input_crop(U, truth['sleeves'], r['rect'], i, fz.zones[key]['center'])))
                    traised.append(MD_bits(r) & (tsl[-1]['rgba'][..., 3] >= 128))
                floor_ua = MD.underarm(tt, tsl, traised, F, C, dict(shoulder=fr['shoulder'], elbow=fr['elbow']),
                                       [s['cuff'] for s in T['sleeves']])
                if kind == 'webp80':
                    # the geometry floor of the ChatGPT path: the same rule on
                    # the truth's alpha after the resampling alone (as the
                    # edge-alpha band's edgeInput); a perfect matte of the
                    # 1536 px upload reads this side edge at best
                    def rs_crop(layer, rect, side=None, center=None):
                        q = input_crop(U, layer, rect, side, center)
                        x, y, w, h = rect
                        ra = resampled_alpha(layer)[y:y + h, x:x + w]
                        if side is not None:
                            xx = np.arange(w)[None, :] + x + .5
                            ra = ra * ((xx < center) if side == 0 else (xx >= center))
                        q[..., 3] = np.clip(np.rint(ra * 255), 0, 255).astype(np.uint8)
                        q[q[..., 3] == 0] = 0
                        return q
                    rs_t = dict(rect=trect, rgba=rs_crop(truth['shirt'], trect))
                    rs_sl = [dict(rect=ft['raised'][i]['rect'], rgba=rs_crop(truth['sleeves'], ft['raised'][i]['rect'], i, fz.zones[key]['center']))
                             for i in range(2)]
                    rs_raised = [MD_bits(ft['raised'][i]) & (rs_sl[i]['rgba'][..., 3] >= 128) for i in range(2)]
                    resampled_ua = MD.underarm(rs_t, rs_sl, rs_raised, F, C, dict(shoulder=fr['shoulder'], elbow=fr['elbow']),
                                               [s['cuff'] for s in T['sleeves']])
            for i, (a, w) in enumerate(zip(T['underarm'], ft['underarm'])):
                ya = np.array([p[1] for p in a['edge']]); xa = np.array([p[0] for p in a['edge']])
                yw = np.array([p[1] for p in w['edge']]); xw = np.array([p[0] for p in w['edge']])
                lo = max(ya.min(), yw.min())
                hi = min(ya.max(), yw.max()) - TOL['seamMax'] * F['k']
                ys = np.linspace(lo, hi, 60)
                # The edge's displacement is measured across the edge (symmetric
                # point-to-polyline distance, as the seams), not along x per
                # row: where the side turns into the hem corner the edge runs
                # nearly level and a sub-pixel matte difference moved x by
                # 2-3 px (m-front / f-back webp80, edge .08-.12 u).
                def clipped(yv, xv):
                    # the polyline cut to [lo, hi], its ends interpolated on
                    # those rows (both edges then start and end level)
                    k_ = (yv > lo) & (yv < hi)
                    ye = np.concatenate([[lo], yv[k_], [hi]])
                    return np.stack([np.interp(ye, yv, xv), ye], 1)

                def across(yv, xv):
                    P_, Q_ = clipped(yv, xv), clipped(yw, xw)
                    if len(P_) < 2 or len(Q_) < 2:
                        return float(np.abs(np.interp(ys, yv, xv) - np.interp(ys, yw, xw)).max())
                    return float(np.concatenate([polyline_dist(P_, Q_), polyline_dist(Q_, P_)]).max())
                de = across(ya, xa)
                fe = 0.0
                if floor_ua is not None:
                    yf = np.array([p[1] for p in floor_ua[i]['edge']]); xf = np.array([p[0] for p in floor_ua[i]['edge']])
                    fe = across(yf, xf)
                fr_e, fr_hem = 0.0, 0.0
                if resampled_ua is not None:
                    yr = np.array([p[1] for p in resampled_ua[i]['edge']]); xr = np.array([p[0] for p in resampled_ua[i]['edge']])
                    fr_e = across(yr, xr)
                    fr_hem = abs(resampled_ua[i]['hem'] - w['hem']) / F['k']
                dhem = abs(a['hem'] - w['hem']) / F['k']
                dc = float(np.linalg.norm(hex_lab(a['cloth']) - hex_lab(w['cloth'])))
                dl = float(np.linalg.norm(hex_lab(a['line']) - hex_lab(w['line'])))
                fc = fl = 0.0
                if floor_ua is not None:
                    fc = float(np.linalg.norm(hex_lab(floor_ua[i]['cloth']) - hex_lab(w['cloth'])))
                    fl = float(np.linalg.norm(hex_lab(floor_ua[i]['line']) - hex_lab(w['line'])))
                out['%s underarm%d' % (key, i)] = dict(edge=round(de, 4), edgeFloor=round(fe, 4), hemPx=round(dhem, 2), cloth=round(dc, 2), line=round(dl, 2),
                                                       clothFloor=round(fc, 2), lineFloor=round(fl, 2),
                                                       inset=round(a['inset'] - w['inset'], 4), cuff=round(a['cuff'] - w['cuff'], 4))
                out['%s underarm%d' % (key, i)].update(edgeResampled=round(fr_e, 4), hemResampled=round(fr_hem, 2))
                if de > (TOL['underarm'] if kind == 'identity' else TOL['underarmWebp']) + fr_e:
                    fails.append('%s underarm%d edge %.3f u (resampled truth %.3f)' % (key, i, de, fr_e))
                if dhem > (TOL['seamMax'] if kind == 'identity' else TOL['seamMaxWebp']) + fr_hem:
                    fails.append('%s underarm%d hem %.1f px' % (key, i, dhem))
                if dc > colour_tol(fc) or dl > colour_tol(fl):
                    fails.append('%s underarm%d cloth dE %.1f (floor %.1f) line dE %.1f (floor %.1f)' % (key, i, dc, fc, dl, fl))
            for i, sl in enumerate(T['sleeves']):
                r = ft['raised'][i]
                # the runtime's raised drawing of the legacy sleeve, on the
                # drawn sleeve (the legacy layer kept a skin-coloured band
                # below its cuff line that the drawn garment gives the arm)
                x, y, w, h = r['rect']
                legacy_op = fz.layers['sleeves'][y:y + h, x:x + w, 3] > 128
                drawn_op = fz.drawn['sleeves'][y:y + h, x:x + w, 3] >= 128
                bits = drawn_op & (MD_bits(r) | ~legacy_op)  # the drawn sleeve without what the runtime clears
                mine = m['sleeves'][i]['raised'][..., 3] >= 128
                iou = overlap(bits, r['rect'], mine, sl['rect'])
                out['%s raised%d IoU' % (key, i)] = round(iou, 4)
                if iou < TOL['raised']:
                    fails.append('%s raised%d IoU %.3f' % (key, i, iou))
        elif b['slot'] == 'bottom' and ('seat' in m or 'sideSeat' in m):
            B = m
            fb = fx['sexes'][sex]['bottom'][view]
            de = float(np.linalg.norm(tone_lab(B['edgeTone']) - tone_lab(fb['edgeTone'])))
            # floor: the input's own colour at the pixel today's runtime reads
            r = F['rects']['shorts']
            yy = r[1] + int(np.floor(r[3] * .4))
            row = fz.layers['shorts'][yy, r[0]:r[0] + r[2], 3]
            hit = np.nonzero(row > 220)[0]
            floor = float(np.linalg.norm(R.lab(U[yy, r[0] + int(hit[0])][None])[0] - tone_lab(fb['edgeTone']))) if len(hit) else 0.0
            out['%s edgeTone' % key] = dict(dE=round(de, 2), floor=round(floor, 2))
            if de > colour_tol(floor):
                fails.append('%s edgeTone dE %.1f (floor %.1f)' % (key, de, floor))
            if 'seat' in B:
                w = SEAT[key]
                d = {k: round(B['seat'][k] - w[k], 2) for k in ('cut', 'apex', 'cuff', 'rise')}
                out['%s seat' % key] = dict(got={k: B['seat'][k] for k in ('cut', 'apex', 'cuff', 'rise')}, delta=d)
                for k in ('cut', 'apex', 'cuff'):
                    if abs(d[k]) > TOL['seat']:
                        fails.append('%s seat.%s %+.1f (legacy SEAT %s)' % (key, k, d[k], w[k]))
                if abs(d['rise']) > TOL['rise']:
                    fails.append('%s seat.rise %+.1f' % (key, d['rise']))
            else:
                w = SIDE_SEAT[key]
                d = {k: round(B['sideSeat'][k] - w[k], 2) for k in ('cut', 'cuff')}
                sp = fb['sideSeat']['span']
                d['span'] = round(max(abs(B['sideSeat']['span'][0] - sp[0]), abs(B['sideSeat']['span'][1] - sp[1])), 3)
                out['%s sideSeat' % key] = d
                for k in ('cut', 'cuff'):
                    if abs(d[k]) > TOL['seat']:
                        fails.append('%s sideSeat.%s %+.1f' % (key, k, d[k]))
    return out, fails


def MD_bits(r):
    import base64
    w, h = r['width'], r['height']
    return np.unpackbits(np.frombuffer(base64.b64decode(r['alpha']), np.uint8))[:w * h].reshape(h, w).astype(bool)


def overlap(a, ra, b, rb):
    """IoU of two masks given with their sheet rects."""
    x0, y0 = min(ra[0], rb[0]), min(ra[1], rb[1])
    x1 = max(ra[0] + a.shape[1], rb[0] + b.shape[1]); y1 = max(ra[1] + a.shape[0], rb[1] + b.shape[0])
    A = np.zeros((y1 - y0, x1 - x0), bool); B = np.zeros_like(A)
    A[ra[1] - y0:ra[1] - y0 + a.shape[0], ra[0] - x0:ra[0] - x0 + a.shape[1]] = a
    B[rb[1] - y0:rb[1] - y0 + b.shape[0], rb[0] - x0:rb[0] - x0 + b.shape[1]] = b
    return float((A & B).sum() / max(1, (A | B).sum()))


def truth_rows(truth, slot):
    """Seat rows (bottom) of the truth by the same rule as the record."""
    fz = SG.frozen()
    out = {}
    if slot != 'bottom':
        return out
    for key in SG.CELLS:
        x0, y0, x1, y1 = SG.CELLS[key]
        lay = truth['shorts']
        a = lay[..., 3] > 0
        ys, xs = np.nonzero(a[y0:y1, x0:x1])
        rect = [int(xs.min() + x0), int(ys.min() + y0), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
        crop = np.clip(np.rint(lay[rect[1]:rect[1] + rect[3], rect[0]:rect[0] + rect[2]]), 0, 255).astype(np.uint8)
        out[key] = MD.bottom_figure(fz, key, crop, rect)
    return out


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------
def run_case(name, sheet, slot, truth, own_vis, kind, out_dir, prod_override, product_id, rgb_tol=None, positive=False,
             cream=False, expect=(), others=None, res_in=None, keys=None, control=False, dontcare=None):
    t0 = time.time()
    b = BG.build(sheet, product_id, prod_override=prod_override, kind='synthetic', log=lambda *a: None, res=res_in, keys=keys)
    secs = time.time() - t0
    res = dict(name=name, slot=slot, kind=kind, seconds=round(secs, 1), built=bool(b.get('built')), fails=[])
    if not b.get('built') and not b.get('partial'):
        res['fails'].append('not built: %s' % (b.get('errors') or 'registration'))
        return res
    regmax = max(float(fr.get('maxPx', 0)) for fr in b['res']['figures'].values())
    res['registrationMaxPx'] = round(regmax, 3)
    reg_tol = TOL['regIdentity'] if kind == 'identity' else TOL['reg']
    if regmax > reg_tol:
        res['fails'].append('registration %.3f px > %.2f' % (regmax, reg_tol))
    if kind == 'identity':
        smax = max(abs(float(fr['s']) / float(b['res']['global']['nominal']['s']) - 1) for fr in b['res']['figures'].values())
        res['registrationScaleMax'] = round(smax, 6)
        if smax > TOL['scaleIdentity']:
            res['fails'].append('registration scale %.5f > %.4f' % (smax, TOL['scaleIdentity']))
    if control:
        # a negative control: only its expected codes matter (they must be
        # raised); the geometry of a broken garment is not compared
        res['codes'] = sorted({c['code'] for c in b.get('codes', [])})
        res['codeDetail'] = [dict((k, v) for k, v in c.items() if k in ('code', 'figure', 'figures', 'part', 'value', 'stage'))
                             for c in b.get('codes', [])]
        for code in expect:
            if code not in res['codes']:
                res['fails'].append('expected code %s not raised' % code)
        res['warnings'] = sorted({w['code'] for w in b.get('warnings', [])})
        res['colour'] = {k: v for k, v in (b.get('colour') or {}).items() if k.startswith('colour-')}
        res['timing'] = b['timing']
        res['build'] = b
        return res
    if others is None:
        others = others_alpha(slot, {n: truth[n] for n in SG.SLOT[slot]['layers']})
    parts, tiles = part_metrics(b, truth, own_vis, name, others, kind, dontcare)
    res['parts'] = parts
    # the plan's colour figure: mean |dRGB| over the slot's shared opaque
    # pixels (all parts pooled), next to the per-part means
    shp = [(v['dRGB'], v['dRGBInput'], v['sharedPx']) for k, v in parts.items() if not k.endswith(' union')]
    npx = sum(n for _, _, n in shp)
    if npx:
        res['dRGBPooled'] = round(sum(d * n for d, _, n in shp) / npx, 2)
        res['dRGBInputPooled'] = round(sum(f * n for _, f, n in shp) / npx, 2)
    for k, v in parts.items():
        if k.endswith(' union'):
            need = TOL['creamIoU'] if cream else (TOL['posIoU'] if positive else TOL['iou'])
        else:
            small = 'sleeve' in k or 'shoe' in k
            need = TOL['creamIoU'] if cream else ((TOL['posIoUSmall'] if small else TOL['posIoU']) if positive else (TOL['iouSleeve'] if 'sleeve' in k else TOL['iou']))
        if v['iou'] < need:
            res['fails'].append('%s IoU %.3f < %.2f' % (k, v['iou'], need))
        if not positive and not cream and not k.endswith(' union'):
            # the pipeline's own edge error (.05) on top of the input's
            # (webp: what the resampling alone moves, edgeInput)
            if v['edgeMAE'] > TOL['edge'] + v['edgeInput']:
                res['fails'].append('%s edge alpha MAE %.3f (input %.3f)' % (k, v['edgeMAE'], v['edgeInput']))
            # the pipeline adds at most rgbAdded/255 to its input's own error
            if rgb_tol is not None and v['dRGB'] > max(rgb_tol, v['dRGBInput'] + TOL['rgbAdded']):
                res['fails'].append('%s dRGB %.2f (input %.2f)' % (k, v['dRGB'], v['dRGBInput']))
    if rgb_tol is not None and not positive and not cream and 'dRGBPooled' in res:
        if res['dRGBPooled'] > max(rgb_tol, res['dRGBInputPooled'] + TOL['rgbAdded']):
            res['fails'].append('pooled dRGB %.2f (input %.2f)' % (res['dRGBPooled'], res['dRGBInputPooled']))
    seams = seam_errors(b, truth)
    res['seams'] = seams
    for k, v in seams.items():
        if v['median'] > TOL['seamMedian'] or v['max'] > (TOL['seamMax'] if kind == 'identity' else TOL['seamMaxWebp']):
            res['fails'].append('seam %s median %.2f max %.2f' % (k, v['median'], v['max']))
    if not positive and not cream:
        md, mfails = metadata_checks(b, truth, kind)
        res['metadata'] = md
        res['fails'] += mfails
    if positive and slot == 'bottom':
        tr = truth_rows(truth, slot)
        rows = {}
        for key, m in b['meta'].items():
            want = tr[key]
            got = m.get('seat') or m.get('sideSeat')
            w = want.get('seat') or want.get('sideSeat')
            d = {k: round(got[k] - w[k], 2) for k in ('cut', 'cuff', 'apex') if k in got and got[k] is not None and w.get(k) is not None}
            rows[key] = d
            for k, v in d.items():
                if abs(v) > TOL['seat']:
                    res['fails'].append('%s %s %+.1f vs generated truth' % (key, k, v))
        res['seatRows'] = rows
    if cream:
        # the synthetic itself must be the case it stands for: cream cloth
        # within dE 12 of the body's skin (#f2dfbd is 8.5 from the clean art)
        sk = R.lab(GS.skin_rgb(base=None)[None].astype(np.float32))[0]  # near the LIGHT skin (what a dark base is for)
        near = {}
        for key in b['figs']:
            mc = GS.main_colour(truth['shirt'], key)
            if mc is not None:
                near[key] = round(float(np.linalg.norm(R.lab(mc[None].astype(np.float32))[0] - sk)), 2)
                if near[key] > 12:
                    res['fails'].append('%s cream synthetic is dE %.1f from skin (> 12): not a cream-next-to-skin case' % (key, near[key]))
        res['creamSkinDE'] = near
        leak = {}
        for key, f in b['figs'].items():
            x0, y0, x1, y1 = SG.CELLS[key]
            O = own_vis[y0:y1, x0:x1]
            skin = np.isin(O, (3, 5, 7))
            for pn, p in f['parts'].items():
                pa = p['a'] > .5
                n = int((pa & skin & ~f['hidden'][pn]).sum())
                frac = n / max(1, int(pa.sum()))
                leak['%s %s' % (key, pn)] = dict(px=n, frac=round(frac, 4))
                if frac > TOL['skinLeak']:
                    res['fails'].append('%s %s: %d garment px on skin (%.2f %%)' % (key, pn, n, 100 * frac))
        res['skinLeak'] = leak
    # Codes: every input here is a known-good garment (the basic outfit, a
    # generated positive), so a code the case does not expect fails the case
    # and an expected one must be raised.
    res['codes'] = sorted({c['code'] for c in b.get('codes', [])})
    res['codeDetail'] = [dict((k, v) for k, v in c.items() if k in ('code', 'figure', 'figures', 'part', 'value', 'stage'))
                         for c in b.get('codes', [])]
    for code in res['codes']:
        if code not in expect:
            res['fails'].append('unexpected code %s: %s' % (code, '; '.join(
                '%s %s %s' % (c.get('figure') or ','.join(c.get('figures') or []), c.get('part') or '', c.get('value'))
                for c in b.get('codes', []) if c['code'] == code)))
    for code in expect:
        if code not in res['codes']:
            res['fails'].append('expected code %s not raised' % code)
    res['warnings'] = sorted({w['code'] for w in b.get('warnings', [])})
    res['colour'] = {k: v for k, v in (b.get('colour') or {}).items() if k.startswith('colour-')}
    res['image'] = sheet_image(tiles, os.path.join(out_dir, '%s.png' % name), name)
    res['timing'] = b['timing']
    res['build'] = b
    return res


def roundtrip_cases(work):
    fz = SG.frozen()
    truth = {n: fz.drawn[n] for n in ('shirt', 'sleeves', 'shorts', 'shoes')}
    tpl = R.TEMPLATE_PATHS[GS.BASE]
    webp = os.path.join(work, 'identity-1536-q80%s.webp' % ('-' + GS.BASE if GS.BASE else ''))
    if not os.path.exists(webp):
        Image.open(tpl).convert('RGB').resize((1536, 1024), Image.LANCZOS).save(webp, 'WEBP', quality=80, method=6)
    cases = []
    for slot in ('top', 'bottom', 'shoes'):
        own = owner_of(slot, {})
        pid, prod = product(slot, 'basic')
        cases.append(dict(name='R1-%s-identity' % slot, sheet=tpl, slot=slot, truth=truth, own=own, kind='identity',
                          prod=prod, pid=pid, rgb=TOL['rgbIdentity']))
        cases.append(dict(name='R1-%s-webp80' % slot, sheet=webp, slot=slot, truth=truth, own=own, kind='webp80',
                          prod=prod, pid=pid, rgb=TOL['rgbWebp']))
    return cases


# Codes a generated positive must raise (it is a valid drawing, but the class
# rule it measures says no): a top 6 px shorter than the basic leaves less than
# the seated-breathing overlap above the waist cover line (the basic's HEM_HIGH
# margin is 3 px).
EXPECT = {'P-hem-6': ('HEM_HIGH',)}


MARGIN_WARP = {'P-sleeve+4': (GS.stretch_sleeves, 4), 'P-puff1.15': (GS.puff_sleeves, 1.15)}


def sleeve_margin(fz):
    """The basic sleeve's margin of torso cloth: drawn sleeve pixels within
    8 px of its silhouette whose colour is the drawn shirt's under them
    (|dRGB| < 12, summed). The legacy sleeve carried this strip of torso
    cloth around its own outline; a generated positive warps it with the
    sleeve, but a new sleeve's own outline ends before it. As an RGBA layer
    (alpha 255 on the margin), so the positives' warps move it too."""
    sl, sh = fz.drawn['sleeves'], fz.drawn['shirt']
    out = np.zeros(sl.shape, np.uint8)
    for key in SG.CELLS:
        x0, y0, x1, y1 = SG.CELLS[key]
        a = sl[y0:y1, x0:x1, 3] > 127
        same = a & (sh[y0:y1, x0:x1, 3] > 127) & (np.abs(sl[y0:y1, x0:x1, :3].astype(np.int32) - sh[y0:y1, x0:x1, :3].astype(np.int32)).sum(-1) < 12)
        out[y0:y1, x0:x1, 3] = np.where(same & ~M.erode(a, 8), 255, 0)
    return out


def positive_cases(work):
    fz = SG.frozen()
    D = fz.drawn
    edits = [
        ('P-sleeve+4', 'top', {'sleeves': GS.every_figure(GS.stretch_sleeves, D['sleeves'], 4)}),
        ('P-puff1.15', 'top', {'sleeves': GS.every_figure(GS.puff_sleeves, D['sleeves'], 1.15)}),
        ('P-hem+6', 'top', {'shirt': GS.every_figure(GS.hem_shift, D['shirt'], 6)}),
        ('P-hem-6', 'top', {'shirt': GS.every_figure(GS.hem_shift, D['shirt'], -6)}),  # shorts extended below, see cases
        ('P-cuff1.15', 'bottom', {'shorts': GS.every_figure(GS.widen_cuffs, D['shorts'], 1.15)}),
        ('P-shoe+4', 'shoes', {'shoes': GS.every_figure(GS.taller_shoes, D['shoes'], 4)}),
    ]
    cases = []
    for name, slot, prod in edits:
        if name == 'P-hem-6':
            # the uncovered waist shows the bottom, extended up as the runtime
            # extends every bottom (a white gap would be paint, not a body)
            prod = dict(prod, shorts=GS.extend_under(fz.layers['shorts'], D['shirt'], prod['shirt']))
        truth = {n: prod.get(n, D[n]) for n in ('shirt', 'sleeves', 'shorts', 'shoes')}
        E = GS.compose(slot, prod)
        path = GS.render(E, os.path.join(work, name + '.webp'), 'webp80')
        pid, p = product(slot, 'synth')
        dc = None
        if name in MARGIN_WARP:
            fn, arg = MARGIN_WARP[name]
            dc = {'sleeves': GS.every_figure(fn, sleeve_margin(fz), arg)[..., 3] > 127}
        cases.append(dict(name=name, sheet=path, slot=slot, truth=truth, own=owner_of(slot, prod), kind='webp80',
                          prod=p, pid=pid, positive=True, expect=EXPECT.get(name, ()), dontcare=dc))
    return cases


def cream_case(work):
    fz = SG.frozen()
    D = fz.drawn
    sl = GS.every_figure(GS.stretch_sleeves, D['sleeves'], 6)
    everywhere = np.ones(D['shirt'].shape[:2], bool)
    prod = {'shirt': GS.cream(D['shirt'], everywhere), 'sleeves': GS.cream(sl, everywhere)}
    truth = {n: prod.get(n, D[n]) for n in ('shirt', 'sleeves', 'shorts', 'shoes')}
    E = GS.compose('top', prod)
    path = GS.render(E, os.path.join(work, 'C-cream.webp'), 'webp80')
    pid, p = product('top', 'cream', '#f2dfbd')
    dc = {'sleeves': GS.every_figure(GS.stretch_sleeves, sleeve_margin(fz), 6)[..., 3] > 127}
    return [dict(name='C-cream', sheet=path, slot='top', truth=truth, own=owner_of('top', prod), kind='webp80', prod=p,
                 pid=pid, cream=True, dontcare=dc)]


def control_cases(work):
    """Negative controls of the class codes WP6 raises (WP8 adds the full D
    suite): each must raise its code through the ChatGPT path."""
    fz = SG.frozen()
    D = fz.drawn
    cases = []
    belly = GS.every_figure(GS.skin_band, D['shirt'], 10, 'hem')
    neck = GS.front_back(GS.skin_band, D['shirt'], 20, 'collar')
    everywhere = np.ones(D['shirt'].shape[:2], bool)
    red = {'shirt': GS.cream(D['shirt'], everywhere, (200, 40, 40)), 'sleeves': GS.cream(D['sleeves'], everywhere, (200, 40, 40))}
    for name, prod, expect in (('N-belly10', {'shirt': belly}, ('HEM_HIGH',)),
                               ('N-neck20', {'shirt': neck}, ('NECK_OPEN',)),
                               ('N-red', red, ('COLOUR_FAR',))):
        truth = {n: prod.get(n, D[n]) for n in ('shirt', 'sleeves', 'shorts', 'shoes')}
        path = GS.render(GS.compose('top', prod), os.path.join(work, name + '.webp'), 'webp80')
        pid, p = product('top', 'control')
        cases.append(dict(name=name, sheet=path, slot='top', truth=truth, own=owner_of('top', prod), kind='webp80', prod=p,
                          pid=pid, control=True, expect=expect))
    return cases


def _hex(rgb):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in rgb)


def wp8_cases(work):
    """The rest of the plan's synthetic suite (WP8, verification C and D) at
    the garment level: positives that must build (product hues, a navy top
    beside navy shorts, a hair-brown top, sleeves 8 px shorter, a skin band
    at the cuff that must be stripped, recoloured shorts and shoes) and the
    class-rule negatives that must fail with their code."""
    import colorsys
    fz = SG.frozen()
    D = fz.drawn
    everywhere = np.ones(D['shirt'].shape[:2], bool)
    cases = []

    margin = sleeve_margin(fz)

    def add(name, slot, prod, display=None, positive=False, expect=(), control=False, truth=None, cream=False, warp=None):
        tr = {n: (truth or prod).get(n, D[n]) for n in ('shirt', 'sleeves', 'shorts', 'shoes')}
        path = GS.render(GS.compose(slot, prod), os.path.join(work, name + '.webp'), 'webp80')
        pid, p = product(slot, 'synth' if positive or cream else 'control', display)
        # a top positive: the basic sleeve's margin of torso cloth (moved by
        # the case's own sleeve warp) is not judged, as for P-sleeve+4
        dc = None
        if slot == 'top' and positive:
            m = GS.every_figure(warp[0], margin, warp[1]) if warp else margin
            dc = {'sleeves': m[..., 3] > 127}
        cases.append(dict(name=name, sheet=path, slot=slot, truth=tr, own=owner_of(slot, prod), kind='webp80', prod=p,
                          pid=pid, positive=positive, cream=cream, expect=expect, control=control, dontcare=dc))

    def top_in(rgb):
        return {'shirt': GS.cream(D['shirt'], everywhere, rgb), 'sleeves': GS.cream(D['sleeves'], everywhere, rgb)}

    # C: product hues 60..300 and +-20 lightness, a navy and a hair-brown top
    for h in (60, 120, 180, 240, 300):
        rgb = [255 * c for c in colorsys.hsv_to_rgb(h / 360, .55, .78)]
        add('P-hue%d' % h, 'top', top_in(rgb), _hex(rgb), positive=True)
    for dl, name in ((.2, 'P-light+20'), (-.2, 'P-light-20')):
        rgb = [255 * c for c in colorsys.hsv_to_rgb(240 / 360, .55, .78 + dl * .78)]
        add(name, 'top', top_in(rgb), _hex(rgb), positive=True)
    navy = (40, 52, 95)
    add('P-navy-top', 'top', top_in(navy), _hex(navy), positive=True)   # beside the boy's navy shorts
    brown = (105, 66, 38)
    add('P-hair-brown-top', 'top', top_in(brown), _hex(brown), positive=True)
    # sleeves 8 px shorter (the class rule may refuse; see EXPECT)
    add('P-sleeve-8', 'top', {'sleeves': GS.every_figure(GS.stretch_sleeves, D['sleeves'], -8)}, positive=True,
        expect=EXPECT.get('P-sleeve-8', ()), warp=(GS.stretch_sleeves, -8))
    # a skin band at the cuffs: stripped by the pipeline
    sl, tr = D['sleeves'].copy(), D['sleeves'].copy()
    for key in SG.CELLS:
        s2, t2 = GS.cuff_skin(sl, key, 6)
        sl = s2; tr[..., 3] = np.minimum(tr[..., 3], t2[..., 3])
    add('P-cuff-skin', 'top', {'sleeves': sl}, positive=True, truth={'sleeves': tr})
    # recoloured shorts and shoes (the third synthetic record)
    rust = (150, 80, 50)
    add('P-shorts-rust', 'bottom', {'shorts': GS.cream(D['shorts'], everywhere, rust)}, _hex(rust), positive=True)
    teal = (40, 130, 120)
    add('P-shoes-teal', 'shoes', {'shoes': GS.cream(D['shoes'], everywhere, teal)}, _hex(teal), positive=True)
    # D: class-rule negatives
    add('N-sleeve-long', 'top', {'sleeves': GS.every_figure(GS.stretch_sleeves, D['sleeves'], 30)}, control=True, expect=('SLEEVE_LONG',))
    add('N-hem-low30', 'top', {'shirt': GS.every_figure(GS.hem_shift, D['shirt'], 30)}, control=True, expect=('HEM_LOW',))
    add('N-collar-high', 'top', {'shirt': GS.front_back(GS.collar_raise, D['shirt'], 10)}, control=True, expect=('COLLAR_HIGH',))
    add('N-shorts-short10', 'bottom', {'shorts': GS.every_figure(GS.shorten_shorts, D['shorts'], 10)}, control=True, expect=('SHORTS_SHORT',))
    add('N-skirt', 'bottom', {'shorts': GS.front_back(GS.join_legs, D['shorts'])}, control=True, expect=('SKIRT_LIKE',))
    add('N-shoes-lifted6', 'shoes', {'shoes': GS.every_figure(GS.shift_figure, D['shoes'], 0, -6)}, control=True, expect=('SOLE_OFF_FLOOR',))
    add('N-boot', 'shoes', {'shoes': GS.every_figure(GS.taller_shoes, D['shoes'], 40)}, control=True, expect=('SHOE_HIGH',))
    one = GS.cream(D['shirt'], GS.figure_mask('m-right'), (200, 40, 40))
    add('N-view-recoloured', 'top', {'shirt': one, 'sleeves': GS.cream(D['sleeves'], GS.figure_mask('m-right'), (200, 40, 40))},
        control=True, expect=('VIEW_INCONSISTENT',))
    return cases


def _run(c, out):
    r = run_case(c['name'], c['sheet'], c['slot'], c['truth'], c['own'], c['kind'], out, c['prod'], c['pid'],
                 rgb_tol=c.get('rgb'), positive=c.get('positive', False), cream=c.get('cream', False),
                 expect=c.get('expect', ()), control=c.get('control', False), dontcare=c.get('dontcare'))
    r.pop('build', None)
    return r


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--roundtrip', action='store_true')
    ap.add_argument('--positives', action='store_true')
    ap.add_argument('--cream', action='store_true')
    ap.add_argument('--controls', action='store_true')
    ap.add_argument('--wp8', action='store_true', help='the rest of the synthetic suite (WP8)')
    ap.add_argument('--register', action='store_true', help='also run tools/garment/test_register.py (registration suite)')
    ap.add_argument('--procs', type=int, default=4, help='cases run at once (each build is ~1 min)')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--only', help='comma-separated case names')
    ap.add_argument('--out', default=os.path.join(ROOT, '검증', '옷', '파이프라인-검사'))
    ap.add_argument('--base', choices=('dark',), help='draw the synthetic sheets on the dark-skin template (make-dark-template.py)')
    a = ap.parse_args(argv)
    GS.BASE = a.base
    if a.all:
        a.roundtrip = a.positives = a.cream = a.controls = a.wp8 = True
    if not (a.roundtrip or a.positives or a.cream or a.controls or a.wp8):
        a.roundtrip = True
    out = os.path.abspath(a.out)
    work = os.path.join(out, 'sheets')
    os.makedirs(work, exist_ok=True)
    cases = []
    if a.roundtrip:
        cases += roundtrip_cases(work)
    if a.positives:
        cases += positive_cases(work)
    if a.cream:
        cases += cream_case(work)
    if a.controls:
        cases += control_cases(work)
    if a.wp8:
        cases += wp8_cases(work)
    if a.only:
        want = set(a.only.split(','))
        cases = [c for c in cases if c['name'] in want]
    # the case list with its expectations, kept in the repository: a change to
    # the suite shows in review (tools/garment/controls.json)
    ctl = [dict(name=c['name'], slot=c['slot'], kind=c['kind'], expect=list(c.get('expect', ())) or 'pass',
                role='control' if c.get('control') else 'positive' if c.get('positive') or c.get('cream') else 'roundtrip') for c in cases]
    if not a.only and not a.base:
        with open(os.path.join(HERE, 'controls.json'), 'w', encoding='utf-8') as fh:
            json.dump(ctl, fh, ensure_ascii=False, indent=1)
    # independent cases, a few at a time (one at a time took ~40 min)
    import multiprocessing as mp
    with mp.get_context('fork').Pool(max(1, a.procs)) as pool:
        done = pool.starmap(_run, [(c, out) for c in cases])
    results, bad = [], 0
    for r in done:
        results.append(r)
        bad += len(r['fails'])
        worst = min((v['iou'] for v in r.get('parts', {}).values()), default=None)
        seam_max = max((v['max'] for v in r.get('seams', {}).values()), default=None)
        print('%-22s %s  %5.1f s  min IoU %s  seam max %s  %s' % (
            r['name'], 'ok  ' if not r['fails'] else 'FAIL', r['seconds'], '%.4f' % worst if worst is not None else '-',
            '%.2f' % seam_max if seam_max is not None else '-', ', '.join(r.get('codes', [])) or ''))
        for f in r['fails']:
            print('    ' + f)
    with open(os.path.join(out, '결과.json'), 'w', encoding='utf-8') as fh:
        json.dump(dict(tolerances=TOL, results=results), fh, ensure_ascii=False, indent=1,
                  default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    reg = None
    if a.register:
        # the registration-level suite (WP5): layout, background, size, pose ... codes
        import subprocess
        p = subprocess.run([sys.executable, '-B', os.path.join(HERE, 'test_register.py'), '--out', os.path.join(out, 'register')],
                           capture_output=True, text=True)
        reg = (p.returncode, (p.stdout + p.stderr).strip().splitlines()[-1:] or [''])
        bad += 1 if p.returncode else 0
    # one table for the whole suite
    rows = ['| 경우 | 칸 | 기대 | 결과 | 걸린 코드 | 시간 |', '|---|---|---|---|---|---|']
    for c, r in zip(cases, results):
        exp = ', '.join(c.get('expect', ())) or '통과'
        rows.append('| %s | %s | %s | %s | %s | %.0f s |' % (r['name'], r['slot'], exp, '맞음' if not r['fails'] else '틀림: ' + '; '.join(r['fails'])[:120],
                                                       ', '.join(r.get('codes', [])) or '-', r['seconds']))
    if reg:
        rows.append('| 원화 배치 시험(test_register.py) | - | - | %s | - | - |' % ('맞음' if reg[0] == 0 else '틀림: ' + reg[1][0][:120]))
    with open(os.path.join(out, '요약.md'), 'w', encoding='utf-8') as fh:
        fh.write('# 옷 파이프라인 합성 시험 요약\n\n' + '\n'.join(rows) + '\n')
    print('verify-pipeline: %d case(s), %d failure(s); %s' % (len(results), bad, os.path.join(out, '요약.md')))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
