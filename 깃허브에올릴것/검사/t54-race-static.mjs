/* Current obstacle-course contracts, executed from the game source in Node.
   74 replaces the old rainbow/stone/stamp layout. Actual movement and renderer
   integration are checked in t74-race-view.mjs; no OS cursor or network here. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/54-race'));
const source=fs.readFileSync(file,'utf8');
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
function end(st,func=false){let b=0,p=0,r=0,q='',co='',esc=false,opened=false;
  for(let i=st;i<source.length;i++){const c=source[i],n=source[i+1];
    if(co==='line'){if(c==='\n')co='';continue;}if(co==='block'){if(c==='*'&&n==='/'){co='';i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q='';continue;}
    if(c==='/'&&n==='/'){co='line';i++;continue;}if(c==='/'&&n==='*'){co='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{'){b++;opened=true;}else if(c==='}')b--;
    else if(c==='(')p++;else if(c===')')p--;else if(c==='[')r++;else if(c===']')r--;
    if(!b&&!p&&!r&&((func&&opened)||(!func&&c===';')))return i+1;
  }throw Error('Unterminated '+source.slice(st,st+80));}
function decl(n){const m=new RegExp('(?:const|let)\\s+'+n+'\\s*=').exec(source);if(!m)throw Error('Missing declaration '+n);return source.slice(m.index,end(m.index));}
function fn(n){const s=source.indexOf('function '+n+'(');if(s<0)throw Error('Missing function '+n);return source.slice(s,end(s,true));}
const results=[];
function check(name,pass,detail){results.push({name,pass:!!pass,...detail===undefined?{}:{detail}});console.log((pass?'OK   ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));}
const fixtures=`
const MINI_Y=100,MINI_R=34,MINI_PADZ=-19,PL={R:.3},G={players:new Map(),mini:{seed:1,st:'run'}},MINE={cp:0};
let uid='kid00',racing=true;const raceOn=()=>racing,raceHold=()=>false;
const raceArtBuild=()=>{},raceArtRebuild=()=>{},raceArtReset=()=>{};
const raceBounceSound=()=>{},fovPunch=()=>{};
`;
const declarations=['CH82','CH82_Z1','CANDY87','CH82T','CH82Q','raceDonutSide87','chuteSq82','chuteRise82','chuteZone82','RACE_X','RACE_S','RACE_Z_FIN','RACE_ROWZ','RACE_P','RACE','RACE_SEC','ROCK','RACE_LAUNCH_RATE','RACE74','GRAV','RACE_TOY77'];
const functions=['mulberry','furLight','race74Reset','raceGravityScale','raceMotion','raceBuild','raceOff','raceZOff','racePose','raceDonutLayout87','raceJumpPose','raceLandingPose','raceAlive','raceContains','raceSurface','raceTopAt','raceUnder','raceSlotXZ','raceCheckpointXZ','rockU','raceRocks','raceHazards','raceSphereHit','racePunchHit','raceDonutContact79','raceDonutHit79','raceToyForm77','raceToyHit77','raceBarHit','raceBarSeparate79','raceSlideHit78','raceHazardTick',
  'chute82','chuteQ82','chuteProf82','chuteProfSlope82','chuteContains82','chuteSurf82','chuteGrad82','chuteMotion82','chuteFlight82','chuteLaunch82','chuteAfter82','chuteCandyProf87','chuteCandyFrame87','chuteCandySpan87','chuteCandyAt87','chuteCandyHit87','chuteCandyPush87','chuteBump87'];
const ctx=vm.createContext({console});
new vm.Script([fixtures,...declarations.map(decl),...functions.map(fn),`
globalThis.A={CH82,CH82_Z1,chuteQ82,chuteProf82,chuteSurf82,RACE,RACE_P,RACE_S,RACE_SEC,RACE_Z_FIN,RACE_LAUNCH_RATE,RACE74,GRAV,JUMP,PL,G,MINE,raceBuild,raceOff,racePose,raceDonutLayout87,raceJumpPose,raceLandingPose,raceContains,raceSurface,raceTopAt,raceUnder,raceHazards,racePunchHit,chuteCandyHit87,chuteCandyAt87,raceToyForm77,raceHazardTick,raceGravityScale,raceMotion,
 spawn(id){uid=id;return raceSlotXZ();},cp(id,p){uid=id;return raceCheckpointXZ(p);},setRacing(v){racing=v;}};`].join('\n')).runInContext(ctx,{timeout:10000});
const A=ctx.A,seeds=Array.from({length:90},(_,i)=>i*7919+13);
let deterministic=true,finite=true,centerSupport=true,moving=false,checkpoints=true;
let platformCount=0,variantCount=new Set();
for(const seed of seeds){
  A.raceBuild(seed);const a=JSON.stringify(A.RACE_P);A.raceBuild(seed);deterministic&&=a===JSON.stringify(A.RACE_P);variantCount.add(a);
  platformCount=Math.max(platformCount,A.RACE_P.length);
  checkpoints&&=A.RACE_P.filter(p=>p.cp).length===7;
  for(const p of A.RACE_P){
    finite&&=['x','z','y','w','d','h'].every(k=>Number.isFinite(p[k]))&&p.w>0&&p.d>0&&p.h>0;
    for(const t of [0,.5,3,11]){const pose=A.racePose(p,t),x=pose.x;
      centerSupport&&=A.raceContains(p,x,pose.z,0,t)&&Number.isFinite(A.raceSurface(p,x,pose.z));
      if(p.mv){moving=true;finite&&=Math.abs(A.raceOff(p,t))<=p.mv.amp+1e-8;}}
  }
}
check('Same seed creates the same seven-section course',deterministic&&A.RACE_S.length===7,{seeds:seeds.length,variants:variantCount.size});
check('The active race gives the approved three-minute classroom limit',A.RACE_SEC===180);
check('Every seed has seven safe checkpoint decks',checkpoints);
check('All platform geometry and movement parameters remain finite',finite,{maxPlatforms:platformCount});
check('Actual curved collision supports every platform center, including moving mats',centerSupport&&moving);
A.raceBuild(740021);
const ids=Array.from({length:21},(_,i)=>'kid'+String(i).padStart(2,'0'));
A.G.players=new Map(ids.map(id=>[id,{}]));
const slots=ids.map(id=>A.spawn(id));
const minDist=ps=>Math.min(...ps.flatMap((p,i)=>ps.slice(i+1).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))));
check('21 starters have distinct supported island slots',minDist(slots)>1.2&&slots.every(([x,z])=>A.raceTopAt(x,z,0)>=100),{minDistance:minDist(slots)});
let safe=true,cpDist=Infinity;
for(const p of A.RACE_P.filter(p=>p.cp)){
  const points=ids.map(id=>A.cp(id,p));cpDist=Math.min(cpDist,minDist(points.map(q=>[q.x,q.z])));
  safe&&=points.every(q=>A.raceContains(p,q.x,q.z,-.35,0)&&Math.abs(A.raceSurface(p,q.x,q.z)-(100+q.y))<.001);
}
check('All seven checkpoints fit 21 separated respawns inside their actual curved perimeter',safe&&cpDist>1.2,{minDistance:cpDist});

// Independent boundary probes: visible ellipses and rounded corners must not
// retain the old invisible square collision corners.
const oval={shape:'round',x:100,z:500,y:2,w:10,d:14,h:1};
check('Ellipse supports its center and axes but rejects the invisible rectangular corners',
  A.raceContains(oval,100,500,0,0)&&A.raceContains(oval,104.8,500,0,0)&&A.raceContains(oval,100,506.8,0,0)&&
  !A.raceContains(oval,104.8,506.8,0,0)&&!A.raceContains(oval,105.2,500,0,0));
const cushion={shape:'cushion',x:100,z:500,y:2,w:12,d:14,h:1,round:3};
check('Cushion collision retains the straight center and rounded corner clearance',
  A.raceContains(cushion,105.8,500,0,0)&&A.raceContains(cushion,100,506.8,0,0)&&
  !A.raceContains(cushion,105.8,506.8,0,0)&&!A.raceContains(cushion,106.2,500,0,0));
// 82차 — the rainbow slide is now the curved U roller coaster (chute82). Its centre line must be continuous from the
// flat flag deck to the kicker; U depth grows from zero at the mouth, and every lane is reachable without a stair step.
const slide=A.RACE_P.find(p=>p.shape==='slide'),C=A.CH82;
let slideSmooth=!!slide&&!!slide.chute,largestStep=0,mouthStep=0,slopes=[];
if(slideSmooth){const z0=C.z0,z1=A.CH82_Z1,n=4000,step=(z1-z0)/n;
  const at=(d,z)=>{const q=A.chuteQ82(z);return A.raceSurface(slide,q.cx+d/q.cs,z)-100;};
  slideSmooth&&=Math.abs(at(0,z0)-C.knots[0][1])<1e-6&&Math.abs(at(0,z1)-C.knots[C.knots.length-1][1])<1e-6;
  for(const d of [0,-6,6,-10.5,10.5]){let previous=at(d,z0);for(let i=1;i<=n;i++){const h=at(d,z0+i*step);largestStep=Math.max(largestStep,Math.abs(h-previous));slideSmooth&&=Number.isFinite(h);previous=h;}}
  // Entering from anywhere on the 26-wide flag deck (y 30) never meets a wall: the mouth is flush and rises gently.
  for(let x=-12.6;x<=12.6;x+=.3)mouthStep=Math.max(mouthStep,A.raceSurface(slide,x,z0+.5)-100-30);
  slopes=[Math.abs(at(0,z0+step)-at(0,z0))/step,Math.abs(at(0,z1)-at(0,z1-step))/step];
  slideSmooth&&=slopes[0]<.02&&largestStep<.2&&mouthStep<.5;   // rubber lip bead .42 < the 0.68 stair step
}
check('Actual roller-coaster collision is continuous on every lane, flush at the flag-deck mouth and ends at the kicker',slideSmooth,{largestStep,mouthStep,slopes});
const launchPads=A.RACE_P.filter(p=>p.bounce),manualPads=launchPads.filter(p=>p.bounce.manual);
check('Four manual donut pads and the final launch expose finite bounce impulses',manualPads.length===4&&launchPads.length===5&&
  launchPads.every(p=>Number.isFinite(p.bounce.v)&&p.bounce.v>0&&Number.isFinite(p.bounce.forward)&&p.bounce.forward>0),
  {pads:launchPads.length,manualPads:manualPads.length});
check('Manual donuts retain separated diagonal landing circles without an exclusive jump-zone radius',manualPads.every((p,i)=>p.w===28&&p.d===28&&(p.side===1||p.side===-1)&&p.bounce.zone===undefined&&p.z===244+i*56&&
  A.raceJumpPose(p).z===p.z+5.5&&Math.abs(A.raceJumpPose(p).x-p.x)===4&&
  (i===0||!A.raceContains(manualPads[i-1],0,(p.z+manualPads[i-1].z)/2,0,0))));
const movingPads=A.RACE_P.filter(p=>p.sec===4&&p.mv),movingGaps=[];
for(let t=0;t<12;t+=.25)for(let i=1;i<movingPads.length;i++){
  const a=A.racePose(movingPads[i-1],t),b=A.racePose(movingPads[i],t),gap=Math.hypot(a.x-b.x,a.z-b.z)-(movingPads[i-1].w+movingPads[i].w)/2;
  movingGaps.push(gap);
}
check('Seven small moving circles leave actual jump gaps while translating in both axes and rotating',movingPads.length===7&&movingPads.every(p=>p.w===8&&p.d===8&&p.mv.zamp>0&&Math.abs(p.mv.rot)>0)&&
  movingGaps.every(g=>g>1.5&&g<7),{minGap:Math.min(...movingGaps),maxGap:Math.max(...movingGaps)});
const bridgeRates=movingPads.map((p,i)=>{const t=(Math.PI*4-p.mv.ph)/p.mv.spd,e=.00001,a=A.racePose(p,t-e),b=A.racePose(p,t+e);
  return {translationFactor:p.mv.spd/(.65+i*.035),rotationFactor:Math.abs(p.mv.rot)/.30,
    measuredPeakXSpeed:(b.x-a.x)/(2*e),expectedPeakXSpeed:2.2*(.65+i*.035)*10};});
// 87차 — 선생님: "2배로 빠르게, 2배로 더 길게" → 옆 폭 1.1 → 2.2 · 왕복 ×10(76차 기준, 86차 ×5 의 두 배) · 옆으로 가장 빠를 때 4배.
// 앞뒤 폭은 .45 로 줄여 원판 사이 틈이 7 을 넘지 않는다(위 검사). 원판 반지름 4 > 옆 폭 → 가운데 1.8 은 늘 원판 위
check('87차: cloud circles swing twice as wide and twice as often as 86차 (side speed ×4), still overlapping their own centre line',
  movingPads.every(p=>p.mv.amp===2.2&&p.mv.zamp===.45&&p.w/2-p.mv.amp>1.79)&&bridgeRates.every(q=>Math.abs(q.translationFactor-10)<1e-10&&Math.abs(q.rotationFactor-2)<1e-10&&Math.abs(q.measuredPeakXSpeed-q.expectedPeakXSpeed)<1e-7),bridgeRates);
const ramp=A.RACE_P.find(p=>p.shape==='ramp');
check('The uphill section has a real thirty-meter rise and four bounded booster strips',!!ramp&&ramp.yEnd-ramp.y===30&&ramp.boosts?.length===4&&
  ramp.boosts.every(b=>A.raceContains(ramp,b.x,b.z,0,0)&&b.w>0&&b.d>0));
let hazardDet=true,hazardFinite=true,hazardSafe=true,maxHazards=0;const checkpointHits=[];
for(const seed of seeds.slice(0,16)){
  A.raceBuild(seed);
  for(let t=0;t<12;t+=.25){
    A.RACE.t=t;const h=A.raceHazards(t);maxHazards=Math.max(maxHazards,h.length);
    hazardDet&&=JSON.stringify(h)===JSON.stringify(A.raceHazards(t));
    hazardFinite&&=h.every(q=>['x','y','z','r'].every(k=>Number.isFinite(q[k])));
    for(const p of A.RACE_P.filter(p=>p.cp))for(const id of ids){const q=A.cp(id,p);
      Object.assign(A.PL,{x:q.x,z:q.z,y:100+q.y,ground:true,vx:0,vz:0,vy:0});A.RACE.hitCd=A.RACE.slipT=0;
      A.raceHazardTick(1/60);hazardSafe&&=A.RACE.hitCd===0;
      if(A.RACE.hitCd>0&&checkpointHits.length<8)checkpointHits.push({seed,t,cp:p.cp,id,x:q.x,z:q.z});
    }
  }
}
check('Shared seed and time generate deterministic finite obstacles within the bounded 128-object course budget',hazardDet&&hazardFinite&&maxHazards>0&&maxHazards<=128,{maxHazards});
check('Moving hazards never hit any of the 21 respawn slots at any checkpoint',hazardSafe,{seeds:16,timesPerSeed:48,slots:21,hits:checkpointHits});
A.raceBuild(740021);A.RACE.t=2;
const obstacles=A.raceHazards(2),sectionCounts=A.RACE_S.map((_,i)=>obstacles.filter(h=>h.sec===i).length);
const firstEdge=Math.min(...obstacles.map(h=>h.z-(h.k==='bar'?h.len/2:h.r)));
check('The start retains fourteen strong punch bags plus twelve moving slalom bags, five faster sweeps and a dense donut ring',
  obstacles.filter(h=>h.sec===0&&/^start/.test(h.id)).length===14&&obstacles.filter(h=>/^jellyGate/.test(h.id)).length===12&&
  obstacles.filter(h=>h.sec===0&&h.k==='punch').length===26&&obstacles.filter(h=>h.k==='bar').length===5&&
  obstacles.filter(h=>h.k==='bar').every(h=>h.len===22&&Math.abs(h.w)===2.7&&h.r===1.65&&h.y===1.7)&&sectionCounts[2]===48&&firstEdge+19<30,
  {sectionCounts,firstObstacleDistance:firstEdge+19});
check('All twenty-six giant starting sculptures and their visible footings stay within the wide deck, including their full sideways sway',
  obstacles.filter(h=>h.sec===0).every(h=>h.h>=8&&h.h<=8.2&&Math.abs(h.baseX??h.x)+h.r*(A.raceToyForm77(h)<0?1.18:1.01)+(h.sway||0)<=22&&
    (h.id.startsWith('start')?h.r===2.35:h.r===2.4)),{heights:[...new Set(obstacles.filter(h=>h.sec===0).map(h=>h.h))]});
let landingHazards=true,clearJumpZones=true,blockedCenters=true,clearLandings=true,walkableWeave=true;
for(let t=0;t<12;t+=.25){const all=A.raceHazards(t);
  for(const pad of manualPads){const inner=all.filter(h=>h.id.startsWith('donutInner'+pad.id+':')),bags=all.filter(h=>h.sec===2);
    landingHazards&&=inner.length===8&&inner.filter(h=>h.sway).length===2&&inner.every(h=>{Object.assign(A.PL,{x:h.x,z:h.z,y:100+pad.y});return A.raceContains(pad,h.x,h.z,-h.r)&&A.racePunchHit(h);});
    Object.assign(A.PL,{x:pad.x,z:pad.z,y:100+pad.y});blockedCenters&&=bags.some(h=>A.racePunchHit(h));
    const jp=A.raceJumpPose(pad,t),lp=A.raceLandingPose(pad,t);
    Object.assign(A.PL,{x:lp.x,z:lp.z,y:100+pad.y});clearLandings&&=!bags.some(h=>A.racePunchHit(h));
    for(let i=0;i<72;i++){const a=i*Math.PI/36;Object.assign(A.PL,{x:jp.x+Math.cos(a)*2.5,z:jp.z+Math.sin(a)*2.5,y:100+pad.y});
      clearJumpZones&&=A.raceContains(pad,A.PL.x,A.PL.z,-.3,t)&&!bags.some(h=>A.racePunchHit(h));}
    // A real walkable U-shaped detour, never a straight center-to-center auto route.
    const way=[lp,{x:lp.x,z:pad.z+8.5},{x:jp.x,z:pad.z+8.5},jp];
    for(let j=1;j<way.length;j++)for(let u=0;u<=1;u+=.025){Object.assign(A.PL,{x:way[j-1].x*(1-u)+way[j].x*u,z:way[j-1].z*(1-u)+way[j].z*u,y:100+pad.y});walkableWeave&&=A.raceContains(pad,A.PL.x,A.PL.z,-.3,t)&&!bags.some(h=>A.racePunchHit(h));}
  }}
check('Eight interior donuts block center landings while alternating landing flanks and optional clear launch pockets stay clear through every sway phase',landingHazards&&blockedCenters&&clearLandings&&clearJumpZones,{landingHazards,blockedCenters,clearLandings,clearJumpZones});
check('Every landing flank connects to another optional take-off pocket through a supported obstacle-free weaving route',walkableWeave);
// 87차 — 도넛 자리는 경주마다(씨앗) 다르다. 씨앗 40개에서: 예전 배치로 물러서지 않고, 배치가 씨앗마다 다르며,
// 같은 씨앗은 같은 배치(손님·호스트 같은 화면), 위 착지·뛰는 자리·U 길·가운데 막힘·판 안 조건을 흔들림 양 끝까지 지킨다.
{const layouts=new Set();let seedsOk=true,deterministic=true,noFallback=true;const bad=[];
 for(let k=0;k<40;k++){const seed=1000+k*7919;A.raceBuild(seed);const pads=A.RACE_P.filter(p=>p.bounce&&p.bounce.manual);
  const sig=A.raceHazards(0).filter(h=>h.sec===2).map(h=>h.x.toFixed(2)+','+h.z.toFixed(2)).join(';');layouts.add(sig);
  A.raceBuild(seed);deterministic&&=A.raceHazards(0).filter(h=>h.sec===2).map(h=>h.x.toFixed(2)+','+h.z.toFixed(2)).join(';')===sig;
  for(const pad of pads){const L=A.raceDonutLayout87(pad);noFallback&&=!(L[4][1]===0&&L[4][2]===0&&L[0][1]===-9);}
  for(const tt of [0,.7,1.4,2.1,2.8]){const all=A.raceHazards(tt);
   for(const pad of pads){const inner=all.filter(h=>h.id.startsWith('donutInner'+pad.id+':')),bags=all.filter(h=>h.sec===2&&Math.hypot(h.x-pad.x,h.z-pad.z)<pad.w);
    let ok=inner.length===8&&inner.filter(h=>h.sway).length===2&&bags.length===12&&bags.every(h=>A.raceContains(pad,h.x,h.z,-h.r));
    Object.assign(A.PL,{x:pad.x,z:pad.z,y:100+pad.y});ok&&=bags.some(h=>A.racePunchHit(h));
    const jp=A.raceJumpPose(pad,tt),lp=A.raceLandingPose(pad,tt);Object.assign(A.PL,{x:lp.x,z:lp.z,y:100+pad.y});ok&&=!bags.some(h=>A.racePunchHit(h));
    for(let i=0;i<36;i++){const a=i*Math.PI/18;Object.assign(A.PL,{x:jp.x+Math.cos(a)*2.5,z:jp.z+Math.sin(a)*2.5,y:100+pad.y});ok&&=A.raceContains(pad,A.PL.x,A.PL.z,-.3,tt)&&!bags.some(h=>A.racePunchHit(h));}
    const way=[lp,{x:lp.x,z:pad.z+8.5},{x:jp.x,z:pad.z+8.5},jp];
    for(let j=1;j<way.length;j++)for(let u=0;u<=1;u+=.05){Object.assign(A.PL,{x:way[j-1].x*(1-u)+way[j].x*u,z:way[j-1].z*(1-u)+way[j].z*u,y:100+pad.y});ok&&=A.raceContains(pad,A.PL.x,A.PL.z,-.3,tt)&&!bags.some(h=>A.racePunchHit(h));}
    if(!ok){seedsOk=false;bad.push({seed,pad:pad.id,t:tt});}}}}
 A.raceBuild(78021);A.RACE.t=3;
 check('87차: donut positions change with every race seed, stay identical for the same seed, and always keep the landing spot, take-off ring, U route and centre block',
  seedsOk&&deterministic&&noFallback&&layouts.size===40,{layouts:layouts.size,deterministic,noFallback,bad:bad.slice(0,5)});}
let gatesSafe=true,gatesMove=false,gatesDet=true,minCrowdWidth=Infinity,maxCrowdWidth=0,maxSway=0;
const gateSamples=[];
for(const seed of seeds.slice(0,8)){
  A.raceBuild(seed);
  for(let t=0;t<12;t+=.25){
    const gates=A.raceHazards(t).filter(h=>/^jellyGate/.test(h.id)),snapshot=JSON.stringify(gates);
    gatesDet&&=snapshot===JSON.stringify(A.raceHazards(t).filter(h=>/^jellyGate/.test(h.id)));
    for(let row=0;row<2;row++){
      const bags=gates.filter(h=>h.id.startsWith('jellyGate'+row+':')).sort((a,b)=>a.x-b.x);
      const shifts=bags.map(h=>h.x-h.baseX);maxSway=Math.max(maxSway,...shifts.map(Math.abs));gatesMove||=Math.abs(shifts[0])>.3;
      gatesSafe&&=bags.length===6&&bags.every(h=>h.sec===0&&h.z===42+row*19&&h.power===5)&&Math.max(...shifts)-Math.min(...shifts)>.001;
      const openings=bags.slice(1).map((b,i)=>({left:bags[i].x+bags[i].r+A.PL.R,right:b.x-b.r-A.PL.R}));
      for(const opening of openings){minCrowdWidth=Math.min(minCrowdWidth,opening.right-opening.left);maxCrowdWidth=Math.max(maxCrowdWidth,opening.right-opening.left);
        const center=(opening.left+opening.right)/2;Object.assign(A.PL,{x:center,z:42+row*19,y:100});gatesSafe&&=!bags.some(h=>A.racePunchHit(h));}
      if(seed===seeds[0]&&t===0)gateSamples.push({row,widths:openings.map(q=>q.right-q.left)});
    }
  }
}
check('Seeded slalom bags breathe independently, leaving multiple narrow crowd lanes instead of a broad bypass',
  gatesSafe&&gatesDet&&gatesMove&&maxSway<=.400001&&minCrowdWidth>1.0&&maxCrowdWidth<3.5,{seeds:8,maxSway,minCrowdWidth,maxCrowdWidth,gateSamples});
A.raceBuild(740021);A.RACE.t=2;obstacles.splice(0,obstacles.length,...A.raceHazards(2));
const bag=obstacles.find(h=>h.k==='punch'&&h.sec===6),probeBag=(dx,foot)=>{
  Object.assign(A.PL,{x:bag.x+dx,z:bag.z,y:100+foot});return A.racePunchHit(bag);
};
const sweepDeck=A.RACE_P.find(p=>p.sec===1&&!p.cp),sweeps=obstacles.filter(h=>h.k==='bar');
const sweepSeparation=Math.min(...sweeps.flatMap((p,i)=>sweeps.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.z-q.z))));
let guardedEdges=true;
for(const side of [-1,1]){const x=side*(sweepDeck.w/2+.2),guards=obstacles.filter(h=>h.sec===1&&h.k==='punch'&&Math.sign(h.x)===side);
  guardedEdges&&=guards.length>0&&guards.every(h=>{Object.assign(A.PL,{x,z:h.z,y:100});return A.racePunchHit(h);});}
check('Five sweeps are scattered across the wide deck without overlapping swept disks, and visible guards block both outer strips',
  sweepDeck.w===44&&sweeps.length===5&&new Set(sweeps.map(h=>h.x)).size>=4&&sweepSeparation>22&&guardedEdges,{sweepSeparation});
// Use the same five-footprint support sampling as the game, including a center
// just outside the nominal deck edge. This catches the former toe-edge shortcut
// that center-only geometry checks missed.
const footSupported=(x,z)=>[[-.3,-.3],[-.3,.3],[.3,-.3],[.3,.3],[0,0]].some(([dx,dz])=>A.raceTopAt(x+dx,z+dz)>99);
const openStraightLines=(sec,lo,hi,from,to)=>{const open=[],guards=obstacles.filter(h=>h.sec===sec&&h.k==='punch');
  for(let x=lo;x<=hi+.0001;x+=.025){let supported=true,blocked=false;
    for(let z=from;z<=to;z+=.25){if(!footSupported(x,z)){supported=false;break;}Object.assign(A.PL,{x,z,y:100});
      if(guards.some(h=>A.racePunchHit(h))){blocked=true;break;}}
    if(supported&&!blocked)open.push(+x.toFixed(3));}return open;};
const edgeAudit={start:openStraightLines(0,-22.3,22.3,0,76),left:openStraightLines(1,-22.3,-18.7,97,202),right:openStraightLines(1,18.7,22.3,97,202),chute:[]};
// 82차 — each candy row across the U: sample the actual ground-level player against the actual candies. Every row keeps
// one lane at least 4 wide, and a candy standing on a wall closes that wall up to the body clamp (no lip sneaking).
// 87차 — the candies are wrapped candies (candy87) lying on the chute floor, judged by their own outline (chuteCandyAt87: body + wing plates).
// A lane is open only if a ground-level rider can follow it straight along the track through the whole row (row z ± 7 — yawed wings included).
{const lim=C.hw-A.PL.R-.03;
 for(let row=0;row<C.bumpRows.length;row++){const [zr,ds]=C.bumpRows[row],z=C.z0+zr,open=[],mine=obstacles.filter(h=>h.candy87&&h.id.startsWith('chute'+row+':'));
  for(let d=-lim;d<=lim+1e-9;d+=.02){let blocked=false;
   for(let zz=z-7;zz<=z+7&&!blocked;zz+=.25){const q=A.chuteQ82(zz),x=q.cx+d/q.cs,y=A.raceSurface(slide,x,zz)-100;blocked=mine.some(h=>A.chuteCandyAt87(h,x,y,zz));}
   if(!blocked)open.push(d);}
  const lanes=[];for(const d of open){const l=lanes.at(-1);if(l&&d-l[1]<.021)l[1]=d;else lanes.push([d,d]);}
  const wide=lanes.filter(([a,b])=>b-a>=4),wallsClosed=ds.filter(d=>Math.abs(d)>=8).every(d=>!lanes.some(([a,b])=>Math.sign(d)*(Math.sign(d)>0?b:a)>=lim-.03));
  edgeAudit.chute.push({z,lanes:lanes.map(([a,b])=>[+a.toFixed(2),+b.toFixed(2)]),wide:wide.length,wallsClosed});}}
check('Actual foot support and capsule collision block constant-X start routes and both outer-edge walking shortcuts; every chute candy row leaves a 4-wide lane and closes its wall',
  !edgeAudit.start.length&&!edgeAudit.left.length&&!edgeAudit.right.length&&edgeAudit.chute.length===C.bumpRows.length&&edgeAudit.chute.every(q=>q.wide>=1&&q.wallsClosed),edgeAudit);
check('Punch bags use rounded vertical capsules with no invisible side or top walls',
  probeBag(0,0)&&probeBag(bag.r+A.PL.R-.001,1)&&!probeBag(bag.r+A.PL.R+.001,1)&&
  probeBag(0,bag.y+bag.h/2-.001)&&!probeBag(0,bag.y+bag.h/2+.001));
Object.assign(A.PL,{x:bag.x,z:bag.z,y:100,ground:true,vx:0,vz:0,vy:0});
A.RACE.hitCd=A.RACE.slipT=0;A.RACE74.rate=A.RACE_LAUNCH_RATE;A.raceHazardTick(1/60);
check('Touching a punch bag really bounces the player and restores normal knockback gravity',
  A.RACE.hitCd>0&&!A.PL.ground&&A.PL.vy>0&&Math.abs(Math.hypot(A.PL.vx,A.PL.vz)-40)<1e-8&&A.RACE74.rate===1&&A.raceGravityScale()===1);
// Unit-test the rounded sweep separately from the nearby edge guards. The full
// hazard set above remains active for every checkpoint safety probe.
const completeHazards=A.RACE._haz;
const bar=A.raceHazards(2).find(h=>h.k==='bar'),probeBar=offset=>{
  // len includes both rounded end caps, just like the rendered padded tube.
  const distance=bar.len/2+A.PL.R+offset;
  Object.assign(A.PL,{x:bar.x+Math.cos(bar.ang)*distance,z:bar.z-Math.sin(bar.ang)*distance,y:100+bar.y-1.3,ground:true,vx:0,vz:0,vy:0});
  A.RACE.hitCd=A.RACE.slipT=0;A.raceHazardTick(1/60);return A.RACE.hitCd>0;
};
A.RACE._haz=[bar];
check('Rotating padded bar uses rounded capsule ends rather than an invisible square box',probeBar(-.001)&&!probeBar(.001));
const jumpClearance=[];
for(const fps of [30,60,120]){
  let y=0,vy=A.JUMP,peak=0;do{vy-=A.GRAV/fps;y+=vy/fps;peak=Math.max(peak,y);}while(y>=0);
  Object.assign(A.PL,{x:bar.x,z:bar.z,y:100+peak,ground:false,vx:0,vz:0,vy:0});
  A.RACE.hitCd=A.RACE.slipT=0;A.raceHazardTick(1/fps);
  jumpClearance.push({fps,peak,barTop:bar.y+bar.r,clear:A.RACE.hitCd===0});
}
check('A normal single jump clears the padded bar even at 30 Hz',jumpClearance.every(q=>q.clear&&q.peak>q.barTop+.04),jumpClearance);
A.RACE._haz=completeHazards;
const rate=manualPads[0].bounce.rate,arcs=[];
for(const p of manualPads)arcs.push({vy:p.bounce.v,vz:p.bounce.forward});
check('Manual donuts stagger left and right and launch rapidly with time reserved for air steering',
  manualPads.every((p,i)=>p.x===[-7,8,-8,7][i]&&p.bounce.v===55&&p.bounce.forward===21.5&&p.bounce.rate===1));
const integrated=[];
for(const fps of [30,60,120])for(const q of arcs){
  const steps=Math.ceil((1/fps)/(1/120)),dt=1/fps/steps;let y=0,z=0,v=q.vy,peak=0,t=0,apexTime=0;
  Object.assign(A.RACE74,{flight:1,rate:1,flightKind:'manual'});
  for(let i=0;i<fps*steps*4;i++){const oldY=y,oldZ=z;A.PL.vy=v;v-=A.GRAV*A.raceGravityScale()*dt;y+=v*dt;z+=q.vz*dt;t+=dt;peak=Math.max(peak,y);if(Math.abs(v)<8)apexTime+=dt;
    if(y<0){const u=oldY/(oldY-y);integrated.push({fps,range:oldZ+(z-oldZ)*u,peak,time:t-dt+u*dt,apexTime});break;}}
}
check('Real 120 Hz movement substeps retain the calibrated donut height and landing circle at 30/60/120 display Hz',
  integrated.every(q=>Math.abs(q.range-56)<1&&Math.abs(q.peak-23.1)<.4&&q.time>2.5&&q.time<2.7&&q.apexTime>1),integrated);
A.RACE74.flight=0;
const ordinary=A.raceGravityScale();A.RACE74.flight=1;
A.RACE74.rate=1;A.RACE74.flightKind='knock';
const knockback=A.raceGravityScale();A.RACE74.rate=rate;A.setRacing(false);const outsideRace=A.raceGravityScale();A.setRacing(true);
check('Normal jumps, obstacle knockback and play outside the race keep the original gravity',ordinary===1&&knockback===1&&outsideRace===1);
const airControls=[];
for(const fps of [30,60,120])for(const [name,vx,vz]of [['coast',0,0],['left',-10,0],['right',10,0],['brake',0,-10]]){
  Object.assign(A.RACE,{t:2,fallT:0,hitCd:0,slipT:0});Object.assign(A.RACE74,{flight:.001,rate:1,flightKind:'manual',forward:21.5,pending:null,landAge:9});
  Object.assign(A.PL,{ground:false,vx:0,vz:21.5});let x=0,z=0;
  for(let i=0;i<fps*.6;i++){A.raceMotion(1/fps,vx,vz,Math.hypot(vx,vz)>0?1:0);x+=A.PL.vx/fps;z+=A.PL.vz/fps;}
  airControls.push({fps,name,x,z,vz:A.PL.vz});
}
check('Real buoyant-flight steering provides substantial sideways control and bounded reverse braking',
  airControls.every(q=>q.name==='coast'?Math.abs(q.x)<1e-8&&Math.abs(q.vz-21.5)<1e-8:
    q.name==='brake'?q.vz>15&&q.vz<18&&q.z>10:
    Math.sign(q.x)===(q.name==='left'?-1:1)&&Math.abs(q.x)>4.8&&Math.abs(q.x)<5.1&&q.z>12),airControls);

// The cylinder and hemisphere must share the same actual equator polygon.
// Merely matching radius leaves tiny sky-colored holes when 16-sided shafts
// meet 24-sided caps. Execute the source geometry and real draw transforms;
// inspect both ends of vertical punch bags and rotated horizontal bars.
const geometryFor=name=>{const m=new RegExp('A\\.'+name+'=dyn\\(raceArtUV\\((?:raceCandyGeometry77\\()?'+ '(new THREE\\.[A-Za-z]+Geometry\\([^\\n]+?\\))').exec(source);
  if(!m)throw Error('Missing race geometry '+name);return vm.runInNewContext(m[1],{THREE});};
const shaft=geometryFor('bar'),cap=geometryFor('cap'),seamCases=[];
const bank=geometry=>({geometry,matrices:[],count:0,count_max:512,setMatrixAt(i,m){this.matrices[i]=m.clone();}});
const artFixture=()=>{const art={builtSeed:1,stamp:0,static:[],dynamic:[],toys:[],stats:{}};
  for(const n of ['pad','padTrim','bar','ball','cap','metal','jump','rock'])art[n]=bank(n==='bar'?shaft:cap);art.donut=[bank(cap),bank(cap),bank(cap)];art.candy87=[0,1,2,3,4,5].map(()=>bank(cap));return art;};   // 87차 — 포장 사탕 색 여섯
const drawContext=vm.createContext({THREE,art:artFixture(),hazards:[]});
vm.runInContext(`const MINI_Y=100,PL={z:0},RACE={seed:1,t:0},RACE_P=[{}],RACE74={pulse:new Map()},RACE_RAINBOW76=[0xffffff];
 const RACE_ART_PALETTE={cream:0xffffff,yellow:0xffff00,silver:0xaaaaaa,lavender:0xccccff};let RACE_ART74=art;
 const raceOn=()=>true,raceHazards=()=>hazards,flush=()=>{},FLIP_ON=false,raceToyForm77=()=>-1;
 const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),_eu=new THREE.Euler();
 ${fn('setIR')}\n${fn('setIR3')}\n${fn('raceArtDraw')}`,drawContext);
const ring=(g,y,m)=>{const p=g.attributes.position,points=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-y)<1e-6&&Math.hypot(p.getX(i),p.getZ(i))>.99){
    const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m);
    if(!points.some(q=>q.distanceTo(v)<1e-5))points.push(v);}
  return points;};
const gap=(a,b)=>Math.max(...a.map(p=>Math.min(...b.map(q=>p.distanceTo(q)))));
for(const h of [{k:'punch',x:0,y:4,z:0,r:2.3,h:8},{k:'punch',x:1,y:2.8,z:0,r:1.5,h:5.6},
  ...[0,.37,1.2].map(ang=>({k:'bar',x:0,y:1.7,z:0,r:1.65,len:22,ang}))]){
  drawContext.hazards=[h];vm.runInContext('raceArtDraw(0)',drawContext);const art=drawContext.art;
  const ends=[...ring(shaft,-.5,art.bar.matrices[0]),...ring(shaft,.5,art.bar.matrices[0])];
  const rims=[...ring(cap,0,art.cap.matrices[0]),...ring(cap,0,art.cap.matrices[1])];
  const oldShaft=new THREE.CylinderGeometry(1,1,1,16,1,false);
  const oldEnds=[...ring(oldShaft,-.5,art.bar.matrices[0]),...ring(oldShaft,.5,art.bar.matrices[0])];
  seamCases.push({kind:h.k,angle:h.ang||0,cylinderPoints:ends.length,capPoints:rims.length,
    gap:Math.max(gap(ends,rims),gap(rims,ends)),old16Gap:Math.max(gap(oldEnds,rims),gap(rims,oldEnds))});oldShaft.dispose();
}
check('Actual transformed cylinder and hemisphere equators meet without polygon gaps on both capsule ends',
  seamCases.every(q=>q.cylinderPoints===q.capPoints&&q.gap<1e-5&&q.old16Gap>.05),seamCases);
shaft.dispose();cap.dispose();

// Ranking and the existing classroom rewards are part of the course contract.
// Real catalog data and real reward functions run; only UI and the resource sink are fixtures.
const reward=vm.createContext({console});
new vm.Script(`
const KIT={ownW:[],ownA:[],enh:[]},hudPrev={},RES_KEYS=['w','s','g','eg','mk','pk'],gains={};
let uid='me',netPCDirty=false;const MINE={fin:-1},miniPl=new Map(),window={},fx2Cel=()=>{},toast=()=>{};
const costTxt=c=>JSON.stringify(c),gain=(k,v)=>gains[k]=(gains[k]||0)+v;
${['WEAPONS','ARMORS','RACE_RES','RACE_FIN'].map(decl).join('\n')}
${['gainAll','raceGiveWeapon','raceGiveArmor','raceDone','raceFinish'].map(fn).join('\n')}
globalThis.B={KIT,WEAPONS,ARMORS,gains,miniPl,RACE_RES,RACE_FIN,raceGiveWeapon,raceGiveArmor,raceDone,raceFinish,
 reset(){KIT.ownW=[];KIT.ownA=[];KIT.enh=[];for(const k of RES_KEYS)delete gains[k];},
 place(rank,finished=true){const rows=Array.from({length:21},(_,i)=>({u:i===rank?'me':'kid'+i,fin:finished?40+i:-1,prog:1-i/25}));raceDone({rank:rows});}};`).runInContext(reward);
const B=reward.B,plain=x=>JSON.parse(JSON.stringify(x));
const sameResources=(a,b)=>['w','s','g','eg','mk','pk'].every(k=>(a[k]||0)===(b[k]||0));
B.reset();B.place(0);check('First-place prize remains one unique weapon plus the finish award',B.KIT.ownW.filter(Boolean).length===1&&B.KIT.ownW.some((v,i)=>v&&B.WEAPONS[i].tier==='unique')&&JSON.stringify(B.gains)===JSON.stringify(B.RACE_FIN));
let rare=true;for(const rank of [1,2]){B.reset();B.place(rank);rare&&=B.KIT.ownW.filter(Boolean).length===1&&B.KIT.ownW.some((v,i)=>v&&B.WEAPONS[i].tier==='rare');}
check('Second and third place retain rare weapon rewards',rare);
let armor=true;for(const rank of [3,4]){B.reset();B.place(rank);armor&&=B.KIT.ownA[B.ARMORS.length-1]===true;}
check('Fourth and fifth place retain the top armor reward',armor);
let resources=true;for(let rank=5;rank<=9;rank++){B.reset();B.place(rank);for(const k of ['w','s','g'])resources&&=B.gains[k]===B.RACE_RES[rank-5][k]+B.RACE_FIN[k];}
check('Sixth through tenth place retain their resource awards',resources);
B.reset();B.place(20);const finished=JSON.stringify(B.gains)===JSON.stringify(B.RACE_FIN);B.reset();B.place(20,false);
check('Finishing outside the top ten earns the finish award; unfinished players do not',finished&&Object.keys(B.gains).length===0);
B.reset();B.WEAPONS.forEach((w,i)=>B.KIT.ownW[i]=true);const duplicate=B.raceGiveWeapon('unique'),material=B.WEAPONS.find(w=>w.tier==='unique').mat;
check('An already-owned weapon converts to its catalog materials',duplicate.got===false&&sameResources(B.gains,material));
B.reset();B.KIT.ownA[B.ARMORS.length-1]=true;const duplicateArmor=B.raceGiveArmor();
check('Already-owned top armor converts to its catalog resources',duplicateArmor.got===false&&sameResources(B.gains,B.ARMORS.at(-1).cost));
B.miniPl.set('late',{n:'late',fin:70,prog:1});B.miniPl.set('near',{n:'near',fin:-1,prog:.95});B.miniPl.set('early',{n:'early',fin:48,prog:1});B.miniPl.set('far',{n:'far',fin:-1,prog:.3});const ranked={};B.raceFinish(ranked);
check('Ranking uses finish time first, then unfinished progress',JSON.stringify(plain(ranked.rank).map(r=>r.u))===JSON.stringify(['early','late','near','far']));

fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'54-race-results.json'),JSON.stringify({file,sha256:crypto.createHash('sha256').update(source).digest('hex'),results},null,2));
console.log(`${results.filter(r=>r.pass).length}/${results.length} checks passed`);
if(results.some(r=>!r.pass))process.exitCode=1;
