import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||17000); const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:600}});
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(600);
console.log(await pg.evaluate(()=>{
  const W=window,G=W.__G,E=W.__enh,WP=W.__WEAPONS; G.day=14;
  const WDAY=1+0.14*(G.day-1);
  let s='── 14일차 기준 · 강화 단계별 화력과 기대 비용 ──\n';
  s+='무기            +0한방  +6한방  +0초당  +6초당   +6까지 기대재료(나무/돌/금)  기대시도\n';
  for(let i=1;i<WP.length;i++){
    const w=WP[i];
    const d0=Math.round(w.dmg*WDAY), d6=Math.round(w.dmg*WDAY*E.mul[6]);
    // 기대 시도 수 — 실패하면 +4부터 한 단계 내려간다. 마르코프 사슬로 푼다.
    // T[e] = e 에서 6 까지 가는 데 드는 기대 시도 수
    const T=new Array(7).fill(0);
    for(let e=5;e>=0;e--){
      const p=E.odds[e];
      if(e+1<=E.safe) T[e]=(1+p*T[e+1])/p;                 // 실패해도 제자리
      else T[e]=(1 + p*T[e+1] + (1-p)*T[e-1])/1;           // 실패하면 한 칸 뒤 (아래서 다시 푼다)
    }
    // 위 식은 하락 구간이 서로를 참조하므로 반복법으로 수렴시킨다
    const U=new Array(7).fill(0);
    for(let it=0; it<200000; it++){
      for(let e=5;e>=0;e--){
        const p=E.odds[e];
        U[e] = e+1<=E.safe ? (1+p*U[e+1])/p : 1 + p*U[e+1] + (1-p)*U[e-1];
      }
    }
    // 기대 재료 — 각 단계에서 머무는 기대 횟수 × 그 단계 값
    // 단순화: 시도마다 그 단계 값을 낸다. 단계별 방문 횟수를 몬테카를로로 잰다.
    let cw=0,cs=0,cg=0,tries=0; const N=4000;
    for(let k=0;k<N;k++){
      let e=0,n=0;
      while(e<6 && n<100000){
        const c={w:Math.round((w.cost.w||0)*E.cost[e]),s:Math.round((w.cost.s||0)*E.cost[e]),
                 g:Math.max(1,Math.round(((w.cost.g||0)+2)*E.cost[e]))};
        cw+=c.w; cs+=c.s; cg+=c.g; n++;
        if(Math.random()<E.odds[e]) e++; else if(e+1>E.safe && e>0 && Math.random()<E.drop) e--;
      }
      tries+=n;
    }
    s+=(w.ic+' '+w.n).padEnd(15)+String(d0).padStart(6)+String(d6).padStart(8)
      +String(Math.round(d0/w.cd)).padStart(8)+String(Math.round(d6/w.cd)).padStart(8)
      +('   🪵'+Math.round(cw/N)+' 🪨'+Math.round(cs/N)+' ✨'+Math.round(cg/N)).padEnd(28)
      +String((tries/N).toFixed(1)).padStart(6)+'\n';
  }
  s+='\n원래 값: '+WP.slice(1).map(w=>w.ic+' 🪵'+(w.cost.w||0)+' 🪨'+(w.cost.s||0)+' ✨'+(w.cost.g||0)).join('  ');
  return s;
}));
await b.close(); srv.close();
