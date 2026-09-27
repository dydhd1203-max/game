/* 36차 전용 — 밤 구성표(NIGHT_DEF) 마다 승률을 잰다. bal17 의 방어선·아이·수리 모형을 그대로 쓴다.
   인자: <게임파일> <포트> <쏘는아이수> <무기> <일차목록> <수리아이수> <명중률> <탑세트> <공격배수> <등급(0=섞임)> <밤번호목록(-1=그날 기본)> <판수> [미끼수] [씨앗]

   ★ 67차 균형 조사 — **같은 씨앗이면 어느 컴퓨터·어느 부하에서 돌려도 판마다 똑같이 나온다**(씨앗 0 = 옛날처럼 매번 다름).
     예전 하네스는 판을 열 때마다 '숨은 상태'가 달라서, 같은 파일·같은 설정인데 한 프로세스 48판이 21판 버티고 다른 프로세스는 39판을 버텼다.
     통합 때 '성곽 전 46/54 · 뒤 43/90' 도 이 흔들림이 섞인 값이었다. 결정적으로 재도 성곽 뒤가 12일차에 4~15%p 낮았는데,
     그건 게임 쪽 차이였다(흐름장이 계단을 길로 써서 벽 끝이 뚫림 — index.html buildFlow 의 fRamp 설명).
     숨은 상태와 막은 방법:
       ① 자원(나무·바위·금)이 판을 열 때마다 무작위 자리에 놓여 방어선 칸을 차지한다 → 4판에 1판꼴로 5모둠 배럭(24,−3)(22,0)이 빠졌다.
          자원은 좀비 길·싸움에 끼지 않으므로 '나무·바위 자리예요' 만 무시하고 세운다(다른 까닭으로 못 짓는 칸은 그대로 건너뛴다).
       ② 효과음이 진짜 시계(performance.now)·내 캐릭터와의 거리로 걸러지고 소리마다 Math.random 을 쓴다 → 부하·스폰 자리에 따라 난수 줄이 밀린다.
          소리를 끄고(localStorage sndOn=0) · 시계를 한 걸음 50ms 로 돌리고 · 내 캐릭터를 (0,4)에 눕혀 둔다(황금 좀비 반짝이·유성도 거리로 걸러진다).
       ③ 좀비·병사 번호(wid)가 판을 연 뒤 흐른 일에 따라 다르다 — 병사가 쉴 자리(sin(id))·좀비가 벽에서 비키는 쪽(id%2)이 번호로 정해진다.
          판마다 번호를 정해진 값까지 채운다(빈 좀비를 만들었다 지움).
       ④ 판마다 Math.random 을 씨앗으로 바꾼다(밤 구성·좀비 줄·아이 겨냥·치명타 모두). 끝나면 원래 것으로 돌려놓는다.
     그래도 좀비 싸움은 혼돈계라 판 하나하나는 작은 차이에도 뒤집힌다 — 두 판을 비교할 땐 판 수를 넉넉히(일차당 48판 이상 · 씨앗 여럿) 잰다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const SHOOT=+(process.argv[4]||8), WPN=+(process.argv[5]||3);
const DAYS=(process.argv[6]||'8,12').split(',').map(Number);
const FIX=+(process.argv[7]||8);
const HIT=+(process.argv[8]||1);
const TOW=(process.argv[9]||'many');
const ATK=+(process.argv[10]||1);
const LV=+(process.argv[11]!==undefined?process.argv[11]:0);
const NKS=(process.argv[12]||'-1').split(',').map(Number);
const RUNS=+(process.argv[13]||6);
const BAIT=+(process.argv[14]||0);   // 67차 — 성벽 위 미끼 친구 수(성문 1·2 윗마당에 서서 좀비를 계단으로 끈다 · 설계 9-3 하네스)
const SEED=+(process.argv[15]!==undefined ? process.argv[15] : 1);   // 67차 균형 — 씨앗(0 = 옛날처럼 무작위)
/* 70차(reload68 §8.5) — [16] MAGM 1 = 탄창 모형(탄창 안 간격은 게임의 __wpnShotCd · 빈 탄창이면 마지막 간격 뒤 rl 을 더한다 — 게임 rlTick 과 같은 순서),
   [17] CARRY 1 = 남은 쿨다운을 넘긴다(0.05초 걸음 반올림이 cd′ 와 cd 를 다르게 깎는 것을 없앤다 — 전·후 둘 다 1 로 잰다). 둘 다 0 이면 옛 하네스 그대로 */
const MAGM=+(process.argv[16]||0), CARRY=+(process.argv[17]||0);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:900,height:600}});
if(SEED) await pg.addInitScript(()=>{ try{ localStorage.setItem('sndOn','0'); }catch(e){} });   // ② 소리 끄기(효과음 난수가 시계·거리로 갈린다)
const errs=[]; pg.on('pageerror', e=> errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(800);
const rows = await pg.evaluate(([SHOOT,WPN,DAYS,FIX,HIT,TOW,ATK,LV,NKS,RUNS,BAIT,SEED,MAGM,CARRY])=>{
  const W=window, G=W.__G, out=[];
  /* ②④ 씨앗 난수 · 가짜 시계 — 끝나면 돌려놓는다 */
  const R0 = Math.random, P0 = performance.now.bind(performance), D0 = Date.now;
  let FK = 1e9;                          // 가짜 시계(ms) — 판을 연 뒤의 진짜 시각보다 늘 크게(소리·경고 간격표가 옛 값에 걸리지 않게)
  const seedR = (s)=>{ let a = s>>>0; Math.random = function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1 | a);
    t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; };
  if(SEED){ performance.now = ()=>FK; Date.now = ()=>1.7e12 + FK; }
  let runNo = 0;
  G.started=false; if(W.__PL) W.__PL.down=true;
  /* ★ 'mix' = 교실에서 실제로 나오는 모습 — 몇 채만 Lv6 이고 나머지는 아래 등급이다.
     자재가 한정돼 있어서 전부 Lv6 이 되는 일은 없다. */
  const MIXLV=[6,6,5,5,4,4,4,3,3,3,2,2,2,2,2,2,2];
  let bid = 0;
  /* 67차 — __place 는 이제 '짓기 계획'(아이들이 와서 지음)이라 바로 서지 않는다 → 다 지은 건물을 바로 놓는다(__addStru) */
  const put = (t, x, z)=>{ if(W.__addStru){ const o = {id:'bal' + (++bid), t, x, z, g:G.me.g, n:'t', by:'t', born:Date.now(), lv:1, hp:1, mx:1, cd:W.__BUILD[t].spawn ? 2 : 0, sol:[]}; W.__addStru(o); return o; }
    /* 옛 판 — __place 가 바로 짓던 판(65차까지)만. 짓기 계획 판(66차~)은 __addStru 가 없으면 잴 수 없다(비교용 옛 판엔 창구 한 줄을 붙여 잰다) */
    W.__place(t, x, z); const o = W.__STRU.get(W.__cellOwner ? W.__cellOwner().get(x+','+z) : '');
    if(!o) throw new Error('이 판은 __place 가 짓기 계획이라 방어선을 바로 못 세운다 — 검사 창구에 __addStru:addStru 를 붙여 잰다');
    return o; };
  /* ① 자원 자리는 무시하고 세운다(자원은 판을 열 때마다 무작위 — 방어선이 판마다 달라진다). 다른 까닭으로 못 짓는 칸은 그대로 건너뛴다 */
  const okAt = (t, x, z)=>{ const r = W.__canPlace(t, x, z); return r === null || (SEED && r === '나무·바위 자리예요'); };
  const build=(lv)=>{
    W.__clear();
    /* ★ 17차 — 자리 계산을 하네스가 손수 하면 안 된다. 입구가 옆으로 밀리자(off)
       벽·탑이 산 한가운데에 놓이려다 실패해서 방어선이 통째로 비었다.
       게임의 좌표 변환(__gX/__gZ)에 물어본다. */
    /* 옛 판에는 __gX 가 없다 — 하네스는 두 판을 다 잴 수 있어야 비교가 된다 */
    const oldXf = (g,t,p)=>{ const d=W.__DIRS[g]; return [d.dx*t - d.dz*p, d.dz*t + d.dx*p]; };
    for(let g=0; g<5; g++){
      const GX=(t,p)=> W.__gX ? W.__gX(g,t,p) : oldXf(g,t,p)[0];
      const GZ=(t,p)=> W.__gZ ? W.__gZ(g,t,p) : oldXf(g,t,p)[1];
      G.me.g=g; G.res[g]={w:999999,s:999999,g:999999};
      for(let pp=-8; pp<=8; pp+=0.5){
        const x=Math.round(GX(42,pp)), z=Math.round(GZ(42,pp));
        if(okAt('swall',x,z)){ const o = put('swall', x, z);
          const L2 = lv>0 ? lv : 4;              // 벽은 mix 여도 Lv4 로 본다
          o.lv=L2; o.mx=W.__bs('swall','hp',L2); o.hp=o.mx; } }
      /* ★ 12차에서 탑·배럭 개수 제한을 없앴다. 'many' 는 그 뒤 교실에서 실제로 나올 법한 수
         (화살탑 9 · 얼음탑 5 · 배럭 3). 'old' 는 예전 제한(6/3/2) 그대로다. */
      const TSET = TOW==='old'
        ? [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],['arrow',26,0],['arrow',39,0],
           ['ice',33,-5],['ice',33,5],['ice',28,0],['barr',24,-3],['barr',24,3]]
        : [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],['arrow',26,0],['arrow',39,0],
           ['arrow',29,-6],['arrow',29,6],['arrow',34,0],
           ['ice',33,-5],['ice',33,5],['ice',28,0],['ice',38,-3],['ice',38,3],
           ['barr',24,-3],['barr',24,3],['barr',22,0]];
      TSET.forEach(([t,rr,pp], ti)=>{
        const x=Math.round(GX(rr,pp)), z=Math.round(GZ(rr,pp));
        if(okAt(t,x,z)){ const o = put(t, x, z);
          const L2 = lv>0 ? lv : MIXLV[Math.min(MIXLV.length-1, ti)];
          o.lv=L2; o.mx=W.__bs(t,'hp',L2); o.hp=o.mx; } }); }
    G.me.g=0; W.__rebuild();
  };
  const oldXf2 = (g,t,p)=>{ const d=W.__DIRS[g]; return [d.dx*t - d.dz*p, d.dz*t + d.dx*p]; };
  /* 아이들 자리 — 밤 도중에도 옮기므로 바깥 자리(scope)에 둔다 */
  const KX=(g,t,p)=> W.__gX ? W.__gX(g,t,p) : oldXf2(g,t,p)[0];
  const KZ=(g,t,p)=> W.__gZ ? W.__gZ(g,t,p) : oldXf2(g,t,p)[1];
  const sectorAt = (x,z)=> W.__sectorOf ? W.__sectorOf(x,z) : (()=>{
      const a=Math.atan2(z,x); let bg=0,bd=9;
      for(let g=0;g<5;g++){ const dd=Math.abs(((a-W.__DIRS[g].a+Math.PI*3)%(Math.PI*2))-Math.PI);
        if(dd<bd){bd=dd;bg=g;} } return bg; })();
  const Wp = W.__WEAPONS[WPN], MAGN = MAGM && W.__wpnMag ? W.__wpnMag(Wp) : 0, IV = MAGN > 1 ? W.__wpnShotCd(Wp) : Wp.cd;
  const mkKids=()=>{ const k=[];
    for(let i=0;i<SHOOT;i++){ const g=i%5, off=((i/5|0)-1)*3;
      k.push({x:KX(g,38,off), z:KZ(g,38,off), cd:Math.random()*Wp.cd, boss:(i%2)===0, m:MAGN > 1 ? 1 + (i*7 % MAGN) : 0}); }   // 70차 — 처음 탄창은 아이 번호로(난수 줄 그대로)
    return k; };
  for(const nk of NKS){
    for(const day of DAYS){
      let win=0, note='', nmRun='?', cntRun=0, lost=0;   // lost — 67차: 수정 피해 합(미끼 판 비교 · 설계 5-10)
      for(let run=0; run<RUNS; run++){
        if(SEED){
          runNo++;
          if(W.__PL){ W.__PL.x = 0; W.__PL.z = 4; W.__PL.y = W.__GY; W.__PL.down = true; }   // ② 내 캐릭터 자리 고정(거리로 걸러지는 효과)
          if(W.__spawnWolf){ const base = 100000 + runNo*4000; let q = W.__spawnWolf(0, 0);  // ③ 좀비·병사 번호를 판마다 같은 값에서 시작
            while(q.id < base - 1) q = W.__spawnWolf(0, 0); G.wolves.length = 0; }
          seedR(SEED*1000003 + runNo*7919);                                                      // ④
        }
        build(LV);
        G.day=day; G.crystal=G.set.crystalMax; G.wolves.length=0; G.soldiers.length=0;
        if(W.__setNk) W.__setNk(nk);
        W.__goNight(); if(run===0){ nmRun = W.__stageName(day); cntRun = G.wolves.length + (W.__spawnQLen ? 0 : 0); }
        const dayMul = 1 + 0.14*(day-1), kids = mkKids();
        if(G.players) G.players.clear();
        for(let bi=0; bi<BAIT; bi++){ const g = bi % 5, s2 = bi % 2 ? 1 : -1, uid = 'bait' + bi;   // 미끼 — 성문 g 윗마당(P 9)에 서 있는 친구
          if(W.__gX && G.players) G.players.set(uid, {uid, x:W.__gX(g, 51, 9*s2), y:W.__GY + 8, z:W.__gZ(g, 51, 9*s2), down:false, g, hp:100}); }
        const steps=Math.ceil(G.set.nightSec*20);
        for(let i=0;i<steps;i++){
          if(BAIT && G.players) for(let bi=0; bi<BAIT; bi++){ const q = G.players.get('bait' + bi); if(!q) continue;   // 미끼: 4초 계단 발치(땅)에서 끌고 → 12초 성벽 윗마당(8)
            const g = bi % 5, s2 = bi % 2 ? 1 : -1, ph = (i/20 + bi*3) % 16, up = ph >= 4, t = up ? 51 : 33, pp = (up ? 9 : 8.5)*s2;
            q.x = W.__gX(g, t, pp); q.z = W.__gZ(g, t, pp); q.y = W.__GY + (up ? 8 : 0); }
          W.__step(1,1/20); FK += 50;
          for(const k of kids){ k.cd -= 0.05; if(k.cd>0) continue;
            let best=null, bd=Wp.rng*Wp.rng;
            /* ★ 16차 — 보스인지는 게임에 물어본다. 번호(k<3)를 베껴 두면
               표에 좀비가 한 줄 붙을 때마다 조용히 엉뚱한 놈을 겨눈다. */
            if(k.boss){ for(const w of G.wolves){ if(!W.__isBoss(w.k)) continue;
              const dx=w.x-k.x, dz=w.z-k.z, d2=dx*dx+dz*dz; if(d2<bd){ bd=d2; best=w; } } }
            if(!best){ bd=Wp.rng*Wp.rng;
              for(const w of G.wolves){ const dx=w.x-k.x, dz=w.z-k.z, d2=dx*dx+dz*dz;
                if(d2<bd){ bd=d2; best=w; } } }
            if(!best){ k.cd=0.2; continue; }
            { let add = IV; if(MAGN > 1 && --k.m <= 0){ add += Wp.rl; k.m = MAGN; } k.cd = CARRY ? k.cd + add : add; }   // 70차 — 옛 판: k.cd=Wp.cd
            if(Math.random() > HIT) continue;      // 겨냥이 빗나갔다
            best.hp -= Math.round(Wp.dmg*dayMul*ATK*(Math.random()<0.14?2:1));
          }
          /* ★ 절반은 위험한 입구로 달려간다.
             게임이 "🚨 3모둠 쪽에 좀비 6마리! 가까운 친구들 도와주러 가요" 라고
             직접 알려 주기 때문에, 실제 교실에서는 다들 그쪽으로 몰린다.
             제자리에 못 박아 두면 집중 입구가 뚫리는 걸 아무도 못 막는 것으로 잰다. */
          if(i % 100 === 0){
            const cnt = [0,0,0,0,0];
            for(const w of G.wolves){
              cnt[sectorAt(w.x, w.z)]++; }
            let hot=0; for(let g=1;g<5;g++) if(cnt[g]>cnt[hot]) hot=g;
            
            kids.forEach((k,ki)=>{ if(ki%2) return;          // 절반만 이동
              const off=((ki/2|0)-2)*3;
              k.x = KX(hot,38,off); k.z = KZ(hot,38,off); });
          }
          /* ★ 밤에 애들이 수리한다 — 수리 한 번 2.5초, 한 번에 최대 체력의 40%가 찬다.
             이걸 안 넣으면 탑이 부서진 채로 밤이 끝나서, 실제보다 훨씬 어렵게 나온다. */
          if(FIX && i % 50 === 0){
            const hurt = [...W.__STRU.values()].filter(o=>o.hp < o.mx*0.98)
                          .sort((a,b)=> a.hp/a.mx - b.hp/b.mx);
            for(let f=0; f<FIX && f<hurt.length; f++){
              const o = hurt[f]; o.hp = Math.min(o.mx, o.hp + o.mx*0.40);
            }
          }
          if(G.phase!=='night') break;
        }
        if(G.crystal > 0) win++;
        note += ' ' + Math.round(G.crystal); lost += G.set.crystalMax - Math.max(0, G.crystal);
      }
      G.day = day; if(W.__setNk) W.__setNk(nk); const wvN = W.__waveFor(day).kinds.length;
      out.push(`${day}일차 · 밤 ${nk} ${nmRun} · ${wvN}마리 · ${LV>0?'Lv'+LV:'등급섞임'}`
        + ` → ${RUNS}판 중 ${win}판 버팀 · 수정 피해 평균 ${(lost/RUNS).toFixed(1)} (남은 수정${note})`);
    }
  }
  Math.random = R0; performance.now = P0; Date.now = D0;
  return out;
}, [SHOOT,WPN,DAYS,FIX,HIT,TOW,ATK,LV,NKS,RUNS,BAIT,SEED,MAGM,CARRY]);
console.log(rows.join('\n'));
if(errs.length) console.log('ERR: '+errs.slice(0,3).join(' | '));
await b.close(); srv.close();
