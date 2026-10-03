#!/usr/bin/env python3
"""Reproduce runtime crops of reviewed image_gen house edits. No generation.
The provided originals and the generated source sheet remain unchanged.
"""
from pathlib import Path
from PIL import Image
import hashlib, json
LIB=Path(__file__).resolve().parents[1]/'assets/forest-village-library'
manifest=json.loads((LIB/'adaptations.json').read_text())
for asset in manifest['assets']:
    recipe=asset.get('generatedSheet')
    if not recipe:continue
    source=LIB/recipe['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest()==recipe['sha256']
    x,y,w,h=recipe['sourceRect']
    image=Image.open(source).crop((x,y,x+w,y+h)).resize(tuple(recipe['resize']),Image.Resampling.LANCZOS)
    destination=LIB/asset['file'];image.save(destination)
    assert hashlib.sha256(destination.read_bytes()).hexdigest()==asset['sha256'],asset['id']
    print(asset['id'],image.size,'reproduced')
