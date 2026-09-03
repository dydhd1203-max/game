/* 성실한 아이 한 명이 15일 동안 몇 레벨까지 가나 — 게임 안의 진짜 상수로 계산한다.
   인자: <파일> <포트> [부지런함 0~1]  (1 = 쉬는 시간 없이, 0.6 = 보통) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const EFF=+(process.argv[4]||1);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:900,height:640}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','성실'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
console.log(await pg.evaluate((EFF)=>{
  const W=window, G=W.__G, X=W.__XP, C=W.__XPC, L=[];
  W.__xpReset();
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  /* 스텟 찍는 순서 — 애들이 흔히 고를 법한 순서(캐기 -> 사격 -> 체력) */
  const PICK=[0,3,0,4,3,0,2,4,3,1];
  let pi=0;
  const spend=()=>{ while(X.pts>0 && pi<PICK.length){ const before=X.pts; W.__takeStat(PICK[pi]);
    if(X.pts===before) pi++; else if(X.st[PICK[pi]]>=W.__STATS[PICK[pi]].max) pi++; } };
  const DAY=G.set.daySec, NIGHT=G.set.nightSec;
  let totXP=0;
  const gain=(n)=>{ totXP+=n; W.__xpGain(n); spend(); };
  for(let day=1; day<=G.set.goalDay; day++){
    G.day=day;
    const before=X.lv;
    /* ── 낮: 캐기 ──
       ★ 시간이 아니라 '덩어리 수' 가 한계다. 한 모둠 자리에 22덩이가 아침마다 되살아나고
         모둠은 네 명이 나눠 쓴다 → 한 사람 몫 5.5덩이 × 4칸 = 22칸.
         시간이 모자라면 그만큼만 캔다. */
    const perNode = 8*W.__mineTime() + 2.2;          // 치는 시간 + 옮겨 다니는 시간
    const share = 22/4;
    const nodes = Math.min(share, DAY*0.55*EFF/perNode);
    gain(nodes*4*C.mine);
    /* ── 낮: 짓기·강화 ── 캐고 남은 시간 */
    let t = Math.max(0, DAY*EFF - nodes*perNode);
    if(day<=3){ const n=Math.floor(t/(W.__workSec('swall')+2)); gain(n*C.build.swall); }
    else if(day<=7){ const n=Math.floor(t/(W.__workSec('arrow')+3)); gain(n*C.build.arrow); }
    else { const n=Math.floor(t/(W.__upSec()+2)); gain(n*C.up*Math.min(6, 2+((day-7)/2|0))); }
    /* ── 밤: 사격 ──
       ★ 총알은 금으로 산다. 모둠이 하루에 얻는 금(덩이 4개×4칸×2 + 보상)을 넷이 나누면
         한 사람 8개 남짓이고, 총·갑옷·물약도 사야 하니 절반쯤을 총알로 본다.
         그래서 밤에 쏘는 횟수는 시간이 아니라 총알이 정한다. */
    const wpn = day<3?0 : day<5?2 : day<8?3 : day<12?4 : 5;
    const Wp = W.__WEAPONS[wpn];
    if(wpn>0){
      const ammo = Math.floor(4*6*EFF);                 // 금 4개 = 24발
      const byTime = Math.floor(NIGHT*0.55*EFF/Wp.cd);
      const shots = Math.min(ammo/Math.max(1,Wp.ammo), byTime);
      const hit = 0.7;
      const dmg = Wp.dmg*(1+0.14*(day-1))*W.__atkMul();
      gain(shots*hit*dmg*C.dmg + shots*hit*0.10*C.kill);
    }
    const fixes = Math.floor(NIGHT*0.25*EFF/(W.__fixSec()+1.5));
    gain(fixes*C.fix);
    L.push(`${String(day).padStart(2)}일차 끝 — 레벨 ${X.lv}`
      + (X.lv<W.__LV_MAX ? ` (다음까지 ${Math.ceil(W.__XP_NEED[X.lv]-X.xp)})` : ' 🏆 만렙')
      + `  · 누적 경험치 ${Math.round(totXP)}`
      + (X.lv>before ? `  ⭐ +${X.lv-before}` : ''));
  }
  L.push('');
  L.push('찍은 스텟 ' + W.__STATS.map((S,i)=>S.ic+X.st[i]).join(' ') + ` · 남은점수 ${X.pts}`);
  L.push(`최대체력 ${W.__maxHP()} · 캐는시간 ${W.__mineTime().toFixed(3)}s`
    + ` · 공격배수 ${W.__atkMul().toFixed(2)} · 방어 +${W.__defNow()}`);
  return L.join('\n');
}, EFF));
console.log(errs.length?'⚠ '+errs.slice(0,3).join(' | '):'오류 없음');
await b.close(); srv.close();
