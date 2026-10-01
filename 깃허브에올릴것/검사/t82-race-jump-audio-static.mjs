/* 82차 경주 점프 소리 — 선생님: "레이싱 모드에서는 점프할 때 효과음이 폴가이즈 점프 효과음이랑 똑같았으면 좋겠어."
   녹음 파일 없이 합성한 고무 '뾰잉'(r82jump · 2단 r82jump2)이 경주에서만 나고, 마을·밤·대기실 점프 소리는 그대로인지 잰다.
   브라우저 없이: 실제 updPlayer 의 점프 줄을 떼어 경주/마을에서 부르고, 실제 소리 덩어리를 t66 의 가짜 AudioContext 위에서 부른다.
   --render: 빈 페이지의 OfflineAudioContext 로 실제 파형(세기·길이·밝기·6kHz 위)을 재고 WAV 를 artifacts/race82/jump-audio 에 남긴다. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import vm from 'node:vm';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const source=fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME,'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
const oldTest=fs.readFileSync(path.join(here,'t66-sound-static.mjs'),'utf8');
const block=source.slice(source.indexOf('/* ═══════════════════════ 소리 (파일 없이 코드로 합성)'),source.indexOf("addEventListener('pointerdown', audioInit, {once:true});"));
let domLib;for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){try{domLib=require(p);break;}catch{}}
const makeGame0=new Function('vm','domLib','source','block','fnSrc',oldTest.slice(oldTest.indexOf('const FAKE='),oldTest.indexOf('function route('))+';return makeGame;')(vm,domLib,source,block,fn);
/* 가짜 컨텍스트에 PeriodicWave 를 더한다(실제 브라우저처럼 목소리 파형을 쓰는 길을 탄다) */
const makeGame=o=>{const A=makeGame0(o),C=A.AUD,co=C.createOscillator.bind(C);C.pwN=0;
  C.createPeriodicWave=(re,im)=>{C.pwN++;return {re:[...re],im:[...im]};};
  C.createOscillator=()=>{const n=co();n.setPeriodicWave=w=>{n.wave=w;n.type='custom';};return n;};return A;};
const route=n=>{const seen=new Set(),q=[n];while(q.length){const x=q.shift();if(seen.has(x))continue;seen.add(x);for(const o of x.out)q.push(o);}return seen;};
const checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};

/* ① 배선 — 실제 updPlayer 의 점프 줄을 경주·마을에서 부른다 */
const player=fn('updPlayer'),j0=player.indexOf('if(wantJump && !raceTryJump() && canJump){'),j1=player.indexOf('\n  wantJump = false;',j0);
const jumpCode=j0>0&&j1>j0?player.slice(j0,j1):'';
const runJumps=race=>{const log=[];const C=vm.createContext({log});
  vm.runInContext(`let wantJump=true,race=${race};const raceTryJump=()=>false,raceOn=()=>race,burst=()=>{},fovPunch=()=>{},jumpNow=()=>10,jump2Now=()=>12,jMul=1,canJump=true;
    const window={__sfx:k=>log.push(k)};const PL={x:0,y:0,z:0,ground:true,jumps:0,vy:0};
    const go=()=>{ wantJump=true; ${jumpCode} };
    go(); go();`,C);return log;};
const R=runJumps(true),V=runJumps(false);
check('Race: first jump plays r82jump, the air jump plays r82jump2 (actual updPlayer jump lines)',jumpCode&&R.join()==='r82jump,r82jump2',R);
check('Village/night: the same lines still play the old jump then hop',V.join()==='jump,hop',V);
check('Lobby jump and the donut SPACE launch keep their own sounds (jump · raceBounceSound)',/sfx\('jump'\)/.test(fn('lobbyMove78'))&&/raceBounceSound\(p\.kind\)/.test(fn('raceTryJump'))&&!/r82jump/.test(fn('raceTryJump')+fn('raceBounceSound')+fn('lobbyMove78')));
check('Old village jump/hop voices are unchanged',block.includes("jump: ()=>{ tone(240, 640, 0.16, 'sine', 0.07); puff(0.04, 0.06, 900, 1.0); },")&&block.includes("hop:  ()=>{ noise(0.035,0.05,2200); tone(430,700,0.07,'sine',0.045); },"));

/* ② 합성 — 목소리 수·버스·세기·길이·음높이 곡선 */
const prof=[];
for(const k of ['r82jump','r82jump2']){const A=makeGame();A.AUD.currentTime=3;A.sfx(k);const S=A.AUD.srcs.filter(s=>s.t0>=3);
  if(!S.some(s=>s.kind==='osc')){prof.push({k,missing:true,voices:0,bad:['missing'],maxGain:0,end:1,rise:0,t95:1,dips:0,f0:0,fMax:0});continue;}
  const osc=S.filter(s=>s.kind==='osc'),boing=osc.find(s=>s.type==='custom')||osc.at(-1),fr=boing.frequency.ev.filter(e=>e[0]!=='cancel').map(e=>[e[2]-boing.t0,e[1]]);
  const lp=[...route(boing)].find(n=>n.kind==='biquad'),lpMax=lp?Math.max(lp.frequency.value,...lp.frequency.ev.map(e=>e[1])):0;
  const env=[],bad=[];for(const s of S){const r=route(s);if(!r.has(A.SFXB)||!r.has(A.BUS)||!r.has(A.AUD.destination))bad.push(s.kind);
    let x=s,g=null;for(let i=0;i<6&&x;i++){x=x.out[0];if(!x||x===A.SFXB)break;if(x.kind==='gain')g=x;}env.push(g?g.gain.max:0);}
  const fMax=Math.max(...fr.map(e=>e[1])),i0=fr.findIndex(e=>e[0]>=.02);let dips=0;for(let i=Math.max(1,i0);i<fr.length;i++)if(fr[i][1]<fr[i-1][1]-1)dips++;
  prof.push({k,voices:S.length,bad,maxGain:+Math.max(...env).toFixed(3),end:+(Math.max(...S.map(s=>s.t1))-3).toFixed(3),wave:boing.type,waves:A.AUD.pwN,
    f0:Math.round(fr[0][1]),fMax:Math.round(fMax),rise:+(fMax/fr[0][1]).toFixed(2),t95:+(fr.find(e=>e[1]>=.95*fMax)?.[0]??1).toFixed(3),dips,lp:lp&&lp.type,lpMax:Math.round(lpMax)});}
const [P1,P2]=prof;
check('Each race jump is at most three short voices, all through the effects bus → master compressor → speakers',prof.every(p=>p.voices>=2&&p.voices<=3&&p.bad.length===0),prof.map(p=>({k:p.k,voices:p.voices,bad:p.bad})));
check('Quiet enough for 21 laptops: loudest voice ≤ 0.05 (old jump 0.07) and every voice has stopped by 0.27 s',prof.every(p=>p.maxGain>0&&p.maxGain<=.05&&p.end<=.27),prof.map(p=>({k:p.k,maxGain:p.maxGain,end:p.end})));
check('Rubber "bwip": pitch springs up ≥2.3× within 0.1 s, then wobbles (goes down again at least twice) instead of a straight glide',prof.every(p=>p.rise>=2.3&&p.t95<=.1&&p.dips>=2),prof.map(p=>({k:p.k,f0:p.f0,fMax:p.fMax,t95:p.t95,dips:p.dips})));
check('Vocal colour: soft six-harmonic wave (one PeriodicWave per context) through a resonant low-pass capped at 4.2 kHz',prof.every(p=>p.wave==='custom'&&p.waves===1&&p.lp==='lowpass'&&p.lpMax<=4200));
check('The air (double) jump is higher than the first jump',P2.f0>P1.f0*1.2&&P2.fMax>P1.fMax*1.2,{first:[P1.f0,P1.fMax],air:[P2.f0,P2.fMax]});
{const A=makeGame();A.AUD.currentTime=2;A.sfx('r82jump');const osc=A.AUD.srcs.filter(s=>s.kind==='osc'),n=osc.length;
  const B=makeGame0();B.AUD.currentTime=2;B.sfx('r82jump');const bo=B.AUD.srcs.filter(s=>s.kind==='osc');
  check('Without PeriodicWave support the voice falls back to a triangle (same notes, no crash)',n===2&&bo.length===2&&bo.some(s=>s.type==='triangle'));}
{const f0=[];for(let i=0;i<40;i++){const A=makeGame();A.AUD.currentTime=1;A.sfx('r82jump');const b=A.AUD.srcs.find(s=>s.type==='custom');f0.push(b?b.frequency.ev[0][1]:0);}
  const lo=Math.min(...f0),hi=Math.max(...f0);check('Each jump is detuned a little (±3%) so repeated jumps do not sound machine-like',lo>=300*.969&&hi<=300*1.031&&hi-lo>2,{lo:+lo.toFixed(1),hi:+hi.toFixed(1)});}

/* ③ 설정·상한·정리 */
{const M=makeGame();M.sndOn=false;M.sfx('r82jump');M.sfx('r82jump2');check('Master mute (🔇) schedules no voice',M.AUDSTAT.made===0);}
{const A=makeGame({store:{sndSfx:'0'}});A.AUD.currentTime=1;A.sfx('r82jump');const S=A.AUD.srcs;
  check('Effects volume slider controls it: every voice passes SFXB, whose gain is the saved effects volume (0 → silent)',S.length>0&&S.every(s=>route(s).has(A.SFXB))&&A.SFXB.gain.value===0);}
{const A=makeGame();A.AUD.currentTime=5;A.sfx('r82jump');A.AUD.currentTime=5.03;A.sfx('r82jump');const n1=A.AUD.srcs.length;A.AUD.currentTime=5.1;A.sfx('r82jump');A.AUD.currentTime=5.11;A.sfx('r82jump2');
  check('Same-sound gap 0.06 s (a double press in one frame plays once); the air jump right after still plays',A.SFX_GAP.r82jump>=.05&&A.SFX_GAP.r82jump2>=.05&&n1===3&&A.AUD.srcs.length===3+3+2,{n1,total:A.AUD.srcs.length});}
{const A=makeGame();for(let i=0;i<80;i++){A.AUD.currentTime=10+i*.02;A.sfx('rifle');}const s0=A.AUD.srcs.length,sk=A.AUDSTAT.skip;A.AUD.currentTime=10+79*.02+.001;A.sfx('r82jump');
  const live=t=>A.AUD.srcs.filter(s=>s.t0<=t&&s.t1>t).length;let pk=0;for(let t=10;t<12;t+=.005)pk=Math.max(pk,live(t));
  check('Voice cap still holds when the lane is full (jump is skipped whole, never over VOX_MAX)',pk<=A.VOX_MAX.sfx&&(A.AUD.srcs.length-s0===0?A.AUDSTAT.skip>sk:true),{peak:pk,cap:A.VOX_MAX.sfx,made:A.AUD.srcs.length-s0});}
{const A=makeGame();A.AUD.currentTime=4;A.sfx('r82jump');A.AUD.currentTime=4.3;A.sfx('r82jump2');const S=A.AUD.srcs;S.forEach(s=>s.end());
  check('Every voice disconnects itself (source · filter · gain) when it ends',S.length===5&&S.every(s=>s.discN>0)&&A.AUDSTAT.made===A.AUDSTAT.ended,{voices:S.length,made:A.AUDSTAT.made,ended:A.AUDSTAT.ended});}
check('A new audio context gets its own voice wave (audReset clears it)',/RJ82_W = null/.test(fn('audReset')));

/* ④ --render: 실제 파형(빈 페이지의 OfflineAudioContext, 게임의 소리 덩어리 그대로) */
const out=path.resolve('artifacts/race82/jump-audio');fs.mkdirSync(out,{recursive:true});let render=null;
if(process.argv.includes('--render')){
 const {chromium}=await import('./pw.mjs');const browser=await chromium.launch();
 try{const page=await browser.newPage();render=await page.evaluate(async({block})=>{
  const pre=`const document={hidden:false,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}},localStorage={getItem:()=>null,setItem:()=>{}},window={DEFAULTS:{bgmVol:70,sfxVol:100,ambVol:80}};
   const G={started:true,phase:'day',day:1,t:120,paused:false,set:{daySec:140,nightSec:130,crystalMax:200},wolves:[],crystal:200,mini:null},PL={x:0,z:0,yaw:0,hp:100,down:false};
   const popOpen=()=>false,waiting78=()=>false,miniOn=()=>false,raceOn=()=>false,bossIndex=()=>-1;let clock=0;`;
  const SR=44100,SEG=.8,cues=['jump','r82jump','r82jump2','hop'];
  const run=dry=>new Function('SR','SEG','cues','DRY',pre+block+`
   const REAL=new OfflineAudioContext(1,Math.ceil(SR*SEG*(cues.length+1)),SR);
   AUD=new Proxy(REAL,{get(t,k){if(k==='currentTime')return clock;const v=t[k];return typeof v==='function'?v.bind(t):v;}});audReset();busIn();
   if(DRY){SFXB.disconnect();SFXB.connect(REAL.destination);}
   clock=.02;sfx('click');cues.forEach((k,i)=>{clock=(i+1)*SEG+.02;sfx(k);});
   return REAL.startRendering().then(b=>Array.from(b.getChannelData(0)));`)(SR,SEG,cues,dry);
  const wet=await run(false),dry=await run(true),res={};
  const dft=(x,f)=>{let re=0,im=0;for(let i=0;i<x.length;i++){const a=2*Math.PI*f*i/SR;re+=x[i]*Math.cos(a);im-=x[i]*Math.sin(a);}return re*re+im*im;};
  cues.forEach((k,i)=>{const a=Math.floor((i+1)*SEG*SR),b=Math.floor((i+2)*SEG*SR),w=wet.slice(a,b),d=dry.slice(a,b);
   let pk=0,s=0,dpk=0;for(const v of w){pk=Math.max(pk,Math.abs(v));s+=v*v;}for(const v of d)dpk=Math.max(dpk,Math.abs(v));
   const idx=[];d.forEach((v,j)=>{if(Math.abs(v)>dpk*.01)idx.push(j);});
   const seg=d.slice(0,Math.floor(.25*SR)).map((v,j,arr)=>v*(.5-.5*Math.cos(2*Math.PI*j/arr.length)));
   let num=0,den=0,hi=0;for(let f=50;f<=11000;f+=50){const p=dft(seg,f);num+=f*p;den+=p;if(f>6000)hi+=p;}
   res[k]={peak:+pk.toFixed(4),rms:+Math.sqrt(s/w.length).toFixed(5),span40:+((idx.at(-1)-idx[0])/SR).toFixed(3),centroid:Math.round(num/den),above6k:+(10*Math.log10(hi/den+1e-12)).toFixed(1)};});
  return {res,wet,SR,SEG};
 },{block});
 const r=render.res;
 check('Rendered race jump is audible and never clips (0.01 < peak < 0.35), like the other race sounds',['r82jump','r82jump2'].every(k=>r[k].peak>.01&&r[k].peak<.35),r);
 check('Short: the dry sound lasts 0.12–0.26 s above −40 dB',['r82jump','r82jump2'].every(k=>r[k].span40>=.12&&r[k].span40<=.26),{first:r.r82jump.span40,air:r.r82jump2.span40});
 check('Brighter than the old thud (spectral centroid ≥ 2× old jump) yet almost nothing above 6 kHz (< −40 dB)',r.r82jump.centroid>=2*r.jump.centroid&&['r82jump','r82jump2'].every(k=>r[k].above6k<-40),{old:r.jump.centroid,first:r.r82jump.centroid,air:r.r82jump2.centroid});
 const d=render.wet.slice(Math.floor(render.SEG*render.SR)),buf=Buffer.alloc(44+d.length*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(render.SR,24);buf.writeUInt32LE(render.SR*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(buf.length-44,40);d.forEach((v,i)=>buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));
 fs.writeFileSync(path.join(out,'old-jump_race-jump_race-air-jump_old-hop.wav'),buf);
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,process.argv.includes('--render')?'render-results.json':'static-results.json'),JSON.stringify({checks,prof,render:render&&render.res},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} race jump audio checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
