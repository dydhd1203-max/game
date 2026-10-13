import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createSeason1Presentation} from '../src/presentation-season1.mjs';

const source=fs.readFileSync(new URL('../../클로드/index.html',import.meta.url),'utf8');
const harness=fs.readFileSync(new URL('../../깃허브에올릴것/검사/t54-avatar-static.mjs',import.meta.url),'utf8');
const lexical=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const fixtures='));
const {fn,declaration}=new Function('source',lexical+'\nreturn {fn,declaration};')(source);
function reference(){
  const context=vm.createContext({});
  new vm.Script(`const raceOn=()=>false,stairRampAt=()=>null;${declaration('FRB')}\n${fn('friendSeg')}\n${fn('friendLerp')}\nglobalThis.API={friendSeg,friendLerp};`).runInContext(context);
  return context.API;
}
const player=(id,x=0)=>({id,x,y:.08,z:0,yaw:0,hp:100,online:true,run:false,air:false,gp:0});
const state=(time,peerX=0)=>({time,phase:'village',players:{me:player('me'),peer:player('peer',peerX)},towers:[],enemies:[]});

test('Guest replay positions match actual Season 1 friendSeg/friendLerp under irregular 10 Hz delivery',()=>{
  const api=createSeason1Presentation(),original=reference(),q={};
  let snapshot=state(0),tick=0,lastX=-Infinity,positiveSteps=0,frameCount=0;
  const jitter=[0,.027,-.013,.014,-.020,.018];
  let next=0;
  for(let frame=0;frame<600;frame++){
    const time=frame/60;
    if(time+1e-9>=next){
      snapshot=state(time,tick*.5);original.friendSeg(q,tick*.5,.08,0,time);
      tick++;next=tick*.1+jitter[tick%jitter.length];
    }
    const displayed=api.sample(snapshot,'me',1/60,{interpolate:true,time});original.friendLerp(q,time);
    assert.equal(displayed.players.peer.x,q.x);assert.equal(displayed.players.peer.y,q.y);assert.equal(displayed.players.peer.z,q.z);
    assert.ok(displayed.players.peer.x>=lastX,'irregular arrivals never slide the peer backwards');
    if(frame>60){frameCount++;if(displayed.players.peer.x>lastX)positiveSteps++;}
    lastX=displayed.players.peer.x;
  }
  assert.ok(positiveSteps/frameCount>.95,'replay produces motion on render frames between packets');
});

test('Presentation keeps stable object identities and never mutates authoritative or predicted players',()=>{
  const api=createSeason1Presentation(),snapshot=state(1,5),predicted=Object.freeze({...snapshot.players.me,x:8,gp:3});
  Object.freeze(snapshot.players.me);Object.freeze(snapshot.players.peer);Object.freeze(snapshot.players);Object.freeze(snapshot);
  const first=api.sample(snapshot,'me',1/60,{interpolate:true,localPlayer:predicted,time:1});
  const local=first.players.me,peer=first.players.peer;assert.notEqual(local,predicted);assert.equal(local.x,8);assert.equal(local.gp,3);
  const next=state(1.1,6);const second=api.sample(next,'me',1/60,{interpolate:true,localPlayer:predicted,time:1.1});
  assert.equal(second,first);assert.equal(second.players.me,local);assert.equal(second.players.peer,peer);
  assert.equal(snapshot.players.peer.x,5);assert.equal(next.players.peer.x,6);assert.ok(peer.x<6);
  assert.equal(second.towers,next.towers,'non-player simulation data is shared read-only');
  assert.equal(predicted.x,8);assert.equal(predicted.gp,3);
});

test('Host movement has no replay lag; peer removal, mode changes and checkpoint rollback reset presentation',()=>{
  const api=createSeason1Presentation(),a=state(4,5);
  assert.equal(api.sample(a,'me',1/60).players.peer.x,5);a.players.peer.x=6;a.time+=1/60;
  assert.equal(api.sample(a,'me',1/60).players.peer.x,6);
  delete a.players.peer;assert.equal(api.sample(a,'me',1/60).players.peer,undefined);
  const fresh=state(5,8);assert.equal(api.sample(fresh,'me',1/60,{interpolate:true,time:5}).players.peer.x,8);
  const reset=state(0,0);assert.equal(api.sample(reset,'me',1/60,{interpolate:true,time:6}).players.peer.x,0);
  api.reset();const another=state(1,22);assert.equal(api.sample(another,'me',1/60,{interpolate:true,time:10}).players.peer.x,22);
});

test('A teleported peer snaps instead of crossing buildings and local motion flags remain authoritative',()=>{
  const api=createSeason1Presentation();let snapshot=state(0,0);
  api.sample(snapshot,'me',1/60,{interpolate:true,time:0});
  snapshot=state(.1,30);Object.assign(snapshot.players.me,{x:7,y:1.4,air:true,ground:false,run:true,gp:4.5,take:.08,land:0,flip:.3,aim:true});
  const shown=api.sample(snapshot,'me',1/60,{interpolate:true,time:.1});
  assert.equal(shown.players.peer.x,30);assert.deepEqual(shown.players.me,snapshot.players.me);
  snapshot=state(.2,30);snapshot.players.peer.y=2;
  const airborne=api.sample(snapshot,'me',1/60,{interpolate:true,time:.2});
  assert.equal(airborne.players.peer.air,false,'jump pose does not precede delayed displayed feet');
  const later=api.sample(snapshot,'me',1/60,{interpolate:true,time:1});
  assert.equal(later.players.peer.air,true);assert.equal(later.players.peer.y,2);
  assert.equal(later.players.peer.gp,undefined,'source remote gait follows displayed distance');
});
