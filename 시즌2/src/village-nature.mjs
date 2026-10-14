import {VILLAGE_BOUNDS,VILLAGE_GROVE,mapHalfWidth} from './content.mjs';
import {createNatureGeometries} from './nature-geometry.mjs';

// Village-only scenery: four opaque spatial chunks and the same two instanced
// canopy/trunk draws as before. No frame animation, light, texture or shadow pass.
// The forest's authored RNG and geometry are not used by this module.
export function createVillageNature(THREE,scene,resources,{material,camera}) {
  const own=g=>(resources.add(g),g), color=new THREE.Color();
  const p=new THREE.Vector3(),s=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler();
  const matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),normal=new THREE.Vector3();
  const point=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
  function transform(x,y,z,sx,sy,sz,ry=0,rx=0,rz=0){
    p.set(x,y,z);s.set(sx,sy,sz);e.set(rx,ry,rz,'YXZ');q.setFromEuler(e);
    return matrix.compose(p,q,s).clone();
  }
  const shapes=createNatureGeometries(THREE);
  Object.values(shapes).forEach(own);
  const {leaf,rock,stem,fern}=shapes;
  const root=own(new THREE.ConeGeometry(.5,1,5));
  const triangleCount=g=>(g.index?.count??g.attributes.position.count)/3;
  let seed=78439;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const staticBins=new Map(),sun=new THREE.Vector3(-.55,.86,.38).normalize();
  let staticParts=0,staticTriangles=0;
  const cameraObstacles=[];
  function add(g,x,y,z,sx,sy,sz,tint,ry=0,rx=0,rz=0){
    const key=`${x<0?'west':'east'}:${z<12?'north':'south'}`;
    let bin=staticBins.get(key);if(!bin){bin={position:[],color:[],normal:[]};staticBins.set(key,bin);}
    const m=transform(x,y,z,sx,sy,sz,ry,rx,rz);normalMatrix.getNormalMatrix(m);color.setHex(tint);
    const a=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,index=g.index,count=index?index.count:a.count;
    for(let i=0;i<count;i++){
      const k=index?index.getX(i):i;point.fromBufferAttribute(a,k).applyMatrix4(m);
      normal.fromBufferAttribute(n,k).applyMatrix3(normalMatrix).normalize();
      const shade=.66+.34*Math.max(0,normal.dot(sun));
      bin.position.push(point.x,point.y,point.z);bin.normal.push(normal.x,normal.y,normal.z);
      bin.color.push(color.r*shade*(c?c.getX(k):1),color.g*shade*(c?c.getY(k):1),color.b*shade*(c?c.getZ(k):1));
    }
    staticParts++;staticTriangles+=count/3;
  }
  const canopies=[];
  for(let i=0;i<VILLAGE_GROVE.length;i++){
    const t=VILLAGE_GROVE[i],sign=Math.sign(t.x),h=t.h;
    const crown={leaves:[],branches:[],hidden:false};canopies.push(crown);
    function branch(ax,ay,az,bx,by,bz,width,tip=false){
      direction.set(bx-ax,by-ay,bz-az);const length=direction.length();
      q.setFromUnitVectors(up,direction.normalize());p.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);s.set(width,length,width);
      crown.branches.push({matrix:new THREE.Matrix4().compose(p,q,s),tint:tip?0x827158:0x6b6050});
    }
    const bend=sign*.21;
    branch(t.x,0,t.z,t.x+bend,h*.43,t.z+.1,h*.105);
    branch(t.x+bend,h*.40,t.z+.1,t.x+sign*.36,h*.88,t.z-.12,h*.058);
    function spray(x,y,z,sx,sy,sz,angle,tint,tilt=0){
      crown.leaves.push({x,y,z,r:Math.max(sx,sz)*.64,matrix:transform(x,y,z,sx,sy,sz,angle,tilt,.06*Math.sin(angle)),tint});
    }
    // Three unequal boughs leave sky gaps between their flattened leaf sprays.
    // The leader and visible forks give the crown a direction instead of an orb.
    for(let j=0;j<3;j++){
      const a=i*.73+j*2.19,reach=h*(.16+j*.025),tipReach=reach+h*.09;
      const bx=t.x+Math.cos(a)*reach,by=h*(.59+j*.086),bz=t.z+Math.sin(a)*reach;
      const tx=t.x+Math.cos(a+.15)*tipReach,ty=by+h*.075,tz=t.z+Math.sin(a+.15)*tipReach;
      branch(t.x+bend,h*(.35+j*.12),t.z+.1,bx,by,bz,h*(.041-j*.007),true);
      branch(bx,by,bz,tx,ty,tz,h*.018,true);
      spray(tx,ty+.1,tz,h*(.34-j*.026),h*.24,h*(.30+j*.014),a+.4,[0x72894e,0x82995c,0x637d47][(i+j)%3],-.13+j*.09);
      spray(bx+Math.sin(a)*.3,by+.23,bz-Math.cos(a)*.3,h*.25,h*.19,h*.22,a-1.1,[0x587242,0x7c9151,0x91a36a][j],.12);
    }
    spray(t.x+sign*.36,h*.92,t.z-.12,h*.28,h*.24,h*.25,i*.69,0x8a9e61,-.24);
    crown.stump=transform(t.x,.24,t.z,h*.105,.48,h*.105);
    // Visible roots stay within the solid .85m tree footprint.
    for(let j=0;j<5;j++){
      const a=j*1.256+i*.2;add(root,t.x+Math.cos(a)*.24,.22,t.z+Math.sin(a)*.24,.32,.6,.9,0x75684e,a,0,.4);
    }
    for(let j=0;j<5;j++){
      const a=j*2.4+i*.8,x=t.x+Math.cos(a)*1.13,z=t.z+Math.sin(a)*1.13;
      add(fern,x,.02,z,1.4,1.05,1.2,[0x687e4e,0x819459,0x91a263][j%3],a);
      add(fern,x+Math.sin(a)*.43,.025,z+Math.cos(a)*.43,.85,.9,.85,0x71884f,a);
    }
  }
  // Irregular buried clusters mark the border. Each has a principal broken
  // stone, small chips and low plants; unequal gaps avoid a necklace of pebbles.
  let edgeClusters=0;
  function edgeCluster(x,z,nx,nz){
    const tx=nz,tz=-nx,angle=Math.atan2(nx,nz),scale=.8+random()*.6;
    const along=(random()-.5)*.9,out=1.35+random()*.42;
    add(rock,x+nx*out+tx*along,.17,z+nz*out+tz*along,2.15*scale,1.22*scale,1.35*scale,0x949880,angle+(random()-.5)*.55,.08,Math.sin(edgeClusters)*.12);
    for(let j=0;j<2+(edgeClusters%3===0?1:0);j++){
      const offset=(j-1)*(.65+random()*.3),size=.32+random()*.58;
      add(rock,x+nx*(.72+random()*.5)+tx*offset,size*.04,z+nz*(.72+random()*.5)+tz*offset,size*1.5,size*.8,size,0xa5a58b,random()*6.28,random()*.2,random()*.15);
    }
    for(let j=0;j<3;j++){
      const along=(j-1)*(.85+random()*.6),out=.15+random()*1.6;
      add(fern,x+nx*out+tx*along,.025,z+nz*out+tz*along,1.15+random()*.8,.85+random()*.4,1.05+random()*.75,[0x71864c,0x82935a,0x647d43][j],random()*6.28);
    }
    edgeClusters++;
  }
  for(const side of [-1,1])for(let z=VILLAGE_BOUNDS.north+random();z<=VILLAGE_BOUNDS.south;z+=2.35+random()*2.4)edgeCluster(side*mapHalfWidth(z),z,side,0);
  for(let x=-VILLAGE_BOUNDS.halfWidth+random();x<=VILLAGE_BOUNDS.halfWidth;x+=2.25+random()*2.6)edgeCluster(x,VILLAGE_BOUNDS.south,0,1);
  // Preserve the existing camera obstacles. Their silhouette is now a fractured
  // boulder group with moss on stone faces, not a rock wearing a green disc.
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const z=-10+i*7.2,x=side*(VILLAGE_BOUNDS.halfWidth+2.9+(i%2)*.8);
    add(rock,x,1.13,z,4.6,4.5+(i%3)*.22,4.1,0x919481,i*.71,0,side*.11);
    cameraObstacles.push({x,z,r:3.2,top:4.5});
    add(rock,x-side*.38,1.92,z+.32,2.9,2.55,2.8,0xa1a28c,i*.61,.12,-side*.18);
    for(let j=0;j<3;j++){
      const a=i*.47+j*2.12,r=1.45+j*.24,size=.7+random()*.58;
      add(rock,x+Math.cos(a)*r,.15,z+Math.sin(a)*r,size*1.4,size,size*.95,0x929881,a,.2,-.12);
      add(fern,x+Math.cos(a)*(r+.55),.02,z+Math.sin(a)*(r+.55),1.25,.95,1.35,0x738651,a);
    }
  }
  function twig(ax,ay,az,bx,by,bz,width,tint){
    direction.set(bx-ax,by-ay,bz-az);const length=direction.length();q.setFromUnitVectors(up,direction.normalize());e.setFromQuaternion(q,'YXZ');
    add(stem,(ax+bx)/2,(ay+by)/2,(az+bz)/2,width,length,width,tint,e.y,e.x,e.z);
  }
  // The south ridge stays beyond maximum camera zoom. Its angular ledges and
  // sparse branching trees replace stacked green plates and ball-shaped trees.
  for(let i=0;i<7;i++){
    const x=-24+i*8,z=VILLAGE_BOUNDS.south+20.5+(i%2)*2.2,h=6.4+(i%3)*1.3;
    add(rock,x,h*.23,z,14,h,12,0x8b947d,i*.47,0,.07*Math.sin(i));
    add(rock,x-1.6,h*.41,z+.6,8,h*.7,6.9,0xa0a38a,i*.31,.09,-.12);
    for(let j=0;j<3;j++){
      const tx=x+(j-1)*2.7,tz=z-1.3+j*.82,base=h*.49,treeH=4.1+(j%2)*.7;
      twig(tx,base,tz,tx+.19,base+treeH*.92,tz-.14,.54,0x70624b);
      twig(tx+.12,base+treeH*.38,tz,tx+1.05,base+treeH*.7,tz-.52,.24,0x7e6d50);
      for(let k=0;k<3;k++){
        const a=i*.55+j*1.6+k*2.17,reach=k===2?.12:1.12;
        add(leaf,tx+Math.cos(a)*reach,base+treeH*(.65+k*.14),tz+Math.sin(a)*reach,3.5-k*.43,1.8,3.1-k*.3,[0x647b48,0x7b8e52,0x8d9b5c][(i+j+k)%3],a,-.1+k*.1);
      }
    }
  }
  const staticMaterial=own(material.clone());staticMaterial.vertexColors=true;
  for(const [id,bin] of staticBins){
    const g=own(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(bin.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(bin.normal,3));g.setAttribute('color',new THREE.Float32BufferAttribute(bin.color,3));
    g.computeBoundingSphere();const mesh=new THREE.Mesh(g,staticMaterial);mesh.name=`village-nature-${id}`;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);
  }
  const leaves=new THREE.InstancedMesh(leaf,material,canopies.reduce((n,c)=>n+c.leaves.length,0)),trunks=new THREE.InstancedMesh(stem,material,canopies.reduce((n,c)=>n+c.branches.length,0));
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  let leafIndex=0,branchIndex=0;
  for(const crown of canopies){
    for(const item of crown.leaves){item.index=leafIndex++;leaves.setMatrixAt(item.index,item.matrix);leaves.setColorAt(item.index,color.setHex(item.tint));}
    for(const item of crown.branches){item.index=branchIndex++;trunks.setMatrixAt(item.index,item.matrix);trunks.setColorAt(item.index,color.setHex(item.tint));}
  }
  for(const mesh of [leaves,trunks]){mesh.computeBoundingSphere();scene.add(mesh);resources.add(mesh);}
  const hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
  function update(me){
    const x=me?.x??0,y=(me?.y??.08)+1.1,z=me?.z??19;
    const dx=camera.position.x-x,dy=camera.position.y-y,dz=camera.position.z-z,lengthSq=dx*dx+dy*dy+dz*dz;
    let dirty=false;
    for(const crown of canopies){
      let hidden=false;
      for(const item of crown.leaves){
        const t=Math.max(0,Math.min(1,((item.x-x)*dx+(item.y-y)*dy+(item.z-z)*dz)/(lengthSq||1)));
        const ex=x+t*dx-item.x,ey=y+t*dy-item.y,ez=z+t*dz-item.z,r=item.r+(crown.hidden?.9:.65);
        if(ex*ex+ey*ey+ez*ez<r*r){hidden=true;break;}
      }
      if(hidden===crown.hidden)continue;crown.hidden=hidden;dirty=true;
      for(const item of crown.leaves)leaves.setMatrixAt(item.index,hidden?hiddenMatrix:item.matrix);
      for(const [j,item] of crown.branches.entries())trunks.setMatrixAt(item.index,hidden?(j===0?crown.stump:hiddenMatrix):item.matrix);
    }
    if(dirty){leaves.instanceMatrix.needsUpdate=true;trunks.instanceMatrix.needsUpdate=true;}
  }
  return {update,cameraObstacles,stats:{trees:canopies.length,crownInstances:leafIndex,branchInstances:branchIndex,staticChunks:staticBins.size,staticParts,staticTriangles,edgeClusters,canopyTriangles:leafIndex*triangleCount(leaf)+branchIndex*triangleCount(stem),animatedScenery:0,additionalLights:0}};
}
