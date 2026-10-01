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
// 82차 — a blueprint that already has progress waits BUILD_PLAN_KEEP after its last worker (HUD: '손을 떼도 진행 유지'); unstarted ones keep the 79차 three seconds.
const KEEP=+/BUILD_PLAN_KEEP\s*=\s*(\d+)/.exec(source)[1];assert.ok(KEEP>3000);
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
at(119000);C.setBuildHand('');const stopped=p.touched,progress=p.prog;tick(stopped+3000);assert.ok(H.BUILD_PLANS.has(p.id)&&C.BUILD_PLANS.has(p.id)&&p.prog===progress&&C.BUILD_PLANS.get(p.id).prog===progress);
tick(stopped+KEEP-1);assert.ok(H.BUILD_PLANS.has(p.id)&&C.BUILD_PLANS.has(p.id));tick(stopped+KEEP);assert.ok(!H.BUILD_PLANS.has(p.id)&&!C.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('Letting go keeps a started blueprint and its progress past three seconds, then it expires after the keep window without payment');
clean();at(130000);p=plan();wallet=structuredClone(H.G.res);C.setBuildHand(p.id);H.hostBuildTick(.01);
// No stop packet: worker heartbeat becomes stale; idle plans still expire from their last real contribution.
tick(131599,.01);const last=p.touched,lastProg=p.prog;tick(last+3000,.6);assert.ok(H.BUILD_PLANS.has(p.id)&&p.people===0&&p.prog===lastProg);
tick(last+KEEP,.6);assert.ok(!H.BUILD_PLANS.has(p.id)&&!C.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('A disconnected builder cannot keep a plan alive with a stale hand record');
clean();at(140000);p=plan();wallet=structuredClone(H.G.res);at(145000);C.hostBuildTick(10);assert.ok(C.BUILD_PLANS.has(p.id)&&H.BUILD_PLANS.has(p.id));unchanged(wallet);
H.hostBuildTick(.6);assert.ok(!C.BUILD_PLANS.has(p.id)&&!H.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('Guest tick cannot expire authoritative plans; host expiry broadcasts the removal');
// 82차 — a wall line ('벽 이어짓기', one command) is one job: building any cell keeps every cell; 79차 deleted all but the held cell after 3 s.
clean();at(150000);C.submitBuildCommand({kind:'plan',t:'wwall',cells:[[12,12],[13,12],[14,12],[15,12]]});
const line=[...H.BUILD_PLANS.values()];assert.equal(line.length,4);assert.ok(line.every(q=>q.line&&q.line===line[0].line&&C.BUILD_PLANS.get(q.id)?.line===q.line));
wallet=structuredClone(H.G.res);at(152500);C.setBuildHand(line[0].id);H.hostBuildTick(.01);
for(let t=153000;t<=158000;t+=500){at(t);C.setBuildHand(line[0].id,.6);H.hostBuildTick(.01);}
assert.ok(line.every(q=>H.BUILD_PLANS.has(q.id)&&C.BUILD_PLANS.has(q.id)));unchanged(wallet);
pass('Working on one cell of a wall line keeps the whole line alive beyond three seconds');
C.setBuildHand('');const lineStop=line[0].touched;tick(lineStop+2999);assert.ok(line.every(q=>H.BUILD_PLANS.has(q.id)));
tick(lineStop+3000);assert.ok(line.slice(1).every(q=>!H.BUILD_PLANS.has(q.id)&&!C.BUILD_PLANS.has(q.id))&&H.BUILD_PLANS.has(line[0].id));unchanged(wallet);
pass('An abandoned line still drops its unstarted cells three seconds after the last work');
clean();at(180000);C.submitBuildCommand({kind:'plan',t:'wwall',cells:[[12,12],[13,12]]});const [w1,w2]=[...H.BUILD_PLANS.values()];
at(182900);C.setBuildHand(w1.id);H.hostBuildTick(3);assert.ok(H.STRU.has(w1.id)&&C.STRU.has(w1.id)&&H.BUILD_PLANS.has(w2.id)&&w2.touched===182900);
tick(182900+2999);assert.ok(H.BUILD_PLANS.has(w2.id));tick(182900+3000);assert.ok(!H.BUILD_PLANS.has(w2.id)&&!C.BUILD_PLANS.has(w2.id));
pass('Finishing one line cell gives the builder three seconds to move to the next cell');
clean();at(170000);C.submitBuildCommand({kind:'plan',t:'wwall',cells:[[12,12]]});C.submitBuildCommand({kind:'plan',t:'wwall',cells:[[14,12]]});
const [s1,s2]=[...H.BUILD_PLANS.values()];assert.ok(s1&&s2&&!s1.line&&!s2.line);wallet=structuredClone(H.G.res);
for(let t=170000;t<=173000;t+=500){at(t);C.setBuildHand(s1.id,.6);H.hostBuildTick(.01);}
C.setBuildHand(s1.id,.6);H.hostBuildTick(.6);assert.ok(H.BUILD_PLANS.has(s1.id)&&!H.BUILD_PLANS.has(s2.id)&&!C.BUILD_PLANS.has(s2.id)&&C.BUILD_PLANS.has(s1.id));unchanged(wallet);
pass('Separately placed blueprints stay independent: an untouched one still disappears after three seconds');
// 82차 — a 4 fps child: every frame's dt is clamped to 0.05 s, but the hand is refreshed by wall clock (≤0.6 s), so the host never drops the worker.
clean();at(190000);p=plan();wallet=structuredClone(H.G.res);C.setBuildHand(p.id,.05);H.hostBuildTick(.05);let minPeople=9;
for(let t=190250;t<=196000;t+=250){at(t);C.setBuildHand(p.id,.05);H.hostBuildTick(.05);minPeople=Math.min(minPeople,p.people);}
assert.equal(minPeople,1);assert.ok(H.BUILD_PLANS.has(p.id));unchanged(wallet);
pass('A low-frame-rate builder refreshes its hand in real time and never drops out of the shared meter');
fs.mkdirSync('artifacts/build79',{recursive:true});fs.writeFileSync('artifacts/build79/idle-results.json',JSON.stringify({passed:results.length,results},null,2));
console.log(`${results.length}/${results.length} blueprint idle lifecycle checks passed.`);
