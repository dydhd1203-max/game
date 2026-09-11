/* 23차 성능 — 가방이 WebGL 판을 하나 더 여는 값을 잰다.
   ★ 게임이 이미 재고 있는 FPS(__fps)를 읽는다. 페이지 안에서 rAF 를 직접 세려다
     한 번 멈춰서(15분) 버렸다 — 게임이 이미 아는 것을 다시 만들지 않는다.
   ★ 물어야 할 것 셋: ① 가방을 안 열면 정말 0인가 ② 열어 둔 동안 얼마나 비싸지나
     ③ 전직 카드 사진 세 장 찍는 데 얼마나 걸리나(멈칫하면 티가 난다). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const OLD = process.argv[2], NEW = process.argv[3], BASE = +(process.argv[4] || 16950);

async function measure(file, port, isNew){
  const srv = serve(port, file);
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const pg = await b.newPage({viewport:{width:1100,height:760}});
  await pg.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load',timeout:60000});
  await pg.waitForFunction('window.__READY===true',{timeout:60000});
  await pg.fill('#iName','측정'); await pg.click('#bSolo'); await pg.waitForTimeout(1500);
  await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
  const o = {};
  await pg.waitForTimeout(2500); o.닫힘 = await pg.evaluate(()=>window.__fps());
  o.여는데 = await pg.evaluate(()=>{
    const W=window, K=W.__KIT;
    for(let i=0;i<W.__WEAPONS.length;i++) if(!W.__WEAPONS[i].mini) K.ownW[i]=true;
    for(let i=0;i<W.__ARMORS.length;i++) K.ownA[i]=true;
    for(let i=0;i<W.__POTIONS.length;i++) K.pot[i]=3;
    const t=performance.now(); W.__openKit(); return performance.now()-t;
  });
  await pg.waitForTimeout(2500); o.열림 = await pg.evaluate(()=>window.__fps());
  await pg.evaluate(()=>document.getElementById('popKit').classList.remove('on'));
  await pg.waitForTimeout(2500); o.닫은뒤 = await pg.evaluate(()=>window.__fps());
  o.전직카드 = isNew ? await pg.evaluate(()=>{
    const W=window; W.__xpReset(); W.__XP.lv = W.__JOB_LV[0];
    const t=performance.now(); W.__buildJobUI(); const d=performance.now()-t;
    document.getElementById('popJob').classList.remove('on'); return d;
  }) : 0;
  await b.close(); srv.close();
  return o;
}
const rows=[];
for(let r=1;r<=3;r++){
  const o = await measure(OLD, BASE+r*4, false);
  const n = await measure(NEW, BASE+r*4+1, true);
  rows.push([o,n]);
  console.log(`${r}회 옛판 닫힘 ${o.닫힘}fps · 열림 ${o.열림}fps`);
  console.log(`     새판 닫힘 ${n.닫힘}fps · 열림 ${n.열림}fps · 닫은뒤 ${n.닫은뒤}fps`
            + ` · 여는데 ${n.여는데.toFixed(0)}ms · 전직카드 ${n.전직카드.toFixed(0)}ms`);
}
const avg = a => (a.reduce((s,v)=>s+v,0)/a.length);
console.log('\n── 평균 ──');
console.log('  가방 닫혀 있을 때 : 옛판 ' + avg(rows.map(r=>r[0].닫힘)).toFixed(1)
          + 'fps · 새판 ' + avg(rows.map(r=>r[1].닫힘)).toFixed(1) + 'fps');
console.log('  가방 열어 둔 동안 : 옛판 ' + avg(rows.map(r=>r[0].열림)).toFixed(1)
          + 'fps · 새판 ' + avg(rows.map(r=>r[1].열림)).toFixed(1) + 'fps');
console.log('  가방 닫고 나면    : 새판 ' + avg(rows.map(r=>r[1].닫은뒤)).toFixed(1) + 'fps');
console.log('  가방 여는 데      : ' + avg(rows.map(r=>r[1].여는데)).toFixed(0) + 'ms');
console.log('  전직 카드 세 장   : ' + avg(rows.map(r=>r[1].전직카드)).toFixed(0) + 'ms');
