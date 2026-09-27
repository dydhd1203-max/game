// Independent high-speed regression: actual source camera anchor and swept bar collision.
// Node only; no fake renderer, no browser and no game mutation.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const results=[],out=path.resolve(process.argv[3]||path.join(here,'artifacts/77-race-continuity'));
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
const extractor=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn}=new Function('source',extractor.slice(extractor.indexOf('function end('),extractor.indexOf('const results=[];'))+';return {fn,decl};')(source);
const begin=source.indexOf('    const raceLag ='),end=source.indexOf('    let tx = camAnc.x',begin);
if(begin<0||end<0)throw Error('Missing live camera anchor block');
const current=source.slice(begin,end),legacy=current.replace(/    const raceLag =[^\n]+\n/,'').replace('> raceLag','> 3');
const camera=code=>new Function('PL','dt','S','racing',`
 let {camAnc,camGY,camDistance,camHold,camSlow,camLift}=S;
 const raceOn=()=>racing,footY=PL.y,tk=0;
 ${code}
 return {camAnc,camGY,camDistance,camHold,camSlow,camLift,snap};`);
const now=camera(current),old=camera(legacy);
const initial=()=>({camAnc:{x:0,z:0},camGY:100,camDistance:6.4,camHold:0,camSlow:0,camLift:0});
const runCamera=(F,hz,speed,turn=false)=>{let S=initial(),P={x:0,y:100,z:0,vx:0,vz:speed},snaps=0,maxLag=0,maxStep=0;
 for(let i=0;i<hz*6;i++){const a=turn?Math.sin(i/hz*.75)*.8:0,dt=1/hz;P.vx=Math.sin(a)*speed;P.vz=Math.cos(a)*speed;P.x+=P.vx*dt;P.z+=P.vz*dt;
  const before={...S.camAnc};S=F(P,dt,S,true);if(S.snap)snaps++;maxLag=Math.max(maxLag,Math.hypot(P.x-S.camAnc.x,P.z-S.camAnc.z));maxStep=Math.max(maxStep,Math.hypot(S.camAnc.x-before.x,S.camAnc.z-before.z));
 }return {snaps,maxLag,maxStep};};
const regression={old:runCamera(old,60,52),now:runCamera(now,60,52)};
check('Prior three-meter camera threshold reproduces repeated slide-speed snaps; current anchor does not',regression.old.snaps>10&&regression.now.snaps===0,regression);
const cameraCases=[];for(const hz of [30,60,120])for(const speed of [19.4832,28.25064,40,52,66])for(const turn of [false,true])cameraCases.push({hz,speed,turn,...runCamera(now,hz,speed,turn)});
check('Current race walking, sprinting, knockback and slide tracking stay continuous at 30/60/120 Hz',cameraCases.every(q=>q.snaps===0),{cases:cameraCases.length,maxLag:Math.max(...cameraCases.map(q=>q.maxLag))});
const warp=now({x:100,y:100,z:200,vx:66,vz:0},1/60,initial(),true),verticalWarp=now({x:0,y:130,z:0,vx:0,vz:0},1/60,initial(),true);
check('Real horizontal and vertical teleports still reset the anchor immediately',warp.snap&&warp.camAnc.x===100&&warp.camAnc.z===200&&verticalWarp.snap&&verticalWarp.camGY===130);
const village=now({x:3.1,y:100,z:0,vx:66,vz:0},1/60,initial(),false);
check('Village retains its existing three-meter teleport guard',village.snap);
const ctx=vm.createContext({Math});new vm.Script(`
 const PL={R:.3},MINI_Y=100,RACE={t:2},RACE74={pulse:new Map()};
 let hazards=[];const raceHazards=()=>hazards,racePunchHit=()=>false,raceSphereHit=()=>false,raceBounceSound=()=>{},burst=()=>{};
 ${fn('raceBarHit')}
 ${fn('raceBarSeparate79')}
 ${fn('raceHazardTick')}
 globalThis.A={PL,RACE,RACE74,raceBarHit,raceHazardTick,setHazards:q=>{hazards=q;}};`).runInContext(ctx);
const A=ctx.A;
// Independent exact static capsule distance. Dense temporal sampling is the oracle,
// not a copy of the implementation's travel-based subdivision selection.
const distance=(p,h,a)=>{const ux=Math.cos(a),uz=-Math.sin(a),half=h.len/2-h.r;
 const projection=(p.x-h.x)*ux+(p.z-h.z)*uz,t=Math.max(-half,Math.min(half,projection));
 const y=Math.max(p.y+.3,Math.min(p.y+1.3,h.y));return Math.hypot(p.x-h.x-ux*t,p.z-h.z-uz*t,y-h.y);};
const oracle=(p0,p1,h,dt,n=2048)=>{let min=Infinity;
 for(let i=0;i<=n;i++){const u=i/n,p={x:p0.x+(p1.x-p0.x)*u,y:p0.y+(p1.y-p0.y)*u,z:p0.z+(p1.z-p0.z)*u};min=Math.min(min,distance(p,h,h.ang-(1-u)*h.w*dt));}return min;};
const sampled=(p0,p1,h,dt,stale=false)=>{A.RACE.t=2;Object.assign(A.PL,{...p1,y:p1.y+100});Object.assign(A.RACE74,{prevX:p0.x,prevY:p0.y+100,prevZ:p0.z,prevTime:stale?-999:2-dt});return A.raceBarHit(h,dt);};
let seed=1777;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let falseNegative=0,falsePositive=0,endpointMiss=0,robustContacts=0,nearBoundary=0;const samples=[];
for(let i=0;i<1200;i++){
 const dt=[1/30,1/60,1/120][i%3],a=rand()*Math.PI*2,h={x:0,z:0,y:1.7,r:1.65,len:22,w:i%2?2.7:-2.7,ang:a};
 const along=(rand()-.5)*23,perp=(rand()-.5)*7,p0={x:Math.cos(a)*along+Math.sin(a)*perp,z:-Math.sin(a)*along+Math.cos(a)*perp,y:rand()*5};
 const v=rand()*66,heading=rand()*Math.PI*2,p1={x:p0.x+Math.sin(heading)*v*dt,z:p0.z+Math.cos(heading)*v*dt,y:p0.y+(rand()-.5)*110*dt};
 const min=oracle(p0,p1,h,dt),hit=sampled(p0,p1,h,dt),r=h.r+.3;
 if(min<r-.03){robustContacts++;if(!hit){falseNegative++;samples.push({p0,p1,h,dt,min});}}
 else if(min>r+.001){if(hit)falsePositive++;}
 else nearBoundary++;
 if(hit&&distance(p1,h,h.ang)>=r)endpointMiss++;
}
check('Swept thick bar matches dense capsule oracle for high-speed crossings and rotating contacts',falseNegative===0&&falsePositive===0&&robustContacts>100,{samples:1200,falseNegative,falsePositive,robustContacts,nearBoundary,endpointMiss,failures:samples.slice(0,3)});
check('Sweep catches contacts that an end-of-frame-only bar test misses',endpointMiss>10,{endpointMiss});
const h={x:0,z:0,y:1.7,r:1.65,len:22,w:2.7,ang:.4},above={x:0,y:4,z:0},below={x:0,y:-2,z:0};
check('A genuinely cleared jump and a fallen player do not hit the thick bar',!sampled(above,above,h,1/60)&&!sampled(below,below,h,1/60));
check('Stale pre-respawn path cannot cause a remote bar hit',!sampled({x:0,y:0,z:0},{x:30,y:0,z:30},h,1/60,true));
let minAlignment=1;
for(const angle of [0,.4,2.2])for(const along of [-7,7])for(const w of [-2.7,2.7]){
 const bar={...h,k:'bar',ang:angle,w,id:'test'},r=1e-5;
 Object.assign(A.PL,{x:Math.cos(angle)*along,y:100,z:-Math.sin(angle)*along,ground:true});Object.assign(A.RACE,{hitCd:0,slipT:0});A.RACE74.prevTime=-999;A.setHazards([bar]);A.raceHazardTick(1/60);
 const dx=(Math.cos(angle+w*r)-Math.cos(angle))*along,dz=(-Math.sin(angle+w*r)+Math.sin(angle))*along;
 minAlignment=Math.min(minAlignment,(A.PL.vx*dx+A.PL.vz*dz)/(Math.hypot(A.PL.vx,A.PL.vz)*Math.hypot(dx,dz)));
}
check('Actual bar knockback follows its visible moving contact point on both ends and rotation directions',minAlignment>.999,{minAlignment});
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,cameraCases},null,2));
console.log(`${results.filter(q=>q.pass).length}/${results.length} independent continuity checks passed.`);process.exitCode=results.every(q=>q.pass)?0:1;
