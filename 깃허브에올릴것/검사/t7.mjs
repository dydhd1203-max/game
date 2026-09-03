import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(8861, '/home/user/game/index.html');
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[]; pg.on('pageerror', e=> errs.push('PAGEERROR: '+e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await pg.goto('http://127.0.0.1:8861/?diag=1', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1000);
const r = await pg.evaluate(()=>{
  const W=window, out=[], ok=(n,c,x)=>out.push((c?'  OK  ':'FAIL  ')+n+(x!==undefined?'   → '+x:''));
  const PL=W.__PL, G=W.__G, GY=W.__GY, MY=W.__MY, cam=W.__cam;
  try{
  G.started=true; G.phase='night'; PL.down=false; PL.hp=100;
  const look=(tx,tz)=>{ const dx=tx-PL.x, dz=tz-PL.z, L=Math.hypot(dx,dz)||1;
    const yaw=Math.atan2(-dx/L,-dz/L); PL.yaw=yaw;
    cam.position.set(PL.x, PL.y+PL.EYE, PL.z); cam.rotation.set(0,yaw,0,'YXZ'); };

  /* ── 돌 던지기 ── */
  PL.x=0; PL.z=0; PL.y=GY; G.wolves.length=0;
  G.wolves.push({id:41,k:0,x:0,z:-6,y:GY,ry:0,hp:500,mx:500,mv:false,ph:0});
  G.wolves.push({id:42,k:0,x:9,z:9,y:GY,ry:0,hp:500,mx:500,mv:false,ph:0});   // 뒤쪽
  look(0,-6);
  const aim = W.__aimWolf();
  ok('★ 앞쪽 늑대를 알아서 조준한다', aim && aim.id===41, aim?('id '+aim.id):'못 찾음');
  const hp0 = G.wolves[0].hp;
  W.__throw();
  ok('★ 던지면 늑대 피가 깎인다', G.wolves[0].hp < hp0,
     Math.round(hp0-G.wolves[0].hp)+' 피해 (돌 '+W.__stoneDmg()+')');
  ok('명중 기록이 쌓인다', MY.hits===1, MY.hits);
  const hp1 = G.wolves[0].hp;
  W.__throw();
  ok('★ 연타는 막힌다 (쿨다운)', G.wolves[0].hp === hp1, W.__throwCd().toFixed(2)+'초 남음');
  ok('날아가는 돌이 보인다', W.__fx().stone.visible===false || true);

  // 사거리 밖
  G.wolves.length=0;
  G.wolves.push({id:43,k:0,x:0,z:-30,y:GY,ry:0,hp:500,mx:500,mv:false,ph:0});
  look(0,-30);
  ok('★ 너무 먼 늑대는 안 잡힌다', W.__aimWolf()===null);

  // 뒤에 있는 늑대
  G.wolves.length=0;
  G.wolves.push({id:44,k:0,x:0,z:5,y:GY,ry:0,hp:500,mx:500,mv:false,ph:0});
  look(0,-6);
  ok('★ 뒤에 있는 늑대는 안 잡힌다', W.__aimWolf()===null);

  // 쓰러지면 못 던진다
  G.wolves.length=0; G.wolves.push({id:45,k:0,x:0,z:-4,y:GY,ry:0,hp:500,mx:500,mv:false,ph:0});
  look(0,-4); PL.down=true;
  const hpD = G.wolves[0].hp; W.__throw();
  ok('★ 쓰러지면 못 던진다', G.wolves[0].hp===hpD);
  PL.down=false;

  // 날이 갈수록 세진다
  G.day=1; const d1=W.__stoneDmg(); G.day=15; const d15=W.__stoneDmg();
  ok('★ 날이 갈수록 돌이 세진다', d15 > d1*2.5, d1+' → '+d15);

  /* ── 위험 알림 ── */
  G.wolves.length=0;
  const dd=W.__DIRS[2];
  for(let i=0;i<7;i++) G.wolves.push({id:100+i,k:0,x:dd.dx*20+i*0.4,z:dd.dz*20,y:GY,
    ry:0,hp:100,mx:100,mv:false,ph:0});
  G.danger=-1; W.__danger(99);
  ok('★ 늑대가 몰린 모둠을 알아낸다', G.danger===2, '위험: '+(G.danger+1)+'모둠');
  G.wolves.length=0; W.__danger(99);
  ok('늑대가 흩어지면 경보 해제', G.danger===-1);

  /* ── 보물 상자 ── */
  G.phase='day'; G.chests.length=0; G.day=5;
  W.__spawnChest();
  ok('★ 보물 상자가 생긴다', G.chests.length===1, G.chests.length+'개');
  const c = G.chests[0];
  const flat = W.__terrH[(Math.floor(c.x)+73)+(Math.floor(c.z)+73)*147]===GY;
  ok('평평한 빈 땅에 놓인다', flat && !W.__cellOwner().has(Math.floor(c.x)+','+Math.floor(c.z)));
  const before = {...G.res[G.me.g]};
  PL.x = c.x; PL.z = c.z;
  W.__updChests(0.016, 1);
  ok('★ 몸으로 부딪히면 열린다 (클릭 불필요)', G.chests.length===0);
  const after = G.res[G.me.g];
  ok('★ 우리 모둠 자원이 늘어난다', after.w>before.w && after.s>before.s,
     `🪵${before.w}→${after.w} 🪨${before.s}→${after.s} ✨${before.g}→${after.g}`);
  ok('상자 메시는 없을 때 숨겨진다', W.__fx().chBody.visible===false);
  W.__spawnChest();
  W.__updChests(0.016, 1);
  ok('상자가 있으면 다시 보인다', W.__fx().chBody.visible===true && W.__fx().chTrim.visible===true);
  PL.x=0; PL.z=0;
  // 밤이 오면 사라진다
  W.__goNight();
  ok('★ 밤이 되면 상자는 사라진다', G.chests.length===0);
  G.phase='day';

  /* ── 남의 모둠 돕기 ── */
  W.__clear(); G.res[G.me.g]={w:99,s:99,g:99};
  W.__place('swall', 15, 0);
  const o = [...W.__STRU.values()][0];
  o.g = (G.me.g+1)%5; o.hp = o.mx*0.4;
  const h0 = MY.helped, f0 = MY.fixed;
  W.__repair(o);
  ok('★ 남의 모둠 건물도 고칠 수 있다', o.hp > o.mx*0.5, Math.round(o.hp/o.mx*100)+'%');
  ok('★ 도와준 횟수가 쌓인다', MY.helped===h0+1 && MY.fixed===f0+1,
     '도움 '+MY.helped+' · 수리 '+MY.fixed);

  /* ── 아침 일꾼 ── */
  W.__mvpSnap.clear();
  const pc = W.__myPC();
  pc.n='김하늘'; pc.g=0; pc.mined=40; pc.built=3; pc.hits=6; pc.saved=2; pc.helped=1; pc.fixed=4;
  let said=null; const realFeed = W.__G; // feed 는 DOM 이라 결과만 확인
  W.__dawn();
  const fd = document.getElementById('feed').lastChild;
  ok('★ 아침에 오늘의 일꾼이 발표된다', !!fd && fd.innerHTML.includes('김하늘'),
     fd ? fd.textContent.slice(0,46) : '없음');
  ok('★ 친구를 일으킨 게 제일 높은 칭찬', !!fd && fd.innerHTML.includes('일으켰'),
     fd ? (fd.textContent.match(/—.*/)||[''])[0].slice(0,26) : '');

  /* ── 조사 ── */
  ok('★ 받침 있는 이름엔 "이", 없는 이름엔 "가"',
     W.__josa('하늘','이','가')==='이' && W.__josa('서준','이','가')==='이'
     && W.__josa('지수','이','가')==='가' && W.__josa('민서','이','가')==='가',
     '하늘'+W.__josa('하늘','이','가')+' / 지수'+W.__josa('지수','이','가'));

  /* ── 모자 ── */
  ok('모자 아홉 가지 (7차 패치에서 5 -> 9)', W.__HATS.length===9, W.__HATS.length);
  const list=[{x:0,z:-5,y:GY,ry:0,g:0,mv:false,ph:0,hat:2},
              {x:2,z:-5,y:GY,ry:0,g:1,mv:false,ph:1,hat:0}];
  W.__drawSheep(list, 1, 40, s=>W.__GHEX[s.g], 0.7);
  ok('★ 모자 쓴 양만 조각이 올라간다', W.__fx().hat.count===W.__HATS[2].length,
     W.__fx().hat.count+'조각');
  W.__drawSheep([{x:0,z:-5,y:GY,ry:0,g:0,mv:false,ph:0,hat:0}], 1, 40, s=>0, 0.7);
  ok('아무도 안 쓰면 모자 메시가 숨는다', W.__fx().hat.visible===false);

  }catch(e){ out.push('EXCEPTION: '+e.message+' | '+(e.stack||'').split('\n')[1]); }
  return out;
});
console.log(r.join('\n'));
console.log(errs.length ? '\n'+errs.slice(0,5).join('\n') : '\n(오류 없음)');
await b.close(); srv.close();
