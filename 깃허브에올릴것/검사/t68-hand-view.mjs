/* 70차(reload68 §8.2) — 오른손잡이 손·부품 움직임·어깨 너머 가림 동적 검사(한 브라우저).
   node t68-hand-view.mjs [game.html] [port]
   ① 1인칭: 오른손(C 손)이 손잡이 오른쪽 · 오른 팔뚝은 화면 오른쪽 아래 · 왼 팔뚝은 왼손보다 왼쪽 · 새총·활은 왼손이 자루를 쥐고 오른손이 주머니/오늬를 잡는다
   ② 손은 예전 손 재질(HELD_ARM) 하나 · 색은 내 피부/옷 ③ 총열 축이 10칸 앞 조준점을 1cm 안으로 지난다(판정·총구 불변)
   ④ 부품이 실제로 움직인다(소총 노리쇠 · 연발총 탄창이 왼손을 따라감) ⑤ 어깨 너머: 조준점 반지름 60px 안에 총 조각 0 ⑥ 3인칭 비껴 서기 30° · 손잡이 몸 오른쪽 */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const args = process.argv.slice(2), file = args.find(a=>!a.startsWith('--') && !/^\d+$/.test(a)) || GAME, PORT = +(args.find(a=>/^\d+$/.test(a)) || 20478);
const srv = serve(PORT, file);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1366, height:768}});
const errs = []; pg.on('pageerror', e=>errs.push(e.message));
let pass = 0, fail = 0;
const ok = (n, c, info)=>{ if(c) pass++; else fail++; console.log((c ? '✓ ' : '✗ ') + n + (info !== undefined ? '  — ' + JSON.stringify(info) : '')); };
try {
await pg.goto(`http://127.0.0.1:${PORT}/?gfx=mid`, {waitUntil:'load', timeout:240000});
await pg.waitForFunction('window.__READY===true', null, {timeout:300000});
await pg.evaluate(()=>{ document.getElementById('iName').value = '검사'; document.getElementById('bSolo').click(); });
await pg.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:240000});
await pg.waitForTimeout(1000);
await pg.evaluate(()=>{ const W = window; document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); W.__introDone && W.__introDone();
  W.__G.paused = true; W.__KIT.ownW = W.__WEAPONS.map(()=>true); W.__KIT.ammo = 9999; W.__camZoom && W.__camZoom(0); });
const fp = await pg.evaluate(()=>{
  const W = window, T = W.__THREE, cam = W.__cam, out = {bad:[], rows:{}, mats:0, handMeshes:0, aim:[]};
  const toCam = (o, v)=>{ const p = v ? v.clone() : new T.Vector3(); o.localToWorld(p); cam.worldToLocal(p); return p; };
  W.__setAim(true, true);
  for(let w=1; w<W.__WEAPONS.length; w++){
    W.__equipW(w); W.__heldAct.k = 0; W.__HM.shotT = 9; W.__RL.w = -1;
    for(let i=0;i<60;i++) W.__updHeld(1/60, false, 0);
    cam.updateMatrixWorld(true);
    const gm = W.__gunModels()[w], R = W.__heldRig(w), hr = R.hr, hl = R.hl, draw = !!hr.userData.draw;
    gm.traverse(o=>{ if(o.isMesh && o.userData.arm){ out.handMeshes++; if(o.material !== W.__HELD_ARM) out.mats++; } });
    const grip = toCam(draw ? hl : hr), cR = toCam(hr.children[0]), armR = hr.children.find(c=>c.geometry === W.__HG.arm), armL = hl && hl.children.find(c=>c.geometry === W.__HG.arm);
    const armRend = toCam(armR, new T.Vector3(0, 0.5, 0)), handR = toCam(hr);
    const r = {w, draw, handRight:+(cR.x - (draw ? handR.x : grip.x)).toFixed(4), armRdx:+(armRend.x - handR.x).toFixed(3), armRdy:+(armRend.y - handR.y).toFixed(3), armRdz:+(armRend.z - handR.z).toFixed(3)};
    if(armL){ const e = toCam(armL, new T.Vector3(0, 0.5, 0)), h = toCam(hl); r.armLdx = +(e.x - h.x).toFixed(3); }
    out.rows[w] = r;
    const need = draw ? (r.armRdx > 0.02 && r.armRdy < 0) : (r.handRight > 0.002 && r.armRdx > 0.04 && r.armRdy < 0 && r.armRdz > 0);
    if(!need || (r.armLdx !== undefined && r.armLdx > 0)) out.bad.push(r);
    /* ③ 총열 축이 조준점(카메라 앞 10칸)을 지난다 */
    /* 견착(쉬는 자세 · 준비 자세 아님)에서 걸음 시계 한 바퀴(≈4초) 중 가장 가까운 때 — 숨쉬기 흔들림이 0 을 지날 때 총열 축이 조준점을 지나야 한다 */
    if(gm.userData.muzzle && gm.userData.axisH){ let best = 9;
      for(let i=0;i<260;i++){ W.__HM.idleT = 0; W.__updHeld(1/60, false, 0); cam.updateMatrixWorld(true);
        const m = toCam(gm, gm.userData.muzzle), a = new T.Vector3(0, 0, 1).applyQuaternion(gm.getWorldQuaternion(new T.Quaternion())).transformDirection(cam.matrixWorldInverse);
        const t = (-10 - m.z)/a.z, px = m.x + a.x*t, py = m.y + a.y*t; best = Math.min(best, Math.hypot(px, py)); }
      out.aim.push([w, +best.toFixed(4)]); }
  }
  return out;
});
ok('① 1인칭 오른손은 손잡이 오른쪽 · 오른 팔뚝은 화면 오른쪽 아래(카메라 쪽) · 왼 팔뚝은 왼쪽 — 스무 자루', fp.bad.length === 0, fp.bad.length ? fp.bad : {sample:[fp.rows[3], fp.rows[4], fp.rows[1], fp.rows[8]]});
ok('① 새총·활 — 왼손이 자루(쥔 손 = 왼손), 오른손은 주머니·오늬', fp.rows[1].draw && fp.rows[8].draw && Object.values(fp.rows).filter(r=>r.draw).length === 2);
ok('② 손·팔·소매는 모두 예전 손 재질(HELD_ARM) — 새 재질 0', fp.mats === 0 && fp.handMeshes > 60, {handMeshes:fp.handMeshes, other:fp.mats});
ok('③ 총열 축이 10칸 앞 조준점을 1cm 안으로 지난다(모든 총 · 견착 · 숨쉬기 흔들림이 0 을 지날 때)', fp.aim.every(a=>a[1] <= 0.01), fp.aim.filter(a=>a[1] > 0.01));
const skin = await pg.evaluate(()=>{ const W = window, s = W.__meSheep(); s.skin = 3; s.clo = 0; s.jt = 0; s.g = 1; W.__equipW(3); for(let i=0;i<3;i++) W.__updHeld(1/60, false, 0);
  const c = W.__HG.cR.attributes.color, sl = W.__HG.slv.attributes.color, T = W.__THREE, want = new T.Color(W.__skinCol ? W.__skinCol(3) : 0xa8714a);
  return {hand:[c.getX(0), c.getY(0), c.getZ(0)].map(v=>+v.toFixed(3)), want:[want.r, want.g, want.b].map(v=>+v.toFixed(3)), sleeve:[sl.getX(0), sl.getY(0), sl.getZ(0)].map(v=>+v.toFixed(3))}; });
ok('② 손 색 = 내 피부색(꼭짓점 색만 다시 칠함)', skin.hand.every((v,i)=> Math.abs(v/skin.want[i] - skin.hand[0]/skin.want[0]) < 0.02), skin);
/* ④ 부품 */
const parts = await pg.evaluate(()=>{ const W = window, T = W.__THREE, out = {}; W.__G.paused = false;   // fireWeapon 은 멈춤 중엔 안 쏜다
  W.__equipW(3); W.__KIT.mag.length = 0; W.__setThrowCd(0); W.__fireWeapon(); const g3 = W.__gunModels()[3], bh = g3.userData.mvG.boltH, q0 = bh.userData.q0.clone();
  let maxAng = 0, maxBack = 0; for(let i=0;i<50;i++){ W.__updHeld(1/60, false, 0); maxAng = Math.max(maxAng, bh.quaternion.angleTo(q0)); maxBack = Math.max(maxBack, bh.userData.p0.z - bh.position.z); }
  out.rifle = {liftDeg:+(maxAng*180/Math.PI).toFixed(1), back:+maxBack.toFixed(3)};
  W.__equipW(4); W.__KIT.mag[4] = 1; W.__setThrowCd(0); W.__fireWeapon(); for(let i=0;i<30;i++){ W.__setThrowCd(Math.max(0, 0)); W.__rlTick(1/60); W.__updHeld(1/60, false, 0); }
  const g4 = W.__gunModels()[4], mg = g4.userData.mvG.mag, R = W.__heldRig(4); let follow = 1e9, dropMax = 0, samp = 0;
  while(W.__RL.w === 4 && samp < 200){ W.__rlTick(1/60); W.__updHeld(1/60, false, 0); samp++;
    const p = 1 - W.__RL.t/W.__RL.T; dropMax = Math.max(dropMax, mg.position.distanceTo(mg.userData.p0));
    if(p > 0.5 && p < 0.6){ const hand = R.hl.position.clone().sub(R.grab), off = mg.position.clone().sub(mg.userData.p0); follow = Math.min(follow, hand.distanceTo(off)); } }
  out.smg = {dropMax:+dropMax.toFixed(3), follow:+follow.toFixed(4), back:+mg.position.distanceTo(mg.userData.p0).toFixed(4)};
  W.__G.paused = true; return out; });
ok('④ 소총 — 쏜 뒤 노리쇠 손잡이가 실제로 들리고(≥50°) 뒤로 간다', parts.rifle.liftDeg >= 50 && parts.rifle.back > 0.05, parts.rifle);
ok('④ 연발총 — 재장전 때 탄창이 빠져 왼손을 따라가고(오차 0) 끝나면 제자리', parts.smg.dropMax > 0.3 && parts.smg.follow < 1e-4 && parts.smg.back < 1e-4, parts.smg);
/* ⑤ · ⑥ 어깨 너머 */
await pg.evaluate(()=>{ const W = window; W.__camZoom(3.2); W.__equipW(3); W.__setAim(true, true); W.__G.paused = false; W.__DBG().noRender = false; });
for(let i=0;i<60;i++) await pg.evaluate(()=>{ window.__drawFrame && window.__drawFrame(); });
const tp = await pg.evaluate(()=>{ const W = window, T = W.__THREE, cam = W.__cam, cv = W.__R.domElement, s = W.__meSheep(), P = W.__PL;
  const res = {};
  for(const w of [3, 1, 8, 16]){ W.__equipW(w); for(let i=0;i<40;i++) W.__drawFrame();
    const g = W.__P_gunM(), m = new T.Matrix4(), v = new T.Vector3(); let near = 1e9;
    for(let i=0;i<g.count;i++){ g.getMatrixAt(i, m); v.setFromMatrixPosition(m); v.project(cam); if(v.z > 1) continue;
      const x = (v.x*0.5)*cv.clientWidth, y = (v.y*0.5)*cv.clientHeight; near = Math.min(near, Math.hypot(x, y)); }
    const gs = W.__GAIT_M.get(s); res[w] = {nearPx:+near.toFixed(1), stance:+((gs && gs.stanceK) || 0).toFixed(3)}; }
  const B = W.__P_bodyM(); B.getMatrixAt(B.count - 1, new T.Matrix4()); const q = new T.Quaternion(), mm = new T.Matrix4(); B.getMatrixAt(B.count - 1, mm); mm.decompose(new T.Vector3(), q, new T.Vector3());
  const e = new T.Euler().setFromQuaternion(q, 'YXZ'); let d = e.y - (P.yaw + Math.PI); while(d > Math.PI) d -= 2*Math.PI; while(d < -Math.PI) d += 2*Math.PI;
  res.bodyDeg = +(d*180/Math.PI).toFixed(1);
  const H = W.__P_handM()[1]; H.getMatrixAt(H.count - 1, mm); const hp = new T.Vector3().setFromMatrixPosition(mm), lx = -Math.cos(P.yaw), lz = Math.sin(P.yaw);
  res.gripSd = +((hp.x - P.x)*lx + (hp.z - P.z)*lz).toFixed(3);
  return res; });
ok('⑤ 어깨 너머: 조준점 반지름 60px 안에 총 조각 0(소총·새총·활·기관총)', [3, 1, 8, 16].every(w=>tp[w].nearPx > 60), tp);
ok('⑥ 3인칭 비껴 서기 30°(몸이 조준에서 오른쪽으로) · 오른손 손잡이는 몸 오른쪽', Math.abs(tp.bodyDeg + 30) < 1.5 && tp.gripSd < -0.05, {bodyDeg:tp.bodyDeg, gripSd:tp.gripSd});
} catch(e){ fail++; console.log('✗ 실행 실패 — ' + e.message); }
ok('페이지 오류 0', errs.length === 0, errs.slice(0, 3));
console.log(`t68-hand-view: ${pass} passed${fail ? ', ' + fail + ' failed' : ''}`);
await b.close(); srv.close(); process.exit(fail ? 1 : 0);
