// Reproducible Season 1 / original Season 2 / current Season 2 render budgets.
// Run with PW_MODULE and PW_EXECUTABLE_PATH as for tests/browser.mjs.
// This deliberately reports software-renderer work, never laptop FPS/GPU time.
// S2_PERF_BASE_REPORT=/absolute/prior/performance.json reuses its unchanged S1
// and old-S2 rows and runs current only. Separate-run timings are NOT A/B data.
// S2_PERF_PREVIOUS_REF=<commit> also reuses that report's former current rows
// after verifying every measured runtime file against the immutable commit.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.resolve(process.env.S2_PERF_OUTPUT||'/tmp/season2-performance');
const oldRef=process.env.S2_PERF_BASE_REF||'15a1bb3606e3783161459ac86c7ad140fca12ccb';
const rounds=Number(process.env.S2_PERF_ROUNDS||3),frameCount=Number(process.env.S2_PERF_FRAMES||120);
const baselinePath=process.env.S2_PERF_BASE_REPORT?path.resolve(process.env.S2_PERF_BASE_REPORT):null;
const labels=process.env.S2_PERF_VARIANTS?.split(',')||(baselinePath?['current']:['s1','old','current']);
const scenarios=process.env.S2_PERF_SCENARIOS?.split(',')||['village','combat','boss'];
const gitRead=(file,ref=oldRef)=>execFileSync('git',['show',ref+':'+file],{cwd:root,maxBuffer:30e6});
const cache=new Map(),sourceHashes={},errors=[];
const hash=data=>createHash('sha256').update(data).digest('hex');
const viewport={width:1366,height:768};
const baselineBytes=baselinePath?await readFile(baselinePath):null;
const baseline=baselineBytes?JSON.parse(baselineBytes):null;
const previousRef=process.env.S2_PERF_PREVIOUS_REF?execFileSync('git',['rev-parse','--verify',process.env.S2_PERF_PREVIOUS_REF+'^{commit}'],{cwd:root,encoding:'utf8'}).trim():null;
if(previousRef){
 assert.ok(baseline,'S2_PERF_PREVIOUS_REF requires S2_PERF_BASE_REPORT');
 const previousFiles=Object.entries(baseline.sourceHashes).filter(([key])=>key.startsWith('current/'));
 assert.ok(previousFiles.length>0,'Prior report must identify its measured runtime files');
 for(const [key,sha]of previousFiles)assert.equal(sha,hash(gitRead('시즌2/'+key.slice(8),previousRef)),'Previous build matches its measured source: '+key);
}
if(baseline){
 assert.notEqual(path.join(out,'performance.json'),baselinePath,'Preserve the original baseline report');
 assert.equal(baseline.result,'passed','Only reuse a completed baseline');
 assert.equal(baseline.oldRef,oldRef,'Immutable original Season 2 reference must match');
 assert.deepEqual(baseline.viewport,viewport,'Viewport must match');
 assert.equal(baseline.sources.s1.sha256,hash(await readFile(path.join(root,'클로드/index.html'))),'Season 1 source is unchanged');
 assert.equal(baseline.sources.old.sha256,hash(gitRead('시즌2/src/scene.mjs')),'Original Season 2 source is unchanged');
 assert.equal(baseline.sourceHashes['current/vendor/three.module.js'],hash(await readFile(path.join(root,'시즌2/vendor/three.module.js'))),'Shared Three.js runtime is unchanged');
}

// Freeze automatic RAF, not wall-clock measurements. No external services or
// input capture are needed: these are explicitly synthetic, stationary fixtures.
const s1Hook=String.raw`
const originalPerfRender=renderer.render.bind(renderer),originalPerfClear=renderer.clear.bind(renderer);
renderer.info.autoReset=false;
renderer.render=(sc,cam)=>window.__skipGPU?sc.updateMatrixWorld():originalPerfRender(sc,cam);
renderer.clear=(...args)=>window.__skipGPU?undefined:originalPerfClear(...args);
window.__forceFixtureCamera=()=>{
 if(window.__nativeCamera)return;
 camera.fov=54;camera.aspect=1366/768;camera.updateProjectionMatrix();
 camera.position.set(0,GY+2.1+Math.sin(.62)*20,PL.z-2.8+Math.cos(.62)*20);
 camera.lookAt(0,GY+2.1,PL.z-2.8);camera.updateMatrixWorld();
};
window.__PERF={
 prepare(kind){
  window.__nativeCamera=false;
  window.__seedBench(81173);
  if(!G.started){el('iName').value='성능 비교';el('bSolo').click();window.__introDone();}
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  stageT=0;el('stageTitle').classList.remove('on');
  if(miniOn())miniLeave();G.phase='day';G.t=100000;G.day=12;G.paused=false;G.host=false;G.set.cInv=true;
  for(const id of [...STRU.keys()])delStru(id);G.wolves.length=0;G.soldiers.length=0;spawnQ.length=0;
  G.players.clear();pcMap.clear();G.crystal=G.set.crystalMax;
  Object.assign(PL,{down:false,hp:maxHP(),x:0,z:15,y:GY,vy:0,yaw:0,pitch:-.62});
  KEY.w=false;camZoom=20;XP.lv=1;XP.job=0;XP.jt=0;
  for(const k in DBG)if(typeof DBG[k]==='boolean')DBG[k]=false;
  DBG.noSim=true;DBG.noVoice=true;
  for(let i=1;i<21;i++){
   const id='bench'+i,x=(i%7-3)*2,z=PL.z-5-Math.floor(i/7)*2;
   G.players.set(id,{uid:id,x,y:GY,z,tx:x,ty:GY,tz:z,ry:0,g:i%5,n:'대원 '+(i+1),mv:false,hp:100,down:false,ph:i,wp:kind==='village'?0:3,we:0,jb:0,jt:0});
   pcMap.set(id,{g:i%5,wp:kind==='village'?0:3,we:0,jb:0,jt:0,n:'대원 '+(i+1)});
  }
  if(kind!=='village'){
   G.phase='night';
   for(let i=0;i<30;i++){const t=i%2?'ice':'arrow',hp=bs(t,'hp',1);addStru({id:'t'+i,t,x:(i%6-2.5)*4,z:PL.z-14-Math.floor(i/6)*4,g:i%5,lv:1,hp,mx:hp,cd:0,sol:[]});}
   for(let i=0;i<40;i++){spawnWolf(i%6?0:1,i%5);const w=G.wolves.at(-1);Object.assign(w,{x:(i%8-3.5)*2,z:PL.z-16-Math.floor(i/8)*3,y:GY,hp:1e6,mx:1e6,rise:0,addLeft:0,sgLeft:0,siege:false,cs:0,cDone:1});}
   spawnQ.length=0;
  }
  window.__setSky(kind==='village'?0:1);updSky(0,true);rebuildStru();paintHUD();magHudPaint();
  window.__clock=1000;last=1;tAcc=0;loopEnd=0;window.__skipGPU=false;
  return {players:21,towers:STRU.size,enemies:G.wolves.length,boss:false,ground:GY};
 },
 frame(){window.__clock+=1000/60;renderer.info.reset();loop();},
 nativeCamera(){window.__nativeCamera=true;camZoom=CAM_FAR;PL.pitch=-.15;camera.fov=FOV0;camera.updateProjectionMatrix();},
 stats(){const gl=renderer.getContext();gl.finish();const e=gl.getExtension('WEBGL_debug_renderer_info');return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,width:renderer.domElement.width,height:renderer.domElement.height,pixelRatio:renderer.getPixelRatio(),aaSamples:gl.getParameter(gl.SAMPLES),nominalAA:GFX.aa,antialias:gl.getContextAttributes().antialias,shadow:renderer.shadowMap.enabled,bloom:GFX.bloom,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};},
 cpu(n){window.__skipGPU=true;const frames=[];try{for(let i=0;i<n;i++){const start=window.__realNow();this.frame();frames.push(window.__realNow()-start);}}finally{window.__skipGPU=false;}return frames;}
};
`;
const s2Hook=String.raw`
window.__PERF={
 prepare(kind){
  window.__seedBench(81173);
  state=sim.createState();localId='bench0';active=true;manual=true;isHost=true;connected=true;network=null;mode='solo';
  state.phase=kind==='village'?'village':kind==='boss'?'boss':'forest';state.stage=kind==='village'?0:2;state.beacon=kind!=='village';state.events=[];
  const z=kind==='village'?25:kind==='boss'?-103:-59;
  for(let i=0;i<21;i++){sim.addPlayer(state,{id:'bench'+i,name:'대원 '+(i+1),team:i%5,hat:0,face:0,clothes:0});Object.assign(state.players['bench'+i],{x:i?(i%7-3)*2:0,z:i?z-5-Math.floor(i/7)*2:z,yaw:0,hp:100});}
  if(kind!=='village'){
   state.towers=Array.from({length:30},(_,i)=>({id:'t'+i,type:i%2?'ice':'arrow',team:i%5,x:(i%6-2.5)*4,z:z-14-Math.floor(i/6)*4,hp:180,maxHp:180,state:'deployed',carrier:null,progress:0}));
   state.enemies=Array.from({length:40},(_,i)=>({id:'e'+i,kind:i%6?'zombie':'brute',x:(i%8-3.5)*2,z:z-16-Math.floor(i/8)*3,yaw:Math.PI,hp:65,maxHp:65,frost:i%3?0:2}));
  }
  if(kind==='boss')state.boss={id:'boss',x:0,z:-115,yaw:0,hp:900,maxHp:1200,phase:'warn',timer:1.2,dx:0,dz:1};
  window.__clock=1000;last=1000;view.yaw=0;view.pitch=.62;view.distance=20;keys.clear();pointer.attack=false;
  audio.setVolume('bgm',0);audio.setVolume('sfx',0);ui.hideEntry();uiTimer=1;accumulator=0;window.__skipGPU=false;
  return {players:21,towers:state.towers.length,enemies:state.enemies.length,boss:!!state.boss,ground:.08,
    blockedFixturePlayers:Object.values(state.players).filter(p=>!walkable(p.x,p.z,.65)).length,
    placementNote:'Historical stationary comparison grid is preserved exactly; actors can overlap newly placed solid scenery. This is not a real classroom movement or assembly test.'};
 },
 frame(){window.__clock+=1000/60;frame(window.__clock);},
 stats(){const canvas=document.getElementById('game'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');gl.finish();const e=gl.getExtension('WEBGL_debug_renderer_info');return {...scene.stats(),width:canvas.width,height:canvas.height,aaSamples:gl.getParameter(gl.SAMPLES),antialias:gl.getContextAttributes().antialias,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};},
 cpu(n){window.__skipGPU=true;const frames=[];try{for(let i=0;i<n;i++){const start=window.__realNow();this.frame();frames.push(window.__realNow()-start);}}finally{window.__skipGPU=false;}return frames;},
 cull(){for(const p of Object.values(state.players))if(p.id!==localId)p.z+=1000;for(const t of state.towers)t.z+=1000;for(const e of state.enemies)e.z+=1000;if(state.boss)state.boss.z+=1000;}
};
`;
const s2RenderHook=`
  const originalPerfRender=renderer.render.bind(renderer);
  renderer.render=(sc,cam)=>window.__skipGPU?sc.updateMatrixWorld():originalPerfRender(sc,cam);
`;

async function content(variant,file){
 const key=variant+'/'+file;if(cache.has(key))return cache.get(key);
 let value=variant==='old'?gitRead('시즌2/'+file):await readFile(path.join(root,variant==='s1'?'클로드':'시즌2',file));
 sourceHashes[key]=hash(value);
 if(variant==='s1'&&file==='index.html'){
  let html=value.toString().replace('https://unpkg.com/three@0.160.0/build/three.module.js','/current/vendor/three.module.js').replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"']+/g,'/fb.js');
  assert.ok(html.includes('onIcons(()=>{ window.__READY = true; });'));
  html=html.replace('onIcons(()=>{ window.__READY = true; });',s1Hook+'\nonIcons(()=>{ window.__READY = true; });');
  assert.ok(html.includes('    fovTick(dt);'));
  html=html.replace('    fovTick(dt);','    fovTick(dt);if(window.__forceFixtureCamera)window.__forceFixtureCamera();');
  value=Buffer.from(html);
 }else if(file==='src/app.mjs')value=Buffer.from(value.toString()+'\n'+s2Hook);
 else if(file==='src/scene.mjs'){
  const text=value.toString(),needle='  const gl=renderer.getContext()';assert.ok(text.includes(needle),'scene renderer instrumentation anchor');
  value=Buffer.from(text.replace(needle,s2RenderHook+needle));
 }
 cache.set(key,value);return value;
}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');if(url.pathname==='/fb.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end('');return;}
  const parts=decodeURIComponent(url.pathname).split('/').filter(Boolean),variant=parts.shift(),file=parts.join('/')||'index.html';
  if(!['s1','old','current'].includes(variant)||file.includes('..'))throw Error('Invalid path');
  const data=await content(variant,file),ext=path.extname(file);
  res.writeHead(200,{'Content-Type':ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end(data);
 }catch(error){res.writeHead(404).end(String(error));}
});
const report={note:'Synthetic fixtures; software WebGL. CPU samples omit WebGL submission and simulation/network, retain actual app/animation/HUD/world-matrix work. No hardware FPS or GPU improvement claim.',comparison:'Same 1366×768 viewport, DPR1, .85 drawing scale, native antialiasing, 54-degree camera, 20-unit distance, .62 pitch, same actor/tower/enemy counts and relative layout. Different worlds/materials and local game ground heights; not pixel-identical scenes. S1 has no matching expedition boss, so its boss row is omitted. S1 calls/triangles include its extra vignette/composite passes: info.autoReset=false, reset once before each complete frame.',oldRef,viewport,rounds,frameCount,sources:{},sourceHashes,scenarios:{},errors};
report.measuredAt=new Date().toISOString();
if(baseline){
 assert.equal(baseline.comparison,report.comparison,'Fixture camera and comparison scope must match');
 report.baseline={path:baselinePath,sha256:hash(baselineBytes),timingComparable:false,note:'S1 and original S2 rows were measured in the earlier report, not interleaved with this run. Compare deterministic submission/resource counts only; timing changes cannot be attributed to the artwork.'};
 for(const variant of ['s1','old'])if(!labels.includes(variant))report.sources[variant]=structuredClone(baseline.sources[variant]);
 for(const [key,value]of Object.entries(baseline.sourceHashes))if(key.startsWith('s1/')||key.startsWith('old/'))sourceHashes[key]=value;
 if(previousRef){
  report.previousBaseline={ref:previousRef,reportSha256:hash(baselineBytes),timingComparable:false,note:'The previous artwork rows are imported from the prior report after matching every runtime source hash. They were not measured concurrently with this run.'};
  report.sources.previous={...structuredClone(baseline.sources.current),ref:previousRef};
  for(const [key,value]of Object.entries(baseline.sourceHashes))if(key.startsWith('current/'))sourceHashes['previous/'+key.slice(8)]=value;
 }
}
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
let browser;
try{
 await mkdir(out,{recursive:true});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const pages=new Map();
 for(const variant of labels){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});pages.set(variant,page);page.on('pageerror',e=>errors.push(variant+': '+e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{window.__clock=1000;window.__realNow=performance.now.bind(performance);performance.now=()=>window.__clock;requestAnimationFrame=()=>0;localStorage.setItem('sndOn','0');let seed=81173;window.__seedBench=value=>{seed=value;};Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
  await page.goto(`http://127.0.0.1:${server.address().port}/${variant}/?gfx=mid&test=1`,{waitUntil:'load',timeout:180000});
  await page.waitForFunction(v=>!!window.__PERF&&(v!=='s1'||window.__READY),variant,{timeout:180000,polling:100});
  report.sources[variant]={sha256:hash(await (variant==='s1'?readFile(path.join(root,'클로드/index.html')):variant==='old'?Promise.resolve(gitRead('시즌2/src/scene.mjs')):readFile(path.join(root,'시즌2/src/scene.mjs'))))};
  console.log('Loaded '+variant);
 }
 for(const scenario of scenarios){
  const variants=labels.filter(v=>scenario!=='boss'||v!=='s1'),results={};report.scenarios[scenario]=results;
  if(baseline)for(const variant of ['s1','old'])if(!variants.includes(variant)&&baseline.scenarios[scenario]?.[variant]){
   results[variant]={...structuredClone(baseline.scenarios[scenario][variant]),measurementOrigin:'imported earlier run; timings are not comparable to the current run'};
  }
  if(previousRef){
   assert.ok(baseline.scenarios[scenario]?.current,'Previous artwork baseline covers '+scenario);
   results.previous={...structuredClone(baseline.scenarios[scenario].current),measurementOrigin:'imported previous artwork '+previousRef+'; timings are not comparable to the current run'};
  }
  for(const variant of variants){
   const page=pages.get(variant),setup=await page.evaluate(k=>__PERF.prepare(k),scenario);
   // Warm shaders/resources before recording. Readbacks wait for completed GL.
   for(let i=0;i<4;i++)await page.evaluate(()=>{__PERF.frame();__PERF.stats();});
   const stats=await page.evaluate(()=>__PERF.stats());
   assert.ok(stats.calls>0&&stats.triangles>0,'Nonempty rendered scene');
   assert.equal(stats.pixelRatio,.85);assert.equal(stats.width,Math.floor(viewport.width*.85));assert.equal(stats.height,Math.floor(viewport.height*.85));
   await page.screenshot({path:path.join(out,`${scenario}-${variant}.png`)});
   await page.evaluate(()=>__PERF.cpu(90));
   results[variant]={setup,stats,cpuRounds:[],submissionRounds:[],measurementOrigin:'measured in this run'};console.log(scenario+' '+variant+' '+JSON.stringify(stats));
   if(baseline&&variant==='current')for(const reference of ['s1','old','previous'])if(results[reference]){
    for(const key of ['width','height','pixelRatio','aaSamples','antialias'])assert.equal(stats[key],results[reference].stats[key],reference+' baseline graphics match: '+key);
    for(const key of ['players','towers','enemies'])assert.equal(setup[key],results[reference].setup[key],reference+' baseline fixture matches: '+key);
   }
  }
  if(variants.length>1)for(const v of variants.slice(1))assert.equal(results[v].stats.aaSamples,results[variants[0]].stats.aaSamples,'Actual MSAA must match');
  for(let round=0;round<rounds;round++)for(const variant of round%2?[...variants].reverse():variants){
   results[variant].cpuRounds.push(await pages.get(variant).evaluate(n=>__PERF.cpu(n),frameCount));
  }
  // Real WebGL submissions are measured separately. SwiftShader queue/backpressure
  // can dominate these wall-clock times: they are NOT JavaScript CPU or device FPS.
  for(let round=0;round<rounds;round++)for(const variant of round%2?[...variants].reverse():variants){
   results[variant].submissionRounds.push(await pages.get(variant).evaluate(()=>{
    window.__skipGPU=false;__PERF.stats();const frames=[];
    for(let i=0;i<10;i++){const start=window.__realNow();__PERF.frame();frames.push(window.__realNow()-start);}
    __PERF.stats();return frames;
   }));
  }
  for(const variant of variants){
   const page=pages.get(variant),result=results[variant],frames=result.cpuRounds.flat();
   result.cpuUpdateMs={median:percentile(frames,.5),p95:percentile(frames,.95),mean:frames.reduce((a,b)=>a+b,0)/frames.length,roundMeans:result.cpuRounds.map(a=>a.reduce((x,y)=>x+y,0)/a.length)};
   const submissions=result.submissionRounds.flat();result.softwareRenderSubmissionMs={median:percentile(submissions,.5),p95:percentile(submissions,.95),mean:submissions.reduce((a,b)=>a+b,0)/submissions.length,note:'Actual WebGL submission plus software-driver queue waits; no GPU timing, no real-device FPS.'};
   await page.evaluate(()=>{__PERF.frame();__PERF.stats();});result.after=await page.evaluate(()=>__PERF.stats());
   result.resourceDelta={geometries:result.after.geometries-result.stats.geometries,textures:result.after.textures-result.stats.textures};
   // The unmodified Season 1 world can lazily realize an ambient-effect asset
   // after the short warmup. Observe that baseline rather than treating it as
   // a regression in this change; both Season 2 variants must remain constant.
   if(variant!=='s1'){
    assert.equal(result.after.geometries,result.stats.geometries,variant+' geometry count remains bounded');assert.equal(result.after.textures,result.stats.textures,variant+' texture count remains bounded');
   }
   console.log(scenario+' '+variant+' CPU update '+JSON.stringify(result.cpuUpdateMs));
   if(variant==='s1'){
    await page.evaluate(()=>__PERF.nativeCamera());
    for(let i=0;i<4;i++)await page.evaluate(()=>{__PERF.frame();__PERF.stats();});
    result.nativeCameraStats=await page.evaluate(()=>__PERF.stats());
    result.nativeCameraNote='Supplementary actual Season 1 camera: default CAM_FAR=3.2, FOV70, pitch -.15. Same synthetic actors; unlike matched-camera rows this has a different viewing footprint.';
    await page.screenshot({path:path.join(out,`${scenario}-s1-native-camera.png`)});
    console.log(scenario+' s1 native camera '+JSON.stringify(result.nativeCameraStats));
   }
   if(variant!=='s1'&&scenario==='combat'){
    await page.evaluate(()=>{__PERF.cull();__PERF.frame();});result.actorsOutsideFrustum=await page.evaluate(()=>__PERF.stats());
    assert.ok(result.actorsOutsideFrustum.triangles<result.after.triangles,'Offscreen actors must reduce submitted geometry');
   }
  }
  if(results.s1&&results.current){
   const original=results.s1.stats,current=results.current.stats;
   results.budgetVsSeason1={matchedCamera:{callsRatio:current.calls/original.calls,trianglesRatio:current.triangles/original.triangles,withinBoth:current.calls<=original.calls&&current.triangles<=original.triangles},note:'Submitted-work comparison of controlled synthetic scenes only. No real laptop performance guarantee.'};
   assert.ok(results.budgetVsSeason1.matchedCamera.withinBoth,'Current S2 must fit both Season 1 draw-call and triangle budgets');
  }
  if(results.previous&&results.current){
   const previous=results.previous.stats,current=results.current.stats;
   results.changeVsPreviousArtwork={calls:current.calls-previous.calls,triangles:current.triangles-previous.triangles,callsRatio:current.calls/previous.calls,trianglesRatio:current.triangles/previous.triangles,note:'Deterministic submitted-work counts at the same fixture/camera. Separate-run timings are not an A/B performance comparison.'};
  }
  await writeFile(path.join(out,'performance.json'),JSON.stringify(report,null,2)+'\n');
 }
 assert.deepEqual(errors,[]);report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir(out,{recursive:true});await writeFile(path.join(out,'performance.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+out+'/performance.json');}
