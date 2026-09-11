/* 23차 검사 — 총기 반동 · 🎒 가방(인형옷) · ✨ 전직 카드
   ★ 값을 검사에 베끼지 않는다. 반동 세기·무기 kick·직업 표는 전부 게임에서 읽고,
     세는 것은 개수가 아니라 관계다("드르륵이 한 발보다 높이 솟나", "아직 맞나").
   ★ 반동은 **게임 함수를 그대로 굴려서** 잰다 — 종이 위 계산으로는 안 맞는다(20차 줄넘기). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12850);
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

/* ═══════ ① 반동 — 표와 모양 ═══════ */
const rc = await ev(()=>{
  const W=window, o={}, R=W.__RECOIL();
  o.상수 = R;
  o.말이되나 = R.up > 0 && R.side > 0 && R.max > R.up && R.back > R.slow && R.hold > 0;
  /* 한 발 쏘면 들린다 */
  W.__recoilReset(); W.__fireRecoil(1.0);
  o.한발 = W.__aimKick();
  /* 손 떼고 0.6초 — 거의 제자리 */
  for(let t=0;t<0.6;t+=1/60) W.__recoilTick(1/60);
  o.손떼고06 = W.__aimKick();
  /* 천장 — 스무 발을 한꺼번에 */
  W.__recoilReset();
  for(let i=0;i<20;i++) W.__fireRecoil(1.6);
  o.천장 = W.__aimKick();
  return o;
});
ok('반동 상수가 말이 된다 (천장 > 한 발 · 손 떼면 쏘는 중보다 빨리 내려온다)',
   rc.말이되나, JSON.stringify(rc.상수));
ok('★ 한 발 쏘면 조준선이 위로 들린다', rc.한발 > 0, (rc.한발*180/Math.PI).toFixed(2)+'°');
ok('★ 손을 떼면 0.6초 안에 거의 제자리로 온다 (3학년에게 반동 잡는 법을 가르칠 수는 없다)',
   rc.손떼고06 < rc.한발*0.05, (rc.손떼고06*180/Math.PI).toFixed(3)+'° 남음');
ok('★ 아무리 갈겨도 천장을 안 넘는다 (하늘만 보이면 판이 안 보인다)',
   Math.abs(rc.천장 - rc.상수.max) < 1e-9, (rc.천장*180/Math.PI).toFixed(1)+'°');

/* ═══════ ② 반동 — 드르륵은 쌓이고 한 발씩은 안 쌓인다 ═══════ */
const burst = await ev(()=>{
  const W=window, o={};
  const run = (Wp, sec)=>{
    W.__recoilReset();
    let cd=0, peak=0;
    for(let t=0;t<sec;t+=1/60){ cd-=1/60; if(cd<=0){ W.__fireRecoil(Wp.kick); cd=Wp.cd; }
      W.__recoilTick(1/60); peak=Math.max(peak, W.__aimKick()); }
    return peak;
  };
  const one = (Wp)=>{ W.__recoilReset(); W.__fireRecoil(Wp.kick); return W.__aimKick(); };
  /* 제일 빠른 총과 제일 느린 총을 표에서 찾아 쓴다 — 이름을 박지 않는다 */
  const guns = W.__WEAPONS.filter((x,i)=> i>0 && x.kick);
  const fast = guns.reduce((a,x)=> x.cd < a.cd ? x : a);
  const slow = guns.reduce((a,x)=> x.cd > a.cd ? x : a);
  o.빠른총 = fast.n; o.느린총 = slow.n;
  o.빠른_한발 = one(fast); o.빠른_드르륵 = run(fast, 3);
  o.느린_한발 = one(slow); o.느린_연사 = run(slow, 6);
  return o;
});
ok('★ 드르륵 갈기면 반동이 쌓여 한 발보다 훨씬 높이 솟는다 (이게 이번 판의 요지다)',
   burst.빠른_드르륵 > burst.빠른_한발 * 1.8,
   burst.빠른총+' 한 발 '+(burst.빠른_한발*180/Math.PI).toFixed(2)
   +'° → 드르륵 '+(burst.빠른_드르륵*180/Math.PI).toFixed(2)+'°');
ok('★ 느린 총을 한 발씩 겨눠 쏘면 안 쌓인다 (조준해서 쏘는 아이는 손해가 없다)',
   burst.느린_연사 < burst.느린_한발 * 1.12,
   burst.느린총+' 한 발 '+(burst.느린_한발*180/Math.PI).toFixed(2)
   +'° → 계속 쏴도 '+(burst.느린_연사*180/Math.PI).toFixed(2)+'°');

/* ═══════ ③ 반동이 진짜로 조준을 틀어 놓나 (화면 효과가 아니다) ═══════ */
const aimed = await ev(()=>{
  const W=window, PL=W.__PL, o={};
  W.__recoilReset(); PL.pitch = 0; PL.yaw = 0;
  W.__updPlayer(1/60);
  const c = W.__cam;
  /* ★ 게임이 조준에 실제로 쓰는 forward() 를 그대로 읽는다 — 화면 효과가 아니라는 증거다 */
  o.평소 = {rx:c.rotation.x, fy:W.__forward().y};
  W.__fireRecoil(1.6);
  W.__updPlayer(1/60);
  o.쏜뒤 = {rx:c.rotation.x, fy:W.__forward().y};
  /* 좌우로도 흔들리나 — 여러 번 쏴서 부호가 갈리는지 본다 */
  let plus=0, minus=0;
  for(let i=0;i<40;i++){ W.__recoilReset(); W.__fireRecoil(1.0);
    if(W.__aimSway() > 0) plus++; else if(W.__aimSway() < 0) minus++; }
  o.좌우 = {plus, minus};
  W.__recoilReset(); W.__updPlayer(1/60);
  o.지운뒤 = W.__cam.rotation.x;
  return o;
});
ok('★ 반동이 카메라에 실제로 얹힌다 (덧그리는 효과가 아니다)',
   aimed.쏜뒤.rx > aimed.평소.rx + 0.01, aimed.평소.rx.toFixed(4)+' → '+aimed.쏜뒤.rx.toFixed(4));
ok('★ 그래서 조준선이 보는 방향까지 같이 들린다 = 총알이 진짜로 위로 나간다',
   aimed.쏜뒤.fy > aimed.평소.fy + 0.005,
   '보는 높이 '+aimed.평소.fy.toFixed(4)+' → '+aimed.쏜뒤.fy.toFixed(4));
ok('★ 좌우로도 흔들린다 (한쪽으로만 밀리면 총이 고장 난 것처럼 보인다)',
   aimed.좌우.plus > 5 && aimed.좌우.minus > 5, JSON.stringify(aimed.좌우));
ok('반동을 지우면 카메라도 제자리로 돌아온다', Math.abs(aimed.지운뒤) < 1e-6);

/* ═══════ ④ 총만 반동이 있다 · 미니게임에도 있다 · 그래도 맞는다 ═══════ */
const who = await ev(()=>{
  const W=window, o={};
  o.맨손돌 = W.__WEAPONS[0].n;
  o.미니총kick = W.__WEAPONS[W.__WEAPONS.length-1].kick;
  /* 12칸 앞 늑대를 계속 갈겼을 때, 솟은 만큼이 조준 너그러움 안에 드나 */
  const bad = [];
  for(let i=1;i<W.__WEAPONS.length;i++){
    const Wp = W.__WEAPONS[i]; if(!Wp.kick) continue;
    W.__recoilReset();
    let cd=0, peak=0;
    for(let t=0;t<4;t+=1/60){ cd-=1/60; if(cd<=0){ W.__fireRecoil(Wp.kick); cd=Wp.cd; }
      W.__recoilTick(1/60); peak=Math.max(peak, W.__aimKick()); }
    const off = Math.tan(peak)*12, tol = Wp.aimR + 12*0.05;
    if(off >= tol) bad.push(Wp.n + ' ' + off.toFixed(2) + '/' + tol.toFixed(2));
  }
  o.못맞히는총 = bad;
  return o;
});
ok('★ 미니게임 연습용 총에도 반동이 있다', who.미니총kick > 0, 'kick '+who.미니총kick);
ok('★ 반동이 있어도 12칸 앞 늑대는 여전히 맞는다 (너무 심하면 9살이 손을 놓는다)',
   who.못맞히는총.length === 0, who.못맞히는총.join(' · ') || '전부 맞는다');

/* ═══════ ⑤ 🎒 가방 — 입은 자리와 인형옷 ═══════ */
const bag = await ev(()=>{
  const W=window, K=W.__KIT, G=W.__G, o={};
  for(let i=0;i<W.__WEAPONS.length;i++) if(!W.__WEAPONS[i].mini) K.ownW[i]=true;
  for(let i=0;i<W.__ARMORS.length;i++) K.ownA[i]=true;
  K.pot[0]=2; K.wpn=2; K.arm=1;
  G.me.hat=0; G.me.gls=0; G.me.clo=0; G.me.pet=0;
  W.__openKit();
  o.입은자리 = document.querySelectorAll('.kSlot').length;
  o.자리이름 = [...document.querySelectorAll('.kSlot .kTag')].map(e=>e.textContent);
  const cells = [...document.querySelectorAll('#kitGrid .kCell')];
  o.칸 = cells.length;
  o.켜진칸 = cells.filter(c=>c.classList.contains('on')).length;
  o.미리보기 = !!document.querySelector('#kitPvw');
  /* 미니게임 총은 가방에 안 나온다 — 가게와 같은 규칙 */
  const mini = W.__WEAPONS[W.__WEAPONS.length-1];
  o.미니총이름 = mini.n;
  o.미니총보임 = cells.some(c => (c.title||'').indexOf(mini.n) === 0);
  /* 안 산 무기는 안 나온다 */
  K.ownW[3] = false; W.__openKit();
  o.안산것뺀뒤 = document.querySelectorAll('#kitGrid .kCell').length;
  K.ownW[3] = true;
  return o;
});
ok('입은 자리가 여섯이다 (모자·안경·옷 / 무기·방어구·짝꿍)', bag.입은자리 === 6, bag.자리이름.join(' · '));
ok('★ 가운데에 내 양이 선다 (뭘 입었는지 글씨가 아니라 그림으로 보인다)', bag.미리보기 === true);
ok('입고 있는 것만 초록 테가 켜진다 (무기 하나 · 방어구 하나)', bag.켜진칸 === 2, bag.켜진칸+'칸');
ok('★ 미니게임 전용 총은 가방에 안 나온다 (가게와 같은 규칙)',
   bag.미니총보임 === false, bag.미니총이름);
ok('★ 안 산 것은 칸에 안 깔린다', bag.안산것뺀뒤 === bag.칸 - 1, bag.칸+' → '+bag.안산것뺀뒤);

/* ═══════ ⑥ 가방에서 갈아입기 — 통신은 안 늘었다 ═══════ */
const wear = await ev(()=>{
  const W=window, G=W.__G, o={};
  G.me.hat=0; G.me.gls=0; G.me.clo=0; G.me.pet=0; W.__openKit();
  const pick = (name)=> [...document.querySelectorAll('#kitGrid .kCell')]
    .find(c => (c.title||'').indexOf(name) === 0);
  /* 모자를 하나 눌러 본다 */
  const hatName = W.__HAT_NAME[1];
  const c = pick(hatName); o.모자칸있나 = !!c;
  if(c) c.click();
  o.쓴모자 = G.me.hat;
  o.칸이켜졌나 = !!(pick(hatName) && pick(hatName).classList.contains('on'));
  /* 짝꿍도 — 이건 pc 통로로 나간다 */
  const petName = W.__PET_NAME[1];
  const p = pick(petName); if(p) p.click();
  W.__syncMyPC();
  o.짝꿍 = {me:G.me.pet, pc:W.__myPC().pet};
  /* 입은 자리를 누르면 벗는다 */
  const slot = [...document.querySelectorAll('.kSlot')]
    .find(e => (e.querySelector('.kTag')||{}).textContent === '모자');
  if(slot) slot.click();
  o.벗은뒤 = G.me.hat;
  /* 갈아입기가 쓰는 칸이 전부 이미 나가던 칸인가 */
  o.자리통로 = ['hat','gls','clo'].every(k => G.me[k] !== undefined);
  o.pc통로 = W.__myPC().pet !== undefined;
  return o;
});
ok('★ 가방에서 모자를 누르면 그 자리에서 쓴다 (시작 화면에서 고른 뒤로는 못 바꾸던 것이다)',
   wear.모자칸있나 && wear.쓴모자 === 1 && wear.칸이켜졌나, '모자 '+wear.쓴모자);
ok('★ 짝꿍을 바꾸면 친구에게 나가는 칸(pc)까지 따라간다',
   wear.짝꿍.me === 1 && wear.짝꿍.pc === 1, JSON.stringify(wear.짝꿍));
ok('★ 입은 자리를 누르면 벗는다', wear.벗은뒤 === 0);
ok('★ 갈아입기가 쓰는 칸은 전부 이미 나가던 칸이다 = 통신이 한 칸도 안 늘었다',
   wear.자리통로 && wear.pc통로);

/* ═══════ ⑦ 가방 — 거르는 칸과 물약 ═══════ */
const tabs = await ev(()=>{
  const W=window, o={};
  W.__KIT.pot[0] = 2; W.__openKit();
  const all = document.querySelectorAll('#kitGrid .kCell').length;
  const tb = [...document.querySelectorAll('#kitTabs button')];
  o.칸수 = tb.length;
  const hit = tb.find(x=>/무기/.test(x.textContent)); if(hit) hit.click();
  o.무기만 = document.querySelectorAll('#kitGrid .kCell').length;
  o.전체 = all;
  const pot = tb.find(x=>/물약/.test(x.textContent)); if(pot) pot.click();
  const hp0 = W.__PL.hp = 10;
  const c = document.querySelector('#kitGrid .kCell'); if(c) c.click();
  o.마신뒤 = {체력:W.__PL.hp, 남은물약:W.__KIT.pot[0]};
  return o;
});
ok('거르는 칸이 있다 (전체·무기·방어구·물약·꾸미기)', tabs.칸수 === 5, tabs.칸수+'개');
ok('★ 거르면 그것만 남는다', tabs.무기만 > 0 && tabs.무기만 < tabs.전체,
   '전체 '+tabs.전체+' → 무기 '+tabs.무기만);
ok('★ 물약 칸을 누르면 마신다', tabs.마신뒤.체력 > 10 && tabs.마신뒤.남은물약 === 1,
   JSON.stringify(tabs.마신뒤));

/* ═══════ ⑧ ✨ 전직 카드 ═══════ */
const job = await ev(()=>{
  const W=window, o={};
  W.__xpReset(); W.__XP.lv = W.__JOB_LV[0];
  W.__buildJobUI(); document.getElementById('popJob').classList.add('on');
  const cards = [...document.querySelectorAll('.jobCard')];
  o.카드 = cards.length; o.직업수 = W.__JOBS.length;
  o.그림 = document.querySelectorAll('.jobCard img').length;
  o.이름 = [...document.querySelectorAll('.jobCard .jName')].map(e=>e.textContent.trim());
  o.설명있나 = [...document.querySelectorAll('.jobCard .jDesc')].every(e=>e.textContent.trim().length > 3);
  o.스텟있나 = [...document.querySelectorAll('.jobCard .jStat')].every(e=>/→/.test(e.textContent));
  /* ★ 카드 그림이 직업마다 다른가 — 같으면 '어떤 모습이 되는지' 를 못 보여 준 것이다 */
  const src = [...document.querySelectorAll('.jobCard img')].map(e=>e.src);
  o.그림종류 = new Set(src).size;
  o.그림빈것 = src.filter(x=>!x || x.length < 500).length;
  return o;
});
ok('전직 카드가 직업 수만큼 뜬다', job.카드 === job.직업수, job.카드+'장 / 직업 '+job.직업수);
ok('★ 카드마다 그 차림새를 입은 양 그림이 있다 (예전엔 글씨 두 줄이었다)',
   job.그림 === job.카드 && job.그림빈것 === 0, job.그림+'장');
ok('★ 카드 그림이 직업마다 다르다 (같으면 보여 준 게 없는 것이다)',
   job.그림종류 === job.카드, job.그림종류+'가지');
ok('카드에 직업 이름이 있다', job.이름.length === job.카드 && job.이름.every(n=>n.length>1), job.이름.join(' · '));
ok('카드에 무엇이 되는지와 늘어나는 칸이 적혀 있다', job.설명있나 && job.스텟있나);

/* ═══════ ⑨ 전직을 고르면 실제로 바뀐다 · 2차는 하나만 ═══════ */
const pick = await ev(()=>{
  const W=window, o={};
  W.__xpReset(); W.__XP.lv = W.__JOB_LV[0];
  W.__buildJobUI();
  document.querySelectorAll('.jobCard')[1].click();          // 가운데 길
  o.고른뒤 = {job:W.__XP.job, jt:W.__XP.jt};
  o.창닫힘 = !document.getElementById('popJob').classList.contains('on');
  /* 2차 — 고른 길 하나만 보여 준다 */
  W.__XP.lv = W.__JOB_LV[1];
  W.__buildJobUI();
  o.이차카드 = document.querySelectorAll('.jobCard').length;
  o.이차이름 = (document.querySelector('.jobCard .jName')||{}).textContent;
  /* 가방 미리보기에도 차림새가 붙는다 */
  W.__openKit();
  o.가방에도 = !!document.querySelector('#kitPvw');
  return o;
});
ok('★ 카드를 누르면 그 길로 전직된다', pick.고른뒤.job === 1 && pick.고른뒤.jt === 1,
   JSON.stringify(pick.고른뒤));
ok('고르면 창이 닫힌다', pick.창닫힘 === true);
ok('★ 2차는 이미 고른 길 하나만 보여 준다 (길을 갈아탈 수 없다)',
   pick.이차카드 === 1, pick.이차카드+'장 · '+pick.이차이름);
ok('전직한 뒤에도 가방에 내 양이 선다', pick.가방에도 === true);

/* ═══════ ⑩ 스탯 — 힘·체력·민첩·지능 (23차) ═══════ */
const st = await ev(()=>{
  const W=window, X=W.__XP, S=W.__ST(), o={};
  const only = (i,n)=>{ W.__xpReset(); X.pts=99; for(let k=0;k<n;k++) W.__takeStat(i); X.pts=0; };
  o.스탯수 = W.__STATS.length;
  o.이름 = W.__STATS.map(x=>x.n);
  o.상한 = W.__STATS.map(x=>x.max);
  /* 레벨을 다 올려도 네 칸을 다 채울 수는 없어야 한다 — 아니면 고르는 게임이 아니다 */
  o.점수 = W.__LV_MAX;
  o.칸합 = W.__STATS.reduce((a,x)=>a+x.max, 0);
  /* 아무것도 안 찍었을 때가 기준 */
  W.__xpReset();
  const base = {mine:W.__mineTime(), amt:W.__mineBonus(), work:W.__workMul(),
                atk:W.__atkMul(), hp:W.__maxHP(), def:W.__defNow(), spd:W.__spdMul(),
                farm:W.__farmMul()};
  o.기준 = base;
  const of = (i,n)=>{ only(i,n); return {mine:W.__mineTime(), amt:W.__mineBonus(),
    work:W.__workMul(), atk:W.__atkMul(), hp:W.__maxHP(), def:W.__defNow(),
    spd:W.__spdMul(), farm:W.__farmMul()}; };
  o.힘 = of(S.str, 12); o.체력 = of(S.vit, 12); o.민첩 = of(S.agi, 12); o.지능 = of(S.int, 12);
  /* 곱으로 쌓이나 — 한 칸 비율의 세제곱이 세 칸 값과 같아야 한다 */
  only(S.agi,1); const m1 = W.__mineTime();
  only(S.agi,3); const m3 = W.__mineTime();
  o.곱으로쌓나 = Math.abs(m3 - base.mine*Math.pow(m1/base.mine,3)) < 1e-6;
  W.__xpReset();
  return o;
});
const up = (a,b)=> b > a, dn = (a,b)=> b < a;
ok('★ 스탯이 넷이다 (힘·체력·민첩·지능)', st.스탯수 === 4, st.이름.join(' · '));
ok('★ 레벨을 다 올려도 네 칸을 다 못 채운다 (다 채울 수 있으면 고르는 게임이 아니다)',
   st.점수 < st.칸합, '점수 '+st.점수+'개 · 칸 합 '+st.칸합+'개');
ok('★ 💪 힘은 사격 공격력을 크게 올린다', up(st.기준.atk, st.힘.atk),
   '×'+st.기준.atk.toFixed(2)+' → ×'+st.힘.atk.toFixed(2));
ok('★ ❤️ 체력은 최대 체력과 방어력을 올린다',
   up(st.기준.hp, st.체력.hp) && up(st.기준.def, st.체력.def),
   '체력 '+st.기준.hp+'→'+st.체력.hp+' · 방어 '+st.기준.def+'→'+st.체력.def);
ok('★ 🍃 민첩은 캐는 속도와 이동 속도를 올린다',
   dn(st.기준.mine, st.민첩.mine) && up(st.기준.spd, st.민첩.spd),
   '캐기 '+st.기준.mine.toFixed(3)+'→'+st.민첩.mine.toFixed(3)
   +'초 · 이동 ×'+st.민첩.spd.toFixed(3));
ok('★ 📘 지능은 캐는 양과 짓기·농장 일을 올린다',
   up(st.기준.amt, st.지능.amt) && dn(st.기준.work, st.지능.work) && dn(st.기준.farm, st.지능.farm),
   '캐는양 +'+st.지능.amt+' · 짓기 ×'+st.지능.work.toFixed(2)+' · 농장 ×'+st.지능.farm.toFixed(2));
/* ★ 겹치되 주·곁이 분명해야 한다 — 이게 이번 체계의 전부다 */
ok('★ 캐는 속도는 민첩도 힘도 올리되, **민첩이 확실히 더** 올린다 (겹치되 주·곁이 갈린다)',
   dn(st.기준.mine, st.힘.mine) && st.민첩.mine < st.힘.mine * 0.75,
   '민첩 '+st.민첩.mine.toFixed(3)+'초 vs 힘 '+st.힘.mine.toFixed(3)+'초');
ok('★ 방어력은 체력이 주, 힘이 곁이다',
   up(st.기준.def, st.힘.def) && st.체력.def > st.힘.def,
   '체력 '+st.체력.def+' vs 힘 '+st.힘.def);
ok('★ 짓기·수리는 지능이 주, 민첩이 곁이다',
   dn(st.기준.work, st.민첩.work) && st.지능.work < st.민첩.work * 0.75,
   '지능 ×'+st.지능.work.toFixed(2)+' vs 민첩 ×'+st.민첩.work.toFixed(2));
ok('★ 한 갈래만 찍은 아이는 남의 갈래가 안 오른다 (성격이 갈린다)',
   st.지능.atk === st.기준.atk && st.체력.mine === st.기준.mine,
   '지능만 찍으면 공격 그대로 · 체력만 찍으면 캐기 그대로');
ok('★ 스탯은 곱으로 쌓인다 (줄어든 값에서 또 줄인다)', st.곱으로쌓나 === true);

/* ★ 이동 속도는 늑대 추격을 깨뜨릴 수 있는 유일한 새 값이라 따로 본다 */
const spd = await ev(()=>{
  const W=window, S=W.__ST(), X=W.__XP;
  W.__xpReset(); X.pts=99;
  for(let k=0;k<W.__STATS[S.agi].max;k++) W.__takeStat(S.agi);
  /* ★ 되돌리기 전에 다 읽어 둔다 — 처음엔 xpReset 뒤에 배수를 읽어서
     ×1.000 이 나왔고, 그 항목이 통째로 헛돌고 있었다(늘 통과했다). */
  const mul = W.__spdMul(), me = 5.4 * mul;
  const fast = W.__WOLF_T.reduce((a,x)=> x.spd > a.spd ? x : a);
  W.__xpReset();
  return {me, wolf:fast.spd, name:fast.n, mul};
});
ok('★ 민첩을 다 찍어도 이동 속도가 크게 안 뛴다 (여기를 크게 주면 늑대가 영영 못 쫓는다)',
   spd.mul <= 1.20, '×'+spd.mul.toFixed(3)+' (초속 '+spd.me.toFixed(2)
   +' · 제일 빠른 '+spd.name+' '+spd.wolf+')');

/* ═══════ ⑪ 스탯 창이 교실 화면에서 닿나 ═══════ */
const fit = [], spill = [];
for(const [w,h,nm] of [[1366,768,'1366×768'],[1280,800,'1280×800'],[1024,768,'1024×768'],
                       [1024,600,'1024×600'],[820,1180,'태블릿'],[800,500,'800×500']]){
  await pg.setViewportSize({width:w, height:h});
  await ev(()=>{ const W=window; document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
                 W.__xpReset(); W.__xpGain(999999); W.__openStat(); });
  await pg.waitForTimeout(260);
  fit.push([nm, await ev(()=>{
    const c = document.querySelector('#popStat .popC').getBoundingClientRect();
    return [...document.querySelectorAll('#stList > div button')]
      .filter(x=>{ const r=x.getBoundingClientRect();
        return r.bottom > c.bottom + 0.5 || r.top < c.top - 0.5; }).length;
  })]);
  /* ★ 아래 '지금 내 능력치' 줄이 칸 밖으로 삐져나가 옆 칸 글씨 위로 올라타지 않나 (24차).
     ★ 함정 — 위 고리는 xpReset() 뒤라 스탯이 0이고, 그러면 값이 ×1 · 0% 빠름 · 100 으로
       **제일 짧다.** 그 상태로 재면 겹쳐 있어도 통과한다(23차에 이동 속도 항목이 xpReset()
       뒤에 값을 읽어 늘 ×1.000 이던 것과 같은 함정이다). 그래서 다 찍어 놓고 잰다.
     ★ 자식 폭을 더해서 재지 않는다 — flex-wrap 으로 얌전히 아래로 접힌 줄까지 빨간불이 된다.
       보려는 것은 '안 들어갔나' 가 아니라 **'옆으로 삐져나갔나'** 라서 scrollWidth 로 본다. */
  spill.push([nm, await ev(()=>{
    const W=window, XP=W.__XP, S=W.__STATS;
    for(let i=0;i<XP.st.length;i++) XP.st[i]=S[i].max;    // 값이 제일 길어지게
    W.__openStat();
    const rows=[...document.querySelectorAll('#stDeriv .dRow')];
    return [rows.length, rows.filter(d=>d.scrollWidth > d.clientWidth + 0.5).length];
  })]);
}
await pg.setViewportSize({width:1100, height:760});
ok('★ 어느 교실 화면에서도 스탯 ＋ 단추 넷이 스크롤 없이 닿는다 (찍는 자리는 위에 있어야 한다)',
   fit.every(x=>x[1] === 0), fit.map(x=>x[0]+':'+(x[1]?('못 닿음 '+x[1]):'닿음')).join(' · '));
ok('★ 능력치 줄이 칸 밖으로 삐져나가 옆 칸 글씨를 덮지 않는다 (값이 제일 길 때)',
   spill.every(x=>x[1][0] > 0 && x[1][1] === 0),
   spill.map(x=>x[0]+':'+(x[1][0]?(x[1][1]?('삐져나감 '+x[1][1]+'줄'):(x[1][0]+'줄 멀쩡')):'줄을 못 찾음')).join(' · '));

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
