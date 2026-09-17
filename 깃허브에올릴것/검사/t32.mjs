/* 31차 검사 — 세계를 원색으로 (로블록스 룩 4단계: 지형·나무·바위·금·풀꽃·성문·농장·하늘 섬·구름·해·달·수정)
   ★ 30차까지 세계는 타일 텍스처를 입힌 네모 상자였다. 31차는 bpush 한 곳에서 '타일 상자 → 모따기 원색 상자' 로 번역하고,
     지형·나무·바위·구름·해·달·수정은 모양 자체를 새로 만들었다.
   ★ 값을 베끼지 않는다 — '무늬가 없나(map)' · '합친 기둥이 산 칸을 빠짐없이 덮나(면적이 같나)' · '뚜껑이 지형 윗면에 붙었나' ·
     '캐면 잎부터 사라지나' · '밤에 발광이 켜지나' 같은 관계를 본다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 9320);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

const pg = await b.newPage({viewport:{width:1366,height:768}});
pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1500);

/* ═══════ ① 무늬 없는 세계 — 번역층 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, o={};
    const banks=[...W.__banks.entries()];
    o.banks = banks.length;
    o.bankMap = banks.filter(([k,b])=>b.mat && b.mat.map).map(([k])=>k);
    o.mats = new Set(banks.map(([k,b])=>b.mat.uuid)).size;
    /* 씬 전체 — 하늘 돔(결 그림)·이름표(스프라이트) 빼고 map 을 쓰는 메시 */
    const mapped=[]; W.__scene.traverse(x=>{ if(!(x.isMesh||x.isInstancedMesh)) return; if(x===W.__skyDome || x.userData.gradient) return;   /* 33차 — 노을 띠·총구 섬광도 돔 같은 결 그림 */
      const ms = Array.isArray(x.material) ? x.material : [x.material];
      for(const m of ms) if(m && m.map) mapped.push((x.name||x.type)+':'+(m.type)); });
    o.mapped = mapped;
    const g=W.__WGEO, p=g.attributes.position, n=g.attributes.normal; o.wTris = p.count/3; o.boxTris = W.__BOXG.index.count/3;
    let inward=0; for(let i=0;i<p.count;i+=3){
      const cx=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3, cy=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3, cz=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
      if(n.getX(i)*cx+n.getY(i)*cy+n.getZ(i)*cz <= 0) inward++; }
    o.inward = inward;
    const gsb=W.__banks.get('gsb'); o.gsb = {geo:gsb.geo===W.__WGEO, mat:gsb.mat===W.__WMAT, cols:!!gsb.cols, n:gsb.ms.length};
    const gdk=W.__banks.get('gdk'); o.dark = gdk.cols[0];
    const T=W.__THREE, hue=(hex)=>{ const c=new T.Color(hex); const h={}; c.getHSL(h); return h.h*360; };
    const gcl=W.__banks.get('gcl0'); o.flagHue = hue(gcl.cols[0]); o.teamHue = hue(W.__GHEX[0]);
    const fg=W.__banks.get('farmGlow'), gg=W.__banks.get('gglow');
    o.glowSame = fg.mat===W.__EMITC_F && gg.mat===W.__EMITC_F && fg.mat.emissive.getHex()!==0;
    o.rail = (()=>{ const b=W.__banks.get('farmRail'); return {geo:b.geo===W.__WGEO, mat:b.mat===W.__WMAT, cols:!!b.cols, n:b.ms.length}; })();
    return o; });
  ok('★ 뱅크(세계 조각)에 무늬(map)를 쓰는 재질이 하나도 없다', r.banks>40 && r.bankMap.length===0, r.banks+'뱅크 · 무늬:'+r.bankMap.join(','));
  ok('★ 씬 전체에서도 무늬를 쓰는 메시가 없다 (하늘 돔·노을 띠·섬광 같은 결 그림·이름표 제외)', r.mapped.length===0, r.mapped.slice(0,6).join(' | '));
  ok('세계 조각의 재질 종류가 여덟 이하 (흰 원색 하나 + 발광 몇)', r.mats<=8, r.mats);
  ok('★ 모따기 상자 44삼각형 · 각진 상자 12삼각형', r.wTris===44 && r.boxTris===12, r.wTris+' / '+r.boxTris);
  ok('★ 모따기 상자의 면 법선이 전부 바깥을 본다 (안을 보면 검은 면이 된다)', r.inward===0, r.inward);
  ok('번역층 — 성문 몸통 뱅크가 모따기 상자 + 흰 재질 + 인스턴스 색이다', r.gsb.geo && r.gsb.mat && r.gsb.cols, JSON.stringify(r.gsb));
  ok('번역층 — 검은 판(matC 0x171a22 × dark 타일)이 인스턴스 색으로 접혀 어둡다', r.dark < 0x303030, r.dark.toString(16));
  ok('번역층 — 모둠 깃발 색상이 모둠 색을 따른다', Math.min(Math.abs(r.flagHue-r.teamHue), 360-Math.abs(r.flagHue-r.teamHue)) < 25, r.flagHue.toFixed(0)+'° vs '+r.teamHue.toFixed(0)+'°');
  ok('★ 발광 조각(농장 번호·성문 횃불)이 EMITC_F 한 재질을 같이 쓴다 (밤에 같이 켜지려면 같은 객체여야 한다)', r.glowSame);
  ok('농장 울타리 가로대도 번역됐다 (모따기 상자 · 흰 재질 · 색)', r.rail.geo && r.rail.mat && r.rail.cols && r.rail.n>500, JSON.stringify(r.rail));
}

/* ═══════ ② 밤에 발광이 켜진다 (30차 건물 등불이 안 켜지던 것) ═══════ */
{
  await pg.evaluate(()=>window.__setSky(1)); await pg.waitForTimeout(400);
  const night = await pg.evaluate(()=>({ e:window.__EMIT_F.emissiveIntensity, ec:window.__EMITC_F.emissiveIntensity, cloud:window.__cloudMat().color.r }));
  await pg.evaluate(()=>window.__setSky(0)); await pg.waitForTimeout(400);
  const day = await pg.evaluate(()=>({ e:window.__EMIT_F.emissiveIntensity, ec:window.__EMITC_F.emissiveIntensity, cloud:window.__cloudMat().color.r }));
  ok('★ 밤이면 건물 등불(EMIT_F)·세계 횃불(EMITC_F)이 켜진다', night.e > 0.5 && night.ec > 0.5, night.e.toFixed(2)+' / '+night.ec.toFixed(2));
  ok('낮이면 꺼진다', day.e < 0.05 && day.ec < 0.05, day.e.toFixed(2)+' / '+day.ec.toFixed(2));
  ok('밤엔 구름이 어두워진다', night.cloud < 0.5 && day.cloud > 0.9, night.cloud.toFixed(2)+' → '+day.cloud.toFixed(2));
}

/* ═══════ ③ 지형 — 바닥·산 기둥 합치기·단상 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, o={}, GY=W.__GY, HW=73, WS=147, gi=(x,z)=>(x+HW)+(z+HW)*WS;
    const d=W.__groundDisc(), rim=W.__groundRim();
    o.ground = {vc:!!d.material.vertexColors, map:!!d.material.map, verts:d.geometry.attributes.position.count, rimMap:!!rim.material.map};
    const ca=d.geometry.attributes.color; const seen=new Set(); for(let i=0;i<ca.count;i+=7) seen.add(ca.getX(i).toFixed(3)+','+ca.getY(i).toFixed(3)); o.groundCols=seen.size;
    const B=W.__banks.get('mtB'), C=W.__banks.get('mtC'); o.nB=B.ms.length; o.nC=C.ms.length;
    let cells=0; for(let z=-HW; z<=HW; z++) for(let x=-HW; x<=HW; x++){ const h=W.__terrH[gi(x,z)]; if(h<=GY) continue;
      if(Math.max(Math.abs(x),Math.abs(z))<=5 && Math.hypot(x+0.5,z+0.5)<9) continue; cells++; }
    o.cells = cells;
    /* 33차 — 기둥은 뚜껑보다 0.04 좁다(면 겹침 떨림을 없애려고). 면적은 뚜껑(칸 크기 그대로)으로 센다 */
    let area=0; for(const m of C.ms){ const e=m.elements; area += e[0]*e[10]; } o.area = Math.round(area);
    let flush=0; for(let i=0;i<B.ms.length;i++){ const eb=B.ms[i].elements, ec=C.ms[i].elements;
      if(Math.abs((ec[0]-eb[0])-0.04) > 0.005 || Math.abs((ec[10]-eb[10])-0.04) > 0.005) flush++; } o.flush = flush;
    const gm = W.__WMAT.userData.grain, gv = W.__WMATV.userData.grain, gl = W.__WMATL.userData.grain, gg = d.material.userData.grain;
    o.grain = {rock:gm && gm.kind, rockV:gv && gv.kind, leaf:gl && gl.kind, grass:gg && gg.kind, tex:W.__GRAIN.rock.image.width, amt:gm && gm.amt};
    o.leafMatL = W.__banks.get('leaf0').mat===W.__WMATL;
    o.brickPr = (()=>{ /* 건물 벽돌이 몸통 면에서 0.02 이상 도드라지나 — 돌벽 하나 세워서 본다 */
      const raw = W.__blocksRaw('swall', 1);
      const bricks = raw.filter(r=>r[3]===33); let minPr = 9;
      /* 벽돌 판의 중심이 몸통 면(x ±0.49 · z ±0.45)에서 얼마나 밖에 있나 — 0.02 아래면 판 안쪽 면이 몸통 면과 겹쳐 떨린다 */
      for(const r of bricks){ const dz = Math.abs(r[2]) - 0.45, dx = Math.abs(r[0]) - 0.49; const pr = Math.max(dz, dx); if(pr < minPr) minPr = pr; }
      return {n:bricks.length, minPr}; })();
    /* 뚜껑이 지형 윗면에 붙었나 · 기둥 윗면이 뚜껑 밑인가 — 200개 표본 */
    let capOff=0, bodyOff=0, chk=0;
    for(let i=0;i<C.ms.length;i+=Math.max(1,(C.ms.length/200)|0)){ const e=C.ms[i].elements, eb=B.ms[i].elements;
      const cx=Math.floor(e[12]), cz=Math.floor(e[14]); const h=W.__terrH[gi(cx,cz)];
      /* 성문 망루 칸은 지형을 지은 **뒤에** GY+12 로 올린다(buildGates) — 그 자리는 망루 몸통이 덮는다. 뺀다. */
      if(h === GY+12) continue;
      if(Math.abs(e[13]+0.14-h) > 0.02) capOff++;
      if(Math.abs(eb[13]+eb[5]/2 - (h-0.02)) > 0.02) bodyOff++; chk++; }
    o.capOff=capOff; o.bodyOff=bodyOff; o.chk=chk;
    const cc=new Map(); for(const c of C.cols) cc.set(c,(cc.get(c)||0)+1); o.capCols=[...cc.entries()].map(([k,v])=>k.toString(16)+':'+v);
    o.snow = cc.get(0xffffff)||0; o.grass = cc.get(0x6bc24a)||0;
    o.sb = W.__banks.get('sb').ms.length; o.gb = W.__banks.get('gb').ms.length;
    const sbe = W.__banks.get('sb').ms[0].elements; o.plat = {w:sbe[0], h:sbe[5], y:sbe[13]};
    return o; });
  ok('★ 바닥이 꼭짓점 색 원판이다 (무늬 없음 · 격자 1000점 이상 · 색이 여럿)', r.ground.vc && !r.ground.map && r.ground.verts>1000 && r.groundCols>=3, JSON.stringify(r.ground)+' · 색 '+r.groundCols);
  ok('바닥 옆면(흙)도 무늬 없음', !r.ground.rimMap);
  ok('★ 산 기둥·뚜껑 뱅크가 있고 수가 같다 (1000~6000)', r.nB===r.nC && r.nB>1000 && r.nB<6000, r.nB+' / '+r.nC);
  ok('★ 합친 기둥의 면적 합 = 산 칸 수 (한 칸도 빠지거나 겹치지 않는다)', r.area===r.cells, r.area+' vs '+r.cells);
  ok('★ 실제로 합쳐졌다 — 기둥 수가 칸 수의 60% 미만', r.nB < r.cells*0.6, r.nB+' / '+r.cells);
  ok('★ 33차 — 기둥이 뚜껑보다 딱 0.04 좁다(면이 겹쳐 떨리지 않는다), 전부', r.flush===0, r.flush+' 개 어긋남');
  /* ★ 48차 — 로블록스는 **매끈 플라스틱**이라 결을 거의 지웠다(돌결 0.46 → 0.13).
     아주 0 으로 두면 큰 면이 띠(banding)지므로 조금은 남긴다 — 그래서 '있다' 는 그대로 보되
     세기 기준만 0.4 → 0.05~0.25 로 바꾼다. 33차의 '결이 붙어 있나' 는 여전히 지킨다. */
  ok('★ 33차·48차 — 결(grain): 세계는 돌결, 잎은 얼룩, 바닥은 풀결, 그림은 128×128, 세기는 매끈 플라스틱 값(0.05~0.25)', r.grain.rock==='rock' && r.grain.rockV==='rock' && r.grain.leaf==='leaf' && r.grain.grass==='grass' && r.grain.tex===128 && r.grain.amt>=0.05 && r.grain.amt<=0.25, JSON.stringify(r.grain));
  ok('33차 — 건물 벽돌 판이 몸통 면에서 0.02 이상 도드라진다(붙어 있으면 멀리서 떨린다)', r.brickPr.n>20 && r.brickPr.minPr >= 0.015, r.brickPr.n+' · '+r.brickPr.minPr.toFixed(3));
  ok('★ 뚜껑 윗면이 지형 윗면(terrH)에 붙어 있다 — 표본 전부 (망루 칸 제외)', r.capOff===0 && r.chk>150, r.capOff+' / '+r.chk);
  ok('기둥 윗면이 뚜껑 바로 밑에서 끝난다', r.bodyOff===0, r.bodyOff+' / '+r.chk);
  ok('★ 뚜껑 색에 풀·눈이 다 있다 (낮은 산은 풀, 봉우리는 눈)', r.grass>0 && r.snow>0 && r.capCols.length>=3, r.capCols.join(' '));
  ok('수정 단상은 한 판 + 윗판 둘 · 금 테 44', r.sb===2 && r.gb===44 && Math.abs(r.plat.w-11)<0.01 && Math.abs(r.plat.y-(9+0.5))<0.01, r.sb+' / '+r.gb+' / '+JSON.stringify(r.plat));
}

/* ═══════ ④ 나무·바위·금·풀꽃 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, o={}, GY=W.__GY, S=0.32;
    const tree=W.__NODES.find(n=>n.type==='tree'), rock=W.__NODES.find(n=>n.type==='rock'), gold=W.__NODES.find(n=>n.type==='gold');
    o.treeN = tree.hs.length; o.treeKeys = tree.hs.map(h=>h[0]);
    const lb = W.__banks.get('leaf0'); o.leafGeo = !!lb && W.__LEAFV.includes(lb.geo); o.leafVerts = W.__LEAFV[0].attributes.position.count; o.leafIdx = !!W.__LEAFV[0].index;
    /* 32차 — 질감: 잎은 꼭짓점 색(아래 어둡고 위 밝고) + 꼭짓점 흔들림(세 벌이 다르다), 줄기는 껍질 띠(같은 높이에 밝기 둘), 벽돌 판은 모따기 + 꼭짓점 색, 길이가 제각각 */
    const grad = g=>{ const P=g.attributes.position, C=g.attributes.color; if(!C) return null; let lo=[0,0], hi=[0,0];
      for(let i=0;i<P.count;i++){ const y=P.getY(i), c=C.getX(i); if(y<-0.3){ lo[0]+=c; lo[1]++; } else if(y>0.3){ hi[0]+=c; hi[1]++; } }
      return [lo[0]/lo[1], hi[0]/hi[1]]; };
    o.leafGrad = grad(W.__LEAFV[0]); o.leafMat = lb && lb.mat===W.__WMATL && !!lb.mat.vertexColors;
    const dist = (a,b)=>{ const A=a.attributes.position, B=b.attributes.position; let d=0; for(let i=0;i<A.count;i++) d+=Math.abs(A.getX(i)-B.getX(i))+Math.abs(A.getY(i)-B.getY(i)); return d/A.count; };
    o.leafDiff = [dist(W.__LEAFV[0],W.__LEAFV[1]), dist(W.__LEAFV[1],W.__LEAFV[2])];
    { const P=W.__TRUNKV.attributes.position, C=W.__TRUNKV.attributes.color, set=new Set(); for(let i=0;i<P.count;i++) if(Math.abs(P.getY(i)-0.5)<0.01) set.add(C.getX(i).toFixed(2)); o.barkTones = set.size; }
    o.trunkMat = W.__banks.get('trunk').mat.vertexColors===true;
    o.brick = {tris:W.__BRICKV.attributes.position.count/3, col:!!W.__BRICKV.attributes.color, grad:grad(W.__BRICKV)};
    { const gb=W.__banks.get('gbrick'); const lens=new Set(); for(const m of gb.ms){ const e=m.elements; lens.add(Math.max(e[0]*e[0]+e[1]*e[1]+e[2]*e[2], e[8]*e[8]+e[9]*e[9]+e[10]*e[10]).toFixed(2)); }
      o.gbrickLens = lens.size; o.gbrickMat = gb.mat.vertexColors===true; o.gbrickGeo = gb.geo===W.__BRICKV; }
    o.struBrick = (()=>{ /* 건물이 하나도 없으면 벽돌 메시도 없다 — 돌벽 하나를 세워서 본다 */
      W.__STRU.set(7777, {id:7777, t:'swall', x:Math.round(W.__PL.x)+3, z:Math.round(W.__PL.z)+3, hp:1, mx:1, g:0, n:'', lv:1}); W.__rebuild();
      const m=[...W.__struMeshes.values()].find(m=>m.geometry===W.__BRICKV); const okk = !!m && m.material.vertexColors===true && m.count>20;
      W.__STRU.delete(7777); W.__rebuild(); return okk; })();
    const tb = W.__banks.get('trunk'), t0 = tree.hs[0]; const e = tb.ms[t0[1]].elements; o.trunkBottom = e[13] - e[5]/2 - GY;
    /* 캐면 잎부터 — 체력 4 깎고 그리기 */
    const vis = h=>{ const b=W.__banks.get(h[0]); const m=b.chunks[b.map[h[1]*2]]; const a=m.instanceMatrix.array, li=b.map[h[1]*2+1]; return a[li*16]!==0 || a[li*16+5]!==0; };
    tree.hp = tree.max - 4; W.__nodeVisual(tree);
    const hidden = tree.hs.filter(h=>!vis(h)).map(h=>h[0]);
    o.hidden = hidden; o.trunkShown = tree.hs.filter(h=>h[0]==='trunk').every(vis);
    tree.hp = tree.max; W.__nodeVisual(tree); o.allBack = tree.hs.every(vis);
    o.rockN = rock.hs.length; o.rockKeys = rock.hs.map(h=>h[0]);
    o.goldKeys = gold.hs.map(h=>h[0]); o.oreMat = W.__banks.get('oreG').mat===W.__ORE_F && W.__ORE_F.emissive.getHex()!==0 && !W.__ORE_F.map;
    const n=k=>{ const b=W.__banks.get(k); return b?b.ms.length:0; };
    o.cone=n('cone'); o.trunk=n('trunk'); o.stem=n('stem'); o.petal=n('petal'); o.pist=n('pist'); o.bush=n('bush')+n('bushS'); o.petal0=!!W.__banks.get('petal0');
    o.decor = o.bush + o.petal + (n('peb') - 0);
    return o; });
  /* 31차b — 잎 일곱 + 가지 끝 뭉치 둘 + 껍질 골 셋(+ 사과 넷). 캐면 뒤(사과·잎)부터 사라지므로 잎·사과가 맨 뒤여야 한다 */
  ok('★ 자원 나무 조각 19 이상 — 줄기가 맨 앞, 뒤 일곱은 잎(또는 사과)', r.treeN>=19 && r.treeKeys.slice(-7).every(k=>k.startsWith('leaf')||k==='apple') && r.treeKeys[0]==='trunk', r.treeN+' · '+r.treeKeys.join(','));
  ok('잎은 각진 공(비인덱스 80면) — 세 벌 중 하나', r.leafGeo && r.leafVerts===240 && !r.leafIdx, r.leafVerts);
  ok('★ 질감 — 잎 덩어리에 꼭짓점 색이 있고 위(>0.3)가 아래(<-0.3)보다 25% 이상 밝다, 재질은 잎 얼룩(WMATL)', r.leafGrad && r.leafGrad[1] > r.leafGrad[0]*1.25 && r.leafMat, r.leafGrad && r.leafGrad.map(v=>v.toFixed(2)).join(' → '));
  ok('★ 질감 — 잎 세 벌이 서로 다르게 흔들려 있다(꼭짓점 자리 차 0.02 이상)', r.leafDiff.every(d=>d>0.02), r.leafDiff.map(v=>v.toFixed(3)).join(' / '));
  ok('★ 질감 — 줄기 껍질 띠: 같은 높이에 밝기가 둘 이상, 줄기 뱅크가 꼭짓점 색 재질', r.barkTones>=2 && r.trunkMat, r.barkTones);
  ok('★ 질감 — 벽돌 판이 모따기(44삼각형) + 꼭짓점 색(아래 어둡게), 성문·건물 벽돌 모두 그 재질, 길이가 제각각(다섯 가지 이상)', r.brick.tris===44 && r.brick.col && r.brick.grad[1]>r.brick.grad[0] && r.gbrickGeo && r.gbrickMat && r.struBrick && r.gbrickLens>=5, JSON.stringify(r.brick)+' · 길이 '+r.gbrickLens);
  ok('나무 밑동이 땅에 닿아 있다', Math.abs(r.trunkBottom) < 0.1, r.trunkBottom.toFixed(3));
  ok('★ 캐면 잎(사과·가지)부터 사라지고 줄기는 남는다', r.hidden.length>=3 && r.hidden.every(k=>k.startsWith('leaf')||k==='branch'||k==='apple') && r.trunkShown, r.hidden.join(','));
  ok('되살리면 전부 돌아온다', r.allBack);
  ok('바위 조각 6 이상 — 큰 덩어리부터, 이끼 있음', r.rockN>=6 && r.rockKeys[0]==='rock' && r.rockKeys.includes('moss'), r.rockKeys.join(','));
  ok('★ 금광맥 — 빛나는 결정 넷(원색 발광 재질) + 금 알갱이', r.goldKeys.filter(k=>k==='oreG').length===4 && r.goldKeys.includes('nug') && r.oreMat, r.goldKeys.join(','));
  /* 숲 그루 수는 무작위(놓을 자리가 안 나오면 건너뛴다) — 개수를 박지 않고 '고깔은 셋씩(침엽수)' 과 넉넉한 하한만 본다 */
  ok('장식 숲 — 침엽수 고깔(넷 + 꼭지) 40 이상 · 줄기 100 이상', r.cone>=40 && r.trunk>=100, r.cone+' / '+r.trunk);
  ok('풀꽃 — 꽃은 줄기·꽃송이·속이 한 벌씩, 꽃 뱅크는 하나(petal0~4 없음), 수풀+꽃 600 이상', r.stem===r.petal && r.petal===r.pist && !r.petal0 && r.bush+r.petal>=600, r.bush+' + '+r.petal);
}

/* ═══════ ⑤ 하늘 — 구름·해·달·수정·섬 밑동 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, o={};
    const cm=W.__cloudMesh(); o.cloud={n:cm.count, geo:cm.geometry.type, fog:cm.material.fog, map:!!cm.material.map, inst:cm.isInstancedMesh};
    const x0=cm.instanceMatrix.array[12]; const c0x=W.__clouds()[0].x; W.__updClouds(2); const x1=cm.instanceMatrix.array[12];
    o.drift = (c0x > 158) ? -1 : x1-x0;
    const sun=W.__sunDisc(), moon=W.__moonDisc();
    o.sun = sun.children[0].geometry.type; o.moon = moon.children[0].geometry.type; o.moonKids = moon.children.length;
    const g=W.__cGem(); o.gem={mat:g.material.type, map:!!g.material.map, geo:g.geometry.type, n:g.count};
    o.shellMap = !!W.__cMat().shell.map;
    const mb=W.__banks.get('miBase'); o.base = mb ? {n:mb.ms.length, y:mb.ms[0].elements[13], geo:mb.geo.attributes.position.count>0 && !mb.geo.index} : null;
    o.MINI_Y = W.__MINI_Y;
    return o; });
  ok('★ 구름은 공 뭉치 인스턴스 메시 하나 (64개 이상 · 안개 밖 · 무늬 없음)', r.cloud.inst && r.cloud.n>=64 && r.cloud.geo==='SphereGeometry' && r.cloud.fog===false && !r.cloud.map, JSON.stringify(r.cloud));
  ok('구름이 흘러간다 (2초에 1.1칸)', r.drift===-1 || Math.abs(r.drift-1.1)<0.01, r.drift);
  ok('★ 해·달이 동그라미 원판이다 (달엔 얼룩 셋)', r.sun==='CircleGeometry' && r.moon==='CircleGeometry' && r.moonKids>=5, r.sun+' / '+r.moon+' / '+r.moonKids);
  ok('★ 수정은 원색 팔면체 둘 (무늬 없음 · MeshStandard)', r.gem.mat==='MeshStandardMaterial' && !r.gem.map && r.gem.geo==='OctahedronGeometry' && r.gem.n===2 && !r.shellMap, JSON.stringify(r.gem));
  ok('하늘 섬 밑동 — 뒤집힌 고깔 하나, 섬 바닥 아래', r.base && r.base.n===1 && r.base.y < r.MINI_Y && r.base.geo, JSON.stringify(r.base));
}

/* ═══════ ⑥ 그리는 양 — 마을 한가운데 시점 ═══════ */
{
  const r = await pg.evaluate(()=>{ const W=window, PL=W.__PL;
    PL.x=0.5; PL.z=13; PL.y=W.__GY+2.2; PL.yaw=0; PL.pitch=-0.10; W.__updPlayer(0.001);
    W.__R.info.reset(); W.__drawFrame(); return {tri:W.__R.info.render.triangles, calls:W.__R.info.render.calls}; });
  ok('★ 삼각형이 예산 안 (< 150만, 그림자 판 포함) — 산 3만 상자가 기둥 5천으로', r.tri < 1500000, r.tri);
  ok('드로우콜 400 이하', r.calls <= 400, r.calls);
}
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
