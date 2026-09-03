/* 14차 손질 확인 — 상인·대장장이 새 모습 · 내가 든 총의 강화 빛 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19100); const OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1200,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(6000);   // 스테이지 안내가 사라질 때까지
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
/* 모형을 평가할 때는 HUD 를 숨긴다 — 안내판이 얼굴을 가려서 세 번 헛수고했다 */
const hideHUD=()=>pg.evaluate(()=>{
  const st=document.createElement('style'); st.id='noHud';
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed{display:none!important}';
  document.head.appendChild(st);
});
const showHUD=()=>pg.evaluate(()=>{ const e=document.getElementById('noHud'); if(e) e.remove(); });
const shot=async n=>{ await pg.waitForTimeout(500); await pg.screenshot({path:OUT+'/'+n+'.png'}); console.log('찍음',n); };

/* NPC 두 사람을 가까이서 — 바깥쪽에서 안쪽을 본다 */
for(const [name, who, d, pit] of [['b1-상인','shop',3.4,0.02],['b2-대장장이','forge',3.4,0.02]]){
  await pg.evaluate(([who,d,pit])=>{
    const W=window,PL=W.__PL;
    const [fx,fz] = who==='shop' ? W.__shopXZ() : W.__forgeXZ();
    const a=Math.atan2(fz,fx), R=Math.hypot(fx,fz)+d;
    PL.x=Math.cos(a)*R; PL.z=Math.sin(a)*R; PL.y=W.__GY;
    const dx=fx-PL.x, dz=fz-PL.z, h=Math.hypot(dx,dz);
    PL.yaw=Math.atan2(-dx/h,-dz/h); PL.pitch=pit;
    W.__cam.position.set(PL.x, PL.y+PL.EYE, PL.z);
    W.__cam.rotation.set(PL.pitch, PL.yaw, 0, 'YXZ');
  },[who,d,pit]);
  await hideHUD(); await shot(name); await showHUD();
}

/* 내가 든 총 — +0 / +3 / +6 */
for(const e of [0,3,6]){
  await pg.evaluate((e)=>{
    const W=window,PL=W.__PL;
    W.__KIT.ownW=[true,true,true,true,true,true,true];
    W.__equipWeapon(5); W.__setEnh(5,e);
    W.__setAim(true);
    PL.pitch=-0.02;
  }, e);
  await pg.waitForTimeout(700);
  await shot('b3-내총+'+e);
}
console.log(errs.length? '오류: '+errs.slice(0,5).join(' | ') : '오류 없음');
await b.close(); srv.close();
