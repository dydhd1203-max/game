/* 72차 — 손가락으로 쥔다(선생님: "장전할 때 손가락 집게 방향(U자에서 둥근 쪽 반대)이 바깥을 향하잖아. 총 쪽 방향(안)을 향하게 해서
   실제 손가락으로 총을 조작한다는 느낌이 들게 해 줘") + 총 다루기 흠 둘(꺼내기 첫 컷 · 새총·활 놓은 손). 한 브라우저 · 시계 얼림 · 프레임을 한 장씩 민다.
   node t72-hand-grip.mjs [game.html] [port]
   ① 1인칭 — 손이 부품을 쥔 모든 프레임(손잡이·총대·펌프·탄창·새 탄창 들기·장전 손잡이·노리쇠 꼭지·꽂을대·탄 조각·클립 누르기·지렛대·새총 주머니·활 오늬·자루):
      C 입(둥근 등의 반대쪽) ↔ 손 가운데→쥔 부품 가운데(구멍 축에 직각인 면에서) 각 ≤ 35° · 부품 가운데가 입 쪽 반공간 · 작은 부품(장전 손잡이·노리쇠·꽂을대·탄·클립·주머니·오늬)은 구멍 축이 시선과 30° 넘게(도넛 금지)
   ② 3인칭 내 몸 — 쥔 손(손잡이·총대·탄창·자루·주머니): 쥔 곳이 C 구멍 한가운데(바깥 반지름 10% 안)이거나 같은 각 ≤ 35° · 반공간 · 구멍 축이 쥔 부품 긴 축과 25° 안   ③ 친구 화면 — 같은 셈(tc 추정 재장전·쏘기)
   ④ 꺼내기 — 첫 프레임부터 총이 화면 아래에 걸려 보이고(매 프레임 화면 안 조각 있음) 처음 6프레임 동안 위로 올라온다(갑자기 나타나지 않음)
   ⑤ 새총·강궁 쏜 뒤 0.25초 — 오른손(C)이 화면 안에 보이면 보이는 팔뚝(손목에서 화면 가장자리·카메라 뒤까지)이 손 크기의 절반 이상(팔 없는 손이 뜨지 않음) */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const args = process.argv.slice(2), file = args.find(a=>!a.startsWith('--') && !/^\d+$/.test(a)) || GAME, PORT = +(args.find(a=>/^\d+$/.test(a)) || process.env.T72_PORT || 20472);
const srv = serve(PORT, file);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:960, height:600}});
const errs = []; pg.on('pageerror', e=>errs.push(e.message));
let pass = 0, fail = 0;
const ok = (n, c, info)=>{ if(c) pass++; else fail++; console.log((c ? '✓ ' : '✗ ') + n + (info !== undefined ? '  — ' + JSON.stringify(info).slice(0, 900) : '')); };
await pg.addInitScript(()=>{ const real = performance.now.bind(performance); let fz = null;
  window.__clk = { freeze(){ fz = real(); window.__rafHold = true; }, adv(ms){ fz += ms; } };
  performance.now = ()=> fz === null ? real() : fz;
  const realRAF = window.requestAnimationFrame.bind(window); window.__raf = []; window.__rafHold = false;
  window.requestAnimationFrame = cb=>{ if(window.__rafHold){ window.__raf.push(cb); return 0; } return realRAF(cb); };
  // Drive exactly one real loop. Depending on arrival of an already scheduled native rAF
  // left some Windows runs with no frames (and falsely missing six grip states).
  window.__stepFrame = ()=>{ window.__raf.length=0; window.__loop73(); };
  try { localStorage.setItem('sndOn', '0'); } catch(e){} });
try {
await pg.route(/fonts\.(googleapis|gstatic)\.com/, r=>r.abort());
await pg.goto(`http://127.0.0.1:${PORT}/?gfx=low`, {waitUntil:'load', timeout:240000});
await pg.waitForFunction('window.__READY===true', null, {timeout:300000});
await pg.evaluate(()=>{ document.getElementById('iName').value = '검사'; document.getElementById('bSolo').click(); });
await pg.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:240000});
await pg.waitForTimeout(800);
await pg.evaluate(()=>{ const W = window, THREE = W.__THREE; document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); W.__introDone && W.__introDone(); W.__clk.freeze(); W.__DBG().noRender = true;
  /* C 입 방향(기하) — 호 조각의 무게중심 반대쪽(오른손 −x · 왼손 +x 를 기하에서 읽는다) */
  const mouthOf = geo=>{ if(geo.userData.mouth) return geo.userData.mouth; const P = geo.attributes.position; let x = 0, y = 0; for(let i=0;i<P.count;i++){ x += P.getX(i); y += P.getY(i); } const L = Math.hypot(x, y) || 1; return geo.userData.mouth = [-x/L, -y/L, 0]; };
  const V = ()=> new THREE.Vector3();
  W.__t72setup = (w, zoom)=>{ const P = W.__PL, G = W.__G; G.phase = 'day'; G.paused=false; G.mini = null; G.players.clear(); G.wolves = [];
    let spot = W.__t72spot || null;
    if(!spot) outer: for(let z = 30; z >= -30; z -= 3) for(let x = -24; x <= 24; x += 3){ if(Math.hypot(x, z) < 12) continue;
      const y = W.__groundUnder(x, z, P.R); if(y < 0 || y > 80) continue;
      if([[0,0],[2,0],[-2,0],[0,-4],[0,4],[3,3],[-3,3]].every(([dx, dz])=> Math.abs(W.__groundUnder(x + dx, z + dz, P.R) - y) < .01)){ spot = {x, z, y}; break outer; } }
    W.__t72spot = spot; Object.assign(P, spot, {vy:0, ground:true, yaw:0.3, pitch:-.05, landT:0, jumps:0});
    const K = W.__KIT; K.ownW[w] = true; K.ammo = 999; W.__setAim(false, true); W.__equipW(w); K.mag.length = 0; W.__setAim(true, true); W.__camZoom(zoom); W.__setThrow && W.__setThrow(false); };
  W.__t72step = n=>{ for(let i=0;i<n;i++){ W.__clk.adv(1000/60); W.__stepFrame(); } };
  /* 1인칭 한 프레임 — 두 손 */
  W.__t72fp = ()=>{
    const K = W.__KIT, i = K.wpn, g = W.__gunModels()[i]; if(!g || !g.visible) return [];
    const R = g.userData.rig; if(!R) return []; const HP = W.__HP, CI = W.__CHI, G = g.userData.mvG || {}, rk = (W.__GUN_CYCLE[i] || {}).rk;
    g.updateWorldMatrix(true, true); const cam = W.__cam; cam.updateMatrixWorld(true); const cp = V().setFromMatrixPosition(cam.matrixWorld);
    const toW = (x, y, z)=> V().set(x, y, z).applyMatrix4(g.matrixWorld), wp = o=>{ o.updateWorldMatrix(true, false); return V().setFromMatrixPosition(o.matrixWorld); };
    const RA = HP[CI.RA], LA = HP[CI.LA], LB = HP[CI.LB], MH = HP[CI.MH], PX = HP[CI.PX], draw = !!(R.hr && R.hr.userData.draw), out = [];
    const one = (h, nm)=>{ if(!h || !h.children[0]) return; const hk = h.children[0]; hk.updateWorldMatrix(true, false);
      const c = V(), q = new THREE.Quaternion(), s = V(); hk.matrixWorld.decompose(c, q, s); const mo = mouthOf(hk.geometry);
      const m = V().set(mo[0], mo[1], 0).applyQuaternion(q).normalize(), a = V().set(0, 0, 1).applyQuaternion(q).normalize();
      let st = null, T = null;
      if(nm === 'R'){
        if(draw){ const pz = G.pouch || G.arrow; if(RA <= 0.02 && pz){ st = G.pouch ? '주머니' : '오늬'; T = wp(pz); } }
        else if(RA >= 0.98 && R.boltA){ const k = R.boltA.clone().sub(G.boltH.userData.p0).applyAxisAngle(V().set(0, 0, 1), -HP[CI.BH]).add(G.boltH.userData.p0); k.z -= HP[CI.BOLT]; st = '노리쇠'; T = toW(k.x, k.y, k.z); }
        else if(RA >= 0.98 && R.rodA){ st = '꽂을대'; T = toW(R.rodA.x, R.rodA.y, R.rodA.z + HP[CI.AUX]); }
        else if(RA <= 0.02 && Math.hypot(HP[CI.RX], HP[CI.RY], HP[CI.RZ]) < 0.005){ const k = h.userData.p0.clone();
          if(G.lever && HP[CI.LEV]){ const pv = G.lever.userData.p0; k.sub(pv).applyAxisAngle(V().set(1, 0, 0), -HP[CI.LEV]).add(pv); }
          st = G.lever && Math.abs(HP[CI.LEV]) > 0.05 ? '지렛대' : '손잡이'; T = toW(k.x, k.y, k.z); }
      } else {
        if(draw){ if(LA <= 0.02 && LB <= 0.02){ st = '자루'; const p0 = h.userData.p0; T = toW(p0.x, p0.y, p0.z); } }
        else if(PX > 0.5 && R.px){ st = '탄'; T = wp(R.px); }
        else if(LB >= 0.98 && R.chgA){ st = '장전손잡이'; T = toW(R.chgA.x, R.chgA.y, R.chgA.z - HP[CI.BOLT]); }
        else if(MH > 0.5 && G.mag && LB <= 0.02){ const b = G.mag.userData.box, p0 = G.mag.userData.p0; st = '새탄창';
          T = toW((b[0]+b[3])/2 - p0.x + G.mag.position.x, (b[1]+b[4])/2 - p0.y + G.mag.position.y, (b[2]+b[5])/2 - p0.z + G.mag.position.z); }
        else if(LA >= 0.98 && LB <= 0.02 && G.mag && HP[CI.MAG] <= 0.01){ const b = G.mag.userData.box, p0 = G.mag.userData.p0; st = '탄창';
          T = toW((b[0]+b[3])/2 - p0.x + G.mag.position.x, (b[1]+b[4])/2 - p0.y + G.mag.position.y, (b[2]+b[5])/2 - p0.z + G.mag.position.z); }
        else if(LA >= 0.98 && R.px && rk === 'clip'){ st = '클립누르기'; T = wp(R.px); }
        else if(LA <= 0.02 && LB <= 0.02 && Math.abs(HP[CI.LR]) <= 0.02 && Math.hypot(HP[CI.LX], HP[CI.LY], HP[CI.LZ]) < 0.005){ const p0 = h.userData.p0; st = G.pump ? '펌프' : '총대'; T = toW(p0.x, p0.y + 0.035, p0.z - (G.pump ? HP[CI.PUMP] : 0)); }
      }
      if(!T) return;
      const n = c.clone().project(cam); if(!(n.z < 1 && Math.abs(n.x) < 1.05 && Math.abs(n.y) < 1.05)) return;   // 화면 밖(허리) 프레임은 빼고
      const v = T.clone().sub(c), vp = v.clone().addScaledVector(a, -v.dot(a));
      out.push({h:nm, st, ang: vp.length() > 1e-6 ? Math.round(Math.acos(Math.max(-1, Math.min(1, vp.dot(m)/vp.length())))*180/Math.PI) : 0, half: v.dot(m) >= -1e-6,
        donut: Math.round(Math.acos(Math.min(1, Math.abs(c.clone().sub(cp).normalize().dot(a))))*180/Math.PI), small: /장전손잡이|노리쇠|꽂을대|탄|클립|주머니|오늬/.test(st)}); };
    one(R.hr, 'R'); one(R.hl, 'L'); return out; };
  /* 3인칭 한 프레임 — 사람 s 의 두 손(drawSheep 이 적은 g3: 쥔 곳 · 총 틀) */
  W.__t72tp = (s, idx)=>{ if(!s || !s.g3 || !(s.wp > 0) || s.down) return [];
    const P = W.__P_handM(), g = s.g3, out = [], m4 = new THREE.Matrix4(), c = V(), q = new THREE.Quaternion(), sc = V();
    for(const [hi, nm] of [[1, 'R'], [0, 'L']]){ const M = P[hi], id = idx < 0 ? M.count - 1 : idx; if(id < 0) continue; M.getMatrixAt(id, m4); m4.decompose(c, q, sc);
      const mo = mouthOf(M.geometry), mv = V().set(mo[0], mo[1], 0).applyQuaternion(q).normalize(), a = V().set(0, 0, 1).applyQuaternion(q).normalize();
      const o = nm === 'R' ? 0 : 3, T = V().set(g[o], g[o+1], g[o+2]), F = V().set(g[6], g[7], g[8]), U = V().set(g[9], g[10], g[11]), S = V().set(g[12], g[13], g[14]);
      const HL = g[18] > 0.5, fade = nm === 'R' ? g[16] : g[15], k = g[17];
      let st = null, ax = null;
      if(nm === 'R'){ if(fade < 0.02){ st = HL ? '주머니' : '손잡이'; ax = HL ? S : U; } }
      else if(HL){ st = '자루'; ax = U; } else if(k > 0.98 && fade < 0.02){ st = '탄창'; ax = U; } else if(k < 0.02 && fade < 0.02){ st = '총대'; ax = F; }
      if(!st) continue;
      const v = T.clone().sub(c), vp = v.clone().addScaledVector(a, -v.dot(a)), mid = vp.length() < 0.1*0.5*Math.max(sc.x, sc.y);   // 쥔 곳이 C 구멍 한가운데(부품이 C 안)
      out.push({h:nm, st, ang: mid ? 0 : Math.round(Math.acos(Math.max(-1, Math.min(1, vp.dot(mv)/vp.length())))*180/Math.PI), half: mid || v.dot(mv) >= -1e-6,
        axis: Math.round(Math.acos(Math.min(1, Math.abs(a.dot(ax))))*180/Math.PI)}); }
    return out; };
});
const setup = (w, zoom)=> pg.evaluate(([w, zoom])=>{ window.__t72setup(w, zoom); }, [w, zoom]);
const step = n=> pg.evaluate(n=>{ window.__t72step(n); }, n);
/* 한 동작(쏘기·재장전·꺼내기)을 끝까지 밀며 매 프레임 잰다 */
const run = (w, act, who)=> pg.evaluate(([w, act, who])=>{ const W = window, K = W.__KIT, C = W.__GUN_CYCLE[w]; W.__setThrowCd(0);
  let T = 0;
  if(who === 'fr'){ const q = W.__G.players.get('fr1'); if(act === 'fire'){ q.tcN = (q.tcN + 1) & 255; T = 0.8; } else { if(W.__wpnMag(W.__WEAPONS[w]) <= 1) return []; q.magE = 1; q.tcN = (q.tcN + 1) & 255; T = W.__WEAPONS[w].rl + 0.4; } }
  else if(act === 'draw'){ W.__setAim(false, true); W.__setGunT(0); W.__heldAct.k = 0; W.__setAim(true, true); T = 0.45; }
  else if(act === 'fire'){ K.mag.length = 0; W.__fireWeapon(); T = C && C.cyc ? C.cyc[0] + C.cyc[1] + 0.12 : 0.4; }
  else { if(W.__wpnMag(W.__WEAPONS[w]) <= 1) return []; K.mag[w] = 1; W.__fireWeapon(); T = W.__wpnShotCd(W.__WEAPONS[w]) + W.__WEAPONS[w].rl + 0.25; }
  const out = [];
  for(let k=1; k<=Math.round(T*60); k++){ W.__t72step(1);
    const r = who === 'fp' ? W.__t72fp() : who === 'tp' ? W.__t72tp(W.__meSheep(), -1) : W.__t72tp(W.__G.players.get('fr1'), 0);
    for(const x of r) out.push(Object.assign(x, {t:+(k/60).toFixed(3), w, act})); }
  return out; }, [w, act, who]);
const judge = (rows, tp)=>{ const bad = rows.filter(r=> r.ang > 35 || !r.half || (tp ? r.axis > 25 : (r.small && r.donut < 30)));
  const by = {}; for(const r of rows){ const k = r.h + ':' + r.st; by[k] = by[k] || {n:0, bad:0, maxAng:0}; by[k].n++; by[k].maxAng = Math.max(by[k].maxAng, r.ang); if(bad.includes(r)) by[k].bad++; }
  return {n:rows.length, bad:bad.length, maxAng:Math.max(0, ...rows.map(r=>r.ang)), by, ex:bad.slice(0, 5)}; };

/* ① 1인칭 — 스무 자루 · 쏘기 · 재장전 · (몇 자루) 꺼내기 */
const FP = [];
for(let w=1; w<=19; w++){ await setup(w, 0); await step(40); FP.push(...await run(w, 'fire', 'fp')); await step(30); FP.push(...await run(w, 'reload', 'fp'));
  if([1, 3, 8, 9].includes(w)){ await step(30); FP.push(...await run(w, 'draw', 'fp')); } }
const j1 = judge(FP, false);
ok('① 1인칭 — 손이 부품을 쥔 모든 프레임: C 입 ↔ 쥔 부품 각 ≤ 35° · 부품이 입 쪽 반공간 · 작은 부품은 도넛 금지(구멍 축 ↔ 시선 > 30°)', j1.bad === 0 && j1.n > 1500 && Object.keys(j1.by).length >= 14, {n:j1.n, bad:j1.bad, maxAng:j1.maxAng, states:Object.keys(j1.by).length, ex:j1.ex});
console.log('  1인칭 쥔 곳별 — ' + Object.entries(j1.by).map(([k, v])=> `${k} ${v.n}(최대 ${v.maxAng}°${v.bad ? ' 나쁨 ' + v.bad : ''})`).join(' · '));
/* ② 3인칭 내 몸 */
const TP = [];
for(const w of [1, 3, 4, 8, 9, 11, 13, 16]){ await setup(w, 3.2); await step(40); TP.push(...await run(w, 'fire', 'tp')); await step(30); TP.push(...await run(w, 'reload', 'tp')); }
const j2 = judge(TP, true);
ok('② 3인칭 내 몸 — 쥔 손(손잡이·총대·탄창·자루·주머니): 쥔 곳이 C 구멍 한가운데(부품이 C 안)거나 C 입 쪽 ≤ 35° · 구멍 축 ↔ 쥔 부품 긴 축 ≤ 25°', j2.bad === 0 && j2.n > 400, {n:j2.n, bad:j2.bad, maxAng:j2.maxAng, by:j2.by, ex:j2.ex});
/* ③ 친구 화면 */
const FR = [];
for(const [w, act] of [[4, 'reload'], [1, 'fire'], [9, 'reload'], [8, 'fire']]){ await setup(w, 3.2);
  await pg.evaluate((w)=>{ const W = window, G = W.__G, S = W.__t72spot, pm = W.__pcMap, P = W.__PL; pm.set('fr1', {wp:w, we:0, n:'친구', g:1});
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw), x = P.x + fx*3.2 + rx*0.9, z = P.z + fz*3.2 + rz*0.9;
    G.players.set('fr1', {uid:'fr1', x, z, y:S.y, tx:x, tz:z, ty:S.y, ry:P.yaw + Math.PI*1.62, g:1, n:'친구', hp:100, down:false, hat:0, gls:0, clo:0, skin:2, ph:1, tcN:10}); W.__setAim(false, true); }, w);
  await step(30); FR.push(...await run(w, act, 'fr')); await pg.evaluate(()=>{ window.__G.players.clear(); }); }
const j3 = judge(FR, true);
ok('③ 친구 화면 — 같은 셈(쏘기·재장전 추정)', j3.bad === 0 && j3.n > 150, {n:j3.n, bad:j3.bad, maxAng:j3.maxAng, by:j3.by, ex:j3.ex});
/* ④ 꺼내기 — 총이 첫 프레임부터 화면 아래에 걸려 보이고 올라온다 */
const DR = {};
for(const w of [3, 1, 16]){ await setup(w, 0); await step(40);
  DR[w] = await pg.evaluate((w)=>{ const W = window, T = W.__THREE, cam = W.__cam, g = W.__gunModels()[w];
    W.__setAim(false, true); W.__setGunT(0); W.__heldAct.k = 0; W.__setAim(true, true);
    const rows = [], n = Math.round(W.__heldAct.T*60), v = new T.Vector3();
    for(let k=1; k<=n; k++){ W.__t72step(1); g.updateWorldMatrix(true, true); cam.updateMatrixWorld(true); let on = 0, top = -9;
      g.traverse(o=>{ if(!o.isMesh || o.userData.arm || !o.visible) return; const gb = o.geometry; if(!gb.boundingBox) gb.computeBoundingBox(); const bb = gb.boundingBox;
        for(let c=0;c<8;c++){ v.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld).project(cam);
          if(v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) on++; if(v.z < 1 && Math.abs(v.x) <= 1.2) top = Math.max(top, v.y); } });
      rows.push([+(k/60).toFixed(3), on, +top.toFixed(3)]); }
    return rows; }, w); }
const drBad = Object.entries(DR).filter(([w, r])=> r.some(x=> x[1] === 0) || !r.slice(0, 6).every((x, i, a)=> !i || x[2] >= a[i-1][2] - 1e-3));
ok('④ 꺼내기 — 첫 프레임부터 매 프레임 총 조각이 화면 안에 있고 처음 6프레임 동안 위로 올라온다(0.05초 컷에 총이 없다가 0.12초에 갑자기 나타나지 않음)', drBad.length === 0,
  Object.fromEntries(Object.entries(DR).map(([w, r])=> [w, r.slice(0, 8)])));
/* ⑤ 새총·강궁 쏜 뒤 — 오른손이 화면 안이면 팔뚝도 화면 안 */
const RL = {};
for(const w of [1, 8]){ await setup(w, 0); await step(40);
  RL[w] = await pg.evaluate((w)=>{ const W = window, T = W.__THREE, cam = W.__cam, R = W.__heldRig(w), hk = R.hr.children[0], arm = R.hr.children.find(c=>c.geometry === W.__HG.arm);
    W.__KIT.mag.length = 0; W.__setThrowCd(0); W.__fireWeapon(); const rows = [];
    for(let k=1; k<=15; k++){ W.__t72step(1); cam.updateMatrixWorld(true); hk.updateWorldMatrix(true, false); arm.updateWorldMatrix(true, false);
      const h = new T.Vector3().setFromMatrixPosition(hk.matrixWorld).project(cam), hOn = h.z < 1 && Math.abs(h.x) <= 0.92 && Math.abs(h.y) <= 0.85;   // 손이 화면 안에 제대로 보임(가장자리에 반쯤 걸쳐 빠져나가는 한 프레임은 빼고)
      /* 손 크기(화면) · 보이는 팔뚝 길이(손목에서 화면 가장자리나 카메라 뒤까지 — 카메라 쪽으로 눕거나 손 뒤에 숨으면 짧다) */
      hk.geometry.computeBoundingBox(); const bb = hk.geometry.boundingBox; let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for(let c=0;c<8;c++){ const v = new T.Vector3(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(hk.matrixWorld).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      const hs = Math.max(x1 - x0, y1 - y0); let vis = 0, prev = null;
      for(let q=0; q<=20; q++){ const a = new T.Vector3(0, -0.5 + q/20, 0).applyMatrix4(arm.matrixWorld), c = a.clone().applyMatrix4(cam.matrixWorldInverse);
        if(c.z > -cam.near) break; a.project(cam); if(Math.abs(a.x) > 1 || Math.abs(a.y) > 1) break; if(prev) vis += Math.hypot(a.x - prev[0], a.y - prev[1]); prev = [a.x, a.y]; }
      rows.push([+(k/60).toFixed(3), hOn ? 1 : 0, vis >= 0.5*hs ? 1 : 0, +h.x.toFixed(2), +h.y.toFixed(2), +hs.toFixed(2), +vis.toFixed(2)]); }
    return rows; }, w); }
const flo = Object.entries(RL).flatMap(([w, r])=> r.filter(x=> x[1] && !x[2]).map(x=> [+w, ...x]));
ok('⑤ 새총·강궁 쏜 뒤 0.25초 — 오른손(C)이 화면 안에 보이는 프레임은 보이는 팔뚝이 손 크기의 절반 이상(팔 없는 손 0 — 예전 새총은 0.02~0.07초 손 0.57 · 팔뚝 0.11)', flo.length === 0, flo.length ? flo.slice(0, 8) : {sling:RL[1].slice(0, 6), bow:RL[8].slice(0, 6)});
} catch(e){ fail++; console.log('✗ 실행 실패 — ' + (e && e.stack || e)); }
ok('페이지 오류 0', errs.length === 0, errs.slice(0, 3));
console.log(`t72-hand-grip: ${pass} passed${fail ? ', ' + fail + ' failed' : ''}`);
await b.close(); srv.close(); process.exit(fail ? 1 : 0);
