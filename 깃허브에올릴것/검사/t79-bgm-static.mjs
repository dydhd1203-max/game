// Executes the real scheduler, instruments and buses. --render produces original
// eight-bar phrases in OfflineWebAudio (serial browser slot, no OS playback).
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import vm from 'node:vm';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const source=fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME,'utf8');
const oldTest=fs.readFileSync(path.join(here,'t66-sound-static.mjs'),'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn};')(source);
const block=source.slice(source.indexOf('/* ═══════════════════════ 소리 (파일 없이 코드로 합성)'),source.indexOf("addEventListener('pointerdown', audioInit, {once:true});"));
let domLib;for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){try{domLib=require(p);break;}catch{}}
if(!domLib)throw Error('linkedom is required');
const makeGame=new Function('vm','domLib','source','block','fnSrc',oldTest.slice(oldTest.indexOf('const FAKE='),oldTest.indexOf('function route('))+';return makeGame;')(vm,domLib,source,block,fn);
const kinds=['day1','day2','day3','night','boss'],checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
const G=makeGame(),table=G.BGM_SC;
const summary=kinds.map(k=>{const S=table[k],notes=S.mel.flat().filter(n=>n>=0),freqs=notes.map(n=>S.root*2**(n/12)).sort((a,b)=>a-b);return{k,density:notes.length/64,medianHz:freqs[Math.floor(freqs.length/2)],seconds:64*S.step(0,.5)};});
check('Day motifs have bright question/answer phrases; nights have lower register and breathing room',summary.slice(0,3).every(q=>q.density>.70&&q.medianHz>340)&&summary.slice(3).every(q=>q.density<.7&&q.medianHz<280),summary);
const a=table.day1.mel[0];check('Day one opens with the same rhythmic motif answered a fourth higher',a.slice(0,8).every((n,i)=>n<0?a[i+8]===-1:a[i+8]===n+5)&&table.day1.mel[1].at(-1)===0);
const loads=[];
for(const k of kinds){const A=makeGame(),h=1,sec=256*A.BGM_SC[k].step(0,h);A.bgmRender(k,sec,h,.05);
 const srcs=A.AUD.srcs.filter(n=>n.lane==='bgm'),events=[];for(const n of srcs)events.push([n.t0,1],[n.t1,-1]);events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let live=0,peak=0;for(const e of events){live+=e[1];peak=Math.max(peak,live);}
 const perLoop=Array.from({length:4},(_,i)=>srcs.filter(n=>n.t0>=i*sec/4&&n.t0<(i+1)*sec/4).length);
 for(const n of srcs)n.end();loads.push({k,peak,drop:A.AUDSTAT.drop,perLoop,remaining:A.AUDSTAT.made-A.AUDSTAT.ended});
}
check('All five arrangements stay within 28 simultaneous BGM sources over four variations, with no dropped notes or leaks',loads.every(q=>q.peak<=28&&q.drop===0&&q.remaining===0&&Math.max(...q.perLoop)<Math.min(...q.perLoop)*1.9),loads);
const M=makeGame();M.sndOn=false;M.bgmRender('day1',16,0,.05);check('Master mute creates no scheduled instrument source',M.AUDSTAT.made===0);
check('Dedicated music instruments use the existing BGM routing; transition, pause and ducking code is shared',fn('iAdventure79').includes('bgmVoice')&&fn('bgmRun').includes("VOX_LANE = 'bgm'")&&fn('bgmSwitch').includes('BGM_XF')&&fn('bgmLoop').includes("AUD.state === 'running'")&&fn('bgmDuck').includes('setTargetAtTime(0.5'));
const out=path.resolve('artifacts/race79/bgm');fs.mkdirSync(out,{recursive:true});let renders=null;
if(process.argv.includes('--render')){
 const {chromium}=await import('./pw.mjs');const browser=await chromium.launch();
 try{const page=await browser.newPage();renders=await page.evaluate(async({block,kinds})=>{
  const output=[];
  for(const key of kinds){
   const pre=`const document={hidden:false,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}},localStorage={getItem:()=>null,setItem:()=>{}},window={DEFAULTS:{bgmVol:70,sfxVol:100,ambVol:80}};
    const G={started:true,phase:'day',day:1,t:120,paused:false,set:{daySec:140,nightSec:130,crystalMax:200},wolves:[],crystal:200,mini:null},PL={x:0,z:0,yaw:0,hp:100,down:false};
    const popOpen=()=>false,waiting78=()=>false,miniOn=()=>false,raceOn=()=>false,bossIndex=()=>-1;`;
   const code=pre+block+`\nconst key=${JSON.stringify(key)},heat=.65,seconds=BGM_SC[key].step(0,heat)*64+.05,total=seconds+3;
    AUD=new OfflineAudioContext(1,Math.ceil(total*22050),22050);audReset();busIn();const count=bgmRender(key,seconds,heat,.05);
    return AUD.startRendering().then(b=>({data:Array.from(b.getChannelData(0)),made:AUDSTAT.made,ended:AUDSTAT.ended,drop:AUDSTAT.drop,seconds,total,count}));`;
   const q=await new Function(code)();let peak=0,sum=0,tail=0,diff=0,prev=0;for(let i=0;i<q.data.length;i++){const v=q.data[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;diff+=(v-prev)*(v-prev);prev=v;if(i>(q.seconds+2)*22050)tail+=v*v;}
   output.push({key,...q,peak,rms:Math.sqrt(sum/q.data.length),tail,roughness:sum?diff/sum:0});
  }return output;
 },{block,kinds});
 check('Real eight-bar music phrases are audible, non-clipping and release every source with no dropped notes',renders.every(q=>q.peak>.004&&q.peak<.25&&q.rms>.0004&&q.drop===0&&q.made===q.ended&&q.tail<1e-7&&q.count===64),renders.map(({data,...q})=>q));
 check('Night uses a softer spectral texture and stays at a comparable, non-startling level',renders.slice(3).every(q=>q.roughness<renders[0].roughness&&q.peak<renders[0].peak*1.7));
 for(const q of renders){const buf=Buffer.alloc(44+q.data.length*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(22050,24);buf.writeUInt32LE(44100,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(buf.length-44,40);q.data.forEach((v,i)=>buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));fs.writeFileSync(path.join(out,q.key+'-phrase.wav'),buf);}
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,process.argv.includes('--render')?'render-results.json':'static-results.json'),JSON.stringify({checks,summary,loads,renders:renders?.map(({data,...q})=>q)},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} BGM checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
