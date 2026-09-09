/* 마당을 위에서 통째로 — 자원이 어디에 깔렸나 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19960), OUT=process.argv[4]||'/tmp/shot', NM=process.argv[5]||'map';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2500);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#farmTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,.pop{display:none!important}';
  document.head.appendChild(st);
  for(let g=1; g<5; g++){ const f=W.__G.farm[g]; f.hen=2; f.pig=2; f.cow=2; }
  W.__farmDirty(true);
});
await pg.waitForTimeout(600);
await pg.evaluate(()=>{
  const W=window, cam=W.__cam;
  W.__G.started=false; W.__held.visible=false;
  cam.fov=70; cam.updateProjectionMatrix();
  cam.position.set(0, W.__GY+62, 0.01);
  cam.rotation.set(-Math.PI/2, 0, 0, 'YXZ');
  cam.updateMatrixWorld(true); W.__render();
});
await pg.waitForTimeout(250);
await pg.screenshot({path:OUT+'/'+NM+'.png'});
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
