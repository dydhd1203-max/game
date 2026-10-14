import {VILLAGE_SITES,VILLAGE_BOUNDS} from './content.mjs';
import {appendWorkshopModel,WORKSHOP_MODEL_INFO} from './workshop-model.mjs';
import {appendVillageModel,VILLAGE_MODEL_INFO} from './village-model.mjs';

// Approved A: dawn workshop village. All art is authored once, baked to vertex
// colours and merged per landmark. No extra light, shadow map, texture fetch,
// per-frame animation, matrix upload or per-prop draw call is needed.
// Solid silhouettes stay inside the shared village plots in content.mjs.
// The frontage is packed vertically; the central route remains open for 21 players.
export function buildVillageA(THREE, scene, resources) {
  const bins = new Map(), source = new Set(), contacts = [];
  const color = new THREE.Color(), point = new THREE.Vector3(), normal = new THREE.Vector3();
  const sun = new THREE.Vector3(-.55, .86, .38).normalize();
  const origin = new THREE.Matrix4(), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), normals = new THREE.Matrix3();
  const euler = new THREE.Euler(), up = new THREE.Vector3(0,1,0);
  let current = 'plaza', seed = 4701;
  const rand = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);
  const keep = g => (source.add(g), g);
  const shapes = {
    cyl:keep(new THREE.CylinderGeometry(.5,.5,1,10)),
    rod:keep(new THREE.CylinderGeometry(.5,.5,1,6)),
    cone:keep(new THREE.ConeGeometry(.5,1,9)),
    sphere:keep(new THREE.SphereGeometry(.5,9,6)),
    detailSphere:keep(new THREE.SphereGeometry(.5,6,4)),
    rock:keep(new THREE.IcosahedronGeometry(.5,0)),
    ring:keep(new THREE.TorusGeometry(.5,.065,6,24)),
  };
  const C = {cream:0xd6be95, pale:0xe2ceaa, stone:0xb4aa8c, lightStone:0xd5c4a1,
    wood:0x775133, honey:0xa77340, dark:0x493624, iron:0x465156, brass:0xc69c53,
    roof:0xb75a35, tile:0xcc6f40, cloth:0xe5ba63, blue:0x527588, leaf:0x789358};
  const tint = (hex,factor) => new THREE.Color(hex).multiplyScalar(factor);
  function at(name,x,z,yaw=0) {
    current=name;origin.makeRotationY(yaw);origin.setPosition(x,0,z);
  }
  function atSite(name,yaw=0){const s=VILLAGE_SITES[name];at(name,s.x,s.z,yaw);}
  function contact(x,z,w,d,opacity=.28){
    const center=new THREE.Vector3(x,.079,z).applyMatrix4(origin);
    contacts.push({plot:current,center,w,d,yaw:Math.atan2(origin.elements[8],origin.elements[0]),opacity});
  }
  function geometry(vertices,indices) {
    const g = new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    if(indices)g.setIndex(indices);g.computeVertexNormals();return keep(g);
  }
  function add(g,x,y,z,sx=1,sy=1,sz=1,tone=C.wood,rx=0,ry=0,rz=0,unlit=false) {
    let b=bins.get(current);if(!b){b={positions:[],colors:[],uvs:[]};bins.set(current,b);}
    position.set(x,y,z);scale.set(sx,sy,sz);euler.set(rx,ry,rz,'YXZ');rotation.setFromEuler(euler);
    matrix.compose(position,rotation,scale);matrix.premultiply(origin);normals.getNormalMatrix(matrix);
    const p=g.attributes.position,n=g.attributes.normal,index=g.index;
    const base=color.set(tone).clone(), count=index?index.count:p.count;
    for(let i=0;i<count;i++){
      const k=index?index.getX(i):i;
      point.fromBufferAttribute(p,k).applyMatrix4(matrix);normal.fromBufferAttribute(n,k).applyMatrix3(normals).normalize();
      // Directional shading is baked once. A gentle warm ambient term preserves
      // plaster, cloth and shaded timber without running another light shader.
      const directional=.47+.53*Math.max(0,normal.dot(sun));
      const variation=.97+.03*Math.sin(point.x*2.73+point.y*1.9)*Math.cos(point.z*2.19-point.y*3.2);
      let contactShade=1;
      if(current==='workshop'){
        // Broad baked occlusion gradients at the overhanging roof, timber belt
        // and masonry base. They darken existing vertices without extra passes.
        if(point.y>5.65&&point.y<6.79)contactShade*=1-.42*Math.exp(-Math.pow((point.y-6.59)/.42,2));
        if(point.y>3.1&&point.y<3.79)contactShade*=1-.28*Math.exp(-Math.pow((point.y-3.67)/.22,2));
        if(point.y<1.05)contactShade*=.76+.24*Math.min(1,point.y/1.05);
      }
      if(current==='wagon'&&point.y>2.05&&point.y<3.5)contactShade*=.84;
      const woody=typeof tone==='number'&&[C.wood,C.honey,C.dark,0x94683c,0xa17c4c].includes(tone);
      const fibres=woody?.94+.06*Math.sin(point.y*17.1+point.x*1.3)*Math.cos(point.z*2.2):1;
      const shade=unlit?1:directional*variation*contactShade*fibres;
      b.positions.push(point.x,point.y,point.z);
      b.colors.push(base.r*shade,base.g*shade,base.b*shade);
      const nx=Math.abs(normal.x),ny=Math.abs(normal.y),nz=Math.abs(normal.z);
      // World-aligned grain is seamless between merged objects and requires no
      // per-object texture or material. Larger relief stays authored geometry.
      if(ny>=nx&&ny>=nz)b.uvs.push(point.x*1.7,point.z*1.7);
      else if(nx>nz)b.uvs.push(point.z*1.7,point.y*1.7);
      else b.uvs.push(point.x*1.7,point.y*1.7);
    }
  }
  const cyl=(x,y,z,w,h,d,c,rx=0,ry=0,rz=0)=>add(shapes.cyl,x,y,z,w,h,d,c,rx,ry,rz);
  // Small berries, rivets and petals do not need the silhouette resolution of
  // broad foliage. Their size stays the same; only subpixel tessellation drops.
  const ball=(x,y,z,w,h,d,c)=>add(Math.max(w,h,d)<.51?shapes.detailSphere:shapes.sphere,x,y,z,w,h,d,c);
  function beam(a,b,r,c=C.wood) {
    const dir=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a));
    const q=new THREE.Quaternion().setFromUnitVectors(up,dir.clone().normalize());
    const angles=new THREE.Euler().setFromQuaternion(q,'YXZ');
    add(shapes.rod,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,dir.length(),r,c,angles.x,angles.y,angles.z);
  }
  function loft(rings,close=true) {
    const ps=[],ix=[],n=rings[0].length;
    for(const ring of rings)for(const p of ring)ps.push(...p);
    for(let k=0;k<rings.length-1;k++)for(let i=0;i<n;i++){
      const a=k*n+i,b=k*n+(i+1)%n,c=(k+1)*n+i,d=(k+1)*n+(i+1)%n;
      ix.push(a,c,b,b,c,d);
    }
    if(close){
      for(let i=1;i<n-1;i++){ix.push(0,i,(i+1));const e=(rings.length-1)*n;ix.push(e,e+i+1,e+i);}
    }
    return geometry(ps,ix);
  }
  function lantern(x,y,z,s=.6){
    beam([x,y+s*.85,z],[x,y+s*1.35,z],s*.075,C.iron);
    cyl(x,y,z,s*.58,s*.82,s*.58,C.brass);
    add(shapes.cyl,x,y+.015,z,s*.42,s*.58,s*.42,0xffd583,0,0,0,true);
    add(shapes.cone,x,y+s*.57,z,s*.86,s*.4,s*.86,C.iron);
    cyl(x,y-s*.48,z,s*.78,s*.12,s*.78,C.iron);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;beam([x+Math.sin(a)*s*.26,y-s*.4,z+Math.cos(a)*s*.26],[x+Math.sin(a)*s*.26,y+s*.4,z+Math.cos(a)*s*.26],s*.05,C.iron);}
  }
  // Mid-height silhouettes carry the village density at gameplay distance.
  // All these objects bake into the existing opaque landmark batches.
  function foliage(x,z,s=1,h=1.15){
    for(let i=0;i<5;i++){
      const a=i*2.4,dx=Math.cos(a)*s*.31,dz=Math.sin(a)*s*.31;
      ball(x+dx,h*(.35+(i%2)*.14),z+dz,s*(.92+(i%2)*.16),h*(.92-(i%2)*.14),s*.96,[0x597246,0x6a824c,0x819351,0x91a563,0x728647][i]);
    }
    for(let i=0;i<7;i++){
      const a=i*2.4,dx=x+Math.cos(a)*s*.52,dz=z+Math.sin(a)*s*.49;
      grass(dx,dz,.8);
      if(i%2===0)ball(dx,h*.65,dz,.19,.14,.19,0xe2cf8d);
    }
  }
  function paving(poly,y,c){
    const cx=poly.reduce((a,p)=>a+p[0],0)/poly.length,cz=poly.reduce((a,p)=>a+p[1],0)/poly.length;
    const rings=[poly.map(([x,z])=>[cx+(x-cx)*.965,y-.035,cz+(z-cz)*.965]),
      poly.map(([x,z])=>[cx+(x-cx)*.92,y,cz+(z-cz)*.92])];
    // A shallow bevel catches the morning light; each stone remains essentially
    // flush with the ground, so decorative relief adds no invisible obstacle.
    add(loft(rings),0,0,0,1,1,1,c);
    const verts=[cx,y+.012,cz],ix=[];
    for(const [x,z] of poly)verts.push(cx+(x-cx)*.916,y+.001,cz+(z-cz)*.916);
    for(let i=0;i<poly.length;i++)ix.push(0,1+(i+1)%poly.length,1+i);
    add(geometry(verts,ix),0,0,0,1,1,1,tint(c,1.025));
  }
  function grass(x,z,s=1){
    const ps=[],ix=[];
    for(let i=0;i<7;i++){
      const angle=i*2.4,dx=Math.cos(angle)*s*.14,dz=Math.sin(angle)*s*.14,h=s*(.32+rand()*.27),n=ps.length/3;
      ps.push(x+dx-.055*s,.05,z+dz,x+dx+.055*s,.05,z+dz,x+dx+Math.cos(angle)*s*.24,h,z+dz+Math.sin(angle)*s*.24);
      ix.push(n,n+1,n+2,n,n+2,n+1);
    }
    add(geometry(ps,ix),0,0,0,1,1,1,0x7c8d49);
  }
  // A small arrival square feeds a continuous road. Stonework ends at the
  // compact village boundary; plots blend into low planted ground cover.
  const roadEdge=z=>4.15+.65*Math.exp(-Math.pow((z-19)/5.2,2));
  const inPlot=(x,z,margin=0)=>Object.values(VILLAGE_SITES).some(p=>Math.hypot(x-p.x,z-p.z)<p.r+margin);
  at('plaza-south',0,0);
  const bedVerts=[],bedIx=[];
  for(let i=0;i<=44;i++){
    const z=VILLAGE_BOUNDS.north+i*(VILLAGE_BOUNDS.south-VILLAGE_BOUNDS.north)/44;
    const edge=roadEdge(z)+.25;
    bedVerts.push(-edge,.016,z,edge,.016,z);
    if(i<44){const k=i*2;bedIx.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  add(geometry(bedVerts,bedIx),0,0,0,1,1,1,0xbaa783);
  const sites=[];
  for(let row=-1;row<29;row++)for(let col=-7;col<=7;col++){
    const x=col*1.48+(row%2)*.74+(rand()-.5)*.85,z=-13+row*1.63+(rand()-.5)*.78;
    sites.push([x,z,Math.abs(x)<roadEdge(z)&&z>=VILLAGE_BOUNDS.north&&z<VILLAGE_BOUNDS.south&&!inPlot(x,z,.2)]);
  }
  // Voronoi cells turn the regular seed grid into hand laid, non-overlapping
  // stone polygons. Generation is only at load; runtime cost is one static draw.
  for(const site of sites){
    if(!site[2])continue; // Off-path seeds still bound the outer Voronoi cells.
    let poly=[[-12,VILLAGE_BOUNDS.north],[12,VILLAGE_BOUNDS.north],[12,VILLAGE_BOUNDS.south],[-12,VILLAGE_BOUNDS.south]];
    for(const other of sites){
      if(other===site)continue;
      const dx=other[0]-site[0],dz=other[1]-site[1];if(dx*dx+dz*dz>40)continue;
      const cut=(other[0]*other[0]+other[1]*other[1]-site[0]*site[0]-site[1]*site[1])/2;
      const next=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],va=a[0]*dx+a[1]*dz-cut,vb=b[0]*dx+b[1]*dz-cut;
        if(va<=0)next.push(a);
        if((va<=0)!==(vb<=0)){const t=va/(va-vb);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      }
      poly=next;if(!poly.length)break;
    }
    if(poly.length<3)continue;
    // Chamfer each corner of the already bounded cell. Exterior ghost seeds
    // avoid the old unbounded polygons/clamping that made giant jagged fans.
    const rounded=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[(i+poly.length-1)%poly.length],b=poly[i],c=poly[(i+1)%poly.length];
      rounded.push([b[0]+(a[0]-b[0])*.12,b[1]+(a[1]-b[1])*.12],[b[0]+(c[0]-b[0])*.12,b[1]+(c[1]-b[1])*.12]);
    }
    poly=rounded;
    current=site[1]<16?'plaza-north':'plaza-south';
    paving(poly,.061,tint([0xc8ad82,0xb9a27c,0xd8bd92,0xb9a888,0xceba94][Math.floor(rand()*5)],.95+rand()*.09));
    if(Math.abs(site[0])>4.3&&rand()<.30)grass(poly[0][0],poly[0][1],.4+rand()*.35);
  }
  function plantPlot(r) {
    // Soft planting blends buildings into the village. No circular stone curb:
    // only the imported building's actual foundation and props remain solid art.
    for(let i=0;i<36;i++){
      const a=i*Math.PI*2/36,rr=r-.20-(i%4)*.018;
      if(i%5===0)grass(Math.cos(a)*rr*.98,Math.sin(a)*rr*.98,.85);
      if(i%4===0&&Math.sin(a)<.6)foliage(Math.cos(a)*(r-1.03),Math.sin(a)*(r-1.03),.94,.9+(i%3)*.2);
    }
  }
  // Authored in Blender/3D Jutsu and packed at build time. The complete
  // workshop joins the existing opaque batch, retaining the same plot/route.
  atSite('workshop',.25);
  bins.set(current,{positions:[],colors:[],uvs:[]});
  appendWorkshopModel(bins.get(current),origin);
  plantPlot(6);contact(0,-.15,5.35,4.6,.23);contact(-1,3.5,3.1,1.75,.32);
  // Each exported landmark joins the existing four building batches. The
  // two smaller shops share their neighbouring building's material and draw.
  const landmarkBin=name=>({smithYard:'workshop',supplyYard:'market'}[name]||name);
  for(const name of ['wagon','market','assembly','smithYard','supplyYard']){
    const site=VILLAGE_SITES[name],info=VILLAGE_MODEL_INFO[name];
    at(landmarkBin(name),site.x,site.z,info.placementYaw);
    if(!bins.has(current))bins.set(current,{positions:[],colors:[],uvs:[]});
    appendVillageModel(bins.get(current),origin,name);
    plantPlot(site.r);
    contact(0,0,site.r*.74,site.r*.70,.23);
  }
  function garden(x,z,size=1,flowers=false){
    // Low leaves and grass remain pass-through ground cover, below the avatar's
    // knees. Rocks appear only as flush worn edging, never as new solid walls.
    const ps=[],ix=[];
    for(let i=0;i<8;i++){
      const a=i*2.4+rand()*.3,dx=Math.cos(a)*size*.3,dz=Math.sin(a)*size*.3;
      const h=size*(.16+rand()*.15),tipX=x+Math.cos(a)*size*.68,tipZ=z+Math.sin(a)*size*.68;
      const midX=x+dx,midZ=z+dz,w=size*.12,n=ps.length/3;
      ps.push(x,.05,z,midX-Math.sin(a)*w,h,midZ+Math.cos(a)*w,tipX,.08+size*.12,tipZ,midX+Math.sin(a)*w,h,midZ-Math.cos(a)*w,midX,h+.045,midZ);
      ix.push(n,n+1,n+4,n+1,n+2,n+4,n+2,n+3,n+4,n+3,n,n+4,n,n+4,n+1,n+1,n+4,n+2,n+2,n+4,n+3,n+3,n+4,n);
    }
    add(geometry(ps,ix),0,0,0,1,1,1,[0x718846,0x84964f,0x8d9f58][Math.floor(rand()*3)]);
    grass(x+.15,z-.17,size*.88);
    if(flowers)for(let i=0;i<3;i++){
      const dx=x+(rand()-.5)*size*.65,dz=z+(rand()-.5)*size*.65,y=size*(.28+rand()*.15);
      beam([dx,.05,dz],[dx,y,dz],.018,0x748043);
      // Petals are a very small opaque crossed disc, not another full sphere.
      const p=[];for(let j=0;j<5;j++){const a=j*Math.PI*2/5;p.push(dx+Math.cos(a)*.095,y,dz+Math.sin(a)*.095);}
      p.push(dx,y+.04,dz);add(geometry(p,[0,1,5,1,2,5,2,3,5,3,4,5,4,0,5,0,5,1,1,5,2,2,5,3,3,5,4,4,5,0]),0,0,0,1,1,1,i%2?0xe9dba8:0xe4bd71);
    }
  }
  // Soft planted verges stitch adjoining plots together. All foliage outside
  // the reserved plots stays below the knees and leaves the route readable.
  at('plaza-south',0,0);
  for(let z=-10;z<28.5;z+=1.35)for(const side of [-1,1]){
    const x=side*(roadEdge(z)+.8+rand()*.22);
    current=z<16?'plaza-north':'plaza-south';
    if(!inPlot(x,z,.5))garden(x,z,.85+rand()*.3,Math.floor(z)%3===0);
    if(!inPlot(x+side*.9,z+.55,.5))garden(x+side*.9,z+.55,.8+rand()*.25,true);
  }
  // Plant the short cross-gaps between neighbours, rather than adding another
  // large lawn. These clusters are low, pass-through ground cover.
  const beds=[[-7.3,-3],[7.6,-3.4],[-12.3,11.1],[12.1,9.1],[-12.4,19.2],[12.9,20],[-5.7,28],[4.9,28],[-15.1,16],[14.9,25.4]];
  for(const [x,z] of beds){
    current=z<16?'plaza-north':'plaza-south';
    for(let i=0;i<6;i++){
      const px=x+(rand()-.5)*1.8,pz=z+(rand()-.5)*1.6;
      if(!inPlot(px,pz,.25))garden(px,pz,.85+rand()*.35,i%2===0);
    }
  }
  for(const name of Object.keys(VILLAGE_SITES)){
    const {x,z,r}=VILLAGE_SITES[name];at(landmarkBin(name),x,z,name==='workshop'?.25:VILLAGE_MODEL_INFO[name].placementYaw);
    for(let i=0;i<20;i++){
      const a=i*Math.PI/10,r0=r-.72;
      garden(Math.cos(a)*r0,Math.sin(a)*r0,.5+rand()*.12,i%3===0);
    }
  }
  // Restored twin pennants frame the way into the forest. Their poles sit
  // outside the broad central route, following the approved concept A.
  at('plaza-north',0,0);
  for(const side of [-1,1]){
    const x=side*6.2,z=-5.5;
    beam([x,.1,z],[x,5.7,z],.19,C.wood);
    beam([x,5.25,z],[x+side*1.65,5.25,z],.15,C.honey);
    cyl(x,.28,z,.62,.55,.62,C.stone);
    add(shapes.cone,x,5.93,z,.5,.52,.5,C.brass);
    const cloth=geometry([x+side*.2,5.15,z,x+side*1.43,5.15,z,x+side*.2,2.65,z+.09,x+side*1.43,2.4,z+.09],[0,2,1,1,2,3,0,1,2,1,3,2]);
    add(cloth,0,0,0,1,1,1,C.blue);
    const bx=x+side*.83;
    add(shapes.ring,bx,4,z+.1,.65,.85,.65,C.brass);
    beam([bx,3.35,z+.15],[bx,4.65,z+.15],.05,C.brass);
    beam([bx-.43,4,z+.15],[bx+.43,4,z+.15],.05,C.brass);
    beam([x,4.65,z],[x-side*.7,4.65,z],.09,C.iron);
    lantern(x-side*.68,3.88,z,.6);
  }
  // A light timber gateway gives the street a visible end before the forest;
  // its arch is above even a double-jumping player and adds no new draw batch.
  for(let i=0;i<12;i++){
    const x0=-6.2+i*12.4/12,x1=-6.2+(i+1)*12.4/12;
    const y=x=>5.38+.8*Math.sin((x+6.2)/12.4*Math.PI);
    beam([x0,y(x0),-5.5],[x1,y(x1),-5.5],.21,C.wood);
  }
  // Opaque, baked vertex-colour material permits every piece in each landmark
  // to share one draw. Each landmark has its own tight culling bounds, so the
  // village disappears from rendering when the expedition has moved on.
  // One small, shared grain map supplies plaster pores, woven-cloth flecks and
  // stone/wood surface variation. The material remains unlit and all landmarks
  // stay merged: this costs one 128² texture, no extra draw or asset download.
  const grainPixels=new Uint8Array(128*128*4);
  let grainSeed=9017;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;
    const fibre=Math.sin(x*.73+y*.13)*2.2+Math.cos(y*.29-x*.17)*1.9;
    const value=Math.max(214,Math.min(255,233+(grainSeed/4294967296-.5)*27+fibre));
    const i=(y*128+x)*4;grainPixels[i]=value;grainPixels[i+1]=value;grainPixels[i+2]=value;grainPixels[i+3]=255;
  }
  const grainMap=new THREE.DataTexture(grainPixels,128,128,THREE.RGBAFormat);
  grainMap.colorSpace=THREE.SRGBColorSpace;grainMap.wrapS=grainMap.wrapT=THREE.RepeatWrapping;
  grainMap.magFilter=THREE.LinearFilter;grainMap.minFilter=THREE.LinearMipmapLinearFilter;grainMap.generateMipmaps=true;grainMap.needsUpdate=true;resources.add(grainMap);
  const material=new THREE.MeshBasicMaterial({vertexColors:true,map:grainMap});resources.add(material);
  const meshes=[];let triangles=0,bytes=0;
  for(const [name,b] of bins){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));
    g.computeBoundingBox();g.computeBoundingSphere();resources.add(g);
    const mesh=new THREE.Mesh(g,material);mesh.name=`village-a:${name}`;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
    scene.add(mesh);meshes.push(mesh);triangles+=b.positions.length/9;bytes+=g.attributes.position.array.byteLength+g.attributes.color.array.byteLength+g.attributes.uv.array.byteLength;
  }
  // Tiny local ground-contact fans are the only transparent addition. Vertex
  // alpha fades them smoothly into the existing ground with no shadow texture,
  // realtime light or per-frame update. Four tight batches still cull by plot.
  const contactMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});resources.add(contactMaterial);
  const contactBins=new Map();
  for(const c of contacts){
    let b=contactBins.get(c.plot);if(!b){b={positions:[],colors:[]};contactBins.set(c.plot,b);}
    const ring=[0,.4,.72,1],alpha=[c.opacity,c.opacity*.82,c.opacity*.35,0],n=24;
    const vertices=[];
    for(let row=0;row<ring.length;row++)for(let i=0;i<n;i++){
      const a=i*Math.PI*2/n,x=Math.cos(a)*c.w*ring[row],z=Math.sin(a)*c.d*ring[row];
      vertices.push([c.center.x+x*Math.cos(c.yaw)+z*Math.sin(c.yaw),c.center.y,c.center.z-x*Math.sin(c.yaw)+z*Math.cos(c.yaw),alpha[row]]);
    }
    for(let row=0;row<ring.length-1;row++)for(let i=0;i<n;i++){
      const a=row*n+i,d=row*n+(i+1)%n,j=(row+1)*n+i,k=(row+1)*n+(i+1)%n;
      for(const idx of [a,d,j,d,k,j]){const v=vertices[idx];b.positions.push(v[0],v[1],v[2]);b.colors.push(.13,.09,.045,v[3]);}
    }
  }
  for(const [plot,b] of contactBins){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,4));g.computeBoundingSphere();resources.add(g);
    const mesh=new THREE.Mesh(g,contactMaterial);mesh.name=`village-a-contact:${plot}`;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);meshes.push(mesh);
    triangles+=b.positions.length/9;bytes+=g.attributes.position.array.byteLength+g.attributes.color.array.byteLength;
  }
  for(const g of source)g.dispose();
  return {meshes,stats:Object.freeze({landmarks:6,batches:meshes.length,opaqueBatches:bins.size,contactBatches:contactBins.size,triangles,vertexBytes:bytes,materials:2,textures:1,textureBytes:grainPixels.byteLength,lights:0,perFrameUpdates:0,models:VILLAGE_MODEL_INFO,workshop:Object.freeze({...WORKSHOP_MODEL_INFO,landmarkTriangles:bins.get('workshop').positions.length/9,runtimeBatches:0,runtimeLights:0,mergedInto:'village-a:workshop'})})};
}
