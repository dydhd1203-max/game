// Exercises source construction logic with two independent client contexts and
// an in-memory realtime-database fixture. No external room or input devices.
import fs from 'node:fs';import vm from 'node:vm';import {GAME} from './gamefile.mjs';
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(st,fun=false){let b=0,p=0,r=0,q='',co='',esc=false,open=false;
 for(let i=st;i<source.length;i++){const c=source[i],n=source[i+1];
  if(co==='l'){if(c==='\n')co='';continue;}if(co==='b'){if(c==='*'&&n==='/'){co='';i++;}continue;}
  if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q='';continue;}
  if(c==='/'&&n==='/'){co='l';i++;continue;}if(c==='/'&&n==='*'){co='b';i++;continue;}
  if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{'){b++;open=true;}else if(c==='}')b--;
  else if(c==='(')p++;else if(c===')')p--;else if(c==='[')r++;else if(c===']')r--;
  if(!b&&!p&&!r&&((fun&&open)||(!fun&&c===';')))return i+1;
 }throw Error('Unterminated declaration');}
const dec=n=>{const m=new RegExp('(?:const|let)\\s+'+n+'\\s*=').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));};
const fn=n=>{const i=source.indexOf('function '+n+'(');if(i<0)throw Error(n);return source.slice(i,end(i,true));};
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
class Bus{
 data={};listeners=[];writes=[];pending=[];flushing=false;held=false;
 value(path){return path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],this.data)??null;}
 snap(path,v=this.value(path)){return {key:path.split('/').at(-1),val:()=>clone(v)};}
 ref(path='') {const b=this;return {child:k=>b.ref([path,k].filter(Boolean).join('/')),
  set:v=>b.write({[path]:v}),remove:()=>b.write({[path]:null}),update:v=>b.write(Object.fromEntries(Object.entries(v).map(([k,x])=>[[path,k].filter(Boolean).join('/'),x]))),
  on(type,cb){const l={path,type,cb};b.listeners.push(l);const v=b.value(path);if(type==='value')cb(b.snap(path));else if(type==='child_added'&&v)for(const [k,x]of Object.entries(v))cb(b.snap(path+'/'+k,x));},
  onDisconnect:()=>({remove(){}})};}
 write(updates){this.pending.push(updates);this.flush();}
 flush(){if(this.flushing||this.held)return;this.flushing=true;
  try{while(this.pending.length){const u=this.pending.shift(),before=this.listeners.map(l=>clone(this.value(l.path)));
   for(const [path,value]of Object.entries(u)){this.writes.push(path);const keys=path.split('/');let at=this.data;for(const k of keys.slice(0,-1))at=at[k]??={};if(value===null)delete at[keys.at(-1)];else at[keys.at(-1)]=clone(value);}
   this.listeners.slice().forEach((l,i)=>{const now=this.value(l.path),old=before[i];if(JSON.stringify(now)===JSON.stringify(old))return;
    if(l.type==='value')l.cb(this.snap(l.path));else{const keys=new Set([...Object.keys(old||{}),...Object.keys(now||{})]);for(const k of keys){const a=old?.[k],b=now?.[k];if(l.type==='child_added'&&a===undefined&&b!==undefined||l.type==='child_removed'&&a!==undefined&&b===undefined||l.type==='child_changed'&&a!==undefined&&b!==undefined&&JSON.stringify(a)!==JSON.stringify(b))l.cb(this.snap(l.path+'/'+k,l.type==='child_removed'?a:b));}}
   });
  }}finally{this.flushing=false;}
 }
}
let now=100000;class Clock extends Date{static now(){return now;}}
const bus=new Bus(),results=[];
const funcs=['bs','upCost','footprint','buildStat','buildingName','fortSurvived','fortStyleOf','setFortStyle','buildOwn','buildActor','buildNear','buildCanPay','buildPay','buildReward','buildReply','packBuilding','submitBuildCommand','planAtCell','canPlaceBuilding','createBuildPlans','handleBuildCommand','buildCanMove','requestRepairHelp','publishBuildPlans','buildWorkers','buildSpeed','observeBuilt','finishBuildPlan','hostBuildTick','setBuildHand','buildMissingCost','bindBuildNetwork','applyBuildUpgrade','repairStru','applyBuildRepair','applyNetworkBuilding','netBuild','canPlace','addStru','delStru'];
function client(id,host){const ctx=vm.createContext({console,Date:Clock,net:bus.ref()});
 const fixture=`const uid=${JSON.stringify(id)},NG=5,GY=9;
 const G={host:${host},phase:'day',paused:false,day:1,me:{name:${JSON.stringify(id)},g:0},res:[],players:new Map()};
 const PL={x:12,z:12,down:false},base=Array.from({length:5},()=>({w:1000,s:1000,o:1000}));
 const STRU=new Map(),cellOwner=new Map(),bldH=new Float64Array(10000),terrH=new Float64Array(10000).fill(GY);
 let struVer=0,netPCDirty=false;const MY={built:0,helped:0,fixed:0,rescue:0},credits=[],messages=[],window={},XP_BUILD={arrow:34},XP_FIX=6,XP_UP=16;
 const inW=(x,z)=>x>=0&&z>=0&&x<100&&z<100,gi=(x,z)=>x*100+z,oct=()=>0,ARENA_R=100,RING_D=100,rampCells=new Set(),nodeCellBlocked=()=>false,houseNear=()=>false;   // 64차 — canPlace 가 마을 집터(houseNear)를 본다. 이 fixture 에는 집이 없다
 const SHOP_X=999,SHOP_Z=999,VET_X=999,VET_Z=999,FORGE_X=999,FORGE_Z=999,FARM_X=Array(5).fill(999),FARM_Z=Array(5).fill(999),FARM_R2=[1];
 const struCount=()=>0,markShape=()=>{},markFlow=()=>{},markHp=()=>{},burst=()=>{},toast=m=>messages.push(m),say=m=>messages.push(m),esc=s=>s;
 const xpGain=x=>credits.push(x),struCX=o=>o.x+1,struCZ=o=>o.z+1,workMul=()=>1;
 const myRes=()=>G.res[G.me.g],popDmg=()=>{},feed=m=>messages.push(m),GCOL=Array(5).fill('#fff'),josa=(n,s)=>s;
 function recomputeRes(){G.res=base.map(r=>({w:r.w,s:r.s,g:r.o}));}recomputeRes();
 const el=()=>({});`;
 const state=['BUILD','BUILD_BRANCHES','MAXLV','WORK_SEC','BUILD_PLANS','buildParticipated','FORT_STYLES','buildSequence','buildPlansNeedSync','buildPlanDirty','buildLineMode','BUILD_PLAN_LIMIT','RESCUE_MARK'].map(dec);
 const c0=source.indexOf('const COST_MUL ='),c1=source.indexOf('const SOL_COMP =',c0);
 vm.runInContext([fixture,...state,source.slice(c0,c1),...funcs.map(fn),
  `net.child('base').on('value',s=>{const v=s.val();if(v){for(let i=0;i<5;i++)base[i]=v[i];recomputeRes();}});
   bindBuildNetwork();
   net.child('b').on('child_added',s=>applyNetworkBuilding(s.key,s.val()));
   net.child('b').on('child_changed',s=>applyNetworkBuilding(s.key,s.val()));
   net.child('b').on('child_removed',s=>{if(STRU.has(s.key))delStru(s.key);});
   globalThis.A={G,PL,base,STRU,cellOwner,BUILD,BUILD_PLANS,BUILD_HANDS,BUILD_HELP,credits,messages,MY,buildParticipated,
    submitBuildCommand,hostBuildTick,setBuildHand,canPlaceBuilding,buildCanMove,buildSpeed,fortStyleOf,setFortStyle,handleBuildCommand,packBuilding,applyNetworkBuilding,buildCanPay,repairStru,buildPay,buildReply,
    reset(){BUILD_PLANS.clear();BUILD_HANDS.clear();STRU.clear();cellOwner.clear();for(const r of base){r.w=1000;r.s=1000;r.o=1000;}recomputeRes();}};`].join('\n'),ctx);
 return ctx.A;
}
const H=client('host',true),C=client('child',false);
H.G.players.set('child',{x:12,z:12,n:'child',g:0});C.G.players.set('host',{x:12,z:12,n:'host',g:0});
const ok=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));};
const command=(c,o)=>c.submitBuildCommand(o);
command(C,{kind:'plan',t:'arrow',cells:[[12,12]]});let plan=[...H.BUILD_PLANS.values()][0];
ok('Guest blueprint arrives at host and other clients without payment',!!plan&&C.BUILD_PLANS.has(plan.id)&&H.G.res[0].w===1000);
command(H,{kind:'plan',t:'swall',cells:[[12,12]]});ok('Overlapping footprints are reserved before completion',H.BUILD_PLANS.size===1);
C.setBuildHand(plan.id);H.setBuildHand(plan.id);H.hostBuildTick(1);
ok('Two players contribute to one faster shared meter',Math.abs(plan.prog-1.5/6.4)<1e-10&&plan.people===2,plan.prog);
C.setBuildHand('');H.setBuildHand('');const held=plan.prog;H.hostBuildTick(.6);
ok('Releasing both buttons preserves progress and broadcasts zero participants',plan.prog===held&&C.BUILD_PLANS.get(plan.id).people===0);
now+=2000;H.hostBuildTick(1);ok('Expired worker heartbeat cannot keep building',plan.prog===held);
C.setBuildHand(plan.id);H.setBuildHand(plan.id);H.hostBuildTick(6.4);
const built=H.STRU.get(plan.id),cost=H.BUILD.arrow.cost;
ok('Construction completes once and removes the plan for both clients',!!built&&C.STRU.has(plan.id)&&H.BUILD_PLANS.size===0&&C.BUILD_PLANS.size===0);
ok('Group pays exactly once and assisting player receives credit',H.G.res[0].w===1000-cost.w&&C.G.res[0].w===H.G.res[0].w&&C.MY.built===1&&H.MY.helped===1);
H.hostBuildTick(10);ok('A completed plan cannot spend again',H.G.res[0].w===1000-cost.w);
command(C,{kind:'upgrade',id:built.id,lv:1});command(H,{kind:'upgrade',id:built.id,lv:1});
ok('Simultaneous upgrades reject a stale level instead of charging twice',built.lv===2&&C.STRU.get(built.id).lv===2);
const before=H.G.res[0].w;command(C,{kind:'upgrade',id:built.id,lv:2,branch:'sniper'});
ok('Branch is paid once and synchronized with level three',built.lv===3&&built.branch==='sniper'&&C.STRU.get(built.id).branch==='sniper'&&H.G.res[0].w===before-H.BUILD.arrow.up[1].w);
ok('Guest upgrade grants experience through its acknowledgement',C.credits.includes(16*3));
command(H,{kind:'delete',id:built.id});ok('Teammate demolition requests approval without removing building',H.STRU.has(built.id)&&built.delReq?.n==='host');
command(C,{kind:'keep',id:built.id});ok('Builder can refuse demolition',!built.delReq&&H.STRU.has(built.id));
command(C,{kind:'move',id:built.id,x:14,z:12});
ok('Recent owner relocation preserves branch, level, HP and updates collisions on peers',built.x===14&&built.lv===3&&built.branch==='sniper'&&!H.cellOwner.has('12,12')&&C.cellOwner.get('14,12')===built.id);
command(H,{kind:'move',id:built.id,x:16,z:12});ok('Another player cannot move a teammate building',built.x===14);
now+=61000;command(C,{kind:'move',id:built.id,x:16,z:12});ok('Relocation window expires after one minute',built.x===14);
H.G.phase='night';command(C,{kind:'move',id:built.id,x:16,z:12});ok('Buildings cannot be repositioned during combat',built.x===14);H.G.phase='day';
command(H,{kind:'delete',id:built.id});H.G.players.get('child').x=80;C.PL.x=80;
command(C,{kind:'delete',id:built.id,approve:true});ok('Owner can approve a pending request from far away',!H.STRU.has(built.id)&&!C.STRU.has(built.id));
H.G.players.get('child').x=12;C.PL.x=12;
H.base[0].w=0;bus.ref('base').set(H.base);command(C,{kind:'plan',t:'wwall',cells:[[12,12]]});plan=[...H.BUILD_PLANS.values()][0];
C.setBuildHand(plan.id);H.hostBuildTick(20);ok('Unfunded plans remain visible but cannot complete or overspend',H.BUILD_PLANS.has(plan.id)&&plan.prog===0&&H.G.res[0].w===0);
H.base[0].w=10;bus.ref('base').set(H.base);C.setBuildHand(plan.id,.7);H.hostBuildTick(3);ok('Gathered resources allow the existing plan to finish',H.STRU.has(plan.id)&&H.G.res[0].w===10-H.BUILD.wwall.cost.w);
H.G.day=C.G.day=1;C.setFortStyle(3);ok('Decorations cannot unlock before surviving nights',H.fortStyleOf(0)===0);
H.G.day=C.G.day=4;C.setFortStyle(3);ok('Unlocked decoration is shared by the group',H.fortStyleOf(0)===3&&C.fortStyleOf(0)===3);
command(C,{kind:'plan',t:'swall',cells:[[15,15]]});plan=[...H.BUILD_PLANS.values()][0];now+=90001;H.hostBuildTick(.6);ok('Abandoned blueprints expire without payment',!H.BUILD_PLANS.has(plan.id)&&!C.BUILD_PLANS.has(plan.id));
ok('Cooperative speed is bounded with three contributors',H.buildSpeed([{speed:1},{speed:1},{speed:1}])===1.8);
ok('Construction never enlarges or writes the position channel',!bus.writes.some(k=>k==='p'||k.startsWith('p/')));

// Hold delivery while a second operation changes the authoritative state.
const release=()=>{bus.held=false;bus.flush();};
H.reset();C.reset();bus.ref('base').set(H.base);
bus.held=true;
command(C,{kind:'plan',t:'wwall',cells:[[12,12]]});
command(C,{kind:'plan',t:'wwall',cells:[[13,12]]});
command(C,{kind:'plan',t:'wwall',cells:[[14,12]]});
release();
ok('Three delayed guest commands survive independent queue entries and acknowledgement removal',H.BUILD_PLANS.size===3&&C.BUILD_PLANS.size===3);
ok('Host deletes command sequence entries without ever clearing the player command queue',bus.writes.filter(p=>p.startsWith('buildCmd/')).every(p=>p.split('/').length===3));

H.base[0].w=20;bus.ref('base').set(H.base);const otherBefore=H.G.res[1].w;
bus.held=true;H.buildPay(0,{w:10});bus.ref('base').set(H.base);
command(C,{kind:'transfer',to:1,w:18,s:0,g:0});release();
ok('Delayed transfer checks the host balance after construction and cannot restore spent resources',H.G.res[0].w===10&&H.G.res[1].w===otherBefore&&C.G.res[0].w===10);
command(C,{kind:'transfer',to:1,w:2,s:0,g:0});
ok('Valid transfer moves exactly its amount between groups without discarding construction cost',H.G.res[0].w===8&&C.G.res[0].w===8&&H.G.res[1].w===otherBefore+2);
const balance=H.G.res[0].w;
for(const c of [{to:1,w:-2,s:0,g:0},{to:1,w:2.5,s:0,g:0},{to:5,w:2,s:0,g:0},{to:0,w:2,s:0,g:0}])command(C,{kind:'transfer',...c});
ok('Invalid transfer amounts and destinations cannot change the ledger',H.G.res[0].w===balance&&H.G.res[1].w===otherBefore+2);

H.base[0].w=1000;bus.ref('base').set(H.base);
const repairId='repair-fixture',hp1=H.BUILD.arrow.hp[0];
bus.ref('b/'+repairId).set({t:'arrow',x:12,z:12,hp:hp1*.2,g:1,n:'host',by:'host',lv:1,born:now});
let tower=H.STRU.get(repairId),fixed=C.MY.fixed;
bus.held=true;C.repairStru(C.STRU.get(repairId));command(H,{kind:'upgrade',id:repairId,lv:1});const paidUpgrade=H.G.res[0].w;release();
ok('Late repair cannot lower newly upgraded full HP or consume repair resources',tower.lv===2&&tower.hp===tower.mx&&C.STRU.get(repairId).hp===tower.mx&&H.G.res[0].w===paidUpgrade&&C.MY.fixed===fixed);
bus.ref('b/'+repairId+'/hp').set(tower.mx*.5);
bus.held=true;C.repairStru(C.STRU.get(repairId));tower.hp=tower.mx*.2;
const oldFixed=C.MY.fixed,oldHelped=C.MY.helped,oldRescue=C.MY.rescue,xpCount=C.credits.length;release();
ok('Delayed repair uses current host damage and heals 35 percent of current maximum',Math.abs(tower.hp-tower.mx*.55)<=.5&&C.STRU.get(repairId).hp===tower.hp&&H.G.res[0].w===paidUpgrade-2);
ok('Guest rescue acknowledgement grants fixed, helped, rescue and repair experience once',C.MY.fixed===oldFixed+1&&C.MY.helped===oldHelped+1&&C.MY.rescue===oldRescue+1&&C.credits.length===xpCount+1&&C.credits.at(-1)===6);
bus.ref('b/'+repairId+'/hp').set(tower.mx*.8);const beforeRepair=H.G.res[0].w;fixed=C.MY.fixed;
bus.held=true;C.repairStru(C.STRU.get(repairId));C.repairStru(C.STRU.get(repairId));release();
ok('Two queued repairs spend only once when the first repair fills remaining HP',tower.hp===tower.mx&&H.G.res[0].w===beforeRepair-2&&C.MY.fixed===fixed+1);
bus.ref('b/'+repairId+'/hp').set(tower.mx*.2);
const replay={kind:'repair',id:repairId,seq:'replay_repair'},beforeReplay=H.G.res[0].w;
H.handleBuildCommand('child',replay);H.handleBuildCommand('child',{kind:'help',id:repairId,seq:'intervening_help'});H.handleBuildCommand('child',replay);
ok('An older command replay after another command cannot spend a second time',H.G.res[0].w===beforeReplay-2);

const repliesBefore=C.MY.fixed;bus.held=true;
H.buildReply('child','first repair credit',{xp:6,stats:{fixed:1}});
H.buildReply('child','second repair credit',{xp:6,stats:{fixed:1}});
const firstReply=clone(bus.pending[0]);release();
ok('Two delayed credit acknowledgements both reach the guest',C.MY.fixed===repliesBefore+2);
bus.write(firstReply);ok('Replayed acknowledgement cannot grant contribution twice',C.MY.fixed===repliesBefore+2);
const inputContext=vm.createContext({});
vm.runInContext(`let work={kind:'coop',id:'finished'},curTool='mine',buildLineMode=false,acting=false,_aimEl=null;
 const BUILD_PLANS=new Map(),PL={x:0,z:0},BUILD={arrow:{name:'탑',cost:{}}};let plan=null,node=null,stopped=0;
 const workStop=()=>{work=null;stopped++;},aimBuildPlan=()=>plan,aimNode=()=>node,buildMissingCost=()=>'',workInfo=()=>{},setBuildHand=()=>{};
 ${fn('buildPlanAction')}
 const gone=buildPlanAction(.01)===false&&stopped===1&&work===null;
 plan={id:'p',t:'arrow',x:0,z:8,prog:0};node={x:0,z:2};
 const mining=buildPlanAction(.01)===false;globalThis.answer={gone,mining};`,inputContext);
ok('Completed construction immediately releases its hammer work state',inputContext.answer.gone);
ok('A nearer resource can still be mined with a blueprint behind it',inputContext.answer.mining);
const reachContext=vm.createContext({});
vm.runInContext(`const BUILD_REACH=10,BUILD_PLANS=new Map([['p',{id:'p',x:0,z:9}]]),PL={x:.5,z:0};let work=null;const forward=()=>({x:0,z:1});${fn('aimBuildPlan')}globalThis.selected=aimBuildPlan()?.id;`,reachContext);
ok('A blueprint at the furthest placement distance is still within work reach',reachContext.selected==='p');
console.log(`${results.filter(r=>r.pass).length}/${results.length} construction checks passed.`);process.exitCode=results.some(r=>!r.pass)?1:0;
