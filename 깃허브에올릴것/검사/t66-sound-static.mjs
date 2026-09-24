/* 66차 SOUND — 장면별 배경음·상황별 효과음·버스 셋·동시 목소리 상한·소리 크기 설정.
   브라우저 없이 실제 게임 소스의 소리 덩어리(소리 … ~ addEventListener('pointerdown', audioInit))를 떼어 와
   가짜 AudioContext(노드 연결·예약 시각·게인 값만 기록한다) 위에서 그대로 부른다. 계산식을 복사하지 않는다.
   소리의 실제 파형(최대 진폭·세기·6kHz 위 에너지)은 OfflineAudioContext 렌더(검사 폴더 밖 r66/sound)로 따로 잰다.
   ① 새 소리 이름 전부 있고 · 전부 효과음/환경음 버스를 거쳐 마스터(압축기)로 · 새 소리 한 조각 세기 상한
   ② 동시 목소리 상한 — 갈래마다 VOX_MAX 를 넘지 않는다 · 꽉 차도 다침·수정 소리는 난다 · 같은 소리 간격
   ③ 배경음 장면 전환표(대기실·여명·낮 셋·해질녘·밤·보스·승리 새벽·경주·서바이벌 · 멈춤/짐/소리 끔은 조용)
   ④ 크로스페이드·돌아오면 이어 듣기·앞으로 조금씩 예약·총소리 때 숙임·탭 이탈 멈춤
   ⑤ 설정 — 선생님 기본값·이 기기 저장·버스 세기·음소거
   ⑥ 노드 정리 — 끝난 조각은 스스로 끊고, 거름 사슬·옛 판도 끊긴다
   ⑦ 환경음 — 낮/밤 소리가 환경음 버스로·농장 가까이서 동물·연못 가까이서 개울
   ⑧ 배선 — 호출 지점·설정 화면·다른 갈래 소리(FX2·SPEC·WING·탑·좀비)는 그대로 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {GAME} from './gamefile.mjs';

const require=createRequire(import.meta.url);
let domLib;
for(const c of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){
  try{domLib=require(c);break;}catch{}
}
if(!domLib)throw new Error('linkedom is required');
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const code=source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!code)throw new Error('Game module not found');
const B0=code.indexOf('/* ═══════════════════════ 소리 (파일 없이 코드로 합성)'),B1=code.indexOf("addEventListener('pointerdown', audioInit, {once:true});");
if(B0<0||B1<0||B1<B0)throw new Error('Sound block not found');
const block=code.slice(B0,B1);
function fnSrc(name){const i=code.indexOf('function '+name+'(');if(i<0)return '';let d=0,o=false;
  for(let j=code.indexOf('{',i);j<code.length;j++){const c=code[j];if(c==='{'){d++;o=true;}else if(c==='}'){d--;if(o&&d===0)return code.slice(i,j+1);}}return '';}

const results=[];
const check=(name,pass,detail)=>{results.push(!!pass);console.log((pass?'OK   ':'FAIL ')+name+(detail===undefined?'':' — '+JSON.stringify(detail)));};

/* ── 가짜 오디오: 노드·연결·예약만 기록 ── */
const FAKE=`
let NID=0;
class FParam{constructor(v){this._v=v;this.ev=[];this.max=0;}
  get value(){return this._v;} set value(v){this._v=v;if(v>this.max)this.max=v;}
  _r(k,v,t){this.ev.push([k,v,t]);if(typeof v==='number'&&v>this.max)this.max=v;return this;}
  setValueAtTime(v,t){return this._r('set',v,t);} linearRampToValueAtTime(v,t){return this._r('lin',v,t);}
  exponentialRampToValueAtTime(v,t){return this._r('exp',v,t);} setTargetAtTime(v,t,c){return this._r('tgt',v,t);}
  cancelScheduledValues(t){this.ev.push(['cancel',0,t]);return this;}}
class FNode{constructor(ctx,kind){this.id=++NID;this.ctx=ctx;this.context=ctx;this.kind=kind;this.out=[];this.discN=0;this.numberOfOutputs=1;ctx.nodes.push(this);}
  connect(n){this.out.push(n);return n;} disconnect(){this.out=[];this.discN++;}}
class FSrc extends FNode{constructor(ctx,kind){super(ctx,kind);this.t0=null;this.t1=null;ctx.srcs.push(this);this.onended=null;this.lane=ctx.lane();}
  start(t,off,dur){this.t0=t||0;if(dur!==undefined)this.t1=this.t0+dur;else if(this.buffer&&!this.loop)this.t1=this.t0+this.buffer.duration;}
  stop(t){this.t1=t;} end(){if(this.onended)this.onended.call(this);}}
class FakeCtx{constructor(){this.nodes=[];this.srcs=[];this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=new FNode(this,'dest');this.lane=()=>'?';this.susN=0;this.resN=0;}
  createGain(){const n=new FNode(this,'gain');n.gain=new FParam(1);return n;}
  createOscillator(){const n=new FSrc(this,'osc');n.frequency=new FParam(440);n.type='sine';return n;}
  createBufferSource(){const n=new FSrc(this,'buf');n.buffer=null;n.loop=false;return n;}
  createBiquadFilter(){const n=new FNode(this,'biquad');n.frequency=new FParam(350);n.Q=new FParam(1);n.type='lowpass';return n;}
  createDynamicsCompressor(){const n=new FNode(this,'comp');for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new FParam(0);return n;}
  createDelay(){const n=new FNode(this,'delay');n.delayTime=new FParam(0);return n;}
  createStereoPanner(){const n=new FNode(this,'pan');n.pan=new FParam(0);return n;}
  createWaveShaper(){const n=new FNode(this,'shaper');n.curve=null;return n;}
  createBuffer(ch,len,sr){const d=new Float32Array(len);return {duration:len/sr,length:len,getChannelData:()=>d};}
  suspend(){this.state='suspended';this.susN++;return Promise.resolve();} resume(){this.state='running';this.resN++;return Promise.resolve();}}
`;
function makeGame(opts={}){
  const {document}=domLib.parseHTML(source);
  let hidden=false;Object.defineProperty(document,'hidden',{get:()=>hidden,configurable:true});
  const store=new Map(Object.entries(opts.store||{})),docL={};
  const dae=document.addEventListener.bind(document);
  document.addEventListener=(k,f,o)=>{ if(k==='visibilitychange')(docL[k]=docL[k]||[]).push(f); else dae(k,f,o); };
  const fixture=FAKE+`
  const localStorage={getItem:k=>STORE.has(k)?STORE.get(k):null,setItem:(k,v)=>STORE.set(k,String(v))};
  const LISTEN={};const addEventListener=(k,f)=>{(LISTEN[k]=LISTEN[k]||[]).push(f);};
  let PERF=0;const performance={now:()=>PERF};
  const window={DEFAULTS:${JSON.stringify(opts.defaults||{bgmVol:70,sfxVol:100,ambVol:80})},AudioContext:FakeCtx};
  const G={started:false,phase:'title',day:1,t:0,paused:false,set:{daySec:140,nightSec:130,crystalMax:200},wolves:[],crystal:200,mini:null,farm:[{hen:2},{},{},{},{}]};
  const PL={x:0,y:0,z:0,yaw:0,hp:100,down:false};
  const GY=0,NG=5,ARENA_R=46,FARM_X=[14,0,-14,0,0],FARM_Z=[0,14,0,-14,0],POND={x:21,z:-17,r:4.2};
  const oct=(x,z)=>Math.max(Math.abs(x),Math.abs(z));
  const pathDist=(x,z)=>Math.abs(z-3),streamDist=()=>99;
  const miniOn=()=>G.phase==='mini',raceOn=()=>miniOn()&&!!G.mini&&G.mini.k===0;
  let POP=false;const popOpen=()=>POP;
  const bossIndex=d=>[5,9,12,15,18].indexOf(d);
  const maxHP=()=>100;
  `;
  const api=`
  globalThis.API={G,PL,SFX,SND66,BGM_SC,BGM_CH,BGMP,VOX,VOX_MAX,AUDSTAT,SNDV,SND_DEF,SND_DROP,AMBT,LISTEN,window,
    sfx,sfxAt,sfxFrom,bgmLoop,bgmSceneNow,bgmSwitch,bgmRender,bgmNote,sndSetVol,sndVolApply,ambTick,audioInit,busIn,sndCurve,
    get AUD(){return AUD;}, get BUS(){return BUS;}, get SFXB(){return SFXB;}, get BGMB(){return BGMB;}, get BGMD(){return BGMD;}, get AMBB(){return AMBB;},
    get cur(){return bgmCur;}, get mem(){return bgmMem;}, get sndOn(){return sndOn;}, set sndOn(v){sndOn=v;}, get lane(){return VOX_LANE;},
    setPop:v=>{POP=v;}, setPerf:v=>{PERF=v;}, BGM_XF, BGM_AHEAD, BGM_BASE, BGM_MORN, BGM_DUSK, SFX_GAP, SFX_PRIO};`;
  const ctx=vm.createContext({document,console,Math,JSON,Map,Set,Infinity,Object,Array,String,Number,Float64Array,Float32Array,Promise,Proxy,
    STORE:store,isFinite});
  new vm.Script(fixture+block+api,{filename:'t66-sound-actual.js'}).runInContext(ctx,{timeout:10000});
  const A=ctx.API;
  /* 가짜 컨텍스트가 지금 어느 갈래(sfx·bgm·amb)에서 조각을 만드는지 알게 한다 */
  A.audioInit(); A.AUD.lane=()=>A.lane; A.busIn();
  A.setHidden=v=>{hidden=v;};A.store=store;A.doc=document;A.docL=docL;
  return A;
}
/* 소스 노드 → 마스터(목적지)까지 거친 노드 */
function route(n){const seen=new Set(),q=[n];while(q.length){const x=q.shift();if(seen.has(x))continue;seen.add(x);for(const o of x.out)q.push(o);}return seen;}
function envMax(src,buses){ // 버스 바로 앞 게인(봉투)의 봉우리 — 예약한 값·직접 넣은 값 중 가장 큰 것(thump 의 앞 드라이브 게인은 건너뛴다)
  let x=src,env=null; for(let k=0;k<6&&x;k++){ x=x.out[0]; if(!x||buses.includes(x))break; if(x.kind==='gain')env=x; } return env?env.gain.max:0; }

/* ① 새 소리 이름·버스·세기 */
{ const A=makeGame();
  const want=['leaf','grit','chunk','coin','treeFall','rockBreak','upgrade','repair','demolish','squeak','pry','shopOpen','forgeOpen','farmOpen','tab','buy','sell','nope','enhFail',
    'hen','pig','cow','feedScoop','broom','feedDone','cleanDone','pop','step','land','crystalHit','hpBeat','bird1','bird2','breeze','brook','cricket','owl','nightWind','crow','rooster'];
  const keys=Object.keys(A.SFX),miss=want.filter(k=>!keys.includes(k)||!A.SND66[k]);
  check('Every new situational sound exists in SFX (40 names: mining·building·shop·farm·person·crystal·ambient)',miss.length===0&&Object.keys(A.SND66).length>=want.length,{miss,n:Object.keys(A.SND66).length});
  const AMB=new Set(['bird1','bird2','breeze','brook','cricket','owl','nightWind','crow','rooster']);
  let bad=[],silent=[],loud=[],maxV=0,t=1;
  for(const k of want){ const s0=A.AUD.srcs.length; A.AUD.currentTime=t; t+=4;
    if(AMB.has(k)){ A.window.__sndPlay(k,undefined,true); } else A.sfx(k,1);
    const made=A.AUD.srcs.slice(s0); if(!made.length){silent.push(k);continue;}
    for(const s of made){ const r=route(s); const bus=AMB.has(k)?A.AMBB:A.SFXB;
      if(!r.has(bus)||!r.has(A.BUS)||!r.has(A.AUD.destination))bad.push(k);
      const v=envMax(s,[A.SFXB,A.AMBB]); maxV=Math.max(maxV,v); if(v>0.25)loud.push(k+':'+v.toFixed(2)); } }
  check('Each new sound makes voices (none silent)',silent.length===0,silent);
  check('Every voice of every new sound passes its bus (SFX or ambient) → master compressor → destination',bad.length===0,[...new Set(bad)]);
  check('No single new voice is louder than 0.25 before the bus (21 laptops in one room)',loud.length===0,{maxV:+maxV.toFixed(3),loud});
  const comp=A.AUD.nodes.find(n=>n.kind==='comp'),post=comp&&comp.out[0];
  check('Master keeps the existing compressor (−20dB, 4:1) and ×0.40 make-up trim',comp&&comp.threshold.value===-20&&comp.ratio.value===4&&post&&post.gain.value===0.4);
  const bgmR=route(A.BGMB);
  check('BGM bus runs through the duck gain and 75Hz high-pass / 4.2kHz low-pass before the master',bgmR.has(A.BGMD)&&[...bgmR].some(n=>n.kind==='biquad'&&n.type==='highpass'&&n.frequency.value===75)
    &&[...bgmR].some(n=>n.kind==='biquad'&&n.type==='lowpass'&&n.frequency.value===4200)&&bgmR.has(A.BUS));
  const ambR=route(A.AMBB);
  check('Ambient bus is low-passed at 5kHz and reaches the master',[...ambR].some(n=>n.kind==='biquad'&&n.type==='lowpass'&&n.frequency.value===5000)&&ambR.has(A.BUS));
  /* 배경음 음은 판 게인 → BGMB 로 */
  const s0=A.AUD.srcs.length; A.AUD.currentTime=200; A.bgmRender('day2',204,undefined,200.05);
  const bs=A.AUD.srcs.slice(s0), off=bs.filter(s=>!route(s).has(A.BGMB)||route(s).has(A.SFXB));
  check('All BGM notes (lead·pad·bass·drums) go through the BGM bus, never the SFX bus',bs.length>20&&off.length===0,{notes:bs.length,off:off.length});
  const sq=A.AUD.srcs.filter(s=>s.kind==='osc'&&s.type==='square'&&route(s).has(A.BGMB));
  const b2=A.AUD.srcs.length; for(const k of Object.keys(A.BGM_SC)) A.bgmRender(k,A.AUD.currentTime+12,0.8,A.AUD.currentTime+0.05);
  const sq2=A.AUD.srcs.slice(b2).filter(s=>s.kind==='osc'&&s.type==='square');
  const saw=A.AUD.srcs.slice(b2).filter(s=>s.kind==='osc'&&s.type==='sawtooth'&&![...route(s)].some(n=>n.kind==='biquad'&&n.type==='lowpass'&&n.frequency.value<=500));
  check('No square-wave in any BGM scene; sawtooth (string bass) only behind a ≤500Hz low-pass',sq.length+sq2.length===0&&saw.length===0,{square:sq.length+sq2.length,rawSaw:saw.length});
}

/* ② 동시 목소리 상한 */
{ const A=makeGame();
  const live=(lane,t)=>A.AUD.srcs.filter(s=>s.lane===lane&&s.t0<=t&&(s.t1===null||s.t1>t)).length;
  const base=A.AUDSTAT.skip;
  for(let i=0;i<60;i++){ A.AUD.currentTime=10+i*0.026; A.sfx('rifle'); A.sfx('hit'); }
  let peak=0; for(let t=10;t<12;t+=0.005) peak=Math.max(peak,live('sfx',t));
  check('SFX lane never exceeds VOX_MAX.sfx simultaneous voices under 38 shots/s + hits',peak<=A.VOX_MAX.sfx&&peak>=A.VOX_MAX.sfx-12,{peak,cap:A.VOX_MAX.sfx});
  check('When the lane is nearly full, ordinary sounds are skipped whole (not cut into pieces)',A.AUDSTAT.skip>base,{skipped:A.AUDSTAT.skip-base});
  const h0=A.AUD.srcs.length; A.AUD.currentTime=10+59*0.026+0.001; A.sfx('hurt'); A.sfx('crystalHit');
  check('Priority sounds (hurt·crystalHit) still play while guns fill the lane',A.AUD.srcs.length-h0>=3,A.AUD.srcs.length-h0);
  const b0=A.AUD.srcs.length; A.AUD.currentTime=40; A.bgmRender('boss',60,1,40.05);
  let bpk=0; for(let t=40;t<60;t+=0.01) bpk=Math.max(bpk,live('bgm',t));
  check('BGM lane (boss night, full heat) stays within VOX_MAX.bgm — and is a separate budget from SFX',bpk<=A.VOX_MAX.bgm&&A.AUD.srcs.slice(b0).every(s=>s.lane==='bgm'),{peak:bpk,cap:A.VOX_MAX.bgm});
  check('Total simultaneous voices are capped (sfx+bgm+amb ≤ 94)',A.VOX_MAX.sfx+A.VOX_MAX.bgm+A.VOX_MAX.amb<=94,A.VOX_MAX);
  const s1=A.AUD.srcs.length; A.AUD.currentTime=80; A.sfx('step',1); A.AUD.currentTime=80.05; A.sfx('step',1); A.AUD.currentTime=80.12; A.sfx('step',1);
  const n1=A.AUD.srcs.length-s1; A.AUD.currentTime=90; const s2=A.AUD.srcs.length; A.sfx('hen'); A.AUD.currentTime=90.5; A.sfx('hen');
  check('Per-sound minimum gap: footsteps 0.09s, animals ≥1.2s apart',n1>0&&n1<=2*6&&A.SFX_GAP.step>=0.09&&A.SFX_GAP.hen>=1.2&&A.AUD.srcs.length-s2<=6,{steps:n1,hen:A.AUD.srcs.length-s2});
}

/* ③ 배경음 장면 전환표 */
{ const A=makeGame(),G=A.G;
  const S=A.BGM_SC,names=Object.keys(S);
  check('Twelve BGM scenes: lobby·dawn·day1·day2·day3·dusk·night·boss·victory·race·surv',['lobby','dawn','day1','day2','day3','dusk','night','boss','victory','race','surv'].every(k=>names.includes(k)),names);
  const melOk=names.every(k=>S[k].mel.every(m=>m===null||(m.length===32&&m.every(v=>v===-1||(v>=-12&&v<=21)))));
  const chOk=names.every(k=>S[k].ch.every(c=>c===null||(c.length===4&&c.every(x=>A.BGM_CH[x]))));
  const stepOk=names.every(k=>[0,0.5,1].every(h=>{const s=S[k].step(0,h);return s>=0.17&&s<=0.45;}));
  check('Every scene: 32-note halves within −12…+21 semitones, 4 known chords per half, step 0.17–0.45s',melOk&&chOk&&stepOk);
  const at=(o)=>{Object.assign(G,o);return A.bgmSceneNow();};
  const T=[];
  T.push(['title → lobby',at({started:false,phase:'title'})==='lobby']);
  G.started=true;
  T.push(['day 1 first 13s → dawn',at({phase:'day',day:1,t:138})==='dawn']);
  A.bgmLoop(0); // 이전 단계 기록
  T.push(['day 1 middle → day1',at({t:100})==='day1']);
  T.push(['day 2 → day2 · day 3 → day3 · day 4 → day1',at({day:2})==='day2'&&at({day:3})==='day3'&&at({day:4})==='day1']);
  T.push(['last 22s of day → dusk',at({day:2,t:20})==='dusk']);
  T.push(['night → night · boss day night → boss',at({phase:'night',day:4})==='night'&&at({phase:'night',day:5})==='boss']);
  G.phase='night';A.bgmLoop(0);G.phase='day';G.t=137;A.bgmLoop(0);
  T.push(['morning after a night → victory dawn',A.bgmSceneNow()==='victory']);
  G.phase='mini';G.mini={k:0,st:'intro'};A.bgmLoop(0);G.phase='day';G.day=6;G.t=137;A.bgmLoop(0);
  T.push(['morning after a mini game → dawn (not victory)',A.bgmSceneNow()==='dawn']);
  T.push(['race running → race · survival running → surv · mini intro → lobby',at({phase:'mini',mini:{k:0,st:'run'}})==='race'&&at({mini:{k:1,st:'run'}})==='surv'&&at({mini:{k:0,st:'intro'}})==='lobby']);
  T.push(['paused → silent · lose → silent · win → victory',at({phase:'day',t:100,paused:true})===null&&at({paused:false,phase:'lose'})===null&&at({phase:'win'})==='victory']);
  A.sndOn=false;T.push(['sound off → silent',at({phase:'day'})===null]);A.sndOn=true;
  const bad=T.filter(x=>!x[1]).map(x=>x[0]);
  check('Scene table follows the game state',bad.length===0,bad.length?bad:T.length+' rules');
  const B=A.BGM_MORN, D=A.BGM_DUSK, dawnLen=32*S.dawn.step(0,0), vicLen=16*S.victory.step(0,0)+32*S.victory.step(20,0);
  check('Victory dawn has no fanfare of its own (first 16 steps rest; FX2 fx2Dawn is the one fanfare)',S.victory.mel[0].slice(0,16).every(v=>v===-1),S.victory.mel[0].slice(0,16));
  check('Dawn (13.4s) and victory (12.8s) songs fit the 13s morning window; dusk starts 22s before night',Math.abs(dawnLen-B)<0.6&&Math.abs(vicLen-B)<0.6&&D===22,{dawnLen,vicLen,B,D});
}

/* ④ 크로스페이드·이어 듣기·예약·숙임·탭 이탈 */
{ const A=makeGame(),G=A.G,C=A.AUD;
  Object.assign(G,{started:true,phase:'day',day:1,t:100});
  C.currentTime=1; A.bgmLoop(0.016);
  check('Day 1 plays day1 at once',A.cur&&A.cur.k==='day1'&&A.BGMP.length===1);
  const g1=A.cur.g.gain.ev;
  check('New song fades in over 1.5s (linear ramp to 1)',g1.some(e=>e[0]==='lin'&&e[1]===1&&Math.abs(e[2]-(1+A.BGM_XF))<1e-9));
  for(let f=0;f<300;f++){ C.currentTime+=1/60; A.bgmLoop(1/60); }
  const pDay=A.cur, stepDay=pDay.i;
  check('Notes are scheduled only a little ahead (≤ BGM_AHEAD + one step)',pDay.next<=C.currentTime+A.BGM_AHEAD+0.3,{ahead:+(pDay.next-C.currentTime).toFixed(3)});
  const n0=C.srcs.length; A.bgmLoop(0); A.bgmLoop(0);
  check('Calling the loop again in the same instant makes no new nodes (no per-frame allocation of voices)',C.srcs.length===n0);
  G.phase='mini';G.mini={k:0,st:'run'};C.currentTime+=0.02;A.bgmLoop(0.02);
  check('Scene change keeps both songs during the crossfade (old one ramps to silence in 1.5s)',A.BGMP.length===2&&A.cur.k==='race'&&pDay.end>0
    &&pDay.g.gain.ev.some(e=>e[0]==='lin'&&e[1]<=0.001&&Math.abs(e[2]-pDay.end)<1e-9));
  const beforeFade=pDay.i; for(let f=0;f<60;f++){ C.currentTime+=1/60; A.bgmLoop(1/60); }
  check('The old song keeps playing notes while it fades',pDay.i>beforeFade);
  for(let f=0;f<120;f++){ C.currentTime+=1/60; A.bgmLoop(1/60); }
  check('After the fade the old song is dropped',A.BGMP.length===1&&!A.BGMP.includes(pDay));
  for(let f=0;f<200;f++){ C.currentTime+=1/60; A.bgmLoop(1/60); }
  check('Its nodes are disconnected afterwards (gain·pad·string filters)',pDay.g.discN>0&&pDay.pad.discN>0&&pDay.low.discN>0);
  G.phase='day';G.t=100;C.currentTime+=0.02;A.bgmLoop(0.02);
  const memI=A.mem.day1;
  const bar0=memI&~7;
  check('Coming back to the day song resumes from the bar it left (not from the start)',A.cur.k==='day1'&&memI>0&&bar0>0&&A.cur.i>=bar0&&A.cur.i<=bar0+2,{left:memI,bar:bar0,now:A.cur.i});
  // 숙임
  const dq=A.BGMD.gain.ev.length; C.currentTime+=0.5; A.sfx('rifle');
  const ev=A.BGMD.gain.ev.slice(dq);
  check('A gunshot ducks the BGM (to 0.5) and lets it come back (to 1)',ev.some(e=>e[0]==='tgt'&&e[1]===0.5)&&ev.some(e=>e[0]==='tgt'&&e[1]===1));
  // 창
  A.setPop(true); C.currentTime+=0.1; A.bgmLoop(0.016);
  const bg=A.BGMB.gain.ev.at(-1);
  check('Opening a window lowers the BGM to 55% instead of stopping it',bg&&bg[0]==='tgt'&&Math.abs(bg[1]-A.sndCurve(A.SNDV.bgm)*A.BGM_BASE*0.55)<1e-9&&A.cur.k==='day1');
  A.setPop(false);
  // 탭 이탈
  A.setHidden(true); for(const f of A.docL.visibilitychange||[]) f();
  check('Leaving the tab suspends the audio context',C.state==='suspended'&&C.susN===1);
  const s0=C.srcs.length; A.sfx('get'); A.sfx('chopW');
  check('Sounds are not queued up while the tab is hidden',C.srcs.length===s0);
  const i0=A.cur.i; A.bgmLoop(0.016); A.bgmLoop(0.016);
  check('The song does not advance while suspended',A.cur.i===i0);
  A.setHidden(false); for(const f of A.docL.visibilitychange||[]) f();
  check('Coming back resumes the same song where it was',C.state==='running'&&C.resN>=1&&A.cur.k==='day1');
  C.currentTime+=5; const i1=A.cur.i; A.bgmLoop(0.016);
  check('Notes that were missed while away are skipped, not played in a burst',A.cur.i-i1<=2&&A.cur.next>C.currentTime,{steps:A.cur.i-i1});
  // 멈춤
  G.paused=true; C.currentTime+=0.02; A.bgmLoop(0.016);
  check('Teacher pause fades the music out (scene null) and remembers the bar',A.cur===null&&A.mem.day1>0);
  G.paused=false;
}

/* ⑤ 설정 */
{ const A=makeGame({defaults:{bgmVol:55,sfxVol:90,ambVol:70}});
  check('Teacher defaults (window.DEFAULTS bgmVol·sfxVol·ambVol) are the starting volumes',A.SNDV.bgm===55&&A.SNDV.sfx===90&&A.SNDV.amb===70&&A.SND_DEF.bgm===55);
  A.sndSetVol('bgm',35); A.sndSetVol('sfx',150);
  check('Child settings are saved on this device (sndBgm·sndSfx) and clamped to 0–100',A.store.get('sndBgm')==='35'&&A.store.get('sfxVol')===undefined&&A.store.get('sndSfx')==='100');
  const B=makeGame({defaults:{bgmVol:55,sfxVol:90,ambVol:70},store:{sndBgm:'35',sndSfx:'80',sndOn:'0'}});
  check('Saved settings win over teacher defaults on the next visit (and mute is remembered)',B.SNDV.bgm===35&&B.SNDV.sfx===80&&B.sndOn===false);
  const c=B.sndCurve;
  check('Bus volumes: SFX = curve(sfx) · BGM = curve(bgm)×BGM_BASE · ambient = curve(sfx)×curve(amb) · master 0 while muted',
    Math.abs(B.SFXB.gain.value-c(80))<1e-9&&Math.abs(B.BGMB.gain.value-c(35)*B.BGM_BASE)<1e-9&&Math.abs(B.AMBB.gain.value-c(80)*c(70))<1e-9&&B.BUS.gain.value===0);
  check('BGM at its default is clearly below SFX (BGM bus ≤ 0.5 × SFX bus, −6dB or more)',(()=>{const D=makeGame();return D.BGMB.gain.value<=0.5*D.SFXB.gain.value;})());
  const html=source;
  check('Start screen and 📖 help both have BGM·SFX sliders (0–100, step 5) bound to the same setting',
    /id="sndRowT"[\s\S]{0,400}data-snd="bgm"[\s\S]{0,300}data-snd="sfx"/.test(html)&&/id="sndRowB"[\s\S]{0,400}data-snd="bgm"[\s\S]{0,300}data-snd="sfx"/.test(html)
    &&(html.match(/type="range" min="0" max="100" step="5" data-snd=/g)||[]).length===4);
  const d=A.doc, r=d.querySelector('#sndRowT input[data-snd="bgm"]'), lab=d.querySelector('#sndRowB [data-snd-v="bgm"]');
  check('Sliders show the current value (both rows)',r&&String(r.value)==='35'&&lab&&lab.textContent==='35%',{v:r&&r.value,lab:lab&&lab.textContent});
  check('DEFAULTS in the teacher block have bgmVol 70 · sfxVol 100 · ambVol 80 (BGM a little lower)',/bgmVol:\s*70,/.test(html)&&/sfxVol:\s*100,/.test(html)&&/ambVol:\s*80,/.test(html));
  check('The 🔊/🔇 button still toggles, remembers, and re-applies the master volume',/sndOn = !sndOn; audioInit\(\);[\s\S]{0,300}sndSave\('sndOn'[\s\S]{0,80}sndVolApply\(\)/.test(code));
}

/* ⑥ 노드 정리 */
{ const A=makeGame(),C=A.AUD;
  C.currentTime=5; A.sfx('treeFall'); A.sfx('rifle'); A.window.__sndPlay('brook',undefined,true);
  const made=C.srcs.filter(s=>s.t0>=5);
  check('Every voice has an onended handler that disconnects it',made.length>10&&made.every(s=>typeof s.onended==='function'));
  made.forEach(s=>s.end());
  const chainOk=made.every(s=>s.discN>0);
  const gains=C.nodes.filter(n=>n.kind==='gain'&&n.gain&&n.discN>0).length;
  check('Ending a voice disconnects the source and its filter/gain chain',chainOk&&gains>=made.length*0.8,{voices:made.length,gainsCut:gains});
  check('The live-voice counter returns to zero once all voices ended',A.AUDSTAT.made-A.AUDSTAT.ended===0,A.AUDSTAT);
  A.PL.x=0;A.PL.z=0; C.currentTime=9; const n0=A.SND_DROP.length; A.sfxAt('hit',10,0,26,0);
  check('Distance filter chains from sfxAt are queued for disconnection',A.SND_DROP.length===n0+1);
  A.G.started=true;A.G.phase='day';A.G.t=100; C.currentTime=13; A.bgmLoop(0.016);
  check('…and are disconnected by the loop once their time passed',A.SND_DROP.every(d=>d.at>13));
  check('Primitives no longer allocate a noise buffer per puff (one shared buffer)',/function noiseBuf\(\)/.test(block)&&!/function puff[\s\S]{0,300}createBuffer\(/.test(block));
}

/* ⑦ 환경음 */
{ const A=makeGame(),G=A.G,C=A.AUD,PL=A.PL;
  Object.assign(G,{started:true,phase:'day',day:3,t:100}); C.currentTime=1;
  PL.x=14;PL.z=0; const s0=C.srcs.length;
  for(let f=0;f<60*40;f++){ C.currentTime+=1/60; A.setPerf(C.currentTime*1000); A.ambTick(1/60); }
  const day=C.srcs.slice(s0);
  check('Daytime ambience plays (birds·breeze·farm animals near a farm) through the ambient bus only',day.length>0&&day.every(s=>route(s).has(A.AMBB)&&!route(s).has(A.SFXB))&&day.every(s=>s.lane==='amb'),{voices:day.length});
  let peak=0; for(let t=1;t<C.currentTime;t+=0.02) peak=Math.max(peak,day.filter(s=>s.t0<=t&&s.t1>t).length);
  check('Ambient voices stay under VOX_MAX.amb at any moment',peak<=A.VOX_MAX.amb,{peak});
  const perMin=day.length/40*60;
  check('Ambience is sparse (well under 3 voices per second on average)',perMin<180,{perMin:Math.round(perMin)});
  G.phase='night'; PL.x=0;PL.z=-30; const s1=C.srcs.length;
  for(let f=0;f<60*40;f++){ C.currentTime+=1/60; A.setPerf(C.currentTime*1000); A.ambTick(1/60); }
  check('Night ambience (crickets·owl·far wind) plays',C.srcs.length>s1);
  G.phase='day';G.t=100; PL.x=21+6;PL.z=-17; const s2=C.srcs.length; const pan0=C.nodes.length;
  for(let f=0;f<60*6;f++){ C.currentTime+=1/60; A.setPerf(C.currentTime*1000); A.ambTick(1/60); }
  check('Near the pond the brook is heard',C.srcs.length>s2);
  PL.hp=20; const beat=()=>{ const s3=C.srcs.length; for(let f=0;f<60*3;f++){ C.currentTime+=1/60; A.ambTick(1/60); } return C.srcs.slice(s3).filter(s=>route(s).has(A.SFXB)); };
  G.phase='night'; const hb=beat();
  check('Low HP (<30%) at night plays a soft heartbeat on the SFX bus',hb.length>0);
  const lo=hb.filter(s=>s.kind==='osc'&&s.frequency.value<100).length, hbF=hb.filter(s=>s.kind==='osc').map(s=>s.frequency.value);
  check('Heartbeat sits where laptop speakers can play it (no oscillator under 100Hz, a 200Hz+ harmonic)',hbF.length>0&&lo===0&&hbF.some(f=>f>=200),hbF);
  const quiet=[];
  G.phase='day'; if(beat().length) quiet.push('day');
  G.phase='night'; G.paused=true; if(beat().length) quiet.push('paused'); G.paused=false;
  G.phase='lose'; if(beat().length) quiet.push('lose');
  G.phase='win'; if(beat().length) quiet.push('win');
  G.phase='night'; A.setPop(true); if(beat().length) quiet.push('window open'); A.setPop(false);
  check('Heartbeat is silent in the day, while paused, on the win/lose screen and with a window open',quiet.length===0,quiet);
  PL.hp=100; G.phase='day';
}

/* ⑧ 배선 */
{ const has=(fn,re)=>re.test(fnSrc(fn)),A0=makeGame();
  const W=[
    ['hitNode: leaf/grit + chunk + coin per block, treeFall/rockBreak when done',has('hitNode',/'leaf'/)&&has('hitNode',/'grit'/)&&has('hitNode',/'chunk'/)&&has('hitNode',/'coin'/)&&has('hitNode',/'treeFall'/)&&has('hitNode',/'rockBreak'/)],
    ['workTick: feed scoop · broom · pry · squeak · tok/tak',has('workTick',/feedScoop/)&&has('workTick',/broom/)&&has('workTick',/pry/)&&has('workTick',/squeak/)&&has('workTick',/'tok'/)],
    ['openPop: shop door+bell · forge anvil · farm gate',has('openPop',/shopOpen/)&&has('openPop',/forgeOpen/)&&has('openPop',/farmOpen/)],
    ['buy sounds: weapon·armor·ammo·potion·trade · sell farm goods',has('buyWeapon',/'buy'/)&&has('buyArmor',/'buy'/)&&has('buyAmmo',/'buy'/)&&has('buyPotion',/'buy'/)&&has('sellFarm',/'sell'/)&&has('doTrade',/'buy'/)],
    ['buyAnimal: nope when short · coin + that animal’s voice',has('buyAnimal',/'nope'/)&&has('buyAnimal',/__sfx\(kind\)/)],
    ['unaffordable shop card press → nope (not the farm status roster)',/closest\('\.sItem\.no'\);\s*if\(t && !t\.closest\('#farmList'\)\) sfx\('nope'\)/.test(code)],
    ['farm: feedDone · cleanDone · pickDrop pop',has('farmFeed',/feedDone/)&&has('farmClean',/cleanDone/)&&has('pickDrop',/'pop'/)],
    ['crystal bite → crystalHit (glass), at most once per 0.7s',/__sfxAt\('crystalHit', 0, 0, 60, 700\)/.test(code)&&A0.SFX_GAP.crystalHit>=0.6],
    ['guests hear the crystal bite too (applySim·meta watch the synced crystal fall)',/window\.__sfxAt\('crystalHit', 0, 0, 60, 700\);\s*cryHurtT = 0\.28;/.test(fnSrc('cryGuestWatch'))
      &&/G\.crystal = \(d\.c\|\|0\)\/10; cryGuestWatch\(\);/.test(fnSrc('applySim'))&&/G\.crystal = m\.crystal; cryGuestWatch\(\);/.test(code)&&/if\(G\.host\) return;/.test(fnSrc('cryGuestWatch'))],
    ['upgrade/demolish sound travels with the build reply (heard by the one who asked)',has('applyBuildUpgrade',/snd:'upgrade'/)&&/snd:'demolish'/.test(fnSrc('handleBuildCommand'))&&has('buildReward',/c\.snd/)&&!has('applyBuildUpgrade',/__sfx\('up'\)/)],
    ['repair acknowledgement → repair',has('buildReward',/'repair'/)],
    ['lobby music runs before the game starts',/if\(!G\.started\) bgmLoop\(dt\);/.test(code)&&/\n\s+bgmLoop\(dt\);/.test(code)],
  ];
  const bad=W.filter(x=>!x[1]).map(x=>x[0]);
  check('Call sites are wired ('+W.length+' places)',bad.length===0,bad);
  const keep=[['fx2SfxReady',/Object\.assign\(SFX, \{[\s\S]*fx2Lv:/],['specSfx',/specSwap:/],['wingFxSfxReady',/wingFlap:/],['towerFxSfxReady',/towerCannon:/]];
  check('Other branches’ sounds are still added by their own blocks (FX2·SPEC·WING·tower)',keep.every(([f,re])=>re.test(fnSrc(f))));
  const A=makeGame();
  check('Zombie voices (growl·howl·heart) are not redefined by the sound branch',['growl','howl','heart'].every(k=>A.SFX[k]&&!A.SND66[k]));
}

const pass=results.filter(Boolean).length;
if(pass!==results.length){console.error(`${results.length-pass} sound checks failed.`);process.exitCode=1;}
else console.log(`${pass}/${results.length} sound checks passed. Waveforms are measured by the offline render (r66/sound).`);
