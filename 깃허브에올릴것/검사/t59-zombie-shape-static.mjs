// Actual-source zombie geometry, face clearance, material, and crowd triangle checks. No browser.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
const harness=fs.readFileSync(path.join(here,'t54-zombie-static.mjs'),'utf8');
let load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const results=[];'));
if(!load.includes('globalThis.A={G,'))throw Error('Zombie source loader export changed');
load=load.replace('globalThis.A={G,','globalThis.A={ZOMBIE_GEO,ZOMBIE_MAT,RB,RBs,FM,G,');
const A=new Function('source','THREE','vm',load+'\nreturn A;')(source,THREE,vm);
const checks=[],check=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const triangles=g=>(g.index?.count||g.attributes.position.count)/3;
const point=(g,i)=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,i);
let finite=true,bounds=true,normals=true,outward=true,nondegenerate=true;
const budgets={};
for(const [name,g] of Object.entries(A.ZOMBIE_GEO)){
  g.computeBoundingBox();budgets[name]=triangles(g);
  finite&&=['position','normal'].every(k=>Array.from(g.attributes[k].array).every(Number.isFinite));
  bounds&&=g.boundingBox.min.toArray().every(v=>v>=-.500001)&&g.boundingBox.max.toArray().every(v=>v<=.500001);
  let volume=0;
  for(let i=0;i<g.attributes.normal.count;i++){
    const n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i);normals&&=Math.abs(n.length()-1)<1e-5;
  }
  for(let i=0;i<g.index.count;i+=3){
    const a=point(g,g.index.getX(i)),b=point(g,g.index.getX(i+1)),c=point(g,g.index.getX(i+2));
    const n=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a));
    nondegenerate&&=n.lengthSq()>1e-12;volume+=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
    if(Math.abs(a.y-b.y)<1e-6&&Math.abs(a.y-c.y)<1e-6&&Math.abs(a.y)>.499)outward&&=n.y*a.y>0;
  }
  outward&&=volume>.05;
}
check('Every organic mesh remains finite inside the original unit box',finite&&bounds);
check('Surfaces have normalized normals, outward caps, and no zero-area triangles',normals&&outward&&nondegenerate);
check('Seven shared organic shapes have bounded indexed geometry',Object.keys(budgets).length===7&&Object.values(budgets).every(n=>n<=400),budgets);
const slice=(g,y,t=.025)=>Array.from({length:g.attributes.position.count},(_,i)=>point(g,i)).filter(v=>Math.abs(v.y-y)<t);
const width=(g,y,t)=>Math.max(...slice(g,y,t).map(v=>Math.abs(v.x)));
const skull=A.ZOMBIE_GEO.skull,torso=A.ZOMBIE_GEO.torso;
check('Skull jaw is narrower than cheekbones and crown tapers into a rounded back',width(skull,-.43)<width(skull,-.05)*.7&&width(skull,.46)<width(skull,-.05)*.65&&slice(skull,.17).some(v=>v.z<-.49));
check('Torso has a narrow waist, broad shoulders, and a deeper upper back',width(torso,-.32)<width(torso,.32,.04)*.73&&Math.min(...slice(torso,.32,.04).map(v=>v.z))<Math.min(...slice(torso,-.32).map(v=>v.z))-.15);
const tp=Array.from({length:torso.attributes.position.count},(_,i)=>point(torso,i));
const left=tp.find(v=>v.x<-.49),right=tp.find(v=>v.x>.49);
check('Shoulders have a small readable asymmetric slope',left&&right&&Math.abs(left.y-right.y)>.04&&Math.abs(left.y-right.y)<.09);
check('Limbs and palms taper toward their ends instead of forming straight blocks',width(A.ZOMBIE_GEO.limb,-.5)<width(A.ZOMBIE_GEO.limb,.28)*.65&&width(A.ZOMBIE_GEO.palm,.5)<width(A.ZOMBIE_GEO.palm,-.08)*.65);
const head=new THREE.Mesh(skull,new THREE.MeshBasicMaterial());head.scale.set(.62,.65,.51);head.updateMatrixWorld();
const ray=new THREE.Raycaster(),frontAt=(x,y)=>{ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));return ray.intersectObject(head,false)[0]?.point.z;};
const eyeSamples=[-.135,.135].flatMap(x=>[-.025,0,.025].map(dx=>({x:x+dx,y:.074,z:.284})));
const mouthSamples=[-.08,0,.08].map(x=>({x,y:-.13,z:.2885}));
const margins=[...eyeSamples,...mouthSamples].map(v=>v.z-frontAt(v.x,v.y));
check('Existing eyes and mouth remain in front of the new skull surface',margins.every(v=>Number.isFinite(v)&&v>.015&&v<.075),{min:Math.min(...margins),max:Math.max(...margins)});
const mapping={W_body:'torso',W_head:'skull',W_legs:'limb',W_paw:'palm',W_ears:'ear',W_snout:'soft',W_tail:'taper',W_chest:'soft',W_ruff:'soft',W_belly:'soft',W_cheek:'soft',W_costume:'soft'};
check('All body, face, sleeve, and costume meshes use dedicated organic shapes',Object.entries(mapping).every(([m,g])=>A.meshes[m].geometry===A.ZOMBIE_GEO[g]&&A.meshes[m].geometry!==A.RB));
check('Armor retains its original hard plate geometry',A.meshes.W_plate.geometry===A.RB);
check('Zombie materials preserve instance colors without multiplying a dark shared base',Object.values(A.ZOMBIE_MAT).every(m=>m.color.getHex()===0xffffff)&&Object.keys(mapping).every(n=>Object.values(A.ZOMBIE_MAT).includes(A.meshes[n].material)));
check('Shared animal and human fur materials remain unchanged',A.FM.fur.color.getHex()===0x8a8c93&&A.FM.furD.color.getHex()===0x4d4f57);
const capacities={W_body:1,W_head:1,W_snout:1,W_tail:3,W_legs:8,W_eyes:2,W_ears:2,W_chest:1,W_paw:4,W_horn:2,W_nose:1,W_ruff:1,W_belly:1,W_brow:2,W_cheek:2,W_rib:10,W_plate:36,W_gem:1,W_eyeW:2,W_eyeR:2,W_pupil:2,W_fang:5,W_costume:64};
check('Geometry changes do not expand per-zombie instance capacities',Object.entries(capacities).every(([n,c])=>A.meshes[n].count_max===92*c));
const army=Array.from({length:92},(_,i)=>({k:0,x:i*.1,y:0,z:0,ry:0,id:i,ph:.3,hp:40,mx:40,mv:false,atkT:0,hurt:0}));
let maxOrganic=0,maxPrevious=0;
for(let nk=0;nk<10;nk++){A.G.nk=nk;A.drawWolves(army,4,.016);let actual=0,previous=0;
  for(const name of Object.keys(mapping)){const m=A.meshes[name];actual+=m.count*triangles(m.geometry);
    previous+=m.count*triangles(['W_ears','W_cheek'].includes(name)?A.RBs:A.RB);}
  maxOrganic=Math.max(maxOrganic,actual);maxPrevious=Math.max(maxPrevious,previous);
}
check('Organic body and costume triangles stay below the previous box crowd budget',maxOrganic<maxPrevious&&maxOrganic<750000,{zombies:92,maxOrganic,maxPrevious,ratio:+(maxOrganic/maxPrevious).toFixed(3)});
console.log(`${checks.filter(Boolean).length}/${checks.length} zombie shape checks passed. This measures geometry, not device GPU performance.`);
process.exitCode=checks.every(Boolean)?0:1;
