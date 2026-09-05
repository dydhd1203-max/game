/* 화면 배치 검사 — 잘리거나 겹치는 자리가 없는지 실제 크기를 재서 본다 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 8901);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
let pass=0, fail=0;
const ok=(c,n,d)=>{ if(c){pass++;console.log('  OK  '+n+(d?'   → '+d:''));} else {fail++;console.log('  ✗   '+n+(d?'   → '+d:''));} };
const errs=[];
async function screen(tag, w, h, touch){
  const pg = await b.newPage({viewport:{width:w,height:h}, hasTouch:!!touch, isMobile:!!touch});
  pg.on('pageerror', e=>errs.push(tag+': '+e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  await pg.fill('#iName','김하늘'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
  await pg.waitForTimeout(1300);
  const r = await pg.evaluate(()=>{
    const R=s=>{const e=document.querySelector(s); if(!e) return null;
      const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,r:b.right,bo:b.bottom};};
    // 값이 세 개인 칸(배럭)의 값 줄이 칸 안에 온전히 들어가는가
    const slots=[...document.querySelectorAll('#bar .slot')];
    let worst=0, which='';
    for(const sl of slots){ const c=sl.querySelector('.cost'); if(!c) continue;
      const sb=sl.getBoundingClientRect();
      for(const sp of c.querySelectorAll('span')){ const b=sp.getBoundingClientRect();
        const over=Math.max(sb.left-b.left, b.right-sb.right);
        if(over>worst){ worst=over; which=sl.querySelector('.nm').textContent+' '+sp.textContent; } } }
    const over=(a,c)=>a&&c&&!(a.r<=c.x||c.r<=a.x||a.bo<=c.y||c.bo<=a.y);
    return {worst, which, W:innerWidth, H:innerHeight,
      dock:R('#dock'), hint:R('#hint'), stick:R('#stick'), mb:R('#mbtns'),
      grp:R('#grpBar'), mini:R('#miniWrap'),
      crys:R('#crystalWrap'), res:R('#resBox'), boss:(()=>{const e=document.querySelector('#bossWrap');
        e.classList.add('on'); const b=e.getBoundingClientRect(); e.classList.remove('on');
        return {x:b.x,y:b.y,w:b.width,h:b.height,r:b.right,bo:b.bottom};})(),
      grpN: document.querySelectorAll('#grpBar .gcell').length,
      hintVis: getComputedStyle(document.querySelector('#hint')).display!=='none',
      stickVis: getComputedStyle(document.querySelector('#stick')).display!=='none',
      ov:over};
  });
  const over=(a,c)=> a&&c&&!(a.r<=c.x||c.r<=a.x||a.bo<=c.y||c.bo<=a.y);
  console.log(`\n── ${tag} (${w}×${h}${touch?' 터치':''}) ──`);
  ok(r.worst<0.5, '건물 칸의 값이 안 잘린다', r.worst>0.5?('넘침 '+r.worst.toFixed(1)+'px @'+r.which):'0px');
  ok(r.dock.bo <= r.H, '트레이가 화면 밖으로 안 나간다', Math.round(r.dock.bo)+' / '+r.H);
  if(r.hintVis) ok(!over(r.hint, r.dock), '조작 안내가 트레이랑 안 겹친다');
  if(r.stickVis){
    ok(!over(r.stick, r.dock), '조이스틱이 트레이랑 안 겹친다');
    ok(!over(r.mb, r.dock), '큰 버튼이 트레이랑 안 겹친다');
  }
  ok(!over(r.boss, r.crys), '보스 바가 수정 바를 안 가린다');
  ok(!over(r.boss, r.res),  '보스 바가 자원 패널을 안 가린다');
  ok(!over(r.grp, r.crys),  '모둠 띠가 수정 바를 안 가린다');
  ok(!over(r.grp, r.boss),  '모둠 띠가 보스 바를 안 가린다');
  ok(!over(r.grp, r.res),   '모둠 띠가 자원 패널을 안 가린다');
  ok(!over(r.grp, r.mini),  '모둠 띠가 지도를 안 가린다');
  ok(r.grpN === 5, '모둠 칸이 다섯 개', r.grpN + '개');
  await pg.close();
}
await screen('교실 크롬북', 1366, 768, false);
await screen('노트북',      1280, 720, false);
await screen('태블릿',      1024, 768, true);
await screen('작은 태블릿',  820, 500, true);
console.log('\n'+(errs.length?errs.slice(0,3).join('\n'):'(오류 없음)'));
console.log(fail? `\n${fail}건 실패 / ${pass}건 통과` : `\n${pass}항목 전부 통과`);
await b.close(); srv.close();
process.exit(fail?1:0);
