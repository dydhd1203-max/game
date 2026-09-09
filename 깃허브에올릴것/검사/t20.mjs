/* 17차d·e·f 검사 — 모둠 농장 · 자원 바꾸기 · 전직
   ★ 값을 검사에 박지 않는다. 게임에서 읽어 '관계'만 본다.
     (가격표를 여기에 베껴 두면, 값을 고칠 때마다 검사가 빨간불이 되고
      결국 아무도 검사를 안 믿게 된다.) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12000);
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

/* ═══════ ① 자리 — 모둠마다 하나, 수정 옆, 서로 안 겹친다 ═══════ */
const pos = await pg.evaluate(()=>{
  const W=window, X=W.__FARM_X(), Z=W.__FARM_Z(), o={};
  o.수 = X.length;
  o.모둠수 = W.__G.farm.length;
  /* 수정까지의 거리 — 다섯이 같아야 어느 모둠도 손해가 아니다 */
  const d = X.map((x,i)=>Math.hypot(x, Z[i]));
  o.수정까지 = Math.round(d[0]*10)/10;
  o.거리차 = Math.round((Math.max(...d)-Math.min(...d))*1000)/1000;
  /* 서로 얼마나 떨어져 있나 — 우리 반지름의 두 배보다는 멀어야 안 겹친다 */
  let near = 1e9;
  for(let i=0;i<X.length;i++) for(let j=i+1;j<X.length;j++)
    near = Math.min(near, Math.hypot(X[i]-X[j], Z[i]-Z[j]));
  o.제일가까운두농장 = Math.round(near*10)/10;
  /* 성벽(입구) 쪽으로 나가 있으면 늑대 길을 막는다 — 수정보다 가까이 */
  o.입구보다안쪽 = d.every(v => v < W.__ARENA_R);
  return o;
});
ok('★ 농장이 모둠마다 하나씩 있다', pos.수 === pos.모둠수 && pos.수 === 5, pos.수+'개');
ok('★ 다섯 농장이 수정에서 똑같이 떨어져 있다 (어느 모둠도 손해가 없다)',
   pos.거리차 < 0.01, '수정까지 '+pos.수정까지+'칸 · 차이 '+pos.거리차);
ok('★ 농장끼리 겹치지 않는다', pos.제일가까운두농장 > 8, '제일 가까운 두 농장 '+pos.제일가까운두농장+'칸');
ok('★ 농장이 마당 안에 있다 (늑대 길을 막지 않는다)', pos.입구보다안쪽);

/* ═══════ ② 일하는 자리 — 먹이·청소가 서로 다른 곳이다 ═══════
   ★ 18차f 부터 '거두기' 는 없다. 산물이 우리 안에 놓이고 몸으로 부딪혀 줍는다. */
const spot = await pg.evaluate(()=>{
  const W=window, o={}, S={};
  for(const w of ['feed','clean','buy']) S[w] = W.__farmSpotXZ(0, w);
  o.자리 = S;
  let near = 1e9;
  const ks = ['feed','clean'];
  for(let i=0;i<ks.length;i++) for(let j=i+1;j<ks.length;j++)
    near = Math.min(near, Math.hypot(S[ks[i]][0]-S[ks[j]][0], S[ks[i]][1]-S[ks[j]][1]));
  o.제일가까운두자리 = Math.round(near*100)/100;
  /* 각 자리에 서면 그 일이 잡히나 — farmAt 은 제일 가까운 일을 돌려준다 */
  /* ★ farmAt() 은 인자를 안 받고 '지금 내 양이 선 자리'(PL)를 본다.
     자리 좌표를 넘겨 부르면 늘 null 이라, 검사가 게임이 아니라 검사 탓에 빨개진다. */
  o.잡힘 = {};
  const stand = (x,z)=>{ W.__PL.x=x; W.__PL.z=z; return W.__farmAt(); };
  for(const w of ks){
    const hit = stand(S[w][0], S[w][1]);
    o.잡힘[w] = hit ? (hit.g + ':' + hit.w) : null;
  }
  /* 농장에서 멀리 떨어지면 아무 일도 안 잡혀야 한다 */
  o.멀리서 = stand(W.__FARM_X()[0] + 40, W.__FARM_Z()[0] + 40);
  return o;
});
ok('★ 먹이·청소가 서로 다른 자리다 (한 자리에서 다 되면 뭘 하는지 모른다)',
   spot.제일가까운두자리 > 0.9, '제일 가까운 두 자리 '+spot.제일가까운두자리+'칸');
ok('★ 자리마다 그 일이 잡힌다',
   spot.잡힘.feed==='0:feed' && spot.잡힘.clean==='0:clean',
   JSON.stringify(spot.잡힘));
ok('★ 농장에서 멀면 아무 일도 안 잡힌다', !spot.멀리서);

/* ═══════ ③ 값 — 비쌀수록 많이 준다, 본전 뽑는 데 여러 날 걸린다 ═══════ */
const eco = await pg.evaluate(()=>{
  const W=window, A=W.__FARM_ANIMALS, o={};
  o.동물 = A.map(a=>a.k);
  o.값 = A.map(a=>a.cost);
  o.하루금 = A.map(a=>a.gold);
  /* 자원 하나를 금 몇으로 칠까 — 게임이 쓰는 환산이 없으니 '금 한 개' 기준으로만 본다.
     비싼 동물이 더 많이 줘야 한다(순서가 뒤집히면 싼 걸 사는 게 늘 이득이다). */
  o.값순서 = A.map(a=>(a.cost.w||0)+(a.cost.s||0)+(a.cost.g||0)*4);
  o.오름차순 = o.값순서.every((v,i)=> i===0 || v > o.값순서[i-1]);
  o.금도오름차순 = o.하루금.every((v,i)=> i===0 || v > o.하루금[i-1]);
  /* 본전 뽑는 날 — 금값만으로. 하루 이틀에 뽑히면 '비싼 초기 투자'가 아니다 */
  o.본전날 = A.map(a=> Math.ceil(o.값순서[A.indexOf(a)] / a.gold));
  o.우리정원 = W.__FARM_CAP();
  return o;
});
ok('★ 비싼 동물이 더 많이 준다 (싼 것만 사는 게 늘 이득이면 고를 이유가 없다)',
   eco.오름차순 && eco.금도오름차순, eco.동물.join('<')+' · 하루 ✨'+eco.하루금.join('/'));
ok('★ 초반 비용이 비싸다 — 본전 뽑는 데 여러 날 걸린다',
   eco.본전날.every(d=>d >= 8), '본전까지 '+eco.본전날.join('/')+'일');
ok('★ 우리 정원이 있다 (무한정 늘려 혼자 다 먹지 못한다)',
   eco.우리정원 > 0 && eco.우리정원 <= 8, '정원 '+eco.우리정원+'마리');

/* ═══════ ④ 사기 — 자원을 내고, 정원을 넘지 않는다 ═══════ */
const buy = await pg.evaluate(()=>{
  const W=window, o={}, g=W.__G.me.g, f=W.__G.farm[g];
  const A = W.__FARM_ANIMALS[0];
  /* ★ G.res 는 base + 각자 캔 것 − 각자 쓴 것 으로 '다시 계산되는' 값이다.
     여기에 직접 써 넣으면 다음 recomputeRes 에서 지워진다. 창고(base)에 넣어야 한다. */
  W.__myPC.g = g; W.__syncMyPC();
  const base = W.__base[g];
  base.w = 100000; base.s = 100000; base.o = 100000; W.__recompute();
  const r0 = Object.assign({}, W.__myRes());
  f.hen=0; f.pig=0; f.cow=0;
  W.__buyAnimal(A.k);
  o.한마리 = W.__farmCount(f);
  const r1 = W.__myRes();
  o.낸나무 = r0.w - r1.w; o.낸돌 = r0.s - r1.s; o.낸금 = r0.g - r1.g;
  /* 정원까지 채우고 한 마리 더 — 안 늘어야 한다 */
  for(let i=0;i<W.__FARM_CAP()+3;i++) W.__buyAnimal(A.k);
  o.꽉찬뒤 = W.__farmCount(f);
  /* 자원이 없으면 못 산다 */
  base.w = 0; base.s = 0; base.o = 0;
  W.__myPC.w = 0; W.__myPC.s = 0; W.__myPC.o = 0;
  W.__myPC.sw = 0; W.__myPC.ss = 0; W.__myPC.so = 0;
  W.__recompute();
  f.hen=0; f.pig=0; f.cow=0;
  W.__buyAnimal(A.k);
  o.빈손으로 = W.__farmCount(f);
  return o;
});
ok('★ 동물을 사면 자원을 낸다', buy.한마리===1 && buy.낸나무>0 && buy.낸돌>0,
   '🪵'+buy.낸나무+' 🪨'+buy.낸돌+' ✨'+buy.낸금);
ok('★ 우리 정원을 넘겨 살 수 없다', buy.꽉찬뒤 <= 6, buy.꽉찬뒤+'마리에서 멈춤');
ok('★ 자원이 없으면 못 산다', buy.빈손으로 === 0);

/* ═══════ ⑤ 하루 — 먹이를 줬으면 나오고, 안 줬으면 굶다가 떠난다 ═══════ */
const day = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={}, g=G.me.g, f=G.farm[g];
  const base = W.__base[g]; base.w=100000; base.s=100000; base.o=100000; W.__recompute();
  f.hen=2; f.pig=1; f.cow=0; f.dirt=0; f.hun=0;
  for(const A of W.__FARM_ANIMALS) f[A.prod]=0;
  W.__drops().length = 0;
  /* ★ 18차f — 나온 것은 곧바로 우리 안에 놓인다(farmStock 이 0 이 된다).
     '얼마나 나왔나' 는 '우리에 남은 것 + 우리 안에 놓인 것' 으로 세야 한다. */
  const made = ()=> W.__farmStock(f) + W.__drops().filter(d=>d.g===g).length;
  /* 먹이를 주고 하루를 넘긴다 */
  f.fed = G.day;
  G.day++; W.__farmMorning();
  o.먹인다음날 = made();
  o.마리수 = W.__farmCount(f);
  o.더러워짐 = Math.round((f.dirt||0)*100)/100;
  /* 안 주고 여러 날 넘긴다 — 언젠가 떠난다 */
  const n0 = W.__farmCount(f);
  let days = 0;
  while(W.__farmCount(f) === n0 && days < 12){ G.day++; W.__farmMorning(); days++; }
  o.떠나기까지 = days;
  o.떠난뒤 = W.__farmCount(f);
  return o;
});
ok('★ 먹이를 주면 다음 날 아침에 마리수만큼 나온다',
   day.먹인다음날 === day.마리수, day.마리수+'마리 → '+day.먹인다음날+'개');
ok('★ 하루 지나면 우리가 더러워진다', day.더러워짐 > 0, 'dirt '+day.더러워짐);
ok('★ 먹이를 안 주면 굶다가 떠난다 (하루 빠뜨렸다고 바로는 아니다)',
   day.떠난뒤 < day.마리수 && day.떠나기까지 >= 2, day.떠나기까지+'일 만에 한 마리 떠남');

/* ═══════ ⑥ 더러우면 덜 나온다 ═══════ */
const dirty = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={}, g=G.me.g, f=G.farm[g];
  const set=(dirt)=>{ f.hen=4; f.pig=0; f.cow=0; f.hun=0; f.dirt=dirt;
    for(const A of W.__FARM_ANIMALS) f[A.prod]=0;
    W.__drops().length = 0;
    f.fed=G.day; G.day++; W.__farmMorning();
    return W.__farmStock(f) + W.__drops().filter(d=>d.g===g).length; };
  o.깨끗할때 = set(0);
  o.더러울때 = set(1.0);
  /* 더러움 눈금 — 청소하면 0 이 된다 */
  f.dirt = 1.0; W.__farmClean(g); o.청소뒤 = f.dirt||0;
  return o;
});
ok('★ 우리가 더러우면 덜 나온다 (0 이 아니라 절반 — 왜 적은지 배울 수 있게)',
   dirty.더러울때 < dirty.깨끗할때 && dirty.더러울때 > 0,
   '깨끗 '+dirty.깨끗할때+'개 · 더러움 '+dirty.더러울때+'개');
ok('★ 청소하면 깨끗해진다', dirty.청소뒤 === 0);

/* ═══════ ⑦ 우리에 놓임 → 몸으로 주움 → 자원 창 → 상인 교환 (18차f) ═══════
   ★ 예전에는 숫자로만 쌓이고 헛간 앞에서 '거두기' 를 꾹 눌렀다.
     이제 알·우유·고기가 우리 안에 진짜로 놓이고, 뛰어가 부딪히면 자원 창의 🥚🥛🍖 가 오른다. */
const sell = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={}, g=G.me.g, f=G.farm[g];
  const base = W.__base[g]; base.w=100000; base.s=100000; base.o=100000; W.__recompute();
  W.__myPC.g = g; W.__syncMyPC();
  W.__drops().length = 0;
  f.hen=3; f.pig=2; f.cow=1; f.dirt=0; f.hun=0; f.fed=G.day;
  for(const A of W.__FARM_ANIMALS) f[A.prod]=0;
  G.day++; W.__farmMorning();
  const mine = ()=> W.__drops().filter(d=>d.g===g);
  o.놓인것 = mine().length;
  o.남은것 = W.__farmStock(f);
  o.PER = W.__FD().PER;
  /* 전부 우리 안인가 */
  const cx = W.__FARM_X()[g], cz = W.__FARM_Z()[g], R = W.__farmR2(g);
  o.우리안 = mine().every(d=>Math.hypot(d.x-cx, d.z-cz) <= R);
  /* 서로 겹치지 않는가 */
  let near = 1e9, ds = mine();
  for(let i=0;i<ds.length;i++) for(let j2=i+1;j2<ds.length;j2++)
    near = Math.min(near, Math.hypot(ds[i].x-ds[j2].x, ds[i].z-ds[j2].z));
  o.제일가까운둘 = +near.toFixed(2);
  /* 종류가 동물에 맞나 — 닭·돼지·소를 다 뒀으니 세 가지가 다 나와야 한다 */
  o.종류 = [...new Set(mine().map(d=>d.k))].sort();
  /* 한 개 주워 본다 — 자원 창의 그 칸이 1 오른다 */
  const xp0 = W.__XP.lv*1e6 + W.__XP.xp;
  const before = {...W.__myRes()};
  const d0 = mine()[0];
  const A0 = W.__FARM_ANIMALS.find(A=>A.prod === d0.k);
  W.__pickDrop(d0);
  const after = W.__myRes();
  o.주움 = {종류:A0.res, 오름:(after[A0.res]|0) - (before[A0.res]|0),
           남은개수:mine().length};
  o.줍기경험치 = (W.__XP.lv*1e6 + W.__XP.xp) - xp0;
  /* 나머지도 다 줍는다 */
  while(mine().length) W.__pickDrop(mine()[0]);
  const r = W.__myRes();
  o.자원창 = {eg:r.eg|0, mk:r.mk|0, pk:r.pk|0};
  o.모두 = (r.eg|0)+(r.mk|0)+(r.pk|0);
  /* 상인 교환 — 산물이 금으로 바뀌고 산물 칸은 0 이 된다 */
  const 값 = W.__FARM_ANIMALS.reduce((a,A)=> a + (r[A.res]|0)*A.gold, 0);
  const gold0 = W.__myRes().g;
  W.__sellFarm();
  o.받은금 = W.__myRes().g - gold0; o.값어치 = 값;
  const r2 = W.__myRes();
  o.판뒤 = (r2.eg|0)+(r2.mk|0)+(r2.pk|0);
  return o;
});
ok('★ 아침이면 산물이 우리 안에 진짜로 놓인다 (숫자로만 쌓이면 9살에겐 아무 느낌이 없다)',
   sell.놓인것 > 0 && sell.놓인것 <= sell.PER, sell.놓인것+'개 (한 번에 최대 '+sell.PER+'개)');
ok('★ 놓인 것은 전부 우리 울타리 안이다', sell.우리안);
ok('★ 서로 겹쳐 놓이지 않는다 (겹치면 하나만 보이고 나머지는 못 찾는다)',
   sell.제일가까운둘 > 1.0, '제일 가까운 둘 '+sell.제일가까운둘+'칸');
ok('★ 기르는 동물에 맞는 것이 나온다 (닭→달걀 · 돼지→고기 · 소→우유)',
   sell.종류.length === 3, sell.종류.join(' '));
ok('★ 몸으로 부딪히면 그 자원이 1 오르고 놓인 것이 하나 준다',
   sell.주움.오름 === 1 && sell.주움.남은개수 === sell.놓인것 - 1,
   sell.주움.종류+' +'+sell.주움.오름);
ok('★ 주우면 경험치를 받는다 (밤새 싸운 아이만 레벨이 오르면 안 된다)',
   sell.줍기경험치 > 0, '+'+sell.줍기경험치+'xp');
ok('★ 주운 것이 자원 창에 나무·돌·금과 나란히 쌓인다',
   sell.모두 === sell.놓인것, JSON.stringify(sell.자원창));
ok('★ 상인에게 바꾸면 값어치만큼 금이 들어온다',
   sell.받은금 === sell.값어치 && sell.받은금 > 0, '✨'+sell.받은금);
ok('★ 바꾼 뒤에는 산물 칸이 빈다', sell.판뒤 === 0);

/* ═══════ ⑧ 자원 창 · 남의 우리 것 (18차f) ═══════ */
const rbox = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={}, g=G.me.g, f=G.farm[g];
  o.자원종류 = W.__RES_KEYS();
  o.아이콘 = o.자원종류.map(k=>W.__RES_IC[k]);
  o.이름 = o.자원종류.map(k=>W.__RES_NM[k]);
  /* 아이콘·이름이 빠짐없이 있나 */
  o.빠진것 = o.자원종류.filter(k=>!W.__RES_IC[k] || !W.__RES_NM[k]);
  /* 자원 창에 여섯 칸이 다 있나 */
  o.칸 = ['rW','rS','rG','rE','rM','rP'].filter(id=>!!document.getElementById(id)).length;
  /* 동물이 있으면 산물 줄이 뜬다 */
  W.__drops().length = 0;
  for(const A of W.__FARM_ANIMALS) f[A.prod]=0;
  f.hen=0; f.pig=0; f.cow=0;
  /* ★ __myPC 는 '값' 이 아니라 '값을 돌려주는 함수' 다. W.__myPC.eg = 0 은
     함수에 칸을 하나 붙일 뿐 아무 일도 안 한다 — 화면을 찍어 보고 알았다. */
  const pc = W.__myPC();
  pc.eg=0; pc.mk=0; pc.pk=0; pc.seg=0; pc.smk=0; pc.spk=0; W.__recompute();
  /* ★ 화면이 저절로 다시 칠해지기를 기다리면(setTimeout) 기계가 바쁠 때 흔들린다.
     칠하는 함수를 직접 부른다 — 캐시(hudPrev)를 지워 줘야 다시 칠한다. */
  const repaint = ()=>{ W.__hudPrev().farmRes = undefined; W.__paintHUD(); };
  repaint();
  o.동물없을때 = document.getElementById('resFarm').classList.contains('on');
  f.hen = 2;
  repaint();
  o.동물있을때 = document.getElementById('resFarm').classList.contains('on');
  /* 남의 모둠 우리에 놓인 것은 못 줍는다 */
  const og = (g+1)%5;
  const of2 = G.farm[og]; of2.hen = 3; of2.fed = G.day;
  G.day++; W.__farmMorning();
  const theirs = W.__drops().filter(d=>d.g===og);
  o.남의것 = theirs.length;
  if(theirs.length){
    const t0 = theirs[0];
    W.__PL.x = t0.x; W.__PL.z = t0.z;          // 남의 우리 산물 위에 선다
    const before = (W.__myRes().eg|0);
    W.__updDrops(0.05, 1);
    o.남의것주움 = (W.__myRes().eg|0) - before;
    o.남의것남음 = W.__drops().filter(d=>d.g===og).length;
  }
  return o;
});
ok('★ 자원이 여섯 가지다 — 나무·돌·금 + 달걀·우유·돼지고기',
   rbox.자원종류.length === 6 && rbox.빠진것.length === 0,
   rbox.자원종류.map((k,i)=>rbox.아이콘[i]+rbox.이름[i]).join(' '));
ok('★ 자원 창에 여섯 칸이 다 있다', rbox.칸 === 6, rbox.칸+'칸');
ok('★ 산물 줄은 동물이 있어야 뜬다 (처음부터 0 세 개면 자원 창이 복잡하기만 하다)',
   rbox.동물없을때 === false && rbox.동물있을때 === true,
   '동물 없을 때 '+rbox.동물없을때+' · 있을 때 '+rbox.동물있을때);
/* ═══════ ⑨ 산물 크기 — 우리를 덮으면 안 된다 (18차g) ═══════
   ★ 처음에 크게 만들었더니 "농장에 여러 개 떠야 되잖아, 지금 이상한 탑 같다" 셨다.
     눈으로 보고 줄였는데, 눈으로 본 것은 다음에 또 커진다 — 숫자로 못 박는다. */
const size = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={}, g=G.me.g, f=G.farm[g];
  W.__drops().length = 0;
  for(const A of W.__FARM_ANIMALS) f[A.prod]=0;
  f.hen=2; f.pig=2; f.cow=2; f.fed=G.day; G.day++; W.__farmMorning();
  W.__updDrops(0.016, 1.0);
  const [body] = W.__fdMesh();
  const a = body.instanceMatrix.array;
  let maxW = 0, maxH = 0;
  for(let i=0;i<body.count;i++){
    const o2 = i*16;
    /* 행렬 각 열의 길이가 그 축의 크기다 (회전이 섞여 있어도 길이는 안 변한다) */
    maxW = Math.max(maxW, Math.hypot(a[o2],a[o2+1],a[o2+2]), Math.hypot(a[o2+8],a[o2+9],a[o2+10]));
    maxH = Math.max(maxH, Math.hypot(a[o2+4],a[o2+5],a[o2+6]));
  }
  o.제일넓은조각 = +maxW.toFixed(3);
  o.제일높은조각 = +maxH.toFixed(3);
  o.조각수 = body.count;
  o.산물수 = W.__drops().filter(d=>d.g===g).length;
  o.조각당 = +(body.count / Math.max(1,W.__drops().length)).toFixed(1);
  /* 한 산물이 차지하는 키 — 제일 높은 칸에서 제일 낮은 칸까지 */
  let lo = 1e9, hi = -1e9;
  for(let i=0;i<body.count;i++){ const yy = a[i*16+13]; lo = Math.min(lo,yy); hi = Math.max(hi,yy); }
  o.높이폭 = +(hi-lo).toFixed(2);
  return o;
});
ok('★ 산물 한 조각이 1칸(양 한 마리 너비)의 4분의 1을 안 넘는다 — 우리가 산물로 덮이면 동물이 안 보인다',
   size.제일넓은조각 <= 0.25 && size.제일높은조각 <= 0.15,
   '제일 넓은 조각 '+size.제일넓은조각+'칸 · 제일 높은 조각 '+size.제일높은조각+'칸');
ok('★ 한 산물이 덩어리 넷 안팎이다 (많이 쌓으면 탑처럼 보인다)',
   size.조각당 <= 5, '산물 하나에 '+size.조각당+'덩어리');
ok('★ 남의 모둠 우리에 놓인 것은 못 줍는다 (남의 농장을 털면 교실이 아수라장이 된다)',
   rbox.남의것 > 0 && rbox.남의것주움 === 0 && rbox.남의것남음 === rbox.남의것,
   '남의 우리 '+rbox.남의것+'개 · 주워진 것 '+rbox.남의것주움+'개');

/* ═══════ ⑧ 농장 일이 '으뜸' 판에 남는다 ═══════ */
const rank = await pg.evaluate(()=>{
  const W=window, o={};
  o.갈래 = W.__RANK_CATS.map(c=>c.k);
  o.농장갈래있나 = o.갈래.includes('farmed');
  /* 거둔 아이가 있으면 그 갈래가 돌아가는 목록에 낀다 */
  W.__pcMap.set('zz', {u:'zz', n:'나래', g:1, lv:3, farmed:12});
  o.도는갈래 = W.__rankCats().map(c=>c.k);
  o.농장이돈다 = o.도는갈래.includes('farmed');
  W.__pcMap.delete('zz');
  /* ★ 앞 항목(⑦)에서 내가 직접 거뒀기 때문에 내 기록에도 farmed 가 남아 있다.
     그걸 안 지우고 '아무도 안 했을 때' 를 재면, 페이지 타이머가 syncMyPC 를
     부른 뒤냐 전이냐에 따라 통과했다 실패했다 한다 — 열 번에 한 번 빨개졌다.
     게임이 아니라 검사가 흔들린 것이다. */
  W.__MY.farmed = 0; W.__syncMyPC();
  o.아무도안했을때 = W.__rankCats().map(c=>c.k).includes('farmed');
  return o;
});
ok('★ 농장을 잘한 아이 이름이 남는 자리가 있다', rank.농장갈래있나, rank.갈래.join(','));
ok('★ 거둔 아이가 있으면 농장 갈래가 순위판에 돈다', rank.농장이돈다);
ok('★ 아무도 농장을 안 했으면 빈 갈래는 안 돈다', !rank.아무도안했을때);

/* ═══════ ⑨ 그리기 — 마리수만큼 그리고, 더러울 때만 자국·파리 ═══════ */
const draw = await pg.evaluate(async ()=>{
  const W=window, G=W.__G, o={}, f=G.farm[0];
  const cnt=()=>({몸:W.__farmMesh('body').count, 자국:W.__farmMesh('muck').count,
                  파리:W.__farmMesh('fly').count});
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>{ W.__render&&W.__render(); r(); }));
  for(const ff of G.farm){ ff.hen=0; ff.pig=0; ff.cow=0; ff.dirt=0; }
  f.hen=2; f.pig=2; f.cow=2; f.dirt=0; W.__farmDirty(true);
  await frame(); o.깨끗 = cnt();
  f.dirt = 1.0; W.__farmDirty(true);
  await frame(); o.더러움 = cnt();
  /* 동물이 없으면 자국도 없다 — 빈 우리가 저절로 더러워지면 이상하다 */
  f.hen=0; f.pig=0; f.cow=0; f.dirt=1.0; W.__farmDirty(true);
  await frame(); o.빈우리 = cnt();
  o.정원 = W.__FARM_CAP();
  return o;
});
ok('★ 산 마리수만큼만 그린다', draw.깨끗.몸 === 6, draw.깨끗.몸+'마리');
ok('★ 깨끗하면 자국도 파리도 없다',
   draw.깨끗.자국 === 0 && draw.깨끗.파리 === 0, JSON.stringify(draw.깨끗));
ok('★ 더러우면 자국이 생기고 파리가 꾄다 (안 보이면 아이가 청소를 안 한다)',
   draw.더러움.자국 > 0 && draw.더러움.파리 > 0,
   '자국 '+draw.더러움.자국+' · 파리 '+draw.더러움.파리);
ok('★ 빈 우리는 더러워지지 않는다', draw.빈우리.자국 === 0);

/* ═══════ ⑩ 그릴 칸이 모자라지 않는다 ═══════ */
const cap = await pg.evaluate(async ()=>{
  const W=window, G=W.__G, o={};
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>{ W.__render&&W.__render(); r(); }));
  /* 제일 많이 그리게 되는 짜임 — 다섯 우리를 꾸밈 조각이 제일 많은 종류로 꽉 채운다.
     ★ 17차d 때 꾸밈 칸을 마리당 3개로 잡았는데 닭 한 마리가 벌써 4개(볏 셋+부리)를
       썼다. 우리를 닭으로 채우면 조용히 넘쳤다. 종류마다 다 채워 보고 확인한다. */
  const over = [];
  for(const A of W.__FARM_ANIMALS){
    for(const f of G.farm){ f.hen=0; f.pig=0; f.cow=0; f[A.k]=W.__FARM_CAP(); f.dirt=1.2; }
    W.__farmDirty(true); await frame();
    for(const nm of ['body','head','deco','eyes','legs','muck','fly']){
      const m = W.__farmMesh(nm);
      if(m.count > m.instanceMatrix.count) over.push(A.k+':'+nm+' '+m.count+'>'+m.instanceMatrix.count);
    }
  }
  o.넘친것 = over;
  return o;
});
ok('★ 어느 동물로 꽉 채워도 그릴 칸이 안 넘친다 (넘치면 조용히 잘린다)',
   cap.넘친것.length === 0, cap.넘친것.join(' / ') || '전부 넉넉함');

/* ═══════ ⑪ 상인 바꾸기 — 늘 손해라야 한다 ═══════ */
const trade = await pg.evaluate(()=>{
  const W=window, o={}, g=W.__G.me.g;
  const base = W.__base[g]; base.w=100000; base.s=100000; base.o=100000; W.__recompute();
  const ks = ['w','s','g'];
  /* 값어치 기준으로 늘 손해인가 — 받은 것의 값이 낸 것의 값보다 적어야 한다 */
  const V = W.__TRADE_VAL;
  o.손해 = []; o.공짜 = [];
  for(const m of W.__TRADE_MULS) for(const a of ks) for(const b of ks){
    if(a===b) continue;
    const give = W.__tradeGive(a,m), get = W.__tradeGet(a,b,m);
    if(get*V[b] >= give*V[a]) o.손해.push(a+'→'+b+' ×'+m);
    if(get <= 0) o.공짜.push(a+'→'+b+' ×'+m);
  }
  /* 왕복하면 확 줄어든다 — '자원 불리는 길' 이 되면 안 된다.
     ★ 처음엔 실제로 두 번 바꿔 보고 나무가 얼마나 남았나를 쟀는데,
       두 번째 바꾸기가 방금 받은 돌이 아니라 쌓아 둔 돌더미에서 나가는 바람에
       왕복이 아니라 '한 번 바꾸기' 를 재고 있었다. 값어치로 재야 맞다. */
  W.__tradeMul(1);
  let worst = 0;
  for(const a of ks) for(const b of ks){
    if(a===b) continue;
    const rate = W.__tradeGet(a,b,1)*V[b] / (W.__tradeGive(a,1)*V[a]);
    worst = Math.max(worst, rate);          // 제일 후한 짝으로 왕복해도
  }
  o.왕복남은비율 = Math.round(worst*worst*100)/100;
  /* 실제로 자원이 오간다 */
  const r0 = Object.assign({}, W.__myRes());
  W.__doTrade('g','w');
  const r1 = W.__myRes();
  o.낸금 = r0.g - r1.g; o.받은나무 = r1.w - r0.w;
  o.한번에낼금 = W.__tradeGive('g',1);
  /* 모자라면 못 바꾼다 */
  base.w=0; base.s=0; base.o=0;
  W.__myPC.w=0; W.__myPC.s=0; W.__myPC.o=0;
  W.__myPC.sw=0; W.__myPC.ss=0; W.__myPC.so=0; W.__recompute();
  const before = Object.assign({}, W.__myRes());
  W.__doTrade('w','g');
  o.빈손으로바뀜 = W.__myRes().g !== before.g;
  return o;
});
ok('★ 어느 짝을 어떻게 바꿔도 상인이 수고비를 뗀다 (바꿔서 이득 보는 길이 없다)',
   trade.손해.length === 0, trade.손해.join(' ') || '여섯 짝 × 세 크기 모두 손해');
ok('★ 그래도 0개를 주지는 않는다 (내고 아무것도 못 받으면 속은 기분이 든다)',
   trade.공짜.length === 0, trade.공짜.join(' ') || '전부 1개 이상');
ok('★ 왕복하면 확 줄어든다 — 자원을 불리는 길이 아니다',
   trade.왕복남은비율 < 0.6 && trade.왕복남은비율 > 0.2,
   '제일 후한 짝으로 왕복해도 값어치의 '+Math.round(trade.왕복남은비율*100)+'%만 남는다');
ok('★ 바꾸면 실제로 자원이 오간다',
   trade.낸금 === trade.한번에낼금 && trade.받은나무 > 0,
   '✨'+trade.낸금+' → 🪵'+trade.받은나무);
ok('★ 자원이 모자라면 안 바뀐다', !trade.빈손으로바뀜);

/* ═══════ ⑫ 전직 — 고른 길의 칸만 늘어난다 ═══════ */
const job = await pg.evaluate(()=>{
  const W=window, X=W.__XP, o={};
  const reset = ()=>{ X.job=-1; X.jt=0; X.lv=1; X.st=[0,0,0,0,0,0]; };
  o.레벨 = W.__JOB_LV.slice();
  o.칸늘어남 = W.__JOB_STEP();
  o.길 = W.__JOBS.map(j=>j.k);
  o.길마다다른스텟 = new Set(W.__JOBS.map(j=>j.st)).size === W.__JOBS.length;
  /* 아직 레벨이 안 되면 전직 못 한다 */
  reset(); X.lv = W.__JOB_LV[0]-1;
  o.이른레벨 = W.__jobDue();
  W.__takeJob(0);
  o.이른레벨에전직됨 = X.jt > 0;
  /* 레벨이 되면 전직할 수 있고, 내 길의 칸만 늘어난다 */
  reset(); X.lv = W.__JOB_LV[0];
  o.때가되면 = W.__jobDue();
  const before = W.__STATS.map((S,i)=>W.__statMax(i));
  W.__takeJob(0);
  const after = W.__STATS.map((S,i)=>W.__statMax(i));
  o.늘어난칸 = after.map((v,i)=>v-before[i]);
  o.내스텟 = W.__JOBS[0].st;
  /* 한 번 고른 길은 못 바꾼다 */
  X.lv = W.__JOB_LV[1];
  W.__takeJob(1);
  o.길바뀜 = X.job !== 0;
  /* 2차는 같은 길로 또 늘어난다 */
  W.__takeJob(0);
  o.이차단계 = X.jt;
  o.이차뒤내칸 = W.__statMax(W.__JOBS[0].st) - W.__STATS[W.__JOBS[0].st].max;
  /* 늘어난 칸까지 실제로 찍힌다 */
  X.pts = 99;
  const si = W.__JOBS[0].st;
  for(let k=0;k<40;k++) W.__takeStat(si);
  o.찍은단계 = X.st[si];
  o.내최대 = W.__statMax(si);
  /* 남의 길 스텟은 원래 상한에서 멈춘다 */
  const other = W.__JOBS[1].st;
  for(let k=0;k<40;k++) W.__takeStat(other);
  o.남의길찍은단계 = X.st[other];
  o.남의길최대 = W.__STATS[other].max;
  /* 다 밟으면 더 뜨지 않는다 */
  o.다밟은뒤 = W.__jobDue();
  reset();
  return o;
});
ok('★ 전직은 두 번, 레벨 15·30에서 한다', job.레벨.length === 2, job.레벨.join(' · '));
ok('★ 세 길이 저마다 다른 스텟을 키운다 (뭘 고르든 똑같으면 고를 이유가 없다)',
   job.길마다다른스텟 && job.길.length === 3, job.길.join(' '));
ok('★ 레벨이 안 되면 전직할 수 없다', job.이른레벨 === 0 && !job.이른레벨에전직됨);
ok('★ 전직하면 고른 길의 칸만 늘어난다 (남의 길은 그대로)',
   job.늘어난칸.filter(v=>v>0).length === 1 && job.늘어난칸[job.내스텟] === job.칸늘어남,
   '늘어난 칸 ['+job.늘어난칸.join(',')+']');
ok('★ 한 번 고른 길은 못 바꾼다', !job.길바뀜);
ok('★ 2차 전직하면 칸이 또 늘어난다',
   job.이차단계 === 2 && job.이차뒤내칸 === job.칸늘어남*2,
   '내 길 칸 +'+job.이차뒤내칸);
ok('★ 늘어난 칸까지 실제로 찍힌다',
   job.찍은단계 === job.내최대 && job.내최대 > job.남의길최대,
   '내 길 '+job.찍은단계+'단계 · 남의 길 '+job.남의길찍은단계+'단계');
ok('★ 남의 길 스텟은 원래 상한에서 멈춘다', job.남의길찍은단계 === job.남의길최대);
ok('★ 두 번 다 밟으면 전직 안내가 더 안 뜬다', job.다밟은뒤 === 0);

/* ═══════ ⑬ 전직한 양이 화면에 다르게 보인다 ═══════ */
const jlook = await pg.evaluate(async ()=>{
  const W=window, o={};
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>{ W.__render&&W.__render(); r(); }));
  /* 길·단계마다 조각이 다 있고, 2차가 1차보다 화려한가 */
  o.조각수 = W.__JOB_LOOK.map(j=>j.map(t=>t.length));
  o.이차가더화려 = o.조각수.every(j=>j[1] > j[0]);
  o.빈차림 = o.조각수.some(j=>j.some(n=>n===0));
  /* 제일 많이 걸친 아이 — 꾸미기 다 하고 2차 전직까지. 칸이 안 넘쳐야 한다 */
  const most = (arr)=>arr.reduce((a,e,i)=>e.length>arr[a].length?i:a,0);
  const maxDeco = Math.max(...o.조각수.map(j=>j[1]));
  const P = {uid:'jj', n:'멋쟁이', g:0, x:0, z:-6, y:W.__GY, ry:0,
             hat:most(W.__HATS), gls:most(W.__GLASSES), clo:most(W.__CLOTHES),
             jb:o.조각수.findIndex(j=>j[1]===maxDeco), jt:2};
  W.__G.players.set('jj', P);
  W.__pcMap.set('jj', {u:'jj', n:'멋쟁이', g:0, jb:P.jb, jt:2});
  await frame(); await frame();
  const m = W.__Pdeco();
  o.꾸밈칸 = m.instanceMatrix.count;
  o.쓴칸 = m.count;
  o.넘침 = m.count > m.instanceMatrix.count;
  W.__G.players.delete('jj'); W.__pcMap.delete('jj');
  return o;
});
ok('★ 길마다·단계마다 차림새가 있다 (빈 차림이 없다)', !jlook.빈차림,
   JSON.stringify(jlook.조각수));
ok('★ 2차 차림새가 1차보다 화려하다', jlook.이차가더화려);
ok('★ 제일 많이 걸친 아이도 그릴 칸이 안 넘친다 (넘치면 조각이 조용히 사라진다)',
   !jlook.넘침, '쓴 칸 '+jlook.쓴칸+' / '+jlook.꾸밈칸);

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
