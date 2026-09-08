/* 17차f 화면 확인 — 전직한 양 (길 3 × 단계 3) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19960), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:820}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(3000);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast,#aimInfo{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; if(W.__scene.fog){ W.__scene.fog.near=300; W.__scene.fog.far=500; }
  if(W.__held&&W.__held.parent) W.__held.parent.remove(W.__held);
});
/* 세 마리를 나란히 세운다 — 같은 길의 0차·1차·2차 */
const row = async (nm, jb)=>{
  await pg.evaluate((jb)=>{
    const W=window, G=W.__G;
    for(const k of ['a','b','c']) { G.players.delete(k); W.__pcMap.delete(k); }
    /* 카메라가 보는 쪽을 -z 로 못 박는다 — 안 그러면 양들이 등 뒤에 선다 */
    W.__PL.yaw = 0;
    const cx=W.__PL.x, cz=W.__PL.z;
    [0,1,2].forEach((jt,i)=>{
      const k=['a','b','c'][i];
      const P={uid:k, n:'', g:0, x:cx+(i-1)*1.9, z:cz-3.6, y:W.__GY, ry:Math.PI, mv:0, ph:i*2,
               hat:0, gls:0, clo:0, jb:jb, jt:jt};
      G.players.set(k,P); W.__pcMap.set(k,{u:k,n:'',g:0,jb:jb,jt:jt});
    });
    W.__PL.pitch=-0.02;
  }, jb);
  await pg.waitForTimeout(420);
  await pg.evaluate(()=>{ window.__render && window.__render(); });
  await pg.screenshot({path:OUT+'/'+nm+'.png'});
  console.log('찍음', nm);
};
await row('job-1전투양', 0);
await row('job-2건축가양', 1);
await row('job-3일꾼양', 2);
console.log(errs.length? '오류: '+errs.slice(0,4).join(' | ') : '오류 없음');
await b.close(); srv.close();
