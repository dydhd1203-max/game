// Actual building rows and baked crystal geometry; no browser or copied mesh implementation.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t56-buildings-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function end('),harness.indexOf('const A=ctx.A'));
const A=new Function('source','vm',load+'\nreturn {...ctx.A,shape:vm.runInContext("STRU_SHAPE",ctx),fn,declaration};')(source,vm);
const start=source.indexOf('const STRU_SHAPE_GEO = (()=>{ const G = {};'),stop=source.indexOf('  /* 말뚝',start);
assert.ok(start>=0&&stop>start);const ctx=vm.createContext({THREE});
new vm.Script(['rnd','geoMerge','chamferBox'].map(A.fn).join('\n')+'\n'+A.declaration('M4')+'\n'+source.slice(start,stop)+'return G;})(); globalThis.shapes=STRU_SHAPE_GEO;globalThis.ice=STRU_SHAPE_GEO.ice;').runInContext(ctx);
const g=ctx.ice,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,checks=[];
const check=(name,pass,detail)=>{checks.push(!!pass);console.log(`${pass?'PASS':'FAIL'} ${name}${detail===undefined?'':' '+JSON.stringify(detail)}`);};
const bb=g.boundingBox,tri=p.count/3;
check('Faceted crystal replaces two 300-triangle rounded boxes with at most 320 triangles',tri<=320,{triangles:tri,oldBodyAndGlow:600});
check('Crystal keeps its exact unit height and stays within the declared footprint',Math.abs(bb.min.y+.5)<1e-7&&Math.abs(bb.max.y-.5)<1e-7&&bb.min.x>=-.500001&&bb.max.x<=.500001&&bb.min.z>=-.500001&&bb.max.z<=.500001);
let bad=0,areaMin=Infinity,directions=new Set(),dark=0,frost=0;
for(let i=0;i<p.count;i+=3){
 const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),d=new THREE.Vector3().fromBufferAttribute(p,i+2),normal=new THREE.Vector3().fromBufferAttribute(n,i);
 const cross=b.clone().sub(a).cross(d.clone().sub(a));areaMin=Math.min(areaMin,cross.length()/2);
 const center=a.clone().add(b).add(d).multiplyScalar(1/3);if(cross.dot(normal)<=0||normal.dot(center)<-.0001)bad++;
 if(Math.abs(normal.y)<.0001)directions.add([normal.x,normal.z].map(v=>v.toFixed(3)).join(','));
 for(let j=i;j<i+3;j++){if(![p.getX(j),p.getY(j),p.getZ(j),c.getX(j),c.getY(j),c.getZ(j)].every(Number.isFinite))bad++;if(c.getX(j)<.78)dark++;if(c.getX(j)>.90)frost++;}
}
check('Six planar faces have outward nondegenerate triangles, without overlay planes',bad===0&&directions.size===6&&areaMin>1e-6,{directions:directions.size,areaMin,bad});
check('Crystal facets keep restrained baked contrast beneath the shared frost texture',dark>20&&frost>20&&!!g.attributes.uv,{darkVertices:dark,frostVertices:frost});
let variants=0,wrong=[];
for(let lv=1;lv<=7;lv++)for(const branch of ['','blizzard','frost'])for(let style=0;style<4;style++){
 const rows=A.blocksOf('ice',lv,branch,style),crystals=rows.filter(r=>A.shape.get(r)==='ice'),count=(branch==='blizzard'?7:3)+(lv>=4||style===3?2:0)+(lv>=6?2:0);
 if(crystals.length!==count||crystals.some(r=>r[8]!==0||r[9]!==0)||Math.abs(Math.max(...crystals.map(r=>r[1]+.5+r[5]/2))-A.BUILD.ice.hi[lv-1])>1e-7)wrong.push({lv,branch,style});variants++;
}
check('Every ice level, branch and style uses crystals ending at the unchanged collision height',wrong.length===0,{variants,wrong});
check('Frost body, crystals and window use one shared 256-square mipmapped opaque texture',/cv.width=cv.height=256/.test(A.declaration('STRU_FROST_TEX'))&&/map:STRU_FROST_TEX,vertexColors:true/.test(A.declaration('STRU_ICE_MAT'))&&!/transparent|opacity|normalMap|bumpMap/.test(A.declaration('STRU_ICE_MAT'))&&/LinearMipmapLinearFilter/.test(A.declaration('STRU_FROST_TEX'))&&!/Math.random/.test(A.declaration('STRU_FROST_TEX')));
{
 const h=source.indexOf('function buildingGroup('),e=source.indexOf('\n}',h),ic=vm.createContext({THREE,blocksOf:A.blocksOf,STRU_SHAPE:A.shape,STRU_SHAPE_GEO:ctx.shapes,STRU_ICE_MAT:new THREE.MeshPhongMaterial({vertexColors:true}),T:{cutStone:-1,plank:-2,cloth:0},flatFor:()=>new THREE.MeshBasicMaterial(),rboxGeo:(w,h,d)=>new THREE.BoxGeometry(w,h,d)});
 new vm.Script(source.slice(h,e+2)+';globalThis.result=buildingGroup("ice",1);').runInContext(ic);
 check('Building/shop icons share the actual frosted crystal geometry and vertex-color material',ic.result.children.filter(m=>m.geometry===g).length===3&&ic.result.children.filter(m=>m.geometry===g).every(m=>m.material.vertexColors));
}
let boundsFailures=[],bodyShapes=0;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),point=new THREE.Vector3();
for(let lv=1;lv<=7;lv++)for(const type of ['ice','arrow'])for(const branch of type==='ice'?['','blizzard','frost']:['','rapid','sniper']){
 const rows=A.blocksOf(type,lv,branch),total=new THREE.Box3();
 for(const r of rows){const shape=ctx.shapes[A.shape.get(r)],local=shape?new THREE.Box3().setFromBufferAttribute(shape.attributes.position):new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
  if(shape){bodyShapes++;for(const v of shape.attributes.position.array)if(!Number.isFinite(v))boundsFailures.push('nonfinite');if(shape.userData.frost&&(!shape.attributes.uv||shape.attributes.uv.array.some(v=>!Number.isFinite(v))))boundsFailures.push('uv');}
  matrix.compose(new THREE.Vector3(r[0],r[1]+.5,r[2]),q.setFromEuler(new THREE.Euler(0,r[8],r[9],'YXZ')),new THREE.Vector3(r[4],r[5],r[6]));total.union(local.clone().applyMatrix4(matrix));
 }
 if(total.min.y<-.00001||Math.abs(total.max.y-A.BUILD[type].hi[lv-1])>.00001||total.min.x<-.56001||total.max.x>1.56001||total.min.z<-.56001||total.max.z>1.56001)boundsFailures.push({type,lv,branch,bounds:total});
}
check('Actual frozen/roof vertices, not only row boxes, stay inside build height and footprint',boundsFailures.length===0,{bodyShapes,boundsFailures});
// The former left roof was a cloned right geometry rotated by PI. Its exact
// vertex order and colors must survive canonicalizing both halves to one bank.
let roofError=0,roofNormalError=0,roofRows=0,roofBanks=true;
const roof=ctx.shapes.towerRoof,turn=new THREE.Matrix4().makeRotationY(Math.PI),oldM=new THREE.Matrix4(),newM=new THREE.Matrix4(),oldN=new THREE.Matrix3(),newN=new THREE.Matrix3();
for(let lv=1;lv<=7;lv++)for(const branch of ['','rapid','sniper'])for(let style=0;style<4;style++){
 const rows=A.blocksOf('arrow',lv,branch,style).filter(r=>A.shape.get(r)==='towerRoof');roofBanks&&=rows.length===0||rows.length===2;
 for(const r of rows){roofRows++;const left=Math.abs(r[8]-Math.PI)<1e-7,pos=new THREE.Vector3(r[0],r[1]+.5,r[2]),scale=new THREE.Vector3(r[4],r[5],r[6]);
  newM.compose(pos,new THREE.Quaternion().setFromEuler(new THREE.Euler(0,r[8],r[9],'YXZ')),scale);
  oldM.compose(pos,new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,left?-r[9]:r[9],'YXZ')),scale);if(left)oldM.multiply(turn);
  oldN.getNormalMatrix(oldM);newN.getNormalMatrix(newM);
  for(let i=0;i<roof.attributes.position.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(roof.attributes.position,i),n=new THREE.Vector3().fromBufferAttribute(roof.attributes.normal,i);
   roofError=Math.max(roofError,p.clone().applyMatrix4(newM).distanceTo(p.applyMatrix4(oldM)));
   roofNormalError=Math.max(roofNormalError,n.clone().applyNormalMatrix(newN).distanceTo(n.applyNormalMatrix(oldN)));
  }
 }
}
check('One roof bank preserves both previous halves, every vertex color, and world-space normals',roofBanks&&roofRows>0&&roofError<1e-6&&roofNormalError<1e-6,{roofRows,roofError,roofNormalError});
let windowsClear=true;
for(let lv=1;lv<=7;lv++)for(const branch of ['','blizzard','frost']){
 const rows=A.blocksOf('ice',lv,branch),body=rows.find(r=>A.shape.get(r)==='frost'&&r[5]>.3),win=rows.find(r=>A.shape.get(r)==='iceWindow');
 const bodyMaxZ=body[2]+.5*body[6],paneZ=win[2]-.32*win[6];windowsClear&&=paneZ>bodyMaxZ+.025&&.82*win[6]>.14;
}
check('Recessed frosted glass remains in front of the solid tower and 14cm behind its frame',windowsClear);
check('Existing ice projectile and tower effect pools remain bounded at their prior capacities',/const IN_ = 26;/.test(source)&&/TFX_BALL_CAP\s*=\s*72/.test(source)&&/TFX_CHIP_CAP\s*=\s*72/.test(source)&&/TFX_SHELL_CAP\s*=\s*16/.test(source));
if(process.argv[3]){
 const old=fs.readFileSync(process.argv[3],'utf8');
 const loadOld=new Function('source','vm',load+'\nreturn ctx.A;')(old,vm);
 check('All three tower combat stats, prices, upgrade heights and sizes match build 76', ['arrow','ice','pulse'].every(t=>JSON.stringify(A.BUILD[t])===JSON.stringify(loadOld.BUILD[t])));
}
const out=path.resolve('artifacts/tower77');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify({checks:checks.length,passed:checks.filter(Boolean).length,crystalTriangles:tri,crystalBounds:bb,variants},null,2));
console.log(`${checks.filter(Boolean).length}/${checks.length} tower checks passed`);if(checks.some(v=>!v))process.exitCode=1;
