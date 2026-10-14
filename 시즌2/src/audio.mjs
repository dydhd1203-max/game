/* Season 2 audio: no files, network, Season 1 globals, or shared save keys.
 * Porting baseline: S1 106, 89da73bebdb360592a80bbc9be76612be6734b70.
 * busIn: compressor makeup compensation, split buses, filtered room return.
 * voxOk / nodeEnd: audio-clock voice slots and disconnect-on-end ownership.
 * sfxAt: distance filtering + listener-relative stereo pan; sndGc: bounded cleanup.
 * bgmSwitch / bgmLoop: scene crossfade, short lookahead, discard missed notes.
 * sndPct / sndCurve: clamped percentage and perceptual volume curve.
 * Movement cues use S1 jump/hop and the final SND66 step/land overrides.
 * Melodies, arrangements, combat effects and expedition phase selection are new.
 */

const SAVE_KEY = 'zns2:sound';
const pct = (v, fallback) => Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : fallback;
const curve = v => (v / 100) ** 1.6;
const hz = note => 440 * 2 ** ((note - 69) / 12);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const SCENES = {
  lobby: {bpm:76, chords:[[50,57,61],[47,54,57],[43,50,54],[45,52,57]], melody:[74, null, 73, 69, 66, null, 69, null, 71, null, 69, 66, 64, null, 66, null], strength:0.8},
  village: {bpm:84, chords:[[50,57,61],[45,52,57],[47,54,57],[43,50,54]], melody:[66, 69, 74, null, 73, 69, 66, null, 67, 71, 74, 71, 69, null, 66, null, 66, 69, 73, 74, 76, null, 73, 69, 67, 66, 64, null, 62, null, 69, null], strength:1},
  forest: {bpm:94, chords:[[50,57,60],[43,50,59],[48,55,60],[45,52,60]], melody:[69, null, 72, 74, 77, null, 74, null, 72, null, 69, 67, 65, null, 69, null, 67, null, 72, 76, 74, null, 72, null, 69, 67, 64, null, 65, null, 62, null], strength:0.9},
  boss: {bpm:112, chords:[[38,45,50],[34,41,50],[36,43,48],[33,40,49]], melody:[62, null, 65, null, 69, 67, 65, null, 62, null, 65, 69, 70, null, 69, null, 60, null, 64, null, 67, 65, 64, null, 61, null, 64, 67, 69, null, 61, null], strength:0.95},
  victory: {bpm:88, chords:[[50,57,61],[43,50,54],[45,52,57],[50,57,61]], melody:[74, null, 73, 69, 74, null, 78, null, 76, null, 74, 73, 74, null, null, null], strength:1},
  defeat: {bpm:62, chords:[[47,54,57],[43,50,54],[45,52,57],[47,54,57]], melody:[66, null, null, null, 64, null, 62, null, 61, null, null, null, 59, null, null, null], strength:0.7}
};
const EVENT_GAP = {step:0.09, jump:0.025, hop:0.025, land:0.025, shoot:0.075, arrow:0.075, ice:0.11, shatter:0.10, hit:0.08, down:0.2, revive:0.15, build:0.15, pack:0.15, beacon:0.5, warn:0.15, charge:0.2, victory:1};
const PRIORITY = new Set(['warn', 'down', 'revive', 'beacon', 'victory']);

/** Optional dependencies support real OfflineAudioContext validation; normal use needs no arguments. */
export function createAudio(options = {}) {
  const doc = options.document === undefined ? globalThis.document : options.document;
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch {} }
  let volumes = {bgm:55, sfx:75};
  try {
    const saved = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
    if (saved && typeof saved === 'object') volumes = {bgm:pct(saved.bgm, 55), sfx:pct(saved.sfx, 75)};
  } catch {}
  let ctx = options.context || null, buses = null, noiseBuffer = null, softWave = null;
  let scene = 'lobby', paused = false, disposed = false, needsGesture = true;
  let tracks = [], serial = 0, stepSerial = 0, suspension = null, motionSample = null;
  const now = () => options.now ? options.now() : (ctx?.currentTime || 0);
  const voices = new Set(), graph = new Set(), drops = [], lastEvent = new Map(), seen = new Map();
  const slots = {sfx:new Float64Array(24), priority:new Float64Array(8), bgm:new Float64Array(24)};
  const counts = {made:0, ended:0, dropped:0, peakVoices:0, effects:0};
  const offline = () => typeof ctx?.startRendering === 'function';
  const active = () => !!buses && !disposed && !paused && !doc?.hidden && !needsGesture && (offline() || ctx.state === 'running');
  const keep = node => { graph.add(node); return node; };
  const disconnect = node => { if (!node) return; try { node.disconnect(); } catch {} graph.delete(node); };

  function busIn() {
    if (buses) return;
    const master = keep(ctx.createGain()), comp = keep(ctx.createDynamicsCompressor()), post = keep(ctx.createGain());
    master.gain.value = 0.85;
    comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.14;
    post.gain.value = 0.40; // S1 busIn: compensate Chromium's compressor makeup gain.
    master.connect(comp); comp.connect(post); post.connect(ctx.destination);
    const delay = keep(ctx.createDelay(0.5)), damp = keep(ctx.createBiquadFilter());
    const feedback = keep(ctx.createGain()), wet = keep(ctx.createGain());
    delay.delayTime.value = 0.173; damp.type = 'lowpass'; damp.frequency.value = 2200;
    feedback.gain.value = 0.22; wet.gain.value = 0.14;
    master.connect(delay); delay.connect(damp); damp.connect(feedback); feedback.connect(delay); damp.connect(wet); wet.connect(comp);
    const sfx = keep(ctx.createGain()), bgm = keep(ctx.createGain()), duck = keep(ctx.createGain());
    const hp = keep(ctx.createBiquadFilter()), lp = keep(ctx.createBiquadFilter());
    hp.type = 'highpass'; hp.frequency.value = 70; hp.Q.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
    sfx.connect(master); bgm.connect(duck); duck.connect(hp); hp.connect(lp); lp.connect(master);
    buses = {master, sfx, bgm, duck};
    applyVolume(true);
    // Rounded flute/reed partials, avoiding a bright square-wave game-loop timbre.
    softWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.20, 0.08, 0.025, 0.008]));
  }

  function applyVolume(immediate = false) {
    if (!buses) return;
    const t = now();
    for (const [node, value] of [[buses.sfx, curve(volumes.sfx)], [buses.bgm, curve(volumes.bgm) * 0.8]]) {
      if (immediate) node.gain.value = value;
      else node.gain.setTargetAtTime(value, t, 0.04);
    }
  }

  function voxOk(lane, t0, t1) {
    const row = slots[lane];
    for (let i = 0; i < row.length; i++) if (row[i] <= t0) { row[i] = t1; return i; }
    counts.dropped++; return -1;
  }

  // Adapted S1 nodeEnd: each source owns exactly its short-lived processing chain.
  function nodeEnd() {
    if (!voices.has(this)) return;
    voices.delete(this); counts.ended++;
    const row = slots[this._lane];
    if (row[this._slot] === this._end) row[this._slot] = 0;
    disconnect(this);
    for (const node of this._owned) disconnect(node);
    this._owned.length = 0; this.onended = null;
  }

  function ownVoice(source, nodes, lane, end, track, slot) {
    source._owned = nodes; source._lane = lane; source._end = end; source._track = track; source._slot = slot;
    source.onended = nodeEnd; voices.add(source);
    counts.made++; counts.peakVoices = Math.max(counts.peakVoices, voices.size);
  }

  function voice(frequency, t, duration, volume, destination, {lane = 'sfx', type = 'sine', attack = 0.008, release = 0.1, endFrequency = frequency, track = null} = {}) {
    const end = t + duration + release + 0.015;
    const slot = voxOk(lane, t, end);
    if (slot < 0) return;
    const source = ctx.createOscillator(), gain = ctx.createGain();
    if (type === 'wood') source.setPeriodicWave(softWave); else source.type = type;
    source.frequency.setValueAtTime(frequency, t);
    if (endFrequency !== frequency) source.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), t + duration);
    gain.gain.value = 0.0001;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume), t + Math.min(attack, duration * 0.5));
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.6), t + duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.01);
    source.connect(gain); gain.connect(destination);
    ownVoice(source, [gain], lane, end, track, slot); source.start(t); source.stop(end);
  }

  function sharedNoise() {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let seed = 0x71a52; // Shared deterministic buffer, never allocate noise during combat.
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    }
    return noiseBuffer;
  }

  function noise(t, duration, volume, cut, destination, lane = 'sfx', track = null) {
    const end = t + duration + 0.02;
    const slot = voxOk(lane, t, end);
    if (slot < 0) return;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = sharedNoise(); source.loop = true;
    filter.type = 'lowpass'; filter.frequency.value = cut; filter.Q.value = 0.6;
    gain.gain.value = 0.0001; gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.007, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.005);
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    ownVoice(source, [filter, gain], lane, end, track, slot); source.start(t, (serial++ % 13) * 0.031); source.stop(end);
  }

  // S1 tone/pluck/puff/nzl envelopes: the short keycap click and jump glide
  // must not inherit the longer combat/music release envelope above. They use
  // the same bounded SFX slots, shared noise buffer and node-end ownership.
  function movementTone(frequency, endFrequency, t, duration, type, volume, destination, plucked = false) {
    const end = t + duration + (plucked ? 0.02 : 0.03), lane = 'sfx';
    const slot = voxOk(lane, t, end);
    if (slot < 0) return;
    const source = ctx.createOscillator(), gain = ctx.createGain();
    source.type = type; source.frequency.setValueAtTime(frequency, t);
    if (endFrequency !== frequency) source.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), t + duration);
    gain.gain.value = 0.0001; gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t + (plucked ? 0.005 : 0.008));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(gain); gain.connect(destination);
    ownVoice(source, [gain], lane, end, null, slot); source.start(t); source.stop(end);
  }

  function movementNoise(t, duration, volume, frequency, q, destination, linear = false) {
    const end = t + duration + 0.02, lane = 'sfx', slot = voxOk(lane, t, end);
    if (slot < 0) return;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = sharedNoise(); source.loop = true;
    filter.type = linear ? 'lowpass' : 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
    gain.gain.value = 0.0001;
    gain.gain.setValueAtTime(linear ? volume : 0.0001, t);
    if (linear) gain.gain.linearRampToValueAtTime(0.0001, t + duration);
    else {
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    }
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    ownVoice(source, [filter, gain], lane, end, null, slot);
    source.start(t, (serial++ % 13) * 0.031); source.stop(end);
  }

  function stopVoice(source) { try { source.stop(); } catch {} nodeEnd.call(source); }
  function stopTrack(track) {
    for (const source of voices) if (source._track === track) stopVoice(source);
    disconnect(track.gain);
  }

  function clearSound() {
    for (const source of voices) stopVoice(source);
    for (const track of tracks) disconnect(track.gain);
    tracks = [];
    for (const drop of drops) for (const node of drop.nodes) disconnect(node);
    drops.length = 0;
    for (const row of Object.values(slots)) row.fill(0);
    lastEvent.clear();
    motionSample = null;
    if (buses) { buses.duck.gain.cancelScheduledValues(now()); buses.duck.gain.value = 1; }
  }

  function bgmSwitch(key, t) {
    if (tracks.at(-1)?.key === key && !tracks.at(-1).end) return;
    // At most one outgoing and one incoming score, including rapid room changes.
    while (tracks.length > 1) stopTrack(tracks.shift());
    for (const track of tracks) {
      const param = track.gain.gain;
      if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t); else param.cancelScheduledValues(t);
      param.linearRampToValueAtTime(0.0001, t + 0.8); track.end = t + 0.9;
    }
    const gain = keep(ctx.createGain()); gain.gain.value = 0.0001; gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.7); gain.connect(buses.bgm);
    tracks.push({key, gain, step:0, next:t + 0.035, end:0});
  }

  function musicStep(track, t) {
    const score = SCENES[track.key], step = track.step++, beat = 60 / score.bpm;
    if (!volumes.bgm) return; // Advance the score silently without allocating muted voices.
    const bar = Math.floor(step / 8), inBar = step % 8, chord = score.chords[bar % score.chords.length];
    const dest = track.gain, amp = score.strength;
    const note = (midi, length, volume, extra = {}) => voice(hz(midi), t, length, volume * amp, dest, {lane:'bgm', track, ...extra});
    if (inBar === 0) {
      for (const pitch of chord) note(pitch + 12, beat * 3.15, 0.026, {type:'wood', attack:0.24, release:beat * 0.8});
      note(chord[0] - 12, beat * 2.2, 0.075, {attack:0.09, release:0.3});
    }
    if (inBar % 2 === 0) note(chord[(inBar / 2 + bar) % 3] + 12, beat * 0.24, 0.060, {type:'triangle', release:beat * 0.5});
    const melody = score.melody[Math.floor(step / 2) % score.melody.length];
    if (inBar % 2 === 0 && melody !== null) note(melody, beat * 0.61, 0.052, {type:'wood', attack:0.055, release:beat * 0.28});
    if (track.key === 'forest' && inBar === 5) noise(t, 0.045, 0.025, 800, dest, 'bgm', track);
    if (track.key === 'boss') {
      if (inBar === 0 || inBar === 4) voice(90, t, 0.10, 0.12, dest, {lane:'bgm', track, endFrequency:43, release:0.08});
      if (inBar === 2 || inBar === 6) noise(t, 0.06, 0.055, 1300, dest, 'bgm', track);
      if (inBar % 2) note(chord[0], beat * 0.15, 0.04, {type:'triangle', release:0.1});
    }
  }

  function sndGc(t) {
    // Offline contexts render later: disconnecting a future-expired chain now
    // would erase it from the preview entirely. dispose() collects it afterwards.
    if (offline()) return;
    // S1 compaction pattern: bounded transient chains; no timers per effect.
    let write = 0;
    for (const drop of drops) {
      if (drop.at <= t) { for (const node of drop.nodes) disconnect(node); }
      else drops[write++] = drop;
    }
    drops.length = write;
    write = 0;
    for (const track of tracks) {
      if (track.end && track.end <= t) stopTrack(track);
      else tracks[write++] = track;
    }
    tracks.length = write;
  }

  function duck(t, priority) {
    const gain = buses.duck.gain;
    gain.cancelScheduledValues(t);
    gain.setTargetAtTime(priority ? 0.3 : 0.66, t, 0.015);
    gain.setTargetAtTime(1, t + (priority ? 0.5 : 0.12), 0.3);
  }

  function event(ev, listener = {x:0, z:0, yaw:0}) {
    if (!ev || !(ev.kind in EVENT_GAP) || disposed) return;
    if (ev.id !== undefined) {
      if (seen.has(ev.id)) return;
      seen.set(ev.id, true); if (seen.size > 160) seen.delete(seen.keys().next().value);
    }
    if (!active() || !volumes.sfx) return;
    const t = now(), kind = ev.kind, prior = PRIORITY.has(kind), lane = prior ? 'priority' : 'sfx';
    if (t - (lastEvent.get(kind) ?? -Infinity) < EVENT_GAP[kind]) return;
    const dx = (Number.isFinite(ev.x) ? ev.x : listener.x) - listener.x;
    const dz = (Number.isFinite(ev.z) ? ev.z : listener.z) - listener.z;
    const distance = Math.hypot(dx, dz), range = prior ? 70 : 30;
    if (distance > range || drops.length >= 64) return;
    if (!slots[lane].some(end => end <= t)) { counts.dropped++; return; }
    lastEvent.set(kind, t); counts.effects++;
    const q = distance / range, chain = [];
    const gain = ctx.createGain(); gain.gain.value = 1 - 0.8 * q; chain.push(gain);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 8000 * (1600 / 8000) ** q; filter.Q.value = 0.5; chain.push(filter);
    gain.connect(filter);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner(), yaw = listener.yaw || 0;
      pan.pan.value = clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / (distance || 1), -1, 1) * 0.7;
      filter.connect(pan); pan.connect(buses.sfx); chain.push(pan);
    } else filter.connect(buses.sfx);
    drops.push({nodes:chain, at:t + 2.5});
    const tone = (f, duration, volume, offset = 0, extra = {}) => voice(f, t + offset, duration, volume, gain, {lane, ...extra});
    const puff = (duration, volume, cut, offset = 0) => noise(t + offset, duration, volume, cut, gain, lane);
    if (prior || kind === 'shoot' || kind === 'shatter' || kind === 'charge') duck(t, prior);
    switch (kind) {
      case 'jump':
        movementTone(240, 640, t, 0.16, 'sine', 0.07, gain);
        movementNoise(t, 0.04, 0.06, 900, 1, gain); break;
      case 'hop':
        movementNoise(t, 0.035, 0.05, 2200, 0.7071, gain, true);
        movementTone(430, 700, t, 0.07, 'sine', 0.045, gain); break;
      case 'land':
        // The current S2 map has no swimmable S1 pond/stream collision.
        movementNoise(t, 0.055, 0.09, 600, 1, gain);
        movementTone(170, 170, t, 0.08, 'triangle', 0.045, gain, true); break;
      case 'step': {
        const g = clamp(Number.isFinite(ev.strength) ? ev.strength : 1, 0, 1) * 0.8;
        // S1's +/-6% pitch variation, with a repeatable local sequence.
        const d = 0.94 + (stepSerial++ * 0.61803398875 % 1) * 0.12;
        movementNoise(t, 0.006, 0.085 * g, 5400 * d, 2.2, gain);
        movementTone(1150 * d, 760 * d, t, 0.020, 'triangle', 0.038 * g, gain);
        movementTone(190 * d, 138 * d, t + 0.004, 0.055, 'sine', 0.075 * g, gain);
        movementNoise(t + 0.004, 0.030, 0.024 * g, 420 * d, 0.8, gain);
        if (ev.surface === 0) movementNoise(t + 0.006, 0.06, 0.030 * g, 3000 * d, 0.8, gain);
        else if (ev.surface === 1) movementNoise(t + 0.004, 0.05, 0.045 * g, 520 * d, 0.9, gain);
        else if (ev.surface === 2) {
          movementTone(1700 * d, 1700 * d, t + 0.003, 0.03, 'sine', 0.020 * g, gain, true);
          movementNoise(t + 0.003, 0.012, 0.035 * g, 3600 * d, 3, gain);
        } else if (ev.surface === 3) {
          movementTone(330 * d, 330 * d, t + 0.004, 0.07, 'triangle', 0.040 * g, gain, true);
          movementTone(660 * d, 660 * d, t + 0.004, 0.042, 'sine', 0.008 * g, gain, true);
        }
        break;
      }
      case 'shoot': case 'arrow':
        puff(0.045, 0.12, 1900); tone(310, 0.045, 0.07, 0, {endFrequency:155, type:'triangle', release:0.04}); break;
      case 'ice':
        tone(880, 0.10, 0.075, 0, {release:0.14}); tone(1320, 0.07, 0.025, 0.04, {release:0.12}); puff(0.12, 0.035, 3000); break;
      case 'shatter':
        puff(0.13, 0.18, 2800); tone(660, 0.11, 0.085, 0, {endFrequency:380, release:0.06}); tone(1180, 0.055, 0.04, 0.025); break;
      case 'hit':
        tone(140, 0.055, 0.12, 0, {endFrequency:72, release:0.04}); puff(0.04, 0.05, 900); break;
      case 'down':
        tone(392, 0.15, 0.08, 0, {type:'wood'}); tone(294, 0.23, 0.085, 0.18, {type:'wood'}); break;
      case 'revive':
        [62, 66, 69].forEach((n, i) => tone(hz(n), 0.17, 0.085, i * 0.12, {type:'wood', release:0.15})); break;
      case 'build':
        puff(0.065, 0.09, 1200); tone(460, 0.075, 0.08, 0.05, {type:'triangle'}); tone(690, 0.12, 0.065, 0.15); break;
      case 'pack':
        puff(0.14, 0.075, 950); tone(330, 0.09, 0.065, 0.12, {endFrequency:220, type:'triangle'}); break;
      case 'beacon':
        [62, 69, 74, 78].forEach((n, i) => tone(hz(n), 0.25, 0.08, i * 0.13, {type:'wood', release:0.2})); break;
      case 'warn':
        // Keep the two-note warning readable; the boar snorts and scrapes twice
        // inside the 1.5-second telegraph. Five bounded voices, no hoof timer.
        tone(294, 0.16, 0.15, 0, {type:'wood', release:0.09}); tone(440, 0.20, 0.14, 0.26, {type:'wood', release:0.09});
        puff(0.20, 0.12, 900); puff(0.14, 0.08, 1550, 0.44); puff(0.17, 0.07, 1200, 0.70); break;
      case 'charge':
        // One charge event owns the rumble and two hoof impacts. Rendering the
        // running animation never allocates audio nodes or restarts this cue.
        puff(0.38, 0.20, 850); tone(95, 0.30, 0.12, 0, {endFrequency:48, release:0.15});
        puff(0.055, 0.10, 1100, 0.07); puff(0.060, 0.085, 900, 0.24); break;
      case 'victory':
        [62, 66, 69, 74, 78].forEach((n, i) => tone(hz(n), 0.34, 0.095, i * 0.15, {type:'wood', release:0.24})); break;
    }
  }

  /** Local footsteps only: S1 plays once per complete travelled gait cycle.
   * No event/network traffic, timers, remote-player loops or catch-up bursts.
   * Surface may be supplied by a map; absent data keeps the original keycap.
   */
  function motion(player, dt, {phase = scene, paused: isPaused = paused, surface} = {}) {
    if (!active() || isPaused || phase === 'lobby' || !player || player.down || player.hp <= 0 ||
        !player.ground || !Number.isFinite(player.gp) || !Number.isFinite(dt) || dt <= 0 || dt > 0.1) {
      motionSample = null; return;
    }
    const prior = motionSample;
    if (!prior) { motionSample = {id:player.id, phase, x:player.x, z:player.z, gp:player.gp}; return; }
    const distance = Math.hypot(player.x - prior.x, player.z - prior.z);
    const crossed = Math.floor(player.gp / (Math.PI * 2)) !== Math.floor(prior.gp / (Math.PI * 2));
    const continuous = prior.id === player.id && prior.phase === phase && distance > 0.001 && distance < 1.5 &&
      player.gp >= prior.gp && player.gp - prior.gp < Math.PI;
    prior.id = player.id; prior.phase = phase; prior.x = player.x; prior.z = player.z; prior.gp = player.gp;
    if (continuous && crossed) event({kind:'step', x:player.x, z:player.z, strength:player.run ? 1 : 0.55, surface}, player);
  }

  async function unlock() {
    if (disposed || paused || doc?.hidden) return false;
    try {
      if (!ctx) {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        ctx = new AudioContextClass({latencyHint:'interactive'});
      }
      busIn();
      if (suspension) await suspension;
      if (disposed || paused || doc?.hidden) return false;
      if (!offline() && ctx.state === 'suspended') await ctx.resume();
      if (disposed) return false;
      needsGesture = !offline() && ctx.state !== 'running';
      if (!needsGesture && !tracks.length) bgmSwitch(scene, now());
      return !needsGesture;
    } catch { return false; }
  }

  function suspend() {
    needsGesture = true; clearSound();
    if (ctx && !offline() && ctx.state === 'running') {
      const pending = ctx.suspend().catch(() => {});
      suspension = pending;
      void pending.then(() => { if (suspension === pending) suspension = null; });
    }
  }
  function onVisibility() { if (doc?.hidden) suspend(); }
  function onGesture() { if (ctx && needsGesture && !paused && !doc?.hidden) void unlock(); }
  doc?.addEventListener('visibilitychange', onVisibility);
  doc?.addEventListener('pointerdown', onGesture);
  doc?.addEventListener('keydown', onGesture);

  function setScene(phase, isPaused = false) {
    if (disposed) return;
    scene = SCENES[phase] ? phase : 'lobby';
    const wasPaused = paused; paused = !!isPaused;
    if (paused && !wasPaused) suspend();
    if (!paused && wasPaused && globalThis.navigator?.userActivation?.isActive) void unlock();
    if (active()) bgmSwitch(scene, now());
  }

  function update() {
    if (!active()) return;
    const t = now(); sndGc(t);
    for (const track of tracks) {
      if (track.end) continue;
      if (track.next < t - 0.25) track.next = t + 0.035; // Never replay a hidden/stalled tab's backlog.
      let iterations = 0;
      while (track.next < t + 0.12 && iterations++ < 4) {
        musicStep(track, track.next); track.next += 30 / SCENES[track.key].bpm;
      }
    }
  }

  function setVolume(kind, value) {
    if (disposed || (kind !== 'bgm' && kind !== 'sfx')) return;
    volumes[kind] = pct(value, volumes[kind]);
    try { storage?.setItem(SAVE_KEY, JSON.stringify(volumes)); } catch {}
    applyVolume();
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    doc?.removeEventListener('visibilitychange', onVisibility);
    doc?.removeEventListener('pointerdown', onGesture);
    doc?.removeEventListener('keydown', onGesture);
    clearSound(); seen.clear();
    for (const node of graph) disconnect(node);
    noiseBuffer = null; softWave = null; buses = null;
    if (ctx && !options.context && ctx.state !== 'closed') { try { await ctx.close(); } catch {} }
  }

  return {unlock, setScene, event, motion, setVolume, getVolumes:() => ({...volumes}), update, dispose,
    stats:() => ({...counts, voices:voices.size, tracks:tracks.length, cleanupChains:drops.length, graphNodes:graph.size, needsGesture, state:ctx?.state || 'locked'})};
}

/** Render the identical music/effect graph for a short, inspectable preview (not used by the game). */
export async function renderAudioPreview({phase = 'village', seconds = 8, sampleRate = 44100, effects = true} = {}) {
  const Context = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Context) throw new Error('OfflineAudioContext is unavailable');
  seconds = clamp(Number(seconds) || 8, 1, 30);
  const context = new Context(2, Math.ceil(seconds * sampleRate), sampleRate);
  let clock = 0;
  const audio = createAudio({context, now:() => clock, document:null, storage:null});
  audio.setScene(phase); await audio.unlock();
  const examples = phase === 'boss' ? ['warn', 'charge', 'shatter', 'victory'] : ['build', 'ice', 'shatter', 'beacon'];
  let cue = 0;
  for (clock = 0; clock < seconds; clock += 0.04) {
    audio.update(0.04);
    if (effects && cue < examples.length && clock >= 1 + cue * 1.6) {
      audio.event({id:cue, kind:examples[cue], x:cue % 2 ? 4 : -4, z:-3}, {x:0, z:0, yaw:0}); cue++;
    }
  }
  const buffer = await context.startRendering();
  const stats = audio.stats(); await audio.dispose();
  return {buffer, stats};
}
