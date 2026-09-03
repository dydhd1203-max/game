import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(10320, '/home/user/game/index.html');
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
for(const [w,h,t] of [[1366,768,1],[1024,768,1],[1024,640,1],[1024,640,0],[900,600,1],[900,600,0],[820,500,1],[760,420,0]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:!!t,isMobile:!!t});
  const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:10320/',{waitUntil:'load',timeout:60000});
  await pg.waitForFunction('window.__READY===true',{timeout:60000});
  await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
  await pg.waitForTimeout(700);
  const r=await pg.evaluate(()=>{ const W=window; W.__G.phase='night'; W.__G.day=12;
    const bw=W.__spawnWolf(4,0); W.__G.bossId=bw.id; W.__introDone(); W.__paintHUD();
    const g=id=>{const e=document.getElementById(id); if(!e) return null;
      const cs=getComputedStyle(e); if(cs.display==='none') return null;
      const q=e.getBoundingClientRect(); if(q.width<2) return null;
      return [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)];};
    const o={}; for(const id of ['topLeft','resBox','feed','topRight2','miniWrap','dayBox','dock','stick','mbtns','hint'])
      o[id]=g(id);
    return o; });
  console.log(`${w}x${h}${t?' 터치':''}  H=${h}`);
  for(const k in r) if(r[k]) console.log('   '+k.padEnd(10)+r[k].join(','));
  await ctx.close();
}
await b.close(); srv.close();
