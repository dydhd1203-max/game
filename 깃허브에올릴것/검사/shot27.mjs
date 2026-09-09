/* 18차 화면 확인 — 하늘 섬 미니게임장 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19970), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2200);
await pg.evaluate(()=>{ const st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#dock,#hint,#stageTitle,#crosshair,#feed,#toast,#miniBar,.pop{display:none!important}';
  document.head.appendChild(st); window.__held.visible=false; });
const shot = async (nm, f)=>{ await pg.evaluate(f); await pg.waitForTimeout(420);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm); };
/* 섬 전체를 위에서 */
await shot('isle-top', ()=>{ const W=window, M=W.__MINI(); W.__goMini(0); W.__G.paused=true;
  W.__G.started=false; const c=W.__cam; c.fov=68; c.updateProjectionMatrix();
  c.position.set(0, M.Y+38, 26); c.rotation.set(-0.95, 0, 0, 'YXZ'); c.updateMatrixWorld(true); W.__render(); });
/* 출발선에서 O·X 를 바라본 눈높이 */
await shot('isle-ox', ()=>{ const W=window, M=W.__MINI(), c=W.__cam;
  c.fov=72; c.updateProjectionMatrix();
  c.position.set(0, M.Y+2.4, M.PADZ+1); c.rotation.set(-0.05, Math.PI, 0, 'YXZ'); c.updateMatrixWorld(true); W.__render(); });
/* 땅에서 올려다본 하늘 섬 */
await shot('isle-below', ()=>{ const W=window, M=W.__MINI(), c=W.__cam;
  c.fov=62; c.updateProjectionMatrix();
  W.__G.phase='day';
  c.position.set(0, W.__GY+2, 30); c.rotation.set(0.85, 0, 0, 'YXZ'); c.updateMatrixWorld(true); W.__render(); });
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
