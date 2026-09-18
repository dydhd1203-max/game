// CPU-only audit of actual zombie attachment matrices. No browser or UI.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
const harness=fs.readFileSync(path.join(here,'t54-zombie-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const results=[];'));
const A=new Function('source','THREE','vm',load+'\nreturn A;')(source,THREE,vm);
const checks=[];
const check=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(detail));};
const actor=(k,extra={})=>({k,x:0,y:0,z:0,ry:0,id:2,ph:.3,hp:40,mx:40,mv:false,atkT:0,hurt:0,...extra});
function snapshot(k,extra){A.drawWolves([actor(k,extra)],4,.016);
 return Object.fromEntries(Object.entries(A.meshes).map(([name,mesh])=>[name,Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;})]));}
const cases=[{},
 {atkT:.07,poseAtkT:.10,poseAtkCd:.85},
 {atkT:.85,poseAtkT:.1,poseAtkCd:.85},
 {mv:true,gv:6,lx:0,lz:-.10,gp:1.2,shT:true,poseChase:1,posePreyWas:true},
 {ry:1.2,mv:true,gv:6,lx:-.10,lz:0,gp:2.1,shT:true,poseChase:1,posePreyWas:true}];
const localPosition=(p,name,i)=>new THREE.Vector3().setFromMatrixPosition(p[name][i]).applyMatrix4(p.W_body[0].clone().invert());
function audit(name,k,mesh,indices){const poses=cases.map(c=>snapshot(k,c)),baseline=poses[0];let localDrift=0;
 for(const p of poses.slice(1))for(const i of indices)localDrift=Math.max(localDrift,localPosition(p,mesh,i).distanceTo(localPosition(baseline,mesh,i)));
 check(name,localDrift<1e-5,{localDrift,instances:indices.length,poses:poses.length});}
audit('Torn shirt hem keeps its torso-local mounting point',0,'W_chest',[0]);
audit('Collar keeps its torso-local mounting point',0,'W_ruff',[0]);
audit('Belt keeps its torso-local mounting point',0,'W_belly',[0]);
audit('Hungry zombie ribs move with the leaning torso',8,'W_rib',[2,3,4,5]);
// Armor order: four shin plates, then 17 torso/shoulder plates, then helmet.
audit('Armored chest, back, skirt and shoulder pieces share the torso frame',9,'W_plate',Array.from({length:17},(_,i)=>i+4));
audit('Overalls and straps use the same torso frame as the shirt',2,'W_costume',[3,4,5,6]);
audit('Healer back gem stays mounted while its own shape rotates',10,'W_gem',[0]);
console.log(`${checks.filter(Boolean).length}/${checks.length} zombie attachment checks passed.`);
process.exitCode=checks.every(Boolean)?0:1;
