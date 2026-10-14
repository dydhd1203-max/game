import {WORKSHOP_MODEL_INFO,WORKSHOP_VERTEX_DATA,WORKSHOP_INDEX_DATA} from './workshop-model-data.mjs';

export {WORKSHOP_MODEL_INFO};
function decode(text){
  const raw=atob(text),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new DataView(bytes.buffer);
}
// One decode per village construction, then the authored model joins the
// existing opaque landmark batch. No extra mesh, material, texture or update.
export function appendWorkshopModel(bin,origin){
  const vertices=decode(WORKSHOP_VERTEX_DATA),indices=decode(WORKSHOP_INDEX_DATA),m=origin.elements;
  const world=new Float32Array(WORKSHOP_MODEL_INFO.vertices*8);
  for(let i=0;i<WORKSHOP_MODEL_INFO.vertices;i++){
    const o=i*13,d=i*8,x=vertices.getInt16(o,true)/1000,y=vertices.getInt16(o+2,true)/1000,z=vertices.getInt16(o+4,true)/1000;
    const px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13],pz=m[2]*x+m[6]*y+m[10]*z+m[14];
    world[d]=px;world[d+1]=py;world[d+2]=pz;
    for(let k=0;k<3;k++)world[d+3+k]=vertices.getUint16(o+6+k*2,true)/65535;
    const axis=vertices.getUint8(o+12);
    world[d+6]=(axis===0?pz:px)*1.7;world[d+7]=(axis===1?pz:py)*1.7;
  }
  const width=WORKSHOP_MODEL_INFO.indexBytes;
  for(let i=0;i<WORKSHOP_MODEL_INFO.triangles*3;i++){
    const index=width===2?indices.getUint16(i*2,true):indices.getUint32(i*4,true),d=index*8;
    bin.positions.push(world[d],world[d+1],world[d+2]);
    bin.colors.push(world[d+3],world[d+4],world[d+5]);
    bin.uvs.push(world[d+6],world[d+7]);
  }
}
