'use strict';
// Isolated demo only. Geometry checks never substitute for art review.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준몸');
fs.mkdirSync(out,{recursive:true});const report={errors:[],checks:[],screenshots:[],productionFirebase:false};let browser;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const context=await browser.newContext({viewport:{width:1366,height:950}});
 await context.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* demo only */'}));
 await context.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('unexpected Firebase request');return r.abort();});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:60000});
 report.render=await p.evaluate(()=>{
  const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);let samples=0;
  const check=(v,message)=>{if(!v)throw Error(message);};
  for(const sex of ['m','f'])for(const sk of [0,1,2,3,4])for(const size of [280,120]){
   host.innerHTML=api.render({sex,sk},size);const svg=host.firstElementChild;api.apply(svg,{time:0});const count=svg.querySelectorAll('*').length;
   for(const direction of ['front','left','right','back'])for(const action of ['idle','walk','run','floor-sit','sit','jump','wave','climb'])for(let frame=0;frame<12;frame++){
    api.apply(svg,{direction,action:action==='wave'?'idle':action,gesture:action==='wave'?'wave':'',gestureProgress:frame/11,phase:frame/12,time:frame/30,grounded:action!=='jump',showBones:frame===5});
    check(svg.querySelectorAll('*').length===count,'motion must not duplicate body nodes');
    // Encoded artwork can contain the letters "NaN"; inspect geometry only.
    const geometryAttrs=['d','transform','x','y','cx','cy','r','rx','ry','width','height'];
    check([...svg.querySelector('[data-foundation-body]').querySelectorAll('*')].every(e=>geometryAttrs.every(k=>!/NaN|Infinity/.test(e.getAttribute(k)||''))),'nonfinite skeleton');
    check(svg.querySelectorAll('[data-foundation-part]').length===6,'one owner per body part');
    check(svg.querySelectorAll('[data-foundation-skin-paint]').length===5,'one painted neck, two arms and two legs');
    const rig=api.prepare(svg);check(rig.arms.every(a=>a.hand.style.display==='none'),'no duplicate procedural hands');
    const pose=api.inspect(svg);if(!pose.profile&&!rig.raised){
      // Hanging arms beside the torso stay visible from the front and from
      // behind. Only arms beyond the body plane pass behind the shirt:
      // seated hands seen from behind, and an arm swinging away from the
      // viewer while walking or running. Climbing arms (changed 2026-10-08,
      // D12): they rise from the shoulders over the back; hidden behind the
      // shirt the upper arms vanished and only stub hands poked out.
      const children=[...rig.body.children],torso=children.indexOf(rig.parts.torso),seated=pose.floor||pose.desk;
      rig.arms.forEach((a,i)=>{const behind=pose.back&&seated||!seated&&['walk','run'].includes(pose.action)&&pose.arms[i].depth<-.9;check(behind===children.indexOf(a.parent)<torso,'arm/shirt depth order '+JSON.stringify({direction,action,frame,arm:i,behind}));});
    }
    for(const node of svg.querySelectorAll('[clip-path]')){const id=node.getAttribute('clip-path').match(/url\(#([^)]*)\)/)?.[1];if(id)check(Boolean(svg.querySelector('[id="'+id+'"]')),'head clip must be self-contained');}
    if(action==='floor-sit'){check(svg.dataset.qpxSeatMode==='floor','floor seat mode');const pose=api.inspect(svg);check(pose.floor&&!pose.desk,'floor and desk distinct');}
    samples++;
   }
   const geometry=()=>JSON.stringify([...svg.querySelector('[data-foundation-body]').querySelectorAll('*')].map(n=>[n.tagName,n.getAttribute('d'),n.getAttribute('transform'),n.style.display,n.style.opacity]));
   api.reset(svg);const initial=geometry();api.destroy(svg);api.apply(svg,{action:'idle',direction:'front',time:0});check(svg.querySelectorAll('*').length===count,'remount duplicated nodes');check(geometry()===initial,'reset/remount changes visible geometry');api.destroy(svg);
  }
  host.remove();return{samples,sexes:2,skinTones:5,sizes:[280,120],directions:4,actions:8};
 });report.checks.push('7680 rendered motion samples; owned parts, original head clips, reset/remount');
 // D13 static render: shop preview, profile, lists and results never call
 // apply(). The render() string alone must show the posed idle front body,
 // be the same DOM as apply(idle, front, time 0), keep the node set later
 // applies use, cost nothing per frame, and repaint once late art arrives.
 report.staticRender=await p.evaluate(async()=>{
  const api=QPFoundationStudio.api,w=document.getElementById('runtime').contentWindow,host=w.document.createElement('div');w.document.body.append(host);
  const check=(v,message)=>{if(!v)throw Error(message);},frame=()=>new Promise(r=>requestAnimationFrame(r));
  const norm=svg=>{const c=svg.cloneNode(true);c.removeAttribute('data-foundation-static');c.removeAttribute('data-foundation-static-defs');return c.outerHTML.split(svg.dataset.foundationId).join('qpf-X');};
  async function differ(a,b){const draw=async svg=>{const c=svg.cloneNode(true);c.setAttribute('width',192);c.setAttribute('height',372);const im=new Image(),u=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)],{type:'image/svg+xml'}));im.src=u;await im.decode();const canvas=document.createElement('canvas');canvas.width=192;canvas.height=372;const x=canvas.getContext('2d');x.drawImage(im,0,0);URL.revokeObjectURL(u);return x.getImageData(0,0,192,372).data;};const p=await draw(a),q=await draw(b);let n=0;for(let i=0;i<p.length;i+=4)if(Math.max(...[0,1,2,3].map(k=>Math.abs(p[i+k]-q[i+k])))>12)n++;return n;}
  const shown=svg=>[...svg.querySelectorAll('[data-foundation-head-view]')].filter(h=>h.style.display!=='none').map(h=>h.dataset.foundationHeadView);
  let cases=0;
  for(const sex of ['m','f'])for(const sk of [0,4])for(const size of [280,46])for(const outfit of ['basic','body']){
   const av={sex,sk,foundationOutfit:outfit};host.innerHTML=api.render(av,size)+api.render(av,size);const [still,live]=host.children,where=JSON.stringify({sex,sk,size,outfit});
   check(still.dataset.foundationStatic==='idle-front','static marker '+where);
   check(shown(still).join()==='front','static render shows only the front head '+where);
   check(still.querySelectorAll('[data-foundation-skin-paint]').length===5,'static painted neck, arms and legs '+where);
   check(still.querySelectorAll('[data-outfit-part]:not([data-outfit-part^="underarm"])').length===(outfit==='basic'?6:0),'static garments '+where);
   check(still.dataset.qpxPose==='idle'&&still.dataset.qpxView==='front','static pose data '+where);
   const nodes=still.querySelectorAll('*').length;api.apply(live,api.staticPose);
   check(norm(still)===norm(live),'static render differs from apply(idle, front, 0) '+where);
   check(live.querySelectorAll('*').length===nodes,'mounting a static render changes the node set '+where);
   // A controller that only prepares keeps the static pose visible.
   api.prepare(still);check(norm(still)===norm(live),'prepare() alone changes the static pose '+where);
   for(const state of [{action:'walk',direction:'left',phase:.3},{action:'idle',direction:'back',gesture:'wave',gestureProgress:.5},{action:'floor-sit',direction:'right'}]){api.apply(still,{...state,time:0});check(still.querySelectorAll('*').length===nodes,'motion after a static mount changes nodes '+where);}
   // History leaves unused clip data and empty style attributes, so the
   // return to the static pose is judged on pixels.
   api.reset(still);check(await differ(still,live)===0,'reset returns to the static pose '+where);
   if(!cases){api.apply(live,{action:'walk',direction:'front',phase:.25,time:0});check(await differ(still,live)>50,'pixel comparison control: a walking pose must differ');}
   api.destroy(still);api.destroy(live);cases++;
  }
  // Thirty list avatars: render, mount, then no DOM work on later frames.
  const avs=Array.from({length:30},(_,i)=>({sex:i%2?'m':'f',sk:i%5}));let t=performance.now(),html='';for(const av of avs)html+=api.render(av,46);const renderMs=performance.now()-t;
  t=performance.now();host.innerHTML=html;host.getBoundingClientRect();const mountMs=performance.now()-t;await frame();await frame();
  // The shared avatar observer sets two CSS variables on the root once per mount.
  let mutations=0;const watch=new w.MutationObserver(r=>{mutations+=r.filter(m=>!(m.type==='attributes'&&m.attributeName==='style'&&m.target.parentNode===host)).length;});watch.observe(host,{subtree:true,childList:true,attributes:true});for(let f=0;f<20;f++)await frame();watch.disconnect();
  check(mutations===0,'static avatars change on their own: '+mutations);check([...host.children].every(s=>shown(s).join()==='front'&&s.querySelectorAll('[data-outfit-part]:not([data-outfit-part^="underarm"])').length===6),'every list avatar is a posed body');
  // Garments still loading (an avatar not rendered yet, so no cached
  // template): hidden rather than undressed, then repainted once.
  const atlas=w.QPFoundationOutfit.atlas;atlas.ready=false;let pending;try{host.innerHTML=api.render({sex:'f',sk:2,hair:'long:3'},120);pending=host.firstElementChild;}finally{atlas.ready=true;}
  check(pending.dataset.foundationStatic==='pending'&&!pending.querySelector('[data-outfit-part]')&&pending.getAttribute('visibility')==='hidden','an undressed pending render stays hidden');
  for(let f=0;f<3&&pending.dataset.foundationStatic;f++)await frame();
  check(!pending.dataset.foundationStatic&&!pending.hasAttribute('visibility')&&shown(pending).join()==='front'&&pending.querySelectorAll('[data-outfit-part]:not([data-outfit-part^="underarm"])').length===6,'pending static render repainted and shown after the art loads');
  check(!api.render({sex:'f',sk:2,hair:'long:3'},120).includes('data-foundation-static="pending"'),'a pending render is not cached');
  api.destroy(pending);host.remove();
  return{cases,crowd:{avatars:30,renderMs:+renderMs.toFixed(1),mountMs:+mountMs.toFixed(1),mutationsIn20Frames:mutations,chars:html.length}};
 });report.checks.push('static render: posed idle front body without apply, same DOM as apply(idle,front,0), stable nodes, prepare/reset, 30 static avatars without per-frame work, pending art repaint');
 // Painted-image pool (added 2026-10-09, round 3 performance). Round 2 kept
 // first-in-first-out lists (768 limbs, 200 sleeves, 160 shorts) smaller
 // than a mixed map crowd's working set, so 30 mixed avatars re-drew about
 // 70 images every frame (~220 ms per update in software rendering). One
 // byte-bounded least-recently-used pool now holds that crowd. Contracts:
 // the warm pass of the round-2 merger's mixed crowd draws almost nothing
 // new; the pool never exceeds its budget; a held pose survives a small pool
 // full of cycling poses; avatars in one drawn pose share images whatever
 // their skin tone; a raised (unpinned) sleeve is one image at every angle;
 // an idle pool empties and refills to the same DOM. Pixel identity with
 // round 2 is checked outside this tool (see the motion review record).
 report.paintPool=await p.evaluate(async()=>{
  // The studio's own avatars stop playing: they would keep the pool busy.
  QPFoundationStudio.setState({action:'idle'});
  const api=QPFoundationStudio.api,w=document.getElementById('runtime').contentWindow,S=w.QPFoundationSkin,check=(v,message)=>{if(!v)throw Error(message);};
  check(S.paint.budget>0&&S.paint.budget<=40*1048576,'the painted-image pool has a bounded budget (at most 40 MiB)');
  const defaultBudget=S.paint.budget,misses=()=>S.paintStats().kinds.reduce((s,k)=>s+k.misses,0),host=document.createElement('div');document.body.append(host);
  const make=(sex,sk,size=120)=>{const d=document.createElement('div');d.innerHTML=api.render({sex,foundationOutfit:'basic',sk,hair:sex==='f'?'bob:1':'short:1',expression:'bright:0'},size);host.append(d);return d.firstElementChild;};
  // The round-2 merger's crowd: 6 walk, 6 run, 3 wave, 3 happy, 2 nod, 3 desk, 2 floor, 2 climb, 2 jump, 1 idle.
  S.paint.budget=40*1048576;S.emptyPaint();
  const roles=['walk','walk','walk','walk','walk','walk','run','run','run','run','run','run','wave','wave','wave','happy','happy','happy','nod','nod','desk','desk','desk','floor','floor','climb','climb','jump','jump','idle'],dirs=['front','back','left','right'];
  const state=(i,k)=>{const role=roles[i],t=k/60,d=dirs[i%4];
   if(role==='walk')return{action:'walk',direction:d,phase:(t/.48+i*.13)%1,time:t};
   if(role==='run')return{action:'run',direction:d,phase:(t/.36+i*.17)%1,time:t};
   if(role==='wave'||role==='happy'||role==='nod')return{action:'idle',direction:'front',gesture:role,gestureProgress:((t+i*.3)/1.6)%1,time:t};
   if(role==='desk')return{action:'sit',direction:'back',time:t};
   if(role==='floor')return{action:'sit',seatMode:'floor',direction:d,time:t};
   if(role==='climb')return{action:'climb',phase:((t*118/17)+i*.2)%1,time:t};
   if(role==='jump'){const s=(k+i*5)%40;return s<4?{action:'jump',direction:d,grounded:true,jumpStage:'takeoff',jumpCompression:s/3,time:t}:s<32?{action:'jump',direction:d,grounded:false,vy:480-(s-4)*34,time:t}:s<36?{action:'jump',direction:d,grounded:true,jumpStage:'landing',jumpCompression:1-(s-32)/4,time:t}:{action:'idle',direction:d,time:t};}
   return{action:'idle',direction:d,time:t};};
  const crowd=roles.map((r,i)=>make(i%2?'f':'m',i%5));
  const start=misses();for(let k=0;k<120;k++)crowd.forEach((svg,i)=>api.apply(svg,state(i,k)));const cold=misses();
  for(let k=120;k<360;k++)crowd.forEach((svg,i)=>api.apply(svg,state(i,k)));const warm=misses()-cold;
  check(warm<=240,'mixed crowd warm pass draws at most one new image per frame on average (round 2: ~70 per frame): '+warm+' in 240 frames');
  check(S.paint.bytes<=S.paint.budget,'pool within its budget');const crowdStats=S.paintStats();crowd.forEach(svg=>api.destroy(svg));
  // A small pool: never over budget; a held pose (asked every frame) stays.
  S.paint.budget=2*1048576;S.emptyPaint();const held=make('f',1),walker=make('m',2),evicted=S.paint.evicted;let heldRedraws=0;
  for(let k=0;k<4*24*2;k++){api.apply(walker,{action:k%48<24?'walk':'run',direction:dirs[(k/48|0)%4],phase:(k%24)/24,time:k/60});const before=misses();api.apply(held,{action:'sit',direction:'back',time:0});if(k)heldRedraws+=misses()-before;check(S.paint.bytes<=S.paint.budget,'small pool exceeded its budget');}
  check(S.paint.evicted>evicted,'small pool control: cycling poses must evict');check(heldRedraws===0,'a held pose is never redrawn while other poses cycle: '+heldRedraws);
  api.destroy(held);api.destroy(walker);S.paint.budget=40*1048576;
  // Shared across avatars and skin tones.
  const a=make('m',0),b=make('m',4);api.apply(a,{action:'walk',direction:'right',phase:.25,time:0});const m0=misses();api.apply(b,{action:'walk',direction:'right',phase:.25,time:0});check(misses()===m0,'a second avatar in the same drawn pose (another skin tone) draws nothing new');
  // A raised sleeve (nothing pinned) is one image for every angle.
  const hrefs=new Map();for(const[g,frac]of [['wave',.35],['wave',.45],['wave',.55],['wave',.65],['happy',.25],['happy',.5]])for(const direction of ['front','back']){api.apply(a,{action:'idle',direction,gesture:g,gestureProgress:frac,time:0});const pose=api.inspect(a);pose.arms.forEach((arm,i)=>{if(Math.round(arm.lift*10)/10>=.4){const key=direction+i,h=a.querySelector('[data-outfit-part="sleeve-'+i+'"]').getAttribute('href');if(!hrefs.has(key))hrefs.set(key,new Set());hrefs.get(key).add(h);}});}
  check(hrefs.size>=2&&[...hrefs.values()].every(set=>set.size===1),'a raised sleeve uses one image at every angle: '+JSON.stringify([...hrefs].map(([k,v])=>[k,v.size])));
  // Merge of round 3 (2026-10-09): a raised front/back sleeve draws from its
  // own cleaned art (raisedSleeve, no inner strip past the cuff), so its
  // shared resting entry must not be the hanging sleeve's. With one 'rest' key
  // for both, whichever was drawn first was handed to the other (an idle
  // friend made a waving arm show the strip again).
  {const sleeve=()=>a.querySelector('[data-outfit-part="sleeve-1"]').getAttribute('href'),idle={action:'idle',direction:'front',time:0},wave={action:'idle',direction:'front',gesture:'wave',gestureProgress:.5,time:0};
   S.emptyPaint();api.apply(a,wave);const raisedAlone=sleeve();S.emptyPaint();api.apply(a,idle);const restAlone=sleeve();api.apply(a,wave);const raisedAfterRest=sleeve();S.emptyPaint();api.apply(a,wave);api.apply(a,idle);const restAfterRaised=sleeve();
   check(raisedAlone!==restAlone&&raisedAfterRest===raisedAlone&&restAfterRaised===restAlone,'a raised sleeve and a resting sleeve keep their own pictures whichever is drawn first');}
  // Idle: the pool empties, and the next update draws the same DOM.
  const still={action:'idle',direction:'front',gesture:'wave',gestureProgress:.5,time:0};api.apply(b,still);const shot=b.outerHTML,emptied=S.paint.emptied;S.paint.idleMs=150;
  await new Promise(r=>setTimeout(r,5600));check(S.paint.emptied>emptied&&S.paintStats().entries===0,'an idle pool empties');S.paint.idleMs=60000;
  const redraw=misses();api.apply(b,still);check(misses()>redraw&&b.outerHTML===shot,'a refilled pool redraws the same images (same DOM)');
  api.destroy(a);api.destroy(b);host.remove();S.paint.budget=defaultBudget;
  return{defaultBudgetMiB:defaultBudget/1048576,crowd:{coldDrawn:cold-start,warmDrawn:warm,pool:{entries:crowdStats.entries,MiB:+(crowdStats.bytes/1048576).toFixed(2),kinds:crowdStats.kinds.map(k=>({kind:k.kind,entries:k.entries,MiB:+(k.bytes/1048576).toFixed(2)}))}},heldRedraws,raisedSleeves:hrefs.size};
 });report.checks.push('painted-image pool: bounded, mixed crowd warm pass ~no redraws, held pose survives a small pool, shared across skins, one raised-sleeve image, idle empty and identical refill');
 // Reduced motion: the rig's own clock (time defaults to performance.now())
 // stops; without it the same calls breathe.
 for(const reducedMotion of ['reduce','no-preference']){
  await p.emulateMedia({reducedMotion});
  const moved=await p.evaluate(async()=>{const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);host.innerHTML=api.render({sex:'m'},120);const svg=host.firstElementChild,geometry=()=>JSON.stringify([...svg.querySelector('[data-foundation-body]').querySelectorAll('*')].map(n=>[n.getAttribute('d'),n.getAttribute('transform'),n.getAttribute('x'),n.getAttribute('y')]));
   const samples=[];for(let k=0;k<3;k++){if(k)await new Promise(r=>setTimeout(r,600));api.apply(svg,{action:'idle',direction:'front'});samples.push(geometry());}api.apply(svg,api.staticPose);const still=geometry();api.destroy(svg);host.remove();return{changed:new Set(samples).size>1,still:samples.every(g=>g===still)};});
  if(reducedMotion==='reduce')assert(!moved.changed&&moved.still,'reduced motion must hold the idle pose');else assert(moved.changed,'idle breathing control: the rig clock must move without reduced motion');
 }
 await p.emulateMedia({reducedMotion:'no-preference'});report.checks.push('prefers-reduced-motion holds idle breathing; control breathes');
 // Raised-arm underarm (2026-10-08, round 3): the new edge line is one
 // smooth curve from the shirt's painted side through a round armpit along
 // the sleeve's underside (the old straight side met the curved painted waist
 // in a small notch and knob), and it ends at the cuff, inside the sleeve
 // (the old straight wedge ran on past short sleeves). Close-ups judge the
 // look; this guards the geometry, both sexes, front and back.
 report.underarm=await p.evaluate(()=>{
  const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);const rows=[];
  for(const sex of ['m','f']){host.innerHTML=api.render({sex},280);const svg=host.firstElementChild;
   for(const state of [{action:'climb',phase:.1},{action:'climb',phase:.35},{action:'climb',phase:.6},{action:'idle',direction:'front',gesture:'wave',gestureProgress:.5},{action:'idle',direction:'back',gesture:'wave',gestureProgress:.5},{action:'idle',direction:'front',gesture:'happy',gestureProgress:.5},{action:'idle',direction:'back',gesture:'happy',gestureProgress:.5}]){
    api.apply(svg,{time:0,...state});const pose=api.inspect(svg),[a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=q=>[(d*(q[0]-tx)-c*(q[1]-ty))/det,(-b*(q[0]-tx)+a*(q[1]-ty))/det];
    for(const i of [0,1]){const line=svg.querySelector('[data-outfit-part="underarm-line-'+i+'"]');if(line.style.display==='none'||!line.getAttribute('d'))continue;
     const pts=line.getAttribute('d').replace(/[MQ]/g,'L').split('L').filter(t=>t.trim()).map(t=>t.trim().split(/\s+/).map(Number)),chords=[];let from=pts[0];
     for(const q of pts.slice(1))if(Math.hypot(q[0]-from[0],q[1]-from[1])>=.04){chords.push([q[0]-from[0],q[1]-from[1]]);from=q;}
     let turn=0;for(let k=1;k<chords.length;k++){const[u,v]=[chords[k-1],chords[k]];turn=Math.max(turn,Math.abs(Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]))*180/Math.PI);}
     const arm=pose.arms[i],S=unmap(arm.shoulder),e=unmap(arm.elbow),l=Math.hypot(e[0]-S[0],e[1]-S[1]),end=pts[pts.length-1],along=((end[0]-S[0])*(e[0]-S[0])+(end[1]-S[1])*(e[1]-S[1]))/l;
     rows.push({sex,state:JSON.stringify(state),i,turn:+turn.toFixed(1),along:+along.toFixed(2)});}}
   api.destroy(svg);}
  host.remove();return rows;});
 assert(report.underarm.length>=20,'raised arms draw their underarm: '+report.underarm.length);
 for(const r of report.underarm){assert(r.turn<=30,'underarm line turns smoothly (no notch) '+JSON.stringify(r));assert(r.along<=2.6,'underarm line ends at the cuff, inside the sleeve '+JSON.stringify(r));}
 report.checks.push('raised-arm underarm: one smooth line (largest turn '+Math.max(...report.underarm.map(r=>r.turn))+' deg) ending inside the sleeve (at most '+Math.max(...report.underarm.map(r=>r.along))+' along the arm)');
 for(const direction of ['front','left','right','back']){await p.evaluate(d=>QPFoundationStudio.setState({action:'floor-sit',direction:d,phase:0}),direction);await p.screenshot({path:path.join(out,'floor-'+direction+'.png')});report.screenshots.push('floor-'+direction+'.png');}
 await p.locator('[data-action="idle"]').click();await p.keyboard.press('ArrowRight');await p.keyboard.down('ArrowRight');await p.waitForFunction(()=>QPFoundationStudio.getState().action==='run');await p.keyboard.up('ArrowRight');await p.waitForFunction(()=>QPFoundationStudio.getState().action==='idle');await p.keyboard.press('KeyC');assert.equal(await p.evaluate(()=>QPFoundationStudio.getState().action),'floor-sit');await p.keyboard.press('KeyC');assert.equal(await p.evaluate(()=>QPFoundationStudio.getState().action),'idle');report.checks.push('Studio actual direction double tap / release / C');
 report.performance=await p.evaluate(async()=>{
  QPFoundationStudio.setState({action:'idle'});const api=QPFoundationStudio.api,host=document.createElement('div');host.style='position:fixed;inset:0;background:#fffaf0;display:grid;grid-template-columns:repeat(10,1fr);z-index:9999';document.body.append(host);
  for(let i=0;i<30;i++){host.insertAdjacentHTML('beforeend',api.render({sex:i%2?'m':'f',sk:i%5},120));}const avatars=[...host.children],update=[],frameTimes=[];let previous=0;
  for(let f=0;f<70;f++){const stamp=await new Promise(requestAnimationFrame),start=performance.now();for(let i=0;i<avatars.length;i++)api.apply(avatars[i],{direction:['front','right','back','left'][i%4],action:i%2?'walk':'run',phase:(f/30+i*.07)%1,time:0});if(f>10){update.push(performance.now()-start);frameTimes.push(stamp-previous);}previous=stamp;}
  const stat=a=>{a.sort((x,y)=>x-y);return{median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};for(const a of avatars)api.destroy(a);host.remove();return{avatars:30,samples:update.length,updateMs:stat(update),frameMs:stat(frameTimes),environment:navigator.userAgent,schoolDeviceMeasured:false};
 });
 report.performance.meets30fpsBudget=report.performance.frameMs.p95<=34&&report.performance.updateMs.p95<=30;
 const session='foundation-'+Date.now();
 async function open(name){const q=await context.newPage();q.on('pageerror',e=>report.errors.push(e.message));const u=new URL(base);for(const[k,v]of Object.entries({demo:'1',avatar:'foundation',screen:'campus',session,user:name}))u.searchParams.set(k,v);await q.goto(u.href);await q.waitForFunction(()=>QPGame.getCampus()&&document.querySelector('.sr-actor.is-me [data-qp-foundation]'),null,{timeout:60000});return q;}
 const a=await open('기준하늘'),b=await open('기준민트');
 async function go(q,zone,point){await q.evaluate(({zone,point})=>QPGame.go(zone,point),{zone,point});await q.waitForFunction(z=>document.querySelector('.school-room-host')?.dataset.zone===z,zone);await q.bringToFront();await q.locator('.school-room-world').focus();}
 const state=q=>q.evaluate(()=>(QPGame.getCampus()||QPGame.getPlayground()).getState());
 await go(a,'campus',{x:1513,y:465});await go(b,'campus',{x:1580,y:465});await a.bringToFront();await a.locator('.school-room-world').focus();await a.keyboard.press('KeyC');await a.waitForFunction(()=>document.querySelector('.sr-actor.is-me svg')?.dataset.qpxPose==='floor-sit');assert.equal((await state(a)).seatId,null);await a.screenshot({path:path.join(out,'campus-floor-120.png')});await a.keyboard.press('KeyC');
 const seat=await a.evaluate(()=>QPSchoolRoomScene.seats[4]);await go(a,'campus',seat.approach);await a.keyboard.press('KeyC');await a.waitForFunction(()=>QPGame.getCampus().getState().pose==='sit');assert.equal(await a.locator('.sr-actor.is-me svg').getAttribute('data-qpx-seat-mode'),'desk');await a.screenshot({path:path.join(out,'campus-desk-120.png')});await a.keyboard.press('KeyC');
 await go(a,'playground',{x:1400,y:820});await go(b,'playground',{x:1450,y:880});await a.bringToFront();await a.locator('.school-room-world').focus();
 const start=await state(a);await a.keyboard.down('ArrowRight');await wait(300);const walked=await state(a);assert.equal(walked.pose,'walk');await a.keyboard.up('ArrowRight');await wait(270);
 await a.keyboard.press('ArrowRight');await a.keyboard.down('ArrowRight');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='run');const runStart=await state(a);await wait(300);const ran=await state(a);assert.equal(ran.pose,'run');assert(ran.x-runStart.x>0);await b.waitForFunction(()=>[...document.querySelectorAll('.sr-actor:not(.is-me) svg')].some(s=>s.dataset.qpxPose==='run'));await a.screenshot({path:path.join(out,'playground-run-120.png')});await a.keyboard.up('ArrowRight');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='idle');
 report.movement={walkDistance:walked.x-start.x,runDistance:ran.x-runStart.x,walkSpeed:337.5,runSpeed:506.25};
 await a.keyboard.press('KeyC');await a.waitForFunction(()=>document.querySelector('.sr-actor.is-me svg')?.dataset.qpxPose==='floor-sit');await a.screenshot({path:path.join(out,'playground-floor-120.png')});await a.keyboard.press('KeyC');
 // Running must stop when the viewport loses focus or actions interrupt it.
 await a.keyboard.press('ArrowRight');await a.keyboard.down('ArrowRight');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='run');await a.keyboard.press('KeyC');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='sit-floor');await a.keyboard.up('ArrowRight');await a.keyboard.press('KeyC');
 await a.keyboard.press('ArrowRight');await a.keyboard.down('ArrowRight');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='run');await a.evaluate(()=>dispatchEvent(new Event('blur')));await a.keyboard.up('ArrowRight');assert.equal((await state(a)).pose,'idle');
 for(const point of [{x:1515,y:620},{x:2258,y:410}]){
  await go(a,'playground',{x:point.x,y:point.y+65});await wait(700);
  assert(await a.evaluate(q=>QPGame.getPlayground().moveTo(q.x,q.y),point));
  await a.waitForFunction(()=>Boolean(QPGame.getCampus()));await wait(700);
  // Arrival latches the threshold. Leave it, then approach naturally again.
  await a.evaluate(()=>QPGame.getCampus().moveTo(2122,370));
  await a.waitForFunction(()=>{const s=QPGame.getCampus().getState();return !s.moving&&s.y>355;});
  assert(await a.evaluate(()=>QPGame.getCampus().moveTo(2122,298)));
  await a.waitForFunction(()=>Boolean(QPGame.getPlayground()));
 }
 report.checks.push('120px own/friend rigs; actual C floor/desk, walk/run/release, friend run, C interrupts run, blur, both automatic entrances');report.success=true;assert.deepEqual(report.errors,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(async error=>{report.success=false;report.failure=error.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.error(error);await browser?.close();process.exitCode=1;});
