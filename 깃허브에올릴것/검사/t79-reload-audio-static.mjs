// Real reload synthesis and existing beat scheduling. Browser-free by default;
// --render uses the serial hidden browser slot for OfflineAudioContext only.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME,'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
const voices=source.slice(source.indexOf('  g68rlOut: (a)=>'),source.indexOf('  /* 레어·유니크 명중의 한 줌'));
const kinds=['box','drum','belt','tube','tubeL','clip','cell','tank','pouch','rod','arrow'];
const keys=['g68rlOut','g68rlIn','g68rlRack'],events=[],C=vm.createContext({Math,events});
vm.runInContext(`const now0=()=>1;
const puff=(...a)=>events.push({type:'puff',a}),tone=(...a)=>events.push({type:'tone',a}),pluck=(...a)=>events.push({type:'pluck',a}),
hush=(...a)=>events.push({type:'hush',a}),swoosh=(...a)=>events.push({type:'swoosh',a}),thump=(...a)=>events.push({type:'thump',a});
${fn('reloadClack79')}
globalThis.SFX={${voices}};`,C);
const checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
const vol=e=>e.a[e.type==='tone'?4:e.type==='pluck'?2:e.type==='thump'?3:1];
const duration=e=>e.a[e.type==='tone'||e.type==='thump'?2:e.type==='pluck'?1:0];
const when=e=>e.a[e.type==='tone'||e.type==='swoosh'?5:e.type==='pluck'?3:4];
const profiles=[];let halfOK=true;
for(let k=0;k<kinds.length;k++)for(const key of keys){
 events.length=0;C.SFX[key](k);const full=structuredClone(events);events.length=0;C.SFX[key](k+16);const half=structuredClone(events);
 halfOK&&=full.length===half.length&&full.every((e,i)=>half[i].type===e.type&&Math.abs(vol(half[i])*2-vol(e))<1e-12&&when(e)===when(half[i])&&duration(e)===duration(half[i]));
 profiles.push({kind:kinds[k],key,voices:full.reduce((n,e)=>n+(e.type==='pluck'&&e.a[4]?2:1),0),maxVol:Math.max(...full.map(vol)),end:Math.max(...full.map(e=>when(e)-1+duration(e))),events:full});
}
check('All 33 material/phase voices exist, end promptly, and use at most four source nodes',profiles.length===33&&profiles.every(p=>p.voices>0&&p.voices<=4&&p.maxVol<=.12&&p.end<=.5),profiles.map(({events,...p})=>p));
check('Conventional metal reloads use nonperiodic contact/scrape noise, never musical oscillators',profiles.filter(p=>kinds.indexOf(p.kind)<6||p.kind==='rod').every(p=>p.events.every(e=>['puff','swoosh','hush'].includes(e.type)))&&fn('reloadClack79').includes("'lowpass'")&&!fn('reloadClack79').includes('tone('));
check('The quieter in-shot reload applies exact half gain to every primitive, including pump and lever',halfOK);
const signatures=kinds.map(kind=>JSON.stringify(profiles.filter(p=>p.kind===kind).map(p=>p.events)));
check('Eleven loading mechanisms have distinct three-phase sound profiles',new Set(signatures).size===11);
check('Local reload and one-shot actions use the existing phase events; remote animation remains silent',
 fn('rlTick').includes('window.__sfx(RL_SND[RL.b], RLK[C.rk])')&&fn('heldMotion').includes('window.__sfx(nm, RLK[C.rk] + 16)')&&!fn('friendGun').includes('__sfx'));
check('Existing mute, effects-volume bus, voice cap, and same-cue gaps remain connected',fn('puff').includes('!sndOn')&&fn('tone').includes('!sndOn')&&fn('puff').includes('voxOk')&&fn('sfxOut').includes('sfxBus()')&&fn('sndVolApply').includes('set(SFXB, sndCurve(SNDV.sfx))')&&keys.every(k=>decl('SFX_GAP').includes(k+':0.05')&&!decl('GUN68_LOUD').includes(k)));
// Execute actual rlTick with all magazine weapons at several frame rates. No
// duplicated audio hooks are permitted, and cancel must suppress later phases.
const D=vm.createContext({Math});
vm.runInContext(`${['WEAPONS','GUN_CYCLE','RLK','RL_SND','RL'].map(decl).join('\n')}
const KIT={wpn:0,mag:[],ammo:1000},PL={down:false},G={day:1},hudPrev={kit:''};let aimMode=true,gunT=1,throwing=false,throwCd=0,mini=false,clock=0;
const events=[],window={__sfx:(k,a)=>events.push({k,a,t:clock})},miniOn=()=>mini,popOpen=()=>false,
magNow=()=>0,wpnMag=w=>w.mag,rlOn=()=>RL.w>=0,heldActStop=()=>{},magHudRl=()=>{},toast=()=>{},
rlCancel=()=>{RL.w=-1;},rlStart=()=>{};
${fn('rlTick')}
globalThis.A={WEAPONS,GUN_CYCLE,events,run(w,dt,cancel){KIT.wpn=w;KIT.mag=[];clock=0;events.length=0;mini=false;
Object.assign(RL,{w,t:WEAPONS[w].rl,T:WEAPONS[w].rl,b:0});
for(let i=0;i<Math.ceil((WEAPONS[w].rl+.1)/dt);i++){clock+=dt;if(cancel&&clock>WEAPONS[w].rl*.35)mini=true;rlTick(dt);}
return events.slice();}};`,D);
let beatOK=true,cancelOK=true,count=0;
for(let w=0;w<D.A.WEAPONS.length;w++){const weapon=D.A.WEAPONS[w];if(weapon.mag<=1)continue;
 for(const dt of [1/30,1/60,1/120]){const ev=Array.from(D.A.run(w,dt,false)),want=D.A.GUN_CYCLE[w];count++;
  beatOK&&=ev.length===3&&ev.every((e,i)=>e.k===keys[i]&&Math.abs(e.t-weapon.rl*want.beats[i])<=dt+1e-8);
  const canceled=Array.from(D.A.run(w,dt,true));cancelOK&&=canceled.length===1&&canceled[0].k===keys[0];
 }}
check('Actual reload timing emits exactly three ordered cues at 30/60/120 FPS for every magazine weapon',beatOK,{runs:count});
check('Canceling actual reload after the first action suppresses remaining sound phases',cancelOK,{runs:count});
const out=path.resolve('artifacts/race79/reload-audio');fs.mkdirSync(out,{recursive:true});let renders=null,audition=null;
if(process.argv.includes('--render')){
 const {chromium}=await import('./pw.mjs');const browser=await chromium.launch();
 try{const page=await browser.newPage();renders=await page.evaluate(async({synth,voices,kinds,keys})=>{
  const output=[];
  async function render(k,half=false,mute=false,bus=1,burst=false){
   const code=`const AUD=new OfflineAudioContext(1,88200,44100),sndOn=${!mute},SFX_MUL=1,VOX={sfx:new Float64Array(56)},VOX_LANE='sfx',AUDSTAT={made:0,ended:0,drop:0};
    let NOISE_BUF=null,SHAPE_C=null,clock=.08,seed=123;const Math=Object.create(globalThis.Math);Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    let oscillators=0;const originalOsc=AUD.createOscillator.bind(AUD);AUD.createOscillator=()=>{oscillators++;return originalOsc();};
    const bus=AUD.createGain();bus.gain.value=${bus};bus.connect(AUD.destination);const sfxOut=()=>bus,now0=()=>clock;
    ${synth}\nconst SFX={${voices}};
    ${burst?`for(let n=0;n<100;n++)SFX.g68rlIn(4);`:`for(const [i,key] of ${JSON.stringify(keys)}.entries()){clock=[.08,.45,.85][i];SFX[key](${k+(half?16:0)});}`}
    return AUD.startRendering().then(b=>({data:Array.from(b.getChannelData(0)),made:AUDSTAT.made,ended:AUDSTAT.ended,drop:AUDSTAT.drop,oscillators,seed}));`;
   const q=await new Function(code)();let peak=0,sum=0,tail=0,diff=0,prev=0;
   for(let i=0;i<q.data.length;i++){const v=q.data[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;diff+=(v-prev)*(v-prev);prev=v;if(i>66150)tail+=v*v;}
   return {...q,peak,rms:Math.sqrt(sum/q.data.length),tail,roughness:sum?diff/sum:0};
  }
  for(let k=0;k<kinds.length;k++){const full=await render(k),half=await render(k,true);let ix=0;for(let i=1;i<half.data.length;i++)if(Math.abs(half.data[i])>Math.abs(half.data[ix]))ix=i;output.push({kind:kinds[k],...full,halfPeak:half.peak,halfRms:half.rms,halfSeed:half.seed,halfPeakTime:ix/44100,fullAtHalfPeak:full.data[ix]});}
  return {profiles:output,mute:await render(0,false,true),busMute:await render(0,false,false,0),quarter:await render(0,false,false,.25),burst:await render(0,false,false,1,true)};
 },{synth:['tone','pluck','puff','hush','swoosh','thump','noiseBuf','nodeEnd','voxOk','audWake','reloadClack79'].map(fn).join('\n'),voices,kinds,keys});
 check('Real WebAudio renders all mechanisms without clipping or lingering tails, then cleans up sources',renders.profiles.every(q=>q.peak>.005&&q.peak<.35&&q.rms>.0005&&q.tail<1e-8&&q.made<=12&&q.made===q.ended&&q.drop===0),renders.profiles.map(({data,...q})=>q));
 check('Actual metal reload waveforms create zero oscillators after rejection of the first musical-sounding draft',renders.profiles.filter(q=>kinds.indexOf(q.kind)<6||q.kind==='rod').every(q=>q.oscillators===0),renders.profiles.filter(q=>kinds.indexOf(q.kind)<6||q.kind==='rod').map(q=>({kind:q.kind,oscillators:q.oscillators})));
 // Gain targets above are exactly half. Existing exponential envelopes retain
 // a .0001 floor, so mixed-waveform peaks need not be exactly half (+/-2.5%).
 check('Real half-gain, master mute and effects bus volume work; source overflow is capped at 56',renders.profiles.every(q=>Math.abs(q.halfPeak/q.peak-.5)<.025)&&renders.mute.made===0&&renders.mute.peak===0&&renders.busMute.peak===0&&Math.abs(renders.quarter.peak/renders.profiles[0].peak-.25)<1e-5&&renders.burst.made===56&&renders.burst.ended===56&&renders.burst.drop>0,{mutedNodes:renders.mute.made,busMutePeak:renders.busMute.peak,quarterGain:renders.quarter.peak/renders.profiles[0].peak,burstSources:renders.burst.made,burstDropped:renders.burst.drop});
 // User audition: actual weapon phase timings and complete game effects bus,
 // compressor, echo and default volume. No normalization or boosted sample.
 // Keep the rejected v1 sample intact. Rifle, pump, drum: two seconds each.
 const schedules=[3,9,10].map((w,j)=>({weapon:D.A.WEAPONS[w].n,kind:kinds.indexOf(D.A.GUN_CYCLE[w].rk),times:Array.from(D.A.GUN_CYCLE[w].beats,b=>j*2+.08+b*D.A.WEAPONS[w].rl)}));
 const block=source.slice(source.indexOf('/* ═══════════════════════ 소리 (파일 없이 코드로 합성)'),source.indexOf("addEventListener('pointerdown', audioInit, {once:true});"));
 audition=await page.evaluate(async({block,schedules,keys})=>{
  const pre=`const document={hidden:false,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}},localStorage={getItem:()=>null,setItem:()=>{}},window={DEFAULTS:{bgmVol:70,sfxVol:100,ambVol:80}};
   const G={started:true,phase:'day',day:1,t:120,paused:false,set:{daySec:140,nightSec:130,crystalMax:200},wolves:[],crystal:200,mini:null},PL={x:0,z:0,yaw:0,hp:100,down:false};
   const popOpen=()=>false,waiting78=()=>false,miniOn=()=>false,raceOn=()=>false,bossIndex=()=>-1;`;
  const code=pre+'\nlet clock=0;\n'+block.replace('const now0 = ()=> AUD ? AUD.currentTime : 0;','const now0 = ()=> clock;')+`\nAUD=new OfflineAudioContext(1,264600,44100);audReset();busIn();
   for(const row of ${JSON.stringify(schedules)})for(let i=0;i<3;i++){clock=row.times[i];SFX[${JSON.stringify(keys)}[i]](row.kind);}
   return AUD.startRendering().then(b=>({data:Array.from(b.getChannelData(0)),made:AUDSTAT.made,ended:AUDSTAT.ended,drop:AUDSTAT.drop}));`;
  const q=await new Function(code)();let peak=0,sum=0,tail=0;for(let i=0;i<q.data.length;i++){const v=q.data[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>5.9*44100)tail+=v*v;}
  return{...q,peak,rms:Math.sqrt(sum/q.data.length),tail,schedules};
 },{block,schedules,keys});
 check('Six-second audition uses actual reload beats and unmodified game bus without normalization',audition.peak>.005&&audition.peak<.35&&audition.made===30&&audition.ended===30&&audition.drop===0&&audition.tail<1e-7,(({data,...q})=>q)(audition));
 const buf=Buffer.alloc(44+audition.data.length*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(44100,24);buf.writeUInt32LE(88200,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(buf.length-44,40);
 audition.data.forEach((v,i)=>buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));fs.writeFileSync(path.join(out,'reload-metal-v2.wav'),buf);
 }finally{await browser.close();}
}
const compact=q=>q&&Object.fromEntries(Object.entries(q).filter(([k])=>k!=='data'));
fs.writeFileSync(path.join(out,process.argv.includes('--render')?'render-results.json':'static-results.json'),JSON.stringify({checks,profiles,audition:compact(audition),renders:renders&&{profiles:renders.profiles.map(compact),mute:compact(renders.mute),busMute:compact(renders.busMute),quarter:compact(renders.quarter),burst:compact(renders.burst)}},null,2));
console.log(`${checks.filter(q=>q.pass).length}/${checks.length} reload audio checks passed.`);process.exitCode=checks.every(q=>q.pass)?0:1;
