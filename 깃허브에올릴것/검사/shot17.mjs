/* 16차 화면 확인 — 벽을 뛰어넘는 늑대의 도약 모션.
   한 번의 도약을 여섯 토막으로 잘라 옆에서 찍는다. 뛰는 그림은 한 장으로는 못 본다.
   ★ 페이지의 제 루프가 늑대를 건드리지 않게 낮(day)으로 두고 —
     메인 루프는 밤에만 hostSim 을 부른다 — 시뮬레이션은 내가 직접 돌린다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19700); const OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:720}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(4000);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
await pg.evaluate(()=>{ const st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,#misBar{display:none!important}';
  document.head.appendChild(st); });

/* 무대 — 산길을 돌벽으로 막고 그 앞에 뛰는 늑대 한 마리 */
const stage = await pg.evaluate(()=>{
  const W=window, G=W.__G;
  G.phase='day'; G.day=8; G.paused=false;     // 낮 = 메인 루프가 늑대를 안 건드린다
  G.wolves.length=0; W.__spawnQ().length=0; G.soldiers.length=0; G.chests.length=0;
  W.__PL.down = true;                          // 내 양을 물러 가지 않게
  W.__clear();
  for(let i=0;i<5;i++) W.__base[i]={w:999999,s:999999,o:999999}; W.__recompute();
  G.me.g=0;
  const d=W.__DIRS[0];
  let n=0;
  for(let pp=-7; pp<=7; pp++){
    const x=Math.round(d.dx*30-d.dz*pp), z=Math.round(d.dz*30+d.dx*pp);
    if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z); n++; }
  }
  W.__rebuild(); W.__flow();
  const w = W.__spawnWolf(W.__K_JUMP(), 0, d.dx*33, d.dz*33);
  w.x = d.dx*33; w.z = d.dz*33;
  G.__sw = w;
  return {walls:n, r:+Math.hypot(w.x,w.z).toFixed(1)};
});
console.log('무대', JSON.stringify(stage));

/* 옆에서 보는 자리 — 도약은 옆에서 봐야 호가 보인다 */
const shoot = async (name)=>{
  const info = await pg.evaluate(()=>{
    const W=window, PL=W.__PL, d=W.__DIRS[0], w=W.__G.__sw;
    const sx=-d.dz, sz=d.dx;
    const S = W.__G.__side || -3.6, IN = W.__G.__in || 27.6;
    const cx = d.dx*IN + sx*S, cz = d.dz*IN + sz*S;
    const cy = W.__GY + 3.0;
    PL.down = false;                       // 쓰러진 몸이 코앞에 그려지지 않게
    PL.x = cx; PL.z = cz; PL.y = cy - PL.EYE;
    PL.yaw = Math.atan2(-(w.x-cx), -(w.z-cz));
    const eye = cy;
    PL.pitch = Math.atan2((W.__GY + 0.7 + (w.jy||0)) - eye, Math.hypot(w.x-cx, w.z-cz));
    W.__cam.position.set(cx, eye, cz);
    W.__cam.rotation.set(PL.pitch, PL.yaw, 0, 'YXZ');
    W.__drawWolves(W.__G.wolves, performance.now()/1000, 1/60);
    W.__render && W.__render();
    return {jy:+(w.jy||0).toFixed(2), p:w.jT!==undefined?+(w.jT/w.jDur).toFixed(2):-1,
            r:+Math.hypot(w.x,w.z).toFixed(1)};
  });
  await pg.waitForTimeout(220);
  await pg.screenshot({path:OUT+'/'+name+'.png'});
  await pg.evaluate(()=>{ window.__PL.down = true; });   // 다시 눕힌다 (늑대가 안 쫓게)
  console.log('찍음', name, JSON.stringify(info));
  return info;
};

/* 도약이 시작될 때까지 한 번에 돌린다 */
const start = await pg.evaluate(()=>{
  const W=window, w=W.__G.__sw;
  for(let f=0; f<3000; f++){ W.__hostSim(1/60); if(w.jT !== undefined) return {f, ok:true}; }
  return {f:3000, ok:false};
});
console.log('도약까지', JSON.stringify(start));
if(!start.ok){ console.log('도약이 안 일어났다'); await b.close(); srv.close(); process.exit(1); }

/* 어느 쪽에서 봐야 안 가리는지 한 장씩 재 본다 */
for(const [nm,sd,inn] of [['A-오른쪽',3.6,27.6],['B-왼쪽',-3.6,27.6],['C-비스듬',-5.0,26.5]]){
  await pg.evaluate(([sd,inn])=>{ window.__G.__side=sd; window.__G.__in=inn; },[sd,inn]);
  await shoot('view'+nm);
}
await pg.evaluate(()=>{ window.__G.__side=-3.6; window.__G.__in=27.6; });
await shoot('j0-도약직전');
for(const p of [0.15, 0.32, 0.50, 0.72, 0.92]){
  await pg.evaluate((p)=>{ const W=window, w=W.__G.__sw;
    for(let f=0; f<300; f++){ if(w.jT===undefined || w.jT/w.jDur >= p) break; W.__hostSim(1/60); }
  }, p);
  await shoot('j'+String(p).replace('.','_'));
}
/* 착지한 뒤 몇 걸음 */
await pg.evaluate(()=>{ const W=window; for(let f=0; f<26; f++) W.__hostSim(1/60); });
await shoot('j9-착지후');

console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
