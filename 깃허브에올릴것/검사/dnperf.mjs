import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 9150);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1180,height:720}});
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(1000);
console.log(await pg.evaluate(()=>{
  const W=window, PL=W.__PL;
  const run = (n)=>{
    for(const s of W.__dnums()) s.t = 0;
    for(let i=0;i<n;i++) W.__popDmg(PL.x + (i%5)-2, PL.y+1.4, PL.z - 3, 100+i, i%3===0?1:0);
    const t0 = performance.now();
    for(let k=0;k<600;k++) W.__dnTick(0.0001);        // 거의 안 사라지게
    return ((performance.now()-t0)/600).toFixed(4);
  };
  return '숫자 0개 ' + run(0) + ' ms/프레임\n숫자 18개(가득) ' + run(18) + ' ms/프레임';
}));
await b.close(); srv.close();
