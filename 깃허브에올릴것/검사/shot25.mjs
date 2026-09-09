/* 상인·대장장이 — 살아 있나 (여러 시각을 겹쳐 찍는다) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19950), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:700}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2500);
await pg.evaluate(()=>{
  const st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,.pop{display:none!important}';
  document.head.appendChild(st);
  window.__held.visible=false;
});
for(const [who, nm] of [['shop','상인'],['forge','대장장이']]){
  for(let k=0;k<3;k++){
    await pg.evaluate(([who,k])=>{
      const W=window;
      const S = who==='shop' ? W.__SHOP() : W.__FORGE();
      const a = Math.atan2(S.z, S.x);                // 바깥쪽(아이들이 오는 쪽)에서 본다
      const d = 4.4, px = S.x+Math.cos(a)*d, pz = S.z+Math.sin(a)*d;
      W.__PL.x = px; W.__PL.z = pz;                  // 상인이 나를 보게
      W.__PL.yaw = Math.atan2(px-S.x, pz-S.z); W.__PL.pitch = -0.10;
      W.__cam.fov = 42; W.__cam.updateProjectionMatrix();
    }, [who,k]);
    await pg.waitForTimeout(430);
    await pg.screenshot({path:OUT+'/npc-'+nm+'-'+k+'.png'});
  }
  console.log('찍음', nm);
}
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
