/* 20차 검사 — 줄넘기를 진짜 줄넘기로 · 줄넘기와 OX 퀴즈는 3인칭
   ★ 값을 검사에 베끼지 않는다. 뜀 높이·줄 높이·금색 시점은 전부 게임의 __MINI() 에 묻고,
     난이도는 **실제로 1분을 굴려서** 손버릇별로 몇 번 넘는지 센다.
   ★ 뜀 곡선은 계산하지 말고 굴려서 잰다 — 종이 위 포물선과 오일러 적분은 다르다
     (게임에서 이걸로 한 번 데었다: 금색을 0.34초 전에 켰다가 '보고 눌러도 걸림' 이 됐다). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
import fs from 'fs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12500);
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

/* 줄넘기를 run 단계로 올리고 내 발판에 세운다 */
const enter = ()=> ev(()=>{
  const W=window, G=W.__G, M=W.__MINI(), PL=W.__PL;
  G.paused = false;
  W.__goMini(1);
  for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
  G.mini.st = 'run'; G.paused = true;
  PL.x = M.padX(G.me.g); PL.z = M.PADZ; PL.y = M.Y; PL.vy = 0; PL.ground = true;
  PL.down = false; PL.landT = 0;
  const MI = W.__MINE; MI.j=0; MI.f=0; MI.c=0; MI.b=0; MI.rs=0;
  W.__ropeHit(0);
  return true;
});

/* ═══════ ① 스페이스를 꾹 누르고 있으면 안 뛴다 ═══════
   ★ 애들이 찾아낸 그 방법이다. 브라우저는 키를 누르고 있으면 keydown 을 계속 다시 보내는데
     (e.repeat), 그때마다 뛰면 줄넘기 내내 공중에 떠 있게 된다. */
await enter();
const hold = await ev(()=>{
  const W=window, PL=W.__PL, o={};
  const key = (rep)=> dispatchEvent(new KeyboardEvent('keydown', {key:' ', repeat:rep, bubbles:true}));
  const tryJump = (rep)=>{
    PL.y = W.__groundUnder(PL.x,PL.z,PL.R); PL.vy=0; PL.ground=true; PL.landT=0;
    key(rep);
    W.__updPlayer(1/60);
    return !PL.ground;
  };
  o.처음누름 = tryJump(false);
  o.꾹눌림 = tryJump(true);
  return o;
});
ok('★ 스페이스를 한 번 누르면 뛴다', hold.처음누름);
ok('★ 꾹 누르고 있어도(자동 반복) 다시 안 뛴다 — 애들이 찾아낸 그 방법', !hold.꾹눌림);

/* ═══════ ② 줄넘기 뜀은 짧고, 착지 뒤 숨 고르기가 있다 ═══════ */
const hop = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI(), DT=1/60;
  const one = (mini)=>{
    G.phase = mini ? 'mini' : 'day';
    PL.x = M.padX(G.me.g); PL.z = M.PADZ;
    const gy = W.__groundUnder(PL.x,PL.z,PL.R);
    PL.y = gy; PL.vy = 0; PL.ground = true; PL.down = false; PL.landT = 0;
    W.__MINE.rs = 0;
    W.__wantJump();
    const h=[];
    for(let i=0;i<90;i++){ W.__updPlayer(DT); h.push(PL.y-gy); if(i>3 && PL.ground) break; }
    const above = h.map((v,i)=> v>=M.CLEAR ? i : -1).filter(i=>i>=0);
    return {뜬시간:+(h.length*DT).toFixed(3), 최고:+Math.max(...h).toFixed(2),
            줄위:{처음:+(above[0]*DT).toFixed(3), 끝:+(above[above.length-1]*DT).toFixed(3)}};
  };
  const mini = one(true);
  const town = one(false);
  /* 착지 직후에는 다시 못 뛴다 */
  G.phase = 'mini';
  PL.x = M.padX(G.me.g); PL.z = M.PADZ;
  PL.y = W.__groundUnder(PL.x,PL.z,PL.R); PL.vy=0; PL.ground=true; PL.landT=0; W.__MINE.rs=0;
  W.__wantJump(); for(let i=0;i<90;i++){ W.__updPlayer(DT); if(i>3 && PL.ground) break; }
  W.__wantJump(); W.__updPlayer(DT);
  const 바로또 = !PL.ground;
  for(let i=0;i<Math.ceil(M.RJ_LAND/DT)+2;i++) W.__updPlayer(DT);
  W.__wantJump(); W.__updPlayer(DT);
  const 숨고르고 = !PL.ground;
  return {mini, town, 바로또, 숨고르고, 잠금:M.RJ_LAND};
});
ok('★ 줄넘기 뜀이 마을 점프보다 짧다 (한 바퀴 안에 타이밍이 생기게)',
   hop.mini.뜬시간 < hop.town.뜬시간*0.75,
   '줄넘기 '+hop.mini.뜬시간+'초 · 마을 '+hop.town.뜬시간+'초');
ok('줄넘기 뜀이 마을 점프보다 낮다', hop.mini.최고 < hop.town.최고,
   hop.mini.최고+'칸 · '+hop.town.최고+'칸');
ok('★ 발이 줄 높이 위에 있는 구간이 뜀의 일부뿐이다 (아무 때나 뛰면 안 되게)',
   hop.mini.줄위.끝 - hop.mini.줄위.처음 < hop.mini.뜬시간*0.8,
   '줄 위 '+hop.mini.줄위.처음+'~'+hop.mini.줄위.끝+'초 / 뜬 시간 '+hop.mini.뜬시간+'초');
ok('★ 착지하자마자는 다시 못 뛴다 (통통 튀기 막기)', !hop.바로또, '잠금 '+hop.잠금+'초');
ok('숨을 고르면 다시 뛴다', hop.숨고르고);

/* ═══════ ③ 판정 — '떠 있나' 가 아니라 '줄 위에 있나' ═══════ */
await enter();
const judge = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI(), o={};
  const gy = W.__groundUnder(PL.x,PL.z,PL.R);
  /* 다음 바퀴가 넘어가는 순간까지 돌린 뒤, 높이를 정해 놓고 한 번 더 판정시킨다 */
  const step = (h, ground, airT)=>{
    const MI = W.__MINE; const j0 = MI.j, f0 = MI.f;
    MI.rs = 0; PL.down = false;
    /* 판정은 바퀴가 바뀔 때만 난다 — 시간을 한 바퀴어치 밀어 준다 */
    let t = M.ROPE - G.t;
    const ph0 = Math.floor(W.__ropePhase(t)/(Math.PI*2));
    for(let i=0;i<4000;i++){
      t += 0.01; G.t = M.ROPE - t;
      if(Math.floor(W.__ropePhase(t)/(Math.PI*2)) !== ph0) break;
    }
    PL.y = gy + h; PL.ground = ground; PL.airT = airT;
    W.__miniTick(0.01);
    return {넘음:W.__MINE.j - j0, 걸림:W.__MINE.f - f0};
  };
  o.충분히뜸 = step(M.CLEAR + 0.25, false, 0);
  o.아슬하게뜸 = step(M.CLEAR + 0.02, false, 0);
  o.모자라게뜸 = step(M.CLEAR - 0.05, false, 0);
  /* 예전 규칙(착지 직후 0.16초는 봐준다)이 남아 있으면 이게 통과한다 */
  o.착지직후 = step(0, true, 0.05);
  o.가만히 = step(0, true, 5);
  return o;
});
ok('★ 줄 높이 위로 뜨면 넘는다', judge.충분히뜸.넘음 === 1 && judge.충분히뜸.걸림 === 0);
ok('★ 아슬아슬해도 줄 위면 넘는다', judge.아슬하게뜸.넘음 === 1);
ok('★ 조금 모자라게 뜨면 걸린다 (예전엔 떠 있기만 하면 넘었다)',
   judge.모자라게뜸.걸림 === 1 && judge.모자라게뜸.넘음 === 0);
ok('★ 착지 직후는 이제 안 봐준다 (예전 규칙 `airT < 0.16` 이 남아 있으면 여기서 걸린다)',
   judge.착지직후.걸림 === 1 && judge.착지직후.넘음 === 0);
ok('가만히 서 있으면 걸린다', judge.가만히.걸림 === 1);

/* ═══════ ④ 연속 · 모둠 연속 ═══════ */
await enter();
const streak = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI(), MI=W.__MINE, o={};
  const gy = W.__groundUnder(PL.x,PL.z,PL.R);
  const turn = (h)=>{
    MI.rs = 0; PL.down = false;
    let t = M.ROPE - G.t;
    const ph0 = Math.floor(W.__ropePhase(t)/(Math.PI*2));
    for(let i=0;i<4000;i++){ t += 0.01; G.t = M.ROPE - t;
      if(Math.floor(W.__ropePhase(t)/(Math.PI*2)) !== ph0) break; }
    PL.y = gy + h; PL.ground = h <= 0; PL.airT = 0;
    W.__miniTick(0.01);
  };
  const HI = M.CLEAR + 0.25;
  for(let i=0;i<4;i++) turn(HI);
  o.넷연속 = MI.c; o.최고 = MI.b;
  turn(0);                               // 걸린다
  o.걸린뒤연속 = MI.c; o.걸린뒤최고 = MI.b; o.엉킴 = MI.rs > 0;
  turn(HI); turn(HI);
  o.다시 = MI.c; o.최고2 = MI.b;
  /* 모둠 연속 = 모둠에서 제일 낮은 값 */
  W.__miniPl.clear();
  W.__miniPl.set(W.__uid, {g:G.me.g, n:'나', c:MI.c, j:9});
  W.__miniPl.set('x1', {g:G.me.g, n:'가', c:7, j:9});
  W.__miniPl.set('x2', {g:G.me.g, n:'나', c:4, j:9});
  W.__miniPl.set('y1', {g:(G.me.g+1)%5, n:'남', c:0, j:9});
  o.모둠연속 = W.__ropeTeam(G.me.g|0);
  W.__miniPl.set('x2', {g:G.me.g, n:'나', c:0, j:9});
  o.한명걸리면 = W.__ropeTeam(G.me.g|0);
  return o;
});
ok('★ 넘을수록 연속이 쌓인다', streak.넷연속 === 4 && streak.최고 === 4,
   streak.넷연속+'연속 · 최고 '+streak.최고);
ok('★ 걸리면 연속이 0 이 되고, 최고는 남는다',
   streak.걸린뒤연속 === 0 && streak.걸린뒤최고 === 4);
ok('★ 걸리면 줄에 엉켜서 잠깐 못 뛴다', streak.엉킴);
ok('다시 넘으면 연속이 다시 쌓인다', streak.다시 === 2 && streak.최고2 === 4);
ok('★ 모둠 연속은 모둠에서 제일 낮은 사람의 숫자다 (단체 줄넘기)',
   streak.모둠연속 === 2, '나 2 · 가 7 · 나 4 → '+streak.모둠연속);
ok('★ 한 명이라도 걸리면 모둠 연속이 0 이 된다', streak.한명걸리면 === 0);

/* ═══════ ⑤ 줄이 갈수록 빨라진다 ═══════ */
const speed = await ev(()=>{
  const W=window, M=W.__MINI(), gaps=[];
  let last=0, prev=Math.floor(W.__ropePhase(0)/(Math.PI*2));
  for(let i=1;i<=Math.round(M.ROPE*100);i++){ const t=i/100;
    const k=Math.floor(W.__ropePhase(t)/(Math.PI*2));
    if(k!==prev){ gaps.push(t-last); last=t; prev=k; } }
  const half = gaps.length>>1;
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  return {앞:+avg(gaps.slice(0,half)).toFixed(2), 뒤:+avg(gaps.slice(half)).toFixed(2),
          바퀴:gaps.length, 제일빠름:+Math.min(...gaps).toFixed(2)};
});
ok('★ 1분 동안 줄이 점점 빨라진다 (뒤로 갈수록 한 바퀴가 짧다)',
   speed.뒤 < speed.앞*0.92, '앞 반 '+speed.앞+'초 · 뒤 반 '+speed.뒤+'초');
ok('그래도 뛸 수는 있는 빠르기다 (제일 빠른 바퀴가 한 번 뛰는 시간보다 길다)',
   speed.제일빠름 > (hop.mini.뜬시간 + hop.잠금), '제일 빠른 바퀴 '+speed.제일빠름+'초');

/* ═══════ ⑥ 금색 신호 — '금색이면 뛴다' 가 실제로 맞나 ═══════
   ★ 금색이 켜지는 시각과, 그때 눌러서 넘을 수 있는 구간을 맞대 본다. */
const cue = await ev(()=>{
  const W=window, M=W.__MINI(), DT=1/240, CUE=M.CUE;
  const hits=[], golds=[];
  let prevTurn = Math.floor(W.__ropePhase(0)/(Math.PI*2)), wasGold=false;
  for(let i=1;i<=Math.round(M.ROPE/DT);i++){
    const t=i*DT, ph=W.__ropePhase(t), turn=Math.floor(ph/(Math.PI*2));
    if(turn!==prevTurn){ hits.push(t); prevTurn=turn; }
    const w = M.W*(1 + M.RAMP*t + 1.05*0.40*Math.sin(t*0.40) + 0.55*0.17*Math.sin(t*0.17));
    const gold = ((Math.PI*2) - (ph % (Math.PI*2))) <= Math.max(0.05,w)*CUE;
    if(gold && !wasGold) golds.push(t);
    wasGold = gold;
  }
  const lead=[];
  for(const g of golds){ const h=hits.find(x=>x>=g); if(h!==undefined) lead.push(h-g); }
  return {바퀴:hits.length, 켜짐:golds.length,
          제일이른리드:+Math.max(...lead).toFixed(3), 제일늦은리드:+Math.min(...lead).toFixed(3)};
});
ok('★ 한 바퀴에 금색이 딱 한 번 켜진다', cue.켜짐 === cue.바퀴, cue.켜짐+'/'+cue.바퀴);
ok('★ 금색이 켜지자마자 눌러도 넘는다 (계산이 아니라 실제 뜀 곡선으로 잰 값)',
   cue.제일이른리드 <= hop.mini.줄위.끝,
   '제일 이르게 켜질 때 '+cue.제일이른리드+'초 전 · 눌러도 되는 마지노선 '+hop.mini.줄위.끝+'초 전');
ok('★ 금색이 너무 늦게 켜지지도 않는다 (반응할 시간이 있다)',
   cue.제일늦은리드 >= hop.mini.줄위.처음 + 0.10,
   '제일 늦게 켜질 때 '+cue.제일늦은리드+'초 전');

/* ═══════ ⑦ 손버릇별로 1분을 진짜 굴려 본다 ═══════ */
const play = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI(), DT=1/60;
  const run = (mode)=>{
    G.paused = false; W.__goMini(1);
    for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
    G.mini.st='run'; G.paused=true;
    PL.x=M.padX(G.me.g); PL.z=M.PADZ; PL.y=M.Y; PL.vy=0; PL.ground=true; PL.down=false; PL.landT=0;
    const MI=W.__MINE; MI.j=0; MI.f=0; MI.c=0; MI.b=0; MI.rs=0;
    W.__miniTick(0.001);
    const N=Math.round(M.ROPE/DT);
    let mashT=0, wasGold=false, react=0;
    for(let i=0;i<N;i++){
      const t=i*DT; G.t=M.ROPE-t;
      let press=false;
      if(mode==='hold') press = (i===0);                       // 꾹 = 한 번만 난다
      else if(mode==='mash'){ mashT-=DT; if(mashT<=0){ press=true; mashT=0.10; } }
      else {
        const w = M.W*(1 + M.RAMP*t + 1.05*0.40*Math.sin(t*0.40) + 0.55*0.17*Math.sin(t*0.17));
        const gold = ((Math.PI*2) - (W.__ropePhase(t) % (Math.PI*2))) <= Math.max(0.05,w)*M.CUE;
        if(gold && !wasGold){ wasGold=true; react=0.10; }      // 0.10초 만에 반응한다고 본다
        if(!gold) wasGold=false;
        if(wasGold && react>0){ react-=DT; if(react<=0) press=true; }
      }
      if(press) W.__wantJump();
      W.__updPlayer(DT);
      W.__miniTick(DT);
    }
    return {j:MI.j, f:MI.f, b:MI.b};
  };
  return {꾹:run('hold'), 마구:run('mash'), 금색:run('cue')};
});
ok('★ 스페이스를 꾹 누르고만 있으면 하나도 못 넘는다 (예전엔 이걸로 거의 다 넘었다)',
   play.꾹.j === 0, JSON.stringify(play.꾹));
ok('★ 아무렇게나 마구 눌러도 절반을 못 넘는다',
   play.마구.j < play.금색.j*0.6, '마구 '+play.마구.j+'번 · 금색 보고 '+play.금색.j+'번');
ok('★ 금색을 보고 뛰면 거의 다 넘는다 (실력이 갈린다)',
   play.금색.j >= 25 && play.금색.b >= 10,
   play.금색.j+'번 · 최고 '+play.금색.b+'연속');

/* ═══════ ⑧ 소리 ═══════ */
const snd = await ev(()=>{ const K=window.__SFX_KEYS();
  return {hop:K.includes('hop'), land:K.includes('land'), rtap:K.includes('rtap')}; });
ok('뛰는 소리가 소리 표에 있다 (없는 이름은 조용히 아무것도 안 한다)', snd.hop);
ok('착지 소리가 있다', snd.land);
ok('★ 줄이 바닥을 치는 "탁" 소리가 있다 — 박자는 눈보다 귀로 잡는다', snd.rtap);

/* ═══════ ⑨ 3인칭 — 줄넘기·OX 퀴즈만 ═══════ */
const tpv = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI(), o={};
  const look = ()=>{
    W.__updPlayer(1/60);
    const c = W.__camPos();
    return {뒤로:+Math.hypot(c.x-PL.x, c.z-PL.z).toFixed(2), 손:W.__held.visible,
            내양:W.__tpvOn(), 종류:W.__tpvKind()};
  };
  const go = (k)=>{
    G.paused=false; W.__goMini(k);
    for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
    G.mini.st='run'; G.paused=true;
    PL.down=false; PL.pitch=-0.2;
    return look();
  };
  o.퀴즈 = go(0);
  o.줄넘기 = go(1);
  o.서바이벌 = go(2);
  /* 마을로 돌아오면 1인칭 */
  G.paused=false; W.__miniExit(); G.phase='day'; PL.down=false;
  o.마을 = look();
  /* 쓰러지면 여전히 3인칭 (9차부터의 동작) */
  PL.down = true; o.쓰러짐 = look(); PL.down = false;
  return o;
});
ok('★ 줄넘기는 3인칭이다 (내 양과 줄이 같이 보여야 한다)',
   tpv.줄넘기.뒤로 > 2 && tpv.줄넘기.내양, tpv.줄넘기.뒤로+'칸 뒤에서');
ok('★ OX 퀴즈도 3인칭이다 (내가 어느 우리 안인지 보여야 한다)',
   tpv.퀴즈.뒤로 > 2 && tpv.퀴즈.내양, tpv.퀴즈.뒤로+'칸 뒤에서');
ok('★ 서바이벌은 1인칭 그대로다 (총을 겨누는 판이라 물러나면 안 맞는다)',
   tpv.서바이벌.뒤로 < 0.5 && !tpv.서바이벌.내양, tpv.서바이벌.뒤로+'칸');
ok('마을(낮·밤)은 1인칭이다', tpv.마을.뒤로 < 0.5 && !tpv.마을.내양);
ok('쓰러지면 여전히 3인칭이다 (9차부터의 동작이 안 깨졌다)', tpv.쓰러짐.뒤로 > 2);
ok('★ 3인칭일 때는 손에 든 것이 안 보인다', !tpv.줄넘기.손 && !tpv.퀴즈.손 && !tpv.쓰러짐.손);
ok('1인칭일 때는 손에 든 것이 보인다', tpv.마을.손 && tpv.서바이벌.손);

/* 카메라가 뜀을 따라 같이 뜨면 '넘고 있다' 가 화면에서 안 보인다 */
const camFix = await ev(()=>{
  const W=window, G=W.__G, PL=W.__PL, M=W.__MINI();
  G.paused=false; W.__goMini(1);
  for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
  G.mini.st='run'; G.paused=true; PL.down=false;
  PL.x=M.padX(G.me.g); PL.z=M.PADZ;
  const gy=W.__groundUnder(PL.x,PL.z,PL.R);
  PL.y=gy; PL.vy=0; PL.ground=true; W.__updPlayer(1/60);
  const a=W.__camPos().y;
  PL.y=gy+0.8; PL.ground=false; PL.vy=0; W.__updPlayer(1/60);
  const b2=W.__camPos().y;
  return {땅에서:+a.toFixed(2), 뛸때:+b2.toFixed(2), 차:+(b2-a).toFixed(2)};
});
ok('★ 뛰어도 카메라는 따라 뜨지 않는다 (같이 뜨면 넘는 게 화면에서 안 보인다)',
   Math.abs(camFix.차) < 0.05, '땅에서 '+camFix.땅에서+' · 뛸 때 '+camFix.뛸때);

/* ═══════ ⑩ 내보내기 열쇠를 두 번 쓰지 않았나 ═══════
   ★ 20차에 `__held` 를 이미 있는 이름으로 또 썼다. 나중에 쓴 것이 이기면서 **모양이 바뀌어**
     (물건 → 함수) t11 이 통째로 죽었다. CLAUDE.md 에 적혀 있는 함정인데 또 밟았다.
     오류가 나는 게 아니라 **조용히 딴 것**이 나가므로, 사람 눈으로는 못 잡는다.
   ★ 브라우저 안에서는 이미 합쳐진 뒤라 못 본다 — 파일 글자를 직접 본다. */
{
  const src = fs.readFileSync(FILE, 'utf8');
  const i = src.lastIndexOf('Object.assign(window, {');
  const body = src.slice(i, src.indexOf('window.__READY', i));
  const seen = new Map(), dup = [];
  /* 줄 처음이나 쉼표 뒤에 오는 `__이름:` 만 센다 (글자 안의 콜론은 안 센다) */
  for(const m of body.matchAll(/(^|[,{])\s*(__[A-Za-z0-9_]+)\s*:/gm)){
    const k = m[2];
    if(seen.has(k)) dup.push(k); else seen.set(k, 1);
  }
  ok('★ 검사용 내보내기 열쇠를 두 번 쓴 곳이 없다 (겹쳐 쓰면 모양이 바뀌어 옛 검사가 죽는다)',
     dup.length === 0, dup.length ? dup.join(', ') : seen.size+'개 전부 한 번씩');
}

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
