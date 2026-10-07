/* Painted skin on the reference body's existing joints. No head replacement.
   All six source limbs share one palette; direction owns its hand surface. */
(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg',base=new URL('.',document.currentScript.src),source='assets/sd-foundation-skin-rounded.png';
 const atlas={ready:false,error:null,source},dyed=new Map(),frames=new Map();let pending;
 const defs={
  neckFront:{source:'assets/sd-foundation-neck.png',rect:[275,252,210,190]},
  neckProfile:{source:'assets/sd-foundation-neck.png',rect:[985,250,160,190]},
  neckBack:{source:'assets/sd-foundation-neck.png',rect:[1730,250,160,190]},
  // Landmarks measured on the rounded source, never reused from the old art.
  armFront:{rect:[323,31,157,440],joints:[[415,60],[402,244],[391,350]],radii:[58,47,39],end:466},
  armProfile:{rect:[730,33,148,444],joints:[[802,60],[803,244],[829,350]],radii:[56,43,35],end:472},
  armBack:{rect:[1115,31,157,443],joints:[[1188,60],[1196,244],[1207,350]],radii:[55,44,39],end:469},
  legFront:{rect:[318,485,162,394],joints:[[399,507],[395,668],[396,853]],radii:[76,52,39],end:879},
  legProfile:{rect:[734,487,160,392],joints:[[818,507],[823,666],[800,853]],radii:[76,58,39],end:879},
  legBack:{rect:[1123,485,162,394],joints:[[1204,507],[1206,668],[1207,853]],radii:[76,53,39],end:879}
 };
 // Neighbouring warped triangles overlap by about a pixel. A thinner overlap
 // left anti-aliased hairline seams that showed the background through.
 const SEAM=.9;
 const mix=(a,b,t)=>a+(b-a)*t,lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t)),unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},sub=(a,b)=>a.map((v,i)=>v-b[i]);
 function load(){return pending||(pending=Promise.all([source,'assets/sd-foundation-neck.png'].map(f=>QPAvatarImage.load(new URL(f,base).href))).then(([im,neck])=>{atlas.image=im;atlas.neck=neck;atlas.ready=true;return atlas;}).catch(e=>{atlas.error=e.message;console.error(e);return atlas;}));}
 function texture(key,skin){const id=key+skin;if(dyed.has(id))return dyed.get(id);const d=defs[key],c=document.createElement('canvas');c.width=d.rect[2];c.height=d.rect[3];const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(d.source?atlas.neck:atlas.image,...d.rect,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height),p=pixels.data,target=skin.slice(1).match(/../g).map(x=>parseInt(x,16)),reference=[252,216,183];for(let i=0;i<p.length;i+=4)if(p[i+3]){if(p[i+3]>=240)p[i+3]=255;for(let k=0;k<3;k++)p[i+k]=Math.min(255,Math.round(p[i+k]*target[k]/reference[k]));}ctx.putImageData(pixels,0,0);dyed.set(id,c);if(dyed.size>36)dyed.delete(dyed.keys().next().value);return c;}
 function triangle(ctx,texture,a,b,c){const[x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(den)<1e-8)return;
  const aa=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,bb=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
  // Offset the edges, not vertices away from the centroid: a long narrow
  // triangle otherwise receives almost no overlap across its short edge.
  const vertices=[a.d,b.d,c.d],sign=Math.sign((u1-u0)*(v2-v0)-(v1-v0)*(u2-u0))||1;
  ctx.save();ctx.beginPath();for(const[i,p]of vertices.entries()){const prev=unit(sub(p,vertices[(i+2)%3])),next=unit(sub(vertices[(i+1)%3],p)),na=[prev[1]*sign,-prev[0]*sign],nb=[next[1]*sign,-next[0]*sign],bis=unit(na.map((v,k)=>v+nb[k])),pad=Math.min(6,SEAM/Math.max(.05,bis[0]*na[0]+bis[1]*na[1])),q=p.map((v,k)=>v+bis[k]*pad);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,u0-aa*x0-cc*y0,v0-bb*x0-dd*y0);ctx.drawImage(texture,0,0);ctx.restore();
 }
 function painting(key,skin,points,widths,flip){const definition=defs[key],relative=points.map(p=>sub(p,points[0])),cacheKey=[key,skin,flip,...relative.flat().map(x=>Math.round(x*40)),...widths].join(':');if(frames.has(cacheKey))return frames.get(cacheKey);
  const [a,b,c]=relative,u=unit(sub(b,a)),v=unit(sub(c,b)),nu=[u[1],-u[0]],nv=[v[1],-v[0]],d=definition,ys=[d.rect[1],d.joints[0][1],d.joints[1][1],d.joints[2][1],d.end],arm=key.startsWith('arm'),ext=arm?1.04:.36,verts=[],rows=18,cols=2;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
   const sy=d.rect[1]+row/rows*d.rect[3],sx=d.rect[0]+col/cols*d.rect[2];let center,normal,sourceX,radius,width;
   if(sy<ys[1]){const t=(sy-ys[1])/(ys[2]-ys[1]);center=lerp(a,b,t);normal=nu;sourceX=d.joints[0][0];radius=d.radii[0];width=widths[0];}
   else if(sy<ys[2]){const t=(sy-ys[1])/(ys[2]-ys[1]);center=lerp(a,b,t);normal=unit(lerp(nu,nv,Math.max(0,(t-.80)/.4)));sourceX=mix(d.joints[0][0],d.joints[1][0],t);radius=mix(d.radii[0],d.radii[1],t);width=mix(widths[0],widths[1],t);}
   else if(sy<ys[3]){const t=(sy-ys[2])/(ys[3]-ys[2]);center=lerp(b,c,t);normal=unit(lerp(nu,nv,Math.min(1,.5+t/.4)));sourceX=mix(d.joints[1][0],d.joints[2][0],t);radius=mix(d.radii[1],d.radii[2],t);width=mix(widths[1],widths[2],t);}
   else {const t=(sy-ys[3])/(ys[4]-ys[3]);center=c.map((x,i)=>x+v[i]*ext*t);normal=nv;sourceX=d.joints[2][0];radius=d.radii[2];width=widths[2];}
   // Round the painted surface through the same joint as the underlying
   // contour. A kinked centerline makes an acute elbow a triangular fold.
   const l1=Math.hypot(...sub(b,a)),l2=Math.hypot(...sub(c,b)),corner=Math.min(.55,l1*.2,l2*.2),lo=ys[2]-corner/l1*(ys[2]-ys[1]),hi=ys[2]+corner/l2*(ys[3]-ys[2]);
   if(sy>lo&&sy<hi){const t=(sy-lo)/(hi-lo),pre=b.map((x,i)=>x-u[i]*corner),post=b.map((x,i)=>x+v[i]*corner);center=lerp(lerp(pre,b,t),lerp(b,post,t),t);const tangent=unit(lerp(u,v,t));normal=[tangent[1],-tangent[0]];}
   const x=(sx-sourceX)*width/radius*flip;verts.push({s:[sx-d.rect[0],sy-d.rect[1]],d:[center[0]+normal[0]*x,center[1]+normal[1]*x]});
  }
  const xs=verts.map(p=>p.d[0]),ys2=verts.map(p=>p.d[1]),left=Math.min(...xs)-.1,top=Math.min(...ys2)-.1,w=Math.max(...xs)-left+.1,h=Math.max(...ys2)-top+.1,scale=16,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';verts.forEach(p=>p.d=[(p.d[0]-left)*scale,(p.d[1]-top)*scale]);const tex=texture(key,skin);for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col;triangle(ctx,tex,verts[i],verts[i+1],verts[i+cols+2]);triangle(ctx,tex,verts[i],verts[i+cols+2],verts[i+cols+1]);}
  // Almost-opaque triangle interiors must not leave a translucent grid.
  // Keep the actual low-alpha silhouette pixels for smooth outer edges.
  const opaque=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=3;i<opaque.data.length;i+=4)if(opaque.data[i]>=240)opaque.data[i]=255;ctx.putImageData(opaque,0,0);
  const result={url:canvas.toDataURL(),x:left,y:top,w:canvas.width/scale,h:canvas.height/scale};frames.set(cacheKey,result);if(frames.size>768)frames.delete(frames.keys().next().value);return result;
 }
 // The face painting is recolored by brush luminance (avatar-pixel.js), which
 // keeps the chosen skin's own hue. Per-channel ratios instead bleached the
 // paler limb highlights, so neck/arms/legs read whiter than the cheeks.
 // Map the painted limbs the same way and keep a little of their warm joints.
 const PAINT_MEDIAN=[252,216,186],FACE_LUMINANCE=223.8,WARMTH=.15;
 function toneMatrix(skin){const s=skin.slice(1).match(/../g).map(x=>parseInt(x,16)/255),median=.22*PAINT_MEDIAN[0]+.59*PAINT_MEDIAN[1]+.19*PAINT_MEDIAN[2],rows=[];
  for(let c=0;c<3;c++){const lum=s[c]*255/FACE_LUMINANCE*(1-WARMTH),own=s[c]*255/PAINT_MEDIAN[c]*median/FACE_LUMINANCE*WARMTH;rows.push([.22,.59,.19].map((w,k)=>Math.round((lum*w+(k===c?own:0))*1e5)/1e5).concat([0,0]).join(' '));}
  return rows.join(' ')+' 0 0 0 1 0';}
 function apply(r,pose){if(!atlas.ready)return;const view=pose.profile?'Profile':pose.back?'Back':'Front',neutral='#fcd8b7';
  // Geometry is shared across skin tones. One sRGB colour matrix tints the
  // neutral painting for the wearer's tone without rebuilding pose meshes.
  if(!r.skinPaintFilter){const f=document.createElementNS(NS,'filter');f.id=r.svg.dataset.foundationId+'-paint-tone';f.setAttribute('color-interpolation-filters','sRGB');const matrix=document.createElementNS(NS,'feColorMatrix');matrix.setAttribute('type','matrix');matrix.setAttribute('values',toneMatrix(r.svg.dataset.foundationSkin));f.append(matrix);r.svg.querySelector('defs').append(f);r.skinPaintFilter=f;}
  const tint='url(#'+r.skinPaintFilter.id+')';
  if(!r.neckPainting){const id=r.svg.dataset.foundationId+'-neck-paint-clip',clip=document.createElementNS(NS,'clipPath');clip.id=id;r.neckPaintClip=document.createElementNS(NS,'path');clip.append(r.neckPaintClip);r.svg.querySelector('defs').append(clip);r.neckPainting=document.createElementNS(NS,'image');r.neckPainting.setAttribute('filter',tint);r.neckPainting.setAttribute('clip-path','url(#'+id+')');r.neckPainting.setAttribute('preserveAspectRatio','none');r.neckPainting.setAttribute('data-foundation-skin-paint','neck');r.parts.torso.insertBefore(r.neckPainting,r.neckEdge);}
  r.neckPaintClip.setAttribute('d',r.neckSurface.getAttribute('d'));const neckKey='neck'+view+r.svg.dataset.foundationSkin;if(r.neckPainting.dataset.source!==neckKey){r.neckPainting.setAttribute('href',texture('neck'+view,neutral).toDataURL());r.neckPainting.dataset.source=neckKey;}for(const[k,v]of Object.entries({x:13.9,y:26.1,width:4.2,height:4.6}))r.neckPainting.setAttribute(k,v);
  for(const type of ['arm','leg']){const parts=type==='arm'?r.arms:r.legs;parts.forEach((part,i)=>{const p=type==='arm'?pose.arms[i]:pose.legs[i],points=type==='arm'?[p.shoulder,p.elbow,p.wrist]:[p.root,p.knee,p.ankle],widths=type==='arm'?root.QPAvatarFoundation.armRadii:[pose.profile?1:root.QPAvatarFoundation.thigh,.89,.49],flip=pose.profile?1:pose.back?(i?-1:1):(i?1:-1),art=painting(type+view,neutral,points,widths,flip);
   if(!part.painting){part.painting=document.createElementNS(NS,'image');part.painting.setAttribute('data-foundation-skin-paint',type);part.painting.setAttribute('filter',tint);part.painting.setAttribute('preserveAspectRatio','none');
    // An arm's sleeve-opening clip sits on a frame, so the forearm overlay can
    // reuse the bare painting above the sleeve with only its own clip.
    part.paintFrame=type==='arm'?document.createElementNS(NS,'g'):part.painting;if(type==='arm')part.paintFrame.append(part.painting);part.parent.insertBefore(part.paintFrame,part.shade);}
   const image=part.painting;for(const[k,val]of Object.entries({href:art.url,x:points[0][0]+art.x,y:points[0][1]+art.y,width:art.w,height:art.h}))if(image.getAttribute(k)!==String(val))image.setAttribute(k,val);
   // Closed footwear keeps its own front lip over the same ankle. Clothing
   // owns the sleeve opening clip; the painted hand follows the wrist once.
   let clip=part.contour.getAttribute('clip-path');if(type==='leg'){if(!part.paintClip){const g=document.createElementNS(NS,'clipPath');g.id=r.svg.dataset.foundationId+'-leg-skin-paint-'+i;part.paintClip=document.createElementNS(NS,'path');g.append(part.paintClip);r.svg.querySelector('defs').append(g);}part.paintClip.setAttribute('d',part.contour.getAttribute('d'));clip='url(#'+r.svg.dataset.foundationId+'-leg-skin-paint-'+i+')';}if(clip)part.paintFrame.setAttribute('clip-path',clip);else part.paintFrame.removeAttribute('clip-path');
   part.contour.style.visibility=type==='arm'?'hidden':'';part.shade.style.display='none';if(type==='arm'){part.hand.style.display='none';forearmOverlay(r,part,p,i);}
  });}r.svg.dataset.foundationSkinArt='painted-rounded-v2';}
 // A forearm folded toward the viewer (front/back running, cheering) lies in
 // front of its own sleeve. The same painted arm is shown again, clipped to
 // the forearm and hand, above the sleeve; nothing is redrawn or cloned.
 function forearmOverlay(r,part,arm,i){
  const id=r.svg.dataset.foundationId+'-arm-paint-'+i;if(part.painting.id!==id)part.painting.id=id;
  if(!part.forearm){const clip=document.createElementNS(NS,'clipPath');clip.id=id+'-forearm';part.forearmClip=document.createElementNS(NS,'path');clip.append(part.forearmClip);r.svg.querySelector('defs').append(clip);part.forearm=document.createElementNS(NS,'use');part.forearm.setAttribute('href','#'+id);part.forearm.setAttribute('clip-path','url(#'+clip.id+')');part.forearm.dataset.foundationForearm=String(i);part.parent.append(part.forearm);}
  const [,e,w]=arm.boneSpace,toward=w[2]-e[2]>.6&&!r.pose?.profile;part.forearm.style.display=toward?'':'none';if(!toward)return;
  const d=sub(arm.wrist,arm.elbow),l=Math.hypot(...d)||1,u=[d[0]/l,d[1]/l],nrm=[-u[1],u[0]],a=[arm.elbow[0]+u[0]*.25,arm.elbow[1]+u[1]*.25],b=[arm.wrist[0]+u[0]*1.25,arm.wrist[1]+u[1]*1.25],q=(p,s)=>(p[0]+nrm[0]*s).toFixed(3)+' '+(p[1]+nrm[1]*s).toFixed(3);
  part.forearmClip.setAttribute('d','M'+q(a,.95)+'L'+q(b,.95)+'L'+q(b,-.95)+'L'+q(a,-.95)+'Z');
 }
 function destroy(r){r.skinPaintFilter?.remove();r.neckPainting?.remove();r.neckPaintClip?.parentNode.remove();for(const part of [...r.arms,...r.legs]){part.contour.style.visibility='';part.paintFrame?.remove();part.painting?.remove();part.paintClip?.parentNode.remove();part.forearm?.remove();part.forearmClip?.parentNode.remove();delete part.forearm;delete part.forearmClip;}}
 root.QPFoundationSkin=Object.freeze({atlas,definitions:defs,load,apply,destroy});
})(window);
