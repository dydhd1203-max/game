// Execute the actual sculpted obstacle geometry and collision, independently
// probing the ground bypass, hollow hook and airborne broadphase boundaries.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const scan=harness.slice(harness.indexOf('function end('),harness.indexOf('const results=[];'));
const {fn,decl}=new Function('source',scan+';return {fn,decl};')(source);
const C=vm.createContext({THREE,console});
vm.runInContext(`const MINI_Y=100,PL={R:.3};${decl('M4')}\n${decl('RACE_TOY77')}\n`+
 ['raceToyForm77','raceToyHit77','racePunchHit','raceArtUV','raceArtMerge','raceArtPath','raceCandyGeometry77','raceToyGeometry77'].map(fn).join('\n')+
 '\nglobalThis.A={PL,RACE_TOY77,raceToyForm77,racePunchHit,raceToyGeometry77};',C);
const A=C.A,checks=[];const check=(name,pass,data)=>{checks.push(!!pass);console.log(`${pass?'PASS':'FAIL'} ${name}${data===undefined?'':' '+JSON.stringify(data)}`);};
const formSet=sec=>new Set(Array.from({length:26},(_,i)=>A.raceToyForm77({k:'punch',sec,id:'obstacle'+i})));
check('Entrance uses three distinct silhouettes; candy borders use hooks and pennants',formSet(0).size===3&&formSet(1).size===2&&[...formSet(1)].every(i=>i>=3));
// 88차 — the overlapping ones were removed: four start bags (start4·8 on the plaza, start0·13 deck-edge posts) and eleven jelly-gate bags remain.
const entrance=['start0','start4','start8','start13',...Array.from({length:5},(_,i)=>'jellyGate0:'+i),...Array.from({length:6},(_,i)=>'jellyGate1:'+i)];
const original=entrance.filter(id=>A.raceToyForm77({k:'punch',sec:0,id})===-1),entranceForms=new Set(entrance.map(id=>A.raceToyForm77({k:'punch',sec:0,id})));
check('Four original giant launch bags are mixed among the fifteen entrance obstacles, beside all three mascot silhouettes',
  original.join()==='start4,jellyGate0:2,jellyGate1:2,jellyGate1:5'&&[0,1,2].every(f=>entranceForms.has(f)),{original,forms:[...entranceForms]});
check('Donut and slide colliders retain their own capsule contract',A.raceToyForm77({k:'punch',sec:2,id:'donut'})===-1&&A.raceToyForm77({k:'punch',sec:5,id:'slide'})===-1);
const shapes=[];let finite=true,edgeError=0,triangles=0,rimVertices=0,rimBackfaces=0;
for(let kind=0;kind<5;kind++){
 const g=A.raceToyGeometry77(kind);g.computeBoundingBox();const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;
 finite&&=[p,n,c,g.attributes.uv].every(a=>a&&a.array.every(Number.isFinite));
 const box=g.boundingBox;edgeError=Math.max(edgeError,Math.abs(box.min.x+1),Math.abs(box.max.x-1),Math.abs(box.min.y+1),Math.abs(box.max.y-1));
 const t=(g.index?g.index.count:p.count)/3;triangles=Math.max(triangles,t);
 for(let j=0;j<p.count;j++)if(Math.abs(Math.abs(p.getZ(j))-.488)<1e-6&&Math.abs(c.getY(j)-new THREE.Color(0xffe8b5).g)<1e-6){
   rimVertices++;if(n.getZ(j)*Math.sign(p.getZ(j))<=0)rimBackfaces++;
 }
 shapes.push({kind,vertices:p.count,triangles:t,min:box.min.toArray(),max:box.max.toArray()});
 // The body really contains every silhouette boundary point used for collision.
 for(const [x,y] of A.RACE_TOY77[kind]){let found=false;for(let j=0;j<p.count;j++)if(Math.abs(p.getX(j)-x)<1e-5&&Math.abs(p.getY(j)-y)<1e-5&&Math.abs(Math.abs(p.getZ(j))-.46)<1e-5){found=true;break;}finite&&=found;}
 g.dispose();
}
check('Five rendered silhouettes have finite normals/colors/UVs and share the collision outline',finite&&edgeError<.02,{edgeError,shapes});
check('Raised fabric rims face outward on both sides instead of disappearing under backface culling',rimVertices>200&&rimBackfaces===0,{rimVertices,rimBackfaces});
check('Shared toy geometry has a bounded triangle count and needs no texture or light per object',triangles<=4000&&/A\.toys=toyGeo\.slice\(0,3\)/.test(source),{maxTriangles:triangles});
const h={k:'punch',x:0,z:0,y:3.325,h:6.65,r:2,sec:0,id:'test',toy77:0};
let floors=true,empty=true;
for(let kind=0;kind<5;kind++)for(let i=0;i<72;i++){
 h.toy77=kind;const a=i/72*Math.PI*2;
 Object.assign(A.PL,{x:Math.cos(a)*2.15,z:Math.sin(a)*2.15,y:100});floors&&=A.racePunchHit(h);
 Object.assign(A.PL,{x:Math.cos(a)*2.65,z:Math.sin(a)*2.65,y:100});empty&&=!A.racePunchHit(h);
}
check('Visible low rubber bases close ground bypass seams and space beyond the full sculpture footprint stays clear',floors&&empty);
Object.assign(A.PL,{x:1,z:0,y:102.3});h.toy77=3;const hole=!A.racePunchHit(h);
Object.assign(A.PL,{x:-1.35,z:0,y:102.3});const mast=A.racePunchHit(h);
check('The candy hook is solid at its mast but empty beneath the hook',hole&&mast,{hole,mast});
let topClear=true,behindClear=true,bodySolid=true;
for(let kind=0;kind<5;kind++){
 h.toy77=kind;Object.assign(A.PL,{x:0,z:0,y:107});topClear&&=!A.racePunchHit(h);
 Object.assign(A.PL,{x:0,z:1.4,y:103});behindClear&&=!A.racePunchHit(h);
 // A point at the lowest mast/profile center is not assumed solid for concave shapes.
 Object.assign(A.PL,{x:0,z:0,y:100});bodySolid&&=A.racePunchHit(h);
}
check('Air above and behind every sculpture stays clear while its visible foot remains solid',topClear&&behindClear&&bodySolid);
const old={k:'punch',x:0,z:0,y:3,r:1.5,h:6,sec:2};
Object.assign(A.PL,{x:1.79,z:0,y:102});const hit=A.racePunchHit(old);A.PL.x=1.81;
check('Unchanged donut capsules still accept/reject the actual rounded side boundary',hit&&!A.racePunchHit(old));
console.log(`${checks.filter(Boolean).length}/${checks.length} obstacle geometry/collision checks passed.`);process.exitCode=checks.every(Boolean)?0:1;
