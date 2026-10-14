import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.js';

const ROOT=new URL('../',import.meta.url);
const DEFAULT_OUTPUT=fileURLToPath(new URL('src/village-model-data.mjs',ROOT));
export const VILLAGE_MODEL_SPECS=Object.freeze({
  wagon:{radius:4.9,height:6.4,triangles:26000,placementYaw:-.17},
  market:{radius:4.5,height:4.9,triangles:22000,placementYaw:-.23},
  assembly:{radius:4.4,height:4,triangles:20000,placementYaw:.17},
  smithYard:{radius:3.3,height:4.1,triangles:18000,placementYaw:.06},
  supplyYard:{radius:3.2,height:3.9,triangles:18000,placementYaw:-.12},
});
const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const TYPES={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};

// Authored Blender assets remain the source. Bake once at build time into the
// same compact indexed format as the accepted workshop, including its daylight.
// Runtime needs no loader, fetch, individual material or animation for a prop.
export function convertVillageGLB(input,{name,source=`assets/village-${name}.glb`,...overrides}={}){
  if(!Object.hasOwn(VILLAGE_MODEL_SPECS,name))throw Error('Unknown village model '+name);
  const spec=VILLAGE_MODEL_SPECS[name];
  const limits={...spec,...overrides};
  if(!Number.isFinite(limits.placementYaw))throw Error('A finite placement yaw is required.');
  const bytes=new Uint8Array(input.buffer??input,input.byteOffset??0,input.byteLength),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw Error('Expected a complete glTF 2 GLB.');
  let gltf,bin;
  for(let offset=12;offset<bytes.length;){
    if(offset+8>bytes.length)throw Error('Truncated GLB chunk header.');
    const size=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(offset+size>bytes.length)throw Error('Truncated GLB chunk.');
    if(type===0x4e4f534a){if(gltf)throw Error('Duplicate GLB JSON chunk.');gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(offset,offset+size)).trim());}
    else if(type===0x004e4942){if(bin)throw Error('Duplicate GLB binary chunk.');bin=bytes.subarray(offset,offset+size);}
    offset+=size;
  }
  if(!gltf||!bin)throw Error('GLB requires JSON and an embedded binary buffer.');
  if(gltf.animations?.length||gltf.skins?.length||gltf.textures?.length||gltf.images?.length)throw Error('Village models require static opaque meshes, without textures/skins/animation.');
  if(gltf.buffers?.length!==1||gltf.buffers[0].uri||gltf.buffers[0].byteLength>bin.byteLength)throw Error('Village models require one complete embedded buffer.');
  const required=(gltf.extensionsRequired??[]).filter(extension=>extension!=='KHR_lights_punctual');
  if(required.length)throw Error('Unsupported required glTF extension: '+required.join(', '));
  const binary=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
  function accessor(id){
    const a=gltf.accessors?.[id],b=gltf.bufferViews?.[a?.bufferView],type=TYPES[a?.componentType],width=COMPONENTS[a?.type];
    if(!a||!b||!type||!width||a.sparse||b.buffer!==0||!Number.isInteger(a.count)||a.count<=0)throw Error('Unsupported or missing GLB accessor '+id);
    const stride=b.byteStride??type[1]*width,relative=a.byteOffset??0,start=(b.byteOffset??0)+relative,last=relative+(a.count-1)*stride+width*type[1];
    if(!Number.isInteger(stride)||stride<type[1]*width||relative<0||start<0||last>b.byteLength||(b.byteOffset??0)+b.byteLength>bin.byteLength)throw Error('GLB accessor overruns its binary buffer view.');
    return {count:a.count,width,read(i){const result=[];for(let c=0;c<width;c++){let v=binary[type[0]](start+i*stride+c*type[1],true);if(a.normalized&&a.componentType!==5126)v=Math.max(-1,v/type[2]);if(!Number.isFinite(v))throw Error('GLB accessor contains a non-finite number.');result.push(v);}return result;}};
  }
  const materials=gltf.materials??[],records=[],indices=[],dedup=new Map(),parts=[],usedMaterials=new Set();
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],radius:0};
  const up=new THREE.Vector3(0,1,0),sun=new THREE.Vector3(-.55,.86,.38).normalize().applyAxisAngle(up,-limits.placementYaw);
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),worldNormal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  let sourceTriangles=0;
  function mesh(node,world){
    const src=gltf.meshes?.[node.mesh];if(!src)throw Error('Missing village mesh.');
    normalMatrix.getNormalMatrix(world);let partTriangles=0;
    for(const primitive of src.primitives){
      if((primitive.mode??4)!==4||primitive.targets||primitive.extensions)throw Error('Village models require plain static triangle primitives.');
      const p=accessor(primitive.attributes.POSITION),n=accessor(primitive.attributes.NORMAL),c=primitive.attributes.COLOR_0===undefined?null:accessor(primitive.attributes.COLOR_0),ix=primitive.indices===undefined?null:accessor(primitive.indices);
      if(p.width!==3||n.width!==3||n.count!==p.count||c&&(c.count!==p.count||![3,4].includes(c.width))||ix&&ix.width!==1)throw Error('Village position, normal, colour or index arrays disagree.');
      const mat=materials[primitive.material]??{},base=mat.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1],emissive=mat.emissiveFactor??[0,0,0];
      if(base.length!==4||emissive.length!==3||[...base,...emissive].some(value=>!Number.isFinite(value)||value<0))throw Error('Invalid village material colour.');
      if((mat.alphaMode??'OPAQUE')!=='OPAQUE'||base[3]<1)throw Error('Transparent village materials are not supported.');
      if(primitive.material!==undefined){if(!materials[primitive.material])throw Error('Missing village material.');usedMaterials.add(primitive.material);}
      const remap=[];
      for(let i=0;i<p.count;i++){
        point.fromArray(p.read(i)).applyMatrix4(world);normal.fromArray(n.read(i)).applyMatrix3(normalMatrix).normalize();
        if(!normal.lengthSq())throw Error('Village vertex normal must not be zero.');
        const col=c?c.read(i):[1,1,1,1];if(col[3]!==undefined&&col[3]<.999)throw Error('Village vertex alpha must be opaque.');
        if(col.some(value=>value<0||value>1.00001))throw Error('Village vertex colour must be normalized.');
        const shade=.47+.53*Math.max(0,normal.dot(sun)),position=point.toArray().map(value=>Math.round(value*1000));
        if(position.some(value=>!Number.isFinite(value)||value<-32768||value>32767))throw Error('Village position exceeds the millimetre encoding range.');
        const colour=base.slice(0,3).map((value,k)=>Math.round(Math.max(0,Math.min(1,value*col[k]*shade+emissive[k]*col[k]))*65535));
        // Triplanar grain follows the placed world normal, matching surrounding
        // procedurally authored details even when a landmark is rotated.
        worldNormal.copy(normal).applyAxisAngle(up,limits.placementYaw);
        const axis=Math.abs(worldNormal.y)>=Math.abs(worldNormal.x)&&Math.abs(worldNormal.y)>=Math.abs(worldNormal.z)?1:Math.abs(worldNormal.x)>Math.abs(worldNormal.z)?0:2;
        const record=[...position,...colour,axis],key=record.join(','),existing=dedup.get(key);
        if(existing!==undefined)remap.push(existing);else{const index=records.length;records.push(record);dedup.set(key,index);remap.push(index);}
        for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],position[k]/1000);bounds.max[k]=Math.max(bounds.max[k],position[k]/1000);}
        bounds.radius=Math.max(bounds.radius,Math.hypot(position[0],position[2])/1000);
      }
      const count=ix?ix.count:p.count;if(count%3)throw Error('Incomplete village triangle.');
      const invert=world.determinant()<0;
      for(let i=0;i<count;i+=3){
        const triangle=[0,1,2].map(k=>ix?ix.read(i+k)[0]:i+k);
        if(triangle.some(k=>!Number.isInteger(k)||k<0||k>=p.count))throw Error('Village triangle index is out of bounds.');
        const v=triangle.map(k=>remap[k]);indices.push(v[0],v[invert?2:1],v[invert?1:2]);
        if(mat.doubleSided)indices.push(v[0],v[invert?1:2],v[invert?2:1]);
      }
      sourceTriangles+=count/3;partTriangles+=count/3;
    }
    parts.push({name:node.name??src.name??'HERO_mesh',triangles:partTriangles});
  }
  function visit(id,parent,hero=false,stack=new Set()){
    if(stack.has(id))throw Error('Cyclic glTF node hierarchy.');
    const node=gltf.nodes?.[id];if(!node)throw Error('Missing GLB scene node.');
    const nodeName=node.name??'';if(/^(ENV_|CAM_|LGT_)/.test(nodeName))return;
    const local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3().fromArray(node.translation??[0,0,0]),new THREE.Quaternion().fromArray(node.rotation??[0,0,0,1]),new THREE.Vector3().fromArray(node.scale??[1,1,1]));
    if(local.elements.some(value=>!Number.isFinite(value))||Math.abs(local.determinant())<1e-12)throw Error('Village node transform must be finite and invertible.');
    const world=parent.clone().multiply(local),included=hero||nodeName.startsWith('HERO_');
    if(included&&node.mesh!==undefined)mesh(node,world);
    const next=new Set(stack);next.add(id);for(const child of node.children??[])visit(child,world,included,next);
  }
  for(const id of gltf.scenes?.[gltf.scene??0]?.nodes??[])visit(id,new THREE.Matrix4());
  if(!indices.length)throw Error('No HERO_ village mesh found.');
  if(usedMaterials.size>8)throw Error('Village model exceeds eight shared materials.');
  if(indices.length/3>limits.triangles)throw Error(`${name} exceeds ${limits.triangles} baked triangles.`);
  if(bounds.radius>limits.radius||bounds.max[1]>limits.height||bounds.min[1]<-.05)throw Error(`${name} exceeds the reserved plot/height: `+JSON.stringify(bounds));
  const packed=Buffer.alloc(records.length*13),indexBytes=records.length>65535?4:2,indexBuffer=Buffer.alloc(indices.length*indexBytes);
  for(let i=0;i<records.length;i++){const record=records[i],offset=i*13;for(let k=0;k<3;k++)packed.writeInt16LE(record[k],offset+k*2);for(let k=0;k<3;k++)packed.writeUInt16LE(record[k+3],offset+6+k*2);packed[offset+12]=record[6];}
  for(let i=0;i<indices.length;i++)indexBytes===2?indexBuffer.writeUInt16LE(indices[i],i*2):indexBuffer.writeUInt32LE(indices[i],i*4);
  const metadata={format:1,name,source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length,sourceTriangles,triangles:indices.length/3,vertices:records.length,indexBytes,packedBytes:packed.length+indexBuffer.length,materials:usedMaterials.size,parts,bounds,placementYaw:limits.placementYaw};
  return {metadata,vertices:packed.toString('base64'),indices:indexBuffer.toString('base64')};
}

export async function importVillageModels({inputRoot=new URL('assets/',ROOT),output=DEFAULT_OUTPUT,quiet=false}={}){
  const models={},metadata={};let triangles=0;
  for(const name of Object.keys(VILLAGE_MODEL_SPECS)){
    const input=new URL(`village-${name}.glb`,inputRoot),data=convertVillageGLB(await readFile(input),{name});
    models[name]={vertices:data.vertices,indices:data.indices};metadata[name]=data.metadata;triangles+=data.metadata.triangles;
  }
  if(triangles>85000)throw Error('Village expansion exceeds 85,000 baked triangles.');
  await writeFile(output,'// Generated by tools/import-village-glb.mjs from the Blender GLBs. Do not edit.\n'+
    'export const VILLAGE_MODEL_INFO=Object.freeze('+JSON.stringify(metadata)+');\n'+
    'export const VILLAGE_MODEL_DATA=Object.freeze('+JSON.stringify(models)+');\n');
  if(!quiet)console.log(JSON.stringify({models:Object.fromEntries(Object.entries(metadata).map(([name,info])=>[name,{triangles:info.triangles,vertices:info.vertices,materials:info.materials,sourceSha256:info.sourceSha256,bounds:info.bounds,placementYaw:info.placementYaw}])),triangles,output},null,2));
  return {metadata,models};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await importVillageModels();
