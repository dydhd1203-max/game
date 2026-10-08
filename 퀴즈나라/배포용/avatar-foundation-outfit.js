/* The base outfit, cut from the approved reference sheet per sex and view
   (tools/build-reference-body.py). Garment parts share the reference body's
   joints: the shirt follows the torso, sleeves the upper arms, one shorts
   mesh the pelvis and both thighs, and each shoe its ankle. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',base=new URL('.',document.currentScript.src),R=root.QPFoundationReferenceData;
  const files={shirt:'assets/sd-foundation-ref-shirt.png',sleeves:'assets/sd-foundation-ref-sleeves.png',shorts:'assets/sd-foundation-ref-shorts.png',shoes:'assets/sd-foundation-ref-shoes.png'};
  const atlas={ready:false,error:null,parts:{},source:files.shirt},mounted=new WeakMap(),images={};
  const VIEW={Front:'front',Profile:'right',Back:'back'};
  // Warped mesh triangles overlap by about a pixel; thinner overlaps showed
  // diagonal hairline seams across the denim and sleeves.
  const SEAM=.9;
  const n=x=>Math.round(x*10000)/10000,pt=p=>p.map(n).join(' '),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=t=>t*t*(3-2*t);
  const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
  const el=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const set=(e,k,v)=>{if(e.getAttribute(k)!==String(v))e.setAttribute(k,v);};
  const figure=(sex,view)=>R.figures[sex+'-'+VIEW[view]];
  const spec=sex=>root.QPAvatarFoundation.specFor(sex),rig=(sex,view)=>root.QPAvatarFoundation.rigFor(sex,view==='Profile'?'profile':view==='Back'?'back':'front');
  // Sheet pixel → body-local point, anchored at a known sheet pixel.
  const local=(F,px,anchor,target)=>[target[0]+(px[0]-anchor[0])*F.k,target[1]+(px[1]-anchor[1])*F.k];
  const collar=F=>[16,spec(F.sex).collar];
  function crop(layer,rect){const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];c.getContext('2d').drawImage(images[layer],...rect,0,0,rect[2],rect[3]);return c;}
  function part(key,layer,rect){if(atlas.parts[key])return atlas.parts[key];const canvas=crop(layer,rect);return atlas.parts[key]={rect,canvas,width:rect[2],height:rect[3],url:canvas.toDataURL()};}
  let loading;
  function load(){root.QPFoundationSkin?.load();return loading||(loading=Promise.all(Object.entries(files).map(async([k,f])=>[k,await QPAvatarImage.load(new URL(f,base).href)])).then(entries=>{Object.assign(images,Object.fromEntries(entries));atlas.ready=true;return atlas;}).catch(error=>{atlas.error=error.message;console.error(error);return atlas;}));}
  const params=new URLSearchParams(location.search);
  if(params.get('avatar')==='foundation'||params.get('session')==='foundation-studio')load();
  // A sleeve is a small cloth mesh, not a rigid cutout. Its sewn edge stays
  // on the shirt while the cuff follows the upper arm; a strongly raised arm
  // lets the whole sleeve turn with it. Results are cached per angle.
  const sleeveCache=new Map(),shortsCache=new Map();
  function sleeveTexture(sex,view,i,angle,lean,lift=0){
    const F=figure(sex,view),profile=view==='Profile',S=rig(sex,view),restAngle=profile?-Math.atan2(...S.profileSwing):Math.atan2(S.elbow[i][1]-S.shoulder[i][1],S.elbow[i][0]-S.shoulder[i][0])-Math.PI/2;
    const delta=Math.round((angle-restAngle-lean)*180/Math.PI/2)*2*Math.PI/180,raise=Math.round(clamp(lift,0,1)*10)/10,cacheKey=[sex,view,i,Math.round(delta*180/Math.PI),raise].join(':');
    if(sleeveCache.has(cacheKey))return sleeveCache.get(cacheKey);
    const art=part(sex+view+'Sleeve'+i,'sleeves',F.rects.sleeve[i]),shoulder=F.joints.shoulder[i],c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),cols=10,rows=12,vertices=[];
    // Pinning fades for a raised arm: a sewn cap stretched across 120° tore.
    // A gesture-raised arm carries its whole sleeve from the start (the
    // underarm cloth below fills the shirt behind it); a half-pinned cap
    // stretched into a long tube during the raise.
    const hold=(1-smooth(clamp((Math.abs(delta)*180/Math.PI-40)/50,0,1)))*(1-smooth(clamp(raise*2.5,0,1)));
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,px=[art.rect[0]+u*art.width,art.rect[1]+v*art.height];
      // Sleeve frame: y runs down the resting upper arm from the shoulder.
      const q=rotate([(px[0]-shoulder[0])*F.k,(px[1]-shoulder[1])*F.k],-restAngle),along=smooth(clamp((q[1]+.2)/2.2,0,1));
      const inward=profile?.6:smooth(clamp(((i?-q[0]:q[0])+.5)/1.2,0,1)),pin=hold*inward*(1-along),fixed=rotate(q,-delta),p=mix(q,fixed,pin);
      vertices.push({s:[u*art.width,v*art.height],d:[(p[0]+4)*32,(p[1]+4)*32]});
    }
    meshDraw(ctx,art.canvas,vertices,cols,rows);
    const result={url:c.toDataURL()};sleeveCache.set(cacheKey,result);if(sleeveCache.size>200)sleeveCache.delete(sleeveCache.keys().next().value);return result;
  }
  function meshDraw(ctx,texture,vertices,cols,rows){
    const draw=(a,b,c)=>{const[x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(den)<1e-9)return;const aa=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,bb=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;ctx.save();ctx.beginPath();const center=[(u0+u1+u2)/3,(v0+v1+v2)/3];[a.d,b.d,c.d].forEach((p,i)=>{const dx=p[0]-center[0],dy=p[1]-center[1],l=Math.hypot(dx,dy)||1,q=[p[0]+dx/l*SEAM,p[1]+dy/l*SEAM];i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,u0-aa*x0-cc*y0,v0-bb*x0-dd*y0);ctx.drawImage(texture,0,0);ctx.restore();};
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col;draw(vertices[i],vertices[i+1],vertices[i+cols+2]);draw(vertices[i],vertices[i+cols+2],vertices[i+cols+1]);}
  }
  // Seated shorts seen from the front or back. Bending the standing drawing
  // with thighs that point out of the picture (cross-legged knees turned
  // ~120 degrees up and out; desk thighs straight toward or away from the
  // viewer) dragged the seat and fly along, tore the crotch open or folded
  // the legs into a V. Here the seat (the drawing above the cuffs) and the
  // leg openings (each half's cuff with a little denim above it) are placed
  // separately, as one picture:
  //  - floor: the openings turn rigidly to end at the knees and the seat is
  //    laid over them, resting on the floor, so the inner thigh folds away
  //    under the seat as on a real seated child. Each opening is the thigh's
  //    own width (the whole half of the drawing stuck up beside the waist
  //    and its flared cuff showed as a flap by the knee);
  //  - desk, front: each cuff is bent into a soft curve around the thigh
  //    end (the thigh comes toward the viewer) and lies over the knee, so
  //    the round knee comes out from under the hem; a straight cut over
  //    bare knees read as stumps under a hard edge (2026-10-08 review);
  //  - desk, back: only the seat shows, resting on the chair; the openings
  //    point away under it.
  // Every seat ends in a soft rounded bottom with its outline following it
  // (a ruled straight edge with square cuff corners read as a box).
  // Sheet rows per figure: cut = just above the cuffs, apex = bottom of the
  // crotch notch at the centre seam, cuff = the cuff's lower outline (skin
  // below it is dropped), rise = how far the cuff's upper outline climbs
  // above the cut at the drawing's outer sides (sheet px, read off the
  // sheet; the female cream cuff slants up steeply and showed as a cream
  // wedge in each corner of a seat cut along the straight row).
  const SEAT={'m-front':{cut:451,apex:439,cuff:465.5,rise:13},'m-back':{cut:452,apex:437,cuff:465,rise:12},'f-front':{cut:964,apex:957,cuff:983,rise:16},'f-back':{cut:962,apex:956,cuff:980.5,rise:16}},edgeTones=new Map();
  function edgeTone(key,canvas){
    // The drawing's own outline colour: first opaque pixel along a middle row.
    if(edgeTones.has(key))return edgeTones.get(key);const y=Math.floor(canvas.height*.4),row=canvas.getContext('2d').getImageData(0,y,canvas.width,1).data;let tone='rgba(40,44,60,.9)';
    for(let i=0;i<canvas.width;i++)if(row[i*4+3]>220){tone='rgba('+row[i*4]+','+row[i*4+1]+','+row[i*4+2]+',.92)';break;}edgeTones.set(key,tone);return tone;
  }
  // The drawing's opaque span on one sheet row, in body-local x.
  function rowSpan(art,F,py){
    const c=art.canvas,y=clamp(Math.round(py-art.rect[1]),0,c.height-1),row=c.getContext('2d').getImageData(0,y,c.width,1).data;let l=0,r=c.width-1;
    while(l<r&&row[l*4+3]<128)l++;while(r>l&&row[r*4+3]<128)r--;const x=px=>16+(px+art.rect[0]-F.neck[0])*F.k;return[x(l),x(r+1)];
  }
  function seatedShorts(sex,view,S,F,art,projected,pose){
    const T=SEAT[sex+'-'+VIEW[view]],ly=py=>collar(F)[1]+(py-F.neck[1])*F.k,lx=px=>16+(px-F.neck[0])*F.k;
    const x0=lx(art.rect[0]),y0=ly(art.rect[1]),w=art.width*F.k,h=art.height*F.k,cut=ly(T.cut),apex=ly(T.apex),cuff=ly(T.cuff);
    // A leg opening spans from the centre seam to just past the thigh's
    // outer side, never the drawing's flared cuff beyond it.
    const half=(i,reach)=>i?[16,Math.min(x0+w,S.hip[i]+reach)]:[Math.max(x0,S.hip[i]-reach),16];
    // Rows above `top` stay as drawn (they meet the shirt hem); the seat
    // between `top` and the cut is scaled to its seated height.
    const top=S.waist-.5,back=view==='Back';let bottom,tubes=[],bands=[],seatOver=true;
    if(pose.floor){
      bottom=S.floor-pose.drop;
      tubes=projected.map((leg,i)=>{const hip=[S.hip[i],S.waist],v=[leg.knee[0]-hip[0],leg.knee[1]-hip[1]],l=Math.hypot(...v)||1,u=[v[0]/l,v[1]/l],[a,b]=half(i,1.7);
        return{end:[leg.knee[0]-u[0]*.42,leg.knee[1]-u[1]*.42],source:[S.hip[i],cuff],angle:Math.atan2(u[1],u[0])-Math.PI/2,along:.9,across:.62,rect:[a,cuff-1.6,b-a,1.6]};});
    }else if(back)bottom=cut;
    else{
      // The cuff band (with a little denim above it) bent into a smile:
      // its middle hangs `sag` lower than its ends, its bottom middle just
      // over the top of the knee, so the round knee shows below the hem.
      const along=.78,across=.82,sag=.42;seatOver=false;
      bands=projected.map((leg,i)=>{const hip=S.hip[i],[a,b]=half(i,1.85),cx=mix([hip],[leg.knee[0]],.75)[0],cy=leg.knee[1]-.4-sag;
        const map=p=>{const t=clamp((p[0]-hip)/(p[0]<hip?hip-a:b-hip),-1,1);return[cx+(p[0]-hip)*across,cy+(p[1]-cuff)*along+sag*(1-t*t)];};
        return{rect:[a,cut-.2,b-a,cuff-cut+.2],map,topMid:map([hip,cut-.2])[1]};});
      bottom=Math.min(...bands.map(t=>t.topMid))+.12;
    }
    const k=(bottom-top)/(cut-top),place=(t,p)=>{const q=rotate([(p[0]-t.source[0])*t.across,(p[1]-t.source[1])*t.along],t.angle);return[t.end[0]+q[0],t.end[1]+q[1]];};
    const grid=(t,cols,rows)=>{const out=[];for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++)out.push([t.rect[0]+c/cols*t.rect[2],t.rect[1]+r/rows*t.rect[3]]);return out;};
    const pts=[[x0,y0],[x0+w,y0],[x0,bottom],[x0+w,bottom]];
    for(const t of tubes){const[r0,r1,r2,r3]=t.rect;pts.push(...[[r0,r1],[r0+r2,r1],[r0,r1+r3],[r0+r2,r1+r3]].map(p=>place(t,p)));}
    for(const t of bands)pts.push(...grid(t,8,2).map(t.map));
    const bx=Math.min(...pts.map(p=>p[0]))-.1,by=Math.min(...pts.map(p=>p[1]))-.1,bw=Math.max(...pts.map(p=>p[0]))-bx+.1,bh=Math.max(...pts.map(p=>p[1]))-by+.1,scale=16;
    const layer=()=>{const c=document.createElement('canvas');c.width=Math.ceil(bw*scale);c.height=Math.ceil(bh*scale);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.setTransform(scale,0,0,scale,-bx*scale,-by*scale);return[c,x];};
    const [openings,oc]=layer(),[seat,sc]=layer();
    for(const t of tubes){oc.save();oc.translate(...t.end);oc.rotate(t.angle);oc.scale(t.across,t.along);oc.translate(-t.source[0],-t.source[1]);oc.beginPath();oc.rect(...t.rect);oc.clip();oc.drawImage(art.canvas,x0,y0,w,h);oc.restore();}
    if(bands.length){oc.setTransform(1,0,0,1,0,0);const cols=8,rows=2;for(const t of bands)meshDraw(oc,art.canvas,grid(t,cols,rows).map(p=>{const q=t.map(p);return{s:[(p[0]-x0)/F.k,(p[1]-y0)/F.k],d:[(q[0]-bx)*scale,(q[1]-by)*scale]};}),cols,rows);}
    // The seat: waistband as drawn, the rest scaled, the crotch notch filled
    // with the seam just above it. Its bottom follows the cuff's upper
    // outline (low at the seat, climbing toward each outer side, with a
    // small lift at the centre seam) instead of the straight cut row, so
    // it ends in a soft rounded edge, outlined along that curve.
    const [L,R]=rowSpan(art,F,T.cut-1),reach=(16-L+R-16)/2*.85,edge=[];
    for(let j=0;j<=28;j++){const x=mix([R],[L],j/28)[0],d=Math.min(x-L,R-x),f=Math.pow(clamp(1-d/reach,0,1),1.6),seam=.12*Math.max(0,1-Math.abs(x-16)/.7),yl=ly(T.cut-T.rise*f)-seam;edge.push([x,top+(yl-top)*k]);}
    const soft=(c,join)=>edge.forEach((p,j)=>c[j||join?'lineTo':'moveTo'](...p));
    sc.beginPath();sc.moveTo(x0-1,y0-1);sc.lineTo(x0+w+1,y0-1);sc.lineTo(x0+w+1,edge[0][1]);soft(sc,true);sc.lineTo(x0-1,edge.at(-1)[1]);sc.closePath();sc.clip();
    sc.save();sc.beginPath();sc.rect(x0-.1,y0-.1,w+.2,top-y0+.12);sc.clip();sc.drawImage(art.canvas,x0,y0,w,h);sc.restore();
    sc.save();sc.beginPath();sc.rect(x0-.1,top,w+.2,bottom-top+.2);sc.clip();sc.translate(0,top);sc.scale(1,k);sc.translate(0,-top);sc.drawImage(art.canvas,x0,y0,w,h);
    sc.globalCompositeOperation='destination-over';sc.beginPath();sc.rect(16-.9,apex-.15,1.8,cut-apex+.15);sc.clip();sc.drawImage(art.canvas,x0,y0+(cut-apex)+.05,w,h);sc.restore();
    sc.save();sc.globalCompositeOperation='source-atop';sc.strokeStyle=edgeTone(sex+view,art.canvas);sc.lineWidth=.22;sc.lineCap='round';sc.lineJoin='round';sc.beginPath();soft(sc);sc.stroke();sc.restore();
    const[out,ctx]=layer();ctx.setTransform(1,0,0,1,0,0);for(const c of seatOver?[openings,seat]:[seat,openings])ctx.drawImage(c,0,0);
    return{url:out.toDataURL(),x:bx,y:by,w:out.width/scale,h:out.height/scale};
  }
  // One continuous shorts drawing, weighted to pelvis and both thighs. The
  // waist and each cuff occur once; the skinning regions share seam vertices.
  function shortsTexture(sex,view,pose){
    const S=rig(sex,view),F=figure(sex,view),profile=pose.profile,key=[sex,view,pose.floor,pose.desk,pose.lean,...pose.legs.flatMap(l=>[...l.root,...l.knee])].map(v=>typeof v==='number'?Math.round(v*24)/24:v).join(':');if(shortsCache.has(key))return shortsCache.get(key);
    const art=part(sex+view+'Shorts','shorts',F.rects.shorts),cols=10,rows=10,vertices=[];
    const [a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=p=>[(d*(p[0]-tx)-c*(p[1]-ty))/det,(-b*(p[0]-tx)+a*(p[1]-ty))/det];
    const projected=pose.legs.map(l=>({root:unmap(l.root),knee:unmap(l.knee)})),start=S.waist-.6;
    if((pose.floor||pose.desk)&&!profile){const result=seatedShorts(sex,view,S,F,art,projected,pose);shortsCache.set(key,result);if(shortsCache.size>160)shortsCache.delete(shortsCache.keys().next().value);return result;}
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,[x,y]=local(F,[art.rect[0]+u*art.width,art.rect[1]+v*art.height],F.neck,collar(F)),weight=smooth(clamp((y-start)/1.6,0,1));
      // View projection alters the visible length, never the body's joints.
      const targets=projected.map((leg,i)=>{const hip=profile?S.profileHip[i]:S.hip[i],dx=leg.knee[0]-leg.root[0],dy=leg.knee[1]-leg.root[1],length=Math.hypot(dx,dy),nx=dy/(length||1),ny=-dx/(length||1),along=(y-S.waist)/S.thigh,spread=pose.floor?.5:1;return[leg.root[0]+nx*(x-hip)*spread+dx*along,leg.root[1]+ny*(x-hip)*spread+dy*along];});
      // A side view overlaps both leg openings: follow the mean thigh rather than
      // tearing the seat and fly apart when the legs scissor.
      const side=profile?.5:smooth(clamp((x-15.4)/1.2,0,1));let target=mix(targets[0],targets[1],side);
      // Seated side view: only the front of the shorts turns with the thighs.
      // The seat behind the hip stays upright and its lower rows fold up to
      // rest on the floor or chair; turned with the thighs it hung below
      // them like a bag. The turned part keeps the drawing's thigh column
      // (.4 ahead of the hip) on the thigh axis at .6 of the drawn depth, so
      // the tube is a thigh's thickness, not the whole side of the shorts.
      if(profile&&(pose.floor||pose.desk)){const a=x-S.profileHip[0],b=y-S.waist,rest=pose.floor?S.floor-pose.drop-S.waist:1.3,low=local(F,[0,art.rect[1]+art.height],F.neck,collar(F))[1],c=rest/Math.max(.5,low-S.waist),turn=smooth(clamp((a+.4)/1.6,0,1));
        const leg=projected[1],dx=leg.knee[0]-leg.root[0],dy=leg.knee[1]-leg.root[1],l=Math.hypot(dx,dy)||1,thigh=[leg.root[0]+dy/l*(a-.4)*.6+dx*b/S.thigh,leg.root[1]-dx/l*(a-.4)*.6+dy*b/S.thigh];
        target=mix([x,S.waist+(b>0?b*c:b)],thigh,turn);}
      vertices.push({s:[u*art.width,v*art.height],d:[x+(target[0]-x)*weight,y+(target[1]-y)*weight]});
    }
    const xs=vertices.map(p=>p.d[0]),ys=vertices.map(p=>p.d[1]),x=Math.min(...xs)-.05,y=Math.min(...ys)-.05,w=Math.max(...xs)-x+.05,h=Math.max(...ys)-y+.05,scale=16,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);vertices.forEach(p=>p.d=[(p.d[0]-x)*scale,(p.d[1]-y)*scale]);
    meshDraw(canvas.getContext('2d'),art.canvas,vertices,cols,rows);
    const result={url:canvas.toDataURL(),x,y,w:canvas.width/scale,h:canvas.height/scale};shortsCache.set(key,result);if(shortsCache.size>160)shortsCache.delete(shortsCache.keys().next().value);return result;
  }
  // Underarm of a gesture-raised arm (front/back). On the sheet the hanging
  // arm hides the shirt's sides and shoulder corners, so the art there is
  // refilled cloth without an outline and with a ragged edge. A raised arm
  // shows them: the shirt is cut along a clean side line that runs up to the
  // armpit and curves out along the sleeve's underside, and along the
  // sleeve's top from the point where the sheet's shoulder line meets the
  // sleeve cap. The refilled cloth colour lies under the shirt in that band,
  // so the sleeve's feathered seam (made to blend into the shirt) and the
  // shirt's own soft edges never show the background; the shirt's outline
  // colour draws the new side.
  const sideCache=new Map(),UNDERSIDE=1.3,UNDERARM_END=3.6;
  function shirtSide(sex,view){
    const key=sex+view;if(sideCache.has(key))return sideCache.get(key);
    const F=figure(sex,view),art=part(sex+view+'Shirt','shirt',F.rects.shirt),W=art.width,H=art.height,data=art.canvas.getContext('2d').getImageData(0,0,W,H).data,C=spec(sex).collar;
    const X=x=>Math.round((x-16)/F.k+F.neck[0]-art.rect[0]),Y=y=>Math.round((y-C)/F.k+F.neck[1]-art.rect[1]),bx=px=>16+(px+art.rect[0]-F.neck[0])*F.k,by=py=>C+(py+art.rect[1]-F.neck[1])*F.k;
    const a=(x,y)=>x<0||y<0||x>=W||y>=H?0:data[(y*W+x)*4+3],rgb=(x,y)=>[0,1,2].map(k=>data[(y*W+x)*4+k]);
    const median=v=>v.slice().sort((p,q)=>p-q)[v.length>>1],edge=(s,y0,y1)=>{const v=[];for(let y=Y(y0);y<=Y(y1);y++){let x=s>0?W-1:0;while(x>=0&&x<W&&a(x,y)<128)x-=s;v.push(bx(x+.5));}return median(v);};
    const hex=c=>'#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
    // The shirt's plain cloth colour: the median of all its opaque pixels
    // (prints and outlines are a small share of the picture).
    const all=[];for(let py=0;py<H;py+=2)for(let px=0;px<W;px+=2)if(a(px,py)>250)all.push(rgb(px,py));const plain=[0,1,2].map(k=>median(all.map(c=>c[k])));
    const sides=[-1,1].map((s,i)=>{
      const top=edge(s,34.4,35),low=edge(s,35.8,36.3),x=X(low-s*.4);let y=H-1;while(y>0&&a(x,y)<128)y--;
      // Cloth: median of the band inside the side line, from the pixels near
      // the shirt's plain cloth colour; outline: the darkest hem pixel there.
      // (2026-10-08 round 2: the female front's left band is mostly the big
      // daisy and its leaves, so the plain median gave a yellow-olive
      // underarm wedge under the raised sleeve.)
      const near=c=>Math.hypot(c[0]-plain[0],c[1]-plain[1],c[2]-plain[2])<60;
      let band=[];for(let py=Y(33.4);py<=Y(36);py++)for(let px=Math.min(X(top),X(top-s*.6));px<=Math.max(X(top),X(top-s*.6));px++)if(a(px,py)>250)band.push(rgb(px,py));
      band=band.filter(near).length>=8?band.filter(near):[plain];
      let line=[255,255,255];for(let py=y;py>y-8;py--)if(a(x,py)>200){const c=rgb(x,py);if(c[0]+c[1]+c[2]<line[0]+line[1]+line[2])line=c;}
      // The sleeve cap's top: there the sheet's shoulder line ends.
      const sleeve=part(sex+view+'Sleeve'+i,'sleeves',F.rects.sleeve[i]),sd=sleeve.canvas.getContext('2d').getImageData(0,0,sleeve.width,sleeve.height).data;let cap=null;
      for(let py=0;py<sleeve.height&&!cap;py++){const xs=[];for(let px=0;px<sleeve.width;px++)if(sd[(py*sleeve.width+px)*4+3]>128)xs.push(px);if(xs.length)cap=local(F,[sleeve.rect[0]+median(xs)+.5,sleeve.rect[1]+py+.5],F.neck,collar(F));}
      return{side:s,top,low,hem:by(y+.5),cap,cloth:hex([0,1,2].map(k=>median(band.map(c=>c[k])))),line:hex(line)};
    });
    sideCache.set(key,sides);return sides;
  }
  // Torso-local outline of one raised side (bottom to the cuff), or null
  // while the arm still hangs close to the body.
  function underarm(side,S,d){
    const s=side.side,n=[-s*d[1],s*d[0]],u=t=>[S[0]+n[0]*UNDERSIDE+d[0]*t,S[1]+n[1]*UNDERSIDE+d[1]*t];
    if(s*d[0]<.45)return null;
    // The side line leans through its two measured points; the armpit is
    // where it meets the sleeve's underside line.
    const slope=(side.low-side.top)/1.35,xAt=y=>side.top+slope*(y-34.7),tA=(xAt(S[1])-S[0]-n[0]*UNDERSIDE)/d[0],A=u(tA);
    if(A[1]>side.hem-1.2)return null;
    const r=.42,below=[xAt(A[1]+r),A[1]+r],after=u(tA+r),end=u(UNDERARM_END),cap=side.cap;
    return{s,n,d,A,below,after,end,cap,capEnd:[cap[0]+d[0]*(UNDERARM_END+1),cap[1]+d[1]*(UNDERARM_END+1)],hem:[xAt(side.hem-.05),side.hem-.05],far:[end[0]+d[0]*12,end[1]+d[1]*12],capFar:[cap[0]+d[0]*12,cap[1]+d[1]*12]};
  }
  function sprite(parent,owner){const e=el('image',{'data-outfit-part':owner,preserveAspectRatio:'none'});parent.append(e);return e;}
  function paint(e,art,key,x,y,w,h){if(e.dataset.outfitSource!==key){e.setAttribute('href',art.url);e.dataset.outfitSource=key;}set(e,'x',n(x));set(e,'y',n(y));set(e,'width',n(w));set(e,'height',n(h));}
  function clip(defs,id){const c=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),p=el('path');c.append(p);defs.append(c);return p;}
  function prepare(body){
    if(mounted.has(body.svg))return mounted.get(body.svg);const {svg,parts}=body,id=svg.dataset.foundationId+'-outfit',defs=el('g',{'data-outfit-defs':'true'});svg.querySelector('defs').append(defs);
    const r={body,defs,shirt:sprite(parts.torso,'shirt-torso'),hip:sprite(parts.pelvis,'shorts-hip'),sleeves:[],shoes:[],fit:null};
    r.hip.dataset.outfitDeformation='pelvis-left-thigh-right-thigh';
    // Underarm cloth and side line of a raised arm; present from the start so
    // a gesture never adds nodes.
    r.shirtClip=clip(defs,id+'-shirt-side');r.shirtClipId=id+'-shirt-side';
    r.underarms=[0,1].map(i=>{const fill=el('path',{'data-outfit-part':'underarm-'+i,stroke:'none'}),line=el('path',{'data-outfit-part':'underarm-line-'+i,fill:'none','stroke-width':.085,'stroke-linecap':'round','stroke-linejoin':'round'});parts.torso.insertBefore(fill,r.shirt);parts.torso.append(line);fill.style.display=line.style.display='none';return{fill,line};});
    for(let i=0;i<2;i++){
      const arm=body.arms[i],leg=body.legs[i],sleeve=el('g',{'data-outfit-owner':'arm-'+i}),shoe=el('g',{'data-outfit-owner':'foot-'+i});
      arm.parent.insertBefore(sleeve,arm.hand);leg.parent.append(shoe);
      const skinClip=clip(defs,id+'-arm-skin-'+i);arm.contour.setAttribute('clip-path','url(#'+id+'-arm-skin-'+i+')');arm.shade.setAttribute('clip-path','url(#'+id+'-arm-skin-'+i+')');
      r.sleeves.push({group:sleeve,image:sprite(sleeve,'sleeve-'+i),skinClip});
      r.shoes.push({group:shoe,image:sprite(shoe,'shoe-'+i)});
    }
    mounted.set(svg,r);return r;
  }
  function apply(body,pose){
    if(!atlas.ready||!R)return false;const r=prepare(body),{profile,back}=pose,view=profile?'Profile':back?'Back':'Front',sex=body.svg.dataset.qpxSex==='m'?'m':'f',F=figure(sex,view),S=spec(sex);
    // Covered calibration underwear and bare feet have no second visible copy.
    body.underlay.style.display='none';
    body.pelvis.contour.style.display='none';body.pelvis.shade.style.display='none';body.torso.contour.style.display='none';body.torso.shade.style.display='none';
    {const art=part(sex+view+'Shirt','shirt',F.rects.shirt),[x,y]=local(F,art.rect,F.neck,collar(F));paint(r.shirt,art,sex+view+'Shirt',x,y,art.width*F.k,art.height*F.k);}
    const shorts=shortsTexture(sex,view,pose);for(const[k,v]of Object.entries({href:shorts.url,x:shorts.x,y:shorts.y,width:shorts.w,height:shorts.h}))set(r.hip,k,v);r.hip.dataset.outfitSource=sex+view+'Shorts';
    const fit={view,sex,coveredFeet:2,sleeves:[],legs:[],shoes:[]};
    pose.arms.forEach((arm,i)=>{
      const s=r.sleeves[i],turn=Math.atan2(arm.elbow[1]-arm.shoulder[1],arm.elbow[0]-arm.shoulder[0])-Math.PI/2,angle=Math.atan2(Math.sin(turn),Math.cos(turn)),lean=profile?pose.lean*Math.PI/180:0;
      set(s.group,'transform','translate('+pt(arm.shoulder)+') rotate('+n(angle*180/Math.PI)+')');
      // Hide the upper arm owned by the body inside its sleeve: everything
      // above the opaque cuff, measured down the arm from the shoulder.
      const cuff=(F.cuff_top-F.joints.shoulder[i][1])*F.k;
      // A raised arm's forearm can fold back up beside its own sleeve (the
      // climbing pull): only the upper arm's own width (painted half widths
      // reach .88) is hidden above the cuff, so the folded forearm is not cut
      // off along the cuff line in mid air (a pale spike beside the sleeve).
      const bare=(arm.lift||0)>0?'M-8 .6H-1V'+n(cuff)+'H-8ZM1 .6H8V'+n(cuff)+'H1Z':'';
      set(s.skinClip,'transform',s.group.getAttribute('transform'));set(s.skinClip,'d','M-8 '+n(cuff)+'H8V15H-8Z'+bare);
      set(s.image,'href',sleeveTexture(sex,view,i,angle,lean,arm.lift||0).url);for(const[k,v]of Object.entries({x:-4,y:-4,width:8,height:8}))set(s.image,k,v);
      s.image.dataset.sleeveDeformation='seam-pinned';s.image.dataset.sleeveArt=sex+view+i;
      fit.sleeves.push({shoulder:arm.shoulder,opening:[arm.shoulder[0]-Math.sin(angle)*cuff,arm.shoulder[1]+Math.cos(angle)*cuff],armPoint:mix(arm.shoulder,arm.elbow,.52),width:F.rects.sleeve[i][2]*F.k});
    });
    raisedSides(r,pose,sex,view);
    pose.legs.forEach((leg,i)=>{
      const s=r.shoes[i];body.legs[i].foot.style.display='none';
      // A seated foot may face another way than the body view (the crossed
      // feet of 아빠다리): it then uses that direction's whole shoe drawing,
      // never a squashed one, anchored at the shoe's own ankle opening.
      const seat=leg.seatShoe,artView=seat?.view||view,index=seat?.view?seat.index:i,SF=figure(sex,artView),key=sex+artView+'Shoe'+index,art=part(key,'shoes',SF.rects.shoe[index]),anchor=SF.joints.ankle[index];
      // The ankle lives inside the transparent opening. The shoe front is in
      // front of the lower leg, while the sole has a single ground anchor.
      const shoeAngle=seat?.view?seat.angle:leg.shoeAngle*180/Math.PI,flip=seat?.view?seat.flip:1;
      set(s.group,'transform','translate('+pt(leg.ankle)+') rotate('+n(shoeAngle)+') scale('+flip+' 1)');
      paint(s.image,art,key,(art.rect[0]-anchor[0])*SF.k,(art.rect[1]-anchor[1])*SF.k,art.width*SF.k,art.height*SF.k);
      s.group.style.display=seat?.hidden?'none':'';
      // Crossed feet seen from the front lie under both shins (each foot is
      // tucked under the other leg): both shoes go first in the far leg, the
      // near foot over the far one. Otherwise a shoe is its leg's last layer.
      if(seat?.under){const host=body.legs[0].parent,at=i?r.shoes[0].group.nextSibling:host.firstChild;if(s.group.parentNode!==host||(i?s.group.previousSibling!==r.shoes[0].group:host.firstChild!==s.group))host.insertBefore(s.group,at);}
      else{const parent=body.legs[i].parent;if(s.group.parentNode!==parent||parent.lastChild!==s.group)parent.append(s.group);}
      const soleHeight=(SF.floor-anchor[1])*SF.k;
      fit.legs.push({root:leg.root,cuff:mix(leg.root,leg.knee,.81),owner:i});
      fit.shoes.push({ankle:leg.ankle,contact:leg.contact,soleHeight,soleY:leg.ankle[1]+soleHeight*Math.cos(shoeAngle*Math.PI/180),owner:i,view:key});
    });
    r.fit=fit;body.svg.dataset.foundationOutfit='basic';return true;
  }
  function raisedSides(r,pose,sex,view){
    const [a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=p=>[(d*(p[0]-tx)-c*(p[1]-ty))/det,(-b*(p[0]-tx)+a*(p[1]-ty))/det];
    const sides=pose.profile?null:shirtSide(sex,view),P=pt,shapes=pose.arms.map((arm,i)=>{
      if(!sides||!(arm.lift>.02))return null;const S=unmap(arm.shoulder),e=unmap(arm.elbow),v=[e[0]-S[0],e[1]-S[1]],l=Math.hypot(...v)||1;
      const shape=underarm(sides[i],S,[v[0]/l,v[1]/l]);return shape&&{...shape,S,side:sides[i]};
    });
    shapes.forEach((c,i)=>{
      const u=r.underarms[i];u.fill.style.display=u.line.style.display=c?'':'none';if(!c){u.fill.removeAttribute('d');u.line.removeAttribute('d');return;}
      const inner=c.s*.45,curve='L'+P(c.below)+'Q'+P(c.A)+' '+P(c.after)+'L'+P(c.end);
      set(u.fill,'d','M'+P([c.hem[0]-inner,c.hem[1]])+'L'+P(c.hem)+curve+'L'+P(c.capEnd)+'L'+P(c.cap)+'L'+P([c.cap[0]-inner,c.cap[1]+.4])+'L'+P([c.below[0]-inner,c.below[1]])+'Z');
      set(u.line,'d','M'+P(c.hem)+curve);set(u.fill,'fill',c.side.cloth);set(u.line,'stroke',c.side.line);
    });
    // The shirt beyond the clean lines is cut away: one polygon, the left
    // side up, across the top, the right side down.
    if(shapes.some(Boolean)){
      const [L,Rr]=shapes;
      const left=L?'M'+P([L.hem[0],70])+'L'+P(L.hem)+'L'+P(L.below)+'Q'+P(L.A)+' '+P(L.after)+'L'+P(L.end)+'L'+P(L.far)+'L'+P(L.capFar)+'L'+P(L.cap)+'L'+P([L.cap[0],-30]):'M-10 70L-10 -30';
      const right=Rr?'L'+P([Rr.cap[0],-30])+'L'+P(Rr.cap)+'L'+P(Rr.capFar)+'L'+P(Rr.far)+'L'+P(Rr.end)+'L'+P(Rr.after)+'Q'+P(Rr.A)+' '+P(Rr.below)+'L'+P(Rr.hem)+'L'+P([Rr.hem[0],70])+'Z':'L42 -30L42 70Z';
      set(r.shirtClip,'d',left+right);set(r.shirt,'clip-path','url(#'+r.shirtClipId+')');
    }else r.shirt.removeAttribute('clip-path');
  }
  function destroy(svg){const r=mounted.get(svg);if(!r)return;for(const e of [r.shirt,r.hip,...r.underarms.flatMap(u=>[u.fill,u.line]),...r.sleeves.map(p=>p.group),...r.shoes.map(p=>p.group),r.defs])e.remove();r.body.underlay.style.display='';r.body.pelvis.contour.style.display='';r.body.pelvis.shade.style.display='';r.body.torso.shade.style.display='';r.body.torso.contour.style.display='';for(const leg of r.body.legs)if(leg.foot)leg.foot.style.display='';for(const arm of r.body.arms){arm.contour.removeAttribute('clip-path');arm.shade.removeAttribute('clip-path');}mounted.delete(svg);}
  root.QPFoundationOutfit=Object.freeze({atlas,files,load,apply,destroy,inspect:svg=>mounted.get(svg)?.fit||null});
})(window);
