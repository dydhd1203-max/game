// Actual source job art checks. No browser, DOM, or input devices.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(start,body=false){let b=0,p=0,a=0,q='',c='',esc=false,opened=false;
  for(let i=start;i<source.length;i++){const v=source[i],n=source[i+1];
    if(c==='line'){if(v==='\n')c='';continue;}if(c==='block'){if(v==='*'&&n==='/'){c='';i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(v==='\\'){esc=true;continue;}if(v===q)q='';continue;}
    if(v==='/'&&n==='/'){c='line';i++;continue;}if(v==='/'&&n==='*'){c='block';i++;continue;}
    if(v==='"'||v==="'"||v==='`'){q=v;continue;}
    if(v==='{'){b++;opened=true;}if(v==='}')b--;if(v==='(')p++;if(v===')')p--;if(v==='[')a++;if(v===']')a--;
    if(!b&&!p&&!a&&((body&&opened)||(!body&&v===';')))return i+1;
  }throw Error('Unterminated source at '+start);}
function fn(n){const a=source.indexOf('function '+n+'(');if(a<0)throw Error(n);return source.slice(a,end(a,true));}
function decl(n){const m=new RegExp('^const\\s+'+n+'\\s*=','m').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));}
const start=source.indexOf('const STUD ='),stop=source.indexOf('const eyeMat =',start);
if(start<0||stop<start)throw Error('Human geometry anchors missing');
const context=vm.createContext({THREE});
new vm.Script([fn('roundBox'),fn('roundCyl'),source.slice(start,stop),fn('wingSpine'),fn('wingGeo'),decl('WING_GEO'),decl('JOB_WING'),decl('JOB_LOOK'),decl('JOB_GEO'),decl('JOB_UNIFORM'),
  decl('MAXW'),'const scene=new THREE.Scene(),GFX={shadow:false},AVATAR_MAT={cloth:new THREE.MeshPhongMaterial({color:0xffffff})};',fn('imesh'),decl('P_jobParts'),
  'globalThis.A={WING_GEO,JOB_WING,JOB_LOOK,JOB_GEO,JOB_UNIFORM,MAXP,P_jobParts,wingSpine,r6body,r6head};'].join('\n')).runInContext(context);
const A=context.A,checks=[],check=(name,ok,detail)=>{checks.push(!!ok);console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const counts=A.JOB_LOOK.map(j=>j.map(rows=>rows.length));
check('All three roles retain two distinct compact outfit stages',counts.every(c=>c[0]>=8&&c[0]<=24&&c[1]>c[0]&&c[1]<=32),counts);
check('Job outfits contain no orbiting, floating, or additive glow clutter',A.JOB_LOOK.flat(2).every(r=>r[8]===0&&r[9]===0));
let badBody=0,backPlanks=0,faceCovers=0;
for(const rows of A.JOB_LOOK.flat())for(const row of rows){
  if(row[7]){if(row[1]-row[4]/2<1.26&&row[0]>1)faceCovers++;continue;}
  const q=A.r6body(...row.slice(0,6));
  if(Math.abs(q[2])+q[3]/2>.43||q[1]-q[4]/2<.60||q[1]+q[4]/2>1.30)badBody++;
  if(q[0]<-.08&&q[3]>.35&&q[4]>.35)backPlanks++;
}
check('Role accessories stay close to torso and leave face and back clear',!badBody&&!backPlanks&&!faceCovers,{badBody,backPlanks,faceCovers});
check('Every job has a distinct removable headpiece and at least six torso details',A.JOB_LOOK.flat().every(rows=>rows.some(r=>r[7])&&rows.filter(r=>!r[7]).length>=6));
const allRows=A.JOB_LOOK.flat(2),triangles=g=>(g.index?.count||g.attributes.position.count)/3;
check('Every row retains finite original transform fields and resolves its optional geometry key',allRows.every(r=>r.slice(0,12).every(Number.isFinite)&&r.slice(3,6).every(n=>n>0)&&(!r[12]||A.JOB_GEO[r[12]])));
const shapeStats={};let shapeSafe=true;
for(const [key,g] of Object.entries(A.JOB_GEO)){
  g.computeBoundingBox();shapeStats[key]=triangles(g);
  shapeSafe&&=['position','normal'].every(a=>Array.from(g.attributes[a].array).every(Number.isFinite))&&g.boundingBox.min.toArray().every(n=>n>=-.50001)&&g.boundingBox.max.toArray().every(n=>n<=.50001)&&triangles(g)<=1600;
}
check('All dedicated hats, jewelry, and tools have finite normalized surfaces within budget',shapeSafe,shapeStats);
const signatures=A.JOB_LOOK.flat().map(rows=>JSON.stringify(rows.map(r=>r.map((v,i)=>i===6?0:v))));
check('All six outfits differ in geometry and placement even with their colors removed',new Set(signatures).size===6);
const budgets=A.JOB_LOOK.map(job=>job.map(rows=>rows.reduce((n,r)=>n+(r[12]?triangles(A.JOB_GEO[r[12]]):108),0)));
check('Each complete outfit keeps a bounded triangle cost',budgets.flat().every(n=>n<=12000),budgets);
const occupancy={};let capacity=true;
for(const [key,m] of Object.entries(A.P_jobParts)){
  const needed=Math.max(...A.JOB_LOOK.flat().map(rows=>rows.filter(r=>r[12]===key).length))*A.MAXP;
  occupancy[key]=needed;capacity&&=m.geometry===A.JOB_GEO[key]&&m.count_max>=needed&&m.instanceMatrix.count>=needed;
}
check('Every dedicated mesh fits the maximum player crowd in its most demanding outfit',capacity&&Object.keys(occupancy).length===Object.keys(A.JOB_GEO).length,{players:A.MAXP,occupancy});
const cow=A.JOB_GEO.cowboyBrim.attributes.position,side=[],front=[];
for(let i=0;i<cow.count;i++){if(Math.abs(cow.getX(i))>.49)side.push(cow.getY(i));if(cow.getZ(i)>.49)front.push(cow.getY(i));}
check('Cowboy brim curls up at both sides instead of using a flat plate',Math.min(...side)>Math.max(...front)+.5);
const dent=A.JOB_GEO.cowboyCrown.attributes.position;
const crownRim=Math.max(...Array.from({length:dent.count},(_,i)=>dent.getY(i)));
check('Cowboy crown has a recessed center surrounded by a raised rim',crownRim-dent.getY(dent.count-1)>.30&&crownRim>.49);
const ring=new THREE.Mesh(A.JOB_GEO.goggleRing,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster();ring.updateMatrixWorld();
ray.set(new THREE.Vector3(0,0,2),new THREE.Vector3(0,0,-1));const open=ray.intersectObject(ring).length;
ray.set(new THREE.Vector3(.4,0,2),new THREE.Vector3(0,0,-1));const rim=ray.intersectObject(ring).length;
check('Inventor goggles have an actual open ring surrounding their separate lenses',open===0&&rim>0);
const up=new THREE.Mesh(A.JOB_GEO.cowboyBrim,new THREE.MeshBasicMaterial());up.updateMatrixWorld();
ray.set(new THREE.Vector3(.35,2,0),new THREE.Vector3(0,-1,0));
check('Curved brim upper faces point outwards and remain visible from above',ray.intersectObject(up).length>0);
const colors=A.JOB_UNIFORM.flat();
check('Six uniforms color the existing shirt, pants, and shoes without scaling the body',colors.length===6&&colors.every(c=>Object.keys(c).sort().join(',')==='pant,shirt,shoe'&&Object.values(c).every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffff))&&new Set(colors.map(c=>JSON.stringify(c))).size===6);
for(let kind=0;kind<2;kind++){
  const g=A.WING_GEO[kind],triangles=(g.index?.count||g.attributes.position.count)/3;g.computeBoundingBox();
  check('Wing '+kind+' has finite indexed feather surfaces within the triangle budget',!!g.index&&triangles<=1200&&['position','normal','color'].every(k=>[...g.attributes[k].array].every(Number.isFinite)),{triangles});
  // 66차 — 손목에서 칼깃이 부챗살로 펼쳐져 날개 끝이 조금 길어졌다(1.85 → 2.0). 아래 가장자리 한계(-.22)와 두께는 그대로다.
  check('Wing '+kind+' stays thin behind the shoulder and avoids a jagged long lower fringe',g.boundingBox.min.z>=-.060&&g.boundingBox.max.z<=.060&&g.boundingBox.min.y>-.22&&g.boundingBox.max.x<2.0,{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()});
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  const ray=new THREE.Raycaster(),C=A.wingSpine(kind?1.12:1.20);let hits=0;
  for(let i=1;i<40;i++){const [x,y]=C(i/40);ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));if(ray.intersectObject(mesh,false).length)hits++;}
  check('Wing '+kind+' keeps one continuous shoulder-to-tip silhouette',hits===39,{hits});
}
// 66차 — 선생님 요청("날개를 좀 더 크게")으로 두 단계를 같은 비율 +25%(.459 · .612). 한계도 그만큼 올린다. 단계 사이 비율 한계(1.4)는 그대로다.
check('Wing evolution adds detail with a modest size change and no duplicate glow shell',A.JOB_WING.every(j=>j[0].k===0&&j[1].k===1&&j[0].s<=.47&&j[1].s<=.62&&j[1].s/j[0].s<=1.4&&j.every(w=>w.g===0)),A.JOB_WING.map(j=>j.map(w=>w.s)));
check('Each advanced role has its own pastel wing color',new Set(A.JOB_WING.map(j=>j[1].c)).size===3);
console.log(checks.filter(Boolean).length+'/'+checks.length+' job art checks passed. WebGL rendering is checked separately.');
process.exitCode=checks.every(Boolean)?0:1;
