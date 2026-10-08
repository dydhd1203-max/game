/* Painted skin on the reference body's existing joints. No head replacement.
   Arms, legs and neck are the reference sheet's own (sd-foundation-ref-*):
   limbs warped along the shared joints, the neck fixed to the collar. */
(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg',base=new URL('.',document.currentScript.src),R=root.QPFoundationReferenceData;
 const files={arm:'assets/sd-foundation-ref-arms.png',leg:'assets/sd-foundation-ref-legs.png',neck:'assets/sd-foundation-ref-neck.png'};
 const atlas={ready:false,error:null,source:files.arm},images={},frames=new Map();let pending;
 const VIEW={Front:'front',Profile:'right',Back:'back'};
 // Neighbouring warped triangles overlap by about a pixel. A thinner overlap
 // left anti-aliased hairline seams that showed the background through.
 const SEAM=.9;
 const mix=(a,b,t)=>a+(b-a)*t,lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t)),unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},sub=(a,b)=>a.map((v,i)=>v-b[i]);
 function load(){return pending||(pending=Promise.all(Object.entries(files).map(async([k,f])=>[k,await QPAvatarImage.load(new URL(f,base).href)])).then(entries=>{Object.assign(images,Object.fromEntries(entries));atlas.ready=true;return atlas;}).catch(e=>{atlas.error=e.message;console.error(e);return atlas;}));}
 // A limb definition in sheet pixels: the painted strip, its three joints,
 // half widths at those joints and where the hand/foot end lies.
 function limbDef(type,sex,view,i){
  const F=R.figures[sex+'-'+VIEW[view]],J=F.joints,rect=F.rects[type][i],radii=F.radii[type][i];
  const joints=type==='arm'?[J.shoulder[i],J.elbow[i],J.wrist[i]]:[J.hip[i],J.knee[i],J.ankle[i]];
  return{rect,joints,radii,end:type==='arm'?J.hand_end:rect[1]+rect[3],k:F.k,image:images[type]};
 }
 const textures=new Map();
 function texture(d){const key=d.rect.join();if(textures.has(key))return textures.get(key);const c=document.createElement('canvas');c.width=d.rect[2];c.height=d.rect[3];c.getContext('2d').drawImage(d.image,...d.rect,0,0,c.width,c.height);textures.set(key,c);return c;}
 // The bob hides the female back neck on the sheet; the male one stands in
 // for hairstyles that show it.
 function neckFigure(sex,view){const F=R.figures[sex+'-'+VIEW[view]];return F.rects.neck?F:R.figures[(sex==='m'?'f':'m')+'-'+VIEW[view]];}
 function neckTexture(F){const key='neck:'+F.rects.neck.join();if(textures.has(key))return textures.get(key);const r=F.rects.neck,c=document.createElement('canvas');c.width=r[2];c.height=r[3];c.getContext('2d').drawImage(images.neck,...r,0,0,c.width,c.height);const url=c.toDataURL();textures.set(key,url);return url;}
 function triangle(ctx,texture,a,b,c){const[x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(den)<1e-8)return;
  const aa=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,bb=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
  // Offset the edges, not vertices away from the centroid: a long narrow
  // triangle otherwise receives almost no overlap across its short edge.
  const vertices=[a.d,b.d,c.d],sign=Math.sign((u1-u0)*(v2-v0)-(v1-v0)*(u2-u0))||1;
  ctx.save();ctx.beginPath();for(const[i,p]of vertices.entries()){const prev=unit(sub(p,vertices[(i+2)%3])),next=unit(sub(vertices[(i+1)%3],p)),na=[prev[1]*sign,-prev[0]*sign],nb=[next[1]*sign,-next[0]*sign],bis=unit(na.map((v,k)=>v+nb[k])),pad=Math.min(6,SEAM/Math.max(.05,bis[0]*na[0]+bis[1]*na[1])),q=p.map((v,k)=>v+bis[k]*pad);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,u0-aa*x0-cc*y0,v0-bb*x0-dd*y0);ctx.drawImage(texture,0,0);ctx.restore();
 }
 // Each source row belongs to a bone by its height between the painted
 // joints; columns keep the painted width scaled by the sheet's pixel size.
 function painting(d,points){const relative=points.map(p=>sub(p,points[0])),cacheKey=[d.rect.join(),...relative.flat().map(x=>Math.round(x*40))].join(':');if(frames.has(cacheKey))return frames.get(cacheKey);
  const [a,b,c]=relative,u=unit(sub(b,a)),v=unit(sub(c,b)),nu=[u[1],-u[0]],nv=[v[1],-v[0]],J=d.joints,ys=[d.rect[1],J[0][1],J[1][1],J[2][1],d.end],ext=(d.end-J[2][1])*d.k,top=(J[0][1]-d.rect[1])*d.k,verts=[],rows=20,cols=2;
  const l1=Math.hypot(...sub(b,a)),l2=Math.hypot(...sub(c,b)),corner=Math.min(.55,l1*.2,l2*.2),lo=ys[2]-corner/l1*(ys[2]-ys[1]),hi=ys[2]+corner/l2*(ys[3]-ys[2]);
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
   const sy=d.rect[1]+row/rows*d.rect[3],sx=d.rect[0]+col/cols*d.rect[2];let center,normal,sourceX;
   if(sy<ys[1]){center=a.map((x,i)=>x-u[i]*top*(ys[1]-sy)/Math.max(1,ys[1]-ys[0]));normal=nu;sourceX=J[0][0];}
   else if(sy<ys[2]){const t=(sy-ys[1])/(ys[2]-ys[1]);center=lerp(a,b,t);normal=unit(lerp(nu,nv,Math.max(0,(t-.80)/.4)));sourceX=mix(J[0][0],J[1][0],t);}
   else if(sy<ys[3]){const t=(sy-ys[2])/(ys[3]-ys[2]);center=lerp(b,c,t);normal=unit(lerp(nu,nv,Math.min(1,.5+t/.4)));sourceX=mix(J[1][0],J[2][0],t);}
   else{const t=(sy-ys[3])/Math.max(1,ys[4]-ys[3]);center=c.map((x,i)=>x+v[i]*ext*t);normal=nv;sourceX=J[2][0];}
   // Round the painted surface through the same joint as the underlying
   // contour. A kinked centerline makes an acute elbow a triangular fold.
   if(sy>lo&&sy<hi){const t=(sy-lo)/(hi-lo),pre=b.map((x,i)=>x-u[i]*corner),post=b.map((x,i)=>x+v[i]*corner);center=lerp(lerp(pre,b,t),lerp(b,post,t),t);const tangent=unit(lerp(u,v,t));normal=[tangent[1],-tangent[0]];}
   const x=(sx-sourceX)*d.k;verts.push({s:[sx-d.rect[0],sy-d.rect[1]],d:[center[0]+normal[0]*x,center[1]+normal[1]*x]});
  }
  const xs=verts.map(p=>p.d[0]),ys2=verts.map(p=>p.d[1]),left=Math.min(...xs)-.1,topY=Math.min(...ys2)-.1,w=Math.max(...xs)-left+.1,h=Math.max(...ys2)-topY+.1,scale=16,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';verts.forEach(p=>p.d=[(p.d[0]-left)*scale,(p.d[1]-topY)*scale]);const tex=texture(d);for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col;triangle(ctx,tex,verts[i],verts[i+1],verts[i+cols+2]);triangle(ctx,tex,verts[i],verts[i+cols+2],verts[i+cols+1]);}
  // Almost-opaque triangle interiors must not leave a translucent grid.
  // Keep the actual low-alpha silhouette pixels for smooth outer edges.
  const opaque=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=3;i<opaque.data.length;i+=4)if(opaque.data[i]>=240)opaque.data[i]=255;ctx.putImageData(opaque,0,0);
  const result={url:canvas.toDataURL(),x:left,y:topY,w:canvas.width/scale,h:canvas.height/scale};frames.set(cacheKey,result);if(frames.size>768)frames.delete(frames.keys().next().value);return result;
 }
 // The face painting is recolored by brush luminance (avatar-pixel.js), which
 // keeps the chosen skin's own hue. The sheet's limbs and neck keep more of
 // their own warm shading (WARMTH): a luminance-only map turned the chin's
 // cast shadow grey under the face. PAINT_MEDIAN is the sheet's own skin.
 const PAINT_MEDIAN=[252,217,196],FACE_LUMINANCE=223.8,WARMTH=.6;
 function toneMatrix(skin){const s=skin.slice(1).match(/../g).map(x=>parseInt(x,16)/255),median=.22*PAINT_MEDIAN[0]+.59*PAINT_MEDIAN[1]+.19*PAINT_MEDIAN[2],rows=[];
  for(let c=0;c<3;c++){const lum=s[c]*255/FACE_LUMINANCE*(1-WARMTH),own=s[c]*255/PAINT_MEDIAN[c]*median/FACE_LUMINANCE*WARMTH;rows.push([.22,.59,.19].map((w,k)=>Math.round((lum*w+(k===c?own:0))*1e5)/1e5).concat([0,0]).join(' '));}
  return rows.join(' ')+' 0 0 0 1 0';}
 function apply(r,pose){if(!atlas.ready||!R)return;const view=pose.profile?'Profile':pose.back?'Back':'Front',sex=r.svg.dataset.qpxSex==='m'?'m':'f';
  // Geometry is shared across skin tones. One sRGB colour matrix tints the
  // neutral painting for the wearer's tone without rebuilding pose meshes.
  if(!r.skinPaintFilter){const f=document.createElementNS(NS,'filter');f.id=r.svg.dataset.foundationId+'-paint-tone';f.setAttribute('color-interpolation-filters','sRGB');const matrix=document.createElementNS(NS,'feColorMatrix');matrix.setAttribute('type','matrix');matrix.setAttribute('values',toneMatrix(r.svg.dataset.foundationSkin));f.append(matrix);r.svg.querySelector('defs').append(f);r.skinPaintFilter=f;}
  const tint='url(#'+r.skinPaintFilter.id+')';
  // The sheet's neck sits under the collar it was painted with; the body's
  // calibration neck shapes are not drawn.
  if(!r.neckPainting){r.neckPainting=document.createElementNS(NS,'image');r.neckPainting.setAttribute('filter',tint);r.neckPainting.setAttribute('preserveAspectRatio','none');r.neckPainting.setAttribute('data-foundation-skin-paint','neck');r.parts.torso.insertBefore(r.neckPainting,r.neckEdge);}
  for(const e of [r.neckSurface,r.neckEdge,r.neckShade])e.style.display='none';
  {const F=neckFigure(sex,view),rect=F.rects.neck,collar=root.QPAvatarFoundation.specFor(sex).collar,key=rect.join();if(r.neckPainting.dataset.source!==key){r.neckPainting.setAttribute('href',neckTexture(F));r.neckPainting.dataset.source=key;}
   for(const[k,v]of Object.entries({x:16+(rect[0]-F.neck[0])*F.k,y:collar+(rect[1]-F.neck[1])*F.k,width:rect[2]*F.k,height:rect[3]*F.k}))if(r.neckPainting.getAttribute(k)!==String(v))r.neckPainting.setAttribute(k,v);
   // A leaning walk/run bends the neck at the collar (pose.neckTilt).
   const tilt=pose.neckTilt?'rotate('+(-pose.neckTilt).toFixed(3)+' 16 '+collar+')':'';if((r.neckPainting.getAttribute('transform')||'')!==tilt){if(tilt)r.neckPainting.setAttribute('transform',tilt);else r.neckPainting.removeAttribute('transform');}}
  for(const type of ['arm','leg']){const parts=type==='arm'?r.arms:r.legs;parts.forEach((part,i)=>{const p=type==='arm'?pose.arms[i]:pose.legs[i],points=type==='arm'?[p.shoulder,p.elbow,p.wrist]:p.paint||[p.root,p.knee,p.ankle],def=limbDef(type,sex,view,i),art=painting(def,points);
   if(!part.painting){part.painting=document.createElementNS(NS,'image');part.painting.setAttribute('data-foundation-skin-paint',type);part.painting.setAttribute('filter',tint);part.painting.setAttribute('preserveAspectRatio','none');
    // An arm's sleeve-opening clip sits on a frame, so the forearm overlay can
    // reuse the bare painting above the sleeve with only its own clip.
    part.paintFrame=type==='arm'?document.createElementNS(NS,'g'):part.painting;if(type==='arm')part.paintFrame.append(part.painting);part.parent.insertBefore(part.paintFrame,part.shade);
    // The seated-leg clip exists from the start: motion never adds nodes.
    if(type==='leg'){const g=document.createElementNS(NS,'clipPath');g.id=r.svg.dataset.foundationId+'-leg-skin-paint-'+i;part.paintClip=document.createElementNS(NS,'path');g.append(part.paintClip);r.svg.querySelector('defs').append(g);}}
   const image=part.painting;for(const[k,val]of Object.entries({href:art.url,x:points[0][0]+art.x,y:points[0][1]+art.y,width:art.w,height:art.h}))if(image.getAttribute(k)!==String(val))image.setAttribute(k,val);
   // Clothing owns the sleeve opening clip; the painted hand follows the wrist.
   // Crossed seated legs are painted straight from the knee (leg.paint) and
   // clipped to the body's knee-and-shin contour; the thigh is under the shorts.
   // A desk sit seen from the front shows only the knee and shin, which lie
   // over the shorts cuffs.
   let clip=part.contour.getAttribute('clip-path');if(type==='leg'){clip=null;const lap=pose.desk&&!pose.profile&&!pose.back;if(pose.floor||lap){part.paintClip.setAttribute('d',pose.floor?part.contour.getAttribute('d'):'M'+(p.knee[0]-1.15).toFixed(3)+' '+p.knee[1].toFixed(3)+'A1.15 1.15 0 0 1 '+(p.knee[0]+1.15).toFixed(3)+' '+p.knee[1].toFixed(3)+'L'+(p.knee[0]+2).toFixed(3)+' 70H'+(p.knee[0]-2).toFixed(3)+'Z');clip='url(#'+part.paintClip.parentNode.id+')';}}
   if(clip)part.paintFrame.setAttribute('clip-path',clip);else part.paintFrame.removeAttribute('clip-path');
   part.contour.style.visibility='hidden';part.shade.style.display=type==='leg'&&pose.floor?'':'none';if(type==='arm'){part.hand.style.display='none';forearmOverlay(r,part,p,i,[def.radii[1]*def.k,def.radii[2]*def.k],(def.end-def.joints[2][1])*def.k);openHand(r,part,p,i,tint);}
  });}r.svg.dataset.foundationSkinArt='reference-sheet-v1';}
 // A forearm folded toward the viewer (front/back running, cheering) lies in
 // front of its own sleeve. The same painted arm is shown again, clipped to
 // the forearm and hand, above the sleeve; nothing is redrawn or cloned.
 // Desk forearms reach forward below the sleeve and need no overlay (its clip
 // box showed the upper arm over the sleeve).
 function forearmOverlay(r,part,arm,i,radii,end){
  const id=r.svg.dataset.foundationId+'-arm-paint-'+i;if(part.painting.id!==id)part.painting.id=id;
  if(!part.forearm){const clip=document.createElementNS(NS,'clipPath');clip.id=id+'-forearm';part.forearmClip=document.createElementNS(NS,'path');clip.append(part.forearmClip);r.svg.querySelector('defs').append(clip);part.forearm=document.createElementNS(NS,'use');part.forearm.setAttribute('href','#'+id);part.forearm.setAttribute('clip-path','url(#'+clip.id+')');part.forearm.dataset.foundationForearm=String(i);part.parent.append(part.forearm);}
  // Only a forearm that folds back across its sleeve on screen needs it; a
  // walking forearm continues below the cuff and the copy only hid the cuff.
  const [,e,w]=arm.boneSpace,up=sub(arm.shoulder,arm.elbow),down=sub(arm.wrist,arm.elbow),folded=(up[0]*down[0]+up[1]*down[1])/((Math.hypot(...up)*Math.hypot(...down))||1)>Math.cos(125*Math.PI/180),toward=w[2]-e[2]>.6&&folded&&!r.pose?.profile&&!r.pose?.desk;part.forearm.style.display=toward?'':'none';if(!toward)return;
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
 const HAND={skin:'#fcd7c0',line:'#bd8370',crease:'#e9b9a3',palm:'M-.62 -.16L-.63 .5Q-.62 .88-.3 .9L.34 .88Q.63 .84 .62 .5L.62 -.16Z',palmLine:'M-.62 -.05L-.63 .5Q-.62 .88-.3 .9L.34 .88Q.63 .84 .62 .5L.62 -.05',fingers:'M-.34 .8L-.46 1.4M-.1 .84L-.12 1.55M.14 .82L.2 1.47M.38 .74L.53 1.18M-.48 .32L-.92 .74',crease:'M-.28 .42Q0 .58 .3 .46'};
 function openHand(r,part,arm,i,tint){
  if(!part.openHand){const g=document.createElementNS(NS,'g'),mk=(d,attrs)=>{const e=document.createElementNS(NS,'path');e.setAttribute('d',d);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);g.append(e);return e;};
   g.setAttribute('filter',tint);g.dataset.foundationOpenHand=String(i);
   mk(HAND.fingers,{fill:'none',stroke:HAND.line,'stroke-width':.46,'stroke-linecap':'round'});mk(HAND.palm,{fill:HAND.skin});mk(HAND.palmLine,{fill:'none',stroke:HAND.line,'stroke-width':.08,'stroke-linejoin':'round'});
   mk(HAND.fingers,{fill:'none',stroke:HAND.skin,'stroke-width':.3,'stroke-linecap':'round'});mk(HAND.crease,{fill:'none',stroke:HAND.crease,'stroke-width':.05,'stroke-linecap':'round'});
   part.parent.append(g);part.openHand=g;
   const clip=document.createElementNS(NS,'clipPath');clip.id=r.svg.dataset.foundationId+'-hand-cut-'+i;part.handCut=document.createElementNS(NS,'path');clip.append(part.handCut);r.svg.querySelector('defs').append(clip);}
  const open=(arm.lift||0)>.35;part.openHand.style.display=open?'':'none';
  if(!open){part.painting.removeAttribute('clip-path');part.openHand.removeAttribute('transform');return;}
  if(part.openHand.parentNode!==part.parent||part.openHand.nextSibling)part.parent.append(part.openHand);
  const d=sub(arm.wrist,arm.elbow),l=Math.hypot(...d)||1,u=[d[0]/l,d[1]/l],nrm=[-u[1],u[0]],angle=Math.atan2(u[1],u[0])*180/Math.PI-90+(arm.handTurn||0)*180/Math.PI;
  // Thumb toward the body's centre line (palm or back of the hand to the camera).
  const thumb=[-Math.cos(angle*Math.PI/180),-Math.sin(angle*Math.PI/180)],flip=thumb[0]*(arm.wrist[0]-16)>0?-1:1;
  part.openHand.setAttribute('transform','translate('+arm.wrist.map(v=>v.toFixed(4)).join(' ')+') rotate('+angle.toFixed(3)+') scale('+flip+' 1)');
  const c=[arm.wrist[0]+u[0]*.12,arm.wrist[1]+u[1]*.12],q=(p,a,b)=>(p[0]+u[0]*a+nrm[0]*b).toFixed(3)+' '+(p[1]+u[1]*a+nrm[1]*b).toFixed(3);
  part.handCut.setAttribute('d','M'+q(c,0,12)+'L'+q(c,-30,12)+'L'+q(c,-30,-12)+'L'+q(c,0,-12)+'Z');part.painting.setAttribute('clip-path','url(#'+part.handCut.parentNode.id+')');
 }
 function destroy(r){r.skinPaintFilter?.remove();r.neckPainting?.remove();for(const e of [r.neckSurface,r.neckEdge,r.neckShade])e.style.display='';for(const part of [...r.arms,...r.legs]){part.contour.style.visibility='';part.paintFrame?.remove();part.painting?.remove();part.paintClip?.parentNode.remove();part.forearm?.remove();part.forearmClip?.parentNode.remove();part.openHand?.remove();part.handCut?.parentNode.remove();delete part.forearm;delete part.forearmClip;delete part.openHand;delete part.handCut;}}
 root.QPFoundationSkin=Object.freeze({atlas,files,load,apply,destroy,limbDef});
})(window);
