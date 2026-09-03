/* 9차 손질 검사 — 체력바·화면 배치·할 일 안내·지도 상인·쓰러짐 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(9340, '/home/user/game/index.html');
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[];
const R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

/* ── 화면 배치: 여러 크기에서 가운데 판이 안 가려지나 ── */
for(const [w,h] of [[1400,860],[1280,800],[1180,700],[1024,640],[900,600],[820,1180],[760,420]]){
  const pg = await b.newPage({viewport:{width:w,height:h}});
  pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:9340/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(()=>{
    const W=window; W.__G.phase='night'; W.__G.day=12;
    const bw=W.__spawnWolf(4,0); W.__G.bossId=bw.id;
    for(let i=0;i<3;i++) W.__spawnWolf(0,1);
    W.__paintHUD();
    const g=id=>{ const e=document.getElementById(id); if(!e) return null;
      const b=e.getBoundingClientRect(); return [b.left,b.top,b.right,b.bottom]; };
    const ov=(a,c)=> a&&c&&!(a[2]<=c[0]||c[2]<=a[0]||a[3]<=c[1]||c[3]<=a[1]);
    const mids=['crystalWrap','grpBar','bossWrap'].map(g).filter(Boolean);
    const bad = ['topLeft','topRight2','miniWrap','dayBox'].filter(id=> mids.some(m=>ov(m,g(id))));
    const out = mids.some(m=>m[0]<-1||m[2]>innerWidth+1);
    const D=g('dock'), dockOut = D && (D[0]<-1 || D[2]>innerWidth+1);
    return {bad, out, dockOut};
  });
  ok(`${w}×${h} — 가운데 판이 다른 판에 안 가린다`, r.bad.length===0, r.bad.join(','));
  ok(`${w}×${h} — 가운데 판이 화면 밖으로 안 나간다`, !r.out);
  ok(`${w}×${h} — 아래 트레이가 화면 밖으로 안 나간다`, !r.dockOut);
  await pg.close();
}

/* ── 나머지 ── */
const pg = await b.newPage({viewport:{width:1180,height:700}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:9340/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(900);
const r2 = await pg.evaluate(()=>{
  const W=window,G=W.__G,PL=W.__PL,out={};
  /* 체력바 — 바탕과 채움의 그리는 순서가 못 박혀 있나 */
  const [bg,fg] = W.__HB();
  out.order = [bg.renderOrder, fg.renderOrder];
  G.phase='night'; G.wolves.length=0;
  PL.x=0; PL.z=16; PL.y=W.__solidTop(0,16); PL.yaw=0;
  const wv=W.__spawnWolf(0,0); wv.x=0; wv.z=8; wv.y=PL.y; wv.hp=wv.mx*0.5;
  W.__updPlayer(0.001); W.__drawWolfHP();
  /* 채움이 바탕보다 카메라 쪽에 있나 (같은 자리면 프레임마다 뒤집힌다) */
  const m1=new W.__THREE.Matrix4(), m2=new W.__THREE.Matrix4();
  bg.getMatrixAt(0,m1); fg.getMatrixAt(0,m2);
  const p1=new W.__THREE.Vector3().setFromMatrixPosition(m1);
  const p2=new W.__THREE.Vector3().setFromMatrixPosition(m2);
  const cam=W.__cam.position;
  out.bgD = p1.distanceTo(cam); out.fgD = p2.distanceTo(cam);
  /* 할 일 안내 — 처음 25초는 조작 안내, 그 뒤로는 할 일 */
  out.goalIntro = W.__goalText();
  W.__introDone();
  out.goalNight = W.__goalText();
  /* ★ 12차에서 '안 찍은 스텟 점수' 안내가 생겼다. 낮에는 그게 한 줄을 통째로 가져가므로
     (그게 맞는 동작이다) 여기서는 점수를 다 쓰고 나서 '낮에 할 일' 을 본다. */
  out.goalPts = (()=>{ W.__XP.pts = 2; G.phase='day'; return W.__goalText(); })();
  while(W.__XP.pts > 0){ const b=W.__XP.pts; W.__takeStat(0); if(W.__XP.pts===b) W.__takeStat(2); }
  G.phase='day'; out.goalDay = W.__goalText();
  PL.down = true; out.goalDown = W.__goalText();
  PL.down = false;
  /* 쓰러지면 공격 모드가 풀리나 */
  W.__setAim(true, true);
  PL.hp = 0; W.__goDown();
  out.aimAfterDown = W.__aimMode();
  PL.down=false; PL.hp=100;
  /* 지도에 상인이 그려지나 — 낮에만 */
  const cv=document.getElementById('mini'), cx=cv.getContext('2d');
  const [sx,sz]=W.__shopXZ();
  const [px0,pz0] = W.__mp(sx, sz); const px = Math.round(px0), pz = Math.round(pz0);
  G.phase='day'; W.__drawMini();
  let d = cx.getImageData(px-5, pz-5, 11, 11).data, dayRed=0;
  for(let i=0;i<d.length;i+=4) if(d[i]>170 && d[i+1]<110 && d[i+2]<110) dayRed++;
  G.phase='night'; W.__drawMini();
  d = cx.getImageData(px-5, pz-5, 11, 11).data; let nightRed=0;
  for(let i=0;i<d.length;i+=4) if(d[i]>170 && d[i+1]<110 && d[i+2]<110) nightRed++;
  out.dayRed = dayRed; out.nightRed = nightRed;
  return out;
});
ok('★ 체력바 바탕·채움의 그리는 순서가 못 박혀 있다', r2.order[1] > r2.order[0], r2.order.join(' < '));
ok('★ 채움이 바탕보다 카메라에 가깝다 (겹쳐서 사라지지 않게)',
   r2.fgD < r2.bgD - 0.01, r2.bgD.toFixed(2)+' → '+r2.fgD.toFixed(2));
ok('★ 처음 25초는 조작을 알려 준다', /WASD/.test(r2.goalIntro), r2.goalIntro);
ok('★ 밤에는 밤에 할 일이 뜬다', /늑대를 막으세요/.test(r2.goalNight), r2.goalNight);
ok('★ 낮에는 낮에 할 일이 뜬다', /캐서/.test(r2.goalDay), r2.goalDay);
ok('★ 안 찍은 스텟 점수가 있으면 낮에 그걸 먼저 알려 준다',
   /스텟 점수/.test(r2.goalPts), r2.goalPts);
ok('★ 쓰러지면 그 안내로 바뀐다', /쓰러졌어요/.test(r2.goalDown), r2.goalDown);
ok('★ 쓰러지면 공격 모드가 풀린다', r2.aimAfterDown === false);
ok('★ 낮에는 지도에 상인이 보인다', r2.dayRed > 4, r2.dayRed+'점');
ok('밤에는 지도에서 상인이 사라진다 (문을 닫으므로)', r2.nightRed === 0, r2.nightRed+'점');

let pass=0, fail=0;
for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); c?pass++:fail++; }
console.log('\n' + (fail?`${fail}개 실패 / `:'') + `${pass}항목 통과`);
console.log(errs.length ? '\n오류: '+errs.slice(0,6).join(' | ') : '\n(오류 없음)');
await b.close(); srv.close();
process.exit(fail?1:0);
