/* 11차 검사 — 넷리파이 배지 자리 · HUD 겹침 · 최적화(그리기 횟수·색만 고치기) */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE = process.argv[2] || '/home/user/game/index.html';
const PORT = +(process.argv[3] || 9600);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const BW = 170, BH = 46;                 // 배지가 차지한다고 보는 자리 (왼쪽 아래)

/* ─────────── 1. 화면 배치 ─────────── */
const SIZES = [[1366,768,1],[1366,768,0],[1280,800,1],[1280,720,0],[1024,768,1],
               [1024,640,1],[1024,640,0],[900,600,1],[820,500,1],[760,420,0]];
for(const [w,h,touch] of SIZES){
  const ctx = await b.newContext({viewport:{width:w,height:h}, hasTouch:!!touch, isMobile:!!touch});
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
  await pg.waitForTimeout(700);
  const r = await pg.evaluate(([BW,BH])=>{
    const W=window; W.__G.phase='night'; W.__G.day=12;
    const bw=W.__spawnWolf(4,0); W.__G.bossId=bw.id; W.__introDone(); W.__paintHUD();
    const badge={l:0,t:innerHeight-BH,r:BW,b:innerHeight};
    const box=id=>{ const e=document.getElementById(id); if(!e) return null;
      const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return null;
      const q=e.getBoundingClientRect(); if(q.width<2||q.height<2) return null;
      return {l:q.left,t:q.top,r:q.right,b:q.bottom}; };
    const ov=(a,c)=>!(a.r<=c.l+0.5||c.r<=a.l+0.5||a.b<=c.t+0.5||c.b<=a.t+0.5);
    /* ★ 13차에서 '오늘의 임무' 줄과 '연속 명중' 칸이 생겼다 — 같이 본다.
       콤보 칸은 늘 떠 있는 게 아니므로 억지로 띄워 놓고 잰다. */
    const cb = document.getElementById('combo');
    if(cb){ cb.textContent = '🔥 12연속!  +20%'; cb.classList.add('on'); }
    const ids=['topLeft','crystalWrap','grpBar','misWrap','bossWrap','dayBox','miniWrap',
               'topRight2','dock','stick','mbtns','hint','combo'];
    const B={}; for(const id of ids){ const q=box(id); if(q) B[id]=q; }
    const pairs=[], k=Object.keys(B);
    for(let i=0;i<k.length;i++) for(let j=i+1;j<k.length;j++)
      if(ov(B[k[i]],B[k[j]])) pairs.push(k[i]+'×'+k[j]);
    const onBadge=[]; for(const id of ['stick','mbtns','dock','hint','tools'])
      { const q=box(id); if(q && ov(q,badge)) onBadge.push(id); }
    const off=[]; for(const id in B) if(B[id].l<-1||B[id].r>innerWidth+1||B[id].b>innerHeight+1) off.push(id);
    return {pairs, onBadge, off, touch:document.body.classList.contains('touch'),
            hint: !!box('hint')};
  },[BW,BH]);
  const tag = `${w}×${h}${touch?' 터치':''}`;
  ok(`${tag} — 배지 자리(왼쪽아래 ${BW}×${BH})에 걸치는 것 없음`,
     r.onBadge.length===0, r.onBadge.join(','));
  ok(`${tag} — HUD 조각끼리 안 겹침`, r.pairs.length===0, r.pairs.join(' , '));
  ok(`${tag} — 화면 밖으로 안 삐져나감`, r.off.length===0, r.off.join(','));
  ok(`${tag} — 할 일 안내가 보인다`, r.hint);
  await ctx.close();
}

/* ─────────── 2. 최적화 ─────────── */
{
  const pg = await b.newPage({viewport:{width:1180,height:720}});
  pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  await pg.fill('#iName','t'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
  await pg.waitForTimeout(1200);
  const r = await pg.evaluate(()=>{
    const W=window, G=W.__G, out={};
    /* 수정 — 인스턴스로 묶여 있나 */
    const cg = W.__scene.children.find(o=>o.isGroup && o.children.some(c=>c.isPointLight));
    W.__cam.position.set(0, W.__GY+2.2, 11); W.__cam.lookAt(0, W.__GY+2.5, 0);
    W.__cam.updateMatrixWorld();
    W.__R.info.reset(); W.__render(); const on=W.__R.info.render.calls;
    cg.visible=false; W.__R.info.reset(); W.__render(); const off=W.__R.info.render.calls;
    cg.visible=true; out.crystalCalls = on-off;
    /* 손에 든 모형 */
    for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
    W.__buyWeapon(5); W.__buyAmmo(30);
    const heldCalls = ()=>{ W.__updHeld(0.016,false,0);
      W.__R.info.reset(); W.__render(); const a=W.__R.info.render.calls;
      W.__held.visible=false; W.__R.info.reset(); W.__render(); const c=W.__R.info.render.calls;
      W.__held.visible=true; return a-c; };
    W.__selTool('mine'); out.pickCalls = heldCalls();
    W.__equipW(5); W.__setAim(true); out.sniperCalls = heldCalls(); W.__setAim(false);
    out.parts = W.__gunModels().map(g=>(g.userData.parts||[]).length);
    out.kids  = W.__gunModels().map(g=>g.children.length);
    /* 건물 — 색만 고치기 */
    W.__clear();
    const d=W.__DIRS[0]; G.me.g=0;
    for(let pp=-8; pp<=8; pp+=0.5){
      const x=Math.round(d.dx*42-d.dz*pp), z=Math.round(d.dz*42+d.dx*pp);
      if(W.__canPlace('swall',x,z)===null) W.__place('swall',x,z); }
    for(const [t,rr,pp] of [['arrow',36,-4],['ice',33,5],['barr',24,-3]]){
      const x=Math.round(d.dx*rr-d.dz*pp), z=Math.round(d.dz*rr+d.dx*pp);
      if(W.__canPlace(t,x,z)===null) W.__place(t,x,z); }
    W.__rebuild();
    const stru=[...W.__STRU.values()];
    out.stru = stru.length;
    const hurt = stru.filter((o,i)=>i%3===0);
    for(const o of hurt){ o.hp=o.mx*(0.15+0.7*((o.x*7+o.z*13)%10)/10); W.__struTint.add(o); }
    out.shapeClean = (W.__struDirty()===false);
    W.__tint();
    out.queueEmpty = (W.__struTint.size===0);
    const snap=new Map();
    for(const [k,m] of W.__struMeshes) if(m.instanceColor && m.count)
      snap.set(k, Array.from(m.instanceColor.array.slice(0, m.count*3)));
    W.__rebuild();
    let diff=0, cells=0;
    for(const [k,m] of W.__struMeshes){ const a=snap.get(k); if(!a||!m.instanceColor) continue;
      for(let i=0;i<a.length;i++){ cells++; if(Math.abs(a[i]-m.instanceColor.array[i])>1e-5) diff++; } }
    out.tintDiff=diff; out.tintCells=cells;
    const bench=(n,f)=>{ for(let i=0;i<3;i++) f(); const t0=performance.now();
      for(let i=0;i<n;i++) f(); return (performance.now()-t0)/n; };
    out.mReb = bench(20, ()=>W.__rebuild());
    out.mTint = bench(200, ()=>{ for(const o of hurt) W.__struTint.add(o); W.__tint(); });
    /* 부수면 표가 어긋나지 않게 통째로 다시 만들기로 돌아가나 */
    W.__del(stru[1].id);
    out.delShape = (W.__struDirty()===true);
    out.delQueue = (W.__struTint.size===0);
    /* 길찾기 — 이웃 목록이 납작한 배열로 준비돼 있나 (같은 답을 내야 한다) */
    W.__rebuild(); W.__flow();
    const c1=[...W.__fCost].filter(v=>isFinite(v)).length;
    W.__flow();
    const c2=[...W.__fCost].filter(v=>isFinite(v)).length;
    out.flowStable = (c1===c2 && c1>500); out.flowCells=c1;
    return out;
  });
  ok('★ 수정이 한 덩이로 묶여 그리기 12번 이하', r.crystalCalls <= 12, r.crystalCalls+'번');
  ok('★ 손에 든 곡괭이가 그리기 3번 이하', r.pickCalls <= 3, r.pickCalls+'번');
  ok('★ 손에 든 저격총이 그리기 6번 이하', r.sniperCalls <= 6, r.sniperCalls+'번');
  ok('★ 총 모형이 재질끼리 합쳐져 있다',
     r.kids.every((n,i)=>n < r.parts[i]), r.kids.join('/')+' ← '+r.parts.join('/'));
  ok('체력만 바뀌면 통째로 다시 만들기를 예약하지 않는다', r.shapeClean);
  ok('색칠하고 나면 대기 목록이 빈다', r.queueEmpty);
  ok('★ 색만 고친 결과 = 통째로 다시 만든 결과',
     r.tintDiff===0, r.tintCells+'칸 중 다른 곳 '+r.tintDiff);
  ok('★ 색만 고치기가 10배 넘게 빠르다', r.mReb/r.mTint > 10,
     r.mReb.toFixed(3)+'ms → '+r.mTint.toFixed(3)+'ms ('+(r.mReb/r.mTint).toFixed(0)+'배)');
  ok('건물을 부수면 통째로 다시 만들기로 돌아간다', r.delShape);
  ok('건물을 부수면 색칠 대기 목록을 비운다', r.delQueue);
  ok('★ 길찾기가 같은 답을 두 번 낸다 (납작한 이웃 목록으로 바꾼 뒤에도)',
     r.flowStable, r.flowCells+'칸');
  await pg.close();
}

let pass=0, fail=0;
for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); c?pass++:fail++; }
console.log('\n' + (fail?`${fail}개 실패 / `:'') + `${pass}항목 통과`);
console.log(errs.length ? '\n오류: '+errs.slice(0,6).join(' | ') : '\n(오류 없음)');
await b.close(); srv.close();
process.exit(fail?1:0);
