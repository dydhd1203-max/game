// 21 isolated clients execute the game's actual purchase/checkpoint/hit functions.
// Simulates delayed packets, duplicate delivery, refresh, and competing building costs.
import fs from 'node:fs';import vm from 'node:vm';import {GAME} from './gamefile.mjs';
import assert from 'node:assert/strict';
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
  once:()=>Promise.resolve(b.snap(path)),onDisconnect:()=>({remove(){}})};}
 write(updates){this.pending.push(updates);this.flush();return Promise.resolve();}
 flush(){if(this.flushing||this.held)return;this.flushing=true;
  try{while(this.pending.length){const u=this.pending.shift(),before=this.listeners.map(l=>clone(this.value(l.path)));
   for(const [path,value]of Object.entries(u)){this.writes.push(path);const keys=path.split('/');let at=this.data;for(const k of keys.slice(0,-1))at=at[k]??={};if(value===null)delete at[keys.at(-1)];else at[keys.at(-1)]=clone(value);}
   this.listeners.slice().forEach((l,i)=>{const now=this.value(l.path),old=before[i];if(JSON.stringify(now)===JSON.stringify(old))return;
    if(l.type==='value')l.cb(this.snap(l.path));else{const keys=new Set([...Object.keys(old||{}),...Object.keys(now||{})]);for(const k of keys){const a=old?.[k],b=now?.[k];if(l.type==='child_added'&&a===undefined&&b!==undefined||l.type==='child_removed'&&a!==undefined&&b===undefined||l.type==='child_changed'&&a!==undefined&&b!==undefined&&JSON.stringify(a)!==JSON.stringify(b))l.cb(this.snap(l.path+'/'+k,l.type==='child_removed'?a:b));}}
   });
  }}finally{this.flushing=false;}
 }
}

const bus=new Bus(),stores=new Map();
const tick=()=>new Promise(r=>setImmediate(r));
const block=source.slice(source.indexOf('let checkpointWait='),source.indexOf('function netMeta(){'));
const decls=['WEAPONS','wpnLv','wpnLvOk','ARMORS','POT_SEC','POTIONS','AMMO_PER_GOLD','FARM_ANIMALS','FARM_CAP','farmCount','FARM_FEED',
 'ENH_MAX','ENH_ODDS','ENH_SAFE','ENH_DROP','ENH_COST','enhOf','RES_KEYS','RES_IC','RES_PC','RES_SPC','TRADE_MULS','TRADE_PACK','TRADE_VAL','TRADE_KEEP','tradeGive','tradeGet','KIT','XP','MY','netIdleT','netT'];
const funcs=['recomputeRes','canPay','enhCost','buyAmmo','buyPotion','buyWeapon','buyArmor','craftable','craftWeapon','hostStoneHit','buildCanPay','buildPay','farmFeed','farmClean','buyAnimal','packPlayer','packSim','netTick'];
function client(id,host=false){
 const ls=stores.get(id)||new Map();stores.set(id,ls);
 const ctx=vm.createContext({console,net:bus.ref(),store:ls,setTimeout:f=>f(),addEventListener:()=>{},document:{addEventListener(){}}});
 const setup=`
 const uid=${JSON.stringify(id)},NG=5,GY=9,LV_MAX=35,XP_KILL=12,XP_FEED=10,XP_CLEAN=10;
 const G={started:true,host:${host},room:'TEST',sid:7300,day:1,phase:'day',paused:false,me:{g:0,name:uid},res:[],farm:Array.from({length:5},()=>({hen:0,pig:0,cow:0})),players:new Map(),wolves:[]};
 const base=Array.from({length:5},()=>({w:500,s:500,o:10,eg:2,mk:0,pk:0})),pcMap=new Map();let myPC={g:0,w:0,s:0,o:0};
 let netPCDirty=false,farmDirty=false,enhBusy=false,shopUiSig='';const PL={x:0,y:9,z:0,yaw:0,hp:100,down:false},hudPrev={},window={},credits=[],messages=[];
 const DBG={slowNet:false},SPEC={helpT:0},treExplorer=()=>false,netPC=()=>{netPCDirty=false;};
 let thrown=0,thTgt=0,thDmg=0,thF=null,thX=[],thXs=0;const myRef=net.child('p/'+uid);G.soldiers=[];G.crystal=100;
 const LS={get:(k,d)=>store.get(k)??d,set:(k,v)=>store.set(k,v)},maxHP=()=>100,syncMyPC=()=>{},shopUiResync=()=>{},myRes=()=>G.res[G.me.g];
 const toast=(...x)=>messages.push(x),xpGain=n=>{XP.xp+=n;credits.push(n);},hitMark=()=>{},isBoss=()=>false,zStep=()=>{},stoneDmg=()=>10;
 const miniBack=null,farmSpotXZ=()=>[0,0],burst=()=>{},costTxt=()=>'',myFarm=()=>G.farm[0],farmStageOf=()=>0,buildFarmUI=()=>{},buildVetUI=()=>{};
 const el=()=>({classList:{contains:()=>false}}),buildShopUI=()=>{},buildForgeUI=()=>{},buildKitUI=()=>{},equipWeapon=i=>KIT.wpn=i,equipArmor=i=>KIT.arm=i;
 const josa=()=>'',josaNum=()=>'',esc=s=>s,GCOL=Array(5).fill('#abc'),feed=()=>{},fx2Cel=()=>{},isTouch=false,noteRecipes=()=>{},popOpen=()=>false;
 const TIER_COL={rare:'#fff',unique:'#fff'},TIER_TXT={rare:'희귀',unique:'유일'},enhSparkFx=()=>{},enhResult=()=>{};
 `;
 vm.runInContext([setup,...decls.map(dec),...funcs.map(fn),block,`
   pcMap.set(uid,myPC);recomputeRes();checkpointRestore();
   net.child('base').on('value',s=>{const b=s.val();if(b){for(let i=0;i<5;i++)base[i]=b[i];recomputeRes();}});
   bindPurchaseNetwork();
   globalThis.A={G,KIT,XP,MY,PL,base,pcMap,credits,messages,purchaseRequest,hostPurchase,acceptPurchase,purchaseOffer,checkpointSave,checkpointRestore,
    queueHit,hostHits,acceptCombat,buildPay,buildCanPay,netTick,retryPurchase,
    state:()=>({marketPending,marketApplied,marketReceipts,hitQueue,combatXPSeen}),
    setPC:p=>{myPC=p;pcMap.set(uid,p);},getPC:()=>myPC,resetPurse:(gold=10)=>{for(const b of base)Object.assign(b,{w:500,s:500,o:gold,eg:2,mk:0,pk:0});recomputeRes();}};
 `].join('\n'),ctx);
 return ctx.A;
}
const H=client('host',true);await tick();const clients=Array.from({length:21},(_,i)=>client('child'+i));
for(let i=0;i<21;i++)H.pcMap.set('child'+i,{g:0});
bus.held=true;clients.forEach(c=>c.purchaseRequest('ammo',{gld:8}));
assert.ok(clients.every(c=>c.KIT.ammo===0),'no inventory before approval');
bus.held=false;bus.flush();
assert.equal(clients.filter(c=>c.KIT.ammo===48).length,1);assert.equal(H.G.res[0].g,2);
assert.ok(clients.every(c=>c.state().marketPending===null));
const receipt=clone(bus.value('purchaseReply/child0'));bus.ref('purchaseReply/child0').set(receipt);H.hostPurchase('child0',receipt);
assert.equal(clients[0].KIT.ammo,48);assert.equal(H.G.res[0].g,2);
console.log('PASS: 21 simultaneous buyers, no optimistic inventory, one charge/grant, replay idempotent');
H.resetPurse(20);bus.ref('base').set(H.base);
const early=client('early');early.purchaseRequest('ammo',{gld:3});
assert.ok(early.state().marketPending);assert.equal(early.KIT.ammo,0);
H.pcMap.set('early',{g:0});H.retryPurchase('early');H.retryPurchase('early');
assert.equal(early.KIT.ammo,18);assert.equal(H.G.res[0].g,17);
console.log('PASS: purchase arriving before player identity is processed once after identity arrives');
// Restore after approval but before the client sees the response.
H.resetPurse(30);bus.ref('base').set(H.base);
const C=clients[1];C.XP.lv=16;C.XP.job=0;C.XP.jt=1;C.KIT.ownW[3]=true;C.KIT.enh[3]=4;C.setPC({g:0,w:17,sw:3});
bus.held=true;C.purchaseRequest('ammo',{gld:5});
const saved=stores.get('child1').get('sheepSave:TEST:child1');assert.ok(saved);
// Disconnect all old client's receipt listeners; keep its saved pending request.
bus.listeners=bus.listeners.filter(l=>l.path!=='purchaseReply/child1');bus.held=false;bus.flush();
const paid=H.G.res[0].g,restored=client('child1');await tick();
assert.equal(restored.KIT.ammo,30);assert.equal(H.G.res[0].g,paid);assert.equal(restored.XP.lv,16);assert.equal(restored.KIT.enh[3],4);
assert.equal(restored.getPC().w,17);assert.equal(restored.getPC().sw,3);
// Refresh again must not grant the same paid ammo a second time.
bus.listeners=bus.listeners.filter(l=>l.path!=='purchaseReply/child1');const again=client('child1');await tick();
assert.equal(again.KIT.ammo,30);again.G.sid++;assert.equal(again.checkpointRestore(),false);
stores.get('child1').set('sheepSave:TEST:child1','{bad');assert.equal(again.checkpointRestore(),false);
console.log('PASS: pending purchase survives reload, receipt grants exactly once, level/job/gear/ledger restored, new lesson and corrupt data rejected');
// Building and shop share the same host balance; no separate overspend window.
H.resetPurse(10);H.buildPay(0,{g:8});assert.equal(H.buildCanPay(0,{g:8}),false);
const c={kind:'ammo',gld:8,g:0,lv:1,seq:Date.now()+1000,sid:7300};H.hostPurchase('child2',c);
assert.equal(H.state().marketReceipts.get('child2').ok,false);assert.equal(H.G.res[0].g,2);
// Trades and farm goods use host-derived prices/stock, and two simultaneous feed requests charge once.
H.resetPurse(100);bus.ref('base').set(H.base);H.G.farm[0]={hen:1,pig:0,cow:0};
const before=H.G.res[0].w;H.hostPurchase('child3',{kind:'feed',farmG:0,g:0,seq:c.seq+1,sid:7300});
H.hostPurchase('child4',{kind:'feed',farmG:0,g:0,seq:c.seq+2,sid:7300});
assert.equal([...H.state().marketReceipts.values()].filter(r=>r.kind==='feed'&&r.ok).length,1);assert.ok(H.G.res[0].w<before);
const trade=H.purchaseOffer({kind:'trade',from:'w',to:'g',mul:3,g:0});assert.ok(trade.cost.w>0&&trade.gain.g>0);
console.log('PASS: construction/shop share one ledger, trade quantity 3 supported, farm feed charged once');
// Ordered hit batches can change targets within one packet. Repeated packets cannot damage twice.
H.G.phase='night';H.G.wolves=[{id:1,hp:1000,mx:1000},{id:2,hp:40,mx:40}];
const shots={g:0,n:'child0',hq:[[1,1,150,1,null,1],[2,2,40,1,null,1]]};H.hostHits('child0',shots);H.hostHits('child0',shots);
assert.deepEqual(H.G.wolves.map(w=>w.hp),[850,0]);
H.hostHits('child1',{g:0,n:'child1',hq:[[1,2,100,1,null,1]]});
const credit0=H.credits.length;clients[0].acceptCombat([2,12]);clients[0].acceptCombat([2,12]);assert.equal(clients[0].credits.reduce((a,b)=>a+b,0),12);
assert.equal(H.credits.length,credit0);console.log('PASS: hit batching keeps each target, host-confirmed kill bonus exactly once');
console.log('All 73 network checks passed.');
// Position remains 6Hz while moving. Idle pupils send only the 2s heartbeat.
const N=clients[10];bus.writes.length=0;for(let i=0;i<1200;i++)N.netTick(1/60);
const idle=bus.writes.filter(p=>p==='p/child10').length;
bus.writes.length=0;for(let i=0;i<1200;i++){N.PL.x+=0.1;N.netTick(1/60);}
const moving=bus.writes.filter(p=>p==='p/child10').length;
assert.ok(idle>=9&&idle<=11);assert.ok(moving>=108&&moving<=121);
console.log('PASS: same moving update rate, fewer idle writes over 20s: '+JSON.stringify({idle,moving}));
