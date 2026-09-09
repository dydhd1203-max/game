/* 손에 든 도구 — 곡괭이·망치 모양 확인 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19940), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:700}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2500);
await pg.evaluate(()=>{
  const st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,.pop{display:none!important}';
  document.head.appendChild(st);
});
for(const [tool, nm] of [['mine','곡괭이'],['repair','망치'],['del','부수기']]){
  await pg.evaluate((t)=>{ window.__selTool(t); }, tool);
  await pg.waitForTimeout(400);
  /* 도구를 화면 한가운데 크게 놓고 본다 */
  await pg.evaluate(()=>{
    const W=window, h=W.__held;
    W.__G.started=false;                       // 흔들림을 멈춘다
    h.position.set(0.0,-0.12,-1.05); h.scale.setScalar(1.05);
    h.rotation.set(0,0,0);
    W.__cam.rotation.set(0,0,0); W.__cam.updateMatrixWorld(true);
    W.__render();
  });
  await pg.waitForTimeout(120);
  await pg.screenshot({path:OUT+'/tool-'+nm+'.png'});
  await pg.evaluate(()=>{ window.__G.started=true; const h=window.__held;
    h.scale.setScalar(0.60); });
  console.log('찍음', nm);
}
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
