import {VILLAGE_MODEL_INFO,VILLAGE_MODEL_DATA} from './village-model-data.mjs';

export {VILLAGE_MODEL_INFO};
function decode(text){
  const raw=atob(text),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new DataView(bytes.buffer);
}
// Expand each source once while building its existing opaque landmark batch.
// No added mesh, material, texture, update loop or persistent decoded cache.
export function appendVillageModel(bin,origin,name){
  if(!Object.hasOwn(VILLAGE_MODEL_INFO,name))throw Error('Unknown village model '+name);
  const info=VILLAGE_MODEL_INFO[name],data=VILLAGE_MODEL_DATA[name];
  if(!info||!data)throw Error('Unknown village model '+name);
  const vertices=decode(data.vertices),indices=decode(data.indices),m=origin.elements,world=new Float32Array(info.vertices*8);
  for(let i=0;i<info.vertices;i++){
    const offset=i*13,d=i*8,x=vertices.getInt16(offset,true)/1000,y=vertices.getInt16(offset+2,true)/1000,z=vertices.getInt16(offset+4,true)/1000;
    const px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13],pz=m[2]*x+m[6]*y+m[10]*z+m[14];
    world[d]=px;world[d+1]=py;world[d+2]=pz;
    for(let k=0;k<3;k++)world[d+3+k]=vertices.getUint16(offset+6+k*2,true)/65535;
    const axis=vertices.getUint8(offset+12);
    world[d+6]=(axis===0?pz:px)*1.7;world[d+7]=(axis===1?pz:py)*1.7;
  }
  for(let i=0;i<info.triangles*3;i++){
    const index=info.indexBytes===2?indices.getUint16(i*2,true):indices.getUint32(i*4,true),d=index*8;
    bin.positions.push(world[d],world[d+1],world[d+2]);bin.colors.push(world[d+3],world[d+4],world[d+5]);bin.uvs.push(world[d+6],world[d+7]);
  }
}
