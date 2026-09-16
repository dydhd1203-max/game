/* 18차 검사 — 하늘 섬 미니게임 (서바이벌 · 섬 · 자동 열림) · 건물값 20%  (37차: OX 퀴즈·줄넘기는 빠졌다 — 경주는 t37)
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
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
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
  o.DAYS = W.__MINI().DAYS; o.KIND = W.__MINI().KIND; return o; });
ok('★ 5일차 밤이 끝나면 장애물 경주(k=0)가 열린다 (37차)', auto.d5.ph==='mini' && auto.d5.k===0, JSON.stringify(auto.d5));
ok('★ 10일차는 서바이벌(k=1) · 15일차는 다시 경주 — 종류는 MINI_KIND 표', auto.d10.k===1 && auto.d15.k===0 && JSON.stringify(auto.KIND)==='[0,1,0]', auto.d10.k+' · '+auto.d15.k+' · '+JSON.stringify(auto.KIND));
ok('★ 다른 날은 그냥 아침이 온다', auto.d4.ph==='day' && auto.d4.day===5, JSON.stringify(auto.d4));

/* ═══════ ③ 하늘 섬 — 땅 · 가장자리 · 울타리 ═══════ */
const isle = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  W.__goMini(1); G.paused = true;                       /* 37차 — 섬 경계는 서바이벌에서 본다(경주는 섬 밖 발판으로 나간다) */
  o.높이 = +PL.y.toFixed(1); o.섬 = M.Y; o.바 = document.body.classList.contains('mini');
  o.자리 = [+PL.x.toFixed(1), +PL.z.toFixed(1)]; o.발판 = W.__miniSpawnXZ(G.me.g);
  /* 가장자리 밖으로 밀어 본다 */
  PL.x = M.R + 5; PL.z = 0; W.__updPlayer(1/30); o.밖 = +Math.hypot(PL.x, PL.z).toFixed(2); o.R = M.R;
  o.뱅크 = ['miFloor','miEdge','miMark','miGlow'].map(k=> !!W.__banks.get(k));
  return o; });
ok('★ 들어가면 하늘 섬 높이에 선다', isle.높이 === isle.섬, isle.높이+' = '+isle.섬);
ok('★ 우리 모둠 자리(서바이벌 고리 스폰)에서 시작한다', Math.abs(isle.자리[0]-isle.발판[0]) < 2.5 && Math.abs(isle.자리[1]-isle.발판[1]) < 2.5,
   JSON.stringify(isle.자리)+' ≈ '+JSON.stringify(isle.발판));
ok('★ 섬 밖으로 못 나간다 (떨어지면 그 판을 통째로 놓친다)', isle.밖 <= isle.R - 0.9, isle.밖+' ≤ '+(isle.R-1));
ok('★ 섬이 실제로 구워져 있다 (바닥·난간·표시·등불)', isle.뱅크.every(Boolean), isle.뱅크.join(' '));

/* ═══════ ④ 서바이벌 (37차: k=1) ═══════ */
const sv = await ev(()=>{ const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL, o={};
  G.paused = false; if(W.__miniOn()) W.__miniExit(); W.__goMini(1); W.__step((M.INTRO+1)*30, 1/30); W.__miniTick(0.05); G.paused = true;
  W.__syncMyPC(); o.시작 = {st:G.mini.st, aiming:document.body.classList.contains('aiming'), wp:W.__myPC().wp, gun:M.GUN};
  /* 조준 — 앞에 선 다른 모둠 아이는 맞고, 같은 모둠·이미 쓰러진 아이는 안 맞는다.
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
  G.players.clear(); put('e2', (G.me.g+1)%5); W.__miniPl.set('e2',{g:(G.me.g+1)%5,n:'e2',o:1,k:0}); o.죽은아이 = W.__aimPlayer();
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
  /* ★ 21차 — 목숨이 하나다. 몸통 몇 방에 쓰러지는지는 게임에서 읽는다(체력 ÷ 몸통 피해) */
  const perLife = Math.ceil(M.HP / M.DMG);
  o.한목숨 = perLife;
  const rev = ()=>{ W.__MINE.out=false; W.__MINE.hp=M.HP; W.__MINE.rs=0; PL.down=false; };
  rev();
  const seq=[]; for(let i=0;i<perLife;i++){
    W.__survHit('x','친구',1, M.DMG, false); seq.push([W.__MINE.hp, W.__MINE.out, PL.down]); }
  o.한방 = seq[0]; o.쓰러짐 = seq[seq.length-1];
  o.더맞음 = (W.__survHit('x','친구',1, M.DMG, false), W.__MINE.hp);
  /* 머리는 몸통의 두 배로 깎인다 */
  rev();
  W.__survHit('x','친구',1, M.HEAD, true);  o.머리깎임 = M.HP - W.__MINE.hp;
  rev();
  W.__survHit('x','친구',1, M.DMG, false);  o.몸통깎임 = M.HP - W.__MINE.hp;
  /* ★ 우르르 맞기 — 예전엔 맞은 아이마다 칸이 하나여서 두 명이 동시에 쏘면
     한 발만 들어갔다. 이제 쏜 아이마다 칸이 따로다: 한 번에 다 들어가야 한다. */
  rev();
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
  /* ★ 21차 — 등수가 아니라 '마지막까지 살아남은 사람의 모둠 하나' 가 이긴다.
     나는 쓰러졌고, 3모둠(라)만 살아 있다 → 3모둠이 이겨야 한다. */
  W.__MINE.hp = 0; W.__MINE.out = true; W.__MINE.dm = 0; W.__MINE.rs = 0; PL.down = true;
  W.__miniPl.set('b1',{g:2,n:'다',o:1,dm:40,k:4});
  W.__miniPl.set('b2',{g:3,n:'라',o:0,dm:25,k:2});
  W.__miniPl.set('b3',{g:4,n:'마',o:1,dm:90,k:6});
  o.살아있는사람 = W.__survAlive().map(a=>a.n);
  o.전광판 = W.__survTop().map(p=>p.n+':'+p.dm);
  G.paused = false; W.__miniFinish();
  o.순위 = {st:G.mini.st, win:G.mini.win, rank:G.mini.rank,
            top:(G.mini.top||[]).map(p=>p.n), aiming:document.body.classList.contains('aiming')};
  W.__step((M.DONE+1)*30, 1/30);
  o.끝 = {ph:G.phase, aiming:document.body.classList.contains('aiming'), y:+PL.y.toFixed(1)};
  /* 가게에는 연습용 총이 없다 */
  W.__shopTab('w'); W.__buildShopUI();
  o.가게 = [...document.querySelectorAll('#shopList .sn')].map(e=>e.textContent).join(' ');
  return o; });
ok('★ 시작하면 모두 같은 연습용 총을 들고 조준 모드가 켜진다', sv.시작.st==='run' && sv.시작.aiming && sv.시작.wp===sv.시작.gun, JSON.stringify(sv.시작));
ok('★ 앞에 선 다른 모둠 아이가 조준된다', sv.적==='e1', String(sv.적));
ok('★ 같은 모둠 아이는 안 맞는다', sv.같은모둠===null);
ok('★ 이미 쓰러진 아이는 안 맞는다', sv.죽은아이===null);
ok('★ 한 방에 조금씩 깎인다 (한 방에 반이 날아가면 맞은 줄도 모르고 죽는다)',
   sv.한목숨 >= 4, '쓰러지기까지 몸통 '+sv.한목숨+'방 · 첫 방 뒤 체력 '+sv.한방[0]);
ok('★ 21차 — 체력을 다 깎이면 그 판은 끝이다 (목숨이 하나다)',
   sv.쓰러짐[1] === true, '몸통 '+sv.한목숨+'방 뒤 → 체력 '+sv.쓰러짐[0]+' · 쓰러짐 '+sv.쓰러짐[1]);
ok('★ 쓰러지면 아침에 쓰러졌을 때처럼 시체로 눕는다 (PL.down)', sv.쓰러짐[2] === true);
ok('★ 쓰러진 뒤에는 더 안 깎인다 (구경만 한다)', sv.더맞음 === 0, '체력 '+sv.더맞음);
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
ok('★ 21차 — 마지막까지 살아남은 사람의 모둠 하나가 이긴다 (등수를 안 나눈다)',
   sv.순위.win === 3 && !sv.순위.rank,
   '이긴 모둠 '+(sv.순위.win+1)+'모둠 · 살아 있던 사람 '+JSON.stringify(sv.살아있는사람));
ok('★ 전광판은 피해 많이 넣은 사람 순서다 (모둠 점수가 아니라 사람)',
   sv.전광판[0].startsWith('마:90') && sv.전광판[1].startsWith('다:40'),
   sv.전광판.join(' · '));
ok('★ 끝난 판에도 전광판이 남는다', (sv.순위.top||[]).length >= 3, JSON.stringify(sv.순위.top));
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
  W.__goMini(1); G.paused = true;
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
