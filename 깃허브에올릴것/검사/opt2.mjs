/* 구간별 CPU 비용을 직접 잰다 — 스왑버퍼·소프트웨어 래스터가 섞이지 않게
   페이지 안에서 같은 함수를 N번 돌려 시간을 나눈다. 교실 기기로 옮겨 읽기 좋다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE = process.argv[2], PORT = +process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--js-flags=--expose-gc']});
const pg = await b.newPage({viewport:{width:1180,height:720}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','측정'); await pg.click('#bSolo');
await pg.waitForTimeout(1200);

const out = await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, L=[];
  /* 다섯 문 Lv4 방어선 */
  for(let i=0;i<5;i++) W.__base[i]={w:999999,s:999999,o:999999};
  W.__recompute(); W.__clear();
  for(let g=0; g<5; g++){ const d=W.__DIRS[g]; G.me.g=g;
    for(let pp=-8; pp<=8; pp+=0.5){
      const x=Math.round(d.dx*42-d.dz*pp), z=Math.round(d.dz*42+d.dx*pp);
      if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs('swall','hp',4); o.hp=o.mx; } }
    for(const [t,rr,pp] of [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],
                            ['arrow',26,0],['ice',33,-5],['ice',33,5],['barr',24,-3],['barr',24,3]]){
      const x=Math.round(d.dx*rr-d.dz*pp), z=Math.round(d.dz*rr+d.dx*pp);
      if(W.__canPlace(t,x,z)===null){ W.__place(t,x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs(t,'hp',4); o.hp=o.mx; } } }
  G.me.g=0; W.__rebuild();
  G.day=12; G.crystal=G.set.crystalMax; W.__goNight();
  /* 늑대를 직접 40마리 세워 둔다 — 탑이 바로 잡아 버리지 않게 체력을 크게 */
  G.wolves.length=0; W.__spawnQ().length=0;
  for(let i=0;i<40;i++){ const g=i%5, d=W.__DIRS[g], w=W.__spawnWolf(i%3, g);
    const r=26+(i%9)*1.8, off=(((i/9)|0)-2)*2.4;
    w.x=d.dx*r-d.dz*off; w.z=d.dz*r+d.dx*off;
    w.y=W.__solidTop(Math.floor(w.x),Math.floor(w.z));
    w.mx*=50; w.hp=w.mx; }
  const d0=W.__DIRS[0];
  PL.x=d0.dx*46; PL.z=d0.dz*46; PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z))+1;
  PL.yaw=Math.atan2(-(0-PL.x), -(0-PL.z));
  W.__cam.position.set(PL.x, PL.y+1.12, PL.z); W.__cam.rotation.set(0, PL.yaw, 0, 'YXZ');
  W.__cam.updateMatrixWorld();

  const bench=(name, n, f)=>{ for(let i=0;i<3;i++) f();            // 예열
    const t=performance.now(); for(let i=0;i<n;i++) f();
    const ms=(performance.now()-t)/n;
    L.push('  '+name.padEnd(20,' ')+ms.toFixed(3)+' ms/회'); return ms; };

  L.push('── 한 프레임 안에서 도는 일 (늑대 40 · 건물 '+W.__STRU.size+'채) ──');
  const mSim  = bench('시뮬(hostSim)', 300, ()=>W.__hostSim(1/60));
  const mWolf = bench('늑대 그리기',   300, ()=>W.__drawWolves(G.wolves, 1, 1/60));
  const mSol  = bench('병사 그리기',   300, ()=>W.__drawSoldiers(G.soldiers, 1));
  const mSh   = bench('양 그리기',     300, ()=>W.__drawSheep([...G.players.values()], 1, 21, s=>0xffffff, 1));
  const mHP   = bench('늑대 체력막대', 300, ()=>W.__drawWolfHP());
  const mTag  = bench('이름표',        200, ()=>W.__updTags());
  const mNum  = bench('뜨는 숫자',     300, ()=>W.__dnTick(1/60));
  const mHeld = bench('든 물건',       300, ()=>W.__updHeld(1/60, false, 0));
  L.push('  ── 초당 8번만 도는 일 ──');
  const mHUD  = bench('HUD 글자',      200, ()=>W.__paintHUD && W.__paintHUD());
  const mMini = bench('미니맵',        200, ()=>W.__drawMini());
  L.push('  ── 가끔 도는 일 ──');
  const mReb  = bench('건물메시 다시', 20, ()=>W.__rebuild());
  const hurt=[...W.__STRU.values()].filter((o,i)=>i%8===0);
  const mTin  = bench('색만 고치기('+hurt.length+'채)', 200,
                      ()=>{ for(const o of hurt) W.__struTint.add(o); W.__tint(); });
  const mFlow = bench('길찾기 판 새로', 20, ()=>W.__flow());

  const per = mSim+mWolf+mSol+mSh+mHP+mTag+mNum+mHeld;
  L.push('');
  L.push('  매 프레임 합계          '+per.toFixed(2)+' ms');
  L.push('  + 초당8회분(÷7.5)      '+((mHUD+mMini)/7.5).toFixed(2)+' ms');
  L.push('  + 초당12회 색만 고치기  '+(mTin/5).toFixed(2)+' ms');
  L.push('  = CPU 한 프레임         '+(per+(mHUD+mMini)/7.5+mTin/5).toFixed(2)+' ms  (60fps 예산 16.7ms)');
  L.push('  (예전처럼 매번 통째로 다시 만들면 +'+(mReb/5).toFixed(2)+' ms, 그리고 '
    +mReb.toFixed(1)+'ms 짜리 턱이 초당 12번)');

  /* 쓰레기 만드는 양 — 크롬북에서 끊김의 진짜 원인 */
  L.push('');
  L.push('── 쓰레기 수거 압박 ──');
  if(performance.memory){
    if(window.gc) window.gc();
    const h0 = performance.memory.usedJSHeapSize;
    for(let i=0;i<600;i++){ W.__hostSim(1/60); W.__drawWolves(G.wolves,i/60,1/60);
      W.__drawWolfHP(); W.__dnTick(1/60); }
    const h1 = performance.memory.usedJSHeapSize;
    L.push('  600프레임 동안 새로 만든 양 '+((h1-h0)/1048576).toFixed(1)+' MB'
      +'  → 프레임당 '+(((h1-h0)/600)/1024).toFixed(1)+' KB');
  } else L.push('  (이 브라우저에선 못 잼)');

  /* 그리기 */
  L.push('');
  L.push('── 그리기 ──');
  W.__R.info.reset(); W.__render();
  L.push('  드로우콜 '+W.__R.info.render.calls+' · 삼각형 '
    +Math.round(W.__R.info.render.triangles/1000)+'K');
  L.push('  장면 물체 수 '+(()=>{let n=0; W.__scene.traverse(o=>{if(o.visible&&(o.isMesh||o.isPoints||o.isLine))n++;}); return n;})());
  return L.join('\n');
});
console.log(out);
console.log(errs.length ? '\n⚠ 오류: '+errs.slice(0,3).join(' | ') : '\n오류 없음');
await b.close(); srv.close();
