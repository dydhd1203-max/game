// Targeted workshop art check. The main route uses real entry/input at the S1
// camera; only the explicitly labelled lifecycle fixture changes world state.
// PW_MODULE=... PW_EXECUTABLE_PATH=/usr/bin/chromium node 시즌2/tests/workshop-browser.mjs
// S2_WORKSHOP_BASELINE=1 S2_WORKSHOP_ROOT=/tmp/frozen-repo captures the old model.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';
import {VILLAGE_SITES,walkable} from '../src/content.mjs';
import {SEASON1_CAMERA} from '../src/camera-season1.mjs';

const root=path.resolve(process.env.S2_WORKSHOP_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const out=path.resolve(process.env.S2_WORKSHOP_OUTPUT||'/tmp/s2-007-workshop');
const baseline=process.env.S2_WORKSHOP_BASELINE==='1';
const entry=process.env.S2_WORKSHOP_ENTRY||'시즌2/';
const report={baseline,entry,environment:'guarded hidden Chromium; SwiftShader; 1366x768 DPR1',
  scope:'Real-input village spawn/front/side/exit, two sustained-input collision checks. Repeated phase switches are a supplementary synthetic resource-lifetime fixture. Standalone HTML loads offline.',
  notMeasured:['hardware laptop FPS','21 real network clients','subjective sound quality'],
  sourceHashes:{},checks:[],screenshots:[],movement:[],errors:[],requests:[]};
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
    const data=await readFile(file);report.sourceHashes[url.pathname]=createHash('sha256').update(data).digest('hex');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
});
let browser;
const check=(name,details)=>{report.checks.push({name,...details===undefined?{}:{details}});console.log('PASS '+name);};
try{
  await mkdir(out,{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
  page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('request',req=>report.requests.push(req.url()));
  page.on('response',res=>{if(res.status()>=400&&!res.url().endsWith('favicon.ico'))report.errors.push('HTTP '+res.status()+' '+res.url());});
  const frames=(n=3)=>page.evaluate(n=>new Promise(resolve=>{const next=()=>{if(--n<=0)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);}),n);
  const player=()=>page.evaluate(()=>{const p=Object.values(__S2.getState().players)[0];return {x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz};});
  const settle=async()=>{await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return Math.hypot(p.vx,p.vz)<.001;});await frames();};
  const capture=async(name,kind='actual-input')=>{
    await frames();const stats=await page.evaluate(()=>__S2.scene.stats());
    assert.ok(stats.calls>0&&stats.triangles>0,'Rendered world is nonempty');
    assert.equal(stats.pixelRatio,.85,'No drawing-scale reduction');
    assert.equal(stats.aaSamples,4,'Native AA remains enabled');
    const image=path.join(out,name+'.png');await page.screenshot({path:image});
    report.screenshots.push({name,kind,path:image,player:await player(),stats});
  };
  const walk=async(axis,target)=>{
    const yaw=await page.evaluate(()=>__S2.view.yaw);assert.ok(Math.abs(yaw)<.003,'Walking routes use restored north-facing camera');
    const before=await player(),direction=Math.sign(target-before[axis]);if(Math.abs(target-before[axis])<.2)return;
    const key=axis==='x'?(direction<0?'KeyA':'KeyD'):(direction<0?'KeyW':'KeyS');
    await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(({axis,target,direction})=>direction*(Object.values(__S2.getState().players)[0][axis]-target)>=-.15,{axis,target,direction});}
    finally{await page.keyboard.up(key);}
    await settle();const after=await player();assert.ok(walkable(after.x,after.z,.65),'Walk ends outside solid scenery');
    report.movement.push({key,target,axis,before,after});
  };
  const look=async(yaw,pitch=SEASON1_CAMERA.pitch)=>{
    const current=await page.evaluate(()=>({yaw:__S2.view.yaw,pitch:__S2.view.pitch}));
    const dx=-(yaw-current.yaw)/SEASON1_CAMERA.mouseSensitivity,dy=-(pitch-current.pitch)/SEASON1_CAMERA.mouseSensitivity;
    await page.mouse.move(1050,460);await page.mouse.down({button:'right'});
    try{await page.mouse.move(1050+dx,460+dy,{steps:8});}finally{await page.mouse.up({button:'right'});}
    await frames();
  };
  const collide=async(name,key)=>{
    const before=await player(),until=await page.evaluate(()=>__S2.getState().time+1.5);
    await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(until=>__S2.getState().time>=until,until);}finally{await page.keyboard.up(key);}
    await settle();const after=await player(),site=VILLAGE_SITES.workshop,distance=Math.hypot(after.x-site.x,after.z-site.z);
    assert.ok(distance>=site.r+.6&&distance<=site.r+.9,`${name}: player reaches and stops at workshop boundary (${distance})`);
    assert.ok(walkable(after.x,after.z,.65),'Player remains outside workshop');
    report.movement.push({collision:name,key,before,after,distance,site});check('실제 입력 작업장 '+name+' 충돌', {distance});
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await __S2.scene.ready;});
  await page.locator('#player-name').fill('작업장 검수');await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();await page.waitForFunction(()=>__S2.getState().phase==='lobby');
  await capture('01-lobby-default');
  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');
  await settle();await capture('02-village-default-spawn');
  assert.equal(await page.evaluate(()=>__S2.view.zoom),3.2);check('시즌1 기본 카메라로 실제 대기실에서 마을 입장');
  await walk('z',16);await walk('x',-5.2);await walk('z',14);
  await look(.65);await capture('03-workshop-front-default-pitch');
  await look(.65,.18);await capture('04-workshop-front-eaves-real-camera');
  await look(0);await collide('전면','KeyW');
  await look(.65,.18);await capture('05-workshop-front-boundary');await look(0);
  await walk('z',16);await walk('x',0);await walk('z',8);await walk('x',-2.8);
  await look(Math.PI/2,.18);await capture('06-workshop-east-side');await look(0);
  await collide('측면','KeyA');await look(Math.PI/2,.18);await capture('07-workshop-side-boundary');await look(0);
  await walk('x',0);await walk('z',2);await capture('08-northern-exit');
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);check('전면·측면·출구 실제 이동과 우클릭 카메라; 커서 잠금 없음');
  const saved=await page.evaluate(()=>{__S2.setManual(true);return structuredClone(__S2.getState());});
  const cycle=async()=>{for(const phase of ['forest','boss','village']){
    await page.evaluate(phase=>{const s=__S2.getState(),p=Object.values(s.players)[0];s.phase=phase;p.x=0;p.z=phase==='village'?25:phase==='forest'?-15:-103;},phase);await frames(2);
  }};
  await cycle();const before=await page.evaluate(()=>__S2.scene.stats());for(let i=0;i<5;i++)await cycle();
  const after=await page.evaluate(()=>__S2.scene.stats());report.lifecycle={kind:'synthetic phase fixture',cycles:5,before,after};
  assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);check('마을·숲·보스 반복 전환 시 GPU 자원 누적 없음');
  await page.evaluate(saved=>{__S2.setState(saved);__S2.setManual(false);},saved);
  if(!baseline){
    const offline=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1,offline:true});
    const release=await offline.newPage(),requests=[];release.on('pageerror',e=>report.errors.push('Standalone: '+e.message));
    release.on('request',r=>requests.push(r.url()));
    const file=path.join(root,'시즌2/배포용/index.html'),html=await readFile(file);
    // Managed Chromium blocks file://. Fulfil only this exact HTML from memory
    // with the context offline; every other network request remains blocked.
    const documentURL='http://127.0.0.1/standalone-memory.html?test=1';
    await offline.route(documentURL,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
    report.standalone={sha256:createHash('sha256').update(html).digest('hex'),requests,
      method:'Offline context; exact compiled HTML fulfilled from memory. Managed-browser file:// navigation is unavailable.'};
    await release.goto(documentURL,{waitUntil:'load',timeout:60000});
    await release.waitForFunction(()=>!!window.__S2);await release.evaluate(async()=>{await __S2.scene.ready;});
    await release.locator('#player-name').fill('오프라인 검수');await release.locator('input[name="mode"][value="solo"]').check();
    await release.locator('#entry-form button[type="submit"]').click();await release.waitForFunction(()=>__S2.getState().phase==='lobby');
    await release.locator('#start-game').click();await release.waitForFunction(()=>__S2.getState().phase==='village');
    await release.waitForFunction(()=>__S2.scene.stats().calls>0);
    report.standalone.stats=await release.evaluate(()=>__S2.scene.stats());
    assert.ok(report.standalone.stats.art.village.workshop,'Standalone retains imported workshop metadata');
    assert.ok(!requests.some(url=>url!==documentURL&&(/^https?:/i.test(url)||/\.glb(?:\?|$)/i.test(url))),'Standalone cannot request a remote/sidecar model');
    await release.screenshot({path:path.join(out,'09-standalone-offline.png')});await offline.close();
    check('독립 HTML 오프라인 마을 실행 및 외부 GLB 요청 없음');
  }
  assert.deepEqual(report.errors,[],'No browser runtime/asset errors');check('브라우저 실행·자산 오류 없음');report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+path.join(out,'report.json'));}
