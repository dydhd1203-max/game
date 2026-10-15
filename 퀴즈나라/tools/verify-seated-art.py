"""Compare the cross-legged (floor-sit) avatar with its drawn reference.

  python3 tools/verify-seated-art.py [m:front m:right ...] [--out DIR]

For each sex:direction (assets/seated/layers.json, tools/seated-layers.py; the
reference frame of tools/seated-cut-body.py)
it renders the avatar (tools/seated-render.cjs), places the reference at the
same scale (the record's cx, unit and floorPx), sorts both pictures' pixels
below the collar into shirt / shorts / skin / shoe by colour and reports each
region's overlap (IoU). A region under MIN_IOU fails. It also writes a 280 px
side-by-side (game | reference) and a difference map for each view, which must
be looked at before the pose is called done: a pass here is not approval.
Introduced 2026-10-14 after a side view was reported as matching when its
shirt hid the shorts and thigh.
"""
import sys,json,subprocess,colorsys,numpy as np,os,importlib.util
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_IOU={'shirt':.6,'shorts':.6,'skin':.6,'shoe':.5}
VIEWS={'front':'front','back':'back','right':'side','left':'side'}
def classes(img):
    a=np.asarray(img.convert('RGB')).astype(float)/255;mx=a.max(2);mn=a.min(2);v=mx;s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
    r,g,b=a[...,0],a[...,1],a[...,2];d=np.maximum(mx-mn,1e-6)
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    o=np.zeros(a.shape[:2],np.uint8);ink=mn<.92
    o[ink&(h>70)&(h<175)&(s>.2)]=1             # shirt (green)
    o[ink&(h>195)&(h<265)&(s>.08)]=2           # shorts (denim, blue)
    o[ink&((h<40)|(h>340))&(s>.08)&(s<.42)&(v>.72)]=3  # skin
    o[ink&(h>=18)&(h<55)&(s>=.42)]=4           # shoe (tan sole, orange print)
    return o
NAMES={1:'shirt',2:'shorts',3:'skin',4:'shoe'}
def main():
    args=[a for a in sys.argv[1:] if not a.startswith('--')];out=sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else os.path.join(ROOT,'검증','앉기-원화')
    if '--out' in sys.argv:args.remove(out)
    os.makedirs(out,exist_ok=True)
    spec=importlib.util.spec_from_file_location('cb',os.path.join(ROOT,'tools/seated-cut-body.py'));cb=importlib.util.module_from_spec(spec);argv=sys.argv;sys.argv=['x'];spec.loader.exec_module(cb);sys.argv=argv
    cases=args or [f'{s}:{d}' for s in 'mf' for d in ('front','right','back','left')]
    failed=False
    for case in cases:
        sex,d=case.split(':');F=cb.FIGURES[f'{sex}:{VIEWS[d]}'];x0,y0,x1,y1=F['crop']
        refa=np.asarray(Image.open(os.path.join(ROOT,F['src'])).convert('RGB')).astype(int)[y0:y1,x0:x1]
        meta={'source':F['src'].split('/')[-1],'cx':F['cx'],'unit':F['k'],'floorPx':y0+int(np.where((refa.min(2)<238).any(1))[0].max())+1}
        png=os.path.join(out,f'{sex}-{d}.png');res=subprocess.run(['node',os.path.join(ROOT,'tools/seated-render.cjs'),sex,d,png],capture_output=True,text=True,cwd=ROOT)
        if res.returncode:print(case,'RENDER FAIL',res.stderr[-400:]);failed=True;continue
        c=json.loads(res.stdout.strip().splitlines()[-1])['ctm'];game=Image.open(png).convert('RGB')
        ref=Image.open(os.path.join(ROOT,'assets/pose-references',meta['source'])).convert('RGB')
        # Left is the mirrored right view (negative x scale in the matrix).
        k=meta['unit'];s=abs(c[0])*k;R=ref.resize((round(ref.width*s),round(ref.height*s)),Image.LANCZOS)
        if c[0]<0:R=R.transpose(Image.FLIP_LEFT_RIGHT);ox=round(c[0]*(16+(ref.width-meta['cx'])*k)+c[4])
        else:ox=round(c[0]*(16-meta['cx']*k)+c[4])
        oy=round(c[3]*(46.05-meta['floorPx']*k)+c[5])
        placed=Image.new('RGB',game.size,'white');placed.paste(R,(ox,oy))
        y0=round(c[3]*30.5+c[5]) if d!='back' else round(c[3]*29+c[5])  # below the collar (body units; the legs' matrix)
        A,B=classes(game)[y0:],classes(placed)[y0:];line=[]
        for i,n in NAMES.items():
            m1,m2=A==i,B==i;u=(m1|m2).sum()
            if m2.sum()<200:continue
            iou=(m1&m2).sum()/u;ok=iou>=MIN_IOU[n];failed|=not ok;line.append(f"{n} {iou:.2f}{'' if ok else ' FAIL'}")
        # Shirt hem: the lowest shirt row in the middle third of the shirt's
        # columns, game against reference, in body units (+: game lower).
        def hem(M):
            cols=np.where((M==1).any(0))[0]
            if not len(cols):return None
            lo,hi=cols.min()+(cols.max()-cols.min())//3,cols.max()-(cols.max()-cols.min())//3
            return np.median([np.where(M[:,j]==1)[0].max() for j in range(lo,hi+1) if (M[:,j]==1).any()])
        hg,hr=hem(A),hem(B)
        if hg is not None and hr is not None:line.append(f'hem {(hg-hr)/c[3]:+.2f}u')
        print(case,' | '.join(line))
        viz=np.full(A.shape+(3,),255,np.uint8);col={1:(40,140,60),2:(40,60,200),3:(240,150,130),4:(230,160,40)}
        for i,cc in col.items():viz[(A==i)&(B==i)]=cc
        viz[(A!=B)&((A>0)|(B>0))]=(255,0,0)
        Image.fromarray(viz).save(os.path.join(out,f'{sex}-{d}-diff.png'))
        side=Image.new('RGB',(game.width*2+20,game.height),'white');side.paste(game,(0,0));side.paste(placed,(game.width+20,0))
        side.resize((side.width*280//640,side.height*280//640),Image.LANCZOS).save(os.path.join(out,f'{sex}-{d}-280.png'))
    print('FAIL' if failed else 'PASS (still look at the 280 px sheets)');sys.exit(1 if failed else 0)
main()
