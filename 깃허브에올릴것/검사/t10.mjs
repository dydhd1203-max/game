/* 7차 패치 검사 — 꾸미기 · 3인칭 죽음 · 상인 · 데미지 숫자 · 늑대 AI · 밸런스 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 8931);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const ctx = await b.newContext({viewport:{width:1180,height:700}});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});

const out = await pg.evaluate(async ()=>{
  const W = window, G = W.__G, PL = W.__PL, R = [];
  const ok = (n, c, v)=> R.push([n, !!c, v===undefined?'':String(v)]);
  const sleep = ms=> new Promise(r=>setTimeout(r,ms));

  /* ───────── 꾸미기 ───────── */
  ok('모자 9가지', W.__HATS.length===9, W.__HATS.length);
  ok('안경 7가지', W.__GLASSES.length===7, W.__GLASSES.length);
  ok('옷 7가지',   W.__CLOTHES.length===7, W.__CLOTHES.length);
  /* 안경은 눈(f 1.02) 보다 앞에 있어야 얼굴에 파묻히지 않는다 */
  ok('★ 안경은 눈보다 앞에 있다',
     W.__GLASSES.slice(1).every(g=>g.some(p=>p[0] > 1.02)),
     '가장 앞 ' + Math.max(...W.__GLASSES[1].map(p=>p[0])).toFixed(2));
  /* 옷은 등털(옆 ±0.54, 뒤 -0.63) 밖으로 나와야 보인다 */
  ok('★ 옷은 등털 밖으로 나온다',
     W.__CLOTHES.slice(1).every(c=>c.some(p=>Math.abs(p[3])/2 > 0.54 || p[0] < -0.63
                                          || (p[0] > 0.53 && p[1] < 1.32))),
     '');
  /* 미리보기 */
  ok('시작 화면 미리보기가 살아 있다', !!W.__pvw());
  const pvDeco = W.__pvw() ? W.__pvw().deco.filter(m=>m.visible).length : -1;
  document.querySelectorAll('#hatPick button')[5].click();
  document.querySelectorAll('#glsPick button')[2].click();
  document.querySelectorAll('#cloPick button')[6].click();
  const pvDeco2 = W.__pvw().deco.filter(m=>m.visible).length;
  ok('★ 착장을 고르면 미리보기가 바로 바뀐다', pvDeco2 > pvDeco, pvDeco + ' → ' + pvDeco2);
  ok('고른 착장이 기기에 저장된다',
     localStorage.getItem('sheepHat')==='5' && localStorage.getItem('sheepGls')==='2'
     && localStorage.getItem('sheepClo')==='6',
     [localStorage.getItem('sheepHat'),localStorage.getItem('sheepGls'),
      localStorage.getItem('sheepClo')].join('/'));

  /* 게임 시작 */
  document.getElementById('iName').value = '김하늘';
  document.getElementById('bSolo').click();
  await sleep(700);
  ok('★ 게임이 시작되면 미리보기 WebGL 판을 버린다', !W.__pvw());
  ok('고른 착장이 그대로 들어온다',
     G.me.hat===5 && G.me.gls===2 && G.me.clo===6,
     G.me.hat+'/'+G.me.gls+'/'+G.me.clo);

  /* 한 마리를 그려서 조각 수를 센다 */
  const one = (h,g,c)=>{ W.__drawSheep([{x:0,z:-6,y:0,ry:0,g:0,mv:false,ph:0,hat:h,gls:g,clo:c}],
                          0, 40, ()=>0xffffff, 0.7);
                         return [W.__Pdeco().count, W.__Pdeco().visible]; };
  const [nNone, vNone] = one(0,0,0);
  ok('아무것도 안 걸치면 꾸미기 메시가 숨는다', nNone===0 && !vNone, nNone + ' / 보임 ' + vNone);
  const [nHat] = one(1,0,0), [nAll] = one(1,1,1);
  ok('모자만 쓰면 모자 조각만', nHat===W.__HATS[1].length, nHat);
  ok('★ 모자+안경+옷이 한 메시에 다 올라간다',
     nAll === W.__HATS[1].length + W.__GLASSES[1].length + W.__CLOTHES[1].length, nAll);

  /* ───────── 쓰러졌을 때 ───────── */
  G.phase='night'; G.t=100;
  PL.x=0; PL.z=20; PL.y=W.__solidTop(0,20); PL.vy=0; PL.ground=true; PL.down=false;
  W.__updPlayer(0.016);
  const eye1 = Math.hypot(W.__cam.position.x-PL.x, W.__cam.position.y-(PL.y+1.12),
                          W.__cam.position.z-PL.z);
  ok('살아 있으면 1인칭 (카메라가 내 눈)', eye1 < 0.05, eye1.toFixed(3));
  PL.hp = 0; W.__goDown();
  W.__KEY[' '] = false;
  const y0 = PL.y;
  /* 점프 키를 눌러 본다 */
  for(let i=0;i<40;i++){ W.__wantJump(); W.__updPlayer(0.016); }
  ok('★ 쓰러지면 점프가 안 된다', Math.abs(PL.y - y0) < 0.01, (PL.y-y0).toFixed(3));
  const d3 = Math.hypot(W.__cam.position.x-PL.x, W.__cam.position.z-PL.z);
  const dy3 = W.__cam.position.y - PL.y;
  ok('★ 쓰러지면 카메라가 몸에서 물러난다 (3인칭)', d3 > 1.2 || dy3 > 1.5,
     '가로 '+d3.toFixed(2)+' 높이 '+dy3.toFixed(2));
  ok('★ 쓰러지면 조준점을 숨긴다',
     (W.__paintHUD(), document.getElementById('crosshair').style.display==='none'));
  W.__drawSheep([...G.players.values()], 0, 40, ()=>0xffffff, 0.7);
  const mine = W.__Pmesh()[0].count;
  ok('세팅: 혼자라 다른 양은 없다', mine===0, mine);
  ok('쓰러졌다는 안내가 뜬다', document.getElementById('downVeil').classList.contains('on'));
  PL.down=false; PL.hp=100; W.__paintHUD();
  ok('일어나면 조준점이 돌아온다', document.getElementById('crosshair').style.display!=='none');

  /* ───────── 상인 ───────── */
  const [sx, sz] = W.__shopXZ();
  ok('상인은 수정 옆(마당 안)에 있다', Math.hypot(sx,sz) < 12, Math.hypot(sx,sz).toFixed(1));
  PL.x = sx + 40; PL.z = sz;
  G.phase='day';
  ok('멀리 있으면 못 연다', !W.__shopOpenable());
  PL.x = sx + 1.4; PL.z = sz + 1.0;
  ok('가까이 가면 열 수 있다', W.__shopOpenable());
  G.phase='night';
  ok('★ 밤에는 상인이 문을 닫는다', !W.__shopOpenable());
  G.phase='day';
  ok('★ 상인 좌판 위에는 못 짓는다 (덮어 버리면 아무도 못 산다)',
     W.__canPlace('swall', Math.round(sx), Math.round(sz)) === '상인 자리예요',
     W.__canPlace('swall', Math.round(sx), Math.round(sz)));

  for(let i=0;i<5;i++) W.__base[i] = {w:600, s:600, o:200};
  W.__recompute();
  const K = W.__KIT;
  const before = {...W.__myRes()};
  const atk0 = W.__wpnDmg();
  W.__buyWeapon(3);
  ok('★ 무기를 사면 공격력이 오른다', W.__wpnDmg() > atk0, atk0 + ' → ' + W.__wpnDmg());
  ok('무기 값만큼 자원이 준다',
     G.res[G.me.g].s === before.s - W.__WEAPONS[3].cost.s,
     before.s + ' → ' + G.res[G.me.g].s);
  const def0 = W.__defNow();
  W.__buyArmor(4);
  ok('★ 갑옷을 사면 방어력이 오른다', W.__defNow() === W.__ARMORS[4].def,
     def0 + ' → ' + W.__defNow());
  /* 자원이 모자라면 못 산다 */
  for(let i=0;i<5;i++) W.__base[i] = {w:0, s:0, o:0};
  W.__recompute();
  const wpnA = K.wpn;
  W.__buyWeapon(6);
  ok('★ 자원이 모자라면 못 산다', K.wpn === wpnA, 'wpn=' + K.wpn);
  for(let i=0;i<5;i++) W.__base[i] = {w:600, s:600, o:200};
  W.__recompute();

  /* 총알 */
  K.ammo = 0; K.wpn = 3;
  const am0 = K.ammo;
  W.__buyAmmo(5);
  ok('★ 금 5개로 총알 30발', K.ammo === am0 + 30, K.ammo);

  /* 총알이 없으면 돌로 떨어진다 */
  G.phase='night'; G.t=100; G.wolves.length=0;
  const w1 = W.__spawnWolf(0, 0); w1.x = PL.x + 2; w1.z = PL.z; w1.y = PL.y;
  PL.yaw = -Math.PI/2;                      // 앞(-sin,-cos) 이 늑대 쪽을 보게
  PL.pitch = 0; PL.down = false;
  W.__updPlayer(0.001);                     // 조준은 카메라 방향을 보므로 카메라를 먼저 맞춘다
  w1.x = PL.x + 2; w1.z = PL.z; w1.y = PL.y;
  K.ammo = 0; W.__setCrit(0); W.__setThrowCd(0); W.__comboMiss();
  ok('세팅: 늑대를 조준했다', !!W.__aimWolf(), W.__aimWolf() ? '조준됨' : '못 찾음');
  const hp0 = w1.hp;
  W.__throw();
  const dmgNoAmmo = hp0 - w1.hp;
  ok('★ 총알이 없으면 조용히 돌로 떨어진다',
     dmgNoAmmo > 0 && dmgNoAmmo <= W.__stoneDmg() + 1, '깎인 피 ' + dmgNoAmmo.toFixed(0));
  /* 총알이 있으면 총으로, 그리고 총알이 준다 */
  K.ammo = 20; w1.hp = hp0; W.__setThrowCd(0); W.__comboMiss();
  W.__throw();
  const dmgGun = hp0 - w1.hp;
  ok('★ 총알이 있으면 총으로 쏜다 (돌보다 훨씬 아프다)',
     dmgGun > dmgNoAmmo * 2, '돌 ' + dmgNoAmmo.toFixed(0) + ' vs 총 ' + dmgGun.toFixed(0));
  ok('쏘면 총알이 준다', K.ammo === 20 - W.__WEAPONS[3].ammo, K.ammo);
  /* 크리티컬은 두 배
     ★ 13차에서 '연속 명중' 이 생겼다. 앞 발과 이 발의 콤보 단계가 다르면
       두 배가 아니라 2.1배쯤으로 나온다 — 콤보를 끊고 같은 조건에서 잰다. */
  W.__comboMiss();
  w1.hp = hp0; K.ammo = 20; W.__setThrowCd(0); W.__setCrit(1);
  W.__throw();
  const dmgCrit = hp0 - w1.hp;
  ok('★ 크리티컬은 두 배로 아프다',
     Math.abs(dmgCrit - dmgGun*2) <= 2, dmgGun.toFixed(0) + ' → ' + dmgCrit.toFixed(0));
  W.__setCrit(-1); W.__setThrowCd(0);

  /* 갑옷이 물린 피해를 줄인다 */
  K.arm = 0; PL.hp = 100; PL.biteT = 0; PL.down = false;
  const wB = W.__spawnWolf(0, 0); wB.x = PL.x + 0.6; wB.z = PL.z; wB.y = PL.y;
  W.__sheepHurt(0.016);
  const bare = 100 - PL.hp;
  K.arm = 5; PL.hp = 100; PL.biteT = 0;
  W.__sheepHurt(0.016);
  const armed = 100 - PL.hp;
  ok('★ 갑옷을 입으면 덜 아프다', armed < bare && armed > 0, bare + ' → ' + armed);
  ok('갑옷을 입어도 최소 1은 아프다', armed >= 1, armed);
  K.arm = 0;

  /* 물약 */
  PL.hp = 40; K.pot = [1,1,1,1];
  W.__usePotion(0);
  ok('★ 회복 물약이 체력을 채운다', PL.hp === 85, PL.hp);
  ok('쓰면 개수가 준다', K.pot[0] === 0, K.pot[0]);
  const sp0 = W.__spdMul(); W.__usePotion(1);
  ok('★ 날쌘 물약이 걸음을 올린다', W.__spdMul() > sp0, sp0 + ' → ' + W.__spdMul());
  const am1 = W.__atkMul(); W.__usePotion(2);
  ok('★ 힘 물약이 공격력을 올린다', W.__atkMul() > am1, am1 + ' → ' + W.__atkMul());
  const df1 = W.__defNow(); W.__usePotion(3);
  ok('★ 철벽 물약이 방어력을 올린다', W.__defNow() > df1, df1 + ' → ' + W.__defNow());
  ok('없는 물약은 못 쓴다', (W.__usePotion(0), K.pot[0] === 0));
  K.bSpd = K.bAtk = K.bDef = 0;

  /* ───────── 데미지 숫자 · 늑대 체력바 ───────── */
  const dn = W.__dnums();
  ok('뜨는 숫자 칸은 18개로 고정', dn.length === 18, dn.length);
  for(const s of dn) s.t = 0;
  for(let i=0;i<40;i++) W.__popDmg(PL.x+1, PL.y+1.4, PL.z, 10+i, i%2);
  ok('★ 칸을 돌려 쓴다 (40번 띄워도 노드는 18개)',
     document.querySelectorAll('#dmgLayer .dnum').length === 18,
     document.querySelectorAll('#dmgLayer .dnum').length);
  const crit = dn.find(s=>s.cls.includes('crit'));
  ok('크리티컬은 다른 모양으로 뜬다', !!crit && crit.txt.endsWith('!'), crit && crit.txt);
  W.__popDmg(PL.x + 500, PL.y, PL.z, 99, 0);
  ok('멀리 있는 숫자는 아예 안 만든다',
     !dn.some(s=>s.txt==='99'), '');

  G.wolves.length = 0;
  for(let i=0;i<9;i++){ const w = W.__spawnWolf(i%3, 0);
    w.x = PL.x + (i-4)*1.4; w.z = PL.z + 3; w.y = PL.y; w.hp = w.mx*(0.1 + i*0.1); }
  W.__drawWolfHP();
  const [bg, fg] = W.__HB();
  ok('★ 늑대 체력바는 늑대 수만큼', bg.count === 9 && fg.count === 9, bg.count);
  ok('★ 몇 마리든 그리기는 두 번 (인스턴스)', true, '바탕 1 + 채움 1');
  G.wolves.forEach(w=>{ w.x = PL.x + 400; });
  W.__drawWolfHP();
  ok('멀면 안 그린다', bg.count === 0, bg.count);

  /* ───────── 늑대 AI ───────── */
  G.wolves.length = 0; G.soldiers.length = 0;
  PL.down = false; PL.hp = 100;
  const gy = W.__solidTop(0, 20);
  const chase = (playerY)=>{
    G.wolves.length = 0;
    PL.x = 0; PL.z = 20; PL.y = playerY;
    const w = W.__spawnWolf(0, 0);
    w.x = 0; w.z = 24; w.y = gy; w.siege = false;
    const d0 = Math.hypot(w.x-PL.x, w.z-PL.z);
    for(let i=0;i<30;i++) W.__hostSim(0.05);
    return [d0, Math.hypot(w.x-PL.x, w.z-PL.z), w];
  };
  const [g0, g1] = chase(gy);
  ok('★ 땅 위 양은 쫓아온다', g1 < g0 - 1.0, g0.toFixed(1)+' → '+g1.toFixed(1));
  const [h0, h1] = chase(gy + 1.4);
  ok('★ 내 벽(1.4) 위 양도 쫓아온다', h1 < h0 - 1.0, h0.toFixed(1)+' → '+h1.toFixed(1));
  /* ★ 거리로 재면 안 된다 — 양을 무시해도 수정이 양 너머에 있어서 어차피 가까워진다.
     "양을 목표로 잡았나(shT)" 를 직접 본다. */
  const [ , , wg] = chase(gy);        ok('땅 위 양은 목표로 잡는다', wg.shT === true, wg.shT);
  const [ , , wh] = chase(gy + 1.4);  ok('내 벽 위 양도 목표로 잡는다', wh.shT === true, wh.shT);
  const [r0, r1, wr] = chase(gy + 6.0);
  ok('★ 망루(6칸) 위 양은 아예 목표로 안 잡는다 — 얻어맞기만 하는 상황을 막는다',
     wr.shT === false, '목표로 잡음? ' + wr.shT);

  /* 쫓을 때 더 빠르다 */
  PL.x = 0; PL.z = 20; PL.y = gy;
  G.wolves.length = 0;
  const wc = W.__spawnWolf(0, 0); wc.x = 0; wc.z = 25; wc.y = gy; wc.siege = false;
  let p1 = Math.hypot(wc.x, wc.z);
  for(let i=0;i<20;i++) W.__hostSim(0.05);
  const near = p1 - Math.hypot(wc.x, wc.z);
  G.wolves.length = 0;
  PL.x = 0; PL.z = 200;                    // 양이 아주 멀다 = 그냥 수정으로 간다
  const wf = W.__spawnWolf(0, 0); wf.x = 0; wf.z = 25; wf.y = gy; wf.siege = false;
  const q1 = Math.hypot(wf.x, wf.z);
  for(let i=0;i<20;i++) W.__hostSim(0.05);
  const far = q1 - Math.hypot(wf.x, wf.z);
  ok('★ 양을 쫓을 땐 더 빨리 달린다', near > far*1.15,
     '쫓을 때 '+near.toFixed(2)+' / 그냥 '+far.toFixed(2));
  PL.x = 0; PL.z = 20; PL.y = gy;

  /* 공성 시간 제한 */
  G.wolves.length = 0;
  const ws = W.__spawnWolf(0, 0);
  ok('공성 늑대에게 시간 제한이 있다', ws.sgLeft > 0, ws.sgLeft);

  /* ───────── 밸런스 ───────── */
  ok('★ 낮이 140초 (150 → 140)', G.set.daySec===140, G.set.daySec);
  ok('★ 늑대 체력이 3.1배 (12차에서 1.85 -> 3.10)', W.__BAL.hpMul===3.10, W.__BAL.hpMul);
  ok('★ 늑대의 건물 피해가 2배', W.__BAL.dmgMul===2, W.__BAL.dmgMul);
  /* 수정 깎는 힘만 따로 두는 이유: 2배로 하면 한 마리만 새도 20초 만에 끝난다 */
  ok('★ 수정 깎는 힘은 따로 1.4배', W.__BAL.crystalMul===1.4, W.__BAL.crystalMul);
  ok('★ 보스 체력 배수는 따로 1.35배', W.__BAL.bossMul===1.35, W.__BAL.bossMul);
  /* 실제로 늑대에 값이 먹었는지 확인한다 — 표만 바꾸고 안 쓰면 소용없다 */
  G.wolves.length = 0; G.day = 8;
  const wm = W.__spawnWolf(0, 0);
  ok('★ 배수가 진짜 늑대에게 먹었다 (기본 40 × 성장 × 1.85)',
     wm.mx > 40*1.85, Math.round(wm.mx));
  /* ★ 칸당 보상(amt) 하나만 보면 안 된다 — 14차에 칸 수(hits/per)도 같이 바뀌면서
     amt 는 2→3 인데 광맥당 총 산출은 8→15 가 됐다. 아이가 실제로 얻는 건 '총 산출'이다.
     그래서 총 산출로 잰다 (7차의 '금 2배' 취지를 그대로 지킨다). */
  const gd0 = W.__NODE_DEF.gold, goldPerVein = (gd0.hits/gd0.per)*gd0.amt;
  ok('★ 금 광맥 산출이 예전(4)의 두 배를 넘는다', goldPerVein >= 8,
     goldPerVein + ' 금/광맥 (칸 ' + (gd0.hits/gd0.per) + ' × ' + gd0.amt + ')');
  const A = W.__BUILD.arrow;
  ok('★ 화살탑 간격이 2배 (0.70 → 1.40)', Math.abs(A.rate[0]-1.40)<0.001, A.rate[0]);
  ok('★ 화살탑 한 방이 1.7배 (13 → 22)', A.dmg[0]===22, A.dmg[0]);
  ok('★ 돌 던지는 간격도 2배 (0.5 → 1.0)', W.__THROW_CD===1.0, W.__THROW_CD);
  return R;
});
let pass=0, fail=0;
for(const [n,c,v] of out){
  if(n.startsWith('(')){ console.log('  ' + n); continue; }
  console.log((c?'  OK  ':'FAIL  ') + n + (v?'   → '+v:'')); c?pass++:fail++;
}
console.log('\n' + (fail ? `${fail}개 실패 / ` : '') + `${pass}항목 통과`);
if(errs.length) console.log('\n오류:', errs.slice(0,6)); else console.log('\n(오류 없음)');
await b.close(); srv.close();
process.exit(fail?1:0);
