/* 8차 패치 검사 — T 공격모드 · FPS 조준 · 총 타격감 · 인벤토리 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 9210);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const ctx = await b.newContext({viewport:{width:1180,height:700}});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘');
await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(900);

const out = await pg.evaluate(async ()=>{
  const W=window, G=W.__G, PL=W.__PL, KIT=W.__KIT, R=[];
  const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
  const sleep = ms=> new Promise(r=>setTimeout(r,ms));
  const ch = document.getElementById('crosshair');

  /* 장비를 갖춘다 */
  for(let i=0;i<5;i++) W.__base[i]={w:900,s:900,o:400};
  W.__recompute();
  W.__buyWeapon(2); W.__buyWeapon(3); W.__buyWeapon(5);
  W.__buyArmor(2); W.__buyArmor(4); W.__buyAmmo(30);
  W.__buyPotion(0); W.__buyPotion(0);

  /* ───── 공격 모드 ───── */
  W.__setAim(false, true);
  ok('처음엔 공격 모드가 꺼져 있다', !W.__aimMode());
  W.__setAim(true, true);
  ok('★ T 를 누르면 총을 장착한다', W.__aimMode());
  ok('조준점이 총 모양으로 바뀐다', ch.classList.contains('gun'));
  ok('공격 모드 알림이 뜬다', document.getElementById('aimBadge').classList.contains('on'));
  ok('알림에 지금 든 무기 이름이 나온다',
     document.getElementById('aimName').textContent === W.__WEAPONS[KIT.wpn].n,
     document.getElementById('aimName').textContent);

  /* 공격 모드에서는 캐거나 짓지 못한다 */
  G.phase='day'; G.t=100;
  /* ★ 지을 수 있다고 확인된 칸 위에 세워 놓고 잰다.
     아무 데나 세우면 나무·바위 자리나 비탈이라 '안 지어짐' 이 무엇 때문인지 알 수 없다. */
  let spot = null;
  for(let rr=16; rr<34 && !spot; rr++) for(let cc=-6; cc<=6 && !spot; cc++){
    const d=W.__DIRS[G.me.g];
    const x=Math.round(d.dx*rr - d.dz*cc), z=Math.round(d.dz*rr + d.dx*cc);
    if(W.__canPlace('wwall',x,z)===null) spot=[x,z];
  }
  ok('세팅: 지을 수 있는 칸을 찾았다', !!spot, spot ? spot.join(',') : '못 찾음');
  PL.x=spot[0]+0.5; PL.z=spot[1]+2.4; PL.y=W.__solidTop(spot[0],spot[1]);
  PL.down=false; PL.hp=100;
  PL.yaw=Math.PI; PL.pitch=-0.62; W.__updPlayer(0.001);   // 그 칸을 내려다본다
  W.__selBuild('wwall'); W.__setActing(true);
  const before = W.__STRU.size;
  for(let i=0;i<200;i++) W.__doAction(0.05);          // 10초어치
  ok('★ 총을 들고 있으면 짓지 못한다', W.__STRU.size === before,
     before + ' → ' + W.__STRU.size);
  ok('총을 들고 있으면 미리보기(고스트)도 안 뜬다', !W.__ghostVisible());
  W.__setAim(false, true);
  for(let i=0;i<200;i++) W.__doAction(0.05);
  ok('★ 총을 풀면 다시 지어진다', W.__STRU.size > before, before + ' → ' + W.__STRU.size);
  W.__setActing(false); W.__selTool('mine');

  /* 아침이면 저절로 풀린다 */
  W.__setAim(true, true);
  W.__onPhase('night','day');
  ok('★ 아침이 오면 총을 저절로 내린다', !W.__aimMode());

  /* ───── 조준 ───── */
  G.phase='night'; G.t=100; G.wolves.length=0;
  PL.x=0; PL.z=20; PL.y=W.__solidTop(0,20);
  PL.yaw = 0; PL.pitch = 0;                 // 앞 = (-sin,-cos) = (0,-1)
  W.__updPlayer(0.001);
  W.__equipW(3);                             // 쇠 소총 (사거리 22, aimR 1.5)
  const put=(dx,dy,dz)=>{ G.wolves.length=0;
    const w=W.__spawnWolf(0,0);
    w.x=PL.x+dx; w.z=PL.z+dz; w.y=PL.y+dy; return w; };
  put(0,0,-8);   ok('★ 조준선 위 늑대는 잡힌다', !!W.__aimWolf());
  put(6,0,-8);   ok('★ 옆으로 6칸 벗어난 늑대는 안 잡힌다 (예전엔 57도 원뿔이라 다 맞았다)',
                    !W.__aimWolf());
  put(0,7,-8);   ok('★ 위로 7칸 어긋난 늑대도 안 잡힌다 (예전엔 높이를 아예 안 봤다)',
                    !W.__aimWolf());
  put(0,0,8);    ok('뒤에 있는 늑대는 안 잡힌다', !W.__aimWolf());
  put(0,0,-30);  ok('사거리 밖(30칸)은 안 잡힌다 — 쇠 소총은 22칸', !W.__aimWolf());
  W.__equipW(5); ok('★ 저격총(34칸)으로 바꾸면 잡힌다', !!W.__aimWolf());
  /* 무기마다 조준 너그러움이 다르다 */
  put(2.2,0,-8);
  W.__equipW(0); const stoneHit = !!W.__aimWolf();
  W.__equipW(5); const sniperHit = !!W.__aimWolf();
  ok('★ 맨손 돌은 너그럽고 저격총은 빡빡하다',
     stoneHit && !sniperHit, '돌 '+(stoneHit?'맞음':'빗나감')+' / 저격총 '+(sniperHit?'맞음':'빗나감'));

  /* ───── 타격감 ───── */
  const live = ()=> W.__bullets().filter(a=>a.t>0).length;
  W.__equipW(3); KIT.ammo = 30;
  const wt = put(0,0,-8);
  W.__setAim(true, true); W.__setCrit(0); W.__setThrowCd(0);
  W.__bullets().forEach(a=>a.t=0);
  ch.classList.remove('hit','critHit');
  W.__throw();
  ok('★ 총을 쏘면 빛줄기가 생긴다 (빛줄기 + 총구 화염 두 토막)', live() === 2, live());
  ok('빛줄기 색이 그 무기 색이다',
     W.__bullets().some(a=>a.t>0 && a.col === W.__WEAPONS[3].tr),
     '0x'+W.__WEAPONS[3].tr.toString(16));
  ok('★ 반동이 생긴다', W.__gunKick() > 0, W.__gunKick().toFixed(2));
  ok('★ 맞으면 조준점이 번쩍인다', ch.classList.contains('hit'));
  ok('늑대가 실제로 다친다', wt.hp < wt.mx, Math.round(wt.hp)+'/'+Math.round(wt.mx));
  /* 크리티컬은 다른 표시 */
  ch.classList.remove('hit','critHit');
  W.__setCrit(1); W.__setThrowCd(0); W.__throw();
  ok('크리티컬은 조준점 표시가 다르다', ch.classList.contains('critHit'));
  W.__setCrit(-1);
  /* 맨손 돌은 빛줄기가 아니라 던지는 돌 */
  W.__equipW(0); W.__bullets().forEach(a=>a.t=0);
  W.__setThrowCd(0); W.__throw();
  ok('★ 맨손 돌은 빛줄기가 아니라 던지는 돌이다', live() === 0, live());

  /* 늑대가 없으면 빗나가도 빛줄기는 나간다 */
  W.__equipW(3); G.wolves.length = 0; W.__bullets().forEach(a=>a.t=0);
  W.__setThrowCd(0); W.__throw();
  ok('빗나가도 빛줄기는 조준선을 따라 나간다', live() === 2, live());
  /* ★ 콤보 칸이 '.pop.on' 에 걸려 게임이 '창이 열렸다'고 착각한 적이 있다 —
     그러면 총이 안 나가고 움직임도 멈춘다. 화면 조각이 창 흉내를 내면 안 된다. */
  ok('★ 화면 조각이 열린 창 행세를 하지 않는다',
     [...document.querySelectorAll('.pop.on')].length === 0,
     [...document.querySelectorAll('.pop.on')].map(e=>e.id).join(',') || '없음');

  /* ───── 손에 드는 총 모형 ───── */
  const T3 = W.__THREE, models = W.__gunModels();
  ok('무기마다 손에 드는 모형이 따로 있다 (0~6)', models.length === 7 && models.every(Boolean),
     models.length + '개');
  /* ★ 모형은 재질끼리 미리 합쳐 구워 둔다(그리기 횟수를 줄이려고).
     그래서 '자식 수' 대신 굽기 전 조각 목록(userData.parts)을 본다. */
  const counts = models.map(g => (g.userData.parts||[]).length);
  ok('★ 모형이 서로 다르다 (색만 바꾼 같은 총이 아니다)',
     new Set(counts).size >= 5, '조각 수 ' + counts.join('/'));
  ok('★ 모형을 재질끼리 합쳐 구워 뒀다 (그리기 횟수 줄이기)',
     models.every(g => g.children.length < (g.userData.parts||[]).length),
     models.map(g=>g.children.length+'/'+(g.userData.parts||[]).length).join(' '));
  /* 총구가 화면 안쪽을 향하나 — 총열 끝이 몸통보다 카메라에서 멀어야 한다 */
  W.__equipW(5); W.__setAim(true, true); W.__PL.pitch = 0; W.__updPlayer(0.001);
  W.__updHeld(0.016, false, 0);
  const cam = W.__cam; cam.updateMatrixWorld(true); W.__held.updateMatrixWorld(true);
  const gg = models[5];
  /* 구운 메시는 전부 제자리(0,0,0)에 있고 좌표가 꼭짓점에 구워져 있으므로,
     자리 대신 실제로 차지하는 상자의 한가운데를 본다. */
  const depth = (m)=>{ const v = new T3.Vector3();
                       new T3.Box3().setFromObject(m).getCenter(v);
                       return -cam.worldToLocal(v).z; };
  const ms = gg.children.filter(m=>m.isMesh);
  const deep = Math.max(...ms.map(depth));
  const near = Math.min(...ms.map(depth));
  ok('★ 총구가 화면 안쪽을 향한다 (총열 끝이 개머리판보다 멀다)',
     deep - near > 0.15, '가까운 끝 '+near.toFixed(2)+' → 먼 끝 '+deep.toFixed(2));
  /* 떠 있는 조각이 없나 — 모든 조각이 다른 조각과 닿아 있어야 한다.
     (예전엔 손이 총 옆에 흰 상자로 따로 떠 있었다) */
  const floaters = [];
  for(const g2 of models){
    g2.updateMatrixWorld(true);
    /* 적어 둔 자리는 모형 안 좌표다 — 예전 검사와 같은 잣대로 재려고 세계 좌표로 옮긴다 */
    const boxes = (g2.userData.parts||[]).map(p=>
      new T3.Box3(new T3.Vector3(p[0],p[1],p[2]), new T3.Vector3(p[3],p[4],p[5]))
        .applyMatrix4(g2.matrixWorld).expandByScalar(0.004));
    boxes.forEach((b1,i)=>{
      if(!boxes.some((b2,j)=> i!==j && b1.intersectsBox(b2))) floaters.push(models.indexOf(g2)+'-'+i);
    });
  }
  ok('★ 떠 있는 조각이 하나도 없다 (손이 총 옆에 따로 뜨던 것)',
     floaters.length === 0, floaters.length ? '떠 있음 '+floaters.join(',') : '전부 붙어 있음');
  /* 무기를 바꾸면 손에 든 모형도 바뀐다 */
  W.__equipW(2); W.__updHeld(0.016, false, 0);
  const vis2 = models.findIndex(g2=>g2.visible);
  W.__equipW(3); W.__updHeld(0.016, false, 0);          // 3번은 위에서 샀다
  const vis6 = models.findIndex(g2=>g2.visible);
  ok('★ 무기를 바꾸면 손에 든 모형도 바뀐다', vis2 === 2 && vis6 === 3, vis2 + ' → ' + vis6);
  ok('한 번에 한 자루만 보인다', models.filter(g2=>g2.visible).length === 1,
     models.filter(g2=>g2.visible).length + '자루');
  W.__setAim(false, true);

  /* ───── 인벤토리 ───── */
  W.__openKit();
  ok('★ I 로 가방이 열린다', document.getElementById('popKit').classList.contains('on'));
  const wCards = document.querySelectorAll('#kitW .kitIt').length;
  ok('★ 산 무기만 목록에 나온다 (맨손 돌 + 산 3자루 = 4)', wCards === 4, wCards);
  ok('산 갑옷만 나온다 (털만 믿기 + 산 2벌 = 3)',
     document.querySelectorAll('#kitA .kitIt').length === 3,
     document.querySelectorAll('#kitA .kitIt').length);
  ok('지금 든 것에 표시가 붙는다', document.querySelectorAll('#kitW .kitIt.on').length === 1);
  /* 낮은 무기로 바꿔도 산 기록이 남는다 (예전 버그: 숫자 하나가 두 뜻을 겸했다) */
  W.__equipW(2);
  ok('★ 낮은 무기로 바꿔 껴도 비싼 무기가 사라지지 않는다',
     KIT.ownW[5] === true && KIT.wpn === 2, '든 것 '+KIT.wpn+' / 저격총 보유 '+!!KIT.ownW[5]);
  W.__equipW(0);
  ok('★ 무기를 풀면 맨손 돌로 돌아간다', KIT.wpn === 0);
  W.__equipA(0);
  ok('★ 갑옷도 벗을 수 있다', KIT.arm === 0 && W.__defNow() === 0, W.__defNow());
  W.__equipA(4);
  ok('다시 입으면 방어력이 돌아온다', W.__defNow() === W.__ARMORS[4].def, W.__defNow());
  const p0 = KIT.pot[0];
  PL.hp = 40; W.__usePotion(0);
  ok('가방에서 물약을 마시면 개수가 준다', KIT.pot[0] === p0-1, p0+' → '+KIT.pot[0]);
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));

  /* 상점 표시 */
  W.__openShop && (G.phase='day');
  W.__buildShopUI && W.__buildShopUI();
  ok('상점에서 이미 산 무기는 다시 못 산다', (()=>{
      const n = KIT.ownW.filter(Boolean).length;
      W.__buyWeapon(5);                      // 이미 가진 것
      return KIT.ownW.filter(Boolean).length === n;
    })());
  return R;
});
let pass=0, fail=0;
for(const [n,c,v] of out){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); c?pass++:fail++; }
console.log('\n' + (fail ? `${fail}개 실패 / ` : '') + `${pass}항목 통과`);
console.log(errs.length ? '\n오류: '+errs.slice(0,6).join(' | ') : '\n(오류 없음)');
await b.close(); srv.close();
process.exit(fail?1:0);
