/* 강화 단계별로 손에 든 총이 실제로 얼마나 흔들리는지 잰다.
   ★ 정지 화면으로는 떨림을 볼 수 없다 — 여러 프레임의 자리를 모아 폭을 재야 한다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19400); const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:600}});
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(900);
console.log(await pg.evaluate(()=>{
  const W=window, held=W.__held;
  W.__KIT.ownW=[true,true,true,true,true,true,true];
  W.__equipWeapon(5); W.__setAim(true);
  W.__PL.mv = false;                       // 걸음 반동을 빼고 떨림만 본다
  let s='단계   자리 흔들림 폭(칸)   각도 흔들림 폭(도)\n';
  for(const e of [0,3,4,5,6]){
    W.__setEnh(5, e);
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,r0=1e9,r1=-1e9;
    for(let i=0;i<240;i++){                // 4초치
      W.__updHeld(1/60, false, 0);
      x0=Math.min(x0,held.position.x); x1=Math.max(x1,held.position.x);
      y0=Math.min(y0,held.position.y); y1=Math.max(y1,held.position.y);
      r0=Math.min(r0,held.rotation.z);  r1=Math.max(r1,held.rotation.z);
    }
    const dx=x1-x0, dy=y1-y0, dr=(r1-r0)*180/Math.PI;
    s+='  +'+e+'    '+Math.max(dx,dy).toFixed(4).padStart(8)
      +'          '+dr.toFixed(2).padStart(6)+'\n';
  }
  W.__setEnh(5,0); W.__setAim(false);
  return s;
}));
await b.close(); srv.close();
