/* 21차b 화면 확인 — 서바이벌 참가상 알림이 화면에 어떻게 뜨나
   ★ 참가상 줄은 글자가 길다("2모둠이 이겼어요 — 참가상 🪵16 🪨12 ✨4 (내가 넣은 피해 45)").
     #toast 는 width:min(560px,86vw) 라 넘치면 줄이 접힌다 — 몇 줄로 접히는지, 아래 도구 칸을
     건드리는지 자로 재고 찍는다. 교실 크롬북(1366×768)에서도 같이 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19990), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[];

async function shot(W, H, tag){
  const pg=await b.newPage({viewport:{width:W,height:H}});
  pg.on('pageerror',e=>errs.push(tag+' '+e.message));
  pg.on('console',m=>{ if(m.type()==='error') errs.push(tag+' console '+m.text()); });
  await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
  await pg.waitForFunction('window.__READY===true',{timeout:60000});
  await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1800);
  await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

  const board = ()=> pg.evaluate(()=>{
    const W=window, G=W.__G, M=W.__MINI();
    W.__miniPl.clear();
    W.__miniPl.set(W.__uid, {g:G.me.g, n:'김하늘', dm:W.__MINE.dm|0, o:W.__MINE.out?1:0});
    const rows = [['a',1,'서준',120,0],['b',2,'하윤',80,0],['c',3,'도윤',35,1],['d',4,'서아',12,1]];
    for(const [k,g,n,dm,o] of rows){
      W.__miniPl.set(k, {g, n, dm, o});
      G.players.set(k, {uid:k, x:W.__PL.x + (g-2.5)*3.0, z:W.__PL.z - 6, y:M.Y,
                        ry:Math.PI, n, g, hat:0, gls:0, clo:0, mv:false, ph:g*1.7,
                        hp:100, down:!!o});
      W.__pcMap.set(k, {n, g, pet:0});
    }
    W.__hudPrev().mchips = null; W.__paintMini();
  });

  /* 내가 45 를 넣고 쓰러진 판 — 1모둠(서준)이 이긴다 */
  await pg.evaluate(()=>{
    const W=window, G=W.__G, M=W.__MINI();
    G.paused = false; W.__goMini(2);
    for(let i=0;i<Math.ceil((M.INTRO+1)*30);i++) W.__miniTick(1/30);
    G.mini.st = 'run'; G.t = 4;
    W.__MINE.dm = 45;
    W.__PL.x = 0; W.__PL.z = 8; W.__PL.y = M.Y + W.__survTopAt(0, 8);
    W.__PL.yaw = Math.PI; W.__PL.pitch = -0.06;
    G.paused = true;
  });
  await board();
  await pg.evaluate(()=>{
    const W=window, M=W.__MINI();
    for(let i=0;i<12 && !W.__MINE.out;i++) W.__survHit('a','서준',1, M.HEAD, true);
  });
  await board();
  await pg.evaluate(()=>{
    const W=window, G=W.__G;
    G.paused = false; W.__miniFinish(); G.paused = true;
    W.__hudPrev().mchips = null; W.__paintMini();
  });
  await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ window.__hudPrev().mchips = null; window.__paintMini(); });
  await pg.waitForTimeout(150);

  /* 자로 잰다 — 알림 글자, 몇 줄인가, 아래 도구 칸과 겹치나 */
  const m = await pg.evaluate(()=>{
    const t=document.getElementById('toast'), r=t.getBoundingClientRect();
    const cs=getComputedStyle(t), lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
    const hb=document.getElementById('hotbar'), hr=hb?hb.getBoundingClientRect():null;
    return {글:t.textContent, 보임:cs.opacity, 위:Math.round(r.top), 아래:Math.round(r.bottom),
            줄수:Math.max(1,Math.round(r.height/lh)), 도구칸위:hr?Math.round(hr.top):null,
            자원: window.__myRes ? {...window.__myRes()} : null};
  });
  await pg.screenshot({path:OUT+'/21b-consol-'+tag+'.png'});
  console.log(tag+'  '+JSON.stringify(m));
  await pg.close();
}

await shot(1100, 760, '1100');
await shot(1366, 768, '1366');
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
