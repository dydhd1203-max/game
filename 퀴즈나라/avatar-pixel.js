/* Smooth illustrated paper dolls. The public API and 32 × 56 motion rig stay stable. */
(function(){
  'use strict';
  const INK='#493638',WHITE='#fff8f0';let SKIN='#ffe2cc',SKIN_SHADE='#dfac92',ACTIVE_SEX='f';
  const hairNames=['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'];
  const maleHairNames=['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf'];
  const aliases={crop:'short',buzz:'short',longm:'long',wave:'long',afro:'curly',mohawk:'spiky'};
  const atlas={hairUrl:'assets/sd-heads-female.png',maleUrl:'assets/sd-heads-male.png',headRect:[0,0,32,40],enabled:true,style:'illustrated',columns:4,rows:3};
  const HEAD_GRID=384,HEAD_HEIGHT=480,VIEW_H=56;
  atlas.styleOrder={f:hairNames.slice(),m:maleHairNames.slice()};atlas.headPixels=HEAD_GRID;atlas.normalizedSheetPixels=[HEAD_GRID*4,HEAD_GRID*3];
  const cache=new Map(),sourceHeads=new Map(),normalizedHeads=new Map(),eyeAnchors=new Map();
  const rgb=hex=>hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16));
  const clamp=(v,min=0,max=255)=>Math.max(min,Math.min(max,v));
  function skinFor(index){return typeof PAL!=='undefined'&&PAL.skin[index]?PAL.skin[index][0]:'#ffe2cc';}
  const eyesFor=(tile,sex=ACTIVE_SEX)=>eyeAnchors.get(sex)?.[tile]||[11.4,20.6,22];
  // Measured landmarks belong to the current original artwork (362px cells).
  const HEAD_HINTS={"f":[{"eyes":[[153.6,259.3],[215.6,256.9]],"chin":[184.6,297],"neck":[184.6,316],"apertures":[[137,237,173,271],[195,235,233,271]]},{"eyes":[[152.1,256.4],[212.4,255.9]],"chin":[182.2,294],"neck":[182.2,314],"apertures":[[136,235,172,269],[194,233,231,268]]},{"eyes":[[144.4,249.6],[204.8,247.0]],"chin":[174.6,289],"neck":[174.6,308],"apertures":[[127,227,163,261],[185,225,223,261]]},{"eyes":[[140.6,246.0],[197.8,245.4]],"chin":[169.2,283],"neck":[169.2,303],"apertures":[[125,226,160,258],[180,224,216,258]]},{"eyes":[[151.4,238.2],[212.1,237.4]],"chin":[181.8,277],"neck":[181.8,297],"apertures":[[135,217,171,251],[193,215,231,250]]},{"eyes":[[154.4,242.1],[214.5,240.5]],"chin":[184.4,281],"neck":[184.4,301],"apertures":[[137,221,174,254],[195,219,232,254]]},{"eyes":[[146.5,241.8],[206.3,242.0]],"chin":[176.4,281],"neck":[176.4,301],"apertures":[[129,222,166,254],[187,220,224,255]]},{"eyes":[[140.6,227.7],[197.7,229.5]],"chin":[169.1,267],"neck":[169.1,287],"apertures":[[123,208,159,241],[179,208,216,240]]},{"eyes":[[149.6,208.5],[213.5,206.4]],"chin":[181.6,250],"neck":[181.6,270],"apertures":[[131,188,170,221],[193,184,231,221]]},{"eyes":[[153.4,204.7],[216.7,205.3]],"chin":[185.1,246],"neck":[185.1,266],"apertures":[[137,185,174,219],[197,184,234,219]]},{"eyes":[[145.8,203.1],[208.9,204.0]],"chin":[177.4,243],"neck":[177.4,263],"apertures":[[129,182,166,216],[189,180,227,216]]},{"eyes":[[145.0,186.8],[205.4,185.7]],"chin":[175.2,226],"neck":[175.2,246],"apertures":[[128,166,164,199],[187,164,224,199]]}],"m":[{"eyes":[[160.0,284.2],[236.6,283.7]],"chin":[198.3,332],"neck":[198.3,352],"apertures":[[139,258,183,296],[214,261,257,296]]},{"eyes":[[153.9,286.3],[228.9,286.6]],"chin":[191.4,334],"neck":[191.4,355],"apertures":[[134,266,177,298],[210,264,250,299]]},{"eyes":[[139.0,286.5],[217.9,285.1]],"chin":[178.4,335],"neck":[178.4,355],"apertures":[[119,262,160,298],[195,262,240,298]]},{"eyes":[[130.2,285.2],[207.9,285.4]],"chin":[169.1,335],"neck":[169.1,355],"apertures":[[111,261,152,298],[186,263,229,298]]},{"eyes":[[158.6,263.5],[237.2,263.3]],"chin":[197.9,311],"neck":[197.9,331],"apertures":[[139,245,181,275],[215,240,258,275]]},{"eyes":[[151.6,264.6],[230.6,265.1]],"chin":[191.1,313],"neck":[191.1,333],"apertures":[[131,245,173,277],[208,247,252,277]]},{"eyes":[[140.1,265.0],[219.6,265.0]],"chin":[179.8,313],"neck":[179.8,333],"apertures":[[119,241,163,277],[197,242,241,277]]},{"eyes":[[133.7,264.7],[212.5,263.6]],"chin":[173.1,312],"neck":[173.1,332],"apertures":[[113,239,156,277],[190,237,234,275]]},{"eyes":[[158.6,216.1],[236.1,215.9]],"chin":[197.3,264],"neck":[197.3,284],"apertures":[[138,191,180,228],[214,191,257,228]]},{"eyes":[[153.7,216.2],[230.8,216.0]],"chin":[192.2,265],"neck":[192.2,285],"apertures":[[133,191,175,228],[209,192,253,228]]},{"eyes":[[140.4,217.7],[220.3,217.8]],"chin":[180.4,266],"neck":[180.4,286],"apertures":[[120,200,162,229],[198,195,242,229]]},{"eyes":[[132.4,215.0],[210.7,215.2]],"chin":[171.6,264],"neck":[171.6,285],"apertures":[[112,191,154,227],[189,196,232,227]]}]};
  const transparent='data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22/%3E';
  function inspectFace(data,hint){
    const size=HEAD_GRID,mask=new Uint8Array(size*size),faceMask=new Uint8Array(size*size);
    const warm=p=>{const i=p*4,r=data[i],g=data[i+1],b=data[i+2];return data[i+3]>24&&r>186&&g>122&&b>91&&r>g*1.025&&g>b*.94&&r-g<100&&g-b<81;};
    let minX=size,minY=size,maxX=0,maxY=0,count=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=y*size+x;if(data[p*4+3]<12)continue;count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x>size*.18&&x<size*.82&&y>size*.28&&y<size*.96&&warm(p))mask[p]=1;}
    if(count<size*size*.04)throw new Error('Missing illustrated head artwork');
    const seen=new Uint8Array(mask.length),components=[];
    for(let p=0;p<mask.length;p++)if(mask[p]&&!seen[p]){let sumX=0,sumY=0,left=size,top=size,right=0,bottom=0;const queue=[p];seen[p]=1;
      for(let n=0;n<queue.length;n++){const q=queue[n],x=q%size,y=Math.floor(q/size);sumX+=x;sumY+=y;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);for(const d of [-size,size,-1,1]){const next=q+d;if(next<0||next>=mask.length||d===-1&&x===0||d===1&&x===size-1||seen[next]||!mask[next])continue;seen[next]=1;queue.push(next);}}
      if(queue.length>size*size*.003)components.push({pixels:queue,left,top,right,bottom,cx:sumX/queue.length,cy:sumY/queue.length});
    }
    components.sort((a,b)=>b.pixels.length-a.pixels.length);
    const probe=[(hint.eyes[0][0]+hint.eyes[1][0])/2*size/362,(hint.eyes[0][1]+hint.eyes[1][1])/2*size/362+size*.043];
    for(const component of components){component.probeDistance=Infinity;for(const p of component.pixels)component.probeDistance=Math.min(component.probeDistance,(p%size-probe[0])**2+(Math.floor(p/size)-probe[1])**2);}
    components.sort((a,b)=>a.probeDistance-b.probeDistance);
    const face=components[0]||{pixels:[],left:size*.28,top:size*.43,right:size*.72,bottom:size*.84,cx:size*.5,cy:size*.65};
    for(const c of components)if(c===face||c.pixels.length<face.pixels.length*.38&&Math.abs(c.cy-face.cy)<size*.17)for(const p of c.pixels)faceMask[p]=1;
    // Preserve the full soft edge of the peach face and ears, including antialiased outlines.
    const nearFace=new Uint8Array(faceMask.length);
    for(let p=0;p<faceMask.length;p++)if(faceMask[p]){const x=p%size,y=Math.floor(p/size);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<size&&yy>=0&&yy<size)nearFace[yy*size+xx]=1;}}
    const skinFringe=new Uint8Array(faceMask.length);
    for(let p=0;p<faceMask.length;p++)if(faceMask[p]){const x=p%size,y=Math.floor(p/size);for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){if(dx*dx+dy*dy>64)continue;const xx=x+dx,yy=y+dy;if(xx<0||xx>=size||yy<0||yy>=size)continue;const q=yy*size+xx,i=q*4,r=data[i],g=data[i+1],b=data[i+2];if(data[i+3]>12&&r>140&&g>70&&b>70&&r>g+20&&g-b<Math.min(40,(r-g)*.34))skinFringe[q]=1;}}
    const featureMask=new Uint8Array(faceMask.length),fh=face.bottom-face.top,fw=face.right-face.left;
    // Landmark bounds protect painted lashes, irises and lips from hair dye.
    const eyes=hint.eyes.map(point=>{const x=point[0]*size/362,y=point[1]*size/362;return {x,y,left:x-size*.05,right:x+size*.05,top:y-size*.043,bottom:y+size*.038,aperture:hint.apertures?.[hint.eyes.indexOf(point)]?.map(v=>v*size/362)};});
    for(let p=0;p<featureMask.length;p++){
      const x=p%size,y=Math.floor(p/size),eye=eyes.find(e=>x>e.left-size*.019&&x<e.right+size*.019&&y>e.top-size*.026&&y<e.bottom+size*.018);
      const mouth=((x-face.cx)/(fw*.16))**2+((y-(face.bottom-fh*.15))/(fh*.13))**2<1;
      if(eye||mouth||nearFace[p])featureMask[p]=1;
    }
    return {face,faceMask,skinFringe,nearFace,featureMask,eyes,bounds:[minX,minY,maxX,maxY],count};
  }
  function prepareEyePatches(head){
    const size=HEAD_GRID,patches={},fringe=new Uint8Array(HEAD_GRID*HEAD_GRID),candidates=new Uint8Array(HEAD_GRID*HEAD_GRID),solid=new Uint8Array(HEAD_GRID*HEAD_GRID),queue=[];
    const hair=p=>{const i=p*4,r=head.data[i],g=head.data[i+1],b=head.data[i+2];return !head.faceMask[p]&&r>52&&g>30&&b>17&&r>g*1.32&&g>b*1.18&&r-g>18;};
    for(let p=0;p<candidates.length;p++)if(hair(p))candidates[p]=1;
    // The painted bangs form broad connected masses. Removing thin branches
    // before reconstructing their edges excludes isolated old lash antialiasing.
    for(let y=3;y<size-3;y++)for(let x=3;x<size-3;x++){const p=y*size+x;if(!candidates[p])continue;let inside=true;for(let dy=-3;dy<=3&&inside;dy++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dy*dy<=9&&!candidates[p+dy*size+dx]){inside=false;break;}if(inside)solid[p]=1;}
    const forehead=Math.min(...head.eyes.map(e=>e.y))-size*.13;
    for(let p=0;p<solid.length;p++)if(solid[p]&&Math.floor(p/size)<forehead){fringe[p]=1;queue.push(p);}
    for(let n=0;n<queue.length;n++){const p=queue[n],x=p%size,y=Math.floor(p/size);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=size||yy<0||yy>=size)continue;const next=yy*size+xx;if(!fringe[next]&&solid[next]){fringe[next]=1;queue.push(next);}}}
    const rebuilt=new Uint8Array(fringe);for(const p of queue){const x=p%size,y=Math.floor(p/size);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy;if(dx*dx+dy*dy>9||xx<0||xx>=size||yy<0||yy>=size)continue;const next=yy*size+xx;if(candidates[next])rebuilt[next]=1;}}fringe.set(rebuilt);
    for(let p=0;p<fringe.length;p++)if(fringe[p]&&!head.nearFace[p])head.featureMask[p]=0;
    const solve=(matrix,values)=>{const a=matrix.map((row,i)=>[...row,values[i]]);for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i]||1;for(let k=i;k<4;k++)a[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){const factor=a[j][i];for(let k=i;k<4;k++)a[j][k]-=factor*a[i][k];}}return a.map(row=>row[3]);};
    for(const [index,side]of[[0,'left'],[1,'right']]){
      const eye=head.eyes[index],cx=eye.x,cy=eye.y-size*.011,rx=size*.084,ry=size*.066;
      const px=Math.max(0,Math.floor(cx-rx-3)),py=Math.max(0,Math.floor(cy-ry-3)),pw=Math.min(size,Math.ceil(cx+rx+3))-px,ph=Math.min(size,Math.ceil(cy+ry+3))-py;
      const full=new Uint8ClampedArray(pw*ph*4),half=new Uint8ClampedArray(full.length),matrix=Array.from({length:3},()=>[0,0,0]),values=Array.from({length:3},()=>[0,0,0]);
      // Fit one continuous shaded skin surface from the surrounding painted
      // cheeks/forehead. A shared surface avoids per-pixel sampling seams.
      for(let y=Math.max(0,py-14);y<Math.min(size,py+ph+18);y+=2)for(let x=Math.max(0,px-14);x<Math.min(size,px+pw+14);x+=2){
        const p=y*size+x,i=p*4,dx=(x-cx)/rx,dy=(y-cy)/ry;
        if(!head.faceMask[p]||head.data[i+3]<240||head.eyes.some(e=>((x-e.x)/rx)**2+((y-e.y+size*.011)/ry)**2<1.12))continue;
        if(head.data[i]<215||head.data[i+1]<139||head.data[i+2]<111)continue;
        const weight=1/(1+dx*dx+dy*dy),v=[1,dx,dy];
        for(let j=0;j<3;j++){for(let k=0;k<3;k++)matrix[j][k]+=weight*v[j]*v[k];for(let c=0;c<3;c++)values[c][j]+=weight*v[j]*head.data[i+c];}
      }
      const coefficients=values.map(v=>solve(matrix,v));
      for(let y=py;y<py+ph;y++)for(let x=px;x<px+pw;x++){
        if(fringe[y*size+x])continue;
        const dx=(x-cx)/rx,dy=(y-cy)/ry,edge=(1-Math.sqrt(dx*dx+dy*dy))*Math.min(rx,ry),alpha=clamp(edge/2.5,0,1);if(!alpha)continue;
        const i=((y-py)*pw+x-px)*4;
        for(let c=0;c<3;c++)full[i+c]=clamp(Math.round(coefficients[c][0]+coefficients[c][1]*dx+coefficients[c][2]*dy));full[i+3]=Math.round(255*alpha);
        if(y<eye.y+.3*HEAD_GRID/32/head.geometry.scale){half[i]=full[i];half[i+1]=full[i+1];half[i+2]=full[i+2];half[i+3]=full[i+3];}
      }
      patches[side+'full']={data:full,x:px,y:py,w:pw,h:ph};patches[side+'half']={data:half,x:px,y:py,w:pw,h:ph};
    }
    head.eyePatches=patches;
  }
  function normalizedEyePatch(tile,skin,sex,side,part){
    const key=['eye',tile,skin,sex,side,part].join('/');if(normalizedHeads.has(key))return normalizedHeads.get(key);
    const head=sourceHeads.get(sex)?.[tile],patch=head?.eyePatches[side+part];if(!patch)return transparent;const source=patch.data;
    const base=rgb(skin),canvas=document.createElement('canvas');canvas.width=patch.w;canvas.height=patch.h;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(patch.w,patch.h),d=pixels.data;
    for(let i=0;i<source.length;i+=4){if(!source[i+3])continue;const r=source[i],g=source[i+1],b=source[i+2],warmth=Math.max(0,(r-g-34)/78),shade=(r*.22+g*.59+b*.19)/219;for(let c=0;c<3;c++)d[i+c]=clamp(Math.round(base[c]*shade+(c===0?10:c===1?-15:-5)*warmth));d[i+3]=source[i+3];}
    ctx.putImageData(pixels,0,0);
    const target=document.createElement('canvas');target.width=HEAD_GRID;target.height=HEAD_HEIGHT;const paint=target.getContext('2d');paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';const m=head.geometry;paint.drawImage(canvas,m.x+patch.x*m.scale,m.y+patch.y*m.scale,patch.w*m.scale,patch.h*m.scale);
    const url=target.toDataURL('image/png');if(normalizedHeads.size>=280)normalizedHeads.delete(normalizedHeads.keys().next().value);normalizedHeads.set(key,url);return url;
  }
  function tonal(color,luminance){const target=rgb(color),gain=luminance/102,shine=Math.max(0,luminance-160)*.38;return target.map(v=>clamp(Math.round(v*gain+shine)));}
  function normalizedHead(tile,color,skin,expression='bright',sex=ACTIVE_SEX){
    const key=[tile,color,skin,expression,sex].join('/');if(normalizedHeads.has(key))return normalizedHeads.get(key);
    const original=sourceHeads.get(sex)?.[tile]||sourceHeads.get('f')?.[tile];if(!original)return transparent;
    const canvas=document.createElement('canvas');canvas.width=HEAD_GRID;canvas.height=HEAD_HEIGHT;const ctx=canvas.getContext('2d');
    const recolored=document.createElement('canvas');recolored.width=HEAD_GRID;recolored.height=HEAD_GRID;const paint=recolored.getContext('2d'),out=paint.createImageData(HEAD_GRID,HEAD_GRID),d=out.data,source=original.data;
    const base=rgb(skin),iris=expression==='sparkle'?rgb('#73b9d4'):expression==='cat'?rgb('#e2b654'):null;
    for(let i=0;i<source.length;i+=4){const alpha=source[i+3];if(!alpha)continue;const p=i/4,r=source[i],g=source[i+1],b=source[i+2];let c=[r,g,b];
      if(original.faceMask[p]||original.skinFringe[p]||original.nearFace[p]&&r>140&&g>80&&b>90&&r>g+15&&g<b*1.08){
        // Multiplicative shading keeps soft brushwork; rose blush keeps its hue.
        const warmth=Math.max(0,(r-g-34)/78),shade=(r*.22+g*.59+b*.19)/219;
        c=base.map((v,k)=>clamp(Math.round(v*shade+(k===0?10:k===1?-15:-5)*warmth)));
      }else if(!original.featureMask[p]&&r>g*1.025&&g>b*.98&&r-g<117&&g-b<83&&r>24){c=tonal(color,r*.25+g*.59+b*.16);}
      if(iris){const x=p%HEAD_GRID,y=Math.floor(p/HEAD_GRID),inside=original.eyes.some(e=>x>e.left+1&&x<e.right-1&&y>e.top+(e.bottom-e.top)*.27&&y<e.bottom-1);if(inside&&(g>r+7||b>r+9)&&r<184&&g<190&&b<190){const tone=clamp((r*.24+g*.61+b*.15)/120,.25,1.4);c=iris.map(v=>clamp(Math.round(v*tone)));}}
      d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=alpha;
    }
    paint.putImageData(out,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const m=original.geometry;ctx.drawImage(recolored,m.x,m.y,HEAD_GRID*m.scale,HEAD_GRID*m.scale);
    const url=canvas.toDataURL('image/png');if(normalizedHeads.size>=280)normalizedHeads.delete(normalizedHeads.keys().next().value);normalizedHeads.set(key,url);return url;
  }
  async function loadSheet(sex,url){
    const image=await window.QPAvatarImage.load(url),frames=[],anchors=[],cw=image.naturalWidth/4,ch=image.naturalHeight/3;
    for(let tile=0;tile<12;tile++){
      const canvas=document.createElement('canvas');canvas.width=HEAD_GRID;canvas.height=HEAD_GRID;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,tile%4*cw,Math.floor(tile/4)*ch,cw,ch,0,0,HEAD_GRID,HEAD_GRID);
      const data=ctx.getImageData(0,0,HEAD_GRID,HEAD_GRID).data,stats=inspectFace(data,HEAD_HINTS[sex][tile]),[minX,minY,maxX,maxY]=stats.bounds;
      const hint=HEAD_HINTS[sex][tile],eyeMidX=(hint.eyes[0][0]+hint.eyes[1][0])/2*HEAD_GRID/362;
      // Asymmetric ponytails still need to fit on both sides of the centered
      // face; total-width containment alone can cut the longer hair mass.
      const scale=Math.min(18*HEAD_GRID/32/(stats.face.right-stats.face.left),15.35*HEAD_GRID/32/Math.max(1,eyeMidX-minX),15.35*HEAD_GRID/32/Math.max(1,maxX-eyeMidX));
      const x=HEAD_GRID/2-eyeMidX*scale,y=28*HEAD_GRID/32-hint.chin[1]*HEAD_GRID/362*scale;
      stats.data=data;stats.geometry={x,y,scale};prepareEyePatches(stats);frames.push(stats);anchors.push(stats.eyes.map(e=>(e.x*scale+x)*32/HEAD_GRID).concat([(stats.eyes[0].y*scale+stats.eyes[1].y*scale)/2+y].map(v=>v*32/HEAD_GRID)));
    }
    sourceHeads.set(sex,frames);eyeAnchors.set(sex,anchors);atlas.sourceDimensions=atlas.sourceDimensions||{};atlas.sourceDimensions[sex]=[image.naturalWidth,image.naturalHeight];atlas.sheetPixels=[image.naturalWidth,image.naturalHeight];atlas.spritePixels=atlas.spritePixels||{};atlas.spritePixels[sex]=frames.map(f=>f.count);atlas.facePixels=atlas.facePixels||{};atlas.facePixels[sex]=frames.map(f=>f.face.pixels.length);atlas.eyeAnchors=atlas.eyeAnchors||{};atlas.eyeAnchors[sex]=anchors;
  }
  const rect=(x,y,w,h,c,ex='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${ex}/>`;
  const pixel=(x,y,c)=>`<circle cx="${x+.5}" cy="${y+.5}" r=".5" fill="${c}"/>`;
  const dot=(x,y,c)=>rect(x,y,.5,.5,c);
  const stitch=(x,y,c)=>rect(x,y,.25,.25,c);
  const poly=(pts,c)=>`<path d="M${pts.map(p=>p.join(' ')).join('L')}Z" fill="${c}"/>`;
  function fineCorners(pts){const out=[];for(let i=0;i<pts.length;i++){const p=pts[i],prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+1)%pts.length],dx=p[0]-prev[0],dy=p[1]-prev[1],nx=next[0]-p[0],ny=next[1]-p[1];if((!dx&&!ny||!dy&&!nx)&&Math.abs(dx+dy)>=.5&&Math.abs(nx+ny)>=.5){const r=.125;out.push([p[0]-Math.sign(dx)*r,p[1]-Math.sign(dy)*r],[p[0]+Math.sign(nx)*r,p[1]+Math.sign(ny)*r]);}else out.push(p);}return out;}
  const contour=(pts,c,w=.125,edge=INK)=>`<path d="M${fineCorners(pts).map(p=>p.join(' ')).join('L')}Z" fill="${c}" stroke="${edge}" stroke-width="${w*2}" stroke-linejoin="round" paint-order="stroke fill"/>`;
  const thread=(x,y,w,h,c)=>rect(x,y,w,h,c);
  const shade=(c,n)=>sh(c,n);
  function item(cat,val){const [shape,i]=String(val||'').split(':');const c=CAT[cat];const col=c?(PAL[c.pal][+i]||PAL[c.pal][0])[0]:'#e6a6c5';return {shape,col,d:shade(col,-.25),l:shade(col,.33)};}
  function bitmap(rows,pal,x=0,y=0){let s='';rows.forEach((row,j)=>{let i=0;while(i<row.length){const ch=row[i],start=i;while(i<row.length&&row[i]===ch)i++;if(pal[ch])s+=rect(x+start,y+j,i-start,1,pal[ch]);}});return s;}
  const steppedOval=(x,y,w,h,c)=>`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${c}"/>`;
  const star=(x,y,c,size=1.2)=>`<path d="M${x} ${y-size}Q${x+size*.2} ${y-size*.2} ${x+size} ${y}Q${x+size*.2} ${y+size*.2} ${x} ${y+size}Q${x-size*.2} ${y+size*.2} ${x-size} ${y}Q${x-size*.2} ${y-size*.2} ${x} ${y-size}Z" fill="${c}"/>`;
  function bareBody(topValue){
    const shape=String(topValue||'').split(':')[0],tank=shape==='tank',edge=shade(SKIN,-.23),light=shade(SKIN,.09),shadow=shade(SKIN,-.1);
    const shoulder=tank?12.55:12.85;
    let s=`<g class="qpx-skin-torso"><path d="M14.65 26.6Q16 26.3 17.35 26.6L17.45 28.2Q19.15 28.65 ${32-shoulder} 29.75L19.05 33.2L19.1 36.8Q16 37.35 12.9 36.8L12.95 33.2L${shoulder} 29.75Q12.85 28.65 14.55 28.2Z" fill="${SKIN}" stroke="${edge}" stroke-width=".12"/><path d="M14.65 27.2Q16 27.8 17.35 27.2L17.45 28.2Q16 28.7 14.55 28.2Z" fill="${shadow}" opacity=".65"/><path d="M15.25 29Q17.1 28.8 17.85 30.05L17.75 35.8Q16.4 36.4 15.2 36Z" fill="${light}" opacity=".48"/></g>`;
    const leg=right=>`<g class="qpx-leg-${right?'right':'left'}"${right?' transform="translate(32 0) scale(-1 1)"':''}><path d="M12.8 36.5Q14.05 36.15 15.3 36.6L15.05 43.35Q15.85 44.9 14.55 45.15Q12.45 45.5 12.4 44L12.65 41.1Z" fill="${SKIN}" stroke="${edge}" stroke-width=".13"/><path d="M13.15 37.2Q12.85 41.3 13.05 43.85Q13.3 44.6 14.15 44.75Q12.65 45.2 12.7 44L12.9 41.1Z" fill="${shadow}"/><path d="M13.85 37.3Q14.75 37.1 14.7 39.1L14.45 43.8Q14.1 44.15 13.85 43.8Z" fill="${light}" opacity=".5"/></g>`;
    return s+leg(false)+leg(true);
  }
  function fittedArms(topValue,front=false){
    const shape=String(topValue||'').split(':')[0],fit=window.QPClothes?.fits?.[shape]||{cuffs:[[.2,.14],[.8,.14]],short:true,sleeveless:true};if(fit.covered)return '';
    const target=window.QPClothes?.targets?.top?.[shape]||window.QPClothes?.targets?.top?.default||[8.5,28,15,9.5],edge=shade(SKIN,-.24),shadow=shade(SKIN,-.1),light=shade(SKIN,.08);
    const side=right=>{
      const point=fit.cuffs[right?1:0],cx=target[0]+target[2]*point[0],cy=target[1]+target[3]*point[1];
      const localX=right?32-cx:cx,sleeveless=fit.sleeveless,rootX=sleeveless?12.7:localX,rootY=sleeveless?29.25:cy-.55;
      const wristX=sleeveless?10.95:fit.short?localX+.35:localX,wristY=sleeveless?36.45:fit.short?Math.max(cy+.9,36.45):cy+.4;
      const upper=sleeveless?`<path d="M13.2 28.8Q11.9 29.1 11.55 30.85Q11.2 33 11.05 34.5L${wristX-.47} ${wristY+.1}Q${wristX} ${wristY+.3} ${wristX+.48} ${wristY+.05}L12.35 32.3Q12.65 30.1 13.65 29.5Z" fill="${SKIN}" stroke="${edge}" stroke-width=".12"/><path d="M12.05 30.1Q11.65 31.9 11.4 34.1L${wristX-.22} ${wristY}" fill="none" stroke="${shadow}" stroke-width=".18" stroke-linecap="round"/>`:fit.short?`<path d="M${rootX-.58} ${rootY}Q${rootX-.5} ${cy+1.2} ${wristX-.43} ${wristY+.1}Q${wristX} ${wristY+.35} ${wristX+.47} ${wristY+.1}Q${rootX+.58} ${cy+1.1} ${rootX+.58} ${rootY}Z" fill="${SKIN}" stroke="${edge}" stroke-width=".11"/><path d="M${rootX-.4} ${cy}Q${rootX-.34} ${cy+1.2} ${wristX-.2} ${wristY+.05}" stroke="${shadow}" stroke-width=".16" fill="none" stroke-linecap="round"/>`:'';
      const hand=`<path d="M${wristX-.44} ${wristY-.3}Q${wristX} ${wristY-.48} ${wristX+.42} ${wristY-.3}L${wristX+.48} ${wristY+.42}Q${wristX+.53} ${wristY+.94} ${wristX+.1} ${wristY+1.06}Q${wristX-.49} ${wristY+1.12} ${wristX-.52} ${wristY+.58}Z" fill="${SKIN}" stroke="${edge}" stroke-width=".1"/><path d="M${wristX-.35} ${wristY+.13}Q${wristX-.4} ${wristY+.85} ${wristX+.06} ${wristY+.95}" stroke="${shadow}" stroke-width=".15" fill="none" stroke-linecap="round"/><path d="M${wristX+.08} ${wristY+.2}L${wristX+.17} ${wristY+.58}" stroke="${light}" stroke-width=".16" stroke-linecap="round"/>`;
      const actualX=right?32-wristX:wristX,mirror=right?' transform="translate(32 0) scale(-1 1)"':'';
      const cut=sleeveless?32.2:shape==='dress'?35:cy+.22;
      const paint=front?`<svg x="0" y="${cut}" width="32" height="${56-cut}" viewBox="0 ${cut} 32 ${56-cut}" overflow="hidden"><g${mirror}>${upper}</g></svg><g class="qpx-hand-${right?'right':'left'}" data-qpx-wrist="${actualX},${wristY}" data-qpx-wrist-x="${actualX}" data-qpx-wrist-y="${wristY}" style="transform-box:view-box;transform-origin:${actualX}px ${wristY}px"><g${mirror}>${hand}</g></g>`:`<g${mirror}>${upper}</g>`;
      return `<g class="qpx-arm-${front?'front-':''}${right?'right':'left'}" data-qpx-arm-side="${right?'right':'left'}" data-qpx-cuff="${cx},${cy}" style="transform-box:view-box;transform-origin:${cx}px ${cy}px;--qpx-arm-direction:${right?1:-1}">${paint}</g>`;
    };
    return `<g class="qpx-arms${front?' qpx-arms-front':''}">${side(false)}${side(true)}</g>`;
  }
  function sleeve(c,d,l,long,right=false,wide=false){
    const end=long?37:33.5;
    const p=wide?[[12.5,28.5],[11,28.5],[11,29],[10,29],[10,30],[9,30],[9,31.5],[8.5,31.5],[8.5,35],[10.5,35],[10.5,34.5],[11,34.5],[11,32],[11.5,32],[11.5,30.5],[12.5,30.5]]:[[12.5,28.5],[11,28.5],[11,29],[10,29],[10,29.5],[9.5,29.5],[9.5,30.5],[9,30.5],[9,32],[8.5,32],[8.5,33.5],[9,33.5],[9,35],[9.5,35],[9.5,end],[12,end],[12,end-1],[11.5,end-1],[11.5,34],[11,34],[11,32],[11.5,32],[11.5,30.5],[12.5,30.5]];
    let a=contour(p.map(([x,y])=>[right?32-x:x,y]),c);
    const q=wide?[[11,29.5],[10.5,29.5],[10.5,30.5],[9.5,30.5],[9.5,32],[9,32],[9,34.5],[10,34.5],[10,34],[10.5,34],[10.5,32],[11,32],[11,30.5],[12,30.5],[12,29.5]]:[[11,29.5],[10.5,29.5],[10.5,30],[10,30],[10,31],[9.5,31],[9.5,32.5],[9,32.5],[9,33.5],[9.5,33.5],[9.5,35],[10,35],[10,end-.5],[11.5,end-.5],[11.5,end-1],[11,end-1],[11,34],[10.5,34],[10.5,32],[11,32],[11,30.5],[12,30.5],[12,29.5]];
    a+=poly(q.map(([x,y])=>[right?32-x:x,y]),c)+rect(right?21:10.5,long?35.5:32.5,.25,1,d)+rect(right?22:9.5,31,.25,2,l);
    a+=thread(right?22.25:9.375,32.25,.125,1,shade(c,.14))+thread(right?21.625:10.25,34.25,.125,.875,shade(c,-.1))+thread(right?21.625:10.25,34.125,.625,.125,shade(c,-.08));
    if(long)a+=rect(right?20.5:10,end-1,1.5,.25,d)+thread(right?20.5:10,end-.5,1.5,.125,l);return a;
  }
  function skirtArt(c,d,l,wide=false){const w=wide?2:0;
    let a=contour([[12.5,36],[19.5,36],[19.5,37],[20,37],[20,38],[20.5,38],[20.5,39],[21,39],[21,40],[21.5+w,40],[21.5+w,42],[21+w,42],[21+w,42.5],[11-w,42.5],[11-w,42],[10.5-w,42],[10.5-w,40],[11,40],[11,39],[11.5,39],[11.5,38],[12,38],[12,37],[12.5,37]],c);
    a+=poly([[13,36.5],[19,36.5],[19,37.5],[19.5,37.5],[19.5,38.5],[20,38.5],[20,39.5],[20.5,39.5],[20.5,40.5],[21+w,40.5],[21+w,41.5],[20.5+w,41.5],[20.5+w,42],[11.5-w,42],[11.5-w,41.5],[11-w,41.5],[11-w,40.5],[11.5,40.5],[11.5,39.5],[12,39.5],[12,38.5],[12.5,38.5],[12.5,37.5],[13,37.5]],c);
    a+=rect(13,36.5,6,.5,d)+rect(12.5,38,.5,2.5,l)+rect(13,40.5,.5,1,d)+rect(15.5,38,.5,3.5,l)+rect(18.5,38,.5,3,d)+rect(11.5-w,41.5,9+2*w,.5,l)+rect(12-w,42,8+2*w,.5,d);
    a+=rect(12.25,41.75,7.5,.25,shade(c,.2))+rect(13.25,38.5,.25,1.5,shade(c,-.1))+rect(15.25,39,.25,2.25,shade(c,.2))+rect(18.25,39.5,.25,1.5,shade(c,-.12));
    for(let x=12.5;x<20;x+=.75)a+=stitch(x,41.75,shade(c,-.08));return a;
  }
  function garment(category,val,fallback){if(!val)return '';const {shape,col}=item(category,val),raster=window.QPClothes&&window.QPClothes.render(category,shape,col,ACTIVE_SEX,SKIN);return `<g data-qpx-clothes="${category}" data-cloth-shape="${shape}" data-cloth-color="${col}" data-cloth-sex="${ACTIVE_SEX}" data-cloth-skin="${SKIN}">${raster||fallback(val)}</g>`;}
  function top(val){return garment('top',val,topVector);}
  function bottom(val){return garment('bottom',val,bottomVector);}
  function effect(val){if(!val)return '';return `<g data-qpx-effect="${String(val).replace(/[^a-z0-9:]/gi,'')}">${window.QPEffects?window.QPEffects.render(val):''}</g>`;}
  function topVector(val){if(!val)return '';const {shape:s,col:c,d,l}=item('top',val);const long=!['tee','tank','dress','overall'].includes(s);let a='';
    if(!['tank','overall'].includes(s)){const sc=['vest','sailor','jacket'].includes(s)?WHITE:c;a+=sleeve(sc,shade(sc,-.2),shade(sc,.18),long,false,['robe','hanbok'].includes(s))+sleeve(sc,shade(sc,-.2),shade(sc,.18),long,true,['robe','hanbok'].includes(s));}
    a+=contour([[12.5,28],[19.5,28],[19.5,28.5],[20.5,28.5],[20.5,29.5],[21,29.5],[21,31.5],[20.5,31.5],[20.5,34],[20,34],[20,36],[20.5,36],[20.5,37.5],[20,37.5],[20,38],[12,38],[12,37.5],[11.5,37.5],[11.5,36],[12,36],[12,34],[11.5,34],[11.5,31.5],[11,31.5],[11,29.5],[11.5,29.5],[11.5,28.5],[12.5,28.5]],c);
    a+=poly([[13,28.5],[14,28.5],[14,29],[18,29],[18,28.5],[19,28.5],[19,29],[20,29],[20,31.5],[19.5,31.5],[19.5,34.5],[19,34.5],[19,36],[20,36],[20,37],[19.5,37.5],[12.5,37.5],[12,37],[12,36],[13,36],[13,34.5],[12.5,34.5],[12.5,31.5],[12,31.5],[12,29],[13,29]],c);
    a+=rect(12.5,31,.25,2.5,l)+stitch(13,33.5,l)+rect(19,32,.25,2,d)+stitch(18.5,34,d)+rect(13,37,6,.25,d)+rect(13.5,36.5,4.5,.25,l);
    if(s==='hood'){a+=poly([[13,28],[19,28],[19,28.5],[18.5,28.5],[18.5,29],[17.5,29],[17.5,29.5],[14.5,29.5],[14.5,29],[13.5,29],[13.5,28.5],[13,28.5]],d)+rect(14,29.5,.25,3,WHITE)+rect(18.25,29.5,.25,3,WHITE)+rect(13.75,32.5,.5,.25,l)+rect(18.25,32.5,.5,.25,l);a+=poly([[14,34],[18.5,34],[18.5,34.5],[19,34.5],[19,36],[18.5,36],[18.5,36.5],[14,36.5],[14,36],[13.5,36],[13.5,34.5],[14,34.5]],l)+rect(14,34,.25,1.5,d)+rect(18.5,34.5,.25,1,d)+rect(14.5,36,3,.25,c)+rect(14.5,34.25,3.5,.25,shade(c,.42))+rect(14.25,34.75,.25,1.25,shade(c,.12))+rect(18.25,34.75,.25,.75,shade(c,-.12));for(let x=14.75;x<18.5;x+=.75)a+=stitch(x,36.25,shade(c,-.08));}
    if(s==='shirt'){a+=poly([[13,28.5],[14.5,28.5],[16,30],[14.5,31],[13.5,30],[13,30]],l)+poly([[17.5,28.5],[19,28.5],[19,30],[18.5,30],[17.5,31],[16,30]],l)+rect(16,30,.5,7,d);for(let y=31;y<37;y+=1.5)a+=dot(16,y,WHITE);a+=rect(18,31.5,1.5,.5,d)+rect(18,32,1.5,1,c)+rect(18.5,32.5,.5,.5,l);}
    if(s==='dress'||s==='robe'){a+=skirtArt(c,d,l,s==='robe');a+=rect(12.5,35.5,7,.5,d);if(s==='dress')a+=bitmap(['ll.ll','lllll','.ddd.'],{l,d},14,34);else a+=star(16,39,'#ffe2a0');}
    if(s==='cardi'||s==='vest'){a+=poly([[15,29],[17.5,29],[17.5,37.5],[15,37.5]],WHITE)+rect(14.5,30,.5,7,d)+rect(17.5,30,.5,7,d)+dot(14.5,31,l)+dot(14.5,33,l)+dot(14.5,35,l)+rect(12.5,34,1.5,.5,d)+rect(18.5,34,1,.5,d);}
    if(s==='sailor'){a+=poly([[13,29],[14.5,29],[14.5,30],[16,31.5],[17.5,30],[17.5,29],[19,29],[19,31],[18.5,31],[18.5,32],[18,32],[18,32.5],[17.5,32.5],[16,31.5],[14.5,32.5],[14,32.5],[14,32],[13.5,32],[13.5,31],[13,31]],c)+rect(14,30,.5,1.5,WHITE)+rect(18,30,.5,1.5,WHITE)+bitmap(['r.r','rrr','.r.','.r.'],{r:'#cb6173'},15,31.5);}
    if(s==='jacket'){a+=rect(16,29,.5,8,d)+rect(17.5,31,2,.5,WHITE)+rect(17.5,31.5,.5,2,WHITE)+rect(17.5,33,1.5,.5,WHITE)+dot(15,31,l)+dot(15,33,l)+dot(15,35,l)+rect(12.5,35,1.5,.5,d);}
    if(s==='knit'){for(let y=30.5;y<36.5;y+=.75){for(let x=13.5;x<19;x+=.75)a+=thread(x,y,.125,.25,shade(c,-.12))+thread(x+.125,y+.25,.25,.125,shade(c,-.12))+thread(x+.375,y,.125,.25,shade(c,.18));}a+=rect(13.5,28.5,5,.25,d);}
    if(s==='tank')a+=rect(12.5,29,1,2.5,c)+rect(19,29,1,2.5,c)+rect(13,29,.5,2,l)+rect(19,29,.5,2,l);
    if(s==='overall')a+=rect(13.5,28.5,1,4,c)+rect(18,28.5,1,4,c)+rect(13.5,31.5,5.5,5,c)+rect(15,33,2.5,1.5,l)+dot(14,31,'#ffe0a0')+dot(18.5,31,'#ffe0a0');
    if(s==='hanbok')a+=poly([[13,28.5],[14,28.5],[16.5,32],[18.5,28.5],[19,29],[17,33],[16,33],[13,29]],WHITE)+rect(16,32,1,1,'#cd5d74')+poly([[16,33],[17,33],[17,34],[16.5,34],[16.5,35],[16,35],[16,36],[15,36],[15,35],[15.5,35],[15.5,34],[16,34]],'#cd5d74')+rect(16.5,33,1,2,'#df86a0');
    if(s==='space')a+=rect(13.5,28.5,5,.5,'#c6c4d7')+poly([[15,31],[18,31],[18,31.5],[18.5,31.5],[18.5,34],[18,34],[18,34.5],[15,34.5],[15,34],[14.5,34],[14.5,31.5],[15,31.5]],'#82b7d3')+rect(15.5,31.5,2,2,'#d5eff0')+dot(15.5,31.5,WHITE)+rect(13,36.5,6,.5,'#c6c4d7')+dot(14,36.5,'#e88aa5')+dot(16,36.5,'#bad599')+dot(18,36.5,'#91b7db');
    a+=rect(12.75,31.5,.125,1.75,shade(c,.16))+rect(19.25,32,.125,1.5,shade(c,-.12))+thread(13.125,33.5,.625,.125,shade(c,-.1))+thread(13.5,33.625,.375,.125,shade(c,-.1))+thread(18.375,34.25,.75,.125,shade(c,-.12))+rect(13.25,37.25,5.5,.125,shade(c,-.12));
    for(let x=13.5;x<19;x+=.625)a+=thread(x,37.25,.25,.125,l);return a;
  }
  function bottomVector(val){if(!val)return '';const {shape:s,col:c,d,l}=item('bottom',val);const skirt=['skirt','pleat','jean_skirt','star_skirt','tutu','hanbok'].includes(s);let a='';
    if(skirt){a=skirtArt(c,d,l,s==='hanbok'||s==='tutu');if(s==='pleat'||s==='hanbok'){for(let x=13.5;x<20;x+=2)a+=rect(x,38,.5,3.5,d)+rect(x+.5,39,.5,2,l);}if(s==='star_skirt')a+=star(13.5,39.5,WHITE)+dot(19.5,40.5,WHITE);if(s==='tutu')a+=rect(10,39.5,1.5,.5,l)+rect(11,40.5,2,.5,l)+rect(19,40.5,2,.5,l)+rect(20.5,39.5,1.5,.5,l);if(s==='jean_skirt')a+=rect(16,37.5,.5,4,d)+dot(13.5,37,'#e2c28e');}
    else{const end=s==='shorts'?41:44.5;
      a+=contour([[12.5,36.5],[19.5,36.5],[19.5,36.75],[19.75,36.75],[19.75,37],[20,37],[20,39],[19.75,39],[19.75,39.25],[19.5,39.25],[19.5,end-.25],[19.25,end-.25],[19.25,end],[16.75,end],[16.75,end-.25],[16.5,end-.25],[16.5,40],[16.25,40],[16.25,39.75],[15.75,39.75],[15.75,40],[15.5,40],[15.5,end-.25],[15.25,end-.25],[15.25,end],[12.75,end],[12.75,end-.25],[12.5,end-.25],[12.5,39.25],[12.25,39.25],[12.25,39],[12,39],[12,37],[12.25,37],[12.25,36.75],[12.5,36.75]],c);
      a+=rect(12.5,37,7,.25,d)+rect(13,39,.25,end-39-.25,l)+rect(18.75,39,.25,end-39-.25,d)+stitch(16,37.5,'#dfc792');
      a+=thread(16,37.75,.125,1.875,d)+thread(13.25,38,1,.125,shade(c,-.12))+thread(13,38.125,.25,.125,shade(c,-.12))+thread(13,38.25,.125,.625,shade(c,-.12))+thread(17.75,38,1,.125,shade(c,-.12))+thread(18.75,38.125,.25,.125,shade(c,-.12))+thread(18.875,38.25,.125,.625,shade(c,-.12));
      for(const x of [13.25,17.25])a+=thread(x,40.75,1.25,.125,shade(c,-.08))+thread(x+.25,40.875,.75,.125,shade(c,-.08))+thread(x,end-.375,2,.125,shade(c,-.12));
      for(let x=13;x<19.25;x+=.75)a+=thread(x,37.125,.25,.125,l);
      if(s==='track')a+=rect(13,39,.25,4.5,WHITE)+rect(18.75,39,.25,4.5,WHITE);
      if(s==='cargo')a+=contour([[12.5,40],[14,40],[14,41.5],[12.5,41.5]],shade(c,-.08),.0625,shade(c,-.3))+contour([[18,40],[19.5,40],[19.5,41.5],[18,41.5]],shade(c,-.08),.0625,shade(c,-.3))+rect(12.5,40,1.5,.125,l)+rect(18,40,1.5,.125,l);
      if(s==='legging')a+=rect(14.75,39,.125,4.5,d)+rect(17.125,39,.125,4.5,d);
    }
    return a;
  }
  function shoes(val){if(!val)return '';const {shape:s,col:c,d,l}=item('shoes',val),raster=window.QPShoes&&window.QPShoes.render(s,c);if(raster)return `<g data-qpx-shoes="${s}" data-qpx-shoe-color="${c}">${raster}</g>`;const tall=['boots','rain','hitop'].includes(s),yy=tall?41:43.5;let a='';const one=right=>{
      const p=[[12.5,yy],[15,yy],[15,yy+.25],[15.25,yy+.25],[15.25,yy+.5],[15.5,yy+.5],[15.5,45.25],[15.25,45.25],[15.25,45.5],[15,45.5],[15,45.75],[14.75,45.75],[14.75,46],[11.75,46],[11.75,45.75],[11.5,45.75],[11.5,45.5],[11.25,45.5],[11.25,45.25],[11,45.25],[11,44.75],[11.25,44.75],[11.25,44.5],[11.5,44.5],[11.5,44.25],[11.75,44.25],[11.75,44],[12.5,44]];let r=contour(p.map(([x,y])=>[right?32-x:x,y]),c);r+=poly([[12.5,yy+.5],[14.5,yy+.5],[14.5,yy+1],[15,yy+1],[15,45],[14.5,45],[14.5,45.5],[11.5,45.5],[11.5,44.5],[12.5,44.5]].map(([x,y])=>[right?32-x:x,y]),c);const xx=right?17:12;r+=rect(xx,44,.25,.5,l)+rect(right?17:11.5,45,3.5,.5,['sneaker','hitop','wing_shoes'].includes(s)?WHITE:d)+rect(right?17.25:11.75,45.625,3,.125,shade(c,-.14));if(['sneaker','hitop'].includes(s))r+=rect(right?17.5:12.5,44,1.5,.125,WHITE)+rect(right?17.75:12.75,44.5,1,.125,WHITE)+thread(right?18:13,43.5,.125,.5,l)+thread(right?18.75:12.25,44.5,.125,.375,l)+thread(right?19.625:11.5,44.75,.5,.125,l);if(tall)r+=rect(right?17.5:12.5,yy+1,2,.125,l)+rect(right?18.25:13.25,yy+1.5,.125,1.5,shade(c,.18));return r;};a+=one(false)+one(true);if(s==='wing_shoes')a+=bitmap(['ww.','www','.ww'],{w:'#ffdfa8'},8.5,42)+bitmap(['.ww','www','ww.'],{w:'#ffdfa8'},20.5,42);if(s==='ballet')a+=rect(13.5,42,.125,2,c)+rect(18.25,42,.125,2,c);return `<g data-qpx-shoes="${s}" data-qpx-shoe-color="${c}">${a}</g>`;}
  const oval=(cx,cy,rx,ry,c,stroke='',weight=.18)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"${stroke?' stroke="'+stroke+'" stroke-width="'+weight+'"':''}/>`;
  const line=(d,c,width=.2)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shapePath=(d,c,edge=INK,weight=.18)=>`<path d="${d}" fill="${c}" stroke="${edge}" stroke-width="${weight}" stroke-linejoin="round"/>`;
  function heart(x,y,size,c){return shapePath(`M${x} ${y+size*.85}C${x-size*1.65} ${y-size*.25} ${x-size*.7} ${y-size*1.1} ${x} ${y-size*.35}C${x+size*.7} ${y-size*1.1} ${x+size*1.65} ${y-size*.25} ${x} ${y+size*.85}Z`,c,shade(c,-.25),.12);}
  function ribbon(x,y,c,d,l){return shapePath(`M${x-.3} ${y}C${x-5} ${y-3.2} ${x-5.4} ${y+3} ${x-.3} ${y+1}Z`,c,d)+shapePath(`M${x+.3} ${y}C${x+5} ${y-3.2} ${x+5.4} ${y+3} ${x+.3} ${y+1}Z`,c,d)+shapePath(`M${x-.8} ${y+.7}L${x-1.8} ${y+4}L${x} ${y+3.4}L${x+1.8} ${y+4}L${x+.8} ${y+.7}Z`,c,d)+oval(x,y+.4,1.05,1.05,l,d);}
  function hat(val){if(!val)return '';const {shape:s,col:c,d,l}=item('hat',val);
    if(s==='ribbon')return ribbon(16,3.2,c,d,l);
    if(s==='cat_ears')return shapePath('M7 7Q6.5 3 8 1.5Q12 3 12.5 7Z',c,d)+shapePath('M19.5 7Q20 3 24 1.5Q25.5 3 25 7Z',c,d)+shapePath('M8 6L8.4 3.6L10.8 6Z','#fac4cd','none')+shapePath('M21.2 6L23.6 3.6L24 6Z','#fac4cd','none');
    if(s==='crown')return shapePath('M9 7L7.5 1L12 4L16 .3L20 4L24.5 1L23 7Z',c,d,.24)+shapePath('M9 6.4Q16 5.6 23 6.4L22.5 8.2H9.5Z',l,d)+oval(16,4.8,1,1.15,'#ec748b',d)+oval(10.4,6,.5,.6,'#76cdd5',d)+oval(21.6,6,.5,.6,'#76cdd5',d);
    if(s==='halo')return oval(16,1.8,6.2,1.5,'none',l,.7)+oval(16,1.5,6.2,1.5,'none',c,.3);
    if(s==='flower')return flower(24,4,c)+flower(21,2.6,l)+line('M20 4Q24 7 26 2','#719957',.5);
    if(s==='witch')return shapePath('M10 7Q12 3 15 -3Q17 -4 21 0Q17 0 20 7Z',c,d,.22)+oval(16,7,10,1.8,c,d)+line('M12 5Q16 6.2 20 5',l,.8)+shapePath('M15 5.4H18V7H15Z','#ffcf76',d);
    if(s==='grad')return shapePath('M16 0L27 4L16 8L5 4Z',c,d,.24)+shapePath('M11 5.2Q16 8 21 5.2V9Q16 10 11 9Z',d,d)+line('M25 4Q26 8 25 11',l,.3)+oval(25,11.2,.7,1.1,l,d);
    if(s==='straw')return oval(16,8.2,12,2.3,l,d)+shapePath('M8 7.5Q8 0 16 0Q24 0 24 7.5Z',c,d)+line('M9 6Q16 7.2 23 6',d,.7)+ribbon(22,7.1,'#ed9394','#b05f67','#ffd0c9');
    if(s==='santa')return shapePath('M7 7Q9 0 16 0Q21 -.4 25 4L24 7Q21 3 18 4L22 8Z','#ed6978','#a44357')+oval(25,4.7,1.9,1.9,WHITE,'#d9c7c8')+shapePath('M7 6.4Q16 4.8 24 6.4V9Q16 7.7 7 9Z',WHITE,'#d9c7c8');
    const cap=shapePath('M6.8 7Q6.8 .4 15.8 .4Q24.8 .4 24.8 7Z',c,d,.22)+line('M10 2Q14 -.1 19 2',l,.4);
    if(s==='beanie')return cap+oval(16,-.1,2.1,2.1,l,d)+shapePath('M6.8 6.5Q16 5.4 24.8 6.5V9.2Q16 8 6.8 9.2Z',l,d)+line('M10 7V8.7M13 6.8V8.5M16 6.7V8.4M19 6.8V8.5M22 7V8.7',c,.25);
    return cap+shapePath('M7 7Q16 5 27 7.5Q25 10 15 8.2Q10 8.3 7 7Z',d,d)+line('M9 6.7Q16 5.5 23 6.9',l,.32);
  }
  function glasses(val,tile=1){if(!val)return '';const {shape:s,col:c,d,l}=item('glass',val),[left,right,cy]=eyesFor(tile),w=Math.min(3.1,(right-left)*.32),weight=s==='thick'?.38:.24;
    const tinted=['sun','heart','star_g','goggle','sport'].includes(s),fill=tinted?d:'none';
    const lens=x=>s==='heart'?heart(x,cy,w*.85,c):s==='star_g'?star(x,cy,c,w):s==='square'||s==='thick'||s==='sun'?`<rect x="${x-w}" y="${cy-2.5}" width="${w*2}" height="5" rx=".85" fill="${fill}" stroke="${c}" stroke-width="${weight}"/>`:oval(x,cy,w,2.5,fill,c,weight);
    if(s==='eyepatch')return shapePath(`M${left-w} ${cy-2}Q${left} ${cy-3.3} ${left+w} ${cy-2}L${left+w-.2} ${cy+1.3}Q${left} ${cy+3.4} ${left-w+.2} ${cy+1.3}Z`,c,d)+line(`M${left+w} ${cy-1.5}L${right+4} ${cy-3}`,c,.2);
    if(s==='mono')return lens(right)+line(`M${right+w} ${cy+1.2}Q${right+4} ${cy+4.1} ${right+2.4} ${cy+6}`,c,.15);
    if(s==='sport')return shapePath(`M${left-w} ${cy-2}Q16 ${cy-3} ${right+w} ${cy-2}L${right+w-.4} ${cy+1.6}Q16 ${cy+3} ${left-w+.4} ${cy+1.6}Z`,d,c,.28)+line(`M${left-w+1} ${cy-1.4}H${right+w-1}`,l,.28);
    if(s==='half')return line(`M${left-w} ${cy}Q${left} ${cy+4.5} ${left+w} ${cy}M${right-w} ${cy}Q${right} ${cy+4.5} ${right+w} ${cy}`,c,.25)+line(`M${left+w} ${cy}Q16 ${cy-1} ${right-w} ${cy}`,c,.2);
    return lens(left)+(s==='pince'?'':line(`M${left-w} ${cy-1}l-1.1-.35M${right+w} ${cy-1}l1.1-.35`,c,.2))+lens(right)+line(`M${left+w} ${cy-.5}Q16 ${cy-1.3} ${right-w} ${cy-.5}`,c,.2)+(tinted?line(`M${left-w+.7} ${cy-1.4}l1.4-.3M${right-w+.7} ${cy-1.4}l1.4-.3`,l,.25):'');
  }
  function faceAccessory(val){if(!val)return '';const {shape:s,col:c,d,l}=item('face',val);
    if(s==='mask')return shapePath('M9.5 17.5Q16 18.8 22.5 17.5L22 20.8Q16 24 10 20.8Z',c,d)+line('M10.8 19Q16 20.2 21.2 19M11 20.4Q16 21.6 21 20.4',l,.15)+line('M9.7 18.4L7.8 16.6M22.3 18.4L24.2 16.6',d,.18);
    if(s==='mus')return shapePath('M16 20Q13 17.8 10.5 20Q12 23 16 21Q20 23 21.5 20Q19 17.8 16 20Z',c,d);
    if(['beard','goatee','stubble'].includes(s))return shapePath(s==='goatee'?'M13 21.5Q16 23 19 21.5Q19 25 16 25.5Q13 25 13 21.5Z':'M9.7 19.5Q11 23 16 22Q21 23 22.3 19.5Q23 25 16 26Q9 25 9.7 19.5Z',c,d)+line('M12 23Q16 25 20 23',l,.18);
    if(s==='band')return `<rect x="8" y="18" width="4" height="1.6" rx=".5" fill="#edbd9c" stroke="#ba8b6c" stroke-width=".15" transform="rotate(-20 10 19)"/>`+line('M9 18.7H10.8','#ffdaca',.3);
    if(s==='mole')return oval(12,20.8,.35,.35,c);
    if(s==='tear')return shapePath('M10.5 16.8Q7.6 20.5 10.5 21Q13.4 20.5 10.5 16.8Z','#83cfea','#429fbf')+oval(10,19.4,.35,.6,'#dffbff');
    if(s==='whisker')return line('M6.5 18L10 19M6.7 20L10 20.2M22 19L25.5 18M22 20.2L25.3 20',c,.18);
    let a='';for(const [x,y]of[[9,19],[10.5,20],[11,18.5],[21,18.5],[21.5,20],[23,19]])a+=oval(x,y,.23,.23,c);return a;
  }
  function ears(val){if(!val)return '';const {shape:s,col:c,d,l}=item('ear',val);let a='';for(const x of[6.8,25.2]){a+=oval(x,20.8,.42,.42,c,d);if(s==='ring')a+=oval(x,22.2,1.05,1.25,'none',c,.3);else if(s==='star_e')a+=star(x,23,c,1.3);else if(s==='heart_e')a+=heart(x,23,1.15,c);else if(s==='cross_e')a+=line(`M${x} 22V25M${x-1} 23H${x+1}`,c,.35);else if(s==='flower_e')a+=flower(x,23,c,.5);else if(s==='long_e'||s==='drop')a+=line(`M${x} 21.2V24`,c,.2)+shapePath(`M${x} 23Q${x-1.7} 25.8 ${x} 26Q${x+1.7} 25.8 ${x} 23Z`,c,d);else a+=oval(x,22.8,.65,.8,c,d)+oval(x-.2,22.5,.2,.25,l);}return a;}
  function neck(val){if(!val)return '';const {shape:s,col:c,d,l}=item('neck',val);if(s==='scarf')return shapePath('M12 28Q16 29.5 20 28V30Q16 31.4 12 30Z',c,d)+shapePath('M17 30L20 30L19.5 36L17.3 35Z',c,d)+line('M18 31L18.4 34.5',l,.2);let a=line('M12.5 29Q16 32 19.5 29',c,s==='choker'?.8:.28);if(s==='star_n')a+=star(16,32,c,1.3);else if(s==='heart_n')a+=heart(16,32,1.2,c);else if(s==='gem')a+=shapePath('M16 30.8L17.3 32L16 33.7L14.7 32Z',c,d)+line('M16 31.2V33',l,.2);else if(s==='cross_n')a+=line('M16 31V34M15 32H17',c,.35);else if(s==='key')a+=oval(16,31.8,.7,.7,'none',c,.3)+line('M16 32.5V34.4H17',c,.3);else if(s!=='choker')for(const [x,y]of[[13.3,30],[14.6,30.8],[16,31.1],[17.4,30.8],[18.7,30]])a+=oval(x,y,.35,.35,l,d,.08);return a;}
  function back(val){if(!val)return '';const {shape:s,col:c,d,l}=item('back',val);
    if(s==='bag')return shapePath('M11 28Q16 26 21 28V37Q21 39.5 16 39.5Q11 39.5 11 37Z',c,d)+shapePath('M12.2 33H19.8V37.5H12.2Z',l,d)+line('M13.5 28V36M18.5 28V36',d,.5);
    if(s==='cape')return shapePath('M12.5 27.5Q16 29 19.5 27.5Q22 34 25 42Q21 44 16 42.5Q11 44 7 42Q10 34 12.5 27.5Z',c,d)+line('M13 29Q11 35 10 41M19 29Q21 35 22 41',l,.24);
    if(s==='balloon')return line('M28 29Q25 35 27 41',d,.15)+oval(28,26,4.1,5.6,c,d)+oval(26.5,23.8,.7,1.6,l)+shapePath('M27.5 31L28.4 31L29 32H27Z',d,d);
    if(s==='halo'||s==='star_back')return star(3,29,l,2)+star(28,32,c,1.7)+star(4,39,c,1.4)+star(27,40,l,1.2);
    const feathers=s==='angel'?WHITE:c,shadow=s==='angel'?'#bfcde0':d,light=s==='angel'?'#ffffff':l;
    const wing=right=>`<g${right?' transform="translate(32 0) scale(-1 1)"':''}>${shapePath('M12.5 30Q5.5 29 2.5 24Q-1 32 3 36Q1 38.5 5 39Q7.5 43 13 36Z',feathers,shadow,.2)}${line('M4 29Q3 33 9 34M3.8 33Q4.8 37 10 36M5.5 37Q8 40 11.5 36.8',shadow,.3)}${line('M4.5 27.7Q5.2 31.5 10.5 32.5',light,.5)}</g>`;return wing(false)+wing(true);
  }
  function pet(val){if(!val)return '';const {shape:s,col:c,d,l}=item('pet',val);if(window.QPPets)return window.QPPets.render(s,c);return `<g class="qpx-pet">${oval(28,46.5,4.3,.65,'#67586f')}${oval(28,43,3.6,3.7,c,d)}${oval(25.5,39.8,1.2,s==='rabbit'?3.6:1.4,c,d)}${oval(30.5,39.8,1.2,s==='rabbit'?3.6:1.4,c,d)}${oval(26.5,42.5,.45,.65,INK)}${oval(29.5,42.5,.45,.65,INK)}${oval(26.3,42.2,.15,.2,WHITE)}${oval(29.3,42.2,.15,.2,WHITE)}${heart(28,44,.5,'#ec99aa')}${oval(25.8,44,.5,.25,'#eba5b3')}${oval(30.2,44,.5,.25,'#eba5b3')}</g>`;}
  function flower(x,y,c,size=1){let a='';for(let i=0;i<5;i++){const t=i*Math.PI*2/5;a+=oval(x+Math.sin(t)*size,y+Math.cos(t)*size,size*.73,size*.83,c,shade(c,-.13),.08);}return a+oval(x,y,size*.65,size*.65,'#ffdf95',shade(c,-.25),.08);}
  function background(val,lod){if(!val)return '';const {shape:s,col:c,d,l}=item('bg',val);let a='';if(['garden','sakura','classroom','stage','sea','snow'].includes(s)){const sky=s==='sea'?'#aecfe4':s==='snow'?'#e4dbed':'#d8dfc9';a+=rect(0,0,32,48,sky)+rect(0,40,32,8,s==='sea'?'#94b9d2':s==='snow'?'#f4eff5':'#b3cfa7');if(s==='garden')a+=rect(0,38,32,1,WHITE)+rect(1,36,1,6,WHITE)+rect(5,36,1,6,WHITE)+rect(27,36,1,6,WHITE);}
    if(s==='night'||s==='space')a+=rect(0,0,32,48,'#555b87');
    if(s==='rainbow')a+=rect(0,0,32,48,'#ded5ed')+rect(0,2,32,1,'#e5b2c8')+rect(0,3,32,1,'#efd0ae')+rect(0,4,32,1,'#d6dfbb');
    if(a)a=`<g class="qpx-backdrop">${a}</g>`;
    for(let i=0;i<7;i++){const x=(i*11+3)%31,y=(i*13+6)%43;const f=(s==='garden'||s==='sakura')?flower(x,y,i%2?c:l):star(x,y,i%2?c:l);a+=`<g class="qpx-spark" style="animation-delay:${i*.4}s">${f}</g>`;}
    return `<g opacity="${lod===1?.6:1}">${a}</g>`;
  }
  function frame(shape,c,d,l){let a='';
    if(shape==='garden'){
      a+=line('M3 44Q-1 32 3 23Q-1 13 3 4M29 44Q33 32 29 23Q33 13 29 4','#799858',.5);
      for(const[x,y,angle]of[[2,8,-35],[1.6,18,35],[2,31,-35],[2.8,42,35],[30,8,35],[30.4,18,-35],[30,31,35],[29.2,42,-35]])a+=`<ellipse cx="${x}" cy="${y}" rx="1.2" ry="2.2" fill="#9fc573" transform="rotate(${angle} ${x} ${y})"/>`;
      for(const[x,y]of[[3,6],[1.8,15],[2.8,29],[2.6,40],[29,6],[30.2,15],[29.2,29],[29.4,40],[16,46]])a+=flower(x,y,c,.65);
    }else if(shape==='moon'){
      a+=shapePath('M7 1C.7 -.5 -.5 8 5 9C2 5.5 3.5 2.7 7 1Z','#ffe1a0','#bda275',.12);
      for(const[x,y]of[[29,4],[1.5,16],[30,29],[2.5,41],[29,43]])a+=star(x,y,c,1.1);
      a+=line('M28.5 4Q31 13 29.7 28M2 16Q-.2 26 2.5 40',l,.12);
    }else if(shape==='royal'){
      a+=`<rect x="1.8" y="2.5" width="28.4" height="43" rx="3" fill="none" stroke="${d}" stroke-width="1.1"/><rect x="2.1" y="2.1" width="27.8" height="43" rx="3" fill="none" stroke="${c}" stroke-width=".65"/><rect x="3" y="3" width="26" height="41.2" rx="2" fill="none" stroke="${l}" stroke-width=".2"/>`+ribbon(16,2,c,d,l);
      for(const[x,y]of[[3,7],[29,7],[3,41],[29,41]])a+=oval(x,y,.55,.75,l,d,.1);
    }else{
      for(const[x,y,r]of[[2,6,1.35],[1.5,18,1.1],[2,37,1.25],[29,6,1.5],[30,20,1.1],[29,38,1.25]])a+=oval(x,y,r,r,'none',l,.2)+oval(x-r*.35,y-r*.4,r*.16,r*.24,WHITE);
      a+=star(16,1,c,1.2)+star(16,47,l,1.2);
    }return `<g class="qpx-spark">${a}</g>`;
  }
  function headBitmap(tile,col,expression='bright',backHair=false){
    const attrs=`data-qpx-hair-color="${col}" data-qpx-hair-skin="${SKIN}" data-qpx-expression="${expression}" data-qpx-sex="${ACTIVE_SEX}" data-qpx-tile="${tile}"`;
    const clip=backHair?'qpx-hair-behind':'qpx-head-front';
    return `<g${backHair?' class="qpx-back-hair"':''} clip-path="url(#${clip})"><image ${attrs}${backHair?' data-qpx-tail="true"':''} href="${normalizedHead(tile,col,SKIN,expression,ACTIVE_SEX)}" x="0" y="0" width="32" height="40" preserveAspectRatio="none" style="image-rendering:auto"/></g>`;
  }
  function eraseEye(cx,cy,tile,part){
    const side=cx===eyesFor(tile)[0]?'left':'right';
    return `<image data-qpx-eye-erase="${tile}/${side}/${part}" data-qpx-eye-sex="${ACTIVE_SEX}" href="${normalizedEyePatch(tile,SKIN,ACTIVE_SEX,side,part)}" x="0" y="0" width="32" height="40" preserveAspectRatio="none"/>`;
  }
  function closedEye(cx,cy,smile=false,tile=0){const w=Math.max(1.75,(eyesFor(tile)[1]-eyesFor(tile)[0])*.33);return eraseEye(cx,cy,tile,'full')+`<path d="M${cx-w} ${cy+.6}Q${cx} ${cy+(smile?-1.3:1.9)} ${cx+w} ${cy+.6}M${cx-w} ${cy+.6}l-.5-.5M${cx+w} ${cy+.6}l.5-.5" fill="none" stroke="${INK}" stroke-width=".29" stroke-linecap="round"/>`;}
  function halfEye(cx,cy,tile=0){const w=Math.max(1.75,(eyesFor(tile)[1]-eyesFor(tile)[0])*.33);return eraseEye(cx,cy,tile,'half')+`<path d="M${cx-w} ${cy+.2}Q${cx} ${cy+1} ${cx+w} ${cy+.2}" fill="none" stroke="${INK}" stroke-width=".27" stroke-linecap="round"/>`;}
  function expressionStencil(expression,tile=0){
    const [left,right,cy]=eyesFor(tile),cx=(left+right)/2,my=Math.min(26.3,cy+4.2),patch=`<ellipse cx="${cx}" cy="${my}" rx="2.25" ry="1.4" fill="${SKIN}"/>`;let s='';
    if(expression==='happy')s+=patch+`<path d="M${cx-1.8} ${my-.5}Q${cx} ${my-.1} ${cx+1.8} ${my-.5}Q${cx+1.6} ${my+1.55} ${cx} ${my+1.5}Q${cx-1.6} ${my+1.55} ${cx-1.8} ${my-.5}Z" fill="#ac6271" stroke="#774454" stroke-width=".18"/><path d="M${cx-1.5} ${my-.4}Q${cx} ${my} ${cx+1.5} ${my-.4}" fill="none" stroke="${WHITE}" stroke-width=".38"/>`;
    if(expression==='soft')s+=patch+`<path d="M${cx-1.35} ${my}Q${cx} ${my+.9} ${cx+1.35} ${my}" fill="none" stroke="#b97580" stroke-width=".22" stroke-linecap="round"/>`;
    if(expression==='wink')s+=closedEye(right,cy,false,tile)+patch+`<path d="M${cx-1.1} ${my+.2}Q${cx+.3} ${my+.8} ${cx+1.4} ${my-.5}" fill="none" stroke="#a35d71" stroke-width=".22" stroke-linecap="round"/>`;
    if(expression==='chic')s+=`<path d="M${left-1.5} ${cy-3.5}Q${left} ${cy-3.1} ${left+1.7} ${cy-3.25}M${right-1.7} ${cy-3.25}Q${right} ${cy-3.1} ${right+1.5} ${cy-3.5}" fill="none" stroke="${INK}" stroke-width=".22"/>`+patch+`<path d="M${cx-1.1} ${my+.35}Q${cx} ${my+.1} ${cx+1.1} ${my+.35}" fill="none" stroke="#a35d71" stroke-width=".2"/>`;
    if(expression==='cat')s+=patch+`<path d="M${cx-1.4} ${my}Q${cx-.6} ${my+1} ${cx} ${my}Q${cx+.6} ${my+1} ${cx+1.4} ${my}" fill="none" stroke="#aa6475" stroke-width=".22" stroke-linecap="round"/>`;
    if(expression==='freckle')for(const [x,y]of[[left-1,cy+3],[left+.4,cy+3.4],[left+1.5,cy+2.8],[right-1.3,cy+2.8],[right,cy+3.4],[right+1.4,cy+3]])s+=`<circle cx="${x}" cy="${y}" r=".16" fill="#af765b"/>`;
    return s;
  }
  const hairTile=av=>{const {shape}=item('hair',av.hair),sex=av.sex||ACTIVE_SEX,names=sex==='m'?maleHairNames:hairNames,maleAliases={buzz:'crop',long:'wolf',longm:'wolf',wave:'curlm',afro:'curlm',mohawk:'spiky'},alias=sex==='m'?maleAliases[shape]:aliases[shape];return Math.max(0,names.indexOf(names.includes(shape)?shape:alias||shape));};
  function head(av){const {col}=item('hair',av.hair),tile=hairTile(av),expr=String(av.expression||'bright:0').split(':')[0],[left,right,cy]=eyesFor(tile);return `<g class="qpx-hair" data-qpx-head="${encodeURIComponent(JSON.stringify(av))}" data-qpx-head-sex="${ACTIVE_SEX}" data-qpx-head-skin="${SKIN}">${headBitmap(tile,col,expr)}${expressionStencil(expr,tile)}<g class="qpx-blink-half">${halfEye(left,cy,tile)}${expr==='wink'?'':halfEye(right,cy,tile)}</g><g class="qpx-blink-closed">${closedEye(left,cy,expr==='happy',tile)}${expr==='wink'?'':closedEye(right,cy,expr==='happy',tile)}</g></g>`;}
  function facePreview(av){return head(av);}
  function fullHead(av){return head(av)+`<g data-qpx-head-accessory="face" transform="translate(0 6)">${faceAccessory(av.face)}</g><g data-qpx-head-accessory="glass">${glasses(av.glass,hairTile(av))}</g><g data-qpx-head-accessory="ear" transform="translate(0 4)">${ears(av.ear)}</g><g data-qpx-head-accessory="hat" transform="translate(0 4)">${hat(av.hat)}</g>`;}
  function defs(){return '<defs><clipPath id="qpx-head-front" clipPathUnits="userSpaceOnUse"><rect x="-1" y="-8" width="34" height="36.45"/></clipPath><clipPath id="qpx-hair-behind" clipPathUnits="userSpaceOnUse"><rect x="-1" y="28.2" width="34" height="20"/></clipPath><clipPath id="qpx-torso-dressed" clipPathUnits="userSpaceOnUse"><rect x="13" y="28" width="6" height="11"/></clipPath><clipPath id="qpx-arms-short" clipPathUnits="userSpaceOnUse"><rect x="0" y="32.75" width="32" height="7"/></clipPath><clipPath id="qpx-arms-long" clipPathUnits="userSpaceOnUse"><rect x="0" y="36.75" width="32" height="3"/></clipPath><clipPath id="qpx-face-preview-area" clipPathUnits="userSpaceOnUse"><path d="M8 21H24V26H23V28H22V29H20V30H12V29H10V28H9V26H8Z"/></clipPath></defs>';}
  function composition(av,lod){
    const shoeShape=String(av.shoes||'').split(':')[0],shoeTarget=window.QPShoes?.targets?.[shoeShape==='dress'?'loafer':shoeShape],footFloor=shoeShape?(shoeTarget?shoeTarget[1]+shoeTarget[3]:46.05):45.15;
    const contactY=28+(footFloor-28)*1.35;
    let s=defs()+`<g transform="scale(1 ${VIEW_H/48})">${background(av.bg,lod)}</g><ellipse class="qpx-contact-shadow" cx="16" cy="${contactY}" rx="6.4" ry=".7" fill="#635d6f" opacity=".22"/>`;
    s+=`<g class="qpx-idle">${headBitmap(hairTile(av),item('hair',av.hair).col,String(av.expression||'bright:0').split(':')[0],true)}<g transform="translate(0 28) scale(1 1.35) translate(0 -28)">${back(av.back)}<g transform="${ACTIVE_SEX==='m'?'translate(-.64 0) scale(1.04 1)':''}"><g class="qpx-body">${fittedArms(av.top)}${bareBody(av.top)}${bottom(av.bottom)}${shoes(av.shoes)}${top(av.top)}${fittedArms(av.top,true)}${neck(av.neck)}</g></g></g><g class="qpx-head" data-qpx-head="${encodeURIComponent(JSON.stringify(av))}" data-qpx-head-sex="${ACTIVE_SEX}" data-qpx-head-skin="${SKIN}">${fullHead(av)}</g></g><g transform="translate(0 ${VIEW_H-48})">${pet(av.pet)}</g>`;
    if(av.frame){const {shape,col,d,l}=item('frame',av.frame);s+=`<g transform="scale(1 ${VIEW_H/48})">${frame(shape,col,d,l)}</g>`;}return s+effect(av.effect);
  }
  function render(av,h=180,lod=2){av=av||newAvatar();SKIN=skinFor(av.sk||0);SKIN_SHADE=shade(SKIN,-.14);ACTIVE_SEX=av.sex==='m'?'m':'f';const key=JSON.stringify(av)+'/'+h+'/'+lod+JSON.stringify(atlas);if(cache.has(key))return cache.get(key);let seed=0;const str=JSON.stringify(av);for(let i=0;i<str.length;i++)seed=(seed*31+str.charCodeAt(i))>>>0;const out=`<svg xmlns="http://www.w3.org/2000/svg" class="qp-pixel-avatar qp-illustrated-avatar" data-qpx-seed="${seed%5000}" data-qpx-sex="${ACTIVE_SEX}" viewBox="0 0 32 ${VIEW_H}" width="${h*32/VIEW_H}" height="${h}" role="img" aria-label="일러스트 퀴즈 아바타" shape-rendering="geometricPrecision" style="display:block;image-rendering:auto;overflow:visible;--qpx-blink-cycle:${4.1+seed%2900/1000}s">${composition(av,lod)}</svg>`;if(cache.size>280)cache.clear();cache.set(key,out);return out;}
  function thumb(cat,shape,ci,h=75,sex){if(cat==='effect'&&window.QPEffects)return window.QPEffects.thumb(shape,ci,h);SKIN=skinFor(0);SKIN_SHADE=shade(SKIN,-.14);ACTIVE_SEX=sex==='m'||sex===undefined&&typeof ME!=='undefined'&&ME&&ME.av&&ME.av.sex==='m'?'m':'f';const val=shape+':'+ci,a={sk:0,hair:ACTIVE_SEX==='m'?'short:1':'bob:1',expression:'bright:0',top:'',bottom:'',shoes:'',ear:'',neck:'',hat:'',glass:'',face:'',back:'',pet:'',bg:'',frame:''};a[cat]=val;let s=defs(),crop='0 0 32 48';if(cat==='expression'){crop='4 8 24 24';s+=facePreview(a);}else if(cat==='hair'){crop='0 1 32 38';s+=headBitmap(hairTile(a),item('hair',a.hair).col,'bright',true)+head(a);}else if(['hat','glass','face','ear'].includes(cat)){crop=cat==='hat'?'2 0 28 16':cat==='ear'?'3 22 26 12':'5 18 22 15';s+=head(a)+`<g transform="translate(0 ${cat==='hat'||cat==='ear'?4:cat==='glass'?0:6})">${({hat,glass:glasses,face:faceAccessory,ear:ears}[cat])(val)}</g>`;}else if(cat==='pet'){s+=pet(val);crop='23 35 10 13';}else if(cat==='bg')s+=background(val,2);else if(cat==='frame'){const {col,d,l}=item(cat,val);s+=frame(shape,col,d,l);}else if(cat==='back'){s+=back(val);crop='0 26 32 18';}else{s+=fittedArms(cat==='top'?val:'')+bareBody(cat==='top'?val:'')+({top,bottom,shoes,neck}[cat]||(()=>''))(val)+fittedArms(cat==='top'?val:'',true);crop=cat==='top'?'7 27 18 16':cat==='bottom'?'9 35 14 11':cat==='shoes'?'9 40 14 7':'10 26 12 11';}const [x,y,w,hh]=crop.split(' ').map(Number);return `<svg xmlns="http://www.w3.org/2000/svg" class="qp-pixel-avatar qp-illustrated-avatar" viewBox="${crop}" width="${h*w/hh}" height="${h}" shape-rendering="geometricPrecision" style="display:block;image-rendering:auto;--qpx-blink-cycle:5.4s">${s}</svg>`;}
  const expressions={bright:['반짝 미소',0,()=>expressionStencil('bright')],soft:['수줍은 미소',180,()=>expressionStencil('soft')],sparkle:['푸른 눈 웃음',240,()=>expressionStencil('sparkle')],happy:['활짝 웃음',220,()=>expressionStencil('happy')],wink:['장난스런 윙크',260,()=>expressionStencil('wink')],chic:['도도한 표정',240,()=>expressionStencil('chic')],cat:['금빛 고양이 눈',320,()=>expressionStencil('cat')],freckle:['수줍은 주근깨',220,()=>expressionStencil('freckle')]};
  const frames={garden:['꽃빛 정원 액자',720,(c,d,l)=>frame('garden',c,d,l)],moon:['달빛 별자리 액자',980,(c,d,l)=>frame('moon',c,d,l)],royal:['로열 리본 액자',1250,(c,d,l)=>frame('royal',c,d,l)],dream:['꿈방울 액자',860,(c,d,l)=>frame('dream',c,d,l)]};
  const style=document.createElement('style');style.id='qpx-avatar-motion';style.textContent=`
  @keyframes qpx-body{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.01)}}
  @keyframes qpx-head-breath{0%,100%{transform:translateY(0) rotate(-.3deg)}50%{transform:translateY(-.243px) rotate(.3deg)}}
  @keyframes qpx-sway{0%,100%{transform:rotate(-.4deg)}50%{transform:rotate(.4deg)}}
  @keyframes qpx-arms{0%,100%{transform:rotate(0deg)}50%{transform:rotate(calc(var(--qpx-arm-direction,1) * 1.5deg))}}
  @keyframes qpx-hands{0%,35%,70%,100%{transform:rotate(0deg)}40%,65%{transform:rotate(.7deg)}}
  @keyframes qpx-blink-half{0%,96.39%,97.21%,98.39%,99.21%,100%{opacity:0}96.4%,97.2%,98.4%,99.2%{opacity:1}}
  @keyframes qpx-blink-closed{0%,97.19%,98.41%,100%{opacity:0}97.2%,98.4%{opacity:1}}
  @keyframes qpx-pet{0%,35%,70%,100%{transform:translateY(0)}40%,65%{transform:translateY(calc(-1 * var(--qpx-pet-pixel,.25px)))}}
  @keyframes qpx-spark{0%,100%{opacity:.65}50%{opacity:1}}
  .qp-avatar-loading .qp-pixel-avatar,.qp-avatar-error .qp-pixel-avatar{visibility:hidden}
  .qp-avatar-loading .mestage::before,.qp-avatar-error .mestage::before{display:grid;place-items:center;color:#e7faff;font-size:15px;text-align:center;padding:16px;box-sizing:border-box}
  .qp-avatar-loading .shopwrap .mestage::before,.qp-avatar-error .shopwrap .mestage::before{color:#795037;text-shadow:0 1px 0 #fff8e8}
  .qp-avatar-loading .mestage::before{content:'아바타 그림을 불러오는 중…'}
  .qp-avatar-error .mestage::before{content:'그림을 불러오지 못했어요. 새로고침해 주세요.'}
  .qpx-hair{transform:none;animation:none}.qpx-idle{transform-box:view-box;transform-origin:16px 43px;animation:qpx-sway 8.7s ease-in-out infinite}.qpx-head,.qpx-back-hair{transform-box:view-box;transform-origin:16px 28px;animation:qpx-head-breath 6.4s ease-in-out infinite}.qpx-body{transform-box:view-box;transform-origin:16px 46.05px;animation:qpx-body 6.4s ease-in-out infinite}.qpx-arm-left,.qpx-arm-right,.qpx-arm-front-left,.qpx-arm-front-right{animation:qpx-arms 6.4s ease-in-out infinite}.qpx-hand-left,.qpx-hand-right{animation:qpx-hands 6.4s ease-in-out infinite}.qpx-blink-half{opacity:0;animation:qpx-blink-half var(--qpx-blink-cycle,5.4s) steps(1,end) infinite}.qpx-blink-closed{opacity:0;animation:qpx-blink-closed var(--qpx-blink-cycle,5.4s) steps(1,end) infinite}.qpx-pet{animation:qpx-pet 4.8s ease-in-out infinite}.qpx-spark{animation:qpx-spark 3.4s ease-in-out infinite}
  .qp-pixel-avatar:not([data-qpx-seed]) .qpx-arm-front-left,.qp-pixel-avatar:not([data-qpx-seed]) .qpx-arm-front-right,.qp-pixel-avatar:not([data-qpx-seed]) .qpx-arm-left,.qp-pixel-avatar:not([data-qpx-seed]) .qpx-arm-right,.qp-pixel-avatar:not([data-qpx-seed]) .qpx-hand-left,.qp-pixel-avatar:not([data-qpx-seed]) .qpx-hand-right,.qp-pixel-avatar:not([data-qpx-seed]) .qpx-hair{animation:none}
  @media(prefers-reduced-motion:reduce){.qpx-idle,.qpx-head,.qpx-back-hair,.qpx-body,.qpx-arm-left,.qpx-arm-right,.qpx-arm-front-left,.qpx-arm-front-right,.qpx-hand-left,.qpx-hand-right,.qpx-pet{animation:none}.qpx-blink-half,.qpx-blink-closed{animation-duration:8s}.qpx-spark{animation-duration:8s}}
  `;document.head.appendChild(style);
  const motions=new Set(['qpx-body','qpx-head-breath','qpx-sway','qpx-arms','qpx-hands','qpx-blink-half','qpx-blink-closed','qpx-pet','qpx-spark']);const pending=new Set();let raf=0;
  // Motion distances use SVG coordinates so large and small illustrations breathe naturally.
  function fitIllustratedMotion(s){
    if(!s.isConnected)return;
    s.style.setProperty('--qpx-motion-pixel','.18px');
    s.style.setProperty('--qpx-pet-pixel','.25px');
  }
  function avatarsIn(node){return !node||node.nodeType!==1?[]:[...(node.matches('svg.qp-pixel-avatar')?[node]:[]),...node.querySelectorAll('svg.qp-pixel-avatar')];}
  function sync(node){for(const s of avatarsIn(node)){pending.add(s);}if(pending.size&&!raf)raf=requestAnimationFrame(()=>{raf=0;const now=performance.now();for(const s of pending){if(!s.isConnected||!s.getAnimations)continue;fitIllustratedMotion(s);for(const a of s.getAnimations({subtree:true}))if(motions.has(a.animationName))a.currentTime=now;}pending.clear();});}
  const observer=new MutationObserver(records=>{for(const r of records){for(const n of r.removedNodes)for(const s of avatarsIn(n)){pending.delete(s);}for(const n of r.addedNodes)sync(n);}});observer.observe(document.documentElement,{childList:true,subtree:true});sync(document.documentElement);
  function updateArtworkState(){
    const parts=[atlas,window.QPClothes?.atlas,window.QPPets?.atlas,window.QPShoes?.atlas].filter(Boolean);
    const error=parts.some(p=>p.error||p.normalizationError),ready=parts.every(p=>p.ready);
    document.documentElement.classList.toggle('qp-avatar-loading',!ready&&!error);
    document.documentElement.classList.toggle('qp-avatar-error',error);
  }
  for(const event of ['qp-avatar-ready','qp-avatar-error','qp-clothes-ready','qp-clothes-error','qp-pets-ready','qp-pets-error','qp-shoes-ready','qp-shoes-error'])window.addEventListener(event,updateArtworkState);
  updateArtworkState();
  Promise.all([loadSheet('f',atlas.hairUrl),loadSheet('m',atlas.maleUrl)]).then(()=>{
    cache.clear();normalizedHeads.clear();atlas.ready=true;
    // Refresh mounted head components only: inputs and the body rig remain in place.
    const previousSex=ACTIVE_SEX,previousSkin=SKIN,previousShade=SKIN_SHADE;
    const nodes=Array.from(document.querySelectorAll('[data-qpx-head]')).filter(node=>node.classList.contains('qpx-head')||!node.closest('.qpx-head'));
    nodes.forEach(node=>{const av=JSON.parse(decodeURIComponent(node.dataset.qpxHead));ACTIVE_SEX=node.dataset.qpxHeadSex||'f';SKIN=node.dataset.qpxHeadSkin;SKIN_SHADE=shade(SKIN,-.14);node.innerHTML=node.classList.contains('qpx-head')?fullHead(av):head(av).replace(/^<g[^>]*>/,'').replace(/<\/g>$/,'');sync(node.ownerSVGElement);});
    document.querySelectorAll('image[data-qpx-hair-color]').forEach(node=>node.setAttribute('href',normalizedHead(Number(node.dataset.qpxTile),node.dataset.qpxHairColor,node.dataset.qpxHairSkin,node.dataset.qpxExpression||'bright',node.dataset.qpxSex||'f')));
    ACTIVE_SEX=previousSex;SKIN=previousSkin;SKIN_SHADE=previousShade;
    window.dispatchEvent(new CustomEvent('qp-avatar-ready'));
  }).catch(error=>{atlas.normalizationError=String(error&&error.message||error);window.dispatchEvent(new CustomEvent('qp-avatar-error'));});
  window.addEventListener('qp-clothes-ready',()=>{cache.clear();document.querySelectorAll('[data-qpx-clothes]').forEach(node=>{const d=node.dataset;node.innerHTML=window.QPClothes.render(d.qpxClothes,d.clothShape,d.clothColor,d.clothSex,d.clothSkin);});});
  window.addEventListener('qp-effect-ready',()=>{cache.clear();document.querySelectorAll('[data-qpx-effect]').forEach(node=>node.innerHTML=window.QPEffects.render(node.dataset.qpxEffect));});
  window.addEventListener('qp-pets-ready',()=>cache.clear());
  window.addEventListener('qp-shoes-ready',()=>cache.clear());
  function backdrop(value){if(!value)return '';return `<svg xmlns="http://www.w3.org/2000/svg" class="qp-profile-backdrop" viewBox="0 0 32 48" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="--qpx-phase:${-performance.now()/1000}s">${background(value,3)}</svg>`;}
  window.QPAvatar={render,thumb,backdrop,frames,expressions,atlas,syncArtwork:sync,clearCache:()=>cache.clear()};
})();
