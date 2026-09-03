/* 열릴 때까지 걸리는 시간 — 세 번 재서 가운뎃값 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const R=[];
for(let k=0;k<3;k++){
  const pg = await b.newPage({viewport:{width:1180,height:720}});
  const t0=Date.now();
  await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
  const load=Date.now()-t0;
  await pg.waitForFunction('window.__READY===true', {timeout:60000});
  const ready=Date.now()-t0;
  const m = await pg.evaluate(()=>({
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : 0,
    geo: window.__R.info.memory.geometries, tex: window.__R.info.memory.textures }));
  R.push([load, ready, m.heap, m.geo, m.tex]);
  await pg.close();
}
R.sort((a,c)=>a[1]-c[1]); const m=R[1];
const fs=(await import('fs')).default;
console.log(`파일 ${(fs.statSync(FILE).size/1024).toFixed(0)}KB`
 +`  ·  내려받기+파싱 ${m[0]}ms  ·  세계 다 만들 때까지 ${m[1]}ms`
 +`  ·  메모리 ${m[2]}MB  ·  지오메트리 ${m[3]}개 · 텍스처 ${m[4]}장`);
await b.close(); srv.close();
