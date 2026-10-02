/* Actual painted side heads and a reversible perspective rig. Original frontal
 * artwork remains mounted. Colors/crops are cached only when the wearer changes. */
(function () {
  'use strict';
  const NS='http://www.w3.org/2000/svg',SIZE=384,HEIGHT=480,rigs=new WeakMap(),mounted=new Set(),frames=new Map(),cache=new Map();
  const hair={f:['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'],m:['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf']};
  const sheets={f:{url:'assets/sd-heads-profile-female.png',rects:[[58,88,278,248],[418,92,272,244],[727,83,306,300],[1098,90,308,302],[48,398,319,328],[418,431,290,247],[775,418,278,291],[1109,423,294,292],[54,750,282,257],[430,755,291,253],[771,745,288,261],[1151,755,251,300]],necks:[[169.8,245],[162.8,241],[183,241],[207,240],[203.4,277],[177.1,244],[157.1,256],[194,231],[172.7,254],[170.8,250],[155.4,258],[144.6,255]]},m:{url:'assets/sd-heads-profile-male.png',rects:[[46,75,295,291],[397,40,309,326],[742,79,315,291],[1098,56,328,313],[56,413,275,283],[394,413,317,284],[759,396,291,303],[1106,396,308,302],[51,720,280,290],[395,712,323,304],[758,722,309,295],[1095,707,339,330]],necks:[[167.6,287],[174.9,322],[171.1,287],[183.2,309],[151.4,279],[176.6,280],[158.3,299],[179.7,298],[152.8,286],[177,300],[160.3,291],[196.3,309]]}};
  const backSheets={
    m:{url:'assets/sd-heads-back-male.png',rects:[[50,78,274,285],[396,52,299,313],[762,85,289,282],[1108,69,318,297],[58,423,262,277],[401,432,296,272],[776,404,272,300],[1118,404,296,301],[50,732,265,290],[387,725,315,299],[761,731,288,293],[1109,723,317,310]]},
    f:{url:'assets/sd-heads-back-female.png',rects:[[45,95,269,229],[406,97,279,231],[742,76,326,295],[1101,86,326,290],[50,407,289,310],[400,442,304,236],[759,432,302,260],[1108,423,316,285],[45,757,284,238],[406,745,301,257],[773,746,265,252],[1142,740,241,303]],anchors:[[179,317],[548,320],[906,295],[1252,285],[179,644],[548,669],[908,670],[1265,642],[182,983],[552,990],[905,986],[1267,963]]}
  };
  const backFrames=new Map(),backCache=new Map();
  const atlas={ready:false,backReady:false,columns:4,rows:3,style:'illustrated-profile',sourceDimensions:{},backSourceDimensions:{},normalizationCount:0,backNormalizationCount:0,cacheHits:0};
  let serial=0;
  const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
  const rgb=s=>String(s).match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16));
  const node=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const value=(el,key,v)=>{if(v===null)el.removeAttribute(key);else if(el.getAttribute(key)!==String(v))el.setAttribute(key,v);};
  const wrap=(el,name)=>{const n=node('g',{'data-qpx-direction-part':name});el.parentNode.insertBefore(n,el);n.append(el);return n;};
  const unwrap=el=>{if(!el?.parentNode)return;while(el.firstChild)el.parentNode.insertBefore(el.firstChild,el);el.remove();};
  function inspect(data,w,h){
    const warm=p=>{const i=p*4,r=data[i],g=data[i+1],b=data[i+2];return data[i+3]>24&&r>186&&g>122&&b>91&&r>g*1.025&&g>b*.94&&r-g<100&&g-b<81;};
    let lx=w,rx=0,ty=h,by=0,count=0,sx=0,sy=0;
    for(let y=0;y<h;y++)for(let x=Math.floor(w*.57);x<w;x++){const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(y>h*.36&&y<h*.88&&data[i+3]>120&&g>r+13&&b>r+6&&r<170&&g<200){lx=Math.min(lx,x);rx=Math.max(rx,x);ty=Math.min(ty,y);by=Math.max(by,y);sx+=x;sy+=y;count++;}}
    if(count<12)throw new Error('옆모습 눈 원화가 없어요');
    const eye={x:sx/count,y:sy/count,left:lx,right:rx,top:ty,bottom:by};
    const mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),components=[];
    for(let p=0;p<mask.length;p++)if(warm(p))mask[p]=1;
    for(let p=0;p<mask.length;p++)if(mask[p]&&!seen[p]){const queue=[p];seen[p]=1;let dist=Infinity;for(let n=0;n<queue.length;n++){const q=queue[n],x=q%w,y=Math.floor(q/w);dist=Math.min(dist,(x-eye.x+12)**2+(y-eye.y-24)**2);for(const d of[-w,w,-1,1]){const next=q+d;if(next<0||next>=mask.length||d===-1&&x===0||d===1&&x===w-1||!mask[next]||seen[next])continue;seen[next]=1;queue.push(next);}}if(queue.length>w*h*.008)components.push({queue,dist});}
    components.sort((a,b)=>a.dist-b.dist);
    const faceMask=new Uint8Array(w*h);for(const part of components)if(part===components[0]||part.queue.length<components[0].queue.length*.36&&part.dist<2000)for(const p of part.queue)faceMask[p]=1;
    const nearFace=new Uint8Array(w*h);for(let p=0;p<faceMask.length;p++)if(faceMask[p]){const x=p%w,y=Math.floor(p/w);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)nearFace[yy*w+xx]=1;}}
    return {eye,faceMask,nearFace};
  }
  async function load(sex){
    const sheet=sheets[sex],img=await window.QPAvatarImage.load(sheet.url),out=[];
    atlas.sourceDimensions[sex]=[img.naturalWidth,img.naturalHeight];
    for(let tile=0;tile<12;tile++){
      const [x,y,w,h]=sheet.rects[tile],canvas=document.createElement('canvas');canvas.width=w+6;canvas.height=h+6;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,x-3,y-3,w+6,h+6,0,0,w+6,h+6);
      const data=ctx.getImageData(0,0,w+6,h+6).data,stats=inspect(data,w+6,h+6),neck=sheet.necks[tile].map(v=>v+3);
      const scale=25.8/(w+6),ox=16-neck[0]*scale,oy=28.65-neck[1]*scale;
      out.push({...stats,data,w:w+6,h:h+6,geometry:{scale,x:ox,y:oy},neck});
    }
    frames.set(sex,out);
  }
  async function loadBack(sex){
    const sheet=backSheets[sex],img=await window.QPAvatarImage.load(sheet.url),out=[];
    atlas.backSourceDimensions[sex]=[img.naturalWidth,img.naturalHeight];
    for(let tile=0;tile<12;tile++){
      const [sx,sy,w,h]=sheet.rects[tile],canvas=document.createElement('canvas');canvas.width=w+6;canvas.height=h+6;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,sx-3,sy-3,w+6,h+6,0,0,w+6,h+6);
      const data=ctx.getImageData(0,0,w+6,h+6).data;
      const anchor=sheet.anchors?sheet.anchors[tile].map((v,i)=>v-(i?sy:sx)+3):[(w+6)/2,h+1];
      const scale=Math.min(28.6/(w+6),24/Math.max(1,anchor[1]-3));
      out.push({data,w:w+6,h:h+6,anchor,geometry:{scale,x:16-anchor[0]*scale,y:28.75-anchor[1]*scale}});
    }
    backFrames.set(sex,out);
  }
  function backPainting(sex,tile,color,skin){
    const key=[sex,tile,color,skin].join('/');if(backCache.has(key))return backCache.get(key);
    const frame=backFrames.get(sex)?.[tile];if(!frame)return null;
    const canvas=document.createElement('canvas');canvas.width=frame.w;canvas.height=frame.h;
    const ctx=canvas.getContext('2d'),out=ctx.createImageData(frame.w,frame.h),d=out.data,dye=rgb(color),base=rgb(skin);
    for(let i=0;i<d.length;i+=4){const source=frame.data,r=source[i],g=source[i+1],b=source[i+2];if(!source[i+3])continue;
      let col=[r,g,b];
      // Actual painted ears/nape retain this wearer's skin. The fade's painted
      // short stubble is a skin-and-hair mixture, never an empty face aperture.
      const skinPixel=r>185&&g>113&&b>95&&g/r>.54&&b/g>.67;
      if(skinPixel){const shade=(r*.22+g*.59+b*.19)/219,warmth=Math.max(0,(r-g-34)/78);col=base.map((v,k)=>clamp(Math.round(v*shade+(k===0?10:k===1?-15:-5)*warmth)));}
      else if(r>g*1.025&&g>b*.98&&r>24){const lum=r*.25+g*.59+b*.16,gain=lum/102,shine=Math.max(0,lum-160)*.38;col=dye.map(v=>clamp(Math.round(v*gain+shine)));}
      d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=source[i+3];
    }
    ctx.putImageData(out,0,0);const target=document.createElement('canvas');target.width=SIZE;target.height=HEIGHT;
    const paint=target.getContext('2d'),m=frame.geometry;paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';paint.drawImage(canvas,m.x*12,m.y*12,frame.w*m.scale*12,frame.h*m.scale*12);
    const result=target.toDataURL('image/png');atlas.backNormalizationCount++;if(backCache.size>=160)backCache.delete(backCache.keys().next().value);backCache.set(key,result);return result;
  }
  function preparePatch(frame,recolored){
    const {eye,w,h,faceMask,data}=frame,cx=(eye.left+eye.right)/2,cy=(eye.top+eye.bottom)/2;
    // Teal detection locates the iris, while a blink must erase the complete
    // white aperture and both painted lash edges around that smaller iris.
    const rx=Math.max(27,(eye.right-eye.left)*1.9),ry=Math.max(28,(eye.bottom-eye.top)*1.55);
    const brown=new Uint8Array(w*h),solid=new Uint8Array(w*h),fringe=new Uint8Array(w*h),queue=[];
    for(let p=0;p<brown.length;p++){const i=p*4,r=data[i],g=data[i+1],b=data[i+2];if(!frame.nearFace[p]&&r>52&&g>30&&b>17&&r>g*1.32&&g>b*1.18&&r-g>18)brown[p]=1;}
    // Eroded broad hair masses keep their silhouette; the old thin lash is
    // deliberately excluded before the fringe edge is reconstructed.
    for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){const p=y*w+x;if(!brown[p])continue;let inside=true;for(let dy=-3;dy<=3&&inside;dy++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dy*dy<=9&&!brown[p+dy*w+dx]){inside=false;break;}if(inside)solid[p]=1;}
    for(let p=0;p<solid.length;p++)if(solid[p]&&Math.floor(p/w)<eye.y-h*.13){fringe[p]=1;queue.push(p);}
    for(let n=0;n<queue.length;n++){const p=queue[n],x=p%w,y=Math.floor(p/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;if(solid[next]&&!fringe[next]){fringe[next]=1;queue.push(next);}}}
    const protectedHair=new Uint8Array(fringe);for(const p of queue){const x=p%w,y=Math.floor(p/w);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy;if(dx*dx+dy*dy<=9&&xx>=0&&xx<w&&yy>=0&&yy<h&&brown[yy*w+xx])protectedHair[yy*w+xx]=1;}}
    const matrix=Array.from({length:3},()=>[0,0,0]),values=Array.from({length:3},()=>[0,0,0]);
    for(let y=Math.max(0,Math.floor(cy-ry-15));y<Math.min(h,cy+ry+17);y+=2)for(let x=Math.max(0,Math.floor(cx-rx-15));x<Math.min(w,cx+rx+17);x+=2){const p=y*w+x,i=p*4,dx=(x-cx)/rx,dy=(y-cy)/ry;if(!faceMask[p]||data[i+3]<240||dx*dx+dy*dy<1.17||data[i]<215||data[i+1]<139||data[i+2]<111)continue;const weight=1/(1+dx*dx+dy*dy),v=[1,dx,dy];for(let j=0;j<3;j++){for(let k=0;k<3;k++)matrix[j][k]+=weight*v[j]*v[k];for(let c=0;c<3;c++)values[c][j]+=weight*v[j]*recolored[i+c];}}
    const solve=values=>{const a=matrix.map((row,i)=>[...row,values[i]]);for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i]||1;for(let k=i;k<4;k++)a[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){const f=a[j][i];for(let k=i;k<4;k++)a[j][k]-=f*a[i][k];}}return a.map(r=>r[3]);};
    const coefficients=values.map(solve),patch=document.createElement('canvas');patch.width=w;patch.height=h;const ctx=patch.getContext('2d'),pixels=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x,i=p*4,dx=(x-cx)/rx,dy=(y-cy)/ry,edge=(1-Math.sqrt(dx*dx+dy*dy))*Math.min(rx,ry),alpha=clamp(edge/2.5,0,1);if(!alpha||!data[i+3]||protectedHair[p]||y>eye.bottom+12)continue;
      let outline=false;for(const[ox,oy]of[[-2,0],[2,0],[0,-2],[0,2]]){const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h||data[(yy*w+xx)*4+3]<30){outline=true;break;}}if(outline)continue;
      for(let c=0;c<3;c++)pixels.data[i+c]=clamp(Math.round(coefficients[c][0]+coefficients[c][1]*dx+coefficients[c][2]*dy));pixels.data[i+3]=Math.round(255*alpha);
    }
    ctx.putImageData(pixels,0,0);return patch;
  }
  function painting(sex,tile,color,skin,expression){
    const key=[sex,tile,color,skin,expression].join('/');if(cache.has(key)){atlas.cacheHits++;return cache.get(key);}
    const frame=frames.get(sex)?.[tile];if(!frame)return null;
    const base=rgb(skin),dye=rgb(color),source=frame.data,c=document.createElement('canvas');c.width=frame.w;c.height=frame.h;const ctx=c.getContext('2d'),out=ctx.createImageData(frame.w,frame.h),d=out.data,eye=frame.eye;
    for(let i=0;i<source.length;i+=4){if(!source[i+3])continue;const p=i/4,r=source[i],g=source[i+1],b=source[i+2],x=p%frame.w,y=Math.floor(p/frame.w);let col=[r,g,b];const inEye=x>eye.left-8&&x<eye.right+8&&y>eye.top-12&&y<eye.bottom+8;
      if(frame.faceMask[p]||frame.nearFace[p]&&r>140&&g>80&&b>90&&r>g+15&&g<b*1.08){const shade=(r*.22+g*.59+b*.19)/219,warmth=Math.max(0,(r-g-34)/78);col=base.map((v,k)=>clamp(Math.round(v*shade+(k===0?10:k===1?-15:-5)*warmth)));}
      else if(!inEye&&r>g*1.025&&g>b*.98&&r-g<117&&g-b<83&&r>24){const lum=r*.25+g*.59+b*.16,gain=lum/102,shine=Math.max(0,lum-160)*.38;col=dye.map(v=>clamp(Math.round(v*gain+shine)));}
      if(inEye&&(expression==='sparkle'||expression==='cat')&&(g>r+7||b>r+9)&&r<184&&g<190&&b<190){const iris=rgb(expression==='cat'?'#e2b654':'#73b9d4'),tone=clamp((r*.24+g*.61+b*.15)/120,.25,1.4);col=iris.map(v=>clamp(Math.round(v*tone)));}
      d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=source[i+3];
    }
    ctx.putImageData(out,0,0);const patch=preparePatch(frame,d),m=frame.geometry;
    const normal=source=>{const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=HEIGHT;const paint=canvas.getContext('2d');paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';paint.drawImage(source,m.x*12,m.y*12,frame.w*m.scale*12,frame.h*m.scale*12);return canvas.toDataURL('image/png');};
    const result={open:normal(c),patch:normal(patch),eye:[m.x+(eye.left+eye.right)/2*m.scale,m.y+(eye.top+eye.bottom)/2*m.scale],width:(eye.right-eye.left)*m.scale*.57};
    atlas.normalizationCount++;if(cache.size>=160)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  function metadata(svg){
    const head=svg.querySelector('.qpx-head'),av=JSON.parse(decodeURIComponent(head.dataset.qpxHead)),sex=av.sex==='m'?'m':'f';
    const names=hair[sex],shape=String(av.hair||'').split(':')[0],aliases=sex==='m'?{buzz:'crop',long:'wolf',longm:'wolf',wave:'curlm',afro:'curlm',mohawk:'spiky'}:{crop:'short',buzz:'short',longm:'long',wave:'long',afro:'curly',mohawk:'spiky'};
    const tile=Math.max(0,names.indexOf(names.includes(shape)?shape:aliases[shape]||shape));
    const image=head.querySelector('image[data-qpx-hair-color]');return {av,sex,tile,color:image?.dataset.qpxHairColor||'#68452e',skin:head.dataset.qpxHeadSkin||'#ffe2cc',expression:String(av.expression||'bright:0').split(':')[0]};
  }
  function headParts(r){
    if(!atlas.ready||r.painted)return;
    const m=metadata(r.svg),art=painting(m.sex,m.tile,m.color,m.skin,m.expression);if(!art)return;
    const image=()=>node('image',{href:art.open,x:0,y:0,width:32,height:40,preserveAspectRatio:'none'});
    r.front.append(image());r.back.append(image());r.anchors={eye:art.eye};
    r.front.dataset.qpxProfileEyeX=art.eye[0];r.front.dataset.qpxProfileEyeY=art.eye[1];
    for(const part of['half','closed']){const blink=node('g',{class:'qpx-blink-'+part,'data-qpx-profile-eye':part});
      const cover=node('g');cover.append(node('image',{href:art.patch,x:0,y:0,width:32,height:40,preserveAspectRatio:'none'}));
      if(part==='half'){const id=r.uid+'-half',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});clip.append(node('rect',{x:0,y:0,width:32,height:art.eye[1]+.3}));r.defs.append(clip);cover.setAttribute('clip-path','url(#'+id+')');}
      blink.append(cover);const [x,y]=art.eye,w=Math.max(1.1,art.width);blink.append(node('path',{d:'M'+(x-w)+' '+(y+.45)+'Q'+x+' '+(y+(part==='half'?1.1:m.expression==='happy'?-1:1.5))+' '+(x+w)+' '+(y+.45),fill:'none',stroke:'#493638','stroke-width':'.28','stroke-linecap':'round'}));if(m.expression==='wink'&&part==='closed')blink.style.setProperty('opacity','1','important');r.front.append(blink);
    }
    // The profile's hand-painted little mouth retains the nose/jaw silhouette.
    // Eye, brow and cheek changes express the selected face without stamping
    // a frontal mouth patch onto that much narrower painted profile surface.
    const [ex,ey]=art.eye;
    if(m.expression==='chic')r.front.append(node('path',{d:'M'+(ex-1.3)+' '+(ey-3.3)+'l2.1 -.5',fill:'none',stroke:'#493638','stroke-width':'.24','stroke-linecap':'round'}));
    if(m.expression==='freckle')for(const [dx,dy]of[[.7,2.5],[1.6,2.2],[2.5,2.6]])r.front.append(node('circle',{cx:ex+dx,cy:ey+dy,r:.15,fill:'#af765b'}));
    // One visible lens and an arm to the near ear; frontal double lenses would
    // cover the profile nose and place an extra eye on the back of the skull.
    if(!window.QPAvatarAccessoryDirection&&m.av.glass){const [x,y]=art.eye,w=Math.max(1.8,art.width*1.2),color=typeof PAL!=='undefined'?PAL[CAT.glass.pal]?.[+String(m.av.glass).split(':')[1]]?.[0]:'#795841';r.front.append(node('ellipse',{cx:x,cy:y,rx:w,ry:2.1,fill:'none',stroke:color||'#795841','stroke-width':'.25'}));r.front.append(node('path',{d:'M'+(x-w)+' '+y+'l-4 -1.5',fill:'none',stroke:color||'#795841','stroke-width':'.24'}));}
    if(!window.QPAvatarAccessoryDirection)for(const el of r.frontOriginals){
      const category=el.dataset.qpxHeadAccessory;if(!category||category==='glass')continue;
      const copy=el.cloneNode(true),transform=category==='hat'?'translate(16 0) scale(.82 1) translate(-16 0)':category==='ear'?'translate(9.2 -1.3)':'translate(21.4 0) scale(.62 1) translate(-16 0)';
      const near=node('g',{transform,'data-qpx-profile-accessory':category});
      if(category==='ear'){const id=r.uid+'-near-ear',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});clip.append(node('rect',{x:0,y:-8,width:16,height:56}));r.defs.append(clip);copy.setAttribute('clip-path','url(#'+id+')');}
      near.append(copy);r.front.append(near);
    }
    r.painted=true;r.svg.dataset.qpxProfileHair=hair[m.sex][m.tile];r.svg.dataset.qpxProfileEyeCount='1';window.QPAvatar.syncArtwork?.(r.svg);
  }
  function rearParts(r){
    if(!atlas.backReady||r.rearPainted)return;
    const m=metadata(r.svg),art=backPainting(m.sex,m.tile,m.color,m.skin);if(!art)return;
    r.rear.append(node('image',{href:art,x:0,y:0,width:32,height:40,preserveAspectRatio:'none','data-qpx-back-hair':hair[m.sex][m.tile]}));
    // A back view has no frontal facial jewelry, lenses or eye expressions.
    // Keep the wearer's hat and ear jewelry on the original attachment axes.
    if(!window.QPAvatarAccessoryDirection)for(const el of r.frontOriginals){const category=el.dataset.qpxHeadAccessory;if(!['hat','ear'].includes(category))continue;const copy=el.cloneNode(true);copy.dataset.qpxBackAccessory=category;r.rear.append(copy);}
    r.rearPainted=true;r.svg.dataset.qpxBackHair=hair[m.sex][m.tile];r.svg.dataset.qpxBackEyeCount='0';window.QPAvatar.syncArtwork?.(r.svg);
  }
  function prepareProfileWear(r){
    if(r.profileWear)return;
    const m=metadata(r.svg),art=window.QPAvatar;r.profileWear=[];
    if(!art?.renderProfileGarment)return;
    const add=(original,painting)=>{
      const layer=node('g',{'data-qpx-profile-painting':'true',style:'display:none'});layer.innerHTML=painting;
      original.parentNode.insertBefore(layer,original.nextSibling);
      r.profileWear.push({original,layer,visibility:original.getAttribute('visibility'),seatedClip:null});return layer;
    };
    // Each articulated thigh, shin and cloth hem owns its own cached painting.
    // The enclosing joint/cloth clips stay shared with the frontal artwork.
    const garments=[...r.pose.body.querySelectorAll('[data-qpx-clothes]')];
    for(const original of garments){
      const d=original.dataset;if(d.qpxProfileClothes||d.qpxProfileSleeve)continue;
      const part=r.pose.upper.contains(original)?'upper':r.pose.hem.contains(original)?'hem':r.pose.left.contains(original)?'left-leg':r.pose.right.contains(original)?'right-leg':'full';
      const layer=add(original,art.renderProfileGarment(d.qpxClothes,d.clothShape,d.clothColor,d.clothSex,d.clothSkin,{part}));
      for(const key of ['qpxClothes','clothShape','clothColor','clothSex','clothSkin'])if(d[key])layer.dataset[key]=d[key];
      layer.dataset.qpxProfileClothes='true';
      layer.dataset.qpxGarmentPart=part;
      const side=r.pose.left.contains(original)?'left':r.pose.right.contains(original)?'right':null;
      if(d.qpxClothes==='bottom'&&side&&!original.closest('[data-qpx-pose-part$="-shin"]')){
        const id=r.uid+'-side-seated-'+side,hip=side==='left'?13.75:18.25,w=r.pose.waist,k=r.pose.knee;
        if(!r.defs.querySelector('#'+id)){
          const clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
          // Only the thigh painting folds at the hip. The rigid waistband is
          // already on the torso; rotating its duplicate makes a rear flap.
          clip.append(node('path',{d:`M${hip-1.55} ${w-.5}Q${hip} ${w-1} ${hip+1.55} ${w-.5}L${hip+1.7} ${k-.25}Q${hip+1.75} ${k+1.35} ${hip} ${k+1.45}Q${hip-1.75} ${k+1.35} ${hip-1.7} ${k-.25}Z`}));r.defs.append(clip);
        }
        r.profileWear.at(-1).seatedClip='url(#'+id+')';layer.dataset.qpxProfileThigh=side;
      }
    }
    const coveredLegs=['jeans','track','legging','cargo'].includes(String(m.av.bottom||'').split(':')[0]);
    const skin=[...r.pose.body.querySelectorAll('.qpx-skin-torso,.qpx-leg-left,.qpx-leg-right')].filter(el=>!el.closest('[data-qpx-profile-painting]'));
    for(const original of skin){
      // The clothed pelvis belongs to the torso; its thighs belong to the leg
      // joints. A duplicate static skin thigh in the upper crop protrudes from
      // fitted trousers as a rectangular strip behind the profile waist.
      // Long trousers own the entire dressed leg silhouette. Repainting bare
      // skin under their narrower side view leaks angular skin panels when
      // knees fold. Shorts, skirts and an unselected bottom keep bare legs.
      const redundantLeg=!original.classList.contains('qpx-skin-torso')&&(coveredLegs||r.pose.upper.contains(original)&&Boolean(m.av.bottom));
      const painting=redundantLeg?'':original.classList.contains('qpx-skin-torso')?art.renderProfileTorso(m):art.renderProfileLeg(original.classList.contains('qpx-leg-left')?'left':'right',m.skin);
      add(original,painting);
    }
  }
  function profileWear(r,profile,floor=false){
    for(const {original,layer,visibility,seatedClip}of r.profileWear||[]){value(original,'visibility',profile?'hidden':visibility);layer.style.display=profile?'':'none';if(seatedClip)value(layer,'clip-path',profile&&floor?seatedClip:null);}
  }
  function prepareBackWear(r){
    if(r.backWear)return;const art=window.QPAvatar,m=metadata(r.svg);r.backWear=[];
    if(!art?.renderBackGarment)return;
    for(const entry of r.profileWear||[]){
      const original=entry.original,d=original.dataset,category=d.qpxClothes;
      if(!category&&!original.classList.contains('qpx-skin-torso'))continue;
      const layer=node('g',{'data-qpx-back-painting':'true',style:'display:none'});
      const part=r.pose.upper.contains(original)?'upper':r.pose.hem.contains(original)?'hem':r.pose.left.contains(original)?'left-leg':r.pose.right.contains(original)?'right-leg':'full';
      layer.innerHTML=category?art.renderBackGarment(category,d.clothShape,d.clothColor,d.clothSex,d.clothSkin,{part}):art.renderBackTorso(m);
      original.parentNode.insertBefore(layer,original.nextSibling);
      if(category){for(const key of ['qpxClothes','clothShape','clothColor','clothSex','clothSkin'])if(d[key])layer.dataset[key]=d[key];layer.dataset.qpxBackClothes='true';layer.dataset.qpxDirectionPart=category+'-back';layer.dataset.qpxGarmentPart=part;}
      r.backWear.push({original,layer,visibility:entry.visibility});
    }
  }
  function backWear(r,backView){
    for(const {original,layer,visibility}of r.backWear||[]){value(original,'visibility',backView?'hidden':visibility);layer.style.display=backView?'':'none';}
  }
  function prepareProfileFeet(r){
    if(!window.QPProfileShoes?.renderFoot)return;
    const m=metadata(r.svg),shape=String(m.av.shoes||'sneaker:0').split(':')[0];
    const shoeSource=r.svg.querySelector('[data-qpx-shoe-color]'),color=r.pose.rightFoot?.dataset.qpsFootColor||shoeSource?.dataset.qpxShoeColor||'#fff0da';
    r.profileFeet ||= [];
    for(const [side,foot]of[['left',r.pose.leftFoot],['right',r.pose.rightFoot]]){
      if(!foot)continue;const cached=r.profileFeet.find(item=>item.side===side);
      if(cached?.layer.parentNode===foot&&cached.original.parentNode)continue;
      if(cached){cached.layer.remove();cached.backLayer?.remove();r.profileFeet.splice(r.profileFeet.indexOf(cached),1);}
      const original=side==='left'?r.farShoe:foot.firstElementChild;if(!original)continue;
      const layer=node('g',{'data-qpx-profile-shoe':side,style:'display:none'});layer.innerHTML=window.QPProfileShoes.renderFoot(shape,color,side);foot.append(layer);
      const item={side,original,layer,visibility:original.getAttribute('visibility')};r.profileFeet.push(item);
      value(original,'visibility',r.profile?'hidden':item.visibility);layer.style.display=r.profile?'':'none';
    }
  }
  function prepareBackFeet(r){
    if(!window.QPProfileShoes?.renderBackFoot)return;
    for(const item of r.profileFeet||[]){
      const foot=item.side==='left'?r.pose.leftFoot:r.pose.rightFoot;if(item.backLayer?.parentNode===foot)continue;
      item.backLayer?.remove();const layer=node('g',{'data-qpx-back-shoe':item.side,style:'display:none'});
      layer.innerHTML=window.QPProfileShoes.renderBackFoot(foot.dataset.qpsShape,foot.dataset.qpsFootColor,item.side);foot.append(layer);item.backLayer=layer;
      value(item.original,'visibility',r.profile||r.backView?'hidden':item.visibility);layer.style.display=r.backView?'':'none';
    }
  }
  function profileFeet(r,profile,backView=false){
    for(const {original,layer,backLayer,visibility}of r.profileFeet||[]){value(original,'visibility',profile||backView&&backLayer?'hidden':visibility);layer.style.display=profile?'':'none';if(backLayer)backLayer.style.display=backView?'':'none';}
  }
  function prepare(svg,pose){
    if(rigs.has(svg)){
      const r=rigs.get(svg);
      // The original head/shoe modules may finish loading after the world was
      // mounted. Reattach just our layers after their in-place artwork refresh.
      if(r.front.parentNode!==r.pose.head){
        r.frontOriginals=[...r.pose.head.children];r.originalVisibility=r.frontOriginals.map(n=>n.getAttribute('visibility'));r.pose.head.append(r.front,r.rear);
        if(r.profile||r.backView)for(const n of r.frontOriginals)value(n,'visibility','hidden');
      }
      if(r.pose.leftFoot&&r.farShoe?.parentNode!==r.pose.leftFoot){
        r.farShoe=r.pose.leftFoot.firstElementChild?wrap(r.pose.leftFoot.firstElementChild,'far-shoe-toe'):null;
        if(r.farShoe&&r.profile&&!window.QPProfileShoes)value(r.farShoe,'transform','translate(27.5 0) scale(-1 1)');
      }
      prepareProfileFeet(r);prepareBackFeet(r);window.QPAvatarAccessoryDirection?.prepare(svg,pose);return r;
    }if(!pose)return null;
    const uid='qpdir-'+(++serial),defs=node('defs'),front=node('g',{'data-qpx-profile-head':'front',style:'display:none'}),back=node('g',{'data-qpx-profile-head':'back',class:'qpx-back-hair',style:'display:none'}),rear=node('g',{'data-qpx-back-head':'true',style:'display:none'});
    for(const[name,group,y,height]of[['front',front,-8,36.45],['back',back,28.2,27.8]]){const id=uid+'-'+name,clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});clip.append(node('rect',{x:-8,y,width:48,height}));defs.append(clip);group.setAttribute('clip-path','url(#'+id+')');}
    const frontOriginals=[...pose.head.children],originalVisibility=frontOriginals.map(n=>n.getAttribute('visibility'));
    pose.head.append(front,rear);pose.idle.insertBefore(back,pose.idle.firstChild);svg.insertBefore(defs,svg.firstChild);
    const body=wrap(pose.body,'body-profile'),left=wrap(pose.left,'far-leg'),right=wrap(pose.right,'near-leg'),leftFoot=pose.leftFoot?wrap(pose.leftFoot,'far-foot'):null,rightFoot=pose.rightFoot?wrap(pose.rightFoot,'near-foot'):null;
    // The entire original shoe is mirrored around its ankle, never cut apart.
    const farShoe=pose.leftFoot?.firstElementChild?wrap(pose.leftFoot.firstElementChild,'far-shoe-toe'):null;
    const r={svg,pose,uid,defs,front,back,rear,frontOriginals,originalVisibility,originalBackVisibility:pose.backHairPose?.getAttribute('visibility')??null,body,left,right,leftFoot,rightFoot,farShoe,originalBodyChildren:[...pose.body.children],profile:false,backView:false,turned:false,lastFacing:'right',painted:false,rearPainted:false};
    rigs.set(svg,r);if(!atlas.ready&&!atlas.error||!atlas.backReady&&!atlas.backError)mounted.add(r);headParts(r);rearParts(r);prepareProfileWear(r);prepareBackWear(r);prepareProfileFeet(r);prepareBackFeet(r);window.QPAvatarAccessoryDirection?.prepare(svg,pose);return r;
  }
  function orient(r,profile){
    if(r.profile===profile)return;r.profile=profile;
    r.frontOriginals.forEach((n,i)=>value(n,'visibility',profile?'hidden':r.originalVisibility[i]));r.front.style.display=profile?'':'none';r.back.style.display=profile?'':'none';
    if(r.pose.backHairPose)value(r.pose.backHairPose,'visibility',profile?'hidden':r.originalBackVisibility);
    value(r.body,'transform',null);profileWear(r,profile);profileFeet(r,profile);
    value(r.left,'transform',profile?'translate(2.1 0)':null);value(r.right,'transform',profile?'translate(-1.5 0)':null);
    if(r.leftFoot)value(r.leftFoot,'transform',profile?'translate(2.1 0)':null);if(r.rightFoot)value(r.rightFoot,'transform',profile?'translate(-1.5 0)':null);
    if(r.farShoe)value(r.farShoe,'transform',profile&&!window.QPProfileShoes?'translate(27.5 0) scale(-1 1)':null);
    if(profile)r.pose.body.replaceChildren(...[r.left,r.leftFoot,r.pose.upper,r.right,r.pose.hem,r.rightFoot].filter(Boolean));else r.pose.body.replaceChildren(...r.originalBodyChildren);
    r.svg.dataset.qpxView=profile?'profile':'front';
  }
  function orientBack(r,backView){
    if(r.backView===backView)return;r.backView=backView;backWear(r,backView);profileFeet(r,false,backView);
    r.frontOriginals.forEach((n,i)=>value(n,'visibility',backView?'hidden':r.originalVisibility[i]));
    r.rear.style.display=backView?'':'none';
    if(r.pose.backHairPose)value(r.pose.backHairPose,'visibility',backView?'hidden':r.originalBackVisibility);
    r.svg.dataset.qpxView=backView?'back':r.profile?'profile':'front';
    r.svg.dataset.qpxViewFacing=backView?'back':'front';
    r.svg.dataset.qpxBackEyeCount='0';
  }
  function apply(svg,state,pose){
    const r=prepare(svg,pose);if(!r)return false;headParts(r);rearParts(r);
    const wantsBack=state.direction==='back'&&!state.gesture;
    if(wantsBack){
      const ready=atlas.backReady&&r.rearPainted;orient(r,false);orientBack(r,ready);r.turned=false;
      r.svg.dataset.qpxViewFacing=ready?'back':'front';r.svg.dataset.qpxBackLoading=!ready&&!atlas.backError?'true':'false';
      window.QPAvatarAccessoryDirection?.apply(svg,{profile:false,facing:ready?'back':'front',backView:ready,state,anchors:r.anchors},pose);return false;
    }
    orientBack(r,false);
    const facing=['left','right'].includes(state.direction)?state.direction:['left','right'].includes(state.facing)?state.facing:r.lastFacing;
    const horizontal=state.action==='walk'||state.action==='jump'&&Math.abs(Number(state.vx)||0)>.001;
    if(['left','right'].includes(state.direction)||horizontal&&state.direction!=='front'&&['left','right'].includes(state.facing)){r.turned=true;r.lastFacing=facing;}if(state.direction==='front')r.turned=false;
    const profile=atlas.ready&&r.painted&&r.turned&&!state.gesture&&state.action!=='climb'&&state.direction!=='front';orient(r,profile);
    profileWear(r,profile,state.seatMode==='floor');
    if(profile){
      const near=state.seatMode==='floor'?-.4:-1.5;value(r.right,'transform','translate('+near+' 0)');if(r.rightFoot)value(r.rightFoot,'transform','translate('+near+' 0)');
      value(r.back,'transform',pose.headPose.getAttribute('transform'));r.svg.dataset.qpxViewFacing=facing;
    }else r.svg.dataset.qpxViewFacing='front';
    window.QPAvatarAccessoryDirection?.apply(svg,{profile,facing,backView:r.backView,state,anchors:r.anchors},pose);return profile;
  }
  function reset(svg){const r=rigs.get(svg);if(!r)return false;orientBack(r,false);orient(r,false);r.turned=false;r.lastFacing='right';value(r.back,'transform',null);window.QPAvatarAccessoryDirection?.reset(svg);return true;}
  function destroy(svg){const r=rigs.get(svg);if(!r)return false;reset(svg);window.QPAvatarAccessoryDirection?.destroy(svg);for(const {layer}of r.profileWear||[])layer.remove();for(const {layer}of r.backWear||[])layer.remove();for(const {layer,backLayer}of r.profileFeet||[]){layer.remove();backLayer?.remove();}for(const n of[r.left,r.right,r.leftFoot,r.rightFoot,r.farShoe,r.body])unwrap(n);r.front.remove();r.back.remove();r.rear.remove();r.defs.remove();for(const attr of['data-qpx-view','data-qpx-view-facing','data-qpx-profile-hair','data-qpx-profile-eye-count','data-qpx-back-hair','data-qpx-back-eye-count','data-qpx-back-loading'])svg.removeAttribute(attr);mounted.delete(r);rigs.delete(svg);return true;}
  window.QPAvatarDirection=Object.freeze({atlas,prepare,apply,reset,destroy});
  Promise.all([load('f'),load('m')]).then(()=>{atlas.ready=true;for(const r of mounted)if(r.svg.isConnected)headParts(r);if(atlas.backReady||atlas.backError)mounted.clear();window.dispatchEvent(new CustomEvent('qp-avatar-direction-ready'));}).catch(error=>{atlas.error=String(error?.message||error);if(atlas.backReady||atlas.backError)mounted.clear();window.dispatchEvent(new CustomEvent('qp-avatar-direction-error'));console.warn('옆모습 원화가 아직 준비되지 않아 정면 아바타를 유지합니다.',error);});
  Promise.all([loadBack('f'),loadBack('m')]).then(()=>{atlas.backReady=true;for(const r of mounted)if(r.svg.isConnected){rearParts(r);r.svg.dataset.qpxBackLoading='false';}if(atlas.ready||atlas.error)mounted.clear();window.dispatchEvent(new CustomEvent('qp-avatar-back-ready'));}).catch(error=>{atlas.backError=String(error?.message||error);if(atlas.ready||atlas.error)mounted.clear();window.dispatchEvent(new CustomEvent('qp-avatar-back-error'));console.warn('뒷모습 원화를 불러오지 못했어요.',error);});
})();
