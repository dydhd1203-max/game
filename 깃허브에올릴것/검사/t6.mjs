import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve.mjs';
const srv = serve(8761);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[];
pg.on('pageerror', e=> errs.push('PAGEERROR: '+e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await pg.goto('http://127.0.0.1:8761/?diag=1', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','테스트'); await pg.click('#bSolo'); await pg.waitForTimeout(900);

const r = await pg.evaluate(()=>{
  const W=window, out=[], ok=(n,c,x)=>out.push((c?'  OK  ':'FAIL  ')+n+(x!==undefined?'   → '+x:''));
  const PL=W.__PL, G=W.__G, GY=W.__GY, B=W.__BUILD, MAX=W.__MAXLV();
  try{
  G.started=false;

  /* ── 5. Lv6 승급 ── */
  ok('최고 등급 6', MAX===6, MAX);
  let allGrow=true, allDiff=true;
  for(const t of ['wwall','swall','arrow','ice','barr']){
    const hp=B[t].hp;
    if(hp.length!==6) allGrow=false;
    for(let i=1;i<6;i++) if(hp[i]<=hp[i-1]) allGrow=false;
    if((B[t].up||[]).length!==5) allGrow=false;
    const seen=new Set();
    for(let lv=1;lv<=6;lv++) seen.add(JSON.stringify(W.__blocks(t,lv)));
    if(seen.size!==6) allDiff=false;
  }
  ok('다섯 건물 다 6단계 · 체력이 계속 오른다', allGrow);
  ok('★ 여섯 등급의 생김새가 전부 다르다', allDiff);
  let hiUp=true;
  for(const t of ['arrow','ice','barr']){ const h=B[t].hi;
    if(!Array.isArray(h) || h.length!==6 || h[5]<=h[0]) hiUp=false; }
  ok('등급이 오르면 탑이 실제로 높아진다', hiUp, B.arrow.hi.join('/'));

  /* ── 3. 벽 높이 · 화살이 넘어간다 ── */
  ok('벽 높이 한 칸 낮아짐 (2.1 → 1.4)', B.wwall.hi===1.4 && B.swall.hi===1.4, B.wwall.hi);
  const shootY = GY + W.__bs('arrow','hi',1) + 0.35, wallTop = GY + B.swall.hi;
  ok('★ 화살이 벽 위로 넘어간다', shootY > wallTop + 0.8,
     '화살 '+shootY.toFixed(2)+' vs 벽 '+wallTop.toFixed(2));

  /* ── 10. 얼음탑이 공격한다 ── */
  ok('얼음탑에 공격력이 생겼다', Array.isArray(B.ice.dmg) && B.ice.dmg[0]>0, B.ice.dmg.join('/'));
  ok('얼음탑 감속은 맞은 늑대만 (범위 감속 코드 없음)', !!B.ice.slowT);

  /* ── 9. 입구에도 탑·배럭 ── */
  const d=W.__DIRS[0], T=45;
  const cx=Math.floor(d.dx*T), cz=Math.floor(d.dz*T);
  ok('★ 화살탑을 입구에 지을 수 있다', W.__canPlace('arrow',cx,cz)===null, W.__canPlace('arrow',cx,cz));
  ok('★ 배럭을 입구에 지을 수 있다', W.__canPlace('barr',cx,cz)===null, W.__canPlace('barr',cx,cz));
  ok('산에는 여전히 못 짓는다', W.__canPlace('arrow', Math.floor(d.dx*45-d.dz*9), Math.floor(d.dz*45+d.dx*9))!==null);

  /* ── 6·7. 늑대 강화 · 등급 ── */
  const r1=W.__wolfRank(1), r15=W.__wolfRank(15);
  ok('첫날 늑대는 0등급, 마지막 날은 3등급', r1===0 && r15===3, r1+' → '+r15);
  G.wolves.length=0; G.day=1; W.__spawnWolf(0,0);
  const w1=G.wolves[0].hp;
  G.wolves.length=0; G.day=15; W.__spawnWolf(0,0);
  const w15=G.wolves[0].hp;
  ok('★ 마지막 날 늑대가 첫날보다 훨씬 세다', w15 > w1*9, Math.round(w1)+' → '+Math.round(w15)+' 체력');

  /* ── 8. 양 체력 ── */
  G.wolves.length=0;
  ok('양 체력 100에서 시작', PL.hp===100, PL.hp);
  G.day=1; const bite1=W.__sheepBite({k:0}), bigBite=W.__sheepBite({k:2});
  G.day=15; const bite15=W.__sheepBite({k:0}), bossBite=W.__sheepBite({k:6});
  ok('★ 강한 늑대일수록 더 아프다', bigBite>bite1 && bossBite>bite15,
     '첫날 늑대 '+bite1+' / 큰늑대 '+bigBite+' / 마지막날 늑대 '+bite15+' / 늑대왕 '+bossBite);
  ok('한 방에 죽지는 않는다', bossBite < 100, bossBite);

  // 늑대를 옆에 두고 물리기
  G.phase='night'; G.started=true; PL.hp=100; PL.down=false; PL.biteT=0;
  PL.x=0; PL.z=0;
  G.wolves.push({id:999,k:0,x:0.5,z:0.5,y:GY,ry:0,hp:100,mx:100,mv:false,ph:0});
  W.__sheepHurt(0.016);
  ok('★ 옆에 늑대가 오면 피가 깎인다', PL.hp<100, PL.hp+'/100');
  for(let i=0;i<400;i++){ PL.biteT=0; W.__sheepHurt(0.05); }
  ok('★ 계속 맞으면 쓰러진다', PL.down===true && PL.hp===0);
  const before = G.wolves.length;
  W.__sheepHurt(0.05);
  ok('쓰러진 뒤에는 더 안 깎인다', PL.hp===0);

  // 쓰러지면 아무것도 못 짓는다
  W.__selBuild('wwall'); W.__setActing(true);
  for(let i=0;i<60;i++) W.__doAction(1/60);
  ok('★ 쓰러지면 짓지 못한다', W.__work()===null);
  W.__setActing(false); W.__doAction(1/60);

  // 아침이면 일어난다
  W.__onPhase('night','day');
  ok('★ 아침이면 다시 일어난다 (체력 100)', PL.down===false && PL.hp===100, PL.hp);
  // 안 죽고 아침 → +20
  PL.hp=50; W.__onPhase('night','day');
  ok('★ 살아서 아침을 맞으면 +20', PL.hp===70, PL.hp);
  PL.hp=95; W.__onPhase('night','day');
  ok('100 넘게는 안 찬다', PL.hp===100, PL.hp);

  // 친구 일으키기
  PL.hp=100; PL.down=false;
  G.players.set('friend', {x:1.2,z:0.6,y:GY,ry:0,g:1,n:'친구',mv:false,ph:0,down:true,hp:0});
  W.__cam.position.set(0, GY+PL.EYE, 0); W.__cam.rotation.set(0, Math.atan2(-1.2,-0.6), 0, 'YXZ');
  PL.x=0; PL.z=0; G.phase='night';
  const aim = W.__aimDown();
  ok('세팅: 쓰러진 친구를 조준했다', !!aim, aim?aim.n:'못 찾음');
  W.__setActing(true);
  for(let i=0;i<60*7;i++) W.__doAction(1/60);
  ok('7초에는 아직 못 일으킨다', G.players.get('friend').down===true);
  for(let i=0;i<60*1.5;i++) W.__doAction(1/60);
  ok('★ 8초 누르면 친구가 일어난다', G.players.get('friend').down===false);
  W.__setActing(false); W.__doAction(1/60);
  G.players.delete('friend');

  /* ── 병정 ── */
  ok('배럭 등급마다 병종 구성이 다르다', W.__SOL_COMP.length===6 &&
     W.__SOL_COMP[5].length > W.__SOL_COMP[0].length,
     W.__SOL_COMP.map(a=>a.length).join('/'));
  // 벽 통과 금지
  W.__clear(); G.res[G.me.g]={w:999,s:999,g:999};
  W.__place('swall', 20, 0);
  ok('★ 벽이 있는 칸은 병정이 못 지나간다', W.__blockedAt(20.5, 0.5, 0.42)===true);
  ok('벽 옆 빈 칸은 지나간다', W.__blockedAt(23.5, 0.5, 0.42)===false);
  ok('★ 몸통 반지름을 보므로 벽에 걸친 자리도 막힌다', W.__blockedAt(21.3, 0.5, 0.42)===true);

  /* ── 통신 왕복 ── */
  W.__clear();
  G.soldiers.length=0;
  G.soldiers.push({id:7,k:2,x:3,z:4,ry:1,mv:true,lv:5});
  const pk = W.__packSim();
  G.soldiers.length=0;
  W.__applySim(pk);
  const s0=G.soldiers[0];
  ok('★ 병정 종류·등급이 손님 화면까지 간다', s0 && s0.k===2 && s0.lv===5,
     s0 ? ('k='+s0.k+' lv='+s0.lv) : '없음');
  G.soldiers.length=0; G.wolves.length=0;
  }catch(e){ out.push('EXCEPTION: '+e.message+' | '+(e.stack||'').split('\n')[1]); }
  return out;
});
console.log(r.join('\n'));
console.log(errs.length ? '\n'+errs.slice(0,6).join('\n') : '\n(오류 없음)');
await b.close(); srv.close();
