import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {convertWorkshopGLB} from '../tools/import-workshop-glb.mjs';
import {WORKSHOP_MODEL_INFO,WORKSHOP_VERTEX_DATA,WORKSHOP_INDEX_DATA} from '../src/workshop-model-data.mjs';
import {appendWorkshopModel} from '../src/workshop-model.mjs';
import {buildVillageA} from '../src/village-a.mjs';
import {VILLAGE_SITES} from '../src/content.mjs';

// Tiny authored-like GLB for transform, inclusion and invalid-input checks.
// This deliberately exercises data interchange, not a copy of the converter.
function fixture({name='HERO_triangle',translation=[1,0,0],doubleSided=false,texture=false}={}){
  const positions=[0,.2,0,1,.2,0,0,1.2,0],normals=[0,0,1,0,0,1,0,0,1];
  const binary=Buffer.alloc(72);[...positions,...normals].forEach((n,i)=>binary.writeFloatLE(n,i*4));
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,2]}],
    nodes:[{name:'HERO_root',translation,children:[1]},{name,mesh:0},{name:'ENV_backdrop',mesh:0,translation:[100,0,0]}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},material:0}]}],
    materials:[{doubleSided,pbrMetallicRoughness:{baseColorFactor:[.8,.4,.2,1]}}],
    buffers:[{byteLength:72}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5126,count:3,type:'VEC3'}],
    ...(texture?{textures:[{source:0}]}:{})};
  const text=Buffer.from(JSON.stringify(json)),padding=(4-text.length%4)%4,jsonBytes=Buffer.concat([text,Buffer.alloc(padding,32)]);
  const glb=Buffer.alloc(12+8+jsonBytes.length+8+binary.length);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(jsonBytes.length,12);glb.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(glb,20);
  const offset=20+jsonBytes.length;glb.writeUInt32LE(binary.length,offset);glb.writeUInt32LE(0x004e4942,offset+4);binary.copy(glb,offset+8);
  return glb;
}

test('GLB import preserves parent transforms and excludes Blender environment',()=>{
  const result=convertWorkshopGLB(fixture());assert.equal(result.metadata.sourceTriangles,1);assert.equal(result.metadata.triangles,1);
  assert.deepEqual(result.metadata.bounds.min,[1,.2,0]);assert.deepEqual(result.metadata.bounds.max,[2,1.2,0]);
  assert.equal(result.metadata.parts.length,1);assert.equal(result.metadata.parts[0].name,'HERO_triangle');
  const double=convertWorkshopGLB(fixture({doubleSided:true}));assert.equal(double.metadata.sourceTriangles,1);assert.equal(double.metadata.triangles,2);
  const ids=Buffer.from(double.indices,'base64');assert.deepEqual(Array.from({length:6},(_,i)=>ids.readUInt16LE(i*2)),[0,1,2,0,2,1]);
});

test('GLB import rejects corrupt, unsupported and out-of-plot assets',()=>{
  assert.throws(()=>convertWorkshopGLB(fixture().subarray(0,40)),/complete/);
  assert.throws(()=>convertWorkshopGLB(fixture({texture:true})),/textures/);
  assert.throws(()=>convertWorkshopGLB(fixture({translation:[8,0,0]})),/reserved plot/);
});

test('checked-in workshop data matches its complete Blender source',async()=>{
  const source=await readFile(new URL('../assets/workshop.glb',import.meta.url));
  const result=convertWorkshopGLB(source);
  assert.equal(WORKSHOP_MODEL_INFO.sourceSha256,createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(result.metadata,WORKSHOP_MODEL_INFO,'Re-importing actual GLB reproduces metadata');
  assert.equal(result.vertices,WORKSHOP_VERTEX_DATA,'Re-importing actual GLB reproduces all vertex positions/colours');
  assert.equal(result.indices,WORKSHOP_INDEX_DATA,'Re-importing actual GLB reproduces topology');
  assert.ok(result.metadata.sourceTriangles>1000&&result.metadata.triangles<=45000,'Real detailed model stays within static triangle budget');
  assert.ok(result.metadata.bounds.radius<=5.7&&result.metadata.bounds.max[1]<=9.8,'Model fits existing collision/camera envelope');
  assert.ok(result.metadata.materials<=8&&result.metadata.parts.length>5,'Authored parts share a bounded material palette');
  // Blender may export a white COLOR_0 alongside authored AO in COLOR_1.
  // Check the channel consumed by the game, not merely a colour count.
  const jsonLength=source.readUInt32LE(12),glb=JSON.parse(source.subarray(20,20+jsonLength));
  const binary=source.subarray(28+jsonLength);let low=1,high=0;
  for(const mesh of glb.meshes)for(const primitive of mesh.primitives){
    assert.equal(primitive.attributes.COLOR_1,undefined,'Contact shading is promoted to the runtime channel');
    const a=glb.accessors[primitive.attributes.COLOR_0],v=glb.bufferViews[a.bufferView];
    assert.equal(a.componentType,5123);assert.equal(a.normalized,true);
    const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||8;
    for(let i=0;i<a.count;i++){const c=binary.readUInt16LE(start+i*stride)/65535;low=Math.min(low,c);high=Math.max(high,c);}
  }
  assert.ok(low>0&&low<.9&&high<=1,'Authored contact shading is nonconstant and bounded');
});

test('actual village mesh includes every imported triangle in one shared static batch',()=>{
  const scene=new THREE.Scene(),resources=new Set(),art=buildVillageA(THREE,scene,resources),site=VILLAGE_SITES.workshop;
  try{
    const workshop=scene.getObjectByName('village-a:workshop');assert.ok(workshop?.isMesh);
    const origin=new THREE.Matrix4().makeRotationY(.25);origin.setPosition(site.x,0,site.z);
    const expected={positions:[],colors:[],uvs:[]};appendWorkshopModel(expected,origin);
    const actual=workshop.geometry.attributes;
    assert.ok(actual.position.count>=WORKSHOP_MODEL_INFO.triangles*3,'GPU geometry has all imported triangles');
    // The importer appends the model before the retained yard detail. Compare
    // the buffer actually used by the world mesh, not only its metadata.
    assert.deepEqual(actual.position.array.subarray(0,expected.positions.length),new Float32Array(expected.positions));
    assert.deepEqual(actual.color.array.subarray(0,expected.colors.length),new Float32Array(expected.colors));
    assert.deepEqual(actual.uv.array.subarray(0,expected.uvs.length),new Float32Array(expected.uvs));
    assert.equal(workshop.matrixAutoUpdate,false);
    const opaque=art.meshes.filter(mesh=>!mesh.material.transparent);
    assert.equal(opaque.length,6,'One existing opaque batch per landmark');
    assert.equal(new Set(opaque.map(mesh=>mesh.material)).size,1,'All opaque village landmarks share their material');
    assert.ok(!scene.children.some(obj=>obj.isLight),'Model adds no realtime light');
    assert.equal(art.stats.perFrameUpdates,0);assert.equal(art.stats.textures,1);
    const colours=new Set();for(let i=0;i<expected.colors.length;i+=3)colours.add(expected.colors.slice(i,i+3).map(n=>n.toFixed(2)).join(','));
    assert.ok(colours.size>40,'Baked model retains varied material/AO colours');
    const box=workshop.geometry.boundingBox;assert.ok(box.max.y-box.min.y>5,'Rendered model has real vertical volume');
  }finally{for(const resource of resources)resource.dispose?.();}
});
