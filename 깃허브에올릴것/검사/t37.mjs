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
  o.cntBox = (()=>{ const r = c.getBoundingClientRect(); return r.width < innerWidth*0.5 && r.height < innerHeight*0.7; })();   // 42차 — 팝업 덮개(.pop)와 이름이 겹쳐 보라 네모(폭 50%)가 떴다 — 숫자 하나는 화면 반보다 좁다
  W.__cntShow('출발!! 🏁', true); o.cntGo = c.classList.contains('go') && c.textContent.startsWith('출발');
  W.__miniSet('intro', 7); W.__paintMini(); o.introQ = document.getElementById('mbQ').textContent; o.introHint = /스페이스/.test(document.getElementById('miniBar').textContent);
  o.sfx = ['step','go','wind'].every(k=> W.__SFXKEYS().includes(k));
  o.buoy = !!W.__banks.get('rcBuoy');
  W.__miniSet('run', 90); G.t = 90; G.mini.rank = null; W.__paintMini(); o.runQ = document.getElementById('mbQ').textContent; o.runBar = document.getElementById('miniBar').classList.contains('on');   // rank 는 앞 순위 검사가 남긴 것 — 결과 화면이 아니라 경기 중 판을 본다
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
ok('★ 경주 안내 띠("Shift 달리기 · 스페이스 두 번 점프")가 없다 — 준비 중·경기 중 위 판이 비어 있다 (42차: 경기 중도)', spd.introQ === '' && !spd.introHint && spd.runQ === '', JSON.stringify(spd.introQ)+' / '+JSON.stringify(spd.runQ));
ok('★ 발소리·출발·바람(세기) 효과음 · 코스 옆 구름 부표 뱅크(rcBuoy)', spd.sfx && spd.buoy, spd.sfx+' '+spd.buoy);
ok('★ 42차 점프 손맛 — 첫 뜀에 도약 늘어남(takeT)·잔상 타이머·보잉, 두 번째 뜀에 공중제비(flipT 0→), 착지 0.22초 눌림·툭', spd.take > 0.05 && spd.air1 && spd.trail && spd.flip >= 0 && spd.flip < 0.6 && spd.landT > 0.15 && spd.flipEnd === 99 && spd.sfxJump, `take ${spd.take} flip ${spd.flip} land ${spd.landT} end ${spd.flipEnd}`);
ok('★ 초읽기 큰 글씨는 화면 정중앙(top 50%)이고, 준비 중엔 위 판이 통째로 숨는다 (42차 — "배경 네모 없애고 가운데 잘 오게")', spd.cntTop && !spd.introBar && spd.runBar, `top ${spd.cntTop} introBar ${spd.introBar} runBar ${spd.runBar}`);
ok('★ 출발 전엔 걷기·뜀이 잠긴다 (42차 — "출발도 안 했는데 움직여져") · 출발하면 풀린다', spd.hold && spd.heldMove < 0.01 && spd.heldJump && !spd.holdRun, `hold ${spd.hold} moved ${spd.heldMove} jumpBlocked ${spd.heldJump} run ${spd.holdRun}`);
ok('★ 경주에서는 걷기가 1.8배(1초에 8.5칸 안팎 — 마을 4.8) · 사라지는 발판 1.8/1.6초 · 총 반동에 기울기(돌아온다) · gunshot 네 겹', spd.RSPD === 1.8 && spd.raceWalk > 7.6 && spd.raceWalk < 9.6 && spd.fadeT.arm === 1.8 && spd.fadeT.gone === 1.6 && spd.roll !== 0 && Math.abs(spd.roll40) < Math.abs(spd.roll)*0.05 && spd.gunshot, `1초 ${spd.raceWalk} · roll ${spd.roll.toFixed(4)} → ${spd.roll40.toFixed(5)}`);

await ev(()=>{ const W=window; if(W.__miniOn()) W.__miniExit(); });
/* ═══════ 결과 ═══════ */
console.log('');
let fail=0; for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); if(!c) fail++; }
console.log(errs.length ? '(페이지 오류 '+errs.length+') '+errs.slice(0,3).join(' | ') : '(오류 없음)');
console.log(fail ? `${fail}개 실패 / ${R.length}항목` : `${R.length}항목 전부 통과`);
await b.close(); srv.close(); process.exit(fail || errs.length ? 1 : 0);
