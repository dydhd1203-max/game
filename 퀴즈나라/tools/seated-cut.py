"""Cut the user's cross-legged reference (front, boy) into runtime layers.

Pilot for the stretched floor sit (user decision 2026-10-14: the seated legs,
hands and shoes come from drawn art, not from stretched standing limbs).

  python3 tools/seated-cut.py assets/pose-references/floor-sit-m-chatgpt-2026-10-14.webp assets/seated

Writes floor-front-m-legs.png (skin: thighs, knees, crossed shins, hands on
the knees; tinted at runtime), floor-front-m-hand-0/1.png (the hands again,
drawn over the arms), floor-front-m-shoes-sneaker-0/1.png (the basic sneaker
worn at this angle; untinted) and floor-front-m.json: each layer's rect in
body units (viewBox 0 0 32 62), the reference scaled so its head matches the
runtime head and its shoe soles stand on SPEC.floor.
"""
import sys,json,numpy as np
from PIL import Image,ImageDraw
src,out=sys.argv[1],sys.argv[2]
im=np.asarray(Image.open(src).convert('RGB')).astype(int)
# Front figure of the sheet: centre column, body units per reference pixel
# (head width 431 px against the runtime's 315 px at 640 px = 19.35 px/u).
CX,K,FLOOR=494.5,.0378,46.05
x0,y0,x1,y1=270,640,720,852
a=im[y0:y1,x0:x1];r,g,b=a[...,0],a[...,1],a[...,2];mx,mn=a.max(2),a.min(2)
rows=np.arange(y1-y0)[:,None]
def grow(m,k):
    for _ in range(k):
        d=m.copy();d[1:]|=m[:-1];d[:-1]|=m[1:];d[:,1:]|=m[:,:-1];d[:,:-1]|=m[:,1:];m=d
    return m
white=(mn>238)&(mx-mn<14)
bg=np.zeros_like(white);bg[0]=white[0];bg[-1]=white[-1];bg[:,0]=white[:,0];bg[:,-1]=white[:,-1]
while True:
    d=grow(bg,1)&white
    if (d==bg).all():break
    bg=d
fg=~bg
shirt=(g>r+8)&(g>b);denim=b>r+10
def poly(pts):
    m=Image.new('L',(x1-x0,y1-y0),0);ImageDraw.Draw(m).polygon([(x-x0,y-y0) for x,y in pts],fill=1);return np.asarray(m).astype(bool)
# The two worn shoes (reference pixels), less the shin entering each opening.
shoeL=poly([(331,792),(340,768),(360,757),(392,757),(425,764),(447,772),(458,790),(458,812),(452,830),(425,842),(385,846),(350,840),(334,822)])
shoeR=poly([(528,805),(532,782),(548,771),(580,764),(615,763),(640,770),(652,790),(655,815),(647,835),(618,846),(578,846),(548,838),(532,824)])
skinish=(r>200)&(r-b>25)&(r-b<95)&(g-b<45)&(r>=g)
# A 3 px margin takes the shoe's soft outline; skin there stays skin.
shoeL=(shoeL|grow(shoeL,3)&~skinish)&fg;shoeR=(shoeR|grow(shoeR,3)&~skinish)&fg
shoeL&=~(skinish&poly([(430,740),(470,740),(470,830),(430,790)]))
shoeR&=~(skinish&poly([(520,740),(560,740),(560,800),(520,840)]))
# Only below the shirt (its lowest green row in each column, upper rows only).
top=shirt&(rows<740-y0);gy=np.where(top.any(0),(top*rows).max(0),-1);below=rows>gy[None,:]+2
WRIST=665
# Skin runs on under the shoes' edges (the shoe layers lie over it), so no
# seam opens along the shoe outline.
skin=fg&~(mn>232)&(r>b+6)&~((shoeL|shoeR)&~skinish)&~shirt&~denim&below&(rows>=WRIST-y0)
# The arms' painted forearms come down to `wrist`: the cut's top rows fade in
# over FADE_PX so the hands meet them without a straight edge.
FADE_PX=10;FADE=np.clip((rows-(WRIST-y0))/FADE_PX,0,1)*np.ones((1,x1-x0));FADE=np.round(FADE*255).astype(np.uint8)
floor_px=y0+int(np.where((shoeL|shoeR).any(1))[0].max())+1
U=lambda px,py:[round(16+(px-CX)*K,4),round(FLOOR-(floor_px-py)*K,4)]
def save(name,mask,box=None):
    if box is None:ys,xs=np.where(mask);box=(x0+xs.min(),y0+ys.min(),x0+xs.max()+1,y0+ys.max()+1)
    bx0,by0,bx1,by1=box;m=mask[by0-y0:by1-y0,bx0-x0:bx1-x0]
    o=np.zeros(m.shape+(4,),np.uint8);o[...,:3]=a[by0-y0:by1-y0,bx0-x0:bx1-x0]*m[...,None];o[...,3]=m*FADE[by0-y0:by1-y0,bx0-x0:bx1-x0]
    Image.fromarray(o).save(f'{out}/{name}.png',optimize=True)
    p,q=U(bx0,by0),U(bx1,by1);return[p[0],p[1],round(q[0]-p[0],4),round(q[1]-p[1],4)]
meta={'source':src.split('/')[-1],'unit':K,'legs':save('floor-front-m-legs',skin,None),
 'hands':[save('floor-front-m-hand-0',skin,(285,WRIST,402,734)),save('floor-front-m-hand-1',skin,(588,WRIST,706,734))],
 'wrist':[U(360,WRIST+6),U(623,WRIST+6)],
 'shoes':{'shoes:sneaker':[save('floor-front-m-shoes-sneaker-0',shoeR),save('floor-front-m-shoes-sneaker-1',shoeL)]}}
json.dump(meta,open(f'{out}/floor-front-m.json','w'),ensure_ascii=False,indent=1)
print(json.dumps(meta))
