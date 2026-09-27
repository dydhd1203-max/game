// Real avatar pose/wing vertices; no browser, network, camera or gameplay simulation.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.resolve(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
const A=new Function('source','THREE','vm',load+'\nreturn context.API;')(source,THREE,vm),checks=[];
const check=(name,pass,data)=>{checks.push(!!pass);console.log(`${pass?'PASS':'FAIL'} ${name}${data===undefined?'':' '+JSON.stringify(data)}`);};
const fields=['yaw','pitch','roll','span','fe','fw','fs','ff'],h=1e-5;
let velocityJump=0,positionJump=0,nonfinite=0;
for(const si of [-1,1])for(const glide of [0,.5,1])for(let i=0;i<=1000;i++){
 const t=(40+i/1000)/1.75,args={air:1,glide,turn:.5},m=A.avatarWingPose(si,{...args,t:t-h}),p=A.avatarWingPose(si,{...args,t}),n=A.avatarWingPose(si,{...args,t:t+h});
 for(const key of fields){const dv=Math.abs((n[key]-p[key])/h-(p[key]-m[key])/h);velocityJump=Math.max(velocityJump,dv);positionJump=Math.max(positionJump,Math.abs(n[key]-m[key]));if(!Number.isFinite(dv))nonfinite++;}
}
check('Whole flap cycle, old recovery boundary and wrap keep position and velocity continuous',nonfinite===0&&positionJump<.001&&velocityJump<.015,{positionJump,velocityJump});
let ordinary=[];for(let i=0;i<600;i++){const p=A.avatarWingPose(1,{t:i/600/1.75,air:1});ordinary.push(p);}
const bottom=ordinary.reduce((j,p,i)=>p.roll<ordinary[j].roll?i:j,0)/600;
check('Power stroke is shorter than recovery while both remain part of the same continuous cycle',bottom>.35&&bottom<.45&&ordinary[0].cycle===0,{powerFraction:bottom,recoveryFraction:1-bottom});
const idle=A.avatarWingPose(1,{t:2}),sprint=A.avatarWingPose(1,{t:2,mv:1,run:1}),take=A.avatarWingPose(1,{t:2,air:1,take:1}),air=A.avatarWingPose(1,{t:2,air:1}),land=A.avatarWingPose(1,{t:2,land:.22});
check('Sprinting sweeps folded wings back and narrows their span',sprint.yaw>idle.yaw+.05&&sprint.span<idle.span-.02);
check('Takeoff opens the shoulder and landing has a small settling pose',take.yaw<air.yaw-.04&&Math.abs(take.pitch-air.pitch)>.025&&land.yaw>idle.yaw+.015);
const pair=bank=>[1,-1].map(si=>A.avatarWingPose(si,{t:2,air:1,glide:1,turn:bank}));
const left=pair(-1),right=pair(1);
check('Glide banking responds oppositely on the two wings and reverses with the turn',right[0].roll>left[0].roll+.10&&right[1].roll>left[1].roll+.10&&right[0].yaw>left[0].yaw+.05&&right[1].yaw>left[1].yaw+.05);
const w0=pair(0);
check('Left and right feather tips make small independent airflow corrections',Math.abs(w0[0].fw-w0[1].fw)>.001&&Math.abs(w0[0].fw-w0[1].fw)<.05);
let protectedOK=true;
for(const state of [{},{mv:1,run:1},{air:1,glide:1,aim:true},{air:1,glide:1,down:true}])for(let i=0;i<40;i++){
 const p=A.avatarWingPose(1,{t:i*.071,turn:1,take:1,land:.22,...state});
 protectedOK&&=['fe','fw','fs','ff'].every(k=>p[k]===0);
 if(state.down)protectedOK&&=p.yaw===1.4&&p.roll===-.84&&p.span===.90;
 if(state.aim)protectedOK&&=p.yaw===1.48&&p.roll===-.76&&p.span===.76;
}
check('Ground geometry stays unbent and aiming/downed poses remain fully folded even with stale flight flags',protectedOK);
// The continuous local bend must not create a tip that crosses the shoulder or explodes.
let maxTip=0,minTip=Infinity,badTip=0;
for(const geo of A.WING_GEO){const P=geo.attributes.position,B=geo.attributes.wbone,V=geo.attributes.wpiv,j=geo.userData.tipI;
 for(let i=0;i<600;i++)for(const glide of [0,1]){
  const w=A.avatarWingPose(1,{t:i/600/1.75,air:1,glide,turn:1,take:.5}),p=A.wingBend([0,0,0],P.getX(j),P.getY(j),P.getZ(j),B.getX(j),B.getY(j),B.getZ(j),V.getX(j),V.getY(j),V.getZ(j),V.getW(j),[w.fe,w.fw,w.fs,w.ff]);
  const r=Math.hypot(...p);maxTip=Math.max(maxTip,r);minTip=Math.min(minTip,r);if(p.some(v=>!Number.isFinite(v))||p[0]<.35||r>2.55)badTip++;
 }
}
check('Both real wing tips keep their shoulder clearance and bounded feather envelope',badTip===0,{maxTip,minTip,badTip});
let drawErrors=0,maxRootStep=0,bankReaction=0;
for(const hz of [30,60,120]){
 const actor={x:0,y:0,z:0,ry:0,g:0,ph:.3,wp:0,we:0,hat:0,clo:0,gls:0,jb:0,jt:2,me:true},old=[];
 for(let i=0;i<hz*5;i++){
  const u=i/hz,jump=u>=1&&u<3.7;actor.x=u<1?u*5:5;actor.air=jump;actor.run=u<1;actor.mv=u<1;actor.glide=u>=2&&u<3.5;
  actor.y=jump?Math.sin((u-1)/2.7*Math.PI)*3:0;actor.vy=jump?Math.cos((u-1)/2.7*Math.PI)*3:0;
  actor.take=u>=1&&u<1.12?1.12-u:0;actor.land=u>=3.7&&u<3.92?3.92-u:0;actor.ry=actor.glide?Math.sin((u-2)*2)*.7:0;
  A.drawSheep([actor],20+u,40,()=>0x88aabb,1);
  const mesh=A.meshes.wing1,m=new THREE.Matrix4();if(mesh.count!==2)drawErrors++;
  for(let wi=0;wi<2;wi++){mesh.getMatrixAt(wi,m);if(!m.elements.every(Number.isFinite))drawErrors++;
   const root=new THREE.Vector3().setFromMatrixPosition(m).sub(new THREE.Vector3(actor.x,actor.y,actor.z));if(old[wi])maxRootStep=Math.max(maxRootStep,root.distanceTo(old[wi]));old[wi]=root;
  }
  if(actor.wtip&&actor.glide)bankReaction=Math.max(bankReaction,Math.abs(actor.wtip[1]-actor.wtip[7]));
 }
}
check('Actual avatar integration stays smooth during run, takeoff, glide turn and landing at 30/60/120 Hz',drawErrors===0&&maxRootStep<.2&&bankReaction>.015,{drawErrors,maxRootStep,bankReaction});
console.log(`${checks.filter(Boolean).length}/${checks.length} wing motion checks passed; rendered motion is checked separately.`);
process.exitCode=checks.every(Boolean)?0:1;
