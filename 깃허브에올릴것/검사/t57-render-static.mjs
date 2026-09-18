// Execute current character materials/contact-shadow renderer without input devices.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function chunk(a,b){const x=source.indexOf(a),y=source.indexOf(b,x);if(x<0||y<0)throw Error(a);return source.slice(x,y);}
const pieces=[
  `const GFX={q:'mid',shadow:2048},MAXP=40,GY=9,scene=new THREE.Scene();
   let floor=9;const groundUnder=()=>floor;
   const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),_c1=new THREE.Color();
   const UPV=new THREE.Vector3(0,1,0),FLIP_ON=false;`,
  chunk('const RB_SPEC =','const pbrMat'),
  chunk('const AVATAR_MAT =','/* 크기가 붙은'),
  chunk('function imesh(','/* ═══════════ 로블록스 R6'),
  chunk('function setI(','const fxq ='),
  `globalThis.A={GFX,AVATAR_MAT,flatMat,P_contact,drawAvatarShadows,avatarShadowMaterial,setFloor:n=>floor=n};`
];
const ctx=vm.createContext({THREE,console});new vm.Script(pieces.join('\n')).runInContext(ctx);
const A=ctx.A,checks=[],m=new THREE.Matrix4();
const check=(name,pass)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name);};
const actor=(extra={})=>({x:2,y:9,z:3,ry:.5,jt:0,...extra});
const snapshot=s=>{A.drawAvatarShadows([s],40,1);A.P_contact.getMatrixAt(0,m);return {y:m.elements[13],sx:Math.hypot(...m.elements.slice(0,3)),alpha:A.P_contact.instanceColor.getX(0)};};
check('Skin, clothing and gear have distinct soft specular responses',A.AVATAR_MAT.skin.isMeshPhongMaterial&&A.AVATAR_MAT.skin.shininess>A.AVATAR_MAT.cloth.shininess&&A.AVATAR_MAT.gear.shininess>A.AVATAR_MAT.skin.shininess);
check('Shared character materials preserve costume colors without a second tint',Object.values(A.AVATAR_MAT).every(m=>m.color.getHex()===0xffffff));
A.GFX.q='low';const lowMat=A.flatMat(0xffffff,{specular:0x424242,shininess:38});
check('Low quality keeps the lightweight Lambert path',lowMat.isMeshLambertMaterial);lowMat.dispose();
const grounded=snapshot(actor()),jump=snapshot(actor({y:11,air:true}));
check('Jump shadow stays on actual ground',Math.abs(grounded.y-9.018)<1e-5&&Math.abs(jump.y-grounded.y)<1e-5);
check('Jump shadow grows softer and wider with height',jump.alpha<grounded.alpha&&jump.sx>grounded.sx);
A.setFloor(12);const platform=snapshot(actor({y:13,air:true}));
check('Raised platforms receive the shadow at their own height',Math.abs(platform.y-12.018)<1e-5);
A.setFloor(-999);A.drawAvatarShadows([actor({air:true})],40,1);
check('Race gaps do not receive floating shadow planes',A.P_contact.count===0&&!A.P_contact.visible);
A.setFloor(9);A.drawAvatarShadows([actor({air:true,y:22})],40,1);
check('Very high jumps cull imperceptible shadows',A.P_contact.count===0);
A.setFloor(10);A.drawAvatarShadows([actor({air:true})],40,1);
check('Surfaces above the character do not acquire its shadow',A.P_contact.count===0);
A.setFloor(9);A.GFX.shadow=0;const low=snapshot(actor());
check('Low graphics still has a grounded contact shadow',A.P_contact.count===1&&low.alpha>grounded.alpha);
A.drawAvatarShadows(Array.from({length:60},(_,i)=>actor({x:i})),60,1);
check('Crowd shadows stay within allocated instance capacity',A.P_contact.count===40&&A.P_contact.instanceMatrix.array.every(Number.isFinite));
A.drawAvatarShadows(Array.from({length:30},()=>actor()),21,1);
check('Contact shadows respect the visible player limit',A.P_contact.count===21);
A.drawAvatarShadows([],40,1);
check('No shadow persists after the visible player list empties',A.P_contact.count===0&&!A.P_contact.visible);
const map=A.P_contact.material.map,px=map.image.data,N=map.image.width;
check('One shared soft texture has a clear edge and shaded center',px[3]===0&&px[((N/2)*N+N/2)*4+3]>250&&map.magFilter===THREE.LinearFilter);
check('Contact layer cannot cast duplicate shadows or hide world geometry',!A.P_contact.castShadow&&!A.P_contact.receiveShadow&&!A.P_contact.material.depthWrite&&A.P_contact.material.transparent);
// 몸에 얇게 덧붙는 부속(날개·발광·고리·직업 옷/모자/소품)은 그림자를 주고받으면 안 된다.
// 몸과의 틈이 0.003칸쯤인데 그림자 밀어내기(normalBias)가 그 열 배라, 켜 두면 걷거나 날 때
// 그림자 맵이 프레임마다 다르게 끊겨 옷이 깜빡인다. 사람 모양 그림자는 몸·머리·팔·다리가 만든다.
{
  const bias=/sun\.shadow\.normalBias = ([\d.]+);/.exec(source);
  check('Shadow push-out is still far larger than the gap these add-ons sit at',
    !!bias&&Number(bias[1])>0.01,bias&&bias[1]);
  // castShadow 를 false 로 끄는 문장을 모두 모아, 어떤 이름이 함께 적혔는지 본다.
  // 연쇄 대입(A.castShadow = A.receiveShadow = B.castShadow = … = false)도 한 문장으로 잡는다.
  const flat=[...source.matchAll(/[^;\n]*castShadow[^;]*= *false;/g)].map(m=>m[0]).join(' | ');
  for(const group of ['P_wing','P_jobF','P_jobR','P_jobMeshes'])
    check(group+' add-ons are excluded from the shadow map',flat.includes(group),flat);
}
console.log(`${checks.filter(Boolean).length}/${checks.length} character render checks passed; WebGL compilation is checked separately.`);
process.exitCode=checks.every(Boolean)?0:1;
