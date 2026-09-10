/* 22차 성능 — 칭호가 **매 프레임 도는 자리**에 얼마나 얹혔나
   ★ opt2 의 '이름표' 항목으로는 못 잰다 — 그 판에는 친구가 하나도 없어서
     updTags 가 첫 줄에서 그냥 돌아간다(0.001ms 가 나온다). 재려면 사람을 실제로 세워야 한다.
   ★ 옛 판과 새 판을 **같은 자로 같은 판에서** 번갈아 잰다. 옛 기록의 숫자와 비교하지 않는다.
   ★ 조용한 상태에서 돌린다 — 검사를 뒤에 켜 둔 채 재면 값이 널뛴다(17차g).
   쓰는 법: node bdgperf.mjs <옛 파일> <새 파일> [포트] */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const OLD = process.argv[2], NEW = process.argv[3], BASE = +(process.argv[4] || 16400);

async function measure(file, port){
  const srv = serve(port, file);
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const pg = await b.newPage({viewport:{width:1100,height:760}});
  const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load',timeout:60000});
  await pg.waitForFunction('window.__READY===true',{timeout:60000});
  await pg.fill('#iName','측정'); await pg.click('#bSolo'); await pg.waitForTimeout(1400);
  const out = await pg.evaluate(()=>{
    const W=window, G=W.__G, PL=W.__PL, GY=W.__GY;
    /* 스물한 명을 이름표가 잡히는 거리(40칸 안)에 세운다.
       칭호가 갈리게 저마다 다른 숫자를 준다. */
    for(let i=0;i<21;i++){
      const k='p'+i, a=i/21*Math.PI*2, r=6+(i%5)*2;
      G.players.set(k, {uid:k, x:PL.x+Math.cos(a)*r, z:PL.z+Math.sin(a)*r, y:GY, ry:0,
                        n:'친구'+i, g:i%5, hat:0, gls:0, clo:0, mv:false, ph:i, hp:100, down:false});
      W.__pcMap.set(k, {n:'친구'+i, g:i%5, lv:1+i, mined:60*i, built:i, hits:i*4,
                        fixed:i, helped:(i%4), saved:(i%3), farmed:i, flw:(i%11)});
    }
    W.__updTags();                                    // 칸을 나눠 갖게 한 번 돌린다
    /* ★ 게임에서는 badgeCheck 가 0.5초마다 돌면서 칭호를 세어 둔다.
       그걸 안 부르고 재면 이름표가 '아직 안 센 사람' 길로만 가서 제일 느린 길을 재게 된다
       — 실제로 한 번 그렇게 재고 "느려졌다" 고 할 뻔했다. */
    if(W.__badgeCheck) W.__badgeCheck();
    const bench=(n, f)=>{ for(let i=0;i<5;i++) f();
      const t=performance.now(); for(let i=0;i<n;i++) f(); return (performance.now()-t)/n; };
    const tag = bench(400, ()=>W.__updTags());
    /* ★ 칭호가 하나도 없는 사람만 있을 때 = 표를 끝까지 훑는 **제일 나쁜 경우**.
       badgeTop 은 뒤에서부터 찾다 처음 맞는 데서 멈추므로, 아무것도 없는 사람이 제일 비싸다. */
    for(let i=0;i<21;i++) W.__pcMap.set('p'+i, {n:'친구'+i, g:i%5, lv:1});
    if(W.__badgeCheck) W.__badgeCheck();
    const tagWorst = bench(400, ()=>W.__updTags());
    W.__R.info.reset(); W.__render();
    return {tag, tagWorst, draws:W.__R.info.render.calls,
            badges: W.__BADGES ? W.__BADGES.length : 0};
  });
  await b.close(); srv.close();
  return {...out, errs};
}
const rows = [];
for(let r=1; r<=3; r++){
  const o = await measure(OLD, BASE + r*4);
  const n = await measure(NEW, BASE + r*4 + 1);
  rows.push([o, n]);
  console.log(`${r}회  옛판 이름표 ${o.tag.toFixed(3)}ms (제일나쁨 ${o.tagWorst.toFixed(3)}) · 드로우콜 ${o.draws}`);
  console.log(`     새판 이름표 ${n.tag.toFixed(3)}ms (제일나쁨 ${n.tagWorst.toFixed(3)}) · 드로우콜 ${n.draws}`
            + ` · 칭호 ${n.badges}개`);
}
const avg = a => a.reduce((s,v)=>s+v,0)/a.length;
console.log('\n── 평균 (스물한 명이 이름표 거리 안에 있을 때, updTags 한 번) ──');
console.log('  옛판 ' + avg(rows.map(r=>r[0].tag)).toFixed(3) + ' ms · 제일 나쁜 경우 '
          + avg(rows.map(r=>r[0].tagWorst)).toFixed(3) + ' ms');
console.log('  새판 ' + avg(rows.map(r=>r[1].tag)).toFixed(3) + ' ms · 제일 나쁜 경우 '
          + avg(rows.map(r=>r[1].tagWorst)).toFixed(3) + ' ms');
console.log('  드로우콜 옛판 ' + rows.map(r=>r[0].draws).join('·') + ' / 새판 ' + rows.map(r=>r[1].draws).join('·'));
