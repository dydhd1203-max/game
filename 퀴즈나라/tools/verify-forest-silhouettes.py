#!/usr/bin/env python3
"""Source-aware regression for severed objects; not a universal art classifier.
Output stays outside the repo when QUIZ_VERIFICATION_OUTPUT is supplied.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import hashlib, json, os
ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/'assets/forest-village-library'
OUT=Path(os.environ.get('QUIZ_VERIFICATION_OUTPUT',str(ROOT/'검증/숲마을-윤곽')))
OUT.mkdir(parents=True,exist_ok=True)
records=json.loads((LIB/'extractions.json').read_text())['assets']
fixtures=json.loads((ROOT/'tools/forest-silhouette-fixtures.json').read_text())['protected']
checks=[];review=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def differences(a,b):
    channels=ImageChops.difference(a,b).split();result=channels[0]
    for channel in channels[1:]:result=ImageChops.lighter(result,channel)
    return result.getbbox()
def box(r):x,y,w,h=r;return (x,y,x+w,y+h)
def protected_failures(im,original,record):
    ox,oy,_,_=record['sourceRect'];bad=[]
    for f in fixtures.get(record['id'],[]):
        x,y,w,h=f['rect'];part=im.crop((x-ox,y-oy,x+w-ox,y+h-oy))
        if differences(part,original.crop(box(f['rect']))):bad.append(f['id'])
    return bad
for rec in records:
    src=ROOT/rec['source'];p=LIB/rec['file'];im=Image.open(p).convert('RGBA');original=Image.open(src).convert('RGBA')
    assert digest(src)==rec['sourceSHA256'],('modified original',src)
    assert digest(p)==rec['sha256'],('stale extraction',p)
    assert im.size==(rec['width'],rec['height'])
    if rec['id'].startswith('flowers-'):
        # Transparent extraction may only change alpha, never recolor petals
        # or paint a replacement ground patch into a flower sprite.
        assert not differences(im.convert('RGB'),original.crop(box(rec['sourceRect'])).convert('RGB')),(rec['id'],'flower RGB differs from original')
    assert not protected_failures(im,original,rec),(rec['id'],protected_failures(im,original,rec))
    checks.append({'asset':rec['id'],'protectedObjects':len(fixtures.get(rec['id'],[]))})
    if rec['id'] not in fixtures:continue
    mask=Image.new('L',original.size);draw=ImageDraw.Draw(mask)
    for patch in rec.get('patches',[]):
        if 'maskPolygon' in patch:draw.polygon(patch['maskPolygon'],fill=255)
        elif 'polygon' in patch:
            tx,ty=patch['target'];draw.polygon([(x+tx,y+ty) for x,y in patch['polygon']],fill=255)
        else:
            tx,ty=patch['target'];_,_,w,h=patch['sourceRect'];draw.rectangle((tx,ty,tx+w-1,ty+h-1),fill=255)
    crop=box(rec['sourceRect']);expected=original.crop(crop)
    outside=ImageChops.invert(mask.crop(crop))
    diff=ImageChops.difference(im,expected).convert('RGB')
    assert not ImageChops.multiply(diff,Image.merge('RGB',(outside,)*3)).getbbox(),(rec['id'],'changed outside recorded masks')
    # Every patch perimeter is reviewable side by side, including the grass
    # around it. A correct source reference is not itself a visual PASS.
    for i,patch in enumerate(rec.get('patches',[])):
        if 'maskPolygon' in patch:points=patch['maskPolygon']
        elif 'polygon' in patch:
            tx,ty=patch['target'];points=[(x+tx,y+ty) for x,y in patch['polygon']]
        else:
            tx,ty=patch['target'];_,_,w,h=patch['sourceRect'];points=[(tx,ty),(tx+w,ty+h)]
        ox,oy,ww,hh=rec['sourceRect'];x0=max(ox,min(p[0] for p in points)-24);y0=max(oy,min(p[1] for p in points)-24);x1=min(ox+ww,max(p[0] for p in points)+24);y1=min(oy+hh,max(p[1] for p in points)+24)
        before=original.crop((x0,y0,x1,y1));after=im.crop((x0-ox,y0-oy,x1-ox,y1-oy))
        panel=Image.new('RGB',(before.width*4,before.height*2+26),'#fffaf0');d=ImageDraw.Draw(panel);d.text((5,5),rec['id']+' / '+str(i)+' : source | extracted',fill='#2b4030')
        panel.paste(before.resize((before.width*2,before.height*2)),(0,26));panel.paste(after.resize((after.width*2,after.height*2)),(before.width*2,26))
        filename=rec['id']+'-patch-'+str(i)+'.png';panel.save(OUT/filename);review.append(filename)
    # Introduce the exact failure family the user identified: a grass tile
    # through half a crown, then transparent cropping through a whole trunk.
    f=fixtures[rec['id']][0];x,y,w,h=f['rect'];ox,oy,_,_=rec['sourceRect']
    for kind in ['grass-erasure','alpha-cut']:
        damaged=im.copy();d=ImageDraw.Draw(damaged)
        d.rectangle((x-ox,y-oy,x+w//2-ox,y+h-oy),fill=(168,205,113,255) if kind=='grass-erasure' else (0,0,0,0))
        assert f['id'] in protected_failures(damaged,original,rec),(kind,'negative control escaped')
adaptations=json.loads((LIB/'adaptations.json').read_text())['assets']
for rec in adaptations:
    p=LIB/rec['file'];im=Image.open(p)
    assert digest(p)==rec['sha256'] and im.size==(rec['width'],rec['height'])
    for ref in rec['references']:assert digest(ROOT/ref['file'])==ref['sha256'],('modified adaptation source',ref['file'])
    assert im.mode=='RGBA'
    bounds=im.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
    assert list(bounds)==rec['significantAlphaBounds']
    assert bounds[0]>0 and bounds[1]>0 and bounds[2]<im.width and bounds[3]<im.height,('clipped edited flower',rec['id'])
report={'passed':True,'checks':checks,'adaptedAssets':len(adaptations),'protectedObjects':sum(len(v) for v in fixtures.values()),'negativeControls':6,'reviewPanels':review,'visualReview':'These panels require human inspection; unknown objects and viewpoint-dependent occlusion are not automatically passed.'}
(OUT/'silhouettes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='reviewPanels'},ensure_ascii=False,indent=2))
