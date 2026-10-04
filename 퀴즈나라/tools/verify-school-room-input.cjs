/* Actual keyboard/pointer and delayed seat-lease regression. Demo data only. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const target=process.argv[2]||'source',base=process.env.QP_PREVIEW_URL||'http://127.0.0.1:4173';
  const prefix=target==='release'?'/배포용/':'/';
  const out=path.join(__dirname,'..','검증','교실-입력-2026-10-02',target);fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo validation */',contentType:'text/javascript'}));
  const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  const pass=(name,evidence)=>{checks.push({name,evidence});console.log('PASS '+name);};
  const waitPose=async pose=>page.waitForFunction(expected=>document.querySelector('.sr-actor.is-me svg')?.dataset.qpxPose===expected,pose);
  const waitIdle=async()=>page.waitForFunction(()=>{const w=window.__inputFixture?.world||QPGame.getCampus(),s=w.getState();return !s.moving&&!s.path.length&&!s.seatPending;});
  await page.goto(base+prefix+'?demo=1&session=input-'+target+'-'+Date.now());
  await page.waitForFunction(()=>QPGame.getCampus()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady&&QPAvatarDirection.atlas.backReady);
  await page.locator('.school-room-world').focus();
  await page.keyboard.down('KeyC');
  await page.waitForFunction(()=>Boolean(QPGame.getCampus().getState().seatId)||QPGame.getCampus().getState().pose==='sit-floor');
  const beforeRepeat=await page.evaluate(()=>{const s=QPGame.getCampus().getState();return {seatId:s.seatId,pose:s.pose};});
  await page.keyboard.down('KeyC');await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>{const s=QPGame.getCampus().getState();return {seatId:s.seatId,pose:s.pose};}),beforeRepeat);
  await page.keyboard.up('KeyC');await waitPose(beforeRepeat.seatId?'sit':'floor-sit');
  await page.screenshot({path:path.join(out,'01-C-앉기.png')});
  await page.keyboard.press('KeyE');await page.waitForTimeout(120);
  assert.deepEqual(await page.evaluate(()=>{const s=QPGame.getCampus().getState();return {seatId:s.seatId,pose:s.pose};}),beforeRepeat,'E must not stand or sit away from the board');
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>{const s=QPGame.getCampus().getState();return !s.seatId&&s.pose==='idle';});
  assert.ok(await page.evaluate(()=>{const w=QPGame.getCampus(),s=w.getState();return w.canStand(s.x,s.y);}));
  pass('C toggles seating once; held C stays seated; E does not control seating',beforeRepeat);

  // A fresh controller uses exactly the original scene and renderer. Only the
  // lease adapter is controlled so otherwise rare delayed replies are repeatable.
  await page.evaluate(()=>{
    const me=QPGame.getMe(),scene=QPSchoolRoomScene.get();QPGame.go('school');
    const host=document.createElement('div');host.id='inputFixture';Object.assign(host.style,{position:'fixed',top:'60px',left:0,right:0,bottom:0,height:'calc(100vh - 60px)',zIndex:10000});document.body.append(host);
    const f={host,scene,claims:[],releases:[],events:[],publications:[],mode:'delay',claimed:null,resolvers:[]};
    const presence={getTime:()=>Date.now(),update:s=>f.publications.push({...s}),claimSeat:id=>{
      f.claims.push(id);f.events.push('claim:'+id);
      if(f.mode==='throw')return Promise.reject(new Error('controlled unavailable lease'));
      if(f.mode==='deny')return Promise.resolve(false);
      if(f.mode==='grant'){f.claimed=id;return Promise.resolve(true);}
      return new Promise(resolve=>f.resolvers.push(granted=>{if(granted)f.claimed=id;resolve(granted);}));
    },releaseSeat:async id=>{f.releases.push(id);f.events.push('release:'+id);if(!id||f.claimed===id)f.claimed=null;return true;}};
    const world=QPSchoolRoomWorld.mount(host,{scene,user:{uid:'input-self',name:'입력 검증',avatar:me.av},renderAvatar:QPAvatar.render,presence,checkpoint:scene.seats[0].approach});
    Object.assign(f,{world,presence});window.__inputFixture=f;world.focus();
  });
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(15);await page.keyboard.press('KeyC');
  await page.waitForFunction(()=>__inputFixture.claims.length===1&&__inputFixture.world.getState().seatPending);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(170);
  const pending=await page.evaluate(()=>__inputFixture.world.getState());assert.ok(pending.seatPending);assert.equal(pending.moving,false);
  await page.evaluate(()=>__inputFixture.resolvers.shift()(true));await page.waitForFunction(()=>__inputFixture.world.getState().seatId==='seat-1');
  await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>__inputFixture.world.getState().seatId),'seat-1');
  await page.keyboard.up('ArrowRight');await waitPose('sit');
  pass('C stops a held movement key; its repeats cannot cancel a delayed chair claim',{seatId:'seat-1'});
  await page.keyboard.press('KeyC');await waitIdle();

  await page.evaluate(()=>{const f=__inputFixture;f.mode='deny';f.claims=[];f.releases=[];f.events=[];});
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.claims.length===1&&!__inputFixture.world.getState().seatPending);
  assert.equal(await page.evaluate(()=>__inputFixture.world.getState().seatId),null);
  await waitPose('idle');assert.match(await page.locator('#inputFixture .sr-notice').textContent(),/친구/);
  await page.evaluate(()=>__inputFixture.mode='throw');await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.claims.length===2&&!__inputFixture.world.getState().seatPending);
  assert.equal(await page.evaluate(()=>__inputFixture.world.getState().seatId),null);assert.match(await page.locator('#inputFixture .sr-notice').textContent(),/확인하지 못/);
  await page.evaluate(()=>__inputFixture.mode='grant');await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.world.getState().seatId==='seat-1');await waitPose('sit');
  pass('Denied and failed leases leave a standing avatar; a C retry really sits',{attempts:3});
  await page.keyboard.press('KeyC');await waitIdle();

  await page.evaluate(()=>{const f=__inputFixture;f.mode='delay';f.claims=[];f.releases=[];f.events=[];f.resolvers=[];});
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.claims.length===1&&__inputFixture.world.getState().seatPending);
  await page.keyboard.press('KeyC');assert.equal(await page.evaluate(()=>__inputFixture.world.getState().seatPending),false);
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.world.getState().seatPending);
  assert.equal(await page.evaluate(()=>__inputFixture.claims.length),1,'retry waits until the old grant is released');
  await page.evaluate(()=>__inputFixture.resolvers.shift()(true));await page.waitForFunction(()=>__inputFixture.claims.length===2);
  assert.ok(await page.evaluate(()=>__inputFixture.world.getState().seatPending),'old completion must not clear the new pending request');
  assert.deepEqual(await page.evaluate(()=>__inputFixture.events),['claim:seat-1','release:seat-1','claim:seat-1']);
  await page.evaluate(()=>__inputFixture.resolvers.shift()(true));await page.waitForFunction(()=>__inputFixture.world.getState().seatId==='seat-1');await waitPose('sit');
  assert.equal(await page.evaluate(()=>__inputFixture.claimed),'seat-1');
  pass('Cancelled same-seat retry serializes stale release before the next claim',{events:await page.evaluate(()=>__inputFixture.events)});
  await page.keyboard.press('KeyC');await waitIdle();

  await page.evaluate(()=>{const f=__inputFixture;f.claims=[];f.releases=[];f.events=[];f.resolvers=[];});
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.world.getState().seatPending&&__inputFixture.claims.length===1);
  await page.keyboard.down('ArrowDown');await page.waitForTimeout(160);await page.keyboard.up('ArrowDown');
  await page.evaluate(()=>__inputFixture.resolvers.shift()(true));await page.waitForFunction(()=>__inputFixture.releases.length===1);await waitIdle();
  assert.equal(await page.evaluate(()=>__inputFixture.world.getState().seatId),null);assert.equal(await page.evaluate(()=>__inputFixture.claimed),null);
  pass('New walking input cancels a pending seat and a late grant is released',{});

  const floor=await page.evaluate(()=>{const f=__inputFixture,w=f.world;for(const p of [{x:760,y:700},{x:780,y:620},{x:1220,y:885}])if(w.canStand(p.x,p.y)&&w.nav.route(w.getState(),p)){const v=f.host.querySelector('.school-room-world').getBoundingClientRect(),c=w.getState().camera,sx=v.x+(p.x-c.x)*c.scale,sy=v.y+(p.y-c.y)*c.scale;if(document.elementFromPoint(sx,sy)?.closest('.school-room-world'))return {...p,sx,sy};}return null;});
  assert.ok(floor);await page.mouse.click(floor.sx,floor.sy);await page.waitForFunction(p=>Math.hypot(__inputFixture.world.getState().x-p.x,__inputFixture.world.getState().y-p.y)<2&&!__inputFixture.world.getState().moving,floor);
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>__inputFixture.world.getState().pose==='sit-floor');await waitPose('floor-sit');
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>__inputFixture.world.getState().pose),'sit-floor');
  await page.screenshot({path:path.join(out,'02-C-바닥앉기.png')});await page.keyboard.press('KeyC');await waitIdle();
  pass('C independently toggles floor sit; E leaves floor seating intact',floor);
  const speed=await page.evaluate(async()=>{const w=__inputFixture.world,start=w.getState();w.focus();let seconds=0,last=performance.now();const sampling=new Promise(resolve=>{function frame(now){seconds+=Math.min(.035,(now-last)/1000);last=now;if(seconds>=.5)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});window.__speedSample={start,sampling,getSeconds:()=>seconds};return true;});
  assert.ok(speed);await page.keyboard.down('ArrowRight');await page.evaluate(()=>__speedSample.sampling);await page.keyboard.up('ArrowRight');await waitIdle();
  const measurement=await page.evaluate(()=>{const end=__inputFixture.world.getState(),s=__speedSample;return{distance:Math.hypot(end.x-s.start.x,end.y-s.start.y),seconds:s.getSeconds(),allLegal:__inputFixture.publications.every(p=>p.seatId||__inputFixture.world.canStand(p.x,p.y))};});
  assert.ok(measurement.distance/measurement.seconds>307.5&&measurement.distance/measurement.seconds<367.5,JSON.stringify(measurement));assert.ok(measurement.allLegal);
  pass('Actual keyboard speed is 337.5 units/s with legal collision subdivision',measurement);

  // Click a real chair again, then cancel by leaving before the controlled grant.
  const click=await page.evaluate(()=>{const f=__inputFixture,s=f.scene.seats[0],v=f.host.querySelector('.school-room-world').getBoundingClientRect(),c=f.world.getState().camera;return{x:v.x+(s.rect.x+31-c.x)*c.scale,y:v.y+(s.rect.y+50-c.y)*c.scale};});
  await page.mouse.click(click.x,click.y);await page.waitForFunction(()=>__inputFixture.world.getState().seatPending,{},{timeout:16000});
  const pendingSeat=await page.evaluate(()=>__inputFixture.world.getState().seatPendingId);
  await page.evaluate(()=>__inputFixture.world.destroy());const publications=await page.evaluate(()=>__inputFixture.publications.length);
  await page.evaluate(()=>__inputFixture.resolvers.shift()(true));await page.waitForFunction(id=>__inputFixture.releases.includes(id),pendingSeat);await page.waitForTimeout(200);
  assert.equal(await page.locator('#inputFixture .sr-actor').count(),0);assert.equal(await page.evaluate(()=>__inputFixture.publications.length),publications);assert.equal(await page.evaluate(()=>__inputFixture.claimed),null);
  pass('Real chair clicking still approaches it; destroy releases a delayed grant and stops rendering',{seat:pendingSeat});
  assert.deepEqual(errors,[]);const result={ok:true,target,at:new Date().toISOString(),checks,errors};fs.writeFileSync(path.join(out,'결과.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,target,checks:checks.length,errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
