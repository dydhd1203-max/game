/* 29차 검사 — 늑대 금 · 레어/유니크 조합 · 총 특성·소리 · 동물 상인 · 농장 상태 창(H) · 똥·건초 · 동그라미 단추 · 곡괭이 · 2단 점프 · 진열
   ★ 선생님 주문(29차): 늑대 잡으면 금이 떨어지고 아무나 줍는다 · 레어 4/유니크 2 는 대장장이 조합표(기본 총 + 재료) ·
     일반 총 -20% · 총마다 소리와 효과 · 동물 상인은 상인 옆 아줌마 · H 는 어디서나 농장 상태 · 똥·건초 · 단추는 동그라미.
   ★ 값을 베끼지 않는다 — 비율(60%·70%)과 관계(넣은 총이 없어지고 새 총이 든다)를 본다. 호스트(혼자 놀기)라 피해가 바로 깎인다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 9310);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=high', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1500);

/* ═══════ ① 무기 표 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, WP=W.__WEAPONS;
    return {n:WP.length, tiers:WP.map(w=>w.tier||'-'), mini:W.__MINI_GUN(), dmg:WP.slice(1,7).map(w=>w.dmg),
      craftOk:WP.filter(w=>w.tier).every(w=>w.mat && w.from>=0 && w.trait && w.snd && w.mz),
      from:WP.filter(w=>w.tier).map(w=>w.from), models:W.__gunModels().length,
      icons:[8,9,10,11,12,13].map(i=>!!W.__ICON()['wpn'+i]),
      sfx:WP.every(w=>!w.snd || W.__SFXKEYS().includes(w.snd)), keys:W.__SFXKEYS()}; });
  ok('★ 무기 14자루 — 레어 4(8~11) · 유니크 2(12~13) · 연습용 총은 7번', r.n===14 && r.tiers.slice(8,12).every(t=>t==='rare') && r.tiers.slice(12).every(t=>t==='unique') && r.mini===7, r.tiers.join(','));
  ok('★ 일반 총 여섯이 20% 내려갔다 (24/50/84/48/240/160)', JSON.stringify(r.dmg)==='[24,50,84,48,240,160]', r.dmg.join('/'));
  ok('조합 무기마다 넣는 총(from)·재료(mat)·특성(trait)·소리(snd)·화염 색(mz)이 있다', r.craftOk, r.from.join(','));
  ok('★ 유니크는 레어에서 나온다 (천둥 ← 황금 연발총 10, 화염 ← 흑요석 산탄총 9)', r.from[4]===10 && r.from[5]===9, r.from.join(','));
  ok('손에 드는 모형 14 · 아이콘 wpn8~13 여섯이 다 있다', r.models===14 && r.icons.every(Boolean), r.models+' · '+r.icons.join(','));
  ok('★ 총마다 적힌 소리 이름이 소리 표에 있다 (gun·boom·laser 가 여태 없어서 다섯 자루가 조용했다)',
     r.sfx && ['gun','boom','laser','thunder','flame','zap','blast','craft'].every(k=>r.keys.includes(k)), r.keys.filter(k=>/gun|boom|laser|thunder|flame|zap|blast|craft/.test(k)).join(','));
}

/* ═══════ ② 상점 · 조합 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, K=W.__KIT, o={};
    for(const k of ['w','s','g','eg','mk','pk']) W.__gain(k, 600);
    W.__shopTab('w'); W.__buildShopUI(); o.shopWpn = document.querySelectorAll('#shopList .sItem').length;
    o.noBase = W.__craftable(8);
    K.ownW[1] = true; K.enh[1] = 3; W.__equipWeapon(1);
    o.withBase = W.__craftable(8);
    const r0 = Object.assign({}, W.__myRes());
    W.__craftWeapon(8);
    const r1 = W.__myRes();
    o.paid = {w:r0.w-r1.w, eg:r0.eg-r1.eg};
    o.after = {own8:!!K.ownW[8], own1:!!K.ownW[1], wpn:K.wpn, enh8:K.enh[8]|0};
    W.__setForgeTab('craft'); W.__buildForgeUI();
    const cards = [...document.querySelectorAll('#forgeList .sItem')];
    o.cards = cards.length; o.labels = cards.map(c=>c.querySelector('button').textContent);
    o.why = cards.filter(c=>/먼저|모자라요/.test(c.textContent)).length;
    o.unique12 = W.__craftable(12);
    W.__setForgeTab('enh'); W.__buildForgeUI();
    o.enhCards = [...document.querySelectorAll('#forgeList .sItem .sn')].map(e=>e.textContent);
    return o; });
  ok('★ 상인은 조합 무기를 안 판다 (무기 여섯 자루만)', r.shopWpn===6, r.shopWpn);
  /* 31차b — 탭을 함수로 부르지 않고 **단추를 눌러서** 본다. 29차엔 상점 탭 손잡이가 대장간 탭까지 덮어써서
     조합표 단추가 상점 목록만 다시 그렸다 — 함수를 직접 부른 검사는 통과했고 교실에서 터졌다. */
  const c = await pg.evaluate(()=>{ const W=window, o={};
    W.__setForgeTab('enh'); W.__buildForgeUI();
    document.querySelector('#forgeTabs .btn[data-tab="craft"]').click();
    o.craftByClick = document.querySelectorAll('#forgeList .sItem').length;
    o.craftOn = document.querySelector('#forgeTabs .btn[data-tab="craft"]').classList.contains('on');
    W.__shopTab('w'); W.__buildShopUI();
    document.querySelector('#shopTabs .btn[data-tab="a"]').click();
    o.shopArm = document.querySelectorAll('#shopList .sItem').length;
    o.forgeStill = document.querySelectorAll('#forgeList .sItem').length;
    o.forgeOnKept = document.querySelector('#forgeTabs .btn[data-tab="craft"]').classList.contains('on');
    return o; });
  ok('★ 조합표 단추를 **눌러서** 카드 여섯이 뜬다 (함수를 직접 부르면 못 잡는 버그였다)', c.craftByClick===6 && c.craftOn, c.craftByClick);
  ok('상점 탭을 눌러도 대장간 목록·탭은 그대로다 (같은 class 를 입어도 손잡이가 안 섞인다)', c.shopArm>0 && c.forgeStill===6 && c.forgeOnKept, c.shopArm+' / '+c.forgeStill);
  ok('★ 넣는 총이 없으면 조합이 안 되고, 있으면 된다', r.noBase===false && r.withBase===true);
  ok('★ 조합하면 재료(나무 140 · 달걀 6)가 나가고 넣은 총은 없어지며 새 총을 바로 들고 강화 +3 을 물려받는다',
     r.paid.w===140 && r.paid.eg===6 && r.after.own8 && !r.after.own1 && r.after.wpn===8 && r.after.enh8===3, JSON.stringify(r.paid)+' '+JSON.stringify(r.after));
  ok('★ 대장간 조합표 탭에 카드 여섯 — 만든 것은 "만들었어요", 못 만드는 것은 까닭이 적힌다', r.cards===6 && r.labels[0]==='만들었어요' && r.why>=4, r.labels.join('/')+' · 까닭 '+r.why);
  ok('유니크는 레어(황금 연발총)가 있어야 만들 수 있다 · 강화 탭에는 만든 강궁이 +3 으로 선다', r.unique12===false && r.enhCards.some(t=>/참나무 강궁/.test(t) && /\+3/.test(t)), r.enhCards.join('/'));
}

/* ═══════ ③ 특성 (혼자 놀기 = 호스트라 바로 깎인다) ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, K=W.__KIT, o={};
    W.__goNight(); K.ammo = 99;
    const mk = (n)=>{ const ws=[]; G.wolves.length = 0;
      for(let i=0;i<n;i++){ const w=W.__spawnWolf(0,0); w.x = PL.x + 6 + (i?1.2*Math.cos(i*2):0); w.z = PL.z + (i?1.2*Math.sin(i*2):0); w.y = PL.y; w.hp = 1000; w.mx = 1000; ws.push(w); }
      PL.yaw = Math.atan2(-(ws[0].x-PL.x), -(ws[0].z-PL.z)); PL.pitch = 0; W.__updPlayer(0.001); W.__setAim(true,true); return ws; };
    const fire = (i)=>{ K.ownW[i]=true; W.__equipWeapon(i); W.__setThrowCd(0); W.__throw(); };
    let ws = mk(4); fire(12); o.chain = ws.map(w=>1000-Math.round(w.hp));
    ws = mk(4); fire(13); o.blast = ws.map(w=>1000-Math.round(w.hp));
    ws = mk(2); { const dx=ws[0].x-PL.x, dz=ws[0].z-PL.z, L=Math.hypot(dx,dz); ws[1].x = ws[0].x + dx/L*2.5; ws[1].z = ws[0].z + dz/L*2.5; }
    fire(8); o.pierce = ws.map(w=>1000-Math.round(w.hp));
    ws = mk(1); const bx=ws[0].x, bz=ws[0].z; fire(9); o.push = +Math.hypot(ws[0].x-bx, ws[0].z-bz).toFixed(2);
    ws = mk(1); PL.hp = 40; fire(10); o.leech = PL.hp;
    /* 빗나가는 대포 — 늑대는 조준선 옆(2.8칸)에, 땅을 겨눠 쏜다. 터지는 자리에서 2.8칸이면 3.2 안이다 */
    G.wolves.length = 0; PL.yaw = 0; PL.pitch = -0.5; W.__updPlayer(0.001);
    const w = W.__spawnWolf(0,0); w.x = PL.x + 2.8; w.z = PL.z - 2.4; w.y = PL.y; w.hp = 1000; w.mx = 1000;
    o.aimed = !!W.__aimWolf();
    K.ownW[13]=true; W.__equipWeapon(13); W.__setThrowCd(0); W.__throw();
    o.missBlast = 1000-Math.round(w.hp);
    G.wolves.length = 0; W.__setAim(false,true); W.__goDay();
    return o; });
  ok('★ 천둥 벼락총 — 맞힌 늑대 하나, 옆의 셋에게 60% 번개', r.chain[0]>0 && r.chain.slice(1).every(d=>Math.abs(d/r.chain[0]-0.6)<0.03), r.chain.join('/'));
  ok('★ 화염 대포 — 맞힌 자리 둘레 셋이 70% 를 받는다', r.blast[0]>0 && r.blast.slice(1).every(d=>Math.abs(d/r.blast[0]-0.7)<0.03), r.blast.join('/'));
  ok('★ 참나무 강궁 — 조준선 뒤의 늑대도 70% 로 뚫는다', r.pierce[0]>0 && Math.abs(r.pierce[1]/r.pierce[0]-0.7)<0.03, r.pierce.join('/'));
  ok('★ 흑요석 산탄총 — 맞은 늑대가 1.2칸 밀린다', Math.abs(r.push-1.2)<0.05, r.push+'칸');
  ok('★ 황금 연발총 — 맞힐 때마다 내 체력 +2', r.leech===42, r.leech);
  ok('★ 화염 대포는 빗나가도 땅에서 터져 둘레 늑대가 탄다 (조준선에 안 걸린 늑대)', !r.aimed && r.missBlast>0, '조준 '+r.aimed+' · '+r.missBlast);
}

/* ═══════ ④ 늑대 금 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
    G.drops.length = 0; W.__goNight();
    const g0 = W.__myRes().g;
    const w = W.__spawnWolf(0, 0); w.x = PL.x + 2.5; w.z = PL.z; w.y = PL.y; w.hp = 0;
    W.__hostSim(0.016);
    const gold = ()=>W.__drops().filter(d=>d.k==='gold');
    o.n = gold().length; o.anyone = gold().every(d=>d.g === -1); o.near = gold().every(d=>Math.hypot(d.x-w.x, d.z-w.z) < 1.6);
    o.exp = gold().every(d=>d.exp && d.exp - performance.now()/1000 > 40);
    const d0 = gold()[0]; PL.x = d0.x; PL.z = d0.z; W.__updDrops(0.016, 1);
    o.picked = W.__myRes().g - g0; o.left = gold().length;
    /* ★ 31차b — exp 를 0 으로 두면 `d.exp && now > d.exp` 에서 거짓이라 **치워지지 않았다**. 그런데도 통과하던 것은 바로 앞줄에서
       발밑에 둔 플레이어가 한 번에 하나씩 주워 갔기 때문 — 조각이 셋 나오는 판(1/3)에만 빨갰다(바쁜 판에서 셋 중 둘 빨강).
       시한을 '아주 옛날'(0.001) 로 두고 플레이어는 멀리 치워 줍기가 안 섞이게 한다. */
    PL.x += 40; for(const d of gold()) d.exp = 0.001; W.__updDrops(0.016, 2); o.afterExpire = gold().length; PL.x -= 40;
    const bossK = Object.keys(W.__WOLF_T).map(Number).find(k=>W.__isBoss(k));
    const wb = W.__spawnWolf(bossK, 0); wb.x = PL.x + 3; wb.z = PL.z; wb.y = PL.y; wb.hp = 0;
    W.__hostSim(0.016); o.boss = gold().length;
    G.drops.length = 0; G.wolves.length = 0; W.__goDay();
    return o; });
  ok('★ 늑대가 죽으면 금 조각 1~3개가 그 자리에 떨어진다 (누구나 줍는 g:-1, 45초 시한)', r.n>=1 && r.n<=3 && r.anyone && r.near && r.exp, r.n+'개');
  ok('★ 다가가면 줍히고 금 +1', r.picked===1 && r.left===r.n-1, '+'+r.picked);
  ok('★ 시간이 지나면 사라진다 (호스트가 치운다)', r.afterExpire===0, r.afterExpire);
  ok('★ 보스는 8~12개', r.boss>=8 && r.boss<=12, r.boss+'개');
}

/* ═══════ ⑤ 동물 상인 · 농장 상태 창 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
    const [vx,vz] = W.__VET(), S = W.__SHOP();
    o.vetDist = +Math.hypot(vx-S.x, vz-S.z).toFixed(2);
    o.hasPop = !!document.getElementById('popVet');
    PL.x = vx + 0.5; PL.z = vz; o.nearVet = W.__vetOpenable();
    PL.x = S.x; PL.z = S.z; o.atShop = W.__vetOpenable();
    W.__buildVetUI();
    const cards = [...document.querySelectorAll('#vetList .sItem')];
    o.vetNames = cards.map(c=>c.querySelector('.sn').textContent.trim());
    o.vetBuy = cards.filter(c=>{ const b=c.querySelector('button'); return b && /사기|모자라요|꽉/.test(b.textContent); }).length;
    W.__shopTab('f'); W.__buildShopUI();
    o.shopFarmBuy = [...document.querySelectorAll('#shopList .sItem button')].filter(b=>/사기|모자라요|꽉/.test(b.textContent)).length;
    /* 농장 상태 창 — 밤에, 농장에서 멀리, H 로 */
    W.__goNight(); PL.x = 0; PL.z = 0;
    const f = G.farm[G.me.g]; f.hen = 2; f.pig = 0; f.cow = 1;
    W.__openFarm();
    o.farmOpen = document.getElementById('popFarm').classList.contains('on');
    o.farmTxt = document.getElementById('farmList').innerText.replace(/\s+/g,' ');
    o.farmBtns = document.querySelectorAll('#farmList button').length;
    o.tip = document.getElementById('farmTip').classList.contains('on');
    document.getElementById('popFarm').classList.remove('on'); W.__goDay();
    o.cap = W.__FARM_CAP();
    const st = []; for(const n of [3,4,7]){ f.hen = Math.min(n,3); f.pig = Math.max(0,Math.min(n-3,3)); f.cow = Math.max(0,n-6); st.push(W.__farmR2(G.me.g)); }
    o.stages = st; o.sc = W.__FARM_LOOK.hen.sc;
    f.hen=0; f.pig=0; f.cow=0; W.__farmDirty(true);
    return o; });
  ok('★ 동물 상인 아줌마는 상인 옆 3.2칸에 따로 있고 자기 창(popVet)이 있다', Math.abs(r.vetDist-3.2)<0.05 && r.hasPop, r.vetDist+'칸');
  ok('★ 아줌마 앞에서는 B 가 동물 상인을 열고, 상인 앞에서는 안 연다', r.nearVet && !r.atShop);
  ok('★ 동물 상인 창에 닭·돼지·소 사는 카드 셋 + 사료 안내, 상인 가게의 농장 칸에는 사는 단추가 없다',
     r.vetBuy===3 && r.vetNames.some(n=>/사료/.test(n)) && r.shopFarmBuy===0, r.vetNames.join('/')+' · 상인 가게 사는 단추 '+r.shopFarmBuy);
  ok('★ 농장 창(H)은 밤에도 어디서나 열리고 동물마다 몇 마리인지 적히며 사는 단추가 없다',
     r.farmOpen && /닭 2마리/.test(r.farmTxt) && /소 1마리/.test(r.farmTxt) && r.farmBtns===0 && !r.tip, r.farmTxt.slice(0,50));
  ok('★ 우리 정원 10 · 단계는 4마리·7마리에서 넓어진다 · 동물은 작아졌다(닭 0.50)',
     r.cap===10 && r.stages[0] < r.stages[1] && r.stages[1] < r.stages[2] && r.sc <= 0.52, r.cap+' · '+r.stages.join('→')+' · '+r.sc);
}

/* ═══════ ⑥ 똥 · 건초 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, G=W.__G, o={};
    const f = G.farm[G.me.g], M = W.__farmMeshes();
    f.hen = 3; f.dirt = 1.0; f.fed = -1; W.__farmDirty(true); W.__drawFarm(1);
    o.muckDirty = M.muck.count; o.hayUnfed = M.hay.count;
    f.dirt = 0; f.fed = G.day; W.__farmDirty(true); W.__drawFarm(2);
    o.muckClean = M.muck.count; o.hayFed = M.hay.count;
    f.hen=0; f.dirt=0; f.fed=-1; W.__farmDirty(true); W.__drawFarm(3);
    return o; });
  ok('★ 더러우면 똥 무더기(공 셋씩) 열 개가 놓인다', r.muckDirty===30, r.muckDirty+'조각');
  ok('★ 청소하면 똥이 없다', r.muckClean===0, r.muckClean);
  ok('★ 먹인 날은 여물통에 건초 묶음 둘 + 알갱이 넷, 안 먹인 날은 없다', r.hayFed===8 && r.hayUnfed===0, r.hayFed+' / '+r.hayUnfed);
}

/* ═══════ ⑦ 지도 아래 동그라미 단추 ═══════ */
{
  const r = await pg.evaluate(()=>{ const bs = [...document.querySelectorAll('#topRight2 .btn')];
    const vis = bs.filter(b=>getComputedStyle(b).display!=='none');
    const rects = vis.map(b=>b.getBoundingClientRect());
    return {n:bs.length, rb:bs.filter(b=>b.classList.contains('rb')).length,
      round:rects.every(r=>Math.abs(r.width-r.height)<1 && r.width>=40), radius:getComputedStyle(vis[0]).borderRadius,
      img:vis.every(b=>b.querySelector('img.ic')), kk:[...document.querySelectorAll('#topRight2 .kk')].map(e=>e.textContent.trim()),
      noText:vis.every(b=>[...b.childNodes].filter(n=>n.nodeType===3 && n.nodeValue.trim()).length===0),
      titles:vis.every(b=>b.title.length>1)}; });
  ok('★ 오른쪽 단추가 전부 동그라미(폭=높이 ≥40, 반지름 50%)다', r.rb===r.n && r.round && /50%/.test(r.radius), r.n+'개 · '+r.radius);
  ok('★ 단추마다 글자 없이 그림 하나, 이름은 title 로', r.img && r.noText && r.titles);
  ok('열쇠 배지 C · I · Y · U', ['C','I','Y','U'].every(k=>r.kk.includes(k)), r.kk.join(','));
}

/* ═══════ ⑧ 곡괭이 · 2단 점프 · 진열 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, PL=W.__PL, o={};
    o.pickIcon = !!W.__ICON().tool_mine;
    const y0 = PL.y; let p1=0, p2=0, p3=0;
    W.__wantJump(); for(let i=0;i<20;i++){ W.__updPlayer(1/60); p1=Math.max(p1, PL.y-y0); }
    W.__wantJump(); for(let i=0;i<80;i++){ W.__updPlayer(1/60); p2=Math.max(p2, PL.y-y0); }
    W.__wantJump(); for(let i=0;i<80;i++){ W.__updPlayer(1/60); p3=Math.max(p3, PL.y-y0); }
    o.jump = [+p1.toFixed(2), +p2.toFixed(2), +p3.toFixed(2)];
    const D = W.__DISP(); o.disp = D.length; o.dispVis = D.every(d=>d.m.visible);
    return o; });
  ok('곡괭이 아이콘이 있다', r.pickIcon);
  ok('★ 2단 점프 — 한 번 뛰고(≈1.3칸) 공중에서 한 번 더(≈2.6칸), 세 번째는 안 된다', r.jump[0] > 1.1 && r.jump[1] > r.jump[0]*1.7 && r.jump[2] < r.jump[0]*1.2, r.jump.join(' / '));
  ok('★ 세계에 총 진열 여덟 — 대장간 받침대 둘 · 걸이 넷 · 상인 선반 둘, 다 보인다', r.disp===8 && r.dispVis, r.disp);
}
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
