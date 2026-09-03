/* 6차 패치 검사 — 망루·모둠띠·철거·멈춤·기록·기억 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(8915, '/home/user/game/index.html');
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const ctx = await b.newContext({viewport:{width:1180,height:660}});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
let pass=0, fail=0;
const ok=(c,n,d)=>{ if(c){pass++;console.log('  OK  '+n+(d?'   → '+d:''));} else {fail++;console.log('  ✗   '+n+(d?'   → '+d:''));} };
await pg.goto('http://127.0.0.1:8915/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘');
await pg.evaluate(()=>document.querySelectorAll('#grpPick button')[2].click());   // 3모둠
await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1400);

console.log('\n── 🏯 성문 망루 ──');
for(const r of await pg.evaluate(()=>{
  const W=window, PL=W.__PL, GY=W.__GY, out=[];
  // 다섯 문 · 양쪽 다 걸어서 올라가지나
  let worstH=99, reached=0;
  for(let g=0; g<5; g++){ const d=W.__DIRS[g];
    const WX=(t,p)=>d.dx*t-d.dz*p, WZ=(t,p)=>d.dz*t+d.dx*p;
    for(const side of [-1,1]){
      const pc=8.7*side;
      PL.x=WX(27.0,pc); PL.z=WZ(27.0,pc);
      PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z)); PL.vy=0;
      PL.yaw=Math.atan2(-d.dx,-d.dz); W.__KEY['w']=true;
      let peak=PL.y;
      for(let i=0;i<520;i++){ W.__updPlayer(1/60); if(PL.y>peak) peak=PL.y; }
      W.__KEY['w']=false;
      const h=peak-GY; if(h>=4.5) reached++; if(h<worstH) worstH=h;
    }
  }
  out.push(['걸어서 망루에 올라간다 (열 군데 다)', reached===10, reached+'/10 · 제일 낮은 곳 '+worstH.toFixed(1)]);
  // 통로 안으로 안 들어간다
  let mn=99;
  for(let g=0;g<5;g++){ const d=W.__DIRS[g];
    for(const k of W.__rampCells){ const [x,z]=k.split(',').map(Number);
      const cx=x+0.5, cz=z+0.5, t=cx*d.dx+cz*d.dz;
      if(t<20||t>50) continue;
      const p=Math.abs(-cx*d.dz+cz*d.dx); if(p>20) continue;
      if(p<mn) mn=p; } }
  out.push(['계단이 통로를 안 막는다 (벽에 구멍 안 남)', mn>6.6, '통로중심에서 '+mn.toFixed(2)+'칸 (반너비 6.6)']);
  // 계단 자리엔 못 짓는다
  const k0=[...W.__rampCells][0].split(',').map(Number);
  out.push(['계단 자리엔 건물을 못 놓는다', W.__canPlace('wwall',k0[0],k0[1])==='망루 계단 자리예요', W.__canPlace('wwall',k0[0],k0[1])]);
  // 늑대 길찾기는 그대로 (walkable 은 terrH 만 본다)
  let blocked=0;
  for(const k of W.__rampCells){ const [x,z]=k.split(',').map(Number);
    if(!W.__walkable(x,z)) blocked++; }
  out.push(['계단이 늑대 길을 안 막는다 (bldH 라 길찾기에 안 보임)',
    blocked < W.__rampCells.size, W.__rampCells.size+'칸 중 지형이 높은 곳 '+blocked+'칸']);
  return out;
})) ok(r[1], r[0], r[2]);

console.log('\n── 🐺 높은 데선 안 물린다 ──');
for(const r of await pg.evaluate(()=>{
  const W=window, PL=W.__PL, G=W.__G, GY=W.__GY, out=[];
  G.phase='night'; G.started=true; PL.down=false;
  const mk=(dy)=>{ G.wolves.length=0;
    PL.x=0; PL.z=0; PL.y=GY+dy; PL.hp=100; PL.biteT=0;
    G.wolves.push({id:1,k:0,x:0.4,z:0.4,y:GY,hp:50,mx:50,mv:false,ph:0,hurt:0});
    W.__sheepHurt(0.2); return PL.hp; };
  const ground = mk(0);
  out.push(['땅에 서 있으면 물린다', ground < 100, ground+'/100']);
  const high = mk(5.5);
  out.push(['★ 망루 위(5.5칸)에선 안 물린다', high === 100, high+'/100']);
  const wall = mk(1.4);
  out.push(['내 벽 위(1.4칸)에선 여전히 물린다', wall < 100, wall+'/100']);
  return out;
})) ok(r[1], r[0], r[2]);

console.log('\n── 🚩 다섯 모둠 띠 ──');
for(const r of await pg.evaluate(()=>{
  const W=window, G=W.__G, out=[];
  G.phase='day'; G.wolves.length=0; W.__clear();
  G.me.g=2; G.res[2]={w:9e5,s:9e5,g:9e5};
  const d=W.__DIRS[2];
  for(let i=0;i<4;i++){ const x=Math.round(d.dx*30-d.dz*(i*2-3)), z=Math.round(d.dz*30+d.dx*(i*2-3));
    if(W.__canPlace('wwall',x,z)===null) W.__place('wwall',x,z); }
  W.__paintHUD();
  const cells=[...document.querySelectorAll('#grpBar .gcell')];
  out.push(['모둠 칸이 다섯 개', cells.length===5, cells.length+'개']);
  out.push(['우리 모둠이 표시된다', cells[2].classList.contains('me'), '3모둠에 표시']);
  out.push(['낮엔 지은 채 수가 보인다', /채$/.test(document.getElementById('gV2').textContent),
    document.getElementById('gV2').textContent]);
  // 밤 — 늑대가 몰린 모둠이 빨개진다
  G.phase='night';
  for(let i=0;i<5;i++) W.__spawnWolf(0, 1);
  const d1=W.__DIRS[1];
  G.wolves.forEach((w,i)=>{ w.x=d1.dx*(30+i); w.z=d1.dz*(30+i); });
  W.__paintHUD();
  const c1=document.querySelectorAll('#grpBar .gcell')[1];
  out.push(['★ 늑대가 들어온 모둠이 빨개진다', c1.classList.contains('bad'),
    document.getElementById('gV1').textContent]);
  out.push(['조용한 모둠은 초록', document.getElementById('gS4').textContent==='💚',
    document.getElementById('gS4').textContent]);
  // 칸을 누르면 그 모둠으로 보내기가 열린다
  document.querySelectorAll('#grpBar .gcell')[1].click();
  const open = document.getElementById('popGive').classList.contains('on');
  const sel = [...document.querySelectorAll('#giveWrap button')][1];
  out.push(['★ 칸을 누르면 그 모둠으로 보내기가 열린다',
    open && sel.style.background !== '', open ? '2모둠 골라짐' : '안 열림']);
  document.getElementById('popGive').classList.remove('on');
  return out;
})) ok(r[1], r[0], r[2]);

console.log('\n── 💥 철거 · ⏸️ 멈춤 ──');
for(const r of await pg.evaluate(async ()=>{
  const W=window, G=W.__G, out=[];
  G.phase='day'; G.paused=false; G.wolves.length=0; W.__clear();
  G.me.g=2; G.res[2]={w:9e5,s:9e5,g:9e5};
  const d=W.__DIRS[2];
  const x=Math.round(d.dx*30), z=Math.round(d.dz*30);
  W.__place('wwall',x,z);
  const o=[...W.__STRU.values()].pop(); o.n='박지수';
  // 그 앞에 서서 철거를 든다
  W.__PL.x=x+0.5-d.dx*2.2; W.__PL.z=z+0.5-d.dz*2.2; W.__PL.y=W.__GY;
  W.__PL.yaw=Math.atan2(-d.dx,-d.dz); W.__PL.pitch=0;
  W.__selTool('del'); W.__setActing(true);
  const step=(n)=>{ for(let i=0;i<n;i++) W.__doAction(1/30); };
  step(60);                                   // 2초
  out.push(['철거는 2초엔 아직 안 된다', W.__STRU.size===1, W.__STRU.size+'채']);
  out.push(['누가 지었는지 보여 준다',
    /박지수/.test(document.getElementById('aimInfo').innerHTML), '조준판에 이름']);
  step(35);                                   // 총 3.2초
  out.push(['★ 3초 누르면 철거된다', W.__STRU.size===0, W.__STRU.size+'채']);
  // 멈춤
  W.__setActing(false); W.__selTool('mine');
  /* 낮에 잰다 — 밤은 늑대가 없으면 바로 끝나 버려서 시간 재기에 안 맞다 */
  G.started=true; G.phase='day'; G.t=120; G.paused=false;
  const tRun=G.t; for(let i=0;i<15;i++) W.__hostPhase(1/30);
  const ran = tRun - G.t;
  const t0=G.t; W.__setPaused(true);
  for(let i=0;i<30;i++) W.__hostPhase(1/30);
  out.push(['★ 멈추면 시간이 안 간다', G.t===t0 && ran>0.4,
    '안 멈추면 '+ran.toFixed(2)+'초 감 / 멈추면 '+(t0-G.t).toFixed(2)+'초']);
  out.push(['멈춤 막이 보인다', document.getElementById('pauseVeil').classList.contains('on')]);
  G.phase='night'; W.__PL.hp=100; W.__PL.down=false;
  G.wolves.push({id:9,k:0,x:W.__PL.x+0.3,z:W.__PL.z+0.3,y:W.__GY,hp:9,mx:9,mv:false,ph:0,hurt:0});
  W.__sheepHurt(0.3);
  out.push(['★ 멈춘 동안엔 안 물린다', W.__PL.hp===100, W.__PL.hp+'/100']);
  W.__setPaused(false);
  out.push(['다시 시작하면 막이 사라진다', !document.getElementById('pauseVeil').classList.contains('on')]);
  return out;
})) ok(r[1], r[0], r[2]);

console.log('\n── 📋 우리 반 오늘의 기록 ──');
for(const r of await pg.evaluate(()=>{
  const W=window, G=W.__G, out=[];
  G.paused=false;
  const pcm=W.__pcMap;
  pcm.set('a',{n:'김하늘',g:0,mined:40,built:6,hits:9,saved:2,fixed:3,helped:1});
  pcm.set('b',{n:'박지수',g:2,mined:31,built:4,hits:5,saved:0,fixed:1,helped:0});
  G.me.g=0; G.res[0]={w:9e5,s:9e5,g:9e5};
  const d=W.__DIRS[0];
  W.__place('arrow', Math.round(d.dx*30), Math.round(d.dz*30));
  const o=[...W.__STRU.values()].pop(); o.lv=5; o.n='김하늘'; o.g=0;
  G.phase='win'; G.day=10;
  W.__paintEndCard();
  const grid=document.getElementById('ecGrid').textContent;
  out.push(['총 캔 자원이 합쳐진다', /71/.test(grid), grid.replace(/\s+/g,' ').slice(0,60)]);
  out.push(['친구 일으킨 횟수가 나온다', /💚 2/.test(grid)]);
  out.push(['모둠별 막대가 다섯 줄', document.querySelectorAll('#ecBars .ec-b').length===5,
    document.querySelectorAll('#ecBars .ec-b').length+'줄']);
  const note=document.getElementById('ecNote').textContent;
  out.push(['★ 가장 높이 올린 건물과 지은 사람이 나온다',
    /Lv\.5/.test(note) && /김하늘/.test(note), note.replace(/\s+/g,' ').slice(0,70)]);
  /* ★ 검사가 틀렸던 곳 — 넣어 둔 친구 둘 말고 '나' 도 센다(pcMap 에 내 칸이 늘 있다).
     그래서 2명이 아니라 3명이 맞다. 예전부터 틀린 채로 빨간불이 켜져 있었다. */
  out.push(['참여 인원이 나온다 (넣은 친구 2명 + 나)', /3명/.test(note),
    (note.match(/\d+명/)||['?'])[0]]);
  return out;
})) ok(r[1], r[0], r[2]);

console.log('\n── 💾 새로고침해도 같은 사람 ──');
const before = await pg.evaluate(()=>({uid:window.__uid, ls:{
  u:localStorage.getItem('sheepUid'), n:localStorage.getItem('sheepName'),
  g:localStorage.getItem('sheepG')}}));
const pg2 = await ctx.newPage();
await pg2.goto('http://127.0.0.1:8915/', {waitUntil:'load', timeout:60000});
await pg2.waitForFunction('window.__READY===true', {timeout:60000});
const after = await pg2.evaluate(()=>({uid:window.__uid,
  name:document.getElementById('iName').value,
  g:[...document.querySelectorAll('#grpPick button')].findIndex(b=>b.classList.contains('on'))}));
ok(before.uid===after.uid, '★ 새로고침해도 uid 가 같다 (기록이 안 쪼개진다)', after.uid);
ok(after.name==='김하늘', '이름이 채워져 있다', after.name);
ok(after.g===2, '고른 모둠이 기억된다', (after.g+1)+'모둠');

console.log('\n'+(errs.length?errs.slice(0,4).join('\n'):'(오류 없음)'));
console.log(fail? `\n${fail}건 실패 / ${pass}건 통과` : `\n${pass}항목 전부 통과`);
await b.close(); srv.close();
process.exit(fail?1:0);
