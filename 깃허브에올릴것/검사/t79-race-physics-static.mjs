// Exercise current source functions. Geometry oracle samples the torus centerline independently.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const extract=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',extract.slice(extract.indexOf('function end('),extract.indexOf('const results=[];'))+';return {fn,decl};')(source);
const C=vm.createContext({Math});
vm.runInContext(`const MINI_Y=100,PL={R:.3},G={mini:{st:'run'},paused:false},MINE={fin:-1,cp:0};
const RACE_P=[],RACE={t:2,seed:13,hitCd:0,slipT:0,fallT:0},RACE74={pulse:new Map()};let active=true,hazards=[];
const raceOn=()=>active,raceHold=()=>false,raceHazards=()=>hazards,raceBounceSound=()=>{},burst=()=>{};
${decl('STEP')}\n${decl('RACE_SPD')}\n${decl('GRAV')}
${['race74Reset','raceContains','raceSurface','raceOff','raceZOff','racePose','racePadLocal88','racePadWorld88','raceCarry88','raceUnder','raceTryJump','raceGravityScale','raceMotion','raceBarHit','raceBarSeparate79','raceDonutContact79','raceDonutHit79','raceHazardTick'].map(fn).join('\n')}
globalThis.A={PL,G,MINE,RACE,RACE_P,RACE74,RACE_SPD,SPD,raceTryJump,raceUnder,raceContains,raceMotion,raceGravityScale,raceBarHit,raceDonutContact79,raceDonutHit79,raceHazardTick,reset:race74Reset,haz:a=>hazards=a,active:v=>active=v};`,C);
const A=C.A,checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
check('Race walking/sprinting return to the pre-doubling factor; ordinary village speed remains 5.94',A.RACE_SPD===1.64&&A.SPD===5.94);
const pad={id:10,x:0,z:0,y:0,w:24,d:24,h:3,shape:'round',kind:'bounce',bounce:{manual:true,v:55,forward:21.5}};A.RACE_P.push(pad);
const setup=(x=0,z=0)=>{A.reset();Object.assign(A.PL,{x,z,y:100,vx:3,vz:0,vy:0,ground:true,jumps:0});Object.assign(A.RACE,{t:2,fallT:0,hitCd:0,slipT:0});A.G.paused=false;A.MINE.fin=-1;};
let launchCount=0,unchanged=true,impulses=true;
for(const radius of [0,4,8,10.8])for(let i=0;i<24;i++){const x=Math.cos(i*Math.PI/12)*radius,z=Math.sin(i*Math.PI/12)*radius;setup(x,z);
 const ok=A.raceTryJump();launchCount+=ok?1:0;unchanged&&=A.PL.x===x&&A.PL.z===z&&A.PL.y===100;impulses&&=A.PL.vy===55&&A.PL.vz===21.5&&A.PL.vx===3;}
check('Fresh Space launches at 96 supported positions across the whole disk without relocating or aiming the avatar',launchCount===96&&unchanged&&impulses,{launchCount,unchanged,impulses});
setup(13.6,0);const off=A.raceTryJump();setup();A.PL.ground=false;const airborne=A.raceTryJump();setup();A.G.paused=true;const paused=A.raceTryJump();setup();A.MINE.fin=3;const finished=A.raceTryJump();setup();A.active(false);const village=A.raceTryJump();A.active(true);
check('Void, airborne, paused, finished and non-race states cannot start a donut spring',!off&&!airborne&&!paused&&!finished&&!village);
// Two identical launches begun at different coordinates stay equally separated.
// This would fail if an automatic landing target or spring centering was introduced.
const flights=[];for(const fps of [30,60,120])for(const start of [{x:-8,z:-5},{x:8,z:5}]){
 setup(start.x,start.z);A.raceTryJump();let peak=0;for(let f=0;f<fps*2;f++){
  A.raceMotion(1/fps,0,0,0);A.PL.vy-=26*A.raceGravityScale()/fps;A.PL.x+=A.PL.vx/fps;A.PL.y+=A.PL.vy/fps;A.PL.z+=A.PL.vz/fps;peak=Math.max(peak,A.PL.y-100);}
 flights.push({fps,start,...{x:A.PL.x,z:A.PL.z,y:A.PL.y,peak}});
}
check('Take-off position remains meaningful throughout the buoyant trajectory at 30/60/120 Hz', [30,60,120].every(fps=>{const q=flights.filter(x=>x.fps===fps);return Math.abs(q[1].x-q[0].x-16)<1e-8&&Math.abs(q[1].z-q[0].z-10)<1e-8&&q.every(p=>p.peak>21&&p.peak<24);}),flights);
const donut={x:0,z:0,y:2.36,r:2.36,h:4.72,ry:.25,rz:.10,k:'punch',sec:2,donut79:true};
const hole=A.raceDonutContact79(donut,0,2.1,2.6,0,.3),rim=A.raceDonutContact79(donut,0,4,4.3,0,.3);
check('A vertical capsule inside the real donut hole passes, while the chocolate rim collides',!hole&&rim);
let seed=7919;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let contacts=0,misses=0,falseContacts=0;
for(let i=0;i<600;i++){
 const x=(random()-.5)*7,z=(random()-.5)*4,lo=random()*6-.5,hi=lo+1,r=.3,ca=Math.cos(donut.ry),sa=Math.sin(donut.ry),R=donut.r*.66;
 let d=Infinity;for(let j=0;j<2048;j++){const t=j*Math.PI/1024,xx=R*Math.cos(t)*ca,zz=-R*Math.cos(t)*sa,yy=donut.y+R*Math.sin(t),cy=Math.max(lo,Math.min(hi,yy));d=Math.min(d,Math.hypot(x-xx,z-zz,cy-yy));}
 const hit=A.raceDonutContact79(donut,x,lo,hi,z,r),limit=donut.r*.348+r;
 if(d<limit-.003){contacts++;if(!hit)misses++;}if(d>limit+.003&&hit)falseContacts++;
}
check('The live hollow-donut capsule query matches an independent dense 3D centerline oracle',contacts>100&&misses===0&&falseContacts===0,{samples:600,contacts,misses,falseContacts});
let swept=0;for(const fps of [30,60,120]){
 Object.assign(A.RACE,{t:2});Object.assign(A.PL,{x:0,z:0,y:100+4.45-55/fps});Object.assign(A.RACE74,{prevTime:2-1/fps,prevX:0,prevZ:0,prevY:104.45});if(A.raceDonutHit79(donut,1/fps))swept++;
}
check('Fast descending capsules contact the donut rim at 30/60/120 Hz',swept===3,{contacts:swept});
const impact=[];for(const fps of [30,60,120])for(const sign of [-1,1]){
 setup(7,-1.5*sign);A.RACE_P.length=0;const bar={k:'bar',x:0,z:0,y:1.7,r:1.65,len:22,w:2.7*sign,ang:0,id:'candy'};A.haz([bar]);A.RACE74.prevTime=-999;
 A.raceHazardTick(1/fps);const start={x:A.PL.x,z:A.PL.z,y:A.PL.y},impulse=Math.hypot(A.PL.vx,A.PL.vz),vy=A.PL.vy;
 const outside=!A.raceBarHit({...bar,w:0},1/fps);let minOut=Infinity;
 for(let i=0;i<Math.round(fps*.3);i++){
  A.raceMotion(1/fps,0,14.12532*sign,1);A.PL.vy-=26/fps;A.PL.x+=A.PL.vx/fps;A.PL.y+=A.PL.vy/fps;A.PL.z+=A.PL.vz/fps;
  minOut=Math.min(minOut,-sign*(A.PL.z-start.z));
 }
 impact.push({fps,sign,impulse,vy,outside,travel:Math.hypot(A.PL.x-start.x,A.PL.z-start.z),height:A.PL.y-start.y,minOut,remaining:A.RACE74.knockT});
}
check('Candy contact exits the visible tube immediately and throws strongly upward and outward despite opposing input',impact.every(q=>q.outside&&q.impulse===32&&q.vy===14&&q.travel>8&&q.height>2.8&&q.minOut>0&&q.remaining>0),impact);
const code=fn('raceTryJump');check('Manual launch logic contains neither the old zone gate nor an automatic landing-target lookup',!code.includes('raceJumpPose')&&!code.includes('raceLandingPose')&&!code.includes('.zone'));
const out=path.resolve(process.argv[3]||'artifacts/race79/physics-static');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,flights,impact},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} race 79 checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
