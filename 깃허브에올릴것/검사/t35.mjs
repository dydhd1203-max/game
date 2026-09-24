/* 35차 검사 — 소리(효과음·배경음) · 글씨체·글자 크기
   ★ 선생님: "효과음들 너무 투박해. 배경음악도 바꿔주고" / "상점·강화 조합 글씨가 너무 작아. 폰트를 귀엽고 읽기 쉽게."
   소리는 검사기가 못 듣는다 — 그래서 **OfflineAudioContext 로 실제로 렌더**해서 파형을 잰다(있나 · 안 터지나 · 재료마다 다르나 · 배경음이 낮/밤/위험으로 갈리나).
   글씨는 계산된 스타일(글꼴 이름·px)과 '카드가 넘치지 않나' 를 잰다. 구글 폰트는 샌드박스에서 못 받으니 요청을 끊고 대체 글꼴로 잰다 —
   글꼴 파일이 오든 안 오든 이름·크기 규칙은 같다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT = +(process.argv[3] || 8935);
const srv = serve(PORT, process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[]; pg.on('pageerror', e=>{ if(!/resume/.test(e.message)) errs.push(e.message); });   // 오프라인 컨텍스트의 resume 거부는 예상된 것
await pg.route(/fonts\.(googleapis|gstatic)\.com/, r=> r.abort());
await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=low', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});
await pg.fill('#iName','검'); await pg.evaluate(()=>document.querySelector('#bSolo').click());
await pg.waitForTimeout(1200);
const R=[]; const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);

/* ═══════ ① 효과음 ═══════
   ★ 소리마다 OfflineAudioContext 를 하나씩(열일곱 개) 만들었더니 렌더러가 가끔 죽었다(Target page closed — 넷 중 둘).
     이제 **컨텍스트 하나**에 소리를 1.6초 간격으로 줄지어 건다 — currentTime 만 밀어 주는 Proxy 를 소리 엔진에 끼워(__setAUD)
     sfx() 가 부르는 now0() 이 자리를 옮기게 한다. 렌더 한 번, 잘라서 잰다. */
const RENDER = `const W=window, o={};
  const SR = 22050;
  const meas = (ch, a, b)=>{ const i0 = Math.floor(a*SR), i1 = Math.min(ch.length, Math.floor(b*SR)); let s=0, pk=0, last=i0, zc=0;
    for(let i=i0;i<i1;i++){ const v=ch[i]; s+=v*v; const q=Math.abs(v); if(q>pk) pk=q; if(q>0.002) last=i; if(i>i0 && (v>=0)!==(ch[i-1]>=0)) zc++; }
    return {rms:Math.sqrt(s/(i1-i0)), peak:pk, len:(last-i0)/SR, zc:zc/((i1-i0)/SR)}; };
  let OFF = 0;
  const mkCtx = (dur)=>{ const ctx = new OfflineAudioContext(1, Math.ceil(SR*dur), SR);
    const P = new Proxy(ctx, {get(t,k){ if(k==='currentTime') return t.currentTime + OFF; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }});
    return {ctx, P}; };
  const withCtx = async (dur, fn)=>{ const {ctx, P} = mkCtx(dur); const keep = W.__AUD(); W.__setAUD(P); W.__G.paused = true;
    try{ fn(ctx); const buf = await ctx.startRendering(); return buf.getChannelData(0); } finally { W.__setAUD(keep); W.__G.paused = false; OFF = 0; } };`;
const SF_KEYS = ['chopW','chopS','chopG','tok','tak','build','get','up','click','hurt','win','step'], SEG = 1.6;   // 46차 — 발소리(키캡)
const sf = await pg.evaluate(new Function('A', RENDER + `const {KEYS, SEG} = A;
  return (async()=>{
    const K = W.__SFXKEYS();
    o.keys = ['chopW','chopS','chopG','chop','tok','tak','build','get','up','fix','click','open','close','equip','tab','plus','hurt','win','lose','dawn','dusk','craft'].filter(k=>!K.includes(k));
    o.chopKey = [W.__chopKey('tree'), W.__chopKey('rock'), W.__chopKey('stone'), W.__chopKey('gold')];
    o.helpers = typeof W.__pluck === 'function' && typeof W.__puff === 'function';
    /* ★ 첫 소리는 워밍업 — 크롬 압축기의 보정 이득이 0.1초쯤 걸려 차오르므로 컨텍스트의 첫 소리는 3.4배 작게 잰다. 둘째부터 잰다 */
    const ch = await withCtx((KEYS.length+1)*SEG + 0.5, (ctx)=>{
      OFF = 0; W.__sfx('click');
      KEYS.forEach((k,i)=>{ OFF = (i+1)*SEG; W.__sfx(k); });
      const bus = W.__sfxBus(); o.busNode = !!bus && bus.context === ctx && bus.numberOfOutputs > 0;   // 버스 — 압축기·울림이 붙었나
    });
    o.warm = meas(ch, 0, SEG).peak;
    const r = {}; KEYS.forEach((k,i)=> r[k] = meas(ch, (i+1)*SEG, (i+2)*SEG)); o.r = r;
    return o; })();`), {KEYS:SF_KEYS, SEG});
ok('★ 새 효과음 이름이 다 있다 (chopW·chopS·chopG · tok·tak·build·get·up …)', sf.keys.length === 0, sf.keys.join(','));
ok('★ 캐는 소리는 재료마다 갈린다 — 나무 chopW · 돌 chopS · 금 chopG', sf.chopKey.join(',') === 'chopW,chopS,chopS,chopG', sf.chopKey.join(','));
ok('★ 부드러운 재료(pluck·puff)가 있다', sf.helpers);
ok('★ 모든 소리가 소리 버스(압축기 + 방 울림)를 거친다', sf.busNode === true);
ok('★ 압축기 보정 이득이 차오르기 전의 첫 소리가 뒤의 같은 소리보다 작다 (그래서 워밍업 뒤에 잰다)', sf.warm < sf.r.click.peak, sf.warm.toFixed(3)+' < '+sf.r.click.peak.toFixed(3));
const S = sf.r;
ok('★ 효과음 열두 개가 전부 실제로 소리를 낸다 (렌더 피크 > 0.01)', Object.values(S).every(v=> v.peak > 0.01), Object.entries(S).map(([k,v])=>k+' '+v.peak.toFixed(2)).join(' '));
ok('★ 어느 것도 안 터진다 (피크 < 0.6 — 스물한 대가 한 교실에서 울린다)', Object.values(S).every(v=> v.peak < 0.6), Math.max(...Object.values(S).map(v=>v.peak)).toFixed(2));
/* 방 울림(딜레이 0.117초 × 되먹임 0.24) 꼬리까지 세면 0.37초쯤 — 0.5초 안이면 연타(0.4초 간격)를 안 덮는다 */
ok('★ 캐는 소리는 짧다 (울림 꼬리까지 0.5초 안에 사라진다 — 연타를 안 덮는다)', ['chopW','chopS','chopG','tok','tak'].every(k=> S[k].len < 0.5), ['chopW','chopS','chopG','tok','tak'].map(k=>S[k].len.toFixed(2)).join(' '));
ok('★ 나무는 둔하고 금은 맑다 — 영교차율 나무 < 돌 < 금', S.chopW.zc < S.chopS.zc && S.chopS.zc < S.chopG.zc, [S.chopW.zc, S.chopS.zc, S.chopG.zc].map(v=>Math.round(v)).join(' < '));
ok('★ 공사 통·톡 은 높이가 다르다 (뚝/딱이 번갈아 들린다)', Math.abs(S.tok.zc - S.tak.zc) > 60, Math.round(S.tok.zc)+' / '+Math.round(S.tak.zc));
ok('★ 건물 완성·레벨업은 캐는 소리보다 길고 크다 (일이 끝났다는 신호)', S.build.len > 0.3 && S.up.len > 0.3 && S.build.rms > S.chopW.rms && S.up.rms > S.chopW.rms,
   'build '+S.build.len.toFixed(2)+'s · up '+S.up.len.toFixed(2)+'s');
ok('★ 클릭은 아주 작다 (있는 줄 모르게 — 피크 < 0.05)', S.click.peak < 0.05, S.click.peak.toFixed(3));
ok('★ 다침(hurt)은 톱니파가 아니다 — 영교차율이 낮게 둥글다 (< 900/초)', S.hurt.zc < 900, Math.round(S.hurt.zc));
/* 46차 — 발소리는 **키캡**이다(선생님). 기계식 한 타는 짧고(울림 꼬리까지 0.5초 안) 또렷하다(높은 딸깍이 섞여 둔한 hurt 보다 밝다) */
ok('★ 46차 발소리(키캡)는 짧고(0.5초 안) 또렷하다 — 둔한 다침 소리보다 밝다', S.step.peak > 0.01 && S.step.len < 0.5 && S.step.zc > S.hurt.zc,
   `피크 ${S.step.peak.toFixed(3)} · 길이 ${S.step.len.toFixed(2)}s · 영교차 ${Math.round(S.step.zc)} (다침 ${Math.round(S.hurt.zc)})`);

/* ═══════ ② 배경음 ═══════ — 네 판(낮 · 밤 · 위험 · 보스)을 한 컨텍스트에 11초 간격으로 */
const bg = await pg.evaluate(new Function(RENDER + `
  return (async()=>{
    const q = W.__bgmSeq(); o.seq = q;
    o.len = [q.dayA.length, q.dayB.length, q.nightA.length, q.nightB.length];
    o.range = [q.dayA,q.dayB,q.nightA,q.nightB].every(a=> a.every(v=> v === -1 || (v >= -12 && v <= 19)));
    o.varies = q.dayA.join() !== q.dayB.join() && q.nightA.join() !== q.nightB.join() && q.dayA.join() !== q.nightA.join();
    o.rests = [q.dayA,q.dayB,q.nightA,q.nightB].map(a=> a.filter(v=>v===-1).length);
    const s0 = W.__bgmStep(), GAP = 11;
    /* boss 는 매 걸음 넘긴다 — 드론을 1박에만 까는 건 bgmNote 자신이 bgmStep 으로 가린다(검사의 i 와 bgmStep 은 어긋나 있다) */
    const runs = [[false,0,false],[true,0,false],[true,0.9,false],[true,0.9,true]];
    const ch = await withCtx(runs.length*GAP, ()=>{
      runs.forEach(([night,h,boss], j)=>{ for(let i=0;i<32;i++) W.__bgmNote(night, h, j*GAP + i*(night?q.stepNight:q.stepDay)+0.01, boss); });
      o.stepAfter = W.__bgmStep() - s0;
    });
    [o.day, o.night, o.hot, o.boss] = runs.map((_, j)=> meas(ch, j*GAP + 0.5, j*GAP + 32*0.30 + 0.6));   // 앞 0.5초(압축기 차오르는 동안)는 뺀다
    return o; })();`));
ok('★ 배경음은 작곡해 둔 네 절(낮 A·B, 밤 A·B)이 각각 32음이다', bg.len.join() === '32,32,32,32', bg.len.join(','));
ok('★ 음은 반음 -12~+19 또는 쉼표(-1) 뿐이다', bg.range);
ok('★ A 와 B 가 다르고, 낮과 밤이 다르다 (같은 네 마디 반복이 아니다)', bg.varies);
ok('★ 절마다 쉼표가 있다 (숨 쉴 틈)', bg.rests.every(n=> n >= 2), bg.rests.join(','));
ok('★ 낮 120bpm(0.25) · 밤 100bpm(0.30) 8분음표', bg.seq.stepDay === 0.25 && bg.seq.stepNight === 0.30, bg.seq.stepDay+' / '+bg.seq.stepNight);
ok('★ 한 걸음마다 bgmStep 이 하나씩 간다 (32걸음 × 네 판 → +128)', bg.stepAfter === 128, bg.stepAfter);
/* 66차 — 배경음은 자기 버스(BGMB, 기본 70% × BGM_BASE .60)를 지나 효과음보다 확실히 작다. 그래서 '울린다' 문턱을 0.03 → 0.012 로 */
ok('★ 낮 배경음이 실제로 울린다 (피크 0.012~0.5)', bg.day.peak > 0.012 && bg.day.peak < 0.5, bg.day.peak.toFixed(3));
ok('★ 밤 배경음이 실제로 울린다', bg.night.peak > 0.012 && bg.night.peak < 0.6, bg.night.peak.toFixed(3));
ok('★ 위험(heat 0.9)하면 밤이 더 세진다 (낮은 북·세기)', bg.hot.rms > bg.night.rms * 1.15, bg.night.rms.toFixed(4)+' → '+bg.hot.rms.toFixed(4));
/* 66차 — 보스 밤은 드론 한 겹이 아니라 전용 곡(D단조·큰북·현 저음)이다. 같은 위험도(0.9)의 바쁜 밤보다 세야 한다(절정) */
ok('★ 보스 밤 전용 곡(북·저음)은 같은 위험도의 밤보다 세다', bg.boss.rms > bg.hot.rms, bg.hot.rms.toFixed(4)+' → '+bg.boss.rms.toFixed(4));
ok('★ 배경음은 배경이다 — 낮 RMS 가 승리 팡파르보다 작다', bg.day.rms < S.win.rms, bg.day.rms.toFixed(4)+' < '+S.win.rms.toFixed(4));

/* ═══════ ③ 글씨체·글자 크기 ═══════ */
const ft = await pg.evaluate(()=>{ const W=window, o={};
  const cs = (s)=>{ const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
  const fam = (s)=>{ const c = cs(s); return c ? c.fontFamily.split(',')[0].replace(/["']/g,'').trim() : null; };
  const px = (s)=>{ const c = cs(s); return c ? parseFloat(c.fontSize) : 0; };
  o.auto = !document.getElementById('gfonts');            // 검사기(webdriver)에서는 저절로 안 받는다 — 콘솔 인증서 오류를 안 남긴다
  W.__loadFonts(true);
  o.url = W.__FONT_URL; o.link = !!document.getElementById('gfonts'); o.pre = document.querySelectorAll('link[rel=preconnect]').length;
  o.body = fam('body'); o.btn = fam('.btn'); o.h2 = fam('.popC h2');
  W.__KIT.ownW = [true,true,true,true,false,false,false]; W.__KIT.enh[2] = 3;
  W.__openShop();
  o.sn = [fam('.sItem .sn'), px('.sItem .sn')]; o.sd = [fam('.sItem .sd'), px('.sItem .sd')]; o.sc = px('.sItem .sc'); o.sbtn = px('.sItem button');
  o.snSynth = cs('.sItem .sn').fontSynthesis || cs('.sItem .sn').fontSynthesisWeight;
  o.over = [...document.querySelectorAll('#shopList .sItem')].filter(e=> e.scrollWidth > e.clientWidth + 1).length;
  o.cards = document.querySelectorAll('#shopList .sItem').length;
  const pc = document.querySelector('#popShop .popC'); o.popW = pc.getBoundingClientRect().width; o.popFits = pc.scrollWidth <= pc.clientWidth + 1;
  document.querySelectorAll('.pop.on').forEach(p=>p.classList.remove('on'));
  W.__openForge();
  o.enhSafe = px('.enhSafe'); o.enhLv = px('.enhLv'); o.fsn = px('#forgeList .sItem .sn');
  o.fover = [...document.querySelectorAll('#forgeList .sItem')].filter(e=> e.scrollWidth > e.clientWidth + 1).length;
  document.querySelectorAll('.pop.on').forEach(p=>p.classList.remove('on'));
  o.hint = px('.shopHint'); o.hrow = px('.hrow'); o.btnPx = px('.btn'); o.slot = px('.slot .nm'); o.feed = px('#feed');
  return o; });
/* 2026-09 — 밝은 UI의 한국어 고딕. 비동기 로딩·대체 글꼴·기존 최소 크기를 지킨다. */
ok('★ 한국어 고딕 주소에 본문 400·500, 단추 600, 제목 700 굵기가 있다',
   /family=Noto\+Sans\+KR:wght@400;500;600;700/.test(ft.url), ft.url);
ok('★ 글꼴은 창이 뜬 뒤 따로 받는다 (link#gfonts) · 미리 연결(preconnect) 둘 · 검사기(webdriver)에서는 저절로 안 받는다', ft.link && ft.pre >= 2 && ft.auto, 'link '+ft.link+' · preconnect '+ft.pre+' · 자동 안 받음 '+ft.auto);
ok('★ 본문·단추·제목이 모두 Noto Sans KR 이다 (못 받으면 시스템 글꼴로 내려간다)',
   ft.body === 'Noto Sans KR' && ft.btn === 'Noto Sans KR' && ft.h2 === 'Noto Sans KR', ft.body+' / '+ft.btn+' / '+ft.h2);
ok('★ 상점 카드 이름 17px · 설명 13.5px — 한국어 고딕으로 바꿔도 기존 크기를 지킨다',
   ft.sn[0] === 'Noto Sans KR' && ft.sn[1] >= 17 && ft.sd[0] === 'Noto Sans KR' && ft.sd[1] >= 13.5, ft.sn.join(' ')+' · '+ft.sd.join(' '));
ok('★ 값 14px · 단추 15px (예전 12 / 12.5)', ft.sc >= 14 && ft.sbtn >= 15, ft.sc+' / '+ft.sbtn);
ok('★ 가짜 굵게를 안 씌운다 (font-synthesis: none — 없는 굵기를 브라우저가 지어내면 번진다)', /none/.test(String(ft.snSynth)), ft.snSynth);
ok('★ 글자를 키워도 상점 카드가 옆으로 안 넘친다', ft.cards >= 4 && ft.over === 0 && ft.popFits, ft.cards+'장 · 넘침 '+ft.over+' · 창 '+Math.round(ft.popW)+'px');
ok('★ 대장간 카드 이름 17px · 강화 안내 13px · +단계 14px (예전 14 / 11 / 12)', ft.fsn >= 17 && ft.enhSafe >= 13 && ft.enhLv >= 14, ft.fsn+' / '+ft.enhSafe+' / '+ft.enhLv);
ok('★ 대장간 카드도 안 넘친다', ft.fover === 0, ft.fover);
/* 핫바 칸 이름만 12 → 10px 이다. 48차에 칸을 로블록스 실측(ICON_SIZE 60)으로 줄이면서
   60px 안에 아이콘·이름·값이 다 들어가야 해서다. 나머지 넷은 35차 크기 그대로 지킨다. */
ok('★ 안내·도움말·기록·단추는 35차 크기 그대로(14.5 · 14 · 13 · 16) · 핫바 칸 이름은 48차에 60px 칸에 맞춰 10',
   ft.hint >= 14.5 && ft.hrow >= 14 && ft.feed >= 13 && ft.btnPx >= 16 && ft.slot >= 10,
   [ft.hint, ft.hrow, ft.feed, ft.btnPx, ft.slot].join(' / '));
/* ═══════ ★ 50차 — 창을 다 열어 보고 **글자가 바탕에 묻히지 않나** 잰다 ═══════
   선생님: "색깔 때문에 가독성이 너무 떨어져". 스텟 창 이름이 아예 안 보였는데, 원인은
   28차 파스텔 층이 카드를 하얗게 칠해 둔 위에 48차가 **글자만** 희게 바꾼 것이었다.
   창을 몇 개 열어 보는 눈대중으로는 못 찾는다 — 그때 이렇게 재 보니 **124군데**였다.
   겹을 새로 쌓을 때마다 여기서 걸리게 한다. (WCAG 대비식 · 2.2:1 밑이면 못 읽는 것으로 본다) */
{
  const lowC = await pg.evaluate(()=>{
    const W = window;
    if(W.__XP){ W.__XP.lv = 15; W.__XP.pts = 15; }
    const opens = [['스텟', ()=>W.__openStat()], ['가방', ()=>W.__openKit && W.__openKit()],
                   ['칭호', ()=>W.__openBadge && W.__openBadge()], ['상점', ()=>W.__openShop && W.__openShop()],
                   ['대장간', ()=>W.__openForge && W.__openForge()], ['농장', ()=>W.__openFarm && W.__openFarm()],
                   ['도움말', ()=>W.__openHelp && W.__openHelp()]];
    /* 실제로 칠해진 바탕을 찾아 위로 올라간다(투명한 것은 건너뛴다) */
    const bgOf = e => { let n = e;
      while(n && n !== document.documentElement){
        const m = (getComputedStyle(n).backgroundColor.match(/[\d.]+/g) || []).map(Number);
        if(m.length && (m.length < 4 || m[3] > 0.55)) return m.slice(0,3);
        n = n.parentElement; }
      return [20,20,20]; };
    const lum = ([r,g,b]) => { const f = v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
      return .2126*f(r) + .7152*f(g) + .0722*f(b); };
    const bad = [];
    for(const [nm, fn] of opens){
      document.querySelectorAll('.pop.on').forEach(p=>p.classList.remove('on'));
      try{ fn(); }catch(e){ continue; }
      const pop = document.querySelector('.pop.on'); if(!pop) continue;
      for(const e of pop.querySelectorAll('*')){
        const txt = [...e.childNodes].filter(n=>n.nodeType===3 && n.nodeValue.trim()).map(n=>n.nodeValue.trim()).join(' ');
        if(!txt) continue;
        const cs = getComputedStyle(e);
        if(cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.12) continue;
        const fg = (cs.color.match(/[\d.]+/g) || []).map(Number);
        if(fg.length > 3 && fg[3] < 0.25) continue;      // 거의 투명한 글자는 장식이다
        const L1 = lum(fg.slice(0,3)), L2 = lum(bgOf(e));
        const ratio = (Math.max(L1,L2) + .05) / (Math.min(L1,L2) + .05);
        if(ratio < 2.2) bad.push(nm + '·' + (e.className || e.tagName) + ' "' + txt.slice(0,12) + '" ' + ratio.toFixed(2));
      }
    }
    document.querySelectorAll('.pop.on').forEach(p=>p.classList.remove('on'));
    return bad;
  });
  ok('★ 50차 — 창 속 글자가 바탕에 묻히지 않는다 (스텟·가방·칭호·상점·대장간·농장·도움말, 대비 2.2:1 이상)',
     lowC.length === 0, lowC.length ? lowC.length + '군데: ' + lowC.slice(0,4).join(' / ') : '전부 읽힌다');
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
