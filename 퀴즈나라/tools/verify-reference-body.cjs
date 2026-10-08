'use strict';
// Reference body contract. The runtime base character (idle, basic outfit)
// is rendered per sex/view and compared pixel by pixel with the approved
// sheet assets/avatar-reference-candidates/body-study-2026-10-04.png in sheet
// space. It reads only final pixels, never the layer builder's own numbers,
// and deliberately broken renders must fail the same probes.
// Isolated studio only; Firebase is blocked.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준캐릭터');
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
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const p=await browser.newPage({viewport:{width:1100,height:900},reducedMotion:'reduce'});
 await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo */'}));
 await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});
 p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:60000});
 await p.addStyleTag({content:'html,body,main,.studio article,.large{background:transparent!important;box-shadow:none!important;border:0!important}.large{height:640px!important}.qpx-contact-shadow{display:none}'});
 const mount=(sk=0)=>p.evaluate(sk=>{const {api}=QPFoundationStudio;for(const [sex,id] of [['m','male'],['f','female']]){const h=document.getElementById(id);for(const s of h.querySelectorAll('svg'))api.destroy(s);h.innerHTML=api.render({sex,foundationOutfit:'basic',sk,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0'},560);}},sk);
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
  window.__ref={data,w:im.width,h:im.height,px:x.getImageData(0,0,im.width,im.height).data,img:im};
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
  const cols=view==='right'?[0]:[-10,10],collarRow=a=>cols.map(o=>{let Y=collar+30;while(Y>collar-40&&!cream(at(a,cx+o,Y)))Y--;if(Y<=collar-40)return NaN;while(Y>collar-40&&cream(at(a,cx+o,Y-1)))Y--;return Y;});
  const rc=collarRow(ref),cc=collarRow(cur),collarOffset=Math.max(0,...rc.map((v,i)=>Number.isFinite(v)?Math.abs(v-cc[i]):0));
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
  return {iou:inter/union,colour:differ/union,shoeOffset,collarRows:{ref:rc,render:cc},collarOffset,neckHoles,hairResidue,sheetResidue,residuePx,head:{ref:headWidth(ref),render:headWidth(cur)},tile:tile.toDataURL('image/png')};
 },[sex,view,png,PX,label]);
 // Idle in all six views.
 report.views={};const tiles=[];
 for(const sex of SEXES)for(const view of VIEWS){
  const m=await measure(sex,view,await shoot(sex,view),(sex==='m'?'남':'여')+' '+{front:'앞',right:'옆',back:'뒤'}[view]+'  기준 | 렌더');
  tiles.push(m.tile);delete m.tile;report.views[sex+'-'+view]=m;
 }
 // Record the side-by-side image before judging, so a failure can be seen.
 fs.writeFileSync(path.join(out,'기준-대조.png'),await p.evaluate(async tiles=>{
  const ims=await Promise.all(tiles.map(async u=>{const i=new Image();i.src=u;await i.decode();return i;}));const w=ims[0].width,h=Math.max(...ims.map(i=>i.height));
  const c=document.createElement('canvas');c.width=w*3+40;c.height=h*2+30;const x=c.getContext('2d');x.fillStyle='#eef1f5';x.fillRect(0,0,c.width,c.height);
  ims.forEach((im,i)=>x.drawImage(im,(i%3)*(w+20),Math.floor(i/3)*(h+30)));return c.toDataURL('image/png').split(',')[1];
 },tiles),'base64');
 for(const [key,m] of Object.entries(report.views)){
  const [sex,view]=key.split('-'),where=sex+'-'+view+' '+JSON.stringify({...m,residuePx:undefined});
  assert(m.iou>=LIMIT.iou(key),'body silhouette differs from the sheet '+where);
  assert(m.colour<=LIMIT.colour(key),'body colours differ from the sheet '+where);
  assert(m.shoeOffset<=LIMIT.shoe,'shoes not on the sheet feet '+where);
  assert(m.collarOffset<=LIMIT.collar,'chin-to-collar distance differs '+where);
  assert(m.neckHoles<=LIMIT.neckHoles(key),'transparent holes at chin/neck/collar '+where);
  assert(m.hairResidue<=m.sheetResidue+LIMIT.residue,'pale or grey residue inside the hair at the nape '+where+' '+JSON.stringify(m.residuePx.slice(0,20)));
 }
 for(const sex of SEXES)for(const view of ['right','back']){
  const v=report.views[sex+'-'+view].head,f=report.views[sex+'-front'].head,ref=v.ref/f.ref,render=v.render/f.render;
  report.views[sex+'-'+view].headRatio={ref,render};assert(Math.abs(ref-render)<=LIMIT.headRatio,'head width ratio '+sex+'-'+view+' '+ref.toFixed(3)+' vs '+render.toFixed(3));
 }
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
