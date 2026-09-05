import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE=process.argv[2]||GAME, PORT=+(process.argv[3]||8995);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/`, {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1200);
console.log(await pg.evaluate(()=>{
  const out=[], hud=document.getElementById('hud');
  const G=window.__G; G.started=false;         // 게임 루프 멈추고 우리가 직접 부른다
  window.__paintHUD();                          // 첫 칠은 당연히 쓴다
  let n=0; const mo=new MutationObserver(rs=>{ n+=rs.length; });
  mo.observe(hud,{subtree:true,childList:true,characterData:true,attributes:true});
  for(let i=0;i<100;i++) window.__paintHUD();
  return new Promise(r=> setTimeout(()=>{ mo.disconnect();
    out.push('값이 그대로일 때 100번 칠하기 → DOM 변경 '+n+'건');
    // 값이 바뀌면 제대로 쓰는지
    let m=0; const mo2=new MutationObserver(rs=>{ m+=rs.length; });
    mo2.observe(hud,{subtree:true,childList:true,characterData:true,attributes:true});
    G.crystal -= 7; window.__PL.hp = 61; G.t -= 33; window.__paintHUD();
    setTimeout(()=>{ mo2.disconnect();
      out.push('수정·체력·시간이 바뀌면 → DOM 변경 '+m+'건');
      out.push('시간 표시 = '+document.getElementById('tSec').textContent);
      out.push('체력 표시 = '+document.getElementById('hpNum').textContent);
      r(out.join('\n')); }, 60);
  }, 80));
}));
console.log(errs.length?errs.slice(0,3).join('\n'):'(오류 없음)');
await b.close(); srv.close();
