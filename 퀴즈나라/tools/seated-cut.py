"""Cut the user's cross-legged reference (front, boy) into runtime layers.

Pilot for the stretched floor sit (user decision 2026-10-14: the seated legs,
hands and shoes come from drawn art, not from stretched standing limbs).

  python3 tools/seated-cut.py m assets/seated
  python3 tools/seated-cut.py f assets/seated

Writes floor-front-<sex>-legs.png (skin: thighs, knees, crossed shins, hands on
the knees; tinted at runtime), floor-front-<sex>-hand-0/1.png (the hands again,
drawn over the arms), floor-front-<sex>-shoes-sneaker-0/1.png (the basic sneaker
worn at this angle; untinted) and floor-front-<sex>.json: each layer's rect in
body units (viewBox 0 0 32 62), the reference scaled so its head matches the
runtime head and its shoe soles stand on SPEC.floor.
"""
import sys,json,numpy as np
from PIL import Image,ImageDraw
# Per reference sheet (front figure, reference pixels): the centre column,
# body units per pixel (runtime head width at 640 px / 19.35 px/u over the
# reference's head width), the crop, the two worn shoes (screen-right shoe
# first, the far leg's), the shin entering each shoe's opening, the cut
# line just above the hands, the forearms' centres there and the hand boxes.
FIGURES={
 'm':dict(src='assets/pose-references/floor-sit-m-chatgpt-2026-10-14.webp',cx=494.5,k=.0378,crop=(270,640,720,852),
  shoes=[[(528,805),(532,782),(548,771),(580,764),(615,763),(640,770),(652,790),(655,815),(647,835),(618,846),(578,846),(548,838),(532,824)],
         [(331,792),(340,768),(360,757),(392,757),(425,764),(447,772),(458,790),(458,812),(452,830),(425,842),(385,846),(350,840),(334,822)]],
  openings=[[(520,740),(560,740),(560,800),(520,840)],[(430,740),(470,740),(470,830),(430,790)]],
  wrist=665,forearms=[360,623],hands=[(285,402),(588,706)],handBottom=734),
 # Girl: 327 px runtime head over the bob's 510 px.
 'f':dict(src='assets/pose-references/floor-sit-f-chatgpt-2026-10-14.webp',cx=474,k=.0331,crop=(205,610,745,835),
  shoes=[[(507,790),(512,770),(530,758),(570,748),(605,742),(625,750),(635,775),(632,800),(615,820),(580,826),(540,822),(515,810)],
         [(310,780),(318,750),(345,737),(380,738),(420,752),(437,762),(440,790),(432,808),(400,820),(355,823),(322,815)]],
  openings=[[(490,735),(532,735),(532,800),(490,820)],[(425,740),(462,740),(462,815),(425,800)]],
  wrist=643,forearms=[327,605],hands=[(258,360),(572,692)],handBottom=708),
}
sex,out=sys.argv[1],sys.argv[2];C=FIGURES[sex];src=C['src']
im=np.asarray(Image.open(src).convert('RGB')).astype(int)
CX,K,FLOOR=C['cx'],C['k'],46.05
x0,y0,x1,y1=C['crop']
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
shoeR,shoeL=poly(C['shoes'][0]),poly(C['shoes'][1])
skinish=(r>200)&(r-b>25)&(r-b<95)&(g-b<45)&(r>=g)
# Skin is pink: cream cuffs and collars (g-b near 40) and pale or yellow
# prints stay out of the tinted layer.
skintone=(r-b>25)&(g-b<=30)&(r>=g)
# A 3 px margin takes the shoe's soft outline; skin there stays skin.
shoeL=(shoeL|grow(shoeL,3)&~skinish)&fg;shoeR=(shoeR|grow(shoeR,3)&~skinish)&fg
shoeR&=~(skinish&poly(C['openings'][0]));shoeL&=~(skinish&poly(C['openings'][1]))
# Only below the shirt (its lowest green row in each column, upper rows only).
top=shirt&(rows<740-y0);gy=np.where(top.any(0),(top*rows).max(0),-1);below=rows>gy[None,:]+2
WRIST=C['wrist']
# Skin runs on under the shoes' edges (the shoe layers lie over it), so no
# seam opens along the shoe outline.
skin=fg&~(mn>232)&skintone&~((shoeL|shoeR)&~skinish)&~shirt&~denim&below&(rows>=WRIST-y0)
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
n=f'floor-front-{sex}'
meta={'source':src.split('/')[-1],'unit':K,'legs':save(n+'-legs',skin,None),
 'hands':[save(f'{n}-hand-{i}',skin,(h[0],WRIST,h[1],C['handBottom'])) for i,h in enumerate(C['hands'])],
 'wrist':[U(x,WRIST+6) for x in C['forearms']],
 'shoes':{'shoes:sneaker':[save(n+'-shoes-sneaker-0',shoeR),save(n+'-shoes-sneaker-1',shoeL)]}}
json.dump(meta,open(f'{out}/{n}.json','w'),ensure_ascii=False,indent=1)
print(json.dumps(meta))
