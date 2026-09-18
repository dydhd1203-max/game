// One hidden browser; no mouse/keyboard APIs or desktop automation. Pointer lock
// is disabled by pw.mjs. Local server has no multiplayer backend.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const out=path.resolve('artifacts/54-view');fs.mkdirSync(out,{recursive:true});
const server=serve(8954,process.argv[2]||GAME);
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const watchdog=setTimeout(()=>browser.close().finally(()=>server.close()),150000);
const page=await browser.newPage({viewport:{width:1366,height:768}}), checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ok=(name,pass,value)=>{checks.push({name,pass:!!pass,value});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(value??''));};
try{
  await page.goto('http://127.0.0.1:8954/?gfx=low',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__READY===true);
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.screenshot({path:path.join(out,'wardrobe-lobby.png')});
  await page.evaluate(()=>{document.getElementById('iName').value='화면검사';document.getElementById('bSolo').click();});
  await page.waitForFunction(()=>window.__G.started);
  await page.evaluate(()=>{window.__G.paused=true;window.__DBG().noLogic=true;});
  for(const [width,height] of [[1366,768],[1024,600],[800,600],[390,844]]){
    await page.setViewportSize({width,height});
    const layout=await page.evaluate(async()=>{
      const W=window,G=W.__G,P=W.__PL;
      G.phase='day';G.mini=null;P.down=false;
      document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
      W.__shopTab('w');W.__buildShopUI();document.getElementById('popShop').classList.add('on');
      const list=document.getElementById('shopList');list.scrollTop=0;
      await Promise.all([...list.querySelectorAll('img')].map(im=>im.decode().catch(()=>{})));
      const cards=[...list.querySelectorAll('.sItem')].map(c=>{
        const r=c.getBoundingClientRect(),b=c.querySelector('button').getBoundingClientRect(),d=c.querySelector('.sd')?.getBoundingClientRect(),im=c.querySelector('img.ic');
        return {h:r.height,scroll:c.scrollHeight,client:c.clientHeight,buttonBottom:b.bottom-r.top,buttonTop:b.top-r.top,descBottom:d?.bottom-r.top,image:im?.getBoundingClientRect().width,natural:im?.naturalWidth};
      });
      const initialReachable=list.querySelector('button').getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom+1;
      list.lastElementChild?.scrollIntoView({block:'end'});
      const button=list.lastElementChild?.querySelector('button')?.getBoundingClientRect(),lr=list.getBoundingClientRect();
      return {cards,initialReachable,scrolls:list.scrollHeight>list.clientHeight,lastReachable:button&&button.bottom<=lr.bottom+1&&button.top>=lr.top,overflowX:document.documentElement.scrollWidth>innerWidth};
    });
    ok(`${width}x${height} whole shop cards and purchase buttons`,layout.cards.length>0&&layout.cards.every(c=>c.h>=c.buttonBottom&&c.client>=c.scroll-1)&&layout.lastReachable&&!layout.overflowX,layout);
    if(width>=800)ok(`${width}x${height} buy button visible without scrolling`,layout.initialReachable);
    if(width===1366)ok('weapon images use sharp 192px sources',layout.cards.every(c=>c.natural>=192));
    await page.evaluate(()=>document.getElementById('shopList').scrollTop=0);
    await page.screenshot({path:path.join(out,`shop-${width}.png`)});
  }
  const bought=await page.evaluate(()=>{
    const W=window;W.__shopTab('w');W.__buildShopUI();
    const b=[...document.querySelectorAll('#shopList button')].find(b=>!b.disabled&&b.textContent.includes('구매'));
    if(!b)return false;const before=W.__KIT.ownW.filter(Boolean).length;b.click();
    return W.__KIT.ownW.filter(Boolean).length===before+1;
  });
  ok('visible purchase button really buys a weapon',bought);
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>{document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));window.__openKit();});
  await page.screenshot({path:path.join(out,'bag.png')});
  const camera=await page.evaluate(()=>{
    const W=window,P=W.__PL,G=W.__G,C=W.__cam,T=W.__THREE;
    document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
    G.phase='day';G.mini=null;G.players.clear();W.__KEY.w=false;W.__KEY.shift=false;W.__kbReset();W.__recoilReset();W.__shakeReset();
    let spot;outer:for(let x=-30;x<=30;x+=3)for(let z=-30;z<=30;z+=3){const y=W.__groundUnder(x,z,P.R);if(y<0||y>80)continue;
      if([[0,0],[2,0],[-2,0],[0,4],[0,-4]].every(([dx,dz])=>Math.abs(W.__groundUnder(x+dx,z+dz,P.R)-y)<.01)){spot={x,z,y};break outer;}}
    if(!spot)throw Error('No open ground');
    const step=n=>{for(let i=0;i<n;i++){W.__updPlayer(1/60);W.__fovTick(1/60);}C.updateMatrixWorld(true);};
    Object.assign(P,spot,{vy:0,ground:true,yaw:0,pitch:-.22,landT:0,jumps:0});W.__setAim(false);step(100);
    const normal={...W.__camRig(),fov:C.fov,rotation:C.rotation.x};
    W.__setAim(true);step(100);const aim={...W.__camRig(),fov:C.fov,rotation:C.rotation.x};
    const {origin,direction}=W.__combatRay(),originCopy=origin.clone(),dirCopy=direction.clone();
    W.__KIT.wpn=1;const R=W.__WEAPONS[1].rng;
    const targets=[];
    for(const distance of [3,7,Math.min(14,R-1)]){
      const v=originCopy.clone().addScaledVector(dirCopy,distance+2.65),target={id:100+distance,x:v.x,y:v.y-.85,z:v.z,hp:100};
      G.wolves=[target];targets.push({distance,hit:W.__aimWolf()===target});
    }
    const end=W.__shotEndpoint(R).clone(),ndc=end.clone().project(C);
    const endpoint={center:Math.hypot(ndc.x,ndc.y),range:end.distanceTo(new T.Vector3(P.x,P.y+P.EYE,P.z))};
    const rear=originCopy.clone().addScaledVector(dirCopy,1.2);
    G.wolves=[{id:200,x:rear.x,y:rear.y-.85,z:rear.z,hp:100}];const rearRejected=W.__aimWolf()===null;
    const far=originCopy.clone().addScaledVector(dirCopy,R+5);
    G.wolves=[{id:201,x:far.x,y:far.y-.85,z:far.z,hp:100}];const farRejected=W.__aimWolf()===null;
    const saved=C.position.clone();C.position.x+=100;
    const fallback=W.__combatRay().origin.distanceTo(new T.Vector3(P.x,P.y+P.EYE,P.z));C.position.copy(saved);
    const jumps=[];G.wolves=[];W.__setAim(false);step(100);
    for(const hz of [30,60,120]){
      Object.assign(P,spot,{vy:0,ground:true,jumps:0,landT:0});step(60);let hidden=0,peak=0,lag=0,minY=1,maxY=-1,groundFlips=0,prevGround=true;
      for(let i=0;i<hz*2;i++){
        if(i===0||i===Math.round(hz*.18))W.__wantJump();W.__updPlayer(1/hz);C.updateMatrixWorld(true);
        const rig=W.__camRig();if(rig.hidden)hidden++;peak=Math.max(peak,P.y-spot.y);lag=Math.max(lag,Math.abs(P.y-W.__camGY()));
        if(prevGround!==P.ground)groundFlips++;prevGround=P.ground;
        for(const h of [0,1.5]){const q=new T.Vector3(P.x,P.y+h,P.z).project(C);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      }
      jumps.push({hz,hidden,peak,lag,minY,maxY,groundFlips,landed:P.ground});
    }
    return {normal,aim,targets,endpoint,R,jumps,rearRejected,farRejected,fallback};
  });
  ok('aim shoulder camera narrows FOV and lifts view',camera.aim.shoulder>.6&&camera.aim.distance<camera.normal.distance&&camera.aim.fov<camera.normal.fov&&camera.aim.rotation>camera.normal.rotation,camera);
  ok('near and far crosshair targeting',camera.targets.every(t=>t.hit),camera.targets);
  ok('miss endpoint stays on crosshair and weapon range',camera.endpoint.center<1e-5&&Math.abs(camera.endpoint.range-camera.R)<1e-5,camera.endpoint);
  ok('rear and out-of-range targets rejected; teleport ray fallback',camera.rearRejected&&camera.farRejected&&camera.fallback<1e-5,{rear:camera.rearRejected,far:camera.farRejected,fallback:camera.fallback});
  ok('jump visibility and framing at 30/60/120 Hz',camera.jumps.every(j=>!j.hidden&&j.peak>2&&j.lag<=.221&&j.minY>-.95&&j.maxY<.95&&j.groundFlips===2&&j.landed),camera.jumps);
  const bumps=await page.evaluate(()=>{
    const W=window,G=W.__G,P=W.__PL;W.__goMini(0);W.__raceBuild(8);W.__miniSet('run',90);G.t=90;
    Object.assign(P,{x:0,z:0,y:W.__MINI().Y,ground:true,down:false});G.players.clear();W.__kbReset();
    G.players.set('bump-peer',{uid:'bump-peer',x:.5,z:0,y:P.y});W.__sheepBump(1/60,5,0);
    const one={...W.__kb(),dx:P.x};W.__kbReset();P.x=0;G.players.clear();
    for(let i=0;i<20;i++)G.players.set('peer'+i,{uid:'peer'+i,x:.4+(i%4)*.05,z:(i%5-2)*.05,y:P.y});
    W.__sheepBump(1/60,5,0);const crowd=Math.hypot(W.__kb().x,W.__kb().z);
    return {one,crowd};
  });
  ok('race contact still pushes gently and dense crowd force is bounded',bumps.one.dx<0&&bumps.one.x<0&&bumps.crowd>0&&bumps.crowd<=3.501,bumps);
  await page.addStyleTag({content:'body > :not(#app){display:none!important}'});
  await page.evaluate(async()=>{
    const W=window,C=W.__cam,y=W.__MINI().Y;W.__G.players.clear();W.__drawSheep([],0,40,()=>0,1);
    C.position.set(38,y+30,175);C.lookAt(0,y+1,225);C.fov=60;C.updateProjectionMatrix();
    await new Promise(requestAnimationFrame);W.__render();
  });
  await page.screenshot({path:path.join(out,'race-world.png')});
  const zombieRender=await page.evaluate(()=>{
    const W=window,T=W.__THREE,S=W.__scene,C=W.__cam;
    W.__DBG().noInst=true;W.__G.mini=null;W.__G.day=3;W.__setNk(0);W.__terrH.fill(W.__GY);
    const meshes=W.__charMeshes()['좀비'],keep=new Set(meshes);
    for(const child of S.children)child.visible=keep.has(child);
    S.fog=null;S.background=new T.Color('#dfeef6');
    S.add(new T.HemisphereLight(0xeaf5ff,0x687889,2));
    const key=new T.DirectionalLight(0xfff3da,2);key.position.set(4,10,7);S.add(key);
    const types=[0,1,2,W.__WOLF_T.findIndex(d=>d.n.includes('공포'))];
    const actors=types.map((k,i)=>({id:i+10,k,x:(i-1.5)*2,z:0,ry:0,ph:i*.3,hp:40,mx:40,mv:false,atkT:0,hurt:0}));
    W.__drawWolves(actors,4,1/60);
    const y=W.__GY;C.position.set(0,y+2.5,10);C.lookAt(0,y+1,0);C.fov=43;C.updateProjectionMatrix();W.__render();
    return {meshes:meshes.length,instances:meshes.reduce((n,m)=>n+m.count,0)};
  });
  ok('actual zombie meshes render in WebGL',zombieRender.meshes>20&&zombieRender.instances>60,zombieRender);
  await page.screenshot({path:path.join(out,'zombies-webgl.png')});
  ok('no browser runtime errors',!errors.length,errors);
}finally{
  clearTimeout(watchdog);await browser.close();server.close();
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,errors},null,2));
}
if(checks.some(c=>!c.pass)||errors.length)process.exitCode=1;
