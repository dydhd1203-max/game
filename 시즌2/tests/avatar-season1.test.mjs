import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three.module.js';
import {createSeason1Avatars,APPEARANCE_OPTIONS} from '../src/avatar-season1.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=fs.readFileSync(path.join(root,'클로드/index.html'),'utf8');
const harness=fs.readFileSync(path.join(root,'깃허브에올릴것/검사/t54-avatar-static.mjs'),'utf8');
const loader=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
function reference(){return new Function('source','THREE','vm',loader+'\nreturn context.API;')(source,THREE,vm);}
const actor=extra=>({x:0,y:0,z:0,ry:Math.PI,g:2,ph:0,mv:false,down:false,wp:0,we:0,hat:0,gls:0,clo:0,skin:0,jb:-1,jt:0,...extra});
const array=value=>value?Array.from(value):undefined;
function compareMeshes(actual,expected){
  assert.deepEqual(Object.keys(actual),Object.keys(expected));
  for(const [key,mesh] of Object.entries(actual)){
    const ref=expected[key];assert.equal(mesh.count,ref.count,key+' instance count');
    assert.deepEqual(array(mesh.instanceMatrix.array.slice(0,mesh.count*16)),array(ref.instanceMatrix.array.slice(0,ref.count*16)),key+' matrices');
    assert.deepEqual(array(mesh.instanceColor?.array.slice(0,mesh.count*3)),array(ref.instanceColor?.array.slice(0,ref.count*3)),key+' colors');
  }
}
test('Season 2 uses the exact Season 1 geometry, materials and full cosmetic names',()=>{
  const api=createSeason1Avatars(THREE,new THREE.Scene()),a=api.inspect(),b=reference();
  for(const [key,m] of Object.entries(a.meshes)){
    const r=b.meshes[key];assert.equal(m.material.type,r.material.type,key);
    assert.equal(m.material.color.getHex(),r.material.color.getHex(),key);
    assert.equal(m.material.shininess,r.material.shininess,key);
    for(const [name,attr] of Object.entries(m.geometry.attributes))assert.deepEqual(array(attr.array),array(r.geometry.attributes[name].array),key+' '+name);
    assert.deepEqual(array(m.geometry.index?.array),array(r.geometry.index?.array),key+' index');
  }
  assert.equal(APPEARANCE_OPTIONS.hats.length,17);assert.equal(APPEARANCE_OPTIONS.faces.length,12);assert.equal(APPEARANCE_OPTIONS.clothes.length,14);
  assert.equal(APPEARANCE_OPTIONS.hats[4],'토끼 귀');assert.equal(APPEARANCE_OPTIONS.clothes[2],'민트 고양이 파자마');
  api.dispose();
});
test('Original idle, moving, turning, jumping, downed and armed matrices match exactly',()=>{
  const api=createSeason1Avatars(THREE,new THREE.Scene()),a=api.inspect(),b=reference();
  const scenarios=[{}, {mv:true,run:false},{mv:true,run:true},{air:true,vy:4,take:.08},{air:true,vy:0},
    {air:true,vy:-4},{land:.18},{act:'mine',actP:.64,tool:'mine'},{act:'work',actP:.36,tool:'work'},
    {act:'throw',actP:.45},{wp:3},{wp:3,kick:1},{down:true},{hat:9,gls:8,clo:2},
    {jb:1,jt:2,air:true,vy:-2,glide:true}];
  for(const setup of scenarios){const s=actor(setup),r=actor(setup);
    for(let i=0;i<36;i++){
      s.x=r.x=i*(setup.run?.12:setup.mv?.065:0);s.ry=r.ry=Math.PI+i*.018;
      a.drawSheep([s],i/60+1,40,()=>0x51cf66,.70);b.drawSheep([r],i/60+1,40,()=>0x51cf66,.70);
      compareMeshes(a.meshes,b.meshes);
    }
  }
  for(const [key,field] of [['hats','hat'],['faces','gls'],['clothes','clo']])for(let id=0;id<APPEARANCE_OPTIONS[key].length;id++){
    a.drawSheep([actor({[field]:id})],4,40,()=>0x51cf66,.70);b.drawSheep([actor({[field]:id})],4,40,()=>0x51cf66,.70);compareMeshes(a.meshes,b.meshes);
  }
  api.dispose();
});
test('21-player snapshots keep animation history, retain source culling and clear removed actors',()=>{
  const scene=new THREE.Scene(),api=createSeason1Avatars(THREE,scene),a=api.inspect();
  let firstActor;
  for(let frame=0;frame<90;frame++){
    const snapshot=Object.fromEntries(Array.from({length:21},(_,i)=>['p'+i,{id:'p'+i,x:i*2+frame/20,z:0,yaw:-Math.PI/2,team:i%5,hp:100,hat:i%17,face:i%12,clothes:i%14}]));
    api.render(snapshot,'p0',frame/60,1/60);
    firstActor??=a.actors.get('p0');assert.equal(a.actors.get('p0'),firstActor);
    assert.equal(a.meshes.body.count,21);assert.equal(a.meshes.arm.count,84);assert.equal(a.meshes.shoes.count,42);
    assert.ok(Object.values(a.meshes).every(m=>m.count<=m.instanceMatrix.count));
    assert.ok(a.meshes.body.instanceMatrix.array.slice(0,21*16).every(Number.isFinite));
  }
  assert.ok(a.sheepGait(firstActor,89/60).gp>1,'history advances across newly allocated snapshots');
  const far={id:'far',x:100,z:100,hp:100},near={id:'local',x:0,z:0,hp:100};
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4());
  api.render([far,near],'local',2,1/60,frustum);assert.equal(a.meshes.body.count,1);assert.equal(a.actors.size,2);
  api.render([far,near],'local',3,1/60);assert.equal(a.meshes.body.count,2);
  api.render([],'local',4,1/60);assert.equal(a.actors.size,0);assert.equal(a.meshes.body.count,0);
  api.dispose();assert.equal(scene.children.length,0);api.dispose();
});
