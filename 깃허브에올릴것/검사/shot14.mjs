/* 14차 화면 확인 — 코드가 맞아 보여도 화면은 다를 수 있다.
   거꾸로 달린 총·안 보이던 체력바·얼굴에서 터진 축포를 다 스크린샷이 잡았다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||17500); const OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1366,height:768}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1500);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
const shot = async (n)=>{ await pg.waitForTimeout(500); await pg.screenshot({path:OUT+'/'+n+'.png'}); console.log('찍음', n); };

/* ① 대장간 앞 — 모형이 제대로 서 있나, 안내가 뜨나 */
await pg.evaluate(()=>{
  const W=window,PL=W.__PL,[fx,fz]=W.__forgeXZ();
  /* ★ 바깥쪽에서 안쪽을 본다 — 안쪽에서 물러나면 원점(수정 받침) 속으로 들어간다 */
  const a=Math.atan2(fz,fx), R=Math.hypot(fx,fz)+3.4;
  PL.x=Math.cos(a)*R; PL.z=Math.sin(a)*R; PL.y=W.__GY;
  const dx=fx-PL.x, dz=fz-PL.z, h=Math.hypot(dx,dz);
  PL.yaw=Math.atan2(-dx/h,-dz/h); PL.pitch=-0.13;
  W.__cam.position.set(PL.x, PL.y+PL.EYE, PL.z);
  W.__cam.rotation.set(PL.pitch, PL.yaw, 0, 'YXZ');
});
await shot('1-대장간');

/* ② 대장간 창 — 무기를 여러 개 가진 채로 */
await pg.evaluate(()=>{
  const W=window,G=W.__G; for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  W.__KIT.ownW=[true,true,true,true,true,true,true];
  W.__setEnh(3,3); W.__setEnh(5,5); W.__setEnh(6,6);
  W.__openForge();
});
await shot('2-대장간창');
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ③ U 수치표 */
await pg.evaluate(()=>window.__openInfo());
await shot('3-수치표');
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ④ 랭킹 — 친구 여럿을 pc 통로에 넣어 둔다 */
await pg.evaluate(()=>{
  const W=window,pc=W.__pcMap;
  const nm=['민준','서연','지호','하윤','도윤','예린','시우'];
  nm.forEach((n,i)=> pc.set('u'+i,{n, g:i%5, lv:24-i*3, mined:0, built:0}));
  W.__paintHUD();
});
await shot('4-랭킹');

/* ⑤ 친구가 든 총 — +0 / +3 / +6 을 나란히 세운다 */
await pg.evaluate(()=>{
  const W=window,G=W.__G,PL=W.__PL;
  G.players.clear();
  /* 마을 빈 땅에 서서 바깥쪽을 본다 */
  PL.x=0; PL.z=-16; PL.y=W.__GY; PL.yaw=Math.PI; PL.pitch=-0.02;
  /* ★ 양의 전방은 (-sin yaw, -cos yaw) 다 (늑대·병사와 정반대).
     여기서 늑대 규칙을 쓰면 친구들이 카메라 뒤에 선다 — 실제로 한 번 그랬다. */
  const fwx=-Math.sin(PL.yaw), fwz=-Math.cos(PL.yaw);
  const rx=Math.cos(PL.yaw), rz=-Math.sin(PL.yaw);
  const D=6.0;
  [[5,0,'+0'],[5,3,'+3'],[5,6,'+6']].forEach(([wp,we,lab],i)=>{
    const uid='g'+i, off=(i-1)*3.4;
    const gx=PL.x+fwx*D+rx*off, gz=PL.z+fwz*D+rz*off;
    G.players.set(uid, {uid, x:gx, z:gz, y:W.__GY, ry:PL.yaw+Math.PI/2,   /* 옆으로 세워 총열이 화면을 가로지르게 */ mv:false, down:false,
                        hp:100, hat:0, gls:0, clo:0, g:i, n:'친구'+lab, ph:i*2});
    W.__pcMap.set(uid, {n:'친구'+lab, g:i, lv:20, wp, we, mined:0, built:0});
  });
  W.__cam.position.set(PL.x, PL.y+PL.EYE, PL.z);
  W.__cam.rotation.set(PL.pitch, PL.yaw, 0, 'YXZ');
});
await pg.waitForTimeout(900);
await shot('5-친구총');

/* ⑥ 마지막 밤 안내 */
await pg.evaluate(()=>{ const W=window,G=W.__G; G.day=G.set.goalDay; W.__stage(); });
await pg.waitForTimeout(600);
await shot('6-마지막밤');

console.log(errs.length? '오류: '+errs.slice(0,5).join(' | ') : '오류 없음');
await b.close(); srv.close();
