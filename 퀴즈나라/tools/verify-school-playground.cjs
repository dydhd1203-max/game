'use strict';
// Genuine door keys and school-space lifecycle in an isolated two-student store.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const output=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/교실-운동장-왕복-2026-10-02');
const session='school-portals-'+Date.now()+'-'+process.pid;
const checks=[],errors=[],missing=[],screenshots=[];
let browser,phase='startup';const startedAt=new Date().toISOString();
fs.mkdirSync(output,{recursive:true});
for(const name of ['검증결과.json','실패결과.json'])fs.rmSync(path.join(output,name),{force:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pass=(name,detail)=>{checks.push({name,detail});console.log('PASS: '+name);};
async function state(page){return page.evaluate(()=> (QPGame.getCampus()||QPGame.getPlayground()).getState());}
async function room(page,zone){await page.waitForFunction(zone=>Boolean(zone==='campus'?QPGame.getCampus():QPGame.getPlayground())&&document.querySelector('.school-room-host')?.dataset.zone===zone,zone);}
async function ready(page){await room(page,'campus');await page.waitForFunction(()=>QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady);}
async function shot(page,name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.screenshot({path:path.join(output,name+'.png')});screenshots.push(name+'.png');}
async function walk(page,goal,tolerance=9){
 const deadline=Date.now()+35000;
 while(Date.now()<deadline){
  const current=await state(page);if(Math.hypot(current.x-goal.x,current.y-goal.y)<=tolerance&&!current.moving)return current;
  const target=await page.evaluate(goal=>{
   const api=QPGame.getCampus()||QPGame.getPlayground(),w=document.querySelector('.sr-world'),v=document.querySelector('.school-room-world'),wr=w.getBoundingClientRect(),vr=v.getBoundingClientRect(),scale=new DOMMatrix(getComputedStyle(w).transform).a;
   const gx=wr.left+goal.x*scale,gy=wr.top+goal.y*scale;
   const x=Math.max(vr.left+45,Math.min(vr.right-45,gx)),y=gy>=vr.top+15&&gy<=vr.bottom-15?gy:Math.max(vr.top+95,Math.min(vr.bottom-105,gy));
   const boxes=[...api.scene.seats,...api.scene.interactables].map(i=>i.hitRect||i.rect).filter(Boolean);
   // A clamped off-screen goal can land on interactive indoor furniture.
   // Choose visible floor to keep this helper a walk, rather than a sit click.
   const candidates=[];
   for(let dy=-120;dy<=120;dy+=20)for(let dx=-120;dx<=120;dx+=20){const sx=x+dx,sy=y+dy,wx=(sx-wr.left)/scale,wy=(sy-wr.top)/scale;
    if(sx<vr.left+15||sx>vr.right-15||sy<vr.top+15||sy>vr.bottom-15||!api.canStand(wx,wy))continue;
    if(boxes.some(r=>wx>=r.x-2&&wx<=r.x+(r.width??r.w)+2&&wy>=r.y-2&&wy<=r.y+(r.height??r.h)+2))continue;
    const hit=document.elementFromPoint(sx,sy);if(!hit||!v.contains(hit)||hit.closest('button,input,.sr-actor'))continue;
    candidates.push({x:sx,y:sy,score:Math.hypot(dx,dy)});
   }
   candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
  },goal);
  assert(target,'A visible legal floor waypoint must exist');
  await page.mouse.click(target.x,target.y);
  const leg=Date.now()+4500;
  do{await sleep(100);const s=await state(page);assert(await page.evaluate(p=>(QPGame.getCampus()||QPGame.getPlayground()).canStand(p.x,p.y),s),'Pointer travel must stay on legal source terrain: '+JSON.stringify(s));if(Math.hypot(s.x-goal.x,s.y-goal.y)<=tolerance&&!s.moving)return s;if(!s.moving&&!s.path.length)break;}while(Date.now()<leg);
 }
 throw new Error('Could not walk to '+JSON.stringify(goal)+' from '+JSON.stringify(await state(page)));
}
async function focus(page){await page.bringToFront();await page.locator('.school-room-world').focus();}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const context=await browser.newContext({viewport:{width:1366,height:768}});context.setDefaultTimeout(18000);
 await context.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated school spaces */',contentType:'text/javascript'}));
 async function open(user){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});const url=new URL(base);url.searchParams.set('demo','1');url.searchParams.set('session',session);url.searchParams.set('user',user);await p.goto(url.href);await ready(p);return p;}
 const a=await open('텔레포트하늘'),b=await open('텔레포트민트');
 const identity=await a.evaluate(()=>JSON.parse(JSON.stringify(QPGame.getMe())));
 const aid=identity.k,bid=await b.evaluate(()=>QPGame.getMe().k);
 await a.waitForFunction(uid=>Boolean(document.querySelector('.sr-actor[data-uid="'+CSS.escape(uid)+'"]')),bid);
 assert.equal(await a.locator('.sr-actor').count(),2);
 assert.equal(await a.evaluate(()=>QPGame.getPlayground()),null);
 assert.equal(await a.evaluate(()=>QPSchoolRoomScene.seats.length),30);
 await focus(a);await a.keyboard.press('KeyF');
 await a.waitForFunction(()=>!document.querySelector('.sr-actor.is-me .sr-bubble').hidden);
 assert.equal((await state(a)).zone,'campus');
 await shot(a,'01-교실-문밖-손흔들기');
 pass('Default login remains the 30-seat classroom; F away from a door waves.');
 phase='classroom door approach';
 const schoolDoor=await a.evaluate(()=>QPSchoolRoomScene.interactables.find(i=>i.target==='playground'));
 assert(schoolDoor);await walk(a,schoolDoor.approach);
 const oldPresence=await a.evaluate(()=>QPGame.getCampusPresence().getState());
 await shot(a,'02-교실-문앞-F');await focus(a);
 // Send the held repeat and fresh second press immediately, before asset
 // inspection round-trips. A later press after 650ms is a valid return.
 await a.keyboard.down('KeyF');await a.keyboard.down('KeyF');
 await a.keyboard.up('KeyF');await a.keyboard.press('KeyF');await room(a,'playground');
 const outdoorDoor=await a.evaluate(()=>QPPlaygroundScene.interactables.find(i=>i.target==='campus'));
 assert(outdoorDoor);const arrival=outdoorDoor.arrival||outdoorDoor.approach;
 assert(Math.hypot((await state(a)).x-arrival.x,(await state(a)).y-arrival.y)<1);
 assert.equal(await a.evaluate(()=>QPGame.getCampus()),null);
 assert.equal(await a.evaluate(()=>QPGame.getCampusPresence()),null);
 assert((await a.evaluate(()=>QPGame.getPlaygroundPresence().getState().path)).includes('/playground/connections'));
 assert.equal((await state(a)).zone,'playground','Held/repeated/instant second F must not bounce straight back');
 await a.waitForFunction(({path,id})=>{let n=JSON.parse(localStorage.getItem(QPDemo.storageKey)||'{}');for(const part of path.split('/'))n=n?.[part];return !n?.[id];},{path:oldPresence.path,id:oldPresence.connectionId});
 await b.waitForFunction(()=>document.querySelectorAll('.sr-actor').length===1);
 assert.deepEqual(await a.evaluate(()=>JSON.parse(JSON.stringify(QPGame.getMe()))),identity);
 await shot(a,'03-운동장-학교문-도착');
 pass('F instantly transfers to the real school entrance, preserves the account and releases the previous room; held F does not bounce.');
 phase='separated rosters';
 // Place the second fixture at its door; the actual inter-room transition still uses F.
 await b.evaluate(point=>QPGame.go('campus',point),schoolDoor.approach);await focus(b);await sleep(800);await b.keyboard.press('KeyF');await room(b,'playground');
 await a.waitForFunction(uid=>Boolean(document.querySelector('.sr-actor[data-uid="'+CSS.escape(uid)+'"]')),bid);
 await b.waitForFunction(uid=>Boolean(document.querySelector('.sr-actor[data-uid="'+CSS.escape(uid)+'"]')),aid);
 assert.equal(await a.locator('.sr-actor').count(),2);assert.equal(await b.locator('.sr-actor').count(),2);
 await shot(a,'04-운동장-두학생');
 pass('Two students share the playground; students who remain indoors disappear from the outdoor roster.');
 phase='outdoor source and bench';
 const scene=await a.evaluate(()=>QPPlaygroundScene.get());assert.equal(scene.publicEntryReady,true);assert.equal(scene.missingSourceBounds.length,0);
 assert.equal(scene.seats.length,0,'Outdoor benches must be background artwork, without seat leases');
 assert.equal(scene.backgroundBenches.length,15);assert(!scene.solids.some(s=>s.id.startsWith('bench-')));
 const bench=scene.backgroundBenches.reduce((best,s)=>Math.hypot(s.walkTarget.x-arrival.x,s.walkTarget.y-arrival.y)<Math.hypot(best.walkTarget.x-arrival.x,best.walkTarget.y-arrival.y)?s:best);
 const benchPoint={x:bench.rect.x+bench.rect.width/2,y:bench.rect.y+bench.rect.height/2};
 await walk(a,benchPoint);await focus(a);
 const standingAtBench=await state(a);assert.equal(standingAtBench.pose,'idle');assert.equal(standingAtBench.seatId,null,'Clicking a pictured bench must only walk');
 await a.keyboard.press('KeyC');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='sit-floor');
 const onBench=await state(a);assert.equal(onBench.seatId,null);
 assert(Math.hypot(onBench.x-standingAtBench.x,onBench.y-standingAtBench.y)<.1,'C must use the current position, without snapping to a bench anchor');
 await a.waitForFunction(()=>document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose==='floor-sit');
 assert.equal(await a.evaluate(()=>QPGame.getPlaygroundPresence().getState().seatId),null);
 await shot(a,'05-운동장-배경벤치-기본앉기-C');await a.keyboard.press('KeyC');
 await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='idle');
 const ground=scene.previewViews.find(v=>v.id==='soccer')?.spawn;
 assert(ground);await walk(a,ground);await focus(a);await a.keyboard.press('KeyC');
 await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='sit-floor');
 await shot(a,'06-축구장-바닥-C');await a.keyboard.press('KeyC');
 await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='idle');
 const before=await state(a);
 // Browser scheduling can drop frames on a busy software renderer. Measure
 // genuine keyboard displacement against the production simulation's capped
 // frame deltas, rather than confuse dropped frames with a 150px/s controller.
 await a.evaluate(()=>{window.__speedFrames=[];window.__speedProbe=true;function collect(time){if(!window.__speedProbe)return;window.__speedFrames.push({time,x:QPGame.getPlayground().getState().x});requestAnimationFrame(collect);}requestAnimationFrame(collect);});
 await a.keyboard.down('ArrowRight');
 await a.waitForFunction(()=>window.__speedFrames.filter((f,i,a)=>i&&f.x>a[i-1].x+.01).length>=20);
 await a.keyboard.up('ArrowRight');
 const speedFrames=await a.evaluate(()=>{window.__speedProbe=false;return window.__speedFrames;});
 const movingFrames=speedFrames.slice(1).map((f,i)=>({distance:f.x-speedFrames[i].x,dt:Math.min(.035,(f.time-speedFrames[i].time)/1000)})).filter(f=>f.distance>.01);
 assert(movingFrames.length>=20,'Real movement must paint at least twenty advancing frames');
 const simulatedSeconds=movingFrames.reduce((n,f)=>n+f.dt,0),distance=movingFrames.reduce((n,f)=>n+f.distance,0),measuredSpeed=distance/simulatedSeconds;
 assert(Math.abs(measuredSpeed-225)<2,'Actual keyboard displacement must match 225px/s; measured '+measuredSpeed);
 const after=await state(a);assert(after.x>before.x+50,'Actual right key must advance the avatar through the source field');
 assert(await a.evaluate(p=>QPGame.getPlayground().canStand(p.x,p.y),after));
 await shot(a,'07-운동장-축구장-실제보행');
 pass('The completed original-source map uses the same basic C pose on background benches and open ground, and faster keyboard movement without crossing collision bounds.',{measuredSpeed,simulatedSeconds,movementDistance:distance,advancingFrames:movingFrames.length});
 phase='return';await walk(a,outdoorDoor.approach,55);await focus(a);await a.keyboard.press('KeyF');await room(a,'campus');
 const insideArrival=schoolDoor.arrival||schoolDoor.approach;
 assert(Math.hypot((await state(a)).x-insideArrival.x,(await state(a)).y-insideArrival.y)<1);
 assert.equal(await a.evaluate(()=>QPGame.getPlayground()),null);assert.equal(await a.evaluate(()=>QPGame.getPlaygroundPresence()),null);
 await b.waitForFunction(()=>document.querySelectorAll('.sr-actor').length===1);
 assert.deepEqual(await a.evaluate(()=>JSON.parse(JSON.stringify(QPGame.getMe()))),identity);
 assert.equal((await state(a)).seatId,null);
 await shot(a,'08-교실-왕복도착');
 await a.reload();await ready(a);assert.equal((await state(a)).zone,'campus');
 assert.equal(await a.evaluate(()=>QPGame.getMe().k),aid);
 pass('F returns to the classroom door with an idle pose; reload keeps the default classroom and account.');
 phase='wide desktop';await b.setViewportSize({width:1920,height:1080});await sleep(150);await shot(b,'09-운동장-1920');
 assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);pass('Both PC sizes have no page errors, missing assets or page overflow.');
 const report={startedAt,completedAt:new Date().toISOString(),target:base,checks,passed:checks.length,errors,missing,screenshots,realFirebaseTested:false};
 fs.writeFileSync(path.join(output,'검증결과.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(async error=>{fs.writeFileSync(path.join(output,'실패결과.json'),JSON.stringify({startedAt,failedAt:new Date().toISOString(),phase,error:error.stack,checks,errors,missing},null,2)+'\n');console.error('FAILED '+phase+'\n'+error.stack);await browser?.close();process.exitCode=1;});
