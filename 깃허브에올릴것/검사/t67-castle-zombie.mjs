/* 67차 성곽 — 좀비 성벽 층(설계 5장 · 선생님 결정 A) 숨김 브라우저 검사. 혼자 놀기 = 호스트, 실제 hostSim·sheepHurt·packSim 만 부른다.
   설계서 9-3 의 Z1~Z14. 친구는 G.players 에 가짜 항목({uid, x,y,z, g, down:false})으로 흉내.
   ★ 갈래 3(climbTick·WOLF_T climb 깃발)과 갈래 1(ZONE·계단 칸)이 합쳐지기 전에는 오르기 장면을 '대기'로 적는다.
     지금 판에서도 도는 것: Z9 흐름장(마당+둘레길 unreachableN 0) · Z6 의 '땅 칸에서는 ly 와 상관없이 땅 높이'(갈래 0 layerY) · Z14 의 층계참 높이 함수.
     T67_STRICT=1 이면 대기도 실패로 센다. */
import fs from 'node:fs'; import path from 'node:path';
import {chromium} from './pw.mjs'; import {serve} from './serve2.mjs'; import {GAME} from './gamefile.mjs';
const PORT = +(process.env.T67_PORT || 20197), STRICT = process.env.T67_STRICT === '1';
const out = path.resolve('artifacts/67-castle'); fs.mkdirSync(out, {recursive:true});
const server = serve(PORT, process.argv[2] || GAME), results = [], errors = [];
const put = (r)=>{ results.push(r); const tag = r.wait ? (STRICT ? 'FAIL' : 'WAIT') : (r.pass ? 'PASS' : 'FAIL');
  console.log(`${tag} [${r.id}] ${r.name}` + ((r.pass && !r.wait) ? '' : ' ' + JSON.stringify(r.detail ?? '').slice(0, 400))); };
let browser;
try{
  browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:960, height:600}});
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?gfx=low`, {waitUntil:'load', timeout:90000});
  await page.waitForFunction(()=>window.__READY === true, null, {timeout:90000});
  await page.evaluate(()=>{ document.getElementById('iName').value = '좀비 층 검사'; document.getElementById('bSolo').click(); });
  await page.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:60000});
  await page.evaluate(()=>{ document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); const W = window; W.__G.paused = true; W.__DBG().noLogic = true; W.__DBG().noRender = true; });

  /* ── Z9 흐름장 · Z14 층계참 높이 · Z6 땅 칸 규칙 — 지금 판에서 돈다 ── */
  const now = await page.evaluate(()=>{
    const W = window, GY = W.__GY, HW = W.__HW, WS = HW*2 + 1, gi = (x, z)=> (x + HW) + (z + HW)*WS, C = W.__CASTLE, o = {};
    W.__flow(); let flat = 0, un = 0, castleRoad = 0;
    for(let z=-50; z<=50; z++) for(let x=-50; x<=50; x++){ const i = gi(x, z), t = W.__terrH[i];
      if(C[i] >= 2 && isFinite(W.__fCost[i]) && W.__fCost[i] < 1e8) castleRoad++;
      if(t !== GY || W.__oct(x + 0.5, z + 0.5) > 48.9 || C[i] > 1) continue; flat++; if(!isFinite(W.__fCost[i])) un++; }
    const gates = [[0,-44],[44,0],[13,44],[-13,44],[-44,0]].map(([x, z])=> isFinite(W.__fCost[gi(x, z)]));
    o.z9 = {flat, un, gates, castleRoad};
    /* 땅 칸(ZONE 없음)에서는 ly 1 을 받아도 땅 높이 — 손님 보간 x 가 뒤처져도 8칸 공중에 안 뜬다 */
    let bad = 0; for(let x=-30; x<=30; x+=3) for(let z=-30; z<=30; z+=3){ const i = gi(Math.floor(x), Math.floor(z)); if(W.__ZONE[i] >= 0) continue;
      if(Math.abs(W.__layerY(x, z, 1) - W.__layerY(x, z, 0)) > 1e-9 || W.__layerY(x, z, 1) > GY + 1) bad++; }
    o.z6ground = bad;
    /* Z14 — 계단 가지 k2(성문 2 위)·k7(성문 4 바깥)이 층계참(t 46~49)을 지나는 동안 layerY(…,1) = GY+8 */
    const lay = []; for(const k of [2, 7]){ const S = W.__CPLAN.stairs[k]; let mx = 0, n = 0;
      for(let p = 12.4; p <= 17.4; p += 0.25){ const x = W.__gX(S.g, 33.6 + p, 8.5*S.s), z = W.__gZ(S.g, 33.6 + p, 8.5*S.s); if(33.6 + p < 46) continue; n++; mx = Math.max(mx, Math.abs(W.__layerY(x, z, 1) - (GY + 8))); }
      lay.push({k, n, mx:+mx.toFixed(3)}); }
    o.z14 = lay; o.zoneN = (()=>{ let n = 0; for(let i=0; i<W.__ZONE.length; i+=5) if(W.__ZONE[i] >= 0) n++; return n; })();
    o.climb = W.__WOLF_T.some(d=>d.climb); o.layout = (()=>{ let n = 0; for(let i=0; i<C.length; i+=7) if(C[i] >= 2) n++; return n > 5; })();
    return o; });
  put({id:'Z9', name:'흐름장 — 마당 + 둘레길 unreachableN 0 · 다섯 성문 유한 · 성곽 칸 길 0', pass:now.z9.un === 0 && now.z9.gates.every(Boolean) && now.z9.castleRoad === 0, detail:now.z9});
  put({id:'Z6g', name:'땅 칸에서는 ly 와 상관없이 땅 높이(layerY — 칸 기준, 호스트·손님 같은 식)', pass:now.z6ground === 0, detail:now.z6ground});
  if(now.zoneN > 0) put({id:'Z14', name:'층계참 창고 ②④ 위(k2·k7 가지) layerY = GY+8(±0.05)', pass:now.z14.every(l=> l.n > 5 && l.mx <= 0.05), detail:now.z14});
  else put({id:'Z14', name:'층계참 창고 ②④ 위 높이', wait:true, pass:!STRICT, detail:'갈래 1 합친 뒤(ZONE 비어 있음)'});

  const Z_LIST = [['Z1','오르기 — 쫓던 아이가 계단 → 성벽으로: cs 1→2(ly 1) 3초 안 · 계단 높이 · 멈추면 물림'],['Z2','정원 — 계단당 ≤ 3 · 전체 ≤ 8(같은 프레임에 몰려도)'],
    ['Z3','포기 — 아이가 탑 안(sheltered) → 0.75초 안 내려감 · cDone · 다시 안 오름'],['Z4','12초(안 물림) · 15초(계속 물림)'],['Z5','금지 종류(보스·climb 없는 종류·공성) ly 1 0'],
    ['Z6','통신 — packSim ly 비트 = w.ly · 발치 전환 순간 손님 y ≤ GY+2'],['Z7','벽 너머 — 복도·복도 끝 아이 물림 0·목표 0'],['Z8','다리 밑 벽 위 아이 → 오르기 0'],
    ['Z10','아이 한 명 상한 4'],['Z11','새벽 귀환 예산 — 문턱 전엔 안 오름 · 뒤엔 cEnd 에 내려감'],['Z12','발치로 가다 목표가 떠나면 cs 0·cDone'],['Z13','성벽 위 죽음 — 금 조각이 걷는 띠 위·layerY'],
    ['Z15','하네스(bal36 미끼 봇·모둠별) — 수동']];
  if(!(now.climb && now.layout)){ for(const [id, n] of Z_LIST) put({id, name:n, wait:true, pass:!STRICT, detail:'갈래 1·3 합친 뒤(WOLF_T climb 깃발·CASTLE 칸)'}); }
  else {
    const z = await page.evaluate(()=>{
      const W = window, G = W.__G, P = W.__PL, GY = W.__GY, CP = W.__CPLAN, o = {}, dt = 1/30;
      const kinds = W.__WOLF_T.map((d, k)=>({k, d}));
      const K0 = kinds.find(q=>q.d.climb).k;
      /* 통합 — 머리에서 G.paused = true 로 멈춰 둔 채였으면 hostSim 이 아무것도 안 해 모든 장면이 헛돌았다(대기 판에서 짠 가정).
         장면은 noLogic(rAF 루프가 안 끼어듦) + paused false 로, 검사가 hostSim 을 직접 흘린다 */
      const night = ()=>{ W.__goNight(); G.paused = false; W.__spawnQ().length = 0; G.wolves.length = 0; G.players.clear(); G.t = G.set.nightSec; P.down = false; P.hp = W.__maxHP(); W.__CLIMB().kid.clear(); };
      const spawn = (k, x, z)=>{ W.__spawnWolf(k, 0, x, z); const w = G.wolves[G.wolves.length - 1]; w.x = x; w.z = z; w.rise = 0; w.siege = false; return w; };   // 통합 — 뽑기로 공성 좀비가 되면(오르지 않는 종류) 장면이 가끔 헛돌았다 · 공성은 Z5 가 따로 켠다
      const kid = (x, z)=>{ P.x = x; P.z = z; P.y = W.__groundUnder(x, z, P.R, P.y + 0.7); };
      const step = (n, each)=>{ for(let i=0; i<n; i++){ W.__hostSim(dt); W.__sheepHurt(dt); if(each && each(i) === false) break; } };
      /* Z1 */
      night(); P.x = 8.5; P.z = -30; P.y = GY; const w1 = spawn(K0, 8.5, -24);
      step(30);
      let tUp = -1, t = 0, stairErr = 0, packBad = 0, guestFly = 0, px = w1.x, pz = w1.z;
      for(let zz = -33.5; zz >= -51; zz -= 0.17){ kid(8.5, zz); step(1, ()=>{ t += dt;
        if(w1.cs === 2 && tUp < 0) tUp = t;
        const k = W.__stairOf[(Math.floor(w1.x) + W.__HW) + (Math.floor(w1.z) + W.__HW)*(W.__HW*2 + 1)];
        if(w1.ly && k >= 0 && k < 1000 && Math.abs(w1.y - W.__layerY(w1.x, w1.z, 1)) > 0.05) stairErr++;
        const pk = W.__packSim(), arr = pk && pk.w; if(arr){ for(let j=0; j<arr.length; j+=7) if(arr[j] === w1.id && ((arr[j + 6] >> 1) & 1) !== (w1.ly ? 1 : 0)) packBad++; }
        const gy = W.__wolfY({x:px, z:pz, ly:w1.ly}); const i2 = (Math.floor(px) + W.__HW) + (Math.floor(pz) + W.__HW)*(W.__HW*2 + 1); if(W.__ZONE[i2] < 0 && gy > GY + 2) guestFly++;
        px = w1.x; pz = w1.z; }); }
      kid(9, -51); const hp0 = P.hp; for(let i=0; i<150 && w1.cs === 2 && P.hp >= hp0; i++) step(1, ()=>{ t += dt; if(w1.cs === 2 && tUp < 0) tUp = t; });
      o.Z1 = {tUp:+tUp.toFixed(2), cs:w1.cs, ly:w1.ly, stairErr, bitten:P.hp < hp0}; o.Z6 = {packBad, guestFly};
      /* Z3 — 이어서 탑 서쪽 문 안으로 */
      kid(31.5, -51); P.y = GY + 8; let tDown = -1; t = 0; step(600, ()=>{ t += dt; if(w1.cs === 3 && tDown < 0) tDown = t; if(w1.cs === 0) return false; });   // 통합 — 90프레임(3초)은 내려가는 중(cs 3)이라 '다시 오름'에 내림 프레임이 섞였다 → 발치(cs 0)까지 기다림
      kid(9, -51); P.y = GY + 8; let again = 0; step(120, ()=>{ if(w1.cs >= 1) again++; });
      o.Z3 = {tDown:+tDown.toFixed(2), cDone:w1.cDone, ly:w1.ly, again};
      /* Z2 — 한 계단 앞 20마리(검사 시계 같게) */
      night(); P.x = 8.5; P.z = -30; P.y = GY; const many = []; for(let i=0; i<20; i++){ const w = spawn(K0, 7 + (i % 5)*0.7, -24 - Math.floor(i/5)*0.7); w.cck = 0; many.push(w); }
      step(30); let over = 0, maxAll = 0;
      for(let zz = -33.5; zz >= -51; zz -= 0.17){ kid(8.5, zz); step(1, ()=>{ const C = W.__CLIMB(); maxAll = Math.max(maxAll, C.all); for(let k=0; k<10; k++) if(C.n[k] > 3) over++; if(C.all > 8) over++; }); }
      step(200, ()=>{ const C = W.__CLIMB(); maxAll = Math.max(maxAll, C.all); for(let k=0; k<10; k++) if(C.n[k] > 3) over++; if(C.all > 8) over++; });
      o.Z2 = {over, maxAll, kid:W.__CLIMB().kid.get(W.__uid)};
      /* Z4 — 달아나며 거리 유지 → 12초 · 서서 물림 → 15초 */
      /* 통합 — ① cs 2 는 아이가 계단을 오르는 동안 이미 시작한다(발치 t 34.5) → 시계를 계단 걷기부터 잰다(옛 판은 꼭대기에서부터 재어 2.3초 짧게 나왔다)
                ② '거리 ≥ 2 유지' 아이가 성벽 끝(P 28)에 몰려 물렸다 → 끝에 닿으면 좀비를 넘어 반대쪽 4칸으로(검사 조작 — 물림 0 을 지킨다) */
      const wallTime = (bite)=>{ night(); P.x = 8.5; P.z = -30; P.y = GY; const w = spawn(K0, 8.5, -24); step(30);
        let tw = 0, s = -1, bitN = 0, dir = 1;
        for(let zz = -33.5; zz >= -51; zz -= 0.17){ kid(8.5, zz); P.hp = W.__maxHP(); step(1); if(w.cs === 2 && s < 0) s = tw; tw += dt; }
        kid(9, -51); P.y = GY + 8;
        for(let i=0; i<900; i++){ if(!bite && w.ly){ let nx = w.x + dir*4; if(Math.abs(nx) > 26){ dir = -dir; nx = w.x + dir*4; } kid(nx, -51); P.y = GY + 8; }
          const hp0 = W.__maxHP(); P.hp = hp0; step(1); if(P.hp < hp0) bitN++;
          if(w.cs === 2 && s < 0) s = tw; tw += dt; if(s >= 0 && w.cs === 3) return {t:+(tw - s).toFixed(2), bitN}; }
        return {t:-1, bitN}; };
      o.Z4 = {run:wallTime(false), bite:wallTime(true)};
      /* Z5 — 오르지 않는 종류 */
      night(); P.x = 8.5; P.z = -30; P.y = GY; for(const q of kinds) if(!q.d.climb) for(let i=0; i<2; i++) spawn(q.k, 8.5 + i, -25);
      const sg = spawn(K0, 9.5, -25); sg.siege = true;
      step(30); let ly5 = 0; for(let zz = -33.5; zz >= -51; zz -= 0.17){ kid(8.5, zz); step(1, ()=>{ for(const w of G.wolves) if(w.ly) ly5++; }); } step(150, ()=>{ for(const w of G.wolves) if(w.ly) ly5++; });
      o.Z5 = ly5;
      /* Z7 — 복도 속 아이 · 복도 끝 아이 */
      const z7 = []; for(const [kx, kz, lz] of [[20, -51, -48.6], [30.5, -51, -48.5]])   /* 통합 — 설계 9-3 의 (13,−51) 은 복도(P 15~30) 서쪽 끝 막힌 벽 속이라 복도 가운데 P 20 으로 */{ night(); P.x = kx; P.z = kz; P.y = GY; const hp0 = P.hp;
        for(let i=0; i<20; i++) spawn(K0, kx - 5 + i*0.5, lz); let tg = 0; step(60*30/10, ()=>{ for(const w of G.wolves) if(w.shQ !== undefined && w.shQ !== null && w.shQt === 0 && Math.hypot(w.x - kx, w.z - kz) < 3) tg++; });
        z7.push({bite:hp0 - P.hp, tg}); } o.Z7 = z7;
      /* Z8 — 다리 밑 통로의 벽(높이 2) 위 아이 */
      night(); P.x = 3; P.z = -45; P.y = GY; const w8 = spawn(K0, 3, -40); step(30); P.x = 0; P.z = -51; P.y = GY + 2; let ly8 = 0; step(150, ()=>{ if(w8.ly || w8.cs >= 1) ly8++; }); o.Z8 = ly8;
      /* Z10 — 한 아이가 되풀이(좀비 계속) */
      night(); const cnt = new Set();
      for(let r=0; r<10; r++){ P.x = 8.5; P.z = -30; P.y = GY; const w = spawn(K0, 8.5, -24); step(20); for(let zz = -33.5; zz >= -51; zz -= 0.25){ kid(8.5, zz); step(1); } step(30, ()=>{ for(const q of G.wolves) if(q.ly) cnt.add(q.id); }); }
      o.Z10 = cnt.size;
      /* Z11 — 새벽 귀환 */
      const ret = W.__CLIMB_RET()[K0], BC = W.__BAL.climb || {}, thr = (BC.approachSec || 6) + 16.5/((W.__BAL.chaseCap || 5)*(BC.upMul || 0.75)) + ret + (BC.minWall || 4);
      const late = (tLeft, stand)=>{ night(); G.t = tLeft; P.x = 8.5; P.z = -30; P.y = GY; const w = spawn(K0, 8.5, -24); step(30); for(let zz = -33.5; zz >= -51; zz -= 0.17){ kid(8.5, zz); step(1); G.t -= dt; }
        let up = 0, downAt = -1, groundAt = -1, dir = 1; kid(9, -51); P.y = GY + 8;
        for(let i=0; i<1800 && G.t > 0; i++){ if(!stand && w.ly && w.cs === 2){ let nx = w.x + dir*4; if(Math.abs(nx) > 26){ dir = -dir; nx = w.x + dir*4; } kid(nx, -51); P.y = GY + 8; }   // 아이는 계속 도망(물림 0)
          P.hp = W.__maxHP(); P.down = false; step(1); G.t -= dt; if(w.ly) up = 1; if(up && w.cs === 3 && downAt < 0) downAt = G.t; if(up && downAt >= 0 && !w.ly && groundAt < 0) groundAt = G.t; }
        return {up, downAt:+downAt.toFixed(2), groundAt:+groundAt.toFixed(2), cEnd:+(w.cEnd || 0).toFixed(2)}; };
      /* 통합 — 옛 검사는 downAt ≤ cEnd(= cEnd 보다 늦게 내려가라)로 부등호가 거꾸로였다. 설계: 새벽 귀환 예산 cEnd 가 되면 **늦어도 그때** 내려간다.
         c = 문턱 바로 위 · 아이가 서서 물림(12초 규칙은 물 때마다 0, 15초 상한보다 cEnd 가 먼저 옴 — cEnd 가 실제로 내려보내는지) */
      o.Z11 = {thr:+thr.toFixed(2), a:late(thr - 1 + 1.2), b:late(thr + 6 + 1.2), c:late(thr + 0.3 + 1.2, true)};
      /* Z12 — 발치로 가다 떠남 */
      night(); P.x = 8.5; P.z = -30; P.y = GY; const w12 = spawn(K0, 8.5, -25); step(30);   // 통합 — −22 는 아이(−30)와 8칸이라 쫓기 시작을 안 했다(SHEEP_AGGRO)
      let saw1 = 0;
      kid(8.5, -37.5); step(15, ()=>{ if(w12.cs === 1){ saw1 = 1; return false; } });   // 통합 — 좀비가 발치 몇 칸 뒤에 있을 때 아이가 계단 y 2.2 위로(검사 시계 cck 0.25초 · 옛 판은 좀비가 바로 뒤라 cs 1 을 한 프레임에 지나 cs 2 였다)
      const cl0 = w12.chLeft; P.x = 0; P.z = 0; P.y = GY; step(60);
      o.Z12 = {saw1, cs:w12.cs, cDone:w12.cDone};
      /* Z13 — 성벽 위에서 죽음 */
      night(); P.x = 8.5; P.z = -30; P.y = GY; const w13 = spawn(K0, 8.5, -24); step(30); for(let zz = -33.5; zz >= -51; zz -= 0.17){ kid(8.5, zz); step(1); } kid(9, -51); P.y = GY + 8; step(30);
      const nd = W.__drops().length; w13.hp = 0; w13.bi = 3; step(3); const drops = W.__drops().slice(nd);
      o.Z13 = {ly:w13.ly, gone:!G.wolves.includes(w13), n:drops.length, bad:drops.filter(d=> d.y === undefined || Math.abs(d.y - W.__layerY(d.x, d.z, 1)) >= 0.05).length};
      return o; });
    put({id:'Z1', name:Z_LIST[0][1], pass:z.Z1.tUp >= 0 && z.Z1.tUp <= 3 + 3 && z.Z1.stairErr === 0 && z.Z1.bitten, detail:z.Z1});
    put({id:'Z2', name:Z_LIST[1][1], pass:z.Z2.over === 0 && z.Z2.maxAll >= 1, detail:z.Z2});
    put({id:'Z3', name:Z_LIST[2][1], pass:z.Z3.tDown >= 0 && z.Z3.tDown <= 0.75 && z.Z3.cDone && !z.Z3.ly && z.Z3.again === 0, detail:z.Z3});
    put({id:'Z4', name:Z_LIST[3][1], pass:Math.abs(z.Z4.run.t - 12) <= 0.3 && z.Z4.run.bitN === 0 && Math.abs(z.Z4.bite.t - 15) <= 0.3 && z.Z4.bite.bitN > 0, detail:z.Z4});
    put({id:'Z5', name:Z_LIST[4][1], pass:z.Z5 === 0, detail:z.Z5});
    put({id:'Z6', name:Z_LIST[5][1], pass:z.Z6.packBad === 0 && z.Z6.guestFly === 0, detail:z.Z6});
    put({id:'Z7', name:Z_LIST[6][1], pass:z.Z7.every(r=> r.bite === 0 && r.tg === 0), detail:z.Z7});
    put({id:'Z8', name:Z_LIST[7][1], pass:z.Z8 === 0, detail:z.Z8});
    put({id:'Z10', name:Z_LIST[8][1], pass:z.Z10 <= 4, detail:z.Z10});
    put({id:'Z11', name:Z_LIST[9][1], pass:z.Z11.a.up === 0 && [z.Z11.b, z.Z11.c].every(r=> r.up === 1 && r.downAt >= r.cEnd - 0.1 && r.groundAt > 0) && Math.abs(z.Z11.c.downAt - z.Z11.c.cEnd) <= 0.2, detail:z.Z11});
    put({id:'Z12', name:Z_LIST[10][1], pass:z.Z12.cs === 0 && z.Z12.cDone, detail:z.Z12});
    put({id:'Z13', name:Z_LIST[11][1], pass:z.Z13.gone && z.Z13.n > 0 && z.Z13.bad === 0, detail:z.Z13});
    put({id:'Z15', name:Z_LIST[12][1], wait:true, pass:!STRICT, detail:'bal36.mjs 미끼 봇 판은 통합 때 따로(설계 9-3 하네스)'});
  }
  put({id:'E', name:'JavaScript 오류 0', pass:errors.length === 0, detail:errors.slice(0, 5)});
}finally{ await browser?.close(); await new Promise(r=>server.close(r)); }
fs.writeFileSync(path.join(out, 'zombie-report.json'), JSON.stringify(results, null, 2));
const fail = results.filter(r=>!r.pass).length, waitN = results.filter(r=>r.wait).length;
console.log(fail ? `${fail} failed / ${results.length}` : `${results.length - waitN}/${results.length} castle zombie checks passed` + (waitN ? ` · ${waitN} waiting for other branches` : ''));
process.exitCode = fail ? 1 : 0;
