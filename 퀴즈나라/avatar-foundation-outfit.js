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
  function floorShoe(key,F,i){
    // Authored depth projection about the ankle: the collar keeps its height,
    // while the turned-under sole is foreshortened. Translating a standing
    // shoe upwards would move its opening away from the crossed-leg ankle.
    if(atlas.parts[key])return atlas.parts[key];
    const art=part(key.replace('Floor','Profile'),'shoes',F.rects.shoe[i]),anchor=F.joints.ankle[i],hinge=anchor[1]-art.rect[1],depth=.4,c=document.createElement('canvas');c.width=art.width;c.height=Math.ceil(hinge+(art.height-hinge)*depth);const ctx=c.getContext('2d');
    ctx.drawImage(art.canvas,0,0,art.width,hinge,0,0,art.width,hinge);ctx.drawImage(art.canvas,0,hinge,art.width,art.height-hinge,0,hinge,art.width,(art.height-hinge)*depth);
    return atlas.parts[key]={rect:[art.rect[0],art.rect[1],c.width,c.height],width:c.width,height:c.height,url:c.toDataURL(),projection:{hinge,depth}};
  }
  let loading;
  function load(){root.QPFoundationSkin?.load();return loading||(loading=Promise.all(Object.entries(files).map(async([k,f])=>[k,await QPAvatarImage.load(new URL(f,base).href)])).then(entries=>{Object.assign(images,Object.fromEntries(entries));atlas.ready=true;return atlas;}).catch(error=>{atlas.error=error.message;console.error(error);return atlas;}));}
  const params=new URLSearchParams(location.search);
  if(params.get('avatar')==='foundation'||params.get('session')==='foundation-studio')load();
  // A sleeve is a small cloth mesh, not a rigid cutout. Its sewn edge stays
  // on the shirt while the cuff follows the upper arm; a strongly raised arm
  // lets the whole sleeve turn with it. Results are cached per angle.
  const sleeveCache=new Map(),shortsCache=new Map();
  function sleeveTexture(sex,view,i,angle,lean){
    const F=figure(sex,view),profile=view==='Profile',S=rig(sex,view),restAngle=profile?-Math.atan2(...S.profileSwing):Math.atan2(S.elbow[i][1]-S.shoulder[i][1],S.elbow[i][0]-S.shoulder[i][0])-Math.PI/2;
    const delta=Math.round((angle-restAngle-lean)*180/Math.PI/2)*2*Math.PI/180,cacheKey=[sex,view,i,Math.round(delta*180/Math.PI)].join(':');
    if(sleeveCache.has(cacheKey))return sleeveCache.get(cacheKey);
    const art=part(sex+view+'Sleeve'+i,'sleeves',F.rects.sleeve[i]),shoulder=F.joints.shoulder[i],c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),cols=10,rows=12,vertices=[];
    // Pinning fades for a raised arm: a sewn cap stretched across 120° tore.
    const hold=1-smooth(clamp((Math.abs(delta)*180/Math.PI-40)/50,0,1));
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
  // One continuous shorts drawing, weighted to pelvis and both thighs. The
  // waist and each cuff occur once; the skinning regions share seam vertices.
  function shortsTexture(sex,view,pose){
    const S=rig(sex,view),F=figure(sex,view),profile=pose.profile,key=[sex,view,pose.floor,pose.lean,...pose.legs.flatMap(l=>[...l.root,...l.knee])].map(v=>typeof v==='number'?Math.round(v*24)/24:v).join(':');if(shortsCache.has(key))return shortsCache.get(key);
    const art=part(sex+view+'Shorts','shorts',F.rects.shorts),cols=10,rows=10,vertices=[];
    const [a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=p=>[(d*(p[0]-tx)-c*(p[1]-ty))/det,(-b*(p[0]-tx)+a*(p[1]-ty))/det];
    const projected=pose.legs.map(l=>({root:unmap(l.root),knee:unmap(l.knee)})),start=S.waist-.6;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,[x,y]=local(F,[art.rect[0]+u*art.width,art.rect[1]+v*art.height],F.neck,collar(F)),weight=smooth(clamp((y-start)/1.6,0,1));
      // View projection alters the visible length, never the body's joints.
      const targets=projected.map((leg,i)=>{const hip=profile?S.profileHip[i]:S.hip[i],dx=leg.knee[0]-leg.root[0],dy=leg.knee[1]-leg.root[1],length=Math.hypot(dx,dy),nx=dy/(length||1),ny=-dx/(length||1),along=(y-S.waist)/S.thigh,spread=pose.floor?.5:1;return[leg.root[0]+nx*(x-hip)*spread+dx*along,leg.root[1]+ny*(x-hip)*spread+dy*along];});
      // A side view overlaps both leg openings: follow the mean thigh rather than
      // tearing the seat and fly apart when the legs scissor.
      const side=profile?.5:smooth(clamp((x-15.4)/1.2,0,1)),target=mix(targets[0],targets[1],side);if(pose.floor&&!profile){const centerPin=Math.max(0,1-Math.abs(x-16)/1.9);target[1]=target[1]*(1-centerPin)+(start+(y-start)*.44)*centerPin;}
      vertices.push({s:[u*art.width,v*art.height],d:[x+(target[0]-x)*weight,y+(target[1]-y)*weight]});
    }
    const xs=vertices.map(p=>p.d[0]),ys=vertices.map(p=>p.d[1]),x=Math.min(...xs)-.05,y=Math.min(...ys)-.05,w=Math.max(...xs)-x+.05,h=Math.max(...ys)-y+.05,scale=16,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);vertices.forEach(p=>p.d=[(p.d[0]-x)*scale,(p.d[1]-y)*scale]);
    meshDraw(canvas.getContext('2d'),art.canvas,vertices,cols,rows);
    const result={url:canvas.toDataURL(),x,y,w:canvas.width/scale,h:canvas.height/scale};shortsCache.set(key,result);if(shortsCache.size>160)shortsCache.delete(shortsCache.keys().next().value);return result;
  }
  function sprite(parent,owner){const e=el('image',{'data-outfit-part':owner,preserveAspectRatio:'none'});parent.append(e);return e;}
  function paint(e,art,key,x,y,w,h){if(e.dataset.outfitSource!==key){e.setAttribute('href',art.url);e.dataset.outfitSource=key;}set(e,'x',n(x));set(e,'y',n(y));set(e,'width',n(w));set(e,'height',n(h));}
  function clip(defs,id){const c=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),p=el('path');c.append(p);defs.append(c);return p;}
  function prepare(body){
    if(mounted.has(body.svg))return mounted.get(body.svg);const {svg,parts}=body,id=svg.dataset.foundationId+'-outfit',defs=el('g',{'data-outfit-defs':'true'});svg.querySelector('defs').append(defs);
    const r={body,defs,shirt:sprite(parts.torso,'shirt-torso'),hip:sprite(parts.pelvis,'shorts-hip'),sleeves:[],shoes:[],fit:null};
    r.hip.dataset.outfitDeformation='pelvis-left-thigh-right-thigh';
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
    if(!atlas.ready||!R)return false;const r=prepare(body),{profile,back,floor}=pose,view=profile?'Profile':back?'Back':'Front',sex=body.svg.dataset.qpxSex==='m'?'m':'f',F=figure(sex,view),S=spec(sex);
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
      set(s.skinClip,'transform',s.group.getAttribute('transform'));set(s.skinClip,'d','M-8 '+n(cuff)+'H8V15H-8Z');
      set(s.image,'href',sleeveTexture(sex,view,i,angle,lean).url);for(const[k,v]of Object.entries({x:-4,y:-4,width:8,height:8}))set(s.image,k,v);
      s.image.dataset.sleeveDeformation='seam-pinned';s.image.dataset.sleeveArt=sex+view+i;
      fit.sleeves.push({shoulder:arm.shoulder,opening:[arm.shoulder[0]-Math.sin(angle)*cuff,arm.shoulder[1]+Math.cos(angle)*cuff],armPoint:mix(arm.shoulder,arm.elbow,.52),width:F.rects.sleeve[i][2]*F.k});
    });
    pose.legs.forEach((leg,i)=>{
      const s=r.shoes[i];body.legs[i].foot.style.display='none';
      const key=sex+view+(floor?'Floor':'')+'Shoe'+i,art=floor?floorShoe(sex+'ProfileFloorShoe',figure(sex,'Profile'),0):part(key,'shoes',F.rects.shoe[i]),SF=floor?figure(sex,'Profile'):F,anchor=floor?SF.joints.ankle[0]:F.joints.ankle[i];
      // The ankle lives inside the transparent opening. The shoe front is in
      // front of the lower leg, while the sole has a single ground anchor.
      let shoeAngle=leg.shoeAngle*180/Math.PI,flip=1;
      if(floor){flip=profile?1:i?-1:1;shoeAngle=profile?-8:i?8:-8;}
      set(s.group,'transform','translate('+pt(leg.ankle)+') rotate('+n(shoeAngle)+') scale('+flip+' 1)');
      paint(s.image,art,floor?sex+'Floor':key,(art.rect[0]-anchor[0])*SF.k,(art.rect[1]-anchor[1])*SF.k,art.width*SF.k,art.height*SF.k);
      s.group.style.display=floor&&back?'none':'';
      const parent=floor&&!back?body.body:body.legs[i].parent;if(s.group.parentNode!==parent)parent.append(s.group);if(floor&&!back)body.body.append(s.group);
      const soleHeight=floor?(art.height-(anchor[1]-art.rect[1]))*SF.k:(SF.floor-anchor[1])*SF.k;
      fit.legs.push({root:leg.root,cuff:mix(leg.root,leg.knee,.81),owner:i});
      fit.shoes.push({ankle:leg.ankle,contact:leg.contact,soleHeight,soleY:leg.ankle[1]+soleHeight*Math.cos(shoeAngle*Math.PI/180),owner:i,view:key});
    });
    r.fit=fit;body.svg.dataset.foundationOutfit='basic';return true;
  }
  function destroy(svg){const r=mounted.get(svg);if(!r)return;for(const e of [r.shirt,r.hip,...r.sleeves.map(p=>p.group),...r.shoes.map(p=>p.group),r.defs])e.remove();r.body.underlay.style.display='';r.body.pelvis.contour.style.display='';r.body.pelvis.shade.style.display='';r.body.torso.shade.style.display='';r.body.torso.contour.style.display='';for(const leg of r.body.legs)if(leg.foot)leg.foot.style.display='';for(const arm of r.body.arms){arm.contour.removeAttribute('clip-path');arm.shade.removeAttribute('clip-path');}mounted.delete(svg);}
  root.QPFoundationOutfit=Object.freeze({atlas,files,load,apply,destroy,inspect:svg=>mounted.get(svg)?.fit||null});
})(window);
