// Regressions for diagonal limb overlap, head/brim intersections and long guns.
// Execute the actual source geometry and animation, including shadow setup.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API')).replace('shadow:false','shadow:true');
const context=new Function('source','THREE','vm',load+'\nreturn context;')(source,THREE,vm);
const A=context.API,checks=[];
const check=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const actor=extra=>({x:0,y:0,z:0,ry:Math.PI,ph:0,wp:0,we:0,jb:-1,jt:0,...extra});
const matrix=(mesh,i=0)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;};
const samples=new WeakMap();
function points(mesh){
 if(samples.has(mesh))return samples.get(mesh);
 const g=mesh.geometry,p=g.attributes.position,ps=[];
 for(let i=0;i<p.count;i++)ps.push(new THREE.Vector3().fromBufferAttribute(p,i));
 // Triangle centers also catch a long barrel whose endpoints miss the torso.
 for(let i=0;i<(g.index?.count||p.count);i+=3){
  const v=new THREE.Vector3();for(let j=0;j<3;j++)v.add(ps[g.index?g.index.getX(i+j):i+j]);ps.push(v.multiplyScalar(1/3));
 }
 samples.set(mesh,ps);return ps;
}
function boxOverlap(mesh,i,target,j=0){
 const m=matrix(target,j).invert().multiply(matrix(mesh,i));
 return points(mesh).some(p=>{const v=p.clone().applyMatrix4(m);return Math.abs(v.x)<.495&&Math.abs(v.y)<.495&&Math.abs(v.z)<.495;});
}
function draw(s,t=10,scale=1){
 const g=A.sheepGait(s,t);
 if(s.mv){g.v=s.run?8:4;g.vx=Math.sin(s.dir||0)*g.v;g.vz=Math.cos(s.dir||0)*g.v;}
 A.drawSheep([s],t,40,()=>0x67a7cb,scale);
}
let armClips=0,legClips=0,frames=0;
for(const scale of [.7,.9,1,1.5])for(const run of [false,true])for(let dir=0;dir<8;dir++)for(let step=0;step<48;step++){
 draw(actor({mv:true,run,dir:dir*Math.PI/4,gp:step*Math.PI/24}),10,scale);frames++;
 for(let i=0;i<4;i++)armClips+=boxOverlap(A.meshes.arm,i,A.meshes.body)?1:0;
 for(const [i,j] of [[0,2],[0,3],[1,2],[1,3]])legClips+=boxOverlap(A.meshes.legs,i,A.meshes.legs,j)||boxOverlap(A.meshes.legs,j,A.meshes.legs,i)?1:0;
}
check('Eight-direction walking and sprinting keep arms outside the torso',armClips===0,{frames,armClips});
check('Opposite legs never pass through one another during side and diagonal steps',legClips===0,{frames,legClips});
let movingClips=0,movingFrames=0;
for(const fps of [30,60,120])for(const dir of [Math.PI/4,-Math.PI/4,Math.PI*3/4,-Math.PI*3/4]){
 const s=actor({mv:true,run:true,dir});draw(s,0,.7);
 for(let i=1;i<=fps*2;i++){
  const t=i/fps;s.x=Math.sin(dir)*t*8;s.z=Math.cos(dir)*t*8;draw(s,t,.7);movingFrames++;
  for(let j=0;j<4;j++)movingClips+=boxOverlap(A.meshes.arm,j,A.meshes.body)?1:0;
  for(const [j,k] of [[0,2],[0,3],[1,2],[1,3]])movingClips+=boxOverlap(A.meshes.legs,j,A.meshes.legs,k)||boxOverlap(A.meshes.legs,k,A.meshes.legs,j)?1:0;
 }
}
check('Continuous diagonal travel stays clear at actual game scale and 30/60/120 Hz',movingClips===0,{movingFrames,movingClips});
// Load the current picker data, including post-declaration pajama replacements.
// The former harness silently checked retired clothing instead of these panels.
const clothes=vm.runInContext('DRESS_OPTIONS.clo',context);
let clothingClips=0,accessoryClips=0,clothingFrames=0,accessoryFrames=0;
for(const clo of clothes)for(const run of [false,true])for(let dir=0;dir<8;dir++)for(let step=0;step<24;step++){
 draw(actor({clo,mv:true,run,dir:dir*Math.PI/4,gp:step*Math.PI/12}),10,.7);clothingFrames++;
 for(let i=0;i<4;i++)for(let j=0;j<A.meshes.deco.count;j++)
  clothingClips+=boxOverlap(A.meshes.deco,j,A.meshes.arm,i)||boxOverlap(A.meshes.arm,i,A.meshes.deco,j)?1:0;
}
check('All eight current outfits stay outside both arm swing paths',clothes.length===8&&clothingClips===0,{clothingFrames,clothingClips});
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++)for(const run of [false,true])for(let dir=0;dir<8;dir++)for(let step=0;step<24;step++){
 draw(actor({jb,jt,mv:true,run,dir:dir*Math.PI/4,gp:step*Math.PI/12}),10,.7);accessoryFrames++;
 for(const mesh of [A.meshes.deco,...Object.values(A.P_jobParts)])for(let i=0;i<4;i++)for(let j=0;j<mesh.count;j++)
  accessoryClips+=boxOverlap(mesh,j,A.meshes.arm,i)?1:0;
}
check('All six job outfits keep belt pouches and shoulder badges clear of arms',accessoryClips===0,{accessoryFrames,accessoryClips});
let tintMismatch=0;
for(const clo of [2,4,6,8]){
 draw(actor({clo}));const color=new THREE.Color();A.meshes.body.getColorAt(0,color);
 tintMismatch+=color.getHex()!==vm.runInContext(`CLOTH_BODY[${clo}]`,context)?1:0;
}
check('Pajama colors are applied to the torso itself',tintMismatch===0,{tintMismatch});
let brimClips=0,brimGap=Infinity;
const poses=[{}, {mv:true,run:true,dir:Math.PI/4,gp:3.1}, {air:true,vy:5}, {air:true,vy:-3,glide:true}, {air:true,flip:.35}, {land:.22}];
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++)for(const pose of poses){
 draw(actor({jb,jt,...pose}));
 const inv=matrix(A.meshes.head).invert();
 for(const [key,mesh] of Object.entries(A.P_jobParts))if(key.endsWith('Brim')&&mesh.count){
  const m=inv.clone().multiply(matrix(mesh));
  for(const p of points(mesh)){const y=p.clone().applyMatrix4(m).y;brimGap=Math.min(brimGap,y-.5);if(y<=.5)brimClips++;}
 }
}
check('All job hat brims clear the head through running, jumps, flips and glide',brimClips===0&&brimGap>.02,{brimClips,brimGap});
// A raised brim alone can pass the preceding check while the crown floats above
// the skull. The rounded top must actually sit inside a closed, opaque crown.
const capMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const cast=new THREE.Raycaster(),rayDir=new THREE.Vector3(.371,1,.217).normalize();
let exposedCap=0,capSamples=0,capCases=0,hatDrift=0;
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++){
 let reference;
 for(const pose of poses){
  draw(actor({jb,jt,...pose}),10,.7);
  const crown=Object.entries(A.P_jobParts).find(([key,mesh])=>key.endsWith('Crown')&&mesh.count);
  if(!crown)continue; // First-tier inventor intentionally wears goggles only.
  capCases++;
  const cm=matrix(crown[1]),hm=matrix(A.meshes.head),local=hm.clone().invert().multiply(cm);
  if(reference)hatDrift=Math.max(hatDrift,...local.elements.map((v,i)=>Math.abs(v-reference[i])));
  else reference=local.elements.slice();
  const shape=new THREE.Mesh(crown[1].geometry,capMaterial),intoCap=cm.clone().invert().multiply(hm);
  shape.updateMatrixWorld(true);
  for(const p of points(A.meshes.head).filter(p=>p.y>=.48)){
   capSamples++;cast.set(p.clone().applyMatrix4(intoCap),rayDir);
   const distances=cast.intersectObject(shape).map(h=>h.distance).filter((d,i,a)=>!i||d-a[i-1]>1e-5);
   if(distances.length%2!==1||distances[0]<.01)exposedCap++;
  }
 }
}
capMaterial.dispose();
check('All five closed job hats enclose the skull cap with surface clearance',capCases===30&&exposedCap===0,{capCases,capSamples,exposedCap});
check('Hat crowns remain rigidly attached to the head across all motion poses',hatDrift<1e-5,{hatDrift});
const weaponCount=vm.runInContext('WEAPONS.length',context);let gunClips=0,gripError=0,gunCases=0;
for(let wp=1;wp<weaponCount;wp++)for(const kick of [0,.8,1.6])for(const scale of [.7,1.5])for(const pose of poses){
 draw(actor({wp,kick,we:6,jb:0,jt:2,...pose}),10,scale);gunCases++;
 for(let i=0;i<A.meshes.gun.count;i++)gunClips+=boxOverlap(A.meshes.gun,i,A.meshes.body)?1:0;
 const grip=new THREE.Vector3().setFromMatrixPosition(matrix(A.meshes.handR)).applyMatrix4(matrix(A.meshes.gun,2).invert());
 gripError=Math.max(gripError,Math.abs(grip.x),Math.abs(grip.z));
}
check('Every weapon stays outside the body at all recoil strengths and motion poses',gunClips===0,{gunCases,gunClips});
check('Weapon grip remains centered in the anatomical right hand',gripError<1e-4,{gripError});
// 65차 — 무기마다 부품 표(TPGUN)로 그린다. 들고 있는 동안(반동 0) 어떤 조각도 머리(둥근 기둥)에 들어가지 않는다.
// 쏠 때 잠깐 들리는 반동은 위의 몸통 검사가 모든 세기로 본다. +6 떨림(sh)까지 켠 채로 잰다.
function insideHead(mesh,i){const m=matrix(A.meshes.head).invert().multiply(matrix(mesh,i));
 return points(mesh).some(p=>{const v=p.clone().applyMatrix4(m);return Math.hypot(v.x,v.z)<.5&&Math.abs(v.y)<.5;});}
let headClips=0,headCases=0;
for(let wp=1;wp<weaponCount;wp++)for(const scale of [.7,1.5])for(const pose of poses){
 draw(actor({wp,we:6,jb:0,jt:2,...pose}),10,scale);headCases++;
 for(let i=0;i<A.meshes.gun.count;i++)headClips+=insideHead(A.meshes.gun,i)?1:0;
}
check('Every held weapon stays out of the head through running, jumps, flips, glide and landing',headClips===0,{headCases,headClips});
// imesh 정원은 최악 조합(그리는 사람 상한 40명 × 제일 많은 조각 · 빛 조각 + 강화 빛 2)으로 잡는다. 모자라면 오류 없이 잘린다.
const TPGUN=vm.runInContext('TPGUN',context),MAXP=vm.runInContext('MAXP',context);let capShort=[];
for(let wp=1;wp<weaponCount;wp++){
 A.drawSheep(Array.from({length:MAXP},(_,i)=>actor({x:i*2,wp,we:6})),10,MAXP,()=>0x67a7cb,1);
 if(A.meshes.gun.count!==MAXP*TPGUN[wp].r.length||A.meshes.gunGlow.count!==MAXP*(TPGUN[wp].g+2))capShort.push(wp);
}
check('Forty players holding any weapon at +6 fit the weapon part and glow capacities',capShort.length===0&&TPGUN.every(g=>!g||g.r.length<=14&&g.r.length>=8),
 {capShort,partCap:A.meshes.gun.count_max,glowCap:A.meshes.gunGlow.count_max,parts:TPGUN.map(g=>g?g.r.length:0)});
// Run the actual initialization block rather than checking for a name in a comment.
const start=source.indexOf('/* ★ 직업 옷·모자·소품'),end=source.indexOf('const JOB_UNIFORM',start);
if(start<0||end<start)throw Error('Missing avatar shadow setup');
vm.runInContext(source.slice(start,end),context);
check('Thin costume and face layers neither cast nor receive unstable self shadows',
 [A.meshes.deco,A.meshes.eyes,A.meshes.mouth,A.meshes.nose,...Object.values(A.P_jobParts)].every(m=>!m.castShadow&&!m.receiveShadow));
check('Solid avatar parts retain ground shadows without sampling their own shadow map',
 ['body','head','arm','handL','handR','legs','shoes','gun'].every(k=>A.meshes[k].castShadow&&!A.meshes[k].receiveShadow));
console.log(`${checks.filter(Boolean).length}/${checks.length} avatar clearance checks passed.`);
process.exitCode=checks.every(Boolean)?0:1;
