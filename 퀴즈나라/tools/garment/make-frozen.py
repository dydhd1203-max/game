"""Generate the frozen build artifacts every garment build reads (stage 3, WP1).

  python3 tools/garment/make-frozen.py             first generation / no-op when unchanged
  python3 tools/garment/make-frozen.py --check     rebuild into a temp dir, compare byte-for-byte, write nothing
  python3 tools/garment/make-frozen.py --out DIR   write everything into DIR (review / reproducibility)
  python3 tools/garment/make-frozen.py --allow-body-change   overwrite changed artifacts (user approval)

Runs the frozen body build in memory (body mode, ~60 s) to get its trace
(armhole S/A, limb extension rows), checks that it reproduces assets/
byte-for-byte, then writes tools/garment/frozen/* and the rule-generated
clean variants assets/sd-foundation-ref-arms-clean.png and
sd-foundation-ref-neck-clean.png (new files; the legacy layers are never
touched). Fails when the basic outfit misses any limit by less than 2 px or
a pass zone is empty. See tools/avatar_build/frozen.py and limits.py.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import body, freeze, frozen, limits  # noqa: E402
from avatar_build.common import load_rgba, polyline_y, sha256_file  # noqa: E402

ROOT = os.path.dirname(TOOLS)
FROZEN_DIR = os.path.join(ROOT, 'tools', 'garment', 'frozen')
ASSETS = os.path.join(ROOT, 'assets')
CLEAN = {'arms': 'sd-foundation-ref-arms-clean.png', 'neck': 'sd-foundation-ref-neck-clean.png'}
ARTIFACTS = ('owner-map.png', 'zones.json', 'cover-torso.png', 'cover-bottom.png', 'hair-occlusion.png',
             'contact-bands.png', 'limits.json')


def to_jsonable(o):
    if isinstance(o, dict):
        return {str(k): to_jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [to_jsonable(v) for v in o]
    if isinstance(o, np.generic):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    return o


def png_bytes_mask(mask):
    return Image.fromarray((mask.astype(np.uint8) * 255))


def generate(tmp, reuse=None):
    """Everything as {relative name: payload} plus the report. `reuse`: a
    directory holding an earlier build + trace (development only; the
    build outputs are still compared with assets/)."""
    body.enable_body_mode('tools/garment/make-frozen.py')
    import pickle
    if reuse and os.path.exists(os.path.join(reuse, 'trace.pkl')):
        tmp = reuse
        with open(os.path.join(reuse, 'trace.pkl'), 'rb') as fh:
            trace = pickle.load(fh)
        sheet = load_rgba(body.SRC)
    else:
        tmp = reuse or tmp
        os.makedirs(tmp, exist_ok=True)
        trace = {}
        sheet, _ = body.build(tmp, None, trace)
        if reuse:
            with open(os.path.join(reuse, 'trace.pkl'), 'wb') as fh:
                pickle.dump(trace, fh)
    trace = dict(trace)
    figs = trace.pop('_figures')
    problems = [n for n in freeze.BUILD_OUTPUTS if sha256_file(os.path.join(tmp, n)) != sha256_file(os.path.join(ASSETS, n))]
    if problems:
        raise SystemExit('refused: the frozen body build does not reproduce assets/ (%s). '
                         'Run tools/garment/verify-body-freeze.py.' % ', '.join(problems))
    layers = {n: load_rgba(os.path.join(ASSETS, 'sd-foundation-ref-%s.png' % n)) for n in body.LAYERS}
    data = freeze.read_data_js(os.path.join(ASSETS, freeze.DATA_JS))
    rc = frozen.runtime_constants()
    top_alpha = np.maximum(layers['shirt'][..., 3], layers['sleeves'][..., 3]) / 255

    labels = frozen.owner_map(layers, sheet)
    labels, hair_occ = frozen.head_and_hair(labels, figs)
    arms_clean, band_arm, arm_info = frozen.clean_arms(layers['arms'], figs, trace)
    neck_clean, band_neck, neck_info = frozen.clean_neck(layers['neck'], top_alpha, figs, trace)
    band_leg, leg_info = frozen.leg_band(layers['legs'], figs, trace)
    bands = np.zeros(labels.shape, np.uint8)
    bands[band_leg] = frozen.BAND_LABEL['leg']; bands[band_neck] = frozen.BAND_LABEL['neck']; bands[band_arm] = frozen.BAND_LABEL['arm']
    # The clean art must fit the legacy rects (the runtime swaps the image only).
    for key, F in data['figures'].items():
        for name, arr, rect_key in (('arms', arms_clean, 'arm'),):
            rects = F['rects'].get(rect_key)
            if rects is None:
                continue
            rects = rects if isinstance(rects[0], list) else [rects]
            x0, y0, x1, y1 = frozen.CELLS[key]
            inside = np.zeros(labels.shape, bool)
            for r in rects:
                if r:
                    inside[r[1]:r[1] + r[3], r[0]:r[0] + r[2]] = True
            cell = np.zeros(labels.shape, bool); cell[y0:y1, x0:x1] = True
            outside = (arr[..., 3] > 0) & cell & ~inside
            if outside.any():
                raise SystemExit('clean %s of %s leaves its legacy rect (%d px)' % (name, key, outside.sum()))

    # The clean neck reaches NECK_EXTEND px below the legacy one: own rects.
    from avatar_build.common import bbox
    neck_rects = {}
    for key, (x0, y0, x1, y1) in frozen.CELLS.items():
        neck_rects[key] = bbox(neck_clean[y0:y1, x0:x1, 3] / 255, x0, y0, 3)
    geo, measured, zones_pass, report_rows, failures = {}, {}, {}, [], []
    neck_art = neck_clean[..., 3] > 200
    top_vis = np.isin(labels, (1, 2))
    shorts_a = layers['shorts'][..., 3] > 127
    shoes_a = layers['shoes'][..., 3] > 127
    legs_a = layers['legs'][..., 3] > 127
    for key, F in data['figures'].items():
        x0c, _, x1c, _ = frozen.CELLS[key]
        cut = polyline_y(figs[key]['cut'], np.arange(x0c, x1c) + .5)
        g = limits.geometry(key, F, trace[key], layers, neck_clean, labels, rc, cut)
        geo[key] = g
        m_top = limits.measure_top(g, top_vis, band=None, top_region=top_alpha > .5, owners=labels, neck_art=neck_art)
        m_bot = limits.measure_bottom(g, shorts_a, band=None, visible=labels == 4)
        m_sho = limits.measure_shoes(g, shoes_a, legs_a)
        measured[key] = {'top/short-sleeve': m_top, 'bottom/shorts': m_bot, 'shoes/low': m_sho}
        zones_pass[key] = limits.pass_zones(g, band_arm)
        for cls, res in measured[key].items():
            for lim, part, mg in limits.margins(res):
                report_rows.append((key, cls, lim, part, mg))
                if mg is None or mg < limits.MIN_MARGIN:
                    failures.append('%s %s %s %s: basic margin %s px < %s' % (key, cls, lim, part, mg, limits.MIN_MARGIN))
        if m_top.get('NECK_OPEN', {}).get('outsideNeckArtPx'):
            failures.append('%s NECK_OPEN: basic exposes %d px outside the neck art' % (key, m_top['NECK_OPEN']['outsideNeckArtPx']))
        for zname, (lo, hi, width) in zones_pass[key].items():
            if width <= 0 and 'legacy' not in zname:
                failures.append('%s pass zone "%s" is empty (%s..%s)' % (key, zname, lo, hi))

    # Cover masks.
    H, W = labels.shape
    cover_torso = np.zeros((H, W), bool); cover_bottom = np.zeros((H, W), bool)
    body_art = np.zeros((H, W), bool)
    for key, g in geo.items():
        x0, y0, x1, y1 = g['cell']
        for a in g['arms']:
            reg = np.zeros((H, W), bool); reg[a['hiddenRow']:y1, x0:x1] = True
            body_art |= (arms_clean[..., 3] > 127) & reg
        for lg in g['legs']:
            reg = np.zeros((H, W), bool); reg[lg['hiddenRow']:y1, x0:x1] = True
            body_art |= legs_a & reg
    body_art |= frozen.erode(neck_art, 1)
    waist = np.full((H, W), -1.0)
    for key, g in geo.items():
        x0, y0, x1, y1 = g['cell']
        for x, hb, st, armed in g['hem']['columns']:
            wl = st - g['hem']['waistCoverOffsetPx']
            need = wl + g['hem']['overlapU'] / g['k']
            col = np.arange(y0, y1)
            cover_bottom[y0:y1, x] |= (col >= np.floor(wl)) & (col < st)
            waist[y0:y1, x] = need
    rows = np.arange(H)[:, None]
    torso_cut = (waist < 0) | (rows < waist)
    cover_torso = (top_alpha > .5) & ~body_art & torso_cut
    cover_bottom = (cover_bottom | shorts_a) & ~body_art

    lim_json = {
        'note': ('Class limits from body coverage and runtime constants (tools/avatar_build/limits.py). Sheet px. '
                 'The basic outfit must pass each with >= %.0f px; pass zones must be non-empty. Sleeve limits '
                 'assume the clean arm art (pending user approval); with the legacy art GHOST_EDGE applies and '
                 'the legacy pass zone is reported for information.' % limits.MIN_MARGIN),
        'minMarginPx': limits.MIN_MARGIN, 'seamTolerancePx': frozen.SEAM_TOLERANCE, 'runtime': rc,
        'classes': limits.LIMITS, 'basic': measured, 'passZones': zones_pass,
        'artMode': {'arms': 'clean (assets/' + CLEAN['arms'] + ', pending user approval)',
                    'neck': 'clean (assets/' + CLEAN['neck'] + ', pending user approval)',
                    'legs': 'legacy (contact band 3 checked by GHOST_EDGE)'},
    }
    zones_json = {
        'note': 'Frozen zones per figure (tools/avatar_build/limits.py geometry). Sheet px.',
        'labels': frozen.LABELS, 'zOrder': list(frozen.Z_ORDER), 'bandLabels': frozen.BAND_LABEL,
        'figures': geo, 'clean': {'arms': arm_info, 'neck': neck_info, 'neckRects': neck_rects,
                                  'armRects': 'the legacy arm rects (sd-foundation-ref-data.js) hold the clean arms'},
        'legBands': leg_info,
        'template': {'width': 1629, 'height': 1086, 'left': 90, 'right': 91},
    }
    out = {
        'frozen/owner-map.png': Image.fromarray(labels.astype(np.uint8), 'L'),
        'frozen/zones.json': json.dumps(to_jsonable(zones_json), ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n',
        'frozen/cover-torso.png': png_bytes_mask(cover_torso),
        'frozen/cover-bottom.png': png_bytes_mask(cover_bottom),
        'frozen/hair-occlusion.png': png_bytes_mask(hair_occ),
        'frozen/contact-bands.png': Image.fromarray(bands, 'L'),
        'frozen/limits.json': json.dumps(to_jsonable(lim_json), ensure_ascii=False, indent=1, sort_keys=True) + '\n',
        'assets/' + CLEAN['arms']: Image.fromarray(np.clip(arms_clean, 0, 255).astype(np.uint8), 'RGBA'),
        'assets/' + CLEAN['neck']: Image.fromarray(np.clip(neck_clean, 0, 255).astype(np.uint8), 'RGBA'),
    }
    return out, report_rows, failures, zones_pass


def write_item(payload, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if isinstance(payload, str):
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(payload)
    else:
        payload.save(path, optimize=True)


def target_path(rel, out_dir):
    if out_dir:
        return os.path.join(out_dir, rel)
    if rel.startswith('frozen/'):
        return os.path.join(FROZEN_DIR, rel[len('frozen/'):])
    return os.path.join(ROOT, rel)


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--out', help='write all artifacts into this directory instead')
    p.add_argument('--check', action='store_true', help='regenerate into a temp dir and compare; write nothing')
    p.add_argument('--allow-body-change', action='store_true')
    p.add_argument('--quiet', action='store_true')
    p.add_argument('--reuse-build', help=argparse.SUPPRESS)
    args = p.parse_args(argv)
    tmp = tempfile.mkdtemp(prefix='frozen-')
    try:
        items, rows, failures, zones = generate(os.path.join(tmp, 'build'), args.reuse_build)
        stage = os.path.join(tmp, 'stage')
        for rel, payload in items.items():
            write_item(payload, os.path.join(stage, rel))
        if not args.quiet:
            print('basic outfit margins (px, >= %.0f required):' % limits.MIN_MARGIN)
            for key, cls, lim, part, mg in rows:
                print('  %-8s %-17s %-17s %-6s %7s' % (key, cls, lim, part, mg))
            print('pass zones [low, high, width] (px):')
            for key, z in zones.items():
                for name, v in z.items():
                    print('  %-8s %-55s %s' % (key, name, v))
        if failures:
            print('FAIL:\n  ' + '\n  '.join(failures))
            return 1
        changed, missing = [], []
        for rel in items:
            dst = target_path(rel, args.out)
            src = os.path.join(stage, rel)
            if not os.path.exists(dst):
                missing.append(rel)
            elif sha256_file(dst) != sha256_file(src):
                changed.append(rel)
        frozen_json = os.path.join(stage, 'frozen', 'frozen-body.json')
        record = freeze.make_record()
        record['artifacts'] = {('tools/garment/' + rel) if rel.startswith('frozen/') else rel: sha256_file(os.path.join(stage, rel))
                               for rel in sorted(items)}
        record['cleanArt'] = {'status': 'pending user approval (AGENTS.md 2026-10-09: 전후 확대 사진을 보여 주고 승인받은 뒤 적용)',
                              'files': ['assets/' + CLEAN['arms'], 'assets/' + CLEAN['neck']],
                              'legacyKeptFor': 'legacy basic records (top:tee, bottom:shorts, shoes:sneaker) and R0'}
        write_item(json.dumps(record, ensure_ascii=False, indent=1, sort_keys=True) + '\n', frozen_json)
        items['frozen/frozen-body.json'] = None
        dst = target_path('frozen/frozen-body.json', args.out)
        if not os.path.exists(dst):
            missing.append('frozen/frozen-body.json')
        elif sha256_file(dst) != sha256_file(frozen_json):
            changed.append('frozen/frozen-body.json')
        if args.check:
            if changed or missing:
                print('frozen artifacts differ from a fresh build: ' + ', '.join(changed + missing))
                return 1
            print('frozen artifacts reproduced byte-for-byte (%d files)' % len(items))
            return 0
        if changed and not (args.allow_body_change or args.out):
            print('refused: these frozen artifacts would change: %s\n'
                  '  고정 산출물이 바뀝니다. 사용자 승인 뒤 --allow-body-change로 다시 실행하세요.' % ', '.join(changed))
            return 2
        for rel in changed + missing:
            write_item_path = target_path(rel, args.out)
            os.makedirs(os.path.dirname(write_item_path), exist_ok=True)
            shutil.copyfile(os.path.join(stage, rel), write_item_path)
        print('written: ' + (', '.join(changed + missing) if changed or missing else 'nothing (unchanged)'))
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
