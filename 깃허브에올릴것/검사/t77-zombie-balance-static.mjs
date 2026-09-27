// All real zombie spawn/attack/network paths, without a browser or source mutation.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const harness=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',harness.slice(harness.indexOf('function end('),harness.indexOf('const results=[];'))+';return {fn,decl};')(source);
const fixtures=`
 const GY=5,DIRS=[{}],GAP_HALF=6,SPAWN_R=52;let wid=1,defense=0;
 const G={day:1,started:true,paused:false,phase:'night',host:true,set:{goalDay:18,wolfPower:1},wolves:[],soldiers:[],crystal:100000};
 const PL={x:0,y:GY,z:0,hp:10000,down:false,biteT:0,hurtFx:0},uid='me',combatTotals=new Map();
 const window={},SIEGE_T={arrow:1,ice:1,barr:1,pulse:1},warnT=new Map(),hits=[];
 const gX=(g,r,o)=>o,gZ=(g,r,o)=>r,zombieRiseAt=()=>{},feed=()=>{},burst=()=>{},markHp=()=>{},warnStru=()=>{},netBuildHp=()=>{};
 const struCX=o=>o.x,struCZ=o=>o.z,onStruBroken=()=>{},delStru=()=>{},netUnbuild=()=>{},cryGuestWatch=()=>{},acceptCombat=()=>{},wolfCorpse=()=>{};
 const sheltered=()=>false,defNow=()=>defense,forward=()=>({x:0,z:1}),popDmg=(x,y,z,d)=>hits.push(d),flash=()=>{},goDown=()=>{PL.down=true;};
`;
const declarations=['WOLF_T','ZOMBIE_COMBAT','WOLF_SPD_GROW','BAL','PROG_REF','PROG_OVER','progRef','isBoss','SHEEP_BITE','SHEEP_BITE_R','SHEEP_REACH_Y'];
const functions=['zombieHit79','wolfRank','curveL','prog','spawnWolf','sheepBiteDmg','sheepHurt','biteStru','packSim','applySim'];
const program=[fixtures,...declarations.map(decl),...functions.map(fn),`globalThis.A={G,PL,WOLF_T,BAL,ZOMBIE_COMBAT,spawnWolf,sheepBiteDmg,sheepHurt,biteStru,packSim,applySim,hits,setDefense:v=>defense=v};`].join('\n');
const make=before=>{const C=vm.createContext({Math,isFinite,console,performance:{now:()=>0}});new vm.Script(before?program.replace(decl('ZOMBIE_COMBAT'),'const ZOMBIE_COMBAT=Object.freeze({hp:1,damage:1});'):program).runInContext(C);return C.A;};
const A=make(false),B=make(true),results=[];
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
const close=(a,b)=>Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b));
check('One immutable combat rule sets health ×2 and attack ×0.5',Object.isFrozen(A.ZOMBIE_COMBAT)&&A.ZOMBIE_COMBAT.hp===2&&A.ZOMBIE_COMBAT.damage===.5);
let scaled=true,unchanged=true,count=0,maxHP=0;const examples=[];
for(const goalDay of [10,15,18])for(const day of [1,5,9,12,15,18])for(const power of [.7,1,1.4])for(let k=0;k<A.WOLF_T.length;k++){
 for(const C of [A,B]){C.G.set={goalDay,wolfPower:power};C.G.day=day;C.G.wolves.length=0;}
 const w=A.spawnWolf(k,0),old=B.spawnWolf(k,0);count++;maxHP=Math.max(maxHP,w.mx);
 scaled&&=close(w.hp,old.hp*2)&&w.hp===w.mx&&close(w.dmg,old.dmg*.5)&&close(w.cd,old.cd*.5);
 unchanged&&=w.spd===old.spd&&w.bi===old.bi&&w.addLeft===old.addLeft&&w.struMul===old.struMul&&A.G.set.wolfPower===power;
 if(goalDay===18&&power===1&&(day===1&&k===0||day===18&&k===7))examples.push({day,k,hpBefore:old.hp,hp:w.hp,buildingDamageBefore:old.dmg,buildingDamage:w.dmg,crystalBefore:old.cd,crystal:w.cd});
}
check('All 13 types including five bosses scale once across days, lesson lengths and saved teacher strength values',scaled,{cases:count,maxHP,examples});
check('Movement, summoning budget, armor-zombie structure modifier and teacher settings remain unchanged',unchanged);
let summonOK=true;for(let k=0;k<A.WOLF_T.length;k++){
 const w=A.spawnWolf(k,0,23,27),old=B.spawnWolf(k,0,23,27);summonOK&&=close(w.hp,old.hp*2)&&close(w.dmg,old.dmg*.5)&&w.x>=21.7&&w.x<=24.3;
}
check('Boss-summoned/location-based spawning uses the same one-time health and damage scale',summonOK);
let bites=true,armor=true,guest=true,min=Infinity,max=0;
for(const day of [1,5,12,18])for(let k=0;k<A.WOLF_T.length;k++)for(const def of [0,35,75,100]){
 for(const C of [A,B]){C.G.day=day;C.G.wolves.length=0;C.G.host=true;C.setDefense(def);Object.assign(C.PL,{hp:10000,down:false,biteT:0,hurtFx:0});}
 const w=A.spawnWolf(k,0,0,.5),old=B.spawnWolf(k,0,0,.5);Object.assign(w,{x:0,z:.5,y:5});Object.assign(old,{x:0,z:.5,y:5});
 const before=B.sheepBiteDmg(old),raw=A.sheepBiteDmg(w);bites&&=close(raw,before*.5);min=Math.min(min,raw);max=Math.max(max,raw);
 A.sheepHurt(1/60);const loss=10000-A.PL.hp,expected=Math.max(1,Math.round(before*.5*(1-def/100)));armor&&=loss===expected;
 A.G.host=false;Object.assign(A.PL,{hp:10000,down:false,biteT:0});A.sheepHurt(1/60);guest&&=10000-A.PL.hp===loss;
}
check('Every ordinary, special and boss bite is half before the existing armor calculation',bites,{minRawBite:min,maxRawBite:max});
check('Real player damage preserves armor reduction, integer rounding and minimum-one rule',armor);
check('Host and guest player bites remain identical without another network multiplier',guest);
let structures=true;
for(let k=0;k<A.WOLF_T.length;k++)for(const t of ['wwall','swall','arrow','ice','barr','pulse']){
 const w=A.spawnWolf(k,0),old=B.spawnWolf(k,0),o={id:1,t,x:0,z:0,g:0,hp:100000,mx:100000},prior={...o};
 A.biteStru(o,w,0,0);B.biteStru(prior,old,0,0);structures&&=close(100000-o.hp,(100000-prior.hp)*.5)&&w.atkT===old.atkT;
}
check('Actual bites halve wooden/stone wall, tower and barracks losses while keeping cooldowns/modifiers',structures);
// Crystal and soldier attacks consume spawn.cd/spawn.dmg directly in hostSim.
const host=fn('hostSim'),crystalLine=host.match(/G\.crystal = Math\.max\(0, G\.crystal - w\.cd\);/),soldierLine=host.match(/s\.hp -= t\.dmg\*0\.7;/);
if(!crystalLine||!soldierLine)throw Error('Missing actual crystal or soldier hit path');
const hitCrystal=new Function('G','w',crystalLine[0]),hitSoldier=new Function('s','t',soldierLine[0]);
let victims=true;for(let k=0;k<A.WOLF_T.length;k++){
 const w=A.spawnWolf(k,0),old=B.spawnWolf(k,0),g={crystal:100000},og={crystal:100000},s={hp:100000},os={hp:100000};
 hitCrystal(g,w);hitCrystal(og,old);hitSoldier(s,w);hitSoldier(os,old);victims&&=close(100000-g.crystal,(100000-og.crystal)*.5)&&close(100000-s.hp,(100000-os.hp)*.5);
}
check('Actual crystal and allied-soldier attack expressions consume the already-halved value once',victims);
A.G.wolves.length=0;A.G.soldiers.length=0;A.G.day=18;A.G.set={goalDay:18,wolfPower:1.4};
for(let k=0;k<A.WOLF_T.length;k++){const w=A.spawnWolf(k,0);w.hp=w.mx*.37;}
const live=A.G.wolves.map(w=>({id:w.id,hp:Math.round(w.hp),mx:Math.round(w.mx)})),packet=A.packSim();A.G.wolves.length=0;A.G.host=false;A.applySim(packet);
const faithful=A.G.wolves.every((w,i)=>w.hp===live[i].hp&&w.mx===live[i].mx&&w.hpExact),boss=A.G.wolves.find(w=>w.k===7);
check('Host-to-guest actual/max HP round-trip stays exact at integer packet precision above 65,535 HP',faithful&&boss.mx>65535,{bossHP:boss.hp,bossMax:boss.mx,ratio:boss.hp/boss.mx,packetVersion:packet.v});
A.applySim(packet);check('Repeated guest snapshots never double health a second time',A.G.wolves.every((w,i)=>w.hp===live[i].hp&&w.mx===live[i].mx));
check('Boss stomp and aura presentation remains non-damaging',!/(?:PL\.hp|G\.crystal|\.dmg)/.test(fn('dreadBoss')));
const out=path.resolve(process.argv[3]||path.join(here,'artifacts/77-zombie-balance'));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));
console.log(`${results.filter(q=>q.pass).length}/${results.length} zombie balance checks passed.`);process.exitCode=results.every(q=>q.pass)?0:1;
