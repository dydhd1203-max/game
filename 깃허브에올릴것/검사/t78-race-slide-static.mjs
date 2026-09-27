// Actual slide functions against an independent continuous capsule-distance oracle.
// Node only: no browser, renderer, production network or source mutation.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const extractor=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',extractor.slice(extractor.indexOf('function end('),extractor.indexOf('const results=[];'))+';return {fn,decl};')(source);
const results=[],check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
const ctx=vm.createContext({Math,Map});
vm.runInContext(`const MINI_Y=100,MINI_PADZ=-19,PL={R:.3},G={mini:{st:'run'},paused:false},MINE={cp:0};
 let racing=true;const raceOn=()=>racing,raceHold=()=>false,raceBounceSound=()=>{},burst=()=>{};
 ${['RACE_X','RACE_S','RACE_Z_FIN','RACE_ROWZ','RACE_P','RACE','RACE74','RACE_LAUNCH_RATE','ROCK','STEP','GRAV','RACE_TOY77'].map(decl).join('\n')}
 ${['mulberry','race74Reset','raceBuild','raceOff','raceZOff','racePose','raceContains','raceSurface','raceUnder','rockU','raceRocks','raceHazards','raceSphereHit','racePunchHit','raceToyForm77','raceToyHit77','raceBarHit','raceSlideAdhere78','raceSlideHit78','raceHazardTick','raceMotion'].map(fn).join('\n')}
 globalThis.A={PL,G,RACE,RACE_P,RACE74,STEP,GRAV,raceBuild,raceContains,raceSurface,raceHazards,raceSlideAdhere78,raceSlideHit78,raceHazardTick,raceMotion,setRacing:q=>racing=q};`,ctx);
const A=ctx.A;A.raceBuild(78021);A.RACE.t=3;
const slide=A.RACE_P.find(p=>p.shape==='slide'),hazards=A.raceHazards(3).filter(h=>h.sec===5).map(h=>({...h}));
const rows=[...new Set(hazards.map(h=>h.z))].sort((a,b)=>a-b);
check('The actual slide has three rows of three full-height capsule obstacles',rows.length===3&&hazards.length===9&&rows.every(z=>hazards.filter(h=>h.z===z).length===3)&&hazards.every(h=>h.k==='punch'&&h.h>=6&&h.r>=3),{rows,count:hazards.length});

// Piecewise analytic minimum: an upright moving player segment versus an upright fixed obstacle segment.
// The vertical gap is linear between overlap-boundary times, so its squared 3D distance is quadratic.
// This deliberately does not reuse the game's temporal sampling or collision helper.
function distanceOracle(p0,p1,h){
 const vx=p1.x-p0.x,vy=p1.y-p0.y,vz=p1.z-p0.z,dx=p0.x-h.x,dz=p0.z-h.z;
 const lo=h.y-Math.max(0,h.h/2-h.r),hi=h.y+Math.max(0,h.h/2-h.r),times=[0,1];
 if(vy)for(const y of [lo-1.3,hi-.3]){const t=(y-p0.y)/vy;if(t>0&&t<1)times.push(t);}
 times.sort((a,b)=>a-b);let min2=Infinity;
 for(let i=1;i<times.length;i++){
  const a=times[i-1],b=times[i],mid=(a+b)/2,y=p0.y+vy*mid;
  const g=y+1.3<lo?lo-p0.y-1.3:y+.3>hi?p0.y+.3-hi:0,gv=y+1.3<lo?-vy:y+.3>hi?vy:0;
  const den=vx*vx+vz*vz+gv*gv,u=den?Math.max(a,Math.min(b,-(dx*vx+dz*vz+g*gv)/den)):a;
  for(const t of [a,b,u])min2=Math.min(min2,(dx+vx*t)**2+(dz+vz*t)**2+(g+gv*t)**2);
 }return Math.sqrt(min2);
}
function sample(p0,p1,h,dt=1/60,stale=false){
 A.RACE.t=3;Object.assign(A.PL,{...p1,y:100+p1.y});Object.assign(A.RACE74,{prevX:p0.x,prevY:100+p0.y,prevZ:p0.z,prevTime:stale?-999:3-dt});
 return A.raceSlideHit78(h,dt);
}
let seed=7827;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let misses=0,falseHits=0,contacts=0,endpointMisses=0;const failures=[];
for(let i=0;i<1800;i++){
 const dt=[1/30,1/60,1/120][i%3],h=hazards[i%hazards.length],angle=rand()*Math.PI*2,speed=34+rand()*32;
 const p0={x:h.x+(rand()-.5)*12,y:h.y-h.h/2-3+rand()*13,z:h.z+(rand()-.5)*12};
 const p1={x:p0.x+Math.sin(angle)*speed*dt,y:p0.y+(rand()-.5)*110*dt,z:p0.z+Math.cos(angle)*speed*dt};
 const min=distanceOracle(p0,p1,h),hit=sample(p0,p1,h,dt),r=h.r+.3;
 if(min<r-.005){contacts++;if(!hit){misses++;failures.push({p0,p1,h,dt,min});}}
 if(min>r+.000001&&hit)falseHits++;
 if(hit&&distanceOracle(p1,p1,h)>=r)endpointMisses++;
}
check('Swept slide capsules match an analytic oracle at 34–66 speed and 30/60/120 Hz',misses===0&&falseHits===0&&contacts>250,{cases:1800,contacts,misses,falseHits,endpointMisses,failures:failures.slice(0,2)});
check('Sweep detects contacts already passed by the end of the frame',endpointMisses>10,{endpointMisses});
const h=hazards[0],floor=h.y-h.h/2,r=h.r+.3;
const cross0={x:h.x,y:floor+2,z:h.z-4},cross1={...cross0,z:h.z+4};
const near0={x:h.x+r+.001,y:floor+2,z:h.z-4},near1={...near0,z:h.z+4};
check('A complete crossing hits while a 1 mm capsule near miss remains clear',sample(cross0,cross1,h,.05)&&!sample(near0,near1,h,.05));
const above={x:h.x,y:h.y+h.h/2+.001,z:h.z},below={x:h.x,y:floor-1.61,z:h.z};
check('Clear jumps, below-deck falls and stale pre-respawn sweeps do not create hits',!sample(above,above,h)&&!sample(below,below,h)&&!sample(cross0,{...cross1,z:h.z+20},h,1/60,true));
const oldHaz=A.RACE._haz;A.RACE._haz=[h];Object.assign(A.RACE,{hitCd:0,slipT:0});sample(cross0,cross1,h,.05);A.raceHazardTick(.05);
check('The actual hazard dispatcher turns a swept crossing into knockback once',A.RACE.hitCd>0&&!A.PL.ground&&A.PL.vy===7&&A.RACE74.flightKind==='knock'&&Math.abs(Math.hypot(A.PL.vx,A.PL.vz)-40)<1e-8);
A.RACE._haz=oldHaz;

const rowEvidence=rows.map((z,i)=>{
 const bags=hazards.filter(h=>h.z===z),open=[];
 for(let x=-13.3;x<=13.30001;x+=.05){let hit=false;
  for(let dz=-5;dz<=5;dz+=.05){const p={x,z:z+dz,y:A.raceSurface(slide,x,z+dz)-100};if(bags.some(h=>distanceOracle(p,p,h)<h.r+.3)){hit=true;break;}}
  if(!hit)open.push(x);
 }
 const gapCenter=i%2?3.4:-3.4;let centerHit=false;
 for(let dz=-5;dz<=5;dz+=.025){const p={x:0,z:z+dz,y:A.raceSurface(slide,0,z+dz)-100};centerHit||=bags.some(h=>distanceOracle(p,p,h)<h.r+.3);}
 let gapClear=true;for(let dz=-6;dz<=6;dz+=.1){const p={x:gapCenter,z:z+dz,y:A.raceSurface(slide,gapCenter,z+dz)-100};gapClear&&=!bags.some(h=>distanceOracle(p,p,h)<h.r+.3);}
 const segments=open.reduce((n,x,i)=>n+(!i||x-open[i-1]>.051?1:0),0);
 return {z,gapCenter,gapClear,centerHit,segments,openMin:Math.min(...open),openMax:Math.max(...open),openWidth:open.length*.05};
});
check('Three grounded gates alternate one usable left/right opening and block center and toe-edge bypasses',rowEvidence.every(q=>q.gapClear&&q.centerHit&&q.segments===1&&q.openWidth>3&&q.openWidth<8&&Math.sign(q.openMin)===Math.sign(q.gapCenter)&&Math.sign(q.openMax)===Math.sign(q.gapCenter)),rowEvidence);
const actualRoutes=[];for(const hz of [30,60,120])for(let row=0;row<rows.length;row++)for(const lane of ['center','gap']){
 const z=rows[row],x=lane==='center'?0:row%2?3.4:-3.4,bags=hazards.filter(h=>h.z===z),dt=1/hz;
 let p0={x,z:z-6,y:A.raceSurface(slide,x,z-6)-100},hit=false;
 while(p0.z<z+6){const zz=Math.min(z+6,p0.z+66*dt),p1={x,z:zz,y:A.raceSurface(slide,x,zz)-100};hit||=bags.some(h=>sample(p0,p1,h,dt));p0=p1;}
 actualRoutes.push({hz,row,lane,hit});
}
check('Actual swept helpers hit all nine high-speed center runs and spare all nine intended gap runs',actualRoutes.every(q=>q.hit===(q.lane==='center')),{cases:actualRoutes.length});

function adhere({z=722,x=0,drop=.3,vz=66,vy=-.2,ground=true,flight=0,mode=1,dt=1/120,gnd,racing=true}={}){
 A.setRacing(racing);Object.assign(A.PL,{x,z,y:(gnd??A.raceSurface(slide,x,z))+drop,vz,vy,ground});Object.assign(A.RACE74,{flight,slide:mode});return A.raceSlideAdhere78(gnd??A.raceSurface(slide,x,z),dt);
}
const states=[{ground:false},{vy:2},{flight:.001},{mode:0},{racing:false},{z:760},{x:20},{gnd:-999},{drop:3}];
check('Continuous-slope adherence never catches an airborne jump, knockback, missing deck or excessive drop',adhere()&&states.every(q=>!adhere(q)),{rejectedStates:states.length});A.setRacing(true);
// Run the actual integration statement, retaining its positive vertical-gap guard.
const line=source.split('\n').find(s=>s.includes('raceSlideAdhere78(gnd,dt))) PL.y = gnd;'));
if(!line)throw Error('Missing live slide adherence integration');
const applyAdhere=new Function('PL','gnd','dt','STEP','raceSlideAdhere78','miniOn','raceOn',line);
let supported=true,maxDrop=0;const contactCases=[];
for(const hz of [30,60,120])for(const speed of [34,58,66]){
 const dt=1/hz/Math.ceil((1/hz)/(1/120));let z=slide.z-slide.d/2+.5,y=A.raceSurface(slide,0,z),steps=0;
 Object.assign(A.RACE74,{slide:1,flight:0});
 while(z+speed*dt<slide.z+slide.d/2-.5){z+=speed*dt;const gnd=A.raceSurface(slide,0,z);Object.assign(A.PL,{x:0,z,y:y-A.GRAV*dt*dt,ground:true,vy:-A.GRAV*dt,vz:speed});
  maxDrop=Math.max(maxDrop,A.PL.y-gnd);applyAdhere(A.PL,gnd,dt,A.STEP,A.raceSlideAdhere78,()=>true,()=>true);if(A.PL.y>gnd+1e-9)supported=false;y=gnd;steps++;
 }contactCases.push({hz,speed,steps});
}
check('The live ground statement follows the entire downhill surface without alternating airborne frames',supported,{cases:contactCases.length,maxDrop});
const dtWide=1/30,zWide=723.2,gndWide=A.raceSurface(slide,0,zWide),beforeWide=A.raceSurface(slide,0,721)-A.GRAV*dtWide*dtWide;
Object.assign(A.PL,{x:0,z:zWide,y:beforeWide,ground:true,vy:-A.GRAV*dtWide,vz:66});Object.assign(A.RACE74,{slide:1,flight:0});
applyAdhere(A.PL,gndWide,dtWide,A.STEP,A.raceSlideAdhere78,()=>true,()=>true);
check('A continuous high-speed descent exceeding one stair step uses slope adherence instead of becoming airborne',beforeWide-gndWide>A.STEP+.02&&A.PL.y===gndWide,{drop:beforeWide-gndWide,ordinaryStep:A.STEP});
Object.assign(A.PL,{x:0,z:722,y:100,ground:false,vy:5,vz:66});Object.assign(A.RACE74,{slide:1,flight:0});
applyAdhere(A.PL,115,1/60,A.STEP,A.raceSlideAdhere78,()=>true,()=>true);
check('The live integration cannot teleport a player upward from beneath the slide',A.PL.y===100);
const speeds=[];for(const [name,input]of [['coast',0],['forward',19.4832],['brake',-19.4832]]){
 Object.assign(A.PL,{x:0,z:720,y:A.raceSurface(slide,0,720),ground:true,vx:0,vz:20,vy:0});Object.assign(A.RACE74,{slide:1,flight:0,pending:null,landAge:9,impact:0});Object.assign(A.RACE,{hitCd:0,slipT:0,fallT:0});
 for(let i=0;i<120;i++)A.raceMotion(1/120,0,input,input?1:0);speeds.push({name,vz:A.PL.vz});
}
check('Actual slide motion retains fast coasting, acceleration and useful braking',speeds[0].vz>57&&speeds[0].vz<58&&speeds[1].vz>65&&speeds[1].vz<66&&speeds[2].vz>33&&speeds[2].vz<35,speeds);
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/78-race-slide'));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify({results,rowEvidence,contactCases},null,2));
console.log(`${results.filter(q=>q.pass).length}/${results.length} slide regressions passed.`);process.exitCode=results.every(q=>q.pass)?0:1;
