/* 18차 검사 — 하늘 섬 미니게임 (OX 퀴즈 · 모둠 줄넘기 · 모둠 서바이벌) · 건물값 20%
   ★ 혼자 하기(호스트)로 세 판을 처음부터 끝까지 실제로 돌린다.
     흐름은 호스트 시계(hostPhase)가 끌고 가므로 __step 으로 시계를 돌려 본다.
   ★ 손으로 시계를 돌리는 동안은 G.paused 로 진짜 루프를 세운다 —
     안 그러면 뒤에서 도는 호스트 루프가 판을 먼저 끝내 버린다(처음에 그렇게 빨개졌다). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12200);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1500);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
const ev = (f,a)=> pg.evaluate(f,a);

/* ═══════ ① 건물값 20% ═══════ */
const cost = await ev(()=>{ const B=window.__BUILD, o={mul:window.__COST_MUL()};
  o.값 = {wwall:B.wwall.cost, swall:B.swall.cost, arrow:B.arrow.cost, ice:B.ice.cost, barr:B.barr.cost};
  o.올림 = B.wwall.up[0]; return o; });
ok('★ 건물값이 20% 올랐다 (나무벽 5 · 돌벽 7 · 화살탑 12/8 · 얼음탑 7/11/2 · 배럭 17/13/5)',
   cost.값.wwall.w===5 && cost.값.swall.s===7 && cost.값.arrow.w===12 && cost.값.arrow.s===8
   && cost.값.ice.w===7 && cost.값.ice.s===11 && cost.값.barr.w===17 && cost.값.barr.s===13 && cost.값.barr.g===5,
   JSON.stringify(cost.값));
ok('★ 올리는 값도 같이 올랐다 (나무벽 Lv2: 5/1 → 6/1)', cost.올림.w===6 && cost.올림.s===1, JSON.stringify(cost.올림));

/* ═══════ ② 5·10·15일차 밤이 끝나면 저절로 열린다 ═══════ */
const auto = await ev(()=>{ const W=window, G=W.__G, o={};
  const tryDay = (d)=>{ G.day=d; G.phase='night'; G.wolves.length=0; W.__spawnQ().length=0; G.t=1;
    W.__step(1, 1/30); const r = {ph:G.phase, k:G.mini&&G.mini.k, day:G.day};
    if(G.phase==='mini'){ W.__miniExit(); } return r; };
  o.d4 = tryDay(4); o.d5 = tryDay(5); o.d10 = tryDay(10); o.d15 = tryDay(15);
  o.DAYS = W.__MINI().DAYS; return o; });
ok('★ 5일차 밤이 끝나면 OX 퀴즈가 열린다', auto.d5.ph==='mini' && auto.d5.k===0, JSON.stringify(auto.d5));
ok('★ 10일차는 줄넘기 · 15일차는 서바이벌', auto.d10.k===1 && auto.d15.k===2, auto.d10.k+' · '+auto.d15.k);
ok('★ 다른 날은 그냥 아침이 온다', auto.d4.ph==='day' && auto.d4.day===5, JSON.stringify(auto.d4));

/* ═══════ ③ 하늘 섬 — 땅 · 가장자리 · 울타리 ═══════ */
const isle = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  W.__goMini(0); G.paused = true;
  o.높이 = +PL.y.toFixed(1); o.섬 = M.Y; o.바 = document.body.classList.contains('mini');
  o.자리 = [+PL.x.toFixed(1), +PL.z.toFixed(1)]; o.발판 = [M.padX(G.me.g), M.PADZ];
  /* 가장자리 밖으로 밀어 본다 */
  PL.x = M.R + 5; PL.z = 0; W.__updPlayer(1/30); o.밖 = +Math.hypot(PL.x, PL.z).toFixed(2); o.R = M.R;
  /* O 우리 울타리 — 문(출발선 쪽)은 뚫리고 옆은 막힌다. 뛰면 넘는다 */
  const cx = -M.OX, cz = M.OZ;
  o.문 = W.__solidHit(cx, cz - M.ZR, M.Y + 0.3);
  o.옆 = W.__solidHit(cx + M.ZR, cz, M.Y + 0.3);
  o.뛰어넘기 = W.__solidHit(cx + M.ZR, cz, M.Y + 1.3);
  o.뱅크 = ['miFloor','miEdge','miMark','miGlow'].map(k=> !!W.__banks.get(k));
  return o; });
ok('★ 들어가면 하늘 섬 높이에 선다', isle.높이 === isle.섬, isle.높이+' = '+isle.섬);
ok('★ 우리 모둠 발판에서 시작한다', Math.abs(isle.자리[0]-isle.발판[0]) < 2.5 && Math.abs(isle.자리[1]-isle.발판[1]) < 2.5,
   JSON.stringify(isle.자리)+' ≈ '+JSON.stringify(isle.발판));
ok('★ 섬 밖으로 못 나간다 (떨어지면 그 판을 통째로 놓친다)', isle.밖 <= isle.R - 0.9, isle.밖+' ≤ '+(isle.R-1));
ok('★ O 우리는 출발선 쪽 문만 뚫려 있고, 울타리는 뛰어넘을 수 있다', !isle.문 && isle.옆 && !isle.뛰어넘기,
   '문 '+isle.문+' · 옆 '+isle.옆+' · 뛰어넘기 '+isle.뛰어넘기);
ok('★ 섬이 실제로 구워져 있다 (바닥·난간·표시·등불)', isle.뱅크.every(Boolean), isle.뱅크.join(' '));

/* ═══════ ④ OX 퀴즈 — 처음부터 끝까지 ═══════ */
const ox = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  G.paused = false;
  W.__step((M.INTRO+1)*30, 1/30); o.설명뒤 = G.mini.st;
  W.__step(30*30, 1/30); o.기다림 = G.mini.st;                 // 선생님이 안 내면 안 넘어간다
  o.빈문제 = W.__oxAsk('   ', 'O');
  /* 선생님 패널의 단추로 낸다 */
  document.getElementById('tQ').value = '늑대는 밤에 온다';
  document.getElementById('tQO').click();
  o.낸뒤 = {st:G.mini.st, q:G.mini.q, t:Math.round(G.t)};
  PL.x = -M.OX; PL.z = M.OZ; W.__miniTick(0.05); o.내자리 = W.__MINE.zone;
  const r0 = {...G.res[G.me.g]};
  W.__step((M.QSEC+1)*30, 1/30); W.__miniTick(0.05);
  const r1 = G.res[G.me.g];
  o.공개 = {st:G.mini.st, ans:G.mini.rv&&G.mini.rv.ans, ok:G.mini.rv&&G.mini.rv.ok.length, sc:[...G.mini.sc]};
  o.상 = {w:r1.w-r0.w, s:r1.s-r0.s, g:r1.g-r0.g}; o.OK = M.OK;
  /* 2번: 정답 공개 단추로 바로 끝낸다 */
  W.__step((M.RSEC+1)*30, 1/30);
  W.__oxAsk('양은 늑대를 잡아먹는다', 'X'); PL.x = M.OX; PL.z = M.OZ; W.__miniTick(0.05);
  document.getElementById('tQNow').click(); W.__step(1, 1/30); W.__miniTick(0.05);
  o.바로공개 = {st:G.mini.st, ok:G.mini.rv.ok.length};
  /* 3번: 틀린다 — 아무것도 못 받는다 */
  W.__step((M.RSEC+1)*30, 1/30);
  const r2 = {...G.res[G.me.g]};
  W.__oxAsk('돌은 나무보다 가볍다', 'X'); PL.x = -M.OX; PL.z = M.OZ; W.__miniTick(0.05);
  W.__step((M.QSEC+1)*30, 1/30); W.__miniTick(0.05);
  o.틀림 = {ok:G.mini.rv.ok.length, got:G.res[G.me.g].w - r2.w};
  W.__step((M.RSEC+1)*30, 1/30); W.__miniTick(0.05);
  o.끝 = {st:G.mini.st, qn:G.mini.qn, sc:[...G.mini.sc]};
  const day0 = G.day;
  W.__step((M.DONE+1)*30, 1/30);
  o.아침 = {ph:G.phase, day:G.day-day0, mini:G.mini, y:+PL.y.toFixed(1), GY:W.__GY,
           body:document.body.classList.contains('mini'), bar:document.getElementById('miniBar').classList.contains('on')};
  return o; });
ok('★ 설명이 끝나면 선생님이 문제 낼 차례가 되고, 낼 때까지 넘어가지 않는다', ox.설명뒤==='ask' && ox.기다림==='ask', ox.설명뒤+' → '+ox.기다림);
ok('★ 빈 문제는 안 낸다', ox.빈문제 === false);
ok('★ 선생님 패널 단추로 문제가 나가고 푸는 시간이 시작된다', ox.낸뒤.st==='run' && ox.낸뒤.q==='늑대는 밤에 온다' && ox.낸뒤.t>0, JSON.stringify(ox.낸뒤));
ok('★ O 우리 안에 서면 O 로 잡힌다', ox.내자리==='O');
ok('★ 시간이 다 되면 정답이 공개되고 맞힌 아이가 세어진다', ox.공개.st==='reveal' && ox.공개.ans==='O' && ox.공개.ok===1 && ox.공개.sc[0]===1, JSON.stringify(ox.공개));
ok('★ 맞히면 정해진 자원을 받는다', ox.상.w===ox.OK.w && ox.상.s===ox.OK.s && ox.상.g===ox.OK.g, JSON.stringify(ox.상));
ok('★ 선생님이 "지금 정답 공개" 를 누르면 바로 공개된다', ox.바로공개.st==='reveal' && ox.바로공개.ok===1, JSON.stringify(ox.바로공개));
ok('★ 틀리면 아무것도 못 받는다', ox.틀림.ok===0 && ox.틀림.got===0, JSON.stringify(ox.틀림));
ok('★ 세 문제가 끝나면 마무리 판이 뜬다', ox.끝.st==='done' && ox.끝.qn===3 && ox.끝.sc[0]===2, JSON.stringify(ox.끝));
ok('★ 그 뒤 새 아침이 오고 땅으로 돌아온다 (판·미니게임 표시도 꺼진다)',
   ox.아침.ph==='day' && ox.아침.day===1 && ox.아침.mini===null && ox.아침.y===ox.아침.GY && !ox.아침.body && !ox.아침.bar,
   JSON.stringify(ox.아침));

/* ═══════ ⑤ 줄넘기 ═══════ */
const rope = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  /* 줄 속도 — 닫힌 식이라 어긋남이 안 쌓이고, 느릴 때와 빠를 때가 있다 */
  let dmin=1e9, dmax=0, mono=true, prev=W.__ropePhase(0);
  for(let t=0.01; t<=M.ROPE; t+=0.01){ const ph=W.__ropePhase(t); const d=(ph-prev)/0.01; prev=ph;
    if(d<=0) mono=false; dmin=Math.min(dmin,d); dmax=Math.max(dmax,d); }
  o.속도 = {느림:+dmin.toFixed(2), 빠름:+dmax.toFixed(2), 늘앞으로:mono, 바퀴:Math.floor(W.__ropePhase(M.ROPE)/(Math.PI*2))};
  W.__goMini(1); W.__step((M.INTRO+1)*30, 1/30); W.__miniTick(0.05); G.paused = true;
  o.단계 = G.mini.st;
  PL.x = M.padX(G.me.g); PL.z = M.PADZ;
  for(let t=0; t<M.ROPE; t+=0.05){ G.t = M.ROPE - t;
    const ph = W.__ropePhase(t) % (Math.PI*2), near = ph < 0.35 || ph > Math.PI*2-0.35;
    PL.ground = !near; PL.airT = near ? 0 : 1; W.__miniTick(0.05); }
  o.맞춰뜀 = {j:W.__MINE.j, f:W.__MINE.f};
  W.__MINE.j = 0; W.__MINE.f = 0;
  for(let t=0; t<M.ROPE; t+=0.05){ G.t = M.ROPE - t; PL.ground = true; PL.airT = 1; W.__miniTick(0.05); }
  o.안뜀 = {j:W.__MINE.j, f:W.__MINE.f};
  /* 발판 밖에 서 있으면 세지 않는다 */
  W.__MINE.j = 0; W.__MINE.f = 0; PL.x = 0; PL.z = 0;
  for(let t=0; t<M.ROPE; t+=0.05){ G.t = M.ROPE - t; PL.ground = true; PL.airT = 1; W.__miniTick(0.05); }
  o.밖 = {j:W.__MINE.j, f:W.__MINE.f};
  return o; });
/* 줄은 그리기 루프가 그린다 — 한 프레임은 지나야 칸이 찬다 */
await pg.waitForTimeout(400);
rope.줄 = await ev(()=>({n:window.__R_rope().count, 칸:window.__R_rope().instanceMatrix.count}));
Object.assign(rope, await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), o={};
  /* 순위 — 모둠 평균. 남의 점수를 흉내 내 넣는다 */
  W.__MINE.j = 17; W.__miniPl.set('a1',{g:1,n:'가',j:9}); W.__miniPl.set('a2',{g:1,n:'나',j:11}); W.__miniPl.set('a3',{g:2,n:'다',j:30});
  const r0 = {...G.res[G.me.g]};
  G.paused = false; G.t = 0; W.__step(1, 1/30); W.__miniTick(0.05);
  const r1 = G.res[G.me.g];
  o.순위 = {st:G.mini.st, sc:[...G.mini.sc], rank:[...G.mini.rank], 상:{w:r1.w-r0.w, s:r1.s-r0.s, g:r1.g-r0.g}, PRIZE:M.PRIZE};
  W.__step((M.DONE+1)*30, 1/30);
  return o; }));
ok('★ 줄이 느려졌다 빨라졌다 하면서 늘 앞으로만 돈다', rope.속도.늘앞으로 && rope.속도.빠름/rope.속도.느림 > 2, JSON.stringify(rope.속도));
ok('★ 설명이 끝나면 저절로 시작한다', rope.단계==='run');
ok('★ 줄이 발밑에 올 때 떠 있으면 넘은 것으로 센다 (1분에 스무 번 남짓)', rope.맞춰뜀.j >= 15 && rope.맞춰뜀.f===0, JSON.stringify(rope.맞춰뜀));
ok('★ 가만히 서 있으면 매번 걸린다', rope.안뜀.j===0 && rope.안뜀.f >= 15, JSON.stringify(rope.안뜀));
ok('★ 우리 모둠 발판 밖에 있으면 세지 않는다', rope.밖.j===0 && rope.밖.f===0, JSON.stringify(rope.밖));
ok('★ 줄 다섯 개가 그려지고 칸이 안 넘친다', rope.줄.n > 0 && rope.줄.n <= rope.줄.칸, rope.줄.n+' / '+rope.줄.칸);
ok('★ 모둠 점수는 모둠원 평균이고, 많이 넘은 모둠이 1등이다', rope.순위.sc[1]===10 && rope.순위.sc[2]===30 && rope.순위.rank[0]===2 && rope.순위.rank[1]===0,
   'sc '+JSON.stringify(rope.순위.sc)+' rank '+JSON.stringify(rope.순위.rank));
ok('★ 순위대로 상을 받는다 (2등 = 두 번째 상)', rope.순위.상.w===rope.순위.PRIZE[1].w && rope.순위.상.g===rope.순위.PRIZE[1].g, JSON.stringify(rope.순위.상));
ok('★ 꼴찌도 빈손은 아니다', rope.순위.PRIZE[4].w > 0 && rope.순위.PRIZE[4].g > 0, JSON.stringify(rope.순위.PRIZE[4]));

/* ═══════ ⑥ 서바이벌 ═══════ */
const sv = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  W.__goMini(2); W.__step((M.INTRO+1)*30, 1/30); W.__miniTick(0.05); G.paused = true;
  W.__syncMyPC(); o.시작 = {st:G.mini.st, aiming:document.body.classList.contains('aiming'), wp:W.__myPC().wp, gun:M.GUN};
  /* 조준 — 앞에 선 다른 모둠 아이는 맞고, 같은 모둠·목숨 다 쓴 아이는 안 맞는다 */
  PL.x = 0; PL.z = -10; PL.y = M.Y; PL.yaw = Math.PI; PL.pitch = 0;
  W.__updPlayer(1/30);     /* ★ 카메라 방향은 updPlayer 가 잡는다 — yaw 만 바꾸고 바로 재면 예전 방향을 본다 */
  const put = (id,g,z)=>{ G.players.set(id,{uid:id,x:0,y:M.Y,z,g,n:id}); };
  put('e1', (G.me.g+1)%5, -4); o.적 = W.__aimPlayer() && W.__aimPlayer().uid;
  G.players.clear(); put('f1', G.me.g, -4); o.같은모둠 = W.__aimPlayer();
  G.players.clear(); put('e2', (G.me.g+1)%5, -4); W.__miniPl.set('e2',{g:(G.me.g+1)%5,n:'e2',l:0,k:0}); o.죽은아이 = W.__aimPlayer();
  G.players.clear(); W.__miniPl.delete('e2');
  /* 맞기 — 두 방에 한 목숨, 세 목숨이면 끝 */
  const seq=[]; for(let i=0;i<6;i++){ W.__survHit('x','친구',1); seq.push([W.__MINE.hp, W.__MINE.l, W.__MINE.out]); W.__MINE.rs = 0; }
  o.맞음 = seq; o.더맞음 = (W.__survHit('x','친구',1), W.__MINE.l);
  /* 순위 — 남은 목숨 합계, 같으면 맞힌 수 */
  W.__miniPl.set('b1',{g:2,n:'다',l:3,k:4}); W.__miniPl.set('b2',{g:3,n:'라',l:3,k:9}); W.__miniPl.set('b3',{g:4,n:'마',l:1,k:0});
  G.paused = false; W.__miniFinish();
  o.순위 = {st:G.mini.st, rank:[...G.mini.rank], aiming:document.body.classList.contains('aiming')};
  W.__step((M.DONE+1)*30, 1/30);
  o.끝 = {ph:G.phase, aiming:document.body.classList.contains('aiming'), y:+PL.y.toFixed(1)};
  /* 가게에는 연습용 총이 없다 */
  W.__shopTab('w'); W.__buildShopUI();
  o.가게 = [...document.querySelectorAll('#shopList .sn')].map(e=>e.textContent).join(' ');
  return o; });
ok('★ 시작하면 모두 같은 연습용 총을 들고 조준 모드가 켜진다', sv.시작.st==='run' && sv.시작.aiming && sv.시작.wp===sv.시작.gun, JSON.stringify(sv.시작));
ok('★ 앞에 선 다른 모둠 아이가 조준된다', sv.적==='e1', String(sv.적));
ok('★ 같은 모둠 아이는 안 맞는다', sv.같은모둠===null);
ok('★ 목숨을 다 쓴 아이는 안 맞는다', sv.죽은아이===null);
ok('★ 두 방에 한 목숨, 여섯 방이면 끝 — 그 뒤엔 더 안 깎인다',
   sv.맞음[1][1]===2 && sv.맞음[3][1]===1 && sv.맞음[5][1]===0 && sv.맞음[5][2]===true && sv.더맞음===0, JSON.stringify(sv.맞음));
ok('★ 남은 목숨 합계로 순위, 같으면 맞힌 수 (3모둠 3목숨 9맞힘 > 2모둠 3목숨 4맞힘 > 4모둠 1목숨 > 나 0)',
   sv.순위.rank[0]===3 && sv.순위.rank[1]===2 && sv.순위.rank[2]===4, JSON.stringify(sv.순위.rank));
ok('★ 끝나면 총을 내리고 땅으로 돌아온다', sv.끝.ph==='day' && !sv.끝.aiming && !sv.순위.aiming, JSON.stringify(sv.끝));
ok('★ 연습용 총은 가게에 안 나온다', !/연습용/.test(sv.가게), sv.가게);

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
