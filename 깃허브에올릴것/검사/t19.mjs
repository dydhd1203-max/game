/* 17차b 검사 — 오늘의 으뜸(여러 갈래 순위) · 수리 연출
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
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ① 여러 갈래로 돌아가나 ═══════ */
const rk = await pg.evaluate(()=>{
  const W=window, o={};
  o.갈래 = W.__RANK_CATS.map(c=>c.k);
  /* 가짜 친구 넷을 넣는다 — 저마다 다른 갈래에서 1등이 되도록 */
  const P=[
    {u:'a', n:'가영', g:0, lv:30, mined:10, built:2,  fixed:1,  helped:0, hits:5},
    {u:'b', n:'나온', g:1, lv:12, mined:99, built:1,  fixed:0,  helped:0, hits:1},
    {u:'c', n:'다현', g:2, lv:14, mined:5,  built:44, fixed:2,  helped:1, hits:0},
    {u:'d', n:'라온', g:3, lv:11, mined:3,  built:1,  fixed:77, helped:9, hits:0}
  ];
  for(const p of P) W.__pcMap.set(p.u, p);
  /* 갈래마다 1등이 누구인지 — paintRank 를 직접 부르지 않고 같은 규칙으로 뽑는다 */
  o.으뜸 = {};
  for(const c of W.__RANK_CATS){
    let best=null, bv=-1;
    for(const [,p] of W.__pcMap){ if(!p||!p.n) continue;
      const v=p[c.k]|0; if(v>bv){ bv=v; best=p.n; } }
    o.으뜸[c.k] = best;
  }
  o.서로다른1등 = new Set(Object.values(o.으뜸)).size;
  /* 아직 아무도 안 한 갈래는 목록에서 빠지나 */
  o.지금갈래 = W.__rankCats().map(c=>c.k);
  for(const [,p] of W.__pcMap){ p.fixed=0; p.helped=0; }
  W.__MY.fixed=0; W.__MY.helped=0;
  o.수리0일때 = W.__rankCats().map(c=>c.k);
  return o;
});
/* ★ 처음엔 '갈래가 여섯이다' 로 개수를 박아 뒀는데, 17차d 에 농장 갈래를 더하자
   게임은 멀쩡한데 검사만 빨개졌다. 세어야 할 것은 개수가 아니라
   '쏘기 말고도 잘하는 길이 여러 갈래로 남는가' 다. */
ok('갈래가 여럿이고, 쏘기 말고 캐기·짓기·수리도 들어 있다',
   rk.갈래.length >= 6 && ['lv','mined','built','fixed'].every(k=>rk.갈래.includes(k))
   && new Set(rk.갈래).size === rk.갈래.length, rk.갈래.join(' '));
ok('★ 갈래마다 1등이 갈린다 — 여러 아이가 저마다 으뜸이 된다',
   rk.서로다른1등 >= 4, JSON.stringify(rk.으뜸));
ok('★ 아직 아무도 안 한 갈래는 건너뛴다 (첫날 "수리 으뜸 0" 이 안 뜬다)',
   !rk.수리0일때.includes('fixed') && !rk.수리0일때.includes('helped')
   && rk.수리0일때.includes('lv'),
   '수리·도움이 0일 때 → ' + rk.수리0일때.join(' '));
ok('레벨 갈래는 언제나 남는다', rk.수리0일때[0] === 'lv');

/* 실제로 화면이 돌아가나 — 제목이 바뀌는지 본다 */
const rot = await pg.evaluate(async ()=>{
  const W=window, seen=new Set(), rows=[];
  /* 갈래가 다 살아 있게 값을 채워 둔다 */
  for(const [,p] of W.__pcMap) if(p&&p.n){ p.fixed=3; p.helped=2; p.hits=4; p.mined=7; p.built=5; }
  const T = W.__RANK_SEC;
  for(let i=0; i<7; i++){
    W.__hudPrev().rank = '';                 // 값이 그대로여도 다시 칠하게
    W.__paintRank();
    seen.add(document.getElementById('rankHead').textContent);
    rows.push(document.querySelectorAll('#rankList .rkRow').length);
    await new Promise(r=>setTimeout(r, T*1000 + 120));
  }
  return {제목수:seen.size, 제목:[...seen], 줄수:rows,
          보임:document.getElementById('rankWrap').style.display !== 'none'};
});
ok('★ 시간이 지나면 갈래가 돌아간다', rot.제목수 >= 4, rot.제목.join(' / '));
ok('판이 화면에 떠 있다', rot.보임 && Math.min(...rot.줄수) > 0, '줄 '+rot.줄수.join(','));

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
