// Reproducible browser CPU comparison. Synthetic clients, no production network,
// no GPU/FPS claim. Game time is fixed; stopwatch/profile clocks remain real.
// node t104-runtime-performance.mjs before.html [after.html]
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const before=process.argv[2];assert.ok(before,'Supply the baseline HTML');
const after=(process.argv[3]&&!process.argv[3].startsWith('--')?process.argv[3]:GAME),profile=process.argv.includes('--profile'),visual=process.argv.includes('--visual-only'),out='artifacts/performance104';fs.mkdirSync(out,{recursive:true});
const sources=[before,after].map(p=>({file:path.resolve(p),sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
const hook=String.raw`
window.__bench104={
 prepare(mode){
  window.__seed104(104104);window.__time104=1000;last=1;tAcc=0;
  if(!G.started){el('iName').value='성능 비교';el('bSolo').click();window.__introDone();}
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  if(miniOn())miniLeave();G.phase='day';G.t=100000;G.day=12;G.paused=false;G.host=true;G.set.cInv=true;
  for(const id of [...STRU.keys()])delStru(id);G.wolves.length=0;G.soldiers.length=0;spawnQ.length=0;
  G.players.clear();pcMap.clear();G.crystal=G.set.crystalMax;PL.down=false;PL.hp=maxHP();PL.x=0;PL.z=15;PL.y=GY;PL.vy=0;PL.yaw=0;PL.pitch=-.15;
  KEY.w=false;camZoom=3.2;XP.lv=35;XP.job=0;XP.jt=2;
  for(const k in DBG)if(typeof DBG[k]==='boolean')DBG[k]=false;
  DBG.noRender=true;DBG.noVoice=true;
  if(mode!=='solo')for(let i=0;i<20;i++){
   const id='bench'+i,x=(i%5-2)*2,z=10-Math.floor(i/5)*2;
   G.players.set(id,{uid:id,x,y:GY,z,tx:x,ty:GY,tz:z,ry:i*.3,g:i%5,n:'친구'+i,mv:true,hp:100,down:false,ph:i,wp:3,we:6,jb:i%3,jt:2});
   pcMap.set(id,{g:i%5,wp:3,we:6,jb:i%3,jt:2,n:'친구'+i});
  }
  if(mode==='night'){
   G.phase='night';window.__setSky(1);updSky(0,true);
   for(let i=0;i<15;i++){
    const x=(i%5-2)*7,z=Math.floor(i/5)*8-8,id='b'+i,hp=bs('barr','hp',7);
    const home={id,t:'barr',x,z,g:i%5,lv:7,hp,mx:hp,cd:1e6,sol:[]};addStru(home);
    for(let j=0;j<5;j++){const k=SOL_COMP[6][j%SOL_COMP[6].length],sid=100000+i*5+j,D=SOL_DEF[k];
     G.soldiers.push({id:sid,bid:id,k,x:x+.5+(j-2)*.5,z:z+2.6,y:GY,ry:0,hp:1e6,mx:1e6,atkT:0,hurt:0,mv:false,ph:j,dmg:solDmg(k,7),g:i%5,lv:7});home.sol.push(sid);}
   }
   for(let i=0;i<20;i++){const t=['arrow','ice','pulse'][i%3],hp=bs(t,'hp',3);addStru({id:'t'+i,t,x:(i%5-2)*7+3,z:Math.floor(i/5)*7-9,g:i%5,lv:3,hp,mx:hp,cd:0,sol:[]});}
   for(let i=0;i<92;i++){const a=i*Math.PI*2/92,r=20+(i%4)*2;spawnWolf(i%8,i%5);const w=G.wolves.at(-1);
    Object.assign(w,{x:Math.cos(a)*r,z:Math.sin(a)*r,y:GY,hp:1e6,mx:1e6,rise:0,addLeft:0,sgLeft:0,siege:false,cs:0,cDone:1});}
   spawnQ.length=0;flowDirty=true;
  }else if(mode==='race'){
   G.phase='mini';G.mini={k:0,seed:104104,st:'go',t:100000,pl:{}};miniEnter();
   G.mini.st='go';RACE.t=2;PL.x=0;PL.z=7;PL.y=MINI_Y+.5;PL.yaw=Math.PI;PL.pitch=-.12;
   for(const [id,p]of G.players){p.x=(+id.slice(5)%5-2)*2;p.z=7-Math.floor(+id.slice(5)/5)*2;p.y=MINI_Y;p.tx=p.x;p.ty=p.y;p.tz=p.z;}
  }else{window.__setSky(0);updSky(0,true);}
  window.__seed104(104104);window.__time104=1000;last=1;tAcc=0;loopEnd=0;
  for(const k of Object.keys(PROF))delete PROF[k];rebuildStru();paintHUD();magHudPaint();
  return {mode,players:G.players.size+1,wolves:G.wolves.length,soldiers:G.soldiers.length,graphics:{...GFX,width:renderer.domElement.width,height:renderer.domElement.height}};
 },
 run(n){const frames=[];for(let i=0;i<n;i++){window.__time104+=1000/60;const start=window.__realNow();loop();frames.push(window.__realNow()-start);}return {frames,profile:{...PROF},wolves:G.wolves.length,soldiers:G.soldiers.length};},
 kernel(kind,n){
  const v={};for(let i=0;i<NODES.length;i++)if(NODES[i].alive)v[i]=5;
  const frames=[];let sum=0;for(let i=0;i<n;i++){
   const start=window.__realNow();
   if(kind==='flow')buildFlow();
   else if(kind==='resource')for(let j=0;j<200;j++)window.__node104({val:()=>v});
   else if(kind==='host'){window.__time104+=1000/60;hostSim(1/60);}
   else for(let j=0;j<1000;j++)sum+=groundUnder((j%97)-48.3,(j%89)-44.7,.28,GY);
   frames.push(window.__realNow()-start);
  }
  let hash=2166136261;for(const a of [fCost,fNext])for(const b of new Uint8Array(a.buffer)){hash=Math.imul(hash^b,16777619)>>>0;}
  return {frames,hash,sum,cells:[...nodeCells].join(';')};
 },
 snapshot(){return JSON.stringify({phase:G.phase,crystal:G.crystal,player:[PL.x,PL.y,PL.z,PL.hp],sim:packSim()});},
 draw(){drawFrame();const gl=renderer.getContext();gl.finish();const e=gl.getExtension('WEBGL_debug_renderer_info');return {png:renderer.domElement.toDataURL(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};}
};
`;
const files=[before,after].map((file,i)=>{
 let s=fs.readFileSync(file,'utf8');
 // The four profiling clocks only: do not perturb game simulation time.
 s=s.replace(/const (?:pS|pE|qS|qE) =[^\n]+/g,line=>line.replaceAll('performance.now()','window.__realNow()'));
 s=s.replace('const _sp0 = PROF_ON ? performance.now() : 0;','const _sp0 = PROF_ON ? window.__realNow() : 0;')
  .replace('sepAcc += performance.now() - _sp0','sepAcc += window.__realNow() - _sp0');
 const marker='onIcons(()=>{ window.__READY = true; });';assert.ok(s.includes(marker));
 const ns=s.indexOf("net.child('nd').on('value', s=>{"),ne=s.indexOf('  bindBuildNetwork();',ns);assert.ok(ns>=0&&ne>ns);
 const callback=s.slice(ns,ne).trim().replace("net.child('nd').on('value', s=>{",'window.__node104=s=>{').replace(/\);$/,';');
 const dest=path.resolve(out,'instrumented-'+i+'.html');fs.writeFileSync(dest,s.replace(marker,callback+'\n'+hook+'\n'+marker));return dest;
});
const servers=files.map((f,i)=>serve(20704+i,f));let browser;const errors=[],report={note:'Browser JavaScript CPU only; 21 synthetic players, fixed game time, unchanged quality. No actual 21-device network or hardware FPS.',sources,profile,scenarios:{}};
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],pct=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))];
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const pages=[];
 for(let i=0;i<2;i++){
  const p=await browser.newPage({viewport:{width:1280,height:800}});pages.push(p);p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR: '+e.message);});
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.addInitScript(()=>{window.__realNow=performance.now.bind(performance);window.__time104=1000;performance.now=()=>window.__time104;
   requestAnimationFrame=()=>0;localStorage.setItem('sndOn','0');let seed=104104;window.__seed104=n=>{seed=n;};Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await p.goto('http://127.0.0.1:'+(20704+i)+'/?gfx=mid'+(profile?'&diag=1':''),{timeout:240000,waitUntil:'load'});
  await p.waitForFunction(()=>window.__READY===true,null,{timeout:240000,polling:100});console.log('Loaded '+(i?'after':'before'));
 }
 report.kernels={};
 for(const kind of visual?[]:['flow','resource','ground','host']){
  for(const p of pages){await p.evaluate(()=>__bench104.prepare('night'));await p.evaluate(k=>__bench104.kernel(k,20),kind);}
  const runs=[[],[]];
  for(let r=0;r<7;r++)for(const i of r%2?[1,0]:[0,1])runs[i].push(await pages[i].evaluate(k=>__bench104.kernel(k,30),kind));
  const sums=runs.map(a=>{const frames=a.flatMap(q=>q.frames);return {medianMs:median(frames),p95Ms:pct(frames,.95),roundMeans:a.map(q=>q.frames.reduce((s,x)=>s+x,0)/q.frames.length)};});
  assert.equal(runs[0].at(-1).hash,runs[1].at(-1).hash,kind+' navigation hash');
  assert.equal(runs[0].at(-1).sum,runs[1].at(-1).sum,kind+' ground sum');
  assert.equal(runs[0].at(-1).cells,runs[1].at(-1).cells,kind+' node occupancy');
  report.kernels[kind]={before:sums[0],after:sums[1],changePercent:(sums[1].medianMs/sums[0].medianMs-1)*100};
  console.log('kernel '+kind+': '+JSON.stringify(report.kernels[kind]));
 }
 for(const mode of ['solo','day','night','race']){
  const setup=[];for(const p of pages)setup.push(await p.evaluate(m=>__bench104.prepare(m),mode));assert.deepEqual(setup[1],setup[0]);
  if(visual){
   const pictures=[];for(let i=0;i<2;i++){await pages[i].evaluate(()=>__bench104.run(180));const d=await pages[i].evaluate(()=>__bench104.draw());
    const bytes=Buffer.from(d.png.split(',')[1],'base64');fs.writeFileSync(out+'/'+mode+'-'+(i?'after':'before')+'.png',bytes);delete d.png;
    pictures.push({...d,sha256:createHash('sha256').update(bytes).digest('hex')});}
   report.scenarios[mode]={setup:setup[0],pictures};fs.writeFileSync(out+'/visual-comparison.json',JSON.stringify(report,null,2));
   console.log('visual '+mode+': '+JSON.stringify(pictures));assert.deepEqual(pictures[1],pictures[0],mode+' game canvas and rendering budget');continue;
  }
  for(const p of pages)await p.evaluate(()=>__bench104.run(720));
  const runs=[[],[]];
  for(let round=0;round<7;round++)for(const i of round%2?[1,0]:[0,1])runs[i].push(await pages[i].evaluate(()=>__bench104.run(180)));
  const sums=runs.map(a=>{const frames=a.flatMap(q=>q.frames);return {medianMs:median(frames),p95Ms:pct(frames,.95),roundMeans:a.map(q=>q.frames.reduce((s,x)=>s+x,0)/q.frames.length),profile:a.at(-1).profile,wolves:a.at(-1).wolves,soldiers:a.at(-1).soldiers};});
  const snaps=[];for(const p of pages)snaps.push(await p.evaluate(()=>__bench104.snapshot()));
  const same=snaps[0]===snaps[1];if(!same){fs.writeFileSync(out+'/'+mode+'-before-state.json',snaps[0]);fs.writeFileSync(out+'/'+mode+'-after-state.json',snaps[1]);}
  report.scenarios[mode]={setup:setup[0],before:sums[0],after:sums[1],sameState:same,medianChangePercent:(sums[1].medianMs/sums[0].medianMs-1)*100};
  fs.writeFileSync(out+'/runtime-comparison.json',JSON.stringify(report,null,2));console.log(mode+': '+JSON.stringify(report.scenarios[mode]));
  assert.ok(same,mode+' gameplay state matches after the same 1,980 frames');
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(out+'/'+(visual?'visual':'runtime')+'-comparison.json',JSON.stringify(report,null,2));
}finally{await browser?.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));}
