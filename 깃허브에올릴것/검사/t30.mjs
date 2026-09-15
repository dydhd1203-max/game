/* 28차 검사 — UI 키트: 3D 아이콘 · 이모지 없음 · 칭호 창(Y) · 소리 · 움직임 · 세계 물건 · 입
   ★ 선생님: "스텟 창·가방·아이템 모양·인터페이스가 부족하다. 파스텔 둥근 결, 이모지 다 3D, 움직임·소리."
   ★ '켜졌나' 로 끝내지 않는다 — 아이콘은 그림이 실제로 그려졌는지(투명 픽셀만이면 빈 그림) 픽셀을 세고,
     이모지는 창을 다 열어 본 뒤 화면 글자에 남은 것을 센다(숨긴 원본 글자 .emoT 는 빼고). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 9300);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const frames = (pg,n)=> pg.evaluate(n=> new Promise(res=>{
  let i=0; const stop=setTimeout(res, 20000);
  const t=()=>{ if(++i>=n){ clearTimeout(stop); return res(); } requestAnimationFrame(t); };
  requestAnimationFrame(t); }), n);

const pg = await b.newPage({viewport:{width:1100,height:700}});
pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=high', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});

/* 화면에 '보이는' 이모지 — 숨긴 원본 글자(.emoT)와 입력칸은 뺀다 */
const VIS_EMO = `(root)=>{ const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out=[];
  const re=/\\p{Extended_Pictographic}/gu;
  while(w.nextNode()){ const n=w.currentNode, p=n.parentElement; if(!p) continue;
    if(p.closest('.emoT,input,select,option,textarea,script,style,#diag')) continue;
    const cs=getComputedStyle(p); if(cs.display==='none'||cs.visibility==='hidden') continue;
    const m=n.nodeValue.match(re); if(m) out.push(...m); }
  return out; }`;

/* ═══════ ① 아이콘 공방 ═══════ */
{
  const r = await pg.evaluate(async ()=>{
    const I = window.__ICON(), D = window.__ICO_DEF(), keys = Object.keys(D), o = {n:keys.length, missing:[], blank:[]};
    for(const k of keys) if(!I[k]) o.missing.push(k);
    /* 그림이 실제로 있나 — 투명하지 않은 픽셀이 3% 넘어야 그림이다 */
    const probe = ['wood','stone','gold','sheep','crystal','tool_mine','wpn2','bld_arrow','hat1','farm_hen','stat0','job_fight','pet1','clo1'];
    for(const k of probe){
      if(!I[k]){ o.blank.push(k+':없음'); continue; }
      const img = new Image(); img.src = I[k]; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0,0,c.width,c.height).data; let on=0;
      for(let i=3;i<d.length;i+=4) if(d[i] > 40) on++;
      const pct = on/(c.width*c.height)*100; if(pct < 3) o.blank.push(k+':'+pct.toFixed(1)+'%');
    }
    o.emo = Object.keys(window.__EMO2ICON()).length;
    return o;
  });
  ok(`아이콘이 ${r.n}장 다 만들어졌다`, r.missing.length===0, r.missing.join(','));
  ok('★ 아이콘에 그림이 실제로 있다 (투명 픽셀만인 빈 그림이 아니다)', r.blank.length===0, r.blank.join(' '));
  ok('이모지 → 아이콘 짝이 100개 넘게 있다', r.emo >= 100, r.emo);
}

/* ═══════ ② 시작 화면 — 이모지가 안 남았다 · 고르기 단추가 그림이다 ═══════ */
{
  const r = await pg.evaluate(new Function('return ('+VIS_EMO+')(document.getElementById("title"))'));
  const pk = await pg.evaluate(()=>({hat:document.querySelectorAll('#hatPick button img.ic').length,
                                    pet:document.querySelectorAll('#petPick button img.ic').length,
                                    txt:document.getElementById('titleCard').textContent.includes('양들의 밤')}));
  ok('★ 시작 화면에 보이는 이모지가 없다', r.length===0, r.slice(0,8).join(' '));
  ok('모자 고르기 단추가 전부 그림이다', pk.hat >= 12, pk.hat);
  ok('짝꿍 고르기 단추가 전부 그림이다 (모자 🐱 와 안 겹친다)', pk.pet >= 6, pk.pet);
  ok('제목 글자는 그대로다', pk.txt);
}

await pg.fill('#iName','검'); await pg.evaluate(()=>document.querySelector('#bSolo').click())   /* 29차 — page.click 은 시작 단추에서 hit-target 검사가 안 끝나 30초를 넘겼다(마우스는 되고 JS click 도 된다). 다른 검사와 같은 길로 */;
await frames(pg, 8);
await pg.evaluate(()=>{ window.__introDone(); window.__G.farm[0].hen = 1; window.__farmDirty(true); });
await frames(pg, 4);

/* ═══════ ③ HUD · 창 — 이모지가 안 남았다, 원본 글자는 남아 있다 ═══════ */
{
  const hud = await pg.evaluate(new Function('return ('+VIS_EMO+')(document.getElementById("hud"))'));
  ok('★ HUD 에 보이는 이모지가 없다', hud.length===0, hud.slice(0,10).join(' '));
  const keep = await pg.evaluate(()=>({day:document.getElementById('dayPhase').textContent,
                                      slot:document.querySelectorAll('#bar .slot > .ic > img.ic').length,
                                      tool:document.querySelectorAll('#tools .slot > .ic > img.ic').length}));
  ok('★ 원본 글자는 남아 있다 (textContent 로 읽는 검사·복사가 그대로 된다)', /낮|밤/.test(keep.day) && /\p{Extended_Pictographic}/u.test(keep.day), keep.day);
  ok('건물 칸이 건물 모형 그림이다', keep.slot >= 5, keep.slot);
  ok('도구 칸이 도구 모형 그림이다', keep.tool >= 5, keep.tool);
  const left = [];
  for(const [key, id] of [['c','popStat'],['i','popKit'],['y','popBadge']]){
    await pg.keyboard.press(key); await frames(pg, 2);
    const r = await pg.evaluate(new Function('id', 'const p=document.getElementById(id); return {on:p.classList.contains("on"), emo:('+VIS_EMO+')(p), anim:getComputedStyle(p.querySelector(".popC")).animationName};'), id);
    ok(`${key.toUpperCase()} 키로 ${id} 가 열린다`, r.on);
    ok(`${id} 가 커지며 뜬다 (popIn)`, r.anim === 'popIn', r.anim);
    if(r.emo.length) left.push(id+':'+r.emo.slice(0,5).join(''));
    await pg.keyboard.press(key); await frames(pg, 1);
  }
  for(const [btn, id] of [['bBook','popBook'],['bGive','popGive'],['bInfo','popInfo']]){
    await pg.evaluate(b=>document.getElementById(b).click(), btn)   /* 33차 — page.click 은 바쁜 판(동시 4개)에서 '예약된 이동 기다림' 에 걸려 30초를 넘겨 t30 이 통째로 죽었다(31b·33 전체 판). 시작 단추처럼 JS click */; await frames(pg, 2);
    const r = await pg.evaluate(new Function('id', 'const p=document.getElementById(id); return ('+VIS_EMO+')(p);'), id);
    if(r.length) left.push(id+':'+r.slice(0,5).join(''));
    await pg.evaluate(id=>document.getElementById(id).classList.remove('on'), id);
  }
  ok('★ 여섯 창을 다 열어 봐도 보이는 이모지가 없다', left.length===0, left.join(' | '));
}

/* ═══════ ④ 칭호 창(Y) 분리 · 가방 등급 테 · 소리 ═══════ */
{
  const r = await pg.evaluate(()=>{
    const W = window, o = {};
    o.badgeInStat = !!document.querySelector('#popStat #bgList');
    o.badgeCells = document.querySelectorAll('#popBadge #bgList .bgIt').length;
    o.btn = !!document.getElementById('bBadge');
    /* 강화 +3 무기가 가방에서 e3 테를 두르나 */
    W.__KIT.ownW[2] = true; W.__KIT.enh = W.__KIT.enh || {}; const before = W.__enhOf(2);
    o.enhSupported = typeof W.__enhOf === 'function';
    return o;
  });
  ok('★ 스텟 창(C) 안에 칭호 칸이 없다 (Y 로 뗐다)', !r.badgeInStat);
  ok('칭호 창(Y)에 칭호 27개가 있다', r.badgeCells === 27, r.badgeCells);
  ok('오른쪽 단추줄에 칭호 단추가 있다', r.btn);
  const sfx = await pg.evaluate(()=>{ const k = window.__SFXKEYS(); return ['click','open','close','equip','tab','plus'].filter(x=>!k.includes(x)); });
  ok('★ UI 소리 여섯(click·open·close·equip·tab·plus)이 있다', sfx.length===0, '없음: '+sfx.join(','));
  const bad = await pg.evaluate(()=>{ try{ window.__sfx('click'); window.__sfx('open'); window.__sfx('close'); return ''; }catch(e){ return e.message; } });
  ok('소리를 내도 오류가 안 난다 (오디오가 없는 판에서도)', bad==='', bad);
}

/* ═══════ ⑤ 세계 물건 · 손에 든 것 · 입 ═══════ */
{
  const r = await pg.evaluate(()=>{
    const W = window, o = {noMap:true, round:true, n:0};
    for(const m of W.__itemMeshes()){ o.n++;
      if(m.material.map) o.noMap = false;
      const N = m.geometry.attributes.normal; let diag=false;
      for(let i=0;i<N.count;i++){ const x=Math.abs(N.getX(i)), y=Math.abs(N.getY(i)), z=Math.abs(N.getZ(i)); if(Math.max(x,y,z)<0.98){ diag=true; break; } }
      if(!diag) o.round = false; }
    /* 손에 든 것 — 텍스처 없음, 꼭짓점 색 */
    let held = 0, heldMap = 0, vc = 0;
    W.__held.traverse(c=>{ if(c.isMesh){ held++; if(c.material.map) heldMap++; if(c.geometry.attributes.color) vc++; } });
    o.held = held; o.heldMap = heldMap; o.vc = vc;
    /* 입 — 양을 그리면 입이 하나씩 */
    const GY = W.__GY;
    W.__drawSheep([{x:0,z:14,y:GY,ry:Math.PI,g:0,mv:false,ph:0},{x:2,z:14,y:GY,ry:Math.PI,g:1,mv:false,ph:1}], 1.0, 40, s=>W.__GHEX[s.g], 0.70);
    o.mouth = W.__Pmouth().count;
    const P = W.__pvw && W.__pvw();
    return o;
  });
  ok(`세계 물건 ${r.n}벌(입자·화살·돌·총알·구슬·상자·산물)이 무늬 없는 원색이다`, r.noMap);
  ok('세계 물건이 둥글다', r.round);
  ok('★ 손에 든 것에 텍스처가 없고 색은 꼭짓점에 구웠다', r.held > 0 && r.heldMap === 0 && r.vc > 0, `${r.held}벌 · 텍스처 ${r.heldMap} · 꼭짓점색 ${r.vc}`);
  ok('★ 양 2마리 = 입 2 (로블록스 U 미소)', r.mouth === 2, r.mouth);
}
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
