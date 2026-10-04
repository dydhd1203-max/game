"""Extract supplied UI pixels and downsample real scene previews; no repainting."""
from pathlib import Path
from PIL import Image
import hashlib,json
from collections import deque
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'assets/world-life';out.mkdir(exist_ok=True)
source=ROOT/'assets/interface-library/originals/interface-reference-01.jpg'
im=Image.open(source)
items=[]
for name,box in [('parchment-frame',(381,701,613,829)),('leaf-panel',(491,306,727,443)),('map-scroll',(10,621,64,677))]:
 target=out/(name+'.png');crop=im.crop(box).convert('RGBA');px=crop.load();w,h=crop.size
 q=deque([(x,y) for x in range(w) for y in [0,h-1]]+[(x,y) for y in range(h) for x in [0,w-1]]);seen=set()
 while q:
  x,y=q.popleft()
  if (x,y) in seen or not(0<=x<w and 0<=y<h):continue
  seen.add((x,y));r,g,b,a=px[x,y]
  if max(r,g,b)-min(r,g,b)<27 and min(r,g,b)>62:
   px[x,y]=(r,g,b,0);q.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
 crop.save(target)
 items.append(dict(file=str(target.relative_to(ROOT)),source=str(source.relative_to(ROOT)),sourceRect=list(box),sha256=hashlib.sha256(source.read_bytes()).hexdigest(),operation='source crop; only connected neutral gray sheet background removed; RGB and illustration preserved; CSS nine-slice border'))
for zone,source_name in [('village','plaza'),('forestgarden','garden'),('treehouse','treehouse'),('skyisland','sky'),('autumnpark','autumn'),('camp','camp'),('adventure',None)]:
 src=ROOT/('assets/forest-village-library/original-resolution/maps/'+source_name+'.png' if source_name else 'assets/forest-village-library/adventure/firefly-glade.png')
 thumb=Image.open(src);thumb.thumbnail((800,600),Image.Resampling.LANCZOS);thumb.save(out/'thumbnails'/(zone+'.webp'),quality=85)
 items.append(dict(file='thumbnails/'+zone+'.webp',source=str(src.relative_to(ROOT)),operation='proportional thumbnail of current scene artwork',sha256=hashlib.sha256(src.read_bytes()).hexdigest()))
for zone in ['campus','playground']:
 src=Path(__import__('os').environ.get('QUIZ_VERIFICATION_OUTPUT','/tmp/quiz-map-previews'))/(zone+'-native.png')
 if src.exists():
  thumb=Image.open(src);thumb.thumbnail((800,600),Image.Resampling.LANCZOS);thumb.save(out/'thumbnails'/(zone+'.webp'),quality=85)
  items.append(dict(file='thumbnails/'+zone+'.webp',source=zone+' scene.render() screenshot, 800px wide, no avatars/HUD',operation='render of supplied artwork with current gate/chairs'))
(out/'provenance.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')

# School foliage uses exact rendered source coordinates, not low-resolution previews.
stage=Path(__import__('os').environ.get('QUIZ_VERIFICATION_OUTPUT','/tmp/quiz-map-previews'))
if (stage/'playground-native.png').exists():
 data=json.loads((stage/'playground-native.json').read_text());im=Image.open(stage/'playground-native.png');atlas=Image.new('RGBA',(2048,1024));x=y=row=0;frames=[]
 for t in data['trees']:
  bx=round(t['cx']-t['rx']*.82);by=round(t['cy']-t['ry']*.9);w=round(t['rx']*1.64);h=round(t['ry']*1.55)
  if bx<0 or by<0 or bx+w>im.width or by+h>im.height:continue
  if x+w>2048:x=0;y+=row;row=0
  if y+h>1024:raise ValueError('Foliage atlas overflow')
  atlas.paste(im.crop((bx,by,bx+w,by+h)),(x,y));frames.append(dict(r=dict(x=bx,y=by,w=w,h=h),source=dict(x=x,y=y,w=w,h=h)));x+=w;row=max(row,h)
 atlas=atlas.crop((0,0,2048,y+row));atlas.save(out/'school-foliage.webp',lossless=True)
 (ROOT/'world-life-school.js').write_text('/* Exact foliage crops of the supplied, assembled school artwork. */\nwindow.QPSchoolFoliage='+json.dumps(frames,separators=(',',':'))+';\n')
 items.append(dict(file='school-foliage.webp',source='QPPlaygroundScene.render() + QPMapAvatarDisplay registered crowns',operation='exact native render crops; no repainting',frames=frames))
(out/'provenance.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')

source=out/'sources/mole-original.png'
if source.exists():
 mole=Image.open(source).convert('RGBA');trim=mole.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox();mole=mole.crop(trim);mole.thumbnail((240,240),Image.Resampling.LANCZOS);mole.save(out/'mole.webp',quality=92)
 items.append(dict(file='mole.webp',source=str(source.relative_to(ROOT)),operation='revised smooth sky-map-style mole; transparent margin trim and proportional thumbnail only; previous furry candidate retired',trim=list(trim),sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
(out/'provenance.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
