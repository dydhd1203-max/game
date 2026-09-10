/* 19차 검사 — 🌷 꽃밭 · 🐰 짝꿍 · 새 꾸미기 · 시작 화면이 안 잘리나
   ★ 값을 검사에 베끼지 않는다. 상한·값·거리는 전부 게임의 __GRD() 에 물어보고,
     개수는 표에서 세어서 관계만 본다(갈래 개수를 박아 두고 17차d에 데었다).
   ★ '큰 글씨로 정한 것이 실제로 큰가'(18차h)와 같은 결 — 화면이 잘리는지는
     눈이 아니라 자로 잰다. 시작 화면 제목 자리를 열 가지 크기에서 잰다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12300);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

/* ═══════ ① 시작 화면 — 제목이 잘리지 않나 (열 가지 교실 크기) ═══════
   ★ 17차g에 카드가 109px 넘쳐 제목이 화면 밖으로 나가 있었는데, 눈으로는
     "좀 기네" 정도라 몇 판을 그냥 지나쳤다. 그때 고친 뒤로 이걸 지키는 검사가 없어서
     19차에 짝꿍 줄을 더하자 다시 −27px 로 잘렸다. 이제 자로 잰다. */
const SIZES = [[1366,768],[1366,912],[1280,800],[1280,720],[1024,768],
               [1024,600],[912,1368],[820,1180],[760,420],[420,880]];
for(const [w,h] of SIZES){
  const ctx = await b.newContext({viewport:{width:w,height:h}});
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  const r = await pg.evaluate(()=>{
    const t = document.getElementById('title');
    const h1 = document.querySelector('#titleCard h1');
    const q = h1.getBoundingClientRect();
    const btn = document.getElementById('bSolo').getBoundingClientRect();
    const scr = t.scrollHeight - t.clientHeight;      // 스크롤로 더 갈 수 있는 만큼
    return {top:Math.round(q.top), left:Math.round(q.left),
            /* 아래쪽은 스크롤로 닿을 수 있으면 된다 */
            reach: Math.round(btn.bottom) <= t.clientHeight + scr + 2};
  });
  ok(`${w}×${h} — 제목이 화면 위로 안 잘린다`, r.top >= 0, '제목 top '+r.top+'px');
  ok(`${w}×${h} — 시작 단추까지 닿는다`, r.reach);
  await ctx.close();
}

const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});

/* ═══════ ② 목록 — 아이콘·이름이 본 배열과 길이가 같나 ═══════
   ★ SHEEP_BITE 때와 같은 함정이다. 한 칸이 밀리면 오류가 아니라 **조용히 딴 것**이 나온다. */
const lists = await pg.evaluate(()=>{
  const W=window;
  return {hat:[W.__HATS.length, W.__HAT_N.length],
          gls:[W.__GLASSES.length, W.__GLS_N.length],
          clo:[W.__CLOTHES.length, W.__CLO_N.length],
          pet:[W.__PETS.length, W.__PET_ICON.length, W.__PET_NAME.length,
               W.__PET_HOP().length, W.__PET_FLY().length],
          /* 예전 번호가 안 밀렸나 — 새것은 반드시 배열 '끝' 에 붙어야 한다 */
          oldHat: W.__HAT_N[8], oldClo: W.__CLO_N[8],
          newHat: W.__HAT_N.slice(11), newClo: W.__CLO_N.slice(9)};
});
ok('모자 아이콘·이름 길이가 본 배열과 같다', lists.hat[0]===lists.hat[1], lists.hat.join('/'));
ok('안경 아이콘·이름 길이가 본 배열과 같다', lists.gls[0]===lists.gls[1], lists.gls.join('/'));
ok('옷 아이콘·이름 길이가 본 배열과 같다', lists.clo[0]===lists.clo[1], lists.clo.join('/'));
ok('짝꿍 표 다섯 줄(모형·아이콘·이름·뜀·낢)의 길이가 같다',
   new Set(lists.pet).size === 1, lists.pet.join('/'));
ok('★ 새것을 목록 끝에 넣었다 — 예전 번호가 안 밀렸다 (17차g에 통째로 밀렸던 자리)',
   lists.oldHat === '꽃 화관' && lists.oldClo === '별무늬 잠옷',
   '8번 모자 '+lists.oldHat+' · 8번 옷 '+lists.oldClo);
ok('새 모자·새 옷이 실제로 늘었다', lists.newHat.length===2 && lists.newClo.length===2,
   lists.newHat.join(',')+' / '+lists.newClo.join(','));

/* ═══════ ③ 꾸미기 조각 칸이 '제일 많이 걸친 아이' 보다 넉넉한가 ═══════
   ★ 17차f에 딱 맞는 칸(18)이 모자라 조각이 조용히 잘렸다. '딱 맞는 칸은 모자란 칸' 이다.
     개수를 검사에 박지 않고 표에서 세어 칸과 맞대 본다. */
const deco = await pg.evaluate(()=>{
  const W=window;
  const mx = a => Math.max(...a.map(x=>x.length));
  const job = Math.max(...W.__JOB_LOOK.map(j=>Math.max(...j.map(t=>t.length))));
  const worst = mx(W.__HATS) + mx(W.__GLASSES) + mx(W.__CLOTHES) + job;
  return {worst, cap: W.__Pdeco().count_max, maxp: W.__Pdeco().count_max /
          (mx(W.__HATS)+mx(W.__GLASSES)+mx(W.__CLOTHES)+job)};
});
ok('★ 제일 많이 걸친 아이의 조각이 한 사람 칸에 들어간다 (딱 맞는 칸은 모자란 칸이다)',
   deco.maxp >= 21, '한 사람 최대 '+deco.worst+'조각 · 칸 '+deco.cap+' (사람 '+deco.maxp.toFixed(1)+'명분)');

/* 게임 시작 */
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1600);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ④ 꽃 심기 도구 ═══════ */
const tool = await pg.evaluate(()=>{
  const W=window;
  const t = W.__TOOLS.find(x=>x.id==='plant');
  W.__selTool('plant');
  return {있나:!!t, 키:t?t.key:'', 고름:W.__curTool()==='plant',
          아이콘:t?t.icon:'', 칸:[...document.querySelectorAll('#tools .slot')].length};
});
ok('🌷 꽃 심기 도구가 있다', tool.있나 && tool.아이콘==='🌷');
ok('도구 칸에 꽃 심기가 그려진다', tool.칸 === 5, tool.칸+'칸');
ok('꽃 심기를 고를 수 있다 ('+tool.키+' 키)', tool.고름);

/* ═══════ ⑤ 어디에 심을 수 있고 어디는 안 되나 ═══════ */
const where = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  W.__base[G.me.g].w = 900; W.__base[G.me.g].s = 900; W.__recompute();
  /* 마당 안 평평한 빈 칸을 '찾아서' 쓴다 — 지형이 무작위라 자리를 박으면 흔들린다 */
  let free = null;
  for(let r=11; r<=24 && !free; r++) for(let a=0; a<360; a+=5){
    const X=Math.round(Math.cos(a*Math.PI/180)*r), Z=Math.round(Math.sin(a*Math.PI/180)*r);
    if(!W.__grdCheck(X,Z)){ free=[X,Z]; break; }
  }
  o.빈칸 = free;
  o.빈칸이유 = free ? W.__grdCheck(free[0], free[1]) : '못 찾음';
  o.수정코앞 = W.__grdCheck(1, 1);
  /* 산 밖 — 세상 끝 근처 */
  o.산밖 = W.__grdCheck(120, 120);
  /* 농장 한가운데 */
  const FX=W.__FARM_X(), FZ=W.__FARM_Z();
  o.농장 = W.__grdCheck(Math.round(FX[0]), Math.round(FZ[0]));
  /* 상인 좌판 */
  const S = W.__SHOP();
  o.상인 = W.__grdCheck(Math.round(S.x-0.5), Math.round(S.z-0.5));
  /* 나무·바위 자리 */
  const n = W.__NODES.find(q=>q.alive);
  o.자원 = n ? W.__grdCheck(n.x, n.z) : '없음';
  return o;
});
ok('마당 안 평평한 빈 칸에는 심을 수 있다', where.빈칸 && where.빈칸이유 === null,
   where.빈칸 ? where.빈칸.join(',') : String(where.빈칸이유));
ok('수정 코앞에는 못 심는다', typeof where.수정코앞 === 'string', where.수정코앞);
ok('산에는 못 심는다', typeof where.산밖 === 'string', where.산밖);
ok('농장 우리 안에는 못 심는다', typeof where.농장 === 'string', where.농장);
ok('상인 좌판 자리에는 못 심는다', typeof where.상인 === 'string', where.상인);
ok('나무·바위 자리에는 못 심는다', typeof where.자원 === 'string', where.자원);

/* ═══════ ⑥ 심으면 무슨 일이 생기나 ═══════ */
const plant = await pg.evaluate(([X,Z])=>{
  const W=window, G=W.__G, o={};
  /* ★ 경험치는 XP.xp 하나로 재면 안 된다 — 레벨이 오르는 순간 그 값은 줄어든다(README 14차).
     (레벨, 남은 경험치) 짝으로 본다. */
  const before = {w:W.__myRes().w, fl:W.__MY.flowers|0,
                  lv:W.__XP.lv, xp:W.__XP.xp, n:G.garden.length};
  W.__PL.x = X+0.5; W.__PL.z = Z+0.5;
  W.__plantFlower(X,Z);
  const f = G.garden[G.garden.length-1];
  o.늘었나 = G.garden.length - before.n;
  o.나무 = before.w - W.__myRes().w;
  o.값 = W.__GRD().COST.w;
  o.내꽃 = (W.__MY.flowers|0) - before.fl;
  o.경험치 = (W.__XP.lv > before.lv) || (W.__XP.lv === before.lv && W.__XP.xp > before.xp);
  o.경험치값 = W.__XP_PLANT();
  /* 받는 것과 '받는 줄 아는 것' 은 다른 일이다 — 초록 +숫자가 실제로 떴나 */
  o.떴나 = W.__dnLast();
  o.심자마자핌 = !!f.b;
  o.내모둠 = f.g === G.me.g;
  o.이름 = f.n;
  /* 바로 옆(0.5칸)에는 못 심는다 */
  o.바로옆 = W.__grdCheck(X, Z);
  o.틈 = W.__GRD().GAP;
  return o;
}, where.빈칸);
ok('심으면 꽃이 한 송이 는다', plant.늘었나 === 1);
ok('심으면 나무를 값만큼 쓴다', plant.나무 === plant.값, plant.나무+'/'+plant.값);
ok('★ 심은 아이 이름이 남는다 (누가 심었는지)', plant.이름 === '김하늘', plant.이름);
ok('★ 내가 심은 꽃 수가 는다 — 순위판 🌷 갈래가 읽는 칸', plant.내꽃 === 1);
ok('꽃을 심으면 경험치가 오른다', plant.경험치, '+'+plant.경험치값);
ok('★ 받은 경험치가 화면에 초록 +숫자로 뜬다 (안 뜨면 "안 준다" 로 보인다)',
   plant.떴나.cls.indexOf('heal') >= 0 && plant.떴나.txt === '+'+plant.경험치값,
   plant.떴나.txt + ' / ' + plant.떴나.cls);
ok('심자마자 피지는 않는다 (새싹부터다)', !plant.심자마자핌);
ok('꽃끼리 너무 붙으면 못 심는다', typeof plant.바로옆 === 'string', plant.바로옆);

/* ═══════ ⑦ 자라기 — 낮에만 ═══════ */
const grow = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  const B = W.__GRD().BLOOM;
  G.phase = 'night';
  W.__gardenGrow(B*2);
  o.밤에핌 = G.garden.filter(f=>f.b).length;
  G.phase = 'day';
  W.__gardenGrow(B*0.4);
  o.덜자람 = G.garden.filter(f=>f.b).length;
  W.__gardenGrow(B);
  o.활짝 = G.garden.filter(f=>f.b).length;
  o.전체 = G.garden.length;
  return o;
});
ok('★ 밤에는 안 자란다 (낮에 돌보는 일이다)', grow.밤에핌 === 0, grow.밤에핌+'송이');
ok('덜 자라면 아직 안 핀다', grow.덜자람 === 0);
ok('다 자라면 활짝 핀다', grow.활짝 === grow.전체, grow.활짝+'/'+grow.전체);

/* ═══════ ⑧ 꽃향기 — 회복 ═══════ */
const heal = await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, o={};
  const GR = W.__GRD();
  const f = G.garden[0];
  const set = (hp)=>{ PL.hp = hp; PL.down = false; PL.grdHurt = 0; };
  G.phase = 'day';
  /* ① 활짝 핀 꽃 곁 */
  PL.x = f.x; PL.z = f.z; set(40);
  W.__updGarden(1.0, 3);
  o.찼다 = +(PL.hp - 40).toFixed(2);
  o.초당 = GR.HEAL;
  /* ② 물린 직후에는 안 찬다 */
  set(40); PL.grdHurt = GR.HURT;
  W.__updGarden(0.5, 3);
  o.물린뒤 = +(PL.hp - 40).toFixed(2);
  /* ③ 멀면 안 찬다 */
  PL.x = f.x + GR.R + 3; PL.z = f.z; set(40);
  W.__updGarden(1.0, 3);
  o.멀리 = +(PL.hp - 40).toFixed(2);
  /* ④ 아직 안 핀 꽃(새싹) 곁에서는 안 찬다
     ★ 이미 자란 꽃의 b 만 0 으로 되돌려서는 못 잰다 — 자란 시간이 남아 있어서
       gardenGrow 가 그 자리에서 다시 피워 버린다(그렇게 한 번 빨갛게 나왔다).
       진짜 새싹을 하나 새로 심어 놓고, 다 자란 꽃은 멀리 치운다. */
  const keep = G.garden.slice();
  G.garden.length = 0;
  let sp = null;
  for(let r=11; r<=24 && !sp; r++) for(let a=0; a<360; a+=5){
    const X=Math.round(Math.cos(a*Math.PI/180)*r), Z=Math.round(Math.sin(a*Math.PI/180)*r);
    if(!W.__grdCheck(X,Z)){ sp=[X,Z]; break; }
  }
  PL.x = sp[0]+0.5; PL.z = sp[1]+0.5;
  W.__plantFlower(sp[0], sp[1]);
  o.새싹인가 = !G.garden[0].b;
  set(40); W.__updGarden(1.0, 3);
  o.새싹 = +(PL.hp - 40).toFixed(2);
  G.garden.length = 0; for(const q of keep) G.garden.push(q);
  PL.x = f.x; PL.z = f.z;
  /* ⑤ 여러 송이가 겹쳐도 빨라지지 않는다 (한 칸에 몰아 심기 방지) */
  o.곁에몇 = W.__grdNear(f.x, f.z);
  set(40); W.__updGarden(1.0, 3);
  o.겹쳐도 = +(PL.hp - 40).toFixed(2);
  /* ⑥ 체력이 꽉 차면 안 넘친다 */
  const mx = W.__maxHP();
  set(mx - 0.5); W.__updGarden(2.0, 3);
  o.안넘침 = PL.hp <= mx + 0.001;
  /* ⑦ 미니게임 중에는 안 찬다 */
  G.phase = 'mini'; set(40); W.__updGarden(1.0, 3);
  o.미니 = +(PL.hp - 40).toFixed(2);
  G.phase = 'day';
  /* ⑧ 쓰러진 아이는 안 찬다 — 일으켜 줘야 한다 */
  set(40); PL.down = true; W.__updGarden(1.0, 3); PL.down = false;
  o.쓰러짐 = +(PL.hp - 40).toFixed(2);
  return o;
});
ok('★ 활짝 핀 꽃 곁에 서면 체력이 찬다 (밤중에 회복할 길이 여태 없었다)',
   Math.abs(heal.찼다 - heal.초당) < 0.01, '1초에 +'+heal.찼다);
ok('★ 물린 직후에는 안 낫는다 (꽃밭에 서서 버티는 판이 안 되게)', heal.물린뒤 === 0);
ok('꽃향기 밖에서는 안 낫는다', heal.멀리 === 0);
ok('아직 안 핀 새싹 곁에서는 안 낫는다', heal.새싹인가 && heal.새싹 === 0,
   '새싹 +'+heal.새싹);
ok('★ 여러 송이가 겹쳐도 빨라지지 않는다 (한 칸에 몰아 심기 방지)',
   Math.abs(heal.겹쳐도 - heal.초당) < 0.01, '곁에 '+heal.곁에몇+'송이인데 +'+heal.겹쳐도);
ok('체력이 꽉 차면 안 넘친다', heal.안넘침);
ok('미니게임 중에는 안 낫는다', heal.미니 === 0);
ok('쓰러진 아이는 꽃으로 못 일어난다 (친구가 와야 한다)', heal.쓰러짐 === 0);

/* 실제로 물려 봐도 잠기나 — 값을 베끼지 않고 게임의 무는 코드를 그대로 돌린다 */
const bite = await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL;
  const f = G.garden[0];
  G.phase = 'night'; G.paused = false; G.started = true;
  PL.x = f.x; PL.z = f.z; PL.y = W.__terrAt(Math.floor(f.x), Math.floor(f.z));
  PL.down = false; PL.hp = 60; PL.biteT = 0; PL.grdHurt = 0;
  G.wolves.length = 0; W.__spawnQ().length = 0;
  const w = W.__spawnWolf(0, 0);
  w.x = PL.x + 0.5; w.z = PL.z; w.y = PL.y; w.jy = 0;
  W.__sheepHurt(0.02);
  const after = PL.grdHurt;
  G.wolves.length = 0; G.phase = 'day';
  return {잠김: after > 0, 값: W.__GRD().HURT, 실제: +after.toFixed(2)};
});
ok('★ 늑대에게 물리면 꽃향기가 잠긴다 (게임의 무는 코드를 그대로 돌려서 확인)',
   bite.잠김, bite.실제+'초 (규칙 '+bite.값+'초)');

/* ═══════ ⑨ 상한과 그리는 칸 ═══════ */
const cap = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  const GR = W.__GRD();
  /* 우리 모둠 상한까지 꽉 채운다 */
  let guard = 0;
  while(W.__grdMine() < GR.CAP && guard++ < 4000){
    let done = false;
    for(let r=10; r<=26 && !done; r++) for(let a=0; a<360; a+=3){
      const X=Math.round(Math.cos(a*Math.PI/180)*r), Z=Math.round(Math.sin(a*Math.PI/180)*r);
      if(W.__grdCheck(X,Z)) continue;
      W.__PL.x = X+0.5; W.__PL.z = Z+0.5; W.__plantFlower(X,Z); done = true; break;
    }
    if(!done) break;
  }
  o.내꽃 = W.__grdMine(); o.상한 = GR.CAP;
  /* 상한을 넘으면 못 심는다 */
  let msg = null;
  for(let r=10; r<=26 && !msg; r++) for(let a=0; a<360; a+=3){
    const X=Math.round(Math.cos(a*Math.PI/180)*r), Z=Math.round(Math.sin(a*Math.PI/180)*r);
    const m = W.__grdCheck(X,Z);
    if(m && m.indexOf('송이') >= 0){ msg = m; break; }
  }
  o.상한말 = msg;
  /* 다섯 모둠이 다 채웠다고 치고 그려 본다 — 칸이 안 넘치나 */
  const one = G.garden.slice();
  for(let g=1; g<W.__DIRS.length; g++)
    for(const f of one) G.garden.push({...f, i:f.i+'_'+g, g, x:f.x+0.02*g, z:f.z+0.02*g, b:1});
  /* ★ 제일 많이 그리는 때 = 일흔 송이가 **다** 피었을 때다. 새싹은 조각이 셋뿐이라
     섞여 있으면 여유가 있는 것처럼 보인다 — 그래서 다 피워 놓고 잰다. */
  for(const f of G.garden) f.b = 1;
  G.phase = 'day';
  W.__updGarden(0.016, 5);
  const M = W.__grdMesh();
  o.칸 = M.map(m=>[m.count, m.instanceMatrix.count]);
  o.넘침 = M.some(m=>m.count > m.instanceMatrix.count);
  o.꽃수 = G.garden.length; o.최대 = GR.MAX;
  /* 한 송이가 쓰는 조각 — 18차g에 산물에서 배운 것: 덩어리가 많으면 탑이 된다 */
  o.송이당 = M[0].count / G.garden.length;
  /* 조각 하나가 너무 크지 않나 */
  let big = 0;
  for(let i=0;i<M[0].count;i++){
    const e = M[0].instanceMatrix.array, o2 = i*16;
    if(Math.max(e[o2], e[o2+5], e[o2+10]) > 0.30) big++;
  }
  o.큰조각 = big;
  /* 꽃 키 — 지형 높이가 칸마다 다르므로 한 송이만 남기고 그 칸의 땅 높이로 잰다 */
  const all = G.garden.slice();
  const one2 = all[0];
  G.garden.length = 0; G.garden.push(one2);
  W.__updGarden(0.016, 5);
  const gy = W.__terrAt(Math.floor(one2.x), Math.floor(one2.z));
  let top = -1e9, bot = 1e9;
  for(let i=0;i<M[0].count;i++){
    const e = M[0].instanceMatrix.array, o2 = i*16;
    top = Math.max(top, e[o2+13] + e[o2+5]/2);
    bot = Math.min(bot, e[o2+13] - e[o2+5]/2);
  }
  o.키 = +(top - gy).toFixed(2);
  o.땅에붙나 = +(bot - gy).toFixed(2);
  G.garden.length = 0; for(const q of all) G.garden.push(q);
  W.__updGarden(0.016, 5);
  return o;
});
ok('모둠당 상한까지 심을 수 있다', cap.내꽃 === cap.상한, cap.내꽃+'/'+cap.상한);
ok('상한을 넘으면 까닭을 알려 준다', !!cap.상한말, cap.상한말);
ok('★ 다섯 모둠이 다 채우고 다 피어도 그릴 칸이 안 넘친다 (넘치면 오류 없이 조용히 잘린다)',
   !cap.넘침, cap.꽃수+'송이 · '+cap.칸.map(x=>x[0]+'/'+x[1]).join(' · '));
ok('★ 그 칸에 여유가 있다 (딱 맞는 칸은 모자란 칸이다)',
   cap.칸.every(x=> x[0] <= x[1]*0.9), cap.칸.map(x=>Math.round(x[0]/x[1]*100)+'%').join(' · '));
ok('꽃 하나가 덩어리 여덟을 안 넘는다 (탑처럼 안 보이게)', cap.송이당 <= 8,
   cap.송이당.toFixed(1)+'덩어리');
ok('조각 하나가 0.30칸을 안 넘는다', cap.큰조각 === 0, cap.큰조각+'개');
ok('꽃 키가 0.6칸을 안 넘는다 (폭보다 키가 크면 탑이 된다 — 18차g)',
   cap.키 > 0 && cap.키 <= 0.6, cap.키+'칸');
ok('꽃이 땅에 붙어 있다 (공중에 안 뜬다)', Math.abs(cap.땅에붙나) < 0.12,
   '제일 아래 조각 '+cap.땅에붙나+'칸');

/* ═══════ ⑩ 색 — 어두운 색을 칠하면 검은 상자가 된다 ═══════ */
const col = await pg.evaluate(()=>{
  const W=window;
  const lum = c => (((c>>16)&255)*0.299 + ((c>>8)&255)*0.587 + (c&255)*0.114) / 255;
  const petal = W.__PETAL.map(p=>[p.n, +lum(p.p).toFixed(2), +lum(p.m).toFixed(2)]);
  let dark = [];
  for(const [n,a,c] of petal) if(a < 0.45 || c < 0.45) dark.push(n);
  /* 짝꿍 조각도 같이 본다 — 눈·코처럼 일부러 까만 점은 작은 조각뿐이어야 한다 */
  let petDark = [];
  W.__PETS.forEach((p,i)=>{ for(const q of p)
    if(lum(q[6]) < 0.30 && Math.max(q[3],q[4],q[5]) > 0.14) petDark.push(W.__PET_NAME[i]); });
  return {petal, dark, petDark:[...new Set(petDark)]};
});
ok('★ 꽃 빛깔이 다 밝다 (색은 텍스처에 곱해진다 — 어두우면 검은 상자가 된다)',
   col.dark.length === 0, col.dark.join(',') || col.petal.length+'가지');
ok('짝꿍 몸에 큰 어두운 조각이 없다 (눈·코만 까맣다)',
   col.petDark.length === 0, col.petDark.join(','));

/* ═══════ ⑪ 순위판 — 🌷 갈래 ═══════ */
const rank = await pg.evaluate(()=>{
  const W=window, o={};
  const cats = W.__RANK_CATS.map(c=>c.k);
  o.있나 = cats.includes('flw');
  /* 아무도 안 심었으면 안 돈다 */
  W.__pcMap.clear();
  W.__pcMap.set('a', {n:'가', g:0, lv:3, flw:0});
  o.빈갈래 = W.__rankCats().map(c=>c.k).includes('flw');
  W.__pcMap.set('a', {n:'가', g:0, lv:3, flw:4});
  o.심으면 = W.__rankCats().map(c=>c.k).includes('flw');
  /* pc 통로에 실리나 */
  W.__MY.flowers = 7; W.__syncMyPC();
  o.통로 = W.__myPC().flw;
  o.갈래수 = cats.length;
  return o;
});
ok('★ 순위판에 🌷 꽃 갈래가 있다 (잘한 아이의 이름이 남는 자리)', rank.있나);
ok('아무도 안 심었으면 그 갈래는 안 돈다', !rank.빈갈래);
ok('한 명이라도 심으면 갈래가 돈다', rank.심으면);
ok('심은 꽃 수가 pc 통로로 나간다', rank.통로 === 7, String(rank.통로));
ok('길이 여러 갈래로 남는다 (쏘기 말고도)', rank.갈래수 >= 7, rank.갈래수+'갈래');

/* ═══════ ⑫ 처음부터 다시 하면 꽃도 지워진다 ═══════ */
const reset = await pg.evaluate(()=>{
  const W=window, G=W.__G;
  const before = G.garden.length;
  W.__gardenReset();
  const M = W.__grdMesh();
  return {before, after:G.garden.length, vis:M.some(m=>m.visible)};
});
ok('★ 처음부터 다시 하면 마당의 꽃도 지워진다 (지난 판 자국이 안 남게)',
   reset.after === 0 && !reset.vis, reset.before+' → '+reset.after);
ok('한 송이도 없으면 꽃 메시가 숨는다 (드로우콜 0)', !reset.vis);

/* ═══════ ⑬ 짝꿍 ═══════ */
const pet = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  const M = W.__petMesh();
  /* 아무도 안 데리고 다니면 숨는다 */
  W.__setPet(0); G.players.clear(); W.__pcMap.clear();
  W.__updPets(0.016, 1);
  o.빈메시 = M.visible;
  /* 고르면 그려진다 */
  W.__setPet(1);
  W.__updPets(0.016, 1);
  o.내짝꿍 = M.count;
  o.토끼조각 = W.__PETS[1].length;
  /* 친구 스물한 명이 제일 조각 많은 짝꿍을 데려와도 칸이 안 넘친다 */
  const big = W.__PETS.reduce((a,p,i)=> p.length > W.__PETS[a].length ? i : a, 0);
  const GY = W.__PL.y;
  for(let i=0;i<21;i++){
    const k='p'+i;
    G.players.set(k, {uid:k, x:W.__PL.x+i*1.5, z:W.__PL.z+3, y:GY, ry:0, n:'ㄱ'+i,
                      g:i%5, hat:0, gls:0, clo:0, mv:false, ph:i, hp:100, down:false});
    W.__pcMap.set(k, {n:'ㄱ'+i, g:i%5, pet:big});
  }
  for(let i=0;i<8;i++) W.__updPets(0.05, 1+i*0.05);
  o.꽉찬칸 = M.count; o.칸 = M.instanceMatrix.count;
  o.넘침 = M.count > M.instanceMatrix.count;
  o.제일큰짝꿍 = W.__PET_NAME[big] + '(' + W.__PETS[big].length + '조각)';
  /* 짝꿍이 주인 곁을 벗어나지 않는다 */
  const R = W.__PET_ORBIT();
  let far = 0;
  for(let t=0; t<60; t++) W.__updPets(0.05, 3+t*0.05);
  for(const [k,q] of G.players){
    const s = W.__petAt().get(k); if(!s) continue;
    if(Math.hypot(s.x-q.x, s.z-q.z) > R + 0.6) far++;
  }
  o.멀리간놈 = far; o.반지름 = R;
  /* 나간 아이의 자리는 지워진다 */
  const n0 = W.__petAt().size;
  G.players.clear(); W.__pcMap.clear();
  W.__updPets(0.05, 9);
  o.자리 = [n0, W.__petAt().size];
  return o;
});
ok('아무도 짝꿍이 없으면 메시가 숨는다 (드로우콜 0)', !pet.빈메시);
ok('짝꿍을 고르면 조각이 올라간다', pet.내짝꿍 === pet.토끼조각,
   pet.내짝꿍+'/'+pet.토끼조각+'조각');
ok('★ 스물두 명이 제일 조각 많은 짝꿍을 데려와도 칸이 안 넘친다',
   !pet.넘침, pet.제일큰짝꿍+' · '+pet.꽉찬칸+'/'+pet.칸);
ok('★ 짝꿍이 주인 곁을 벗어나지 않는다', pet.멀리간놈 === 0,
   '반지름 '+pet.반지름+'칸 · 벗어난 짝꿍 '+pet.멀리간놈+'마리');
ok('나간 아이의 짝꿍 자리는 지워진다 (판이 길어져도 안 쌓인다)',
   pet.자리[1] <= 1, pet.자리.join(' → '));

/* 짝꿍 번호는 pc 통로로 간다 — 자리(위치) 통로에는 칸을 안 더한다 */
const chan = await pg.evaluate(()=>{
  const W=window;
  W.__setPet(3); W.__syncMyPC();
  return {pc: W.__myPC().pet};
});
ok('★ 짝꿍 번호는 pc 통로(초당 1회)로 간다 — 자리 통로(초당 13회)에 칸을 안 더했다',
   chan.pc === 3, String(chan.pc));

/* ═══════ ⑭ 새 꾸미기가 '보이는 창' 안에 있나 ═══════
   ★ 몸통 앞면 f≈0.47 · 머리 f 0.37~0.99 · u 0.74~1.38.
     가슴에서 실제로 보이는 창은 u 0.25~0.74 뿐이다(볼터치·전직 하트가 여기서 사라졌다). */
const win = await pg.evaluate(()=>{
  const W=window, o={};
  /* 새 모자 둘 — 머리 위(u > 1.38)나 머리 앞(f > 0.99)에 있어야 보인다 */
  const hatOK = [11,12].map(i=> W.__HATS[i].every(h=> h[1] > 1.30 || h[0] > 0.99));
  /* 새 옷 둘 — 가슴판은 창(0.25~0.74) 안, 치마는 몸통 옆폭(0.42)보다 넓어야 한다 */
  const clo = [9,10].map(i=>{
    const parts = W.__CLOTHES[i];
    const chest = parts.filter(p=> p[0] > 0.4);                 // 가슴에 붙는 조각
    const wide  = parts.filter(p=> Math.abs(p[0]) < 0.2);        // 몸을 두르는 조각
    return {창밖: chest.filter(p=> p[1] < 0.25 || p[1] > 0.74).length,
            넓은: wide.filter(p=> p[3] > 1.10).length};
  });
  o.hatOK = hatOK; o.clo = clo;
  return o;
});
ok('★ 새 모자가 머리 위(또는 얼굴 앞)에 붙는다 — 털 속에 안 묻힌다',
   win.hatOK.every(Boolean), win.hatOK.join(','));
ok('★ 새 옷의 가슴 조각이 보이는 창(u 0.25~0.74) 안에 있다',
   win.clo.every(c=>c.창밖 === 0), win.clo.map(c=>c.창밖).join(','));
ok('★ 몸을 두르는 옷이 등털(반너비 0.54)보다 넓다 — 안 그러면 털 속에 파묻힌다',
   win.clo.every(c=>c.넓은 > 0), win.clo.map(c=>c.넓은+'조각').join(' · '));

/* ═══════ ⑮ 소리 — 없는 이름을 부르면 조용히 아무것도 안 한다 ═══════ */
const snd = await pg.evaluate(()=>{
  const K = window.__SFX_KEYS();
  return {plant: K.includes('plant'), bloom: K.includes('bloom')};
});
ok('씨앗 심는 소리가 소리 표에 있다 (없는 이름은 조용히 아무것도 안 한다)', snd.plant);
ok('꽃 피는 소리가 소리 표에 있다', snd.bloom);

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
