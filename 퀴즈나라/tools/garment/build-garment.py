"""Build one garment from a ChatGPT sheet (stage 3, WP6: Lane B).

  python3 -B tools/garment/build-garment.py top:shirt:10 --sheet assets/garment-sources/top-shirt-10-chatgpt-2026-10-09.webp
  python3 -B tools/garment/build-garment.py <cat:shape[:ci]> --sheet FILE [--out 검증|assets|DIR] [--sexes m,f] [--date YYYY-MM-DD]

Steps (each a module of tools/garment/):
  1. register   tools/avatar_build/register.py (+ matte.py): the sheet on the
                template frame, tone fit, registration codes;
  2. segment    segment.py + seam.py: three-way labels per figure (product /
                body or other slot / hidden), the drawn edge as the cuff,
                collar and hem boundary (DP seams in the frozen bands);
  3. fill       fill.py: parts split by the frozen zones, hidden cloth rebuilt
                under hair/arms, edge alpha and colour;
  4. codes      class geometry (tools/avatar_build/limits.py measure_*, with
                the exposed skin of a short top or a low neckline left out of
                the garment: HEM_HIGH / NECK_OPEN; GHOST_EDGE for bottoms on
                the legacy legs), skin left in the garment (UNTINTED_SKIN),
                views that disagree (VIEW_INCONSISTENT), colour against the
                shop's display colour (user decision 2026-10-09: close keeps a
                COLOUR_OFF warning, noticeably different is COLOUR_FAR);
  5. metadata   metadata.py: raised sleeves, underarm, box, opening, cuff, hem,
                collar, seat/sideSeat (with span), edgeTone, shoes rows; read
                from the packed 8-bit crops;
  6. pack       pack.py: one atlas per sex (IHDR/IDAT/IEND only, the same
                bytes for the same input) and the record (schema.json).

The build refuses to run when the frozen body differs from
tools/garment/frozen/frozen-body.json (avatar_build.freeze.check()).

--out 검증 (default) writes everything to 검증/옷/<cat>-<shape>/ (not
committed): the data file and atlases under their assets/ names, 라벨.png
(the view label map), 부위.png (the parts sheet), 피부-후보.png (the
UNTINTED_SKIN mask), 등록-보고.png / 보고.md / 보고.json
(tools/garment/report.py with the garment codes) and 만들기.json (timings
and diagnostics). --out assets writes the data file and atlases into
assets/ and the reports to 검증/옷/<stem>/. The record is validated with
tools/garment/schema.cjs --builder (node) unless --no-validate.
Exit: 0 record without codes, 1 codes (rebuild the sheet), 2 not built.
"""
import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode = True  # no __pycache__ in the repo
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from avatar_build import limits as LIM  # noqa: E402
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402
import segment as SG  # noqa: E402
import fill as FL  # noqa: E402
import metadata as MD  # noqa: E402
import pack as PK  # noqa: E402
import report as RP  # noqa: E402

ROOT = os.path.dirname(TOOLS)
SCHEMA = json.load(open(os.path.join(HERE, 'schema.json'), encoding='utf-8'))
PRODUCTS = os.path.join(ROOT, 'assets', 'garment-template', 'products.json')
LIMITS = 'tools/garment/frozen/limits.json'
FROZEN_BODY = 'tools/garment/frozen/frozen-body.json'
BUILDER = 'tools/garment/build-garment.py'
VIEWS = ('front', 'right', 'back')
CAT_SLOT = {'top': 'top', 'bottom': 'bottom', 'shoes': 'shoes'}
SKIN_LR = 3.0          # UNTINTED_SKIN: skin model this much likelier than the product
SKIN_MIN_PX = 6        # ... in a patch of at least this many px
VIEW_DE = 8.0          # VIEW_INCONSISTENT: main cloth colour of a view this far from the views' median (plan)
VIEW_SHARE = .5        # ... or its share of the main colour below this part of the median view's
MERGE_HUE = 35.0       # product colour components this close in hue are shades of one colour,
MERGE_CHROMA = 10.0    # ... as are two near-neutral ones (chroma below this)
COLOUR_DE = 6.0        # COLOUR_OFF (warning): main colour this far from the shop's display colour
COLOUR_FAR_DE = 25.0   # COLOUR_FAR (send back): noticeably different (user decision 2026-10-09); the basic
                       # garments' own art lies up to dE 17 from their shop colour (girls' shorts:5)
COLOUR_SHARE = .2      # ... measured against the garment's colour groups holding at least this share
FONT = os.path.join(ROOT, 'assets', 'fonts', 'NanumSquareRoundB.ttf')


_FROZEN_OK = []


def frozen_problems():
    """avatar_build.freeze.check() once per process (assets, data file and
    runtime constants against tools/garment/frozen/frozen-body.json)."""
    if not _FROZEN_OK:
        from avatar_build import freeze as FZ
        _FROZEN_OK.append(list(FZ.check()))
    return _FROZEN_OK[0]


def builder_id():
    """'tools/garment/build-garment.py@<commit>' (+'+local' when the builder's
    own sources differ from that commit), the plan's source.builder."""
    try:
        sha = subprocess.run(['git', 'rev-parse', '--short=12', 'HEAD'], cwd=ROOT, capture_output=True, text=True,
                             timeout=10).stdout.strip()
        dirty = subprocess.run(['git', 'status', '--porcelain', '--', 'tools/garment', 'tools/avatar_build'], cwd=ROOT,
                               capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return BUILDER
    if not sha:
        return BUILDER
    return '%s@%s%s' % (BUILDER, sha, '+local' if dirty else '')


def sheet_date(sheet, date=None):
    """The record date: --date, else the YYYY-MM-DD in the sheet's file name
    (assets/garment-sources/<id>-chatgpt-<date>.<ext>), else today."""
    if date:
        return date
    import re
    m = re.search(r'(20\d\d-\d\d-\d\d)', os.path.basename(sheet))
    return m.group(1) if m else datetime.date.today().isoformat()


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_file(path):
    with open(path, 'rb') as fh:
        return sha256_bytes(fh.read())


def rel(path):
    p = os.path.relpath(os.path.abspath(path), ROOT)
    return p.replace(os.sep, '/') if not p.startswith('..') else 'synthetic/' + os.path.basename(path)


def parse_product(text):
    parts = text.split(':')
    if len(parts) not in (2, 3) or parts[0] not in CAT_SLOT:
        raise SystemExit('product must be cat:shape[:ci] with cat top|bottom|shoes: %r' % text)
    return parts[0], parts[1], (int(parts[2]) if len(parts) == 3 else None)


def product_entry(cat, shape, override=None):
    """products.json entry (class, sexes, ci, names, colour, display,
    mirrorSafe, designRef); `override` replaces it (synthetic tests)."""
    if override is not None:
        return override
    prods = json.load(open(PRODUCTS, encoding='utf-8'))['products']
    p = prods.get('%s:%s' % (cat, shape))
    if p is None:
        raise SystemExit('%s:%s is not in assets/garment-template/products.json' % (cat, shape))
    return p


# ---------------------------------------------------------------------------
# Codes
# ---------------------------------------------------------------------------
def sheet_mask(cells_masks, shape):
    out = np.zeros(shape, bool)
    for key, m in cells_masks.items():
        x0, y0, x1, y1 = SG.CELLS[key]
        out[y0:y1, x0:x1] |= m
    return out


def part_name(key, name):
    if name == 'torso':
        return 'torso'
    side = 'L' if name.endswith('0') else 'R'
    base = {'sleeve': 'arm', 'shoe': 'shoe'}.get(name[:-1], name[:-1])
    if key.endswith('right'):
        return base
    return base + side


_GHOST = {}


def ghost_lines(fz, line=40.0):
    """Contact band 3 (legacy legs) pixels that are line art (a ridge at
    least `line` darker than the brightest pixel of their 5x5 neighbourhood
    in the leg painting) and lie under the drawn basic shorts: the basic
    cuff's line a shorter bottom would uncover."""
    if 'legs' not in _GHOST:
        legs = fz.layers['legs']
        lum = np.where(legs[..., 3] > 127, .299 * legs[..., 0] + .587 * legs[..., 1] + .114 * legs[..., 2], 255.0)
        lmax = M._max_filter(np.clip(lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
        art = (lmax - lum >= line) & (legs[..., 3] > 127)
        _GHOST['legs'] = (fz.bands == 3) & art & (fz.drawn['shorts'][..., 3] > 127)
    return _GHOST['legs']


NECK_OPEN_PX = 12  # px of skin outside the neck art a neckline may show before NECK_OPEN (as UNTINTED_SKIN's 12 px patches)


def limit_codes(ctx, segs, figs, slot):
    """Class-geometry codes per figure from limits.measure_* on the built
    garment (visible product pixels; hidden cloth counts for coverage of the
    bottom). Returns (codes, measured)."""
    fz = ctx.fz
    H, W = fz.sheet.shape[:2]
    codes, measured = [], {}
    vis = sheet_mask({k: s['label'] == 1 for k, s in segs.items()}, (H, W))
    full = sheet_mask({k: sum((p['a'] for p in f['parts'].values()), np.zeros(f['label'].shape, np.float32)) >= .5
                       for k, f in figs.items()}, (H, W))
    for key in segs:
        g = fz.zones[key]
        if slot == 'top':
            top_a = (fz.layers['shirt'][..., 3] > 127) | (fz.layers['sleeves'][..., 3] > 127)
            s = segs[key]
            skin_c = (s['nll']['skin'] - s['nll']['product'] < -SKIN_LR)
            # NECK_OPEN counts skin, not the neck's dark outline (the skin
            # model holds the art's brown line colour too)
            x0c, y0c, x1c, y1c = SG.CELLS[key]
            skin_c &= ~(ctx.ink[y0c:y1c, x0c:x1c] > SG.P['lineDark'])
            skin = sheet_mask({key: skin_c}, (H, W))
            got = LIM.measure_top(g, vis, band=None, top_region=top_a, owners=fz.owner,
                                  neck_art=fz.clean['neck'][..., 3] > 200, skin=skin)
            # SLEEVE_SHORT is the coverage test of limits.py: every arm-band
            # line covered from the shoulder down to tHidden (above it the
            # clean arm is copied skin). The frozen contact band (the basic
            # cuff's line on the LEGACY arm, bands == 1) is recorded beside
            # it: on the clean art it holds no line, so leaving it uncovered
            # is no code here (GHOST_EDGE applies to legacy-art tops only).
            band = fz.bands == 1
            for a in g['arms']:
                side = np.zeros((H, W), bool)
                side[a['hiddenRow'] - 4:a['cleanRow'] + 2, int(a['elbow'][0] - 30):int(a['elbow'][0] + 30)] = True
                b = band & side
                unc = int((b & ~M.dilate(full, 1)).sum())
                got.setdefault('SLEEVE_SHORT', {}).setdefault('arm%d' % a['i'], {})['bandUncoveredPx'] = unc
                got['SLEEVE_SHORT']['arm%d' % a['i']]['bandPx'] = int(b.sum())
        elif slot == 'bottom':
            got = LIM.measure_bottom(g, full, band=None, visible=vis)
            # GHOST_EDGE on the legacy legs (no clean leg art yet): the basic
            # shorts' cuff line lives in the leg painting (contact band 3).
            # Every band pixel that is line art AND that the basic bottom
            # covers at rest must stay covered (the product grown 1 px: its
            # own cuff outline is the seam). The band's other pixels are the
            # thigh's own shading below the cuff, which the basic leaves
            # visible too (that is why limits.py's whole-band test failed
            # the basic itself, 686 of 818 px).
            ghost = ghost_lines(fz)
            grown = M.dilate(full, 1)
            x0c, y0c, x1c, y1c = SG.CELLS[key]
            depth = np.zeros((H, W), np.int16)
            depth[y0c:y1c, x0c:x1c] = SG.distance_to(~full[y0c:y1c, x0c:x1c], 12)
            for lg in g['legs']:
                side = np.zeros((H, W), bool)
                side[lg['hiddenRow'] - 2:lg['cleanRow'] + 2, int(lg['knee'][0] - 30):int(lg['knee'][0] + 30)] = True
                b = ghost & side
                # coverMarginPx (information): how deep inside the product the
                # shallowest covered line pixel lies (px, chessboard)
                got.setdefault('GHOST_EDGE', {})['leg%d' % lg['i']] = dict(
                    bandLinePx=int(b.sum()), uncoveredPx=int((b & ~grown).sum()),
                    coverMarginPx=int(depth[b & full].min()) if (b & full).any() else 0)
        else:
            got = LIM.measure_shoes(g, full, fz.legs_under[..., 3] > 127)
        measured[key] = got
        for lim, v in got.items():
            entries = [('-', v)] if ('marginPx' in v or 'minMarginPx' in v or 'outsideNeckArtPx' in v or 'missing' in v) else list(v.items())
            for part, w in entries:
                if not isinstance(w, dict):
                    continue
                bad, value = False, None
                if lim == 'NECK_OPEN':
                    # a speck is no neckline: single pixels where the skin
                    # model wins along the collar fringe come and go with WebP
                    # noise (1 px on sleeve-only positives, m-right); a
                    # lowered neckline shows tens of px (N-neck20: 77-99)
                    bad, value = w['outsideNeckArtPx'] > NECK_OPEN_PX, w['outsideNeckArtPx']
                elif lim == 'SHOE_MISSING':
                    bad = w.get('missing', False)
                elif lim == 'GHOST_EDGE':
                    bad, value = w['uncoveredPx'] > 0, w['uncoveredPx']
                elif lim == 'SKIRT_LIKE':
                    m = w.get('marginPx')
                    bad, value = m is None or m <= 0, m
                elif lim == 'WAIST_VISIBLE':
                    bad, value = w['visibleAboveHemPx'] > 0, w['visibleAboveHemPx']
                else:
                    m = w.get('minMarginPx', w.get('marginPx'))
                    if m is not None:
                        bad, value = m < 0, m
                if bad:
                    pn = None
                    if part.startswith('arm'):
                        pn = part_name(key, 'sleeve' + part[-1])
                    elif part.startswith('leg'):
                        pn = part_name(key, 'leg' + part[-1])
                    elif part.startswith('foot'):
                        pn = part_name(key, 'shoe' + part[-1])
                    codes.append(dict(code=lim, figure=key, part=pn, value=value, stage='garment'))
    return codes, measured


def cluster_of(model, lab):
    """Index of the colour model's component that explains each Lab pixel best."""
    X = lab.reshape(-1, 3).astype(np.float32) * SG.LAB_W
    q = (((X[:, None, :] - model.mu[None]) ** 2) / model.var[None]).sum(-1) * .5 + model.const[None]
    return q.argmin(1)


def hex_lab(h):
    return R.lab(np.array([[int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]], np.float32))[0]


def shop_display(prod, sex):
    """The colour the new avatar's shop shows: products.json artDisplay (the art's own colour where the user chose it
    over the legacy shop's painted colour: the girl's cardigan #faa6c9, 2026-10-16) or display (= the legacy shop's,
    which design-ref.cjs checks; the student screen keeps it until stage 5)."""
    return (prod.get('artDisplay') or {}).get(sex) or prod.get('display', {}).get(sex)


def colour_codes(ctx, segs, figs, prod, masks=None):
    """UNTINTED_SKIN, VIEW_INCONSISTENT, COLOUR_FAR and COLOUR_OFF (warning).

    Main cloth colour of a view: the median Lab of its garment interior
    (eroded 2 px, no drawn line) in the heaviest component of this sex's
    product colour model (one model for the three views, so a white shoe's
    shading or a print never decides the main colour). The views agree when
    each main colour lies within VIEW_DE of their median and each view holds
    at least VIEW_SHARE of the median view's share of that component (a view
    recoloured as a whole leaves it)."""
    codes, warnings, info = [], [], {}
    main, share, pix = {}, {}, {}
    for key, s in segs.items():
        x0, y0, x1, y1 = SG.CELLS[key]
        f = figs[key]
        a = sum((p['a'] for p in f['parts'].values()), np.zeros(s['label'].shape, np.float32))
        hidden = np.zeros(a.shape, bool)
        for h in f['hidden'].values():
            hidden |= h
        visible = (a >= .5) & ~hidden
        # UNTINTED_SKIN, never colour-only (REDTEAM): a garment pixel that is
        # topmost at rest (not under the runtime head, which sits headDropPx
        # lower than the sheet's, nor under the frozen hair occlusion) is left
        # skin when it lies in this build's own skin-likelihood mask (this
        # sheet's skin model likelier than its product model by SKIN_LR), does
        # so at three tones (lightness -8, 0, +8: skin baked into the garment
        # does not follow the tint, the call does not hinge on the sheet's
        # tone), the product model does not explain it (its nll above the 99th
        # percentile of the product's own interior), and it is new paint: a
        # pixel that still matches the template's own garment paint there
        # (change map below tau on a product owner: a cream cuff's pinkish
        # shading) is that garment. Drawn lines are the garment's own edge.
        O = ctx.fz.O[y0:y1, x0:x1]
        head = O == SG.HEAD
        drop = int(np.ceil(ctx.fz.zones[key]['upper'].get('headDropPx', 0)))
        cover = head.copy()
        for d in range(1, drop + 1):
            cover[d:] |= head[:-d]
        cover |= ctx.fz.hair_occ[y0:y1, x0:x1]
        template_paint = (ctx.D[y0:y1, x0:x1] < ctx.tau) & np.isin(O, SG.SLOT[ctx.slot]['labels'])
        Ut = ctx.Ut[y0:y1, x0:x1]
        mods = ctx.models[key[0]]
        skinlike = visible & ~cover & ~template_paint
        if mods.get('skin') is None or mods.get('product') is None:
            skinlike[:] = False
        else:
            for dL in (-8.0, 0.0, 8.0):
                lab = Ut + np.array([dL, 0, 0], np.float32)
                skinlike &= mods['skin'].nll(lab) - mods['product'].nll(lab) < -SKIN_LR
            interior = M.erode(s['label'] == 1, 3)
            pn = s['nll']['product']
            thr = float(np.percentile(pn[interior], 99)) if interior.sum() > 50 else 20.0
            skinlike &= pn > thr
            skinlike &= ~(ctx.ink[y0:y1, x0:x1] > SG.P['lineDark'])
            # at least 2 px thick (a 2x2 block): a 1 px sliver along a seam is
            # the seam's own +-1 px, a nub of skin is a patch
            blk = skinlike[:-1, :-1] & skinlike[1:, :-1] & skinlike[:-1, 1:] & skinlike[1:, 1:]
            thick = np.zeros_like(skinlike)
            thick[:-1, :-1] |= blk; thick[1:, :-1] |= blk; thick[:-1, 1:] |= blk; thick[1:, 1:] |= blk
            skinlike = thick
        if masks is not None:
            masks[key] = skinlike
        lab_, comps = M.components(skinlike)
        big = [c for c in comps if c['size'] >= SKIN_MIN_PX]
        info[key] = dict(skinPatches=len(big), skinPx=int(sum(c['size'] for c in big)))
        if big:
            codes.append(dict(code='UNTINTED_SKIN', figure=key, value=int(sum(c['size'] for c in big)), stage='garment'))
        core = visible & M.erode(s['label'] == 1, 2) & (ctx.ink[y0:y1, x0:x1] < .3)
        model = mods.get('product')
        if model is None or core.sum() < 30:
            continue
        comp = cluster_of(model, ctx.Ut[y0:y1, x0:x1][core])  # the models live in the tone-mapped Lab
        pix[key] = (R.lab(ctx.U[y0:y1, x0:x1][core]), comp, len(model.mu))
    for sex in sorted({k[0] for k in segs}):
        keys = [k for k in segs if k[0] == sex and k in pix]
        if not keys:
            continue
        # the main colour's component: the one most of the three views' garment
        # interior falls in (pooled counts; the model's own weights follow its
        # deep-interior samples, where a girl's cream cuffs outweighed the blue)
        # Shades of one colour are one colour (a cloth's light and shadow
        # split over several components): components of the same hue (within
        # MERGE_HUE degrees, both chromatic) or both near-neutral are merged.
        model = ctx.models[sex]['product']
        cen = model.mu / SG.LAB_W
        n = len(cen)
        chroma = np.hypot(cen[:, 1], cen[:, 2])
        hue = np.degrees(np.arctan2(cen[:, 2], cen[:, 1]))
        group = list(range(n))
        for i in range(n):
            for j in range(i + 1, n):
                dh = abs((hue[i] - hue[j] + 180) % 360 - 180)
                same = (chroma[i] >= MERGE_CHROMA and chroma[j] >= MERGE_CHROMA and dh < MERGE_HUE) or \
                    (chroma[i] < MERGE_CHROMA and chroma[j] < MERGE_CHROMA)
                if same:
                    gi, gj = group[i], group[j]
                    group = [gi if g == gj else g for g in group]
        group = np.array(group)
        counts = sum(np.bincount(group[pix[k][1]], minlength=n) for k in keys)
        heavy = int(np.argmax(counts))
        for k in keys:
            lab, comp, _ = pix[k]
            sel = group[comp] == heavy
            share[k] = float(sel.mean())
            if sel.sum() >= 30:
                main[k] = np.median(lab[sel], 0)
        sh_med = float(np.median([share[k] for k in keys]))
        withm = [k for k in keys if k in main]
        med = np.median(np.array([main[k] for k in withm]), 0) if withm else None
        far = []
        for k in keys:
            de = float(np.linalg.norm(main[k] - med)) if (k in main and med is not None) else None
            info[k]['mainLab'] = [round(float(v), 2) for v in main[k]] if k in main else None
            info[k]['viewDE'] = round(de, 2) if de is not None else None
            info[k]['mainShare'] = round(share[k], 3)
            if de is None or de > VIEW_DE or share[k] < VIEW_SHARE * sh_med:
                far.append(k)
        if far:
            codes.append(dict(code='VIEW_INCONSISTENT', figures=far, stage='garment',
                              value=round(max((float(np.linalg.norm(main[k] - med)) if k in main and med is not None else 99.0)
                                              for k in far), 1)))
        disp = shop_display(prod, sex)
        if disp and med is not None:
            # The shop colour must be one of the garment's own large colours
            # (a group holding >= COLOUR_SHARE of the three views' garment
            # interior): a girl's flowered shorts are blue even where the
            # white daisies and cream cuffs together outweigh the blue.
            want = hex_lab(disp)
            total = float(counts.sum())
            best = None
            for gid in np.unique(group):
                if counts[gid] < COLOUR_SHARE * total:
                    continue
                labs = np.concatenate([pix[k][0][group[pix[k][1]] == gid] for k in keys])
                if len(labs) < 30:
                    continue
                gl = np.median(labs, 0)
                d = float(np.linalg.norm(gl - want))
                if best is None or d < best[0]:
                    best = (d, gl, float(counts[gid]) / total)
            if best is None:
                best = (float(np.linalg.norm(med - want)), med, 1.0)
            de = best[0]
            info['colour-' + sex] = dict(display=disp, mainLab=[round(float(v), 2) for v in med], dE=round(de, 2),
                                         nearestLab=[round(float(v), 2) for v in best[1]], nearestShare=round(best[2], 3))
            # user decision 2026-10-09: a colour close to the shop's is kept
            # with a warning; a noticeably different one is sent back
            if de > COLOUR_FAR_DE:
                codes.append(dict(code='COLOUR_FAR', figures=withm, value=round(de, 1), stage='garment', detail='%s %s' % (sex, disp)))
            elif de > COLOUR_DE:
                warnings.append(dict(code='COLOUR_OFF', figure=withm[0], value=round(de, 1), stage='garment',
                                     detail='%s %s' % (sex, disp)))
    return codes, warnings, info


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
BUILDER_TODO = {}
# Body owners (register.OWNER) a class covers beyond its slot: no stable mark for the registration's checks
# (BODY_DRIFT, POSE_ARM/POSE_LEG, the change threshold tau). A long sleeve over the arm raised false POSE_ARM
# (up to 11 px), BODY_DRIFT (p95 31.8) and a tau of 22 (2026-10-16). Add the new class here when it opens
# (long trousers: the leg, 5; boots: the leg's lower run).
CLASS_COVER = {'top/long-sleeve': (3,)}
LONG_GROW = 3        # px round the arm painting (clean and legacy) over the basic shirt where a long sleeve's strip may lie
LONG_WIDE = 8        # px round it elsewhere (a sleeve wider than the arm: the knit's outline lay 4-7 px out, 2026-10-16)
LONG_SKIN = 2.0      # nll margin by which the skin model must beat the product model for a strip pixel to be skin
LONG_MIN = 30        # px of a kept strip piece
LONG_NEAR = 2        # px within which a torso piece counts as joined to the torso's main piece (long sleeves)
KNIT_GAP = 2         # px past a hidden run where its row's visible cloth is taken (knit_rows)
LONG_CAP = 6         # px down the upper arm past the shoulder line a long sleeve's cap keeps (over the strip)
LONG_LINE = 2        # px: skin-like pieces this thin (2r+1 wide) are drawn lines, not bare skin
LONG_CODES = ('SLEEVE_LONG', 'SLEEVE_SHORT')  # the short-sleeve coverage rules a long sleeve does not keep
OPEN_SHOE_CODES = ('SOLE_OFF_FLOOR', 'SHOE_MISSING')
OPEN_CHANGED = 12.0   # Lab change (blurred) from the bare feet that is the shoe
OPEN_ZONE = 8         # px round the pipeline's own shoe part where an open shoe may lie
OPEN_MIN = 20         # px of a kept piece
OPEN_FEET = 3         # px round the feet layer where an open shoe may lie
OPEN_SKIN = 10.0      # Lab to the dark feet's colours under which a changed pixel is a redrawn toe, not the shoe


def KM(X, k):
    """k-means colour clusters (Lab rows), as tools/hair/build-hat.py kmeans."""
    X = np.asarray(X, np.float32)
    if len(X) <= k:
        return X
    rng = np.random.default_rng(0); C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(12):
        lab_ = np.argmin(((X[:, None] - C[None]) ** 2).sum(-1), 1)
        for j in range(k):
            if (lab_ == j).any():
                C[j] = X[lab_ == j].mean(0)
    return C


def NEAREST(L, C):
    """Lab distance of each pixel to its nearest colour of C."""
    return np.sqrt(((L[..., None, :] - C) ** 2).sum(-1)).min(-1)


def open_shoes(res, figs, keys):
    """Open shoes (class shoes/sandals, 2026-10-16) are drawn on the barefoot sheet with dark feet
    (assets/garment-template/barefoot-dark-sheet.png, tools/build-standing-feet.py): the shoe is what changed from those bare
    feet, both registered to the body. The bare skin the straps leave stays out of the record (no baked skin
    colour); the game draws its own feet layer there (record.feet, avatar-foundation-outfit.js). Replaces each
    figure's shoe parts in place; the zone is the pipeline's own shoe part, grown."""
    import importlib.util
    from PIL import ImageFilter
    spec = importlib.util.spec_from_file_location('standing_feet', os.path.join(ROOT, 'tools', 'build-standing-feet.py'))
    SF = importlib.util.module_from_spec(spec); spec.loader.exec_module(SF)
    bare = SF.registered(SF.DARK_BASE)  # the open shoe was drawn on dark feet (image 1 of its request)
    feet_all = np.asarray(Image.open(os.path.join(ROOT, SF.OUT_PNG)).convert('RGBA'))[..., 3] > 40
    reg = res['images']['registered'].astype(np.float32)
    blur = lambda x: np.asarray(Image.fromarray(np.clip(x, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32)
    for key in keys:
        x0, y0, x1, y1 = SG.CELLS[key]
        u, b = reg[y0:y1, x0:x1], bare[y0:y1, x0:x1]
        d = np.sqrt(((R.lab(blur(u[..., :3])) - R.lab(blur(b[..., :3]))) ** 2).sum(-1))
        page = (u[..., :3].sum(-1) > 735) | (u[..., 3] < 128)
        Ul, Bl = R.lab(u[..., :3]), R.lab(b[..., :3])
        feet = feet_all[y0:y1, x0:x1]
        for name, part in figs[key]['parts'].items():
            if not name.startswith('shoe'):
                continue
            zone = M.dilate(part['a'] > .1, OPEN_ZONE) & ~page
            changed = zone & (d > OPEN_CHANGED)
            # On the dark feet a cream strap changes plainly; the skin left between straps is unchanged. A toe
            # the sheet redrew a little changed too: it is dropped when its colour is the dark feet's. (On light
            # feet a cream strap was the skin's colour within Lab ~9: straps came out hollow or the light toes
            # between them were baked in, 2026-10-16 sandal; the skin is sampled on the feet layer only, the
            # legs above stay light.)
            skin = zone & feet & (b[..., :3].sum(-1) < 735)
            # only on the feet (a few px round them): the sheet repaints the border of the dark feet and the light
            # legs above, and that light skin came in over the ankle strap (light blotches on dark legs, 2026-10-16)
            m = changed & M.dilate(feet, OPEN_FEET)
            if skin.sum() > 50:
                skin_cols = KM(Bl[skin].reshape(-1, 3)[::3], 8)
                m = m & (NEAREST(Ul, skin_cols) > OPEN_SKIN)
            lab_, comps = M.components(m)
            m = np.isin(lab_, [c['label'] for c in comps if c['size'] >= OPEN_MIN])
            part['a'] = m.astype(np.float32) * (u[..., 3] / 255.0)
            part['rgb'] = u[..., :3].copy()


def crops_of(figs):
    out = {}
    for key, f in figs.items():
        cell = SG.CELLS[key]
        for name, p in f['parts'].items():
            crop, rect = PK.quantize(p, cell)
            if crop is not None:
                out[(key, name)] = (crop, rect)
    return out


def arm_strips(ctx, segs, keys):
    """Long sleeves (class top/long-sleeve, 2026-10-16): per figure and arm, the sleeve over the arm as a strip on
    the painted arm's own rect (assets/sd-foundation-ref-data.js rects.arm[i]), which the game warps along the arm
    like the arm painting (avatar-foundation-outfit.js top.armSleeves, avatar-foundation-skin.js limbPainting)
    over the arm skin and under the sleeve cap. A strip pixel lies within LONG_WIDE px of the arm painting (clean
    or legacy; LONG_GROW over the basic shirt's body, which stays with the torso), below the shoulder line (across the upper arm at the shoulder joint: above it the strip would flap
    out of the shoulder when the arm swings) and above the wrist (across the forearm), is not the page (the white
    reached from the figure's cell border; its edge keeps the sheet's matte) and not bare skin (where this
    sheet's skin model beats the product model by LONG_SKIN in an area wider than a drawn line: the hand; drawn
    on the dark-skin template the two part, make-dark-template.py). Under the sleeve cap the strip
    holds the cap's own cloth, which shows when the arm moves away from it. Pieces under LONG_MIN px are
    dropped. The strip's rect is the arm's widened by LONG_WIDE - LONG_GROW px each side (the game maps x by the
    distance from the bone, avatar-foundation-outfit.js passes the record's rect). Returns {(key, i): (RGBA crop,
    rect)}; the profile's two arms share one rect and one strip."""
    fz = ctx.fz
    arm = (fz.clean['arms'][..., 3] > 64) | (fz.layers['arms'][..., 3] > 64)
    # a sleeve wider than the arm (a knit) reaches LONG_WIDE px out, never over the basic shirt's body beside it
    art = M.dilate(arm, LONG_WIDE) & ~((fz.drawn['shirt'][..., 3] > 127) & ~M.dilate(arm, LONG_GROW))
    H, W = art.shape
    yy, xx = np.mgrid[0:H, 0:W]
    out = {}
    for key in keys:
        F = fz.data[key]
        J = F['joints']
        x0, y0, x1, y1 = SG.CELLS[key]
        nll = segs[key]['nll']
        # the page is the white reached from the cell's border: a white cuff inside its outline is cloth
        pagelike = (ctx.A[y0:y1, x0:x1] <= .5) | (ctx.U[y0:y1, x0:x1].sum(-1) >= 735)
        border = np.zeros(pagelike.shape, bool); border[0] = border[-1] = True; border[:, 0] = border[:, -1] = True
        page_cell = M.connected_to(pagelike, border)
        for i in (0, 1):
            x, y, w, h = F['rects']['arm'][i]
            if i == 1 and F['rects']['arm'][1] == F['rects']['arm'][0]:
                out[(key, 1)] = out[(key, 0)]
                continue
            # the arm's rect holds the painting 3 px round; a wider sleeve widens it (rows unchanged: the mesh rows)
            g = LONG_WIDE - LONG_GROW
            x, w = max(x0, x - g), min(x1, x + w + g) - max(x0, x - g)
            sl = np.s_[y:y + h, x:x + w]
            S, E, Wr = (np.array(J[n][i], float) for n in ('shoulder', 'elbow', 'wrist'))
            ua, fa = (E - S) / np.linalg.norm(E - S), (Wr - E) / np.linalg.norm(Wr - E)
            px, py = xx[sl] + .5, yy[sl] + .5
            below = (px - S[0]) * ua[0] + (py - S[1]) * ua[1] >= 0
            above = (px - Wr[0]) * fa[0] + (py - Wr[1]) * fa[1] < 0
            cs = np.s_[y - y0:y - y0 + h, x - x0:x - x0 + w]
            # skin is a bare area (the hand, a forearm a short sleeve leaves), never a drawn line: the skin model
            # also holds the arm's dark outline, so the sleeve's own lines (the cuff's edge) would read as skin
            skinlike = (nll['skin'][cs] - nll['product'][cs]) < -LONG_SKIN
            skin = M.dilate(M.erode(skinlike, LONG_LINE), LONG_LINE) & skinlike
            page = page_cell[cs]
            m = art[sl] & below & above & ~skin & ~page
            lab_, comps = M.components(m)
            keep = np.zeros_like(m)
            for c in comps:
                if c['size'] >= LONG_MIN:
                    keep |= lab_ == c['label']
            rgba = np.zeros((h, w, 4), np.float32)
            rgba[..., :3] = ctx.U[sl]
            rgba[..., 3] = np.where(keep, np.where(M.dilate(page, 1), np.clip(ctx.A[sl], 0, 1), 1) * 255, 0)
            out[(key, i)] = (np.clip(np.rint(rgba), 0, 255).astype(np.uint8), [int(x), int(y), int(w), int(h)])
    return out


NEIGH_RAISED_PX = 120  # px of the top's frozen footprint the art gave to the shorts (NEIGHBOUR_RAISED)
SLIT_MIN_H = 4         # rows of a 1-2 px slit in a torso (THIN_SLIT)
STRIP_EDGE_ROWS = 10   # rows of a long sleeve's strip opaque on its rect's side (STRIP_CLIPPED)


def system_codes(ctx, segs, figs, strips, slot, keys):
    """Checks for the faults found on the long sleeves and the dark template (2026-10-16), each raised on the
    result the old rule gave and silent on the fixed ones (옷파이프라인-검수.md):
      NEIGHBOUR_RAISED  the art drew the shorts up into the top's place (the jacket's short inner T-shirt): pixels
                        of the frozen top footprint below the collar that the cut gave to the other slot and its
                        model explains better than the product by exposeLR, over NEIGH_RAISED_PX per figure
      THIN_SLIT         a torso with a 1-2 px vertical slit below the collar + 30 px (garment within 3 px on both
                        sides, SLIT_MIN_H rows or more): a seam column cut along a drawn line (the hood's zipper)
      STRIP_CLIPPED     a long sleeve's strip opaque on its rect's left or right column over STRIP_EDGE_ROWS
                        rows: a sleeve wider than the strip's rect (the knit before LONG_WIDE)"""
    codes, warns = [], []
    fz = ctx.fz
    for key in keys:
        x0, y0, x1, y1 = SG.CELLS[key]
        sl = np.s_[y0:y1, x0:x1]
        s = segs[key]
        if slot == 'top':
            O = fz.O[sl]
            nll = s['nll']
            yy = np.arange(O.shape[0])[:, None] + y0
            under = np.isin(O, SG.SLOT[slot]['labels']) & (s['label'] == 2) & (yy > R.COLLAR_Y[key[0]] + 40) & \
                (nll['product'] - nll['neighbour'] > SG.P['exposeLR'])
            n = int(under.sum())
            if n > NEIGH_RAISED_PX:
                codes.append(dict(code='NEIGHBOUR_RAISED', figure=key, value=n, stage='garment'))
            t = figs[key]['parts'].get('torso')
            if t is not None:
                m = t['a'] > .5
                left = np.zeros_like(m); right = np.zeros_like(m)
                for d in (1, 2, 3):
                    left[:, d:] |= m[:, :-d]; right[:, :-d] |= m[:, d:]
                slit = ~m & left & right & ~M.dilate(M.erode(~m & left & right, 1), 1)
                slit &= yy > R.COLLAR_Y[key[0]] + 30  # the neck opening's inner corners are no slit
                lab_, comps = M.components(slit)
                tall = sum(c['size'] for c in comps if c['bbox'][3] - c['bbox'][1] >= SLIT_MIN_H and c['bbox'][2] - c['bbox'][0] <= 2)
                if tall:
                    codes.append(dict(code='THIN_SLIT', figure=key, part='torso', value=int(tall), stage='garment'))
        if strips is not None:
            for i in (0, 1):
                a = strips[(key, i)][0][..., 3] > 128
                rows = int(max(a[:, 0].sum(), a[:, -1].sum()))
                if rows > STRIP_EDGE_ROWS and not any(w['code'] == 'STRIP_CLIPPED' and w['figure'] == key for w in warns):
                    warns.append(dict(code='STRIP_CLIPPED', figure=key, value=rows, stage='garment'))
    return codes, warns


def long_static(ctx, figs, keys):
    """A long sleeve's static parts (top/long-sleeve): the sleeve caps keep the basic sleeve's footprint (the
    drawn basic sleeves grown LONG_GROW px) down to LONG_CAP px past the shoulder line, and the torso gives up the arm painting outside the basic shirt's:
    the sleeve down the arm is the strip (arm_strips), which follows the arm; left in a cap, it would stay in the
    cap's place when the arm swings."""
    fz = ctx.fz
    art = M.dilate((fz.clean['arms'][..., 3] > 64) | (fz.layers['arms'][..., 3] > 64), LONG_GROW)
    cap = M.dilate(fz.drawn['sleeves'][..., 3] > 127, LONG_GROW)
    shirt = M.dilate(fz.drawn['shirt'][..., 3] > 127, LONG_GROW)
    near_arm = M.dilate((fz.clean['arms'][..., 3] > 64) | (fz.layers['arms'][..., 3] > 64), LONG_WIDE + LONG_NEAR)
    for key in keys:
        x0, y0, x1, y1 = SG.CELLS[key]
        sl = np.s_[y0:y1, x0:x1]
        J = fz.data[key]['joints']
        yy, xx = np.mgrid[y0:y1, x0:x1]
        for name, p in figs[key]['parts'].items():
            if name.startswith('sleeve'):
                i = int(name[-1])
                S, E = np.array(J['shoulder'][i], float), np.array(J['elbow'][i], float)
                ua = (E - S) / np.linalg.norm(E - S)
                # the cap keeps only the shoulder: LONG_CAP px down the upper arm past the shoulder line, over the
                # strip's top (which starts at that line); below it the strip alone bends with the arm (a cap down
                # to the basic cuff stayed put while the strip swung, a torn edge in a run, 2026-10-16)
                # a profile sleeve starts below the shoulder line (over the torso): it keeps 2 LONG_CAP px from its top
                proj = (xx + .5 - S[0]) * ua[0] + (yy + .5 - S[1]) * ua[1]
                own = (p['a'] > .5) & cap[sl]
                start = float(proj[own].min()) if own.any() else 0.0
                p['a'] = p['a'] * (cap[sl] & (proj < max(LONG_CAP, start + 2 * LONG_CAP)))
            elif name == 'torso':
                p['a'] = p['a'] * ~(art[sl] & ~shirt[sl])
                # what the arm painting cut off the torso (a puffed sleeve's edge, its bow) is the strip's now:
                # pieces apart from the torso's main piece that lie mostly beside the arm (a separate hem band, the
                # hood girl's ribbed hem 1 px under the body, stays: dropping every piece cut it, 2026-10-16)
                p['a'] = drop_arm_pieces(p['a'], near_arm[sl])
                hidden = figs[key].get('hidden', {}).get('torso')
                # front and back only: the profile's arm hides a wide run, whose copy smeared the zipper and the
                # pocket into stripes (jacket, 2026-10-16); there the plain rebuild shows when the arm swings
                if hidden is not None and not key.endswith('right'):
                    knit_rows(p, hidden)


def drop_arm_pieces(a, arm):
    """Pieces of a long sleeve's torso apart from its main piece (more than LONG_NEAR px) and lying mostly
    (over half) beside the arm: cut off it by the arm painting, they stayed on the torso when the arm rose."""
    m = a > .5
    lab_, comps = M.components(m)
    if len(comps) <= 1:
        return a
    big = max(comps, key=lambda c: c['size'])
    grown = M.dilate(lab_ == big['label'], LONG_NEAR)
    drop = np.zeros(m.shape, bool)
    for c in comps:
        comp = lab_ == c['label']
        if c is big or (comp & grown).any() or (comp & arm).sum() * 2 < c['size']:
            continue
        drop |= comp
    return np.where(M.dilate(drop, 1) & ~m | drop, 0, a).astype(np.float32)


def knit_rows(p, hidden):
    """The torso cloth the resting arm hid (fill.py rebuilds it as smooth cloth) shows beside a raised long sleeve:
    on a knit or a print the smooth patch read as a hole in the pattern (2026-10-16). Each row's hidden run that
    meets the visible cloth on one side takes that row's visible cloth just past it (shifted by the run's width
    and KNIT_GAP px), so vertical cables and stripes run on; a run between two hidden ends keeps the rebuild."""
    a, rgb = p['a'], p['rgb']
    vis = (a > .5) & ~hidden
    hid = (a > .5) & hidden
    W = a.shape[1]
    for y in np.nonzero(hid.any(1))[0]:
        row = hid[y]
        xs = np.nonzero(row)[0]
        runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            x0, x1 = int(r[0]), int(r[-1])
            w = x1 - x0 + 1 + KNIT_GAP
            if x1 + 1 < W and vis[y, x1 + 1]:
                src = r + w
            elif x0 - 1 >= 0 and vis[y, x0 - 1]:
                src = r - w
            else:
                continue
            ok = (src >= 0) & (src < W)
            ok[ok] &= vis[y, src[ok]]
            rgb[y, r[ok]] = rgb[y, src[ok]]


def regions_for(slot, view):
    pairs = SCHEMA['x-views'][view]['pairs']
    if slot == 'top':
        names = ['torso'] + ['sleeve%d' % i for i in range(pairs)]
        if pairs == 2:
            names += ['raised0', 'raised1']
        return names
    if slot == 'bottom':
        return ['bottom']
    return ['shoe%d' % i for i in range(pairs)]


def build(sheet, product, sexes=None, date=None, res=None, prod_override=None, kind='chatgpt-sheet', log=print, keys=None):
    """The whole pipeline in memory. Returns a dict with the record, the
    atlas bytes per sex, the codes and every intermediate (for the
    verifier). keys: a subset of the figures (development and the verifier's
    per-figure checks): segmentation, fill, codes and metadata run on those
    only and nothing is packed."""
    t0 = time.time()
    cat, shape, ci = parse_product(product)
    prod = product_entry(cat, shape, prod_override)
    slot = CAT_SLOT[cat]
    cls = prod['class']
    if cls in BUILDER_TODO:
        raise SystemExit('class %s: the game draws it (runtime) but the builder cannot cut it yet (%s)' % (cls, BUILDER_TODO[cls]))
    if cls not in SCHEMA['x-classes']['runtime']:
        raise SystemExit('class %s is reserved: the stage-3 builder makes only %s' % (cls, ', '.join(SCHEMA['x-classes']['runtime'])))
    sexes = tuple(sexes or prod.get('sexes', ('m', 'f')))
    timing = {}
    # the frozen body must be the one the zones, owner map and limits were
    # made from (plan dataModel: build-garment refuses to run on a mismatch)
    problems = frozen_problems()
    if problems:
        raise SystemExit('frozen body mismatch, not building:\n  ' + '\n  '.join(problems))
    if res is None:
        res = R.register(sheet, slot=slot, sexes=sexes, base=prod.get('base'), cover=CLASS_COVER.get(cls, ()))
    if res.get('spec', {}).get('base') != prod.get('base'):
        raise SystemExit('%s is drawn on the %s template, the registration used %s' % (product, prod.get('base') or 'light', res.get('spec', {}).get('base') or 'light'))
    timing['register'] = round(time.time() - t0, 2)
    out = dict(res=res, slot=slot, sexes=sexes, product=product, prod=prod, cat=cat, shape=shape)
    if not res.get('figures') or any(k not in res['figures'] for k in SG.CELLS if k[0] in sexes):
        out['built'] = False
        out['timing'] = timing
        return out
    t = time.time()
    ctx = SG.Context(res, slot, sexes)
    partial = keys is not None and set(keys) != {k for k in SG.CELLS if k[0] in sexes}
    keys = [k for k in SG.CELLS if k[0] in sexes and (keys is None or k in keys)]
    segs = SG.segment(ctx, keys)
    timing['segment'] = round(time.time() - t, 2)
    t = time.time()
    figs = FL.build(ctx, segs)
    if cls == 'shoes/sandals':
        open_shoes(res, figs, keys)
    if cls == 'top/long-sleeve':
        long_static(ctx, figs, keys)
    timing['fill'] = round(time.time() - t, 2)
    t = time.time()
    lcodes, measured = limit_codes(ctx, segs, figs, slot)
    strips = arm_strips(ctx, segs, keys) if cls == 'top/long-sleeve' else None
    if strips is not None:  # the sleeve runs down the arm by design: its strip is checked by its own rules
        lcodes = [c for c in lcodes if c['code'] not in LONG_CODES]
    if cls == 'shoes/sandals':  # an open shoe's opening is below the legs' run by design: the bare foot shows there
        lcodes = [c for c in lcodes if c['code'] in OPEN_SHOE_CODES]
    skin_masks = {}
    ccodes, cwarn, cinfo = colour_codes(ctx, segs, figs, prod, skin_masks)
    scodes, swarn = system_codes(ctx, segs, figs, strips, slot, keys)
    ccodes, cwarn = ccodes + scodes, cwarn + swarn
    timing['codes'] = round(time.time() - t, 2)
    t = time.time()
    crops = crops_of(figs)
    fz = ctx.fz
    meta = {}
    for key in keys:
        view = key.split('-')[1]
        names = [n for n in regions_for(slot, view) if not n.startswith('raised')]
        missing = [n for n in names if (key, n) not in crops]
        if missing:
            meta[key] = dict(error='empty part(s): ' + ', '.join(missing))
            continue
        cr = {n: crops[(key, n)][0] for n in names}
        rc = {n: crops[(key, n)][1] for n in names}
        if slot == 'top':
            meta[key] = MD.top_figure(fz, key, cr, rc)
        elif slot == 'bottom':
            meta[key] = MD.bottom_figure(fz, key, cr['bottom'], rc['bottom'])
        else:
            meta[key] = dict(shoes=MD.shoes_figure(fz, key, cr, rc))
    timing['metadata'] = round(time.time() - t, 2)
    errors = {k: m['error'] for k, m in meta.items() if 'error' in m}
    if slot == 'bottom':
        errors.update({k: m['seatError'] for k, m in meta.items() if 'seatError' in m})
    codes = [c for c in res['codes']] + lcodes + ccodes
    warnings = [w for w in res['warnings']] + cwarn
    out.update(ctx=ctx, segs=segs, figs=figs, crops=crops, meta=meta, measured=measured, colour=cinfo, skinMasks=skin_masks, strips=strips,
               garmentCodes=lcodes + ccodes, garmentWarnings=cwarn, codes=codes, warnings=warnings)
    if errors or partial:
        out['built'] = False
        out['partial'] = partial
        if errors:
            out['errors'] = errors
        out['timing'] = timing
        return out
    t = time.time()
    stem = '%s-%s' % (cat, shape)
    atlases, places = {}, {}
    for sex in sexes:
        rows, regions = [], {}
        for view in VIEWS:
            key = '%s-%s' % (sex, view)
            names = regions_for(slot, view)
            row = []
            for n in names:
                if n.startswith('raised'):
                    i = int(n[-1])
                    crop = meta[key]['sleeves'][i]['raised']
                    rect = crops[(key, 'sleeve%d' % i)][1]
                else:
                    crop, rect = crops[(key, n)]
                regions[(view, n)] = crop
                row.append((n, crop.shape[1], crop.shape[0]))
            if strips is not None:  # the long sleeve's strips (the profile's two arms share one)
                for i in (0, 1):
                    if i == 1 and strips[(key, 1)] is strips[(key, 0)]:
                        continue
                    crop = strips[(key, i)][0]
                    regions[(view, 'arm%d' % i)] = crop
                    row.append(('arm%d' % i, crop.shape[1], crop.shape[0]))
            rows.append((view, row))
        place, size = PK.layout(rows)
        arr = PK.atlas(regions, place, size)
        data = PK.encode_png(arr)
        if not np.array_equal(PK.decode_png(data), arr):
            raise RuntimeError('atlas %s does not decode to its pixels' % sex)
        atlases[sex] = dict(array=arr, bytes=data, place=place, size=size, sha256=sha256_bytes(data))
        places[sex] = place
    record = make_record(out, crops, meta, atlases, measured, figs, sheet, date, kind, stem)
    timing['pack'] = round(time.time() - t, 2)
    timing['total'] = round(time.time() - t0, 2)
    out.update(built=True, record=record, atlases=atlases, stem=stem, timing=timing)
    return out


def make_record(b, crops, meta, atlases, measured, figs, sheet, date, kind, stem):
    cat, shape, slot, prod, sexes = b['cat'], b['shape'], b['slot'], b['prod'], b['sexes']
    gid = '%s:%s' % (cat, shape)
    res = b['res']
    fbody = json.load(open(os.path.join(ROOT, FROZEN_BODY), encoding='utf-8'))
    sexes_out = {}
    for sex in sexes:
        A = atlases[sex]
        figures = {}
        for view in VIEWS:
            key = '%s-%s' % (sex, view)
            F = b['ctx'].fz.data[key]
            at = lambda n: A['place'][(view, n)]  # noqa: E731
            m = meta[key]
            if slot == 'top':
                sleeves = []
                for i, s in enumerate(m['sleeves']):
                    sleeves.append({'rect': crops[(key, 'sleeve%d' % i)][1], 'at': at('sleeve%d' % i),
                                    'raisedAt': at('raised%d' % i) if s['raised'] is not None else None,
                                    'shoulder': F['joints']['shoulder'][i], 'cuff': s['cuff'], 'opening': s['opening'], 'box': s['box']})
                figures[view] = {'top': {'torso': {'rect': crops[(key, 'torso')][1], 'at': at('torso')}, 'sleeves': sleeves,
                                         'underarm': PK.r4(m['underarm']) if m['underarm'] else None,
                                         'hem': PK.r4(m['hem']), 'collar': PK.r4(m['collar'])}}
                if b.get('strips') is not None:  # a long sleeve's strip along each arm (arm_strips)
                    st = b['strips']
                    figures[view]['top']['armSleeves'] = [
                        {'rect': st[(key, i)][1], 'at': at('arm%d' % (0 if i == 1 and st[(key, 1)] is st[(key, 0)] else i))} for i in (0, 1)]
            elif slot == 'bottom':
                B = {'rect': crops[(key, 'bottom')][1], 'at': at('bottom'), 'waistTop': m['waistTop'], 'edgeTone': m['edgeTone'],
                     'cuffAlong': m['cuffAlong']}
                if 'seat' in m:
                    B['seat'] = PK.r4(m['seat'])
                else:
                    B['sideSeat'] = PK.r4(m['sideSeat'])
                figures[view] = {'bottom': B}
            else:
                figures[view] = {'shoes': [{'rect': crops[(key, 'shoe%d' % i)][1], 'at': at('shoe%d' % i), 'ankle': F['joints']['ankle'][i],
                                            'opening': s['opening'], 'sole': s['sole']} for i, s in enumerate(m['shoes'])]}
        sexes_out[sex] = {'atlas': 'assets/sd-garment-%s-%s.png' % (stem, sex), 'size': [A['size'][0], A['size'][1]],
                          'sha256': A['sha256'], 'figures': figures}
    catalog, mirror = {}, {}
    for sex in sexes:
        c = prod['ci'][sex]
        catalog[sex] = {'item': '%s:%d' % (gid, c), 'ci': c, 'name': prod['names'][sex], 'colour': prod['colour'][sex],
                        'display': shop_display(prod, sex), 'legacyIds': []}
        mirror[sex] = bool(prod.get('mirrorSafe', True))
    reg = {}
    for key, fr in res['figures'].items():
        if key[0] in sexes:
            reg[key] = {k: round(float(fr[k]), 5) for k in ('s', 'dx', 'dy', 'residual', 'stableIoU', 'dE')}
    dref = prod.get('designRef')
    dpath = 'assets/garment-template/' + dref if dref else None
    min_margin = {}
    for sex in sexes:
        vals = [mg for k, got in measured.items() if k[0] == sex for _, _, mg in LIM.margins(got) if isinstance(mg, (int, float))]
        min_margin[sex] = round(float(min(vals)), 2) if vals else 0.0
    hidden = [f['info'].get('hiddenPct', 0) for f in figs.values()]
    collar = [v['minMarginPx'] for got in measured.values() for k, v in got.items() if k == 'COLLAR_HIGH']
    codes = sorted({c['code'] for c in b['codes']})
    warns = ['%s: %s' % (w['code'], w.get('detail') or w.get('figure') or '') for w in b['warnings']]
    warns.append('PIPELINE: built by tools/garment/build-garment.py; an automatic pass is not an art approval')
    if slot == 'top':
        warns.append('PROFILE_SLEEVE: the profile sleeve has no raised drawing or underarm (the runtime never raises it)')
    rec = {
        'schema': 1, 'id': gid, 'cat': cat, 'shape': shape, 'slot': slot, 'slots': SCHEMA['x-slots'][slot]['slots'],
        'class': prod['class'], 'status': 'candidate', 'legacy': False, 'legacyComputed': [],
        'bodyArt': 'clean' if slot == 'top' else 'legacy',
        'catalog': catalog, 'mirrorSafe': mirror,
        'source': {
            'kind': kind, 'sheet': {'path': rel(sheet), 'sha256': sha256_file(sheet)}, 'layers': None, 'data': None,
            'template': {'path': rel(R.TEMPLATE_PATHS[prod.get('base')]), 'sha256': sha256_file(R.TEMPLATE_PATHS[prod.get('base')])},
            'designRef': {'path': dpath, 'sha256': sha256_file(os.path.join(ROOT, dpath))} if dpath and os.path.exists(os.path.join(ROOT, dpath)) else None,
            'prompt': None, 'registration': reg, 'bodyFieldsSha256': fbody['bodyFieldsSha256'],
            'builder': builder_id(), 'date': sheet_date(sheet, date),
        },
        'checks': {
            'codes': codes, 'warnings': warns, 'overlap': None,
            'collarMargin': round(float(min(collar)), 2) if collar else None,
            'hiddenRebuiltPct': round(float(np.mean(hidden)), 2) if hidden else None,
            'limits': {'path': LIMITS, 'sha256': sha256_file(os.path.join(ROOT, LIMITS)), 'minMarginPx': min_margin},
        },
        'sexes': sexes_out,
    }
    if prod['class'] == 'shoes/sandals':  # open shoes: the game draws the bare feet under them (open_shoes)
        rec['feet'] = True
    return rec


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------
LABEL_RGB = {1: (40, 170, 60), 2: (220, 0, 220), 3: (255, 150, 0), 4: (0, 0, 0), 5: (255, 0, 0)}


def _font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def label_map(b, path, z=1):
    """Per figure: the registered sheet, the product (green), hidden cloth
    to rebuild (orange), other slot / body (magenta) and the seams (blue)."""
    import seam as S
    U = b['ctx'].U
    tiles = []
    for key, s in b['segs'].items():
        x0, y0, x1, y1 = SG.CELLS[key]
        img = U[y0:y1, x0:x1].copy()
        lab = b['figs'][key]['label'] if key in b.get('figs', {}) else s['label']
        for lab_, col in LABEL_RGB.items():
            m = lab == lab_
            k = .3 if lab_ == 2 else .55
            img[m] = img[m] * (1 - k) + np.array(col) * k
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
        for band, r in zip(s['bands'], s['seams']):
            pts = S.points(band, r)
            if len(pts) > 1:
                d.line([(x - x0, y - y0) for x, y in pts], fill=(0, 60, 255), width=1)
        d.text((4, 4), '%s  %s' % (key, R.FIG_KO.get(key, '')), font=_font(14), fill=(0, 0, 0))
        tiles.append(im)
    W = max(t.width for t in tiles)
    Hh = max(t.height for t in tiles)
    cols = 3
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W, rows * Hh + 28), (255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * W, (i // cols) * Hh + 28))
    ImageDraw.Draw(sheet).text((6, 6), '배포 전 · 라벨: 초록 옷 / 보라 몸·다른 옷 / 주황 가려진 곳(다시 그림) / 검정 옷 밖 새 그림 / 빨강 드러난 피부(그림 없는 몸) / 파랑 경계선',
                               font=_font(15), fill=(30, 30, 30))
    sheet.save(path)
    return path


def skin_sheet(b, path):
    """UNTINTED_SKIN's per-pixel mask (REDTEAM: exported per record as a
    debug picture): the registered sheet per figure with the garment pixels
    the rule counts as left skin in red, the garment outlined in green."""
    tiles = []
    for key, s in b['segs'].items():
        x0, y0, x1, y1 = SG.CELLS[key]
        img = b['ctx'].U[y0:y1, x0:x1].copy() * .6 + 255 * .4
        f = b['figs'][key]
        a = sum((p['a'] for p in f['parts'].values()), np.zeros(s['label'].shape, np.float32)) >= .5
        img[a & ~M.erode(a, 1)] = (40, 170, 60)
        m = b.get('skinMasks', {}).get(key)
        if m is not None:
            img[m] = (255, 0, 0)
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
        ImageDraw.Draw(im).text((4, 4), '%s  %d px' % (key, int(m.sum()) if m is not None else 0), font=_font(14), fill=(0, 0, 0))
        tiles.append(im)
    W = max(t.width for t in tiles)
    Hh = max(t.height for t in tiles)
    rows = (len(tiles) + 2) // 3
    sheet = Image.new('RGB', (3 * W, rows * Hh + 28), (255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 3) * W, (i // 3) * Hh + 28))
    ImageDraw.Draw(sheet).text((6, 6), '배포 전 · 옷 안에 남은 피부색 후보(빨강, UNTINTED_SKIN 규칙) / 초록 옷 테두리', font=_font(15), fill=(30, 30, 30))
    sheet.save(path)
    return path


def parts_sheet(b, path, z=2):
    """Every packed part of every figure over a checkerboard (2x), the raised
    sleeves beside their hanging drawings."""
    tiles = []
    for key in b['segs']:
        view = key.split('-')[1]
        for n in regions_for(b['slot'], view):
            if n.startswith('raised'):
                crop = b['meta'][key]['sleeves'][int(n[-1])]['raised']
            else:
                crop = b['crops'][(key, n)][0]
            h, w = crop.shape[:2]
            chk = np.where(((np.indices((h, w)).sum(0) // 4) % 2)[..., None] == 0, 236, 206).astype(np.float32)
            a = crop[..., 3:] / 255.0
            img = crop[..., :3] * a + chk * (1 - a)
            im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((w * z, h * z), Image.NEAREST)
            tiles.append((key + ' ' + n, im))
    pad = 22
    W = 1600
    x = y = 0
    rowh = 0
    pos = []
    for label, im in tiles:
        if x + im.width > W:
            x, y, rowh = 0, y + rowh + pad + 6, 0
        pos.append((x, y, label, im))
        x += im.width + 10
        rowh = max(rowh, im.height)
    sheet = Image.new('RGB', (W, y + rowh + pad + 30), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    d.text((6, 4), '배포 전 · 부위별 조각(2배)', font=_font(15), fill=(30, 30, 30))
    for x, y, label, im in pos:
        sheet.paste(im, (x, y + pad + 24))
        d.text((x + 2, y + 26), label, font=_font(12), fill=(0, 0, 0))
    sheet.save(path)
    return path


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------
def write(b, out_dir, assets_dir=None, validate=True, log=print):
    """Data file + atlases (assets_dir, default out_dir), images and reports
    (out_dir). Returns the written paths and the validation result."""
    os.makedirs(out_dir, exist_ok=True)
    adir = assets_dir or out_dir
    os.makedirs(adir, exist_ok=True)
    written = {}
    if b.get('built'):
        rec = b['record']
        stem = b['stem']
        for sex, A in b['atlases'].items():
            p = os.path.join(adir, 'sd-garment-%s-%s.png' % (stem, sex))
            with open(p, 'wb') as fh:
                fh.write(A['bytes'])
            written['atlas-' + sex] = p
        p = os.path.join(adir, 'sd-garment-%s.js' % stem)
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(PK.data_js(rec))
        written['data'] = p
        written['labels'] = label_map(b, os.path.join(out_dir, '라벨.png'))
        written['parts'] = parts_sheet(b, os.path.join(out_dir, '부위.png'))
        written['skin'] = skin_sheet(b, os.path.join(out_dir, '피부-후보.png'))
    res = dict(b['res'])
    res['codes'] = b.get('codes', res['codes'])
    res['warnings'] = b.get('warnings', res['warnings'])
    res['ok'] = bool(b['res']['ok'] and not b.get('garmentCodes'))
    rp = RP.report(res, out_dir, b['product'], date=(b['record']['source']['date'] if b.get('built') else None))
    written.update({'report-' + k: rp[k] for k in ('png', 'md', 'json')})
    diag = dict(product=b['product'], built=bool(b.get('built')), errors=b.get('errors'), timing=b.get('timing'),
                codes=[c for c in b.get('garmentCodes', [])], warnings=b.get('garmentWarnings', []),
                colour=b.get('colour'), measured=b.get('measured'),
                fill={k: f['info'] for k, f in b.get('figs', {}).items()},
                seams={k: s['diag'] for k, s in b.get('segs', {}).items()},
                metadata={k: m.get('info') for k, m in b.get('meta', {}).items() if isinstance(m, dict)})
    p = os.path.join(out_dir, '만들기.json')
    with open(p, 'w', encoding='utf-8') as fh:
        json.dump(diag, fh, ensure_ascii=False, indent=1, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    written['diagnostics'] = p
    check = None
    if validate and b.get('built'):
        node = shutil.which('node')
        if node:
            cmd = [node, os.path.join(HERE, 'schema.cjs'), '--builder', '--atlas-dir', adir, written['data']]
            r = subprocess.run(cmd, capture_output=True, text=True)
            check = dict(ok=r.returncode == 0, output=(r.stdout + r.stderr).strip())
        else:
            check = dict(ok=None, output='node not found: run node tools/garment/schema.cjs --builder --atlas-dir DIR FILE')
    return written, check


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('product', help='cat:shape[:ci], e.g. top:shirt:10')
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--out', default='검증', help="검증 (default: 검증/옷/<cat>-<shape>/), assets, or a directory")
    ap.add_argument('--sexes', help='m,f | m | f (default: products.json)')
    ap.add_argument('--date', help='record date (default: the date in the sheet file name, else today)')
    ap.add_argument('--no-validate', action='store_true')
    ap.add_argument('--status', choices=('candidate', 'approved'), default='candidate',
                    help="record status: candidate (studio session only, default) or approved (every foundation "
                         "render: the trial URL ?avatar=foundation; stage 4 pilot)")
    a = ap.parse_args(argv)
    cat, shape, _ = parse_product(a.product)
    stem = '%s-%s' % (cat, shape)
    report_dir = os.path.join(ROOT, '검증', '옷', stem)
    if a.out == '검증':
        out_dir, assets_dir = report_dir, None
    elif a.out == 'assets':
        out_dir, assets_dir = report_dir, os.path.join(ROOT, 'assets')
    else:
        out_dir, assets_dir = os.path.abspath(a.out), None
    b = build(os.path.abspath(a.sheet), a.product, sexes=a.sexes.split(',') if a.sexes else None, date=a.date)
    if b.get('built'):
        b['record']['status'] = a.status
    written, check = write(b, out_dir, assets_dir, validate=not a.no_validate)
    t = b.get('timing', {})
    print('%s: %s in %.1f s (%s)' % (a.product, 'built' if b.get('built') else 'NOT built', t.get('total', t.get('register', 0)),
                                     ', '.join('%s %.1f' % kv for kv in t.items() if kv[0] != 'total')))
    if b.get('errors'):
        for k, e in b['errors'].items():
            print('  %s: %s' % (k, e))
    for c in b.get('codes', []):
        print('  code %s %s %s %s' % (c['code'], c.get('figure') or ','.join(c.get('figures') or []), c.get('part') or '', c.get('value')))
    for w in b.get('warnings', []):
        print('  warn %s %s %s' % (w['code'], w.get('figure') or '', w.get('value')))
    for k, p in written.items():
        print('  %-12s %s' % (k, os.path.relpath(p, ROOT)))
    if check is not None:
        print('  schema: %s' % ('ok' if check['ok'] else ('FAIL' if check['ok'] is False else 'not run')))
        if not check['ok']:
            print('    ' + check['output'].replace('\n', '\n    '))
    if not b.get('built') or (check is not None and check['ok'] is False):
        return 2
    return 1 if b['record']['checks']['codes'] else 0


if __name__ == '__main__':
    sys.exit(main())
