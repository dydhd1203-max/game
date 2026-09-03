/* 12차 검사 — 경험치·레벨·스텟(C) · 늑대 강화 · 탑 개수 제한 풀기 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE = process.argv[2] || '/home/user/game/index.html';
const PORT = +(process.argv[3] || 10400);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1180,height:760}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','하늘'); await pg.click('#bSolo');
await pg.waitForFunction('window.__G && window.__G.started===true', {timeout:30000});
await pg.waitForTimeout(900);

const r = await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, X=W.__XP, o={};
  W.__introDone(); W.__xpReset();

  /* ── 레벨 표 ── */
  o.lvMax = W.__LV_MAX;
  o.need = []; for(let L=1;L<W.__LV_MAX;L++) o.need.push(W.__XP_NEED[L]);
  o.needRises = o.need.every((v,i)=> i===0 || v > o.need[i-1]);
  o.needTotal = o.need.reduce((a,c)=>a+c,0);
  /* 선생님이 날짜를 줄이면 표도 줄어든다 */
  const gd0 = G.set.goalDay; G.set.goalDay = 8; W.__xpReset();
  o.shortTotal = (()=>{ let t=0; for(let L=1;L<W.__LV_MAX;L++) t+=W.__XP_NEED[L]; return t; })();
  G.set.goalDay = gd0; W.__xpReset();

  /* ── 시작 상태 ── */
  o.startLv = X.lv; o.startPts = X.pts; o.startSt = X.st.slice();

  /* ── 경험치를 받으면 레벨이 오르고 점수가 생긴다 ── */
  const before = X.lv;
  W.__xpGain(W.__XP_NEED[1] + W.__XP_NEED[2] + 5);
  o.afterLv = X.lv; o.afterPts = X.pts;
  o.ptsMatch = (X.pts === 1 + (X.lv - 1));      // 처음 1점 + 레벨마다 1점

  /* ── 스텟이 실제로 값을 바꾼다 ── */
  const base = {mine:W.__mineTime(), work:W.__workSec('arrow'), fix:W.__fixSec(),
                up:W.__upSec(), hp:W.__maxHP(), atk:W.__atkMul(), def:W.__defNow(),
                bonus:W.__mineBonus()};
  W.__xpGain(999999);                            // 만렙까지
  o.capLv = X.lv; o.capXp = X.xp;
  o.capPts = X.pts;
  X.pts = 60;                                   // 여섯 스텟을 다 확인하려고 점수를 넉넉히
  for(let i=0;i<6;i++) for(let k=0;k<3;k++) W.__takeStat(i);
  const now = {mine:W.__mineTime(), work:W.__workSec('arrow'), fix:W.__fixSec(),
               up:W.__upSec(), hp:W.__maxHP(), atk:W.__atkMul(), def:W.__defNow(),
               bonus:W.__mineBonus()};
  o.mineFaster = now.mine < base.mine;
  o.workFaster = now.work < base.work && now.fix < base.fix && now.up < base.up;
  o.hpUp = now.hp > base.hp;
  o.atkUp = now.atk > base.atk;
  o.defUp = now.def > base.def;
  o.bonusUp = now.bonus > base.bonus;
  o.vals = `캐기 ${base.mine.toFixed(3)}→${now.mine.toFixed(3)}s · 짓기 ${base.work.toFixed(2)}→${now.work.toFixed(2)}s`
    + ` · 체력 ${base.hp}→${now.hp} · 공격 ×${base.atk.toFixed(2)}→×${now.atk.toFixed(2)}`
    + ` · 방어 ${base.def}→${now.def} · 캐는양 +${now.bonus}`;

  /* ── 점수보다 많이 못 찍는다 · 최대치를 넘길 수 없다 ── */
  for(let i=0;i<40;i++) W.__takeStat(0);
  o.noOverMax = X.st[0] <= W.__STATS[0].max;
  X.pts = 0; const st1 = X.st.slice(); W.__takeStat(1);
  o.noFreePts = (X.st.join('') === st1.join(''));

  /* ── 만렙에서는 경험치가 안 쌓인다 ── */
  X.pts = 0;
  const xpAtCap = X.xp; W.__xpGain(5000);
  o.capNoGain = (X.lv === W.__LV_MAX && X.xp === xpAtCap && X.pts === 0);

  /* ── 무엇을 하면 경험치가 오르나 ── */
  W.__xpReset();
  const gains = {};
  const probe = (name, f)=>{ const a = X.xp + 0; f(); gains[name] = X.xp - a; };
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  /* 캐기 */
  const node = W.__NODES.find(n=>n.alive && n.type==='tree');
  probe('mine', ()=>{ for(let k=0;k<2;k++) W.__hitNode(node); });
  /* 짓기 */
  const d = W.__DIRS[0]; G.me.g = 0;
  let px=null;
  for(let pp=-8; pp<=8 && !px; pp+=0.5){
    const x=Math.round(d.dx*42-d.dz*pp), z=Math.round(d.dz*42+d.dx*pp);
    if(W.__canPlace('swall',x,z)===null) px=[x,z];
  }
  probe('build', ()=>{ W.__place('swall', px[0], px[1]); });
  const built = [...W.__STRU.values()].pop();
  probe('up', ()=>{ W.__up(built); });
  probe('fix', ()=>{ built.hp = built.mx*0.5; W.__repair ? W.__repair(built) : 0; });
  o.gainMine = gains.mine; o.gainBuild = gains.build; o.gainUp = gains.up;

  /* ── 늑대 ── */
  o.hpMul = W.__BAL.hpMul;
  o.chaseMin = W.__BAL.chaseMin; o.chaseCap = W.__BAL.chaseCap;
  o.sheepSpd = 5.4;
  o.chaseBudget = W.__BAL.chaseBudget;
  o.waveCap = W.__BAL.waveCap;
  o.wave12 = W.__waveFor(12).kinds.length;
  o.wave15 = W.__waveFor(15).kinds.length;
  const w1 = W.__spawnWolf(0,0);
  o.w1spd = w1.spd; o.w1chLeft = w1.chLeft;
  G.day = 15; const w15 = W.__spawnWolf(0,0);
  o.w15spd = w15.spd;
  G.day = 1;
  o.maxw = 92;

  /* ── 탑 개수 제한이 풀렸나 ── */
  o.caps = ['arrow','ice','barr'].map(t=> W.__BUILD[t].cap === undefined ? '없음' : W.__BUILD[t].cap);
  return o;
});

ok('만렙은 10', r.lvMax === 10, r.lvMax);
ok('레벨이 오를수록 필요한 경험치가 는다', r.needRises, r.need.join('/'));
ok('★ 만렙까지 필요한 경험치 합계 (성실한 아이 15일치)', r.needTotal > 8000 && r.needTotal < 11000, r.needTotal);
ok('★ 선생님이 날짜를 줄이면 표도 같이 줄어든다 (8일 = 15일의 절반쯤)',
   Math.abs(r.shortTotal/r.needTotal - 8/15) < 0.02, r.shortTotal + ' / ' + r.needTotal);
ok('처음엔 레벨 1 · 점수 1 · 스텟 0', r.startLv===1 && r.startPts===1 && r.startSt.every(v=>v===0));
ok('경험치를 받으면 레벨이 오른다', r.afterLv === 3, 'Lv'+r.afterLv);
ok('★ 레벨마다 점수가 딱 한 점씩 (처음 1점 + 레벨마다 1점)', r.ptsMatch, r.afterPts+'점');
ok('만렙에 닿으면 거기서 멈춘다', r.capLv === 10, 'Lv'+r.capLv);
ok('★ 만렙 뒤에는 경험치가 더 안 쌓인다', r.capNoGain);
ok('★ 점수가 없으면 못 찍는다', r.noFreePts);
ok('★ 스텟은 최대치를 못 넘는다', r.noOverMax);
ok('⛏️ 캐는 손 — 캐는 시간이 준다', r.mineFaster);
ok('🔨 빠른 망치 — 짓기·강화·수리 시간이 준다', r.workFaster);
ok('❤️ 튼튼한 양 — 최대 체력이 는다', r.hpUp);
ok('🎯 사격 솜씨 — 공격이 세진다', r.atkUp);
ok('🛡️ 가죽 등 — 방어가 는다', r.defUp);
ok('🎒 큰 주머니 — 캐는 양이 는다', r.bonusUp);
ok('   (값)', true, r.vals);
ok('★ 자원을 캐면 경험치를 준다', r.gainMine > 0, r.gainMine);
ok('★ 건물을 지으면 경험치를 준다', r.gainBuild > 0, r.gainBuild);
ok('★ 강화하면 경험치를 준다', r.gainUp > 0, r.gainUp);
ok('★ 늑대 체력 3.1배 (예전 1.85배)', r.hpMul === 3.10, r.hpMul);
ok('★ 쫓을 때 늑대는 반드시 양(5.4)보다 빠르다', r.chaseMin > r.sheepSpd,
   `최소 ${r.chaseMin} > 양 ${r.sheepSpd}`);
ok('그래도 너무 빠르진 않다 (9살이 손 쓸 수 있게)', r.chaseCap <= 7, r.chaseCap);
ok('★ 헛쫓으면 포기하는 시간이 있다 (양만 따라다니는 바보가 안 되게)',
   r.chaseBudget > 0 && r.chaseBudget < 12, r.chaseBudget + '초');
ok('늑대가 태어날 때 그 시간을 들고 나온다', r.w1chLeft === r.chaseBudget, r.w1chLeft);
ok('★ 날이 갈수록 늑대가 빨라진다', r.w15spd > r.w1spd * 1.3,
   `1일차 ${r.w1spd.toFixed(2)} → 15일차 ${r.w15spd.toFixed(2)}`);
ok('★ 12일차와 15일차의 마리수가 갈린다 (예전엔 둘 다 상한에 걸려 같았다)',
   r.wave15 > r.wave12, `${r.wave12}마리 → ${r.wave15}마리`);
ok('마리수 상한이 늑대 렌더 상한을 안 넘는다 (보스 부하까지)',
   r.waveCap + 14 <= r.maxw, `${r.waveCap}+14 <= ${r.maxw}`);
ok('★ 화살탑·얼음탑·배럭 개수 제한이 풀렸다', r.caps.every(v=>v==='없음'), r.caps.join('/'));

/* ── 쫓다가도 옆에 건물·수정이 있으면 그것부터, 양이 다시 오면 또 양 ── */
const sw = await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, o={};
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  /* 나무·바위를 치워 길을 비운다 (안 그러면 늑대가 그것에 막혀 결과가 흔들린다) */
  for(const n of W.__NODES) if(n.alive){ n.alive=false; for(const h of n.hs) W.__bset(h,false); n.shown=0; }
  const d = W.__DIRS[0]; G.me.g = 0;
  G.day = 8; G.crystal = G.set.crystalMax; W.__goNight();

  const setup = (withWall)=>{
    W.__clear();
    let wall = null;
    if(withWall){
      for(let pp=-6; pp<=6 && !wall; pp+=0.5){
        const x=Math.round(d.dx*30-d.dz*pp), z=Math.round(d.dz*30+d.dx*pp);
        if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
          wall=[...W.__STRU.values()].pop(); wall.lv=4;
          wall.mx=W.__bs('swall','hp',4); wall.hp=wall.mx; }
      }
    }
    W.__rebuild();
    G.wolves.length=0; W.__spawnQ().length=0;
    const w = W.__spawnWolf(0,0);
    /* 늑대는 벽 바로 옆에, 양은 5칸 떨어진 곳에 (벽이 더 가깝다) */
    const wx = wall ? W.__struCX(wall) : d.dx*30, wz = wall ? W.__struCZ(wall) : d.dz*30;
    w.x = wx + d.dx*2.2; w.z = wz + d.dz*2.2;
    w.y = W.__solidTop(Math.floor(w.x), Math.floor(w.z));
    PL.x = w.x + d.dx*5.0; PL.z = w.z + d.dz*5.0;
    PL.y = W.__solidTop(Math.floor(PL.x), Math.floor(PL.z));
    PL.hp = 99999; PL.down = false;
    return {w, wall};
  };

  /* ① 벽이 있으면 — 양을 놓고 벽을 문다 */
  {
    const {w, wall} = setup(true);
    const hp0 = wall ? wall.hp : 0;
    let chased = 0, n = 0;
    for(let i=0;i<90;i++){ W.__step(1, 1/30); if(w.shT) chased++; n++; }
    o.wallThere = !!wall;
    o.wallChase = chased/n;
    o.wallHurt = wall ? hp0 - wall.hp : 0;
  }
  /* ② 벽이 없으면 — 그냥 양을 쫓는다 */
  {
    const {w} = setup(false);
    let chased = 0, n = 0;
    for(let i=0;i<90;i++){ W.__step(1, 1/30); if(w.shT) chased++; n++; }
    o.openChase = chased/n;
  }
  /* ③ 벽을 물던 늑대 옆으로 양이 오면 다시 양으로 */
  {
    const {w, wall} = setup(true);
    for(let i=0;i<60;i++) W.__step(1, 1/30);        // 벽을 물게 둔다
    o.beforeBack = w.shT;
    PL.x = w.x + 0.9; PL.z = w.z + 0.9;             // 양이 코앞으로 왔다
    PL.y = W.__solidTop(Math.floor(PL.x), Math.floor(PL.z));
    for(let i=0;i<10;i++) W.__step(1, 1/30);
    o.afterBack = w.shT;
  }
  /* ④ 수정이 코앞이면 수정부터 */
  {
    W.__clear(); W.__rebuild();
    G.wolves.length=0; W.__spawnQ().length=0;
    const w = W.__spawnWolf(0,0);
    /* 수정이 뚜렷하게 더 가까운 자리에 세운다 —
       양이 조금 더 가까운 정도로는 안 바꾼다(딸꾹질 방지용 여유, sheepBias). */
    w.x = d.dx*3.0; w.z = d.dz*3.0;                  // 수정에서 3칸
    w.y = W.__solidTop(Math.floor(w.x), Math.floor(w.z));
    PL.x = w.x + d.dx*6.0; PL.z = w.z + d.dz*6.0;    // 양은 6칸
    PL.y = W.__solidTop(Math.floor(PL.x), Math.floor(PL.z));
    PL.hp = 99999; PL.down = false;
    const c0 = G.crystal;
    let chased=0, n=0;
    for(let i=0;i<90;i++){ W.__step(1, 1/30); if(w.shT) chased++; n++; }
    o.cryChase = chased/n;
    o.cryLoss = c0 - G.crystal;
  }
  return o;
});
ok('★ 쫓다가도 옆에 벽이 더 가까우면 벽부터 문다 (쫓는 비율)',
   sw.wallThere && sw.wallChase < 0.25, (sw.wallChase*100).toFixed(0)+'%');
ok('★ 그 벽이 실제로 깎인다', sw.wallHurt > 0, Math.round(sw.wallHurt));
ok('★ 옆에 아무것도 없으면 그냥 양을 쫓는다',
   sw.openChase > 0.6, (sw.openChase*100).toFixed(0)+'%');
ok('★ 벽을 물던 늑대도 양이 코앞에 오면 다시 양으로 돌아온다',
   sw.beforeBack === false && sw.afterBack === true,
   '벽 물 때 ' + sw.beforeBack + ' → 양이 오면 ' + sw.afterBack);
ok('★ 수정이 코앞이면 양을 두고 수정부터 깎는다',
   sw.cryChase < 0.3 && sw.cryLoss > 0,
   '쫓는 비율 ' + (sw.cryChase*100).toFixed(0) + '% · 수정 -' + Math.round(sw.cryLoss));

/* ── 스텟 창(C)이 열리고 눌러서 찍히나 ── */
const ui = await pg.evaluate(async ()=>{
  const W=window, o={};
  W.__xpReset(); W.__xpGain(99999);           // 점수 10점
  const ev = k => document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  addEventListener('keydown', ()=>{}, {once:true});
  dispatchEvent(new KeyboardEvent('keydown',{key:'c'}));
  await new Promise(r=>setTimeout(r,60));
  o.opened = document.getElementById('popStat').classList.contains('on');
  const cards = document.querySelectorAll('#stList .stIt');
  o.cards = cards.length;
  const st0 = W.__XP.st[0];
  cards[0].querySelector('button').click();
  o.clicked = W.__XP.st[0] === st0 + 1;
  o.stillOpen = document.getElementById('popStat').classList.contains('on');
  o.refreshed = /1\/5/.test(cards[0].textContent) || /1\/5/.test(document.querySelector('#stList .stIt').textContent);
  dispatchEvent(new KeyboardEvent('keydown',{key:'c'}));
  await new Promise(r=>setTimeout(r,60));
  o.closed = !document.getElementById('popStat').classList.contains('on');
  /* HUD 레벨 줄 */
  W.__paintHUD();
  o.chip = document.getElementById('lvChip').textContent;
  o.pts  = document.getElementById('lvPts').textContent;
  o.barW = document.getElementById('xpFill').style.width;
  return o;
});
ok('★ C 를 누르면 스텟 창이 열린다', ui.opened);
ok('스텟이 여섯 개 다 나온다', ui.cards === 6, ui.cards + '개');
ok('★ ＋ 를 누르면 실제로 찍힌다', ui.clicked);
ok('찍어도 창이 안 닫힌다 (연달아 찍을 수 있게)', ui.stillOpen);
ok('찍으면 창이 바로 다시 그려진다', ui.refreshed);
ok('C 를 다시 누르면 닫힌다', ui.closed);
ok('★ HUD 에 레벨이 뜬다', /Lv\.\d+/.test(ui.chip), ui.chip);
ok('★ 남은 점수가 HUD 에 뜬다', /＋/.test(ui.pts), ui.pts);

let pass=0, fail=0;
for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); c?pass++:fail++; }
console.log('\n' + (fail?`${fail}개 실패 / `:'') + `${pass}항목 통과`);
console.log(errs.length ? '\n오류: '+errs.slice(0,6).join(' | ') : '\n(오류 없음)');
await b.close(); srv.close();
process.exit(fail?1:0);
