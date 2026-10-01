/* Fine footwear paintings: neutral trim and gold wings retain their own colors. */
(function(){
  'use strict';
  const names=['sneaker','loafer','boots','sandal','hitop','ballet','rain','slipper','wing_shoes'];
  // Keep each painting's proportions after the full-body 1.35 vertical scale.
  const targets={sneaker:[11.6,41.555,8.8,4.495],loafer:[11.7,41.724,8.6,4.326],boots:[11.9,41.88,8.2,4.17],sandal:[11.7,41.261,8.6,4.789],hitop:[11.7,41.064,8.6,4.986],ballet:[11.8,41.223,8.4,4.827],rain:[11.8,40.814,8.4,5.236],slipper:[11.5,41.493,9,4.557],wing_shoes:[11,41.025,10,5.025]};
  const atlas={url:'assets/sd-shoes.png',ready:false,error:null,count:0};
  const sprites=new Map(),tints=new Map();let loading;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rgb=hex=>String(hex).match(/[a-f0-9]{2}/gi).slice(0,3).map(v=>parseInt(v,16));
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  function hsl(r,g,b){r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;let h=0;if(d)h=60*(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4);return [h,d?d/(1-Math.abs(2*l-1)):0,l];}
  function fromHsl(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return v.map(n=>Math.round(clamp((n+m)*255,0,255)));}
  const blue=(r,g,b,h,s)=>h>=195&&h<=270&&s>.09&&b>r*1.06;
  function extract(img,index){
    const sx=Math.floor(index%3*img.naturalWidth/3),sy=Math.floor(Math.floor(index/3)*img.naturalHeight/3),w=Math.floor((index%3+1)*img.naturalWidth/3)-sx,h=Math.floor((Math.floor(index/3)+1)*img.naturalHeight/3)-sy;
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
  function colorize(shape,color){
    const key=shape+'/'+color;if(tints.has(key))return tints.get(key);const sprite=sprites.get(shape);if(!sprite)return '';
    const [hue,sat,light]=hsl(...rgb(color)),data=new Uint8ClampedArray(sprite.data);
    for(let i=0;i<data.length;i+=4){if(data[i+3]<25)continue;const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);if(!blue(data[i],data[i+1],data[i+2],h,s))continue;const delta=l-sprite.light,out=fromHsl(hue,clamp(sat*(.78+.25*s),0,1),clamp(light+delta*(light<.25?.52:light>.82?.66:.85),.025,.985));data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];}
    const c=canvas(sprite.w,sprite.h);c.getContext('2d').putImageData(new ImageData(data,sprite.w,sprite.h),0,0);const url=c.toDataURL('image/png');if(tints.size>150)tints.clear();tints.set(key,url);return url;
  }
  function render(shape,color){shape=shape==='dress'?'loafer':shape;const sprite=sprites.get(shape);if(!sprite)return '';const [x,y,w,h]=targets[shape];return `<g class="qps-shoes" data-qps-shape="${shape}"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="none" overflow="hidden"><image href="${colorize(shape,color)}" width="${sprite.w}" height="${sprite.h}" style="image-rendering:auto"/></svg></g>`;}
  function inspect(shape){shape=shape==='dress'?'loafer':shape;const s=sprites.get(shape);return s?{width:s.w,height:s.h,opaquePixels:s.opaque,sourceRect:s.sourceRect.slice(),target:targets[shape].slice()}:null;}
  function load(){
    if(loading&&!atlas.error)return loading;atlas.ready=false;atlas.error=null;
    loading=(async()=>{try{
      const img=await window.QPAvatarImage.load(atlas.url);
      sprites.clear();tints.clear();names.forEach((shape,index)=>sprites.set(shape,extract(img,index)));
      atlas.width=img.naturalWidth;atlas.height=img.naturalHeight;atlas.count=sprites.size;atlas.ready=true;
      window.QPAvatar?.clearCache();document.querySelectorAll('[data-qpx-shoes]').forEach(node=>{node.innerHTML=render(node.dataset.qpxShoes,node.dataset.qpxShoeColor);});
      window.dispatchEvent(new CustomEvent('qp-shoes-ready'));return true;
    }catch(error){failed(error);return false;}})();return loading;
  }
  function failed(error){atlas.error=String(error.message||error);window.dispatchEvent(new CustomEvent('qp-shoes-error'));}
  window.QPShoes={render,inspect,atlas,names,targets,load,whenReady:()=>loading};load();
})();
