// Native Web Audio validation and reproducible 8-second score samples.
// Run: node 시즌2/tests/audio.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = process.env.S2_AUDIO_ARTIFACT_DIR || '/tmp/s2-audio-validation';
const source = await fs.readFile(path.join(root, 'src/audio.mjs'));
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/audio.mjs' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/audio.mjs' ? source : '<!doctype html><button>소리 켜기</button>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_BIN || '/usr/bin/chromium', args:['--no-sandbox', '--autoplay-policy=no-user-gesture-required']});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await fs.mkdir(artifact, {recursive:true});
  const metrics = [];
  for (const phase of ['village', 'forest', 'boss']) {
    const rendered = await page.evaluate(async phase => {
      const {renderAudioPreview} = await import('/audio.mjs');
      const {buffer, stats} = await renderAudioPreview({phase, seconds:8});
      const n = buffer.length, data = new Uint8Array(44 + n * 4), view = new DataView(data.buffer);
      const str = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
      str(0, 'RIFF'); view.setUint32(4, data.length - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
      view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 4, true);
      view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, n * 4, true);
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let peak = 0, sum = 0, clipped = 0, nonzero = 0, stereo = 0;
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < 2; c++) {
          const v = c ? right[i] : left[i]; peak = Math.max(peak, Math.abs(v)); sum += v * v;
          if (Math.abs(v) >= 0.999) clipped++; if (Math.abs(v) > 0.00001) nonzero++;
          view.setInt16(44 + (i * 2 + c) * 2, Math.round(Math.max(-1, Math.min(1, v)) * 32767), true);
        }
        stereo += Math.abs(left[i] - right[i]);
      }
      let binary = '';
      for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
      return {base64:btoa(binary), metrics:{phase, seconds:n / buffer.sampleRate, sampleRate:buffer.sampleRate, peak, rms:Math.sqrt(sum / (n * 2)), clipped, nonzero, stereo:stereo / n, stats}};
    }, phase);
    assert.equal(rendered.metrics.seconds, 8);
    assert.equal(rendered.metrics.clipped, 0, `${phase}: no sample clipping`);
    assert(rendered.metrics.peak > 0.03 && rendered.metrics.peak < 0.8, `${phase}: useful output headroom`);
    assert(rendered.metrics.rms > 0.008, `${phase}: audible score`);
    assert(rendered.metrics.stereo > 0.0001, `${phase}: spatial sound reaches left/right`);
    await fs.writeFile(path.join(artifact, `${phase}.wav`), Buffer.from(rendered.base64, 'base64'));
    metrics.push(rendered.metrics);
  }

  const behavior = await page.evaluate(async () => {
    const {createAudio} = await import('/audio.mjs');
    const saved = new Map([['sndBgm', '9']]);
    const storage = {getItem:key => saved.get(key) ?? null, setItem:(key, value) => saved.set(key, value)};
    const ctx = new AudioContext();
    let clock = ctx.currentTime;
    const audio = createAudio({context:ctx, now:() => clock, document:null, storage});
    await audio.unlock();
    audio.setVolume('bgm', 0);
    const beforeMute = audio.stats().made; audio.update(); const afterMute = audio.stats().made;
    audio.setVolume('bgm', 150); audio.setVolume('sfx', -10);
    const clippedVolumes = audio.getVolumes();
    audio.setVolume('sfx', 75); audio.setVolume('bad', 99);
    audio.setScene('village'); audio.update();
    audio.event({id:'same', kind:'warn', x:0, z:0});
    const once = audio.stats().made;
    audio.event({id:'same', kind:'warn', x:0, z:0});
    const twice = audio.stats().made;
    const floodKinds = ['shoot','arrow','ice','hit','shatter','step','jump','hop','land'];
    for (let i = 0; i < 150; i++) {
      audio.event({id:`flood${i}`, kind:floodKinds[i % floodKinds.length], x:0, z:0});
    }
    const flood = audio.stats();
    for (const phase of ['forest', 'boss', 'village', 'forest', 'boss']) { audio.setScene(phase); audio.update(); }
    const switching = audio.stats();
    audio.setScene('boss', true);
    const paused = audio.stats();
    audio.event({id:'paused', kind:'hit'});
    const pausedMade = audio.stats().made;
    clock += 60;
    audio.setScene('village', false); await audio.unlock(); audio.update();
    const resumed = audio.stats();
    const beforeDispose = audio.stats().made;
    await audio.dispose();
    audio.event({id:'after', kind:'victory'}); audio.update();
    const disposed = audio.stats();
    await ctx.close();
    const readback = createAudio({storage, document:null});
    const storedVolumes = readback.getVolumes(); await readback.dispose();
    return {beforeMute, afterMute, clippedVolumes, once, twice, flood, switching, paused, pausedMade, resumed, beforeDispose, disposed, storedVolumes, keys:[...saved.keys()], oldVolume:saved.get('sndBgm')};
  });
  assert.deepEqual(behavior.clippedVolumes, {bgm:100, sfx:0});
  assert.deepEqual(behavior.storedVolumes, {bgm:100, sfx:75});
  assert.deepEqual(behavior.keys.sort(), ['sndBgm', 'zns2:sound']);
  assert.equal(behavior.oldVolume, '9');
  assert.equal(behavior.beforeMute, behavior.afterMute, 'muted music allocates no voices');
  assert.equal(behavior.once, behavior.twice, 'network event duplicate is silent');
  assert(behavior.flood.voices <= 56, 'simultaneous voices bounded');
  assert(behavior.flood.effects <= 10, 'same-type combat and movement flood coalesced');
  assert(behavior.switching.tracks <= 2, 'crossfade has only two scene buses');
  assert.equal(behavior.paused.voices, 0); assert.equal(behavior.paused.tracks, 0);
  assert.equal(behavior.paused.cleanupChains, 0);
  assert.equal(behavior.pausedMade, behavior.paused.made, 'paused input not queued');
  assert(behavior.resumed.made - behavior.pausedMade <= 10, '60-second stall does not replay backlog');
  assert.equal(behavior.disposed.voices, 0); assert.equal(behavior.disposed.graphNodes, 0);
  assert.equal(behavior.disposed.cleanupChains, 0);
  assert.equal(behavior.disposed.made, behavior.beforeDispose, 'disposed engine stays silent');

  const boar = await page.evaluate(async () => {
    const {createAudio} = await import('/audio.mjs');
    const ctx = new OfflineAudioContext(2, 44100 * 4, 44100);
    let clock = 0;
    const audio = createAudio({context:ctx, now:() => clock, document:null, storage:null});
    audio.setVolume('bgm', 0); audio.setVolume('sfx', 100);
    await audio.unlock();
    clock = 0.2;
    audio.event({id:'boar-warn', kind:'warn', x:0, z:0});
    const warning = audio.stats().made;
    for (let i = 0; i < 21; i++) audio.event({id:'boar-warn', kind:'warn', x:0, z:0});
    const duplicate = audio.stats().made;
    clock = 1.7;
    audio.event({id:'boar-charge', kind:'charge', x:0, z:0});
    const charge = audio.stats().made - warning;
    const buffer = await ctx.startRendering();
    let peak = 0, clipped = 0, tailPeak = 0, warningEnergy = 0, chargeEnergy = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const value = Math.abs(data[i]);
        peak = Math.max(peak, value); if (value >= 0.999) clipped++;
        if (i >= 44100 * 3) tailPeak = Math.max(tailPeak, value);
        if (i >= 44100 * 0.2 && i < 44100 * 1.2) warningEnergy += value * value;
        if (i >= 44100 * 1.7 && i < 44100 * 2.7) chargeEnergy += value * value;
      }
    }
    const rendered = audio.stats();
    await audio.dispose();
    return {warning, duplicate, charge, peak, clipped, tailPeak, warningEnergy, chargeEnergy, rendered, disposed:audio.stats()};
  });
  assert(boar.warning <= 5 && boar.charge <= 4, 'boar cues stay within their voice budgets');
  assert.equal(boar.warning, boar.duplicate, '21 copies of a warning do not schedule extra hoof sounds');
  assert(boar.warningEnergy > 0.1 && boar.chargeEnergy > 0.1, 'both actual cues render audible samples');
  assert(boar.peak > 0.03 && boar.peak < 0.8, 'full-volume boar cues retain output headroom');
  assert.equal(boar.clipped, 0, 'full-volume boar cues do not clip');
  assert(boar.tailPeak < 0.0001, 'charge and room return finish without a looping hoof or rumble');
  assert.equal(boar.rendered.voices, 0, 'every scheduled boar source releases on end');
  assert.equal(boar.disposed.cleanupChains, 0); assert.equal(boar.disposed.graphNodes, 0);

  const movement = await page.evaluate(async () => {
    const {createAudio} = await import('/audio.mjs');
    const ctx = new OfflineAudioContext(2, 44100 * 4, 44100);
    let clock = 0;
    const audio = createAudio({context:ctx, now:() => clock, document:null, storage:null});
    audio.setVolume('bgm', 0); audio.setVolume('sfx', 100); await audio.unlock();
    const cues = [
      {kind:'step', strength:0.55, at:0.1}, {kind:'step', strength:1, at:0.6},
      {kind:'jump', at:1.1}, {kind:'hop', at:1.5}, {kind:'land', at:1.9}
    ];
    const voices = [], duplicates = [];
    for (const [index, cue] of cues.entries()) {
      clock = cue.at;
      const before = audio.stats().made;
      const ev = {...cue, id:`motion-${index}`, x:0, z:0};
      audio.event(ev); voices.push(audio.stats().made - before);
      for (let i = 0; i < 21; i++) audio.event(ev);
      duplicates.push(audio.stats().made - before);
    }
    const buffer = await ctx.startRendering(), n = buffer.length;
    const bytes = new Uint8Array(44 + n * 4), view = new DataView(bytes.buffer);
    const str = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    str(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 4, true);
    view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, n * 4, true);
    let peak = 0, clipped = 0, tailPeak = 0;
    const energy = cues.map(() => 0);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < n; i++) {
        const value = data[i], magnitude = Math.abs(value), seconds = i / buffer.sampleRate;
        peak = Math.max(peak, magnitude); if (magnitude >= 0.999) clipped++;
        if (seconds >= 3) tailPeak = Math.max(tailPeak, magnitude);
        for (let c = 0; c < cues.length; c++) if (seconds >= cues[c].at && seconds < cues[c].at + 0.3) energy[c] += value * value;
        view.setInt16(44 + (i * 2 + channel) * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
      }
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const rendered = audio.stats(); await audio.dispose();
    return {base64:btoa(binary), cues, voices, duplicates, peak, clipped, tailPeak, energy, rendered, disposed:audio.stats()};
  });
  assert.deepEqual(movement.voices, [4, 4, 2, 2, 2], 'movement cues use the bounded original S1 layers');
  assert.deepEqual(movement.duplicates, movement.voices, '21 repeated movement packets do not replay sounds');
  assert(movement.energy.every(value => value > 0.01), 'walk, run, jump, double jump and landing all render');
  assert(movement.energy[1] > movement.energy[0] * 1.4, 'sprinting has a stronger footstep than walking');
  assert(movement.peak > 0.01 && movement.peak < 0.8, 'movement cues retain output headroom at full volume');
  assert.equal(movement.clipped, 0); assert(movement.tailPeak < 0.0001, 'movement sounds and room return finish');
  assert.equal(movement.rendered.voices, 0); assert.equal(movement.disposed.graphNodes, 0);
  await fs.writeFile(path.join(artifact, 'movement.wav'), Buffer.from(movement.base64, 'base64'));
  delete movement.base64;

  const gait = await page.evaluate(async () => {
    const {createAudio} = await import('/audio.mjs');
    const ctx = new AudioContext();
    let clock = ctx.currentTime;
    const audio = createAudio({context:ctx, now:() => clock, document:null, storage:null});
    audio.setVolume('bgm', 0); await audio.unlock();
    const p = {id:'local', x:0, z:0, gp:6.2, ground:true, down:false, hp:100, run:false};
    const opts = {phase:'village'}, sample = () => audio.motion(p, 1/60, opts), made = () => audio.stats().made;
    sample(); const initial = made();
    p.x += 0.1; p.gp = 6.4; sample(); const crossing = made();
    for (let i = 0; i < 21; i++) sample(); const standing = made();
    p.x += 0.1; p.gp = 12.5; sample(); clock += 0.3;
    p.x += 0.1; p.gp = 12.7; p.ground = false; sample(); const airborne = made();
    p.ground = true; sample(); p.down = true; p.x += 0.1; p.gp = 19; sample(); const down = made();
    p.down = false; sample(); p.x += 50; p.gp = 25.2; sample(); const teleport = made();
    audio.motion(p, 1/60, {...opts, paused:true}); p.x += 0.1; p.gp = 31.5; sample(); const pausedBacklog = made();
    clock += 0.3; audio.setVolume('sfx', 0);
    p.gp = 37.6; sample(); p.gp = 37.8; p.x += 0.1; sample(); const muted = made();
    audio.setVolume('sfx', 75); clock += 0.3;
    p.gp = 43.9; sample(); p.gp = 44.1; p.x += 0.1; sample(); const resumed = made();
    // A real muted/pause transition must also stop and disconnect active cues.
    audio.setScene('village', true); const paused = audio.stats();
    for (const kind of ['step', 'jump', 'hop', 'land']) audio.event({kind});
    const afterPause = made();
    await audio.dispose(); await ctx.close();
    return {initial, crossing, standing, airborne, down, teleport, pausedBacklog, muted, resumed, paused, afterPause, disposed:audio.stats()};
  });
  assert.equal(gait.initial, 0); assert.equal(gait.crossing, 4, 'one full gait crossing emits one local keycap');
  for (const key of ['standing','airborne','down','teleport','pausedBacklog','muted']) assert.equal(gait[key], 4, `${key} does not emit footsteps`);
  assert.equal(gait.resumed, 8, 'a later valid crossing resumes with one sound, without backlog');
  assert.equal(gait.paused.voices, 0); assert.equal(gait.paused.cleanupChains, 0);
  assert.equal(gait.afterPause, gait.paused.made); assert.equal(gait.disposed.graphNodes, 0);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(artifact, 'metrics.json'), JSON.stringify({metrics, behavior, boar, movement, gait}, null, 2));
  console.log(JSON.stringify({ok:true, artifacts:artifact, samples:metrics.map(({phase, peak, rms, clipped}) => ({phase, peak, rms, clipped})), boar:{warningVoices:boar.warning, chargeVoices:boar.charge, peak:boar.peak, tailPeak:boar.tailPeak}, movement:{voices:movement.voices, peak:movement.peak, tailPeak:movement.tailPeak}, checks:'native Web Audio rendering, stereo, clipping, volume isolation, event dedup, flood caps, crossfade, pause/resume backlog, disposal, boar cue timing, S1 movement cues and local gait cadence'}, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
