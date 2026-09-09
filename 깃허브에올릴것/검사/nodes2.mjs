/* 자원이 어디에 깔리나 — 개수 · 반지름 분포 · 농장 안에 들어갔나
   ★ 무작위라 한 판만 보면 안 된다. 여러 판을 돌려 평균을 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME, PORT = +(process.argv[3]||12200), RUNS = +(process.argv[4]||5);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const all = [];
for(let k=0;k<RUNS;k++){
  const pg = await b.newPage({viewport:{width:800,height:600}});
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(700);
  all.push(await pg.evaluate(()=>{
    const W=window, X=W.__FARM_X(), Z=W.__FARM_Z();
    const o={개수:W.__NODES.length, 반지름:[], 농장안:0, 모둠별:{}, 종류별:{}};
    /* 우리 반너비는 제일 큰 단계로 본다 */
    const RMAX = W.__FARM_R2 ? W.__FARM_R2()[W.__FARM_R2().length-1] : 3.0;
    for(const n of W.__NODES){
      const r = Math.hypot(n.x+0.5, n.z+0.5);
      o.반지름.push(+r.toFixed(1));
      o.모둠별[n.g] = (o.모둠별[n.g]|0)+1;
      o.종류별[n.type] = (o.종류별[n.type]|0)+1;
      for(let g=0; g<5; g++)
        if(Math.hypot(n.x+0.5-X[g], n.z+0.5-Z[g]) < RMAX) { o.농장안++; break; }
    }
    return o;
  }));
  await pg.close();
}
const rs = all.flatMap(a=>a.반지름).sort((x,y)=>x-y);
const q = p => rs[Math.floor(rs.length*p)];
console.log('판 수', RUNS);
console.log('자원 개수(판마다)', all.map(a=>a.개수).join(' '), ' 목표 110');
console.log('농장 안에 놓인 것(판마다)', all.map(a=>a.농장안).join(' '));
console.log('모둠별(첫 판)', JSON.stringify(all[0].모둠별), JSON.stringify(all[0].종류별));
console.log('반지름 — 가장가까움', rs[0], '· 1/4', q(0.25), '· 가운데', q(0.5),
            '· 3/4', q(0.75), '· 가장멈', rs[rs.length-1]);
/* 안쪽 절반(수정 쪽)과 바깥 절반에 몇 개씩 있나 — 넓이로 나눈 절반 */
const R0=rs[0], R1=rs[rs.length-1], Rm=Math.sqrt((R0*R0+R1*R1)/2);
const inner = rs.filter(r=>r<Rm).length;
console.log('넓이로 절반 나눈 경계', Rm.toFixed(1), '칸 — 안쪽', inner, '· 바깥', rs.length-inner,
            '(고르면 반반)');
await b.close(); srv.close();
