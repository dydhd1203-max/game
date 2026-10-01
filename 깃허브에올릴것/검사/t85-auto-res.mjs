// 85차 실제 브라우저 검사 — 자동 해상도.
// ① ?autores=1: 30fps 가 2초 이어지면 한 단(×.91), 또 2초면 두 단(×.82)까지만 내리고 화면 크기(CSS)는 그대로.
// ② 60fps 가 8초 이어지면 한 단씩 올린다. 올린 뒤 4초 안에 다시 떨어지면 60초 동안 안 올린다.
// ③ 검사기(자동 조종) 기본은 꺼짐 · 진단 Shift+9 측정 중엔 쉰다.
import assert from 'node:assert/strict';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),PORT=+(process.env.T85_PORT||20685);
const server=serve(PORT,file),errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const run=async q=>{const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{const now=performance.now.bind(performance);let time=null;
   window.__freeze85=()=>{time=100000;};window.__advance85=ms=>{time+=ms;window.__loop73();};
   performance.now=()=>time===null?now():time;const raf=requestAnimationFrame.bind(window);requestAnimationFrame=f=>time===null?raf(f):0;
   localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','t85-autores');});
  await page.goto(`http://127.0.0.1:${PORT}/?gfx=mid${q}`,{waitUntil:'load',timeout:400000});
  await page.waitForFunction(()=>window.__READY,null,{timeout:400000,polling:500});
  await page.evaluate(()=>{const W=window;document.getElementById('iName').value='자동 해상도';document.getElementById('bSolo').click();W.__introDone();
   document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze85();});
  return page;};
 const page=await run('&autores=1');
 const r=await page.evaluate(()=>{const W=window,A=W.__AUTORES,R=W.__R,out={on:A.on,base:A.base,css:[innerWidth,innerHeight]};
  const go=(fps,sec)=>{for(let i=0;i<Math.round(fps*sec);i++)W.__autoResTick(1/fps);};   // 판단 규칙은 실제 함수로(게임 루프 한 프레임씩은 아래 real 에서)
  const pr=()=>+R.getPixelRatio().toFixed(4);
  for(let i=0;i<150;i++)W.__advance85(1000/25);out.real=pr();   // 실제 게임 루프로 25fps 6초 → 내려간다
  A.lv=0;W.__R.setPixelRatio(A.base);A.t=A.n=0;
  go(60,3);out.at60=pr();
  go(30,2.2);out.down1=pr();go(30,2.2);out.down2=pr();go(30,4.4);out.floor=pr();
  out.cssSame=R.domElement.style.width===innerWidth+'px'||R.domElement.clientWidth===innerWidth;
  go(60,8.4);out.up1=pr();
  go(30,2.2);out.reDown=pr();out.lock=A.lock-A.clock;
  go(60,20);out.lockedHold=pr();
  // 진단 측정 중엔 쉰다
  W.__autoSweepProbe=1;return out;});
 await page.close();
 const off=await run('');
 const r2=await off.evaluate(()=>{const W=window,A=W.__AUTORES,R=W.__R,p0=R.getPixelRatio();for(let i=0;i<100;i++)W.__advance85(1000/20);return {on:A.on,same:R.getPixelRatio()===p0};});
 await off.close();
 console.log(JSON.stringify({r,r2,errors}));
 const b=r.base,near=(a,x)=>Math.abs(a-x)<1e-3;
 assert.deepEqual(errors,[]);
 assert.ok(r.on&&r.real<b-1e-3,'The real game loop at 25fps lowers the drawing resolution');
 assert.ok(near(r.at60,b),'60fps keeps the preset resolution');
 assert.ok(near(r.down1,b*.91)&&near(r.down2,b*.82)&&near(r.floor,b*.82)&&r.cssSame,'30fps lowers the drawing resolution in two steps to ×0.82 only; the page size stays the same');
 assert.ok(near(r.up1,b*.91),'8 s at 60fps raises one step');
 assert.ok(near(r.reDown,b*.82)&&r.lock>50&&near(r.lockedHold,b*.82),'A drop right after raising locks the resolution for a minute (no flip-flop)');
 assert.ok(!r2.on&&r2.same,'Automated test browsers keep auto resolution off unless ?autores=1');
 console.log('PASS: auto resolution steps down/up with hysteresis and lock, off in automation by default');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
