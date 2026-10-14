import test from 'node:test';
import assert from 'node:assert/strict';
import {createState, addPlayer, setOnline, applyAction, advancePlayerMovement, step, restoreVillagePositions} from '../src/sim.mjs';
import {BEACON, GATE, OBSTACLES, VILLAGE_SITES, VILLAGE_GROVE, VILLAGE_BOUNDS, walkable} from '../src/content.mjs';
import {SEASON1_MOTION} from '../src/locomotion-season1.mjs';

const teacher = {teacher:true};
function room(n=1) {
  const s=createState();
  for(let i=0;i<n;i++) addPlayer(s,{id:`p${i}`,name:`대원 ${i+1}`,team:i%5,hat:i%3});
  return s;
}
function act(s,type,extra={},id='p0',ctx={}) {return applyAction(s,id,{type,...extra},ctx);}
function expedition(n=1) {
  const s=room(n);
  assert.equal(act(s,'start',{},'p0',teacher).ok,true);
  assert.equal(act(s,'depart',{},'p0',teacher).ok,true);
  return s;
}
function tick(s,seconds,inputs={}) {for(let i=0;i<Math.ceil(seconds*30);i++)step(s,1/30,inputs);}
// Synthetic fixtures exercise the retained render/performance combat baseline;
// they do not represent a player-accessible build action or an inventor skill.
function towerFixture(s,type='arrow',x=6,z=-28) {
  const t={id:`fixture-${s.towers.length}`,type,team:0,x,z,hp:180,maxHp:180,
    state:'deployed',carrier:null,progress:0,cooldown:0};
  s.towers.push(t);return t;
}
function bossRoom(n=1) {
  const s=expedition(n);s.enemies=[];Object.assign(s.players.p0,BEACON);
  assert.equal(act(s,'interact').ok,true);
  s.enemies=[];Object.assign(s.players.p0,GATE);assert.equal(act(s,'interact').ok,true);
  return s;
}

test('teacher controls lobby/village/depart and students cannot skip stages',()=>{
  const s=room();
  assert.equal(act(s,'start').ok,false);
  assert.equal(act(s,'depart',{},'p0',teacher).ok,false);
  assert.equal(act(s,'ready').ok,true);assert.equal(s.players.p0.ready,true);
  assert.equal(act(s,'cosmetic',{hat:2}).ok,true);
  assert.equal(act(s,'start',{},'p0',teacher).ok,true);
  assert.equal(act(s,'cosmetic',{hat:1}).ok,false);
  assert.equal(act(s,'depart',{},'p0',teacher).ok,true);
  const startSupply=s.supplies;
  Object.assign(s.players.p0,BEACON);
  assert.equal(act(s,'interact').ok,false,'living enemies block beacon');
  s.enemies=[];assert.equal(act(s,'interact').ok,true);assert.equal(s.stage,1);
  assert.equal(s.supplies,startSupply+160);
  assert.equal(act(s,'interact').ok,false);assert.equal(s.supplies,startSupply+160);
  Object.assign(s.players.p0,GATE);assert.equal(act(s,'interact').ok,false);
  s.enemies=[];assert.equal(act(s,'interact').ok,true);assert.equal(s.phase,'boss');
  assert.equal(s.supplies,startSupply+260);
});

test('Season 1 cosmetic IDs survive partial changes, snapshots, reconnects, and gameplay lock',()=>{
  const s=createState();
  const p=addPlayer(s,{id:'p0',name:'원정대원',team:0,hat:16,face:11,clothes:13});
  const appearance=()=>[p.hat,p.face,p.clothes];
  assert.deepEqual(appearance(),[16,11,13]);
  assert.equal(act(s,'cosmetic',{hat:14}).ok,true);assert.deepEqual(appearance(),[14,11,13]);
  assert.equal(act(s,'cosmetic',{face:9,clothes:11}).ok,true);assert.deepEqual(appearance(),[14,9,11]);
  for(const request of [{},{hat:17},{face:12},{clothes:14},{hat:-1},{face:1.5},{clothes:'1'},
    {hat:Infinity},{face:NaN},{hat:1,face:12,clothes:0}]) {
    assert.equal(act(s,'cosmetic',request).ok,false);
    assert.deepEqual(appearance(),[14,9,11],'invalid partial update must be atomic');
  }
  const snapshot=JSON.parse(JSON.stringify(s));
  assert.deepEqual([snapshot.players.p0.hat,snapshot.players.p0.face,snapshot.players.p0.clothes],appearance());
  setOnline(s,'p0',false);addPlayer(s,{id:'p0',name:'돌아온 친구',team:0});
  assert.deepEqual(appearance(),[14,9,11],'missing reconnect fields preserve the outfit');
  assert.equal(act(s,'cosmetic',{hat:16,face:11,clothes:13}).ok,true);
  assert.equal(act(s,'start',{},'p0',teacher).ok,true);
  assert.equal(act(s,'cosmetic',{hat:0,face:0,clothes:0}).ok,false);
  setOnline(s,'p0',false);addPlayer(s,{id:'p0',name:'돌아온 친구',team:0,hat:0,face:0,clothes:0});
  assert.deepEqual(appearance(),[16,11,13],'active expedition reconnect keeps the original outfit');
});

test('new player cosmetic inputs normalize to bounded Season 1 indices',()=>{
  const s=createState();
  const p=addPlayer(s,{id:'p0',name:'대원',hat:99,face:-2,clothes:5.5});
  assert.deepEqual([p.hat,p.face,p.clothes],[16,0,0]);
  const basic=addPlayer(s,{id:'p1',name:'기본 대원'});
  assert.deepEqual([basic.hat,basic.face,basic.clothes],[0,0,0]);
});

test('movement normalizes input, clamps dt, rejects nonfinite values, and respects phase gates/rocks',()=>{
  const s=room();const p=s.players.p0;
  Object.assign(p,{x:0,z:0});step(s,100,{p0:{mx:1,mz:1,yaw:Infinity}});
  const decay=Math.exp(-.1*SEASON1_MOTION.lobbyAcceleration);
  assert.ok(Math.abs(Math.hypot(p.x,p.z)-SEASON1_MOTION.speed*.1*(1-decay))<1e-8);
  const old={x:p.x,z:p.z,vx:p.vx,vz:p.vz,yaw:p.yaw,time:s.time};
  step(s,NaN,{p0:{mx:NaN,mz:Infinity}});assert.equal(s.time,old.time);
  step(s,.1,{p0:{mx:NaN,mz:Infinity,yaw:NaN}});
  assert.ok(Math.abs(p.x-(old.x+old.vx*decay*.1))<1e-8,'invalid input becomes zero intent and retains Season 1 easing');
  assert.ok(Math.abs(p.z-(old.z+old.vz*decay*.1))<1e-8);assert.equal(p.yaw,old.yaw);
  Object.assign(p,{x:0,z:-8.9});tick(s,1,{p0:{mz:-1}});assert.ok(p.z>=-9);
  const workshop=OBSTACLES[0];
  Object.assign(p,{x:workshop.x+workshop.r+.7,z:workshop.z});tick(s,1,{p0:{mx:-1}});assert.ok(p.x>workshop.x+workshop.r+.64,'visible workshop perimeter blocks walk');
  act(s,'start',{},'p0',teacher);act(s,'depart',{},'p0',teacher);s.enemies=[];
  Object.assign(p,{x:0,z:-68.9});tick(s,1,{p0:{mz:-1}});assert.ok(p.z>=-69);
  Object.assign(p,BEACON);act(s,'interact');s.enemies=[];
  Object.assign(p,{x:0,z:-93.9});tick(s,1,{p0:{mz:-1}});assert.ok(p.z>=-94);
});

test('retired shared tower actions are rejected for students and teachers without mutating state',()=>{
  for(const phase of ['lobby','village','forest','boss']) {
    const s=phase==='boss'?bossRoom(2):expedition(2);s.phase=phase;
    towerFixture(s);Object.assign(s.players.p0,{x:3,z:-28});
    for(const [id,context] of [['p0',{}],['p1',teacher]])for(const type of ['build','pack','deploy','repair']) {
      const before=structuredClone(s);
      const result=act(s,type,{towerType:'arrow',towerId:s.towers[0].id,x:6,z:-28},id,context);
      assert.equal(result.ok,false,`${phase} ${id} ${type}`);
      assert.deepEqual(s,before,'no spend, creation, progress, repair, or ownership mutation');
    }
  }
});

test('retired carried and unfinished towers cannot slow movement, stop attacks, or finish building',()=>{
  const plain=expedition(),old=structuredClone(plain);
  plain.enemies=[];old.enemies=[];
  old.towers=[{...towerFixture(plain),state:'carried',carrier:'p0',x:12,z:-28},
    {id:'unfinished',type:'arrow',x:12,z:-33,hp:180,maxHp:180,state:'placing',carrier:'p0',progress:1.99}];
  plain.towers=[];
  for(let frame=0;frame<90;frame++) {
    advancePlayerMovement(plain,plain.players.p0,1/60,{mz:1,sprint:true});
    advancePlayerMovement(old,old.players.p0,1/60,{mz:1,sprint:true});
  }
  assert.deepEqual(old.players.p0,plain.players.p0,'legacy carrier fields do not change shared movement');
  old.enemies=[{id:'target',kind:'brute',x:old.players.p0.x,z:old.players.p0.z-5,yaw:0,hp:100,maxHp:100,frost:0,comboCooldown:0,attackCooldown:10}];
  step(old,1/30,{p0:{attack:true}});
  assert.equal(old.enemies[0].hp,81,'ordinary attack remains available');
  assert.equal(old.towers[1].state,'placing');assert.equal(old.towers[1].progress,1.99,'retired construction never ticks to deployed');
});

test('ice then arrow consumes frost once and cooldown prevents recursive/repeated shatter',()=>{
  const s=expedition();s.enemies=[];s.beacon=true;s.stage=1;
  const ice=towerFixture(s,'ice',6,-28);const arrow={...ice,id:'arrow-fixture',type:'arrow',x:6,z:-23,cooldown:0};
  s.towers.push(arrow);
  s.enemies=[{id:'target',kind:'brute',x:7,z:-32,yaw:0,hp:1000,maxHp:1000,frost:0,comboCooldown:0,attackCooldown:10}];
  step(s,.01);const e=s.enemies[0];
  assert.equal(e.hp,952,'8 ice + 16 arrow + 24 shatter');assert.equal(e.frost,0);
  assert.equal(s.events.filter(e=>e.kind==='shatter').length,1);
  ice.cooldown=0;arrow.cooldown=0;step(s,.01);
  assert.equal(e.hp,928,'cooldown allows ordinary damage only');assert.equal(e.frost,0);
  assert.equal(s.events.filter(e=>e.kind==='shatter').length,1);
  tick(s,2);assert.ok(s.events.filter(e=>e.kind==='shatter').length>=2,'combo can trigger again after cooldown');
});

test('synthetic deployed towers still receive damage for the performance combat fixture',()=>{
  const s=expedition();s.enemies=[];const t=towerFixture(s);Object.assign(s.players.p0,{x:0,z:-24});
  s.enemies=[{id:'hitter',kind:'brute',x:t.x+1.9,z:t.z,yaw:0,hp:9999,maxHp:9999,frost:0,comboCooldown:0,attackCooldown:0}];
  step(s,.1);assert.equal(t.hp,t.maxHp-23);
  t.hp=1;tick(s,1.3);assert.equal(t.state,'destroyed');assert.equal(t.hp,0);
});

test('boss locks direction during warning, each charge hits once, and half health gives two full warnings',()=>{
  const s=bossRoom(2);const b=s.boss;
  Object.assign(s.players.p0,{x:0,z:b.z+8});Object.assign(s.players.p1,{x:12,z:-110});
  b.timer=.01;step(s,.02);assert.equal(b.phase,'warn');const direction=[b.dx,b.dz];
  Object.assign(s.players.p0,{x:2,z:b.z+8});tick(s,1.4);assert.equal(b.phase,'warn');
  assert.deepEqual([b.dx,b.dz],direction);
  tick(s,1.1);assert.equal(s.players.p0.hp,68);assert.equal(b.phase,'recover');
  const second=bossRoom(2);const low=second.boss;low.hp=low.maxHp*.49;low.timer=.01;
  step(second,.02);assert.equal(low.phase,'warn');tick(second,2.45);
  assert.equal(low.phase,'warn');assert.ok(low.timer>1.3,'second charge grants a new full dodge warning');
  assert.equal(second.events.filter(e=>e.kind==='warn').length,2);
});

test('irregular simulation tick cannot extend a charge beyond its 18-unit warning',()=>{
  const s=bossRoom();const b=s.boss;
  Object.assign(b,{x:0,z:-113,dx:1,dz:0,phase:'charge',timer:.9,chargeRemaining:1});
  for(let i=0;i<13;i++)step(s,.07);
  assert.equal(b.phase,'recover');assert.ok(Math.abs(b.x-18)<1e-8);
});

test('friendly revive takes three uninterrupted seconds and lone downed party fails before auto-respawn',()=>{
  const s=expedition(2);s.enemies=[];const p=s.players.p0,f=s.players.p1;
  Object.assign(p,{x:0,z:-20});Object.assign(f,{x:1,z:-20,hp:0,downUntil:s.time+15});
  assert.equal(act(s,'interact').ok,true);tick(s,2.8);assert.equal(f.hp,0);tick(s,.3);assert.equal(f.hp,60);
  f.hp=0;f.downUntil=s.time+15;act(s,'interact');tick(s,1,{p0:{mx:1}});assert.equal(p.reviveTarget,null);
  p.hp=0;step(s,.1);assert.equal(s.phase,'defeat');tick(s,20);assert.equal(s.phase,'defeat');
});

test('15-second individual respawn and reconnect preserve health and fixed party scaling',()=>{
  const s=bossRoom(2);const maxHp=s.boss.maxHp;s.boss.timer=100;
  const p=s.players.p0;p.hp=0;p.downUntil=s.time+15;
  tick(s,14.9);assert.equal(p.hp,0);tick(s,.2);assert.equal(p.hp,100);
  p.hp=17;setOnline(s,'p0',false);addPlayer(s,{id:'p0',name:'돌아온 친구',team:4,hat:0});
  assert.equal(p.hp,17);assert.equal(p.team,0);assert.equal(s.boss.maxHp,maxHp);
  addPlayer(s,{id:'late',name:'늦게 온 친구',team:1});assert.equal(s.boss.maxHp,maxHp);
});

test('empty room pauses without defeat; reconnect respects teacher pause',()=>{
  const s=expedition();setOnline(s,'p0',false);const before=s.time;tick(s,20);
  assert.equal(s.phase,'forest');assert.equal(s.paused,true);assert.equal(s.time,before);
  setOnline(s,'p0',true);assert.equal(s.paused,false);
  act(s,'pause',{},'p0',teacher);setOnline(s,'p0',false);setOnline(s,'p0',true);
  assert.equal(s.paused,true);act(s,'pause',{},'p0',teacher);assert.equal(s.paused,false);
});

test('retry restores starting supplies without reviving obsolete checkpoint towers or minting rewards',()=>{
  const s=expedition();s.enemies=[];
  s._checkpoint.towers=[{id:'obsolete',type:'arrow',hp:180,state:'inventory'}];
  Object.assign(s.players.p0,BEACON);act(s,'interact');assert.equal(s.supplies,760);
  s.players.p0.hp=0;step(s,.1);assert.equal(s.phase,'defeat');
  assert.equal(act(s,'retry',{},'p0',teacher).ok,true);
  assert.equal(s.supplies,600);assert.equal(s.towers.length,0);assert.equal(s.stage,0);assert.equal(s.beacon,false);
  assert.equal(act(s,'retry',{},'p0',teacher).ok,false);
});

test('victory awards once, clears fixture towers, returns to village, and prevents repeat reward farming',()=>{
  const s=bossRoom();const supply=s.supplies;towerFixture(s);
  s.boss.hp=0;step(s,.1);assert.equal(s.phase,'victory');assert.equal(s.supplies,supply+200);
  tick(s,10);assert.equal(s.supplies,supply+200);assert.equal(s.events.filter(e=>e.kind==='victory').length,1);
  assert.deepEqual(s.towers,[]);
  assert.equal(act(s,'return',{},'p0',teacher).ok,true);assert.equal(s.phase,'village');
  assert.equal(act(s,'depart',{},'p0',teacher).ok,false);assert.equal(s.supplies,supply+200);
});

test('player cap, bounded event history, and JSON snapshot can round-trip simulation',()=>{
  const s=room(21);assert.equal(addPlayer(s,{id:'overflow',name:'22번째'}),null);
  assert.equal(addPlayer(s,{id:'bad.key',name:'잘못된 ID'}),null);
  act(s,'start',{},'p0',teacher);act(s,'depart',{},'p0',teacher);
  const p=s.players.p0;Object.assign(p,{x:0,z:-30});
  s.enemies=[{id:'durable',kind:'brute',x:0,z:-40,yaw:0,hp:1e6,maxHp:1e6,frost:0,comboCooldown:0,attackCooldown:999}];
  tick(s,20,{p0:{attack:true}});assert.ok(s.events.length<=40);assert.ok(s._eventSeq>=40);
  const copy=JSON.parse(JSON.stringify(s));step(copy,.1,{p0:{mx:1}});assert.ok(Number.isFinite(copy.players.p0.x));
  assert.equal(copy.version,s.version);
});

test('first boss is beatable using only basic attack and telegraph-aware movement',()=>{
  const s=bossRoom();const p=s.players.p0;
  Object.assign(p,{x:0,z:-107});
  for(let i=0;i<9000 && s.phase==='boss';i++){
    const b=s.boss;let mx=0,mz=0;
    if(b.phase==='warn'||b.phase==='charge'){
      const along=(p.x-b.x)*b.dx+(p.z-b.z)*b.dz;
      const across=(p.x-b.x)*b.dz-(p.z-b.z)*b.dx;
      if(along>-3&&along<23&&Math.abs(across)<5){
        const side=across>=0?1:-1;mx=b.dz*side;mz=-b.dx*side;
      }
    } else {
      const d=Math.hypot(p.x-b.x,p.z-b.z);
      if(d>12){mx=(b.x-p.x)/d;mz=(b.z-p.z)/d;}
    }
    step(s,1/30,{p0:{mx,mz,attack:true}});
  }
  assert.equal(s.phase,'victory');assert.ok(p.hp>0);
});

function combatInput(s,p) {
  let mx=0,mz=0;
  if(s.phase==='boss') {
    const b=s.boss;
    if(b.phase==='warn'||b.phase==='charge'){
      const along=(p.x-b.x)*b.dx+(p.z-b.z)*b.dz;
      const across=(p.x-b.x)*b.dz-(p.z-b.z)*b.dx;
      if(along>-3&&along<23&&Math.abs(across)<5){
        const side=across>=0?1:-1;mx=b.dz*side;mz=-b.dx*side;
      }
    } else {
      const d=Math.hypot(p.x-b.x,p.z-b.z);
      if(d>12){mx=(b.x-p.x)/d;mz=(b.z-p.z)/d;}
    }
  } else if(s.enemies.length) {
    let e=s.enemies[0];
    for(const a of s.enemies) if(Math.hypot(p.x-a.x,p.z-a.z)<Math.hypot(p.x-e.x,p.z-e.z))e=a;
    const d=Math.hypot(p.x-e.x,p.z-e.z), sign=d<8?-1:d>13?1:0;
    mx=(e.x-p.x)/Math.max(.001,d)*sign;mz=(e.z-p.z)/Math.max(.001,d)*sign;
  } else {
    const dest=s.stage===0?BEACON:GATE,d=Math.hypot(p.x-dest.x,p.z-dest.z);
    if(d>2){mx=(dest.x-p.x)/d;mz=(dest.z-p.z)/d;}
    else act(s,'interact',{},p.id);
  }
  return {mx,mz,attack:true};
}

for(const count of [1,4,21]) test(`${count}-player campaign clears from lobby using only actions/inputs, without state cheats`,()=>{
  const s=room(count);
  assert.equal(act(s,'start',{},'p0',teacher).ok,true);
  assert.equal(act(s,'depart',{},'p0',teacher).ok,true);
  const phases=new Set([s.phase]);
  for(let frame=0;frame<18000 && s.phase!=='victory' && s.phase!=='defeat';frame++) {
    const inputs={};
    for(const p of Object.values(s.players))inputs[p.id]=combatInput(s,p);
    step(s,1/30,inputs);phases.add(s.phase);assert.equal(s.towers.length,0,'campaign uses no tower assistance');
  }
  assert.equal(s.phase,'victory');assert.ok(phases.has('boss'));
  assert.equal(s.beacon,true);assert.ok(s.events.length<=40);
  assert.equal(act(s,'return',{},'p0',teacher).ok,true);assert.equal(s.phase,'village');
});

test('older village saves escape moved landmarks without changing valid positions or progress',()=>{
  const s=room(21);s.phase='village';s.supplies=777;
  for(let i=0;i<20;i++){s.players['p'+i].x=-8;s.players['p'+i].z=9;}
  const safe=s.players.p20;safe.x=0;safe.z=16;const before=structuredClone(safe);
  const appearances=Object.values(s.players).map(p=>[p.id,p.hat,p.face,p.clothes,p.hp]);
  assert.equal(restoreVillagePositions(s),20);
  for(const p of Object.values(s.players))assert.ok(walkable(p.x,p.z,.65));
  assert.deepEqual(safe,before);assert.equal(s.supplies,777);
  assert.deepEqual(Object.values(s.players).map(p=>[p.id,p.hat,p.face,p.clothes,p.hp]),appearances);
  assert.equal(restoreVillagePositions(s),0,'restoration is idempotent');
  s.phase='boss';s.players.p0.x=-8;s.players.p0.z=9;const combat=structuredClone(s);
  assert.equal(restoreVillagePositions(s),0);assert.deepEqual(s,combat,'combat coordinates are never rewritten');
});

// Every solid village facade has an approachable, visible inside boundary. The
// narrower street still admits all 21 starting positions to the north gate.
test('dense village preserves classroom passage and collides with every solid frontage',()=>{
  const s=room(21);s.phase='village';
  const input={};
  for(const p of Object.values(s.players)){
    assert.ok(walkable(p.x,p.z,.65),'Each classroom spawn is clear');
    input[p.id]={mz:-1};
  }
  tick(s,7.5,input);
  for(const p of Object.values(s.players))assert.ok(p.z<=-8.7&&p.z>=-9,'Every student reaches the village gate');
  const p=s.players.p0;
  for(const [name,site] of [...Object.entries(VILLAGE_SITES),...VILLAGE_GROVE.map((site,i)=>['grove-'+i,site])]){
    const side=Math.sign(site.x);
    Object.assign(p,{x:site.x-side*(site.r+1.5),z:site.z});
    assert.ok(walkable(p.x,p.z,.65),name+' has an accessible approach');
    tick(s,1.2,{p0:{mx:side}});
    const distance=Math.hypot(p.x-site.x,p.z-site.z);
    assert.ok(distance>=site.r+.64&&distance<=site.r+.85,name+' blocks at its drawn boundary');
  }
});


test('compact village keeps all spawn columns clear and rejects the old empty lawn',()=>{
  const s=room(21);s.phase='village';
  for(const p of Object.values(s.players)){
    assert.ok(walkable(p.x,p.z,.65));
    for(let z=p.z;z>=-9;z-=.25)assert.ok(walkable(p.x,z,.65),`spawn column ${p.x} remains open at ${z}`);
  }
  const p=s.players.p0;
  for(const side of [-1,1]){
    Object.assign(p,{x:side*19.7,z:-9});tick(s,1,{p0:{mx:side}});
    assert.ok(Math.abs(p.x)<=VILLAGE_BOUNDS.halfWidth-.65,'visible side bed stops outward walking');
  }
  Object.assign(p,{x:0,z:28.7});tick(s,1,{p0:{mz:1}});
  assert.ok(p.z<=VILLAGE_BOUNDS.south-.65,'visible south bed closes unused lawn');
  // Old saves can lie beyond the new border even when no building overlaps.
  for(let i=0;i<20;i++)Object.assign(s.players['p'+i],{x:i%2?28:-28,z:32});
  assert.equal(restoreVillagePositions(s),20);
  for(const player of Object.values(s.players))assert.ok(walkable(player.x,player.z,.65));
  assert.ok(walkable(18,-60,.65),'forest corridor width is retained');
  assert.equal(walkable(19,-60,.65),false);
  assert.ok(walkable(28,-115,.65),'boss arena width is retained');
});
