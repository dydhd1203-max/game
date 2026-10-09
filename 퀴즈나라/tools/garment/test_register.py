"""Acceptance tests of the registration (stage 3, WP5).

  python3 tools/garment/test_register.py --out DIR [--quick] [--synth DIR]

Runs (plan 'registration' ACCEPTANCE TESTS and WP5 doneWhen):
  constants  template margins 90 left / 91 right (common.TEMPLATE, the
             register module and the measured template-sheet.png)
  identity   template-sheet.png as the upload: every figure |dx|, |dy| <= .1 px
             and |s - 1| <= 5e-4 against the truth (s 1, b (90, 0))
  webp80     the template at 1536x1024 WebP q80 (the ChatGPT path): joint
             error <= 1 px
  drift      s .97/1.03, +-10 px, one figure +2 %/+5 px and -2 %/-5 px, per
             figure +-2.5 %/+-8 px, a square letterboxed page (1536 and, with
             the size gate lowered, 1024), JPEG q70, WebP q60: every figure
             within .3 px of the truth, and the sheet passes
  more       other positives (PNG 1536, brightness +-8 %, transparent PNG,
             off-white page, the product recoloured, specks, one figure
             +4.5 %): pass (warnings allowed where expected), within .3 px
  real       assets/garment-sources/top-shirt-10-chatgpt-2026-10-09.webp:
             every figure <= .6 px and <= .2 % from the global fit, stable dE
             median <= 4 and p95 <= 10, no OTHER_SLOT_CHANGED, the female
             white collar kept by the matte (and lost by a per-pixel
             whiteness test, the control), input recorded as lossy VP8 WebP
             with its ICC
  negatives  every registration-level negative fails with its code, and the
             code has a Korean message and one retry sentence that fill
             without leftover placeholders
  messages   every code the pipeline can raise (register.py, limits.json, the
             plan's lists) is in messages.json
  timing     every registration <= 60 s
  report     등록-보고.png / 보고.md / 보고.json for the real sheet (pass) and
             one failure, written to DIR/reports/

Writes DIR/test-register.json (every number) and DIR/calibration.md (the
measured values per calibration column: PNG and lossy inputs separately).
Exit 0 only if every test passes.
"""
import argparse
import json
import os
import re
import sys
import time

import numpy as np

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
sys.path.insert(0, os.path.join(TOOLS, 'garment'))
from avatar_build import common, freeze  # noqa: E402
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402
import report as REP  # noqa: E402
import synth as SY  # noqa: E402

ROOT = os.path.dirname(TOOLS)
REAL = os.path.join(ROOT, 'assets', 'garment-sources', 'top-shirt-10-chatgpt-2026-10-09.webp')
DRIFT = ['s097', 's103', 'shift+10', 'shift-10', 'fig+2%+5px', 'fig-2%-5px', 'drift', 'pad1536', 'pad1024', 'jpeg70',
         'webp60']
MORE = ['png1536', 'bright+8', 'bright-8', 'alpha', 'offwhite250', 'top-recoloured', 'specks', 'fig+4.5%']
NEGATIVES = ['squash8', 'squash4', 'square', 'fig+8%', 'crop-bottom', 'crop-top', 'blank', 'moved', 'rows-swapped',
             'views-swapped', 'mirrored', 'checkerboard', 'grey', 'shadow', 'text', 'small', 'arm-moved', 'arm-rotated',
             'leg-moved', 'shorts-recoloured', 'skin-tinted', 'female-changed', 'hair-over']
QUICK = ['webp80', 'drift', 'jpeg70', 'arm-moved', 'shorts-recoloured', 'rows-swapped', 'text']
PLAN_CODES = ['SIZE_SMALL', 'BACKGROUND', 'SHADOW', 'FOREIGN_MARK', 'LAYOUT_COUNT', 'LAYOUT_ORDER', 'LAYOUT_MIRROR',
              'SQUASH', 'FIGURE_SCALE', 'BODY_DRIFT', 'POSE_ARM', 'POSE_LEG', 'HAIR_OVER_GARMENT', 'OTHER_SLOT_CHANGED',
              'SINGLE_SEX_CHANGED', 'SLEEVE_LONG', 'SLEEVE_SHORT', 'HEM_HIGH', 'HEM_LOW', 'COLLAR_HIGH', 'NECK_OPEN',
              'SHORTS_SHORT', 'SHORTS_LONG', 'WAIST_VISIBLE', 'SKIRT_LIKE', 'SOLE_OFF_FLOOR', 'SHOE_LOW_OPENING',
              'SHOE_HIGH', 'SHOE_MISSING', 'VIEW_INCONSISTENT', 'COLOUR_OFF', 'UNTINTED_SKIN', 'GHOST_EDGE', 'CAP_HIGH']
LIMIT_SECONDS = 60.0


class Suite:
    def __init__(self):
        self.rows = []
        self.data = {}

    def check(self, name, ok, detail=''):
        self.rows.append((name, bool(ok), detail))
        print('%-4s %-46s %s' % ('ok' if ok else 'FAIL', name, detail))
        return ok


def truth_error(res, truth, spec):
    """Largest anchor distance (sheet px) between each recovered figure and
    the truth, plus the identity numbers (shift at the anchor centroid,
    relative scale)."""
    out = {}
    for k, f in res['figures'].items():
        t = truth[k]
        a = spec['anchors'][k]
        q1 = f['s'] * a + np.array(f['b'])
        q0 = t['s'] * a + np.array(t['b'])
        d = (q1 - q0) / t['s']
        c = a.mean(0)
        dc = ((f['s'] * c + np.array(f['b'])) - (t['s'] * c + np.array(t['b']))) / t['s']
        out[k] = dict(maxPx=float(np.sqrt((d ** 2).sum(1)).max()), dx=float(dc[0]), dy=float(dc[1]),
                      s=float(f['s'] / t['s']))
    return out


def metrics(res):
    figs = res.get('figures') or {}
    m = dict(ok=res['ok'], codes=[c['code'] for c in res['codes']], warnings=[w['code'] for w in res['warnings']],
             seconds=res['timing']['total'], calibration=res['input'].get('calibration'))
    if figs and all('dE' in f for f in figs.values()):
        m.update(dEmedianMax=max(f['dE'] for f in figs.values()), dEp95Max=max(f['dEp95'] for f in figs.values()),
                 stableIoUMin=min(f['stableIoU'] for f in figs.values()),
                 partShiftMax=max((p['shift'] for f in figs.values() for p in f['parts'] if p['part'] != 'torso'),
                                  default=0.0),
                 slotShareMax={n: max((f['slots'][n]['share'] for f in figs.values() if n in f['slots']), default=None)
                               for n in ('bottom', 'shoes', 'top', 'leg', 'arm')})
    return m


def registered(path, meta=None, **kw):
    t = time.time()
    res = R.register(path, slot=(meta or {}).get('slot', 'top'), sexes=tuple((meta or {}).get('sexes', ['m', 'f'])),
                     keep_images=kw.pop('keep_images', False), **kw)
    res['timing']['wall'] = time.time() - t
    return res


def generic_row(path):
    """The boys' row of the WebP q80 upload (top 523 px) registered with a
    one-row spec built by make_spec(): the code path the hair pipeline uses
    (its own template, cells, stable mask and anchors)."""
    from PIL import Image
    g = R.garment_spec('top')
    keys = R.LAYOUT[0]
    spec = R.make_spec('test-row', g['template'], g['templateFg'] & (np.arange(1086)[:, None] < 555),
                       {k: R.CELLS[k] for k in keys}, [keys], {k: g['fit'][k] for k in keys},
                       {k: g['anchors'][k] for k in keys}, (1629, 555), (90, 0))
    im = Image.open(path).convert('RGB')
    crop = im.crop((0, 0, im.width, 523))
    tmp = os.path.join(os.path.dirname(path), '_row-%s.png' % os.path.basename(path))
    crop.save(tmp)
    return R.register(tmp, spec=spec, keep_images=False, min_long_side=1200)


def run(out, synth_dir, quick=False):
    S = Suite()
    os.makedirs(out, exist_ok=True)
    msgs = REP.load_messages()
    spec = R.garment_spec('top')

    # constants ---------------------------------------------------------------
    geo = freeze.template_geometry()
    S.check('constants: template margins 90/91', common.TEMPLATE['left'] == 90 and common.TEMPLATE['right'] == 91
            and geo['left'] == 90 and geo['right'] == 91 and geo['maxDiff'] <= .5,
            'common %d/%d, measured %d/%d (max diff %.3f)' % (common.TEMPLATE['left'], common.TEMPLATE['right'],
                                                              geo['left'], geo['right'], geo['maxDiff']))
    S.check('constants: nominal 1536 transform', abs(R.nominal_transform(spec, (1536, 1024))[0] - 1536 / 1629) < 1e-12)

    # synthetic set -------------------------------------------------------------
    names = ['identity', 'webp80'] + DRIFT + MORE + NEGATIVES
    if quick:
        names = ['identity'] + QUICK
    os.makedirs(synth_dir, exist_ok=True)
    metas = {}
    for n in names:
        tj = os.path.join(synth_dir, '%s.%s.truth.json' % (n, {'png': 'png', 'webp': 'webp', 'jpeg': 'jpg'}[SY.VARIANTS[n][1]]))
        if not os.path.exists(tj):
            SY.build(n, synth_dir)
        metas[n] = json.load(open(tj, encoding='utf-8'))
        metas[n]['path'] = os.path.join(synth_dir, metas[n]['file'])

    times = {}
    calib = {}
    # identity -------------------------------------------------------------------
    res = registered(metas['identity']['path'], metas['identity'])
    times['identity'] = res['timing']['total']
    e = truth_error(res, metas['identity']['figures'], spec)
    worst = max(max(abs(v['dx']), abs(v['dy'])) for v in e.values())
    sworst = max(abs(v['s'] - 1) for v in e.values())
    S.check('identity: |dx|,|dy| <= .1 px, |s-1| <= 5e-4', res['ok'] and worst <= .1 and sworst <= 5e-4,
            'max |d| %.3f px, max |s-1| %.1e' % (worst, sworst))
    S.data['identity'] = dict(errors=e, metrics=metrics(res))
    calib['identity'] = metrics(res) | dict(truthMaxPx=max(v['maxPx'] for v in e.values()))

    # webp80 and drift -------------------------------------------------------------
    for n in ['webp80'] + [x for x in DRIFT + MORE if x in names]:
        meta = metas[n]
        res = registered(meta['path'], meta)
        times[n] = res['timing']['total']
        limit = 1.0 if n == 'webp80' else .3
        if meta['expect'] == 'pass':
            e = truth_error(res, meta['figures'], spec) if res['figures'] else {}
            err = max((v['maxPx'] for v in e.values()), default=float('inf'))
            warn_ok = set(meta.get('warn') or []) <= set(w['code'] for w in res['warnings'])
            S.check('%s: pass, joint error <= %.1f px' % (n, limit), res['ok'] and err <= limit and warn_ok,
                    'err %.3f px, codes %s, warnings %s' % (err, [c['code'] for c in res['codes']],
                                                         [w['code'] for w in res['warnings']]))
            S.data[n] = dict(errors=e, metrics=metrics(res))
            calib[n] = metrics(res) | dict(truthMaxPx=err)
        else:
            got = [c['code'] for c in res['codes']]
            S.check('%s: size gate %s' % (n, meta['expect']), all(c in got for c in meta['expect']), 'codes %s' % got)
            if meta.get('precision'):
                r2 = registered(meta['path'], meta, min_long_side=meta['precision'])
                times[n + '@precision'] = r2['timing']['total']
                e = truth_error(r2, meta['figures'], spec)
                err = max(v['maxPx'] for v in e.values())
                S.check('%s: registered below the size gate, <= .3 px' % n, r2['ok'] and err <= .3,
                        'err %.3f px (gate lowered to %d px)' % (err, meta['precision']))
                S.data[n] = dict(errors=e, metrics=metrics(r2))
                calib[n] = metrics(r2) | dict(truthMaxPx=err)

    # real sheet -------------------------------------------------------------------
    res = registered(REAL, keep_images=True)
    times['real'] = res['timing']['total']
    figs = res['figures']
    maxpx = max(f['maxPx'] for f in figs.values())
    srel = max(abs(f['sRel'] - 1) for f in figs.values())
    S.check('real: <= .6 px and <= .2 % from the global fit', maxpx <= .6 and srel <= .002,
            'max %.3f px, max |s-1| %.4f%%' % (maxpx, 100 * srel))
    dmed = max(f['dE'] for f in figs.values()); dp95 = max(f['dEp95'] for f in figs.values())
    S.check('real: stable dE median <= 4, p95 <= 10', dmed <= 4 and dp95 <= 10, 'max median %.2f, max p95 %.2f' % (dmed, dp95))
    S.check('real: no OTHER_SLOT_CHANGED, passes', res['ok'] and not any(c['code'] == 'OTHER_SLOT_CHANGED' for c in res['codes']),
            'codes %s; shorts share max %.3f (limit %.2f)' % ([c['code'] for c in res['codes']],
                                                          max(f['slots']['bottom']['share'] for f in figs.values()),
                                                          R.T['slotShare']['bottom']))
    col = res['matte']['collar']
    S.check('real: female white collar kept by the matte', col['whitePx'] >= 1000 and col['keptShare'] >= .98,
            '%d white collar px, kept %.1f%%' % (col['whitePx'], 100 * col['keptShare']))
    # control: a per-pixel whiteness matte (the threeway prototype's rule),
    # resampled with the same fits, keeps almost none of the collar
    up = res['images']['upload']
    alt = (~M.near_white(up, res['matte']['level'])).astype(np.float32)
    _, alt_a = R.resample(up, alt, {k: dict(s=f['s'], b=f['b']) for k, f in res['figures'].items()}, spec)
    alt_col = R.collar_kept(res['images']['registered'][..., :3], alt_a, spec, res['matte']['level'])
    S.check('real: control, a per-pixel whiteness matte loses it', alt_col['keptShare'] is not None and alt_col['keptShare'] < .2,
            'whiteness matte keeps %.1f%% of %d px' % (100 * (alt_col['keptShare'] or 0), alt_col['whitePx']))
    rec = res['input']
    S.check('real: input recorded (format, encoder, ICC, calibration)',
            rec['format'] == 'webp' and rec['encoder']['codec'] == 'VP8 (lossy)' and rec['icc']['description'] == 'sRGB'
            and rec['calibration'] == 'lossy' and rec['sha256'].startswith('64f7804b'),
            '%s %s, ICC %s (%s), %s, sha %s' % (rec['format'], rec['encoder']['codec'], rec['icc']['description'],
                                                rec['icc']['copyright'], rec['calibration'], rec['sha256'][:12]))
    S.data['real'] = dict(result=R.summary(res), metrics=metrics(res))
    calib['real top:shirt:10'] = metrics(res) | dict(globalVsNominal=res['global']['vsNominal'], collar=col)
    rep_dir = os.path.join(out, 'reports')
    r_pass = REP.report(res, os.path.join(rep_dir, 'real-top-shirt-10'), 'top:shirt:10')
    S.check('report: pass report written', os.path.exists(r_pass['png']) and not any(i['level'] == 'fail' for i in r_pass['items']),
            r_pass['png'])

    # negatives ---------------------------------------------------------------------
    first_fail = None
    for n in [x for x in NEGATIVES if x in names]:
        meta = metas[n]
        res = registered(meta['path'], meta, keep_images=(n == 'arm-moved'))
        times[n] = res['timing']['total']
        got = [c['code'] for c in res['codes']]
        items = REP.describe(res, msgs)
        texts_ok = all(i['message'] and '{' not in i['message'] and (i['level'] != 'fail' or (i['retry'] and '{' not in i['retry']))
                       for i in items)
        has = all(c in got for c in meta['expect'])
        S.check('negative %s -> %s' % (n, '/'.join(meta['expect'])), has and not res['ok'] and texts_ok,
                'codes %s | %s | "%s"' % (got, items[0]['message'] if items else '', items[0]['retry'] if items else ''))
        S.data[n] = dict(codes=res['codes'], items=items, metrics=metrics(res))
        if n == 'arm-moved':
            first_fail = REP.report(res, os.path.join(rep_dir, 'neg-arm-moved'), 'top:shirt:10')
    if first_fail:
        S.check('report: fail report written', os.path.exists(first_fail['png']) and any(i['level'] == 'fail' for i in first_fail['items']),
                first_fail['png'])

    # other product slots and a generic (one-row) spec ------------------------------------
    if not quick:
        for n, slot, expect in (('identity', 'bottom', 'pass'), ('identity', 'shoes', 'pass'),
                                ('shorts-recoloured', 'bottom', 'pass'), ('top-recoloured', 'bottom', 'OTHER_SLOT_CHANGED'),
                                ('top-recoloured', 'shoes', 'OTHER_SLOT_CHANGED')):
            meta = dict(metas[n]); meta['slot'] = slot
            res = registered(meta['path'], meta)
            times['%s@%s' % (n, slot)] = res['timing']['total']
            got = [c['code'] for c in res['codes']]
            ok = res['ok'] if expect == 'pass' else (expect in got and all(
                c.get('part') == 'top' for c in res['codes'] if c['code'] == 'OTHER_SLOT_CHANGED'))
            S.check('slot %s: %s -> %s' % (slot, n, expect), ok, 'codes %s' % got)
        res = generic_row(metas['webp80']['path'])
        e = truth_error(res, metas['webp80']['figures'], spec)
        err = max(v['maxPx'] for v in e.values())
        times['generic-row'] = res['timing']['total']
        S.check('shared code: a one-row spec (make_spec) registers <= .3 px', res['ok'] and len(e) == 3 and err <= .3,
                'figures %s, err %.3f px' % (sorted(e), err))

    # messages ------------------------------------------------------------------------
    src = open(os.path.join(TOOLS, 'avatar_build', 'register.py'), encoding='utf-8').read()
    raised = set(re.findall(r"code='([A-Z_]+)'", src)) | set(re.findall(r"code = '([A-Z_]+)'", src))
    limits = json.load(open(os.path.join(TOOLS, 'garment', 'frozen', 'limits.json'), encoding='utf-8'))
    lim_codes = {c for cls in limits['classes'].values() for c in cls}
    needed = raised | lim_codes | set(PLAN_CODES) | {'W_SCALE', 'W_POSE', 'W_SPECKS'}
    missing = sorted(c for c in needed if c not in msgs['codes'])
    bad = sorted(c for c, v in msgs['codes'].items() if not v.get('message') or not v.get('title')
                 or (v['level'] == 'fail' and not v.get('retry')))
    S.check('messages: every code has a Korean message and a retry sentence', not missing and not bad,
            '%d codes; missing %s; incomplete %s' % (len(msgs['codes']), missing, bad))

    # timing ----------------------------------------------------------------------------
    slow = {k: v for k, v in times.items() if v > LIMIT_SECONDS}
    S.check('timing: every sheet <= 60 s', not slow, 'max %.1f s (%s)' % (max(times.values()), max(times, key=times.get)))
    S.data['times'] = times

    # outputs ------------------------------------------------------------------------------
    passed = all(ok for _, ok, _ in S.rows)
    with open(os.path.join(out, 'test-register.json'), 'w', encoding='utf-8') as fh:
        json.dump(dict(passed=passed, checks=[dict(name=n, ok=o, detail=d) for n, o, d in S.rows], data=S.data,
                       thresholds=R.T), fh, ensure_ascii=False, indent=1,
                  default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    write_calibration(os.path.join(out, 'calibration.md'), calib)
    print('\n%s: %d/%d checks passed' % ('PASS' if passed else 'FAIL', sum(o for _, o, _ in S.rows), len(S.rows)))
    return passed


def write_calibration(path, calib):
    L = ['# Registration calibration (generated by tools/garment/test_register.py)', '',
         'Thresholds: stable dE median <= %.0f / p95 <= %.0f, silhouette IoU >= %.2f, part shift pass <= %.1f / fail > %.1f px, '
         'slot share limits %s, joint error vs truth <= .3 px (drift) / 1 px (WebP q80).' % (
             R.T['stableDEMedian'], R.T['stableDEP95'], R.T['stableIoU'], R.T['partPass'], R.T['partWarn'],
             R.T['slotShare']), '']
    for column in ('png', 'lossy'):
        L.append('## %s inputs' % ('PNG (lossless)' if column == 'png' else 'Lossy (WebP / JPEG)'))
        L.append('')
        L.append('| input | joint err vs truth px | dE median max | dE p95 max | IoU min | part shift max | shorts share max | shoes share max | s |')
        L.append('|---|---|---|---|---|---|---|---|---|')
        for n, m in calib.items():
            if m.get('calibration') != column or 'dEmedianMax' not in m:
                continue
            ss = m.get('slotShareMax') or {}
            L.append('| %s | %s | %.2f | %.2f | %.3f | %.2f | %s | %s | %.1f |' % (
                n, ('%.3f' % m['truthMaxPx']) if 'truthMaxPx' in m else '-', m['dEmedianMax'], m['dEp95Max'],
                m['stableIoUMin'], m['partShiftMax'], ss.get('bottom'), ss.get('shoes'), m['seconds']))
        L.append('')
    L.append('No real lossless ChatGPT sheet exists yet: the PNG column holds the template and synthetic inputs only. '
             'The real top:shirt:10 sheet is a lossy VP8 WebP with a Google sRGB ICC (a browser or preview save), so its '
             'numbers sit in the lossy column; ask the user once for the original PNG.')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=os.path.join(ROOT, '검증', '옷', '등록-시험'))
    ap.add_argument('--synth', help='synthetic sheets (default OUT/synth; made when missing)')
    ap.add_argument('--quick', action='store_true')
    a = ap.parse_args(argv)
    ok = run(a.out, a.synth or os.path.join(a.out, 'synth'), a.quick)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
