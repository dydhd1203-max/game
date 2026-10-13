// Flat-ground controls ported from Season 1 build 106 (not its race mode):
// 클로드/index.html, SHA-256 91c2c21654161390e37d84b70c96d5736f56f07de0add7fea950a0ab15d1173f.
// Sources: SPD/SPRINT/ACC_UP, sprintMul, updPlayer, lobbyMove78 and sheepGaitStep.
// Season 2 keeps its own map collisions and combat damage; jumping does not
// bypass a building footprint or make a player immune to the existing attacks.
export const SEASON1_MOTION = Object.freeze({speed:5.94, acceleration:40, deceleration:40,
  lobbyAcceleration:12, sprintMultiplier:1.45, sprintSeconds:3, restSeconds:4,
  gravity:36.9, jump:10.02, doubleJump:12.53, takeSeconds:.12, landSeconds:.22,
  flipSeconds:.6, groundY:.08, strideWalk:3.4, strideRun:4.8});
export const MOTION_JUMP=1, MOTION_DOUBLE_JUMP=2, MOTION_LAND=4;
const C=SEASON1_MOTION;
const finite=Number.isFinite;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const defaults={y:C.groundY,vx:0,vz:0,vy:0,ground:true,jumps:0,stamina:1,
  run:false,mv:false,air:false,aim:false,takeT:0,landT:0,flipT:99,
  take:0,land:0,flip:0,gp:0,camDip:0,_jumpHeld:false,_jumpSeq:0};

// Old local saves lack the new motion fields. Initialize only missing fields;
// current snapshots keep their velocity, airborne state and jump sequence.
export function ensureSeason1Motion(p) {
  for(const key in defaults) {
    const value=defaults[key];
    if(typeof value==='number'?!finite(p[key]):typeof p[key]!=='boolean')p[key]=value;
  }
  p.stamina=clamp(p.stamina,0,1);
  return p;
}

export function resetSeason1Motion(p) {
  const sequence=Number.isSafeInteger(p._jumpSeq)?p._jumpSeq:0;
  Object.assign(p,defaults,{_jumpSeq:sequence});
  delete p._motionX;delete p._motionZ;
  return p;
}

export function stopSeason1Motion(p) {
  ensureSeason1Motion(p);
  p.vx=p.vz=p.vy=0;p.y=C.groundY;p.ground=true;p.jumps=0;
  p.run=p.mv=p.air=p.aim=false;p.takeT=p.landT=p.take=p.land=p.flip=p.camDip=0;p.flipT=99;
  p._motionX=p.x;p._motionZ=p.z;
}

function jumpPressed(p,input) {
  // A monotonic sequence survives a tap shorter than the network send period.
  // Retransmitting/holding a packet can never spend a second jump by itself.
  let pressed=false;
  if(Number.isSafeInteger(input.jumpSeq)&&input.jumpSeq>=0) {
    if(input.jumpSeq>p._jumpSeq){p._jumpSeq=input.jumpSeq;pressed=true;}
  } else pressed=input.jump===true&&!p._jumpHeld;
  p._jumpHeld=input.jump===true;
  return pressed;
}

export function advanceSeason1Motion(p,input,dt,{phase='village',carrying=false,move}={}) {
  if(!finite(dt)||dt<=0)return 0;
  ensureSeason1Motion(p);
  input=input&&typeof input==='object'?input:{};
  let mx=finite(input.mx)?clamp(input.mx,-1,1):0,mz=finite(input.mz)?clamp(input.mz,-1,1):0;
  const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;}
  const lobby=phase==='lobby',moving=len>.06;
  const pressed=jumpPressed(p,input);
  if(finite(input.yaw))p.yaw=((input.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  p.mv=moving;p.aim=input.aim===true;

  if(!lobby) {
    const want=input.sprint===true&&moving&&p.stamina>0;
    if(want){p.stamina=Math.max(0,p.stamina-dt/C.sprintSeconds);p.run=p.stamina>0;}
    else {p.stamina=Math.min(1,p.stamina+dt/C.restSeconds);p.run=false;}
  } else p.run=false;
  const speed=C.speed*(p.run?C.sprintMultiplier:1)*(carrying?.8:1);
  if(finite(p._motionX)&&Math.hypot(p.x-p._motionX,p.z-p._motionZ)>1.5)p.vx=p.vz=0;
  const ak=lobby?1-Math.exp(-dt*C.lobbyAcceleration):Math.min(1,dt*(moving?C.acceleration:C.deceleration));
  p.vx+=(mx*speed-p.vx)*ak;p.vz+=(mz*speed-p.vz)*ak;
  const oldX=p.x,oldZ=p.z;
  if(move)move(p,p.vx*dt,p.vz*dt);
  else {p.x+=p.vx*dt;p.z+=p.vz*dt;}

  let events=0;
  if(!lobby&&p.landT>0)p.landT-=dt;
  const canJump=p.ground||(!lobby&&(p.jumps|0)<1&&p.vy<C.jump*.92);
  if(pressed&&canJump) {
    const second=!p.ground;
    if(second){p.jumps=(p.jumps|0)+1;p.flipT=0;events|=MOTION_DOUBLE_JUMP;}
    else {if(!lobby)p.takeT=C.takeSeconds;events|=MOTION_JUMP;}
    p.vy=second?C.doubleJump:C.jump;p.ground=false;
  }
  p.vy-=C.gravity*dt;p.y+=p.vy*dt;
  if(!lobby) {
    if(!p.ground&&p.flipT<9)p.flipT+=dt;
    if(p.takeT>0)p.takeT-=dt;
    if(p.camDip>0){p.camDip*=Math.exp(-dt*9);if(p.camDip<.004)p.camDip=0;}
  }
  if(p.y<=C.groundY) {
    if(!p.ground) {
      events|=MOTION_LAND;
      if(!lobby){p.landT=C.landSeconds;p.flipT=99;p.camDip=p.vy<-9?.18:.08;}
    }
    p.y=C.groundY;p.vy=0;p.ground=true;p.jumps=0;
  } else p.ground=false;
  p.air=!p.ground;p.take=p.takeT>0?p.takeT:0;p.land=p.landT;
  p.flip=p.flipT<C.flipSeconds&&!p.ground?p.flipT/C.flipSeconds:0;
  const travel=lobby?Math.hypot(p.x-oldX,p.z-oldZ):finite(p._motionX)?Math.hypot(p.x-p._motionX,p.z-p._motionZ):0;
  if(lobby||(travel>.001&&travel<1.5&&p.ground)) {
    p.gp+=Math.min(Math.max(0,travel)/(p.run?C.strideRun:C.strideWalk),Math.max(0,dt)*(p.run?2:1.6))*Math.PI*2;
  }
  p._motionX=p.x;p._motionZ=p.z;
  return events;
}
