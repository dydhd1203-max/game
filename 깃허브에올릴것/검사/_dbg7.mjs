import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=19930; const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:600,height:400}});
pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','a'); await pg.click('#bSolo'); await pg.waitForTimeout(1000);
await pg.evaluate(()=>{
  const W=window, st=document.createElement('style');
  st.textContent='#topLeft,#topRight,#topMid,#dock,#hint,#stageTitle,#crosshair,#shopTip,#forgeTip,#misWrap,#combo,#aimBadge,#feed,#rankWrap,#downVeil,#toast{display:none!important}';
  document.head.appendChild(st);
  W.__G.phase='day'; W.__G.started=false; W.__held.visible=false;
  for(let i=0;i<5;i++) W.__base[i]={w:999999,s:999999,o:999999}; W.__recompute();
  W.__G.me.g=0; W.__syncMyPC();
  for(const t of ['wwall','swall','arrow','ice','barr']){
    W.__clear();
    const sz=W.__BUILD[t].size, gap = sz>=3?8:sz===2?6:4;
    let z0=null;
    for(let z=14; z<=30 && z0===null; z++)
      if(W.__canPlace(t,-gap,z)===null && W.__canPlace(t,gap,z)===null) z0=z;
    const mk=(x,lv)=>{ W.__place(t,x,z0); const s2=[...W.__STRU.values()].pop();
      s2.lv=lv; s2.mx=W.__bs(t,'hp',lv); s2.hp=s2.mx; return s2; };
    mk(-gap,6); mk(gap,7); W.__rebuild(); W.__G.__z0=z0; W.__G.__gap=gap;
  }
});
const shot=async(nm,dx)=>{
  const f=(dx)=>{ const W=window,c=W.__cam, g=W.__G.__gap, z0=W.__G.__z0;
    c.fov=55; c.updateProjectionMatrix();
    c.position.set(dx*g, W.__GY+4.0, z0+10);
    c.rotation.set(-0.14,0,0,'YXZ'); c.updateMatrixWorld(true); W.__render&&W.__render(); };
  await pg.evaluate(f,dx); await pg.waitForTimeout(200); await pg.evaluate(f,dx);
  await pg.screenshot({path:'/tmp/claude-0/shot20/'+nm+'.png'}); console.log('찍음',nm);
};
await shot('barr-오른쪽Lv7', 1);
await shot('barr-왼쪽Lv6', -1);
await b.close(); srv.close();
