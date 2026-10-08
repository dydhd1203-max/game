'use strict';
// Joint lengths and rest angles come from each sex/view rig traced off the
// reference sheet (assets/sd-foundation-ref-data.js), never from constants.
require('../assets/sd-foundation-ref-data.js');
const assert=require('node:assert/strict'),{solve,spec}=require('../avatar-foundation.js'),run=require('../avatar-run-input.js');
let samples=0;
const length=(p,q)=>Math.hypot(...p.map((x,i)=>x-q[i]));
for(const sex of ['m','f'])for(const direction of ['front','back','left','right'])for(const action of ['idle','walk','run','jump','floor-sit','sit','climb'])for(let frame=0;frame<120;frame++){
  const pose=solve({sex,direction,action,phase:frame/120,grounded:false,time:0}),S=pose.spec,where=JSON.stringify({sex,direction,action,frame});
  for(const leg of pose.legs){const[a,b,c]=leg.boneSpace;assert(Math.abs(length(a,b)-S.thigh)<.002,'thigh '+where);assert(Math.abs(length(b,c)-S.shin)<.002,'shin '+where);if(leg.contact&&!pose.desk)assert(Math.abs(leg.ankle[1]-S.ankle)<.001,'planted ankle '+where);}
  for(const [i,arm] of pose.arms.entries()){for(const point of [arm.shoulder,arm.elbow,arm.wrist])assert(point.every(Number.isFinite));const [a,b,c]=arm.boneSpace;const upper=pose.profile?S.profileArm[0]:length(S.shoulder[i],S.elbow[i]),lower=pose.profile?S.profileArm[1]:length(S.elbow[i],S.wrist[i]);assert(Math.abs(length(a,b)-upper)<.002,'upper arm '+where);assert(Math.abs(length(b,c)-lower)<.002,'forearm '+where);}samples++;
}
// Idle rest pose is the reference sheet's own pose in every sex/view.
for(const sex of ['m','f'])for(const direction of ['front','back','right']){
  const p=solve({sex,direction,action:'idle',time:0}),S=p.spec,near=(u,v,what)=>assert(length(u,v)<.12,sex+' '+direction+' '+what+' '+JSON.stringify([u,v]));
  for(const [i,arm] of p.arms.entries()){
    if(p.profile){near(arm.shoulder,S.profileShoulder[i],'shoulder');const e=[S.profileShoulder[i][0]+S.profileSwing[0],S.profileShoulder[i][1]+S.profileSwing[1]];near(arm.elbow,e,'elbow');near(arm.wrist,[e[0]+S.profileFlex[0],e[1]+S.profileFlex[1]],'wrist');}
    else{near(arm.shoulder,S.shoulder[i],'shoulder');near(arm.elbow,S.elbow[i],'elbow');near(arm.wrist,S.wrist[i],'wrist');}
  }
  for(const leg of p.legs){assert(Math.abs(leg.ankle[1]-S.ankle)<.001&&Math.abs(leg.knee[1]-S.knee)<.12,sex+' '+direction+' leg rest');}
}
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
 for(const arm of side.arms){assert(Math.abs(arm.shoulder[0]-16)<.5,'profile shoulder forward of body axis');assert(Math.abs(arm.wrist[0]-arm.shoulder[0])<1,'resting profile arm should hang below shoulder');}
 assert(Math.abs(side.arms[1].shoulder[0]-side.arms[0].shoulder[0])<.4,'profile shoulders must overlap in depth');
}
const keys=run.create();keys.down('ArrowRight',0);keys.down('ArrowRight',20,true);assert(!keys.isRunning());keys.up('ArrowRight',50);keys.down('ArrowRight',120);assert(keys.isRunning());keys.up('ArrowRight',300);assert(!keys.isRunning());keys.down('ArrowRight',340);assert(!keys.isRunning(),'run release must not prime another double tap');keys.reset();keys.down('KeyD',0);keys.up('KeyD',40);keys.down('ArrowRight',100);assert(keys.isRunning(),'WASD and arrows share directions');keys.reset();assert(!keys.isRunning());keys.down('ArrowLeft',0);keys.up('ArrowLeft',500);keys.down('ArrowLeft',530);assert(!keys.isRunning(),'long hold is not a tap');keys.reset();keys.down('ArrowRight',0);keys.up('ArrowRight',30);keys.down('ArrowLeft',50);assert(!keys.isRunning(),'opposite direction is not double tap');keys.reset();keys.down('ArrowUp',0);keys.up('ArrowUp',30);keys.down('ArrowUp',100);keys.down('ArrowRight',150);assert(keys.isRunning(),'perpendicular key keeps run');keys.down('ArrowDown',200);assert(!keys.isRunning(),'opposite cancels run');
console.log('PASS: '+samples+' skeletal samples; fixed sagittal bone lengths, planted ankles, reference-sheet idle rest per sex/view, double-tap/repeat/release/alias/focus-reset contracts.');

for(const phase of [.25,.75]){const p=solve({action:'climb',direction:'front',phase});assert.equal(p.direction,'back');assert(p.arms.every(a=>a.elbow[1]>a.wrist[1]),'Climbing elbows must stay below hands');assert((p.arms[0].wrist[1]-p.arms[1].wrist[1])*(p.legs[0].ankle[1]-p.legs[1].ankle[1])<0,'Opposite hand and foot climb together');assert(p.legs.every(l=>!l.contact&&Math.abs(l.knee[0]-(l.root[0]+l.ankle[0])/2)<.01),'climbing knees bend in depth, not sideways');}

for(const phase of [.25,.75])for(const direction of ['front','back']){const pose=solve({action:'run',direction,phase});assert(pose.arms.every(a=>a.wrist[1]<a.elbow[1]),'Running forearms stay folded');}

// Natural motion contracts (2026-10-07). Numbers are pose geometry only; the
// art itself is reviewed on rendered frames.
{
 const at=(action,direction,phase,extra={})=>solve({action,direction,phase,time:0,...extra});
 // Walk: planted stance for most of the cycle, a lifted swing foot, a real
 // stride, and the opposite arm swinging forward with the forward leg.
 const walk=Array.from({length:24},(_,k)=>at('walk','right',k/24));
 const planted=walk.filter(p=>p.legs[0].contact).length/24;assert(planted>=.45&&planted<=.7,'walk stance share '+planted);
 assert(Math.max(...walk.map(p=>spec.ankle-p.legs[0].ankle[1]))>=1.1,'walking swing foot clears the ground');
 assert(walk[0].legs[0].ankle[0]-walk[0].legs[0].root[0]>=1.3,'heel strike lands ahead of the hip');
 assert(walk[0].arms[1].wrist[0]>walk[0].arms[1].shoulder[0]+.8&&walk[0].arms[0].wrist[0]<walk[0].arms[0].shoulder[0],'arm swings opposite the leading leg');
 // `contact` means a flat planted foot; rolling onto the toes before toe-off
 // lifts the ankle slightly but the foot is still on the ground.
 assert(walk.every(p=>p.legs.some(l=>spec.ankle-l.ankle[1]<=.36)),'a walk always keeps one foot on the ground (planted or rolling off its toes)');
 // Run: a flight phase with both feet up, a bigger stride and bent elbows.
 const run=Array.from({length:24},(_,k)=>at('run','right',k/24));
 assert(run.some(p=>p.legs.every(l=>!l.contact)),'running has a flight phase');
 assert(Math.max(...run.map(p=>spec.ankle-p.legs[0].ankle[1]))>Math.max(...walk.map(p=>spec.ankle-p.legs[0].ankle[1]))+.6,'running kicks the heel higher than walking');
 const elbowAngle=a=>{const u=a.boneSpace[1].map((v,i)=>v-a.boneSpace[0][i]),f=a.boneSpace[2].map((v,i)=>v-a.boneSpace[1][i]);return Math.acos(u.reduce((s,v,i)=>s+v*f[i],0)/Math.hypot(...u)/Math.hypot(...f))*180/Math.PI;};
 for(const direction of ['front','right','back'])for(const p of [0,.25,.5,.75])for(const arm of at('run',direction,p).arms)assert(elbowAngle(arm)>=60,'running elbows stay bent '+direction+' '+p);
 assert(Math.max(...run.map(p=>p.drop))-Math.min(...run.map(p=>p.drop))>Math.max(...walk.map(p=>p.drop))-Math.min(...walk.map(p=>p.drop)),'running bounces more than walking');
 // Back and front idle: arms hang beside the torso, hands near the hips.
 for(const direction of ['front','back']){const p=at('idle',direction,0);for(const [i,a] of p.arms.entries()){assert(Math.abs(a.wrist[0]-16)>3.2,'hanging hand beside the body '+direction);assert(a.wrist[1]>36&&a.wrist[1]<37.6,'hand rests at hip height '+direction);assert(Math.abs(a.depth)<.75,'resting arm near the body plane (the reference side view hangs it ~0.6 forward) '+direction+i);}}
 // Jump: crouch on the ground, tucked feet at the top, reaching down to land.
 const crouch=solve({action:'jump',direction:'right',grounded:true,time:0}),apex=solve({action:'jump',direction:'right',grounded:false,vy:0,time:0}),landing=solve({action:'jump',direction:'right',grounded:false,vy:-480,time:0});
 assert(crouch.drop>.5,'take-off crouch');assert(Math.min(...apex.legs.map(l=>spec.ankle-l.ankle[1]))>=1.8,'tucked feet at the apex');assert(Math.max(...landing.legs.map(l=>spec.ankle-l.ankle[1]))<1.2,'feet reach down before landing');
 // Wave in four views: the hand is raised above the shoulder and the
 // forearm waves while the upper arm stays up.
 for(const direction of ['front','right','left','back']){
  const frames=[.35,.45,.55,.65].map(g=>solve({action:'idle',direction,gesture:'wave',gestureProgress:g,time:0}).arms[1]);
  for(const a of frames)assert(a.wrist[1]<a.shoulder[1]-2.5,'waving hand above the shoulder '+direction);
  const spread=k=>Math.max(...frames.map(a=>a[k][0]))-Math.min(...frames.map(a=>a[k][0]))+Math.max(...frames.map(a=>a[k][1]))-Math.min(...frames.map(a=>a[k][1]));
  assert(spread('wrist')>spread('elbow')*1.5&&spread('wrist')>.6,'the forearm does the waving '+direction);
 }
 // Climb: hands alternate above the head, never splaying to the sides.
 for(const p of [.25,.75]){const c=solve({action:'climb',phase:p,time:0});assert(Math.min(...c.arms.map(a=>a.wrist[1]))<27,'a hand grips above the head');assert(c.arms.every(a=>Math.abs(a.wrist[0]-16)<6),'hands stay on the ladder rails');}
 console.log('PASS: natural walk/run/idle/jump/wave/climb motion contracts.');
}
