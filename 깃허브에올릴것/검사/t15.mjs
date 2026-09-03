/* 13차 검사 — 이름표 레벨 · 혼자 일어나기 · 연속 명중 · 오늘의 임무 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 11100);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const pg = await b.newPage({viewport:{width:1180,height:760}});
pg.on('pageerror', e=>errs.push(e.message));
pg.on('console', m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','하늘'); await pg.click('#bSolo');
await pg.waitForFunction('window.__G && window.__G.started===true', {timeout:30000});
await pg.waitForTimeout(900);

/* ───────── 이름표에 레벨 ───────── */
const tag = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  W.__introDone();
  /* 친구 둘을 만들어 놓는다 */
  G.players.set('f1', {x:W.__PL.x+2, z:W.__PL.z+2, y:W.__PL.y, ry:0, g:1, n:'민준', mv:false, hp:100});
  G.players.set('f2', {x:W.__PL.x-2, z:W.__PL.z+2, y:W.__PL.y, ry:0, g:2, n:'서연', mv:false, hp:100});
  const pc = W.__pcMap;
  pc.set('f1', {g:1, n:'민준', lv:7, mined:40, built:3, hits:9, fixed:1});
  pc.set('f2', {g:2, n:'서연', lv:2, mined:12, built:1, hits:2, fixed:0});
  W.__updTags();
  const own = W.__tagOwner(), pool = W.__tagPool();
  const txt = {};
  for(const [uid, idx] of own) txt[uid] = pool[idx].txt;
  o.f1 = txt.f1 || ''; o.f2 = txt.f2 || '';
  /* 레벨이 오르면 이름표도 다시 그려진다 */
  const before = W.__tagRedraws();
  W.__updTags();
  o.noRedraw = (W.__tagRedraws() === before);        // 그대로면 다시 안 그린다
  pc.get('f1').lv = 8; W.__updTags();
  o.redrew = (W.__tagRedraws() > before);
  o.f1b = pool[own.get('f1')].txt;
  /* 레벨이 없는 사람은 이름만 */
  pc.delete('f2'); W.__updTags();
  o.f2b = pool[own.get('f2')].txt;
  return o;
});
ok('★ 이름표에 레벨이 들어간다', /\|7$/.test(tag.f1), tag.f1);
ok('레벨이 다른 친구는 다른 값', /\|2$/.test(tag.f2), tag.f2);
ok('값이 그대로면 이름표를 다시 안 그린다', tag.noRedraw);
ok('★ 레벨이 오르면 이름표를 다시 그린다', tag.redrew && /\|8$/.test(tag.f1b), tag.f1b);
ok('레벨을 모르는 사람은 이름만', /\|0$/.test(tag.f2b), tag.f2b);

/* ───────── 혼자 일어나기 ───────── */
const dn = await pg.evaluate(()=>{
  const W=window, PL=W.__PL, o={};
  o.sec = W.__SELF_REVIVE;
  W.__goDown();
  o.down = PL.down;
  o.text = W.__goalText();
  for(let i=0;i<Math.round((W.__SELF_REVIVE-2)*10);i++) W.__downTick(0.1);
  o.stillDown = PL.down;
  o.leftText = W.__goalText();
  for(let i=0;i<40;i++) W.__downTick(0.1);
  o.up = !PL.down;
  o.hp = PL.hp; o.max = W.__maxHP();
  /* 친구가 일으키면 꽉 찬다 */
  W.__goDown(); W.__reviveMe('민준');
  o.friendHp = PL.hp;
  return o;
});
ok('★ 쓰러져도 혼자 일어난다 (' + dn.sec + '초)', dn.down && dn.up, dn.up ? '일어남' : '못 일어남');
ok('그 전에는 일어나지 않는다', dn.stillDown);
ok('★ 혼자 일어나면 체력이 절반', dn.hp <= dn.max*0.55 && dn.hp > 0, dn.hp + '/' + dn.max);
ok('★ 친구가 일으키면 꽉 찬다', dn.friendHp === dn.max, dn.friendHp + '/' + dn.max);
ok('★ 남은 시간을 알려 준다', /혼자서는 \d+초/.test(dn.leftText), dn.leftText);

/* ───────── 연속 명중 ───────── */
const cb = await pg.evaluate(()=>{
  const W=window, o={};
  W.__comboMiss();
  o.start = W.__combo().mul;
  for(let i=0;i<2;i++) W.__comboHit();
  o.at2 = W.__combo().mul;
  for(let i=0;i<4;i++) W.__comboHit();          // 6연속
  o.at6 = W.__combo().mul; o.n6 = W.__combo().n;
  o.el = (document.getElementById('combo').textContent||'');
  o.on = document.getElementById('combo').classList.contains('on');
  for(let i=0;i<40;i++) W.__comboHit();
  o.cap = W.__combo().mul;                      // 위 뚜껑
  W.__comboMiss();
  o.afterMiss = W.__combo().n;
  o.elOff = !document.getElementById('combo').classList.contains('on');
  /* 시간이 지나면 끊긴다 */
  W.__comboHit(); W.__comboHit(); W.__comboHit();
  for(let i=0;i<40;i++) W.__comboTick(0.1);
  o.afterTime = W.__combo().n;
  return o;
});
ok('처음엔 보너스가 없다', cb.start === 1, '×'+cb.start);
ok('2연속까지는 그대로', cb.at2 === 1, '×'+cb.at2);
ok('★ 3연속부터 세진다', cb.at6 > 1, cb.n6 + '연속 ×' + cb.at6.toFixed(2));
ok('★ 보너스에 뚜껑이 있다 (밸런스가 안 흔들리게)', cb.cap <= 1.2001, '×'+cb.cap.toFixed(2));
ok('★ 화면에 연속 수가 뜬다', cb.on && /연속/.test(cb.el), cb.el);
ok('★ 빗나가면 끊긴다', cb.afterMiss === 0 && cb.elOff);
ok('★ 한동안 못 맞혀도 끊긴다', cb.afterTime === 0);

/* ───────── 오늘의 임무 ───────── */
const ms = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  o.kinds = W.__MISSIONS.map(m=>m.k);
  /* 날짜만 보고 정한다 — 스물한 대가 같은 걸 봐야 한다 */
  o.same = [1,2,3,7,12,15].every(d=> W.__misOf(d).k === W.__misOf(d).k);
  o.varies = new Set([1,2,3,4,5].map(d=>W.__misOf(d).k)).size >= 3;
  /* 사람이 많으면 목표도 커진다 */
  const pc = W.__pcMap;
  pc.clear(); pc.set('me', {n:'하늘', g:0, mined:0, built:0, hits:0, fixed:0});
  const need1 = W.__misNeed();
  for(let i=0;i<20;i++) pc.set('p'+i, {n:'친구'+i, g:i%5, mined:0, built:0, hits:0, fixed:0});
  const need21 = W.__misNeed();
  o.need1 = need1; o.need21 = need21;
  o.scales = need21 > need1 * 5;
  /* 채우면 완료되고 자재를 준다 */
  pc.clear();
  const me = {n:'하늘', g:0, mined:0, built:0, hits:0, fixed:0};
  pc.set('me', me);
  G.host = true; W.__misReset();
  const M = W.__misOf(G.day), need = W.__misNeed();
  o.before = G.mis + '/' + need + ' 완료' + G.misD;
  const w0 = G.res[0].w, s0 = G.res[0].s, g0 = G.res[0].g;
  me[M.k] = Math.ceil(need/2); W.__misTally();
  o.half = G.mis; o.halfDone = G.misD;
  me[M.k] = need; W.__misTally();
  o.full = G.mis; o.done = G.misD;
  o.gotW = G.res[0].w - w0; o.gotS = G.res[0].s - s0; o.gotG = G.res[0].g - g0;
  /* 완료를 보면 경험치를 받는다 (한 번만)
     ★ 지금까지 쌓은 경험치를 '합계'로 재야 한다. 레벨이 오르면 XP.xp 는 줄어들고,
       만렙이면 아예 안 오른다 — 그 둘 때문에 검사가 흔들렸다. */
  W.__xpReset();
  const tot = ()=>{ let t = W.__XP.xp; for(let L=1;L<W.__XP.lv;L++) t += W.__XP_NEED[L]; return t; };
  const xpA = tot(); W.__misWatch(); const xpB = tot();
  W.__misWatch(); W.__misWatch(); const xpC = tot();
  o.xpOnce = (xpB > xpA) && (xpC === xpB);
  o.xpGot = Math.round(xpB - xpA);
  /* 한 번 채우면 더 안 늘어난다 */
  me[M.k] = need*3; W.__misTally();
  o.gotW2 = G.res[0].w - w0;
  /* 화면 */
  W.__paintHUD();
  o.chipOn = document.getElementById('misWrap').classList.contains('on');
  o.chipDone = document.getElementById('misWrap').classList.contains('done');
  o.chipTxt = document.getElementById('misNum').textContent;
  return o;
});
ok('임무가 네 가지', ms.kinds.length === 4, ms.kinds.join('/'));
ok('★ 어느 임무인지는 날짜로만 정한다 (모두 같은 걸 본다)', ms.same);
ok('날마다 바뀐다', ms.varies);
ok('★ 사람이 많을수록 목표도 커진다', ms.scales, '1명 ' + ms.need1 + ' → 21명 ' + ms.need21);
ok('반쯤 채우면 아직 완료가 아니다', ms.halfDone === 0, ms.half + '개');
ok('★ 다 채우면 완료된다', ms.done === 1, ms.full + '개');
ok('★ 완료하면 모둠이 자재를 받는다',
   ms.gotW > 0 && ms.gotS > 0 && ms.gotG > 0, `🪵+${ms.gotW} 🪨+${ms.gotS} ✨+${ms.gotG}`);
ok('★ 완료하면 경험치를 받는다 — 딱 한 번만', ms.xpOnce, '+'+ms.xpGot);
ok('★ 더 해도 보상은 한 번뿐', ms.gotW2 === ms.gotW, ms.gotW2);
ok('★ 화면에 임무 줄이 뜬다', ms.chipOn && ms.chipDone, ms.chipTxt);

let pass=0, fail=0;
for(const [n,c,v] of R){ console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); c?pass++:fail++; }
console.log('\n' + (fail?`${fail}개 실패 / `:'') + `${pass}항목 통과`);
console.log(errs.length ? '\n오류: '+errs.slice(0,6).join(' | ') : '\n(오류 없음)');
await b.close(); srv.close();
process.exit(fail?1:0);
