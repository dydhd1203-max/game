import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,addPlayer} from '../src/sim.mjs';
import {migrateCheckpoint} from '../src/save.mjs';
import {BUILD,walkable} from '../src/content.mjs';

for(const version of ['s2-001','s2-002','s2-003'])test(`${version} checkpoints migrate moved village plots without mutating progress`,()=>{
  const state=createState();addPlayer(state,{id:'teacher',name:'선생님',hat:16});
  state.version=version;state.phase='village';state.supplies=913;
  Object.assign(state.players.teacher,version==='s2-002'?{x:-11,z:18}:{x:-8,z:9});
  state.towers=[{id:'saved',type:'arrow',hp:83,state:'inventory'}];
  delete state.players.teacher.y;delete state.players.teacher.stamina;delete state.players.teacher._jumpSeq;
  const saved={season:2,version,state},original=structuredClone(saved);
  const next=migrateCheckpoint(saved);
  assert.equal(next.version,BUILD);assert.equal(next.supplies,913);
  assert.equal(next.players.teacher.y,.08);assert.equal(next.players.teacher.stamina,1);assert.equal(next.players.teacher._jumpSeq,0);
  assert.deepEqual(next.towers,state.towers);assert.equal(next.players.teacher.hat,16);
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
