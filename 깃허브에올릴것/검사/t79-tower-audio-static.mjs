// Executes the real tower scheduling and synthesis functions. --render additionally
// renders real OfflineAudioContext waveforms in the shared hidden browser slot.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv.slice(2).find(x=>!x.startsWith('--'))||GAME,'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn};')(source);
const gunVoices=['towerRapid','towerSniper'].map(k=>source.split('\n').find(s=>s.trim().startsWith(k+':'))).join('\n');
const C=vm.createContext({Math});
vm.runInContext(`let clock=0,sndOn=true,SNDV={sfx:100},tfxSndBudget=6;const performance={now:()=>clock},PL={x:0,z:0,yaw:0},_tfxSndT={},events=[],SFX={};
let SFX_MUL=1,SFX_PAN=0,lastPan=0;const now0=()=>0;
const tone=(...a)=>events.push({type:'tone',a}),puff=(...a)=>events.push({type:'puff',a}),pluck=(...a)=>events.push({type:'pluck',a}),noise=(...a)=>events.push({type:'noise',a});
const sfx=k=>events.push({type:'schedule',k,mul:SFX_MUL,pan:SFX_PAN});
let tfxBudget=0,tfxIceT=1,tfxLiveB=0,tfxLiveC=0,tfxColB=false,tfxColC=false;
const TFX_BURST_MAX=6,TFX_RATE=14,TFX_BALL_CAP=0,TFX_CHIP_CAP=0,TFX_SHELL_CAP=0,tfxHits=[],ices=[],tfxShells=[],tfxBallMesh={},tfxChipMesh={},tfxShellMesh={};
${['towerFxSfx','towerFxSfxReady','towerFxTick','sfxFrom'].map(fn).join('\n')}
Object.assign(SFX,{${gunVoices}});
globalThis.A={PL,SFX,events,call:towerFxSfx,tick:towerFxTick,ready:towerFxSfxReady,set:(t,on=true,v=100)=>{clock=t;sndOn=on;SNDV.sfx=v;},budget:()=>tfxSndBudget,reset:()=>{events.length=0;tfxSndBudget=6;for(const k in _tfxSndT)delete _tfxSndT[k];},restore:()=>({SFX_MUL,SFX_PAN})};`,C);
const A=C.A,checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
A.ready();const keys=Object.keys(A.SFX);let profiles=[];
for(const k of keys){A.events.length=0;A.SFX[k]();const e=Array.from(A.events),voices=e.reduce((n,q)=>n+(q.type==='pluck'&&q.a[4]?2:1),0);
 const maxVol=Math.max(...e.map(q=>q.type==='tone'?q.a[4]:q.type==='pluck'?q.a[2]:q.a[1]));
 const maxDur=Math.max(...e.map(q=>q.type==='tone'?q.a[2]:q.type==='pluck'?q.a[1]:q.a[0]));profiles.push({k,voices,maxVol,maxDur,e});}
check('All ten material/attack voices are distinct, short and bounded to four source nodes',profiles.length===10&&profiles.every(p=>p.voices<=4&&p.maxVol<=.1&&p.maxDur<=.32)&&new Set(profiles.map(p=>JSON.stringify(p.e))).size===10,profiles.map(({e,...p})=>p));
A.reset();A.set(0);A.call('towerBow',0,0,26,95);A.call('towerBow',0,0,26,95);A.set(94);A.call('towerBow',0,0,26,95);A.set(95);A.call('towerBow',0,0,26,95);
check('A first shot at time zero still enforces the per-kind gap',A.events.length===2&&A.budget()===4);
A.reset();A.set(1000,false);A.call('towerBow',0,0,26,0);A.set(2000,true,0);A.call('towerCannon',0,0,34,0);A.set(3000);A.call('towerIce',27,0,26,0);A.call('towerIce',26,0,26,0);
check('Master mute, zero effects volume and out-of-range towers allocate no cue or budget',A.events.length===0&&A.budget()===6);
A.reset();A.set(4000);A.call('towerBow',0,0,26,0);A.call('towerBow',13,0,26,0);A.call('towerBow',-25.9,0,26,0);
const spatial=Array.from(A.events);check('Sound fades smoothly to silence at distance and pans left/right, then restores global multipliers',spatial.length===3&&spatial[0].mul===1&&spatial[1].mul===.5&&spatial[1].pan===.8&&spatial[2].mul<.0001&&spatial[2].pan===-.8&&A.restore().SFX_MUL===1&&A.restore().SFX_PAN===0,spatial);
A.reset();A.set(5000);for(let i=0;i<200;i++)A.call('towerBow',0,0,26,0);const burst=A.events.length;
for(let f=1;f<=60;f++){A.set(5000+f*1000/60);A.tick(1/60);for(let i=0;i<20;i++)A.call('towerRapid',0,0,24,0);}
check('Hundreds of nearby towers share six immediate tokens and at most fourteen replenished cues per second',burst===6&&A.events.length>=19&&A.events.length<=20&&A.budget()<1,{burst,totalAfterSecond:A.events.length,budget:A.budget()});
// Actual shot branch execution: sound must be called by the firing path, not just registered.
const D=vm.createContext({Math});vm.runInContext(`const events=[],GY=0,tfxShells=[{t:0}],struCX=o=>o.x,struCZ=o=>o.z,
 towerFxNear=()=>false,buildingGunMuzzle=o=>({x:o.x,y:3,z:o.z}),cannonSpec=()=>({tier:0,r:.2}),muzzleFlash=()=>{},buildStat=()=>2,towerFxLater=()=>{},
 towerFxSfx=(...a)=>events.push(a);
${fn('towerFxShot')}
globalThis.A={shot:towerFxShot,events};`,D);
for(const q of [{t:'arrow',lv:1},{t:'ice',lv:1},{t:'ice',lv:3,branch:'frost'},{t:'ice',lv:3,branch:'blizzard'},{t:'pulse',lv:1}])D.A.shot({...q,x:0,z:0},{x:2,y:0,z:7},[],[],10,false);
check('Arrow, ice, freeze, blizzard and cannon firing paths call their material-specific voices',JSON.stringify(Array.from(D.A.events,e=>e[0]))===JSON.stringify(['towerBow','towerIce','towerFreeze','towerBlizzard','towerCannon']),Array.from(D.A.events,e=>e[0]));
check('Rapid/sniper actual attack and rapid echoes use the same tower budget; audio uses the existing effects volume bus',fn('towerAttack').includes("towerFxSfx(sniper?'towerSniper':'towerRapid'")&&fn('towerFxImpact').includes("towerFxSfx('towerRapid'")&&fn('sndVolApply').includes('set(SFXB, sndCurve(SNDV.sfx))')&&fn('sfxOut').includes('sfxBus()'));
const out=path.resolve('artifacts/race79/tower-audio');fs.mkdirSync(out,{recursive:true});let waveforms=null;
if(process.argv.includes('--render')){
 const {chromium}=await import('./pw.mjs');const browser=await chromium.launch();
 try{const page=await browser.newPage();waveforms=await page.evaluate(async ({synth,voices})=>{
  const output=[];
  for(const key of ['towerBow','towerThunk','towerIce','towerFreeze','towerBlizzard','towerFrost','towerCannon','towerBoom','towerRapid','towerSniper']){
   const code=`const AUD=new OfflineAudioContext(1,44100,44100),sndOn=true,SFX_MUL=1,VOX={sfx:new Float64Array(56)},VOX_LANE='sfx',AUDSTAT={made:0,ended:0,drop:0};
    let NOISE_BUF=null;const sfxOut=()=>AUD.destination,now0=()=>AUD.currentTime,SFX={};${synth}\nObject.assign(SFX,{${voices}});towerFxSfxReady();SFX['${key}']();
    return AUD.startRendering().then(b=>({data:Array.from(b.getChannelData(0)),made:AUDSTAT.made,ended:AUDSTAT.ended}));`;
   const q=await new Function(code)();let peak=0,sum=0,tail=0;for(let i=0;i<q.data.length;i++){const v=q.data[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>22050)tail+=v*v;}
   output.push({key,peak,rms:Math.sqrt(sum/q.data.length),tail,voices:q.made,ended:q.ended,data:q.data});
  }return output;
 },{synth:['tone','pluck','puff','noise','nzl','noiseBuf','nodeEnd','voxOk','audWake','towerFxSfxReady'].map(fn).join('\n'),voices:gunVoices});
 check('Real WebAudio voices render audible nonclipping waveforms and clean up every source',waveforms.every(w=>w.peak>.005&&w.peak<.5&&w.rms>.001&&w.tail<1e-7&&w.voices<=4&&w.voices===w.ended),waveforms.map(({data,...q})=>q));
 // A quiet, separated audition reel. Offline synthesis does not play through the OS.
 const seconds=waveforms.length,buf=Buffer.alloc(44+seconds*44100*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(44100,24);buf.writeUInt32LE(88200,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(buf.length-44,40);
 waveforms.forEach((w,j)=>w.data.forEach((v,i)=>buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+(j*44100+i)*2)));fs.writeFileSync(path.join(out,'tower-voices.wav'),buf);
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,process.argv.includes('--render')?'render-results.json':'static-results.json'),JSON.stringify({checks,profiles,waveforms:waveforms?.map(({data,...q})=>q)},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} tower audio checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
