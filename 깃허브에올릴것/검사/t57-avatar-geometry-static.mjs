// Actual human source geometry and mesh capacity checks. No DOM/browser/input.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(start,body=false){let b=0,p=0,a=0,q='',c='',esc=false,opened=false;
  for(let i=start;i<source.length;i++){const v=source[i],n=source[i+1];
    if(c==='line'){if(v==='\n')c='';continue;}if(c==='block'){if(v==='*'&&n==='/'){c='';i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(v==='\\'){esc=true;continue;}if(v===q)q='';continue;}
    if(v==='/'&&n==='/'){c='line';i++;continue;}if(v==='/'&&n==='*'){c='block';i++;continue;}
    if(v==='"'||v==="'"||v==='`'){q=v;continue;}
    if(v==='{'){b++;opened=true;}if(v==='}')b--;if(v==='(')p++;if(v===')')p--;if(v==='[')a++;if(v===']')a--;
    if(!b&&!p&&!a&&((body&&opened)||(!body&&v===';')))return i+1;
  }throw Error('Unterminated source at '+start);}
function fn(n){const a=source.indexOf('function '+n+'(');if(a<0)throw Error(n);return source.slice(a,end(a,true));}
function decl(n){const m=new RegExp('^const\\s+'+n+'\\s*=','m').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));}
const start=source.indexOf('const STUD ='),stop=source.indexOf('const eyeMat =',start);
if(start<0||stop<start)throw Error('Missing human geometry anchors');
const pieces=[fn('roundBox'),fn('roundCyl'),...['RB','RBl','RBs','BALL','BALLs','CYL'].map(decl),source.slice(start,stop),
  `const MAXP=40,AVATAR_MAT={skin:new THREE.MeshBasicMaterial(),cloth:new THREE.MeshBasicMaterial(),face:new THREE.MeshBasicMaterial(),gear:new THREE.MeshBasicMaterial()},FM={snout:new THREE.MeshBasicMaterial()};
  function imesh(g,m,cap){const mesh=new THREE.InstancedMesh(g,m,cap);mesh.count_max=cap;return mesh;}`,
  decl('P_body'),decl('P_hand'),decl('P_gun'),
  `globalThis.A={R6_HEAD_GEO,R6_BODY_GEO,R6_LIMB_GEO,R6_SHOE_GEO,R6_EYE_GEO,R6_HOOK,R6_SMILE,R6_HEAD_SEG,R6_FACE,R6_HEAD,R6_HK,R6_TOR,R6_ARM,R6_LEG,R6_HU,R6_HIP,R6_SHU,R6_EYE_F,R6_MOUTH_F,r6FaceFront,r6EyeRotation,RB,RBl,CYL,
  P_body,P_head,P_arm,P_eye,P_mouth,P_legs,P_shoe,P_deco,P_hand,P_gun,AVATAR_MAT,MAXP};`];
const context=vm.createContext({THREE});new vm.Script(pieces.join('\n')).runInContext(context);
const A=context.A,checks=[],check=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const geos=[A.R6_HEAD_GEO,A.R6_BODY_GEO,A.R6_LIMB_GEO,A.R6_SHOE_GEO,A.R6_EYE_GEO,...A.R6_HOOK,A.R6_SMILE];
check('Human meshes use dedicated geometry without changing world/zombie primitives',A.P_head.geometry===A.R6_HEAD_GEO&&A.R6_HEAD_GEO!==A.CYL&&A.P_body.geometry===A.R6_BODY_GEO&&A.R6_BODY_GEO!==A.RB&&A.P_arm.geometry===A.R6_LIMB_GEO&&A.R6_LIMB_GEO!==A.RBl&&A.P_eye.geometry===A.R6_EYE_GEO);
check('Head and outfit coordinate proportions remain compatible',Math.abs(A.R6_HEAD[0]-.4488)<1e-9&&Math.abs(A.R6_HEAD[1]-.462)<1e-9&&A.R6_HEAD[0]===A.R6_HEAD[2]&&A.R6_TOR.join(',')==='0.6,0.6,0.3'&&A.R6_LEG.join(',')==='0.3,0.6,0.3'&&A.R6_HU===1.431&&A.R6_HIP===.6&&A.R6_SHU===1.2);
check('All human vertices and normals are finite',geos.every(g=>['position','normal'].every(k=>[...g.attributes[k].array].every(Number.isFinite))));
check('Body, limbs and shoes fit the normalized joint contract', [A.R6_BODY_GEO,A.R6_LIMB_GEO,A.R6_SHOE_GEO].every(g=>{g.computeBoundingBox();return ['x','y','z'].every(k=>Math.abs(g.boundingBox.min[k]+.5)<1e-6&&Math.abs(g.boundingBox.max[k]-.5)<1e-6);}));
const head=new THREE.Mesh(A.R6_HEAD_GEO,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));head.scale.set(.68,.70,.68);head.updateMatrixWorld();
const ray=new THREE.Raycaster(),hitAt=(mesh,x,y)=>{mesh.updateMatrixWorld();ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));return ray.intersectObject(mesh,false)[0];};
let maxFaceError=0;
for(const x of [-.21,-.13,-.108,-.06,0,.06,.108,.13,.21])for(const y of [-.18,0,.19]){
  const hit=hitAt(head,x,y);maxFaceError=Math.max(maxFaceError,hit?Math.abs(hit.point.z-A.r6FaceFront(x)):Infinity);
}
check('Face projection follows the actual 32-sided human head surface',A.R6_HEAD_SEG===32&&maxFaceError<1e-6,{maxFaceError});
const headP=A.R6_HEAD_GEO.attributes.position,headN=A.R6_HEAD_GEO.attributes.normal;
let flatTop=0,bevel=0,side=0;
for(let i=0;i<headP.count;i++){const y=Math.abs(headP.getY(i)),ny=Math.abs(headN.getY(i));if(y>.499&&ny>.95)flatTop++;if(y>.40&&y<.499&&ny>.02&&ny<.98)bevel++;if(y<.42&&ny<.01)side++;}
check('Head keeps a cylindrical side, flat cap, and smoothly beveled rim',flatTop>8&&bevel>32&&side>32,{flatTop,bevel,side});
const f=A.R6_FACE,smile=A.R6_SMILE.attributes.position;let smileError=0,smileLow=0;
for(let i=0;i<smile.count;i++){const x=smile.getX(i)*f.mouthW,y=smile.getY(i)*f.mouthH;
  const z=(A.R6_MOUTH_F-.68)+smile.getZ(i)*.07;
  smileError=Math.max(smileError,Math.abs(z-A.r6FaceFront(x)-.002));smileLow=Math.min(smileLow,y);
}
check('Thin U smile is a surface ribbon with rounded ends, not a floating torus',smileError<1e-6&&smileLow<-.1&&f.stroke/f.mouthW<.075&&f.mouthW>f.mouthH,{smileError,strokeRatio:f.stroke/f.mouthW});
check('Oval eyes are smooth filled surface patches without protruding eyeballs',A.R6_EYE_GEO.parameters.segments>=24&&[...A.R6_EYE_GEO.attributes.position.array].filter((_,i)=>i%3===2).every(z=>z===0)&&f.eyeH>f.eyeW*2);
let eyeGapMin=Infinity,eyeGapMax=-Infinity,eyeChecks=0;
for(const [yaw,pitch] of [[0,0],[.85,.38],[-1.4,-.52],[2.7,.7]])for(const side of [-f.eyeSide,f.eyeSide]){
  const headQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
  const localCenter=new THREE.Vector3(side,f.eyeU-1.06,A.r6FaceFront(side)+.002),center=localCenter.clone().applyQuaternion(headQ);
  const eyeQ=A.r6EyeRotation(yaw,pitch,side,0,new THREE.Quaternion()),inv=headQ.clone().invert();
  const p=A.R6_EYE_GEO.attributes.position;
  for(let i=0;i<p.count;i++){
    const v=new THREE.Vector3().fromBufferAttribute(p,i).multiply(new THREE.Vector3(f.eyeW,f.eyeH,f.eyeD)).applyQuaternion(eyeQ).add(center).applyQuaternion(inv);
    const gap=v.z-A.r6FaceFront(v.x);eyeGapMin=Math.min(eyeGapMin,gap);eyeGapMax=Math.max(eyeGapMax,gap);eyeChecks++;
  }
}
check('Every eye edge stays just above the head surface through yaw and pitch',eyeGapMin>=.00199&&eyeGapMax<.004,{eyeGapMin,eyeGapMax,eyeChecks});
const hands=A.R6_HOOK.map(g=>new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));
check('Both C hands have real open centers and mouths with solid curved palms',hands.every((m,i)=>!hitAt(m,0,0)&&!hitAt(m,i?.40:-.40,0)&&!!hitAt(m,i?-.40:.40,0)));
check('C hand bevels have multiple smooth profile steps',A.R6_HOOK.every(g=>g.parameters.options.bevelSegments===2&&g.parameters.options.bevelEnabled));
check('Skin, clothing, face and held tools use their own material roles',A.P_head.material===A.AVATAR_MAT.skin&&A.P_arm.material===A.AVATAR_MAT.skin&&A.P_hand.every(m=>m.material===A.AVATAR_MAT.skin)&&[A.P_body,A.P_legs,A.P_shoe,A.P_deco].every(m=>m.material===A.AVATAR_MAT.cloth)&&[A.P_eye,A.P_mouth].every(m=>m.material===A.AVATAR_MAT.face)&&A.P_gun.material===A.AVATAR_MAT.gear);
check('Instanced capacity includes four arm/leg segments, two shoes, and eight tool pieces per player',A.P_arm.count_max>=A.MAXP*4&&A.P_legs.count_max>=A.MAXP*4&&A.P_shoe.count_max>=A.MAXP*2&&A.P_gun.count_max>=A.MAXP*8);
const triangles=g=>(g.index?.count||g.attributes.position.count)/3;
const perHuman=triangles(A.R6_BODY_GEO)+triangles(A.R6_HEAD_GEO)+triangles(A.R6_LIMB_GEO)*8+triangles(A.R6_SHOE_GEO)*2+triangles(A.R6_EYE_GEO)*2+triangles(A.R6_SMILE)+A.R6_HOOK.reduce((n,g)=>n+triangles(g),0);
check('Base human geometry remains bounded for a 21-player group',perHuman<7500,{perHuman,twentyOnePlayers:perHuman*21});
console.log(checks.filter(Boolean).length+'/'+checks.length+' actual geometry checks passed. WebGL appearance is tested separately.');process.exitCode=checks.every(Boolean)?0:1;
