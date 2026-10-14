import {VILLAGE_GROVE,VILLAGE_SITES} from './content.mjs';

// Painted soil, grass strokes and static dapple are baked once. No shadow map,
// extra light or per-frame texture update is needed for the woodland floor.
export function createWoodlandGround(THREE,scene,resources){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d'),sx=1024/136,sz=1024/256;
  const px=x=>(x+68)*sx,pz=z=>(z+172)*sz;
  let seed=94623;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  ctx.fillStyle='#79894b';ctx.fillRect(0,0,1024,1024);
  for(let i=0;i<12500;i++){
    const x=random()*1024,y=random()*1024,w=2+random()*14,h=1+random()*6;
    ctx.globalAlpha=.12+random()*.2;ctx.fillStyle=['#354e30','#567239','#a1ab60','#b4af6b','#819645'][i%5];
    ctx.beginPath();ctx.ellipse(x,y,w,h,random()*3,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  const center=z=>z< -12?Math.sin((z+10)*.092)*3.3:Math.sin((z+8)*.1)*.24;
  const half=z=>z< -12?5.4:z<0?4.2+1.2*(-z/12):4.3;
  function trail(extra,color){
    ctx.beginPath();
    for(let i=0;i<=124;i++){const z=30-i,c=center(z),r=half(z)+extra+Math.sin(z*1.7)*.18;const x=px(c-r),y=pz(z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    for(let i=124;i>=0;i--){const z=30-i;ctx.lineTo(px(center(z)+half(z)+extra+Math.sin(z*1.3)*.18),pz(z));}
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  trail(.5,'#919052');trail(.17,'#b0a365');trail(-.12,'#c8b77b');
  for(let i=0;i<5200;i++){
    const z=-94+random()*124,x=center(z)+(random()-.5)*(half(z)*2-.5);
    ctx.globalAlpha=.12+random()*.24;ctx.fillStyle=['#f1d9a3','#9e8b51','#ddc38a','#6d753b'][i%4];
    ctx.beginPath();ctx.ellipse(px(x),pz(z),.1*sx+random()*3,.08*sz+random()*1.4,random()*2,0,Math.PI*2);ctx.fill();
  }
  // Low, broken dark patches anchor plots without creating stone rings.
  for(const site of Object.values(VILLAGE_SITES)){
    const gradient=ctx.createRadialGradient(px(site.x),pz(site.z),site.r*.3*sz,px(site.x),pz(site.z),site.r*1.18*sx);
    gradient.addColorStop(0,'rgba(49,65,29,.4)');gradient.addColorStop(1,'rgba(49,65,29,0)');
    ctx.globalAlpha=.65;ctx.fillStyle=gradient;ctx.fillRect(px(site.x-site.r*1.2),pz(site.z-site.r*1.3),site.r*2.4*sx,site.r*2.6*sz);
  }
  function shadow(x,z,h){
    if(Math.abs(x)>63||z< -162||z>72)return;
    let local=(Math.imul(Math.round(x*71),32893)^Math.imul(Math.round(z*53),19391))>>>0;
    const rnd=()=>((local=(Math.imul(local,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<46;i++){
      const a=rnd()*6.28,r=Math.sqrt(rnd())*h*.29;
      ctx.globalAlpha=.11+rnd()*.11;ctx.fillStyle='#233f24';ctx.beginPath();
      ctx.ellipse(px(x+h*.3+Math.cos(a)*r),pz(z-h*.2+Math.sin(a)*r),(.2+rnd()*.65)*sx,(.13+rnd()*.4)*sz,a,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  for(const t of VILLAGE_GROVE)shadow(t.x,t.z,t.h);
  ctx.globalAlpha=1;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;resources.add(texture);
  const material=new THREE.MeshLambertMaterial({map:texture,color:0xe4e4c9});resources.add(material);
  const geometry=new THREE.PlaneGeometry(136,256);resources.add(geometry);
  const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(0,-.071,-44);mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.name='woodland-painted-ground';scene.add(mesh);
  return {shadow,finish(){texture.needsUpdate=true;},stats:{textures:1,textureBytes:4194304,triangles:2,draws:1,dynamicUpdates:0}};
}

// Small, vertex-painted distant landforms. They fill the horizon through gaps
// in the trees and stay beyond every movement/camera boundary.
export function createWoodlandBackdrop(THREE,scene,resources){
  const positions=[],colors=[],c=new THREE.Color();
  function tri(a,b,d,tint){c.setHex(tint);for(const p of [a,b,d]){positions.push(...p);colors.push(c.r,c.g,c.b);}}
  for(let layer=0;layer<3;layer++){
    // Even the closest ring stays outside the boss boundary plus 12.5m zoom.
    const radius=178-layer*25,n=96;
    // Near foothills stay lower than the pale high mountains behind them.
    const height=a=>[16,9,3][layer]+[26,16,10][layer]*Math.abs(Math.sin(a*3.7+layer))+[18,11,6][layer]*Math.abs(Math.sin(a*7.1+2));
    for(let i=0;i<n;i++){
      const a=i*6.283/n,b=(i+1)*6.283/n,h=height(a),h2=height(b);
      const p=[Math.cos(a)*radius,h,Math.sin(a)*radius-35],q=[Math.cos(b)*radius,h2,Math.sin(b)*radius-35];
      const low=[p[0],-6,p[2]],low2=[q[0],-6,q[2]],palette=[0xa3b7b6,0x819f94,0x658669];
      tri(low,q,p,palette[layer]);tri(low,low2,q,palette[layer]);
      if(layer===0&&h>29){tri(p,[p[0]*.98,h-5,p[2]],[q[0],Math.max(h2-4,17),q[2]],0xc8d1c6);}
    }
  }
  // Scalloped cumulus silhouettes use opaque triangles and a quiet cream tone.
  for(let j=0;j<6;j++){
    const a=j*1.08+.35,r=147,cx=Math.cos(a)*r,cz=Math.sin(a)*r-35,cy=52+(j%3)*7;
    const tx=-Math.sin(a),tz=Math.cos(a);
    for(let k=0;k<4;k++){
      const offset=(k-1.5)*6,rx=7+(k%2)*3,ry=3.4+(k%3)*1.8;
      const center=[cx+tx*offset,cy,cz+tz*offset];
      for(let s=0;s<14;s++){
        const p=s*Math.PI*2/14,q=(s+1)*Math.PI*2/14;
        tri(center,[center[0]+tx*Math.cos(p)*rx,cy+Math.sin(p)*ry,center[2]+tz*Math.cos(p)*rx],[center[0]+tx*Math.cos(q)*rx,cy+Math.sin(q)*ry,center[2]+tz*Math.cos(q)*rx],0xd7e0d4);
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();resources.add(g);
  const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false});resources.add(mat);
  const mesh=new THREE.Mesh(g,mat);mesh.name='woodland-distant-hills-clouds';mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);
  return {triangles:positions.length/9,draws:1,perFrameUpdates:0};
}
