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
const NG_ = await ev(()=>window.__G.res.length);
await ev((n)=>{ window.NG_ = n; }, NG_);

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
  /* 3번: 틀린다 — 아무것도 못 받는다.
     같이 볼 것 ① 어느 우리에도 안 들어간 아이는 무조건 오답이고 몇 명인지 센다
              ② 남은 5초면 화면이 비상으로 빨갛게 깜빡인다 */
  W.__step((M.RSEC+1)*30, 1/30);
  const r2 = {...G.res[G.me.g]};
  W.__oxAsk('돌은 나무보다 가볍다', 'X'); PL.x = -M.OX; PL.z = M.OZ; W.__miniTick(0.05);
  G.players.set('n1', {uid:'n1', x:0, y:M.Y, z:M.OZ, g:1, n:'우리밖'});   // 두 우리 사이 — 아무 데도 아니다
  G.players.set('c1', {uid:'c1', x:M.OX, y:M.Y, z:M.OZ, g:2, n:'맞힌아이'});
  o.밖자리 = W.__oxZoneOf(0, M.OZ);
  o.내점수전 = G.mini.sc[G.me.g];
  /* 남은 시간을 경고선까지 줄여 보고 화면을 다시 칠한다 */
  G.t = M.WARN - 0.5; W.__updDanger();
  o.비상 = document.getElementById('danger').classList.contains('urgent');
  G.t = M.QSEC; W.__updDanger();        /* 원래 남은 시간으로 되돌려 놓고 이어 간다 */
  o.아직 = document.getElementById('danger').classList.contains('urgent');
  W.__step((M.QSEC+1)*30, 1/30); W.__miniTick(0.05);
  o.틀림 = {ok:G.mini.rv.ok.length, got:G.res[G.me.g].w - r2.w,
           내점수:G.mini.sc[G.me.g] - o.내점수전,
           none:G.mini.rv.none, o:G.mini.rv.o, x:G.mini.rv.x};
  G.players.clear();
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
ok('★ 틀리면 아무것도 못 받는다 (내 점수도 안 오른다)',
   ox.틀림.내점수===0 && ox.틀림.got===0, JSON.stringify(ox.틀림));
ok('★ 두 우리 사이는 어느 쪽도 아니다', ox.밖자리==='', '"'+ox.밖자리+'"');
ok('★ 우리에 안 들어간 아이는 무조건 오답이고, 몇 명인지 세어 보여 준다 (가만히 서 있는 게 이득이면 안 걷는다)',
   ox.틀림.none===1 && ox.틀림.ok===1 && ox.틀림.o===1 && ox.틀림.x===1, JSON.stringify(ox.틀림));
ok('★ 남은 5초면 화면이 비상으로 빨갛게 깜빡인다 (그 전엔 안 깜빡인다)',
   ox.비상 === true && ox.아직 === false, '5초 '+ox.비상+' · 그 전 '+ox.아직);
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
/* 줄이 부드러운가 — 점 사이 꺾임, 마디가 눕는 방향, 이웃과 겹치는 정도 */
rope.곡선 = await ev(()=>{
  const W=window, M=W.__MINI(), SEG=M.SEG, ph=1.1, pts=[];
  for(let i=0;i<=SEG;i++) pts.push(W.__ropePt(0, i/SEG, ph));
  let maxAng=0;
  for(let i=1;i<SEG;i++){
    const a=pts[i-1], b=pts[i], c=pts[i+1];
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
    const lu=Math.hypot(u[0],u[1],u[2]), lv=Math.hypot(v[0],v[1],v[2]);
    const cos=(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(lu*lv);
    maxAng=Math.max(maxAng, Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI);
  }
  /* 실제로 그려진 마디를 행렬만 보고 잰다 — 로컬 +Z 축(3열)이 이웃 마디로 가는
     방향과 맞나, 그리고 그 길이가 마디 사이 간격보다 기나(겹침).
     ★ 점 함수(__ropePt)와 맞대면 안 된다. 화면에 그려진 줄은 '지금 이 순간의 각도' 로
       그려져 있어서, 검사가 고른 각도와 다르면 멀쩡한 줄도 어긋난 것으로 나온다. */
  const R=W.__R_rope(), arr=R.instanceMatrix.array;
  let maxOff=0, minOv=1e9;
  for(let i=0;i<SEG-1;i++){
    const o=i*16, zx=arr[o+8], zy=arr[o+9], zz=arr[o+10];
    const len=Math.hypot(zx,zy,zz);
    const dx=arr[o+16+12]-arr[o+12], dy=arr[o+16+13]-arr[o+13], dz=arr[o+16+14]-arr[o+14];
    const ld=Math.hypot(dx,dy,dz);
    const cos=Math.abs((zx*dx+zy*dy+zz*dz)/(len*ld));
    maxOff=Math.max(maxOff, Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI);
    minOv=Math.min(minOv, len/ld);
  }
  return {마디:SEG, 최대꺾임:+maxAng.toFixed(1), 최대어긋남:+maxOff.toFixed(1), 겹침:+minOv.toFixed(2)};
});
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
ok('★ 줄이 부드러운 곡선이다 — 마디끼리 꺾이는 각이 작다',
   rope.곡선.최대꺾임 < 12 && rope.곡선.마디 >= 40,
   '마디 '+rope.곡선.마디+'개 · 이웃끼리 최대 '+rope.곡선.최대꺾임+'도');
ok('★ 마디가 줄이 가는 쪽으로 눕는다 (축에 나란한 상자를 늘어놓으면 구슬 목걸이가 된다)',
   rope.곡선.최대어긋남 < 6, '마디 방향이 곡선과 최대 '+rope.곡선.최대어긋남+'도 어긋난다');
ok('★ 마디가 이웃과 겹친다 — 겹쳐야 이음매가 안 보인다',
   rope.곡선.겹침 > 1.1, '길이 ÷ 간격 = '+rope.곡선.겹침);
ok('★ 모둠 점수는 모둠원 평균이고, 많이 넘은 모둠이 1등이다', rope.순위.sc[1]===10 && rope.순위.sc[2]===30 && rope.순위.rank[0]===2 && rope.순위.rank[1]===0,
   'sc '+JSON.stringify(rope.순위.sc)+' rank '+JSON.stringify(rope.순위.rank));
ok('★ 순위대로 상을 받는다 (2등 = 두 번째 상)', rope.순위.상.w===rope.순위.PRIZE[1].w && rope.순위.상.g===rope.순위.PRIZE[1].g, JSON.stringify(rope.순위.상));
ok('★ 꼴찌도 빈손은 아니다', rope.순위.PRIZE[4].w > 0 && rope.순위.PRIZE[4].g > 0, JSON.stringify(rope.순위.PRIZE[4]));

/* ═══════ ⑥ 서바이벌 ═══════ */
const sv = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  W.__goMini(2); W.__step((M.INTRO+1)*30, 1/30); W.__miniTick(0.05); G.paused = true;
  W.__syncMyPC(); o.시작 = {st:G.mini.st, aiming:document.body.classList.contains('aiming'), wp:W.__myPC().wp, gun:M.GUN};
  /* 조준 — 앞에 선 다른 모둠 아이는 맞고, 같은 모둠·목숨 다 쓴 아이는 안 맞는다.
     ★ 자리를 숫자로 박지 않는다. 지형이 바뀌면 그 자리가 대(臺) 속이 되어
       "총알이 지형에 막혀서" 조준이 안 되는데, 검사는 조준 기능이 깨진 줄 안다.
       스폰에서 가운데로 가는 길 위에서 '트인 두 점' 을 게임에 물어서 쓴다. */
  const sp0 = W.__miniSpawnXZ(0), pick = t => [sp0[0]*(1-t), sp0[1]*(1-t)];
  let A = null, B = null;
  for(let t=0.02; t<0.5 && !A; t+=0.02){ const c = pick(t); if(W.__survTopAt(c[0],c[1]) === 0) A = c; }
  for(let t=0.26; t<0.75 && !B; t+=0.02){ const c = pick(t);
    if(W.__survTopAt(c[0],c[1]) === 0 && !W.__survBlocked(A[0], M.Y+1.12, A[1], c[0], M.Y+0.9, c[1])) B = c; }
  o.자리 = {나:A.map(v=>+v.toFixed(1)), 적:B.map(v=>+v.toFixed(1))};
  PL.x = A[0]; PL.z = A[1]; PL.y = M.Y; PL.pitch = 0;
  /* 플레이어의 앞은 (−sin yaw, −cos yaw) 다 (양 그리기 주석 참고) */
  PL.yaw = Math.atan2(-(B[0]-A[0]), -(B[1]-A[1]));
  W.__updPlayer(1/30);     /* ★ 카메라 방향은 updPlayer 가 잡는다 — yaw 만 바꾸고 바로 재면 예전 방향을 본다 */
  const put = (id,g)=>{ G.players.set(id,{uid:id,x:B[0],y:M.Y,z:B[1],g,n:id,ry:0,jt:0}); };
  put('e1', (G.me.g+1)%5); o.적 = W.__aimPlayer() && W.__aimPlayer().uid;
  G.players.clear(); put('f1', G.me.g); o.같은모둠 = W.__aimPlayer();
  G.players.clear(); put('e2', (G.me.g+1)%5); W.__miniPl.set('e2',{g:(G.me.g+1)%5,n:'e2',l:0,k:0}); o.죽은아이 = W.__aimPlayer();
  G.players.clear(); W.__miniPl.delete('e2');
  /* 머리 판정 — 위를 겨누면 머리, 몸을 겨누면 몸통. 그리고 머리 창이 조준 창보다 좁아야
     '헤드샷' 이 실력이 된다(가까이서 배를 쏴도 머리로 잡히면 두 배가 공짜다). */
  const tgt = {uid:'h1', x:B[0], y:M.Y, z:B[1], g:(G.me.g+1)%5, n:'h1', ry:0, jt:0};
  G.players.set('h1', tgt);
  let nAim=0, nHead=0, headLo=null, headHi=null, bodyOK=false;
  for(let pit=-0.6; pit<=0.6; pit+=0.01){
    PL.pitch = pit; W.__updPlayer(1/30);
    const t = W.__aimPlayer(); if(!t) continue;
    nAim++;
    if(W.__survAimPart(t).head){ nHead++; if(headLo===null) headLo=pit; headHi=pit; }
    else bodyOK = true;
  }
  o.머리창 = {조준칸:nAim, 머리칸:nHead, 몸통도있음:bodyOK,
             비율:+(nHead/Math.max(1,nAim)).toFixed(2)};
  /* 머리 점을 정확히 겨누면 머리, 몸통 점을 겨누면 몸통 */
  const eye = ()=> [PL.x, PL.y + PL.EYE, PL.z];
  const look = (p)=>{ const e = eye();
    PL.yaw = Math.atan2(-(p[0]-e[0]), -(p[2]-e[2]));
    PL.pitch = Math.atan2(p[1]-e[1], Math.hypot(p[0]-e[0], p[2]-e[2]));
    W.__updPlayer(1/30); };
  look(W.__survHeadPos(tgt)); o.머리겨눔 = W.__survAimPart(tgt).head;
  look(W.__survBodyPos(tgt)); o.몸통겨눔 = W.__survAimPart(tgt).head;
  o.머리높이 = +(W.__survHeadPos(tgt)[1] - W.__survBodyPos(tgt)[1]).toFixed(2);
  G.players.clear();
  PL.pitch = 0; PL.yaw = Math.atan2(-(B[0]-A[0]), -(B[1]-A[1])); W.__updPlayer(1/30);
  /* 맞기 — 몸통 몇 방에 한 목숨인지는 게임에서 읽는다(체력 ÷ 몸통 피해) */
  const perLife = Math.ceil(M.HP / M.DMG);
  o.한목숨 = perLife;
  const seq=[]; for(let i=0;i<perLife*M.LIVES;i++){
    W.__survHit('x','친구',1, M.DMG, false); seq.push([W.__MINE.hp, W.__MINE.l, W.__MINE.out]); W.__MINE.rs = 0; }
  o.한방 = seq[0]; o.첫목숨끝 = seq[perLife-1]; o.끝맞음 = seq[seq.length-1];
  o.더맞음 = (W.__survHit('x','친구',1, M.DMG, false), W.__MINE.l);
  /* 머리는 몸통의 두 배로 깎인다 */
  W.__MINE.out = false; W.__MINE.l = M.LIVES; W.__MINE.hp = M.HP; W.__MINE.rs = 0;
  W.__survHit('x','친구',1, M.HEAD, true);  o.머리깎임 = M.HP - W.__MINE.hp;
  W.__MINE.hp = M.HP; W.__MINE.rs = 0;
  W.__survHit('x','친구',1, M.DMG, false);  o.몸통깎임 = M.HP - W.__MINE.hp;
  /* ★ 우르르 맞기 — 예전엔 맞은 아이마다 칸이 하나여서 두 명이 동시에 쏘면
     한 발만 들어갔다. 이제 쏜 아이마다 칸이 따로다: 한 번에 다 들어가야 한다. */
  W.__MINE.out = false; W.__MINE.l = M.LIVES; W.__MINE.hp = M.HP; W.__MINE.rs = 0;
  const hp0 = W.__MINE.hp;
  o.동시 = W.__applyHitNode({
    a:{n:1, t:M.DMG,  d:M.DMG,  bn:'가', bg:1, h:0},
    b:{n:1, t:M.DMG,  d:M.DMG,  bn:'나', bg:2, h:0},
    c:{n:1, t:M.HEAD, d:M.HEAD, bn:'다', bg:3, h:1}});
  o.동시깎임 = hp0 - W.__MINE.hp;
  o.동시기대 = M.DMG*2 + M.HEAD;
  /* 같은 것이 한 번 더 오면 안 깎인다 (번호가 같다) */
  W.__applyHitNode({a:{n:1, t:M.DMG, d:M.DMG, bn:'가', bg:1, h:0}});
  o.두번받음 = hp0 - W.__MINE.hp;
  /* 한 아이가 연달아 쏜 두 발이 한 번에 뭉쳐 와도 두 발만큼 깎인다 */
  const hp1 = W.__MINE.hp;
  W.__applyHitNode({a:{n:3, t:M.DMG*3, d:M.DMG, bn:'가', bg:1, h:0}});
  o.뭉침깎임 = hp1 - W.__MINE.hp; o.DMG = M.DMG;
  W.__MINE.hp = 0; W.__MINE.l = 0; W.__MINE.out = true; W.__MINE.rs = 0;
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
ok('★ 한 방에 조금씩 깎인다 (한 방에 반이 날아가면 맞은 줄도 모르고 죽는다)',
   sv.한목숨 >= 4 && sv.한방[1] === 3, '한 목숨에 몸통 '+sv.한목숨+'방 · 첫 방 뒤 체력 '+sv.한방[0]);
ok('★ 몸통으로 체력을 다 깎으면 목숨 하나가 준다', sv.첫목숨끝[1] === 2,
   '몸통 '+sv.한목숨+'방 뒤 → '+JSON.stringify(sv.첫목숨끝));
ok('★ 목숨을 다 쓰면 구경만 하고, 그 뒤엔 더 안 깎인다',
   sv.끝맞음[1] === 0 && sv.끝맞음[2] === true && sv.더맞음 === 0, JSON.stringify(sv.끝맞음));
ok('★ 머리를 맞으면 몸통의 두 배로 깎인다', sv.머리깎임 === sv.몸통깎임*2,
   '머리 '+sv.머리깎임+' · 몸통 '+sv.몸통깎임);
ok('★ 머리 점을 겨누면 머리, 몸통 점을 겨누면 몸통으로 잡힌다',
   sv.머리겨눔 === true && sv.몸통겨눔 === false,
   '머리 겨눔 '+sv.머리겨눔+' · 몸통 겨눔 '+sv.몸통겨눔+' (머리가 몸통보다 '+sv.머리높이+'칸 위)');
ok('★ 여럿이 동시에 쏘면 전부 다 맞는다 (예전엔 칸이 하나라 한 발만 들어갔다)',
   sv.동시 === 3 && sv.동시깎임 === sv.동시기대,
   sv.동시+'명분 · '+sv.동시깎임+' 깎임 (기대 '+sv.동시기대+')');
ok('★ 같은 것이 두 번 와도 한 번만 깎인다', sv.두번받음 === sv.동시깎임,
   '두 번 받은 뒤 '+sv.두번받음);
ok('★ 한 아이가 연달아 쏜 두 발이 뭉쳐 와도 두 발만큼 다 깎인다 (누적 합계로 세기 때문)',
   sv.뭉침깎임 === sv.DMG*2, sv.뭉침깎임+' (한 방 '+sv.DMG+' × 2)');
ok('★ 머리 창이 조준 창보다 훨씬 좁다 — 헤드샷이 공짜가 아니다',
   sv.머리창.머리칸 > 0 && sv.머리창.몸통도있음 && sv.머리창.비율 < 0.4,
   '조준되는 각 '+sv.머리창.조준칸+'칸 중 머리 '+sv.머리창.머리칸+'칸 ('+Math.round(sv.머리창.비율*100)+'%)');
ok('★ 조준은 지형이 트인 자리에서 잰다 (대 속에서 재면 늘 막힌다)',
   sv.자리 && sv.자리.나 && sv.자리.적, JSON.stringify(sv.자리));
ok('★ 남은 목숨 합계로 순위, 같으면 맞힌 수 (3모둠 3목숨 9맞힘 > 2모둠 3목숨 4맞힘 > 4모둠 1목숨 > 나 0)',
   sv.순위.rank[0]===3 && sv.순위.rank[1]===2 && sv.순위.rank[2]===4, JSON.stringify(sv.순위.rank));
ok('★ 끝나면 총을 내리고 땅으로 돌아온다', sv.끝.ph==='day' && !sv.끝.aiming && !sv.순위.aiming, JSON.stringify(sv.끝));
ok('★ 연습용 총은 가게에 안 나온다', !/연습용/.test(sv.가게), sv.가게);

/* ═══════ ⑥-2 소리와 판정 연출 ═══════
   ★ 서바이벌 총은 snd:'musket' 인데 소리 표에 musket 이 없어서 내내 조용했다.
     sfx() 는 없는 이름이면 조용히 아무것도 안 한다 — 그래서 아무도 못 알아챘다.
     이름 하나가 아니라 '무기가 부르는 소리가 전부 표에 있나' 를 본다. */
const snd = await ev(()=>{
  const W=window, o={};
  const keys = W.__SFX_KEYS();
  o.빠진소리 = W.__WEAPONS.filter(w=>w.snd && !keys.includes(w.snd)).map(w=>w.n+':'+w.snd);
  o.무기수 = W.__WEAPONS.length;
  o.있음 = ['musket','phit','phead','trip','hurt','gun'].filter(k=>keys.includes(k));
  o.줄딩 = typeof W.__sfxJump === 'function';
  /* 판정 — 맞았을 때 초록, 틀렸을 때 빨강 */
  W.__verdict(true, '🎉', '정답!');
  const v = document.getElementById('verdict');
  o.맞음판정 = {on:v.classList.contains('on'), good:v.classList.contains('good'),
               글:v.textContent};
  W.__verdict(false, '❌', '땡!');
  o.틀림판정 = {on:v.classList.contains('on'), bad:v.classList.contains('bad')};
  W.__verdict(true, '⭐', '5번!', {quick:true});
  o.짧은판정 = v.classList.contains('quick');
  /* 초록 번쩍이 실제로 켜진다 */
  W.__goodFlash(60);
  o.초록번쩍 = +document.getElementById('goodFlash').style.opacity;
  return o;
});
ok('★ 무기가 부르는 소리가 전부 소리 표에 있다 (없는 이름은 조용히 아무것도 안 한다)',
   snd.빠진소리.length === 0, snd.무기수+'자루 중 빠진 것: '+(snd.빠진소리.join(' ')||'없음'));
ok('★ 미니게임에 필요한 소리가 다 있다 (총·맞힘·헤드샷·걸림)',
   snd.있음.length === 6, snd.있음.join(' '));
ok('★ 줄을 넘을 때마다 높아지는 딩이 있다', snd.줄딩);
ok('★ 맞히면 한가운데에 초록 판정이 크게 뜬다',
   snd.맞음판정.on && snd.맞음판정.good && /정답/.test(snd.맞음판정.글), JSON.stringify(snd.맞음판정));
ok('★ 틀리면 한가운데에 빨간 판정이 크게 뜬다',
   snd.틀림판정.on && snd.틀림판정.bad, JSON.stringify(snd.틀림판정));
ok('★ 줄넘기처럼 자주 뜨는 것은 작은 판정으로 뜬다 (매번 화면을 가리면 판이 안 보인다)', snd.짧은판정);
ok('★ 잘했을 때의 초록 번쩍이 켜진다', snd.초록번쩍 === 1, String(snd.초록번쩍));

/* ═══════ ⑦ 서바이벌 지형 — 높은 자리 · 가림벽 · 상자 ═══════
   ★ 판판한 바닥에 똑같은 기둥만 세우면 FPS 가 아니라 '서로 마주 보고 쏘기' 가 된다.
     눈에 보이는 것과 발·총알이 보는 것이 같은 표에서 나오는지도 같이 본다. */
const arena = await ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), o={};
  W.__goMini(2); G.paused = true;
  o.모양 = {상자:W.__SURV_BOX().length, 단:W.__SURV_CYL().length};
  /* ★ 아래단을 (0,5) 로 박아 뒀더니 섬을 넓히면서 위 단이 거기까지 와서
     '가운데와 아래단이 같다' 며 빨개졌다. 두 단의 반지름을 표에서 읽어 그 사이를 잰다. */
  const CY = W.__SURV_CYL();
  const rHi = Math.min(...CY.map(c=>c.r)), rLo = Math.max(...CY.map(c=>c.r));
  o.단반지름 = [rHi, rLo];
  o.높이 = {가운데:W.__survTopAt(0,0), 아래단:W.__survTopAt(0,(rHi+rLo)/2), 밖:W.__survTopAt(0,-(M.R-3))};
  /* 스폰 다섯이 고리로 흩어지고, 전부 평지에서 시작한다 */
  const sp=[]; for(let g=0;g<NG_;g++){ const q=W.__miniSpawnXZ(g); sp.push(q); }
  o.스폰평지 = sp.every(q=>W.__survTopAt(q[0],q[1]) === 0);
  o.스폰반지름 = sp.map(q=>+Math.hypot(q[0],q[1]).toFixed(1));
  let near=1e9; for(let i=0;i<sp.length;i++) for(let j=i+1;j<sp.length;j++)
    near = Math.min(near, Math.hypot(sp[i][0]-sp[j][0], sp[i][1]-sp[j][1]));
  o.스폰사이 = +near.toFixed(1);
  /* 스폰에서 섬 한가운데를 보는 길이 벽으로 막혀 있지 않다 */
  o.앞이막힘 = sp.map(q=>{ let hit=false;
    for(let t=0.08;t<0.75;t+=0.06){ if(W.__survTopAt(q[0]*(1-t), q[1]*(1-t)) > 1.9) hit=true; }
    return hit; });
  /* 얼마나 넓은가 · 얼마나 덮여 있나 — '넓히기' 를 눈이 아니라 숫자로 잡아 둔다.
     넓기만 하고 텅 비면 벌판이고, 너무 덮이면 미로다. */
  let cov=0, tot=0;
  for(let x=-M.R; x<=M.R; x+=1) for(let z=-M.R; z<=M.R; z+=1){
    if(Math.hypot(x,z) > M.R-1) continue; tot++;
    if(W.__survTopAt(x,z) > 0) cov++;
  }
  o.넓이 = {칸:tot, 한사람:+(tot/21).toFixed(0), 덮인비율:+(cov/tot*100).toFixed(1)};
  /* 발이 실제로 지형 위에 선다 */
  o.발 = {가운데:+(W.__groundUnder(0,0,0.28)-M.Y).toFixed(1), 빈곳:+(W.__groundUnder(0,20,0.28)-M.Y).toFixed(1)};
  /* 총알 — 가림벽 뒤는 막히고 트인 데는 안 막힌다 */
  /* ★ 벽 자리도 표에서 읽는다 — 반지름을 박아 두면 지형을 손볼 때마다 빨개진다.
     가운데에 제일 가까운 높은 가림벽을 골라, 그 벽을 가로질러 쏴 본다. */
  const wall = W.__SURV_BOX().filter(b=>b.h > 2 && b.w > 3)
                 .sort((p,q)=>Math.hypot(p.x,p.z)-Math.hypot(q.x,q.z))[0];
  const wr = Math.hypot(wall.x, wall.z), ux = wall.x/wr, uz = wall.z/wr;
  o.벽자리 = +wr.toFixed(1);
  o.벽뒤 = W.__survBlocked(ux*(wr+3), M.Y+1.12, uz*(wr+3), ux*(wr-3), M.Y+0.9, uz*(wr-3));
  o.트인데 = W.__survBlocked(0, M.Y+2.9, 0, sp[0][0], M.Y+0.9, sp[0][1]);
  /* 얼굴 바꾸기 — 퀴즈 때는 지형이 없고 O·X 우리가 있다 */
  o.서바얼굴 = W.__miVis();
  W.__miniExit(); W.__goMini(0);
  o.퀴즈얼굴 = W.__miVis();
  o.퀴즈땅 = +(W.__groundUnder(0,0,0.28)-M.Y).toFixed(1);
  o.퀴즈스폰 = W.__miniSpawnXZ(0); o.출발선 = [M.padX(0), M.PADZ];
  o.조각 = {퀴즈:W.__miParts().quiz.length, 서바:W.__miParts().surv.length};
  W.__miniExit();
  return o;
});
ok('★ 지형이 실제로 있다 (가림벽·상자·두 단 대)', arena.모양.상자 >= 20 && arena.모양.단 === 2,
   '상자·벽 '+arena.모양.상자+'개 · 단 '+arena.모양.단+'층');
ok('★ 가운데가 높다 — 올라가면 넓게 보인다 (두 단)',
   arena.높이.가운데 > arena.높이.아래단 && arena.높이.아래단 > 0 && arena.높이.밖 === 0,
   '가운데 '+arena.높이.가운데+' · 아래단 '+arena.높이.아래단+' · 밖 '+arena.높이.밖
   +' (단 반지름 '+arena.단반지름.join('/')+')');
ok('★ 그 높이를 발이 실제로 밟는다 (눈에만 있는 지형이 아니다)',
   arena.발.가운데 === arena.높이.가운데 && arena.발.빈곳 === 0, JSON.stringify(arena.발));
ok('★ 다섯 모둠이 고리로 흩어져 시작한다 (한 줄로 서면 끝의 두 모둠만 불리하다)',
   arena.스폰사이 > 14 && arena.스폰반지름.every(r=>Math.abs(r-arena.스폰반지름[0]) < 0.1),
   '스폰 사이 '+arena.스폰사이+'칸 · 반지름 '+arena.스폰반지름.join('/'));
ok('★ 스물한 명이 붙어도 안 좁다 (한 사람 몫 100칸 이상)', arena.넓이.한사람 >= 100,
   '섬 '+arena.넓이.칸+'칸² · 한 사람 '+arena.넓이.한사람+'칸²');
ok('★ 넓지만 텅 비지 않았다 — 지형이 바닥의 10~35%를 덮는다',
   arena.넓이.덮인비율 >= 10 && arena.넓이.덮인비율 <= 35, arena.넓이.덮인비율+'%');
ok('★ 스폰은 평지고, 스폰에서 가운데로 가는 길이 벽으로 막혀 있지 않다',
   arena.스폰평지 && arena.앞이막힘.every(v=>!v), arena.앞이막힘.map(v=>v?'막힘':'열림').join(' '));
ok('★ 가림벽 뒤에 숨으면 총알이 막힌다 (엄폐물이 장식이 아니다)', arena.벽뒤);
ok('★ 트인 데서는 안 막힌다', !arena.트인데);
ok('★ 퀴즈·줄넘기 때는 지형을 걷고 O·X 우리를 켠다 (한 섬을 두 얼굴로 쓴다)',
   arena.서바얼굴 === 'surv' && arena.퀴즈얼굴 === 'quiz' && arena.퀴즈땅 === 0
   && arena.조각.퀴즈 > 50 && arena.조각.서바 > 50,
   '퀴즈 조각 '+arena.조각.퀴즈+' · 서바 조각 '+arena.조각.서바);
ok('★ 퀴즈 때 시작 자리는 한 줄 출발선이다',
   Math.abs(arena.퀴즈스폰[0] - arena.출발선[0]) < 0.1 && Math.abs(arena.퀴즈스폰[1] - arena.출발선[1]) < 0.1,
   JSON.stringify(arena.퀴즈스폰)+' = '+JSON.stringify(arena.출발선));

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
