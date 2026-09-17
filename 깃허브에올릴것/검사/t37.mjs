/* 37차 검사 — 🏁 장애물 경주 · 달리기(Shift) · 양끼리 부딪힘 · OX/줄넘기 없음
   ★ 코스는 seed 로 짓는다 — 같은 seed 면 발판 표가 같은지, 발판 길이·틈이 '네 가지 뜀이 다 떨어지는 셈' 을 지키는지 본다.
   ★ 규칙(깃발·떨어짐·골인·바위·공·진자·막대·순위·상)은 실제로 굴려서 본다 (39차: 아이템은 기능과 함께 뺐다) — 값을 베끼지 않고 게임에 묻는다(__RACE, __MINI). */
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
ok('★ 스태미나 줄은 덜 찼을 때만 보인다 (42차에 잠깐 뺐다가 되살렸다 — "그거 보이는 거 좋았는데")', run.rowOn === 'flex' && run.rowOff === 'none', run.rowOn+' / '+run.rowOff);
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
  /* 징검다리·사라지는 발판(42차, 경주 속도 1.8배): 길이 7.2 · 틈 3.0 → g<6.3<g+L · 9.1<g+L · 2g+L<14.0 · 20.3<2g+2L */
  const stones = P.filter(p=>p.kind==='stone').sort((a,b)=>a.z-b.z), fades = P.filter(p=>p.kind==='fade' && Math.abs(p.x - P.filter(q=>q.kind==='fade')[0].x) < 0.1).sort((a,b)=>a.z-b.z);
  const gaps = (arr)=> arr.slice(1).map((p,i)=> +(p.z - p.d/2 - (arr[i].z + arr[i].d/2)).toFixed(2));
  o.stoneL = stones.map(p=>p.d); o.stoneG = gaps(stones); o.fadeL = fades.map(p=>p.d); o.fadeG = gaps(fades);
  const rule = (L,g)=> g < 6.3 && 6.3 < g+L && 9.1 < g+L && 2*g+L < 14.0 && 14.0 < 2*g+2*L && 2*g+L < 20.3 && 20.3 < 2*g+2*L;
  o.rule = stones.slice(2).every(p=> rule(p.d, 3.0)) && fades.every(p=> rule(p.d, 3.0)) && o.stoneG.every(g=> Math.abs(g-3.0) < 0.05) && o.fadeG.every(g=> Math.abs(g-3.0) < 0.05);
  /* 높이 — 섬 바닥 · 깃발 판 · 허공 · 계단 · 골인 */
  const Y = W.__MINI().Y;
  o.top = {island:W.__raceTopAt(0,-19) - Y, bridge:W.__raceTopAt(0,35) - Y, voidZ:W.__raceTopAt(20, 60), stairTop:+(W.__raceTopAt(0, P.filter(p=>p.kind==='stair').sort((a,b)=>b.y-a.y)[0].z) - Y).toFixed(1), fin:+(W.__raceTopAt(0, W.__RACE_Z_FIN+2) - Y).toFixed(1)};
  o.ground = W.__groundUnder(20, 60, 0.35);
  /* 39차 — 장애물: 공(계단)·진자(외다리)·막대(3·5번 깃발 판)도 바위처럼 시간의 식이다 */
  o.hz20 = W.__raceHazards(20).map(h=>h.k).sort().join(','); o.hz5 = W.__raceHazards(5).map(h=>h.k).sort().join(',');
  o.hzSame = JSON.stringify(W.__raceHazards(21.7)) === JSON.stringify(W.__raceHazards(21.7));
  const bz = [6,7,8].map(tt=> W.__raceHazards(tt).find(h=>h.k==='ball')).map(b=> b ? +b.z.toFixed(1) : null); o.ballZ = bz;
  const px = []; for(let tt=0; tt<=2.4; tt+=0.2) px.push(+W.__raceHazards(tt).find(h=>h.k==='pend').x.toFixed(2)); o.pendX = [Math.max(...px), Math.min(...px)];
  o.pendR = W.__raceHazards(1).find(h=>h.k==='pend').r; o.pendPer = W.__HAZ.pend.per;
  o.barTurn = W.__raceHazards(1).find(h=>h.k==='bar').ang !== W.__raceHazards(0).find(h=>h.k==='bar').ang;
  o.rocks = W.__raceRocks(20).length; o.rockAt = W.__raceRocks(20).map(r=> +r.z.toFixed(1));
  o.rockSame = JSON.stringify(W.__raceRocks(33.3)) === JSON.stringify(W.__raceRocks(33.3));
  return o; });
ok('★ 경주는 k=0 · 3인칭이다 (카메라가 뒤에서 따라간다)', course.k === 0 && course.tpv && course.tpvKind === 0, course.k+' tpv '+course.tpv);
ok('★ 같은 seed 면 같은 코스, 다른 seed 면 다른 코스 (전원이 같은 코스를 달린다 — 통신 없이)', course.same && course.diff, JSON.stringify(course.vars));
ok('★ 구간마다 변형 셋(a·b·c)이 다 뽑힌다', course.allVars.every(v=> v === '012'), course.allVars.join(' / '));
ok('★ 다섯 구간 · 깃발 다섯 · 골인 판 하나', course.secs === 5 && JSON.stringify(course.cps) === '[1,2,3,4,5]' && course.fin === 1, course.names.join(' → '));
ok('★ 첫 깃발 판은 섬 가장자리에 걸친 넓은 다리(폭 40 넘게)', course.bridgeW >= 40, course.bridgeW);
ok('★ 징검다리·사라지는 발판은 길이 7.2 · 틈 3.0 — 경주 1.8배 속도의 걷는 뜀 6.3 · 달리는 뜀 9.1 · 2단 14.0/20.3 이 전부 발판 위에 떨어진다 (42차)', course.rule, '길이 '+course.stoneL.join(',')+' 틈 '+course.stoneG.join(','));
ok('★ 높이 — 섬 바닥 0 · 다리 0 · 옆 허공은 -999 · 계단 꼭대기 7.2 · 골인 8.1', course.top.island === 0 && course.top.bridge === 0 && course.top.voidZ === -999 && course.top.stairTop === 7.2 && course.top.fin === 8.1, JSON.stringify(course.top));
ok('★ groundUnder 가 경주에서 발판 높이를 땅으로 본다 (허공은 -999)', course.ground === -999, course.ground);
ok('★ 장애물 — 진자 둘·막대 둘은 늘 있고, 계단 공은 3초 뒤부터 나와 계단을 따라 내려온다(시간의 식 — 전원 같다)', course.hz5 === 'bar,bar,pend,pend' && course.hz20 === 'ball,bar,bar,pend,pend' && course.hzSame && course.ballZ.every(z=>z !== null) && course.ballZ[0] > course.ballZ[1] && course.ballZ[1] > course.ballZ[2], course.hz20+' · 공 z '+course.ballZ.join('→'));
ok('★ 진자는 좌우로 흔들리고(한 주기 안에 ±2 를 넘는다) 막대는 돈다', course.pendX[0] > 2 && course.pendX[1] < -2 && course.barTurn, '진자 x 최대 '+course.pendX[0]+' 최소 '+course.pendX[1]);
ok('★ 45차 — 진자 쇠공이 20% 크고(r 1.0 → 1.2) 10% 빠르다(주기 2.0 → 1.82)',
   Math.abs(course.pendR - 1.2) < 1e-6 && Math.abs(course.pendPer - 1.82) < 1e-6, `r ${course.pendR} · 주기 ${course.pendPer}`);
ok('★ 바위는 시간의 식이다 — 같은 시각이면 같은 자리 (통신 없이 전원 같다)', course.rockSame && course.rocks >= 1, course.rockAt.join(' '));

/* ═══════ ④ 규칙 — 깃발 · 떨어짐 · 카메라 · 골인 · 움직이는 발판 ═══════ */
const rule = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const M = W.__MINI(), RACE = W.__RACE(), MINE = W.__MINE, Y = M.Y;
  G.paused = false; if(W.__miniOn()) W.__miniExit(); W.__goMini(0); G.mini.seed = 8; W.__raceBuild(8); const P = W.__RACE_P(); W.__miniSet('run', 90); G.t = 90; W.__miniTick(1/30);
  o.started = RACE.on && MINE.fin === -1 && MINE.cp === 0;
  const put = (x,z,y)=>{ RACE.fallT = 0; PL.x = x; PL.z = z; PL.y = Y + (y||0); PL.vy = 0; PL.ground = true; };
  const tick = (n)=>{ for(let i=0;i<n;i++){ G.t -= 1/30; W.__updPlayer(1/30); W.__miniTick(1/30); } };
  /* 깃발 — 2번 깃발 판에 서면 cp 2 */
  const cp2 = P.find(p=>p.cp===2); put(cp2.x, cp2.z, cp2.y); tick(3); o.cp = MINE.cp; o.cpAt = [RACE.cp.x, RACE.cp.z];
  /* 떨어짐 — 허공에 두면 1.5초 뒤 마지막 깃발로 */
  put(20, 60, 0); PL.ground = false; tick(60); o.fallT = +RACE.fallT.toFixed(2); o.fallY = +(PL.y - Y).toFixed(1);
  tick(30); o.backAt = [+PL.x.toFixed(1), +PL.z.toFixed(1)]; o.backCp = Math.abs(PL.z - cp2.z) < 0.6 && Math.abs(PL.x - cp2.x) < 1.2;
  /* 39차 — 허공 위에서도 3인칭 카메라가 땅 밑으로 안 꺼진다(점프할 때마다 화면이 하늘색이 됐다) */
  RACE.fallT = 0; put(20, 60, 1.5); PL.ground = false; PL.pitch = -0.3; W.__updPlayer(1/30); o.camY = +(W.__cam.position.y - Y).toFixed(2);
  /* 움직이는 통나무 위에 서 있으면 같이 실려 간다 (39차: 바위가 6.5초마다 지나가므로 이 항목 동안은 맞지 않게 한다 — 재는 것은 실림이다) */
  const log = P.find(p=>p.kind==='log'); const off = t => Math.sin(t*log.mv.spd + log.mv.ph)*log.mv.amp;
  RACE.t = 10; G.t = 80; RACE.hitCd = 99; put(log.x + off(10), log.z, log.y); const x0 = PL.x; tick(30); o.carried = +(PL.x - x0).toFixed(2); o.logMoved = +(off(RACE.t) - off(10)).toFixed(2); RACE.hitCd = 0;
  /* 사라지는 발판 — 밟으면 0.5초 뒤 꺼져 2.5초 뒤 돌아온다 */
  const fd = P.find(p=>p.kind==='fade' && !p.blink || p.kind==='fade'); put(fd.x, fd.z, fd.y); tick(2); o.fadeArmed = fd.fade.t >= 0;
  tick(56); o.fadeGone = fd.fade.gone > 0 && W.__raceTopAt(fd.x, fd.z) < -900 || (fd.blink ? true : false);   // 1.8초 뒤 꺼진다(42차 — 1초는 "너무 빨리 검은색으로 변해서")
  tick(52); o.fadeBack = fd.fade.gone === 0 && fd.fade.t === -1;                                               // 1.6초 뒤 돌아온다
  /* 골인 — 골인 판에 서면 시간이 적히고 보고된다 */
  RACE.t = 40; G.t = 50; put(0, W.__RACE_Z_FIN + 2, 8.1); tick(3); o.fin = MINE.fin; o.rep = W.__miniPl.get(W.__uid) && W.__miniPl.get(W.__uid).fin;
  o.prog = MINE.prog;
  return o; });
ok('★ 출발하면 경주 상태가 켜지고 골인·깃발이 비어 있다', rule.started);
ok('★ 깃발 판에 서면 그 깃발이 마지막 깃발이 된다', rule.cp === 2 && rule.cpAt[1] > 70, rule.cp+' · '+JSON.stringify(rule.cpAt));
ok('★ 떨어지면 1.5초 동안 허공에 멈췄다가 마지막 깃발로 돌아온다', rule.fallT > 0 && rule.fallT <= 1.5 && rule.fallY < -6 && rule.backCp, `fallT ${rule.fallT} · y ${rule.fallY} · 돌아온 곳 ${JSON.stringify(rule.backAt)}`);
ok('★ 발판 사이 허공 위에서도 3인칭 카메라가 땅 밑으로 안 꺼진다 (39차 — 뛸 때마다 화면이 하늘색이 됐다)', rule.camY > 0 && rule.camY < 8, 'cam y '+rule.camY);
ok('★ 흔들리는 통나무 위에 서 있으면 통나무와 같이 움직인다', Math.abs(rule.carried - rule.logMoved) < 0.15 && Math.abs(rule.logMoved) > 0.05, `나 ${rule.carried} · 통나무 ${rule.logMoved}`);
ok('★ 사라지는 발판은 밟으면 1.8초 뒤 꺼졌다가 1.6초 뒤 돌아온다 (42차 — 천천히)', rule.fadeArmed && rule.fadeGone && rule.fadeBack, `${rule.fadeArmed} ${rule.fadeGone} ${rule.fadeBack}`);
ok('★ 골인 판에 서면 시간이 적히고(40초) 통신 칸에도 실린다', Math.abs(rule.fin - 40) < 0.2 && rule.rep === rule.fin && rule.prog === 1, `fin ${rule.fin} · 보고 ${rule.rep}`);

/* ═══════ ⑤ 장애물 — 바위 · 공 · 진자 · 막대 · 우르릉 · 부딪힘 (39차: 아이템 절은 기능과 함께 뺐다) ═══════ */
const item = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const M = W.__MINI(), RACE = W.__RACE(), MINE = W.__MINE, Y = M.Y;
  G.paused = false; if(W.__miniOn()) W.__miniExit(); W.__goMini(0); G.mini.seed = 8; W.__raceBuild(8); W.__miniSet('run', 90); G.t = 90; W.__miniTick(1/30); RACE.t = 5;
  const put = (x,z,y)=>{ RACE.fallT = 0; PL.x = x; PL.z = z; PL.y = Y + (y||0); PL.vy = 0; PL.ground = true; };
  const at = (tt)=>{ RACE.t = tt; G.t = 90 - tt; RACE.slipT = 0; RACE.hitCd = 0; };
  /* 바위 — 자리에 서 있으면 맞아서 튕기고 미끄러진다 */
  let hit = false; for(let s=0; s<40 && !hit; s++){ at(12 + s*0.25); const rk = W.__raceRocks(RACE.t)[0]; if(!rk) continue; put(rk.x, rk.z, 0); W.__miniTick(1/30); if(RACE.slipT > 0) hit = true; }
  o.rockHit = hit && RACE.hitCd > 0;
  /* 공 — 계단에서 공 자리에 서면 */
  hit = false; for(let tt=4; tt<30 && !hit; tt+=0.2){ at(tt); const bl = W.__raceHazards(tt).find(h=>h.k==='ball'); if(!bl) continue; put(bl.x, bl.z, bl.y - bl.r); W.__miniTick(1/30); if(RACE.slipT > 0) hit = true; }
  o.ballHit = hit;
  /* 막대 — 판 위 막대 선 안에 서면 · 뛰어넘으면(발이 0.8 위) 안 맞는다 */
  const P = W.__RACE_P(), cp3 = P.find(p=>p.cp===3); at(6); let bar = W.__raceHazards(6).find(h=>h.k==='bar' && h.id==='r3');
  put(cp3.x + Math.cos(bar.ang)*2.0, cp3.z - Math.sin(bar.ang)*2.0, cp3.y); W.__miniTick(1/30); o.barHit = RACE.slipT > 0;
  at(6); bar = W.__raceHazards(6).find(h=>h.k==='bar' && h.id==='r3'); put(cp3.x + Math.cos(bar.ang)*2.0, cp3.z - Math.sin(bar.ang)*2.0, cp3.y + 1.0); PL.ground = false; W.__miniTick(1/30); o.barJump = RACE.slipT <= 0;
  /* 진자 — 공 자리에 서면 뒤로 밀린다 */
  at(7); const pd = W.__raceHazards(7).find(h=>h.k==='pend'); put(pd.x, pd.z, 0); const z0 = PL.z; W.__miniTick(1/30); o.pendHit = RACE.slipT > 0; for(let i=0;i<10;i++) W.__miniTick(1/30); o.pendBack = PL.z < z0 - 0.5;
  /* 우르릉 소리가 표에 있고, 바위가 가까우면 울린다(주기 재생 타이머) */
  o.rumbleSfx = W.__SFXKEYS().includes('rumble');
  at(12); const rk2 = W.__raceRocks(12)[0]; RACE.rumbleT = 0; put(rk2.x + 4, rk2.z, 0); W.__miniTick(1/30); o.rumbled = RACE.rumbleT > 0;
  RACE.slipT = 0; RACE.hitCd = 0;
  /* 부딪힘 — 겹친 양은 벌어지고, 빨리 부딪힐수록 더 튕긴다 */
  G.players.set('p1', {uid:'p1', x:0.3, y:Y, z:-10, g:1, n:'p1', ry:0, jt:0});
  put(0, -10, 0); PL.yaw = 0; W.__KEY.w = false; W.__kbReset(); W.__sheepBump(1/30, 0, 0); const dNo = Math.hypot(PL.x - 0.3, PL.z + 10);
  put(0.6, -10, 0); W.__kbReset(); W.__sheepBump(1/30, -8, 0); const kbFast = Math.hypot(W.__kb().x, W.__kb().z);
  put(0.6, -10, 0); W.__kbReset(); W.__sheepBump(1/30, -2, 0); const kbSlow = Math.hypot(W.__kb().x, W.__kb().z);
  G.players.delete('p1'); o.bump = {sep:+dNo.toFixed(2), fast:+kbFast.toFixed(2), slow:+kbSlow.toFixed(2)};
  /* 아이템이 없다 */
  o.noItems = RACE.items === undefined && RACE.boostT === undefined && W.__raceDropBanana === undefined;
  return o; });
ok('★ 아이템(부스터·깃털·방패·바나나)이 없다 (39차 — 선생님: "아이템은 그냥 없애고")', item.noItems);
ok('★ 🪨 바위에 맞으면 튕기고 미끄러진다', item.rockHit);
ok('★ ⚫ 계단을 굴러 내려오는 공에 맞으면 튕기고 미끄러진다', item.ballHit);
ok('★ 🌀 도는 막대에 맞으면 옆으로 밀리고, 뛰어넘으면 안 맞는다', item.barHit && item.barJump, `맞음 ${item.barHit} · 뛰어넘음 ${item.barJump}`);
ok('★ 🔔 진자에 맞으면 뒤로 밀린다 (외다리에서 옆으로 밀면 무조건 떨어져 너무 가혹하다)', item.pendHit && item.pendBack);
ok('★ 바위·공이 가까우면 우르릉 소리가 울린다 (소리 표에 있고, 30칸 안에서 주기 타이머가 돈다)', item.rumbleSfx && item.rumbled);
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

/* ═══════ ⑨ 41차 — 속도감: 가속·감속 · 순간이동 · 걸음 위상(거리) · 카메라 뒤처짐 · 출발선 두 줄 · 초읽기 큰 글씨 · 안내 띠 없음 · 효과음·부표 ═══════ */
const spd = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={}; const Y=W.__MINI().Y, RACE=W.__RACE();
  if(W.__miniOn()) W.__miniExit(); G.paused = false; G.phase = 'day'; G.t = 100; PL.down = false; W.__setStamina(1);
  /* 가속 — 정지에서 앞키: 첫 틱은 걷기 속도의 30% 아래, 열두 틱 뒤엔 90% 위. 놓으면 네 틱 안에 5% 아래 (틱 = 1/30초, 값은 초당 칸) */
  PL.x = 30; PL.z = 30; PL.yaw = 0; PL.y = W.__groundUnder(30,30,PL.R); W.__updPlayer(1/30); W.__updPlayer(1/30);
  const step=()=>{ const z0=PL.z; W.__updPlayer(1/30); return Math.abs(PL.z - z0)*30; };
  W.__KEY.w = true; const s1 = step(); let sN = 0; for(let i=0;i<12;i++) sN = step(); W.__KEY.w = false; step(); step(); step(); const s4 = step();
  o.acc = {first:+s1.toFixed(2), cruise:+sN.toFixed(2), after4:+s4.toFixed(3)};
  /* 순간이동(자리를 옮겨 놓음)하면 남은 속도를 버린다 */
  W.__KEY.w = true; for(let i=0;i<20;i++) W.__updPlayer(1/30); W.__KEY.w = false; PL.x = 30; PL.z = 30; const z0 = PL.z; W.__updPlayer(1/30); o.tele = +Math.abs(PL.z - z0).toFixed(3);
  /* 걸음 위상 — 간 거리 ÷ 1.3칸 = 바퀴 수 (내 양) · 친구 양은 객체마다 따로 */
  PL.x = 30; PL.z = 30; W.__updPlayer(1/30); const g0 = W.__gaitMe(); W.__KEY.w = true; let moved = 0; for(let i=0;i<15;i++){ const a=PL.z; W.__updPlayer(1/30); moved += Math.abs(PL.z-a); } W.__KEY.w = false;
  o.gait = {turns:+((W.__gaitMe()-g0)/(Math.PI*2)).toFixed(3), expect:+(moved/W.__STRIDE.walk).toFixed(3)};
  const fs = {x:0, z:0, ph:0}; W.__sheepGait(fs, 10); fs.z = 0.3; const gs = W.__sheepGait(fs, 10.1); o.friend = +(gs.gp/(Math.PI*2)).toFixed(3); o.friendExpect = +(0.3/W.__STRIDE.walk).toFixed(3);
  /* 경주 — 카메라 뒤처짐(섬 위 → 출발 다리, 발판이 이어진 자리) · 출발선 · 초읽기 · 안내 띠 · 부표 */
  W.__goMini(0); G.mini.seed = 8; W.__raceBuild(8); W.__miniSet('run', 90); G.t = 90; W.__miniTick(1/30);
  const put=(x,z,y)=>{ RACE.fallT = 0; PL.x=x; PL.z=z; PL.y=Y+(y||0); PL.vy=0; PL.ground=true; W.__updPlayer(1/30); };
  put(0, 22, 0); PL.yaw = Math.PI; PL.pitch = -0.22; for(let i=0;i<5;i++) W.__updPlayer(1/30);
  const camD=()=> Math.hypot(W.__cam.position.x-PL.x, W.__cam.position.z-PL.z);
  const stand = camD(); W.__setStamina(1); W.__KEY.w = true; W.__KEY.shift = true; for(let i=0;i<25;i++) W.__updPlayer(1/30); const run = camD(); W.__KEY.w = false; W.__KEY.shift = false;
  o.cam = {stand:+stand.toFixed(2), run:+run.toFixed(2), z:+PL.z.toFixed(1)};
  o.slot = W.__raceSlotXZ(); o.rows = W.__RACE_ROWZ; o.slots = [9, 10, 11].map(sd=>{ G.mini.seed = sd; return W.__raceSlotXZ().join(','); }); G.mini.seed = 8;
  o.cp = [RACE.cp.x, RACE.cp.z];
  W.__cntShow(3, false); const c = document.getElementById('cnt'); o.cnt = {txt:c.textContent, pop:c.classList.contains('cntOn'), go:c.classList.contains('go'), popCls:c.classList.contains('pop')};
  o.cntBox = c.offsetWidth < innerWidth*0.5 && c.offsetHeight < innerHeight*0.7 && getComputedStyle(c).backgroundImage.indexOf('gradient') >= 0;   // 42차 — 팝업 덮개(.pop)와 이름이 겹쳐 보라 네모(폭 50%)가 떴다 — 숫자 하나는 화면 반보다 좁다(offset — 튀어나오는 변형은 안 센다) · 그라데이션 글자
  W.__cntShow('출발!! 🏁', true); o.cntGo = c.classList.contains('go') && c.textContent.startsWith('출발');
  W.__miniSet('intro', 7); W.__paintMini(); o.introQ = document.getElementById('mbQ').textContent; o.introHint = /스페이스/.test(document.getElementById('miniBar').textContent);
  o.sfx = ['step','go','wind'].every(k=> W.__SFXKEYS().includes(k));
  o.buoy = !!W.__banks.get('rcBuoy');
  { const mp = W.__miniPl.get(W.__uid); if(mp) mp.fin = -1; W.__MINE.fin = -1; }   // 앞 순위 검사가 남긴 '골인 44초' 보고 — 혼자면 전원 골인이라 호스트가 곧장 결과로 넘긴다
  W.__miniSet('run', 90); G.t = 90; G.mini.rank = null; W.__paintMini(); W.__paintMini(); o.runQ = document.getElementById('mbQ').textContent; o.runSt = G.mini.st + '/' + G.phase; o.runBar = document.getElementById('miniBar').classList.contains('on');   // rank 는 앞 순위 검사가 남긴 것 — 결과 화면이 아니라 경기 중 판을 본다
  /* ═══════ ⑩ 42차 — 점프 손맛 · 초읽기 정중앙(판 숨김·토스트 없음) · 출발 잠금 · 경주 1.5배 · 바위 쿵 · 총 반동 용수철·기울기 ═══════ */
  const put2=(x,z,y)=>{ RACE.fallT = 0; PL.x=x; PL.z=z; PL.y=Y+(y||0); PL.vy=0; PL.ground=true; PL.landT=0; W.__updPlayer(1/30); };
  put2(0, 22, 0); PL.yaw = Math.PI; W.__wantJump(); W.__updPlayer(1/30); o.take = +(PL.takeT||0).toFixed(3); o.air1 = !PL.ground; o.trail = PL.trailT !== undefined;
  for(let i=0;i<4;i++) W.__updPlayer(1/30); W.__wantJump(); W.__updPlayer(1/30); o.flip = PL.flipT; let landed = 0; for(let i=0;i<60 && !PL.ground;i++){ W.__updPlayer(1/30); landed = i; }
  o.landT = +PL.landT.toFixed(2); o.flipEnd = PL.flipT; o.sfxJump = ['jump','land','hop'].every(k=> W.__SFXKEYS().includes(k));
  o.cntTop = Math.abs(parseFloat(getComputedStyle(document.getElementById('cnt')).top) - innerHeight/2) < 2;
  W.__miniSet('intro', 7); W.__paintMini(); o.introBar = document.getElementById('miniBar').classList.contains('on'); o.hold = W.__raceHold();
  put2(0, 22, 0); const z1 = PL.z; W.__KEY.w = true; for(let i=0;i<10;i++) W.__updPlayer(1/30); W.__KEY.w = false; o.heldMove = +Math.abs(PL.z - z1).toFixed(3);
  W.__wantJump(); W.__updPlayer(1/30); o.heldJump = PL.ground;
  W.__miniSet('run', 90); G.t = 90; o.holdRun = W.__raceHold();
  put2(0, 20, 0); PL.yaw = Math.PI; W.__setStamina(1); const z2 = PL.z; W.__KEY.w = true; for(let i=0;i<30;i++) W.__updPlayer(1/30); W.__KEY.w = false; o.raceWalk = +Math.abs(PL.z - z2).toFixed(2); o.RSPD = W.__RACE_SPD;
  o.fadeT = W.__FADE_T;
  W.__recoilReset(); W.__fireRecoil(1.0); o.roll = W.__aimRoll(); for(let i=0;i<40;i++) W.__recoilTick(1/60); o.roll40 = W.__aimRoll();
  o.gunshot = typeof W.__gunshot === 'function';
  return o; });
ok('★ 41차 가속·감속 — 앞키 첫 틱은 걷기 속도의 30% 아래, 열두 틱 뒤 90% 위, 놓고 네 틱이면 5% 아래', spd.acc.first < spd.acc.cruise*0.3 && spd.acc.cruise > 4.8 && spd.acc.after4 < spd.acc.cruise*0.05, JSON.stringify(spd.acc));
ok('★ 순간이동하면 남은 속도를 버린다 (경주 복귀·섬 들어가기가 미끄러지지 않게)', spd.tele < 0.01, spd.tele);
ok('★ 걸음 위상은 간 거리로 돈다 — 내 양(1.3칸에 한 바퀴)과 친구 양(객체마다)', Math.abs(spd.gait.turns - spd.gait.expect) < 0.02 && Math.abs(spd.friend - spd.friendExpect) < 0.01, JSON.stringify(spd.gait)+' · 친구 '+spd.friend+'/'+spd.friendExpect);
ok('★ 3인칭 카메라가 달리면 뒤처진다 (30Hz 검사에서 0.4~1.6칸 — 60fps 게임에선 0.85)', spd.cam.run > spd.cam.stand + 0.4 && spd.cam.run < spd.cam.stand + 1.6, JSON.stringify(spd.cam));
ok('★ 출발선 두 줄 — 내 칸은 두 줄 중 하나·12칸 안, seed 마다 자리가 섞인다, 0번 깃발(복귀 자리)도 그 칸', spd.rows.length === 2 && spd.rows.includes(spd.slot[1]) && Math.abs(spd.slot[0]) <= 11 && new Set([spd.slot.join(','), ...spd.slots]).size >= 2 && spd.cp[0] === spd.slot[0] && spd.cp[1] === spd.slot[1], JSON.stringify(spd.slot)+' / seed 9~11 '+spd.slots.join(' ')+' cp '+JSON.stringify(spd.cp));
ok('★ 초읽기는 큰 글씨(#cnt) — 3·2·1 은 노랑, 출발!! 🏁 은 초록 · 팝업 덮개(.pop)와 안 겹친다(보라 네모 없음)', spd.cnt.txt === '3' && spd.cnt.pop && !spd.cnt.go && spd.cntGo && !spd.cnt.popCls && spd.cntBox, JSON.stringify(spd.cnt)+' box '+spd.cntBox);
ok('★ 경주 안내 띠("Shift 달리기 · 스페이스 두 번 점프")가 없다 — 준비 중·경기 중 위 판이 비어 있다 (42차: 경기 중도)', spd.introQ === '' && !spd.introHint && spd.runQ === '', JSON.stringify(spd.introQ)+' / '+JSON.stringify(spd.runQ)+' '+spd.runSt);
ok('★ 발소리·출발·바람(세기) 효과음 · 코스 옆 구름 부표 뱅크(rcBuoy)', spd.sfx && spd.buoy, spd.sfx+' '+spd.buoy);
ok('★ 42차 점프 손맛 — 첫 뜀에 도약 늘어남(takeT)·잔상 타이머·보잉, 두 번째 뜀에 공중제비(flipT 0→), 착지 0.22초 눌림·툭', spd.take > 0.05 && spd.air1 && spd.trail && spd.flip >= 0 && spd.flip < 0.6 && spd.landT > 0.15 && spd.flipEnd === 99 && spd.sfxJump, `take ${spd.take} flip ${spd.flip} land ${spd.landT} end ${spd.flipEnd}`);
ok('★ 초읽기 큰 글씨는 화면 정중앙(top 50%)이고, 준비 중엔 위 판이 통째로 숨는다 (42차 — "배경 네모 없애고 가운데 잘 오게")', spd.cntTop && !spd.introBar && spd.runBar, `top ${spd.cntTop} introBar ${spd.introBar} runBar ${spd.runBar}`);
ok('★ 출발 전엔 걷기·뜀이 잠긴다 (42차 — "출발도 안 했는데 움직여져") · 출발하면 풀린다', spd.hold && spd.heldMove < 0.01 && spd.heldJump && !spd.holdRun, `hold ${spd.hold} moved ${spd.heldMove} jumpBlocked ${spd.heldJump} run ${spd.holdRun}`);
ok('★ 경주에서는 걷기가 1.64배(1초에 8.5칸 안팎 — 45차에 밑 속도가 5.4→5.94 로 올라 배수를 1.8→1.64 로 내렸다. 절대 속도는 그대로) · 사라지는 발판 1.8/1.6초 · 총 반동에 기울기(돌아온다) · gunshot 네 겹', spd.RSPD === 1.64 && spd.raceWalk > 7.6 && spd.raceWalk < 9.6 && spd.fadeT.arm === 1.8 && spd.fadeT.gone === 1.6 && spd.roll !== 0 && Math.abs(spd.roll40) < Math.abs(spd.roll)*0.05 && spd.gunshot, `1초 ${spd.raceWalk} · roll ${spd.roll.toFixed(4)} → ${spd.roll40.toFixed(5)}`);


/* ═══════ ⑪ 43차 — 총열 축 = 조준선(모든 총) · 반동은 총구가 들리는 쪽 · 화염은 총구→표적 · 총마다 제 소리 ═══════ */
const aim = await ev(()=>{ const W=window, G=W.__G, o={}; const THREE = W.__THREE, cam = W.__cam, held = W.__held, K = W.__KIT;
  if(W.__miniOn()) W.__miniExit(); G.paused = true; W.__setAim(true, true);
  const dirOf = (i)=>{ const gm = W.__gunModels()[i]; if(!gm || !gm.userData.muzzle) return null;
    cam.updateMatrixWorld(true); const m = gm.localToWorld(gm.userData.muzzle.clone()), rr = gm.localToWorld(gm.userData.muzzle.clone().add(new THREE.Vector3(0,0,-1)));
    const mc = cam.worldToLocal(m.clone()), rc = cam.worldToLocal(rr.clone()), d = mc.clone().sub(rc).normalize();
    const t = (-W.__AIM_D - mc.z)/d.z, hit = mc.clone().add(d.clone().multiplyScalar(t));
    return {x:hit.x, y:hit.y, pitch:Math.asin(d.y)*180/Math.PI}; };
  const guns = W.__WEAPONS.map((w,i)=> i).filter(i=> W.__gunModels()[i] && W.__gunModels()[i].userData.muzzle);
  o.n = guns.length; o.off = 0; o.list = [];
  for(const i of guns){ K.ownW[i] = true; W.__equipW(i); W.__updHeld(1/60,false,0); W.__updHeld(1/60,false,0); const r = dirOf(i); const e = Math.hypot(r.x, r.y); o.off = Math.max(o.off, e); o.list.push(i+':'+e.toFixed(2)); }
  K.ownW[2] = true; W.__equipW(2); W.__updHeld(1/60,false,0); const p0 = dirOf(2).pitch; W.__gunRecoil(1.0); W.__updHeld(1/60,false,0); o.pitchUp = dirOf(2).pitch - p0;
  for(let i=0;i<60;i++) W.__updHeld(1/60,false,0); o.pitchBack = dirOf(2).pitch - p0;
  /* 화염·짧은 빛줄기 — 총구→표적 방향 (총구 (0,1,0) 에서 표적 (3,5,0) 으로 → (0.6,0.8,0) 의 0.42칸) */
  const B = W.__bullets(), before = B.map(b=>b.t).slice(); W.__muzzleFx(0, 1, 0, {x:0,y:0,z:-1}, W.__WEAPONS[2], 3, 5, 0);
  const nb = B.find((b,i)=> b.t === 1 && before[i] !== 1 && b.x === 0 && b.y === 1); o.fxDir = nb ? [+(nb.tx-nb.x).toFixed(3), +(nb.ty-nb.y).toFixed(3), +(nb.tz-nb.z).toFixed(3)] : null;
  W.__setAim(false, true); for(let i=0;i<30;i++) W.__updHeld(1/60,false,0); o.toolY = held.rotation.y;
  const KEYS = W.__SFXKEYS(), real = W.__WEAPONS.filter(w=> w.ammo > 0 || w.tier);
  o.snd = {flint:W.__WEAPONS[2].snd, rifle:W.__WEAPONS[3].snd, smg:W.__WEAPONS[4].snd, all:W.__WEAPONS.every(w=>!w.snd || KEYS.includes(w.snd)), distinct:new Set(real.map(w=>w.snd)).size, cnt:real.length};
  o.helpers = typeof W.__crackSweep === 'function' && typeof W.__thump === 'function';
  G.paused = false; return o; });
ok('★ 43차 — 모든 총의 총열 축이 조준점(카메라 앞 AIM_D)을 지난다 (어긋남 < 0.15칸 — 42차엔 38° 틀어져 12칸 앞에서 8칸 왼쪽)', aim.n >= 11 && aim.off < 0.15, aim.list.join(' '));
ok('★ 반동은 총구가 들리는 쪽(+10° 이상)이고 1초 안에 제자리(±1°) — 42차까지는 부호가 거꾸로라 쏠 때 총구가 숙여졌다', aim.pitchUp > 10 && Math.abs(aim.pitchBack) < 1, aim.pitchUp.toFixed(1)+'° → '+aim.pitchBack.toFixed(2)+'°');
ok('★ 총구 화염·짧은 빛줄기는 총구→표적 방향으로 뻗는다 (카메라 앞이 아니라)', !!aim.fxDir && aim.fxDir[0] > 0.2 && aim.fxDir[1] > 0.2 && Math.abs(aim.fxDir[2]) < 0.05, JSON.stringify(aim.fxDir));
ok('★ 총을 놓고 도구를 들면 손 방향 y 가 0 으로 돌아온다 (총의 조준 회전이 남지 않는다)', Math.abs(aim.toolY) < 1e-6, aim.toolY);
ok('★ 총마다 제 소리 — 화승총 flint · 소총 rifle · 연발총 smg, 총알 총·레어·유니크 열한 개가 이름이 다 다르고 표에 다 있다 · crackSweep·thump 합성기', aim.snd.flint === 'flint' && aim.snd.rifle === 'rifle' && aim.snd.smg === 'smg' && aim.snd.all && aim.snd.distinct === aim.snd.cnt && aim.snd.cnt >= 11 && aim.helpers, JSON.stringify(aim.snd));


/* ═══════ ⑫ 44차 — 양 모션: 방향 보간·회전 기울기·머리 앞서기 · 두 마디 다리 · 숨 · 급정지 ═══════ */
const mot = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  if(W.__miniOn()) W.__miniExit(); G.paused = true;
  const f = {uid:'zz', x:PL.x + 2, z:PL.z + 3, y:PL.y, ry:0, g:1, ph:1, hat:0, gls:0, clo:0, wp:0};
  W.__drawSheep([f], 1.0, 40, s=>0xffffff, 1); o.legs = W.__P_legs.count;
  const wrap = (a)=> Math.atan2(Math.sin(a), Math.cos(a));
  /* 방향 — 2rad 꺾으면 첫 프레임엔 0.16rad(10rad/s)만, 회전 속도·남은 각이 생기고, 1초 안에 다 돈다 */
  const h0 = W.__smoothHead(f, Math.PI, 0.0001, 10).ry; f.ry = 2.0; W.__drawSheep([f], 1.016, 40, s=>0xffffff, 1); const h1 = W.__smoothHead(f, 2.0 + Math.PI, 0.0001, 10);
  o.step1 = +Math.abs(wrap(h1.ry - h0)).toFixed(3); o.turn = +Math.abs(h1.turn).toFixed(2); o.lead = +Math.abs(h1.lead).toFixed(2);
  for(let i=0;i<60;i++) W.__drawSheep([f], 1.1 + i*0.016, 40, s=>0xffffff, 1); o.left = +Math.abs(wrap(2.0 + Math.PI - W.__smoothHead(f, 2.0 + Math.PI, 0.0001, 10).ry)).toFixed(3);
  /* 급정지 — 초당 5칸으로 가다 멈추면 가속도가 크게 음수(앞으로 쏠린다) */
  const g = W.__sheepGait(f, 3); for(let i=0;i<30;i++){ f.x += 5*0.016; W.__sheepGait(f, 3.1 + i*0.016); } o.v = +g.v.toFixed(2); for(let i=0;i<6;i++) W.__sheepGait(f, 3.6 + i*0.016); o.acc = +g.acc.toFixed(1);
  /* 숨 — 서 있는 양의 몸통 세로가 시간에 따라 1~4% 오르내린다 */
  const T3 = W.__THREE, m = new T3.Matrix4(), p = new T3.Vector3(), r = new T3.Quaternion(), s = new T3.Vector3();
  const bodyY = (t)=>{ W.__drawSheep([f], t, 40, s=>0xffffff, 1); W.__Pmesh()[0].getMatrixAt(0, m); m.decompose(p, r, s); return s.y; };
  for(let i=0;i<40;i++) W.__sheepGait(f, 10 + i*0.016);
  const ys = [10.7, 11.0, 11.4, 11.8].map(bodyY); o.breath = +((Math.max(...ys) - Math.min(...ys))/Math.max(...ys)).toFixed(4);
  G.paused = false; return o; });
ok('★ 44차 — 양 다리는 두 마디(한 마리에 조각 여덟)', mot.legs === 8, mot.legs);
ok('★ 양의 표시 방향은 각속도 제한(10rad/s)으로 따라간다 — 첫 프레임 0.16rad, 회전 속도·남은 각, 1초 안에 다 돈다', mot.step1 > 0.14 && mot.step1 < 0.18 && mot.turn > 1 && mot.lead > 1.5 && mot.left < 0.01, mot.step1+' · turn '+mot.turn+' · lead '+mot.lead+' · 남음 '+mot.left);
ok('★ 급정지하면 가속도가 크게 음수(앞으로 쏠리고 먼지)', mot.v > 4 && mot.acc < -9, mot.v+' → '+mot.acc);
ok('★ 서 있는 양은 숨을 쉰다 (몸통 세로 1~4% 오르내림)', mot.breath > 0.01 && mot.breath < 0.045, mot.breath);

/* ═══════ ⑬ 45차 — 전직 날개 · 마을에서만 빨라짐(경주는 공평) · 활공 · 미니게임 미술(무지개 한 장·통나무 문·울타리 제거) ═══════ */
const job = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, XP=W.__XP, o={};
  if(W.__miniOn()) W.__miniExit(); G.paused = true;
  /* 날개 — 모양은 단계로 갈리고(1차 0 · 2차 1), 색은 직업마다 다르다. 셋 다 같은 깃털 날개다 */
  const JW = W.__JOB_WING;
  o.shapeByTier = JW.every(r => r[0].k === 0 && r[1].k === 1);
  o.bigger      = JW.every(r => r[1].s > r[0].s * 1.5);
  o.glowT2      = JW.every(r => !r[0].g && !!r[1].g);
  o.colors      = new Set(JW.map(r => r[1].c)).size;
  o.red         = JW[0][1].c, o.pink = JW[1][1].c, o.white = JW[2][1].c;
  /* 중심선은 셈으로 그린 매끈한 곡선 — 마디마다 도는 각이 작다(상자를 쌓으면 0°와 90°가 번갈아 난다) */
  const SPN = W.__wingSpine(1.3), pts = [];
  for(let i=0;i<=40;i++) pts.push(SPN(i/40));
  let mt = 0;
  for(let i=1;i<pts.length-1;i++){
    const a = Math.atan2(pts[i][1]-pts[i-1][1], pts[i][0]-pts[i-1][0]);
    const b = Math.atan2(pts[i+1][1]-pts[i][1], pts[i+1][0]-pts[i][0]);
    mt = Math.max(mt, Math.abs(b - a)); }
  o.maxTurn = +mt.toFixed(4);
  /* 깃 결 — 꼭짓점 색으로 밝은 곳(깃대)과 어두운 곳(가장자리·뿌리)이 갈린다. 2차가 1차보다 깃이 많다 */
  const G0 = W.__P_wing()[0].geometry, G1 = W.__P_wing()[1].geometry;
  const tri = g => (g.index ? g.index.count : g.attributes.position.count)/3;
  o.tri0 = tri(G0); o.tri1 = tri(G1); o.hasCol = !!G1.attributes.color;
  if(o.hasCol){ const a = G1.attributes.color.array; let mn = 9, mx = -9;
    for(let i=0;i<a.length;i+=3){ if(a[i] < mn) mn = a[i]; if(a[i] > mx) mx = a[i]; }
    o.cmin = +mn.toFixed(2); o.cmax = +mx.toFixed(2); }
  /* 그려 본다 — 1차는 날개 둘, 2차는 날개 둘 + 빛 둘 */
  const P = W.__P_wing(), PG = W.__P_wingG();
  const draw = (jb, jt)=>{ const f = {uid:'w'+jb+jt, x:PL.x+2, z:PL.z+3, y:PL.y, ry:0, g:1, ph:1, hat:0, gls:0, clo:0, wp:0, jb, jt};
    W.__drawSheep([f], 2.0, 40, s=>0xffffff, 1);
    return {w:P[0].count + P[1].count, g:PG[0].count + PG[1].count, k0:P[0].count, k1:P[1].count}; };
  o.t0 = draw(0, 0); o.t1 = draw(1, 1); o.t2 = draw(1, 2);
  /* 빠른 발·높은 뜀 — 표가 단계마다 오르고, 미니게임에서는 jobTier 가 0 이라 아무 이득이 없다 */
  const SP = W.__JOB_SPD, JM = W.__JOB_JMP, GT = W.__GLIDE_T;
  o.spd = SP.slice(); o.jmp = JM.slice(); o.gt = GT.slice();
  o.rising = SP[0] === 1 && SP[1] > SP[0] && SP[2] > SP[1] && JM[0] === 1 && JM[1] > JM[0] && JM[2] > JM[1] && GT[0] === 0 && GT[2] > GT[1] && GT[1] > 0;
  XP.job = 0; XP.jt = 2; o.village = W.__jobTier();
  G.paused = false; W.__goMini(0); o.race = W.__jobTier(); W.__miniExit(); G.paused = true;
  /* 활공 — 2차 양이 공중에서 스페이스를 누르고 있으면 떨어지는 속도가 GLIDE_VY 아래로 안 내려간다 */
  PL.ground = false; PL.down = false; PL.jumps = 2; PL.vy = -8; PL.glideT = GT[2]; PL.y += 6;
  W.__setJumpHeld(true); for(let i=0;i<4;i++) W.__updPlayer(1/60);
  o.glideVy = +PL.vy.toFixed(2); o.glideOn = !!PL.glide; o.GLIDE_VY = W.__GLIDE_VY;
  /* 같은 자리에서 1차가 안 된 양(단계 0)은 활공이 없다 */
  XP.jt = 0; PL.vy = -8; PL.glideT = 0; for(let i=0;i<4;i++) W.__updPlayer(1/60);
  o.noGlideVy = +PL.vy.toFixed(2); o.noGlide = !PL.glide;
  W.__setJumpHeld(false); XP.job = -1; XP.jt = 0; G.paused = false; return o; });
ok('★ 45차 날개 — 셋 다 같은 깃털 날개고 모양은 단계로 갈린다(1차 작게 · 2차 1.5배 넘게 크고 빛난다), 색은 직업마다(빨강·분홍·하양)',
   job.shapeByTier && job.bigger && job.glowT2 && job.colors === 3,
   `빨강 ${job.red.toString(16)} · 분홍 ${job.pink.toString(16)} · 하양 ${job.white.toString(16)}`);
ok('★ 날개 중심선은 셈으로 그린 매끈한 곡선 — 마디마다 도는 각이 3° 아래다(상자를 쌓으면 0°와 90°가 번갈아 난다)',
   job.maxTurn < 0.06, job.maxTurn+' rad');
ok('★ 날개 안에 깃 결이 있다 — 꼭짓점 색으로 깃대는 밝고 가장자리·뿌리는 어둡다(1.3배 넘게 차이), 2차가 1차보다 깃이 많다',
   job.hasCol && job.cmax / job.cmin > 1.3 && job.tri1 > job.tri0,
   `색 ${job.cmin}~${job.cmax} · 삼각형 1차 ${job.tri0} / 2차 ${job.tri1}`);
ok('★ 전직 안 한 양은 날개가 없고, 1차는 둘, 2차는 둘 + 빛 둘 (1차·2차가 서로 다른 메시)',
   job.t0.w === 0 && job.t0.g === 0 && job.t1.w === 2 && job.t1.g === 0 && job.t2.w === 2 && job.t2.g === 2 && job.t1.k0 === 2 && job.t2.k1 === 2,
   JSON.stringify([job.t0, job.t1, job.t2]));
ok('★ 이동속도·점프력·활공 시간이 단계마다 오른다 (1 → 1.10 → 1.20 · 1 → 1.08 → 1.16 · 0 → 0.6 → 1.2초)',
   job.rising, job.spd.join('/')+' · '+job.jmp.join('/')+' · '+job.gt.join('/'));
ok('★ 마을·밤에서만 이득이다 — 경주에 들어가면 jobTier 가 0 이라 전직 양도 똑같다 (선생님: "경주는 공평")',
   job.village === 2 && job.race === 0, '마을 '+job.village+' · 경주 '+job.race);
ok('★ 두 번째 뜀을 꾹 누르면 활공한다 — 떨어지는 속도가 GLIDE_VY 에서 멈춘다. 전직 안 한 양은 그냥 떨어진다',
   job.glideOn && job.glideVy === job.GLIDE_VY && job.noGlide && job.noGlideVy < job.GLIDE_VY - 1,
   `2차 ${job.glideVy} (=${job.GLIDE_VY}) · 0차 ${job.noGlideVy}`);

const art = await ev(()=>{ const W=window, B=W.__banks, o={};
  const bank = k => B.get(k) || null, n = k => (bank(k) ? bank(k).ms.length : 0);
  /* 무지개 — 한 장짜리 반달 일곱. 예전엔 miMark 상자 245장이었다 */
  const rb = bank('rcRbow');
  o.rbow = n('rcRbow'); o.rbowGeo = rb ? (rb.geo.index ? rb.geo.index.count : rb.geo.attributes.position.count)/3 : 0;
  o.rbowCols = rb && rb.cols ? new Set(rb.cols).size : 0;
  o.noCast = W.__NO_CAST.has('rcRbow');
  /* 띠는 서로 맞물린다 — 크기가 같은 비율로 줄고, 제일 바깥이 34칸이다 */
  if(rb){ const rs = rb.ms.map(m => +Math.hypot(m.elements[0], m.elements[1], m.elements[2]).toFixed(2));
    o.r0 = rs[0]; o.ratio = +(rs[1]/rs[0]).toFixed(3); o.even = rs.every((v,i)=> i===0 || Math.abs(v/rs[i-1] - rs[1]/rs[0]) < 0.002); }
  /* 첫 구간 문 — 통나무(rcTrunk)로 세운다. 파란 도리이의 파란 기둥(0x4dabf7)은 없다 */
  const z0 = W.__RACE_S[0].z0 - 3.2, tr = bank('rcTrunk');
  let near = 0, blue = 0;
  if(tr) tr.ms.forEach((m, i)=>{ const dz = Math.abs(m.elements[14] - z0);
    if(dz < 1.6){ near++; if(tr.cols && tr.cols[i] === 0x4dabf7) blue++; } });
  o.gateLogs = near; o.gateBlue = blue;
  /* 섬 가장자리 갈색 원 울타리 — 없어졌다. miEdge 에 반지름 MINI_R 언저리를 도는 조각이 없다 */
  const R = W.__MINI().R, me = bank('miEdge');
  /* 울타리는 섬 테두리를 도는 **낮은** 고리였다(MINI_Y+0.55 · +0.92). 구간 0 표지 기둥도 중심에서 35칸쯤이라
     높이로 갈라야 한다(그 기둥은 MINI_Y+1.6) */
  const YR = W.__MINI().Y + 1.3;
  o.ring = me ? me.ms.filter(m => Math.abs(Math.hypot(m.elements[12], m.elements[14]) - R) < 1.2
                                  && m.elements[13] < YR).length : -1;
  o.miEdge = n('miEdge');
  return o; });
ok('★ 45차 무지개 — 한 장짜리 반달 고리 일곱(색 일곱). 상자 245장이 아니다 · 그늘은 안 드리운다',
   art.rbow === 7 && art.rbowCols === 7 && art.rbowGeo > 100 && art.noCast,
   `${art.rbow}개 · 삼각형 ${art.rbowGeo} · 색 ${art.rbowCols}`);
ok('★ 일곱 띠가 같은 비율로 줄어 서로 맞물린다 (바깥 34칸 · 띠마다 0.953배)',
   Math.abs(art.r0 - 34) < 0.2 && Math.abs(art.ratio - 0.953) < 0.002 && art.even,
   `바깥 ${art.r0} · 비율 ${art.ratio}`);
ok('★ 맨 처음 지나는 문은 통나무 아치다 — 그 자리에 통나무가 여덟 넘게 있고 파란 도리이 기둥(0x4dabf7)은 하나도 없다',
   art.gateLogs >= 8 && art.gateBlue === 0, `통나무 ${art.gateLogs} · 파란 기둥 ${art.gateBlue}`);
ok('★ OX 퀴즈 때 세운 섬 가장자리 갈색 원 울타리가 없어졌다', art.ring === 0 && art.miEdge > 0, `고리 ${art.ring} · miEdge ${art.miEdge}`);

/* ═══════ ⑭ 46차 — 1차 날개는 하양 · 방울 꼬리 · 코스 양옆 거리(끊김 없는 땅 + 줄지어 선 건물) ═══════ */
const v46 = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, T3=W.__THREE, o={};
  if(W.__miniOn()) W.__miniExit(); G.paused = true;
  /* 날개 — 1차는 셋 다 하양, 2차는 직업마다 다르다 */
  const JW = W.__JOB_WING;
  o.t1 = JW.map(r=> r[0].c); o.t2 = JW.map(r=> r[1].c);
  o.t1White = JW.every(r=> r[0].c === 0xffffff);
  o.t2Split = new Set(JW.map(r=> r[1].c)).size === 3;
  /* 꼬리 — 한 마리에 세 알. 방울은 몸통 뒷면(f −0.47)보다 뒤에 있고 등털보다 밝다 */
  const f = {uid:'t46', x:PL.x, z:PL.z + 4, y:PL.y, ry:0, g:1, ph:0, hat:0, gls:0, clo:0, wp:0, we:0, jb:-1, jt:0, mv:false};
  G.players.set('t46', f); W.__smoothHead(f, 0, 1, 100); W.__smoothHead(f, 0, 1, 100);
  W.__drawSheep([f], 3.0, 40, s=>0x4060a0, 1);
  const P = W.__Pmesh(), tail = P[7], body = P[0];
  o.tailN = tail.count;
  const m = new T3.Matrix4(), p = new T3.Vector3(), q = new T3.Quaternion(), sc = new T3.Vector3();
  const zs = [];
  for(let i=0;i<tail.count;i++){ tail.getMatrixAt(i, m); m.decompose(p, q, sc); zs.push(+(p.z - f.z).toFixed(3)); }
  body.getMatrixAt(0, m); m.decompose(p, q, sc);
  o.bodyBack = +((p.z - f.z) - sc.z/2).toFixed(3);          // 몸통 상자의 뒷면
  o.tailBack = Math.min(...zs);                              // 제일 뒤에 있는 꼬리 알의 가운데
  o.out = +(o.bodyBack - o.tailBack).toFixed(3);             // 얼마나 튀어나왔나
  /* 방울이 등털보다 밝은가 — 인스턴스 색을 본다 */
  const ic = tail.instanceColor.array; let mx = 0;
  for(let i=0;i<tail.count;i++) mx = Math.max(mx, ic[i*3] + ic[i*3+1] + ic[i*3+2]);
  const pf = P[1], pc = pf.instanceColor.array;
  o.pomBright = mx; o.woolBright = pc[0] + pc[1] + pc[2];
  G.players.delete('t46'); G.paused = false; return o; });
ok('★ 46차 — 1차 날개는 셋 다 하양(0xffffff)이고, 2차에서 직업 색 셋으로 갈린다',
   v46.t1White && v46.t2Split, '1차 ' + v46.t1.map(c=>c.toString(16)).join('/') + ' · 2차 ' + v46.t2.map(c=>c.toString(16)).join('/'));
ok('★ 꼬리는 세 알(궁뎅이 털·뿌리·방울)이고, 방울이 몸통 뒷면보다 0.2칸 넘게 뒤로 나와 있다 — 예전엔 등털 속에 파묻혀 몸통의 네모난 뒷면만 보였다',
   v46.tailN === 3 && v46.out > 0.2, `알 ${v46.tailN} · 몸통 뒷면 ${v46.bodyBack} · 방울 ${v46.tailBack} (${v46.out} 밖으로)`);
ok('★ 꼬리 방울은 등털보다 밝다 (어두운 몸통을 배경으로 또렷하게 선다)',
   v46.pomBright > v46.woolBright + 0.1, v46.pomBright.toFixed(2) + ' > ' + v46.woolBright.toFixed(2));

const st46 = await ev(()=>{ const W=window, B=W.__banks, o={};
  const mm = B.get('miMark'), gr = [], bd = [];
  for(const mx of mm.ms){ const e = mx.elements;
    const sx = Math.hypot(e[0],e[1],e[2]), sy = Math.hypot(e[4],e[5],e[6]), sz = Math.hypot(e[8],e[9],e[10]);
    const x = e[12], z = e[14];
    if(Math.abs(sx - 11.8) < 0.15 && Math.abs(sy - 0.56) < 0.08 && Math.abs(x) > 12) gr.push({x, z, sz});   // 거리 풀 뚜껑
    if(Math.abs(x) > 12 && Math.abs(x) < 21.5 && z > 40 && z < 252) bd.push(z); }                            // 거리 위 건물 조각
  o.grass = gr.length;
  let gap = 0, gapAt = -1;
  for(const side of [-1,1]) for(let z=42; z<=250; z+=4)
    if(!gr.some(g => (g.x < 0) === (side < 0) && Math.abs(g.z - z) <= g.sz/2 + 0.01)){ gap++; if(gapAt < 0) gapAt = z*side; }
  o.gap = gap; o.gapAt = gapAt;
  /* 8칸 칸마다 건물 조각이 몇이나 있나 — 제일 빈 칸을 본다 */
  const bin = new Map();
  for(const z of bd){ const k = Math.floor((z - 42)/8); bin.set(k, (bin.get(k)||0) + 1); }
  let worst = 1e9, worstAt = -1;
  for(let k=0;k<26;k++){ const c = bin.get(k)||0; if(c < worst){ worst = c; worstAt = 42 + k*8; } }
  o.worst = worst; o.worstAt = worstAt; o.pieces = bd.length;
  return o; });
ok('★ 46차 — 코스 양옆 땅이 z 42~250 에서 한 군데도 안 끊긴다 (예전엔 12칸마다 섬 하나라 3칸씩 비었다)',
   st46.gap === 0 && st46.grass >= 60, `빈 곳 ${st46.gap}(${st46.gapAt}) · 풀 판 ${st46.grass}`);
ok('★ 건물이 8칸 칸마다 빠짐없이 선다 (제일 빈 칸에도 조각 여섯 넘게)',
   st46.worst >= 6, `제일 빈 칸 z${st46.worstAt} 에 ${st46.worst}조각 · 모두 ${st46.pieces}`);

/* ═══════ ⑮ 47차 — 골인율: 제일 좁은 발판도 양 둘이 스친다 · 경주에서는 튕김이 절반 ═══════ */
const fin47 = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  /* 변형 셋을 다 지어 보고, 발판마다 '몇 명이 나란히 설 수 있나'(폭 ÷ 부딪힘 지름)를 센다.
     깃발 판(cp)·계단 옆 좁은 것 말고 **지나가야 하는 발판**(beam·log·stone·fade)만 본다. */
  const R = W.__SHEEP_R2, worst = {};
  for(const seed of [11, 12, 13, 14, 15, 16]){
    W.__raceBuild(seed);
    for(const p of W.__RACE_P()){
      if(!['beam','log','stone','fade'].includes(p.kind)) continue;
      if(worst[p.kind] === undefined || p.w < worst[p.kind]) worst[p.kind] = p.w; } }
  o.worst = worst; o.R = R;
  o.abreast = Object.fromEntries(Object.entries(worst).map(([k,w])=> [k, +(w/R).toFixed(2)]));
  o.allPass = Object.values(worst).every(w => w >= R*2);      // 둘이 나란히 = 폭이 지름의 두 배
  /* 튕김 — 같은 속도로 부딪힐 때 경주가 마을보다 작다(절반). 겹침 벌림은 그대로라 딱 절반은 아니다 */
  const Y = PL.y;
  G.players.set('bp', {uid:'bp', x:0.3, y:Y, z:PL.z, g:1, n:'bp', ry:0, jt:0});
  const meas = ()=>{ PL.x = 0.6; W.__kbReset(); W.__sheepBump(1/30, -8, 0); return +Math.hypot(W.__kb().x, W.__kb().z).toFixed(2); };
  if(W.__miniOn()) W.__miniExit();
  const px = PL.x, pz = PL.z; G.players.get('bp').z = pz;
  o.town = meas();
  G.paused = false; W.__goMini(0); G.paused = true;
  PL.z = pz; G.players.get('bp').x = 0.3; G.players.get('bp').y = PL.y; G.players.get('bp').z = PL.z;
  o.race = meas();
  W.__miniExit(); PL.x = px; PL.z = pz; G.players.delete('bp'); W.__kbReset();
  return o; });
ok('★ 47차 — 지나가야 하는 발판은 다 양 둘이 나란히 설 만큼 넓다 (폭 ≥ 부딪힘 지름 0.95 × 2). 좁은 다리 1.0 · 통나무 1.5 는 한 명만 지나갈 수 있었다',
   fin47.allPass, Object.entries(fin47.abreast).map(([k,v])=>`${k} ${v}명`).join(' · ') + ` (지름 ${fin47.R})`);
ok('★ 경주에서는 튕김이 절반이다 — 같은 속도로 부딪혀도 마을보다 적게 밀린다 (겹침 벌림은 그대로라 딱 절반은 아니다)',
   fin47.race < fin47.town && fin47.race > fin47.town * 0.5, `마을 ${fin47.town} → 경주 ${fin47.race}`);

/* ═══════ ⑯ 47차 ② 최적화 — 건물은 모둠별로 걸러지고, 바뀐 모둠만 다시 짓는다 ═══════ */
const opt47 = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, T3=W.__THREE, o={};
  if(W.__miniOn()) W.__miniExit(); G.paused = true;
  const triOf = (g)=> (g.index ? g.index.count : g.attributes.position.count)/3;
  /* 다섯 모둠에 벽 줄 + 탑을 꽉 채워 짓는다 (교실에서 한참 지은 뒤의 모습) */
  for(let i=0;i<5;i++) W.__base[i] = {w:999999, s:999999, o:999999, eg:999, mk:999, pk:999};
  W.__recompute(); W.__clear();
  for(let g=0; g<5; g++){ const d = W.__DIRS[g]; G.me.g = g;
    for(let pp=-8; pp<=8; pp+=0.7){
      const x = Math.round(d.dx*42 - d.dz*pp), z = Math.round(d.dz*42 + d.dx*pp);
      if(W.__canPlace('swall', x, z) === null){ W.__place('swall', x, z);
        const q = [...W.__STRU.values()].pop(); q.lv = 5; } }
    for(const [t, rr, pp] of [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],['arrow',26,0],
                              ['ice',33,-5],['ice',33,5],['barr',28,0]]){
      const x = Math.round(d.dx*rr - d.dz*pp), z = Math.round(d.dz*rr + d.dx*pp);
      if(W.__canPlace(t, x, z) === null){ W.__place(t, x, z); const q = [...W.__STRU.values()].pop(); q.lv = 6; } } }
  G.me.g = 0; W.__rebuild();
  o.stru = W.__STRU.size;
  /* ① 메시가 모둠별로 쪼개져 있고, 프러스텀 컬링이 켜져 있고, 잰 구가 있다 */
  const keys = [];
  let mesh = 0, tri = 0, culled = 0, sphere = 0;
  for(const [k, m] of W.__struMeshes){ if(!m.count) continue;
    keys.push(k); mesh++; tri += m.count*triOf(m.geometry);
    if(m.frustumCulled) culled++; if(m.boundingSphere) sphere++; }
  o.mesh = mesh; o.tri = tri; o.culled = culled; o.sphere = sphere;
  o.gset = [...new Set(keys.map(k=> k.slice(k.lastIndexOf('#')+1)))].sort();
  /* ② 시점에 따라 걸러진다 — 제 모둠 문 앞에서 밖을 보면 남의 모둠 넷이 통째로 빠진다 */
  const seen = (px,py,pz, tx,ty,tz)=>{
    W.__cam.position.set(px,py,pz); W.__cam.lookAt(tx,ty,tz); W.__cam.updateMatrixWorld();
    const fr = new T3.Frustum();
    fr.setFromProjectionMatrix(new T3.Matrix4().multiplyMatrices(W.__cam.projectionMatrix, W.__cam.matrixWorldInverse));
    let t = 0;
    for(const [k, m] of W.__struMeshes){ if(!m.count) continue;
      if(m.frustumCulled){ if(!m.boundingSphere) m.computeBoundingSphere();
        const s2 = m.boundingSphere.clone(); s2.applyMatrix4(m.matrixWorld);
        if(!fr.intersectsSphere(s2)) continue; }
      t += m.count*triOf(m.geometry); }
    return t; };
  const d0 = W.__DIRS[0];
  o.outward = seen(d0.dx*46, 3, d0.dz*46, d0.dx*90, 2, d0.dz*90);
  o.crystal = seen(3, 3, 3, d0.dx*60, 2, d0.dz*60);
  /* ③ 한 모둠만 바뀌면 그 모둠 블록만 다시 만든다 — 다시 만든 인스턴스 수로 잰다
       (행렬 값을 견주면 못 잡는다: 안 바뀐 건물은 다시 만들어도 값이 똑같다) */
  W.__markShapeG(2); W.__rebuild(); o.one = W.__struLastN();
  W.__markShapeG();  W.__rebuild(); o.all = W.__struLastN();
  /* ④ 낮에는 길 깔기를 모은다 — 지은 직후 바로 깔지 않고 기다렸다 한 번만 */
  W.__place('swall', Math.round(d0.dx*44), Math.round(d0.dz*44));
  o.flowPending = W.__flowDirty(); o.flowWait = W.__flowWait();
  W.__clear(); G.paused = false; return o; });
ok('★ 47차 — 건물 메시가 모둠별로 쪼개져 있고, 전부 프러스텀 컬링이 켜져 있다 (예전엔 재질마다 하나뿐이라 컬링을 끄고 언제나 다 그렸다)',
   opt47.mesh >= 6 && opt47.culled === opt47.mesh && opt47.sphere === opt47.mesh && opt47.gset.length >= 4,
   `건물 ${opt47.stru}채 · 메시 ${opt47.mesh}(모둠 ${opt47.gset.join(',')}) · 컬링 ${opt47.culled} · 잰 구 ${opt47.sphere} · 삼각형 ${opt47.tri}`);
ok('★ 제 모둠 앞에서 밖을 보면 건물 삼각형이 절반 아래로 걸러진다 (남의 모둠 넷이 통째로 빠진다)',
   opt47.outward < opt47.tri*0.5 && opt47.crystal < opt47.tri*0.6,
   `전부 ${opt47.tri} → 밖을 봄 ${opt47.outward} · 수정 옆 ${opt47.crystal}`);
ok('★ 한 모둠만 바뀌면 그 모둠 블록만 다시 만든다 — 예전엔 한 채를 지어도 건물 전부(9,785칸)의 행렬을 다시 만들었다(4.52ms)',
   opt47.one > 0 && opt47.one < opt47.all * 0.45,
   `한 모둠 ${opt47.one}칸 / 전부 ${opt47.all}칸 (${(opt47.one/opt47.all*100).toFixed(0)}%)`);
ok('★ 낮에는 길 깔기를 예약만 해 두고 0.45초 쉰 뒤에 한 번만 깐다 — 연달아 열 채를 놓아도 35ms 가 3.5ms 로 끝난다 (맵 전체 다익스트라)',
   opt47.flowPending === true && opt47.flowWait >= 0.3,
   `지은 직후 — 예약됨 ${opt47.flowPending} · 남은 기다림 ${opt47.flowWait}초`);

const geo47 = await ev(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const triOf = (g)=> (g.index ? g.index.count : g.attributes.position.count)/3;
  const f = {uid:'t47', x:PL.x, y:PL.y, z:PL.z+4, ry:0, g:1, ph:0, hat:1, gls:1, clo:1, wp:3, we:2, jb:0, jt:2, mv:true, n:'ㅇ'};
  G.players.set('t47', f); W.__smoothHead(f, 0, 1, 100);
  W.__drawSheep([f], 3.0, 40, s=>0x4060a0, 1);
  const P = W.__Pmesh();
  o.eye = triOf(P[5].geometry); o.nose = triOf(P[6].geometry);
  o.leg = triOf(P[8].geometry); o.puff = triOf(P[1].geometry);
  let tot = 0; for(const m of P){ if(m && m.count) tot += m.count*triOf(m.geometry); }
  o.tot = tot;
  G.players.delete('t47'); return o; });
ok('★ 47차 — 눈알·콧방울은 잔 공(8×6)이고 다리는 작은 둥근 상자다. 털뭉치처럼 눈에 띄는 공은 그대로 곱다',
   geo47.eye <= 96 && geo47.nose <= 96 && geo47.leg <= 120 && geo47.puff >= 240,
   `눈 ${geo47.eye} · 코 ${geo47.nose} · 다리 ${geo47.leg} · 털뭉치 ${geo47.puff} 삼각형`);
ok('★ 양 한 마리의 부위 삼각형이 5천 아래로 내려왔다 (46차 7,296 — 다리 2,400 · 눈 1,008 · 코 504 가 컸다)',
   geo47.tot < 5000, `한 마리 ${geo47.tot} 삼각형`);

await ev(()=>{ const W=window; if(W.__miniOn()) W.__miniExit(); });
/* ═══════ 결과 ═══════ */
console.log('');
let fail=0; for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); if(!c) fail++; }
console.log(errs.length ? '(페이지 오류 '+errs.length+') '+errs.slice(0,3).join(' | ') : '(오류 없음)');
console.log(fail ? `${fail}개 실패 / ${R.length}항목` : `${R.length}항목 전부 통과`);
await b.close(); srv.close(); process.exit(fail || errs.length ? 1 : 0);
