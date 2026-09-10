/* 칭호 문턱을 정하려고 재는 것 (22차)
   — 성실함(0~1)별로 한 사람이 하루에 얼마나 쌓는지 **게임 안의 진짜 상수**로 계산한다.
   lvsim.mjs 와 같은 모형이다 (캐기는 덩어리 수가, 쏘기는 총알이 한계다).
   인자: <파일> <포트> [부지런함 0~1]
   쓰는 법: 문턱 후보를 주면 "며칠에 닿나" 를 같이 찍어 준다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12900);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:900,height:640}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','성실'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);

const out = await pg.evaluate(()=>{
  const W=window, G=W.__G, ND=W.__NODE_DEF;
  const DAY=G.set.daySec, NIGHT=G.set.nightSec, GOAL=G.set.goalDay;
  /* 한 덩이에서 떨어지는 칸 수와 한 번에 주는 양 — 게임 표에서 읽는다 */
  const types = Object.keys(ND);
  const dropsPer = t => Math.floor(ND[t].hits / (ND[t].per||1));
  const amtOf    = t => ND[t].amt + W.__mineBonus();
  /* 나무·돌이 대부분이다. 둘의 평균으로 본다 */
  const mineWood = dropsPer('tree')*amtOf('tree'), mineRock = dropsPer('rock')*amtOf('rock');
  const perBreak = (mineWood + mineRock)/2;              // 한 덩이를 다 캐면 쌓이는 mined
  const perNode  = 8*W.__mineTime() + 2.2;               // 치는 시간 + 옮겨 다니는 시간
  const rows = [];
  for(const EFF of [1, 0.7, 0.45]){
    const cum = {mined:0, built:0, fixed:0, hits:0, helped:0, saved:0, farmed:0, flw:0};
    const byDay = [];
    for(let day=1; day<=GOAL; day++){
      /* ── 캐기 ── 한 모둠 자리에 22덩이가 아침마다 나고 넷이 나눠 쓴다 */
      const nodes = Math.min(22/4, DAY*0.55*EFF/perNode);
      cum.mined += nodes*perBreak;
      /* ── 짓기·강화 ── 캐고 남은 시간 */
      let t = Math.max(0, DAY*EFF - nodes*perNode);
      const sec = day<=3 ? W.__workSec('swall')+2 : day<=7 ? W.__workSec('arrow')+3 : W.__upSec()+2;
      cum.built += Math.floor(t/sec);
      /* ── 수리 ── 밤의 1/4 을 고치는 데 쓴다 */
      const fixes = Math.floor(NIGHT*0.25*EFF/(W.__fixSec()+1.5));
      cum.fixed  += fixes;
      cum.helped += fixes*0.2;                 // 남의 모둠 것을 고칠 때만 센다
      /* ── 쏘기 ── 총알이 한계다 (금 4개 = 24발) */
      const wpn = day<3?0 : day<5?2 : day<8?3 : day<12?4 : 5;
      const Wp = W.__WEAPONS[wpn];
      if(wpn>0){
        const ammo = Math.floor(4*6*EFF), byTime = Math.floor(NIGHT*0.55*EFF/Wp.cd);
        cum.hits += Math.min(ammo/Math.max(1,Wp.ammo), byTime)*0.7;
      } else cum.hits += Math.floor(NIGHT*0.30*EFF/W.__THROW_CD)*0.5;   // 돌 던지기
      /* ── 농장 ── 우리가 차는 건 중반이다. 넷이 나눠 줍는다 */
      cum.farmed += day<4 ? 0 : Math.min(6, day-3)*0.5*EFF;
      /* ── 꽃 ── 모둠 상한이 있어 넷이 나누면 한 사람 몫이 정해져 있다 */
      cum.flw = Math.min(W.__GRD ? (W.__GRD().CAP/4) : 3.5, cum.flw + (day<=4 ? 1.0*EFF : 0));
      /* ── 친구 일으키기 ── 쓰러지는 친구가 있는 밤에만 */
      cum.saved += day<3 ? 0 : 0.6*EFF;
      byDay.push(Object.fromEntries(Object.entries(cum).map(([k,v])=>[k, Math.round(v*10)/10])));
    }
    rows.push({EFF, byDay});
  }
  return {rows, GOAL, perBreak:Math.round(perBreak*10)/10,
          perNode:Math.round(perNode*10)/10, mis:W.__MISSIONS.map(m=>m.k+':'+m.per)};
});
const KEYS = ['mined','built','fixed','hits','helped','saved','farmed','flw'];
console.log('덩이 하나 = mined ' + out.perBreak + ' · 한 덩이에 ' + out.perNode + '초');
console.log('오늘의 임무가 쓰는 하루 한 사람 몫: ' + out.mis.join(' · '));
for(const r of out.rows){
  console.log('\n── 부지런함 ' + r.EFF + ' ──');
  console.log('일차 ' + KEYS.map(k=>k.padStart(7)).join(''));
  for(let d=0; d<r.byDay.length; d++){
    if(![1,2,3,5,7,10,14,18].includes(d+1)) continue;
    console.log(String(d+1).padStart(3) + '  ' + KEYS.map(k=>String(r.byDay[d][k]).padStart(7)).join(''));
  }
}
/* 문턱 후보를 주면 며칠에 닿나 */
const CAND = JSON.parse(process.env.CAND || 'null');
if(CAND){
  console.log('\n── 문턱 후보가 며칠에 닿나 (부지런함 1 / 0.7 / 0.45) ──');
  for(const k of KEYS) for(const need of (CAND[k]||[])){
    const days = out.rows.map(r=>{
      const i = r.byDay.findIndex(d=> d[k] >= need);
      return i<0 ? '못 닿음' : (i+1)+'일';
    });
    console.log((k+' '+need).padEnd(16) + days.join(' / '));
  }
}
console.log(errs.length?('오류: '+errs.slice(0,3).join(' | ')):'(오류 없음)');
await b.close(); srv.close();
