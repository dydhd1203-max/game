/* 25차 검사 — 그림자 · 하늘 돔 · 빛 번짐 · 품질 손잡이
   ★ 이 검사만 ?gfx=high 로 연다. 검사기는 소프트웨어 렌더링이라 게임이 스스로
     품질을 내리기 때문이다(그게 옳다 — 안 내리면 교실의 고장난 한 대가 기어간다).
     그래서 '일부러 켠 판' 을 따로 열어서 본다.
   ★ 그리고 '켜졌나' 로 끝내지 않는다. 24차까지 여러 번 겪었듯 코드가 맞아도 화면은 다를 수 있다 —
     그림자는 지도가 2048x2048 로 구워지고 있는데도 화면에 안 나온 적이 있다.
     그래서 **켠 판과 끈 판의 픽셀을 직접 빼서** 화면에 닿는지까지 본다.
   ★ 화면을 읽을 때 렌더타겟에 그려서 읽으면 안 된다 — three 는 렌더타겟일 때 톤매핑을
     건너뛰어서 화면과 다른 것을 읽게 된다. 그린 직후 같은 작업 안에서 2D 캔버스로 옮긴다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 9280);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

async function open(q){
  const pg = await b.newPage({viewport:{width:900,height:520}});
  pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/'+q, {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  return pg;
}
/* 프레임을 센다. 검사기는 1~3fps 라 시간으로 기다리면 프레임이 한 번도 안 돌 수 있다
   (24차에 t16 이 600ms 를 기다렸는데 그게 0.9프레임이었다). */
const frames = (pg,n)=> pg.evaluate(n=> new Promise(res=>{
  let i=0; const stop=setTimeout(res, 20000);
  const t=()=>{ if(++i>=n){ clearTimeout(stop); return res(); } requestAnimationFrame(t); };
  requestAnimationFrame(t); }), n);

/* ═══════ ① 품질 손잡이 ═══════ */
{
  const want = {high:{shadow:2048,bloom:1}, mid:{shadow:1024,bloom:0}, low:{shadow:0,bloom:0}};
  for(const q of ['high','mid','low']){
    const pg = await open('?gfx='+q);
    const g = await pg.evaluate(()=>({g:window.__GFX, sm:window.__R.shadowMap.enabled}));
    ok(`?gfx=${q} — 그림자 ${want[q].shadow||'없음'}`, g.g.shadow === want[q].shadow, g.g.shadow);
    ok(`?gfx=${q} — 빛번짐 ${want[q].bloom?'켬':'끔'}`, g.g.bloom === want[q].bloom, g.g.bloom);
    ok(`?gfx=${q} — 그림자 지도 ${want[q].shadow?'켬':'끔'}`, g.sm === (want[q].shadow>0));
    await pg.close();
  }
  const pg = await open('');
  const g = await pg.evaluate(()=>({soft:!!window.__GFX_SOFT, g:window.__GFX}));
  /* 검사기는 소프트웨어 렌더링이다 — 게임이 스스로 알아보고 내려가야 한다.
     이게 안 되면 교실에서 그래픽카드가 고장난 한 대가 오류 없이 기어간다. */
  ok('★ 그래픽카드가 없는 판을 스스로 알아보고 내려간다', g.soft && g.g.shadow === 0 && g.g.bloom === 0,
     g.soft ? '감지함' : '못 감지');
  await pg.close();
}

/* ═══════ ② 그림자가 화면에 닿나 ═══════ */
{
  const pg = await open('?gfx=high');
  await pg.fill('#iName','검'); await pg.click('#bSolo');
  await frames(pg, 8);
  await pg.evaluate(()=>{ const W=window; W.__introDone();
    W.__PL.x=16; W.__PL.z=22; W.__PL.yaw=-2.52; W.__PL.pitch=-0.16; });
  await frames(pg, 6);
  const r = await pg.evaluate(()=>{
    const W=window, R=W.__R, o={};
    o.켜짐 = R.shadowMap.enabled;
    o.지도 = W.__sun.shadow.map ? W.__sun.shadow.map.width : 0;
    /* 그림자를 드리우는 것이 한 곳(imesh)에서 켜지므로, 빠짐없이 걸렸나 센다 */
    let cast=0, recv=0; W.__scene.traverse(x=>{ if(x.isMesh||x.isInstancedMesh){
      if(x.castShadow) cast++; if(x.receiveShadow) recv++; } });
    o.드리움 = cast; o.받음 = recv;
    /* 그림자 상자가 사람을 따라오나 */
    W.__PL.x = 90; W.__PL.z = -40;
    W.__shadowFollow(90, -40);
    o.따라옴 = Math.abs(W.__sunTarget.position.x - 90) < W.__SH_R &&
               Math.abs(W.__sunTarget.position.z + 40) < W.__SH_R;
    /* 한 칸 단위로 끊어서 옮기나 — 안 그러면 걸을 때 그림자 가장자리가 지글거린다 */
    const texel = (W.__SH_R*2)/W.__GFX.shadow;
    W.__shadowFollow(90.0001, -40.0001); const a = W.__sunTarget.position.x;
    W.__shadowFollow(90.0002, -40.0002); const c = W.__sunTarget.position.x;
    o.칸단위 = (a === c) && (Math.abs(a/texel - Math.round(a/texel)) < 1e-6);
    W.__PL.x=16; W.__PL.z=22; W.__shadowFollow(16,22);
    /* ★ 제일 중요한 것 — 화면에 실제로 닿나 */
    const cv=document.createElement('canvas'); cv.width=450; cv.height=260;
    const cx=cv.getContext('2d',{willReadFrequently:true}); const N=450*260;
    const grab=()=>{ W.__drawFrame(); cx.drawImage(R.domElement,0,0,450,260);
                     return cx.getImageData(0,0,450,260).data; };
    W.__sun.castShadow=true;  R.shadowMap.needsUpdate=true; const on=grab();
    W.__sun.castShadow=false; R.shadowMap.needsUpdate=true; const off=grab();
    W.__sun.castShadow=true;  R.shadowMap.needsUpdate=true;
    let maxd=0, diff=0;
    for(let i=0;i<N;i++){ const d=Math.abs(on[i*4]-off[i*4]); if(d>maxd)maxd=d; if(d>6)diff++; }
    o.픽셀차 = diff/N*100; o.제일진함 = maxd;
    return o;
  });
  ok('그림자 지도가 구워진다', r.켜짐 && r.지도 === 2048, r.지도+'px');
  ok('★ 그림자를 드리우는 것이 백 개가 넘는다 (imesh 한 곳에서 켠다)', r.드리움 > 100, r.드리움+'개');
  ok('그림자를 받는 것도 같이 켜져 있다', r.받음 > 100, r.받음+'개');
  ok('★ 그림자 상자가 사람을 따라온다 (세상 전체를 덮으면 뭉개진다)', r.따라옴);
  ok('★ 한 칸 단위로 끊어서 옮긴다 (안 그러면 걸을 때 가장자리가 지글거린다)', r.칸단위);
  /* ★ 여기가 핵심이다. 24차까지 여러 번, 코드는 맞는데 화면은 달랐다.
     지도가 구워져도 화면에 안 닿으면 기능이 아니다. */
  ok('★ 그림자가 화면에 실제로 닿는다 (지도가 구워지는 것과 다른 말이다)',
     r.픽셀차 > 1.0 && r.제일진함 > 40, r.픽셀차.toFixed(2)+'% · 제일 진한 곳 '+r.제일진함);
  await pg.close();
}

/* ═══════ ③ 빛 번짐 ═══════ */
{
  const pg = await open('?gfx=high');
  await pg.fill('#iName','검'); await pg.click('#bSolo');
  await frames(pg, 8);
  await pg.evaluate(()=>{ const W=window; W.__introDone();
    W.__PL.x=0; W.__PL.z=17; W.__PL.yaw=Math.PI; W.__PL.pitch=-0.02; W.__goNight(); });
  await pg.evaluate(()=> new Promise(r=>{ let n=0; const t=()=>{ n++;
    if(window.__skyK()>=0.9 || n>400) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  const r = await pg.evaluate(()=>{
    const W=window, R=W.__R, o={};
    const rt = W.__bloomRT();
    o.돎 = !!rt;
    /* 절반 크기로 흐린다 — 빛 번짐은 대역폭 장사라 내장그래픽에서 제일 먼저 걸린다 */
    o.절반 = rt ? (rt.half === (rt.w>>1)) : false;
    const cv=document.createElement('canvas'); cv.width=450; cv.height=260;
    const cx=cv.getContext('2d',{willReadFrequently:true}); const N=450*260;
    const grab=()=>{ W.__drawFrame(); cx.drawImage(R.domElement,0,0,450,260);
                     return cx.getImageData(0,0,450,260).data; };
    W.__DBG().noBloom=false; const on=grab();
    W.__DBG().noBloom=true;  const off=grab();
    W.__DBG().noBloom=false;
    let maxd=0, diff=0, bOn=0, bOff=0;
    for(let i=0;i<N;i++){ const d=Math.abs(on[i*4]-off[i*4]); if(d>maxd)maxd=d; if(d>6)diff++;
      bOn+=(on[i*4]+on[i*4+1]+on[i*4+2])/3; bOff+=(off[i*4]+off[i*4+1]+off[i*4+2])/3; }
    o.픽셀차 = diff/N*100; o.제일밝음 = maxd;
    o.밝기켬 = bOn/N; o.밝기끔 = bOff/N;
    return o;
  });
  ok('빛 번짐 판이 만들어진다', r.돎);
  ok('★ 흐림은 절반 크기로 한다 (대역폭이 내장그래픽의 첫 병목이다)', r.절반);
  ok('★ 빛 번짐이 화면에 실제로 닿는다', r.픽셀차 > 0.2 && r.제일밝음 > 40,
     r.픽셀차.toFixed(2)+'% · 제일 밝아진 곳 '+r.제일밝음);
  /* ★ 이 항목이 '내가 옮겨 적은 ACES 곡선이 three 것과 같은가' 를 지킨다.
     빛 번짐을 켜면 합치기 셰이더가 톤매핑을 하고, 끄면 three 가 한다.
     곡선이 다르면 화면 전체 밝기가 통째로 달라진다 — 품질을 바꿀 때마다 색이 튄다. */
  ok('★ 켜고 끌 때 화면 전체 밝기가 안 튄다 (톤매핑 곡선이 three 와 같다)',
     Math.abs(r.밝기켬 - r.밝기끔) < 2.5, r.밝기켬.toFixed(1)+' vs '+r.밝기끔.toFixed(1));
  ok('★ 빛 번짐은 밝은 곳만 건드린다 (화면 전체가 들뜨면 안 된다)',
     r.픽셀차 < 12, r.픽셀차.toFixed(2)+'%');
  await pg.close();
}

/* ═══════ ④ 하늘 돔 · 밤 밝기 ═══════ */
{
  const pg = await open('?gfx=high');
  await pg.fill('#iName','검'); await pg.click('#bSolo');
  await frames(pg, 8);
  await pg.evaluate(()=>{ const W=window; W.__introDone();
    W.__PL.x=0; W.__PL.z=54; W.__PL.yaw=Math.PI; W.__PL.pitch=0.16; });
  await frames(pg, 6);
  const r = await pg.evaluate(async ()=>{
    const W=window, R=W.__R, o={}, d=W.__skyDome;
    o.있음 = !!d;
    o.안개밖 = d ? (d.material.fog === false) : false;   // 하늘이 안개에 물들면 지평선이 뭉개진다
    o.결 = d ? !!d.material.map : false;                 // 세로 결이 그림에 구워져 있나
    o.기본재질 = d ? !!d.material.isMeshBasicMaterial : false;  // 직접 짠 셰이더면 색이 따로 논다
    const cv=document.createElement('canvas'); cv.width=450; cv.height=260;
    const cx=cv.getContext('2d',{willReadFrequently:true}); const N=450*260;
    const mean=()=>{ W.__drawFrame(); cx.drawImage(R.domElement,0,0,450,260);
      const p=cx.getImageData(0,0,450,260).data; let s=0;
      for(let i=0;i<N;i++) s+=(p[i*4]+p[i*4+1]+p[i*4+2])/3; return s/N; };
    /* 하늘 위와 아래의 밝기가 달라야 '결' 이다 — 색 하나면 위아래가 같다 */
    W.__drawFrame(); cx.drawImage(R.domElement,0,0,450,260);
    const px = cx.getImageData(0,0,450,260).data;
    let top=0, mid=0;
    for(let x=0;x<450;x++){ top += px[(10*450+x)*4+2]; mid += px[(70*450+x)*4+2]; }
    o.위아래차 = Math.abs(top/450 - mid/450);
    /* ★ 밝기는 **놀 때 보는 각도**에서 잰다. 위 항목들은 하늘이 보여야 해서 위를 봤는데,
       하늘은 낮↔밤 색 차이가 제일 큰 곳이라 그대로 재면 62% 가 나온다(땅을 보면 77%).
       이 항목이 걱정하는 것은 '아이가 늑대를 보나' 지 하늘이 아니다 — 재는 자리를 옮긴다. */
    W.__PL.x=16; W.__PL.z=22; W.__PL.yaw=-2.52; W.__PL.pitch=-0.16;
    await new Promise(r=>{ let n=0; const t=()=>{ if(++n>4) return r(); requestAnimationFrame(t); };
      requestAnimationFrame(t); });
    o.낮 = mean();
    W.__goNight();
    await new Promise(r=>{ let n=0; const t=()=>{ n++;
      if(W.__skyK()>=0.95 || n>400) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
    o.밤 = mean();
    o.노을색 = !!W.__skyDome;
    return o;
  });
  ok('하늘 돔이 있다', r.있음);
  ok('하늘이 안개 밖에 있다 (물들면 지평선이 뭉개진다)', r.안개밖);
  ok('세로 결이 그림에 구워져 있다', r.결);
  ok('★ 기본 재질을 쓴다 (직접 짠 셰이더는 톤매핑을 안 거쳐 하늘만 색이 따로 논다)', r.기본재질);
  ok('★ 하늘 위와 아래의 밝기가 다르다 (색 하나면 같다)', r.위아래차 > 3,
     r.위아래차.toFixed(1));
  /* ★ 밤이 어두워지면 아이가 늑대를 못 본다. 이건 그래픽이 아니라 게임 문제다. */
  ok('★ 밤이 낮의 70~85% 밝기다 (어두우면 늑대를 못 본다)',
     r.밤/r.낮 > 0.70 && r.밤/r.낮 < 0.85,
     '낮 '+r.낮.toFixed(1)+' · 밤 '+r.밤.toFixed(1)+' ('+(r.밤/r.낮*100).toFixed(0)+'%)');
  await pg.close();
}

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
