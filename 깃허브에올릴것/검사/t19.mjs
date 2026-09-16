/* 17차b 검사 — 수리 연출 (38차: '오늘의 으뜸' 갈래 돌리기 절은 순위판을 레벨만 남기면서 뺐다 — 12 → 6)
   ★ 값을 검사에 박지 않는다. 게임에서 읽어 '관계'만 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 11900);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ② 수리 연출 ═══════ */
const fx = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  W.__clear(); G.phase='day'; G.paused=false;
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  G.me.g = 0;
  const d = W.__DIRS[0];
  const x=Math.round(W.__gX(0,30,0)), z=Math.round(W.__gZ(0,30,0));
  W.__place('swall', x, z);
  const st = [...W.__STRU.values()].pop();
  o.기준 = W.__RESCUE_MARK();
  const my = W.__MY;

  /* (1) 살짝 깎인 벽을 고칠 때 — 초록 숫자는 뜨되 '살렸다' 소식은 안 뜬다 */
  st.hp = st.mx*0.90;
  let f0=my.fixed, r0=my.rescue, n0=W.__feedLen();
  const dn0 = W.__dnLive();
  W.__repair(st);
  o.가벼운수리 = {고침:my.fixed-f0, 살림:my.rescue-r0,
                 뜬숫자:W.__dnLive()-dn0, 소식:W.__feedLen()-n0};

  /* (2) 부서지기 직전인 벽을 고칠 때 — '살렸다' 로 친다 */
  st.hp = st.mx*0.05;
  f0=my.fixed; r0=my.rescue; n0=W.__feedLen();
  const dn1 = W.__dnLive();
  W.__repair(st);
  o.살린수리 = {고침:my.fixed-f0, 살림:my.rescue-r0,
                뜬숫자:W.__dnLive()-dn1, 소식:W.__feedLen()-n0};

  /* (3) 초록 +숫자인가 (늑대 맞을 때의 빨간 숫자와 달라야 한다) */
  o.숫자모양 = W.__dnLast();
  /* (4) 살린 횟수가 친구들에게 가는 칸에 실리나 */
  W.__syncMyPC();
  o.통신칸 = W.__myPC().rsc;
  W.__clear();
  return o;
});
ok('살짝 깎인 벽을 고치면 초록 숫자가 뜬다',
   fx.가벼운수리.고침===1 && fx.가벼운수리.뜬숫자>0,
   JSON.stringify(fx.가벼운수리));
ok('★ 살짝 깎인 것을 고친 건 "살렸다" 가 아니다 (소식 도배 방지)',
   fx.가벼운수리.살림===0 && fx.가벼운수리.소식===0, JSON.stringify(fx.가벼운수리));
ok('★ 부서지기 직전인 것을 고치면 "살렸다" 로 치고 반에 알린다',
   fx.살린수리.살림===1 && fx.살린수리.소식>0, JSON.stringify(fx.살린수리));
ok('★ 뜨는 숫자가 초록 +다 (늑대 때릴 때의 빨간 숫자와 구분된다)',
   /heal/.test(fx.숫자모양.cls) && /^\+/.test(fx.숫자모양.txt),
   fx.숫자모양.cls+' "'+fx.숫자모양.txt+'"');
ok('★ 살린 횟수가 친구들 통로(pc)에 실린다', fx.통신칸 >= 1, 'rsc='+fx.통신칸);

/* ═══════ ③ 처음부터 다시 하면 여섯 칸이 다 지워지나 ═══════ */
const rs = await pg.evaluate(()=>{
  const W=window, my=W.__MY;
  for(const k in my) my[k] = 7;
  W.__myReset();
  return {남은값: Object.entries(my).filter(([,v])=>v!==0).map(([k])=>k)};
});
ok('★ 처음부터 다시 하면 여섯 칸이 다 지워진다 (예전엔 둘만 지웠다)',
   rs.남은값.length === 0, rs.남은값.join(',') || '전부 0');

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
