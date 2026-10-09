"""Print the class limits, the basic outfit's margin per figure and limit,
and the pass zones; fail on a margin under 2 px or an empty pass zone.

  python3 tools/garment/check-limits.py
  python3 tools/garment/check-limits.py --sheet assets/garment-sources/top-shirt-10-chatgpt-2026-10-09.webp [--images DIR]

--sheet measures a ChatGPT top sheet placed by the global fit (scale
1629/1536, x - 90) with the provisional mask of tools/avatar_build/probe.py,
once against the clean arm/neck art and once against the legacy art
(GHOST_EDGE: legacy contact bands left uncovered). Reads only
tools/garment/frozen/ and assets/; writes images only with --images.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import limits, probe  # noqa: E402
from avatar_build.common import load_rgba  # noqa: E402

ROOT = os.path.dirname(TOOLS)
FZ = os.path.join(ROOT, 'tools', 'garment', 'frozen')
A = os.path.join(ROOT, 'assets')


def load():
    lim = json.load(open(os.path.join(FZ, 'limits.json'), encoding='utf-8'))
    zones = json.load(open(os.path.join(FZ, 'zones.json'), encoding='utf-8'))
    labels = np.asarray(Image.open(os.path.join(FZ, 'owner-map.png')))
    bands = np.asarray(Image.open(os.path.join(FZ, 'contact-bands.png')))
    layers = {n: load_rgba(os.path.join(A, 'sd-foundation-ref-%s.png' % n))
              for n in ('shirt', 'sleeves', 'shorts', 'shoes', 'arms', 'legs', 'neck')}
    neck_clean = load_rgba(os.path.join(A, 'sd-foundation-ref-neck-clean.png'))
    return lim, zones, labels, bands, layers, neck_clean


def basic_report(lim, zones, labels, layers, neck_clean):
    fails = []
    top_a = np.maximum(layers['shirt'][..., 3], layers['sleeves'][..., 3]) > 127
    for key, g in zones['figures'].items():
        got = {'top/short-sleeve': limits.measure_top(g, np.isin(labels, (1, 2)), top_region=top_a, owners=labels,
                                                      neck_art=neck_clean[..., 3] > 200),
               'bottom/shorts': limits.measure_bottom(g, layers['shorts'][..., 3] > 127, visible=labels == 4),
               'shoes/low': limits.measure_shoes(g, layers['shoes'][..., 3] > 127, layers['legs'][..., 3] > 127)}
        if json.loads(json.dumps(got)) != lim['basic'][key]:
            fails.append('%s: basic measurement differs from limits.json (stale frozen artifacts?)' % key)
        for cls, res in got.items():
            for name, part, mg in limits.margins(res):
                flag = 'ok' if mg is not None and mg >= limits.MIN_MARGIN else 'FAIL'
                print('  %-8s %-17s %-17s %-6s %7s px  %s' % (key, cls, name, part, mg, flag))
                if flag == 'FAIL':
                    fails.append('%s %s %s %s margin %s' % (key, cls, name, part, mg))
        for zname, (lo, hi, w) in lim['passZones'][key].items():
            empty = w <= 0
            if empty and 'legacy' not in zname:
                fails.append('%s empty pass zone %s' % (key, zname))
    print('pass zones (px, [low, high, width]); sleeve t along the resting upper arm from the shoulder joint:')
    for key, z in lim['passZones'].items():
        for zname, v in z.items():
            print('  %-8s %-55s %s%s' % (key, zname, v, '  EMPTY' if v[2] <= 0 else ''))
    return fails


def sheet_report(path, lim, zones, labels, bands, layers, neck_clean, images=None):
    rgb, fit = probe.register_global(path)
    alpha = {n: layers[n][..., 3] > 127 for n in layers}
    ref = probe.reference_on_white(load_rgba(os.path.join(A, 'avatar-reference-candidates', 'body-study-2026-10-04.png')))
    M, parts = probe.top_mask(rgb, labels, alpha, zones['figures'], ref)
    top_a = alpha['shirt'] | alpha['sleeves']
    rows, fails = [], []
    print('sheet %s: global fit scale %.5f (expected %.5f), x - %d' % (os.path.relpath(path, ROOT), fit['scale'], fit['expected'], fit['left']))
    for key, g in zones['figures'].items():
        clean = limits.measure_top(g, M, band=None, top_region=top_a, owners=labels, neck_art=neck_clean[..., 3] > 200,
                                   skin=parts['skin'])
        legacy = limits.measure_top(g, M, band=(bands == 1) | (bands == 2), top_region=top_a, owners=labels,
                                    neck_art=layers['neck'][..., 3] > 200, skin=parts['skin'])
        for name, part, mg in limits.margins(clean):
            ok = mg is not None and mg >= 0
            print('  %-8s %-14s %-6s %7s px  %s' % (key, name, part, mg, 'pass' if ok else 'REJECT'))
            if not ok:
                fails.append('%s %s %s %s' % (key, name, part, mg))
        no = clean.get('NECK_OPEN')
        if no:
            print('  %-8s %-14s exposed %d px, outside clean neck art %d px  %s' % (key, 'NECK_OPEN', no['exposedPx'], no['outsideNeckArtPx'],
                                                                                    'pass' if no['outsideNeckArtPx'] == 0 else 'REJECT'))
            if no['outsideNeckArtPx']:
                fails.append('%s NECK_OPEN %d px' % (key, no['outsideNeckArtPx']))
        for part, v in legacy.get('GHOST_EDGE', {}).items():
            print('  %-8s %-14s %-6s legacy arm art: %d of %d band px left visible (clean art: 0)' % (key, 'GHOST_EDGE', part, v['uncoveredPx'], v['bandPx']))
        rows.append((key, clean, legacy))
    if images:
        os.makedirs(images, exist_ok=True)
        over = rgb.copy()
        over[M] = over[M] * .55 + np.array([40, 200, 255]) * .45
        Image.fromarray(np.clip(over, 0, 255).astype(np.uint8)).save(os.path.join(images, 'sheet-top-mask.png'))
    return rows, fails, (rgb, M)


def self_test(zones, labels, layers, neck_clean):
    """Negative controls: edits of the basic top that each limit must catch."""
    key = 'f-front'
    g = zones['figures'][key]
    top_a = np.maximum(layers['shirt'][..., 3], layers['sleeves'][..., 3]) > 127
    base = np.isin(labels, (1, 2))
    neck = neck_clean[..., 3] > 200
    k = g['k']
    a = g['arms'][0]
    sh, ax, nr = np.array(a['shoulder']), np.array(a['axis']), np.array(a['normal'])
    H, W = base.shape
    yy, xx = np.mgrid[0:H, 0:W]
    t = (xx + .5 - sh[0]) * ax[0] + (yy + .5 - sh[1]) * ax[1]
    c = (xx + .5 - sh[0]) * nr[0] + (yy + .5 - sh[1]) * nr[1]
    band = np.abs(c) <= a['re']
    cases = []
    m = base.copy(); m[band & (t > a['tElbow'] - 10) & (t < a['tCap'] + 8)] = True
    cases.append(('sleeve to the elbow cap + 8 px', 'SLEEVE_LONG', m))
    m = base.copy(); m[band & (t > limits.t_hidden(a, 0) - 8) & (t < a['tCap'] + 20)] = False
    cases.append(('sleeve cut 8 px above the clean-art top', 'SLEEVE_SHORT', m))
    m = base.copy()
    for x, hb, st, armed in g['hem']['columns']:
        m[hb - 8:hb + 2, x] = False
    cases.append(('hem raised 8 px', 'HEM_HIGH', m))
    m = base.copy()
    for x, hb, st, armed in g['hem']['columns']:
        m[hb:int(g['hem']['hemLowRow']) + 4, x] = True
    cases.append(('hem lowered past hip + .25 u', 'HEM_LOW', m))
    m = base.copy()
    for x, ub, zone, hid, cut, srow in g['upper']['columns']:
        if zone == 'collar':
            m[int(ub - g['upper']['allowPx'] - 3):ub, x] = True
    cases.append(('collar raised allowance + 3 px', 'COLLAR_HIGH', m))
    m = base.copy()
    for x, ub, zone, hid, cut, srow in g['upper']['columns']:
        if zone == 'cap':
            m[int(srow - g['upper']['allowPx'] - 6):ub, x] = True
    cases.append(('sleeve crown above S - allowance - 6 px', 'CAP_HIGH', m))
    m = base.copy(); cx = int(round(g['center']))
    depth = g['neck']['centerDepthPx']
    ub0 = next(ub for x, ub, *_ in g['upper']['columns'] if x == cx)
    for d in range(depth + 8):
        m[ub0 + d, cx - (depth + 8 - d):cx + (depth + 8 - d)] = False
    cases.append(('V neckline 8 px below the neck art', 'NECK_OPEN', m))
    fails = []
    for name, lim, m in cases:
        got = limits.measure_top(g, m, top_region=top_a, owners=labels, neck_art=neck)
        if lim == 'NECK_OPEN':
            hit = got['NECK_OPEN']['outsideNeckArtPx'] > 0
            val = got['NECK_OPEN']['outsideNeckArtPx']
        else:
            v = got[lim]
            val = v['minMarginPx'] if 'minMarginPx' in v else min(w['marginPx'] for w in v.values())
            hit = val < 0
        print('  %-42s %-12s %8s  %s' % (name, lim, val, 'caught' if hit else 'MISSED'))
        if not hit:
            fails.append('self-test missed: %s (%s)' % (name, lim))
    return fails


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--self-test', action='store_true')
    p.add_argument('--sheet')
    p.add_argument('--images')
    args = p.parse_args(argv)
    lim, zones, labels, bands, layers, neck_clean = load()
    print('limits (tools/garment/frozen/limits.json):')
    for cls, d in lim['classes'].items():
        for name, v in d.items():
            print('  %-17s %-17s %s' % (cls, name, v['rule']))
    rc = lim['runtime']
    print('runtime: seated breath %.2f u, hair-clip allowance %.3f u, floor-sit tube %.2f u, sleeve canvas +-%d u, seam tolerance %d px'
          % (rc['seatedBreathRiseU'], rc['collarAllowU'], rc['floorSitTubeEndU'], rc['sleeveCanvasHalfU'], rc['seamTolerancePx']))
    print('basic outfit margins (>= %.0f px required):' % limits.MIN_MARGIN)
    fails = basic_report(lim, zones, labels, layers, neck_clean)
    if args.self_test:
        print('negative controls (edits of the basic f-front top):')
        fails += self_test(zones, labels, layers, neck_clean)
    if args.sheet:
        _, sheet_fails, _ = sheet_report(os.path.abspath(args.sheet), lim, zones, labels, bands, layers, neck_clean, args.images)
        if sheet_fails:
            print('sheet rejected by: ' + '; '.join(sheet_fails))
    if fails:
        print('FAIL:\n  ' + '\n  '.join(fails))
        return 1
    print('ok: the basic outfit passes every limit with >= %.0f px and every pass zone is non-empty' % limits.MIN_MARGIN)
    return 0


if __name__ == '__main__':
    sys.exit(main())
