/* Shared class presence, independent of quiz rooms, answers and account rewards. */
(() => {
  'use strict';
  const VERSION = 1, TTL = 35000, HEARTBEAT = 10000, MOVE_INTERVAL = 150, SEAT_TTL = 35000;
  const AVATAR_KEYS = ['sk', 'ec', 'sex', 'eyes', 'hair', 'top', 'bottom', 'shoes', 'hat', 'glass', 'ear', 'neck', 'back', 'pet', 'bg', 'face', 'frame', 'effect', 'expression'];
  const GESTURES = new Set(['wave', 'hello', 'happy', 'heart', 'clap', 'surprise', 'sad', 'laugh', 'cheer']);
  const POSES = new Set(['idle', 'walk', 'run', 'wave', 'climb', 'jump', 'sit', 'sit-floor', 'land']);
  const DIRECTIONS = new Set(['front', 'left', 'right', 'back']);
  const SHARED_SPACES = new Set(['campus', 'playground']);
  const ZONE = /^[a-z][a-z0-9_-]{0,47}$/;
  const SEAT = /^[a-zA-Z0-9_-]{1,64}$/;
  const text = (value, length) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, length);
  const key = value => encodeURIComponent(text(value, 120) || 'class').replace(/\./g, '%2E');
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  function avatar(value) {
    const clean = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
    for (const field of AVATAR_KEYS) {
      if (field === 'sk' || field === 'ec') {
        // These are the current shared renderer's five skin / six iris colors.
        // Invalid remote palette indices must not reach PAL.skin[index][0].
        if (Number.isFinite(Number(value[field]))) clean[field] = Math.round(finite(value[field], 0, 0, field === 'sk' ? 4 : 5));
      } else if (typeof value[field] === 'string' && /^[a-zA-Z0-9_:-]*$/.test(value[field])) clean[field] = text(value[field], 80);
    }
    if (clean.sex && clean.sex !== 'm' && clean.sex !== 'f') delete clean.sex;
    return clean;
  }
  function connect(options = {}) {
    const uid = text(options.uid, 120);
    if (!uid) throw new Error('마을에 들어갈 학생 계정이 필요해요.');
    const bounds = options.bounds || {};
    const maxX = finite(bounds.width, 4096, 1, 16384), maxY = finite(bounds.height, 4096, 1, 16384);
    const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || Date.now().toString(36) + Math.random().toString(36).slice(2);
    const connectionId = key(uid).slice(0, 120) + '_' + random;
    const base = text(options.base || 'quiz', 100).replace(/^\/+|\/+$/g, '');
    if (!base || /[.#$\[\]]/.test(base)) throw new Error('마을 저장 경로가 올바르지 않아요.');
    const space = options.space == null ? 'village' : options.space;
    if (space !== 'village' && !SHARED_SPACES.has(space)) throw new Error('공유 공간 이름이 올바르지 않아요.');
    const sharedSpace = SHARED_SPACES.has(space);
    const spacePath = sharedSpace ? base + '/spaces/' + key(options.classId || '3-3') + '/' + space : base + '/village/' + key(options.classId || '3-3');
    const path = spacePath + '/connections';
    let state = { uid, name: text(options.name || uid, 32), avatar: avatar(options.avatar), x: 0, y: 0, height: 0, zone: space, facing: 1, direction: 'front', moving: false, pose: 'idle', gesture: null, seatId: null };
    let destroyed = false, collectionRef = null, ownRef = null, connectedRef = null, offsetRef = null;
    let seatsRef = null, claimedSeat = null, seatShared = false, seatExpiresAt = 0, seatHook = null, seatQueue = Promise.resolve(), seatGeneration = 0;
    let readable = !sharedSpace, readBlocked = false, sharedBlocked = false;
    let observed = {}, offset = 0, network = null, registered = false, sequence = 0, statusSignature = '', rosterSignature = '', currentMode = 'local';
    let scheduleTimer = null, heartbeatTimer = null, expiryTimer = null, localGestureStamp = null;
    let writePending = false, writing = false, forcePending = false, lastWrite = -Infinity, generation = 0, disconnectHook = null, published = null;
    const now = () => Date.now() + offset;
    const report = (mode, message, error) => {
      if (destroyed) return;
      currentMode = mode;
      const status = { mode, connected: mode === 'connected', localOnly: mode === 'local', message };
      if (error) status.reason = text(error.code || error.message || error, 160);
      const signature = JSON.stringify(status);
      if (signature !== statusSignature) { statusSignature = signature; options.onStatus?.(status); }
    };
    function sanitizePosition(patch, previous = state) {
      const next = { ...previous };
      for (const [field, max] of [['x', maxX], ['y', maxY]]) {
        if (Object.prototype.hasOwnProperty.call(patch, field) && Number.isFinite(Number(patch[field]))) next[field] = Math.round(finite(patch[field], previous[field], 0, max) * 100) / 100;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'height') && Number.isFinite(Number(patch.height))) next.height = Math.round(finite(patch.height, previous.height, -128, 1024) * 100) / 100;
      if (typeof patch.zone === 'string' && ZONE.test(patch.zone) && (!sharedSpace || patch.zone === space)) next.zone = patch.zone;
      if (patch.facing === -1 || patch.facing === 1) next.facing = patch.facing;
      if (patch.facing === 'left' || patch.facing === 'right') next.facing = patch.facing === 'left' ? -1 : 1;
      if (typeof patch.direction === 'string' && DIRECTIONS.has(patch.direction)) next.direction = patch.direction;
      if (typeof patch.moving === 'boolean') next.moving = patch.moving;
      if (typeof patch.pose === 'string' && POSES.has(patch.pose)) next.pose = patch.pose;
      else if (typeof patch.moving === 'boolean') next.pose = patch.moving ? 'walk' : 'idle';
      if (Object.prototype.hasOwnProperty.call(patch, 'seatId')) {
        if (patch.seatId == null) next.seatId = null;
        else if (typeof patch.seatId === 'string' && SEAT.test(patch.seatId)) next.seatId = patch.seatId;
      }
      return next;
    }
    state = sanitizePosition(options.initialState && typeof options.initialState === 'object' ? options.initialState : {});
    // A restored camera/position may not silently claim a shared chair.
    state.seatId = null;
    if (state.pose === 'sit') state.pose = 'idle';
    function cleanGesture(value, at, received = false) {
      if (typeof value === 'string') value = { type: value };
      if (!value || typeof value !== 'object' || !GESTURES.has(value.type)) { if (!received) localGestureStamp = null; return null; }
      const duration = finite(value.duration, 2800, 400, 5000);
      const to = value.to ? text(value.to, 120) : null;
      let start = received ? Number(value.at) : at;
      if (!received && value.at != null && value.at !== '' && Number.isFinite(Number(value.at))) {
        const sourceAt = Number(value.at), signature = JSON.stringify([value.type, sourceAt, duration, to]);
        if (localGestureStamp?.signature === signature) start = localGestureStamp.at;
        else {
          start = sourceAt;
          // Current world controllers already use getTime(). Older callers
          // may supply device Date.now(); translate that known clock offset
          // only when the supplied time is outside a live server timeline.
          if (Math.abs(sourceAt - at) > 10000 && Math.abs(offset) > 10000 && sourceAt + offset + duration > at && sourceAt + offset <= at + 10000) start = sourceAt + offset;
          if (start + duration <= at) return null;
          start = start > at ? at : start;
          localGestureStamp = { signature, at: start };
        }
      } else if (!received) localGestureStamp = null;
      if (!Number.isFinite(start) || start > at + 10000 || start + duration <= at) return null;
      const gesture = { type: value.type, at: start, duration };
      if (to) gesture.to = to;
      return gesture;
    }
    function validRecord(record, id) {
      if (!record || typeof record !== 'object' || record.version !== VERSION || typeof record.uid !== 'string' || !record.uid || typeof record.zone !== 'string' || !ZONE.test(record.zone) || (sharedSpace && record.zone !== space)) return null;
      const at = now(), updatedAt = Number(record.updatedAt);
      if (!Number.isFinite(updatedAt) || updatedAt < at - TTL || updatedAt > at + 60000) return null;
      if (![record.x, record.y, record.height].every(v => typeof v === 'number' && Number.isFinite(v))) return null;
      if (record.x < 0 || record.x > maxX || record.y < 0 || record.y > maxY || record.height < -128 || record.height > 1024) return null;
      // Older version-1 clients have only facing. Moving left/right can use a
      // profile frame; an idle record defaults to the safe front painting.
      let direction = 'front';
      if (record.moving === true && (record.facing === -1 || record.facing === 'left')) direction = 'left';
      else if (record.moving === true && (record.facing === 1 || record.facing === 'right')) direction = 'right';
      return { ...sanitizePosition(record, { x: 0, y: 0, height: 0, zone: space, facing: 1, direction, moving: false, pose: 'idle', seatId: null }), uid: text(record.uid, 120), name: text(record.name || record.uid, 32), avatar: avatar(record.avatar), gesture: cleanGesture(record.gesture, at, true), updatedAt, sequence: finite(record.sequence, 0, 0, Number.MAX_SAFE_INTEGER), connectionId: id, self: record.uid === uid };
    }
    function emitPlayers() {
      if (destroyed) return;
      const players = new Map();
      for (const [id, record] of Object.entries(observed || {})) {
        const player = validRecord(record, id);
        if (!player) continue;
        const group = player.uid + '\u0000' + player.zone, previous = players.get(group);
        if (!previous || player.updatedAt > previous.updatedAt || (player.updatedAt === previous.updatedAt && player.connectionId > previous.connectionId)) players.set(group, player);
      }
      // The local player remains usable when the connection is interrupted.
      const group = uid + '\u0000' + state.zone;
      const own = { ...clone(state), gesture: cleanGesture(state.gesture, now(), true), updatedAt: now(), sequence, connectionId, self: true };
      const previous = players.get(group);
      if (!previous || previous.connectionId === connectionId || previous.updatedAt <= lastWrite) players.set(group, own);
      const roster = [...players.values()].sort((a, b) => a.uid.localeCompare(b.uid) || a.zone.localeCompare(b.zone));
      // Heartbeats do not rebuild unchanged avatar DOM or restart animation clocks.
      const signature = JSON.stringify(roster.map(p => ({ ...p, updatedAt: 0, sequence: 0 })));
      if (signature !== rosterSignature) { rosterSignature = signature; options.onPlayers?.(clone(roster)); }
    }
    async function flush() {
      if (destroyed || !ownRef || network !== true || !registered || !readable || sharedBlocked || !writePending || writing) return;
      if (scheduleTimer != null) { clearTimeout(scheduleTimer); scheduleTimer = null; }
      writing = true; writePending = false; forcePending = false;
      const updatedAt = now();
      const writeGeneration = generation;
      const record = { ...clone(state), version: VERSION, updatedAt, sequence: ++sequence };
      if (sharedSpace && !seatShared) { record.seatId = null; if (record.pose === 'sit') record.pose = 'idle'; }
      lastWrite = updatedAt;
      try {
        if (!published) await ownRef.set(record);
        else {
          // Movement broadcasts only changed fields, rather than the complete
          // outfit on every frame. An idle heartbeat is two small numbers.
          const patch = { updatedAt, sequence: record.sequence };
          for (const field of Object.keys(state)) if (JSON.stringify(record[field]) !== JSON.stringify(published[field])) patch[field] = record[field];
          await ownRef.update(patch);
        }
        published = writeGeneration === generation && network === true && readable && !sharedBlocked ? record : null;
        if (!destroyed && writeGeneration === generation && network === true && readable && !sharedBlocked) report('connected', '우리 반 친구들과 함께 있어요.');
      } catch (error) {
        if (sharedSpace) { sharedBlocked = true; registered = false; }
        report(network === false ? 'offline' : 'local', '연결을 기다리는 동안 혼자 둘러볼 수 있어요.', error);
      } finally {
        writing = false;
        if (!destroyed && writePending) schedule(forcePending);
      }
    }
    function schedule(force = false) {
      if (destroyed || !ownRef) return;
      writePending = true; forcePending = forcePending || force;
      if (network !== true || !registered || writing) return;
      const delay = forcePending ? 0 : Math.max(0, MOVE_INTERVAL - (now() - lastWrite));
      if (scheduleTimer != null) {
        if (delay) return;
        clearTimeout(scheduleTimer);
      }
      if (!delay) { scheduleTimer = null; void flush(); }
      else scheduleTimer = setTimeout(() => { scheduleTimer = null; void flush(); }, delay);
    }
    const onRecords = snapshot => {
      if (destroyed) return;
      const value = snapshot.val();
      readable = true; readBlocked = false;
      observed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      // Restore a server-cleared record at the next move/heartbeat. Do not
      // write synchronously here: server cleanup may precede .info/connected.
      if (published && !observed[connectionId]) published = null;
      emitPlayers();
    };
    const onReadError = error => { readable = false; readBlocked = true; registered = false; report('local', '친구 연결을 기다리고 있어요. 공간은 둘러볼 수 있어요.', error); };
    const onOffset = snapshot => {
      const value = snapshot.val();
      if (typeof value === 'number' && Number.isFinite(value)) offset = value;
    };
    async function registerConnection() {
      const current = ++generation;
      try {
        disconnectHook = ownRef.onDisconnect?.();
        if (disconnectHook?.remove) await disconnectHook.remove();
        if (!destroyed && current === generation && network === true && readable && !sharedBlocked) { registered = true; schedule(true); }
      } catch (error) {
        report('local', '친구 연결을 기다리고 있어요. 마을은 둘러볼 수 있어요.', error);
      }
    }
    const onConnected = snapshot => {
      if (destroyed) return;
      // The isolated local demo has no .info/connected value; only explicit
      // false indicates a dropped Firebase connection.
      const next = snapshot.val() !== false;
      if (next === network) return;
      network = next; registered = false; published = null;
      if (sharedSpace && claimedSeat) loseSeat(network ? 'reconnect' : 'offline');
      if (network) sharedBlocked = false;
      if (network) { report(readBlocked ? 'local' : 'connecting', readBlocked ? '친구 연결을 기다리고 있어요. 공간은 둘러볼 수 있어요.' : '우리 반 친구들을 만나고 있어요.'); if (!readBlocked) void registerConnection(); }
      else { ++generation; report('offline', '연결이 잠시 끊겼어요. 다시 연결되면 친구를 만나요.'); }
    };
    // Keep a loaded listener while a transaction is pending. A one-shot read
    // can lose its cache, causing Firebase to call the first updater with null.
    async function loadedTransaction(target, updater) {
      let listener;
      try {
        await new Promise((resolve, reject) => { listener = () => resolve(); target.on('value', listener, reject); });
        return await target.transaction(updater, undefined, false);
      } finally { if (listener) target.off('value', listener); }
    }
    const queueSeat = task => { const result = seatQueue.then(task, task); seatQueue = result.catch(() => undefined); return result; };
    function activeClaim(value, at = now()) {
      if (!value || value.version !== VERSION || typeof value.owner !== 'string') return null;
      const claim = value.claims?.[value.owner];
      if (!claim || claim.connectionId !== value.owner || typeof claim.uid !== 'string') return null;
      if (!Number.isFinite(claim.expiresAt) || claim.expiresAt <= at || claim.expiresAt > at + SEAT_TTL + 10000) return null;
      return claim;
    }
    function loseSeat(reason) {
      const oldSeat = claimedSeat;
      claimedSeat = null; seatShared = false; seatExpiresAt = 0; ++seatGeneration;
      state = { ...state, seatId: null, moving: false, pose: state.pose === 'sit' ? 'idle' : state.pose };
      if (oldSeat) options.onSeatLost?.({ seatId: oldSeat, reason });
      emitPlayers(); schedule(true);
    }
    async function removeOwnClaim(id, hook) {
      if (seatsRef && id) {
        // Server disconnect cleanup removes this unique connection's claim,
        // not the chair root: an expired owner must never delete a later owner.
        await seatsRef.child(id).child('claims/' + connectionId).remove();
      }
      await hook?.cancel?.();
    }
    async function releaseSeatInternal() {
      const id = claimedSeat, shared = seatShared, hook = seatHook;
      claimedSeat = null; seatShared = false; seatExpiresAt = 0; seatHook = null; ++seatGeneration;
      state = { ...state, seatId: null, pose: state.pose === 'sit' ? 'idle' : state.pose };
      if (!destroyed) { emitPlayers(); schedule(true); }
      if (shared && id) { try { await removeOwnClaim(id, hook); } catch (_) { /* Its lease still expires if removal cannot reach the server. */ } }
      else { try { await hook?.cancel?.(); } catch (_) {} }
    }
    function localSeat(id) {
      claimedSeat = id; seatShared = false;
      state = { ...state, seatId: id, moving: false, pose: 'sit' }; emitPlayers();
      return true;
    }
    async function claimSeatInternal(id) {
      if (destroyed || !sharedSpace || typeof id !== 'string' || !SEAT.test(id)) return false;
      if (claimedSeat === id) return true;
      await releaseSeatInternal();
      if (destroyed) return false;
      if (!seatsRef || network !== true || !registered || !readable || sharedBlocked || currentMode !== 'connected') return localSeat(id);
      const current = seatGeneration, netGeneration = generation, target = seatsRef.child(id);
      let hook;
      try {
        hook = target.child('claims/' + connectionId).onDisconnect?.();
        if (hook?.remove) await hook.remove();
        if (destroyed || current !== seatGeneration || netGeneration !== generation || network !== true) { await hook?.cancel?.(); return false; }
        const result = await loadedTransaction(target, value => {
          const held = activeClaim(value);
          if (held && held.connectionId !== connectionId) return undefined;
          return { version: VERSION, owner: connectionId, claims: { [connectionId]: { uid, connectionId, updatedAt: now(), expiresAt: now() + SEAT_TTL } } };
        });
        if (destroyed || current !== seatGeneration || netGeneration !== generation || network !== true) { if (result.committed) await removeOwnClaim(id, hook); else await hook?.cancel?.(); return false; }
        if (!result.committed || activeClaim(result.snapshot.val())?.connectionId !== connectionId) { await hook?.cancel?.(); return false; }
        claimedSeat = id; seatShared = true; seatExpiresAt = activeClaim(result.snapshot.val()).expiresAt; seatHook = hook;
        state = { ...state, seatId: id, moving: false, pose: 'sit' }; schedule(true); emitPlayers(); return true;
      } catch (error) {
        try { await hook?.cancel?.(); } catch (_) {}
        if (destroyed || netGeneration !== generation || network !== true) return false;
        sharedBlocked = true; registered = false;
        report('local', '친구 연결을 기다리는 동안 혼자 앉을 수 있어요.', error);
        return localSeat(id);
      }
    }
    async function renewSeat() {
      if (!seatShared || !claimedSeat || destroyed || network !== true || !readable || sharedBlocked) return;
      const id = claimedSeat, current = seatGeneration, netGeneration = generation;
      try {
        const result = await loadedTransaction(seatsRef.child(id), value => {
          if (activeClaim(value)?.connectionId !== connectionId) return undefined;
          return { ...value, claims: { ...value.claims, [connectionId]: { uid, connectionId, updatedAt: now(), expiresAt: now() + SEAT_TTL } } };
        });
        if (destroyed || current !== seatGeneration || netGeneration !== generation) return;
        if (!result.committed) loseSeat('expired');
        else seatExpiresAt = activeClaim(result.snapshot.val())?.expiresAt || 0;
      } catch (_) { if (!destroyed && current === seatGeneration && netGeneration === generation) loseSeat('lease-error'); }
    }
    const refresh = () => { if (!destroyed && (!globalThis.document || !document.hidden)) { schedule(true); emitPlayers(); if (sharedSpace) void queueSeat(renewSeat); } };
    try {
      if (!options.db || typeof options.db.ref !== 'function') throw new Error('마을 연결을 사용할 수 없어요.');
      collectionRef = options.db.ref(path);
      ownRef = collectionRef.child(connectionId);
      if (sharedSpace) seatsRef = options.db.ref(spacePath + '/seats');
      connectedRef = options.db.ref('.info/connected');
      offsetRef = options.db.ref('.info/serverTimeOffset');
      collectionRef.on('value', onRecords, onReadError);
      offsetRef.on('value', onOffset);
      connectedRef.on('value', onConnected, onReadError);
      report('connecting', '우리 반 친구들을 만나고 있어요.');
      heartbeatTimer = setInterval(() => { if (network === true && !registered && readable && !sharedBlocked) void registerConnection(); else schedule(true); if (sharedSpace) void queueSeat(renewSeat); }, HEARTBEAT);
    } catch (error) {
      collectionRef?.off?.('value', onRecords); offsetRef?.off?.('value', onOffset); connectedRef?.off?.('value', onConnected);
      collectionRef = ownRef = connectedRef = offsetRef = null;
      report('local', '지금은 혼자 마을을 둘러볼 수 있어요.', error);
    }
    expiryTimer = setInterval(() => { if (sharedSpace && seatShared && seatExpiresAt <= now()) loseSeat('expired'); else emitPlayers(); }, 1000);
    globalThis.addEventListener?.('pageshow', refresh);
    globalThis.document?.addEventListener('visibilitychange', refresh);
    emitPlayers();
    return {
      update(patch = {}) {
        if (destroyed || !patch || typeof patch !== 'object') return;
        const before = JSON.stringify(state);
        const next = sanitizePosition(patch);
        if (sharedSpace && next.seatId !== claimedSeat) next.seatId = claimedSeat;
        if (sharedSpace && next.pose === 'sit' && !claimedSeat) next.pose = 'idle';
        const hasGesture = Object.prototype.hasOwnProperty.call(patch, 'gesture');
        if (hasGesture) next.gesture = cleanGesture(patch.gesture, now());
        state = next;
        if (JSON.stringify(state) !== before) { schedule(hasGesture); emitPlayers(); }
      },
      setProfile(profile = {}) {
        if (destroyed) return;
        const next = { ...state };
        if (typeof profile.name === 'string') next.name = text(profile.name, 32) || uid;
        if (profile.avatar && typeof profile.avatar === 'object') next.avatar = avatar(profile.avatar);
        if (JSON.stringify(next) !== JSON.stringify(state)) { state = next; schedule(true); emitPlayers(); }
      },
      claimSeat(id) { return queueSeat(() => claimSeatInternal(id)); },
      releaseSeat(expectedId) {
        // A canceled asynchronous claim may finish after a newer click has
        // acquired another chair. Its cleanup must not release that new chair.
        return queueSeat(() => expectedId !== undefined && claimedSeat !== expectedId ? false : releaseSeatInternal());
      },
      getState() { return { ...clone(state), connectionId, path, seatShared, connected: currentMode === 'connected', mode: currentMode, destroyed }; },
      // Scene gesture expiry must use the same server-adjusted clock as the
      // transmitted gesture.at, even when classmates' device clocks differ.
      getTime() { return now(); },
      disconnect() {
        if (destroyed) return Promise.resolve();
        destroyed = true; ++generation;
        clearTimeout(scheduleTimer); clearInterval(heartbeatTimer); clearInterval(expiryTimer);
        globalThis.removeEventListener?.('pageshow', refresh);
        globalThis.document?.removeEventListener('visibilitychange', refresh);
        collectionRef?.off?.('value', onRecords); connectedRef?.off?.('value', onConnected); offsetRef?.off?.('value', onOffset);
        // A unique connection node ensures closing one tab leaves another tab
        // for the same student alive. Never delete another user's record.
        return queueSeat(releaseSeatInternal).then(() => ownRef?.remove()).then(() => disconnectHook?.cancel?.()).catch(() => undefined);
      }
    };
  }
  window.QPVillagePresence = Object.freeze({ connect, constants: Object.freeze({ version: VERSION, ttl: TTL, heartbeat: HEARTBEAT, moveInterval: MOVE_INTERVAL, seatTtl: SEAT_TTL }) });
})();
