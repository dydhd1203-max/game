import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19200); const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:600}});
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(900);
console.log(await pg.evaluate(()=>{
  const W=window, T3=W.__THREE, gms=W.__gunModels(), N=W.__WEAPONS;
  let s='무기            몸통 가로  세로   길이   (모형 좌표)\n';
  for(let i=1;i<gms.length;i++){
    const g=gms[i]; if(!g) continue;
    const glows=g.children.filter(c=>c.material && c.material.blending===T3.AdditiveBlending);
    const vis=glows.map(c=>c.visible); glows.forEach(c=>c.visible=false);
    const bb=new T3.Box3().setFromObject(g), sz=new T3.Vector3(); bb.getSize(sz);
    glows.forEach((c,j)=>c.visible=vis[j]);
    s+=(N[i].ic+' '+N[i].n).padEnd(16)
      +sz.x.toFixed(3).padStart(7)+sz.y.toFixed(3).padStart(7)+sz.z.toFixed(3).padStart(7)+'\n';
  }
  return s;
}));
await b.close(); srv.close();
