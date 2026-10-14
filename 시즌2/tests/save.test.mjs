import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,addPlayer,applyAction,step} from '../src/sim.mjs';
import {migrateCheckpoint} from '../src/save.mjs';
import {BUILD,walkable} from '../src/content.mjs';

for(const version of ['s2-001','s2-002','s2-003','s2-004','s2-007'])test(`${version} checkpoints migrate moved village plots without mutating progress`,()=>{
  const state=createState();addPlayer(state,{id:'teacher',name:'선생님',hat:16});
  state.version=version;state.phase='village';state.supplies=913;
  Object.assign(state.players.teacher,version==='s2-002'?{x:-11,z:18}:{x:-8,z:9});
  state.towers=[{id:'saved',type:'arrow',hp:83,state:'inventory'}];
  delete state.players.teacher.y;delete state.players.teacher.stamina;delete state.players.teacher._jumpSeq;
  const saved={season:2,version,state},original=structuredClone(saved);
  const next=migrateCheckpoint(saved);
  assert.equal(next.version,BUILD);assert.equal(next.supplies,913);
  assert.equal(next.players.teacher.y,.08);assert.equal(next.players.teacher.stamina,1);assert.equal(next.players.teacher._jumpSeq,0);
  assert.deepEqual(next.towers,[]);assert.equal(next.players.teacher.hat,16);
  assert.ok(walkable(next.players.teacher.x,next.players.teacher.z,.65));
  assert.deepEqual(saved,original);
  assert.deepEqual(migrateCheckpoint({season:2,version:BUILD,state:next}),next);
});

test('checkpoint migration rejects other seasons and unknown or mismatched versions',()=>{
  const state=createState();
  for(const saved of [null,{season:1,version:BUILD,state},{season:2,version:'future',state},
    {season:2,version:'s2-001',state},{season:2,version:BUILD,state:{version:BUILD}}]){
    assert.equal(migrateCheckpoint(saved),null);
  }
});

for(const phase of ['forest','boss','defeat','village'])test(`loading ${phase} checkpoints retires all shared towers without altering the original save`,()=>{
  const state=createState();addPlayer(state,{id:'teacher',name:'선생님'});
  state.version='s2-004';state.phase=phase;state.supplies=913;state.stage=1;state.beacon=true;
  state.message='봉화가 켜졌어요! 얼음 + 화살 조합으로 앞길을 정리하고 숲길 입구로 가요.';
  state._checkpoint={supplies:800,partySize:1,towers:[{id:'retry-tower',type:'arrow',hp:100,state:'deployed'}]};
  state.towers=['deployed','placing','packing','carried','inventory','destroyed'].map((kind,i)=>({
    id:`old-${i}`,type:'arrow',hp:100,state:kind,carrier:'teacher',progress:1}));
  const saved={season:2,version:'s2-004',state},original=structuredClone(saved);
  const next=migrateCheckpoint(saved);
  assert.deepEqual(saved,original,'loading never overwrites or mutates user data');
  assert.deepEqual(next.towers,[]);assert.deepEqual(next._checkpoint.towers,[]);
  assert.equal(next.supplies,913);assert.equal(next.stage,1);assert.equal(next.beacon,true);
  assert.equal(next.message,'봉화가 켜졌어요! 앞길의 좀비를 정리하고 숲길 입구로 가요.');
  assert.equal(next._checkpoint.supplies,800);assert.equal(next._checkpoint.partySize,1);
  assert.deepEqual(migrateCheckpoint({season:2,version:BUILD,state:next}),next,'migration is idempotent');
  if(phase==='defeat') {
    assert.equal(applyAction(next,'teacher',{type:'retry'},{teacher:true}).ok,true);
    assert.deepEqual(next.towers,[]);assert.equal(next.supplies,800);
    step(next,1/30,{teacher:{sprint:true,mz:-1,attack:true}});
    assert.deepEqual(next.towers,[],'retry cannot resurrect old checkpoint towers');
  }
});

// Old village players can be standing in the reclaimed lawn or inside a moved
// structure. Recovery must move the entire roster without changing its save.
test('s2-007 village save recovers 21 players from removed lawn and moved plots',()=>{
  const state=createState();state.phase='village';state.version='s2-007';state.supplies=913;
  for(let i=0;i<21;i++){
    addPlayer(state,{id:`p${i}`,name:`대원${i}`,hat:i%17});
    Object.assign(state.players[`p${i}`],{x:i%2?28:-9.4,z:i%2?30:24,y:3,vy:4});
  }
  const saved={season:2,version:'s2-007',state},original=structuredClone(saved),next=migrateCheckpoint(saved);
  assert.deepEqual(saved,original);assert.equal(next.supplies,913);
  const positions=new Set();
  for(const p of Object.values(next.players)){
    assert.ok(walkable(p.x,p.z,.65));assert.equal(p.y,.08);assert.equal(p.vy,0);
    positions.add(`${p.x}:${p.z}`);
  }
  assert.equal(positions.size,21,'recovered players retain distinct slots');
});
