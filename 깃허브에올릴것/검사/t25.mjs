/* 21차 검사 — 서바이벌: 목숨 하나 · 전광판(사람별 피해) · 이긴 모둠 하나만 상
   ★ 값을 검사에 베끼지 않는다. 체력·피해·전광판 칸 수는 게임의 __MINI() 에 묻는다.
   ★ '한 번 쓰러지면 끝' 은 규칙이 아니라 **여러 길로 새는 것**이라, 새는 길을 하나씩 막아 본다:
     다시 맞기 · 혼자 일어나기 · 되살아나기 · 마을로 나갈 때 누운 채 나가기. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12700);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1100,height:760}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1600);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
const ev = f => pg.evaluate(f);

const enter = ()=> ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL;
  G.paused = false; W.__goMini(2);
  for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
  G.mini.st = 'run'; G.paused = true;
  const MI = W.__MINE; MI.hp = M.HP; MI.out = false; MI.dm = 0; MI.k = 0; MI.rs = 0;
  PL.down = false; PL.downT = 0;
  W.__miniPl.clear(); W.__miniReport(true);
  return true;
});

/* ═══════ ① 목숨 하나 — 새는 길을 하나씩 막아 본다 ═══════ */
await enter();
const one = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI(), MI=W.__MINE, o={};
  const need = Math.ceil(M.HP / M.DMG);
  o.몸통몇방 = need;
  for(let i=0;i<need-1;i++) W.__survHit('x','친구',1, M.DMG, false);
  o.한방남음 = {hp:MI.hp, out:MI.out, down:PL.down};
  W.__survHit('x','친구',1, M.DMG, false);
  o.쓰러짐 = {hp:MI.hp, out:MI.out, down:PL.down, aiming:document.body.classList.contains('aiming')};
  /* ② 쓰러진 뒤에 또 맞아도 아무 일도 안 난다 */
  const hp0 = MI.hp;
  W.__survHit('x','친구',1, M.HEAD, true);
  o.또맞음 = MI.hp - hp0;
  /* ③ 혼자 일어나기 시계가 안 돈다 — 마을에서는 24초면 일어난다 */
  G.paused = false;
  for(let i=0;i<Math.ceil((M.ROPE)*30);i++) W.__downTick(1/30);   // 60초어치
  o.혼자일어남 = !PL.down ? '일어났다' : '그대로 누움';
  o.누운시간 = +(PL.downT||0).toFixed(1);
  G.paused = true;
  /* ④ 못 움직인다 */
  const x0 = PL.x, z0 = PL.z;
  W.__KEY['w'] = true; for(let i=0;i<30;i++) W.__updPlayer(1/60); W.__KEY['w'] = false;
  o.움직임 = +Math.hypot(PL.x-x0, PL.z-z0).toFixed(2);
  /* ⑤ 마을로 나가면 일어난다 */
  W.__miniExit();
  o.나간뒤 = {down:PL.down, hp:PL.hp, ph:G.phase};
  return o;
});
ok('★ 몸통 몇 방이면 쓰러지는지 (한 방에 반이 날아가면 맞은 줄도 모른다)',
   one.몸통몇방 >= 4, '몸통 '+one.몸통몇방+'방');
ok('한 방 남았을 때는 아직 서 있다',
   !one.한방남음.out && !one.한방남음.down, JSON.stringify(one.한방남음));
ok('★ 21차 — 체력을 다 깎이면 그 판은 끝이다 (목숨이 하나)', one.쓰러짐.out === true);
ok('★ 쓰러지면 아침에 쓰러졌을 때처럼 시체로 눕는다', one.쓰러짐.down === true);
ok('★ 쓰러지면 총을 내린다 (조준 모드가 꺼진다)', one.쓰러짐.aiming === false);
ok('★ 쓰러진 뒤에는 더 안 깎인다', one.또맞음 === 0);
ok('★ 미니게임에서는 혼자 일어나지 않는다 (마을 시계가 그대로 돌면 24초 뒤 되살아난다)',
   one.혼자일어남 === '그대로 누움', one.혼자일어남+' · 누운 시간 '+one.누운시간+'초');
ok('★ 쓰러진 아이는 못 움직인다 (시체로 끝이다)', one.움직임 < 0.05, one.움직임+'칸 움직임');
ok('★ 마을로 돌아오면 멀쩡히 일어난다 (미니게임의 죽음은 그 판에서만)',
   one.나간뒤.down === false && one.나간뒤.hp > 0 && one.나간뒤.ph === 'day',
   JSON.stringify(one.나간뒤));

/* ═══════ ② 준 피해가 쌓이고 통신에 실린다 ═══════ */
await enter();
const dmg = await ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), MI=W.__MINE, o={};
  o.처음 = MI.dm|0;
  /* 쏘는 길을 통째로 굴리는 대신, 게임이 세는 칸을 직접 본다 */
  MI.dm = 0; MI.dm += M.DMG; MI.dm += M.HEAD;
  W.__miniReport(true);
  const mine = W.__miniPl.get(W.__uid);
  o.보냄 = {dm:mine.dm, o:mine.o};
  o.기대 = M.DMG + M.HEAD;
  /* 쓰러지면 o 칸이 1 이 된다 */
  MI.out = true; W.__miniReport(true);
  o.쓰러진뒤 = W.__miniPl.get(W.__uid).o;
  return o;
});
ok('처음에는 넣은 피해가 0 이다', dmg.처음 === 0);
ok('★ 내가 넣은 피해가 pc 통로가 아니라 mini 통로로 나간다 (전광판이 읽는 칸)',
   dmg.보냄.dm === dmg.기대, dmg.보냄.dm+' / '+dmg.기대);
ok('★ 쓰러졌는지도 같이 나간다', dmg.쓰러진뒤 === 1);

/* ═══════ ③ 전광판 — 사람별, 피해 많은 순 ═══════ */
const board = await ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), o={};
  W.__miniPl.clear(); W.__MINE.dm = 55; W.__MINE.out = false;
  W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', dm:55, o:0});
  W.__miniPl.set('a', {g:1, n:'가', dm:120, o:1});
  W.__miniPl.set('b', {g:2, n:'나', dm:80,  o:0});
  W.__miniPl.set('c', {g:3, n:'다', dm:10,  o:0});
  W.__miniPl.set('d', {g:4, n:'라', dm:0,   o:0});
  const top = W.__survTop();
  o.순서 = top.map(p=>p.n);
  o.칸 = M.BOARD;
  const html = W.__survPodium(top);
  o.글 = html;
  o.보여준수 = (html.match(/<span/g)||[]).length;
  o.죽은표시 = /💀가/.test(html);
  o.빈칸 = W.__survPodium([]);
  /* 살아 있는 사람 · 모둠별 피해 합계 */
  o.살아있음 = W.__survAlive().map(a=>a.n).sort();
  o.모둠합 = W.__survScores();
  return o;
});
ok('★ 전광판은 피해 많이 넣은 사람 순서다', board.순서[0]==='가' && board.순서[1]==='나' && board.순서[2]==='김하늘',
   board.순서.join(' > '));
ok('★ 전광판은 넷까지만 보여 준다 (스물한 명을 다 띄우면 화면을 덮는다)',
   board.보여준수 === Math.min(board.칸, 4), board.보여준수+'명 (칸 '+board.칸+')');
ok('★ 피해가 0 인 아이는 전광판에 안 뜬다 (0 이 줄줄이 뜨면 뜻이 없다)',
   !/라/.test(board.글), board.글.replace(/<[^>]*>/g,'|'));
ok('★ 쓰러진 사람은 이름 앞에 💀 가 붙는다 (살아 있는 사람과 눈으로 갈려야 한다)', board.죽은표시);
ok('아무도 못 맞혔으면 그렇다고 알려 준다', /아직/.test(board.빈칸), board.빈칸.replace(/<[^>]*>/g,''));
ok('★ 쓰러진 사람은 "살아 있는 사람" 에서 빠진다',
   board.살아있음.join(',') === '김하늘,나,다,라', board.살아있음.join(','));
ok('모둠별 피해 합계도 낸다', board.모둠합[1] === 120 && board.모둠합[2] === 80,
   JSON.stringify(board.모둠합));

/* ═══════ ④ 이긴 모둠 하나만 상 ═══════ */
const win = await ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), o={};
  const set = (rows)=>{ W.__miniPl.clear();
    for(const r of rows) W.__miniPl.set(r.k, {g:r.g, n:r.n, dm:r.dm, o:r.o});
    W.__MINE.out = true; W.__MINE.dm = 0;
    W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', dm:0, o:1}); };
  /* ① 한 명만 살아 있으면 그 아이 모둠 */
  set([{k:'a',g:1,n:'가',dm:200,o:1},{k:'b',g:3,n:'나',dm:10,o:0}]);
  o.마지막한명 = W.__survWinner();
  /* ② 여럿 살아 있으면 그중 피해를 제일 많이 넣은 사람의 모둠 */
  set([{k:'a',g:1,n:'가',dm:200,o:0},{k:'b',g:3,n:'나',dm:10,o:0}]);
  o.여럿 = W.__survWinner();
  /* ③ 다 쓰러졌으면 그 판에서 제일 많이 넣은 사람의 모둠 */
  set([{k:'a',g:1,n:'가',dm:200,o:1},{k:'b',g:3,n:'나',dm:10,o:1}]);
  o.전멸 = W.__survWinner();
  return o;
});
ok('★ 마지막까지 살아남은 사람의 모둠이 이긴다', win.마지막한명 === 3, (win.마지막한명+1)+'모둠');
ok('★ 시간이 다 됐는데 여럿 남으면 그중 피해를 제일 많이 넣은 사람의 모둠 (숨어만 있으면 안 되게)',
   win.여럿 === 1, (win.여럿+1)+'모둠');
ok('다 쓰러졌으면 그 판에서 제일 많이 넣은 사람의 모둠', win.전멸 === 1, (win.전멸+1)+'모둠');

/* 실제로 상을 받나 — 이긴 모둠만 자원이 는다 */
const prize = await ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), o={};
  const run = (myWin)=>{
    G.paused = false; W.__goMini(2);
    for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
    G.mini.st = 'run'; G.paused = true;
    W.__MINE.out = true; W.__MINE.dm = 0; W.__PL.down = true;
    W.__miniPl.clear();
    W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', dm:0, o:1});
    /* 이기게 하려면 내 모둠 아이가 살아 있게, 지게 하려면 남의 모둠 아이가 살아 있게 */
    W.__miniPl.set('z', {g: myWin ? G.me.g : (G.me.g+1)%5, n:'짝', dm:30, o:0});
    const w0 = W.__myRes().w, s0 = W.__myRes().s, g0 = W.__myRes().g;
    G.paused = false; W.__miniFinish(); G.paused = true;
    W.__miniOnState && W.__miniOnState();
    return {win:G.mini.win, dw:W.__myRes().w-w0, ds:W.__myRes().s-s0, dg:W.__myRes().g-g0};
  };
  o.이겼을때 = run(true);
  W.__miniExit();
  o.졌을때 = run(false);
  W.__miniExit();
  o.상 = M.PRIZE[0];
  return o;
});
ok('★ 이긴 모둠은 1등 상을 받는다',
   prize.이겼을때.dw === prize.상.w && prize.이겼을때.ds === prize.상.s && prize.이겼을때.dg === prize.상.g,
   JSON.stringify(prize.이겼을때));
ok('★ 진 모둠은 빈손이다 (등수를 나눠 주지 않는다)',
   prize.졌을때.dw === 0 && prize.졌을때.ds === 0 && prize.졌을때.dg === 0,
   JSON.stringify(prize.졌을때));

/* ═══════ ⑤ 한 사람(또는 한 모둠)만 남으면 일찍 끝난다 ═══════ */
const early = await ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), o={};
  const run = (rows)=>{
    G.paused = false; W.__goMini(2);
    for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
    G.mini.st = 'run';
    W.__miniPl.clear();
    W.__MINE.out = true; W.__PL.down = true; W.__MINE.dm = 0;
    W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', dm:0, o:1});
    for(const r of rows) W.__miniPl.set(r.k, {g:r.g, n:r.n, dm:r.dm, o:r.o});
    W.__hostMini(0.05);
    const st = G.mini.st;
    G.paused = true; W.__miniExit();
    return st;
  };
  o.둘남음 = run([{k:'a',g:1,n:'가',dm:10,o:0},{k:'b',g:2,n:'나',dm:10,o:0},{k:'c',g:3,n:'다',dm:5,o:1}]);
  o.한명남음 = run([{k:'a',g:1,n:'가',dm:10,o:0},{k:'b',g:2,n:'나',dm:10,o:1}]);
  o.한모둠만 = run([{k:'a',g:1,n:'가',dm:10,o:0},{k:'b',g:1,n:'나',dm:10,o:0},{k:'c',g:2,n:'다',dm:5,o:1}]);
  return o;
});
ok('두 모둠이 남아 있으면 계속한다', early.둘남음 === 'run', early.둘남음);
ok('★ 한 사람만 남으면 판이 일찍 끝난다 (혼자 3분을 돌아다니게 두지 않는다)',
   early.한명남음 === 'done', early.한명남음);
ok('★ 한 모둠만 남아도 일찍 끝난다', early.한모둠만 === 'done', early.한모둠만);

/* ═══════ ⑥ 목숨 관련 옛 장치가 남아 있지 않다 ═══════ */
const gone = await ev(()=>{
  const W=window, M=W.__MINI();
  return {LIVES:M.LIVES, respawn:typeof W.__survRespawn, board:M.BOARD, hp:M.HP};
});
ok('★ 목숨 상수가 사라졌다 (남아 있으면 어딘가는 아직 목숨으로 센다)',
   gone.LIVES === undefined, String(gone.LIVES));
ok('★ 되살아나는 장치가 사라졌다', gone.respawn === 'undefined', gone.respawn);
ok('전광판 칸 수와 체력은 게임에서 읽어 온다', gone.board > 0 && gone.hp > 0,
   '전광판 '+gone.board+'칸 · 체력 '+gone.hp);

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
