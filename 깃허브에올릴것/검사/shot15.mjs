/* 15차 화면 확인 — 보물상자 새 모습 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19600); const OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:720}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(5000);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
/* 모형을 볼 때는 HUD 를 숨긴다 — 안내판이 가려서 여러 번 헛수고했다 */
await pg.evaluate(()=>{
  const st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed{display:none!important}';
  document.head.appendChild(st);
});
/* 상자를 내 앞에 놓고 본다 (부딪히면 먹히므로 CH_R 밖에 선다) */
for(const [name, d, hy, pit] of [['c1-가까이',3.0,0.6,-0.22],['c2-옆에서',3.6,1.4,-0.30]]){
  await pg.evaluate(([d,hy,pit,side])=>{
    const W=window, G=W.__G, PL=W.__PL;
    G.chests.length=0;
    PL.x=0; PL.z=-20; PL.y=W.__GY+hy; PL.yaw=Math.PI+(side?0.5:0); PL.pitch=pit;
    const fwx=-Math.sin(PL.yaw), fwz=-Math.cos(PL.yaw);
    G.chests.push({id:7, x:PL.x+fwx*d, z:PL.z+fwz*d, g:0, t:50});
    W.__cam.position.set(PL.x, PL.y+PL.EYE, PL.z);
    W.__cam.rotation.set(PL.pitch, PL.yaw, 0, 'YXZ');
  },[d,hy,pit,name.includes('옆')]);
  await pg.waitForTimeout(700);
  await pg.screenshot({path:OUT+'/'+name+'.png'}); console.log('찍음', name);
}
console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
