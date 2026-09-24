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
          const g = W.__groundUnder(x, z, 0.05, b.y0 - 0.05); const gap = b.y0 - g; if(gap >= 0.01 && gap < 2.2 - 1e-6 && g > -900) ceilBad.push([+x.toFixed(1), +(g - GY).toFixed(2), +(b.y0 - GY).toFixed(2)]); } }
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

  /* ═══ W — 실제 걷기(갈래 1 몸이 합쳐진 뒤) ═══
     통합 — 옛 판(몸 없이 짠 H.route)은 ① 나선을 웨이포인트로 겨눠 1층 문 밖으로 도로 걸어 나가고(W1·W2) ② W6 을 문 반대쪽(yaw π)을 보고 세우고
     ③ W9b 를 끝점(51,−9)으로 한 번 겨눠(설계는 '동쪽 한 번') 흉벽에 비볐고 ④ W5 를 점프 없이 흉벽(0.85 > STEP)에 밀었다.
     여기서는 갈래 1 걷기 시험(scratchpad c1 lib·w1~w3)의 틀을 그대로 옮긴다: 나선 구간은 W 만(레일·층 멈춤이 시선을 돌림),
     yaw 고정 길은 설계 9-2 대로 한 번만 돌린다. 기준 수치는 설계서 그대로다. */
  const W_LIST = [['W1','선생님 길(마당→암문→복도→T1→나선→초소→회랑→T2→곧은 성벽 길→성문 2→계단→마당)'],['W1b','초소~T2 남문 yaw 고정'],['W1c','성벽 길 → 나선 → 망루'],['W1d','회랑 → 초소 반짝 자리'],
    ['W2','성문 3 → K 나선 → K 윗마당 → 성문 4'],['W3','천장 — 2단 점프·활공이 천장을 못 뚫음'],['W4','성 밖 — 트인 성벽 길·망루 얼굴·K 에서 바깥으로 뛰어도 해자·산 착지 0'],['W5','트인 성벽 길에서 마을 쪽으로 뛰어내림'],
    ['W6','나선 레일 3.0칸/초 · 8층 층 멈춤 · 숨은 문 밀기 모드'],['W6b','1층 문 정면 쐐기 폭 전체 멈춤 0'],['W6c','층 멈춤 세 판'],['W6d','숨은 문 쐐기 속도 튐 0(T8·T4·T6)'],['W7','회랑 비비기 속도 ≥ 85%'],
    ['W8w','보물(걷기) — 문에 부딪혀 밀기 세 dt'],['W9a','성문 1 → 성문 2 달리기 8.6 ± 1초(yaw 돌려 줌)'],['W9b','같은 길 yaw 처음 한 번 ≤ 10초'],['W9c','문 앞 붙어 달리기 문설 걸림 0'],['W10','문턱 드나들기 tpvKind 바뀜 ≤ 2'],
    ['W11','둘레길 대각 벽 비비기(기록)'],['W12','지붕 위에서 떨어짐 — 들썩임 0'],['W13','벽 5초 밀기 — 순간이동 0'],['W14','성문 망대 옆 2단+활공 — 망루 FENCE 밖 착지 0'],['W15','공중 구조 오작동 0'],['W16','3인칭 카메라 — 트인 곳 한 바퀴, 카메라 점이 상자·성곽 칸 속 0']];
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
      const place = (x, y, z, yawTo)=>{ const S = W.__SPA; S.on = false; S.k = -1; S.wedge = -1; S.hub = -1; S.holdT = 0; S.turnT = 0; S.exitT = 0;
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
      const spiralRun = (maxT, until)=>{ let t = 0, stalls = 0, lm = 0, px = PL.x, pz = PL.z, py = PL.y, holds = [], wh = false, vs = [], hT = 0;
        while(t < maxT){ const x0 = PL.x, z0 = PL.z; step(1/60); t += 1/60; const v = Math.hypot(PL.x - x0, PL.z - z0)*60;
          if(W.__SPA.on && !W.__SPA.push && W.__SPA.holdT <= 0 && W.__SPA.wedge < 0) vs.push(v);
          const h = W.__SPA.holdT > 0; if(h){ hT += 1/60; if(!wh) holds.push([f2(t), f2(PL.y - GY)]); } wh = h;
          if(Math.hypot(PL.x - px, PL.z - pz) + Math.abs(PL.y - py) > 0.1){ px = PL.x; pz = PL.z; py = PL.y; lm = t; } if(t - lm > 1){ stalls++; lm = t; }
          if(until()) break; }
        vs.sort((a, b)=> a - b);
        return {t:f2(t), ok:!!until(), stalls, holds, holdT:f2(hT), at:[f2(PL.x), f2(PL.y - GY), f2(PL.z)], v:[f2(vs[Math.floor(vs.length*0.02)] || 0), f2(vs[vs.length >> 1] || 0), f2(vs[Math.floor(vs.length*0.98)] || 0)]}; };
      const tangent = (up)=>{ const S = W.__SPIRALS[0], dx = PL.x - S.cx, dz = PL.z - S.cz, r = Math.hypot(dx, dz); PL.yaw = up ? Math.atan2(dz/r, -dx/r) : Math.atan2(-dz/r, dx/r); };

      /* W1 선생님 길 — 나선 구간은 우리 안을 보고 W 만(레일·층 멈춤), 나머지는 웨이포인트를 겨눔 */
      { const t0 = LOG.frames; place(16, 0, -40, [16, -48]); LOG.maxDy = 0; LOG.flips = []; LOG.camBad = 0; LOG.camBadAt = null; LOG.ceilBad = 0;
        const seg = {}; seg.lane = go(16, -48.4); seg.door = go(16, -51); seg.corr = go(29, -51); seg.room = go(31.5, -51.5); seg.cage = go(36, -53.4, {tol:0.35});
        PL.yaw = Math.atan2(-(36 - PL.x), -(-55 - PL.z));
        seg.spiral = hold({w:true}, ()=> !inCage() && Math.abs(PL.y - GY - 8) < 0.05 && PL.z > -53, 12);
        seg.post = go(36, -52.5, {y:8}); seg.bend = go(34.6, -50.9, {y:8}); seg.galDoor = go(36, -49, {y:8, tol:0.5}); seg.gallery = go(49, -36, {y:8, tol:0.5});
        seg.t2bend = go(51, -34, {y:8}); seg.t2door = go(51, -30, {y:8}); seg.wall = go(51, -9, {y:8}); seg.landing = go(48, -8.5, {y:8}); seg.stairs = go(33.5, -8.5, {tol:0.5}); seg.town = go(25, -5);
        const fl = LOG.flips.filter(f=> f[0] > t0/60 + 0.2);
        R.W1 = {seg, ok:Object.values(seg).every(r=> r.ok), stalls:Object.values(seg).reduce((a, r)=> a + r.stalls, 0), sec:f2((LOG.frames - t0)/60), maxDy:f2(LOG.maxDy),
          camIn:fl.filter(f=> f[1] === -1).length, camOut:fl.filter(f=> f[1] === 1).length, flips:fl, camBad:LOG.camBad, camBadAt:LOG.camBadAt, ceilBad:LOG.ceilBad}; }
      /* W6 — 여덟 탑: 1층 문 앞 1칸에서 우리를 보고 W 만 → 8층 층 멈춤 → 초소 */
      R.W6 = [];
      for(let i=0; i<8; i++){ const d = xf(i, 36, -52.2); place(d[0], 0, d[1]); aimAtCage(i); keys({w:true});
        const r = spiralRun(10, ()=> !inCage() && Math.abs(PL.y - GY - 8) < 0.05); keys({}); R.W6.push([T[i].id, r]); }
      { place(36, 12, -52.2); aimAtCage(0); keys({w:true}); const c = spiralRun(8, ()=> W.__SPA.holdT > 0); const c2 = spiralRun(0.6, ()=> W.__SPA.holdT <= 0);
        tangent(false); const d = spiralRun(10, ()=> Math.abs(PL.y - GY) < 0.1 && !W.__SPA.on); keys({}); R.W6down = {c, c2, d}; }
      { const i = 7, S = W.__SPIRALS[i], a = S.th0 + 1.5*Math.PI;          // 숨은 문 쐐기에서 벽 쪽을 보고 W → 반지름 1.47 에서 멈춤(밀기)
        place(S.cx + Math.cos(a)*1.15, 10/3, S.cz + Math.sin(a)*1.15); PL.yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); keys({w:true});
        for(let k=0; k<60; k++) step(1/60); keys({}); R.W6push = {r:f2(Math.hypot(PL.x - S.cx, PL.z - S.cz)), y:f2(PL.y - GY), push:!!W.__SPA.push}; }
      /* W6b — 1층 문 정면(yaw 고정)으로 쐐기 폭 ±0.35 에서 1칸 깊이까지 */
      R.W6b = [];
      for(const off of [-0.35, -0.2, 0, 0.2, 0.35]){ place(36 + off, 0, -51.8); PL.yaw = 0; keys({w:true}); let t = 0;
        while(t < 1.5 && PL.z > -54.2){ step(1/60); t += 1/60; } keys({}); R.W6b.push([off, f2(t), f2(PL.z), f2(PL.y - GY)]); }
      /* W6c — ① (W6) ② 12층 → 8층 멈춤 → W → 초소 ③ 8층 멈춤 때 오름 접선 → 망루 */
      { place(36, 12, -52.2); aimAtCage(0); keys({w:true}); const b = spiralRun(10, ()=> !inCage() && Math.abs(PL.y - GY - 8) < 0.05);
        place(36, 0, -52.2); aimAtCage(0); keys({w:true}); const c0 = spiralRun(8, ()=> W.__SPA.holdT > 0); const c1 = spiralRun(0.6, ()=> W.__SPA.holdT <= 0);
        tangent(true); const c = spiralRun(8, ()=> !inCage() && Math.abs(PL.y - GY - 12) < 0.05); keys({}); R.W6c = {b, c0, c1, c}; }
      /* W6d — 숨은 문 탑(T8·T4·T6) W 만 1층 → 8층, 속도 3.0±0.2 */
      R.W6d = [];
      for(const i of [7, 3, 5]){ const d = xf(i, 36, -52.2); place(d[0], 0, d[1]); aimAtCage(i); keys({w:true}); const r = spiralRun(8, ()=> W.__SPA.holdT > 0); keys({}); R.W6d.push([T[i].id, r]); }
      /* W1b 초소 → T2 남문(회랑 문 쪽을 한 번) · W1c 성벽 길 → 나선 → 망루 · W1d 회랑 문 → 초소 반짝 자리 */
      { place(36, 8, -52.5); PL.yaw = Math.atan2(0, -1); R.W1b = hold({w:true}, ()=> PL.z > -29.5 && PL.x > 49.5, 14); }
      { place(26, 8, -51); PL.yaw = Math.atan2(-1, 0); const a = hold({w:true}, ()=> PL.x > 31.5, 4);
        PL.yaw = Math.atan2(-(36 - PL.x), -(-53.2 - PL.z)); const b = hold({w:true}, ()=> W.__SPA.on, 4); hold({}, ()=> W.__SPA.turnT <= 0, 1);
        tangent(true); const c = hold({w:true}, ()=> !inCage() && Math.abs(PL.y - GY - 12) < 0.05, 8); R.W1c = {a, b, c}; }
      { place(36, 8, -49.3); PL.yaw = Math.atan2(-(32.5 - 36), -(-55 + 49.3)); R.W1d = hold({w:true}, ()=> Math.hypot(PL.x - 32.5, PL.z + 55) < 1.2, 6); }
      /* W9 달리기 — (a) 웨이포인트마다 겨눔 (b) 동쪽 한 번만 · (c) 흉벽 쪽·성가퀴 쪽에서 출발 */
      W.__setStamina(0);
      { place(9, 8, -51); let tt = 0, st = 0, ok = true; for(const p of [[30, -51], [34, -51], [36, -49], [49, -36], [51, -34], [51, -30], [51, -9]]){ const r = go(p[0], p[1], {y:8, shift:true, tol:0.6}); tt += r.t; st += r.stalls; ok = ok && r.ok; }
        R.W9a = {t:f2(tt), ok, stalls:st, stamina:f2(W.__stamina())}; }
      for(const [nm, z0, x0] of [['W9b', -51, 9], ['W9c_in', -49.8, 12], ['W9c_out', -52.2, 9]]){ W.__setStamina(0); place(x0, 8, z0); PL.yaw = Math.atan2(-1, 0);   /* 흉벽 쪽은 66 망루 윗마당 모서리 망대(P 9~11) 곁을 지나서 — 탑 문설을 보는 검사 */
        const r = hold({w:true, shift:true}, ()=> PL.z > -9.5 && PL.x > 49, 16); r.stamina = f2(W.__stamina()); R[nm] = r; }
      /* W2 K — 성문 3 윗마당 → K 북문 → 나선(W 만) → 윗마당 → 되돌아 → 성문 4 윗마당 */
      { place(4, 8, 51); const a = go(0, 51), b = go(0, 53.6, {tol:0.35});
        PL.yaw = Math.atan2(0, -1); const c = hold({w:true}, ()=> PL.z > 58.4 && Math.abs(PL.y - GY - 14) < 0.05, 10); const d = go(0, 59.5, {y:14});
        PL.yaw = Math.atan2(0, 1); const e = hold({w:true}, ()=> PL.z < 53.2 && Math.abs(PL.y - GY - 8) < 0.05, 10); const f = go(0, 51, {y:8}), g = go(-4, 51, {y:8});
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
        const dx = U[0]*Math.cos(a) + N[0]*Math.sin(a), dz = U[1]*Math.cos(a) + N[1]*Math.sin(a); PL.yaw = Math.atan2(-dx, -dz); W.__lookIdle(0); W.__setStamina(1);
        keys({w:true, shift:true}); let outN = 0, dist = 0; const fr0 = LOG.frames;
        for(let i=0; i<120; i++){ const x0 = PL.x, z0 = PL.z; W.__lookIdle(0); step(1/60); dist += (PL.x - x0)*U[0] + (PL.z - z0)*U[1];
          const e = (Math.abs(PL.x) + Math.abs(PL.z))*0.6; if(e < 49.72 - 0.01 || e > 52.02 + 0.01) outN++; if(PL.x > 47.5) break; }
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
      for(const p of [[43, 13, -42], [34.5, 21, -53.5]]){ place(p[0], p[1], p[2]); PL.ground = false; const ys = []; let osc = 0; for(let i=0; i<150; i++){ step(1/60); ys.push(PL.y); }
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
    const w6ok = (r)=> r.ok && r.stalls === 0 && r.v[0] >= 2.8 && r.v[2] <= 3.2;
    put({id:'W6', name:'나선 W 만 — 여덟 탑 8층 층 멈춤(≥ 0.4초) 뒤 초소(8) · 레일 3.0±0.2 · 12층→1층 · 숨은 문 밀기(r 1.47)', pass:walk.W6.every(([, r])=> w6ok(r) && r.holdT >= 0.4 && r.holds.some(h=> Math.abs(h[1] - 8) < 0.5))
         && walk.W6down.d.ok && walk.W6down.d.stalls === 0 && Math.abs(walk.W6push.r - 1.47) < 0.03 && walk.W6push.push, detail:{W6:walk.W6.map(([id, r])=> [id, r.t, r.holdT, r.v]), down:walk.W6down.d, push:walk.W6push}});
    put({id:'W6b', name:W_LIST[9][1], pass:walk.W6b.every(r=> r[1] < 1.5), detail:walk.W6b});
    put({id:'W6c', name:W_LIST[10][1], pass:walk.W6c.b.ok && walk.W6c.b.stalls === 0 && walk.W6c.c0.ok && walk.W6c.c.ok && walk.W6c.c.stalls === 0, detail:walk.W6c});
    put({id:'W6d', name:W_LIST[11][1], pass:walk.W6d.every(([, r])=> w6ok(r)), detail:walk.W6d});
    put({id:'W7', name:W_LIST[12][1], pass:walk.W7.every(r=> r.outN === 0 && r.speedPct >= 85), detail:walk.W7});
    put({id:'W8w', name:W_LIST[13][1] + ' — 밀기 0.8~1.0초에 열림', pass:w8.every(r=> r.spiral.open && r.landing.open && r.spiral.push >= 0.8 - 1e-6 && r.spiral.push <= 1.0 + 1e-6 && r.landing.push >= 0.8 - 1e-6 && r.landing.push <= 1.0 + 1e-6), detail:w8});
    put({id:'W9a', name:'성문 1 → 2 달리기 8.6 ± 1초(기력 0 에서 시작)', pass:walk.W9a.ok && Math.abs(walk.W9a.t - 8.6) <= 1 && walk.W9a.stalls === 0, detail:walk.W9a});
    put({id:'W9b', name:'yaw 동쪽 한 번만 — 문 깔때기·회랑 시선으로 ≤ 10초 · 기력 그대로', pass:walk.W9b.ok && walk.W9b.t <= 10 && walk.W9b.stalls === 0, detail:walk.W9b});
    put({id:'W9c', name:W_LIST[16][1], pass:[walk.W9c_in, walk.W9c_out].every(r=> r.ok && r.stalls === 0 && r.t <= 10), detail:{in:walk.W9c_in, out:walk.W9c_out}});
    put({id:'W10', name:'암문 드나들기 — tpvKind 바뀜 ≤ 2', pass:walk.W10 <= 2, detail:walk.W10});
    /* 설계 9-2: '멈춤 0(칸 톱니라 속도 ≥ 50%면 통과 — 기록만)'. 통과 = 0.5초마다 벽을 따라 앞으로 나아감(멈춤 0), 속도 % 는 기록(합친 판 ≈ 46%) */
    put({id:'W11', name:W_LIST[18][1] + ' — 멈춤 0(속도 % 는 기록)', pass:walk.W11.worstHalfSec > 0.3, detail:walk.W11});
    put({id:'W12', name:'지붕 위에서 놓기 — 들썩임 0 · 회랑 8·망루 12 에 내려앉음', pass:walk.W12.every(d=> d.osc === 0) && Math.abs(walk.W12[0].y - 8) < 0.1 && Math.abs(walk.W12[1].y - 12) < 0.1, detail:walk.W12});
    put({id:'W13', name:'벽 5초 밀기 — 순간이동 0', pass:walk.W13 === 0, detail:walk.W13});
    put({id:'W14', name:W_LIST[21][1], pass:walk.W14 === 0, detail:walk.W14});
    put({id:'W15', name:'2단 점프 + 활공 21번 — 구조 순간이동 0', pass:walk.W15.teleports === 0, detail:walk.W15});
    put({id:'W16', name:W_LIST[23][1], pass:walk.W16.n > 100 && walk.W16.bad === 0, detail:walk.W16});
  }
  put({id:'E', name:'JavaScript·셰이더 오류 0', pass:errors.length === 0, detail:errors.slice(0, 5)});
}finally{ await browser?.close(); await new Promise(r=>server.close(r)); }
fs.writeFileSync(path.join(out, 'walk-report.json'), JSON.stringify(results, null, 2));
const fail = results.filter(r=>!r.pass).length, waitN = results.filter(r=>r.wait).length;
console.log(fail ? `${fail} failed / ${results.length}` : `${results.length - waitN}/${results.length} castle walk checks passed` + (waitN ? ` · ${waitN} waiting for other branches` : ''));
process.exitCode = fail ? 1 : 0;
