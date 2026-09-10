/* 20차 화면 확인 — 줄넘기: 줄 그림자 · 판정 · 모둠 연속 표시
   ★ 줄이 어디쯤 왔는지 1인칭에서 눈으로 잡히나가 이번 판의 전부다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19960), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1800);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* 줄넘기를 열고 run 으로 */
await pg.evaluate(()=>{
  const W=window, G=W.__G, M=W.__MINI();
  W.__goMini(1);
  for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
  G.mini.st = 'run';
  W.__PL.x = M.padX(G.me.g); W.__PL.z = M.PADZ; W.__PL.y = M.Y;
  /* ★ 시선은 게임이 세워 주는 그대로 쓴다(miniEnter 와 같은 식) — 줄은 이 방향의
     **앞쪽에서 내려온다**. 손으로 yaw 를 잡았다가 줄 뒤통수를 찍었다:
     재 보니 ph 1.25π~1.75π 가 '앞으로 +0.8~+1.13칸' 이었다. */
  W.__PL.yaw = Math.atan2(W.__PL.x, W.__PL.z - M.OZ); W.__PL.pitch = -0.20;
  /* 친구 넷을 옆에 세운다 — 단체 줄넘기 그림 */
  const GY = M.Y;
  for(let i=0;i<4;i++){ const k='p'+i;
    G.players.set(k,{uid:k, x:M.padX((i+1)%5), z:M.PADZ, y:GY, ry:Math.PI, n:'친구'+(i+1),
                     g:(i+1)%5, hat:0, gls:0, clo:0, mv:false, ph:i*1.7, hp:100, down:false});
    W.__pcMap.set(k,{n:'친구'+(i+1), g:(i+1)%5, pet:0});
    W.__miniPl.set(k,{g:(i+1)%5, n:'친구'+(i+1), j:7, c:5, b:9, l:0, k:0, hp:100});
  }
  W.__MINE.j = 7; W.__MINE.c = 5; W.__MINE.b = 9;
  W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', j:7, c:5, b:9, l:0, k:0, hp:100});
});
/* 줄이 여러 각도에 있을 때를 찍는다 — 그림자가 발 쪽으로 밀려오나 */
const at = async (phase, nm)=>{
  await pg.evaluate((ph)=>{
    const W=window, G=W.__G, M=W.__MINI();
    /* 원하는 각도가 나오는 시각을 찾아 G.t 를 맞춘다 */
    let best=0, bd=9;
    for(let t=0; t<M.ROPE; t+=0.01){
      const p = W.__ropePhase(t) % (Math.PI*2);
      const d = Math.abs(p - ph);
      if(d < bd){ bd = d; best = t; }
    }
    G.t = M.ROPE - best;
    G.paused = true;
    /* ★ 자리도 찍기 직전에 다시 잡는다 — 그 사이 루프가 돌면서 밀린다 */
    W.__PL.x = M.padX(G.me.g); W.__PL.z = M.PADZ; W.__PL.y = M.Y;
    W.__PL.vy = 0; W.__PL.ground = true; W.__PL.down = false;
    W.__PL.yaw = Math.atan2(W.__PL.x, W.__PL.z - M.OZ); W.__PL.pitch = -0.20;
    /* 찍는 순간의 표시를 손으로 맞춘다 — 그 사이 miniTick 이 돌면서 값이 바뀐다 */
    W.__ropeHit(0);
    W.__MINE.rs = 0; W.__MINE.j = 7; W.__MINE.c = 5; W.__MINE.b = 9; W.__MINE.f = 1;
    W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', j:7, c:5, b:9, l:0, k:0, hp:100});
    document.getElementById('stageTitle').classList.remove('on');
    W.__hudPrev().mchips = null;
    W.__paintMini();
  }, phase);
  await pg.waitForTimeout(700);
  /* ★ 멈춰 놔도 첫 프레임에 한 번은 판정이 돈다(각도가 껑충 뛰므로) — 그때 줄이 빨개진다.
     '걸렸다' 빨간 줄을 '평소 줄' 로 착각해서 한참 헤맸다. 찍기 직전에 지운다. */
  const at2 = await pg.evaluate(()=>{
    const W=window;
    W.__ropeHit(0); W.__MINE.rs = 0; W.__MINE.c = 5; W.__MINE.b = 9;
    W.__hudPrev().mchips = null; W.__paintMini();
    return {x:+W.__PL.x.toFixed(1), y:+W.__PL.y.toFixed(2), z:+W.__PL.z.toFixed(1),
            yaw:+W.__PL.yaw.toFixed(2), 줄칸:W.__R_rope().count, 빨강:W.__ropeHitT()};
  });
  await pg.waitForTimeout(60);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm, JSON.stringify(at2));
};
await at(Math.PI*1.00, '20-rope-far');     // 줄이 머리 위 — 평소 색
await at(Math.PI*1.72, '20-rope-cue');     // 금색이 되나
await at(Math.PI*0.04, '20-rope-hit');     // 바닥을 친다

/* 뛰는 순간 — 3인칭이라 내가 줄 위로 솟는 게 보여야 한다 */
await pg.evaluate(()=>{
  const W=window, M=W.__MINI();
  W.__PL.vy = M.RJ_JUMP*0.62; W.__PL.ground = false;
  W.__PL.y = W.__groundUnder(W.__PL.x, W.__PL.z, W.__PL.R) + M.CLEAR + 0.28;
});
await pg.waitForTimeout(80);
await pg.screenshot({path:OUT+'/20-rope-jump.png'}); console.log('찍음 20-rope-jump');

/* OX 퀴즈도 3인칭인가 */
await pg.evaluate(()=>{
  const W=window, G=W.__G, M=W.__MINI();
  G.paused = false;
  W.__goMini(0);
  for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
  document.getElementById('tQ').value = '늑대는 밤에만 나타난다';
  document.getElementById('tQO').click();
  W.__PL.x = -M.OX; W.__PL.z = M.OZ; W.__PL.y = M.Y;
  W.__PL.yaw = Math.atan2(W.__PL.x, W.__PL.z - 0); W.__PL.pitch = -0.25;
  W.__miniTick(0.05); G.paused = true; W.__paintMini();
});
await pg.waitForTimeout(900);
await pg.screenshot({path:OUT+'/20-quiz-tpv.png'}); console.log('찍음 20-quiz-tpv');
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
