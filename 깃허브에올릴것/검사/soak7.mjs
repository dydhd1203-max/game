/* 실제로 몇 밤을 돌려 본다 — 상점·물약·총·숫자·체력바가 다 켜진 채로 오류가 없는지 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 9160);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1200);
const res = await pg.evaluate(async ()=>{
  const W=window, G=W.__G, PL=W.__PL, log=[];
  for(let i=0;i<5;i++) W.__base[i]={w:900,s:900,o:400};
  W.__recompute();
  W.__buyWeapon(4); W.__buyArmor(3); W.__buyAmmo(30);
  for(let p=0;p<4;p++){ W.__buyPotion(p); W.__buyPotion(p); }
  /* 다섯 문에 방어선 */
  W.__clear();
  for(let g=0; g<5; g++){ const d=W.__DIRS[g]; G.me.g=g;
    for(let pp=-7; pp<=7; pp+=0.5){
      const x=Math.round(d.dx*42-d.dz*pp), z=Math.round(d.dz*42+d.dx*pp);
      if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs('swall','hp',4); o.hp=o.mx; } }
    for(const [t,rr,pp] of [['arrow',36,-4],['arrow',36,4],['ice',33,0],['barr',24,-3]]){
      const x=Math.round(d.dx*rr-d.dz*pp), z=Math.round(d.dz*rr+d.dx*pp);
      if(W.__canPlace(t,x,z)===null){ W.__place(t,x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs(t,'hp',4); o.hp=o.mx; } } }
  G.me.g=0; W.__rebuild();
  for(const day of [4, 9]){
    G.day=day; G.crystal=G.set.crystalMax;
    W.__goNight();
    const d0=W.__DIRS[0];
    PL.x=d0.dx*40; PL.z=d0.dz*40; PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z));
    PL.hp=100; PL.down=false;
    let shots=0;
    for(let i=0;i<2000 && G.phase==='night';i++){
      W.__step(1, 1/20);
      /* 쏘고 물약도 먹어 본다 */
      if(i%20===0){ PL.yaw = Math.atan2(-(0-PL.x), -(0-PL.z)); W.__updPlayer(0.001);
        W.__setThrowCd(0); W.__throw(); shots++; }
      if(i%400===0) W.__usePotion(i/400 % 4 | 0);
      W.__dnTick(0.05);
      W.__drawWolfHP();
    }
    log.push(`${day}일차 밤 — 수정 ${Math.round(G.crystal)}/200 · 내가 ${shots}발 · 남은 총알 ${W.__KIT.ammo} · 체력 ${Math.round(PL.hp)}${PL.down?' (쓰러짐)':''}`);
  }
  return log;
});
console.log(res.join('\n'));
console.log(errs.length ? '오류: '+errs.slice(0,6).join(' | ') : '(오류 없음)');
await b.close(); srv.close();
