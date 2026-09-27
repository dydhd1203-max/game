/* Current obstacle-course contracts, executed from the game source in Node.
   74 replaces the old rainbow/stone/stamp layout. Actual movement and renderer
   integration are checked in t74-race-view.mjs; no OS cursor or network here. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/54-race'));
const source=fs.readFileSync(file,'utf8');
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
let uid='kid00';const raceOn=()=>true;
const raceArtBuild=()=>{},raceArtRebuild=()=>{},raceArtReset=()=>{};
const raceBounceSound=()=>{};
`;
const declarations=['RACE_X','RACE_S','RACE_Z_FIN','RACE_ROWZ','RACE_P','RACE','RACE74','GRAV'];
const functions=['mulberry','furLight','race74Reset','raceBuild','raceOff','raceAlive','raceContains','raceSurface','raceTopAt','raceUnder','raceSlotXZ','raceCheckpointXZ','raceHazards','raceSphereHit','raceHazardTick'];
const ctx=vm.createContext({console});
new vm.Script([fixtures,...declarations.map(decl),...functions.map(fn),`
globalThis.A={RACE,RACE_P,RACE_S,RACE_Z_FIN,GRAV,JUMP,PL,G,MINE,raceBuild,raceOff,raceContains,raceSurface,raceTopAt,raceUnder,raceHazards,raceHazardTick,
 spawn(id){uid=id;return raceSlotXZ();},cp(id,p){uid=id;return raceCheckpointXZ(p);}};`].join('\n')).runInContext(ctx,{timeout:10000});
const A=ctx.A,seeds=Array.from({length:90},(_,i)=>i*7919+13);
let deterministic=true,finite=true,centerSupport=true,moving=false,checkpoints=true;
let platformCount=0,variantCount=new Set();
for(const seed of seeds){
  A.raceBuild(seed);const a=JSON.stringify(A.RACE_P);A.raceBuild(seed);deterministic&&=a===JSON.stringify(A.RACE_P);variantCount.add(a);
  platformCount=Math.max(platformCount,A.RACE_P.length);
  checkpoints&&=A.RACE_P.filter(p=>p.cp).length===7;
  for(const p of A.RACE_P){
    finite&&=['x','z','y','w','d','h'].every(k=>Number.isFinite(p[k]))&&p.w>0&&p.d>0&&p.h>0;
    for(const t of [0,.5,3,11]){const x=p.x+A.raceOff(p,t);
      centerSupport&&=A.raceContains(p,x,p.z,0,t)&&Number.isFinite(A.raceSurface(p,x,p.z));
      if(p.mv){moving=true;finite&&=Math.abs(A.raceOff(p,t))<=p.mv.amp+1e-8;}}
  }
}
check('Same seed creates the same seven-section course',deterministic&&A.RACE_S.length===7,{seeds:seeds.length,variants:variantCount.size});
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
const slide=A.RACE_P.find(p=>p.shape==='slide');
let slideSmooth=!!slide,largestStep=0,slopes=[];
if(slide){const z0=slide.z-slide.d/2,z1=slide.z+slide.d/2,step=slide.d/1000;
  let previous=A.raceSurface(slide,slide.x,z0);
  slideSmooth&&=Math.abs(previous-100-slide.y)<1e-8&&Math.abs(A.raceSurface(slide,slide.x,z1)-100-slide.yEnd)<1e-8;
  for(let i=1;i<=1000;i++){const h=A.raceSurface(slide,slide.x,z0+i*step);largestStep=Math.max(largestStep,Math.abs(h-previous));
    slideSmooth&&=Number.isFinite(h)&&h<=previous+1e-9;previous=h;}
  slopes=[Math.abs(A.raceSurface(slide,slide.x,z0+step)-A.raceSurface(slide,slide.x,z0))/step,
    Math.abs(A.raceSurface(slide,slide.x,z1)-A.raceSurface(slide,slide.x,z1-step))/step];
  slideSmooth&&=slopes.every(s=>s<.02)&&largestStep<.08;
}
check('Actual slide collision descends continuously with gentle entry and exit slopes',slideSmooth,{largestStep,slopes});
const launchPads=A.RACE_P.filter(p=>p.bounce),launchVelocities=new Set(launchPads.map(p=>p.bounce.v));
check('Small, medium and final launch pads expose distinct finite bounce impulses',launchPads.length>=6&&launchVelocities.size>=3&&
  launchPads.every(p=>Number.isFinite(p.bounce.v)&&p.bounce.v>0&&Number.isFinite(p.bounce.forward)&&p.bounce.forward>0),
  {pads:launchPads.length,verticalVelocities:[...launchVelocities]});
let hazardDet=true,hazardFinite=true,hazardSafe=true,maxHazards=0;
for(const seed of seeds.slice(0,16)){
  A.raceBuild(seed);
  for(let t=0;t<12;t+=.25){
    A.RACE.t=t;const h=A.raceHazards(t);maxHazards=Math.max(maxHazards,h.length);
    hazardDet&&=JSON.stringify(h)===JSON.stringify(A.raceHazards(t));
    hazardFinite&&=h.every(q=>['x','y','z','r'].every(k=>Number.isFinite(q[k])));
    for(const p of A.RACE_P.filter(p=>p.cp))for(const id of ids){const q=A.cp(id,p);
      Object.assign(A.PL,{x:q.x,z:q.z,y:100+q.y,ground:true,vx:0,vz:0,vy:0});A.RACE.hitCd=A.RACE.slipT=0;
      A.raceHazardTick(1/60);hazardSafe&&=A.RACE.hitCd===0;
    }
  }
}
check('Shared seed and time generate deterministic finite obstacles within the 64-object budget',hazardDet&&hazardFinite&&maxHazards>0&&maxHazards<=64,{maxHazards});
check('Moving hazards never hit any of the 21 respawn slots at any checkpoint',hazardSafe,{seeds:16,timesPerSeed:48,slots:21});
A.raceBuild(740021);A.RACE.t=2;
const bar=A.raceHazards(2).find(h=>h.k==='bar'),probeBar=offset=>{
  // len includes both rounded end caps, just like the rendered padded tube.
  const distance=bar.len/2+A.PL.R+offset;
  Object.assign(A.PL,{x:bar.x+Math.cos(bar.ang)*distance,z:bar.z-Math.sin(bar.ang)*distance,y:100,ground:true,vx:0,vz:0,vy:0});
  A.RACE.hitCd=A.RACE.slipT=0;A.raceHazardTick(1/60);return A.RACE.hitCd>0;
};
check('Rotating padded bar uses rounded capsule ends rather than an invisible square box',probeBar(-.001)&&!probeBar(.001));
const jumpClearance=[];
for(const fps of [30,60,120]){
  let y=0,vy=A.JUMP,peak=0;do{vy-=A.GRAV/fps;y+=vy/fps;peak=Math.max(peak,y);}while(y>=0);
  Object.assign(A.PL,{x:bar.x,z:bar.z,y:100+peak,ground:false,vx:0,vz:0,vy:0});
  A.RACE.hitCd=A.RACE.slipT=0;A.raceHazardTick(1/fps);
  jumpClearance.push({fps,peak,barTop:bar.y+bar.r,clear:A.RACE.hitCd===0});
}
check('A normal single jump clears the padded bar even at 30 Hz',jumpClearance.every(q=>q.clear&&q.peak>q.barTop+.04),jumpClearance);

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
