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
 ${['CH82','CH82_Z1','CH82T','CH82Q','CH82LP','CANDY87','raceDonutSide87','chuteThrowZ82','RACE_RAINBOW76','chuteSq82','chuteRise82','chuteZone82','RACE_X','RACE_S','RACE_Z_FIN','RACE_ROWZ','RACE_P','RACE','RACE74','RACE_LAUNCH_RATE','ROCK','STEP','GRAV','RACE_TOY77'].map(decl).join('\n')}
 ${['mulberry','race74Reset','raceBuild','raceOff','raceZOff','racePose','racePadLocal88','racePadWorld88','raceCarry88','raceContains','raceSurface','raceUnder','rockU','raceRocks','raceDonutLayout87','raceHazards','raceSphereHit','racePunchHit','raceToyForm77','raceToyHit77','raceBarHit','raceSlideAdhere78','raceSlideHit78','raceHazardTick','raceGravityScale','raceMotion',
   'chute82','chuteQ82','chuteProf82','chuteProfSlope82','chuteContains82','chuteSurf82','chuteGrad82','chuteMotion82','chuteFlight82','chuteLaunch82','chuteAfter82','chuteCandyProf87','chuteCandyFrame87','chuteCandySpan87','chuteCandyFar87','chuteCandyAt87','chuteCandyHit87','chuteCandyPush87','chuteBump87','chuteCandySolid87','chuteThrow82','chuteLoopD87','chuteLoopAt82','chuteLoopStart82','chuteLoop82'].map(fn).join('\n')}
 globalThis.A={PL,G,RACE,RACE_P,RACE74,STEP,GRAV,CANDY87,chuteCandyProf87,chuteCandyHit87,chuteCandySolid87,raceGravityScale,race74Reset,CH82,CH82_Z1,CH82_SHIFT,CH82_LAND,chute82,chuteQ82,chuteProf82,chuteProfSlope82,chuteContains82,chuteSurf82,chuteAfter82,chuteFlight82,chuteMotion82,chuteThrowZ82,chuteLoop82,raceBuild,raceContains,raceSurface,raceUnder,raceHazards,raceSlideAdhere78,raceSlideHit78,raceHazardTick,raceMotion,setRacing:q=>racing=q};`,ctx);
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

// ── 87차 candy rows: giant wrapped candies (candy87) lying on the chute floor ──
// Rest check uses the game's own frame (chuteCandyFrame87) and outline (chuteCandyProf87 + CANDY87 wing sizes) against the actual floor (chuteSurf82):
// the body must touch the floor without sinking in (teacher: "길에 파묻혀 있으면 안 되지") and the wings must stay above it.
const K=A.CANDY87,hazards=A.raceHazards(3).filter(h=>h.candy87).map(h=>({...h}));
const toW=(h,lx,ly,lz)=>[h.x+h.bx[0]*lx+h.by[0]*ly+h.bz[0]*lz,h.y+h.bx[1]*lx+h.by[1]*ly+h.bz[1]*lz,h.z+h.bx[2]*lx+h.by[2]*ly+h.bz[2]*lz];
{const expected=C.bumpRows.reduce((n,r)=>n+r[1].length,0);let bodyMin=Infinity,bodyMax=-Infinity,wingMin=Infinity,tallMin=Infinity;
 for(const h of hazards){const hh=h.h/2;let low=Infinity;
  for(let i=0;i<=40;i++)for(let j=0;j<72;j++){const u=-1+i/40*1.2,r=A.chuteCandyProf87(u),a=j/72*2*Math.PI,p=toW(h,Math.cos(a)*r*K.ax*h.r,u*hh,Math.sin(a)*r*h.r),gap=p[1]-A.chuteSurf82(p[0],p[2]);
   low=Math.min(low,gap);}
  bodyMin=Math.min(bodyMin,low);bodyMax=Math.max(bodyMax,low);
  for(const sd of [-1,1])for(let t=0;t<=1.0001;t+=.05)for(let j=0;j<36;j++){const a=j/36*2*Math.PI,p=toW(h,sd*(K.fan0+t*K.fanL)*h.r,(K.fanY+K.lift(t)+Math.sin(a)*K.fanW(t)*1.08)*hh,0);
   wingMin=Math.min(wingMin,p[1]-A.chuteSurf82(p[0],p[2]));}
  const top=toW(h,0,hh,0);tallMin=Math.min(tallMin,top[1]-A.chuteSurf82(top[0],top[2]));}
 check('16 wrapped candies in nine rows rest on the chute floor: the body touches it without sinking in, the wings stay above it, and each stands taller than one jump',
  expected===16&&hazards.length===expected&&C.bumpRows.length===9&&bodyMin>-.005&&bodyMax<.1&&wingMin>0&&tallMin>4.6,{count:hazards.length,bodyMin,bodyMax,wingMin,tallMin});
}

// ── Swept candy contact against a dense oracle: the same outline sampled 26× finer along the body and ~12× finer along the step ──
// The oracle shrinks/grows the rider (and the wing top) by 0.03: a clear overlap must hit, a clear miss must not.
const prof=u=>Math.pow(Math.max(0,1-Math.pow(Math.min(1,Math.abs(u)),K.p)),1/K.p);
function inside(h,x,y,z,grow){const R=h.r,hh=h.h/2,PR=A.PL.R+grow,dx=x-h.x,dz=z-h.z;
 for(let k=0;k<=25;k++){const dy=y+.05+1.25*k/25-h.y,lx=dx*h.bx[0]+dy*h.bx[1]+dz*h.bx[2],ly=dx*h.by[0]+dy*h.by[1]+dz*h.by[2],lz=dx*h.bz[0]+dy*h.bz[1]+dz*h.bz[2],u=ly/hh;
  if(Math.abs(u)<1){const pr=prof(u),a=K.ax*R*pr+PR,b=R*pr+PR;if((lx/a)**2+(lz/b)**2<1)return true;}
  const ex=Math.abs(lx)/R;if(ex>K.neck0&&ex<K.reach+PR/R){const neck=ex<K.fan0,t=Math.max(0,Math.min(1,(ex-K.fan0)/K.fanL));
   const th=R*(neck?K.neckR*1.2:K.fanT(t)*1.6)+PR,top=hh*(K.fanY+(neck?K.neckR*1.2:K.lift(t)+K.fanW(t)*1.08))+grow;if(Math.abs(lz)<th&&ly<top&&ly>-hh-1.5-grow)return true;}}
 return false;}
const pathHits=(p0,p1,h,grow)=>{for(let i=0;i<=200;i++){const u=i/200;if(inside(h,p0.x+(p1.x-p0.x)*u,p0.y+(p1.y-p0.y)*u,p0.z+(p1.z-p0.z)*u,grow))return true;}return false;};
function sample(p0,p1,h,dt=1/60,stale=false){
 A.RACE.t=3;Object.assign(A.PL,{...p1,y:Y+p1.y});Object.assign(A.RACE74,{prevX:p0.x,prevY:Y+p0.y,prevZ:p0.z,prevTime:stale?-999:3-dt});
 return A.chuteCandyHit87(h,dt);
}
{let seed=8227;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let misses=0,falseHits=0,deep=0,clear=0;
 for(let i=0;i<1800;i++){
  const dt=[1/30,1/60,1/120][i%3],h=hazards[i%hazards.length],angle=(rand()-.5)*1.4,speed=16+rand()*54,reach=K.reach*h.r;
  const p0={x:h.x+(rand()-.5)*2*(reach+2),y:h.y-h.h/2-1.5+rand()*6,z:h.z+(rand()-.5)*2*(reach+2)};
  const p1={x:p0.x+Math.sin(angle)*speed*dt,y:p0.y+(rand()-.5)*60*dt,z:p0.z+Math.cos(angle)*speed*dt};
  const hit=sample(p0,p1,h,dt),inDeep=pathHits(p0,p1,h,-.03),inWide=pathHits(p0,p1,h,.03);
  if(inDeep){deep++;if(!hit){misses++;if(process.env.T82DBG)console.log('MISS',JSON.stringify({id:h.id,dt,p0,p1,hc:{x:h.x,y:h.y,z:h.z}}));}}
  if(!inWide){clear++;if(hit)falseHits++;}
 }
 check('Swept candy contact (body + wing plates) matches a dense oracle at 16–70 speed and 30/60/120 Hz',misses===0&&falseHits===0&&deep>300&&clear>300,{cases:1800,deep,clear,misses,falseHits});
}

// ── Contact response: pushed out of the candy, then bounced sideways toward the row's open lane (no pass-through, no pocket ping-pong) ──
{const res=[];
 for(const h of hazards.filter(h=>h.lanes.length===1||Math.abs(h.d)<1)){const zc=h.z,q=Q(zc),x0=h.x-q.sn*6,z0=zc-q.cs*6,V=50;
  const oldHaz=A.RACE._haz;A.RACE._haz=[h];Object.assign(A.RACE,{hitCd:0,slipT:0,t:3});A.RACE74.pulse=new Map();
  const y=A.chuteSurf82(h.x,zc)+.02;sample({x:x0,y,z:z0},{x:h.x,y,z:zc},h,6/V);Object.assign(A.PL,{vx:q.sn*V,vz:q.cs*V,vy:0,ground:true});A.raceHazardTick(6/V);
  const qq=Q(A.PL.z),along=A.PL.vx*qq.sn+A.PL.vz*qq.cs,side=A.PL.vx*qq.cs-A.PL.vz*qq.sn,d=dOf(A.PL.x,A.PL.z);
  let best=Infinity;for(const [lo,hi] of h.lanes){const t=Math.max(lo+1,Math.min(hi-1,d));if(Math.abs(t-d)<Math.abs(best-d))best=t;}
  res.push({id:h.id,out:!inside(h,A.PL.x,A.PL.y-Y,A.PL.z,-.005),along:+along.toFixed(3),side:+side.toFixed(2),toLane:Math.sign(side)===Math.sign(best-d)||Math.abs(best-d)<.3,
   vy:A.PL.vy,cd:A.RACE.hitCd,kind:A.RACE74.flightKind,ground:A.PL.ground});A.RACE._haz=oldHaz;}
 check('A candy hit puts you outside the candy and bounces you sideways (≥12) toward the open lane with a 4.5 hop and no forward push',
  res.length>=6&&res.every(r=>r.out&&Math.abs(r.along)<1e-6&&Math.abs(r.side)>=12-1e-9&&r.toLane&&Math.abs(r.vy-4.5)<1e-9&&r.cd>.79&&r.kind==='chute'&&!r.ground),res);
}

// ── No pass-through: riding straight at every candy (body middle and both wing tips) with the actual chute motion, hit, push-out and solid steps ──
// A minimal integrator stands in for updPlayer (position, gravity, landing on the chute floor). Every frame end must be outside the candy
// (0.05 deeper than the collider) and the rider may never get from the front of the candy to its back (local z sign flip) while still
// inside its width (body + wings, minus 0.3) — going round a wing tip or over nothing is the only way past.
{let frames=0,insideEnd=0,through=0;const runs=[];
 const loc=(h,p)=>{const dx=p.x-h.x,dy=p.y+.6-h.y,dz=p.z-h.z;return [h.bx,h.by,h.bz].map(V=>dx*V[0]+dy*V[1]+dz*V[2]);};
 for(const fps of [30,60,120])for(const h of hazards)for(const aim of [0,-1,1]){const dt=1/fps,X=h.bx,reach=K.reach*h.r-.4,span=K.reach*h.r+A.PL.R-.3;
  const tx=h.x+X[0]*reach*aim,tz=h.z+X[2]*reach*aim,q=Q(tz),z0=tz-14*q.cs,x0=tx-14*q.sn,y0=A.chuteSurf82(x0,z0)+Y;
  Object.assign(A.PL,{x:x0,z:z0,y:y0,vx:q.sn*50,vz:q.cs*50,vy:0,ground:true});A.race74Reset();A.RACE74.pulse=new Map();
  Object.assign(A.RACE,{t:3,hitCd:0,slipT:0,fallT:0,_haz:[h]});A.RACE74.slide=1;
  let prev={x:A.PL.x,y:A.PL.y-Y,z:A.PL.z},hit=false;
  for(let f=0;f<fps*1.6;f++){A.raceMotion(dt,0,0,0,0,0);
   A.PL.x+=A.PL.vx*dt;A.PL.z+=A.PL.vz*dt;if(!A.PL.ground){A.PL.vy-=A.GRAV*A.raceGravityScale()*dt;A.PL.y+=A.PL.vy*dt;}
   const g=A.chuteSurf82(A.PL.x,A.PL.z)+Y;if(A.PL.y<=g||A.PL.ground&&A.PL.vy<=0){if(!A.PL.ground)A.RACE74.flight=0;A.PL.y=g;A.PL.vy=0;A.PL.ground=true;}
   A.chuteAfter82(dt);A.raceHazardTick(dt);A.chuteCandySolid87();hit||=A.RACE.hitCd>0;
   const cur={x:A.PL.x,y:A.PL.y-Y,z:A.PL.z};frames++;
   if(inside(h,cur.x,cur.y,cur.z,-.05))insideEnd++;
   const a=loc(h,prev),b=loc(h,cur);
   if(Math.sign(a[2])!==Math.sign(b[2])&&Math.abs(a[0])<span&&Math.abs(b[0])<span&&Math.max(a[1],b[1])<h.h/2&&Math.min(a[1],b[1])>-h.h/2-1.5){through++;if(process.env.T82DBG)console.log('THROUGH',h.id,aim,fps,f,a.map(v=>+v.toFixed(2)),b.map(v=>+v.toFixed(2)));}
   prev=cur;}
  runs.push({id:h.id,aim,fps,hit});}
 A.RACE._haz=null;
 check('Riding straight at any candy (middle or wing tip, 30/60/120 Hz) bounces off: never inside a candy, never from its front to its back through it',
  insideEnd===0&&through===0&&runs.filter(r=>r.aim===0).every(r=>r.hit),{frames,insideEnd,through,runs:runs.length,hits:runs.filter(r=>r.hit).length,missedMiddle:runs.filter(r=>r.aim===0&&!r.hit).map(r=>r.id+'@'+r.fps)});
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
