// Actual entry/WASD/right-drag woodland and HUD review. No teleport, actor edits, camera
// enlargement, hidden HUD or simulation pause is used for the art screenshots.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';

const root=path.resolve(process.env.S2_WOODLAND_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const out=path.resolve(process.env.S2_WOODLAND_OUTPUT||'/tmp/s2-010-woodland');
const entry=process.env.S2_WOODLAND_ENTRY||'시즌2/';
const baseline=process.env.S2_WOODLAND_BASELINE==='1';
const visualOnly=process.env.S2_WOODLAND_VISUAL_ONLY==='1';
const mapReview=process.env.S2_WOODLAND_MAP_REVIEW==='1';
const targeted=process.env.S2_WOODLAND_TARGETED==='1';
const edgeOnly=process.env.S2_WOODLAND_EDGE_ONLY==='1';
const spawnOnly=process.env.S2_WOODLAND_SPAWN_ONLY==='1';
const {walkable,RELEASE,BUILD}=await import(pathToFileURL(path.join(root,'시즌2/src/content.mjs')).href);
const {SEASON1_CAMERA}=await import(pathToFileURL(path.join(root,'시즌2/src/camera-season1.mjs')).href);
const report={baseline,visualOnly,mapReview,targeted,edgeOnly,spawnOnly,entry,release:RELEASE,build:BUILD,environment:'Guarded hidden Chromium / SwiftShader / 1366×768 / DPR1',
  scope:'Actual lobby entry/start, WASD village north, south turnaround and northwest edge; real right-drag views. Native Season 1 camera and body. No overhead, teleport, modified actors, hidden HUD or lowered render quality.',
  requirements:['Layered woodland grass, flowers, broadleaf/pine forms and distant mountain backdrop','Dark dappled ground with readable paths and unchanged native camera','Compact dark goal upper left, circular minimap upper right, health/stamina lower left, useful shortcut cards lower right'],
  notMeasured:['physical laptop FPS','21 real connected devices','subjective audio quality'],
  sourceHashes:{},checks:[],screenshots:[],movement:[],layouts:[],errors:[]};
if(edgeOnly)report.scope='Targeted final pine revision: actual lobby entry/start, native-camera WASD to the northwest edge and right-drag close view. Exactly one artwork screenshot; no teleport, actor edits or lowered render quality.';
if(spawnOnly)report.scope='Final-build representative preview only: actual lobby entry/start and exactly one village spawn screenshot at the native Season 1 camera. No movement, teleport, actor edits, hidden HUD or lowered render quality.';
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json'};
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
  const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',res=>{if(res.status()>=400&&!res.url().endsWith('favicon.ico'))report.errors.push('HTTP '+res.status()+' '+res.url());});
  const frames=(n=3)=>page.evaluate(n=>new Promise(resolve=>{const tick=()=>{if(--n<=0)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);}),n);
  const player=()=>page.evaluate(()=>{const p=Object.values(__S2.getState().players)[0];return {x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz,hp:p.hp};});
  const settle=async()=>{await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return Math.hypot(p.vx,p.vz)<.001;});await frames(5);};
  const capture=async(name,frameWait=3)=>{
    if(frameWait)await frames(frameWait);const stats=await page.evaluate(()=>__S2.scene.stats()),position=await player();
    assert.ok(stats.calls>0&&stats.triangles>0,'Rendered world is nonempty');
    assert.equal(stats.pixelRatio,.85,'Season 1 drawing scale stays enabled');assert.equal(stats.aaSamples,4,'Native MSAA stays enabled');
    assert.equal(stats.graphics.toneMapping,'AgX');assert.equal(stats.graphics.exposure,1.28);
    assert.equal(stats.camera.bodyHidden,false,'Actual third-person body remains visible');assert.ok(position.hp>0,'The actual actor is alive');
    const file=path.join(out,name+'.png');await page.screenshot({path:file});
    report.screenshots.push({name,kind:'actual-input',path:file,viewport:page.viewportSize(),player:position,view:await page.evaluate(()=>({...__S2.view})),stats,phase:await page.evaluate(()=>__S2.getState().phase)});
    console.log('CAPTURE '+name);
  };
  const walk=async(axis,target)=>{
    assert.ok(Math.abs(await page.evaluate(()=>__S2.view.yaw))<.003,'Walking uses restored north-facing camera');
    const before=await player(),direction=Math.sign(target-before[axis]);if(Math.abs(target-before[axis])<.2)return;
    const key=axis==='x'?(direction<0?'KeyA':'KeyD'):(direction<0?'KeyW':'KeyS');
    await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(({axis,target,direction})=>direction*(Object.values(__S2.getState().players)[0][axis]-target)>=-.15,{axis,target,direction});}
    finally{await page.keyboard.up(key);}await settle();const after=await player();
    assert.ok(walkable(after.x,after.z,.65),'Actual walking remains outside solid scenery');
    assert.ok(after.hp>0,'Actual walking finishes alive');report.movement.push({key,axis,target,before,after});
  };
  const look=async(yaw,pitch=SEASON1_CAMERA.pitch)=>{
    const current=await page.evaluate(()=>({yaw:__S2.view.yaw,pitch:__S2.view.pitch}));
    const dx=-(yaw-current.yaw)/SEASON1_CAMERA.mouseSensitivity,dy=-(pitch-current.pitch)/SEASON1_CAMERA.mouseSensitivity;
    await page.mouse.move(1000,460);await page.mouse.down({button:'right'});
    try{await page.mouse.move(1000+dx,460+dy,{steps:8});}finally{await page.mouse.up({button:'right'});}await frames(5);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await __S2.scene.ready;});
  await page.locator('#player-name').fill('숲 마을 검수');await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();await page.waitForFunction(()=>__S2.getState().phase==='lobby');
  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');await settle();
  if(!edgeOnly)await capture('01-village-spawn');assert.equal(await page.evaluate(()=>__S2.view.zoom),3.2);
  check('실제 입장·마을 출발·시즌1 3.2m 카메라와 화질 유지');
  if(spawnOnly){
    assert.equal(report.screenshots.length,1,'Representative preview contains exactly one actual spawn screenshot');
  }else if(edgeOnly){
    await walk('x',0);await walk('z',-5);await walk('x',-17.5);await look(Math.PI/2);
    await capture('04-village-northwest-edge');check('가까운 침엽수 가지 방향·폭 보정판의 실제 북서쪽 접근');
  }else if(mapReview||targeted){
    await page.locator('#minimap-toggle').click();await frames(4);
    assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'true');
    const mapNotice=await page.evaluate(()=>{
      const map=document.getElementById('minimap-panel').getBoundingClientRect(),el=document.getElementById('notice'),r=el.getBoundingClientRect();
      const visible=!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
      return {visible,map:{x:map.x,y:map.y,w:map.width,h:map.height},notice:{x:r.x,y:r.y,w:r.width,h:r.height},overlap:visible&&Math.min(map.right,r.right)>Math.max(map.left,r.left)&&Math.min(map.bottom,r.bottom)>Math.max(map.top,r.top)};
    });
    report.mapNotice=mapNotice;assert.equal(mapNotice.overlap,false,'Status notice does not cover the expanded map');
    await capture('02-expanded-map-clear-notice');
    await page.locator('#minimap-toggle').click();await frames(4);
    assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#notice').isVisible(),true,'Status notice returns after map closes');
    check('실제 지도 확대 시 안내 겹침 제거·닫은 뒤 안내 복구');
    if(targeted){
      await walk('x',0);await walk('z',-5);await walk('x',-17.5);await look(Math.PI/2);
      await capture('04-village-northwest-edge');
      check('실제 WASD 북서쪽 접근·우클릭으로 가까운 침엽수 확인');
    }
  }else{
  await walk('x',0);await walk('z',-6);await look(.55);await capture('02-village-north-woodland');await look(0);
  await walk('z',27.2);await look(Math.PI);await capture('03-village-south-mountains');await look(0);
  // Cross one metre south of the north-view stop. A held-key release can run
  // past its target by one frame; z=-5 leaves margin from the tree at (-9,-7.8).
  await walk('z',-5);await walk('x',-17.5);await look(Math.PI/2);await capture('04-village-northwest-edge');await look(0);
  check('실제 WASD 북쪽·남쪽·북서쪽 이동과 우클릭 시점');
  if(!baseline&&!visualOnly){
    await walk('x',0);await walk('z',19);
    const mapImage=()=>page.locator('#minimap').evaluate(el=>el.toDataURL());
    const mapBefore=await mapImage(),beforeRun=await player();
    assert.equal(await page.locator('#minimap').evaluate(el=>el.width),256);
    assert.equal(await page.locator('#minimap').evaluate(el=>el.height),256);
    await page.evaluate(()=>{
      window.__woodlandMotion=[];window.__woodlandObserve=true;
      const observe=()=>{if(!window.__woodlandObserve)return;const s=__S2.getState(),p=Object.values(s.players)[0];
        if(__woodlandMotion.length<500)__woodlandMotion.push({time:s.time,x:p.x,y:p.y,z:p.z,run:p.run,air:p.air,ground:p.ground,take:p.take,flip:p.flip,land:p.land,camDip:p.camDip,stamina:p.stamina,meter:Number(document.getElementById('stamina-meter').getAttribute('aria-valuenow'))});requestAnimationFrame(observe);};requestAnimationFrame(observe);
    });
    assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
    const runUntil=await page.evaluate(()=>__S2.getState().time+.6);
    await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
    try{await page.waitForFunction(until=>__S2.getState().time>=until,runUntil);}finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
    await settle();const mapAfter=await mapImage(),afterRun=await player();
    assert.ok(beforeRun.z-afterRun.z>2,'Running moves the real actor forward');
    assert.notEqual(mapBefore,mapAfter,'Real actor movement updates the minimap');
    report.minimap={beforeSha256:createHash('sha256').update(mapBefore).digest('hex'),afterSha256:createHash('sha256').update(mapAfter).digest('hex'),beforeRun,afterRun};
    await page.keyboard.press('Space');await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.y>.5&&p.vy<9;});
    await page.keyboard.press('Space');await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.jumps===1&&p.flip>0;});
    await capture('05-actual-double-jump',0);
    await page.waitForFunction(()=>Object.values(__S2.getState().players)[0].ground);await settle();
    report.motion=await page.evaluate(()=>{window.__woodlandObserve=false;return __woodlandMotion;});
    assert.ok(report.motion.some(s=>s.run&&s.stamina<.95&&s.meter<100),'Real sprint depletes stamina and updates the visible meter');
    assert.ok(report.motion.some(s=>s.take>0)&&report.motion.some(s=>s.flip>0)&&report.motion.some(s=>s.land>0&&s.camDip>0),'Native takeoff, double jump and landing camera feedback remain');
    await page.waitForFunction(()=>Number(document.getElementById('stamina-meter').getAttribute('aria-valuenow'))===100);
    check('실제 달리기·기력 표시/회복·2단 점프·착지와 이동하는 미니맵');

    const layout=async(label,selectors,allowOverlap=false)=>{
      const data=await page.evaluate(selectors=>selectors.map(selector=>{const el=document.querySelector(selector);if(!el||el.hidden||!el.getClientRects().length)return null;const r=el.getBoundingClientRect();return {selector,x:r.x,y:r.y,w:r.width,h:r.height};}).filter(Boolean),selectors);
      const size=page.viewportSize();for(const r of data)assert.ok(r.x>=-.5&&r.y>=-.5&&r.x+r.w<=size.width+.5&&r.y+r.h<=size.height+.5,`${label} ${r.selector} stays within viewport`);
      const overlaps=[];for(let i=0;i<data.length;i++)for(let j=i+1;j<data.length;j++){const a=data[i],b=data[j],w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(w>2&&h>2)overlaps.push([a.selector,b.selector,Math.round(w*h)]);}
      report.layouts.push({label,viewport:size,rectangles:data,overlaps});if(!allowOverlap)assert.deepEqual(overlaps,[],label+' key HUD regions do not overlap');
    };
    const hudSelectors=['.topbar','#village-panel','#minimap-panel','.top-tools','#health-panel','#bottom-help','#teacher-bar'];
    await layout('desktop base',hudSelectors);
    await page.locator('#minimap-toggle').click();await frames(3);
    assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'true');await page.locator('#map-legend').waitFor({state:'visible'});
    await capture('06-expanded-map');await page.locator('#minimap-toggle').click();
    assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'false');
    check('실제 미니맵 확대·주변 지도 복귀');

    const panel=async(name,screenshot)=>{
      await page.locator('#'+name+'-toggle').click();await page.locator('#'+name+'-panel').waitFor({state:'visible'});
      assert.equal(await page.locator('#'+name+'-toggle').getAttribute('aria-expanded'),'true');
      for(const other of ['help','settings','performance'].filter(x=>x!==name))assert.equal(await page.locator('#'+other+'-panel').isVisible(),false,'Only the requested tool panel is open');
      await layout(name+' panel',['#'+name+'-panel']);
      if(name==='settings'){
        await page.locator('#bgm-volume').focus();await page.keyboard.press('ArrowRight');
        const value=await page.locator('#bgm-volume').inputValue();await page.waitForFunction(value=>document.getElementById('bgm-output').textContent===value,value);
        assert.equal(await page.evaluate(()=>__S2.audio.getVolumes().bgm),Number(value),'Sound slider controls the actual audio volume');
      }
      if(name==='performance')await page.waitForFunction(()=>Number(document.getElementById('perf-calls').textContent)>0);
      if(screenshot)await capture(screenshot);
      await page.locator('#'+name+'-close').click();await page.locator('#'+name+'-panel').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>document.activeElement.id),'game','Closing tool restores keyboard focus');
    };
    await panel('help','07-help-desktop');
    await page.locator('#save-button').click();const saveKey='zns2:checkpoint:'+BUILD+':solo';
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);assert.equal(saved.version,BUILD);
    const savedActor=Object.values(saved.state.players)[0];await walk('z',savedActor.z-2);
    await page.locator('#load-button').click();await settle();const restored=await player();
    assert.ok(Math.hypot(restored.x-savedActor.x,restored.z-savedActor.z)<.01,'Actual save/load restores the saved village position');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
    await page.locator('#pause-button').click();await page.waitForFunction(()=>__S2.getState().paused);await page.locator('#pause-screen').waitFor({state:'visible'});
    const paused=await player();await page.keyboard.down('KeyW');await frames(4);await page.keyboard.up('KeyW');assert.deepEqual(await player(),paused,'Pause prevents actual movement');
    await page.locator('#resume-button').click();await page.waitForFunction(()=>!__S2.getState().paused);assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
    await walk('z',restored.z-1);report.saveLoad={saveKey,savedPosition:{x:savedActor.x,z:savedActor.z},restored};
    check('실제 저장/불러오기·일시정지/계속하기와 UI 종료 후 이동');

    for(const {width,height,panelName} of [{width:820,height:600,panelName:'performance'},{width:560,height:700,panelName:'settings'}]){
      await page.setViewportSize({width,height});await frames(5);await layout(`${width}x${height} base`,hudSelectors);
      await capture(`08-hud-${width}x${height}`);await panel(panelName,`09-${panelName}-${width}x${height}`);
    }
    check('수첩·소리 설정·성능 패널 실제 조작과 1366/820/560 화면의 HUD 배치');
  }
  }
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);check('커서 잠금 없음');
  assert.deepEqual(report.errors,[]);check('브라우저 실행·자산 오류 없음');report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);console.error(report.failure);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+path.join(out,'report.json'));}
