"""Frozen-body record and checks (stage 3, WP1).

tools/garment/frozen/frozen-body.json pins what no garment may change:
  - assets/sd-foundation-ref-arms/legs/neck.png (sha256),
  - the body fields of assets/sd-foundation-ref-data.js (view, sex, centre,
    scale k, neck anchor, floor, joints, limb radii, arm/leg/neck rects),
  - SPEC and SPEC_F in avatar-foundation.js (values and literal text),
  - the template geometry (1629x1086, margins 90/91) and its sha256.
The legacy basic outfit layers (shirt/sleeves/shorts/shoes) and the whole
data file are pinned too: today they are one build with the body.
"""
import json
import os
import re

import numpy as np
from PIL import Image

from .common import SHEET, TEMPLATE, sha256_file

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
FROZEN_DIR = os.path.join(ROOT, 'tools', 'garment', 'frozen')
FROZEN_BODY = os.path.join(FROZEN_DIR, 'frozen-body.json')
RUNTIME = os.path.join(ROOT, 'avatar-foundation.js')
TEMPLATE_PATH = os.path.join(ROOT, 'assets', 'garment-template', 'template-sheet.png')
SHEET_PATH = os.path.join(ROOT, 'assets', 'avatar-reference-candidates', 'body-study-2026-10-04.png')
RAW_PATH = os.path.join(ROOT, '기준캐릭터-조사', 'ref', 'measure-raw.json')

BODY_PNGS = ('sd-foundation-ref-arms.png', 'sd-foundation-ref-legs.png', 'sd-foundation-ref-neck.png')
LEGACY_PNGS = ('sd-foundation-ref-shirt.png', 'sd-foundation-ref-sleeves.png', 'sd-foundation-ref-shorts.png',
               'sd-foundation-ref-shoes.png')
DATA_JS = 'sd-foundation-ref-data.js'
BUILD_OUTPUTS = BODY_PNGS + LEGACY_PNGS + (DATA_JS,)
BODY_KEYS = ('view', 'sex', 'center', 'k', 'neck', 'floor', 'joints', 'radii')
BODY_RECTS = ('arm', 'leg', 'neck')


def read_data_js(path):
    text = open(path, encoding='utf-8').read()
    start = text.index('Object.freeze(') + len('Object.freeze(')
    end = text.rindex(');')
    return json.loads(text[start:end])


def body_fields(data):
    out = {}
    for key, F in data['figures'].items():
        rec = {k: F[k] for k in BODY_KEYS}
        rec['rects'] = {k: F['rects'][k] for k in BODY_RECTS}
        out[key] = rec
    return out


def legacy_fields(data):
    return {key: {'cuff_top': F['cuff_top'], 'rects': {k: v for k, v in F['rects'].items() if k not in BODY_RECTS}}
            for key, F in data['figures'].items()}


def canonical_sha(obj):
    import hashlib
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def _js_object(text):
    """A JS object literal of numbers, arrays and identifiers -> dict."""
    t = re.sub(r'([{,])\s*([A-Za-z_$][\w$]*)\s*:', r'\1"\2":', text)
    t = re.sub(r'(?<![\w.])(-?)\.(\d)', r'\g<1>0.\2', t)
    return json.loads(t)


def parse_spec(path=RUNTIME):
    """SPEC and SPEC_F of avatar-foundation.js: literal texts and values."""
    src = open(path, encoding='utf-8').read()
    m = re.search(r'const SPEC=Object\.freeze\((\{.*?\})\);', src)
    mf = re.search(r'const SPEC_F=Object\.freeze\((\{\.\.\.SPEC,(.*?)\})\);', src)
    if not m or not mf:
        raise ValueError('SPEC/SPEC_F literal not found in ' + path)
    spec = _js_object(m.group(1))
    spec_f = dict(spec)
    spec_f.update(_js_object('{' + mf.group(2) + '}'))
    return dict(SPEC=spec, SPEC_F=spec_f, literal=dict(SPEC=m.group(0), SPEC_F=mf.group(0)))


def template_geometry(path=TEMPLATE_PATH, sheet_path=SHEET_PATH):
    """Where the reference sheet sits in the template (over white)."""
    T = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    S = np.asarray(Image.open(sheet_path).convert('RGBA')).astype(np.float64)
    a = S[..., 3:] / 255
    comp = S[..., :3] * a + 255 * (1 - a)
    diffs = {}
    for off in (TEMPLATE['left'] - 1, TEMPLATE['left'], TEMPLATE['left'] + 1):
        diffs[off] = float(np.abs(T[:, off:off + S.shape[1]] - comp).max())
    best = min(diffs, key=diffs.get)
    return dict(size=[T.shape[1], T.shape[0]], left=best, right=T.shape[1] - S.shape[1] - best,
                maxDiff=round(diffs[best], 4), neighbours={str(k): round(v, 2) for k, v in diffs.items()},
                marginsWhite=bool(T[:, :best].min() == 255 and T[:, best + S.shape[1]:].min() == 255))


def make_record(assets_dir=ASSETS, runtime=RUNTIME):
    data = read_data_js(os.path.join(assets_dir, DATA_JS))
    bf = body_fields(data)
    spec = parse_spec(runtime)
    geo = template_geometry()
    return {
        'note': ('Frozen base body (stage 3). Garment builds read this; they never re-derive joints. '
                 'Change only with the user\'s approval: build-reference-body.py --allow-body-change, '
                 'then make-frozen.py --allow-body-change. Checked by tools/garment/verify-body-freeze.py.'),
        'sources': {
            'sheet': {'path': os.path.relpath(SHEET_PATH, ROOT), 'sha256': sha256_file(SHEET_PATH)},
            'measurements': {'path': os.path.relpath(RAW_PATH, ROOT), 'sha256': sha256_file(RAW_PATH)},
            'generator': ['tools/build-reference-body.py', 'tools/avatar_build/body.py', 'tools/avatar_build/cloth.py',
                          'tools/avatar_build/common.py'],
        },
        'files': {'assets/' + n: sha256_file(os.path.join(assets_dir, n)) for n in BODY_PNGS},
        'legacyBasic': {'assets/' + n: sha256_file(os.path.join(assets_dir, n)) for n in LEGACY_PNGS + (DATA_JS,)},
        'bodyFields': bf,
        'bodyFieldsSha256': canonical_sha(bf),
        'legacyFields': legacy_fields(data),
        'spec': {'SPEC': spec['SPEC'], 'SPEC_F': spec['SPEC_F'],
                 'literalSha256': {k: canonical_sha(v) for k, v in spec['literal'].items()}},
        'sheet': dict(SHEET),
        'template': {'path': os.path.relpath(TEMPLATE_PATH, ROOT), 'sha256': sha256_file(TEMPLATE_PATH),
                     'width': TEMPLATE['width'], 'height': TEMPLATE['height'], 'left': TEMPLATE['left'],
                     'right': TEMPLATE['right'], 'measured': geo},
    }


def load_frozen(path=FROZEN_BODY):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def check(assets_dir=ASSETS, frozen=None, runtime=RUNTIME, artifacts=True):
    """Problems (strings) between the current files and the frozen record."""
    problems = []
    frozen = frozen if frozen is not None else load_frozen()
    for rel, sha in list(frozen['files'].items()) + list(frozen['legacyBasic'].items()):
        path = os.path.join(assets_dir, os.path.basename(rel))
        if not os.path.exists(path):
            problems.append(rel + ': missing')
        elif sha256_file(path) != sha:
            problems.append(rel + ': sha256 differs from frozen-body.json')
    data = read_data_js(os.path.join(assets_dir, DATA_JS))
    bf = body_fields(data)
    if canonical_sha(bf) != frozen['bodyFieldsSha256'] or bf != frozen['bodyFields']:
        for key in sorted(set(bf) | set(frozen['bodyFields'])):
            a, b = bf.get(key), frozen['bodyFields'].get(key)
            if a != b:
                diff = [k for k in sorted(set(a or {}) | set(b or {})) if (a or {}).get(k) != (b or {}).get(k)]
                problems.append('body fields of %s differ: %s' % (key, ', '.join(diff)))
    if legacy_fields(data) != frozen['legacyFields']:
        problems.append('legacy garment fields (cuff_top, garment rects) differ')
    spec = parse_spec(runtime)
    for name in ('SPEC', 'SPEC_F'):
        if spec[name] != frozen['spec'][name]:
            changed = [k for k in spec[name] if spec[name].get(k) != frozen['spec'][name].get(k)]
            problems.append('%s differs: %s' % (name, ', '.join(changed)))
        if canonical_sha(spec['literal'][name]) != frozen['spec']['literalSha256'][name]:
            problems.append('%s literal text differs' % name)
    tpl = frozen['template']
    if sha256_file(os.path.join(ROOT, tpl['path'])) != tpl['sha256']:
        problems.append('template-sheet.png sha256 differs')
    if (tpl['left'], tpl['right'], tpl['width']) != (TEMPLATE['left'], TEMPLATE['right'], TEMPLATE['width']):
        problems.append('template margins in frozen-body.json are not 90/91')
    if artifacts:
        for rel, sha in frozen.get('artifacts', {}).items():
            path = os.path.join(ROOT, rel)
            if not os.path.exists(path):
                problems.append(rel + ': missing')
            elif sha256_file(path) != sha:
                problems.append(rel + ': sha256 differs from frozen-body.json (stale frozen artifact)')
    return problems


def compare_outputs(out_dir, frozen_path=FROZEN_BODY):
    """Build outputs in `out_dir` against the frozen sha256 of all 8 files."""
    if not os.path.exists(frozen_path):
        return ['tools/garment/frozen/frozen-body.json missing (run tools/garment/make-frozen.py)']
    frozen = load_frozen(frozen_path)
    pinned = dict(frozen['files']); pinned.update(frozen['legacyBasic'])
    problems = []
    for rel, sha in pinned.items():
        path = os.path.join(out_dir, os.path.basename(rel))
        if not os.path.exists(path):
            problems.append(os.path.basename(rel) + ': not written')
        elif sha256_file(path) != sha:
            problems.append(os.path.basename(rel) + ': sha256 differs')
    return problems
