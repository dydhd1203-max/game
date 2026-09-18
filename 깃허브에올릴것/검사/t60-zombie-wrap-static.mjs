// Actual zombie bandage geometry and attachment checks; no browser or input devices.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
const harness=fs.readFileSync(path.join(here,'t54-zombie-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const results=[];'));
const A=new Function('source','THREE','vm',load+'\nreturn A;')(source,THREE,vm);
const checkList=[],check=(name,pass,detail)=>{checkList.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const actor=(extra={})=>({k:0,x:0,y:0,z:0,ry:0,id:2,ph:.3,hp:40,mx:40,mv:false,atkT:0,hurt:0,...extra});
const wrap=A.meshes.W_wrap,g=wrap.geometry,P=g.attributes.position;
const mat=(mesh,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;};
const tris=g.index.count/3;
g.computeBoundingBox();
check('Bandage geometry stays inside the normalized unit bounds with a small fixed triangle budget',g.boundingBox.min.toArray().every(v=>v>=-.500001)&&g.boundingBox.max.toArray().every(v=>v<=.500001)&&tris<=400,{triangles:tris});
let finite=true;for(const k of ['position','normal'])finite&&=Array.from(g.attributes[k].array).every(Number.isFinite);
const edges=new Map();for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){
  const a=g.index.getX(i+j),b=g.index.getX(i+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1);
}
check('Curved cloth is a finite watertight ribbon, including its thin upper and lower edges',finite&&Array.from(edges.values()).every(n=>n===2));
const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();const ray=new THREE.Raycaster();
ray.set(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0));const hole=ray.intersectObject(mesh).length;
let around=0;for(let i=0;i<24;i++){const a=i*Math.PI/12,dir=new THREE.Vector3(Math.sin(a),0,Math.cos(a));ray.set(dir.clone().multiplyScalar(2),dir.clone().negate());if(ray.intersectObject(mesh).length>=4)around++;}
check('Bandages wrap all the way around while leaving the center open for the body',hole===0&&around===24,{holeHits:hole,wrappedDirections:around});
const rags=A.ZOMBIE_NIGHT.indexOf('rags');if(rags<0)throw Error('No bandage night');A.G.nk=rags;
function snapshot(extra={}){A.drawWolves([actor(extra)],4,.016);return {head:mat(A.meshes.W_head,0),body:mat(A.meshes.W_body,0),arm:mat(A.meshes.W_legs,1),wrap:Array.from({length:wrap.count},(_,i)=>mat(wrap,i)),costume:A.meshes.W_costume.count};}
const baseline=snapshot(),poses=[baseline,snapshot({atkT:.07,poseAtkT:.1,poseAtkCd:.85}),snapshot({atkT:.85,poseAtkT:.1,poseAtkCd:.85}),snapshot({mv:true,gv:6,lx:0,lz:-.1,gp:1.2,shT:true,poseChase:1,posePreyWas:true}),snapshot({ry:1.2,dead:.3})];
check('Bandage theme uses exactly four broad layers and removes the old hanging patches',poses.every(p=>p.wrap.length===4&&p.costume===15),{layers:baseline.wrap.length,costumePieces:baseline.costume});
let drift=0;for(const p of poses)for(let i=0;i<4;i++){
  const owner=i===0?'head':i===3?'arm':'body';
  const a=baseline[owner].clone().invert().multiply(baseline.wrap[i]),b=p[owner].clone().invert().multiply(p.wrap[i]);
  drift=Math.max(drift,...a.elements.map((v,j)=>Math.abs(v-b.elements[j])));
}
check('Head, torso, and arm bands remain rigidly attached during attacks, chase, and falling',drift<1e-5,{maximumLocalMatrixDrift:drift});
const headLocal=baseline.head.clone().invert().multiply(baseline.wrap[0]);
let foreheadMin=Infinity;for(let i=0;i<P.count;i++)foreheadMin=Math.min(foreheadMin,new THREE.Vector3().fromBufferAttribute(P,i).applyMatrix4(headLocal).y);
check('Forehead wrap leaves both eyes and mouth below its lower edge',foreheadMin>.20,{headNormalizedLowerEdge:foreheadMin});
const worldBand=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));let coverage=0;
for(const [i,owner] of [[0,'head'],[1,'body'],[2,'body']]){
  const local=baseline[owner].clone().invert().multiply(baseline.wrap[i]);worldBand.matrixAutoUpdate=false;worldBand.matrix.copy(local);worldBand.updateMatrixWorld(true);
  const center=new THREE.Vector3().setFromMatrixPosition(local);
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const dir=new THREE.Vector3(Math.sin(a),0,Math.cos(a));ray.set(center.clone().addScaledVector(dir,2),dir.clone().negate());if(ray.intersectObject(worldBand).length>=4)coverage++;}
}
check('Actual forehead and torso transforms retain cloth on the front, back, and both sides',coverage===12,{coveredSides:coverage});
A.drawWolves(Array.from({length:92},(_,i)=>actor({id:i,x:i*.1})),4,.016);
check('All 92 bandage zombies retain every wrap without overflowing their shared buffer',wrap.count===368&&wrap.count===wrap.count_max,{count:wrap.count,capacity:wrap.count_max});
A.G.nk=A.ZOMBIE_NIGHT.findIndex(n=>n!=='rags');A.drawWolves([actor()],4,.016);
check('A later non-bandage frame clears the previous wrap instances',wrap.count===0);
const exported=source.match(/좀비:\[([^\]]+)\],\s*농장:/)?.[1].replace(/\s+/g,'').split(',');
check('Gallery body/head indices and the final four effect meshes stay compatible',exported?.[0]==='W_body'&&exported?.[3]==='W_head'&&exported?.at(-5)==='W_wrap'&&exported?.slice(-4).join(',')==='W_heal,W_beam,W_dread,W_aura');
console.log(`${checkList.filter(Boolean).length}/${checkList.length} zombie wrap checks passed. WebGL appearance is reviewed separately.`);
process.exitCode=checkList.every(Boolean)?0:1;
