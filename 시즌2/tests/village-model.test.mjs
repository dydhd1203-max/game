import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {convertVillageGLB,importVillageModels,VILLAGE_MODEL_SPECS} from '../tools/import-village-glb.mjs';
import {VILLAGE_MODEL_INFO,VILLAGE_MODEL_DATA} from '../src/village-model-data.mjs';
import {appendVillageModel} from '../src/village-model.mjs';

function fixture({translation=[1,0,0],scale=[1,1,1],doubleSided=false,texture=false,mutate=()=>{}}={}){
  const positions=[0,.2,0,1,.2,0,0,1.2,0],normals=[0,0,1,0,0,1,0,0,1],colors=[.5,.5,.5,1,1,1,1,1,.75,.75,.75,1];
  const binary=Buffer.alloc(120);[...positions,...normals,...colors].forEach((value,i)=>binary.writeFloatLE(value,i*4));
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,2]}],
    nodes:[{name:'HERO_root',translation,scale,children:[1]},{name:'canopy',mesh:0},{name:'ENV_backdrop',mesh:0,translation:[100,0,0]}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},material:0}]}],
    materials:[{doubleSided,pbrMetallicRoughness:{baseColorFactor:[.8,.4,.2,1]}}],
    buffers:[{byteLength:120}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:48}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5126,count:3,type:'VEC3'},{bufferView:2,componentType:5126,count:3,type:'VEC4'}],
    ...(texture?{textures:[{source:0}]}:{})};
  mutate(json,binary);
  const text=Buffer.from(JSON.stringify(json)),jsonBytes=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),glb=Buffer.alloc(28+jsonBytes.length+binary.length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(jsonBytes.length,12);glb.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(glb,20);
  const offset=20+jsonBytes.length;glb.writeUInt32LE(binary.length,offset);glb.writeUInt32LE(0x004e4942,offset+4);binary.copy(glb,offset+8);return glb;
}
const convert=(input,options={})=>convertVillageGLB(input,{name:'market',...options});

test('village GLB conversion keeps nested geometry, AO and correctly placed world sunlight',()=>{
  const a=convert(fixture(),{placementYaw:0}),b=convert(fixture(),{placementYaw:Math.PI});
  assert.equal(a.metadata.sourceTriangles,1);assert.equal(a.metadata.parts.length,1);assert.equal(a.metadata.parts[0].name,'canopy');
  assert.deepEqual(a.metadata.bounds.min,[1,.2,0]);assert.deepEqual(a.metadata.bounds.max,[2,1.2,0]);
  const av=Buffer.from(a.vertices,'base64'),bv=Buffer.from(b.vertices,'base64');
  assert.ok(av.readUInt16LE(6)>bv.readUInt16LE(6),'Yaw rotates front-facing daylight into the world sun');
  const shade=.47+.53*(.38/Math.hypot(-.55,.86,.38));
  assert.equal(av.readUInt16LE(6),Math.round(.8*.5*shade*65535),'Material base colour is multiplied by authored AO and daylight');
  assert.ok(Math.abs(av.readUInt16LE(19)/av.readUInt16LE(6)-2)<.001,'Nonconstant AO is retained');
  const mirrored=convert(fixture({scale:[-1,1,1]})),double=convert(fixture({doubleSided:true}));
  const ids=result=>{const buf=Buffer.from(result.indices,'base64');return Array.from({length:buf.length/2},(_,i)=>buf.readUInt16LE(i*2));};
  assert.deepEqual(ids(mirrored),[0,2,1],'Mirrored nodes preserve front-face winding');
  assert.deepEqual(ids(double),[0,1,2,0,2,1],'Fabric back faces stay in the existing opaque batch');
});

test('village GLB gates reject malformed geometry, new runtime features and oversized plots',()=>{
  assert.throws(()=>convert(fixture().subarray(0,40)),/complete/);
  assert.throws(()=>convert(fixture({texture:true})),/textures/);
  assert.throws(()=>convert(fixture({translation:[8,0,0]})),/reserved plot/);
  assert.throws(()=>convert(fixture({translation:[0,5,0]})),/reserved plot/);
  assert.throws(()=>convert(fixture(),{triangles:0}),/baked triangles/);
  assert.throws(()=>convert(fixture({scale:[0,1,1]})),/invertible/);
  assert.throws(()=>convert(fixture({mutate:json=>{json.nodes[1].children=[0];}})),/Cyclic/);
  assert.throws(()=>convert(fixture({mutate:json=>{json.accessors[0].count=4;}})),/overruns/);
  assert.throws(()=>convert(fixture({mutate:(_json,bin)=>{bin.writeFloatLE(NaN,0);}})),/non-finite/);
  assert.throws(()=>convert(fixture({mutate:json=>{json.materials[0].alphaMode='BLEND';}})),/Transparent/);
  assert.throws(()=>convert(fixture({mutate:json=>{json.nodes[0].name='not-a-landmark';}})),/No HERO_/);
  assert.throws(()=>convertVillageGLB(fixture(),{name:'other'}),/Unknown/);
});

test('all five checked-in village assets regenerate exactly with bounded opaque AO geometry',async()=>{
  let total=0;
  assert.deepEqual(Object.keys(VILLAGE_MODEL_INFO),Object.keys(VILLAGE_MODEL_SPECS));
  for(const [name,spec] of Object.entries(VILLAGE_MODEL_SPECS)){
    const bytes=await readFile(new URL(`../assets/village-${name}.glb`,import.meta.url)),result=convertVillageGLB(bytes,{name}),info=VILLAGE_MODEL_INFO[name],data=VILLAGE_MODEL_DATA[name];
    assert.equal(info.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(result.metadata,info,`${name}: source metadata is current`);assert.equal(result.vertices,data.vertices);assert.equal(result.indices,data.indices);
    assert.ok(info.sourceTriangles>1000&&info.triangles<=spec.triangles,`${name}: authored detail fits its triangle budget`);
    assert.ok(info.bounds.radius<=spec.radius&&info.bounds.max[1]<=spec.height&&info.bounds.min[1]>=-.05,`${name}: complete silhouette fits its collision plot`);
    assert.ok(info.materials<=8&&info.parts.length>5,`${name}: real authored parts share a bounded palette`);
    assert.equal(info.placementYaw,spec.placementYaw);
    const vertices=Buffer.from(data.vertices,'base64'),indices=Buffer.from(data.indices,'base64');
    assert.equal(vertices.length,info.vertices*13);assert.equal(indices.length,info.triangles*3*info.indexBytes);
    for(let i=0;i<info.triangles*3;i++)assert.ok((info.indexBytes===2?indices.readUInt16LE(i*2):indices.readUInt32LE(i*4))<info.vertices,`${name}: every encoded triangle index is valid`);
    for(let i=0;i<info.vertices;i++)assert.ok(vertices[i*13+12]<=2,`${name}: valid world-grain projection axis`);
    const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);let low=1,high=0;
    for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
      assert.equal(primitive.attributes.COLOR_1,undefined,`${name}: AO must be in the consumed COLOR_0 channel`);
      const accessor=gltf.accessors[primitive.attributes.COLOR_0];assert.ok(accessor,`${name}: authored AO is exported`);
      const bufferView=gltf.bufferViews[accessor.bufferView],components=accessor.type==='VEC4'?4:3,typeSize=accessor.componentType===5126?4:accessor.componentType===5123?2:1;
      const start=(bufferView.byteOffset??0)+(accessor.byteOffset??0),stride=bufferView.byteStride??components*typeSize;
      for(let i=0;i<accessor.count;i++){const offset=start+i*stride,c=accessor.componentType===5126?binary.readFloatLE(offset):accessor.componentType===5123?binary.readUInt16LE(offset)/65535:binary.readUInt8(offset)/255;low=Math.min(low,c);high=Math.max(high,c);}
    }
    assert.ok(low>0&&low<.9&&high>low&&high<=1,`${name}: nonconstant bounded contact shading survives the GLB`);
    total+=info.triangles;
  }
  assert.ok(total<=85000,'Five models together stay inside the expansion triangle budget');
  const directory=await mkdtemp(path.join(tmpdir(),'village-convert-'));
  try{
    const output=path.join(directory,'models.mjs');await importVillageModels({output,quiet:true});
    assert.equal(await readFile(output,'utf8'),await readFile(new URL('../src/village-model-data.mjs',import.meta.url),'utf8'),'The production generator reproduces the entire committed module');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('runtime append places all authored triangles in existing buffers without replacing their contents',()=>{
  for(const name of Object.keys(VILLAGE_MODEL_INFO)){
    const info=VILLAGE_MODEL_INFO[name],data=VILLAGE_MODEL_DATA[name],vertices=Buffer.from(data.vertices,'base64'),indices=Buffer.from(data.indices,'base64');
    const origin=new THREE.Matrix4().makeRotationY(info.placementYaw);origin.setPosition(-7,.125,12);
    const bin={positions:[1,2,3],colors:[.1,.2,.3],uvs:[4,5]};appendVillageModel(bin,origin,name);
    assert.deepEqual(bin.positions.slice(0,3),[1,2,3]);assert.deepEqual(bin.colors.slice(0,3),[.1,.2,.3]);assert.deepEqual(bin.uvs.slice(0,2),[4,5]);
    assert.equal(bin.positions.length,3+info.triangles*9);assert.equal(bin.colors.length,bin.positions.length);assert.equal(bin.uvs.length,2+info.triangles*6);
    const world=new THREE.Vector3();
    for(let i=0;i<info.triangles*3;i++){
      const index=info.indexBytes===2?indices.readUInt16LE(i*2):indices.readUInt32LE(i*4),offset=index*13,p=3+i*3,uv=2+i*2;
      world.set(vertices.readInt16LE(offset)/1000,vertices.readInt16LE(offset+2)/1000,vertices.readInt16LE(offset+4)/1000).applyMatrix4(origin);
      for(let k=0;k<3;k++){assert.equal(bin.positions[p+k],Math.fround(world.getComponent(k)));assert.equal(bin.colors[p+k],Math.fround(vertices.readUInt16LE(offset+6+k*2)/65535));}
      const axis=vertices[offset+12];assert.equal(bin.uvs[uv],Math.fround((axis===0?world.z:world.x)*1.7));assert.equal(bin.uvs[uv+1],Math.fround((axis===1?world.z:world.y)*1.7));
    }
  }
  assert.throws(()=>appendVillageModel({positions:[],colors:[],uvs:[]},new THREE.Matrix4(),'other'),/Unknown/);
});
