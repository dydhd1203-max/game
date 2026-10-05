"""Assemble FOUR native panels; image_gen repairs are used at joins only.
Never downsample the native-panel interiors to the editor's overview size.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import distance_transform_edt
import hashlib, json

root=Path(__file__).resolve().parents[1]/'assets/forest-village-library/central-village'
size=(2713,1555)
# Whole illustrated panels remain at native size (NE is registered at1.16).
placements=[
 (1,0,0,1,[(0,0),(1672,0),(1672,941),(0,941)]),
 (2,982,0,1.16,[(1310,0),(2713,0),(2713,1100),(1510,1100),(1510,880),(1590,805),(1590,445),(1320,390)]),
 (3,-50,614,1,[(0,614),(490,675),(775,825),(1050,833),(1080,965),(1622,965),(1622,1555),(0,1555)]),
 (4,1041,614,1,[(1600,955),(1850,1000),(2713,1000),(2713,1555),(1041,1555),(1041,1025)])
]
raw=Image.new('RGB',size);owners=Image.new('L',size)
for n,x,y,k,polygon in placements:
 im=Image.open(root/f'panels/panel-{n}.png').convert('RGB')
 if k!=1:im=im.resize((round(im.width*k),round(im.height*k)),Image.Resampling.LANCZOS)
 layer=Image.new('RGB',size);layer.paste(im,(x,y));mask=Image.new('L',size);ImageDraw.Draw(mask).polygon(polygon,fill=255)
 valid=Image.new('L',size);ImageDraw.Draw(valid).rectangle((max(0,x),max(0,y),min(size[0]-1,x+im.width-1),min(size[1]-1,y+im.height-1)),fill=255)
 mask=Image.fromarray(np.minimum(np.asarray(mask),np.asarray(valid)))
 raw.paste(layer,(0,0),mask);owners.paste(n,(0,0),mask)

# Remove duplicate SW wheel and lower west bridge; only that panel's copies.
owner=np.asarray(owners);keep=np.zeros(owner.shape,np.float32)
for n in range(1,5):
 eligible=owner==n
 if n==3:
  eligible[614:815,:345]=False
  eligible[785:980,715:1050]=False
 # Repairs that move a whole rail/pole must include the whole silhouette;
 # otherwise feathering would leave a translucent duplicate of the old rail.
 for x0,y0,x1,y1 in [(1460,785,1720,1050),(1720,890,2713,1075),(0,600,735,830),(1550,390,1640,700)]:
  eligible[y0:y1,x0:x1]=False
 # Feather inward, never average two mismatched structures across the seam.
 keep=np.maximum(keep,np.clip(distance_transform_edt(eligible)/42,0,1))
alpha=Image.fromarray((keep*255).astype('uint8'))
repair=Image.open(root/'seam-repair.png').convert('RGB').resize(size,Image.Resampling.LANCZOS)
result=Image.composite(raw,repair,alpha);result.save(root/'native-composite.png')
alpha.save(root/'native-panel-mask.png');owners.save(root/'panel-owners.png')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'size':size,'sourcePanels':[{'file':f'panels/panel-{n}.png','sha256':sha(root/f'panels/panel-{n}.png'),'offset':[x,y],'scale':k,'selection':p}for n,x,y,k,p in placements],
 'sourcePixelArea':sum(Image.open(root/f'panels/panel-{n}.png').width*941 for n in range(1,5)),'nativeInteriorPixels':int((keep==1).sum()),'nativeInteriorFraction':float((keep==1).mean()),
 'ownerPixels':{str(n):int(((keep==1)&(owner==n)).sum())for n in range(1,5)},
 'repair':'image_gen seam edit only in joining bands, duplicate-object removals and missing overlap; its1656x950 output is NOT the full runtime map',
 'repairSHA256':sha(root/'seam-repair.png'),'nativeCompositeSHA256':sha(root/'native-composite.png')}
# Local redraws keep their higher pixel density. Untouched areas are explicitly
# resampled2x, not represented as recovered original detail.
density=2;texture=result.resize(tuple(v*density for v in size),Image.Resampling.LANCZOS)
repairs=json.loads((root/'detail-repairs.json').read_text());changed=np.zeros((size[1],size[0]),dtype=bool)
for r in repairs:
 x0,y0,x1,y1=r['rect'];w,h=x1-x0,y1-y0
 patch=Image.open(root/r['file']).convert('RGB').resize((w*density,h*density),Image.Resampling.LANCZOS)
 yy,xx=np.mgrid[:h*density,:w*density]
 edge=np.minimum(np.minimum(xx+1,w*density-xx),np.minimum(yy+1,h*density-yy))
 fade=np.clip(edge/(24*density),0,1)
 if x0==0:fade=np.clip(np.minimum(np.minimum(yy+1,h*density-yy),w*density-xx)/(24*density),0,1)
 if x1==size[0]:fade=np.clip(np.minimum(np.minimum(yy+1,h*density-yy),xx+1)/(24*density),0,1)
 texture.paste(patch,(x0*density,y0*density),Image.fromarray((fade*255).astype('uint8')))
 changed[y0:y1,x0:x1]=True
texture.save(root/'village.webp',quality=98,method=6)
texture.resize(size,Image.Resampling.LANCZOS).save(root/'village.png')
report.update(textureSize=list(texture.size),density=density,detailRepairs=repairs,
 detailRepairFootprintFraction=float(changed.mean()),
 finalUnrepaintedPanelFraction=float(((keep==1)&~changed).mean()),
 sha256=sha(root/'village.webp'),resolutionNote='Four-panel native assembly plus local detailed redraws; untouched areas are2x resampled, not recovered original detail.')
(root/'assembly.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k]for k in ['size','nativeInteriorFraction','ownerPixels','sha256']},indent=2))
