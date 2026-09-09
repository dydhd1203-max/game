/* 18차h 화면 확인 — OX 문제 현수막 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19998), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2200);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
const shot = async (nm, f)=>{ await pg.evaluate(f); await pg.waitForTimeout(900);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm); };
/* 퀴즈를 열고 문제를 낸다 */
await shot('quiz-banner', ()=>{
  const W=window, G=W.__G, M=W.__MINI();
  W.__goMini(0); W.__step((M.INTRO+1)*30, 1/30);
  document.getElementById('tQ').value = '늑대는 밤에만 나타난다';
  document.getElementById('tQO').click();
  W.__PL.x = -M.OX; W.__PL.z = M.OZ; W.__miniTick(0.05);
  G.paused = true; W.__paintMini();
});
/* 긴 문제도 잘 들어가나 */
await shot('quiz-banner-long', ()=>{
  const W=window, G=W.__G;
  G.mini.q = '양은 풀을 먹고, 늑대는 양을 잡아먹는다. 그럼 늑대도 풀을 먹을까?';
  W.__hudPrev().qbQ = null; W.__paintMini();
});
/* 정답 공개 */
await shot('quiz-banner-ans', ()=>{
  const W=window, G=W.__G;
  G.paused = false; W.__oxReveal(); G.paused = true; W.__paintMini();
});
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
