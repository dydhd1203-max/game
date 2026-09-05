/* 늑대가 양 · 건물 · 수정 사이에서 목표를 갈아타나 — 시간에 따라 무엇을 하고 있는지 센다 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1000,height:680}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','ㅅ'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
console.log(await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, L=[], SPD=5.4;
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  const d=W.__DIRS[0];
  /* 입구에 벽과 탑을 세운다 — 곁눈질할 것이 있어야 한다 */
  const build=()=>{ W.__clear(); G.me.g=0;
    for(let pp=-7; pp<=7; pp+=0.5){
      const x=Math.round(d.dx*42-d.dz*pp), z=Math.round(d.dz*42+d.dx*pp);
      if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs('swall','hp',4); o.hp=o.mx; } }
    for(const [t,rr,pp] of [['arrow',36,-4],['arrow',36,4],['ice',33,0],['barr',30,-3]]){
      const x=Math.round(d.dx*rr-d.dz*pp), z=Math.round(d.dz*rr+d.dx*pp);
      if(W.__canPlace(t,x,z)===null){ W.__place(t,x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs(t,'hp',4); o.hp=o.mx; } }
    W.__rebuild(); };

  const run=(day, where)=>{
    build();
    G.day=day; G.crystal=G.set.crystalMax*20; W.__goNight();
    G.wolves.length=0; W.__spawnQ().length=0;
    for(let i=0;i<12;i++){ const w=W.__spawnWolf(0,0);
      const r=30+(i%6)*1.2, off=((i/6|0)-0.5)*3;
      w.x=d.dx*r-d.dz*off; w.z=d.dz*r+d.dx*off;
      w.y=W.__solidTop(Math.floor(w.x),Math.floor(w.z)); }
    /* 아이는 방어선 근처(where=문앞) 또는 마당 안쪽(where=마당)에서 계속 돈다 */
    const R = 5, cr = where==='문앞' ? 38 : 22;
    const cx=d.dx*cr, cz=d.dz*cr;
    PL.hp=99999; PL.down=false;
    let a=0, tick=0, chase=0, struHits=0, cryLoss=0, bites=0;
    const c0=G.crystal;
    const hp0=new Map(); for(const o of W.__STRU.values()) hp0.set(o.id,o.hp);
    for(let i=0;i<1800;i++){                    // 60초
      const dt=1/30; a += SPD*dt/R;
      PL.x=cx+Math.cos(a)*R; PL.z=cz+Math.sin(a)*R;
      PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z));
      const h0=PL.hp;
      W.__step(1, dt); W.__sheepHurt(dt);
      if(PL.hp<h0){ bites++; PL.hp=99999; }
      let n=0; for(const w of G.wolves) if(w.shT) n++;
      chase+=n; tick++;
    }
    let dmg=0, gone=0;
    for(const [id,h] of hp0){ const o=W.__STRU.get(id);
      if(!o) { gone++; dmg+=h; } else dmg += Math.max(0, h-o.hp); }
    return {chase:(chase/tick).toFixed(1), bites, cry:Math.round(c0-G.crystal),
            dmg:Math.round(dmg), gone};
  };
  for(const where of ['문앞','마당']){
    for(const day of [4, 12]){
      const r = run(day, where);
      L.push(`${day}일차 · 아이가 ${where}에서 계속 도는 60초 · 늑대 12마리`);
      L.push(`   나를 쫓는 늑대 평균 ${r.chase}마리 · 물린 ${r.bites}번`
        + ` · 건물에 준 피해 ${r.dmg} (부순 것 ${r.gone}채) · 수정 -${r.cry}`);
    }
  }
  return L.join('\n');
}));
console.log(errs.length?'⚠ '+errs.slice(0,3).join(' | '):'오류 없음');
await b.close(); srv.close();
