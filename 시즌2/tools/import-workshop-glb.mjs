import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.js';

const DEFAULT_INPUT=fileURLToPath(new URL('../assets/workshop.glb',import.meta.url));
const DEFAULT_OUTPUT=fileURLToPath(new URL('../src/workshop-model-data.mjs',import.meta.url));
const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const TYPES={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};

// The Blender GLB is the source asset. Convert it once for the game's offline,
// synchronous HTML build: no fetch, GLTFLoader, texture or material per part.
export function convertWorkshopGLB(input,{source='assets/workshop.glb'}={}){
  const bytes=new Uint8Array(input.buffer??input,input.byteOffset??0,input.byteLength),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw Error('Expected a complete glTF 2 GLB.');
  let gltf,bin;
  for(let offset=12;offset<bytes.length;){
    const size=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(offset+size>bytes.length)throw Error('Truncated GLB chunk.');
    if(type===0x4e4f534a)gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(offset,offset+size)).trim());
    else if(type===0x004e4942)bin=bytes.subarray(offset,offset+size);
    offset+=size;
  }
  if(!gltf||!bin)throw Error('GLB requires JSON and an embedded binary buffer.');
  if(gltf.animations?.length||gltf.skins?.length||gltf.textures?.length)throw Error('Workshop must use static opaque meshes and vertex colours, without textures/skins/animation.');
  // A Jutsu preview can carry punctual lights. They are authoring helpers,
  // never instantiated by this static geometry importer.
  const required=(gltf.extensionsRequired??[]).filter(name=>name!=='KHR_lights_punctual');
  if(required.length)throw Error('Unsupported required glTF extension: '+required.join(', '));
  const binary=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
  function accessor(id){
    const a=gltf.accessors?.[id],b=gltf.bufferViews?.[a?.bufferView],type=TYPES[a?.componentType],width=COMPONENTS[a?.type];
    if(!a||!b||!type||!width||a.sparse||b.buffer!==0)throw Error('Unsupported or missing GLB accessor '+id);
    const stride=b.byteStride??type[1]*width,start=(b.byteOffset??0)+(a.byteOffset??0);
    if(start+(a.count-1)*stride+width*type[1]>bin.byteLength)throw Error('GLB accessor overruns the binary buffer.');
    return {count:a.count,width,read(i){const result=[];for(let c=0;c<width;c++){let v=binary[type[0]](start+i*stride+c*type[1],true);if(a.normalized&&a.componentType!==5126)v=Math.max(-1,v/type[2]);result.push(v);}return result;}};
  }
  const materials=gltf.materials??[];
  const records=[],indices=[],dedup=new Map(),parts=[],usedMaterials=new Set();
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],radius:0};
  // Same warm daylight as village-a.mjs, rotated into the workshop's local
  // frame. Blender AO (COLOR_0) and material colour are retained in the bake.
  const sun=new THREE.Vector3(-.55,.86,.38).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),-.25);
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  let sourceTriangles=0;
  function mesh(node,world){
    const src=gltf.meshes[node.mesh];if(!src)throw Error('Missing workshop mesh.');
    normalMatrix.getNormalMatrix(world);
    let partTriangles=0;
    for(const primitive of src.primitives){
      if((primitive.mode??4)!==4||primitive.targets||primitive.extensions)throw Error('Workshop requires plain static triangle primitives.');
      const p=accessor(primitive.attributes.POSITION),n=accessor(primitive.attributes.NORMAL),c=primitive.attributes.COLOR_0===undefined?null:accessor(primitive.attributes.COLOR_0),ix=primitive.indices===undefined?null:accessor(primitive.indices);
      if(p.width!==3||n.width!==3||n.count!==p.count||c&&c.count!==p.count)throw Error('Workshop position, normal and colour arrays disagree.');
      const mat=materials[primitive.material]??{},base=mat.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1],emissive=mat.emissiveFactor??[0,0,0];
      if((mat.alphaMode??'OPAQUE')!=='OPAQUE'||base[3]<1)throw Error('Transparent workshop materials are not supported.');
      if(primitive.material!==undefined)usedMaterials.add(primitive.material);
      const remap=[];
      for(let i=0;i<p.count;i++){
        point.fromArray(p.read(i)).applyMatrix4(world);normal.fromArray(n.read(i)).applyMatrix3(normalMatrix).normalize();
        const col=c?c.read(i):[1,1,1,1];if(col[3]!==undefined&&col[3]<.999)throw Error('Workshop vertex alpha must be opaque.');
        const shade=.47+.53*Math.max(0,normal.dot(sun));
        const position=point.toArray().map(v=>Math.round(v*1000));
        if(position.some(v=>!Number.isFinite(v)||v<-32768||v>32767))throw Error('Workshop position exceeds the millimetre encoding range.');
        const colour=base.slice(0,3).map((v,k)=>Math.round(Math.max(0,Math.min(1,v*col[k]*shade+emissive[k]*col[k]))*65535));
        const axis=Math.abs(normal.y)>=Math.abs(normal.x)&&Math.abs(normal.y)>=Math.abs(normal.z)?1:Math.abs(normal.x)>Math.abs(normal.z)?0:2;
        const record=[...position,...colour,axis],key=record.join(','),existing=dedup.get(key);
        if(existing!==undefined)remap.push(existing);else{const index=records.length;records.push(record);dedup.set(key,index);remap.push(index);}
        for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],position[k]/1000);bounds.max[k]=Math.max(bounds.max[k],position[k]/1000);}
        bounds.radius=Math.max(bounds.radius,Math.hypot(position[0],position[2])/1000);
      }
      const count=ix?ix.count:p.count;if(count%3)throw Error('Incomplete workshop triangle.');
      const invert=world.determinant()<0;
      for(let i=0;i<count;i+=3){
        const t=[0,1,2].map(k=>ix?ix.read(i+k)[0]:i+k);
        if(t.some(k=>!Number.isInteger(k)||k<0||k>=p.count))throw Error('Workshop triangle index is out of bounds.');
        const v=t.map(k=>remap[k]);indices.push(v[0],v[invert?2:1],v[invert?1:2]);
        // A two-sided authored fabric material becomes opaque back faces in
        // this same batch; it never enables DoubleSide for the whole village.
        if(mat.doubleSided)indices.push(v[0],v[invert?1:2],v[invert?2:1]);
      }
      sourceTriangles+=count/3;partTriangles+=count/3;
    }
    parts.push({name:node.name??src.name??'HERO_mesh',triangles:partTriangles});
  }
  function visit(id,parent,hero=false,stack=new Set()){
    if(stack.has(id))throw Error('Cyclic glTF node hierarchy.');
    const node=gltf.nodes?.[id];if(!node)throw Error('Missing GLB scene node.');
    const name=node.name??'';if(/^(ENV_|CAM_|LGT_)/.test(name))return;
    const local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3().fromArray(node.translation??[0,0,0]),new THREE.Quaternion().fromArray(node.rotation??[0,0,0,1]),new THREE.Vector3().fromArray(node.scale??[1,1,1]));
    const world=parent.clone().multiply(local),included=hero||name.startsWith('HERO_');
    if(included&&node.mesh!==undefined)mesh(node,world);
    const next=new Set(stack);next.add(id);for(const child of node.children??[])visit(child,world,included,next);
  }
  for(const id of gltf.scenes?.[gltf.scene??0]?.nodes??[])visit(id,new THREE.Matrix4());
  if(!indices.length)throw Error('No HERO_ workshop mesh found.');
  if(usedMaterials.size>8)throw Error('Workshop source exceeds eight shared materials.');
  if(indices.length/3>45000)throw Error('Workshop exceeds 45,000 baked triangles.');
  if(bounds.radius>5.7||bounds.max[1]>9.8||bounds.min[1]<-.05)throw Error('Workshop exceeds the reserved plot/height: '+JSON.stringify(bounds));
  const packed=Buffer.alloc(records.length*13),indexBytes=records.length>65535?4:2,indexBuffer=Buffer.alloc(indices.length*indexBytes);
  for(let i=0;i<records.length;i++){const r=records[i],o=i*13;for(let k=0;k<3;k++)packed.writeInt16LE(r[k],o+k*2);for(let k=0;k<3;k++)packed.writeUInt16LE(r[k+3],o+6+k*2);packed[o+12]=r[6];}
  for(let i=0;i<indices.length;i++)indexBytes===2?indexBuffer.writeUInt16LE(indices[i],i*2):indexBuffer.writeUInt32LE(indices[i],i*4);
  const metadata={format:1,source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length,sourceTriangles,triangles:indices.length/3,vertices:records.length,indexBytes,packedBytes:packed.length+indexBuffer.length,materials:usedMaterials.size,parts,bounds,placementYaw:.25};
  return {metadata,vertices:packed.toString('base64'),indices:indexBuffer.toString('base64')};
}

export async function importWorkshop(input=DEFAULT_INPUT,output=DEFAULT_OUTPUT,{quiet=false}={}){
  const data=convertWorkshopGLB(await readFile(input));
  await writeFile(output,'// Generated by tools/import-workshop-glb.mjs from the Blender GLB. Do not edit.\n'+
    'export const WORKSHOP_MODEL_INFO=Object.freeze('+JSON.stringify(data.metadata)+');\n'+
    'export const WORKSHOP_VERTEX_DATA='+JSON.stringify(data.vertices)+';\n'+
    'export const WORKSHOP_INDEX_DATA='+JSON.stringify(data.indices)+';\n');
  if(!quiet)console.log(JSON.stringify({...data.metadata,parts:data.metadata.parts.length,output},null,2));
  return data;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await importWorkshop(process.argv[2],process.argv[3]);
