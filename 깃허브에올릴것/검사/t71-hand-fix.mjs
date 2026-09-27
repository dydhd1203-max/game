/* 71차 — 총 다루기 손 고치기 동적 검사(한 브라우저 · 시계 얼림 · 프레임을 한 장씩 민다).
   node t71-hand-fix.mjs [game.html] [port]
   ① 새총: 쏜 뒤 0~0.75초 매 프레임, 오른손(C 손 상자 여덟 꼭짓점의 화면 네모)·팔뚝 가운데 줄이 조준점 ±0.06 NDC 네모에 들어오지 않는다
   ② 강궁: 쏜 뒤 0~0.62초 매 프레임, 오른손이 화면 안이면 카메라에서 0.2 넘게 떨어져 있고 팔뚝 손목 쪽 끝도 카메라 앞(화면 둘레 1.6 안)이다(팔 없는 큰 손 금지)
   ③ 장전 손잡이(LB>0.95 — 당기는 동안): 왼손 C 중심이 손잡이 상자에서 0.06 넘게(= 손 반지름 0.1 의 0.6 — 꼭지가 C 입에 걸리고 기관부는 손 밖) 떨어져 있고, C 구멍 축이 총 축(z)과 직각에 가깝다(|축·z| < 0.5) — 연발총·금 연발총·은빛 카빈
   ④ 관 탄창·옆 장전구: 넣기 박자(p .5·.58)에 탄 조각을 숨기면 화면 화소가 바뀐다(= 탄이 보인다) — 산탄총 셋·목장 장총
   ⑤ 목장 장총 지렛대: 쏜 뒤 지렛대가 내려간 동안 오른손이 지렛대와 같이 핀을 축으로 돈 자리에서 0.02 안(예전엔 0.15 넘게 벌어짐)
   ⑥ 재장전 굴림(|ROL| > 15°) 동안 오른 팔뚝의 화면 방향이 쉬는 자세 방향과 20° 안(오른쪽 아래) — 산탄총·기관총·카빈
   ⑦ 소총 노리쇠를 쥔 손(RA>0.5): C 구멍 축과 시선이 이루는 |cos| < 0.5 · 주먹 0.8배 · 클립은 C 입 밖(손 중심에서 0.1 넘게)
   ⑧ 3인칭 새총·강궁: 쏜 뒤 박자에 오른손이 허리(rw)·걸기(rn)로 가고 돌·화살을 숨긴다(끝나면 0)
   ⑨ 터치 🔫(공격 모드 없음·gunT 0·빈 탄창·버튼 누름): 재장전이 한 번(RL.n +1) 시작해 rl + 0.3초 안에 탄창이 차고 다음 발이 나간다 */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const args = process.argv.slice(2), file = args.find(a=>!a.startsWith('--') && !/^\d+$/.test(a)) || GAME, PORT = +(args.find(a=>/^\d+$/.test(a)) || 20479);
const srv = serve(PORT, file);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1000, height:640}});
const errs = []; pg.on('pageerror', e=>errs.push(e.message));
let pass = 0, fail = 0;
const ok = (n, c, info)=>{ if(c) pass++; else fail++; console.log((c ? '✓ ' : '✗ ') + n + (info !== undefined ? '  — ' + JSON.stringify(info) : '')); };
await pg.addInitScript(()=>{ const real = performance.now.bind(performance); let fz = null;
  window.__clk = { freeze(){ fz = real(); window.__rafHold = true; }, adv(ms){ fz += ms; } };
  performance.now = ()=> fz === null ? real() : fz;
  const realRAF = window.requestAnimationFrame.bind(window); window.__raf = []; window.__rafHold = false;
  window.requestAnimationFrame = cb=>{ if(window.__rafHold){ window.__raf.push(cb); return 0; } return realRAF(cb); };
  window.__stepFrame = ()=>{ const q = window.__raf; window.__raf = []; for(const cb of q) cb(performance.now()); };
  try { localStorage.setItem('sndOn', '0'); } catch(e){} });
try {
await pg.route(/fonts\.(googleapis|gstatic)\.com/, r=>r.abort());
await pg.goto(`http://127.0.0.1:${PORT}/?gfx=low`, {waitUntil:'load', timeout:240000});
await pg.waitForFunction('window.__READY===true', null, {timeout:300000});
await pg.evaluate(()=>{ document.getElementById('iName').value = '검사'; document.getElementById('bSolo').click(); });
await pg.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:240000});
await pg.waitForTimeout(800);
await pg.evaluate(()=>{ const W = window; document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); W.__introDone && W.__introDone(); W.__clk.freeze(); W.__DBG().noRender = true; });   // 프레임은 논리만 민다(그림은 ④에서 그 순간만 drawFrame) — 소프트웨어 렌더링이 느려서
const step = n=>pg.evaluate(n=>{ for(let i=0;i<n;i++){ window.__clk.adv(1000/60); window.__stepFrame(); } }, n);
/* 자리 잡기 — 낮·평지·조준(1인칭) */
const setup = w=>pg.evaluate(w=>{ const W = window, P = W.__PL, G = W.__G;
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); G.phase = 'day'; G.mini = null; G.players.clear(); G.wolves = [];
  let spot = W.__t71spot || null;
  if(!spot) outer: for(let z = 30; z >= -30; z -= 3) for(let x = -24; x <= 24; x += 3){ if(Math.hypot(x, z) < 12) continue;
    const y = W.__groundUnder(x, z, P.R); if(y < 0 || y > 80) continue;
    if([[0,0],[2,0],[-2,0],[0,-4],[0,4],[3,3],[-3,3]].every(([dx, dz])=> Math.abs(W.__groundUnder(x + dx, z + dz, P.R) - y) < .01)){ spot = {x, z, y}; break outer; } }
  W.__t71spot = spot; Object.assign(P, spot, {vy:0, ground:true, yaw:0.3, pitch:-.05, landT:0, jumps:0});
  const K = W.__KIT; K.ownW[w] = true; K.ammo = 999; W.__setAim(false, true); W.__equipW(w); K.mag.length = 0; W.__setAim(true, true); W.__camZoom(0); W.__setThrow(false); }, w);
/* 쏘기 · 재장전 시작(빈 탄창 한 발 전) */
const fire = w=>pg.evaluate(w=>{ const W = window; W.__KIT.mag.length = 0; W.__setThrowCd(0); W.__fireWeapon(); }, w);
const reload = w=>pg.evaluate(w=>{ const W = window; W.__KIT.mag[w] = 1; W.__setThrowCd(0); W.__fireWeapon(); return {c:W.__wpnShotCd(W.__WEAPONS[w]), rl:W.__WEAPONS[w].rl}; }, w);
/* 이번 프레임 손 측정(카메라 공간 · NDC) */
const measure = ()=>pg.evaluate(()=>{ const W = window, T = W.__THREE, cam = W.__cam, i = W.__KIT.wpn, g = W.__gunModels()[i], R = W.__heldRig(i), HP = W.__HP, C = W.__CHI;
  cam.updateMatrixWorld(true); W.__held.updateMatrixWorld(true);
  const cs = (o, v)=>{ const p = (v ? v.clone() : new T.Vector3()); o.localToWorld(p); return cam.worldToLocal(p); };
  const ndc = p=>{ const q = p.clone().applyMatrix4(cam.projectionMatrix); return [q.x, q.y]; };   // 카메라 공간 → NDC(투영 행렬은 w 로 나눈다)
  const out = {HP:{LB:HP[C.LB], RA:HP[C.RA], PX:HP[C.PX], LEV:HP[C.LEV], ROL:HP[C.ROL], AUX:HP[C.AUX]}};
  const hk = R.hr.children[0]; hk.geometry.computeBoundingBox(); const bb = hk.geometry.boundingBox, xs = [], ys = []; let zmax = -9;
  for(let k=0;k<8;k++){ const v = new T.Vector3(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z), p = cs(hk, v); zmax = Math.max(zmax, p.z); const n = ndc(p); xs.push(n[0]); ys.push(n[1]); }
  out.hR = {x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys), zmax};
  const hc = cs(hk); out.hRc = [hc.x, hc.y, hc.z]; out.hRn = ndc(hc);
  const arm = R.hr.children.find(c=>c.geometry === W.__HG.arm);
  if(arm){ out.arm = []; for(let k=0;k<=10;k++){ const p = cs(arm, new T.Vector3(0, -0.5 + k/10, 0)); out.arm.push([...ndc(p), p.z]); }
    const a0 = cs(arm, new T.Vector3(0, -0.5, 0)), a1 = cs(arm, new T.Vector3(0, 0.5, 0)); out.armDir = [a1.x - a0.x, a1.y - a0.y, a1.z - a0.z]; }
  if(R.hl){ const lk = R.hl.children[0]; const lq = lk.quaternion.clone(); const ax = new T.Vector3(0, 0, 1).applyQuaternion(lq).normalize();   // hl 은 돌지 않는다 — 모형 공간 축
    out.hl = {p:[R.hl.position.x, R.hl.position.y, R.hl.position.z], axZ:Math.abs(ax.z)};
    const Gm = g.userData.mvG || {};
    if(Gm.bolt){ const bx = Gm.bolt.userData.box, bp = Gm.bolt.position, b0 = Gm.bolt.userData.p0, dz = bp.z - b0.z, p = R.hl.position;
      const dx = Math.max(bx[0] - p.x, 0, p.x - bx[3]), dy = Math.max(bx[1] - p.y, 0, p.y - bx[4]), dzz = Math.max(bx[2] + dz - p.z, 0, p.z - bx[5] - dz); out.hl.dBox = Math.hypot(dx, dy, dzz); } }
  if(g.userData.mvG && g.userData.mvG.lever){ const L = g.userData.mvG.lever, piv = L.userData.p0, p0 = R.hr.userData.p0.clone();
    const want = p0.sub(piv).applyAxisAngle(new T.Vector3(1, 0, 0), -HP[C.LEV]).add(piv); want.x += HP[C.RX]; want.y += HP[C.RY]; want.z += HP[C.RZ];
    out.lev = R.hr.position.distanceTo(want); }
  { const wq = hk.getWorldQuaternion(new T.Quaternion()), ax = new T.Vector3(0, 0, 1).applyQuaternion(wq), wp = hk.getWorldPosition(new T.Vector3()), v = wp.sub(cam.getWorldPosition(new T.Vector3())).normalize();
    out.rAxView = Math.abs(ax.dot(v)); out.rScale = hk.userData.s0 ? hk.scale.x/hk.userData.s0.x : 1; }
  if(R.px){ out.px = {vis:R.px.visible, d:R.px.position.length()}; }
  return out; });
/* 탄 조각이 보이는 화소 — 같은 프레임을 탄 켜고/끄고 두 번 그려 비교 */
const pxPixels = ()=>pg.evaluate(()=>{ const W = window, R = W.__heldRig(W.__KIT.wpn), c = W.__R.domElement;
  const shot = ()=>{ W.__drawFrame(); const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); return x.getImageData(0, 0, cv.width, cv.height).data; };
  if(!R.px || !R.px.visible) return -1;
  const a = shot(); R.px.visible = false; const b2 = shot(); R.px.visible = true;
  let n = 0; for(let k=0;k<a.length;k+=4) if(Math.abs(a[k] - b2[k]) + Math.abs(a[k+1] - b2[k+1]) + Math.abs(a[k+2] - b2[k+2]) > 24) n++; return n; });

/* ① 새총 */
{ await setup(1); await step(40); await fire(1); let bad = [], n = 0, minGap = 9;
  for(let f=0; f<=45; f++){ const m = await measure(); n++;
    const h = m.hR, inBox = h.zmax < 0 && h.x1 > -0.06 && h.x0 < 0.06 && h.y1 > -0.06 && h.y0 < 0.06;
    const armIn = (m.arm || []).some(a=>a[2] < 0 && Math.abs(a[0]) < 0.06 && Math.abs(a[1]) < 0.06);
    minGap = Math.min(minGap, Math.max(Math.abs((h.y0 + h.y1)/2) - (h.y1 - h.y0)/2, Math.abs((h.x0 + h.x1)/2) - (h.x1 - h.x0)/2));
    if(inBox || armIn) bad.push({f, h:[+h.x0.toFixed(2), +h.x1.toFixed(2), +h.y0.toFixed(2), +h.y1.toFixed(2)], armIn});
    await step(1); }
  ok('① 새총 — 쏜 뒤 0~0.75초 매 프레임, 오른손 화면 네모·팔뚝이 조준점 ±0.06 NDC 에 들어오지 않는다', bad.length === 0 && n === 46, {frames:n, bad:bad.slice(0, 4), minGapNdc:+minGap.toFixed(3)}); }
/* ② 강궁 */
{ await setup(8); await step(40); await fire(8); const bad = []; let seen = 0, minZ = 9;
  for(let f=0; f<=38; f++){ const m = await measure();
    const c = m.hRc, n = m.hRn, onScreen = c[2] < 0 && Math.abs(n[0]) < 1 && Math.abs(n[1]) < 1;
    if(onScreen){ seen++; minZ = Math.min(minZ, -c[2]); const w = m.arm[0];   // 팔뚝 손목 쪽 끝(카메라 공간 z · NDC)
      if(-c[2] < 0.2 || !(w[2] < -0.05 && Math.abs(w[0]) < 1.6 && Math.abs(w[1]) < 1.6)) bad.push({f, camZ:+c[2].toFixed(3), ndc:n.map(v=>+v.toFixed(2)), wristZ:+w[2].toFixed(3)}); }
    await step(1); }
  ok('② 강궁 — 쏜 뒤 0~0.62초, 화면 안의 오른손은 카메라에서 0.2 넘게 떨어져 있고 팔뚝 손목 끝도 카메라 앞(팔 없는 큰 손 0)', bad.length === 0, {onScreenFrames:seen, minCamDist:+minZ.toFixed(3), bad:bad.slice(0, 4)}); }
/* ③ 장전 손잡이 */
{ const rows = [];
  for(const w of [4, 10, 15]){ await setup(w); await step(30); const T = await reload(w); await step(Math.round(T.c*60) + 1);
    let minD = 9, maxAx = 0, frames = 0;
    for(let f=0; f < Math.round(T.rl*60) + 4; f++){ const m = await measure(); if(m.HP.LB > 0.95 && m.hl && m.hl.dBox !== undefined){ frames++; minD = Math.min(minD, m.hl.dBox); maxAx = Math.max(maxAx, m.hl.axZ); } await step(1); }
    rows.push({w, frames, minD:+minD.toFixed(3), maxAxZ:+maxAx.toFixed(2)}); }
  ok('③ 장전 손잡이 — LB>0.95(당기는 동안) 왼손 C 중심이 손잡이 상자 밖 0.06 넘게 · C 구멍 축 ⟂ 총 축(|축·z| < 0.5) — 연발총·금 연발총·은빛 카빈', rows.every(r=>r.frames > 3 && r.minD >= 0.06 && r.maxAxZ < 0.5), rows); }
/* ④ 관 탄창·옆 장전구 — 탄이 보인다 */
{ const rows = [];
  for(const w of [9, 14, 17, 11]){ await setup(w); await step(30); const T = await reload(w); const r = {w};
    let tNow = 0; for(const p of [0.5, 0.58]){ const n = Math.round((T.c + p*T.rl)*60) + 1 - tNow; await step(n); tNow += n; r['p' + p] = await pxPixels(); }
    rows.push(r); }
  ok('④ 관 탄창·옆 장전구 — 넣기 박자(p .5·.58)에 탄 조각이 화면에 보인다(숨기면 바뀌는 화소 > 30)', rows.every(r=>r['p0.5'] > 30 && r['p0.58'] > 30), rows); }
/* ⑤ 지렛대 */
{ await setup(11); await step(40); await fire(11); let maxGap = 0, maxLev = 0;
  for(let f=0; f<50; f++){ const m = await measure(); if(m.HP.LEV > 0.3){ maxGap = Math.max(maxGap, m.lev); maxLev = Math.max(maxLev, m.HP.LEV); } await step(1); }
  ok('⑤ 목장 장총 — 지렛대가 내려간 동안 오른손이 지렛대와 같이 핀을 축으로 돈 자리에서 0.02 안', maxLev > 0.8 && maxGap < 0.02, {maxLevDeg:+(maxLev*180/Math.PI).toFixed(1), maxGap:+maxGap.toFixed(4)}); }
/* ⑥ 재장전 굴림 동안 오른 팔뚝 방향 */
{ const rows = [];
  for(const w of [9, 16, 15]){ await setup(w); await step(40); const m0 = await measure(); const d0 = m0.armDir, n0 = Math.hypot(d0[0], d0[1]);
    const T = await reload(w); await step(Math.round(T.c*60) + 1); let worst = 0, frames = 0;
    for(let f=0; f < Math.round(T.rl*60); f += 3){ const m = await measure(); if(Math.abs(m.HP.ROL) > 15*Math.PI/180){ frames++;
        const d = m.armDir, n = Math.hypot(d[0], d[1]); const ang = Math.acos(Math.max(-1, Math.min(1, (d[0]*d0[0] + d[1]*d0[1])/(n*n0))))*180/Math.PI; worst = Math.max(worst, ang); }
      await step(3); }
    rows.push({w, frames, worstDeg:+worst.toFixed(1), rest:[+d0[0].toFixed(2), +d0[1].toFixed(2)]}); }
  ok('⑥ 재장전 굴림(|ROL| > 15°) 동안 오른 팔뚝 화면 방향이 쉬는 자세와 20° 안 — 산탄총·기관총·카빈', rows.every(r=>r.frames > 3 && r.worstDeg < 20), rows); }
/* ⑦ 노리쇠 쥔 손 · 클립 */
{ await setup(3); await step(40); await fire(3); let worst = 0, sc = 9, fr = 0;
  for(let f=0; f<46; f++){ const m = await measure(); if(m.HP.RA > 0.9){ fr++; worst = Math.max(worst, m.rAxView); sc = Math.min(sc, m.rScale); } await step(1); }
  await setup(3); await step(30); const T = await reload(3); await step(Math.round(T.c*60) + 1); let pxD = 9, pxF = 0;
  for(let f=0; f < Math.round(T.rl*60); f++){ const m = await measure(); if(m.px && m.px.vis){ pxF++; pxD = Math.min(pxD, m.px.d); } await step(1); }
  ok('⑦ 소총 — 노리쇠를 쥔 손(RA>0.9) C 구멍 축·시선 |cos| < 0.5 · 주먹 0.8배 · 클립은 C 입 밖(손 중심에서 0.1 넘게)', fr > 5 && worst < 0.5 && Math.abs(sc - 0.8) < 0.02 && pxF > 5 && pxD > 0.1,
    {frames:fr, axisViewCos:+worst.toFixed(2), fistScale:+sc.toFixed(2), clipFrames:pxF, clipDist:+pxD.toFixed(3)}); }
/* ⑧ 3인칭 새총·강궁 */
{ const r = await pg.evaluate(()=>{ const W = window, T3 = W.__TPGUN, out = {};
    for(const [w, act] of [[1, 'sling'], [8, 'bow']]){ const row = {};
      for(const p of [0, 0.3, 0.55, 1]){ const g = W.__gun3Motion({wak:1, wap:p, wact:act, wrk:0}, T3[w]); row['p' + p] = [+g.rw.toFixed(2), +g.rn.toFixed(2), g.hid]; }
      out[act] = row; }
    out.tags = [T3[1].r.filter(r=>r[13] === 'stone').length, T3[8].r.filter(r=>r[13] === 'arrow').length];
    return out; });
  const good = ['sling', 'bow'].every(a=>{ const R = r[a]; return R.p0[0] === 0 && R.p0[1] === 0 && R['p0.3'][0] > 0.9 && R['p0.3'][2] === 1 && R['p0.55'][1] > 0.9 && R['p0.55'][2] === 0 && R.p1.every(v=>v === 0); });
  ok('⑧ 3인칭 새총·강궁 — 쏜 뒤 오른손이 허리(rw)로 갔다 걸기(rn)로 오고, 돌·화살은 다시 걸 때까지 숨는다(끝나면 0)', good && r.tags[0] === 1 && r.tags[1] === 3, r); }
/* ⑨ 터치 🔫 */
{ const rows = [];
  for(const w of [5, 3]){ await setup(w); await step(20);
    const s0 = await pg.evaluate(w=>{ const W = window, K = W.__KIT; W.__setAim(false, true); W.__setGunT(0); K.mag[w] = 0; W.__setThrowCd(0); W.__setThrow(true); return {n:W.__RL.n, rl:W.__WEAPONS[w].rl}; }, w);
    let filled = -1, shot = -1, t = 0;
    for(let f=0; f < Math.round((s0.rl + 0.6)*60); f += 2){ await step(2); t += 2/60;
      const st = await pg.evaluate(w=>({mag:window.__KIT.mag[w], full:window.__WEAPONS[w].mag}), w);
      if(filled < 0 && st.mag > 0) filled = t;                       // 탄창이 찼다(한 프레임 안에 바로 한 발 나가면 full − 1)
      if(filled > 0 && st.mag < st.full){ shot = t; break; } }
    const n1 = await pg.evaluate(()=>window.__RL.n); await pg.evaluate(()=>window.__setThrow(false));
    rows.push({w, rl:s0.rl, filledAt:+filled.toFixed(2), shotAt:+shot.toFixed(2), rlStarts:n1 - s0.n}); }
  ok('⑨ 터치 🔫(공격 모드 없음·gunT 0·빈 탄창·누름) — 재장전 한 번(RL.n +1)이 rl + 0.3초 안에 끝나 탄창이 차고 다음 발이 나간다', rows.every(r=>r.rlStarts === 1 && r.filledAt > 0 && r.filledAt <= r.rl + 0.3 && r.shotAt > 0), rows); }
ok('페이지 오류 없음', errs.length === 0, errs.slice(0, 3));
} catch(e){ fail++; console.log('✗ 검사 중 오류 — ' + e.message); }
console.log(`${pass}/${pass + fail} t71 hand checks passed.`);
await b.close(); srv.close(); process.exit(fail ? 1 : 0);
