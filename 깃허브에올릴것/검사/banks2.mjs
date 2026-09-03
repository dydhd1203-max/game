import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:900,height:600}});
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(900);
console.log(await pg.evaluate(()=>{
  const rows=[];
  for(const [k,bk] of window.__banks) rows.push([k, bk.ms.length, bk.chunks.length]);
  rows.sort((a,b)=> b[2]-a[2] || b[1]-a[1]);
  return rows.filter(r=>r[2]>1).map(r=> r[0].padEnd(26)+' 블록 '+String(r[1]).padStart(5)+' → 청크 '+r[2]).join('\n')
    + '\n합계 청크 ' + rows.reduce((s,r)=>s+r[2],0);
}));
await b.close(); srv.close();
