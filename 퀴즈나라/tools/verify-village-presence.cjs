/* Deterministic isolated realtime tests. No Firebase SDK or external database. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../village-presence.js'), 'utf8');
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const settle = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
class Clock {
  constructor() { this.time = 1000000; this.ids = 0; this.timers = new Map(); }
  timer(fn, delay, interval = false) { const id = ++this.ids; this.timers.set(id, { fn, at: this.time + delay, interval: interval ? delay : 0 }); return id; }
  async advance(ms) {
    const until = this.time + ms;
    for (let guard = 0; guard < 10000; guard++) {
      let chosen = null;
      for (const [id, t] of this.timers) if (t.at <= until && (!chosen || t.at < chosen.t.at)) chosen = { id, t };
      if (!chosen) { this.time = until; await settle(); return; }
      this.time = chosen.t.at;
      if (chosen.t.interval) chosen.t.at += chosen.t.interval; else this.timers.delete(chosen.id);
      chosen.t.fn(); await settle();
    }
    throw new Error('Timer loop did not drain');
  }
}
function environment() {
  const clock = new Clock(), data = {}, listeners = new Set(), writes = [], clients = [], disconnects = new Map();
  let unique = 0;
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => o?.[k], data) ?? null;
  const set = (p, value) => { const keys = p.split('/').filter(Boolean); let o = data; for (const k of keys.slice(0, -1)) o = o[k] || (o[k] = {}); if (value == null) delete o[keys.at(-1)]; else o[keys.at(-1)] = copy(value); };
  const snap = (p, client) => ({ val: () => copy(p === '.info/connected' ? client.connected : p === '.info/serverTimeOffset' ? client.offset : get(p)) });
  const notify = () => { for (const l of listeners) queueMicrotask(() => { if (listeners.has(l)) l.cb(snap(l.path, l.client)); }); };
  function sdk(connected = true) {
    const client = { connected, offset: 0, registrations: 0, deny: false, denyRead: false, coldTransactions: true, coldStarts: 0, transactionRetries: 0 }; clients.push(client); disconnects.set(client, new Set());
    class Ref {
      constructor(p) { this.path = p; }
      child(p) { return new Ref(this.path + '/' + p); }
      on(event, cb, error) {
        assert.equal(event, 'value');
        if (client.denyRead && !this.path.startsWith('.info/')) { queueMicrotask(() => error?.(Object.assign(new Error('Read not permitted'), { code: 'PERMISSION_DENIED' }))); return cb; }
        const listener = { path: this.path, cb, client, loaded: false }; listeners.add(listener);
        queueMicrotask(() => { if (listeners.has(listener)) { listener.loaded = true; cb(snap(this.path, client)); } }); return cb;
      }
      off(event, cb) { for (const l of listeners) if (l.client === client && l.path === this.path && (!cb || l.cb === cb)) listeners.delete(l); }
      async set(value) { if (client.deny) throw Object.assign(new Error('Not permitted'), { code: 'PERMISSION_DENIED' }); assert.notEqual(client.connected, false, 'Do not publish movement while offline'); writes.push({ client, path: this.path, value: copy(value), at: clock.time }); set(this.path, value); notify(); }
      async update(patch) { if (client.deny) throw Object.assign(new Error('Not permitted'), { code: 'PERMISSION_DENIED' }); assert.notEqual(client.connected, false, 'Do not publish movement while offline'); writes.push({ client, path: this.path, value: copy(patch), at: clock.time, patch: true }); set(this.path, { ...(get(this.path) || {}), ...copy(patch) }); notify(); }
      async remove() { set(this.path, null); notify(); }
      async transaction(updater) {
        if (client.deny) throw Object.assign(new Error('Not permitted'), { code: 'PERMISSION_DENIED' });
        assert.notEqual(client.connected, false, 'Do not claim a chair while offline');
        const loaded = [...listeners].some(l => l.client === client && l.loaded && (this.path === l.path || this.path.startsWith(l.path + '/')));
        let current = copy(get(this.path));
        if (client.coldTransactions && !loaded) { current = null; ++client.coldStarts; }
        for (let attempt = 0; attempt < 100; attempt++) {
          const before = JSON.stringify(current), proposed = updater(copy(current));
          if (proposed === undefined) return { committed: false, snapshot: snap(this.path, client) };
          await Promise.resolve();
          if (client.beforeCommit) { const hook = client.beforeCommit; client.beforeCommit = null; hook(this.path); }
          if (JSON.stringify(get(this.path)) !== before) { current = copy(get(this.path)); ++client.transactionRetries; continue; }
          writes.push({ client, path: this.path, value: copy(proposed), at: clock.time, transaction: true }); set(this.path, proposed); notify();
          return { committed: true, snapshot: snap(this.path, client) };
        }
        throw new Error('Transaction retries exhausted');
      }
      onDisconnect() { return { remove: async () => { ++client.registrations; disconnects.get(client).add(this.path); }, cancel: async () => disconnects.get(client).delete(this.path) }; }
    }
    const db = { ref: p => new Ref(p) };
    client.drop = () => { client.connected = false; for (const p of disconnects.get(client)) set(p, null); disconnects.get(client).clear(); notify(); };
    client.reconnect = () => { client.connected = true; notify(); };
    return { db, client };
  }
  function runtime(sdkInstance = sdk(), deviceClockShift = 0) {
    const c = { window: {}, console, Date: class extends Date { static now() { return clock.time + deviceClockShift; } }, crypto: { randomUUID: () => 'test' + (++unique) },
      setTimeout: (fn, ms) => clock.timer(fn, ms), clearTimeout: id => clock.timers.delete(id), setInterval: (fn, ms) => clock.timer(fn, ms, true), clearInterval: id => clock.timers.delete(id),
      encodeURIComponent, Map, Set, JSON, Math, Number, String, Object, Array, Promise, Infinity };
    vm.createContext(c); vm.runInContext(source, c);
    const capture = { players: [], statuses: [] };
    const join = (uid, extra = {}) => c.window.QPVillagePresence.connect({ db: sdkInstance?.db, uid, name: uid, avatar: { sex: 'f', sk: 0, hair: 'bob:1', top: 'hood:7', gold: 999 },
      onPlayers: p => capture.players.push(copy(p)), onStatus: s => capture.statuses.push(copy(s)), ...extra });
    return { join, capture, sdk: sdkInstance, latest: () => capture.players.at(-1), mode: () => capture.statuses.at(-1)?.mode };
  }
  return { clock, data, writes, listeners, get, set, notify, sdk, runtime };
}
const passed = [];
(async () => {
  {
    const e = environment(), alice = e.runtime(), bob = e.runtime();
    const a = alice.join('alice'), b = bob.join('bob'); await settle();
    assert.equal(alice.mode(), 'connected'); assert.equal(bob.mode(), 'connected');
    assert.equal(alice.latest().length, 2); assert.equal(bob.latest().length, 2);
    a.update({ x: 380, y: 460, height: 72, facing: 'left', moving: true }); await e.clock.advance(160);
    const friend = bob.latest().find(p => p.uid === 'alice');
    assert.equal(friend.x, 380); assert.equal(friend.height, 72); assert.equal(friend.facing, -1); assert.equal(friend.pose, 'walk'); assert.equal(friend.self, false);
    const movementWrite = e.writes.filter(w => w.client === alice.sdk.client).at(-1); assert(movementWrite.patch); assert(!('avatar' in movementWrite.value), 'Movement must not retransmit complete outfits');
    a.update({ x: 390, y: 420, height: 148, moving: true, pose: 'climb' }); await e.clock.advance(160);
    const climbing = bob.latest().find(p => p.uid === 'alice'); assert.equal(climbing.pose, 'climb'); assert.equal(climbing.height, 148); assert.equal(climbing.x, 390);
    a.update({ moving: false, zone: 'tailor' }); await e.clock.advance(160);
    assert.equal(bob.latest().find(p => p.uid === 'alice').zone, 'tailor'); assert.equal(bob.latest().find(p => p.uid === 'alice').moving, false);
    a.setProfile({ name: '새 이름', avatar: { sex: 'm', hair: 'wolf:1', sk: 4, gold: 4000, owned: {} } }); await settle();
    const outfit = bob.latest().find(p => p.uid === 'alice'); assert.equal(outfit.name, '새 이름'); assert.equal(outfit.avatar.hair, 'wolf:1'); assert.equal(outfit.avatar.sk, 4); assert(!('gold' in outfit.avatar));
    a.setProfile({ avatar: { sk: 999, ec: 999, sex: 'm', hair: '<script>' } }); await settle();
    assert.equal(bob.latest().find(p => p.uid === 'alice').avatar.sk, 4); assert.equal(bob.latest().find(p => p.uid === 'alice').avatar.ec, 5); assert(!('hair' in bob.latest().find(p => p.uid === 'alice').avatar));
    assert(e.writes.every(w => /^quiz\/village\/3-3\/connections\//.test(w.path)), 'Presence must never write users, quiz rooms, answers or rewards');
    await a.disconnect(); await b.disconnect(); await settle(); assert.equal(e.listeners.size, 0);
    passed.push('Two students share movement, elevation, direction, room entry and changed outfits; account economy and quiz records remain isolated.');
  }
  {
    const e = environment(), tab1 = e.runtime(), tab2 = e.runtime(), friend = e.runtime();
    const a1 = tab1.join('same'), a2 = tab2.join('same'), b = friend.join('friend'); await settle();
    assert.notEqual(a1.getState().connectionId, a2.getState().connectionId); assert.equal(friend.latest().filter(p => p.uid === 'same').length, 1);
    await a1.disconnect(); await settle(); assert.equal(friend.latest().filter(p => p.uid === 'same').length, 1); assert(e.get(a2.getState().path + '/' + a2.getState().connectionId));
    tab2.sdk.client.drop(); await settle(); assert.equal(friend.latest().filter(p => p.uid === 'same').length, 0);
    await a2.disconnect(); await b.disconnect();
    passed.push('Duplicate tabs produce one friend per zone; closing or dropping one connection removes only its own node.');
  }
  {
    const e = environment(), aRuntime = e.runtime(), bRuntime = e.runtime();
    const a = aRuntime.join('a'), b = bRuntime.join('b'); await settle();
    const registrations = aRuntime.sdk.client.registrations;
    aRuntime.sdk.client.drop(); await settle(); const count = e.writes.length;
    assert.equal(aRuntime.mode(), 'offline'); assert.equal(bRuntime.latest().some(p => p.uid === 'a'), false);
    a.update({ x: 555, y: 666, moving: false }); await e.clock.advance(12000);
    assert.equal(e.writes.filter(w => w.client === aRuntime.sdk.client).length, count - 1, 'Offline local changes must not write');
    aRuntime.sdk.client.reconnect(); await settle();
    assert.equal(aRuntime.mode(), 'connected'); assert(aRuntime.sdk.client.registrations > registrations);
    assert.equal(bRuntime.latest().find(p => p.uid === 'a').x, 555);
    await a.disconnect(); await b.disconnect();
    passed.push('A dropped connection disappears, supports local movement, re-registers server cleanup and rejoins at the latest position.');
  }
  {
    const e = environment(), aRuntime = e.runtime(), bRuntime = e.runtime();
    const a = aRuntime.join('a'), b = bRuntime.join('b'); await settle();
    const initial = e.writes.filter(w => w.client === aRuntime.sdk.client).length;
    for (let n = 1; n <= 100; n++) { a.update({ x: n, y: 300, moving: true }); await e.clock.advance(1); }
    assert.equal(e.writes.filter(w => w.client === aRuntime.sdk.client).length, initial);
    await e.clock.advance(51); assert.equal(bRuntime.latest().find(p => p.uid === 'a').x, 100);
    const moved = e.writes.filter(w => w.client === aRuntime.sdk.client).length;
    for (let n = 0; n < 100; n++) a.update({ x: 100, y: 300, moving: true });
    await e.clock.advance(500); assert.equal(e.writes.filter(w => w.client === aRuntime.sdk.client).length, moved);
    a.update({ gesture: { type: 'wave', to: 'b', duration: 1800 } }); await settle();
    assert.equal(bRuntime.latest().find(p => p.uid === 'a').gesture.type, 'wave');
    await e.clock.advance(3000); assert.equal(bRuntime.latest().find(p => p.uid === 'a').gesture, null);
    const callbacks = bRuntime.capture.players.length; await e.clock.advance(7500);
    assert.equal(bRuntime.capture.players.length, callbacks, 'Heartbeat must not recreate unchanged avatar DOM');
    assert(e.writes.filter(w => w.client === aRuntime.sdk.client).length <= moved + 2);
    assert.deepEqual(Object.keys(e.writes.filter(w => w.client === aRuntime.sdk.client).at(-1).value).sort(), ['sequence', 'updatedAt']);
    await a.disconnect(); await b.disconnect();
    passed.push('Fast movement coalesces to the latest position, unchanged idle frames do not write, gestures arrive immediately and expire without resetting avatar clocks.');
  }
  {
    const e = environment(), r = e.runtime(), a = r.join('a', { bounds: { width: 2000, height: 1400 } }); await settle();
    const record = { uid: 'stale', name: '오래된 친구', avatar: {}, version: 1, x: 30, y: 40, height: 0, zone: 'village', facing: 1, moving: false, updatedAt: e.clock.time - 34990 };
    e.set(a.getState().path + '/stale', record);
    for (const [id, bad] of Object.entries({ badVersion: { version: 8 }, nan: { x: '30' }, outOfWorld: { x: 99999 }, future: { updatedAt: e.clock.time + 100000 }, invalidZone: { zone: '../users' } })) e.set(a.getState().path + '/' + id, { ...record, uid: id, updatedAt: e.clock.time, ...bad });
    e.notify(); await settle(); assert.equal(r.latest().length, 2);
    await e.clock.advance(1100); assert.equal(r.latest().length, 1, 'TTL must hide abandoned nodes even if database does not change');
    a.update({ x: Infinity, y: NaN, height: 'bad', zone: '../users' }); await settle(); assert.equal(a.getState().zone, 'village'); assert.equal(a.getState().x, 0);
    a.update({ x: 99999, y: -100, height: 99999 }); await e.clock.advance(151);
    assert.equal(a.getState().x, 2000); assert.equal(a.getState().y, 0); assert.equal(a.getState().height, 1024);
    await a.disconnect();
    passed.push('Expired, malformed, future-dated and out-of-world friends are hidden; invalid local coordinates and storage-like zone paths cannot escape world bounds.');
  }
  {
    const e = environment(), sender = e.runtime(), receiver = e.runtime();
    const a = sender.join('direction_sender'), b = receiver.join('direction_receiver'); await settle();
    assert.equal(a.getState().direction, 'front'); assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'front');
    for (const direction of ['left', 'front', 'back', 'right']) {
      a.update({ x: 200, direction, moving: true, facing: -1 }); await e.clock.advance(160);
      const remote = receiver.latest().find(p => p.uid === 'direction_sender');
      assert.equal(remote.direction, direction); assert.equal(remote.facing, -1, 'New profile direction must not rewrite the legacy facing');
    }
    a.update({ moving: false }); await e.clock.advance(160);
    assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'right', 'Stopping preserves the last chosen frame');
    let x = 210;
    for (const direction of ['upside-down', 'left\" onclick=\"injected', '<svg>', null, 1, {}, []]) a.update({ x: x++, direction });
    await e.clock.advance(160);
    assert.equal(a.getState().direction, 'right'); assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'right');
    assert(e.writes.every(w => !Object.prototype.hasOwnProperty.call(w.value, 'direction') || ['front', 'left', 'right', 'back'].includes(w.value.direction)), 'Only safe direction values may be broadcast');
    sender.sdk.client.drop(); await settle(); a.update({ direction: 'left', x: 777 }); sender.sdk.client.reconnect(); await settle();
    assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'left'); assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').x, 777);
    const legacy = { name: 'legacy', avatar: {}, version: 1, x: 20, y: 30, height: 0, zone: 'village', updatedAt: e.clock.time, pose: 'idle' };
    for (const [id, patch] of Object.entries({ legacy_left: { facing: 'left', moving: true }, legacy_right: { facing: 1, moving: true }, legacy_idle: { facing: -1, moving: false }, malformed_direction: { direction: 'front\" data-evil', facing: 'left', moving: false } })) e.set(a.getState().path + '/' + id, { ...legacy, uid: id, ...patch });
    e.notify(); await settle();
    for (const [id, direction] of Object.entries({ legacy_left: 'left', legacy_right: 'right', legacy_idle: 'front', malformed_direction: 'front' })) assert.equal(receiver.latest().find(p => p.uid === id)?.direction, direction, 'Old or malformed direction records remain safely readable');
    assert.equal(e.get(a.getState().path + '/' + a.getState().connectionId).version, 1);
    await a.disconnect(); await b.disconnect();
    passed.push('Front/left/right/back frames synchronize independently of legacy facing, survive stop and reconnect, reject injected enums, and preserve safe version-1 legacy records.');
  }
  {
    const e = environment(), earlySDK = e.sdk(), lateSDK = e.sdk();
    earlySDK.client.offset = 60000; lateSDK.client.offset = -60000;
    const early = e.runtime(earlySDK, -60000), late = e.runtime(lateSDK, 60000);
    const a = early.join('early_clock'), b = late.join('late_clock'); await settle();
    assert.equal(a.getTime(), e.clock.time); assert.equal(b.getTime(), e.clock.time);
    a.update({ gesture: { type: 'wave', duration: 1800 } }); await settle();
    const wave = late.latest().find(p => p.uid === 'early_clock').gesture;
    assert.equal(wave.at, b.getTime()); assert.equal(wave.at + wave.duration - b.getTime(), 1800);
    await e.clock.advance(1000);
    assert.equal(a.getTime(), e.clock.time); assert.equal(b.getTime(), e.clock.time);
    assert.equal(wave.at + wave.duration - b.getTime(), 800);
    b.update({ gesture: { type: 'heart', duration: 2600 } }); await settle();
    const heart = early.latest().find(p => p.uid === 'late_clock').gesture;
    assert.equal(heart.at, a.getTime()); assert.equal(heart.at + heart.duration - a.getTime(), 2600);
    await e.clock.advance(3000);
    assert.equal(late.latest().find(p => p.uid === 'early_clock').gesture, null);
    assert.equal(early.latest().find(p => p.uid === 'late_clock').gesture, null);
    await a.disconnect(); await b.disconnect();
    passed.push('Device clocks a minute early and late share a server-adjusted getTime; received gestures keep their full duration and expire on the same clock.');
  }
  {
    const e = environment(), offline = e.runtime(null), a = offline.join('a');
    assert.equal(offline.mode(), 'local'); a.update({ x: 200, y: 300 }); assert.equal(offline.latest()[0].x, 200); await a.disconnect();
    const sdk = e.sdk(null), demo = e.runtime(sdk), d = demo.join('demo'); await settle(); assert.equal(demo.mode(), 'connected'); await d.disconnect();
    const blockedSdk = e.sdk(), blocked = e.runtime(blockedSdk); blockedSdk.client.deny = true;
    const denied = blocked.join('denied'); await settle(); assert.equal(blocked.mode(), 'local'); assert.equal(denied.getState().connected, false); await denied.disconnect();
    passed.push('Missing database and denied writes report local fallback without losing movement; the isolated demo adapter remains compatible.');
  }
  {
    const e = environment(), r = e.runtime(), a = r.join('campus_start', { space: 'campus', classId: '우리 반/3.3', bounds: { width: 1900, height: 1200 }, initialState: { x: 1120, y: 680, zone: 'campus', direction: 'left', pose: 'sit', seatId: 'seat-1' } });
    await settle();
    assert.equal(a.getState().path, 'quiz/spaces/%EC%9A%B0%EB%A6%AC%20%EB%B0%98%2F3%2E3/campus/connections');
    assert.equal(a.getState().x, 1120); assert.equal(a.getState().y, 680); assert.equal(a.getState().zone, 'campus'); assert.equal(a.getState().direction, 'left');
    assert.equal(a.getState().seatId, null); assert.equal(a.getState().pose, 'idle', 'Restoring a checkpoint must not acquire a seat');
    a.update({ seatId: 'seat-1', pose: 'sit' }); await e.clock.advance(160);
    assert.equal(a.getState().seatId, null); assert.equal(a.getState().pose, 'idle', 'An update cannot bypass atomic seat ownership');
    assert.equal(await a.claimSeat('../users'), false); assert.equal(await a.claimSeat('<img>'), false);
    assert(e.writes.every(w => w.path.startsWith('quiz/spaces/'))); await a.disconnect();
    passed.push('Campus presence has a separate encoded class path, starts at its actual spawn, and checkpoint/state updates cannot impersonate a shared seat claim.');
  }
  {
    const e = environment(), first = e.runtime(), second = e.runtime();
    const a = first.join('same_account', { space: 'campus' }), b = second.join('same_account', { space: 'campus' }); await settle();
    const claimed = await Promise.all([a.claimSeat('seat-1'), b.claimSeat('seat-1')]); await settle();
    assert.equal(claimed.filter(Boolean).length, 1, 'Only one concurrent transaction may acquire a chair');
    const winner = claimed[0] ? a : b, loser = claimed[0] ? b : a;
    const seatPath = winner.getState().path.replace('/connections', '/seats/seat-1');
    assert.equal(e.get(seatPath).owner, winner.getState().connectionId); assert.equal(winner.getState().seatShared, true);
    assert.equal(await loser.claimSeat('seat-1'), false);
    await loser.releaseSeat(); await loser.disconnect();
    assert.equal(e.get(seatPath).owner, winner.getState().connectionId, 'Another tab for the same account must not release the owner');
    const lease = e.get(seatPath).claims[winner.getState().connectionId];
    await e.clock.advance(24000);
    assert(e.get(seatPath).claims[winner.getState().connectionId].expiresAt > lease.expiresAt, 'Heartbeat must renew a seated student');
    await winner.releaseSeat(); assert.equal(e.get(seatPath + '/claims/' + winner.getState().connectionId), null);
    await winner.disconnect(); assert.equal(e.listeners.size, 0);
    assert.equal(first.sdk.client.coldStarts + second.sdk.client.coldStarts, 0, 'Atomic seat decisions keep a loaded Firebase value view');
    passed.push('Simultaneous claims grant one seat, another tab cannot steal/release it, idle heartbeats renew the lease, and release/disconnect clean up only the unique owner claim.');
  }
  {
    const e = environment(), runtimes = Array.from({ length: 30 }, () => e.runtime());
    const pupils = runtimes.map((r, i) => r.join('pupil-' + i, { space: 'campus', initialState: { x: 200 + i, y: 500, zone: 'campus' } })); await settle();
    const results = await Promise.all(pupils.map((p, i) => p.claimSeat('seat-' + (i + 1)))); await settle();
    pupils.forEach(p => p.update({ direction: 'back', pose: 'sit' })); await e.clock.advance(160);
    assert(results.every(Boolean)); assert.equal(runtimes[0].latest().length, 30);
    assert.equal(new Set(runtimes[0].latest().map(p => p.seatId)).size, 30);
    assert(runtimes[0].latest().every(p => p.pose === 'sit' && p.seatId && p.direction === 'back'), 'Every seated classmate faces the board with its shared back direction');
    const seats = e.get('quiz/spaces/3-3/campus/seats'); assert.equal(Object.keys(seats).length, 30);
    assert.equal(new Set(Object.values(seats).map(s => s.owner)).size, 30);
    assert(e.writes.every(w => /^quiz\/spaces\/3-3\/campus\/(connections|seats)\//.test(w.path)), 'Seats and presence may never write accounts, answers or rewards');
    await Promise.all(pupils.map(p => p.disconnect())); assert.equal(e.listeners.size, 0);
    assert(Object.values(e.get('quiz/spaces/3-3/campus/seats')).every(s => Object.keys(s.claims || {}).length === 0));
    passed.push('Thirty isolated student connections share thirty unique seats and sitting poses while all storage writes stay outside accounts, quizzes and scores.');
  }
  {
    const e = environment(), first = e.runtime(), next = e.runtime();
    const a = first.join('old_owner', { space: 'campus' }), b = next.join('next_owner', { space: 'campus' }); await settle();
    assert.equal(await a.claimSeat('seat-1'), true);
    const seatPath = 'quiz/spaces/3-3/campus/seats/seat-1', old = e.get(seatPath);
    old.claims[old.owner].expiresAt = e.clock.time - 1; e.set(seatPath, old);
    assert.equal(await b.claimSeat('seat-1'), true, 'An expired abandoned lease must be reclaimable');
    await a.disconnect(); assert.equal(e.get(seatPath).owner, b.getState().connectionId);
    assert(e.get(seatPath + '/claims/' + b.getState().connectionId), 'Late disconnect cleanup cannot remove the replacement owner');
    next.sdk.client.drop(); await settle();
    assert.equal(e.get(seatPath + '/claims/' + b.getState().connectionId), null, 'Server disconnect removes the unique claim');
    assert.equal(b.getState().seatId, null); assert.equal(b.getState().pose, 'idle');
    await b.disconnect();
    passed.push('Expired leases can be reclaimed, an old tab cannot remove a replacement owner, and server disconnect clears the unique seat claim and local sitting pose.');
  }
  {
    const e = environment(), r = e.runtime(), a = r.join('retry', { space: 'campus' }); await settle();
    const other = { version: 1, owner: 'other_connection', claims: { other_connection: { uid: 'other', connectionId: 'other_connection', updatedAt: e.clock.time, expiresAt: e.clock.time + 35000 } } };
    r.sdk.client.beforeCommit = path => e.set(path, other);
    assert.equal(await a.claimSeat('seat-1'), false, 'A Firebase updater retry must respect the new server owner');
    assert(r.sdk.client.transactionRetries > 0); assert.equal(e.get('quiz/spaces/3-3/campus/seats/seat-1').owner, 'other_connection');
    assert.equal(r.sdk.client.coldStarts, 0); await a.disconnect();
    passed.push('A Firebase-style updater retry after another server claim rejects the occupied seat instead of overwriting it, with no cold-cache null decisions.');
  }
  {
    const e = environment(), local = e.runtime(null), a = local.join('offline', { space: 'campus', initialState: { x: 700, y: 500 } });
    assert.equal(await a.claimSeat('seat-1'), true); assert.equal(a.getState().seatShared, false); assert.equal(a.getState().mode, 'local');
    await a.releaseSeat(); assert.equal(a.getState().seatId, null); await a.disconnect();
    const r = e.runtime(), lost = [], b = r.join('reconnect', { space: 'campus', onSeatLost: x => lost.push(x) }); await settle();
    r.sdk.client.drop(); await settle(); assert.equal(await b.claimSeat('seat-2'), true); assert.equal(b.getState().seatShared, false);
    r.sdk.client.reconnect(); await settle();
    assert.equal(b.getState().seatId, null); assert.equal(b.getState().pose, 'idle'); assert.equal(lost.at(-1).reason, 'reconnect');
    assert.equal(e.get(b.getState().path + '/' + b.getState().connectionId).seatId, null);
    assert.equal(e.get('quiz/spaces/3-3/campus/seats/seat-2'), null, 'Offline sitting must not invent a server claim on reconnect'); await b.disconnect();
    const blockedSDK = e.sdk(); blockedSDK.client.denyRead = true;
    const blocked = e.runtime(blockedSDK), c = blocked.join('blocked', { space: 'campus' }); await settle();
    assert.equal(blocked.mode(), 'local'); assert.equal(await c.claimSeat('seat-3'), true); assert.equal(c.getState().seatShared, false);
    assert.equal(e.get(c.getState().path + '/' + c.getState().connectionId), null, 'Read-denied presence must not report shared membership');
    await c.disconnect();
    passed.push('Local or read-denied classrooms keep walking/sitting usable, label claims as local, and clear offline seats before reconnect rather than publishing fictitious ownership.');
  }
  {
    const e = environment(), r = e.runtime(), lost = [], a = r.join('expired_local', { space: 'campus', onSeatLost: x => lost.push(x) }); await settle();
    assert.equal(await a.claimSeat('seat-1'), true);
    // Simulate a suspended tab: no presence/seat heartbeats run, while the
    // next timer/event notices that its server-adjusted lease has expired.
    for (const [id, timer] of e.clock.timers) if (timer.interval === 10000) e.clock.timers.delete(id);
    await e.clock.advance(36000);
    assert.equal(a.getState().seatShared, false); assert.equal(a.getState().seatId, null); assert.equal(lost.at(-1).reason, 'expired');
    const bRuntime = e.runtime(), b = bRuntime.join('replacement', { space: 'campus' }); await settle();
    assert.equal(await b.claimSeat('seat-1'), true);
    r.sdk.client.drop(); await settle();
    assert(e.get('quiz/spaces/3-3/campus/seats/seat-1/claims/' + b.getState().connectionId));
    await a.disconnect(); await b.disconnect();
    const deniedSDK = e.sdk(), deniedRuntime = e.runtime(deniedSDK), c = deniedRuntime.join('seat_write_denied', { space: 'campus' }); await settle();
    deniedSDK.client.deny = true; assert.equal(await c.claimSeat('seat-2'), true);
    assert.equal(c.getState().seatShared, false); assert.equal(c.getState().mode, 'local');
    const before = e.writes.filter(w => w.client === deniedSDK.client).length;
    await e.clock.advance(12000); assert.equal(c.getState().mode, 'local');
    assert.equal(e.writes.filter(w => w.client === deniedSDK.client).length, before, 'Denied shared writes must not later report a fictitious connected seat');
    await c.disconnect();
    passed.push('A suspended tab gives up its expired local sitting pose before a replacement claims the chair, and seat-write permission failures stay explicitly local without invented shared writes.');
  }
  {
    const e = environment(), first = e.runtime(), friend = e.runtime();
    const a = first.join('floor_sitter', { space: 'campus' }), b = friend.join('floor_friend', { space: 'campus' }); await settle();
    a.update({ x: 730, y: 610, moving: false, direction: 'front', pose: 'sit-floor', seatId: null }); await e.clock.advance(160);
    const remote = friend.latest().find(p => p.uid === 'floor_sitter');
    assert.equal(a.getState().pose, 'sit-floor'); assert.equal(remote.pose, 'sit-floor'); assert.equal(remote.seatId, null);
    assert.equal(remote.x, 730); assert.equal(remote.y, 610); assert.equal(remote.direction, 'front');
    assert.equal(e.get('quiz/spaces/3-3/campus/seats'), null, 'Floor sitting must not reserve any chair');
    const ownRecord = e.get(a.getState().path + '/' + a.getState().connectionId); assert.equal(ownRecord.pose, 'sit-floor'); assert.equal(ownRecord.seatId, null);
    a.update({ pose: 'sit', seatId: 'seat-1' }); await e.clock.advance(160);
    assert.equal(a.getState().pose, 'idle'); assert.equal(friend.latest().find(p => p.uid === 'floor_sitter').seatId, null, 'Chair sitting still requires an atomic claim');
    a.update({ pose: 'sit-floor\" onclick=\"injected' }); await e.clock.advance(160);
    assert.equal(a.getState().pose, 'idle'); assert.equal(friend.latest().find(p => p.uid === 'floor_sitter').pose, 'idle', 'Malformed pose values cannot be broadcast');
    assert.equal(await a.claimSeat('seat-1'), true); a.update({ direction: 'back', pose: 'sit' }); await e.clock.advance(160);
    assert.equal(friend.latest().find(p => p.uid === 'floor_sitter').pose, 'sit'); assert.equal(friend.latest().find(p => p.uid === 'floor_sitter').seatId, 'seat-1');
    await a.releaseSeat(); a.update({ pose: 'sit-floor', seatId: null }); await e.clock.advance(160);
    assert.equal(friend.latest().find(p => p.uid === 'floor_sitter').pose, 'sit-floor'); assert.equal(friend.latest().find(p => p.uid === 'floor_sitter').seatId, null);
    await a.disconnect(); await b.disconnect();
    passed.push('Floor sitting shares its pose and floor position without reserving a chair, rejects injected poses, and remains separate from atomically claimed chair sitting.');
  }
  {
    const e = environment(), r = e.runtime(), a = r.join('quick_seat_change', { space: 'campus' }); await settle();
    const first = a.claimSeat('seat-A'), second = a.claimSeat('seat-B');
    const staleCleanup = first.then(() => a.releaseSeat('seat-A'));
    assert.equal(await first, true); assert.equal(await second, true); assert.equal(await staleCleanup, false);
    assert.equal(a.getState().seatId, 'seat-B'); assert.equal(a.getState().seatShared, true);
    const seatsPath = 'quiz/spaces/3-3/campus/seats';
    assert.equal(e.get(seatsPath + '/seat-A/claims/' + a.getState().connectionId), null);
    assert(e.get(seatsPath + '/seat-B/claims/' + a.getState().connectionId), 'Late cleanup from chair A must preserve the newer chair B claim');
    await a.releaseSeat('seat-B'); assert.equal(a.getState().seatId, null);
    assert.equal(e.get(seatsPath + '/seat-B/claims/' + a.getState().connectionId), null);
    assert.equal(await a.claimSeat('seat-C'), true); await a.releaseSeat(); assert.equal(a.getState().seatId, null, 'No-argument release retains ordinary stand cleanup');
    await a.disconnect();
    passed.push('Queued chair A/B claims and a late canceled-A cleanup preserve chair B; expected-seat release affects only its matching chair and normal stand cleanup remains compatible.');
  }
  {
    const e = environment(), slowSDK = e.sdk(), fastSDK = e.sdk();
    slowSDK.client.offset = 60000; fastSDK.client.offset = -60000;
    const slow = e.runtime(slowSDK, -60000), fast = e.runtime(fastSDK, 60000);
    const a = slow.join('steady_wave', { space: 'campus' }), b = fast.join('wave_friend', { space: 'campus' }); await settle();
    const firstAt = a.getTime(), wave = { type: 'wave', at: firstAt, duration: 1500 };
    a.update({ gesture: wave }); await settle();
    for (let tick = 1; tick <= 9; tick++) {
      await e.clock.advance(150); a.update({ x: 500 + tick, gesture: wave }); await settle();
      const remote = fast.latest().find(p => p.uid === 'steady_wave').gesture;
      assert.equal(remote.at, firstAt, 'Repeated production motion publications must preserve the gesture start');
      assert.equal(remote.duration, 1500); assert.equal((b.getTime() - remote.at) / remote.duration, tick / 10, 'The friend gesture must progress instead of restarting each frame');
    }
    await e.clock.advance(200); a.update({ x: 520, gesture: wave }); await settle();
    assert.equal(fast.latest().find(p => p.uid === 'steady_wave').gesture, null, 'An expired repeated event must not restart');
    const secondAt = a.getTime(); a.update({ gesture: { ...wave, at: secondAt } }); await settle();
    assert.equal(fast.latest().find(p => p.uid === 'steady_wave').gesture.at, secondAt); assert(secondAt > firstAt, 'A second same-type greeting gets its own timeline');
    a.update({ gesture: null }); await settle(); assert.equal(fast.latest().find(p => p.uid === 'steady_wave').gesture, null, 'Explicit clear stops the friend gesture');
    a.update({ gesture: { type: 'hello', at: a.getTime() - 60000, duration: 1500 } }); await settle();
    assert.equal(fast.latest().find(p => p.uid === 'steady_wave').gesture.at, a.getTime(), 'A known slow-device timestamp is translated to the server clock');
    b.update({ gesture: { type: 'hello', at: b.getTime() + 60000, duration: 1500 } }); await settle();
    assert.equal(slow.latest().find(p => p.uid === 'wave_friend').gesture.at, b.getTime(), 'A known fast-device timestamp is translated to the server clock');
    a.update({ gesture: { type: 'happy', duration: 1500 } }); await settle(); assert.equal(fast.latest().find(p => p.uid === 'steady_wave').gesture.at, a.getTime(), 'Legacy callers without at use the current server clock');
    a.update({ gesture: { type: 'happy', at: a.getTime() - 8000, duration: 1500 } }); await settle();
    assert.equal(fast.latest().find(p => p.uid === 'steady_wave').gesture, null, 'A stale server timeline is cleared rather than replayed');
    await a.disconnect(); await b.disconnect();
    passed.push('Repeated campus gesture publications keep one advancing timeline and expire naturally; another same-type greeting restarts once, null clears it, and slow/fast device clocks normalize without resetting friends.');
  }
  {
    const e = environment(), classAlice = e.runtime(), classBob = e.runtime(), yardAlice = e.runtime(), yardBob = e.runtime();
    const a = classAlice.join('alice', { space: 'campus', initialState: { x: 210, y: 400 } }), b = classBob.join('bob', { space: 'campus' });
    const p = yardAlice.join('alice', { space: 'playground', initialState: { x: 1720, y: 900 } }), q = yardBob.join('bob', { space: 'playground' }); await settle();
    assert.equal(p.getState().path, 'quiz/spaces/3-3/playground/connections'); assert.equal(p.getState().zone, 'playground'); assert.equal(p.getState().x, 1720);
    a.update({ x: 280, y: 430, moving: true, direction: 'left' }); a.setProfile({ avatar: { sex: 'f', hair: 'long:7', top: 'shirt:2' } });
    p.update({ x: 1860, y: 940, moving: true, direction: 'right', zone: 'campus' }); p.setProfile({ avatar: { sex: 'm', hair: 'wolf:3', top: 'hood:5' } }); await e.clock.advance(160);
    const classroomFriend = classBob.latest().find(x => x.uid === 'alice'), playgroundFriend = yardBob.latest().find(x => x.uid === 'alice');
    assert.equal(classAlice.latest().length, 2); assert.equal(yardAlice.latest().length, 2);
    assert.equal(classroomFriend.x, 280); assert.equal(classroomFriend.avatar.hair, 'long:7'); assert.equal(classroomFriend.zone, 'campus');
    assert.equal(playgroundFriend.x, 1860); assert.equal(playgroundFriend.avatar.hair, 'wolf:3'); assert.equal(playgroundFriend.zone, 'playground', 'A zone patch cannot cross the selected shared namespace');
    assert.equal(await a.claimSeat('bench-1'), true); assert.equal(await p.claimSeat('bench-1'), true, 'The same seat ID belongs to its own space');
    assert.equal(await b.claimSeat('bench-1'), false); assert.equal(await q.claimSeat('bench-1'), false);
    a.update({ direction: 'back', pose: 'sit' }); p.update({ direction: 'back', pose: 'sit' }); await e.clock.advance(160);
    const classSeat = 'quiz/spaces/3-3/campus/seats/bench-1', yardSeat = 'quiz/spaces/3-3/playground/seats/bench-1';
    const classDeadline = e.get(classSeat).claims[a.getState().connectionId].expiresAt, yardDeadline = e.get(yardSeat).claims[p.getState().connectionId].expiresAt;
    await e.clock.advance(12000);
    assert(e.get(classSeat).claims[a.getState().connectionId].expiresAt > classDeadline); assert(e.get(yardSeat).claims[p.getState().connectionId].expiresAt > yardDeadline);
    classAlice.sdk.client.drop(); await settle();
    assert.equal(e.get(classSeat + '/claims/' + a.getState().connectionId), null); assert.equal(classBob.latest().length, 1);
    assert(e.get(yardSeat + '/claims/' + p.getState().connectionId), 'A classroom connection drop may not delete a playground lease'); assert.equal(yardBob.latest().length, 2);
    await b.disconnect(); await a.disconnect(); await settle(); assert.equal(yardBob.latest().length, 2); assert(e.get(p.getState().path + '/' + p.getState().connectionId));
    yardAlice.sdk.client.drop(); await settle(); assert.equal(e.get(yardSeat + '/claims/' + p.getState().connectionId), null); assert.equal(yardBob.latest().length, 1);
    await p.disconnect(); await q.disconnect(); assert.equal(e.listeners.size, 0);
    passed.push('Two classroom and two playground connections isolate same-account movement/outfits, same-ID seat leases and room zones; disconnects and cleanup affect only their own shared space.');
  }
  {
    const e = environment(), invalid = e.runtime();
    for (const space of ['../users', 'campus/connections', 'playground/../../accounts', '<svg>', 'unknown', {}, []]) assert.throws(() => invalid.join('invalid_space', { space }), /공유 공간 이름/);
    assert.equal(e.writes.length, 0); assert.equal(e.listeners.size, 0, 'Invalid space inputs cannot allocate database listeners or writes');
    const legacy = invalid.join('explicit_village', { space: 'village' }); await settle(); assert.equal(legacy.getState().path, 'quiz/village/3-3/connections'); await legacy.disconnect();
    const deniedSDK = e.sdk(); deniedSDK.client.deny = true; const denied = e.runtime(deniedSDK), local = denied.join('denied_yard', { space: 'playground', initialState: { x: 2100, y: 800 } }); await settle();
    assert.equal(local.getState().zone, 'playground'); assert.equal(denied.mode(), 'local'); assert.equal(local.getState().connected, false);
    local.update({ x: 2150, pose: 'sit-floor', seatId: null }); assert.equal(local.getState().pose, 'sit-floor'); assert.equal(await local.claimSeat('bench-1'), true); assert.equal(local.getState().seatShared, false);
    assert.equal(e.writes.filter(w => w.client === deniedSDK.client).length, 0); await local.disconnect();
    const readSDK = e.sdk(); readSDK.client.denyRead = true; const unreadable = e.runtime(readSDK), readLocal = unreadable.join('unreadable_yard', { space: 'playground' }); await settle();
    assert.equal(unreadable.mode(), 'local'); assert.equal(await readLocal.claimSeat('bench-1'), true); assert.equal(readLocal.getState().seatShared, false); await readLocal.disconnect();
    const slowSDK = e.sdk(), fastSDK = e.sdk(); slowSDK.client.offset = 60000; fastSDK.client.offset = -60000;
    const slow = e.runtime(slowSDK, -60000), fast = e.runtime(fastSDK, 60000), a = slow.join('yard_wave', { space: 'playground' }), b = fast.join('yard_friend', { space: 'playground' }); await settle();
    const at = a.getTime(), wave = { type: 'wave', at, duration: 1500 }; a.update({ gesture: wave }); await settle();
    for (let tick = 1; tick <= 9; tick++) { await e.clock.advance(150); a.update({ x: tick, gesture: wave }); await settle(); const remote = fast.latest().find(p => p.uid === 'yard_wave').gesture; assert.equal(remote.at, at); assert.equal((b.getTime() - remote.at) / remote.duration, tick / 10); }
    await e.clock.advance(200); a.update({ gesture: wave }); await settle(); assert.equal(fast.latest().find(p => p.uid === 'yard_wave').gesture, null);
    await a.disconnect(); await b.disconnect(); assert.equal(e.listeners.size, 0);
    passed.push('Only campus/playground enter modern namespaces while legacy village remains compatible; denied playground access stays explicitly local and ±60-second devices share one advancing, expiring wave timeline.');
  }
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
