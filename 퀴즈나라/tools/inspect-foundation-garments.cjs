'use strict';
// Visual kit of one garment record on the reference body (stage 3, WP7;
// verification I). Headless, ?demo=1 only (Firebase stubbed), never moves a
// mouse. The images are for a person to open and judge; no number here is an
// art approval.
//
//   node tools/inspect-foundation-garments.cjs <id> [--records <dir>] [--allow-invalid] [--out <dir>] [--crowd] [--only a,b]
//     <id>       an index record (top:tee), an in-page alias (top:teehue, bottom:shortshue,
//                shoes:sneakerhue: hue-rotated copies of the basic pieces) or a record of --records
//     --records  a directory of pipeline records (sd-garment-<stem>.js data files or *.json records,
//                atlases next to them; tools/foundation-garment-lib.cjs loadRecordDir). Every file is
//                listed (ok / INVALID with its issues / skipped); the valid records are registered in
//                the studio session. A directory without a record file is an error.
//     --allow-invalid  also register <id> when its record has validation issues (they are printed and
//                kept in inspect.json); for looking at a build the validator refuses. Never an approval.
//     --out      default 검증/옷/<cat>-<shape>/
//     --crowd    also the real campus map (avatars at screen scale 0.76) with 30 avatars in mixed garments
//     --only     contact,tones,zoom,garment,mirror,crowd (default all but crowd; --crowd adds it)
//
// Writes (the record worn in its slot of the sex's starter outfit, reference heads m short:1 / f bob:1):
//   동작-<sex>-<view>-280.png    10 motions (idle walk run jump wave nod happy climb floor-sit desk-sit) × 8 steps
//   동작-<sex>-120.png           the same at 120 px, all four views side by side
//   피부-5종.png                 both sexes × front/back × the 5 skin tones (280 px), and
//   피부-5종-확대.png             its body band (collar to knees) at 2×
//   확대-<sex>.png               8× zooms on dark blue: collar, hanging and raised cuffs, underarm, hem,
//                                shorts cuffs, seat edges (floor and desk, every view), shoe tops and soles
//   옷만-<sex>.png               garment-only renders (skin, head and hair hidden), 4 views × 7 poses
//   좌우-<sex>.png               left/right mirror pairs: right | left flipped | difference
//   지도-군중.png                (--crowd) the campus map: 30 avatars, a third wearing the record, the rest the
//                                in-page aliases or the starter set (≥ 4 distinct outfits), spread over the screen
//   inspect.json                 what was rendered, the garments each avatar wore, page errors
// Runtime: about 3–5 minutes (4-CPU cloud container, software rendering); --crowd adds about 1 minute.
const fs=require('node:fs'),path=require('node:path');
const L=require('./foundation-garment-lib.cjs'),H=L.H,M=L.M,S=L.S;
const ROOT=path.resolve(__dirname,'..');
const a=H.args(),id=a._[0];
if(!id||!S.ID_RE.test(id)){console.error('usage: node tools/inspect-foundation-garments.cjs <cat:shape> [--records <dir>] [--out <dir>] [--crowd] [--only …]');process.exit(2);}
const PARTS=['contact','tones','zoom','garment','mirror','crowd'],only=H.list(a.only,PARTS.filter(p=>p!=='crowd').concat(a.crowd?['crowd']:[]));
const out=path.resolve(ROOT,a.out&&a.out!==true?a.out:path.join('검증/옷',S.stem(id)));fs.mkdirSync(out,{recursive:true});
const report={kind:'inspect-report',id,out,startedAt:new Date().toISOString(),images:[],errors:[],worn:{},notes:['Images for direct review; automatic numbers are not an art approval.','Cloud software rendering; real devices unmeasured.']};
const HAIR=M.REFERENCE_HAIR,SEX_KO={m:'남',f:'여'},VIEW_KO={front:'앞',right:'오른쪽',left:'왼쪽',back:'뒤'};
const MOTIONS=['idle','walk','run','jump','wave','nod','happy','climb','floor-sit','desk-sit'];
const MOTION_KO={idle:'서기',walk:'걷기',run:'달리기',jump:'점프',wave:'인사',nod:'고개 인사',happy:'기뻐하기',climb:'사다리','floor-sit':'아빠다리','desk-sit':'책상 앉기'};
// One step of a motion (8 steps each). Gestures run 0..1 over the 8 steps.
function stateOf(motion,direction,k){
  if(['wave','nod','happy'].includes(motion))return{action:'idle',direction,gesture:motion,gestureProgress:k/7,time:0,reducedMotion:false};
  return M.actionState(motion==='desk-sit'?'sit':motion,direction,k);
}
const save=(file,buf)=>{const f=path.join(out,file);fs.writeFileSync(f,buf);report.images.push(f);console.log('wrote '+f);return f;};
// A labelled sheet laid out as HTML in the page (rows of image tiles with captions), shot to a file.
async function sheet(page,file,{title,rows,bg='#eef1f5',tileBg=null}){
  await page.evaluate(({title,rows,bg,tileBg})=>{__fg.clear();const host=__fg.host;host.style.setProperty('--fg-bg',bg);host.style.display='block';host.style.padding='10px';
    const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    host.innerHTML='<div style="font:700 16px sans-serif;color:#25313d;margin:2px 0 8px">'+esc(title)+'</div>'+rows.map(r=>'<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px"><div style="width:120px;font:600 12px/1.3 sans-serif;color:#25313d;white-space:pre-wrap;padding-top:4px">'+esc(r.label)+'</div>'+r.tiles.map(t=>'<figure style="margin:0;text-align:center"><img src="'+t.src+'" style="display:block;image-rendering:pixelated;'+(tileBg?'background:'+tileBg:'')+'"><figcaption style="font:11px sans-serif;color:#44515e;max-width:'+(t.w||220)+'px">'+esc(t.caption||'')+'</figcaption></figure>').join('')+'</div>').join('');},{title,rows,bg,tileBg});
  await page.evaluate(()=>Promise.all([...__fg.host.querySelectorAll('img')].map(i=>i.decode().catch(()=>{}))));
  const box=await page.evaluate(()=>{const r=__fg.host.getBoundingClientRect();return{width:Math.ceil(r.width),height:Math.ceil(r.height)};});
  await L.capture(page,box,path.join(out,file));report.images.push(path.join(out,file));console.log('wrote '+path.join(out,file));
  await page.evaluate(()=>{__fg.host.style.display='';__fg.host.style.padding='';});
}
// An expected stop (bad --records input): its message only, no stack.
const stop=message=>Object.assign(Error(message),{stop:true});
const png=img=>'data:image/png;base64,'+H.png.encode(img).toString('base64');
function flip(img){const o={width:img.width,height:img.height,data:Buffer.alloc(img.data.length)};for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++)img.data.copy(o.data,(y*img.width+x)*4,(y*img.width+img.width-1-x)*4,(y*img.width+img.width-x)*4);return o;}
function diff(p,q){const o={width:p.width,height:p.height,data:Buffer.alloc(p.data.length)};let n=0;for(let i=0;i<p.data.length;i+=4){const d=Math.max(...[0,1,2].map(k=>Math.abs(p.data[i+k]-q.data[i+k])));if(d>24)n++;const v=d>24?255:Math.round(d*4);o.data[i]=v;o.data[i+1]=d>24?40:v;o.data[i+2]=d>24?40:v;o.data[i+3]=255;}return{img:o,n};}

// ------------------------------------------------------------------ parts
async function contactPart(page,sexes,outfits){
  for(const sex of sexes){
    const av={sex,sk:0,hair:HAIR[sex],expression:'bright:0',foundationGarments:outfits[sex]};
    for(const view of M.DIRECTIONS){
      const cells=MOTIONS.flatMap(m=>Array.from({length:8},(_,k)=>({av,state:stateOf(m,view,k),size:280})));
      const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:8,cellW:168,cellH:316,labelW:90,labels:MOTIONS.map(m=>MOTION_KO[m]+'\n'+m)});
      report.worn[sex]=g.info[0];await L.capture(page,g,path.join(out,'동작-'+sex+'-'+view+'-280.png'));report.images.push(path.join(out,'동작-'+sex+'-'+view+'-280.png'));
    }
    const cells=MOTIONS.flatMap(m=>M.DIRECTIONS.flatMap(view=>Array.from({length:8},(_,k)=>({av,state:stateOf(m,view,k),size:120}))));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:32,cellW:72,cellH:136,labelW:70,labels:MOTIONS.map(m=>MOTION_KO[m])});
    await L.capture(page,g,path.join(out,'동작-'+sex+'-120.png'));report.images.push(path.join(out,'동작-'+sex+'-120.png'));
  }
}
async function tonesPart(page,sexes,outfits){
  const rows=sexes.flatMap(sex=>['front','back'].map(view=>({sex,view})));
  const cells=rows.flatMap(({sex,view})=>[0,1,2,3,4].map(sk=>({av:{sex,sk,hair:HAIR[sex],expression:'bright:0',foundationGarments:outfits[sex]},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:280})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:5,cellW:168,cellH:316,labelW:70,labels:rows.map(r=>SEX_KO[r.sex]+' '+VIEW_KO[r.view])});
  const img=await L.capture(page,g,path.join(out,'피부-5종.png'));report.images.push(path.join(out,'피부-5종.png'));
  // The body band (collar to knees, past the shorts cuffs where the known pale band sits) of every
  // cell at 2×: where baked sheet skin shows as a pale band on dark skin.
  const tiles=g.rects.map(([x,y,w,h])=>L.zoom(H.png.crop(img,x+24,y+Math.round(h*.37),w-48,Math.round(h*.49)),2));
  await sheet(page,'피부-5종-확대.png',{title:report.id+' · 피부 5종 (살구 → 진한) · 옷깃–무릎 2배',rows:rows.map((r,i)=>({label:SEX_KO[r.sex]+' '+VIEW_KO[r.view],tiles:tiles.slice(i*5,i*5+5).map((t,k)=>({src:png(t),caption:'톤 '+k,w:t.width}))}))});
}
// Screen points of one rendered cell (page side), per named place. The hem and the seat edges are
// read from the pictures themselves: the shirt's lowest opaque row at three columns of the waist, and
// the shorts picture's lowest opaque row at a fifth, half and four fifths of its width.
async function pointsOf(){
  const out=[];for(const cell of __fg.cells()){if(!cell){out.push(null);continue;}const {svg}=cell,api=__fg.api,rig=api.prepare(svg),pose=api.inspect(svg),fit=__fg.O.inspect(svg);if(!rig||!pose||!fit){out.push(null);continue;}
    const at=(m,p)=>{const q=new DOMPoint(p[0],p[1]).matrixTransform(m);return[q.x+scrollX,q.y+scrollY];},S=api.specFor(svg.dataset.qpxSex),torso=rig.parts.torso.getScreenCTM();
    // The lowest opaque pixel of an <image> part at a fraction of its width (or at a user-space x), in screen space.
    const lowest=async(e,f,userX)=>{const d=await __fg.pixelsOf(e.getAttribute('href')),x=+e.getAttribute('x'),y=+e.getAttribute('y'),w=+e.getAttribute('width'),h=+e.getAttribute('height');
      const col=Math.max(0,Math.min(d.w-1,Math.floor(userX!=null?(userX-x)/w*d.w:f*d.w)));for(let r=d.h-1;r>=0;r--)if(d.data[(r*d.w+col)*4+3]>128)return at(e.getScreenCTM(),[x+(col+.5)/d.w*w,y+(r+.5)/d.h*h]);return null;};
    const shirt=svg.querySelector('[data-outfit-part="shirt-torso"]'),hip=svg.querySelector('[data-outfit-part="shorts-hip"]');
    const lines=[0,1].map(i=>{const l=svg.querySelector('[data-outfit-part="underarm-line-'+i+'"]');if(!l||l.style.display==='none'||!l.getAttribute('d'))return null;const len=l.getTotalLength(),p=l.getPointAtLength(len*.35);return at(l.getScreenCTM(),[p.x,p.y]);});
    // The collar point (S.collar) sits under the chin in the front and back views: their collar band
    // lies about 1.5 u lower, so those tiles centre there (the profile's collar wraps at the point itself).
    out.push({collar:at(torso,[16,S.collar+(pose.profile?.15:1.5)]),hem:await Promise.all([16-1.9,16,16+1.9].map(x=>lowest(shirt,null,x))),
      cuff:fit.sleeves.map((s,i)=>at(rig.arms[i].parent.getScreenCTM(),s.opening)),lift:pose.arms.map(x=>x.lift||0),underarm:lines,
      shortsCuff:fit.legs.map((l,i)=>at(rig.legs[i].parent.getScreenCTM(),l.cuff)),
      seat:await Promise.all([.2,.5,.8].map(f=>lowest(hip,f))),
      shoeTop:fit.shoes.map((s,i)=>at(rig.legs[i].parent.getScreenCTM(),s.ankle)),shoeSole:fit.shoes.map((s,i)=>at(rig.legs[i].parent.getScreenCTM(),[s.ankle[0],s.soleY-.15])),
      hidden:fit.shoes.map((s,i)=>svg.querySelector('[data-outfit-part="shoe-'+i+'"]')?.closest('[data-outfit-owner]')?.style.display==='none')});}
  return out;
}
async function zoomPart(page,sexes,outfits){
  const D='#1d2947',R=13,F=8;
  for(const sex of sexes){
    const av={sex,sk:2,hair:HAIR[sex],expression:'bright:0',foundationGarments:outfits[sex]},st=(extra)=>({time:0,reducedMotion:true,...extra});
    // The cells: one per pose; the rows pick their places from them.
    const poses={},add=(key,state)=>{poses[key]=state;};
    for(const v of M.DIRECTIONS){add('idle-'+v,st({action:'idle',direction:v}));add('floor-'+v,st({action:'sit',seatMode:'floor',direction:v}));add('desk-'+v,st({action:'sit',seatMode:'desk',direction:v}));}
    for(const v of ['front','back']){add('wave-'+v,st({action:'idle',direction:v,gesture:'wave',gestureProgress:.5}));add('happy-'+v,st({action:'idle',direction:v,gesture:'happy',gestureProgress:.5}));add('climb-'+v,st({action:'climb',direction:v,phase:.25}));}
    add('walk-right',st({action:'walk',direction:'right',phase:.25}));
    const keys=Object.keys(poses),g=await page.evaluate(spec=>__fg.grid(spec),{cells:keys.map(k=>({av,state:poses[k],size:280})),cols:8,cellW:168,cellH:316,bg:D});
    await page.evaluate(()=>__fg.mode('fg-noshadow'));const img=await L.capture(page,g),pts=await page.evaluate(pointsOf),P=Object.fromEntries(keys.map((k,i)=>[k,pts[i]]));
    const crop=(p)=>{if(!p)return null;const x=Math.round(p[0])-R,y=Math.round(p[1])-R;if(x<0||y<0||x+2*R>img.width||y+2*R>img.height)return null;return L.zoom(H.png.crop(img,x,y,2*R,2*R),F);};
    const tile=(key,p,caption)=>{const t=crop(p);return t?{src:png(t),caption:caption+' · '+key,w:t.width}:null;};
    const rows=[];
    rows.push({label:'옷깃\ncollar',tiles:['front','back','right','left'].map(v=>tile('idle-'+v,P['idle-'+v]?.collar,VIEW_KO[v])).filter(Boolean)});
    rows.push({label:'내린 소매 끝\nhanging cuffs',tiles:['front','back','right'].flatMap(v=>(P['idle-'+v]?.cuff||[]).slice(0,v==='right'?1:2).map((p,i)=>tile('idle-'+v,p,VIEW_KO[v]+' '+(i?'오른팔':'왼팔')))).filter(Boolean)});
    rows.push({label:'든 팔 소매 끝\nraised cuffs',tiles:['wave','happy','climb'].flatMap(g=>['front','back'].flatMap(v=>{const q=P[g+'-'+v];return q?q.cuff.map((p,i)=>q.lift[i]>.3?tile(g+'-'+v,p,VIEW_KO[v]+' '+(i?'오른팔':'왼팔')):null):[];})).filter(Boolean).slice(0,8)});
    rows.push({label:'겨드랑이\nunderarm',tiles:['wave','happy','climb'].flatMap(g=>['front','back'].flatMap(v=>(P[g+'-'+v]?.underarm||[]).map((p,i)=>p?tile(g+'-'+v,p,VIEW_KO[v]+' '+(i?'오른쪽':'왼쪽')):null))).filter(Boolean).slice(0,8)});
    rows.push({label:'밑단\nhem',tiles:['front','back','right'].flatMap(v=>(v==='right'?[P['idle-'+v]?.hem[1]]:P['idle-'+v]?.hem||[]).map((p,i)=>tile('idle-'+v,p,VIEW_KO[v]+(v==='right'?'':' '+['왼쪽','가운데','오른쪽'][i])))).filter(Boolean)});
    rows.push({label:'반바지 끝\nshorts cuffs',tiles:[...['front','back','right'].flatMap(v=>(P['idle-'+v]?.shortsCuff||[]).slice(0,v==='right'?1:2).map((p,i)=>tile('idle-'+v,p,VIEW_KO[v]+' '+(i?'오른다리':'왼다리')))),...(P['walk-right']?.shortsCuff||[]).map((p,i)=>tile('walk-right',p,'걷기 '+(i?'앞다리':'뒷다리')))].filter(Boolean)});
    for(const seat of ['floor','desk'])rows.push({label:(seat==='floor'?'아빠다리':'책상')+' 엉덩이 끝\nseat edge ('+seat+')',tiles:M.DIRECTIONS.flatMap(v=>[0,2].map(j=>tile(seat+'-'+v,P[seat+'-'+v]?.seat[j],VIEW_KO[v]+' '+(j?'오른쪽':'왼쪽')))).filter(Boolean)});
    rows.push({label:'신발 위\nshoe tops',tiles:['front','back','right'].flatMap(v=>(P['idle-'+v]?.shoeTop||[]).slice(0,v==='right'?1:2).map((p,i)=>tile('idle-'+v,p,VIEW_KO[v]+' '+(i?'오른발':'왼발')))).filter(Boolean)});
    rows.push({label:'신발 바닥\nshoe soles',tiles:['front','back','right'].flatMap(v=>(P['idle-'+v]?.shoeSole||[]).slice(0,v==='right'?1:2).map((p,i)=>tile('idle-'+v,p,VIEW_KO[v]+' '+(i?'오른발':'왼발')))).filter(Boolean)});
    report['zoomRows-'+sex]=rows.map(r=>[r.label.split('\n')[1],r.tiles.length]);
    await sheet(page,'확대-'+sex+'.png',{title:report.id+' · '+SEX_KO[sex]+' · 8배 확대 (짙은 파랑 바탕, 피부 3 보통)',rows});
  }
}
async function garmentPart(page,sexes,outfits){
  const poses=[['idle',k=>({action:'idle',time:0})],['walk',()=>({action:'walk',phase:.25,time:0})],['run',()=>({action:'run',phase:.25,time:0})],['wave',()=>({action:'idle',gesture:'wave',gestureProgress:.5,time:0})],['climb',()=>({action:'climb',phase:.25,time:0})],['floor-sit',()=>({action:'sit',seatMode:'floor',time:0})],['desk-sit',()=>({action:'sit',seatMode:'desk',time:0})]];
  for(const sex of sexes){
    const cells=poses.flatMap(([,f])=>M.DIRECTIONS.map(direction=>({av:{sex,sk:0,hair:HAIR[sex],expression:'bright:0',foundationGarments:outfits[sex]},state:{...f(),direction,reducedMotion:true},size:280})));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:4,cellW:168,cellH:316,labelW:120,labels:poses.map(([m])=>MOTION_KO[m]+'\n앞 · 오른쪽\n왼쪽 · 뒤'),bg:'#dfe6ee'});
    await page.evaluate(()=>__fg.mode('fg-garment fg-headless fg-noshadow'));await L.capture(page,g,path.join(out,'옷만-'+sex+'.png'));report.images.push(path.join(out,'옷만-'+sex+'.png'));
  }
}
// Climb faces the ladder (the back view in every direction), so it is not a mirror pair.
async function mirrorPart(page,sexes,outfits){
  const poses=[['idle',{action:'idle',time:0}],['walk',{action:'walk',phase:.25,time:0}],['run',{action:'run',phase:.6,time:0}],['jump',M.actionState('jump','right',4)],['wave',{action:'idle',gesture:'wave',gestureProgress:.5,time:0}],['happy',{action:'idle',gesture:'happy',gestureProgress:.5,time:0}],['nod',{action:'idle',gesture:'nod',gestureProgress:.4,time:0}],['floor-sit',{action:'sit',seatMode:'floor',time:0}],['desk-sit',{action:'sit',seatMode:'desk',time:0}]];
  for(const sex of sexes){
    const cells=poses.flatMap(([,s])=>['right','left'].map(direction=>({av:{sex,sk:1,hair:HAIR[sex],expression:'bright:0',foundationGarments:outfits[sex]},state:{...s,direction,reducedMotion:true},size:280})));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:2,cellW:168,cellH:316,bg:'#eef1f5'});await page.evaluate(()=>__fg.mode('fg-noshadow'));const img=await L.capture(page,g);
    const rows=poses.map(([m],i)=>{const [rx,ry,w,h]=g.rects[2*i],[lx,ly]=g.rects[2*i+1],r=H.png.crop(img,rx,ry,w,h),l=flip(H.png.crop(img,lx,ly,w,h)),d=diff(r,l);
      return{label:MOTION_KO[m]+'\n'+m,tiles:[{src:png(r),caption:'오른쪽'},{src:png(l),caption:'왼쪽 (좌우 뒤집음)'},{src:png(d.img),caption:'차이 '+d.n+' px (머리 가르마·무늬 비대칭 포함)'}]};});
    // The runtime draws the left view as the mirrored right view, so the difference stays near 0: the
    // pair is there to SEE the mirror (a pocket, badge or print changes side; mirrorSafe in the record).
    await sheet(page,'좌우-'+sex+'.png',{title:report.id+' · '+SEX_KO[sex]+' · 좌우 짝 (오른쪽 | 왼쪽을 뒤집은 것 | 차이) — 왼쪽은 오른쪽을 뒤집어 그리므로 차이는 0에 가깝다; 주머니·무늬가 반대쪽으로 가는지 보는 용도',rows});
  }
}
// The real campus map at its default camera (the classroom zone's camera may differ: avatars are drawn
// at screen scale 0.76 by map-avatar-display.js whatever the camera): 30 avatars of both sexes in the
// round-2 role mix and MIXED garments, all worn through the shop catalogue as students would: a third
// wear the record, the others the in-page aliases (hue-rotated tee, shorts, sneaker; one with the
// record too) or the starter set. Places are spread by farthest-point sampling over the standing
// places on screen, so no two friends share a spot.
async function crowdPart(browser,base,rec){
  // The campus opened as a student would (no detour to the login screen); the demo's studio session so
  // a record that is not in the index can be registered.
  const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});await H.isolate(context,report);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push('crowd: '+e.message));
  await page.goto(new URL('index.html?demo=1&avatar=foundation&session=foundation-studio&screen=campus&user='+encodeURIComponent('검수'),base).href);
  try{
    await page.waitForFunction(()=>window.QPGame?.getCampus()&&document.querySelector('.sr-actor.is-me [data-qp-foundation]'),null,{timeout:120000});
    await L.install(page);await L.registerAll(page,{records:rec.records||[]});
    const r=await page.evaluate(async({id,aliases})=>{
      const G=QPFoundationGarments,w=QPGame.getCampus(),s=w.getState(),cat=QPGame.getCatalog(),sexes=['m','f'],borrowed=new Set();
      const slotOf=x=>x.split(':')[0]==='top'?'top':x.split(':')[0]==='bottom'?'bottom':'shoes';
      // A shop item (per sex) that resolves to a record: its own shape if the catalogue knows it for both
      // sexes, else the record registered again (<id>crowd) under a borrowed shape both sexes can buy,
      // with {catalogue:true}, so that item resolves to it in this session.
      async function wearable(gid){const sl=slotOf(gid),shape=gid.split(':')[1],items=sex=>cat.publicItems(sl,sex),own=sexes.every(sex=>items(sex).some(it=>it.shape===shape));
        let wear=shape,worn=gid;
        // Never a shape that already means something: an index record's shape (the starter tee, shorts,
        // sneaker) or a new account's default item, or another borrowed one.
        const taken=sh=>borrowed.has(sl+':'+sh)||sexes.some(sex=>window.QPFoundationGarmentIndex?.catalogue?.[sex+':'+sl+':'+sh]||String(QPGame.newAvatar(sex)[sl]||'').split(':')[0]===sh);
        if(!own){wear=items('m').map(it=>it.shape).find(sh=>sh!==shape&&!taken(sh)&&items('f').some(it=>it.shape===sh));
          if(!wear)return null;borrowed.add(sl+':'+wear);
          const src=__fg.known.get(gid)||__fg.controls.get(gid)||G.get(gid,'m')?.record||G.get(gid,'f')?.record;const r=JSON.parse(JSON.stringify(src));r.id=gid+'crowd';r.shape=wear;r.cat=sl;worn=r.id;
          const images=Object.fromEntries(Object.keys(r.sexes).map(sex=>[sex,G.get(gid,sex)?.image]).filter(([,v])=>v));await G.register(r,images,{catalogue:true});}
        else borrowed.add(sl+':'+shape);
        return{id:gid,slot:sl,own,wear,worn,item:Object.fromEntries(sexes.map(sex=>{const it=items(sex).find(x=>x.shape===wear);return[sex,it?it.shape+':'+it.ci:null];}))};}
      const main=await wearable(id),others=[];for(const a of aliases.filter(x=>x!==id)){const x=await wearable(a);if(x)others.push(x);}
      // Per person (k = i mod 6): 0, 3 the record (3 with another slot's alias too), 1, 2, 4 an alias, 5 the starter.
      const plan=i=>{const k=i%6;if(k===0||!others.length)return k===0||k===3?[main]:[];if(k===3){const o=others.find(x=>x.slot!==main.slot);return o?[main,o]:[main];}if(k===5)return[];return[others[(k===1?0:k===2?1:2)%others.length]];};
      // The round-2 role mix. Remote players carry walk/run/floor-sit poses, desk seats and timed
      // gestures (wave, hello = nod, happy; held at mid-gesture here); a remote climb or jump is not a
      // player state, so those four stand idle.
      const roles=['walk','walk','walk','walk','walk','walk','run','run','run','run','run','run','wave','wave','wave','happy','happy','happy','nod','nod','desk','desk','desk','floor','floor','climb','climb','jump','jump','idle'];
      // Standing places on screen (camera rectangle in world units, a 26 u grid), then 29 of them by
      // farthest-point sampling (the player's own place counts as taken; vertical distance counts 1.6×,
      // so name tags above heads do not stack).
      const cam=s.camera,vw=innerWidth/cam.scale,vh=innerHeight/cam.scale,all=[];for(let y=cam.y+140;y<cam.y+vh-40;y+=26)for(let x=cam.x+60;x<cam.x+vw-60;x+=26)if(w.canStand(x,y)&&Math.hypot(x-s.x,y-s.y)>50)all.push({x,y});
      const far=(list,taken)=>{let best=null,bd=-1;for(const p of list){if(taken.includes(p))continue;let d=Math.hypot(p.x-s.x,(p.y-s.y)*1.6);for(const q of taken)d=Math.min(d,Math.hypot(p.x-q.x,(p.y-q.y)*1.6));if(d>bd){bd=d;best=p;}}return best;};
      const pts=[];while(pts.length<29&&pts.length<all.length)pts.push(far(all,pts));if(!pts.length)pts.push({x:s.x,y:s.y});
      const seats=(window.QPSchoolRoomScene?.seats||[]).slice(0,3),now=Date.now();
      const people=roles.slice(0,29).map((role,i)=>{const sex=i%2?'m':'f',me=JSON.parse(JSON.stringify(QPGame.newAvatar(sex))),av={...me,sex,sk:i%5,hair:sex==='m'?['short:1','spiky:1','fade:1','part:1'][i%4]:['bob:1','long:2','twin:3','pony:1'][i%4]};
        for(const g of plan(i))if(g.item[sex])av[g.slot]=g.item[sex];
        const gesture=['wave','happy','nod'].includes(role)?{type:role==='nod'?'hello':role,at:now-5e8,duration:1e9}:undefined,seat=role==='desk'?seats[roles.slice(0,i).filter(r=>r==='desk').length]:null;
        const pose=role==='walk'?'walk':role==='run'?'run':role==='floor'?'sit-floor':seat?'sit':'idle';
        return{...pts[i%pts.length],uid:'crowd'+i,name:'친구'+(i+1),avatar:av,zone:s.zone,direction:['front','back','left','right'][i%4],moving:role==='walk'||role==='run',pose,...(gesture?{gesture}:{}),...(seat?{seatId:seat.id}:{})};});
      // The world drops a remote player its navigation rejects (a floor-sitter needs the sitting
      // navigation, which the world does not expose): such a friend moves to the next free place,
      // again the farthest one from everybody placed.
      const placedNow=()=>new Set([...document.querySelectorAll('.sr-actor')].map(n=>n.dataset.uid));
      w.setPlayers(people);const taken=people.filter(p=>!p.seatId&&placedNow().has(p.uid)).map(p=>({x:p.x,y:p.y})),moved=[];
      for(const person of people){if(placedNow().has(person.uid))continue;const tried=new Set();
        for(let n=0;n<40&&!placedNow().has(person.uid);n++){const p=far(all.filter(q=>!tried.has(q)),taken);if(!p)break;tried.add(p);Object.assign(person,p);w.setPlayers(people);}
        if(placedNow().has(person.uid)){taken.push({x:person.x,y:person.y});moved.push(person.uid);}}
      await new Promise(r=>setTimeout(r,1500));
      const actors=[...document.querySelectorAll('.sr-actor svg[data-qp-foundation]')].map(svg=>({uid:svg.closest('.sr-actor').dataset.uid,garments:svg.dataset.foundationGarments,fallback:svg.dataset.foundationFallback,pose:svg.dataset.qpxPose}));
      // Every placed person (29 friends + the player) and the ones the world culls off screen (hidden, no svg).
      const nodes=[...document.querySelectorAll('.sr-actor')],placed=nodes.length,culled=nodes.filter(n=>n.hidden||!n.querySelector('svg[data-qp-foundation]')).map(n=>n.dataset.uid);
      // The closest pair of standing friends (world units), to show nobody piles up.
      let close={d:Infinity};for(let a=0;a<people.length;a++)for(let b=a+1;b<people.length;b++){if(people[a].seatId||people[b].seatId)continue;const d=Math.hypot(people[a].x-people[b].x,people[a].y-people[b].y);if(d<close.d)close={d:Math.round(d),a:people[a].uid,b:people[b].uid};}
      const wearingOf=g=>actors.filter(x=>String(x.garments).split('|').includes(g.worn)).length;
      return{record:{...main,wearing:wearingOf(main)},aliases:others.map(g=>({...g,wearing:wearingOf(g)})),placed,culled,moved,actors,camera:w.getState().camera,cameraScale:w.getState().camera.scale,avatarScreenScale:window.QPMapAvatarDisplay?.screenScale??null,zone:s.zone,player:{x:s.x,y:s.y},places:all.length,closest:close,count:actors.length,distinct:[...new Set(actors.map(x=>x.garments))]};
    },{id:rec.id,aliases:L.ALIASES.map(x=>x.id)});
    report.crowd=r;await page.waitForTimeout(600);
    const f=path.join(out,'지도-군중.png');await page.screenshot({path:f});report.images.push(f);
    console.log('wrote '+f+' — zone '+r.zone+', camera scale '+r.cameraScale+' (avatars at screen scale '+r.avatarScreenScale+'), '+r.placed+' people placed, '+r.count+' foundation avatars on screen'+(r.culled.length?' (culled off screen: '+r.culled.join(', ')+')':'')+'; '+r.record.wearing+' wearing '+rec.id+(r.record.own?'':' (shop shape '+r.record.wear+')')+', '+r.aliases.map(g=>g.wearing+' '+g.id).join(', ')+'; '+r.distinct.length+' distinct outfits; closest standing friends '+r.closest.d+' u apart ('+r.closest.a+', '+r.closest.b+')');
    if(r.distinct.length<4)report.errors.push('crowd: only '+r.distinct.length+' distinct outfits (want 4 or more)');
  }finally{await context.close();}
}

(async()=>{
  const server=await H.serve(H.fsTree(ROOT)),browser=await H.launch({args:H.RASTER_ARGS});
  try{
    let RECS;try{RECS=L.recordsOption(a.records);}catch(e){throw stop(e.message);}
    if(RECS.dir){report.recordsDir={dir:RECS.dir,files:RECS.records.map(r=>({file:r.file,id:r.record?.id??null,issues:r.issues})),skipped:RECS.skipped};
      if(!RECS.records.length)throw stop('--records '+RECS.dir+': no garment record file (sd-garment-<cat>-<shape>.js or a *.json record) — see the list above');}
    const mine=RECS.invalid.find(r=>r.record?.id===id);
    if(mine&&!a['allow-invalid'])throw stop(id+' in --records ('+mine.file+') is invalid: '+mine.issues.map(i=>i.code+' '+(i.path||'')+': '+i.message).join(' | ')+' — fix the record, or pass --allow-invalid to look at it anyway');
    const loadable=mine&&mine.record&&Object.keys(mine.record.sexes||{}).every(sex=>mine.atlases[sex]);
    if(mine&&!loadable)throw stop(id+' in --records ('+mine.file+') cannot be registered even with --allow-invalid: '+mine.issues.map(i=>i.code+': '+i.message).join(' | '));
    if(mine){report.invalidRecord={file:mine.file,issues:mine.issues};console.log('WARNING: inspecting the INVALID record '+id+' (--allow-invalid); its issues are in inspect.json');}
    const records=RECS.valid.concat(mine?[mine]:[]);
    const {context,page}=await L.openRuntime(browser,server.base,report,{viewport:{width:1400,height:1000}});
    await L.install(page);const reg=await L.registerAll(page,{records});report.registered=reg;
    const rec=await page.evaluate(id=>__fg.recordList().find(r=>r.id===id)||null,id);
    if(!rec)throw stop(id+' is neither an index record, an alias ('+L.ALIASES.map(x=>x.id).join(', ')+') nor a valid --records record'+(RECS.dir?' (valid there: '+(RECS.valid.map(r=>r.record.id).join(', ')||'none')+')':''));
    if(reg.records[id]!==undefined&&!(typeof reg.records[id]==='object'&&Object.values(reg.records[id]).every(v=>v==='ready')))throw stop(id+': registering the --records record failed: '+JSON.stringify(reg.records[id]));
    rec.records=records;report.record=rec;console.log('inspecting '+id+' ['+rec.source+'] '+rec.class+', sexes '+rec.sexes.join(','));
    const sexes=rec.sexes,outfits=Object.fromEntries(await Promise.all(sexes.map(async sex=>[sex,await page.evaluate(([id,sex])=>__fg.outfitFor(id,sex),[id,sex])])));report.outfits=outfits;
    if(only.includes('contact'))await contactPart(page,sexes,outfits);
    if(only.includes('tones'))await tonesPart(page,sexes,outfits);
    if(only.includes('zoom'))await zoomPart(page,sexes,outfits);
    if(only.includes('garment'))await garmentPart(page,sexes,outfits);
    if(only.includes('mirror'))await mirrorPart(page,sexes,outfits);
    await context.close();
    if(only.includes('crowd'))await crowdPart(browser,server.base,rec);
  }catch(e){report.errors.push(e.stop?e.message:'crash: '+(e.stack||e));if(e.stop)console.error('ERROR: '+e.message);else console.error(e);process.exitCode=1;}
  finally{await browser.close();await server.close();}
  report.errors=[...new Set(report.errors)];report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'inspect.json'),JSON.stringify(report,null,1));
  console.log((report.errors.length?'ERRORS: '+report.errors.join(' | '):'done')+' — '+report.images.length+' images in '+out);
  if(report.errors.length)process.exitCode=1;
})();
