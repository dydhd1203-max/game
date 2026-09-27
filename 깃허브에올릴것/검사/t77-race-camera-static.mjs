// Camera-only occlusion: compare the live scalar profile query with actual rendered toy triangles.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const extract=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',extract.slice(extract.indexOf('function end('),extract.indexOf('const results=[];'))+';return {fn,decl};')(source);
const ctx=vm.createContext({THREE});
vm.runInContext(`const MINI_Y=100,RACE={t:1},RACE_P=[];let active=true,hazards=[],calls=0;const raceOn=()=>active,raceHazards=()=>hazards;
${decl('M4')}\n${decl('RACE_TOY77')}\n${['raceOff','raceZOff','racePose','raceContains','raceSurface','raceToyForm77','raceCameraBlocked','raceCameraFloorBlocked','raceCameraLift','raceCameraClearance','raceArtUV','raceArtMerge','raceArtPath','raceArtSlide','raceCandyGeometry77','raceToyGeometry77'].map(fn).join('\n')}
const original=raceCameraBlocked;raceCameraBlocked=(...a)=>{calls++;return original(...a);};
globalThis.A={point:raceCameraBlocked,clear:raceCameraClearance,floor:raceCameraFloorBlocked,lift:raceCameraLift,surface:raceSurface,slideGeometry:raceArtSlide,geometry:raceToyGeometry77,set:a=>{hazards=a;calls=0;},pads:a=>{RACE_P.splice(0,RACE_P.length,...a);},active:v=>{active=v;},calls:()=>calls};`,ctx);
const A=ctx.A,checks=[],check=(name,ok,data)=>{checks.push({name,pass:!!ok,data});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
const capsule={k:'punch',x:0,z:0,y:4,h:8,r:2.4,sec:2,id:'capsule'};
A.set([capsule]);const before=JSON.stringify(capsule),blocked=A.clear(0,102,6,0,2,-8);
check('A giant behind the avatar retracts the camera before its visible capsule surface',blocked>2&&blocked<4.2,{clear:blocked,length:Math.hypot(2,8)});
check('The wider low rubber foot also blocks the camera',A.point(capsule,2.72,.18,0,.14)&&!A.point(capsule,3.1,.18,0,.14));
check('Open space above and beside the giant preserves the requested camera endpoint',A.clear(0,110,6,0,1,-8)===Math.hypot(1,8)&&A.clear(7,102,6,0,2,-8)===Math.hypot(2,8));
check('A query never alters obstacle coordinates or avatar/gameplay state',JSON.stringify(capsule)===before&&!/\bPL\.|\.vx\s*=|\.vy\s*=|\.vz\s*=/.test(fn('raceCameraClearance')+fn('raceCameraBlocked')));
A.active(false);check('The camera helper has no effect outside the race',A.clear(0,102,6,0,2,-8)===Math.hypot(2,8));A.active(true);
let contacts=0,misses=0,openContours=0;const examples=[];
for(let kind=0;kind<5;kind++){
 const h={...capsule,sec:0,toy77:kind},geo=A.geometry(kind),mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geo,mat);
 mesh.scale.set(h.r,(h.h-.65)/2,h.r);mesh.position.set(0,.65+(h.h-.65)/2,0);mesh.updateMatrixWorld(true);A.set([h]);
 for(let ix=-8;ix<=8;ix++)for(let iy=1;iy<=15;iy++){
  const x=ix*.31,y=iy*.48,ray=new THREE.Raycaster(new THREE.Vector3(x,y,6),new THREE.Vector3(0,0,-1),0,12),hits=ray.intersectObject(mesh,false),clear=A.clear(x,100+y,6,0,0,-12);
  if(hits.length){contacts++;if(clear>hits[0].distance+.001){misses++;if(examples.length<4)examples.push({kind,x,y,clear,hit:hits[0].distance});}}
  else if(Math.abs(x)<h.r&&y<8&&clear===12)openContours++;
 }
 geo.dispose();mat.dispose();
}
check('All sampled rendered toy faces stop the camera before triangle intersection, including concave outlines',contacts>500&&misses===0,{rays:1275,contacts,misses,examples});
check('Open silhouette corners and candy-hook gaps do not become invisible box walls',openContours>40,{openContours});
const bar={k:'bar',x:0,z:0,y:1.7,r:1.65,len:22,ang:.37},rock={k:'rock',x:0,z:0,y:2.3,r:2.3};
A.set([bar]);const barClear=A.clear(0,102,6,0,0,-12);A.set([rock]);const rockClear=A.clear(0,102,6,0,0,-12);
check('Large rotating candy bars and rolling rocks also retract the camera',barClear<6&&rockClear<6,{barClear,rockClear});
A.set(Array.from({length:123},(_,i)=>({...capsule,x:40+i,z:40+i})));const free=A.clear(0,102,0,0,2,-7);
check('Spatial rejection skips all detailed profile checks for distant obstacles',free===Math.hypot(2,7)&&A.calls()===0,{pointQueries:A.calls()});
A.set([capsule,...Array.from({length:122},(_,i)=>({...capsule,x:40+i,z:40+i}))]);A.clear(0,102,6,0,2,-8);
check('One nearby giant uses a bounded camera-only sampling pass',A.calls()>0&&A.calls()<75,{pointQueries:A.calls()});
const player=fn('updPlayer'),integration=player.slice(player.indexOf('if(tk===0&&raceOn())'),player.indexOf('}else if(tk !== 0){',player.indexOf('if(tk===0&&raceOn())')));
check('The actual race camera casts from the live avatar and preserves the yaw/pitch and desired free endpoint',integration.includes('ox+=tx-PL.x')&&integration.includes('oy+=ty-eye')&&integration.includes('clear=raceCameraClearance')&&!/PL\.(yaw|pitch)\s*=/.test(integration));
// The slide's geometry was correct, but the old camera sat inside its solid slab.
// Compare floor volume with actual rendered triangles, not another copy of its height formula.
A.set([]);const slide={x:0,z:722,y:30,yEnd:0,w:26,d:64,h:3,shape:'slide',round:3},ramp={...slide,z:523,y:0,yEnd:30,d:90,shape:'ramp'};
let volumeCases=0,volumeMisses=0,wrongNormals=0,rayMissing=0;const volumeExamples=[];
for(const p of [slide,ramp]){
 const geo=A.slideGeometry(p),mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geo,mat);mesh.position.set(p.x,100+p.y,p.z);mesh.updateMatrixWorld(true);
 const normal=geo.attributes.normal;for(let i=0;i<48*20*6;i++)if(normal.getY(i)<=0)wrongNormals++;
 A.pads([p]);for(const x of [-10,-4,0,4,10])for(let j=1;j<=17;j++){
  const z=p.z-p.d/2+p.d*j/18,hits=new THREE.Raycaster(new THREE.Vector3(x,180,z),new THREE.Vector3(0,-1,0),0,120).intersectObject(mesh);
  if(hits.length<2){rayMissing++;continue;}const top=hits[0].point.y,bottom=hits.at(-1).point.y;
  for(const [y,want]of [[top+.5,false],[(top+bottom)/2,true],[bottom-.5,false]]){
   volumeCases++;const got=A.floor(p,x,y,z,.24);if(got!==want){volumeMisses++;if(volumeExamples.length<3)volumeExamples.push({shape:p.shape,x,y,z,top,bottom,want,got});}
  }
 }geo.dispose();mat.dispose();
}
check('Rendered ramp and slide top faces point up, and camera solid-volume tests match their real triangles',wrongNormals===0&&rayMissing===0&&volumeMisses===0&&volumeCases===510,{volumeCases,wrongNormals,rayMissing,volumeMisses,volumeExamples});
A.pads([slide]);const foot=A.surface(slide,0,722),look=1.55,back=6.4,pitch=-.22,ox=0,oz=-Math.cos(pitch)*back,oy=-Math.sin(pitch)*back;
const oldEnd={x:0,y:foot+look+oy,z:722+oz},oldBelow=A.surface(slide,oldEnd.x,oldEnd.z)-oldEnd.y;
const floorClear=A.clear(0,foot+look,722,ox,oy,oz),lift=A.lift(0,foot+look,722,ox,oy,oz);
check('The prior default downhill endpoint reproduces slab penetration and is now clipped before the surface',oldBelow>1&&floorClear<Math.hypot(ox,oy,oz)-.5,{oldBelow,floorClear,desired:Math.hypot(ox,oy,oz)});
let liftedBlocked=0;for(let i=1;i<=200;i++){const f=i/200;if(A.floor(slide,ox*f,foot+look+(oy+lift)*f,722+oz*f,.24))liftedBlocked++;}
check('A bounded downhill lift clears the whole camera segment above the actual slide',lift>1&&lift<5&&liftedBlocked===0,{lift,liftedBlocked});
const flat={x:0,z:0,y:0,w:26,d:50,h:3,shape:'cushion',round:3};A.pads([flat]);
const flatLift=A.lift(0,101.55,0,0,1.4,-6.4),flatClear=A.clear(0,101.55,0,0,1.4,-6.4);
check('A normal flat race deck preserves the free camera height and distance',flatLift===0&&flatClear===Math.hypot(1.4,6.4),{flatLift,flatClear});
const belowClear=A.clear(0,95,0,0,0,-6.4),belowLift=A.lift(0,95,0,0,0,-6.4),upInto=A.clear(0,95,0,0,5,-6.4);
check('Falling beneath a deck does not lift or pin the camera above it; looking into its underside retracts normally',belowLift===0&&belowClear===6.4&&upInto<Math.hypot(5,6.4),{belowLift,belowClear,upInto});
A.pads([]);check('No nearby deck leaves free-flight camera height and endpoint unchanged',A.lift(0,120,722,0,1.4,-6.4)===0&&A.clear(0,120,722,0,1.4,-6.4)===Math.hypot(1.4,6.4));
const out=path.resolve(here,'../../artifacts/77-race-camera');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify(checks,null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} race camera checks passed`);process.exitCode=checks.every(q=>q.pass)?0:1;
