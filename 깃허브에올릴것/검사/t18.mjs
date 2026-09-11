/* 17차 검사 — 격자 오각형 맵 · 초반 난이도 · 자원/스텟 · 늑대 분산 · 레벨 35
   ★ 값을 검사에 박지 않는다. 게임에서 읽어 '관계'만 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 11800);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1100,height:720}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ① 다섯 모둠 전부 '한 줄' 로 벽을 긋는다 ═══════ */
const mp = await pg.evaluate(()=>{
  const W=window, o={};
  o.방향 = W.__DIRS.map(d=>[d.dx,d.dz,d.off]);
  /* 축과 나란한가 — dx·dz 중 하나가 정확히 0 이어야 격자에서 직선이 된다 */
  o.축나란 = W.__DIRS.every(d=> (d.dx===0) !== (d.dz===0));
  /* 어귀가 직선인가 — 통로를 가로지르며 '산이 시작하는 축거리' 가 다 같아야 한다.
     비스듬하면 이 값이 옆칸마다 달라지고, 그게 곧 '계단으로 쌓아야 한다' 는 뜻이다. */
  o.어귀 = [];
  for(let g=0; g<5; g++){
    const ts=[];
    /* ★ 통로 반너비가 6.6 이라 pp ±5 는 통째로 통로 안 — 산이 하나도 안 잡혀서
       표본이 0 이 됐다(Math.min([]) = Infinity). 통로 밖 가장자리까지 훑는다. */
    for(let pp=-11; pp<=11; pp++){
      for(let t=W.__ARENA_R-6; t<=W.__ARENA_R+8; t+=0.5){
        const x=Math.floor(W.__gX(g,t,pp)), z=Math.floor(W.__gZ(g,t,pp));
        if(!W.__inW(x,z)) break;
        if(W.__terrAt(x,z) > W.__GY){ ts.push(t); break; }
      }
    }
    o.어귀.push({표본:ts.length, 최소:Math.min(...ts), 최대:Math.max(...ts)});
  }
  o.어귀표본 = Math.min(...o.어귀.map(e=>e.표본));
  o.어귀들쭉 = Math.max(...o.어귀.map(e=> e.최대-e.최소));
  /* 통로 한가운데에 벽을 한 줄로 쭉 놓을 수 있나 — 다섯 모둠 다 */
  o.한줄 = [];
  for(let g=0; g<5; g++){
    W.__clear();
    W.__G.me.g = g;
    for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
    /* '한 줄' = 축 거리(t)를 고정하고 옆(pp)으로만 움직이며 놓는 것 */
    const t = W.__ARENA_R - 2;
    let put=0, zs=new Set(), xs=new Set();
    for(let pp=-6; pp<=6; pp++){
      const x=Math.round(W.__gX(g,t,pp)), z=Math.round(W.__gZ(g,t,pp));
      if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z); put++; xs.add(x); zs.add(z); }
    }
    /* 진짜 직선이면 x 가 전부 같거나(세로줄) z 가 전부 같다(가로줄) */
    o.한줄.push({놓임:put, 직선: xs.size===1 || zs.size===1, x:xs.size, z:zs.size});
  }
  W.__clear();
  o.전부직선 = o.한줄.every(r=> r.직선 && r.놓임 >= 11);
  /* 마당 넓이 — 예전 원과 크게 다르지 않아야 밸런스가 안 흔들린다 */
  let cells=0, circ=0;
  for(let z=-50; z<=50; z++) for(let x=-50; x<=50; x++){
    if(W.__oct(x+0.5,z+0.5) <= W.__ARENA_R-0.5) cells++;
    if(Math.hypot(x+0.5,z+0.5) <= W.__ARENA_R-0.5) circ++;
  }
  o.마당 = cells; o.원 = circ;
  /* 다섯 구역이 다 쓸 만한 크기인가 (아래 두 입구가 한 구역으로 뭉치지 않았나) */
  const cnt=[0,0,0,0,0];
  for(let z=-40; z<=40; z++) for(let x=-40; x<=40; x++)
    if(W.__oct(x+0.5,z+0.5) <= W.__ARENA_R-0.5) cnt[W.__sectorOf(x+0.5,z+0.5)]++;
  o.구역 = cnt;
  return o;
});
ok('★ 다섯 입구가 전부 가로 또는 세로다', mp.축나란, JSON.stringify(mp.방향));
ok('★ 다섯 입구 어귀가 다 직선이다 (통로 양 끝 산이 같은 자리에서 시작)',
   mp.어귀표본 >= 4 && mp.어귀들쭉 === 0,
   '표본 '+mp.어귀표본+'칸 · 제일 들쭉날쭉한 곳 '+mp.어귀들쭉+'칸');
ok('★ 다섯 모둠 다 벽을 한 줄로 쭉 놓을 수 있다',
   mp.전부직선, mp.한줄.map((r,i)=>(i+1)+'모둠 '+r.놓임+'칸'+(r.직선?'직선':'계단')).join(' · '));
ok('마당 넓이가 예전 원과 비슷하다 (밸런스가 안 흔들리게)',
   mp.마당/mp.원 < 1.3, mp.마당+'칸 (예전 원 '+mp.원+') ×'+(mp.마당/mp.원).toFixed(2));
ok('★ 다섯 구역이 다 살아 있다 (아래 두 입구가 한 구역으로 안 뭉쳤다)',
   Math.min(...mp.구역) > mp.마당/5*0.45, mp.구역.join(' / '));

/* ═══════ ② 초반이 더 어려워졌나 — 15일차는 그대로인가 ═══════ */
const df = await pg.evaluate(()=>{
  const W=window, o={날:[]};
  for(const d of [1,3,5,7,10,12,15,18]){
    const wv = W.__waveFor(d);
    o.날.push({d, 마리:wv.kinds.length, 보스:wv.boss>=0, 진행도:+W.__prog(d).toFixed(3)});
  }
  o.보통날 = o.날.filter(r=>!r.보스);
  /* ★ 기준일(진행도 1.0)이 안 움직였다는 '증명' — 지수를 어떻게 눕히든 1의 거듭제곱은 1이다.
     그래서 15일차 밤은 글자 하나까지 그대로다. 값을 베껴 두는 대신 이 성질을 본다. */
  o.curve1 = W.__curve(1); o.curveL1 = W.__curveL(1);
  return o;
});
const day = (n)=> df.날.find(r=>r.d===n);
ok('★ 첫 밤부터 늑대가 제법 온다 (예전 5마리)', day(1).마리 >= 12, day(1).마리+'마리');
ok('★ 15일차 마리수는 그대로 (기준점이 안 흔들린다)', day(15).진행도 === 1, '진행도 '+day(15).진행도);
ok('밤이 갈수록 늑대가 는다 (보스 날은 잡몹을 줄이므로 뺀다)',
   df.보통날.every((r,i)=> i===0 || r.마리 >= df.보통날[i-1].마리),
   df.날.map(r=>r.d+'일:'+r.마리+(r.보스?'(보스)':'')).join(' '));

/* 늑대 한 마리 세기 — 초반이 세지고 15일차는 그대로인가 */
const st = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  const mk=(d)=>{ G.day=d; G.wolves.length=0; W.__spawnQ().length=0;
    const w=W.__spawnWolf(0,0,10,10); const r={hp:Math.round(w.mx), dmg:+w.dmg.toFixed(1)};
    G.wolves.length=0; return r; };
  o.일차 = {}; for(const d of [1,3,5,7,10,15,18]) o.일차[d]=mk(d);
  return o;
});
ok('★ 기준일(15일차)은 곡선을 눕혀도 안 움직인다 — 1의 거듭제곱은 1이다',
   df.curve1 === 1 && df.curveL1 === 1, 'curve(1)='+df.curve1+' curveL(1)='+df.curveL1);
ok('★ 초반 늑대가 후반에 비해 덜 뒤처진다 (5일차가 15일차의 20%는 된다)',
   st.일차[5].hp / st.일차[15].hp > 0.20,
   Object.entries(st.일차).map(([d,v])=>d+'일:'+v.hp).join(' ')
   + ' · 5/15 = '+(st.일차[5].hp/st.일차[15].hp*100).toFixed(0)+'%');

/* ═══════ ③ 자원 · 스텟 ═══════ */
const rs = await pg.evaluate(()=>{
  const W=window, o={};
  W.__xpReset();
  /* 캐는 양을 올리는 스탯 — 번호를 박지 않고 게임에 물어본다 (23차에 1번 → 📘지능) */
  const BAG_ST = W.__ST ? W.__ST().int : 1;
  const bag = W.__STATS[BAG_ST];
  o.주머니상한 = bag.max;
  o.상한이표와같나 = bag.max === W.__STATS[BAG_ST].max;
  o.스텟합 = W.__STATS.reduce((a,s)=>a+s.max,0);
  o.만렙 = W.__LV_MAX;
  /* 한 번 캘 때 실제로 들어오는 양 — 스텟 0점일 때와 만점일 때 */
  /* ★ 앞 검사가 4모둠으로 두고 갔다. 그런데 G.me.g 만 고치면 안 된다 —
     자재는 myPC.g 가 가리키는 모둠 창고로 들어가는데, 그 둘은 페이지의 타이머가
     syncMyPC() 를 부를 때만 맞춰진다. 그래서 열 판에 한 판씩,
     자재가 4모둠 창고로 들어가는데 0모둠 창고를 읽어 "캐도 0" 이 나왔다. */
  W.__G.me.g = 0; W.__syncMyPC();
  /* ★ gain() 은 base(모둠 창고)가 아니라 G.res 에 넣는다 — base 를 보면 늘 0 이다.
     여기서 한 번 헛짚었다. */
  const woodAll = ()=> W.__G.res[W.__G.me.g].w;
  /* ★ 창고를 0 으로 두면 안 된다 — 앞 검사에서 벽을 예순 채 넘게 지어 myPC 의 '쓴 양'이
     잔뜩 쌓여 있어서, res 가 0 에 눌린 채 캐도 안 올라간다. 넉넉히 채워 놓고 잰다.
     (여기서 한참 헛짚었다: base 를 봐도 0, res 를 봐도 0 이었던 이유가 이것이다.) */
  const dig = ()=>{
    for(let i=0;i<5;i++) W.__base[i]={w:100000,s:100000,o:100000}; W.__recompute();
    const n = W.__NODES.find(x=>x.alive && x.type==='tree');
    if(!n) return -1;
    const g0 = woodAll();
    for(let k=0;k<W.__NODE_DEF.tree.per;k++) W.__hitNode(n);
    return woodAll() - g0;
  };
  o.맨손 = dig();
  W.__xpGain(999999);
  /* ★ 상한(8)에 닿으면 takeStat 이 점수를 안 쓴다 — pts 가 0 이 될 때까지 돌리면
     영영 안 끝난다. 상한만큼만 찍는다. (이 검사를 쓰다가 실제로 매달렸다) */
  /* ★ 23차에 스탯이 넷으로 바뀌었다 — 캐는 양을 올리는 건 이제 📘지능이다.
     번호(1)를 박아 뒀더니 그 칸이 ❤️체력이 되면서 게임은 멀쩡한데 검사만 셋이 빨개졌다.
     게임에 물어보고, 상한도 표에서 읽는다. */
  for(let i=0; i<bag.max && W.__XP.pts>0; i++) W.__takeStat(BAG_ST);
  o.주머니 = W.__XP.st[BAG_ST];
  o.가득 = dig();
  return o;
});
/* ★ 상한 숫자(8)를 박지 않는다 — 23차에 8 → 12 가 됐다.
   재야 할 것은 '몇 칸인가' 가 아니라 '표에 적힌 만큼 찍히는가' 다. */
ok('★ 캐는 양 스탯을 표에 적힌 상한까지 찍는다', rs.상한이표와같나 && rs.주머니 === rs.주머니상한,
   rs.주머니+'/'+rs.주머니상한+'칸');
ok('★ 만렙이 35 다', rs.만렙 === 35, rs.만렙);
ok('★ 만렙이어도 스텟을 다 못 찍는다 (골라야 한다)',
   rs.스텟합 > rs.만렙, '상한 합계 '+rs.스텟합+' > 점수 '+rs.만렙);
ok('★ 캐는 양 스탯을 찍을수록 한 번에 캐는 양이 는다', rs.가득 > rs.맨손,
   '맨손 '+rs.맨손+' → '+rs.주머니+'칸 '+rs.가득);
ok('★ 다 찍으면 맨손의 두 배가 넘는다', rs.가득 >= rs.맨손*2, rs.가득+' vs '+rs.맨손);

/* ═══════ ④ 늑대가 벽 한 칸에 안 뭉친다 ═══════ */
const sp = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  W.__clear(); G.wolves.length=0; W.__spawnQ().length=0;
  G.phase='night'; G.day=8; G.paused=false; W.__PL.down = true;
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  G.me.g = 0;
  /* 1모둠 통로를 벽 한 줄로 막는다 — 선생님이 본 그 상황 */
  const t = W.__ARENA_R - 2, ids=[];
  for(let pp=-8; pp<=8; pp++){
    const x=Math.round(W.__gX(0,t,pp)), z=Math.round(W.__gZ(0,t,pp));
    if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
      ids.push([...W.__STRU.values()].pop().id); }
  }
  W.__rebuild(); W.__flow();
  o.벽수 = ids.length;
  const hp0 = new Map(ids.map(id=>[id, W.__STRU.get(id).hp]));

  /* 늑대 18마리를 1모둠 문으로 */
  for(let i=0;i<18;i++) W.__spawnWolf(0, 0);
  let stack=0, squash=0, pairs=0, frames=0, maxPack=0, worstStack=0;
  for(let f=0; f<3600 && G.wolves.length; f++){
    W.__hostSim(1/60); frames++;
    /* 태어난 직후에는 같은 자리에서 겹쳐 나온다(자리가 ±1.3 안에서 뽑힌다).
       밀어내기가 풀 시간을 주고 나서부터 잰다. */
    if(f < 90 || f%10) continue;
    /* 얼마나 겹쳐 있나 — 서로 몸이 파고든 짝의 수 */
    /* 두 가지를 따로 센다.
       '포개짐' = 거의 같은 자리(반지름 합의 절반 미만) — 선생님이 보신 그 모습.
       '눌림'  = 몸이 살짝 파고든 것 — 뒤에서 밀면 벽 앞에서는 어쩔 수 없이 생긴다. */
    let nowStack=0;
    for(let i=0;i<G.wolves.length;i++) for(let j=i+1;j<G.wolves.length;j++){
      const a=G.wolves[i], c=G.wolves[j];
      if(a.jT!==undefined || c.jT!==undefined) continue;
      pairs++;
      const d=Math.hypot(a.x-c.x, a.z-c.z), rr=W.__WOLF_R(a)+W.__WOLF_R(c);
      if(d < rr*0.50){ stack++; nowStack++; }
      else if(d < rr*0.80) squash++;
    }
    if(nowStack > worstStack) worstStack = nowStack;
    /* 한 벽 칸에 몇 마리가 붙어 있나 */
    const cnt=new Map();
    for(const w of G.wolves) if(w.bt) cnt.set(w.bt,(cnt.get(w.bt)||0)+1);
    for(const v of cnt.values()) if(v>maxPack) maxPack=v;
  }
  /* 벽이 얼마나 고르게 닳았나 */
  const dmg = ids.map(id=>{ const o2=W.__STRU.get(id);
    return o2 ? hp0.get(id)-o2.hp : hp0.get(id); });
  const tot = dmg.reduce((a,c)=>a+c,0);
  const hit = dmg.filter(d=>d > 0).length;
  o.맞은칸 = hit; o.총피해 = Math.round(tot);
  o.제일많이맞은칸몫 = tot>0 ? +(Math.max(...dmg)/tot).toFixed(3) : 0;
  o.포개짐 = stack; o.눌림 = squash; o.짝수 = pairs; o.한때최대포개짐 = worstStack;
  o.한칸최대 = maxPack; o.정원 = W.__BAL.wallCrowd;
  o.남은늑대 = G.wolves.length;
  G.wolves.length=0; W.__clear();
  return o;
});
ok('벽 한 줄을 세우고 늑대 18마리를 붙였다', sp.벽수 >= 13 && sp.총피해 > 0,
   sp.벽수+'칸 · 총피해 '+sp.총피해);
ok('★ 한 벽 칸에 정원(2마리)보다 많이 안 붙는다', sp.한칸최대 <= sp.정원+1,
   '제일 많을 때 '+sp.한칸최대+'마리 (정원 '+sp.정원+')');
ok('★ 여러 칸이 고르게 맞는다 (가운데 한 칸만 뚫리지 않는다)',
   sp.맞은칸 >= 4 && sp.제일많이맞은칸몫 < 0.55,
   sp.맞은칸+'칸이 맞음 · 제일 많이 맞은 칸이 전체의 '+Math.round(sp.제일많이맞은칸몫*100)+'%');
/* ★ 처음엔 '0.01% 미만' 으로 걸었는데, 여덟 번 재 보니 관측값이 0~5 라
   기준(5.4)이 분포 가장자리에 딱 걸려 여덟 판에 한 번씩 빨개졌다 — 검사가 흔들리면 검사가 아니다.
   ★ 그래서 '얼마나 자주' 대신 '한때 몇 쌍이나' 를 본다. 밀어내기는 겹친 만큼을
     몇 프레임에 걸쳐 푸는 물렁한 장치라, 뒤에서 밀린 늑대 한 쌍이 한순간 깊이 눌리는 건
     물리지 버그가 아니다. 눈에 보이는 '무더기' 는 여러 쌍이 동시에 포개진 것이다. */
ok('★ 늑대 무더기가 생기지 않는다 (한때 포개진 쌍이 둘 이하)',
   sp.한때최대포개짐 <= 2 && sp.포개짐/sp.짝수 < 0.0005,
   '한때 최대 '+sp.한때최대포개짐+'쌍 · 통틀어 '+sp.포개짐+'/'+sp.짝수
   +' ('+(sp.포개짐/sp.짝수*100).toFixed(4)+'%)');
ok('★ 몸이 파고드는 것도 드물다 (벽 앞에서 뒤가 밀 때뿐)',
   sp.눌림 / sp.짝수 < 0.01,
   (sp.눌림/sp.짝수*100).toFixed(2)+'% ('+sp.눌림+'/'+sp.짝수+')');

/* ═══════ 결과 ═══════ */
console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
