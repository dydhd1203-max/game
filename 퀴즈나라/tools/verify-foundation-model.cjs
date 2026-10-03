'use strict';
const assert=require('node:assert/strict'),{solve,spec}=require('../avatar-foundation.js'),run=require('../avatar-run-input.js');
let samples=0;
for(const direction of ['front','back','left','right'])for(const action of ['idle','walk','run','jump','floor-sit','sit'])for(let frame=0;frame<120;frame++){
  const pose=solve({direction,action,phase:frame/120,grounded:false,time:0});
  for(const leg of pose.legs){const[a,b,c]=leg.boneSpace;assert(Math.abs(Math.hypot(...b.map((x,i)=>x-a[i]))-3.2)<.002,JSON.stringify({direction,action,frame,leg}));assert(Math.abs(Math.hypot(...c.map((x,i)=>x-b[i]))-2.9)<.002);if(leg.contact&&!pose.desk)assert(Math.abs(leg.ankle[1]-spec.ankle)<.001);}
  for(const [i,arm] of pose.arms.entries()){for(const point of [arm.shoulder,arm.elbow,arm.wrist])assert(point.every(Number.isFinite));const [a,b,c]=arm.boneSpace;const length=(p,q)=>Math.hypot(...p.map((x,i)=>x-q[i]));assert(Math.abs(length(a,b)-length(spec.shoulder[i],spec.elbow[i]))<.002);assert(Math.abs(length(b,c)-length(spec.elbow[i],spec.wrist[i]))<.002);}samples++;
}
const idle=solve({action:'idle',direction:'front',time:0});for(const arm of idle.arms){assert(Math.abs(arm.elbow[0]-arm.shoulder[0])<.6);assert(Math.abs(arm.wrist[0]-arm.shoulder[0])<.6);}
for(const direction of ['front','back','left','right']){
  const floor=solve({action:'floor-sit',direction,time:0}),desk=solve({action:'sit',direction,time:0});
  assert(floor.drop>desk.drop+3,'floor pelvis must be lower than the chair pose');
  for(const leg of floor.legs)assert(Math.abs(leg.knee[1]-leg.ankle[1])<1.5,'crossed calves stay near the floor instead of hanging below knees');
  if(!floor.profile){assert(floor.legs[0].knee[0]<floor.legs[0].root[0]);assert(floor.legs[1].knee[0]>floor.legs[1].root[0]);assert(floor.legs[0].ankle[0]>floor.legs[0].knee[0]);assert(floor.legs[1].ankle[0]<floor.legs[1].knee[0]);}
  for(const arm of floor.arms)assert(arm.wrist[1]>arm.elbow[1]&&arm.elbow[1]>arm.shoulder[1],'hands rest toward the knees');
  assert.deepEqual(solve({action:'sit',seatMode:'floor',direction,time:0}),{...floor,action:'sit'});
}
// A side view projects both shoulders close to the neck/pelvis axis. The
// old separated front-facing x positions put the near arm in front of the chest.
for(const direction of ['left','right']){
 const side=solve({direction,action:'idle',time:0});
 for(const arm of side.arms){assert(Math.abs(arm.shoulder[0]-16)<.5,'profile shoulder forward of body axis');assert(Math.abs(arm.wrist[0]-arm.shoulder[0])<.65,'resting profile arm should hang below shoulder');}
 assert(Math.abs(side.arms[1].shoulder[0]-side.arms[0].shoulder[0])<.4,'profile shoulders must overlap in depth');
}
const keys=run.create();keys.down('ArrowRight',0);keys.down('ArrowRight',20,true);assert(!keys.isRunning());keys.up('ArrowRight',50);keys.down('ArrowRight',120);assert(keys.isRunning());keys.up('ArrowRight',300);assert(!keys.isRunning());keys.down('ArrowRight',340);assert(!keys.isRunning(),'run release must not prime another double tap');keys.reset();keys.down('KeyD',0);keys.up('KeyD',40);keys.down('ArrowRight',100);assert(keys.isRunning(),'WASD and arrows share directions');keys.reset();assert(!keys.isRunning());keys.down('ArrowLeft',0);keys.up('ArrowLeft',500);keys.down('ArrowLeft',530);assert(!keys.isRunning(),'long hold is not a tap');keys.reset();keys.down('ArrowRight',0);keys.up('ArrowRight',30);keys.down('ArrowLeft',50);assert(!keys.isRunning(),'opposite direction is not double tap');keys.reset();keys.down('ArrowUp',0);keys.up('ArrowUp',30);keys.down('ArrowUp',100);keys.down('ArrowRight',150);assert(keys.isRunning(),'perpendicular key keeps run');keys.down('ArrowDown',200);assert(!keys.isRunning(),'opposite cancels run');
console.log('PASS: '+samples+' skeletal samples; fixed sagittal bone lengths, planted ankles, relaxed idle arms, double-tap/repeat/release/alias/focus-reset contracts.');
