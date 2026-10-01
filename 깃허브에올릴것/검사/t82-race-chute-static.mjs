// 82차 rainbow roller coaster (chute82): actual game functions in a Node VM, no browser or network.
// Geometry, candy rows, swept candy contact against an independent oracle, speed/steer dynamics,
// crest hops, the kicker trajectory, the wall clamp at any height and rail-following flight.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const extractor=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',extractor.slice(extractor.indexOf('function end('),extractor.indexOf('const results=[];'))+';return {fn,decl};')(source);
const results=[],check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
const ctx=vm.createContext({Math,Map,Float32Array,Number});
const PLR=+(/const PL = \{[^}]*\bR:([\d.]+)/.exec(source)||[])[1];
vm.runInContext(`const MINI_Y=100,MINI_PADZ=-19,PL={R:${PLR}},G={mini:{st:'run'},paused:false},MINE={cp:0,fin:-1};
 let racing=true;const raceOn=()=>racing,raceHold=()=>false,raceBounceSound=()=>{},burst=()=>{},fovPunch=()=>{},toast=()=>{};
 ${['CH82','CH82_Z1','CH82T','CH82Q','CH82LP','chuteThrowZ82','RACE_RAINBOW76','chuteSq82','chuteRise82','chuteZone82','RACE_X','RACE_S','RACE_Z_FIN','RACE_ROWZ','RACE_P','RACE','RACE74','RACE_LAUNCH_RATE','ROCK','STEP','GRAV','RACE_TOY77'].map(decl).join('\n')}
 ${['mulberry','race74Reset','raceBuild','raceOff','raceZOff','racePose','raceContains','raceSurface','raceUnder','rockU','raceRocks','raceHazards','raceSphereHit','racePunchHit','raceToyForm77','raceToyHit77','raceBarHit','raceSlideAdhere78','raceSlideHit78','raceHazardTick','raceGravityScale','raceMotion',
   'chute82','chuteQ82','chuteProf82','chuteProfSlope82','chuteContains82','chuteSurf82','chuteGrad82','chuteMotion82','chuteFlight82','chuteLaunch82','chuteAfter82','chuteBump82','chuteThrow82','chuteLoopAt82','chuteLoopStart82','chuteLoop82'].map(fn).join('\n')}
 globalThis.A={PL,G,RACE,RACE_P,RACE74,STEP,GRAV,CH82,CH82_Z1,CH82_SHIFT,CH82_LAND,chute82,chuteQ82,chuteProf82,chuteProfSlope82,chuteContains82,chuteSurf82,chuteAfter82,chuteFlight82,chuteMotion82,chuteThrowZ82,chuteLoop82,raceBuild,raceContains,raceSurface,raceUnder,raceHazards,raceSlideAdhere78,raceSlideHit78,raceHazardTick,raceMotion,setRacing:q=>racing=q};`,ctx);
const A=ctx.A,C=A.CH82,Z0=C.z0,Z1=A.CH82_Z1;A.raceBuild(78021);A.RACE.t=3;
const chute=A.RACE_P.find(p=>p.chute),Q=z=>({...A.chuteQ82(z)}),Y=100;
const dOf=(x,z)=>{const q=Q(z);return (x-q.cx)*q.cs;},xOf=(d,z)=>{const q=Q(z);return q.cx+d/q.cs;};

// ── Geometry ──
{const T=A.chute82();let maxHead=0,maxHeadSafe=0,maxTurn=0,maxTurnSafe=0,prev=null;
 for(let i=0;i<T.n;i++){const th=Math.atan2(T.sn[i],T.cs[i]),thr=A.chuteThrowZ82(Z0+i*C.step);maxHead=Math.max(maxHead,Math.abs(th));if(!thr)maxHeadSafe=Math.max(maxHeadSafe,Math.abs(th));
  if(prev!==null){const k=Math.abs(th-prev)/C.step;maxTurn=Math.max(maxTurn,k);if(!thr)maxTurnSafe=Math.max(maxTurnSafe,k);}prev=th;}
 const endX=T.cx[T.n-1],startX=T.cx[0];
 // 84차 — 급커브(throws)만 ±47° · 굽음 .06 까지, 나머지는 82차처럼 ±36° 안(카메라가 앞을 늘 본다)
 check('The centre line starts and ends on x 0; headings stay inside ±36° except the sharp-curve zone (±47°), no kinks',Math.abs(startX)<1e-6&&Math.abs(endX)<.05&&maxHeadSafe<.63&&maxHead<.82&&maxTurn<.06&&maxTurnSafe<.045&&!!chute&&chute.sec===5&&chute.shape==='slide',{endX,maxHead,maxHeadSafe,maxTurn,maxTurnSafe});
 let mouthMax=0,mouthOk=true;for(let x=-12.6;x<=12.6;x+=.1){const h=A.raceSurface(chute,x,Z0+.3)-Y;mouthMax=Math.max(mouthMax,h-30);mouthOk&&=A.raceContains(chute,x,Z0+.3,A.PL.R);}
 const k0=Q(Z0).k,kM=Q(Z0+C.mouth).k,kHalf=Q(Z0+C.mouth/2).k;
 check('The mouth funnel grows the U from flat, so the whole 26-wide flag deck enters without a stair step',k0===0&&Math.abs(kM-1)<1e-6&&kHalf>.3&&kHalf<.7&&mouthOk&&mouthMax<A.STEP*.7,{k0,kHalf,kM,mouthMax,step:A.STEP});
 let uOk=true;const z=Z0+120;for(let d=0;d<C.hw;d+=.25)uOk&&=A.chuteSurf82(xOf(d+.25,z),z)>=A.chuteSurf82(xOf(d,z),z)-1e-9&&Math.abs(A.chuteSurf82(xOf(d,z),z)-A.chuteSurf82(xOf(-d,z),z))<1e-6;
 const rimH=A.chuteSurf82(xOf(C.hw,z),z)-Q(z).y;
 check('Full-depth cross-section is a symmetric U rising to the rim',uOk&&Math.abs(rimH-C.rim)<1e-6,{rimH});
 const zi=Z0+200;check('Containment covers the rubber lip and nothing wider',A.raceContains(chute,xOf(C.hw+C.lip,zi),zi,0)&&!A.raceContains(chute,xOf(C.hw+C.lip+.05,zi),zi,0)&&A.chuteContains82(xOf(0,Z1),Z1,0)&&!A.chuteContains82(0,Z1+1,0));
}

// ── Candy rows ──
const hazards=A.raceHazards(3).filter(h=>h.chute82).map(h=>({...h}));
{const expected=C.bumpRows.reduce((n,r)=>n+r[1].length,0);let embedded=true,tall=true;const rowsZ=[...new Set(hazards.map(h=>h.z))];
 for(const h of hazards){const d=dOf(h.x,h.z),q=Q(h.z),floorC=q.y+A.chuteProf82(d),bottom=h.y-h.h/2;
  // The capsule foot sits under the surface across its whole footprint (no visible gap on a wall slope).
  for(const s of [-1,1])embedded&&=bottom<q.y+A.chuteProf82(d+s*h.r)-.05;
  tall&&=h.y+h.h/2-floorC>4.8&&h.k==='punch'&&h.sec===5;}
 check('Every configured candy stands in the chute as an embedded, taller-than-one-jump capsule',hazards.length===expected&&rowsZ.length===C.bumpRows.length&&embedded&&tall,{count:hazards.length,expected,rows:rowsZ});
}

// ── Swept candy contact against an independent oracle (same capsule model as 78차) ──
function distanceOracle(p0,p1,h){
 const vx=p1.x-p0.x,vy=p1.y-p0.y,vz=p1.z-p0.z,dx=p0.x-h.x,dz=p0.z-h.z;
 const lo=h.y-Math.max(0,h.h/2-h.r),hi=h.y+Math.max(0,h.h/2-h.r),times=[0,1];
 if(vy)for(const y of [lo-1.3,hi-A.PL.R]){const t=(y-p0.y)/vy;if(t>0&&t<1)times.push(t);}
 times.sort((a,b)=>a-b);let min2=Infinity;
 for(let i=1;i<times.length;i++){
  const a=times[i-1],b=times[i],mid=(a+b)/2,y=p0.y+vy*mid;
  const g=y+1.3<lo?lo-p0.y-1.3:y+A.PL.R>hi?p0.y+A.PL.R-hi:0,gv=y+1.3<lo?-vy:y+A.PL.R>hi?vy:0;
  const den=vx*vx+vz*vz+gv*gv,u=den?Math.max(a,Math.min(b,-(dx*vx+dz*vz+g*gv)/den)):a;
  for(const t of [a,b,u])min2=Math.min(min2,(dx+vx*t)**2+(dz+vz*t)**2+(g+gv*t)**2);
 }return Math.sqrt(min2);
}
function sample(p0,p1,h,dt=1/60,stale=false){
 A.RACE.t=3;Object.assign(A.PL,{...p1,y:Y+p1.y});Object.assign(A.RACE74,{prevX:p0.x,prevY:Y+p0.y,prevZ:p0.z,prevTime:stale?-999:3-dt});
 return A.raceSlideHit78(h,dt);
}
{let seed=8227;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let misses=0,falseHits=0,contacts=0;
 for(let i=0;i<1800;i++){
  const dt=[1/30,1/60,1/120][i%3],h=hazards[i%hazards.length],angle=(rand()-.5)*1.4,speed=16+rand()*50;
  const p0={x:h.x+(rand()-.5)*12,y:h.y-h.h/2-2+rand()*12,z:h.z+(rand()-.5)*12};
  const p1={x:p0.x+Math.sin(angle)*speed*dt,y:p0.y+(rand()-.5)*60*dt,z:p0.z+Math.cos(angle)*speed*dt};
  const min=distanceOracle(p0,p1,h),hit=sample(p0,p1,h,dt),r=h.r+A.PL.R;
  if(min<r-.005){contacts++;if(!hit)misses++;}
  if(min>r+1e-6&&hit)falseHits++;
 }
 check('Swept candy capsules match an analytic oracle at 16–66 speed and 30/60/120 Hz',misses===0&&falseHits===0&&contacts>250,{cases:1800,contacts,misses,falseHits});
}

// ── Contact response: slows down and pops, never a long knockback out of the U ──
{const h=hazards[0],q=Q(h.z),d=dOf(h.x,h.z),z=h.z,y=q.y+A.chuteProf82(d)+.02,xa=h.x-.05,V=50;
 const p0={x:xa,y,z:z-4},p1={x:xa,y,z:z+.2};
 const oldHaz=A.RACE._haz;A.RACE._haz=[h];Object.assign(A.RACE,{hitCd:0,slipT:0,t:3});Object.assign(A.RACE74,{pulse:new Map()});
 sample(p0,p1,h,.05);Object.assign(A.PL,{vx:q.sn*V,vz:q.cs*V,vy:0,ground:true});A.raceHazardTick(.05);
 const qh=Q(A.PL.z),along=A.PL.vx*qh.sn+A.PL.vz*qh.cs,side=A.PL.vx*qh.cs-A.PL.vz*qh.sn;
 check('A candy hit keeps you in the chute: 42% speed (10–20), a small hop and a sideways nudge away from the candy',
  A.RACE.hitCd>.8&&!A.PL.ground&&Math.abs(A.PL.vy-4.5)<1e-9&&A.RACE74.flightKind==='chute'&&Math.abs(along-20)<.01&&Math.abs(Math.abs(side)-9)<.01&&Math.sign(side)===Math.sign(xa-h.x),{along,side,vy:A.PL.vy});
 A.RACE._haz=oldHaz;
}

// ── Ground dynamics (actual raceMotion → chuteMotion82) on the flat landing yard ──
const yardZ=Z0+(C.humps.at(-1)[0]+C.humps.at(-1)[1]+C.knots.find(k=>k[0]>C.humps.at(-1)[0])[0])/2;
function glide(ix,iz,t=4,dt=1/120,v0=40,d0=0){const q=Q(yardZ),x=xOf(d0,yardZ);
 Object.assign(A.PL,{x,z:yardZ,y:A.chuteSurf82(x,yardZ)+Y,vx:q.sn*v0,vz:q.cs*v0,vy:0,ground:true});
 Object.assign(A.RACE74,{slide:1,flight:0,pending:null,landAge:9,impact:0});Object.assign(A.RACE,{hitCd:0,slipT:0,fallT:0});
 let owned=true;for(let i=0;i<t/dt;i++)owned&&=A.raceMotion(dt,0,0,0,ix,iz);
 const qq=Q(yardZ);return {V:A.PL.vx*qq.sn+A.PL.vz*qq.cs,vd:A.PL.vx*qq.cs-A.PL.vz*qq.sn,owned};}
{const coast=glide(0,0),fwd=glide(0,1),brake=glide(0,-1),yardSlope=Math.abs(Q(yardZ).dy);
 check('On the flat yard the chute owns velocity: coast → 46, W → 58, S → 28',coast.owned&&yardSlope<1e-6&&Math.abs(coast.V-C.vC)<.3&&Math.abs(fwd.V-C.vW)<.4&&Math.abs(brake.V-C.vS)<.4,{coast:coast.V,fwd:fwd.V,brake:brake.V,yardSlope});
 const left=glide(-1,0,.25),right=glide(1,0,.25),diag=glide(-Math.SQRT1_2,Math.SQRT1_2,.25),leftW=glide(-1,1,.25);
 check('A/D steer sideways along the chute, and W+A (diagonal input) steers exactly as hard as A alone',left.vd>2&&right.vd<-2&&Math.abs(left.vd+right.vd)<1e-9&&Math.abs(diag.vd-left.vd)<1e-9,{left:left.vd,right:right.vd,diag:diag.vd});
 const edge=glide(0,0,.2,1/120,40,-9);check('The U wall pulls an idle rider back toward the middle',edge.vd>1,{vd:edge.vd});
}

// ── Crest hop, kicker and wall clamp (actual chuteAfter82) ──
function after(x0,z0,x,z,{y=null,vx=0,vz=50,vy=0,ground=true,slide=1,flight=0,kind=''}={}){
 Object.assign(A.PL,{x,z,y:y??A.chuteSurf82(x,z)+Y,vx,vz,vy,ground});
 Object.assign(A.RACE74,{prevX:x0,prevZ:z0,slide,flight,flightKind:kind,pending:null,kick82:false});A.chuteAfter82(1/60);return {...A.PL,kind:A.RACE74.flightKind,flight:A.RACE74.flight};}
{const hops=C.humps.map(([a,L])=>{const cz=Z0+a+L/2,r=after(0,cz-.8,0,cz+.1);return {z:cz,vy:r.vy,kind:r.kind,ground:r.ground};});
 check('Every hump crest pops a grounded rider into a short chute flight (2.2–4.2 up)',hops.every(h=>h.kind==='chute'&&!h.ground&&h.vy>=2.2&&h.vy<=4.2),hops);
 const lands=[];
 for(const [lift,d] of [[0,0],[0,-8],[0,8],[6,0],[14,3],[25,-2]]){const z=Z1-.3,x=xOf(d,z),y0=A.chuteSurf82(x,z)+Y+lift;
  const r=after(x,Z1-1.2,x,z,{y:y0,ground:!lift,slide:lift?0:1,flight:lift?.4:0,kind:lift?'chute':''});
  // Integrate the ballistic kicker flight with the race gravity used during a chute flight (scale 1).
  let px=r.x,py=r.y-Y,pz=r.z,vy=r.vy,t=0;const cp7=A.RACE_P.find(p=>p.cp===7);while((py>cp7.y+.075||vy>0)&&t<4){vy-=A.GRAV/240;py+=vy/240;px+=r.vx/240;pz+=r.vz/240;t+=1/240;}
  lands.push({lift,d,kind:r.kind,t:+t.toFixed(2),z:+pz.toFixed(2),x:+px.toFixed(2),onPad:Math.abs(pz-cp7.z)<cp7.d/2-2&&Math.abs(px-cp7.x)<cp7.w/2-2});}
 check('The kicker always lands on the next flag deck — from the chute, a wall or a high double jump',lands.every(q=>q.kind==='chute'&&q.onPad&&Math.abs(q.z-A.CH82_LAND)<3),lands);
 const lim=C.hw-A.PL.R-.03,zc=Z0+80,probes=[];
 for(const lift of [0,5,20,60])for(const s of [-1,1]){const x=xOf(s*(C.hw+.7),zc),q=Q(zc),y=q.y+Y+C.rim+lift;const r=after(x,zc-.5,x,zc,{y,vx:s*20*q.cs,vz:40,ground:!lift});
  probes.push({lift,s,d:+dOf(r.x,zc).toFixed(3),vd:+(r.vx*q.cs-r.vz*q.sn).toFixed(2)});}
 const under=after(xOf(C.hw+3,zc),zc-.5,xOf(C.hw+3,zc),zc,{y:Q(zc).y+Y-6});
 check('The wall holds a rider inside the U at any height (double jumps included), but never grabs a body falling beneath the deck',
  probes.every(p=>Math.abs(Math.abs(p.d)-lim)<1e-6&&p.vd*p.s<=0)&&Math.abs(dOf(under.x,zc)-(C.hw+3))<1e-6,{probes,lim});
}

// ── 84차 sharp curves: the wall does not hold — reaching the rim while still moving outward throws you off; moving inward is still clamped ──
{const zt=Z0+C.throws[0][0]+20,q=Q(zt),lim=C.hw-A.PL.R-.03,res=[];
 for(const s of [-1,1])for(const out of [1,-1]){Object.assign(A.RACE74,{thrown82:false,loop82:null});
  const x=xOf(s*(C.hw+.3),zt),y=q.y+Y+C.rim,vd=out*s*6;const r=after(x,zt-.5,x,zt,{y,vx:q.cs*vd+q.sn*45,vz:q.cs*45-q.sn*vd});
  res.push({s,out,thrown:!!A.RACE74.thrown82,kind:r.kind,ground:r.ground,d:+dOf(r.x,zt).toFixed(3),still:A.chuteContains82(r.x,zt,0)});}
 const thrownOK=res.filter(r=>r.out===1).every(r=>r.thrown&&r.kind==='thrown'&&!r.still&&!r.ground),clampOK=res.filter(r=>r.out===-1).every(r=>!r.thrown&&Math.abs(Math.abs(r.d)-lim)<1e-6);
 Object.assign(A.RACE74,{thrown82:false});
 const safeZ=Z0+80,qs=Q(safeZ),xs=xOf(C.hw+.3,safeZ),rs=after(xs,safeZ-.5,xs,safeZ,{y:qs.y+Y+C.rim,vx:qs.cs*6+qs.sn*45,vz:qs.cs*45-qs.sn*6});
 check('In the sharp-curve zone the rim throws an outward rider off the coaster (no re-landing below); inward riders and the other curves are still held',
  thrownOK&&clampOK&&!A.RACE74.thrown82&&Math.abs(dOf(rs.x,safeZ)-lim)<1e-6,{res});
 A.RACE74.thrown82=false;
}
// ── 84차 360° loop: crossing the rail start captures the rider; one turn around a vertical circle; release on the exit lane at entry speed ──
{const L=C.loop,za=Z0+L.z,zc=za-L.R-L.pre,q=Q(zc),x=xOf(-5,zc),V=60;Object.assign(A.RACE74,{thrown82:false,loop82:null,pending:null});A.RACE.cp={x:0,z:680,y:30};
 after(x,zc-.6,x,zc+.2,{vx:q.sn*V,vz:q.cs*V});const captured=!!A.RACE74.loop82,cp=A.RACE.cp;
 let maxY=-1e9,maxR=0,steps=0,topZ=null;const yc=Q(za).y+Y+A.chuteProf82(L.lane)+L.R;
 while(A.RACE74.loop82&&steps<2000){A.chuteLoop82(1/60);steps++;const ph=A.RACE74.loopPh;
  if(ph>0&&ph<2*Math.PI){maxR=Math.max(maxR,Math.abs(Math.hypot(A.PL.y-yc,A.PL.z-za)-L.R));if(A.PL.y>maxY){maxY=A.PL.y;topZ=A.PL.z;}}}
 const qe=Q(A.PL.z),dEnd=dOf(A.PL.x,A.PL.z),vEnd=A.PL.vx*qe.sn+A.PL.vz*qe.cs,t=steps/60;
 check('Crossing the rail start rides once around an 11-radius vertical loop (~2 s), then releases on the exit lane at entry speed and moves the respawn to the drop before the loop',
  captured&&maxR<1e-6&&Math.abs(maxY-(yc+L.R))<.05&&Math.abs(topZ-za)<.3&&Math.abs(dEnd+L.lane)<1e-6&&Math.abs(vEnd-V)<1e-6&&t>1.2&&t<2.6&&Math.abs(cp.z-(Z0+C.respawn))<1e-6,
  {captured,maxR,top:maxY-yc,topZ:topZ-za,dEnd,vEnd,t,cpZ:cp.z});
}
// ── 84차 boosters: on a booster even S keeps you fast (target vMax) ──
{const zb=Z0+(C.boosts[0][0]+C.boosts[0][1])/2,q=Q(zb),x=xOf(0,zb);Object.assign(A.PL,{x,z:zb,y:A.chuteSurf82(x,zb)+Y,vx:q.sn*40,vz:q.cs*40,vy:0,ground:true});A.RACE74.boost82=false;
 for(let i=0;i<30;i++)A.chuteMotion82(1/60,0,-1);const V=A.PL.vx*q.sn+A.PL.vz*q.cs;
 check('A booster pushes the rider toward top speed even while braking',V>52,{V});
}
// ── Rail-following flight: the horizontal velocity turns with the chute while airborne ──
{const z1=Z0+60,z2=z1+.8,q1=Q(z1),q2=Q(z2),V=50;
 Object.assign(A.PL,{x:q1.cx,z:z1,vx:q1.sn*V,vz:q1.cs*V});Object.assign(A.RACE74,{sn82:q1.sn,cs82:q1.cs});
 A.PL.z=z2;A.PL.x=q2.cx;A.chuteFlight82(1/60,0,0);
 const along=A.PL.vx*q2.sn+A.PL.vz*q2.cs,side=A.PL.vx*q2.cs-A.PL.vz*q2.sn,turn=Math.atan2(q2.sn,q2.cs)-Math.atan2(q1.sn,q1.cs);
 check('A flying rider keeps following the chute heading (no straight-line escape over a curve)',Math.abs(turn)>.004&&Math.abs(along-V)<.01&&Math.abs(side)<.01,{turn,along,side});
}

// ── Surface adherence on the curved descent (actual raceSlideAdhere78) ──
{const z=Z0+45,x=xOf(-3,z),gnd=A.chuteSurf82(x,z)+Y;
 const adhere=(o={})=>{A.setRacing(o.racing??true);Object.assign(A.PL,{x,z,y:gnd+(o.drop??.3),vx:o.vx??8,vz:o.vz??55,vy:o.vy??-.2,ground:o.ground??true});Object.assign(A.RACE74,{flight:o.flight??0,slide:o.mode??1});return A.raceSlideAdhere78(o.gnd??gnd,1/120);};
 const states=[{ground:false},{vy:2},{flight:.001},{mode:0},{racing:false},{gnd:-999},{drop:3}];
 check('Slope adherence follows the curved chute but never catches jumps, flights, missing decks or big drops',adhere()&&states.every(q=>!adhere(q)),{rejected:states.length});A.setRacing(true);
}
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/82-race-chute'));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify({results},null,2));
console.log(`${results.filter(q=>q.pass).length}/${results.length} roller-coaster checks passed.`);process.exitCode=results.every(q=>q.pass)?0:1;
