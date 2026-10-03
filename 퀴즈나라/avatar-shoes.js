/* Fine footwear paintings: neutral trim and gold wings retain their own colors. */
(function(){
  'use strict';
  const names=['sneaker','loafer','boots','sandal','hitop','ballet','rain','slipper','wing_shoes'];
  // Keep each painting's proportions after the full-body 1.35 vertical scale.
  const targets={sneaker:[11.6,41.555,8.8,4.495],loafer:[11.7,41.724,8.6,4.326],boots:[11.9,41.88,8.2,4.17],sandal:[11.7,41.261,8.6,4.789],hitop:[11.7,41.064,8.6,4.986],ballet:[11.8,41.223,8.4,4.827],rain:[11.8,40.814,8.4,5.236],slipper:[11.5,41.493,9,4.557],wing_shoes:[11,41.025,10,5.025]};
  const atlas={url:'assets/sd-shoes.png',partsUrl:'assets/sd-shoes-parts.png',ready:false,partsReady:false,error:null,count:0};
  const sprites=new Map(),feet=new Map(),tints=new Map();let loading;
  let footHints=[{"rect":[60,38,257,231],"ankle":[224,82],"ground":[224,264]},{"rect":[374,36,280,226],"ankle":[457,77],"ground":[457,257]},{"rect":[722,43,245,230],"ankle":[875,90],"ground":[875,268]},{"rect":[62,282,277,229],"ankle":[139,339],"ground":[139,506]},{"rect":[412,287,245,237],"ankle":[558,317],"ground":[558,519]},{"rect":[752,287,234,236],"ankle":[842,317],"ground":[842,518]},{"rect":[61,514,240,235],"ankle":[211,559],"ground":[211,744]},{"rect":[424,527,238,222],"ankle":[503,565],"ground":[503,744]},{"rect":[740,524,243,233],"ankle":[899,556],"ground":[899,752]},{"rect":[65,749,254,246],"ankle":[151,780],"ground":[151,990]},{"rect":[401,759,247,237],"ankle":[572,827],"ground":[572,991]},{"rect":[740,761,254,230],"ankle":[819,825],"ground":[819,986]},{"rect":[57,997,238,257],"ankle":[211,1031],"ground":[211,1249]},{"rect":[434,997,238,254],"ankle":[524,1029],"ground":[524,1246]},{"rect":[724,1013,264,243],"ankle":[894,1075],"ground":[894,1251]},{"rect":[59,1263,281,240],"ankle":[148,1320],"ground":[148,1498]},{"rect":[406,1256,251,233],"ankle":[580,1296],"ground":[580,1484]},{"rect":[735,1256,260,234],"ankle":[812,1296],"ground":[812,1485]}];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rgb=hex=>String(hex).match(/[a-f0-9]{2}/gi).slice(0,3).map(v=>parseInt(v,16));
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  function hsl(r,g,b){r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;let h=0;if(d)h=60*(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4);return [h,d?d/(1-Math.abs(2*l-1)):0,l];}
  function fromHsl(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return v.map(n=>Math.round(clamp((n+m)*255,0,255)));}
  const blue=(r,g,b,h,s)=>h>=195&&h<=270&&s>.09&&b>r*1.06;
  function extract(img,index,columns=3,rows=3,rectHint){
    const sx=rectHint?rectHint[0]:Math.floor(index%columns*img.naturalWidth/columns),sy=rectHint?rectHint[1]:Math.floor(Math.floor(index/columns)*img.naturalHeight/rows),w=rectHint?rectHint[2]:Math.floor((index%columns+1)*img.naturalWidth/columns)-sx,h=rectHint?rectHint[3]:Math.floor((Math.floor(index/columns)+1)*img.naturalHeight/rows)-sy;
    const c=canvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(img,sx,sy,w,h,0,0,w,h);
    const pixels=ctx.getImageData(0,0,w,h),data=pixels.data,labels=new Uint32Array(w*h),queue=new Uint32Array(w*h),parts=[];
    // Discard tiny isolated fringe fragments; both separate shoes remain intact.
    for(let p=0;p<labels.length;p++){
      if(labels[p]||data[p*4+3]<25)continue;const label=parts.length+1;let head=0,tail=1,count=0;queue[0]=p;labels[p]=label;
      while(head<tail){const at=queue[head++],x=at%w,y=(at/w)|0;count++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if((!dx&&!dy)||xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;if(!labels[next]&&data[next*4+3]>=25){labels[next]=label;queue[tail++]=next;}}}parts.push(count);
    }
    const biggest=Math.max(...parts);let x0=w,y0=h,x1=-1,y1=-1,opaque=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!labels[p]||parts[labels[p]-1]<biggest*.015){data[p*4+3]=0;continue;}x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);opaque++;}
    if(!opaque)throw new Error('신발 원화가 비어 있어요: '+names[index]);ctx.putImageData(pixels,0,0);const cw=x1-x0+1,ch=y1-y0+1,crop=canvas(cw,ch),cc=crop.getContext('2d',{willReadFrequently:true});cc.drawImage(c,x0,y0,cw,ch,0,0,cw,ch);const d=cc.getImageData(0,0,cw,ch).data;
    let total=0,light=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<80)continue;const [hue,sat,l]=hsl(d[i],d[i+1],d[i+2]);if(blue(d[i],d[i+1],d[i+2],hue,sat)){total++;light+=l;}}
    return {w:cw,h:ch,data:new Uint8ClampedArray(d),light:total?light/total:.55,opaque,sourceRect:[sx+x0,sy+y0,cw,ch]};
  }
  // Original-sheet coordinates, measured per foot. These are interiors, not
  // generic rectangles: cream collars, laces, buckles and crossed straps stay.
  const mouths=[
    'M193 75Q229 45 251 53Q271 59 261 98Q253 109 238 104Q219 84 193 75Z',
    'M435 56Q456 43 500 79Q477 83 462 103Q432 116 430 88Q425 67 435 56Z',
    'M834 94Q878 53 899 58Q938 59 911 122L892 146Q876 111 834 104Z',
    'M115 304Q144 290 192 340L207 355Q171 348 152 386Q108 356 115 304Z',
    'M516 315Q558 299 597 313Q589 330 552 329Q530 328 516 315Z',
    'M802 311Q840 297 880 313Q865 332 829 327Q812 324 802 311Z',
    'M171 553Q217 522 260 537Q276 550 254 568Q208 590 178 574Z',
    'M466 554Q486 532 545 559L559 576Q537 598 485 578Q466 571 466 554Z',
    'M844 545Q885 532 932 544Q928 559 887 560Q857 557 844 545Z',
    'M114 774Q153 760 198 774Q195 788 155 787Q124 786 114 774Z',
    'M481 866Q522 818 570 781Q602 761 606 794Q611 832 569 887Q527 915 481 886Z',
    'M791 782Q813 769 856 814L914 866L909 891Q857 904 820 863Q790 828 791 782Z',
    'M142 1027Q198 1007 258 1023Q255 1042 199 1045Q156 1045 142 1027Z',
    'M470 1023Q530 1007 586 1026Q578 1046 524 1043Q482 1042 470 1023Z',
    'M852 1065Q904 1037 942 1070Q960 1092 937 1110Q923 1083 901 1084Q879 1085 866 1107Q846 1090 852 1065Z',
    'M106 1311Q129 1286 178 1303L207 1322Q186 1313 173 1323L153 1356Q138 1334 118 1339Q108 1326 106 1311Z',
    'M515 1326Q538 1288 576 1277Q617 1264 605 1307Q601 1326 584 1349Q552 1333 515 1326Z',
    'M792 1278Q816 1268 846 1291L883 1324Q861 1338 846 1352Q812 1342 796 1320Q784 1297 792 1278Z'
  ];
  function wearPixels(sprite,index){
    const c=canvas(sprite.w,sprite.h),ctx=c.getContext('2d');ctx.putImageData(new ImageData(sprite.data,sprite.w,sprite.h),0,0);
    const [sx,sy]=sprite.sourceRect,mask=canvas(sprite.w,sprite.h),mc=mask.getContext('2d');mc.translate(-sx,-sy);mc.fill(new Path2D(mouths[index]));
    const coverage=mc.getImageData(0,0,sprite.w,sprite.h).data,skinMask=canvas(sprite.w,sprite.h),sm=skinMask.getContext('2d'),alpha=new Uint8ClampedArray(sprite.data.length);
    // Ballet ribbons cross the opening; preserve their bright paint. Sandal
    // straps are separate from the exposed footbed, which has its own region.
    for(let i=0;i<alpha.length;i+=4){const d=sprite.data;let a=coverage[i+3];if(index===10||index===11){if(!(d[i]-d[i+1]>26&&d[i+1]-d[i+2]>20))a=0;}alpha[i]=alpha[i+1]=alpha[i+2]=255;alpha[i+3]=a;}
    sm.putImageData(new ImageData(alpha,sprite.w,sprite.h),0,0);
    if(index===6||index===7){
      const box=index===6?[89,571,271,714]:[452,580,642,714];
      for(let y=0;y<sprite.h;y++)for(let x=0;x<sprite.w;x++){const i=(y*sprite.w+x)*4,d=sprite.data;if(x+sx<box[0]||x+sx>box[2]||y+sy<box[1]||y+sy>box[3])continue;if(d[i+2]>d[i]*1.3&&d[i+2]>d[i+1]*1.1&&d[i+3]>80){alpha[i]=alpha[i+1]=alpha[i+2]=255;alpha[i+3]=255;}}
      sm.putImageData(new ImageData(alpha,sprite.w,sprite.h),0,0);
    }
    // Keep the foot artwork genuinely open; skin is a separate, owned layer.
    ctx.globalCompositeOperation='destination-out';ctx.drawImage(skinMask,0,0);
    sprite.skinMask=skinMask.toDataURL();sprite.openData=new Uint8ClampedArray(ctx.getImageData(0,0,c.width,c.height).data);
    // The rear collar passes BEHIND the leg. Only the calf's actual channel
    // is removed from the foreground copy; the full rear image is retained.
    const cx=sprite.hint.ankle[0],cy=sprite.hint.ankle[1],radius=sprite.w*.13;
    ctx.beginPath();ctx.moveTo(cx-radius,-10);ctx.lineTo(cx+radius,-10);ctx.lineTo(cx+radius,cy-2);ctx.quadraticCurveTo(cx,cy+sprite.h*.075,cx-radius,cy-2);ctx.closePath();ctx.fill();
    sprite.data=new Uint8ClampedArray(ctx.getImageData(0,0,c.width,c.height).data);
    // The rear layer contains ONLY the collar pixels removed from the front.
    // Duplicating the complete shoe would double its antialiased outer edge.
    sprite.rearData=new Uint8ClampedArray(sprite.openData);
    for(let i=3;i<sprite.data.length;i+=4){const front=sprite.data[i],original=sprite.openData[i];sprite.rearData[i]=front===255?0:Math.round((original-front)/(1-front/255));}
  }
  function colorize(shape,color,side,rear=false){
    const key=shape+'/'+color+'/'+(side||'pair')+'/'+rear;if(tints.has(key))return tints.get(key);const sprite=side?feet.get(shape+'/'+side):sprites.get(shape);if(!sprite)return '';
    const [hue,sat,light]=hsl(...rgb(color)),data=new Uint8ClampedArray(rear&&sprite.rearData||sprite.data);
    for(let i=0;i<data.length;i+=4){if(data[i+3]<25)continue;const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);if(!blue(data[i],data[i+1],data[i+2],h,s))continue;const delta=l-sprite.light,out=fromHsl(hue,clamp(sat*(.78+.25*s),0,1),clamp(light+delta*(light<.25?.52:light>.82?.66:.85),.025,.985));data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];}
    const c=canvas(sprite.w,sprite.h);c.getContext('2d').putImageData(new ImageData(data,sprite.w,sprite.h),0,0);const url=c.toDataURL('image/png');if(tints.size>150)tints.clear();tints.set(key,url);return url;
  }
  function footPlacement(shape,side){
    const sprite=feet.get(shape+'/'+side);if(!sprite)return null;
    const hint=sprite.hint||{},mouth=hint.ankle||[sprite.w*.5,sprite.h*.13],width=shape==='wing_shoes'?4:3.55,height=width*sprite.h/sprite.w/1.35;
    const floor=46.05,ankleX=side==='left'?13.85:18.15,x=ankleX-mouth[0]/sprite.w*width,y=floor-height*(sprite.h-1)/sprite.h;
    return {target:[x,y,width,height],ankle:[ankleX,y+mouth[1]/sprite.h*height],ground:[x+width*.5,floor],sourceRect:sprite.sourceRect.slice(),width:sprite.w,height:sprite.h,opaquePixels:sprite.opaque};
  }
  function renderFoot(shape,color,side,skin='#ffe2cc'){
    shape=shape==='dress'?'loafer':shape;side=side==='right'?'right':'left';const sprite=feet.get(shape+'/'+side),fit=footPlacement(shape,side);if(!sprite||!fit)return '';
    const [x,y,w,h]=fit.target,id='qps-skin-'+shape+'-'+side+'-'+skin.replace('#',''),tone=f=>'#'+rgb(skin).map(v=>Math.round(clamp(v*f,0,255)).toString(16).padStart(2,'0')).join('');
    // The anatomical ankle stays fixed at 44.55. The garment mouth may be
    // higher (boots) and is not used as a different bone for every item.
    return `<g class="qps-foot" data-qps-foot-side="${side}" data-qps-shape="${shape}" data-qps-foot-color="${color}" data-qps-skin="${skin}" data-qps-ankle="${fit.ankle.join(',')}" data-qps-joint="${side==='left'?13.75:18.25},44.55"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="none" overflow="visible"><defs><mask id="${id}" mask-type="alpha"><image href="${sprite.skinMask}" width="${sprite.w}" height="${sprite.h}"/></mask><linearGradient id="${id}-tone"><stop stop-color="${tone(.80)}"/><stop offset=".45" stop-color="${skin}"/><stop offset=".72" stop-color="${tone(1.07)}"/><stop offset="1" stop-color="${tone(.9)}"/></linearGradient></defs><rect data-qps-instep="true" width="${sprite.w}" height="${sprite.h}" fill="url(#${id}-tone)" mask="url(#${id})"/><image data-qps-front-rim="true" href="${colorize(shape,color,side)}" width="${sprite.w}" height="${sprite.h}" style="image-rendering:auto"/></svg></g>`;
  }

  function renderRearFoot(shape,color,side){
    const sprite=feet.get(shape+'/'+side),fit=footPlacement(shape,side);if(!sprite||!fit)return '';
    const [x,y,w,h]=fit.target;
    return `<svg data-qps-rear-rim="true" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="none" overflow="visible"><image href="${colorize(shape,color,side,true)}" width="${sprite.w}" height="${sprite.h}"/></svg>`;
  }
  function render(shape,color,skin){shape=shape==='dress'?'loafer':shape;if(atlas.partsReady)return `<g class="qps-shoes" data-qps-shape="${shape}">${renderFoot(shape,color,'left',skin)}${renderFoot(shape,color,'right',skin)}</g>`;const sprite=sprites.get(shape);if(!sprite)return '';const [x,y,w,h]=targets[shape];return `<g class="qps-shoes" data-qps-shape="${shape}"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="none" overflow="hidden"><image href="${colorize(shape,color)}" width="${sprite.w}" height="${sprite.h}" style="image-rendering:auto"/></svg></g>`;}
  function inspect(shape){shape=shape==='dress'?'loafer':shape;const s=sprites.get(shape);return s?{width:s.w,height:s.h,opaquePixels:s.opaque,sourceRect:s.sourceRect.slice(),target:targets[shape].slice(),feet:atlas.partsReady?{left:footPlacement(shape,'left'),right:footPlacement(shape,'right')}:null}:null;}
  async function loadParts(){
    const img=await window.QPAvatarImage.load(atlas.partsUrl);feet.clear();tints.clear();
    for(let index=0;index<18;index++){const hint=footHints[index],sprite=extract(img,index,3,6,hint?.rect),side=index%2?'right':'left';if(hint?.ankle)sprite.hint={ankle:[hint.ankle[0]-sprite.sourceRect[0],hint.ankle[1]-sprite.sourceRect[1]],ground:hint.ground?[hint.ground[0]-sprite.sourceRect[0],hint.ground[1]-sprite.sourceRect[1]]:null};wearPixels(sprite,index);feet.set(names[Math.floor(index/2)]+'/'+side,sprite);}
    atlas.partsReady=true;atlas.partsPixels=[img.naturalWidth,img.naturalHeight];atlas.partsCount=feet.size;window.QPAvatar?.clearCache();
    document.querySelectorAll('[data-qpx-shoes]').forEach(node=>{if(!node.closest('[data-qps-foot-host]'))node.innerHTML=render(node.dataset.qpxShoes,node.dataset.qpxShoeColor,node.dataset.qpsSkin);});
    document.querySelectorAll('[data-qps-foot-host]').forEach(node=>{
      const d=node.dataset;
      // Directional shoes are sibling paintings. Refresh only the original
      // front painting when its atlas finishes loading, keeping those layers.
      const profile=[...node.children].filter(child=>child.matches('[data-qpx-profile-shoe],[data-qpx-back-shoe],[data-qps-profile-foot],[data-qps-back-foot]'));
      node.innerHTML=renderFoot(d.qpsShape,d.qpsFootColor,d.qpsFootHost,d.qpsSkin);node.append(...profile);
    });
    document.querySelectorAll('.qps-foot[data-qps-foot-side]:not([data-qps-profile-foot]):not([data-qps-back-foot])').forEach(node=>{
      if(node.closest('[data-qpx-profile-shoe],[data-qpx-back-shoe]'))return;
      const d=node.dataset;node.outerHTML=renderFoot(d.qpsShape,d.qpsFootColor,d.qpsFootSide,d.qpsSkin);
    });
    window.dispatchEvent(new CustomEvent('qp-shoes-ready'));return true;
  }
  function load(){
    if(loading&&!atlas.error)return loading;atlas.ready=false;atlas.error=null;
    loading=(async()=>{try{
      const img=await window.QPAvatarImage.load(atlas.url);
      sprites.clear();tints.clear();names.forEach((shape,index)=>sprites.set(shape,extract(img,index)));
      atlas.width=img.naturalWidth;atlas.height=img.naturalHeight;atlas.count=sprites.size;await loadParts();atlas.ready=true;
      window.QPAvatar?.clearCache();document.querySelectorAll('[data-qpx-shoes]').forEach(node=>{if(!node.closest('[data-qps-foot-host]'))node.innerHTML=render(node.dataset.qpxShoes,node.dataset.qpxShoeColor,node.dataset.qpsSkin);});
      window.dispatchEvent(new CustomEvent('qp-shoes-ready'));return true;
    }catch(error){failed(error);return false;}})();return loading;
  }
  function failed(error){atlas.error=String(error.message||error);window.dispatchEvent(new CustomEvent('qp-shoes-error'));}
  window.QPShoes={render,renderFoot,renderRearFoot,inspect,atlas,names,targets,load,loadParts,setFootHints:value=>{footHints=value||[];},whenReady:()=>loading};load();
})();
