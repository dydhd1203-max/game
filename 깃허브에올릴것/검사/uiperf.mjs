import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1280,height:720}});
await pg.goto(`http://127.0.0.1:${PORT}/`, {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1500);
// 화면 그리기는 빼고 '브라우저가 HUD 를 배치·칠하는 시간'만 잰다.
console.log(await pg.evaluate(async ()=>{
  const hud=document.getElementById('hud');
  const meas = async (label)=>{
    // 값이 매 번 바뀌게 해서 최악의 경우를 잰다
    const G=window.__G; let t0, best=[];
    for(let r=0;r<7;r++){
      await new Promise(rr=>requestAnimationFrame(rr));
      t0=performance.now();
      for(let i=0;i<60;i++){ G.crystal = 120 + (i%40); window.__PL.hp = 40+(i%50);
        G.t = 90 - i*0.7; window.__paintHUD();
        void document.body.offsetHeight;      // 배치·칠하기를 강제로 끝까지 시킨다
      }
      best.push(performance.now()-t0);
    }
    best.sort((a,b)=>a-b);
    return label+' '+(best[3]/60).toFixed(3)+' ms/프레임';
  };
  const on = await meas('HUD 켬');
  hud.style.display='none';
  const off = await meas('HUD 끔');
  hud.style.display='';
  return on+'\n'+off;
}));
await b.close(); srv.close();
