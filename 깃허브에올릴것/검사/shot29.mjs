/* 18차f 화면 확인 — 농장 안에 놓인 달걀·우유·고기 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19990), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2200);
await pg.evaluate(()=>{ document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  const st=document.createElement('style');
  st.textContent='#topRight,#dock,#hint,#stageTitle,#crosshair,#feed,#toast,.pop{display:none!important}';
  document.head.appendChild(st); window.__held.visible=false; });
/* 동물을 넣고 하루를 넘겨 산물이 나오게 한다 */
await pg.evaluate(()=>{ const W=window, G=W.__G, g=G.me.g, f=G.farm[g];
  f.hen=3; f.pig=2; f.cow=3; f.fed=G.day; G.day++; W.__farmMorning();
  G.paused=true; G.started=false; });
const look = `const setCam=(c,px,py,pz,tx,ty,tz,fov)=>{ c.fov=fov||64; c.updateProjectionMatrix();
  c.position.set(px,py,pz);
  const dx=tx-px, dy=ty-py, dz=tz-pz;
  c.rotation.set(Math.atan2(dy, Math.hypot(dx,dz)), Math.atan2(px-tx, pz-tz), 0, 'YXZ');
  c.updateMatrixWorld(true); };`;
const shot = async (nm, f)=>{ await pg.evaluate(f); await pg.waitForTimeout(520);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm); };
/* 우리를 비스듬히 내려다본다 */
await shot('farm-drops', new Function(look + `
  const W=window, G=W.__G, g=G.me.g;
  const cx=W.__FARM_X()[g], cz=W.__FARM_Z()[g], GY=W.__GY;
  W.__updDrops(0.016, 1.2);
  setCam(W.__cam, cx+7.5, GY+5.2, cz+7.5, cx, GY+0.5, cz, 58); W.__render();`));
/* 산물 하나를 눈앞에서 크게 */
await shot('farm-drop-close', new Function(look + `
  const W=window, G=W.__G, g=G.me.g, GY=W.__GY;
  const ds=W.__drops().filter(d=>d.g===g);
  /* 세 가지가 나란히 보이게 자리를 다시 잡는다 */
  const cx=W.__FARM_X()[g], cz=W.__FARM_Z()[g];
  const kinds=['egg','milk','meat'];
  ds.forEach((d,i)=>{ d.k=kinds[i%3]; d.x=cx+(i%3-1)*0.62; d.z=cz+1.5+Math.floor(i/3)*3.0; });
  W.__updDrops(0.016, 1.2);
  setCam(W.__cam, cx, GY+1.12, cz-1.1, cx, GY+0.20, cz+1.5, 55); W.__render();`));
/* 자원 창 — 나무·돌·금 아래에 달걀·우유·돼지고기가 같이 뜬다 */
await pg.evaluate(()=>{ const W=window, G=W.__G, g=G.me.g;
  /* 몇 개씩 주운 것으로 만들어 둔다 */
  W.__gain('eg',7); W.__gain('mk',3); W.__gain('pk',5);
  W.__hudPrev().farmRes = undefined; W.__paintHUD();
  const st=document.createElement('style');
  st.textContent='#topRight,#dock,#hint,#stageTitle,#crosshair,#feed,#toast,#miniBar,#dayBox,#missionBar,.pop{display:none!important}';
  document.head.appendChild(st); });
await pg.waitForTimeout(400);
{ const box = await pg.$('#resBox');
  await box.screenshot({path:OUT+'/res-panel.png'}); console.log('찍음', 'res-panel'); }
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
