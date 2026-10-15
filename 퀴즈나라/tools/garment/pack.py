"""Per-sex garment atlases and pipeline records (stage 3, WP6).

Library of tools/garment/build-garment.py (and verify-pipeline.py):

  quantize(part)                 float part {rgb, a} (cell px) -> uint8 RGBA, rect
  layout(regions)                regions per view in atlas row order -> places
  atlas(regions, places)         the atlas array (gutters fully transparent zero)
  encode_png(arr)                deterministic PNG bytes, chunks IHDR/IDAT/IEND only
  record(...)                    the garment record (tools/garment/schema.json)
  data_js(record, builder)       the data file text (adds the record to
                                 window.QPFoundationGarmentRecords[id])

The layout follows tools/garment/pack-basic.py: one row per view (front,
right, back), regions left to right with GUTTER px of transparent zero
around each; a front/back top row holds torso, sleeve0, sleeve1, raised0,
raised1 (the raised drawings share their sleeve's rect). Nothing here reads
the clock or the environment: the same parts give the same bytes.
"""
import io
import json
import struct
import zlib

import numpy as np

VIEWS = ('front', 'right', 'back')
GUTTER = 2


# ---------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------
def quantize(part, cell):
    """(uint8 RGBA crop, [x, y, w, h] sheet rect) of a float part; None when
    it has no pixel. Transparent pixels are zero."""
    a = np.clip(np.round(part['a'] * 255), 0, 255).astype(np.uint8)
    ys, xs = np.nonzero(a)
    if not len(ys):
        return None, None
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    rgb = np.clip(np.round(part['rgb'][y0:y1, x0:x1]), 0, 255).astype(np.uint8)
    out = np.concatenate([rgb, a[y0:y1, x0:x1, None]], -1)
    out[out[..., 3] == 0] = 0
    return out, [cell[0] + x0, cell[1] + y0, x1 - x0, y1 - y0]


# ---------------------------------------------------------------------------
# Atlas
# ---------------------------------------------------------------------------
def layout(rows):
    """rows: [(view, [(name, w, h), ...]), ...] -> ({(view, name): [x, y]}, (W, H))."""
    place, y, width = {}, GUTTER, 0
    for view, regions in rows:
        x, h = GUTTER, 0
        for name, w, hh in regions:
            place[(view, name)] = [x, y]
            x += w + GUTTER
            h = max(h, hh)
        width = max(width, x)
        y += h + GUTTER
    return place, (width, y)


def atlas(crops, place, size):
    W, H = size
    out = np.zeros((H, W, 4), np.uint8)
    for key, (x, y) in place.items():
        c = crops[key]
        out[y:y + c.shape[0], x:x + c.shape[1]] = c
    return out


def _chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)


def encode_png(arr):
    """8-bit RGBA, not interlaced, filter type 0 rows, zlib level 9, one IDAT:
    byte-identical for the same pixels on every run and platform."""
    h, w = arr.shape[:2]
    raw = b''.join(b'\x00' + arr[y].tobytes() for y in range(h))
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + _chunk(b'IHDR', ihdr) + _chunk(b'IDAT', zlib.compress(raw, 9)) + _chunk(b'IEND', b'')


def decode_png(data):
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    if im.mode != 'RGBA':
        raise RuntimeError('atlas is %s, not RGBA' % im.mode)
    return np.asarray(im).copy()


def png_chunks(data):
    out, i = [], 8
    while i + 8 <= len(data):
        n, kind = struct.unpack('>I4s', data[i:i + 8])
        out.append(kind.decode('latin1'))
        i += 12 + n
        if kind == b'IEND':
            break
    return out if i == len(data) else out + ['<trailing bytes>']


# ---------------------------------------------------------------------------
# Record
# ---------------------------------------------------------------------------
def pretty(value, indent=0):
    """JSON with one key per line and short lists of plain values on one line
    (as pack-basic.py)."""
    flat = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    if not isinstance(value, (dict, list)) or (isinstance(value, list) and '{' not in flat and len(flat) <= 100):
        return flat
    pad, inner = ' ' * indent, ' ' * (indent + 1)
    if isinstance(value, list):
        return '[\n' + ',\n'.join(inner + pretty(v, indent + 1) for v in value) + '\n' + pad + ']'
    if not value:
        return '{}'
    return '{\n' + ',\n'.join(inner + json.dumps(k, ensure_ascii=False) + ':' + pretty(v, indent + 1) for k, v in value.items()) + '\n' + pad + '}'


def data_js(record, builder='tools/garment/build-garment.py'):
    body = pretty(record)
    if json.loads(body) != record:
        raise RuntimeError('pretty() changed the record')
    src = record['source']['sheet']['path'] if record['source'].get('sheet') else record['source']['kind']
    return ('/* Generated by %s from %s. Do not edit; rebuild,\n'
            '   then tools/garment/build-index.cjs.\n'
            '   Adds the record to window.QPFoundationGarmentRecords[%s] (one registry, one key\n'
            '   per record) and hands it to QPFoundationGarments.define() when the runtime is loaded. */\n'
            "(function(root){\n'use strict';\nconst record=%s;\n"
            'const freeze=o=>{if(o&&typeof o===\'object\'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};\n'
            'const records=root.QPFoundationGarmentRecords||(root.QPFoundationGarmentRecords=Object.create(null));\n'
            'records[record.id]=freeze(record);\n'
            "if(root.QPFoundationGarments&&typeof root.QPFoundationGarments.define==='function')root.QPFoundationGarments.define(records[record.id]);\n"
            "})(typeof window==='undefined'?globalThis:window);\n") % (builder, src, json.dumps(record['id']), body)


def r4(v):
    if isinstance(v, float):
        return round(v, 4)
    if isinstance(v, list):
        return [r4(x) for x in v]
    if isinstance(v, dict):
        return {k: r4(x) for k, x in v.items()}
    return v
