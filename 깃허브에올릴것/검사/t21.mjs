/* 17차h 검사 — 농장 팻말·대문·크기 자람 · 통과 못 함 · 상인이 살아 있음 · 상점에서 동물 사기
   ★ 눈으로 "좀 이상하네" 하고 넘긴 것들을 자로 잰다.
     팻말이 90도 돌아 있던 것도, 문이 반대쪽에 뚫려 있던 것도
     코드만 봐서는 셋 다 맞아 보였고 스크린샷으로도 몇 판을 그냥 지나쳤다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12100);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1500);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ① 번호판 — 판 앞면에 붙어 있고 왼쪽에서 오른쪽으로 읽힌다 ═══════
   ★ 값을 검사에 베끼지 않는다. 게임의 DIGIT 표와 실제 인스턴스 자리를 맞대 본다. */
const sign = await pg.evaluate(()=>{
  const W=window, X=W.__FARM_X(), Z=W.__FARM_Z(), o={모둠:[]};
  const bank = W.__banks.get('farmGlow');
  o.뱅크있음 = !!bank;
  if(!bank) return o;
  /* ★ 3·4모둠 농장은 서로 가깝다. 반지름으로만 거르면 옆 농장 팻말이 섞여 들어와
     칸이 3개가 아니라 12개로 나온다 — 게임이 아니라 검사가 틀린 것이다.
     칸마다 '제일 가까운 농장' 을 찾아 그쪽에 붙인다. */
  const mine = new Map();
  for(const m of bank.ms){
    const e=m.elements, x=e[12], y=e[13], z=e[14];
    let bg=-1, bd=1e9;
    for(let g=0; g<5; g++){ const d=Math.hypot(x-X[g], z-Z[g]); if(d<bd){bd=d; bg=g;} }
    if(!mine.has(bg)) mine.set(bg, []);
    mine.get(bg).push([x,y,z]);
  }
  for(let g=0; g<5; g++){
    const cx=X[g], cz=Z[g], openA=Math.atan2(-cz,-cx);
    const fx=Math.cos(openA), fz=Math.sin(openA);      // 수정 쪽(판이 보는 쪽)
    const rx=Math.sin(openA), rz=-Math.cos(openA);     // 보는 사람의 오른쪽
    const cells=[];
    for(const [x,y,z] of (mine.get(g)||[])){
      const dx=x-cx, dz=z-cz;
      const fwd = dx*fx + dz*fz;
      if(fwd < 1) continue;                            // 헛간 다락 창은 뒤쪽이다
      cells.push({r:+(dx*rx+dz*rz).toFixed(3), y:+y.toFixed(3), fwd:+fwd.toFixed(2)});
    }
    /* 세 단계가 다 구워져 있으므로 같은 글자가 세 번 나온다 — 자리로 묶는다 */
    const rs=[...new Set(cells.map(c=>c.r))].sort((a,b)=>a-b);
    const ys=[...new Set(cells.map(c=>c.y))].sort((a,b)=>b-a);
    const grid = ys.map(y=> rs.map(r=> cells.some(c=>c.y===y&&c.r===r) ? '1':'0').join(''));
    o.모둠.push({g, 글자:grid, 판앞으로:cells.length?Math.min(...cells.map(c=>c.fwd)):0,
                 칸수:rs.length, 줄수:ys.length});
  }
  o.표 = W.__DIGIT;
  return o;
});
const digOK = sign.모둠.every(m => JSON.stringify(m.글자) === JSON.stringify(sign.표[m.g+1]));
ok('★ 번호판 숫자가 모둠 번호 그대로 그려진다 (거울상이 아니다)', digOK,
   sign.모둠.map(m=>(m.g+1)+':'+(JSON.stringify(m.글자)===JSON.stringify(sign.표[m.g+1])?'맞음':m.글자.join('/'))).join(' '));
ok('★ 숫자가 3×5 칸을 다 쓴다 (판 밖으로 흩어지지 않았다)',
   sign.모둠.every(m=>m.칸수===3 && m.줄수===5),
   sign.모둠.map(m=>m.칸수+'×'+m.줄수).join(' '));
ok('★ 숫자가 판의 수정 쪽 면에 붙어 있다 (뒤통수가 아니다)',
   sign.모둠.every(m=>m.판앞으로 > 1.5), '제일 가까운 것 '+
   Math.min(...sign.모둠.map(m=>m.판앞으로)).toFixed(2)+'칸 앞');

/* ═══════ ② 대문 — 수정 쪽이 뚫려 있다 ═══════ */
const door = await pg.evaluate(()=>{
  const W=window, X=W.__FARM_X(), Z=W.__FARM_Z(), o={};
  const y = W.__PL.y;
  const g = 0, cx=X[g], cz=Z[g], R=W.__farmR2(g), openA=Math.atan2(-cz,-cx);
  const on = (th)=> W.__solidHit(cx+Math.cos(openA+th)*R, cz+Math.sin(openA+th)*R, W.__farmY?0:0);
  /* 바닥 높이는 우리 바닥과 같다 — 울타리 높이 아래에서 본다 */
  const y0 = W.__terrAt(Math.round(cx), Math.round(cz));
  const hit = (th)=> W.__solidHit(cx+Math.cos(openA+th)*R, cz+Math.sin(openA+th)*R, y0+0.3);
  o.문가운데 = hit(0);
  o.문옆 = [hit(0.15), hit(-0.15)];
  o.울타리 = [hit(1.2), hit(-1.2), hit(2.6), hit(Math.PI)];
  o.뛰어넘기 = W.__solidHit(cx+Math.cos(openA+1.2)*R, cz+Math.sin(openA+1.2)*R, y0+1.4);
  return o;
});
ok('★ 대문(수정 쪽)은 뚫려 있다 — 아이가 정면으로 들어간다',
   !door.문가운데 && !door.문옆[0] && !door.문옆[1]);
ok('★ 나머지 울타리는 통과 못 한다', door.울타리.every(Boolean),
   door.울타리.map(v=>v?'막힘':'뚫림').join(' '));
ok('★ 울타리는 뛰어넘을 수 있다 (아이들이 제일 먼저 해 보는 것이다)', !door.뛰어넘기);

/* ═══════ ③ 헛간 · 좌판 · 화덕도 통과 못 한다 ═══════ */
const solid = await pg.evaluate(()=>{
  const W=window, o={};
  const S=W.__SHOP(), F=W.__FORGE();
  const sy=W.__terrAt(Math.round(S.x),Math.round(S.z)), fy=W.__terrAt(Math.round(F.x),Math.round(F.z));
  o.좌판 = W.__solidHit(S.x, S.z, sy+0.5);
  o.좌판앞 = W.__solidHit(S.x+Math.cos(S.a)*S.near, S.z+Math.sin(S.a)*S.near, sy+0.5);
  o.화덕 = W.__solidHit(F.x, F.z, fy+0.5);
  o.화덕앞 = W.__solidHit(F.x+Math.cos(F.a)*F.near, F.z+Math.sin(F.a)*F.near, fy+0.5);
  /* 헛간 — 우리 뒤(수정 반대쪽) */
  const X=W.__FARM_X(), Z=W.__FARM_Z(), g=0, cx=X[g], cz=Z[g];
  const R=W.__farmR2(g), openA=Math.atan2(-cz,-cx), y0=W.__terrAt(Math.round(cx),Math.round(cz));
  o.헛간 = W.__solidHit(cx-Math.cos(openA)*(R+1.8), cz-Math.sin(openA)*(R+1.8), y0+1.0);
  o.막는자리수 = W.__SOLID().length;
  return o;
});
ok('★ 상인 좌판을 뚫고 지나가지 못한다', solid.좌판);
ok('★ 그래도 좌판 앞에는 설 수 있다 (거래 거리 안이 막히면 못 산다)', !solid.좌판앞);
ok('★ 대장간 화덕을 뚫고 지나가지 못한다', solid.화덕);
ok('★ 화덕 앞에는 설 수 있다', !solid.화덕앞);
ok('★ 먹이 창고(헛간)를 뚫고 지나가지 못한다', solid.헛간, '막는 자리 '+solid.막는자리수+'곳');

/* ═══════ ④ 실제로 몸이 안 통과한다 — 걸어서 밀어 본다 ═══════ */
const walk = await pg.evaluate(()=>{
  const W=window, X=W.__FARM_X(), Z=W.__FARM_Z(), g=0;
  const cx=X[g], cz=Z[g], R=W.__farmR2(g), openA=Math.atan2(-cz,-cx);
  const y0=W.__terrAt(Math.round(cx),Math.round(cz));
  /* 우리 옆구리(울타리) 밖에 서서 우리 한가운데로 걸어 들어가 본다 */
  const th = openA + 1.4;
  const sx = cx+Math.cos(th)*(R+1.4), sz = cz+Math.sin(th)*(R+1.4);
  W.__PL.x=sx; W.__PL.z=sz; W.__PL.y=y0; W.__PL.vy=0;
  W.__PL.yaw = Math.atan2(sx-cx, sz-cz);      // 우리 한가운데를 보고
  W.__setKey && W.__setKey('w', true);
  const o={};
  /* 앞으로 밀어 본다 — updPlayer 를 직접 여러 번 돌린다 */
  W.__KEY && (W.__KEY['w']=true);
  for(let i=0;i<120;i++) W.__updPlayer(1/30);
  W.__KEY && (W.__KEY['w']=false);
  o.울타리쪽 = +Math.hypot(W.__PL.x-cx, W.__PL.z-cz).toFixed(2);
  o.우리반너비 = R;
  /* 이번엔 대문으로 — 같은 거리를 걸어 들어간다 */
  const dx = cx+Math.cos(openA)*(R+1.4), dz = cz+Math.sin(openA)*(R+1.4);
  W.__PL.x=dx; W.__PL.z=dz; W.__PL.y=y0; W.__PL.vy=0;
  W.__PL.yaw = Math.atan2(dx-cx, dz-cz);
  W.__KEY && (W.__KEY['w']=true);
  /* ★ 끝까지 걸으면 우리를 가로질러 반대편 울타리에 붙는다 —
     그러면 '못 들어갔다' 와 거리가 비슷해져서 검사가 아무것도 못 가린다.
     걸어가는 동안 제일 가까웠던 거리를 본다. */
  let near = 1e9;
  for(let i=0;i<120;i++){ W.__updPlayer(1/30);
    near = Math.min(near, Math.hypot(W.__PL.x-cx, W.__PL.z-cz)); }
  W.__KEY && (W.__KEY['w']=false);
  o.대문쪽 = +near.toFixed(2);
  return o;
});
ok('★ 울타리 쪽으로 걸으면 밖에서 멈춘다 (예전엔 그냥 통과했다)',
   walk.울타리쪽 > walk.우리반너비 - 0.1,
   '우리 한가운데서 '+walk.울타리쪽+'칸 (반너비 '+walk.우리반너비+')');
ok('★ 대문 쪽으로 걸으면 우리 안까지 들어간다', walk.대문쪽 < 0.8,
   '우리 한가운데까지 '+walk.대문쪽+'칸');

/* ═══════ ⑤ 우리가 마리수에 따라 커진다 ═══════ */
const grow = await pg.evaluate(()=>{
  const W=window, o={단계:[], 반너비:[], 짚칸:[], 여물통:[]};
  const g = W.__G.me.g, f = W.__G.farm[g];
  const 짚 = ()=>{ let n=0; const S=W.__farmParts()[g];
    for(let s=0;s<S.length;s++) for(const h of S[s].gnd){
      const bk=W.__banks.get(h[0]); const m=bk.chunks[bk.map[h[1]*2]];
      if(!m) continue;
      const e=new Array(16); m.instanceMatrix.array.slice(bk.map[h[1]*2+1]*16,
        bk.map[h[1]*2+1]*16+16).forEach((v,i)=>e[i]=v);
      if(e[0] !== 0) n++;                    // 크기 0 이면 감춘 것
    }
    return n; };
  for(const n of [0, 3, 6]){
    f.hen = Math.min(n,2); f.pig = Math.max(0, Math.min(n-2, 2)); f.cow = Math.max(0, n-4);
    W.__farmDirty(true); W.__applyFarmStage(); W.__solidRebuild();
    o.단계.push(W.__farmVis()[g]);
    o.반너비.push(W.__farmR2(g));
    o.짚칸.push(짚());
    o.여물통.push(W.__farmSpotXZ(g,'feed').map(v=>+v.toFixed(2)));
  }
  f.hen=0; f.pig=0; f.cow=0; W.__farmDirty(true); W.__applyFarmStage(); W.__solidRebuild();
  return o;
});
ok('★ 마리수가 늘면 우리 단계가 올라간다', grow.단계[0] < grow.단계[1] && grow.단계[1] < grow.단계[2],
   '0마리→'+grow.단계[0]+' · 3마리→'+grow.단계[1]+' · 6마리→'+grow.단계[2]);
ok('★ 울타리가 실제로 밖으로 나간다', grow.반너비[0] < grow.반너비[1] && grow.반너비[1] < grow.반너비[2],
   grow.반너비.join(' → ')+'칸');
ok('★ 마당(짚 깐 바닥)도 같이 넓어진다', grow.짚칸[0] < grow.짚칸[1] && grow.짚칸[1] < grow.짚칸[2],
   grow.짚칸.join(' → ')+'칸');
ok('★ 일하는 자리(여물통)도 우리를 따라 움직인다',
   grow.여물통[0][0] !== grow.여물통[2][0] || grow.여물통[0][1] !== grow.여물통[2][1],
   JSON.stringify(grow.여물통[0])+' → '+JSON.stringify(grow.여물통[2]));

/* ═══════ ⑥ 상점(상인)에서 동물을 살 수 있다 ═══════ */
const shop = await pg.evaluate(()=>{
  const W=window, o={};
  const r = W.__G.res[W.__G.me.g];
  r.w=0; r.s=0; r.g=0;
  W.__shopTab('f'); W.__buildShopUI();
  const list = document.getElementById('shopList');
  o.모자랄때글 = list.innerText;
  o.모자랄때단추 = [...list.querySelectorAll('button')].map(b=>[b.textContent, b.disabled]);
  r.w=999; r.s=999; r.g=999;
  W.__buildShopUI();
  const cards = [...list.querySelectorAll('.sItem')];
  o.칸이름 = cards.map(d=>d.querySelector('.sn').textContent.trim());
  o.살수있는단추 = cards.filter(d=>!d.querySelector('button').disabled).length;
  const before = W.__farmCount(W.__G.farm[W.__G.me.g]);
  cards[0].querySelector('button').click();
  o.늘었나 = W.__farmCount(W.__G.farm[W.__G.me.g]) - before;
  /* 사고 나면 그 자리에서 화면이 다시 그려져야 한다 */
  o.다시그림 = document.getElementById('shopList').innerText.includes('마리');
  const f = W.__G.farm[W.__G.me.g]; f.hen=0; f.pig=0; f.cow=0;
  W.__farmDirty(true); W.__applyFarmStage();
  return o;
});
ok('★ 상인 가게 🧺 농장 칸에서 동물을 살 수 있다 (예전엔 파는 것만 있었다)',
   shop.칸이름.some(n=>n.startsWith('닭')) && shop.칸이름.some(n=>n.startsWith('소')),
   shop.칸이름.join(' · '));
ok('★ 자원이 넉넉하면 살 수 있는 단추가 열린다', shop.살수있는단추 >= 3, shop.살수있는단추+'개');
ok('★ 눌렀을 때 진짜로 우리에 들어간다', shop.늘었나 === 1);
ok('★ 산 뒤에 가게 화면이 그 자리에서 다시 그려진다', shop.다시그림);
ok('★ 못 살 때는 왜 못 사는지 화면에 나온다 (단추만 죽어 있으면 고장난 줄 안다)',
   /더 모아야 해요/.test(shop.모자랄때글), shop.모자랄때글.split('\n').filter(l=>/더 모아야/.test(l))[0]||'없음');

/* ═══════ ⑦ 농장 화면도 같은 것을 쓴다 ═══════ */
const farmUI = await pg.evaluate(()=>{
  const W=window, o={};
  const r = W.__G.res[W.__G.me.g]; r.w=0; r.s=0; r.g=0;
  W.__buildFarmUI();
  o.글 = document.getElementById('farmList').innerText;
  r.w=999; r.s=999; r.g=999; W.__buildFarmUI();
  o.넉넉할때 = [...document.querySelectorAll('#farmList button')].filter(b=>!b.disabled).length;
  return o;
});
ok('★ 농장 화면에도 모자란 자원이 적힌다', /더 모아야 해요/.test(farmUI.글));
ok('★ 농장 화면에서도 살 수 있다', farmUI.넉넉할때 >= 3, farmUI.넉넉할때+'개');

/* ═══════ ⑧ 상인·대장장이가 움직인다 ═══════ */
const npc = await pg.evaluate(async ()=>{
  const W=window, o={};
  const m = W.__N_body();
  const snap = ()=> Array.from(m.instanceMatrix.array.slice(0, m.count*16));
  W.__drawNPCs(0);
  const a = snap();
  W.__drawNPCs(0.7);
  const b2 = snap();
  let moved = 0;
  for(let i=0;i<a.length;i++) if(Math.abs(a[i]-b2[i]) > 1e-4) moved++;
  o.움직인값 = moved;
  o.조각수 = m.count;
  o.칸 = m.instanceMatrix.count;
  o.넘침 = m.count > m.instanceMatrix.count;
  /* 고개 — 내가 왼쪽에 섰을 때와 오른쪽에 섰을 때 머리 자리가 달라야 한다 */
  const N = W.__NPCS()[0];
  const side = (s)=>{
    W.__PL.x = N.x + Math.cos(Math.atan2(N.z,N.x))*4 + s*3;
    W.__PL.z = N.z + Math.sin(Math.atan2(N.z,N.x))*4;
    W.__drawNPCs(0);
    /* ★ 마지막 조각은 대장장이 것이다 — 상인을 보려면 상인의 머리 조각을 골라야 한다.
       ★ 그리고 자리(x,z)만 보면 안 된다. 머리 한가운데는 목 축 위라 아무리 돌려도
         자리가 안 바뀐다 — 실제로 이 검사가 그것 때문에 한 번 빨개졌다.
         행렬을 통째로 보면 '돌았는지' 가 그대로 나온다. */
    const i = N.parts.findIndex(P=>P[0]===1);
    return Array.from(m.instanceMatrix.array.slice(i*16, i*16+16));
  };
  const L = side(-1), Rr = side(1);
  let dsum = 0;
  for(let i=0;i<16;i++) dsum += Math.abs(L[i]-Rr[i]);
  o.고개차 = +dsum.toFixed(3);
  return o;
});
ok('★ 상인·대장장이가 뱅크에서 나와 움직이는 메시가 됐다', npc.조각수 > 30, npc.조각수+'조각');
ok('★ 시간이 지나면 실제로 움직인다 (숨쉬기·망치질·손 흔들기)', npc.움직인값 > 20,
   npc.움직인값+'개 값이 바뀜');
ok('★ 아이가 선 쪽으로 고개를 돌린다', npc.고개차 > 0.05, '머리 행렬이 '+npc.고개차+'만큼 바뀜');
ok('★ 그릴 칸이 안 넘친다 (넘치면 조각이 조용히 사라진다)', !npc.넘침,
   npc.조각수+' / '+npc.칸);

/* ═══════ ⑨ 우리 앞에 서면 H 안내가 뜬다 ═══════ */
const tip = await pg.evaluate(()=>{
  const W=window, o={};
  const g = W.__G.me.g, [x,z] = W.__farmSpotXZ(g,'buy');
  W.__PL.x = x; W.__PL.z = z;
  W.__paintHUD ? W.__paintHUD() : 0;
  o.가까이 = document.getElementById('farmTip').classList.contains('on');
  W.__PL.x = 0; W.__PL.z = 0;
  W.__paintHUD ? W.__paintHUD() : 0;
  o.멀리 = document.getElementById('farmTip').classList.contains('on');
  o.있음 = !!document.getElementById('farmTip');
  return o;
});
ok('★ 우리 앞에 서면 "H 를 눌러 농장 열기" 안내가 뜬다', tip.있음 && tip.가까이);
ok('★ 멀어지면 안내가 사라진다', !tip.멀리);

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
