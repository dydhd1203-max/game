'use strict';
// Running fists from the returned art (2026-10-17, 검수실 motion5 ①, user choice "원화 요청"): the front run's
// forearm folded toward the viewer, cut from each returned sheet (assets/arm-template/sources/달리기주먹-<남자|여자>-…
// .png, drawn on 달리기주먹-그림틀-<m|f>.png) and packed into one atlas the runtime places on the wrist
// (avatar-foundation-skin.js RUN_FIST, runFist).
//   node tools/arm/build-run-fist.cjs [--m SHEET] [--f SHEET] [--debug DIR] [--check]
//   default sheets: the newest assets/arm-template/sources/달리기주먹-<남자|여자>-*.png
// Per sex and cell (the template's three phases of arm 1's fold):
//   - placement: the sheet must lie where the template does (FIGURE_MOVED: mean grey difference outside the rings
//     over MOVED_LIMIT);
//   - the new forearm: inside the ring (the template's red ring, RING_GROW wider: a sheet drew the forearm longer), pixels that differ from the template
//     with the arm's skin hidden (달리기주먹-그림틀-팔없음) by more than DIFF_HI and are the fist's colours (fistColour:
//     skin or its dark outline; the shirt's green, white flowers and cream cuff a sheet redrew beside it stay out), the
//     connected parts that reach the forearm's core (elbow to wrist: the elbow is the rounded near end), then their convex hull (the fist over the cuff: alike colours) in the fist's colours, all of it within OLD_LIMIT px of
//     the old fist (달리기주먹-그림틀-팔만) and connected to the wrist, small enclosed holes filled; alpha ramps from DIFF_LO to DIFF_HI on the kept parts (dilated by 2 px), the colour unmixed from that
//     background (FIST_NONE when nothing is found);
//   - the colour back to the neutral painting: the template was drawn at skin tone 0, whose colour matrix
//     (QPFoundationSkin.toneMatrix, read from the runtime) the runtime applies again, so the cut is multiplied by
//     its inverse (as the sheet paintings the other limbs use).
// Writes assets/sd-foundation-ref-run-fist.png (one row per sex, three sprites each) and prints the RUN_FIST literal; --check
// compares it with avatar-foundation-skin.js (exit 1 when they differ); --debug writes DIR/<sex>-잘라낸.png (sheet |
// found (red) | the sprite on dark blue, per cell).
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..','..'),L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
const TPL=path.join(ROOT,'assets','arm-template'),OUT=path.join(ROOT,'assets','sd-foundation-ref-run-fist.png');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const DIFF_LO=14,DIFF_HI=40,SKIN_RG=20,OUTLINE_GREY=150,OLD_LIMIT=40,RING_GROW=1.4,MOVED_LIMIT=9,MIN_PART=30,PAD=3;
const NAME={m:'남자',f:'여자'};
const read=f=>H.png.decode(fs.readFileSync(f));
function newest(sex){const dir=path.join(TPL,'sources'),files=fs.readdirSync(dir).filter(f=>f.startsWith('달리기주먹-'+NAME[sex]+'-')&&f.endsWith('.png')).sort();if(!files.length)throw Error('no returned sheet for '+sex+' in '+dir);return path.join(dir,files[files.length-1]);}
const px=(img,x,y)=>{const i=(y*img.width+x)*4;return[img.data[i],img.data[i+1],img.data[i+2]];};
// The runtime's skin-tone colour matrix for a skin colour (rows R, G, B: three weights each).
async function toneRows(hex){
  const server=await H.serve(H.fsTree(ROOT)),browser=await H.launch({args:H.RASTER_ARGS}),rep={errors:[]};
  try{const {page}=await L.openRuntime(browser,server.base,rep,{viewport:{width:400,height:400}});await L.install(page,{});
    return await page.evaluate(()=>{const host=document.createElement('div');host.innerHTML=__fg.api.render({sex:'m',sk:0,hair:'short:1'},120);document.body.append(host);
      const hex=host.firstElementChild.dataset.foundationSkin,v=QPFoundationSkin.toneMatrix(hex).split(' ').map(Number);host.remove();return{hex,rows:[0,1,2].map(r=>v.slice(r*5,r*5+3))};});}
  finally{await browser.close();await server.close();}
}
// Convex hull (monotone chain) of integer points, counter-clockwise; inside() with a half-pixel margin.
function convexHull(pts){pts=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(pts.length<3)return pts;const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower=[],upper=[];for(const p of pts){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  for(const p of pts.slice().reverse()){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
function inside(h,x,y){if(h.length<3)return false;for(let i=0;i<h.length;i++){const a=h[i],b=h[(i+1)%h.length],cr=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(cr<-.5*Math.hypot(b[0]-a[0],b[1]-a[1]))return false;}return true;}
// Pixels of the window within r px of the mask's white (a square-free disc test on a bounded search).
function dist(mask,x0,y0,W,Hh,r){const out=new Uint8Array(W*Hh);for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){let hit=false;
  for(let dy=-r;dy<=r&&!hit;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const X=x0+x+dx,Y=y0+y+dy;if(X>=0&&Y>=0&&X<mask.width&&Y<mask.height&&mask.data[(Y*mask.width+X)*4]>128){hit=true;break;}}out[y*W+x]=hit?1:0;}return out;}
// The fist's own colours: skin (red over green by SKIN_RG or more: the cuff's cream is 12, the skin 25 to 35) or its
// dark brown outline; never the shirt's green, the white flowers or the cream cuff a sheet redrew beside it.
const fistColour=a=>(a[0]+a[1]+a[2])/3<OUTLINE_GREY?a[0]>=a[1]:a[0]-a[1]>=SKIN_RG&&a[2]<a[1];
// Distance from a point to the segment a-b.
function segDist(x,y,ax,ay,bx,by){const vx=bx-ax,vy=by-ay,l=vx*vx+vy*vy,t=l?Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/l)):0;return Math.hypot(x-ax-t*vx,y-ay-t*vy);}
function invert3(m){const [a,b,c]=m[0],[d,e,f]=m[1],[g,h,i]=m[2],A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;
  return[[A/det,-(b*i-c*h)/det,(b*f-c*e)/det],[B/det,(a*i-c*g)/det,-(a*f-c*d)/det],[C/det,-(a*h-b*g)/det,(a*e-b*d)/det]];}
function cut(sex,sheetFile,meta,inv,debug){
  const sheet=read(sheetFile),tpl=read(path.join(TPL,'달리기주먹-그림틀-'+sex+'.png')),bare=read(path.join(TPL,'달리기주먹-그림틀-팔없음-'+sex+'.png')),old=read(path.join(TPL,'달리기주먹-그림틀-팔만-'+sex+'.png'));
  if(sheet.width!==tpl.width||sheet.height!==tpl.height)throw Error(sex+': SIZE '+sheet.width+'x'+sheet.height+' (template '+tpl.width+'x'+tpl.height+')');
  const cells=meta.sexes[sex].cells.map(c=>{const cx=(c.elbow[0]+c.wrist[0])/2,cy=(c.elbow[1]+c.wrist[1])/2,r=Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1])/2+meta.size*.055;return{...c,cx,cy,r};});
  // Placement: grey difference to the template outside the rings, inside the figure's rows.
  let sum=0,n=0;for(let y=120;y<Math.min(sheet.height,meta.sexes[sex].cutY);y+=2)for(let x=0;x<sheet.width;x+=2){if(cells.some(c=>Math.hypot(x-c.cx,y-c.cy)<c.r+30))continue;const a=px(sheet,x,y),b=px(tpl,x,y);sum+=Math.abs((a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]))/3;n++;}
  const moved=sum/n;if(moved>MOVED_LIMIT)throw Error(sex+': FIGURE_MOVED, mean grey difference '+moved.toFixed(2)+' outside the rings (limit '+MOVED_LIMIT+')');
  const out=[];
  for(const c of cells){
    const R=Math.ceil(c.r*RING_GROW+2),x0=Math.max(0,Math.floor(c.cx-R)),y0=Math.max(0,Math.floor(c.cy-R)),x1=Math.min(sheet.width-1,Math.ceil(c.cx+R)),y1=Math.min(sheet.height-1,Math.ceil(c.cy+R)),W=x1-x0+1,Hh=y1-y0+1;
    const d=new Float32Array(W*Hh),hi=new Uint8Array(W*Hh);
    for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const X=x0+x,Y=y0+y;if(Math.hypot(X-c.cx,Y-c.cy)>c.r*RING_GROW)continue;const a=px(sheet,X,Y),b=px(bare,X,Y);d[y*W+x]=Math.max(...a.map((v,k)=>Math.abs(v-b[k])));if(d[y*W+x]>DIFF_HI&&fistColour(a))hi[y*W+x]=1;}
    // Connected parts (8-neighbours) that reach the forearm's core (elbow to wrist).
    const label=new Int32Array(W*Hh).fill(-1),keep=new Uint8Array(W*Hh),wx=c.wrist[0]-x0,wy=c.wrist[1]-y0,ex0=c.elbow[0]-x0,ey0=c.elbow[1]-y0,core=c.r*.45;let parts=0;
    for(let s=0;s<W*Hh;s++){if(!hi[s]||label[s]>=0)continue;const stack=[s],members=[];label[s]=parts;let near=false;
      while(stack.length){const q=stack.pop();members.push(q);const qx=q%W,qy=(q/W)|0;if(segDist(qx,qy,ex0,ey0,wx,wy)<core)near=true;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=W||ny>=Hh)continue;const t=ny*W+nx;if(hi[t]&&label[t]<0){label[t]=parts;stack.push(t);}}}
      if(near&&members.length>=MIN_PART)for(const q of members)keep[q]=1;parts++;}
    // Where the new fist lies over the cream cuff the two colours are alike (skin 254,225,203; cuff close to it), so
    // the difference leaves holes there, open toward the cuff. The drawn forearm and fist are one rounded mass: its
    // convex hull (of the found parts) is the fist; the found outline arcs bound it where it crosses the cuff. Filling
    // by enclosing lines leaked where the fist's outline runs on the cuff's own.
    // Only the fist's own colours (fistColour): in the hull's hollows between the fist and the cuff lay cream cuff
    // and green shirt pieces. (Limiting the fill to the old fist's place cut a longer new fist off straight.)
    const hull=convexHull([...keep.keys()].filter(s=>keep[s]).map(s=>[s%W,(s/W)|0]));let filled=0;
    for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const s=y*W+x;if(keep[s]||Math.hypot(x0+x-c.cx,y0+y-c.cy)>c.r*RING_GROW||!inside(hull,x,y))continue;const a=px(sheet,x0+x,y0+y);if(!fistColour(a))continue;keep[s]=1;filled++;}
    // Everything kept stays near where the game drew the old fist (OLD_LIMIT px): the cuff outline and the flower
    // petals a sheet redrew right beside the fist joined it as one part.
    const near=dist(old,x0,y0,W,Hh,OLD_LIMIT);let cut=0;for(let s=0;s<W*Hh;s++)if(keep[s]&&!near[s]){keep[s]=0;cut++;}
    // One piece: only what stays connected to the forearm's core (stray bits of a redrawn flower centre or cuff line
    // that touched the ring, cut off by the colour and distance tests above).
    {const lab=new Uint8Array(W*Hh),q=[];for(let s=0;s<W*Hh;s++){const x=s%W,y=(s/W)|0;if(keep[s]&&segDist(x,y,ex0,ey0,wx,wy)<core){lab[s]=1;q.push(s);}}
     while(q.length){const t=q.pop(),tx=t%W,ty=(t/W)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=W||ny>=Hh)continue;const u=ny*W+nx;if(keep[u]&&!lab[u]){lab[u]=1;q.push(u);}}}
     for(let s=0;s<W*Hh;s++)if(keep[s]&&!lab[s]){keep[s]=0;cut++;}}
    // Small enclosed holes (highlights and creases the colour test leaves out) belong to the fist.
    {const out=new Uint8Array(W*Hh),q=[];for(let y=0;y<Hh;y++)for(let x=0;x<W;x++)if((x===0||y===0||x===W-1||y===Hh-1)&&!keep[y*W+x]){out[y*W+x]=1;q.push(y*W+x);}
     while(q.length){const t=q.pop(),tx=t%W,ty=(t/W)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=tx+dx,ny=ty+dy;if(nx<0||ny<0||nx>=W||ny>=Hh)continue;const u=ny*W+nx;if(!out[u]&&!keep[u]){out[u]=1;q.push(u);}}}
     for(let s=0;s<W*Hh;s++)if(!out[s]&&!keep[s]){keep[s]=1;filled++;}}
    let kept=0;for(const v of keep)kept+=v?1:0;if(!kept)throw Error(sex+' '+c.phase+': FIST_NONE, no new forearm found in the ring');
    // Alpha on the kept parts dilated by 2 px; colour unmixed from the bare background, then to the neutral painting.
    const grown=new Uint8Array(W*Hh);for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){if(!keep[y*W+x])continue;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<Hh)grown[ny*W+nx]=1;}}
    let bx0=W,by0=Hh,bx1=-1,by1=-1;const rgba=new Uint8ClampedArray(W*Hh*4);
    for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const s=y*W+x;if(!grown[s])continue;const a=px(sheet,x0+x,y0+y),b=px(bare,x0+x,y0+y);
      // The ramp around the fist: never the shirt's green or white (a sheet's redrawn cloth beside the fist).
      const alpha=keep[s]?1:!fistColour(a)?0:Math.max(0,Math.min(1,(d[s]-DIFF_LO)/(DIFF_HI-DIFF_LO)));if(alpha<=0)continue;
      const col=a.map((v,k)=>alpha>.05?(v-(1-alpha)*b[k])/alpha:v),neu=inv.map(row=>row[0]*col[0]+row[1]*col[1]+row[2]*col[2]);
      rgba.set([...neu.map(v=>Math.round(Math.max(0,Math.min(255,v)))),Math.round(alpha*255)],s*4);bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x);by1=Math.max(by1,y);}
    bx0=Math.max(0,bx0-PAD);by0=Math.max(0,by0-PAD);bx1=Math.min(W-1,bx1+PAD);by1=Math.min(Hh-1,by1+PAD);
    const w=bx1-bx0+1,h=by1-by0+1,sprite={width:w,height:h,data:Buffer.alloc(w*h*4)};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=((by0+y)*W+bx0+x)*4;for(let k=0;k<4;k++)sprite.data[(y*w+x)*4+k]=rgba[s+k];}
    const ox=x0+bx0,oy=y0+by0;
    out.push({phase:c.phase,filled,sprite,origin:[ox,oy],wrist:[+(c.wrist[0]-ox).toFixed(2),+(c.wrist[1]-oy).toFixed(2)],elbow:[+(c.elbow[0]-ox).toFixed(2),+(c.elbow[1]-oy).toFixed(2)],ppu:c.ctm[0],kept,moved:+moved.toFixed(2)});
    if(debug){fs.mkdirSync(debug,{recursive:true});const m={width:W*3,height:Hh,data:Buffer.alloc(W*3*Hh*4)};
      for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const s=y*W+x,a=px(sheet,x0+x,y0+y),set=(o,col)=>{const k=(y*W*3+o*W+x)*4;m.data[k]=col[0];m.data[k+1]=col[1];m.data[k+2]=col[2];m.data[k+3]=255;};
        set(0,a);set(1,keep[s]?(hi[s]?[255,0,0]:[0,160,255]):hi[s]?[255,220,0]:a.map(v=>v>>1));set(2,[Math.min(255,d[s]*3),Math.min(255,d[s]*3),Math.min(255,d[s]*3)]);}
      fs.writeFileSync(path.join(debug,sex+'-'+c.phase.replace('/','of')+'-판정.png'),H.png.encode(m));}
  }
  return{sheet,out};
}
(async()=>{
  const meta=JSON.parse(fs.readFileSync(path.join(TPL,'달리기주먹-그림틀.json'),'utf8'));
  const tone=await toneRows();const inv=invert3(tone.rows);
  const sheets={m:arg('--m',null)||newest('m'),f:arg('--f',null)||newest('f')},debug=arg('--debug',null);
  const res={};for(const sex of ['m','f'])res[sex]=cut(sex,sheets[sex],meta,inv,debug);
  // Atlas: one row per sex, three sprites side by side, 2 px apart.
  const rows=['m','f'].map(s=>res[s].out),W=Math.max(...rows.map(r=>r.reduce((a,o)=>a+o.sprite.width+2,0))),Hs=rows.map(r=>Math.max(...r.map(o=>o.sprite.height))),atlas={width:W,height:Hs[0]+Hs[1]+2,data:Buffer.alloc(W*(Hs[0]+Hs[1]+2)*4)};
  const literal={};
  rows.forEach((r,ri)=>{let x=0;const y=ri?Hs[0]+2:0;literal[['m','f'][ri]]=r.map(o=>{for(let yy=0;yy<o.sprite.height;yy++)o.sprite.data.copy(atlas.data,((y+yy)*W+x)*4,yy*o.sprite.width*4,(yy+1)*o.sprite.width*4);
    const e={rect:[x,y,o.sprite.width,o.sprite.height],wrist:o.wrist,elbow:o.elbow,ppu:+o.ppu.toFixed(4)};x+=o.sprite.width+2;return e;});});
  const text='const RUN_FIST='+JSON.stringify(literal)+';';
  if(process.argv.includes('--check')){const src=fs.readFileSync(path.join(ROOT,'avatar-foundation-skin.js'),'utf8'),ok=src.includes(text);
    const png=H.png.encode(atlas),same=fs.existsSync(OUT)&&Buffer.compare(fs.readFileSync(OUT),png)===0;
    console.log((ok?'ok':'DIFFERENT')+'  RUN_FIST literal in avatar-foundation-skin.js\n'+(same?'ok':'DIFFERENT')+'  assets/sd-foundation-ref-run-fist.png');process.exit(ok&&same?0:1);}
  fs.writeFileSync(OUT,H.png.encode(atlas));
  if(debug){fs.mkdirSync(debug,{recursive:true});
    for(const sex of ['m','f']){const {sheet,out}=res[sex],S=3,cw=220,ch=220,img={width:cw*3*out.length,height:ch,data:Buffer.alloc(cw*3*out.length*ch*4)};
      out.forEach((o,i)=>{const cx=o.origin[0]+o.sprite.width/2,cy=o.origin[1]+o.sprite.height/2;
        for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const X=Math.round(cx-cw/2+x),Y=Math.round(cy-ch/2+y),inS=X>=0&&Y>=0&&X<sheet.width&&Y<sheet.height,a=inS?px(sheet,X,Y):[255,255,255];
          const sx=X-o.origin[0],sy=Y-o.origin[1],sa=sx>=0&&sy>=0&&sx<o.sprite.width&&sy<o.sprite.height?o.sprite.data[(sy*o.sprite.width+sx)*4+3]/255:0,sp=sa?[...o.sprite.data.subarray((sy*o.sprite.width+sx)*4,(sy*o.sprite.width+sx)*4+3)]:[0,0,0];
          const put=(col,off)=>{const k=(y*img.width+off+x)*4;img.data[k]=col[0];img.data[k+1]=col[1];img.data[k+2]=col[2];img.data[k+3]=255;};
          put(a,i*cw*3);put(sa>.5?[230,40,40].map((v,k)=>Math.round(v*.6+a[k]*.4)):a,i*cw*3+cw);put([30,40,88].map((v,k)=>Math.round(v*(1-sa)+sp[k]*sa)),i*cw*3+2*cw);}});
      fs.writeFileSync(path.join(debug,sex+'-잘라낸.png'),H.png.encode(img));}}
  for(const sex of ['m','f'])for(const o of res[sex].out)console.log(sex+' '+o.phase+': '+o.sprite.width+'x'+o.sprite.height+' px, kept '+o.kept+' px (hull-filled '+o.filled+'), placement diff '+o.moved+' ('+path.relative(ROOT,sheets[sex])+')');
  console.log('skin tone 0 '+tone.hex+'; wrote '+path.relative(ROOT,OUT)+' '+atlas.width+'x'+atlas.height+'\n'+text);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
