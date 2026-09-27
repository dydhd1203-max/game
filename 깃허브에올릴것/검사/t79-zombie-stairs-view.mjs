// Actual hostSim, real castle geometry. Browser stays hidden and never drives OS input.
import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const out='artifacts/race79/zombie-stairs';fs.mkdirSync(out,{recursive:true});const errors=[],server=serve(20619,process.argv[2]||GAME);let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const page=await browser.newPage({viewport:{width:1100,height:720}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('sndOn','0');const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set();let stop=false,seed=791019;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};requestAnimationFrame=f=>{if(stop)return 0;const id=raf(t=>{pending.delete(id);f(t);});pending.add(id);return id;};window.__stop79=()=>{stop=true;for(const id of pending)cancel(id);pending.clear();};});
 await page.goto('http://127.0.0.1:20619/?gfx=mid',{timeout:240000,waitUntil:'load'});await page.waitForFunction(()=>__READY===true,null,{timeout:240000});
 await page.evaluate(()=>{document.getElementById('iName').value='계단 길 검사';document.getElementById('bSolo').click();__introDone();__stop79();__DBG().noLogic=true;__DBG().noRender=true;__clear();__G.players.clear();__goNight();__spawnQ().length=0;__G.wolves.length=0;__G.paused=false;});
 const data=await page.evaluate(()=>{
  const W=window,G=__G,P=__PL,Y=__GY,all=[],climbs=[],blocked=[];
  const reset=()=>{G.wolves.length=0;G.soldiers.length=0;__spawnQ().length=0;__CLIMB().kid.clear();G.phase='night';G.started=true;G.host=true;G.paused=false;G.t=180;G.crystal=200;P.hp=__maxHP();P.down=false;P.y=Y;};
  const spawn=(k,g,t,p)=>{const x=__gX(g,t,p),z=__gZ(g,t,p);__spawnWolf(k,g,x,z);const w=G.wolves.at(-1);Object.assign(w,{x,z,y:Y,rise:0,siege:false,noChase:false,sgLeft:0,addLeft:0,chLeft:60,chCool:0,shT:true});return w;};
  for(let g=0;g<5;g++)for(const s of [-1,1])for(const mode of ['flow','chase','across'])for(const k of [0,7])for(const fps of [30,60]){
   reset();const r=Math.max(.25,Math.min(1.2,.64*__WOLF_T[k].sc)),p=10.05+r+.18,w=spawn(k,g,39,p*s);
   // Keep the prey within the existing 12-unit chase leash throughout the detour.
   P.x=mode==='flow'?0:__gX(g,mode==='across'?39:30,4.5*s);P.z=mode==='flow'?0:__gZ(g,mode==='across'?39:30,4.5*s);const tx=P.x,tz=P.z,start={x:w.x,z:w.z};let reached=false,invalid=0,maxStep=0,sawChase=0,frames=0;
   for(let i=0;i<fps*26;i++){
    if(Math.hypot(w.x-tx,w.z-tz)<(mode==='flow'?4.2:1.35)){reached=true;break;}
    const ox=w.x,oz=w.z;__hostSim(1/fps);if(!__zMoveOk(w,w.x,w.z))invalid++;maxStep=Math.max(maxStep,Math.hypot(w.x-ox,w.z-oz));if(w.shT)sawChase++;frames++;
   }
   all.push({g,s,mode,k,fps,reached,invalid,maxStep,sawChase,frames,start,end:{x:w.x,z:w.z},distance:Math.hypot(w.x-tx,w.z-tz),cs:w.cs});
  }
  for(const S of __CPLAN.stairs)for(const side of [-1,1]){
   reset();const r=.64*__WOLF_T[0].sc,w=spawn(0,S.g,36,(side>0?10.05+r+.18:6.95-r-.18)*S.s);
   P.x=__gX(S.g,40,8.5*S.s);P.z=__gZ(S.g,40,8.5*S.s);P.y=__layerY(P.x,P.z,1);Object.assign(w,{shQ:__uid,shQt:0,cck:0,cs:0,cDone:0});let frames=0,invalid=0;
   for(let i=0;i<60*7&&w.cs<2;i++){__hostSim(1/60);if(w.cs<2&&!__zMoveOk(w,w.x,w.z))invalid++;frames++;}
   climbs.push({k:S.k,side,cs:w.cs,seconds:frames/60,invalid});
  }
  // The route may not move through a newly installed wall that blocks the stair's front.
  for(const S of __CPLAN.stairs){reset();const r=.64*__WOLF_T[0].sc,w=spawn(0,S.g,36,(10.05+r+.18)*S.s);P.x=__gX(S.g,30,0);P.z=__gZ(S.g,30,0);const pos={x:Math.floor(__gX(S.g,32,10.7*S.s)),z:Math.floor(__gZ(S.g,32,10.7*S.s))},id='pathWall'+S.k,hp=__bs('swall','hp',1);__addStru({id,t:'swall',...pos,lv:1,hp,mx:hp,g:S.g,sol:[],cd:0});let invalid=0;for(let i=0;i<120;i++){__hostSim(1/60);if(!__zMoveOk(w,w.x,w.z))invalid++;}blocked.push({k:S.k,invalid,wall:__STRU.get(id)?.hp??0});__del(id);}
  return {cases:all,climbs,blocked};
 });
 for(const [label,rows,predicate] of [['ground',data.cases,q=>q.reached&&!q.invalid&&q.cs===0],['climb',data.climbs,q=>q.cs===2&&!q.invalid&&q.seconds<6],['built wall',data.blocked,q=>!q.invalid]]){const fail=rows.filter(q=>!predicate(q));console.log(`${label}: ${rows.length-fail.length}/${rows.length} PASS`+(fail.length?' '+JSON.stringify(fail.slice(0,8)):''));}
 data.errors=errors;fs.writeFileSync(out+'/hostsim-report.json',JSON.stringify(data,null,2));assert.deepEqual(errors,[]);assert.ok(data.cases.every(q=>q.reached&&!q.invalid&&q.cs===0));assert.ok(data.climbs.every(q=>q.cs===2&&!q.invalid&&q.seconds<6));assert.ok(data.blocked.every(q=>!q.invalid));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
