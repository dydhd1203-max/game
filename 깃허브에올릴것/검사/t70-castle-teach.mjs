/* 70차 2회차 — 선생님 새 요청(나선 손잡이 A · 나선 넓히기 B · 성벽 길 낮은 턱 C · 계단 몸 와다다 E · 좀비 계단 벽 파고듦 F) 검사.
   숨김 브라우저 한 개(pw.mjs · ?gfx=low · 혼자 놀기 · 멈춘 채). 실제 게임 함수만 부른다(__updPlayer · __hostSim · __KEY · groundUnder …).
   A1 손잡이 조각 자리·끊음 · A2 1인칭 시야 · B1 폭·기울기 · B2 아이 손 셋 × 탑 여덟 · C1 든 총 · C2 뛰어내리기 · C3 걸어선 안 떨어짐 · C4 마을 쪽 조준 가림 ·
   C5 좀비 새 길 없음 · E1 보이는 몸 y 2차 차분 · E2 몸-충돌 차 · E3 계단 걸음 박자 · E4 친구 보간 · F1 좀비 파고듦 · F2 오르기 · F3 성능 · F4 땅 좀비 계단 칸 */
import {chromium} from './pw.mjs'; import {serve} from './serve2.mjs'; import {GAME} from './gamefile.mjs';
const PORT = +(process.env.T70_PORT || 20196);
const server = serve(PORT, process.argv[2] || GAME), results = [], errors = [];
const put = (r)=>{ results.push(r); console.log(`${r.pass ? 'PASS' : 'FAIL'} [${r.id}] ${r.name}` + (r.pass ? '' : ' ' + JSON.stringify(r.detail ?? '').slice(0, 600))); };
let browser;
try{
  browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:960, height:600}});
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?gfx=low`, {waitUntil:'load', timeout:90000});
  await page.waitForFunction(()=>window.__READY === true, null, {timeout:90000});
  await page.evaluate(()=>{ document.getElementById('iName').value = '70차 검사'; document.getElementById('bSolo').click(); });
  await page.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:60000});
  await page.evaluate(()=>{ document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); const W = window; W.__G.paused = true; W.__DBG().noLogic = true; W.__DBG().noRender = true;
    const PL = W.__PL, K = W.__KEY, GY = W.__GY;
    const H = W.__t70 = {};
    H.f3 = (v)=> Math.round(v*1000)/1000;
    H.keys = (o)=>{ for(const k in K) K[k] = false; Object.assign(K, o || {}); };
    H.place = (x, y, z, yaw, pitch)=>{ H.keys(); Object.assign(PL, {x, z, y:GY + y, vx:0, vz:0, vy:0, _px:undefined, down:false, jumps:0, ground:true, yaw:yaw || 0, pitch:pitch === undefined ? -0.1 : pitch}); for(let i=0; i<3; i++) W.__updPlayer(1/60); };
    H.xf = (i, x, z)=>{ let q = (i & 1) ? [-z, -x] : [x, z]; for(let n = i >> 1; n > 0; n--) q = [-q[1], q[0]]; return q; };
  });

  /* ═══ A 손잡이 · B 폭 ═══ */
  const AB = await page.evaluate(()=>{ const W = window, H = W.__t70, GY = W.__GY, CW = W.__CW, SP = W.__SPIRALS, C = W.__CPIECES(), d = C.data, st = C.stride, PI = Math.PI;
    const out = {rope:0, rail:[], railBad:[], wedge:[], keys:new Set()};
    const kd = C.kinds.indexOf('rail'), kr = C.kinds.indexOf('rope');
    const pieces = [];
    /* CPIECES 의 y 는 GY 기준(put 이 GY 를 더하기 전 값) */
    const nearSp = (x, z)=> SP.some(S=> Math.hypot(x - S.cx, z - S.cz) < S.b + 0.5);
    for(let i=0; i<C.n; i++){ const o = i*st, k = d[o + 7]; if(k === kr && nearSp((d[o+1] + d[o+2])/2, (d[o+3] + d[o+4])/2)) out.rope++; if(k !== kd) continue; out.keys.add(C.keys[d[o]]);
      pieces.push([(d[o+1] + d[o+2])/2, (d[o+5] + d[o+6])/2, (d[o+3] + d[o+4])/2, d[o+1], d[o+2], d[o+5], d[o+6], d[o+3], d[o+4]]); }
    for(let s=0; s<9; s++){ const S = SP[s]; let n = 0;
      for(const p of pieces){ const r = Math.hypot(p[0] - S.cx, p[2] - S.cz); if(r > S.b + 0.5 || p[1] < S.y0 - GY - 0.5 || p[1] > S.y0 - GY + S.Ht*S.turns + 3) continue; n++;
        if(r < S.b - 0.15 || r > S.b - 0.04) out.railBad.push([s, H.f3(r)]);
        const th = Math.atan2(p[2] - S.cz, p[0] - S.cx);
        for(const D of S.doors){ const da = Math.abs(Math.atan2(Math.sin(th - (S.th0 + D.rel)), Math.cos(th - (S.th0 + D.rel))));
          if(da < D.half && p[1] > D.y - GY + 0.3 && p[1] < D.y - GY + 2.3) out.wedge.push([s, H.f3(th), H.f3(p[1])]); } }
      out.rail.push(n); }
    out.keys = [...out.keys];
    /* 고침 — 쇠 까치발(railBracket) 조각 상자 ~ 가장 가까운 손잡이 조각 상자 틈(받칠 손잡이 없이 벽에 뜬 받침 0) */
    { const kb = C.kinds.indexOf('railBracket'); let gm = 0, at = null, nb = 0;
      for(let i=0; i<C.n; i++){ const o = i*st; if(d[o + 7] !== kb) continue; nb++; const b = [d[o+1], d[o+2], d[o+5], d[o+6], d[o+3], d[o+4]]; let g = 1e9;
        for(const p of pieces){ const gx = Math.max(0, p[3] - b[1], b[0] - p[4]), gy = Math.max(0, p[5] - b[3], b[2] - p[6]), gz = Math.max(0, p[7] - b[5], b[4] - p[8]); g = Math.min(g, Math.hypot(gx, gy, gz)); }
        if(g > gm){ gm = g; at = [H.f3((b[0] + b[1])/2), H.f3((b[2] + b[3])/2), H.f3((b[4] + b[5])/2)]; } }
      out.bracket = {n:nb, gapMax:H.f3(gm), at}; }
    /* 고침 — 휜 호(crail·crailK) 이음: 토막 끝 단면 가운데가 이웃 토막 시작과 1mm 안 · 같은 줄기 한 색 · 손잡이 색은 세 나무색 그대로(불빛 웅덩이 안 탐) */
    { const THREE = W.__THREE, RC = new Set([0x5a3f28, 0x4f3724, 0x563c27]), J = {arcs:0, joints:0, colJump:0, colOut:0, ends:0};
      for(const k of ['crail', 'crailK']){ const b = W.__banks.get(k); if(!b) continue; const pos = b.geo.attributes.position, NR = 9, n0 = new THREE.Vector3(), n1 = new THREE.Vector3();
        for(let j=0; j<NR - 1; j++){ n0.x += pos.getX(j)/(NR - 1); n0.y += pos.getY(j)/(NR - 1); n0.z += pos.getZ(j)/(NR - 1); const q = pos.count - NR + j; n1.x += pos.getX(q)/(NR - 1); n1.y += pos.getY(q)/(NR - 1); n1.z += pos.getZ(q)/(NR - 1); }
        const E = b.ms.map(m=> [n0.clone().applyMatrix4(m), n1.clone().applyMatrix4(m)]); J.arcs += E.length;
        for(let i=0; i<E.length; i++){ if(!RC.has(b.cols[i])) J.colOut++; let hit = false;
          for(let j=0; j<E.length; j++) if(j !== i && E[i][1].distanceTo(E[j][0]) < 1e-3){ hit = true; J.joints++; if(b.cols[i] !== b.cols[j]) J.colJump++; }
          if(!hit) J.ends++; } }
      out.joint = J; }
    /* A2 — T1·T5 걸음선 36 자리 · 오르는 쪽 접선 시선(위로 0.2) · 화면 가운데 원뿔(가로 ±30° · 세로 ±20°) 안 손잡이 조각 상자까지 가장 가까운 거리 */
    let minD = 1e9, at = null;
    for(const s of [0, 4]){ const S = SP[s], rm = (S.a + S.b)/2;
      for(let j=0; j<36; j++){ const th = S.th0 + (j + 0.5)*PI/6, ex = S.cx + Math.cos(th)*rm, ez = S.cz + Math.sin(th)*rm, ey = W.__spiralH(s, ex, ez, S.y0 + (j + 1)/3) - GY + 1.12;
        const fx = -Math.sin(th), fz = Math.cos(th), pitch = 0.2;
        for(const p of pieces){ const cx = Math.max(p[3], Math.min(p[4], ex)), cy = Math.max(p[5], Math.min(p[6], ey)), cz = Math.max(p[7], Math.min(p[8], ez));
          const vx = p[0] - ex, vy = p[1] - ey, vz = p[2] - ez, L = Math.hypot(vx, vy, vz); if(L > 4) continue;
          const hz = Math.atan2(vx*(-fz) + vz*fx, vx*fx + vz*fz), vt = Math.atan2(vy, Math.hypot(vx, vz)) - pitch;
          if(Math.abs(hz) > PI/6 || Math.abs(vt) > PI/9 || vx*fx + vz*fz <= 0) continue;
          const dd = Math.hypot(cx - ex, cy - ey, cz - ez); if(dd < minD){ minD = dd; at = [s, j]; } } } }
    out.view = {minD:H.f3(minD), at};
    out.width = SP.slice(0, 8).map(S=> H.f3(S.b - S.a)); out.K = [SP[8].a, SP[8].b];
    out.slope = SP.slice(0, 8).map(S=>{ const rm = (S.a + S.b)/2; return H.f3(Math.atan(S.h/(2*PI*rm/S.m))*180/PI); });
    out.odd = W.__castleOddN();
    return out; });
  put({id:'A1', name:'손잡이 — 밧줄 0 · 둥근 나무(휜 호 crail·crailK + 벽으로 꺾은 끝 cbarrel)만 · 조각 가운데 r ∈ [b−0.15, b−0.04](우물 벽을 따라 도는 곡선) · 문 쐐기 안 0 · 탑당 35~70 조각 · 쇠 까치발 ~ 손잡이 틈 ≤ 0.05(옛 0.17 — 줄기 끝 너머 뜬 받침)',
    pass:AB.rope === 0 && AB.keys.every(k=> k === 'cbarrel' || k === 'crail' || k === 'crailK') && !AB.railBad.length && !AB.wedge.length && AB.rail.slice(0, 8).every(n=> n >= 35 && n <= 70) && AB.rail[8] >= 15 && AB.bracket.n >= 80 && AB.bracket.gapMax <= 0.05,
    detail:{rope:AB.rope, keys:AB.keys, rail:AB.rail, bad:AB.railBad.slice(0, 6), wedge:AB.wedge.slice(0, 6), bracket:AB.bracket}});
  put({id:'A3', name:'손잡이 매끈한 곡선 — 20° 나선 호 관을 맞대 이음(끝 단면 1mm 안 · 꺾임 0) · 한 줄기 한 색(이음매 색 띠 0) · 세 나무색 그대로(횃불 곁 계단식 색 튐 0) · 줄기 끝 = 이음 없는 끝 둘씩',
    pass:AB.joint.arcs > 300 && AB.joint.colJump === 0 && AB.joint.colOut === 0 && AB.joint.joints + AB.joint.ends === AB.joint.arcs && AB.joint.joints > AB.joint.arcs*0.7, detail:AB.joint});
  put({id:'A2', name:'1인칭 시야 — 걸음선 36 자리 × 오르는 쪽 시선 원뿔(±30°·±20°) 안 손잡이까지 ≥ 0.8(눈앞을 가로지르는 막대 없음)', pass:AB.view.minD >= 0.8, detail:AB.view});
  put({id:'B1', name:'나선 폭 — 탑 여덟 디딤 폭 b − a ≥ 2.1(옛 1.40) · 걸음선 기울기 ≤ 24°(옛 30°) · K 그대로 · castleOddN 0', pass:AB.width.every(w=> w >= 2.1) && AB.slope.every(a=> a <= 24) && AB.K[0] === 0.4 && AB.K[1] === 1.8 && AB.odd === 0,
    detail:{width:AB.width, slope:AB.slope, K:AB.K, odd:AB.odd}});

  /* ═══ B2 아이 손 셋 × 탑 여덟 — 1층 → 망루(12) → 1층 ═══ */
  const B2 = await page.evaluate(()=>{ const W = window, H = W.__t70, PL = W.__PL, K = W.__KEY, GY = W.__GY;
    for(let i=0; i<5; i++){ W.__SECRET_OPEN[i] = 0; const b = W.__CPLAN.secrets[i].box; if(b) b.off = false; }
    const kid = (i, toY, om, lag, maxT)=>{ const S = W.__SPIRALS[i], up = GY + toY > PL.y, hist = []; H.keys({w:true}); let t = 0, lm = 0, px = PL.x, pz = PL.z, py = PL.y, stalls = 0, maxStall = 0, wall = 0, wallC = 0, inC = 0, jerk = 0; const cp = [];
      const done = ()=> up ? PL.y - GY >= toY - 0.02 : PL.y - GY <= toY + 0.02;
      while(t < maxT && !done()){ const dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz); let want;
        if(r > S.b - 0.02) want = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z));
        else { const th = Math.atan2(dz, dx) + (up ? 0.45 : -1.0), rr = (S.a + S.b)/2 + 0.1; want = Math.atan2(-(S.cx + Math.cos(th)*rr - PL.x), -(S.cz + Math.sin(th)*rr - PL.z)); }
        hist.push(want); const w = hist[Math.max(0, hist.length - 1 - Math.round(lag*60))]; let d = w - PL.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); PL.yaw += Math.max(-om/60, Math.min(om/60, d));
        K.w = Math.abs(d) < 1.6; W.__updPlayer(1/60); t += 1/60;
        const r2 = Math.hypot(PL.x - S.cx, PL.z - S.cz); if(r2 < S.b + 0.05){ inC++; if(r2 >= S.b - PL.R - 0.03) wall++; if(r2 >= S.b - PL.R*Math.SQRT2 - 0.03) wallC++; }   // 70차 4회차 — wallC: 몸 한계 원(b − R√2) 곁(기록 — 옛 wall 은 원 조임 뒤 구조상 0)
        { const c = W.__cam.position; cp.push(c.x, c.z); const n = cp.length; if(n >= 6 && Math.hypot(cp[n-2] - 2*cp[n-4] + cp[n-6], cp[n-1] - 2*cp[n-3] + cp[n-5]) > 0.03) jerk++; }   // 70차 4회차 — 1인칭 화면 좌우 떨림(카메라 xz 2차 차분 > 0.03)
        if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t; } else if(t - lm > maxStall) maxStall = t - lm;
        if(t - lm > 1 && t - lm - 1/60 <= 1) stalls++; }
      H.keys(); return {ok:done(), t:H.f3(t), stalls, maxStall:H.f3(maxStall), wallPct:H.f3(wall/Math.max(1, inC)*100), wallCPct:H.f3(wallC/Math.max(1, inC)*100), jerkPct:H.f3(jerk/Math.max(1, cp.length/2)*100)}; };
    const out = [];
    for(let i=0; i<8; i++) for(const [nm, om, lag] of [['숙련', 6, 0.15], ['보통', 5, 0.2], ['서툰', 3, 0.35]]){
      const S = W.__SPIRALS[i], d = H.xf(i, 37, -52.2); H.place(d[0], 0, d[1]); PL.yaw = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z));
      const a = kid(i, 12, om, lag, 20), b = a.ok ? kid(i, 0, om, lag, 20) : {ok:false};
      out.push([W.__CPLAN.towers[i].id, nm, a, b]); }
    return out; });
  const b2bad = B2.filter(([, nm, a, b])=> !(a.ok && b.ok && a.stalls === 0 && b.stalls === 0 && (nm !== '서툰' || (a.t <= 12 && b.t <= 12)) && Math.max(a.wallPct, b.wallPct) <= (nm === '서툰' ? 8 : 3)
    && Math.max(a.jerkPct, b.jerkPct) <= (nm === '서툰' ? 5 : 2.5)));
  const b2sum = {}; for(const [, nm, a, b] of B2){ const q = b2sum[nm] || (b2sum[nm] = {up:0, dn:0, wall:0, wallC:0, jerk:0, n:0}); q.up = Math.max(q.up, a.t); q.dn = Math.max(q.dn || 0, b.t || 0); q.wall = Math.max(q.wall, a.wallPct, b.wallPct || 0); q.jerk = Math.max(q.jerk, a.jerkPct, b.jerkPct || 0); q.wallC = Math.max(q.wallC, a.wallCPct, b.wallCPct || 0); q.n++; }
  put({id:'B2', name:'아이 손 셋(숙련 ω6·보통 ω5·서툰 ω3/지연 .35) × 탑 여덟 1→12→1 — 끝까지 · 멈춤(1초) 0 · 서툰 손 ≤ 12초 · 벽 비빔 ≤ 3%(서툰 손 8% — 늦게 돌아 바깥으로 흐른다)(옛: 숙련 5.1%·보통 5.8% · 서툰 손 30초 못 오름) · 70차 4회차: 1인칭 좌우 떨림(카메라 xz 2차 차분 > 0.03) ≤ 2.5%(서툰 손 5%)(3회차 서툰 손 15.4·17.4%)', pass:!b2bad.length, detail:{worst:b2sum, bad:b2bad.slice(0, 4)}});

  /* ═══ C 낮은 턱 · 뛰어내리기 · 조준 ═══ */
  const Cr = await page.evaluate(()=>{ const W = window, H = W.__t70, PL = W.__PL, K = W.__KEY, GY = W.__GY, CW = W.__CW, CP = W.__CPLAN, THREE = W.__THREE;
    const out = {};
    const jumpH = W.__JUMPV*W.__JUMPV/(2*W.__GRAVV); out.curb = {h:CW.CURB, jumpH:H.f3(jumpH)};
    /* 회랑 안쪽 끝(조임 lo 49.72)·곧은 벽 안쪽 끝(t 49.73) 자리 — 마을 쪽을 본다 */
    const galPts = [], strPts = [];
    for(const G of CP.galleries){ const L = Math.hypot(G.b.x - G.a.x, G.b.z - G.a.z);
      for(const u of [0.3, 0.5, 0.7]){ const cx = G.a.x + (G.b.x - G.a.x)*u, cz = G.a.z + (G.b.z - G.a.z)*u, e0 = (Math.abs(cx) + Math.abs(cz))*0.6, m = (e0 - 49.74)/(Math.SQRT2*0.6);
        galPts.push({x:cx - G.N.x*m, z:cz - G.N.z*m, yaw:Math.atan2(G.N.x, G.N.z), id:G.id + u}); } }
    for(const S of CP.straights){ if(!S.corr) continue; const g = S.g, P = 22*S.s, D = W.__DIRS[g]; strPts.push({x:W.__gX(g, 49.75, P), z:W.__gZ(g, 49.75, P), yaw:Math.atan2(D.dx, D.dz), id:S.id}); }
    /* C1 — 든 총(용의 숨결) 조각 상자 가장 낮은 곳 − 턱 갓돌 윗면(8 + 0.32 + 0.08) · 손은 층 2(장면 뒤 따로 그림) */
    const WP = W.__WEAPONS, idx = WP.findIndex(x=> x.n === '용의 숨결'); W.__KIT.ownW[idx] = true; W.__equipWeapon(idx); W.__setAim(true, true);
    const box = new THREE.Box3(), bb = new THREE.Box3();
    const heldMin = ()=>{ const Hd = W.__held; W.__cam.updateMatrixWorld(true); Hd.updateMatrixWorld(true); box.makeEmpty(); let l0 = 0, l2 = 0;
      Hd.traverse(o=>{ if(!o.isMesh || !o.visible) return; let v = o, vis = true; while(v && v !== Hd){ if(!v.visible) vis = false; v = v.parent; } if(!vis) return;
        if(o.layers.isEnabled(0)) l0++; if(o.layers.isEnabled(2)) l2++;
        if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(bb); }); return {min:box.min.y - GY, l0, l2}; };
    out.C1 = [];
    for(const p of [...galPts.filter((_, i)=> i % 3 === 1), ...strPts.slice(0, 4)]) for(const pitch of [0, -0.3, -0.5]){
      H.place(p.x, 8, p.z, p.yaw, pitch); W.__camZoom(0); for(let i=0; i<40; i++) W.__updPlayer(1/60); PL.pitch = pitch; W.__updPlayer(1/60);
      const m = heldMin(); out.C1.push([p.id, pitch, H.f3(m.min - (8 + CW.CURB + 0.08)), m.l0, m.l2]); }
    W.__setAim(false, true); W.__camZoom(3.2);
    /* C7 — 층 2(heldPass)는 손 모형(held) 자손에만. 진열 총(상점·대장간 — 손 모형 복제)은 층 0(본 그림)에 · 층 2 0 */
    { W.__drawNPCs(1); const Hd = W.__held, D = W.__DISP(); let dm = 0, d0 = 0, d2 = 0, stray = 0;
      for(const q of D) q.m.traverse(o=>{ if(!o.isMesh) return; dm++; if(o.layers.isEnabled(0)) d0++; if(o.layers.isEnabled(2)) d2++; });
      W.__scene.traverse(o=>{ if(!(o.isMesh || o.isLine || o.isPoints || o.isSprite) || !o.layers.isEnabled(2)) return; let v = o; while(v && v !== Hd) v = v.parent; if(!v) stray++; });
      out.C7 = {disp:D.length, meshes:dm, l0:d0, l2:d2, stray}; }
    /* C2 — 안쪽 끝에서 마을 쪽으로 W + 한 번 뛰기 → 둘레길(y 0) · 다침 0 · 끼임 0 · 착지 0.7초 뒤 자동 1인칭 풀림 */
    out.C2 = [];
    for(const p of [...galPts, ...strPts.slice(0, 2)]){ H.place(p.x, 8, p.z, p.yaw, -0.1); W.__camZoom(3.2); for(let i=0; i<30; i++) W.__updPlayer(1/60);
      const hp0 = PL.hp; H.keys({w:true}); W.__wantJump(); let t = 0, landT = -1, auto = 1;
      while(t < 2.5){ W.__updPlayer(1/60); t += 1/60; if(landT < 0 && PL.ground && PL.y < GY + 0.5) landT = t; if(landT >= 0 && t > landT + 0.2) H.keys(); if(landT >= 0 && t >= landT + 0.7){ auto = W.__camAuto(); break; } }
      H.keys(); out.C2.push({id:p.id, landT:H.f3(landT), y:H.f3(PL.y - GY), od:H.f3(W.__oct(PL.x, PL.z)), hurt:hp0 - PL.hp, auto:H.f3(auto)}); }
    /* C3 — 턱 쪽으로 걷기·달리기 5초(10°·30°·90°) → y 8 그대로 · 떨어짐 0 */
    out.C3 = [];
    for(const p of [...galPts.filter((_, i)=> i % 3 === 1), ...strPts.slice(0, 2)]) for(const a of [10, 30, 90]) for(const run of [false, true]){
      H.place(p.x, 8, p.z, p.yaw, -0.1); PL.yaw = p.yaw + (a - 90)*Math.PI/180; W.__setStamina(1); H.keys({w:true, shift:run}); let minY = 99;
      for(let i=0; i<300; i++){ W.__updPlayer(1/60); minY = Math.min(minY, PL.y - GY); }
      H.keys(); out.C3.push([p.id, a, run ? 1 : 0, H.f3(minY)]); }
    /* C4 — 회랑 안쪽 끝 눈(쏘는 자리)에서 마을 쪽 좀비(od 45·42·38·34 · 가슴 0.85) — 아래로 ≤ 50° 선 막힘 0(옛 흉벽 0.85 는 38° 넘게 숙이면 막혔다) · 바깥 돌벽 너머(해자 쪽) 낮은 선은 여전히 막힘 */
    const gpSave = (W.__GPOST || []).splice(0);                                   // C4 는 턱·흉벽만(기둥은 아래 C6 에서 따로 잰다)
    let n4 = 0, blk = 0, n4o = 0, blkO = 0; const ex4 = [];
    for(const p of galPts){ H.place(p.x, 8, p.z, p.yaw, -0.1); const eye = [PL.x, PL.y + 1.12, PL.z];
      for(let q=-3; q<=3; q++){ const G = CP.galleries[Math.floor(galPts.indexOf(p)/3)], ux = G.U.x, uz = G.U.z;   // 옆으로 ±2.4(탑 몸에 막히는 두 끝은 빼고)
        for(const od of [45, 42, 38, 34]){ const m = (((Math.abs(p.x) + Math.abs(p.z))*0.6) - od)/(Math.SQRT2*0.6), tx = p.x - G.N.x*m + ux*q*0.8, tz = p.z - G.N.z*m + uz*q*0.8, ty = GY + 0.85;
          const hd = Math.hypot(tx - eye[0], tz - eye[2]), ang = Math.atan2(eye[1] - ty, hd)*180/Math.PI; if(ang > 50) continue; n4++;
          if(W.__castleOccluded(eye[0], eye[1], eye[2], tx, ty, tz)){ blk++; if(ex4.length < 5) ex4.push([p.id, q, od, H.f3(ang)]); } }
        const mo = -3.2/(Math.SQRT2*0.6)*0 - 3.6, ox = p.x + G.N.x*3.6 + ux*q*0.8, oz = p.z + G.N.z*3.6 + uz*q*0.8; n4o++;
        if(W.__castleOccluded(eye[0], eye[1], eye[2], ox, GY + 2.5, oz)) blkO++; } }
    if(W.__GPOST) W.__GPOST.push(...gpSave);
    out.C4 = {n:n4, blocked:blk, ex:ex4, outer:n4o, outerBlocked:blkO};
    /* C6 — 회랑 기둥(고침: 0.22 · 3.0 박자 · 턱 마을 쪽 끝 · 몸 상자 · 가림 GPOST): ① 안쪽 끝(e 49.74)을 0.25 마다 걸어 가며 눈 → 마을(od 40·가슴) 조준점 가림 비율
       ② 기둥 바로 뒤(0.3 좌우 · 0.9 뒤)에서 W + 뛰기 → 몸 가운데 ~ 기둥 가운데 최소 거리 ≥ 기둥 반폭 + 몸 반지름 − 0.05 · 착지 둘레길 */
    { const GP = W.__GPOST || []; let nA = 0, bA = 0; const jumps = [];
      for(const G of CP.galleries){ const L = Math.hypot(G.b.x - G.a.x, G.b.z - G.a.z);
        for(let u = 2.5; u <= L - 2.5; u += 0.25){ const cx = G.a.x + (G.b.x - G.a.x)*u/L, cz = G.a.z + (G.b.z - G.a.z)*u/L, e0 = (Math.abs(cx) + Math.abs(cz))*0.6, m = (e0 - 49.74)/(Math.SQRT2*0.6);
          const x = cx - G.N.x*m, z = cz - G.N.z*m, m2 = (49.74 - 40)/(Math.SQRT2*0.6); H.place(x, 8, z, Math.atan2(G.N.x, G.N.z), -0.1); nA++;
          if(W.__castleOccluded(PL.x, PL.y + 1.12, PL.z, x - G.N.x*m2, GY + 0.85, z - G.N.z*m2)) bA++; } }
      for(let q=0; q<GP.length && jumps.length < 12; q += 5*4){ const px = GP[q], pz = GP[q+1], G = CP.galleries.reduce((a, g)=> Math.hypot(g.a.x + g.b.x - 2*px, g.a.z + g.b.z - 2*pz) < Math.hypot(a.a.x + a.b.x - 2*px, a.a.z + a.b.z - 2*pz) ? g : a);
        for(const lat of [-0.12, 0.12]){ const x = px - G.N.x*0.9 + G.U.x*lat, z = pz - G.N.z*0.9 + G.U.z*lat; H.place(x, 8, z, Math.atan2(G.N.x, G.N.z), -0.1); W.__camZoom(0); for(let i=0; i<20; i++) W.__updPlayer(1/60);
          H.keys({w:true}); W.__wantJump(); let t = 0, dmin = 99, landT = -1; const hp0 = PL.hp;
          while(t < 2.5){ W.__updPlayer(1/60); t += 1/60; if(PL.y - GY > 8.2 && PL.y - GY < 10) dmin = Math.min(dmin, Math.hypot(PL.x - px, PL.z - pz)); if(landT < 0 && PL.ground && PL.y < GY + 0.5){ landT = t; break; } }
          H.keys(); jumps.push({lat, dmin:H.f3(dmin), landT:H.f3(landT), hurt:hp0 - PL.hp}); } }
      W.__camZoom(3.2);
      /* 70차 4회차 — 회랑 한가운데(±0.5 · 선생님 8번 사진 자리)에서 마을 정면(시선 0 · −0.3)으로 겨눈 조준점(15 앞) 가림 0(3회차는 가운데 기둥이 정면을 막았다) */
      let nM = 0, bM = 0; const exM = [];
      for(const G of CP.galleries){ const L = Math.hypot(G.b.x - G.a.x, G.b.z - G.a.z);
        for(const du of [-0.5, -0.25, 0, 0.25, 0.5]){ const u = L/2 + du, cx = G.a.x + (G.b.x - G.a.x)*u/L, cz = G.a.z + (G.b.z - G.a.z)*u/L, e0 = (Math.abs(cx) + Math.abs(cz))*0.6, m = (e0 - 49.74)/(Math.SQRT2*0.6);
          const x = cx - G.N.x*m, z = cz - G.N.z*m;
          for(const pt of [0, -0.3]){ H.place(x, 8, z, Math.atan2(G.N.x, G.N.z), pt); const ey = PL.y + 1.12, dx = -G.N.x*Math.cos(pt), dz = -G.N.z*Math.cos(pt), dy = Math.sin(pt); nM++;
            if(W.__castleOccluded(PL.x, ey, PL.z, PL.x + dx*15, ey + dy*15, PL.z + dz*15)){ bM++; if(exM.length < 4) exM.push([G.id, du, pt]); } } } }
      out.C6 = {posts:GP.length/5, frac:H.f3(bA/Math.max(1, nA)), n:nA, jumps, mid:{n:nM, blocked:bM, ex:exM}}; }
    /* C8 — 70차 4회차: 회랑 끝(탑 곁) 쐐기. 회랑 가운데에서 탑 쪽으로 W 만(걷기·달리기) — 마을 쪽 절반(e 49.74·50.1)도 5초 안에 탑 문으로(3회차 32/32 모서리에 멈춤) ·
       그 모서리에서 탑 쪽으로 한 번 뛴 뒤 걸어서 8방향 중 나갈 수 있는 방향 ≥ 4(3회차 0 — 8방향 0칸 갇힘) */
    { const bad = [], esc = []; let n = 0;
      for(const G of CP.galleries) for(const toward of ['a', 'b']) for(const e of [49.74, 50.1, 50.6, 51.5, 51.9]) for(const run of [false, true]){
        const cx = (G.a.x + G.b.x)/2, cz = (G.a.z + G.b.z)/2, e0 = (Math.abs(cx) + Math.abs(cz))*0.6, m = (e0 - e)/(Math.SQRT2*0.6), x = cx - G.N.x*m, z = cz - G.N.z*m;
        const U = toward === 'b' ? G.U : {x:-G.U.x, z:-G.U.z}; H.place(x, 8, z, Math.atan2(-U.x, -U.z), -0.1); H.keys({w:true, shift:run}); let t = 0, inT = false; n++;
        while(t < 5 && !inT){ W.__setStamina(1); W.__updPlayer(1/60); t += 1/60; inT = W.__galleryAt(PL.x, PL.z) < 0 && Math.hypot(PL.x - G[toward].x, PL.z - G[toward].z) < 3 && Math.abs(PL.y - GY - 8) < 0.6; }
        H.keys(); if(!inT) bad.push([G.id, toward, e, run ? 1 : 0, H.f3(PL.x), H.f3(PL.z)]); }
      for(let i=0; i<8; i++){ const p = H.xf(i, 34.143, -48.72), f = H.xf(i, -0.996, -0.089); H.place(p[0], 8, p[1], Math.atan2(-f[0], -f[1]), -0.1);
        H.keys({w:true}); W.__wantJump(); for(let k=0; k<50; k++) W.__updPlayer(1/60); H.keys();
        const sx = PL.x, sz = PL.z, sy = PL.y; let ok = 0;
        for(let d=0; d<8; d++){ Object.assign(PL, {x:sx, z:sz, y:sy, vx:0, vz:0, vy:0, ground:true}); PL.yaw = d*Math.PI/4; H.keys({w:true}); for(let k=0; k<40; k++) W.__updPlayer(1/60); H.keys(); if(Math.hypot(PL.x - sx, PL.z - sz) > 0.3) ok++; }
        esc.push(ok); }
      out.C8 = {n, bad, esc}; }
    /* C5 — 좀비 구역·계단 가지 그대로(ZONE 칸 수 · 구역마다 계단) */
    let zc = 0; for(let i=0; i<W.__ZONE.length; i++) if(W.__ZONE[i] >= 0) zc++;
    out.C5 = {zone:zc, stairs:CP.zones.map(Z=> Z.stairs.join(','))};
    return out; });
  const c1bad = Cr.C1.filter(r=> r[3] !== 0 || r[4] === 0 || (r[1] === 0 && r[2] < 0));
  put({id:'C1', name:'든 총 — 1인칭 손은 층 2 에만(장면을 그린 뒤 깊이를 지우고 따로 그림 — 턱·흉벽·문설 어디에도 안 묻힘) · 안쪽 끝 앞을 볼 때(시선 0) 총 아랫면이 턱 갓돌 위', pass:!c1bad.length,
    detail:{curb:Cr.curb, bad:c1bad.slice(0, 6), min:Math.min(...Cr.C1.map(r=> r[2])), all:Cr.C1.map(r=> r[2]).slice(0, 12)}});
  put({id:'C7', name:'진열 총 층 — 상점·대장간 진열 총 조각 모두 층 0 · 층 2 0 · 장면에서 층 2 는 손 모형(held) 자손뿐(옛: 진열 59 조각이 층 1+2 — 3인칭엔 사라지고 1인칭엔 벽 위에 떠 그려짐)',
    pass:Cr.C7.disp >= 10 && Cr.C7.meshes > 0 && Cr.C7.l0 === Cr.C7.meshes && Cr.C7.l2 === 0 && Cr.C7.stray === 0, detail:Cr.C7});
  const c2bad = Cr.C2.filter(r=> !(r.landT > 0 && r.landT <= 1.5 && Math.abs(r.y) < 0.05 && r.od < 49.05 && r.hurt === 0 && r.auto < 0.02));
  put({id:'C2', name:'뛰어내리기 — 안쪽 끝에서 W + 한 번 뛰면 1.5초 안 둘레길(y 0) · 다침 0 · 끼임 0 · 착지 0.7초 뒤 3인칭(회랑 넷 × 3 · 곧은 벽 둘) — 턱 0.32 < 뜀 ' + Cr.curb.jumpH, pass:!c2bad.length && Cr.curb.h < Cr.curb.jumpH,
    detail:{bad:c2bad.slice(0, 4), landT:Cr.C2.map(r=> r.landT)}});
  const c3bad = Cr.C3.filter(r=> r[3] < 7.99);
  put({id:'C3', name:'걸어선 안 떨어짐 — 턱 쪽으로 걷기·달리기 5초(10°·30°·90°) y 8 그대로', pass:!c3bad.length, detail:{bad:c3bad.slice(0, 6), n:Cr.C3.length}});
  put({id:'C4', name:'마을 쪽 조준 — 회랑 안쪽 끝 눈에서 마을 쪽 좀비(아래로 ≤ 50°) 턱·흉벽 가림 0(기둥에 걸린 선은 C6) · 바깥 돌벽 너머 낮은 선은 가림 그대로', pass:Cr.C4.blocked === 0 && Cr.C4.n > 100 && Cr.C4.outerBlocked === Cr.C4.outer, detail:Cr.C4});
  put({id:'C6', name:'회랑 기둥 — 24개(0.22 · 3.0 박자 · 70차 4회차: 가운데를 비우고 GM ± 1.5 + 3k) · 안쪽 끝을 따라 걸으며 조준점 가림 ≤ 10%(옛 0.3 · 2.0 박자 15% — 보이는 기둥 = 맞는 가림) · 회랑 한가운데 ±0.5 마을 정면(시선 0·−0.3) 가림 0(3회차: 가운데 기둥이 정면을 막음) · 기둥 바로 뒤에서 뛰어도 몸이 기둥을 안 지남(가운데 거리 ≥ 0.36) · 둘레길 착지 · 다침 0',
    pass:Cr.C6.posts === 24 && Cr.C6.mid.n === 40 && Cr.C6.mid.blocked === 0 && Cr.C6.frac <= 0.10 && Cr.C6.n > 200 && Cr.C6.jumps.length >= 8 && Cr.C6.jumps.every(j=> j.dmin >= 0.36 && j.landT > 0 && j.hurt === 0), detail:Cr.C6});
  put({id:'C8', name:'회랑 끝 쐐기 — 회랑 가운데에서 탑 쪽으로 W 만(e 49.74~51.9 · 걷기·달리기 · 회랑 넷 × 양끝) 5초 안에 모두 탑 문 안(3회차 마을 쪽 절반 32/32 모서리에 멈춤) · 모서리에서 뛴 뒤 걸어서 나갈 방향 ≥ 4/8(3회차 0)',
    pass:Cr.C8.n === 80 && !Cr.C8.bad.length && Cr.C8.esc.length === 8 && Cr.C8.esc.every(v=> v >= 4), detail:Cr.C8});
  put({id:'C5', name:'좀비 새 길 없음 — ZONE 칸 수 1428(69·70차 1회차와 같음)·구역마다 계단 가지 그대로(턱은 좀비 구역 밖)', pass:Cr.C5.zone === 1428 && Cr.C5.stairs.join('|') === '0,1|2,3|4,5,6,7|8,9', detail:Cr.C5});

  /* ═══ E 계단 몸 ═══ */
  const E = await page.evaluate(()=>{ const W = window, H = W.__t70, PL = W.__PL, K = W.__KEY, GY = W.__GY, ST = W.__STAIRS, V = W.__PLV;
    const gX = W.__gX, gZ = W.__gZ, out = {gate:[], spiral:[], stop:[], cad:{}};
    const a2of = (ys)=>{ let a = 0; for(let i=2; i<ys.length; i++) a = Math.max(a, Math.abs(ys[i] - 2*ys[i-1] + ys[i-2])); return a; };
    const rec = (tx, tz, until, run, maxT)=>{ const ys = [], dv = []; let t = 0, g0 = W.__gaitMe(), stairT = 0, gs = 0, dv0 = 0; H.keys({w:true, shift:!!run});
      while(t < maxT){ PL.yaw = Math.atan2(-(tx - PL.x), -(tz - PL.z)); W.__setStamina(1); const gb = W.__gaitMe(); W.__updPlayer(1/60); t += 1/60; ys.push(V.y); dv.push(t > 0.5 ? Math.abs(V.y - PL.y) : 0); dv0 = Math.max(dv0, Math.abs(V.y - PL.y));
        if(Math.abs(V.st) > 0.35){ stairT += 1/60; gs += W.__gaitMe() - gb; } if(until()) break; }
      H.keys(); return {a2:H.f3(a2of(ys)), dmax:H.f3(Math.max(...dv)), d0:H.f3(dv0), t:H.f3(t), cad:stairT > 0.5 ? H.f3(gs/(2*Math.PI)/stairT) : null}; };
    for(let k=0; k<ST.length; k++){ const g = ST[k].g, s = (k % 2) ? 1 : -1;
      for(const run of [false, true]){
        H.place(gX(g, 32.5, 8.5*s), 0, gZ(g, 32.5, 8.5*s), 0); const up = rec(gX(g, 47.8, 8.5*s), gZ(g, 47.8, 8.5*s), ()=> W.__gT(g, PL.x, PL.z) > 47.4, run, 8);
        H.place(gX(g, 47.6, 8.5*s), 8, gZ(g, 47.6, 8.5*s), 0); const dn = rec(gX(g, 32.4, 8.5*s), gZ(g, 32.4, 8.5*s), ()=> W.__gT(g, PL.x, PL.z) < 32.8, run, 8);
        out.gate.push([k, run ? 1 : 0, up, dn]); } }
    for(const i of [0, 3, 8]){ const S = W.__SPIRALS[i];
      const aim = (up)=>{ const dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz); if(r > S.b - 0.02){ PL.yaw = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z)); return; }
        const th = Math.atan2(dz, dx) + (up ? 0.45 : -0.45), ra = (S.a + S.b)/2 + 0.1; PL.yaw = Math.atan2(-(S.cx + Math.cos(th)*ra - PL.x), -(S.cz + Math.sin(th)*ra - PL.z)); };
      const run = (up, maxT)=>{ const ys = [], dv = []; let t = 0, fr = 0, stairT = 0, gs = 0, dv0 = 0; H.keys({w:true}); const done = ()=> up ? PL.y > S.y0 + S.Ht*S.turns - 0.1 : PL.y < S.y0 + 0.1;
        while(t < maxT && !done()){ if(fr % 15 === 0) aim(up); const gb = W.__gaitMe(); W.__updPlayer(1/60); t += 1/60; fr++; ys.push(V.y); dv.push(t > 0.5 ? Math.abs(V.y - PL.y) : 0); dv0 = Math.max(dv0, Math.abs(V.y - PL.y)); if(Math.abs(V.st) > 0.3){ stairT += 1/60; gs += W.__gaitMe() - gb; } }
        H.keys(); return {a2:H.f3(a2of(ys)), dmax:H.f3(Math.max(...dv)), d0:H.f3(dv0), t:H.f3(t), ok:done(), cad:stairT > 0.5 ? H.f3(gs/(2*Math.PI)/stairT) : null}; };
      if(i === 8) H.place(0, 8, 53.8, 0); else { const d = H.xf(i, 37, -52.2); H.place(d[0], 0, d[1], 0); }
      const up = run(true, 12), dn = run(false, 12); out.spiral.push([i, up, dn]); }
    /* E2 — 계단 가운데서 멈춘 뒤 0.3초에 보이는 몸 = 충돌 몸(±0.01) · 뛰는 동안 = 충돌 몸 */
    for(const k of [2, 5]){ const g = ST[k].g, s = (k % 2) ? 1 : -1; H.place(gX(g, 36, 8.5*s), 1.3, gZ(g, 36, 8.5*s), 0); H.keys({w:true});
      PL.yaw = Math.atan2(-(gX(g, 47, 8.5*s) - PL.x), -(gZ(g, 47, 8.5*s) - PL.z)); for(let i=0; i<60; i++) W.__updPlayer(1/60); H.keys(); for(let i=0; i<18; i++) W.__updPlayer(1/60);
      const stopD = Math.abs(V.y - PL.y); W.__wantJump(); let jmax = 0; for(let i=0; i<30; i++){ W.__updPlayer(1/60); if(!PL.ground) jmax = Math.max(jmax, Math.abs(V.y - PL.y)); }
      for(let i=0; i<60; i++) W.__updPlayer(1/60); out.stop.push([k, H.f3(stopD), H.f3(jmax)]); }
    /* E1b — 성문 계단을 W 로 오르다 뛰기(0.35~0.75초 다섯 때 × 계단 둘): 공중·뜨고 내리는 프레임의 '보이는 몸 속도 − 충돌 몸 속도' 최대(옛 0.056~0.159 — 뜰 때 경사 몸 → PL.y 로 툭, 내릴 때 0.1 내려앉음) */
    out.jump = [];
    for(const k of [2, 5]){ const g = ST[k].g, s = (k % 2) ? 1 : -1, tx = gX(g, 47.8, 8.5*s), tz = gZ(g, 47.8, 8.5*s);
      for(const tj of [0.35, 0.45, 0.55, 0.65, 0.75]){ H.place(gX(g, 32.5, 8.5*s), 0, gZ(g, 32.5, 8.5*s), 0); H.keys({w:true}); let t = 0, ex = 0, jumped = false, pv = V.y, pp = PL.y, pa = !PL.ground;
        while(t < 1.8){ PL.yaw = Math.atan2(-(tx - PL.x), -(tz - PL.z)); if(!jumped && t >= tj){ W.__wantJump(); jumped = true; } W.__updPlayer(1/60); t += 1/60;
          const air = !PL.ground; if(air || pa) ex = Math.max(ex, Math.abs((V.y - pv) - (PL.y - pp))); pv = V.y; pp = PL.y; pa = air; }
        H.keys(); out.jump.push([k, tj, H.f3(ex)]); } }
    /* E3 — 평지 걸음 박자 */
    H.place(8, 0, 20, 0); H.keys({w:true}); const g0 = W.__gaitMe(); for(let i=0; i<120; i++) W.__updPlayer(1/60); out.cad.flat = H.f3((W.__gaitMe() - g0)/(2*Math.PI)/2); H.keys();
    /* E4 — 친구 흉내: 성문 계단을 걸어 오르는 나(60Hz)를 6Hz 로 보내고(소수 둘째 자리) 친구 쪽 friendSeg/friendLerp 로 60Hz 보간 → 수평 속도 최대/최소 · y 2차 차분 · 공중 깜빡 */
    { const g = ST[2].g, s = -1; H.place(gX(g, 32.5, 8.5*s), 0, gZ(g, 32.5, 8.5*s), 0); const tx = gX(g, 47.8, 8.5*s), tz = gZ(g, 47.8, 8.5*s); H.keys({w:true});
      const p = {x:PL.x, y:PL.y, z:PL.z}; let t = 0, net = 0, px = p.x, pz = p.z; const sp = [], ys = [], air = [];
      while(t < 4){ PL.yaw = Math.atan2(-(tx - PL.x), -(tz - PL.z)); W.__updPlayer(1/60); t += 1/60; net -= 1/60;
        if(net <= 0){ net += 1/6; W.__friendSeg(p, +PL.x.toFixed(2), +PL.y.toFixed(2), +PL.z.toFixed(2), t); }
        W.__friendLerp(p, t); sp.push(Math.hypot(p.x - px, p.z - pz)*60); px = p.x; pz = p.z; ys.push(p.y);
        air.push((p.y - Math.max(W.__groundUnder(p.x, p.z, 0.28, p.y), p.rp === null || p.rp === undefined ? -999 : p.rp - 0.25)) > 0.4 ? 1 : 0);
        if(Math.hypot(PL.x - tx, PL.z - tz) < 0.3) break; }
      H.keys(); const mid = sp.slice(40, sp.length - 40); let flips = 0; for(let i=1; i<air.length; i++) if(air[i] !== air[i-1]) flips++;
      out.friend = {spMin:H.f3(Math.min(...mid)), spMax:H.f3(Math.max(...mid)), ratio:H.f3(Math.max(...mid)/Math.max(0.01, Math.min(...mid))), a2:H.f3(a2of(ys.slice(20, ys.length - 20))), airFrames:air.reduce((a, b)=> a + b, 0), flips}; }
    /* E4b — 친구가 멈춘 뒤·뛰어내린 뒤(받는 쪽 규칙 그대로: 값이 같으면 새 토막 없음): 멈춘 뒤 0.5초 보이는 자리 = 받은 자리(±0.01) · 착지 뒤 보이는 y ≥ 받은 y − 0.01(땅속 0) */
    { const run = (traj)=>{ const p = {}; let t = 0, net = 0, last = null, stopT = null, worstAfter = 0, sink = 0; const f2 = (v)=> +v.toFixed(2);
        for(let i=0; i<150; i++){ t += 1/60; net -= 1/60; const q = traj(t);
          if(net <= 0){ net += 1/6; const d = {x:f2(q.x), y:f2(q.y), z:f2(q.z)}; if(p.t0 === undefined || p.bx !== d.x || p.bz !== d.z || p.by !== d.y) W.__friendSeg(p, d.x, d.y, d.z, t); last = d; }
          W.__friendLerp(p, t); if(q.stop && stopT === null) stopT = t; if(last && q.stop) sink = Math.max(sink, last.y - p.y);
          if(stopT !== null && t >= stopT + 0.5) worstAfter = Math.max(worstAfter, Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z)); }
        return {after:H.f3(worstAfter), sink:H.f3(sink)}; };
      const worst = (rs)=> ({after:Math.max(...rs.map(r=> r.after)), sink:Math.max(...rs.map(r=> r.sink))});
      const walk = worst([0.93, 0.98, 1.03, 1.08, 1.13].map(ts=> run((t)=> t < ts ? {x:8 + 4.5*t, y:GY, z:20} : {x:8 + 4.5*ts, y:GY, z:20, stop:true})));
      const fall = worst([[2, 0], [2, 0.07], [4, 0], [4, 0.11], [8, 0.05]].flatMap(([h, t0])=> [26, 36.9].map(gv=> run((t)=>{ const tf = Math.sqrt(2*h/gv), u = t - t0; return u < 0 ? {x:8, y:GY + h, z:20} : u < tf ? {x:8 + 3*u, y:GY + h - 0.5*gv*u*u, z:20} : {x:8 + 3*tf, y:GY, z:20, stop:true}; }))));
      out.friendStop = {walk, fall}; }
    /* E4c — 70차 4회차: 교실 와이파이처럼 도착이 흔들릴 때(파이어베이스는 순서 그대로 — 늦은 꾸러미 뒤는 같이 늦는다) · 경주 대각선 달리기 · 느린 꾸러미.
       60fps 흉내 시계로 30초 · 1초 뒤부터 잰 걸음 방향 속도의 p5/p95 · 뒤로 간 프레임 · 순간이동(한 프레임 > 기대의 2.2배) · 멈칫(중앙값 30% 미만) */
    { let sd = 11; const rnd = ()=>{ sd = (sd*16807) % 2147483647; return (sd - 1)/2147483646; };
      const run = (v, ang, send, jit)=>{ const p = {}, dx = Math.cos(ang), dz = Math.sin(ang), arr = []; let la = 0;
        for(let t=0; t<30; t += send){ const a = Math.max(la, t + jit()); la = a; arr.push([a, +(8 + v*t*dx).toFixed(2), GY, +(20 + v*t*dz).toFixed(2)]); }
        let k = 0, px = null, pz = null, back = 0, tele = 0; const sp = [];
        for(let f=0; f<1800; f++){ const t = f/60;
          while(k < arr.length && arr[k][0] <= t){ const d = arr[k]; if(p.bx !== d[1] || p.bz !== d[3] || p.by !== d[2]) W.__friendSeg(p, d[1], d[2], d[3], t); k++; }
          W.__friendLerp(p, t);
          if(px !== null && t > 1 && t < 29){ const m = (p.x - px)*dx + (p.z - pz)*dz; sp.push(m*60); if(m < -1e-6) back++; if(Math.hypot(p.x - px, p.z - pz) > 2.2*v/60 + 0.05) tele++; }
          px = p.x; pz = p.z; }
        sp.sort((a, b)=> a - b); const med = sp[sp.length >> 1], p5 = sp[Math.floor(sp.length*0.05)], p95 = sp[Math.floor(sp.length*0.95)];
        return {p5:H.f3(p5), p95:H.f3(p95), r:H.f3(p95/Math.max(0.01, p5)), back, tele, stall:sp.filter(x=> x < 0.3*med).length, n:sp.length}; };
      out.friendJit = {
        jit120: run(4.5, 0, 1/6, ()=> rnd()*0.12),
        late30: run(4.5, 0, 1/6, ()=> rnd() < 0.3 ? 0.25 : 0.05),
        jit300: run(4.5, 0, 1/6, ()=> 0.05 + rnd()*0.3),
        race45: run(14.13, Math.PI/4, 1/6, ()=> 0.05),
        race45j: run(14.13, Math.PI/4, 1/6, ()=> rnd()*0.12),
        sprint45slow: run(8.61, Math.PI/4, 1/3, ()=> 0.05) }; }
    /* E5 — 3인칭(줌 3.2)으로 성문 계단을 뒤로(S) 오르기 · 시선 −0.15·−0.5·0·0.2: 당겼다 0.3초 안에 풀었다 다시 당기는 톱니 · 몸 숨김 0.4초 안 깜빡 */
    out.back = [];
    for(const pitch of [-0.15, -0.5, 0, 0.2]){ W.__camZoom(3.2); H.place(33.5, 0, -8.5, Math.PI/2, pitch); H.keys({s:true}); const ds = [], hs = [];
      for(let t=0; t<3 && PL.x < 47.6; t += 1/60){ W.__setStamina(1); PL.pitch = pitch; W.__updPlayer(1/60); const rg = W.__camRig(); if(t >= 0.3){ ds.push(rg.distance); hs.push(rg.hidden); } }   // 옮긴 뒤 0.3초(카메라 자리 잡기)는 빼고
      H.keys(); let saw = 0, blink = 0, lastFlip = -99;
      /* 톱니 = 0.3초(18 프레임) 안에 0.1 넘게 풀렸다가 그 뒤 0.3초 안에 다시 0.1 넘게 당겨짐(옛: 디딤마다 0.59 ↔ 1.0) */
      for(let i=1; i<ds.length; i++) for(let j=Math.max(0, i - 18); j<i; j++) if(ds[i] - ds[j] > 0.1){ let mn = ds[i]; for(let q=i + 1; q<Math.min(ds.length, i + 19); q++) mn = Math.min(mn, ds[q]); if(ds[i] - mn > 0.1){ saw++; i += 18; } break; }
      for(let i=1; i<hs.length; i++) if(hs[i] !== hs[i-1]){ if(i - lastFlip <= 24) blink++; lastFlip = i; }
      out.back.push([pitch, saw, blink]); }
    /* E6 — 70차 4회차: 3인칭으로 성문 계단 열을 앞으로(W) 걸어 내려가기 · 줌 3.2·6 × 시선 −0.05·−0.15·−0.25·−0.4. 3회차는 엉덩이 높이 선이 뒤쪽 디딤에 걸려
       3.2 → 0.83 으로 4프레임에 당겨진 채 머물렀다(1.2 안 64~77% · 한 프레임 당김 1.9 · 카메라 y 2차 차분 0.37 — main 0%·0.009) */
    out.desc = [];
    for(const zoom of [3.2, 6]) for(const pitch of [-0.05, -0.15, -0.25, -0.4]){ let close = 0, n = 0, pull = 0, a2 = 0;
      for(let k=0; k<ST.length; k++){ W.__camZoom(zoom); const g = ST[k].g, s = (k % 2) ? 1 : -1, gX = W.__gX, gZ = W.__gZ;
        H.place(gX(g, 47.6, 8.5*s), 8, gZ(g, 47.6, 8.5*s), 0, pitch); for(let i=0; i<30; i++) W.__updPlayer(1/60);
        const tx = gX(g, 32.4, 8.5*s), tz = gZ(g, 32.4, 8.5*s); H.keys({w:true}); const cy = [], ds = []; let t = 0;
        while(t < 4){ PL.yaw = Math.atan2(-(tx - PL.x), -(tz - PL.z)); PL.pitch = pitch; W.__updPlayer(1/60); t += 1/60; cy.push(W.__cam.position.y); const d = W.__camRig().distance;
          if(ds.length) pull = Math.max(pull, ds[ds.length - 1] - d); ds.push(d); n++; if(d < 1.2) close++; if(W.__gT(g, PL.x, PL.z) < 32.8) break; }
        H.keys(); a2 = Math.max(a2, a2of(cy.slice(5))); }
      out.desc.push({zoom, pitch, closePct:H.f3(close/Math.max(1, n)*100), pull:H.f3(pull), a2:H.f3(a2)}); }
    W.__camZoom(3.2);
    /* E3 — 평지 걸음 박자 */
    return out; });
  const e1g = E.gate.filter(([, , up, dn])=> up.a2 > 0.02 || dn.a2 > 0.02), e1s = E.spiral.filter(([i, up, dn])=>{ const lim = i === 8 ? 0.04 : 0.02; return up.a2 > lim || dn.a2 > lim || !up.ok || !dn.ok; });
  put({id:'E1', name:'보이는 몸 y 2차 차분 ≤ 0.02(옛 0.32 — 디딤마다 툭) — 성문 계단 열 · 걷기·달리기 · 오르내리기 · 나선 T1·T4 · K 0.04(폭 1.4 — 기둥 곁에서 돌면 경사가 가팔라진다)', pass:!e1g.length && !e1s.length,
    detail:{gateMax:Math.max(...E.gate.flatMap(r=> [r[2].a2, r[3].a2])), spiral:E.spiral.map(r=> [r[0], r[1].a2, r[2].a2]), bad:[...e1g, ...e1s].slice(0, 3)}});
  const dmax = Math.max(...E.gate.flatMap(r=> [r[2].dmax, r[3].dmax]), ...E.spiral.flatMap(r=> [r[1].dmax, r[2].dmax])), d0 = Math.max(...E.gate.flatMap(r=> [r[2].d0, r[3].d0]), ...E.spiral.flatMap(r=> [r[1].d0, r[2].d0]));
  put({id:'E1b', name:'계단에서 뛰기 — 공중·뜨고 내리는 프레임의 보이는 몸 속도 − 충돌 몸 속도 ≤ 0.02(옛 0.056~0.159 — 뜰 때·내릴 때 한 프레임 툭) · 성문 계단 둘 × 다섯 때', pass:E.jump.length === 10 && E.jump.every(r=> r[2] <= 0.02), detail:{max:Math.max(...E.jump.map(r=> r[2])), all:E.jump}});
  put({id:'E2', name:'보이는 몸 − 충돌 몸 — 걷는 중(0.5초 뒤) ≤ 0.21(성문 계단 끝은 카메라와 같은 1.5단 이음) · 서 있다 막 걸어 첫 디딤에 오를 때도 ≤ 한 단(0.33) · 멈춘 뒤 0.3초 ≤ 0.01 · 뛰는 동안 뜨기 전 어긋남보다 안 커짐(줄어들기만)', pass:dmax <= 0.21 && d0 <= 0.33 && E.stop.every(r=> r[1] <= 0.01 && r[2] <= r[1] + 1e-6),
    detail:{dmax, d0, gate:Math.max(...E.gate.flatMap(r=> [r[2].dmax, r[3].dmax])), spiral:E.spiral.map(r=> [r[0], r[1].dmax, r[2].dmax, r[1].d0]), stop:E.stop}});
  const cads = E.gate.filter(r=> !r[1]).flatMap(r=> [r[2].cad, r[3].cad]).filter(v=> v !== null);
  put({id:'E3', name:'계단 걸음 박자 ≤ 평지 박자(걷기 · 1.3~1.6Hz — 옛 2.1~2.45Hz 종종걸음) · 평지 1.6Hz 그대로', pass:cads.length >= 10 && cads.every(c=> c >= 1.3 && c <= E.cad.flat + 1e-3) && Math.abs(E.cad.flat - 1.6) < 0.05,
    detail:{stair:[Math.min(...cads), Math.max(...cads)], flat:E.cad.flat}});
  put({id:'E4', name:'친구 화면(6Hz 받기) — 수평 속도 최대/최소 ≤ 1.3(옛 2.0~12.6) · y 2차 차분 ≤ 0.03 · 공중 깜빡 0 · 멈춘 뒤 0.5초 받은 자리 ±0.01(옛 0.17 앞) · 뛰어내려 착지 뒤 땅속 ≤ 0.01(옛 0.33)',
    pass:E.friend.ratio <= 1.3 && E.friend.a2 <= 0.03 && E.friend.flips === 0 && E.friendStop.walk.after <= 0.01 && E.friendStop.fall.after <= 0.01 && E.friendStop.fall.sink <= 0.01 && E.friendStop.walk.sink <= 0.01, detail:{...E.friend, stop:E.friendStop}});
  { const J = E.friendJit, ok = J.jit120.r <= 1.6 && J.late30.r <= 1.7 && J.race45.r <= 1.2 && J.race45j.r <= 1.4 && J.sprint45slow.r <= 1.2
      && Object.values(J).every(q=> q.back === 0 && q.tele === 0) && J.jit120.stall === 0 && J.late30.stall <= 0.02*J.late30.n;
    put({id:'E4c', name:'친구 화면 — 도착 흔들림(0~120ms · 30% 200ms · 0.05~0.35초)·경주 대각선 달리기(14.1 m/s 45°)·느린 꾸러미(1/3초): 뒤로 간 프레임 0 · 순간이동 0 · 속도 p95/p5 ≤ 1.6(30% 늦음 1.7 · 경주 1.2~1.4) · 멈칫 0(30% 늦음 ≤ 2%)(3회차: 0~120ms 0.58~9.85 · 흔들림 0.3 뒤로 13~18% · 경주 45° 매 꾸러미 순간이동)', pass:ok, detail:J}); }
  put({id:'E6', name:'3인칭 성문 계단 앞으로 걸어 내려가기(열 곳 × 줌 3.2·6 × 시선 넷) — 카메라 거리 < 1.2 시간 ≤ 5% · 한 프레임 당김 ≤ 0.3 · 카메라 y 2차 차분 ≤ 0.03(3회차 64~77% · 1.9 · 0.37 — 오르막 쪽 카메라는 당기기 전에 끝을 올린다)',
    pass:E.desc.length === 8 && E.desc.every(r=> r.closePct <= 5 && r.pull <= 0.3 && r.a2 <= 0.03), detail:E.desc});
  put({id:'E5', name:'3인칭 뒤로(S) 성문 계단 오르기 — 카메라 당김 톱니(풀었다 0.3초 안 다시 당김) 0 · 몸 숨김 0.4초 안 깜빡 0(옛 톱니 29~40 · 깜빡 2~4) · 시선 넷', pass:E.back.every(r=> r[1] === 0 && r[2] === 0), detail:E.back});

  /* ═══ F 좀비 ═══ */
  const F = await page.evaluate(()=>{ const W = window, H = W.__t70, PL = W.__PL, GY = W.__GY, G = W.__G, WT = W.__WOLF_T, gT = W.__gT, gPP = W.__gPP, gX = W.__gX, gZ = W.__gZ;
    const grid = W.__gboxGrid, key = (bx, bz)=> (bx+64)*256 + (bz+64), CASTLE = W.__CASTLE, HW = W.__HW, WS = HW*2 + 1;
    let sd = 7; const rnd0 = Math.random; Math.random = ()=>{ sd = (sd*16807) % 2147483647; return (sd - 1)/2147483646; };
    const pen = (w)=>{ const sc = w.sc || WT[w.k].sc, rA = 0.64*sc, y0 = (w.y || GY) + 0.1, y1 = (w.y || GY) + 1.2*sc/0.7; let pb = 0;
      for(let bx=Math.floor((w.x - rA)/4); bx<=Math.floor((w.x + rA)/4); bx++) for(let bz=Math.floor((w.z - rA)/4); bz<=Math.floor((w.z + rA)/4); bz++){ const a = grid.get(key(bx, bz)); if(!a) continue;
        for(const b of a){ if(b.off || b.k === 3 || b.y0 >= y1 || b.y1 <= y0) continue; const dx = Math.max(b.x0 - w.x, 0, w.x - b.x1), dz = Math.max(b.z0 - w.z, 0, w.z - b.z1);
          const p = (dx === 0 && dz === 0) ? rA + Math.min(w.x - b.x0, b.x1 - w.x, w.z - b.z0, b.z1 - w.z) : rA - Math.hypot(dx, dz); if(p > pb) pb = p; } }
      if(!(w.cs >= 2)) pb = Math.max(pb, penC(w.x, w.z, rA));
      return pb; };
    /* 고침 — 성곽 칸 파고듦은 팔 폭 전체(rA — 옛 검사는 0.45 로 잘라 큰 좀비·보스를 못 잡았다): 가운데에서 32 방향으로 0.02 씩 나가 처음 닿는 돌까지 거리 d → rA − d.
       회랑 대각 칸(GALW 10)과 그 곁은 참 얼굴(e 49.0 ~ 52.8)로 · ZGB 0 인 칸(성곽 2칸 밖)은 건너뜀 */
    const CG = (cx, cz)=> (Math.abs(cx) <= HW && Math.abs(cz) <= HW) ? CASTLE[(cx + HW) + (cz + HW)*WS] : 0;
    const solidAt = (x, z)=>{ const cx = Math.floor(x), cz = Math.floor(z), ck = CG(cx, cz), ax = Math.abs(x), az = Math.abs(z), e = (ax + az)*0.6;
      if(ck === 10) return e >= 49 && e <= 52.8;
      if(ck >= 2) return true;
      if(e >= 49 && e <= 52.8 && e >= Math.max(ax, az)) for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++) if(CG(cx + dx, cz + dz) === 10) return true;
      return false; };
    const penC = (px0, pz0, rA)=>{ const c = Math.floor(px0), cz0 = Math.floor(pz0); if(Math.abs(c) > HW || Math.abs(cz0) > HW || !W.__ZGB[(c + HW) + (cz0 + HW)*WS]) return 0; let pb = 0;
      for(let n=0; n<32; n++){ const ux = Math.cos(n/32*2*Math.PI), uz = Math.sin(n/32*2*Math.PI);
        for(let d = 0; d < rA; d += 0.02) if(solidAt(px0 + ux*d, pz0 + uz*d)){ if(rA - d > pb) pb = rA - d; break; } }
      return pb; };
    const runCase = (nm, setup, secs)=>{ G.wolves.length = 0; setup(); let frames = 0, zf = 0, max = 0, over = 0, onStair = 0, footRow = 0, climbF = 0, ms = 0; const ex = [];
      for(let t=0; t<secs; t+=1/30){ PL.hp = 100; PL.down = false; const t0 = performance.now(); W.__hostSim(1/30); ms += performance.now() - t0; frames++;
        for(const w of G.wolves){ if(w.hp <= 0) continue; zf++; if(w.cs >= 2) climbF++; const p = pen(w); if(p > max) max = p; if(p > 0.05){ over++; if(ex.length < 4) ex.push([WT[w.k].n, w.cs | 0, H.f3(w.x), H.f3(w.z), H.f3((w.y || GY) - GY), H.f3(p)]); }
          const cx = Math.floor(w.x), cz = Math.floor(w.z), so = W.__stairOf[(cx + HW) + (cz + HW)*WS];
          if(!(w.cs >= 1) && so >= 0 && so < 1000 && (w.y || GY) - GY > 0.05){ const S2 = W.__STAIRS[so]; if(gT(S2.g, w.x, w.z) >= 35) onStair++; else footRow++; } } }
      return {nm, frames, zf, climbF, max:H.f3(max), over, onStair, footRow, ms:H.f3(ms/frames), ex}; };
    const out = [];
    W.__goNight(); G.paused = false;
    out.push(runCase('A_gate2', ()=>{ const g = 1, s = -1; Object.assign(PL, {x:gX(g, 47.5, 8.5*s), z:gZ(g, 47.5, 8.5*s), y:GY + 8, vx:0, vz:0, vy:0, ground:true});
      for(let i=0; i<36; i++){ const k = [0, 0, 1, 8, 0, 2, 9, 11, 0, 1, 12, 10][i % 12]; W.__spawnWolf(k, g); const w = G.wolves[G.wolves.length - 1]; if(w){ const t = 36 + (i % 6)*2.5, pp = -6 + (i % 7)*2; w.x = gX(g, t, pp); w.z = gZ(g, t, pp); } } }, 40));
    out.push(runCase('A2_climb', ()=>{ const g = 1, s = -1; Object.assign(PL, {x:gX(g, 31.5, 8.5*s), z:gZ(g, 31.5, 8.5*s), y:GY, vx:0, vz:0, vy:0, ground:true});
      for(let i=0; i<10; i++){ const k = [0, 1, 8, 11, 0][i % 5]; W.__spawnWolf(k, g); const w = G.wolves[G.wolves.length - 1]; if(w){ w.x = gX(g, 27 - (i%3), (5 + i%4)*s); w.z = gZ(g, 27 - (i%3), (5 + i%4)*s); w.gate = g; } }
      for(let i=0; i<60; i++){ PL.hp = 100; W.__hostSim(1/30); }
      Object.assign(PL, {x:gX(g, 48, 8.5*s), z:gZ(g, 48, 8.5*s), y:GY + 8}); }, 30));
    out.push(runCase('B_gate4', ()=>{ Object.assign(PL, {x:3, z:3, y:GY, vx:0, vz:0, vy:0, ground:true}); for(let i=0; i<40; i++){ const k = [0, 1, 2, 8, 9, 12, 0, 2][i % 8]; W.__spawnWolf(k, 3); } }, 40));
    out.push(runCase('C_gate1_boss', ()=>{ Object.assign(PL, {x:3, z:3, y:GY, vx:0, vz:0, vy:0, ground:true}); for(const k of [3, 5, 7, 2, 2, 12, 9]) W.__spawnWolf(k, 0); for(let i=0; i<20; i++) W.__spawnWolf(i % 2, 0); }, 45));
    out.push(runCase('D_gate3_92', ()=>{ Object.assign(PL, {x:0, z:30, y:GY, vx:0, vz:0, vy:0, ground:true}); for(let i=0; i<92; i++) W.__spawnWolf([0, 1, 2, 8, 9, 11, 12, 0][i % 8], [2, 3, 1, 0, 4][i % 5]); }, 30));
    /* F2 — 쫓기다 성벽으로 달아난 아이 스무 번(씨앗 다르게): 계단에 오른 좀비 · 발치 포기 */
    let climbed = 0, gaveUp = 0;
    for(let r=0; r<20; r++){ sd = 11 + r*97; G.wolves.length = 0; W.__goNight(); G.paused = false; const g = [1, 0, 3, 4][r % 4], s = r % 2 ? 1 : -1;   // 밤을 새로(새벽 귀환 예산이 남게)
      Object.assign(PL, {x:gX(g, 31.5, 8.5*s), z:gZ(g, 31.5, 8.5*s), y:GY, vx:0, vz:0, vy:0, ground:true});
      for(let i=0; i<6; i++){ W.__spawnWolf([0, 1, 8][i % 3], g); const w = G.wolves[G.wolves.length - 1]; if(w){ w.x = gX(g, 27 - (i%3), (4.5 + i%3)*s); w.z = gZ(g, 27 - (i%3), (4.5 + i%3)*s); w.gate = g; } }
      for(let i=0; i<60; i++){ PL.hp = 100; W.__hostSim(1/30); }
      Object.assign(PL, {x:gX(g, 48, 8.5*s), z:gZ(g, 48, 8.5*s), y:GY + 8});
      const seen = new Set(), done = new Set();
      for(let i=0; i<600; i++){ PL.hp = 100; PL.down = false; W.__hostSim(1/30); for(const w of G.wolves){ if(w.cs >= 2) seen.add(w); if(w.cDone && !(w.cs >= 2) && !seen.has(w)) done.add(w); } }
      climbed += seen.size; gaveUp += done.size; }
    /* F5 — 흑요석 산탄총 밀치기(1.2칸)를 계단 흉벽·곧은 벽·탑 얼굴 쪽으로: 밀린 뒤 2초 파고듦 ≤ 0.05 · 땅 좀비 계단 디딤 위 0 · 5초 안에 다시 걷는다(벽 속 끼임 0) */
    const push = [];
    for(const [nm, set] of [['g2 통로→계단벽', [1, -1, 40, 6.2, 1]], ['g2 바깥→계단벽', [1, -1, 40, 11.0, -1]], ['g2 t38', [1, -1, 38, 10.7, -1]], ['g4 통로', [3, 1, 40, 6.2, 1]], ['g1 통로', [0, 1, 40, 6.2, 1]], ['곧은 벽', [20, -48.4, 0, -1]], ['T1 마을 얼굴', [30.5, -47.6, 0, -1]]]){
      sd = 5; G.wolves.length = 0; W.__goNight(); G.paused = false; Object.assign(PL, {x:3, z:3, y:GY, vx:0, vz:0, vy:0, ground:true});
      let x0, z0, ux, uz, gate = 0;
      if(set.length === 5){ const [g, s2, t, P0, dir] = set; gate = g; x0 = gX(g, t, P0*s2); z0 = gZ(g, t, P0*s2); ux = gX(g, t, (P0 + dir)*s2) - x0; uz = gZ(g, t, (P0 + dir)*s2) - z0; }
      else { [x0, z0, ux, uz] = set; }
      W.__spawnWolf(0, gate); const w = G.wolves[G.wolves.length - 1]; w.x = x0; w.z = z0; w.gate = gate; w.hp = 1e6;
      const p0 = pen(w); W.__hostStoneHit(w.id, 1, 't', 0, 1, {push:[ux, uz]}); let mx = pen(w), onSt = 0, path = 0, px = w.x, pz = w.z;
      for(let i=0; i<150; i++){ PL.hp = 100; PL.down = false; W.__hostSim(1/30); if(i < 60) mx = Math.max(mx, pen(w)); if(i >= 30){ path += Math.hypot(w.x - px, w.z - pz); } px = w.x; pz = w.z;
        const cx = Math.floor(w.x), cz = Math.floor(w.z), so = W.__stairOf[(cx + HW) + (cz + HW)*WS]; if(!(w.cs >= 1) && so >= 0 && so < 1000 && (w.y || GY) - GY > 0.05) onSt++; }
      push.push([nm, H.f3(p0), H.f3(mx), onSt, H.f3(path)]); }
    /* F6 — 큰 좀비·보스가 벽으로 곧장 걸어갈 때(실제 zMoveOk · 0.01 걸음) 멈춘 자리의 팔 폭 파고듦 — 곧은 벽 · 탑 마을 얼굴 · 회랑 대각 안벽 */
    const big = [];
    for(const k of [0, 2, 3, 5, 7]) for(const [nm, x0, z0, dx, dz] of [['곧은 벽', 13, -46, 0, -1], ['탑 얼굴', 30, -45, 0, -1], ['회랑 대각', 33.5, -33.5, Math.SQRT1_2, -Math.SQRT1_2], ['회랑 대각2', 31, -36, Math.SQRT1_2, -Math.SQRT1_2]]){
      const w = {k, sc:WT[k].sc, x:x0, z:z0, y:GY, cs:0}; let n = 0; while(n < 2000 && W.__zMoveOk(w, w.x + dx*0.01, w.z + dz*0.01)){ w.x += dx*0.01; w.z += dz*0.01; n++; }
      big.push([WT[k].n, nm, H.f3(penC(w.x, w.z, W.__rZ(w))), n]); }
    Math.random = rnd0; G.wolves.length = 0; W.__goDay(); G.paused = true;
    return {cases:out, climbed, gaveUp, push, big}; });
  const fmax = Math.max(...F.cases.map(c=> c.max));
  put({id:'F1', name:'좀비 파고듦 — 팔 폭(0.64·크기) 원이 계단 흉벽·발치 기둥·성곽 칸에 파고드는 깊이 ≤ 0.05(옛 0.86) — 성문 2 오르기·성문 4 통로·성문 1 보스·92마리', pass:fmax <= 0.05,
    detail:{max:fmax, cases:F.cases.map(c=> [c.nm, c.max, c.over, c.zf, c.ex[0] || null])}});
  put({id:'F2', name:'오르기 — 쫓기다 성벽으로 달아난 아이 20번: 계단에 오른 좀비 ≥ 30 · 발치 포기 ≤ 오른 수의 절반', pass:F.climbed >= 30 && F.gaveUp <= F.climbed/2, detail:{climbed:F.climbed, gaveUp:F.gaveUp, climbFrames:F.cases.map(c=> c.climbF)}});
  put({id:'F3', name:'성능 — 92마리 hostSim 한 번 평균 ms(기록 · 소프트웨어 렌더라 GPU 무관)', pass:true, detail:{ms:F.cases.map(c=> [c.nm, c.ms])}});
  put({id:'F5', name:'산탄총 밀치기 — 계단 흉벽·곧은 벽·탑 얼굴 쪽 1.2칸(zStep) · 밀린 뒤 2초 파고듦 ≤ 0.05(옛 0.45 — 흉벽 속 영영) · 땅 좀비 디딤 위 0 · 1~5초 걸은 길 ≥ 1(끼임 0)',
    pass:F.push.every(r=> r[2] <= 0.05 && r[3] === 0 && r[4] >= 1), detail:F.push});
  put({id:'F6', name:'큰 좀비·보스 팔 폭 — 곧은 벽·탑 얼굴·회랑 대각 안벽까지 걸어간 자리 파고듦 ≤ 0.05(옛 큰좀비 0.24 · 우두머리 0.59 · 좀비왕 0.76) · 좀비 다섯 종', pass:F.big.every(r=> r[2] <= 0.05 && r[3] > 0 && r[3] < 2000), detail:F.big});
  put({id:'F4', name:'땅 좀비(cs 0)가 계단 디딤 위(y > 0.05) 프레임 0 — 발치 줄(t 34~35: 층 전환점 34.5 에서 내려와 걸어 나오는 몇 프레임)은 따로 셈', pass:F.cases.every(c=> c.onStair === 0), detail:F.cases.map(c=> [c.nm, c.onStair, c.footRow])});
}catch(e){ errors.push('검사 오류: ' + (e.stack || e.message)); }
finally{ if(browser) await browser.close(); server.close(); }
if(errors.length) console.log('오류: ' + errors.slice(0, 5).join(' | '));
const bad = results.filter(r=> !r.pass).length;
console.log(`${results.length - bad}/${results.length} 70차 성곽(선생님 새 요청) 검사 통과` + (errors.length ? ' · 페이지 오류 ' + errors.length : ''));
process.exitCode = bad || errors.length ? 1 : 0;
