/* 22차 화면 확인 — 🎖️ 칭호: 머리 위 이름표 · 받는 순간 · 칭호 칸 · 이름표 폭 재기
   ★ 이름표는 캔버스 256px 에 그린다. 칭호 그림이 앞에 붙으면 이름이 줄어드는데,
     "좀 작네" 로 넘기지 않고 **글자 크기를 숫자로 재서** 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19995), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1800);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ── ① 머리 위 이름표 — 칭호가 저마다 다른 친구 다섯을 세운다 ── */
await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, GY=W.__GY;
  G.paused = true;
  /* ★ 시선은 (-sin yaw, -cos yaw) 다 — yaw=π 면 +z 쪽을 본다. 부호를 틀리면 뒤통수를 찍는다 */
  PL.yaw = Math.PI; PL.pitch = -0.02;
  /* 칭호가 갈리게 저마다 다른 일을 한 아이들. 값만 주면 칭호는 저절로 계산된다 */
  const rows = [
    ['a',0,'서준',   {mined:1300, lv:22, hits:70}],
    ['b',1,'하윤',   {saved:9, fixed:25, lv:18}],
    ['c',2,'도윤',   {flw:11, farmed:6, lv:12}],
    ['d',3,'서아',   {helped:22, built:30, lv:20}],
    ['e',4,'민준',   {mined:50, lv:6}]
  ];
  for(const [k,g,n,st] of rows){
    G.players.set(k, {uid:k, x:PL.x + (g-2)*2.9, z:PL.z + 7.5, y:GY, ry:0,
                      n, g, hat:0, gls:0, clo:0, mv:false, ph:g*1.7, hp:100, down:false});
    W.__pcMap.set(k, Object.assign({n, g, pet:0}, st));
  }
  W.__updTags();
});
await pg.waitForTimeout(700);
/* '1일차' 큰 글씨가 가운데 이름표를 덮는다 — 아침에만 뜨는 것이라 찍을 때는 치운다 */
await pg.evaluate(()=>{ const t=document.getElementById('stageTitle'); if(t) t.style.display='none';
                        window.__updTags && window.__updTags(); });
await pg.screenshot({path:OUT+'/22-tags.png'}); console.log('찍음 22-tags (머리 위 칭호 다섯)');

/* ── ② 칭호를 받는 순간 ── */
/* ★ 큰 그림(verdict)은 1.5초면 사라진다. 찍기 전에 왔다 갔다 하면 그 사이에 꺼진다 —
   그래서 **찍기 직전 한 번의 evaluate 안에서** 칭호를 하나만 띄우고 바로 찍는다.
   (여러 개를 한꺼번에 주면 줄을 서므로 화면에는 어차피 하나만 뜬다 — 그게 이번 판의 요지다) */
const held = await pg.evaluate(()=>{
  const W=window;
  W.__MY.mined = 1300; W.__MY.saved = 4; W.__MY.farmed = 31;
  W.__syncMyPC(); W.__bgReset();
  for(let i=0;i<200;i++) W.__badgeCheck();      // 줄을 다 흘려보낸다 (하나씩 나온다)
  W.__bgGot().delete(W.__BADGES.findIndex(B=>B.nm==='대농'));
  W.__badgeCheck();                             // 마지막 하나만 지금 띄운다
  const v = document.getElementById('verdict');
  return {h:v.innerHTML, c:v.className};        // 게임이 만든 그대로를 들고 있는다
});
/* ★ 큰 그림은 1.5초면 저절로 꺼진다. 검사기에서 evaluate 한 번 왕복하는 데 그보다 오래 걸려서,
   찍으면 늘 '그림이 없는' 화면이 나왔다(세 판을 그렇게 버렸다).
   게임이 만든 그 markup 을 그대로 다시 붙여 놓고 찍는다 — 만들어 낸 화면이 아니다. */
await pg.evaluate(v=>{
  /* 내용(innerHTML)은 건드리지 않는다 — 다시 넣으면 튀어나오는 애니메이션이 처음으로 되감겨
     또 '그림이 없는' 화면이 된다. 게임이 지운 건 보이기(class)뿐이라 그것만 되살린다. */
  const t = setInterval(()=>{ const e = document.getElementById('verdict');
    if(!e.classList.contains('on')) e.className = v.c; }, 40);
  setTimeout(()=>clearInterval(t), 8000);
}, held);
await pg.waitForTimeout(700);                 // 튀어나오는 애니메이션이 끝나기를 기다린다
/* ★ animations:'disabled' — 애니메이션을 끝난 자리로 고정해서 찍는다.
   안 그러면 튀어나오는 중(opacity 0)에 찍혀 '그림이 없다' 로 보인다. 한 번 속았다. */
await pg.screenshot({path:OUT+'/22-earn.png'});
console.log('찍음 22-earn (받는 순간) — 그 순간 verdict: '
  + await pg.evaluate(()=>{ const v=document.getElementById('verdict');
      return v.className + ' / ' + ((v.querySelector('.vIco')||{}).textContent||'없음'); }));

/* ── ③ 칭호 칸 (스텟 창) ── */
await pg.evaluate(()=>{ window.__openStat(); });
await pg.waitForTimeout(400);
await pg.screenshot({path:OUT+'/22-panel.png'}); console.log('찍음 22-panel (스텟 창 안 칭호 칸)');
/* 좁은 화면에서도 본다 — 교실 크롬북 1366×768 과 태블릿 세로 */
await pg.setViewportSize({width:820, height:600});
await pg.waitForTimeout(400);
await pg.screenshot({path:OUT+'/22-panel-narrow.png'}); console.log('찍음 22-panel-narrow');
await pg.setViewportSize({width:1100, height:760});
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ── ④ 이름표를 자로 잰다 ── */
const tag = await pg.evaluate(()=>{
  const W=window, t = W.__tagPool()[0], out = [];
  const FONT = w => '900 ' + w + 'px -apple-system, "Noto Sans KR", sans-serif';
  for(const [nm, lv, ic] of [['김하늘', 0, ''], ['김하늘', 35, ''], ['김하늘', 35, '😇'],
                             ['김하늘사랑', 35, '🚜'], ['가나다라마바사', 35, '💎']]){
    t.txt = '';                                   // 다시 그리게 비운다
    W.__setTag(t, nm, '#fff', lv, ic);
    /* 실제로 몇 px 로 그렸는지 되짚어 잰다 — setTag 와 같은 규칙으로 */
    const g = t.c.getContext('2d');
    const mark = ic ? ic + ' ' : '', badge = lv ? 'Lv.' + lv + ' ' : '';
    let fs = 34; g.font = FONT(fs);
    while(fs > 15 && g.measureText(mark + badge + nm).width > 238){ fs -= 2; g.font = FONT(fs); }
    out.push({이름:nm, 칭호:ic||'없음', 글자크기:fs,
              폭:Math.round(g.measureText(mark + badge + nm).width)});
  }
  return out;
});
console.log('\n── 이름표 (칸 256px · 글자는 34px 에서 시작해 15px 까지 줄인다) ──');
for(const r of tag) console.log(`  ${String(r.이름).padEnd(9)} ${r.칭호}  ${r.글자크기}px · ${r.폭}px`);
/* ── ⑤ 우리 반 오늘의 기록 — 칸이 일곱으로 늘었다 (한 줄에 몇 개씩 앉나) ── */
await pg.evaluate(()=>{
  const W=window, B=W.__BADGES, t3=B[B.length-1], t1=B.find(x=>x.t===1);
  W.__pcMap.set('r1', {n:'서준', g:1, [t3.k]:t3.need, [t1.k]:t1.need, mined:820, built:24, lv:22});
  W.__pcMap.set('r2', {n:'하윤', g:2, [t1.k]:t1.need, mined:410, built:12, lv:16, saved:2, fixed:9});
  W.__pcMap.set('r3', {n:'도윤', g:3, mined:260, built:8, lv:11, hits:44});
  W.__G.phase = 'win'; W.__G.day = 18;
  W.__paintEndCard();
  document.getElementById('popEnd').classList.add('on');
});
await pg.waitForTimeout(400);
await pg.screenshot({path:OUT+'/22-endcard.png'}); console.log('찍음 22-endcard (우리 반 기록)');
console.log(errs.length?('\n오류: '+errs.slice(0,5).join(' | ')):'\n(오류 없음)');
await b.close(); srv.close();
