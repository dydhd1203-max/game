// Real entry, native S1 camera and actual WASD/right-drag village route.
// Optional S2_VILLAGE_ROOT freezes old art independently of current edits.
// Crowd and phase-lifetime checks are separately labelled synthetic fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';

const root=path.resolve(process.env.S2_VILLAGE_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const out=path.resolve(process.env.S2_VILLAGE_OUTPUT||'/tmp/s2-008-village');
const baseline=process.env.S2_VILLAGE_BASELINE==='1';
const quick=process.env.S2_VILLAGE_QUICK==='1';
const ringReview=process.env.S2_VILLAGE_RING_REVIEW==='1';
const siteKeys=process.env.S2_VILLAGE_SITES?.split(',')||['assembly','market','smithYard','supplyYard','workshop','wagon'];
const entry=process.env.S2_VILLAGE_ENTRY||'시즌2/';
const content=await import(pathToFileURL(path.join(root,'시즌2/src/content.mjs')).href);
const {VILLAGE_SITES,SPAWN,walkable}=content;
for(const key of siteKeys)assert.ok(VILLAGE_SITES[key],'Known village site: '+key);
const {SEASON1_CAMERA}=await import(pathToFileURL(path.join(root,'시즌2/src/camera-season1.mjs')).href);
const report={baseline,quick,ringReview,entry,environment:'Guarded hidden Chromium / SwiftShader / 1366×768 / DPR1',
  scope:ringReview?'Final curb-removal art check: actual lobby entry/start, native-camera spawn, WASD from the central street to smith/workshop and right-drag close view. Exactly two art screenshots. No teleport, camera enlargement or hidden HUD.':quick?'Final-model contact patch smoke: actual entry, native-camera spawn, WASD to central lane and specified sites, right-drag side/close collision views. No teleport, camera enlargement or hidden HUD.':'Actual entry and WASD route at Season 1 native camera, right-drag views of six village buildings/nature and south boundary. No teleport, camera enlargement or hidden HUD for art screenshots. Crowd and lifetime fixtures are labelled separately.',
  notMeasured:['physical laptop FPS','21 real connected devices','subjective audio quality'],
  sites:VILLAGE_SITES,spawn:SPAWN,sourceHashes:{},checks:[],screenshots:[],movement:[],errors:[]};
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
  const frames=(n=4)=>page.evaluate(n=>new Promise(resolve=>{const tick=()=>{if(--n<=0)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);}),n);
  const player=()=>page.evaluate(()=>{const p=Object.values(__S2.getState().players)[0];return {x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz};});
  const settle=async()=>{await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return Math.hypot(p.vx,p.vz)<.001;});await frames(12);};
  const capture=async(name,kind='actual-input',frameWait=4)=>{
    if(frameWait)await frames(frameWait);const stats=await page.evaluate(()=>__S2.scene.stats());
    assert.ok(stats.calls>0&&stats.triangles>0,'Rendered world is nonempty');
    assert.equal(stats.pixelRatio,.85,'Drawing scale stays at Season 1 default');assert.equal(stats.aaSamples,4,'Native MSAA stays enabled');
    assert.equal(stats.graphics.toneMapping,'AgX');assert.equal(stats.graphics.exposure,1.28);
    const file=path.join(out,name+'.png');await page.screenshot({path:file});
    report.screenshots.push({name,kind,path:file,player:await player(),view:await page.evaluate(()=>({...__S2.view})),stats});
    console.log('CAPTURE '+name);
  };
  const walk=async(axis,target)=>{
    assert.ok(Math.abs(await page.evaluate(()=>__S2.view.yaw))<.003,'Walking uses restored north-facing camera');
    const before=await player(),direction=Math.sign(target-before[axis]);if(Math.abs(target-before[axis])<.2)return;
    const key=axis==='x'?(direction<0?'KeyA':'KeyD'):(direction<0?'KeyW':'KeyS');
    await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(({axis,target,direction})=>direction*(Object.values(__S2.getState().players)[0][axis]-target)>=-.15,{axis,target,direction});}
    finally{await page.keyboard.up(key);}await settle();const after=await player();
    assert.ok(walkable(after.x,after.z,.65),'Actual walking ends in walkable space');
    report.movement.push({key,axis,target,before,after});
  };
  const look=async(yaw,pitch=SEASON1_CAMERA.pitch)=>{
    const current=await page.evaluate(()=>({yaw:__S2.view.yaw,pitch:__S2.view.pitch}));
    const dx=-(yaw-current.yaw)/SEASON1_CAMERA.mouseSensitivity,dy=-(pitch-current.pitch)/SEASON1_CAMERA.mouseSensitivity;
    await page.mouse.move(1050,460);await page.mouse.down({button:'right'});
    try{await page.mouse.move(1050+dx,460+dy,{steps:8});}finally{await page.mouse.up({button:'right'});}await frames(12);
  };
  const collideSite=async key=>{
    const site=VILLAGE_SITES[key],before=await player(),direction=Math.sign(site.x-before.x);
    await look(0);await page.locator('#game').focus();
    const input=direction<0?'KeyA':'KeyD',until=await page.evaluate(()=>__S2.getState().time+3);
    await page.keyboard.down(input);
    try{await page.waitForFunction(until=>__S2.getState().time>=until,until);}finally{await page.keyboard.up(input);}
    await settle();const after=await player(),distance=Math.hypot(after.x-site.x,after.z-site.z);
    assert.ok(distance>=site.r+.64&&distance<=site.r+.95,`${key} horizontal approach stops at shared plot boundary: ${distance}`);
    assert.ok(walkable(after.x,after.z,.65),'Scenery collision prevents entry');
    report.movement.push({collision:key,input,before,after,distance,site});
    await look(site.x<0?Math.PI/2:-Math.PI/2,.1);
    await capture('detail-'+key+'-collision');
    await look(0);await walk('x',before.x);
  };
  const southBoundary=async()=>{
    await look(0);await walk('z',SPAWN.z+3);await look(Math.PI);await capture('11-south-turnaround');await look(0);
    // Actual held input discovers the movement limit without a hardcoded size.
    const before=await player(),until=await page.evaluate(()=>__S2.getState().time+7);
    await page.locator('#game').focus();await page.keyboard.down('KeyS');
    try{await page.waitForFunction(until=>__S2.getState().time>=until,until);}finally{await page.keyboard.up('KeyS');}
    await settle();const after=await player();assert.ok(walkable(after.x,after.z,.65));
    assert.ok(!walkable(after.x,after.z+.25,.65),'Sustained south movement stops at map boundary');
    report.movement.push({collision:'south world boundary',before,after});
    await look(Math.PI);await capture('12-south-boundary');await look(0);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await __S2.scene.ready;});
  await page.locator('#player-name').fill('마을 검수');await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();await page.waitForFunction(()=>__S2.getState().phase==='lobby');await settle();
  if(!ringReview)await capture('01-lobby-default');
  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');await settle();
  await capture('02-village-default-spawn');
  assert.equal(await page.evaluate(()=>__S2.view.zoom),3.2);check('실제 입장·출발 위치·시즌1 기본 카메라·동일 MSAA/그리기 배율');
  if(ringReview){
    await walk('x',0);await walk('z',VILLAGE_SITES.smithYard.z+1.5);await walk('x',-2.2);
    await look(.65);await capture('03-smith-workshop-no-stone-curbs');
    const villageSource=await readFile(path.join(root,'시즌2/src/village-a.mjs'));
    report.reviewedSource={file:'시즌2/src/village-a.mjs',sha256:createHash('sha256').update(villageSource).digest('hex'),
      scope:'The plantPlot helper shared by workshop and the other five model sites now emits grass/foliage only; all 216 former stone curb pieces were removed. Image review covers actual spawn and smith/workshop frontage; common helper inspection covers all six sites.'};
    check('돌 테두리 제거판의 실제 중앙 이동·대장간/작업장 근접 시점');
  }else{
  if(!baseline&&!quick){
    // Read-only frame observation records brief take/flip/land states. No pose,
    // time, player position or camera write is used to freeze an attractive shot.
    await page.evaluate(()=>{
      window.__villageMotion=[];window.__villageObserve=true;
      const observe=()=>{if(!window.__villageObserve)return;const s=__S2.getState(),p=Object.values(s.players)[0];
        if(__villageMotion.length<600)__villageMotion.push({time:s.time,x:p.x,y:p.y,z:p.z,run:p.run,air:p.air,ground:p.ground,take:p.take,flip:p.flip,land:p.land,camDip:p.camDip,stamina:p.stamina,camera:__S2.scene.stats().camera});requestAnimationFrame(observe);};requestAnimationFrame(observe);
    });
    assert.equal(await page.evaluate(()=>document.activeElement.id),'game','Start hands keyboard focus to the actual game');
    const until=await page.evaluate(()=>__S2.getState().time+.35);
    await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
    try{await page.waitForFunction(until=>__S2.getState().time>=until,until);}finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
    await settle();await walk('z',SPAWN.z);
    await page.keyboard.press('Space');await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.y>.5&&p.vy<9;});
    await capture('motion-first-jump','actual-input',0);
    if(await page.evaluate(()=>Object.values(__S2.getState().players)[0].ground)){await page.keyboard.press('Space');await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.vy<9;});}
    await page.keyboard.press('Space');await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.jumps===1&&p.flip>0;});
    await capture('motion-double-jump','actual-input',0);
    await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.ground&&p.land>0;});
    await capture('motion-landing','actual-input',0);await settle();
    report.motion=await page.evaluate(()=>{window.__villageObserve=false;return __villageMotion;});
    assert.ok(report.motion.some(s=>s.run&&s.stamina<.99),'Actual Shift movement retains running and stamina use');
    assert.ok(report.motion.some(s=>s.take>0)&&report.motion.some(s=>s.flip>0)&&report.motion.some(s=>s.land>0&&s.camDip>0),'Original jump/flip/landing feedback survives village art expansion');
    check('마을 중앙에서 실제 Shift 달리기·Space 2단 점프·착지와 카메라');
  }
  if(quick)await walk('x',0);
  let n=3;
  for(const key of siteKeys){
    const site=VILLAGE_SITES[key];await look(0);await walk('z',site.z+.8);
    await look(site.x<0?Math.PI/2:-Math.PI/2);
    await capture(String(n++).padStart(2,'0')+'-'+key+'-street-side');
    if(!baseline)await collideSite(key);
  }
  if(!quick){
  await look(0);await walk('z',Math.min(...Object.values(VILLAGE_SITES).map(s=>s.z))-5);
  await capture('09-north-exit-default');await look(Math.PI);await capture('10-north-return-street');await look(0);
  await southBoundary();
  check('여섯 건물·중앙 길·북쪽 입구·남쪽 가장자리 실제 이동과 우클릭 시점');
  if(!baseline){
    check('여섯 건물의 공유 충돌 경계에 실제 입력으로 접근·정지');
    // This uses real simulation roster placement, not a hand-arranged artwork
    // crowd. It is a local synthetic 21-player fixture, not 21 connections.
    const roster=await page.evaluate(()=>{
      const old=__S2.getState(),local=Object.values(old.players)[0],s=__S2.sim.createState();
      __S2.sim.addPlayer(s,{id:local.id,name:'마을 검수',team:0});
      for(let i=1;i<21;i++)__S2.sim.addPlayer(s,{id:'villageCrowd'+i,name:'모둠원 '+i,team:i%5,hat:i%8});
      __S2.setState(s);return Object.values(s.players).map(p=>({id:p.id,x:p.x,z:p.z}));
    });
    assert.equal(roster.length,21);for(const p of roster)assert.ok(walkable(p.x,p.z,.65),'All 21 native spawn positions are walkable');
    const minimumSeparation=Math.min(...roster.flatMap((p,i)=>roster.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.z-q.z))));
    assert.ok(minimumSeparation>=1.3,'21 native spawns do not overlap character radii');
    await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');await settle();
    await capture('13-crowd-native-spawn','supplementary synthetic 21-player roster; actual start/input');
    await walk('z',Math.min(...Object.values(VILLAGE_SITES).map(s=>s.z))-5);await look(Math.PI);
    await capture('14-crowd-north-return','supplementary synthetic 21-player roster; actual local walk/right drag');await look(0);
    report.crowd={kind:'21 local simulated actors; not network clients',roster,minimumSeparation};
    check('21명 실제 생성 위치와 중앙 출입 경로', {minimumSeparation});
    const saveFixture=await page.evaluate(()=>{
      const s=structuredClone(__S2.getState()),hostId=Object.keys(s.players)[0];s.version='s2-007';s.supplies=543;
      Object.values(s.players).forEach((p,i)=>Object.assign(p,{x:i%2?27:-27,z:28+(i%3)*1.7}));
      const oldKey='zns2:checkpoint:s2-007:solo',newKey='zns2:checkpoint:s2-008:solo';
      const bytes=JSON.stringify({season:2,version:'s2-007',hostId,state:s});
      localStorage.removeItem(newKey);localStorage.setItem(oldKey,bytes);
      return {oldKey,newKey,bytes};
    });
    await page.locator('#load-button').click();await page.waitForFunction(()=>__S2.getState().version==='s2-008'&&__S2.getState().supplies===543);
    const restored=await page.evaluate(()=>Object.values(__S2.getState().players).map(p=>({id:p.id,x:p.x,z:p.z,online:p.online})));
    assert.equal(restored.length,21);for(const p of restored)assert.ok(walkable(p.x,p.z,.65),'Loading old outer-lawn positions moves every roster entry to safe new-map positions');
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveFixture.oldKey),saveFixture.bytes,'Old s2-007 save bytes are retained');
    await page.locator('#save-button').click();
    const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveFixture.newKey);
    assert.equal(stored.version,'s2-008');assert.equal(stored.state.version,'s2-008');assert.equal(stored.state.supplies,543);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveFixture.oldKey),saveFixture.bytes,'New save cannot overwrite s2-007 payload');
    report.saveMigration={kind:'supplementary injected legacy payload; actual Load/Save UI',oldKey:saveFixture.oldKey,newKey:saveFixture.newKey,oldSha256:createHash('sha256').update(saveFixture.bytes).digest('hex'),oldPayloadUnchanged:true,restored,newVersion:stored.version};
    check('실제 불러오기/저장 UI: 007 저장 대체 읽기·21명 안전 위치·007 원본 보존·008 분리 저장');
    await page.evaluate(()=>__S2.setManual(true));
    const cycle=async()=>{for(const phase of ['forest','boss','village']){
      await page.evaluate(({phase,spawn})=>{const s=__S2.getState(),p=Object.values(s.players)[0];s.phase=phase;p.x=0;p.z=phase==='village'?spawn:phase==='forest'?-15:-103;},{phase,spawn:SPAWN.z});await frames(2);
    }};
    await cycle();const before=await page.evaluate(()=>__S2.scene.stats());for(let i=0;i<5;i++)await cycle();
    const after=await page.evaluate(()=>__S2.scene.stats());report.lifecycle={kind:'supplementary synthetic phase-switch fixture',cycles:5,before,after};
    assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);
    check('마을·숲·보스 반복 전환 시 GPU 자원 누적 없음');
  }
  }else {await southBoundary();check('최종 모델 접촉 보완: 실제 중앙 이동·지정 건물 측면/근접 충돌·남쪽 경계', {sites:siteKeys});}
  }
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);check('커서 잠금 없음');
  assert.deepEqual(report.errors,[]);check('브라우저 실행·자산 오류 없음');report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);console.error(report.failure);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+path.join(out,'report.json'));}
