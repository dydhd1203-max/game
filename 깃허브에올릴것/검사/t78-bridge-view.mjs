// Real input traversal of every fast moving circle; fixtures only set the stage entrance.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=process.argv[2]||GAME,out=path.resolve('artifacts/race78');fs.mkdirSync(out,{recursive:true});
const server=serve(20584,file);let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let frozen=null;
  window.__freezeBridge=()=>{frozen=real();};performance.now=()=>frozen??real();requestAnimationFrame=f=>frozen===null?raf(f):0;localStorage.setItem('sndOn','0');});
 await page.goto('http://127.0.0.1:20584/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
 await page.evaluate(()=>{const W=window;document.getElementById('iName').value='구름다리 검수';document.getElementById('bSolo').click();W.__introDone();
  document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freezeBridge();W.__DBG().noRender=true;
  W.__G.phase='mini';W.__G.mini={k:0,st:'intro',seed:13,sc:[0,0,0,0,0]};W.__G.t=10;W.__miniEnter();W.__G.players.clear();W.__G.mini.st='run';});
 const results=await page.evaluate(()=>{const W=window,P=W.__PL,G=W.__G,A=W.__race74,K=W.__KEY,Y=W.__MINI().Y,results=[];
  const clear=()=>{for(const k of Object.keys(K))delete K[k];};
  const step=dt=>{G.t-=dt;const n=Math.ceil(dt*120);for(let i=0;i<n;i++)W.__updPlayer(dt/n);A.tick(dt);};
  for(const seed of [13,7919,740021])for(const fps of [30,60,120]){
   G.mini.seed=seed;W.__raceBuild(seed);clear();W.__kbReset();G.phase='mini';G.mini.st='run';G.paused=false;G.t=180;W.__MINE.cp=5;W.__MINE.fin=-1;W.__setStamina(1);
   const cp=W.__RACE_P().find(p=>p.cp===5),circles=W.__RACE_P().filter(p=>p.mv),S=W.__RACE();
   Object.assign(S,{t:0,on:true,fallT:0,hitCd:0,slipT:0,cp:{x:cp.x,z:cp.z,y:cp.y}});
   Object.assign(P,{x:cp.x,z:cp.z,y:Y+cp.y,vx:0,vz:0,vy:0,_px:cp.x,_pz:cp.z,ground:true,jumps:0,down:false,yaw:Math.PI,pitch:-.22,flipT:99});
   let age=0,goal=null,jumps=0,falls=0,lastFall=false,maxViewChange=0;const touched=new Set(),trail=[];
   let elapsed=0;
   for(let f=0;f<fps*40&&W.__MINE.cp<6;f++){
    const under=P.ground?A.under():null,current=under?.mv?under:null,z=P.z;
    if(current)touched.add(current.id);
    const next=current?circles[circles.indexOf(current)+1]:circles.find(p=>A.pose(p,S.t).z>z+1);
    if(P.ground)goal=next||null;
    const pose=goal?A.pose(goal,S.t+Math.max(0,1.05-age)):{x:0,z:680},x=pose.x-P.vx*.025;
    let go=true,reverse=false,jump=false;
    if(P.ground){const edge=current?A.pose(current,S.t).z+current.d/2:586;if(z>=edge-1.4)jump=true;}
    else {go=z<pose.z-.4;reverse=z>pose.z+.4;}
    clear();if(go)K.w=true;else if(reverse)K.s=true;if(P.x<x-.18)K.a=true;else if(P.x>x+.18)K.d=true;
    if(jump){K[' ']=true;W.__wantJump();jumps++;}step(1/fps);elapsed=(f+1)/fps;
    if(P.ground)age=0;else age+=1/fps;if(S.fallT>0&&!lastFall)falls++;lastFall=S.fallT>0;
    maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));
    if(f%fps===0)trail.push({t:elapsed,x:P.x,z:P.z,y:P.y-Y,ground:P.ground,target:goal?.id});
   }
   results.push({seed,fps,finished:W.__MINE.cp===6,seconds:elapsed,jumps,falls,touched:[...touched],maxViewChange,trail});
  }return results;});
 fs.writeFileSync(path.join(out,'bridge-input.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(results.length,9);assert.ok(results.every(q=>q.finished&&q.touched.length===7&&q.jumps>=8&&q.maxViewChange<1e-8),'Each seed/frame rate must jump onto all seven moving circles using normal inputs');
 console.log('PASS: 9/9 real input bridge routes, every moving circle touched, unchanged view direction');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
