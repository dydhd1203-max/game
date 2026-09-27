import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=process.argv[2]||GAME,out=path.resolve('artifacts/race78');fs.mkdirSync(out,{recursive:true});
const server=serve(20585,file);let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let frozen=null;
  window.__freezeSlide=()=>{frozen=real();};window.__captureRaf=raf;window.__advance=ms=>{frozen+=ms;window.__loop73();};performance.now=()=>frozen??real();requestAnimationFrame=f=>frozen===null?raf(f):0;localStorage.setItem('sndOn','0');});
 await page.goto('http://127.0.0.1:20585/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
 await page.evaluate(()=>{const W=window;document.getElementById('iName').value='무지개 미끄럼 검수';document.getElementById('bSolo').click();W.__introDone();
  document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freezeSlide();W.__DBG().noRender=true;
  W.__G.phase='mini';W.__G.mini={k:0,st:'intro',seed:13,sc:[0,0,0,0,0]};W.__G.t=10;W.__miniEnter();W.__G.players.clear();
  // Let real transient entry messages expire; hide only the test diagnostics.
  for(let f=0;f<240;f++)W.__advance(1000/60);
  for(const e of document.body.children)if(e.style.zIndex==='99999'&&e.style.whiteSpace==='pre'&&e.style.pointerEvents==='none')e.style.display='none';
  W.__G.mini.st='run';});
 const result=await page.evaluate(()=>{const W=window,P=W.__PL,G=W.__G,A=W.__race74,K=W.__KEY,C=W.__cam,Y=W.__MINI().Y,results=[];
  const clear=()=>{for(const k of Object.keys(K))delete K[k];},slide=W.__RACE_P().find(p=>p.shape==='slide');
  const reset=(x,z,fps)=>{clear();A.reset();W.__kbReset();G.paused=false;G.t=180;W.__MINE.cp=6;W.__MINE.fin=-1;W.__setStamina(1);
   Object.assign(W.__RACE(),{t:2,on:true,fallT:0,hitCd:0,slipT:0,cp:{x:0,z:680,y:30}});
   Object.assign(P,{x,z,y:A.surface(slide,x,z),vx:0,vz:0,vy:0,_px:x,_pz:z,ground:true,jumps:0,down:false,yaw:Math.PI,pitch:-.22,flipT:99});
   G.mini.st='intro';for(let f=0;f<fps;f++)W.__updPlayer(1/fps);G.mini.st='run';};
  const inspect=()=>{C.updateMatrixWorld();const v=C.position.clone().set(P.x,P.y+.85,P.z).project(C);
   return {floor:W.__RACE_P().filter(p=>W.__raceCameraFloorBlocked(p,C.position.x,C.position.y,C.position.z,.18)).map(p=>p.id),
    hazards:W.__raceHazards(W.__RACE().t).filter(h=>W.__raceCameraBlocked(h,C.position.x,C.position.y-Y,C.position.z,.08)).map(h=>h.id),
    screen:{x:v.x,y:v.y,z:v.z},distance:W.__camRig().distance,lift:A.state.cameraLift,viewChange:Math.abs(P.yaw-Math.PI)+Math.abs(P.pitch+.22)};};
  for(const fps of [30,60,120])for(const mode of ['normal','fast','brake'])for(const z of [698,712,730,742]){
   const x=z===712?3.4:-3.4;reset(x,z,fps);P.vz=mode==='fast'?66:58;if(mode==='fast')K.w=true;if(mode==='brake')K.s=true;
   const frames=[];for(let f=0;f<Math.round(fps*.15);f++){G.t-=1/fps;W.__updPlayer(1/fps);A.tick(1/fps);frames.push(inspect());}
   results.push({fps,mode,startZ:z,frames});
  }
  // One continuous input-only descent supplies actual sliding screenshots.
  reset(-3.4,690.4,60);P.vz=19;let hit=false;
  W.__slideCameraRun=mark=>{for(let f=0;f<240&&P.z<mark;f++){
   const z=P.z,ahead=z+P.vz*.12,target=(ahead<703?-3.4:ahead>739?-3.4:-3.4*Math.cos((ahead-703)/18*Math.PI))-P.vx*.07;
   clear();K[z<744?'s':'w']=true;if(P.x<target-.1)K.a=true;else if(P.x>target+.1)K.d=true;
   W.__advance(1000/60);hit ||= W.__RACE().hitCd>0;
  }W.__paintMini();W.__drawFrame();return {name:'slide-live-'+mark,player:{x:P.x,y:P.y,z:P.z},camera:{x:C.position.x,y:C.position.y,z:C.position.z},check:inspect(),ground:P.ground,speed:P.vz,hit,checkpoint:W.__MINE.cp};};
  return {results,shots:[]};
 });
 for(const mark of [706,718,733,746]){
  const shot=await page.evaluate(mark=>window.__slideCameraRun(mark),mark);result.shots.push(shot);
  await page.evaluate(()=>new Promise(resolve=>{let f=0;window.__slideDrawing=true;const draw=()=>{if(!window.__slideDrawing)return;window.__paintMini();window.__drawFrame();if(++f===2)resolve();window.__captureRaf(draw);};window.__captureRaf(draw);}));
  await page.screenshot({path:path.join(out,shot.name+'.png')});await page.evaluate(()=>{window.__slideDrawing=false;});
 }
 const finish=await page.evaluate(()=>window.__slideCameraRun(760));result.hit=finish.hit;result.checkpoint=finish.checkpoint;
 fs.writeFileSync(path.join(out,'slide-camera.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(result.results.length,36);
 assert.ok(result.results.every(q=>q.frames.every(f=>f.floor.length===0&&f.hazards.length===0&&f.viewChange<1e-8)),'Normal/fast/braked camera near volume stays outside the deck and hazards at 30/60/120 Hz');
 assert.ok(result.shots.length===4&&!result.hit&&result.checkpoint===7,'The actual live slalom reaches its checkpoint without touching an obstacle');
 assert.ok(result.shots.every(q=>q.ground&&Math.abs(q.check.screen.x)<1&&Math.abs(q.check.screen.y)<1&&q.check.floor.length===0),'All actual sliding captures retain the avatar in frame above the visible deck');
 console.log('PASS: 36 native camera motion probes and 4 actual sliding captures');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
