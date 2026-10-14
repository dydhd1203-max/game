'use strict';
// WP9: the foundation avatar's painted-image pool under a 30-avatar mixed
// crowd, basic garments only versus mixed garment records (top:tee and
// top:shirt alternating), at the 40 MiB and 24 MiB pool budgets.
// Isolated local studio page (avatar-standard.html), cloud software
// rendering: the times are script times, never school-device FPS.
//   node tools/measure-foundation-crowd.cjs   (preview server on 4173, or QUIZ_PREVIEW_URL)
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/아바타표시성능');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
 const context=await browser.newContext({viewport:{width:1366,height:950}});
 await context.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* demo only */'}));
 await context.route(/firebaseio\.com|firebasedatabase\.app/,r=>r.abort());
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:90000});
 const runs=[];
 for(const mix of ['basic','mixed'])for(const mib of [40,24])runs.push(await p.evaluate(async({mix,mib})=>{
  QPFoundationStudio.setState({action:'idle'});
  const api=QPFoundationStudio.api,w=document.getElementById('runtime').contentWindow,S=w.QPFoundationSkin,host=document.createElement('div');document.body.append(host);
  const tops=mix==='mixed'?['top:tee','top:shirt']:['top:tee'];
  const make=(i)=>{const sex=i%2?'f':'m',d=document.createElement('div');
   d.innerHTML=api.render({sex,sk:i%5,hair:sex==='f'?'bob:1':'short:1',expression:'bright:0',foundationGarments:{top:tops[(i>>1)%tops.length],bottom:'bottom:shorts',shoes:'shoes:sneaker'}},120);
   host.append(d);return d.firstElementChild;};
  // The same mixed roles as verify-foundation-browser's pool contract.
  const roles=['walk','walk','walk','walk','walk','walk','run','run','run','run','run','run','wave','wave','wave','happy','happy','happy','nod','nod','desk','desk','desk','floor','floor','climb','climb','jump','jump','idle'],dirs=['front','back','left','right'];
  const state=(i,k)=>{const role=roles[i],t=k/60,d=dirs[i%4];
   if(role==='walk')return{action:'walk',direction:d,phase:(t/.48+i*.13)%1,time:t};
   if(role==='run')return{action:'run',direction:d,phase:(t/.36+i*.17)%1,time:t};
   if(role==='wave'||role==='happy'||role==='nod')return{action:'idle',direction:'front',gesture:role,gestureProgress:((t+i*.3)/1.6)%1,time:t};
   if(role==='desk')return{action:'sit',direction:'back',time:t};
   if(role==='floor')return{action:'sit',seatMode:'floor',direction:d,time:t};
   if(role==='climb')return{action:'climb',phase:((t*118/17)+i*.2)%1,time:t};
   if(role==='jump'){const s=(k+i*5)%40;return s<4?{action:'jump',direction:d,grounded:true,jumpStage:'takeoff',jumpCompression:s/3,time:t}:s<32?{action:'jump',direction:d,grounded:false,vy:480-(s-4)*34,time:t}:s<36?{action:'jump',direction:d,grounded:true,jumpStage:'landing',jumpCompression:1-(s-32)/4,time:t}:{action:'idle',direction:d,time:t};}
   return{action:'idle',direction:d,time:t};};
  S.paint.budget=mib*1048576;S.emptyPaint();const ev0=S.paint.evicted;
  const misses=()=>S.paintStats().kinds.reduce((s,k)=>s+k.misses,0);
  const crowd=roles.map((r,i)=>make(i));
  // Let garment atlases and records load before timing.
  for(let n=0;n<200&&!crowd.every(svg=>api.ready?api.ready(svg)!==false:true);n++)await new Promise(r=>setTimeout(r,50));
  const templates=crowd.map(svg=>svg.outerHTML.length);
  const frame=(k)=>{const t0=performance.now();crowd.forEach((svg,i)=>api.apply(svg,state(i,k)));return performance.now()-t0;};
  const cold=[];for(let k=0;k<120;k++)cold.push(frame(k));const coldMisses=misses();
  const warm=[];for(let k=120;k<360;k++)warm.push(frame(k));const warmMisses=misses()-coldMisses;
  const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(f*s.length))].toFixed(1);};
  const stats=S.paintStats(),fallback=crowd.filter(svg=>svg.dataset.foundationFallback).map(svg=>svg.dataset.foundationFallback);
  crowd.forEach(svg=>api.destroy(svg));host.remove();
  return{mix,budgetMiB:mib,avatars:30,size:120,
   pool:{mib:+(stats.bytes/1048576).toFixed(2),entries:stats.entries,evicted:stats.evicted-ev0,kinds:stats.kinds.map(k=>({kind:k.kind,entries:k.entries,mib:+(k.bytes/1048576).toFixed(2),misses:k.misses}))},
   coldMisses,warmMisses,warmMissLimit:240,
   frameMs:{cold:{p50:q(cold,.5),p95:q(cold,.95)},warm:{p50:q(warm,.5),p95:q(warm,.95)}},
   templateChars:{min:Math.min(...templates),max:Math.max(...templates)},fallback:[...new Set(fallback)]};
 },{mix,mib}));
 const report={note:'cloud software rendering; script time only, not school-device FPS',when:new Date().toISOString(),runs,errors};
 fs.writeFileSync(path.join(out,'foundation-crowd.json'),JSON.stringify(report,null,2)+'\n');
 for(const r of runs)console.log(`${r.mix.padEnd(5)} ${r.budgetMiB}MiB pool ${r.pool.mib}MiB/${r.pool.entries} evicted ${r.pool.evicted} warm misses ${r.warmMisses}/240 frame warm p50 ${r.frameMs.warm.p50} p95 ${r.frameMs.warm.p95} ms cold p50 ${r.frameMs.cold.p50} template ${r.templateChars.min}-${r.templateChars.max}${r.fallback.length?' fallback '+r.fallback.join(','):''}`);
 if(errors.length)console.log('page errors:',errors);
 await browser.close();
 process.exit(errors.length||runs.some(r=>r.warmMisses>240&&r.budgetMiB===40)?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
