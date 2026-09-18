/* Node-only actual-source zombie geometry and attack QA. No browser or UI. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import vm from 'node:vm';
import crypto from 'node:crypto';import {createRequire} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/54-zombie')),source=fs.readFileSync(file,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
// Shared source scanner is copied below when this harness is generated.
function scanEnd(start,stopAtBrace=false){
  let brace=0,paren=0,bracket=0,quote='',comment='',escaped=false,opened=false;
  for(let i=start;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}
    if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{'){brace++;opened=true;}else if(c==='}')brace--;
    else if(c==='(')paren++;else if(c===')')paren--;
    else if(c==='[')bracket++;else if(c===']')bracket--;
    if(stopAtBrace&&opened&&brace===0&&paren===0&&bracket===0)return i+1;
    if(!stopAtBrace&&c===';'&&brace===0&&paren===0&&bracket===0)return i+1;
  }
  throw new Error('Unterminated source at '+source.slice(start,start+80));
}
function declaration(name){
  const re=new RegExp('(?:const|let)\\s+'+name+'\\s*='),m=re.exec(source);
  if(!m)throw new Error('Missing declaration: '+name);
  return source.slice(m.index,scanEnd(m.index));
}
function fn(name){const start=source.indexOf('function '+name+'(');if(start<0)throw new Error('Missing function '+name);
  return source.slice(start,scanEnd(start,true));}
function chunk(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);if(start<0||end<0)throw new Error('Missing chunk '+a);return source.slice(start,end);}

const fixtures=`const GFX={q:'high',shadow:false},scene=new THREE.Scene(),MAXW=92,MAXP=40,GY=0,NIGHTK=.7,ENV_STEEL=null;
const G={day:1,nk:0,set:{goalDay:15}},topAt=()=>0,burst=()=>{},UPV=new THREE.Vector3(0,1,0);
const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),_c1=new THREE.Color();`;
const names=['W_body','W_head','W_chest','W_ruff','W_snout','W_tail','W_legs','W_paw','W_eyes','W_ears','W_hack','W_horn','W_nose','W_belly','W_brow','W_cheek','W_rib','W_tongue','W_plate','W_gem','W_eyeW','W_eyeR','W_pupil','W_fang','W_costume'];
const pieces=[fixtures,declaration('RB_SPEC'),declaration('flatMat'),fn('metalMat'),chunk('function roundBox(','const _rbCache'),
 chunk('const STUD =','const eyeMat ='),fn('imesh'),chunk('const eyeMat =','/* ═══════════════════════ 농장 동물'),
 declaration('auraMat'),declaration('W_aura'),chunk('let FLIP_ON =','const fxq ='),
 chunk('const WOLF_T =','function drawWolves('),fn('drawWolves'),declaration('HEAD_M'),fn('smoothHead'),fn('idleLife'),fn('limb1'),fn('limb2'),
 `globalThis.A={G,WOLF_T,LOOKS,ZOMBIE_STYLE,ZOMBIE_NIGHT,WOLF_DEAD,wolfPose,drawWolves,meshes:{${names.map(n=>n+':'+n).join(',')}}};`];
const context=vm.createContext({THREE,console});new vm.Script(pieces.join('\n')).runInContext(context,{timeout:10000});const A=context.A;
const results=[];const check=(n,p,d)=>{results.push({name:n,pass:!!p,detail:d});console.log((p?'OK   ':'FAIL ')+n+(d===undefined?'':' '+JSON.stringify(d)));};
const actor=(k=0,extra={})=>({k,x:0,y:0,z:0,ry:0,id:2,ph:.3,hp:40,mx:40,mv:false,atkT:0,hurt:0,...extra});
function snapshot(w,t=4,dt=.016){A.drawWolves([w],t,dt);return Object.fromEntries(Object.entries(A.meshes).map(([n,m])=>[n,Array.from({length:m.count},(_,i)=>{const a=new THREE.Matrix4();m.getMatrixAt(i,a);return a;})]));}
const pos=m=>new THREE.Vector3().setFromMatrixPosition(m);
let finite=true,counts=true,positive=true;const signatures=[];
for(let k=0;k<13;k++){const w=actor(k),p=snapshot(w);signatures.push(JSON.stringify(Object.fromEntries(Object.entries(p).map(([n,ms])=>[n,ms.map(m=>m.elements.map(v=>+v.toFixed(4)))]))));
  for(const [n,ms] of Object.entries(p)){counts&&=ms.length<=A.meshes[n].count_max;for(const m of ms){finite&&=m.elements.every(Number.isFinite);if(n==='W_tail')positive&&=m.determinant()>0;}}}
check('All thirteen zombie and boss types render finite actual geometry',finite&&counts);
check('Every type has a distinct geometry/pose signature',new Set(signatures).size===13);
check('Hair transforms have positive dimensions (fixed swapped roll/size arguments)',positive);
const balance=A.WOLF_T.map(d=>[d.hp,d.spd,d.dmg,d.cd,d.sc,d.boss||0]);
check('Health, speed, attack power, cooldown, scale and bosses remain unchanged',JSON.stringify(balance)===JSON.stringify([[40,3.15,11,1.4,.7,0],[26,5.35,8,1.1,.56,0],[155,2.3,29,3,1.06,0],[1,2.1,34,2.2,1.61,1],[1,2.34,46,2.8,1.79,2],[1,2.04,50,3,2.03,3],[1,2.14,58,3,2.2,4],[1,1.95,70,3.2,2.52,5],[34,3.6,9,1.6,.68,0],[120,2,26,1.2,.86,0],[36,2.7,5,.8,.66,0],[11,4.3,4,.6,.42,0],[110,3.35,20,2,1.12,0]]));
const w=actor(0,{poseAtkCd:.85,poseAtkT:.10,atkT:.08});let p=A.wolfPose(w,1,.016);const ready=p.crouch;
w.atkT=.85;p=A.wolfPose(w,1.016,.016);const strike=p.bite;
w.atkT=.4;p=A.wolfPose(w,1.45,.016);const rest=p.bite;
check('Actual attack cooldown drives prepare, impact and recovery',ready>.7&&strike>.95&&rest===0,{ready,strike,recovered:rest});
const poseOf=(atkT,poseAtkT)=>snapshot(actor(0,{atkT,poseAtkT,poseAtkCd:.85}));
const prep=poseOf(.07,.10),hit=poseOf(.85,.1),recovery=poseOf(.4,.5);
const handTravel=pos(prep.W_paw[0]).distanceTo(pos(hit.W_paw[0]));
check('Attack visibly extends hands and changes upper-body pose',handTravel>.20&&Math.abs(prep.W_body[0].elements[6]-hit.W_body[0].elements[6])>.1,{handTravel});
const stopped=A.wolfPose(actor(0),2,.016);check('Idle without actual attack never invents a strike',stopped.bite===0&&stopped.crouch===0);
const guest=actor(0);delete guest.atkT;const guestPhases=[0,.4,.7].map(t=>A.wolfPose(guest,t,.016));
check('Guest movement-only snapshots retain attack presentation without new network fields',guestPhases.some(p=>p.bite>0)&&guestPhases.some(p=>p.crouch>0));
const hunter=actor(0,{mv:true,shT:true,gv:6,lx:0,lz:0,gp:0});
let peakAlert=0,lastHunt;
for(let i=0;i<60;i++){hunter.z+=.1;lastHunt=A.wolfPose(hunter,i/60,1/60).threat;peakAlert=Math.max(peakAlert,lastHunt.alert);}
check('Discovering prey gives a short anticipation then sustained hunting posture',peakAlert>.95&&lastHunt.alert===0&&lastHunt.chase>.99&&lastHunt.drive>.98,{peakAlert,chase:lastHunt.chase,drive:lastHunt.drive});
const oldChase=lastHunt.chase;hunter.shT=false;hunter.z+=.1;const release=A.wolfPose(hunter,1.016,1/60).threat.chase;
for(let i=0;i<90;i++){hunter.z+=.1;lastHunt=A.wolfPose(hunter,1.03+i/60,1/60).threat;}
check('Losing prey relaxes the visual chase without a one-frame snap',release>oldChase*.85&&release<oldChase&&lastHunt.chase<.001,{release,settled:lastHunt.chase});
const guestHunter=actor(0,{mv:true,gv:6,lx:0,lz:0,gp:0});delete guestHunter.shT;
guestHunter.z=.1;const guestHunt=A.wolfPose(guestHunter,1,1/60).threat;
check('Remote snapshots infer a rush from existing motion, without extra network state',guestHunt.chase>0&&guestHunt.alert>0,{chase:guestHunt.chase});
const passive=actor(9,{mv:true,shT:true,noChase:true,gv:6,lx:0,lz:0,gp:0});
const noHunt=A.wolfPose(passive,1,1/60).threat;
const remotePassive=actor(10,{mv:true,gv:6,lx:0,lz:-.1,gp:0});delete remotePassive.shT;delete remotePassive.noChase;
const remoteNoHunt=A.wolfPose(remotePassive,1,1/60).threat;
check('Non-chasing roles do not invent a prey-discovery reaction, including guests',noHunt.chase===0&&noHunt.alert===0&&remoteNoHunt.chase===0&&remoteNoHunt.alert===0);
const bodyPose=extra=>snapshot(actor(0,{mv:true,gv:6,lx:0,lz:0,gp:1,ph:1,...extra}));
const patrolPose=bodyPose({shT:false}),chasePose=bodyPose({shT:true,poseChase:1,posePreyWas:true});
const angle=m=>new THREE.Vector3(0,1,0).transformDirection(m).z;
const chaseDelta={lower:pos(patrolPose.W_body[0]).y-pos(chasePose.W_body[0]).y,lean:angle(chasePose.W_body[0])-angle(patrolPose.W_body[0]),hand:Math.max(...chasePose.W_paw.map((m,i)=>pos(m).distanceTo(pos(patrolPose.W_paw[i]))))};
check('Chasing visibly lowers and leans the body and reaches forward',chaseDelta.lower>.02&&chaseDelta.lean>.15&&chaseDelta.hand>.07,chaseDelta);
check('Both elbows are rendered while all hands remain present',chasePose.W_legs.length===6&&chasePose.W_paw.length===2);
const deadHunter=actor(0,{dead:.4,shT:true,poseChase:1,poseAlert:.2});const death=A.wolfPose(deadHunter,1,1/60).threat;
check('Defeated zombies stop the discovery and chase pose',death.chase===0&&death.alert===0&&death.drive===0);
const phaseA=A.wolfPose(actor(0,{id:1}),.4,.016).threat,phaseB=A.wolfPose(actor(0,{id:8}),.4,.016).threat;
check('Zombie identity gives different leading hands and stagger phase',phaseA.side!==phaseB.side);
const nightShapes=[];for(let nk=0;nk<10;nk++){A.G.nk=nk;const p=snapshot(actor(0));nightShapes.push(p.W_costume.length+':'+p.W_costume.map(m=>m.elements.join(',')).join(';'));}
check('Night themes change costume geometry, beyond recoloring',new Set(nightShapes).size>=7,{uniqueStyles:new Set(nightShapes).size});A.G.nk=0;
let capacity=true,completeArmor=true;const maxCounts={};
for(let k=0;k<13;k++){const single=snapshot(actor(k)).W_plate.length;const army=Array.from({length:92},(_,i)=>actor(k,{id:i,x:i*.1}));A.drawWolves(army,5,.016);
 if(k===9)completeArmor=A.meshes.W_plate.count===single*92;
 for(const [n,m] of Object.entries(A.meshes)){capacity&&=m.count<=m.count_max;maxCounts[n]=Math.max(maxCounts[n]||0,m.count);}}
check('All-type maximum crowds fit their instance buffers',capacity,{costume:maxCounts.W_costume,capacity:A.meshes.W_costume.count_max});
check('Every armored zombie keeps its entire armor in a maximum crowd',completeArmor,{plates:maxCounts.W_plate});
check('No blood stains remain in zombie renderer',!fn('drawWolves').includes('0x7a1018')&&!fn('drawWolves').includes('0xff6a5a')&&!fn('drawWolves').includes('0x7a1a24'));
let sharp;const require=createRequire(import.meta.url);for(const x of ['sharp',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')])try{sharp=require(x);break;}catch{}
fs.mkdirSync(out,{recursive:true});
const S=420,pixels=Buffer.alloc(S*S*4),light=new THREE.Vector3(-.35,.8,.55).normalize();
function render(pose,angle,closeup=false,elevation=0){
  const depth=new Float32Array(S*S);depth.fill(Infinity);
  for(let i=0;i<S*S;i++){pixels[i*4]=233;pixels[i*4+1]=246;pixels[i*4+2]=255;pixels[i*4+3]=255;}
  const box=new THREE.Box3();for(const [name,ms] of Object.entries(pose)){const geo=A.meshes[name].geometry;geo.computeBoundingBox();for(const m of ms)box.union(geo.boundingBox.clone().applyMatrix4(m));} const center=(box.min.y+box.max.y)/2,extent=Math.max(box.max.y-box.min.y,box.max.x-box.min.x,box.max.z-box.min.z)*.60;
  const camera=new THREE.OrthographicCamera(-extent,extent,extent,-extent,.1,20);
  camera.position.set(Math.sin(angle)*5*Math.cos(elevation),center+5*Math.sin(elevation),Math.cos(angle)*5*Math.cos(elevation));
  camera.lookAt(0,center,0);camera.updateMatrixWorld();
  const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3(),normal=new THREE.Vector3(),color=new THREE.Color();
  for(const [name,ms] of Object.entries(pose)){
    if(name==='gunGlow')continue;const mesh=A.meshes[name],geometry=mesh.geometry,position=geometry.attributes.position,normals=geometry.attributes.normal,index=geometry.index;
    for(let instance=0;instance<ms.length;instance++){
      const matrix=ms[instance],count=index?index.count:position.count,normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
      if(mesh.instanceColor)mesh.getColorAt(instance,color);else color.set(0xffffff);color.multiply(mesh.material.color||new THREE.Color(0xffffff));
      // Colors are read after re-drawing this pose (below), never borrowed from
      // whichever pose happened to run last in the tests.
      for(let k=0;k<count;k+=3){
        v0.fromBufferAttribute(position,index?index.getX(k):k).applyMatrix4(matrix);
        v1.fromBufferAttribute(position,index?index.getX(k+1):k+1).applyMatrix4(matrix);
        v2.fromBufferAttribute(position,index?index.getX(k+2):k+2).applyMatrix4(matrix);
        normal.crossVectors(v1.clone().sub(v0),v2.clone().sub(v0)).normalize();
        const rgbAt=[0,1,2].map(offset=>{
          const n=normals&&!mesh.material.flatShading?new THREE.Vector3().fromBufferAttribute(normals,index?index.getX(k+offset):k+offset).applyNormalMatrix(normalMatrix):normal;
          return color.clone().multiplyScalar(.68+.32*Math.max(0,n.dot(light))).convertLinearToSRGB();
        });
        const pts=[v0.clone().applyMatrix4(projection),v1.clone().applyMatrix4(projection),v2.clone().applyMatrix4(projection)].map(v=>({x:(v.x*.5+.5)*S,y:(.5-v.y*.5)*S,z:v.z}));
        const [a,b,c]=pts,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<1e-6)continue;
        const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(S-1,Math.ceil(Math.max(a.x,b.x,c.x)));
        const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(S-1,Math.ceil(Math.max(a.y,b.y,c.y)));
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const px=x+.5,py=y+.5,w1=((px-a.x)*(c.y-a.y)-(py-a.y)*(c.x-a.x))/area,w2=((b.x-a.x)*(py-a.y)-(b.y-a.y)*(px-a.x))/area,w0=1-w1-w2;
          if(w0<-.00001||w1<-.00001||w2<-.00001)continue;const z=w0*a.z+w1*b.z+w2*c.z,p=y*S+x;
          if(z>=depth[p])continue;depth[p]=z;
          pixels[p*4]=Math.round(Math.min(1,w0*rgbAt[0].r+w1*rgbAt[1].r+w2*rgbAt[2].r)*255);
          pixels[p*4+1]=Math.round(Math.min(1,w0*rgbAt[0].g+w1*rgbAt[1].g+w2*rgbAt[2].g)*255);
          pixels[p*4+2]=Math.round(Math.min(1,w0*rgbAt[0].b+w1*rgbAt[1].b+w2*rgbAt[2].b)*255);
        }
      }
    }
  }
  return Buffer.from(pixels);
}

if(sharp){
 const makeSheet=async(panels,name,cols=4)=>{const overlays=[];for(let i=0;i<panels.length;i++){const q=panels[i];A.G.nk=q.nk||0;
   const png=await sharp(render(snapshot(actor(q.k,q.extra||{})),.5),{raw:{width:S,height:S,channels:4}}).png().toBuffer();
   overlays.push({input:png,left:i%cols*S,top:50+Math.floor(i/cols)*(S+34)});
   overlays.push({input:Buffer.from(`<svg width="${S}" height="34"><text x="12" y="23" font-size="18" font-family="sans-serif" fill="#294157">${q.label}</text></svg>`),left:i%cols*S,top:50+Math.floor(i/cols)*(S+34)});}
  overlays.push({input:Buffer.from(`<svg width="${S*cols}" height="50"><text x="20" y="32" font-size="22" font-family="sans-serif" fill="#294157">CPU actual geometry inspection · no browser / no WebGL lighting</text></svg>`),left:0,top:0});
  await sharp({create:{width:S*cols,height:50+Math.ceil(panels.length/cols)*(S+34),channels:4,background:'#e9f6ff'}}).composite(overlays).png().toFile(path.join(out,name));};
 await makeSheet([0,1,2,8,9,10,11,12,3,4,5,6,7].map(k=>({k,label:A.WOLF_T[k].n})), '54-zombie-types.png');
 await makeSheet([{k:0,label:'준비',extra:{atkT:.07,poseAtkT:.10,poseAtkCd:.85}},{k:0,label:'실제 공격',extra:{atkT:.85,poseAtkT:.1,poseAtkCd:.85}},{k:0,label:'회복',extra:{atkT:.4,poseAtkT:.5,poseAtkCd:.85}},{k:1,label:'날쌘 달리기',extra:{mv:true,lx:0,lz:-.085,gv:5.3,gp:1.4}},{k:2,label:'묵직한 걸음',extra:{mv:true,lx:0,lz:-.032,gv:2,gp:1.4}},{k:8,label:'한쪽 다리를 끄는 걸음',extra:{mv:true,lx:0,lz:-.05,gv:3.1,gp:1.4}}],'54-zombie-motion.png',3);
 await makeSheet(A.ZOMBIE_NIGHT.map((_,nk)=>({k:0,nk,label:'밤 테마 '+(nk+1)})),'54-zombie-nights.png',5);
}
fs.writeFileSync(path.join(out,'54-zombie-results.json'),JSON.stringify({file,sha256:crypto.createHash('sha256').update(source).digest('hex'),results},null,2));
console.log(`${results.filter(x=>x.pass).length}/${results.length} checks passed`);process.exitCode=results.some(x=>!x.pass)?1:0;
