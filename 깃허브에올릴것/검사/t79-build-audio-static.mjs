// Real construction beat calls and synthesis; optional offline audition.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import vm from 'node:vm';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const source=fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME,'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
const oldTest=fs.readFileSync(path.join(here,'t66-sound-static.mjs'),'utf8');
const block=source.slice(source.indexOf('/* ═══════════════════════ 소리 (파일 없이 코드로 합성)'),source.indexOf("addEventListener('pointerdown', audioInit, {once:true});"));
let domLib;for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){try{domLib=require(p);break;}catch{}}
const makeGame=new Function('vm','domLib','source','block','fnSrc',oldTest.slice(oldTest.indexOf('const FAKE='),oldTest.indexOf('function route('))+';return makeGame;')(vm,domLib,source,block,fn);
const checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
const C=vm.createContext({});vm.runInContext(`${decl('TOK_GAP')}let work,clock=0;const events=[],window={__sfx:(k,a)=>events.push({k,a,t:clock})};${fn('workTick')}
globalThis.A={run(kind,dt,fw){work={kind,fw,prog:0,tok:-1};clock=0;events.length=0;while(clock<6){clock+=dt;if(workTick(dt,6))break;}return{events:events.slice(),progress:work.prog,time:clock};}};`,C);
let beats=true,timing=true;const routes=[];
for(const kind of ['coop','build','up','repair'])for(const dt of [1/30,1/60,1/120]){const q=C.A.run(kind,dt);beats&&=q.events.length===15&&q.events.every((e,i)=>e.k==='buildKnock79'&&e.a===(i&1)&&Math.abs(e.t-i*.42)<=dt+1e-8);timing&&=q.time>=6&&q.time<=6+dt+1e-8&&Math.abs(q.time-q.progress)<1e-8;routes.push({kind,dt,beats:q.events.length});}
check('Construction, assistance, upgrade and repair use the original 0.42-second tool beats at 30/60/120 FPS',beats&&timing,routes);
const feed=C.A.run('farm',1/60,'feed'),clean=C.A.run('farm',1/60,'clean'),del=C.A.run('del',1/60),revive=C.A.run('revive',1/60);
check('Farm, demolition, revive and shared UI/countdown tick sounds retain their original routes',feed.events.every(e=>e.k==='feedScoop')&&clean.events.every(e=>e.k==='broom')&&del.events.every(e=>['tak','pry'].includes(e.k))&&revive.events.every(e=>['tok','tak'].includes(e.k))&&fn('raceTick').includes("__sfx('tak')"));
const profiles=[];for(const hard of [0,1]){const A=makeGame();A.sfx('buildKnock79',hard);const src=A.AUD.srcs,peakGain=Math.max(...src.map(n=>(n._b?.kind==='gain'?n._b:n._a).gain.max));profiles.push({hard,voices:src.length,peakGain,end:Math.max(...src.map(n=>n.t1)),types:src.map(n=>n.type)});}
check('Each wooden hammer stroke uses three short bounded sources with warm body, dry contact and timber resonance',profiles.every(p=>p.voices===3&&p.peakGain<.09&&p.end<=.14),profiles);
const A=makeGame();for(let i=0;i<600;i++){A.AUD.currentTime=i*.01;A.sfx('buildKnock79',i&1);}const cues=A.AUD.srcs.length/3;for(const s of A.AUD.srcs)s.end();
check('Duplicate callers are limited to one cue per 0.30 seconds and every source disconnects',cues>=19&&cues<=20&&A.AUDSTAT.made===A.AUDSTAT.ended,{cues,sources:A.AUDSTAT.made});
const M=makeGame();M.sndOn=false;M.sfx('buildKnock79',1);check('Master mute schedules no wood voice; normal effects bus controls the dedicated sound',M.AUDSTAT.made===0&&fn('sndVolApply').includes('set(SFXB, sndCurve(SNDV.sfx))')&&!fn('friendGun').includes('buildKnock79'));
const out=path.resolve('artifacts/race79/build-audio');fs.mkdirSync(out,{recursive:true});let render=null;
if(process.argv.includes('--render')){
 const {chromium}=await import('./pw.mjs');const browser=await chromium.launch();
 try{const page=await browser.newPage();render=await page.evaluate(async({block})=>{
  const pre=`const document={hidden:false,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}},localStorage={getItem:()=>null,setItem:()=>{}},window={DEFAULTS:{bgmVol:70,sfxVol:100,ambVol:80}};
   const G={started:true,phase:'day',day:1,t:120,paused:false,set:{daySec:140,nightSec:130,crystalMax:200},wolves:[],crystal:200,mini:null},PL={x:0,z:0,yaw:0,hp:100,down:false};
   const popOpen=()=>false,waiting78=()=>false,miniOn=()=>false,raceOn=()=>false,bossIndex=()=>-1;`;
  const code=pre+'\nlet clock=0;\n'+block.replace('const now0 = ()=> AUD ? AUD.currentTime : 0;','const now0 = ()=> clock;')+`\nAUD=new OfflineAudioContext(1,Math.ceil(5.4*22050),22050);audReset();busIn();
   for(let i=0;i<10;i++){clock=.12+i*.42;SFX.buildKnock79(i&1);}
   return AUD.startRendering().then(b=>({data:Array.from(b.getChannelData(0)),made:AUDSTAT.made,ended:AUDSTAT.ended,drop:AUDSTAT.drop}));`;
  const q=await new Function(code)();let peak=0,sum=0,tail=0;for(let i=0;i<q.data.length;i++){const v=q.data[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>4.8*22050)tail+=v*v;}
  return{...q,peak,rms:Math.sqrt(sum/q.data.length),tail};
 },{block});
 check('Actual ten-stroke WebAudio phrase is audible, non-clipping, and releases all thirty voices',render.peak>.01&&render.peak<.35&&render.rms>.001&&render.made===30&&render.ended===30&&render.drop===0&&render.tail<1e-7,(({data,...q})=>q)(render));
 const buf=Buffer.alloc(44+render.data.length*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(22050,24);buf.writeUInt32LE(44100,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(buf.length-44,40);render.data.forEach((v,i)=>buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));fs.writeFileSync(path.join(out,'wood-construction.wav'),buf);
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,process.argv.includes('--render')?'render-results.json':'static-results.json'),JSON.stringify({checks,profiles,render:render&&(({data,...q})=>q)(render)},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} building audio checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
