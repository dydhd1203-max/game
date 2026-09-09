/* 18차c 화면 확인 — 넓힌 하늘 섬 · 서바이벌 지형 · 부드러운 줄 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19980), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2200);
await pg.evaluate(()=>{ const st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#dock,#hint,#stageTitle,#crosshair,#feed,#toast,.pop{display:none!important}';
  document.head.appendChild(st); window.__held.visible=false; });
const shot = async (nm, f)=>{ await pg.evaluate(f); await pg.waitForTimeout(500);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm); };
/* 카메라를 한 점에서 다른 점으로 보게 놓는다 */
const look = `const setCam=(c,px,py,pz,tx,ty,tz,fov)=>{ c.fov=fov||68; c.updateProjectionMatrix();
  c.position.set(px,py,pz);
  const dx=tx-px, dy=ty-py, dz=tz-pz;
  c.rotation.set(Math.atan2(dy, Math.hypot(dx,dz)), Math.atan2(px-tx, pz-tz), 0, 'YXZ');
  c.updateMatrixWorld(true); };`;

/* ① 서바이벌 지형 — 위에서 통째로 */
await shot('surv-top', new Function(look + `
  const W=window, M=W.__MINI(); W.__goMini(2); W.__G.paused=true; W.__G.started=false;
  setCam(W.__cam, 0, M.Y+62, 46, 0, M.Y, 0, 62); W.__render();`));
/* ② 서바이벌 — 1모둠 스폰에서 눈높이로 */
await shot('surv-eye', new Function(look + `
  const W=window, M=W.__MINI(); const sp=W.__miniSpawnXZ(0);
  setCam(W.__cam, sp[0], M.Y+1.6, sp[1], 0, M.Y+1.2, 0, 74); W.__render();`));
/* ③ 서바이벌 — 가운데 높은 단 위에서 내려다보기 */
await shot('surv-hill', new Function(look + `
  const W=window, M=W.__MINI(); const sp=W.__miniSpawnXZ(1);
  setCam(W.__cam, 0, M.Y+3.6, 0, sp[0], M.Y+1.0, sp[1], 76); W.__render();`));
/* ④ 넓힌 섬 — 퀴즈 얼굴, 위에서 */
await shot('isle-top', new Function(look + `
  const W=window, M=W.__MINI(); W.__miniExit(); W.__goMini(0); W.__G.paused=true; W.__G.started=false;
  setCam(W.__cam, 0, M.Y+58, 42, 0, M.Y, 0, 62); W.__render();`));
/* ⑤ 출발선에서 O·X 바라보기 */
await shot('isle-ox', new Function(look + `
  const W=window, M=W.__MINI();
  setCam(W.__cam, 0, M.Y+2.4, M.PADZ, 0, M.Y+1.6, M.OZ, 76); W.__render();`));
/* ⑥ 줄넘기 줄 — 옆에서 크게 */
await shot('rope-side', new Function(look + `
  const W=window, M=W.__MINI(), G=W.__G; W.__miniExit(); W.__goMini(1);
  G.mini.st='run'; G.t = M.ROPE - 1.35; G.paused=true; G.started=false;
  W.__drawRope();
  setCam(W.__cam, M.padX(2)+7.5, M.Y+2.2, M.PADZ+5.5, M.padX(2), M.Y+1.3, M.PADZ, 60); W.__render();`));
/* ⑦ 줄넘기 줄 — 뛰는 아이 눈높이. 줄이 '앞에서 내려오는' 순간을 찾아서 찍는다
   (아무 때나 찍으면 줄이 머리 뒤에 있어서 화면에 아무것도 안 나온다) */
const findPh = `const findT=(W,M,want)=>{ let bt=0, bd=9;
    for(let t=0.01;t<M.ROPE;t+=0.01){ const ph=W.__ropePhase(t)%(Math.PI*2);
      let d=Math.abs(ph-want); if(d>Math.PI) d=Math.PI*2-d; if(d<bd){bd=d; bt=t;} }
    return bt; };`;
await shot('rope-eye', new Function(look + findPh + `
  const W=window, M=W.__MINI(), G=W.__G;
  W.__held.visible=false;
  G.t = M.ROPE - findT(W, M, Math.PI*1.5); W.__drawRope();
  setCam(W.__cam, M.padX(2), M.Y+1.15, M.PADZ-0.6, M.padX(2), M.Y+0.9, M.PADZ+5, 76); W.__render();`));
/* ⑧ 줄이 발밑을 지나는 순간 (뛰어야 하는 때) */
await shot('rope-foot', new Function(look + findPh + `
  const W=window, M=W.__MINI(), G=W.__G;
  W.__held.visible=false;
  G.t = M.ROPE - findT(W, M, 0.12); W.__drawRope();
  setCam(W.__cam, M.padX(2)+5.0, M.Y+1.5, M.PADZ+4.2, M.padX(2), M.Y+0.6, M.PADZ, 62); W.__render();`));
/* ⑨ 땅에서 올려다본 하늘 섬 */
await shot('isle-below', new Function(look + `
  const W=window, M=W.__MINI(), G=W.__G; W.__miniExit(); G.phase='day';
  setCam(W.__cam, 0, W.__GY+2, 34, 0, M.Y, 0, 66); W.__render();`));
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
