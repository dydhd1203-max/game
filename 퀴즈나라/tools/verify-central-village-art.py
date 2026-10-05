"""Guard against replacing the four detailed panels with an enlarged overview.
Pixel checks cover native interiors; seam/whole-object quality still needs art review.
"""
from pathlib import Path
from PIL import Image
import json, hashlib
import numpy as np
root=Path(__file__).resolve().parents[1]/'assets/forest-village-library/central-village'
a=json.loads((root/'assembly.json').read_text());p=json.loads((root/'provenance.json').read_text())
sha=lambda f:hashlib.sha256((root/f).read_bytes()).hexdigest()
assert sha('village.webp')==a['sha256']==p['sha256']
assert Image.open(root/'village.webp').size==(5426,3110)
assert sha('native-composite.png')==a['nativeCompositeSHA256']
for repair in a['detailRepairs']:assert sha(repair['file'])==repair['sha256']
im=Image.open(root/'native-composite.png').convert('RGB');assert im.size==(2713,1555)
assert im.width*im.height>2.6*1672*941
mask=np.asarray(Image.open(root/'native-panel-mask.png'));owner=np.asarray(Image.open(root/'panel-owners.png'));actual=np.asarray(im)
checks={}
for panel in a['sourcePanels']:
 f=panel['file'];assert sha(f)==panel['sha256'];n=int(Path(f).stem[-1]);src=Image.open(root/f).convert('RGB');assert src.size==((1671,941) if n==2 else (1672,941))
 if panel['scale']!=1:src=src.resize(tuple(round(v*panel['scale'])for v in src.size),Image.Resampling.LANCZOS)
 ys,xs=np.where((mask==255)&(owner==n));assert len(xs)>500000
 ox,oy=panel['offset'];expected=np.asarray(src)[ys-oy,xs-ox]
 assert np.array_equal(actual[ys,xs],expected),f+' native pixels changed'
 checks[n]=len(xs)
for original in p['originals']:assert sha(original['file'])==original['sha256']
from scipy.ndimage import label
labels,_=label(actual.max(axis=2)==0)
assert np.bincount(labels.ravel())[1:].max(initial=0)<8,'Unfilled black seam'
print(json.dumps({'success':True,'size':im.size,'nativePixelsByPanel':checks,'nativeInteriorFraction':float((mask==255).mean()),'originalHashes':'all preserved'},indent=2))
