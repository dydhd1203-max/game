'use strict';
// Joint lengths and rest angles come from each sex/view rig traced off the
// reference sheet (assets/sd-foundation-ref-data.js), never from constants.
require('../assets/sd-foundation-ref-data.js');
const assert=require('node:assert/strict'),{solve,spec}=require('../avatar-foundation.js'),run=require('../avatar-run-input.js');
let samples=0;
const length=(p,q)=>Math.hypot(...p.map((x,i)=>x-q[i]));
for(const sex of ['m','f'])for(const direction of ['front','back','left','right'])for(const action of ['idle','walk','run','jump','floor-sit','sit','climb'])for(let frame=0;frame<120;frame++){
  const pose=solve({sex,direction,action,phase:frame/120,grounded:false,time:0}),S=pose.spec,where=JSON.stringify({sex,direction,action,frame});
  for(const leg of pose.legs){const[a,b,c]=leg.boneSpace;assert(Math.abs(length(a,b)-S.thigh)<.002,'thigh '+where);assert(Math.abs(length(b,c)-S.shin)<.002,'shin '+where);if(leg.contact&&!pose.desk)assert(Math.abs(leg.boneSpace[2][1]-S.ankle)<.001,'planted ankle '+where);}
  // Walk/run (2026-10-08, locomotion): front/back views draw the ground
  // receding (a foot nearer the camera lower on screen), so the planted height
  // is checked on the unprojected bone; the screen offset is that projection.
  if((action==='walk'||action==='run')&&!pose.profile)for(const leg of pose.legs)assert(Math.abs(leg.ankle[1]-leg.boneSpace[2][1]-(direction==='back'?-1:1)*.3*leg.boneSpace[2][0])<.001,'ground projection '+where);
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
// Seated poses (2026-10-08 motion stage 2, D6/D7). The desk pose used to be a
// half squat (pelvis 1.55 down, thighs sloping 30 degrees); it now sits on a
// seat with level thighs, so the pelvis is a thigh length lower and the
// cross-legged pelvis is lower than it by the chair height (old margin 3 ->
// 2.5). The other old contracts stay; the rest pin what the user asked for.
const shoeToe=(()=>{const F=globalThis.QPFoundationReferenceData.figures['m-right'];return(F.rects.shoe[0][0]+F.rects.shoe[0][2]-F.joints.ankle[0][0])*F.k;})();
for(const sex of ['m','f'])for(const direction of ['front','back','left','right']){
  const floor=solve({sex,action:'floor-sit',direction,time:0}),desk=solve({sex,action:'sit',direction,time:0}),S=floor.spec,where=sex+' '+direction,dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  assert(floor.drop>desk.drop+2.5,'floor pelvis must be lower than the chair pose');
  for(const leg of floor.legs)assert(Math.abs(leg.knee[1]-leg.ankle[1])<1.5,'crossed calves stay near the floor instead of hanging below knees');
  if(!floor.profile){assert(floor.legs[0].knee[0]<floor.legs[0].root[0]);assert(floor.legs[1].knee[0]>floor.legs[1].root[0]);assert(floor.legs[0].ankle[0]>floor.legs[0].knee[0]);assert(floor.legs[1].ankle[0]<floor.legs[1].knee[0]);}
  for(const arm of floor.arms)assert(arm.wrist[1]>arm.elbow[1]&&arm.elbow[1]>arm.shoulder[1],'hands rest toward the knees');
  assert.deepEqual(solve({sex,action:'sit',seatMode:'floor',direction,time:0}),{...floor,action:'sit'});
  // 아빠다리: the seat is on the floor, the knees open past the hips to the
  // sides (front/back) or ahead (side), and each hand rests on its knee.
  for(const leg of floor.legs)assert(S.floor-leg.root[1]<2,'cross-legged seat rests on the floor '+where);
  if(floor.profile){for(const leg of floor.legs)assert(leg.knee[0]-leg.root[0]>2.5,'side view: knees ahead of the hips '+where);assert(floor.legs[1].seatShoe?.view==='Profile'&&floor.legs[0].seatShoe?.hidden,'side view: near foot side-on under the knee, far foot behind the seat '+where);}
  else for(const leg of floor.legs)assert(Math.abs(leg.knee[0]-16)>Math.abs(leg.root[0]-16)+1.5,'knees open out to the sides '+where);
  if(direction==='front'){
   // Whole side-on shoes (never squashed) pointing across, crossing in front.
   const[l,r]=floor.legs;assert(l.seatShoe.view==='Profile'&&l.seatShoe.flip===1&&r.seatShoe.flip===-1,'feet point across to the other side');
   assert(l.ankle[0]+shoeToe-(r.ankle[0]-shoeToe)>1.2,'the two feet cross in front '+where);assert(r.ankle[1]>=l.ankle[1],'the near foot crosses in front (lower)');
  }
  if(direction==='back')assert(floor.legs.every(l=>l.seatShoe?.hidden),'from behind the feet are hidden in front of the body');
  floor.arms.forEach((arm,i)=>assert(dist(arm.wrist,floor.legs[i].knee)<1.7,'hand rests on its knee '+where+i));
  // Desk: feet flat under the knees, thighs on the seat (level and ahead in
  // the side view, foreshortened from the front/back), forearms forward at
  // desk height (inside the elbows from the front: not hands in pockets).
  for(const leg of desk.legs){assert(Math.abs(leg.ankle[1]-S.ankle)<.001&&leg.contact,'desk feet flat on the floor '+where);}
  if(desk.profile){
   const angle=(a,b,c)=>{const u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]];return Math.acos((u[0]*v[0]+u[1]*v[1])/Math.hypot(...u)/Math.hypot(...v))*180/Math.PI;};
   for(const leg of desk.legs){assert(leg.knee[0]-leg.root[0]>2.8&&Math.abs(leg.knee[1]-leg.root[1])<.6,'side view: level thigh on the seat '+where);assert(Math.abs(angle(leg.root,leg.knee,leg.ankle)-90)<15,'side view: right angle at the knee '+where);}
   for(const arm of desk.arms)assert(arm.wrist[0]-arm.elbow[0]>1.8&&Math.abs(arm.wrist[1]-arm.elbow[1])<.6,'side view: forearm forward along the desk '+where);
  }else{
   for(const leg of desk.legs)assert(dist(leg.root,leg.knee)<.3*S.thigh,'front/back: thighs foreshortened toward the viewer '+where);
   if(direction==='front')for(const arm of desk.arms)assert(Math.abs(arm.wrist[0]-16)<Math.abs(arm.elbow[0]-16)-.8&&arm.wrist[1]<arm.shoulder[1]+4.5,'front: hands forward in front of the body '+where);
  }
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

// Climb contract changed 2026-10-08 (D12 rework): knees bent only into depth
// looked like straight legs from behind, so climbing knees bend forward into
// the ladder AND open a little outward (ladder knees); never inward.
for(const phase of [.25,.75]){const p=solve({action:'climb',direction:'front',phase});assert.equal(p.direction,'back');assert(p.arms.every(a=>a.elbow[1]>a.wrist[1]),'Climbing elbows must stay below hands');assert((p.arms[0].wrist[1]-p.arms[1].wrist[1])*(p.legs[0].ankle[1]-p.legs[1].ankle[1])<0,'Opposite hand and foot climb together');assert(p.legs.every((l,i)=>{const out=(i?1:-1)*(l.knee[0]-(l.root[0]+l.ankle[0])/2);return !l.contact&&l.boneSpace[1][2]<0&&out>=0&&out<1.6;}),'climbing knees bend toward the ladder and open outward, never inward');}

// Running arms in front/back (2026-10-08, locomotion, D5). The elbow stays
// bent in 3D while the forearm keeps at least ~half its drawn length on
// screen. The old test (wrist above elbow on screen at .25/.75) held the
// forearm folded up over the sleeve, where it showed as a flat stub with
// the hidden upper-arm skin pasted over the sleeve; the forward fist now
// crosses in front of the chest instead.
for(const sex of ['m','f'])for(const direction of ['front','back'])for(let k=0;k<24;k++){const pose=solve({sex,action:'run',direction,phase:k/24,time:0});for(const a of pose.arms){const[s,e,w]=a.boneSpace,u=e.map((v,i)=>v-s[i]),f=w.map((v,i)=>v-e[i]),bend=Math.acos(u.reduce((t,v,i)=>t+v*f[i],0)/Math.hypot(...u)/Math.hypot(...f))*180/Math.PI;assert(bend>=60,'Running elbow stays bent '+sex+direction+k);assert(Math.hypot(f[0],f[1])/Math.hypot(...f)>=.45,'Running forearm is not a foreshortened stub '+sex+direction+k);}
 const forward=pose.arms.reduce((m,a)=>a.depth*(direction==='back'?-1:1)>m.depth*(direction==='back'?-1:1)?a:m);if(k%12===0)assert(Math.abs(forward.wrist[0]-16)<Math.abs(forward.elbow[0]-16)-.8,'forward running fist crosses toward the chest '+sex+direction+k);}

// Natural motion contracts (2026-10-07). Numbers are pose geometry only; the
// art itself is reviewed on rendered frames.
{
 const at=(action,direction,phase,extra={})=>solve({action,direction,phase,time:0,...extra});
 // Walk: planted stance for most of the cycle, a lifted swing foot, a real
 // stride, and the opposite arm swinging forward with the forward leg.
 const walk=Array.from({length:24},(_,k)=>at('walk','right',k/24));
 // 2026-10-08 (locomotion): stance = the foot is on the ground (heel strike
 // to toe-off, 60% of the cycle); contact = the heel is down. Heel-off now
 // starts at 55% of stance (was 72%), so the rolling foot counts as stance.
 const planted=walk.filter(p=>p.legs[0].stance).length/24,heelDown=walk.filter(p=>p.legs[0].contact).length/24;assert(planted>=.5&&planted<=.7,'walk stance share '+planted);assert(heelDown>=.3&&heelDown<planted,'walk heel-down share '+heelDown);
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
 // Jump contracts rebuilt with the D8 jump (2026-10-08): the old 0.85 drop
 // read as standing, so the take-off crouch must now be a real knee bend.
 assert(crouch.drop>=1.2,'take-off crouch is a visible knee bend');assert(Math.min(...apex.legs.map(l=>spec.ankle-l.ankle[1]))>=1.8,'tucked feet at the apex');assert(Math.max(...landing.legs.map(l=>spec.ankle-l.ankle[1]))<1.2,'feet reach down before landing');
 // Take-off: hips back, knees forward over the toes, arms swung behind.
 // Landing (the game's jumpStage, or the second half of a studio cycle):
 // the same give with the arms forward for balance.
 for(const sex of ['m','f']){
  const take=solve({sex,action:'jump',direction:'right',grounded:true,jumpStage:'takeoff',jumpCompression:1,time:0}),land=solve({sex,action:'jump',direction:'right',grounded:true,jumpStage:'landing',jumpCompression:1,time:0}),studioLand=solve({sex,action:'jump',direction:'right',grounded:true,jumpCompression:1,phase:.95,time:0});
  for(const p of [take,land])for(const l of p.legs){assert(l.contact&&l.knee[0]-l.ankle[0]>=1,'crouching knee forward over the planted foot '+sex);assert(l.root[0]<l.ankle[0],'crouching hips sit back '+sex);}
  assert(take.arms.every(a=>a.wrist[0]<a.shoulder[0]-1.5),'take-off arms swing behind '+sex);
  assert(land.arms[1].wrist[0]>land.arms[1].shoulder[0]+1&&studioLand.arms[1].wrist[0]>studioLand.arms[1].shoulder[0]+1,'landing arms reach forward '+sex);
  // Launch: legs extended, toes pointed, arms carried up.
  const launch=solve({sex,action:'jump',direction:'right',grounded:false,vy:480,time:0}),S=launch.spec;
  assert(launch.legs.every(l=>S.ankle-l.ankle[1]<.3&&l.shoeAngle>=20*Math.PI/180),'launch extends the legs and points the toes '+sex);
  assert(launch.arms[1].wrist[1]<launch.arms[1].shoulder[1],'launch carries the arms up '+sex);
  // Apex: knees up, not only feet lifted; head-on the knees turn out.
  const top=solve({sex,action:'jump',direction:'right',grounded:false,vy:0,time:0}),topFront=solve({sex,action:'jump',direction:'front',grounded:false,vy:0,time:0});
  assert(top.legs.every(l=>l.knee[0]-l.root[0]>=top.spec.thigh*Math.sin(40*Math.PI/180)),'apex thighs come up '+sex);
  assert(topFront.legs.every((l,i)=>(i?1:-1)*(l.knee[0]-l.root[0])>.5),'apex knees turn out head-on '+sex);
  for(const direction of ['right','front','back']){
   const flight=Array.from({length:17},(_,k)=>solve({sex,action:'jump',direction,grounded:false,vy:480-k*60,time:0}));
   // The arms travel through the flight instead of holding one pose (the
   // old jump moved the hands 0.8 up and down over the whole flight; from
   // behind part of the lift points away from the camera, hence 2.5).
   const ys=flight.map(p=>p.arms[1].wrist[1]-p.arms[1].shoulder[1]);assert(Math.max(...ys)-Math.min(...ys)>=2.5,'arms travel through the flight '+sex+' '+direction);
   if(direction==='right'){assert(flight.every(p=>p.arms[1].wrist[1]>=27.6),'a raised side hand stays below the chin, never over the face '+sex);continue;}
   // No wide-elbowed T: a hanging forearm never hangs from an elbow flung
   // outside the shoulder-wrist line (the old air pose did, by 0.8).
   for(const p of flight)for(const a of p.arms){const w=[a.wrist[0]-a.shoulder[0],a.wrist[1]-a.shoulder[1]],e=[a.elbow[0]-a.shoulder[0],a.elbow[1]-a.shoulder[1]],l=Math.hypot(...w),out=Math.sign(w[0])*(e[0]*w[1]-e[1]*w[0])/l;
    if(a.wrist[1]>a.elbow[1])assert(out<.35,'no wide elbow above a hanging forearm '+sex+' '+direction+' '+out.toFixed(2));
    assert(Math.abs(w[0])<3.4,'hands stay near the body, not flung out to a T '+sex+' '+direction);}
  }
 }
 // Gestures on the v2 body (2026-10-08, D9-D11). Updated because the old
 // wave contract required a profile hand 2.5 above the shoulder, which with
 // the large reference head can only be reached by covering the face (the
 // defect the user reported); the hand is now held in front of the chin.
 const gesture=(name,direction,g,sex='m')=>solve({sex,action:'idle',direction,gesture:name,gestureProgress:g,time:0});
 const handOf=a=>{const d=a.wrist.map((v,i)=>v-a.elbow[i]),l=Math.hypot(...d);return a.wrist.map((v,i)=>v+d[i]/l*.8);};
 const bend=a=>{const u=a.elbow.map((v,i)=>v-a.shoulder[i]),f=a.wrist.map((v,i)=>v-a.elbow[i]);return Math.acos(Math.max(-1,Math.min(1,(u[0]*f[0]+u[1]*f[1])/Math.hypot(...u)/Math.hypot(...f))))*180/Math.PI;};
 for(const sex of ['m','f'])for(const direction of ['front','right','left','back']){
  // Wave: the hand is up beside the head (front/back) or in front of the
  // chin (profile, never over the face) and the forearm does the waving.
  const frames=[.35,.45,.55,.65].map(g=>gesture('wave',direction,g,sex).arms[1]),side=direction==='right'||direction==='left';
  for(const a of frames){assert(a.wrist[1]<a.shoulder[1]-(side?1.2:2.5),'waving hand above the shoulder '+sex+direction);if(side)assert(handOf(a)[0]>21,'profile waving hand ahead of the chin, off the face '+sex+direction);else assert(handOf(a)[0]>23,'waving hand beside the head '+sex+direction);}
  const spread=k=>Math.max(...frames.map(a=>a[k][0]))-Math.min(...frames.map(a=>a[k][0]))+Math.max(...frames.map(a=>a[k][1]))-Math.min(...frames.map(a=>a[k][1]));
  assert(spread('wrist')>spread('elbow')*1.5&&spread('wrist')>.6,'the forearm does the waving '+sex+direction);
  // Raising and lowering never pass a straight arm held out sideways/forward.
  for(let k=0;k<=100;k++){const a=gesture('wave',direction,k/100,sex).arms[1];if(Math.abs(a.wrist[1]-a.shoulder[1])<1.5&&Math.abs(a.wrist[0]-a.shoulder[0])>3)assert(bend(a)>35,'no straight horizontal waving arm '+sex+direction+' '+k);}
  // Happy: a V with both hands outside the head (front/back); from the side
  // the near hand rises behind the eye. Two hops with a squash on landing.
  const cheer=gesture('happy',direction,.25,sex);
  if(side)assert(handOf(cheer.arms[1])[0]<17.5&&cheer.arms[1].wrist[1]<cheer.arms[1].shoulder[1]-4,'profile cheering arm up beside the head, off the face '+sex+direction);
  else for(const [i,a] of cheer.arms.entries()){const out=i?1:-1;assert(a.wrist[1]<a.shoulder[1]-3.5,'cheering hand up '+sex+direction);assert(out*(a.wrist[0]-a.elbow[0])>0&&out*(a.elbow[0]-a.shoulder[0])>0,'arms open in a V '+sex+direction);assert(Math.abs(handOf(a)[0]-16)>(sex==='f'?8.7:8.2),'cheering hand outside the head (reference head half-width at hand height: m 7.3, f 8.1-8.5), not clutching it '+sex+direction);}
  const hops=Array.from({length:101},(_,k)=>gesture('happy',direction,k/100,sex));
  assert(Math.max(...hops.map(h=>h.hop))>=3,'a real hop '+sex+direction);
  const landing=hops.filter(h=>h.hop===0&&h.drop>.4);assert(landing.length>=6&&Math.max(...landing.map(h=>h.drop))>.6&&landing.every(h=>h.legs.every(l=>l.contact)),'squash on the planted feet '+sex+direction);
  assert(hops.filter((h,k)=>k&&h.hop>0&&hops[k-1].hop===0).length===2,'two hops '+sex+direction);
 }
 // Bow: twice, with the head pitching forward over a slight upper-body bend.
 {const bows=Array.from({length:101},(_,k)=>gesture('nod','right',k/100));
  const peaks=bows.filter((b,k)=>k&&bows[k-1].nod<.5&&b.nod>=.5).length;assert(peaks===2&&Math.max(...bows.map(b=>b.nod))>.95,'two bows '+peaks);
  assert(bows.some((b,k)=>k>20&&k<80&&b.nod<.02),'the head comes back up between the bows');
  const deep=bows.reduce((a,b)=>b.nod>a.nod?b:a);assert(deep.headPitch>=18&&deep.lean>=5&&deep.lean<=10,'a real bow: head pitch '+deep.headPitch+' lean '+deep.lean);
  assert(gesture('nod','front',.2).headPitch===0,'front bow dips the head instead of turning it');}
 // Climb (contract rewritten 2026-10-08 with the D12 rework; the old one
 // checked only two frames and called a wrist at ear height "above the head").
 // Fixed bone lengths cannot lift a hand over the reference head (head top
 // ~13.5 vs best hand tip ~22.5), so the top grip is checked as a nearly full
 // reach beside the head instead. Every frame of the 24-pose cycle, both sexes:
 for(const sex of ['m','f']){
  const frames=Array.from({length:25},(_,k)=>solve({sex,action:'climb',phase:k/24,time:0})),L=frames[0].ladder,S=frames[0].spec,shoulderY=S.shoulder[1][1],angle=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),f=c.map((v,i)=>v-b[i]);return Math.acos(u.reduce((s,v,i)=>s+v*f[i],0)/Math.hypot(...u)/Math.hypot(...f))*180/Math.PI;};
  for(const p of frames){
   assert(p.arms.every(a=>Math.abs(Math.abs(a.wrist[0]-16)-5.8)<=.25),'hands hold the rails (16±5.7; painted map rails are 16±6.0–6.6) '+sex);
   assert(p.arms.every(a=>a.elbow[1]>a.wrist[1]&&angle(...a.boneSpace)>=15),'climbing elbows bend and stay below the hands '+sex);
   assert(p.legs.every((l,i)=>{const out=(i?1:-1)*(l.knee[0]-(l.root[0]+l.ankle[0])/2);return !l.contact&&out>=0&&out<1.6;}),'ladder knees open outward, never inward '+sex);
  }
  assert(Math.min(...frames.flatMap(p=>p.arms.map(a=>a.wrist[1])))<=shoulderY-5.2,'the top grip is a nearly full reach beside the head '+sex);
  assert(frames.some(p=>p.arms[0].wrist[1]<p.arms[1].wrist[1]-1.8)&&frames.some(p=>p.arms[1].wrist[1]<p.arms[0].wrist[1]-1.8),'hands take turns reaching up '+sex);
  assert(Math.max(...frames.flatMap(p=>p.arms.map(a=>angle(...a.boneSpace))))>=100,'the pulling arm folds at the elbow '+sex);
  assert(Math.max(...frames.flatMap(p=>p.legs.map(l=>S.ankle-l.ankle[1])))>=2.2&&Math.max(...frames.flatMap(p=>p.legs.map(l=>angle(...l.boneSpace))))>=100,'the stepping foot rises with a bent knee '+sex);
  assert(frames.filter(p=>(p.arms[0].wrist[1]-p.arms[1].wrist[1])*(p.legs[0].ankle[1]-p.legs[1].ankle[1])<0).length>=20,'a hand and the opposite foot are up together '+sex);
  // Not floating: a holding limb slides down at exactly the climbing rate (it
  // stays on its rung of one ladder while the body rises). Every frame keeps
  // at least one hand and one foot holding.
  for(let k=0;k<24;k++){const a=frames[k],b=frames[k+1],holds=(x,y)=>Math.abs(y-x-L.rise/24)<1e-3;
   assert(a.arms.some((h,i)=>holds(h.wrist[1],b.arms[i].wrist[1]))&&a.legs.some((f,i)=>holds(f.ankle[1],b.legs[i].ankle[1])),'a hand and a foot hold the ladder at every frame '+sex+' '+k);}
  assert(L.footDuty>=.5&&L.handDuty>=.6&&L.handDuty<=.88,'grip timing '+sex);
 }
 console.log('PASS: natural walk/run/idle/jump/wave/happy/bow/climb motion contracts.');
}

// Locomotion rebuild (2026-10-08, D4/D5 in 기준캐릭터-조사 motion). Geometry
// only: the frames themselves are reviewed on rendered contact sheets.
{
 const at=(sex,action,direction,phase)=>solve({sex,action,direction,phase,time:0}),angle=(a,b,c)=>{const u=a.map((v,i)=>v-b[i]),w=c.map((v,i)=>v-b[i]);return 180-Math.acos(u.reduce((t,v,i)=>t+v*w[i],0)/Math.hypot(...u)/Math.hypot(...w))*180/Math.PI;};
 for(const sex of ['m','f']){
  const walk=Array.from({length:24},(_,k)=>at(sex,'walk','right',k/24)),run=Array.from({length:24},(_,k)=>at(sex,'run','right',k/24)),rel=(p,i)=>p.legs[i].ankle[0]-p.legs[i].root[0];
  // A real stride at heel strike (the old one was 3.5 apart) and a lifted,
  // bent swing knee; the planted foot travels back at one steady speed, so
  // it never slides forward or hitches while it is on the ground.
  assert(rel(walk[0],0)-rel(walk[0],1)>=4.2,'walking stride at heel strike '+sex);
  assert(Math.max(...walk.map(p=>angle(...p.legs[0].boneSpace)))>=55,'walking swing knee bends '+sex);
  const stance=walk.filter(p=>p.legs[0].stance).map(p=>rel(p,0)),steps=stance.slice(1).map((x,k)=>x-stance[k]);
  assert(steps.every(d=>d<0&&Math.abs(d-steps[0])<.02),'planted foot moves back steadily '+sex+' '+steps.map(d=>d.toFixed(3)));
  assert(Math.max(...walk.map(p=>p.drop))-Math.min(...walk.map(p=>p.drop))<=.6,'walking bob stays gentle '+sex);
  // Running: 10-15 degree lean, high heel kick and knee drive, flight.
  assert(run.every(p=>p.lean>=10&&p.lean<=15),'running forward lean '+sex);
  assert(Math.max(...run.map(p=>angle(...p.legs[0].boneSpace)))>=100,'running heel kick '+sex);
  assert(Math.max(...run.map(p=>{const[r,k]=p.legs[0].boneSpace;return Math.atan2(k[0]-r[0],k[1]-r[1])*180/Math.PI;}))>=40,'running knee drive '+sex);
  assert(run.filter(p=>p.legs.every(l=>!l.stance)).length>=2,'running flight phase '+sex);
  // The nape: a leaning neck stays under the head (neck + head share the lean).
  for(const p of [...walk,...run])assert(Math.abs(p.lean-p.neckTilt-p.headTilt)<1e-9&&p.neckTilt>=0,'neck and head share the lean '+sex);
  // Front/back: the opposite arm swing reads (the forward hand higher and
  // nearer the body), and a stepping foot is drawn lower than the one behind.
  for(const direction of ['front','back'])for(const action of ['walk','run']){
   const p=at(sex,action,direction,0),f=p.arms[1],b=p.arms[0];
   assert(f.wrist[1]<b.wrist[1]-.8&&Math.abs(f.wrist[0]-16)<Math.abs(b.wrist[0]-16),'forward arm reads in '+direction+' '+action+' '+sex);
   const near=p.legs.reduce((m,l)=>l.boneSpace[2][0]*(direction==='back'?-1:1)>m.boneSpace[2][0]*(direction==='back'?-1:1)?l:m);
   // Walking heel strike has both feet down; a running heel kick toward
   // the camera (back view) is meant to rise.
   if(action==='walk')assert(p.legs.every(l=>l===near||l.ankle[1]<near.ankle[1]-.5),'the nearer stepping foot is lower on screen '+direction+' '+action+' '+sex);
  }
 }
 console.log('PASS: locomotion stride, knee lift, steady planted foot, run lean/heel kick/flight, shared neck lean, front/back arm and step read.');
}

// Static render and reduced motion (D13, 2026-10-08). render() poses itself
// as staticPose so screens without a motion controller show the whole body;
// reset() returns to it. Under prefers-reduced-motion (state.reducedMotion)
// the rig's own clock stops: idle at any time is the time-0 pose. A requested
// happy gesture still plays, with its whole-body hop damped.
{
 const api=require('../avatar-foundation.js');
 assert.deepEqual(api.staticPose,{action:'idle',direction:'front',time:0},'static pose is idle front at time 0');
 for(const sex of ['m','f'])for(const direction of ['front','back','left','right'])for(const time of [.7,1.65,4.2])assert.deepEqual(solve({sex,direction,action:'idle',time,reducedMotion:true}),solve({sex,direction,action:'idle',time:0}),'reduced motion holds the idle pose '+sex+' '+direction+' '+time);
 for(const g of [.17,.33,.5]){const full=solve({action:'idle',gesture:'happy',gestureProgress:g,time:0}),calm=solve({action:'idle',gesture:'happy',gestureProgress:g,time:0,reducedMotion:true});assert(calm.hop<=full.hop*.4+1e-9&&(full.hop<.01||calm.hop>0),'reduced motion damps the happy hop but keeps the gesture '+g);}
 console.log('PASS: static pose and reduced-motion contracts.');
}
