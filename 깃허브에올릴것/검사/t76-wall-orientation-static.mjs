// Five entrances, real building vertices and the actual preview. No browser or room writes.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(st,fun=false){let b=0,p=0,r=0,q='',co='',esc=false,open=false;
 for(let i=st;i<source.length;i++){const c=source[i],n=source[i+1];
  if(co==='l'){if(c==='\n')co='';continue;}if(co==='b'){if(c==='*'&&n==='/'){co='';i++;}continue;}
  if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q='';continue;}
  if(c==='/'&&n==='/'){co='l';i++;continue;}if(c==='/'&&n==='*'){co='b';i++;continue;}
  if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{'){b++;open=true;}else if(c==='}')b--;
  else if(c==='(')p++;else if(c===')')p--;else if(c==='[')r++;else if(c===']')r--;
  if(!b&&!p&&!r&&((fun&&open)||(!fun&&c===';')))return i+1;
 }throw Error('Unterminated source');}
const dec=n=>{const m=new RegExp('^(?:const|let)\\s+'+n+'\\s*=','m').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));};
const fn=n=>{const i=source.indexOf('function '+n+'(');if(i<0)throw Error(n);return source.slice(i,end(i,true));};
const a=source.indexOf('const _blkCache ='),b=source.indexOf('function footprint(',a),ctx=vm.createContext({THREE});
const constants=['GY','NG','ARENA_R','RING_A','GAP_HALF','GATE_OFF','DIRS','gT','gPP','gX','gZ','GMOUTH','T','BUILD','BUILD_BRANCHES','MAXLV'];
const functions=['bs','buildStat','addStru','footprint','gapHalfAt','corridorDist','sectorOf','wallType','wallSector','wallQuarter','wallLineQuarter','wallMoveQuarter','buildingPartPose','chamferBox','shadeGeo','geoMerge','rnd','roundBox','struRound','setGhost','ghostFill','drawBuildPlans'];
const geos=['M4','lathe','faceTint','FBEAMG','BRICKV','STRU_GEO','STRU_CYLZ','STRU_CYLY','STRU_CYLX','STRU_SHAPE_GEO'];
vm.runInContext([...constants.map(dec),...functions.map(fn),source.slice(a,b),...geos.map(dec),
 `const G={me:{g:0},phase:'day'},PL={x:0,z:0},fortStyleOf=()=>0,ghost=new THREE.Group();let ghostType=null,ghostTop=1;
 const ghostMatOK=new THREE.MeshBasicMaterial(),ghostEdge=new THREE.LineBasicMaterial();
 const BUILD_PLANS=new Map(),BUILD_HELP=new Map(),scene=new THREE.Scene(),buildPlanMaterial=new THREE.MeshBasicMaterial();let buildPlanDirty=false,buildPlanMesh=null;
 const STRU=new Map(),cellOwner=new Map(),bldH=new Float32Array(512*512),gi=(x,z)=>(x+256)+(z+256)*512,inW=()=>true,markShape=()=>{},markFlow=()=>{};let struVer=0;
 const _v=new THREE.Vector3(),_s=new THREE.Vector3(),_eu=new THREE.Euler(),_q=new THREE.Quaternion(),_m=new THREE.Matrix4(),_c1=new THREE.Color();
 globalThis.A={GY,DIRS,BUILD,blocksOf,blocksOfRaw,bs,buildStat,wallType,wallSector,wallQuarter,wallLineQuarter,wallMoveQuarter,buildingPartPose,gX,gZ,
   add(o){addStru(o);return bldH[gi(o.x,o.z)];},
   setGhost,ghostFill,ghost,plan(p){BUILD_PLANS.clear();BUILD_PLANS.set('probe',p);drawBuildPlans();return buildPlanMesh;},geo(b){const rs=STRU_SHAPE.get(b)||struRound(b);return STRU_SHAPE_GEO[rs]||(b[3]===T.bricks?BRICKV:rs==='z'?STRU_CYLZ:rs==='y'?STRU_CYLY:rs==='x'?STRU_CYLX:STRU_GEO);}};`].join('\n'),ctx);
const A=ctx.A,checks=[],failures=[];
function check(name,pass,detail){checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));}
const cells=A.DIRS.map((_,g)=>[Math.floor(A.gX(g,38,0)),Math.floor(A.gZ(g,38,0))]);
check('Five real gate locations identify their own sectors',cells.every(([x,z],g)=>A.wallSector(x,z)===g));
check('Wall fronts face out of each entrance and group 4 keeps its original direction',cells.every(([x,z],g)=>A.wallQuarter('wwall',x,z)===[2,1,0,0,3][g]));
check('Invalid and legacy orientation values infer location safely',cells.every(([x,z])=>[undefined,null,-1,4,.5,'1',NaN].every(r=>A.wallQuarter('swall',x,z,r)===A.wallQuarter('swall',x,z))));
check('Explicit saved direction remains stable across owners',cells.every(([x,z])=>[0,1,2,3].every(r=>A.wallQuarter('wwall',x,z,r)===r)));
let lineOK=true,moveOK=true;
for(const [x,z]of cells){for(const d of [-1,1]){
 lineOK&&=A.wallLineQuarter('wwall',[[x,z],[x+d*3,z]])%2===0&&A.wallLineQuarter('swall',[[x,z],[x,z+d*3]])%2===1;
 }for(let r=0;r<4;r++)moveOK&&=A.wallMoveQuarter({t:'wwall',x,z,r},x+1,z)===r;
}
check('Both drawing directions align X and Z lines with no diagonal gaps',lineOK);
check('Moving within the same sector preserves the explicit line direction',moveOK);
check('Crossing to another sector adopts the new entrance direction',cells.every(([x,z],g)=>cells.every(([nx,nz],ng)=>g===ng||A.wallMoveQuarter({t:'swall',x,z,r:3},nx,nz)===A.wallQuarter('swall',nx,nz))));
let previewOK=true,group4OK=true,cacheOK=true,vertices=0,variants=0;
const matrix=new THREE.Matrix4(),baseMatrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),v=new THREE.Vector3(),expected=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
for(const t of ['wwall','swall'])for(let lv=1;lv<=7;lv++)for(let style=0;style<4;style++){
 const rows=A.blocksOf(t,lv,'',style),before=JSON.stringify(rows);
 for(let g=0;g<5;g++){
  variants++;const [x,z]=cells[g],r=A.wallQuarter(t,x,z),angle=r*Math.PI/2,center=new THREE.Vector3(x+.5,A.GY,z+.5),bounds=new THREE.Box3();
  A.setGhost(t,lv,'',style,r);A.ghostFill(1);
  previewOK&&=A.ghost.children.filter(m=>m.isMesh).length===rows.length&&A.ghost.children.every(m=>m.visible);
  for(let i=0;i<rows.length;i++){
   const row=rows[i],pose=A.buildingPartPose({t,x,z,r,g:(g+2)%5},row),geo=A.geo(row),positions=geo.attributes.position,mesh=A.ghost.children[i];
   quat.setFromEuler(new THREE.Euler(0,pose[3],pose[4],'YXZ'));
   matrix.compose(new THREE.Vector3(...pose.slice(0,3)),quat,new THREE.Vector3(...row.slice(4,7)));
   quat.setFromEuler(new THREE.Euler(0,row[8]||0,row[9]||0,'YXZ'));
   baseMatrix.compose(new THREE.Vector3(row[0],row[1]+.5,row[2]),quat,new THREE.Vector3(...row.slice(4,7)));
   mesh.updateMatrix();const ghostWorld=mesh.matrix.clone();ghostWorld.elements[12]+=x;ghostWorld.elements[13]+=A.GY;ghostWorld.elements[14]+=z;
   previewOK&&=matrix.elements.every((n,k)=>Math.abs(n-ghostWorld.elements[k])<1e-8)&&mesh.geometry!==geo&&mesh.geometry.attributes.position.count===positions.count;
   if(g===3)group4OK&&=Math.abs(pose[0]-(x+.5+row[0]))<1e-10&&Math.abs(pose[2]-(z+.5+row[2]))<1e-10&&pose[3]===(row[8]||0)&&pose[4]===(row[9]||0);
   for(let k=0;k<positions.count;k++){
    v.fromBufferAttribute(positions,k).applyMatrix4(matrix);bounds.expandByPoint(v);
    expected.fromBufferAttribute(positions,k).applyMatrix4(baseMatrix).applyAxisAngle(up,angle).add(center);vertices++;
    if(v.distanceToSquared(expected)>1e-14){failures.push({t,lv,style,g,reason:'part did not rotate about cell center'});break;}
   }
  }
  const hi=A.bs(t,'hi',lv);
  // Earthen wall berms intentionally blend across the edge by .12 m, unchanged by rotation.
  if(!Number.isFinite(hi)||bounds.min.x<x-.14||bounds.max.x>x+1.14||bounds.min.z<z-.14||bounds.max.z>z+1.14||bounds.min.y<A.GY-.10||Math.abs(bounds.max.y-A.GY-hi)>.025)failures.push({t,lv,style,g,bounds:[bounds.min.toArray(),bounds.max.toArray()],hi});
 }
 cacheOK&&=before===JSON.stringify(rows)&&rows===A.blocksOf(t,lv,'',style);
}
check(`${variants} wall variants rotate their real ${vertices} vertices within unchanged bounds`,failures.length===0,failures.slice(0,3));
check('Group 4 original part positions and rotations remain unchanged',group4OK);
check('Every preview uses the completed shape, placement and direction and remains visible',previewOK);
check('Shared building rows are never mutated by another sector or preview',cacheOK);
let heightOK=true,widthOK=true,floorOK=true,collisionOK=true;const heights=[];
const rowBounds=rows=>{const box=new THREE.Box3();for(const row of rows){
  quat.setFromEuler(new THREE.Euler(0,row[8]||0,row[9]||0,'YXZ'));
  matrix.compose(new THREE.Vector3(row[0],row[1]+.5,row[2]),quat,new THREE.Vector3(...row.slice(4,7)));
  const attr=A.geo(row).attributes.position;for(let k=0;k<attr.count;k++)box.expandByPoint(v.fromBufferAttribute(attr,k).applyMatrix4(matrix));
 }return box;};
for(const t of ['wwall','swall'])for(let lv=1;lv<=7;lv++)for(let style=0;style<4;style++){
 const next=rowBounds(A.blocksOf(t,lv,'',style)),height=A.BUILD[t].hi;A.BUILD[t].hi=1.4;
 const before=rowBounds(A.blocksOfRaw(t,lv,'',style));A.BUILD[t].hi=height;
 // The hand-cut wooden tip keeps its existing 1.86 mm bevel overshoot; the actual top still rises exactly 0.28 m.
 heightOK&&=Math.abs(next.max.y-before.max.y*1.2)<.001&&Math.abs(next.max.y-before.max.y-.28)<1e-10&&Math.abs(A.buildStat({t,lv},'hi')-1.68)<1e-10;
 widthOK&&=['x','z'].every(k=>Math.abs(before.min[k]-next.min[k])<1e-10&&Math.abs(before.max[k]-next.max[k])<1e-10);
 floorOK&&=Math.abs(before.min.y-next.min.y)<1e-10;
 for(let g=0;g<5;g++){const [x,z]=cells[g],o={id:t+lv+style+g,t,lv,x,z,r:A.wallQuarter(t,x,z),g};collisionOK&&=Math.abs(A.add(o)-A.GY-height)<.000002;}
 if(style===0)heights.push({t,lv,before:before.max.y,after:next.max.y,collision:height,bottom:next.min.y});
}
check('Both walls gain exactly twenty percent real mesh height at all seven levels, using the shared stat height',heightOK,heights);
check('Taller walls preserve their exact ground position and X/Z geometry widths',floorOK&&widthOK);
check('Actual addStru collision heights match the taller wall meshes at all five entrances',collisionOK);
const tower=A.blocksOf('arrow',3,'rapid',2);
check('Towers remain in their existing direction even if a record contains wall orientation',tower.every(row=>{const p=A.buildingPartPose({t:'arrow',x:4,z:9,r:3},row);return p[0]===4.5+row[0]&&p[2]===9.5+row[2]&&p[3]===(row[8]||0)&&p[4]===(row[9]||0);}));
A.setGhost('wwall',7,'',3,1);A.ghostFill(0);
check('Construction preview fill hides unfinished upper pieces without NaN geometry heights',A.ghost.children.filter(m=>m.isMesh).some(m=>!m.visible)&&A.ghost.children.filter(m=>m.isMesh).every(m=>Number.isFinite(m.userData.buildBottom)));
let meterOK=true;
for(let g=0;g<5;g++)for(const t of ['wwall','swall']){
 const [x,z]=cells[g],r=A.wallQuarter(t,x,z),mesh=A.plan({t,x,z,r,g,prog:.5}),background=new THREE.Matrix4(),fill=new THREE.Matrix4();
 mesh.getMatrixAt(mesh.count-2,background);mesh.getMatrixAt(mesh.count-1,fill);
 const tangent=new THREE.Vector3(1,0,0).applyAxisAngle(up,r*Math.PI/2),front=new THREE.Vector3(0,0,1).applyAxisAngle(up,r*Math.PI/2);
 const e=background.elements,f=fill.elements,axis=new THREE.Vector3(e[0],e[1],e[2]).normalize(),delta=new THREE.Vector3(f[12]-e[12],f[13]-e[13],f[14]-e[14]);
 meterOK&&=axis.distanceTo(tangent)<1e-7&&Math.abs(delta.dot(tangent)+.375)<1e-5&&Math.abs(delta.dot(front)-.08)<1e-5&&Math.abs(e[13]-A.GY-A.bs(t,'hi',1)-.5)<1e-5;
}
check('Blueprint progress meters stay above the taller wall and across its outward face in all five sectors',meterOK);
console.log(`${checks.filter(Boolean).length}/${checks.length} wall orientation checks passed; browser appearance is checked separately.`);
process.exitCode=checks.every(Boolean)?0:1;
