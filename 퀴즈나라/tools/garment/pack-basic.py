"""Pack today's basic outfit into the first three garment records (stage 3, WP2).

The 4 legacy full-sheet layers (assets/sd-foundation-ref-shirt/sleeves/shorts/
shoes.png) are cropped LOSSLESSLY at the integer rects of
assets/sd-foundation-ref-data.js into one atlas per record and sex:

  top:tee        shirt + sleeves  assets/sd-garment-top-tee-{m,f}.png
  bottom:shorts  shorts           assets/sd-garment-bottom-shorts-{m,f}.png
  shoes:sneaker  shoes            assets/sd-garment-shoes-sneaker-{m,f}.png

and one data file per record (assets/sd-garment-<cat>-<shape>.js) that adds
the record to window.QPFoundationGarmentRecords[id]. The records are flagged
legacy: their raised sleeve, underarm, edge tone and side span stay computed
by today's runtime code (WP3 keys it by garment id) until the pipeline
rebuild (WP11) replaces them; SEAT/SIDE_SEAT are copied from
avatar-foundation-outfit.js, the sleeve cuff is (cuff_top - shoulder_y)*k and
the sleeve box is the sleeve mesh canvas (+-4 u).

  python3 tools/garment/pack-basic.py              write the 9 files (refused if the frozen body changed)
  python3 tools/garment/pack-basic.py --check      rebuild in memory and compare with the committed files
  python3 tools/garment/pack-basic.py --preview F  also write a review sheet of the atlases to F
then: node tools/garment/build-index.cjs

Every packed crop is compared RGBA-for-RGBA with the full-layer crop at the
same rect, after encoding and decoding the PNG. The PNGs carry only
IHDR/IDAT/IEND, like the originals. No pixel is resampled or recoloured.
"""
import argparse
import hashlib
import io
import json
import os
import re
import struct
import sys

sys.dont_write_bytecode = True  # no __pycache__ in the repo
TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
from avatar_build import freeze, frozen  # noqa: E402
from avatar_build.common import sha256_file  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = os.path.dirname(TOOLS)
ASSETS = os.path.join(ROOT, 'assets')
SCHEMA = json.load(open(os.path.join(TOOLS, 'garment', 'schema.json'), encoding='utf-8'))
VIEWS = ('front', 'right', 'back')
SEXES = ('m', 'f')
GUTTER = 2  # transparent px around every region in an atlas
DATE = '2026-10-09'  # the day the packed records were defined (kept fixed so --check is stable)
REF_SHEET = 'assets/avatar-reference-candidates/body-study-2026-10-04.png'
LIMITS = 'tools/garment/frozen/limits.json'
FROZEN_BODY = 'tools/garment/frozen/frozen-body.json'

# Shop items of the basic outfit (user decision 2026-10-09: the basic outfit
# is the free starter items). colour = QPGame.getCatalog().curatedItem(cat,
# shape,sex).color; display = what today's student renderer paints
# (QPClothes.colorFor: the male override, else colour). Checked in a demo page
# by tools/verify-garment-catalog.cjs, never by re-parsing index.html.
RECORDS = [
    {'id': 'top:tee', 'class': 'top/short-sleeve', 'slot': 'top', 'layers': ('shirt', 'sleeves'),
     'catalog': {'m': {'item': 'top:tee:5', 'name': '도토리 반팔', 'colour': '#5aa8ff', 'display': '#507c59'},
                 'f': {'item': 'top:tee:3', 'name': '꽃 카라 반팔', 'colour': '#8fd94a', 'display': '#8fd94a'}}},
    {'id': 'bottom:shorts', 'class': 'bottom/shorts', 'slot': 'bottom', 'layers': ('shorts',),
     'catalog': {'m': {'item': 'bottom:shorts:9', 'name': '편한 반바지', 'colour': '#556074', 'display': '#364c76'},
                 'f': {'item': 'bottom:shorts:5', 'name': '반바지', 'colour': '#5aa8ff', 'display': '#5aa8ff'}}},
    {'id': 'shoes:sneaker', 'class': 'shoes/low', 'slot': 'shoes', 'layers': ('shoes',),
     'catalog': {'m': {'item': 'shoes:sneaker:8', 'name': '운동화', 'colour': '#ffffff', 'display': '#ffffff'},
                 'f': {'item': 'shoes:sneaker:8', 'name': '운동화', 'colour': '#ffffff', 'display': '#ffffff'}}},
]
LAYER_FILE = {n: 'assets/sd-foundation-ref-%s.png' % n for n in ('shirt', 'sleeves', 'shorts', 'shoes')}

# ---------------------------------------------------------------------------
# id -> file names (same encoding as tools/garment/schema.cjs filesFor):
# cat [a-z]+, shape [a-z0-9_]+, stem 'cat-shape'.
# ---------------------------------------------------------------------------
ID_RE = re.compile(r'^([a-z]+):([a-z0-9_]+)$')


def stem(gid):
    m = ID_RE.match(gid)
    if not m:
        raise ValueError('garment id must be cat:shape (cat [a-z]+, shape [a-z0-9_]+): %r' % gid)
    return m.group(1) + '-' + m.group(2)


def files_for(gid, sexes=SEXES):
    s = stem(gid)
    out = {'data': 'assets/sd-garment-%s.js' % s}
    for sex in sexes:
        out[sex] = 'assets/sd-garment-%s-%s.png' % (s, sex)
    return out


# ---------------------------------------------------------------------------
# Runtime constants (avatar-foundation-outfit.js), read from the source.
# ---------------------------------------------------------------------------
def js_literal(src, marker):
    i = src.index(marker) + len(marker)
    depth = 0
    for k in range(i, len(src)):
        if src[k] == '{':
            depth += 1
        elif src[k] == '}':
            depth -= 1
            if depth == 0:
                text = src[i:k + 1].replace("'", '"')
                return freeze._js_object(text)
    raise ValueError('unbalanced literal after ' + marker)


def outfit_constants():
    src = open(os.path.join(ROOT, 'avatar-foundation-outfit.js'), encoding='utf-8').read()
    seat = js_literal(src, 'const SEAT=')
    side = js_literal(src, 'const SIDE_SEAT=')
    half = frozen.runtime_constants()['sleeveCanvasHalfU']
    return seat, side, [-half, -half, 2 * half, 2 * half]


# ---------------------------------------------------------------------------
# PNG
# ---------------------------------------------------------------------------
def png_chunks(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    out, i = [], 8
    while i + 8 <= len(data):
        n, kind = struct.unpack('>I4s', data[i:i + 8])
        out.append(kind.decode('latin1'))
        i += 12 + n
        if kind == b'IEND':
            break
    return out if i == len(data) else out + ['<trailing bytes>']


def chunks_ok(chunks):
    return bool(chunks) and chunks[0] == 'IHDR' and chunks[-1] == 'IEND' and len(chunks) > 2 and all(c == 'IDAT' for c in chunks[1:-1])


def encode_png(arr):
    buf = io.BytesIO()
    Image.fromarray(arr, 'RGBA').save(buf, 'PNG', optimize=True)
    data = buf.getvalue()
    if not chunks_ok(png_chunks(data)):
        raise RuntimeError('PIL wrote extra PNG chunks: %s' % png_chunks(data))
    return data


def decode_png(data):
    img = Image.open(io.BytesIO(data))
    if img.mode != 'RGBA':
        raise RuntimeError('atlas is %s, not RGBA' % img.mode)
    return np.asarray(img).copy()


# ---------------------------------------------------------------------------
# Packing
# ---------------------------------------------------------------------------
def regions_for(rec, F, sex, view):
    """(key, layer, rect) of one figure, in atlas row order."""
    pairs = SCHEMA['x-views'][view]['pairs']
    R = F['rects']
    if rec['slot'] == 'top':
        return [('torso', 'shirt', R['shirt'])] + [('sleeve%d' % i, 'sleeves', R['sleeve'][i]) for i in range(pairs)]
    if rec['slot'] == 'bottom':
        return [('bottom', 'shorts', R['shorts'])]
    return [('shoe%d' % i, 'shoes', R['shoe'][i]) for i in range(pairs)]


def check_pairs(F, view):
    """A profile figure has one sleeve and one shoe: both rects and joints are equal."""
    if SCHEMA['x-views'][view]['pairs'] != 1:
        return
    R, J = F['rects'], F['joints']
    for key, a, b in (('sleeve', R['sleeve'][0], R['sleeve'][1]), ('shoe', R['shoe'][0], R['shoe'][1]),
                      ('shoulder', J['shoulder'][0], J['shoulder'][1]), ('ankle', J['ankle'][0], J['ankle'][1])):
        if a != b:
            raise ValueError('%s-%s: profile %s differs between sides (%s vs %s)' % (F['sex'], view, key, a, b))


def pack(rec, data, layers):
    """Atlas arrays and placements per sex."""
    out = {}
    for sex in SEXES:
        rows, y, width = [], GUTTER, 0
        place = {}
        for view in VIEWS:
            F = data['figures']['%s-%s' % (sex, view)]
            check_pairs(F, view)
            x, h = GUTTER, 0
            for key, layer, rect in regions_for(rec, F, sex, view):
                place[(view, key)] = (layer, rect, [x, y])
                x += rect[2] + GUTTER
                h = max(h, rect[3])
            width = max(width, x)
            y += h + GUTTER
        atlas = np.zeros((y, width, 4), np.uint8)
        for (view, key), (layer, (rx, ry, rw, rh), (ax, ay)) in place.items():
            atlas[ay:ay + rh, ax:ax + rw] = layers[layer][ry:ry + rh, rx:rx + rw]
        out[sex] = {'atlas': atlas, 'place': place}
    return out


def compare_crops(atlas, place, layers):
    """Every region of a (decoded) atlas against the full-layer crop: RGBA-equal."""
    bad = []
    for (view, key), (layer, (rx, ry, rw, rh), (ax, ay)) in place.items():
        a = atlas[ay:ay + rh, ax:ax + rw]
        b = layers[layer][ry:ry + rh, rx:rx + rw]
        if a.shape != b.shape or not np.array_equal(a, b):
            bad.append('%s %s' % (view, key))
    # Nothing but the regions: the gutters stay fully transparent zero.
    mask = np.ones(atlas.shape[:2], bool)
    for (layer, (rx, ry, rw, rh), (ax, ay)) in place.values():
        mask[ay:ay + rh, ax:ax + rw] = False
    if atlas[mask].any():
        bad.append('gutter not empty')
    return bad


def min_margins(limits, cls):
    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ('marginPx', 'minMarginPx') and isinstance(v, (int, float)):
                    yield v
                else:
                    yield from walk(v)
    out = {}
    for sex in SEXES:
        vals = [v for view in VIEWS for v in walk(limits['basic']['%s-%s' % (sex, view)].get(cls, {}))]
        out[sex] = min(vals)
    return out


def record_for(rec, data, packed, shas, ctx):
    seat, side, box = ctx['seat'], ctx['side'], ctx['box']
    files = files_for(rec['id'])
    cat, shape = rec['id'].split(':')
    parts = SCHEMA['x-slots'][rec['slot']]['parts']
    computed = [f for p in parts for f in SCHEMA['x-legacyComputed'][p]]
    sexes = {}
    for sex in SEXES:
        place = packed[sex]['place']
        figures = {}
        for view in VIEWS:
            F = data['figures']['%s-%s' % (sex, view)]
            pairs = SCHEMA['x-views'][view]['pairs']
            at = lambda key: place[(view, key)][2]  # noqa: E731
            if rec['slot'] == 'top':
                sleeves = []
                for i in range(pairs):
                    shoulder = F['joints']['shoulder'][i]
                    sleeves.append({'rect': F['rects']['sleeve'][i], 'at': at('sleeve%d' % i), 'raisedAt': None,
                                    'shoulder': shoulder, 'cuff': (F['cuff_top'] - shoulder[1]) * F['k'],
                                    'opening': None, 'box': box})
                figures[view] = {'top': {'torso': {'rect': F['rects']['shirt'], 'at': at('torso')}, 'sleeves': sleeves,
                                         'underarm': None, 'hem': None, 'collar': None}}
            elif rec['slot'] == 'bottom':
                B = {'rect': F['rects']['shorts'], 'at': at('bottom'), 'waistTop': None, 'edgeTone': None, 'cuffAlong': None}
                key = '%s-%s' % (sex, view)
                if SCHEMA['x-views'][view]['seat'] == 'seat':
                    B['seat'] = {k: seat[key][k] for k in ('cut', 'apex', 'cuff', 'rise')}
                else:
                    B['sideSeat'] = {'cut': side[key]['cut'], 'cuff': side[key]['cuff'], 'span': None}
                figures[view] = {'bottom': B}
            else:
                figures[view] = {'shoes': [{'rect': F['rects']['shoe'][i], 'at': at('shoe%d' % i), 'ankle': F['joints']['ankle'][i],
                                            'opening': None, 'sole': None} for i in range(pairs)]}
        h, w = packed[sex]['atlas'].shape[:2]
        sexes[sex] = {'atlas': files[sex], 'size': [w, h], 'sha256': shas[sex], 'figures': figures}
    catalog = {}
    for sex in SEXES:
        c = rec['catalog'][sex]
        catalog[sex] = {'item': c['item'], 'ci': int(c['item'].rsplit(':', 1)[1]), 'name': c['name'],
                        'colour': c['colour'], 'display': c['display'], 'legacyIds': []}
    layers = {n: {'path': LAYER_FILE[n], 'sha256': ctx['frozen']['legacyBasic'][LAYER_FILE[n]]} for n in rec['layers']}
    return {
        'schema': 1, 'id': rec['id'], 'cat': cat, 'shape': shape, 'slot': rec['slot'],
        'slots': SCHEMA['x-slots'][rec['slot']]['slots'], 'class': rec['class'], 'status': 'approved',
        'legacy': True, 'legacyComputed': computed, 'bodyArt': 'legacy',
        'catalog': catalog, 'mirrorSafe': {'m': True, 'f': True},
        'source': {
            'kind': 'legacy-basic',
            'sheet': {'path': REF_SHEET, 'sha256': ctx['frozen']['sources']['sheet']['sha256']},
            'layers': layers,
            'data': {'path': 'assets/sd-foundation-ref-data.js', 'sha256': ctx['frozen']['legacyBasic']['assets/sd-foundation-ref-data.js']},
            'template': None, 'designRef': None, 'prompt': None, 'registration': None,
            'bodyFieldsSha256': ctx['frozen']['bodyFieldsSha256'],
            'builder': 'tools/garment/pack-basic.py', 'date': DATE,
        },
        'checks': {
            'codes': [],
            'warnings': ['LEGACY_PACK: cropped losslessly from today\'s basic layers; raised sleeve, underarm, edge tone and side span stay computed by the runtime until the pipeline rebuild (WP11)',
                         'LEGACY_BODY_ART: fitted over the legacy arm/neck/leg art, whose basic cuff and collar lines a new garment must not expose'],
            'overlap': None, 'collarMargin': None, 'hiddenRebuiltPct': None,
            'limits': {'path': LIMITS, 'sha256': sha256_file(os.path.join(ROOT, LIMITS)), 'minMarginPx': min_margins(ctx['limits'], rec['class'])},
        },
        'sexes': sexes,
    }


def pretty(value, indent=0):
    """JSON with one key per line and short lists of plain values on one line."""
    flat = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    if not isinstance(value, (dict, list)) or (isinstance(value, list) and '{' not in flat and len(flat) <= 100):
        return flat
    pad, inner = ' ' * indent, ' ' * (indent + 1)
    if isinstance(value, list):
        return '[\n' + ',\n'.join(inner + pretty(v, indent + 1) for v in value) + '\n' + pad + ']'
    if not value:
        return '{}'
    return '{\n' + ',\n'.join(inner + json.dumps(k, ensure_ascii=False) + ':' + pretty(v, indent + 1) for k, v in value.items()) + '\n' + pad + '}'


def data_js(record):
    body = pretty(record)
    if json.loads(body) != record:
        raise RuntimeError('pretty() changed the record')
    layers = ', '.join(v['path'] for v in record['source']['layers'].values())
    return ('/* Generated by tools/garment/pack-basic.py (legacy basic outfit, cropped losslessly from\n'
            '   %s). Do not edit; rerun the tool, then tools/garment/build-index.cjs.\n'
            '   Adds the record to window.QPFoundationGarmentRecords[%s] (one registry, one key\n'
            '   per record) and hands it to QPFoundationGarments.define() when the runtime is loaded. */\n'
            "(function(root){\n'use strict';\nconst record=%s;\n"
            'const freeze=o=>{if(o&&typeof o===\'object\'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};\n'
            'const records=root.QPFoundationGarmentRecords||(root.QPFoundationGarmentRecords=Object.create(null));\n'
            'records[record.id]=freeze(record);\n'
            "if(root.QPFoundationGarments&&typeof root.QPFoundationGarments.define==='function')root.QPFoundationGarments.define(records[record.id]);\n"
            "})(typeof window==='undefined'?globalThis:window);\n") % (layers, json.dumps(record['id']), body)


def preview(packed_all, path):
    from PIL import ImageDraw
    scale, pad = 2, 24
    tiles = []
    for rec, packed in packed_all:
        for sex in SEXES:
            a = packed[sex]['atlas']
            h, w = a.shape[:2]
            yy, xx = np.mgrid[0:h, 0:w]
            board = np.where(((yy // 6 + xx // 6) % 2)[..., None] == 0, 236, 206).astype(np.float32).repeat(3, 2)
            al = a[..., 3:4].astype(np.float32) / 255
            rgb = board * (1 - al) + a[..., :3].astype(np.float32) * al
            img = Image.fromarray(rgb.astype(np.uint8)).resize((w * scale, h * scale), Image.NEAREST)
            d = ImageDraw.Draw(img)
            for (layer, rect, (ax, ay)) in packed[sex]['place'].values():
                d.rectangle([ax * scale - 1, ay * scale - 1, (ax + rect[2]) * scale, (ay + rect[3]) * scale], outline=(220, 60, 160))
            tiles.append(('%s %s (%dx%d)' % (rec['id'], sex, w, h), img))
    W = sum(t.width for _, t in tiles) + pad * (len(tiles) + 1)
    H = max(t.height for _, t in tiles) + pad * 2
    sheet = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    x = pad
    for label, t in tiles:
        sheet.paste(t, (x, pad))
        d.text((x, 6), label, fill=(30, 30, 30))
        x += t.width + pad
    sheet.save(path)


def self_test():
    """Each control must be caught: a changed colour level, a lost alpha level,
    a moved region, a filled gutter, an extra PNG chunk, a bad garment id."""
    data = freeze.read_data_js(os.path.join(ASSETS, freeze.DATA_JS))
    layers = {n: np.asarray(Image.open(os.path.join(ROOT, p)).convert('RGBA')).copy() for n, p in LAYER_FILE.items()}
    ok, bad = [], []
    for rec in RECORDS:
        packed = pack(rec, data, layers)
        for sex in SEXES:
            place = packed[sex]['place']
            atlas = decode_png(encode_png(packed[sex]['atlas']))
            (bad if compare_crops(atlas, place, layers) else ok).append('%s %s: round trip is lossless' % (rec['id'], sex))
            (view, key), (layer, rect, at) = sorted(place.items())[0]
            ys, xs = np.nonzero(layers[layer][rect[1]:rect[1] + rect[3], rect[0]:rect[0] + rect[2], 3])
            y, x = at[1] + ys[len(ys) // 2], at[0] + xs[len(xs) // 2]
            for label, change in (('one colour level', lambda a: a.__setitem__((y, x, 0), a[y, x, 0] ^ 1)),
                                  ('one alpha level', lambda a: a.__setitem__((y, x, 3), a[y, x, 3] ^ 1)),
                                  ('gutter pixel', lambda a: a.__setitem__((0, 0, 3), 1))):
                c = atlas.copy()
                change(c)
                (ok if compare_crops(c, place, layers) else bad).append('%s %s: %s caught' % (rec['id'], sex, label))
            moved = dict(place)
            moved[(view, key)] = (layer, rect, [at[0] + 1, at[1]])
            (ok if compare_crops(atlas, moved, layers) else bad).append('%s %s: region moved 1 px caught' % (rec['id'], sex))
    blob = encode_png(packed['m']['atlas'])
    i = blob.index(b'IDAT') - 4
    text = b'tEXtComment\x00x'
    extra = blob[:i] + struct.pack('>I', len(text) - 4) + text + struct.pack('>I', 0) + blob[i:]
    (ok if not chunks_ok(png_chunks(extra)) else bad).append('extra tEXt chunk caught')
    (ok if chunks_ok(png_chunks(blob)) else bad).append('IHDR/IDAT/IEND accepted')
    for gid, want in (('bottom:jean_skirt', 'bottom-jean_skirt'), ('shoes:wing_shoes', 'shoes-wing_shoes'), ('hat:cat_ears', 'hat-cat_ears')):
        (ok if stem(gid) == want and files_for(gid)['m'] == 'assets/sd-garment-%s-m.png' % want else bad).append('file name of %s' % gid)
    for gid in ('top:Tee', 'top:tee-x', 'top-x:y', 'top:tee:5'):
        try:
            stem(gid)
            bad.append('bad id accepted: ' + gid)
        except ValueError:
            ok.append('bad id refused: ' + gid)
    for line in ok:
        print('  ok   ' + line)
    for line in bad:
        print('  FAIL ' + line)
    print('pack-basic self-test: %d passed, %d failed' % (len(ok), len(bad)))
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--check', action='store_true', help='compare with the committed files, write nothing')
    ap.add_argument('--preview', help='write a review sheet of the atlases (PNG) here')
    ap.add_argument('--self-test', action='store_true', help='negative controls of the lossless and chunk checks, write nothing')
    args = ap.parse_args()
    if args.self_test:
        return self_test()

    problems = freeze.check()
    if problems:
        print('pack-basic: the frozen body changed; refusing:\n  ' + '\n  '.join(problems))
        return 2
    data = freeze.read_data_js(os.path.join(ASSETS, freeze.DATA_JS))
    seat, side, box = outfit_constants()
    ctx = {'seat': seat, 'side': side, 'box': box, 'frozen': freeze.load_frozen(),
           'limits': json.load(open(os.path.join(ROOT, LIMITS), encoding='utf-8'))}
    if sha256_file(os.path.join(ROOT, REF_SHEET)) != ctx['frozen']['sources']['sheet']['sha256']:
        print('pack-basic: %s differs from frozen-body.json' % REF_SHEET)
        return 2
    layers = {n: np.asarray(Image.open(os.path.join(ROOT, p)).convert('RGBA')).copy() for n, p in LAYER_FILE.items()}

    failures, packed_all, written = [], [], []
    for rec in RECORDS:
        packed = pack(rec, data, layers)
        packed_all.append((rec, packed))
        files = files_for(rec['id'])
        shas, blobs = {}, {}
        for sex in SEXES:
            target = os.path.join(ROOT, files[sex])
            existing = open(target, 'rb').read() if os.path.exists(target) else None
            # Keep the committed bytes when they already hold exactly these pixels
            # (another zlib would otherwise re-encode the same atlas).
            if existing is not None and chunks_ok(png_chunks(existing)) and np.array_equal(decode_png(existing), packed[sex]['atlas']):
                blob = existing
            elif args.check:
                failures.append('%s: %s' % (files[sex], 'missing' if existing is None else 'pixels or chunks differ from a fresh pack'))
                blob = encode_png(packed[sex]['atlas'])
            else:
                blob = encode_png(packed[sex]['atlas'])
            bad = compare_crops(decode_png(blob), packed[sex]['place'], layers)
            if bad:
                failures.append('%s: crops differ from the full layers: %s' % (files[sex], ', '.join(bad)))
            if not chunks_ok(png_chunks(blob)):
                failures.append('%s: chunks %s' % (files[sex], png_chunks(blob)))
            shas[sex] = hashlib.sha256(blob).hexdigest()
            blobs[sex] = (target, blob, existing)
            n = len(packed[sex]['place'])
            print('%-40s %3dx%-3d %2d regions RGBA-equal to the full-layer crops, chunks %s' % (
                files[sex], packed[sex]['atlas'].shape[1], packed[sex]['atlas'].shape[0], n, '/'.join(sorted(set(png_chunks(blob)), key=png_chunks(blob).index))))
        record = record_for(rec, data, packed, shas, ctx)
        text = data_js(record)
        target = os.path.join(ROOT, files['data'])
        existing = open(target, encoding='utf-8').read() if os.path.exists(target) else None
        if args.check:
            if existing != text:
                failures.append('%s: stale (rerun tools/garment/pack-basic.py)' % files['data'])
        else:
            for sex in SEXES:
                path, blob, old = blobs[sex]
                if old != blob:
                    open(path, 'wb').write(blob)
                    written.append(files[sex])
            if existing != text:
                open(target, 'w', encoding='utf-8').write(text)
                written.append(files['data'])
        print('%-40s %s %s legacy record' % (files['data'], rec['id'], rec['class']))
    if args.preview:
        preview(packed_all, args.preview)
        print('preview: ' + args.preview)
    if failures:
        print('pack-basic: FAIL\n  ' + '\n  '.join(failures))
        return 1
    if args.check:
        print('pack-basic: committed records and atlases match a fresh lossless pack')
    else:
        print('pack-basic: %s' % ('wrote ' + ', '.join(written) if written else 'everything already up to date'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
