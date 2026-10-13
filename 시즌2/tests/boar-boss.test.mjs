import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBoarBoss} from '../src/boar-boss.mjs';

const boss=extra=>({x:3,z:-100,yaw:.3,hp:620,maxHp:620,phase:'idle',timer:1,...extra});

test('boar has bounded, finite geometry and no added lights, textures or shadows',()=>{
  const scene=new THREE.Scene(),resources=new Set(),api=createBoarBoss(THREE,scene,resources);
  let draws=0,triangles=0;
  scene.traverse(node=>{
    assert.ok(!node.isLight);
    if(!node.isMesh)return;
    draws++;triangles+=node.geometry.getAttribute('position').count/3;
    assert.equal(node.castShadow,false);assert.equal(node.material.map,null);
    for(const attr of Object.values(node.geometry.attributes))for(const value of attr.array)assert.ok(Number.isFinite(value));
    assert.ok(node.geometry.boundingSphere.radius>0);
  });
  assert.equal(draws,api.stats.draws);assert.equal(triangles,api.stats.triangles);
  assert.ok(draws<=12);assert.ok(triangles<=12000);
  api.update(boss({x:0,z:0,yaw:0}),0,true);
  const bounds=new THREE.Box3().setFromObject(api.root);
  assert.ok(bounds.max.y<6&&bounds.max.y>4.5,'four to five Season 1 character heights');
  assert.ok(bounds.max.x-bounds.min.x<5.2,'fits existing warning lane width');
  assert.ok(bounds.min.y>-.15,'idle hooves stand on the floor');
  api.dispose();assert.equal(resources.size,0);assert.equal(scene.children.length,0);
});

test('all combat poses reuse buffers and preserve simulation state; culling and disposal stop drawing',()=>{
  const scene=new THREE.Scene(),resources=new Set(),api=createBoarBoss(THREE,scene,resources);
  const geometries=[],buffers=[],versions=[];
  scene.traverse(n=>{if(n.isMesh){geometries.push(n.geometry);buffers.push(n.geometry.attributes.position.array);versions.push(n.geometry.attributes.position.version);}});
  const head=api.root.getObjectByName('boar-head-pivot'),foot=api.root.getObjectByName('boar-leg-1');
  const pitches={};
  for(const phase of ['idle','warn','charge','recover']){
    const state=boss({phase,timer:.2}),before=structuredClone(state);
    for(let i=0;i<180;i++){
      api.update(state,i/60,true);scene.updateMatrixWorld(true);
      api.root.traverse(node=>{for(const value of node.matrixWorld.elements)assert.ok(Number.isFinite(value));});
    }
    pitches[phase]=head.rotation.x;assert.deepEqual(state,before);
  }
  assert.ok(pitches.warn>pitches.idle+.2,'warning clearly lowers muzzle');
  assert.ok(pitches.recover<pitches.idle-.05,'recovery lifts muzzle');
  api.update(boss({phase:'charge'}),.1,true);const gait=foot.rotation.x;
  api.update(boss({phase:'charge'}),.2,true);assert.notEqual(foot.rotation.x,gait);
  geometries.forEach((geo,i)=>{assert.equal(geo.attributes.position.array,buffers[i]);assert.equal(geo.attributes.position.version,versions[i]);});
  assert.equal(resources.size,10);
  api.update(boss(),1,false);assert.equal(api.root.visible,false);
  api.update(boss({hp:0}),1,true);assert.equal(api.root.visible,false);
  api.update(null,1,true);assert.equal(api.root.visible,false);
  api.update(boss(),1,true);assert.equal(api.root.visible,true);
  let disposals=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposals++);
  api.dispose();api.dispose();api.update(boss(),2,true);
  assert.equal(api.root.visible,false);assert.equal(disposals,10);assert.equal(resources.size,0);
});
