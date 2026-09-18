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
 return Object.fromEntries(Object.entries(A.meshes).map(([k,mesh])=>[k,Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;})]));}
const base=draw(actor()),one=draw(actor({jt:1,jb:0})),two=draw(actor({jt:2,jb:0}));
ok('Job advancement never enlarges body, head, arms, legs or shoes',['body','head','arm','legs','shoes'].every(k=>base[k].every((m,i)=>scale(m).distanceTo(scale(one[k][i]))<1e-7&&scale(m).distanceTo(scale(two[k][i]))<1e-7)));
const local=(p,m)=>p.body[0].clone().invert().multiply(m),poses=[{}, {mv:true,run:true,gp:1.4},{act:'mine',actP:.30,tool:'mine'},{act:'mine',actP:.56,tool:'mine'},{wp:3,kick:1},{land:.20}].map(e=>draw(actor({jb:0,jt:2,clo:1,...e}),10,!!e.mv));
let mountError=0,clothError=0;
for(const p of poses.slice(1)){
 for(let i=0;i<2;i++)mountError=Math.max(mountError,position(local(p,p.wing1[i])).distanceTo(position(local(poses[0],poses[0].wing1[i]))));
 const a=local(p,p.deco[0]).elements,b=local(poses[0],poses[0].deco[0]).elements;clothError=Math.max(clothError,...a.map((v,i)=>Math.abs(v-b[i])));
}
ok('Wing roots remain rigidly attached to the torso during running, work, recoil and landing',mountError<1e-6,{mountError});
ok('Torso clothing shares the body lean, breath and landing transform',clothError<1e-6,{clothError});
let jobMountError=0;
for(const p of poses.slice(1))for(let j=0;j<A.JOB_LOOK[0][1].length;j++){
 const row=A.JOB_LOOK[0][1][j];if(row[7]||row[8])continue;
 const idx=A.CLOTHES[1].length+j;
 jobMountError=Math.max(jobMountError,position(local(p,p.deco[idx])).distanceTo(position(local(poses[0],poses[0].deco[idx]))));
}
ok('Authored torso job pieces keep their body-local mounting points',jobMountError<1e-6,{jobMountError});
function wingBounds(p){const box=new THREE.Box3(),inv=p.body[0].clone().invert();let inside=0;
 for(const key of ['wing0','wing1'])for(const m of p[key]){const full=inv.clone().multiply(m),geo=A.meshes[key].geometry.attributes.position;
  for(let i=0;i<geo.count;i++){const v=new THREE.Vector3().fromBufferAttribute(geo,i).applyMatrix4(full);box.expandByPoint(v);if(Math.abs(v.x)<.48&&Math.abs(v.y)<.48&&Math.abs(v.z)<.48)inside++;}}
 return {width:box.max.x-box.min.x,front:box.max.z,inside};}
const idle=wingBounds(draw(actor({jt:2,jb:0}))),aim=wingBounds(draw(actor({jt:2,jb:0,me:true,aim:true,wp:3}))),other=wingBounds(draw(actor({jt:2,jb:0,me:false,aim:true,wp:3}))),flight=wingBounds(draw(actor({jt:2,jb:0,air:true,glide:true,vy:-2})));
ok('Own aimed wings fold behind the back while flight keeps a wider span',aim.width<flight.width*.55&&aim.width<idle.width&&aim.front<-.45,{idle,aim,flight});
ok('Other players keep their visible ground wings instead of being hidden by local aim',Math.abs(other.width-idle.width)<1e-6&&other.width>.4,{otherWidth:other.width});
ok('Folded wings never cut through the torso volume',poses.every(p=>wingBounds(p).inside===0)&&aim.inside===0);
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
