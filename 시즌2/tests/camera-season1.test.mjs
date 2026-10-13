import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {SEASON1_CAMERA,createSeason1Camera,season1Zoom,season1CameraClearance} from '../src/camera-season1.mjs';

const close=(a,b,note,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${note}: ${a} != ${b}`);
function camera(){return new THREE.PerspectiveCamera(54,1366/768,.15,190);}
function player(){return {x:0,y:.08,z:0,vx:0,vz:0,ground:true,moving:false,sprinting:false,gait:0};}

// Execute the ORIGINAL Season 1 normal-camera block, rather than maintaining
// a second handwritten copy of the equations as the expected answer.
function sourceRig(){
  const source=readFileSync(new URL('../../클로드/index.html',import.meta.url),'utf8');
  const start=source.indexOf('  const runK = (sprinting && PL.mv && PL.ground)');
  assert.ok(start>0,'original normal camera block still exists');
  const end=source.indexOf('  /* 72차 — 성벽 위 몸 내밀기 카메라',start);
  const fovStart=source.indexOf('function fovTick(dt){');
  const fovEnd=source.indexOf('window.__shake = shake;',fovStart);
  const context=vm.createContext({camera:camera()});
  vm.runInContext(`
    var PL={x:0,y:.08,z:0,EYE:1.12,vx:0,vz:0,ground:true,mv:false,down:false,pitch:-.22,yaw:0};
    var camAnc=null,camGY=null,camDistance=null,camShoulder=0,camBodyHidden=false,camAimBlend=0;
    var camAutoK=0,camStepY=0,camK=-1,camRamp=null,camLift=0,camHi=0,camHiT=0,camHold=0,camSlow=0;
    var camDip=0,gaitMe=0,sprinting=false,aimMode=false,throwing=false,gunT=0,aimKick=0,aimSway=0,aimRoll=0,heldCamRoll=0;
    var camZoom=3.2,DOWN_CAM=4.6,MINI_CAM=[6.4],RACE74={carryX:0,carryZ:0};
    var AIM_VIEW={back:2.9,height:1.58,shoulder:1.1,lift:.10,fov:68};
    var FOV0=70,fovRun=0,fovKick=0,fovRace74=0,windT=0,window={};
    var tpvKind=()=>camZoom>=1.6?1:-1,raceOn=()=>false,specCam=()=>false,camAutoTick=()=>{};
    var stairRampAt=()=>null,camStepTick=()=>{},plvTick=()=>{},raceFovTick=()=>0,el=()=>null;
    var cameraClearance=(x,y,z,ox,oy,oz)=>Math.hypot(ox,oy,oz);
    ${source.slice(fovStart,fovEnd)}
    function tick(dt){${source.slice(start,end)}fovTick(dt);}
  `,context);
  return context;
}

test('camera replays original Season 1 walk, jump, sprint, aim, first-person and teleport positions',()=>{
  const original=sourceRig(),actual=camera(),rig=createSeason1Camera(THREE,actual);
  const p=player(),view={yaw:0,pitch:-.22,zoom:3.2,aim:false};
  for(let frame=0;frame<260;frame++){
    const jumpFrame=frame%70,air=jumpFrame<31;
    Object.assign(p,{x:frame*.037+(frame>=220?25:0),z:-frame*.052,y:.08+(air?Math.max(0,10.02*jumpFrame/60-36.9*(jumpFrame/60)**2/2):0),
      ground:!air,sprinting:frame>=20&&frame<80,moving:frame<200,gait:frame*.2,camDip:frame===31?.18:0,down:frame>=245});
    Object.assign(view,{yaw:frame*.006,pitch:-.22,aim:frame>=45&&frame<105,zoom:frame>=160&&frame<180?0:frame>=200?12.5:3.2});
    Object.assign(original.PL,{...p,yaw:view.yaw,pitch:view.pitch,mv:p.moving});
    original.sprinting=p.sprinting;original.gaitMe=p.gait;original.camDip=p.camDip;
    original.aimMode=view.aim;original.camZoom=view.zoom;
    original.tick(1/60);const state=rig.update(p,1/60,view);
    for(const axis of ['x','y','z'])close(actual.position[axis],original.camera.position[axis],`frame ${frame} position.${axis}`);
    for(const axis of ['x','y','z','w'])close(actual.quaternion[axis],original.camera.quaternion[axis],`frame ${frame} quaternion.${axis}`);
    close(actual.fov,original.camera.fov,`frame ${frame} FOV`);
    close(state.shoulder,original.camShoulder,`frame ${frame} shoulder`);
    close(state.aimBlend,original.camAimBlend,`frame ${frame} aim blend`);
    assert.equal(state.bodyHidden,state.firstPerson||original.camBodyHidden);
  }
});

test('wheel traverses the original discrete third-person/first-person boundary and limits',()=>{
  let zoom=SEASON1_CAMERA.zoom;
  zoom=season1Zoom(zoom,-120);close(zoom,2,'one notch in');
  zoom=season1Zoom(zoom,-120);assert.equal(zoom,0);
  zoom=season1Zoom(zoom,120);assert.equal(zoom,1.6);
  zoom=season1Zoom(zoom,120);close(zoom,2.8,'one notch out');
  for(let i=0;i<20;i++)zoom=season1Zoom(zoom,120);
  assert.equal(zoom,12.5);
  for(let i=0;i<20;i++)zoom=season1Zoom(zoom,-120);
  assert.equal(zoom,0);assert.equal(season1Zoom(3.2,NaN),3.2);
});

test('swept camera stops before solid sides and ground, passes above low props, and skips thin scenery',()=>{
  const wall={x:0,z:2,r:.3,top:5};
  const clearance=season1CameraClearance(0,1,0,0,0,3.2,[wall]);
  assert.ok(clearance<2-wall.r-.14&&clearance>1.3,'the camera volume stays in front of a thin wall');
  assert.equal(season1CameraClearance(0,2,0,0,0,3.2,[{...wall,top:.5}]),3.2,'clear line above a low object');
  assert.equal(season1CameraClearance(0,1,0,0,0,3.2,[{...wall,camera:false}]),3.2,'thin scenery follows Season 1 exemption');
  const downward=season1CameraClearance(0,1,0,0,-2,2,[]);
  const length=Math.hypot(2,2),endY=1-2*downward/length;
  assert.ok(endY>.08+.14,'floor includes camera volume and safe distance');
  const shoulderWall={x:.8,z:1.6,r:.25,top:5};
  assert.ok(season1CameraClearance(0,1,0,1.6,0,3.2,[shoulderWall])<2,'the actual shoulder ray also hits');
  assert.equal(season1CameraClearance(0,1,0,0,0,3.2,[shoulderWall]),3.2,'center ray would have incorrectly missed it');
});

test('collision pulls in immediately, restores smoothly and uses body visibility hysteresis',()=>{
  const obstacle={x:0,z:1,r:.5,top:10},actual=camera(),rig=createSeason1Camera(THREE,actual,{obstacles:[obstacle]});
  const p=player(),view={yaw:0,pitch:0,zoom:3.2};
  let state=rig.update(p,1/60,view);
  assert.ok(state.distance<.52);assert.equal(state.bodyHidden,true);
  obstacle.z=1.6;
  for(let i=0;i<80;i++)state=rig.update(p,1/60,view);
  assert.ok(state.distance>.52&&state.distance<.9);assert.equal(state.bodyHidden,true,'body does not flicker back at the hide boundary');
  obstacle.camera=false;const shortened=state.distance;
  state=rig.update(p,1/60,view);
  assert.ok(state.distance>shortened&&state.distance<3.2,'obstacle removal does not snap camera out');
  for(let i=0;i<80;i++)state=rig.update(p,1/60,view);
  assert.equal(state.bodyHidden,false);assert.ok(state.distance>3.19);
  obstacle.camera=true;obstacle.z=1;
  state=rig.update(p,1/60,view);
  assert.ok(state.distance<.52,'reappearing obstruction shortens on the first frame');assert.equal(state.bodyHidden,true);
});

test('jump follows within the original .22m vertical lag and a teleport snaps without horizontal lag',()=>{
  const actual=camera(),rig=createSeason1Camera(THREE,actual),p=player();
  rig.update(p,1/60);
  p.y=2;let state=rig.update(p,1/60);
  close(state.footAnchor,1.78,'jump lag capped');
  p.x=60;p.z=-100;p.y=10;state=rig.update(p,1/60);
  close(actual.position.x,60,'horizontal teleport anchor');close(state.footAnchor,10,'vertical teleport anchor');
});

test('lobby uses original fixed 4.4m look-at rig and ignores game zoom until leaving',()=>{
  const actual=camera(),rig=createSeason1Camera(THREE,actual),p=player(),yaw=.4,pitch=-.17;
  Object.assign(p,{x:2,z:24,y:1});
  let state=rig.update(p,1/60,{phase:'lobby',yaw,pitch,zoom:0,aim:true});
  close(actual.position.x,p.x+Math.sin(yaw)*4.4,'lobby horizontal X');
  close(actual.position.z,p.z+Math.cos(yaw)*4.4,'lobby horizontal Z');
  close(actual.position.y,p.y+1.6-Math.sin(pitch)*4.4,'lobby height');
  assert.equal(state.firstPerson,false);assert.equal(state.bodyHidden,false);assert.equal(actual.fov,70);
  const direction=actual.getWorldDirection(new THREE.Vector3()),target=new THREE.Vector3(p.x,p.y+1.05,p.z).sub(actual.position).normalize();
  assert.ok(direction.distanceTo(target)<1e-12,'look-at uses Season 1 lobby target');
  state=rig.update(p,1/60,{phase:'village',yaw,pitch,zoom:0});
  assert.equal(state.firstPerson,true);assert.equal(state.bodyHidden,true);
  close(actual.position.y,p.y+1.12,'first-person eye height');
});

test('Season 2 zero HP selects the original downed camera without a separate down flag',()=>{
  const a=camera(),b=camera(),rigA=createSeason1Camera(THREE,a),rigB=createSeason1Camera(THREE,b);
  const p=player(),q=player();p.hp=0;q.down=true;
  for(let i=0;i<60;i++){
    const sa=rigA.update(p,1/60,{zoom:3.2,aim:true}),sb=rigB.update(q,1/60,{zoom:3.2,aim:true});
    assert.deepEqual(sa,sb);assert.ok(a.position.distanceTo(b.position)<1e-12);
  }
  close(rigA.state().distance,4.6,'downed camera distance');
});
