import {VILLAGE_BOUNDS,VILLAGE_GROVE,mapHalfWidth} from './content.mjs';

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
  function organicGeometry(detail,kind){
    const g=own(new THREE.IcosahedronGeometry(.5,detail)),positions=g.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const ripple=1+.12*Math.sin(x*14+z*5)*Math.cos(y*11-z*7);
      if(kind==='leaf')positions.setXYZ(i,x*ripple,y*(.93+.1*Math.sin(z*13+x*7)),z*(1+.12*Math.cos(x*12-y*7)));
      else positions.setXYZ(i,x*(1+.16*Math.sin(z*9+y*5)),Math.max(-.43,y*(.85+.15*Math.sin(x*7-z*11))),z*ripple);
    }
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  const leaf=organicGeometry(1,'leaf'),rock=organicGeometry(1,'rock');
  const stem=own(new THREE.CylinderGeometry(.26,.5,1,6));
  const root=own(new THREE.ConeGeometry(.5,1,5));
  const fern=own(new THREE.BufferGeometry());
  // Solid, folded fronds: each fan has a raised midrib and pointed leaf tips.
  const fp=[],fi=[];
  for(let j=0;j<7;j++){
    const a=j*Math.PI*2/7,co=Math.cos(a),si=Math.sin(a),base=fp.length/3;
    fp.push(0,0,0,co*.32-si*.16,.3,si*.32+co*.16,co*.54,.18,si*.54,co*.32+si*.16,.3,si*.32-co*.16,co*.27,.43,si*.27);
    fi.push(base,base+1,base+4,base+1,base+2,base+4,base+2,base+3,base+4,base+3,base,base+4);
  }
  fern.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fern.setIndex(fi);fern.computeVertexNormals();
  const staticBins=new Map(),sun=new THREE.Vector3(-.55,.86,.38).normalize();
  let staticParts=0,staticTriangles=0;
  const cameraObstacles=[];
  function add(g,x,y,z,sx,sy,sz,tint,ry=0,rx=0,rz=0){
    const key=`${x<0?'west':'east'}:${z<12?'north':'south'}`;
    let bin=staticBins.get(key);if(!bin){bin={position:[],color:[],normal:[]};staticBins.set(key,bin);}
    const m=transform(x,y,z,sx,sy,sz,ry,rx,rz);normalMatrix.getNormalMatrix(m);color.setHex(tint);
    const a=g.attributes.position,n=g.attributes.normal,index=g.index,count=index?index.count:a.count;
    for(let i=0;i<count;i++){
      const k=index?index.getX(i):i;point.fromBufferAttribute(a,k).applyMatrix4(m);
      normal.fromBufferAttribute(n,k).applyMatrix3(normalMatrix).normalize();
      const shade=.66+.34*Math.max(0,normal.dot(sun));
      bin.position.push(point.x,point.y,point.z);bin.normal.push(normal.x,normal.y,normal.z);
      bin.color.push(color.r*shade,color.g*shade,color.b*shade);
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
    const bend=sign*.22;
    branch(t.x,0,t.z,t.x+bend,h*.49,t.z+.1,h*.105);
    // Branch forks are visible between the uneven, offset crown masses.
    for(let j=0;j<4;j++){
      const a=i*.77+j*1.81,dx=Math.cos(a)*h*.2,dz=Math.sin(a)*h*.2;
      branch(t.x+bend,h*(.33+j*.055),t.z+.1,t.x+dx,h*(.65+j*.062),t.z+dz,h*(.044-j*.004),true);
    }
    for(let j=0;j<7;j++){
      const a=i*.77+j*2.4,spread=j===6?.035:.19;
      const x=t.x+Math.cos(a)*h*spread,y=h*(j===6?.92:.65+(j%3)*.075),z=t.z+Math.sin(a)*h*spread;
      const sx=h*(j===6?.38:.43+(j%2)*.035),sy=h*(j===6?.31:.31+(j%3)*.025),sz=h*(.39+(j%2)*.04);
      const tint=[0x5c7850,0x708b59,0x8a9c64,0x789157,0x667f4d,0x94a871,0x8ba26b][(j+i%2)%7];
      crown.leaves.push({x,y,z,r:Math.max(sx,sy,sz)*.55,matrix:transform(x,y,z,sx,sy,sz,a,.05*Math.sin(j)),tint});
    }
    crown.stump=transform(t.x,.24,t.z,h*.105,.48,h*.105);
    // Visible roots stay within the solid .85m tree footprint.
    for(let j=0;j<5;j++){
      const a=j*1.256+i*.2;add(root,t.x+Math.cos(a)*.24,.22,t.z+Math.sin(a)*.24,.32,.6,.9,0x75684e,a,0,.4);
    }
    for(let j=0;j<5;j++){
      const a=j*2.4+i*.8,x=t.x+Math.cos(a)*1.13,z=t.z+Math.sin(a)*1.13;
      add(leaf,x,.28,z,1.22,.64,1.01,[0x687e4e,0x819459,0x91a263][j%3],a);
      add(fern,x+Math.sin(a)*.43,.025,z+Math.cos(a)*.43,.85,.9,.85,0x71884f,a);
    }
  }
  // Chipped, overlapping boundary stones replace isolated sphere markers. The
  // inner face tracks the actual movement boundary; planting is low and opaque.
  let edgeIndex=0;
  function edgeBed(x,z,normalX,normalZ){
    const i=edgeIndex++,a=i*1.71,alongX=normalZ,alongZ=-normalX;
    const width=1.6+(i%3)*.16,height=.68+(i%4)*.19;
    // Long axis follows the wall; thickness extends outward, not into the street.
    const ry=Math.atan2(normalX,normalZ);
    add(rock,x+normalX*1.0,height*.39,z+normalZ*1.0,width,height,1.65,0x8c9580,ry,0,Math.sin(a)*.12);
    add(leaf,x+normalX*1.62+alongX*.32,.55,z+normalZ*1.62+alongZ*.32,1.55,1.2,1.18,[0x657c4d,0x7b8c55,0x8d9c62][i%3],a);
    if(i%2===0){
      add(rock,x+normalX*1.0+alongX*.48,height*.74,z+normalZ*1.0+alongZ*.48,.95,.38,.94,0xa4ad8b,ry+.32);
      add(fern,x-normalX*.12+alongX*.36,.02,z-normalZ*.12+alongZ*.36,1.1,1.1,1.1,0x6e854f,a);
    }
  }
  for(let z=VILLAGE_BOUNDS.north;z<=VILLAGE_BOUNDS.south;z+=1.7)for(const side of [-1,1])edgeBed(side*mapHalfWidth(z),z,side,0);
  for(let x=-VILLAGE_BOUNDS.halfWidth;x<=VILLAGE_BOUNDS.halfWidth;x+=1.7)edgeBed(x,VILLAGE_BOUNDS.south,0,1);
  // Taller layered outcrops form a backdrop behind the living edge, not a
  // second wall inside the playable grass. Their silhouettes break the horizon.
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const z=-10+i*7.2,x=side*(VILLAGE_BOUNDS.halfWidth+2.9+(i%2)*.8);
    add(rock,x,1.35,z,4.8,3.8+(i%3)*.4,4.5,0x8a9583,i*.71,0,side*.11);
    cameraObstacles.push({x,z,r:3.2,top:4.5});
    add(rock,x-side*.54,2.15,z+.2,3.5,2.1,3.2,0xa0a990,i*.61);
    add(leaf,x-side*.45,3.08,z+.19,3.8,.7,3.2,0x78915e,i*.3);
  }
  // A wooded ridge closes the south-facing view. Its entire solid footprint
  // sits beyond the playable boundary, and shares the same static east/west
  // chunks; turning around must not expose an endless empty green plane.
  for(let i=0;i<7;i++){
    const x=-24+i*8,z=VILLAGE_BOUNDS.south+20.5+(i%2)*2.2,h=6.4+(i%3)*1.3;
    add(rock,x,h*.3,z,14,h,12,0x7d8e70,i*.47,0,.07*Math.sin(i));
    add(leaf,x-.8,h*.59,z-.8,12,2.5,9.5,0x738653,i*.62);
    for(let j=0;j<3;j++){
      const tx=x+(j-1)*2.7,tz=z-1.3+j*.82,ty=h*.49+1.6+(j%2)*.7;
      add(stem,tx,ty,tz,.55,3.5,.55,0x71654d,j*.4);
      add(leaf,tx-.4,ty+2.3,tz,4.6,4.6,4.2,[0x657b4d,0x7b8e57,0x89995e][(i+j)%3],j*.9);
      add(leaf,tx+.8,ty+1.7,tz-.45,3.6,3.2,3.7,0x748854,i*.4+j);
    }
  }
  const staticMaterial=own(material.clone());staticMaterial.vertexColors=true;
  for(const [id,bin] of staticBins){
    const g=own(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(bin.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(bin.normal,3));g.setAttribute('color',new THREE.Float32BufferAttribute(bin.color,3));
    g.computeBoundingSphere();const mesh=new THREE.Mesh(g,staticMaterial);mesh.name=`village-nature-${id}`;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);
  }
  const leaves=new THREE.InstancedMesh(leaf,material,canopies.length*7),trunks=new THREE.InstancedMesh(stem,material,canopies.length*5);
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
  return {update,cameraObstacles,stats:{trees:canopies.length,crownInstances:leafIndex,branchInstances:branchIndex,staticChunks:staticBins.size,staticParts,staticTriangles,canopyTriangles:leafIndex*80+branchIndex*24,animatedScenery:0,additionalLights:0}};
}
