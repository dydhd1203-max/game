"""Cut the user's cross-legged reference (right-facing side view) into runtime layers.

Companion of tools/seated-cut.py (front). User decision 2026-10-14: seated
legs, hands and shoes come from drawn art.

  python3 tools/seated-cut-side.py m assets/seated

Writes floor-side-<sex>-legs.png (skin: thigh, knee, the hand on the knee;
tinted at runtime), -bottom-shorts.png (the basic shorts: seat and rolled
cuff; untinted), -hand.png (forearm and hand, drawn over the near arm, below
its sleeve), -shoes-sneaker.png (the worn basic sneaker; untinted) and
floor-side-<sex>.json: each layer's rect in body units (viewBox 0 0 32 62).
The reference is scaled so its head matches the runtime side head and its
shoe sole stands on SPEC.floor; `cx` is the reference column at body x 16
(heads aligned).
"""
import sys,json,numpy as np
from PIL import Image,ImageDraw
FIGURES={
 # Runtime side head 303 px at 640 px (19.35 px/u) over the reference's 454 px.
 'm':dict(src='assets/pose-references/floor-sit-m-chatgpt-2026-10-14.webp',cx=1200,k=.0345,crop=(1030,600,1420,850),
  # The shirt's lower edge; right of it the forearm runs from the cuff (y 640).
  hem=[(1030,772),(1060,773),(1100,765),(1150,745),(1180,726),(1205,713),(1212,640),(1420,640)],
  shoe=[(1245,815),(1255,792),(1290,781),(1335,770),(1358,762),(1385,764),(1399,785),(1394,812),(1372,832),(1330,844),(1290,844),(1250,836)],
  hand=[(1205,640),(1262,640),(1312,660),(1342,668),(1362,690),(1364,727),(1330,730),(1298,724),(1250,714),(1205,708)],
  wrist=(1305,690),knee=(1320,760),seat=(1100,800)),
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
def shrink(m):
    d=m.copy();d[1:]&=m[:-1];d[:-1]&=m[1:];d[:,1:]&=m[:,:-1];d[:,:-1]&=m[:,1:];return d
white=(mn>238)&(mx-mn<14)
bg=np.zeros_like(white);bg[0]=white[0];bg[-1]=white[-1];bg[:,0]=white[:,0];bg[:,-1]=white[:,-1]
while True:
    d=grow(bg,1)&white
    if (d==bg).all():break
    bg=d
fg=~bg
def poly(pts):
    m=Image.new('L',(x1-x0,y1-y0),0);ImageDraw.Draw(m).polygon([(x-x0,y-y0) for x,y in pts],fill=1);return np.asarray(m).astype(bool)
shirt=(g>r+8)&(g>b);denim=b>r+10
# Skin is pink (cream cuffs and the shoe's cream stay out).
skin=fg&~(mn>232)&(r-b>25)&(g-b<=30)&(r-g>=19)&~shirt&~denim
skin&=grow(shrink(skin),1)
hx,hy=zip(*C['hem']);below=rows>(np.interp(np.arange(x0,x1),hx,hy)-y0)[None,:]
shoe=(poly(C['shoe'])|(grow(poly(C['shoe']),3)&~skin))&fg
legs=skin&below&~(shoe&~skin)
# One piece: what connects to the knee (loose specks by the sock stay out).
def connected(mask,seed):
    keep=np.zeros_like(mask);keep[seed[1]-y0,seed[0]-x0]=True;keep&=mask
    while True:
        d=grow(keep,1)&mask
        if (d==keep).all():return keep
        keep=d
hand=skin&below&poly(C['hand'])
# Keep only what connects to the hand (bits of the cuff's rim).
keep=hand&(np.arange(x1-x0)[None,:]>=C['wrist'][0]-x0)
while True:
    d=grow(keep,1)&hand
    if (d==keep).all():break
    keep=d
hand=keep
# The hand piece repeats the leg piece's pixels where they overlap (a cut
# between them showed as a light seam), drawn over it with the near arm.
legs=connected(legs,C['knee'])
bottom=connected(fg&below&~skin&~shoe&~grow(shirt,2),C['seat'])
floor_px=y0+int(np.where(shoe.any(1))[0].max())+1
U=lambda px,py:[round(16+(px-CX)*K,4),round(FLOOR-(floor_px-py)*K,4)]
def save(name,mask):
    ys,xs=np.where(mask);bx0,by0,bx1,by1=xs.min(),ys.min(),xs.max()+1,ys.max()+1;m=mask[by0:by1,bx0:bx1]
    o=np.zeros(m.shape+(4,),np.uint8);o[...,:3]=a[by0:by1,bx0:bx1]*m[...,None];o[...,3]=m*255
    Image.fromarray(o).save(f'{out}/{name}.png',optimize=True)
    p,q=U(x0+bx0,y0+by0),U(x0+bx1,y0+by1);return[p[0],p[1],round(q[0]-p[0],4),round(q[1]-p[1],4)]
n=f'floor-side-{sex}'
# Same layout as the front record, per [far, near] arm and leg: only the near
# arm's hand shows; the one visible shoe goes with the far leg (under both).
meta={'source':src.split('/')[-1],'unit':K,'legs':save(n+'-legs',legs),'hands':[None,save(n+'-hand',hand)],'wrist':[None,U(*C['wrist'])],
 'bottoms':{'bottom:shorts':save(n+'-bottom-shorts',bottom)},'shoes':{'shoes:sneaker':[save(n+'-shoes-sneaker',shoe),None]}}
json.dump(meta,open(f'{out}/{n}.json','w'),ensure_ascii=False,indent=1)
print(json.dumps(meta))
