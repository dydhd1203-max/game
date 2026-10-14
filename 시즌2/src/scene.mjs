import * as THREE from '../vendor/three.module.js';
import {createSeason1Avatars} from './avatar-season1.mjs';
import {createSeason1Camera,SEASON1_CAMERA} from './camera-season1.mjs';
import {season1Graphics} from './graphics-season1.mjs';
import {createSeason1MotionFeedback} from './motion-feedback-season1.mjs';
import {buildVillageA} from './village-a.mjs';
import {createBoarBoss} from './boar-boss.mjs';
import {TEAM_COLORS, VILLAGE_SITES, VILLAGE_GROVE, FOREST_OBSTACLES, BEACON, GATE} from './content.mjs';

// Season 1 (106): bpush/bbuild's shared geometry, per-instance tint and spatial
// buckets. The exact Season 1 avatar module owns its original drawSheep model. This isolated
// renderer deliberately does not import the first season's world or save state.
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  // Same classroom drawing scale as Season 1's default mid preset.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, .85));
  const gl=renderer.getContext(),aaSamples=gl.getParameter(gl.SAMPLES);
  const graphics=season1Graphics(THREE);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = graphics.toneMapping;
  renderer.toneMappingExposure = graphics.exposure;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(graphics.villageSky);
  scene.fog = new THREE.Fog(graphics.villageSky, 42, 112);
  const camera = new THREE.PerspectiveCamera(SEASON1_CAMERA.fov,1,SEASON1_CAMERA.near,SEASON1_CAMERA.far);
  const structureHeights={workshop:9,wagon:7.5,assembly:4,market:4.5,smithYard:3.4,supplyYard:3.5};
  // Like Season 1, only solid structures shorten the boom; thin scenery does
  // not pull the camera into the avatar. Finite heights allow looking over props.
  const cameraObstacles=Object.entries(VILLAGE_SITES).map(([id,site])=>({...site,top:structureHeights[id]}));
  const cameraRig=createSeason1Camera(THREE,camera,{obstacles:cameraObstacles,groundY:.08});
  const motionFeedback=createSeason1MotionFeedback({punch:amount=>cameraRig.punch(amount)});
  const hemi = new THREE.HemisphereLight(graphics.hemiSky,graphics.hemiGround,graphics.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(graphics.sunColor,graphics.sunIntensity);
  sun.position.set(-28, 48, 16); scene.add(sun);
  const resources = new Set(), sprites = new Map();
  const geo = {
    ball:new THREE.SphereGeometry(.5, 12, 8),
    tiny:new THREE.SphereGeometry(.5, 8, 6),
    cylinder:new THREE.CylinderGeometry(.5,.5,1,12),
    cone:new THREE.ConeGeometry(.5,1,12),
    box:new THREE.BoxGeometry(1,1,1),
    crystal:new THREE.OctahedronGeometry(.5),
    ring:new THREE.TorusGeometry(.5,.035,5,40),
    capsule:new THREE.CapsuleGeometry(.38,.36,4,10),
    roof:new THREE.LatheGeometry([
      new THREE.Vector2(0,1.25),new THREE.Vector2(.15,1.23),
      new THREE.Vector2(.38,1.05),new THREE.Vector2(.62,.8),
      new THREE.Vector2(.78,.52),new THREE.Vector2(.91,.27),
      new THREE.Vector2(1.04,.13),new THREE.Vector2(1.07,.04),
      new THREE.Vector2(.97,0)
    ].reverse(),24)
  };
  Object.values(geo).forEach(g=>resources.add(g));
  const material = new THREE.MeshLambertMaterial({color:0xffffff}); resources.add(material);
  const glow = new THREE.MeshBasicMaterial({color:0xffffff}); resources.add(glow);
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4();
  const e = new THREE.Euler(), color = new THREE.Color();
  const banks = new Map(), dynamic = new Map();
  const palette={grass:0x89ad78,path:0xd7c698,wood:0x805f45,bark:0x6c6550,cream:0xf9e9c5,stone:0x84958a,leaf:0x609877};
  let width=0,height=0,elapsed=0,lastPhase='', lastEvent='';
  const effectPool=[];
  function matrix(x,y,z,sx,sy,sz,ry=0,rx=0,rz=0){
    v.set(x,y,z); s.set(sx,sy,sz); e.set(rx,ry,rz,'YXZ'); q.setFromEuler(e); m.compose(v,q,s); return m;
  }
  // Chunked static instances need no matrix uploads after construction.
  function part(shape,x,y,z,sx,sy,sz,tint,ry=0,rx=0,rz=0,lit=true){
    const key=`${shape}:${Math.floor(x/32)}:${Math.floor(z/32)}:${lit?1:0}`;
    let b=banks.get(key); if(!b){b={shape,lit,items:[]};banks.set(key,b);}
    b.items.push({matrix:matrix(x,y,z,sx,sy,sz,ry,rx,rz).clone(),tint});
  }
  function buildBanks(){
    for(const b of banks.values()){
      const mesh=new THREE.InstancedMesh(geo[b.shape],b.lit?material:glow,b.items.length);
      b.items.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);mesh.setColorAt(i,color.setHex(p.tint));});
      mesh.computeBoundingSphere(); scene.add(mesh); resources.add(mesh); b.items.length=0;
    }
    banks.clear();
  }
  function bank(shape,lit=true){
    const key=shape+lit; if(dynamic.has(key))return dynamic.get(key);
    const mesh=new THREE.InstancedMesh(geo[shape],lit?material:glow,4096);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
    mesh.count=0;scene.add(mesh);resources.add(mesh);dynamic.set(key,mesh);return mesh;
  }
  function dyn(shape,x,y,z,sx,sy,sz,tint,ry=0,rx=0,rz=0,lit=true){
    const b=bank(shape,lit); if(b.count>=4096)return;
    b.setMatrixAt(b.count,matrix(x,y,z,sx,sy,sz,ry,rx,rz));
    b.setColorAt(b.count,color.setHex(tint));b.count++;
  }
  function localPart(fn,shape,x,z,yaw,dx,y,dz,sx,sy,sz,tint,ry=0,rx=0,rz=0,lit=true){
    const co=Math.cos(yaw),si=Math.sin(yaw);
    fn(shape,x+dx*co+dz*si,y,z-dx*si+dz*co,sx,sy,sz,tint,yaw+ry,rx,rz,lit);
  }
  function line(fn,ax,ay,az,bx,by,bz,r,tint){
    v.set(bx-ax,by-ay,bz-az);const len=v.length();
    const ry=Math.atan2(v.x,v.z),rx=Math.acos(Math.max(-1,Math.min(1,v.y/len)));
    fn('cylinder',(ax+bx)/2,(ay+by)/2,(az+bz)/2,r,len,r,tint,ry,rx);
  }
  let seed=8173;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function texCanvas(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;resources.add(t);return t;}
  const groundTexture=texCanvas(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#b6c095';ctx.fillRect(0,0,w,h);
    for(let i=0;i<3700;i++){ctx.globalAlpha=.05+rand()*.1;ctx.fillStyle=i%2?'#68784f':'#ffedb2';const a=1+rand()*3;ctx.fillRect(rand()*w,rand()*h,a,a);}
    ctx.globalAlpha=1;
  });
  groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(24,40);
  const groundMat=new THREE.MeshLambertMaterial({color:0x93b180,map:groundTexture});resources.add(groundMat);
  const groundGeo=new THREE.PlaneGeometry(340,340);resources.add(groundGeo);
  const ground=new THREE.Mesh(groundGeo,groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.08,-50);scene.add(ground);
  // A continuous, readable winding trail, with broad spaces around combat zones.
  const pathMat=new THREE.MeshLambertMaterial({color:palette.path});resources.add(pathMat);
  function ribbon(start,end,halfWidth,curve){
    const positions=[],uv=[],indices=[],n=Math.ceil(Math.abs(end-start)/2);
    for(let i=0;i<=n;i++){const z=start+(end-start)*i/n,x=curve(z),w=typeof halfWidth==='function'?halfWidth(z):halfWidth;positions.push(x-w,.012,z,x+w,.012,z);uv.push(0,i/n,1,i/n);if(i<n){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();resources.add(g);
    const mesh=new THREE.Mesh(g,pathMat);scene.add(mesh);
  }
  ribbon(35,-94,z=>z < -12?5.4:z < 0?3.3+2.1*(-z/12):Math.min(5.4,3.3+z*.14),z=>z< -12?Math.sin((z+10)*.092)*3.3:0);
  const villageArt=buildVillageA(THREE,scene,resources);
  part('cylinder',0,-.02,-115,59,.15,42,0xaab38d);
  part('cylinder',0,.005,-115,49,.08,35,0xc2bfa1);
  part('ring',0,.04,-115,45,34,1,0xded0a8,0,-Math.PI/2);

  function sign(text,x,y,z,scale=1,yaw=0,post=true){
    const texture=texCanvas(512,128,(ctx,w,h)=>{
      ctx.fillStyle='#423e35';ctx.beginPath();ctx.roundRect(4,4,w-8,h-8,22);ctx.fill();
      ctx.strokeStyle='#dabd84';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#fff3ce';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2);
    });
    const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide});resources.add(mat);
    const g=new THREE.PlaneGeometry(5.2*scale,1.3*scale);resources.add(g);
    const mesh=new THREE.Mesh(g,mat);mesh.position.set(x,y,z);mesh.rotation.y=yaw;scene.add(mesh);
    if(post)part('cylinder',x,y/2,z,.2,y,.2,palette.wood);
  }
  // Preserve the forest layout: the old plaza consumed 57 random values.
  for(let i=0;i<57;i++)rand();
  const groveCanopies=[];
  function tree(x,z,h,tint,canopy=null){
    function leaf(x,y,z,sx,sy,sz){
      if(canopy)canopy.leaves.push({x,y,z,r:Math.max(sx,sy,sz)*.5,matrix:matrix(x,y,z,sx,sy,sz).clone(),tint});
      else part('ball',x,y,z,sx,sy,sz,tint);
    }
    const ry=rand()*.4,rz=(rand()-.5)*.13;
    if(canopy){
      canopy.trunk=matrix(x,h*.33,z,h*.12,h*.68,h*.12,ry,0,rz).clone();
      canopy.stump=matrix(x,.18,z,h*.12,.36,h*.12,ry).clone();
    }else part('cylinder',x,h*.33,z,h*.12,h*.68,h*.12,palette.bark,ry,0,rz);
    for(let j=0;j<3;j++){
      const a=j*2.1+rand(),dx=Math.cos(a)*h*.14,dz=Math.sin(a)*h*.14;
      leaf(x+dx,h*(.61+j*.12),z+dz,h*.63,h*.53,h*.57);
    }
    leaf(x,h*.98,z,h*.5,h*.44,h*.48);
    part('ball',x,.13,z,h*.36,.35,h*.32,0x799570);
  }
  // Clear inner margins preserve the third-person camera and combat silhouettes.
  for(let z=-143;z<39;z+=7.5)for(const side of [-1,1]){
    const forest=z<-13&&z>-89;
    const x=side*((forest?23:35)+rand()*5);tree(x,z+rand()*4,6+rand()*4,[0x5b9178,0x77a47b,0x4e8770][Math.floor(rand()*3)]);
    if(z< -8)tree(x+side*(7+rand()*7),z+rand()*5,9+rand()*5,0x578971);
  }
  // Reposition, rather than multiply, the original eight village trees. The
  // unchanged number/order of tree() calls preserves the later forest RNG.
  for(const t of VILLAGE_GROVE){
    const canopy={leaves:[],hidden:false};groveCanopies.push(canopy);
    tree(t.x,t.z,t.h,t.x<0?0x789a70:0x86a274,canopy);
    // Opaque low undergrowth joins the grove to the village's planted edges.
    // It uses existing static batches and does not consume the forest RNG.
    for(let k=0;k<3;k++){
      const a=k*2.4,dx=Math.cos(a)*1.15,dz=Math.sin(a)*1.15;
      part('ball',t.x+dx,.44,t.z+dz,2.0,1.1,1.9,k%2?0x75935e:0x8d9f68);
    }
  }
  // Two shared grove draws. Only visibility transitions upload their matrices;
  // undergrowth and the original forest stay in static batches.
  const groveLeaves=new THREE.InstancedMesh(geo.ball,material,VILLAGE_GROVE.length*4);
  const groveTrunks=new THREE.InstancedMesh(geo.cylinder,material,VILLAGE_GROVE.length);
  groveLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  groveTrunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  let leafIndex=0;
  for(const [i,canopy] of groveCanopies.entries()){
    canopy.index=i;groveTrunks.setMatrixAt(i,canopy.trunk);groveTrunks.setColorAt(i,color.setHex(palette.bark));
    for(const leaf of canopy.leaves){
    leaf.index=leafIndex++;groveLeaves.setMatrixAt(leaf.index,leaf.matrix);groveLeaves.setColorAt(leaf.index,color.setHex(leaf.tint));
    }
  }
  groveLeaves.computeBoundingSphere();scene.add(groveLeaves);resources.add(groveLeaves);
  groveTrunks.computeBoundingSphere();scene.add(groveTrunks);resources.add(groveTrunks);
  const hiddenLeafMatrix=new THREE.Matrix4().makeScale(0,0,0);
  function updateGroveVisibility(me){
    const x=me?.x??0,y=(me?.y??.08)+1.1,z=me?.z??16;
    const dx=camera.position.x-x,dy=camera.position.y-y,dz=camera.position.z-z;
    const lengthSq=dx*dx+dy*dy+dz*dz;
    let dirty=false;
    for(const canopy of groveCanopies){
      let hidden=false;
      for(const leaf of canopy.leaves){
        const t=Math.max(0,Math.min(1,((leaf.x-x)*dx+(leaf.y-y)*dy+(leaf.z-z)*dz)/(lengthSq||1)));
        const ex=x+t*dx-leaf.x,ey=y+t*dy-leaf.y,ez=z+t*dz-leaf.z;
        // Pad the sightline for the avatar's body; hysteresis avoids flicker.
        const r=leaf.r+(canopy.hidden ? .9 : .65);
        if(ex*ex+ey*ey+ez*ez<r*r){hidden=true;break;}
      }
      if(hidden===canopy.hidden)continue;
      canopy.hidden=hidden;dirty=true;
      for(const leaf of canopy.leaves)groveLeaves.setMatrixAt(leaf.index,hidden?hiddenLeafMatrix:leaf.matrix);
      // Keep a visible stump at the unchanged solid footprint. A full trunk
      // would still conceal the avatar when standing directly behind the tree.
      groveTrunks.setMatrixAt(canopy.index,hidden?canopy.stump:canopy.trunk);
    }
    if(dirty){groveLeaves.instanceMatrix.needsUpdate=true;groveTrunks.instanceMatrix.needsUpdate=true;}
  }
  for(let x=-31;x<34;x+=7)tree(x,-145,8+rand()*5,0x527d68);
  for(const o of FOREST_OBSTACLES){
    part('ball',o.x,1.28,o.z,o.r*2,3.7,o.r*1.9,0x889b92,rand());
    part('ball',o.x-.45,2.54,o.z+.4,o.r*1.45,1.45,o.r*1.3,0xa0ada1,rand());
    part('ball',o.x+.1,3.16,o.z+.2,o.r*1.3,.54,o.r*1.1,0x759574);
    for(let j=0;j<4;j++)part('tiny',o.x+(rand()-.5)*o.r,3.45,o.z+(rand()-.5)*o.r,.4,.2,.4,0xd8c687);
  }
  for(let i=0;i<340;i++){
    const z=-137+rand()*170,forest=z<-18&&z>-90;
    const edge=forest?18:30,x=(rand()<.5?-1:1)*(edge+rand()*9);
    const c=[0x88a578,0x709572,0x95ad7d][i%3];
    part('ball',x,.25,z,.8+rand(),.55+rand()*.4,.7+rand(),c);
    if(i%5===0){part('cylinder',x,.32,z,.09,.6,.09,0x537953);part('tiny',x,.66,z,.3,.28,.3,i%2?0xf0cc86:0xebadad);}
  }
  // Low edge markers show the actual playable bounds instead of invisible walls.
  for(let z=-136;z<=34;z+=4){const edge=z< -18&&z> -90?19:31;for(const side of [-1,1]){
    part('ball',side*(edge+.45),.33,z,1.3,.8,1.6,0x82957f);
    if(z%12===0)part('cylinder',side*(edge+.45),.75,z,.22,1.5,.22,0x7b7355);
  }}
  for(let x=-29;x<=29;x+=3){part('ball',x,.34,35.5,2.6,.9,1.5,0x9ba48a);part('ball',x,.34,-137.5,2.6,.9,1.5,0x85988b);}
  // Ancient stone entrance and beacon, visually separate from protected objects.
  for(const side of [-1,1]){
    part('cylinder',side*8,2.8,GATE.z,2.3,5.6,2.3,0x99a896);
    part('ball',side*8,5.75,GATE.z,3.3,1.2,3,0xc0c4a4);
    part('ring',side*8,3.5,GATE.z+.02,1.2,1.2,1.2,0xcce4bd);
  }
  sign('가시등 멧돼지',0,6.4,GATE.z,1.2,0,false);
  part('cylinder',0,6.3,GATE.z,.45,16,.45,0x839581,0,0,Math.PI/2);
  part('cylinder',BEACON.x,.16,BEACON.z,4.4,.32,4.4,0x9ba89c);
  part('cylinder',BEACON.x,.6,BEACON.z,2.1,.9,2.1,0xc0c5ad);
  part('cylinder',BEACON.x,1.65,BEACON.z,1.15,1.4,1.15,0x839c92);
  part('ring',BEACON.x,2.5,BEACON.z,2,2,2,0xe0ce8d,0,-Math.PI/2);
  sign('봉화를 켜고 전진',5,3,BEACON.z+3,.75);
  buildBanks();

  const shadowTexture=texCanvas(64,64,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);g.addColorStop(0,'rgba(33,49,38,.3)');g.addColorStop(.55,'rgba(33,49,38,.14)');g.addColorStop(1,'rgba(33,49,38,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});
  const shadowMat=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});resources.add(shadowMat);
  const shadowGeo=new THREE.PlaneGeometry(1,1);resources.add(shadowGeo);
  const shadows=new THREE.InstancedMesh(shadowGeo,shadowMat,192);shadows.frustumCulled=false;shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(shadows);resources.add(shadows);
  function shadow(x,z,size){if(shadows.count<192)shadows.setMatrixAt(shadows.count++,matrix(x,.075,z,size,size,1,0,-Math.PI/2));}
  const warnMat=new THREE.MeshBasicMaterial({color:0xff704a,transparent:true,opacity:.36,depthWrite:false,side:THREE.DoubleSide});resources.add(warnMat);
  const warnGeo=new THREE.PlaneGeometry(1,1);resources.add(warnGeo);
  const warning=new THREE.Mesh(warnGeo,warnMat);warning.rotation.x=-Math.PI/2;scene.add(warning);warning.visible=false;
  const boar=createBoarBoss(THREE,scene,resources);
  const avatars=createSeason1Avatars(THREE,scene,{scale:.70,groundY:.08,groundAt:()=>.08,burst:motionFeedback.burst});
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere();
  function visible(x,z,r=3){sphere.center.set(x,1.4,z);sphere.radius=r;return frustum.intersectsSphere(sphere);}
  function nameSprite(p){
    let item=sprites.get(p.id);
    if(item?.name===p.name)return item.sprite;
    if(item){scene.remove(item.sprite);item.texture.dispose();item.sprite.material.dispose();resources.delete(item.texture);resources.delete(item.sprite.material);sprites.delete(p.id);}
    if(sprites.size>=30)return null;
    const texture=texCanvas(256,64,(ctx,w,h)=>{ctx.fillStyle='rgba(35,59,48,.74)';ctx.beginPath();ctx.roundRect(10,4,w-20,h-8,23);ctx.fill();ctx.fillStyle='#fff3d3';ctx.font='bold 27px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.name||'원정대').slice(0,10),w/2,h/2);});
    const mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});resources.add(mat);
    const sprite=new THREE.Sprite(mat);sprite.scale.set(2.15,.54,1);scene.add(sprite);sprites.set(p.id,{sprite,name:p.name,texture});return sprite;
  }
  function playerLabel(p,hide=false){
    if(hide){const item=sprites.get(p.id);if(item)item.sprite.visible=false;return;}
    const label=nameSprite(p);
    if(label){
      label.visible=p.online!==false&&visible(p.x,p.z,3);label.position.set(p.x,(p.y??.08)+(p.hp>0?1.8:.78),p.z);
      // Near Season 1 camera: keep friends' labels below 26 screen pixels.
      const size=Math.min(.54,26*2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(label.position)/Math.max(1,height));
      label.scale.set(size*2.15/.54,size,1);
    }
  }
  function zombie(p,t){
    if(!visible(p.x,p.z,4))return;const large=p.kind==='brute',k=large?1.4:1,x=p.x,z=p.z,yaw=(p.yaw||0)+Math.PI;
    const gait=Math.sin(t*5+(Number(String(p.id).replace(/\D/g,''))||0)),tint=p.frost>0?0x9accd3:large?0x789475:0x8aaf87;
    const pp=(sh,dx,y,dz,sx,sy,sz,c,ry=0,rx=0,rz=0)=>localPart(dyn,sh,x,z,yaw,dx*k,y*k,dz*k,sx*k,sy*k,sz*k,c,ry,rx,rz);
    shadow(x,z,1.5*k);pp('capsule',0,1,0,1,1.2,.9,0x738178,0,-.15);
    pp('ball',0,1.9,-.17,1.04,.93,.91,tint);
    pp('ball',0,1.6,-.43,.79,.42,.49,tint);
    for(const side of [-1,1]){pp('capsule',side*.26,.37,side*gait*.15,.36,.51,.4,0x5b6b60);pp('capsule',side*.58,1.3,-.28,.31,.7,.31,tint,0,-.85);pp('ball',side*.2,1.99,-.594,.23,.15,.06,0xffdc83);pp('tiny',side*.2,1.98,-.63,.08,.12,.025,0x433e38);}
    pp('box',0,1.63,-.648,.42,.055,.03,0x4c5945);
    if(p.frost>0){pp('crystal',-.44,1.3,-.24,.35,.6,.4,0xc4edee);pp('crystal',.43,2.2,.02,.28,.53,.3,0xb4e9ef);}
  }
  function tower(t,time){
    if(t.state==='destroyed'||t.state==='inventory'||t.state==='carried')return;
    if(!visible(t.x,t.z,5))return;const x=t.x,z=t.z,ice=t.type==='ice',team=TEAM_COLORS[t.team]??TEAM_COLORS[0];
    const pack=t.state==='packing'||t.state==='placing';const lift=pack?Math.sin(time*7)*.07:0;
    shadow(x,z,3);
    dyn('cylinder',x,.2,z,2.2,.4,2.2,0x8b9b91);
    dyn('cylinder',x,.48,z,1.9,.25,1.9,0xc0c6ae);
    dyn('ring',x,.64,z,1.8,1.8,1.8,team,0,-Math.PI/2);
    if(ice){
      dyn('cylinder',x,1.1,z,1.13,1.02,1.13,0x7a9fa5);
      dyn('ring',x,1.67,z,1.7,1.7,1.7,0xb9d7d8,0,-Math.PI/2);
      dyn('crystal',x,2.22+lift+Math.sin(time*1.8)*.05,z,1.42,2.05,1.42,0xa7e6ef,time*.24);
      dyn('crystal',x-.04,2.24+lift,z-.12,.67,1.33,.67,0xe0ffff,-time*.24,0,0,false);
      for(let i=0;i<3;i++){const a=i*2.094+time*.45;dyn('tiny',x+Math.sin(a)*.9,2.2+Math.cos(a)*.2,z+Math.cos(a)*.9,.13,.13,.13,0xc5f6f5);}
    }else{
      for(const side of [-1,1]){dyn('cylinder',x+side*.58,1.28,z,.24,1.56,.24,0x967349);dyn('cylinder',x,1.28,z+side*.58,.24,1.56,.24,0x967349);}
      dyn('cylinder',x,1.93+lift,z,1.68,.24,1.68,0xac8758);
      dyn('cylinder',x,2.23+lift,z,.55,.45,.55,team);
      const yaw=t.yaw||0;
      localPart(dyn,'box',x,z,yaw,0,2.47+lift,-.15,.3,.28,1.6,0x76563c);
      for(const side of [-1,1])localPart(dyn,'capsule',x,z,yaw,side*.62,2.45+lift,-.45,.27,1.12,.27,0xbb9157,0,0,side*.18+Math.PI/2);
      localPart(dyn,'cylinder',x,z,yaw,0,2.47+lift,.05,.035,2.1,.035,0xf2dfb9,0,0,Math.PI/2);
      localPart(dyn,'cone',x,z,yaw,0,2.48+lift,-1.13,.23,.38,.23,0xb8cbd0,0,-Math.PI/2);
    }
    if(t.hp<t.maxHp){const ratio=Math.max(0,t.hp/t.maxHp);dyn('box',x,3.57,z,2,.12,.08,0x65736b);dyn('box',x-(1-ratio),3.59,z-.05,2*ratio,.13,.08,ratio>.4?0xa7d29d:0xeeac88);}
    if(pack)dyn('ring',x,.09,z,3.1,3.1,3.1,0xffe2a6,0,-Math.PI/2);
  }
  function updateEvents(events,dt){
    // IDs prevent replay when ten-Hz snapshots repeat the same event tail.
    let found=lastEvent==='',fresh=[];
    for(const event of events||[]){if(found)fresh.push(event);else if(event.id===lastEvent)found=true;}
    if(!found&&events?.length)fresh=events.slice(-8);
    for(const ev of fresh.slice(-18)){
      if(!Number.isFinite(ev.x)||!Number.isFinite(ev.z))continue;
      if(effectPool.length>=72)effectPool.shift();
      effectPool.push({kind:ev.kind,x:ev.x,z:ev.z,tx:ev.tx??ev.x,tz:ev.tz??ev.z,age:0,life:ev.kind==='shatter'?.46:.28});
    }
    if(events?.length)lastEvent=events.at(-1).id;
    for(let i=effectPool.length-1;i>=0;i--){const fx=effectPool[i];fx.age+=dt;if(fx.age>fx.life){effectPool.splice(i,1);continue;}const p=fx.age/fx.life;
      if(!visible(fx.x,fx.z,8))continue;
      if(fx.kind==='arrow'||fx.kind==='shoot'){
        const f=Math.min(1,p*2.5),x=fx.x+(fx.tx-fx.x)*f,z=fx.z+(fx.tz-fx.z)*f;
        const dx=fx.tx-fx.x,dz=fx.tz-fx.z,len=Math.hypot(dx,dz)||1;
        line(dyn,x-dx/len*.7,1.5,z-dz/len*.7,x,1.5,z,.07,0xffedba);
      }else if(fx.kind==='ice'){
        dyn('crystal',fx.x+(fx.tx-fx.x)*p,1.7,fx.z+(fx.tz-fx.z)*p,.4,.65,.4,0xbcf4f5,elapsed*6);
      }else if(fx.kind==='shatter'){
        for(let j=0;j<7;j++){const a=j*.897;dyn('crystal',fx.x+Math.sin(a)*p*2,1.1+Math.sin(p*Math.PI)*.8,fx.z+Math.cos(a)*p*2,.16*(1-p),.55*(1-p),.16*(1-p),0xd5ffff,a);}
      }else if(['hit','build','revive','beacon','pack'].includes(fx.kind)){
        dyn('ring',fx.x,.16+p*.55,fx.z,1+p*2,1+p*2,1+p*2,fx.kind==='hit'?0xf0c59d:0xbdecc7,0,-Math.PI/2);
      }
    }
  }
  const cameraView={},avatarRenderOptions={hideLocal:false};
  const emptyPlayer={x:0,y:.08,z:25,ground:true,mv:false};
  function render(state,localId,dt,options={}){
    dt=Math.min(.1,Math.max(0,dt||0));elapsed+=state?.paused?0:dt;
    const w=canvas.clientWidth||window.innerWidth||800,h=canvas.clientHeight||window.innerHeight||600;
    if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    const players=state?.players||{},me=players[localId]||Object.values(players)[0];
    const phase=state?.phase||'lobby';
    if(phase!==lastPhase){cameraRig.reset();motionFeedback.reset();}lastPhase=phase;
    cameraView.yaw=options.yaw;cameraView.pitch=options.pitch;cameraView.zoom=options.zoom;
    cameraView.aim=options.aim;cameraView.phase=phase;
    motionFeedback.update(me,dt,{phase,paused:state?.paused});
    const cameraState=cameraRig.update(me||emptyPlayer,dt,cameraView);
    camera.updateMatrixWorld();avatarRenderOptions.hideLocal=cameraState.bodyHidden;
    updateGroveVisibility(me);
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
    const village=phase==='lobby'||phase==='village'||phase==='victory';color.setHex(village?graphics.villageSky:graphics.forestSky);scene.background.lerp(color,1-Math.exp(-dt*3.7));scene.fog.color.copy(scene.background);
    for(const b of dynamic.values())b.count=0;shadows.count=0;
    for(const item of sprites.values())item.sprite.visible=false;
    let pc=0;for(const p of Object.values(players)){if(p.online===false)continue;if(++pc>30)break;playerLabel(p,p.id===localId);}
    for(const [id,item] of sprites){if(!players[id]||players[id].online===false){scene.remove(item.sprite);item.texture.dispose();item.sprite.material.dispose();resources.delete(item.texture);resources.delete(item.sprite.material);sprites.delete(id);}}
    avatars.setWeapon(village?0:3);avatars.render(players,localId,elapsed,dt,frustum,avatarRenderOptions);
    const towers=state?.towers||[];for(let i=0;i<Math.min(80,towers.length);i++)tower(towers[i],elapsed);
    for(const t of towers){if(t.state==='carried'){const carrier=players[t.carrier];if(carrier&&!(carrier.id===localId&&cameraState.bodyHidden)&&visible(carrier.x,carrier.z))localPart(dyn,'capsule',carrier.x,carrier.z,carrier.yaw||0,0,(carrier.y??.08)+.68,.34,.48,.5,.4,t.type==='ice'?0x9edbe4:0xc19b6b);}}
    const enemies=state?.enemies||[];for(let i=0;i<Math.min(100,enemies.length);i++)zombie(enemies[i],elapsed);
    const boss=state?.boss;
    const bossVisible=!!boss&&boss.hp>0&&visible(boss.x,boss.z,10);
    boar.update(boss,elapsed,bossVisible);
    if(bossVisible)shadow(boss.x,boss.z,7.1);
    const beaconOn=!!state?.beacon;
    if(visible(BEACON.x,BEACON.z,6)){dyn('crystal',BEACON.x,3.04+Math.sin(elapsed*1.6)*.08,BEACON.z,1.2,1.8,1.2,beaconOn?0xffe6a1:0x9ac6cb,elapsed*.3);
    if(beaconOn){dyn('ring',BEACON.x,3,BEACON.z,3,3,3,0xffe4a7,0,-Math.PI/2);dyn('tiny',BEACON.x,4.8,BEACON.z,.36,.36,.36,0xffecc6,0,0,0,false);}
    }
    const b=state?.boss;warning.visible=!!b&&(b.phase==='warn'||b.phase==='charge');
    if(warning.visible){const dx=b.dx??Math.sin(b.yaw||0),dz=b.dz??Math.cos(b.yaw||0),len=b.chargeLength||18;warning.position.set(b.x+dx*len/2,.09,b.z+dz*len/2);warning.rotation.set(-Math.PI/2,Math.atan2(-dx,-dz),0,'YXZ');warning.scale.set(b.chargeWidth||5.2,len,1);warnMat.opacity=b.phase==='charge'?.17:.24+Math.sin(elapsed*12)*.1;}
    updateEvents(state?.events||[],state?.paused?0:dt);
    motionFeedback.render(state?.paused?0:dt,dyn,visible);
    // Like Season 1's bounded dirty uploads, upload only the packed visible
    // instances, not every slot of the reusable maximum-capacity buffers.
    for(const mesh of dynamic.values())if(mesh.count){
      mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor){mesh.instanceColor.clearUpdateRanges();mesh.instanceColor.addUpdateRange(0,mesh.count*3);mesh.instanceColor.needsUpdate=true;}
    }
    if(shadows.count){shadows.instanceMatrix.clearUpdateRanges();shadows.instanceMatrix.addUpdateRange(0,shadows.count*16);shadows.instanceMatrix.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  function stats(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),aaSamples,graphics:{toneMapping:graphics.toneName,exposure:renderer.toneMappingExposure,antialias:gl.getContextAttributes().antialias,bloom:false,lights:2,hemiIntensity:hemi.intensity,sunIntensity:sun.intensity},motion:motionFeedback.stats(),camera:{...cameraRig.state(),fov:camera.fov,x:camera.position.x,y:camera.position.y,z:camera.position.z,pitch:camera.rotation.x,yaw:camera.rotation.y},art:{village:villageArt.stats,boar:boar.stats}};}
  function dispose(){avatars.dispose();boar.dispose();for(const resource of resources)resource.dispose?.();resources.clear();renderer.dispose();sprites.clear();effectPool.length=0;}
  return {render,stats,dispose,resetCamera:()=>cameraRig.reset()};
}
