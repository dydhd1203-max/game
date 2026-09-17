/* 33차 검사 — 총 타격감 (쏠 때 · 좀비가 맞을 때)
   ★ 선생님: "총 타격감(쏠 때, 좀비가 맞을 때)을 더 멋있게." 29차 손맛(반동·예광탄·불티·숫자·히트마커) 위에
     총구 섬광(가산합성 원판) · 시야 펀치(FOV) · 맞는 순간 내 화면에서 바로 움찔·밀림 · 충격 고리 · 막타 예고(흰 고리·붉은 X·쿵) · 소리 셋.
   검사기는 소리를 못 듣고 GPU 를 못 보므로 **상태**를 잰다: 고리가 살아 있나, 섬광이 떴다 꺼지나, FOV 가 올랐다 돌아오나,
   좀비에 hurt·kT 가 즉시 붙나, 히트마커 등급이 맞나. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 8934);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=high', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
await pg.fill('#iName','검'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1200);
const R=[]; const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

/* ═══════ ① 타격감 ═══════
   ★ 페이지의 rAF 루프가 실제로 돈다(swiftshader 라 한 프레임 100~200ms). evaluate 한 번 안에서는 프레임이 안 지나므로
     '쏜 직후' 는 같은 evaluate 에서, '가라앉은 뒤' 는 기다렸다가 다른 evaluate 에서 잰다. */
const SETUP = `const W=window, G=W.__G, PL=W.__PL, K=W.__KIT, o={};
    const mk = ()=>{ G.wolves.length = 0; const w=W.__spawnWolf(0,0); w.x = PL.x + 6; w.z = PL.z; w.y = PL.y; w.hp = 1000; w.mx = 1000; w.hurt = 0;
      PL.yaw = Math.atan2(-(w.x-PL.x), -(w.z-PL.z)); PL.pitch = 0; W.__updPlayer(0.001); W.__setAim(true,true); return w; };
    const fire = (i)=>{ K.ownW[i]=true; W.__equipWeapon(i); W.__setThrowCd(0); W.__setCrit(0); W.__throw(); };
    const ch = document.getElementById('crosshair');`;
{
  const r = await pg.evaluate(new Function(SETUP + `
    o.sfx = ['hit','crit','kill'].every(k=>W.__SFXKEYS().includes(k));
    o.flash0 = !W.__flash().visible; o.rings0 = W.__rings().every(r=>r.t<=0); o.fov0 = W.__cam.fov; o.FOV0 = W.__FOV0;
    W.__goNight(); K.ammo = 99;
    const w = mk(); o.aimed = !!W.__aimWolf(); fire(3);
    o.hurtNow = w.hurt; o.kT = w.kT; o.kDir = [+(w.kx||0).toFixed(2), +(w.kz||0).toFixed(2)];
    o.flashOn = W.__flash().visible; o.flashT = W.__flashT();
    o.ringLive = W.__rings().filter(r=>r.t>0).length; const rg = W.__rings().find(r=>r.t>0);
    o.ringCol = rg ? rg.c.getHex() : -1; o.ringNearWolf = rg ? +Math.hypot(rg.x-w.x, rg.z-w.z).toFixed(2) : 99;
    o.fovKick = W.__fovKick(); o.tr = W.__WEAPONS[3].tr;
    o.mark = ch.classList.contains('hit') && !ch.classList.contains('critHit') && !ch.classList.contains('killHit');
    return o;`));
  ok('맞는 소리 셋 — hit · crit · kill 이 소리표에 있다', r.sfx);
  ok('처음엔 섬광이 꺼져 있고 고리가 하나도 없고 FOV 는 기본(74)', r.flash0 && r.rings0 && r.fov0 === r.FOV0, r.fov0);
  ok('좀비를 겨눴다', r.aimed);
  ok('★ 맞는 순간 좀비가 **바로** 움찔한다 (hurt 0.18 · 호스트 왕복을 안 기다린다)', r.hurtNow >= 0.17, r.hurtNow);
  ok('★ 쏜 방향으로 밀린다 (kT 0.16 · 방향은 조준선)', r.kT >= 0.15 && Math.abs(r.kDir[0]) + Math.abs(r.kDir[1]) > 0.9, r.kT+' '+r.kDir.join(','));
  ok('★ 총구 섬광이 뜬다 (0.06초)', r.flashOn && r.flashT > 0.05, r.flashT);
  ok('★ 맞은 자리에 충격 고리가 생긴다 — 총의 예광탄 색으로, 좀비 자리에', r.ringLive >= 1 && r.ringCol === r.tr && r.ringNearWolf < 0.5, r.ringLive+' · 0x'+r.ringCol.toString(16)+' · '+r.ringNearWolf+'칸');
  ok('맞으면 조준점 흰 X', r.mark);
  /* 시야 펀치 — 다음 실제 프레임에서 카메라에 얹힌다. 잠깐 폴링해 최고를 잡고, 가라앉기를 기다린다 */
  let fovMax = 0;
  for(let i=0;i<12;i++){ fovMax = Math.max(fovMax, await pg.evaluate(()=>window.__cam.fov)); await pg.waitForTimeout(40); }
  ok('★ 시야 펀치 — 쏘면 FOV 가 오른다(≤4°)', r.fovKick > 0.5 && r.fovKick <= 4 && fovMax > r.FOV0, r.fovKick.toFixed(2)+' · 최고 '+fovMax.toFixed(2));
  await pg.waitForFunction(()=>window.__fovKick()===0 && window.__cam.fov===window.__FOV0 && !window.__flash().visible, null, {timeout:8000}).catch(()=>{});
  const r2 = await pg.evaluate(()=>{ const W=window, w=W.__G.wolves[0], ch=document.getElementById('crosshair');
    return {fov:W.__cam.fov, kick:W.__fovKick(), flashOff:!W.__flash().visible, kT:w ? w.kT : -1,
            ringsGone:W.__rings().every(r=>r.t<=0), rMeshHidden:!W.__rMesh().visible,
            markGone:!ch.classList.contains('hit') && !ch.classList.contains('critHit') && !ch.classList.contains('killHit')}; });
  ok('가라앉은 뒤 — FOV 는 74 로 돌아오고 섬광은 꺼진다', r2.fov === r.FOV0 && r2.kick === 0 && r2.flashOff, r2.fov+' · '+r2.kick);
  ok('밀림은 그리기가 되돌린다 (kT 가 0.16 에서 줄어든다)', r2.kT < 0.16, r2.kT);
  ok('고리·히트마커는 다 사라졌다 (고리 메시는 숨는다)', r2.ringsGone && r2.rMeshHidden && r2.markGone);
  const r3 = await pg.evaluate(new Function(SETUP + `
    let w = mk(); W.__setCrit(1); K.ownW[3]=true; W.__equipWeapon(3); W.__setThrowCd(0); W.__throw(); W.__setCrit(0);
    o.critMark = ch.classList.contains('critHit');
    o.critRing = W.__rings().some(r=>r.t>0 && r.c.getHex()===0xffd54a && r.r > 1.2);
    w = mk(); w.hp = 1; fire(3);
    o.killMark = ch.classList.contains('killHit');
    o.killRing = W.__rings().some(r=>r.t>0 && r.c.getHex()===0xffffff && r.r >= 2);
    o.killFov = W.__fovKick();
    return o;`));
  ok('★ 치명타 — 노란 X + 금색 큰 고리(1.5)', r3.critMark && r3.critRing);
  ok('★ 막타 예고 — 붉은 큰 X + 흰 큰 고리(2.4) + 시야 펀치 더', r3.killMark && r3.killRing && r3.killFov > 1.5, r3.killFov.toFixed(2));
  await pg.waitForFunction(()=>!window.__flash().visible, null, {timeout:8000}).catch(()=>{});
  const r4 = await pg.evaluate(new Function(SETUP + `
    const w = mk(); const f0 = W.__flashT(); fire(0); o.stoneHurt = w.hurt; o.stoneFlash = W.__flashT() > f0;   // 돌은 섬광을 새로 켜지 않는다
    G.wolves.length = 0; W.__setAim(false,true); W.__goDay(); return o;`));
  ok('맨손 돌도 맞는 순간 움찔은 바로, 섬광은 없다', r4.stoneHurt >= 0.17 && !r4.stoneFlash);
}
/* ═══════ ② 세계 마무리 — 흙길 · 연못·개울 · 산 실루엣 · 노을 띠 · 별 결 · 별똥별 ═══════
   선생님: "마당 흙길(문에서 수정까지), 연못이나 개울, 산 실루엣 다듬기, 밤하늘 노을·별 결." */
{
  const r = await pg.evaluate(()=>{ const W=window, G=W.__G, o={}, GY=W.__GY, HW=73, WS=147, gi=(x,z)=>(x+HW)+(z+HW)*WS;
    const d = W.__groundDisc(), P = d.geometry.attributes.position, C = d.geometry.attributes.color;
    o.verts = P.count;
    /* 흙길 — 성문마다 꺾은선이 있고, 단상 가장자리(5.6칸)에서 시작해 성문 너머(GATE_T+2.5)에서 끝난다 */
    const L = W.__pathLines(); o.paths = L.length;
    o.pathEnds = L.every(l => Math.max(Math.abs(l[0][0]), Math.abs(l[0][1])) <= 6 && Math.max(Math.abs(l[l.length-1][0]), Math.abs(l[l.length-1][1])) > 45);
    /* 길 위 꼭짓점은 흙색(r > g), 길에서 먼 꼭짓점은 풀색(g > r) — 격자를 훑어 센다 */
    let dirt=0, dirtOff=0, grassOn=0, blue=0, bed=0;
    for(let i=0;i<P.count;i++){ const x=P.getX(i), z=P.getZ(i), r=C.getX(i), g=C.getY(i), b=C.getZ(i);
      const pd = W.__pathDist(x,z), pr = Math.hypot(x-W.__POND.x, z-W.__POND.z), sd = W.__streamDist(x,z);
      if(pd < 1.0 && pr > 6 && sd > 2){ if(r > g) dirt++; else grassOn++; }
      if(pd > 3 && pr > 6 && sd > 2 && r > g) dirtOff++;
      if(sd < 0.6 && pr > W.__POND.r) { if(b > r && b > g) blue++; }
      if(pr < 1.5 && P.getY(i) < -0.25) bed++;
    }
    o.dirt = dirt; o.grassOn = grassOn; o.dirtOff = dirtOff; o.blue = blue; o.bed = bed;
    /* 연못 — 물 원판·물결 고리·갈대·연잎, 자원·꾸밈·농장·상인·통로에서 떨어져 있다 */
    const pm = W.__pond(), rp = W.__ripple(); o.pond = !!pm && pm.material.transparent && pm.material.opacity < 0.9 && !!rp;
    o.pondAt = pm ? +Math.hypot(pm.position.x - W.__POND.x, pm.position.z - W.__POND.z).toFixed(2) : 9;
    o.reeds = (W.__banks.get('reed')||{ms:[]}).ms.length; o.lilies = (W.__banks.get('lily')||{ms:[]}).ms.length;
    o.nodeNear = W.__NODES.filter(n => W.__waterNear(n.x, n.z, 0) || W.__pathDist(n.x, n.z) < 2.0).length;
    const S = W.__SHOP(), F = W.__FORGE(); o.landmarks = Math.min(Math.hypot(S.x-W.__POND.x, S.z-W.__POND.z), Math.hypot(F.x-W.__POND.x, F.z-W.__POND.z));
    o.pondFlat = W.__terrH[gi(Math.floor(W.__POND.x), Math.floor(W.__POND.z))] === GY;
    /* 산 실루엣 — 마루가 평평하지 않다: 둘레를 따라 높이가 오르내리고(최고 ≥ GY+18 → 눈 봉우리), 성문 앞은 그대로 평지 */
    let hmax = 0; const ring = [];
    for(let a=0; a<360; a+=3){ const rad = a*Math.PI/180; let best = 0;
      for(let rr=41; rr<61; rr++){ const x = Math.round(Math.cos(rad)*rr), z = Math.round(Math.sin(rad)*rr); if(x<-HW||x>HW||z<-HW||z>HW) continue;
        const h = W.__terrH[gi(x,z)]; if(h > best) best = h; }
      ring.push(best); if(best > hmax) hmax = best; }
    const mean = ring.reduce((a,b)=>a+b,0)/ring.length; o.ridgeSd = +Math.sqrt(ring.reduce((a,b)=>a+(b-mean)*(b-mean),0)/ring.length).toFixed(2);
    o.hmax = hmax - GY; o.snowCaps = (W.__banks.get('mtC')||{ms:[]}).ms.length > 0;
    o.gateFlat = [0,1,2,3,4].every(g => { const x = Math.round(W.__gX(g, 45, 0)), z = Math.round(W.__gZ(g, 45, 0)); return W.__terrH[gi(x,z)] === GY; });
    /* 하늘 — 큰별 층·노을 띠·별똥별 */
    const st = W.__stars(), sb = W.__starsB(); o.stars = st.geometry.attributes.position.count; o.starsB = sb.geometry.attributes.position.count;
    o.starCols = !!st.geometry.attributes.color && !!sb.geometry.attributes.color;
    /* 노을은 하늘 돔 그림(DataTexture)에 칠한다 — 0.5초에 한 번만 다시 칠하므로 updSky 에 0.6초를 준다 */
    const tex = W.__skyTex(); o.texData = !!tex.isDataTexture && tex.image.width === 64 && tex.image.height === 128;
    W.__setSky(0.5); W.__skyRepaintNow(); W.__updSky(0, true); const sp1 = W.__skyPaint(); o.duskOn = sp1.dusk >= 0.9; o.duskA = sp1.dusk;   // dt 0: skyK 그대로 0.5 → dusk 1
    /* 돔 그림 50줄(산마루 위)이 실제로 주황빛인가 — 아래에서 세는 DataTexture 라 r = 127-50 */
    const px = tex.image.data, i50 = ((127-50)*64 + 8)*4; o.duskPx = [px[i50], px[i50+1], px[i50+2]];
    o.starsDusk = st.material.opacity;
    W.__setSky(1.0); W.__skyRepaintNow(); W.__updSky(0, true); o.duskOffNight = W.__skyPaint().dusk === 0; o.starsNight = st.material.opacity; o.starsBNight = sb.material.opacity;
    W.__metFire(); W.__updSky(0.02, true); const mt = W.__meteor(); o.meteor = mt.visible && mt.material.opacity >= 0;
    W.__updSky(1.2, true); o.meteorGone = !mt.visible;
    W.__setSky(0); W.__skyRepaintNow(); W.__updSky(0, false); o.duskOffDay = W.__skyPaint().dusk === 0 && st.material.opacity === 0;
    return o; });
  ok('바닥 격자가 1칸(125×125 = 15625 꼭짓점)', r.verts === 125*125, r.verts);
  ok('★ 흙길 다섯 — 단상 가장자리에서 시작해 성문 너머에서 끝난다', r.paths === 5 && r.pathEnds);
  ok('★ 길 위 꼭짓점은 흙색이고 길 밖은 풀색이다', r.dirt > 150 && r.grassOn === 0 && r.dirtOff === 0, '길 위 흙 '+r.dirt+' · 길 위 풀 '+r.grassOn+' · 길 밖 흙 '+r.dirtOff);
  ok('★ 연못 — 반투명 물 원판이 연못 자리에, 물결 고리, 바닥은 오목(−0.25 아래)', r.pond && r.pondAt < 0.01 && r.bed > 0, r.pondAt+' · 오목 '+r.bed);
  ok('개울 — 연못 밖 개울 선 위 꼭짓점이 파랗다', r.blue >= 8, r.blue);
  ok('갈대 8포기 이상(줄기+이삭) · 연잎 6장', r.reeds >= 16 && r.lilies === 6, r.reeds+' · '+r.lilies);
  ok('★ 연못·개울·흙길 위에 자원(나무·바위·금)이 하나도 없다', r.nodeNear === 0, r.nodeNear);
  ok('연못은 상인·대장간에서 12칸 이상, 평지(GY)에 있다', r.landmarks > 12 && r.pondFlat, r.landmarks.toFixed(1));
  ok('★ 산 실루엣 — 둘레 마루 높이가 오르내리고(표준편차 ≥ 1.5) 봉우리는 GY+18 이상', r.ridgeSd >= 1.5 && r.hmax >= 18, '편차 '+r.ridgeSd+' · 최고 +'+r.hmax);
  ok('성문 자리(축 45칸)는 다섯 다 평지 그대로', r.gateFlat);
  ok('★ 별 두 층 — 잔별 520 · 큰별 70, 별마다 색', r.stars === 520 && r.starsB === 70 && r.starCols);
  ok('★ 노을 띠 — 해 질 녘(skyK 0.5)엔 돔 그림 산마루 줄이 주황(r > b)이고 한밤·한낮엔 안 칠한다', r.texData && r.duskOn && r.duskPx[0] > r.duskPx[2] + 40 && r.duskOffNight && r.duskOffDay, r.duskA+' · rgb '+r.duskPx.join(','));
  ok('밤엔 별이 켜지고 큰별은 따로 밝기가 있다', r.starsNight > 0.9 && r.starsBNight > 0.4 && r.starsDusk < r.starsNight);
  ok('★ 별똥별 — 밤에 불러내면 보이고 1초 뒤 사라진다', r.meteor && r.meteorGone);
}
/* ═══════ ③ 무서움의 온도 — 울음이 가까워진다 · 입구 쪽 붉은 하늘 · 보스 땅울림·발소리 ═══════
   선생님: "좀비 울음이 멀리서 가까워지는 소리, 우리 입구 쪽 하늘이 붉어지는 것, 보스가 산을 넘어오며 땅이 흔들리는 것." */
{
  const r = await pg.evaluate(()=>{ const W=window, G=W.__G, PL=W.__PL, o={};
    o.sfx = ['howl','stomp','rumble','boss'].every(k=>W.__SFXKEYS().includes(k));
    /* ① 울음 순서 — 낮 12초·6초, 밤 1.5초·+1.1초 */
    G.wolves.length = 0; W.__goDay(); G.phase = 'day'; G.t = 30; W.__dreadTick(0.1);
    o.h0 = W.__howlN();
    G.t = 11; W.__dreadTick(0.1); o.h1 = W.__howlN() - o.h0; o.s1 = W.__howlStage();
    W.__dreadTick(0.1); o.h1b = W.__howlN() - o.h0;                      // 같은 단계에선 다시 안 운다
    G.t = 5; W.__dreadTick(0.1); o.h2 = W.__howlN() - o.h0;
    G.phase = 'night'; G.t = G.set.nightSec; G.focus = 1; W.__dreadTick(1.6); o.h3 = W.__howlN() - o.h0; o.s3 = W.__howlStage();
    W.__dreadTick(1.2); o.h4 = W.__howlN() - o.h0; o.s4 = W.__howlStage();
    W.__dreadTick(5); o.h5 = W.__howlN() - o.h0;                          // 그다음은 18초 넘게 조용하다
    /* 좌우 팬 — 정면(-z)을 볼 때 오른쪽(+x) 소리는 팬 > 0 */
    PL.yaw = 0; W.__sfxFrom('howl', PL.x + 10, PL.z, 1); o.panR = W.__lastPan();
    W.__sfxFrom('howl', PL.x - 10, PL.z, 1); o.panL = W.__lastPan();
    /* ② 붉은 하늘 — 밤, 집중 입구 1(오른쪽, +x). 좀비가 없을 때 / 가까울 때 / 낮 */
    W.__setSky(1); G.phase = 'night'; G.focus = 1; G.wolves.length = 0;
    for(let i=0;i<6;i++) W.__updSky(1, true);
    W.__skyRepaintNow(); W.__updSky(0, true);
    const sp = W.__skyPaint(); o.tOn = sp.threat > 0.05; o.tFar = +W.__threatK().toFixed(3); o.tU = +sp.u.toFixed(3); o.uGate2 = +W.__skyU(45, 0).toFixed(3);
    const w = W.__spawnWolf(0, 1); w.x = 12; w.z = 0; w.y = PL.y;
    for(let i=0;i<6;i++) W.__updSky(1, true); o.tNear = +W.__threatK().toFixed(3);
    /* 좀비가 가까운 지금(진하다) 돔 그림에서 입구 2(+x, u 0.5) 쪽 50줄은 붉고(r ≫ b), 반대쪽(u 0.0)은 안 붉다 */
    W.__skyRepaintNow(); W.__updSky(0, true);
    const px = W.__skyTex().image.data, at = (x)=>{ const i = ((127-50)*64 + x)*4; return [px[i], px[i+1], px[i+2]]; };
    o.pxGate = at(32); o.pxAway = at(0);
    G.wolves.length = 0; G.phase = 'day'; W.__setSky(0); for(let i=0;i<8;i++) W.__updSky(1, false); o.tDay = W.__skyPaint().threat === 0;
    /* ③ 보스 — 보스 밤엔 보이기 전부터 땅이 떤다, 보이면 걸음마다 쿵(가까울수록 세게) */
    const bd = W.__bossDays(); o.bossDay = bd[0];
    const day0 = G.day; G.day = bd[0]; G.phase = 'night'; G.t = G.set.nightSec*0.7; G.wolves.length = 0;
    W.__shakeReset(); W.__dreadTick(0.1);                                  // 낮→밤 첫 틱: 상태 초기화 + 첫 땅울림
    o.trem = +W.__shakeT().toFixed(2);
    const bossK = W.__WOLF_T.findIndex(t=>t.boss);
    const bw = W.__spawnWolf(bossK, 1); bw.x = PL.x + 6; bw.z = PL.z; bw.y = PL.y; bw.mv = true;
    W.__shakeReset(); for(let i=0;i<3;i++) W.__dreadTick(0.4); o.stompNear = +W.__shakeT().toFixed(2);
    bw.x = PL.x + 200; W.__shakeReset(); for(let i=0;i<3;i++) W.__dreadTick(0.4); o.stompFar = +W.__shakeT().toFixed(2);
    /* 손님 화면 — 보스가 처음 보이면 흔들린다 */
    G.wolves.length = 0; W.__shakeReset();
    W.__applySim({c: Math.round(G.crystal*10), w: [777, bossK, 80*8, 0, 0, 500, 1].join(','), s: ''});
    o.guestBoss = +W.__shakeT().toFixed(2); o.guestHas = G.wolves.some(x=>x.id===777);
    G.wolves.length = 0; G.day = day0; W.__goDay();
    return o; });
  ok('소리표에 howl · stomp · rumble · boss 가 있다', r.sfx);
  ok('★ 울음이 가까워진다 — 낮 12초 한 번(1단계), 6초 한 번 더, 밤 1.5초 어귀에서, 1.1초 뒤 다른 놈이 받는다', r.h0 === 0 && r.h1 === 1 && r.h1b === 1 && r.h2 === 2 && r.h3 === 3 && r.h4 === 4, [r.h1, r.h2, r.h3, r.h4].join('/')+' · 단계 '+r.s1+'→'+r.s3+'→'+r.s4);
  ok('그다음 5초 동안은 조용하다 (먼 울음은 18~30초마다)', r.h5 === 4, r.h5);
  ok('★ 소리에 좌우가 있다 — 오른쪽 소리 팬 > 0, 왼쪽 < 0', r.panR > 0.5 && r.panL < -0.5, r.panR+' / '+r.panL);
  ok('★ 밤엔 집중 입구 쪽 하늘이 붉다 — 돔 그림의 입구 2(+x · u 0.5) 쪽 50줄이 붉고 반대쪽은 아니다', r.tOn && r.tFar > 0.1 && r.tU === r.uGate2 && r.pxGate[0] > r.pxGate[2] + 40 && r.pxAway[2] >= r.pxAway[0], r.tFar+' · u '+r.tU+' · 입구 rgb '+r.pxGate.join(',')+' · 반대 '+r.pxAway.join(','));
  ok('★ 좀비가 수정에 가까우면 더 붉다', r.tNear > r.tFar + 0.15, r.tFar+' → '+r.tNear);
  ok('낮엔 꺼진다', r.tDay);
  ok('★ 보스 밤 — 보스가 보이기 전부터 땅이 떤다 (첫 틱에 땅울림)', r.trem > 0, r.trem+' (보스 날 '+r.bossDay+')');
  ok('★ 보스가 보이면 걸음마다 쿵 — 6칸이면 흔들리고 200칸이면 안 흔들린다', r.stompNear > 0 && r.stompFar === 0, r.stompNear+' / '+r.stompFar);
  ok('★ 손님 화면도 보스가 처음 보이면 크게 흔들린다 (1초)', r.guestHas && r.guestBoss >= 0.9, r.guestBoss);
}
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
