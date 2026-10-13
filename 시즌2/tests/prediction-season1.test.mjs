import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason1Prediction} from '../src/prediction-season1.mjs';
import {createState,addPlayer,advancePlayerMovement} from '../src/sim.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){const state=createState();addPlayer(state,{id:'me',name:'예측'});state.phase='village';Object.assign(state.players.me,{x:0,z:0});return state;}
const forward={mx:0,mz:-1,yaw:0,jumpSeq:0};
function deepFreeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}

test('Guest input moves immediately with shared collision physics, without modifying host state or executing combat',()=>{
  const state=fixture();state.enemies=[{id:'z',x:0,z:-2,hp:30}];state.phase='forest';
  const before=clone(state);deepFreeze(state);
  const prediction=createSeason1Prediction(),expected={...state.players.me};
  const input={...forward,attack:true};let cached;
  for(let frame=0;frame<30;frame++){
    advancePlayerMovement(state,expected,1/60,input);
    const shown=prediction.sample(state,'me',1/60,input);cached??=shown;assert.equal(shown,cached);
    assert.equal(shown.x,expected.x);assert.equal(shown.y,expected.y);assert.equal(shown.z,expected.z);
    assert.equal(shown.gp,expected.gp);
  }
  assert.ok(cached.z<-2);assert.deepEqual(state,before);assert.equal(state.enemies[0].hp,30);assert.equal(state.events.length,0);
});

test('New snapshots gently reconcile rendered position while collision state follows the authority',()=>{
  const prediction=createSeason1Prediction(),snapshot=fixture();
  let shown;
  for(let frame=0;frame<12;frame++)shown=prediction.sample(snapshot,'me',1/60,forward);
  const prior=shown.z,priorGp=shown.gp,next=clone(snapshot);next.time=.1;next.players.me.z=-.35;
  shown=prediction.sample(next,'me',1/60,{...forward,mz:0});
  assert.ok(Math.abs(shown.z-prior)<.15,'a normal packet correction is not an immediate position snap');
  assert.equal(shown.gp,priorGp,'server correction is not local foot travel');
  assert.ok(Math.abs(shown.z-next.players.me.z)>.1,'render offset is separate from authority');
  for(let frame=0;frame<100;frame++)shown=prediction.sample(next,'me',1/60,{...forward,mz:0});
  assert.ok(Math.abs(shown.z-next.players.me.z)<1e-4,'stationary correction converges');
  assert.equal(next.players.me.z,-.35);
});

test('Unacknowledged jump survives old packets and repeated jump sequences cannot trigger a second jump',()=>{
  const prediction=createSeason1Prediction(),initial=fixture(),expected={...initial.players.me};
  const jump={mx:0,mz:0,yaw:0,jump:true,jumpSeq:1};
  let shown=prediction.sample(initial,'me',1/60,jump);advancePlayerMovement(initial,expected,1/60,jump);
  assert.equal(shown.air,true);
  for(let frame=1;frame<50;frame++){
    const snapshot=clone(initial);snapshot.time=frame/60; // all are sent before host ack
    shown=prediction.sample(snapshot,'me',1/60,jump);advancePlayerMovement(initial,expected,1/60,jump);
    assert.equal(shown.y,expected.y);assert.equal(shown.vy,expected.vy);assert.equal(shown.jumps,expected.jumps);
    assert.equal(shown._jumpSeq,1);
  }
  assert.equal(shown.ground,true);assert.equal(shown.jumps,0);
  const ack=clone(initial);ack.time=1;ack.players.me._jumpSeq=1;
  for(let frame=0;frame<5;frame++)shown=prediction.sample(ack,'me',1/60,jump);
  assert.equal(shown.ground,true,'acknowledged held press remains consumed');
  shown=prediction.sample(ack,'me',1/60,{...jump,jumpSeq:2});assert.equal(shown.air,true,'a new sequence can jump again');
});

test('A second jump while the first is unacknowledged remains consumed across delayed snapshots',()=>{
  const prediction=createSeason1Prediction(),initial=fixture();
  let shown;
  for(let frame=0;frame<20;frame++){
    const snapshot=clone(initial);snapshot.time=frame/60;
    const jumpSeq=frame>=10?2:1;
    shown=prediction.sample(snapshot,'me',1/60,{jump:true,jumpSeq});
    if(frame===10){assert.equal(shown.jumps,1);assert.ok(shown.flip>0);}
  }
  assert.equal(shown.jumps,1);assert.equal(shown._jumpSeq,2);assert.ok(shown.y>1);
  const ack=clone(initial);ack.time=.4;Object.assign(ack.players.me,{...shown,_jumpSeq:2});
  shown=prediction.sample(ack,'me',1/60,{jump:true,jumpSeq:2});assert.equal(shown.jumps,1);
});

test('Teleports, phase/life changes, pause and explicit reset discard stale prediction',()=>{
  const prediction=createSeason1Prediction(),first=fixture();
  for(let i=0;i<10;i++)prediction.sample(first,'me',1/60,forward);
  const teleport=clone(first);teleport.time=.1;teleport.players.me.z=-5;
  assert.equal(prediction.sample(teleport,'me',0,forward).z,-5);
  const phase=clone(teleport);phase.phase='forest';phase.players.me.z=-17;
  assert.equal(prediction.sample(phase,'me',0,forward).z,-17);
  phase.paused=true;const pausedBefore=clone(phase.players.me);
  for(let i=0;i<10;i++)assert.deepEqual(prediction.sample(phase,'me',1/60,{...forward,jump:true,jumpSeq:1}),pausedBefore);
  phase.paused=false;phase.players.me.hp=0;
  assert.equal(prediction.sample(phase,'me',1/60,forward).z,-17);
  phase.players.me.hp=100;phase.players.me.z=-18;
  assert.equal(prediction.sample(phase,'me',0,forward).z,-18);
  prediction.reset();assert.equal(prediction.sample(first,'me',0,forward).z,0);
  assert.equal(prediction.sample(first,'missing',1/60,forward),null);
});

test('In-place time updates reconcile, and collision footprints also constrain guest movement',()=>{
  const prediction=createSeason1Prediction(),state=fixture();
  state.players.me.z=-8.5;
  for(let i=0;i<120;i++)prediction.sample(state,'me',1/60,forward);
  let shown=prediction.sample(state,'me',1/60,forward);assert.ok(shown.z>=-9&&shown.z<-8.8);
  state.time=.1;state.players.me.z=-8.75;
  shown=prediction.sample(state,'me',1/60,{mx:0,mz:0,jumpSeq:0});assert.ok(shown.z>=-9);
  for(let i=0;i<100;i++)shown=prediction.sample(state,'me',1/60,{mx:0,mz:0,jumpSeq:0});
  assert.ok(Math.abs(shown.z+8.75)<1e-4);
});

test('15/20/30/60 Hz guest render frames preserve the host jump trajectory, height and landing',()=>{
  const input={mx:0,mz:-1,yaw:0,jump:true,jumpSeq:1};
  for(const hz of [15,20,30,60]){
    const prediction=createSeason1Prediction(),snapshot=fixture(),host=fixture();let guestPeak=.08,hostPeak=.08,landFrame=-1;
    for(let frame=0;frame<hz;frame++){
      for(let tick=0;tick<60/hz;tick++)advancePlayerMovement(host,host.players.me,1/60,input);
      const shown=prediction.sample(snapshot,'me',1/hz,input),expected=host.players.me;
      for(const key of ['x','y','z','vy','ground','air','take','land','flip','gp'])assert.equal(shown[key],expected[key],`${hz}Hz frame ${frame} ${key}`);
      guestPeak=Math.max(guestPeak,shown.y);hostPeak=Math.max(hostPeak,expected.y);
      if(shown.ground&&landFrame<0)landFrame=frame;
    }
    assert.equal(guestPeak,hostPeak,`${hz}Hz sampled peak agrees with authority`);
    assert.ok(guestPeak>1.32,`${hz}Hz keeps the original jump height`);
    assert.ok(landFrame>=0&&landFrame/hz<.6,`${hz}Hz keeps the original airtime`);
  }
});

test('High-rate and uneven guest frames retain fractional time instead of accelerating or losing physics ticks',()=>{
  const prediction=createSeason1Prediction(),snapshot=fixture(),host=fixture();
  const input={mx:0,mz:-1,yaw:0,jump:false,jumpSeq:1};
  const intervals=[1/144,1/90,1/144,1/70,1/120,1/40];let elapsed=0,ticks=0;
  for(let frame=0;frame<160;frame++){
    const dt=intervals[frame%intervals.length];elapsed+=dt;
    const expectedTicks=Math.floor((elapsed+1e-10)*60);
    while(ticks<expectedTicks){advancePlayerMovement(host,host.players.me,1/60,input);ticks++;}
    const shown=prediction.sample(snapshot,'me',dt,input),expected=host.players.me;
    for(const key of ['z','y','vy','ground','gp'])assert.equal(shown[key],expected[key],`frame ${frame} ${key}`);
  }
  assert.equal(ticks,Math.floor((elapsed+1e-10)*60));
});
