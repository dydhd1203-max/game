// Real WebGL race inspection. Software-renderer CPU timings are NOT LG Gram FPS.
// Usage: node t74-race-view.mjs [game.html] [--baseline]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';

const file=process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME;
const baseline=process.argv.includes('--baseline'), label=baseline?'baseline73':'race74';
const captureOnly=process.argv.includes('--capture-only');
const out=path.resolve('artifacts/race74');fs.mkdirSync(out,{recursive:true});
const server=serve(20575,file);let browser;
try {
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{
    const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
    window.__realNow=real;window.__freeze=()=>{time=real();};
    window.__advance=ms=>{time+=ms;window.__loop73();};
    performance.now=()=>time===null?real():time;requestAnimationFrame=f=>time===null?raf(f):0;
    localStorage.setItem('sndOn','0');
  });
  await page.goto('http://127.0.0.1:20575/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});
  await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
  await page.evaluate(()=>{
    const W=window;document.getElementById('iName').value='경주 검수';document.getElementById('bSolo').click();
    W.__introDone();document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));
    W.__freeze();W.__DBG().noRender=true;
    const G=W.__G,P=W.__PL;G.phase='mini';G.host=false;G.paused=false;
    G.mini={k:0,st:'intro',seed:740021,sc:[0,0,0,0,0],rank:null};G.t=10;
    for(let i=0;i<20;i++){const id='race_friend_'+String(i).padStart(2,'0');
      G.players.set(id,{uid:id,x:0,y:W.__MINI().Y,z:0,tx:0,ty:W.__MINI().Y,tz:0,ry:Math.PI,g:i%5,n:'친구'+(i+1),mv:true,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});
      W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});}
    W.__miniEnter();G.mini.st='run';G.t=W.__MINI().RACE;W.__miniOnState();
    W.__camZoom(3.2);P.yaw=Math.PI;P.pitch=-.22;W.__XP.job=-1;W.__XP.jt=0;
    W.__crowdAt=(x,z,y)=>{let i=0;for(const q of G.players.values()){
      const qx=x+(i%5-2)*2.2,qz=z+3+Math.floor(i/5)*2.2;
      Object.assign(q,{x:qx,tx:qx,y,ty:y,z:qz,tz:qz,ry:Math.PI,mv:true});i++;}};
  });
  const results=await page.evaluate(()=>{
    const W=window,G=W.__G,P=W.__PL,R=W.__R,Y=W.__MINI().Y;
    const stages=[{name:'start',x:0,z:18,y:Y},{name:'middle',...(()=>{const p=W.__RACE_P().find(p=>p.cp===4);return{x:p.x,z:p.z,y:Y+p.y};})()},
      {name:'finish',...(()=>{const p=W.__RACE_P().find(p=>p.fin);return{x:p.x,z:p.z,y:Y+p.y};})()}];
    if(W.__race74)for(let sec=0;sec<7;sec++){
      const choices=W.__RACE_P().filter(p=>p.sec===sec&&!p.cp&&!p.fin),p=choices[Math.floor(choices.length/2)];
      stages.push({name:'section-'+(sec+1),x:p.x,z:p.z,y:W.__race74.surface(p,p.x,p.z),detail:true});
    }
    const captures=[],timing=[],overflow=[];
    for(const stage of stages){
      Object.assign(P,{x:stage.x,y:stage.y,z:stage.z,vx:0,vz:0,vy:0,ground:true,down:false,mv:false,yaw:Math.PI,pitch:-.22});
      W.__crowdAt(stage.x,stage.z,stage.y);
      if(stage.detail)for(const q of G.players.values()){const y=W.__raceTopAt(q.x,q.z);if(y>Y-10){q.y=y;q.ty=y;}}
      W.__MINE.fin=stage.name==='finish'?999:-1;
      for(let i=0;i<(stage.detail?45:150);i++){
        P.x=stage.x;P.y=stage.y;P.z=stage.z;P.vy=0;P.ground=true;
        const t=W.__realNow();W.__advance(1000/60);if(i>=30&&!stage.detail)timing.push(W.__realNow()-t);
      }
      if(stage.detail){R.info.autoReset=false;R.info.reset();W.__drawFrame();
        captures.push({name:'play-'+stage.name,png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length});}
      // Camera deliberately identical relative to the player for before/after art comparison.
      W.__cam.position.set(stage.x+8,stage.y+7,stage.z-12);W.__cam.lookAt(stage.x,stage.y+1,stage.z+15);
      R.info.autoReset=false;R.info.reset();W.__drawFrame();
      captures.push({name:stage.name,png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length,...W.__race74?{raceArt:{...W.__race74.art().stats}}:{}});
    }
    const longCourse=W.__RACE_Z_FIN>400;
    let oldZ,flags;
    if(longCourse&&W.__race74?.draw){const A=W.__race74.art();oldZ=P.z;flags=A.static.map(s=>s.always);
      // Debug overview only: remove distance culling for this one photograph.
      A.static.forEach(s=>s.always=true);P.z=NaN;W.__race74.draw();
      A.static.forEach(s=>{s.mesh.geometry.setDrawRange(0,Infinity);s.mesh.visible=true;});
    }
    W.__cam.position.set(longCourse?220:75,Y+(longCourse?210:125),longCourse?W.__RACE_Z_FIN*.45:155);
    W.__cam.lookAt(0,Y,longCourse?W.__RACE_Z_FIN*.5:185);R.info.reset();W.__drawFrame();
    captures.push({name:'overview',png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length});
    if(flags){P.z=oldZ;W.__race74.art().static.forEach((s,i)=>s.always=flags[i]);W.__race74.draw();}
    W.__scene.traverse(m=>{if(m.isInstancedMesh&&m.count>m.instanceMatrix.count)overflow.push({name:m.name,id:m.id,used:m.count,capacity:m.instanceMatrix.count});});
    timing.sort((a,b)=>a-b);
    const colorAttributes=W.__race74?[...['pad','padTrim','bar','ball','metal'].map(key=>{const m=W.__race74.art()[key],c=m.geometry.attributes.color;return {key,vertexColors:m.material.vertexColors,valid:!!c&&c.count===m.geometry.attributes.position.count&&c.array.every(Number.isFinite)&&c.array.some(v=>v>0)};})]:[];
    return {seed:G.mini.seed,players:G.players.size+1,graphics:{...W.__GFX,width:R.domElement.width,height:R.domElement.height},cpuMs:{p50:timing[Math.floor(timing.length*.5)],p95:timing[Math.floor(timing.length*.95)],samples:timing.length},overflow,captures,colorAttributes,sections:W.__RACE_S.map(s=>s.n),platformCount:W.__RACE_P().length,renderer:R.getContext().getParameter(R.getContext().RENDERER)};
  });
  if(!baseline)results.airCaptures=await page.evaluate(()=>{
    const W=window,A=W.__race74,P=W.__PL,G=W.__G,Y=W.__MINI().Y,pad=W.__RACE_P().find(p=>p.kind==='final'),shots=[];
    G.players.clear();W.__pcMap.clear();for(const k of Object.keys(W.__KEY))delete W.__KEY[k];W.__KEY.w=true;
    A.reset();const S=W.__RACE();S.t=0;S.on=true;S.fallT=S.hitCd=S.slipT=0;G.t=W.__MINI().RACE;W.__MINE.fin=-1;
    Object.assign(P,{x:pad.x,z:pad.z-6,y:Y+pad.y,vx:0,vz:0,vy:0,ground:true,down:false,jumps:0,flipT:99,yaw:Math.PI,pitch:-.22,_px:pad.x,_pz:pad.z-6});
    let air=false,landWait=-1;const got=new Set();
    const shot=name=>{W.__drawFrame();shots.push({name,png:W.__R.domElement.toDataURL('image/png'),y:P.y-Y,vy:P.vy,ground:P.ground,flight:A.state.flight,fov:W.__cam.fov,yaw:P.yaw,pitch:P.pitch});got.add(name);};
    for(let f=0;f<240;f++){
      G.t-=1/60;W.__advance(1000/60);
      if(A.state.pending&&!got.has('compression'))shot('compression');
      if(A.state.flight>.25&&P.vy>3&&!got.has('ascent'))shot('ascent');
      if(A.state.flight>.4&&Math.abs(P.vy)<.5&&!got.has('apex'))shot('apex');
      if(!P.ground&&A.state.flight>0)air=true;
      if(air&&P.ground&&landWait<0)landWait=3;
      if(landWait>=0&&--landWait===0){shot('landing');break;}
    }
    for(const k of Object.keys(W.__KEY))delete W.__KEY[k];return shots;
  });
  if(!baseline&&!captureOnly)results.physics=await page.evaluate(()=>{
    const W=window,A=W.__race74,P=W.__PL,G=W.__G,KEY=W.__KEY,Y=W.__MINI().Y,flights=[],carries=[],slides=[],routes=[];
    if(!A)throw Error('Missing __race74 physics hook');
    G.players.clear();W.__pcMap.clear();
    const clearKeys=()=>{for(const k of Object.keys(KEY))delete KEY[k];};
    const reset=(x,z,y)=>{clearKeys();A.reset();const S=W.__RACE();S.t=0;S.on=true;S.fallT=S.hitCd=S.slipT=0;
      G.t=W.__MINI().RACE;W.__MINE.fin=-1;W.__MINE.cp=0;W.__MINE.prog=0;
      Object.assign(P,{x,z,y,ground:true,vx:0,vz:0,vy:0,jumps:0,down:false,glide:false,yaw:Math.PI,pitch:-.22,_px:x,_pz:z,flipT:99,takeT:0});};
    const step=dt=>{G.t-=dt;W.__updPlayer(dt);A.tick(dt);};
    for(const seed of [13,7919,740021])for(const fps of [30,60,120]){
      G.mini.seed=seed;W.__raceBuild(seed);
      for(const pad of W.__RACE_P().filter(p=>p.bounce)){
        reset(pad.x,pad.z-2.4,Y+pad.y);KEY.w=true;
        let launched=false,landed=false,launches=0,air=false,peak=0,land=null,maxViewChange=0;
        let launchFrame=-1,launchVy=0,launchVz=0,launchY=0,flightSeconds=0,observedGravity=0;
        for(let f=0;f<fps*5;f++){
          const oldFlight=A.state.flight;step(1/fps);
          if(oldFlight===0&&A.state.flight>0){launched=true;launches++;launchFrame=f;launchVy=P.vy;launchVz=P.vz;launchY=P.y;}
          if(f===launchFrame+1&&launchFrame>=0&&!P.ground)observedGravity=(launchVy-P.vy)*fps;
          if(launched&&!P.ground)air=true;
          peak=Math.max(peak,P.y-Y-pad.y);maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));
          if(air&&P.ground){land=A.under();landed=!!land;flightSeconds=(f-launchFrame)/fps;break;}
          if(P.y<Y-6||W.__RACE().fallT>0)break;
        }
        const gravity=W.__gravNow(),oldDiscriminant=pad.bounce.v**2+2*gravity*(launchY-P.y);
        const uncompressedSeconds=oldDiscriminant>=0?(pad.bounce.v+Math.sqrt(oldDiscriminant))/gravity:0;
        flights.push({seed,fps,pad:pad.id,kind:pad.kind,launched,launches,landed,landingPad:land?.id,forward:P.z-(pad.z-2.4),peak,maxViewChange,
          launchRatioY:launchVy/pad.bounce.v,launchRatioZ:launchVz/pad.bounce.forward,gravityRatio:observedGravity/gravity,
          flightSeconds,uncompressedSeconds,timeRatio:uncompressedSeconds>0?flightSeconds/uncompressedSeconds:0});
      }
      const moving=W.__RACE_P().find(p=>p.mv),startX=moving.x+Math.sin(moving.mv.ph)*moving.mv.amp;
      reset(startX,moving.z,Y+moving.y);let grounded=true;
      for(let f=0;f<fps*2;f++){step(1/fps);grounded&&=P.ground;}
      carries.push({seed,fps,grounded,supported:A.contains(moving,P.x,P.z,.1,W.__RACE().t),shift:Math.abs(P.x-startX)});
      // Use the open slalom lane for the braking test; the central punch bag is
      // intentionally a collision obstacle, not part of the slide's friction.
      const slide=W.__RACE_P().find(p=>p.shape==='slide'),slideX=slide.x+4;
      reset(slideX,slide.z-slide.d*.3,A.surface(slide,slideX,slide.z-slide.d*.3));KEY.w=true;
      let groundedSlide=true;for(let f=0;f<fps;f++){step(1/fps);groundedSlide&&=P.ground;}
      const fast=P.vz;clearKeys();for(let f=0;f<fps*.6;f++)step(1/fps);
      slides.push({seed,fps,fast,released:P.vz,grounded:groundedSlide,supported:A.contains(slide,P.x,P.z,0,W.__RACE().t)});
    }
    // One deliberate continuous line through the whole course. Steer through
    // the starting slalom, pass the sweeps on their open sides, and choose the
    // clear slide lane. Only ordinary input is used: no teleports, invulnerability,
    // hazard disabling, sprint or jump. Isolated checks above exercise every pad.
    // This catches connecting gaps that isolated launch-pad checks cannot see.
    for(const seed of [13,7919,740021])for(const fps of [30,60,120]){
      G.mini.seed=seed;W.__raceBuild(seed);reset(0,-19,Y);
      let falls=0,wasFalling=false,maxViewChange=0,sec=0;
      for(let f=0;f<fps*90&&W.__MINE.fin<0;f++){
        const target=P.z<18?3:P.z<55?18:P.z<174?0:P.z<244?-16:P.z<468?0:P.z<510?4:0;
        clearKeys();KEY.w=true;if(P.x<target-.22)KEY.a=true;else if(P.x>target+.22)KEY.d=true;
        step(1/fps);sec=(f+1)/fps;
        const falling=W.__RACE().fallT>0;if(falling&&!wasFalling)falls++;wasFalling=falling;
        maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));
      }
      routes.push({seed,fps,finished:W.__MINE.fin>=0,seconds:sec,falls,checkpoint:W.__MINE.cp,z:P.z,maxViewChange});
    }
    // Race time belongs to the race, including frames where movement is skipped.
    // The normal case uses the real loop's bounded movement substeps so tick()
    // cannot count the same elapsed interval a second time.
    const clocks=[];
    for(const fps of [30,60,120])for(const mode of ['normal','popup','falling','paused']){
      reset(0,-19,Y);G.paused=false;const S=W.__RACE();
      if(mode==='falling'){S.fallT=1.5;P.y=Y-9;P.ground=false;}
      if(mode==='paused')G.paused=true;
      const start=S.t,dt=1/fps;
      for(let f=0;f<fps;f++){
        if(mode!=='paused')G.t-=dt;
        if(mode==='normal'||mode==='falling'){
          const steps=Math.ceil(dt/(1/50));for(let sub=0;sub<steps;sub++)W.__updPlayer(dt/steps);
        }
        A.tick(dt);
      }
      clocks.push({fps,mode,elapsed:S.t-start,expected:mode==='paused'?0:1});G.paused=false;
    }
    // A real landing on a previously used mat must arm it again. Position the
    // returning player over that same mat; gravity and the actual landing path
    // decide when contact occurs, rather than calling the launch function.
    const returnBounces=[];
    for(const fps of [30,60,120]){
      const pad=W.__RACE_P().find(p=>p.kind==='small');reset(pad.x,pad.z,Y+pad.y);KEY.w=true;
      let first=false;for(let f=0;f<fps;f++){step(1/fps);if(A.state.flight>0){first=true;break;}}
      clearKeys();Object.assign(P,{x:pad.x,z:pad.z,y:Y+pad.y+.5,vy:-5,vx:0,vz:0,ground:false,_px:pad.x,_pz:pad.z});
      let contacted=false,second=false;
      for(let f=0;f<fps;f++){
        step(1/fps);if(P.ground&&A.under()?.id===pad.id)contacted=true;
        if(contacted&&A.state.flight>0&&!P.ground){second=true;break;}
      }
      returnBounces.push({fps,first,contacted,second});
    }
    // The real outer loop clamps visual dt to 50 ms. At 10 FPS its race clock
    // must still receive the 100 ms elapsed time when a popup skips updPlayer.
    const actualLoopClocks=[],wasHost=G.host,popup=document.getElementById('popShop');
    for(const mode of ['normal','popup','paused']){
      popup.classList.remove('on');reset(0,-19,Y);G.host=true;G.paused=mode==='paused';KEY.w=true;
      if(mode==='popup')popup.classList.add('on');
      W.__advance(0);const raceStart=W.__RACE().t,hostStart=G.t,x=P.x,z=P.z;
      for(let f=0;f<10;f++)W.__advance(100);
      actualLoopClocks.push({mode,fps:10,elapsed:W.__RACE().t-raceStart,hostElapsed:hostStart-G.t,expected:mode==='paused'?0:1,moved:Math.hypot(P.x-x,P.z-z)});
      popup.classList.remove('on');G.paused=false;
    }
    G.host=wasHost;
    // Race-only knockback/animation state must not disable walking back in town.
    const S=W.__RACE();S.slipT=.8;S.hitCd=1;S.fallT=.5;S.knock={x:1,z:1};S.on=true;
    A.state.flight=1;A.state.rate=1.18;A.state.pending={p:W.__RACE_P().find(p=>p.bounce),t:.05};A.state.pulse.set(1,.8);
    Object.assign(P,{vx:3,vz:5,vy:8});clearKeys();G.phase='day';G.mini=null;W.__miniLeave();
    const leftRace={on:S.on,slip:S.slipT,hit:S.hitCd,fall:S.fallT,knock:S.knock,velocity:[P.vx,P.vy,P.vz],flight:A.state.flight,rate:A.state.rate,pending:A.state.pending,pulses:A.state.pulse.size};
    clearKeys();return {flights,carries,slides,routes,clocks,returnBounces,actualLoopClocks,leftRace};
  });
  for(const c of results.captures){fs.writeFileSync(path.join(out,`${label}-${c.name}.png`),Buffer.from(c.png.split(',')[1],'base64'));delete c.png;}
  for(const c of results.airCaptures||[]){fs.writeFileSync(path.join(out,`${label}-air-${c.name}.png`),Buffer.from(c.png.split(',')[1],'base64'));delete c.png;}
  fs.writeFileSync(path.join(out,`${label}${captureOnly?'-captures':''}.json`),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
  assert.equal(results.players,21);assert.deepEqual(results.overflow,[]);assert.deepEqual(errors,[]);
  assert.equal(results.sections.length,7);assert.equal(results.graphics.pr,.85);
  assert.ok(results.colorAttributes.every(c=>!c.vertexColors||c.valid),'Dynamic geometry must supply colors to vertex-colored materials');
  assert.ok(results.captures.every(c=>!c.raceArt||(c.raceArt.materials<=3&&c.raceArt.textures<=2&&c.raceArt.visibleDraws<=12&&c.raceArt.overflow===0)),'Race art stays inside its material, texture and draw budgets');
  if(results.airCaptures){assert.deepEqual(results.airCaptures.map(c=>c.name),['compression','ascent','apex','landing']);
    assert.ok(results.airCaptures.every(c=>Number.isFinite(c.fov)&&c.fov<=76.01),'Spring speed FOV stays within six degrees without sprint or jump kick');}
  if(results.physics){
    assert.ok(results.physics.flights.every(r=>r.launched&&r.launches===1&&r.landed&&r.forward>5&&r.peak>1.3&&r.maxViewChange<1e-8),'Every actual bounce must launch once, advance, land, and preserve view');
    assert.ok(results.physics.flights.every(r=>Math.abs(r.launchRatioY-1.18)<1e-8&&Math.abs(r.launchRatioZ-1.18)<1e-8&&Math.abs(r.gravityRatio-1.18**2)<1e-7),
      'Actual player integration must apply the faster spring impulse and its matching gravity');
    assert.ok(results.physics.flights.every(r=>r.flightSeconds>0&&r.timeRatio>.72&&r.timeRatio<.90),
      'Every spring must land faster than its original arc at 30/60/120 Hz');
    assert.ok(results.physics.carries.every(r=>r.grounded&&r.supported&&r.shift>.01),'Moving cloud mats must carry a standing player');
    assert.ok(results.physics.slides.every(r=>r.fast>16&&r.released<r.fast*.3&&r.grounded&&r.supported),'Slide must accelerate and permit controlled braking');
    assert.ok(results.physics.routes.every(r=>r.finished&&r.falls===0&&r.checkpoint===7&&r.seconds<90&&r.maxViewChange<1e-8),'The complete course must connect into a playable route at 30/60/120 Hz');
    assert.ok(results.physics.clocks.every(r=>Math.abs(r.elapsed-r.expected)<.02),'Race clock must advance once during normal movement, popups and falling, and stop while paused');
    assert.ok(results.physics.returnBounces.every(r=>r.first&&r.contacted&&r.second),'Landing back on the same bounce mat must permit another launch');
    assert.ok(results.physics.actualLoopClocks.every(r=>Math.abs(r.elapsed-r.expected)<.02&&Math.abs(r.hostElapsed-r.expected)<.02),'The real 10 FPS loop must retain elapsed race time even when popups skip movement and stop while paused');
    assert.ok(results.physics.actualLoopClocks.find(r=>r.mode==='popup').moved<1e-8,'The popup-clock check must actually skip movement');
    assert.deepEqual(results.physics.leftRace,{on:false,slip:0,hit:0,fall:0,knock:null,velocity:[0,0,0],flight:0,rate:1,pending:null,pulses:0},'Leaving a race must clear race-only movement state');
  }
  console.log(`PASS: ${label} 21 avatars, all sections present, bounded instance capacity, unchanged mid preset`);
} finally { await browser?.close();await new Promise(r=>server.close(r)); }
