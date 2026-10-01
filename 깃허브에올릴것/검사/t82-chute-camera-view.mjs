// 82차 roller coaster: the actual game-loop camera never enters the U deck or a candy, never turns the view,
// and a real-input ride keeps the avatar in frame (screenshots in artifacts/race82).
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=process.argv[2]||GAME,out=path.resolve('artifacts/race82');fs.mkdirSync(out,{recursive:true});
const server=serve(20586,file);let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let frozen=null;
  window.__freezeSlide=()=>{frozen=real();};window.__captureRaf=raf;window.__advance=ms=>{frozen+=ms;window.__loop73();};performance.now=()=>frozen??real();requestAnimationFrame=f=>frozen===null?raf(f):0;localStorage.setItem('sndOn','0');});
 await page.goto('http://127.0.0.1:20586/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
 await page.evaluate(()=>{const W=window;document.getElementById('iName').value='롤러코스터 검수';document.getElementById('bSolo').click();W.__introDone();
  document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freezeSlide();W.__DBG().noRender=true;
  W.__G.phase='mini';W.__G.mini={k:0,st:'intro',seed:13,sc:[0,0,0,0,0]};W.__G.t=10;W.__miniEnter();W.__G.players.clear();
  // Let real transient entry messages expire; hide only the test diagnostics.
  for(let f=0;f<240;f++)W.__advance(1000/60);
  for(const e of document.body.children)if(e.style.zIndex==='99999'&&e.style.whiteSpace==='pre'&&e.style.pointerEvents==='none')e.style.display='none';
  W.__G.mini.st='run';});
 const result=await page.evaluate(()=>{const W=window,P=W.__PL,G=W.__G,A=W.__race74,K=W.__KEY,C=W.__cam,Y=W.__MINI().Y,CH=W.__CH82,results=[];
  const clear=()=>{for(const k of Object.keys(K))delete K[k];},chute=W.__RACE_P().find(p=>p.chute);
  const Q=z=>{const q=W.__chuteQ82(z);return {cx:q.cx,sn:q.sn,cs:q.cs};};
  const reset=(x,z,V,y,fps)=>{clear();A.reset();W.__kbReset();G.paused=false;G.t=180;W.__MINE.cp=6;W.__MINE.fin=-1;W.__setStamina(1);
   Object.assign(W.__RACE(),{t:2,on:true,fallT:0,hitCd:0,slipT:0,cp:{x:0,z:680,y:30}});const q=Q(z);
   Object.assign(P,{x,z,y:y??A.surface(chute,x,z),vx:q.sn*V,vz:q.cs*V,vy:0,_px:x,_pz:z,ground:true,jumps:0,down:false,yaw:Math.PI,pitch:-.22,flipT:99});
   G.mini.st='intro';for(let f=0;f<fps;f++)W.__updPlayer(1/fps);G.mini.st='run';const q2=Q(z);Object.assign(P,{x,z,y:y??A.surface(chute,x,z),vx:q2.sn*V,vz:q2.cs*V,vy:0,_px:x,_pz:z,ground:true});};
  const inspect=()=>{C.updateMatrixWorld();const v=C.position.clone().set(P.x,P.y+.85,P.z).project(C);
   return {floor:W.__RACE_P().filter(p=>W.__raceCameraFloorBlocked(p,C.position.x,C.position.y,C.position.z,.18)).map(p=>p.id),
    hazards:W.__raceHazards(W.__RACE().t).filter(h=>W.__raceCameraBlocked(h,C.position.x,C.position.y-Y,C.position.z,.08)).map(h=>h.id),
    screen:{x:v.x,y:v.y,z:v.z},viewChange:Math.abs(P.yaw-Math.PI)+Math.abs(P.pitch+.22)};};
  // Probe starts: S1 wall ride (both walls), hump crest, candy approach on a wall, S2, kicker.
  const starts=[[60,-7],[104,7],[150,0],[238,-8],[300,4],[360,0]];
  for(const fps of [30,60,120])for(const mode of ['normal','fast','brake'])for(const [zr,d] of starts){
   const z=CH.z0+zr,q=Q(z);reset(q.cx+d/q.cs,z,mode==='fast'?58:mode==='brake'?30:46,null,fps);if(mode==='fast')K.w=true;if(mode==='brake')K.s=true;
   const frames=[];for(let f=0;f<Math.round(fps*.15);f++){G.t-=1/fps;W.__updPlayer(1/fps);A.tick(1/fps);frames.push(inspect());}
   results.push({fps,mode,startZ:z,d,frames});
  }
  // One continuous real-input ride (W + steering into the lane a child can see ahead) supplies the screenshots.
  const rows=CH.bumpRows.map(([zr,ds,Rr])=>({z:CH.z0+zr,ds,R:Rr||CH.bumpR}));
  const gaps=row=>{const lim=CH.hw-P.R-.03,bl=row.ds.map(d=>[d-row.R-P.R-.35,d+row.R+P.R+.35]).sort((a,b)=>a[0]-b[0]),o=[];let cur=-lim;
    for(const [a,b] of bl){if(a>cur)o.push([cur,a]);cur=Math.max(cur,b);}if(cur<lim)o.push([cur,lim]);return o.filter(([a,b])=>b-a>.6);};
  reset(0,682,0,Y+30.075,60);let hit=false;
  W.__chuteCameraRun=mark=>{for(let f=0;f<1200&&P.z<mark;f++){clear();K.w=true;
    if(P.z>CH.z0){const nxt=rows.find(r=>r.z+r.R>P.z);if(nxt&&nxt.z-P.z<70){const q=W.__chuteQ82(P.z),d=(P.x-q.cx)*q.cs,vd=P.vx*q.cs-P.vz*q.sn,pred=d+vd*.3;let best=null,bd=1e9;
      for(const [a,b] of gaps(nxt)){const w=b-a,tg=Math.max(a+Math.min(2,w/2),Math.min(b-Math.min(2,w/2),pred));if(Math.abs(tg-pred)<bd){bd=Math.abs(tg-pred);best=tg;}}
      if(best!==null){if(pred<best-.35)K.a=true;else if(pred>best+.35)K.d=true;}}}
    W.__advance(1000/60);hit ||= W.__RACE().hitCd>0;
   }W.__paintMini();W.__drawFrame();return {name:'chute-live-'+mark,player:{x:P.x,y:P.y,z:P.z},camera:{x:C.position.x,y:C.position.y,z:C.position.z},check:inspect(),ground:P.ground,hit,checkpoint:W.__MINE.cp};};
  return {results,shots:[]};
 });
 const Z0=await page.evaluate(()=>window.__CH82.z0);
 for(const rel of [60,110,245,290,330,362]){
  const shot=await page.evaluate(mark=>window.__chuteCameraRun(mark),Z0+rel);result.shots.push(shot);
  await page.evaluate(()=>new Promise(resolve=>{let f=0;window.__chuteDrawing=true;const draw=()=>{if(!window.__chuteDrawing)return;window.__paintMini();window.__drawFrame();if(++f===2)resolve();window.__captureRaf(draw);};window.__captureRaf(draw);}));
  await page.screenshot({path:path.join(out,shot.name+'.png')});await page.evaluate(()=>{window.__chuteDrawing=false;});
 }
 const finish=await page.evaluate(()=>{const W=window;for(let f=0;f<400&&W.__MINE.cp<7;f++)W.__chuteCameraRun(W.__PL.z+2);return window.__chuteCameraRun(window.__PL.z+.1);});
 result.hit=finish.hit;result.checkpoint=finish.checkpoint;
 fs.writeFileSync(path.join(out,'chute-camera.json'),JSON.stringify({result,errors},null,2));
 const bad=result.results.filter(q=>!q.frames.every(f=>f.floor.length===0&&f.hazards.length===0&&f.viewChange<1e-8)).map(q=>({fps:q.fps,mode:q.mode,z:q.startZ,d:q.d,frame:q.frames.find(f=>f.floor.length||f.hazards.length||f.viewChange>=1e-8)}));
 console.log(JSON.stringify({bad:bad.slice(0,6),shots:result.shots.map(s=>({name:s.name,ground:s.ground,screen:s.check.screen,floor:s.check.floor,hazards:s.check.hazards})),hit:result.hit,checkpoint:result.checkpoint,errors},null,1));
 assert.deepEqual(errors,[]);assert.equal(result.results.length,54);
 assert.ok(bad.length===0,'Normal/fast/braked camera near volume stays outside the U deck and candies at 30/60/120 Hz');
 assert.ok(result.shots.length===6&&!result.hit&&result.checkpoint===7,'The actual live ride threads every candy row and reaches its checkpoint');
 assert.ok(result.shots.every(q=>Math.abs(q.check.screen.x)<1&&Math.abs(q.check.screen.y)<1&&q.check.floor.length===0&&q.check.hazards.length===0),'All live captures keep the avatar in frame with the camera outside the deck');
 console.log('PASS: 54 native camera motion probes and 6 actual roller-coaster captures');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
