/* 35차 검사 — 소리(효과음·배경음) · 글씨체·글자 크기
   ★ 선생님: "효과음들 너무 투박해. 배경음악도 바꿔주고" / "상점·강화 조합 글씨가 너무 작아. 폰트를 귀엽고 읽기 쉽게."
   소리는 검사기가 못 듣는다 — 그래서 **OfflineAudioContext 로 실제로 렌더**해서 파형을 잰다(있나 · 안 터지나 · 재료마다 다르나 · 배경음이 낮/밤/위험으로 갈리나).
   글씨는 계산된 스타일(글꼴 이름·px)과 '카드가 넘치지 않나' 를 잰다. 구글 폰트는 샌드박스에서 못 받으니 요청을 끊고 대체 글꼴로 잰다 —
   글꼴 파일이 오든 안 오든 이름·크기 규칙은 같다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
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

/* ═══════ ① 효과음 ═══════ */
const RENDER = `const W=window, o={};
  const SR = 22050;
  const meas = (ch)=>{ let s=0, pk=0, last=0, zc=0; for(let i=0;i<ch.length;i++){ const v=ch[i]; s+=v*v; const a=Math.abs(v); if(a>pk) pk=a; if(a>0.002) last=i; if(i && (v>=0)!==(ch[i-1]>=0)) zc++; }
    return {rms:Math.sqrt(s/ch.length), peak:pk, len:last/SR, zc:zc/(ch.length/SR)}; };
  const render = async (fn, dur)=>{ const ctx = new OfflineAudioContext(1, Math.ceil(SR*dur), SR); const keep = W.__AUD(); W.__setAUD(ctx); W.__G.paused = true;
    try{ fn(ctx); const buf = await ctx.startRendering(); return meas(buf.getChannelData(0)); } finally { W.__setAUD(keep); W.__G.paused = false; } };`;
const sf = await pg.evaluate(new Function(RENDER + `
  return (async()=>{
    const K = W.__SFXKEYS();
    o.keys = ['chopW','chopS','chopG','chop','tok','tak','build','get','up','fix','click','open','close','equip','tab','plus','hurt','win','lose','dawn','dusk','craft'].filter(k=>!K.includes(k));
    o.chopKey = [W.__chopKey('tree'), W.__chopKey('rock'), W.__chopKey('stone'), W.__chopKey('gold')];
    o.helpers = typeof W.__pluck === 'function' && typeof W.__puff === 'function';
    const r = {};
    for(const k of ['chopW','chopS','chopG','tok','tak','build','get','up','click','hurt','win']) r[k] = await render(()=>W.__sfx(k), 1.2);
    o.r = r;
    /* 버스 — 압축기·울림이 붙었나: 오프라인 렌더 뒤 다시 잰다 */
    o.bus = await render((ctx)=>{ W.__sfx('click'); const bus = W.__sfxBus(); o.busNode = bus && bus.context === ctx && !!bus.numberOfOutputs; }, 0.3);
    return o; })();`));
ok('★ 새 효과음 이름이 다 있다 (chopW·chopS·chopG · tok·tak·build·get·up …)', sf.keys.length === 0, sf.keys.join(','));
ok('★ 캐는 소리는 재료마다 갈린다 — 나무 chopW · 돌 chopS · 금 chopG', sf.chopKey.join(',') === 'chopW,chopS,chopS,chopG', sf.chopKey.join(','));
ok('★ 부드러운 재료(pluck·puff)가 있다', sf.helpers);
ok('★ 모든 소리가 소리 버스(압축기 + 방 울림)를 거친다', sf.busNode === true);
const S = sf.r;
ok('★ 효과음 열한 개가 전부 실제로 소리를 낸다 (렌더 피크 > 0.01)', Object.values(S).every(v=> v.peak > 0.01), Object.entries(S).map(([k,v])=>k+' '+v.peak.toFixed(2)).join(' '));
ok('★ 어느 것도 안 터진다 (피크 < 0.6 — 스물한 대가 한 교실에서 울린다)', Object.values(S).every(v=> v.peak < 0.6), Math.max(...Object.values(S).map(v=>v.peak)).toFixed(2));
/* 방 울림(딜레이 0.117초 × 되먹임 0.24) 꼬리까지 세면 0.37초쯤 — 0.5초 안이면 연타(0.4초 간격)를 안 덮는다 */
ok('★ 캐는 소리는 짧다 (울림 꼬리까지 0.5초 안에 사라진다 — 연타를 안 덮는다)', ['chopW','chopS','chopG','tok','tak'].every(k=> S[k].len < 0.5), ['chopW','chopS','chopG','tok','tak'].map(k=>S[k].len.toFixed(2)).join(' '));
ok('★ 나무는 둔하고 금은 맑다 — 영교차율 나무 < 돌 < 금', S.chopW.zc < S.chopS.zc && S.chopS.zc < S.chopG.zc, [S.chopW.zc, S.chopS.zc, S.chopG.zc].map(v=>Math.round(v)).join(' < '));
ok('★ 공사 통·톡 은 높이가 다르다 (뚝/딱이 번갈아 들린다)', Math.abs(S.tok.zc - S.tak.zc) > 60, Math.round(S.tok.zc)+' / '+Math.round(S.tak.zc));
ok('★ 건물 완성·레벨업은 캐는 소리보다 길고 크다 (일이 끝났다는 신호)', S.build.len > 0.3 && S.up.len > 0.3 && S.build.rms > S.chopW.rms && S.up.rms > S.chopW.rms,
   'build '+S.build.len.toFixed(2)+'s · up '+S.up.len.toFixed(2)+'s');
ok('★ 클릭은 아주 작다 (있는 줄 모르게 — 피크 < 0.05)', S.click.peak < 0.05, S.click.peak.toFixed(3));
ok('★ 다침(hurt)은 톱니파가 아니다 — 영교차율이 낮게 둥글다 (< 900/초)', S.hurt.zc < 900, Math.round(S.hurt.zc));

/* ═══════ ② 배경음 ═══════ */
const bg = await pg.evaluate(new Function(RENDER + `
  return (async()=>{
    const q = W.__bgmSeq(); o.seq = q;
    o.len = [q.dayA.length, q.dayB.length, q.nightA.length, q.nightB.length];
    o.range = [q.dayA,q.dayB,q.nightA,q.nightB].every(a=> a.every(v=> v === -1 || (v >= -12 && v <= 19)));
    o.varies = q.dayA.join() !== q.dayB.join() && q.nightA.join() !== q.nightB.join() && q.dayA.join() !== q.nightA.join();
    o.rests = [q.dayA,q.dayB,q.nightA,q.nightB].map(a=> a.filter(v=>v===-1).length);
    const s0 = W.__bgmStep();
    /* boss 는 매 걸음 넘긴다 — 드론을 1박에만 까는 건 bgmNote 자신이 bgmStep 으로 가린다(검사의 i 와 bgmStep 은 어긋나 있다) */
    const run = (night, h, boss)=> render(()=>{ for(let i=0;i<32;i++) W.__bgmNote(night, h, i*(night?q.stepNight:q.stepDay)+0.01, boss); }, 32*(night?q.stepNight:q.stepDay)+0.6);
    o.day = await run(false, 0, false); o.stepAfter = W.__bgmStep() - s0;
    o.night = await run(true, 0, false); o.hot = await run(true, 0.9, false); o.boss = await run(true, 0.9, true);
    return o; })();`));
ok('★ 배경음은 작곡해 둔 네 절(낮 A·B, 밤 A·B)이 각각 32음이다', bg.len.join() === '32,32,32,32', bg.len.join(','));
ok('★ 음은 반음 -12~+19 또는 쉼표(-1) 뿐이다', bg.range);
ok('★ A 와 B 가 다르고, 낮과 밤이 다르다 (같은 네 마디 반복이 아니다)', bg.varies);
ok('★ 절마다 쉼표가 있다 (숨 쉴 틈)', bg.rests.every(n=> n >= 2), bg.rests.join(','));
ok('★ 낮 120bpm(0.25) · 밤 100bpm(0.30) 8분음표', bg.seq.stepDay === 0.25 && bg.seq.stepNight === 0.30, bg.seq.stepDay+' / '+bg.seq.stepNight);
ok('★ 한 걸음마다 bgmStep 이 하나씩 간다 (32걸음 → +32 … 네 번 → +128)', bg.stepAfter === 32);
ok('★ 낮 배경음이 실제로 울린다 (피크 0.03~0.5)', bg.day.peak > 0.03 && bg.day.peak < 0.5, bg.day.peak.toFixed(3));
ok('★ 밤 배경음이 실제로 울린다', bg.night.peak > 0.03 && bg.night.peak < 0.6, bg.night.peak.toFixed(3));
ok('★ 위험(heat 0.9)하면 밤이 더 세진다 (낮은 북·세기)', bg.hot.rms > bg.night.rms * 1.15, bg.night.rms.toFixed(4)+' → '+bg.hot.rms.toFixed(4));
ok('★ 보스가 있으면 드론이 한 겹 더 깔린다', bg.boss.rms > bg.hot.rms, bg.hot.rms.toFixed(4)+' → '+bg.boss.rms.toFixed(4));
ok('★ 배경음은 배경이다 — 낮 RMS 가 승리 팡파르의 3분의 2 아래', bg.day.rms < S.win.rms * 0.67, bg.day.rms.toFixed(4)+' < '+S.win.rms.toFixed(4)+'×0.67');

/* ═══════ ③ 글씨체·글자 크기 ═══════ */
const ft = await pg.evaluate(()=>{ const W=window, o={};
  const cs = (s)=>{ const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
  const fam = (s)=>{ const c = cs(s); return c ? c.fontFamily.split(',')[0].replace(/["']/g,'').trim() : null; };
  const px = (s)=>{ const c = cs(s); return c ? parseFloat(c.fontSize) : 0; };
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
ok('★ 글꼴 주소에 주아(Jua)와 해바라기(Sunflower 500·700)가 있다', /family=Jua/.test(ft.url) && /Sunflower:wght@500;700/.test(ft.url), ft.url);
ok('★ 글꼴은 창이 뜬 뒤 따로 받는다 (load 뒤 link#gfonts) · 미리 연결(preconnect) 둘', ft.link && ft.pre >= 2, 'link '+ft.link+' · preconnect '+ft.pre);
ok('★ 본문 글꼴은 해바라기, 단추·제목은 주아 (못 받으면 시스템 글꼴로 내려간다)', ft.body === 'Sunflower' && ft.btn === 'Jua' && ft.h2 === 'Jua', ft.body+' / '+ft.btn+' / '+ft.h2);
ok('★ 상점 카드 이름 17px 주아 · 설명 13.5px 해바라기 (예전 14 / 11.5)', ft.sn[0] === 'Jua' && ft.sn[1] >= 17 && ft.sd[0] === 'Sunflower' && ft.sd[1] >= 13.5, ft.sn.join(' ')+' · '+ft.sd.join(' '));
ok('★ 값 14px · 단추 15px (예전 12 / 12.5)', ft.sc >= 14 && ft.sbtn >= 15, ft.sc+' / '+ft.sbtn);
ok('★ 주아에는 가짜 굵게를 안 씌운다 (font-synthesis: none — 굵기가 하나뿐이라 번진다)', /none/.test(String(ft.snSynth)), ft.snSynth);
ok('★ 글자를 키워도 상점 카드가 옆으로 안 넘친다', ft.cards >= 4 && ft.over === 0 && ft.popFits, ft.cards+'장 · 넘침 '+ft.over+' · 창 '+Math.round(ft.popW)+'px');
ok('★ 대장간 카드 이름 17px · 강화 안내 13px · +단계 14px (예전 14 / 11 / 12)', ft.fsn >= 17 && ft.enhSafe >= 13 && ft.enhLv >= 14, ft.fsn+' / '+ft.enhSafe+' / '+ft.enhLv);
ok('★ 대장간 카드도 안 넘친다', ft.fover === 0, ft.fover);
ok('★ 안내·도움말·기록·단추·도구 이름도 한 단계씩 커졌다 (14.5 · 14 · 13 · 16 · 12)', ft.hint >= 14.5 && ft.hrow >= 14 && ft.feed >= 13 && ft.btnPx >= 16 && ft.slot >= 12,
   [ft.hint, ft.hrow, ft.feed, ft.btnPx, ft.slot].join(' / '));
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
