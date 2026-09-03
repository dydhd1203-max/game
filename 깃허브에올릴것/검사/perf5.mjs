import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1180,height:720}});
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(1000);
console.log(await pg.evaluate(()=>{
  const W=window, R=W.__R, GY=W.__GY, G=W.__G, out=[];
  G.started=false; G.phase='day'; G.wolves.length=0;
  // 반 전체가 지은 상태를 흉내낸다 — 다섯 문 전부 Lv4 방어선
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
  out.push('건물 '+W.__STRU.size+'채를 지어 놓고 잰 값');
  const shot=(name,px,py,pz,tx,ty,tz)=>{ W.__cam.position.set(px,py,pz); W.__cam.lookAt(tx,ty,tz);
    R.info.reset(); W.__render();
    out.push(name.padEnd(24)+' 드로우콜 '+String(R.info.render.calls).padStart(3)
      +' · 삼각형 '+String(R.info.render.triangles).padStart(6)); };
  const d0=W.__DIRS[0];
  shot('우리 문 앞에서 밖을 봄', d0.dx*30, GY+1.12, d0.dz*30, d0.dx*50, GY+2, d0.dz*50);
  shot('우리 문 앞에서 마을 쪽', d0.dx*30, GY+1.12, d0.dz*30, 0, GY+2, 0);
  shot('수정 옆', 0, GY+1.12, 6, 20, GY+1, 14);
  return out.join('\n');
}));
await b.close(); srv.close();
