/* 23차 — 스탯을 넷으로 바꾼 뒤 밸런스가 어디로 갔나 + 가방이 매 프레임 쓰는 값
   ★ 옛 판과 새 판을 같은 자로 같은 판에서 잰다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE = process.argv[2], PORT = +(process.argv[3]||17000), OLD = process.argv[4]==='old';
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1000,height:700}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','측정'); await pg.click('#bSolo'); await pg.waitForTimeout(1400);
console.log(await pg.evaluate((OLD)=>{
  const W=window, X=W.__XP, L=[];
  const maxAll = ()=>{ W.__xpReset();
    for(let i=0;i<W.__STATS.length;i++){ X.pts = 99;
      for(let k=0;k<W.__STATS[i].max;k++) W.__takeStat(i); } X.pts=0; };
  const one = (i, n)=>{ W.__xpReset(); X.pts = 99;
    for(let k=0;k<n;k++) W.__takeStat(i); X.pts=0; };
  L.push('── 아무것도 안 찍었을 때 ──');
  W.__xpReset();
  L.push('  캐는 시간 ' + W.__mineTime().toFixed(3) + '초 · 캐는 양 +' + W.__mineBonus()
       + ' · 짓기 ×' + (W.__workMul?W.__workMul():W.__workSec('swall')/W.__workSec('swall')).toFixed(3) + ' · 공격 ×' + W.__atkMul().toFixed(2)
       + ' · 체력 ' + W.__maxHP() + ' · 방어 ' + W.__defNow() + ' · 이동 ×' + W.__spdMul().toFixed(3));
  L.push('── 다 찍었을 때 (상한까지) ──');
  maxAll();
  L.push('  캐는 시간 ' + W.__mineTime().toFixed(3) + '초 · 캐는 양 +' + W.__mineBonus()
       + ' · 짓기 ×' + (W.__workMul?W.__workMul():W.__workSec('swall')/W.__workSec('swall')).toFixed(3) + ' · 공격 ×' + W.__atkMul().toFixed(2)
       + ' · 체력 ' + W.__maxHP() + ' · 방어 ' + W.__defNow() + ' · 이동 ×' + W.__spdMul().toFixed(3));
  L.push('  찍은 칸 ' + X.st.join('/') + ' (쓴 점수 ' + X.st.reduce((a,c)=>a+c,0)
       + ' · 레벨 ' + W.__LV_MAX + '이면 점수 ' + W.__LV_MAX + '개)');
  if(!OLD){
    const S = W.__ST();
    L.push('── 한 갈래만 끝까지 찍었을 때 ──');
    for(const [k,nm] of [[S.str,'힘'],[S.vit,'체력'],[S.agi,'민첩'],[S.int,'지능']]){
      one(k, W.__STATS[k].max);
      L.push('  ' + nm.padEnd(3,'　') + ' 캐기 ' + W.__mineTime().toFixed(3) + '초'
        + ' · 캐는양 +' + W.__mineBonus() + ' · 짓기 ×' + (W.__workMul?W.__workMul():1).toFixed(2)
        + ' · 공격 ×' + W.__atkMul().toFixed(2) + ' · 체력 ' + W.__maxHP()
        + ' · 방어 ' + W.__defNow() + ' · 이동 ×' + W.__spdMul().toFixed(3)
        + ' (초속 ' + (5.4*W.__spdMul()).toFixed(2) + ')');
    }
    L.push('  날쌘늑대 초속 ' + W.__WOLF_T.find(x=>/날쌘/.test(x.n)).spd
         + ' — 민첩을 다 찍은 양보다 ' + (W.__WOLF_T.find(x=>/날쌘/.test(x.n)).spd
            < 5.4*(1+0.015*W.__STATS[S.agi].max) ? '느리다 (못 쫓는다)' : '빠르다 (쫓는다)'));
    /* 가방이 매 프레임 더 쓰는 값 — pvwSpin 하나뿐이다 */
    W.__openKit();
    const bench=(n,f)=>{ for(let i=0;i<5;i++) f(); const t=performance.now();
      for(let i=0;i<n;i++) f(); return (performance.now()-t)/n; };
    const P = W.__kitPvw && W.__kitPvw();
    L.push('── 가방을 열어 둔 동안 한 프레임에 더 드는 값 ──');
    L.push('  미리보기 돌리기 ' + (P ? bench(200, ()=>W.__pvwSpin(P, 1/60)).toFixed(3) : '?') + ' ms/프레임'
         + '  (예산 16.7ms · 가방을 닫으면 0)');
    document.getElementById('popKit').classList.remove('on');
  }
  return L.join('\n');
}, OLD));
console.log(errs.length?('오류: '+errs.join(' | ')):'(오류 없음)');
await b.close(); srv.close();
