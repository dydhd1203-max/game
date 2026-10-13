// Hidden-browser A/B evidence for structure batching. No classroom FPS claim.
// PW_MODULE=... PW_EXECUTABLE_PATH=... node t106-structure-view.mjs before.html [after.html]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';

const before=process.argv[2],after=process.argv[3]||GAME;
assert.ok(before,'Supply the unmodified baseline HTML');
const trialChunk=process.env.T106_CHUNK?Number(process.env.T106_CHUNK):null;
const out=path.resolve('artifacts/performance106'+(trialChunk?'-chunk'+trialChunk:'')+(process.env.T106_TAG?'-'+process.env.T106_TAG:''));fs.mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const hook=String.raw`
window.__bench106={
 prepare(){
  window.__seed106(106106);window.__time106=1000;last=1;tAcc=0;
  if(!G.started){el('iName').value='건축 성능 비교';el('bSolo').click();window.__introDone();}
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  if(miniOn())miniLeave();G.phase='night';G.t=100000;G.day=15;G.paused=false;G.host=true;G.set.cInv=true;
  for(const id of [...STRU.keys()])delStru(id);G.wolves.length=0;G.soldiers.length=0;spawnQ.length=0;
  G.players.clear();pcMap.clear();G.crystal=G.set.crystalMax;
  Object.assign(PL,{down:false,hp:maxHP(),x:0,z:14,y:GY,vy:0,yaw:0,pitch:-.15});
  camZoom=3.2;XP.lv=35;XP.job=0;XP.jt=2;
  for(const k in KEY)KEY[k]=false;
  for(const k in DBG)if(typeof DBG[k]==='boolean')DBG[k]=false;
  DBG.noRender=true;DBG.noVoice=true;DBG.noSim=true;
  for(let i=0;i<20;i++){
   const id='bench'+i,x=(i%5-2)*2.2,z=10-Math.floor(i/5)*2.2;
   G.players.set(id,{uid:id,x,y:GY,z,tx:x,ty:GY,tz:z,ry:i*.3,g:i%5,n:'친구'+i,mv:true,hp:100,down:false,ph:i,wp:3,we:6,jb:i%3,jt:2});
   pcMap.set(id,{g:i%5,wp:3,we:6,jb:i%3,jt:2,n:'친구'+i});
  }
  // Keep the central player approach and the explicit wall regression fixture free.
  const candidates=[];
  for(let x=-58;x<=58;x+=4)for(let z=-58;z<=58;z+=4){
   if(Math.abs(x)<7&&Math.abs(z)<19)continue;
   if(x>10&&x<23&&z>10&&z<23)continue;
   candidates.push({x,z,sort:Math.random()});
  }
  candidates.sort((a,b)=>a.sort-b.sort);
  const placements=[];
  for(const p of candidates){
   const i=placements.length,t=['arrow','ice','pulse','barr','arrow','ice'][i%6],lv=3+i%5,g=i%5;
   if(canPlace(t,p.x,p.z))continue;
   const branch=t==='arrow'?(i%2?'sniper':'rapid'):t==='ice'?(i%2?'frost':'blizzard'):'';
   const hp=bs(t,'hp',lv),o={id:'tower'+i,t,x:p.x,z:p.z,g,lv,branch,hp:hp*(.55+(i%4)*.15),mx:hp,cd:1e6,sol:[],gunYaw:0,gunKick:0};
   addStru(o);placements.push({id:o.id,t,x:o.x,z:o.z,g,lv,branch});
   if(placements.length===120)break;
  }
  if(placements.length!==120)throw new Error('Insufficient valid late-game tower sites: '+placements.length);
  // Adjacent same-team wood walls across both chunk boundaries; different damage tints.
  const wallErrors=[];
  for(const [i,x,z] of [[0,15,15],[1,16,15],[2,15,16],[3,16,16]]){
   const error=canPlace('wwall',x,z);if(error)wallErrors.push({x,z,error});
   const hp=bs('wwall','hp',7);addStru({id:'boundary'+i,t:'wwall',x,z,g:0,lv:7,hp:hp*[1,.25,.55,.8][i],mx:hp,r:0});
  }
  if(wallErrors.length)throw new Error('Boundary fixture is not buildable: '+JSON.stringify(wallErrors));
  window.__setSky(1);updSky(0,true);window.__seed106(106106);window.__time106=1000;last=1;tAcc=0;
  rebuildStru();paintHUD();magHudPaint();
  // Three.js UUID allocation consumes Math.random for every new mesh. Batching
  // intentionally changes that count; resume the same gameplay random stream.
  window.__seed106(106106);
  return {players:G.players.size+1,buildings:STRU.size,towers:placements.length,placements,wallErrors,graphics:{...GFX,width:renderer.domElement.width,height:renderer.domElement.height}};
 },
 view(v){
  Object.assign(PL,{x:v.player[0],z:v.player[1],y:GY,vy:0,yaw:v.yaw||0,pitch:v.pitch??-.15});
  camAnc=null;camGY=null;camDistance=null;
  for(let i=0;i<30;i++){window.__time106+=1000/60;loop();}
  if(v.eye){camera.position.fromArray(v.eye);camera.lookAt(...v.target);camera.updateMatrixWorld();
   actorCullPrep(0,true);const list=[...G.players.values(),meSheep];
   drawSheep(list,tAcc,MAXP,s=>GHEX[s.g|0],SHEEP_S,true);blob83Draw(list);drawNPCs(tAcc);updSky(0,true);
  }
  let n=0;for(const o of STRU.values()){o.gunYaw=(v.motion||0)+n*.19;o.gunKick=v.kick||0;n++;}
  tickBuildingGuns(0);tintStru();scene.updateMatrixWorld(true);
  return {camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),gameTime:window.__time106,graphics:{...GFX}};
 },
 async instances(){
  let parts=0;for(const o of STRU.values())parts+=o._rk.length;
  const raw=new Float32Array(parts*19),m=new THREE.Matrix4(),c=new THREE.Color();let k=0;
  for(const o of STRU.values())for(let i=0;i<o._rk.length;i++){
   const mesh=struMeshes.get(o._rk[i]);mesh.getMatrixAt(o._ri[i],m);mesh.getColorAt(o._ri[i],c);
   raw.set(m.elements,k);k+=16;raw.set(c.toArray(),k);k+=3;
  }
  const hash=await crypto.subtle.digest('SHA-256',raw.buffer);
  return {parts,bytes:raw.byteLength,sha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};
 },
 submit(n){
  const gl=renderer.getContext(),frames=[];
  for(let i=0;i<n;i++){gl.finish();const start=window.__realNow();drawFrame();frames.push(window.__realNow()-start);gl.finish();}
  return frames;
 },
 draw(uncull=false){
  window.__bench106Uncull=uncull;
  const prior=[];if(uncull)for(const m of struMeshes.values()){prior.push([m,m.frustumCulled]);m.frustumCulled=false;}
  const start=window.__realNow();drawFrame();const submitMs=window.__realNow()-start;
  window.__bench106Uncull=false;
  for(const [m,cull]of prior)m.frustumCulled=cull;
  const gl=renderer.getContext();gl.finish();
  const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let str='';
  for(let i=0;i<pixels.length;i+=32768)str+=String.fromCharCode(...pixels.subarray(i,i+32768));
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {png:canvas.toDataURL(),pixels:btoa(str),width:canvas.width,height:canvas.height,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,submitMs,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 }
};
`;
const sources=[before,after].map(file=>({file:path.resolve(file),sha256:sha(fs.readFileSync(file))}));
const files=sources.map(({file},i)=>{
 let s=fs.readFileSync(file,'utf8');const marker='onIcons(()=>{ window.__READY = true; });';assert.ok(s.includes(marker));
 if(i&&trialChunk)s=s.replace(/const STRU_CHUNK = \d+;/,'const STRU_CHUNK = '+trialChunk+';');
 // Test-only full submission control for an optional compacted render pool.
 s=s.replaceAll('struRenderSync(camera)', 'struRenderSync(window.__bench106Uncull ? null : camera)');
 const dest=path.join(out,'instrumented-'+i+'.html');fs.writeFileSync(dest,s.replace(marker,hook+'\n'+marker));return dest;
});
const servers=files.map((file,i)=>serve(20806+i,file));
const report={note:'21 synthetic players and 120 legally placed late-game towers plus four adjacent walls. Same seeded world/time, 1366x768, gfx=mid/pr=.85/AA2. Actual drawFrame submissions and pixel equality only; software renderer submission time is not device FPS, GPU time or 21-device network performance.',trialChunk,afterCullingDisabled:process.env.T106_NOCULL==='1',sources,scenarios:{},errors:[]};
const views=[
 {name:'village-player',player:[0,14],yaw:0,pitch:-.15,motion:0},
 {name:'village-reverse',player:[0,-14],yaw:Math.PI,pitch:-.15,motion:Math.PI*.75,kick:1},
 {name:'east-entrance',player:[38,0],yaw:Math.PI/2,pitch:-.1,motion:Math.PI*1.5,kick:.5},
 {name:'wall-boundary',player:[12,19],eye:[18,12.2,20.5],target:[16,9.4,16],motion:Math.PI*2,kick:1},
 {name:'overview',player:[0,14],eye:[0,108,68],target:[0,9,0],motion:Math.PI*.3,kick:0}
];
function pixelsDiff(a,b,width){
 assert.equal(a.length,b.length);let changed=0,channels=0,max=0,sum=0;const examples=[];
 for(let i=0;i<a.length;i+=4){let p=false;for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]);if(d){p=true;channels++;sum+=d;max=Math.max(max,d);}}if(p){changed++;if(examples.length<12)examples.push({x:(i/4)%width,y:Math.floor(i/4/width),before:[...a.subarray(i,i+4)],after:[...b.subarray(i,i+4)]});}}
 return {changedPixels:changed,totalPixels:a.length/4,changedPercent:100*changed/(a.length/4),changedChannels:channels,maxChannelDifference:max,meanAbsoluteChannelDifference:sum/a.length,examples};
}
async function capture(page,label,uncull=false){
 const data=await page.evaluate(all=>__bench106.draw(all),uncull),png=Buffer.from(data.png.split(',')[1],'base64'),pixels=Buffer.from(data.pixels,'base64');
 fs.writeFileSync(path.join(out,label+'.png'),png);delete data.png;delete data.pixels;
 return {pixels,data:{...data,pngSHA256:sha(png)}};
}
let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for(const shadow of process.env.T106_SHADOW==='0'?[0]:[0,2048]){
  const pages=[];
  try{
   const setup=[];
   for(let i=0;i<2;i++){
    const p=await browser.newPage({viewport:{width:1366,height:768}});pages.push(p);
    p.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR '+e.message);});
    await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await p.addInitScript(()=>{
     window.__realNow=performance.now.bind(performance);window.__time106=1000;performance.now=()=>window.__time106;requestAnimationFrame=()=>0;
     localStorage.setItem('sndOn','0');let seed=106106;window.__seed106=n=>{seed=n;};Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    });
    await p.goto('http://127.0.0.1:'+(20806+i)+'/?gfx=mid&diag=1&shadow='+shadow+(i&&process.env.T106_NOCULL==='1'?'&p81off=struCull':''),{timeout:240000,waitUntil:'load'});
    await p.waitForFunction(()=>window.__READY===true,null,{timeout:240000,polling:100});
    setup.push(await p.evaluate(()=>__bench106.prepare()));console.log('Loaded '+(i?'after':'before')+' shadow='+shadow);
   }
   assert.deepEqual(setup[1],setup[0]);report['setupShadow'+shadow]=setup[0];
   for(const v of (shadow?[views[0],views[3]]:views).filter(v=>!process.env.T106_VIEW||v.name===process.env.T106_VIEW)){
    const poses=[];for(const p of pages)poses.push(await p.evaluate(view=>__bench106.view(view),v));assert.deepEqual(poses[1],poses[0],v.name+' camera/time');
    const states=[];for(const p of pages)states.push(await p.evaluate(()=>__bench106.instances()));
    const name=v.name+'-shadow'+shadow;
    // Warm shaders and measure the baseline's own repeat-draw noise separately.
    for(const p of pages)await p.evaluate(()=>__bench106.draw());
    const a=await capture(pages[0],name+'-before'),repeat=await capture(pages[0],name+'-before-repeat'),b=await capture(pages[1],name+'-after'),uncull=await capture(pages[1],name+'-after-unculled',true);
    const noise=pixelsDiff(a.pixels,repeat.pixels,a.data.width),difference=pixelsDiff(a.pixels,b.pixels,a.data.width);
    const cullDifference=pixelsDiff(b.pixels,uncull.pixels,b.data.width);
    report.scenarios[name]={pose:poses[0],instances:states,instancesEqual:JSON.stringify(states[0])===JSON.stringify(states[1]),before:a.data,after:b.data,afterUnculled:uncull.data,baselineRepeatNoise:noise,pixelDifference:difference,cullDifference,exactPixels:difference.changedPixels===0};
    if(process.env.T106_CPU==='1'&&v.name==='village-player'&&!shadow){
     for(const p of pages)await p.evaluate(()=>__bench106.submit(2));
     const rounds=[[],[]];for(let round=0;round<7;round++)for(const i of round%2?[1,0]:[0,1])rounds[i].push(await pages[i].evaluate(()=>__bench106.submit(3)));
     const summary=rounds.map(rounds=>{const frames=rounds.flat().sort((a,b)=>a-b);return {rounds,medianMs:frames[Math.floor(frames.length/2)],p95Ms:frames[Math.floor(frames.length*.95)]};});
     report.scenarios[name].submissionCPU={note:'Seven alternating rounds of three fixed-scene drawFrame submissions, GPU drained outside the stopwatch. Software renderer, no simulation/real-network/device-FPS or hardware-GPU claim.',before:summary[0],after:summary[1]};
    }
    fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));
    console.log(name+': '+JSON.stringify({beforeCalls:a.data.calls,afterCalls:b.data.calls,beforeTriangles:a.data.triangles,afterTriangles:b.data.triangles,instancesEqual:report.scenarios[name].instancesEqual,baselineNoise:noise.changedPixels,cullDifference:cullDifference.changedPixels,pixelDifference:difference}));
   }
  }finally{for(const p of pages)await p.close();}
 }
 fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));
 assert.deepEqual(report.errors,[]);
 for(const [name,r] of Object.entries(report.scenarios)){
  assert.ok(r.instancesEqual,name+' exact Float32 matrices and colors');
  assert.equal(r.cullDifference.changedPixels,0,name+' culling must not remove a visible pixel');
  assert.equal(r.pixelDifference.changedPixels,0,name+' pixel equality; baseline redraw noise='+r.baselineRepeatNoise.changedPixels);
  if(!trialChunk){
   assert.ok(r.after.calls<=r.before.calls,name+' must not add draw calls');
   assert.ok(r.after.triangles<=r.before.triangles,name+' must not add submitted triangles');
  }
 }
 console.log('PASS 106 browser structure comparison: '+Object.keys(report.scenarios).length+' views, exact pixels and instance data.');
}finally{await browser?.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));}
