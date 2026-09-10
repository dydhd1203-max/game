/* 21차 화면 확인 — 서바이벌: 전광판 · 쓰러진 시체 · 이긴 모둠 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19980), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1800);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* 서바이벌을 열고 친구 넷을 세운다 */
const board = ()=> pg.evaluate(()=>{
  const W=window, G=W.__G, M=W.__MINI();
  W.__miniPl.clear();
  W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', dm:W.__MINE.dm|0, o:W.__MINE.out?1:0});
  const rows = [['a',1,'서준',120,1],['b',2,'하윤',80,0],['c',3,'도윤',35,0],['d',4,'서아',12,0]];
  const GY = M.Y;
  for(const [k,g,n,dm,o] of rows){
    W.__miniPl.set(k, {g, n, dm, o});
    G.players.set(k, {uid:k, x:W.__PL.x + (g-2.5)*3.0, z:W.__PL.z - 6, y:GY,
                      ry:Math.PI, n, g, hat:0, gls:0, clo:0, mv:false, ph:g*1.7,
                      hp:100, down:!!o});
    W.__pcMap.set(k, {n, g, pet:0});
  }
  W.__hudPrev().mchips = null; W.__paintMini();
});

await pg.evaluate(()=>{
  const W=window, G=W.__G, M=W.__MINI();
  G.paused = false; W.__goMini(2);
  for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
  G.mini.st = 'run'; G.t = 95;
  W.__MINE.hp = 55; W.__MINE.dm = 45; W.__MINE.out = false;
  W.__PL.x = 0; W.__PL.z = 8; W.__PL.y = M.Y + W.__survTopAt(0, 8);
  W.__PL.yaw = Math.PI; W.__PL.pitch = -0.06;
  G.paused = true;
});
await board(); await pg.waitForTimeout(900); await board();
await pg.screenshot({path:OUT+'/21-surv-board.png'}); console.log('찍음 21-surv-board');

/* 내가 쓰러진 순간 — 시체 + 3인칭 */
await pg.evaluate(()=>{
  const W=window;
  /* ★ 체력을 손으로 0 으로 만들어 봐야 안 죽는다 — 죽는 길은 survHit 하나뿐이다.
     (여기서 한 번 헛짚어서 '체력 0 인데 멀쩡히 서 있는' 화면을 찍었다) */
  const M = W.__MINI();
  for(let i=0;i<12 && !W.__MINE.out;i++) W.__survHit('a','서준',1, M.HEAD, true);
});
await board(); await pg.waitForTimeout(1100); await board();
await pg.screenshot({path:OUT+'/21-surv-down.png'}); console.log('찍음 21-surv-down');

/* 끝난 판 — 이긴 모둠 + 전광판 */
await pg.evaluate(()=>{
  const W=window, G=W.__G;
  G.paused = false; W.__miniFinish(); G.paused = true;
  W.__hudPrev().mchips = null; W.__paintMini();
});
await pg.waitForTimeout(900);
await pg.evaluate(()=>{ window.__hudPrev().mchips = null; window.__paintMini(); });
await pg.waitForTimeout(200);
await pg.screenshot({path:OUT+'/21-surv-done.png'}); console.log('찍음 21-surv-done');
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
