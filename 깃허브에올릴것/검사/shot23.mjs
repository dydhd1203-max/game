/* 농장 화면 확인 — 팻말 · 울타리 · 헛간 · 동물 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19930), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(3000);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,.pop{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; W.__G.paused=false; W.__held.visible=false;
  /* 다섯 모둠 우리를 동물로 채운다 */
  /* 0모둠은 빈 우리(제일 작은 단계), 나머지는 꽉 찬 우리(제일 큰 단계) */
  for(let g=1; g<5; g++){ const f=W.__G.farm[g]; f.hen=2; f.pig=2; f.cow=2; }
  W.__farmDirty(true);
});
/* 동물이 한 번 그려지도록 몇 프레임 돌린 뒤 게임을 멈춘다 —
   인스턴스 메시는 마지막 모습 그대로 남아 있어서 카메라만 옮기면 된다. */
await pg.waitForTimeout(600);
await pg.evaluate(()=>{ window.__G.started=false; window.__held.visible=false; });
/* 작은 우리(0모둠, 빈 우리) 와 큰 우리(1모둠) 를 나란히 본다 */
const shots = [
  ['front', 0, 3.2, 9.5, -0.16],   // 문 쪽(수정 쪽)에서
  ['sign',  0, 2.6, 5.0, -0.10],   // 팻말 가까이
  ['back',  Math.PI, 3.6, 10.0, -0.20],
  ['top',   0, 12.0, 8.0, -0.85],
];
for(const [nm, aoff, camY, camD, pitch] of shots){
  await pg.evaluate(([g, aoff, camY, camD, pitch])=>{
    const W=window, cam=W.__cam;
    const X=W.__FARM_X(), Z=W.__FARM_Z();
    const cx=X[g], cz=Z[g];
    /* 문(수정 쪽) 방향에서 우리를 바라본다 */
    const openA=Math.atan2(-cz,-cx);
    const a=openA+aoff;
    const px=cx+Math.cos(a)*camD, pz=cz+Math.sin(a)*camD;
    cam.fov=58; cam.updateProjectionMatrix();
    cam.position.set(px, W.__terrAt(Math.round(cx),Math.round(cz))+camY, pz);
    /* 우리 한가운데를 본다 */
    cam.rotation.set(pitch, Math.atan2(px-cx, pz-cz), 0, 'YXZ');
    cam.updateMatrixWorld(true);
    W.__render && W.__render();
  }, [+(process.env.FG||0), aoff, camY, camD, pitch]);
  await pg.waitForTimeout(200);
  await pg.screenshot({path:OUT+'/farm'+(process.env.FG||0)+'-'+nm+'.png'});
  console.log('찍음', nm);
}
/* 팻말 아주 가까이 — 숫자가 제대로 보이나 */
for(const g of [0,1,2,3,4]){
  await pg.evaluate((g)=>{
    const W=window, cam=W.__cam;
    const X=W.__FARM_X(), Z=W.__FARM_Z(), cx=X[g], cz=Z[g];
    const openA=Math.atan2(-cz,-cx);
    const [sx,sz]=W.__farmSpotXZ(g,'buy');
    const y0=W.__terrAt(Math.round(cx),Math.round(cz));
    const px=sx+Math.cos(openA)*3.0, pz=sz+Math.sin(openA)*3.0;
    cam.fov=45; cam.updateProjectionMatrix();
    cam.position.set(px, y0+2.3, pz);
    cam.rotation.set(-0.05, Math.atan2(px-sx, pz-sz), 0, 'YXZ');
    cam.updateMatrixWorld(true);
    W.__render && W.__render();
  }, g);
  await pg.waitForTimeout(150);
  await pg.screenshot({path:OUT+'/sign-'+(g+1)+'.png'});
}
console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
