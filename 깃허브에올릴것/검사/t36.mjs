/* 36차 검사 — 늑대들의 밤: 늑대 다섯(규칙·외형) · 밤 구성표 · 뛰는 늑대 없음
   ★ 규칙은 실제로 밤을 돌려서 본다(호스트 스텝 __step). 외형은 그리기 뒤 부위 메시의 개수(count)로 본다 — 종류별 조각이 실제로 그려졌나.
   ★ 소리·화면 비네트는 값(fearK · #fearVig opacity)으로 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 8936);
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

/* ═══════ ① 표 ═══════ */
const tb = await pg.evaluate(()=>{ const W=window, T=W.__WOLF_T, o={};
  o.n = T.length; o.jump = T.some(t=>t.jump); o.noJumpExport = W.__K_JUMP === undefined && W.__isJumper === undefined;
  o.looks = ['hungry','armor','heal','pup','fear'].map(l=> W.__K_LOOK(l));
  o.names = o.looks.map(k=> T[k] && T[k].n);
  const H = T[W.__K_LOOK('hungry')], A = T[W.__K_LOOK('armor')], C = T[W.__K_LOOK('heal')], P = T[W.__K_LOOK('pup')], F = T[W.__K_LOOK('fear')];
  o.hungry = H && H.wallBite === 0 && H.chase > 1 && H.aggro > 1;
  o.armor  = A && A.noChase && A.noGap && A.struMul > 1 && A.slowImm && A.hp >= T[0].hp*3 && A.spd < T[0].spd;
  o.heal   = C && C.noChase && C.heal && C.heal.r > 0 && C.heal.pct > 0;
  o.pup    = P && P.hp < T[0].hp*0.5 && P.sc < T[0].sc*0.7;
  o.fear   = F && F.fear && F.hp > T[0].hp*2 && F.dmg > T[0].dmg*1.5;
  o.bossOnly = o.looks.every(k=> !W.__isBoss(k));
  o.LK = Object.keys(W.__LOOKS);
  return o; });
ok('★ 뛰는 늑대가 표에도 내보내기에도 없다', !tb.jump && tb.noJumpExport, tb.n+'종');
ok('★ 새 늑대 다섯이 표에 있다 (굶주린·갑옷·치유·새끼·공포)', tb.looks.every(k=>k>=0), tb.names.join(' · '));
ok('★ 굶주린 — 벽을 안 물고, 쫓을 때 빠르고, 멀리서 알아챈다', tb.hungry);
ok('★ 갑옷 — 양 안 쫓고 틈 안 찾고 건물 배수·얼음 면역, 체력 3배·느림', tb.armor);
ok('★ 치유 — 둘레와 비율이 있고 양을 안 쫓는다', tb.heal);
ok('★ 새끼 — 체력 절반 아래 · 몸집 0.7 아래', tb.pup);
ok('★ 공포 — 체력 2배 넘고 피해 1.5배 넘는다', tb.fear);
ok('★ 새 늑대는 보스가 아니다 (체력 막대·뿔이 안 붙는다)', tb.bossOnly);
ok('★ 종류별 몸꼴 표(LOOKS)가 여섯(base + 다섯)', tb.LK.length === 6, tb.LK.join(','));

/* ═══════ ② 외형 — 그리면 종류별 조각이 실제로 나온다 ═══════ */
const art = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  G.paused = true; G.wolves.length = 0;
  const gX=(r,p)=>W.__gX(0,r,p), gZ=(r,p)=>W.__gZ(0,r,p);
  PL.x = gX(47,0); PL.z = gZ(47,0);
  const ks = [0, W.__K_LOOK('hungry'), W.__K_LOOK('armor'), W.__K_LOOK('heal'), W.__K_LOOK('pup'), W.__K_LOOK('fear')];
  ks.forEach((k,i)=>{ const w = W.__spawnWolf(k, 0, gX(52, (i-2.5)*1.8), gZ(52, (i-2.5)*1.8)); w.mv=false; });
  W.__drawWolves(G.wolves, 1.0, 0.016);
  const cnt = (m)=> W.__wolfMeshes()[m].count;
  o.body = cnt('body'); o.belly = cnt('belly'); o.brow = cnt('brow'); o.rib = cnt('rib'); o.tongue = cnt('tongue');
  o.plate = cnt('plate'); o.gem = cnt('gem'); o.heal = cnt('heal'); o.eyeW = cnt('eyeW'); o.fang = cnt('fang'); o.dread = cnt('dread');
  const sc = ks.map(k=> W.__WOLF_T[k].sc); o.pupSmall = sc[4] < sc[0]*0.7; o.fearBig = sc[5] > sc[0]*1.4;
  G.wolves.length = 0; W.__drawWolves(G.wolves, 1.0, 0.016); o.cleared = cnt('rib') === 0 && cnt('plate') === 0 && cnt('eyeW') === 0;
  G.paused = false; return o; });
ok('★ 여섯 마리를 그리면 몸통·배·눈썹이 여섯(둘씩) — 공통 미술 손질', art.body === 6 && art.belly === 6 && art.brow === 12, art.body+'/'+art.belly+'/'+art.brow);
ok('★ 굶주린 늑대만 갈비뼈 여섯·혀 하나', art.rib === 6 && art.tongue === 1, art.rib+'/'+art.tongue);
ok('★ 갑옷 늑대만 철판·등마루·어깨·투구 일곱', art.plate === 7, art.plate);
ok('★ 치유 늑대만 보석 하나·초록 고리 하나', art.gem === 1 && art.heal === 1, art.gem+'/'+art.heal);
ok('★ 공포 늑대만 흰 눈 둘·송곳니 둘·검은 고리 하나', art.eyeW === 2 && art.fang === 2 && art.dread === 1, art.eyeW+'/'+art.fang+'/'+art.dread);
ok('★ 새끼는 작고 공포는 크다 (몸집 표)', art.pupSmall && art.fearBig);
ok('★ 늑대가 없으면 종류별 조각도 0 (지난 프레임 조각이 남지 않는다)', art.cleared);

/* ═══════ ③ 규칙 — 실제로 돌려 본다 ═══════ */
const rule = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const gX=(r,p)=>W.__gX(0,r,p), gZ=(r,p)=>W.__gZ(0,r,p);
  /* 치유 — 다친 늑대 옆에 치유 늑대. 2초 뒤 체력이 늘었나 */
  G.paused = false; G.day = 8; W.__setNk(0); G.wolves.length = 0; G.phase = 'night'; G.t = 130;
  PL.x = 0; PL.z = 0; PL.down = true;                    // 양은 쓰러진 것으로 (쫓김 없이 재게)
  const hurt = W.__spawnWolf(0, 0, gX(40,0), gZ(40,0)); hurt.hp = hurt.mx*0.3; hurt.mv = false;
  const healer = W.__spawnWolf(W.__K_LOOK('heal'), 0, gX(41,1.5), gZ(41,1.5));
  const hp0 = hurt.hp;
  for(let i=0;i<60;i++){ W.__step(1, 1/30); hurt.x = gX(40,0); hurt.z = gZ(40,0); healer.x = gX(41,1.5); healer.z = gZ(41,1.5); }
  o.healGain = +((hurt.hp - hp0)/hurt.mx).toFixed(3); o.healedFlag = hurt.healed !== undefined;
  o.pool = +(healer.healPool / healer.mx).toFixed(2);       // 주머니 — 보통 늑대 한 마리분(자기 체력의 40/36)에서 방금 채운 만큼 줄었다
  o.selfHeal = healer.hp <= healer.mx;                     // 자기 자신은 못 채운다(최대 그대로)
  /* 치유는 겹치지 않는다 — 치유 늑대 셋이 붙어도 하나일 때와 같다. 보스는 안 찬다 */
  G.wolves.length = 0;
  const hurt2 = W.__spawnWolf(0, 0, gX(40,0), gZ(40,0)); hurt2.hp = hurt2.mx*0.3; hurt2.mv = false;
  const hs = [0,1,2].map(i=> W.__spawnWolf(W.__K_LOOK('heal'), 0, gX(41,1.5+i*0.8), gZ(41,1.5+i*0.8)));
  const bz = W.__spawnWolf(W.__bossWolfK(0), 0, gX(40,-2), gZ(40,-2)); bz.hp = bz.mx*0.3; bz.mv = false;
  const h20 = hurt2.hp, b0 = bz.hp;
  for(let i=0;i<60;i++){ W.__step(1, 1/30); hurt2.x = gX(40,0); hurt2.z = gZ(40,0); bz.x = gX(40,-2); bz.z = gZ(40,-2);
    hs.forEach((h,j)=>{ h.x = gX(41,1.5+j*0.8); h.z = gZ(41,1.5+j*0.8); }); }
  o.healGain3 = +((hurt2.hp - h20)/hurt2.mx).toFixed(3); o.bossGain = +((bz.hp - b0)/bz.mx).toFixed(3);
  W.__drawWolves(G.wolves, 1.0, 0.016); o.beamN = W.__wolfMeshes().beam.count;   // 방금 채운 늑대로 초록 줄이 그려진다
  /* 주머니를 다 쓴 치유 늑대는 더 못 채운다 */
  G.wolves.length = 0;
  const hurt3 = W.__spawnWolf(0, 0, gX(40,0), gZ(40,0)); hurt3.hp = hurt3.mx*0.3; hurt3.mv = false;
  const hz = W.__spawnWolf(W.__K_LOOK('heal'), 0, gX(41,1.5), gZ(41,1.5)); hz.healPool = 0;
  const h30 = hurt3.hp;
  for(let i=0;i<60;i++){ W.__step(1, 1/30); hurt3.x = gX(40,0); hurt3.z = gZ(40,0); hz.x = gX(41,1.5); hz.z = gZ(41,1.5); }
  o.spentGain = +((hurt3.hp - h30)/hurt3.mx).toFixed(3);
  /* 갑옷 — 얼음탑이 느리게 못 한다 */
  const ar = W.__spawnWolf(W.__K_LOOK('armor'), 0, gX(30,0), gZ(30,0));
  o.armorFlags = ar.noChase && ar.noGap && ar.struMul > 1 && ar.wallBite;
  const hg = W.__spawnWolf(W.__K_LOOK('hungry'), 0, gX(30,2), gZ(30,2));
  o.hungryFlags = !hg.wallBite && hg.chaseK > 1 && hg.aggroK > 1 && !hg.noChase;
  G.wolves.length = 0; PL.down = false;
  /* 공포 — 가까이 오면 fearK 가 차고 비네트가 켜진다, 멀면 꺼진다 */
  PL.x = gX(26,0); PL.z = gZ(26,0);
  const f = W.__spawnWolf(W.__K_LOOK('fear'), 0, gX(29,0), gZ(29,0)); f.mv = false;
  for(let i=0;i<20;i++){ W.__fearTick(0.2); f.x = gX(29,0); f.z = gZ(29,0); }
  o.fearNear = +W.__fearK().toFixed(2); o.vig = +getComputedStyle(document.getElementById('fearVig')).opacity; o.growled = !!f.growled;
  f.x = gX(60,0); f.z = gZ(60,0);
  for(let i=0;i<40;i++) W.__fearTick(0.2);
  o.fearFar = +W.__fearK().toFixed(2); o.vigFar = +getComputedStyle(document.getElementById('fearVig')).opacity;
  o.sfx = ['heart','growl'].every(k=> W.__SFXKEYS().includes(k));
  G.wolves.length = 0; G.phase = 'day'; G.t = 60; return o; });
ok('★ 치유 늑대 옆의 다친 늑대는 2초에 체력이 는다 (5%/초 × 2초 ≈ 10%)', rule.healGain >= 0.08 && rule.healGain <= 0.13, (rule.healGain*100).toFixed(1)+'%');
ok('★ 치유 받은 늑대에 초록 표시(healed)가 붙는다', rule.healedFlag);
ok('★ 치유는 겹치지 않는다 — 치유 늑대 셋이 붙어도 하나일 때와 같다 (한 마리씩 · 0.45초에 한 번)', rule.healGain3 >= 0.08 && rule.healGain3 <= 0.13, (rule.healGain3*100).toFixed(1)+'%');
ok('★ 치유 늑대에서 채우는 늑대로 초록 줄이 이어진다 (W_beam)', rule.beamN >= 1, rule.beamN+'개');
ok('★ 치유 주머니 — 보통 늑대 한 마리분으로 시작해 채운 만큼 준다', rule.pool > 0.9 && rule.pool < 1.15, rule.pool+'×자기 체력');
ok('★ 주머니를 다 쓰면 더 못 채운다 (보석이 꺼진다)', rule.spentGain === 0, (rule.spentGain*100).toFixed(1)+'%');
ok('★ 보스는 치유를 안 받는다', rule.bossGain <= 0.001, (rule.bossGain*100).toFixed(2)+'%');
ok('★ 갑옷·굶주린 늑대의 깃발이 태어날 때 늑대에 실린다', rule.armorFlags && rule.hungryFlags);
ok('★ 공포 늑대가 3칸 안에 오면 fearK 가 차고 가장자리 비네트가 켜지고 으르렁 한 번', rule.fearNear > 0.5 && rule.vig > 0.2 && rule.growled, 'fearK '+rule.fearNear+' · 비네트 '+rule.vig);
ok('★ 멀어지면 fearK·비네트가 0 으로 돌아간다', rule.fearFar === 0 && rule.vigFar === 0, rule.fearFar+' / '+rule.vigFar);
ok('★ 심장·으르렁 소리가 표에 있다', rule.sfx);

/* 굶주린 늑대 × 벽 — 3초 동안 안 물고 옆으로 비키다가, 그 뒤에 문다.
   ★ 벽은 협곡 입구(r 42)를 통째로 막는다(bal 하네스와 같은 자리, 0.5칸 간격으로 놓아 빈 칸이 없게). 마당 안쪽(r 34)에 열세 칸만 놓았더니
     양옆에 틈이 있어 굶주린 늑대가 제대로 돌아 들어갔다(그게 규칙대로다) — 검사가 틀렸던 것. */
const wall = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
  const gX=(r,p)=>W.__gX(0,r,p), gZ=(r,p)=>W.__gZ(0,r,p);
  const buildWall = ()=>{ W.__clear(); G.me.g = 0; G.res[0] = {w:9999, s:9999, g:9999}; let n=0;
    for(let pp=-9; pp<=9; pp+=0.5){ const x=Math.round(gX(42,pp)), z=Math.round(gZ(42,pp)); if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z); n++; } }
    W.__rebuild(); return n; };
  const hpSum = ()=>{ let s=0; for(const q of W.__STRU.values()) s += q.hp; return s; };
  o.placed = buildWall();
  G.phase = 'night'; G.t = 130; G.wolves.length = 0; PL.x = 0; PL.z = 0; PL.down = true;
  const h = W.__spawnWolf(W.__K_LOOK('hungry'), 0, gX(45,0), gZ(45,0));
  const hp0 = hpSum();
  let bitEarly = false, maxStall = 0;
  for(let i=0;i<75;i++){ W.__step(1, 1/30); maxStall = Math.max(maxStall, h.stall||0); if(i < 60 && hpSum() < hp0) bitEarly = true; }
  o.bitEarly = bitEarly; o.maxStall = +maxStall.toFixed(2);
  for(let i=0;i<240;i++) W.__step(1, 1/30);
  o.bitLater = hpSum() < hp0;
  /* 보통 늑대는 벽 앞에서 바로 문다 */
  G.wolves.length = 0; buildWall(); const hp1 = hpSum();
  W.__spawnWolf(0, 0, gX(45,0), gZ(45,0));
  for(let i=0;i<75;i++) W.__step(1, 1/30);
  o.normalBit = hpSum() < hp1;
  G.wolves.length = 0; W.__clear(); G.phase = 'day'; G.t = 60; PL.down = false; return o; });
ok('★ 벽 앞의 굶주린 늑대는 2초 안엔 안 물고 옆으로 비킨다 (틈 찾기)', wall.placed >= 12 && !wall.bitEarly && wall.maxStall > 0.5, '벽 '+wall.placed+' · stall '+wall.maxStall);
ok('★ 그래도 오래 막히면 결국 문다', wall.bitLater);
ok('★ 보통 늑대는 벽 앞에서 바로 문다 (대조)', wall.normalBit);

/* ═══════ ④ 밤 구성표 ═══════ */
const nt = await pg.evaluate(()=>{ const W=window, G=W.__G, o={};
  const D = W.__NIGHT_DEF; o.n = D.length; o.names = D.map(d=>d.n);
  o.hints = D.every(d=> d.hint && d.hint.length > 8);
  o.mixOk = D.every(d=>{ const v = Object.values(d.mix); return v.length && Math.abs(v.reduce((a,b)=>a+b,0)-1) < 0.02 && Object.keys(d.mix).every(k=> /^\d+$/.test(k) ? W.__WOLF_T[+k] && !W.__isBoss(+k) : W.__K_LOOK(k) >= 0); });
  o.fixed = [1,2,3,4].map(d=> W.__nightFor(d)); o.fixedNames = o.fixed.map(i=> D[i].n);
  o.pool5 = W.__nightPool(5); o.pool10 = W.__nightPool(10); o.pool15 = W.__nightPool(14);
  /* 뽑기 — 어제와 다르게, 풀 안에서 */
  let same = 0, out = 0; for(let i=0;i<200;i++){ const prev = W.__nightPool(10)[0]; const p = W.__pickNight(10, prev); if(p === prev) same++; if(!W.__nightPool(10).includes(p)) out++; }
  o.same = same; o.out = out;
  /* 오늘 밤 이름 — G.nk 를 따르고, 다른 날은 예전 진행도 이름 */
  G.day = 10; W.__setNk(3); o.today = W.__stageName(10); W.__setNk(-1); o.fallback = W.__stageName(10); o.other = W.__stageName(14);
  /* waveFor 가 mix 대로 나눈다 */
  W.__setNk(4); const wv = W.__waveFor(10); const cnt = {}; for(const k of wv.kinds) cnt[k] = (cnt[k]||0)+1;
  const A = W.__K_LOOK('armor'); o.wave = {tot: wv.kinds.length, big: cnt[2]||0, armor: cnt[A]||0, nk: wv.nk};
  o.waveArmorShare = +((cnt[A]||0)/wv.kinds.length).toFixed(2);
  /* 보스 밤 — 이름은 보스, 부하는 BOSS_MIX */
  G.day = 12; const bw = W.__waveFor(12); o.bossName = W.__stageName(12); o.bossHasBoss = bw.kinds.some(k=> W.__isBoss(k));
  const H = W.__K_LOOK('hungry'); o.bossMinion = bw.kinds.filter(k=> !W.__isBoss(k)).length; o.bossMixKeys = Object.keys(W.__BOSS_MIX[2]);
  /* 마리수가 렌더 상한 안 */
  W.__setNk(8); G.day = 17; o.maxN = W.__waveFor(17).kinds.length; o.MAXW = 92;
  W.__setNk(-1); G.day = 1; return o; });
ok('★ 밤 구성표가 열 개고 아침 한 줄(hint)이 다 있다', nt.n === 10 && nt.hints, nt.names.join(' · '));
ok('★ 구성 비율이 합쳐서 1 이고 종류가 전부 표에 있다(보스 아님)', nt.mixOk);
ok('★ 1~4일차는 고정 — 조용한 밤 → 늑대가 늘었다 → 날쌘 무리 → 굶주린 밤', nt.fixedNames.join('→') === '조용한 밤→늑대가 늘었다→날쌘 무리→굶주린 밤', nt.fixedNames.join('→'));
ok('★ 5일차 풀은 좁고 뒤로 갈수록 넓어진다', nt.pool5.length >= 2 && nt.pool10.length > nt.pool5.length && nt.pool15.length >= nt.pool10.length, nt.pool5.length+' → '+nt.pool10.length+' → '+nt.pool15.length);
ok('★ 뽑기는 풀 안에서, 어제와 다르게', nt.same === 0 && nt.out === 0, '같음 '+nt.same+' · 풀 밖 '+nt.out);
ok('★ 오늘 밤 이름은 뽑아 둔 것(굶주린 밤), 안 뽑았으면 진행도 이름', nt.today === '굶주린 밤' && nt.fallback !== '굶주린 밤' && nt.other.length > 0, nt.today+' / '+nt.fallback);
ok('★ waveFor 가 구성표대로 나눈다 (커다란 그림자 — 큰늑대·갑옷)', nt.wave.big > 0 && nt.wave.armor > 0 && Math.abs(nt.waveArmorShare - 0.30) < 0.08, JSON.stringify(nt.wave));
ok('★ 보스 밤은 보스 이름이고 부하는 보스마다 다르다', /출현/.test(nt.bossName) && nt.bossHasBoss && nt.bossMinion > 0 && nt.bossMixKeys.includes('armor'), nt.bossName);
ok('★ 마리수 배수가 붙는 밤도 렌더 상한(92) 안이다', nt.maxN <= 92 - 6, nt.maxN);
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
