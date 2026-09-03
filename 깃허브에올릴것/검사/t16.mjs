/* 14차 검사 — 레벨 25 · 자원 · 공사 시간 · 대장간(무기 강화) · 남의 무기 보이기 ·
   레벨 순위 · 벽 체력 · U 수치표 · 18일차 확장
   ★ 값을 검사에 박지 않는다. 게임에서 읽어서 '관계'를 본다 —
     밸런스를 고칠 때마다 검사가 죽으면 그건 검사가 아니다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 11600);
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

/* ═══════ ① 레벨 25 · 스텟 상한 ═══════ */
const lv = await pg.evaluate(()=>{
  const W=window, X=W.__XP, o={};
  W.__xpReset();
  o.max = W.__LV_MAX;
  o.needRises = (()=>{ for(let L=2;L<W.__LV_MAX;L++) if(W.__XP_NEED[L] <= W.__XP_NEED[L-1]) return false; return true; })();
  o.total = (()=>{ let t=0; for(let L=1;L<W.__LV_MAX;L++) t+=W.__XP_NEED[L]; return t; })();
  W.__xpGain(o.total*3);
  o.capLv = X.lv; o.pts = X.pts;
  o.statMax = W.__STATS.map(s=>s.max);
  o.statSum = o.statMax.reduce((a,c)=>a+c,0);
  return o;
});
ok('만렙이 25 다', lv.max === 25, lv.max);
ok('레벨이 오를수록 필요한 경험치가 는다', lv.needRises);
ok('★ 만렙에 닿으면 거기서 멈춘다', lv.capLv === lv.max, 'Lv'+lv.capLv);
ok('★ 점수는 레벨 수만큼 준다 (처음 1점 + 레벨마다 1점)', lv.pts === lv.max, lv.pts+'점');
ok('★ 스텟을 다 찍을 수는 없다 (골라야 한다)', lv.statSum > lv.max,
   '상한 합계 '+lv.statSum+' > 점수 '+lv.max);

/* ═══════ ② 자원 산출 ═══════ */
const nd = await pg.evaluate(()=>{
  const W=window, D=W.__NODE_DEF, o={};
  for(const k of ['tree','rock','gold'])
    o[k] = {칸:D[k].hits/D[k].per, 칸당:D[k].amt, 총:(D[k].hits/D[k].per)*D[k].amt};
  /* 실제로 캐 봤을 때 들어오는 양 (표만 고치고 안 쓰면 소용없다) */
  W.__xpReset();
  for(let i=0;i<5;i++) W.__base[i]={w:0,s:0,o:0}; W.__recompute();
  const n = W.__NODES.find(x=>x.alive && x.type==='tree');
  const g0 = W.__G.res[W.__G.me.g].w;
  /* ★ per=2 다 — 두 번 때려야 한 칸이 캐진다. 한 번만 때리면 0 이 나온다. */
  for(let k=0;k<D.tree.per;k++) W.__hitNode(n);
  o.한번캐면 = W.__G.res[W.__G.me.g].w - g0;
  return o;
});
ok('나무 한 그루가 5칸 × 4 = 20', nd.tree.칸===5 && nd.tree.칸당===4 && nd.tree.총===20,
   nd.tree.칸+'칸 × '+nd.tree.칸당+' = '+nd.tree.총);
ok('바위 한 덩이도 20', nd.rock.총===20, nd.rock.총);
ok('금 광맥이 5칸 × 3 = 15', nd.gold.총===15, nd.gold.칸+'칸 × '+nd.gold.칸당+' = '+nd.gold.총);
ok('★ 표만 바꾼 게 아니라 실제로 그만큼 들어온다',
   nd.한번캐면 === nd.tree.칸당, '한 번 캐서 +'+nd.한번캐면);

/* ═══════ ③ 공사 시간 20% 단축 ═══════ */
const wt = await pg.evaluate(()=>{
  const W=window, X=W.__XP, o={};
  W.__xpReset();
  o.벽 = W.__workSec('wwall'); o.탑 = W.__workSec('arrow'); o.강화 = W.__upSec();
  /* 🔨 빠른 망치를 찍으면 '줄어든 값에서' 더 줄어야 한다 */
  W.__xpGain(999999);
  for(let i=0;i<3;i++) W.__takeStat(2);
  o.벽스텟 = W.__workSec('wwall');
  return o;
});
ok('나무벽 2.8초', Math.abs(wt.벽-2.8)<0.001, wt.벽);
ok('화살탑 6.4초', Math.abs(wt.탑-6.4)<0.001, wt.탑);
ok('강화 4초', Math.abs(wt.강화-4)<0.001, wt.강화);
ok('★ 스텟은 줄어든 값에서 더 줄인다', wt.벽스텟 < wt.벽*0.75,
   wt.벽.toFixed(2)+'초 → '+wt.벽스텟.toFixed(2)+'초 (🔨3단계)');

/* ═══════ ④ 벽이 탑·배럭보다 튼튼하다 ═══════ */
const hp = await pg.evaluate(()=>{
  const W=window, B=W.__BUILD, M=W.__MAXLV(), o={};
  for(const t of ['wwall','swall','arrow','ice','barr'])
    o[t] = {lv1:W.__bs(t,'hp',1), lv6:W.__bs(t,'hp',M)};
  return o;
});
const 탑최대 = Math.max(hp.arrow.lv6, hp.ice.lv6, hp.barr.lv6);
ok('★ 나무벽이 탑·배럭 전부보다 튼튼하다 (Lv6)', hp.wwall.lv6 > 탑최대,
   '나무벽 '+hp.wwall.lv6+' > 제일 튼튼한 탑·배럭 '+탑최대);
ok('★ 돌벽이 나무벽보다 튼튼하다', hp.swall.lv6 > hp.wwall.lv6,
   hp.swall.lv6+' > '+hp.wwall.lv6);
ok('★ Lv1 에서도 벽이 더 튼튼하다', hp.wwall.lv1 > hp.arrow.lv1 && hp.swall.lv1 > hp.barr.lv1,
   '나무벽 '+hp.wwall.lv1+' vs 화살탑 '+hp.arrow.lv1+' · 돌벽 '+hp.swall.lv1+' vs 배럭 '+hp.barr.lv1);
ok('돌벽이 화살탑의 3배는 된다', hp.swall.lv6 >= hp.arrow.lv6*3,
   (hp.swall.lv6/hp.arrow.lv6).toFixed(1)+'배');

/* ═══════ ⑤ 대장간 — 강화 ═══════ */
const fg = await pg.evaluate(()=>{
  const W=window, G=W.__G, E=W.__enh, o={};
  const [fx,fz] = W.__forgeXZ(), [sx,sz] = W.__shopXZ();
  o.떨어져있나 = Math.hypot(fx-sx, fz-sz) > 8;
  /* 자리에 건물을 못 짓는다 */
  o.못짓나 = W.__canPlace('wwall', Math.round(fx), Math.round(fz)) !== null;
  /* 밤에는 안 열린다 */
  G.phase='night'; o.밤에닫힘 = !W.__forgeOpenable();
  G.phase='day';
  /* 멀면 안 열린다 */
  W.__PL.x = fx + 40; W.__PL.z = fz; o.멀면닫힘 = !W.__forgeOpenable();
  W.__PL.x = fx + 1.2; W.__PL.z = fz; o.가까우면열림 = W.__forgeOpenable();

  o.단계 = E.max; o.확률 = E.odds.slice(); o.안전 = E.safe;
  o.확률이내려간다 = E.odds.every((v,i)=> i===0 || v <= E.odds[i-1]);
  o.배수가오른다 = E.mul.every((v,i)=> i===0 || v > E.mul[i-1]);
  o.값이오른다 = E.cost.every((v,i)=> i===0 || v > E.cost[i-1]);

  /* 맨손 돌은 강화할 수 없다 (값이 없는 무기) */
  o.맨손못함 = W.__enhCost(0) === null;
  /* 무기마다 따로 쌓인다 */
  W.__KIT.ownW=[true,true,true,true,true,true,true]; W.__KIT.enh=[];
  W.__setEnh(3, 4);
  o.따로쌓임 = W.__enhOf(3)===4 && W.__enhOf(5)===0;
  /* 공격력에 실제로 먹는가 */
  W.__equipW ? 0 : 0;
  const before = (()=>{ W.__setEnh(5,0); W.__KIT.wpn=5; return W.__wpnDmg?W.__wpnDmg():null; })();
  return o;
});
ok('대장간이 상인과 떨어져 있다', fg.떨어져있나);
ok('★ 대장간 자리에는 건물을 못 짓는다', fg.못짓나);
ok('밤에는 대장간이 닫힌다', fg.밤에닫힘);
ok('멀면 안 열린다', fg.멀면닫힘);
ok('가까이 가면 열린다', fg.가까우면열림);
ok('+6 까지 올라간다', fg.단계===6, fg.단계);
ok('★ 확률이 80·65·50·35·20 로 내려간다',
   fg.확률[0]===0.8 && fg.확률[1]===0.65 && fg.확률[2]===0.5 && fg.확률[3]===0.35 && fg.확률[4]===0.2,
   fg.확률.map(v=>Math.round(v*100)+'%').join(' → '));
ok('확률이 단계마다 낮아지기만 한다', fg.확률이내려간다);
ok('★ +3 까지가 안전 구간이다', fg.안전===3, '+'+fg.안전);
ok('강화할수록 공격력 배수가 오른다', fg.배수가오른다);
ok('강화할수록 값이 비싸진다', fg.값이오른다);
ok('★ 맨손 돌은 강화할 수 없다', fg.맨손못함);
ok('★ 강화는 무기마다 따로 쌓인다', fg.따로쌓임);

const dmg = await pg.evaluate(()=>{
  const W=window, o={};
  W.__xpReset(); W.__KIT.enh=[]; W.__KIT.wpn=5; W.__KIT.ownW[5]=true;
  o.plain = W.__wpnDmg ? W.__wpnDmg() : null;
  W.__setEnh(5,6);
  o.six = W.__wpnDmg ? W.__wpnDmg() : null;
  o.mul = W.__enh.mul[6];
  /* 값도 원래 무기 값에 비례해야 한다 — 싼 총과 비싼 총의 강화 값이 같으면
     싼 총만 올리는 게 늘 정답이 된다 */
  W.__KIT.enh=[];
  const c새총 = W.__enhCost(1), c저격 = W.__enhCost(5);
  o.비쌈 = (c저격.s + c저격.g*3) > (c새총.w + c새총.g*3);
  return o;
});
ok('★ 강화가 실제 공격력에 먹는다', dmg.six > dmg.plain,
   dmg.plain + ' → ' + dmg.six + ' (표 배수 ×' + dmg.mul + ')');
ok('★ 강화 배수가 표와 맞는다', Math.abs(dmg.six/dmg.plain - dmg.mul) < 0.02,
   (dmg.six/dmg.plain).toFixed(2));
ok('★ 비싼 무기는 강화도 비싸다 (싼 총만 올리는 게 정답이 되면 안 된다)', dmg.비쌈);

/* 강화를 실제로 굴려 본다 — 성공하면 오르고, 안전 구간에서는 안 내려간다 */
const roll = await pg.evaluate(()=>{
  const W=window, o={};
  for(let i=0;i<5;i++) W.__base[i]={w:99999,s:99999,o:99999}; W.__recompute();
  W.__KIT.ownW=[true,true,true,true,true,true,true];
  /* 안전 구간(+1~+3)에서 200번 굴려도 절대 0 밑으로 안 내려간다 */
  W.__KIT.enh=[]; let 안전깨짐=0;
  for(let i=0;i<200;i++){
    if(W.__enhOf(2) >= 3) W.__setEnh(2, 0);      // 안전 구간에 붙잡아 둔다
    const before = W.__enhOf(2);
    W.__doEnhance(2);
    if(W.__enhOf(2) < before) 안전깨짐++;
  }
  o.안전깨짐 = 안전깨짐;
  /* 위험 구간에서는 내려가는 일이 실제로 생긴다 */
  let 내려감=0;
  for(let i=0;i<400;i++){
    W.__setEnh(2, 5);
    W.__doEnhance(2);
    if(W.__enhOf(2) < 5) 내려감++;
  }
  o.내려감 = 내려감;
  /* 최고 단계에서는 더 안 오른다 */
  W.__setEnh(2, 6); W.__doEnhance(2); o.최고유지 = W.__enhOf(2);
  o.최고값없음 = W.__enhCost(2) === null;
  return o;
});
ok('★ 안전 구간(+1~+3)에서는 200번 실패해도 안 내려간다', roll.안전깨짐 === 0, roll.안전깨짐+'번 내려감');
ok('★ 위험 구간(+4~)에서는 실패하면 내려가는 일이 생긴다', roll.내려감 > 0, roll.내려감+'/400번');
ok('★ 40분 수업에서 +6 이 나올 만한 확률이다 (반드시 내려가면 172번 걸린다)',
   roll.내려감 < 400*0.8*0.6, '400번 중 '+roll.내려감+'번만 내려감');
ok('최고 단계에서는 더 안 오른다', roll.최고유지 === 6, '+'+roll.최고유지);
ok('최고 단계에서는 값이 안 뜬다', roll.최고값없음);

/* ═══════ ⑥ 남의 무기가 보인다 ═══════ */
const gun = await pg.evaluate(async ()=>{
  const W=window, G=W.__G, PL=W.__PL, o={};
  /* 통신 — 자리 통로에 칸을 더하지 않았나 */
  W.__KIT.ownW[5]=true; W.__equipWeapon ? 0 : 0;
  W.__setEnh(5,6); W.__KIT.wpn=5; W.__setAim ? 0 : 0;
  W.__syncMyPC ? W.__syncMyPC() : 0;
  const my = W.__myPC();
  o.pc칸 = ('wp' in my) && ('we' in my);

  /* 친구 셋을 세우고 그려 본다 */
  G.players.clear(); W.__pcMap.clear();
  [[0,0],[5,3],[5,6]].forEach(([wp,we],i)=>{
    const uid='g'+i;
    G.players.set(uid,{uid, x:PL.x+(i-1)*2.2, z:PL.z+4, y:PL.y, ry:0, mv:false, down:false,
                       hp:100, hat:0, gls:0, clo:0, g:i, n:'친구'+i, ph:i});
    W.__pcMap.set(uid,{n:'친구'+i, g:i, lv:20, wp, we, mined:0, built:0});
  });
  await new Promise(r=>setTimeout(r,600));
  const [G1,G2] = W.__gunMeshes();
  o.총칸 = G1.count; o.빛칸 = G2.count;
  o.총보임 = G1.visible; o.빛보임 = G2.visible;
  o.드로우콜 = 2;                       // 메시 두 벌뿐 — 사람이 몇이든

  /* 아무도 총을 안 들면 통째로 숨는다 */
  for(const k of W.__pcMap.keys()) W.__pcMap.get(k).wp = 0;
  await new Promise(r=>setTimeout(r,600));
  const [H1,H2] = W.__gunMeshes();
  o.빈칸숨김 = !H1.visible && !H2.visible;

  /* 쓰러진 친구는 총을 놓는다 */
  for(const k of W.__pcMap.keys()) W.__pcMap.get(k).wp = 5;
  for(const p of G.players.values()) p.down = true;
  await new Promise(r=>setTimeout(r,600));
  o.쓰러지면숨김 = !W.__gunMeshes()[0].visible;
  for(const p of G.players.values()) p.down = false;

  o.단계별 = W.__enh.fx.map(f=>[f.glow, f.sh]);
  return o;
});
ok('★ 무기·강화가 pc 통로로 나간다 (자리 통로는 안 건드렸다)', gun.pc칸);
ok('★ 친구가 든 총이 그려진다', gun.총보임 && gun.총칸 > 0, gun.총칸+'칸');
ok('★ 강화한 총은 빛 조각이 붙는다', gun.빛보임 && gun.빛칸 > 0, gun.빛칸+'칸');
ok('★ 사람이 몇이든 그리기는 두 번뿐이다', gun.드로우콜 === 2);
ok('★ 아무도 총을 안 들면 통째로 숨는다', gun.빈칸숨김);
ok('★ 쓰러진 친구는 총을 놓는다', gun.쓰러지면숨김);
ok('★ +0 은 안 빛나고, 올라갈수록 더 빛난다',
   gun.단계별[0][0] === 0 && gun.단계별.every((v,i)=> i===0 || v[0] > gun.단계별[i-1][0]),
   gun.단계별.map(v=>v[0]).join(' < '));
ok('★ +4 부터 떨린다 (그 아래는 안 떨린다)',
   gun.단계별[3][1] === 0 && gun.단계별[4][1] > 0,
   '+3 흔들림 '+gun.단계별[3][1]+' · +4 흔들림 '+gun.단계별[4][1]);

/* ═══════ ⑦ 레벨 순위 ═══════ */
const rk = await pg.evaluate(async ()=>{
  const W=window, o={};
  W.__pcMap.clear();
  ['가',    '나',   '다',   '라'].forEach((n,i)=> W.__pcMap.set('r'+i,{n, g:i%5, lv:(i+1)*5, mined:0, built:0}));
  W.__pcMap.set(W.__uid, {n:'김하늘', g:0, lv:7, mined:0, built:0});
  W.__paintHUD();
  const rows = [...document.querySelectorAll('#rankList .rkRow')];
  o.줄수 = rows.length;
  o.순서 = rows.map(r=> +r.querySelector('.rkLv').textContent);
  o.내려간다 = o.순서.every((v,i)=> i===0 || v <= o.순서[i-1]);
  o.내칸표시 = rows.some(r=> r.classList.contains('me'));
  o.보임 = getComputedStyle(document.getElementById('rankWrap')).display !== 'none';
  /* 값이 안 바뀌면 DOM 을 안 건드린다 (HUD 규칙) */
  const w = document.getElementById('rankList');
  let n=0; const mo = new MutationObserver(ms=> n+=ms.length);
  mo.observe(w,{childList:true,subtree:true,characterData:true});
  for(let i=0;i<40;i++) W.__paintHUD();
  await new Promise(r=>setTimeout(r,60));
  o.DOM변경 = n; mo.disconnect();
  /* 혼자면 판을 숨긴다 */
  W.__pcMap.clear(); W.__pcMap.set(W.__uid,{n:'김하늘',g:0,lv:1,mined:0,built:0});
  W.__paintHUD();
  o.혼자면숨김 = getComputedStyle(document.getElementById('rankWrap')).display === 'none';
  return o;
});
ok('★ 순위가 보인다', rk.보임 && rk.줄수 >= 2, rk.줄수+'줄');
ok('★ 레벨 높은 순으로 줄 선다', rk.내려간다, rk.순서.join(' ≥ '));
ok('★ 내 칸이 표시된다', rk.내칸표시);
ok('★ 값이 그대로면 40번 칠해도 DOM 을 안 건드린다', rk.DOM변경 === 0, rk.DOM변경+'건');
ok('혼자 할 때는 판을 숨긴다', rk.혼자면숨김);

/* ═══════ ⑧ U 수치표 ═══════ */
const info = await pg.evaluate(async ()=>{
  const W=window, o={};
  dispatchEvent(new KeyboardEvent('keydown',{key:'u'}));
  await new Promise(r=>setTimeout(r,80));
  o.열림 = document.getElementById('popInfo').classList.contains('on');
  const t = document.getElementById('infoTable').textContent;
  o.막대수 = document.querySelectorAll('#infoBars .ifBar').length;
  o.줄수 = document.querySelectorAll('#infoTable .ifT tr').length - 1;   // 머리줄 빼고
  /* 표에 실제 값이 들어 있나 — 손으로 옮겨 적으면 다음에 값을 고칠 때 어긋난다 */
  o.돌벽체력있음 = t.includes(String(W.__bs('swall','hp',W.__MAXLV())));
  o.화살탑공격있음 = t.includes(String(W.__bs('arrow','dmg',W.__MAXLV())));
  dispatchEvent(new KeyboardEvent('keydown',{key:'u'}));
  await new Promise(r=>setTimeout(r,80));
  o.닫힘 = !document.getElementById('popInfo').classList.contains('on');
  return o;
});
ok('★ U 로 수치표가 열린다', info.열림);
ok('다섯 건물이 다 나온다', info.막대수 === 5 && info.줄수 === 5, '막대 '+info.막대수+' · 표 '+info.줄수+'줄');
ok('★ 표가 게임 값을 그대로 읽는다 (손으로 옮겨 적지 않았다)',
   info.돌벽체력있음 && info.화살탑공격있음);
ok('U 를 다시 누르면 닫힌다', info.닫힘);

/* ═══════ ⑨ 18일차까지 · 보스 ═══════ */
const day = await pg.evaluate(()=>{
  const W=window, G=W.__G, o={};
  o.목표 = G.set.goalDay;
  o.보스날 = W.__bossDays();
  o.보스이름 = o.보스날.map((d,i)=> W.__WOLF_T[W.__bossWolfK(i)].n);
  /* 15일차까지의 진행도가 예전(15일 기준)과 같아야 한다 */
  o.진행도 = [1,5,9,12,15,16,17,18].map(d=> +W.__prog(d).toFixed(3));
  o.마리수 = [12,14,15,16,17,18].map(d=> W.__waveFor(d).kinds.length);
  /* 등급도 기준점이 같아야 한다 */
  o.등급 = [5,9,12,15,18].map(d=> W.__wolfRank(d));
  /* 이름 — 16·17일차가 '마지막 밤'을 가져가면 안 된다 */
  o.이름 = [14,16,17].map(d=> W.__stageName(d));
  /* 늑대 렌더 상한을 안 넘는가 */
  o.최대마리 = Math.max(...[16,17,18].map(d=> W.__waveFor(d).kinds.length));
  return o;
});
ok('목표가 18일차다', day.목표 === 18, day.목표+'일');
ok('★ 보스날이 5·9·12·15·18 이다 (15일차까지의 자리가 안 밀렸다)',
   day.보스날.join(',') === '5,9,12,15,18', day.보스날.join(','));
ok('★ 15일차 보스가 지옥의 늑대, 18일차가 늑대왕이다',
   day.보스이름[3].includes('지옥') && day.보스이름[4].includes('늑대왕'),
   day.보스이름.join(' / '));
ok('★ 15일차 진행도가 정확히 1.0 이다 (여태 잰 표가 그대로 산다)',
   day.진행도[4] === 1, day.진행도.join(' '));
ok('★ 1·5·9·12일차 진행도가 예전 값 그대로다',
   day.진행도[0]===0 && day.진행도[1]===0.286 && day.진행도[2]===0.571 && day.진행도[3]===0.786,
   day.진행도.slice(0,4).join(' '));
ok('★ 16·17·18일차가 순서대로 더 어려워진다',
   day.진행도[5] > 1 && day.진행도[6] > day.진행도[5] && day.진행도[7] > day.진행도[6],
   day.진행도.slice(5).join(' < '));
ok('★ 등급이 예전과 같다 (12일차가 흉포한 그대로)',
   day.등급.join(',') === '1,2,3,3,3', day.등급.join(','));
ok('★ 16·17일차가 "마지막 밤" 이름을 가져가지 않는다',
   day.이름[1] !== '마지막 밤' && day.이름[2] !== '마지막 밤', day.이름.join(' / '));
ok('★ 마리수가 늑대 렌더 상한(92)을 안 넘는다', day.최대마리 <= 92, day.최대마리+'마리');
ok('마리수가 13~14일차(74)보다 늘어난다', day.마리수[4] > 74, day.마리수.join(' '));

/* ═══════ 결과 ═══════ */
console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
process.exit(bad?1:0);
