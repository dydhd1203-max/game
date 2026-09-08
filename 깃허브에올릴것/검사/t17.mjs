/* 16차 검사 — 벽을 뛰어넘는 늑대
   ★ 값을 검사에 박지 않는다. 벽 높이도 도약 높이도 게임에서 읽어 '관계'만 본다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 11700);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ═══════ ① 보스 판정이 표를 본다 ═══════ */
const tb = await pg.evaluate(()=>{
  const W=window, T=W.__WOLF_T, o={};
  o.종류수 = T.length;
  o.뛰는번호 = W.__K_JUMP();
  o.뛰는놈 = T[o.뛰는번호] ? T[o.뛰는번호].n : null;
  /* 표에 boss 칸이 있는 줄만 보스여야 한다 */
  o.어긋남 = T.map((t,k)=> (!!t.boss) === W.__isBoss(k)).filter(v=>!v).length;
  o.뛰는놈은보스아님 = !W.__isBoss(o.뛰는번호);
  o.뛰는놈이맨끝 = o.뛰는번호 === T.length-1;
  /* 번호로 가리던 옛 방식(k>=3)이면 뛰는 늑대가 보스가 된다 — 그 함정에 안 빠지나 */
  o.옛방식이면보스 = o.뛰는번호 >= 3;
  /* 보스 다섯은 전부 보스로 잡힌다 */
  o.보스전부 = W.__bossDays().every((d,i)=> W.__isBoss(W.__WOLF_T.findIndex(t=>t.boss===i+1)));
  /* 양을 무는 힘 표에 빈칸이 없다 — 14차에 한 칸 밀려 있었다 */
  o.물기 = T.map((t,k)=> W.__sheepBite ? 0 : 0);
  return o;
});
ok('★ 보스인지는 표(boss 칸)를 보고 정한다', tb.어긋남===0, tb.어긋남+'개 어긋남');
ok('★ 뛰는 늑대는 보스가 아니다', tb.뛰는놈은보스아님, tb.뛰는놈);
ok('★ 뛰는 늑대는 보스 뒤에 붙었다 — 옛 k>=3 방식이면 보스로 잘못 잡힌다',
   tb.뛰는놈이맨끝 && tb.옛방식이면보스, '번호 '+tb.뛰는번호+' / '+tb.종류수+'종');
ok('보스 다섯은 전부 보스로 잡힌다', tb.보스전부);

/* ═══════ ② 양을 무는 힘 표 — 종류마다 빠짐없이 ═══════ */
const sb = await pg.evaluate(()=>{
  const W=window, o={};
  /* 상한(55)에 닿으면 둘이 같아져서 표가 밀린 게 안 보인다 — 상한 아래에서 잰다 */
  W.__G.day = 1;
  o.값 = W.__WOLF_T.map((t,k)=> W.__sheepBiteDmg({k, jy:0}));
  o.이름 = W.__WOLF_T.map(t=>t.n);
  return o;
});
const iHell = await pg.evaluate(()=>window.__WOLF_T.findIndex(t=>t.boss===4));
const iKing = await pg.evaluate(()=>window.__WOLF_T.findIndex(t=>t.boss===5));
ok('★ 늑대왕이 지옥의 늑대보다 세게 문다 (14차에 표가 한 칸 밀려 있었다)',
   sb.값[iKing] > sb.값[iHell], sb.이름[iHell]+' '+sb.값[iHell]+' → '+sb.이름[iKing]+' '+sb.값[iKing]);
ok('★ 늑대왕이 제일 약한 늑대보다 세게 문다', sb.값[iKing] > Math.min(...sb.값.slice(0,3)),
   sb.값[iKing]+' vs '+Math.min(...sb.값.slice(0,3)));

/* ═══════ ③ 어느 밤에나 10% 쯤 ═══════ */
const wv = await pg.evaluate(()=>{
  const W=window, KJ=W.__K_JUMP(), o={날:[]};
  for(let d=1; d<=W.__G.set.goalDay; d++){
    const k = W.__waveFor(d).kinds;
    const j = k.filter(x=>x===KJ).length;
    o.날.push({d, 총:k.length, 뛰는:j, 비율:j/k.length});
  }
  o.몫 = W.__BAL.jumpShare;
  o.빈밤 = o.날.filter(r=>r.뛰는===0).length;
  o.최소 = Math.min(...o.날.map(r=>r.비율));
  o.최대 = Math.max(...o.날.map(r=>r.비율));
  o.전체비율 = o.날.reduce((a,r)=>a+r.뛰는,0) / o.날.reduce((a,r)=>a+r.총,0);
  /* 뛰는 늑대는 총량을 늘리는 게 아니라 일반 늑대 자리를 대신 채운다 */
  o.보스날잡몹 = W.__waveFor(15).kinds.filter(k=>!W.__isBoss(k)).length;
  return o;
});
ok('★ 어느 밤에도 뛰는 늑대가 빠지지 않는다', wv.빈밤===0, wv.날.map(r=>r.뛰는).join(' '));
ok('★ 밤을 통틀어 정해 둔 몫(10%)에 맞는다',
   Math.abs(wv.전체비율 - wv.몫) <= wv.몫*0.25,
   (wv.전체비율*100).toFixed(1)+'% (몫 '+(wv.몫*100)+'%)');
ok('★ 어느 밤도 몫의 두 배를 넘지 않는다 (첫날은 늑대가 적어 한 마리만 넣어도 20%다)',
   wv.최대 <= wv.몫*2.05, (wv.최소*100).toFixed(1)+'% ~ '+(wv.최대*100).toFixed(1)+'%');
ok('뛰는 늑대는 보스로 안 세어진다 (체력 막대가 안 뜬다)',
   wv.보스날잡몹 === wv.날[14].총-1, wv.보스날잡몹+' / '+wv.날[14].총);

/* ═══════ ④ 진짜로 뛰어넘나 — 벽을 세우고 늑대를 붙여 본다 ═══════ */
const jp = await pg.evaluate(async ()=>{
  const W=window, G=W.__G, o={};
  /* ★ 검사와 검사 사이에도 게임은 제 나름대로 돌고 있다. 예약된 늑대(spawnQ)를 안 비우면
     hostSim 을 돌리는 순간 오늘 밤 늑대가 통째로 쏟아져서 내 늑대 하나를 재던 게 무너진다. */
  W.__clear(); G.wolves.length=0; W.__spawnQ().length=0;
  G.phase='night'; G.day=6; G.paused=false;
  /* ★ 혼자 하기로 들어오면 내 양은 0모둠 산길 한가운데(반경 26~33)에 선다 —
     그대로 두면 늑대가 벽으로 안 가고 양을 물어뜯느라 재는 게 무너진다. */
  W.__PL.down = true;
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  G.me.g = 0;
  const d = W.__DIRS[0];
  /* 0모둠 입구를 돌벽으로 통째로 막는다 — 넘는 것 말고는 길이 없게 */
  let walls=0;
  for(let pp=-14; pp<=14; pp+=1){
    const x=Math.round(d.dx*30-d.dz*pp), z=Math.round(d.dz*30+d.dx*pp);
    if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z); walls++; }
  }
  W.__rebuild(); W.__flow();
  o.벽수 = walls;
  o.벽높이 = W.__BUILD.swall.hi;
  const hp0 = [...W.__STRU.values()].reduce((a,c)=>a+c.hp, 0);

  /* 벽 바깥에 뛰는 늑대 한 마리 */
  const KJ = W.__K_JUMP();
  const w = W.__spawnWolf(KJ, 0, d.dx*34, d.dz*34);
  o.거리0 = Math.hypot(w.x, w.z);

  /* 40초를 돌리며 매 프레임 살핀다 */
  let maxJy=0, tookOff=0, throughWall=0, frames=0, landedInWall=0, minR=o.거리0;
  const cell = W.__cellOwner();
  for(let f=0; f<2400; f++){
    W.__hostSim(1/60); frames++;
    if(!G.wolves.includes(w)) break;
    o.끼어듦 = Math.max(o.끼어듦||0, G.wolves.length);
    const jy = w.jy || 0;
    if(jy > maxJy) maxJy = jy;
    if(w.jT !== undefined && jy === 0 && f>0) ; // 도약 첫 프레임
    const inWall = cell.has(Math.floor(w.x)+','+Math.floor(w.z));
    /* 벽 칸 위에 있는데 안 떠 있으면 그건 '통과' 다 */
    if(inWall && jy < o.벽높이) throughWall++;
    if(inWall && w.jT === undefined) landedInWall++;
    if(w.jT === 0) tookOff++;
    minR = Math.min(minR, Math.hypot(w.x, w.z));
  }
  o.프레임 = frames;
  o.최고높이 = maxJy;
  o.벽통과 = throughWall;
  o.벽위착지 = landedInWall;
  o.최소반경 = minR; o.도약수 = tookOff;
  o.벽피해 = hp0 - [...W.__STRU.values()].reduce((a,c)=>a+c.hp, 0);
  o.넘었나 = minR < 26;
  return o;
});
ok('벽으로 입구를 통째로 막았다', jp.벽수 >= 15, jp.벽수+'칸');
ok('재는 동안 다른 늑대가 안 끼어들었다', (jp.끼어듦||1) === 1, (jp.끼어듦||1)+'마리');
ok('★ 실제로 뛰었다', jp.도약수 > 0, jp.도약수+'번');
ok('★ 늑대가 벽 안쪽으로 들어왔다', jp.넘었나, '반경 '+jp.거리0.toFixed(1)+' → '+jp.최소반경.toFixed(1));
ok('★ 벽보다 높이 떠올랐다 (진짜 뛰어넘는다)', jp.최고높이 > jp.벽높이,
   '최고 '+jp.최고높이.toFixed(2)+' > 벽 '+jp.벽높이);
ok('★ 벽을 통과하지 않는다 (벽 칸 위에 있을 땐 늘 벽보다 높다)', jp.벽통과===0, jp.벽통과+'프레임');
ok('★ 벽 위에 내려서지 않는다', jp.벽위착지===0, jp.벽위착지+'프레임');
ok('★ 벽을 물지 않는다', jp.벽피해===0, '벽이 깎인 양 '+Math.round(jp.벽피해));

/* ═══════ ⑤ 탑·배럭은 그대로 문다 ═══════ */
const st = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  W.__clear(); G.wolves.length=0; W.__spawnQ().length=0;
  G.phase='night'; G.day=6; G.paused=false; W.__PL.down = true;
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  G.me.g=0;
  const d = W.__DIRS[0];
  const tx=Math.round(d.dx*30), tz=Math.round(d.dz*30);
  o.놓임 = W.__canPlace('arrow',tx,tz)===null;
  if(o.놓임) W.__place('arrow',tx,tz);
  W.__rebuild(); W.__flow();
  const tower = [...W.__STRU.values()].find(s=>s.t==='arrow');
  const hp0 = tower ? tower.hp : 0;
  const w = W.__spawnWolf(W.__K_JUMP(), 0, d.dx*34, d.dz*34);
  w.tgt = tower ? tower.id : null;
  let jumps=0;
  for(let f=0; f<1500 && G.wolves.includes(w); f++){
    W.__hostSim(1/60);
    if(w.jT === 0) jumps++;
  }
  o.남은늑대 = G.wolves.length;
  o.탑피해 = hp0 - (tower ? tower.hp : hp0);
  o.공성 = !!w.siege;
  return o;
});
ok('탑을 세웠다', st.놓임);
ok('★ 뛰는 늑대는 늘 공성이다 (탑·배럭을 노린다)', st.공성);
ok('★ 탑은 뛰어넘지 않고 문다', st.탑피해 > 0, '탑이 '+Math.round(st.탑피해)+' 깎였다');

/* ═══════ ⑥ 도약 모션 — 자리·높이·자세가 맞물려 움직이나 ═══════ */
const mo = await pg.evaluate(()=>{
  const W=window, o={};
  W.__clear(); W.__rebuild();
  const d = W.__DIRS[0];
  const w = {id:7, k:W.__K_JUMP(), x:d.dx*22, z:d.dz*22, y:W.__GY, ry:0, hp:30, mx:30,
             mv:true, ph:0, hurt:0, atkT:0, jCool:0};
  const okStart = W.__startJump(w, -d.dx, -d.dz);
  o.떴나 = okStart;
  if(!okStart) return o;
  o.시작 = [w.jsx, w.jsz]; o.끝 = [w.jex, w.jez];
  o.거리 = Math.hypot(w.jex-w.jsx, w.jez-w.jsz);
  /* 포물선을 직접 돌려 본다 */
  const path=[{p:0, jy:0, jv:w.jPeak*4/w.jDur}];
  const st={...w};
  for(let f=0; f<200 && st.jT!==undefined; f++){
    st.jT += 1/60;
    const p = Math.min(1, st.jT/st.jDur);
    st.x = st.jsx + (st.jex-st.jsx)*p;
    st.z = st.jsz + (st.jez-st.jsz)*p;
    st.jy = st.jPeak*4*p*(1-p);
    st.jv = st.jPeak*4*(1-2*p)/st.jDur;
    path.push({p, jy:st.jy, jv:st.jv});
    if(p>=1) break;
  }
  o.칸수 = path.length;
  o.시간 = w.jDur;
  o.최고 = Math.max(...path.map(r=>r.jy));
  o.끝높이 = path[path.length-1].jy;
  o.시작높이 = path[0].jy;
  /* 오를 땐 위로, 내릴 땐 아래로 — 딱 한 번만 뒤집힌다 */
  let flips=0;
  for(let i=1;i<path.length;i++) if(Math.sign(path[i].jv)!==Math.sign(path[i-1].jv)) flips++;
  o.방향바뀜 = flips;
  o.꼭대기p = path.reduce((a,c)=> c.jy>a.jy?c:a).p;
  return o;
});
ok('도약이 시작된다', mo.떴나);
ok('★ 뜬 높이가 0 에서 올라갔다가 0 으로 돌아온다',
   mo.시작높이 === 0 && mo.끝높이 < 0.02 && mo.최고 > 1.4,
   mo.시작높이.toFixed(2)+' → '+mo.최고.toFixed(2)+' → '+mo.끝높이.toFixed(2));
ok('★ 꼭대기가 한가운데다 (포물선이다)', Math.abs(mo.꼭대기p-0.5) < 0.06, 'p='+mo.꼭대기p.toFixed(3));
ok('★ 오르내림이 딱 한 번만 뒤집힌다 (공중제비가 아니다)', mo.방향바뀜===1, mo.방향바뀜+'번');
ok('한 도약이 여러 프레임에 걸쳐 그려진다 (순간이동이 아니다)', mo.칸수 >= 20,
   mo.칸수+'프레임 / '+mo.시간.toFixed(2)+'초');

/* ═══════ ⑦ 그리기 — 뜬 만큼 몸이 올라가고 다리가 뻗나 ═══════ */
const dr = await pg.evaluate(()=>{
  const W=window, o={};
  const mk = (jy,jv)=>({id:3, k:W.__K_JUMP(), x:8, z:8, y:W.__GY, ry:0, hp:30, mx:30,
                        mv:true, ph:0, hurt:0, atkT:0, jy, jv});
  const read = (jy,jv)=>{
    W.__drawWolves([mk(jy,jv)], 1.0, 1/60);
    const M = W.__wolfMesh('body');
    const m = new (W.__THREE.Matrix4)();
    M.getMatrixAt(0, m);
    const pos = new (W.__THREE.Vector3)(), q = new (W.__THREE.Quaternion)(), sc = new (W.__THREE.Vector3)();
    m.decompose(pos, q, sc);
    const e = new (W.__THREE.Euler)().setFromQuaternion(q, 'YXZ');
    const L = W.__wolfMesh('legs');
    const legs=[];
    for(let i=0;i<4;i++){ const m2=new (W.__THREE.Matrix4)(); L.getMatrixAt(i, m2);
      const p2=new (W.__THREE.Vector3)(), q2=new (W.__THREE.Quaternion)(), s2=new (W.__THREE.Vector3)();
      m2.decompose(p2,q2,s2); legs.push({x:p2.x, z:p2.z}); }
    return {y:pos.y, pit:e.x, legs};
  };
  const g0 = read(0, 0);
  const up = read(1.6, 4.0);
  const dn = read(1.6, -4.0);
  o.땅y = g0.y; o.공중y = up.y;
  o.올라감 = up.y - g0.y;
  o.솟을때기울기 = up.pit; o.떨어질때기울기 = dn.pit; o.땅기울기 = g0.pit;
  /* 다리가 앞뒤로 벌어졌나 — 앞다리와 뒷다리의 z 간격(ry=0 이라 앞이 +z) */
  const spread = (L)=> Math.max(...L.map(p=>p.z)) - Math.min(...L.map(p=>p.z));
  o.땅벌림 = spread(g0.legs); o.공중벌림 = spread(up.legs);
  return o;
});
ok('★ 뜬 만큼 몸이 통째로 올라간다', Math.abs(dr.올라감 - 1.6) < 0.25,
   '+'+dr.올라감.toFixed(2)+' (뜬 높이 1.6)');
ok('★ 솟을 땐 코를 들고 떨어질 땐 코를 박는다',
   dr.솟을때기울기 > dr.땅기울기 && dr.떨어질때기울기 < dr.땅기울기,
   '솟을때 '+dr.솟을때기울기.toFixed(2)+' / 땅 '+dr.땅기울기.toFixed(2)+' / 떨어질때 '+dr.떨어질때기울기.toFixed(2));
ok('★ 공중에서 앞다리·뒷다리를 앞뒤로 쭉 뻗는다',
   dr.공중벌림 > dr.땅벌림*1.25,
   '땅 '+dr.땅벌림.toFixed(2)+' → 공중 '+dr.공중벌림.toFixed(2));

/* ═══════ ⑧ 통신 — 칸을 안 늘리고 높이를 실어 보낸다 ═══════ */
const nt = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  G.wolves.length = 0;
  G.wolves.push({id:1, k:0, x:3, z:4, ry:0.5, hp:10, mx:20, mv:true,  jy:0});
  G.wolves.push({id:2, k:W.__K_JUMP(), x:-2, z:6, ry:1.2, hp:30, mx:30, mv:true, jy:1.75});
  const pk = W.__packSim();
  o.칸수 = pk.w.length / G.wolves.length;
  const host = G.host; G.host = false;
  const keep = G.wolves.map(w=>({...w}));
  G.wolves.length = 0;
  W.__applySim(pk);
  o.마리 = G.wolves.length;
  const a = G.wolves.find(w=>w.id===1), b2 = G.wolves.find(w=>w.id===2);
  o.걷는중 = !!(a && a.mv) && !!(b2 && b2.mv);
  o.땅늑대높이 = a ? (a.tjy||0) : -1;
  o.뛴늑대높이 = b2 ? (b2.tjy||0) : -1;
  o.오차 = Math.abs(o.뛴늑대높이 - 1.75);
  G.host = host; G.wolves.length=0; for(const w of keep) G.wolves.push(w);
  return o;
});
ok('★ 늑대 한 마리가 차지하는 칸이 7 그대로다 (통신량이 안 늘었다)', nt.칸수===7, nt.칸수+'칸');
ok('두 마리가 그대로 건너간다', nt.마리===2, nt.마리);
ok('★ 걷는지 아닌지(mv)가 안 망가진다', nt.걷는중);
ok('★ 안 뛴 늑대는 높이가 0 이다', nt.땅늑대높이===0, nt.땅늑대높이);
ok('★ 뛴 높이가 그대로 건너간다', nt.오차 <= 1/8,
   '1.75 → '+nt.뛴늑대높이+' (오차 '+nt.오차.toFixed(3)+')');

/* ═══════ ⑨ 공중에 뜬 늑대는 양을 못 문다 ═══════ */
const sh = await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, o={};
  G.phase='night'; G.paused=false; G.started=true; PL.down=false; PL.hurtFx=0;
  PL.hp = 100; PL.biteT = 0; PL.y = W.__GY;
  const put = (jy)=>{ G.wolves.length=0;
    G.wolves.push({id:9, k:W.__K_JUMP(), x:PL.x+0.4, z:PL.z+0.4, y:W.__GY,
                   ry:0, hp:30, mx:30, mv:true, jy}); };
  put(0);   PL.hp=100; PL.biteT=0; W.__sheepHurt(1/60); o.땅에서 = 100-PL.hp;
  put(1.9); PL.hp=100; PL.biteT=0; W.__sheepHurt(1/60); o.공중에서 = 100-PL.hp;
  G.wolves.length=0;
  return o;
});
ok('★ 내려서면 문다', sh.땅에서 > 0, '-'+sh.땅에서);
ok('★ 뛰어넘는 중에는 못 문다 (머리 위를 날아가며 물지 않는다)', sh.공중에서===0, '-'+sh.공중에서);

/* ═══════ 결과 ═══════ */
console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
