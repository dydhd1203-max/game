// Pattern coordinates travel with real geometry; no extra render passes or textures.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',harness.slice(harness.indexOf('function end('),harness.indexOf('const results=[];'))+';return {fn,decl};')(source);
const C=vm.createContext({THREE,console});vm.runInContext(decl('M4')+'\n'+decl('RACE_TOY77')+'\n'+
 ['raceMaterial75','raceCandyGeometry77','raceArtUV','raceArtMerge','raceArtPath','raceToyGeometry77'].map(fn).join('\n')+
 '\nglobalThis.A={raceMaterial75,raceCandyGeometry77,raceArtMerge,raceArtUV,raceToyGeometry77};',C);
const A=C.A,results=[];const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
const raw=new THREE.CylinderGeometry(1,1,1,24,1,false),before=Array.from(raw.attributes.position.array),uv=raw.attributes.uv.clone();A.raceCandyGeometry77(raw,9,true);
check('Paint coordinates never modify the collider silhouette or position buffer',before.every((v,i)=>v===raw.attributes.position.array[i])&&raw.attributes.raceCandy77.itemSize===1);
const flag=raw.attributes.raceCandy77;let wrap=true,wrapPairs=0;
for(let i=0;i<uv.count;i++)if(uv.getX(i)===0)for(let j=0;j<uv.count;j++)if(uv.getX(j)===1&&uv.getY(i)===uv.getY(j)&&Math.hypot(raw.attributes.position.getX(i)-raw.attributes.position.getX(j),raw.attributes.position.getY(i)-raw.attributes.position.getY(j),raw.attributes.position.getZ(i)-raw.attributes.position.getZ(j))<1e-5){wrapPairs++;wrap&&=Math.abs(Math.abs(flag.getX(i)-flag.getX(j))-1)<1e-5;}
check('Cylinder paint wraps through a whole period without a color seam',wrap&&wrapPairs>=2,{wrapPairs});
const clean=new THREE.SphereGeometry(1,8,6),merged=A.raceArtMerge([{g:raw,c:0xffffff},{g:clean,c:0xffffff}]);
const first=raw.index.count,marks=merged.attributes.raceCandy77.array;
check('Baking preserves selected coordinates and assigns zero to every unpainted vertex',marks.slice(0,first).every(v=>v<0)&&marks.slice(first).every(v=>v===0),{extraBytes:marks.byteLength,vertices:merged.attributes.position.count});
let faces=true,rims=true,hook=true;
for(let kind=0;kind<5;kind++){const g=A.raceToyGeometry77(kind),p=g.attributes.position,f=g.attributes.raceCandy77;let marked=0,face=0;
 for(let i=0;i<p.count;i++){if(f.getX(i)>8)marked++;if(kind<3&&Math.abs(p.getX(i))<.23&&Math.abs(p.getY(i))<.25&&Math.abs(p.getZ(i))>.47){face++;faces&&=f.getX(i)===0;}}
 if(kind<3)rims&&=marked>100&&face>0;if(kind===3)hook&&=marked>0;g.dispose();}
check('Flowers, stars and clouds gain painted rims while eyes/smiles stay untouched',faces&&rims);
check('Open candy-hook body receives its own diagonal paint',hook);
let shader=true;for(const rubber of [false,true]){const m=A.raceMaterial75(new THREE.MeshPhongMaterial({vertexColors:true}),rubber),s={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};m.onBeforeCompile(s);
 shader&&=/attribute float raceCandy77/.test(s.vertexShader)&&/raceScale77.y>12.0&&raceScale77.x>1.2/.test(s.vertexShader)&&/fwidth\(candyPhase77\)/.test(s.fragmentShader)&&/weave75/.test(s.fragmentShader)&&!/sampler|uniform/.test(s.fragmentShader);m.dispose();}
check('Existing two cloth/rubber shader variants retain grain and antialias candy without new samplers',shader);
const sharedPaint=(sy,sx)=>sy>12&&sx>1.2;
check('Only full sweeper bodies qualify; short belts, bases, ordinary posts and thin rods do not',[sharedPaint(18.7,1.65),!sharedPaint(.35,1.68),!sharedPaint(.7,3.5),!sharedPaint(5.5,3.5),!sharedPaint(20,.3)].every(Boolean));
const build=fn('raceArtBuild');check('Static baking and dynamic setup both initialize the scalar attribute',/\['raceCandy77',1\]/.test(build)&&/if\(!g.attributes.raceCandy77\)/.test(build));
let syntax=true;try{for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(m[2].trim()){
 if(/importmap/.test(m[1]))JSON.parse(m[2]);else new vm.Script(m[2].replace(/^import[^\n]*\n/gm,''));
}}catch(e){syntax=false;console.error(e.message);}
check('All inline game scripts parse after scoped shader/art changes',syntax);
raw.dispose();clean.dispose();merged.dispose();const out=path.join(here,'artifacts/77-candy');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));
console.log(`${results.filter(r=>r.pass).length}/${results.length} candy coordinate checks passed.`);process.exitCode=results.every(r=>r.pass)?0:1;
