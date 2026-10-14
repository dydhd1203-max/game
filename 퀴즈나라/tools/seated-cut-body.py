"""Cut the user's cross-legged references into whole-body seated sprites.

User decision 2026-10-14: in the floor sit only the head is the runtime
avatar's; everything below the chin (neck, shirt, arms, shorts, legs, shoes)
is the drawn reference, so the pose matches the art. Two layers per view:

  floor-<view>-<sex>-skin.png    skin (neck, arms, hands, legs), grown 3 px
                                 under the clothes so no seam shows; tinted
                                 to the avatar's skin at runtime
  floor-<view>-<sex>-outfit-basic.png
                                 everything else (clothes, shoes, outlines),
                                 drawn over the skin, untinted; only for the
                                 outfit it was drawn in (OUTFIT)

  python3 tools/seated-cut-body.py m:front f:front m:side m:back

Scale: the reference head width matches the runtime head; `cx` is the
reference column at body x 16, the lowest drawn row stands on SPEC.floor,
and `seat` is the runtime hip height that puts the runtime head where the
reference's is. `cut` is the reference row above which nothing is taken: the chin's
lowest row (back: below the hair), where the runtime head takes over.
"""
import sys,json,numpy as np
from PIL import Image
OUTFIT='top:tee|bottom:shorts|shoes:sneaker'
REF='assets/pose-references/'
FIGURES={
 'm:front':dict(src=REF+'floor-sit-m-chatgpt-2026-10-14.webp',cx=494.5,k=.0378,crop=(230,0,760,860),seat=3.2,cut=490),
 'f:front':dict(src=REF+'floor-sit-f-chatgpt-2026-10-14.webp',cx=474,k=.0331,crop=(200,0,760,840),seat=2.33,cut=457),
 'm:side':dict(src=REF+'floor-sit-m-chatgpt-2026-10-14.webp',cx=1200,k=.0345,crop=(900,0,1440,860),seat=.66,cut=500),
 'f:side':dict(src=REF+'floor-sit-f-chatgpt-2026-10-14.webp',cx=1190.3,k=.03042,crop=(860,0,1440,840),seat=.9,cut=447),
 'm:back':dict(src=REF+'floor-sit-m-back-chatgpt-2026-10-14.webp',cx=468.2,k=.0258,crop=(100,0,850,1300),seat=1.43,cut=812),
}
def grow(m,k=1):
    for _ in range(k):
        d=m.copy();d[1:]|=m[:-1];d[:-1]|=m[1:];d[:,1:]|=m[:,:-1];d[:,:-1]|=m[:,1:];m=d
    return m
def shrink(m):
    d=m.copy();d[1:]&=m[:-1];d[:-1]&=m[1:];d[:,1:]&=m[:,:-1];d[:,:-1]&=m[:,1:];return d
def cut(key,out):
    C=FIGURES[key];sex,view=key.split(':');im=np.asarray(Image.open(C['src']).convert('RGB')).astype(int)
    x0,y0,x1,y1=C['crop'];a=im[y0:y1,x0:x1];r,g,b=a[...,0],a[...,1],a[...,2];mx,mn=a.max(2),a.min(2)
    white=(mn>238)&(mx-mn<14);bg=np.zeros_like(white);bg[0]=white[0];bg[-1]=white[-1];bg[:,0]=white[:,0];bg[:,-1]=white[:,-1]
    while True:
        d=grow(bg)&white
        if (d==bg).all():break
        bg=d
    fg=~bg
    top=C['cut']-y0
    rows=np.arange(y1-y0)[:,None];body=fg&(rows>=top)
    # The reference chin's outline in the first rows under the cut showed as
    # dark strokes beside the runtime jaw: dropped (the head has its own).
    body&=~((rows<top+8)&(mn<170))
    skin=body&~(mn>232)&(r-b>25)&(g-b<=30)&(r-g>=19)&~((g>r+8)&(g>b))
    skin&=grow(shrink(skin))
    clothes=body&~skin
    # Skin colour grown under the clothes (3 px), from the nearest skin pixel.
    rgb=a.copy();under=skin.copy()
    for _ in range(3):
        ring=grow(under)&body&~under
        acc=np.zeros(a.shape);n=np.zeros(a.shape[:2])
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            s=np.roll(np.roll(under,dy,0),dx,1);v=np.roll(np.roll(rgb,dy,0),dx,1)
            acc+=v*s[...,None];n+=s
        hit=ring&(n>0);rgb[hit]=(acc[hit]/n[hit][:,None]).astype(int);under|=hit
    # The neck runs on 12 rows up under the runtime head (its chin may end a
    # little above the cut): the first skin row below the outline band,
    # repeated.
    s0=top+8
    for j in np.where(under[s0])[0]:
        rgb[top-12:s0,j]=rgb[s0,j];under[top-12:s0,j]=True
    floor_px=y0+int(np.where(body.any(1))[0].max())+1
    U=lambda px,py:[round(16+(px-C['cx'])*C['k'],4),round(46.05-(floor_px-py)*C['k'],4)]
    def save(name,mask,src):
        ys,xs=np.where(mask);bx0,by0,bx1,by1=xs.min(),ys.min(),xs.max()+1,ys.max()+1;m=mask[by0:by1,bx0:bx1]
        o=np.zeros(m.shape+(4,),np.uint8);o[...,:3]=src[by0:by1,bx0:bx1]*m[...,None];o[...,3]=m*255
        Image.fromarray(o).save(f'{out}/{name}.png',optimize=True)
        p,q=U(x0+bx0,y0+by0),U(x0+bx1,y0+by1);return[p[0],p[1],round(q[0]-p[0],4),round(q[1]-p[1],4)]
    n=f'floor-{view}-{sex}'
    meta={'source':C['src'].split('/')[-1],'unit':C['k'],'cx':C['cx'],'floorPx':floor_px,'cut':int(y0+top),'seat':C['seat'],
          'skin':save(n+'-skin',under,rgb),'outfits':{OUTFIT:save(n+'-outfit-basic',clothes,a)}}
    json.dump(meta,open(f'{out}/{n}.json','w'),ensure_ascii=False,indent=1);print(key,json.dumps(meta))
for key in (sys.argv[1:-1] if len(sys.argv)>2 else FIGURES):cut(key,sys.argv[-1] if len(sys.argv)>1 else 'assets/seated')
