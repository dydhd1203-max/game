/* (1) 도망치는 양을 늑대가 따라잡나  (2) 계속 돌면 늑대가 밤을 잊나 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1000,height:680}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','ㄷ'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
console.log(await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, L=[], SPD=5.4;
  const d=W.__DIRS[0];
  /* ① 정면으로 도망칠 때 따라잡히는 데 걸리는 시간 */
  /* ★ 수정에서 멀리 떨어진 곳에서 재야 한다.
     예전엔 수정 쪽으로 달리게 했는데, 이제 늑대는 수정이 코앞이면 양을 놓고 수정으로 간다
     (그게 이번에 넣은 동작이다). 그러면 '못 따라잡았다'가 아니라 '안 쫓았다'가 나온다.
     그래서 수정에서 30칸 떨어진 큰 원을 따라 달리게 한다 — 거의 직선이고 수정은 늘 멀다. */
  /* ★ 나무·바위는 늑대를 막는다(solidTop). 달리는 길에 그게 있으면 '못 따라잡았다'가 아니라
     '길이 막혔다'를 재게 된다 — 실제로 그렇게 나왔다. 이 검사에서는 치워 놓고 잰다. */
  for(const n of W.__NODES) if(n.alive){ n.alive=false; for(const h of n.hs) W.__bset(h,false); n.shown=0; }
  L.push('① 늑대 한 마리한테서 똑바로 도망칠 때 (4칸 앞섬 · 최고 속도 · 평평한 빈 들판, 수정에서 멀리)');
  for(const [day,k,nm] of [[1,0,'1일차 늑대'],[8,0,'8일차 늑대'],[14,0,'14일차 늑대'],[8,1,'8일차 날쌘늑대']]){
    G.day=day; G.crystal=G.set.crystalMax; W.__goNight();
    G.wolves.length=0; W.__spawnQ().length=0;
    const w=W.__spawnWolf(k,0);
    /* ★ 평평한 원을 골라 쓴다. 언덕 위로 올라가면 늑대가 닿을 수 없어(높이차 2.2) 쫓기를 그만두는데,
       그건 '못 따라잡았다'가 아니라 '쫓을 수 없었다'다 — 실제로 그렇게 나왔다. */
    let RR = 0;
    for(let r=26; r>=16 && !RR; r-=1){
      let flat = true;
      for(let a2=0; a2<Math.PI*2; a2+=0.05){
        if(W.__solidTop(Math.floor(Math.cos(a2)*r), Math.floor(Math.sin(a2)*r)) !== W.__GY){ flat=false; break; } }
      if(flat) RR = r;
    }
    if(!RR){ L.push('   (평평한 원을 못 찾음 — 이 판은 건너뜀)'); continue; }
    const at=(ang)=>[Math.cos(ang)*RR, Math.sin(ang)*RR];
    let ang=Math.atan2(d.dz,d.dx);
    let p0=at(ang); PL.x=p0[0]; PL.z=p0[1];
    PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z)); PL.hp=99999; PL.down=false;
    const p1=at(ang-4/RR); w.x=p1[0]; w.z=p1[1];      // 4칸 뒤에서 출발
    w.y=W.__solidTop(Math.floor(w.x),Math.floor(w.z));
    let t=0, caught=-1;
    for(let i=0;i<900;i++){                            // 30초
      const dt=1/30; t+=dt;
      ang += SPD*dt/RR;
      const p=at(ang); PL.x=p[0]; PL.z=p[1];
      PL.y=W.__solidTop(Math.floor(PL.x), Math.floor(PL.z));
      W.__step(1, dt);
      if(Math.hypot(w.x-PL.x, w.z-PL.z) < 1.5){ caught=t; break; }
    }
    L.push('   '+nm.padEnd(14,' ')+(caught<0 ? '30초 안에 못 따라잡음 ✗'
      : `${caught.toFixed(1)}초 만에 따라잡음`));
  }
  /* ② 입구 근처에서 계속 뱅뱅 돌 때 — 늑대가 수정을 잊나 */
  L.push('');
  L.push('② 입구 앞에서 반지름 5칸으로 계속 도는 아이 하나 · 늑대 14마리 · 60초');
  for(const day of [1, 8, 14]){
    const out=[];
    for(const flee of [true,false]){
      G.day=day; G.crystal=G.set.crystalMax*8; W.__goNight();
      G.wolves.length=0; W.__spawnQ().length=0;
      for(let i=0;i<14;i++){ const w=W.__spawnWolf(0,0);
        const r=30+(i%7)*1.2, off=((i/7|0)-0.5)*3;
        w.x=d.dx*r-d.dz*off; w.z=d.dz*r+d.dx*off;
        w.y=W.__solidTop(Math.floor(w.x),Math.floor(w.z)); }
      const cx=d.dx*33, cz=d.dz*33, R=5;
      PL.hp=99999; PL.down=false;
      let a=0, chase=0, tick=0, bites=0, c0=G.crystal;
      for(let i=0;i<1800;i++){
        const dt=1/30;
        if(flee){ a += SPD*dt/R; PL.x=cx+Math.cos(a)*R; PL.z=cz+Math.sin(a)*R; }
        else { PL.x=cx; PL.z=cz; }
        PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z));
        const hp0=PL.hp;
        W.__step(1, dt); W.__sheepHurt(dt);
        if(PL.hp<hp0){ bites++; PL.hp=99999; }
        let n=0; for(const w of G.wolves) if(w.shT) n++;
        chase+=n; tick++;
      }
      out.push({chase:(chase/tick).toFixed(1), bites, cry:Math.round(c0-G.crystal)});
    }
    L.push(`   ${day}일차 도망침 : 평균 ${out[0].chase}마리가 쫓음 · 물린 ${out[0].bites}번`
      + ` · 그동안 수정 -${out[0].cry}`);
    L.push(`   ${day}일차 가만히 : 평균 ${out[1].chase}마리가 쫓음 · 물린 ${out[1].bites}번`
      + ` · 그동안 수정 -${out[1].cry}`);
  }
  return L.join('\n');
}));
console.log(errs.length?'⚠ '+errs.slice(0,3).join(' | '):'오류 없음');
await b.close(); srv.close();
