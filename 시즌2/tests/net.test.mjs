import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createNetwork,DB_ROOT,NETWORK_VERSION,NET_STATUS} from '../src/net.mjs';
if (!globalThis.crypto) globalThis.crypto=webcrypto;

const clone=value=>value===undefined ? null : structuredClone(value);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fakeDatabase() {
  let data={'.info':{connected:true}};
  const listeners=[],hooks=new Set(),writes=[];
  let rejectPath=null,holdPath=null;
  const held=[];
  const get=path=>path.split('/').filter(Boolean).reduce((at,key)=>at?.[key],data) ?? null;
  const snapshot=(path,value=get(path))=>({key:path.split('/').at(-1),val:()=>clone(value),ref:ref(path)});
  const emit=before=>{
    for (const listener of [...listeners]) {
      const old=listener.path.split('/').filter(Boolean).reduce((at,key)=>at?.[key],before) ?? null;
      const current=get(listener.path);
      if(JSON.stringify(old)===JSON.stringify(current))continue;
      if(listener.event==='value')queueMicrotask(()=>listener.callback(snapshot(listener.path,current)));
      else for (const [key,value] of Object.entries(current || {})) {
        const kind=old?.[key]===undefined?'child_added':'child_changed';
        if(listener.event===kind && JSON.stringify(old?.[key])!==JSON.stringify(value))queueMicrotask(()=>listener.callback(snapshot(`${listener.path}/${key}`,value)));
      }
    }
  };
  function set(path,value) {
    if(rejectPath && path.includes(rejectPath))return Promise.reject(new Error('permission denied'));
    if(holdPath && path.includes(holdPath))return new Promise((resolve,reject)=>held.push(()=>set(path,value).then(resolve,reject)));
    const before=clone(data),parts=path.split('/').filter(Boolean);
    let at=data;
    for(const part of parts.slice(0,-1))at=at[part]??={};
    if(value===null)delete at[parts.at(-1)];else at[parts.at(-1)]=clone(value);
    writes.push({path,value:clone(value)});emit(before);return Promise.resolve();
  }
  function ref(path) {return {
    path,key:path.split('/').at(-1),child:part=>ref(`${path}/${part}`),
    set:value=>set(path,value),remove:()=>set(path,null),once:async()=>snapshot(path),
    transaction:async(fn)=>{const value=fn(clone(get(path)));if(value===undefined)return{committed:false,snapshot:snapshot(path)};await set(path,value);return{committed:true,snapshot:snapshot(path)};},
    on(event,callback){listeners.push({path,event,callback});if(event==='value')queueMicrotask(()=>callback(snapshot(path)));if(event==='child_added')for(const key of Object.keys(get(path)||{}).sort())queueMicrotask(()=>callback(snapshot(`${path}/${key}`)));},
    off(event,callback){const index=listeners.findIndex(l=>l.path===path&&l.event===event&&l.callback===callback);if(index>=0)listeners.splice(index,1);},
    onDisconnect(){const hook={path,remove:async()=>{hooks.add(hook);},cancel:async()=>{hooks.delete(hook);}};return hook;},
  };}
  return {ref,get,writes,listeners,hooks,set,held,reject(value){rejectPath=value;},hold(path){holdPath=path;},release(){holdPath=null;for(const fn of held.splice(0))fn();},async disconnectAll(){for(const hook of [...hooks]){hooks.delete(hook);await set(hook.path,null);}await set('.info/connected',false);await flush();}};
}
const memoryStore=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};};
function fixture() {
  const database=fakeDatabase(),created=[],intervals=new Map();let now=1000,timer=0;
  const timers={setInterval(fn){intervals.set(++timer,fn);return timer;},clearInterval(id){intervals.delete(id);}};
  function make(overrides={}) {
    const events={status:[],roster:[],input:[],action:[],snapshot:[]};
    const network=createNetwork({database,storage:memoryStore(),clock:()=>now,timers,onStatus:value=>events.status.push(value),onRoster:value=>events.roster.push(value),onInput:(...value)=>events.input.push(value),onAction:(...value)=>events.action.push(value),onSnapshot:value=>events.snapshot.push(value),...overrides});
    created.push(network);return {network,events};
  }
  return {database,make,intervals,advance:n=>{now+=n;},tick:()=>{for(const fn of intervals.values())fn();},async close(){await Promise.all(created.map(n=>n.close()));await flush();}};
}
const profile=id=>({id,name:id,team:1,hat:0});
const connect=(client,mode='host',id=mode)=>client.network.connect({mode,room:'CLASS-1',profile:profile(id)});
const state=phase=>({version:NETWORK_VERSION,phase,players:{},time:1});
const root=`${DB_ROOT}/CLASS-1`;

test('solo needs no Firebase and dispatches local input/action',async()=>{
  const f=fixture(),client=f.make();
  const result=await connect(client,'solo','teacher');
  client.network.sendInput({mx:99,mz:NaN,attack:1});client.network.sendAction({type:'start'});
  assert.equal(result.isHost,true);assert.equal(result.hostId,'teacher');
  assert.equal(client.events.input[0][1].mx,1);assert.equal(client.events.input[0][1].mz,0);
  assert.deepEqual(client.events.action,[['teacher',{type:'start'}]]);
  assert.equal(f.database.writes.length,0);await f.close();
});

test('host claim is exclusive; only the stored host token can resume',async()=>{
  const f=fixture(),storage=memoryStore(),first=f.make({storage}),outsider=f.make();
  await connect(first,'host','teacher');await flush();
  await assert.rejects(connect(outsider,'host','intruder'),/이미 사용 중/);
  assert.equal(f.database.get(`${root}/meta`).hostId,'teacher');
  const resumed=f.make({storage});
  const result=await connect(resumed,'host','new-generated-id');await flush();
  assert.equal(result.localId,'teacher');assert.equal(result.hostId,'teacher');
  assert.equal(first.events.status.at(-1),NET_STATUS.replaced);
  first.network.sendAction({type:'start'});assert.equal(first.events.action.length,0);
  await f.close();
});

test('all room writes use the Season 2 namespace and token never enters Firebase',async()=>{
  const f=fixture(),storage=memoryStore(),host=f.make({storage});
  await connect(host);await flush();host.network.publish(state('village'));await flush();
  assert.equal(DB_ROOT,'sheepnight/season2_v1/rooms');
  assert.ok(f.database.writes.every(w=>w.path.startsWith(`${DB_ROOT}/`)));
  const token=storage.getItem('zns2:host:CLASS-1');
  assert.equal(token.length,48);assert.ok(!JSON.stringify(f.database.get(root)).includes(token));
  await f.close();
});

test('join rejects absent and incompatible rooms without falling back to solo',async()=>{
  const f=fixture(),client=f.make();
  await assert.rejects(connect(client,'join'),/아직 없는 방/);
  assert.equal(client.network.isHost,false);
  await f.database.set(`${root}/meta`,{version:'s2-001',hostId:'teacher',session:'old'});
  await assert.rejects(connect(client,'join'),/게임 버전이 달라/);
  assert.ok(client.events.status.at(-1).startsWith('연결 실패:'));
  await f.close();
});

test('join receives the latest snapshot, while stale versions and old host sessions are rejected',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();
  await connect(host,'host','teacher');await flush();host.network.publish(state('forest'));await flush();
  await connect(guest,'join','student');await flush();
  assert.equal(guest.events.snapshot.at(-1).phase,'forest');
  const valid=f.database.get(`${root}/snapshot`),count=guest.events.snapshot.length;
  await f.database.set(`${root}/snapshot`,{...valid,seq:10,hostSession:'old'});await flush();
  assert.equal(guest.events.snapshot.length,count);
  await f.database.set(`${root}/snapshot`,{...valid,seq:11,state:{...valid.state,version:'wrong'}});await flush();
  assert.equal(guest.events.snapshot.length,count);assert.match(guest.events.status.at(-1),/버전/);
  await f.close();
});

test('host reload restores the last state and returns the same canonical teacher id',async()=>{
  const f=fixture(),storage=memoryStore(),host=f.make({storage});
  await connect(host,'host','teacher');await flush();host.network.publish(state('boss'));await flush();await host.network.close();
  const reload=f.make({storage});const result=await connect(reload,'host','new-id');await flush();
  assert.equal(result.resumed,true);assert.equal(result.snapshot.phase,'boss');assert.equal(result.localId,'teacher');
  assert.equal(reload.events.snapshot[0].phase,'boss');await f.close();
});

test('guest commands dispatch once and stale sessions cannot replay after reconnect',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();
  await connect(host,'host','teacher');await connect(guest,'join','student');await flush();
  guest.network.sendAction({type:'build',towerType:'ice',x:2,z:3});await flush();
  assert.equal(host.events.action.length,1);assert.equal(host.events.action[0][0],'student');
  const sent=f.database.writes.find(w=>w.path.includes('/commands/')&&w.value);
  await f.database.set(sent.path,sent.value);await flush();assert.equal(host.events.action.length,1);
  await guest.network.close();await connect(guest,'join','student');await flush();
  await f.database.set(sent.path,{...sent.value,seq:999});await flush();assert.equal(host.events.action.length,1);
  guest.network.sendAction({type:'interact'});await flush();assert.equal(host.events.action.length,2);
  assert.equal(Object.keys(f.database.get(`${root}/commands`)||{}).length,0);await f.close();
});

test('input transport is limited to 20 Hz and snapshots to 10 Hz',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();
  await connect(host,'host','teacher');await connect(guest,'join','student');await flush();
  for(let n=0;n<20;n++){guest.network.sendInput({mx:1,mz:0});host.network.publish(state('forest'));}
  await flush();
  assert.equal(f.database.writes.filter(w=>w.path.includes('/inputs/')).length,1);
  assert.equal(f.database.writes.filter(w=>w.path.endsWith('/snapshot')).length,1);
  f.advance(50);guest.network.sendInput({mx:0,mz:1});host.network.publish(state('forest'));await flush();
  assert.equal(host.events.input.length,2);assert.equal(f.database.writes.filter(w=>w.path.endsWith('/snapshot')).length,1);
  f.advance(50);host.network.publish(state('boss'));await flush();
  assert.equal(guest.events.snapshot.at(-1).phase,'boss');await f.close();
});

test('presence tracks departure and closing all clients removes every listener and timer',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();
  await connect(host,'host','teacher');await connect(guest,'join','student');await flush();
  assert.equal(host.events.roster.at(-1).find(p=>p.id==='student').online,true);
  await guest.network.close();await flush();
  assert.equal(host.events.roster.at(-1).find(p=>p.id==='student').online,false);
  await f.close();assert.equal(f.database.listeners.length,0);assert.equal(f.database.hooks.size,0);assert.equal(f.intervals.size,0);
});

test('host departure pauses guests and heartbeat silence is detected',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();
  await connect(host,'host','teacher');await connect(guest,'join','student');await flush();
  f.advance(21000);f.tick();assert.equal(guest.events.status.at(-1),NET_STATUS.hostLost);await flush();
  await host.network.close();await flush();assert.equal(guest.events.status.at(-1),NET_STATUS.hostLost);
  await f.close();
});

test('permission errors are reported and failed connect leaves no listeners',async()=>{
  const f=fixture(),host=f.make();f.database.reject('/meta');
  await assert.rejects(connect(host),/permission denied/);await flush();
  assert.match(host.events.status.at(-1),/연결 실패/);assert.equal(f.database.listeners.length,0);
  f.database.reject(null);await connect(host);await flush();f.database.reject('/snapshot');
  host.network.publish(state('village'));await flush();assert.match(host.events.status.at(-1),/전송 실패/);
  f.database.reject(null);await f.close();
});

test('a previous tab closing cannot remove its replacement session presence',async()=>{
  const f=fixture(),host=f.make(),old=f.make(),replacement=f.make();
  await connect(host,'host','teacher');await connect(old,'join','student');await connect(replacement,'join','student');await flush();
  assert.equal(old.events.status.at(-1),NET_STATUS.replaced);
  await old.network.close();await flush();
  assert.equal(host.events.roster.at(-1).find(p=>p.id==='student').online,true);await f.close();
});

test('21 player class joins, room cap is atomic, and inactive players free capacity',async()=>{
  const f=fixture(),host=f.make();await connect(host,'host','teacher');
  const guests=[];
  for(let i=0;i<20;i++){const guest=f.make();guests.push(guest);await connect(guest,'join',`student-${i}`);}
  await flush();assert.equal(host.events.roster.at(-1).filter(p=>p.online).length,21);
  const extra=f.make();await assert.rejects(connect(extra,'join','extra'),/최대 21명/);
  await guests[0].network.close();await flush();await connect(extra,'join','extra');await flush();
  assert.equal(host.events.roster.at(-1).filter(p=>p.online).length,21);await f.close();
});

test('slow writes keep only one in flight and the latest queued snapshot/input',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();
  await connect(host,'host','teacher');await connect(guest,'join','student');await flush();
  f.database.hold('/snapshot');
  for(let i=0;i<30;i++){host.network.publish({...state('forest'),time:i});f.advance(100);}
  assert.equal(f.database.held.length,1);f.database.release();await flush();
  const snapshots=f.database.writes.filter(w=>w.path.endsWith('/snapshot'));
  assert.equal(snapshots.length,2);assert.equal(snapshots[0].value.state.time,0);assert.equal(snapshots[1].value.state.time,29);
  f.database.hold('/inputs/');
  for(let i=0;i<30;i++){guest.network.sendInput({mx:i%2,mz:0,yaw:i});f.advance(50);}
  assert.equal(f.database.held.length,1);f.database.release();await flush();
  assert.equal(host.events.input.length,2);assert.equal(host.events.input[1][1].yaw,29%(Math.PI*2));await f.close();
});

test('offline close detaches immediately while preserving server cleanup until acknowledgement',async()=>{
  const f=fixture(),host=f.make();await connect(host);await flush();
  f.database.hold('/sessions/');let finished=false;
  host.network.close().then(()=>{finished=true;});await flush();
  assert.equal(finished,true);assert.equal(f.database.listeners.length,0);assert.equal(f.intervals.size,0);
  assert.ok(f.database.hooks.size>0);f.database.release();await flush();assert.equal(f.database.hooks.size,0);
  await f.close();
});

test('room names cannot escape the reserved Season 2 subtree',async()=>{
  const f=fixture(),host=f.make();
  for(const room of ['../ABCD','ABCD/meta','ABC.D','A#BC','A$BC','A[BC','A]BC']) {
    await assert.rejects(host.network.connect({mode:'host',room,profile:profile('teacher')}),/방 이름/);
  }
  assert.equal(f.database.writes.length,0);
  await host.network.connect({mode:'host',room:'safe-room',profile:profile('teacher')});await flush();
  assert.equal(host.network.room,'SAFE-ROOM');
  assert.ok(f.database.writes.every(w=>w.path.startsWith('sheepnight/season2_v1/rooms/SAFE-ROOM/')));
  await f.close();
});

test('Season 1 cosmetic IDs survive profile, roster and action transport',async()=>{
  const f=fixture(),host=f.make(),guest=f.make();await connect(host,'host','teacher');
  await guest.network.connect({mode:'join',room:'CLASS-1',profile:{...profile('student'),hat:16,face:11,clothes:13}});await flush();
  const member=host.events.roster.at(-1).find(p=>p.id==='student');
  assert.deepEqual({hat:member.hat,face:member.face,clothes:member.clothes},{hat:16,face:11,clothes:13});
  guest.network.sendAction({type:'cosmetic',hat:15,face:10,clothes:12});await flush();
  assert.deepEqual(host.events.action.at(-1),['student',{type:'cosmetic',hat:15,face:10,clothes:12}]);
  const invalid=f.make();
  await invalid.network.connect({mode:'join',room:'CLASS-1',profile:{...profile('invalid'),hat:99,face:-1,clothes:99}});await flush();
  const safe=host.events.roster.at(-1).find(p=>p.id==='invalid');
  assert.deepEqual({hat:safe.hat,face:safe.face,clothes:safe.clothes},{hat:16,face:0,clothes:13});await f.close();
});
