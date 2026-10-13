// Executes the real building geometry, rebuild, damage tint and turret animation.
// This measures submitted geometry, not LG Gram GPU time or classroom FPS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
// Reuse the established parser, without running its tests or copying game logic.
const harness=fs.readFileSync(path.join(here,'t56-buildings-static.mjs'),'utf8');
const parser=harness.slice(harness.indexOf('function end('),harness.indexOf("const a=source.indexOf('const _blkCache =')"));
const {declaration,fn}=new Function('source',parser+'\nreturn {declaration,fn};')(source);
const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial(),gfx={shadow:0};
const ctx=vm.createContext({THREE,scene,GY:9,GFX:gfx,P81_UP:true,URLSearchParams,location:{search:''},
  WMAT:material,WMATV:material,WMAT_WOOD:material,WMAT_WOODV:material,STRU_ICE_MAT:material,
  EMIT:material,flatFor:()=>material,fortStyleOf:g=>g%4,
  _v:new THREE.Vector3(),_q:new THREE.Quaternion(),_s:new THREE.Vector3(),_eu:new THREE.Euler(),_m:new THREE.Matrix4()});
const geometryFunctions=['rnd','chamferBox','geoMerge','roundBox','shadeGeo'];
const geometryConstants=['M4','lathe','faceTint','FBEAMG','BRICKV','STRU_GEO','STRU_CYLX','STRU_CYLY','STRU_CYLZ','STRU_SHAPE_GEO'];
const blocksStart=source.indexOf('const _blkCache ='),blocksEnd=source.indexOf('function footprint(',blocksStart);
const matEnd=source.indexOf(fn('struMat'))+fn('struMat').length;
const rebuildEnd=source.indexOf('/* ═══════════════════════ 미리보기(고스트)',matEnd);
assert.ok(blocksStart>0&&blocksEnd>blocksStart&&rebuildEnd>matEnd,'Source anchors must exist');
const program=new vm.Script([
  ...['P81','T','BUILD','MAXLV','STRU_CHUNK','STRU_CULL'].map(declaration),fn('bs'),source.slice(blocksStart,blocksEnd),
  ...geometryFunctions.map(fn),...geometryConstants.map(declaration),
  'const STRU=new Map(),struTint=new Set(),struDirtyG=new Set(),struMeshes=new Map(),struRenderMeshes=new Map(),_tintHit=new Set(),_c1=new THREE.Color();',
  'const _struFrustum=new THREE.Frustum(),_struProjection=new THREE.Matrix4();',
  'let struDirty=true,struAllG=true,struLastN=0;',
  ...['wallType','wallQuarter','buildingPartPose','struCX','struCZ','markShape','markHp','struColor','struRange81','tintStru','struRound','struMat'].map(fn),
  source.slice(matEnd,rebuildEnd),
  'globalThis.A={STRU,struMeshes,struRenderMeshes,struRenderSync,struTint,BUILD,blocksOf,buildingPartPose,rebuildStru,tintStru,tickBuildingGuns,markShape,markHp,struColor,_c1};'
].join('\n'));
program.runInContext(ctx);
const A=ctx.A,checks=[];
const check=(name,test)=>{assert.ok(test,name);checks.push(name);console.log('PASS '+name);};
const reset=()=>{for(const m of A.struMeshes.values()){scene.remove(m);m.dispose();}for(const p of A.struRenderMeshes.values()){scene.remove(p.mesh);p.mesh.dispose();}A.struRenderMeshes.clear();A.struMeshes.clear();A.STRU.clear();A.markShape();};
const add=(id,t,x,z,g=0,lv=7,branch='',r=0)=>{const o={id,t,x,z,g,lv,branch,r,mx:100,hp:100,gunYaw:0,gunKick:0};A.STRU.set(id,o);return o;};
const rows=o=>A.blocksOf(o.t,o.lv,o.branch,o.g%4);
const meshAt=(o,i)=>A.struMeshes.get(o._rk[i]);
const matrixAt=(o,i)=>{const m=new THREE.Matrix4();meshAt(o,i).getMatrixAt(o._ri[i],m);return m;};
const matrixNear=(a,b,tol=1e-5)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<=tol);
const initialMatrix=(o,b)=>{const p=A.buildingPartPose(o,b);return new THREE.Matrix4().compose(new THREE.Vector3(...p.slice(0,3)),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,p[3],p[4],'YXZ')),new THREE.Vector3(...b.slice(4,7)));};
const assertMapped=o=>{const b=rows(o);assert.equal(o._rk.length,b.length);for(let i=0;i<b.length;i++){
  const m=meshAt(o,i);assert.ok(m&&o._ri[i]>=0&&o._ri[i]<m.count,'Every building row retains a live instance');
  assert.ok(matrixNear(matrixAt(o,i),initialMatrix(o,b[i])),'Chunking must preserve every initial world matrix');
}};

reset();
let buildingVariants=0;
for(const t of ['wwall','swall','arrow','ice','barr','pulse'])for(let lv=1;lv<=7;lv++){
  const branches=t==='arrow'?['','rapid','sniper']:t==='ice'?['','blizzard','frost']:[''];
  for(const branch of branches)for(let style=0;style<4;style++){
    const i=buildingVariants++,o=add('variant'+i,t,(i%20)*3-30,Math.floor(i/20)*3-30,style,lv,branch,i%4);
    o.hp=30+i%71;
  }
}
A.rebuildStru();for(const o of A.STRU.values())assertMapped(o);
check('Every building level, branch, theme and wall direction keeps all original part transforms',buildingVariants===280);

reset();
const near=add('near','arrow',2,-24,0,7,'rapid'),neighbor=add('neighbor','arrow',5,-24,0,7,'rapid');
const far=add('far','arrow',2,24,0,7,'rapid'),other=add('other','arrow',-22,-22,1,6,'sniper');
A.rebuildStru();
for(const o of A.STRU.values())assertMapped(o);
check('Nearby towers share banks while distant towers of the same team are independently culled',near._rk[0]===neighbor._rk[0]&&near._rk[0]!==far._rk[0]);
other.gunYaw=1.15;other.gunKick=.7;A.tickBuildingGuns(0);A.struRenderSync(null);
const otherMatrices=rows(other).map((_,i)=>matrixAt(other,i).elements.slice()),otherKeys=[...other._rk];
const otherPools=Array.from(new Set(other._rk.map(k=>k.split('@')[0])),key=>{
  const p=A.struRenderMeshes.get(key);return {key,p,mesh:p.mesh,runs:p.runs,entries:[...p.runs],mv:p.mesh.instanceMatrix.version,cv:p.mesh.instanceColor.version,center:p.mesh.boundingSphere.center.toArray()};
});
const oldNearKeys=[...new Set(near._rk)];
near.x=34;near.z=26;A.STRU.delete(neighbor.id);A.markShape(near.g);A.rebuildStru();
for(const o of [near,far])assertMapped(o);
check('Moving a tower and deleting the final neighbor empties every old spatial bank',oldNearKeys.every(k=>!A.struMeshes.get(k)?.count));
check('A partial team rebuild preserves another team\'s banks and instance matrices',other._rk.every((k,i)=>k===otherKeys[i]&&matrixAt(other,i).elements.every((v,j)=>v===otherMatrices[i][j])));
check('A partial team rebuild preserves another team\'s animated pool runs, upload versions and sort center',otherPools.every(s=>{
  const p=A.struRenderMeshes.get(s.key),m=p.mesh;
  return p===s.p&&m===s.mesh&&p.runs===s.runs&&p.runs.length===s.entries.length&&p.runs.every((r,i)=>r===s.entries[i])
    &&m.instanceMatrix.version===s.mv&&m.instanceColor.version===s.cv&&m.boundingSphere.center.toArray().every((v,i)=>v===s.center[i]);
}));
const unchangedColors=rows(far).map((_,i)=>{const c=new THREE.Color();meshAt(far,i).getColorAt(far._ri[i],c);return c.toArray();});
near.hp=41;A.markHp(near);A.tintStru();
let tintCorrect=true;
for(let i=0;i<rows(near).length;i++){A.struColor(.41,rows(near)[i][7]);const c=new THREE.Color();meshAt(near,i).getColorAt(near._ri[i],c);tintCorrect&&=c.toArray().every((v,j)=>Math.abs(v-A._c1.toArray()[j])<1e-7);}
check('Damage tint follows relocated instance mappings without coloring another tower',tintCorrect&&rows(far).every((_,i)=>{const c=new THREE.Color();meshAt(far,i).getColorAt(far._ri[i],c);return c.toArray().every((v,j)=>v===unchangedColors[i][j]);}));
for(const o of [near,far])A.STRU.delete(o.id);A.markShape(0);A.rebuildStru();
check('Deleting every structure of one team leaves no stale rendered instances',Array.from(A.struMeshes.values()).filter(m=>m.count).reduce((s,m)=>s+m.count,0)===rows(other).length);

// Every tagged weapon part must stay inside the bounds computed before it moves.
// Test single towers so unrelated nearby geometry cannot hide an insufficient bound.
let variants=0,vertices=0,boundsFailures=0,staticFailures=0,motionFailures=0;
const point=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0),m=new THREE.Matrix4();
for(const t of ['arrow','pulse'])for(let lv=1;lv<=7;lv++)for(const branch of t==='arrow'?['','rapid','sniper']:[''])for(let style=0;style<4;style++){
  reset();const o=add('gun',t,-16,15,style,lv,branch);A.rebuildStru();const b=rows(o);
  const fixed=b.map((r,i)=>r[10]!=='gun'?matrixAt(o,i):null);
  for(let j=0;j<16;j++)for(const kick of [0,1]){
    o.gunYaw=j*Math.PI/8;o.gunKick=kick;A.tickBuildingGuns(0);
    for(let i=0;i<b.length;i++){
      const mesh=meshAt(o,i);mesh.getMatrixAt(o._ri[i],m);
      if(fixed[i]){if(!matrixNear(fixed[i],m,0))staticFailures++;continue;}
      // Turning all vertices at once around the tower anchor provides an independent
      // reference for the production scalar matrix math, including recoil.
      const base=initialMatrix(o,b[i]),recoil=kick*(t==='pulse'?.22:branch==='sniper'?.18:.10);
      const expected=new THREE.Matrix4().makeTranslation(o.x+1,0,o.z+1)
        .multiply(new THREE.Matrix4().makeRotationAxis(axis,o.gunYaw))
        .multiply(new THREE.Matrix4().makeTranslation(-o.x-1,0,-o.z-1-recoil)).multiply(base);
      if(!matrixNear(m,expected))motionFailures++;
      const p=mesh.geometry.attributes.position,sphere=mesh.boundingSphere;
      for(let k=0;k<p.count;k++){
        point.fromBufferAttribute(p,k).applyMatrix4(m);vertices++;
        if(point.distanceTo(sphere.center)>sphere.radius+1e-5){boundsFailures++;break;}
      }
    }
  }
  variants++;
}
check('All turret levels, branches and styles preserve their exact aiming and recoil transforms',motionFailures===0);
check('Tower bodies and roofs remain fixed while the tagged weapons turn',staticFailures===0);
check('Precomputed bounds contain every real weapon vertex through a full turn and maximum recoil',boundsFailures===0);

// Same-group towers ahead and behind the player expose the original wide bank.
// Compare Three.js frustum submissions to a merged bank made from the exact same
// geometry and instance transforms; no screen-distance or quality shortcut.
reset();
for(let i=0;i<24;i++)add('load'+i,['arrow','ice','pulse'][i%3],(i%4)*3-5,i<12?-26-Math.floor(i/4)*3:20+Math.floor((i-12)/4)*3,0,7,i%3===0?'rapid':'');
A.rebuildStru();scene.updateMatrixWorld(true);
const camera=new THREE.PerspectiveCamera(65,16/10,.1,180);camera.position.set(0,13,0);camera.lookAt(0,12,-30);camera.updateMatrixWorld();
const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
const triangleCount=g=>(g.index?g.index.count:g.attributes.position.count)/3;
const merged=new Map();
for(const o of A.STRU.values())for(let i=0;i<rows(o).length;i++){
  const mesh=meshAt(o,i),key=o.g+':'+rows(o)[i][3]+':'+mesh.geometry.uuid;
  let bank=merged.get(key);if(!bank){bank={geometry:mesh.geometry,matrices:[]};merged.set(key,bank);}
  bank.matrices.push(matrixAt(o,i));
}
let submittedBefore=0,drawsBefore=0,submittedAfter=0,drawsAfter=0;
for(const bank of merged.values()){
  const mesh=new THREE.InstancedMesh(bank.geometry,material,bank.matrices.length);bank.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;
  if(frustum.intersectsObject(mesh)){submittedBefore+=triangleCount(mesh.geometry)*mesh.count;drawsBefore++;}mesh.dispose();
}
const poolContents=select=>{
  const expected=new Map();
  for(const o of A.STRU.values())for(let i=0;i<rows(o).length;i++){
    const chunk=meshAt(o,i),key=o._rk[i].split('@')[0];
    let bank=expected.get(key);if(!bank){bank={matrices:[],colors:[],count:0};expected.set(key,bank);}
    if(!select(chunk))continue;
    bank.matrices.push(...chunk.instanceMatrix.array.subarray(o._ri[i]*16,(o._ri[i]+1)*16));
    bank.colors.push(...chunk.instanceColor.array.subarray(o._ri[i]*3,(o._ri[i]+1)*3));bank.count++;
  }
  return expected;
};
const assertPoolContents=select=>{
  const expected=poolContents(select);assert.equal(A.struRenderMeshes.size,expected.size);
  for(const [key,want] of expected){
    const actual=A.struRenderMeshes.get(key)?.mesh;assert.ok(actual,'Every legacy bank has a render pool');
    assert.equal(actual.count,want.count);assert.equal(actual.visible,want.count>0);
    assert.deepEqual(Array.from(actual.instanceMatrix.array.subarray(0,want.count*16)),want.matrices,'Packed matrices retain original part order');
    assert.deepEqual(Array.from(actual.instanceColor.array.subarray(0,want.count*3)),want.colors,'Packed colors remain paired with the original parts');
  }
};
const visibleNow=chunk=>frustum.intersectsSphere(chunk.boundingSphere);
const aim=z=>{camera.lookAt(0,12,z);camera.updateMatrixWorld();frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));};
const versions=()=>Array.from(A.struRenderMeshes.values(),p=>[p.mesh.instanceMatrix.version,p.mesh.instanceColor.version]);
const centers=()=>Array.from(A.struRenderMeshes.values(),p=>p.mesh.boundingSphere.center.toArray());
const startCenters=centers();
A.struRenderSync(null);assertPoolContents(()=>true);
check('All-visible pools preserve every original matrix, color and cross-chunk instance order',true);
check('Only the original number of render banks enters the scene; canonical chunks stay on CPU',A.struRenderMeshes.size===merged.size&&Array.from(A.struMeshes.values()).every(m=>m.parent===null)&&scene.children.length===merged.size);
A.struRenderSync(camera);assertPoolContents(visibleNow);
for(const p of A.struRenderMeshes.values())if(p.mesh.visible&&frustum.intersectsObject(p.mesh)){submittedAfter+=triangleCount(p.mesh.geometry)*p.mesh.count;drawsAfter++;}
check('Buildings outside the viewing frustum reduce submitted geometry without increasing draw calls',submittedAfter<submittedBefore*.75&&drawsAfter<=drawsBefore);
const settledVersions=versions();A.struRenderSync(camera);
check('A stationary camera and unchanged buildings cause no matrix or color uploads',JSON.stringify(versions())===JSON.stringify(settledVersions));
aim(30);A.struRenderSync(camera);assertPoolContents(visibleNow);
aim(-30);A.struRenderSync(camera);assertPoolContents(visibleNow);
check('Turning away and back restores all required parts without changing opaque sort centers',JSON.stringify(centers())===JSON.stringify(startCenters));

// Settle the initial animation flags, then change only a hidden tower.
A.tickBuildingGuns(0);A.struRenderSync(camera);const beforeHidden=versions();
const hidden=A.STRU.get('load12');hidden.hp=23;hidden.gunYaw=1.31;hidden.gunKick=.8;
A.markHp(hidden);A.tintStru();A.tickBuildingGuns(0);A.struRenderSync(camera);
check('Hidden damage and gun motion do not upload unrelated visible chunks',JSON.stringify(versions())===JSON.stringify(beforeHidden));
aim(30);A.struRenderSync(camera);assertPoolContents(visibleNow);
check('An updated offscreen tower reappears with its latest color, aim and recoil',true);
const beforeTint=versions();hidden.hp=54;A.markHp(hidden);A.tintStru();A.struRenderSync(camera);assertPoolContents(visibleNow);
check('Visible damage updates color buffers while leaving matrix versions unchanged',versions().every((v,i)=>v[0]===beforeTint[i][0])&&versions().some((v,i)=>v[1]>beforeTint[i][1]));
const beforeGun=versions();hidden.gunYaw=2.4;A.tickBuildingGuns(0);A.struRenderSync(camera);assertPoolContents(visibleNow);
check('Visible gun motion updates matrix buffers while leaving color versions unchanged',versions().every((v,i)=>v[1]===beforeGun[i][1])&&versions().some((v,i)=>v[0]>beforeGun[i][0]));
gfx.shadow=2048;A.struRenderSync(camera);assertPoolContents(()=>true);
check('Optional shadows include all building chunks, including offscreen casters',Array.from(A.struRenderMeshes.values()).reduce((s,p)=>s+p.mesh.count,0)===Array.from(A.struMeshes.values()).reduce((s,m)=>s+m.count,0));
gfx.shadow=0;A.STRU.clear();A.markShape();A.rebuildStru();
check('Deleting the last building also removes render pools and their scene objects',A.struMeshes.size===0&&A.struRenderMeshes.size===0&&scene.children.length===0);
let disabledControls=true;
for(const search of ['?p81off=struCull','?nocull=1']){
  const control=vm.createContext({...ctx,scene:new THREE.Scene(),GFX:{shadow:0},location:{search}});program.runInContext(control);
  const C=control.A;
  for(const z of [-24,24])C.STRU.set(String(z),{id:String(z),t:'arrow',x:2,z,g:0,lv:7,branch:'rapid',hp:100,mx:100,gunYaw:0,gunKick:0});
  C.rebuildStru();C.struRenderSync(camera);
  const original=Array.from(C.struMeshes.values()).reduce((s,m)=>s+m.count,0),rendered=Array.from(C.struRenderMeshes.values()).reduce((s,p)=>s+p.mesh.count,0);
  disabledControls&&=original>0&&rendered===original;
}
check('Both the structure-specific switch and nocull diagnostic retain all offscreen instances',disabledControls);
const result={checks:checks.length,buildingVariants,variants,vertices,boundsFailures,staticFailures,motionFailures,geometry:{submittedBefore,submittedAfter,drawsBefore,drawsAfter}};
console.log(JSON.stringify(result));
console.log('PASS structure culling: real geometry and transforms preserved; browser pixel comparison and Gram FPS are separate checks.');
