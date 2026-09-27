// Current map/collision/navigation functions, no duplicate stair or pillar geometry.
import fs from 'node:fs';import path from 'node:path';import {GAME} from './gamefile.mjs';import {fixture} from './zombie79-fixture.mjs';
const file=process.argv[2]||GAME,{A,source}=fixture(file),results=[];
const check=(name,pass,data)=>{results.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??'').slice(0,1200));};
const mk=(g,s,t,p,k=0)=>({id:1,k,sc:A.WOLF_T[k].sc,x:A.gX(g,t,p*s),z:A.gZ(g,t,p*s),y:A.GY,cs:0,ck:-1,cOut:-1,gate:g});
const trials=[],kinds=[...new Set([0,1,...A.WOLF_T.map((d,k)=>({d,k})).filter(q=>q.d.sc>=1.4).map(q=>q.k)])];
function walk(g,s,k,fps,mode,t,side){
 const proto=mk(g,s,0,0,k),r=A.rZ(proto),p=side>0?A.GH.sp1+.05+r+.16:A.GH.sp0-.05-r-.16,w=mk(g,s,t,p,k);
 const goal=mode==='flow'?[0,0]:[A.gX(g,mode==='across'?39:30,0),A.gZ(g,mode==='across'?39:30,0)];
 let reached=false,invalid=0,maxStep=0,firstBad=null,frames=0,spd=4.4,peakY=0;
 const start=[w.x,w.z],validStart=A.zMoveOk(w,w.x,w.z);
 for(let i=0;i<fps*22;i++){
  if(Math.hypot(w.x-goal[0],w.z-goal[1])<(mode==='flow'?4.2:1.35)){reached=true;break;}
  let tx=goal[0],tz=goal[1];if(mode==='flow'){const f=A.flowStep(Math.floor(w.x),Math.floor(w.z));if(f){tx=f[0]+.5;tz=f[1]+.5;}}
  [tx,tz]=A.route(w,tx,tz);const dx=tx-w.x,dz=tz-w.z,L=Math.hypot(dx,dz),step=Math.min(L,spd/fps),ox=w.x,oz=w.z;
  A.zStep(w,dx/(L||1)*step,dz/(L||1)*step);w.y=A.layerY(w.x,w.z,0);peakY=Math.max(peakY,w.y-A.GY);
  if(!A.zMoveOk(w,w.x,w.z)){invalid++;firstBad??=[w.x,w.z];}maxStep=Math.max(maxStep,Math.hypot(w.x-ox,w.z-oz));frames++;
 }
 return {g,s,k,fps,mode,t,side,reached,invalid,validStart,maxStep,peakY,frames,start,end:[w.x,w.z],firstBad};
}
for(let g=0;g<5;g++)for(const s of [-1,1])for(const k of kinds)for(const fps of [30,60,120])for(const mode of ['flow','chase','across'])for(const side of [-1,1])trials.push(walk(g,s,k,fps,mode,39,side));
check('Ground zombies and bosses clear both sides of all ten stairs toward crystal or ground player at 30/60/120 Hz',trials.every(q=>q.reached&&q.validStart),{cases:trials.length,failed:trials.filter(q=>!q.reached||!q.validStart).slice(0,6)});
check('Ground detours never enter stair bodies/pillars, rise onto steps, or teleport through a wall',trials.every(q=>!q.invalid&&q.peakY<=.001&&q.maxStep<=4.4/q.fps+1e-7),{invalid:trials.filter(q=>q.invalid).slice(0,3),peakY:Math.max(...trials.map(q=>q.peakY)),maxStep:Math.max(...trials.map(q=>q.maxStep))});
const low=[];for(const S of A.CPLAN.stairs){const i=A.gi(Math.floor(A.gX(S.g,34.5,S.s*8.5)),Math.floor(A.gZ(S.g,34.5,S.s*8.5)));low.push(A.fRamp[i]);}
check('First step is a navigation dead end like every higher step; all ordinary entrance lanes stay connected',low.every(v=>v===1)&&Array.from({length:5},(_,g)=>A.fCost[A.gi(Math.floor(A.gX(g,44,0)),Math.floor(A.gZ(g,44,0)))]).every(Number.isFinite),{low});
const climbs=[];for(const S of A.CPLAN.stairs)for(const k of A.WOLF_T.map((d,k)=>d.climb?k:-1).filter(k=>k>=0))for(const side of [-1,1]){
 const tmp=mk(S.g,S.s,0,0,k),r=A.rZ(tmp),w=mk(S.g,S.s,36,side>0?10.05+r+.18:6.95-r-.18,k);Object.assign(w,{cs:1,ck:S.k,cz:S.zone,cA:0,cStep:0,shQ:'kid'});
 const q={uid:'kid',x:A.gX(S.g,40,8.5*S.s),z:A.gZ(S.g,40,8.5*S.s),y:A.GY+4,sh:false};let invalid=0,frames=0;
 for(let i=0;i<360;i++){const go=A.climbApproach(w,1/60,[q]);if(w.cs!==1)break;if(!go)break;const goal=A.getClGoal(),dx=goal[0]-w.x,dz=goal[1]-w.z,L=Math.hypot(dx,dz),sp=Math.min(Math.max(A.WOLF_T[k].spd*A.BAL.chaseBoost,A.BAL.chaseMin),A.BAL.chaseCap),step=Math.min(L,sp/60);A.zStep(w,dx/(L||1)*step,dz/(L||1)*step);w.y=A.layerY(w.x,w.z,w.ly);if(!A.zMoveOk(w,w.x,w.z))invalid++;frames++;}
 climbs.push({stair:S.k,k,side,cs:w.cs,t:w.cA,frames,invalid});
}
check('Eligible wall-walk pursuers round the actual pillar before aligning with the stair entrance',climbs.every(q=>q.cs===2&&!q.invalid&&q.t<6),{cases:climbs.length,failed:climbs.filter(q=>q.cs!==2||q.invalid),maxSeconds:Math.max(...climbs.map(q=>q.t))});
const cancel=[];for(const S of A.CPLAN.stairs){const w=mk(S.g,S.s,33,8.5);Object.assign(w,{cs:1,ck:S.k,cz:S.zone,cA:0,cStep:0,shQ:'kid'});const q={uid:'kid',x:A.gX(S.g,30,0),z:A.gZ(S.g,30,0),y:A.GY,sh:false};const go=A.climbApproach(w,1/60,[q]);cancel.push(!go&&w.cs===0&&w.cDone===1);}
check('A player returning to ground immediately cancels the stair approach',cancel.every(Boolean),{cases:cancel.length});
const recovery=[];for(const S of A.CPLAN.stairs)for(const p of [7.18,9.82]){
 const w=mk(S.g,S.s,33.7,p),target=[A.gX(S.g,30,0),A.gZ(S.g,30,0)];let firstFree=-1,maxStep=0;const trapped=!A.zMoveOk(w,w.x,w.z);
 for(let i=0;i<360;i++){const [x,z]=A.route(w,...target),dx=x-w.x,dz=z-w.z,L=Math.hypot(dx,dz),ox=w.x,oz=w.z;A.zStep(w,dx/(L||1)*3.15/60,dz/(L||1)*3.15/60);maxStep=Math.max(maxStep,Math.hypot(w.x-ox,w.z-oz));if(firstFree<0&&A.zMoveOk(w,w.x,w.z))firstFree=i;}
 recovery.push({stair:S.k,p,trapped,firstFree,maxStep,clear:A.zMoveOk(w,w.x,w.z),distance:Math.hypot(w.x-target[0],w.z-target[1])});
}
check('Previously embedded pillar positions recover by small collision steps and keep walking',recovery.every(q=>q.trapped&&q.firstFree>=0&&q.firstFree<15&&q.clear&&q.maxStep<=.120001&&q.distance<2),recovery);
check('Host normal walking uses the detour; knockback remains the unchanged collision movement',source.includes('if(zStairRoute79(w, tx, tz)){ tx = ZNAV_X79; tz = ZNAV_Z79; }')&&source.slice(source.indexOf('function zStep('),source.indexOf('let ZNAV_X79')).indexOf('zStairRoute79(')<0);
fs.mkdirSync('artifacts/race79/zombie-stairs',{recursive:true});fs.writeFileSync('artifacts/race79/zombie-stairs/static-report.json',JSON.stringify({results,trials,climbs},null,2));
console.log(`${results.filter(q=>q.pass).length}/${results.length} checks passed`);if(results.some(q=>!q.pass))process.exitCode=1;
