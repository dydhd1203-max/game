import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
const context=new Function('source','THREE','vm',load+'\nreturn context;')(source,THREE,vm),A=context.API;
const matrix=(m,i=0)=>{const r=new THREE.Matrix4();m.getMatrixAt(i,r);return r;};
const samples=new WeakMap();function points(mesh){if(samples.has(mesh))return samples.get(mesh);const g=mesh.geometry,p=g.attributes.position,ps=[];for(let i=0;i<p.count;i++)ps.push(new THREE.Vector3().fromBufferAttribute(p,i));for(let i=0;i<(g.index?.count||p.count);i+=3){const v=new THREE.Vector3();for(let j=0;j<3;j++)v.add(ps[g.index?g.index.getX(i+j):i+j]);ps.push(v.multiplyScalar(1/3));}samples.set(mesh,ps);return ps;}
function overlap(mesh,i,target,j=0){const m=matrix(target,j).invert().multiply(matrix(mesh,i));return points(mesh).some(p=>{const v=p.clone().applyMatrix4(m);return Math.abs(v.x)<.495&&Math.abs(v.y)<.495&&Math.abs(v.z)<.495;});}
const actor=x=>({x:0,y:0,z:0,ry:Math.PI,ph:0,wp:0,we:0,jb:0,jt:1,...x});
function draw(s,t=10){const g=A.sheepGait(s,t);if(s.mv){g.v=s.run?8:4;g.vx=Math.sin(s.dir||0)*g.v;g.vz=Math.cos(s.dir||0)*g.v;}A.drawSheep([s],t,40,()=>0x67a7cb,.7);}
const bad={};let frames=0;
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++)for(const run of [false,true])for(let dir=0;dir<8;dir++)for(let step=0;step<24;step++){
 draw(actor({jb,jt,mv:true,run,dir:dir*Math.PI/4,gp:step*Math.PI/12}));frames++;
 for(const [key,mesh]of Object.entries(A.P_jobParts))for(let i=0;i<4;i++)for(let j=0;j<mesh.count;j++)if(overlap(mesh,j,A.meshes.arm,i)){const k=[jb,jt,key,i,j].join(':');bad[k]=(bad[k]||0)+1;}
}
const checks=[];function check(name,pass,data){checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));}
check('2,304 eight-direction walking/running poses keep all shoulder surfaces outside both upper and lower arms',Object.keys(bad).length===0,{frames,bad});
const armAim={},headAim={},gunAim={};let aimFrames=0;
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++)for(const wp of [0,1,2,3,5,11,19])for(const pose of [{},{kick:1},{mv:true,run:true},{air:true,vy:5},{air:true,glide:true,vy:-2},{air:true,flip:.35}]){
 draw(actor({jb,jt,wp,...pose}));aimFrames++;
 for(const [key,m]of Object.entries(A.P_jobParts)){const rows=A.JOB_LOOK[jb][jt-1].filter(h=>h[12]===key);for(let j=0;j<m.count;j++){if(!rows[j]?.[13])continue;
  for(let i=0;i<4;i++)if(overlap(m,j,A.meshes.arm,i)){const k=[jb,jt,wp,key,i].join(':');armAim[k]=(armAim[k]||0)+1;}
  if(overlap(m,j,A.meshes.head)){const k=[jb,jt,wp,key].join(':');headAim[k]=(headAim[k]||0)+1;}
  if(wp>0)for(let i=0;i<A.meshes.gun.count;i++)if(overlap(m,j,A.meshes.gun,i)){const k=[jb,jt,wp,key,i].join(':');gunAim[k]=(gunAim[k]||0)+1;}
 }}
}
check('252 idle/aim/fire/air/flip combinations keep every shoulder part outside arms, head and held weapons',Object.keys(armAim).length===0&&Object.keys(headAim).length===0&&Object.keys(gunAim).length===0,{aimFrames,armAim,headAim,gunAim});
const geo=Object.fromEntries(Object.keys(A.JOB_GEO).filter(k=>k.startsWith('armor')).map(k=>[k,(A.JOB_GEO[k].index?.count||A.JOB_GEO[k].attributes.position.count)/3]));
check('Five shared armor geometries have at most 300 triangles each and finite vertices',Object.keys(geo).length===5&&Object.values(geo).every(n=>n<=300)&&Object.values(A.JOB_GEO).every(g=>g.attributes.position.array.every(Number.isFinite)),geo);
const ray=new THREE.Raycaster(),shell=new THREE.Mesh(A.JOB_GEO.armorShellR||A.JOB_GEO.armorShell,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));shell.updateMatrixWorld();const gaps=[];
for(const x of [.15,.2]){ray.set(new THREE.Vector3(x,-.8,0),new THREE.Vector3(0,1,0));const hit=ray.intersectObject(shell).map(p=>p.distance).filter((v,i,a)=>i===0||v-a[i-1]>.0001);gaps.push(hit);}
check('Shoulder shell has a real open underside and separated inner/outer roof',gaps.every(g=>g.length===2&&g[0]>.7&&g[1]-g[0]>.05),gaps);
const crowds=[];for(let jb=0;jb<3;jb++){const actors=Array.from({length:21},(_,i)=>actor({x:i*.7,jb,jt:2}));A.drawSheep(actors,20,21,()=>0xffffff,.7);crowds.push({jb,banks:Object.fromEntries(Object.entries(A.P_jobParts).filter(([,m])=>m.count).map(([k,m])=>[k,{count:m.count,cap:m.count_max}]))});}
check('21 matching second-promotion outfits fit all shared banks',crowds.every(c=>Object.values(c.banks).every(b=>b.count<=b.cap)),crowds);
const out=path.resolve('artifacts/race79/shoulder-art');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify({checks},null,2));assert.ok(checks.every(c=>c.pass));
