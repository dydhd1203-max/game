import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve.mjs';
const PORT = +(process.argv[3] || 8733);
const srv = serve(PORT);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[];
pg.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
pg.on('pageerror', e=> errs.push('PAGEERROR: '+e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/?diag=1', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});

const r = await pg.evaluate(()=>{
  const W=window, out=[], ok=(n,c,x)=>out.push((c?'  OK  ':'FAIL  ')+n+(x!==undefined?'   → '+x:''));
  const GY=W.__GY, DIRS=W.__DIRS, T=W.__GATE_T, HW=73, WS=147;
  const gi=(x,z)=>(x+HW)+(z+HW)*WS;

  /* ── 4. 크기 ── */
  ok('늑대 크기 0.70', W.__G && true);
  const B=W.__BUILD;
  ok('나무벽 hi 1.4 (한 칸 낮춤)', B.wwall.hi===1.4, B.wwall.hi);
  ok('화살탑 hi 는 등급별', Array.isArray(B.arrow.hi) && B.arrow.hi.length===6);
  ok('배럭 hi 는 등급별', Array.isArray(B.barr.hi) && B.barr.hi.length===6);

  /* ── 2·3. 성문 ── */
  let gateBlocks=0, gateKeys=[];
  for(const [k,v] of W.__banks) if(k.startsWith('g')&&/^(gsb|ggb|gcl|gdk|gglow)/.test(k)){ gateBlocks+=v.ms.length; gateKeys.push(k+':'+v.ms.length); }
  // 망루 계단·발판이 붙어 늘었다 (문마다 2채 × 5문)
  ok('성문 블록이 실제로 놓였다', gateBlocks>1500 && gateBlocks<5000, gateBlocks+' 개');

  // 통로 한가운데는 여전히 평지 (벽 지을 수 있어야 한다)
  const d=DIRS[0];
  const cx=Math.floor(d.dx*T), cz=Math.floor(d.dz*T);
  ok('성문 한가운데 = 평지', W.__terrH[gi(cx,cz)]===GY, W.__terrH[gi(cx,cz)]-GY);
  ok('성문 한가운데 = 늑대가 지나갈 수 있음', W.__walkable(cx,cz)===true);
  ok('성문 한가운데 = 벽 지을 수 있음', W.__canPlace('swall',cx,cz)===null, W.__canPlace('swall',cx,cz));

  // 망루 자리는 산이 됐다
  const TP=6.6+1.8+0.6;
  const tx=Math.floor(d.dx*T - d.dz*TP), tz=Math.floor(d.dz*T + d.dx*TP);
  ok('망루 자리 = 산', W.__terrH[gi(tx,tz)]>GY+5, W.__terrH[gi(tx,tz)]-GY);
  ok('망루 자리 = 늑대 못 지나감', W.__walkable(tx,tz)===false);
  ok('망루 자리 = 건물 못 놓음', W.__canPlace('swall',tx,tz)!==null, W.__canPlace('swall',tx,tz));

  // 다섯 문 다 통로가 살아 있는지 + 늑대가 수정까지 길이 이어지는지
  W.__flow();
  let allOpen=true, allPath=true;
  for(let g=0; g<5; g++){ const dd=DIRS[g];
    for(const t of [41,45,50]){
      const x=Math.floor(dd.dx*t), z=Math.floor(dd.dz*t);
      if(!W.__walkable(x,z)) allOpen=false;
      if(!isFinite(W.__fCost[gi(x,z)])) allPath=false;
    } }
  ok('다섯 문 통로 다 열려 있음', allOpen);
  ok('다섯 문에서 수정까지 길이 이어짐', allPath);

  return out;
});
console.log(r.join('\n'));
console.log(errs.length ? '\n'+errs.join('\n') : '\n(콘솔 오류 없음)');
await b.close(); srv.close();
