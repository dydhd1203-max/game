/* Smooth illustrated paper dolls. The public API and 32 × 56 motion rig stay stable. */
(function(){
  'use strict';
  const INK='#493638',WHITE='#fff8f0';let SKIN='#ffe2cc',SKIN_SHADE='#dfac92',ACTIVE_SEX='f';
  const hairNames=['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'];
  const maleHairNames=['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf'];
  const aliases={crop:'short',buzz:'short',longm:'long',wave:'long',afro:'curly',mohawk:'spiky'};
  const atlas={hairUrl:'assets/sd-heads-female.png',maleUrl:'assets/sd-heads-male.png',headRect:[0,0,32,40],enabled:true,style:'illustrated',columns:4,rows:3};
  const HEAD_GRID=384,HEAD_HEIGHT=480,RIG_H=56,VIEW_H=62;
  // Enlarge the connected body at its neck anchor; preserve the painted head
  // and the original shoe aspect ratio. Pose offsets share these proportions.
  const BODY_PROPORTIONS=Object.freeze({scale:1.18,verticalScale:1.35*1.18});
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
    // Each native head includes a little old neck and its red/dark seam.
    // Remove that stub only inside the measured jaw attachment channel so
    // the shared body skin continues into the chin. The jaw outside this
    // channel, face, hair and every original PNG pixel remain untouched.
    const hint=HEAD_HINTS[sex][tile],jawX=hint.chin[0]*HEAD_GRID/362*m.scale+m.x,jawY=hint.chin[1]*HEAD_GRID/362*m.scale+m.y,u=HEAD_GRID/32;
    const half=sex==='m'?1.94:1.48,edgeY=sex==='m'?.30:.25;
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();
    ctx.moveTo(jawX-half*u,jawY-edgeY*u);ctx.quadraticCurveTo(jawX,jawY-.10*u,jawX+half*u,jawY-edgeY*u);
    ctx.lineTo(jawX+(half+.20)*u,jawY+.5*u);ctx.quadraticCurveTo(jawX+2.15*u,jawY+1.6*u,jawX+3.5*u,jawY+2.8*u);
    ctx.lineTo(jawX+3.5*u,jawY+4.6*u);ctx.lineTo(jawX-3.5*u,jawY+4.6*u);ctx.lineTo(jawX-3.5*u,jawY+2.8*u);
    ctx.quadraticCurveTo(jawX-2.15*u,jawY+1.6*u,jawX-(half+.20)*u,jawY+.5*u);ctx.closePath();ctx.fill();ctx.restore();
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
  function item(cat,val){const [shape,i]=String(val||'').split(':');const c=CAT[cat],chosen=c?(PAL[c.pal][+i]||PAL[c.pal][0])[0]:'#e6a6c5';const col=window.QPClothes?.colorFor?.(cat,shape,ACTIVE_SEX,chosen)||chosen;return {shape,col,d:shade(col,-.25),l:shade(col,.33)};}
  function bitmap(rows,pal,x=0,y=0){let s='';rows.forEach((row,j)=>{let i=0;while(i<row.length){const ch=row[i],start=i;while(i<row.length&&row[i]===ch)i++;if(pal[ch])s+=rect(x+start,y+j,i-start,1,pal[ch]);}});return s;}
  const steppedOval=(x,y,w,h,c)=>`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${c}"/>`;
  const star=(x,y,c,size=1.2)=>`<path d="M${x} ${y-size}Q${x+size*.2} ${y-size*.2} ${x+size} ${y}Q${x+size*.2} ${y+size*.2} ${x} ${y+size}Q${x-size*.2} ${y+size*.2} ${x-size} ${y}Q${x-size*.2} ${y-size*.2} ${x} ${y-size}Z" fill="${c}"/>`;
  // The neck continues behind the painted chin; only its side contour is
  // outlined. A faded contact shadow avoids a separate horizontal skin band.
  function torsoSurface(skin,orientation='front'){
    const id='qpx-torso-'+orientation+'-'+skin.replace('#','');
    return {fill:'url(#'+id+')',shadow:'url(#'+id+'-chin)',defs:`<defs><linearGradient id="${id}" x1="12.8" y1="28" x2="19.5" y2="32.4" gradientUnits="userSpaceOnUse"><stop stop-color="${shade(skin,-.13)}"/><stop offset=".34" stop-color="${skin}"/><stop offset=".68" stop-color="${shade(skin,.075)}"/><stop offset="1" stop-color="${shade(skin,-.025)}"/></linearGradient><linearGradient id="${id}-chin" x1="0" y1="26.75" x2="0" y2="29.45" gradientUnits="userSpaceOnUse"><stop stop-color="${shade(skin,-.28)}" stop-opacity=".38"/><stop offset=".25" stop-color="${shade(skin,-.28)}" stop-opacity=".25"/><stop offset=".65" stop-color="${shade(skin,-.28)}" stop-opacity=".07"/><stop offset="1" stop-color="${shade(skin,-.28)}" stop-opacity="0"/></linearGradient></defs>`};
  }
  let ACTIVE_SHOES=false;
  function bareBody(topValue){
    const shape=String(topValue||'').split(':')[0],tank=shape==='tank',edge=shade(SKIN,-.23),light=shade(SKIN,.09),shadow=shade(SKIN,-.1);
    const shoulder=tank?12.55:12.85,m=torsoSurface(SKIN);
    const torso=`M14.6 24.9Q16 24.5 17.4 24.9L17.4 27.35Q17.35 28.3 18.05 28.58Q19.15 28.85 ${32-shoulder} 29.75L19.05 33.2L19.1 36.8Q16 37.35 12.9 36.8L12.95 33.2L${shoulder} 29.75Q12.85 28.85 13.95 28.58Q14.65 28.3 14.6 27.35Z`;
    let s=m.defs+`<g class="qpx-skin-torso"><path d="${torso}" fill="${m.fill}"/><path d="M14.6 26.7Q16 26.9 17.4 26.7L17.4 28.1Q17.55 28.85 18.05 29.15Q16 29.75 13.95 29.15Q14.45 28.85 14.6 28.1Z" fill="${m.shadow}"/><path d="M17.4 27.5Q17.4 28.3 18.05 28.58Q19.15 28.85 ${32-shoulder} 29.75L19.05 33.2L19.1 36.8Q16 37.35 12.9 36.8L12.95 33.2L${shoulder} 29.75Q12.85 28.85 13.95 28.58Q14.6 28.3 14.6 27.5" fill="none" stroke="${edge}" stroke-width=".1" stroke-linecap="round"/></g>`;
    const leg=right=>`<g class="qpx-leg-${right?'right':'left'}"${right?' transform="translate(32 0) scale(-1 1)"':''}><path d="M12.8 36.5Q14.05 36.15 15.3 36.6L15.05 43.35Q15.85 44.9 14.55 45.15Q12.45 45.5 12.4 44L12.65 41.1Z" fill="${SKIN}" stroke="${edge}" stroke-width=".13"/><path d="M13.15 37.2Q12.85 41.3 13.05 43.85Q13.3 44.6 14.15 44.75Q12.65 45.2 12.7 44L12.9 41.1Z" fill="${shadow}"/><path d="M13.85 37.3Q14.75 37.1 14.7 39.1L14.45 43.8Q14.1 44.15 13.85 43.8Z" fill="${light}" opacity=".5"/></g>`;
    if(ACTIVE_SHOES){const wornLeg=right=>`<g class="qpx-leg-${right?'right':'left'}"${right?' transform="translate(32 0) scale(-1 1)"':''}><path d="M12.8 36.5Q14.05 36.15 15.3 36.6L14.95 41.9Q14.7 43.3 14.3 44.6Q13.85 44.85 13.4 44.6Q13 43.3 12.85 41.9Z" fill="${m.fill}" stroke="${edge}" stroke-width=".13"/></g>`;return s+wornLeg(false)+wornLeg(true);}
    return s+leg(false)+leg(true);
  }
  function frontNeck(topValue){
    const shape=String(topValue||'').split(':')[0];
    // The authored male garments show the inside back of the collar. The
    // wearer's neck sits in front of that rim while the front collar remains
    // visible below and to either side. This is the same torso pigment and
    // body carrier, not a separate head attachment or a second whole torso.
    if(ACTIVE_SEX!=='m'&&!['tee','hood'].includes(shape)||!['tee','hood','shirt','vest','cardi','jacket','knit','hanbok','overall'].includes(shape))return '';
    const female=ACTIVE_SEX==='f';
    const rim=female?(shape==='hood'?28.5:28.45):shape==='hood'?29.36:shape==='jacket'?29.44:shape==='hanbok'?29.11:29.1;
    const end=female?(shape==='hood'?29.05:29.60):shape==='knit'?29.36:rim+.55,m=torsoSurface(SKIN);
    // The occlusion narrows into the existing neck opening. Its lower edge
    // meets the same skin behind the transparent art, never a square patch
    // painted across the front of a V collar.
    const outline=`M${female?14.43:14.03} 25.3Q16 24.95 ${female?17.57:17.97} 25.3Q${female?17.7:18.14} 27.8 ${female?17.4:17.72} 28.45Q17.35 28.55 17.45 ${rim}Q17.35 ${rim+.18} 16.65 ${end}Q16 ${end+.12} 15.35 ${end}Q14.65 ${rim+.18} 14.55 ${rim}Q14.65 28.55 ${female?14.6:14.28} 28.45Q${female?14.3:13.86} 27.8 ${female?14.43:14.03} 25.3Z`;
    return `<g class="qpx-neck-surface" data-qpx-neck-surface="front"><path d="${outline}" fill="${m.fill}"/><path d="${outline}" fill="${m.shadow}"/></g>`;
  }
  function fittedArms(topValue,front=false){
    const shape=String(topValue||'').split(':')[0],fit=window.QPClothes?.fitFor?.(shape,ACTIVE_SEX)||window.QPClothes?.fits?.[shape]||{cuffs:[[.2,.14],[.8,.14]],short:true,sleeveless:true};if(fit.covered)return '';
    const target=window.QPClothes?.targetFor?.('top',shape,ACTIVE_SEX)||window.QPClothes?.targets?.top?.[shape]||window.QPClothes?.targets?.top?.default||[8.5,28,15,9.5],edge=shade(SKIN,-.21),shadow=shade(SKIN,-.12),light=shade(SKIN,.1);
    const side=right=>{
      const point=(fit.wristCuffs||fit.cuffs)[right?1:0],oldCx=target[0]+target[2]*point[0],oldCy=target[1]+target[3]*point[1];
      const opening=fit.openings?.[right?1:0],actual=opening?.map(([x,y])=>[target[0]+target[2]*x,target[1]+target[3]*y]);
      const cx=actual?(actual[0][0]+actual[1][0])/2:oldCx,cy=actual?(actual[0][1]+actual[1][1])/2:oldCy;
      // Work in the left-hand local space. The opening is a painted plane,
      // not a point: the arm must travel out through its normal before it
      // bends down toward the wrist (prior short-sleeve anchor or a long-sleeve
      // wrist placed below the newly measured opening).
      const localX=right?32-cx:cx,sleeveless=fit.sleeveless,rootX=sleeveless?12.7:localX;
      let wristX=sleeveless?10.95:fit.short?(right?32-oldCx:oldCx)+.32:(right?32-oldCx:oldCx),wristY=sleeveless?36.45:fit.short?Math.max(oldCy+1.1,36.45):oldCy+.48;
      const id='qpx-front-arm-'+shape+'-'+SKIN.replace('#','')+'-'+(right?'r':'l')+'-'+(front?'front':'rear');
      const pigment=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2=".18"><stop stop-color="${shadow}"/><stop offset=".38" stop-color="${SKIN}"/><stop offset=".68" stop-color="${light}"/><stop offset="1" stop-color="${shade(SKIN,-.05)}"/></linearGradient></defs>`;
      let upper,emergence='';
      if(sleeveless){
        upper=`<path d="M13.18 28.82Q11.96 29.13 11.5 30.86Q11.18 32.75 10.65 34.8L${wristX-.5} ${wristY+.1}Q${wristX} ${wristY+.36} ${wristX+.49} ${wristY+.05}Q11.86 33.08 12.3 31.72Q12.74 30.03 13.64 29.54Z" fill="url(#${id})" stroke="${edge}" stroke-width=".105"/>`;
      }else{
        const ps=actual?actual.map(([x,y])=>[right?32-x:x,y]).sort((a,b)=>a[0]-b[0]):[[localX-.82,cy-.25],[localX+.82,cy+.25]];
        const dx=ps[1][0]-ps[0][0],dy=ps[1][1]-ps[0][1],length=Math.hypot(dx,dy)||1,tx=dx/length,ty=dy/length,nx=-ty,ny=tx;
        const half=Math.min(fit.short?1.3:1.18,length*.43),depth=1.15,exit=fit.short?.92:.44;
        if(!fit.short){wristX=localX+nx*.55;wristY=cy+Math.max(.72,ny*.8);}
        const at=(along,across)=>[localX+nx*along+tx*across,cy+ny*along+ty*across];
        const rootA=at(-depth,-half),rootB=at(-depth,half),edgeA=at(0,-half),edgeB=at(0,half),leftWrist=[wristX-.43,wristY+.12],rightWrist=[wristX+.47,wristY+.08];
        const emergenceId=id+'-emergence',frontEdge=[at(.02,-4),at(.02,4),at(12,4),at(12,-4)];
        emergence=`<clipPath id="${emergenceId}"><path d="M${frontEdge.map(p=>p.join(' ')).join('L')}Z"/></clipPath>`;
        // One cubic per exposed edge lets the upper arm follow the opening
        // normal, then round smoothly into the wrist. A forced intermediate
        // point used to produce a sharp concave notch below diagonal cuffs.
        const followY=Math.max(cy+.3,wristY-.86);
        const d=`M${rootA.join(' ')}L${edgeA.join(' ')}C${at(exit,-half).join(' ')} ${wristX-.46} ${followY} ${leftWrist.join(' ')}Q${wristX} ${wristY+.38} ${rightWrist.join(' ')}C${wristX+.49} ${followY} ${at(exit,half).join(' ')} ${edgeB.join(' ')}L${rootB.join(' ')}Z`;
        // This whole, rounded skin silhouette starts well INSIDE the sleeve.
        // Only the portion beyond the native lip is visible. A small recess
        // shadow lies underneath the lip rather than across the arm surface.
        upper=`<path data-qpx-inserted-arm="${right?'right':'left'}" data-qpx-insertion-depth="${depth}" data-qpx-aperture-width="${length}" d="${d}" fill="url(#${id})" stroke="${edge}" stroke-width=".105"/><path d="M${at(.04,-half*.72).join(' ')}Q${at(.13,0).join(' ')} ${at(.04,half*.72).join(' ')}" stroke="${shade(SKIN,-.24)}" stroke-width=".15" opacity=".28" fill="none" stroke-linecap="round"/>`;
      }
      const hand=`<path d="M${wristX-.4} ${wristY-.28}Q${wristX} ${wristY-.44} ${wristX+.4} ${wristY-.22}Q${wristX+.47} ${wristY+.07} ${wristX+.55} ${wristY+.27}Q${wristX+.73} ${wristY+.61} ${wristX+.49} ${wristY+.69}L${wristX+.3} ${wristY+.56}Q${wristX+.4} ${wristY+1.06} ${wristX+.06} ${wristY+1.11}Q${wristX-.46} ${wristY+1.12} ${wristX-.49} ${wristY+.67}L${wristX-.48} ${wristY+.14}Z" fill="url(#${id})" stroke="${edge}" stroke-width=".095"/><path d="M${wristX+.24} ${wristY+.2}Q${wristX+.33} ${wristY+.32} ${wristX+.3} ${wristY+.56}M${wristX-.19} ${wristY+.81}q.08 .16 .2 .18" stroke="${shadow}" stroke-width=".085" opacity=".65" fill="none" stroke-linecap="round"/>`;
      const emerging=emergence?`<g data-qpx-emerging-arm="${right?'right':'left'}" clip-path="url(#${id}-emergence)">${upper}</g>`:'';
      const actualX=right?32-wristX:wristX,mirror=right?' transform="translate(32 0) scale(-1 1)"':'';
      // A single forearm silhouette avoids the horizontal cut where the old
      // second skin strip was painted over the source cuff.
      const paint=front?`${pigment}<defs>${emergence}</defs><g${mirror}>${emerging}</g><g class="qpx-hand-${right?'right':'left'}" data-qpx-wrist="${actualX},${wristY}" data-qpx-wrist-x="${actualX}" data-qpx-wrist-y="${wristY}" style="transform-box:view-box;transform-origin:${actualX}px ${wristY}px"><g${mirror}>${hand}</g></g>`:`${pigment}<g${mirror}>${upper}</g>`;
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
  // Separate side paintings share the existing neck/hip/ankle coordinates.
  // Frontal raster clothes remain mounted and are restored when facing front.
  let profileSerial=0;
  function clothMaterial(shape){
    if(['hanbok','robe','dress','tutu','star_skirt'].includes(shape))return 'silk';
    if(['jeans','jean_skirt','overall','cargo'].includes(shape))return 'denim';
    if(['knit','cardi'].includes(shape))return 'knit';
    if(['jacket','vest'].includes(shape))return 'wool';
    if(['space','track','legging'].includes(shape))return 'sport';
    return 'cotton';
  }
  function profileMaterial(color,skin,shape='tee',part='full'){
    const material=clothMaterial(shape),silk=material==='silk',denim=material==='denim',knit=material==='knit',gloss=silk?.34:denim?.19:knit?.22:.26;
    const id='qpx-side-'+part+'-'+(++profileSerial),edge=shade(color,-.29),light=shade(color,gloss),dark=shade(color,denim?-.2:-.16);
    return {id,color,skin,material,edge,light,dark,fill:'url(#'+id+'-cloth)',skinFill:'url(#'+id+'-skin)',softShadow:'url(#'+id+'-shadow)',softLight:'url(#'+id+'-light)',defs:`<defs><linearGradient id="${id}-cloth" x1="12" y1="30" x2="21" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="${shade(color,-.25)}"/><stop offset=".16" stop-color="${dark}"/><stop offset=".37" stop-color="${color}"/><stop offset="${silk?'.57':'.68'}" stop-color="${light}"/><stop offset=".84" stop-color="${shade(color,.09)}"/><stop offset="1" stop-color="${shade(color,-.13)}"/></linearGradient><linearGradient id="${id}-shadow"><stop stop-color="${shade(color,-.32)}" stop-opacity="0"/><stop offset=".45" stop-color="${shade(color,-.32)}" stop-opacity=".58"/><stop offset="1" stop-color="${shade(color,-.32)}" stop-opacity="0"/></linearGradient><linearGradient id="${id}-light"><stop stop-color="${shade(color,.5)}" stop-opacity="0"/><stop offset=".5" stop-color="${shade(color,.5)}" stop-opacity="${silk?'.5':'.3'}"/><stop offset="1" stop-color="${shade(color,.5)}" stop-opacity="0"/></linearGradient><linearGradient id="${id}-skin" x1="12" y1="29" x2="21" y2="37" gradientUnits="userSpaceOnUse"><stop stop-color="${shade(skin,-.14)}"/><stop offset=".6" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin,.08)}"/></linearGradient></defs>`};
  }
  // Contact shadows and broad, tapered folds stay inside the painted cloth.
  // Two soft widths give curvature without filters, grain, or extra ornaments.
  function clothRelief(m,outline,folds=[],contacts=[]){
    const id=m.id+'-relief-'+(++profileSerial),soft=m.material==='silk'?.2:.13;
    let s=`<defs><clipPath id="${id}"><path d="${outline}"/></clipPath></defs><g clip-path="url(#${id})" fill="none" stroke-linecap="round" stroke-linejoin="round" data-qpx-cloth-material="${m.material}">`;
    for(const d of folds)s+=`<path d="${d}" stroke="${m.dark}" stroke-width="${m.material==='denim'?'.85':'1.15'}" opacity=".1"/><path d="${d}" stroke="${m.dark}" stroke-width=".42" opacity=".2"/><path d="${d}" transform="translate(.23 -.14)" stroke="${m.light}" stroke-width=".4" opacity="${soft+.15}"/>`;
    for(const d of contacts)s+=`<path d="${d}" stroke="${m.edge}" stroke-width=".9" opacity=".1"/><path d="${d}" stroke="${m.edge}" stroke-width=".4" opacity=".23"/><path d="${d}" stroke="${m.edge}" stroke-width=".13" opacity=".35"/>`;
    return s+'</g>';
  }
  function sleeveMaterial(m,px,py,nx,ny){
    const id=m.id+'-round';m.fill='url(#'+id+')';
    m.defs+=`<defs><linearGradient id="${id}" x1="${px-nx*1.65}" y1="${py-ny*1.65}" x2="${px+nx*1.65}" y2="${py+ny*1.65}" gradientUnits="userSpaceOnUse"><stop stop-color="${m.dark}"/><stop offset=".28" stop-color="${m.color}"/><stop offset=".52" stop-color="${m.light}"/><stop offset=".75" stop-color="${m.color}"/><stop offset="1" stop-color="${shade(m.color,-.25)}"/></linearGradient></defs>`;
  }
  function renderProfileTorso({skin='#ffe2cc',sex='f'}={}){
    const m=torsoSurface(skin,'profile'),front=sex==='m'?19.75:19.45;
    return m.defs+`<g class="qpx-skin-torso" data-qpx-profile-body="torso">${shapePath(`M14.6 24.95Q16 24.55 17.4 24.95L17.35 27.45Q17.3 28.4 18.1 28.7Q${front} 29.1 ${front} 31.2Q${front-.25} 33.1 18.8 34.55L19.15 37.15Q16.5 37.8 13.5 37.25L13.65 33.35Q13.3 30.05 14.65 28.55Z`,m.fill,'none')}${shapePath('M14.6 26.8Q16 27.05 17.4 26.8L17.35 28.1Q17.4 28.8 18 29.25Q16 29.5 14.6 29.1Z',m.shadow,'none')}</g>`;
  }
  function renderProfileLeg(side,skin='#ffe2cc'){
    const m=profileMaterial('#e6a6c5',skin),x=side==='left'?13.85:18.15;
    return m.defs+`<g class="qpx-leg-${side}" data-qpx-profile-body="leg">${shapePath(`M${x-1.2} 36.45Q${x} 36.15 ${x+1.25} 36.55L${x+.92} 40.3Q${x+1.2} 41.55 ${x+.6} 43.3L${x+.63} 44.5Q${x+.95} 45.15 ${x+.2} 45.25Q${x-1.4} 45.4 ${x-1.38} 44.3L${x-.93} 41.65Q${x-1.17} 39.1 ${x-1.2} 36.45Z`,m.skinFill,shade(skin,-.25),.13)}${line(`M${x-.72} 38.3Q${x-.6} 40.3 ${x-.74} 41.9L${x-.95} 43.9`,shade(skin,-.13),.13)}</g>`;
  }
  function profileSkirt(m,shape,end=42.5){
    const wide=['hanbok','tutu','robe'].includes(shape),back=wide?11.2:12,front=wide?22:20.65,edge=end-.25;
    const outline=`M13.6 36Q16 35.75 18.65 36.15C18.9 38 ${front-1.35} ${end-2} ${front} ${edge}Q${front-.3} ${end+.65} 16.65 ${end+.25}Q13.6 ${end+.6} ${back} ${edge}C${back+.6} ${end-1.75} 13.1 38.1 13.6 36Z`;
    let s=shapePath(outline,m.fill,m.edge,.15);
    s+=shapePath(`M13.9 36.5Q14.5 38.8 ${back+1.6} ${end-.35}L${back+.4} ${edge}Q12.7 39.8 13.6 36.4Z`,m.softShadow,'none')+line('M13.7 36.35Q16 36.8 18.65 36.35',m.edge,.16)+line(`M${back+.35} ${edge}Q16.4 ${end+.35} ${front-.15} ${edge-.05}`,m.light,.23);
    s+=clothRelief(m,outline,[[14.8,14.25],[16.35,17],[18,front-1.2]].map(([x,f])=>`M${x} 36.85Q${x-.25} 39 ${f} ${end-.5}`),['M13.7 36.45Q16 36.95 18.65 36.45']);
    for(const [x,finish]of [[14.8,14.25],[16.35,17],[18,front-1.2]])s+=line(`M${x} 37Q${x-.3} 39 ${finish} ${end-.45}`,shade(m.color,-.2),shape==='pleat'||shape==='hanbok'?.23:.13)+line(`M${x+.25} 37.2Q${x+.2} 39.2 ${finish+.3} ${end-.55}`,m.light,.18);
    if(['skirt','hanbok','star_skirt'].includes(shape))s+=flower(front-1.7,end-1.6,'#fff0c6',.42)+flower(front-2.5,end-1.1,shade(m.color,.48),.27);
    if(shape==='star_skirt')s+=star(17.1,end-2,'#fff0c6',.45);
    if(shape==='jean_skirt')s+=line(`M18.55 37.1Q18.7 39.5 ${front-.7} ${end-.45}`,m.edge,.16)+shapePath('M16.6 37.6Q17.7 37.45 18.15 37.7L18.05 39Q17.1 39.4 16.55 38.9Z',shade(m.color,-.08),m.edge,.12);
    if(shape==='tutu')for(let y=end-2;y<end;y+=.6)s+=line(`M${back+1} ${y}Q16.1 ${y+.6} ${front-1} ${y+.15}`,shade(m.color,.37),.32);
    return s;
  }
  function renderProfileGarment(category,shape,color='#e6a6c5',sex='f',skin='#ffe2cc',ctx={}){
    color=window.QPClothes?.colorFor?.(category,shape,sex,color)||color;const part=ctx.part||'full',m=profileMaterial(color,skin,shape,part);let s=m.defs;
    if(category==='bottom'){
      if(['skirt','pleat','jean_skirt','star_skirt','tutu','hanbok'].includes(shape))return s+profileSkirt(m,shape);
      const end=shape==='shorts'?41:44.55,width=shape==='legging'?1.15:1.45;
      const hip='M13.65 36.1Q16.4 35.8 18.8 36.2C19.25 37 19.4 38.2 19.05 39.2Q18.25 39.7 17 39.45Q16.2 39.75 15.1 39.35Q13.6 39.1 13.55 38.1Q13.5 37 13.65 36.1Z';
      s+=shapePath(hip,m.fill,m.edge,.13)+clothRelief(m,hip,['M14.3 37.25Q14.75 38.15 15.1 38.8','M18.5 37.7q-.75 .2 -1.05 .7'],['M13.6 36.65Q16 37.05 18.95 36.65']);
      for(const x of part==='upper'?[]:[13.85,18.15]){
        s+=shapePath(`M${x-width} 38.1Q${x} 37.8 ${x+width} 38.2L${x+width-.1} 40.25Q${x+width+.05} 41.25 ${x+width-.25} ${end-.35}Q${x} ${end+.02} ${x-width+.2} ${end-.3}L${x-width+.22} 40.8Z`,m.fill,m.edge,.14)+line(`M${x-width+.5} 39.1Q${x-.65} 41.6 ${x-width+.48} ${end-.55}`,m.light,.2)+line(`M${x+.45} ${end-.5}l.85 -.12`,m.edge,.15);
        const legOutline=`M${x-width} 38.1Q${x} 37.8 ${x+width} 38.2L${x+width-.1} 40.25Q${x+width+.05} 41.25 ${x+width-.25} ${end-.35}Q${x} ${end+.02} ${x-width+.2} ${end-.3}L${x-width+.22} 40.8Z`;
        s+=clothRelief(m,legOutline,[`M${x-.65} 39.25q.65 .4 1.25 .1`,`M${x-.7} 41.7q.75 -.3 1.3 -.05`],[`M${x-width+.3} ${end-.48}Q${x} ${end-.2} ${x+width-.2} ${end-.48}`]);
        if(shape==='shorts')s+=(sex==='m'?'':flower(x+.45,40,'#fff0d6',.22))+line(`M${x-width+.4} ${end-.6}Q${x} ${end-.3} ${x+width-.3} ${end-.6}`,shade(color,-.25),.14);
        if(shape==='track')s+=line(`M${x+width-.25} 39L${x+width-.38} ${end-.7}`,'#fff2d9',.28);
        if(shape==='cargo')s+=shapePath(`M${x-.65} 40.1Q${x} 39.95 ${x+.65} 40.1L${x+.62} 41.4Q${x} 41.7 ${x-.65} 41.4Z`,shade(color,-.07),m.edge,.12)+line(`M${x-.6} 40.25H${x+.6}`,m.light,.18);
        if(shape==='jeans')s+=line(`M${x-.8} ${end-.55}Q${x} ${end-.32} ${x+.85} ${end-.55}`,shade(color,.39),.25)+line(`M${x-.15} 41.5l.75 -.18`,shade(color,.25),.13);
      }
      return s+line('M13.3 36.65Q16 37 19.15 36.65',m.edge,.18)+shapePath('M17 37L18.5 36.95L18.45 38.5Q17.5 38.9 16.85 38.35Z',shade(color,-.05),m.edge,.12)+line('M17.05 37.3Q17.7 37.15 18.35 37.3',m.light,.14);
    }
    const body='M14.75 28.45Q13.5 28.65 13.25 30.1L13.5 34.4Q13.25 36.2 13.1 37.55Q16.1 38.4 19.45 37.65L19 35.1Q19.25 33.7 19.85 32.3Q20.3 30.35 17.4 28.6L17.3 29.1Q15.75 29.7 14.75 28.45Z';
    const tankOutline='M14.25 28.8L15.1 29.05L15.65 31.05Q17.25 32.05 18.45 30.5L18.7 29.55L19.15 29.9L18.9 33.75L19.25 37.65Q16.1 38.3 13.3 37.7L13.55 33.15Z',clothOutline=shape==='tank'?tankOutline:body;
    const base=['vest','overall'].includes(shape)?'#fff1d7':color,b=profileMaterial(base,skin,shape,part);s+=b.defs;
    s+=shape==='tank'?shapePath(tankOutline,m.fill,m.edge,.16)+line('M15.1 29.1L15.65 31.05Q17.25 32.05 18.45 30.5',m.light,.25):shapePath(body,b.fill,b.edge,.16);
    s+=shapePath('M13.5 30.15Q13.9 32.7 13.65 35.3L13.35 37.35Q14.25 37.8 14.9 37.9L14.65 35.3Q14.25 32.8 14.35 30.15Z',b.softShadow,'none')+line('M14.75 33.5Q14.45 35.25 14.9 36.6',shade(base,.28),.14)+line('M17.25 36.2q1.1 -.45 1.6 -.2',shade(base,-.2),.09)+line('M13.4 37.35Q16.3 38 19.1 37.4',shade(base,-.22),.13);
    s+=shapePath('M14.7 30.4Q15.55 32.4 15.1 34.7Q15.6 36.7 16.9 37.6L17.3 37.6Q16 35.35 16 33.5Q15.75 31.3 14.7 30.4Z',b.softLight,'none')+shapePath('M18.9 32.6Q18.3 34.4 18.6 36.15L19.1 37.6Q18.3 37 18.15 35.5Q17.95 33.8 18.9 32.6Z',b.softShadow,'none');
    s+=clothRelief(b,clothOutline,['M14.8 31.1Q15.5 32.1 15.2 33.4','M14.3 34.8Q14.15 36.15 15.2 37.3','M17.25 35.7Q18.1 35.2 18.85 35.65'],[shape==='tank'?'M15.1 29.1L15.65 31.05Q17.25 32.05 18.45 30.5':'M14.75 28.7Q16.1 29.65 17.45 29.1','M13.8 30.1Q15.15 31.15 15.05 32.05','M13.4 37.25Q16.3 37.95 19.1 37.3']);
    if(shape==='tee')s+=line('M14.8 28.7Q16.3 29.8 17.5 29.2','#fff3d9',.26)+(sex==='m'?shapePath('M18.15 33Q18.65 32.65 18.95 33.25L18.8 33.95Q18.45 34.25 18.1 33.9Z','#e4b66c','#9b6e36',.09):flower(18.4,33.4,'#fff3bd',.46)+flower(17.8,35.9,shade(color,.46),.34));
    if(shape==='hood')s+=shapePath('M15.4 28.7Q12.2 27.1 12.3 29.8Q12.8 31 15.1 30.8Q14.1 29.6 15.4 28.7Z',m.fill,m.edge,.19)+line('M12.7 29.6Q13.55 30.3 14.9 30.1',m.light,.2)+line('M18.65 30Q19.3 33.2 18.85 37.4','#fff0c7',.15)+shapePath('M17.1 34Q18.05 33.65 19 34L18.85 36.5Q17.8 36.9 16.9 36.5Z',shade(color,.07),m.edge,.13)+line('M17.25 34.3Q18 34 18.7 34.25',m.light,.19)+line('M17.9 30l.3 1.6','#fff4d8',.16);
    if(['shirt','cardi','jacket','vest'].includes(shape)){
      if(shape==='vest')s+=shapePath('M14.6 29.8L16 30.15L18 32.5L19.1 30.7L19.6 32L19.1 37.6Q16 38.3 13.45 37.6L13.8 31.4Z',m.fill,m.edge,.17);
      s+=shapePath('M16.95 28.75L18.6 30L18 31.3L16.6 29.55Z','#fff3df',m.edge,.12)+line('M18.65 31.05Q19.3 34.3 18.95 37.35',m.edge,.2);
      for(let y=32;y<37;y+=1.4)s+=oval(18.82,y,.14,.16,'#fff0bb',m.edge,.06);
      if(shape!=='shirt')s+=shapePath('M15.25 34.35L16.85 34.3L16.9 35.75Q16 36.15 15.2 35.8Z',shade(color,-.08),m.edge,.1)+line('M15.3 34.6H16.8',m.light,.14);
      if(shape==='jacket')s+=shapePath('M17.25 29.2L18.9 30.65L17.95 32.2L16.9 30.25Z',shade(color,.16),m.edge,.13)+oval(17.5,33.1,.35,.42,'#fff0c0',m.edge,.08);
    }
    if(shape==='sailor')s+=shapePath('M14.25 28.65L16.95 28.7L18.4 30.35L18.95 32.1L17.75 31.65L15.1 30Z','#fff6e7',m.edge,.12)+line('M14.65 29L16.85 29.1L18.1 30.8',m.dark,.18)+shapePath('M18.25 31.1Q20 30.6 19.8 32L18.6 32.5L18.75 34.4L18.05 34L17.9 32.1Z','#de7999','#9f4f6b',.12);
    if(shape==='knit'){s+=line('M14.9 28.6Q16 29.3 17.45 29',m.edge,.28);for(let x=14.6;x<18.6;x+=.7)s+=line(`M${x} 30.4q-.35 .4 0 .8t0 .8t0 .8t0 .8t0 .8t0 .8`,shade(color,x<16?-.08:.15),.095);s+=line('M13.5 37.1Q16.1 37.7 19.1 37.2',m.light,.33);}
    if(shape==='hanbok')s+=clothRelief(m,body,['M14.1 32.4Q15.4 33.15 16.8 32.95'],['M16.4 29.8L18.9 32.2','M13.6 33.15Q16.2 34 18.8 33.2'])+shapePath('M14.75 28.65Q15.9 29.25 17.45 28.85L19.5 31.45L18.8 32.2L16.2 29.65Z','#fff4df',m.edge,.13)+line('M15.1 28.95Q16.4 29.6 17.35 29.2L19.1 31.45','#fffdf1',.21)+shapePath('M17 29L19.05 31.5L19.4 36.9L18.75 37.1L18.3 32L16.5 29.7Z',m.softLight,m.edge,.13)+line('M13.6 32.8Q16.2 33.8 18.8 32.9',shade(color,-.18),.18)+shapePath('M18.8 32.55Q20.1 31.9 20.15 33L19.35 33.4L19.7 36.5L18.95 36.1L18.85 33.7Q17.9 33.2 18.8 32.55Z',sex==='m'?'#dab151':'#d16a98',sex==='m'?'#956b35':'#964464',.12)+line('M19.05 33.7L19.35 35.8',sex==='m'?'#f6d785':'#f2acc8',.19)+(sex==='m'?'':flower(17.5,35.7,'#fff0c3',.3));
    if(shape==='overall')s+=shapePath('M14.1 32.2L18.95 31.55L19.15 35.9Q19.45 37.8 19.15 39.65Q17.85 40.05 16.8 39.65Q15 40.05 13.7 39.6Q13.35 38.15 13.4 36.8Z',m.fill,m.edge,.17)+shapePath('M15.8 28.9Q16.15 28.5 16.6 28.65L19.1 32L18.45 32.5Z',m.fill,m.edge,.14)+line('M16.25 29L18.65 32',m.light,.18)+shapePath('M13.6 29.25L14.25 29.3L14.75 33L14.05 33.2Z',m.dark,m.edge,.12)+oval(18.65,32.25,.22,.24,'#f7d485',m.edge,.08)+shapePath('M16.65 33.2Q17.75 32.9 18.55 33.15L18.4 35.1Q17.5 35.55 16.6 35.2Z',shade(color,.15),m.edge,.13)+line('M16.8 33.45Q17.6 33.2 18.35 33.4',m.light,.17)+line('M13.65 36.4Q16.2 36.9 19.25 36.35',m.edge,.18)+line('M16.4 37L16.8 39.4',m.edge,.14)+line('M13.75 39.3Q15 39.8 16.4 39.3M17.15 39.35Q18.15 39.65 19.1 39.3',m.light,.24)+(sex==='m'?'':flower(17.8,34.6,'#fff1bd',.27));
    if(['dress','robe'].includes(shape)){s+=profileSkirt(m,shape,shape==='robe'?40.4:39.5)+line('M13.6 35.85Q16.4 36.5 18.7 36.1','#f1d4a7',.35);if(shape==='dress')s+=shapePath('M17.5 35.7Q19.4 34.6 19.9 35.7L18.8 36.3L19.5 38.1L18.5 37.8L18.1 36.35Z','#fff0c4',m.edge,.12)+flower(18.25,37.85,'#fff4e0',.35);else s+=shapePath('M14.3 28.7Q12.15 29.8 12.7 35L11.5 39.9Q14 40.5 15.25 40.25L14.9 33.4L15.7 29.6Z',m.fill,m.edge,.18)+line('M13.7 30.2Q13.2 35.9 12.3 39.9','#f5d692',.24)+star(14.2,36.4,'#ffe9a3',.44);}
    if(shape==='space')s+=shapePath('M14.5 28.6L17.5 28.6L17.65 29.6L14.3 29.5Z','#f8eadb',m.edge,.15)+shapePath('M17.3 31Q18.4 30.7 19.1 31.4L18.9 33.7Q18 34.1 17.2 33.7Z','#f8eee1',m.edge,.15)+shapePath('M17.6 31.5L18.7 31.5L18.65 33.1L17.5 33.05Z','#75bbd1','#43728f',.1)+line('M13.6 36.7Q16 37.3 19.2 36.8','#f2e7d3',.35)+oval(18.1,35,.3,.3,'#efb66f',m.edge,.08);
    // Embroidery follows the curved side panel and leaves the front edge clear.
    // Broad highlight/shadow folds retain the softness of the painted wardrobe.
    const outline=m.id+'-panel';s+=`<defs><clipPath id="${outline}"><path d="${clothOutline}"/></clipPath></defs><g clip-path="url(#${outline})">`;
    if(sex!=='m'&&['tee','hood','dress','tank'].includes(shape))for(const [x,y,r]of [[14.3,32,.27],[15.1,34.3,.37],[17.55,32.8,.36],[18.4,36.4,.33],[14.25,36.2,.22]])s+=flower(x,y,'#fff1d6',r)+line(`M${x-.35} ${y+.45}q-.55 .15 -.25 .6`,shade(color,-.17),.1);
    if(sex!=='m'&&shape==='hanbok')s+=flower(14.7,34.7,'#fff2d5',.35)+flower(17.2,36.4,'#fbe5bb',.28)+line('M14.4 35.3q-.2 .55 .55 .6',shade(color,-.23),.1);
    if(['hood','cardi','jacket','overall'].includes(shape))s+=line('M13.7 35.6Q14.3 35.9 14.65 35.8',shade(color,-.22),.11)+line('M13.85 35.8l.65 .14',shade(color,.4),.1);
    if(shape==='tank')s+=shapePath('M18.25 30.4Q19.45 29.85 19.55 30.8L18.75 31.1L19.2 32.3L18.7 32.1L18.45 31.1Q17.6 30.7 18.25 30.4Z','#fff0d0',m.edge,.1);
    s+='</g>';if(shape==='hood')s+=oval(18.86,32.25,.12,.19,'#e8bd70',m.edge,.07);return s;
  }
  function renderProfileArm({shape='tank',color='#e6a6c5',skin='#ffe2cc',sex='f',side='right',pivot=[19.1,29.15],wrist=[21.05,36.45],fit={}}={}){
    color=window.QPClothes?.colorFor?.('top',shape,sex,color)||color;const armColor=side==='left'?shade(color,-.08):color,armSkin=side==='left'?shade(skin,-.045):skin,m=profileMaterial(armColor,armSkin,shape),[px,py]=pivot,[wx,wy]=wrist,dx=wx-px,dy=wy-py,len=Math.hypot(dx,dy)||1,nx=dy/len,ny=-dx/len;
    const sleeveless=shape==='tank'||shape==='robe'||fit.sleeveless,wide=shape==='hanbok',short=fit.short&&!sleeveless,target=window.QPClothes?.targetFor?.('top',shape,sex)||window.QPClothes?.targets?.top?.[shape]||[8.5,28,15,9.5],cuffY=target[1]+target[3]*(fit.cuffs?.[side==='right'?1:0]?.[1]||.66),t=sleeveless?0:Math.max(short?.36:.62,Math.min(.94,(cuffY-py)/(dy||1))),cx=px+dx*t,cy=py+dy*t,half=wide?1.65:shape==='space'?1:.8;
    const sm=profileMaterial(['vest','sailor','overall'].includes(shape)?(side==='left'?'#ecdac1':'#fff2dd'):armColor,armSkin,shape),startX=sleeveless?px:cx-dx/len*.95,startY=sleeveless?py:cy-dy/len*.95,skinHalf=sleeveless?.65:Math.min(1.42,half*.87);sleeveMaterial(sm,px,py,nx,ny);let s=m.defs+sm.defs;
    s+=`<g class="qpx-arm-${side}" data-qpx-arm-side="${side}" data-qpx-cuff="${cx},${cy}">${shapePath(`M${startX-nx*skinHalf} ${startY-ny*skinHalf}Q${px+dx*.62-nx*.66} ${py+dy*.62-ny*.66} ${wx-nx*.46} ${wy-ny*.46}Q${wx} ${wy+.55} ${wx+nx*.46} ${wy+ny*.46}Q${px+dx*.62+nx*.67} ${py+dy*.62+ny*.67} ${startX+nx*skinHalf} ${startY+ny*skinHalf}Z`,m.skinFill,shade(skin,-.26),.11)}${line(`M${startX-nx*.34} ${startY-ny*.34}Q${px+dx*.75-nx*.35} ${py+dy*.75-ny*.35} ${wx-nx*.24} ${wy}`,shade(skin,-.12),.12)}<g class="qpx-hand-${side}" data-qpx-wrist="${wx},${wy}" data-qpx-wrist-x="${wx}" data-qpx-wrist-y="${wy}">${shapePath(`M${wx-.47} ${wy-.22}Q${wx} ${wy-.45} ${wx+.44} ${wy-.2}L${wx+.58} ${wy+.6}Q${wx+.5} ${wy+1.15} ${wx-.05} ${wy+1.15}Q${wx-.62} ${wy+1.06} ${wx-.58} ${wy+.45}Z`,shape==='space'?'#fff2df':m.skinFill,shade(skin,-.26),.11)}${line(`M${wx-.25} ${wy+.33}L${wx-.2} ${wy+.83}`,shade(skin,-.15),.11)}</g></g>`;
    const sleeveOutline=`M${px-nx*1.14} ${py-ny*1.14}Q${px-dx*.07} ${py-1.1} ${px+nx*1.14} ${py+ny*1.14}Q${px+dx*.6+nx*(wide?1.9:1)} ${py+dy*.6+ny*(wide?1.9:1)} ${cx+nx*half} ${cy+ny*half}Q${cx} ${cy+.5} ${cx-nx*half} ${cy-ny*half}Q${px+dx*.6-nx*(wide?2:.87)} ${py+dy*.6-ny*(wide?2:.87)} ${px-nx*1.14} ${py-ny*1.14}Z`;
    if(!sleeveless)s+=`<g data-qpx-wave-sleeve="${shape}" data-qpx-clothes="top" data-qpx-profile-sleeve="${side}">${shapePath(sleeveOutline,sm.fill,sm.edge,.13)}${clothRelief(sm,sleeveOutline,[`M${px+dx*.45-nx*.6} ${py+dy*.45}Q${px+dx*.56} ${py+dy*.56-.15} ${px+dx*.63+nx*.55} ${py+dy*.63-.2}`],[`M${px+nx*.6} ${py+ny*.6+.25}Q${px+dx*.25+nx*.65} ${py+dy*.25+ny*.65} ${px+dx*.42+nx*.55} ${py+dy*.42+ny*.55}`,`M${cx-nx*half} ${cy-ny*half}Q${cx} ${cy+.4} ${cx+nx*half} ${cy+ny*half}`])}${line(`M${px-nx*.5} ${py+.2}Q${px+dx*.7-nx*.65} ${py+dy*.7} ${cx-nx*.35} ${cy-.3}`,sm.light,.2)}${line(`M${cx-nx*half} ${cy-ny*half}Q${cx} ${cy+.45} ${cx+nx*half} ${cy+ny*half}`,wide?'#fff0d4':sm.edge,.18)}${wide?line(`M${cx-nx*half} ${cy-ny*half-.35}Q${cx} ${cy+.12} ${cx+nx*half} ${cy+ny*half-.35}`,'#fff2df',.28):''}</g>`;
    if(!sleeveless){
      s+=line(`M${px+nx*.6} ${py+.35}Q${px+dx*.52+nx*.55} ${py+dy*.52} ${cx+nx*.32} ${cy-.5}`,shade(armColor,-.16),.12)+line(`M${px+dx*.5-nx*.15} ${py+dy*.5}q${nx*.5} ${ny*.5} ${nx*.75} ${ny*.75}`,sm.light,.16);
      if(sex!=='m'&&['tee','hood','hanbok'].includes(shape))s+=flower(px+dx*.65-nx*.27,py+dy*.65,'#fff0d2',wide?.26:.22);
    }
    return s;
  }
  function backMaterial(color,skin,shape='tee',part='full'){
    const m=profileMaterial(color,skin,shape,part);m.fill='url(#'+m.id+'-back)';
    m.defs+=`<defs><radialGradient id="${m.id}-back" cx="15.15" cy="31.1" r="9" gradientTransform="translate(0 -10) scale(1 1.32)" gradientUnits="userSpaceOnUse"><stop stop-color="${shade(color,m.material==='silk'?.32:.24)}"/><stop offset=".4" stop-color="${shade(color,.08)}"/><stop offset=".68" stop-color="${color}"/><stop offset="1" stop-color="${shade(color,-.23)}"/></radialGradient></defs>`;return m;
  }
  function renderBackTorso({skin='#ffe2cc',sex='f'}={}){
    const m=torsoSurface(skin,'back'),back=sex==='m'?11.6:11.9;
    return m.defs+`<g class="qpx-skin-torso" data-qpx-back-body="torso">${shapePath(`M14.6 24.95Q16 24.55 17.4 24.95L17.4 27.55Q17.5 28.35 18.15 28.7Q19.6 28.9 ${32-back} 30.1Q20.1 32.3 19.2 34.55L19.55 37.45Q16 38.4 12.45 37.45L12.8 34.55Q11.9 32.3 ${back} 30.1Q12.4 28.9 13.85 28.7Q14.5 28.35 14.6 27.55Z`,m.fill,'none')}${line('M14.1 30.8Q15.25 31.9 15.25 33M17.9 30.8Q16.75 31.9 16.75 33',shade(skin,-.1),.1)}</g>`;
  }
  function backSkirt(m,shape,end=42.5){
    const wide=['hanbok','tutu','robe'].includes(shape),x=wide?9.5:11.2,left=wide?8.5:10.35;
    const outline=`M12.6 36.1Q16 35.6 19.4 36.1C19.85 38.5 ${32-x} ${end-1.25} ${32-left} ${end-.25}Q16 ${end+.9} ${left} ${end-.25}C${x} ${end-1.25} 12.15 38.5 12.6 36.1Z`;
    let s=shapePath(outline,m.fill,m.edge,.15);
    s+=line('M12.8 36.55Q16 37.05 19.2 36.55',m.edge,.16)+shapePath(`M12.9 37Q12.65 39.4 ${left+.85} ${end-.35}Q${left+1.5} ${end} ${left+2} ${end-.1}Q14.5 39.5 14 37.1Z`,m.softShadow,'none');
    s+=clothRelief(m,outline,[[14,12.35],[15.15,14.25],[16.85,17.75],[18,19.65]].map(([a,f])=>`M${a} 37Q${a} 39 ${f} ${end-.5}`),['M12.8 36.55Q16 37.1 19.2 36.55']);
    for(const [start,finish]of [[14,12.35],[15.15,14.25],[16,16],[16.85,17.75],[18,19.65]])s+=line(`M${start} 37Q${start} 39 ${finish} ${end-.5}`,shade(m.color,-.19),shape==='pleat'||shape==='hanbok'?.2:.12)+line(`M${start+.25} 37.2Q${start+.25} 39.1 ${finish+.25} ${end-.6}`,m.light,.2);
    s+=line(`M${left+.25} ${end-.35}Q16 ${end+.45} ${32-left-.25} ${end-.35}`,m.light,.28);
    if(shape==='tutu')for(let y=end-2;y<end;y+=.6)s+=line(`M${left+.7} ${y}Q16 ${y+.7} ${32-left-.7} ${y}`,shade(m.color,.4),.34);
    if(shape==='jean_skirt')for(const cx of[13.25,18.75])s+=`<g data-qpx-back-detail="rear-pocket">${shapePath(`M${cx-.85} 37.3Q${cx} 37.55 ${cx+.85} 37.3L${cx+.7} 39Q${cx} 39.65 ${cx-.7} 39Z`,shade(m.color,-.07),m.edge,.1)}${line(`M${cx-.6} 38q.6 .4 1.2 0`,m.light,.12)}</g>`;
    if(['skirt','star_skirt','hanbok'].includes(shape))for(const cx of[left+1.45,32-left-1.45])s+=shape==='star_skirt'?star(cx,end-1.05,'#fff0c1',.32):flower(cx,end-1.05,'#fff0d2',.3);
    return `<g data-qpx-back-detail="rear-pleats">${s}</g>`;
  }
  function renderBackGarment(category,shape,color='#e6a6c5',sex='f',skin='#ffe2cc',ctx={}){
    color=window.QPClothes?.colorFor?.(category,shape,sex,color)||color;const part=ctx.part||'full',m=backMaterial(color,skin,shape,part);let s=m.defs;
    if(category==='bottom'){
      if(['skirt','pleat','hanbok','tutu','jean_skirt','star_skirt'].includes(shape))return s+backSkirt(m,shape);
      const short=shape==='shorts',end=short?41.05:44.6,width=shape==='legging'?1.25:1.65,midY=short?39.6:41,lowerY=short?40.35:43;
      const hip='M12.55 36.1Q16 35.75 19.45 36.1Q20.05 37.6 19.7 39.3Q18.6 39.9 17 39.6Q16 39.2 15 39.6Q13.4 39.9 12.3 39.3Q11.95 37.6 12.55 36.1Z';
      s+=shapePath(hip,m.fill,m.edge,.13)+clothRelief(m,hip,['M12.8 37.35q.8 .35 1.15 1.05','M19.2 37.35q-.8 .35 -1.15 1.05'],['M12.55 36.65Q16 37.15 19.45 36.65']);
      for(const cx of part==='upper'?[]:[13.85,18.15]){
        s+=shapePath(`M${cx-width} 38.3Q${cx} 37.95 ${cx+width} 38.3L${cx+width-.12} ${midY}Q${cx+width-.1} ${lowerY} ${cx+width-.35} ${end-.2}Q${cx} ${end+.18} ${cx-width+.35} ${end-.2}Q${cx-width+.1} ${lowerY} ${cx-width+.12} ${midY}Z`,m.fill,m.edge,.14)+line(`M${cx-.2} 39.7Q${cx-.5} 41.1 ${cx-.15} ${end-.6}`,shade(color,.28),.22)+line(`M${cx-width+.4} ${end-.55}Q${cx} ${end-.35} ${cx+width-.4} ${end-.55}`,m.edge,.14);
        s+=clothRelief(m,`M${cx-width} 38.3Q${cx} 37.95 ${cx+width} 38.3L${cx+width-.12} ${midY}Q${cx+width-.1} ${lowerY} ${cx+width-.35} ${end-.2}Q${cx} ${end+.18} ${cx-width+.35} ${end-.2}Q${cx-width+.1} ${lowerY} ${cx-width+.12} ${midY}Z`,[`M${cx-.7} 40.2q.75 -.35 1.3 -.1`,`M${cx-.55} 42.3q.55 .3 1.1 .08`],[`M${cx-width+.4} ${end-.5}Q${cx} ${end-.25} ${cx+width-.4} ${end-.5}`]);
        if(shape==='track')s+=line(`M${cx+(cx<16?-1:1)*(width-.3)} 39L${cx+(cx<16?-1:1)*(width-.4)} ${end-.7}`,'#fff0d1',.27);
        if(shape==='cargo')s+=shapePath(`M${cx-.8} 40.1H${cx+.8}L${cx+.7} 41.4Q${cx} 41.7 ${cx-.7} 41.4Z`,shade(color,-.08),m.edge,.12)+line(`M${cx-.65} 40.35H${cx+.65}`,m.light,.2);
      }
      s+=line('M12.2 36.65Q16 37.15 19.8 36.65',m.edge,.18)+line('M16 37.1Q15.65 38.7 16 39.5',shade(color,-.22),.16);
      if(['jeans','shorts','cargo'].includes(shape))for(const cx of[13.4,18.6])s+=`<g data-qpx-back-detail="rear-pocket">${shapePath(`M${cx-.85} 37.15Q${cx} 37.35 ${cx+.85} 37.15L${cx+.7} 38.75Q${cx} 39.3 ${cx-.7} 38.75Z`,shade(color,-.05),m.edge,.12)}${line(`M${cx-.6} 37.8q.6 .42 1.2 0`,shade(color,.32),.13)}</g>`;
      return s;
    }
    const hem=['dress','overall'].includes(shape)?39.5:shape==='robe'?40.5:shape==='knit'?36.6:['hood','cardi'].includes(shape)?37:37.65;
    const base=['vest','overall'].includes(shape)?'#fff1da':color,b=backMaterial(base,skin,shape,part);s+=b.defs;
    const silhouette=`M14.55 28.35Q16 28.65 17.45 28.35Q20.2 28.7 20.8 30.35L20 33.35Q19.6 35.1 20.15 ${hem-.2}Q16 ${hem+.65} 11.85 ${hem-.2}Q12.4 35.1 12 33.35L11.2 30.35Q11.8 28.7 14.55 28.35Z`;
    const tankOutline='M13 28.6L14.1 28.65L14.4 30.1Q16 30.5 17.6 30.1L17.9 28.65L19 28.6L19.75 32.3L19.55 37.5Q16 38 12.45 37.5L12.25 32.3Z',clothOutline=shape==='tank'?tankOutline:silhouette;
    s+=shape==='tank'?shapePath(`M13 28.6L14.1 28.65L14.4 30.1Q16 30.5 17.6 30.1L17.9 28.65L19 28.6L19.75 32.3L19.55 37.5Q16 38 12.45 37.5L12.25 32.3Z`,m.fill,m.edge,.15):shapePath(silhouette,b.fill,b.edge,.16);
    s+=shapePath(`M12.1 31Q13.1 33.1 12.8 35.3L12.25 ${hem-.45}L13.8 ${hem-.05}Q13.4 34.85 13.65 32.15Z`,b.softShadow,'none')+shapePath(`M18.35 31.1Q18.9 33 18.7 35.35L19.55 ${hem-.35}Q18.65 ${hem-.25} 18.1 ${hem-.1}Q17.7 34.5 18.35 31.1Z`,b.softShadow,'none')+line(`M15.55 31.45Q15 33.4 15.45 ${hem-1}`,shade(base,.22),.15)+line(`M16.65 32Q17.1 34 16.8 ${hem-1}`,shade(base,-.12),.1)+line(`M12.15 ${hem-.4}Q16 ${hem+.15} 19.85 ${hem-.4}`,shade(base,-.24),.13);
    s+=clothRelief(b,clothOutline,['M12.5 31.1Q14.15 31.25 14.65 32.4','M19.5 31.1Q17.85 31.25 17.35 32.4',`M13.1 ${hem-2}Q14.2 ${hem-1.45} 14.9 ${hem-1.9}`,`M18.9 ${hem-2}Q17.8 ${hem-1.45} 17.1 ${hem-1.9}`],[shape==='tank'?'M14.4 30.1Q16 30.5 17.6 30.1':'M14.5 28.65Q16 29.45 17.5 28.65','M12.2 30.2Q12.7 31.4 12.6 32.45','M19.8 30.2Q19.3 31.4 19.4 32.45',`M12.15 ${hem-.3}Q16 ${hem+.25} 19.85 ${hem-.3}`]);
    if(['tee','shirt','cardi','jacket','vest','knit','space'].includes(shape))s+=`<g data-qpx-back-detail="back-collar">${line('M14.45 28.5Q16 29.25 17.55 28.5',shape==='space'?'#f5ecdf':shade(base,-.12),shape==='knit'?.38:.24)}</g>`;
    if(['shirt','jacket','vest'].includes(shape))s+=`<g data-qpx-back-detail="back-yoke">${line('M12.15 30.4Q16 31.2 19.85 30.4',m.edge,.15)}${line('M16 30.95L16 32.3',shade(base,-.15),.15)}</g>`;
    if(shape==='hood')s+=clothRelief(m,silhouette,[],['M13.4 32.05Q16 33.4 18.6 32.05'])+`<g data-qpx-back-detail="hood">${shapePath('M13.1 28.45Q16 27.85 18.9 28.45Q19.55 30.55 18.6 32Q16 33.25 13.4 32Q12.45 30.55 13.1 28.45Z',m.fill,m.edge,.16)}${shapePath('M13.25 29.1Q13.3 31.65 16 32.4Q13.2 32.4 13.15 30.4Z',m.softShadow,'none')}${line('M16 28.65Q15.65 30.4 16 32.4',m.edge,.11)}${line('M13.7 31.5Q16 32.7 18.3 31.5',m.light,.2)}</g>`;
    if(shape==='vest')s+=shapePath(`M13.8 29.1Q16 29.85 18.2 29.1L19.15 30.5L19.6 ${hem-.2}Q16 ${hem+.4} 12.4 ${hem-.2}L12.85 30.5Z`,m.fill,m.edge,.15)+line('M16 30.2L16 36.8',m.edge,.13)+line('M13.2 35.9Q16 36.45 18.8 35.9',m.light,.18);
    if(shape==='sailor')s+=`<g data-qpx-back-detail="back-collar">${shapePath('M12.45 28.65Q16 28.9 19.55 28.65L19.35 32Q16 32.35 12.65 32Z','#fff3e1',m.edge,.16)}${line('M13.1 29.25L13.25 31.45Q16 31.75 18.75 31.45L18.9 29.25',m.dark,.19)}</g>`;
    if(shape==='knit')for(let cx=13;cx<20;cx+=.65)s+=line(`M${cx} 30q-.25 .4 0 .8t0 .8t0 .8t0 .8t0 .8t0 .8t0 .8`,shade(color,cx<16?-.08:.15),.095);
    if(shape==='hanbok')s+=clothRelief(m,silhouette,['M13.1 32.3Q14.65 32.85 15.25 32.7','M18.9 32.3Q17.35 32.85 16.75 32.7'],['M13.55 29.45Q16 30.35 18.45 29.45','M12.3 33.2Q16 33.95 19.7 33.2'])+`<g data-qpx-back-detail="back-collar">${shapePath('M14.05 28.4Q16 29.15 17.95 28.4L18.45 29.25Q16 30.2 13.55 29.25Z','#fff3df',m.edge,.12)}${line('M14.1 28.7Q16 29.45 17.9 28.7','#fffdf0',.2)}</g>`+line('M12.3 32.95Q16 33.7 19.7 32.95',m.edge,.17)+line('M16 29.85Q15.7 32.3 16 36.95',shade(color,-.15),.1)+(sex==='m'?'':flower(12.9,35.7,'#fff0d0',.3)+flower(19.1,35.7,'#fff0d0',.3));
    if(shape==='overall')s+=`<g data-qpx-back-detail="rear-straps">${shapePath('M13.75 28.8L14.55 28.7L18.1 35.5L17.15 35.75Z',m.fill,m.edge,.15)}${shapePath('M18.25 28.8L17.45 28.7L13.9 35.5L14.85 35.75Z',m.fill,m.edge,.15)}${line('M14.15 29.1L17.6 35.2M17.85 29.1L14.4 35.2',m.light,.18)}</g>`+shapePath('M12.6 35.4Q16 36 19.4 35.4L19.85 39.15Q18.25 39.9 16.45 39.4L16 38.1L15.55 39.4Q13.75 39.9 12.15 39.15Z',m.fill,m.edge,.17)+line('M12.65 36.1Q16 36.6 19.35 36.1',m.edge,.17)+`<g data-qpx-back-detail="rear-pocket">${[13.65,18.35].map(cx=>shapePath(`M${cx-.7} 36.9Q${cx} 37.1 ${cx+.7} 36.9L${cx+.6} 38.25Q${cx} 38.8 ${cx-.6} 38.25Z`,shade(color,.12),m.edge,.11)+line(`M${cx-.45} 37.55q.45 .28 .9 0`,m.light,.12)).join('')}</g>`;
    if(['dress','robe'].includes(shape))s+=backSkirt(m,shape,hem)+line('M12.3 35.8Q16 36.4 19.7 35.8','#ead4ad',.35);
    if(shape==='robe')s+=`<g data-qpx-back-detail="cape">${shapePath('M13.55 28.6Q16 29.1 18.45 28.6L20.05 32.8L21.1 39.95Q16 41.1 10.9 39.95L11.95 32.8Z',m.fill,m.edge,.19)}${line('M13.65 29.7Q13.1 34.6 12 39.8M18.35 29.7Q18.9 34.6 20 39.8','#f1d393',.25)}${line('M16 30.2Q15.5 34.7 16 39.95',m.light,.24)}${star(16,37.9,'#ffe9ad',.42)}</g>`;
    if(shape==='space')s+=`<g data-qpx-back-detail="back-panel">${shapePath('M13.9 30.5Q16 30.1 18.1 30.5L18.35 34.9Q16 35.4 13.65 34.9Z','#ede3d5',m.edge,.15)}${line('M14.2 31.2H17.8M14.1 32.4H17.9M14.1 33.6H17.9','#b6b0ac',.18)}${line('M12.4 36.5Q16 37.1 19.6 36.5','#f2e8d8',.32)}</g>`;
    return s;
  }
  function renderBackArm({shape='tank',color='#e6a6c5',skin='#ffe2cc',sex='f',side='right',pivot=[19.1,29.15],wrist=[21.05,36.45],fit={}}={}){
    color=window.QPClothes?.colorFor?.('top',shape,sex,color)||color;const m=backMaterial(color,skin,shape),[px,py]=pivot,[wx,wy]=wrist,dx=wx-px,dy=wy-py,length=Math.hypot(dx,dy)||1,nx=dy/length,ny=-dx/length,sleeveless=shape==='tank'||shape==='robe'||fit.sleeveless,wide=shape==='hanbok',short=fit.short&&!sleeveless,target=window.QPClothes?.targetFor?.('top',shape,sex)||window.QPClothes?.targets?.top?.[shape]||[8.5,28,15,9.5],cuffY=target[1]+target[3]*(fit.cuffs?.[side==='right'?1:0]?.[1]||.66),t=sleeveless?0:Math.max(short?.36:.62,Math.min(.94,(cuffY-py)/(dy||1))),cx=px+dx*t,cy=py+dy*t,half=wide?1.65:shape==='space'?1:.8,sm=backMaterial(['vest','sailor','overall'].includes(shape)?'#fff1da':color,skin,shape),sx=sleeveless?px:cx-dx/length*.95,sy=sleeveless?py:cy-dy/length*.95,skinHalf=sleeveless?.65:Math.min(1.42,half*.87);sleeveMaterial(sm,px,py,nx,ny);let s=m.defs+sm.defs;
    s+=`<g class="qpx-arm-${side}" data-qpx-arm-side="${side}" data-qpx-cuff="${cx},${cy}">${shapePath(`M${sx-nx*skinHalf} ${sy-ny*skinHalf}Q${px+dx*.65-nx*.7} ${py+dy*.65-ny*.7} ${wx-nx*.45} ${wy-ny*.45}Q${wx} ${wy+.5} ${wx+nx*.45} ${wy+ny*.45}Q${px+dx*.65+nx*.7} ${py+dy*.65+ny*.7} ${sx+nx*skinHalf} ${sy+ny*skinHalf}Z`,m.skinFill,shade(skin,-.24),.11)}<g class="qpx-hand-${side}" data-qpx-hand-surface="back" data-qpx-wrist="${wx},${wy}" data-qpx-wrist-x="${wx}" data-qpx-wrist-y="${wy}">${shapePath(`M${wx-.39} ${wy-.2}Q${wx} ${wy-.33} ${wx+.39} ${wy-.2}L${wx+.44} ${wy+.55}Q${wx+.31} ${wy+1.04} ${wx-.04} ${wy+1.05}Q${wx-.44} ${wy+1.0} ${wx-.44} ${wy+.56}Z`,shape==='space'?'#fff1df':m.skinFill,shade(skin,-.25),.11)}${line(`M${wx-.15} ${wy+.68}v.17M${wx+.1} ${wy+.68}v.17`,shade(skin,-.15),.08)}</g></g>`;
    const sleeveOutline=`M${px-nx*.96} ${py-ny*.96}Q${px} ${py-.65} ${px+nx*1.07} ${py+ny*1.07}Q${px+dx*.6+nx*(wide?1.9:1)} ${py+dy*.6+ny*(wide?1.9:1)} ${cx+nx*half} ${cy+ny*half}Q${cx} ${cy+.5} ${cx-nx*half} ${cy-ny*half}Q${px+dx*.6-nx*(wide?2:.87)} ${py+dy*.6-ny*(wide?2:.87)} ${px-nx*.96} ${py-ny*.96}Z`;
    if(!sleeveless)s+=`<g data-qpx-wave-sleeve="${shape}" data-qpx-clothes="top" data-qpx-back-sleeve="${side}">${shapePath(sleeveOutline,sm.fill,sm.edge,.13)}${clothRelief(sm,sleeveOutline,[`M${px+dx*.45-nx*.6} ${py+dy*.45}Q${px+dx*.56} ${py+dy*.56-.15} ${px+dx*.63+nx*.55} ${py+dy*.63-.2}`],[`M${px+nx*.6} ${py+ny*.6+.25}Q${px+dx*.25+nx*.65} ${py+dy*.25+ny*.65} ${px+dx*.42+nx*.55} ${py+dy*.42+ny*.55}`,`M${cx-nx*half} ${cy-ny*half}Q${cx} ${cy+.4} ${cx+nx*half} ${cy+ny*half}`])}${line(`M${px-nx*.48} ${py+.3}Q${px+dx*.7-nx*.6} ${py+dy*.7} ${cx-nx*.3} ${cy-.3}`,sm.light,.2)}${line(`M${px+dx*.5+nx*.35} ${py+dy*.5}q${-nx*.5} ${-ny*.5} ${-nx*.8} ${-ny*.8}`,sm.dark,.13)}${line(`M${cx-nx*half} ${cy-ny*half}Q${cx} ${cy+.45} ${cx+nx*half} ${cy+ny*half}`,wide?'#fff1d8':sm.edge,.18)}</g>`;
    return s;
  }
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
  function shoes(val){if(!val)return '';const {shape:s,col:c,d,l}=item('shoes',val),raster=window.QPShoes&&window.QPShoes.render(s,c,SKIN);if(raster)return `<g data-qpx-shoes="${s}" data-qpx-shoe-color="${c}" data-qps-skin="${SKIN}">${raster}</g>`;const tall=['boots','rain','hitop'].includes(s),yy=tall?41:43.5;let a='';const one=right=>{
      const p=[[12.5,yy],[15,yy],[15,yy+.25],[15.25,yy+.25],[15.25,yy+.5],[15.5,yy+.5],[15.5,45.25],[15.25,45.25],[15.25,45.5],[15,45.5],[15,45.75],[14.75,45.75],[14.75,46],[11.75,46],[11.75,45.75],[11.5,45.75],[11.5,45.5],[11.25,45.5],[11.25,45.25],[11,45.25],[11,44.75],[11.25,44.75],[11.25,44.5],[11.5,44.5],[11.5,44.25],[11.75,44.25],[11.75,44],[12.5,44]];let r=contour(p.map(([x,y])=>[right?32-x:x,y]),c);r+=poly([[12.5,yy+.5],[14.5,yy+.5],[14.5,yy+1],[15,yy+1],[15,45],[14.5,45],[14.5,45.5],[11.5,45.5],[11.5,44.5],[12.5,44.5]].map(([x,y])=>[right?32-x:x,y]),c);const xx=right?17:12;r+=rect(xx,44,.25,.5,l)+rect(right?17:11.5,45,3.5,.5,['sneaker','hitop','wing_shoes'].includes(s)?WHITE:d)+rect(right?17.25:11.75,45.625,3,.125,shade(c,-.14));if(['sneaker','hitop'].includes(s))r+=rect(right?17.5:12.5,44,1.5,.125,WHITE)+rect(right?17.75:12.75,44.5,1,.125,WHITE)+thread(right?18:13,43.5,.125,.5,l)+thread(right?18.75:12.25,44.5,.125,.375,l)+thread(right?19.625:11.5,44.75,.5,.125,l);if(tall)r+=rect(right?17.5:12.5,yy+1,2,.125,l)+rect(right?18.25:13.25,yy+1.5,.125,1.5,shade(c,.18));return r;};a+=one(false)+one(true);if(s==='wing_shoes')a+=bitmap(['ww.','www','.ww'],{w:'#ffdfa8'},8.5,42)+bitmap(['.ww','www','ww.'],{w:'#ffdfa8'},20.5,42);if(s==='ballet')a+=rect(13.5,42,.125,2,c)+rect(18.25,42,.125,2,c);return `<g data-qpx-shoes="${s}" data-qpx-shoe-color="${c}" data-qps-skin="${SKIN}">${a}</g>`;}
  const oval=(cx,cy,rx,ry,c,stroke='',weight=.18)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"${stroke?' stroke="'+stroke+'" stroke-width="'+weight+'"':''}/>`;
  const line=(d,c,width=.2)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shapePath=(d,c,edge=INK,weight=.18)=>`<path d="${d}" fill="${c}" stroke="${edge}" stroke-width="${weight}" stroke-linejoin="round"/>`;
  function heart(x,y,size,c){return shapePath(`M${x} ${y+size*.85}C${x-size*1.65} ${y-size*.25} ${x-size*.7} ${y-size*1.1} ${x} ${y-size*.35}C${x+size*.7} ${y-size*1.1} ${x+size*1.65} ${y-size*.25} ${x} ${y+size*.85}Z`,c,shade(c,-.25),.12);}
  function ribbon(x,y,c,d,l){return shapePath(`M${x-.3} ${y}C${x-5} ${y-3.2} ${x-5.4} ${y+3} ${x-.3} ${y+1}Z`,c,d)+shapePath(`M${x+.3} ${y}C${x+5} ${y-3.2} ${x+5.4} ${y+3} ${x+.3} ${y+1}Z`,c,d)+shapePath(`M${x-.8} ${y+.7}L${x-1.8} ${y+4}L${x} ${y+3.4}L${x+1.8} ${y+4}L${x+.8} ${y+.7}Z`,c,d)+oval(x,y+.4,1.05,1.05,l,d);}
  function hat(val){if(!val)return '';const {shape:s,col:c,d,l}=item('hat',val);
    if(s==='headphone'){
      const id='qpx-headphone-'+(++profileSerial),pad=shade(c,-.48);
      const cups=[false,true].map(right=>`<g${right?' transform="translate(32 0) scale(-1 1)"':''}>${shapePath('M7.3 15.9Q9.25 16.1 9.1 18.15L9.05 21.65Q8.7 23 7.25 22.6L6.55 21.1V17.4Z',pad,shade(c,-.52),.17)}${shapePath('M4.7 16.25Q6.1 15.35 7.7 16.05Q8.3 16.5 8.35 18L8.35 21.3Q7.9 22.9 6.25 22.85Q4.65 22.7 4.4 21.25L4.35 18Q4.3 16.8 4.7 16.25Z','url(#'+id+'-shell)',d,.21)}${line('M5.05 17.4Q4.85 19 5.2 21.3',l,.32)}${line('M7.65 17.15V21.55',d,.2)}${oval(6.35,19.45,.74,1.45,c,d,.13)}${line('M6.25 18.5V20.2',l,.2)}</g>`).join('');
      return `<g data-qpx-headphone-front="true"><defs><linearGradient id="${id}-shell" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="${l}"/><stop offset=".42" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>${shapePath('M5.35 18.4C4.4 8.4 8.5 2.7 16 2.6C23.5 2.7 27.6 8.4 26.65 18.4L24.85 18.3C25.55 9.4 22.1 4.6 16 4.5C9.9 4.6 6.45 9.4 7.15 18.3Z','url(#'+id+'-shell)',d,.22)}${line('M6.15 15.2Q5.95 4.05 16 3.35Q26.05 4.05 25.85 15.2',l,.24)}${line('M6.7 16.05L6.6 18.2M25.3 16.05L25.4 18.2',d,.35)}${cups}</g>`;
    }
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
  function groundY(av,verticalScale=BODY_PROPORTIONS.verticalScale){
    const shoeShape=String(av.shoes||'').split(':')[0],shoeTarget=window.QPShoes?.targets?.[shoeShape==='dress'?'loafer':shoeShape],footFloor=shoeShape?(shoeTarget?shoeTarget[1]+shoeTarget[3]:46.05):45.15;
    return 28+(footFloor-28)*verticalScale;
  }
  function composition(av,lod){
    const contactY=groundY(av);
    let s=defs()+`<g transform="scale(1 ${VIEW_H/48})">${background(av.bg,lod)}</g><ellipse class="qpx-contact-shadow" cx="16" cy="${contactY}" rx="${6.4*BODY_PROPORTIONS.scale}" ry=".7" fill="#635d6f" opacity=".22"/>`;
    s+=`<g class="qpx-idle">${headBitmap(hairTile(av),item('hair',av.hair).col,String(av.expression||'bright:0').split(':')[0],true)}<g transform="translate(16 28) scale(${BODY_PROPORTIONS.scale} ${BODY_PROPORTIONS.verticalScale}) translate(-16 -28)"><g data-qpx-body-accessory="back">${back(av.back)}</g><g transform="${ACTIVE_SEX==='m'?'translate(-.64 0) scale(1.04 1)':''}"><g class="qpx-body">${fittedArms(av.top)}${bareBody(av.top)}${bottom(av.bottom)}${shoes(av.shoes)}${top(av.top)}${frontNeck(av.top)}${fittedArms(av.top,true)}<g data-qpx-body-accessory="neck">${neck(av.neck)}</g></g></g></g><g class="qpx-head" data-qpx-head="${encodeURIComponent(JSON.stringify(av))}" data-qpx-head-sex="${ACTIVE_SEX}" data-qpx-head-skin="${SKIN}">${fullHead(av)}</g></g><g transform="translate(0 ${RIG_H-48})">${pet(av.pet)}</g>`;
    if(av.frame){const {shape,col,d,l}=item('frame',av.frame);s+=`<g transform="scale(1 ${VIEW_H/48})">${frame(shape,col,d,l)}</g>`;}return s+effect(av.effect);
  }
  // Extra viewport room protects the enlarged soles in floor-sitting poses.
  // Keep pixels per rig unit unchanged so the painted head keeps its size.
  // Legacy fixed-height actors use the ground shift from their 1.08 body rig.
  function render(av,h=180,lod=2){av=av||newAvatar();ACTIVE_SHOES=!!av.shoes;SKIN=skinFor(av.sk||0);SKIN_SHADE=shade(SKIN,-.14);ACTIVE_SEX=av.sex==='m'?'m':'f';const key=JSON.stringify(av)+'/'+h+'/'+lod+JSON.stringify(atlas);if(cache.has(key))return cache.get(key);let seed=0;const str=JSON.stringify(av);for(let i=0;i<str.length;i++)seed=(seed*31+str.charCodeAt(i))>>>0;const groundShift=groundY(av)-groundY(av,1.35*1.08);const out=`<svg xmlns="http://www.w3.org/2000/svg" class="qp-pixel-avatar qp-illustrated-avatar" data-qpx-seed="${seed%5000}" data-qpx-sex="${ACTIVE_SEX}" viewBox="0 0 32 ${VIEW_H}" width="${h*32/RIG_H}" height="${h*VIEW_H/RIG_H}" role="img" aria-label="일러스트 퀴즈 아바타" shape-rendering="geometricPrecision" style="display:block;image-rendering:auto;overflow:visible;--qpx-viewport-scale:${VIEW_H/RIG_H};--qpx-ground-shift:${groundShift};--qpx-blink-cycle:${4.1+seed%2900/1000}s">${composition(av,lod)}</svg>`;if(cache.size>280)cache.clear();cache.set(key,out);return out;}
  function thumb(cat,shape,ci,h=75,sex){if(cat==='effect'&&window.QPEffects)return window.QPEffects.thumb(shape,ci,h);ACTIVE_SHOES=cat==='shoes';SKIN=skinFor(0);SKIN_SHADE=shade(SKIN,-.14);ACTIVE_SEX=sex==='m'||sex===undefined&&typeof ME!=='undefined'&&ME&&ME.av&&ME.av.sex==='m'?'m':'f';const val=shape+':'+ci,a={sk:0,hair:ACTIVE_SEX==='m'?'short:1':'bob:1',expression:'bright:0',top:'',bottom:'',shoes:'',ear:'',neck:'',hat:'',glass:'',face:'',back:'',pet:'',bg:'',frame:''};a[cat]=val;let s=defs(),crop='0 0 32 48';if(cat==='expression'){crop='4 8 24 24';s+=facePreview(a);}else if(cat==='hair'){crop='0 1 32 38';s+=headBitmap(hairTile(a),item('hair',a.hair).col,'bright',true)+head(a);}else if(['hat','glass','face','ear'].includes(cat)){crop=cat==='hat'?(shape==='headphone'?'2 0 28 30':'2 0 28 16'):cat==='ear'?'3 22 26 12':'5 18 22 15';s+=head(a)+`<g transform="translate(0 ${cat==='hat'||cat==='ear'?4:cat==='glass'?0:6})">${({hat,glass:glasses,face:faceAccessory,ear:ears}[cat])(val)}</g>`;}else if(cat==='pet'){s+=pet(val);crop='23 35 10 13';}else if(cat==='bg')s+=background(val,2);else if(cat==='frame'){const {col,d,l}=item(cat,val);s+=frame(shape,col,d,l);}else if(cat==='back'){s+=back(val);crop='0 26 32 18';}else{s+=fittedArms(cat==='top'?val:'')+bareBody(cat==='top'?val:'')+({top,bottom,shoes,neck}[cat]||(()=>''))(val)+fittedArms(cat==='top'?val:'',true);crop=cat==='top'?'7 27 18 16':cat==='bottom'?'9 35 14 11':cat==='shoes'?'9 40 14 7':'10 26 12 11';}const [x,y,w,hh]=crop.split(' ').map(Number);return `<svg xmlns="http://www.w3.org/2000/svg" class="qp-pixel-avatar qp-illustrated-avatar" viewBox="${crop}" width="${h*w/hh}" height="${h}" shape-rendering="geometricPrecision" style="display:block;image-rendering:auto;--qpx-blink-cycle:5.4s">${s}</svg>`;}
  const expressions={bright:['반짝 미소',0,()=>expressionStencil('bright')],soft:['수줍은 미소',180,()=>expressionStencil('soft')],sparkle:['푸른 눈 웃음',240,()=>expressionStencil('sparkle')],happy:['활짝 웃음',220,()=>expressionStencil('happy')],wink:['장난스런 윙크',260,()=>expressionStencil('wink')],chic:['도도한 표정',240,()=>expressionStencil('chic')],cat:['금빛 고양이 눈',320,()=>expressionStencil('cat')],freckle:['수줍은 주근깨',220,()=>expressionStencil('freckle')]};
  const frames={garden:['꽃빛 정원 액자',720,(c,d,l)=>frame('garden',c,d,l)],moon:['달빛 별자리 액자',980,(c,d,l)=>frame('moon',c,d,l)],royal:['로열 리본 액자',1250,(c,d,l)=>frame('royal',c,d,l)],dream:['꿈방울 액자',860,(c,d,l)=>frame('dream',c,d,l)]};
  const style=document.createElement('style');style.id='qpx-avatar-motion';style.textContent=`
  @keyframes qpx-body{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.01)}}
  @keyframes qpx-head-breath{0%,100%{transform:translateY(0)}50%{transform:translateY(${-(46.05-28)*.01*BODY_PROPORTIONS.verticalScale}px)}}
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
  .qpx-hair{transform:none;animation:none}.qpx-idle{transform-box:view-box;transform-origin:16px 43px;animation:qpx-sway 8.7s ease-in-out infinite}.qpx-head,.qpx-back-hair{transform-box:view-box;transform-origin:16px 28px;animation:qpx-head-breath 6.4s ease-in-out infinite}.qpx-body{transform-box:view-box;transform-origin:16px 46.05px;animation:qpx-body 6.4s ease-in-out infinite}.qpx-arm-left,.qpx-arm-right,.qpx-arm-front-left,.qpx-arm-front-right{animation:none}.qpx-hand-left,.qpx-hand-right{animation:qpx-hands 6.4s ease-in-out infinite}.qpx-blink-half{opacity:0;animation:qpx-blink-half var(--qpx-blink-cycle,5.4s) steps(1,end) infinite}.qpx-blink-closed{opacity:0;animation:qpx-blink-closed var(--qpx-blink-cycle,5.4s) steps(1,end) infinite}.qpx-pet{animation:qpx-pet 4.8s ease-in-out infinite}.qpx-spark{animation:qpx-spark 3.4s ease-in-out infinite}
  [data-qpx-pose] :is(.qpx-idle,.qpx-body,.qpx-head,.qpx-back-hair){animation:none}
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
  window.addEventListener('qp-clothes-ready',()=>{cache.clear();document.querySelectorAll('[data-qpx-clothes]').forEach(node=>{const d=node.dataset;if(d.qpxProfileClothes||d.qpxProfileSleeve||d.qpxBackClothes||d.qpxBackSleeve||node.closest('[data-qpx-gesture-art="profile"],[data-qpx-gesture-art="back"]'))return;node.innerHTML=window.QPClothes.render(d.qpxClothes,d.clothShape,d.clothColor,d.clothSex,d.clothSkin);});});
  window.addEventListener('qp-effect-ready',()=>{cache.clear();document.querySelectorAll('[data-qpx-effect]').forEach(node=>node.innerHTML=window.QPEffects.render(node.dataset.qpxEffect));});
  window.addEventListener('qp-pets-ready',()=>cache.clear());
  window.addEventListener('qp-shoes-ready',()=>cache.clear());
  function backdrop(value){if(!value)return '';return `<svg xmlns="http://www.w3.org/2000/svg" class="qp-profile-backdrop" viewBox="0 0 32 48" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="--qpx-phase:${-performance.now()/1000}s">${background(value,3)}</svg>`;}
  window.QPAvatar={render,thumb,backdrop,frames,expressions,atlas,proportions:BODY_PROPORTIONS,renderProfileTorso,renderProfileLeg,renderProfileGarment,renderProfileArm,renderBackTorso,renderBackGarment,renderBackArm,syncArtwork:sync,clearCache:()=>cache.clear()};
})();
