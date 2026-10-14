import {createNatureGeometries} from './nature-geometry.mjs';
import {createWoodlandAtlas} from './woodland-atlas.mjs';
import {mapHalfWidth,VILLAGE_BOUNDS} from './content.mjs';

// Built once into spatial batches. Branches/rocks use opaque geometry, and
// crowns share the painted cutout atlas. Moss is integrated into rock colour.
export function createForestNature(THREE,scene,resources,{material}) {
  const shapes=createNatureGeometries(THREE);
  Object.values(shapes).forEach(g=>resources.add(g));
  const atlas=createWoodlandAtlas(THREE,resources),crowns=atlas.cardGeometry('crown',{crossed:true,curve:.09});
  const foliageBins=new Map();
  const bins=new Map(),p=new THREE.Vector3(),s=new THREE.Vector3();
  const q=new THREE.Quaternion(),e=new THREE.Euler(),m=new THREE.Matrix4(),nm=new THREE.Matrix3();
  const v=new THREE.Vector3(),n=new THREE.Vector3(),tintColor=new THREE.Color();
  const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
  const stats={trees:0,outcrops:0,boundaryClusters:0,parts:0,triangles:0,batches:0,vertexBytes:0,lights:0,textures:0,sharedAtlasTextures:1,perFrameUpdates:0};
  function rng(x,z,salt=0){
    let seed=(Math.imul(Math.round(x*317),73856093)^Math.imul(Math.round(z*419),19349663)^salt)>>>0;
    return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  }
  function emit(shape,matrix,tint){
    const key=`${Math.floor(matrix.elements[12]/32)}:${Math.floor(matrix.elements[14]/32)}`;
    if(shape==='leaf'){
      let leaves=foliageBins.get(key);if(!leaves){leaves=[];foliageBins.set(key,leaves);}
      // Painted, cut-out leaf edges soften the old faceted crown. Instance
      // matrices are uploaded once and remain in bounded spatial batches.
      leaves.push({matrix:matrix.clone(),tint});stats.parts++;stats.triangles+=(crowns.index?.count??crowns.attributes.position.count)/3;return;
    }
    const g=shapes[shape],a=g.attributes.position,norm=g.attributes.normal,c=g.attributes.color,index=g.index;
    let b=bins.get(key);if(!b){b={position:[],normal:[],color:[]};bins.set(key,b);}
    nm.getNormalMatrix(matrix);tintColor.setHex(tint);
    const count=index?index.count:a.count;
    for(let i=0;i<count;i++){
      const k=index?index.getX(i):i;
      v.fromBufferAttribute(a,k).applyMatrix4(matrix);n.fromBufferAttribute(norm,k).applyMatrix3(nm).normalize();
      b.position.push(v.x,v.y,v.z);b.normal.push(n.x,n.y,n.z);
      b.color.push(tintColor.r*(c?c.getX(k):1),tintColor.g*(c?c.getY(k):1),tintColor.b*(c?c.getZ(k):1));
    }
    stats.parts++;stats.triangles+=count/3;
  }
  function part(shape,x,y,z,sx,sy,sz,tint,yaw=0,rx=0,rz=0){
    p.set(x,y,z);s.set(sx,sy,sz);e.set(rx,yaw,rz,'YXZ');q.setFromEuler(e);
    emit(shape,m.compose(p,q,s),tint);
  }
  function branch(ax,ay,az,bx,by,bz,width,tint){
    direction.set(bx-ax,by-ay,bz-az);const length=direction.length();
    q.setFromUnitVectors(up,direction.normalize());p.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);s.set(width,length,width);
    emit('stem',m.compose(p,q,s),tint);
  }
  function tree(x,z,h,tint){
    stats.trees++;const random=rng(x,z,91),lean=(random()-.5)*h*.1,leanZ=(random()-.5)*h*.08;
    branch(x,-.06,z,x+lean,h*.55,z+leanZ,h*.105,0x746652);
    branch(x+lean,h*.48,z+leanZ,x+lean*.7,h*.89,z+leanZ*.8,h*.047,0x82745b);
    for(let j=0;j<5;j++){
      const a=random()*Math.PI*2,spread=h*(.17+random()*.12);
      const tx=x+lean+Math.cos(a)*spread,tz=z+leanZ+Math.sin(a)*spread,ty=h*(.48+j*.072+random()*.025);
      branch(x+lean,h*(.31+j*.075),z+leanZ,tx,ty,tz,h*(.028+random()*.015),0x82745b);
      // Offset, tilted sprays let the forked branches and sky show through.
      part('leaf',tx,ty+h*.085,tz,h*(.32+random()*.1),h*(.38+random()*.14),h*(.28+random()*.12),tint,a,(random()-.5)*.35,(random()-.5)*.3);
      if(j%2===0)part('leaf',tx+Math.cos(a+.5)*h*.07,ty-h*.025,tz+Math.sin(a+.5)*h*.07,h*.25,h*.3,h*.23,0x738659,a+1,.14,-.16);
    }
    part('leaf',x+lean*.7,h*.89,z+leanZ*.8,h*.28,h*.45,h*.26,tint,random()*6,.15,.2);
    for(let j=0;j<3;j++){
      const a=random()*6.28;
      branch(x,-.04,z,x+Math.cos(a)*h*.075,.04,z+Math.sin(a)*h*.075,h*.055,0x726550);
    }
  }
  function groundCover(x,z,sx=1,sy=1,sz=1,tint=0x7c905c){
    const random=rng(x,z,33);
    part('fern',x,.015,z,sx*.95,sy*.9,sz*.95,tint,random()*6.28);
    if(random()>.55)part('fern',x+(random()-.5)*.65,.01,z+(random()-.5)*.65,sx*.62,sy*.66,sz*.62,0x8a9a62,random()*6.28);
  }
  function outcrop(o){
    stats.outcrops++;const random=rng(o.x,o.z,73),r=o.r;
    // Broad buried base and an off-centre fracture face fill the existing solid
    // footprint. Smaller pieces touch soil instead of balancing on green lids.
    part('rock',o.x,1.2,o.z,r*1.8,3.9,r*1.68,0x9ca28f,random()*6.28,.08,-.12);
    part('rock',o.x-r*.28,1.72,o.z+r*.19,r*1.17,3.65,r*1.03,0xa4aa96,random()*6.28,-.13,.18);
    for(let j=0;j<5;j++){
      const a=j*1.25+random()*.35,d=r*(.54+random()*.13),size=.9+random()*.85;
      part('rock',o.x+Math.cos(a)*d,size*.2,o.z+Math.sin(a)*d,size,size*.85,size*.85,0x909985,random()*6.28,.12,(random()-.5)*.35);
      if(j%2===0)groundCover(o.x+Math.cos(a)*r*.86,o.z+Math.sin(a)*r*.86,1.15,.85,1.1);
    }
  }
  function boundaryCluster(x,z,nx,nz,random){
    stats.boundaryClusters++;
    const alongX=nz,alongZ=-nx,reach=1.5+random()*1.8,offset=.5+random()*1.9;
    for(let j=0;j<2+Math.floor(random()*3);j++){
      const along=(random()-.5)*reach*1.4,out=offset+.4+random()*1.2,size=.65+random()*1.85;
      part('rock',x+nx*out+alongX*along,size*.18,z+nz*out+alongZ*along,size,size*(.6+random()*.4),size*.85,[0x939c84,0x88937c,0xa0a58d][j%3],random()*6.28,.08,(random()-.5)*.3);
    }
    for(let j=0;j<3;j++){
      const along=(random()-.5)*reach*2,out=.25+random()*1.9;
      groundCover(x+nx*out+alongX*along,z+nz*out+alongZ*along,1+random()*.9,1,1+random()*.6);
    }
  }
  function boundaries(){
    for(const side of [-1,1]){
      const random=rng(side,-136,45);
      for(let z=-135.8;z<VILLAGE_BOUNDS.north;z+=3.4+random()*5.6){
        boundaryCluster(side*mapHalfWidth(z),z,side,0,random);
      }
    }
    const random=rng(0,-137,65);
    for(let x=-29;x<30;x+=3.5+random()*4.1)boundaryCluster(x,-137.4,0,-1,random);
  }
  function build(){
    const mat=material.clone();mat.vertexColors=true;resources.add(mat);
    for(const [key,b] of bins){
      const g=new THREE.BufferGeometry();
      for(const attr of ['position','normal','color'])g.setAttribute(attr,new THREE.Float32BufferAttribute(b[attr],3));
      g.computeBoundingSphere();resources.add(g);stats.vertexBytes+=g.attributes.position.array.byteLength*3;
      const mesh=new THREE.Mesh(g,mat);mesh.name='forest-nature-'+key;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);
    }
    for(const [key,items] of foliageBins){
      const mesh=new THREE.InstancedMesh(crowns,atlas.material,items.length);
      items.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,tintColor.setHex(0xffffff));});
      mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.name='forest-painted-crowns-'+key;scene.add(mesh);resources.add(mesh);
      stats.vertexBytes+=mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength||0);
    }
    stats.batches=bins.size+foliageBins.size;stats.crownBatches=foliageBins.size;bins.clear();foliageBins.clear();
  }
  return {tree,groundCover,outcrop,boundaries,build,stats};
}
