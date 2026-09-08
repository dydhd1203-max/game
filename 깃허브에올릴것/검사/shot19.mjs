/* 17차b 화면 확인 — 오늘의 으뜸 판이 갈래마다 어떻게 보이나 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19900), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1366,height:768}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2500);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));
await pg.evaluate(()=>{
  const W=window;
  for(const p of [
    {u:'a', n:'가영', g:0, lv:30, mined:210, built:12, fixed:3,  helped:1, hits:52},
    {u:'b', n:'나온', g:1, lv:22, mined:340, built:7,  fixed:1,  helped:0, hits:14},
    {u:'c', n:'다현', g:2, lv:24, mined:120, built:31, fixed:6,  helped:4, hits:8},
    {u:'d', n:'라온', g:3, lv:19, mined:95,  built:9,  fixed:22, helped:11,hits:3},
    {u:'e', n:'마루', g:4, lv:26, mined:150, built:15, fixed:9,  helped:2, hits:33}
  ]) W.__pcMap.set(p.u, p);
  const my = W.__myPC(); my.n='김하늘'; my.lv=21; my.mined=180; my.built=10;
  my.fixed=14; my.helped=6; my.hits=20;
});
/* 갈래가 도는 대로 찍는다 — 게임에 손을 대지 않고 실제로 도는 걸 본다 */
const seen = new Set();
for(let i=0; i<9 && seen.size<6; i++){
  const head = await pg.evaluate(()=>document.getElementById('rankHead').textContent);
  if(!seen.has(head)){
    seen.add(head);
    const el = await pg.$('#rankWrap');
    await el.screenshot({path:OUT+'/rank-'+seen.size+'-'+head.replace(/[^가-힣]/g,'')+'.png'});
    console.log('찍음', head);
  }
  await pg.waitForTimeout(1600);
}
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
