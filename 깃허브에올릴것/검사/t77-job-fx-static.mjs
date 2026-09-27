// Real avatar foot poses and FX functions extracted from current game source. No browser.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),file=process.argv[2]||path.resolve(here,'../../클로드/index.html'),source=fs.readFileSync(file,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const loader=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8');
const load=loader.slice(loader.indexOf('function scanEnd('),loader.indexOf('const A=context.API'));
const A=new Function('source','THREE','vm',load+'\nreturn context.API;')(source,THREE,vm);
const fxSource=source.slice(source.indexOf('/* ═══════════ 66차 WING'),source.indexOf('/* 화살 */',source.indexOf('/* ═══════════ 66차 WING')));
const aura=source.match(/const JOB_AURA = ([^;]+);/)[0],wing=source.match(/const JOB_WING = ([\s\S]*?);/)[0];
const ctx=vm.createContext({THREE,Math,console,window:{__sfx:()=>{},__sfxAt:()=>{}},sheepFootPose:A.sheepFootPose});
new vm.Script(`
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),GY=0,SHEEP_S=.7,ZEROM=new THREE.Matrix4().makeScale(0,0,0);
 const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),UPV=new THREE.Vector3(0,1,0),AX_Z=new THREE.Vector3(0,0,1);
 const flatMat=(hex,o)=>new THREE.MeshLambertMaterial(Object.assign({color:hex},o||{}));
 const G={phase:'day'},PL={x:0,y:0,z:0,yaw:0,ground:true,glide:false},XP={job:-1,jt:0},meSheep={me:true},SFX={};
 let gaitMe=0,sprinting=false;
 const now0=()=>0,puff=()=>{},tone=()=>{},pluck=()=>{},thump=()=>{},groundUnder=()=>0,ring=()=>{};
 ${wing}\n${aura}\n${fxSource}
 globalThis.FX={wingFxPeople,wingFxTick,jobUpFx,wingFxGround,wfxMark,wfxMarkMeshes,wfxMarkStats,wfxJob,wfxSp,wfxFe,WFX_MN,WFX_MRATE,PL,XP,meSheep,
 setLocal:(phase,run)=>{gaitMe=phase;sprinting=run;},reset:()=>{for(const p of [...wfxMark,...wfxSp,...wfxFe])p.t=0;for(const p of wfxJob)p.t=-1;for(const k in wfxMarkStats)wfxMarkStats[k]=0;wfxTok=40;wfxMTok=24;wfxLocal._wf=null;}};
`).runInContext(ctx);
const X=ctx.FX,results=[],out=path.resolve(here,'artifacts/77-job-fx');fs.mkdirSync(out,{recursive:true});
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}${detail?' '+JSON.stringify(detail):''}`);};
let clock=10;
const actor=(jb,jt,run=true)=>({x:0,y:0,z:0,ry:Math.PI,g:0,ph:0,wp:0,we:0,hat:0,gls:0,clo:0,jb,jt,run,air:false,down:false});
const draw=(actors,dt=1/60)=>{clock+=dt;A.drawSheep(actors,clock,40,()=>0x88aaaa,.7);const start=performance.now();X.wingFxPeople(actors,dt,clock);X.wingFxTick(dt);return performance.now()-start;};
const travel=(s,seconds,speed=5,mode='third',dt=1/60)=>{
  let maxLive=0,maxLength=0,left=0,right=0;
  for(let frame=0;frame<Math.round(seconds/dt);frame++){
    s.z+=speed*dt;clock+=dt;A.drawSheep([s],clock,40,()=>0x88aaaa,.7);
    if(mode==='first'){
      Object.assign(X.PL,{x:s.x,y:s.y,z:s.z,yaw:s.ry,ground:!s.air,down:s.down});X.XP.job=s.jb;X.XP.jt=s.jt;
      X.setLocal(A.sheepGait(s,clock).gp,s.run);X.wingFxPeople([],dt,clock);
    }else X.wingFxPeople([s],dt,clock);
    for(const p of X.wfxMark)if(p.t>0){maxLength=Math.max(maxLength,p.len);if(p.t===p.t0)(p.side<0?right++:left++);}
    X.wingFxTick(dt);maxLive=Math.max(maxLive,X.wfxMark.filter(p=>p.t>0).length);
  }
  return {steps:X.wfxMarkStats.steps,emitted:X.wfxMarkStats.emitted,maxLive,maxLength,left,right};
};
check('Three small opaque banks share the existing sparkle material',X.wfxMarkMeshes.length===3&&X.wfxMarkMeshes.every(m=>!m.material.transparent&&!m.castShadow&&m.instanceMatrix.count===96)&&new Set(X.wfxMarkMeshes.map(m=>m.material)).size===1);
const geometry=X.wfxMarkMeshes.map(m=>({triangles:m.geometry.attributes.position.count/3,finite:[...m.geometry.attributes.position.array].every(Number.isFinite)}));
check('Job glyph and curved heel ribbon geometry is bounded and distinct',geometry.every(g=>g.finite&&g.triangles<150)&&new Set(geometry.map(g=>g.triangles)).size===3,geometry);
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++){
  X.reset();X.XP.jt=0;const s=actor(jb,jt);Object.assign(X.meSheep,s);delete X.meSheep._wf;
  const r=travel(X.meSheep,2.6);
  check(`Job ${jb} tier ${jt} local third-person emits on both actual feet`,r.steps>=4&&r.left>0&&r.right>0&&r.emitted===r.steps,r);
  check(`Job ${jb} tier ${jt} foot anchors are finite and freshly rendered`,X.meSheep.wfootT===clock&&X.meSheep.wfoot.length===10&&[...X.meSheep.wfoot].every(Number.isFinite));
}
X.reset();const fp=actor(1,2),first=travel(fp,2.6,5,'first');
check('First-person local runner also emits on both feet without a rendered body',first.steps>=4&&first.left>0&&first.right>0,first);
X.reset();X.XP.jt=0;const walking=travel(actor(2,1,false),2.6,2.6);
X.reset();const running=travel(actor(2,2,true),2.6,5);
check('Sprint and tier two make a clearly longer trail than walking',running.maxLength>walking.maxLength*2&&walking.emitted>0,{walking,running});
let permanentRing=false;
for(let jb=0;jb<3;jb++)for(const flags of [{},{run:true,mv:true},{air:true,y:3},{down:true}]){
 const s=Object.assign(actor(jb,2,false),flags);A.drawSheep([s],++clock,40,()=>0x88aaaa,.7);
 permanentRing ||= A.P_jobR.count>0||A.P_jobR.visible;
}
check('All second-tier jobs have no permanent following ground ring when idle, running, airborne or downed',!permanentRing);
for(const [name,flags,speed]of [['stationary',{},0],['airborne',{air:true},5],['downed',{down:true},5],['unpromoted',{jt:0},5]]){
  X.reset();X.XP.jt=0;const s=Object.assign(actor(0,1),flags);travel(s,1.5,speed);
  check(`${name} creates no ground step marks`,X.wfxMarkStats.steps===0&&X.wfxMarkStats.emitted===0,{...X.wfxMarkStats});
}
X.reset();const jumper=actor(0,2);draw([jumper]);jumper.air=true;jumper.y=.3;draw([jumper]);for(let i=0;i<20;i++)draw([jumper]);jumper.air=false;jumper.y=0;draw([jumper]);for(let i=0;i<20;i++)draw([jumper]);
check('Takeoff and landing choreography triggers once per transition',{...X.wfxMarkStats}.takeoffs===1&&X.wfxMarkStats.landings===1,{...X.wfxMarkStats});
X.reset();const warp=actor(1,1);draw([warp]);warp.x=100;draw([warp]);
check('Teleport does not smear a ground trail',X.wfxMarkStats.emitted===0,{...X.wfxMarkStats});
const rates=[];
for(const dt of [1/30,1/60,1/120]){X.reset();rates.push(travel(actor(0,2),3,5,'third',dt).steps);}
check('Footstep event count remains stable at 30/60/120 updates per second',Math.max(...rates)-Math.min(...rates)<=1,rates);
X.reset();Object.assign(X.PL,{x:0,z:0});X.jobUpFx(0,0,0,1,2,true);for(let i=0;i<20;i++)X.jobUpFx(i*.2+1,0,0,i%3,1+i%2,false);
check('A simultaneous class promotion cannot replace the local big promotion',X.wfxJob[0].mine&&X.wfxJob[0].jb===1&&X.wfxJob[0].x===0&&X.wfxJob.filter(p=>p.t>=0).length<=3);
X.reset();X.XP.jt=0;const crowd=Array.from({length:21},(_,i)=>({...actor(i%3,1+i%2),x:(i%7-3)*1.4,z:Math.floor(i/7)*2,ph:i*.4}));
let maxLive=0,maxDraw=0,maxTriangles=0,maxSpark=0,fxCpu=0;
const start=performance.now();for(let frame=0;frame<360;frame++){
  for(const s of crowd)s.z+=5/60;fxCpu+=draw(crowd);const live=X.wfxMark.filter(p=>p.t>0).length;maxLive=Math.max(maxLive,live);
  maxDraw=Math.max(maxDraw,X.wfxMarkMeshes.filter(m=>m.visible).length);maxTriangles=Math.max(maxTriangles,X.wfxMarkMeshes.reduce((sum,m)=>sum+m.count*m.geometry.attributes.position.count/3,0));maxSpark=Math.max(maxSpark,X.wfxSp.filter(p=>p.t>0).length);
}
const elapsed=performance.now()-start;
check('Twenty-one runners stay within the shared pool, emission rate and three draw calls',maxLive<=96&&maxDraw<=3&&X.wfxMarkStats.emitted<=84*6+24&&maxSpark<=128,{maxLive,maxDraw,maxTriangles,maxSpark,...X.wfxMarkStats,avatarAndFxMsPerFrame:elapsed/360,fxOnlyMsPerFrame:fxCpu/360});
for(let i=0;i<240;i++)X.wingFxTick(1/60);
check('All transient ground and promotion effects cleanly expire',X.wfxMark.every(p=>p.t<=0)&&X.wfxMarkMeshes.every(m=>!m.visible&&m.count===0)&&X.wfxJob.every(p=>p.t<0));
check('Old two-way burst footstep paths are removed',!source.includes("if(run && mvK > 0.5 && !air && !down && s !== meSheep)")&&!source.includes('if(sprinting && (XP.jt|0) > 0 && XP.job >= 0 && !tpvOn())'));
fs.writeFileSync(path.join(out,'static-results.json'),JSON.stringify({source:file,sha256:crypto.createHash('sha256').update(source).digest('hex'),results},null,2));
console.log(`${results.filter(r=>r.pass).length}/${results.length} job FX checks passed.`);process.exitCode=results.some(r=>!r.pass)?1:0;
