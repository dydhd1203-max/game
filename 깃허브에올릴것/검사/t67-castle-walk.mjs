/* 67차 성곽 — 숨김 브라우저 한 개(pw.mjs · ?gfx=low · 혼자 놀기). 실제 게임 함수만 부른다(검사 API · __KEY · __updPlayer(dt)).
   설계서 9-2(W1~W15) + 9-1 의 '세계가 있어야 재는' 항목(S2~S10·S16~S18) + 그림 예산 G0 + 보물 흐름(W8·W8b).
   ★ 다른 갈래가 아직 합쳐지지 않았으면 그 항목은 '대기'(WAIT)로 적고 넘어간다 — 무엇이 있는지는 게임에 묻는다:
       몸(갈래 1) = CASTLE 칸이 있고 SPIRALS 9 · 그림(갈래 2) = CPIECES · 좀비(갈래 3)는 t67-castle-zombie.
     T67_STRICT=1 이면 대기도 실패로 센다(전부 합친 뒤 check-current --render 와 함께 돌린다).
   ★ 보물 흐름은 두 가지로 본다: (api) 문 앞에 세워 두고 updCastleTreasure 만 흘림 — 지금 판에서 돈다 ·
     (walk) 실제로 걸어가 문에 부딪혀 민다(세 dt) — 몸이 합쳐진 뒤. 사진은 plan/shots.mjs + views67.json. */
import fs from 'node:fs'; import path from 'node:path';
import {chromium} from './pw.mjs'; import {serve} from './serve2.mjs'; import {GAME} from './gamefile.mjs';
const PORT = +(process.env.T67_PORT || 20195), STRICT = process.env.T67_STRICT === '1';
const out = path.resolve('artifacts/67-castle'); fs.mkdirSync(out, {recursive:true});
const server = serve(PORT, process.argv[2] || GAME), results = [], errors = [];
const put = (r)=>{ results.push(r); const tag = r.wait ? (STRICT ? 'FAIL' : 'WAIT') : (r.pass ? 'PASS' : 'FAIL');
  console.log(`${tag} [${r.id}] ${r.name}` + ((r.pass && !r.wait) ? '' : ' ' + JSON.stringify(r.detail ?? '').slice(0, 400))); };
/* 성곽 전 판(67차 갈래 0 — 맵만 키운 판)의 뱅크: 열쇠 63 · 인스턴스 31,038 · gglow 120 · 인스턴스 메시 재질 57 */
const BASE = {keys:['reed','lily','peb','mtB','mtC','bush','mtK','rock','gcore','gbrick','gdk','gwood','giron','gban','groof','moss','bushS','gglow','shopW','shopC','shopBrl',
  'forgeFloor','forgeP','forgeS','forgeF','forgeLog','forgeC','farmGround','farmPost','farmRail','farmWood','farmCloth','farmGlow','farmStone','farmHay','farmBarn','trunk','bark','root',
  'branch','leaf1','leaf2','leaf0','apple','oreG','nug','cone','stem','petal','pist','miBase','miFloor','miMark','miEdge','miGlow','rcBall','rcTrunk','rcCone','rcRbow','rcGem','rcBuoy','rcLand','rcLandB'],
  inst:31038, gglow:120, mats:57};
/* 68차 — 아이템 새 기하(상점 진열·대장간 모루/그루터기·금 광맥)의 뱅크 열쇠. 성곽 예산(G0)과 따로 G0b 로 센다 */
const ITEM68 = ['shopCoin','shopPotL','shopPotG','shopPotK','shopPotT','shopArm','shopArmR','shopCart','shopCask','forgeStump','forgeAnvil','oreV'];
let browser;
try{
  browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:960, height:600}});
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{ if(m.type() === 'error' && /THREE|WebGL|shader|GL_INVALID|TypeError|ReferenceError/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/?gfx=low`, {waitUntil:'load', timeout:90000});
  await page.waitForFunction(()=>window.__READY === true, null, {timeout:90000});
  await page.evaluate(()=>{ document.getElementById('iName').value = '성곽 검사'; document.getElementById('bSolo').click(); });
  await page.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:60000});
  await page.evaluate(()=>{ document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); const W = window; W.__G.paused = true; W.__DBG().noLogic = true; W.__DBG().noRender = true; });

  /* ── 공용 도우미(페이지 안) ── */
  await page.evaluate(()=>{
    const W = window, G = W.__G, P = W.__PL, K = W.__KEY, GY = W.__GY, CP = W.__CPLAN;
    const H = W.__t67 = {};
    H.have = ()=>{ const C = W.__CASTLE; let n = 0; for(let i=0; i<C.length; i+=7) if(C[i] >= 2){ n++; if(n > 5) break; }
      return {layout:n > 5, spirals:W.__SPIRALS.length >= 9, art:!!W.__CPIECES(), boxes:CP.secrets.every(s=> s.kind !== 'landing' || !!s.box),
              sparkHs:CP.sparkHs.length === 27, climb:W.__WOLF_T.some(d=>d.climb)}; };
    H.keys0 = ()=>{ for(const k in K) K[k] = false; };
    H.place = (x, y, z, yaw)=>{ H.keys0(); Object.assign(P, {x, y:GY + y, z, vx:0, vz:0, vy:0, yaw:yaw || 0, down:false, ground:true, jumps:0}); W.__updPlayer(1/60); };
    H.yawTo = (x, z)=> Math.atan2(-(x - P.x), -(z - P.z));
    /* 웨이포인트 걷기 — steer:false 면 처음 한 번만 돌리고 그 뒤로는 사람처럼 손대지 않는다(문 기하·레일·깔때기 비용이 드러나게) */
    H.route = (pts, o)=>{
      o = o || {}; const dt = o.dt || 1/60, tol = o.tol || 0.5, max = o.max || 60;
      H.keys0(); K.w = true; if(o.run) K.shift = true;
      let wi = 0, t = 0, stall = 0, maxStall = 0, lastD = 1e9, bigDy = 0, camIn = 0, camOut = 0, lastAuto = W.__camAuto(), frames = 0, lastX = P.x, lastZ = P.z, prog = 0;
      if(o.steer === false) P.yaw = H.yawTo(pts[0][0], pts[0][2]);
      const trace = [];
      while(t < max){
        const tg = pts[wi], dx = tg[0] - P.x, dz = tg[2] - P.z, d = Math.hypot(dx, dz);
        if(d < tol && Math.abs(P.y - (GY + tg[1])) < (o.ytol || 0.7)){ wi++; lastD = 1e9; if(wi >= pts.length) break; continue; }
        if(o.steer !== false) P.yaw = H.yawTo(tg[0], tg[2]);
        const y0 = P.y; W.__updPlayer(dt); t += dt; frames++;
        if(Math.abs(P.y - y0) > 0.7 && P.y > y0) bigDy++;
        const a = W.__camAuto(); if(a >= 0.98 && lastAuto < 0.98) camIn++; if(a <= 0.02 && lastAuto > 0.02) camOut++; lastAuto = a;
        const mv = Math.hypot(P.x - lastX, P.z - lastZ); lastX = P.x; lastZ = P.z;
        if(mv < 0.1*dt){ stall += dt; maxStall = Math.max(maxStall, stall); } else stall = 0;
        if(frames % 30 === 0) trace.push([+P.x.toFixed(2), +(P.y - GY).toFixed(2), +P.z.toFixed(2)]);
      }
      H.keys0();
      return {done:wi >= pts.length, wi, t:+t.toFixed(2), maxStall:+maxStall.toFixed(2), bigDy, camIn, camOut, end:[+P.x.toFixed(2), +(P.y - GY).toFixed(2), +P.z.toFixed(2)], trace:trace.slice(-6)};
    };
  });
  const have = await page.evaluate(()=>window.__t67.have());
  console.log('갈래 상태', JSON.stringify(have));
  const body = have.layout && have.spirals;

  /* ═══ G0 그림 예산(갈래 2) ═══ */
  if(have.art){
    const g0 = await page.evaluate(([BASE, ITEM68])=>{ const W = window; let inst = 0, gg = 0, inst68 = 0; const nk = [], k68 = [];
      for(const [k, b] of W.__banks){ const n = b.ms ? b.ms.length : 0; if(ITEM68.includes(k)){ k68.push(k); inst68 += n; continue; }   /* 68차 아이템 열쇠는 G0b 에서 따로 */
        inst += n; if(k === 'gglow' || k === 'cflameI' || k === 'cwinL') gg += n;   /* 69차 — 망루 창 안쪽 빛 테(cwinL)가 옛 덧창 불빛(gglow 48)을 대신한다 */ if(!BASE.keys.includes(k)) nk.push(k); }   /* 통합 — 불꽃은 두 겹(주황 혀 cflame + 밝은 밑동 cflameI) · 불빛 수는 밝은 밑동으로 센다(66 횃불도 같은 불꽃으로 바뀌었다) */
      const mats = new Set(), all = new Set(), vc = W.__HELD_VC.uuid; W.__scene.traverse(o=>{ if(o.isInstancedMesh){ all.add(o.material.uuid); if(o.material.uuid !== vc) mats.add(o.material.uuid); } });
      return {newKeys:nk.length, keys:nk, dInst:inst - BASE.inst, dGlow:gg - BASE.gglow, mats:mats.size, k68, inst68, matsAll:all.size, heldVc:all.has(vc)}; }, [BASE, ITEM68]);
    /* 70차 2회차 — 탑 여덟 9×9 → 11×11(선생님: "맵 크기를 키워야 된다면 키워")·나선 벽 손잡이로 인스턴스 한도 20,000 → 21,000(설계 teach70 §3).
       뱅크 열쇠(그리기 호출)·재질은 그대로 · 큰 탑은 큰 마름돌(면마다 돌 수 그대로)·판석 1.2배로 늘어남을 줄였다. GPU 비용은 교실 gram 에서 따로 잰다 */
    put({id:'G0', name:'새 뱅크 열쇠 ≤ 27 · 새 인스턴스 ≤ 21,000 · 불빛(gglow + 불꽃 밑동) 새 ≤ 200 · 인스턴스 재질 수 그대로(57)', pass:g0.newKeys <= 27 && g0.dInst <= 21000 && g0.dGlow <= 200 && g0.mats <= BASE.mats, detail:{newKeys:g0.newKeys, keys:g0.keys, dInst:g0.dInst, dGlow:g0.dGlow, mats:g0.mats}});
    /* 68차 — 아이템 새 기하 예산: 열쇠는 정해 둔 열둘 안 · 인스턴스 ≤ 300 · 세계 인스턴스 재질은 손 모형 꼭짓점 색 재질(HELD_VC — 새로 만든 재질 아님) 하나만 더 */
    put({id:'G0b', name:'68차 아이템 열쇠 ≤ 12(정해 둔 것만) · 인스턴스 ≤ 300 · 인스턴스 재질은 HELD_VC 하나만 더', pass:g0.k68.length <= ITEM68.length && g0.inst68 <= 300 && g0.matsAll <= BASE.mats + (g0.heldVc ? 1 : 0), detail:{k68:g0.k68, inst68:g0.inst68, matsAll:g0.matsAll, heldVc:g0.heldVc}});
  } else put({id:'G0', name:'그림 예산(열쇠·인스턴스·불빛·재질)', wait:true, pass:!STRICT, detail:'갈래 2 합친 뒤'});

  /* ═══ G1 겹친 면(z-fighting) — 69차(선생님: "이쪽도 겹쳐 있고 … 바닥 그래픽 깨지는 거"): 성곽 뱅크(c…)의 상자꼴 조각마다 여섯 면을 평면 사각형으로 보고,
     같은 쪽을 보는 두 면이 0.004 안에서 0.1 넘게 겹치고 · 그 자리가 드러나 있고(다른 조각·몸 상자·땅 속이 아님) · 색이 다르면 번쩍이는 겹침으로 센다 ═══ */
  if(have.art){
    const g1 = await page.evaluate(()=>{ const W = window, THREE = W.__THREE, TOL = 0.004, GYv = W.__GY;
      const faces = [], boxes = [], G2 = new Map(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      for(const [k, b] of W.__banks){ if(!/^c/.test(k) || !b.ms || !b.ms.length) continue; const g = b.geo; if(!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
        if(![bb.min.x, bb.min.y, bb.min.z].every(x=> Math.abs(x + 0.5) < 0.02) || ![bb.max.x, bb.max.y, bb.max.z].every(x=> Math.abs(x - 0.5) < 0.02)) continue;
        for(let i=0; i<b.ms.length; i++){ const e = b.ms[i].elements, A = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]], L = A.map(x=> Math.hypot(...x)); if(L.some(x=> x < 1e-4)) continue;
          const U = A.map((x, j)=> x.map(y=> y/L[j])), c = [e[12], e[13], e[14]], B = {k, i, c, U, h:L.map(x=> x/2)}; boxes.push(B);
          const r = Math.hypot(...B.h); for(let x = Math.floor(c[0] - r); x <= Math.floor(c[0] + r); x++) for(let z = Math.floor(c[2] - r); z <= Math.floor(c[2] + r); z++){ const kk = x*4096 + z; let a = G2.get(kk); if(!a) G2.set(kk, a = []); a.push(B); }
          for(let f=0; f<3; f++) for(const sg of [-1, 1]){ const n = U[f].map(x=> x*sg), o = [0,1,2].filter(j=> j !== f), p0 = [c[0] + n[0]*L[f]/2, c[1] + n[1]*L[f]/2, c[2] + n[2]*L[f]/2];
            faces.push({k, i, n, d:n[0]*p0[0] + n[1]*p0[1] + n[2]*p0[2], c:p0, t1:U[o[0]], h1:L[o[0]]/2, t2:U[o[1]], h2:L[o[1]]/2}); } } }
      const Bk = new Map(), kf = (n, d)=> n.map(x=> Math.round(x*20)).join(',') + '|' + d; for(const F of faces){ const kk = kf(F.n, Math.round(F.d*50)); let a = Bk.get(kk); if(!a) Bk.set(kk, a = []); a.push(F); }
      const pts = (A, Bf)=>{ const P = []; for(let a=0; a<8; a++) for(let b=0; b<8; b++){ const u = (a + 0.5)/4 - 1, w = (b + 0.5)/4 - 1;
        const p = [0,1,2].map(j=> A.c[j] + A.t1[j]*u*A.h1 + A.t2[j]*w*A.h2), r = [0,1,2].map(j=> p[j] - Bf.c[j]);
        if(Math.abs(r[0]*Bf.t1[0] + r[1]*Bf.t1[1] + r[2]*Bf.t1[2]) < Bf.h1 - 0.01 && Math.abs(r[0]*Bf.t2[0] + r[1]*Bf.t2[1] + r[2]*Bf.t2[2]) < Bf.h2 - 0.01) P.push(p); } return P; };
      const inside = (p, s1, s2)=>{ for(const B of (G2.get(Math.floor(p[0])*4096 + Math.floor(p[2])) || [])){ if(B === s1 || B === s2) continue; const r = [p[0] - B.c[0], p[1] - B.c[1], p[2] - B.c[2]];
        if([0,1,2].every(j=> Math.abs(r[0]*B.U[j][0] + r[1]*B.U[j][1] + r[2]*B.U[j][2]) <= B.h[j] - 0.002)) return true; }
        if(W.__solidTop(Math.floor(p[0]), Math.floor(p[2])) > p[1] + 0.001) return true;
        { const HW = W.__HW, cx = Math.floor(p[0]), cz = Math.floor(p[2]), k = W.__stairOf[(cx + HW) + (cz + HW)*(2*HW + 1)];   // 나선 우리 칸 — 우물 반지름 밖은 구석 메움(상자꼴이 아님) 속
          if(k >= 1000){ const S = W.__SPIRALS[k - 1000]; if(Math.hypot(p[0] - S.cx, p[2] - S.cz) > S.b + 0.01) return true; } }
        return W.__GBOX.some(b=> b.k !== 3 && !b.off && p[0] > b.x0 - 0.01 && p[0] < b.x1 + 0.01 && p[2] > b.z0 - 0.01 && p[2] < b.z1 + 0.01 && p[1] > b.y0 - 0.01 && p[1] < b.y1 + 0.01); };   // 몸 상자 경계 위 점도 속으로(문 인방 끝 등)
      const boxOf = new Map(); for(const B of boxes) boxOf.set(B.k + '#' + B.i, B);
      const big = [], small = [];
      for(const F of faces) for(const dd of [-1, 0, 1]){ for(const Gf of (Bk.get(kf(F.n, Math.round(F.d*50) + dd)) || [])){
        if(Gf.k < F.k || (Gf.k === F.k && Gf.i <= F.i)) continue; if(F.n[0]*Gf.n[0] + F.n[1]*Gf.n[1] + F.n[2]*Gf.n[2] < 0.9995 || Math.abs(F.d - Gf.d) >= TOL) continue;
        const P = pts(F, Gf); const ar = P.length/64*4*F.h1*F.h2; if(ar < 0.02) continue;
        const bF = W.__banks.get(F.k), bG = W.__banks.get(Gf.k); if(bF.mat === bG.mat && bF.cols && bG.cols && bF.cols[F.i] === bG.cols[Gf.i] && !(bF.fl && bF.fl[F.i]) && !(bG.fl && bG.fl[Gf.i])) continue;
        const s1 = boxOf.get(F.k + '#' + F.i), s2 = boxOf.get(Gf.k + '#' + Gf.i); let open = 0;
        for(const p of P) if(!inside([p[0] + F.n[0]*0.035, p[1] + F.n[1]*0.035, p[2] + F.n[2]*0.035], s1, s2)) open++;   // 0.035 — 그보다 좁은 틈(조각끼리 0.02 떼어 둔 곳)은 옆으로 봐도 안 보인다
        if(open < Math.max(2, P.length*0.25)) continue;
        const rec = [F.k, Gf.k, +F.c[0].toFixed(2), +(F.c[1] - GYv).toFixed(2), +F.c[2].toFixed(2), F.n.map(x=> +x.toFixed(2)).join(','), +ar.toFixed(3)];
        (ar >= 0.1 ? big : small).push(rec); } }
      return {faces:faces.length, big:big.length, small:small.length, ex:big.slice(0, 12)}; });
    put({id:'G1', name:'성곽 겹친 면(같은 면 0.004 안 · 드러남 · 색 다름) 넓이 ≥ 0.1 = 0(0.02~0.1 은 기록 — 줄눈 틈 속)', pass:g1.big === 0, detail:g1});
    /* ═══ G2 서로 파고든 조각 — 70차(검토: 회랑 문 이맛돌 × 받침 도리 · 복도 문 × 구석 문 홍예가 방 모서리에서 박힘 — G1 은 같은 면만 봐서 못 잡는다).
       조각마다 기하 상자(boundingBox)를 행렬로 옮긴 OBB 끼리 분리축(15)으로 파고든 깊이를 잰다:
       ① 홍예돌(cvous) × 나무(cwood·cwoodN) ② 서로 다른 문의 홍예돌(앞면 법선이 다른 두 cvous — 같은 테의 이웃 쐐기돌은 법선이 같다). 깊이 > 0.03 = 0 ═══ */
    const g2 = await page.evaluate(()=>{ const W = window, THREE = W.__THREE, list = {vous:[], wood:[]}, v = new THREE.Vector3();
      for(const [k, b] of W.__banks){ const kind = k === 'cvous' ? 'vous' : (k === 'cwood' || k === 'cwoodN') ? 'wood' : null; if(!kind || !b.ms || !b.ms.length) continue;
        const g = b.geo; if(!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox, c0 = bb.getCenter(new THREE.Vector3()), h0 = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        for(let i=0; i<b.ms.length; i++){ const e = b.ms[i].elements, A = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]], L = A.map(x=> Math.hypot(...x)); if(L.some(x=> x < 1e-4)) continue;
          v.copy(c0).applyMatrix4(b.ms[i]); list[kind].push({k, i, c:[v.x, v.y, v.z], U:A.map((x, j)=> x.map(y=> y/L[j])), h:[L[0]*h0.x, L[1]*h0.y, L[2]*h0.z]}); } }
      const dot = (a, b)=> a[0]*b[0] + a[1]*b[1] + a[2]*b[2], cross = (a, b)=> [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
      const depth = (P, Q)=>{ const d = [Q.c[0] - P.c[0], Q.c[1] - P.c[1], Q.c[2] - P.c[2]]; if(Math.hypot(...d) > Math.hypot(...P.h) + Math.hypot(...Q.h)) return 0;
        const ax = [...P.U, ...Q.U]; for(const a of P.U) for(const b of Q.U){ const c = cross(a, b), n = Math.hypot(...c); if(n > 1e-6) ax.push(c.map(x=> x/n)); }
        let m = 1e9; for(const a of ax){ const r = P.h[0]*Math.abs(dot(P.U[0], a)) + P.h[1]*Math.abs(dot(P.U[1], a)) + P.h[2]*Math.abs(dot(P.U[2], a)) + Q.h[0]*Math.abs(dot(Q.U[0], a)) + Q.h[1]*Math.abs(dot(Q.U[1], a)) + Q.h[2]*Math.abs(dot(Q.U[2], a));
          const o = r - Math.abs(dot(d, a)); if(o <= 0) return 0; if(o < m) m = o; } return m; };
      const bad = [], near = []; let pairs = 0;
      for(const P of list.vous){ for(const Q of list.wood){ pairs++; const dp = depth(P, Q); if(dp > 0.03) bad.push(['wood', Q.k, P.c.map(x=> +x.toFixed(2)), +dp.toFixed(3)]); else if(dp > 0) near.push(+dp.toFixed(3)); } }
      for(let a=0; a<list.vous.length; a++) for(let b=a+1; b<list.vous.length; b++){ const P = list.vous[a], Q = list.vous[b]; if(Math.abs(dot(P.U[2], Q.U[2])) > 0.9) continue; pairs++;
        const dp = depth(P, Q); if(dp > 0.03) bad.push(['vous', P.c.map(x=> +x.toFixed(2)), Q.c.map(x=> +x.toFixed(2)), +dp.toFixed(3)]); else if(dp > 0) near.push(+dp.toFixed(3)); }
      return {vous:list.vous.length, wood:list.wood.length, pairs, bad:bad.length, ex:bad.slice(0, 10), nearMax:near.length ? Math.max(...near) : 0, nearN:near.length}; });
    put({id:'G2', name:'서로 파고든 조각 — 홍예돌 × 나무 · 서로 다른 문의 홍예돌 깊이 > 0.03 = 0', pass:g2.bad === 0 && g2.vous > 100, detail:g2});
  }

  /* ═══ S — 세계 정적 항목(9-1 의 2~10·16~18) ═══ */
  if(have.layout){
    const S = await page.evaluate(()=>{
      const W = window, GY = W.__GY, HW = W.__HW, WS = HW*2 + 1, gi = (x, z)=> (x + HW) + (z + HW)*WS, C = W.__CASTLE, CR = W.__CR, CK = W.__CK, R = W.__CROOF, Z = W.__ZONE, th = W.__terrH;
      const o = {};
      let inYard = 0, corr = 0, lane = {n:0, bad:0}, solid = {n:0, bad:0}, scarp = {n:0, bad:0, step:0};
      for(let z=-HW; z<=HW; z++) for(let x=-HW; x<=HW; x++){
        const i = gi(x, z), k = C[i], od = W.__oct(x + 0.5, z + 0.5);
        if(k >= 1 && od <= 45.5) inYard++;
        const cd = W.__corridorDist(x + 0.5, z + 0.5);
        if(cd && cd[1] >= 46 && cd[1] <= 59.5 && Math.abs(cd[2]) < 6.6 && (k !== 0 || th[i] !== GY)) corr++;
        if(k === CK.LANE){ lane.n++; if(th[i] !== GY || !W.__walkable(x, z) || !W.__canPlace('wwall', x, z)) lane.bad++; }
        if(k >= CK.SOLID){ solid.n++; if(W.__walkable(x, z) || !W.__blockedAt(x, z) || W.__GATE_MASK[i] !== 1 || W.__zTop(x, z) !== 999) solid.bad++; }
        if(W.__castleScarp(x, z)){ scarp.n++; if(W.__dWall(x, z) <= 8 && th[i] > GY + 7) scarp.bad++;
          for(const [ax, az] of [[1,0],[0,1]]){ const j = gi(x + ax, z + az); if(W.__castleScarp(x + ax, z + az) && Math.abs(th[j] - th[i]) > 1) scarp.step++; } }
      }
      o.s2 = {inYard, corr}; o.s3 = {lane, scarp}; o.s4 = solid;
      /* 5 나선 */
      const sp = []; for(let k=0; k<W.__SPIRALS.length; k++){ const Sx = W.__SPIRALS[k]; let bad = 0, prev = -1e9, maxStep = 0;
        for(let j=0; j<Sx.n; j++){ const phi = (j + 0.5)*(2*Math.PI/Sx.m), q = Math.floor(phi/(2*Math.PI)), thw = Sx.th0 + phi, rm = (Sx.a + Sx.b)/2, x = Sx.cx + Math.cos(thw)*rm, z = Sx.cz + Math.sin(thw)*rm;   /* 70차 2회차 — 걸음선 = 몸 띠 가운데(탑 1.575 · K 1.1) */
          const h = W.__spiralH(k, x, z, Sx.y0 + q*Sx.Ht + (j % Sx.m + 1)*Sx.h); if(prev > -1e8){ maxStep = Math.max(maxStep, h - prev); if(h < prev - 1e-6) bad++; } prev = h;
          const lim = Math.min(2.3, W.__ceilingOver(x, z, 0.05, h) - 1.4 - h);        // 설계 9-1 5 ②: Δy 0 ~ min(2.3, 천장 − 1.4 − 디딤) — 윗끝 층계참 밑 디딤은 여유가 짧다
          for(const dy of [0, 0.5, 1.0, 1.5, 2.0, 2.3]) if(dy <= lim + 1e-9 && Math.abs(W.__spiralH(k, x, z, h + dy) - h) > 1e-6) bad++; }
        sp.push({k, bad, maxStep:+maxStep.toFixed(3)}); }
      o.s5 = sp;
      /* 7 CROOF 표본 */
      const cr = (x, z)=> R[gi(Math.floor(x), Math.floor(z))];
      o.s7 = {corr:cr(20, -51) & CR.G, post:cr(36, -51.5) & CR.W, watch:cr(34.5, -51.5) & CR.T, gal:cr(42.5, -42.5) & CR.W, bridgeRoof:cr(0, -51) & 7, runWall:cr(20, -51) & CR.RUN, runBridge:cr(0, -51) & CR.RUN,
        t1WestDW:cr(30.5, -51) & CR.DW, t1WestDG:cr(30.5, -51) & CR.DG, onBridge:W.__onCastleLayer(0, -51, GY + 8), underBridge:W.__onCastleLayer(0, -51, GY + 3), westDoor:W.__onCastleLayer(30.5, -51, GY + 8)};
      /* 8 천장 규칙 */
      let ceilBad = []; for(const b of W.__GBOX){ if(b.k !== W.__GK.FLOOR && b.k !== W.__GK.ROOF) continue;
        for(const fx of [0.25, 0.5, 0.75]) for(const fz of [0.25, 0.5, 0.75]){ const x = b.x0 + (b.x1 - b.x0)*fx, z = b.z0 + (b.z1 - b.z0)*fz;
          const g = W.__groundUnder(x, z, 0.05, b.y0 - 0.05), gap = b.y0 - g;
          /* 70차 2회차 — 회랑 마을 쪽 낮은 턱 윗면(8.32)은 뛰어 넘으며 잠깐 딛는 자리: 처마(10.25)까지 1.93 ≥ 몸 1.4 + 0.5 를 따로 본다(그 밖은 2.2 그대로) */
          const curb = Math.abs(g - (GY + W.__CW.WALK + W.__CW.CURB)) < 1e-6, need = curb ? 1.9 : 2.2;
          if(gap >= 0.01 && gap < need - 1e-6 && g > -900) ceilBad.push([+x.toFixed(1), +(g - GY).toFixed(2), +(b.y0 - GY).toFixed(2)]); } }
      o.s8 = {n:ceilBad.length, ex:ceilBad.slice(0, 5)};
      /* 16 ZONE·RUN 이음 — 곧은 성벽 길 걷는 폭 전체에서 onWallWalk 조건(RUN + y 8) · 주선 layerY 연속 */
      let wallBad = 0, wallN = 0; for(const s of W.__CPLAN.straights){ for(let P = 11; P < Math.abs(s.b.x - s.a.x) + Math.abs(s.b.z - s.a.z) + 11; P += 0.25)   /* 통합 — P 30 은 탑 얼굴(탑 칸) — 끝점 빼고 */ for(let v = 49.45; v <= 52.55; v += 0.25){
        const x = W.__gX(s.g, v, P*s.s), z = W.__gZ(s.g, v, P*s.s); wallN++; if(!(cr(x, z) & CR.RUN)) wallBad++; } }
      let zoneJump = 0; for(const Zn of W.__CPLAN.zones){ let prev = null; for(let sg = Zn.s0; sg <= Zn.s1; sg += 0.25){ const x = Zn.O.x + Zn.U.x*sg, z = Zn.O.z + Zn.U.z*sg, y = W.__layerY(x, z, 1);
        if(Z[gi(Math.floor(x), Math.floor(z))] < 0) zoneJump++; if(prev !== null && Math.abs(y - prev) > 0.35) zoneJump++; prev = y; } }
      o.s16 = {wallN, wallBad, zoneJump};
      /* 17 문턱과 둘레길 */
      let thr = 0; for(let z=-HW; z<=HW; z++) for(let x=-HW; x<=HW; x++){ const i = gi(x, z); if(C[i] !== CK.LANE) continue;
        for(let dz=-2; dz<=2; dz++) for(let dx=-2; dx<=2; dx++){ const j = gi(x + dx, z + dz); if(Math.hypot(dx, dz) > 1.55) continue;
          if((R[j] & (CR.DW | CR.DT)) && C[j] !== CK.LANE) thr++; if((C[j] === CK.CORR || C[j] === CK.TROOM) && !W.__sheltered(x + dx + 0.5, z + dz + 0.5, GY)) thr++; } }
      o.s17 = thr;
      /* 18 K 받침·시선 */
      let kb = 0; for(let z=50; z<64; z++) for(let x=-7; x<=7; x++) if(W.__kBand(x, z) && !(W.__CASTLE[gi(x, z)] >= 2) && !W.__tower66(x, z) && !W.__corridorDist(x + 0.5, z + 0.5)){   /* 통합 — 3·4 협곡 통로 칸(넓어지는 t ≥ 59)은 불가침(설계 9-1 2)이 먼저 */ const h = th[gi(x, z)]; if(h > GY + 10 || h < GY + 2) kb++; }
      let sight = 0; for(const s of W.__CPLAN.K.sight){ for(let f = 0.05; f < 0.97; f += 0.01){ const x = s[0] + (s[3] - s[0])*f, y = GY + s[1] + (s[4] - s[1])*f, z = s[2] + (s[5] - s[2])*f; if(W.__solidTop(Math.floor(x), Math.floor(z)) > y + 0.01) sight++; } }
      o.s18 = {kb, sight};
      return o; });
    put({id:'S2', name:'마당 불가침(od ≤ 45.5 성곽 칸 0) · 협곡 통로 칸 CASTLE 0·terrH GY', pass:S.s2.inYard === 0 && S.s2.corr === 0, detail:S.s2});
    put({id:'S3', name:'둘레길 전부 GY·걸을 수 있음·못 지음 · 해자·비탈 8칸 안 ≤ GY+7 · 2칸 챌판 0', pass:S.s3.lane.n > 500 && S.s3.lane.bad === 0 && S.s3.scarp.bad === 0 && S.s3.scarp.step === 0, detail:S.s3});
    put({id:'S4', name:'성곽 칸(≥ SOLID) — 못 걸음·막힘·GATE_MASK 1·zTop 999', pass:S.s4.n > 1000 && S.s4.bad === 0, detail:S.s4});
    put({id:'S5', name:'나선 9 — 한 단 ≤ 0.34 · 시계 방향 · 디딤 위 Δy 0~2 에서 높이 같음', pass:S.s5.length === 9 && S.s5.every(s=> s.bad === 0 && s.maxStep <= 0.34 + 1e-6), detail:S.s5});
    const c7 = S.s7;
    put({id:'S7', name:'CROOF 표본 — 복도 G·초소/회랑 W·망루 T·다리 지붕 0·RUN(벽·다리)·서쪽 8층 문 DW(땅층 DG 없음)·onCastleLayer 다리 위/밑', pass:!!(c7.corr && c7.post && c7.watch && c7.gal && !c7.bridgeRoof && c7.runWall && c7.runBridge && c7.t1WestDW && !c7.t1WestDG && c7.onBridge && !c7.underBridge && c7.westDoor), detail:c7});
    put({id:'S8', name:'천장 규칙 — FLOOR/ROOF 밑면 − 그 밑 딛는 면 ≥ 2.2(또는 붙음)', pass:S.s8.n === 0, detail:S.s8});
    put({id:'S16', name:'ZONE·RUN 이음 — 곧은 성벽 길 걷는 폭 전체 RUN · 구역 주선 ZONE·layerY 연속', pass:S.s16.wallN > 1000 && S.s16.wallBad === 0 && S.s16.zoneJump === 0, detail:S.s16});
    put({id:'S17', name:'둘레길 1.55 안 문턱 비트는 땅층 문(DG)뿐 · 복도 끝·탑 방은 sheltered', pass:S.s17 === 0, detail:S.s17});
    put({id:'S18', name:'K 받침 칸 GY+2~10 · K 시선 두 광선이 지형에 막힘 0', pass:S.s18.kb === 0 && S.s18.sight === 0, detail:S.s18});
  } else for(const [id, n] of [['S2','마당·협곡 불가침'],['S3','둘레길·해자·비탈'],['S4','성곽 칸 막힘'],['S5','나선 9'],['S7','CROOF 표본'],['S8','천장 규칙'],['S16','ZONE·RUN 이음'],['S17','문턱과 둘레길'],['S18','K 받침·시선']])
    put({id, name:n, wait:true, pass:!STRICT, detail:'갈래 1 합친 뒤(CASTLE·SPIRALS 가 비어 있음)'});

  /* ═══ S10 도달성 BFS — 지금 판에서도 66 성문(계단·다리 GBOX)으로 돈다. 성곽 목표는 몸이 합쳐진 뒤 ═══ */
  const bfs = await page.evaluate((body)=>{
    const W = window, GY = W.__GY, R = 0.28, ST = W.__STEP, CP = W.__CPLAN, q = 0.25, t0 = performance.now();
    const key = (ix, iz, iy)=> (ix + 400)*1e6 + (iz + 400)*1e3 + iy;
    const seen = new Map(), Q = []; let qh = 0;
    const start = [9, GY + 8, -51];
    const push = (x, z, y)=>{ const ix = Math.round(x/q), iz = Math.round(z/q), iy = Math.round((y - GY)*4) + 40; const k = key(ix, iz, iy); if(seen.has(k)) return; seen.set(k, y); Q.push(ix, iz, y); };
    push(start[0], start[2], W.__groundUnder(start[0], start[2], R, start[1]));
    let n = 0, outside = 0; const LIM = 900000;
    while(qh < Q.length && n < LIM){
      const ix = Q[qh++], iz = Q[qh++], y = Q[qh++]; n++;
      const x = ix*q, z = iz*q;
      if(W.__oct(x, z) < 30) continue;                                                                 // 마당 안쪽은 넓게 안 훑는다(계단 발치 t 33.5 바깥만)
      for(const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx*q, nz = z + dz*q; if(Math.hypot(nx, nz) > 76) continue;
        const g = W.__groundUnder(nx, nz, R, y); if(g > y + ST || g < -900) continue;
        const c = W.__ceilingOver(nx, nz, R, g); if(c - g < 1.4) continue;
        const cx = Math.floor(nx), cz = Math.floor(nz), i = W.__oct(nx, nz);
        if(body && W.__CASTLE[(cx + W.__HW) + (cz + W.__HW)*(W.__HW*2 + 1)] === 0 && i >= 53 && !W.__corridorDist(nx, nz) && g >= GY + 2) outside++;
        push(nx, nz, g);
      }
    }
    const reach = (x, y, z, tol = 0.6)=>{ for(const [k, yy] of seen){ const iz = Math.floor(k/1e3) % 1e3 - 400, ix = Math.floor(k/1e6) - 400; if(Math.abs(ix*q - x) <= tol && Math.abs(iz*q - z) <= tol && Math.abs(yy - (GY + y)) < 0.8) return true; } return false; };
    const tg = {yards:[], plaza:reach(8.5, 0, -32, 1)};
    for(let g=0; g<5; g++) for(const s of [-1, 1]) tg.yards.push(reach(W.__gX(g, 51, 9*s), 8, W.__gZ(g, 51, 9*s), 0.8));
    if(body){
      tg.towers = CP.towers.map(T=>{ const x = (T.armA.x0 + T.armA.x1)/2, z = (T.armA.z0 + T.armA.z1)/2; return [reach(x, 0, z), reach(x, 8, z), reach(x, 12, z)]; });
      tg.K = reach(0, 14, 59.5); tg.spark = CP.spark.map(s=> reach(s.p[0], s.p[1], s.p[2]));
      tg.secretClosed = CP.secrets.map(s=> reach(s.chest.x, s.chest.y, s.chest.z, 0.9));
    }
    return {n, outside, ms:Math.round(performance.now() - t0), tg};
  }, body);
  put({id:'S10a', name:'도달성 BFS(0.25칸·층) — 1모둠 망루 윗마당에서 다섯 성문 윗마당(10)·마당', pass:bfs.tg.yards.filter(Boolean).length === 10 && bfs.tg.plaza,
       detail:{n:bfs.n, ms:bfs.ms, yards:bfs.tg.yards.map(Number).join(''), plaza:bfs.tg.plaza}});
  if(body){
    put({id:'S10b', name:'BFS — 탑 8 × (1층·초소·망루)·K 윗마당·반짝 후보 27 닿음 · 성 밖 칸 0 · 닫힌 비밀 방 안 닿음', pass:bfs.tg.towers.every(t=>t.every(Boolean)) && bfs.tg.K && bfs.tg.spark.every(Boolean) && bfs.outside === 0 && bfs.tg.secretClosed.every(v=>!v),
         detail:{towers:bfs.tg.towers.map(t=>t.map(Number).join('')).join(' '), K:bfs.tg.K, spark:bfs.tg.spark.map(Number).join(''), outside:bfs.outside, secret:bfs.tg.secretClosed}});
  } else put({id:'S10b', name:'BFS — 탑·K·반짝 27·성 밖 0·닫힌 비밀 방', wait:true, pass:!STRICT, detail:'갈래 1 합친 뒤'});

  /* ═══ W8(api)·W8b(api) — 보물 흐름을 검사 API로 흉내(지금 판에서 돈다) ═══ */
  const tre = await page.evaluate(()=>{
    const W = window, G = W.__G, P = W.__PL, K = W.__KEY, GY = W.__GY, CP = W.__CPLAN, TRE = W.__TRE(), KIT = W.__KIT, o = {};
    const potN = ()=> KIT.pot.reduce((a, b)=>a + b, 0);
    const gold = ()=>{ const pc = W.__myPC(); return (pc.o || 0); };
    const tick = (n, dt = 1/60)=>{ for(let i=0; i<n; i++) W.__updCastleTreasure(dt); };
    W.__treReset(); G.phase = 'day'; G.t = G.set.daySec; KIT.pot = [0,0,0,0];
    for(const k in K) K[k] = false;
    const spiralAt = (id)=>{ const s = CP.secrets[id], t = CP.towers[s.spiral], r = 1.47; Object.assign(P, {x:t.scx + Math.cos(s.th)*r, z:t.scz + Math.sin(s.th)*r, y:GY + s.y, yaw:Math.atan2(-Math.cos(s.th), -Math.sin(s.th)), mv:true, vx:0, vz:0, down:false}); K.w = true; };
    const landAt = (id)=>{ const d = CP.secrets[id].door, R = P.R, cx = (d.x0 + d.x1)/2, cz = (d.z0 + d.z1)/2;
      Object.assign(P, {x:d.nx ? (d.nx > 0 ? d.x1 : d.x0) + d.nx*(R + 0.1) : cx, z:d.nz ? (d.nz > 0 ? d.z1 : d.z0) + d.nz*(R + 0.1) : cz, y:GY, vx:-d.nx*5.94, vz:-d.nz*5.94, mv:true, down:false}); P.blkX = 1; P.blkZ = 1; };
    const off = ()=>{ K.w = false; P.mv = false; P.vx = 0; P.vz = 0; delete P.blkX; delete P.blkZ; };
    const at = (p)=>{ Object.assign(P, {x:p.x, z:p.z, y:GY + p.y}); tick(3); };
    for(const k of Object.keys(localStorage)) if(k.startsWith('tre67|')) localStorage.removeItem(k);   // 앞 판에서 남은 장부를 지운다
    /* ① T8 숨은 문 — 세 dt */
    o.openT = [];
    for(const dt of [1/60, 1/30, 1/20]){ for(const k of Object.keys(localStorage)) if(k.startsWith('tre67|')) localStorage.removeItem(k); W.__treReset(); G.phase = 'day'; spiralAt(0); let t = 0; while(!W.__SECRET_OPEN[0] && t < 2){ W.__updCastleTreasure(dt); t += dt; } o.openT.push(+t.toFixed(3)); off(); }
    for(const k of Object.keys(localStorage)) if(k.startsWith('tre67|')) localStorage.removeItem(k); W.__treReset(); const gA = gold(); KIT.pot = [0,0,0,0]; W.__treForce(0.1);
    spiralAt(0); tick(60); off(); at(CP.secrets[0].coin); at(CP.secrets[0].chest);
    o.day1 = {pot:potN(), gold:gold() - gA, n:TRE.n};
    landAt(1); tick(60); off(); at({x:CP.secrets[1].chest.x, y:0, z:CP.secrets[1].chest.z});
    o.day1b = {pot:potN(), open2:W.__SECRET_OPEN[1], toast:document.getElementById('toast').textContent};
    G.phase = 'night'; tick(2); at(CP.secrets[0].chest); o.nightPot = potN();
    G.phase = 'day'; G.day += 1; tick(2); at({x:CP.secrets[1].chest.x + 3, y:0, z:CP.secrets[1].chest.z}); at(CP.secrets[1].coin); at({x:CP.secrets[1].chest.x, y:0, z:CP.secrets[1].chest.z});   /* 통합 — 창고 금화 더미를 상자에서 1.26 떼어(따로 줍게) 금화 자리도 들른다 */
    o.day2 = {pot:potN(), gold:gold() - gA, n:TRE.n, day:TRE.day};
    G.day += 1; tick(2); at(CP.secrets[0].chest); o.day3 = {pot:potN(), gold:gold() - gA};
    /* 새로고침 흉내 — 장부를 지우고 다시 읽는다(같은 날) */
    const before = JSON.stringify([TRE.found, TRE.paid, TRE.n, TRE.opened]);
    const ls = Object.keys(localStorage).filter(k=>k.startsWith('tre67|'));
    W.__treReset(); W.__treLedger(); o.restore = {before, after:JSON.stringify([TRE.found, TRE.paid, TRE.n, TRE.opened]), open:Array.from(W.__SECRET_OPEN), ls:ls.length};
    /* W8b 반짝 */
    G.day += 1; G.t = G.set.daySec; tick(2); const S = W.__treSpots(); const g1 = gold();
    G.t = G.set.daySec - 85; tick(2);
    const p0 = CP.spark[S.spot[0]].p, p1 = CP.spark[S.spot[1]].p;
    at({x:p0[0], y:p0[1], z:p0[2]}); const a = gold() - g1; at({x:p1[0], y:p1[1], z:p1[2]}); const b = gold() - g1 - a;
    o.spark = {spots:S.spot, byG:S.spot.every((j, g)=> CP.sparkByG[g].includes(j)), distinct:new Set(S.spot).size, at:S.at, first:a, second:b};
    W.__treForce(-1); off();
    return o; });
  put({id:'W8a', name:'보물(api) — ① 숨은 문 0.8~1.0초에 열림(dt 1/60·1/30·1/20)', pass:tre.openT.every(t=> t >= 0.8 - 1e-6 && t <= 1.0 + 1e-6), detail:tre.openT});
  put({id:'W8a', name:'보물(api) — ① 첫날: 금화 ✨+1 · 상자 물약 +1', pass:tre.day1.pot === 1 && tre.day1.gold === 1 && tre.day1.n === 1, detail:tre.day1});
  put({id:'W8a', name:"보물(api) — 같은 날 ② 거절('가방이 꽉') · 밤엔 거절", pass:tre.day1b.pot === 1 && tre.day1b.open2 === 1 && tre.nightPot === 1, detail:tre.day1b});
  put({id:'W8a', name:'보물(api) — 다음 날 ② 물약 +1 · ✨+1(② 첫 발견 금화) · 그다음 날 ① ✨+0', pass:tre.day2.pot === 2 && tre.day2.gold === 2 && tre.day3.pot === 3 && tre.day3.gold === 2, detail:{d2:tre.day2, d3:tre.day3}});
  put({id:'W8a', name:'보물(api) — 새로고침(장부 다시 읽기) 뒤 같은 날 한도·찾은 문 유지(localStorage)', pass:tre.restore.before === tre.restore.after && tre.restore.open[0] === 1 && tre.restore.open[1] === 1 && tre.restore.ls >= 2, detail:tre.restore});
  put({id:'W8b', name:'반짝(api) — 다섯 자리 = sparkByG 구간마다 하나 · 첫 곳 ✨+1 · 둘째 0', pass:tre.spark.byG && tre.spark.distinct === 5 && tre.spark.first === 1 && tre.spark.second === 0, detail:tre.spark});

  /* ═══ W — 실제 걷기(갈래 1 몸이 합쳐진 뒤) ═══
     통합 — 옛 판(몸 없이 짠 H.route)은 ① 나선을 웨이포인트로 겨눠 1층 문 밖으로 도로 걸어 나가고(W1·W2) ② W6 을 문 반대쪽(yaw π)을 보고 세우고
     ③ W9b 를 끝점(51,−9)으로 한 번 겨눠(설계는 '동쪽 한 번') 흉벽에 비볐고 ④ W5 를 점프 없이 흉벽(0.85 > STEP)에 밀었다.
     여기서는 갈래 1 걷기 시험(scratchpad c1 lib·w1~w3)의 틀을 그대로 옮긴다: 나선 구간은 W 만(레일·층 멈춤이 시선을 돌림),
     yaw 고정 길은 설계 9-2 대로 한 번만 돌린다. 기준 수치는 설계서 그대로다.
     69차(선생님: "계단에 들어가면 조작이 고정이 돼") — 나선 레일·층 멈춤·시선 도우미(문 깔때기 시선·회랑 시선)를 없앴다. 나선은 아이처럼
     0.25초마다 접선 앞 점을 한 번 겨누고 W(climb) — 자유 걷기로 1층→초소→망루·끼임 0·천장 뚫림 0. 'yaw 한 번' 길(W1b·W9b·W9c)은
     시선을 돌려 주던 도우미가 없으니 '꺾는 곳에서만 yaw(legs)' 로 바꿨다(기준 시간·멈춤 0 은 그대로). W17 시점 복귀 · W18 계단 카메라 떨림 · W19 시선 안 돌림 · G1 겹친 면 */
  const W_LIST = [['W1','선생님 길(마당→암문→복도→T1→나선→초소→회랑→T2→곧은 성벽 길→성문 2→계단→마당)'],['W1b','초소 → 회랑 → T2 남문(꺾는 곳에서만 yaw)'],['W1c','성벽 길 → 나선(자유 걷기) → 망루'],['W1d','회랑 → 초소 반짝 자리'],
    ['W2','성문 3 → K 나선 → K 윗마당 → 성문 4'],['W3','천장 — 2단 점프·활공이 천장을 못 뚫음'],['W4','성 밖 — 트인 성벽 길·망루 얼굴·K 에서 바깥으로 뛰어도 해자·산 착지 0'],['W5','트인 성벽 길에서 마을 쪽으로 뛰어내림'],
    ['W6','나선 자유 걷기 — 여덟 탑 1층→초소(8)→망루(12)→1층 · 끼임 0 · 천장 뚫림 0 · 튐 0'],['W6b','1층 문 정면 쐐기 폭 전체 멈춤 0'],['W6c','8층 문을 멈춤 없이 지나 망루까지 한 번에 · 달리기(Shift)도'],['W6d','숨은 문 탑(T8·T4·T6) — 속도 튐 0 · 숨은 문 벽에 막혀 밀기 자리(r ≈ b − R = 2.42)'],['W7','회랑 비비기 속도 ≥ 85%'],
    ['W8w','보물(걷기) — 문에 부딪혀 밀기 세 dt'],['W9a','성문 1 → 성문 2 달리기 8.6 ± 1초(yaw 돌려 줌)'],['W9b','같은 길 꺾는 곳에서만 yaw ≤ 10초'],['W9c','문 앞 붙어 달리기 문설 걸림 0(꺾는 곳에서만 yaw)'],['W10','문턱 드나들기 tpvKind 바뀜 ≤ 2'],
    ['W11','둘레길 대각 벽 비비기(기록)'],['W12','지붕 위에서 떨어짐 — 들썩임 0'],['W13','벽 5초 밀기 — 순간이동 0'],['W14','성문 망대 옆 2단+활공 — 망루 FENCE 밖 착지 0'],['W15','공중 구조 오작동 0'],['W16','3인칭 카메라 — 트인 곳 한 바퀴, 카메라 점이 상자·성곽 칸 속 0'],
    ['W17','성 안 → 밖 — 자동 1인칭이 풀려 원래 시점(3인칭·거리 그대로)으로(암문·구석 문·8층 문·회랑 끝·문턱 서성이기·뛰어내리기·쓰러졌다 일어나기·휠 굴린 뒤)'],
    ['W18','계단 카메라 떨림 — 성문 계단·나선 오르내리기 카메라 y 2차 차분 ≤ 0.02 · 내려갈 때 착지 효과 0'],['W19','시선 도우미 없음 — 문·회랑·나선을 W 로 지나는 동안 yaw 가 저절로 안 바뀜']];
  if(!body){ for(const [id, n] of W_LIST) put({id, name:n, wait:true, pass:!STRICT, detail:'갈래 1 합친 뒤(몸·나선·자동 1인칭)'}); }
  else {
    /* 걷기 도우미(페이지 안) — 한 프레임 = __updPlayer(dt) + (보물 걷기에서만) __updCastleTreasure(dt) */
    await page.evaluate(()=>{ const W = window, GY = W.__GY, PL = W.__PL, KEY = W.__KEY, cam = W.__cam; W.__DBG().noLogic = true;
      const f2 = v=> +(+v).toFixed(2);
      const LOG = {frames:0, maxDy:0, camBad:0, camBadAt:null, flips:[], lastTpv:null, ceilBad:0, tre:false};
      const inBox = (b, x, y, z)=> x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1;
      const camInside = ()=>{ const x = cam.position.x, y = cam.position.y, z = cam.position.z;
        if(W.__solidTop(Math.floor(x), Math.floor(z)) > y + 0.05) return 'cell';
        const a = W.__gboxGrid.get((Math.floor(x/4) + 64)*256 + (Math.floor(z/4) + 64)) || [];
        for(const b of a) if(b.k !== 3 && !b.off && inBox(b, x, y, z)) return 'box';
        return null; };
      const step = (dt)=>{ const y0 = PL.y; W.__updPlayer(dt); if(LOG.tre) W.__updCastleTreasure(dt); LOG.frames++;
        const dy = Math.abs(PL.y - y0); if(dy > LOG.maxDy && PL.vy > -5) LOG.maxDy = dy;
        const tk = W.__tpvKind(); if(LOG.lastTpv !== null && tk !== LOG.lastTpv) LOG.flips.push([f2(LOG.frames/60), tk, f2(PL.x), f2(PL.y - GY), f2(PL.z)]); LOG.lastTpv = tk;
        if(tk === 1){ const c = camInside(); if(c){ LOG.camBad++; if(!LOG.camBadAt) LOG.camBadAt = [c, f2(PL.x), f2(PL.y - GY), f2(PL.z)]; } }
        if(PL.y + 1.4 > W.__ceilingOver(PL.x, PL.z, PL.R, PL.y) + 0.01) LOG.ceilBad++; };
      const keys = (o)=>{ for(const k in KEY) KEY[k] = false; for(const k in o) KEY[k] = o[k]; };
      const place = (x, y, z, yawTo)=>{
        Object.assign(PL, {x, z, y:GY + y, vy:0, vx:0, vz:0, _px:undefined, down:false, jumps:0, ground:true}); keys({});
        if(yawTo) PL.yaw = Math.atan2(-(yawTo[0] - x), -(yawTo[1] - z)); PL.pitch = -0.1; for(let i=0; i<3; i++) step(1/60); };
      const faceTo = (x, z)=>{ PL.yaw = Math.atan2(-(x - PL.x), -(z - PL.z)); };
      const go = (x, z, o = {})=>{ const dt = o.dt || 1/60, tol = o.tol || 0.45, maxT = o.maxT || 20; let t = 0, stalls = 0, px = PL.x, pz = PL.z, lm = 0;
        keys({w:true, shift:!!o.shift}); faceTo(x, z);
        while(t < maxT){ faceTo(x, z); step(dt); t += dt; const d = Math.hypot(PL.x - x, PL.z - z);
          if(Math.hypot(PL.x - px, PL.z - pz) > 0.1){ px = PL.x; pz = PL.z; lm = t; } if(t - lm > 1.0){ stalls++; lm = t; }
          if(d < tol && (o.y === undefined || Math.abs(PL.y - GY - o.y) < 0.4)) break; }
        keys({}); return {t:f2(t), ok:Math.hypot(PL.x - x, PL.z - z) < tol + 0.05 && (o.y === undefined || Math.abs(PL.y - GY - o.y) < 0.4), stalls, at:[f2(PL.x), f2(PL.y - GY), f2(PL.z)]}; };
      const hold = (k, cond, maxT, dt)=>{ dt = dt || 1/60; let t = 0, stalls = 0, px = PL.x, pz = PL.z, py = PL.y, lm = 0; keys(k);
        while(t < maxT){ step(dt); t += dt; if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t; }
          if(t - lm > 1.0){ stalls++; lm = t; } if(cond()) break; }
        keys({}); return {t:f2(t), ok:!!cond(), stalls, at:[f2(PL.x), f2(PL.y - GY), f2(PL.z)]}; };
      W.WK = {LOG, step, keys, place, go, hold, faceTo, f2, GY, PL, KEY, camInside}; });
    const walk = await page.evaluate(()=>{
      const {LOG, place, go, hold, keys, f2, GY, PL, step} = window.WK, W = window, R = {}, HW = W.__HW, WS = 2*HW + 1;
      const gi = (x, z)=> (Math.floor(x) + HW) + (Math.floor(z) + HW)*WS;
      const inCage = ()=> W.__stairOf[gi(PL.x, PL.z)] >= 1000, T = W.__CPLAN.towers;
      const xf = (i, x, z)=>{ const R2 = (p)=>[-p[1], p[0]], M = (p)=>[-p[1], -p[0]]; let q = (i & 1) ? M([x, z]) : [x, z]; for(let n = i >> 1; n > 0; n--) q = R2(q); return q; };
      for(let i=0; i<5; i++){ W.__SECRET_OPEN[i] = 0; const b = W.__CPLAN.secrets[i].box; if(b) b.off = false; }   // 앞 단계(보물 api)가 연 문을 닫는다
      const aimAtCage = (i)=>{ PL.yaw = Math.atan2(-(T[i].scx - PL.x), -(T[i].scz - PL.z)); };
      /* 69차 — 나선 자유 걷기(아이 손): 0.25초마다 한 번 시선을 접선 앞 점(반지름 1.2 · 오름 +0.45 rad / 내림 −0.45)으로 고치고 W.
         우리 밖(문 쪽)이면 우리 가운데를 본다. 목표 층(toY)에 닿으면 문 쪽(th0)으로 틀어 우리 밖으로 걸어 나간다(exit). 레일·멈춤 없음 */
      const climb = (i, toY, o = {})=>{ const S = W.__SPIRALS[i]; let t = 0, fr = 0, stalls = 0, lm = 0, px = PL.x, pz = PL.z, py = PL.y, vmax = 0, ceil0 = LOG.ceilBad, maxDy = 0;
        const up = GY + toY > PL.y + 0.01; keys({w:true, shift:!!o.run});
        const aim = ()=>{ const dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz);
          if(r > S.b - 0.02){ PL.yaw = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z)); return; }
          const th = Math.atan2(dz, dx) + (up ? 0.45 : -0.45), ra = (S.a + S.b)/2 + 0.1, tx = S.cx + Math.cos(th)*ra, tz = S.cz + Math.sin(th)*ra; PL.yaw = Math.atan2(-(tx - PL.x), -(tz - PL.z)); };   /* 70차 2회차 — 겨눔 반지름 1.2 → 몸 띠 가운데 + 0.1(넓힌 나선) */
        const done = ()=> up ? PL.y - GY >= toY - 0.02 : PL.y - GY <= toY + 0.02;
        while(t < (o.maxT || 10) && !done()){ if(fr % 15 === 0) aim(); const x0 = PL.x, z0 = PL.z, y0 = PL.y; step(1/60); t += 1/60; fr++;
          vmax = Math.max(vmax, Math.hypot(PL.x - x0, PL.z - z0)*60); maxDy = Math.max(maxDy, Math.abs(PL.y - y0));
          if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t; } if(t - lm > 1){ stalls++; lm = t; } }
        const r = {t:f2(t), ok:done(), stalls, vmax:f2(vmax), maxDy:f2(maxDy), at:[f2(PL.x), f2(PL.y - GY), f2(PL.z)]};
        if(r.ok && o.exit !== false){ const eth = o.exitTh === undefined ? S.th0 : o.exitTh, ex = S.cx + Math.cos(eth)*(S.b + 0.9), ez = S.cz + Math.sin(eth)*(S.b + 0.9); let t2 = 0, fr2 = 0;
          while(t2 < 4 && (inCage() || Math.hypot(PL.x - ex, PL.z - ez) > 0.35)){ if(fr2 % 15 === 0) PL.yaw = Math.atan2(-(ex - PL.x), -(ez - PL.z)); const x0 = PL.x, z0 = PL.z; step(1/60); t2 += 1/60; fr2++;
            if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t + t2; } if(t + t2 - lm > 1){ stalls++; lm = t + t2; } }
          r.exit = f2(t2); r.stalls = stalls; r.ok = !inCage() && Math.abs(PL.y - GY - toY) < 0.05; r.at = [f2(PL.x), f2(PL.y - GY), f2(PL.z)]; }
        keys({}); r.ceilBad = LOG.ceilBad - ceil0; return r; };
      /* 꺾는 곳에서만 yaw — legs: [[과녁 x, z, 끝 조건(선택)], …]. 다리마다 처음 한 번 과녁을 겨누고 그 뒤로는 손대지 않는다 */
      const legs = (L, o = {})=>{ let t = 0, stalls = 0, lm = 0, px = PL.x, pz = PL.z, py = PL.y, ok = true; keys({w:true, shift:!!o.shift}); const out = [];
        for(const [x, z, cond, tol] of L){ PL.yaw = Math.atan2(-(x - PL.x), -(z - PL.z)); let tl = 0;
          const fin = cond || (()=> Math.hypot(PL.x - x, PL.z - z) < (tol || 0.6));
          while(tl < (o.maxLeg || 8) && !fin()){ step(1/60); tl += 1/60;
            if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t + tl; } if(t + tl - lm > 1){ stalls++; lm = t + tl; } }
          t += tl; out.push([f2(tl), f2(PL.x), f2(PL.z)]); if(!fin()){ ok = false; break; } }
        keys({}); return {t:f2(t), ok, stalls, legs:out, at:[f2(PL.x), f2(PL.y - GY), f2(PL.z)]}; };

      /* W1 선생님 길 — 나선 구간은 우리 안을 보고 W 만(레일·층 멈춤), 나머지는 웨이포인트를 겨눔 */
      { const t0 = LOG.frames; place(16, 0, -40, [16, -48]); LOG.maxDy = 0; LOG.flips = []; LOG.camBad = 0; LOG.camBadAt = null; LOG.ceilBad = 0;
        const seg = {}; seg.lane = go(16, -48.4); seg.door = go(16, -51); seg.corr = go(29, -51); seg.room = go(31.5, -51.5); seg.cage = go(37, -53.4, {tol:0.35});   /* 70차 2회차 — 나선 문 x 37(우리 6×6) */
        seg.spiral = climb(0, 8);
        seg.post = go(37, -52.5, {y:8}); seg.bend = go(36, -51.2, {y:8}); seg.galDoor = go(36, -49, {y:8, tol:0.5});   /* 69차 — 회랑 문은 곧은 문(가운데 x 36) */ seg.gallery = go(49, -36, {y:8, tol:0.5});
        seg.t2bend = go(51, -34, {y:8}); seg.t2door = go(51, -30, {y:8}); seg.wall = go(51, -9, {y:8}); seg.landing = go(48, -8.5, {y:8}); seg.stairs = go(33.5, -8.5, {tol:0.5}); seg.town = go(25, -5);
        const fl = LOG.flips.filter(f=> f[0] > t0/60 + 0.2);
        R.W1 = {seg, ok:Object.values(seg).every(r=> r.ok), stalls:Object.values(seg).reduce((a, r)=> a + r.stalls, 0), sec:f2((LOG.frames - t0)/60), maxDy:f2(LOG.maxDy),
          camIn:fl.filter(f=> f[1] === -1).length, camOut:fl.filter(f=> f[1] === 1).length, flips:fl, camBad:LOG.camBad, camBadAt:LOG.camBadAt, ceilBad:LOG.ceilBad}; }
      /* W6 — 여덟 탑 자유 걷기: 1층 문 앞 → 나선 → 8층 문으로 초소 · 초소 → 나선 → 12층 망루 · 망루 → 나선 → 1층 */
      R.W6 = [];
      for(let i=0; i<8; i++){ const d = xf(i, 37, -52.2); place(d[0], 0, d[1]);
        const a = climb(i, 8), b = climb(i, 12), c = climb(i, 0); R.W6.push([T[i].id, {a, b, c}]); }
      { const i = 7, S = W.__SPIRALS[i], a = S.th0 + 1.5*Math.PI;          // 숨은 문 쐐기에서 벽 쪽을 보고 W → 우물 벽에 막혀 선다(밀기 자리 r ≈ b − R)
        place(S.cx + Math.cos(a)*(S.a + S.b)/2, 10/3, S.cz + Math.sin(a)*(S.a + S.b)/2); PL.yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); keys({w:true});
        for(let k=0; k<60; k++) step(1/60); keys({}); R.W6push = {r:f2(Math.hypot(PL.x - S.cx, PL.z - S.cz)), y:f2(PL.y - GY)}; }
      /* W6b — 1층 문 정면(yaw 고정)으로 쐐기 폭 ±0.5(70차 2회차 — 문 1.6 − 몸 지름) 에서 1칸 깊이까지 */
      R.W6b = [];
      for(const off of [-0.5, -0.25, 0, 0.25, 0.5]){ place(37 + off, 0, -51.8); PL.yaw = 0; keys({w:true}); let t = 0;
        while(t < 1.5 && PL.z > -54.2){ step(1/60); t += 1/60; } keys({}); R.W6b.push([off, f2(t), f2(PL.z), f2(PL.y - GY)]); }
      /* W6c — 1층에서 망루(12)까지 한 번에(8층 문에서 안 멈춤) · 달리기로도 · 12층에서 1층까지 한 번에 */
      { place(37, 0, -52.2); const a = climb(0, 12); place(37, 0, -52.2); const b = climb(0, 12, {run:true}); const c = climb(0, 0, {run:true}); R.W6c = {a, b, c}; }
      /* W6d — 숨은 문 탑(T8·T4·T6) 1층 → 초소: 속도가 걷기(5.94)를 넘게 튀지 않음 */
      R.W6d = [];
      for(const i of [7, 3, 5]){ const d = xf(i, 37, -52.2); place(d[0], 0, d[1]); const r = climb(i, 8); R.W6d.push([T[i].id, r]); }
      /* W1b 초소 → T2 남문(회랑 문 쪽을 한 번) · W1c 성벽 길 → 나선 → 망루 · W1d 회랑 문 → 초소 반짝 자리 */
      { place(36, 8, -52.5); R.W1b = legs([[36, -48.4], [47.6, -36.6], [50.4, -36], [51, -29.2, ()=> PL.z > -29.5 && PL.x > 49.5]]); }
      { place(26, 8, -51); PL.yaw = Math.atan2(-1, 0); const a = hold({w:true}, ()=> PL.x > 31.5, 4);
        const b = go(37, -52.6, {y:8}); const c = climb(0, 12); R.W1c = {a, b, c}; }
      { place(36, 8, -49.3); PL.yaw = Math.atan2(-(32.5 - 36), -(-56 + 49.3)); R.W1d = hold({w:true}, ()=> Math.hypot(PL.x - 32.5, PL.z + 56) < 1.2, 6); }   /* 70차 2회차 — 초소 반짝 자리 (32.5, −56) */
      /* W9 달리기 — (a) 웨이포인트마다 겨눔 (b) 동쪽 한 번만 · (c) 흉벽 쪽·성가퀴 쪽에서 출발 */
      W.__setStamina(0);
      { place(9, 8, -51); let tt = 0, st = 0, ok = true; for(const p of [[30, -51], [34, -51], [36, -49], [49, -36], [51, -34], [51, -30], [51, -9]]){ const r = go(p[0], p[1], {y:8, shift:true, tol:0.6}); tt += r.t; st += r.stalls; ok = ok && r.ok; }
        R.W9a = {t:f2(tt), ok, stalls:st, stamina:f2(W.__stamina())}; }
      for(const [nm, z0, x0] of [['W9b', -51, 9], ['W9c_in', -49.8, 12], ['W9c_out', -52.2, 9]]){ W.__setStamina(0); place(x0, 8, z0); PL.yaw = Math.atan2(-1, 0);   /* 흉벽 쪽은 66 망루 윗마당 모서리 망대(P 9~11) 곁을 지나서 — 탑 문설을 보는 검사 */
        /* 70차 — W9c 는 옛 출발 그대로: 가장자리(z −49.8 · −52.2)에서 yaw 를 동쪽으로 한 번 두고 8층 문을 지나 x 31.6 까지(문 깔때기의 '걸음 직선 옆 어긋남' 잡기).
           69차는 첫 다리를 문 가운데 ±0.4 로 겨누게 바꿔 이 상황(문설 걸림)을 재지 않았다 */
        const r = legs([nm === 'W9b' ? [30.2, -51] : [60, z0, ()=> PL.x > 31.6], [36, -51.3], [36, -48.4], [47.6, -36.6], [50.4, -36], [51, -29.2, ()=> PL.z > -29.5 && PL.x > 49.5], [51, -9, ()=> PL.z > -9.5 && PL.x > 49]], {shift:true}); r.stamina = f2(W.__stamina()); R[nm] = r; }
      /* W2 K — 성문 3 윗마당 → K 북문 → 나선(W 만) → 윗마당 → 되돌아 → 성문 4 윗마당 */
      { place(4, 8, 51); const a = go(0, 51), b = go(0, 53.6, {tol:0.35});
        const th0 = W.__SPIRALS[8].th0, c = climb(8, 14, {exitTh:th0 + Math.PI}); const d = go(0, 59.5, {y:14});   /* 69차 — K 나선도 자유 걷기(레일 없음) */
        const e = climb(8, 8, {exitTh:th0}); const f = go(0, 51, {y:8}), g = go(-4, 51, {y:8});
        R.W2 = {a, b, c, d, e, f, g, topY:c.at[1]}; }
      /* 2차 전직(점프 ×1.16 · 활공 1.2초)으로 W3·W4·W14·W15 */
      const XP = W.__XP, job0 = [XP.job, XP.jt]; XP.job = 0; XP.jt = 2; let rescues = 0;
      const jumpGlide = (sec, dirKey)=>{ let bad = 0; const k = {' ':true}; if(dirKey) k[dirKey] = true; keys(k); W.__wantJump(); step(1/60);
        for(let i=0; i<sec*60; i++){ if(i === 10) W.__wantJump(); const x0 = PL.x, z0 = PL.z; step(1/60);
          if(PL.y + 1.4 > W.__ceilingOver(PL.x, PL.z, PL.R, PL.y) + 0.01) bad++; if(Math.hypot(PL.x - x0, PL.z - z0) > 1.5) rescues++; }
        keys({}); for(let i=0; i<90; i++) step(1/60); return {bad, end:[f2(PL.x), f2(PL.y - GY), f2(PL.z)]}; };
      R.W3 = {};
      for(const [nm, p] of Object.entries({corr:[20, 0, -51], room:[33, 0, -51.5], post:[33, 8, -51.5], watch:[33, 12, -51.5], gal:[43, 8, -42.5], storage2:[48, 0, -9]})){
        place(p[0], p[1], p[2]); const sb = W.__CPLAN.secrets[1].box; if(nm === 'storage2') sb.off = true; R.W3[nm] = jumpGlide(2.5); sb.off = false; }
      { const S = W.__SPIRALS[0], a = S.th0 + 2.2; place(S.cx + Math.cos(a)*1.15, 4 + 2.2/(Math.PI*2)*4 + 0.2, S.cz + Math.sin(a)*1.15); R.W3.spiralMid = jumpGlide(2); }
      { W.__SECRET_OPEN[0] = 1; W.__CPLAN.secrets[0].box.off = true; place(-32.5, 10/3, -55); R.W3.hidden1 = jumpGlide(2); W.__SECRET_OPEN[0] = 0; W.__CPLAN.secrets[0].box.off = false; }
      const outside = ()=>{ const c = W.__CASTLE[gi(PL.x, PL.z)]; return c === 0 && W.__oct(PL.x, PL.z) >= 53 && !W.__corridorDist(PL.x, PL.z) && PL.y - GY >= 1.5; };
      const outLand = (x, y, z, yawOut)=>{ let n = 0; for(let i=0; i<20; i++){ place(x + (i % 5 - 2)*0.3, y, z); PL.yaw = yawOut + (i - 10)*0.03; jumpGlide(3, 'w'); if(outside()) n++; } return n; };
      R.W4 = {wallWalk:outLand(20, 8, -52.3, 0), gateFace:outLand(10, 8, -52.8, 0), kYard:outLand(0, 14, 60.6, Math.PI)};
      { let n = 0; for(let i=0; i<20; i++){ place(8.6 + (i % 4)*0.4, 8, -51.8 - (i % 3)*0.2); PL.yaw = (i % 2 ? 0.4 : -0.3); jumpGlide(3, 'w'); if(outside() && Math.abs(PL.x) > 9) n++; } R.W14 = n; }
      { let n = 0, tele = 0; for(const s of [[22, 8, -51, -Math.PI/2], [0, 14, 59.5, Math.PI/2], [8.5, 8, -51, Math.PI/2]]) for(let i=0; i<7; i++){ place(s[0], s[1], s[2]); PL.yaw = s[3] + (i - 3)*0.2; const r0 = rescues; jumpGlide(2.2, 'w'); n++; if(rescues > r0) tele++; }
        R.W15 = {runs:n, teleports:tele}; }
      XP.job = job0[0]; XP.jt = job0[1];
      /* W5 — 흉벽(0.85)은 걸어서 못 넘는다: 뛰어 넘어 마을 쪽으로 */
      { place(22, 8, -49.8); PL.yaw = Math.PI; const hp0 = PL.hp; W.__wantJump(); keys({w:true}); for(let i=0; i<120; i++) step(1/60); keys({});
        R.W5 = {end:[f2(PL.x), f2(PL.y - GY), f2(PL.z)], ck:W.__CASTLE[gi(PL.x, PL.z)], hurt:hp0 - PL.hp, od:f2(W.__oct(PL.x, PL.z))}; }
      /* W7 회랑 비비기 — 바깥 벽 쪽 30°·안쪽 30° 로 Shift+W 2초 */
      R.W7 = [];
      for(const side of [1, -1]){ place(40.5, 8, -45.5); const U = [0.707, 0.707], N = [0.707, -0.707], a = side*Math.PI/6;
        const dx = U[0]*Math.cos(a) + N[0]*Math.sin(a), dz = U[1]*Math.cos(a) + N[1]*Math.sin(a); PL.yaw = Math.atan2(-dx, -dz); W.__setStamina(1);
        keys({w:true, shift:true}); let outN = 0, dist = 0; const fr0 = LOG.frames;
        for(let i=0; i<120; i++){ const x0 = PL.x, z0 = PL.z; step(1/60); dist += (PL.x - x0)*U[0] + (PL.z - z0)*U[1];
          const e = (Math.abs(PL.x) + Math.abs(PL.z))*0.6; if(e < 49.72 - 0.01 || e > 52.02 + 0.01) outN++; if(PL.x > 46.8) break; }   /* 70차 4회차 — 탑 문 앞 2.6 칸(회랑 끝 문 쪽 조임 — 쐐기 대신 문으로 꺾는 곳)은 빼고 잰다(옛 47.5) · 끝 쐐기는 t70 C8 */
        keys({}); R.W7.push({side, outN, speedPct:f2(dist/(LOG.frames - fr0)*60/8.613*100)}); }
      /* W10 문턱 — 암문을 0.3초 간격으로 3초 드나들기 */
      { place(16, 0, -48.6); PL.yaw = 0; for(let i=0; i<60; i++) step(1/60); let flips = 0, last = W.__tpvKind();
        for(let k=0; k<10; k++){ keys(k % 2 ? {s:true} : {w:true}); for(let i=0; i<18; i++){ step(1/60); const t = W.__tpvKind(); if(t !== last){ flips++; last = t; } } }
        keys({}); for(let i=0; i<60; i++){ step(1/60); const t = W.__tpvKind(); if(t !== last){ flips++; last = t; } } R.W10 = flips; }
      /* W11 둘레길 대각 벽 안 얼굴에 30° 로 W 2초 — 칸 톱니(기록, 속도 ≥ 50% 면 통과) */
      { place(40, 0, -40.5); const U = [0.707, 0.707], N = [0.707, -0.707], a = Math.PI/6, dx = U[0]*Math.cos(a) + N[0]*Math.sin(a), dz = U[1]*Math.cos(a) + N[1]*Math.sin(a);
        PL.yaw = Math.atan2(-dx, -dz); keys({w:true}); let dist = 0, worst = 1e9; for(let s2=0; s2<4; s2++){ let d2 = 0; for(let i=0; i<30; i++){ const x0 = PL.x, z0 = PL.z; step(1/60); const q = (PL.x - x0)*U[0] + (PL.z - z0)*U[1]; dist += q; d2 += q; } worst = Math.min(worst, d2); }
        keys({}); R.W11 = {speedPct:f2(dist/2/(5.94*Math.cos(a))*100), worstHalfSec:f2(worst)}; }
      /* W12 지붕 위에서 떨어짐 */
      R.W12 = [];
      for(const p of [[43, 13, -42], [35.5, 21, -54.5]]){   /* 70차 2회차 — 탑 가운데 (35.5, −54.5) */ place(p[0], p[1], p[2]); PL.ground = false; const ys = []; let osc = 0; for(let i=0; i<150; i++){ step(1/60); ys.push(PL.y); }
        for(let i=2; i<ys.length; i++) if((ys[i] - ys[i-1])*(ys[i-1] - ys[i-2]) < 0 && Math.abs(ys[i] - ys[i-1]) > 0.3) osc++;
        R.W12.push({y:f2(PL.y - GY), osc}); }
      /* W13 벽 5초 밀기 */
      { place(20, 0, -51.2); PL.yaw = 0; let tp = 0; keys({w:true}); for(let i=0; i<300; i++){ const x0 = PL.x, z0 = PL.z; step(1/60); if(Math.hypot(PL.x - x0, PL.z - z0) > 1.5) tp++; } keys({}); R.W13 = tp; }
      /* W16 3인칭 카메라 — 트인 곳에서 한 바퀴 */
      { let bad = 0, at = null, n = 0; const z0 = W.__camZoom(); W.__camZoom(3.2);
        for(const s of [[22, 8, -51], [9, 8, -51], [0, 14, 59.5], [0, 8, 51], [51, 8, -20], [47.5, 0, -20], [32, 0, -47.6], [38, 0, -42], [9, 0, -40]]){ place(s[0], s[1], s[2]);
          for(let k=0; k<24; k++){ PL.yaw = k/24*Math.PI*2; for(const pt of [-0.4, -0.1, 0.3]){ PL.pitch = pt; for(let i=0; i<4; i++) step(1/60);
            if(W.__tpvKind() === 1){ n++; const c = window.WK.camInside(); if(c){ bad++; if(!at) at = [c, s, k, pt]; } } } } }
        W.__camZoom(z0); R.W16 = {n, bad, at}; }
      /* W17 — 성 안에서 나오면 원래 시점(3인칭 · 휠로 정한 거리 그대로). 선생님: "성 안에 있다가 나오면 3인칭으로 바뀌어야 되는데 안 바뀐다"
         (원인: 자동 1인칭 중 휠을 당기면 camZoom 이 0(진짜 1인칭)으로 저장됐다). 길 여덟 — 끝에서 1초 선 뒤 tpvKind 1 · camZoom 그대로 */
      { const z0 = W.__camZoom(), Z = 4.4; R.W17 = [];
        const settle = (n)=>{ keys({}); for(let i=0; i<n; i++) step(1/60); };
        const path = (nm, fn)=>{ W.__camZoom(Z); fn(); settle(60); R.W17.push({nm, tpv:W.__tpvKind(), zoom:f2(W.__camZoom()), auto:f2(W.__camAuto()), at:[f2(PL.x), f2(PL.y - GY), f2(PL.z)]}); };
        const inside = (x, y, z)=>{ place(x, y, z); settle(40); return W.__camAuto(); };
        path('corrDoor', ()=>{ inside(20, 0, -51); go(16, -50.2); go(16, -46.5); });
        path('nookDoor', ()=>{ inside(34, 0, -51.5); go(31.5, -50.3); go(31.5, -46.8); });
        path('spiralToWall', ()=>{ place(36, 0, -52.2); climb(0, 8); go(33, -51, {y:8}); go(29, -51, {y:8}); go(24, -51, {y:8}); });
        path('galleryEnd', ()=>{ inside(40, 8, -45.5); go(47.6, -36.6, {y:8}); go(50.4, -36, {y:8}); go(51, -29, {y:8}); go(51, -24, {y:8}); });
        path('threshold', ()=>{ place(16, 0, -48.6); PL.yaw = 0; settle(30); for(let k=0; k<10; k++){ keys(k % 2 ? {s:true} : {w:true}); for(let i=0; i<18; i++) step(1/60); } go(16, -45.5); });
        path('jumpDown', ()=>{ inside(33, 8, -51.5); go(29.5, -51, {y:8}); go(22, -50.2, {y:8}); PL.yaw = Math.PI; W.__wantJump(); keys({w:true}); for(let i=0; i<120; i++) step(1/60); });
        path('downUp', ()=>{ inside(20, 0, -51); PL.down = true; for(let i=0; i<120; i++) step(1/60); PL.down = false; settle(30); go(16, -50.2); go(16, -46.5); });
        path('wheel', ()=>{ const a = inside(20, 0, -51); R.W17wheelIn = f2(a); for(const d of [-100, -100, -100, 100, -100, -100]) window.dispatchEvent(new WheelEvent('wheel', {deltaY:d, cancelable:true}));
          R.W17wheelZoom = f2(W.__camZoom()); go(16, -50.2); go(16, -46.5); });
        W.__camZoom(z0); }
      /* W18 — 계단 카메라 떨림: 성문 2 남쪽 계단(x 33.5 ↔ 48 · z −8.5)·나선(T1) 오르내리기 — 카메라 y 의 프레임 2차 차분 최대(벽 때문에 카메라가 당겨진 프레임은 뺌)·착지 효과 수.
         69차 전: 3인칭 오름 0.143 · 내림 0.177(착지 8) · 1인칭 오름 0.32 · 나선 오름 0.333 · 내림 착지 35 */
      { const z0 = W.__camZoom(), cam = W.__cam; R.W18 = {};
        const run = (dur, until, steer)=>{ const ys = [], ds = []; let lands = 0;
          for(let t = 0; t < dur; t += 1/60){ if(steer) steer(t); const lt = PL.landT || 0; step(1/60); ys.push(cam.position.y); ds.push(W.__camRig().distance); if((PL.landT || 0) > 0.2 && lt < 0.2) lands++; if(until()) break; }
          let a2 = 0; for(let i=2; i<ys.length; i++){ if(ds[i] !== null && ds[i-1] !== null && ds[i-2] !== null && (Math.abs(ds[i] - ds[i-1]) > 0.02 || Math.abs(ds[i-1] - ds[i-2]) > 0.02)) continue;
            a2 = Math.max(a2, Math.abs(ys[i] - 2*ys[i-1] + ys[i-2])); }
          return {a2:+a2.toFixed(4), lands, ok:!!until()}; };
        for(const [nm, zoom] of [['3p', 3.2], ['1p', 0]]){ W.__camZoom(zoom);
          place(33.5, 0, -8.5); PL.yaw = -Math.PI/2; keys({w:true}); R.W18['gateUp' + nm] = run(6, ()=> PL.x > 47.6);
          place(48.2, 8, -8.5); PL.yaw = Math.PI/2; keys({w:true}); R.W18['gateDown' + nm] = run(6, ()=> PL.x < 33.8); keys({}); }
        W.__camZoom(3.2);
        { const S = W.__SPIRALS[0], aim = (up)=>{ const dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz);
            if(r > S.b - 0.02){ PL.yaw = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z)); return; }
            const th = Math.atan2(dz, dx) + (up ? 0.45 : -0.45), ra = (S.a + S.b)/2 + 0.1; PL.yaw = Math.atan2(-(S.cx + Math.cos(th)*ra - PL.x), -(S.cz + Math.sin(th)*ra - PL.z)); };
          place(37, 0, -52.2); keys({w:true}); R.W18.spiralUp = run(8, ()=> PL.y > GY + 11.9, (t)=>{ if(Math.round(t*60) % 15 === 0) aim(true); });
          keys({w:true}); R.W18.spiralDown = run(8, ()=> PL.y < GY + 0.1, (t)=>{ if(Math.round(t*60) % 15 === 0) aim(false); }); keys({}); }
        W.__camZoom(z0); }
      /* W19 — 시선 도우미 없음: 문 앞 20° 로 비스듬히 들어가기(깔때기 자리)·회랑 30° 로 비비기(1인칭)·나선 2초 — yaw 를 검사기가 안 건드리는 동안 게임도 안 바꾼다 */
      { const trial = (fn)=>{ fn(); const y0 = PL.yaw; let dmax = 0; for(let i=0; i<120; i++){ step(1/60); dmax = Math.max(dmax, Math.abs(PL.yaw - y0)); } keys({}); return +dmax.toFixed(6); };
        R.W19 = {door:trial(()=>{ place(17.2, 0, -46.5); PL.yaw = Math.atan2(-(16 - PL.x), -(-49.5 - PL.z)) + 0.35; keys({w:true}); }),
          gallery:trial(()=>{ place(40.5, 8, -45.5); W.__camZoom(0); PL.yaw = Math.atan2(-(0.707*Math.cos(0.5) + 0.707*Math.sin(0.5)), -(0.707*Math.cos(0.5) - 0.707*Math.sin(0.5))); keys({w:true}); }),
          spiral:trial(()=>{ W.__camZoom(3.2); place(37, 0, -52.2); keys({w:true}); for(let i=0; i<30; i++) step(1/60); PL.yaw = Math.atan2(-(34.8 - PL.x), -(-56 - PL.z)); }),
          gateDoor:trial(()=>{ place(28.5, 8, -51.6); PL.yaw = Math.atan2(-1, 0) - 0.3; keys({w:true}); })}; W.__camZoom(3.2); }
      /* ═══ 70차 추가 ═══ */
      /* W6k — 아이 손 모형: 시선 돌리는 빠르기 상한 ω(rad/s) · 반응 지연 lag(초) · 접선 앞 점(반지름 1.2, 오름 +0.45 · 내림 −1.0 rad — 내림은 빠르니 지연 동안 과녁이 등 뒤로 가지 않게 멀리)을 겨눔.
         여덟 탑 1층→망루(12)·망루→1층 멈춤(1초) 0.
         69차 W6 의 climb 은 0.25초마다 시선을 순간이동시켜 늘 반지름 1.2 근처라 문 쐐기 끼임(1층·8층 문 위 16/16)을 못 봤다 */
      { const kid = (i, toY, om, lag, maxT)=>{ const S = W.__SPIRALS[i], up = GY + toY > PL.y, hist = []; keys({w:true}); let t = 0, lm = 0, px = PL.x, pz = PL.z, py = PL.y, stalls = 0, maxStall = 0, at = null;
          const done = ()=> up ? PL.y - GY >= toY - 0.02 : PL.y - GY <= toY + 0.02;
          while(t < maxT && !done()){ const dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz); let want;
            if(r > S.b - 0.02) want = Math.atan2(-(S.cx - PL.x), -(S.cz - PL.z));
            else { const th = Math.atan2(dz, dx) + (up ? 0.45 : -1.0), ra = (S.a + S.b)/2 + 0.1; want = Math.atan2(-(S.cx + Math.cos(th)*ra - PL.x), -(S.cz + Math.sin(th)*ra - PL.z)); }
            hist.push(want); const w = hist[Math.max(0, hist.length - 1 - Math.round(lag*60))]; let d = w - PL.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); PL.yaw += Math.max(-om/60, Math.min(om/60, d));
            W.__KEY.w = Math.abs(d) < 1.6;                                        // 뒤돌 때는 W 를 뗀다(ω 한도로는 도는 몸을 못 따라잡아 제자리를 맴돈다 — 아이도 그렇게 한다)
            step(1/60); t += 1/60;
            if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t; } else if(t - lm > maxStall){ maxStall = t - lm; at = [f2(PL.x), f2(PL.y - GY), f2(PL.z)]; }
            if(t - lm > 1 && t - lm - 1/60 <= 1) stalls++; }
          keys({}); return {ok:done(), t:f2(t), stalls, maxStall:f2(maxStall), at}; };
        R.W6k = [];
        for(let i=0; i<8; i++) for(const [om, lag] of [[5, 0.2], [6, 0.15]]){ const d = xf(i, 37, -52.2); place(d[0], 0, d[1]); aimAtCage(i);
          const a = kid(i, 12, om, lag, 20), b = a.ok ? kid(i, 0, om, lag, 20) : {ok:false, skip:true}; R.W6k.push([T[i].id, om, lag, a, b]); } }
      /* W18b — 계단 카메라 떨림(달리기 · 30Hz): 성문 2 남쪽 계단 오르내리기. 60Hz ≤ 0.02 · 30Hz ≤ 0.08(같은 가속 — 프레임 간격 두 배면 2차 차분 네 배) */
      { const z0 = W.__camZoom(), cam = W.__cam; R.W18b = {};
        const run2 = (dt, until)=>{ const ys = [], ds = []; let t = 0; for(; t < 6; t += dt){ W.__setStamina(1); step(dt); ys.push(cam.position.y); ds.push(W.__camRig().distance); if(until()) break; }
          let a2 = 0; for(let i=2; i<ys.length; i++){ if(ds[i] !== null && ds[i-1] !== null && ds[i-2] !== null && (Math.abs(ds[i] - ds[i-1]) > 0.02 || Math.abs(ds[i-1] - ds[i-2]) > 0.02)) continue; a2 = Math.max(a2, Math.abs(ys[i] - 2*ys[i-1] + ys[i-2])); }
          return {a2:+a2.toFixed(4), ok:!!until(), t:f2(t)}; };
        for(const dt of [1/60, 1/30]) for(const sh of [true, false]) for(const [nm, zoom] of [['3p', 3.2], ['1p', 0]]){ if(dt < 0.02 && !sh) continue; W.__camZoom(zoom);
          const tag = (dt < 0.02 ? '60' : '30') + (sh ? 'run' : 'walk') + nm, lim = dt < 0.02 ? 0.02 : 0.08;
          place(33.5, 0, -8.5); PL.yaw = -Math.PI/2; keys({w:true, shift:sh}); const u = run2(dt, ()=> PL.x > 47.6); u.lim = lim; R.W18b[tag + 'Up'] = u;
          place(48.2, 8, -8.5); PL.yaw = Math.PI/2; keys({w:true, shift:sh}); const d = run2(dt, ()=> PL.x < 33.8); d.lim = lim; R.W18b[tag + 'Dn'] = d; keys({}); }
        W.__camZoom(z0); }
      /* W18c — 계단 카메라가 돌·땅 칸 속에 드는 프레임 0: 뒤로 오르기(S, 아래를 봄 · 줌 2·3.2·4.4·8 · 시선 −0.3·0·+0.3) · 위를 보며 오르기(W · 줌 3.2·6.8·10 · 시선 0.35·0.7) · 조준하고 뒤로 오르기 */
      { const z0 = W.__camZoom(); R.W18c = {n:0, bad:0, ex:[]};
        const cnt = (nm, until)=>{ let n = 0, bad = 0, at = null; for(let t=0; t<6; t+=1/60){ step(1/60); if(W.__tpvKind() === 1){ n++; const c = window.WK.camInside(); if(c){ bad++; if(!at) at = [c, f2(PL.x), f2(PL.y - GY), f2(W.__cam.position.y - GY)]; } } if(until()) break; }
          R.W18c.n += n; R.W18c.bad += bad; if(bad) R.W18c.ex.push([nm, bad, n, at]); };
        for(const zoom of [2, 3.2, 4.4, 8]) for(const pt of [-0.3, 0, 0.3]){ W.__camZoom(zoom); place(33.5, 0, -8.5); PL.yaw = Math.PI/2; PL.pitch = pt; keys({s:true}); cnt('back z' + zoom + ' p' + pt, ()=> PL.x > 47.6); keys({}); }
        for(const zoom of [3.2, 6.8, 10]) for(const pt of [0.35, 0.7]) for(const sh of [false, true]){ W.__camZoom(zoom); place(33.5, 0, -8.5); PL.yaw = -Math.PI/2; PL.pitch = pt; keys({w:true, shift:sh}); W.__setStamina(1); cnt('up z' + zoom + ' p' + pt + (sh ? ' run' : ''), ()=> PL.x > 47.6); keys({}); }
        W.__camZoom(3.2); place(33.5, 0, -8.5); PL.yaw = Math.PI/2; PL.pitch = -0.1; W.__setAim(true); for(let i=0; i<20; i++) step(1/60); keys({s:true}); cnt('aim back', ()=> PL.x > 47.6); keys({}); W.__setAim(false); for(let i=0; i<20; i++) step(1/60);
        PL.pitch = -0.1; W.__camZoom(z0); }
      /* W21 — 지도 방 선반(1.8 · 천장 3.0) 쪽으로 뛰기(T1·T5): 선반 위에 올라서지 않음 · 천장 뚫림 0. W3 과 같은 2차 전직(2단 점프) 몸 */
      { const XP2 = W.__XP, j0 = [XP2.job, XP2.jt]; XP2.job = 0; XP2.jt = 2; R.W21 = [];
        for(const i of [0, 4]) for(const [sx, sz] of [[33.0, -58.6], [33.0, -57.9], [33.2, -58.2]]){   /* 70차 2회차 — 선반은 armB 북쪽 끝으로 옮겼다(z −2) */ const p = xf(i, sx, sz), q = xf(i, 34, sz); place(p[0], 0, p[1]); PL.yaw = Math.atan2(-(q[0] - p[0]), -(q[1] - p[1]));
          const c0 = LOG.ceilBad; keys({w:true, ' ':true}); W.__wantJump(); let top = 0; for(let k=0; k<150; k++){ if(k === 12) W.__wantJump(); step(1/60); if(PL.ground) top = Math.max(top, PL.y - GY); } keys({}); for(let k=0; k<30; k++) step(1/60);
          R.W21.push({t:T[i].id, top:f2(top), ceil:LOG.ceilBad - c0}); }
        XP2.job = j0[0]; XP2.jt = j0[1]; }
      /* W22 — K 윗마당 층계참(y 14) 어디서나 점프가 뜸(층계참 밑면 13.75 를 발밑 천장으로 잡던 것) */
      { const K = W.__CPLAN.K, S = W.__SPIRALS[8]; let n = 0, bad = 0; const ex = [];
        for(let x = S.cx - 1.7; x <= S.cx + 1.7; x += 0.25) for(let z = S.cz - 1.7; z <= S.cz + 1.7; z += 0.25){ if(Math.hypot(x - S.cx, z - S.cz) > 1.75) continue;
          place(x, 14, z); if(Math.abs(PL.y - GY - 14) > 0.02 || !PL.ground || W.__groundUnder(PL.x, PL.z, PL.R, PL.y) > PL.y + 0.01) continue; n++;   /* 설 수 있는 자리만(우물 벽에 몸이 걸친 자리 빼고) */ W.__wantJump(); let top = PL.y; for(let k=0; k<40; k++){ step(1/60); top = Math.max(top, PL.y); }
          if(top - GY < 14.3){ bad++; if(ex.length < 6) ex.push([f2(x), f2(z), f2(top - GY)]); } for(let k=0; k<40; k++) step(1/60); }
        R.W22 = {n, bad, ex}; }
      /* W20 — 쏘기 틈 조준 가림(castleOccluded)을 실제 그림(성곽 돌 조각 광선)과 견줌 — 복도 T1 쪽 쏘기 틈 셋 · 초소 틈 · 회랑 틈: 눈은 벽감 앞, 과녁은 틈 너머 좀비 가운데(+0.85).
         그림으로 보이는데 막힘 · 그림으로 가렸는데 통과 — 69차 18% · 5% → 둘 다 ≤ 1.5% */
      { const THREE = W.__THREE, ms = []; for(const k of ['cbrk', 'cbrkL', 'cboxC', 'cboxN', 'ccope', 'cvous', 'cmerl', 'cwood']){ const b = W.__banks.get(k); if(b && b.chunks) ms.push(...b.chunks); }
        const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dv = new THREE.Vector3(); let seed = 7; const rnd = ()=>{ seed = (seed*16807) % 2147483647; return seed/2147483647; };
        const out = {vis:0, visBlocked:0, hid:0, hidPassed:0, cases:[]};
        const trial = (e, tgt, place0)=>{ Object.assign(PL, {x:place0[0], z:place0[1], y:GY + place0[2]}); const L = Math.hypot(tgt[0] - e[0], tgt[1] - e[1], tgt[2] - e[2]);
          o.set(e[0], e[1], e[2]); dv.set(tgt[0] - e[0], tgt[1] - e[1], tgt[2] - e[2]).normalize(); rc.set(o, dv); rc.far = L - 0.35; rc.near = 0.05;
          const hit = rc.intersectObjects(ms, false).length > 0, occ = W.__castleOccluded(e[0], e[1], e[2], tgt[0], tgt[1], tgt[2]);
          if(!hit){ out.vis++; if(occ){ out.visBlocked++; if(out.cases.length < 8) out.cases.push(['visBlocked', e.map(f2), tgt.map(f2)]); } }
          else { out.hid++; if(!occ){ out.hidPassed++; if(out.cases.length < 8) out.cases.push(['hidPassed', e.map(f2), tgt.map(f2)]); } } };
        for(let n=0; n<1500; n++){ const ex = 17.2 + rnd()*2.6, ez = -50.35 - rnd()*1.3, tx = 10.5 + rnd()*16, tz = -40 - rnd()*6;
          const xw = ex + (tx - ex)*(-49.5 - ez)/(tz - ez); if(xw > 14.9 && xw < 17.1){ out.door = (out.door || 0) + 1; continue; }   // 암문(P 16)으로 지나는 선은 빼고 센다 — 지붕 밑에서 문으로 쏘기는 일부러 막는다(sheltered 문 칸)
          trial([ex, GY + 1.12, ez], [tx, GY + 0.85, tz], [ex, ez, 0]); }
        for(let n=0; n<700; n++){ const ex = 31.9 + rnd()*1.2, ez = -58.3 + rnd()*0.6, tx = 26 + rnd()*13, tz = -64 - rnd()*6;   /* 70차 2회차 — 초소 북쪽 틈 z −60 벽 */ trial([ex, GY + 9.12, ez], [tx, GY + 0.85, tz], [ex, ez, 8]); }
        R.W20 = out;
        /* G3 — 흉벽 줄눈이 앞뒤로 뚫려 바깥이 비치지 않음(70차 — 속 몸이 0.57 까지라 그 위 0.26 줄눈으로 풀빛이 보였다): 성벽 길·회랑 가운데에서 마을 쪽 흉벽으로
           수평 광선(높이 GY+8.62~8.78 · 0.011 간격 — 줄눈 0.04 를 네 번 넘게 맞힘)을 쏴 흉벽 두께 안에서 아무것도 안 맞는 광선 0 */
        const leak = {n:0, miss:0, ex:[]}, shoot = (x, y, z, dx, dz, far)=>{ o.set(x, y, z); dv.set(dx, 0, dz); rc.set(o, dv); rc.near = 0; rc.far = far; leak.n++;
          if(!rc.intersectObjects(ms, false).length){ leak.miss++; if(leak.ex.length < 6) leak.ex.push([f2(x), f2(y - GY), f2(z)]); } };
        for(const G of W.__CPLAN.galleries){ const L = Math.hypot(G.b.x - G.a.x, G.b.z - G.a.z);
          for(let u = 1.0; u < L - 1.0; u += 0.011) shoot(G.a.x + G.U.x*u, GY + 8.06 + (Math.round(u/0.011) % 3)*0.08, G.a.z + G.U.z*u, -G.N.x, -G.N.z, 2.6); }
        for(let x = 12; x < 29.5; x += 0.011) for(const sz of [1, -1]) shoot(x*sz, GY + 8.06 + (Math.round(x/0.011) % 3)*0.08, -51, 0, 1, 2.4);   // 성문 1 양옆 곧은 성벽 길(t 51 → 턱 t 49~49.45) · 70차 2회차: 흉벽 0.85 → 턱 0.32 라 높이 8.06~8.22(턱 몸 안)
        R.G3 = leak; }
      return R; });
    /* W8w 보물(걷기) — 실제로 걸어가 문에 부딪혀 민다(세 dt): ① T8 나선 숨은 문(벽 쪽을 보고 W) ② 창고 ② 문(둘레길에서 문을 보고 W) */
    const w8 = await page.evaluate(()=>{ const {LOG, place, keys, f2, GY, PL, step} = window.WK, W = window, G = W.__G, CP = W.__CPLAN, out = [];
      const clr = ()=>{ for(const k of Object.keys(localStorage)) if(k.startsWith('tre67|')) localStorage.removeItem(k); W.__treReset(); G.phase = 'day'; G.t = G.set.daySec; };
      LOG.tre = true;
      for(const dt of [1/60, 1/30, 1/20]){
        const r = {dt:f2(dt)};
        clr(); { const S = W.__SPIRALS[7], a = S.th0 + 1.5*Math.PI; place(S.cx + Math.cos(a)*1.0, 10/3, S.cz + Math.sin(a)*1.0); PL.yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); keys({w:true});
          let t = 0, t0 = -1; while(t < 3 && !W.__SECRET_OPEN[0]){ step(dt); t += dt; if(t0 < 0 && W.__TRE().pushT > 0) t0 = t - dt; } keys({}); r.spiral = {open:W.__SECRET_OPEN[0], push:f2(t - Math.max(0, t0))}; }
        clr(); { const d = CP.secrets[1].door, cx = (d.x0 + d.x1)/2, cz = (d.z0 + d.z1)/2; place(cx + d.nx*1.6, 0, cz + d.nz*1.6); PL.yaw = Math.atan2(d.nx, d.nz); keys({w:true});
          let t = 0, t0 = -1; while(t < 4 && !W.__SECRET_OPEN[1]){ step(dt); t += dt; if(t0 < 0 && W.__TRE().pushT > 0) t0 = t - dt; } keys({}); r.landing = {open:W.__SECRET_OPEN[1], push:f2(t - Math.max(0, t0))}; }
        out.push(r); }
      LOG.tre = false; clr(); W.__treForce && W.__treForce(-1); return out; });
    const r1 = walk.W1;
    put({id:'W1', name:'선생님 길 — 끝까지 · 멈춤(1초) 0 · 튐 0 · 자동 1인칭 들어감 1·나옴 1 · 3인칭 카메라 벽 속 0 · 천장 뚫음 0', pass:r1.ok && r1.stalls === 0 && r1.maxDy <= 0.7 && r1.camIn === 1 && r1.camOut === 1 && r1.camBad === 0 && r1.ceilBad === 0, detail:r1});
    put({id:'W1b', name:W_LIST[1][1], pass:walk.W1b.ok && walk.W1b.stalls === 0, detail:walk.W1b});
    put({id:'W1c', name:W_LIST[2][1], pass:['a', 'b', 'c'].every(k=> walk.W1c[k].ok && walk.W1c[k].stalls === 0), detail:walk.W1c});
    put({id:'W1d', name:W_LIST[3][1], pass:walk.W1d.ok && walk.W1d.stalls === 0, detail:walk.W1d});
    put({id:'W2', name:'성문 3 → K 나선 → K 윗마당(y 14) → 성문 4', pass:Object.entries(walk.W2).every(([k, r])=> k === 'topY' || (r.ok && r.stalls === 0)) && Math.abs(walk.W2.topY - 14) < 0.1, detail:walk.W2});
    put({id:'W3', name:'천장 — 복도·탑 1층·초소·망루·회랑·창고·나선 가운데·숨은 방에서 2단+활공이 천장을 못 뚫음', pass:Object.values(walk.W3).every(r=> r.bad === 0), detail:walk.W3});
    put({id:'W4', name:'성 밖 착지 0(60번)', pass:Object.values(walk.W4).every(n=> n === 0), detail:walk.W4});
    put({id:'W5', name:'마을 쪽 뛰어내림(흉벽 넘어) → 둘레길·마당(y 0) · 다침 0', pass:Math.abs(walk.W5.end[1]) < 0.1 && walk.W5.ck <= 1 && walk.W5.hurt === 0 && walk.W5.od < 49.2, detail:walk.W5});
    const cok = (r)=> r.ok && r.stalls === 0 && r.ceilBad === 0 && r.maxDy <= 0.7;
    put({id:'W6', name:W_LIST[8][1] + ' · 숨은 문 벽에 막힘', pass:walk.W6.every(([, r])=> cok(r.a) && cok(r.b) && cok(r.c)) && walk.W6push.r >= 2.27 && walk.W6push.r <= 2.44 && Math.abs(walk.W6push.y - 10/3) < 0.4,   /* 70차 2회차 — 우물 벽 b − R = 2.42 에서 한 걸음(0.1) 안(옛 1.52 → 1.45~1.56) · 70차 4회차: 몸 한계가 원 b − R√2 − 0.01 = 2.29(떨림 없앰)라 아래 끝 2.27 */
         detail:{W6:walk.W6.map(([id, r])=> [id, [r.a.t, r.a.stalls, r.a.ceilBad], [r.b.t, r.b.stalls, r.b.ceilBad], [r.c.t, r.c.stalls, r.c.ceilBad], [r.a.ok, r.b.ok, r.c.ok]]), push:walk.W6push, fail:walk.W6.filter(([, r])=> !(cok(r.a) && cok(r.b) && cok(r.c)))}});
    put({id:'W6b', name:W_LIST[9][1], pass:walk.W6b.every(r=> r[1] < 1.5), detail:walk.W6b});
    put({id:'W6c', name:W_LIST[10][1] + ' — 걷기 ≤ 7초 · 달리기 ≤ 5.2초(70차 2회차 — 걸음선 r 1.1 → 1.6, 길이 +46%)', pass:cok(walk.W6c.a) && cok(walk.W6c.b) && cok(walk.W6c.c) && walk.W6c.a.t <= 7 && walk.W6c.b.t <= 5.2, detail:walk.W6c});
    put({id:'W6d', name:W_LIST[11][1] + ' — 최고 속도 ≤ 걷기 × 1.06', pass:walk.W6d.every(([, r])=> cok(r) && r.vmax <= 5.94*1.06), detail:walk.W6d});
    put({id:'W7', name:W_LIST[12][1], pass:walk.W7.every(r=> r.outN === 0 && r.speedPct >= 85), detail:walk.W7});
    put({id:'W8w', name:W_LIST[13][1] + ' — 밀기 0.8~1.0초에 열림', pass:w8.every(r=> r.spiral.open && r.landing.open && r.spiral.push >= 0.8 - 1e-6 && r.spiral.push <= 1.0 + 1e-6 && r.landing.push >= 0.8 - 1e-6 && r.landing.push <= 1.0 + 1e-6), detail:w8});
    put({id:'W9a', name:'성문 1 → 2 달리기 8.6 ± 1초(기력 0 에서 시작)', pass:walk.W9a.ok && Math.abs(walk.W9a.t - 8.6) <= 1 && walk.W9a.stalls === 0, detail:walk.W9a});
    put({id:'W9b', name:'꺾는 곳에서만 yaw(일곱 번 — 시선 도우미 없음) ≤ 10초 · 기력 그대로', pass:walk.W9b.ok && walk.W9b.t <= 10 && walk.W9b.stalls === 0, detail:walk.W9b});
    put({id:'W9c', name:W_LIST[16][1], pass:[walk.W9c_in, walk.W9c_out].every(r=> r.ok && r.stalls === 0 && r.t <= 10), detail:{in:walk.W9c_in, out:walk.W9c_out}});
    put({id:'W10', name:'암문 드나들기 — tpvKind 바뀜 ≤ 2', pass:walk.W10 <= 2, detail:walk.W10});
    /* 설계 9-2: '멈춤 0(칸 톱니라 속도 ≥ 50%면 통과 — 기록만)'. 통과 = 0.5초마다 벽을 따라 앞으로 나아감(멈춤 0), 속도 % 는 기록(합친 판 ≈ 46%) */
    put({id:'W11', name:W_LIST[18][1] + ' — 멈춤 0(속도 % 는 기록)', pass:walk.W11.worstHalfSec > 0.3, detail:walk.W11});
    put({id:'W12', name:'지붕 위에서 놓기 — 들썩임 0 · 회랑 8·망루 12 에 내려앉음', pass:walk.W12.every(d=> d.osc === 0) && Math.abs(walk.W12[0].y - 8) < 0.1 && Math.abs(walk.W12[1].y - 12) < 0.1, detail:walk.W12});
    put({id:'W13', name:'벽 5초 밀기 — 순간이동 0', pass:walk.W13 === 0, detail:walk.W13});
    put({id:'W14', name:W_LIST[21][1], pass:walk.W14 === 0, detail:walk.W14});
    put({id:'W15', name:'2단 점프 + 활공 21번 — 구조 순간이동 0', pass:walk.W15.teleports === 0, detail:walk.W15});
    put({id:'W16', name:W_LIST[23][1], pass:walk.W16.n > 100 && walk.W16.bad === 0, detail:walk.W16});
    put({id:'W17', name:W_LIST[24][1], pass:walk.W17.length === 8 && walk.W17.every(r=> r.tpv === 1 && Math.abs(r.zoom - 4.4) < 1e-6 && r.auto < 0.02) && walk.W17wheelIn > 0.9 && Math.abs(walk.W17wheelZoom - 4.4) < 1e-6,
         detail:{paths:walk.W17, wheelIn:walk.W17wheelIn, wheelZoom:walk.W17wheelZoom}});
    put({id:'W18', name:W_LIST[25][1], pass:Object.values(walk.W18).every(r=> r.ok && r.a2 <= 0.02) && walk.W18.gateDown3p.lands === 0 && walk.W18.gateDown1p.lands === 0 && walk.W18.spiralDown.lands === 0, detail:walk.W18});
    put({id:'W19', name:W_LIST[26][1], pass:Object.values(walk.W19).every(d=> d === 0), detail:walk.W19});
    /* 70차 */
    put({id:'W6k', name:'나선 아이 손(ω 5·지연 0.2 / ω 6·지연 0.15, 접선 앞 점) — 여덟 탑 1층→망루→1층 · 멈춤(1초) 0', pass:walk.W6k.every(([, , , a, b])=> a.ok && b.ok && a.stalls === 0 && b.stalls === 0),
         detail:walk.W6k.map(([id, om, lag, a, b])=> [id, om, lag, a.t, a.maxStall, b.t, b.maxStall, a.ok && b.ok ? '' : [a.at, b.at]])});
    put({id:'W18b', name:'계단 카메라 떨림 — 달리기(Shift) 60Hz ≤ 0.02 · 걷기/달리기 30Hz ≤ 0.08', pass:Object.values(walk.W18b).every(r=> r.ok && r.a2 <= r.lim), detail:walk.W18b});
    put({id:'W18c', name:'계단 카메라 칸·상자 속 0 — 뒤로 오르기(S)·위 보며 오르기·조준 뒤로 오르기', pass:walk.W18c.n > 1500 && walk.W18c.bad === 0, detail:walk.W18c});
    put({id:'W20', name:'쏘기 틈 가림 = 그림 광선 — 보이는데 막힘 ≤ 1.5% · 가렸는데 통과 ≤ 1.5%', pass:walk.W20.vis > 100 && walk.W20.hid > 100 && walk.W20.visBlocked <= walk.W20.vis*0.015 && walk.W20.hidPassed <= walk.W20.hid*0.015, detail:walk.W20});
    put({id:'G3', name:'흉벽 줄눈 앞뒤 뚫림 0 — 성벽 길·회랑에서 마을 쪽 흉벽으로 쏜 수평 광선이 모두 돌에 맞음', pass:walk.G3.n > 5000 && walk.G3.miss === 0, detail:walk.G3});
    put({id:'W21', name:'지도 방 선반(1.8 · 천장 3.0) 쪽 2단 점프 — 선반에 안 올라섬 · 천장 뚫림 0', pass:walk.W21.every(r=> r.top < 1.7 && r.ceil === 0), detail:walk.W21});
    put({id:'W22', name:'K 윗마당 층계참(14) 어디서나 점프가 뜸(≥ 0.3)', pass:walk.W22.n > 20 && walk.W22.bad === 0, detail:walk.W22});
  }
  put({id:'E', name:'JavaScript·셰이더 오류 0', pass:errors.length === 0, detail:errors.slice(0, 5)});
}finally{ await browser?.close(); await new Promise(r=>server.close(r)); }
fs.writeFileSync(path.join(out, 'walk-report.json'), JSON.stringify(results, null, 2));
const fail = results.filter(r=>!r.pass).length, waitN = results.filter(r=>r.wait).length;
console.log(fail ? `${fail} failed / ${results.length}` : `${results.length - waitN}/${results.length} castle walk checks passed` + (waitN ? ` · ${waitN} waiting for other branches` : ''));
process.exitCode = fail ? 1 : 0;
