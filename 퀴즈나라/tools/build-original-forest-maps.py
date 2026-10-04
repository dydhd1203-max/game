#!/usr/bin/env python3
"""Register and stitch the user's 100% screenshots without redrawing their art.

Only Pillow is required for rebuilding. Offsets were measured independently
with SIFT and fixed-translation inliers, then rounded to source pixel positions.
The provenance image records which screenshot supplies every rendered pixel.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

LIB = Path(__file__).resolve().parents[1] / 'assets/forest-village-library'
BASE = LIB / 'original-resolution'
config = json.loads((BASE / 'sources.json').read_text())
report = {'policy': config['policy'], 'maps': []}

for name, entry in config['sets'].items():
    if entry['status'] != 'active':
        continue
    x, y, w, h = entry['crop']
    old = Image.open(LIB / entry['fallback']).convert('RGB')
    if entry['fallback'].startswith('originals/'):
        old = old.crop((x, y, x+w, y+h))
    canvas = old.resize((w*2, h*2), Image.Resampling.LANCZOS)
    owners = Image.new('L', canvas.size)
    # Stable priority, no blended/doubled leaves. Overlapping clean pictures
    # supply the exact hidden scenery below another screenshot's service UI.
    for number, source in enumerate(entry['sources'], 1):
        file = BASE / source['file']
        assert hashlib.sha256(file.read_bytes()).hexdigest() == source['sha256']
        im = Image.open(file).convert('RGB')
        mask = Image.new('L', im.size, 255)
        draw = ImageDraw.Draw(mask)
        for rect in source['excludeRects']:
            draw.rectangle(rect, fill=0)
        dx, dy = source['translation']
        at = (dx-x*2, dy-y*2)
        if 'outputToSourceAffine' in source:
            affine = source['outputToSourceAffine']
            im = im.transform(canvas.size, Image.Transform.AFFINE, affine, Image.Resampling.BICUBIC)
            mask = mask.transform(canvas.size, Image.Transform.AFFINE, affine, Image.Resampling.NEAREST)
            at = (0, 0)
        canvas.paste(im, at, mask)
        owners.paste(Image.new('L', im.size, number), at, mask)
    for polygon in entry.get('legacyWholeObjectPolygons', []):
        mask = Image.new('L', canvas.size)
        ImageDraw.Draw(mask).polygon(polygon, fill=255)
        canvas.paste(old.resize(canvas.size, Image.Resampling.LANCZOS), (0, 0), mask)
        owners.paste(0, (0, 0), mask)
    for patch in entry.get('sourcePatches', []):
        source = entry['sources'][patch['source']-1]
        im = Image.open(BASE / source['file']).convert('RGB').crop(patch['rect'])
        canvas.paste(im, patch['at'])
        owners.paste(Image.new('L', im.size, 128+patch['source']), patch['at'])
    target = BASE / entry['output']
    canvas.save(target, optimize=True)
    owners.save(target.with_name(name+'-provenance.png'), optimize=True)
    counts = owners.histogram()
    total = w*h*4
    result = {'id': name, 'file': entry['output'], 'size': list(canvas.size),
              'logicalSize': [w, h], 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
              'originalPixelCoverage': round(1-counts[0]/total, 6),
              'fallbackPixels': counts[0], 'sourcePixels': counts[1:len(entry['sources'])+1],
              'repositionedSourcePixels': sum(counts[128:])}
    report['maps'].append(result)
    print(name, canvas.size, '100% source coverage', result['originalPixelCoverage'])
(BASE / 'build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
