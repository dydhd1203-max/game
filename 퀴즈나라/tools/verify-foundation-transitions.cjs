'use strict';
// Compare history-dependent rendering with a fresh instance, then exercise
// the actual input controller. A correct pose solver alone cannot pass this.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준전환');
fs.mkdirSync(out,{recursive:true});let browser;
const report={success:false,productionFirebase:false,errors:[]};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const p=await browser.newPage({viewport:{width:1366,height:950},reducedMotion:'reduce'});
 await p.route(/gstatic.com\/firebasejs/,r=>r.fulfill({body:'/* isolated demo */'}));
 await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});
 p.on('pageerror',e=>report.errors.push(e.message));
 const url=new URL('?demo=1&avatar=foundation',base);
 async function ready(){await p.goto(url.href);await p.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPFoundationSkin.atlas.ready&&QPFoundationOutfit.atlas.ready);}
 await ready();
 report.transitions=await p.evaluate(async()=>{
  QPGame.go('login');const api=QPAvatarFoundation,host=document.createElement('div');document.body.append(host);
  async function pixels(svg){const c=svg.cloneNode(true);c.setAttribute('width',384);c.setAttribute('height',744);const im=new Image(),u=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)],{type:'image/svg+xml'}));im.src=u;await im.decode();const canvas=document.createElement('canvas');canvas.width=384;canvas.height=744;const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0);URL.revokeObjectURL(u);return ctx.getImageData(0,0,384,744).data;}
  function difference(a,b){let count=0;for(let i=0;i<a.length;i+=4)if(Math.max(...[0,1,2,3].map(k=>Math.abs(a[i+k]-b[i+k])))>12)count++;return count;}
  let samples=0,worst=0,negative=0;
  for(const sex of ['m','f'])for(const sk of [0,4])for(const gesture of ['wave','happy'])for(const progress of [.12,.5,.88]){
   host.innerHTML=api.render({sex,sk},280)+api.render({sex,sk},280);const [moving,fresh]=host.children;
   for(const from of ['front','right','left','back'])for(const to of ['front','right','left','back']){
    if(from===to)continue;const state={action:'idle',gesture,gestureProgress:progress,time:0};
    api.apply(moving,{...state,direction:from});api.apply(moving,{...state,direction:to});
    api.reset(fresh);api.apply(fresh,{...state,direction:to});
    const a=await pixels(moving),b=await pixels(fresh),error=difference(a,b);worst=Math.max(worst,error);
    if(error)throw Error('Direction switch differs from fresh pose '+JSON.stringify({sex,sk,gesture,progress,from,to,error}));
    // The side-view wave hand is now held in front of the chin, clear of the
    // head (2026-10-08 gestures), so it cannot reveal a hidden arm; the
    // side-view cheer raises the near arm across the head's side and does.
    if(!negative&&gesture==='happy'&&progress===.5&&from==='front'&&to==='right'){
     const r=api.prepare(moving);r.body.append(r.parts['near-arm']);negative=difference(await pixels(moving),b);
     if(negative<50)throw Error('Hidden greeting-hand negative control not detected');
    }
    api.reset(moving);const r=api.prepare(moving);
    if(r.frontHands.children.length||r.parts['near-arm'].parentNode!==r.body)throw Error('Gesture leaves an orphan arm on return to idle');samples++;
   }api.destroy(moving);api.destroy(fresh);
  }
  host.remove();return{samples,worstDifferentPixels:worst,hiddenHandNegativeControlPixels:negative};
 });
 await ready();await p.evaluate(()=>QPGame.go('motion'));await p.waitForFunction(()=>QPGame.getMotion());
 report.jump=await p.evaluate(async()=>{
  const api=QPGame.getMotion(),svg=document.querySelector('#motionActor .qp-foundation-avatar'),rows=[];
  api.reset();api.jump();
  for(let i=0;i<150;i++){
   const s=api.getState(),pose=QPAvatarFoundation.inspect(svg);rows.push({...s,drop:pose.drop});
   if(i>10&&!s.jumpStage&&s.grounded)break;
   await new Promise(requestAnimationFrame);
  }
  const stages=[...new Set(rows.map(s=>s.jumpStage))];
  if(!['takeoff','air','landing',''].every(s=>stages.includes(s)))throw Error('Actual jump misses stage: '+JSON.stringify(stages));
  for(const stage of ['takeoff','landing']){
   const frames=rows.filter(s=>s.jumpStage===stage);if(!frames.every(s=>s.grounded&&s.y===0&&s.action==='jump')||Math.max(...frames.map(s=>s.drop))<.4)throw Error('No actual ground compression: '+stage);
  }
  if(Math.max(...rows.map(s=>s.y))<60||rows.at(-1).action!=='idle'||rows.at(-1).y!==0)throw Error('Jump height or recovery wrong');
  // Holding jump launches once; blur cancels a pending launch, reset clears
  // landing state, and movement/sitting still work after the whole cycle.
  api.setInput('jump',true);
  // The controller intentionally caps dt when the browser is busy. Wait on
  // simulation state rather than assuming one wall-clock second is a cycle.
  let finished=false;
  for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const s=api.getState();if(s.grounded&&!s.jumpStage){finished=true;break;}}
  if(!finished)throw Error('Held jump does not finish');
  for(let i=0;i<18;i++){await new Promise(requestAnimationFrame);if(api.getState().jumpStage||!api.getState().grounded)throw Error('Held jump auto-repeats');}
  api.setInput('jump',false);
  api.jump();window.dispatchEvent(new Event('blur'));await new Promise(r=>setTimeout(r,140));
  if(!api.getState().grounded||api.getState().jumpStage)throw Error('Blur leaves pending launch');
  api.move(1);await new Promise(r=>setTimeout(r,100));if(api.getState().action!=='walk')throw Error('Cannot walk after landing');
  api.move(0);api.sit();if(api.getState().action!=='sit')throw Error('Cannot sit after landing');api.reset();
  return{frames:rows.length,stages,maxHeight:Math.max(...rows.map(s=>s.y)),takeoffCompression:Math.max(...rows.filter(s=>s.jumpStage==='takeoff').map(s=>s.drop)),landingCompression:Math.max(...rows.filter(s=>s.jumpStage==='landing').map(s=>s.drop)),singleHeldJump:true,blurCancellation:true,walkAndSitAfterLanding:true};
 });
 assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser?.close();});
