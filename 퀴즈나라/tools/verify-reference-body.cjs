'use strict';
// Reference body contract. The runtime base character (idle, basic outfit)
// is rendered per sex/view and compared pixel by pixel with the approved
// sheet assets/avatar-reference-candidates/body-study-2026-10-04.png in sheet
// space. It reads only final pixels, never the layer builder's own numbers,
// and deliberately broken renders must fail the same probes.
// Isolated studio only; Firebase is blocked.
//
// Stage 3 (WP7), garment records:
//   node tools/verify-reference-body.cjs [--garment basic,top:teehue,…] [--records <dir>] [--reference <png>]
//   --records    a directory of pipeline records (sd-garment-<stem>.js or *.json + atlases;
//                tools/foundation-garment-lib.cjs loadRecordDir); its valid records can be named by --garment
//   --garment    the outfits measured in the six idle views (default: basic). Each record is worn in
//                its slot of the basic outfit (index records, the in-page aliases top:teehue,
//                bottom:shortshue, shoes:sneakerhue, or records of --records, registered through
//                the studio's api.registerGarment) and compared with ITS reference:
//   --reference  a sheet-space image (1448×1086, a registered upload; one garment), else the
//                per-record composite: the approved sheet, where the record's slot (frozen owner
//                map) or the record's own parts are drawn again from the frozen layers bottom-up
//                (zones.json zOrder) with the record's parts at their sheet rects and the record's
//                body art (clean or legacy arms/neck); the sheet's head and hair-over-garment
//                pixels stay on top.
//                Calibration: --garment top:tee,bottom:shorts,shoes:sneaker draws the basic records
//                this way. The composite redraws the frozen layers, so for the basic's own records it
//                lands near, not exactly on, the basic's numbers (2026-10-13: top:tee m-front colour
//                .0885 vs .0863, f-front IoU .9778 vs .9785): fine for the new-garment limits below,
//                too loose for the R1 round trip, which uses --roundtrip.
//   --roundtrip  plan B R1 (records rebuilt from the template that must reproduce the basic): each
//                --garment is compared with the APPROVED SHEET itself (no composite) under R1's limits,
//                taken from the basic measured first in the same run: IoU ≥ basic − .003, colour ≤
//                basic + .003, collar ≤ 1 px, shoe offset ≤ the basic's. (The plan's 'BASE ± .003' with
//                BASE = the round-3 table below cannot be literal: today's basic itself measures f-right
//                colour .1884 against BASE .1846, inside its accepted limit .2146 but past BASE + .003.)
//   Otherwise the new-garment limits hold for every garment (accepted basic − .012 IoU, + .03 colour,
//   shoe ≤ 1.5 px, collar ≤ 3 px). The collar probe must FIND the collar in the reference and the
//   render (a top record's collar colour comes from its atlas; the basic and --roundtrip keep the
//   cream rule).
//   Controls, the 5-tone strip and the action loop run for the basic outfit.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const H=require('./verify-harness.cjs'),L=require('./foundation-garment-lib.cjs'),S=require('./garment/schema.cjs');
const ARG=H.args(),ROUNDTRIP=Boolean(ARG.roundtrip),GARMENTS=(g=>ROUNDTRIP&&!g.includes('basic')?['basic',...g]:g)(H.list(ARG.garment,['basic']));
if(ROUNDTRIP&&ARG.reference){console.error('ERROR: --roundtrip compares with the approved sheet; --reference does not apply');process.exit(2);}
// --records: every file is listed (ok / INVALID with its issues / skipped); a directory without a
// record file, or a --garment whose record there is invalid, stops the run (exit 2), never a silent skip.
const RECORDS=(()=>{let R;try{R=L.recordsOption(ARG.records);}catch(e){console.error('ERROR: '+e.message);process.exit(2);}
  if(R.dir&&!R.records.length){console.error('ERROR: --records '+R.dir+': no garment record file (sd-garment-<cat>-<shape>.js or a *.json record)');process.exit(2);}
  for(const r of R.invalid)if(r.record&&GARMENTS.includes(r.record.id)){console.error('ERROR: --garment '+r.record.id+': its record '+r.file+' is invalid: '+r.issues.map(i=>i.code+' '+(i.path||'')+': '+i.message).join(' | '));process.exit(2);}
  return R.valid;})();
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준캐릭터');
const ROOT=path.resolve(__dirname,'..'),REFERENCE=ARG.reference&&ARG.reference!==true?new URL(path.relative(ROOT,path.resolve(ARG.reference)).split(path.sep).join('/'),base).href:null;
if(REFERENCE&&GARMENTS.length!==1)throw Error('--reference belongs to one --garment');
fs.mkdirSync(out,{recursive:true});let browser;const report={success:false,errors:[],productionFirebase:false};
const SHEET='assets/avatar-reference-candidates/body-study-2026-10-04.png',PX=10,VIEWS=['front','right','back'],SEXES=['m','f'];
const ACTIONS=['idle','walk','run','floor-sit','sit','jump','climb'],GESTURES=['wave','nod','happy'];
// Limits from the accepted render (2026-10-08) with margin; see 기준캐릭터-검수.md.
// Colour difference includes the original painted head's hair where it hangs
// past the collar (the female bob), so each figure has its own ceiling: the
// accepted 2026-10-08 render plus 0.03. The male side nape keeps 3 holes
// where the original short hair's tips taper beside the sheet's neck.
const BASE={'m-front':[.9825,.088,0],'m-right':[.9657,.1217,3],'m-back':[.9854,.0736,0],'f-front':[.9783,.1514,0],'f-right':[.964,.1846,0],'f-back':[.9664,.2204,0]};
const LIMIT={iou:k=>BASE[k][0]-.012,colour:k=>BASE[k][1]+.03,neckHoles:k=>BASE[k][2]+6,shoe:1.5,collar:3,headRatio:.05,skinSpread:24,skinStep:6,residue:18};
// Plan B R1 (--roundtrip): a rebuilt record must reproduce today's basic (measured first, same run).
const R1={iou:m=>m.iou-.003,colour:m=>m.colour+.003,collar:1};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const p=await browser.newPage({viewport:{width:1100,height:900},reducedMotion:'reduce'});
 await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo */'}));
 await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});
 p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:60000});
 await p.addStyleTag({content:'html,body,main,.studio article,.large{background:transparent!important;box-shadow:none!important;border:0!important}.large{height:640px!important}.qpx-contact-shadow{display:none}'});
 const mount=(sk=0,outfit=null)=>p.evaluate(([sk,outfit])=>{const {api}=QPFoundationStudio;for(const [sex,id] of [['m','male'],['f','female']]){const h=document.getElementById(id);for(const s of h.querySelectorAll('svg'))api.destroy(s);h.innerHTML=api.render({sex,foundationOutfit:'basic',sk,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',...(outfit?{foundationGarments:outfit[sex]}:{})},560);}},[sk,outfit]);
 const svgOf=sex=>'#'+(sex==='m'?'male':'female')+' svg';
 async function shoot(sex,view,tamper){
  await p.evaluate(([sel,view,tamper])=>{const svg=document.querySelector(sel);QPFoundationStudio.api.apply(svg,{action:'idle',direction:view,time:0,phase:0});
   for(const e of svg.querySelectorAll('[data-tamper]')){e.removeAttribute('transform');e.removeAttribute('data-tamper');}
   if(tamper){const e=svg.querySelector(tamper.selector);e.setAttribute('transform',tamper.transform);e.setAttribute('data-tamper','1');}},[svgOf(sex),view,tamper||null]);
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  return (await p.locator(svgOf(sex)).screenshot({omitBackground:true})).toString('base64');
 }
 await mount(0);
 // Load the sheet and its figure anchors inside the page; all measuring is
 // done there on canvas pixels.
 await p.evaluate(async src=>{
  const w=document.getElementById('runtime').contentWindow,data=(w.QPFoundationReferenceData||window.QPFoundationReferenceData);
  const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
  window.__sheet=window.__ref={data,w:im.width,h:im.height,px:x.getImageData(0,0,im.width,im.height).data,img:im};window.__collarEdges=null;
 },new URL(SHEET,base).href);
 const measure=(sex,view,png,label)=>p.evaluate(async([sex,view,png,PX,label])=>{
  const R=window.__ref,F=R.data.figures[sex+'-'+view],im=new Image();im.src='data:image/png;base64,'+png;await im.decode();
  // Sheet <- render: local units scale k, body 1.593, stage 1.0627 about the floor.
  const s=1/(F.k*1.593*1.0627*PX),c=document.createElement('canvas');c.width=R.w;c.height=R.h;const x=c.getContext('2d');x.imageSmoothingQuality='high';
  const ox=F.neck[0]-16*PX*s,oy=F.floor-56.75*PX*s;x.drawImage(im,ox,oy,im.width*s,im.height*s);const cur=x.getImageData(0,0,R.w,R.h).data,ref=R.px;
  const W=R.w,at=(a,X,Y)=>a.subarray((Y*W+X)*4,(Y*W+X)*4+4),cx=Math.round(F.neck[0]),collar=Math.round(F.neck[1]),floor=Math.round(F.floor);
  // Collar cream (기준캐릭터-조사 colors: base #fcf2da, shade #f5ddbe) vs skin
  // (#f9d2bb, highlight #fbe0cd): the cream is less red over green.
  const cream=q=>q[3]>128&&q[1]>210&&q[0]-q[1]<=25&&q[1]-q[2]>=20;
  // A top record (window.__collarEdges: its own top edge rows per probe column, from its atlas): the
  // render's collar is found by aligning a 3-column strip of the render with the reference's around
  // that edge (rows edge-14…edge+14, shifts -10…+10, any garment colour); FOUND only when the best
  // shift is clearly better than the others (cost ≤ .6 × their median).
  const edges=window.__collarEdges?.[sex+'-'+view]||null;
  const flatPx=(a,X,Y)=>{const q=at(a,X,Y),w=q[3]/255;return[q[0]*w+128*(1-w),q[1]*w+128*(1-w),q[2]*w+128*(1-w)];};
  const align=(X,edge)=>{const costs=[];for(let s=-10;s<=10;s++){let c=0;for(let Y=edge-14;Y<=edge+14;Y++)for(let dx=-1;dx<=1;dx++){const p=flatPx(ref,X+dx,Y),q=flatPx(cur,X+dx,Y+s);c+=Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2]);}costs.push({s,c});}
    const best=costs.reduce((m,v)=>v.c<m.c?v:m),others=costs.filter(v=>Math.abs(v.s-best.s)>2).map(v=>v.c).sort((p,q)=>p-q),median=others[others.length>>1];return best.c<=.6*median?edge+best.s:NaN;};
  // 1. Body silhouette and colour below the collar.
  let inter=0,union=0,differ=0;
  for(let Y=collar+4;Y<=floor+3;Y++)for(let X=cx-120;X<=cx+120;X++){const a=at(ref,X,Y),b=at(cur,X,Y),A=a[3]>128,B=b[3]>128;if(A&&B)inter++;if(A||B){union++;
   const flat=(q,k)=>q[k]*q[3]/255+128*(1-q[3]/255);if(Math.abs(flat(a,0)-flat(b,0))+Math.abs(flat(a,1)-flat(b,1))+Math.abs(flat(a,2)-flat(b,2))>60)differ++;}}
  // 2. Shoes: centroid of the opaque pixels in the bottom 26 rows per foot.
  const shoe=a=>{const halves=view==='right'?[[cx-120,cx+120]]:[[cx-120,cx],[cx,cx+120]];return halves.map(([l,r])=>{let n=0,sx=0,sy=0;for(let Y=floor-26;Y<=floor+3;Y++)for(let X=l;X<r;X++)if(at(a,X,Y)[3]>128){n++;sx+=X;sy+=Y;}return n?[sx/n,sy/n]:[NaN,NaN];});};
  const rs=shoe(ref),cs=shoe(cur),shoeOffset=Math.max(...rs.map((q,i)=>Math.hypot(q[0]-cs[i][0],q[1]-cs[i][1])));
  // 3. Neck: first collar row under the chin, and holes where the sheet's
  // chin/neck/collar is opaque but the render is not.
  // Scan up from the shirt: the top of the first cream run is the collar edge
  // (scanning down from the face met skin highlights first).
  // Front/back: either side of the centre (the peter-pan collar meets in a V).
  // Per side (one column in profile), the first column 10, 8, 12, 6 or 14 px off the centre where the collar
  // is found in both the reference and the render (at -10 px the cream rule finds no collar on the boy's
  // front, in the sheet or the render: measured 2026-10-13); a side with no such column is NOT found
  // (never the silent offset 0 of before).
  const rowAt=(a,X)=>{let Y=collar+30;while(Y>collar-40&&!cream(at(a,X,Y)))Y--;if(Y<=collar-40)return NaN;while(Y>collar-40&&cream(at(a,X,Y-1)))Y--;return Y;};
  const pair=(o)=>edges?{r:edges[o]??NaN,c:Number.isFinite(edges[o])?align(cx+o,edges[o]):NaN}:{r:rowAt(ref,cx+o),c:rowAt(cur,cx+o)};
  const sides=view==='right'?[[0]]:[[-10,-8,-12,-6,-14],[10,8,12,6,14]],probe=sides.map(offs=>{for(const o of offs){const q=pair(o);if(Number.isFinite(q.r)&&Number.isFinite(q.c))return{o,...q};}return{o:offs[0],...pair(offs[0])};});
  const rc=probe.map(q=>q.r),cc=probe.map(q=>q.c),collarCols=probe.map(q=>q.o),collarFound=rc.every(Number.isFinite)&&cc.every(Number.isFinite),collarOffset=collarFound?Math.max(0,...rc.map((v,i)=>Math.abs(v-cc[i]))):Infinity;
  let neckHoles=0;for(let Y=collar-24;Y<=collar+8;Y++)for(let X=cx-18;X<=cx+18;X++)if(at(ref,X,Y)[3]>200&&at(cur,X,Y)[3]<128)neckHoles++;
  // Residue inside hair: a pale or greyed (desaturated, unlike warm hair
  // highlights) render pixel mostly enclosed by hair
  // (cut-off neck stubs of a head painting, a pale patch in a strand). It
  // reads the render only, so it applies to any future hairstyle.
  // The sheet's own count (skin seen between strand tips) is the allowance.
  const lum=q=>.3*q[0]+.59*q[1]+.11*q[2];
  const residue=img=>{const px=[];for(let Y=collar-40;Y<=collar+6;Y++)for(let X=cx-60;X<=cx+60;X++){const b=at(img,X,Y),mx=Math.max(b[0],b[1],b[2]),grey=(mx-Math.min(b[0],b[1],b[2]))/Math.max(mx,1)<.42;if(b[3]<200||!(lum(b)>150||lum(b)>105&&grey))continue;
   let hair=0,n=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const q=at(img,X+dx,Y+dy);n++;if(q[3]>200&&lum(q)<110)hair++;}
   if(hair/n>=.6)px.push([X,Y]);}return px;};
  const residuePx=residue(cur),hairResidue=residuePx.length,sheetResidue=residue(ref).length;
  // 4. Head silhouette width (widest row above the chin).
  const headWidth=a=>{let best=0;for(let Y=collar-260;Y<collar-30;Y++){let l=-1,r=-1;for(let X=cx-200;X<=cx+200;X++)if(at(a,X,Y)[3]>128){if(l<0)l=X;r=X;}if(l>=0)best=Math.max(best,r-l);}return best;};
  // Labelled side-by-side tiles for the record.
  const tile=document.createElement('canvas'),box=[cx-185,collar-300,370,floor-collar+320];tile.width=box[2]*2+10;tile.height=box[3];const t=tile.getContext('2d');
  // Keep each tile to its own sheet row (the male row sits above the female).
  const top=sex==='f'?555:0,bottom=sex==='m'?555:R.h;t.fillStyle='#eef1f5';t.fillRect(0,0,tile.width,tile.height);t.save();t.beginPath();t.rect(0,top-box[1],tile.width,bottom-top);t.clip();
  t.drawImage(R.img,box[0],box[1],box[2],box[3],0,0,box[2],box[3]);t.drawImage(c,box[0],box[1],box[2],box[3],box[2]+10,0,box[2],box[3]);t.restore();
  if(label){t.font='bold 22px sans-serif';t.fillStyle='#25313d';t.fillText(label,10,26);}
  return {iou:inter/union,colour:differ/union,shoeOffset,collarRows:{ref:rc,render:cc,columns:collarCols},collarFound,collarOffset,neckHoles,hairResidue,sheetResidue,residuePx,head:{ref:headWidth(ref),render:headWidth(cur)},tile:tile.toDataURL('image/png')};
 },[sex,view,png,PX,label]);
 // Idle in all six views, per garment: the basic outfit against the approved sheet; any other
 // record against its reference (--reference, a registered sheet-space upload) or, by default, its
 // composite: the approved sheet's layers with the record's parts in its slot (sheetComposite).
 const registered=await L.registerInStudio(p,{aliases:L.ALIASES.filter(x=>GARMENTS.includes(x.id)),records:RECORDS});report.registered=registered;
 report.garments={};
 for(const garment of GARMENTS){
  const basic=garment==='basic',stem=basic?'':'-'+S.stem(garment)+(ROUNDTRIP?'-r1':''),r1=ROUNDTRIP&&!basic;
  const rec=basic?null:await p.evaluate(id=>QPFoundationStudio.garments().find(r=>r.id===id)||null,garment);
  if(!basic&&!rec)throw Error('--garment '+garment+': not an index record, an alias ('+L.ALIASES.map(x=>x.id).join(', ')+') or a --records record');
  const outfit=basic?null:Object.fromEntries(await Promise.all(SEXES.map(async sex=>[sex,await p.evaluate(([id,sex])=>{const G=QPFoundationStudio.runtime.QPFoundationGarments,r=QPFoundationStudio.garments().find(x=>x.id===id),set=Object.fromEntries(G.SLOTS.map((s,i)=>[s,G.starter(sex)[i]]));set[r.slot]=id;return set;},[garment,sex])])));
  await mount(0,outfit);
  const info=await p.evaluate(async([id,rec,ref])=>{
   if(!id){window.__ref=window.__sheet;window.__collarEdges=null;return{reference:'approved sheet'};}
   const G=QPFoundationStudio.runtime.QPFoundationGarments,S=window.__sheet,W=S.w,Hh=S.h;
   const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error('cannot load '+src));i.src=src;});
   const pixels=img=>{const c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,W,Hh).data;};
   let px,kind;
   if(ref){px=pixels(await load(ref));kind='registered upload '+ref.slice(0,60);}
   else{
    // The approved sheet's layers bottom-up (tools/garment/frozen/zones.json zOrder): neck, legs, shoes,
    // shorts, shirt, arms, sleeves; the record's slot drawn from its atlas parts at their sheet rects (the
    // basic layer stays for a sex the record does not have); a top's own body art (clean or legacy arms
    // and neck); then the sheet's head (owner map 8) and the hair over garments (hair-occlusion) on top.
    const top=rec.slot==='top',clean=top&&(G.get(id,'m')||G.get(id,'f'))?.bodyArt==='clean',A=n=>load('assets/sd-foundation-ref-'+n+'.png');
    const [neck,legs,arms,shirt,sleeves,shorts,shoes,owner,hair]=await Promise.all([A(clean?'neck-clean':'neck'),A('legs'),A(clean?'arms-clean':'arms'),A('shirt'),A('sleeves'),A('shorts'),A('shoes'),load('tools/garment/frozen/owner-map.png'),load('tools/garment/frozen/hair-occlusion.png')]);
    const c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d'),pc=document.createElement('canvas');pc.width=W;pc.height=Hh;const px2=pc.getContext('2d');
    const rows={m:[0,555],f:[555,Hh-555]};
    const layer=(img,slot,parts)=>{if(rec.slot!==slot){x.drawImage(img,0,0);return;}
     for(const sex of ['m','f']){x.save();x.beginPath();x.rect(0,rows[sex][0],W,rows[sex][1]);x.clip();const g=G.get(id,sex);
      if(!g)x.drawImage(img,0,0);else for(const q of parts(g))for(const t of [x,px2])t.drawImage(g.image,q.at[0],q.at[1],q.rect[2],q.rect[3],q.rect[0],q.rect[1],q.rect[2],q.rect[3]);x.restore();}};
    const figs=g=>Object.values(g.figures);
    x.drawImage(neck,0,0);x.drawImage(legs,0,0);
    layer(shoes,'shoes',g=>figs(g).flatMap(f=>f.shoes||[]));layer(shorts,'bottom',g=>figs(g).map(f=>f.bottom).filter(Boolean));layer(shirt,'top',g=>figs(g).map(f=>f.top?.torso).filter(Boolean));
    x.drawImage(arms,0,0);layer(sleeves,'top',g=>figs(g).flatMap(f=>f.top?.sleeves||[]));
    // The sheet itself wherever the swap cannot change it: a pixel owned (frozen owner map) by none of the
    // record slot's labels (top: shirt 1, sleeve 2; bottom: shorts 4; shoes: shoe 6) and not covered by
    // the record's own parts keeps the approved sheet's pixel (background, neck, other garments as drawn
    // there; the frozen layers' hidden stubs under the chin never show); the head (owner 8) and the hair
    // over garments (hair-occlusion) always do.
    const own={top:[1,2],bottom:[4],shoes:[6]}[rec.slot],img=x.getImageData(0,0,W,Hh),d=img.data,o=pixels(owner),h=pixels(hair),pa=px2.getImageData(0,0,W,Hh).data;
    for(let i=0;i<d.length;i+=4)if(o[i]===8||h[i]>0||!own.includes(o[i])&&pa[i+3]===0){d[i]=S.px[i];d[i+1]=S.px[i+1];d[i+2]=S.px[i+2];d[i+3]=S.px[i+3];}
    x.putImageData(img,0,0);px=d;kind='composite of the sheet layers with '+id+' (body art '+(clean?'clean':'legacy')+')';
    window.__compositeUrl=c.toDataURL('image/png');}
   const refImg=await load(ref||window.__compositeUrl);
   window.__ref={...S,px,img:refImg};
   // The collar of a top record: its top edge row at each probe column, from its own atlas (the
   // torso part's topmost opaque pixel at that sheet column). measure() then finds the render's
   // collar by aligning the render's column with the reference's around that edge (any colour).
   // The basic outfit keeps the cream rule (its accepted numbers).
   window.__collarEdges=null;
   if(rec.slot==='top'){const edges={};for(const sex of ['m','f']){const g=G.get(id,sex);if(!g)continue;const c=document.createElement('canvas'),im=g.image;c.width=im.naturalWidth||im.width;c.height=im.naturalHeight||im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const a=x.getImageData(0,0,c.width,c.height).data;
     for(const [view,f] of Object.entries(g.figures)){const F=S.data.figures[sex+'-'+view],t=f.top?.torso;if(!t)continue;const e={};
      for(const o of view==='right'?[0]:[-14,-12,-10,-8,-6,6,8,10,12,14]){const X=Math.round(F.neck[0])+o-t.rect[0];if(X<0||X>=t.rect[2])continue;for(let y=0;y<t.rect[3];y++)if(a[((t.at[1]+y)*c.width+t.at[0]+X)*4+3]>128){e[o]=t.rect[1]+y;break;}}
      edges[sex+'-'+view]=e;}}
    window.__collarEdges=edges;}
   return{reference:kind,collarEdges:window.__collarEdges};
  },[basic||r1?null:garment,rec,REFERENCE]);
  // The composite itself is kept for review (sheet space, both sexes).
  if(!basic&&!r1&&!REFERENCE){const url=await p.evaluate(()=>window.__compositeUrl);fs.writeFileSync(path.join(out,'기준-합성'+stem+'.png'),Buffer.from(url.split(',')[1],'base64'));}
  const views={},tiles=[];
  for(const sex of SEXES)for(const view of VIEWS){
   const m=await measure(sex,view,await shoot(sex,view),(sex==='m'?'남':'여')+' '+{front:'앞',right:'옆',back:'뒤'}[view]+'  '+(basic?'기준':r1?'기준 (R1)':'기준 합성')+' | 렌더'+(basic?'':' · '+garment));
   tiles.push(m.tile);delete m.tile;views[sex+'-'+view]=m;
  }
  // Record the side-by-side image before judging, so a failure can be seen.
  fs.writeFileSync(path.join(out,'기준-대조'+stem+'.png'),await p.evaluate(async tiles=>{
   const ims=await Promise.all(tiles.map(async u=>{const i=new Image();i.src=u;await i.decode();return i;}));const w=ims[0].width,h=Math.max(...ims.map(i=>i.height));
   const c=document.createElement('canvas');c.width=w*3+40;c.height=h*2+30;const x=c.getContext('2d');x.fillStyle='#eef1f5';x.fillRect(0,0,c.width,c.height);
   ims.forEach((im,i)=>x.drawImage(im,(i%3)*(w+20),Math.floor(i/3)*(h+30)));return c.toDataURL('image/png').split(',')[1];
  },tiles),'base64');
  report.garments[garment]={reference:info.reference+(r1?' (R1 round trip)':''),collarEdges:info.collarEdges,views,limits:r1?'R1: basic (same run) ± .003, collar ≤ 1 px, shoe ≤ basic':(basic?'accepted basic':'new garment')+': BASE − .012 IoU / + .03 colour, collar ≤ 3 px, shoe ≤ 1.5 px'};if(basic)report.views=views;
  for(const [key,m] of Object.entries(views)){
   const [sex,view]=key.split('-'),where=garment+' '+sex+'-'+view+' '+JSON.stringify({...m,residuePx:undefined});
   const lim=r1?{iou:R1.iou(report.views[key]),colour:R1.colour(report.views[key]),shoe:report.views[key].shoeOffset+1e-9,collar:R1.collar}:{iou:LIMIT.iou(key),colour:LIMIT.colour(key),shoe:LIMIT.shoe,collar:LIMIT.collar};
   report.garments[garment].views[key].limits=lim;
   assert(m.iou>=lim.iou,'body silhouette differs from the reference '+(r1?'(R1 IoU ≥ '+lim.iou.toFixed(4)+') ':'')+where);
   assert(m.colour<=lim.colour,'body colours differ from the reference '+(r1?'(R1 colour ≤ '+lim.colour.toFixed(4)+') ':'')+where);
   assert(m.shoeOffset<=lim.shoe,'shoes not on the reference feet '+where);
   // The collar must be FOUND in the reference and in the render (a missing collar read as offset 0 before).
   assert(m.collarFound,'collar not found (reference '+JSON.stringify(m.collarRows.ref)+', render '+JSON.stringify(m.collarRows.render)+') '+where);
   assert(m.collarOffset<=lim.collar,'chin-to-collar distance differs '+where);
   assert(m.neckHoles<=LIMIT.neckHoles(key),'transparent holes at chin/neck/collar '+where);
   assert(m.hairResidue<=m.sheetResidue+LIMIT.residue,'pale or grey residue inside the hair at the nape '+where+' '+JSON.stringify(m.residuePx.slice(0,20)));
  }
  for(const sex of SEXES)for(const view of ['right','back']){
   const v=views[sex+'-'+view].head,f=views[sex+'-front'].head,ref=v.ref/f.ref,render=v.render/f.render;
   views[sex+'-'+view].headRatio={ref,render};assert(Math.abs(ref-render)<=LIMIT.headRatio,'head width ratio '+garment+' '+sex+'-'+view+' '+ref.toFixed(3)+' vs '+render.toFixed(3));
  }
  // Control of the record collar probe (the first top record): its shirt lowered by .6 u in the render
  // MUST fail it (found further than the limit, or not found).
  if(!basic&&rec.slot==='top'&&!report.recordCollarControl){const m=await measure('m','front',await shoot('m','front',{selector:'[data-outfit-part="shirt-torso"]',transform:'translate(0 .6)'}));await shoot('m','front');
   report.recordCollarControl={garment,collarFound:m.collarFound,collarOffset:m.collarOffset,rows:m.collarRows};assert(!m.collarFound||m.collarOffset>LIMIT.collar,'a lowered shirt must fail the record collar probe '+JSON.stringify(report.recordCollarControl));}
 }
 await mount(0);await p.evaluate(()=>{window.__ref=window.__sheet;window.__collarEdges=null;});
 // Broken controls: a slipped shirt and a raised head must fail the probes.
 const slipped=await measure('m','front',await shoot('m','front',{selector:'[data-foundation-part="torso"]',transform:'translate(1.2 0)'}));
 const raised=await measure('m','front',await shoot('m','front',{selector:'[data-foundation-head]',transform:'translate(0 -1.4)'}));
 report.controls={slippedShirt:{colour:slipped.colour,iou:slipped.iou},raisedHead:{collarOffset:raised.collarOffset,neckHoles:raised.neckHoles}};
 assert(slipped.colour>LIMIT.colour('m-front')||slipped.iou<LIMIT.iou('m-front'),'a slipped shirt must fail the body probe');
 assert(raised.collarOffset>LIMIT.collar||raised.neckHoles>LIMIT.neckHoles('m-front'),'a raised head must fail the neck probe');
 await shoot('m','front');
 // Skin tones: neck, forearm and shin share one tone; tones stay distinct.
 report.skins={};const strip=[];
 for(let sk=0;sk<5;sk++){
  await mount(sk);
  for(const sex of SEXES){
   const png=await shoot(sex,'front');strip.push(png);
   report.skins[sex+sk]=await p.evaluate(async([sex,png,PX])=>{
    const R=window.__ref,F=R.data.figures[sex+'-front'],im=new Image();im.src='data:image/png;base64,'+png;await im.decode();
    const s=1/(F.k*1.593*1.0627*PX),c=document.createElement('canvas');c.width=R.w;c.height=R.h;const x=c.getContext('2d');x.drawImage(im,F.neck[0]-16*PX*s,F.floor-56.75*PX*s,im.width*s,im.height*s);
    const mean=(X,Y,r)=>{const d=x.getImageData(Math.round(X-r),Math.round(Y-r),2*r+1,2*r+1).data;let n=0,t=[0,0,0];for(let i=0;i<d.length;i+=4)if(d[i+3]>240){n++;for(let k=0;k<3;k++)t[k]+=d[i+k];}return t.map(v=>v/Math.max(n,1));};
    const J=F.joints,mid=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    // Same points on the sheet: the painted shading (chin shadow on the neck)
    // is part of the design, so each patch is judged against the sheet's.
    const sheet=(X,Y,r)=>{let n=0,t=[0,0,0];for(let y=Math.round(Y-r);y<=Math.round(Y+r);y++)for(let x=Math.round(X-r);x<=Math.round(X+r);x++){const i=(y*R.w+x)*4;if(R.px[i+3]>240){n++;for(let k=0;k<3;k++)t[k]+=R.px[i+k];}}return t.map(v=>v/Math.max(n,1));};
    const at={neck:[F.neck[0],F.neck[1]+4,3],arm:[...mid(J.elbow[0],J.wrist[0],.75),2],leg:[...mid(J.knee[0],J.ankle[0],.4),3]};
    const out={};for(const [k,v] of Object.entries(at)){out[k]=mean(...v);out['sheet_'+k]=sheet(...v);}
    return out;
   },[sex,png,PX]);
  }
 }
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(const sex of SEXES){const tones=[0,1,2,3,4].map(sk=>report.skins[sex+sk]);
  // Neck and leg relative to the forearm keep the sheet's relation (scaled by
  // the tone's brightness), so no limb or the neck turns a different skin.
  for(const [sk,t] of tones.entries()){const scale=t.arm.reduce((a,v)=>a+v,0)/t.sheet_arm.reduce((a,v)=>a+v,0),rel=(p,q)=>p.map((v,i)=>v-q[i]);
   const spread=Math.max(dist(rel(t.neck,t.arm),rel(t.sheet_neck,t.sheet_arm).map(v=>v*scale)),dist(rel(t.leg,t.arm),rel(t.sheet_leg,t.sheet_arm).map(v=>v*scale)));
   t.spread=spread;assert(spread<=LIMIT.skinSpread,'skin patches disagree '+sex+sk+' '+JSON.stringify(t));}
  for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)assert(dist(tones[a].arm,tones[b].arm)>=LIMIT.skinStep,'skin tones '+a+' and '+b+' look the same '+sex);
 }
 await mount(0);
 // Every action, gesture and direction renders finite geometry on a fixed
 // node set (no duplicated or missing body parts).
 report.actions=await p.evaluate(([ACTIONS,GESTURES])=>{
  // Geometry attributes only: base64 image data can contain "NaN".
  const {api}=QPFoundationStudio,res={},bad=svg=>[...svg.querySelectorAll('*')].some(e=>[...e.attributes].some(a=>!/href$/.test(a.name)&&/NaN|Infinity/.test(a.value)));
  for(const sel of ['#male svg','#female svg']){const svg=document.querySelector(sel);api.apply(svg,{action:'idle',direction:'front',time:0});const nodes=svg.querySelectorAll('*').length;let samples=0;
   for(const direction of ['front','right','left','back']){
    for(const action of ACTIONS)for(let k=0;k<8;k++){api.apply(svg,{action,direction,phase:k/8,time:k*.2,grounded:k%2===0,vy:k%3?-300:200});const n=svg.querySelectorAll('*').length;if(n!==nodes||bad(svg))throw Error('broken render '+JSON.stringify({sel,direction,action,k,nodes,n}));samples++;}
    for(const gesture of GESTURES)for(let k=0;k<6;k++){api.apply(svg,{action:'idle',direction,gesture,gestureProgress:k/5,time:0});const n=svg.querySelectorAll('*').length;if(n!==nodes||bad(svg))throw Error('broken render '+JSON.stringify({sel,direction,gesture,k,nodes,n}));samples++;}
   }
   api.apply(svg,{action:'idle',direction:'front',time:0});res[sel]={nodes,samples};}
  return res;
 },[ACTIONS,GESTURES]);
 fs.writeFileSync(path.join(out,'피부색-5종.png'),await p.evaluate(async strip=>{
  const ims=await Promise.all(strip.map(async u=>{const i=new Image();i.src='data:image/png;base64,'+u;await i.decode();return i;}));const w=ims[0].width,h=ims[0].height;
  const c=document.createElement('canvas');c.width=w*10;c.height=h;const x=c.getContext('2d');x.fillStyle='#eef1f5';x.fillRect(0,0,c.width,c.height);
  ims.forEach((im,i)=>x.drawImage(im,i*w,0));return c.toDataURL('image/png').split(',')[1];
 },strip),'base64');
 assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.failure=e.stack||String(e);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
 console.log(JSON.stringify({success:report.success,failure:report.failure,views:report.views&&Object.fromEntries(Object.entries(report.views).map(([k,v])=>[k,{iou:+v.iou.toFixed(4),colour:+v.colour.toFixed(4),shoe:+v.shoeOffset.toFixed(2),collar:v.collarOffset,holes:v.neckHoles,residue:[v.hairResidue,v.sheetResidue],head:v.headRatio}])),controls:report.controls,actions:report.actions},null,1));
});
