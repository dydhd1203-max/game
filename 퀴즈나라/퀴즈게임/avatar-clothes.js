/* Modular raster wardrobe. Coordinates are before the avatar's y=28 body stretch. */
(function(){
  'use strict';
  const names={
    top:['tee','hood','shirt','dress','vest','cardi','sailor','jacket','knit','tank','hanbok','robe','overall','space'],
    bottom:['shorts','jeans','skirt','pleat','track','legging','hanbok','tutu','cargo','jean_skirt','star_skirt']
  };
  const defaults={
    top:{url:'assets/pixel-tops-v3.png',columns:4,rows:4,names:names.top},
    bottom:{url:'assets/pixel-bottoms-v3.png',columns:4,rows:4,names:names.bottom}
  };
  const targets={
    top:{default:[8.5,28,15,9.5],tank:[11,28,10,9.5],dress:[8.5,28,15,14.5],robe:[8.5,28,15,14.5],overall:[8.5,28,15,14.5]},
    bottom:{default:[10.5,36,11,8.5],shorts:[10.5,36,11,5.5],skirt:[10.5,36,11,6.5],pleat:[10.5,36,11,6.5],jean_skirt:[10.5,36,11,6.5],star_skirt:[10.5,36,11,6.5],hanbok:[8.5,36,15,6.5],tutu:[9,36,14,6.5]}
  };
  const atlas={ready:false,revision:0,error:null,categories:{top:{ready:false},bottom:{ready:false}}};
  const sprites=new Map(),tinted=new Map(),markup=new Map();let generation=0,loading=Promise.resolve(false);
  let config={top:{...defaults.top},bottom:{...defaults.bottom}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function rgb(value){
    const s=String(value||'').trim(),hex=s.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);
    if(hex){const h=hex[1].length===3?hex[1].split('').map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
    const m=s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    return m?m.slice(1).map(v=>clamp(+v,0,255)):[119,174,192];
  }
  function hsl(r,g,b){
    r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
    let h=0;if(d)h=60*(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4);
    return [h,d?d/(1-Math.abs(2*l-1)):0,l];
  }
  function fromHsl(h,s,l){
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return v.map(n=>Math.round(clamp((n+m)*255,0,255)));
  }
  const hueDistance=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function image(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Clothes image could not load: '+url));img.src=url;});}
  function removeBackground(data,w,h,options){
    if(options.background===false)return;
    let transparent=false;for(let i=3;i<data.length;i+=4)if(data[i]<8){transparent=true;break;}
    if(transparent&&options.background!=='force')return;
    const explicit=options.backgroundColor&&rgb(options.backgroundColor),samples=[];
    for(const [x,y] of [[0,0],[w-1,0],[0,h-1],[w-1,h-1],[w>>1,0],[w>>1,h-1],[0,h>>1],[w-1,h>>1]]){
      const i=(y*w+x)*4;if(data[i+3]>20)samples.push([data[i],data[i+1],data[i+2]]);
    }
    const candidates=explicit?[explicit]:samples.filter(p=>{const [,s,l]=hsl(...p);return l>.65&&s<.16;});
    if(!candidates.length)return;
    const matches=p=>{
      const i=p*4;if(data[i+3]<8)return true;
      const v=[data[i],data[i+1],data[i+2]],[,s,l]=hsl(...v);
      return candidates.some(c=>Math.max(...v.map((n,j)=>Math.abs(n-c[j])))<=(options.backgroundTolerance||25))||(!explicit&&s<.09&&l>.78);
    };
    const visited=new Uint8Array(w*h),queue=new Uint32Array(w*h);let head=0,tail=0;
    const add=p=>{if(!visited[p]&&matches(p)){visited[p]=1;queue[tail++]=p;}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=1;y<h-1;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;data[p*4+3]=0;if(x)add(p-1);if(x<w-1)add(p+1);if(y)add(p-w);if(y<h-1)add(p+w);}
  }
  function dominantTint(data,options){
    const bins=new Float64Array(36);
    for(let i=0;i<data.length;i+=4){if(data[i+3]<80)continue;const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);if(s>.14&&l>.23&&l<.91)bins[Math.floor(h/10)%36]+=s;}
    const bin=bins.indexOf(Math.max(...bins)),hue=Number.isFinite(options.hue)?options.hue:bin*10+5,tolerance=options.hueTolerance||52;
    let total=0,sat=0,light=0;
    for(let i=0;i<data.length;i+=4){if(data[i+3]<80)continue;const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);if(s>.12&&l>.18&&l<.94&&hueDistance(h,hue)<=tolerance){total++;sat+=s;light+=l;}}
    return {hue,tolerance,saturation:total?sat/total:.25,lightness:total?light/total:.6,neutral:total===0};
  }
  function cleanCell(data,w,h){
    const labels=new Uint32Array(w*h),queue=new Uint32Array(w*h),parts=[];
    for(let p=0;p<labels.length;p++){
      if(labels[p]||data[p*4+3]<=12)continue;
      const label=parts.length+1,part={count:0,x0:w,y0:h,x1:-1,y1:-1};let head=0,tail=1;queue[0]=p;labels[p]=label;
      while(head<tail){
        const at=queue[head++],x=at%w,y=(at/w)|0;part.count++;part.x0=Math.min(part.x0,x);part.x1=Math.max(part.x1,x);part.y0=Math.min(part.y0,y);part.y1=Math.max(part.y1,y);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const xx=x+dx,yy=y+dy;if((!dx&&!dy)||xx<0||xx>=w||yy<0||yy>=h)continue;
          const next=yy*w+xx;if(!labels[next]&&data[next*4+3]>12){labels[next]=label;queue[tail++]=next;}
        }
      }parts.push(part);
    }
    if(!parts.length)return;
    const main=parts.reduce((a,b)=>a.count>b.count?a:b),mainLabel=parts.indexOf(main)+1,keep=parts.map(p=>p===main||p.count>=main.count*.08);
    // A neighboring cell's stray line may sit inside the garment's bounding box.
    // Keep small detached detail only when it touches the actual main silhouette.
    for(let p=0;p<labels.length;p++){
      const label=labels[p];if(!label||keep[label-1])continue;
      const x=p%w,y=(p/w)|0;
      for(let dy=-2;dy<=2&&!keep[label-1];dy++)for(let dx=-2;dx<=2;dx++){
        const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&labels[yy*w+xx]===mainLabel){keep[label-1]=true;break;}
      }
    }
    for(let p=0;p<labels.length;p++)if(!labels[p]||!keep[labels[p]-1])data[p*4+3]=0;
  }
  function extract(img,category,shape,index,options){
    const cols=options.columns||4,rows=options.rows||4,rect=options.cells&&options.cells[shape];
    const sx=rect?rect[0]:Math.floor(index%cols*img.naturalWidth/cols),sy=rect?rect[1]:Math.floor(Math.floor(index/cols)*img.naturalHeight/rows);
    const sw=rect?rect[2]:Math.floor((index%cols+1)*img.naturalWidth/cols)-sx,sh=rect?rect[3]:Math.floor((Math.floor(index/cols)+1)*img.naturalHeight/rows)-sy;
    if(sw<1||sh<1||sx<0||sy<0||sx+sw>img.naturalWidth||sy+sh>img.naturalHeight)throw new Error('Clothes cell is outside atlas: '+category+'/'+shape);
    const c=canvas(sw,sh),ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
    const pixels=ctx.getImageData(0,0,sw,sh),perShape={...options,...options.items?.[shape]};removeBackground(pixels.data,sw,sh,perShape);cleanCell(pixels.data,sw,sh);
    let x0=sw,y0=sh,x1=-1,y1=-1,opaque=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){if(pixels.data[(y*sw+x)*4+3]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);opaque++;}}
    if(!opaque)throw new Error('Clothes cell is empty: '+category+'/'+shape);
    ctx.putImageData(pixels,0,0);const w=x1-x0+1,h=y1-y0+1,crop=canvas(w,h),cc=crop.getContext('2d',{willReadFrequently:true});cc.imageSmoothingEnabled=false;cc.drawImage(c,x0,y0,w,h,0,0,w,h);
    const source=cc.getImageData(0,0,w,h),target=perShape.target||options.targets?.[shape]||targets[category][shape]||targets[category].default;
    return {category,shape,w,h,data:new Uint8ClampedArray(source.data),url:crop.toDataURL('image/png'),sourceRect:[sx+x0,sy+y0,w,h],target:target.slice(),opaque,tint:dominantTint(source.data,perShape),options:perShape};
  }
  function colorize(sprite,color,skin){
    const rgbColor=rgb(color),skinColor=rgb(skin),key=sprite.category+'/'+sprite.shape+'/'+rgbColor.join(',')+'/'+(sprite.options.skinColors?skinColor.join(','):'');
    if(tinted.has(key))return tinted.get(key);
    if(sprite.options.recolor===false)return sprite.url;
    const [th,ts,tl]=hsl(...rgbColor),data=new Uint8ClampedArray(sprite.data),tint=sprite.tint;
    const skinSources=(sprite.options.skinColors||[]).map(rgb);
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]<8)continue;const src=[data[i],data[i+1],data[i+2]],[h,s,l]=hsl(...src);
      const skinIndex=skinSources.findIndex(c=>Math.max(...src.map((n,j)=>Math.abs(n-c[j])))<14);
      if(skinIndex>=0){data[i]=skinColor[0];data[i+1]=skinColor[1];data[i+2]=skinColor[2];continue;}
      const tintable=tint.neutral?s<.1&&l>.42&&l<.95:s>.09&&l>.015&&l<.985&&hueDistance(h,tint.hue)<=tint.tolerance;
      if(!tintable)continue;
      const delta=l-tint.lightness,nl=clamp(tl+delta*(tl<.3?.48:tl>.8?.7:.85),.025,.98),ns=clamp(ts*(.82+.18*s/Math.max(.15,tint.saturation)),0,1),out=fromHsl(th,ns,nl);
      data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];
    }
    const c=canvas(sprite.w,sprite.h),ctx=c.getContext('2d');ctx.putImageData(new ImageData(data,sprite.w,sprite.h),0,0);
    const url=c.toDataURL('image/png');if(tinted.size>300)tinted.clear();tinted.set(key,url);return url;
  }
  function render(category,shape,color,sex='f',skin='#f7d1b5'){
    const sprite=sprites.get(category+'/'+shape);if(!sprite)return '';
    const key=[atlas.revision,category,shape,color,sex,skin].join('|');if(markup.has(key))return markup.get(key);
    const [x,y,w,h]=sprite.target,url=colorize(sprite,color,skin);
    const out=`<g class="qpc-garment qpc-${esc(category)}" data-qpc-category="${esc(category)}" data-qpc-shape="${esc(shape)}" data-qpc-sex="${sex==='m'?'m':'f'}"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="none" overflow="hidden"><image href="${url}" width="${sprite.w}" height="${sprite.h}" style="image-rendering:pixelated"/></svg></g>`;
    if(markup.size>500)markup.clear();markup.set(key,out);return out;
  }
  function inspect(category,shape){const s=sprites.get(category+'/'+shape);return s?{width:s.w,height:s.h,opaquePixels:s.opaque,sourceRect:s.sourceRect.slice(),target:s.target.slice(),tint:{...s.tint}}:null;}
  function load(next){
    if(next)for(const category of ['top','bottom'])if(next[category])config[category]={...config[category],...next[category]};
    const version=++generation;atlas.ready=false;atlas.error=null;tinted.clear();markup.clear();
    loading=(async()=>{
      const results=await Promise.allSettled(['top','bottom'].map(async category=>{
        const options=config[category];if(options.enabled===false)return;
        const img=await image(options.url),loaded=[];
        for(const [index,shape] of (options.names||names[category]).entries())loaded.push(extract(img,category,shape,index,options));
        if(version!==generation)return;
        for(const key of sprites.keys())if(key.startsWith(category+'/'))sprites.delete(key);
        loaded.forEach(s=>sprites.set(category+'/'+s.shape,s));
        atlas.categories[category]={ready:true,url:options.url,width:img.naturalWidth,height:img.naturalHeight,count:loaded.length};
      }));
      if(version!==generation)return false;
      const failed=results.filter(r=>r.status==='rejected');atlas.error=failed.map(r=>String(r.reason?.message||r.reason)).join('; ')||null;
      atlas.ready=!failed.length;atlas.revision++;tinted.clear();markup.clear();
      window.dispatchEvent(new CustomEvent(atlas.ready?'qp-clothes-ready':'qp-clothes-error',{detail:{revision:atlas.revision,error:atlas.error}}));return atlas.ready;
    })();return loading;
  }
  window.QPClothes={render,inspect,atlas,names,targets,load,configure:load,clearCache:()=>{tinted.clear();markup.clear();},whenReady:()=>loading};
  load(window.QP_CLOTHES_ATLAS||undefined);
})();
