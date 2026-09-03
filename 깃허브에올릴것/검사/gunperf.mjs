/* 총을 들었을 때 늘어나는 드로우콜 — 상자 하나가 그리기 한 번이다 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(9410, '/home/user/game/index.html');
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1180,height:720}});
await pg.goto('http://127.0.0.1:9410/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ const W=window;
  for(let i=0;i<5;i++) W.__base[i]={w:9000,s:9000,o:9000}; W.__recompute();
  for(let i=1;i<=6;i++) W.__buyWeapon(i); W.__buyAmmo(30); });
const names=['맨손','새총','화승총','소총','연발총','저격총','광선총'];
console.log(await pg.evaluate((names)=>{
  const W=window, R=W.__R, out=[];
  W.__setAim(false, true); W.__selTool('mine');
  const measure = ()=>{ R.info.reset(); W.__render(); return R.info.render.calls; };
  // updHeld 를 직접 돌려 손에 든 것을 확정한다
  W.__updHeld(0.016, false, 0);
  const base = measure();
  out.push('곡괭이를 들었을 때  드로우콜 ' + base);
  W.__setAim(true, true);
  for(let i=0;i<=6;i++){
    W.__equipW(i); W.__updHeld(0.016, false, 0);
    out.push((names[i]+'        ').slice(0,7) + ' 드로우콜 ' + measure() + '  (곡괭이 대비 ' +
      (measure()-base >= 0 ? '+' : '') + (measure()-base) + ')');
  }
  return out.join('\n');
}, names));
await b.close(); srv.close();
