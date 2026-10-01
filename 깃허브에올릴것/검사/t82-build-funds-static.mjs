// 82차 — "1~4일차 사이에 건물이 안 지어지던 버그": gold buildings on days with no group gold.
// Actual game functions in node VMs (no browser): the economy guard, the placement guard, the held-but-unfunded
// blueprint (input layer + host/guest fixture from t56-build-coop-static) and the Korean shortage lines.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {GAME} from './gamefile.mjs';
const source=fs.readFileSync(process.argv[2]||GAME,'utf8'),fixture=fs.readFileSync(new URL('./t56-build-coop-static.mjs',import.meta.url),'utf8');
const begin=fixture.indexOf('function end('),finish=fixture.indexOf("const H=client('host',true)");
assert.ok(begin>=0&&finish>begin);
const {client,bus,setNow,fn,dec}=new Function('source','vm',fixture.slice(begin,finish)+'return {client,bus,setNow:v=>now=v,fn,dec};')(source,vm);
const results=[];
function check(name,pass,detail){results.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));}
const costs=['BUILD','MAXLV'].map(dec).join('\n')+'\n'+source.slice(source.indexOf('const COST_MUL ='),source.indexOf('const SOL_COMP ='));
// Optional pieces so an older game file reports FAIL lines instead of stopping at the first missing helper.
const opt=(get,n)=>{try{return get(n);}catch{return '';}};
const lack=['RES_IC','RES_NM','BUILD_LACK_SRC'].map(n=>opt(dec,n)).join('\n')+'\n'+['buildLackHow','buildLackText','buildMissingCost','buildCanPay','buildLackToast'].map(n=>opt(fn,n)).join('\n');
function section(name,body){try{body();}catch(e){check(name+' (section ran)',false,String(e&&e.message||e));}}

// 1. Economy: every building must be payable on day 1 from the group's own gold veins (do not change prices here — report).
section('Economy',()=>{
  const C=vm.createContext({});
  vm.runInContext(`const NG=5,G={day:1};const base=Array.from({length:NG},()=>({w:0,s:0,o:0}));const recomputeRes=()=>{},netBase=()=>{},feed=()=>{};
   ${costs}\n${dec('START')}\n${dec('NODE_DEF')}\n${fn('dayReward')}
   const gold=[];for(let d=1;d<=5;d++){G.day=d;const b=base[0].o||0;dayReward();gold.push((base[0].o||0)-b);}
   const vein=NODE_DEF.gold.amt*NODE_DEF.gold.hits/NODE_DEF.gold.per;
   globalThis.A={start:START.o,gold,vein,cost:Object.fromEntries(Object.entries(BUILD).map(([k,b])=>[k,b.cost.g||0]))};`,C);
  const spec=/\['gold',\s*(\d+)\]/.exec(source.slice(source.indexOf('function placeNodes(')))?.[1]|0;
  const A=C.A,maxGold=Math.max(...Object.values(A.cost)),needGold=Object.entries(A.cost).filter(([,g])=>g>0).map(([k])=>k);
  // Snapshot, not a pin: the teacher may decide to give starting gold (question in the 82차 report). The refusal/hold checks below
  // use explicit wallets, so they stay valid whatever START.o becomes.
  check('Economy snapshot: gold buildings exist; start gold and day-1/2 morning gold are reported (82차: 0 · 0 · 0)',
    needGold.length>=1&&Number.isFinite(A.start)&&A.gold.length===5,{start:A.start,morningGold:A.gold,goldCosts:A.cost});
  check('Each group has gold veins that pay for the dearest building on day 1 (no building is impossible, only unfunded until mined)',
    spec>=1&&A.vein>=maxGold&&spec*A.vein>=maxGold,{veinsPerGroup:spec,goldPerVein:A.vein,maxGold});
});

// 2. Shortage lines (69차 shop grammar + where to get it).
section('Shortage lines',()=>{
  const C=vm.createContext({});vm.runInContext(`const G={phase:'day',res:[{w:0,s:0,g:0}]};${lack}
   globalThis.A={one:buildLackText([{key:'g',amount:2}]),two:buildLackText([{key:'w',amount:3},{key:'g',amount:5}]),stone:buildLackText([{key:'s',amount:7}]),
    night:buildLackText([{key:'g',amount:2}],true),nightWood:buildLackText([{key:'w',amount:1},{key:'g',amount:1}],true),none:buildLackText([]),
    missing:buildMissingCost(0,{w:0,s:0,g:2}),paid:(G.res[0].g=2,buildMissingCost(0,{w:0,s:0,g:2}))};`,C);
  const A=C.A;
  check('One shortage names the amount and the gold vein',A.one==='✨ 금 2개가 모자라요 · ⛏️ 금광맥을 캐 와요',A.one);
  check('Several shortages name only the resources (no counts) and every source',A.two==='나무·금이 모자라요 · ⛏️ 나무·금광맥을 캐 와요'&&A.stone==='🪨 돌 7개가 모자라요 · ⛏️ 바위를 캐 와요',[A.two,A.stone]);
  check('At night (no mining) gold comes from zombie drops; wood/stone wait for morning',A.night==='✨ 금 2개가 모자라요 · 좀비가 떨어뜨린 ✨금을 주워요'&&A.nightWood==='나무·금이 모자라요 · 아침에 ⛏️ 나무·금광맥을 캐 와요',[A.night,A.nightWood]);
  check('Affordable cost yields no message',A.none===''&&A.paid===''&&A.missing.startsWith('✨ 금 2개가 모자라요'),A);
});

// 3. Placement: a blueprint the group cannot pay even once is not placed; the child is told what is missing and where to get it.
function placement(res,{t='ice',line=false,move=null,phase='day'}={}){
  const C=vm.createContext({});
  vm.runInContext(`const G={phase:${JSON.stringify(phase)},me:{g:0},res:[${JSON.stringify(res)}]};
   let curBuild=${JSON.stringify(t)},curTool=${JSON.stringify(move?'move':'build')},buildMove=${JSON.stringify(move)},buildPress=false,acting=false,buildLineMode=${line},buildLineStart=null;
   const uid='me',GY=9,STRU=new Map([['m',{}]]),BUILD_PLAN_LIMIT=12,ghost={visible:false,position:{set(){}}},log={commands:[],toasts:[],sounds:[],ghost:[]};
   const window={__sfx:k=>log.sounds.push(k)};
   const aimStru=()=>null,aimInfo=()=>{},setGhost=()=>{},ghostFill=()=>{},ghostSet=ok=>log.ghost.push(ok),aimCell=()=>[10,10],
    wallMoveQuarter=()=>0,wallLineQuarter=()=>0,fortStyleOf=()=>0,canPlaceBuilding=()=>null,buildCanMove=()=>true,buildActor=()=>({}),
    buildAssistSetLine=()=>{},buildAssistClearLine=()=>{},buildAssistLineCells=(t,a,b)=>[a,[a[0]+1,a[1]],[a[0]+2,a[1]]],
    resetBuildPlacement=()=>{buildMove=null;},toast=(m)=>log.toasts.push(m),submitBuildCommand=c=>log.commands.push(c);
   ${costs}\n${lack}\n${fn('buildPlacementAction')}
   function click(){acting=true;buildPlacementAction(.016);acting=false;buildPlacementAction(.016);}
   globalThis.A={log,click,setRes:r=>Object.assign(G.res[0],r)};`,C);
  return C.A;
}
section('Placement',()=>{
  const ice=placement({w:86,s:67,g:0});ice.click();
  check('Day-1 wallet: clicking an ice tower places no blueprint, names gold and the gold vein, plays the refusal sound, ghost turns red',
    ice.log.commands.length===0&&ice.log.toasts.at(-1)==='✨ 금 2개가 모자라요 · ⛏️ 금광맥을 캐 와요'&&ice.log.sounds.includes('nope')&&ice.log.ghost.at(-1)===false,ice.log);
  for(const t of ['barr','pulse']){const a=placement({w:86,s:67,g:0},{t});a.click();
    check(`Day-1 wallet: ${t} is refused with its own gold amount`,a.log.commands.length===0&&a.log.toasts.at(-1)==='✨ 금 5개가 모자라요 · ⛏️ 금광맥을 캐 와요',a.log.toasts);}
  ice.setRes({g:2});ice.click();
  check('After mining enough gold the same click places the blueprint',ice.log.commands.length===1&&ice.log.commands[0].kind==='plan'&&ice.log.commands[0].t==='ice'&&ice.log.ghost.at(-1)===true,ice.log.commands);
  for(const t of ['wwall','swall','arrow']){const a=placement({w:86,s:67,g:0},{t});a.click();
    check(`Day-1 wallet: ${t} (no gold cost) is placed as before`,a.log.commands.length===1&&a.log.toasts.length===0,a.log);}
  const wall=placement({w:0,s:0,g:0},{t:'wwall',line:true});wall.click();
  check('Wall line: the first endpoint is refused when not even one wall can be paid',wall.log.commands.length===0&&wall.log.toasts.at(-1)==='🪵 나무 5개가 모자라요 · ⛏️ 나무를 캐 와요',wall.log.toasts);
  const part=placement({w:5,s:0,g:0},{t:'wwall',line:true});part.click();part.click();
  check('Wall line: one affordable wall is enough to place the whole line (cells are paid one by one)',part.log.commands.length===1&&part.log.commands[0].cells.length===3,part.log.commands);
  const night=placement({w:86,s:67,g:0},{t:'barr',phase:'night'});night.click();
  check('Night refusal points at zombie gold instead of mining',night.log.commands.length===0&&night.log.toasts.at(-1)==='✨ 금 5개가 모자라요 · 좀비가 떨어뜨린 ✨금을 주워요',night.log.toasts);
  const move=placement({w:0,s:0,g:0},{t:'ice',move:{id:'m',t:'ice',x:4,z:4,lv:1,g:0}});move.click();
  check('Moving a finished building never asks for its cost',move.log.commands.length===1&&move.log.commands[0].kind==='move'&&move.log.toasts.length===0,move.log);
});

// 4. Input layer: holding a blueprint the group cannot pay keeps sending the hand, without hammering; letting go stops it.
section('Input layer',()=>{
  const C=vm.createContext({});
  vm.runInContext(`const G={phase:'day',me:{g:0},res:[{w:86,s:67,g:0}]};let work=null,curTool='build',buildLineMode=false,acting=true;
   const BUILD_PLANS=new Map(),PL={x:0,z:0},log={hands:[],ticks:0,info:[]};
   const plan={id:'p1',t:'ice',x:0,z:3,g:0,prog:0,people:0};BUILD_PLANS.set('p1',plan);
   const workStop=()=>{work=null;setBuildHand('');},aimBuildPlan=()=>plan,aimNode=()=>null,workTick=()=>{log.ticks++;},
    workInfo=(title,pct,tail)=>log.info.push(title+'|'+pct+'|'+tail),setBuildHand=id=>log.hands.push(id);
   ${costs}\n${lack}\n${fn('buildPlanAction')}
   globalThis.A={log,G,plan,step(a){acting=a;return buildPlanAction(.05);},work:()=>work};`,C);
  const A=C.A;
  const handled=A.step(true);
  check('Holding an unfunded blueprint sends its hand (the host keeps it: 79차 "작업 중은 유지")',handled&&A.log.hands.at(-1)==='p1',A.log.hands);
  check('No hammering, sound or swing while paused (work stays empty, no tool beat)',A.work()===null&&A.log.ticks===0,{work:A.work(),ticks:A.log.ticks});
  check('The paused line says what is missing and where to get it',A.log.info.at(-1).includes('⏸ ✨ 금 2개가 모자라요 · ⛏️ 금광맥을 캐 와요'),A.log.info.at(-1));
  A.G.res[0].g=2;A.step(true);
  check('When a friend brings gold the same hold becomes real work with the hammer beat',A.log.hands.at(-1)==='p1'&&A.work()?.kind==='coop'&&A.log.ticks===1&&A.log.info.at(-1).includes('손을 떼도 진행 유지'),{work:A.work(),ticks:A.log.ticks});
  A.G.res[0].g=0;A.step(true);
  check('Funds spent mid-build: still held, hammering stops',A.log.hands.at(-1)==='p1'&&A.work()===null&&A.log.ticks===1);
  A.step(false);
  check('Letting go withdraws the hand',A.log.hands.at(-1)==='');
});

// 5. Host + guest fixture: the unchanged authoritative clock with a held-but-unfunded plan.
section('Host and guest',()=>{
  const H=client('host',true),C=client('child',false);
  H.G.players.set('child',{x:12,z:12,n:'child',g:0});C.G.players.set('host',{x:12,z:12,n:'host',g:0});
  let now=200000;const at=t=>{now=t;setNow(t);};
  H.reset();C.reset();H.G.phase=C.G.phase='day';bus.ref('buildPlans').set(null);bus.ref('buildHands').set(null);
  H.base[0].o=2;bus.ref('base').set(H.base);at(200000);
  C.submitBuildCommand({kind:'plan',t:'ice',cells:[[12,12]]});const p=[...H.BUILD_PLANS.values()][0];
  H.base[0].o=0;bus.ref('base').set(H.base);   // the group's gold is spent elsewhere right after placement
  for(let t=200000;t<=210000;t+=500){at(t);C.setBuildHand(p.id,.6);H.hostBuildTick(.5);}
  check('A guest holding an unfunded blueprint keeps it on host and guest beyond three seconds, with no progress or payment',
    H.BUILD_PLANS.has(p.id)&&C.BUILD_PLANS.has(p.id)&&p.prog===0&&p.people===1&&H.G.res[0].g===0&&H.STRU.size===0,{prog:p.prog,people:p.people});
  H.base[0].o=20;bus.ref('base').set(H.base);
  for(let t=210500;t<=230000&&!H.STRU.has(p.id);t+=500){at(t);C.setBuildHand(p.id,.6);H.hostBuildTick(.5);}
  check('Gold mined by a friend resumes the same blueprint; the group pays once',H.STRU.has(p.id)&&C.STRU.has(p.id)&&H.G.res[0].g===20-H.BUILD.ice.cost.g&&C.G.res[0].g===H.G.res[0].g,H.G.res[0]);
  H.base[0].o=0;bus.ref('base').set(H.base);at(240000);C.submitBuildCommand({kind:'plan',t:'barr',cells:[[20,20]]});const q=[...H.BUILD_PLANS.values()].find(x=>x.t==='barr');
  at(240500);C.setBuildHand(q.id,.6);H.hostBuildTick(.5);at(241000);C.setBuildHand('');H.hostBuildTick(.5);const last=q.touched;
  at(last+2999);H.hostBuildTick(.5);const kept=H.BUILD_PLANS.has(q.id);at(last+3000);H.hostBuildTick(.5);
  check('Released unfunded blueprint still disappears three seconds after the last hand (79차 rule unchanged)',kept&&!H.BUILD_PLANS.has(q.id)&&!C.BUILD_PLANS.has(q.id),{kept});
});
console.log(`${results.filter(r=>r.pass).length}/${results.length} build funding checks passed.`);
process.exitCode=results.some(r=>!r.pass)?1:0;
