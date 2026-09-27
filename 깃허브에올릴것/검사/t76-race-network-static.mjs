// The actual peer playback buffer must interpolate fast race movement, while still snapping respawns.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GAME } from './gamefile.mjs';
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const start=source.indexOf('const FRB = '),end=source.indexOf('function camStepTick(',start);
assert.ok(start>=0&&end>start,'Actual peer playback functions exist');
const ctx=vm.createContext({Float64Array,Uint8Array,Math,console});
new vm.Script(`let racing=true;const raceOn=()=>racing,stairRampAt=()=>null;${source.slice(start,end)}
 globalThis.api={friendSeg,friendLerp,setRace:v=>racing=v};`).runInContext(ctx);
const A=ctx.api;
function replay(name,position,seconds=1.2,arrival=i=>i/6){
  const p={},N=Math.ceil(seconds*6);let snaps=0;const trace=[];
  for(let i=0;i<=N;i++){const t=i/6,q=position(t);A.friendSeg(p,q[0],q[1],q[2],arrival(i));if(i)snaps+=p.fj[p.fn-1];}
  const q=p.fq;
  for(let i=0;i<p.fn-1;i++){
    const t=(q[i*4+3]+q[(i+1)*4+3])/2;A.friendLerp(p,t);
    if(!p.fj[i+1])for(const [j,key]of ['x','y','z'].entries())assert.ok(Math.abs(p[key]-(q[i*4+j]+q[(i+1)*4+j])/2)<1e-7,`${name}: midpoint is interpolated`);
    trace.push({x:p.x,y:p.y,z:p.z});
  }return {name,snaps,samples:trace.length};
}
const cases=[];
cases.push(replay('donut launch and landing',t=>[0,100+Math.max(0,81.79536661694232*t-.5*144.8096*t*t),244+49.56*t]));
cases.push(replay('fast slide',t=>[0,130-t*30,700+66*t]));
const jitter=i=>i/6+[0,.11,.01,.09,.03,.12,0][i%7];
cases.push(replay('donut with classroom arrival jitter',t=>[0,100+Math.max(0,81.79536661694232*t-.5*144.8096*t*t),244+49.56*t],1.2,jitter));
cases.push(replay('slide with classroom arrival jitter',t=>[0,130-t*30,700+66*t],1.2,jitter));
assert.ok(cases.every(c=>c.snaps===0),'Normal fast race movement is never classified as teleportation');
const respawn={};A.friendSeg(respawn,12,91,610,0);A.friendSeg(respawn,-7,130,578,1/6);
assert.equal(respawn.fj[respawn.fn-1],1,'Section-entry respawn is still a teleport');
A.setRace(false);
const village={};A.friendSeg(village,0,0,0,0);A.friendSeg(village,9,7,0,1/6);
assert.equal(village.fj[village.fn-1],1,'Village retains its original teleport thresholds');
const walking=replay('village walking',t=>[t*5.94,0,0]);assert.equal(walking.snaps,0);
console.log('PASS: fast race peers interpolate; respawn and village thresholds remain intact',JSON.stringify(cases));
