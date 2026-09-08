/* 17차 — 맵을 위에서 내려다보고 확인한다.
   ★ 다섯 입구가 전부 축과 나란한가, 어귀가 직선인가, 벽 한 줄이 산에 맞물리는가. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19800); const OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(4000);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* 숫자로 먼저 확인 — 그림보다 이게 정확하다 */
const num = await pg.evaluate(()=>{
  const W=window, o={};
  o.어귀 = W.__GMOUTH.map(m=>[Math.round(m[0]), Math.round(m[1])]);
  o.방향 = W.__DIRS.map(d=>[d.dx, d.dz, d.off]);
  /* 각 입구 어귀에서, 통로를 가로지르는 '한 줄' 이 정말 한 줄인가 —
     통로 양 끝의 산이 같은 t(축 거리)에서 시작하면 직선이다 */
  o.어귀직선 = [];
  for(let g=0; g<5; g++){
    const hits=[];
    for(let pp=-9; pp<=9; pp++){
      /* 이 옆칸에서 바깥으로 나가며 산을 처음 만나는 t */
      let t0=null;
      for(let t=W.__ARENA_R-6; t<=W.__ARENA_R+8; t+=0.5){
        const x=Math.floor(W.__gX(g,t,pp)), z=Math.floor(W.__gZ(g,t,pp));
        if(!W.__inW(x,z)) break;
        if(W.__terrAt(x,z) > W.__GY){ t0=t; break; }
      }
      hits.push(t0===null?null:+t0.toFixed(1));
    }
    o.어귀직선.push(hits);
  }
  /* 지을 수 있는 칸 수 — 예전 원(반지름 40)과 얼마나 다른가 */
  let cells=0, circ=0;
  for(let z=-45; z<=45; z++) for(let x=-45; x<=45; x++){
    if(W.__oct(x+0.5,z+0.5) <= W.__ARENA_R-0.5) cells++;
    if(Math.hypot(x+0.5,z+0.5) <= W.__ARENA_R-0.5) circ++;
  }
  o.마당칸 = cells; o.예전원 = circ; o.늘어난비율 = +((cells/circ-1)*100).toFixed(1);
  return o;
});
console.log(JSON.stringify(num,null,1));

/* 위에서 내려다본 그림 */
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; W.__G.paused=false;
  /* ★ 게임 루프가 매 프레임 카메라를 양의 자리로 되돌린다 — 아예 세워 둔다.
     그리기는 이 블록 밖이라 계속 돈다. 안개도 꺼야 위에서 내려다보인다. */
  W.__G.started = false;
  W.__scene.fog = null;
  W.__held.visible = false;
  const cam = W.__cam;
  cam.fov = 60; cam.near = 1; cam.far = 600; cam.updateProjectionMatrix();
});
for(const [nm, h] of [['map-위에서', 132], ['map-비스듬', 86]]){
  await pg.evaluate((h)=>{
    const W=window, cam=W.__cam;
    if(h > 120){ cam.position.set(0, W.__GY+h, 0.01); cam.rotation.set(-Math.PI/2, 0, 0, 'YXZ'); }
    else       { cam.position.set(0, W.__GY+h, 100);  cam.rotation.set(-0.80, 0, 0, 'YXZ'); }
    cam.updateMatrixWorld(true);
    W.__render && W.__render();
  }, h);
  await pg.waitForTimeout(150);
  await pg.evaluate((h)=>{ const W=window, cam=W.__cam;
    if(h > 120){ cam.position.set(0, W.__GY+h, 0.01); cam.rotation.set(-Math.PI/2, 0, 0, 'YXZ'); }
    else       { cam.position.set(0, W.__GY+h, 100);  cam.rotation.set(-0.80, 0, 0, 'YXZ'); }
    cam.updateMatrixWorld(true); W.__render && W.__render(); }, h);
  await pg.screenshot({path:OUT+'/'+nm+'.png'});
  console.log('찍음', nm);
}
/* 아래쪽 두 입구를 가까이서 — 나란히 놓인 3·4모둠 문이 제대로 보이나 */
for(const [nm, px,py,pz, pit, yaw] of [
    ['map-아래문', 0, 14, 74, -0.30, 0],
    ['map-3모둠앞', 13, 12, 62, -0.26, 0],
    ['map-1모둠앞', 0, 12, -62, -0.26, Math.PI]]){
  const put = ([px,py,pz,pit,yaw])=>{ const W=window, cam=W.__cam;
    cam.fov=62; cam.updateProjectionMatrix();
    cam.position.set(px, W.__GY+py, pz);
    cam.rotation.set(pit, yaw, 0, 'YXZ'); cam.updateMatrixWorld(true);
    W.__render && W.__render(); };
  await pg.evaluate(put, [px,py,pz,pit,yaw]);
  await pg.waitForTimeout(120);
  await pg.evaluate(put, [px,py,pz,pit,yaw]);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm);
}
console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
