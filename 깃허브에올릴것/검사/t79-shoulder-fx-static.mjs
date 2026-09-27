// Actual promoted-shoulder pose publication and the shared wing particle pool.
// No browser: read current source, render the real avatar matrices, run emitters.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
const a0=source.indexOf('/* ═══════════ 66차 WING'),fx=source.slice(a0,source.indexOf('/* 화살 */',a0));
const checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
function make(){
 const C=vm.createContext({THREE,Math,console,window:{}});
 vm.runInContext(`const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),GY=0,SHEEP_S=.7,ZEROM=new THREE.Matrix4().makeScale(0,0,0);
 const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),UPV=new THREE.Vector3(0,1,0),AX_Z=new THREE.Vector3(0,0,1);
 const flatMat=(hex,o)=>new THREE.MeshLambertMaterial(Object.assign({color:hex},o||{}));
 const G={phase:'day'},PL={x:0,y:0,z:0,yaw:0,glide:false},XP={job:-1,jt:0},meSheep={me:true},SFX={};
 const now0=()=>0,puff=()=>{},tone=()=>{},pluck=()=>{},thump=()=>{},groundUnder=()=>0,ring=()=>{};
 ${decl('JOB_WING')}\n${decl('JOB_AURA')}\n${fx}
 const totals={spark:0,feather:0},oldSpark=wingFxSpark,oldFeather=wingFxFeather;
 wingFxSpark=(...a)=>{const p=oldSpark(...a);if(p)totals.spark++;return p;};
 wingFxFeather=(...a)=>{const before=wfxTok;oldFeather(...a);if(wfxTok<before)totals.feather++;};
 globalThis.A={wingFxShoulder79,wingFxPeople,wingFxTick,wingFxSpark,wfxSp,wfxShoulderStats79,scene,totals,meSheep,PL,
 WFX_SN,WFX_RATE,WFX_SRATE79,WFX_SDIST79};`,C);return C.A;
}
const actor=(jb=0,jt=2)=>({x:2,y:0,z:3,ry:0,jb,jt,run:0,air:false,down:false,jsh79:new Float32Array([2.42,1.27,3,1.58,1.27,3]),jshT79:0});
const profiles=[];let originOK=true;
for(const jb of [0,1,2])for(const jt of [1,2]){
 const A=make(),s=actor(jb,jt),sizes=[],colors=new Set();
 for(let i=0;i<360;i++){const t=i/60;s.x+=.002;s.jsh79[0]=s.x+.42;s.jsh79[3]=s.x-.42;s.jshT79=t;
  A.wingFxShoulder79(s,1/60,t,true);
  for(const p of A.wfxSp)if(p.t>0&&p.t===p.t0&&p.fx79){sizes.push(p.sz);colors.add(p.c.getHex());
   originOK&&=Math.abs(p.y-1.30)<.06&&Math.abs(p.z-3)<.02&&Math.abs(Math.abs(p.x-s.x)-.45)<.07;
  }A.wingFxTick(1/60);
 }
 profiles.push({jb,jt,count:A.wfxShoulderStats79.emitted,size:Math.max(...sizes),colors:[...colors]});
}
check('All three jobs emit from the current outside shoulder positions while the avatar moves',originOK&&profiles.every(p=>p.count>5),profiles);
check('Second promotion visibly increases size and paired activity without exceeding the shoulder budget',profiles.filter(p=>p.jt===2).every(p=>{const a=profiles.find(q=>q.jb===p.jb&&q.jt===1);return p.size>a.size*1.35&&p.count>a.count*2&&p.count<=6*30+8;}));
const M=make();let blocked=true;
for(const invalid of [{jt:0},{jb:-1},{down:true},{x:100},{jsh79:null},{jshT79:-1}]){const s=Object.assign(actor(),invalid);for(let i=0;i<120;i++)M.wingFxShoulder79(s,1/60,0,false);blocked&&=M.wfxShoulderStats79.emitted===0;}
check('No promotion, invalid job, downed, distant, missing and stale poses emit nothing',blocked);
const N=make();Object.assign(N.meSheep,actor());let t=0;
for(let i=0;i<120;i++){t+=1/60;N.meSheep.jshT79=t;N.wingFxPeople([N.meSheep],1/60,t);N.wingFxTick(1/60);}
const started=N.wfxShoulderStats79.emitted;
for(let i=0;i<120;i++){t+=1/60;N.wingFxPeople([],1/60,t);N.wingFxTick(1/60);}
const noGhost=N.wfxShoulderStats79.emitted===started&&N.wfxSp.every(p=>p.t<=0);
for(let i=0;i<120;i++){t+=1/60;N.meSheep.jshT79=t;N.wingFxPeople([N.meSheep],1/60,t);N.wingFxTick(1/60);}
check('Hiding the local body stops emission, old pieces expire, and third-person return resumes',started>0&&noGhost&&N.wfxShoulderStats79.emitted>started,{before:started,after:N.wfxShoulderStats79.emitted});
const loads=[];
for(const hz of [30,60,120]){
 const A=make(),crowd=Array.from({length:21},(_,i)=>({...actor(i%3),x:(i%7)-3,z:Math.floor(i/7)-1,air:true,wtip:new Float32Array(12),wcyc:0}));
 let peakLive=0,time=0;const meshes=A.scene.children.length;
 for(let f=0;f<5*hz;f++){time+=1/hz;for(const s of crowd){s.jshT79=time;s.wtipT=time;s.wcyc=(time*1.75)%1;}
  A.wingFxPeople(crowd,1/hz,time);A.wingFxTick(1/hz);peakLive=Math.max(peakLive,A.wfxSp.filter(p=>p.t>0).length);
 }
 loads.push({hz,shoulder:A.wfxShoulderStats79.emitted,sparks:A.totals.spark,feathers:A.totals.feather,peakLive,meshesAdded:A.scene.children.length-meshes,slots:A.wfxSp.length});
}
check('21 promoted fliers share the existing 150/s total and 128 slots at 30/60/120 FPS; shoulders stay below 30/s plus eight burst',loads.every(q=>q.shoulder>30&&q.shoulder<=158&&q.sparks+q.feathers<=790&&q.peakLive<=128&&q.slots===128&&q.meshesAdded===0),loads);
const R=make();const p=R.wingFxSpark(0,0,0,0xffffff,0,0,0,.2,.1,0);p.fx79=2;p.sx79=.24;p.sy79=1.8;
for(let i=0;i<128;i++)R.wingFxSpark(0,0,0,0xffffff,0,0,0,.2,.1,0,false);
check('Pool reuse clears shoulder stretching before ordinary wing sparkles reuse that slot',p.fx79===0&&p.sx79===1&&p.sy79===1);
check('No shoulder mesh, material, light, or per-frame geometry creation is introduced',!/(new THREE|PointLight|SpotLight|setTimeout)/.test(fn('wingFxShoulder79')));
// Actual drawSheep: verify that the producer publishes both moving shell points.
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8'),load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
const AV=new Function('source','THREE','vm',load+'\nreturn context.API;')(source,THREE,vm);
const s={...actor(),g:0,ph:0,wp:0,we:0,hat:0,gls:0,clo:0};
AV.drawSheep([s],20,40,()=>0x67a7cb,1);const first=s.jsh79&&Array.from(s.jsh79);
s.x+=1.7;s.z-=.8;s.ry=1.1;s.run=1;s.mv=1;AV.drawSheep([s],20.05,40,()=>0x67a7cb,1);
check('Real avatar draw publishes two finite, separated and freshly moving shoulder points',first&&s.jshT79===20.05&&Array.from(s.jsh79).every(Number.isFinite)&&Math.hypot(s.jsh79[0]-s.jsh79[3],s.jsh79[2]-s.jsh79[5])>.3&&Math.hypot(s.jsh79[0]-first[0],s.jsh79[2]-first[2])>1,{first,next:s.jsh79&&Array.from(s.jsh79),stamp:s.jshT79});
const out=path.resolve('artifacts/race79/shoulder-fx');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static-results.json'),JSON.stringify({checks,profiles,loads},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} shoulder FX checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
