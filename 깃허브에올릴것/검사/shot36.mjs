/* 23차 화면 확인 — 총기 반동 · 🎒 가방 · ✨ 전직 카드 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19600), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(1800);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ── 🎒 가방 — 살 수 있는 것을 다 가진 상태로 ── */
await pg.evaluate(()=>{
  const W=window, K=W.__KIT;
  for(let i=0;i<W.__WEAPONS.length;i++) if(!W.__WEAPONS[i].mini) K.ownW[i]=true;
  for(let i=0;i<W.__ARMORS.length;i++) K.ownA[i]=true;
  for(let i=0;i<W.__POTIONS.length;i++) K.pot[i]=3;
  K.ammo=48; K.wpn=3; K.arm=2;
  W.__G.me.hat=2; W.__G.me.gls=3; W.__G.me.clo=1; W.__G.me.pet=1;
  W.__openKit();
});
await pg.waitForTimeout(900);
await pg.screenshot({path:OUT+'/23-bag.png'}); console.log('찍음 23-bag');
console.log('  가진 것 ' + await pg.evaluate(()=>document.getElementById('kitCount').textContent)
  + ' · 칸 ' + await pg.evaluate(()=>document.querySelectorAll('#kitGrid .kCell').length)
  + ' · 입은 자리 ' + await pg.evaluate(()=>document.querySelectorAll('.kSlot').length));

/* 좁은 화면에서도 — 교실 크롬북과 태블릿 세로 */
for(const [w,h,nm] of [[1366,768,'1366x768'],[1024,600,'1024x600'],[820,1180,'tablet']]){
  await pg.setViewportSize({width:w, height:h});
  await pg.waitForTimeout(450);
  const over = await pg.evaluate(()=>{ const c=document.querySelector('#popKit .popC');
    return {넘침:c.scrollHeight-c.clientHeight, 가로:document.documentElement.scrollWidth-window.innerWidth}; });
  await pg.screenshot({path:OUT+'/23-bag-'+nm+'.png'});
  console.log('  '+nm+' — 세로 넘침 '+over.넘침+'px · 가로 넘침 '+over.가로+'px');
}
await pg.setViewportSize({width:1100, height:760}); await pg.waitForTimeout(400);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* ── ✨ 전직 카드 (1차) ── */
await pg.evaluate(()=>{ const W=window; W.__XP.lv = W.__JOB_LV[0]; W.__buildJobUI();
                        document.getElementById('popJob').classList.add('on'); });
await pg.waitForTimeout(700);
console.log('전직 카드 ' + await pg.evaluate(()=>document.querySelectorAll('.jobCard').length)
  + '장 · 그림 ' + await pg.evaluate(()=>document.querySelectorAll('.jobCard img').length) + '장'
  + ' · 그림 크기 ' + await pg.evaluate(()=>{
      const i=document.querySelector('.jobCard img'); return i ? (i.src.length/1024|0)+'KB' : '없음'; }));
await pg.screenshot({path:OUT+'/23-job.png'}); console.log('찍음 23-job');

/* ── 2차 전직 (고른 길 하나만) ── */
await pg.evaluate(()=>{ const W=window; W.__XP.job = 0; W.__XP.jt = 1;
                        W.__XP.lv = W.__JOB_LV[1]; W.__buildJobUI(); });
await pg.waitForTimeout(600);
await pg.screenshot({path:OUT+'/23-job2.png'});
console.log('찍음 23-job2 — 카드 ' + await pg.evaluate(()=>document.querySelectorAll('.jobCard').length) + '장');

/* 좁은 화면 */
for(const [w,h,nm] of [[1024,600,'1024x600'],[820,1180,'tablet']]){
  await pg.setViewportSize({width:w, height:h}); await pg.waitForTimeout(450);
  const over = await pg.evaluate(()=>{ const c=document.querySelector('#popJob .popC');
    return c.scrollHeight - c.clientHeight; });
  await pg.screenshot({path:OUT+'/23-job-'+nm+'.png'});
  console.log('  전직 '+nm+' — 세로 넘침 '+over+'px');
}
/* ── 📊 스탯 창 — 기본 넷 + 거기서 나오는 능력치 ── */
await pg.setViewportSize({width:1100, height:760}); await pg.waitForTimeout(300);
await pg.evaluate(()=>{
  const W=window;
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  W.__xpReset(); W.__xpGain(999999);            // 점수를 넉넉히
  const S = W.__ST();
  for(let i=0;i<7;i++) W.__takeStat(S.agi);
  for(let i=0;i<5;i++) W.__takeStat(S.str);
  for(let i=0;i<3;i++) W.__takeStat(S.vit);
  for(let i=0;i<2;i++) W.__takeStat(S.int);
  W.__openStat();
});
await pg.waitForTimeout(500);
await pg.screenshot({path:OUT+'/23-stat.png'}); console.log('찍음 23-stat');
console.log('  기본 스탯 ' + await pg.evaluate(()=>document.querySelectorAll('#stList > div').length)
  + '개 · 나오는 능력치 ' + await pg.evaluate(()=>document.querySelectorAll('#stDeriv .dRow').length) + '줄');
for(const [w,h,nm] of [[1024,600,'1024x600'],[820,1180,'tablet']]){
  await pg.setViewportSize({width:w, height:h}); await pg.waitForTimeout(400);
  const over = await pg.evaluate(()=>{ const c=document.querySelector('#popStat .popC');
    return c.scrollHeight - c.clientHeight; });
  await pg.screenshot({path:OUT+'/23-stat-'+nm+'.png'});
  console.log('  스탯 '+nm+' — 세로 넘침 '+over+'px (넘치면 스크롤은 된다)');
}
console.log(errs.length?('오류: '+errs.slice(0,5).join(' | ')):'(오류 없음)');
await b.close(); srv.close();
