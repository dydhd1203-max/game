/* Node-only combat/camera regression checks. Executes declarations and functions
   extracted from index.html; never starts a browser or accesses pointer lock.
   Terrain consists of isolated test fixtures. This checks targeting and clearance
   logic, not complete level geometry, rendered visibility or network delivery. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/54-combat'));
const source=fs.readFileSync(file,'utf8');
const build=process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build');
const THREE=await import(pathToFileURL(path.join(build,'three.module.js')).href);

function end(start,isFunction){
  let braces=0,parens=0,brackets=0,quote='',comment='',escaped=false,opened=false;
  for(let i=start;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{'){braces++;opened=true;}else if(c==='}')braces--;
    else if(c==='(')parens++;else if(c===')')parens--;
    else if(c==='[')brackets++;else if(c===']')brackets--;
    if(isFunction&&opened&&braces===0&&parens===0&&brackets===0)return i+1;
    if(!isFunction&&c===';'&&braces===0&&parens===0&&brackets===0)return i+1;
  }
  throw new Error('Unterminated declaration at '+start);
}
function declaration(name){
  const m=new RegExp('(?:const|let)\\s+'+name+'\\s*=').exec(source);
  if(!m)throw new Error('Missing declaration '+name);
  return source.slice(m.index,end(m.index,false));
}
function fn(name){
  const start=source.indexOf('function '+name+'(');
  if(start<0)throw new Error('Missing function '+name);
  return source.slice(start,end(start,true));
}
const hiddenLine=source.match(/camBodyHidden = camBodyHidden \? camDistance < [^;]+;/)?.[0];
if(!hiddenLine)throw new Error('Missing camera visibility hysteresis assignment');
const fixtures=`
const camera=new THREE.PerspectiveCamera(),G={wolves:[],players:new Map(),me:{g:0}},miniPl=new Map();
const KIT={wpn:0,ammo:0};
let cover=false,wall=false,survival=false,camBodyHidden=false,camAimBlend=0;
let throwCd=0,gunT=0;
const popOpen=()=>false,toast=()=>{},swing=()=>{},window={},gunModels=[],held={visible:false},MINE={out:false,rs:0};
const survTopAt=(x,z)=>cover&&z>=-2.5&&z<=-1.5?3:0;
const survOn=()=>survival,miniOn=()=>survival,
solidTop=(x,z)=>wall&&z===1?GY+3:GY,solidHit=()=>false;
const gboxSegClear=(a,b,c,d,e,f,len)=>len;   // 67차 — cameraClearance 가 성곽 상자(GBOX)도 본다 — 여기선 상자 없음
function setup(y=GY){
  Object.assign(PL,{x:0,y,z:0,down:false});KIT.wpn=0;G.wolves=[];G.players.clear();miniPl.clear();
  cover=false;wall=false;survival=y===MINI_Y;camera.position.set(0,y+.8,3.2);camera.rotation.set(0,0,0);
}
`;
const context=vm.createContext({THREE,console});
vm.runInContext([
  ...['GY','MINI_Y','CAM_FAR','PL','WEAPONS'].map(declaration),fixtures,
  declaration('wpnNow'),declaration('wpnEff'),
  declaration('_shotOrigin'),declaration('_shotRay'),
  ...['combatRay','combatTargetInRange','shotEndpoint','survBlocked','aimWolf','aimPlayer','cameraClearance','fireWeapon'].map(fn),
].join('\n'),context,{timeout:10000});
const run=code=>vm.runInContext(code,context,{timeout:1000});
const results=[];
function check(name,code,accept){
  const detail=run(code),pass=!!accept(detail);results.push({name,pass,detail});
  console.log((pass?'OK   ':'FAIL ')+name+' — '+JSON.stringify(detail));
}
check('Enemies between the camera and the player are excluded',`
  setup();G.wolves=[{id:'rear',hp:10,x:0,y:GY,z:1}];const rearWolf=aimWolf()?.id??null;
  setup(MINI_Y);G.players.set('rear',{uid:'rear',g:1,x:0,y:MINI_Y,z:1});
  ({wolf:rearWolf,player:aimPlayer()?.uid??null});`,d=>d.wolf===null&&d.player===null);
check('Very close front targets remain selectable',`
  setup();G.wolves=[{id:'near',hp:10,x:0,y:GY,z:-.12}];const nearWolf=aimWolf()?.id??null;
  setup(MINI_Y);G.players.set('near',{uid:'near',g:1,x:0,y:MINI_Y,z:-.12});
  ({wolf:nearWolf,player:aimPlayer()?.uid??null});`,d=>d.wolf==='near'&&d.player==='near');
check('PvP cover blocks the player-to-target segment',`
  setup(MINI_Y);G.players.set('target',{uid:'target',g:1,x:0,y:MINI_Y,z:-4});
  const openTarget=aimPlayer()?.uid??null;cover=true;
  ({open:openTarget,covered:aimPlayer()?.uid??null});`,d=>d.open==='target'&&d.covered===null);
check('PvP teammates and eliminated players are excluded',`
  setup(MINI_Y);G.players.set('ally',{uid:'ally',g:0,x:0,y:MINI_Y,z:-3});
  G.players.set('out',{uid:'out',g:1,x:0,y:MINI_Y,z:-4});miniPl.set('out',{o:1});aimPlayer()?.uid??null;`,d=>d===null);
check('Targets beyond player range are excluded even with a rear camera',`
  setup();G.wolves=[{id:'far',hp:10,x:0,y:GY,z:-WEAPONS[0].rng-.1}];aimWolf()?.id??null;`,d=>d===null);
check('Explicit fallback stone range overrides the selected rifle; the bare default still reads the equipped gun',`
  setup();KIT.wpn=5;G.wolves=[{id:'far',hp:10,x:0,y:GY,z:-20}];
  const defaultWolf=aimWolf()?.id??null,stoneWolf=aimWolf(WEAPONS[0])?.id??null;
  setup(MINI_Y);KIT.wpn=5;G.players.set('far',{uid:'far',g:1,x:0,y:MINI_Y,z:-20});
  ({defaultWolf,stoneWolf,defaultPlayer:aimPlayer()?.uid??null,stonePlayer:aimPlayer(WEAPONS[0])?.uid??null});`,
  d=>d.defaultWolf==='far'&&d.defaultPlayer==='far'&&d.stoneWolf===null&&d.stonePlayer===null);
// The crosshair lock and the shot must agree on the weapon. Locking with the rifle range
// while the stone actually flies makes a locked target at 20 tiles miss every time.
check('The effective weapon drives the crosshair lock, not the equipped one, when ammo runs out',`
  setup();KIT.wpn=5;KIT.ammo=0;G.wolves=[{id:'far',hp:10,x:0,y:GY,z:-20}];
  const noAmmo={eff:WEAPONS.indexOf(wpnEff()),lock:!!aimWolf(wpnEff())};
  KIT.ammo=99;
  const withAmmo={eff:WEAPONS.indexOf(wpnEff()),lock:!!aimWolf(wpnEff())};
  KIT.ammo=0;
  ({noAmmo,withAmmo});`,
  d=>d.noAmmo.eff===0&&d.noAmmo.lock===false&&d.withAmmo.eff===5&&d.withAmmo.lock===true);
// Stop only after the actual fireWeapon has selected and forwarded its weapon.
// Rendering, hit effects and network delivery are outside this isolated harness.
check('Actual fireWeapon forwards its no-ammo fallback to both target selectors',`
  const savedWolf=aimWolf,savedPlayer=aimPlayer,dispatched=[],stopDispatch={};
  const captureDispatch=W=>{dispatched.push(WEAPONS.indexOf(W));throw stopDispatch;};
  G.started=true;G.paused=false;G.day=1;
  try {
    setup();KIT.wpn=5;throwCd=0;aimWolf=captureDispatch;
    try{fireWeapon();}catch(e){if(e!==stopDispatch)throw e;}
    setup(MINI_Y);G.mini={k:1,st:'run'};KIT.wpn=5;throwCd=0;aimPlayer=captureDispatch;
    try{fireWeapon();}catch(e){if(e!==stopDispatch)throw e;}
  } finally {aimWolf=savedWolf;aimPlayer=savedPlayer;G.mini=null;}
  dispatched;`,d=>d.length===2&&d.every(i=>i===0));
check('Miss endpoints respect the player-eye range sphere at different camera positions',`
  setup();[[.68,2.1,2.65,.35],[0,PL.EYE,0,0],[.12,.8,.4,-.1]].map(([x,y,z,p])=>{
    camera.position.set(x,GY+y,z);camera.rotation.set(p,0,0);
    return shotEndpoint(11.5).distanceTo(new THREE.Vector3(PL.x,PL.y+PL.EYE,PL.z));});`,
  d=>d.every(n=>Math.abs(n-11.5)<1e-8));
check('Downward miss stops at its first floor intersection within range',`
  setup();camera.position.set(.68,GY+2.1,2.65);camera.rotation.set(-.45,0,0);
  const groundEnd=shotEndpoint(11.5,GY+.2).clone();
  ({height:groundEnd.y-GY,distance:groundEnd.distanceTo(new THREE.Vector3(PL.x,PL.y+PL.EYE,PL.z))});`,
  d=>Math.abs(d.height-.2)<1e-8&&d.distance>0&&d.distance<11.5);
check('Distant stale camera falls back to current player eye',`
  setup();camera.position.set(CAM_MAX+4,GY+2,2.65);
  combatRay().origin.distanceTo(new THREE.Vector3(PL.x,PL.y+PL.EYE,PL.z));`,d=>d===0);
check('Camera clearance catches a one-cell wall including its radius',`
  setup();wall=true;cameraClearance(0,GY+.8,0,0,0,3.2);`,d=>d>.7&&d<.86);
check('Body visibility hysteresis keeps its state between thresholds',`
  camBodyHidden=false;[.50,.60,.53,.89,.91,.60].map(camDistance=>{${hiddenLine}return camBodyHidden;});`,
  d=>JSON.stringify(d)==='[true,true,true,true,false,false]');
check('A wall-tight aiming camera clears the local body without flickering',`
  camAimBlend=1;camBodyHidden=false;
  [1.40,1.50,1.43,1.72,1.78,1.60].map(camDistance=>{${hiddenLine}return camBodyHidden;});`,
  d=>JSON.stringify(d)==='[true,true,true,true,false,false]');
const passed=results.filter(r=>r.pass).length;
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'combat-results.json'),JSON.stringify({file,sha256:crypto.createHash('sha256').update(source).digest('hex'),three:THREE.REVISION,passed,total:results.length,results},null,2));
console.log(`${passed}/${results.length} checks passed; ${path.join(out,'combat-results.json')}`);
if(passed!==results.length)process.exitCode=1;
