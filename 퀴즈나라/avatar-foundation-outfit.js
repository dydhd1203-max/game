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
  // A pooled image ({url}) is compared by reference: reading a data-URL href
  // back every frame copied the whole string.
  const href=(e,art)=>{if(e.paintedArt!==art){set(e,'href',art.url);e.paintedArt=art;}};
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
  // Sleeves and shorts share the painted limbs' bounded pool
  // (avatar-foundation-skin.js paintCache).
  const sleeveCache=root.QPFoundationSkin.paintCache('sleeve'),shortsCache=root.QPFoundationSkin.paintCache('shorts');
  function sleeveTexture(sex,view,i,angle,lean,lift=0){
    const F=figure(sex,view),profile=view==='Profile',S=rig(sex,view),restAngle=profile?-Math.atan2(...S.profileSwing):Math.atan2(S.elbow[i][1]-S.shoulder[i][1],S.elbow[i][0]-S.shoulder[i][0])-Math.PI/2;
    const delta=Math.round((angle-restAngle-lean)*180/Math.PI/2)*2*Math.PI/180,raise=Math.round(clamp(lift,0,1)*10)/10;
    // Pinning fades for a raised arm: a sewn cap stretched across 120° tore.
    // A gesture-raised arm carries its whole sleeve from the start (the
    // underarm cloth below fills the shirt behind it); a half-pinned cap
    // stretched into a long tube during the raise.
    const hold=(1-smooth(clamp((Math.abs(delta)*180/Math.PI-40)/50,0,1)))*(1-smooth(clamp(raise*2.5,0,1)));
    // With nothing pinned (hold 0: raised .4 or more, or turned 90° or more)
    // or no turn, every vertex stays at its resting place: one image, the
    // same bytes for every such angle and raise (round 3: in a mixed crowd
    // 202 of 363 cached sleeves were copies of it).
    // A raised front/back sleeve draws from its own cleaned art
    // (raisedSleeve), so its resting image is a separate entry (merge of
    // round 3: the shared 'rest' key would have handed a raised arm the
    // hanging sleeve's picture with the inner strip, or the reverse).
    const raisedArt=raise>0&&!profile,cacheKey=(hold===0||delta===0?[sex,view,i,raisedArt?'rest-raised':'rest']:[sex,view,i,Math.round(delta*180/Math.PI),raise]).join(':'),cached=sleeveCache.get(cacheKey);if(cached)return cached;
    const art=raisedArt?raisedSleeve(sex,view,i,F,restAngle):part(sex+view+'Sleeve'+i,'sleeves',F.rects.sleeve[i]),shoulder=F.joints.shoulder[i],c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),cols=10,rows=12,vertices=[];
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,px=[art.rect[0]+u*art.width,art.rect[1]+v*art.height];
      // Sleeve frame: y runs down the resting upper arm from the shoulder.
      const q=rotate([(px[0]-shoulder[0])*F.k,(px[1]-shoulder[1])*F.k],-restAngle),along=smooth(clamp((q[1]+.2)/2.2,0,1));
      const inward=profile?.6:smooth(clamp(((i?-q[0]:q[0])+.5)/1.2,0,1)),pin=hold*inward*(1-along),fixed=rotate(q,-delta),p=mix(q,fixed,pin);
      vertices.push({s:[u*art.width,v*art.height],d:[(p[0]+4)*32,(p[1]+4)*32]});
    }
    meshDraw(ctx,art.canvas,vertices,cols,rows);
    return sleeveCache.set(cacheKey,{url:c.toDataURL()});
  }
  // The sleeve drawing of a gesture-raised arm (front/back) without the
  // strip of cloth that hangs down beside and below the cuff on its inner
  // side. On the sheet that strip lies over the shirt's side next to the
  // hanging arm; turned up with the sleeve it stuck out past the cuff as a
  // straight-edged green triangle (2026-10-08, round 3). In the sleeve's own
  // frame, cloth (green) pixels are cleared below the cuff's top edge
  // (measured per strip across the arm from the cuff's cream band and brown
  // line; inward of the cuff's inner end that edge continues flat) and
  // inward of the cuff's inner end from 1 above the cuff row down.
  function raisedSleeve(sex,view,i,F,restAngle){
    const key=sex+view+'SleeveRaised'+i;if(atlas.parts[key])return atlas.parts[key];
    const src=part(sex+view+'Sleeve'+i,'sleeves',F.rects.sleeve[i]),W=src.width,H=src.height,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.drawImage(src.canvas,0,0);
    const img=ctx.getImageData(0,0,W,H),d=img.data,s=i?1:-1,sh=F.joints.shoulder[i],cuff=(F.cuff_top-sh[1])*F.k,cs=Math.cos(-restAngle),sn=Math.sin(-restAngle),t=new Float32Array(W*H),w=new Float32Array(W*H),band=new Int16Array(W*H),top=new Map();let end=-9;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const j=y*W+x,o=j*4,vx=(src.rect[0]+x+.5-sh[0])*F.k,vy=(src.rect[1]+y+.5-sh[1])*F.k;t[j]=vx*sn+vy*cs;w[j]=-s*(vx*cs-vy*sn);band[j]=Math.round(w[j]*20);
      const R=d[o],G=d[o+1],B=d[o+2];if(d[o+3]<=128||t[j]<=cuff-.2)continue;if(R>190&&G>150&&B>110&&R-B>25||R+G+B<360&&R>=G-4){top.set(band[j],Math.min(top.get(band[j])??9,t[j]));end=Math.max(end,w[j]);}}
    if(top.size){const inner=Math.max(...top.keys()),innerTop=top.get(inner);
      for(let j=0;j<W*H;j++){const o=j*4;if(d[o+3]<=20||d[o+1]<=d[o]+8)continue;const limit=top.get(band[j])??(band[j]>inner?innerTop:9);if(t[j]>limit+.05||t[j]>cuff-1&&w[j]>end+.02)d[o+3]=0;}
      ctx.putImageData(img,0,0);}
    return atlas.parts[key]={rect:src.rect,canvas:c,width:W,height:H};
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
  // Cross-legged shorts seen from the side (2026-10-08, round 3). Turning
  // the front columns of the one standing drawing with the thigh (the desk
  // side mapping) left a short stub by the knee: the turned columns all lay
  // above the thigh line and the blend toward the upright seat smeared the
  // rest, so the knee read as a bare bulb under the shirt. Here, as the
  // front/back floor seat does, two pieces of the same drawing make one
  // picture:
  //  - the seat: the denim above the cuff, upright under the shirt and
  //    scaled down to sit on the floor (the floor line in torso space, so
  //    the leaning body's seat still rests on it), its bottom rounded at the
  //    back and front and outlined along that curve;
  //  - the near thigh: the drawing's leg (the denim from the hip down, with
  //    its rolled cuff) turned rigidly onto the thigh: hip flexion turns the
  //    front of the leg into the top of the thigh, the drawing is narrowed
  //    to a thigh's thickness, and the cuff wraps the thigh just behind the
  //    knee, so the round knee comes out of it. It lies over the seat; its
  //    start fades into the seat denim, whose lap stretches forward under
  //    it along the floor (a seat ending in a front edge showed a gap and a
  //    see-through wedge under the thigh's start);
  //  - a tucked foot (seatShoe.lap): drawn between the two, in front of
  //    the lap and behind the raised thigh.
  // Sheet rows: cut = just above the cuff's upper outline, cuff = the cuff's
  // lower outline (read off the sheet; skin below it is dropped).
  const SIDE_SEAT={'m-right':{cut:449,cuff:465.5},'f-right':{cut:970,cuff:988.5}},SIDE_THIGH={across:.45,back:.25,tuck:.6,fade:.6};
  function sideFloorShorts(sex,S,F,art,pose,projected){
    const T=SIDE_SEAT[sex+'-right'],ly=py=>collar(F)[1]+(py-F.neck[1])*F.k,lx=px=>16+(px-F.neck[0])*F.k;
    const x0=lx(art.rect[0]),y0=ly(art.rect[1]),w=art.width*F.k,h=art.height*F.k,cut=ly(T.cut),cuff=ly(T.cuff),top=S.waist-.5;
    // The floor in torso space: the seat rests on it under a leaning body.
    const [a,b,c,d,tx,ty]=pose.torso,floorAt=x=>(S.floor-ty-b*x)/d;
    const [L,R]=rowSpan(art,F,T.cut-1),mid=(L+R)/2;
    // The near thigh: hip to knee in torso space.
    const near=projected[1],v=[near.knee[0]-near.root[0],near.knee[1]-near.root[1]],len=Math.hypot(...v)||1,u=[v[0]/len,v[1]/len],angle=Math.atan2(u[1],u[0])-Math.PI/2;
    const end=[near.knee[0]-u[0]*SIDE_THIGH.back,near.knee[1]-u[1]*SIDE_THIGH.back],start=cuff-(len-SIDE_THIGH.back+SIDE_THIGH.tuck),source=[mid,cuff];
    const place=p=>{const q=rotate([(p[0]-source[0])*SIDE_THIGH.across,p[1]-source[1]],angle);return[end[0]+q[0],end[1]+q[1]];};
    // The seat's lap runs forward under the thigh's start (there is no front
    // edge between the seat and the thigh): each row of its front stretches
    // to the thigh's underside line, up to just past the thigh's faded start,
    // so the fade always lies over denim.
    const q0=place([x0,start]),cap=place([x0,start+SIDE_THIGH.fade])[0]+.25,front=y=>clamp(q0[0]+(y-q0[1])*u[0]/(u[1]||-1e-6),R,Math.max(R,cap));
    const seatAt=(x,y)=>{const t=clamp((y-top)/(cut-top),0,1),f=smooth(clamp((x-mid)/(R-mid),0,1)),out=y<top?y:top+(floorAt(x)-top)*t;return[x+(front(out)-R)*f,out];};
    const reach=front(floorAt(R))-R,corners=[[x0,start],[x0+w,start],[x0,cuff],[x0+w,cuff]].map(place),pts=[[x0,y0],[x0+w,y0],[x0,floorAt(x0)],[x0+w+reach,floorAt(x0+w+reach)],...corners];
    const bx=Math.min(...pts.map(p=>p[0]))-.1,by=Math.min(...pts.map(p=>p[1]))-.1,bw=Math.max(...pts.map(p=>p[0]))-bx+.1,bh=Math.max(...pts.map(p=>p[1]))-by+.1,scale=16;
    const layer=()=>{const cv=document.createElement('canvas');cv.width=Math.ceil(bw*scale);cv.height=Math.ceil(bh*scale);const x=cv.getContext('2d');x.imageSmoothingQuality='high';x.setTransform(scale,0,0,scale,-bx*scale,-by*scale);return[cv,x];};
    const [seat,sc]=layer(),[thigh,tc]=layer();
    // Seat bottom: on the floor line, rounded up at the back (a seated
    // bottom, not a box) and softly into the lap at the front, outlined.
    const edge=[],backRound=.9,frontRound=.35,R2=R+reach;for(let j=0;j<=36;j++){const x=mix([R2],[L],j/36)[0],r=x>mid?frontRound:backRound,dd=Math.min(x-L,R2-x),lift=r*(1-Math.sqrt(Math.max(0,1-Math.pow(clamp(1-dd/r,0,1),2))));edge.push([x,floorAt(x)-lift-.02]);}
    const soft=(ctx,join)=>edge.forEach((p,j)=>ctx[j||join?'lineTo':'moveTo'](...p));
    sc.save();sc.beginPath();sc.moveTo(x0-1,y0-1);sc.lineTo(R2+1,y0-1);sc.lineTo(R2+1,edge[0][1]);soft(sc,true);sc.lineTo(x0-1,edge.at(-1)[1]);sc.closePath();sc.clip();
    {const cols=8,rows=10,verts=[];for(let r=0;r<=rows;r++)for(let k=0;k<=cols;k++){const sx=k/cols*art.width,sy=r/rows*(T.cut-art.rect[1]),p=[x0+sx*F.k,y0+sy*F.k],q=seatAt(...p);verts.push({s:[sx,sy],d:[(q[0]-bx)*scale,(q[1]-by)*scale]});}
     sc.setTransform(1,0,0,1,0,0);meshDraw(sc,art.canvas,verts,cols,rows);}
    sc.restore();
    sc.save();sc.globalCompositeOperation='source-atop';sc.strokeStyle=edgeTone(sex+'Profile',art.canvas);sc.lineWidth=.22;sc.lineCap='round';sc.lineJoin='round';sc.beginPath();soft(sc);sc.stroke();sc.restore();
    // Thigh: the leg rows from `start` through the cuff, turned onto the
    // thigh, never below the floor.
    tc.save();tc.beginPath();tc.moveTo(bx-1,floorAt(bx-1));tc.lineTo(bx+bw+1,floorAt(bx+bw+1));tc.lineTo(bx+bw+1,by-1);tc.lineTo(bx-1,by-1);tc.closePath();tc.clip();
    tc.translate(...end);tc.rotate(angle);tc.scale(SIDE_THIGH.across,1);tc.translate(-source[0],-source[1]);tc.beginPath();tc.rect(x0-.1,start,w+.2,cuff-start+.02);tc.clip();tc.drawImage(art.canvas,x0,y0,w,h);tc.restore();
    // Its start fades into the seat denim (under the shirt hem and the lap).
    {const s0=place([mid,start]),s1=place([mid,start+SIDE_THIGH.fade]),g=tc.createLinearGradient(...s0,...s1);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');tc.save();tc.globalCompositeOperation='destination-in';tc.fillStyle=g;tc.fillRect(bx-1,by-1,bw+2,bh+2);tc.restore();}
    sc.setTransform(1,0,0,1,0,0);sc.drawImage(thigh,0,0);
    // A foot tucked in front of the seat (seatShoe.lap) lies in the open
    // space under the raised near thigh, upright on the floor (the torso's
    // lean taken back): in front of the lap and of the thigh's faded start,
    // behind the thigh itself (masked by the thigh's opacity), so it is
    // painted into this picture.
    for(const[i,leg]of pose.legs.entries()){const seat=leg.seatShoe;if(!seat?.lap)continue;const SF=figure(sex,seat.view),shoe=part(sex+seat.view+'Shoe'+seat.index,'shoes',SF.rects.shoe[seat.index]),anchor=SF.joints.ankle[seat.index],[fc,fx]=layer();
      fx.translate(...projected[i].ankle);fx.rotate((seat.angle||0)*Math.PI/180-Math.atan2(b,a));fx.scale(seat.flip||1,1);fx.drawImage(shoe.canvas,(shoe.rect[0]-anchor[0])*SF.k,(shoe.rect[1]-anchor[1])*SF.k,shoe.width*SF.k,shoe.height*SF.k);
      fx.setTransform(1,0,0,1,0,0);fx.globalCompositeOperation='destination-out';fx.drawImage(thigh,0,0);sc.drawImage(fc,0,0);}
    return{url:seat.toDataURL(),x:bx,y:by,w:seat.width/scale,h:seat.height/scale};
  }
  // One continuous shorts drawing, weighted to pelvis and both thighs. The
  // waist and each cuff occur once; the skinning regions share seam vertices.
  function shortsTexture(sex,view,pose){
    const S=rig(sex,view),F=figure(sex,view),profile=pose.profile,key=[sex,view,pose.floor,pose.desk,pose.lean,...pose.legs.flatMap(l=>[...l.root,...l.knee,...(pose.floor?l.ankle:[]),l.seatShoe?.lap?1:0])].map(v=>typeof v==='number'?Math.round(v*24)/24:v).join(':'),cached=shortsCache.get(key);if(cached)return cached;
    const art=part(sex+view+'Shorts','shorts',F.rects.shorts),cols=10,rows=10,vertices=[];
    const [a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=p=>[(d*(p[0]-tx)-c*(p[1]-ty))/det,(-b*(p[0]-tx)+a*(p[1]-ty))/det];
    const projected=pose.legs.map(l=>({root:unmap(l.root),knee:unmap(l.knee),ankle:unmap(l.ankle)})),start=S.waist-.6;
    if(pose.floor&&profile&&SIDE_SEAT[sex+'-right'])return shortsCache.set(key,sideFloorShorts(sex,S,F,art,pose,projected));
    if((pose.floor||pose.desk)&&!profile)return shortsCache.set(key,seatedShorts(sex,view,S,F,art,projected,pose));
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
    return shortsCache.set(key,{url:canvas.toDataURL(),x,y,w:canvas.width/scale,h:canvas.height/scale});
  }
  // Underarm of a gesture-raised arm (front/back). On the sheet the hanging
  // arm hides the shirt's sides and shoulder corners; the generator
  // (build-reference-body.py side_outline) continues the painted side
  // contour under the sleeve as a curve up to the shoulder, so the shirt's
  // own edge is one curved line from the hem to the shoulder. A raised arm
  // shows the armpit: the shirt keeps that painted edge up to where it meets
  // the raised sleeve's underside, turns there in a soft round armpit and
  // follows the sleeve's own underside edge to its cuff. The
  // refilled cloth colour lies under the shirt in that band, so the sleeve's
  // feathered seam (made to blend into the shirt) and the shirt's own soft
  // edges never show the background; the painted side line's colour draws
  // the new edge.
  // 2026-10-08, round 3: the side was a straight line through two points of
  // the hem flare and the sleeve's underside a straight line 1.3 from the
  // arm. The hem flare runs inward going up while the painted waist runs
  // outward, so the two met in a small sharp notch at the armpit (and the
  // armpit was solved at the shoulder's height, not where the lines cross,
  // which left a knob); the straight underside stood off the sleeve's
  // tapering edge as a flat cloth wedge and ran on past the cuff.
  // Above its cuff the sleeve's underside is a soft feathered edge without
  // an outline (it lay against the shirt on the sheet), so the new edge's
  // line runs just outside it (SLEEVE_RIM) with the cloth under it, from the
  // armpit to the cuff; the cuff has its own drawn edge and covers the end.
  // ARMPIT: radius of the round armpit; CUT_END: how far along the arm (from
  // the shoulder) the cut follows the sleeve (it ends ~4 along the arm).
  const sideCache=new Map(),underCache=new Map(),SLEEVE_RIM=.03,ARMPIT=.45,CUT_END=3;
  const lerp2=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
  function shirtSide(sex,view){
    const key=sex+view;if(sideCache.has(key))return sideCache.get(key);
    const F=figure(sex,view),art=part(sex+view+'Shirt','shirt',F.rects.shirt),W=art.width,H=art.height,data=art.canvas.getContext('2d').getImageData(0,0,W,H).data,C=spec(sex).collar;
    const Y=y=>Math.round((y-C)/F.k+F.neck[1]-art.rect[1]),bx=px=>16+(px+art.rect[0]-F.neck[0])*F.k,by=py=>C+(py+art.rect[1]-F.neck[1])*F.k;
    const a=(x,y)=>x<0||y<0||x>=W||y>=H?0:data[(y*W+x)*4+3],rgb=(x,y)=>[0,1,2].map(k=>data[(y*W+x)*4+k]),lum=c=>.3*c[0]+.59*c[1]+.11*c[2];
    const median=v=>v.slice().sort((p,q)=>p-q)[v.length>>1];
    const hex=c=>'#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
    // The shirt's plain cloth colour: the median of all its opaque pixels
    // (prints and outlines are a small share of the picture).
    const all=[];for(let py=0;py<H;py+=2)for(let px=0;px<W;px+=2)if(a(px,py)>250)all.push(rgb(px,py));const plain=[0,1,2].map(k=>median(all.map(c=>c[k])));
    const R=rig(sex,view),sides=[-1,1].map((s,i)=>{
      // The sleeve cap's top: there the sheet's shoulder line ends.
      const sleeve=part(sex+view+'Sleeve'+i,'sleeves',F.rects.sleeve[i]),sd=sleeve.canvas.getContext('2d').getImageData(0,0,sleeve.width,sleeve.height).data;let cap=null;
      for(let py=0;py<sleeve.height&&!cap;py++){const xs=[];for(let px=0;px<sleeve.width;px++)if(sd[(py*sleeve.width+px)*4+3]>128)xs.push(px);if(xs.length)cap=local(F,[sleeve.rect[0]+median(xs)+.5,sleeve.rect[1]+py+.5],F.neck,collar(F));}
      // The painted side edge (alpha one half) row by row from the sleeve
      // cap down to just above the hem, lightly smoothed, every second row.
      const xEdge=py=>{let x=s>0?W-1:0;while(x>=0&&x<W&&a(x,py)<128)x-=s;if(x<0||x>=W)return null;const cur=a(x,py)/255,prev=a(x+s,py)/255;return x+.5+s*clamp((cur-.5)/Math.max(1e-6,cur-prev),0,1);};
      let hemRow=H-1;{const x=Math.round(xEdge(Y(36))-s*6);while(hemRow>0&&a(x,hemRow)<128)hemRow--;}
      const rows=[];for(let py=Math.max(0,Y(cap[1])+1);py<=hemRow-4;py++){const e=xEdge(py);if(e!==null)rows.push([e,py]);}
      for(let pass=0;pass<2;pass++){const x=rows.map(r=>r[0]);for(let j=1;j<rows.length-1;j++)rows[j][0]=(x[j-1]+2*x[j]+x[j+1])/4;}
      const edge=rows.filter((r,j)=>j%2===0||j===rows.length-1).map(([e,py])=>[bx(e),by(py+.5)]);edge.push([edge[edge.length-1][0],by(hemRow+.5)-.05]);
      // The painted side line: how far inside the edge its darkest pixels
      // lie, and their colour, over the waist (sheet and generator rows).
      const inside=[],dark=[];for(const [e,py] of rows){const y=by(py+.5);if(y<32.6||y>35.6)continue;let best=null;for(let j=0;j<5;j++){const x=Math.floor(e-s*(j+.5));if(x<0||x>=W||a(x,py)<250)continue;const c=rgb(x,py);if(!best||lum(c)<lum(best.c))best={c,d:Math.abs(x+.5-e)};}if(best){inside.push(best.d);dark.push(best.c);}}
      // Cloth: median of the band inside the side line from the pixels near
      // the shirt's plain cloth colour. (2026-10-08 round 2: the female
      // front's left band is mostly the big daisy and its leaves, so the
      // plain median gave a yellow-olive underarm wedge.)
      const near=c=>Math.hypot(c[0]-plain[0],c[1]-plain[1],c[2]-plain[2])<60;let band=[];
      for(const [e,py] of rows){const y=by(py+.5);if(y<33.4||y>36)continue;for(let j=1;j<=10;j++){const x=Math.floor(e-s*(j+.5));if(a(x,py)>250)band.push(rgb(x,py));}}
      band=band.filter(near).length>=8?band.filter(near):[plain];
      // The sleeve's underside edge in its own frame (t down the resting
      // upper arm from the shoulder, w across toward the body), every .1:
      // a raised sleeve is this drawing turned rigidly with the arm.
      // (The raised drawing, without the strip below the cuff: raisedSleeve.)
      const sh=F.joints.shoulder[i],rest=Math.atan2(R.elbow[i][1]-R.shoulder[i][1],R.elbow[i][0]-R.shoulder[i][0])-Math.PI/2,under=new Map(),up=raisedSleeve(sex,view,i,F,rest),ud=up.canvas.getContext('2d').getImageData(0,0,up.width,up.height).data;
      for(let py=0;py<sleeve.height;py++)for(let px=0;px<sleeve.width;px++){if(ud[(py*sleeve.width+px)*4+3]<128)continue;const q=rotate([(sleeve.rect[0]+px+.5-sh[0])*F.k,(sleeve.rect[1]+py+.5-sh[1])*F.k],-rest),t=Math.round(q[1]*10);under.set(t,Math.max(under.get(t)??-9,-s*q[0]));}
      const t0=Math.min(...under.keys()),t1=Math.max(...under.keys()),w=[];for(let t=t0;t<=t1;t++)w.push(under.get(t)??w[w.length-1]??0);
      const ws=w.map((v,j)=>(w[Math.max(0,j-1)]+2*v+w[Math.min(w.length-1,j+1)])/4);
      // Where the cuff begins along the arm: its edge stands out from the
      // sleeve's (a step of .12 within .3), else the sheet's cuff row.
      let cuff=(F.cuff_top-sh[1])*F.k;for(let j=12-t0;j+3<ws.length&&j<=30-t0;j++)if(ws[j+3]-ws[j]>=.12){cuff=(j+t0)/10+.1;break;}
      // The line follows the edge smoothed over ~.8 (petals on the female
      // sleeve's edge made it wavy).
      let soft=ws;for(let pass=0;pass<2;pass++)soft=soft.map((v,j)=>{let sum=0,n=0;for(let k=-2;k<=2;k++){const q=soft[j+k];if(q!==undefined){sum+=q;n++;}}return sum/n;});
      return{side:s,edge,hem:edge[edge.length-1][1],cap,inset:inside.length?median(inside)*F.k:.08,under:{t0:t0/10,w:soft},cuff,cloth:hex([0,1,2].map(k=>median(band.map(c=>c[k])))),line:hex(dark.length?[0,1,2].map(k=>median(dark.map(c=>c[k]))):plain.map(v=>v*.35))};
    });
    sideCache.set(key,sides);return sides;
  }
  // Torso-local outline of one raised side, or null while the arm still
  // hangs close to the body: the painted edge from the hem, a round armpit
  // where it meets the sleeve's underside, then that underside out along
  // the arm, just outside its soft edge to the cuff. Lists run from the hem
  // upward: cut (the shirt's clip side), fill (cloth under the shirt) and
  // stroke (the new edge's line).
  function underarm(side,S,d,key){
    if(underCache.has(key))return underCache.get(key);
    const s=side.side,n=[-s*d[1],s*d[0]];let shape=null;
    if(s*d[0]>=.45){
      const U=side.under,wAt=t=>{const f=clamp((t-U.t0)*10,0,U.w.length-1),j=Math.floor(f),k=Math.min(j+1,U.w.length-1);return U.w[j]+(U.w[k]-U.w[j])*(f-j);};
      const under=(t,o=SLEEVE_RIM)=>{const w=wAt(t)+o;return[S[0]+d[0]*t+n[0]*w,S[1]+d[1]*t+n[1]*w];};
      // The painted line's centre: the edge moved inward by its inset.
      const edge=side.edge,line=edge.map(p=>[p[0]-s*side.inset,p[1]]);
      // The armpit: walking up from the hem, the first crossing of the line
      // with the sleeve's underside (inward of the sleeve drawing the
      // underside runs on along the arm's line).
      const ts=[];for(let t=-1.5;t<=CUT_END+1e-6;t+=.1)ts.push(t);const low=ts.map(t=>under(t));
      const cross=(p,q,u,v)=>{const r=[q[0]-p[0],q[1]-p[1]],e=[v[0]-u[0],v[1]-u[1]],den=r[0]*e[1]-r[1]*e[0];if(Math.abs(den)<1e-9)return null;const g=[u[0]-p[0],u[1]-p[1]],x=(g[0]*e[1]-g[1]*e[0])/den,y=(g[0]*r[1]-g[1]*r[0])/den;return x>=0&&x<=1&&y>=0&&y<=1?[x,y]:null;};
      let hit=null;for(let j=line.length-1;j>0&&!hit;j--)for(let k=0;k<low.length-1;k++){const c=cross(line[j],line[j-1],low[k],low[k+1]);if(c){hit={j,a:c[0],t:ts[k]+.1*c[1]};break;}}
      const A=hit&&lerp2(line[hit.j],line[hit.j-1],hit.a);
      if(A&&A[1]<=side.hem-1.2){
        // A point `dist` below the armpit along the line, and the index of
        // the first line vertex under it.
        const down=dist=>{let p=A,left=dist;for(let j=hit.j;j<line.length;j++){const q=line[j],l=Math.hypot(q[0]-p[0],q[1]-p[1]);if(l>=left)return{at:lerp2(p,q,left/l),j};p=q;left-=l;}return{at:p,j:line.length};};
        // Round armpit through the crossing, ARMPIT along each side of it.
        const B=down(ARMPIT),from=down(ARMPIT+.5),E=under(hit.t+ARMPIT),corner=[];
        for(let k=0;k<=16;k++){const u=k/16;corner.push([(1-u)*(1-u)*B.at[0]+2*u*(1-u)*A[0]+u*u*E[0],(1-u)*(1-u)*B.at[1]+2*u*(1-u)*A[1]+u*u*E[1]]);}
        const along=end=>{const out=[];for(let t=hit.t+ARMPIT+.1;t<end;t+=.1)out.push(under(t));return out;};
        // Up the side: the painted edge (with its soft rim) below `from`,
        // then easing in onto the line's centre at the armpit, so the cut
        // edge and the stroke meet without a step.
        const cut=[[edge[edge.length-1][0],70]];for(let j=edge.length-1;j>=from.j;j--)cut.push([edge[j][0]+s*.03,edge[j][1]]);
        cut.push([from.at[0]+s*(.03+side.inset),from.at[1]]);
        for(let j=from.j-1;j>=B.j;j--){const f=clamp((from.at[1]-line[j][1])/Math.max(.05,from.at[1]-B.at[1]),0,1);cut.push([line[j][0]+s*(1-f)*(.03+side.inset),line[j][1]]);}
        const tail=along(CUT_END),last=tail[tail.length-1]||E,cap=side.cap;
        cut.push(...corner,...tail,[last[0]+d[0]*12,last[1]+d[1]*12],[cap[0]+d[0]*12,cap[1]+d[1]*12],cap,[cap[0],-30]);
        // Cloth under the shirt along the sleeve's underside to its cuff,
        // then tucked inside the cuff and ending in a rounded end that turns
        // back to the line through the sleeve cap (the old straight end
        // poked past short sleeves as a pale triangle).
        const end=Math.max(side.cuff,hit.t+ARMPIT+.3),fillTail=[...along(end),under(end+.15,-.15)],fe=fillTail[fillTail.length-1],tc=(cap[0]-S[0])*d[0]+(cap[1]-S[1])*d[1],te=(fe[0]-S[0])*d[0]+(fe[1]-S[1])*d[1],ce=[cap[0]+d[0]*(te-tc),cap[1]+d[1]*(te-tc)],ctl=[(fe[0]+ce[0])/2+d[0]*.45,(fe[1]+ce[1])/2+d[1]*.45],round=[];
        for(let k=1;k<=6;k++){const u=k/6;round.push([(1-u)*(1-u)*fe[0]+2*u*(1-u)*ctl[0]+u*u*ce[0],(1-u)*(1-u)*fe[1]+2*u*(1-u)*ctl[1]+u*u*ce[1]]);}
        // Below the armpit the cloth stays .12 inside the line, under the
        // opaque shirt (else it backed the soft painted edge).
        const deep=j=>{const f=j>=from.j?0:clamp((from.at[1]-line[j][1])/Math.max(.05,from.at[1]-B.at[1]),0,1);return[line[j][0]-s*.12*(1-f),line[j][1]];};
        const fill=[[line[line.length-1][0]-s*.45,line[line.length-1][1]]];for(let j=line.length-1;j>=B.j;j--)fill.push(deep(j));
        fill.push(...corner,...fillTail,...round,cap,[cap[0]-s*.45,cap[1]+.4],[B.at[0]-s*.45,B.at[1]]);
        const stroke=[from.at];for(let j=from.j-1;j>=B.j;j--)stroke.push(line[j]);stroke.push(...corner,...along(end),under(end));
        // Path strings are made once per cached shape (30 cheering avatars).
        const join=list=>list.map(pt).join('L');shape={cut:join(cut),cutDown:join(cut.slice().reverse()),fill:'M'+join(fill)+'Z',stroke:'M'+join(stroke)};
      }
    }
    underCache.set(key,shape);if(underCache.size>600)underCache.delete(underCache.keys().next().value);return shape;
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
    const shorts=shortsTexture(sex,view,pose);href(r.hip,shorts);for(const[k,v]of Object.entries({x:shorts.x,y:shorts.y,width:shorts.w,height:shorts.h}))set(r.hip,k,v);r.hip.dataset.outfitSource=sex+view+'Shorts';
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
      href(s.image,sleeveTexture(sex,view,i,angle,lean,arm.lift||0));for(const[k,v]of Object.entries({x:-4,y:-4,width:8,height:8}))set(s.image,k,v);
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
      s.group.style.display=seat?.hidden||seat?.lap?'none':'';
      // Crossed feet seen from the front lie under both shins (each foot is
      // tucked under the other leg): both shoes go first in the far leg, the
      // near foot over the far one. Otherwise a shoe is its leg's last layer.
      if(seat?.under){const host=body.legs[0].parent,at=i?r.shoes[0].group.nextSibling:host.firstChild;if(s.group.parentNode!==host||(i?s.group.previousSibling!==r.shoes[0].group:host.firstChild!==s.group))host.insertBefore(s.group,at);}
      else if(seat?.over){if(s.group.parentNode!==body.legs[1].parent)body.legs[1].parent.append(s.group);}
      else{const parent=body.legs[i].parent;if(s.group.parentNode!==parent||parent.lastChild!==s.group)parent.append(s.group);}
      const soleHeight=(SF.floor-anchor[1])*SF.k;
      fit.legs.push({root:leg.root,cuff:mix(leg.root,leg.knee,.81),owner:i});
      fit.shoes.push({ankle:leg.ankle,contact:leg.contact,soleHeight,soleY:leg.ankle[1]+soleHeight*Math.cos(shoeAngle*Math.PI/180),owner:i,view:key});
    });
    // Side cross-legged: the far foot, pointing at the viewer under the near
    // knee (seatShoe.over), lies over the near shin as the near leg's last
    // layer (the near foot is painted into the shorts, seatShoe.lap). Moved
    // only when the order changes.
    {const over=[0,1].filter(i=>pose.legs[i].seatShoe?.over).map(i=>r.shoes[i].group),host=body.legs[1].parent;
     if(over.length&&over.some((g,j)=>host.children[host.children.length-over.length+j]!==g))host.append(...over);}
    r.fit=fit;body.svg.dataset.foundationOutfit='basic';return true;
  }
  function raisedSides(r,pose,sex,view){
    const [a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=p=>[(d*(p[0]-tx)-c*(p[1]-ty))/det,(-b*(p[0]-tx)+a*(p[1]-ty))/det];
    const sides=pose.profile?null:shirtSide(sex,view),shapes=pose.arms.map((arm,i)=>{
      if(!sides||!(arm.lift>.02))return null;const S=unmap(arm.shoulder),e=unmap(arm.elbow),v=[e[0]-S[0],e[1]-S[1]],l=Math.hypot(...v)||1,dir=[v[0]/l,v[1]/l];
      return underarm(sides[i],S,dir,[sex,view,i,...S.map(x=>Math.round(x*100)),Math.round(Math.atan2(dir[1],dir[0])*1800/Math.PI)].join(':'));
    });
    shapes.forEach((c,i)=>{
      const u=r.underarms[i];u.fill.style.display=u.line.style.display=c?'':'none';if(!c){u.fill.removeAttribute('d');u.line.removeAttribute('d');return;}
      set(u.fill,'d',c.fill);set(u.line,'d',c.stroke);set(u.fill,'fill',sides[i].cloth);set(u.line,'stroke',sides[i].line);
    });
    // The shirt beyond the clean lines is cut away: one polygon, the left
    // side up, across the top, the right side down.
    if(shapes.some(Boolean)){
      const [L,Rr]=shapes;
      set(r.shirtClip,'d','M'+(L?L.cut:'-10 70L-10 -30')+'L'+(Rr?Rr.cutDown:'42 -30L42 70')+'Z');set(r.shirt,'clip-path','url(#'+r.shirtClipId+')');
    }else r.shirt.removeAttribute('clip-path');
  }
  function destroy(svg){const r=mounted.get(svg);if(!r)return;for(const e of [r.shirt,r.hip,...r.underarms.flatMap(u=>[u.fill,u.line]),...r.sleeves.map(p=>p.group),...r.shoes.map(p=>p.group),r.defs])e.remove();r.body.underlay.style.display='';r.body.pelvis.contour.style.display='';r.body.pelvis.shade.style.display='';r.body.torso.shade.style.display='';r.body.torso.contour.style.display='';for(const leg of r.body.legs)if(leg.foot)leg.foot.style.display='';for(const arm of r.body.arms){arm.contour.removeAttribute('clip-path');arm.shade.removeAttribute('clip-path');}mounted.delete(svg);}
  root.QPFoundationOutfit=Object.freeze({atlas,files,load,apply,destroy,inspect:svg=>mounted.get(svg)?.fit||null});
})(window);
