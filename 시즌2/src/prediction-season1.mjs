import {advancePlayerMovement} from './sim.mjs';

// A guest predicts only its own Season 1 movement. Combat, rewards, tower work
// and events stay on the host. Neither the received state nor its players are
// mutated, and visual reconciliation never feeds back into collision physics.
const VERTICAL=['y','vy','ground','air','jumps','takeT','landT','flipT','take','land','flip','camDip'];
const finite=Number.isFinite;
const seq=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const alive=p=>p.hp>0&&p.online!==false&&!p.down;
const FIXED_STEP=1/60;
export function createSeason1Prediction(){
  const physical={},displayed={};
  let currentId=null,lastState=null,lastTime=-Infinity,lastTick,phase,wasAlive,wasPaused;
  let lastX=0,lastY=0,lastZ=0,offsetX=0,offsetY=0,offsetZ=0,initialized=false,accumulator=0;
  function reset(){currentId=null;lastState=null;lastTime=-Infinity;initialized=false;offsetX=offsetY=offsetZ=0;accumulator=0;}
  function sample(state,localId,dt,input={}){
    const source=state?.players?.[localId];
    if(!source){reset();return null;}
    const time=finite(state.time)?state.time:0;
    const isAlive=alive(source),paused=!!state.paused||state.phase==='victory'||state.phase==='defeat';
    const fresh=state!==lastState||time!==lastTime||state.tick!==lastTick;
    const hardReset=!initialized||localId!==currentId||phase!==state.phase||wasAlive!==isAlive||wasPaused!==paused||time<lastTime||
      (fresh&&(Math.hypot(source.x-lastX,source.z-lastZ)>3||Math.abs((source.y??.08)-lastY)>3));
    if(hardReset){
      for(const key in physical)if(!Object.hasOwn(source,key))delete physical[key];
      for(const key in displayed)if(!Object.hasOwn(source,key))delete displayed[key];
      Object.assign(physical,source);offsetX=offsetY=offsetZ=0;accumulator=0;initialized=true;
    }else if(fresh){
      // A packet sent before the host receives our jump must not put us back on
      // the floor or consume the same press a second time. Keep vertical motion
      // until that input sequence is acknowledged; then accept host physics.
      const consumed=seq(physical._jumpSeq),pending=consumed>seq(source._jumpSeq);
      const saved=pending?VERTICAL.map(key=>physical[key]):null;
      const gp=physical.gp,jumpHeld=physical._jumpHeld;
      Object.assign(physical,source);
      if(saved)for(let i=0;i<VERTICAL.length;i++)physical[VERTICAL[i]]=saved[i];
      // Keep the locally consumed sequence even after landing while a slow
      // packet is in flight. Repeated input packets cannot trigger another hop.
      physical._jumpSeq=Math.max(consumed,seq(source._jumpSeq));physical._jumpHeld=jumpHeld;
      // Gait is a local display phase in Season 1 and should not rewind 10 times
      // a second. Reconciliation itself does not count as travelled distance.
      if(finite(gp))physical.gp=gp;
      physical._motionX=physical.x;physical._motionZ=physical.z;
      offsetX=(displayed.x??physical.x)-physical.x;offsetY=(displayed.y??physical.y)-physical.y;offsetZ=(displayed.z??physical.z)-physical.z;
    }
    currentId=localId;lastState=state;lastTime=time;lastTick=state.tick;phase=state.phase;wasAlive=isAlive;wasPaused=paused;
    lastX=source.x;lastY=source.y??.08;lastZ=source.z;
    const step=finite(dt)?Math.max(0,Math.min(dt,.1)):0;
    if(isAlive&&!paused){
      // The host advances at 60 Hz. Matching its integration step keeps jump
      // height and acceleration identical on 15/20/30 Hz renderers as well.
      // Carry fractional elapsed time instead of dropping it on fast frames.
      accumulator+=step;
      while(accumulator+1e-10>=FIXED_STEP){advancePlayerMovement(state,physical,FIXED_STEP,input);accumulator=Math.max(0,accumulator-FIXED_STEP);}
    }else accumulator=0;
    const decay=Math.exp(-step/.15);offsetX*=decay;offsetY*=decay;offsetZ*=decay;
    if(Math.abs(offsetX)<1e-5)offsetX=0;if(Math.abs(offsetY)<1e-5)offsetY=0;if(Math.abs(offsetZ)<1e-5)offsetZ=0;
    Object.assign(displayed,physical);displayed.x+=offsetX;displayed.y=(physical.y??.08)+offsetY;displayed.z+=offsetZ;
    return displayed;
  }
  return {sample,reset};
}
