// Actual hit timing, stone pool, guest snapshots, and bounded sound scheduling.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8').replace(/\r\n/g,'\n');   // 윈도(CRLF)로 받아도 '\n}\n\n' 자르기가 같게
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
const checks=[],check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
const C=vm.createContext({Math});
const stoneTick=source.slice(source.indexOf('  /* 던진 돌 — 포물선으로'),source.indexOf('\n}\n\nconst _up2',source.indexOf('  /* 던진 돌 — 포물선으로')));
vm.runInContext(`let time=0;const performance={now:()=>time*1000},isBoss=k=>k>=3&&k<=7;
const uid='local',GY=0,G={host:true,crystal:100,wolves:[],soldiers:[]},WOLF_T=[],stoneDmg=()=>1,confirmKill=()=>{},zStep=()=>{},XP_KILL=1,
cryGuestWatch=()=>{},acceptCombat=()=>{},zombieRiseAt=()=>{},wolfCorpse=()=>{};
const events=[];${decl('StN')}const stones=Array.from({length:StN},()=>({t:0,on:null}));let stI=0;
const stMesh={setMatrixAt(){},instanceMatrix:{}},ZEROM={},_eu={set(){}},_q={setFromEuler(){}},_v={set(){}},_s={set(){}},_m={compose(){return{};}},burst=(...v)=>events.push({kind:'dust',v,time});
${['zombieHit79','zombieHitPose79','hostStoneHit','applySim','shootStone'].map(fn).join('\n')}
function tick(dt){const tt=time;${stoneTick}}
globalThis.A={G,events,stones,hit:zombieHit79,pose:zombieHitPose79,hostHit:hostStoneHit,apply:applySim,shoot:shootStone,tick,time:v=>{time=v;}};`,C);
const A=C.A,actor=()=>({id:1,k:0,hp:100,mx:100,x:3,y:0,z:4,ry:0,mv:true,atkT:.7});
let rateOK=true,details=[];
for(const fps of [20,30,60,120]){const w=actor();A.time(2);A.hit(w,1,0);let white=0,peak=0;
 for(let i=0;i<=fps*.6;i++){A.time(2+i/fps);peak=Math.max(peak,A.pose(w));if(w.hitGlow79)white++;}
 rateOK&&=white>=2&&peak>1&&w.hurt===0&&w.kT===0&&w.hitGlow79===0;details.push({fps,white,peak});}
check('Readable flash/recoil at 20/30/60/120 FPS always recover without changing authority state',rateOK,details);
const normal=actor(),boss={...actor(),k:3};A.time(10);A.hit(normal,2,3);A.hit(boss,2,3);A.time(10.05);const n=A.pose(normal),b=A.pose(boss);
check('Boss recoil is less than half; visual helpers preserve HP, world position and attack timer',b/n===.48&&normal.hp===100&&normal.x===3&&normal.z===4&&normal.atkT===.7,{normal:n,boss:b});
A.time(20);const hidden=actor();A.hit(hidden,0,1);A.time(30);A.pose(hidden);
check('A hidden actor returns without stale flash, recoil or hurt',hidden.hurt===0&&hidden.kT===0&&hidden.hitGlow79===0);
A.time(40);const rapid=actor();let accepted=0;for(let i=0;i<100;i++){A.time(40+i/200);accepted+=A.hit(rapid,1,0);A.pose(rapid);}
check('Rapid simultaneous hits do not restart reaction on every frame',accepted>=4&&accepted<=5,{accepted,attempted:100});
const client=actor();A.G.wolves=[client];A.G.host=false;A.time(50);
const packet=hp=>({v:2,c:1000,w:[1,0,24,32,0,hp,1,100],s:[]});A.apply(packet(90));const first=client.hitAt79;A.time(50.2);A.apply(packet(90));A.time(50.5);A.pose(client);
check('Guest HP drop triggers once; identical later snapshots do not replay or hold white',first===50&&client.hitAt79===first&&client.hitGlow79===0&&client.hurt===0);
client.hitLocalUntil79=52;A.time(51);A.apply(packet(80));
check('Own in-flight impact is not replayed early by its HP snapshot',client.hitAt79===first);
A.time(60);const host=actor();A.G.wolves=[host];A.G.host=true;A.hostHit(1,1,'local',0,7,null,'local');const ownNoFlash=host.hitAt79===undefined&&host.hp===93;
A.hostHit(1,1,'friend',0,7,null,'friend');
check('Host keeps immediate exact damage, defers own projectile picture, and reacts to friend damage',ownNoFlash&&host.hp===86&&host.hitAt79===60);
for(const s of A.stones){s.t=0;s.on=null;}A.events.length=0;let arrive=0;A.time(70);A.shoot(0,0,0,26,0,0,true,()=>{arrive++;A.events.push({kind:'hit'});});
A.tick(.99);const early=arrive;A.tick(.02);A.tick(.5);
check('A real pooled stone invokes impact exactly once on arrival with dust in the same tick',early===0&&arrive===1&&A.events.map(x=>x.kind).join(',')==='dust,hit');
A.shoot(0,0,0,1,0,0,false,()=>arrive++);A.tick(1);
check('A missed stone emits environment dust but never a hit callback',arrive===1&&A.events.at(-1).kind==='dust');
for(const s of A.stones){s.t=0;s.on=null;}let flushed=0;for(let i=0;i<40;i++)A.shoot(0,0,0,26,0,0,true,()=>flushed++);A.tick(2);A.tick(2);
check('Saturated fixed stone pool neither loses nor duplicates callbacks',flushed===40&&A.stones.length===14,{callbacks:flushed});
const dead=actor();dead.hp=0;dead.dead=.5;A.time(80);A.hit(dead,0,1,true);A.time(81);A.pose(dead);
check('Late lethal impact never resurrects or changes corpse lifetime',dead.hp===0&&dead.dead===.5&&dead.hitGlow79===0);
const fire=fn('fireWeapon');
check('Actual fireWeapon defers stone hitVis, provides normal stone sound, and preserves hit authority',fire.includes('true, hitVis)')&&!fire.includes('w.z, true); hitVis()')&&fire.includes("crit ? 'crit' : 'hit'")&&fire.includes('hostStoneHit(w.id')&&fire.includes('queueHit(w.id'));
const S=vm.createContext({Math});
vm.runInContext(`let t=0,free=56;const AUD={state:'running'},audioInit=()=>{},now0=()=>t,VOX_LANE='sfx',voxFree=()=>free,AUDSTAT={skip:0},SFX_PRIO={},SFX_LOUD={},bgmDuck=()=>{},events=[],_sfxLast={},SFX={hit:()=>events.push(t),gun:()=>events.push('gun')};${decl('SFX_GAP')}${fn('sfx')}
globalThis.A={run:sfx,events,AUDSTAT,set:(v,n)=>{t=v;free=n;},reset:()=>{events.length=0;for(const k in _sfxLast)delete _sfxLast[k];}};`,S);
const B=S.A;B.set(1,3);B.run('hit');B.run('gun');B.set(1.1,2);B.run('hit');
check('Short normal hit gets three free sources; saturated pool and ordinary sound guards remain bounded',B.events.length===1&&B.events[0]===1&&B.AUDSTAT.skip===2);
B.reset();for(let i=0;i<1000;i++){B.set(3+i/1000,56);B.run('hit');}
check('One thousand burst requests yield at most sixteen short impact cues per second',B.events.length<=16&&B.events.length>=15,{cues:B.events.length});
check('No mesh/texture/light allocation was added to the per-hit or pose paths',!/(?:new THREE|document\.|createElement|setTimeout)/.test(fn('zombieHit79')+fn('zombieHitPose79'))&&decl('VOX_MAX').includes('sfx:56')&&decl('StN').includes('14'));
const out=path.resolve('artifacts/race79/hit-feedback');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify({checks},null,2));
if(checks.some(q=>!q.pass))process.exitCode=1;
