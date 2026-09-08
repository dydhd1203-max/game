/* 예전 맵과 새 맵을 '같은 카메라' 로 한 장씩 찍는다 — 두 판 다 돌아야 한다 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3], OUT=process.argv[4];
const srv=serve(PORT, FILE);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(4000);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; W.__G.paused=false; W.__G.started=false;
  W.__scene.fog=null; W.__held.visible=false;
  const c=W.__cam; c.fov=60; c.near=1; c.far=600; c.updateProjectionMatrix();
});
const put=()=>{ const W=window,c=W.__cam;
  c.position.set(0, W.__GY+132, 0.01); c.rotation.set(-Math.PI/2,0,0,'YXZ');
  c.updateMatrixWorld(true); W.__render && W.__render(); };
await pg.evaluate(put); await pg.waitForTimeout(200); await pg.evaluate(put);
await pg.screenshot({path:OUT});
/* 입구가 어느 쪽을 보나 — 숫자로도 남긴다 */
console.log(OUT, JSON.stringify(await pg.evaluate(()=>window.__DIRS.map(d=>
  [+d.dx.toFixed(2), +d.dz.toFixed(2), d.off===undefined?'off없음':d.off]))));
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
