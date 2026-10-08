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
 // Reduced motion: the rig's own clock (time defaults to performance.now())
 // stops; without it the same calls breathe.
 for(const reducedMotion of ['reduce','no-preference']){
  await p.emulateMedia({reducedMotion});
  const moved=await p.evaluate(async()=>{const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);host.innerHTML=api.render({sex:'m'},120);const svg=host.firstElementChild,geometry=()=>JSON.stringify([...svg.querySelector('[data-foundation-body]').querySelectorAll('*')].map(n=>[n.getAttribute('d'),n.getAttribute('transform'),n.getAttribute('x'),n.getAttribute('y')]));
   const samples=[];for(let k=0;k<3;k++){if(k)await new Promise(r=>setTimeout(r,600));api.apply(svg,{action:'idle',direction:'front'});samples.push(geometry());}api.apply(svg,api.staticPose);const still=geometry();api.destroy(svg);host.remove();return{changed:new Set(samples).size>1,still:samples.every(g=>g===still)};});
  if(reducedMotion==='reduce')assert(!moved.changed&&moved.still,'reduced motion must hold the idle pose');else assert(moved.changed,'idle breathing control: the rig clock must move without reduced motion');
 }
 await p.emulateMedia({reducedMotion:'no-preference'});report.checks.push('prefers-reduced-motion holds idle breathing; control breathes');
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
