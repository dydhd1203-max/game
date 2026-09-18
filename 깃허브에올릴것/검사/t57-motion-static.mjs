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
function pose(s,t=10){const gs=A.sheepGait(s,t);if(s.mv)gs.v=s.run?8:4;A.drawSheep([s],t,40,()=>0x67a7cb,1);
 return Object.fromEntries(Object.entries(A.meshes).map(([k,mesh])=>[k,Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;})]));}
function bottom(matrix,geometry=A.meshes.shoes.geometry){const p=geometry.attributes.position;let lo=Infinity;for(let i=0;i<p.count;i++)lo=Math.min(lo,new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix).y);return lo;}
const idle=pose(actor());
check('A person has two articulated arms, two articulated legs and two shoes',idle.arm.length===4&&idle.legs.length===4&&idle.shoes.length===2);
check('Neutral shoes touch the floor and knees remain nearly straight',idle.shoes.every(m=>Math.abs(bottom(m))<.006)&&new THREE.Vector3(0,1,0).transformDirection(idle.legs[0]).y>.99);
let joins=0,footMin=Infinity,contact=0,planted=0,heelLift=0;
for(const run of [false,true])for(let i=0;i<96;i++){
 const gp=i/96*Math.PI*2,p=pose(actor({mv:true,run,gp}));
 for(let side=0;side<2;side++){
  joins=Math.max(joins,point(p.legs[side*2],0,-.5,0).distanceTo(point(p.legs[side*2+1],0,.5,0)));
  const low=bottom(p.shoes[side]);footMin=Math.min(footMin,low);heelLift=Math.max(heelLift,low);
  if(A.sheepFootPose(gp+(side?Math.PI:0),run).plant){planted++;if(Math.abs(low)<.045)contact++;}
 }
}
check('Thigh and shin share the same knee throughout walking and running',joins<1e-6,{worstJointGap:joins});
check('Feet never penetrate ground through complete gait cycles',footMin>-.008,{lowestShoe:footMin});
check('Support feet stay grounded while swing feet visibly clear the floor',contact===planted&&heelLift>.16,{contact,planted,swingClearance:heelLift});
let continuity=0,prior=null;
for(let i=0;i<=240;i++){const p=pose(actor({mv:true,run:true,gp:i/240*Math.PI*2}));if(prior)for(let j=0;j<2;j++)continuity=Math.max(continuity,pos(p.shoes[j]).distanceTo(pos(prior.shoes[j])));prior=p;}
check('Toe off and heel contact have continuous foot trajectories',continuity<.035,{worstFrameStep:continuity});
const walk=pose(actor({mv:true,run:false,gp:0}));
check('Arms counter-swing against the leg on the same side',pos(walk.handL[0]).z<0&&pos(walk.shoes[0]).z>0&&pos(walk.handR[0]).z>0&&pos(walk.shoes[1]).z<0);
const moving=actor({mv:true,run:false,gp:.1});pose(moving,30);let anchor,drift=0;
for(let i=1;i<=12;i++){moving.z=i/120*2;moving.gp=.1+moving.z/1.3*Math.PI*2;const p=pose(moving,30+i/120),foot=pos(p.shoes[0]);
 if(i===2)anchor=foot;if(i>2)drift=Math.max(drift,Math.hypot(foot.x-anchor.x,foot.z-anchor.z));}
check('A planted foot holds its world position during forward travel',drift<.012,{plantedWorldDrift:drift});
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
