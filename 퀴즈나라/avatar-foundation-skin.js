/* Painted skin on the reference body's existing joints. No head replacement.
   Arms, legs and neck are the reference sheet's own (sd-foundation-ref-*):
   limbs warped along the shared joints, the neck fixed to the collar.
   A top fitted on the clean body art (pipeline records, r.bodyArt 'clean',
   set by the outfit) shows the rule-cleaned arms and neck
   (sd-foundation-ref-arms-clean.png / -neck-clean.png, without the basic
   tee's cuff and collar lines; loaded only when such a top is worn). */
(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg',base=new URL('.',document.currentScript.src),R=root.QPFoundationReferenceData;
 const files={arm:'assets/sd-foundation-ref-arms.png',leg:'assets/sd-foundation-ref-legs.png',neck:'assets/sd-foundation-ref-neck.png'};
 const cleanFiles={arm:'assets/sd-foundation-ref-arms-clean.png',neck:'assets/sd-foundation-ref-neck-clean.png'};
 // The clean neck runs 8 px past the legacy rect (room under a V neck):
 // tools/garment/frozen/zones.json clean.neckRects (check-source compares).
 // The clean arms fill the legacy arm rects. f-back borrows the male neck.
 const CLEAN_NECK={'m-front':[290,241,62,60],'m-right':[701,208,54,80],'m-back':[1071,236,63,48],'f-front':[296,763,58,55],'f-right':[708,728,53,80],'f-back':null};
 const atlas={ready:false,error:null,source:files.arm},images={},clean={ready:false,error:null};let pending,cleanPending;
 // Painted images (canvas PNG data URLs: the limbs here, sleeves and shorts
 // in the outfit) share one pool, least recently used out first, bounded by
 // the bytes it holds (a data URL is one byte per character). Entries are
 // keyed by the drawn pose only, never by avatar or skin tone (the tone is a
 // filter), so every avatar in the same drawn pose shares one image. Round 2
 // kept first-in-first-out lists of 768 limbs, 200 sleeves and 160 shorts
 // (about 20 MB when full): smaller than a map's mixed working set (walkers,
 // runners, gestures, sits, climbers, jumpers), so 30 mixed avatars
 // re-warped and re-encoded about 70 images every frame (~220 ms per update
 // in software rendering). That crowd's images take about 38 MiB (limbs ~9
 // KB, sleeves ~46 KB, shorts ~29 KB each; every drawn pose of every motion
 // ~63 MiB). PAINT_BUDGET holds the crowd; a full pool measured about 41 MiB
 // of JS heap, meant for a 4 GB school Chromebook, and a browser reporting
 // under 4 GB keeps 24 MiB. When nothing has asked for an image for a
 // minute (paint.idleMs: a static screen; the map was left) the pool is
 // emptied; it refills on the next update (2026-10-09, round 3).
 const PAINT_BUDGET=((root.navigator?.deviceMemory||4)<4?24:40)*1048576,pool=new Map(),kinds=new Map();
 const paint={budget:PAINT_BUDGET,idleMs:60000,bytes:0,evicted:0,emptied:0};let lastUse=0,idleTimer=0;
 function emptyPaint(){pool.clear();paint.bytes=0;for(const k of kinds.values()){k.entries=0;k.bytes=0;}}
 // The idle check looks again at least every 5 s, so a changed idleMs applies soon.
 function idleCheck(){idleTimer=0;const wait=lastUse+paint.idleMs-performance.now();if(wait>0){idleTimer=setTimeout(idleCheck,Math.min(wait,5000)+50);return;}if(pool.size)paint.emptied++;emptyPaint();}
 function drop(k,e){pool.delete(k);paint.bytes-=e.size;e.own.entries--;e.own.bytes-=e.size;}
 function paintCache(kind){
  if(kinds.has(kind))return kinds.get(kind).cache;const own={kind,entries:0,bytes:0,hits:0,misses:0},prefix=kind+'|';
  own.cache={
   get(key){const k=prefix+key,e=pool.get(k);lastUse=performance.now();if(!idleTimer)idleTimer=setTimeout(idleCheck,Math.min(paint.idleMs,5000)+50);if(!e){own.misses++;return;}own.hits++;pool.delete(k);pool.set(k,e);return e.v;},
   set(key,v){const k=prefix+key,size=k.length+v.url.length+96,old=pool.get(k);if(old)drop(k,old);
    for(const[x,e]of pool){if(paint.bytes+size<=paint.budget)break;drop(x,e);paint.evicted++;}
    pool.set(k,{v,size,own});paint.bytes+=size;own.entries++;own.bytes+=size;return v;}};
  kinds.set(kind,own);return own.cache;
 }
 const paintStats=()=>({budget:paint.budget,bytes:paint.bytes,entries:pool.size,evicted:paint.evicted,emptied:paint.emptied,kinds:[...kinds.values()].map(({cache,...k})=>k)});
 const VIEW={Front:'front',Profile:'right',Back:'back'};
 // Neighbouring warped triangles overlap by about a pixel. A thinner overlap
 // left anti-aliased hairline seams that showed the background through.
 const SEAM=.9;
 const mix=(a,b,t)=>a+(b-a)*t,lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t)),unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},sub=(a,b)=>a.map((v,i)=>v-b[i]),rotate2=(v,t)=>[v[0]*Math.cos(t)-v[1]*Math.sin(t),v[0]*Math.sin(t)+v[1]*Math.cos(t)];
 // An arm the pose marks as folding (arm.fold: run and jump) whose screen
 // turn at the elbow passes SHARP gets the rounded-elbow mesh in painting().
 // Every other limb keeps the original warp, pixel for pixel.
 const SHARP=100*Math.PI/180,SHARP_ROWS=10;
 function load(){return pending||(pending=Promise.all(Object.entries(files).map(async([k,f])=>[k,await QPAvatarImage.load(new URL(f,base).href)])).then(entries=>{Object.assign(images,Object.fromEntries(entries));atlas.ready=true;return atlas;}).catch(e=>{atlas.error=e.message;console.error(e);return atlas;}));}
 function loadClean(){return cleanPending||(cleanPending=Promise.all(Object.entries(cleanFiles).map(async([k,f])=>[k+'Clean',await QPAvatarImage.load(new URL(f,base).href)])).then(entries=>{Object.assign(images,Object.fromEntries(entries));clean.ready=true;return clean;}).catch(e=>{clean.error=e.message;console.error(e);return clean;}));}
 // A limb definition in sheet pixels: the painted strip, its three joints,
 // half widths at those joints and where the hand/foot end lies.
 // art 'clean': the clean arm painting (same rects and joints).
 function limbDef(type,sex,view,i,art){
  const F=R.figures[sex+'-'+VIEW[view]],J=F.joints,rect=F.rects[type][i],radii=F.radii[type][i],variant=art==='clean'&&type==='arm'?'clean':'';
  const joints=type==='arm'?[J.shoulder[i],J.elbow[i],J.wrist[i]]:[J.hip[i],J.knee[i],J.ankle[i]];
  return{rect,joints,radii,end:type==='arm'?J.hand_end:rect[1]+rect[3],k:F.k,image:variant?images.armClean:images[type],variant};
 }
 const textures=new Map();
 function texture(d){const key=(d.variant?d.variant+'/':'')+d.rect.join();if(textures.has(key))return textures.get(key);const c=document.createElement('canvas');c.width=d.rect[2];c.height=d.rect[3];c.getContext('2d').drawImage(d.image,...d.rect,0,0,c.width,c.height);textures.set(key,c);return c;}
 // The bob hides the female back neck on the sheet; the male one stands in
 // for hairstyles that show it.
 function neckFigure(sex,view){const F=R.figures[sex+'-'+VIEW[view]];return F.rects.neck?F:R.figures[(sex==='m'?'f':'m')+'-'+VIEW[view]];}
 function neckTexture(F){const key='neck:'+F.rects.neck.join();if(textures.has(key))return textures.get(key);const r=F.rects.neck,c=document.createElement('canvas');c.width=r[2];c.height=r[3];c.getContext('2d').drawImage(images.neck,...r,0,0,c.width,c.height);const url=c.toDataURL();textures.set(key,url);return url;}
 const cleanNeckRect=F=>CLEAN_NECK[F.sex+'-'+F.view]||F.rects.neck;
 function cleanNeckTexture(F){const r=cleanNeckRect(F),key='neck-clean:'+r.join();if(textures.has(key))return textures.get(key);const c=document.createElement('canvas');c.width=r[2];c.height=r[3];c.getContext('2d').drawImage(images.neckClean,...r,0,0,c.width,c.height);const url=c.toDataURL();textures.set(key,url);return url;}
 function triangle(ctx,texture,a,b,c){const[x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(den)<1e-8)return;
  const aa=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,bb=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
  // Offset the edges, not vertices away from the centroid: a long narrow
  // triangle otherwise receives almost no overlap across its short edge.
  const vertices=[a.d,b.d,c.d],sign=Math.sign((u1-u0)*(v2-v0)-(v1-v0)*(u2-u0))||1;
  ctx.save();ctx.beginPath();for(const[i,p]of vertices.entries()){const prev=unit(sub(p,vertices[(i+2)%3])),next=unit(sub(vertices[(i+1)%3],p)),na=[prev[1]*sign,-prev[0]*sign],nb=[next[1]*sign,-next[0]*sign],bis=unit(na.map((v,k)=>v+nb[k])),pad=Math.min(6,SEAM/Math.max(.05,bis[0]*na[0]+bis[1]*na[1])),q=p.map((v,k)=>v+bis[k]*pad);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,u0-aa*x0-cc*y0,v0-bb*x0-dd*y0);ctx.drawImage(texture,0,0);ctx.restore();
 }
 const limbCache=paintCache('limb');
 // Each source row belongs to a bone by its height between the painted
 // joints; columns keep the painted width scaled by the sheet's pixel size.
 // part: '' the whole limb; 'forearm' only the rows from the start of the
 // elbow bend to the hand's end; 'forearm-bare' the same without the hand
 // (an open gesture hand is drawn there instead).
 function painting(d,points,fold=false,part=''){const relative=points.map(p=>sub(p,points[0])),[a,b,c]=relative,u=unit(sub(b,a)),v=unit(sub(c,b)),turn=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]))),sharp=fold&&turn>SHARP,cacheKey=(d.variant?d.variant+'/':'')+[d.rect.join(),...relative.flat().map(x=>Math.round(x*40)),sharp?'s':'',part].join(':'),cached=limbCache.get(cacheKey);if(cached)return cached;
  const nu=[u[1],-u[0]],nv=[v[1],-v[0]],J=d.joints,ys=[d.rect[1],J[0][1],J[1][1],J[2][1],d.end],ext=(d.end-J[2][1])*d.k,top=(J[0][1]-d.rect[1])*d.k,verts=[],cols=2;
  const l1=Math.hypot(...sub(b,a)),l2=Math.hypot(...sub(c,b)),corner=Math.min(.55,l1*.2,l2*.2),lo=ys[2]-corner/l1*(ys[2]-ys[1]),hi=ys[2]+corner/l2*(ys[3]-ys[2]);
  // Source rows of the mesh; a sharp fold adds rows through the bend.
  const rowsY=Array.from({length:21},(_,row)=>d.rect[1]+row/20*d.rect[3]);if(sharp)for(let j=0;j<=SHARP_ROWS;j++)rowsY.push(lo+(hi-lo)*j/SHARP_ROWS);if(part==='forearm-bare')rowsY.push(ys[3]);if(rowsY.length>21){rowsY.sort((p,q)=>p-q);for(let j=rowsY.length-1;j>0;j--)if(rowsY[j]-rowsY[j-1]<.05)rowsY.splice(j,1);}
  // Rows a part draws: from the last row at or before the bend's start.
  const first=part?Math.max(0,rowsY.findLastIndex(y=>y<=lo+1e-6)):0,last=part==='forearm-bare'?rowsY.findIndex(y=>y>=ys[3]-1e-6):rowsY.length-1;
  // Sharp fold (a running or jumping forearm folded up toward the camera, so
  // on screen it turns back over its own upper arm): the centre line runs on
  // a circular arc tangent to both bones, and the inside of the bend collapses
  // onto the arc's centre instead of crossing over itself. The outside then
  // wraps round as one rounded elbow with its painted outline; the Bezier
  // corner below folded the inside into a triangular flap with doubled
  // outlines (front run, 2026-10-08 critic).
  const sgn=u[0]*v[1]-u[1]*v[0]<0?-1:1,inward=[-u[1]*sgn,u[0]*sgn],radius=corner/Math.tan(turn/2),centre=b.map((x,i)=>x-u[i]*corner+inward[i]*radius);
  for(const sy of rowsY)for(let col=0;col<=cols;col++){
   const sx=d.rect[0]+col/cols*d.rect[2];let center,normal,sourceX;
   if(sy<ys[1]){center=a.map((x,i)=>x-u[i]*top*(ys[1]-sy)/Math.max(1,ys[1]-ys[0]));normal=nu;sourceX=J[0][0];}
   else if(sy<ys[2]){const t=(sy-ys[1])/(ys[2]-ys[1]);center=lerp(a,b,t);normal=sharp?nu:unit(lerp(nu,nv,Math.max(0,(t-.80)/.4)));sourceX=mix(J[0][0],J[1][0],t);}
   else if(sy<ys[3]){const t=(sy-ys[2])/(ys[3]-ys[2]);center=lerp(b,c,t);normal=sharp?nv:unit(lerp(nu,nv,Math.min(1,.5+t/.4)));sourceX=mix(J[1][0],J[2][0],t);}
   else{const t=(sy-ys[3])/Math.max(1,ys[4]-ys[3]);center=c.map((x,i)=>x+v[i]*ext*t);normal=nv;sourceX=J[2][0];}
   let x=(sx-sourceX)*d.k;
   if(sharp&&sy>=lo&&sy<=hi){
    const s=sy<ys[2]?.5*(sy-lo)/Math.max(1e-6,ys[2]-lo):.5+.5*(sy-ys[2])/Math.max(1e-6,hi-ys[2]),r=rotate2(inward,sgn*turn*s);
    center=centre.map((q,i)=>q-r[i]*radius);normal=rotate2(nu,sgn*turn*s);
    // Inside of the bend: never past the arc's centre.
    if(x*(normal[0]*r[0]+normal[1]*r[1])>0&&Math.abs(x)>radius)x=Math.sign(x)*radius;
   }
   // Round the painted surface through the same joint as the underlying
   // contour. A kinked centerline makes an acute elbow a triangular fold.
   else if(!sharp&&sy>lo&&sy<hi){const t=(sy-lo)/(hi-lo),pre=b.map((x,i)=>x-u[i]*corner),post=b.map((x,i)=>x+v[i]*corner);center=lerp(lerp(pre,b,t),lerp(b,post,t),t);const tangent=unit(lerp(u,v,t));normal=[tangent[1],-tangent[0]];}
   verts.push({s:[sx-d.rect[0],sy-d.rect[1]],d:[center[0]+normal[0]*x,center[1]+normal[1]*x]});
  }
  const used=verts.slice(first*(cols+1),(last+1)*(cols+1)),xs=used.map(p=>p.d[0]),ys2=used.map(p=>p.d[1]),left=Math.min(...xs)-.1,topY=Math.min(...ys2)-.1,w=Math.max(...xs)-left+.1,h=Math.max(...ys2)-topY+.1,scale=16,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';verts.forEach(p=>p.d=[(p.d[0]-left)*scale,(p.d[1]-topY)*scale]);const tex=texture(d);for(let row=first;row<last;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col;triangle(ctx,tex,verts[i],verts[i+1],verts[i+cols+2]);triangle(ctx,tex,verts[i],verts[i+cols+2],verts[i+cols+1]);}
  // Almost-opaque triangle interiors must not leave a translucent grid.
  // Keep the actual low-alpha silhouette pixels for smooth outer edges.
  const opaque=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=3;i<opaque.data.length;i+=4)if(opaque.data[i]>=240)opaque.data[i]=255;ctx.putImageData(opaque,0,0);
  return limbCache.set(cacheKey,{url:canvas.toDataURL(),x:left,y:topY,w:canvas.width/scale,h:canvas.height/scale});
 }
 // The face painting is recolored by brush luminance (avatar-pixel.js), which
 // keeps the chosen skin's own hue. The sheet's limbs and neck keep more of
 // their own warm shading (WARMTH): a luminance-only map turned the chin's
 // cast shadow grey under the face. PAINT_MEDIAN is the sheet's own skin.
 const PAINT_MEDIAN=[252,217,196],FACE_LUMINANCE=223.8,WARMTH=.6;
 function toneMatrix(skin){const s=skin.slice(1).match(/../g).map(x=>parseInt(x,16)/255),median=.22*PAINT_MEDIAN[0]+.59*PAINT_MEDIAN[1]+.19*PAINT_MEDIAN[2],rows=[];
  for(let c=0;c<3;c++){const lum=s[c]*255/FACE_LUMINANCE*(1-WARMTH),own=s[c]*255/PAINT_MEDIAN[c]*median/FACE_LUMINANCE*WARMTH;rows.push([.22,.59,.19].map((w,k)=>Math.round((lum*w+(k===c?own:0))*1e5)/1e5).concat([0,0]).join(' '));}
  return rows.join(' ')+' 0 0 0 1 0';}
 function apply(r,pose){if(!atlas.ready||!R)return;const view=pose.profile?'Profile':pose.back?'Back':'Front',sex=r.svg.dataset.qpxSex==='m'?'m':'f',art=r.bodyArt==='clean'&&clean.ready?'clean':'';
  // Geometry is shared across skin tones. One sRGB colour matrix tints the
  // neutral painting for the wearer's tone without rebuilding pose meshes.
  if(!r.skinPaintFilter){const f=document.createElementNS(NS,'filter');f.id=r.svg.dataset.foundationId+'-paint-tone';f.setAttribute('color-interpolation-filters','sRGB');const matrix=document.createElementNS(NS,'feColorMatrix');matrix.setAttribute('type','matrix');matrix.setAttribute('values',toneMatrix(r.svg.dataset.foundationSkin));f.append(matrix);r.svg.querySelector('defs').append(f);r.skinPaintFilter=f;}
  const tint='url(#'+r.skinPaintFilter.id+')';
  // The sheet's neck sits under the collar it was painted with; the body's
  // calibration neck shapes are not drawn.
  if(!r.neckPainting){r.neckPainting=document.createElementNS(NS,'image');r.neckPainting.setAttribute('filter',tint);r.neckPainting.setAttribute('preserveAspectRatio','none');r.neckPainting.setAttribute('data-foundation-skin-paint','neck');r.parts.torso.insertBefore(r.neckPainting,r.neckEdge);}
  for(const e of [r.neckSurface,r.neckEdge,r.neckShade])e.style.display='none';
  {const F=neckFigure(sex,view),rect=art?cleanNeckRect(F):F.rects.neck,collar=root.QPAvatarFoundation.specFor(sex).collar,key=(art?art+':':'')+rect.join();if(r.neckPainting.dataset.source!==key){r.neckPainting.setAttribute('href',art?cleanNeckTexture(F):neckTexture(F));r.neckPainting.dataset.source=key;}
   for(const[k,v]of Object.entries({x:16+(rect[0]-F.neck[0])*F.k,y:collar+(rect[1]-F.neck[1])*F.k,width:rect[2]*F.k,height:rect[3]*F.k}))if(r.neckPainting.getAttribute(k)!==String(v))r.neckPainting.setAttribute(k,v);
   // A leaning walk/run bends the neck at the collar (pose.neckTilt).
   const tilt=pose.neckTilt?'rotate('+(-pose.neckTilt).toFixed(3)+' 16 '+collar+')':'';if((r.neckPainting.getAttribute('transform')||'')!==tilt){if(tilt)r.neckPainting.setAttribute('transform',tilt);else r.neckPainting.removeAttribute('transform');}}
  for(const type of ['arm','leg']){const parts=type==='arm'?r.arms:r.legs;parts.forEach((part,i)=>{const p=type==='arm'?pose.arms[i]:pose.legs[i],points=type==='arm'?[p.shoulder,p.elbow,p.wrist]:p.paint||[p.root,p.knee,p.ankle],def=limbDef(type,sex,view,i,art),drawn=painting(def,points,type==='arm'&&Boolean(p.fold));
   if(!part.painting){part.painting=document.createElementNS(NS,'image');part.painting.setAttribute('data-foundation-skin-paint',type);part.painting.setAttribute('filter',tint);part.painting.setAttribute('preserveAspectRatio','none');
    // An arm's sleeve-opening clip sits on a frame, so the forearm overlay can
    // reuse the bare painting above the sleeve with only its own clip.
    part.paintFrame=type==='arm'?document.createElementNS(NS,'g'):part.painting;if(type==='arm')part.paintFrame.append(part.painting);part.parent.insertBefore(part.paintFrame,part.shade);
    // The seated-leg clip exists from the start: motion never adds nodes.
    if(type==='leg'){const g=document.createElementNS(NS,'clipPath');g.id=r.svg.dataset.foundationId+'-leg-skin-paint-'+i;part.paintClip=document.createElementNS(NS,'path');g.append(part.paintClip);r.svg.querySelector('defs').append(g);}}
   // The pooled painting is compared by reference (as the forearm's below):
   // reading the data-URL href back every frame copied the whole string.
   const image=part.painting;if(image.paintedArt!==drawn){if(image.getAttribute('href')!==drawn.url)image.setAttribute('href',drawn.url);image.paintedArt=drawn;}for(const[k,val]of Object.entries({x:points[0][0]+drawn.x,y:points[0][1]+drawn.y,width:drawn.w,height:drawn.h}))if(image.getAttribute(k)!==String(val))image.setAttribute(k,val);
   // Clothing owns the sleeve opening clip; the painted hand follows the wrist.
   // Crossed seated legs are painted straight from the knee (leg.paint) and
   // clipped to the body's knee-and-shin contour; the thigh is under the shorts.
   // A desk sit seen from the front or behind shows only the round knee and
   // the shin: from the front the knee comes out under the curved shorts
   // cuff, from behind the seat hides it. The thigh above the knee (flat
   // refill on the sheet) never shows beside the soft seat corners.
   let clip=part.contour.getAttribute('clip-path');if(type==='leg'){clip=null;const lap=pose.desk&&!pose.profile,r=pose.back?1.15:1.02;if(pose.floor||lap){part.paintClip.setAttribute('d',pose.floor?part.contour.getAttribute('d'):'M'+(p.knee[0]-r).toFixed(3)+' '+p.knee[1].toFixed(3)+'A'+r+' '+r+' 0 0 1 '+(p.knee[0]+r).toFixed(3)+' '+p.knee[1].toFixed(3)+'L'+(p.knee[0]+2).toFixed(3)+' 70H'+(p.knee[0]-2).toFixed(3)+'Z');clip='url(#'+part.paintClip.parentNode.id+')';}}
   if(clip)part.paintFrame.setAttribute('clip-path',clip);else part.paintFrame.removeAttribute('clip-path');
   part.contour.style.visibility='hidden';part.shade.style.display=type==='leg'&&pose.floor?'':'none';if(type==='arm'){part.hand.style.display='none';forearmOverlay(r,part,p,i,[def.radii[1]*def.k,def.radii[2]*def.k],(def.end-def.joints[2][1])*def.k,def,points,tint);openHand(r,part,p,i,tint);}
  });}r.svg.dataset.foundationSkinArt='reference-sheet-v1';}
 // A forearm folded toward the viewer (front/back running, jumping, cheering)
 // lies in front of its own sleeve. Run/jump arms (arm.fold) draw their own
 // forearm painting there (below); other arms show the same painted arm
 // again, clipped to the forearm and hand, above the sleeve.
 // Seated forearms (desk and cross-legged) reach forward below the sleeve
 // and need no overlay: its clip showed the upper arm over the sleeve, and
 // on the cross-legged arm a thin dark line across the cuff (2026-10-08).
 function forearmOverlay(r,part,arm,i,radii,end,def,points,tint){
  const id=r.svg.dataset.foundationId+'-arm-paint-'+i;if(part.painting.id!==id)part.painting.id=id;
  if(!part.forearm){const clip=document.createElementNS(NS,'clipPath');clip.id=id+'-forearm';part.forearmClip=document.createElementNS(NS,'path');clip.append(part.forearmClip);r.svg.querySelector('defs').append(clip);part.forearm=document.createElementNS(NS,'use');part.forearm.setAttribute('href','#'+id);part.forearm.setAttribute('clip-path','url(#'+clip.id+')');part.forearm.dataset.foundationForearm=String(i);part.parent.append(part.forearm);
   part.forearmArt=document.createElementNS(NS,'image');part.forearmArt.setAttribute('filter',tint);part.forearmArt.setAttribute('preserveAspectRatio','none');part.forearmArt.dataset.foundationForearm=String(i);part.forearmArt.dataset.foundationForearmArt='fold';part.parent.append(part.forearmArt);}
  // Only a forearm that folds back across its sleeve on screen needs it; a
  // walking forearm continues below the cuff and the copy only hid the cuff.
  const [,e,w]=arm.boneSpace,up=sub(arm.shoulder,arm.elbow),down=sub(arm.wrist,arm.elbow),folded=(up[0]*down[0]+up[1]*down[1])/((Math.hypot(...up)*Math.hypot(...down))||1)>Math.cos(125*Math.PI/180),toward=w[2]-e[2]>.6&&folded&&!r.pose?.profile&&!r.pose?.desk&&!r.pose?.floor;
  // A run/jump arm (arm.fold) paints its own forearm: the mesh rows from the
  // start of the elbow bend to the hand, so the forearm keeps its painted
  // outline on both sides and a rounded painted elbow over the sleeve. The
  // clip below cut the painting with straight unlined edges over the cuff
  // and still pasted the folded elbow on top (critic, 2026-10-08).
  const own=toward&&Boolean(arm.fold);part.forearm.style.display=toward&&!own?'':'none';part.forearmArt.style.display=own?'':'none';if(!toward)return;
  if(own){const art=painting(def,points,true,(arm.open??arm.lift??0)>.5?'forearm-bare':'forearm'),e=part.forearmArt;
   // The painting is compared by reference: reading a data-URL href back from
   // the DOM every frame copied the whole string.
   if(e.paintedArt!==art){e.setAttribute('href',art.url);e.paintedArt=art;}for(const[k,val]of Object.entries({x:points[0][0]+art.x,y:points[0][1]+art.y,width:art.w,height:art.h}))if(e.getAttribute(k)!==String(val))e.setAttribute(k,val);return;}
  // The clip is the forearm's own outline: rounded at the elbow, widening
  // over the hand. A wide rectangle cut the painting with straight edges
  // and pasted the hidden upper-arm skin over the sleeve as a pale torn
  // patch (D5, front/back running and cheering).
  const d=sub(arm.wrist,arm.elbow),l=Math.hypot(...d)||1,u=[d[0]/l,d[1]/l],nrm=[-u[1],u[0]],[re,rw]=radii,hand=end,q=(p,s,t=0)=>(p[0]+nrm[0]*s+u[0]*t).toFixed(3)+' '+(p[1]+nrm[1]*s+u[1]*t).toFixed(3),E=arm.elbow,W=arm.wrist;
  part.forearmClip.setAttribute('d','M'+q(E,re)+'L'+q(W,rw+.08)+'L'+q(W,rw+.12,hand*.55)+'Q'+q(W,rw+.12,hand+.15)+' '+q(W,0,hand+.15)+'Q'+q(W,-rw-.12,hand+.15)+' '+q(W,-rw-.12,hand*.55)+'L'+q(W,-rw-.08)+'L'+q(E,-re)+'Q'+q(E,-re,-re)+' '+q(E,0,-re)+'Q'+q(E,re,-re)+' '+q(E,re)+'Z');
 }
 // An open hand for a gesture-raised arm (wave, cheer). The sheet only has a
 // relaxed hanging hand, which pointed upwards read as a mitten or a fist.
 // Drawn in the sheet's own skin and outline colours under the same tone
 // filter as the painting, so it matches every skin tone; the painted hand
 // past the wrist is clipped away while it shows. Hand-local units: +y runs
 // from the wrist to the fingertips, the thumb on -x (turned to the body).
 // A new drawing; the user approved its shape on 2026-10-08. Round 2 matched
 // it to the painted limbs measured on the render: the painted forearm's
 // outline core (175,143,127 at the light tone) and the soft darker rim
 // inside and outside it (line, rim), the same fill (251,221,198); the palm
 // fades in over the painted wrist (fade) instead of starting on a hard
 // straight edge across it.
 const HAND={skin:'#fcd7c0',line:'#b08979',rim:'#cfa593',crease:'#e9b9a3',palm:'M-.62 -.16L-.63 .5Q-.62 .88-.3 .9L.34 .88Q.63 .84 .62 .5L.62 -.16Z',palmLine:'M-.63 .2L-.63 .5Q-.62 .88-.3 .9L.34 .88Q.63 .84 .62 .5L.62 .2',fingers:'M-.34 .8L-.46 1.4M-.1 .84L-.12 1.55M.14 .82L.2 1.47M.38 .74L.53 1.18M-.48 .32L-.92 .74',crease:'M-.28 .42Q0 .58 .3 .46',fade:[-.16,.26],cut:.3};
 function openHand(r,part,arm,i,tint){
  if(!part.openHand){const g=document.createElementNS(NS,'g'),mk=(d,attrs)=>{const e=document.createElementNS(NS,'path');e.setAttribute('d',d);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);g.append(e);return e;};
   g.setAttribute('filter',tint);g.dataset.foundationOpenHand=String(i);
   const fade=document.createElementNS(NS,'linearGradient');fade.id=r.svg.dataset.foundationId+'-hand-fade-'+i;for(const[k,v]of Object.entries({gradientUnits:'userSpaceOnUse',x1:0,x2:0,y1:HAND.fade[0],y2:HAND.fade[1]}))fade.setAttribute(k,v);
   for(const[offset,opacity]of[[0,0],[1,1]]){const stop=document.createElementNS(NS,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',HAND.skin);stop.setAttribute('stop-opacity',opacity);fade.append(stop);}r.svg.querySelector('defs').append(fade);
   mk(HAND.fingers,{fill:'none',stroke:HAND.rim,'stroke-width':.56,'stroke-linecap':'round','stroke-opacity':.6});mk(HAND.fingers,{fill:'none',stroke:HAND.line,'stroke-width':.44,'stroke-linecap':'round'});mk(HAND.palm,{fill:'url(#'+fade.id+')'});
   mk(HAND.palmLine,{fill:'none',stroke:HAND.rim,'stroke-width':.28,'stroke-linejoin':'round','stroke-opacity':.6});mk(HAND.palmLine,{fill:'none',stroke:HAND.line,'stroke-width':.08,'stroke-linejoin':'round'});
   mk(HAND.fingers,{fill:'none',stroke:HAND.skin,'stroke-width':.3,'stroke-linecap':'round'});mk(HAND.crease,{fill:'none',stroke:HAND.crease,'stroke-width':.05,'stroke-linecap':'round'});
   part.parent.append(g);part.openHand=g;
   const clip=document.createElementNS(NS,'clipPath');clip.id=r.svg.dataset.foundationId+'-hand-cut-'+i;part.handCut=document.createElementNS(NS,'path');clip.append(part.handCut);r.svg.querySelector('defs').append(clip);}
  // arm.open (solve): the gesture's own choice; climbing grips and the side
  // cheer's fists keep the painted hand.
  const open=(arm.open??arm.lift??0)>.5;part.openHand.style.display=open?'':'none';
  if(!open){part.painting.removeAttribute('clip-path');part.openHand.removeAttribute('transform');return;}
  if(part.openHand.parentNode!==part.parent||part.openHand.nextSibling)part.parent.append(part.openHand);
  const d=sub(arm.wrist,arm.elbow),l=Math.hypot(...d)||1,u=[d[0]/l,d[1]/l],nrm=[-u[1],u[0]],angle=Math.atan2(u[1],u[0])*180/Math.PI-90+(arm.handTurn||0)*180/Math.PI;
  // Thumb toward the body's centre line (palm or back of the hand to the camera).
  const thumb=[-Math.cos(angle*Math.PI/180),-Math.sin(angle*Math.PI/180)],flip=thumb[0]*(arm.wrist[0]-16)>0?-1:1;
  part.openHand.setAttribute('transform','translate('+arm.wrist.map(v=>v.toFixed(4)).join(' ')+') rotate('+angle.toFixed(3)+') scale('+flip+' 1)');
  const c=[arm.wrist[0]+u[0]*HAND.cut,arm.wrist[1]+u[1]*HAND.cut],q=(p,a,b)=>(p[0]+u[0]*a+nrm[0]*b).toFixed(3)+' '+(p[1]+u[1]*a+nrm[1]*b).toFixed(3);
  part.handCut.setAttribute('d','M'+q(c,0,12)+'L'+q(c,-30,12)+'L'+q(c,-30,-12)+'L'+q(c,0,-12)+'Z');part.painting.setAttribute('clip-path','url(#'+part.handCut.parentNode.id+')');
 }
 function destroy(r){r.skinPaintFilter?.remove();r.neckPainting?.remove();for(const e of [r.neckSurface,r.neckEdge,r.neckShade])e.style.display='';for(const part of [...r.arms,...r.legs]){part.contour.style.visibility='';part.paintFrame?.remove();part.painting?.remove();part.paintClip?.parentNode.remove();part.forearm?.remove();part.forearmArt?.remove();part.forearmClip?.parentNode.remove();part.openHand?.remove();part.handCut?.parentNode.remove();r.svg.querySelector('[id="'+r.svg.dataset.foundationId+'-hand-fade-'+r.arms.indexOf(part)+'"]')?.remove();delete part.forearm;delete part.forearmArt;delete part.forearmClip;delete part.openHand;delete part.handCut;}}
 root.QPFoundationSkin=Object.freeze({atlas,files,cleanFiles,clean,load,loadClean,apply,destroy,limbDef,paintCache,paint,paintStats,emptyPaint,CLEAN_NECK});
})(window);
