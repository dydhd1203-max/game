/* 19차 검사 — 새 꾸미기 · 시작 화면이 안 잘리나
   ★ 38차 — 꽃밭·짝꿍 절은 기능과 함께 뺐다(선생님: "꽃 심기 기능 없애고", "짝꿍도 없애줘"). 84 → 22.
   ★ 값을 검사에 베끼지 않는다. 개수는 표에서 세어서 관계만 본다(갈래 개수를 박아 두고 17차d에 데었다).
   ★ '큰 글씨로 정한 것이 실제로 큰가'(18차h)와 같은 결 — 화면이 잘리는지는
     눈이 아니라 자로 잰다. 시작 화면 제목 자리를 열 가지 크기에서 잰다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12300);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

/* ═══════ ① 시작 화면 — 제목이 잘리지 않나 (열 가지 교실 크기) ═══════
   ★ 17차g에 카드가 109px 넘쳐 제목이 화면 밖으로 나가 있었는데, 눈으로는
     "좀 기네" 정도라 몇 판을 그냥 지나쳤다. 그때 고친 뒤로 이걸 지키는 검사가 없어서
     19차에 짝꿍 줄을 더하자 다시 −27px 로 잘렸다. 이제 자로 잰다. */
const SIZES = [[1366,768],[1366,912],[1280,800],[1280,720],[1024,768],
               [1024,600],[912,1368],[820,1180],[760,420],[420,880]];
for(const [w,h] of SIZES){
  const ctx = await b.newContext({viewport:{width:w,height:h}});
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
  const r = await pg.evaluate(()=>{
    const t = document.getElementById('title');
    const h1 = document.querySelector('#titleCard h1');
    const q = h1.getBoundingClientRect();
    const btn = document.getElementById('bSolo').getBoundingClientRect();
    const scr = t.scrollHeight - t.clientHeight;      // 스크롤로 더 갈 수 있는 만큼
    return {top:Math.round(q.top), left:Math.round(q.left),
            /* 아래쪽은 스크롤로 닿을 수 있으면 된다 */
            reach: Math.round(btn.bottom) <= t.clientHeight + scr + 2};
  });
  ok(`${w}×${h} — 제목이 화면 위로 안 잘린다`, r.top >= 0, '제목 top '+r.top+'px');
  ok(`${w}×${h} — 시작 단추까지 닿는다`, r.reach);
  await ctx.close();
}

const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});

/* ═══════ ② 목록 — 아이콘·이름이 본 배열과 길이가 같나 ═══════
   ★ SHEEP_BITE 때와 같은 함정이다. 한 칸이 밀리면 오류가 아니라 **조용히 딴 것**이 나온다. */
const lists = await pg.evaluate(()=>{
  const W=window;
  return {hat:[W.__HATS.length, W.__HAT_N.length],
          gls:[W.__GLASSES.length, W.__GLS_N.length],
          clo:[W.__CLOTHES.length, W.__CLO_N.length],
          /* 예전 번호가 안 밀렸나 — 새것은 반드시 배열 '끝' 에 붙어야 한다 */
          oldHat: W.__HAT_N[8], oldClo: W.__CLO_N[8],
          newHat: W.__HAT_N.slice(11), newClo: W.__CLO_N.slice(9)};
});
ok('모자 아이콘·이름 길이가 본 배열과 같다', lists.hat[0]===lists.hat[1], lists.hat.join('/'));
ok('안경 아이콘·이름 길이가 본 배열과 같다', lists.gls[0]===lists.gls[1], lists.gls.join('/'));
ok('옷 아이콘·이름 길이가 본 배열과 같다', lists.clo[0]===lists.clo[1], lists.clo.join('/'));
ok('★ 새것을 목록 끝에 넣었다 — 예전 번호가 안 밀렸다 (17차g에 통째로 밀렸던 자리)',
   lists.oldHat === '꽃 화관' && lists.oldClo === '별무늬 잠옷',
   '8번 모자 '+lists.oldHat+' · 8번 옷 '+lists.oldClo);
ok('새 모자·새 옷이 실제로 늘었다', lists.newHat.length===2 && lists.newClo.length===2,
   lists.newHat.join(',')+' / '+lists.newClo.join(','));

/* ═══════ ③ 꾸미기 조각 칸이 '제일 많이 걸친 아이' 보다 넉넉한가 ═══════
   ★ 17차f에 딱 맞는 칸(18)이 모자라 조각이 조용히 잘렸다. '딱 맞는 칸은 모자란 칸' 이다.
     개수를 검사에 박지 않고 표에서 세어 칸과 맞대 본다. */
const deco = await pg.evaluate(()=>{
  const W=window;
  const mx = a => Math.max(...a.map(x=>x.length));
  const job = Math.max(...W.__JOB_LOOK.map(j=>Math.max(...j.map(t=>t.length))));
  const worst = mx(W.__HATS) + mx(W.__GLASSES) + mx(W.__CLOTHES) + job;
  return {worst, cap: W.__Pdeco().count_max, maxp: W.__Pdeco().count_max /
          (mx(W.__HATS)+mx(W.__GLASSES)+mx(W.__CLOTHES)+job)};
});
ok('★ 제일 많이 걸친 아이의 조각이 한 사람 칸에 들어간다 (딱 맞는 칸은 모자란 칸이다)',
   deco.maxp >= 21, '한 사람 최대 '+deco.worst+'조각 · 칸 '+deco.cap+' (사람 '+deco.maxp.toFixed(1)+'명분)');

/* 게임 시작 */
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1600);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ④ 새 꾸미기가 '보이는 창' 안에 있나 ═══════
   ★ 몸통 앞면 f≈0.47 · 머리 f 0.37~0.99 · u 0.74~1.38.
     가슴에서 실제로 보이는 창은 u 0.25~0.74 뿐이다(볼터치·전직 하트가 여기서 사라졌다). */
const win = await pg.evaluate(()=>{
  const W=window, o={};
  /* 새 모자 둘 — 머리 위(u > 1.38)나 머리 앞(f > 0.99)에 있어야 보인다 */
  const hatOK = [11,12].map(i=> W.__HATS[i].every(h=> h[1] > 1.30 || h[0] > 0.99));
  /* 새 옷 둘 — 가슴판은 창(0.25~0.74) 안, 치마는 몸통 옆폭(0.42)보다 넓어야 한다 */
  const clo = [9,10].map(i=>{
    const parts = W.__CLOTHES[i];
    const chest = parts.filter(p=> p[0] > 0.4);                 // 가슴에 붙는 조각
    const wide  = parts.filter(p=> Math.abs(p[0]) < 0.2);        // 몸을 두르는 조각
    return {창밖: chest.filter(p=> p[1] < 0.25 || p[1] > 0.74).length,
            넓은: wide.filter(p=> p[3] > 1.10).length};
  });
  o.hatOK = hatOK; o.clo = clo;
  return o;
});
ok('★ 새 모자가 머리 위(또는 얼굴 앞)에 붙는다 — 털 속에 안 묻힌다',
   win.hatOK.every(Boolean), win.hatOK.join(','));
ok('★ 새 옷의 가슴 조각이 보이는 창(u 0.25~0.74) 안에 있다',
   win.clo.every(c=>c.창밖 === 0), win.clo.map(c=>c.창밖).join(','));
ok('★ 몸을 두르는 옷이 등털(반너비 0.54)보다 넓다 — 안 그러면 털 속에 파묻힌다',
   win.clo.every(c=>c.넓은 > 0), win.clo.map(c=>c.넓은+'조각').join(' · '));

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
