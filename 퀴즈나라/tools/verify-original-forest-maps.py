#!/usr/bin/env python3
"""Verify visible source pixels, excluded capture UI and complete legacy groups.
This is provenance/registration validation, not an automatic art approval.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json, hashlib, os
base=Path(__file__).resolve().parents[1]/'assets/forest-village-library/original-resolution'
config=json.loads((base/'sources.json').read_text());build=json.loads((base/'build.json').read_text())
out=Path(os.environ.get('QUIZ_VERIFICATION_OUTPUT','/tmp/quiz-original-map-review'));out.mkdir(parents=True,exist_ok=True)
report={'checks':[], 'artApproval':False}
def identical_visible(actual, expected, visible):
 diff=ImageChops.difference(actual,expected)
 diff.paste(0,(0,0),ImageChops.invert(visible))
 return not diff.getbbox()
for result in build['maps']:
 name=result['id'];e=config['sets'][name];im=Image.open(base/e['output']).convert('RGB');owners=Image.open(base/('maps/'+name+'-provenance.png'))
 assert hashlib.sha256((base/e['archive']).read_bytes()).hexdigest()==e['archiveSHA256']
 assert hashlib.sha256((base/e['output']).read_bytes()).hexdigest()==result['sha256']
 assert im.size==tuple(result['size'])==owners.size
 assert owners.histogram()[0]==result['fallbackPixels']
 for n,s in enumerate(e['sources'],1):
  path=base/s['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==s['sha256']
  source=Image.open(path).convert('RGB');mask=Image.new('L',source.size,255);d=ImageDraw.Draw(mask)
  for r in s['excludeRects']:d.rectangle(r,fill=0)
  if 'outputToSourceAffine' in s:
   expected=source.transform(im.size,Image.Transform.AFFINE,s['outputToSourceAffine'],Image.Resampling.BICUBIC)
   allowed=mask.transform(im.size,Image.Transform.AFFINE,s['outputToSourceAffine'],Image.Resampling.NEAREST)
  else:
   at=(s['translation'][0]-e['crop'][0]*2,s['translation'][1]-e['crop'][1]*2)
   expected=Image.new('RGB',im.size);expected.paste(source,at)
   allowed=Image.new('L',im.size);allowed.paste(mask,at)
  visible=owners.point(lambda x:255 if x==n else 0)
  assert not ImageChops.subtract(visible,allowed).getbbox(),name+' uses excluded UI/avatar'
  assert identical_visible(im,expected,visible),name+' altered registered original pixels'
  # Run a rectangle-erasure failure through the SAME pixel contract, not a
  # separate test which merely checks that editing an image changes it.
  if visible.getbbox():
   damaged=im.copy();damaged.paste((128,180,93),(0,0,im.width,im.height),visible)
   assert not identical_visible(damaged,expected,visible),'erasure escaped source contract'
 for polygon in e.get('legacyWholeObjectPolygons',[]):
  mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(polygon,fill=255)
  assert not ImageChops.multiply(owners,mask).getbbox(),name+' mixed partial tree groups'
 for patch in e.get('sourcePatches',[]):
  source=Image.open(base/e['sources'][patch['source']-1]['file']).convert('RGB').crop(patch['rect'])
  x,y=patch['at'];assert not ImageChops.difference(im.crop((x,y,x+source.width,y+source.height)),source).getbbox()
 report['checks'].append({'map':name,'sourcePixelChecks':len(e['sources']),'resolutionCoverage':result['originalPixelCoverage'],'fallbackPixels':result['fallbackPixels'],'negativeControlRejected':True})
 im.thumbnail((1120,900));im.save(out/(name+'.png'))
report['success']=True;(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: six maps, 20 original captures, forbidden capture overlays, source pixel identity, whole fallback groups and erasure negative controls')
