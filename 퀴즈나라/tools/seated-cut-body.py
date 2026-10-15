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
 'f:back':dict(src=REF+'floor-sit-f-back-chatgpt-2026-10-14.webp',cx=476.5,k=.0251,crop=(80,0,880,1340),seat=2.56,cut=852),
 'm:back':dict(src=REF+'floor-sit-m-back-chatgpt-2026-10-14.webp',cx=468.2,k=.0258,crop=(100,0,850,1300),seat=1.43,cut=812),
}
def grow(m,k=1):
    for _ in range(k):
        d=m.copy();d[1:]|=m[:-1];d[:-1]|=m[1:];d[:,1:]|=m[:,:-1];d[:,:-1]|=m[:,1:];m=d
    return m
def shrink(m):
    d=m.copy();d[1:]&=m[:-1];d[:-1]&=m[1:];d[:,1:]&=m[:,:-1];d[:,:-1]&=m[:,1:];return d
def cut(key,out,image=None,outfit=OUTFIT,name='basic'):
    # image: an item sheet's figure already placed in this reference's frame
    # (register()); the basic reference otherwise.
    C=FIGURES[key];sex,view=key.split(':');im=np.asarray(image if image is not None else Image.open(C['src']).convert('RGB')).astype(int)
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
    if image is not None:
        # An item may rise above the cut (a hood behind the neck): kept as
        # clothes.
        # Only near the neck (60 px up), never hair-brown, skin or the head's
        # outline (the item's head sits a little off the basic one); the
        # runtime head is drawn over it.
        hair=(r>g)&(g>b)&(r-b>25)&(mx<170)
        skinlike=(r-b>25)&(g-b<=30)&(r-g>=19)
        up=fg&(rows<top+8)&(rows>=top-60)&~grow(hair|(mx<110)|skinlike,2)
        # Only pieces joined to the clothes below the cut (no loose specks
        # or lone outline strokes).
        keep=up&grow(body&(rows>=top+8),1)
        while True:
            d=grow(keep,1)&up
            if (d==keep).all():break
            keep=d
        body|=keep
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
    n=f'floor-{view}-{sex}';path=f'{out}/{n}.json'
    old=json.load(open(path)) if image is not None else None
    # An item keeps the basic drawing's frame (floor row): it was registered onto it.
    floor_px=old['floorPx'] if old else y0+int(np.where(body.any(1))[0].max())+1
    U=lambda px,py:[round(16+(px-C['cx'])*C['k'],4),round(46.05-(floor_px-py)*C['k'],4)]
    def save(name,mask,src):
        ys,xs=np.where(mask);bx0,by0,bx1,by1=xs.min(),ys.min(),xs.max()+1,ys.max()+1;m=mask[by0:by1,bx0:bx1]
        o=np.zeros(m.shape+(4,),np.uint8);o[...,:3]=src[by0:by1,bx0:bx1]*m[...,None];o[...,3]=m*255
        Image.fromarray(o).save(f'{out}/{name}.png',optimize=True)
        p,q=U(x0+bx0,y0+by0),U(x0+bx1,y0+by1);return[p[0],p[1],round(q[0]-p[0],4),round(q[1]-p[1],4)]
    # Each outfit has its own skin (a long sleeve hides the forearm the
    # basic drawing shows) and its own clothes.
    entry={'name':name,'skin':save(f'{n}-{name}-skin',under,rgb),'clothes':save(f'{n}-{name}-clothes',clothes,a)}
    meta=old or {'source':C['src'].split('/')[-1],'unit':C['k'],'cx':C['cx'],'floorPx':floor_px,'cut':int(y0+top),'seat':C['seat'],'outfits':{}}
    meta['outfits'][outfit]=entry
    json.dump(meta,open(path,'w'),ensure_ascii=False,indent=1);print(key,outfit,json.dumps(entry))

# Item sheets (인계/앉은옷-요청문.md): the reference's three seated views
# (front, right profile, back) redrawn with one shop item. Each figure is
# placed onto its basic reference by head width (top two fifths of the
# figure), head centre and lowest row, then cut like the basic drawing.
VIEWS=('front','side','back')
def figure_box(fg):
    ys,xs=np.where(fg);return xs.min(),ys.min(),xs.max()+1,ys.max()+1
def head(fg):
    x0,y0,x1,y1=figure_box(fg);best=(0,0)
    for y in range(y0,y0+int((y1-y0)*.4)):
        xs=np.where(fg[y])[0]
        if len(xs) and xs.max()-xs.min()>best[0]:best=(xs.max()-xs.min(),(xs.max()+xs.min())/2)
    return best[0],best[1],y1
def mask(a):
    mn,mx=a.min(2),a.max(2);return ~((mn>238)&(mx-mn<14))
def register(sheet,sex):
    a=np.asarray(Image.open(sheet).convert('RGB')).astype(int);fg=mask(a)
    cols=fg.sum(0)>2;runs=[];x=0
    while x<len(cols):
        if cols[x]:
            s=x
            while x<len(cols) and cols[x]:x+=1
            runs.append([s,x])
        else:x+=1
    while len(runs)>3:  # join the runs across the smallest gap
        g=min(range(len(runs)-1),key=lambda i:runs[i+1][0]-runs[i][1]);runs[g][1]=runs[g+1][1];del runs[g+1]
    assert len(runs)==3,'three figures expected, found %d'%len(runs)
    out={}
    for view,(s,e) in zip(VIEWS,runs):
        C=FIGURES[f'{sex}:{view}'];ref=Image.open(C['src']).convert('RGB');ra=np.asarray(ref).astype(int);x0,y0,x1,y1=C['crop']
        rf=np.zeros(ra.shape[:2],bool);rf[y0:y1,x0:x1]=mask(ra[y0:y1,x0:x1])
        hw_r,hc_r,bot_r=head(rf)
        nf=np.zeros_like(fg);nf[:,s:e]=fg[:,s:e];hw_n,hc_n,bot_n=head(nf)
        sc=hw_r/hw_n;bx0,by0,bx1,by1=figure_box(nf)
        piece=Image.fromarray(a[by0:by1,bx0:bx1].astype(np.uint8)).resize((round((bx1-bx0)*sc),round((by1-by0)*sc)),Image.LANCZOS)
        canvas=Image.new('RGB',ref.size,'white');canvas.paste(piece,(round(hc_r-(hc_n-bx0)*sc),round(bot_r-(by1-by0)*sc)))
        out[view]=canvas
    return out

if __name__=='__main__':
    # cut-body.py [keys...] OUT                      basic drawings
    # cut-body.py --item SHEET SEX OUTFIT NAME OUT   one item sheet
    if sys.argv[1:2]==['--item']:
        sheet,sex,outfit,name,out=sys.argv[2:7]
        for view,img in register(sheet,sex).items():cut(f'{sex}:{view}',out,img,outfit,name)
    else:
        for key in (sys.argv[1:-1] if len(sys.argv)>2 else FIGURES):cut(key,sys.argv[-1] if len(sys.argv)>1 else 'assets/seated')
