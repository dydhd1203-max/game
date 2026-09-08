/* 17차c 화면 확인 — Lv6 과 Lv7 을 나란히 놓고 본다 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19920), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(3500);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; W.__G.paused=false; W.__G.started=false; W.__held.visible=false;
});
/* 한 종류씩 Lv6·Lv7 을 나란히 놓고 찍는다 */
for(const [t, nm, camY, camD] of [
    ['wwall','나무벽', 3.4, 8], ['swall','돌벽', 3.6, 8],
    ['arrow','화살탑', 6.5, 17], ['ice','얼음탑', 6.2, 16], ['barr','배럭', 5.5, 15]]){
  const info = await pg.evaluate(([t,camY,camD])=>{
    const W=window, G=W.__G;
    W.__clear();
    for(let i=0;i<5;i++) W.__base[i]={w:999999,s:999999,o:999999}; W.__recompute();
    G.me.g = 0; W.__syncMyPC();
    const why=[];
    const put=(x,z,lv)=>{ const r=W.__canPlace(t,x,z); if(r!==null){ why.push(x+','+z+':'+r); return null; }
      W.__place(t,x,z); const o=[...W.__STRU.values()].pop();
      o.lv=lv; o.mx=W.__bs(t,'hp',lv); o.hp=o.mx; return o; };
    /* 나무·바위·망루 계단을 피해 빈 자리를 찾는다 — 마당은 이미 꽤 차 있다 */
    const sz = W.__BUILD[t].size, gap = sz>=3 ? 8 : sz===2 ? 6 : 4;
    const free = (x0)=>{ for(let z=14; z<=30; z++) if(W.__canPlace(t,x0,z)===null) return z; return null; };
    let z0=null;
    for(let z=14; z<=30 && z0===null; z++)
      if(W.__canPlace(t,-gap,z)===null && W.__canPlace(t,gap,z)===null) z0=z;
    if(z0===null) return {놓임:false, 왜:['빈 자리 없음']};
    const a = put(-gap, z0, 6), c = put(gap, z0, W.__MAXLV);
    W.__G.__shotZ = z0;
    W.__rebuild();
    const cam=W.__cam; cam.fov=55; cam.updateProjectionMatrix();
    cam.position.set(0, W.__GY+camY, (W.__G.__shotZ||17)+camD);
    cam.rotation.set(-0.20, 0, 0, 'YXZ'); cam.updateMatrixWorld(true);
    W.__render && W.__render();
    return {놓임: !!(a&&c), Lv6체력: a?a.mx:0, Lv7체력: c?c.mx:0, 왜:why};
  }, [t,camY,camD]);
  await pg.waitForTimeout(150);
  await pg.evaluate(([camY,camD])=>{ const W=window, cam=W.__cam;
    cam.position.set(0, W.__GY+camY, (W.__G.__shotZ||17)+camD); cam.rotation.set(-0.20,0,0,'YXZ');
    cam.updateMatrixWorld(true); W.__render && W.__render(); }, [camY,camD]);
  await pg.screenshot({path:OUT+'/lv7-'+nm+'.png'});
  console.log('찍음', nm, JSON.stringify(info));
}
console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
