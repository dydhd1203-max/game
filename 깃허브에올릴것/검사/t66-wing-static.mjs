// 66차 WING — 날개 관절 굽힘(위상 차·올릴 때 접기·칼깃 부채·활공 미세 조정)과 날개 효과(반짝이·깃털·전직 마법진)를
// 실제 소스 함수를 뽑아 실행해서 본다. 브라우저·DOM·입력 장치는 쓰지 않는다. WebGL 모양은 t57-character-view 가 본다.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.resolve(here,'node_modules/three/build/three.module.js')).href);
const harness=fs.readFileSync(path.join(here,'t54-avatar-static.mjs'),'utf8'),load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const A=context.API'));
const A=new Function('source','THREE','vm',load+'\nreturn context.API;')(source,THREE,vm);
const checks=[],ok=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));};
const r3=v=>Math.round(v*1000)/1000;

/* ── 1. 기하: 뼈 무게·관절 자리·칼깃 부채 ── */
for(let k=0;k<2;k++){
  const g=A.WING_GEO[k],B=g.attributes.wbone,V=g.attributes.wpiv,P=g.attributes.position;
  const fin=['wbone','wpiv'].every(n=>g.attributes[n]&&[...g.attributes[n].array].every(Number.isFinite));
  let rootFixed=true,bounded=true;
  for(let i=0;i<P.count;i++){const x=P.getX(i);if(x<.12&&(B.getX(i)>1e-6||B.getY(i)>1e-6))rootFixed=false;
    for(const w of [B.getX(i),B.getY(i)])if(w<0||w>1)bounded=false;if(Math.abs(B.getZ(i))>1+1e-9)bounded=false;}
  ok('Wing '+k+' stores joint weights and pivots for every vertex, with the shoulder root never bending',fin&&rootFixed&&bounded,{vertices:P.count});
  const tip=g.userData.tipI,mid=g.userData.midI;
  let maxX=-1,maxI=-1;for(let i=0;i<P.count;i++)if(P.getX(i)>maxX){maxX=P.getX(i);maxI=i;}
  ok('Wing '+k+' trail points are the outermost primary tip and a trailing secondary',tip>0&&mid>0&&P.getX(tip)>maxX-.12&&B.getY(tip)===1&&B.getY(mid)<1,{tip:[r3(P.getX(tip)),r3(P.getY(tip))],maxX:r3(maxX)});
  // 칼깃 — 부채 무게(-1..1)가 다른 깃마다 끝 방향이 부챗살로 퍼진다
  const fans=new Map();for(let i=0;i<P.count;i++){const f=B.getZ(i);if(Math.abs(f)>0||B.getY(i)===1&&B.getX(i)===1){const key=f.toFixed(4);const a=fans.get(key)||[];a.push(i);fans.set(key,a);}}
  const dirs=[...fans.values()].map(ids=>{let far=ids[0],near=ids[0];for(const i of ids){if(P.getY(i)<P.getY(far)||P.getX(i)>P.getX(far)+.3)far=i;}
    const cx=V.getZ(ids[0]),cy=V.getW(ids[0]);let best=ids[0],bd=0;for(const i of ids){const d=Math.hypot(P.getX(i)-cx,P.getY(i)-cy);if(d>bd){bd=d;best=i;}}
    return Math.atan2(P.getY(best)-cy,P.getX(best)-cx);});
  const spread=Math.max(...dirs)-Math.min(...dirs);
  ok('Wing '+k+' primaries fan out from the wrist over a wide arc',fans.size>=(k?8:6)&&spread>1.0,{primaries:fans.size,spreadRad:r3(spread)});
}

/* ── 2. 셰이더와 JS 가 같은 셈인지 — 세 단계의 식이 둘 다에 있다 ── */
const matDecl=source.slice(source.indexOf('const WMAT_W ='),source.indexOf('const WMAT_G ='));
const bendSrc=source.slice(source.indexOf('function wingBend('),source.indexOf('function wingFlexSet('));
ok('Vertex shader bend mirrors the JS wingBend used by trails and checks',
  ['wflex.w*wbone.z + wflex.y*wbone.y','wflex.z*wbone.y','wflex.x*wbone.x','wingBend(objectNormal, 0.0)','wingBend(transformed, 1.0)','customProgramCacheKey'].every(t=>matDecl.includes(t))&&
  ['f[3]*fk+f[1]*bw','f[2]*bw','f[0]*be'].every(t=>bendSrc.includes(t)));

/* ── 3. 날갯짓: 위상 차 · 올릴 때 접기 · 부채 · 활공 미세 조정 · 땅/조준/쓰러짐은 굽힘 없음 ── */
const G1=A.WING_GEO[1],P1=G1.attributes.position,B1=G1.attributes.wbone,V1=G1.attributes.wpiv;
const bent=(i,w)=>A.wingBend([0,0,0],P1.getX(i),P1.getY(i),P1.getZ(i),B1.getX(i),B1.getY(i),B1.getZ(i),V1.getX(i),V1.getY(i),V1.getZ(i),V1.getW(i),[w.fe,w.fw,w.fs,w.ff]);
const tipI=G1.userData.tipI,N=200,rows=[];
for(let i=0;i<N;i++){const c=i/N,t=(40+c)/1.75,w=A.avatarWingPose(1,{t,air:1});const p=bent(tipI,w);
  rows.push({c,roll:w.roll,tipA:Math.atan2(p[1],p[0])+w.roll,span:Math.hypot(p[0],p[1],p[2]),back:p[2],w});}
const argmax=k=>rows.reduce((b,r)=>r[k]>b[k]?r:b,rows[0]).c,argmin=k=>rows.reduce((b,r)=>r[k]<b[k]?r:b,rows[0]).c;
const lagTop=((argmax('tipA')-argmax('roll'))%1+1)%1,lagBottom=((argmin('tipA')-argmin('roll'))%1+1)%1;
ok('Wing tips trail the shoulder stroke (shoulder leads, tip follows)',lagTop>.03&&lagTop<.30&&lagBottom>.03&&lagBottom<.30,{lagTop:r3(lagTop),lagBottom:r3(lagBottom)});
const at=c=>rows[Math.round(c*N)%N];
ok('Upstroke folds the hand back and shortens the span, downstroke fully extends it',at(.70).span<at(.20).span*.92&&at(.70).back<at(.20).back-.2,
  {downSpan:r3(at(.20).span),upSpan:r3(at(.70).span),downBack:r3(at(.20).back),upBack:r3(at(.70).back)});
ok('Primaries spread on the downstroke and close on the upstroke',at(.20).w.ff>.08&&at(.70).w.ff<-.1,{down:r3(at(.20).w.ff),up:r3(at(.70).w.ff)});
const gl=[];for(let i=0;i<120;i++){const w=A.avatarWingPose(1,{t:20+i/60,air:1,glide:1});gl.push(w);}
const rng=k=>Math.max(...gl.map(w=>w[k]))-Math.min(...gl.map(w=>w[k]));
ok('Gliding keeps wings spread with slow small adjustments and a fluttering tip',rng('roll')<.2&&rng('fw')>.03&&gl.every(w=>w.ff>0&&w.fs===0&&w.span>1.05),{roll:r3(rng('roll')),tipFlutter:r3(rng('fw'))});
let still=0;for(const e of [{},{mv:1,run:1},{aim:true},{down:true},{air:1,aim:true}])for(let i=0;i<40;i++){const w=A.avatarWingPose(1,{t:i*.37,...e});still=Math.max(still,Math.abs(w.fe),Math.abs(w.fw),Math.abs(w.fs),Math.abs(w.ff));}
ok('Ground, aim and downed wings are never bent (CPU clearance checks stay exact)',still===0,{maxFlex:still});
let jump=0;for(const t of [0,10,1000,50000]){const a=A.avatarWingPose(1,{t,air:1,glide:0}),b=A.avatarWingPose(1,{t,air:1,glide:1e-5});jump=Math.max(jump,...['fe','fw','fs','ff'].map(k=>Math.abs(a[k]-b[k])));}
ok('Entering glide keeps joint bends continuous',jump<1e-4,{jump});

/* ── 4. drawSheep 이 굽힘값을 인스턴스 칸에 적고, 날 때 굽힌 날개 끝 자리를 적는다 ── */
const actor=e=>({x:3,y:0,z:-2,ry:.4,g:0,ph:0,wp:0,we:0,hat:0,gls:0,clo:0,jb:0,jt:2,...e});
const flier=actor({air:true,vy:2});for(let i=0;i<40;i++)A.drawSheep([flier],30+i/60,40,()=>0x67a7cb,1);
const F=A.meshes.wing1.geometry.attributes.wflex,pose=A.avatarWingPose(-1,{t:30+39/60,air:1});
ok('drawSheep writes each wing instance flex into the shader attribute',F&&Math.abs(F.array[4]-pose.fe)<.05&&F.array.slice(0,8).some(v=>Math.abs(v)>1e-3),{written:[...F.array.slice(0,8)].map(r3)});
const wt=flier.wtip,finite=wt&&[...wt].every(Number.isFinite);
ok('Flying avatars record both bent wing tips in world space on either side of the body',finite&&flier.wtipT===30+39/60&&Math.hypot(wt[0]-wt[6],wt[2]-wt[8])>.8&&wt[1]>.5,{tips:wt&&[...wt].map(r3)});
const walker=actor({});A.drawSheep([walker],50,40,()=>0x67a7cb,1);
ok('Grounded avatars do not publish trail points',walker.wtip===undefined);

/* ── 5. 날개 효과 모듈 — 뽑아서 가짜 세계에서 돌린다 ── */
const a0=source.indexOf('/* ═══════════ 66차 WING'),a1=source.indexOf('/* 화살 */',a0);
const fxSrc=source.slice(a0,a1);
function decl(n){const m=new RegExp('^const\\s+'+n+'\\s*=','m').exec(source);let b=0,q='',i=m.index;for(;i<source.length;i++){const c=source[i];if(q){if(c==='\\\\'){i++;continue;}if(c===q)q='';continue;}if(c==='"'||c==="'"||c==='`'){q=c;continue;}if('([{'.includes(c))b++;if(')]}'.includes(c))b--;if(c===';'&&!b)break;}return source.slice(m.index,i+1);}
const sounds=[],rings=[];
const ctx=vm.createContext({THREE,Math,console,window:{__sfx:k=>sounds.push(k),__sfxAt:k=>sounds.push('at:'+k)}});
new vm.Script(`const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),GY=0,SHEEP_S=.7,ZEROM=new THREE.Matrix4().makeScale(0,0,0);
const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),UPV=new THREE.Vector3(0,1,0),AX_Z=new THREE.Vector3(0,0,1);
const flatMat=(hex,o)=>new THREE.MeshLambertMaterial(Object.assign({color:hex},o||{}));
const G={phase:'night'},PL={x:0,y:0,z:0,yaw:0,glide:false},XP={job:-1,jt:0},meSheep={me:true},SFX={};
const now0=()=>0,puff=()=>{},tone=()=>{},pluck=()=>{},thump=()=>{},groundUnder=()=>0;const ring=(...a)=>globalThis.RINGS.push(a);
${decl('JOB_WING')}\n${decl('JOB_AURA')}\n${fxSrc}
globalThis.FX={wingFxPeople,wingFxTick,jobUpFx,wfxSp,wfxFe,wfxJob,wfxSpMesh,wfxFeMesh,wfxBeam,wfxRune,WFX_RATE,WFX_SN,WFX_FN,meSheep,PL,XP,SFX,G};`).runInContext(Object.assign(ctx,{RINGS:rings}));
const X=ctx.FX;
ok('Sparkles and feathers are small opaque pieces; rune bands and beam are the only additive parts',
  !X.wfxSpMesh.material.transparent&&!X.wfxFeMesh.material.transparent&&X.wfxRune.every(m=>m.material.blending===THREE.AdditiveBlending&&!m.material.depthWrite)&&!/PointLight|SpotLight|EffectComposer/.test(fxSrc));
let area=0;for(const m of X.wfxRune.slice(0,3)){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2;}}
ok('Magic circle layers are thin bands, not a filled disc (painted area well under the unit disc)',area<Math.PI*.35,{area:r3(area),disc:r3(Math.PI)});
// 전직 한 번 — 소리·땅 고리·반짝이, 끝나면 전부 숨는다
X.jobUpFx(1,0,2,0,2,true);
let sawRune=false,sawBeam=false,beamR=0;const mm=new THREE.Matrix4(),sc=new THREE.Vector3();
for(let i=0;i<200;i++){X.wingFxTick(1/60);sawRune||=X.wfxRune[0].visible;if(X.wfxBeam.visible){X.wfxBeam.getMatrixAt(X.wfxJob.findIndex(j=>j.t>=0),mm);sc.setFromMatrixScale(mm);if(sc.y>0){sawBeam=true;beamR=Math.max(beamR,sc.x);}}}
const ended=X.wfxJob.every(j=>j.t<0)&&!X.wfxRune.some(m=>m.visible)&&!X.wfxBeam.visible;
ok('Job-up plays its rune circle, thin light beam, ground rings and sound once, then clears itself',sawRune&&sawBeam&&beamR<=.15&&ended&&sounds.includes('jobUpRise')&&rings.length===3,{beamR:r3(beamR),rings:rings.length,sounds});
// 친구 전직 — 들어온 지 4초 안(pc 가 늦게 옴)은 무시, 그 뒤 jt 가 오르면 그 자리에 마법진(통신 없음)
const friend={x:7,y:0,z:-3,jb:1,jt:0,air:false};let t=0;const step=(list,sec)=>{for(let i=0;i<sec*60;i++){t+=1/60;X.wingFxPeople(list,1/60,t);X.wingFxTick(1/60);}};
step([friend],1);friend.jt=1;step([friend],1);const early=X.wfxJob.some(j=>j.t>=0);
step([friend],4);friend.jt=2;step([friend],.1);const late=X.wfxJob.find(j=>j.t>=0);
ok('A friend job-up is detected from the existing pc tier, ignoring the join-time jump',!early&&late&&late.x===7&&late.big,{early,late:late&&{x:late.x,big:late.big}});
step([],3);
// 스물한 명이 한꺼번에 날갯짓 + 내가 활공 — 초당 조각 수 예산을 넘지 않는다
const crowd=Array.from({length:21},(_,i)=>({x:i,y:3,z:0,ry:0,jb:i%3,jt:1+i%2,air:true,down:false,ph:i}));
X.meSheep.jb=0;X.meSheep.jt=2;X.meSheep.air=true;X.meSheep.glide=true;X.meSheep.ry=0;X.meSheep.x=0;X.meSheep.y=3;X.meSheep.z=0;
let emitted=0,maxLive=0,feathers=0;const seen=new Set();sounds.length=0;
for(let i=0;i<300;i++){t+=1/60;
  for(const s of [...crowd,X.meSheep]){s.wtip=s.wtip||new Float32Array(12);s.wtip.set([s.x+1,s.y+1,s.z,s.x+.5,s.y+.7,s.z-.3,s.x-1,s.y+1,s.z,s.x-.5,s.y+.7,s.z-.3]);s.wtipT=t;s.wcyc=((t*1.75+(s.ph||0)/6.283)%1+1)%1;}
  X.wingFxPeople([...crowd,X.meSheep],1/60,t);
  for(const p of X.wfxSp)if(p.t>0&&p.t===p.t0&&!seen.has(p)){emitted++;seen.add(p);}
  for(const p of X.wfxFe)if(p.t>0&&p.t===p.t0)feathers++;
  X.wingFxTick(1/60);seen.clear();maxLive=Math.max(maxLive,X.wfxSp.filter(p=>p.t>0).length);}
ok('A full class flapping at once stays inside the per-second piece budget and the pool',emitted+feathers<=X.WFX_RATE*5+45&&maxLive<=X.WFX_SN&&emitted>100,{emitted,feathers,perSecond:r3((emitted+feathers)/5),budget:X.WFX_RATE,maxLive});
ok('Own flight plays the glide whoosh once, not every frame',sounds.filter(k=>k==='wingGlide').length===1,{glide:sounds.filter(k=>k==='wingGlide').length});
X.meSheep.glide=false;sounds.length=0;step([X.meSheep].map(s=>{s.wtipT=undefined;return s;}),.1);
for(let i=0;i<120;i++){t+=1/60;const s=X.meSheep;s.wtipT=t;s.wcyc=((t*1.75)%1+1)%1;X.wingFxPeople([s],1/60,t);X.wingFxTick(1/60);}
const flaps=sounds.filter(k=>k==='wingFlap').length;
ok('Own flapping makes one soft wing beat per stroke (1.75 per second)',flaps>=3&&flaps<=4,{flaps});
const names=Object.keys(X.SFX);
ok('Wing sounds use only wing…/jobUp… names and join the shared SFX table',names.length===3&&names.every(n=>/^(wing|jobUp)/.test(n)),names);
console.log(`${checks.filter(Boolean).length}/${checks.length} wing checks passed.`);process.exitCode=checks.every(Boolean)?0:1;
