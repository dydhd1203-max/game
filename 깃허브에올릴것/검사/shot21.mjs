/* 17차d 화면 확인 — 농장 · 동물 · 더러움 */
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
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(3500);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,#aimInfo{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; if(W.__scene.fog){ W.__scene.fog.near=200; W.__scene.fog.far=400; }
  /* 손에 든 곡괭이는 매 프레임 다시 보이게 되므로 아예 장면에서 뺀다 */
  if(W.__held && W.__held.parent) W.__held.parent.remove(W.__held);
});
const look = async (nm, g, dist, hy, dirt, animals, face)=>{
  await pg.evaluate(([g,dist,hy,dirt,animals])=>{
    const W=window, f=W.__G.farm[g];
    Object.assign(f, animals); f.dirt = dirt;
    W.__farmDirty(true);
    const cx=W.__FARM_X()[g], cz=W.__FARM_Z()[g];
    /* 문 쪽에서 살짝 비껴 서서 본다 — 정면이면 번호판 기둥이 한가운데를 가린다 */
    const a=Math.atan2(-cz,-cx) - 0.55;
    const px=cx+Math.cos(a)*dist, pz=cz+Math.sin(a)*dist;
    const yaw=Math.atan2(-(cx-px), -(cz-pz));
    /* 카메라는 양(PL) 자리를 따라간다 — 안 그러면 내 양이 화면에 들어온다 */
    const PL=W.__PL; PL.x=px; PL.z=pz; PL.y=W.__GY;
    PL.yaw=yaw; PL.pitch=-Math.atan2(hy-1.0, dist);
    const c=W.__cam; c.fov=62; c.updateProjectionMatrix();
    c.position.set(px, W.__GY+hy, pz);
    c.rotation.set(PL.pitch, yaw, 0, 'YXZ');
    c.updateMatrixWorld(true);
  }, [g,dist,hy,dirt,animals]);
  await pg.waitForTimeout(500);
  /* 얼굴을 보려면 동물이 이쪽을 봐야 한다 — 자리는 그대로 두고 방향만 돌린다 */
  if(face) await pg.evaluate(()=>{
    const W=window, c=W.__cam;
    for(const sp of W.__farmSpots()) sp.ry = Math.atan2(c.position.x-sp.x, c.position.z-sp.z);
  });
  await pg.evaluate(()=>{ window.__render && window.__render(); });
  await pg.screenshot({path:OUT+'/'+nm+'.png'});
  console.log('찍음', nm);
};
await look('farm-1빈우리',   0, 8.5, 2.4, 0,    {hen:0,pig:0,cow:0});
await look('farm-2가득',     0, 8.0, 2.4, 0,    {hen:2,pig:2,cow:2});
await look('farm-3가까이',   0, 5.4, 2.9, 0,    {hen:2,pig:2,cow:2});
await look('farm-4더러움',   0, 6.0, 3.2, 1.0,  {hen:2,pig:2,cow:2});
await look('farm-4b조금더러움', 0, 6.0, 3.2, 0.4, {hen:2,pig:2,cow:2});
await look('farm-5닭만',     0, 4.2, 1.5, 0,    {hen:4,pig:0,cow:0}, 1);
await look('farm-6돼지만',   0, 4.2, 1.6, 0,    {hen:0,pig:4,cow:0}, 1);
await look('farm-7소만',     0, 4.4, 1.8, 0,    {hen:0,pig:0,cow:4}, 1);
console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
