// Read-only review regression against live source; no browser or source writes.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8'),h=fs.readFileSync(path.join(here,'t54-zombie-static.mjs'),'utf8');
const {fn}=new Function('source',h.slice(h.indexOf('function scanEnd('),h.indexOf('const fixtures='))+'return {fn};')(source);
const cl=()=>({s:new Set(),add(x){this.s.add(x);},remove(x){this.s.delete(x);},contains(x){return this.s.has(x);},toggle(x,on){on?this.add(x):this.remove(x);}}),nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{classList:cl(),style:{},hidden:false});return nodes.get(id);};
const callbacks=new Map(),net={child(key){return {on(type,f){callbacks.set(key+':'+type,f);},onDisconnect(){return {remove(){}};},once(){},remove(){}};}};
const ctx=vm.createContext({console,Math,Number,Map,Set,el,document:{body:{classList:cl()},querySelectorAll:()=>[...nodes.values()].filter(n=>n.classList.contains('on'))},
 G:{host:false,started:true,sid:1,phase:'win',set:{goalDay:15},me:{name:'아이',g:0},players:new Map(),wolves:[],soldiers:[],room:'TEST'},fb:{ref:()=>net},DB_ROOT:'test',uid:'kid',net:null,myRef:null,lastPosSig:'',lastSimSig:'',netIdleT:0,simIdleT:0,
 PL:{hp:0,down:true},PLV:{},held:{},LOBBY78:{x:0,z:-160,y:74,group:{visible:false}},KIT:{},RL:{},hudPrev:{},pcMap:new Map(),endShown:true,camBodyHidden:false,camAutoK:0,miniBack:null,RACE:{},spawnQ:[],netPCDirty:false,
 lobbyBuild78(){},lobbyPaint78(){},cryGuestWatch(){},xpReset(){},myReset(){},sessionFresh(){},maxHP:()=>100,setAimMode(){},placePlayer(){Object.assign(ctx.PL,{x:9,y:10,z:11});},treVersion(){},treDangerRun(){},setPaused(){},bindBuildNetwork(){},bindPurchaseNetwork(){},netMeta(){},
 clearBuildCoop(){},STRU:new Map(),NG:1,base:[{}],START:{w:10,s:5},confirm:()=>true,netBase(){},
 race74Reset(){},groundUnder:()=>0,toast(){},sfx(){},paintEndCard(){},GCOL:['red'],esc:String,window:{},openPop:id=>{el(id).classList.add('on');ctx.openCount=(ctx.openCount||0)+1;},
 // Register-only network handlers below are not invoked by this focused fixture.
 buildPlanMesh:null,BUILD:{}});
vm.runInContext(['kitReset','miniLeave','lobbyReset78','lobbyEnter78','onPhaseChange','joinRoom','showEnd'].map(fn).join('\n'),ctx);
el('popEnd').classList.add('on');vm.runInContext("joinRoom('TEST',false)",ctx);
callbacks.get('meta:value')({val:()=>({ph:'lobby',day:1,t:0,sid:2,crystal:100,set:{goalDay:15}})});
assert.equal(ctx.endShown,false);assert.equal(el('popEnd').classList.contains('on'),false);assert.equal(ctx.G.phase,'lobby');assert.equal(ctx.G.sid,2);
vm.runInContext("G.phase='lose';showEnd()",ctx);assert.equal(ctx.openCount,1);assert.equal(el('popEnd').classList.contains('on'),true);
console.log('PASS guest new sid closes prior result and allows the next game result');
ctx.G.host=true;ctx.G.phase='mini';ctx.G.mini={k:0};ctx.miniBack={x:1,z:2,yaw:0,pitch:0,wpn:18,ammo:777};ctx.KIT.wpn=0;ctx.KIT.ammo=0;
vm.runInContext('lobbyReset78()',ctx);assert.equal(ctx.G.phase,'lobby');assert.equal(ctx.KIT.wpn,0);assert.equal(ctx.KIT.ammo,0);assert.equal(ctx.miniBack,null);assert.equal(ctx.endShown,false);
console.log('PASS host new lesson inside minigame does not restore saved weapon/ammo');
// The teacher button used to recover guests through a new sid, but leave the host at zero HP.
const resetStart=source.indexOf("el('tReset').onclick ="),resetEnd=source.indexOf('/* ═══════════════════════ 스테이지 안내',resetStart);
assert.ok(resetStart>=0&&resetEnd>resetStart);vm.runInContext(source.slice(resetStart,resetEnd),ctx);
ctx.G.phase='night';ctx.G.day=8;ctx.G.set.crystalMax=200;Object.assign(ctx.PL,{hp:0,down:true,biteT:.8,downT:12,hurtFx:.3,landT:.4});
el('tReset').onclick();
assert.equal(ctx.G.phase,'lobby');assert.equal(ctx.G.day,1);assert.equal(ctx.PL.hp,100);assert.equal(ctx.PL.down,false);
for(const k of ['biteT','downT','hurtFx','landT'])assert.equal(ctx.PL[k],0,k);
console.log('PASS teacher reset outside minigame heals the host and clears prior combat timers');
// A new sid while already waiting has no phase transition, so the meta callback must re-enter the hall itself.
ctx.G.host=false;ctx.G.phase='lobby';ctx.G.sid=30;Object.assign(ctx.PL,{x:2,y:74,z:-156});
const meta=callbacks.get('meta:value');meta({val:()=>({ph:'lobby',day:1,t:0,sid:31,crystal:200})});
assert.equal(ctx.PL.y,74);assert.ok(Math.abs(ctx.PL.z+160)<10);assert.ok(Math.abs(ctx.PL.x)<=5.1);
ctx.PL.x+=1;const unchangedX=ctx.PL.x;meta({val:()=>({ph:'lobby',day:1,t:0,sid:31,crystal:200})});
assert.equal(ctx.PL.x,unchangedX,'ordinary same-session meta updates must not teleport a waiting guest');
console.log('PASS guest new sid in the same lobby stays on the hall floor without repeated teleports');
const fi=source.indexOf('const friendFloor78='),fe=source.indexOf('\n',source.indexOf('q.air =',fi));assert.ok(fi>=0&&fe>fi);
const air=new Function('q','waiting78','LOBBY78','groundUnder',source.slice(fi,fe)+'\nreturn q.air;');
for(const [lobby,y,down,want]of [[true,74,false,false],[true,74.8,false,true],[true,74.8,true,false],[false,10,false,false],[false,11,false,true]]){
 assert.equal(air({x:0,z:-160,y,down},()=>lobby,{y:74},()=>10),want);
}
console.log('PASS remote avatars use lobby floor only in lobby; real jumps/down/world floor stay correct');
ctx.GMOUTH=[[0,-45]];ctx.GY=10;ctx.tAcc=0;ctx.camera={position:{set(){}},lookAt(){},updateProjectionMatrix(){},updateMatrixWorld(){}};ctx.sounds=[];ctx.sfx=n=>ctx.sounds.push(n);
ctx.G.phase='intro';ctx.G.set.goalDay=18;ctx.LOBBY78.story=0;ctx.LOBBY78.shot=-1;el('story78').dataset={};
vm.runInContext(fn('storyTick78'),ctx);for(let i=0;i<600;i++)vm.runInContext('storyTick78(.01)',ctx);
assert.deepEqual(ctx.sounds,['dusk','stomp','up']);assert.equal(ctx.LOBBY78.story,5);assert.ok(el('storyTitle78').textContent.startsWith('18일'));
console.log('PASS story sounds run once per shot, clamp at five seconds and use configured goal day');
