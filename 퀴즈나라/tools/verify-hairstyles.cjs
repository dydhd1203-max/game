'use strict';
// Hair layer checks of the reference body (stage 3 H4; 3단계-계획.txt 'hair' 8). Demo only, nothing saved.
//   node tools/verify-hairstyles.cjs [--out 검증/머리/H4] [--base 4f75bff] [--h3 d78ebcd]     (about 6 minutes)
// --base: the commit whose renderer is "today" for the comparisons (default: main's merge-base).
//
// A  every hair style (and the old shop keys that show another painting) × front/right/left/back ×
//    skin tones 0-4 × hair colours 검정·갈색·분홍·백발, idle, 120 px: the node count of the node table
//    (tools/foundation-matrix.cjs), the head drawn from the hair layers of the right style
//    (data-foundation-head-layers, every painting an sd-hair atlas, no data-URL painting).
// B  the same in motion: walk, run, jump, nod peak, wave, happy, climb, desk and floor seats × front/right/back.
// C  neck holes against today's renderer (280 px, magenta ground, idle front/right/back): around the neck, pixels
//    that were paint today, are paint in the reference style's layers (m short, f bob: the approved neck) and
//    became background (a hole the body's neck does not cover) <= LIMIT.loss[view]. A painted second neck wider
//    than the body's is not a hole: the reference has background there too.
//    Sheets: 72 junctions at 8x on dark blue, today | layers (검증/머리/H4/목이음-<sex>-<view>.png).
// H  enclosed holes (840 px, magenta ground, idle right/back): paint today that became background which does not
//    reach the cell's edge (through pixels at least half background), in groups of HOLE_MIN px or more (single
//    antialiasing pinholes aside) around the neck: 0. It needs no reference style (C missed the hole behind the
//    ear that the reference style had too). Sheets: 48 necks at 2x, today | layers | the body alone
//    (검증/머리/H4/목큰-<sex>-<view>.png), the size that showed the seams the 280 px sheets hide.
// D  face against the upper arm (280 px, front idle, no garments, every style × tones 0-4): medians of the skin
//    between the eyes and of the upper-arm core in CIE Lab, |ΔL| <= LIMIT.dL, Δab (a*, b*) <= LIMIT.dAb (today's for
//    reference; with the basic tee the arm core takes the cream cuff).
// E  dye: one hair layer through the runtime's dye filter at 1:1 against the formula (avatar-pixel.js tonal)
//    for each colour: |error| <= 2 on opaque pixels.
// Negative controls that must fail: N1 the old paintings (layers not ready) fail A's layer probe;
//    N2 profile faces moved onto the reference (PROFILE_REGISTRATION on) fail C on the moved styles;
//    N3 the H3 layers (commit H3_LAYERS, before the hole guard of tools/hair/build-heads.py) fail H.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),L=require('./foundation-garment-lib.cjs'),H=L.H,M=require('./foundation-matrix.cjs');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const OUT=path.resolve(arg('--out',path.join(ROOT,'검증','머리','H4')));fs.mkdirSync(OUT,{recursive:true});
const REPO=path.resolve(ROOT,'..'),PREFIX=path.basename(ROOT);
const BASE=arg('--base',null)||execFileSync('git',['merge-base','HEAD','origin/main'],{cwd:REPO}).toString().trim();
// loss per view: after the H4 neck rules right/back lose at most 15 px (the registered faces' nape gap 21-35), the
// front up to 30 (today's wider jaw cut beside long hair)
const LIMIT={loss:{front:40,right:20,back:20},dL:4,dAb:3,dye:2,hole:0},HOLE_MIN=4,H3_LAYERS=arg('--h3','d78ebcd');   // dAb: the colour (a*, b*) apart from lightness; a hue angle is meaningless at light skin's low chroma (3° ≈ 0.7)
const COLOURS=[[0,'검정'],[1,'갈색'],[6,'분홍'],[11,'백발']],TONES=[0,1,2,3,4],DIRS=M.DIRECTIONS;
const STYLES=[...M.HAIRSTYLES.f.map(s=>['f',s]),...M.HAIRSTYLES.m.map(s=>['m',s])];
const HAIR=JSON.parse(fs.readFileSync(path.join(ROOT,'assets','sd-hair-data.js'),'utf8').match(/window\.QPHairData=(\{[\s\S]*\});\s*$/)[1]);
const ALIASES=Object.entries(HAIR.aliases).flatMap(([sex,a])=>Object.entries(a).filter(([k])=>!HAIR.styles[sex+':'+k]).map(([k,v])=>[sex,k,v]));
const POSES=[['walk',d=>M.actionState('walk',d,3)],['run',d=>M.actionState('run',d,2)],['jump',d=>M.actionState('jump',d,4)],['nod',d=>M.gestureState('nod',d,2)],
  ['wave',d=>M.gestureState('wave',d,3)],['happy',d=>M.gestureState('happy',d,3)],['climb',d=>M.actionState('climb',d,2)],['sit',d=>M.actionState('sit',d,0)],['floor',d=>M.actionState('floor-sit',d,0)]];
const report={tool:'verify-hairstyles',created:new Date().toISOString(),base:BASE,limits:LIMIT,checks:[],failures:[],negatives:[]};
const check=(ok,msg,detail)=>{report.checks.push({ok:Boolean(ok),msg,detail});console.log((ok?'ok   ':'FAIL ')+msg+(ok||detail===undefined?'':' '+JSON.stringify(detail).slice(0,300)));if(!ok)report.failures.push(msg);};
const negative=(failed,msg,detail)=>{report.negatives.push({failed:Boolean(failed),msg,detail});console.log((failed?'ok   (fails as it must) ':'FAIL (negative control passed) ')+msg+' '+JSON.stringify(detail).slice(0,200));if(!failed)report.failures.push('negative: '+msg);};

// ------------------------------------------------------------ page side
function cellInfo(){
  return [...document.querySelectorAll('#fg-host .fg-cell')].map(cell=>{
    const svg=cell.querySelector('svg.qp-foundation-avatar');if(!svg)return null;
    const view=[...svg.querySelectorAll('[data-foundation-head-view]')].find(v=>getComputedStyle(v).display!=='none'&&v.getBoundingClientRect().width>0)?.dataset.foundationHeadView||'front';
    const paint=svg.querySelector('[data-foundation-head-paint="'+view+'"]'),m=paint?.getScreenCTM();
    const heads=[...svg.querySelectorAll('[data-foundation-head-paint] image,[data-foundation-back-hair] image')].map(i=>i.getAttribute('href')||'');
    return{nodes:svg.querySelectorAll('*').length,cls:svg.dataset.foundationOutfit==='body'?'none|none|none':svg.dataset.foundationClass,sex:svg.dataset.qpxSex,
      layers:svg.dataset.foundationHeadLayers||'',dataUrls:heads.filter(h=>h.startsWith('data:')).length,atlases:[...new Set(heads.filter(h=>/sd-hair-/.test(h)))],
      view,ctm:m?[m.a,m.b,m.c,m.d,m.e+scrollX,m.f+scrollY]:null,svgCount:svg.querySelectorAll('svg').length};
  });
}
// ------------------------------------------------------------ helpers
const apply=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function inPoly(px,py,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)c=!c;}return c;}
function polyPixels(img,poly){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),out=[];for(let y=Math.max(0,Math.floor(Math.min(...ys)));y<Math.min(img.height,Math.ceil(Math.max(...ys)));y++)for(let x=Math.max(0,Math.floor(Math.min(...xs)));x<Math.min(img.width,Math.ceil(Math.max(...xs)));x++)if(inPoly(x+.5,y+.5,poly))out.push(y*img.width+x);return out;}
const px=(img,p)=>[img.data[p*4],img.data[p*4+1],img.data[p*4+2]];
const isMagenta=([r,g,b])=>r>235&&g<30&&b>235;
function lab([r,g,b]){const f=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};const R=f(r),G=f(g),B=f(b);
  const X=(R*.4124+G*.3576+B*.1805)/.95047,Y=R*.2126+G*.7152+B*.0722,Z=(R*.0193+G*.1192+B*.9505)/1.08883,t=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
  return[116*t(Y)-16,500*(t(X)-t(Y)),200*(t(Y)-t(Z))];}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;};
const medianRgb=list=>[0,1,2].map(k=>median(list.map(c=>c[k])));
async function session(tree){const server=await H.serve(tree);const browser=await H.launch({args:H.RASTER_ARGS});const rep={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,rep,{viewport:{width:2800,height:2000}});await L.install(page,{});
  return{page,rep,close:async()=>{await browser.close();await server.close();tree.close?.();}};}
async function grid(page,cells,{cols,size,bg,cellW,cellH}){
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols,cellW:cellW||Math.round(size*.62),cellH:cellH||Math.round(size*1.12),bg,labelW:0});
  return{g,info:await page.evaluate(cellInfo)};}
const cellsOf=(list,size)=>list.map(([sex,hair,state,sk,hc])=>({av:{sex,sk,hair:hair+':'+hc,expression:'bright:0'},state:{...state,reducedMotion:true},size}));

(async()=>{
  const t0=Date.now();
  const cur=await session(H.fsTree(ROOT));
  try{
    // ---------------------------------------------------------- A: idle matrix
    let bad=[],n=0;
    for(const sk of TONES)for(const [hc] of COLOURS){
      const list=[...STYLES,...ALIASES.map(([s,k])=>[s,k])].flatMap(([sex,hair])=>DIRS.map(d=>[sex,hair,{action:'idle',direction:d,time:0},sk,hc]));
      const {info}=await grid(cur.page,cellsOf(list,120),{cols:24,size:120});
      info.forEach((c,i)=>{n++;const [sex,hair]=list[i],want=HAIR.aliases[sex]?.[hair]&&!HAIR.styles[sex+':'+hair]?HAIR.aliases[sex][hair]:hair,exp=M.expectedNodes(c.cls,sex);
        if(c.nodes!==exp||c.layers!==sex+':'+want||c.dataUrls||c.svgCount||!c.atlases.length||c.atlases.some(a=>!a.endsWith('sd-hair-'+sex+'-'+want+'.webp')))bad.push({sex,hair,sk,hc,dir:list[i][2].direction,nodes:c.nodes,exp,layers:c.layers,dataUrls:c.dataUrls,svgs:c.svgCount,atlases:c.atlases});});
    }
    check(!bad.length,`A idle: ${n} renders (24 styles + ${ALIASES.length} old keys × 4 directions × 5 tones × 4 colours): node table count, the right style's layers, no data-URL painting, no nested svg`,bad.slice(0,4));
    // ---------------------------------------------------------- B: poses
    bad=[];n=0;
    {const list=STYLES.flatMap(([sex,hair])=>POSES.flatMap(([,f])=>['front','right','back'].map(d=>[sex,hair,f(d),2,6])));
      for(let i=0;i<list.length;i+=240){const part=list.slice(i,i+240),{info}=await grid(cur.page,cellsOf(part,120),{cols:27,size:120});
        info.forEach((c,j)=>{n++;const [sex,hair]=part[j],exp=M.expectedNodes(c.cls,sex);if(c.nodes!==exp||c.layers!==sex+':'+hair||c.dataUrls)bad.push({sex,hair,state:part[j][2],nodes:c.nodes,exp,layers:c.layers});});}}
    check(!bad.length,`B poses: ${n} renders (24 styles × ${POSES.map(p=>p[0]).join('/')} × front/right/back): node count and layers hold in motion`,bad.slice(0,4));
    // ---------------------------------------------------------- E: dye
    {// the layer's own pixels (R = L, G = shine), then the filter's output for each colour at 1:1
      const res=await cur.page.evaluate(async()=>{const e=QPHairData.styles['f:long'],[ax,ay,w,h]=e.views.front.layers.hair,im=new Image();im.src=e.file;await im.decode();
        const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,ax,ay,w,h,0,0,w,h);return{w,h,src:Array.from(x.getImageData(0,0,w,h).data)};});
      // render one colour at a time and screenshot it
      const errs=[];
      for(const [hc,name] of COLOURS){const hex=await cur.page.evaluate(i=>PAL.hair[i][0],hc);
        await cur.page.evaluate(({hex})=>{const D=QPHairData,e=D.styles['f:long'],v=e.views.front,[ax,ay,w,h]=v.layers.hair;let host=document.getElementById('dye-host');if(!host){host=document.createElement('div');host.id='dye-host';host.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;background:#000';document.body.append(host);}
          const defs=QPFoundationHead.defs({hair:hex,skin:'#ffe2cc'}).map(f=>f.outerHTML.replaceAll('qpf-template','dyeT')).join('');
          host.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><defs>${defs}</defs><g filter="url(#dyeT-hair-dye)"><image href="${e.file}" x="${-ax}" y="${-ay}" width="${e.size[0]}" height="${e.size[1]}"/></g></svg>`;},{hex});
        await cur.page.setViewportSize({width:Math.max(200,res.w),height:Math.max(200,res.h)});await cur.page.waitForTimeout(100);
        const shot=H.png.decode(await cur.page.screenshot({clip:{x:0,y:0,width:res.w,height:res.h}}));
        const dye=hex.slice(1).match(/../g).map(v=>parseInt(v,16));let worst=0,count=0,over=0;
        for(let p=0;p<res.w*res.h;p++){if(res.src[p*4+3]<255)continue;count++;const Lm=res.src[p*4],sh=res.src[p*4+1];for(let k=0;k<3;k++){const want=Math.max(0,Math.min(255,Math.round(dye[k]*Lm/102+sh))),got=shot.data[p*4+k],d=Math.abs(want-got);worst=Math.max(worst,d);if(d>LIMIT.dye)over++;}}
        errs.push({name,hex,pixels:count,worst,over});}
      await cur.page.evaluate(()=>document.getElementById('dye-host')?.remove());
      check(errs.every(e=>e.over<=e.pixels*.001),`E dye: the runtime filter against tonal() on f:long's front hair layer (${errs.map(e=>e.name+' worst '+e.worst).join(', ')}): at most 0.1 % of opaque pixels over ${LIMIT.dye}`,errs);report.dye=errs;}
    // ---------------------------------------------------------- N1: old paintings
    {await cur.page.evaluate(()=>{QPFoundationHead.atlas.ready=false;});
      const list=STYLES.slice(0,4).map(([sex,hair])=>[sex,hair,{action:'idle',direction:'front',time:0},0,1]);const {info}=await grid(cur.page,cellsOf(list,120),{cols:4,size:120});
      negative(info.every(c=>!c.layers||c.dataUrls>0),'N1 old paintings (layers not ready): A\'s layer probe',info.map(c=>({layers:c.layers,dataUrls:c.dataUrls})));
      await cur.page.evaluate(()=>{QPFoundationHead.atlas.ready=true;});}
  }finally{report.errors=cur.rep.errors;await cur.close();}

  // ---------------------------------------------------------- C, D: against today's renderer
  async function neckShots(tree,label,{small=true,big=false,body=false}={}){
    const s=await session(tree);try{
      // 840 px right/back for H, last: the body-only capture hides the head for the rest of the session
      const bigShots=async()=>{const list=STYLES.flatMap(([sex,hair])=>['right','back'].map(d=>[sex,hair,{action:'idle',direction:d,time:0},0,1]));
        const g=await grid(s.page,cellsOf(list,840),{cols:6,size:840,bg:'#ff00ff'}),img=await L.capture(s.page,g.g);let bodyImg=null;
        if(body){await s.page.addStyleTag({content:'[data-foundation-head-paint],[data-foundation-back-hair],[data-foundation-head-view]{display:none!important}'});bodyImg=await L.capture(s.page,g.g);}
        return{list,g,img,bodyImg};};
      if(!small)return{big:await bigShots()};
      const list=STYLES.flatMap(([sex,hair])=>['front','right','back'].map(d=>[sex,hair,{action:'idle',direction:d,time:0},0,1]));
      const mag=await grid(s.page,cellsOf(list,280),{cols:12,size:280,bg:'#ff00ff'});const magImg=await L.capture(s.page,mag.g,path.join(OUT,'목-'+label+'-자홍.png'));
      const blue=await grid(s.page,cellsOf(list,280),{cols:12,size:280,bg:'#1e2858'});const blueImg=await L.capture(s.page,blue.g,path.join(OUT,'목-'+label+'-파랑.png'));
      // D: face and arm at every tone
      const skins=[];for(const sk of TONES){const fl=STYLES.map(([sex,hair])=>[sex,hair,{action:'idle',direction:'front',time:0},sk,1]);
        const fg=await grid(s.page,cellsOf(fl,280).map(c=>({...c,av:{...c.av,foundationOutfit:'body'}})),{cols:12,size:280,bg:'#ff00ff'});const img=await L.capture(s.page,fg.g);
        const reg=await s.page.evaluate(spec=>__fg.regions(spec),{width:fg.g.width,height:fg.g.height});const limbs=L.dataUrlPng(reg.limbs);
        fl.forEach(([sex,hair],i)=>{const c=fg.info[i],e=HAIR.styles[sex+':'+hair].views.front,eyeY=(e.eyes[0][1]+e.eyes[1][1])/2,m=c.ctm;
          const face=polyPixels(img,[[14.6,eyeY+1.0],[17.4,eyeY+1.0],[17.4,eyeY+2.4],[14.6,eyeY+2.4]].map(p=>apply(m,p))).map(p=>px(img,p)).filter(q=>!isMagenta(q));
          const [x0,y0,w,h]=fg.g.rects[i],arm=[];for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const p=y*img.width+x;if(limbs.data[p*4]>200&&!isMagenta(px(img,p)))arm.push(px(img,p));}
          const a=lab(medianRgb(face)),b=lab(medianRgb(arm)),hue=q=>Math.atan2(q[2],q[1])*180/Math.PI;
          skins.push({sex,hair,sk,dL:+(a[0]-b[0]).toFixed(2),dAb:+Math.hypot(a[1]-b[1],a[2]-b[2]).toFixed(2),dHue:+(hue(a)-hue(b)).toFixed(2),face:medianRgb(face),arm:medianRgb(arm)});});}
      return{list,mag,magImg,blue,blueImg,skins,big:big?await bigShots():null};
    }finally{await s.close();}
  }
  const today=await neckShots(H.gitTree(REPO,BASE,PREFIX),'지금',{big:true}),now=await neckShots(H.fsTree(ROOT),'새층',{big:true,body:true});
  const h3=await neckShots(H.gitTree(REPO,H3_LAYERS,PREFIX),'H3',{small:false,big:true});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qp-hair-')),moved=path.join(tmp,'avatar-foundation-head.js');
  fs.writeFileSync(moved,fs.readFileSync(path.join(ROOT,'avatar-foundation-head.js'),'utf8').replace('const PROFILE_REGISTRATION=false;','const PROFILE_REGISTRATION=true;'));
  const reg=await neckShots(H.fsTree(ROOT,{'avatar-foundation-head.js':moved}),'맞춤');fs.rmSync(tmp,{recursive:true,force:true});
  const ZONE=[[10.5,23.5],[21.5,23.5],[21.5,30.5],[10.5,30.5]];
  // the reference style's cell of the same sex and view in the current layers (the same place in its own cell)
  const refCell=item=>now.list.findIndex(o=>o[0]===item[0]&&o[1]===HAIR.reference[item[0]]&&o[2].direction===item[2].direction);
  function losses(a,b){return a.list.map((item,i)=>{const m=b.mag.info[i].ctm,zone=polyPixels(b.magImg,ZONE.map(p=>apply(m,p))),r=refCell(item);
    const [cx,cy]=b.mag.g.rects[i],[rx,ry]=now.mag.g.rects[r],W=b.magImg.width;let loss=0;
    for(const p of zone){if(!isMagenta(px(b.magImg,p))||isMagenta(px(a.magImg,p)))continue;const x=p%W,y=(p-x)/W,q=(y-cy+ry)*now.magImg.width+(x-cx+rx);if(!isMagenta(px(now.magImg,q)))loss++;}
    return{sex:item[0],hair:item[1],view:item[2].direction,loss};});}
  const lossNow=losses(today,now),lossReg=losses(today,reg);report.neckLoss=lossNow;report.neckLossRegistered=lossReg;
  const worst=[...lossNow].sort((x,y)=>y.loss-x.loss).slice(0,5);
  check(lossNow.every(l=>l.loss<=LIMIT.loss[l.view]),`C neck holes: paint today and in the reference style that became background around the neck (72 idle views, 280 px) <= ${JSON.stringify(LIMIT.loss)} px; worst ${worst.map(w=>w.sex+':'+w.hair+' '+w.view+' '+w.loss).join(', ')}`,lossNow.filter(l=>l.loss>LIMIT.loss[l.view]));
  const regBad=lossReg.filter(l=>l.view==='right'&&l.loss>LIMIT.loss.right);
  negative(regBad.length>0,'N2 profile faces moved onto the reference (PROFILE_REGISTRATION on): C',regBad.map(l=>l.sex+':'+l.hair+' '+l.loss));
  const over=s=>Math.abs(s.dL)>LIMIT.dL||s.dAb>LIMIT.dAb,skinBad=now.skins.filter(over),todayBad=today.skins.filter(over);
  const span=list=>{const dl=list.map(s=>Math.abs(s.dL)),da=list.map(s=>s.dAb),dh=list.map(s=>Math.abs(s.dHue));return'|ΔL| max '+Math.max(...dl).toFixed(1)+' median '+median(dl).toFixed(1)+', Δab max '+Math.max(...da).toFixed(1)+' median '+median(da).toFixed(1)+', |Δhue| median '+median(dh).toFixed(1)+'°';};
  check(!skinBad.length,`D face vs upper arm (24 styles × 5 tones, front idle): ${span(now.skins)} (today ${span(today.skins)}, ${todayBad.length} over)`,skinBad.slice(0,6));
  report.skins={now:now.skins,today:today.skins};
  // ---------------------------------------------------------- H: enclosed holes at 840 px
  const see=(img,p)=>img.data[p*4]>200&&img.data[p*4+1]<128&&img.data[p*4+2]>200;
  function holes(a,b){return b.big.list.map((item,i)=>{const m=b.big.g.info[i].ctm,[cx,cy,cw,ch]=b.big.g.g.rects[i],img=b.big.img,W=img.width;
    const out=new Uint8Array(cw*ch),q=[],at=(x,y)=>(cy+y)*W+cx+x;
    const push=(x,y)=>{const k=y*cw+x;if(out[k]||!see(img,at(x,y)))return;out[k]=1;q.push(k);};
    for(let x=0;x<cw;x++){push(x,0);push(x,ch-1);}for(let y=0;y<ch;y++){push(0,y);push(cw-1,y);}
    while(q.length){const k=q.pop(),x=k%cw,y=(k-x)/cw;if(x>0)push(x-1,y);if(x<cw-1)push(x+1,y);if(y>0)push(x,y-1);if(y<ch-1)push(x,y+1);}
    const zone=new Set(polyPixels(img,ZONE.map(p=>apply(m,p))));const lost=new Uint8Array(cw*ch);
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const p=at(x,y);if(zone.has(p)&&see(img,p)&&!see(a.big.img,p)&&!out[y*cw+x])lost[y*cw+x]=1;}
    let px=0;const spots=[];
    for(let k0=0;k0<cw*ch;k0++){if(lost[k0]!==1)continue;const comp=[k0];lost[k0]=2;for(let j=0;j<comp.length;j++){const k=comp[j],x=k%cw,y=(k-x)/cw;
      for(const n of [x>0?k-1:-1,x<cw-1?k+1:-1,y>0?k-cw:-1,y<ch-1?k+cw:-1])if(n>=0&&lost[n]===1){lost[n]=2;comp.push(n);}}
      if(comp.length>=HOLE_MIN){px+=comp.length;const k=comp[0],x=cx+k%cw+.5,y=cy+(k-k%cw)/cw+.5,det=m[0]*m[3]-m[1]*m[2];
        spots.push([+((m[3]*(x-m[4])-m[2]*(y-m[5]))/det).toFixed(1),+((-m[1]*(x-m[4])+m[0]*(y-m[5]))/det).toFixed(1),comp.length]);}}
    return{sex:item[0],hair:item[1],view:item[2].direction,px,spots};});}
  const holeNow=holes(today,now),holeH3=holes(today,h3);report.holes=holeNow;report.holesH3=holeH3;
  const holeBad=holeNow.filter(h=>h.px>LIMIT.hole);
  check(!holeBad.length,`H enclosed holes around the neck (48 right/back views, 840 px, groups of ${HOLE_MIN}+ px): ${holeNow.reduce((t,h)=>t+h.px,0)} px`,holeBad);
  const h3Bad=holeH3.filter(h=>h.px>LIMIT.hole);
  negative(h3Bad.length>0,'N3 the H3 layers ('+H3_LAYERS+', no hole guard): H',h3Bad.map(h=>h.sex+':'+h.hair+' '+h.view+' '+h.px));
  // ---------------------------------------------------------- sheets: 72 junctions at 8x, today | layers
  function crop(img,poly){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);return[Math.floor(Math.min(...xs)),Math.floor(Math.min(...ys)),Math.ceil(Math.max(...xs)),Math.ceil(Math.max(...ys))];}
  const sheets={};
  now.list.forEach((item,i)=>{const key=item[0]+'-'+item[2].direction;(sheets[key]??=[]).push({i,hair:item[1]});});
  const Z=8,TILE=[[11,24],[21,24],[21,29.5],[11,29.5]];
  for(const [key,items] of Object.entries(sheets)){
    const boxes=items.map(({i})=>crop(now.blueImg,TILE.map(p=>apply(now.blue.info[i].ctm,p))));
    const bw=Math.max(...boxes.map(b=>b[2]-b[0])),bh=Math.max(...boxes.map(b=>b[3]-b[1])),cols=3,tw=(2*bw+2)*Z+12,th=bh*Z+8;
    const W=cols*tw,Hh=Math.ceil(items.length/cols)*th,out={width:W,height:Hh,data:Buffer.alloc(W*Hh*4,255)};
    items.forEach(({i},n)=>{const [x0,y0]=boxes[n],ox=(n%cols)*tw,oy=Math.floor(n/cols)*th;
      for(const [k,img] of [[0,today.blueImg],[1,now.blueImg]])for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const sx=x0+x,sy=y0+y;if(sx<0||sy<0||sx>=img.width||sy>=img.height)continue;const s=(sy*img.width+sx)*4;
        for(let dy=0;dy<Z;dy++)for(let dx=0;dx<Z;dx++){const X=ox+k*(bw+2)*Z+x*Z+dx,Y=oy+y*Z+dy,d=(Y*W+X)*4;out.data[d]=img.data[s];out.data[d+1]=img.data[s+1];out.data[d+2]=img.data[s+2];out.data[d+3]=255;}}});
    fs.writeFileSync(path.join(OUT,'목이음-'+key+'.png'),H.png.encode(out));
  }
  // ---------------------------------------------------------- big sheets: 48 necks at 840 px, today | layers | body
  {const BIG=[[10.5,23.5],[21.5,23.5],[21.5,30.5],[10.5,30.5]],groups={};
    now.big.list.forEach((item,i)=>{(groups[item[0]+'-'+item[2].direction]??=[]).push(i);});
    for(const [key,idx] of Object.entries(groups)){
      const boxes=idx.map(i=>crop(now.big.img,BIG.map(p=>apply(now.big.g.info[i].ctm,p)))),bw=Math.max(...boxes.map(b=>b[2]-b[0])),bh=Math.max(...boxes.map(b=>b[3]-b[1]));
      const Z=2,cols=2,tw=(3*bw+8)*Z+16,th=bh*Z+8,W=cols*tw,Hh=Math.ceil(idx.length/cols)*th,out={width:W,height:Hh,data:Buffer.alloc(W*Hh*4,255)};
      idx.forEach((i,n)=>{const [x0,y0]=boxes[n],ox=(n%cols)*tw,oy=Math.floor(n/cols)*th;
        for(const [k,img] of [[0,today.big.img],[1,now.big.img],[2,now.big.bodyImg]])for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const sx=x0+x,sy=y0+y;if(sx<0||sy<0||sx>=img.width||sy>=img.height)continue;const s_=(sy*img.width+sx)*4;
          for(let dy=0;dy<Z;dy++)for(let dx=0;dx<Z;dx++){const X=ox+k*(bw+4)*Z+x*Z+dx,Y=oy+y*Z+dy,d=(Y*W+X)*4;out.data[d]=img.data[s_];out.data[d+1]=img.data[s_+1];out.data[d+2]=img.data[s_+2];out.data[d+3]=255;}}});
      fs.writeFileSync(path.join(OUT,'목큰-'+key+'.png'),H.png.encode(out));}}
  report.seconds=Math.round((Date.now()-t0)/1000);report.success=!report.failures.length;
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,1));
  console.log((report.success?'PASS':'FAIL')+': '+report.checks.filter(c=>c.ok).length+'/'+report.checks.length+' checks, '+report.negatives.filter(n=>n.failed).length+'/'+report.negatives.length+' negative controls fail as they must; '+report.seconds+' s; '+path.join(OUT,'report.json'));
  process.exitCode=report.success?0:1;
})().catch(e=>{console.error(e);process.exit(1);});
