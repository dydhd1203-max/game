// Real geometry checks: a coated pastry remains open through its middle and
// all decorative layers fit the same torus collision envelope.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn};')(source);
const ctx=vm.createContext({THREE});
vm.runInContext(`${['mulberry','raceArtUV','raceArtMerge','raceArtPath','raceDonutGeometry79'].map(fn).join('\n')}\nglobalThis.geometry=raceDonutGeometry79;`,ctx);
const g=ctx.geometry(),checks=[],check=(name,ok,data)=>{checks.push({name,pass:!!ok,data});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,tri=p.count/3;
let invalid=0,minHole=Infinity,maxShell=0,colorful=0,cream=0,chocolate=0,pastry=0;
for(let i=0;i<p.count;i++){
 const x=p.getX(i),y=p.getY(i),z=p.getZ(i),rho=Math.hypot(x,y),shell=Math.hypot(rho-.66,z);
 if(![x,y,z,n.getX(i),n.getY(i),n.getZ(i),c.getX(i),c.getY(i),c.getZ(i)].every(Number.isFinite))invalid++;
 minHole=Math.min(minHole,rho);maxShell=Math.max(maxShell,shell);
 const cl=new THREE.Color(c.getX(i),c.getY(i),c.getZ(i)),hsl={};cl.getHSL(hsl);
 if(hsl.h>.2&&hsl.h<.95&&hsl.s>.2)colorful++;
 if(c.getX(i)>.85&&c.getY(i)>.75)cream++;
 if(c.getX(i)<.18&&c.getY(i)<.06&&c.getZ(i)<.035)chocolate++;
 if(c.getX(i)>.35&&c.getY(i)>.18&&c.getY(i)<.55&&c.getZ(i)<.25)pastry++;
}
check('A single finite shared geometry stays below 3,000 triangles',invalid===0&&tri<3000,{tri,invalid});
check('The sculpted body and every sugar detail preserve a real center opening',minHole>.30,{minHole});
check('Coating and sugar remain within 0.061 normalized units of the physical torus',maxShell<.401,{maxShell,bodyTube:.34});
check('Baked colors include browned pastry, chocolate, cream ribbons, and colorful sprinkles',pastry>500&&chocolate>500&&cream>300&&colorful>200,{pastry,chocolate,cream,colorful});
const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,mat);
let holeOcclusions=0,ringMisses=0,faceBackwards=0;
for(const yaw of [-.25,0,.25])for(const roll of [-.1,0,.1]){
 mesh.rotation.set(0,yaw,roll,'YXZ');mesh.updateMatrixWorld(true);
 const dir=new THREE.Vector3(0,0,1).applyQuaternion(mesh.quaternion),mid=new THREE.Vector3(0,0,-3).applyQuaternion(mesh.quaternion);
 if(new THREE.Raycaster(mid,dir,0,6).intersectObject(mesh).length)holeOcclusions++;
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,origin=new THREE.Vector3(Math.cos(a)*.66,Math.sin(a)*.66,-3).applyQuaternion(mesh.quaternion);
  const hits=new THREE.Raycaster(origin,dir,0,6).intersectObject(mesh);
  if(!hits.length)ringMisses++;else if(hits[0].face.normal.clone().transformDirection(mesh.matrixWorld).dot(dir)>.01)faceBackwards++;
 }
}
check('All nine actual orientations leave the hole open and all 216 pastry-ring rays hit',holeOcclusions===0&&ringMisses===0,{holeOcclusions,ringMisses});
check('The chocolate face is outward toward arriving players, without reversed front faces',faceBackwards===0,{faceBackwards});
const art=fn('raceArtBuild'),draw=fn('raceArtDraw');
check('Three flavors share the existing opaque material in bounded instance banks',art.includes('A.donut=[0,1,2].map(flavor=>dyn(raceDonutGeometry79(flavor),2,64))')&&!fn('raceDonutGeometry79').includes('new THREE.Mesh')&&draw.includes('if(h.donut79)')&&draw.includes('m.count=nd[i]'));
check('Whole-island jumps have an entrance instruction and no misleading tiny yellow launch target',source.includes('원판 어디서나 SPACE!')&&!art.includes('new THREE.CircleGeometry(2.5,48)')&&!draw.includes('put(A.jump,nj++,jump.x'));
const flavors=[];
for(let flavor=0;flavor<3;flavor++){
 const gg=ctx.geometry(flavor),pp=gg.attributes.position,cc=gg.attributes.color;let min=Infinity,max=0,bad=0;
 for(let i=0;i<pp.count;i++){const rho=Math.hypot(pp.getX(i),pp.getY(i));min=Math.min(min,rho);max=Math.max(max,Math.hypot(rho-.66,pp.getZ(i)));if(!Number.isFinite(rho+pp.getZ(i)))bad++;}
 flavors.push({flavor,triangles:pp.count/3,minHole:min,maxShell:max,invalid:bad});gg.dispose();
}
check('All three flavors retain a bounded physical opening within a 3,000-triangle budget',flavors.every(f=>f.triangles<3000&&f.minHole>.30&&f.maxShell<.401&&f.invalid===0),flavors);
g.dispose();mat.dispose();const out=path.resolve(here,'../../artifacts/race79/donut-art-static.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(checks,null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} donut art checks passed`);process.exitCode=checks.every(q=>q.pass)?0:1;
