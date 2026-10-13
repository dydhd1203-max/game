import {VILLAGE_SITES} from './content.mjs';

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
    box:keep(new THREE.BoxGeometry(1,1,1)),
    cyl:keep(new THREE.CylinderGeometry(.5,.5,1,10)),
    rod:keep(new THREE.CylinderGeometry(.5,.5,1,6)),
    cone:keep(new THREE.ConeGeometry(.5,1,9)),
    sphere:keep(new THREE.SphereGeometry(.5,9,6)),
    detailSphere:keep(new THREE.SphereGeometry(.5,6,4)),
    band:keep(new THREE.TorusGeometry(.5,.065,4,12)),
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
  const box=(x,y,z,w,h,d,c,ry=0)=>add(shapes.box,x,y,z,w,h,d,c,0,ry);
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
  function loop(w,d,n=24,power=4) {
    const result=[];
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2,co=Math.cos(a),si=Math.sin(a);
      result.push([Math.sign(co)*Math.pow(Math.abs(co),2/power)*w/2,Math.sign(si)*Math.pow(Math.abs(si),2/power)*d/2]);
    }
    return result;
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
  function rounded(w,h,d,r=.1){
    const l=loop(w,d,w<1.2&&d<1.2&&h<.65?8:12,4);
    return loft([l.map(([x,z])=>[x*.96,-h/2,z*.96]),l.map(([x,z])=>[x,-h/2+r,z]),
      l.map(([x,z])=>[x,h/2-r,z]),l.map(([x,z])=>[x*.97,h/2,z*.97])]);
  }
  function softBox(x,y,z,w,h,d,c,r=.08,ry=0){add(rounded(w,h,d,r),x,y,z,1,1,1,c,0,ry);}
  function lathe(profile,n=12){return keep(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),n));}
  function arch(w,h,depth=.14){
    const s=new THREE.Shape(),r=w/2;
    s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);
    s.absarc(0,h-r,r,0,Math.PI,false);s.lineTo(-r,0);
    return keep(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.045,bevelSize:.055,bevelSegments:1,curveSegments:5,steps:1}));
  }
  function door(x,y,z,w=1.7,h=2.8){
    add(arch(w+.43,h+.26,.025),x,y-.015,z-.026,1,1,1,0x967953);add(arch(w+.26,h+.12),x,y,z,1,1,1,C.honey);add(arch(w,h),x,y+.015,z+.12,1,1,1,C.dark);
    for(let i=-2;i<=2;i++)box(x+i*w/5,y+h*.39,z+.285,.035,h*.76,.025,0x9a7346);
    for(const yy of [.55,1.7])box(x,y+yy,z+.32,w*.9,.13,.07,C.iron);
    ball(x+w*.28,y+1.15,z+.38,.16,.16,.1,C.brass);
  }
  function windowArch(x,y,z,w=1.1,h=1.55){
    add(arch(w+.41,h+.28,.03),x,y-.035,z-.032,1,1,1,0xa58a60);add(arch(w+.22,h+.15),x,y,z,1,1,1,C.wood);
    add(arch(w,h),x,y+.07,z+.12,1,1,1,0xe7b964,0,0,0,true);
    box(x,y+h*.5,z+.3,.075,h*.87,.07,C.honey);box(x,y+h*.42,z+.3,w,.07,.07,C.honey);
    softBox(x,y-.05,z+.14,w+.5,.16,.45,C.honey);
  }
  function lantern(x,y,z,s=.6){
    beam([x,y+s*.85,z],[x,y+s*1.35,z],s*.075,C.iron);
    cyl(x,y,z,s*.58,s*.82,s*.58,C.brass);
    add(shapes.cyl,x,y+.015,z,s*.42,s*.58,s*.42,0xffd583,0,0,0,true);
    add(shapes.cone,x,y+s*.57,z,s*.86,s*.4,s*.86,C.iron);
    cyl(x,y-s*.48,z,s*.78,s*.12,s*.78,C.iron);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;beam([x+Math.sin(a)*s*.26,y-s*.4,z+Math.cos(a)*s*.26],[x+Math.sin(a)*s*.26,y+s*.4,z+Math.cos(a)*s*.26],s*.05,C.iron);}
  }
  function barrel(x,z,s=1){
    const body=lathe([[0,0],[.38,0],[.46,.12],[.53,.58],[.49,1.02],[.4,1.15],[0,1.15]],12);
    add(body,x,.12,z,s,s,s,C.honey);
    for(const y of [.3,.94])cyl(x,y*s+.12,z,1.025*s,.11*s,1.025*s,C.iron);
    cyl(x,1.27*s,z,.78*s,.04*s,.78*s,0x82603a);
  }
  function crate(x,y,z,s=1){
    softBox(x,y+s*.5,z,s,s,s,C.dark,.04);
    for(let i=0;i<3;i++)for(const side of [-1,1]){
      box(x,y+s*(i+.5)/3,z+side*s*.505,s,.25*s,.09*s,i%2?C.honey:0xa17c4c);
      box(x+side*s*.505,y+s*(i+.5)/3,z,.09*s,.25*s,s,C.honey);
    }
    for(const side of [-1,1])box(x+side*s*.36,y+s*.5,z+s*.565,.1*s,s,.08*s,C.wood);
  }
  function bench(x,y,z,w=2.5,d=.8){
    softBox(x,y,z,w,.2,d,C.honey);
    for(const xx of [-w*.37,w*.37])for(const zz of [-d*.32,d*.32])beam([x+xx,y-.05,z+zz],[x+xx,y-1,z+zz],.16,C.wood);
    box(x,y-.6,z,w*.85,.14,.12,C.wood);
  }
  function hammer(x,y,z,s=.8,ry=0){box(x,y,z,.09,s*.8,.09,C.honey,ry);softBox(x,y+s*.4,z,s*.57,s*.26,s*.23,C.iron,.04,ry);}
  function anvil(x,y,z,s=1){
    const profile=[[-.45,0,-.3],[.45,0,-.3],[.45,0,.3],[-.45,0,.3]];
    const rings=[profile.map(([a,b,c])=>[a,b,c]),profile.map(([a,b,c])=>[a*.53,.24,c*.66]),profile.map(([a,b,c])=>[a*.68,.58,c*.7]),profile.map(([a,b,c])=>[a*1.35,.73,c*1.15])];
    add(loft(rings),x,y,z,s,s,s,C.iron);
    softBox(x,y+s*.84,z,s*1.34,s*.26,s*.76,0x728080,.045);
    add(shapes.cone,x+s*.93,y+s*.85,z,s*.53,s*.85,s*.5,0x6e7878,0,0,-Math.PI/2);
  }
  function shrub(x,z,s=1){
    add(shapes.rock,x,.28*s,z,s*1.4,s*.9,s*1.2,C.leaf);
    add(shapes.rock,x-.26*s,.47*s,z+.08*s,s*.9,s*.8,s*.9,0x92a365);
    for(let i=0;i<4;i++){
      const dx=x+(rand()-.5)*s,dz=z+(rand()-.5)*s;
      beam([dx,.15,dz],[dx,.65*s,dz],.035,0x718145);
      ball(dx,.68*s,dz,.17*s,.13*s,.17*s,i%2?0xf0d398:0xe9dfbb);
    }
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
  function flowerPot(x,z,s=1,flowers=true){
    const g=lathe([[0,0],[.33,0],[.42,.15],[.5,.61],[.51,.72],[.57,.74],[.57,.86],[.45,.88],[.42,.77],[0,.73]],12);
    add(g,x,.13,z,s,s,s,0xa66942);cyl(x,.9*s+.13,z,.86*s,.03,.86*s,0x483d25);
    for(let i=0;i<7;i++){
      const a=i*2.4,dx=x+Math.cos(a)*.3*s,dz=z+Math.sin(a)*.3*s,h=.9*s+.32*s*(1+i%3);
      beam([x,.82*s+.13,z],[dx,h,dz],.035*s,0x62733a);
      ball(dx,h-.15*s,dz,.31*s,.15*s,.19*s,0x80974a);
      if(flowers)ball(dx,h+.025*s,dz,.21*s,.14*s,.21*s,i%2?0xe6c577:0xe8d8a0);
    }
  }
  function sack(x,y,z,s=1,c=0xc7ac72){
    add(shapes.sphere,x,y+s*.43,z,s*.85,s*.91,s*.73,c,0,.12,.07);
    add(shapes.sphere,x+.03*s,y+s*.9,z,.27*s,.28*s,.25*s,c);
    add(shapes.band,x+.03*s,y+s*.82,z,.3*s,.3*s,.3*s,C.honey,Math.PI/2);
  }
  function basket(x,y,z,s=1,produce=true){
    add(lathe([[0,0],[.35,0],[.44,.12],[.49,.58],[.51,.64],[.43,.67],[.39,.59],[.34,.17],[0,.14]],12),x,y,z,s,s,s,0xa57942);
    for(const h of [.14,.3,.46,.62])add(shapes.band,x,y+h*s,z,(.79+h*.28)*s,.75*s,(.79+h*.28)*s,0xc69b57,Math.PI/2);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;beam([x+Math.sin(a)*.35*s,y+.13*s,z+Math.cos(a)*.35*s],[x+Math.sin(a)*.49*s,y+.62*s,z+Math.cos(a)*.49*s],.035*s,C.honey);}
    if(produce)for(let i=0;i<7;i++)ball(x+Math.cos(i*2.4)*.24*s,y+(.64+(i%3)*.07)*s,z+Math.sin(i*2.4)*.24*s,.28*s,.25*s,.28*s,[0xc6a253,0xb97837,0x8b9a4b][i%3]);
  }
  function jar(x,y,z,s=1,c=0x66887d){
    add(lathe([[0,0],[.2,0],[.29,.12],[.34,.46],[.26,.67],[.15,.73],[.14,.89],[.18,.92],[.17,.98],[.08,.98],[.08,.9],[0,.84]],8),x,y,z,s,s,s,c);
    add(shapes.band,x,y+.91*s,z,.33*s,.22*s,.33*s,C.honey,Math.PI/2);
  }
  function shelf(x,y,z,w=2.4){
    for(const side of [-1,1])beam([x+side*w*.45,y,z],[x+side*w*.45,y+2.15,z],.14,C.wood);
    for(let row=0;row<3;row++){
      const yy=y+.22+row*.74;softBox(x,yy,z,w,.16,.76,C.honey,.05);
      for(let i=0;i<4;i++){
        const xx=x+(i/3-.5)*w*.78;
        if((i+row)%3===0)sack(xx,yy+.08,z,.5,0xc0a36c);
        else jar(xx,yy+.08,z,.47+rand()*.17,[0x729689,0xb8804f,0xc09c5e,0x81969b][(row+i)%4]);
      }
    }
  }
  function splitLogs(x,y,z,n=6,s=.8){
    for(let i=0;i<n;i++){
      const row=Math.floor(i/3),xx=x+(i%3-1)*.36*s,yy=y+row*.33*s;
      cyl(xx,yy,z,.35*s,1.7*s,.35*s,C.wood,Math.PI/2);
      cyl(xx,yy,z+.86*s,.31*s,.035,.31*s,0xc29153,Math.PI/2);
      add(shapes.band,xx,yy,z+.882*s,.14*s,.14*s,.14*s,0x936d3c);
    }
  }
  function rail(a,b,h=1.2){
    beam([a[0],.12,a[1]],[a[0],h+.18,a[1]],.18,C.wood);beam([b[0],.12,b[1]],[b[0],h+.18,b[1]],.18,C.wood);
    for(const y of [.42,h])beam([a[0],y,a[1]],[b[0],y,b[1]],.13,C.honey);
    beam([a[0],.44,a[1]],[b[0],h,b[1]],.1,C.wood);
  }
  function leanRoof(cx,y,cz,w,d){
    for(let row=0;row<6;row++)for(let col=0;col<9;col++){
      const x=cx+(col/9-.5)*w,z=cz+row*d/6,x1=x+w/9,z1=z+d/6;
      const height=v=>y-.78*v/d+.17*Math.pow(v/d,2);
      const y0=height(z-cz),y1=height(z1-cz),mid=(x+x1)/2;
      add(geometry([x,y0,z,x1,y0,z,mid,y0+.075,z,x,y1,z1,x1,y1,z1,mid,y1+.075,z1],[0,3,2,2,3,5,2,5,1,1,5,4,3,4,5]),0,0,0,1,1,1,[C.roof,C.tile,0xd17b45,0xb76037][(col+row)%4]);
      beam([x,y1-.04,z1],[x1,y1-.04,z1],.06,0x8e472b);
    }
    beam([cx-w*.54,y-.66,cz+d],[cx+w*.54,y-.66,cz+d],.18,C.wood);
    for(const side of [-1,1])beam([cx+side*w*.44,.15,cz+d*.9],[cx+side*w*.44,y-.45,cz+d*.9],.17,C.wood);
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
  function localFrame(x,y,z,yaw,fn){
    const saved=origin.clone(),o=new THREE.Matrix4().makeRotationY(yaw);o.setPosition(x,y,z);origin.multiply(o);fn();origin.copy(saved);
  }
  function grain(x,y,z,w,h){
    // Several broad, slightly wandering wood fibres; geometry replaces texture
    // maps and remains in the same opaque landmark batch.
    for(let row=0;row<5;row++){
      const ps=[],ix=[],yy=y+(row/4-.5)*h*.78;
      for(let i=0;i<=9;i++){
        const xx=x+(i/9-.5)*w*.93,wiggle=Math.sin(i*.82+row)*h*.014;
        ps.push(xx,yy+wiggle-.009,z,xx,yy+wiggle+.009,z);
        if(i<9){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
      }
      add(geometry(ps,ix),0,0,0,1,1,1,row%2?0x76502f:0xb4864d);
    }
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
  // Broad irregular flagstones, deliberately sparse joints: no per-stone mesh,
  // noisy texture, raised collision obstacle or hidden geometry under buildings.
  at('plaza-south',0,0);
  const bed=[];for(let i=0;i<64;i++){const a=i*Math.PI/32,r=.98+Math.sin(i*2.4)*.025;bed.push([Math.cos(a)*6.15*r,15.5+Math.sin(a)*20.5*r]);}
  const bedVerts=[0,.016,15.5],bedIx=[];for(const [x,z] of bed)bedVerts.push(x,.016,z);for(let i=0;i<64;i++)bedIx.push(0,1+(i+1)%64,1+i);
  add(geometry(bedVerts,bedIx),0,0,0,1,1,1,0xbaa783);
  const sites=[];
  for(let row=-1;row<27;row++)for(let col=-11;col<=11;col++){
    const x=col*1.48+(row%2)*.74+(rand()-.5)*.85,z=-5+row*1.63+(rand()-.5)*.78;
    sites.push([x,z,(x*x/37+(z-18)*(z-18)/380<1)||(Math.abs(x)<3.35&&z<15)]);
  }
  // Voronoi cells turn the regular seed grid into hand laid, non-overlapping
  // stone polygons. Generation is only at load; runtime cost is one static draw.
  for(const site of sites){
    if(!site[2])continue; // Off-path seeds still bound the outer Voronoi cells.
    let poly=[[-18,-9],[18,-9],[18,36],[-18,36]];
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
  function roof(cx,y,cz,w,d,h){
    const tileSegments=40,base=loop(w,d,tileSegments,3.4),profiles=[[1.1,0],[1.085,.045],[1.055,.12],[1.01,.21],[.95,.33],[.86,.47],[.74,.62],[.60,.77],[.41,.91],[.2,1]],rings=[];
    for(const [s,yy] of profiles)rings.push(base.map(([x,z])=>[x*s,y+yy*h,z*s]));
    add(loft(rings),cx,0,cz,1,1,1,0x90492e);
    // Individual overlapping curved clay tile strips are baked into the roof
    // batch: relief and colour variation without separate object/draw overhead.
    for(let row=0;row<profiles.length-1;row++)for(let i=0;i<tileSegments;i++){
      const i2=(i+1)%tileSegments,a=rings[row][i],b=rings[row][i2],c=rings[row+1][i],d0=rings[row+1][i2];
      const corners=[a,b,d0,c].map(v=>[cx+v[0],v[1]+.035,cz+v[2]]);
      const mid=corners.reduce((v,p)=>v.map((a,j)=>a+p[j]/4),[0,0,0]);
      const ps=[];for(const p of corners)ps.push(mid[0]+(p[0]-mid[0])*.97,p[1]+.028+Math.sin(i*1.8+row)*.011,mid[2]+(p[2]-mid[2])*.97);
      ps.push(mid[0],mid[1]+.085,mid[2]);
      add(geometry(ps,[0,4,1,1,4,2,2,4,3,3,4,0]),0,0,0,1,1,1,tint([C.roof,C.tile,0xbd6239,0xc56b40][Math.floor(rand()*4)],.94+rand()*.12));
      add(geometry([ps[0],ps[1],ps[2],ps[3],ps[4],ps[5],ps[0],ps[1]-.075,ps[2],ps[3],ps[4]-.075,ps[5]],[0,1,2,1,3,2]),0,0,0,1,1,1,0x944c2e);
    }
    for(let i=0;i<tileSegments;i++){
      const a=rings[0][i],b=rings[0][(i+1)%tileSegments];beam([cx+a[0],a[1]-.03,cz+a[2]],[cx+b[0],b[1]-.03,cz+b[2]],.19,C.wood);
    }
    softBox(cx,y+h+.035,cz,w*.27,.23,d*.23,C.tile,.07);
  }
  function awning(cx,y,cz,w,d){
    const ps=[],ix=[],nx=16,nz=8;
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const u=i/nx,v=j/nz,xx=(u-.5)*w;
      // Suspended cloth sags between ties and has visible stitched scallops.
      const yy=y-.45*v-.4*Math.sin(Math.PI*u)*Math.sin(Math.PI*v*.85)+.045*Math.cos(u*Math.PI*12);
      ps.push(cx+xx,yy,cz+v*d);
      if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+nx+1;ix.push(a,b,a+1,a+1,b,b+1);}
    }
    add(geometry(ps,ix),0,0,0,1,1,1,C.cloth);
    // The cloth underside is geometry, avoiding a global DoubleSide material.
    add(geometry(ps,ix.flatMap((_,i,a)=>i%3===0?[a[i],a[i+2],a[i+1]]:[])),0,-.025,0,1,1,1,0xc9954a);
    for(const side of [-1,1])beam([cx+side*w/2,.12,cz+d],[cx+side*w/2,y-.15,cz+d],.13,C.wood);
    for(let i=0;i<12;i++){
      const x=cx-w/2+(i+.5)*w/12;
      const archG=arch(w/12,.34,.025);add(archG,x,y-.44,cz+d,1,1,1,i%2?C.cloth:0xf0cc7b,0,0,Math.PI);
    }
    beam([cx-w/2,y-.44,cz+d],[cx+w/2,y-.44,cz+d],.09,0xc49a53);
  }
  function footprint(r) {
    // A worn retaining terrace identifies the reserved collision plot. Uneven
    // stone blocks and planted pockets replace the isolated rope-ring islands.
    const n=36;
    for(let i=0;i<n;i++){
      const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,rr=r-.20-(i%4)*.018;
      const x=Math.cos(a)*rr,z=Math.sin(a)*rr,yy=.16+(i%3)*.035;
      softBox(x,yy,z,.69,yy*2,.35,[0xa39874,0xb4a47f,0xc4b491][i%3],.045,-a);
      if(i%5===0)grass(x*.98,z*.98,.85);
      // Plant the outside-facing half densely, leave a visibly closed low curb
      // at the road-facing front, and keep each solid clump inside the plot.
      if(i%4===0&&Math.sin(a)<.6)foliage(Math.cos(a)*(r-1.03),Math.sin(a)*(r-1.03),.94,.9+(i%3)*.2);
    }
  }
  // Workshop: rounded plaster volume, timber frame, curved tile roof and an
  // exposed glowing forge. Every solid part remains within radius six.
  atSite('workshop',.25);footprint(6);contact(0,-.15,5.35,4.6,.23);contact(-1,3.5,3.1,1.75,.32);
  softBox(0,.25,0,8.9,.5,7.9,C.stone,.18);
  softBox(0,2.1,-.25,7.9,3.5,5.8,C.cream,.2);
  softBox(0,5.22,-.48,7.2,2.9,5.5,C.pale,.18);
  softBox(0,3.76,-.35,8.1,.33,6.2,C.honey,.08);
  softBox(0,6.65,-.48,7.4,.24,5.65,C.wood,.06);
  for(const x of [-3.25,0,3.25])beam([x,.45,2.48],[x,6.6,2.48],.27,C.wood);
  for(const side of [-1,1]){
    beam([side*3.85,.5,-2.1],[side*3.85,3.5,-2.1],.27,C.wood);
    beam([side*3.65,3.95,1.8],[side*3.65,6.6,-1.9],.16,C.honey);
  }
  roof(0,6.75,-.48,8.2,6.85,2.65);
  for(let row=0;row<3;row++)for(let i=0;i<18;i++){
    const a=(i+(row%2)*.5)*Math.PI/9,co=Math.cos(a),si=Math.sin(a);
    const x=Math.sign(co)*Math.pow(Math.abs(co),.5)*4.01,z=-.25+Math.sign(si)*Math.pow(Math.abs(si),.5)*2.98;
    softBox(x,.37+row*.24,z,.68,.23,.23,[0xa99a7d,0xbaac8b,0xc9b897][(i+row)%3],.04,Math.atan2(-si,co));
  }
  for(const side of [-1,1]){
    beam([side*3.87,1.04,-1.9],[side*3.87,3.45,1.95],.19,C.wood);
    beam([side*3.50,4.03,-1.8],[side*3.5,6.45,1.8],.16,C.honey);
    localFrame(side*3.83,0,-.1,side*Math.PI/2,()=>windowArch(0,1.5,0,1.15,1.48));
    localFrame(side*3.49,0,-.4,side*Math.PI/2,()=>windowArch(0,4.62,0,.94,1.35));
  }
  // A darker fascia and timber corbels form contact shade beneath the eaves.
  softBox(0,6.66,-.48,7.5,.16,5.7,0x5f452b,.04);
  for(const x of [-3.2,-1.6,1.6,3.2])beam([x,6.13,2.24],[x,6.65,2.64],.15,C.honey);
  // Small lower lean-to roofs and warm wooden corner brackets give the facade
  // depth without using another whole stacked cottage.
  for(const side of [-1,1]){
    beam([side*3.2,2.8,2.7],[side*3.2,3.6,3.6],.16,C.wood);
    windowArch(side*2.45,4.3,2.32,1.1,1.55);
  }
  door(2.25,.52,2.65,1.3,2.65);
  // Forge recessed dark arch, thick stone cheeks and a low chimney.
  add(arch(2.45,3.1,.28),-1.36,.42,2.61,1,1,1,C.lightStone);
  add(arch(1.83,2.63,.06),-1.36,.45,2.96,1,1,1,0x3c332c);
  softBox(-1.36,.82,3.03,2.13,.32,1.05,C.stone,.09);
  for(let i=0;i<5;i++)add(shapes.rock,-1.95+i*.3,1.12,3.17,.35,.19,.35,0xe59837,0,0,0,true);
  const flame=lathe([[0,0],[.19,.05],[.29,.22],[.17,.55],[.08,.84],[0,1.02]],8);
  add(flame,-1.38,1.11,3.09,1,1,1,0xffc66a,0,0,0,true);
  add(flame,-1.67,1.11,3.21,.5,.62,.5,0xffe0a0,0,0,0,true);
  softBox(-2.45,7.75,-1.8,1.0,3.8,1.0,C.lightStone,.14);
  for(const y of [6.25,7,7.7,8.4,9.1])softBox(-2.45,y,-1.8,1.07,.13,1.07,0xb1a086,.03);
  softBox(-2.45,9.69,-1.8,1.4,.27,1.4,C.stone,.08);
  box(-2.45,9.82,-1.8,.75,.015,.75,C.dark);
  // Anvil sign, its silhouette readable even without a generated text texture.
  softBox(.2,3.62,3.18,3.2,1.25,.22,C.honey,.1);
  grain(.2,3.62,3.307,3.1,1.12);anvil(.14,3.3,3.37,.6);
  for(const x of [-1.15,1.5])beam([x,4.08,2.65],[x,4.12,3.28],.1,C.iron);
  anvil(.05,.44,4.3,1.04);
  bench(-2.9,1.32,3.55,1.65,.75);hammer(-2.6,1.68,3.56,.65,.3);
  lantern(1.4,2.65,3.38,.63);lantern(-3.1,2.8,3.17,.62);
  awning(2.5,3.25,2.3,2.2,1.7);
  barrel(3.25,3.65,.68);crate(2.7,.18,4.2,.68);
  shrub(-3.7,2.9,.65);
  for(const [x,z] of [[-4.4,2.2],[-3.4,4.2],[3.8,3.55],[-4.5,-2.5]]){shrub(x,z,.58);grass(x+.2,z+.2,.8);}
  for(let i=0;i<3;i++)hammer(-3.46+i*.27,1.95,2.8,.47,i*.2);
  bench(-3.35,1.14,1.2,1.15,.67);crate(-3.45,.15,.1,.56);
  bench(2.25,1.19,3.55,2.0,.75);
  for(let i=0;i<3;i++){
    const jar=lathe([[0,0],[.14,0],[.21,.12],[.19,.3],[.10,.35],[.10,.44],[0,.44]],8);
    add(jar,1.59+i*.38,1.31,3.5,1,1,1,[0x73968d,0xb19a65,0x8999a4][i]);
    cyl(1.59+i*.38,1.78,3.5,.23,.08,.23,C.honey);
  }
  for(let i=0;i<4;i++){
    const x=-3.5+(i%2)*.38,y=.42+Math.floor(i/2)*.32;
    cyl(x,y,2.2,.33,1.1,.33,C.wood,Math.PI/2);
    cyl(x,y,2.78,.3,.04,.3,C.honey,Math.PI/2);
    add(shapes.ring,x,y,2.81,.15,.15,.15,0x705034);
  }
  for(const [x,y] of [[2.8,2.13],[3.1,2.4]]){hammer(x,y,2.77,.63,.15);ball(x,2.8,2.81,.08,.08,.04,C.iron);}
  // Layered worn stone terrace, kept wholly inside the reserved shop plot.
  for(let row=0;row<3;row++)for(let i=0;i<4;i++)softBox(-1.9+i*.79,.29-row*.075,3.9+row*.4,.77,.22, .54,[0xb6a286,0xc8b396,0xd4c09f][(i+row)%3],.055);
  // Step stones sit inside the circular workshop footprint, level with the
  // walkable ground at the edge so the visible facade matches collision.
  for(let i=0;i<5;i++)softBox(-1.9+i*.85,.1,4.78,.8,.18,.7,C.lightStone,.06);

  // Side wings, a hanging work apron and stacked workshop goods turn the
  // plaster cylinder into a working frontage with a deep silhouette.
  leanRoof(-3.6,3.87,-.55,2.25,3.9);
  localFrame(-3.6,0,.7,-Math.PI/2,()=>{
    shelf(0,.28,0,2.6);
    bench(0,1.23,.75,2.5,.82);
    anvil(-.72,1.34,.7,.46);hammer(.32,1.59,.74,.57,-.3);
    jar(.8,1.37,.7,.55,0x7c9990);
    lantern(-1.15,2.87,.85,.59);
  });
  // A short tiled wing steps down towards the market street instead of a
  // second detached house. Lower additions remain wholly inside radius six.
  leanRoof(3.43,3.84,-.5,2.0,2.82);
  shelf(3.9,.35,.2,1.75);
  barrel(3.85,2.82,.72);sack(4.35,.16,1.85,.86);sack(4.55,.16,.7,.67);
  flowerPot(-3.93,3.49,.62);flowerPot(3.62,4.01,.65);
  flowerPot(-4.84,.19,.75);flowerPot(4.67,-.5,.7);
  basket(-2.85,.16,4.35,.73,false);splitLogs(-2.6,.32,3.7,7,.76);
  for(let i=0;i<3;i++){hammer(-3.56+i*.37,2.4,3.01,.78,(i-1)*.13);}
  // Open tool rail and hanging cloth are visible at eye height, not lost among
  // grass at the feet of the building.
  beam([-3.8,2.91,2.94],[-2.25,2.91,2.94],.12,C.wood);
  const apron=geometry([-2.24,3.18,2.94,-1.54,3.18,2.94,-2.30,1.98,3.12,-1.49,1.92,3.12],[0,2,1,1,2,3,0,1,2,1,3,2]);
  add(apron,0,0,0,1,1,1,C.blue);
  box(-1.9,2.44,3.13,.57,.14,.045,0x9f884e);
  // Window flower boxes give the second storey smaller, warmer shapes.
  for(const side of [-1,1]){
    softBox(side*2.45,4.14,2.69,1.54,.3,.58,C.honey,.06);
    for(let i=0;i<5;i++)ball(side*2.45+(i-2)*.23,4.36+(i%2)*.12,2.7,.39,.3,.42,[0x758b48,0x899c51,0xb6af58][i%3]);
  }

  // A parked travelling fortress: four big spoked wheels, curved canvas hood,
  // high luggage deck and iron-banded timber. Its width/depth fit radius six.
  atSite('wagon',-.17);footprint(6);contact(0,0,4.2,4.3,.32);
  softBox(0,2.3,0,5.5,1.0,6.0,C.wood,.15);
  for(let j=0;j<5;j++)softBox(0,2.15+j*.39,0,5.6,.3,6.03,j%2?C.honey:0x94683c,.035);
  for(const x of [-2.76,2.76])for(const z of [-2.68,0,2.68])beam([x,1.65,z],[x,4.3,z],.17,C.iron);
  for(const z of [-2.15,2.15]){
    beam([-3.3,1.8,z],[3.3,1.8,z],.32,C.iron);
    for(const side of [-1,1]){
      const x=side*3.16;
      add(shapes.ring,x,1.81,z,3.5,3.5,3.5,C.wood,0,Math.PI/2);
      add(shapes.ring,x+side*.07,1.81,z,3.66,3.66,3.66,C.iron,0,Math.PI/2);
      for(let i=0;i<10;i++){
        const a=i*Math.PI/5;beam([x,1.81,z],[x,1.81+Math.sin(a)*1.58,z+Math.cos(a)*1.58],.16,C.honey);
      }
      cyl(x,1.81,z,.74,.43,.74,C.brass,0,0,Math.PI/2);
      cyl(x+side*.26,1.81,z,.37,.18,.37,C.iron,0,0,Math.PI/2);
      add(shapes.ring,x+side*.03,1.81,z,3.16,3.16,3.16,C.honey,0,Math.PI/2);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;ball(x+side*.14,1.81+Math.sin(a)*1.79,z+Math.cos(a)*1.79,.095,.095,.095,0xb4a786);}
      for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(x+side*.365,1.81+Math.sin(a)*.25,z+Math.cos(a)*.25,.065,.065,.065,0xe4bd6e);}
    }
  }
  for(const side of [-1,1])localFrame(side*2.82,0,0,side*Math.PI/2,()=>{
    for(let j=0;j<5;j++)grain(0,2.15+j*.39,0,5.7,.26);
  });
  for(let j=0;j<5;j++)grain(0,2.15+j*.39,3.04,5.4,.25);
  // Canvas is a true arched surface, with six low relief rib bands.
  const hoop=(z,width=5.5,height=2.5)=>{
    const ps=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI;ps.push([Math.cos(a)*width/2,3.35+Math.sin(a)*height,z]);}return ps;
  };
  const hoodPs=[],hoodIx=[];
  for(let j=0;j<=8;j++){
    const z=-2.68+j*5.36/8;
    for(let i=0;i<=16;i++){const p=hoop(z)[i];p[1]-=.06*Math.sin(j*Math.PI/2);hoodPs.push(...p);if(i<16&&j<8){const a=j*17+i;hoodIx.push(a,a+1,a+17,a+1,a+18,a+17);}}
  }
  add(geometry(hoodPs,hoodIx),0,0,0,1,1,1,C.pale);
  for(const z of [-2.68,-1.6,0,1.6,2.68]){
    const rib=hoop(z,5.62,2.57);for(let i=0;i<rib.length-1;i++)beam(rib[i],rib[i+1],.13,C.honey);
  }
  // Front canvas end: fan with doorway cut represented by a raised cloth flap.
  const end=arch(4.8,2.7,.05);add(end,0,3.15,2.65,1,1,1,0xc7b58e);
  add(arch(1.48,2.1,.07),0,3.23,2.75,1,1,1,C.dark);
  softBox(0,6.1,-.2,5.7,.24,5.7,C.wood,.07);
  for(const x of [-2.65,2.65])for(const z of [-2.7,0,2.6])beam([x,6.15,z],[x,7.3,z],.15,C.honey);
  for(const y of [6.65,7.23]){
    for(const x of [-2.65,2.65])beam([x,y,-2.7],[x,y,2.6],.15,C.honey);
    for(const z of [-2.7,2.6])beam([-2.65,y,z],[2.65,y,z],.15,C.honey);
  }
  crate(-1.2,6.23,-1.3,1.2);crate(1.1,6.23,-1.65,.95);
  // Rope-bound bedrolls are curved, not boxes posing as fabric.
  cyl(.4,6.55,.5,.64,1.65,.64,0x7c9690,0,0,Math.PI/2);
  for(const x of [-.1,.9])add(shapes.ring,x,6.55,.5,.67,.67,.67,C.honey,0,Math.PI/2);
  // Short boarding ladder remains tucked inside the footprint.
  for(const x of [-.85,.85])beam([x,.15,4.2],[x,3.3,2.87],.18,C.wood);
  for(let j=0;j<7;j++)beam([-.88,.3+j*.44,4.13-j*.19],[.88,.3+j*.44,4.13-j*.19],.15,C.honey);
  lantern(-2.53,3.4,3.15,.7);
  barrel(-3.85,.2,.72);shrub(3.9,.2,.65);
  // A blue expedition pennant with a simple gold compass, all opaque.
  box(-2.4,4.3,3.05,1.1,1.6,.045,C.blue);
  beam([-2.4,3.78,3.09],[-2.4,4.88,3.09],.055,C.brass);
  beam([-2.88,4.3,3.09],[-1.92,4.3,3.09],.055,C.brass);
  add(shapes.ring,-2.4,4.3,3.1,.7,.7,.7,C.brass);

  // The wagon is parked in a busy loading bay. Ground-level freight, wagon
  // repair tools and bundled fabrics connect its huge wheels to village scale.
  localFrame(-3.66,0,-.38,-Math.PI/2,()=>{
    shelf(0,.15,0,2.9);sack(-1.03,.16,.82,.87);basket(.92,.18,.81,.72);
    lantern(-1.25,2.7,.62,.57);
  });
  crate(1.65,.16,3.66,.98);crate(2.65,.16,3.54,.68);sack(1.65,1.14,3.66,.73);
  basket(-1.83,.15,3.61,.83);sack(-2.61,.14,3.62,.82);
  barrel(3.92,-1.1,.85);barrel(4.15,.2,.66);
  splitLogs(3.5,.3,-2.5,6,.8);flowerPot(3.64,3.34,.8);
  for(const side of [-1,1]){
    const xx=side*2.5;
    cyl(xx,4.26,-2.64,.42,1.2,.42,[0x849c96,0x9c7249][side===1?1:0],0,0,Math.PI/2);
    add(shapes.ring,xx,4.26,-2.64,.45,.45,.45,C.honey,0,Math.PI/2);
  }
  for(const [x,z,h] of [[-3.6,-3.4,1.3],[2.95,-3.9,1.5],[4.2,1.9,1.1]])foliage(x,z,.85,h);
  rail([-4.75,-1.65],[-3.7,-3.45],1.05);

  // Supply canopy nearest the player: no opaque tall wall to occlude the
  // original Season 1 characters or the route through the broad plaza.
  atSite('market',-.23);footprint(5);contact(0,0,3.55,3.5,.25);
  softBox(0,.12,0,7.3,.2,6.6,C.stone,.08);
  const ps=[],ix=[],clothX=24,clothZ=12;
  for(let j=0;j<=clothZ;j++)for(let i=0;i<=clothX;i++){
    const u=i/clothX*2-1,v=j/clothZ;
    const y=1.97+2.63*Math.pow(1-Math.abs(u),1.65)-.19*Math.sin(v*Math.PI)+.04*Math.sin(u*Math.PI*12)*(1-Math.abs(u));
    ps.push(u*3.1,y,-2.4+v*4.8);
    if(i<clothX&&j<clothZ){const a=j*(clothX+1)+i,b=a+clothX+1;ix.push(a,b,a+1,a+1,b,b+1);}
  }
  add(geometry(ps,ix),0,0,0,1,1,1,C.cloth);
  add(geometry(ps,ix.flatMap((_,i,a)=>i%3===0?[a[i],a[i+2],a[i+1]]:[])),0,-.04,0,1,1,1,0xb38a42);
  for(const z of [-2.4,2.4])for(let i=0;i<clothX;i++){
    const u=i/clothX*2-1,v=(i+1)/clothX*2-1;
    beam([u*3.1,1.97+2.63*Math.pow(1-Math.abs(u),1.65),z],[v*3.1,1.97+2.63*Math.pow(1-Math.abs(v),1.65),z],.065,0xf0d18a);
  }
  for(const z of [-2.4,2.4]){
    beam([0,.1,z],[0,4.83,z],.19,C.wood);
    for(const side of [-1,1])beam([side*3.15,.1,z],[side*3.1,2.25,z],.13,C.wood);
  }
  beam([0,4.62,-2.7],[0,4.62,2.7],.18,C.honey);
  awning(-1.8,2.5,1.7,3.0,1.9);
  bench(-1.8,1.18,2.6,2.5,1.0);
  for(let i=0;i<4;i++)ball(-2.65+i*.52,1.43,2.57,.44,.35,.35,[0xba723b,0xd2a257,0xb2854a,0xd7b57b][i]);
  barrel(2.75,1.9,.85);crate(1.7,.23,-1.2,.95);crate(2.5,.23,-.2,.75);
  lantern(-3.15,1.62,3.55,.55);lantern(2.95,1.45,2.4,.55);
  shrub(-3.35,-1.8,.75);

  // Shelves, rolls of cloth and hanging cookware use the entire open tent,
  // rather than a single table under a mostly empty canopy.
  shelf(0,.21,-1.75,4.65);
  for(let i=0;i<4;i++){
    const x=-1.65+i*1.08;
    cyl(x,1.3,-.62,.48,1.5,.48,[C.blue,0xa56d48,0xa6a270,0xc9b389][i],0,0,Math.PI/2);
    for(const xx of [-.48,.48])add(shapes.ring,x+xx,1.3,-.62,.5,.5,.5,C.honey,0,Math.PI/2);
  }
  bench(.2,1.04,-.6,4.85,1.22);
  localFrame(2.97,0,-.48,Math.PI/2,()=>shelf(0,.18,0,2.05));
  basket(.33,.25,2.52,.9);basket(1.46,.25,2.68,.76);sack(.85,.25,1.49,.83);
  sack(2.22,.25,-2.75,1.05);sack(1.24,.25,-2.93,.83);crate(-2.63,.24,-2.46,.77);
  barrel(-3.59,-.19,.72);barrel(-3.51,.92,.57);
  flowerPot(2.38,3.59,.74);flowerPot(-3.47,2.3,.7);
  // Side valances give the tent a cloth silhouette from the initial camera.
  for(const side of [-1,1]){
    const x=side*3.08;
    for(let i=0;i<6;i++){
      const z=-2.35+i*.8;
      const cloth=geometry([x,1.96,z,x,1.96,z+.73,x+side*.05,1.5,z+.05,x+side*.12,1.45,z+.68],[0,1,2,1,3,2,0,2,1,1,2,3]);
      add(cloth,0,0,0,1,1,1,i%2?0xe4bc72:0xce9d51);
    }
  }
  for(let i=0;i<4;i++){
    const x=-1.3+i*.87;beam([x,2.55,-1.3],[x,2.16,-1.3],.035,C.iron);
    add(shapes.ring,x,1.99,-1.3,.42,.42,.42,C.iron);
    cyl(x,1.92,-1.27,.34,.13,.34,0x8d968b,Math.PI/2);
  }
  rail([-3.62,-2.17],[-2.03,-3.52],.87);
  foliage(3.24,-2.42,.95,1.25);foliage(-2.45,-3.16,.81,1.15);

  // Low assembly corner: warm stone hearth, split-log seats and noticeboard.
  // Unlike a fourth tall house it keeps the spawn camera open.
  atSite('assembly',.17);footprint(5);contact(0,0,2.5,2.5,.21);contact(0,-3,1.9,.9,.27);
  cyl(0,.06,0,7.5,.08,7.5,0xb7ab8b);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;softBox(Math.sin(a)*1.6,.31,Math.cos(a)*1.6,.83,.58,.57,C.stone,.09,-a);
  }
  cyl(0,.09,0,2.6,.06,2.6,0x5c5441);
  for(const angle of [-.4,.8])beam([-Math.cos(angle)*.8,.26,-Math.sin(angle)*.8],[Math.cos(angle)*.8,.5,Math.sin(angle)*.8],.32,C.wood);
  for(const z of [-2.9,2.9]){
    softBox(0,.7,z,3.8,.32,.9,C.honey,.07);
    for(const x of [-1.3,1.3])cyl(x,.36,z,.55,.64,.55,C.wood);
  }
  for(const x of [-1.25,1.25])beam([x,.1,-3],[x,3.35,-3],.23,C.wood);
  softBox(0,2.25,-3,3.0,1.75,.24,C.honey,.1);
  box(0,2.24,-2.85,2.65,1.42,.03,C.dark);
  for(const [x,y,w,h] of [[-.63,2.3,.55,.86],[.13,2.39,.6,.71],[.8,2.13,.5,.58]]){
    box(x,y,-2.805,w,h,.025,0xe3cf9f);box(x,y+h*.4,-2.78,w*.6,.035,.015,0x9b7953);
  }
  roof(0,3.17,-3,3.3,1.1,.62);
  barrel(3.2,-.7,.74);crate(-3.1,.05,.9,.7);
  shrub(2.9,1.8,.8);shrub(-2.9,-1.3,.75);

  // Supplies, log stools and a planted foreground make the assembly area a
  // lived-in corner; it remains lower than the player's view into the road.
  for(const [x,z] of [[-2.65,2.2],[2.95,1.05],[-3.7,-.23]]){
    cyl(x,.32,z,.75,.56,.75,C.wood);cyl(x,.62,z,.77,.065,.77,C.honey);
  }
  basket(-2.65,.06,-2.05,.77,false);sack(2.27,.08,-2.71,.91);sack(3.18,.08,-1.9,.74);
  splitLogs(-2.62,.26,.12,9,.7);flowerPot(-1.65,-3.25,.8);flowerPot(1.83,-3.19,.76);
  bench(-2.83,1.17,-1.3,1.56,.8);jar(-3.12,1.28,-1.26,.6,0x8ca291);basket(-2.5,1.3,-1.3,.51);
  foliage(-2.36,3.12,1.18,1.36);foliage(2.0,3.45,1.01,1.13);foliage(-3.55,1.29,.97,1.21);
  rail([-4.18,1.53],[-3.27,3.19],1.04);rail([2.22,3.67],[3.71,2.17],.9);
  for(let i=0;i<3;i++){
    const x=-.83+i*.83;
    beam([x,3.08,-2.75],[x,2.88,-2.69],.035,C.honey);
    box(x,2.57,-2.67,.47,.6,.035,[C.blue,0xb67849,0x9a9d67][i]);
  }

  // Two shared collision plots close the large strips of empty grass between
  // the four landmarks. They merge into adjacent landmark bins, so there is
  // no extra material, draw call, texture or per-frame scenery update.
  const smithYard=VILLAGE_SITES.smithYard;
  at('workshop',smithYard.x,smithYard.z,.06);footprint(smithYard.r);
  contact(0,0,2.7,2.6,.19);
  leanRoof(-.1,3.75,-2.12,4.1,3.52);
  shelf(-.15,.15,-1.62,4.32);
  // Back timber and two separate tool panels leave this clearly an open shop.
  for(const x of [-1.63,1.43]){
    softBox(x,1.53,-2.22,1.15,1.77,.19,C.dark,.045);
    for(let i=0;i<3;i++)hammer(x-.36+i*.36,1.6,-2.06,.92,(i-1)*.18);
  }
  bench(.6,1.24,.22,2.75,1.12);anvil(.1,1.36,.3,.75);hammer(1.4,1.64,.28,.74,-.2);
  splitLogs(-1.59,.26,.62,9,.93);sack(1.92,.15,1.35,.88);basket(1.03,.14,2.05,.81,false);
  barrel(-1.72,1.72,.88);barrel(-2.3,.84,.63);flowerPot(2.43,-.22,.7);
  lantern(-1.96,2.81,1.45,.71);lantern(1.77,2.64,1.47,.57);
  rail([-2.64,-1.04],[-1.76,-2.38],1.31);
  foliage(-2.03,-1.55,.95,1.27);foliage(1.89,-1.65,.96,1.46);foliage(.14,-2.55,.9,1.52);
  // A worn apron at the near post and a wheel in repair add recognisable craft.
  const cloth=geometry([-1.95,2.69,1.52,-1.23,2.69,1.52,-2.04,1.22,1.7,-1.18,1.19,1.69],[0,2,1,1,2,3,0,1,2,1,3,2]);
  add(cloth,0,0,0,1,1,1,0x64848d);
  add(shapes.ring,2.27,.8,.82,1.46,1.46,1.46,C.honey,0,.2);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;beam([2.27,.8,.82],[2.27+Math.cos(a)*.65,.8+Math.sin(a)*.65,.82],.09,C.wood);}

  const supplyYard=VILLAGE_SITES.supplyYard;
  at('market',supplyYard.x,supplyYard.z,-.12);footprint(supplyYard.r);
  contact(0,0,2.4,2.5,.18);
  awning(0,3.39,-1.55,4.65,2.85);
  beam([-2.32,.2,-1.58],[-2.32,3.55,-1.58],.15,C.wood);beam([2.32,.2,-1.58],[2.32,3.55,-1.58],.15,C.wood);
  shelf(0,.15,-1.51,4.45);
  bench(-.54,1.02,.44,3.36,1.19);
  for(let i=0;i<4;i++)basket(-1.78+i*.76,1.16,.39,.59);
  sack(1.61,.1,.45,1.07);sack(1.83,.1,1.53,.72);barrel(-1.72,1.84,.7);
  crate(.24,.1,1.77,.93);sack(.21,1.03,1.77,.71);basket(-.73,.1,1.94,.67);
  flowerPot(2.31,.36,.66);flowerPot(-2.39,-.04,.65);
  lantern(-2.11,2.55,1.28,.64);lantern(2.0,2.61,1.33,.63);
  foliage(-1.52,-1.72,.88,1.4);foliage(1.39,-1.78,.86,1.56);
  rail([-2.56,-.75],[-1.76,-2.18],1.12);

  for(const [name,yaw] of [['workshop',.25],['wagon',-.17],['market',-.23],['assembly',.17]]){
    const {x,z,r}=VILLAGE_SITES[name];at(name,x,z,yaw);
    for(let i=0;i<14;i++){
      const a=i*Math.PI/7,r0=r-.52;
      if(i%3===0)shrub(Math.cos(a)*r0,Math.sin(a)*r0,.45);
      grass(Math.cos(a)*r0,Math.sin(a)*r0,.75);
    }
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
  // Plant the verge beside the road, not in its clear central walking lane.
  // These soft plants integrate the formerly isolated circular foundations.
  at('plaza-south',0,0);
  for(let z=-5;z<35;z+=1.55)for(const side of [-1,1]){
    const ellipse=6.08*Math.sqrt(Math.max(0,1-(z-18)*(z-18)/380));
    const edge=Math.max(z<15?3.6:0,ellipse),x=side*(edge+.46+rand()*.3);
    current=z<16?'plaza-north':'plaza-south';
    garden(x,z+rand()*.45,1.03+rand()*.33,Math.floor(z)%3===0);
    garden(x+side*.86,z+.56,.83+rand()*.35,true);
    if(Math.floor(z)%4===0)add(shapes.rock,x+side*.35,.095,z+.45,.48,.2,.57,0xa29f78,0,rand()*2);
  }
  // Broad but low plant clusters fill the grassy gaps between landmarks; they
  // do not add collisions or cover the character/tower placement space.
  const beds=[[-6.3,16.2],[-6.8,19.4],[-8.1,22.6],[-12.3,22.6],[7.1,13.8],[8.1,15.1],[8.1,9.3],[10.1,17.0],[-7.1,33.0],[7.9,28.6],[10.1,28.1],[-5.2,.5],[6.3,-1.2]];
  for(const [x,z] of beds){
    current=z<16?'plaza-north':'plaza-south';
    for(let i=0;i<5;i++)garden(x+(rand()-.5)*1.6,z+(rand()-.5)*1.5,.85+rand()*.35,i%2===0);
  }
  for(const [name,yaw] of [['workshop',.25],['wagon',-.17],['market',-.23],['assembly',.17]]){
    const {x,z,r}=VILLAGE_SITES[name];at(name,x,z,yaw);
    for(let i=0;i<20;i++){
      const a=i*Math.PI/10,r0=r-.72;
      garden(Math.cos(a)*r0,Math.sin(a)*r0,.5+rand()*.12,i%3===0);
    }
  }
  // Restored twin pennants frame the way into the forest. Their poles sit
  // outside the broad central route, following the approved concept A.
  at('plaza-north',0,0);
  for(const side of [-1,1]){
    const x=side*7.2,z=-7;
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
  return {meshes,stats:Object.freeze({landmarks:6,batches:meshes.length,opaqueBatches:bins.size,contactBatches:contactBins.size,triangles,vertexBytes:bytes,materials:2,textures:1,textureBytes:grainPixels.byteLength,lights:0,perFrameUpdates:0})};
}
