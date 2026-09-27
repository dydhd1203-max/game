// Use the existing independent host/guest fixture, and execute the actual current construction functions.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {GAME} from './gamefile.mjs';
const source=fs.readFileSync(process.argv[2]||GAME,'utf8'),fixture=fs.readFileSync(new URL('./t56-build-coop-static.mjs',import.meta.url),'utf8');
const begin=fixture.indexOf('function end('),finish=fixture.indexOf("const H=client('host',true)");
assert.ok(begin>=0&&finish>begin);
const {client,bus,setNow}=new Function('source','vm',fixture.slice(begin,finish)+'return {client,bus,setNow:v=>now=v};')(source,vm);
const H=client('host',true),C=client('child',false),results=[];
H.G.players.set('child',{x:12,z:12,n:'child',g:0});C.G.players.set('host',{x:12,z:12,n:'host',g:0});
let now=100000;const at=t=>{now=t;setNow(t);},tick=(t,dt=.6)=>{at(t);H.hostBuildTick(dt);};
function clean(){H.reset();C.reset();H.G.phase=C.G.phase='day';H.G.paused=C.G.paused=false;bus.ref('buildPlans').set(null);bus.ref('buildHands').set(null);bus.ref('base').set(H.base);}
function plan(t='arrow'){C.submitBuildCommand({kind:'plan',t,cells:[[12,12]]});const p=[...H.BUILD_PLANS.values()][0];assert.ok(p&&C.BUILD_PLANS.has(p.id));return p;}
function unchanged(w){assert.deepEqual(structuredClone(H.G.res),w);assert.deepEqual(structuredClone(C.G.res),w);assert.equal(H.STRU.size,0);assert.equal(C.STRU.size,0);}
function pass(name){results.push(name);console.log('PASS '+name);}
clean();at(100000);let p=plan(),wallet=structuredClone(H.G.res);tick(102999);assert.ok(H.BUILD_PLANS.has(p.id)&&C.BUILD_PLANS.has(p.id));unchanged(wallet);
tick(103000);assert.equal(H.BUILD_PLANS.has(p.id),false);assert.equal(C.BUILD_PLANS.has(p.id),false);unchanged(wallet);
pass('Idle plan remains through 2999 ms and disappears on host and guest at 3000 ms without payment');
clean();at(110000);p=plan();wallet=structuredClone(H.G.res);
// The host was suspended past expiry, but a fresh current worker is already building.
at(115000);C.setBuildHand(p.id);H.hostBuildTick(.01);assert.ok(H.BUILD_PLANS.has(p.id));assert.ok(p.prog>0&&p.people===1);assert.equal(p.touched,115000);
unchanged(wallet);pass('Fresh worker wins over an old touched timestamp after a long host frame');
for(let i=1;i<=8;i++){at(115000+i*500);C.setBuildHand(p.id,.6);H.hostBuildTick(.01);assert.ok(H.BUILD_PLANS.has(p.id)&&C.BUILD_PLANS.has(p.id));}
unchanged(wallet);pass('Active worker heartbeats keep a plan alive beyond three seconds on both clients');
at(119000);C.setBuildHand('');const stopped=p.touched;tick(stopped+2999);assert.ok(H.BUILD_PLANS.has(p.id)&&C.BUILD_PLANS.has(p.id));tick(stopped+3000);assert.ok(!H.BUILD_PLANS.has(p.id)&&!C.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('Stopping construction starts a fresh three-second idle window and expiry never charges resources');
clean();at(130000);p=plan();wallet=structuredClone(H.G.res);C.setBuildHand(p.id);H.hostBuildTick(.01);
// No stop packet: worker heartbeat becomes stale; idle plans still expire from their last real contribution.
tick(131599,.01);const last=p.touched;tick(last+3000,.6);assert.ok(!H.BUILD_PLANS.has(p.id)&&!C.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('A disconnected builder cannot keep a plan alive with a stale hand record');
clean();at(140000);p=plan();wallet=structuredClone(H.G.res);at(145000);C.hostBuildTick(10);assert.ok(C.BUILD_PLANS.has(p.id)&&H.BUILD_PLANS.has(p.id));unchanged(wallet);
H.hostBuildTick(.6);assert.ok(!C.BUILD_PLANS.has(p.id)&&!H.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('Guest tick cannot expire authoritative plans; host expiry broadcasts the removal');
fs.mkdirSync('artifacts/build79',{recursive:true});fs.writeFileSync('artifacts/build79/idle-results.json',JSON.stringify({passed:results.length,results},null,2));
console.log(`${results.length}/${results.length} blueprint idle lifecycle checks passed.`);
