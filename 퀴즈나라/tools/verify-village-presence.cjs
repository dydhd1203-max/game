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
    const client = { connected, offset: 0, registrations: 0, deny: false }; clients.push(client); disconnects.set(client, new Set());
    class Ref {
      constructor(p) { this.path = p; }
      child(p) { return new Ref(this.path + '/' + p); }
      on(event, cb) { assert.equal(event, 'value'); const listener = { path: this.path, cb, client }; listeners.add(listener); queueMicrotask(() => { if (listeners.has(listener)) cb(snap(this.path, client)); }); return cb; }
      off(event, cb) { for (const l of listeners) if (l.client === client && l.path === this.path && (!cb || l.cb === cb)) listeners.delete(l); }
      async set(value) { if (client.deny) throw Object.assign(new Error('Not permitted'), { code: 'PERMISSION_DENIED' }); assert.notEqual(client.connected, false, 'Do not publish movement while offline'); writes.push({ client, path: this.path, value: copy(value), at: clock.time }); set(this.path, value); notify(); }
      async update(patch) { if (client.deny) throw Object.assign(new Error('Not permitted'), { code: 'PERMISSION_DENIED' }); assert.notEqual(client.connected, false, 'Do not publish movement while offline'); writes.push({ client, path: this.path, value: copy(patch), at: clock.time, patch: true }); set(this.path, { ...(get(this.path) || {}), ...copy(patch) }); notify(); }
      async remove() { set(this.path, null); notify(); }
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
    for (const direction of ['left', 'front', 'right']) {
      a.update({ x: 200, direction, moving: true, facing: -1 }); await e.clock.advance(160);
      const remote = receiver.latest().find(p => p.uid === 'direction_sender');
      assert.equal(remote.direction, direction); assert.equal(remote.facing, -1, 'New profile direction must not rewrite the legacy facing');
    }
    a.update({ moving: false }); await e.clock.advance(160);
    assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'right', 'Stopping preserves the last chosen frame');
    let x = 210;
    for (const direction of ['back', 'left\" onclick=\"injected', '<svg>', null, 1, {}, []]) a.update({ x: x++, direction });
    await e.clock.advance(160);
    assert.equal(a.getState().direction, 'right'); assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'right');
    assert(e.writes.every(w => !Object.prototype.hasOwnProperty.call(w.value, 'direction') || ['front', 'left', 'right'].includes(w.value.direction)), 'Only the three safe direction values may be broadcast');
    sender.sdk.client.drop(); await settle(); a.update({ direction: 'left', x: 777 }); sender.sdk.client.reconnect(); await settle();
    assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').direction, 'left'); assert.equal(receiver.latest().find(p => p.uid === 'direction_sender').x, 777);
    const legacy = { name: 'legacy', avatar: {}, version: 1, x: 20, y: 30, height: 0, zone: 'village', updatedAt: e.clock.time, pose: 'idle' };
    for (const [id, patch] of Object.entries({ legacy_left: { facing: 'left', moving: true }, legacy_right: { facing: 1, moving: true }, legacy_idle: { facing: -1, moving: false }, malformed_direction: { direction: 'front\" data-evil', facing: 'left', moving: false } })) e.set(a.getState().path + '/' + id, { ...legacy, uid: id, ...patch });
    e.notify(); await settle();
    for (const [id, direction] of Object.entries({ legacy_left: 'left', legacy_right: 'right', legacy_idle: 'front', malformed_direction: 'front' })) assert.equal(receiver.latest().find(p => p.uid === id)?.direction, direction, 'Old or malformed direction records remain safely readable');
    assert.equal(e.get(a.getState().path + '/' + a.getState().connectionId).version, 1);
    await a.disconnect(); await b.disconnect();
    passed.push('Front/left/right frames synchronize independently of legacy facing, survive stop and reconnect, reject injected enums, and preserve safe version-1 legacy records.');
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
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
