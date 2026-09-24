// Rig attachment and direction/transition checks execute source matrices only.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.resolve(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8'),load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
const A=new Function('source','THREE','vm',load+'\nreturn context.API;')(source,THREE,vm);
const checks=[],ok=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));};
const actor=e=>({x:0,y:0,z:0,ry:Math.PI,g:0,ph:0,wp:0,we:0,hat:0,gls:0,clo:0,jb:-1,jt:0,...e});
const position=m=>new THREE.Vector3().setFromMatrixPosition(m),scale=m=>new THREE.Vector3().setFromMatrixScale(m);
function draw(s,t=10,seed=false){const g=A.sheepGait(s,t);if(seed)g.v=s.run?8:4;A.drawSheep([s],t,40,()=>0x67a7cb,1);
 const snap=Object.fromEntries(Object.entries(A.meshes).map(([k,mesh])=>[k,Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;})]));
 // 66차 — 그 순간의 관절 굽힘 칸(wflex)도 같이 떠 둔다(뒤에 다른 자세를 그리면 덮인다)
 snap._flex=Object.fromEntries(['wing0','wing1'].map(k=>[k,Array.from(A.meshes[k].geometry.attributes.wflex?.array.slice(0,8)||[])]));
 return snap;}
const base=draw(actor()),one=draw(actor({jt:1,jb:0})),two=draw(actor({jt:2,jb:0}));
ok('Job advancement never enlarges body, head, arms, legs or shoes',['body','head','arm','legs','shoes'].every(k=>base[k].every((m,i)=>scale(m).distanceTo(scale(one[k][i]))<1e-7&&scale(m).distanceTo(scale(two[k][i]))<1e-7)));
const local=(p,m)=>p.body[0].clone().invert().multiply(m),actions=[{}, {mv:true,run:true,gp:1.4},{act:'mine',actP:.30,tool:'mine'},{act:'mine',actP:.56,tool:'mine'},{wp:3,kick:1},{land:.20}];
const poses=actions.map(e=>draw(actor({jb:0,jt:2,clo:1,...e}),10,!!e.mv));
const clothPoses=actions.map(e=>draw(actor({clo:1,...e}),10,!!e.mv));
let mountError=0,clothError=0;
for(const p of poses.slice(1)){
 for(let i=0;i<2;i++)mountError=Math.max(mountError,position(local(p,p.wing1[i])).distanceTo(position(local(poses[0],poses[0].wing1[i]))));
}
for(const p of clothPoses.slice(1)){
 const a=local(p,p.deco[0]).elements,b=local(clothPoses[0],clothPoses[0].deco[0]).elements;clothError=Math.max(clothError,...a.map((v,i)=>Math.abs(v-b[i])));
}
ok('Wing roots remain rigidly attached to the torso during running, work, recoil and landing',mountError<1e-6,{mountError});
ok('Torso clothing shares the body lean, breath and landing transform',clothError<1e-6,{clothError});
let jobMountError=0;
for(const p of poses.slice(1))for(let j=0;j<A.JOB_LOOK[0][1].length;j++){
 const row=A.JOB_LOOK[0][1][j];if(row[7]||row[8])continue;
 const key=A.JOB_GEO[row[12]]?'job_'+row[12]:'deco';
 const idx=A.JOB_LOOK[0][1].slice(0,j).filter(h=>(A.JOB_GEO[h[12]]?'job_'+h[12]:'deco')===key).length;
 jobMountError=Math.max(jobMountError,position(local(p,p[key][idx])).distanceTo(position(local(poses[0],poses[0][key][idx]))));
}
ok('Authored torso job pieces keep their body-local mounting points',jobMountError<1e-6,{jobMountError});
// 66차 — 날개는 꼭짓점 셰이더가 관절에서 굽힌다. 인스턴스 칸(wflex)에 적힌 굽힘값을 소스의 wingBend(셰이더와 같은 셈)로 꼭짓점에 입혀 잰다.
function wingBounds(p){const box=new THREE.Box3(),inv=p.body[0].clone().invert();let inside=0;
 for(const key of ['wing0','wing1'])p[key].forEach((m,n)=>{const full=inv.clone().multiply(m),G=A.meshes[key].geometry,geo=G.attributes.position,B=G.attributes.wbone,V=G.attributes.wpiv,F=p._flex&&p._flex[key],f=F&&F.length?[0,1,2,3].map(k=>F[n*4+k]):[0,0,0,0],o=[0,0,0];
  for(let i=0;i<geo.count;i++){if(B)A.wingBend(o,geo.getX(i),geo.getY(i),geo.getZ(i),B.getX(i),B.getY(i),B.getZ(i),V.getX(i),V.getY(i),V.getZ(i),V.getW(i),f);else o.splice(0,3,geo.getX(i),geo.getY(i),geo.getZ(i));
   const v=new THREE.Vector3(...o).applyMatrix4(full);box.expandByPoint(v);if(Math.abs(v.x)<.48&&Math.abs(v.y)<.48&&Math.abs(v.z)<.48)inside++;}});
 return {width:box.max.x-box.min.x,front:box.max.z,inside};}
const idle=wingBounds(draw(actor({jt:2,jb:0}))),aim=wingBounds(draw(actor({jt:2,jb:0,me:true,aim:true,wp:3}))),other=wingBounds(draw(actor({jt:2,jb:0,me:false,aim:true,wp:3}))),flight=wingBounds(draw(actor({jt:2,jb:0,air:true,glide:true,vy:-2})));
ok('Own aimed wings fold behind the back while flight keeps a wider span',aim.width<flight.width*.55&&aim.width<idle.width&&aim.front<-.45,{idle,aim,flight});
ok('Other players keep their visible ground wings instead of being hidden by local aim',Math.abs(other.width-idle.width)<1e-6&&other.width>.4,{otherWidth:other.width});
ok('Folded wings never cut through the torso volume',poses.every(p=>wingBounds(p).inside===0)&&aim.inside===0);
const flapChecks=[];
for(const jt of [1,2])for(const glide of [false,true]){
 const s=actor({jt,jb:0,air:true,glide,vy:-2}),key='wing'+(jt-1),rows=[];
 let fixedRoot=null,rootError=0,inside=0;
 const geo=A.meshes[key].geometry.attributes.position,tip=new THREE.Vector3();
 for(let i=0;i<geo.count;i++)if(geo.getX(i)>tip.x)tip.fromBufferAttribute(geo,i);
 for(let i=0;i<=160;i++){
  const p=draw(s,10+i/(1.75*80)),bp=new THREE.Vector3(),bq=new THREE.Quaternion(),bs=new THREE.Vector3();
  p.body[0].decompose(bp,bq,bs);
  const rigidInv=new THREE.Matrix4().compose(bp,bq,new THREE.Vector3(1,1,1)).invert();
  const wing=rigidInv.clone().multiply(p[key][0]),wp=new THREE.Vector3(),wq=new THREE.Quaternion(),ws=new THREE.Vector3();
  wing.decompose(wp,wq,ws);
  const root=position(local(p,p[key][0]));fixedRoot??=root.clone();rootError=Math.max(rootError,root.distanceTo(fixedRoot));
  rows.push({roll:new THREE.Euler().setFromQuaternion(wq,'YXZ').z,tip:tip.clone().applyMatrix4(wing).y});
  inside+=wingBounds(p).inside;
 }
 const range=k=>Math.max(...rows.map(r=>r[k]))-Math.min(...rows.map(r=>r[k]));
 flapChecks.push({jt,glide,rollRange:range('roll'),tipTravel:range('tip'),rootError,inside});
}
// 66차 — 날갯짓(점프 공중)은 여전히 크게 친다. 활공은 선생님 요청("실제 같은 모션")대로 날개를 활짝 편 채 천천히 오르내리는 미세 조정이다 —
// 멈춰 있지도(>.08), 날갯짓만큼 크지도(<.35) 않다. 깃 끝의 떨림은 관절 굽힘(t66-wing-static)이 따로 본다.
ok('Both wing tiers visibly flap through complete air cycles and soar with small adjustments while gliding',flapChecks.every(r=>r.glide?(r.rollRange>.08&&r.rollRange<.35&&r.tipTravel>.06):(r.rollRange>.74&&r.tipTravel>.25)),flapChecks);
ok('Flapping keeps shoulder roots fixed and feathers outside the torso for the full cycle',flapChecks.every(r=>r.rootError<1e-6&&r.inside===0));
const settledDown=[0,.19,.41,.77].map(dt=>draw(actor({jt:2,jb:0,down:true}),500+dt));
const downLocal=settledDown.map(p=>local(p,p.wing1[0]).elements);
ok('Downed wings remain still instead of continuing their flight or idle flap',downLocal.every(m=>m.every((v,i)=>Math.abs(v-downLocal[0][i])<1e-6)));
let glidePhaseJump=0;
for(const t of [0,10,1000,50000]){
 const a=A.avatarWingPose(1,{t,air:1,glide:0}),b=A.avatarWingPose(1,{t,air:1,glide:1e-5});
 glidePhaseJump=Math.max(glidePhaseJump,...['roll','pitch','yaw','span'].map(k=>Math.abs(a[k]-b[k])));
}
ok('Entering glide preserves flap phase even after a long play session',glidePhaseJump<1e-5,{glidePhaseJump});
const directional=(vx,vz)=>{const s=actor({mv:true,gp:0});const g=A.sheepGait(s,10);g.v=4;g.vx=vx;g.vz=vz;return draw(s);};
const strafe=directional(4,0),back=directional(0,-4);
ok('Strafing steps sideways while the torso remains facing the aiming direction',Math.abs(position(strafe.shoes[0]).x-position(strafe.shoes[1]).x)>.55&&Math.abs(position(strafe.shoes[0]).z-position(strafe.shoes[1]).z)<.10);
ok('Backpedaling reverses the forward step rather than playing a forward walk',position(back.shoes[0]).z<-.1&&position(back.shoes[1]).z>.1);
function transition(fps,kind){const s=actor({mv:kind==='run',run:false,gp:.8,tool:kind==='action'?'mine':'',air:kind==='land',vy:kind==='land'?-3:0});const g=A.sheepGait(s,0);g.v=kind==='run'?4:0;
 let prior=draw(s,0),peak=0,peakAt='',first=0,end=prior,previousZ=0,boneError=0;
 for(let i=1;i<=fps;i++){const t=i/fps;
  if(kind==='run'){s.run=t<.55;s.z=t*4;}
  if(kind==='startstop'){s.z=Math.min(t,.5)*4;s.mv=t<.5;delete s.gp;}
  if(kind==='action'){s.act=t<.72?'mine':'';s.actP=Math.min(1,t/.72);}
  if(kind==='land'){s.air=false;s.land=Math.max(0,.22-t);}
  end=draw(s,t);for(const key of ['body','head','handL','handR','shoes'])for(let j=0;j<end[key].length;j++){
    const a=position(end[key][j]),b=position(prior[key][j]);a.z-=s.z;b.z-=previousZ;const d=a.distanceTo(b);if(d>peak){peak=d;peakAt=key+j+'@'+t.toFixed(3);}if(i===1)first=Math.max(first,d);}
  end.arm.forEach((m,j)=>{boneError=Math.max(boneError,Math.abs(scale(m).y-A.R6_ARM[1]*(j%2?.34:.50)));});
  prior=end;previousZ=s.z;
 }
 return {peak,peakAt,first,boneError,hand:position(end.handR[0]).sub(new THREE.Vector3(0,0,s.z)).toArray(),runK:g.runK,moveK:g.moveK};}
const report={};for(const kind of ['run','startstop','action','land'])report[kind]=[30,60,120].map(fps=>({fps,...transition(fps,kind)}));
ok('Locomotion and landing have no large frame jump when inputs switch', ['run','startstop','land'].every(k=>report[k].every(r=>r.peak<.20&&r.first<.18)),report);
// A harvest strike deliberately moves faster than walking. Continuity is checked
// by its velocity across sample rates, rather than limiting the useful swing arc.
const strikeSpeeds=report.action.map(r=>r.peak*r.fps);
ok('Harvest strike remains continuous at the same swing speed across frame rates',Math.max(...strikeSpeeds)<9&&Math.max(...strikeSpeeds)-Math.min(...strikeSpeeds)<.5&&report.action.every(r=>r.first<.06),{strikeSpeeds});
ok('Smoothing never stretches or shortens the rigid arm segments',Object.values(report).flat().every(r=>r.boneError<1e-6));
let frequencyError=0;for(const rows of Object.values(report))for(let i=1;i<rows.length;i++)frequencyError=Math.max(frequencyError,new THREE.Vector3(...rows[0].hand).distanceTo(new THREE.Vector3(...rows[i].hand)));
ok('30, 60 and 120 Hz converge to the same smooth pose',frequencyError<.025,{frequencyError});
ok('Run blend settles back to walking and stopping relaxes movement pose',report.run.every(r=>r.runK<.02)&&report.startstop.every(r=>r.moveK<.04));
console.log(`${checks.filter(Boolean).length}/${checks.length} attachment and transition checks passed.`);process.exitCode=checks.every(Boolean)?0:1;
