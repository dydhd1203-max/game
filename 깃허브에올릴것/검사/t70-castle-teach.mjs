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
  put({id:'A1', name:'손잡이 — 밧줄 0 · 둥근 나무 막대(cbarrel)만 · 조각 가운데 r ∈ [b−0.15, b−0.04](우물 벽을 따라 도는 곡선) · 문 쐐기 안 0 · 탑당 35~70 조각',
    pass:AB.rope === 0 && AB.keys.every(k=> k === 'cbarrel') && !AB.railBad.length && !AB.wedge.length && AB.rail.slice(0, 8).every(n=> n >= 35 && n <= 70) && AB.rail[8] >= 15,
    detail:{rope:AB.rope, keys:AB.keys, rail:AB.rail, bad:AB.railBad.slice(0, 6), wedge:AB.wedge.slice(0, 6)}});
  put({id:'A2', name:'1인칭 시야 — 걸음선 36 자리 × 오르는 쪽 시선 원뿔(±30°·±20°) 안 손잡이까지 ≥ 0.8(눈앞을 가로지르는 막대 없음)', pass:AB.view.minD >= 0.8, detail:AB.view});
  put({id:'B1', name:'나선 폭 — 탑 여덟 디딤 폭 b − a ≥ 2.1(옛 1.40) · 걸음선 기울기 ≤ 24°(옛 30°) · K 그대로 · castleOddN 0', pass:AB.width.every(w=> w >= 2.1) && AB.slope.every(a=> a <= 24) && AB.K[0] === 0.4 && AB.K[1] === 1.8 && AB.odd === 0,
    detail:{width:AB.width, slope:AB.slope, K:AB.K, odd:AB.odd}});

  /* ═══ B2 아이 손 셋 × 탑 여덟 — 1층 → 망루(12) → 1층 ═══ */
  const B2 = await page.evaluate(()=>{ const W = window, H = W.__t70, PL = W.__PL, K = W.__KEY, GY = W.__GY;
    for(let i=0; i<5; i++){ W.__SECRET_OPEN[i] = 0; const b = W.__CPLAN.secrets[i].box; if(b) b.off = false; }
    const kid = (i, toY, om, lag, maxT)=>{ const S = W.__SPIRALS[i], up = GY + toY > PL.y, hist = []; H.keys({w:true}); let t = 0, lm = 0, px = PL.x, pz = PL.z, py = PL.y, stalls = 0, maxStall = 0, wall = 0, inC = 0;
      const done = ()=> up ? PL.y - GY >= toY - 0.02 : PL.y - GY <= toY + 0.02;
      while(t < maxT && !done()){ const dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz); let want;
        if(r > S.b - 0.02) want = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z));
        else { const th = Math.atan2(dz, dx) + (up ? 0.45 : -1.0), rr = (S.a + S.b)/2 + 0.1; want = Math.atan2(-(S.cx + Math.cos(th)*rr - PL.x), -(S.cz + Math.sin(th)*rr - PL.z)); }
        hist.push(want); const w = hist[Math.max(0, hist.length - 1 - Math.round(lag*60))]; let d = w - PL.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); PL.yaw += Math.max(-om/60, Math.min(om/60, d));
        K.w = Math.abs(d) < 1.6; W.__updPlayer(1/60); t += 1/60;
        const r2 = Math.hypot(PL.x - S.cx, PL.z - S.cz); if(r2 < S.b + 0.05){ inC++; if(r2 >= S.b - PL.R - 0.03) wall++; }
        if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t; } else if(t - lm > maxStall) maxStall = t - lm;
        if(t - lm > 1 && t - lm - 1/60 <= 1) stalls++; }
      H.keys(); return {ok:done(), t:H.f3(t), stalls, maxStall:H.f3(maxStall), wallPct:H.f3(wall/Math.max(1, inC)*100)}; };
    const out = [];
    for(let i=0; i<8; i++) for(const [nm, om, lag] of [['숙련', 6, 0.15], ['보통', 5, 0.2], ['서툰', 3, 0.35]]){
      const S = W.__SPIRALS[i], d = H.xf(i, 37, -52.2); H.place(d[0], 0, d[1]); PL.yaw = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z));
      const a = kid(i, 12, om, lag, 20), b = a.ok ? kid(i, 0, om, lag, 20) : {ok:false};
      out.push([W.__CPLAN.towers[i].id, nm, a, b]); }
    return out; });
  const b2bad = B2.filter(([, nm, a, b])=> !(a.ok && b.ok && a.stalls === 0 && b.stalls === 0 && (nm !== '서툰' || (a.t <= 12 && b.t <= 12)) && Math.max(a.wallPct, b.wallPct) <= (nm === '서툰' ? 8 : 3)));
  const b2sum = {}; for(const [, nm, a, b] of B2){ const q = b2sum[nm] || (b2sum[nm] = {up:0, dn:0, wall:0, n:0}); q.up = Math.max(q.up, a.t); q.dn = Math.max(q.dn || 0, b.t || 0); q.wall = Math.max(q.wall, a.wallPct, b.wallPct || 0); q.n++; }
  put({id:'B2', name:'아이 손 셋(숙련 ω6·보통 ω5·서툰 ω3/지연 .35) × 탑 여덟 1→12→1 — 끝까지 · 멈춤(1초) 0 · 서툰 손 ≤ 12초 · 벽 비빔 ≤ 3%(서툰 손 8% — 늦게 돌아 바깥으로 흐른다)(옛: 숙련 5.1%·보통 5.8% · 서툰 손 30초 못 오름)', pass:!b2bad.length, detail:{worst:b2sum, bad:b2bad.slice(0, 4)}});

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
    let n4 = 0, blk = 0, n4o = 0, blkO = 0; const ex4 = [];
    for(const p of galPts){ H.place(p.x, 8, p.z, p.yaw, -0.1); const eye = [PL.x, PL.y + 1.12, PL.z];
      for(let q=-3; q<=3; q++){ const G = CP.galleries[Math.floor(galPts.indexOf(p)/3)], ux = G.U.x, uz = G.U.z;   // 옆으로 ±2.4(탑 몸에 막히는 두 끝은 빼고)
        for(const od of [45, 42, 38, 34]){ const m = (((Math.abs(p.x) + Math.abs(p.z))*0.6) - od)/(Math.SQRT2*0.6), tx = p.x - G.N.x*m + ux*q*0.8, tz = p.z - G.N.z*m + uz*q*0.8, ty = GY + 0.85;
          const hd = Math.hypot(tx - eye[0], tz - eye[2]), ang = Math.atan2(eye[1] - ty, hd)*180/Math.PI; if(ang > 50) continue; n4++;
          if(W.__castleOccluded(eye[0], eye[1], eye[2], tx, ty, tz)){ blk++; if(ex4.length < 5) ex4.push([p.id, q, od, H.f3(ang)]); } }
        const mo = -3.2/(Math.SQRT2*0.6)*0 - 3.6, ox = p.x + G.N.x*3.6 + ux*q*0.8, oz = p.z + G.N.z*3.6 + uz*q*0.8; n4o++;
        if(W.__castleOccluded(eye[0], eye[1], eye[2], ox, GY + 2.5, oz)) blkO++; } }
    out.C4 = {n:n4, blocked:blk, ex:ex4, outer:n4o, outerBlocked:blkO};
    /* C5 — 좀비 구역·계단 가지 그대로(ZONE 칸 수 · 구역마다 계단) */
    let zc = 0; for(let i=0; i<W.__ZONE.length; i++) if(W.__ZONE[i] >= 0) zc++;
    out.C5 = {zone:zc, stairs:CP.zones.map(Z=> Z.stairs.join(','))};
    return out; });
  const c1bad = Cr.C1.filter(r=> r[3] !== 0 || r[4] === 0 || (r[1] === 0 && r[2] < 0));
  put({id:'C1', name:'든 총 — 1인칭 손은 층 2 에만(장면을 그린 뒤 깊이를 지우고 따로 그림 — 턱·흉벽·문설 어디에도 안 묻힘) · 안쪽 끝 앞을 볼 때(시선 0) 총 아랫면이 턱 갓돌 위', pass:!c1bad.length,
    detail:{curb:Cr.curb, bad:c1bad.slice(0, 6), min:Math.min(...Cr.C1.map(r=> r[2])), all:Cr.C1.map(r=> r[2]).slice(0, 12)}});
  const c2bad = Cr.C2.filter(r=> !(r.landT > 0 && r.landT <= 1.5 && Math.abs(r.y) < 0.05 && r.od < 49.05 && r.hurt === 0 && r.auto < 0.02));
  put({id:'C2', name:'뛰어내리기 — 안쪽 끝에서 W + 한 번 뛰면 1.5초 안 둘레길(y 0) · 다침 0 · 끼임 0 · 착지 0.7초 뒤 3인칭(회랑 넷 × 3 · 곧은 벽 둘) — 턱 0.32 < 뜀 ' + Cr.curb.jumpH, pass:!c2bad.length && Cr.curb.h < Cr.curb.jumpH,
    detail:{bad:c2bad.slice(0, 4), landT:Cr.C2.map(r=> r.landT)}});
  const c3bad = Cr.C3.filter(r=> r[3] < 7.99);
  put({id:'C3', name:'걸어선 안 떨어짐 — 턱 쪽으로 걷기·달리기 5초(10°·30°·90°) y 8 그대로', pass:!c3bad.length, detail:{bad:c3bad.slice(0, 6), n:Cr.C3.length}});
  put({id:'C4', name:'마을 쪽 조준 — 회랑 안쪽 끝 눈에서 마을 쪽 좀비(아래로 ≤ 50°) 가림 0 · 바깥 돌벽 너머 낮은 선은 가림 그대로', pass:Cr.C4.blocked === 0 && Cr.C4.n > 100 && Cr.C4.outerBlocked === Cr.C4.outer, detail:Cr.C4});
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
    return out; });
  const e1g = E.gate.filter(([, , up, dn])=> up.a2 > 0.02 || dn.a2 > 0.02), e1s = E.spiral.filter(([i, up, dn])=>{ const lim = i === 8 ? 0.04 : 0.02; return up.a2 > lim || dn.a2 > lim || !up.ok || !dn.ok; });
  put({id:'E1', name:'보이는 몸 y 2차 차분 ≤ 0.02(옛 0.32 — 디딤마다 툭) — 성문 계단 열 · 걷기·달리기 · 오르내리기 · 나선 T1·T4 · K 0.04(폭 1.4 — 기둥 곁에서 돌면 경사가 가팔라진다)', pass:!e1g.length && !e1s.length,
    detail:{gateMax:Math.max(...E.gate.flatMap(r=> [r[2].a2, r[3].a2])), spiral:E.spiral.map(r=> [r[0], r[1].a2, r[2].a2]), bad:[...e1g, ...e1s].slice(0, 3)}});
  const dmax = Math.max(...E.gate.flatMap(r=> [r[2].dmax, r[3].dmax]), ...E.spiral.flatMap(r=> [r[1].dmax, r[2].dmax])), d0 = Math.max(...E.gate.flatMap(r=> [r[2].d0, r[3].d0]), ...E.spiral.flatMap(r=> [r[1].d0, r[2].d0]));
  put({id:'E2', name:'보이는 몸 − 충돌 몸 — 걷는 중(0.5초 뒤) ≤ 0.21(성문 계단 끝은 카메라와 같은 1.5단 이음) · 서 있다 막 걸어 첫 디딤에 오를 때도 ≤ 한 단(0.33) · 멈춘 뒤 0.3초 ≤ 0.01 · 뛰는 동안 = 충돌 몸', pass:dmax <= 0.21 && d0 <= 0.33 && E.stop.every(r=> r[1] <= 0.01 && r[2] <= 1e-6),
    detail:{dmax, d0, gate:Math.max(...E.gate.flatMap(r=> [r[2].dmax, r[3].dmax])), spiral:E.spiral.map(r=> [r[0], r[1].dmax, r[2].dmax, r[1].d0]), stop:E.stop}});
  const cads = E.gate.filter(r=> !r[1]).flatMap(r=> [r[2].cad, r[3].cad]).filter(v=> v !== null);
  put({id:'E3', name:'계단 걸음 박자 2.1~2.45Hz(걷기 · 옛 1.60 그대로) · 평지 1.6Hz 그대로', pass:cads.length >= 10 && cads.every(c=> c >= 2.1 && c <= 2.45) && Math.abs(E.cad.flat - 1.6) < 0.05,
    detail:{stair:[Math.min(...cads), Math.max(...cads)], flat:E.cad.flat}});
  put({id:'E4', name:'친구 화면(6Hz 받기) — 수평 속도 최대/최소 ≤ 1.3(옛 2.0~12.6) · y 2차 차분 ≤ 0.03 · 공중 깜빡 0', pass:E.friend.ratio <= 1.3 && E.friend.a2 <= 0.03 && E.friend.flips === 0, detail:E.friend});

  /* ═══ F 좀비 ═══ */
  const F = await page.evaluate(()=>{ const W = window, H = W.__t70, PL = W.__PL, GY = W.__GY, G = W.__G, WT = W.__WOLF_T, gT = W.__gT, gPP = W.__gPP, gX = W.__gX, gZ = W.__gZ;
    const grid = W.__gboxGrid, key = (bx, bz)=> (bx+64)*256 + (bz+64), CASTLE = W.__CASTLE, HW = W.__HW, WS = HW*2 + 1;
    let sd = 7; const rnd0 = Math.random; Math.random = ()=>{ sd = (sd*16807) % 2147483647; return (sd - 1)/2147483646; };
    const pen = (w)=>{ const sc = w.sc || WT[w.k].sc, rA = 0.64*sc, y0 = (w.y || GY) + 0.1, y1 = (w.y || GY) + 1.2*sc/0.7; let pb = 0;
      for(let bx=Math.floor((w.x - rA)/4); bx<=Math.floor((w.x + rA)/4); bx++) for(let bz=Math.floor((w.z - rA)/4); bz<=Math.floor((w.z + rA)/4); bz++){ const a = grid.get(key(bx, bz)); if(!a) continue;
        for(const b of a){ if(b.off || b.k === 3 || b.y0 >= y1 || b.y1 <= y0) continue; const dx = Math.max(b.x0 - w.x, 0, w.x - b.x1), dz = Math.max(b.z0 - w.z, 0, w.z - b.z1);
          const p = (dx === 0 && dz === 0) ? rA + Math.min(w.x - b.x0, b.x1 - w.x, w.z - b.z0, b.z1 - w.z) : rA - Math.hypot(dx, dz); if(p > pb) pb = p; } }
      if(!(w.cs >= 2)){ const rc = Math.min(rA, 0.45); for(let n=0; n<16; n++){ const a = n/16*2*Math.PI, x = w.x + Math.cos(a)*rc*0.999, z = w.z + Math.sin(a)*rc*0.999, cx = Math.floor(x), cz = Math.floor(z);
        if(Math.abs(cx) <= HW && Math.abs(cz) <= HW && CASTLE[(cx + HW) + (cz + HW)*WS] >= 2){ const ex = Math.min(x - cx, cx + 1 - x, z - cz, cz + 1 - z); if(ex > pb) pb = ex; } } }
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
    Math.random = rnd0; G.wolves.length = 0; W.__goDay(); G.paused = true;
    return {cases:out, climbed, gaveUp}; });
  const fmax = Math.max(...F.cases.map(c=> c.max));
  put({id:'F1', name:'좀비 파고듦 — 팔 폭(0.64·크기) 원이 계단 흉벽·발치 기둥·성곽 칸에 파고드는 깊이 ≤ 0.05(옛 0.86) — 성문 2 오르기·성문 4 통로·성문 1 보스·92마리', pass:fmax <= 0.05,
    detail:{max:fmax, cases:F.cases.map(c=> [c.nm, c.max, c.over, c.zf, c.ex[0] || null])}});
  put({id:'F2', name:'오르기 — 쫓기다 성벽으로 달아난 아이 20번: 계단에 오른 좀비 ≥ 30 · 발치 포기 ≤ 오른 수의 절반', pass:F.climbed >= 30 && F.gaveUp <= F.climbed/2, detail:{climbed:F.climbed, gaveUp:F.gaveUp, climbFrames:F.cases.map(c=> c.climbF)}});
  put({id:'F3', name:'성능 — 92마리 hostSim 한 번 평균 ms(기록 · 소프트웨어 렌더라 GPU 무관)', pass:true, detail:{ms:F.cases.map(c=> [c.nm, c.ms])}});
  put({id:'F4', name:'땅 좀비(cs 0)가 계단 디딤 위(y > 0.05) 프레임 0 — 발치 줄(t 34~35: 층 전환점 34.5 에서 내려와 걸어 나오는 몇 프레임)은 따로 셈', pass:F.cases.every(c=> c.onStair === 0), detail:F.cases.map(c=> [c.nm, c.onStair, c.footRow])});
}catch(e){ errors.push('검사 오류: ' + (e.stack || e.message)); }
finally{ if(browser) await browser.close(); server.close(); }
if(errors.length) console.log('오류: ' + errors.slice(0, 5).join(' | '));
const bad = results.filter(r=> !r.pass).length;
console.log(`${results.length - bad}/${results.length} 70차 성곽(선생님 새 요청) 검사 통과` + (errors.length ? ' · 페이지 오류 ' + errors.length : ''));
process.exitCode = bad || errors.length ? 1 : 0;
