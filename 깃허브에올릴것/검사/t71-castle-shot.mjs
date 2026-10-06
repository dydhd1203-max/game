/* 71차 — 성벽이 총알을 막는 규칙을 어디서나 같게(선생님: "마당에서 성벽 너머로 쏘는 게 맞아야 사실적인 거 아니야?" → "응 그렇게 해줘").
   벽 윗면 위로 넘어가는 총알은 맞고, 돌을 뚫어야 닿는 총알만 막힌다(castleHitT · castleOccluded · castleAimY). 숨김 브라우저 한 개(pw.mjs · ?gfx=low · 혼자 놀기 · 멈춘 채).
   G1 마당 → 벽 뒤(성 밖) 좀비 못 맞힘 · G2 마당 → 성문 계단 위 좀비(보이면 맞고 흉벽에 가리면 안 맞음 — 돌 조각 광선과 같게) · G3 트인 성벽 길 크레넬 사이로 맞힘 · 성가퀴 뒤는 막힘
   G4 지붕 밑 쏘기 틈 그대로(틈으로 통과 · 옆 벽 막힘) · G5 머리만 보이는 좀비 맞힘(가슴은 턱에 가림) · G6 예광탄이 돌에서 멈춤(돌가루·불티 · 벽에 붙어 쏘면 예광탄 없이)
   G7 모델 ↔ 실제 돌 조각 광선(성곽·성문 돌 뱅크) — 보이는데 막힘 · 가렸는데 통과 비율(장면 다섯) · G8 비용(한 번 µs · 기록) · G9 탑 사격·서바이벌·손님 길 그대로(소스) · G10 72차 성벽 위 몸 내밀어 쏘기(맞힘 비율·안 내미는 곳·먼 돌) · G11 몸 내밀기 카메라(잠겼는데 안 보임·돌 속·떨림) */
import fs from 'node:fs';
import {chromium} from './pw.mjs'; import {serve} from './serve2.mjs'; import {GAME} from './gamefile.mjs';
const PORT = +(process.env.T71_PORT || 20198), file = process.argv[2] || GAME;
const server = serve(PORT, file), results = [], errors = [];
const put = (r)=>{ results.push(r); console.log(`${r.pass ? 'PASS' : 'FAIL'} [${r.id}] ${r.name}` + (r.pass ? '' : ' ' + JSON.stringify(r.detail ?? '').slice(0, 700))); };
const code = fs.readFileSync(file, 'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const fnSrc = (name)=>{ const i = code.indexOf('function ' + name + '('); if(i < 0) return ''; let b = 0, o = false; for(let j=i; j<code.length; j++){ const c = code[j]; if(c === '{'){ b++; o = true; } else if(c === '}'){ b--; if(o && b === 0) return code.slice(i, j + 1); } } return ''; };
let browser;
try{
  browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:960, height:600}});
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?gfx=low`, {waitUntil:'load', timeout:180000});
  await page.waitForFunction(()=>window.__READY === true, null, {timeout:180000});
  await page.evaluate(()=>{ document.getElementById('iName').value = '71차 검사'; document.getElementById('bSolo').click(); });
  await page.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:120000});
  const R = await page.evaluate(()=>{
    const W = window, G = W.__G, GY = W.__GY, PL = W.__PL, CP = W.__CPLAN, THREE = W.__THREE, f3 = v=> Math.round(v*1000)/1000;
    W.__introDone(); // Test the castle after leaving the pre-game waiting room.
    document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
    W.__DBG().noLogic = true; W.__DBG().noRender = true; G.paused = true; G.wolves.length = 0;
    const occ = (e, t)=> W.__castleOccluded(e[0], e[1], e[2], t[0], t[1], t[2]);
    const setPL = (x, y, z)=>{ PL.x = x; PL.y = y; PL.z = z; };
    const ground = (x, z)=> W.__groundUnder(x, z, 0.28, GY + 20);
    const Z = (x, y, z, k)=> ({x, y, z, k:k || 0, hp:10, id:9999});
    const aimY = (e, w)=> W.__castleAimY(e[0], e[1], e[2], w);
    /* 실제 돌 조각 광선(참값) — 성곽·성문 돌 뱅크만(나무·지붕 판·소품·땅은 뺀다) */
    const ms = []; for(const k of ['cbrk', 'cbrkL', 'cboxC', 'cboxN', 'ccope', 'cvous', 'cmerl', 'gbrick', 'gcore']){ const bk = W.__banks.get(k); if(!bk || !bk.chunks) continue;
      if(!bk.on){ ms.push(...bk.chunks); continue; }
      /* 81차 — 그리기 버퍼엔 화면·그림자에 닿는 칸만 담긴다(칸 뺐다 채우기). 참값은 켜진 칸 전부(처음 자리 b.ms)로 따로 만든다 */
      const live = []; for(let i=0; i<bk.ms.length; i++) if(bk.on[i]) live.push(i);
      const im = new THREE.InstancedMesh(bk.geo, bk.mat, live.length); live.forEach((i, j)=> im.setMatrixAt(j, bk.ms[i])); im.computeBoundingSphere(); im.updateMatrixWorld(true); ms.push(im); }
    const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dv = new THREE.Vector3();
    const ray1 = (e, t)=>{ const L = Math.hypot(t[0] - e[0], t[1] - e[1], t[2] - e[2]); o.set(e[0], e[1], e[2]); dv.set(t[0] - e[0], t[1] - e[1], t[2] - e[2]).normalize(); rc.set(o, dv); rc.near = 0.05; rc.far = L - 0.3; return rc.intersectObjects(ms, false).length > 0; };
    /* 참값 = 선 셋(가운데 · 옆 ±0.03) 다수결 — 66 성문 흉벽 돌 사이 4cm 줄눈(속 몸 없음)·모서리 모따기를 스치는 한 줄 광선에 안 흔들리게 */
    const hit3 = (e, t)=>{ const dx = t[0] - e[0], dz = t[2] - e[2], L = Math.hypot(dx, dz) || 1, px = -dz/L*0.03, pz = dx/L*0.03; let n = 0;
      for(const k of [0, 1, -1]) if(ray1([e[0] + px*k, e[1], e[2] + pz*k], [t[0] + px*k, t[1], t[2] + pz*k])) n++; return n; };
    const stoneHid = (e, t)=> hit3(e, t) >= 2;
    const out = {band:W.__castBand()};
    /* G1 */
    { const e = [20, GY + 1.12, -44]; setPL(20, GY, -44); let n = 0, hit = 0;
      for(const x of [14, 17, 20, 23, 26]) for(const zz of [-58, -62, -66]){ n++; if(aimY(e, Z(x, ground(x, zz), zz)) >= 0) hit++; }
      out.G1 = {n, hit}; }
    /* G2 — 계단 발치·옆에서 계단 위 좀비: 모델(가슴·머리)과 돌 조각 광선(가슴·머리 둘 다 가리면 가림)이 같아야 */
    { const res = []; let same = 0, vis = 0, hit = 0;
      for(const g of [0, 1, 4]) for(const s of [-1, 1]) for(const [dt, dp] of [[-8, 0], [-10, 0.6], [-6, 3.5], [-4, 7]]) for(const wt of [37, 40.5, 44]){
        const wp = 8.5*s, wx = W.__gX(g, wt, wp), wz = W.__gZ(g, wt, wp), w = Z(wx, ground(wx, wz), wz);
        const ex = W.__gX(g, wt + dt, wp + dp*s), ez = W.__gZ(g, wt + dt, wp + dp*s), e = [ex, ground(ex, ez) + 1.12, ez]; setPL(ex, e[1] - 1.12, ez);
        const hy = 1.5*0.7, a = aimY(e, w), v = !stoneHid(e, [wx, w.y + 0.85, wz]) || !stoneHid(e, [wx, w.y + hy, wz]);
        if(v) vis++; if(a >= 0) hit++; if((a >= 0) === v) same++; else if(res.length < 6) res.push([g, s, dt, dp, wt, f3(w.y - GY), a, v]); }
      out.G2 = {n:5*0 + 3*2*4*3, vis, hit, same, bad:res}; }
    /* G3 — 성문 1 동쪽 곧은 벽 바깥 성가퀴 앞(t 52.27)에서 성 밖(t 68) 좀비: 크레넬 가운데 · 성가퀴 가운데 */
    { const St = CP.straights.find(s=> s.g === 0 && s.s === 1), P1 = 11 + St.len, a0 = 11.5, len = P1 - a0, nM = Math.max(1, Math.round(len/1.6)), step = len/nM;
      const one = (x)=>{ const e = [x, GY + 9.12, -52.27]; setPL(x, GY + 8, -52.27); return !occ(e, [x, ground(x, -68) + 0.85, -68]); };   // 돌 선 하나(몸 안 내밀고)
      const lean = (x)=>{ const e = [x, GY + 9.12, -52.27]; setPL(x, GY + 8, -52.27); return aimY(e, Z(x, ground(x, -68), -68)) >= 0; };   // 72차 — 몸 내밀기
      let cren = 0, merl = 0, n = 0, leanM = 0; for(let i=1; i<nM; i++){ n++; if(one(a0 + step*i)) cren++; if(one(a0 + step*(i + 0.5))) merl++; if(lean(a0 + step*(i + 0.5))) leanM++; }
      out.G3 = {n, cren, merl, leanM, step:f3(step)}; }
    /* G10 — 72차 몸 내밀어 쏘기(선생님 고름): 성벽 위(발 ≥ GY+7.5 · 지붕 밖)는 바로 앞 흉벽·성가퀴 너머에서 잰다.
       a 성벽 길 가장자리·가운데 → 성 밖 3~30칸 발치 좀비 ≥ 80% · b 성문 위(번호판 벽 옆) → 협곡 ≥ 80% · c K 윗마당 → 협곡 바닥 ≥ 80%
       d 안 내미는 곳: 마당(땅)·회랑 지붕 밑·번호판 벽(4.7 — 높은 돌) 앞 · e 내민 눈에서도 멀리 있는 돌은 그대로(돌 조각 광선과 같음 · 가린 선 ≥ 5) */
    { let seed = 21; const rnd = ()=>{ seed = (seed*16807) % 2147483647; return seed/2147483647; };
      const rate = (N, mk)=>{ let n = 0, h = 0; for(let i=0; i<N; i++){ const c = mk(); if(!c) continue; const [f, t] = c; setPL(f[0], f[1], f[2]); n++; if(aimY([f[0], f[1] + 1.12, f[2]], Z(t[0], t[1], t[2])) >= 0) h++; } return {n, pct:Math.round(h/n*1000)/10}; };
      const a = rate(600, ()=>{ const St = CP.straights[(rnd()*8)|0], P = 12 + rnd()*(St.len - 2), wt = rnd() < 0.5 ? 52.0 + rnd()*0.25 : 50.8 + rnd()*0.4, /* 가장자리(성가퀴 앞) · 가운데 */ ex = W.__gX(St.g, wt, P*St.s), ez = W.__gZ(St.g, wt, P*St.s), d = 3 + rnd()*27, P2 = (P + (rnd() - 0.5)*10)*St.s, tx = W.__gX(St.g, 53 + d, P2), tz = W.__gZ(St.g, 53 + d, P2), g = ground(tx, tz); if(g > GY + 3) return null; return [[ex, GY + 8, ez], [tx, g, tz]]; });
      const b = rate(300, ()=>{ const g = (rnd()*5)|0, p = (rnd() < 0.5 ? -1 : 1)*(2.3 + rnd()*3.7), t = 50.6 + rnd()*0.8, tt = 53 + rnd()*22, tp = (rnd() - 0.5)*12, tx = W.__gX(g, tt, tp), tz = W.__gZ(g, tt, tp), gg = ground(tx, tz); if(gg > GY + 3) return null; return [[W.__gX(g, t, p), GY + 8, W.__gZ(g, t, p)], [tx, gg, tz]]; });
      const c = rate(300, ()=>{ const g = rnd() < 0.5 ? 2 : 3, ex = (g === 2 ? 1 : -1)*(2.0 + rnd()*0.25), ez = 58.6 + rnd()*1.6, tt = 54 + rnd()*26, tp = (rnd() - 0.5)*20, tx = W.__gX(g, tt, tp), tz = W.__gZ(g, tt, tp), gg = ground(tx, tz); if(gg > GY + 3) return null; return [[ex, GY + 14, ez], [tx, gg, tz]]; });
      const G0 = CP.galleries[0], gx = (G0.a.x + G0.b.x)/2, gz = (G0.a.z + G0.b.z)/2;
      const nl = (f, t)=>{ setPL(f[0], f[1], f[2]); return W.__castleLean(t[0], t[2]) === null; };
      const d = {yard:nl([20, GY, -44], [20, GY, -62]), gallery:nl([gx, GY + 8, gz], [gx*1.4, GY, gz*1.4]), plate:nl([W.__gX(0, 51, 0), GY + 8, W.__gZ(0, 51, 0)], [W.__gX(0, 62, 0), GY, W.__gZ(0, 62, 0)]),
        walk:!nl([20, GY + 8, -51.8], [20, GY, -62])};
      let n = 0, same = 0, hid = 0; const bad = [];
      for(let i=0; i<1200; i++){ const St = CP.straights[(rnd()*8)|0], end = i % 2, P = end ? 11.3 + rnd()*2.5 : 12 + rnd()*(St.len - 2), wt = 51.4 + rnd()*0.85, ex = W.__gX(St.g, wt, P*St.s), ez = W.__gZ(St.g, wt, P*St.s);
        let tx, tz; if(end){ const P2 = (P - 3 - rnd()*9)*St.s, t2 = 53.5 + rnd()*5; tx = W.__gX(St.g, t2, P2); tz = W.__gZ(St.g, t2, P2); }   // 탑 옆 — 선이 옆 탑을 지나는 곳(먼 돌)
        else { const a2 = Math.atan2(ez, ex) + (rnd() - 0.5)*1.4, r1 = 56 + rnd()*24; tx = Math.cos(a2)*r1; tz = Math.sin(a2)*r1; }
        if(!(ground(tx, tz) <= GY + 3)) continue; const t = [tx, ground(tx, tz) + 0.85, tz]; setPL(ex, GY + 8, ez); const ln = W.__castleLean(tx, tz); if(!ln) continue;
        const e = [ln.x, ln.y, ln.z], h3 = hit3(e, t); if(h3 === 1 || h3 === 2) continue; n++; const m = W.__castleShotT(ex, GY + 9.12, ez, t[0], t[1], t[2]) >= 0;
        if(h3 === 3) hid++; if(m === (h3 === 3)) same++; else if(bad.length < 4) bad.push([e.map(f3), t.map(f3), h3, m]); }
      out.G10 = {a, b, c, d, e:{n, same, hid, bad}}; }
    /* G11 — 72차 2회차 몸 내밀기 카메라(보이는 것만): 성벽 길(가장자리·가운데)에서 조준하고 발치 좀비(성 밖 3~15칸)를 겨누면 1인칭·3인칭 모두
       '조준점이 잠기는데 화면(카메라 → 가슴·머리)이 돌에 가림' ≤ 5% · 옮기는 동안(5·10·20 프레임) 카메라가 돌 속 0 · 멈춰 있으면 카메라 안 움직임 */
    { let seed = 31; const rnd = ()=>{ seed = (seed*16807) % 2147483647; return seed/2147483647; };
      const res = {}; W.__KIT.ownW[3] = true; W.__equipWeapon(3);
      for(const [nm, zoom] of [['p1', 0], ['p3', 3.2]]){ let n = 0, lock = 0, lockHid = 0, inStone = 0, jit = 0; seed = 31;
        for(let i=0; i<400 && n < 60; i++){ const St = CP.straights[(rnd()*8)|0], P = 12 + rnd()*(St.len - 2), wt = i % 2 ? 52.0 + rnd()*0.25 : 50.8 + rnd()*0.4, fx = W.__gX(St.g, wt, P*St.s), fz = W.__gZ(St.g, wt, P*St.s);
          const dd = 3 + rnd()*12, P2 = (P + (rnd() - 0.5)*6)*St.s, tx = W.__gX(St.g, 53 + dd, P2), tz = W.__gZ(St.g, 53 + dd, P2), g = ground(tx, tz); if(g > GY + 3) continue;
          G.wolves.length = 0; W.__spawnWolf(0, 0, tx, tz); const w = G.wolves[G.wolves.length - 1]; if(!w) continue; w.x = tx; w.z = tz; w.y = g; w.rise = 0;
          for(const k in W.__KEY) W.__KEY[k] = false; Object.assign(PL, {x:fx, y:GY + 8, z:fz, vx:0, vz:0, vy:0, down:false, ground:true, mv:false}); W.__camZoom(zoom); W.__setAim(true, true);
          const yaw = Math.atan2(-(tx - fx), -(tz - fz)); let pitch = -0.6;
          for(let it=0; it<4; it++){ for(let k=0; k<40; k++){ PL.x = fx; PL.z = fz; PL.y = GY + 8; PL.yaw = yaw; PL.pitch = pitch; W.__updPlayer(1/60);
              if(it === 0 && (k === 5 || k === 10 || k === 20)){ const c = W.__cam.position; if(occ([c.x, c.y, c.z], [c.x + 0.001, c.y + 0.001, c.z])) inStone++; } }
            const c = W.__cam.position; pitch = Math.max(-1.3, Math.atan2(g + 0.85 - c.y, Math.hypot(tx - c.x, tz - c.z))); }
          const c0 = W.__cam.position.clone(); PL.yaw = yaw; PL.pitch = pitch; W.__updPlayer(1/60); const c = W.__cam.position; if(c.distanceTo(c0) > 0.02) jit++;
          n++; const aw = W.__aimWolf(W.__WEAPONS[3]), cp = [c.x, c.y, c.z], v = hit3(cp, [tx, g + 0.85, tz]) < 3 || hit3(cp, [tx, g + 1.05, tz]) < 3;
          if(aw === w){ lock++; if(!v) lockHid++; } }
        res[nm] = {n, lock, lockHid, inStone, jit}; }
      W.__setAim(false, true); W.__camZoom(3.2); G.wolves.length = 0; out.G11 = res; }
    /* G4 — 복도 쏘기 틈(지붕 밑): 틈 가운데로 마을 쪽 · 옆 6칸 벽 쪽 */
    { const seen = new Set(); let n = 0, pass = 0, side = 0;
      for(const a of CP.apertures){ if(a.kind !== 'slit' || !a.g) continue; const g = a.g, k = f3(g.cx) + ',' + f3(g.cz); if(seen.has(k)) continue; seen.add(k);
        const ex = g.cx + g.nx*1.0, ez = g.cz + g.nz*1.0; setPL(ex, GY, ez); const e = [ex, GY + 1.2, ez]; n++;
        if(!occ(e, [g.cx - g.nx*10, GY + 1.0, g.cz - g.nz*10])) pass++; if(occ(e, [g.cx - g.nx*10 + g.ux*6, GY + 1.0, g.cz - g.nz*10 + g.uz*6])) side++; }
      out.G4 = {n, pass, side}; }
    /* G5 — 성벽 길 안쪽 끝 가까이(턱 너머 0.8~1.8) 좀비를 마당 멀리서: 가슴은 턱에 가리고 머리는 보인다 */
    { let n = 0, head = 0, chest = 0, none = 0, rcHead = 0;
      for(const [kz, wz] of [[-30, -50.5], [-32, -50.3], [-28, -50.8]]) for(const x of [15, 20, 25]){ n++;
        const e = [x, GY + 1.12, kz]; setPL(x, GY, kz); const w = Z(x, GY + 8, wz), a = aimY(e, w);
        if(a > 0.9) head++; else if(a === 0.85) chest++; else none++;
        if(stoneHid(e, [x, GY + 8.85, wz]) && !stoneHid(e, [x, GY + 8 + 1.05, wz])) rcHead++; }
      out.G5 = {n, head, chest, none, rcHead}; }
    /* G6 — 마당에서 벽(z −49)을 보고 쏜다(좀비 없음): 예광탄 끝이 벽 얼굴 · 돌가루 · 벽에 바짝 붙으면 예광탄 없이 돌가루만 */
    { const res = [];
      for(const [pz, wi] of [[-44, 3], [-44, 5], [-45.5, 1], [-48.7, 3]]){
        Object.assign(PL, {x:20, y:GY, z:pz, yaw:0, pitch:0.3, vx:0, vz:0, vy:0, down:false, ground:true});   // 시선 +0.3 — 복도 쏘기 틈(0.5~2.05)보다 높은 벽 얼굴
        W.__KIT.ownW[wi] = true; W.__equipWeapon(wi); W.__KIT.ammo = 999; W.__camZoom(0); W.__setAim(true, true);
        for(let i=0; i<30; i++) W.__updPlayer(1/60); for(let i=0; i<20; i++) W.__updHeld(1/60, false, 0);
        const B = W.__bullets(), before = B.map(q=> q.age + ':' + q.tx + ':' + q.tz), p0 = W.__parts().filter(q=> q.t > 0).length;
        W.__setThrowCd(0); G.paused = false; W.__fireWeapon(); G.paused = true;
        let nb = null; for(let i=0; i<B.length; i++) if(B[i].age + ':' + B[i].tx + ':' + B[i].tz !== before[i]) nb = B[i];
        const cam = W.__cam.position; for(let i=0; i<30; i++) W.__updBullets(1/60);   // 예광탄 머리가 닿아야 돌가루(wallShot 의 on)
        res.push({pz, wi, bullet:nb ? {z:f3(nb.tz), d:f3(Math.hypot(nb.tx - cam.x, nb.ty - cam.y, nb.tz - cam.z))} : null, dust:W.__parts().filter(q=> q.t > 0).length - p0}); }
      W.__setAim(false, true); W.__camZoom(3.2); out.G6 = res; }
    /* G7 — 모델 ↔ 돌 조각 광선. 눈은 아이가 설 수 있는 곳(몸 높이 세로 선이 돌에 안 걸림), 과녁은 좀비가 다니는 곳(땅 ≤ GY + 3 · 세로 선이 돌에 안 걸림) */
    { let seed = 11; const rnd = ()=>{ seed = (seed*16807) % 2147483647; return seed/2147483647; };
      const fam = {}, free = (x, y0, z)=> !occ([x, y0 + 0.1, z], [x + 0.001, y0 + 1.9, z + 0.001]);
      const okT = (x, z)=>{ const g = ground(x, z); return g <= GY + 3 && free(x, g, z); };
      const trial = (nm, e, t, feet)=>{ setPL(feet[0], feet[1], feet[2]); if(!free(feet[0], feet[1], feet[2])) return; const h3 = hit3(e, t), bl = occ(e, t);
        const F = fam[nm] || (fam[nm] = {n:0, vis:0, visBlocked:0, hid:0, hidPassed:0, graze:0, grazeBlocked:0, ex:[]}); F.n++;
        if(h3 === 0){ F.vis++; if(bl){ F.visBlocked++; if(F.ex.length < 3) F.ex.push(['visBlocked', e.map(f3), t.map(f3)]); } }
        else if(h3 === 3){ F.hid++; if(!bl){ F.hidPassed++; if(F.ex.length < 3) F.ex.push(['hidPassed', e.map(f3), t.map(f3)]); } }
        else { F.graze++; if(bl) F.grazeBlocked++; } };
      for(let n=0; n<700; n++){ const a = rnd()*6.283, r0 = 38 + rnd()*8, ex = Math.cos(a)*r0, ez = Math.sin(a)*r0, a2 = a + (rnd() - 0.5)*0.5, r1 = 56 + rnd()*12, tx = Math.cos(a2)*r1, tz = Math.sin(a2)*r1;
        if(ground(ex, ez) > GY + 0.3 || !okT(tx, tz)) continue;
        trial('마당→성 밖', [ex, GY + 1.12, ez], [tx, ground(tx, tz) + 0.85 + rnd()*1.2, tz], [ex, GY, ez]); }
      for(const St of CP.straights) for(let n=0; n<60; n++){ const P = 12 + rnd()*(St.len - 2), t = 49.75 + rnd()*2.45, tx = W.__gX(St.g, t, P*St.s), tz = W.__gZ(St.g, t, P*St.s), d = 5 + rnd()*14, P0 = (P + (rnd() - 0.5)*8)*St.s, ex = W.__gX(St.g, t - d, P0), ez = W.__gZ(St.g, t - d, P0);
        if(ground(ex, ez) > GY + 0.3) continue;
        trial('마당→성벽 길', [ex, GY + 1.12, ez], [tx, GY + 8 + 0.85 + rnd()*0.7, tz], [ex, GY, ez]); }
      for(const St of CP.straights) for(let n=0; n<160; n++){ const P = 12 + rnd()*(St.len - 2), t = n % 2 ? 51.95 + rnd()*0.3 : 49.8 + rnd()*2.45, ex = W.__gX(St.g, t, P*St.s), ez = W.__gZ(St.g, t, P*St.s), a = Math.atan2(ez, ex) + (rnd() - 0.5)*1.2, r1 = 56 + rnd()*24, tx = Math.cos(a)*r1, tz = Math.sin(a)*r1;
        if(!okT(tx, tz)) continue;
        trial('성벽 길→성 밖', [ex, GY + 9.12, ez], [tx, ground(tx, tz) + 0.85 + rnd()*0.7, tz], [ex, GY + 8, ez]); }
      for(let g=0; g<5; g++) for(let n=0; n<100; n++){ const walk = rnd() < 0.5, P = walk ? (rnd() - 0.5)*13 : (rnd() < 0.5 ? -1 : 1)*(7.75 + rnd()*2.95), t = walk ? 50.55 + rnd()*0.9 : 49.75 + rnd()*2.5;
        const ex = W.__gX(g, t, P), ez = W.__gZ(g, t, P), outw = rnd() < 0.6, tt = outw ? 55 + rnd()*25 : 36 + rnd()*11, tp = (rnd() - 0.5)*(outw ? 24 : 12), tx = W.__gX(g, tt, tp), tz = W.__gZ(g, tt, tp);
        if(!okT(tx, tz)) continue;
        trial('성문 위→통로·밖', [ex, GY + 9.12, ez], [tx, ground(tx, tz) + 0.85 + rnd()*0.7, tz], [ex, GY + 8, ez]); }
      /* K 윗마당(14) — 아이가 성가퀴 앞에 붙어 선다(북쪽 z 60.2~60.27 · 동서 |x| 2.2~2.27): 협곡 바닥·북쪽 들판(성가퀴 틈으로 먼 곳만 보인다) · 성문 먼 망루 윗마당(모서리 망대 뒤) */
      for(let n=0; n<500; n++){ const side = n % 3, sx = rnd() < 0.5 ? -1 : 1, ex = side === 0 ? -2.2 + rnd()*4.4 : sx*(2.2 + rnd()*0.07), ez = side === 0 ? 60.2 + rnd()*0.07 : 58.3 + rnd()*1.9;
        const kind = n % 4; let tx, tz, ty;
        if(kind === 3){ const g = ex > 0 ? 2 : 3, tp = (g === 2 ? -1 : 1)*(7.75 + rnd()*2.95); tx = W.__gX(g, 49.75 + rnd()*2.5, tp); tz = W.__gZ(g, 49.75 + rnd()*2.5, tp); if(!free(tx, GY + 8, tz)) continue; ty = GY + 8.85; }
        else { if(side === 0){ tx = (rnd() - 0.5)*50; tz = 72 + rnd()*25; } else { const g = sx > 0 ? 2 : 3; tx = W.__gX(g, 56 + rnd()*30, (rnd() - 0.5)*22); tz = W.__gZ(g, 56 + rnd()*30, 0) + (rnd() - 0.5)*4; }
          if(!okT(tx, tz)) continue; ty = ground(tx, tz) + 0.85 + rnd()*0.7; }
        trial('K 윗마당→협곡·들판·성문 망루', [ex, GY + 15.12, ez], [tx, ty, tz], [ex, GY + 14, ez]); }
      out.G7 = fam; }
    /* G8 비용 */
    { const T = (e, t)=>{ const t0 = performance.now(); let k = 0; for(let n=0; n<20000; n++) k += occ(e, t) ? 1 : 0; return f3((performance.now() - t0)/20000*1000); };
      out.G8 = {inner:T([5, GY + 1.1, 3], [20, GY + 1, -20]), cross:T([20, GY + 1.1, -44], [20, GY + 1, -62]), wall:T([20, GY + 9.1, -51], [20, GY + 1, -70]), outside:T([68, GY + 1.1, 5], [70, GY + 1, 20])}; }
    return out; });
  put({id:'G1', name:'마당 → 벽 뒤(성 밖 해자·비탈) 좀비 못 맞힘 — 가슴·머리 둘 다 돌에 가림(70차: 지붕 밖이라 전부 맞았다)', pass:R.G1.n === 15 && R.G1.hit === 0, detail:R.G1});
  put({id:'G2', name:'마당 → 성문 계단 위 좀비 — 보이면(가슴·머리 중 하나) 맞고 계단 흉벽에 다 가리면 안 맞음 · 돌 조각 광선과 같음 ≥ 95% · 보이는 것 ≥ 1/3', pass:R.G2.same >= R.G2.n*0.95 && R.G2.vis >= R.G2.n/3 && R.G2.hit >= R.G2.vis*0.9, detail:R.G2});
  console.log('  G11 몸 내밀기 카메라 — ' + JSON.stringify(R.G11));
  put({id:'G11', name:'72차 몸 내밀기 카메라(보이는 것만) — 성벽 길에서 발치 좀비를 겨누면 1인칭·3인칭 모두 조준점 잠김인데 화면이 돌에 가림 ≤ 5% · 옮기는 동안 카메라 돌 속 0 · 멈춰 있으면 안 움직임', pass:['p1', 'p3'].every(k=>{ const q = R.G11[k]; return q.n >= 30 && q.lock >= q.n*0.8 && q.lockHid <= q.lock*0.05 && q.inStone === 0 && q.jit === 0; }), detail:R.G11});
  console.log('  G10 몸 내밀기 — ' + JSON.stringify(R.G10));
  put({id:'G10', name:'72차 몸 내밀어 쏘기 — 성벽 길(가장자리·가운데)·성문 위(번호판 벽 옆)·K 윗마당 → 성 밖 발치 좀비 ≥ 80% · 마당·회랑 지붕 밑·번호판 벽 앞은 안 내밈 · 내민 눈에서도 멀리 있는 돌은 막음(돌 조각 광선과 같음 ≥ 97% · 가린 선 ≥ 5)', pass:R.G10.a.pct >= 80 && R.G10.b.pct >= 80 && R.G10.c.pct >= 80 && R.G10.d.yard && R.G10.d.gallery && R.G10.d.plate && R.G10.d.walk && R.G10.e.n >= 50 && R.G10.e.same >= R.G10.e.n*0.97 && R.G10.e.hid >= 5, detail:R.G10});
  put({id:'G3', name:'트인 성벽 길 → 성 밖 — 돌 선 하나로: 크레넬(성가퀴 사이 틈)은 구멍 · 성가퀴 가운데는 막힘 · 72차 몸을 내밀면 성가퀴 뒤에서도 맞음', pass:R.G3.n >= 8 && R.G3.leanM === R.G3.n && R.G3.cren === R.G3.n && R.G3.merl === 0, detail:R.G3});
  put({id:'G4', name:'지붕 밑 쏘기 틈 그대로 — 복도 틈 가운데로 마을 쪽은 통과 · 옆 벽 쪽은 막힘(틈마다)', pass:R.G4.n >= 6 && R.G4.pass === R.G4.n && R.G4.side === R.G4.n, detail:R.G4});
  put({id:'G5', name:'머리만 보이는 좀비 — 성벽 길 안쪽 끝 너머(턱에 가슴이 가림)를 마당 멀리서: 머리로 맞음(돌 조각 광선도 가슴 가림·머리 보임)', pass:R.G5.head === R.G5.n && R.G5.rcHead >= R.G5.n - 1, detail:R.G5});
  const g6 = R.G6, g6ok = g6.slice(0, 3).every(q=> q.bullet && q.bullet.d < 6.5 && Math.abs(q.bullet.z + 49) < 0.2 && q.dust >= 3) && g6[3] && (!g6[3].bullet || g6[3].bullet.d < 0.9) && g6[3].dust >= 3;
  put({id:'G6', name:'예광탄이 돌에서 멈춤 — 마당에서 벽을 쏘면 예광탄 끝 = 벽 얼굴(z −49 ± 0.2 · 6.5 안) · 돌가루·불티 ≥ 3 · 벽에 바짝 붙어 쏘면 예광탄 없이 돌가루만(돌 너머로 안 날아감)', pass:g6ok, detail:g6});
  const G7 = R.G7, g7bad = Object.entries(G7).filter(([k, F])=> F.visBlocked > Math.max(1, F.vis*0.03) || F.hidPassed > Math.max(1, F.hid*0.03) || F.vis < 5 || F.hid < 5);
  console.log('  G7 모델 ↔ 돌 조각 광선(세 선 모두 트임 = 보임 · 모두 막힘 = 가림 · 섞임 = 모서리·틈 스침) — ' + Object.entries(G7).map(([k, F])=> `${k} ${F.n}: 보이는데 막힘 ${F.visBlocked}/${F.vis} · 가렸는데 통과 ${F.hidPassed}/${F.hid} · 스침 ${F.graze}(막음 ${F.grazeBlocked})`).join(' | '));
  put({id:'G7', name:'모델 ↔ 실제 돌 조각 광선(성곽·성문 돌 뱅크) — 장면 다섯(마당→성 밖·마당→성벽 길·성벽 길→성 밖·성문 위→통로·협곡·K 윗마당→협곡·들판·성문 망루 · 과녁은 좀비가 다니는 땅) 확실히 보이는데 막힘 ≤ max(1, 3%) · 확실히 가렸는데 통과 ≤ max(1, 3%) · 장면마다 보이는 선·가린 선 ≥ 5(모서리·틈 3cm 스침은 따로 셈)', pass:!g7bad.length, detail:g7bad.map(([k, F])=> [k, F])});
  put({id:'G8', name:'비용 — castleOccluded 한 번(µs · 소프트웨어 브라우저 · 기록): 마당 안끼리 · 벽 걸침 · 성벽 길 → 밖 · 성 밖 들판', pass:true, detail:R.G8});
  { const ta = fnSrc('towerAttack') + fnSrc('tickBuildingGuns') + fnSrc('towerFxShot'), fw = fnSrc('fireWeapon'), hit = fnSrc('castleHitT');   // 92차 — 서바이벌 사격 가지(aimPlayer) 삭제
    const ok = ta.length > 200 && !/castleHitT|castleOccluded|castleAimY/.test(ta) && !/aimPlayer|survAimPart/.test(fw) && hit.length > 500 && !/G\.host|net|send/.test(hit);
    put({id:'G9', name:'그대로인 것 — 아이들이 지은 탑 사격(towerAttack·tickBuildingGuns)은 성곽 가림을 안 부름 · 서바이벌 사격은 92차에 삭제 · castleHitT 는 호스트·통신 무관(손님 화면도 같은 칸·상자로 제 총알만)', pass:ok, detail:{ta:ta.length, hit:hit.length}}); }
  if(errors.length) put({id:'E', name:'페이지 오류 0', pass:false, detail:errors.slice(0, 5)});
}catch(e){ put({id:'X', name:'실행', pass:false, detail:String(e && e.stack || e).slice(0, 800)}); }
finally{ if(browser) await browser.close(); server.close(); }
const fail = results.filter(r=> !r.pass).length;
console.log(`${results.length - fail}/${results.length} 71차 성벽 총알 규칙 검사 통과`);
process.exitCode = fail ? 1 : 0;
