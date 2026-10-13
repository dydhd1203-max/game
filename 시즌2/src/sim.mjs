import {BUILD, SPAWN, BEACON, GATE, BOSS_HOME, TOWERS, walkable, zoneAt} from './content.mjs';

// Only the room host runs this module. All values crossing the input boundary
// are checked here as well as in the transport; snapshots contain plain JSON.
const MAX_PLAYERS = 21, MAX_TOWERS = 30, TEAM_TOWERS = 6;
const MOVE_SPEED = 7, PLAYER_RADIUS = .65;
const CHARGE_SPEED = 20, CHARGE_TIME = .9, CHARGE_RADIUS = 2.6;
const COSMETIC_LIMITS = {hat:16, face:11, clothes:13};
const TEACHER_ACTIONS = new Set(['start', 'depart', 'pause', 'retry', 'return']);
const active = s => s.phase === 'forest' || s.phase === 'boss';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clone = v => JSON.parse(JSON.stringify(v));
const good = () => ({ok:true});
const fail = error => ({ok:false, error});
const online = s => Object.values(s.players).filter(p => p.online);
const living = s => Object.values(s.players).filter(p => p.online && p.hp > 0);
const newId = (s, prefix) => `${prefix}${++s._seq}`;

export function createState() {
  return {version:BUILD, phase:'lobby', paused:false, time:0, stage:0, supplies:600,
    players:{}, towers:[], enemies:[], boss:null, events:[], beacon:false,
    message:'친구들과 준비하고 선생님의 시작을 기다려요.', cleared:false,
    _seq:0, _eventSeq:0, _manualPause:false, _emptyPause:false,
    _checkpoint:null, _partySize:1, _clearAwarded:false};
}

function emit(s, kind, source, target, extra) {
  const e = {id:++s._eventSeq, kind, x:source.x, z:source.z};
  if (target) { e.tx = target.x; e.tz = target.z; }
  if (extra) Object.assign(e, extra);
  s.events.push(e);
  if (s.events.length > 40) s.events.splice(0, s.events.length - 40);
}

function spawnPosition(s, index = 0) {
  const x = (index % 5 - 2) * 1.8;
  const z = s.phase === 'boss' ? -97 : s.phase === 'forest' ? (s.stage ? -66 : -17) : SPAWN.z;
  return {x, z:z + Math.floor(index / 5) * 1.6};
}

export function addPlayer(s, profile) {
  if (!profile || typeof profile.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(profile.id)) return null;
  const old = Object.hasOwn(s.players, profile.id) ? s.players[profile.id] : null;
  if (!old && online(s).length >= MAX_PLAYERS) return null;
  // A reconnect restores the existing combat state, never a full-health clone.
  if (old) {
    if (!old.online && online(s).length >= MAX_PLAYERS) return null;
    old.name = cleanName(profile.name);
    if (s.phase === 'lobby') {
      old.team = cleanTeam(profile.team);
      for (const key of Object.keys(COSMETIC_LIMITS)) {
        if (Object.hasOwn(profile, key)) old[key] = cleanCosmetic(profile[key], key);
      }
    }
    setOnline(s, old.id, true);
    return old;
  }
  const pos = spawnPosition(s, online(s).length);
  const p = {id:profile.id, name:cleanName(profile.name), team:cleanTeam(profile.team),
    hat:cleanCosmetic(profile.hat, 'hat'), face:cleanCosmetic(profile.face, 'face'),
    clothes:cleanCosmetic(profile.clothes, 'clothes'), ...pos, yaw:0, hp:100, maxHp:100, online:true,
    downUntil:0, ready:false, shotCooldown:0, reviveTarget:null, reviveProgress:0};
  Object.defineProperty(s.players, p.id, {value:p, enumerable:true, configurable:true, writable:true});
  if (s._emptyPause) { s._emptyPause = false; s.paused = !!s._manualPause; }
  return p;
}

const cleanName = value => (typeof value === 'string' ? value.trim().slice(0, 18) : '') || '원정대원';
const cleanTeam = value => Number.isInteger(value) ? clamp(value, 0, 4) : 0;
const cleanCosmetic = (value, key) => Number.isInteger(value) ? clamp(value, 0, COSMETIC_LIMITS[key]) : 0;

function recoverCarrier(s, id) {
  for (const t of s.towers) {
    if (t.carrier !== id) continue;
    // Interrupted packing leaves the existing tower where it stood. Once
    // carried, recovery places that same ID into its team's inventory.
    t.state = t.state === 'packing' ? 'deployed' : 'inventory';
    t.carrier = null; t.progress = 0;
  }
}

export function setOnline(s, id, value) {
  if (!Object.hasOwn(s.players, id)) return;
  const p = s.players[id];
  if (value === true && !p.online && online(s).length >= MAX_PLAYERS) return;
  p.online = value === true;
  if (!p.online) { recoverCarrier(s, id); p.reviveTarget = null; p.reviveProgress = 0; }
  if (!online(s).length) { s._emptyPause = true; s.paused = true; }
  else if (s._emptyPause) { s._emptyPause = false; s.paused = !!s._manualPause; }
}

function setPhase(s, phase, message) {
  s.phase = phase; s.message = message;
  for (const p of Object.values(s.players)) { p.reviveTarget = null; p.reviveProgress = 0; }
}

function resetPlayers(s) {
  let i = 0;
  for (const p of Object.values(s.players)) {
    Object.assign(p, spawnPosition(s, i++), {hp:p.maxHp, downUntil:0, shotCooldown:0,
      reviveTarget:null, reviveProgress:0});
  }
}

function beginExpedition(s, retry = false) {
  if (!retry) s._checkpoint = {supplies:s.supplies, towers:clone(s.towers), partySize:Math.max(1, online(s).length)};
  else {
    s.supplies = s._checkpoint.supplies;
    s.towers = clone(s._checkpoint.towers);
  }
  s._partySize = s._checkpoint.partySize;
  s.stage = 0; s.beacon = false; s.boss = null; s._clearAwarded = false;
  s.paused = false; s._manualPause = false;
  setPhase(s, 'forest', '숲길의 좀비를 정리하고 앞쪽 봉화에 다가가 E를 눌러요.');
  for (const t of s.towers) { t.state = t.hp > 0 ? 'inventory' : 'destroyed'; t.carrier = null; t.progress = 0; }
  resetPlayers(s); spawnWave(s, 0);
}

function spawnWave(s, wave) {
  const count = Math.min(24, 3 + Math.ceil(s._partySize * .65) + wave * 2);
  s.enemies = [];
  for (let i = 0; i < count; i++) {
    const brute = wave === 1 && i % 5 === 0;
    const x = (i % 5 - 2) * 3.1;
    const z = (wave ? -78 : -39) - Math.floor(i / 5) * 3.5;
    const hp = brute ? 125 : 64;
    s.enemies.push({id:newId(s, 'e'), x, z, yaw:0, hp, maxHp:hp,
      kind:brute ? 'brute' : 'zombie', frost:0, comboCooldown:0, attackCooldown:.7});
  }
}

function startBoss(s) {
  s.stage = 2; s.supplies += 100;
  const hp = 620 + (s._partySize - 1) * 190;
  s.boss = {id:'boss', ...BOSS_HOME, yaw:0, hp, maxHp:hp, phase:'idle', timer:3,
    dx:0, dz:1, frost:0, comboCooldown:0, chargeRemaining:0, hitIds:[]};
  setPhase(s, 'boss', '붉은 돌진 길을 피하고, 파수꾼이 지쳤을 때 집중 공격해요!');
  resetPlayers(s);
}

function buildPositionError(s, p, x, z, ignoredId = null) {
  if (!finite(x) || !finite(z) || !walkable(x, z, 1.5)) return '설치할 수 없는 위치예요.';
  if (!zoneAt(x, z, s.stage)) return '확보한 파란 설치 지대 안에 놓아 주세요.';
  if (s.phase === 'boss' && z > -94) return '보스 전투장 안에 설치해 주세요.';
  if (Math.abs(x) < 3.4) return '가운데 이동 길은 비워 주세요.';
  if (Math.hypot(p.x - x, p.z - z) > 8) return '설치할 곳에 조금 더 가까이 가 주세요.';
  if (s.towers.some(t => t.id !== ignoredId && (t.state === 'deployed' || t.state === 'packing' || t.state === 'placing') && Math.hypot(t.x - x, t.z - z) < 3.3)) return '다른 타워와 조금 떨어뜨려 주세요.';
  if (Object.values(s.players).some(a => a.online && a.hp > 0 && Math.hypot(a.x-x, a.z-z) < 1.8)) return '친구가 서 있는 자리는 비워 주세요.';
  if (s.boss && s.boss.hp > 0 && distance(s.boss, {x,z}) < 4) return '보스와 너무 가까워요.';
  return '';
}

export function placementError(s, id, x, z, ignoredId = null) {
  const p = Object.hasOwn(s.players, id) ? s.players[id] : null;
  if (!p?.online || p.hp <= 0) return '먼저 원정대에 합류해 주세요.';
  if (!active(s) || s.paused) return '진행 중인 숲 원정에서 설치할 수 있어요.';
  return buildPositionError(s, p, x, z, ignoredId);
}

function controlledTower(s, p, action, teacher) {
  const t = s.towers.find(a => a.id === action.towerId);
  if (!t) return {error:'타워를 찾지 못했어요.'};
  if (t.team !== p.team && !teacher) return {error:'우리 모둠의 타워만 옮길 수 있어요.'};
  return {tower:t};
}

export function applyAction(s, id, action, context = {}) {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') return fail('요청을 다시 확인해 주세요.');
  if (!Object.hasOwn(s.players, id) || !s.players[id].online) return fail('먼저 원정대에 입장해 주세요.');
  const p = s.players[id], teacher = context.teacher === true;
  if (TEACHER_ACTIONS.has(action.type) && !teacher) return fail('선생님만 할 수 있어요.');
  if (action.type === 'pause') {
    s._manualPause = !s.paused;
    s.paused = s._manualPause || !online(s).length;
    return good();
  }
  if (s.paused) return fail('잠시 멈춘 상태예요. 선생님이 다시 시작해 주세요.');
  switch (action.type) {
    case 'start':
      if (s.phase !== 'lobby') return fail('이미 수업을 시작했어요.');
      setPhase(s, 'village', '여기는 안전한 정박 마을이에요. 준비가 되면 선생님이 숲으로 출발해요.');
      resetPlayers(s); return good();
    case 'depart':
      if (s.phase !== 'village') return fail('마을에서 출발할 수 있어요.');
      if (s.cleared) return fail('첫 원정을 모두 마쳤어요! 새 원정은 새 방에서 시작해 주세요.');
      beginExpedition(s); return good();
    case 'retry':
      if (s.phase !== 'defeat' || !s._checkpoint) return fail('원정 실패 뒤 다시 도전할 수 있어요.');
      beginExpedition(s, true); return good();
    case 'return':
      if (s.phase !== 'victory' && s.phase !== 'defeat') return fail('원정을 마친 뒤 마을로 돌아가요.');
      if (s.phase === 'defeat') { s.supplies = s._checkpoint.supplies; s.towers = clone(s._checkpoint.towers); }
      for (const t of s.towers) { t.state = t.hp > 0 ? 'inventory' : 'destroyed'; t.carrier = null; t.progress = 0; }
      s.enemies = []; s.boss = null;
      setPhase(s, 'village', s.cleared ? '숲길 파수꾼을 쓰러뜨렸어요! 마을로 무사히 돌아왔어요.' : '다시 준비해서 도전해 봐요.');
      resetPlayers(s); return good();
    case 'cosmetic': {
      if (s.phase !== 'lobby') return fail('꾸미기는 대기실에서 바꿀 수 있어요.');
      const fields = Object.keys(COSMETIC_LIMITS).filter(key => Object.hasOwn(action, key));
      if (!fields.length || fields.some(key => !Number.isInteger(action[key]) || action[key] < 0 || action[key] > COSMETIC_LIMITS[key])) return fail('꾸미기를 다시 골라 주세요.');
      for (const key of fields) p[key] = action[key];
      return good();
    }
    case 'ready':
      if (s.phase !== 'lobby') return fail('지금은 준비 표시를 바꿀 수 없어요.');
      p.ready = !p.ready; return good();
  }
  if (!active(s)) return fail('숲 원정 중에 사용할 수 있어요.');
  if (p.hp <= 0) return fail('친구의 구조나 복귀를 기다려 주세요.');
  switch (action.type) {
    case 'build': {
      if (!Object.hasOwn(TOWERS, action.towerType)) return fail('타워 종류를 다시 골라 주세요.');
      const def = TOWERS[action.towerType];
      if (action.towerType === 'ice' && !s.beacon) return fail('봉화를 켜면 얼음탑을 사용할 수 있어요.');
      const err = buildPositionError(s, p, action.x, action.z); if (err) return fail(err);
      const intact = s.towers.filter(t => t.state !== 'destroyed');
      if (s.towers.length >= MAX_TOWERS || intact.filter(t => t.team === p.team).length >= TEAM_TOWERS) return fail('새 타워 설치 한도에 도달했어요. 남은 타워를 옮겨 사용해 주세요.');
      if (s.supplies < def.cost) return fail(`공동 보급이 ${def.cost - s.supplies} 부족해요.`);
      if (s.towers.some(t => t.carrier === id)) return fail('옮기던 타워를 먼저 설치해 주세요.');
      s.supplies -= def.cost;
      const t = {id:newId(s, 't'), type:action.towerType, team:p.team, x:action.x, z:action.z,
        hp:def.hp, maxHp:def.hp, state:'placing', carrier:id, progress:0, cooldown:0, paid:def.cost};
      s.towers.push(t); emit(s, 'build', t); return good();
    }
    case 'pack': {
      const {tower:t, error} = controlledTower(s, p, action, teacher); if (error) return fail(error);
      if (t.carrier === id && (t.state === 'packing' || t.state === 'placing')) {
        t.state = t.state === 'packing' ? 'deployed' : 'carried'; t.progress = 0;
        if (t.state === 'deployed') t.carrier = null;
        return good();
      }
      if (t.state !== 'deployed' || t.hp <= 0) return fail('설치된 타워만 포장할 수 있어요.');
      if (distance(p, t) > 4) return fail('타워 가까이에서 포장해 주세요.');
      if (s.towers.some(a => a.carrier === id)) return fail('한 번에 타워 하나만 옮길 수 있어요.');
      t.state = 'packing'; t.carrier = id; t.progress = 0;
      p.reviveTarget = null; p.reviveProgress = 0;
      return good();
    }
    case 'deploy': {
      const {tower:t, error} = controlledTower(s, p, action, teacher); if (error) return fail(error);
      if (t.state !== 'inventory' && !(t.state === 'carried' && t.carrier === id)) return fail('보관하거나 들고 있는 타워를 골라 주세요.');
      if (t.hp <= 0) return fail('파괴된 타워는 이번 원정에서 사용할 수 없어요.');
      if (s.towers.some(a => a.id !== t.id && a.carrier === id)) return fail('들고 있는 타워를 먼저 설치해 주세요.');
      const err = buildPositionError(s, p, action.x, action.z, t.id); if (err) return fail(err);
      t.state = 'placing'; t.carrier = id; t.progress = 0; t.x = action.x; t.z = action.z;
      emit(s, 'build', t); return good();
    }
    case 'repair': {
      const t = s.towers.find(a => a.id === action.towerId);
      if (!t || t.state !== 'deployed' || t.hp <= 0) return fail('설치된 타워를 골라 주세요.');
      if (distance(p, t) > 4) return fail('타워 가까이에서 수리해 주세요.');
      if (t.hp >= t.maxHp) return fail('이미 튼튼한 타워예요.');
      const cost = Math.ceil(Math.min(60, t.maxHp - t.hp) / 6);
      if (s.supplies < cost) return fail('수리할 보급이 부족해요.');
      s.supplies -= cost; t.hp = Math.min(t.maxHp, t.hp + 60); emit(s, 'build', t); return good();
    }
    case 'interact': {
      const friend = online(s).find(a => a.id !== id && a.hp <= 0 && distance(a, p) <= 3);
      if (friend) {
        if (s.towers.some(t => t.carrier === id && (t.state === 'packing' || t.state === 'placing'))) return fail('타워 작업을 마친 뒤 친구를 구해 주세요.');
        if (p.reviveTarget !== friend.id) { p.reviveTarget = friend.id; p.reviveProgress = 0; }
        return good();
      }
      if (s.phase === 'forest' && s.stage === 0 && distance(p, BEACON) <= 5) {
        if (s.enemies.some(e => e.hp > 0)) return fail('주변 좀비를 모두 정리해야 봉화를 켤 수 있어요.');
        s.stage = 1; s.beacon = true; s.supplies += 160;
        s.message = '봉화가 켜졌어요! 얼음 + 화살 조합으로 앞길을 정리하고 숲길 입구로 가요.';
        emit(s, 'beacon', BEACON); spawnWave(s, 1); return good();
      }
      if (s.phase === 'forest' && s.stage === 1 && distance(p, GATE) <= 5) {
        if (s.enemies.some(e => e.hp > 0)) return fail('앞길의 좀비를 먼저 정리해 주세요.');
        startBoss(s); return good();
      }
      return fail('봉화·숲길 입구·쓰러진 친구 가까이에서 E를 눌러요.');
    }
    default: return fail('알 수 없는 행동이에요.');
  }
}

// Earlier art builds used different village footprints. Restore saved players
// to the clear gathering area only if a moved landmark would trap them. Combat
// locations, inventories, progression and valid village positions stay intact.
export function restoreVillagePositions(s) {
  if (!['lobby','village'].includes(s.phase)) return 0;
  let moved = 0;
  for (const p of Object.values(s.players)) {
    if (walkable(p.x,p.z,PLAYER_RADIUS) && p.z >= -9) continue;
    p.x=SPAWN.x+(moved%7-3)*1.1; p.z=SPAWN.z+Math.floor(moved/7)*1.1;
    moved++;
  }
  return moved;
}

function allowed(s, x, z, radius, ignoreTowers = false) {
  if (!walkable(x, z, radius)) return false;
  if ((s.phase === 'lobby' || s.phase === 'village') && z < -9) return false;
  if (s.phase === 'forest' && z < (s.stage === 0 ? -69 : -94)) return false;
  if (s.phase === 'boss' && z > -92) return false;
  if (!ignoreTowers && s.towers.some(t => (t.state === 'deployed' || t.state === 'packing' || t.state === 'placing') && Math.hypot(x-t.x,z-t.z) < 1.15+radius)) return false;
  return true;
}

function move(s, body, dx, dz, radius = PLAYER_RADIUS, ignoreTowers = false) {
  if (allowed(s, body.x + dx, body.z + dz, radius, ignoreTowers)) { body.x += dx; body.z += dz; return; }
  if (allowed(s, body.x + dx, body.z, radius, ignoreTowers)) body.x += dx;
  if (allowed(s, body.x, body.z + dz, radius, ignoreTowers)) body.z += dz;
}

function hurtPlayer(s, p, amount) {
  if (p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - amount); emit(s, 'hit', p);
  p.reviveTarget = null; p.reviveProgress = 0;
  if (!p.hp) { p.downUntil = s.time + 15; recoverCarrier(s, p.id); emit(s, 'down', p); }
}

function hurtTower(s, t, amount) {
  if (t.hp <= 0) return;
  t.hp = Math.max(0, t.hp - amount); emit(s, 'hit', t);
  if (!t.hp) { t.state = 'destroyed'; t.carrier = null; t.progress = 0; }
}

function hurtEnemy(s, e, amount, kind, source) {
  if (e.hp <= 0) return;
  let damage = amount;
  if (kind === 'arrow' && e.frost > 0 && e.comboCooldown <= 0) {
    // This is one resolved hit. The additional damage never calls hit again.
    damage += 24; e.frost = 0; e.comboCooldown = 1;
    emit(s, 'shatter', e);
  } else if (kind === 'ice' && e.comboCooldown <= 0) e.frost = 3;
  if (e.id === 'boss' && e.phase === 'recover') damage *= 1.35;
  e.hp = Math.max(0, e.hp - damage);
  if (source) emit(s, kind, source, e);
}

function nearestEnemy(s, source, range) {
  let best = null, d2 = range * range;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = (e.x-source.x)**2 + (e.z-source.z)**2;
    if (d < d2) { d2 = d; best = e; }
  }
  if (s.boss?.hp > 0) {
    const d = (s.boss.x-source.x)**2 + (s.boss.z-source.z)**2;
    if (d < d2) best = s.boss;
  }
  return best;
}

function updatePlayers(s, dt, inputs) {
  for (const p of Object.values(s.players)) {
    if (!p.online) continue;
    if (p.hp <= 0) {
      if (s.time >= p.downUntil && active(s)) {
        Object.assign(p, spawnPosition(s, Math.max(0, online(s).indexOf(p))), {hp:p.maxHp, downUntil:0});
        emit(s, 'revive', p);
      }
      continue;
    }
    const input = inputs && Object.hasOwn(inputs, p.id) && inputs[p.id] && typeof inputs[p.id] === 'object' ? inputs[p.id] : {};
    let mx = finite(input.mx) ? clamp(input.mx, -1, 1) : 0;
    let mz = finite(input.mz) ? clamp(input.mz, -1, 1) : 0;
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    const carrying = s.towers.some(t => t.carrier === p.id && t.state === 'carried');
    move(s, p, mx * MOVE_SPEED * (carrying ? .8 : 1) * dt, mz * MOVE_SPEED * (carrying ? .8 : 1) * dt);
    if (finite(input.yaw)) p.yaw = ((input.yaw % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    p.shotCooldown = Math.max(0, p.shotCooldown - dt);
    if (active(s) && input.attack === true && !carrying && p.shotCooldown <= 0) {
      const e = nearestEnemy(s, p, 16);
      if (e) { hurtEnemy(s, e, 19, 'shoot', p); p.shotCooldown = .4; }
    }
    if (p.reviveTarget) {
      const friend = s.players[p.reviveTarget];
      if (!friend || !friend.online || friend.hp > 0 || distance(friend,p) > 3 || len > .05 || input.attack === true) {
        p.reviveTarget = null; p.reviveProgress = 0;
      } else {
        p.reviveProgress += dt;
        if (p.reviveProgress >= 3) {
          friend.hp = Math.ceil(friend.maxHp * .6); friend.downUntil = 0;
          p.reviveTarget = null; p.reviveProgress = 0; emit(s, 'revive', friend);
        }
      }
    }
  }
}

function updateTowers(s, dt) {
  for (const t of s.towers) {
    if (t.state === 'carried') {
      const p = s.players[t.carrier];
      if (p) { t.x = p.x; t.z = p.z; }
    } else if (t.state === 'packing' || t.state === 'placing') {
      const p = s.players[t.carrier], packing = t.state === 'packing';
      if (!p?.online || p.hp <= 0) { recoverCarrier(s, t.carrier); continue; }
      if (distance(p,t) > (packing ? 4.5 : 8.5)) {
        t.state = packing ? 'deployed' : 'carried'; t.progress = 0;
        if (packing) t.carrier = null;
        continue;
      }
      t.progress += dt;
      if (t.progress + 1e-9 >= (packing ? 3 : 2)) {
        t.state = packing ? 'carried' : 'deployed'; t.progress = 0;
        if (!packing) t.carrier = null;
        emit(s, packing ? 'pack' : 'build', t);
      }
    }
    if (t.state !== 'deployed' || t.hp <= 0) continue;
    t.cooldown = Math.max(0, (t.cooldown || 0) - dt);
    if (t.cooldown > 0) continue;
    const def = TOWERS[t.type], e = nearestEnemy(s, t, def.range);
    if (e) { hurtEnemy(s, e, def.damage, t.type, t); t.cooldown = def.interval; }
  }
}

function updateEnemies(s, dt, players) {
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.frost = Math.max(0, e.frost - dt); e.comboCooldown = Math.max(0, e.comboCooldown - dt);
    e.attackCooldown = Math.max(0, e.attackCooldown - dt);
    let target = null, nearest = Infinity, tower = false;
    for (const p of players) {
      if (p.hp <= 0) continue;
      const d = distance(e, p); if (d < nearest) { nearest = d; target = p; tower = false; }
    }
    for (const t of s.towers) {
      if (t.hp <= 0 || !['deployed', 'packing', 'placing'].includes(t.state)) continue;
      const d = distance(e, t); if (d < nearest) { nearest = d; target = t; tower = true; }
    }
    if (!target) continue;
    const dx = (target.x-e.x)/Math.max(.001,nearest), dz = (target.z-e.z)/Math.max(.001,nearest);
    e.yaw = Math.atan2(dx,dz);
    const reach = tower ? 2.05 : 1.45;
    if (nearest > reach) {
      const speed = (e.kind === 'brute' ? 2.1 : 2.9) * (e.frost > 0 ? .5 : 1);
      const ox = e.x, oz = e.z;
      move(s, e, dx*speed*dt, dz*speed*dt, .7);
      if (Math.hypot(e.x-ox,e.z-oz) < speed*dt*.15) {
        // A consistent side-step gets around the fixed round rocks without
        // constructing a path grid each frame. The center lane stays open.
        const side = e.x > 0 ? -1 : 1;
        move(s, e, -dz*side*speed*dt, dx*side*speed*dt, .7);
      }
    } else if (e.attackCooldown <= 0) {
      if (tower) hurtTower(s,target,e.kind === 'brute' ? 23 : 13);
      else hurtPlayer(s,target,e.kind === 'brute' ? 18 : 11);
      e.attackCooldown = 1.25;
    }
  }
  // Dead actors are removed once, keeping both AI work and snapshots bounded.
  s.enemies = s.enemies.filter(e => e.hp > 0);
}

function warnBoss(s, boss, players) {
  let target = null, nearest = Infinity;
  for (const p of players) {
    if (p.hp <= 0) continue;
    const d = distance(p,boss); if (d < nearest) { nearest = d; target = p; }
  }
  if (!target) return;
  const d = Math.max(.001, distance(boss,target));
  boss.dx = (target.x-boss.x)/d; boss.dz = (target.z-boss.z)/d;
  if (Math.abs(boss.dx)+Math.abs(boss.dz) < .001) { boss.dx = 0; boss.dz = 1; }
  boss.yaw = Math.atan2(boss.dx,boss.dz); boss.phase = 'warn'; boss.timer = 1.5;
  boss.hitIds = [];
  emit(s, 'warn', boss, null, {dx:boss.dx,dz:boss.dz});
}

function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx-ax, vz = bz-az;
  const t = clamp(((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz || 1), 0, 1);
  return Math.hypot(px-(ax+t*vx), pz-(az+t*vz));
}

function updateBoss(s, dt, players) {
  const b = s.boss; if (!b || b.hp <= 0) return;
  b.frost = Math.max(0,b.frost-dt); b.comboCooldown = Math.max(0,b.comboCooldown-dt);
  b.timer -= dt;
  if (b.phase === 'idle') {
    if (b.timer <= 0) { b.chargeRemaining = b.hp <= b.maxHp*.5 ? 2 : 1; warnBoss(s,b,players); }
  } else if (b.phase === 'warn') {
    if (b.timer <= 0) { b.phase = 'charge'; b.timer = CHARGE_TIME; emit(s,'charge',b,null,{dx:b.dx,dz:b.dz}); }
  } else if (b.phase === 'charge') {
    const ax=b.x, az=b.z;
    const chargeDt=Math.min(dt,Math.max(0,b.timer+dt));
    move(s,b,b.dx*CHARGE_SPEED*chargeDt,b.dz*CHARGE_SPEED*chargeDt,1.8,true);
    for (const p of players) {
      if (p.hp > 0 && !b.hitIds.includes(p.id) && segmentDistance(p.x,p.z,ax,az,b.x,b.z) < CHARGE_RADIUS) {
        b.hitIds.push(p.id); hurtPlayer(s,p,32);
      }
    }
    for (const t of s.towers) {
      if (t.hp > 0 && ['deployed','packing','placing'].includes(t.state) && !b.hitIds.includes(t.id) && segmentDistance(t.x,t.z,ax,az,b.x,b.z) < CHARGE_RADIUS+1) {
        b.hitIds.push(t.id); hurtTower(s,t,48);
      }
    }
    if (b.timer <= 1e-9) {
      b.chargeRemaining--;
      if (b.chargeRemaining > 0) warnBoss(s,b,players);
      else { b.phase='recover'; b.timer=2.5; }
    }
  } else if (b.phase === 'recover' && b.timer <= 0) { b.phase='idle'; b.timer=1.1; }
}

function checkOutcome(s) {
  if (s.phase === 'boss' && s.boss?.hp <= 0) {
    setPhase(s,'victory','숲길 파수꾼을 쓰러뜨렸어요! 모두 함께 마을로 돌아갈 준비를 해요.');
    s.cleared = true;
    if (!s._clearAwarded) { s.supplies += 200; s._clearAwarded = true; emit(s,'victory',s.boss); }
    for (const t of s.towers) { if (t.hp > 0) t.state='inventory'; t.carrier=null; t.progress=0; }
    return;
  }
  const connected = online(s);
  if (connected.length && connected.every(p => p.hp <= 0)) {
    setPhase(s,'defeat','원정대가 모두 쓰러졌어요. 선생님이 출발할 때의 보급으로 다시 도전할 수 있어요.');
  }
}

export function step(s, dt, inputs = {}) {
  if (!finite(dt) || dt <= 0 || s.paused) return;
  if (!online(s).length) { s._emptyPause = true; s.paused = true; return; }
  dt = Math.min(dt,.1);
  if (s.phase === 'victory' || s.phase === 'defeat') return;
  // Check defeat before a large delayed tick can revive the entire party.
  if (active(s)) { checkOutcome(s); if (!active(s)) return; }
  s.time += dt;
  updatePlayers(s,dt,inputs);
  if (!active(s)) return;
  const players = living(s);
  updateTowers(s,dt);
  updateEnemies(s,dt,players);
  updateBoss(s,dt,players);
  checkOutcome(s);
}
