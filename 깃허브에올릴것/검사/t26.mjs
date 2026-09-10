/* 22차 검사 — 🎖️ 칭호 (남과 겨루지 않는 칭찬)
   ★ 값을 검사에 베끼지 않는다. 문턱·이름·단계는 전부 게임의 __BADGES 에서 읽고,
     세는 것은 개수가 아니라 **관계**다 ("갈래마다 남을 자리가 있나", "단계가 거꾸로 안 가나").
     17차d에 갈래 개수를 박아 뒀다가 농장 갈래 하나 늘리고 검사만 빨개진 적이 있다.
   ★ 통신이 안 늘었는지도 여기서 본다 — 칭호가 읽는 칸이 전부 pc 통로에 이미 있어야 한다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 12800);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1100,height:760}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1600);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
const ev = f => pg.evaluate(f);

/* 판을 깨끗이 — 앞 항목이 남긴 숫자·기억 때문에 흔들리지 않게 */
/* ★ 게임의 '처음부터 다시' 와 같은 것을 한다 — xpReset 이 빠지면 레벨 칭호가 살아남는다.
   (MY 에는 레벨이 없다. 레벨은 XP 가 들고 있고 syncMyPC 가 XP.lv 를 pc 로 옮긴다) */
const clean = ()=> ev(()=>{
  const W=window;
  W.__xpReset(); W.__myReset();       // MY 를 0 으로 (bgReset 도 같이 돈다)
  W.__syncMyPC(); W.__badgeCheck();   // 기준점을 잡는다
  document.getElementById('feed').innerHTML = '';
  return true;
});

/* ═══════ ① 표 — 모양과 관계 ═══════ */
const tbl = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  o.수 = B.length;
  o.빈칸 = B.filter(x=> !x.k || !x.ic || !x.nm || !x.d || !x.u || !(x.need>0) || !(x.t>=1&&x.t<=3)).length;
  /* 한 갈래 안에서 문턱이 오름차순인가 — 뒤집혀 있으면 '더 쉬운 것' 이 더 어려운 자리에 앉는다 */
  const byK = {};
  B.forEach((x,i)=>{ (byK[x.k] = byK[x.k] || []).push([i, x.need, x.t]); });
  o.갈래 = Object.keys(byK).length;
  /* 문턱은 반드시 오른다. 단계는 '거꾸로만 안 가면' 된다 —
     친구 일으키기·농장처럼 첫걸음부터 흔치 않은 일은 3단계가 둘일 수 있다. */
  o.문턱거꾸로 = Object.values(byK).filter(a=>
    a.some((v,j)=> j>0 && (v[1] <= a[j-1][1] || v[2] < a[j-1][2]))).length;
  /* 표 전체가 '쉬운 것 → 어려운 것' 인가 (단계가 거꾸로 가는 자리가 없나) */
  o.단계거꾸로 = B.filter((x,i)=> i>0 && x.t < B[i-1].t).length;
  /* 그림이 겹치면 머리 위에서 못 갈린다 */
  o.그림종류 = new Set(B.map(x=>x.ic)).size;
  o.이름종류 = new Set(B.map(x=>x.nm)).size;
  /* 단계마다 여러 갈래가 있나 — 한 갈래에 몰리면 '길이 하나' 가 된다 */
  o.단계별갈래 = [1,2,3].map(t=> new Set(B.filter(x=>x.t===t).map(x=>x.k)).size);
  /* 순위판이 세는 갈래마다 칭호가 있나 (개수가 아니라 관계로 본다) */
  const ks = new Set(B.map(x=>x.k));
  o.순위판빠짐 = W.__RANK_CATS.map(c=>c.k).filter(k=> !ks.has(k));
  /* 칭호가 읽는 칸이 전부 pc 통로에 이미 오고 있나 = 통신이 안 늘었나 */
  W.__MY.mined=1; W.__MY.built=1; W.__MY.hits=1; W.__MY.saved=1; W.__MY.helped=1;
  W.__MY.fixed=1; W.__MY.farmed=1; W.__MY.flowers=1;
  W.__syncMyPC();
  const pc = W.__myPC();
  o.pc에없는칸 = [...ks].filter(k=> pc[k] === undefined);
  return o;
});
ok('칭호 표에 빠진 칸이 없다 (그림·이름·조건·단위·문턱·단계)', tbl.빈칸 === 0, tbl.수+'개');
ok('★ 한 갈래 안에서 문턱과 단계가 오름차순이다 (2단계가 1단계보다 쉬우면 뜻이 없다)',
   tbl.문턱거꾸로 === 0, tbl.갈래+'갈래');
ok('★ 표 전체가 쉬운 것 → 어려운 것 순이다 (머리 위에 "표에서 제일 뒤" 가 뜨므로 순서가 규칙이다)',
   tbl.단계거꾸로 === 0);
ok('★ 칭호 그림이 다 다르다 (머리 위 이름표에 그림 하나만 뜬다 — 겹치면 누가 뭘 했는지 못 갈린다)',
   tbl.그림종류 === tbl.수, tbl.그림종류+'/'+tbl.수);
ok('칭호 이름이 다 다르다', tbl.이름종류 === tbl.수);
ok('★ 단계마다 갈래가 셋 이상이다 (한 갈래에 몰리면 잘하는 길이 하나뿐인 게임이 된다)',
   tbl.단계별갈래.every(n=>n>=3), tbl.단계별갈래.join(' · ')+'갈래');
ok('★ 순위판이 세는 갈래마다 칭호가 있다 (갈래 개수를 박지 않고 관계로 본다)',
   tbl.순위판빠짐.length === 0, tbl.순위판빠짐.join(',') || '빠짐 없음');
ok('★ 칭호가 읽는 칸이 전부 pc 통로에 이미 온다 = 통신이 한 칸도 안 늘었다',
   tbl.pc에없는칸.length === 0, tbl.pc에없는칸.join(',') || '전부 있음');

/* ═══════ ② 계산 — 내 것도 친구 것도 같은 함수 ═══════ */
const calc = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  o.빈사람 = {수:W.__badgeList({}).length, 머리위:W.__badgeTop({})};
  /* 경계 — 딱 한 개 모자라면 안 받고, 딱 맞으면 받는다 */
  const first = B[0];
  o.한개모자람 = W.__badgeList({[first.k]: first.need-1}).length;
  o.딱맞음     = W.__badgeList({[first.k]: first.need}).length;
  /* 머리 위 = 표에서 제일 뒤에 있는 것 (제일 어려운 것) */
  const last = B[B.length-1];
  const p = {[first.k]:first.need, [last.k]:last.need};
  o.머리위 = W.__badgeTop(p) === B.length-1 ? '제일 뒤' : '엉뚱한 것';
  /* 친구 칸도 같은 함수로 나온다 — 내 것/남의 것이 갈리면 머리 위 그림이 어긋난다 */
  o.친구도같다 = W.__badgeTop({n:'서준', g:2, ...p}) === W.__badgeTop(p);
  /* 다음 칭호는 표 순서가 아니라 '제일 가까운 것' 이다 */
  const far = B[0], near = B.find(x=> x.k !== far.k && x.t === 1) || B[1];
  const q = {[near.k]: near.need-1};                    // 하나만 남은 갈래
  const nx = W.__badgeNext(q);
  o.다음 = nx ? nx.B.nm : '없음';
  o.다음이가까운것 = nx && nx.B.nm === near.nm;
  o.남은개수 = nx ? nx.left : -1;
  /* 다 가진 사람은 다음이 없다 */
  const all = {}; for(const x of B) all[x.k] = Math.max(all[x.k]||0, x.need);
  o.다가짐 = {수:W.__badgeList(all).length, 다음:W.__badgeNext(all)};
  return o;
});
ok('아무것도 안 한 사람은 칭호가 없다', calc.빈사람.수 === 0 && calc.빈사람.머리위 === -1,
   JSON.stringify(calc.빈사람));
ok('문턱에서 딱 한 개 모자라면 안 받는다', calc.한개모자람 === 0);
ok('문턱에 딱 닿으면 받는다', calc.딱맞음 === 1);
ok('★ 머리 위에는 표에서 제일 뒤에 있는(=제일 어려운) 칭호가 뜬다', calc.머리위 === '제일 뒤', calc.머리위);
ok('★ 친구 칸도 같은 함수로 계산된다 (내 것만 맞고 친구 것이 틀리면 아무도 못 알아챈다)',
   calc.친구도같다 === true);
ok('★ 다음 칭호는 표 순서가 아니라 지금 제일 가까운 것이다 (안 하는 일을 들이밀지 않는다)',
   calc.다음이가까운것 === true, calc.다음+' · '+calc.남은개수+' 남음');
ok('다 모은 사람에게는 다음 칭호가 없다',
   calc.다가짐.수 === (await ev(()=>window.__BADGES.length)) && calc.다가짐.다음 === null,
   calc.다가짐.수+'개');

/* ═══════ ③ 받는 순간 — 게임 숫자에서 실제로 잡아내나 ═══════ */
await clean();
const earn = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  const mine = B.find(x=>x.k==='mined' && x.t===1);
  W.__MY.mined = mine.need;                 // 게임이 실제로 올리는 칸에 넣는다
  W.__syncMyPC(); W.__badgeCheck();
  o.받음 = [...W.__bgGot()].map(i=>B[i].nm);
  o.소식 = document.getElementById('feed').textContent;
  const v = document.getElementById('verdict');
  o.큰그림 = {켜짐:v.className.indexOf('on')>=0, 그림:(v.querySelector('.vIco')||{}).textContent};
  /* 두 번 불러도 다시 안 뜬다 */
  const n1 = document.querySelectorAll('#feed div').length;
  W.__badgeCheck(); W.__badgeCheck();
  o.또뜸 = document.querySelectorAll('#feed div').length - n1;
  return o;
});
ok('★ 게임이 세는 칸(MY→pc)에서 칭호를 잡아낸다', earn.받음.length === 1, earn.받음.join(','));
ok('★ 받으면 반이 보는 소식줄에 이름과 조건이 남는다',
   earn.소식.indexOf('김하늘') >= 0 && earn.소식.indexOf('칭호') >= 0,
   earn.소식.slice(0,44));
ok('★ 받는 순간 화면 한가운데에 큰 그림이 뜬다 (구석의 한 줄은 아이들이 안 읽는다)',
   earn.큰그림.켜짐 && !!earn.큰그림.그림, JSON.stringify(earn.큰그림));
ok('★ 같은 칭호가 두 번 뜨지 않는다', earn.또뜸 === 0);

/* 여러 개가 한꺼번에 걸리면 하나씩 나온다 */
await clean();
const queue = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  /* 1단계를 통째로 넘겨 본다 — 첫날에 실제로 이렇게 된다 */
  for(const x of B) if(x.t === 1) W.__MY[x.k==='flw'?'flowers':x.k] = x.need;
  /* 레벨 칭호는 MY 가 아니라 XP 가 정한다 — 여기서는 건드리지 않는다 */
  W.__syncMyPC();
  W.__badgeCheck();
  o.첫번에나온것 = document.querySelectorAll('#feed div').length;
  o.줄 = W.__bgQueue().length;
  /* 시계를 돌린다 — badgeCheck 는 0.5초마다 불린다.
     ★ 소식줄은 다섯 줄까지만 남으므로 그걸로 세면 안 된다(다섯에서 멎는다).
       나온 개수는 '줄이 비었나 + 받은 것이 몇 개인가' 로 센다. */
  const 걸린것 = o.줄 + 1;
  let n = 0;
  while(W.__bgQueue().length && n < 400){ W.__badgeCheck(); n++; }
  o.다나오기까지 = n;
  o.남은줄 = W.__bgQueue().length;
  o.받은것 = W.__bgGot().size;
  o.걸린것 = 걸린것;
  o.간격 = W.__BG_GAP / W.__BG_TICK;
  return o;
});
ok('★ 여러 개가 한꺼번에 걸려도 한 번에 하나만 나온다 (한꺼번에 쏟으면 큰 그림이 서로를 덮어써서 하나만 보인다)',
   queue.첫번에나온것 === 1 && queue.줄 >= 1, '처음 '+queue.첫번에나온것+'개 · 줄 '+queue.줄+'개');
ok('★ 줄 서 있던 것이 하나도 안 사라지고 다 나온다',
   queue.남은줄 === 0 && queue.받은것 === queue.걸린것,
   queue.받은것+'개 받음 / '+queue.걸린것+'개 걸림');
ok('칭호와 칭호 사이에 앞의 축하가 끝날 만큼 뜸을 들인다',
   queue.다나오기까지 >= queue.줄 * (queue.간격 - 1), queue.다나오기까지+'번 만에 · 간격 '+queue.간격);

/* ═══════ ④ "조금만 더" — 등을 미는 한 줄 ═══════ */
await clean();
const nudge = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  const t = document.getElementById('toast');
  /* 축하가 줄 서 있는 동안에는 안 민다 */
  const mine = B.find(x=>x.k==='mined' && x.t===1);
  t.textContent = '';
  W.__MY.mined = mine.need; W.__syncMyPC(); W.__badgeCheck();
  o.축하중 = t.textContent;
  /* 줄과 대기를 다 흘려보낸다 (상한을 둔다 — 안 두면 검사가 스스로 매달린다) */
  for(let i=0; i<200 && (W.__bgQueue().length || i<12); i++) W.__badgeCheck();
  /* ★ 다음 문턱의 BG_NUDGE 만큼 가 본다.
     문턱이 작은 갈래를 쓰면 안 된다 — '첫 벽'(3채)은 70% 가 2.1채라 올림하면 곧 문턱이라
     밀어 주는 대신 그냥 받아 버린다. 넉넉한 갈래(2단계 캐기)로 잰다. */
  const nx = B.find(x=>x.k==='mined' && x.t===2);
  W.__MY.mined = Math.ceil(nx.need * W.__BG_NUDGE);
  W.__syncMyPC(); t.textContent = ''; W.__badgeCheck();
  o.민다 = t.textContent;
  o.줄 = W.__bgQueue().length;
  t.textContent = ''; W.__badgeCheck(); W.__badgeCheck();
  o.두번미나 = t.textContent;
  return o;
});
ok('★ 축하가 뜨는 동안에는 "조금만 더" 를 안 띄운다 (받은 것과 남은 것이 겹치면 둘 다 안 읽힌다)',
   nudge.축하중.indexOf('만 더') < 0, nudge.축하중.slice(0,30) || '(빈 줄)');
ok('★ 다음 칭호에 거의 닿으면 한 번 등을 민다 ("한 판만 더" 를 만드는 줄이다)',
   nudge.민다.indexOf('만 더') >= 0 && nudge.줄 === 0, nudge.민다 || '(빈 줄)');
ok('★ 같은 칭호로 두 번 밀지 않는다 (같은 줄이 반복되면 아이들이 아예 안 읽는다)',
   nudge.두번미나.indexOf('만 더') < 0, nudge.두번미나 || '(빈 줄)');

/* ═══════ ⑤ 소리 ═══════ */
const snd = await ev(()=>{
  const W=window, keys = W.__SFX_KEYS();
  return {있나: keys.includes('medal'), 레벨업과다른가: keys.includes('up')};
});
ok('★ 칭호 소리가 소리 표에 있다 (없는 이름을 부르면 sfx 가 조용히 아무것도 안 한다 — 18차e의 그 함정)',
   snd.있나 === true, snd.있나 ? 'medal 있음' : 'medal 없음');
ok('레벨업 소리와 이름이 갈린다 (둘 다 자주 나는데 뜻이 다르다)', snd.레벨업과다른가 === true);

/* ═══════ ⑥ 이름표 — 머리 위에 남는 자리 ═══════ */
const tag = await ev(()=>{
  const W=window, B=W.__BADGES, o={}, t=W.__tagPool()[0];
  const FONT = w => '900 ' + w + 'px -apple-system, "Noto Sans KR", sans-serif';
  const measure = (nm, lv, ic)=>{
    const g = t.c.getContext('2d');
    const mark = ic ? ic + ' ' : '', badge = lv ? 'Lv.' + lv + ' ' : '';
    let fs = 34; g.font = FONT(fs);
    while(fs > 15 && g.measureText(mark + badge + nm).width > 238){ fs -= 2; g.font = FONT(fs); }
    return {fs, w: g.measureText(mark + badge + nm).width};
  };
  /* 칭호가 붙으면 다시 그린다 · 그대로면 안 그린다 */
  t.txt = ''; W.__setTag(t, '김하늘', '#fff', 12, '');
  const r0 = W.__tagRedraws();
  W.__setTag(t, '김하늘', '#fff', 12, '');
  o.그대로면안그림 = W.__tagRedraws() - r0;
  W.__setTag(t, '김하늘', '#fff', 12, B[0].ic);
  o.칭호붙으면다시그림 = W.__tagRedraws() - r0;
  o.열쇠 = t.txt;
  /* 제일 나쁜 경우 — 긴 이름 + 만렙 + 칭호. 열 가지로 재 본다 */
  const names = ['김', '하늘', '김하늘', '박서준', '김하늘사랑', '가나다라마바사'];
  const worst = [];
  for(const nm of names) for(const ic of ['', B[B.length-1].ic])
    worst.push({nm, ic: ic||'없음', ...measure(nm, 35, ic)});
  o.제일작은글자 = Math.min(...worst.map(x=>x.fs));
  o.넘친것 = worst.filter(x=> x.w > 238.5).length;
  o.칭호없을때 = measure('김하늘', 35, '').fs;
  o.칭호있을때 = measure('김하늘', 35, B[B.length-1].ic).fs;
  return o;
});
ok('★ 칭호가 그대로면 이름표를 다시 안 그린다 (256×64 를 GPU 로 다시 올리는 일이다)',
   tag.그대로면안그림 === 0);
ok('칭호가 붙으면 이름표를 다시 그린다', tag.칭호붙으면다시그림 === 1, tag.열쇠);
ok('★ 어떤 이름·칭호로도 이름표 칸(238px)을 안 넘친다 (넘치면 이름이 잘려 누군지 모른다)',
   tag.넘친것 === 0, '제일 작은 글자 '+tag.제일작은글자+'px');
ok('★ 세 글자 이름은 칭호가 붙어도 크게 남는다 (교실에서는 멀리서 본다)',
   tag.칭호있을때 >= 28, '칭호 없이 '+tag.칭호없을때+'px → 붙여서 '+tag.칭호있을때+'px');

/* 친구 머리 위에 실제로 뜨나 */
const live = await ev(()=>{
  const W=window, G=W.__G, B=W.__BADGES, o={};
  const last = B[B.length-1];
  G.players.set('zz', {uid:'zz', x:W.__PL.x, z:W.__PL.z+3, y:W.__GY, ry:0, n:'서준', g:1,
                       hat:0, gls:0, clo:0, mv:false, ph:0, hp:100, down:false});
  W.__pcMap.set('zz', {n:'서준', g:1, lv:9, [last.k]: last.need});
  W.__updTags();
  const idx = W.__tagOwner().get('zz');
  o.칭호 = idx === undefined ? '칸을 못 받음' : W.__tagPool()[idx].txt;
  o.기대 = last.ic;
  G.players.delete('zz'); W.__pcMap.delete('zz'); W.__updTags();
  return o;
});
ok('★ 친구 머리 위 이름표에 그 아이의 칭호가 실제로 붙는다 (계산해서 얻는다 — 보내는 값이 아니다)',
   String(live.칭호).indexOf(live.기대) >= 0, live.칭호);

/* ═══════ ⑦ 칭호 칸 (스텟 창) ═══════ */
await clean();
const panel = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  const mine = B.find(x=>x.k==='mined' && x.t===1);
  W.__MY.mined = mine.need; W.__syncMyPC();
  W.__openStat();
  o.칸 = document.querySelectorAll('#bgList .bgIt').length;
  o.받은칸 = document.querySelectorAll('#bgList .bgIt.on').length;
  o.윗줄 = document.getElementById('bgTop').textContent;
  o.다음줄 = document.getElementById('bgNext').textContent;
  /* 아직 못 받은 칸에도 조건이 적혀 있나 — 이게 없으면 '다음에 뭘 하지' 가 안 보인다 */
  const off = [...document.querySelectorAll('#bgList .bgIt:not(.on) .bd')].map(e=>e.textContent);
  o.조건빈칸 = off.filter(t=>!t || !t.trim()).length;
  /* 다 모으면 다른 말을 한다.
     ★ 레벨은 MY 가 아니라 XP 가 들고 있다 — MY.lv 에 넣어 봐야 syncMyPC 가 XP.lv 로 덮는다 */
  for(const x of B) if(x.k !== 'lv') W.__MY[x.k==='flw'?'flowers':x.k] = x.need;
  W.__XP.lv = W.__LV_MAX;
  W.__syncMyPC(); W.__buildBadgeUI();
  o.다모은뒤 = document.getElementById('bgNext').textContent;
  document.getElementById('popStat').classList.remove('on');
  return o;
});
ok('칭호 칸에 표의 칭호가 다 그려진다', panel.칸 === tbl.수, panel.칸+'칸');
ok('받은 것만 불이 들어온다', panel.받은칸 === 1, panel.받은칸+'개');
ok('받은 개수와 전체가 같이 보인다', /\d+\s*\/\s*\d+/.test(panel.윗줄), panel.윗줄);
ok('★ 다음 칭호와 남은 양이 보인다 (여기가 "다음에 뭘 하지" 에 답하는 자리다)',
   panel.다음줄.indexOf('만 더') >= 0, panel.다음줄);
ok('★ 아직 못 받은 칸에도 조건이 적혀 있다 (흐리게 두되 읽히게)', panel.조건빈칸 === 0);
ok('다 모으면 다른 말을 한다', panel.다모은뒤.indexOf('다') >= 0 && panel.다모은뒤.indexOf('만 더') < 0,
   panel.다모은뒤);

/* ═══════ ⑧ 다시 하기 ═══════ */
const again = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  o.전 = W.__badgeList(W.__myPC()).length;
  /* 게임의 '처음부터 다시' 단추가 하는 것 그대로 — 레벨도 같이 되돌아간다 */
  W.__xpReset(); W.__myReset(); W.__syncMyPC(); W.__badgeCheck();
  o.후 = {가진것:W.__badgeList(W.__myPC()).length, 기억:W.__bgGot().size, 줄:W.__bgQueue().length};
  /* 다시 받을 수 있나 — 기억만 남으면 조용히 아무 일도 안 일어난다 */
  const mine = B.find(x=>x.k==='mined' && x.t===1);
  document.getElementById('feed').innerHTML = '';
  W.__MY.mined = mine.need; W.__syncMyPC(); W.__badgeCheck();
  o.다시받음 = document.querySelectorAll('#feed div').length;
  return o;
});
ok('★ 처음부터 다시 하면 칭호가 지워진다', again.전 > 0 && again.후.가진것 === 0,
   again.전+'개 → '+again.후.가진것+'개');
ok('★ 받았다는 기억과 줄도 같이 지워진다 (기억만 남으면 다시 캐도 조용히 아무 일도 안 난다)',
   again.후.기억 === 0 && again.후.줄 === 0, JSON.stringify(again.후));
ok('다시 시작한 뒤에 같은 칭호를 다시 받는다', again.다시받음 === 1);

/* ═══════ ⑨ 친구 칭호 소식 — 3단계만 ═══════ */
await clean();
const mate = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  const t1 = B.find(x=>x.t===1), t3 = B[B.length-1];
  const F = document.getElementById('feed');
  /* 처음 본 친구의 지난 칭호는 안 띄운다 — 늦게 들어온 아이 화면이 도배된다 */
  W.__pcMap.set('m1', {n:'서준', g:1, [t3.k]: t3.need});
  F.innerHTML=''; W.__badgeCheck();
  o.처음본친구 = F.textContent;
  /* 1단계는 조용히 */
  W.__pcMap.set('m2', {n:'하윤', g:2});
  F.innerHTML=''; W.__badgeCheck();
  W.__pcMap.get('m2')[t1.k] = t1.need;
  F.innerHTML=''; W.__badgeCheck();
  o.친구1단계 = F.textContent;
  /* 3단계는 반 전체가 본다 */
  W.__pcMap.get('m2')[t3.k] = t3.need;
  F.innerHTML=''; W.__badgeCheck();
  o.친구3단계 = F.textContent;
  W.__pcMap.delete('m1'); W.__pcMap.delete('m2');
  return o;
});
ok('★ 처음 본 친구의 지난 칭호는 안 띄운다 (늦게 들어온 아이 화면이 통째로 도배된다)',
   mate.처음본친구.indexOf('서준') < 0, mate.처음본친구.slice(0,40) || '(조용함)');
ok('친구의 1단계 칭호는 조용히 넘어간다 (첫날에만 백 줄이 넘는다)',
   mate.친구1단계.indexOf('하윤') < 0, mate.친구1단계.slice(0,40) || '(조용함)');
ok('★ 친구가 제일 어려운 칭호를 받으면 내 화면에도 뜬다 (통신 한 칸 없이 — 이미 오는 숫자로 안다)',
   mate.친구3단계.indexOf('하윤') >= 0, mate.친구3단계.slice(0,44));

/* ═══════ ⑩ 우리 반 오늘의 기록 ═══════ */
const card = await ev(()=>{
  const W=window, B=W.__BADGES, o={};
  const t3 = B[B.length-1], t1 = B.find(x=>x.t===1);
  W.__pcMap.set('e1', {n:'서준', g:1, [t3.k]: t3.need, [t1.k]: t1.need, mined:10, built:1});
  W.__pcMap.set('e2', {n:'하윤', g:2, [t1.k]: t1.need, mined:5, built:1});
  W.__paintEndCard();
  o.칸 = document.getElementById('ecGrid').textContent;
  o.글 = document.getElementById('ecNote').textContent;
  W.__pcMap.delete('e1'); W.__pcMap.delete('e2');
  return o;
});
ok('★ 우리 반 기록에 반이 모은 칭호 수가 뜬다 (선생님이 칠판에 띄우고 마무리하는 판이다)',
   card.칸.indexOf('모은 칭호') >= 0, card.칸.replace(/\s+/g,' ').slice(0,70));
ok('★ 칭호를 제일 많이 모은 아이의 이름이 남는다 (캔 자원·지은 것 순위에는 안 걸리는 아이다)',
   card.글.indexOf('서준') >= 0 && card.글.indexOf('칭호') >= 0,
   card.글.replace(/\s+/g,' ').slice(0,80));

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
