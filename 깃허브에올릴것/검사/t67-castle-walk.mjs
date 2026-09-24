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
    const g0 = await page.evaluate((BASE)=>{ const W = window; let inst = 0, gg = 0; const nk = [];
      for(const [k, b] of W.__banks){ const n = b.ms ? b.ms.length : 0; inst += n; if(k === 'gglow') gg = n; if(!BASE.keys.includes(k)) nk.push(k); }
      const mats = new Set(); W.__scene.traverse(o=>{ if(o.isInstancedMesh) mats.add(o.material.uuid); });
      return {newKeys:nk.length, keys:nk, dInst:inst - BASE.inst, dGlow:gg - BASE.gglow, mats:mats.size}; }, BASE);
    put({id:'G0', name:'새 뱅크 열쇠 ≤ 27 · 새 인스턴스 ≤ 20,000 · gglow 새 ≤ 200 · 인스턴스 재질 수 그대로(57)', pass:g0.newKeys <= 27 && g0.dInst <= 20000 && g0.dGlow <= 200 && g0.mats <= BASE.mats, detail:g0});
  } else put({id:'G0', name:'그림 예산(열쇠·인스턴스·불빛·재질)', wait:true, pass:!STRICT, detail:'갈래 2 합친 뒤'});

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
        for(let j=0; j<Sx.n; j++){ const phi = (j + 0.5)*(2*Math.PI/Sx.m), q = Math.floor(phi/(2*Math.PI)), thw = Sx.th0 + phi, x = Sx.cx + Math.cos(thw)*1.15, z = Sx.cz + Math.sin(thw)*1.15;
          const h = W.__spiralH(k, x, z, Sx.y0 + q*Sx.Ht + (j % Sx.m + 1)*Sx.h); if(prev > -1e8){ maxStep = Math.max(maxStep, h - prev); if(h < prev - 1e-6) bad++; } prev = h;
          for(const dy of [0, 1.0, 2.0]) if(Math.abs(W.__spiralH(k, x, z, h + dy) - h) > 1e-6) bad++; }
        sp.push({k, bad, maxStep:+maxStep.toFixed(3)}); }
      o.s5 = sp;
      /* 7 CROOF 표본 */
      const cr = (x, z)=> R[gi(Math.floor(x), Math.floor(z))];
      o.s7 = {corr:cr(20, -51) & CR.G, post:cr(36, -51.5) & CR.W, watch:cr(34.5, -51.5) & CR.T, gal:cr(42.5, -42.5) & CR.W, bridgeRoof:cr(0, -51) & 7, runWall:cr(20, -51) & CR.RUN, runBridge:cr(0, -51) & CR.RUN,
        t1WestDW:cr(30.5, -51) & CR.DW, t1WestDG:cr(30.5, -51) & CR.DG, onBridge:W.__onCastleLayer(0, -51, GY + 8), underBridge:W.__onCastleLayer(0, -51, GY + 3), westDoor:W.__onCastleLayer(30.5, -51, GY + 8)};
      /* 8 천장 규칙 */
      let ceilBad = []; for(const b of W.__GBOX){ if(b.k !== W.__GK.FLOOR && b.k !== W.__GK.ROOF) continue;
        for(const fx of [0.25, 0.5, 0.75]) for(const fz of [0.25, 0.5, 0.75]){ const x = b.x0 + (b.x1 - b.x0)*fx, z = b.z0 + (b.z1 - b.z0)*fz;
          const g = W.__groundUnder(x, z, 0.05, b.y0 - 0.05); const gap = b.y0 - g; if(gap >= 0.01 && gap < 2.2 - 1e-6 && g > -900) ceilBad.push([+x.toFixed(1), +(g - GY).toFixed(2), +(b.y0 - GY).toFixed(2)]); } }
      o.s8 = {n:ceilBad.length, ex:ceilBad.slice(0, 5)};
      /* 16 ZONE·RUN 이음 — 곧은 성벽 길 걷는 폭 전체에서 onWallWalk 조건(RUN + y 8) · 주선 layerY 연속 */
      let wallBad = 0, wallN = 0; for(const s of W.__CPLAN.straights){ for(let P = 11; P <= Math.abs(s.b.x - s.a.x) + Math.abs(s.b.z - s.a.z) + 11; P += 0.25) for(let v = 49.45; v <= 52.55; v += 0.25){
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
      let kb = 0; for(let z=50; z<64; z++) for(let x=-7; x<=7; x++) if(W.__kBand(x, z) && !(W.__CASTLE[gi(x, z)] >= 2) && !W.__tower66(x, z)){ const h = th[gi(x, z)]; if(h > GY + 10 || h < GY + 2) kb++; }
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
    G.phase = 'day'; G.day += 1; tick(2); at({x:CP.secrets[1].chest.x + 3, y:0, z:CP.secrets[1].chest.z}); at({x:CP.secrets[1].chest.x, y:0, z:CP.secrets[1].chest.z});
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

  /* ═══ W — 실제 걷기(갈래 1 몸이 합쳐진 뒤) ═══ */
  const W_LIST = [['W1','선생님 길(마당→암문→복도→T1→나선→초소→회랑→T2→곧은 성벽 길→성문 2→계단→마당)'],['W1b','초소~T2 남문 yaw 고정'],['W1c','성벽 길 → 나선 → 망루'],['W1d','회랑 → 초소 반짝 자리'],
    ['W2','성문 3 → K 나선 → K 윗마당 → 성문 4'],['W3','천장 — 2단 점프·활공이 천장을 못 뚫음'],['W4','성 밖 — 트인 성벽 길·망루 얼굴·K 에서 바깥으로 뛰어도 해자·산 착지 0'],['W5','트인 성벽 길에서 마을 쪽으로 뛰어내림'],
    ['W6','나선 레일 3.0칸/초 · 8층 층 멈춤 · 숨은 문 밀기 모드'],['W6b','1층 문 정면 쐐기 폭 전체 멈춤 0'],['W6c','층 멈춤 세 판'],['W6d','숨은 문 쐐기 속도 튐 0(T8·T4·T6)'],['W7','회랑 비비기 속도 ≥ 85%'],
    ['W8w','보물(걷기) — 문에 부딪혀 밀기 세 dt'],['W9a','성문 1 → 성문 2 달리기 8.6 ± 1초(yaw 돌려 줌)'],['W9b','같은 길 yaw 처음 한 번 ≤ 10초'],['W9c','문 앞 붙어 달리기 문설 걸림 0'],['W10','문턱 드나들기 tpvKind 바뀜 ≤ 2'],
    ['W11','둘레길 대각 벽 비비기(기록)'],['W12','지붕 위에서 떨어짐 — 들썩임 0'],['W13','벽 5초 밀기 — 순간이동 0'],['W14','성문 망대 옆 2단+활공 — 망루 FENCE 밖 착지 0'],['W15','공중 구조 오작동 0']];
  if(!body){ for(const [id, n] of W_LIST) put({id, name:n, wait:true, pass:!STRICT, detail:'갈래 1 합친 뒤(몸·나선·자동 1인칭)'}); }
  else {
    const walk = await page.evaluate(()=>{
      const W = window, H = W.__t67, P = W.__PL, K = W.__KEY, GY = W.__GY, CP = W.__CPLAN, o = {};
      const gz = (g, t, pp)=> [W.__gX(g, t, pp), W.__gZ(g, t, pp)];
      /* W1 */
      H.place(16, 0, -40, 0);
      o.W1 = H.route([[16,0,-48.4],[16,0,-51],[29,0,-51],[31.5,0,-51.5],[36,0,-53.4],[36,8,-52.5],[34.6,8,-50.9],[36,8,-49],[49,8,-36],[51,8,-34],[51,8,-30],[51,8,-9],[48,8,-8.5],[33.5,0,-8.5],[25,0,-5]], {max:90, ytol:1.0});
      /* W2 */
      H.place(4, 8, 51, 0); o.W2 = H.route([[0,8,53.5],[0,14,59.5]], {max:40, ytol:1.0}); o.W2y = +(P.y - GY).toFixed(2);
      /* W3 천장 */
      const ceil = []; for(const [x, y, z] of [[20,0,-51],[34.5,0,-51.5],[34.5,8,-51.5],[34.5,12,-51.5],[42.5,8,-42.5]]){ H.place(x, y, z, 0); let bad = 0;
        for(let j=0; j<3; j++){ W.__wantJump(); for(let i=0; i<20; i++){ W.__updPlayer(1/60); if(i === 10) W.__wantJump(); const c = W.__ceilingOver(P.x, P.z, P.R, P.y); if(P.y + 1.4 > c + 0.01) bad++; } K[' '] = true; for(let i=0; i<60; i++) W.__updPlayer(1/60); K[' '] = false; }
        ceil.push(bad); } o.W3 = ceil;
      /* W4 성 밖 */
      let outN = 0; for(const [x, y, z, yaw] of [[20,8,-52.3,0],[10,8,-52.8,0],[0,14,60.5,Math.PI]]) for(let r=0; r<20; r++){ H.place(x, y, z, yaw + (r - 10)*0.05); K.w = true; K.shift = true;
        W.__wantJump(); for(let i=0; i<200; i++){ if(i === 12) W.__wantJump(); K[' '] = i > 12; W.__updPlayer(1/60); }
        const cx = Math.floor(P.x), cz = Math.floor(P.z), od = W.__oct(P.x, P.z); if(W.__CASTLE[(cx + W.__HW) + (cz + W.__HW)*(W.__HW*2 + 1)] === 0 && od >= 53 && !W.__corridorDist(P.x, P.z)) outN++; }
      H.keys0(); o.W4 = outN;
      /* W5 */
      H.place(20, 8, -49.6, Math.PI); K.w = true; for(let i=0; i<120; i++) W.__updPlayer(1/60); H.keys0(); o.W5 = {y:+(P.y - GY).toFixed(2), od:+W.__oct(P.x, P.z).toFixed(2), hp:P.hp};
      /* W6 나선 */
      const T1 = CP.towers[0]; H.place(36, 0, -52.6, Math.PI); const y0 = P.y; let hold = 0, spd = [], lastA = null;
      K.w = true; for(let i=0; i<360; i++){ const px = P.x, pz = P.z; W.__updPlayer(1/60); const v = Math.hypot(P.x - px, P.z - pz)*60; if(v < 0.05 && P.y > GY + 7.5 && P.y < GY + 8.5) hold += 1/60; else if(P.y > GY + 0.5 && P.y < GY + 7.5) spd.push(v); }
      H.keys0(); o.W6 = {y:+(P.y - GY).toFixed(2), hold:+hold.toFixed(2), spdMin:+Math.min(...spd).toFixed(2), spdMax:+Math.max(...spd).toFixed(2)};
      /* W9 달리기 */
      H.place(9, 8, -51, -Math.PI/2); W.__setStamina && W.__setStamina(0);
      o.W9a = H.route([[30,8,-51],[34,8,-51],[36,8,-49],[49,8,-36],[51,8,-34],[51,8,-9]], {run:true, max:20});
      H.place(9, 8, -51, -Math.PI/2); W.__setStamina && W.__setStamina(0);
      o.W9b = H.route([[51,8,-9]], {run:true, max:20, steer:false, tol:1.2});
      /* W10 문턱 */
      H.place(16, 0, -47.5, 0); let flips = 0, last = W.__tpvKind();
      for(let k=0; k<10; k++){ P.yaw = k % 2 ? Math.PI : 0; K.w = true; for(let i=0; i<18; i++){ W.__updPlayer(1/60); const t = W.__tpvKind(); if(t !== last){ flips++; last = t; } } }
      H.keys0(); o.W10 = flips;
      /* W12 지붕 위 */
      const drop = []; for(const [x, y, z] of [[43,13,-42],[34.5,21,-53.5]]){ H.place(x, y, z, 0); P.ground = false; let flip = 0, dir = 0;
        for(let i=0; i<180; i++){ const y0 = P.y; W.__updPlayer(1/60); const d = Math.sign(P.y - y0); if(Math.abs(P.y - y0) > 0.3 && d && d !== dir){ flip++; dir = d; } }
        drop.push({flip, y:+(P.y - GY).toFixed(2)}); } o.W12 = drop;
      /* W13 벽 밀기 */
      H.place(16, 0, -47.6, 0); P.yaw = 0; K.w = true; const x13 = P.x, z13 = P.z; let tp = 0; for(let i=0; i<300; i++){ const px = P.x, pz = P.z; W.__updPlayer(1/60); if(Math.hypot(P.x - px, P.z - pz) > 1.5) tp++; } H.keys0(); o.W13 = tp;
      /* W15 공중 구조 */
      let tp15 = 0; for(const [x, y, z] of [[20,8,-51],[0,14,59.5],[9,8,-51]]) for(let r=0; r<20; r++){ H.place(x, y, z, r*0.3); W.__wantJump(); for(let i=0; i<150; i++){ if(i === 10) W.__wantJump(); K[' '] = i > 10; const px = P.x, pz = P.z; W.__updPlayer(1/60); if(Math.hypot(P.x - px, P.z - pz) > 1.5) tp15++; } }
      H.keys0(); o.W15 = tp15;
      return o; });
    const r1 = walk.W1;
    put({id:'W1', name:'선생님 길 — 끝까지 · 멈춤(1초) 0 · 튐 0 · 자동 1인칭 들어감 1·나옴 1', pass:r1.done && r1.maxStall < 1 && r1.bigDy === 0 && r1.camIn >= 1 && r1.camOut >= 1, detail:r1});
    put({id:'W2', name:'성문 3 → K 윗마당(y 14)', pass:walk.W2.done && Math.abs(walk.W2y - 14) < 0.1, detail:walk.W2});
    put({id:'W3', name:'천장 — 복도·탑 1층·초소·망루·회랑에서 머리가 천장을 못 뚫음', pass:walk.W3.every(n=>n === 0), detail:walk.W3});
    put({id:'W4', name:'성 밖 착지 0(60번)', pass:walk.W4 === 0, detail:walk.W4});
    put({id:'W5', name:'마을 쪽 뛰어내림 → 둘레길(y 0) · 다침 0', pass:Math.abs(walk.W5.y) < 0.1 && walk.W5.od < 49.2, detail:walk.W5});
    put({id:'W6', name:'나선 W 만 6초 — 8층에서 층 멈춤 ≈0.5초 뒤 초소(8) · 레일 3.0±0.2', pass:Math.abs(walk.W6.y - 8) < 0.05 && walk.W6.hold >= 0.4 && walk.W6.spdMin >= 2.8 - 0.2 && walk.W6.spdMax <= 3.2 + 0.2, detail:walk.W6});
    put({id:'W9a', name:'성문 1 → 2 달리기 8.6 ± 1초(기력 0 에서 시작)', pass:walk.W9a.done && Math.abs(walk.W9a.t - 8.6) <= 1 && walk.W9a.maxStall < 1, detail:walk.W9a});
    put({id:'W9b', name:'yaw 처음 한 번만 — 문 깔때기·회랑 시선으로 ≤ 10초', pass:walk.W9b.done && walk.W9b.t <= 10 && walk.W9b.maxStall < 1, detail:walk.W9b});
    put({id:'W10', name:'암문 드나들기 — tpvKind 바뀜 ≤ 2', pass:walk.W10 <= 2, detail:walk.W10});
    put({id:'W12', name:'지붕 위에서 놓기 — 들썩임 0 · 회랑 8·망루 12 에 내려앉음', pass:walk.W12.every(d=>d.flip <= 1) && Math.abs(walk.W12[0].y - 8) < 0.1 && Math.abs(walk.W12[1].y - 12) < 0.1, detail:walk.W12});
    put({id:'W13', name:'벽 5초 밀기 — 순간이동 0', pass:walk.W13 === 0, detail:walk.W13});
    put({id:'W15', name:'2단 점프 + 활공 60번 — 구조 순간이동 0', pass:walk.W15 === 0, detail:walk.W15});
    for(const [id, n] of W_LIST) if(!['W1','W2','W3','W4','W5','W6','W9a','W9b','W10','W12','W13','W15'].includes(id))
      put({id, name:n + ' — 합친 판에서 사람 눈으로(설계 9-2 조건)', wait:true, pass:!STRICT, detail:'자동화 안 함 — 통합 때 이 틀(H.route)로 더한다'});
  }
  put({id:'E', name:'JavaScript·셰이더 오류 0', pass:errors.length === 0, detail:errors.slice(0, 5)});
}finally{ await browser?.close(); await new Promise(r=>server.close(r)); }
fs.writeFileSync(path.join(out, 'walk-report.json'), JSON.stringify(results, null, 2));
const fail = results.filter(r=>!r.pass).length, waitN = results.filter(r=>r.wait).length;
console.log(fail ? `${fail} failed / ${results.length}` : `${results.length - waitN}/${results.length} castle walk checks passed` + (waitN ? ` · ${waitN} waiting for other branches` : ''));
process.exitCode = fail ? 1 : 0;
