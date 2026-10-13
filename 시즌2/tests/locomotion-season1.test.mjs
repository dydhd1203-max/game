import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {advanceSeason1Motion,resetSeason1Motion,SEASON1_MOTION,MOTION_JUMP,MOTION_DOUBLE_JUMP,MOTION_LAND} from '../src/locomotion-season1.mjs';
import {createState,addPlayer,applyAction,setOnline,step,advancePlayerMovement} from '../src/sim.mjs';

// Execute the real Season 1 movement functions with a flat empty map. The
// reference is extracted at test time, not a second copy of the new module.
const source=fs.readFileSync(new URL('../../클로드/index.html',import.meta.url),'utf8');
const harness=fs.readFileSync(new URL('../../깃허브에올릴것/검사/t54-avatar-static.mjs',import.meta.url),'utf8');
const extraction=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const fixtures='));
const {declaration,fn}=new Function('source',extraction+'\nreturn {declaration,fn};')(source);
function original(phase='village') {
  const fixture=`
    const G={phase:'village'},KEY={},PLV={st:0};
    const PL={x:0,y:.08,z:0,vy:0,vx:0,vz:0,yaw:0,pitch:-.17,ground:true,R:.28,down:false,mv:false,landT:0};
    const LOBBY78={x:0,z:0,y:.08},camera={position:{set(){}},lookAt(){},updateMatrixWorld(){}},held={};
    const RACE={slipT:0},window={},POND={x:999,z:999,r:1},CPLAN={safe:{}};
    let mvx=0,mvz=0,wantJump=false,touchRun=false,stamina=1,sprinting=false,runDustT=0,gaitMe=0,camDip=0,camBodyHidden=false;
    const waiting78=()=>false,miniOn=()=>false,raceOn=()=>false,raceHold=()=>false,raceMotion=()=>false,raceTryJump=()=>false,raceGravityScale=()=>1;
    const spdMul=()=>1,jobTier=()=>0,onWallWalk=()=>false,doorFunnel=()=>0,solidHit=()=>false,covAt=()=>false,spiralSlide=()=>false;
    const groundUnder=()=>.08,ceilingOver=()=>Infinity,castleFloorUnder=()=>.08,raceSlideAdhere78=()=>false,streamDist=()=>999;
    const buildUnstick79=()=>{},galleryClamp=()=>{},spiralClamp=()=>{},sheepBump=()=>{},burst=()=>{},fovPunch=()=>{},castleSafeGo=()=>{},racePhysicsAfter=()=>{},camStepAdd=()=>{},sfx=()=>{};
    const gravNow=()=>GRAV_V,jumpNow=()=>JUMP_V,jump2Now=()=>JUMP2_V;
  `;
  // Stop immediately before camera/weapon/game-world side effects. This leaves
  // every original speed, jump, gravity, landing and gait statement untouched.
  const full=fn('updPlayer'),cut=full.indexOf('  if(PL.y < -20 && !raceOn())');
  assert.ok(cut>0);
  const pieces=[fixture,...['STEP','GRAV_V','SPRINT','ACC_UP','JOB_SPD','JOB_JMP','GLIDE_T','GLIDE_VY','RACE_SPD','STRIDE_WALK'].map(declaration),
    fn('sprintMul'),fn('sheepGaitStep'),full.slice(0,cut)+'}',fn('lobbyMove78'),
    `globalThis.reference={PL,run(input,dt){mvx=input.mx||0;mvz=-(input.mz||0);KEY.shift=!!input.sprint;wantJump=!!input.jump;
      ${phase==='lobby'?'lobbyMove78':'updPlayer'}(dt);
      return {x:PL.x,y:PL.y,z:PL.z,vx:PL.vx,vz:PL.vz,vy:PL.vy,ground:PL.ground,jumps:PL.jumps||0,
        stamina,run:sprinting,mv:PL.mv,take:PL.takeT>0?PL.takeT:0,land:PL.landT||0,
        flip:PL.flipT!==undefined&&PL.flipT<.6&&!PL.ground?PL.flipT/.6:0,gp:gaitMe,camDip};}};`];
  const context=vm.createContext({});new vm.Script(pieces.join('\n')).runInContext(context);
  return context.reference;
}
const actor=()=>resetSeason1Motion({id:'p0',x:0,z:0,yaw:0,hp:100,online:true});
function compare(p,reference,label){
  for(const [key,value] of Object.entries(reference)) {
    if(typeof value==='number')assert.ok(Math.abs(p[key]-value)<1e-10,`${label} ${key}: ${p[key]} / ${value}`);
    else assert.equal(p[key],value,label+' '+key);
  }
}

test('walk, stop, turn and sprint match executed Season 1 village physics frame by frame',()=>{
  const p=actor(),ref=original();
  for(let i=0;i<220;i++) {
    const input=i<30?{mz:-1}:i<60?{}:i<110?{mx:1,mz:1}:i<175?{mx:-1,sprint:true}:{mx:.3,mz:-.2};
    const dt=[1/120,1/60,1/30,.025][i%4];
    advanceSeason1Motion(p,input,dt);compare(p,ref.run(input,dt),'frame '+i);
  }
});

test('sprint exhaustion and recovery preserve the original three-second/four-second stamina rule',()=>{
  const p=actor(),ref=original();
  for(let i=0;i<480;i++) {
    const input={mz:1,sprint:i<245};advanceSeason1Motion(p,input,1/60);compare(p,ref.run(input,1/60),'frame '+i);
  }
  assert.ok(p.stamina>.97&&p.stamina<=1);assert.equal(p.run,false);
});

test('first jump, double-jump somersault and landing match real Season 1 state transitions',()=>{
  const p=actor(),ref=original();let flags=0,sawFlip=false,sawLanding=false;
  for(let i=0;i<130;i++) {
    const input={mz:-1,jump:[2,9,25].includes(i)};
    flags|=advanceSeason1Motion(p,input,1/60);compare(p,ref.run(input,1/60),'frame '+i);
    sawFlip ||= p.flip>0;sawLanding ||= p.land>0;
  }
  assert.equal(flags,MOTION_JUMP|MOTION_DOUBLE_JUMP|MOTION_LAND);
  assert.ok(sawFlip&&sawLanding);assert.equal(p.ground,true);assert.equal(p.y,.08);
});

test('lobby uses original easing and one jump without enabling village sprint/double jump',()=>{
  const p=actor(),ref=original('lobby');
  for(let i=0;i<95;i++) {
    const input={mx:i<30?1:i<65?-.5:0,sprint:true,jump:[2,9].includes(i)};
    advanceSeason1Motion(p,input,1/60,{phase:'lobby'});compare(p,ref.run(input,1/60),'frame '+i);
  }
  assert.equal(p.run,false);assert.equal(p.stamina,1);assert.equal(p.jumps,0);
});

test('held keys and repeated network jump sequences do not automatically double-jump',()=>{
  const p=actor();let first=0,second=0;
  for(let i=0;i<70;i++) {
    const event=advanceSeason1Motion(p,{jump:true,jumpSeq:1},1/60);
    if(event&MOTION_JUMP)first++;if(event&MOTION_DOUBLE_JUMP)second++;
  }
  assert.equal(first,1);assert.equal(second,0);assert.equal(p.ground,true);
  assert.equal(advanceSeason1Motion(p,{jump:false,jumpSeq:2},1/60),MOTION_JUMP,'short released tap still arrives by sequence');
  advanceSeason1Motion(p,{jumpSeq:2},1/60);
  assert.equal(advanceSeason1Motion(p,{jumpSeq:3},1/60),MOTION_DOUBLE_JUMP);
  assert.equal(advanceSeason1Motion(p,{jumpSeq:4},1/60),0,'third jump is unavailable');
});

test('local prediction and authoritative movement share collisions, velocity and jump state',()=>{
  const s=createState(),p=addPlayer(s,{id:'p0'});s.phase='village';p.x=0;p.z=0;
  const predicted=structuredClone(p);
  for(let i=0;i<150;i++) {
    const input={mz:-1,sprint:i<70,jumpSeq:i<20?0:i<27?1:2};
    advancePlayerMovement(s,predicted,1/60,input);step(s,1/60,{p0:input});
    assert.deepEqual(predicted,p);
  }
  assert.ok(p.z>=-9,'jump never bypasses the village gate');
});

test('carried modules preserve their existing movement penalty with the restored controls',()=>{
  const a=actor(),b=actor();
  for(let i=0;i<60;i++) {
    advanceSeason1Motion(a,{mx:1,sprint:true},1/60);
    advanceSeason1Motion(b,{mx:1,sprint:true},1/60,{carrying:true});
  }
  assert.ok(Math.abs(b.x-a.x*.8)<1e-10);assert.equal(b.stamina,a.stamina);
});

test('phase reset, disconnect and down states cannot preserve flying movement or spend combat actions',()=>{
  const s=createState(),p=addPlayer(s,{id:'p0'});s.phase='village';
  step(s,1/60,{p0:{jumpSeq:1,mz:-1,sprint:true}});assert.ok(p.air);
  setOnline(s,'p0',false);assert.equal(p.y,.08);assert.equal(p.vy,0);assert.equal(p.air,false);
  setOnline(s,'p0',true);applyAction(s,'p0',{type:'depart'},{teacher:true});
  assert.equal(p.y,.08);assert.equal(p.vx,0);assert.equal(p.gp,0);assert.equal(p._jumpSeq,1);
  p.hp=0;const before=structuredClone(p);
  assert.equal(advancePlayerMovement(s,p,1/60,{jumpSeq:2,mx:1}),0);assert.deepEqual(p,before);
});

test('legacy players initialize motion safely and nonfinite input cannot poison the new fields',()=>{
  const p={x:0,z:0,yaw:0};
  advanceSeason1Motion(p,{mx:NaN,mz:Infinity,yaw:NaN,jumpSeq:Infinity,sprint:1},1/60);
  assert.equal(p.y,SEASON1_MOTION.groundY);assert.equal(p.x,0);assert.equal(p.z,0);assert.equal(p.yaw,0);
  assert.equal(p.run,false);assert.equal(p.ground,true);
  const before=structuredClone(p);advanceSeason1Motion(p,{},NaN);assert.deepEqual(p,before);
});
