/* 69차 — 강화 룬 빛 동적 검사(명세 enh69.md §10.1 의 동적 항목). 한 브라우저.
   node t69-enh.mjs [game.html] [port] [--shake-only]
   ⑭ 1인칭 떨림(총구 화면 폭 · 한 프레임 이동 · 빠르기)  ⑮ 쏘는 중 떨림 0  ⑯ 흐름 시계는 걸음과 무관
   ⑩ 비용(드로우콜·삼각형 — 프레임 단위)  ⑪ 유령 빛(층 1 메시는 held 안에만)  ⑬·㉗ 셰이더(룬·깊이 누르기)
   ⑱ 3인칭 공 빛 없음  ㉒ UI 테·◆  ㉓ 강화 순간(흔들림 0 · 배너 · 소리)  ㉖ 깨어남 0.7초 한 번
   --shake-only 는 옛 판(69차 전)에도 돈다 — 떨림 전후 숫자를 같은 자로 잰다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const args = process.argv.slice(2), file = args.find(a=>!a.startsWith('--') && !/^\d+$/.test(a)) || GAME, PORT = +(args.find(a=>/^\d+$/.test(a)) || 20447);
const SHAKE_ONLY = args.includes('--shake-only');
const srv = serve(PORT, file);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1366, height:768}});
const errs = []; pg.on('pageerror', e=>errs.push(e.message)); pg.on('console', m=>{ if(m.type()==='error' || /rune inject fail/.test(m.text())) errs.push(m.text()); });
let pass = 0, fail = 0;
const ok = (n, c, info)=>{ if(c) pass++; else fail++; console.log((c ? '✓ ' : '✗ ') + n + (info !== undefined ? '  — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); };
await pg.goto(`http://127.0.0.1:${PORT}/?gfx=mid`, {waitUntil:'load', timeout:180000});
await pg.waitForFunction('window.__READY===true', null, {timeout:240000});
await pg.evaluate(()=>{ document.getElementById('iName').value = '검사'; document.getElementById('bSolo').click(); });
await pg.waitForFunction(()=>window.__G && window.__G.started, null, {timeout:180000});
await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ const W = window; document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  W.__introDone && W.__introDone(); W.__G.paused = true; W.__KIT.ownW = W.__WEAPONS.map(()=>true); W.__DBG().noRender = true; W.__camZoom && W.__camZoom(0); });

/* ⑭ 떨림 — 총구를 화면(CSS px, 1366×768)에 투영해 4초(240프레임) 모은다. 같은 걸음 흔들 위상(1885프레임마다 bobT 가 2π×8 에 0.001rad 차)에서
   +0 줄과 +N 줄을 재서 빼면 강화 떨림만 남는다(옛 판에도 그대로 돈다 — bobT 는 멈춰 서 있으면 1.6/초) */
const shake = await pg.evaluate(()=>{
  const W = window, T = W.__THREE, cam = W.__cam, cv = W.__R.domElement, out = {};
  W.__setAim(true, true); W.__PL.mv = false;
  const v = new T.Vector3(), N = 240, M = 1885;
  for(const w of [1, 5, 19, 3]){
    W.__equipWeapon(w); const gm = W.__gunModels()[w];
    for(let i=0;i<120;i++) W.__updHeld(1/60, false, 0);
    const run = e=>{ W.__setEnh(w, e); const xs = [], ys = [];
      for(let i=0;i<M;i++){ W.__updHeld(1/60, false, 0); if(i >= M - N){ cam.updateMatrixWorld(true);
        v.copy(gm.userData.muzzle); gm.localToWorld(v); v.project(cam);
        xs.push((v.x*0.5 + 0.5)*cv.clientWidth); ys.push((0.5 - v.y*0.5)*cv.clientHeight); } }
      return [xs, ys]; };
    const B = run(0);
    for(const e of [0, 3, 4, 5, 6]){
      const [xs, ys] = run(e), X = xs.map((x,i)=> x - B[0][i]), Y = ys.map((y,i)=> y - B[1][i]), p2p = a=> Math.max(...a) - Math.min(...a);
      let step = 0; for(let i=1;i<X.length;i++) step = Math.max(step, Math.hypot(X[i]-X[i-1], Y[i]-Y[i-1]));
      const mx = X.reduce((a,b)=>a+b, 0)/X.length; let zc = 0; for(let i=1;i<X.length;i++) if((X[i-1] < mx) !== (X[i] < mx)) zc++;
      out[w + '/' + e] = {x:+p2p(X).toFixed(2), y:+p2p(Y).toFixed(2), step:+step.toFixed(2), hz:p2p(X) > 0.05 ? +(zc/2/(X.length/60)).toFixed(2) : 0};
    }
    W.__setEnh(w, 0);
  }
  return out;
});
console.log('떨림(총구 화면 폭 px · 한 프레임 최대 px · 빠르기 Hz) — 무기/단계');
for(const k in shake) console.log('  ' + k.padEnd(5) + ' 폭 ' + shake[k].x + '×' + shake[k].y + ' · 한 프레임 ' + shake[k].step + ' · ' + shake[k].hz + 'Hz');
if(SHAKE_ONLY){ await b.close(); srv.close(); process.exit(0); }
const LIM = {4:[1.8, 2.2], 5:[2.6, 3.2], 6:[3.6, 4.4]};
for(const w of [1, 5, 19, 3]){
  ok(`⑭ 무기 ${w} — +3 은 떨림 0(+0 과 같은 자리)`, shake[w + '/3'].x < 0.2 && shake[w + '/3'].y < 0.2 && shake[w + '/0'].x < 0.2, [shake[w + '/0'], shake[w + '/3']]);
  for(const e of [4, 5, 6]){ const s = shake[w + '/' + e];
    ok(`⑭ 무기 ${w} +${e} — 총구 폭 ≤ ${LIM[e][0]}×${LIM[e][1]}px · 한 프레임 ≤ 0.8px · ≤ 3Hz`, s.x <= LIM[e][0] && s.y <= LIM[e][1] && s.step <= 0.8 && s.hz <= 3.0, s); }
}
/* ⑮ 쏘는 중엔 강화 떨림 0 · ⑯ 흐름 시계는 걸음과 무관 */
const env = await pg.evaluate(()=>{ const W = window, o = {};
  W.__equipWeapon(5); W.__setEnh(5, 6);
  for(let i=0;i<30;i++){ W.__enhShotNow(); W.__updHeld(1/60, false, 0); }
  o.firing = W.__enhShake().shEnv;
  for(let i=0;i<120;i++) W.__updHeld(1/60, false, 0);
  o.after = W.__enhShake().shEnv;
  const U = W.__RUNE_U; W.__PL.mv = true; let t0 = U.uGlowT.value; for(let i=0;i<60;i++) W.__updHeld(1/60, false, 0); o.walk = U.uGlowT.value - t0;
  W.__PL.mv = false; t0 = U.uGlowT.value; for(let i=0;i<60;i++) W.__updHeld(1/60, false, 0); o.stand = U.uGlowT.value - t0;
  return o; });
ok('⑮ 쏘는 중(30프레임) 강화 떨림 envelope < 0.02 · 멈추면 돌아온다', env.firing < 0.02 && env.after > 0.9, env);
ok('⑯ 흐름 시계는 걸음과 무관(차 ≤ 5%)', Math.abs(env.walk - env.stand) <= 0.05*env.stand, env);
/* ⑩ 비용 · ⑬ 셰이더 · ㉗ 깊이 누르기 · ⑪ 유령 빛 */
const cost = await pg.evaluate(()=>{ const W = window, R = W.__R, o = {};
  const frame = ()=>{ R.info.autoReset = false; R.info.reset(); W.__drawFrame(); const i = R.info.render; const r = {calls:i.calls, tris:i.triangles}; R.info.autoReset = true; return r; };
  W.__equipWeapon(5);
  for(const e of [0, 1, 3, 6]){ W.__setEnh(5, e); W.__updHeld(1/60, false, 0); frame(); o['e' + e] = frame(); }
  /* 컴파일된 프로그램에서 룬·깊이 누르기 찾기 */
  const gl = R.getContext(); let rune = 0, runeVM = 0, gear = 0;
  for(const p of R.info.programs){ const sh = gl.getAttachedShaders(p.program) || []; let vs = '', fs = '';
    for(const s of sh){ const t = gl.getShaderParameter(s, gl.SHADER_TYPE), src = gl.getShaderSource(s) || ''; if(t === gl.VERTEX_SHADER) vs = src; else fs = src; }
    if(/uRLv > 0\.5/.test(fs)){ rune++; if(/mix\(-gl_Position\.w/.test(vs)) runeVM++; }
    if(/aEnhSv\.z/.test(fs)) gear++; }
  o.rune = rune; o.runeVM = runeVM;
  let fails = 0; for(const g of W.__gunGlow()) if(g) for(const m of g.mats) if(m.userData.runeFail) fails++; o.fails = fails;
  /* 층 1 메시는 held 안에만 */
  const held = W.__held; let out1 = 0;
  W.__scene.traverse(c=>{ if(!c.isMesh || !c.layers.isEnabled(1)) return; let p = c; while(p && p !== held) p = p.parent; if(!p) out1++; });
  o.layer1Out = out1;
  let dispRune = 0; W.__scene.traverse(c=>{ if(!c.isMesh) return; let p = c; while(p && p !== held) p = p.parent; if(!p && c.material && c.material.userData && c.material.userData.runeU) dispRune++; });
  o.dispRune = dispRune;
  /* 70차 — 손도 번짐 원천(층 1)에서 검은 가림막으로 한 번 더 그린다(장갑에 룬 번짐이 새지 않게) — 손 메시 수만큼 기준을 옮긴다 */
  let hand = 0; W.__gunModels()[5].traverse(c=>{ if(c.isMesh && (c.userData.arm || c.material === W.__HELD_ARM) && c.layers.isEnabled(1)) hand++; }); o.hand = hand;
  /* 70차(총 다루기) — 움직이는 부품(mv 꼬리표 — 탄창·노리쇠…)은 몸과 따로 구워 층 1 에서도 따로 그린다 — 그 메시 수만큼 기준을 옮긴다 */
  let mvL1 = 0; W.__gunModels()[5].traverse(c=>{ if(!c.isMesh || !c.layers.isEnabled(1) || c.userData.arm) return; let p = c.parent; while(p && !p.userData.mvTag) p = p.parent; if(p) mvL1++; }); o.mvL1 = mvL1;
  W.__setEnh(5, 0);
  return o; });
ok('⑬ 룬 셰이더가 컴파일됐고(runeFail 0) 모두 깊이 누르기를 가진다(㉗)', cost.rune > 0 && cost.runeVM === cost.rune && cost.fails === 0, {rune:cost.rune, vm:cost.runeVM, fails:cost.fails});
ok('⑪ 층 1(번짐 원천) 메시는 든 총 안에만 · 진열에 빛 재질 0', cost.layer1Out === 0 && cost.dispRune === 0, {out:cost.layer1Out, disp:cost.dispRune});
ok('⑩ 1인칭 +6 드로우콜 증가 ≤ 재질 수 + 6 (+ 번짐 가림막 손 메시 수·움직이는 부품 메시 수 — 70차) · 삼각형 증가 ≤ 든 총 삼각형 + 100', cost.e6.calls - cost.e0.calls <= 6 + 6 + cost.hand + cost.mvL1 && cost.hand <= 7 && cost.mvL1 <= 6 && cost.e6.tris - cost.e0.tris <= 14100,
   {e0:cost.e0, e1:cost.e1, e3:cost.e3, e6:cost.e6, hand:cost.hand, mvL1:cost.mvL1});   // 70차 — 손 2 → 7(C 손 둘·검지·팔뚝 둘·소매 둘 — 재장전 모션에서 따로 움직인다) · 부품 꼬리표 메시(≤ 6) 만큼만 옮김
/* ⑱ 3인칭 — 21명 +6 에 강화 공 빛 0 */
const tp = await pg.evaluate(()=>{ const W = window, [PG, PF] = W.__gunMeshes(), o = {};
  const A = i=>({x:i*1.5, y:W.__GY, z:0, ry:0, g:i%5, ph:i, mv:false, down:false, wp:3, we:6, hat:0, gls:0, clo:0, jb:-1, jt:0, air:false});
  W.__drawSheep(Array.from({length:21}, (_,i)=>A(i)), 10, 40, s=>W.__GHEX[s.g|0], W.__avatarRender().scale);
  o.glow = PF.count; o.cap = PF.count_max; o.shadow = PF.castShadow;
  const S = PG.geometry.attributes.aEnhS.array; let n6 = 0; for(let i=0;i<PG.count;i++) if(S[i*4+2] === 6) n6++; o.rune6 = n6;
  /* 70차 — 같은 21명이 총 → 도구(곡괭이·망치)로 바꾼 다음 프레임: 도구 칸에 앞 프레임 룬 단계가 남으면 안 된다 */
  W.__drawSheep(Array.from({length:21}, (_,i)=>({...A(i), wp:0, tool:i % 2 ? 'mine' : 'work'})), 10.1, 40, s=>W.__GHEX[s.g|0], W.__avatarRender().scale);
  const E = PG.geometry.attributes.aEnh.array; let left = 0; for(let i=0;i<PG.count;i++) if(S[i*4+2] !== 0 || E[i*4] !== 0) left++;
  o.toolN = PG.count; o.toolLeft = left;
  return o; });
ok('⑱ 3인칭 21명 +6 — 강화 공 빛 0 · 정원 = 40 × 4 · 그림자 끔 · 쇠 조각에 룬 단계', tp.glow === 0 && tp.cap === 160 && tp.shadow === false && tp.rune6 > 21, tp);
ok('⑱ 70차 — 총 → 도구로 바꾼 다음 프레임에 룬 값(aEnhS.z·aEnh)이 남은 도구 칸 0', tp.toolN >= 21 && tp.toolLeft === 0, {toolN:tp.toolN, left:tp.toolLeft});
/* ㉒ UI 테·◆ */
const ui = await pg.evaluate(()=>{ const W = window, o = {};
  [1,2,3,4,5,6].forEach((e,k)=> W.__setEnh([1,3,5,6,8,19][k], e));
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')); W.__openKit();
  const want = {}; for(let e=1;e<=6;e++) want[e] = getComputedStyle(document.documentElement).getPropertyValue('--e' + e).trim();
  o.cells = [...document.querySelectorAll('#kitGrid .kCell')].filter(c=> /\be[1-6]\b/.test(c.className)).map(c=>{ const e = +c.className.match(/\be([1-6])\b/)[1];
    const cs = getComputedStyle(c); return {e, col:cs.borderTopColor, want:c.classList.contains('on') ? '#72af8d' : want[e], dots:c.querySelectorAll('.enhD i.on').length, sh:cs.boxShadow !== 'none', on:c.classList.contains('on')}; });
  const hex = s=>{ const m = s.match(/\d+/g); return m ? '#' + m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('') : s; };
  o.bad = o.cells.filter(c=> hex(c.col) !== c.want.toLowerCase() || c.dots !== c.e || (c.e === 6 && !c.sh));
  o.hint = (document.querySelector('#popKit .shopHint')||{}).textContent || '';
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  o.toastZ = getComputedStyle(document.getElementById('toast')).zIndex;
  return o; });
ok('㉒ 가방 테 = --e1~--e6(사용 중 칸은 초록 #72af8d) · ◆ 채운 수 = 단계 · +6 빛', ui.cells.length >= 6 && ui.bad.length === 0, ui.bad.length ? ui.bad : ui.cells.length + '칸');
ok('㉒ 70차 — 강화된 무기를 든 칸(사용 중)도 초록 테 · 안내문은 ✓ 딱지(초록 테 = 사용 중 문구 없음)', ui.cells.some(c=> c.on) && ui.hint.includes('✓') && !ui.hint.includes('초록 테는'), {on:ui.cells.filter(c=>c.on), hint:ui.hint});
ok('㉓ 토스트 z-index 44', ui.toastZ === '44', ui.toastZ);
/* ㉓ 강화 순간 · ㉖ 깨어남 */
const mo = await pg.evaluate(()=>{ const W = window, G = W.__G, o = {};
  const snd = []; const s0 = W.__sfx; W.__sfx = (k, ...a)=>{ snd.push(k); return s0 && s0(k, ...a); };
  const shk = []; const h0 = W.__shake; W.__shake = (a, t)=>{ shk.push(a); };
  const run = (i, from, seq)=>{ W.__setEnh(i, from); G.res[G.me.g] = {w:1e6, s:1e6, g:1e6, eg:1e6, mk:1e6, pk:1e6};
    const R0 = Math.random; let n = 0; Math.random = ()=> n < seq.length ? seq[n++] : R0();
    snd.length = 0; shk.length = 0; const c0 = W.__fx2.FX2.q.length + (W.__fx2.FX2.cur ? 1 : 0);
    W.__doEnhance(i, true); Math.random = R0;
    const q = W.__fx2.FX2.q, cur = W.__fx2.FX2.cur, last = q.length ? q[q.length-1] : cur;
    return {e:W.__enhOf(i), snd:[...snd], shake:shk.length, k:last && last.k, big:!!(last && last.big)}; };
  o.ok23 = run(3, 2, [0]); o.ok56 = run(19, 5, [0]); o.keep = run(3, 1, [0.9999]); o.drop = run(5, 4, [0.9999, 0]);
  W.__sfx = s0; W.__shake = h0;
  /* 깨어남 — 성공한 총(19)을 처음 들 때 0.7초 한 번, 두 번째엔 없음 */
  W.__equipWeapon(3); W.__updHeld(1/60, false, 0); W.__equipWeapon(19); W.__updHeld(1/60, false, 0); o.wake1 = W.__enhShake().boost;
  for(let i=0;i<60;i++) W.__updHeld(1/60, false, 0);
  W.__equipWeapon(3); W.__updHeld(1/60, false, 0); W.__equipWeapon(19); W.__updHeld(1/60, false, 0); o.wake2 = W.__enhShake().boost;
  return o; });
ok('㉓ +2→+3 성공 — 배너 enh(calm) · 소리 enhOk · 흔들림 0', mo.ok23.e === 3 && mo.ok23.k === 'enh' && mo.ok23.snd.includes('enhOk') && mo.ok23.shake === 0, mo.ok23);
ok('㉓ +5→+6 성공 — 큰 배너 enh6 · 소리 enhMax', mo.ok56.e === 6 && mo.ok56.k === 'enh6' && mo.ok56.big && mo.ok56.snd.includes('enhMax'), mo.ok56);
ok('㉓ 실패(유지·내려감) — 소리 enhFail · 화면 흔들림 0', mo.keep.e === 1 && mo.drop.e === 3 && mo.keep.snd.includes('enhFail') && mo.keep.shake === 0 && mo.drop.shake === 0, [mo.keep, mo.drop]);
ok('㉖ 깨어남 — 성공한 총을 처음 들 때 0.7초 한 번, 두 번째엔 없음', mo.wake1 > 0.6 && mo.wake2 === 0, [mo.wake1, mo.wake2]);
ok('오류 없음', errs.length === 0, errs.slice(0, 4));
console.log(fail ? `${fail} failed, ${pass} passed` : `t69-enh: ${pass} passed`);
await b.close(); srv.close(); process.exitCode = fail ? 1 : 0;
