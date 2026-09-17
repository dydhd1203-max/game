/* 33차 검사 — 교실 60fps(성능 2차): 그래픽 프리셋 표 · 기본값 '보통' · 시작 화면 그래픽 단추(고르면 저장하고 다시 연다) · 주소 손잡이가 이긴다
   ★ 교실 실측(31차 판): 기준 40, 화면 그리기 끔 +21, 해상도 원본 −17 — 병목은 픽셀. 그래서 기본을 '보통'(해상도 0.85 · MSAA 2 · 그림자 1024)으로
     내리고, 아이가 시작 화면에서 선명/보통/부드럽게를 고를 수 있게 했다. 검사기는 GPU 를 못 재니 여기선 '값이 실제로 먹나' 만 본다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 9330);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const ready = async (pg)=>{ await pg.waitForFunction('window.__READY===true', null, {timeout:60000}); };

/* ═══════ ① 표 · 기본값 ═══════ */
const ctx = await b.newContext({viewport:{width:1366,height:768}});
const pg = await ctx.newPage(); pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000}); await ready(pg);
{
  const r = await pg.evaluate(()=>{ const W=window, P=W.__GFX_PRESET, R=W.__R;
    return {P, q:W.__GFX_Q, def:W.DEFAULTS.gfx, g:W.__GFX, pr:R.getPixelRatio(), dpr:devicePixelRatio,
      aa:!!R.getContext().getContextAttributes().antialias, sm:R.shadowMap.enabled,
      btns:[...document.querySelectorAll('#gfxPick .btn')].map(b=>b.dataset.gfx+':'+b.classList.contains('on')),
      nm:(document.querySelector('#gfxNm')||{}).textContent}; });
  /* 49차c — '보통' 의 그림자 지도만 1024 → 2048 로 올렸다. 26차 교실 실측에서 그림자를 통째로 꺼도 +2.5fps 뿐이었고
     그 값이 2048 에서 잰 값이라, 이 올림은 그 2.5 안에 있다. 해상도 0.85 · MSAA 2 는 그대로다(픽셀이 제일 비싸다). */
  ok('★ 프리셋 셋 — 선명 2048·MSAA4·1.0 / 보통 2048·MSAA2·0.85 / 부드럽게 0·0·0.7, 빛 번짐은 셋 다 없음',
     r.P.high.shadow===2048 && r.P.high.aa===4 && r.P.high.pr===1.0 && r.P.mid.shadow===2048 && r.P.mid.aa===2 && r.P.mid.pr===0.85 &&
     r.P.low.shadow===0 && r.P.low.aa===0 && r.P.low.pr===0.7 && !r.P.high.bloom && !r.P.mid.bloom && !r.P.low.bloom, JSON.stringify(r.P));
  ok('★ 선생님 기본값이 보통(mid)이고, 주소·저장이 없으면 그것이 켜진다', r.def==='mid' && r.q==='mid', r.def+' / '+r.q);
  ok('보통 — 해상도 배율이 렌더러에 실제로 먹는다(0.85)', Math.abs(r.pr - Math.min(r.dpr, 0.85)) < 1e-6, r.pr);
  /* 검사기는 소프트웨어 렌더링이라 ?gfx 가 없으면 게임이 스스로 그림자·MSAA 를 끈다(25차) — MSAA·그림자는 ?gfx=mid 로 열어 본다 */
  { const p2 = await ctx.newPage(); await p2.goto('http://127.0.0.1:'+PORT+'/?gfx=mid', {waitUntil:'load', timeout:60000}); await ready(p2);
    const m = await p2.evaluate(()=>{ const R=window.__R; return {aa:!!R.getContext().getContextAttributes().antialias, sm:R.shadowMap.enabled, ms:window.__sun.shadow.mapSize.x}; });
    ok('보통(?gfx=mid) — 계단 없애기(MSAA)가 켜져 있고 그림자 지도 2048 이 켜져 있다 (49차c)', m.aa===true && m.sm===true && m.ms===2048, m.aa+' / '+m.sm+' / '+m.ms);
    await p2.close(); }
  ok('★ 시작 화면에 그래픽 단추 셋(선명·보통·부드럽게)이 있고 지금 것에 불이 들어와 있다', r.btns.length===3 && r.btns.includes('mid:true') && r.btns.filter(s=>s.endsWith('true')).length===1 && r.nm==='보통', r.btns.join(' ')+' · '+r.nm);
}
/* ═══════ ② 단추를 누르면 저장하고 다시 연다 · 이름은 남는다 ═══════ */
{
  await pg.fill('#iName', '김하늘'); await pg.fill('#iRoom', 'abcd');
  await pg.evaluate(()=>{ window.__mark = 1; document.querySelector('#gfxPick .btn[data-gfx="mid"]').click(); });
  await pg.waitForTimeout(600);
  const same = await pg.evaluate(()=>({mark:window.__mark, q:window.__GFX_Q}));
  ok('지금 켜진 것을 다시 누르면 아무 일도 없다(다시 열지 않는다)', same.mark===1 && same.q==='mid', JSON.stringify(same));
  await Promise.all([pg.waitForNavigation({waitUntil:'load', timeout:60000}),
                     pg.evaluate(()=>document.querySelector('#gfxPick .btn[data-gfx="low"]').click())]);
  await ready(pg);
  const r = await pg.evaluate(()=>{ const W=window, R=W.__R; return {q:W.__GFX_Q, saved:localStorage.getItem('gfxPick'), pr:R.getPixelRatio(), dpr:devicePixelRatio,
    aa:!!R.getContext().getContextAttributes().antialias, sm:R.shadowMap.enabled, name:document.querySelector('#iName').value, room:document.querySelector('#iRoom').value,
    on:[...document.querySelectorAll('#gfxPick .btn.on')].map(b=>b.dataset.gfx), nm:(document.querySelector('#gfxNm')||{}).textContent}; });
  ok('★ 부드럽게를 누르면 저장(gfxPick=low)하고 다시 열려 그 프리셋으로 켜진다', r.saved==='low' && r.q==='low', r.saved+' / '+r.q);
  ok('부드럽게 — 해상도 0.7 · MSAA 없음 · 그림자 없음이 렌더러에 먹는다', Math.abs(r.pr - Math.min(r.dpr, 0.7)) < 1e-6 && r.aa===false && r.sm===false, r.pr+' / '+r.aa+' / '+r.sm);
  ok('★ 다시 열려도 쓰던 이름·방 코드가 남아 있다', r.name==='김하늘' && r.room.toUpperCase()==='ABCD', r.name+' / '+r.room);
  ok('다시 열린 뒤 단추 불이 부드럽게로 옮겨 갔다', r.on.length===1 && r.on[0]==='low' && r.nm==='부드럽게', r.on.join(',')+' · '+r.nm);
}
/* ═══════ ③ 주소 손잡이가 저장보다 이긴다 · 저장이 기본값보다 이긴다 ═══════ */
{
  await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=high', {waitUntil:'load', timeout:60000}); await ready(pg);
  const a = await pg.evaluate(()=>({q:window.__GFX_Q, saved:localStorage.getItem('gfxPick'), on:[...document.querySelectorAll('#gfxPick .btn.on')].map(b=>b.dataset.gfx)}));
  ok('★ ?gfx=high 는 저장(low)을 이긴다 — 교실 견주기 손잡이가 늘 우선', a.q==='high' && a.saved==='low' && a.on[0]==='high', a.q+' / '+a.saved);
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000}); await ready(pg);
  const c = await pg.evaluate(()=>window.__GFX_Q);
  ok('주소가 없으면 저장(low)이 기본값(mid)을 이긴다', c==='low', c);
  await pg.evaluate(()=>localStorage.setItem('gfxPick', 'zzz'));
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000}); await ready(pg);
  const d = await pg.evaluate(()=>window.__GFX_Q);
  ok('저장된 값이 표에 없으면 기본값으로 돌아간다(옛 저장값에 안 걸린다)', d==='mid', d);
  await pg.close();
}
/* ═══════ ④ 태블릿은 단추를 감춘다(어차피 터치는 고정값) ═══════ */
{
  const tc = await b.newContext({viewport:{width:1024,height:768}, hasTouch:true, isMobile:true});
  const tp = await tc.newPage(); tp.on('pageerror', e=>errs.push(e.message));
  await tp.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000}); await ready(tp);
  const r = await tp.evaluate(()=>({touch:document.body.classList.contains('touch'), disp:getComputedStyle(document.querySelector('#gfxRow')).display, g:window.__GFX}));
  ok('태블릿(touch)에서는 그래픽 줄이 안 보이고 값은 터치 고정(그림자 0 · MSAA 0 · 해상도 1.0)', r.touch && r.disp==='none' && r.g.shadow===0 && r.g.aa===0 && r.g.pr===1.0, r.disp+' · '+JSON.stringify(r.g));
  await tc.close();
}
await ctx.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
