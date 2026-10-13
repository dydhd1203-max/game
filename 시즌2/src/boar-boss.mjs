// The approved thorn-backed boar: hand-shaped sections, chipped armour and swept
// tusks. Geometry/colour buffers are made once; animation moves eight rigid nodes.
// +Z is forward, matching atan2(dx, dz) in the unchanged combat simulation.
export function createBoarBoss(THREE, scene, resources = new Set()) {
  const owned = new Set(), root = new THREE.Group();
  root.name = 'thorn-backed-boar'; root.visible = false; scene.add(root);
  const material = new THREE.MeshLambertMaterial({vertexColors:true});
  const eyeMaterial = new THREE.MeshBasicMaterial({vertexColors:true});
  for (const resource of [material,eyeMaterial]) {owned.add(resource);resources.add(resource);}
  const clay = {hide:0x534033, flank:0x64503c, bark:0x6e5540, cut:0xa18661,
    plate:0x8e8772, edge:0x605848, hoof:0x393a34, ivory:0xe6d9ae,
    moss:0x7b8247, leaf:0xcb7135, socket:0x251f19, amber:0xffc350};
  const paint = new THREE.Color(), p = new THREE.Vector3();
  const normal = new THREE.Vector3(), edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
  let triangles = 0;

  function builder() { return {positions:[], colors:[], normals:[], frame:new THREE.Matrix4()}; }
  function frame(out, position=[0,0,0], rotation=[0,0,0]) {
    euler.set(...rotation);quaternion.setFromEuler(euler);
    out.frame.compose(p.set(...position),quaternion,new THREE.Vector3(1,1,1));
  }
  function tri(out,a,b,c,color,shade=1,normals=null) {
    paint.setHex(color).multiplyScalar(shade);
    edgeA.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    edgeB.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    normal.crossVectors(edgeA,edgeB).normalize();
    const faceNormal=normal.toArray();
    let i=0;
    for(const point of [a,b,c]){
      p.set(...point).applyMatrix4(out.frame);out.positions.push(p.x,p.y,p.z);
      out.colors.push(paint.r,paint.g,paint.b);
      normal.fromArray(normals?.[i++]||faceNormal).transformDirection(out.frame);
      out.normals.push(normal.x,normal.y,normal.z);
    }
  }
  function quad(out,a,b,c,d,color,shade=1,n=null){tri(out,a,b,c,color,shade,n&&[n[0],n[1],n[2]]);tri(out,a,c,d,color,shade,n&&[n[0],n[2],n[3]]);}
  function loft(out, sections, color, sides=12,rounded=false) {
    const loops=sections.map(([z,y,rx,ry])=>Array.from({length:sides},(_,j)=>{
      const a=j/sides*Math.PI*2;return [Math.cos(a)*rx,y+Math.sin(a)*ry,z];
    }));
    const norms=rounded&&sections.map((section,i)=>{
      const a=sections[Math.max(0,i-1)],b=sections[Math.min(sections.length-1,i+1)];
      const dz=b[0]-a[0]||1,dy=(b[1]-a[1])/dz,dx=(b[2]-a[2])/dz,dr=(b[3]-a[3])/dz;
      return Array.from({length:sides},(_,j)=>{
        const angle=j/sides*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),rx=section[2],ry=section[3];
        return normal.set(ry*c,rx*s,-rx*s*(dy+dr*s)-ry*c*dx*c).normalize().toArray();
      });
    });
    for(let i=0;i<loops.length-1;i++)for(let j=0;j<sides;j++){
      const n=(j+1)%sides,shade=rounded?.98+Math.sin(j/sides*Math.PI*2)*.02:.93+((i*7+j*3)%7)*.02;
      quad(out,loops[i][j],loops[i][n],loops[i+1][n],loops[i+1][j],color,shade,
        rounded&&[norms[i][j],norms[i][n],norms[i+1][n],norms[i+1][j]]);
    }
    for(let j=0;j<sides;j++){
      const n=(j+1)%sides;
      tri(out,[0,sections[0][1],sections[0][0]],loops[0][n],loops[0][j],color,.86);
      const last=sections.length-1;
      tri(out,[0,sections[last][1],sections[last][0]],loops[last][j],loops[last][n],color);
    }
  }
  // A thick, bevelled asymmetric plate. Local +Y faces outwards; the long axis
  // follows Z. The ridge and broken outline keep the silhouette readable far away.
  function plate(out,width,length,depth,color,seed=0) {
    const outline=[[-.42,-.44],[-.53,-.16],[-.46,0],[-.51,.12],[-.31,.44],[-.09,.5],
      [.06,.61],[.27,.4],[.47,.28],[.5,-.3],[.13,-.52]];
    const bottom=outline.map(([x,z])=>[x*width,0,z*length]);
    const bevel=outline.map(([x,z],i)=>[x*width*.98,depth*(.31+((i+seed)%3)*.03),z*length*.98]);
    const top=outline.map(([x,z],i)=>[x*width*.8,depth*(.8+((i+seed)%3)*.06),z*length*.84]);
    const ridge=[-.045*width,depth*1.12,.04*length];
    for(let i=0;i<outline.length;i++){
      const j=(i+1)%outline.length;
      tri(out,ridge,top[i],top[j],color,.96+((i+seed)%5)*.012);
      quad(out,bottom[i],bottom[j],bevel[j],bevel[i],clay.edge,.94);
      quad(out,bevel[i],bevel[j],top[j],top[i],color,.8+((i+seed)%4)*.045);
      tri(out,[0,0,0],bottom[j],bottom[i],clay.edge,.8);
    }
    // Narrow broken fissures follow the actual cap faces. Their small light lip
    // gives stone/bark thickness without texture samples or extra draw calls.
    for(let k=0;k<3;k++){
      const a=top[(seed+k*3+1)%top.length],b=top[(seed+k*3+2)%top.length];
      const surface=(s,t)=>[a[0]*(1-s)*(1-t)+b[0]*(1-s)*t+ridge[0]*s,
        a[1]*(1-s)*(1-t)+b[1]*(1-s)*t+ridge[1]*s+.009,
        a[2]*(1-s)*(1-t)+b[2]*(1-s)*t+ridge[2]*s];
      const a0=surface(.04,.42),a1=surface(.04,.49),b0=surface(.34,.55),b1=surface(.34,.59),tip=surface(.66,.56);
      quad(out,a1,b1,b0,a0,clay.edge,.76);tri(out,b1,tip,b0,clay.edge,.76);
      tri(out,a1,surface(.33,.63),b1,clay.cut,1.08);
    }
  }
  function tube(out, points, radii, color, sides=7,rounded=false) {
    const tangent=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();
    const normals=[];
    const loops=points.map((point,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      tangent.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
      u.set(0,0,1);if(Math.abs(tangent.z)>.93)u.set(0,1,0);
      u.cross(tangent).normalize();v.crossVectors(tangent,u).normalize();
      normals[i]=[];return Array.from({length:sides},(_,j)=>{
        const angle=j/sides*Math.PI*2,c=Math.cos(angle)*radii[i],s=Math.sin(angle)*radii[i];
        normals[i].push([u.x*Math.cos(angle)+v.x*Math.sin(angle),u.y*Math.cos(angle)+v.y*Math.sin(angle),u.z*Math.cos(angle)+v.z*Math.sin(angle)]);
        return [point[0]+u.x*c+v.x*s,point[1]+u.y*c+v.y*s,point[2]+u.z*c+v.z*s];
      });
    });
    for(let i=0;i<loops.length-1;i++)for(let j=0;j<sides;j++){
      const n=(j+1)%sides;quad(out,loops[i][j],loops[i][n],loops[i+1][n],loops[i+1][j],color,rounded?.98:.9+(j%4)*.05,
        rounded&&[normals[i][j],normals[i][n],normals[i+1][n],normals[i+1][j]]);
    }
    for(let j=0;j<sides;j++){
      const n=(j+1)%sides,last=loops.length-1;
      tri(out,points[0],loops[0][n],loops[0][j],color,.85);
      tri(out,points[last],loops[last][j],loops[last][n],color,1.07);
    }
  }
  function curvedTube(out,points,radii,color,sides=12,samples=15){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const interpolated=curve.getPoints(samples).map(p=>p.toArray());
    const widths=interpolated.map((_,i)=>{
      const f=i/samples*(radii.length-1),j=Math.min(radii.length-2,Math.floor(f)),t=f-j;
      return radii[j]*(1-t)+radii[j+1]*t;
    });
    tube(out,interpolated,widths,color,sides,true);
  }
  function mesh(name,out,parent=root,mat=material){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(out.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(out.colors,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(out.normals,3));geometry.computeBoundingSphere();
    triangles+=out.positions.length/9;owned.add(geometry);resources.add(geometry);
    const m=new THREE.Mesh(geometry,mat);m.name=name;
    // Scene checks one conservative boss sphere; individual moving parts have
    // their own static local bounds for the renderer's additional frustum test.
    m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;
  }
  function leaf(out,x,y,z,size,angle){
    frame(out,[x,y,z],[0,angle,0]);
    const points=[[0,.07,0],[-.5*size,0,.05*size],[-.14*size,.01,.27*size],
      [0,0,.65*size],[.15*size,.01,.28*size],[.55*size,0,.12*size]];
    for(let i=1;i<points.length-1;i++)tri(out,points[0],points[i],points[i+1],clay.leaf,1+(i%2)*.1);
  }

  const torso=new THREE.Group();torso.name='boar-body-pivot';root.add(torso);
  const body=builder();
  // The barrel rises into heavy forward shoulders, with a tucked rear belly.
  loft(body,[[-2.65,2.1,.38,.67],[-2.5,2.29,.86,1.0],[-2.34,2.45,1.21,1.21],[-1.9,2.53,1.5,1.38],[-1.6,2.6,1.57,1.45],
    [-1.05,2.6,1.7,1.52],[-.6,2.61,1.8,1.64],[-.08,2.66,1.87,1.7],[.42,2.65,1.88,1.72],
    [.9,2.62,1.81,1.65],[1.32,2.55,1.62,1.52],[1.65,2.43,1.41,1.29],[1.85,2.28,1.17,1.02]],clay.hide,20,true);
  // Layered scales follow the curved shoulders, rather than covering a sphere.
  for(const side of [-1,1]){
    for(let row=0;row<4;row++){
      const z=1.05-row*.78;
      frame(body,[side*1.02,3.86-row*.075,z],[side*.08,.09*side,-side*.54]);
      plate(body,1.52,1.35,.23,clay.plate,row);
      frame(body,[side*1.58,3.15-row*.025,z+.04],[.12*side,side*.08,-side*1.03]);
      plate(body,1.52,1.42,.25,row===0?0x99907b:clay.plate,row+1);
      frame(body,[side*1.74,2.63-row*.01,z-.12],[.14,side*.12,-side*1.39]);
      plate(body,1.09,1.25,.19,row%2?clay.bark:clay.plate,row+2);
    }
    frame(body,[side*1.44,2.7,1.17],[.06,side*.15,-side*1.23]);
    plate(body,1.5,1.5,.28,0x98917e,2);
    frame(body,[side*1.33,3.5,-1.86],[.18,side*.16,-side*.8]);
    plate(body,1.34,1.24,.27,clay.bark,3);
    // Moss grows only in seams; small ochre leaves sell the woodland palette.
    for(let row=0;row<4;row++){
      frame(body,[side*(1.15+row*.08),3.99-row*.19,.58-row*.92],[0,.2*side,-side*.54]);
      plate(body,.44,.8,.08,clay.moss,row);
      leaf(body,side*(1.24+row*.1),4.06-row*.14,.26-row*.68,.55,side+row);
      leaf(body,side*(1.35+row*.08),3.68-row*.12,.78-row*.78,.39,side*.7-row);
    }
  }
  // Broad overlapping forehead-to-shoulder bridge keeps the frontal hump
  // armoured as in the concept, rather than exposing a large plain hide patch.
  frame(body,[0,4.14,.73],[.22,0,0]);plate(body,1.44,1.36,.24,clay.bark,3);
  frame(body,[0,3.96,1.22],[.52,0,0]);plate(body,1.64,1.2,.24,clay.plate,1);
  for(const side of [-1,1]){
    frame(body,[side*.53,3.45,1.64],[.88,side*.12,-side*.18]);
    plate(body,1.13,1.22,.23,clay.plate,2);
  }
  // Splintered dorsal ridge: irregular broad bark blades, not conical spikes.
  for(let i=0;i<6;i++){
    const z=1.06-i*.57,h=[.62,.95,1.27,1.05,.82,.5][i],base=4.0-Math.max(0,i-2)*.17;
    frame(body);
    tube(body,[[0,base,z],[.07,base+h*.35,z-.13],[.07,base+h*.63,z-.25],[.03,base+h,z-.48]], [.25,.23,.19,.055],clay.bark,6);
    tube(body,[[.05,base+.09,z+.12],[.12,base+h*.49,z-.04],[.05,base+h*.91,z-.35]], [.07,.055,.025],clay.cut,4);
    frame(body,[.04,base+.02,z],[.2,0,0]);plate(body,.61,.79,.14,clay.cut,i);
    if(i===2||i===4){frame(body);tube(body,[[.07,base+h*.4,z-.15],[.37,base+h*.72,z-.28],[.42,base+h*.93,z-.39]], [.13,.095,.025],clay.cut,5);}
  }
  mesh('boar-armoured-body',body,torso);

  const head=new THREE.Group();head.name='boar-head-pivot';head.position.set(0,2.32,1.2);torso.add(head);
  const face=builder();
  // Broad low brow -> distinct tapered muzzle -> leathery flattened nose.
  loft(face,[[-.48,.05,1.08,.94],[-.2,.07,1.25,1.01],[.05,.01,1.3,1.02],[.32,-.06,1.26,.99],
    [.57,-.17,1.12,.89],[.88,-.31,.92,.78],[1.14,-.46,.8,.66],[1.5,-.61,.66,.53],
    [1.9,-.69,.58,.43],[2.22,-.7,.61,.41]],clay.flank,18,true);
  frame(face);
  loft(face,[[2.16,-.7,.62,.42],[2.29,-.7,.66,.44],[2.38,-.71,.64,.41],[2.43,-.71,.58,.36]],0x8e6349,18,true);
  // Nostrils are recessed dark facets on the front of the snout.
  for(const side of [-1,1]){
    frame(face,[side*.27,-.69,2.438],[0,0,side*-.15]);
    loft(face,[[-.015,0,.155,.195],[.005,0,.13,.17]],clay.socket,10,true);
    frame(face,[side*.76,-.07,.6]);
    loft(face,[[-.15,0,.3,.4],[.08,0,.46,.48],[.34,-.04,.45,.46],[.59,-.12,.32,.33]],clay.flank,14,true);
    frame(face,[side*.89,.45,.27],[.2,side*.2,-side*.55]);
    plate(face,.8,1.36,.3,clay.bark,1);
    // Ragged pointed ears sit back on the skull, beneath its crest.
    frame(face);
    tube(face,[[side*.94,.65,-.14],[side*1.15,.94,-.2],[side*1.31,1.1,-.29],[side*1.38,1.42,-.44]], [.33,.27,.21,.025],clay.hide,7);
    tube(face,[[side*1.12,.82,-.06],[side*1.3,1.11,-.19],[side*1.36,1.31,-.33]], [.12,.09,.01],0x947457,5);
    // Two substantial swept tusks flare out then curl back above the nose.
    curvedTube(face,[[side*.71,-.63,1.1],[side*1.22,-.78,1.42],[side*1.7,-.56,1.71],
      [side*1.95,-.16,1.81],[side*2.03,.36,1.82],[side*1.99,.76,1.76]],
      [.32,.34,.3,.23,.14,.006],clay.ivory,12,18);
    // Dark, deeply inset eye socket and a brow that slopes down at the snout.
    frame(face,[side*.92,.055,1.152],[0,side*.5,side*.22]);
    loft(face,[[-.025,0,.275,.14],[.025,0,.25,.116]],clay.socket,10,true);
    frame(face);
    tube(face,[[side*.64,.16,1.22],[side*.93,.28,1.15],[side*1.16,.39,.98]], [.17,.19,.13],clay.bark,7);
    frame(face,[side*.93,.44,.8],[.2,side*.13,-side*.4]);
    plate(face,.68,.88,.16,clay.bark,2);
  }
  // Forehead's shield and a split wooden crest connect head and dorsal armour.
  frame(face,[0,.82,-.03],[.22,0,0]);plate(face,1.48,1.2,.22,clay.plate,1);
  for(const side of [-1,1]){
    frame(face,[side*.38,.72,.49],[.3,side*.12,-side*.13]);plate(face,.94,1.14,.2,clay.plate,2);
    frame(face,[side*.27,.53,.99],[.44,side*.1,-side*.14]);plate(face,.7,.95,.17,clay.bark,3);
  }
  frame(face);tube(face,[[0,.88,-.04],[.03,1.44,-.27],[.12,1.69,-.5]],[.3,.22,.035],clay.bark,5);
  // Muzzle folds: thin raised rings, coloured like skin rather than black bands.
  for(let i=0;i<3;i++){
    frame(face);
    curvedTube(face,[[-.52+i*.02,-.21-i*.09,1.36+i*.26],[-.3,-i*.11,1.35+i*.26],
      [0,.06-i*.13,1.35+i*.26],[.3,-i*.11,1.35+i*.26],[.52-i*.02,-.21-i*.09,1.36+i*.26]],
      [.025,.03,.033,.03,.025],0x9b7757,6,8);
  }
  mesh('boar-head-tusks',face,head);
  const eyes=builder();
  for(const side of [-1,1]){
    frame(eyes,[side*.934,.064,1.187],[0,side*.5,side*.22]);
    loft(eyes,[[0,0,.207,.094],[.012,0,.186,.078]],0xcc7730,10,true);
    loft(eyes,[[.013,0,.156,.075],[.023,0,.136,.062]],clay.amber,10,true);
    loft(eyes,[[.024,0,.025,.064],[.027,0,.019,.055]],clay.socket,7);
  }
  mesh('boar-amber-eyes',eyes,head,eyeMaterial);

  const legs=[];
  for(let i=0;i<4;i++){
    const front=i<2,side=i%2===0?-1:1,hip=new THREE.Group();
    hip.name='boar-leg-'+i;hip.position.set(side*(front?1.33:1.14),1.9,front?1.01:-1.8);root.add(hip);
    const leg=builder();
    frame(leg,[0,0,0],[Math.PI/2,0,0]);
    loft(leg,[[0,0,.57,.55],[.28,.025,.54,.5],[.55,.01,.44,.43],[.84,-.02,.38,.36],
      [1.03,-.03,.34,.32],[1.3,-.12,.33,.33],[1.6,-.18,.34,.35]],clay.hide,14,true);
    frame(leg,[0,-1.3,.17],[0,0,0]);plate(leg,.91,.99,.2,clay.plate,i);
    frame(leg,[0,-1.12,.46],[Math.PI/2,0,.1]);plate(leg,.75,.55,.105,clay.plate,i+2);
    frame(leg,[(i%2?1:-1)*.37,-1.09,.15],[0,0,(i%2?-1:1)*Math.PI/2]);plate(leg,.59,.6,.09,clay.plate,i+1);
    frame(leg,[0,-.68,.41],[Math.PI/2,0,-.17]);plate(leg,.57,.72,.075,clay.bark,i);
    // Split hooves, wide toes and a short fetlock read as a weight-bearing boar.
    for(const toe of [-1,1]){
      frame(leg,[toe*.2,-1.71,.16]);
      loft(leg,[[-.29,0,.2,.17],[-.12,.015,.22,.2],[.18,0,.225,.19],[.39,-.015,.21,.17],[.48,-.02,.17,.14]],clay.hoof,10);
      frame(leg,[toe*.2,-1.52,.26],[.08,0,0]);plate(leg,.38,.49,.026,0x68685b,i);
    }
    mesh('boar-leg-mesh-'+i,leg,hip);legs.push(hip);
  }
  const tail=builder();frame(tail);
  tube(tail,[[0,2.46,-2.42],[.17,2.48,-2.8],[.24,2.78,-3],[.09,2.92,-2.84],[-.04,2.77,-2.74]], [.1,.085,.075,.06,.027],clay.hide,6);
  const tailMesh=mesh('boar-curled-tail',tail,torso);
  // All mesh data is immutable after startup, including the emissive-looking eyes.
  const stats=Object.freeze({draws:8,triangles,geometries:8,materials:2});
  let disposed=false;

  function update(boss,time,visible=true){
    root.visible=!disposed&&!!boss&&boss.hp>0&&visible;
    if(!root.visible)return;
    const t=Number.isFinite(time)?time:0,phase=boss.phase;
    const warn=phase==='warn',charge=phase==='charge',recover=phase==='recover';
    const progress=warn?Math.max(0,Math.min(1,1-(boss.timer??1.5)/1.5)):0;
    const breath=Math.sin(t*1.7)*.028;
    root.position.set(boss.x,.025,boss.z);root.rotation.y=boss.yaw||0;
    torso.position.y=charge?Math.sin(t*20)*.11:recover?-.09+Math.sin(t*5)*.025:breath;
    torso.rotation.set(charge?.025:warn?.045*progress:0,0,recover?Math.sin(t*5.5)*.045:0);
    torso.scale.y=1+(!charge?Math.sin(t*1.7)*.004:0);
    // Positive X rotation lowers the forward (+Z) muzzle into the charge lane.
    head.rotation.x=warn?.12+progress*.23:charge?.33:recover?-.12+Math.sin(t*5)*.035:Math.sin(t*1.7)*.018;
    head.rotation.y=recover?Math.sin(t*3.8)*.045:0;
    for(let i=0;i<4;i++){
      const leg=legs[i],opposite=(i===0||i===3)?0:Math.PI;
      const gait=charge?Math.sin(t*20+opposite):0;
      leg.rotation.x=charge?gait*.58:warn&&i===1?-.18-Math.max(0,Math.sin(t*9))*.27:recover?Math.sin(t*5+i)*.025:0;
      leg.position.y=1.9+(charge?Math.max(0,gait)*.13:warn&&i===1?Math.max(0,Math.sin(t*9))*.15:0);
    }
    tailMesh.rotation.z=Math.sin(t*(charge?8:2.3))*.025;
  }
  function dispose(){
    if(disposed)return;disposed=true;root.visible=false;scene.remove(root);
    for(const resource of owned){resource.dispose();resources.delete(resource);}owned.clear();
  }
  return {update,dispose,stats,root};
}
