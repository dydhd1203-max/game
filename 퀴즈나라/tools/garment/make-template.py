"""Rebuild the ChatGPT garment template (image 1) from the reference sheet (stage 3, WP4).

  python3 tools/garment/make-template.py            rebuild in memory and compare with the committed file (writes nothing)
  python3 tools/garment/make-template.py --out F    also write the rebuilt PNG to F (review / reproducibility)
  python3 tools/garment/make-template.py --write    write assets/garment-template/template-sheet.png
                                                    (only when the result is the frozen file, i.e. to restore it)

The template is the approved reference sheet
(assets/avatar-reference-candidates/body-study-2026-10-04.png, RGBA 1448x1086)
composited over white and placed at x = 90 on a 1629x1086 white canvas: 90 px
left and 91 px right, a 3:2 canvas like ChatGPT's 1536x1024 landscape output.
It carries no guide marks, grid, text or coloured zones (ChatGPT repaints what
it sees); the unchanged heads, arms, legs and the basic outfit are the
registration marks and rulers. It is never hand-edited.

Checks: margins 90/91 (tools/avatar_build/common.py TEMPLATE), the sheet's
sha256 and the template's sha256 against tools/garment/frozen/frozen-body.json
(09b4a736...), pixel equality with the committed file, white margins.
The PNG is written by Pillow with optimize=True (zlib level 9, adaptive
filters, 64 KiB IDAT chunks): that reproduces the committed bytes. Another
Pillow/zlib build may compress differently; the pixels must still be equal
and the tool then says so instead of overwriting the frozen file.
"""
import argparse
import hashlib
import io
import json
import os
import sys

import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import freeze  # noqa: E402
from avatar_build.common import SHEET, TEMPLATE  # noqa: E402

ROOT = os.path.dirname(TOOLS)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build(sheet_path=freeze.SHEET_PATH):
    """The template as an RGB image (deterministic)."""
    assert TEMPLATE['left'] == 90 and TEMPLATE['right'] == 91, 'template margins must be 90 left / 91 right'
    src = Image.open(sheet_path).convert('RGBA')
    assert src.size == (SHEET['width'], SHEET['height']), 'reference sheet is %dx%d, expected %dx%d' % (
        src.size + (SHEET['width'], SHEET['height']))
    over_white = Image.new('RGBA', src.size, (255, 255, 255, 255))
    over_white.alpha_composite(src)
    canvas = Image.new('RGB', (TEMPLATE['width'], TEMPLATE['height']), TEMPLATE['background'])
    canvas.paste(over_white.convert('RGB'), (TEMPLATE['left'], 0))
    return canvas


def encode(image):
    buf = io.BytesIO()
    image.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def verify(image, data, record):
    """Problems of a rebuilt template (empty list = identical to the frozen one)."""
    problems = []
    a = np.asarray(image)
    left, right = TEMPLATE['left'], TEMPLATE['width'] - TEMPLATE['left'] - SHEET['width']
    if (left, right) != (90, 91):
        problems.append('margins %d/%d, expected 90/91' % (left, right))
    if a[:, :left].min() != 255 or a[:, left + SHEET['width']:].min() != 255:
        problems.append('side margins are not plain white')
    sheet_sha = freeze.sha256_file(freeze.SHEET_PATH)
    if sheet_sha != record['sources']['sheet']['sha256']:
        problems.append('reference sheet sha256 %s differs from frozen-body.json' % sheet_sha[:12])
    committed = freeze.TEMPLATE_PATH
    if os.path.exists(committed):
        b = np.asarray(Image.open(committed).convert('RGB'))
        if b.shape != a.shape or not np.array_equal(a, b):
            diff = int(np.abs(a.astype(int) - b.astype(int)).max()) if b.shape == a.shape else -1
            problems.append('pixels differ from the committed template (max diff %d)' % diff)
    else:
        problems.append('committed template is missing: ' + os.path.relpath(committed, ROOT))
    want = record['template']['sha256']
    if sha256(data) != want:
        same_pixels = not any(p.startswith('pixels') for p in problems)
        problems.append('PNG sha256 %s != frozen %s%s' % (
            sha256(data)[:12], want[:12],
            ' (pixels equal: this Pillow/zlib build compresses differently; keep the committed file)' if same_pixels else ''))
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', help='also write the rebuilt PNG here')
    ap.add_argument('--write', action='store_true', help='write the committed template (only if it equals the frozen sha)')
    args = ap.parse_args(argv)
    record = freeze.load_frozen()
    image = build()
    data = encode(image)
    problems = verify(image, data, record)
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, 'wb') as fh:
            fh.write(data)
    report = dict(size=list(image.size), left=TEMPLATE['left'], right=TEMPLATE['right'], sha256=sha256(data),
                  frozenSha256=record['template']['sha256'], committed=os.path.relpath(freeze.TEMPLATE_PATH, ROOT),
                  ok=not problems, problems=problems)
    if args.write:
        # Only ever restores the frozen file: a different template is a body
        # change (frozen-body.json, make-frozen.py --allow-body-change).
        report['written'] = sha256(data) == record['template']['sha256']
        if report['written']:
            with open(freeze.TEMPLATE_PATH, 'wb') as fh:
                fh.write(data)
            report['problems'] = problems = verify(image, data, record)
            report['ok'] = not problems
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
