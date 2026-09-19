// Actual articulated drawSheep, CPU matrices only. Reuse the t54 source loader,
// stopping before its tests/rendering so this file never launches a browser.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.resolve(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
const A=new Function('source','THREE','vm',load+'\nreturn context.API;')(source,THREE,vm);
const results=[],check=(name,pass,detail)=>{results.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));};
const actor=e=>({x:0,y:0,z:0,ry:Math.PI,g:0,ph:0,mv:false,wp:0,we:0,hat:0,gls:0,clo:0,jb:-1,jt:0,...e});
const pos=m=>new THREE.Vector3().setFromMatrixPosition(m),point=(m,x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(m);
function pose(s,t=10,settled=true){const gs=A.sheepGait(s,t);if(settled&&s.mv)gs.v=s.run?8:4;A.drawSheep([s],t,40,()=>0x67a7cb,1);
 return Object.fromEntries(Object.entries(A.meshes).map(([k,mesh])=>[k,Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;})]));}
function bottom(matrix,geometry=A.meshes.shoes.geometry){const p=geometry.attributes.position;let lo=Infinity;for(let i=0;i<p.count;i++)lo=Math.min(lo,new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix).y);return lo;}
const idle=pose(actor());
check('A person has two articulated arms, two articulated legs and two shoes',idle.arm.length===4&&idle.legs.length===4&&idle.shoes.length===2);
check('Neutral shoes touch the floor and knees remain nearly straight',idle.shoes.every(m=>Math.abs(bottom(m))<.006)&&new THREE.Vector3(0,1,0).transformDirection(idle.legs[0]).y>.99);
let joins=0,footMin=Infinity,contact=0,planted=0;
const clear={walk:0,run:0},knee={walk:0,run:0},elbow={walk:[9,-9],run:[9,-9]},total={walk:0,run:0};
for(const run of [false,true])for(let i=0;i<96;i++){
 const gp=i/96*Math.PI*2,p=pose(actor({mv:true,run,gp}));
 for(let side=0;side<2;side++){
  joins=Math.max(joins,point(p.legs[side*2],0,-.5,0).distanceTo(point(p.legs[side*2+1],0,.5,0)));
  const key=run?'run':'walk',low=bottom(p.shoes[side]);footMin=Math.min(footMin,low);
  clear[key]=Math.max(clear[key],low);total[key]++;
  const dir=m=>new THREE.Vector3(0,1,0).transformDirection(m);
  knee[key]=Math.max(knee[key],dir(p.legs[side*2]).angleTo(dir(p.legs[side*2+1])));
  const eb=dir(p.arm[side*2]).angleTo(dir(p.arm[side*2+1]));
  elbow[key][0]=Math.min(elbow[key][0],eb);elbow[key][1]=Math.max(elbow[key][1],eb);
  if(A.sheepFootPose(gp+(side?Math.PI:0),run).plant){planted++;if(Math.abs(low)<.045)contact++;}
 }
}
check('Thigh and shin share the same knee throughout walking and running',joins<1e-6,{worstJointGap:joins});
check('Feet never penetrate ground through complete gait cycles',footMin>-.008,{lowestShoe:footMin});
// 옛 조건은 swing clearance > .16 이었다. 그런데 엉덩이 .600 · 다리 전장 .525 · 중립 발목 .075 이므로
// 유각 중간(다리가 수직인 자리)에서 발을 .16 들면 엉덩이-발목이 .365 가 되고 코사인 법칙상 무릎이
// 반드시 92° 접힌다 — 즉 그 한 줄이 이 리그가 버리려는 '접힌 ㄱ자'를 명령하고 있었다.
// 접지(contact===planted)는 그대로 못 박고, plant 창을 지워 조건을 공허하게 만드는 편법만 막는다.
check('Support feet stay grounded while swing feet clear the floor',contact===planted&&planted>total.walk*.4&&clear.walk>.045&&clear.run>.08,{contact,planted,total,clear});
// 걷기는 예전 그대로 거의 편 진자를 지킨다(90° 미만, 실측 87°).
// 63차 — 달리기만 사람 쪽으로 옮겼다. 발을 제대로 들면 코사인 법칙상 무릎이 따라 접히는데,
// 사람이 달릴 때 무릎은 실제로 100~130° 접힌다. 한계를 126°(π*.70)로 올린다. 실측 115°.
// 그래도 상한을 남겨 둔다 — 여기를 넘으면 무릎이 가슴까지 올라온 것이라 달리기가 아니다.
check('Walking legs stay near-straight while running knees fold like a person',knee.walk<Math.PI*.50&&knee.run<Math.PI*.70,{walkKnee:knee.walk*180/Math.PI,runKnee:knee.run*180/Math.PI});
// 63차 — 팔은 사람 기준으로 옮겼다. 예전 단언은 '거의 편 진자'(run 최대 .60 = 34°)를 지키려던 것인데,
// 그러면 통짜 막대를 휘젓는 모습이 된다. 이제는 반대로 **달릴 때 팔이 접혀 있을 것**을 요구한다.
//   run 최소 > .6  — 주기 내내 굽은 채로 있어야 한다(펴진 채 흔드는 것을 막는다)
//   run 폭  > .25  — 그러면서도 굽었다 폈다 해야 한다(한 각도로 굳는 것을 막는다)
//   run 최대 < 1.9 — 사람 팔꿈치는 110° 넘게 접히지 않는다(접힌 ㄱ자로 굳는 것을 막는다)
// 실측: 걷기 0.48~0.79(27~45°) · 달리기 1.08~1.54(62~88°).
check('Running arms carry a bent human elbow instead of a straight pendulum',elbow.walk[1]-elbow.walk[0]>.05&&elbow.run[1]-elbow.run[0]>.25&&elbow.run[0]>.6&&elbow.run[1]<1.9,{walk:elbow.walk,run:elbow.run});
let continuity=0,prior=null;
for(let i=0;i<=240;i++){const p=pose(actor({mv:true,run:true,gp:i/240*Math.PI*2}));if(prior)for(let j=0;j<2;j++)continuity=Math.max(continuity,pos(p.shoes[j]).distanceTo(pos(prior.shoes[j])));prior=p;}
check('Toe off and heel contact have continuous foot trajectories',continuity<.035,{worstFrameStep:continuity});
// 디딘 발은 한 속도로 뒤로 쓸리고, 유각은 그 속도로 떠났다가 그 속도로 돌아와야 한다.
// 이음매에서 속도가 계단처럼 뛰는 것이 사용자가 말한 '멈췄다 꺾임'이다.
let seam=0;for(const run of [false,true]){const h=1e-4,d=x=>(A.sheepFootPose((x+h)*Math.PI*2,run).f-A.sheepFootPose((x-h)*Math.PI*2,run).f)/(2*h);
 const duty=.60-.14*(run?1:0),stance=Math.abs(d(duty*.5));
 seam=Math.max(seam,Math.abs(d(duty-.004)-d(duty+.004))/stance,Math.abs(d(1-.004)-d(.004))/stance);}
check('Foot speed carries through toe off and heel strike without a corner',seam<.08,{seamSpeedJump:seam});
const walk=pose(actor({mv:true,run:false,gp:0}));
check('Arms counter-swing against the leg on the same side',pos(walk.handL[0]).z<0&&pos(walk.shoes[0]).z>0&&pos(walk.handR[0]).z>0&&pos(walk.shoes[1]).z<0);
// A block avatar uses a continuous display stride. Locking a planted foot in world
// space at game speed used to push it beyond the leg's reach, then pop it forward.
let cadenceOK=true,maxCadence=0,maxLocalStep=0,maxTurn=0,worstStep,worstTurn;
const q=m=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));
for(const fps of [30,60,120])for(const [speed,run] of [[5.2,false],[8,true],[16,true]])for(const dir of [0,Math.PI/2,Math.PI/4]){
 const s=actor({mv:true,run}),start=40;let prev;
 pose(s,start,false);
 for(let i=1;i<=fps*2;i++){
  s.x=Math.sin(dir)*speed*i/fps;s.z=Math.cos(dir)*speed*i/fps;
  const p=pose(s,start+i/fps,false);
  const local=['arm','legs','shoes'].flatMap(k=>p[k].map(m=>({p:pos(m).sub(new THREE.Vector3(s.x,s.y,s.z)),q:q(m)})));
  if(prev)for(let j=0;j<local.length;j++){
   const step=local[j].p.distanceTo(prev[j].p)*fps/60,turn=local[j].q.angleTo(prev[j].q)*fps/60;
   if(step>maxLocalStep){maxLocalStep=step;worstStep={fps,speed,dir,frame:i,part:j};}
   if(turn>maxTurn){maxTurn=turn;worstTurn={fps,speed,dir,frame:i,part:j};}
  }
  prev=local;
 }
 const hz=A.sheepGait(s,start+2).gp/(Math.PI*4);maxCadence=Math.max(maxCadence,hz);
 cadenceOK&&=hz>.9&&hz<=(run?2.01:1.61);
}
check('Walk, run and speed boosts keep a readable display cadence at 30/60/120 Hz',cadenceOK,{maxCyclesPerSecond:maxCadence});
check('Continuous forward, side and diagonal travel has no foot or joint snap',maxLocalStep<.09&&maxTurn<.45,{maxLocalStepAt60Hz:maxLocalStep,maxRotationAt60Hz:maxTurn,worstStep,worstTurn});
let seamVelocity=0,seamCount=0;
for(const run of [false,true])for(let i=0;i<512;i++){
 let lo=(i-1)/512*Math.PI*2,hi=i/512*Math.PI*2;
 const plant=A.sheepFootPose(lo,run).plant;
 if(plant===A.sheepFootPose(hi,run).plant)continue;
 for(let j=0;j<30;j++){const mid=(lo+hi)/2;if(A.sheepFootPose(mid,run).plant===plant)lo=mid;else hi=mid;}
 const phase=(lo+hi)/2,e=.0001,a=A.sheepFootPose(phase-e,run),b=A.sheepFootPose(phase,run),c=A.sheepFootPose(phase+e,run);seamCount++;
 for(const key of ['f','lift','toe'])seamVelocity=Math.max(seamVelocity,Math.abs((b[key]-a[key])/e-(c[key]-b[key])/e));
}
check('Foot position and velocity join smoothly at lift-off and touchdown',seamCount===4&&seamVelocity<.001,{seamCount,velocityMismatch:seamVelocity});
let actionGround=true,actionReset=true;
for(const kind of ['mine','work','throw']){
 for(let i=0;i<=20;i++){const p=pose(actor({act:kind,actP:i/20,tool:kind==='throw'?'':kind}));actionGround&&=p.shoes.every(m=>bottom(m)>-.008&&bottom(m)<.045);}
 const a=A.sheepActionPose(kind,0),b=A.sheepActionPose(kind,1);actionReset&&=a.wind===0&&a.strike===0&&b.wind===0&&b.strike===0;
}
check('Work, harvest and throw transfer weight through planted feet',actionGround);
check('All action cycles return exactly to their starting pose phase',actionReset);
const aim=pose(actor({wp:3})),fire=pose(actor({wp:3,kick:1}));
const support=pos(aim.handL[0]).distanceTo(pos(aim.gun[3])),supportFire=pos(fire.handL[0]).distanceTo(pos(fire.gun[3]));
check('Seven-part gun remains supported by both hands through recoil',aim.gun.length===7&&fire.gun.length===7&&support<.10&&supportFire<.12,{support,supportFire});
check('Recoil moves both wrists while braced shoes remain grounded',pos(aim.handL[0]).distanceTo(pos(fire.handL[0]))>.04&&pos(aim.handR[0]).distanceTo(pos(fire.handR[0]))>.04&&fire.shoes.every(m=>Math.abs(bottom(m))<.015));
let limbsFinite=true,apexStep=0,jumpPrior;
for(let v=5;v>=-5;v-=.05){const p=pose(actor({air:true,vy:v}));for(const name of ['arm','legs','shoes'])for(const m of p[name])limbsFinite&&=m.elements.every(Number.isFinite);if(jumpPrior)for(let j=0;j<2;j++)apexStep=Math.max(apexStep,pos(p.shoes[j]).distanceTo(pos(jumpPrior.shoes[j])));jumpPrior=p;}
check('Jump rise, apex and fall bend knees continuously without invalid matrices',limbsFinite&&apexStep<.025,{maxFootStep:apexStep});
const land=pose(actor({land:.22}));check('Landing lowers the body through bent knees without sinking shoes',pos(land.body[0]).y<pos(idle.body[0]).y-.07&&land.shoes.every(m=>Math.abs(bottom(m))<.015));
const crowd=Array.from({length:40},(_,i)=>actor({x:i*2,wp:3,jb:i%3,jt:2,air:i%2===0,vy:2,glide:true}));
A.drawSheep(crowd,20,40,()=>0x67a7cb,1);
check('Forty fully equipped avatars fit leg, shoe and weapon instance capacities',A.meshes.legs.count===160&&A.meshes.shoes.count===80&&A.meshes.gun.count===280&&Object.values(A.meshes).every(m=>m.count<=m.instanceMatrix.count));
console.log(`${results.filter(Boolean).length}/${results.length} motion checks passed.`);process.exitCode=results.every(Boolean)?0:1;
