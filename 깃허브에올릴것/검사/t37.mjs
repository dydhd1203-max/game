/* 37차 검사 — 🏁 장애물 경주 · 달리기(Shift) · 양끼리 부딪힘 · OX/줄넘기 없음
   ★ 코스는 seed 로 짓는다 — 같은 seed 면 발판 표가 같은지, 발판 길이·틈이 '네 가지 뜀이 다 떨어지는 셈' 을 지키는지 본다.
   ★ 규칙(깃발·떨어짐·골인·아이템·바위·바나나·순위·상)은 실제로 굴려서 본다 — 값을 베끼지 않고 게임에 묻는다(__RACE, __MINI). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 8937);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.route(/fonts\.(googleapis|gstatic)\.com/, r=> r.abort());
await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=low', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
await pg.fill('#iName','검'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1200);
const R=[]; const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const ev = (f, a)=> pg.evaluate(f, a);

/* ═══════ ① OX 퀴즈·줄넘기가 없고 미니게임은 둘 ═══════ */
const gone = await ev(()=>{ const W=window, o={};
  o.names = W.__MINI_NAME.slice(); o.kind = W.__MINI().KIND; o.race = W.__MINI().RACE; o.days = W.__MINI().DAYS;
  o.ox = W.__oxAsk === undefined && W.__oxReveal === undefined && W.__ropePhase === undefined && W.__R_rope === undefined && W.__quizBanner === undefined;
  o.dom = !document.getElementById('quizBanner') && !document.getElementById('tQO') && !document.getElementById('tMini2') && !!document.getElementById('tMini0') && !!document.getElementById('tMini1');
  o.help = !/줄넘기 — 어떻게 뛰나/.test(document.body.innerHTML) && /장애물 경주/.test(document.body.innerHTML);
  return o; });
ok('★ 미니게임은 둘 — 장애물 경주 · 서바이벌', gone.names.length === 2 && /경주/.test(gone.names[0]) && /서바이벌/.test(gone.names[1]), gone.names.join(' · '));
ok('★ 5일차 경주 · 10일차 서바이벌 · 15일차 경주 (MINI_KIND)', JSON.stringify(gone.kind) === '[0,1,0]' && JSON.stringify(gone.days) === '[5,10,15]', JSON.stringify(gone.kind));
ok('★ 경주는 90초다', gone.race === 90, gone.race);
ok('★ OX 퀴즈·줄넘기 코드가 남아 있지 않다 (내보내기·현수막·선생님 단추·도움말)', gone.ox && gone.dom && gone.help, gone.ox+' '+gone.dom+' '+gone.help);

/* ═══════ ② 달리기(Shift) — 1.45배 · 3초면 비고 4초면 찬다 · 줄은 달릴 때만 ═══════ */
const run = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  G.paused = false; G.phase = 'day'; G.t = 100; PL.down = false;
  const go = (shift, sec)=>{ PL.x = 30; PL.z = 30; PL.yaw = 0; PL.y = W.__groundUnder(30,30,PL.R); W.__KEY.w = true; W.__KEY.shift = shift; const z0 = PL.z;
    for(let i=0;i<sec*30;i++) W.__updPlayer(1/30); W.__KEY.w = false; W.__KEY.shift = false; return Math.abs(PL.z - z0)/sec; };
  W.__setStamina(1); o.walk = +go(false, 1).toFixed(2); W.__setStamina(1); o.sprint = +go(true, 1).toFixed(2); o.st1 = +W.__stamina().toFixed(2);
  W.__setStamina(1); go(true, 3.2); o.st3 = +W.__stamina().toFixed(2);
  W.__setStamina(0); o.empty = +go(true, 1).toFixed(2);                      // 비었으면 걷는 속도
  W.__setStamina(0); for(let i=0;i<4.2*30;i++) W.__updPlayer(1/30); o.rest4 = +W.__stamina().toFixed(2);
  W.__setStamina(0.4); W.__paintHUD(); o.rowOn = getComputedStyle(document.getElementById('stRow')).display;
  W.__setStamina(1); W.__paintHUD(); o.rowOff = getComputedStyle(document.getElementById('stRow')).display;
  o.mul = W.__SPRINT.mul; o.runS = W.__SPRINT.run; o.restS = W.__SPRINT.rest;
  return o; });
ok('★ Shift 를 누르면 걷기의 1.45배로 달린다', run.sprint > run.walk*1.38 && run.sprint < run.walk*1.5, `걷기 ${run.walk} → 달리기 ${run.sprint} (×${(run.sprint/run.walk).toFixed(2)})`);
ok('★ 3초 달리면 스태미나가 비고, 비면 걷는 속도로 돌아온다', run.st1 > 0.6 && run.st1 < 0.72 && run.st3 <= 0.01 && Math.abs(run.empty - run.walk) < 0.3, `1초 뒤 ${run.st1} · 3.2초 뒤 ${run.st3} · 빈 채 ${run.empty}`);
ok('★ 4초 쉬면 다시 찬다', run.rest4 >= 0.99, run.rest4);
ok('★ 스태미나 줄은 덜 찼을 때만 보인다', run.rowOn === 'flex' && run.rowOff === 'none', run.rowOn+' / '+run.rowOff);
ok('손잡이가 표에 있다 (1.45 · 3초 · 4초)', run.mul === 1.45 && run.runS === 3 && run.restS === 4, `${run.mul} · ${run.runS} · ${run.restS}`);

/* ═══════ ③ 코스 — seed 로 짓고, 발판 길이·틈이 네 가지 뜀을 다 받는다 ═══════ */
const course = await ev(()=>{ const W=window, G=W.__G, o={};
  G.paused = false; if(W.__miniOn()) W.__miniExit();
  W.__goMini(0); o.k = G.mini.k; o.st = G.mini.st; o.seed = G.mini.seed; o.tpv = document.body.classList.contains('tpv'); o.tpvKind = W.__tpvKind();
  W.__raceBuild(11); const A = W.__RACE_P().map(p=> [p.x,p.z,p.y,p.w,p.d,p.kind].join(',')).join('|'); const vA = W.__RACE().vars.slice();
  W.__raceBuild(11); const A2 = W.__RACE_P().map(p=> [p.x,p.z,p.y,p.w,p.d,p.kind].join(',')).join('|');
  W.__raceBuild(12); const B = W.__RACE_P().map(p=> [p.x,p.z,p.y,p.w,p.d,p.kind].join(',')).join('|'); const vB = W.__RACE().vars.slice();
  o.same = A === A2; o.diff = A !== B; o.vars = [vA, vB];
  /* 여러 seed 로 변형이 다 나오나 */
  const seen = [new Set(), new Set(), new Set(), new Set(), new Set()];
  for(let sd=1; sd<=40; sd++){ W.__raceBuild(sd); W.__RACE().vars.forEach((v,i)=> seen[i].add(v)); }
  o.allVars = seen.map(s=> [...s].sort().join(''));
  W.__raceBuild(8);
  const P = W.__RACE_P(), S = W.__RACE_S;
  o.secs = S.length; o.names = S.map(s=>s.n); o.cps = P.filter(p=>p.cp).map(p=>p.cp); o.fin = P.filter(p=>p.fin).length;
  o.bridgeW = P.find(p=>p.cp===1).w;
  /* 징검다리·사라지는 발판: 길이 4.0 · 틈 1.8 → g<3.5<g+L · 5.1<g+L · 2g+L<7.8 · 11.3<2g+2L */
  const stones = P.filter(p=>p.kind==='stone').sort((a,b)=>a.z-b.z), fades = P.filter(p=>p.kind==='fade' && Math.abs(p.x - P.filter(q=>q.kind==='fade')[0].x) < 0.1).sort((a,b)=>a.z-b.z);
  const gaps = (arr)=> arr.slice(1).map((p,i)=> +(p.z - p.d/2 - (arr[i].z + arr[i].d/2)).toFixed(2));
  o.stoneL = stones.map(p=>p.d); o.stoneG = gaps(stones); o.fadeL = fades.map(p=>p.d); o.fadeG = gaps(fades);
  const rule = (L,g)=> g < 3.5 && 3.5 < g+L && 5.1 < g+L && 2*g+L < 7.8 && 7.8 < 2*g+2*L && 2*g+L < 11.3 && 11.3 < 2*g+2*L;
  o.rule = stones.slice(2).every(p=> rule(p.d, 1.8)) && fades.every(p=> rule(p.d, 1.8)) && o.stoneG.every(g=> Math.abs(g-1.8) < 0.05) && o.fadeG.every(g=> Math.abs(g-1.8) < 0.05);
  /* 높이 — 섬 바닥 · 깃발 판 · 허공 · 계단 · 골인 */
  const Y = W.__MINI().Y;
  o.top = {island:W.__raceTopAt(0,-19) - Y, bridge:W.__raceTopAt(0,35) - Y, voidZ:W.__raceTopAt(20, 60), stairTop:+(W.__raceTopAt(0, P.filter(p=>p.kind==='stair').sort((a,b)=>b.y-a.y)[0].z) - Y).toFixed(1), fin:+(W.__raceTopAt(0, W.__RACE_Z_FIN+2) - Y).toFixed(1)};
  o.ground = W.__groundUnder(20, 60, 0.35);
  o.items = W.__RACE().items.length; o.itemKinds = [...new Set(W.__RACE().items.map(i=>i.k))].sort().join(',');
  o.rocks = W.__raceRocks(20).length; o.rockAt = W.__raceRocks(20).map(r=> +r.z.toFixed(1));
  o.rockSame = JSON.stringify(W.__raceRocks(33.3)) === JSON.stringify(W.__raceRocks(33.3));
  return o; });
ok('★ 경주는 k=0 · 3인칭이다 (카메라가 뒤에서 따라간다)', course.k === 0 && course.tpv && course.tpvKind === 0, course.k+' tpv '+course.tpv);
ok('★ 같은 seed 면 같은 코스, 다른 seed 면 다른 코스 (전원이 같은 코스를 달린다 — 통신 없이)', course.same && course.diff, JSON.stringify(course.vars));
ok('★ 구간마다 변형 셋(a·b·c)이 다 뽑힌다', course.allVars.every(v=> v === '012'), course.allVars.join(' / '));
ok('★ 다섯 구간 · 깃발 다섯 · 골인 판 하나', course.secs === 5 && JSON.stringify(course.cps) === '[1,2,3,4,5]' && course.fin === 1, course.names.join(' → '));
ok('★ 첫 깃발 판은 섬 가장자리에 걸친 넓은 다리(폭 40 넘게)', course.bridgeW >= 40, course.bridgeW);
ok('★ 징검다리·사라지는 발판은 길이 4.0 · 틈 1.8 — 걷는 뜀 3.5 · 달리는 뜀 5.1 · 2단 7.8/11.3 이 전부 발판 위에 떨어진다', course.rule, '길이 '+course.stoneL.join(',')+' 틈 '+course.stoneG.join(','));
ok('★ 높이 — 섬 바닥 0 · 다리 0 · 옆 허공은 -999 · 계단 꼭대기 7.2 · 골인 8.1', course.top.island === 0 && course.top.bridge === 0 && course.top.voidZ === -999 && course.top.stairTop === 7.2 && course.top.fin === 8.1, JSON.stringify(course.top));
ok('★ groundUnder 가 경주에서 발판 높이를 땅으로 본다 (허공은 -999)', course.ground === -999, course.ground);
ok('★ 아이템 상자 열 개 · 네 종류(부스터·깃털·방패·바나나)', course.items === 10 && course.itemKinds === 'banana,boost,feather,shield', course.items+' · '+course.itemKinds);
ok('★ 바위는 시간의 식이다 — 같은 시각이면 같은 자리 (통신 없이 전원 같다)', course.rockSame && course.rocks >= 1, course.rockAt.join(' '));

/* ═══════ ④ 규칙 — 깃발 · 떨어짐 · 방패 · 골인 · 움직이는 발판 ═══════ */
const rule = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const M = W.__MINI(), RACE = W.__RACE(), MINE = W.__MINE, Y = M.Y;
  G.paused = false; if(W.__miniOn()) W.__miniExit(); W.__goMini(0); G.mini.seed = 8; W.__raceBuild(8); const P = W.__RACE_P(); W.__miniSet('run', 90); G.t = 90; W.__miniTick(1/30);
  o.started = RACE.on && MINE.fin === -1 && MINE.cp === 0;
  const put = (x,z,y)=>{ PL.x = x; PL.z = z; PL.y = Y + (y||0); PL.vy = 0; PL.ground = true; };
  const tick = (n)=>{ for(let i=0;i<n;i++){ G.t -= 1/30; W.__updPlayer(1/30); W.__miniTick(1/30); } };
  /* 깃발 — 2번 깃발 판에 서면 cp 2 */
  const cp2 = P.find(p=>p.cp===2); put(cp2.x, cp2.z, cp2.y); tick(3); o.cp = MINE.cp; o.cpAt = [RACE.cp.x, RACE.cp.z];
  /* 떨어짐 — 허공에 두면 1.5초 뒤 마지막 깃발로 */
  put(20, 60, 0); PL.ground = false; tick(60); o.fallT = +RACE.fallT.toFixed(2); o.fallY = +(PL.y - Y).toFixed(1);
  tick(30); o.backAt = [+PL.x.toFixed(1), +PL.z.toFixed(1)]; o.backCp = Math.abs(PL.z - cp2.z) < 0.6 && Math.abs(PL.x - cp2.x) < 1.2;
  /* 방패 — 있으면 바로 돌아온다 */
  RACE.shield = true; put(20, 60, 0); PL.ground = false; tick(45); o.shieldBack = Math.abs(PL.z - cp2.z) < 0.6 && !RACE.shield && RACE.fallT === 0;
  /* 움직이는 통나무 위에 서 있으면 같이 실려 간다 */
  const log = P.find(p=>p.kind==='log'); const off = t => Math.sin(t*log.mv.spd + log.mv.ph)*log.mv.amp;
  RACE.t = 10; G.t = 80; put(log.x + off(10), log.z, log.y); const x0 = PL.x; tick(30); o.carried = +(PL.x - x0).toFixed(2); o.logMoved = +(off(RACE.t) - off(10)).toFixed(2);
  /* 사라지는 발판 — 밟으면 0.5초 뒤 꺼져 2.5초 뒤 돌아온다 */
  const fd = P.find(p=>p.kind==='fade' && !p.blink || p.kind==='fade'); put(fd.x, fd.z, fd.y); tick(2); o.fadeArmed = fd.fade.t >= 0;
  tick(32); o.fadeGone = fd.fade.gone > 0 && W.__raceTopAt(fd.x, fd.z) < -900 || (fd.blink ? true : false);   // 1초 뒤 꺼진다
  tick(70); o.fadeBack = fd.fade.gone === 0 && fd.fade.t === -1;                                               // 2초 뒤 돌아온다
  /* 골인 — 골인 판에 서면 시간이 적히고 보고된다 */
  RACE.t = 40; G.t = 50; put(0, W.__RACE_Z_FIN + 2, 8.1); tick(3); o.fin = MINE.fin; o.rep = W.__miniPl.get(W.__uid) && W.__miniPl.get(W.__uid).fin;
  o.prog = MINE.prog;
  return o; });
ok('★ 출발하면 경주 상태가 켜지고 골인·깃발이 비어 있다', rule.started);
ok('★ 깃발 판에 서면 그 깃발이 마지막 깃발이 된다', rule.cp === 2 && rule.cpAt[1] > 70, rule.cp+' · '+JSON.stringify(rule.cpAt));
ok('★ 떨어지면 1.5초 동안 허공에 멈췄다가 마지막 깃발로 돌아온다', rule.fallT > 0 && rule.fallT <= 1.5 && rule.fallY < -6 && rule.backCp, `fallT ${rule.fallT} · y ${rule.fallY} · 돌아온 곳 ${JSON.stringify(rule.backAt)}`);
ok('★ 방패가 있으면 기다리지 않고 바로 돌아오고 방패는 없어진다', rule.shieldBack);
ok('★ 흔들리는 통나무 위에 서 있으면 통나무와 같이 움직인다', Math.abs(rule.carried - rule.logMoved) < 0.15 && Math.abs(rule.logMoved) > 0.05, `나 ${rule.carried} · 통나무 ${rule.logMoved}`);
ok('★ 사라지는 발판은 밟으면 1초 뒤 꺼졌다가 2초 뒤 돌아온다', rule.fadeArmed && rule.fadeGone && rule.fadeBack, `${rule.fadeArmed} ${rule.fadeGone} ${rule.fadeBack}`);
ok('★ 골인 판에 서면 시간이 적히고(40초) 통신 칸에도 실린다', Math.abs(rule.fin - 40) < 0.2 && rule.rep === rule.fin && rule.prog === 1, `fin ${rule.fin} · 보고 ${rule.rep}`);

/* ═══════ ⑤ 아이템 · 바위 · 바나나 · 부딪힘 ═══════ */
const item = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const M = W.__MINI(), RACE = W.__RACE(), MINE = W.__MINE, Y = M.Y;
  G.paused = false; if(W.__miniOn()) W.__miniExit(); W.__goMini(0); G.mini.seed = 8; W.__raceBuild(8); W.__miniSet('run', 90); G.t = 90; W.__miniTick(1/30); RACE.t = 5;
  const put = (x,z,y)=>{ PL.x = x; PL.z = z; PL.y = Y + (y||0); PL.vy = 0; PL.ground = true; };
  const tick = (n)=>{ for(let i=0;i<n;i++){ G.t -= 1/30; W.__updPlayer(1/30); W.__miniTick(1/30); } };
  const grab = (k)=>{ const it = RACE.items.find(i=> i.k === k && !i.taken); put(it.x, it.z, it.y - 1.0); PL.y = Y + it.y - 0.2; tick(2); return it.taken; };
  o.boost = grab('boost'); o.boostT = +RACE.boostT.toFixed(2); W.__setStamina(0.5);
  put(0, 0, 0); PL.yaw = Math.PI; W.__KEY.w = true; const z0 = PL.z; for(let i=0;i<30;i++){ W.__updPlayer(1/30); W.__miniTick(1/30); } W.__KEY.w = false; o.boostSpd = +(PL.z - z0).toFixed(1);
  o.stAfterBoost = +W.__stamina().toFixed(2);
  o.feather = grab('feather'); o.featherOn = RACE.feather;
  put(0, 0, 0); let air = 0; W.__wantJump(); W.__updPlayer(1/30); for(let i=0;i<8;i++) W.__updPlayer(1/30); W.__wantJump(); W.__updPlayer(1/30); for(let i=0;i<8;i++) W.__updPlayer(1/30); const vBefore = PL.vy; W.__wantJump(); W.__updPlayer(1/30); o.third = PL.vy > vBefore + 5; o.featherUsed = !RACE.feather;
  o.shield = grab('shield'); o.shieldOn = RACE.shield;
  /* 바나나 — 먹으면 뒤에 떨어지고, 남의 바나나를 밟으면 미끄러진다 */
  put(0, 10, 0); PL.yaw = Math.PI; o.banana = grab('banana'); const mine = Object.values(W.__raceBanAll()); o.dropped = mine.length === 1 && mine[0].u === W.__uid;
  const other = {u:'other', x:0, z:20, y:0, t:RACE.t}; RACE.bans['other-1'] = other;
  put(0, 20, 0); tick(2); o.slipT = +RACE.slipT.toFixed(2); const zs = PL.z; tick(15); o.slidAhead = +(PL.z - zs).toFixed(2);
  W.__KEY.w = false; tick(40); put(0, 20, 0); tick(2); o.slipOnce = RACE.slipT <= 0;   // 미끄러짐이 끝난 뒤 같은 바나나를 다시 밟아도 안 미끄러진다
  /* 바위 — 자리에 서 있으면 맞아서 튕기고 미끄러진다 */
  RACE.slipT = 0; RACE.hitCd = 0; let hit = false; for(let s=0; s<40 && !hit; s++){ RACE.t = 12 + s*0.25; const rk = W.__raceRocks(RACE.t)[0]; if(!rk) continue; put(rk.x, rk.z, 0); G.t = 90 - RACE.t; W.__miniTick(1/30); if(RACE.slipT > 0) hit = true; }
  o.rockHit = hit && RACE.hitCd > 0;
  /* 부딪힘 — 겹친 양은 벌어지고, 빨리 부딪힐수록 더 튕긴다 */
  RACE.slipT = 0; G.players.set('p1', {uid:'p1', x:0.3, y:Y, z:-10, g:1, n:'p1', ry:0, jt:0});
  put(0, -10, 0); PL.yaw = 0; W.__KEY.w = false; W.__kbReset(); W.__sheepBump(1/30, 0, 0); const dNo = Math.hypot(PL.x - 0.3, PL.z + 10);
  put(0.6, -10, 0); W.__kbReset(); W.__sheepBump(1/30, -8, 0); const kbFast = Math.hypot(W.__kb().x, W.__kb().z);
  put(0.6, -10, 0); W.__kbReset(); W.__sheepBump(1/30, -2, 0); const kbSlow = Math.hypot(W.__kb().x, W.__kb().z);
  G.players.delete('p1'); o.bump = {sep:+dNo.toFixed(2), fast:+kbFast.toFixed(2), slow:+kbSlow.toFixed(2)};
  return o; });
ok('★ 🚀 부스터 — 먹으면 2초 동안 1.6배로 달리고 스태미나를 안 쓴다', item.boost && item.boostT > 1.8 && item.boostSpd > 7.5 && item.stAfterBoost >= 0.5, `boostT ${item.boostT} · 1초 ${item.boostSpd}칸 · 스태미나 ${item.stAfterBoost}`);
ok('★ 🪶 깃털 — 공중에서 한 번 더(세 번째) 뛰고, 쓰면 없어진다', item.feather && item.featherOn && item.third && item.featherUsed);
ok('★ 🛡️ 방패 — 품는다', item.shield && item.shieldOn);
ok('★ 🍌 바나나 — 먹으면 내 뒤에 떨어지고(통신 칸), 남의 바나나를 밟으면 0.8초 미끄러진다(한 바나나에 한 번)', item.banana && item.dropped && item.slipT > 0.6 && item.slipOnce, `slipT ${item.slipT} · 밀림 ${item.slidAhead}`);
ok('★ 🪨 바위에 맞으면 튕기고 미끄러진다', item.rockHit);
ok('★ 양끼리 겹치면 벌어지고(겹친 채로는 안 둔다), 빨리 부딪힐수록 더 튕긴다', item.bump.sep >= 0.3 && item.bump.fast > item.bump.slow * 1.5 && item.bump.slow >= 0, JSON.stringify(item.bump));

/* ═══════ ⑥ 순위 · 상 ═══════ */
const rank = await ev(()=>{ const W=window, G=W.__G, o={};
  const M = W.__MINI(), MINE = W.__MINE, K = W.__KIT, WP = W.__WEAPONS, AR = W.__ARMORS;
  G.paused = false; if(W.__miniOn()) W.__miniExit(); W.__goMini(0); G.mini.seed = 8; W.__raceBuild(8); W.__miniSet('run', 90); G.t = 90; W.__miniTick(1/30);
  W.__miniPl.clear();
  const set = (u,n,g,fin,prog)=> W.__miniPl.set(u, {g, n, fin, prog, k:0, hp:100, o:0, dm:0, cp:0});
  set('a','가',0, 40, 1); set('b','나',1, 55, 1); set('c','다',2, -1, 0.7); set('d','라',3, -1, 0.9); set('e','마',4, 48, 1);
  MINE.fin = 44; MINE.prog = 1; W.__miniReport(true);
  W.__miniFinish(); const rk = G.mini.rank; o.order = rk.map(r=>r.n).join(' '); o.st = G.mini.st;
  /* 상 — 내가 1등이면 유니크, 이미 있으면 자원으로 */
  const uq = WP.map((w,i)=> w.tier==='unique' ? i : -1).filter(i=>i>=0), rr = WP.map((w,i)=> w.tier==='rare' ? i : -1).filter(i=>i>=0);
  uq.forEach(i=> K.ownW[i] = false); rr.forEach(i=> K.ownW[i] = false); K.ownA[AR.length-1] = false;
  const r1 = W.__raceGiveWeapon('unique'); o.u1 = r1.got && uq.some(i=> K.ownW[i]);
  const r2 = W.__raceGiveWeapon('unique'); o.u2 = r2.got && uq.every(i=> K.ownW[i]);
  const res0 = W.__myPC ? Object.assign({}, W.__myPC()) : null;
  const r3 = W.__raceGiveWeapon('unique'); o.u3 = !r3.got && /자원|✨|🪨|🪵/.test(r3.res || '');
  const res1 = W.__myPC ? W.__myPC() : null; o.converted = res0 && res1 && (res1.o|0) > (res0.o|0);
  const a1 = W.__raceGiveArmor(); o.a1 = a1.got && K.ownA[AR.length-1]; const a2 = W.__raceGiveArmor(); o.a2 = !a2.got;
  let rareGot = 0; for(let i=0;i<rr.length+1;i++){ const r = W.__raceGiveWeapon('rare'); if(r.got) rareGot++; } o.rare = rareGot === rr.length;
  o.RES = W.__RACE_RES.length; o.FIN = W.__RACE_FIN;
  uq.forEach(i=> K.ownW[i] = false); rr.forEach(i=> K.ownW[i] = false); K.ownA[AR.length-1] = false;
  return o; });
ok('★ 순위 — 골인한 사람은 시간 순, 못 들어온 사람은 진행도 순 (가 40 · 나… 내 44 · 마 48 · 나 55 · 라 90% · 다 70%)', rank.order === '가 검 마 나 라 다' && rank.st === 'done', rank.order);
ok('★ 1등 유니크 총 — 번개/불꽃 중 없는 것, 둘 다 있으면 자원으로', rank.u1 && rank.u2 && rank.u3 && rank.converted, `${rank.u1} ${rank.u2} ${rank.u3} 자원 ${rank.converted}`);
ok('★ 4~5등 제일 좋은 방어구 — 이미 있으면 자원으로', rank.a1 && rank.a2);
ok('★ 2~3등 레어 총 — 없는 것 중 하나씩', rank.rare);
ok('6~10등 자원 표 다섯 줄 · 골인 상', rank.RES === 5 && rank.FIN.w > 0 && rank.FIN.g > 0, rank.RES+' · '+JSON.stringify(rank.FIN));

await ev(()=>{ const W=window; if(W.__miniOn()) W.__miniExit(); });
/* ═══════ 결과 ═══════ */
console.log('');
let fail=0; for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); if(!c) fail++; }
console.log(errs.length ? '(페이지 오류 '+errs.length+') '+errs.slice(0,3).join(' | ') : '(오류 없음)');
console.log(fail ? `${fail}개 실패 / ${R.length}항목` : `${R.length}항목 전부 통과`);
await b.close(); srv.close(); process.exit(fail || errs.length ? 1 : 0);
