'use strict';
// Compare history-dependent rendering with a fresh instance, then exercise
// the actual input controller. A correct pose solver alone cannot pass this.
// Stage 3 (WP7): per garment record (the basic outfit in full, every other
// index record and the in-page alias records at tone 0, mid-gesture), compared
// on screenshots. The basic outfit and the motion/jump part run on the plain
// ?demo=1&avatar=foundation page; only the other records run in the demo's
// studio session (register() is honoured only there).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('./verify-harness.cjs'),L=require('./foundation-garment-lib.cjs');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준전환');
fs.mkdirSync(out,{recursive:true});let browser;
const report={success:false,productionFirebase:false,errors:[]};
(async()=>{
 // Deterministic rasterisation (verify-harness): the screenshot comparison expects identical pixels.
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:H.DETERMINISTIC_ARGS});
 const p=await browser.newPage({viewport:{width:1366,height:950},reducedMotion:'reduce'});
 await p.route(/gstatic.com\/firebasejs/,r=>r.fulfill({body:'/* isolated demo */'}));
 await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});
 p.on('pageerror',e=>report.errors.push(e.message));
 const url=new URL('?demo=1&avatar=foundation',base),studioUrl=new URL('?demo=1&avatar=foundation&session=foundation-studio',base);
 async function ready(u=url){await p.goto(u.href);await p.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPFoundationSkin.atlas.ready&&QPFoundationOutfit.atlas.ready);}
 await ready();
 // Screenshots (an svg serialised into an <img> cannot load its external hrefs: head, hair and body
 // art): the moving and the fresh avatar share one fixed spot and are shot one at a time.
 await p.exposeFunction('__qpShot',async clip=>(await p.screenshot({clip,animations:'disabled',caret:'hide'})).toString('base64'));
 await p.exposeFunction('__qpDiff',(a,b)=>{const A=H.png.decode(Buffer.from(a,'base64')),B=H.png.decode(Buffer.from(b,'base64'));let n=0;for(let i=0;i<A.data.length;i+=4)if(Math.max(...[0,1,2,3].map(k=>Math.abs(A.data[i+k]-B.data[i+k])))>12)n++;return n;});
 // Stage 3 (WP7): per garment record. The basic outfit runs the whole loop; every other record of the
 // index and the in-page alias records (hue-rotated basic pieces, registered in this demo session)
 // run it at tone 0, mid-gesture, worn in their slot of the sex's basic outfit.
 report.transitions={records:[]};
 async function rowOf(r){
  const row=await p.evaluate(async({id,sexes,full})=>{
   QPGame.go('login');const api=QPAvatarFoundation,host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:200px;height:340px;z-index:2147483647;background:#fff';document.body.append(host);
   const shotOf=async svg=>{for(const s of host.children)s.style.visibility=s===svg?'':'hidden';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return window.__qpShot({x:0,y:0,width:200,height:340});};
   let samples=0,worst=0,negative=0;
   for(const sex of sexes)for(const sk of full?[0,4]:[0])for(const gesture of ['wave','happy'])for(const progress of full?[.12,.5,.88]:[.5]){
    const av={sex,sk,...(id?{foundationGarments:__fg.outfitFor(id,sex)}:{})};
    host.innerHTML=api.render(av,280)+api.render(av,280);const [moving,fresh]=host.children;for(const s of [moving,fresh])s.style.cssText='position:absolute;left:0;top:0';
    for(const from of ['front','right','left','back'])for(const to of ['front','right','left','back']){
     if(from===to)continue;const state={action:'idle',gesture,gestureProgress:progress,time:0};
     api.apply(moving,{...state,direction:from});api.apply(moving,{...state,direction:to});
     api.reset(fresh);api.apply(fresh,{...state,direction:to});
     const a=await shotOf(moving),b=await shotOf(fresh),error=await window.__qpDiff(a,b);worst=Math.max(worst,error);
     if(error)throw Error('Direction switch differs from fresh pose '+JSON.stringify({id,sex,sk,gesture,progress,from,to,error}));
     // Negative control: a greeting arm left hidden must change the pixels.
     // (2026-10-08, round 2: every greeting hand is now clear of the head - the
     // side cheer is a fist pump ahead of the chin - so sending the near arm
     // behind the head no longer hides anything; the arm is hidden instead.)
     if(!negative&&gesture==='happy'&&progress===.5&&from==='front'&&to==='right'){
      const r=api.prepare(moving);r.parts['near-arm'].style.display='none';negative=await window.__qpDiff(await shotOf(moving),b);r.parts['near-arm'].style.display='';
      if(negative<50)throw Error('Hidden greeting-hand negative control not detected');
     }
     api.reset(moving);const r=api.prepare(moving);
     if(r.frontHands.children.length||r.parts['near-arm'].parentNode!==r.body)throw Error('Gesture leaves an orphan arm on return to idle');samples++;
    }api.destroy(moving);api.destroy(fresh);
   }
   host.remove();return{id:id||'basic',samples,worstDifferentPixels:worst,hiddenHandNegativeControlPixels:negative};
  },{id:r.id,sexes:r.sexes,full:!r.id});
  report.transitions.records.push({...row,page:p.url().split('?')[1]});console.log('transitions '+row.id+' ('+p.url().split('?')[1]+'): '+row.samples+' direction switches = fresh renders (screenshots), negative control '+row.hiddenHandNegativeControlPixels+' px');
 }
 // The basic outfit on the plain page; then the other records in the studio session.
 await rowOf({id:null,sexes:['m','f']});
 await ready(studioUrl);await L.install(p);const registered=await L.registerAll(p,{});
 if(!Object.values(registered.aliases).every(s=>typeof s==='object'&&Object.values(s).every(v=>v==='ready')))throw Error('alias records not registered: '+JSON.stringify(registered));
 for(const r of (await p.evaluate(()=>__fg.recordList())).filter(x=>!(x.source==='index'&&x.legacy)))await rowOf(r);
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
