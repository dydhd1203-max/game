/* Existing catalog tee/hood adapter. Preserve the original bodice and small
 * sleeve motion; use authored raised-sleeve art for large lifts. The sewn
 * shoulder stays on the torso while the opening follows the arm joints.
 * Original wardrobe PNGs are never edited. */
(function(){
  'use strict';
  const setAttributeIfChanged=(node,key,value)=>{value=String(value);if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
  const NS='http://www.w3.org/2000/svg',cache=new Map(),clippedSources=new WeakMap();
  function relative(from,to){
    if(window.QPAvatarLocalTransform)return window.QPAvatarLocalTransform.relative(from,to);
    const a=from.getCTM(),b=to.getCTM();return a&&b?b.inverse().multiply(a):null;
  }
  function placeSequence(parent,nodes,before=null){
    for(let i=nodes.length-1;i>=0;i--){const node=nodes[i];if(node.parentNode!==parent||node.nextSibling!==before)parent.insertBefore(node,before);before=node;}
  }
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const rotate=(p,a,c)=>{a*=Math.PI/180;const x=p[0]-c[0],y=p[1]-c[1];return[c[0]+x*Math.cos(a)-y*Math.sin(a),c[1]+x*Math.sin(a)+y*Math.cos(a)];};
  function triangle(ctx,img,a,b,c){
    const[x0,y0]=a.s,[x1,y1]=b.s,[x2,y2]=c.s,[u0,v0]=a.d,[u1,v1]=b.d,[u2,v2]=c.d,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
    const aa=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,bb=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
    ctx.save();ctx.beginPath();const center=[(u0+u1+u2)/3,(v0+v1+v2)/3];for(const[p,i]of[a.d,b.d,c.d].map((p,i)=>[p,i])){const dx=p[0]-center[0],dy=p[1]-center[1],l=Math.hypot(dx,dy)||1,q=[p[0]+dx/l*.8,p[1]+dy/l*.8];if(i)ctx.lineTo(...q);else ctx.moveTo(...q);}ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,u0-aa*x0-cc*y0,v0-bb*x0-dd*y0);ctx.drawImage(img,img.sourceX||0,img.sourceY||0);ctx.restore();
  }
  const definitions={
    'm/tee':{rect:[530,30,222,245],root:[554,139],mouth:[[716,148],[670,72]],patch:'M532 105Q551 155 551 202L574 249Q667 212 752 174V30H532Z'},
    'm/hood':{rect:[1220,0,290,315],root:[1240,176],mouth:[[1443,78],[1376,47]],patch:'M1221 136Q1240 211 1236 306L1370 310L1510 170V0H1280L1280 130Z'},
    'f/tee':{rect:[530,510,222,257],root:[552,616],mouth:[[717,622],[669,547]],patch:'M532 578Q551 635 551 700L575 749Q668 696 752 653V510H532Z'},
    'f/hood':{rect:[1230,490,290,290],root:[1271,653],mouth:[[1463,548],[1394,521]],patch:'M1238 600Q1258 687 1276 771L1403 770L1520 628V490H1310L1310 600Z'}
  };
  const atlas={ready:false,error:null},sources=new Map();
  const ready=QPAvatarImage.load(new URL('assets/sd-wardrobe-wave.png',document.currentScript.src).href).then(img=>{
    for(const[key,d]of Object.entries(definitions)){
      const [sx,sy,w,h]=d.rect,c=document.createElement('canvas');c.width=w;c.height=h;c.sourceX=sx;c.sourceY=sy;const ctx=c.getContext('2d');ctx.save();ctx.translate(-sx,-sy);ctx.clip(new Path2D(d.patch));ctx.drawImage(img,0,0);ctx.restore();const raw=document.createElement('canvas');raw.width=c.width;raw.height=c.height;raw.sourceX=sx;raw.sourceY=sy;const rc=raw.getContext('2d');rc.drawImage(c,0,0);const rp=rc.getImageData(0,0,c.width,c.height);for(let i=3;i<rp.data.length;i+=4)if(rp.data[i]>240)rp.data[i]=255;rc.putImageData(rp,0,0);
      // Blend only the sewn-in edge. The outer cuff/underarm silhouette keeps
      // its original alpha; no feathering of a free edge into the background.
      const px=ctx.getImageData(0,0,c.width,c.height);
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(px.data[i+3]>240)px.data[i+3]=255;const distance=x+sx-(d.root[0]-16+(key.endsWith('tee')?.20:.12)*(y+sy-d.root[1]));if(distance<28)px.data[i+3]*=smooth(distance/28);}
      ctx.putImageData(px,0,0);sources.set(key,{raw,sewn:c});
    }atlas.ready=true;window.dispatchEvent(new CustomEvent('qp-cloth-mesh-ready'));return true;
  }).catch(e=>{atlas.error=e.message;return false;});
  function supports(top){return ['tee','hood'].includes(top?.dataset.clothShape);}
  function prepare(rig){
    if(rig.clothMesh)return rig.clothMesh;
    const top=rig.top;if(!supports(top))return null;
    const image=document.createElementNS(NS,'image');for(const[k,v]of Object.entries({x:0,y:18,width:32,height:26,preserveAspectRatio:'none','data-qpx-continuous-cloth':top.dataset.clothShape}))setAttributeIfChanged(image,k,v);
    const carrier=document.createElementNS(NS,'g');setAttributeIfChanged(carrier,'data-qpx-cloth-carrier','continuous');carrier.style.display='none';carrier.append(image);rig.idle.append(carrier);
    return rig.clothMesh={top,image,carrier,original:top.querySelector('.qpc-garment'),angles:{}};
  }
  function draw(rig){
    const m=prepare(rig);if(!m)return;
    const front=(rig.svg.dataset.qpxView||'front')==='front',active=atlas.ready&&front&&[...rig.gestureArms?.values()||[]].some(a=>a.visible);
    m.carrier.style.display=active?'':'none';if(m.original)m.original.style.display=active?'none':'';
    for(const arm of rig.gestureArms?.values()||[])for(const s of arm.sleeves||(arm.sleeves=[...arm.carrier.querySelectorAll('[data-qpx-wave-sleeve]')]))s.style.display=active?'none':'';
    if(!active){reset(rig);return;}
    if(!m.hands)m.hands=[];
    const sex=m.top.dataset.clothSex||rig.svg.dataset.qpxSex,shape=m.top.dataset.clothShape;
    const art=QPClothes.surface('top',shape,m.top.dataset.clothColor,sex,rig.head.dataset.qpxHeadSkin);if(!art)return;
    const arms=['left','right'].map(side=>rig.gestureArms.get(side)),angles=arms.map(a=>(a?.meshAngles||[0,0]).map(n=>Math.round(n/2)*2));
    const key=[sex,shape,m.top.dataset.clothColor,art.revision,...angles.flat()].join(':');
    let url=cache.get(key);
    if(!url){
      const c=document.createElement('canvas');c.width=512;c.height=416;let ctx=c.getContext('2d');const [tx,ty,tw,th]=art.target;
      const canvasPoint=p=>[p[0]*16,(p[1]-18)*16],nativePoint=(x,y,side=1)=>[side?tx+tw*x:32-tx-tw*x,ty+th*y];
      const opening=QPClothes.fitFor(shape,sex).openings;
      function seamPath(side){
        const coords=shape==='hood'?[[.73,.30],[.77,.4],[.785,.61],[.815,.88]]:[[.70,.14],[.76,.28],[.775,.49],[.805,.69]];
        const a=coords.map(p=>nativePoint(...p,side)),edge=side?32:0;
        if(shape==='hood'){
          const start=nativePoint(sex==='m'?.755:.735,sex==='m'?.405:.235,side),outside=nativePoint(.94,sex==='m'?.34:.24,side);
          return new Path2D('M'+start.join(' ')+'Q'+a[1].join(' ')+' '+a[2].join(' ')+'L'+a[3].join(' ')+'H'+edge+'V'+outside[1]+'L'+outside.join(' ')+'Z');
        }
        return new Path2D('M'+a[0][0]+' 18L'+a[0].join(' ')+'Q'+a[1].join(' ')+' '+a[2].join(' ')+'L'+a[3].join(' ')+'H'+edge+'V18Z');
      }
      // The intact torso is drawn once. Sleeve masks end beyond the entire
      // cuff, not across its middle as the old gesture-body mask did.
      ctx.save();ctx.scale(16,16);ctx.translate(0,-18);ctx.drawImage(art.canvas,tx,ty,tw,th);ctx.globalCompositeOperation='destination-out';for(const side of[0,1])ctx.fill(seamPath(side));ctx.restore();const bodice=document.createElement('canvas');bodice.width=c.width;bodice.height=c.height;bodice.getContext('2d').drawImage(c,0,0);
      for(const side of[0,1]){
        const a=arms[side];if(!a)continue;const[shoulder,elbow]=angles[side],lift=side?Math.max(0,-shoulder):0,t=side?smooth((lift-30)/20):0;
        // Small motion retains the exact original sleeve; its sewn cap is
        // pinned rather than rotated away with the cuff.
        let clips=clippedSources.get(art.canvas);
        if(!clips||clips.revision!==art.revision){clips={revision:art.revision,parts:[]};clippedSources.set(art.canvas,clips);}
        if(!clips.parts[side]){
          const part=document.createElement('canvas');part.width=512;part.height=416;const pc=part.getContext('2d');pc.scale(16,16);pc.translate(0,-18);pc.clip(seamPath(side));pc.drawImage(art.canvas,tx,ty,tw,th);
          const pixels=pc.getImageData(0,0,512,416).data;let x0=512,y0=416,x1=0,y1=0;
          for(let y=0;y<416;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
          // Keep the identical 1 × .65 rig-unit mesh and a full-cell fringe.
          // Only triangles whose source is entirely transparent are omitted.
          clips.parts[side]={part,minCol:Math.max(0,Math.floor(x0/16)-1),maxCol:Math.min(32,Math.ceil((x1+1)/16)+1),minRow:Math.max(0,Math.floor(y0/10.4)-1),maxRow:Math.min(40,Math.ceil((y1+1)/10.4)+1)};
        }
        const {part,minCol,maxCol,minRow,maxRow}=clips.parts[side];
        if(t<1){
          const vs=[],cols=maxCol-minCol,rows=maxRow-minRow;
          for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
            const p=[col+minCol,18+(row+minRow)*26/40],inward=side?a.pivot[0]-p[0]:p[0]-a.pivot[0];
            const pin=smooth((inward+.3)/1.0)*(1-smooth((p[1]-a.pivot[1])/2.1));
            const ew=shape==='tee'?0:smooth((p[1]-a.elbow[1]+.5)/1),b=rotate(p,elbow,a.elbow),bend=[p[0]+(b[0]-p[0])*ew,p[1]+(b[1]-p[1])*ew],q=rotate(bend,shoulder,a.pivot);
            vs.push({s:canvasPoint(p),d:canvasPoint([q[0]+(p[0]-q[0])*pin,q[1]+(p[1]-q[1])*pin])});
          }
          ctx.globalAlpha=1-t;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+1,d=a+cols+1,e=d+1;triangle(ctx,part,vs[a],vs[b],vs[e]);triangle(ctx,part,vs[a],vs[e],vs[d]);}ctx.globalAlpha=1;
        }
        if(t){
          const d=definitions[sex+'/'+shape],textures=sources.get(sex+'/'+shape),endpoints=opening[side].map(([x,y])=>[tx+tw*x,ty+th*y]);
          const targets=endpoints.map(p=>rotate(shape==='tee'?p:rotate(p,elbow,a.elbow),shoulder,a.pivot));
          // The drawn raised cuff maps to the actual sleeve aperture; the
          // source shoulder maps to the shared shoulder pivot.
          const ss=[d.root,...d.mouth],dd=[a.pivot,...targets];
          const[x0,y0]=ss[0],[x1,y1]=ss[1],[x2,y2]=ss[2],den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
          const point=p=>{const u=((p[0]-x0)*(y2-y0)-(x2-x0)*(p[1]-y0))/den,v=((x1-x0)*(p[1]-y0)-(p[0]-x0)*(y1-y0))/den;return[dd[0][0]+u*(dd[1][0]-dd[0][0])+v*(dd[2][0]-dd[0][0]),dd[0][1]+u*(dd[1][1]-dd[0][1])+v*(dd[2][1]-dd[0][1])];};
          const finalContext=ctx,layers=[];
          for(const src of[textures.raw,textures.sewn]){
            const layer=document.createElement('canvas');layer.width=c.width;layer.height=c.height;ctx=layer.getContext('2d');
          if(shape==='tee'){
            const pit=[d.root[0]+21,d.root[1]+101],wanted=[a.pivot[0]+.95,a.pivot[1]+1.6],vs=[],cols=24,rows=24;
            const bottom=d.mouth[0],v1=[bottom[0]-d.root[0],bottom[1]-d.root[1]],v2=[pit[0]-d.root[0],pit[1]-d.root[1]],area=v1[0]*v2[1]-v2[0]*v1[1];
            // Two affine cloth panels share the root-to-cuff edge. This keeps
            // a positive mesh area instead of folding a smooth displacement
            // field back over itself at the raised armpit.
            for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
              const p=[d.root[0]-30+x*235/cols,d.root[1]-100+y*245/rows],delta=[p[0]-d.root[0],p[1]-d.root[1]],v=(v1[0]*delta[1]-delta[0]*v1[1])/area;let q=point(p);
              if(v>0){const u=(delta[0]*v2[1]-v2[0]*delta[1])/area;q=[a.pivot[0]+u*(targets[0][0]-a.pivot[0])+v*(wanted[0]-a.pivot[0]),a.pivot[1]+u*(targets[0][1]-a.pivot[1])+v*(wanted[1]-a.pivot[1])];}
              vs.push({s:p,d:canvasPoint(q)});
            }
            ctx.globalAlpha=1;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+1,d=a+cols+1,e=d+1;triangle(ctx,src,vs[a],vs[b],vs[e]);triangle(ctx,src,vs[a],vs[e],vs[d]);}ctx.globalAlpha=1;
          }else{
            const p0=canvasPoint(point([0,0])),px=canvasPoint(point([1,0])),py=canvasPoint(point([0,1]));ctx.save();ctx.globalAlpha=1;ctx.setTransform(px[0]-p0[0],px[1]-p0[1],py[0]-p0[0],py[1]-p0[1],...p0);ctx.drawImage(src,src.sourceX||0,src.sourceY||0);ctx.restore();
          }
            layers.push(layer);
          }
          const raw=layers[0].getContext('2d'),sewn=layers[1].getContext('2d');raw.globalCompositeOperation='destination-out';raw.drawImage(bodice,0,0);sewn.globalCompositeOperation='destination-in';sewn.drawImage(bodice,0,0);raw.globalCompositeOperation='lighter';raw.drawImage(layers[1],0,0);ctx=finalContext;ctx.globalAlpha=t;ctx.drawImage(layers[0],0,0);ctx.globalAlpha=1;

        }
      }
      url=c.toDataURL();cache.set(key,url);if(cache.size>160)cache.delete(cache.keys().next().value);
    }
    if(m.image.getAttribute('href')!==url)setAttributeIfChanged(m.image,'href',url);
    const t=relative(rig.upper,rig.idle);if(t)setAttributeIfChanged(m.carrier,'transform','matrix('+[t.a,t.b,t.c,t.d,t.e,t.f].join(' ')+')');
    placeSequence(rig.idle,[...arms.filter(Boolean).map(arm=>arm.carrier),m.carrier],rig.headPose);
    if(!m.hands.length)for(const arm of arms)if(arm)for(const frame of arm.hands){
      if(!frame.closest('[data-qpx-pose-part$="gesture-forearm"]')||frame.closest('[data-qpx-gesture-art]')?.dataset.qpxGestureArt!=='front')continue;
      const hand=frame.firstElementChild;if(!hand)continue;const owner=document.createElementNS(NS,'g');owner.dataset.qpxClothHand=arm===arms[1]?'right':'left';owner.append(hand);rig.idle.append(owner);m.hands.push({hand,frame,owner});
    }
    for(const{frame,owner}of m.hands){const t=relative(frame,rig.idle);if(t)setAttributeIfChanged(owner,'transform','matrix('+[t.a,t.b,t.c,t.d,t.e,t.f].join(' ')+')');}
    placeSequence(rig.idle,m.hands.map(h=>h.owner));
    // Move the single original neck overlay above the fabric; never duplicate
    // the body or paint a rectangle over the head.
    if(!m.neck){const neck=rig.upper.querySelector('.qpx-neck-surface');if(neck){m.neck=neck;m.neckParent=neck.parentNode;m.neckNext=neck.nextSibling;m.carrier.append(neck);}}
  }
  function reset(rig){const m=rig.clothMesh;if(!m)return;m.carrier.style.display='none';for(const h of m.hands||[]){h.frame.append(h.hand);h.owner.remove();}m.hands=[];if(m.original)m.original.style.display='';if(m.neck){m.neckParent.insertBefore(m.neck,m.neckNext?.parentNode===m.neckParent?m.neckNext:null);m.neck=null;}for(const arm of rig.gestureArms?.values()||[])for(const s of arm.carrier.querySelectorAll('[data-qpx-wave-sleeve]'))s.style.display='';}
  function destroy(rig){reset(rig);rig.clothMesh?.carrier.remove();delete rig.clothMesh;}
  window.QPClothMesh={supports,draw,reset,destroy,atlas,whenReady:()=>ready};
})();
