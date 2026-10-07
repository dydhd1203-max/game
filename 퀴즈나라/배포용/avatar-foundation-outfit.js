/* One fitted outfit. Artwork parts share the reference body's joints.
   Source PNG is immutable; openings and part ownership are runtime masks. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',base=new URL('.',document.currentScript.src),source='assets/sd-foundation-basic.png';
  const atlas={ready:false,error:null,parts:{},source},mounted=new WeakMap();
  // Warped mesh triangles overlap by about a pixel; thinner overlaps showed
  // diagonal hairline seams across the denim and sleeves.
  const SEAM=.9;
  // The shorts sit at the natural waist under the untucked shirt. Placing
  // their waistband at the shirt hem read as low-rise shorts on the hips.
  const SHORTS_TOP=35.7,SHORTS_HEIGHT=5.05;
  // The ankle joint sits slightly inside the shoe's collar opening.
  const ANKLE_IN_SHOE=.06;
  const n=x=>Math.round(x*10000)/10000,pt=p=>p.map(n).join(' '),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const el=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const set=(e,k,v)=>{if(e.getAttribute(k)!==String(v))e.setAttribute(k,v);};
  // Coordinates are original 1448 × 1086 pixels, not normalized cell indices.
  const definitions={
    shirtFront:{source:'assets/sd-foundation-torso.png',rect:[176,122,610,699],hole:'M355 110H603L600 140Q596 226 482 229Q370 226 357 143Z'},
    shirtBack:{source:'assets/sd-foundation-torso.png',rect:[992,122,610,699]},
    shirtProfile:{source:'assets/sd-foundation-shirt-profile-rounded.png',rect:[380,62,671,1070],hole:'M543 93Q715 92 913 149Q744 161 543 108Z'},
    sleeve:{rect:[1180,92,195,269],hole:'M1237 330Q1281 305 1345 312Q1348 330 1306 338Q1262 348 1237 330Z'},
    sleeveFrontLeft:{source:'assets/sd-foundation-sleeves.png',rect:[296,66,307,402]},
    sleeveFrontRight:{source:'assets/sd-foundation-sleeves.png',rect:[846,66,307,402]},
    sleeveBackLeft:{source:'assets/sd-foundation-sleeves.png',rect:[295,601,308,395]},
    sleeveBackRight:{source:'assets/sd-foundation-sleeves.png',rect:[846,601,308,395]},
    sleeveRaisedFront:{source:'assets/sd-foundation-sleeves-raised.png',rect:[35,60,770,600],rig:{root:[500,300],mouth:[741,154],reach:2.4},hole:'M696 94Q744 124 778 209Q784 223 772 214Q726 183 702 125Q696 111 696 94Z'},
    sleeveRaisedBack:{source:'assets/sd-foundation-sleeves-raised.png',rect:[742,67,772,590],rig:{root:[1220,310],mouth:[1453,157],reach:2.4},hole:'M1410 100Q1447 130 1487 209Q1495 219 1489 215Q1443 180 1415 132Q1408 108 1410 100Z'},
    sleeveRaisedProfile:{source:'assets/sd-foundation-sleeves-raised.png',rect:[1485,68,673,599],rig:{root:[1840,315],mouth:[2081,170],reach:2.17},hole:'M2036 100Q2080 117 2127 225Q2134 239 2120 231Q2078 200 2048 143Q2036 114 2036 100Z'},
    // Full shorts artwork: one surface weighted to pelvis and both thighs.
    // Its own cuffs are the only hems; no independent tube is overlaid.
    hipFront:{rect:[30,469,363,259]},hipBack:{rect:[413,471,363,259]},hipProfile:{rect:[822,468,244,259]},
    shoeLeft:{rect:[28,764,323,280],anchor:[237,829],ground:1037,hole:'M184 808Q199 777 242 784Q278 789 277 821L263 843Q231 827 204 825Z'},
    shoeRight:{rect:[430,764,315,280],anchor:[526,829],ground:1037,hole:'M489 820Q480 790 513 781Q552 776 574 809L568 827Q537 827 505 844Z'},
    shoeProfile:{rect:[771,796,394,228],anchor:[877,861],ground:1018,hole:'M824 832Q850 858 879 851L908 836L913 855Q874 883 838 864Z'},
    shoeBack:{rect:[1202,780,210,263],anchor:[1301,843],ground:1035,hole:'M1250 846Q1251 798 1296 795Q1339 791 1358 849L1347 865Q1307 843 1260 862Z'}
  };
  function preparePart(img,definition){
    const [x,y,w,h]=definition.rect,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,x,y,w,h,0,0,w,h);
    // Keep the main connected painted object, removing detached generation
    // speckles in the transparent gutters, without recoloring the artwork.
    const pixels=ctx.getImageData(0,0,w,h),data=pixels.data,seen=new Uint8Array(w*h);let largest=[];
    for(let p=0;p<w*h;p++){if(seen[p]||data[p*4+3]<24)continue;const queue=[p];seen[p]=1;for(let q=0;q<queue.length;q++){const a=queue[q],ax=a%w;for(const b of [ax?a-1:-1,ax<w-1?a+1:-1,a-w,a+w])if(b>=0&&b<w*h&&!seen[b]&&data[b*4+3]>=24){seen[b]=1;queue.push(b);}}if(queue.length>largest.length)largest=queue;}
    const keep=new Uint8Array(w*h);for(const p of largest){keep[p]=1;const ax=p%w;for(const b of [ax?p-1:-1,ax<w-1?p+1:-1,p-w,p+w])if(b>=0&&b<w*h)keep[b]=1;}
    for(let p=0;p<w*h;p++)if(!keep[p])data[p*4+3]=0;ctx.putImageData(pixels,0,0);
    if(definition.hole){ctx.save();ctx.translate(-x,-y);ctx.globalCompositeOperation='destination-out';ctx.fill(new Path2D(definition.hole));ctx.restore();}
    return{...definition,width:w,height:h,url:c.toDataURL(),canvas:c};
  }
  function floorShoe(art){
    // Authored depth projection about the ankle: the collar keeps its height,
    // while the turned-under sole is foreshortened. Translating a standing
    // shoe upwards would move its opening away from the crossed-leg ankle.
    const hinge=art.anchor[1]-art.rect[1],depth=.4,c=document.createElement('canvas');c.width=art.width;c.height=Math.ceil(hinge+(art.height-hinge)*depth);const ctx=c.getContext('2d');
    ctx.drawImage(art.canvas,0,0,art.width,hinge,0,0,art.width,hinge);ctx.drawImage(art.canvas,0,hinge,art.width,art.height-hinge,0,hinge,art.width,(art.height-hinge)*depth);
    return{rect:[0,0,c.width,c.height],anchor:[art.anchor[0]-art.rect[0],hinge],ground:hinge+(art.ground-art.anchor[1])*depth,width:c.width,height:c.height,url:c.toDataURL(),projection:{source:'shoeProfile',hinge,depth}};
  }
  // A sleeve is a small cloth mesh, not a rigid cutout. Its proximal cap is
  // pinned to the torso seam; its cuff follows the upper arm. Cached raster
  // textures keep the same six owned garment images in the SVG scene.
  const sleeveSources=new Map(),torsoSources=new Map(),sleeveCache=new Map(),shortsSources=new Map(),shortsCache=new Map();
  function seamTexture(key,source){
    // Only the sewn-in edge blends into the torso fabric. The free silhouette
    // and cream cuff retain the original contour and alpha. A black outline
    // around this buried edge would make the sleeve look like a separate bag.
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);const im=ctx.getImageData(0,0,c.width,c.height),d=im.data,dist=new Uint16Array(c.width*c.height).fill(999),queue=[];
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=y*c.width+x;if(d[i*4+3]<8||!x||!y||x===c.width-1||y===c.height-1){dist[i]=0;queue.push(i);}}
    for(let q=0;q<queue.length;q++){const i=queue[q],x=i%c.width;if(dist[i]>=36)continue;for(const j of[x?i-1:-1,x<c.width-1?i+1:-1,i-c.width,i+c.width])if(j>=0&&j<dist.length&&dist[j]>dist[i]+1){dist[j]=dist[i]+1;queue.push(j);}}
    const profile=key==='sleeve',side=key.endsWith('Right'),raised=definitions[key].rig;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      if(raised){const d=definitions[key],scale=raised.reach/Math.hypot(raised.mouth[0]-raised.root[0],raised.mouth[1]-raised.root[1]),bx=(x+d.rect[0]-raised.root[0])*scale*(d.mirror?-1:1),by=(y+d.rect[1]-raised.root[1])*scale,fade=Math.min(1,Math.max(0,(bx+2.1)/.9),Math.max(0,(3-by)/1.2));{const i=y*c.width+x;im.data[i*4+3]*=fade*fade*(3-2*fade);}continue;}
      const py=(profile?-.42:-.7)+y/c.height*(profile?2.98:3.4),px=profile?-1.43+x/c.width*2.7:(side?-1.3:-1.8)+x/c.width*3.1+(side?-.32:.32)*py,inward=profile?-px:side?-px:px;
      const zone=py<1.7&&(py<.1||inward>.25);if(zone){const i=y*c.width+x,t=Math.max(0,Math.min(1,(dist[i]-4)/24));d[i*4+3]*=t*t*(3-2*t);}
    }ctx.putImageData(im,0,0);return c;
  }
  const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
  function sleeveTexture(key,side,profile,angle,lean){
    const definition=definitions[key],raised=definition.rig,rest=raised?Math.atan2(raised.mouth[1]-raised.root[1],raised.mouth[0]-raised.root[0])-Math.PI/2:profile?Math.atan2(-.1,4.15):Math.atan2(side?-.55:.55,4.15),delta=Math.round((angle-rest-lean)*180/Math.PI/2)*2*Math.PI/180,cacheKey=key+side+':'+Math.round(delta*180/Math.PI);
    if(sleeveCache.has(cacheKey))return sleeveCache.get(cacheKey);
    const textures=sleeveSources.get(key),art=textures.raw,c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),cols=12,rows=18,vertices=[];
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows;let y=(profile?-.42:-.7)+v*(profile?2.98:3.4),x=profile?-1.43+u*2.7:(side?-1.3:-1.8)+u*3.1+(side?-.32:.32)*y;
      if(raised){const scale=raised.reach/Math.hypot(raised.mouth[0]-raised.root[0],raised.mouth[1]-raised.root[1]),q=rotate([(u*art.width+definition.rect[0]-raised.root[0])*scale,(v*art.height+definition.rect[1]-raised.root[1])*scale],-rest);x=q[0];y=q[1];}
      const t=Math.max(0,Math.min(1,(y-.1)/1.7)),inward=profile?-x:(side?-x:x),pin=Math.max(0,Math.min(1,(inward+.25)/1.05))*(1-t*t*(3-2*t)),weight=1-pin,fixed=rotate([x,y],-delta),p=[fixed[0]*(1-weight)+x*weight,fixed[1]*(1-weight)+y*weight];
      vertices.push({s:[u*art.width,v*art.height],d:[(p[0]+4)*32,(p[1]+4)*32]});
    }
    function triangle(a,b,c,texture){
      const [x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
      const m0=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,m2=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,m1=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,m3=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
      ctx.save();ctx.beginPath();const center=[(u0+u1+u2)/3,(v0+v1+v2)/3];for(const[p,i]of[a.d,b.d,c.d].map((p,i)=>[p,i])){const dx=p[0]-center[0],dy=p[1]-center[1],l=Math.hypot(dx,dy)||1,q=[p[0]+dx/l*SEAM,p[1]+dy/l*SEAM];if(i)ctx.lineTo(...q);else ctx.moveTo(...q);}ctx.closePath();ctx.clip();ctx.setTransform(m0,m1,m2,m3,u0-m0*x0-m2*y0,v0-m1*x0-m3*y0);ctx.drawImage(texture,0,0);ctx.restore();
    }
    function draw(texture){for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+1,d=a+cols+1,e=d+1;triangle(vertices[a],vertices[b],vertices[e],texture);triangle(vertices[a],vertices[e],vertices[d],texture);}}
    function bodyMask(operation){const torso=torsoSources.get(profile?'shirtProfile':key.includes('Back')?'shirtBack':'shirtFront'),shoulder=profile?(side?15.85:15.6):side?19.3:12.7;ctx.save();ctx.globalCompositeOperation=operation;ctx.translate(128,128);ctx.scale(32,32);ctx.rotate(-rest-delta);ctx.translate(-shoulder,-29.9);ctx.drawImage(torso,profile?13.15:11.55,28.55,profile?5.7:8.9,8.65);ctx.restore();}
    // Keep a crisp free silhouette; only the edge actually OVER torso fabric
    // is a soft sewn join. Never feather the exposed underside into thin air.
    draw(art);bodyMask('destination-out');const exterior=document.createElement('canvas');exterior.width=exterior.height=256;exterior.getContext('2d').drawImage(c,0,0);ctx.clearRect(0,0,256,256);draw(textures.sewn);bodyMask('destination-in');ctx.globalCompositeOperation='lighter';ctx.drawImage(exterior,0,0);ctx.globalCompositeOperation='source-over';
    const result={url:c.toDataURL(),canvas:c};sleeveCache.set(cacheKey,result);if(sleeveCache.size>160)sleeveCache.delete(sleeveCache.keys().next().value);return result;
  }
  // Front/back raised sleeves were painted for the right arm; the left arm
  // uses the same painting mirrored. Side views share one forward raise.
  const raisedKey=(view,side)=>'sleeveRaised'+view+(view!=='Profile'&&side!==1?'Mirror':'');
  const raisedReach=(view,side,lift)=>view!=='Profile'&&side!==1?-lift:lift;
  function fittedSleeveTexture(key,side,profile,angle,lean,view,lift){
    const t=Math.max(0,Math.min(1,(raisedReach(view,side,lift)-50)/15));if(!t)return sleeveTexture(key,side,profile,angle,lean).url;
    const raised=raisedKey(view,side);if(t===1)return sleeveTexture(raised,side,profile,angle,lean).url;
    const weight=Math.round(t*15)/15,cacheKey='blend:'+key+':'+Math.round((angle-lean)*180/Math.PI/2)+':'+weight;if(sleeveCache.has(cacheKey))return sleeveCache.get(cacheKey).url;
    const a=sleeveTexture(key,side,profile,angle,lean),b=sleeveTexture(raised,side,profile,angle,lean),c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.globalAlpha=1-weight;ctx.drawImage(a.canvas,0,0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=weight;ctx.drawImage(b.canvas,0,0);const result={url:c.toDataURL(),canvas:c};sleeveCache.set(cacheKey,result);if(sleeveCache.size>160)sleeveCache.delete(sleeveCache.keys().next().value);return result.url;
  }
  // One continuous original shorts drawing, weighted to pelvis and both
  // thighs. The waist and each cuff occur once; no unrelated tube is stacked
  // over the original pockets. The skinning regions share their seam vertices.
  function shortsTexture(pose,view){
    const key=[view,pose.floor,pose.lean,...pose.legs.flatMap(l=>[...l.root,...l.knee])].map(v=>typeof v==='number'?Math.round(v*24)/24:v).join(':');if(shortsCache.has(key))return shortsCache.get(key);
    const texture=shortsSources.get('hip'+view),profile=pose.profile,origin=[profile?13.3:12.05,SHORTS_TOP],size=[profile?5.4:7.9,SHORTS_HEIGHT],cols=10,rows=10,vertices=[];
    const [a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=p=>[(d*(p[0]-tx)-c*(p[1]-ty))/det,(-b*(p[0]-tx)+a*(p[1]-ty))/det];
    const projected=pose.legs.map(l=>({root:unmap(l.root),knee:unmap(l.knee)}));
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const u=col/cols,v=row/rows,x=origin[0]+u*size[0],y=origin[1]+v*size[1],t=Math.max(0,Math.min(1,(y-37.6)/1.6)),weight=t*t*(3-2*t);
      // View projection alters the visible length, never the body's joints.
      const targets=projected.map((leg,i)=>{const hip=profile?root.QPAvatarFoundation.spec.profileHip[i]:i?18.35:13.65,dx=leg.knee[0]-leg.root[0],dy=leg.knee[1]-leg.root[1],length=Math.hypot(dx,dy),nx=dy/(length||1),ny=-dx/(length||1),along=(y-38.1)/3.2;return[leg.root[0]+nx*(x-hip)*(pose.floor?.5:1)+dx*along,leg.root[1]+ny*(x-hip)*(pose.floor?.5:1)+dy*along];});
      // A side view overlaps both leg openings: follow the mean thigh rather than
      // tearing the seat and fly apart when the legs scissor.
      const side=profile?.5:Math.max(0,Math.min(1,(u-.42)/.16)),target=targets[0].map((z,i)=>z+(targets[1][i]-z)*side);if(pose.floor&&!profile){const centerPin=Math.max(0,1-Math.abs(u-.5)/.24);target[1]=target[1]*(1-centerPin)+(37.6+(y-37.6)*.44)*centerPin;}
      vertices.push({s:[u*texture.width,v*texture.height],d:[x+(target[0]-x)*weight,y+(target[1]-y)*weight]});
    }
    const xs=vertices.map(p=>p.d[0]),ys=vertices.map(p=>p.d[1]),x=Math.min(...xs)-.05,y=Math.min(...ys)-.05,w=Math.max(...xs)-x+.05,h=Math.max(...ys)-y+.05,scale=16,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);const ctx=canvas.getContext('2d');vertices.forEach(p=>p.d=[(p.d[0]-x)*scale,(p.d[1]-y)*scale]);
    function draw(a,b,c){const [x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0),aa=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,bb=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;ctx.save();ctx.beginPath();const center=[(u0+u1+u2)/3,(v0+v1+v2)/3];for(const[p,i]of[a.d,b.d,c.d].map((p,i)=>[p,i])){const dx=p[0]-center[0],dy=p[1]-center[1],l=Math.hypot(dx,dy)||1,q=[p[0]+dx/l*SEAM,p[1]+dy/l*SEAM];i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,u0-aa*x0-cc*y0,v0-bb*x0-dd*y0);ctx.drawImage(texture,0,0);ctx.restore();}
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col;draw(vertices[i],vertices[i+1],vertices[i+cols+2]);draw(vertices[i],vertices[i+cols+2],vertices[i+cols+1]);}
    const result={url:canvas.toDataURL(),x,y,w:canvas.width/scale,h:canvas.height/scale};shortsCache.set(key,result);if(shortsCache.size>160)shortsCache.delete(shortsCache.keys().next().value);return result;
  }
  function mirrorSleeve(key){
    const d=definitions[key],part=atlas.parts[key],c=document.createElement('canvas');c.width=part.width;c.height=part.height;const ctx=c.getContext('2d');ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(part.canvas,0,0);
    const flip=x=>2*d.rect[0]+d.rect[2]-x;definitions[key+'Mirror']={...d,hole:undefined,mirror:true,rig:{...d.rig,root:[flip(d.rig.root[0]),d.rig.root[1]],mouth:[flip(d.rig.mouth[0]),d.rig.mouth[1]]}};
    return{...part,...definitions[key+'Mirror'],url:c.toDataURL(),canvas:c};
  }
  let loading;
  function load(){root.QPFoundationSkin?.load();return loading||(loading=Promise.all([...new Set([source,...Object.values(definitions).map(d=>d.source).filter(Boolean)])].map(async file=>[file,await QPAvatarImage.load(new URL(file,base).href)])).then(entries=>{const images=Object.fromEntries(entries);for(const[k,d]of Object.entries(definitions))atlas.parts[k]=preparePart(images[d.source||source],d);atlas.parts.shoeFloor=floorShoe(atlas.parts.shoeProfile);for(const key of ['sleeveRaisedFront','sleeveRaisedBack'])atlas.parts[key+'Mirror']=mirrorSleeve(key);for(const[key,part]of Object.entries(atlas.parts)){if(key.startsWith('sleeve')){const sewn=seamTexture(key,part.canvas);sleeveSources.set(key,{raw:definitions[key].rig?sewn:part.canvas,sewn});}if(key.startsWith('shirt'))torsoSources.set(key,part.canvas);if(key.startsWith('hip'))shortsSources.set(key,part.canvas);delete part.canvas;}atlas.ready=true;return atlas;}).catch(error=>{atlas.error=error.message;console.error(error);return atlas;}));}
  const params=new URLSearchParams(location.search);
  if(params.get('avatar')==='foundation'||params.get('session')==='foundation-studio')load();
  function sprite(parent,owner){const e=el('image',{'data-outfit-part':owner,preserveAspectRatio:'none'});parent.append(e);return e;}
  function paint(e,key,x,y,w,h){const s=atlas.parts[key];if(!s)return;if(e.dataset.outfitSource!==key){e.setAttribute('href',s.url);e.dataset.outfitSource=key;}set(e,'x',n(x));set(e,'y',n(y));set(e,'width',n(w));set(e,'height',n(h));}
  function clip(defs,id){const c=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),p=el('path');c.append(p);defs.append(c);return p;}
  function prepare(body){
    if(mounted.has(body.svg))return mounted.get(body.svg);const {svg,parts}=body,id=svg.dataset.foundationId+'-outfit',defs=el('g',{'data-outfit-defs':'true'});svg.querySelector('defs').append(defs);
    const r={body,defs,shirt:sprite(parts.torso,'shirt-torso'),hip:sprite(parts.pelvis,'shorts-hip'),sleeves:[],legs:[],shoes:[],fit:null};
    r.hip.dataset.outfitDeformation='pelvis-left-thigh-right-thigh';
    // The body owns a direction-specific neck surface, not a rectangular fill.
    for(let i=0;i<2;i++){
      const arm=body.arms[i],leg=body.legs[i],sleeve=el('g',{'data-outfit-owner':'arm-'+i}),tube=el('g',{'data-outfit-owner':'leg-'+i}),shoe=el('g',{'data-outfit-owner':'foot-'+i});
      arm.parent.insertBefore(sleeve,arm.hand);leg.parent.append(tube,shoe);
      const skinClip=clip(defs,id+'-arm-skin-'+i);arm.contour.setAttribute('clip-path','url(#'+id+'-arm-skin-'+i+')');arm.shade.setAttribute('clip-path','url(#'+id+'-arm-skin-'+i+')');
      r.sleeves.push({group:sleeve,image:sprite(sleeve,'sleeve-'+i),skinClip});
      tube.dataset.outfitSkinRegion='shorts-thigh-'+i;r.legs.push({group:tube});
      r.shoes.push({group:shoe,image:sprite(shoe,'shoe-'+i)});
    }
    mounted.set(svg,r);return r;
  }
  function apply(body,pose){
    if(!atlas.ready)return false;const r=prepare(body),{profile,back,floor}=pose,view=profile?'Profile':back?'Back':'Front';
    // Covered calibration underwear and bare feet have no second visible copy.
    body.underlay.style.display='none';
    body.pelvis.contour.style.display='none';body.pelvis.shade.style.display='none';body.torso.contour.style.display='none';body.torso.shade.style.display='none';
    // Front/back sleeve caps overlap their torso armholes: the body rig
    // already layers hanging arms above the shirt (never a cloned arm).
    paint(r.shirt,'shirt'+view,profile?13.15:11.55,28.55,profile?5.7:8.9,8.65);
    const shorts=shortsTexture(pose,view);for(const[k,v]of Object.entries({href:shorts.url,x:shorts.x,y:shorts.y,width:shorts.w,height:shorts.h}))set(r.hip,k,v);r.hip.dataset.outfitSource='hip'+view;
    const fit={view,coveredFeet:2,sleeves:[],legs:[],shoes:[]};
    pose.arms.forEach((arm,i)=>{
      const s=r.sleeves[i],turn=Math.atan2(arm.elbow[1]-arm.shoulder[1],arm.elbow[0]-arm.shoulder[0])-Math.PI/2,angle=Math.atan2(Math.sin(turn),Math.cos(turn));
      const axis=[Math.sin(-angle),Math.cos(angle)],center=[arm.shoulder[0]+axis[0]*2.18,arm.shoulder[1]+axis[1]*2.18];
      set(s.group,'transform','translate('+pt(arm.shoulder)+') rotate('+n(angle*180/Math.PI)+')');
      // Hide the upper arm owned by the body inside its sleeve. The mask
      // follows the same shoulder transform; no exposed shoulder rectangle.
      set(s.skinClip,'transform',s.group.getAttribute('transform'));set(s.skinClip,'d','M-8 '+(profile?1.95:1.75)+'H8V15H-8Z');
      const sleeveKey=profile?'sleeve':'sleeve'+view+(i?'Right':'Left');
      paint(s.image,sleeveKey,-4,-4,8,8);
      const lean=pose.lean*Math.PI/180,rest=profile?Math.atan2(-.1,4.15):Math.atan2(i?-.55:.55,4.15),lift=-(angle-rest-lean)*180/Math.PI;
      const reach=raisedReach(view,i,lift);set(s.image,'href',fittedSleeveTexture(sleeveKey,i,profile,angle,lean,view,lift));s.image.dataset.sleeveDeformation=reach>50?'authored-raised':'seam-pinned';s.image.dataset.sleeveArt=reach<=50?sleeveKey:reach>=65?raisedKey(view,i):sleeveKey+'+'+raisedKey(view,i);
      fit.sleeves.push({shoulder:arm.shoulder,opening:center,armPoint:mix(arm.shoulder,arm.elbow,.52),width:1.8});
    });
    pose.legs.forEach((leg,i)=>{
      const p=r.legs[i],s=r.shoes[i],angle=Math.atan2(leg.knee[1]-leg.root[1],leg.knee[0]-leg.root[0])-Math.PI/2;
      set(p.group,'transform','translate('+pt(leg.root)+') rotate('+n(angle*180/Math.PI)+')');
      // The cuff is part of the shared shorts mesh weighted to this thigh.
      body.legs[i].foot.style.display='none';
      const key=floor?'shoeFloor':profile?'shoeProfile':back?'shoeBack':i?'shoeRight':'shoeLeft',art=atlas.parts[key];
      const sx=(profile||floor?3.7:back?2.5:3.1)/art.width,soleHeight=floor?.6:1.9,sy=soleHeight/(art.ground-art.anchor[1]);
      // The ankle lives inside the transparent opening. The shoe front is in
      // front of the lower leg, while the sole has a single ground anchor.
      let shoeAngle=leg.shoeAngle*180/Math.PI,flip=1;
      if(floor){flip=profile?1:i?-1:1;shoeAngle=profile?-8:i?8:-8;}
      set(s.group,'transform','translate('+pt(leg.ankle)+') rotate('+n(shoeAngle)+') scale('+flip+' 1)');
      // The ankle sits just inside the collar opening rather than on its
      // lower lip, so a tucked or lifted foot never shows the lining there.
      paint(s.image,key,(art.rect[0]-art.anchor[0])*sx,(art.rect[1]-art.anchor[1])*sy+(floor?0:ANKLE_IN_SHOE),art.width*sx,art.height*sy);
      s.group.style.display=floor&&back?'none':'';
      const parent=floor&&!back?body.body:body.legs[i].parent;if(s.group.parentNode!==parent)parent.append(s.group);if(floor&&!back)body.body.append(s.group);
      fit.legs.push({root:leg.root,cuff:mix(leg.root,leg.knee,.81),owner:i});
      fit.shoes.push({ankle:leg.ankle,contact:leg.contact,soleHeight,soleY:leg.ankle[1]+(soleHeight+(floor?0:ANKLE_IN_SHOE))*Math.cos(shoeAngle*Math.PI/180),owner:i,view:key});
    });
    r.fit=fit;body.svg.dataset.foundationOutfit='basic';return true;
  }
  function destroy(svg){const r=mounted.get(svg);if(!r)return;for(const e of [r.shirt,r.hip,...r.sleeves.map(p=>p.group),...r.legs.map(p=>p.group),...r.shoes.map(p=>p.group),r.defs])e.remove();r.body.underlay.style.display='';r.body.pelvis.contour.style.display='';r.body.pelvis.shade.style.display='';r.body.torso.shade.style.display='';r.body.torso.contour.style.display='';for(const leg of r.body.legs)if(leg.foot)leg.foot.style.display='';for(const arm of r.body.arms){arm.contour.removeAttribute('clip-path');arm.shade.removeAttribute('clip-path');}mounted.delete(svg);}
  root.QPFoundationOutfit=Object.freeze({atlas,load,apply,destroy,inspect:svg=>mounted.get(svg)?.fit||null,definitions});
})(window);
