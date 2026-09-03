/* 밤에 늑대가 많을 때의 드로우콜 — 체력 막대가 실제로 얼마를 더 쓰나 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(+process.argv[3], process.argv[2]);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1180,height:720}});
await pg.goto('http://127.0.0.1:'+process.argv[3]+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(1000);
console.log(await pg.evaluate(()=>{
  const W=window, R=W.__R, G=W.__G, out=[];
  G.started=false; G.phase='night'; G.day=12; G.wolves.length=0;
  W.__clear();
  for(let g=0; g<5; g++){ const d=W.__DIRS[g]; G.me.g=g; G.res[g]={w:999999,s:999999,g:999999};
    for(let pp=-8; pp<=8; pp+=0.5){
      const x=Math.round(d.dx*42 - d.dz*pp), z=Math.round(d.dz*42 + d.dx*pp);
      if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs('swall','hp',4); o.hp=o.mx; } }
    for(const [t,rr,pp] of [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],
                            ['arrow',26,0],['arrow',39,0],['ice',33,-5],['ice',33,5],['ice',28,0],
                            ['barr',24,-3],['barr',24,3]]){
      const x=Math.round(d.dx*rr - d.dz*pp), z=Math.round(d.dz*rr + d.dx*pp);
      if(W.__canPlace(t,x,z)===null){ W.__place(t,x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs(t,'hp',4); o.hp=o.mx; } } }
  G.me.g=0; W.__rebuild();
  const d0 = W.__DIRS[0];
  for(let i=0;i<40;i++){ const w = W.__spawnWolf(i%3, 0);
    const r = 30 + (i%8)*1.6, off = ((i/8|0)-2)*2.2;
    w.x = d0.dx*r - d0.dz*off; w.z = d0.dz*r + d0.dx*off;
    w.y = W.__solidTop(Math.floor(w.x), Math.floor(w.z)); w.hp = w.mx*(0.2+0.02*i); }
  const px = d0.dx*44, pz = d0.dz*44;
  W.__PL.x = px; W.__PL.z = pz; W.__PL.y = W.__solidTop(Math.floor(px),Math.floor(pz)) + 6;
  const shot = (label, bars)=>{
    W.__cam.position.set(px, W.__PL.y+1.2, pz); W.__cam.lookAt(0, 2, 0);
    W.__drawWolves && W.__drawWolves(G.wolves, 0, 0.016);
    if(bars) W.__drawWolfHP(); else { const [a,c]=W.__HB(); a.visible=c.visible=false; }
    R.info.reset(); W.__render();
    out.push(label.padEnd(26)+' 드로우콜 '+String(R.info.render.calls).padStart(3));
  };
  shot('늑대 40마리 · 막대 끔', false);
  shot('늑대 40마리 · 막대 켬', true);
  return out.join('\n');
}));
await b.close(); srv.close();
